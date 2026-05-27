/**
 * NYC School Proximity client.
 *
 * Fetches school location data from NYC Open Data (Socrata API).
 * Free, no API key required.
 * Dataset: https://data.cityofnewyork.us/Education/2019-2020-School-Locations/wg9x-4ke6
 *
 * Purpose: Powers Vital Rule 17 — NYS SLA 200-ft school/church proximity lock.
 * If a school entrance is within 200 ft (~61 m) on the same street,
 * a liquor license is BLOCKED with zero exceptions.
 *
 * Also provides general "family-friendly area" signal for fitness,
 * personal services, and retail concepts.
 */

import { IntelCache, intelCache, TTL } from './cache';
// 04.19.2026 13:35 Score Consolidation — haversineM removed; imported from canonical geo-math.ts
import { haversineMeters as haversineM } from '$lib/intel/scoring/geo-math';

// ─────────────────────────────────────────────────────────────────────────────
// BR-N (April 11, 2026): Bbox-keyed in-memory cache.
//
// WHY: the shared intelCache keys by lat/lng rounded to 4 decimals (~11m), but
// school proximity only changes on the scale of ~100m. Coarser bbox keying
// dramatically increases hit rate across nearby lookups within the same
// warm Netlify invocation. Coexists with intelCache L1/L2 (this hits first).
//
// Also provides a visible getCacheStats() surface for the /api/health route
// so we can confirm TTL.SCHOOLS is actually being consulted in production
// — previously TTL.LONG was undefined, silently disabling all caching.
// ─────────────────────────────────────────────────────────────────────────────
const SCHOOLS_TTL_MS = TTL.SCHOOLS;
const BBOX_PRECISION = 3; // ~110m lat/lng bucket
type BboxCacheEntry = { data: SchoolProximityData; expiresAt: number };
const _bboxCache = new Map<string, BboxCacheEntry>();
let _bboxHits = 0;
let _bboxMisses = 0;

function bboxKey(lat: number, lng: number): string {
	return `${lat.toFixed(BBOX_PRECISION)},${lng.toFixed(BBOX_PRECISION)}`;
}

/**
 * BR-N: Cache stats for observability. Exposed via /api/health.
 * Returns L1 bbox cache size, hit/miss counts, and the TTL in hours.
 */
export function getCacheStats(): {
	entries: number;
	hits: number;
	misses: number;
	hitRate: number;
	ttlHours: number;
} {
	const total = _bboxHits + _bboxMisses;
	return {
		entries: _bboxCache.size,
		hits: _bboxHits,
		misses: _bboxMisses,
		hitRate: total > 0 ? _bboxHits / total : 0,
		ttlHours: Math.round(SCHOOLS_TTL_MS / 3_600_000),
	};
}

export interface NearbySchool {
	name: string;
	address: string;
	gradeLevel: string;        // 'Elementary', 'Middle', 'High', 'K-8', etc.
	distanceMeters: number;
	lat: number;
	lng: number;
}

export interface SchoolProximityData {
	schools: NearbySchool[];
	totalCount: number;
	within200ft: number;        // Critical for SLA Rule 17
	within500ft: number;
	within1000ft: number;
	closestSchool: NearbySchool | null;
	slaBlocked: boolean;        // True if any school within 200 ft (~61 m)
	familyDensityScore: number; // 0-100: how family-dense the area is (school count signal)
	source: 'nyc-schools';
	fetchedAt: string;
}

// NYC Open Data — 2019-2020 School Locations (most recent comprehensive set)
const SCHOOLS_BASE = 'https://data.cityofnewyork.us/resource/wg9x-4ke6.json';

// 04.19.2026 13:35 Score Consolidation — haversineM removed. Now aliased from haversineMeters in geo-math.ts above.

/**
 * Fetch school locations near a given coordinate.
 * Default radius: 305 meters (~1000 ft) to capture the SLA 200-ft zone
 * plus a buffer for scoring family-density.
 */
export async function fetchSchoolProximity(
	lat: number,
	lng: number,
	radiusMeters: number = 305
): Promise<SchoolProximityData | null> {
	// BR-N: Bbox in-memory cache hit path (fastest — sub-ms).
	const bKey = bboxKey(lat, lng);
	const bEntry = _bboxCache.get(bKey);
	if (bEntry && bEntry.expiresAt > Date.now()) {
		_bboxHits++;
		return bEntry.data;
	}
	_bboxMisses++;

	const cacheKey = IntelCache.locationKey(lat, lng, 'nyc-schools');
	const cached = await intelCache.getAsync<SchoolProximityData>(cacheKey);
	if (cached?.fresh) {
		// Warm the bbox cache from the L1/L2 hit so subsequent nearby lookups
		// short-circuit before hitting intelCache again.
		_bboxCache.set(bKey, { data: cached.data, expiresAt: Date.now() + SCHOOLS_TTL_MS });
		return cached.data;
	}

	try {
		// Socrata within_circle geospatial query
		const url = `${SCHOOLS_BASE}?$where=within_circle(the_geom,${lat},${lng},${radiusMeters})&$select=location_name,primary_address_line_1,grades_text,latitude,longitude&$limit=100`;

		const { socrataFetch } = await import('./socrata-fetch');
		const raw = await socrataFetch<Array<Record<string, string>>>(url, 'schools');
		if (!raw || !Array.isArray(raw)) return cached?.data || null;

		const schools: NearbySchool[] = raw
			.filter(r => r.latitude && r.longitude)
			.map(r => {
				const sLat = parseFloat(r.latitude);
				const sLng = parseFloat(r.longitude);
				return {
					name: r.location_name || 'Unknown School',
					address: r.primary_address_line_1 || '',
					gradeLevel: r.grades_text || 'Unknown',
					distanceMeters: Math.round(haversineM(lat, lng, sLat, sLng)),
					lat: sLat,
					lng: sLng,
				};
			})
			.sort((a, b) => a.distanceMeters - b.distanceMeters);

		const within200ft = schools.filter(s => s.distanceMeters <= 61).length;  // 200 ft ≈ 61 m
		const within500ft = schools.filter(s => s.distanceMeters <= 152).length; // 500 ft ≈ 152 m
		const within1000ft = schools.length; // All within our 305m radius

		// Family density: 0-100 score based on school count
		// 0 schools = 0, 1 = 20, 2 = 40, 3+ = 60-100
		const familyDensityScore = Math.min(100, Math.round(within1000ft * 20));

		const result: SchoolProximityData = {
			schools,
			totalCount: schools.length,
			within200ft,
			within500ft,
			within1000ft,
			closestSchool: schools[0] || null,
			slaBlocked: within200ft > 0,
			familyDensityScore,
			source: 'nyc-schools',
			fetchedAt: new Date().toISOString(),
		};

		// BR-N: was `TTL.LONG` (undefined) — silently disabled caching for months.
		// Now uses TTL.SCHOOLS (7d, env-overridable via CACHE_TTL_SCHOOLS).
		intelCache.set(cacheKey, result, SCHOOLS_TTL_MS, 'schools');
		_bboxCache.set(bKey, { data: result, expiresAt: Date.now() + SCHOOLS_TTL_MS });
		return result;
	} catch (e) {
		console.error('[Schools] Fetch error:', e);
		return cached?.data || null;
	}
}
