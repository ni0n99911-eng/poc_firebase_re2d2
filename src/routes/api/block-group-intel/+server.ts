/**
 * Block Group Intelligence API endpoint.
 *
 * GET /api/block-group-intel?lat=40.7128&lng=-74.0060
 *
 * Returns pre-computed scores + vision for the census block group
 * containing the given coordinates. Target: < 2 second response.
 *
 * Response:
 * {
 *   geoid: "360610001001",
 *   borough: "Manhattan",
 *   scores: { location_iq: 78, six_index: {...}, ... },
 *   vision: { narrative: "...", structured: {...}, ... },
 *   serving_mode: "stored" | "stale_refresh" | "cold"
 * }
 */

import type { RequestHandler } from '@sveltejs/kit';
import { getBlockGroupIntel, latLngToGeoid, geoidToBorough, getBlockGroupScores, getBlockGroupVision } from '$lib/intel/block-group';
import { normalizeBusinessType } from '$lib/intel/registry/business-type-registry';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
import { classifyStreetType } from '$lib/intel/street-side';

// ── Street-type bonus applied to location_iq at query time ──
// Block-group scores are averages over an area; this adds address-level
// precision for being on a high-traffic corridor vs a cross street.
const STREET_TYPE_BONUS: Record<string, number> = {
	diagonal:  6,  // Broadway, etc. — highest-traffic corridors
	avenue:    4,  // Named avenues (Amsterdam, Columbus, 5th, etc.)
	boulevard: 3,  // Wider commercial roads
	street:    0,  // Cross streets between avenues — baseline
	unknown:   0,
};

export const GET: RequestHandler = async ({ url, request }) => {
	const limited = rateLimit(request, RATE_LIMITS.intel);
	if (limited) return limited;

	const lat = parseFloat(url.searchParams.get('lat') || '');
	const lng = parseFloat(url.searchParams.get('lng') || '');
	const geoidParam = url.searchParams.get('geoid'); // Direct geoid lookup
	let conceptType = url.searchParams.get('concept') || undefined; // Concept-specific scoring
	if (conceptType) {
		conceptType = normalizeBusinessType(conceptType);
	}
	const address = url.searchParams.get('address') || undefined; // Address for street-type bonus

	if (!geoidParam && (isNaN(lat) || isNaN(lng))) {
		return new Response(JSON.stringify({
			error: 'Missing lat/lng or geoid parameter',
			usage: '/api/block-group-intel?lat=40.7128&lng=-74.0060'
		}), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const startMs = Date.now();
		let result;

		if (geoidParam) {
			// Direct geoid lookup — skip FIPS geocoding
			const [scores, vision] = await Promise.all([
				getBlockGroupScores(geoidParam, conceptType),
				getBlockGroupVision(geoidParam),
			]);
			result = {
				geoid: geoidParam,
				borough: geoidToBorough(geoidParam),
				scores,
				vision,
				serving_mode: scores ? 'stored' : 'cold',
			};
		} else {
			result = await getBlockGroupIntel(lat, lng, conceptType);
		}

		const durationMs = Date.now() - startMs;

		// ── Apply street-type bonus when address is provided ──
		// This adds address-level precision on top of block-group averages.
		// Avenues and diagonals (Broadway) get a bonus; cross streets do not.
		if (result?.scores && address) {
			try {
				const { type: streetType } = classifyStreetType(address);
				const bonus = STREET_TYPE_BONUS[streetType] ?? 0;
				if (bonus > 0) {
					// Apply to location_iq (legacy) and location_iq_v2 (V4 three-score)
					if (typeof result.scores.location_iq === 'number') {
						result.scores.location_iq = Math.min(97, result.scores.location_iq + bonus);
					}
					if (typeof result.scores.location_iq_v2 === 'number') {
						result.scores.location_iq_v2 = Math.min(97, result.scores.location_iq_v2 + bonus);
					}
					console.log(`[BlockGroupIntel] Street-type bonus: ${address} → ${streetType} → +${bonus} pts`);
				}
			} catch (err) {
				// Non-critical — log and continue
				console.warn('[BlockGroupIntel] Street-type classification failed:', err instanceof Error ? err.message : err);
			}
		}

		if (!result) {
			return new Response(JSON.stringify({
				error: 'Could not resolve block group for these coordinates',
				hint: 'The FCC Census Geocoder may be unavailable, or these coordinates are outside NYC'
			}), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Log the serve event
		try {
			await db.execute(sql`
				INSERT INTO score_events (event_type, geoid, serving_mode, duration_ms, lat, lng)
				VALUES ('block_group_serve', ${result.geoid}, ${result.serving_mode}, ${durationMs}, ${isNaN(lat) ? null : lat}, ${isNaN(lng) ? null : lng})
			`);
		} catch { /* non-critical */ }

		return new Response(JSON.stringify({
			...result,
			_meta: {
				duration_ms: durationMs,
				cached: result.serving_mode === 'stored',
			}
		}), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'private, max-age=600', // 10 min cache — scores don't change often
			}
		});
	} catch (e) {
		console.error('[BlockGroupIntel] Error:', e);
		return new Response(JSON.stringify({
			error: 'Internal error',
			message: e instanceof Error ? e.message : 'Unknown error'
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
