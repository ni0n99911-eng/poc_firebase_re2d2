/**
 * Location Intelligence API endpoint.
 *
 * GET /api/location-intel?lat=40.7128&lng=-74.0060&type=cafe&address=123+Main+St
 *
 * Returns a full 4-layer enhanced location intelligence report:
 * - Layer 1: Raw API data from 20 sources (Census, Walk Score, Crime, Places, etc.)
 * - Layer 2: Cross-source reconciled entities (deduped, conflict-resolved)
 * - Layer 3: Business-specific extrapolations (force multipliers, demand, risk)
 * - Layer 4: AI narratives with transparency disclosures
 *
 * Optional params:
 * - ai=true: Enable AI-enhanced narratives (requires ANTHROPIC_API_KEY)
 * - legacy=true: Return Layer 1 only (backward-compatible raw report)
 * - refresh=true: Bypass cache and force fresh fetch from all sources
 *
 * All sources run in parallel. Individual failures return null
 * without blocking other sources.
 *
 * ─── PERSISTENT CACHE ──────────────────────────────────────────────────────────
 * Caches the full assembled report in the existing intel_cache table (L1 memory +
 * L2 Supabase). Cache key includes: geoid, businessType, legacy/ai flags, and a
 * schema version so deploys with structural response changes auto-invalidate.
 *
 * Read path:  Before calling fetchLocationIntel(), check cache. If hit → return
 *             cached payload immediately (<5ms for L1, ~100ms for L2).
 * Write path: After fetchLocationIntel() returns, AWAIT the cache write to ensure
 *             it completes before the serverless function terminates.
 *
 * Expected impact: ~80% cache hit rate for repeat addresses in NYC metro.
 *   Cost savings: ~$26/1K cached requests (avoids Google Places + WalkScore calls).
 *   Latency savings: 4-8s per cached request.
 *
 * RLS: no user isolation needed — location intel is public/non-PII.
 * TTL: 7 days (census + crime data changes slowly; competitor data changes faster).
 * ────────────────────────────────────────────────────────────────────────────────
 */

import type { RequestHandler } from '@sveltejs/kit';
import { fetchLocationIntel, fetchEnhancedLocationIntel } from '$lib/intel';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';
// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
import { normalizeBusinessType } from '$lib/intel/registry/business-type-registry';
import { intelCache } from '$lib/intel/cache';
import { latLngToGeoid } from '$lib/intel/block-group';
import { createHash } from 'crypto';

// ── Cache Configuration ─────────────────────────────────────────────────────────
// Bump SCHEMA_VERSION when the response shape changes (e.g. new layers, renamed
// fields). This auto-invalidates all cached reports from previous versions without
// requiring a manual cache flush or TTL expiry.
const SCHEMA_VERSION = 1;
const REPORT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Build a deterministic cache key for a full location-intel report.
 *
 * Components: geoid (or lat/lng fallback), businessType, legacy flag, ai flag,
 * and schema version. This ensures:
 * - Same physical location → same cache entry (geoid normalizes coordinates)
 * - Different business types → separate cache entries (scoring differs)
 * - Different report modes → separate cache entries (legacy vs enhanced)
 * - Schema changes → automatic invalidation (version bump)
 */
function buildReportCacheKey(
	lat: number,
	lng: number,
	businessType: string,
	legacy: boolean,
	useAI: boolean,
	geoid: string | null
): string {
	// Use geoid when available for geographic normalization; fall back to
	// rounded lat/lng (4 decimals ≈ 11m precision) when geoid lookup fails.
	const geoComponent = geoid || `${lat.toFixed(4)},${lng.toFixed(4)}`;
	const raw = `v${SCHEMA_VERSION}:${geoComponent}:${businessType}:${legacy ? 'L' : 'E'}:${useAI ? 'AI' : 'NA'}`;
	const hash = createHash('sha256').update(raw).digest('hex').substring(0, 16);
	return `location-report:${hash}`;
}

export const GET: RequestHandler = async ({ url, request }) => {
	const limited = rateLimit(request, RATE_LIMITS.intel);
	if (limited) return limited;
	const lat = parseFloat(url.searchParams.get('lat') || '');
	const lng = parseFloat(url.searchParams.get('lng') || '');
	const rawType = url.searchParams.get('type') || 'cafe';
	const businessType = normalizeBusinessType(rawType);
	const address = url.searchParams.get('address') || undefined;
	const useAI = url.searchParams.get('ai') === 'true';
	const legacy = url.searchParams.get('legacy') !== 'false';
	const forceRefresh = url.searchParams.get('refresh') === 'true';

	if (isNaN(lat) || isNaN(lng)) {
		return new Response(JSON.stringify({
			error: 'Missing or invalid lat/lng parameters',
			usage: '/api/location-intel?lat=40.7128&lng=-74.0060&type=cafe'
		}), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Validate coordinate ranges
	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
		return new Response(JSON.stringify({
			error: 'lat must be -90 to 90, lng must be -180 to 180'
		}), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		// ── Step 1: Resolve geoid (cheap — has its own in-memory FIPS_CACHE) ────
		const geoid = await latLngToGeoid(lat, lng);
		const cacheKey = buildReportCacheKey(lat, lng, businessType, legacy, useAI, geoid);

		// ── Step 2: Check cache (unless ?refresh=true) ──────────────────────────
		if (!forceRefresh) {
			const cached = await intelCache.getAsync<Record<string, unknown>>(cacheKey);
			if (cached && cached.fresh) {
				return new Response(JSON.stringify(cached.data), {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'private, max-age=300',
						'X-Cache': 'HIT',
						'X-Cache-Key': cacheKey,
						'Access-Control-Allow-Origin': '*'
					}
				});
			}
		}

		// ── Step 3: Cache miss — fetch fresh data from all sources ───────────────
		let report;

		if (legacy) {
			// Backward-compatible: Layer 1 raw report only
			report = await fetchLocationIntel(lat, lng, businessType, address);
		} else {
			// Full 4-layer enhanced pipeline
			report = await fetchEnhancedLocationIntel(lat, lng, businessType, address, { useAI });
		}

		// ── Step 4: Write to cache (AWAITED — critical for serverless) ───────────
		// In serverless environments (Netlify Functions, Vercel Edge), un-awaited
		// promises may be killed when the response is sent. We must await the cache
		// write to guarantee persistence.
		try {
			await intelCache.setAsync(cacheKey, report, REPORT_CACHE_TTL_MS, 'location-report');
		} catch (cacheWriteErr) {
			// Cache write failure is non-fatal — log and continue
			console.warn('[LocationIntel] Cache write failed:', cacheWriteErr instanceof Error ? cacheWriteErr.message : cacheWriteErr);
		}

		return new Response(JSON.stringify(report), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'private, max-age=300', // Browser cache: 5 min; private to prevent CDN caching stale data
				'X-Cache': 'MISS',
				'X-Cache-Key': cacheKey,
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch (e: unknown) {
		console.error('[LocationIntel] Endpoint error:', e);
		return new Response(JSON.stringify({
			error: 'Internal error fetching location intelligence',
			message: e instanceof Error ? e.message : 'Unknown error'
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
