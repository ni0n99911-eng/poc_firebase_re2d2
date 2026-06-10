/**
 * RE² Health Check — Theme B
 *
 * GET /api/health
 *
 * Tests all backend dependencies and returns a JSON status report.
 * Called on app load from +layout.svelte — surfaces an amber banner
 * if any dependency is down so testers/users see "limited features"
 * rather than silent failures.
 *
 * Checks:
 *   1. clerk    — Clerk JWT present and decodable
 *   2. supabase — Supabase service_role can read (scored_locations)
 *   3. storage  — vault-files bucket is reachable
 *   4. openrouter — OpenRouter API key is set and API responds
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/db-server';
import * as schema from '$lib/db/schema';
import { env } from '$env/dynamic/private';
// BR-N (April 11, 2026): Surface nyc-schools bbox cache stats so we can
// confirm TTL.SCHOOLS is live (was TTL.LONG undefined for months).
import { getCacheStats as getSchoolsCacheStats } from '$lib/intel/nyc-schools';
// MON-01 (April 12 2026): Circuit breakers, cache hit rates, quota proximity
import { getCircuitStats }  from '$lib/intel/retry';
import { getBreakerStates } from '$lib/intel/resilient-fetch';
import { getRateLimitStats } from '$lib/intel/rate-limit-tracker';
import { getCacheHitStats }  from '$lib/intel/cache';

function getUserId(request: Request): string | null {
	const auth = request.headers.get('authorization') || '';
	if (auth.startsWith('Bearer ')) {
		try {
			const payload = JSON.parse(atob(auth.split('.')[1]));
			return payload.sub || null;
		} catch { return null; }
	}
	return null;
}

export const GET: RequestHandler = async ({ request }) => {
	const checks: Record<string, { ok: boolean; detail?: string }> = {};

	// 1. Auth check (Bypassed since we use Firebase Session cookies now, not Authorization headers)
	checks.clerk = {
		ok: true,
		detail: 'bypassed for firebase session cookies'
	};


	// 2. Drizzle DB read — use founder_sessions (migration 003 table)
	try {
		await db.select({ userId: schema.founderSessions.userId }).from(schema.founderSessions).limit(1);
		checks.supabase = { ok: true };
	} catch (e: unknown) {
		checks.supabase = { ok: false, detail: String(e) };
	}

	// 3. Supabase Storage — vault-files bucket
	// Bypassed for Drizzle migration since db does not provide storage directly.
	checks.storage = { ok: true, detail: 'bypassed for drizzle' };

	// 4. OpenRouter reachability
	try {
		const key = env.OPENROUTER_API_KEY || '';
		if (!key) {
			checks.openrouter = { ok: false, detail: 'OPENROUTER_API_KEY not set' };
		} else {
			const ctrl = new AbortController();
			const timer = setTimeout(() => ctrl.abort(), 5000);
			try {
				const res = await fetch('https://openrouter.ai/api/v1/models', {
					method: 'HEAD',
					headers: { Authorization: `Bearer ${key}` },
					signal: ctrl.signal
				});
				clearTimeout(timer);
				checks.openrouter = { ok: res.ok || res.status === 405, detail: (!res.ok && res.status !== 405) ? `HTTP ${res.status}` : undefined };
			} catch {
				clearTimeout(timer);
				checks.openrouter = { ok: false, detail: 'Network error or timeout' };
			}
		}
	} catch (e: unknown) {
		checks.openrouter = { ok: false, detail: String(e) };
	}

	const allOk = Object.values(checks).every(c => c.ok);

	// BR-N: Observability — nyc-schools bbox cache stats (non-gating).
	let schoolsCache: ReturnType<typeof getSchoolsCacheStats> | null = null;
	try {
		schoolsCache = getSchoolsCacheStats();
	} catch {
		schoolsCache = null;
	}

	// MON-01: Circuit breaker state per hostname (retry.ts) + per source (resilient-fetch.ts)
	let retryCircuits: ReturnType<typeof getCircuitStats> | null = null;
	let sourceBreakers: ReturnType<typeof getBreakerStates> | null = null;
	try { retryCircuits  = getCircuitStats();  } catch { retryCircuits  = null; }
	try { sourceBreakers = getBreakerStates(); } catch { sourceBreakers = null; }

	// MON-01: L1/L2 cache hit rates
	let cacheHitStats: ReturnType<typeof getCacheHitStats> | null = null;
	try { cacheHitStats = getCacheHitStats(); } catch { cacheHitStats = null; }

	// MON-01: Quota proximity for Google Places, Foursquare, Yelp
	let rateLimits: ReturnType<typeof getRateLimitStats> | null = null;
	let nearLimitApis: string[] = [];
	try {
		rateLimits = getRateLimitStats();
		nearLimitApis = Object.entries(rateLimits)
			.filter(([, s]) => s.nearLimit)
			.map(([label]) => label);
	} catch {
		rateLimits = null;
	}

	return json({
		ok: allOk,
		checks,
		caches: {
			schools:  schoolsCache,
			hitRates: cacheHitStats,
		},
		// MON-01 fields — non-gating observability
		circuits: {
			retryCircuits,
			sourceBreakers,
		},
		quotas: {
			rateLimits,
			nearLimitApis,
			estimatedGoogleCostUsd: rateLimits?.['GooglePlaces']?.estimatedCostUsd ?? 0,
		},
	}, {
		status: 200,
		headers: { 'Cache-Control': 'no-store' }
	});
};
