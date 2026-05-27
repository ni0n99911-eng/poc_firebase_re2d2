/**
 * GET /api/request-failures
 *
 * Returns a per-source breakdown of failed and null-return results from the
 * 20-source parallel fetch in fetchLocationIntel(). Aggregated from the
 * in-process failure ring buffer in failure-tracker.ts.
 *
 * Response shape:
 * {
 *   timestamp:   string,              // ISO-8601
 *   totalInRing: number,              // raw entries in the buffer
 *   sources:     Record<source, {
 *     failureCount: number,
 *     lastKind:     'error' | 'null_return' | 'breaker_open',
 *     lastError:    string,
 *     lastSeen:     string,           // ISO-8601
 *   }>,
 *   recentLog:   FailureRecord[],     // last 50 raw entries (newest last)
 *   summary: {
 *     degradedSources: string[],      // sources with ≥1 failure
 *     criticalSources: string[],      // sources with ≥5 failures
 *   }
 * }
 *
 * Auth: Clerk JWT required (same guard as /api/circuit-health).
 * INFRA-04 — Brain 2, April 12 2026
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/auth-middleware';
import { getFailureStats, getFailureRing } from '$lib/intel/failure-tracker';

export const GET: RequestHandler = async ({ request }) => {
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;

	const stats   = getFailureStats();
	const ring    = getFailureRing(50);

	const degradedSources = Object.keys(stats);
	const criticalSources = Object.entries(stats)
		.filter(([, s]) => s.failureCount >= 5)
		.map(([src]) => src);

	// Reshape for JSON consumers — drop internal ms fields, use ISO strings
	const sources: Record<string, {
		failureCount: number;
		lastKind:     string;
		lastError:    string;
		lastSeen:     string;
	}> = {};

	for (const [source, stat] of Object.entries(stats)) {
		sources[source] = {
			failureCount: stat.failureCount,
			lastKind:     stat.lastKind,
			lastError:    stat.lastError,
			lastSeen:     stat.lastSeenIso,
		};
	}

	return json({
		timestamp:   new Date().toISOString(),
		totalInRing: ring.length,
		sources,
		recentLog:   ring.map(r => ({
			source:  r.source,
			kind:    r.kind,
			message: r.message,
			ts:      new Date(r.ts).toISOString(),
		})),
		summary: {
			degradedSources,
			criticalSources,
		},
	}, {
		status: 200,
		headers: { 'Cache-Control': 'no-store' },
	});
};
