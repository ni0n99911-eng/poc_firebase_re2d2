/**
 * Location Comparison API endpoint.
 *
 * POST /api/compare
 * Body: { locations: [{ lat, lng, address? }], businessType: "cafe", version?: 2 }
 *
 * Version 1 (default): Fetches live intel for each location (slow, 20 API calls per location)
 * Version 2: Uses pre-computed V5 scores from block_group_scores (fast, no live APIs)
 *
 * Returns a ranked comparison of 2-5 locations with:
 * - Full IQ scores for each location (V5 8-dim in v2)
 * - Relative strengths and weaknesses
 * - Dimension-level winners
 * - Gap decomposition and anomaly detection (v2 only)
 * - Halo effect scores per concept (v2 only)
 * - Overall recommendation
 */

import type { RequestHandler } from '@sveltejs/kit';
import { fetchLocationIntel } from '$lib/intel';
import { compareLocations } from '$lib/intel/compare';
import { compareLocationsV2 } from '$lib/intel/compare-v2';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';
// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
import { normalizeBusinessType } from '$lib/intel/registry/business-type-registry';

interface CompareRequest {
	locations: { lat: number; lng: number; address?: string }[];
	businessType?: string;
	version?: number;
}

export const POST: RequestHandler = async ({ request }) => {
	const limited = rateLimit(request, RATE_LIMITS.intel);
	if (limited) return limited;

	try {
		const body: CompareRequest = await request.json();

		if (!body.locations || !Array.isArray(body.locations)) {
			return new Response(JSON.stringify({
				error: 'Missing locations array',
				usage: 'POST /api/compare with { locations: [{ lat, lng }], businessType: "cafe", version: 2 }'
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		if (body.locations.length < 2 || body.locations.length > 5) {
			return new Response(JSON.stringify({
				error: 'Provide 2-5 locations to compare'
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		// Validate coordinates
		for (const loc of body.locations) {
			if (isNaN(loc.lat) || isNaN(loc.lng) || loc.lat < -90 || loc.lat > 90 || loc.lng < -180 || loc.lng > 180) {
				return new Response(JSON.stringify({
					error: `Invalid coordinates: lat=${loc.lat}, lng=${loc.lng}`
				}), { status: 400, headers: { 'Content-Type': 'application/json' } });
			}
		}

		// BUG-ARCH-01: normalize at API boundary so downstream lookups match
		// block_group_scores keys (e.g. 'cafe' -> 'specialty_coffee',
		// 'restaurant' -> 'full_service_restaurant').
		const businessType = normalizeBusinessType(body.businessType || 'cafe');
		const version = body.version || 1;

		if (version === 2) {
			// V2: Pre-computed scores — fast, uses V5 8-dim architecture
			const comparison = await compareLocationsV2(body.locations, businessType);

			return new Response(JSON.stringify({
				version: 2,
				...comparison,
			}), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'public, max-age=3600',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		// V1: Live intel fetch (legacy — slower but works without pre-computed data)
		const reports = await Promise.all(
			body.locations.map(loc =>
				fetchLocationIntel(loc.lat, loc.lng, businessType, loc.address)
			)
		);

		const comparison = compareLocations(reports, businessType);

		return new Response(JSON.stringify({
			version: 1,
			...comparison,
		}), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=3600',
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch (e: unknown) {
		console.error('[Compare] Endpoint error:', e);
		return new Response(JSON.stringify({
			error: 'Internal error comparing locations',
			message: e instanceof Error ? e.message : 'Unknown error'
		}), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
};
