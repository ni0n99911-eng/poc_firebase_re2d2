/**
 * Neighborhood Intelligence API
 *
 * Aggregates scoring data by geohash + business type to build
 * neighborhood-level intelligence over time.
 *
 * POST: Upsert after each scoring run (called from score pipeline)
 * GET: Retrieve neighborhood stats (surfaced in results UI)
 *
 * "12 coffee shop founders have scored this block — average score 74"
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';

/**
 * Encode lat/lng to a geohash string.
 * Precision 7 ≈ 150m × 150m blocks — good for neighborhood comparison.
 */
function encodeGeohash(lat: number, lng: number, precision: number = 7): string {
	const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
	let idx = 0;
	let bit = 0;
	let evenBit = true;
	let geohash = '';
	let minLat = -90, maxLat = 90;
	let minLng = -180, maxLng = 180;

	while (geohash.length < precision) {
		if (evenBit) {
			const midLng = (minLng + maxLng) / 2;
			if (lng >= midLng) {
				idx = idx * 2 + 1;
				minLng = midLng;
			} else {
				idx = idx * 2;
				maxLng = midLng;
			}
		} else {
			const midLat = (minLat + maxLat) / 2;
			if (lat >= midLat) {
				idx = idx * 2 + 1;
				minLat = midLat;
			} else {
				idx = idx * 2;
				maxLat = midLat;
			}
		}
		evenBit = !evenBit;
		bit++;
		if (bit === 5) {
			geohash += BASE32[idx];
			bit = 0;
			idx = 0;
		}
	}
	return geohash;
}

/**
 * POST: Upsert neighborhood intelligence after a scoring run.
 *
 * Body: {
 *   lat, lng, businessType,
 *   compositeScore, signals: { positive: string[], negative: string[] },
 *   topFactors: Record<string, number>
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { lat, lng, businessType, compositeScore, signals, topFactors } = body;

		if (!lat || !lng || !businessType || compositeScore == null) {
			return json(
				{ error: 'Missing required fields: lat, lng, businessType, compositeScore' },
				{ status: 400 }
			);
		}

		const geohash = encodeGeohash(lat, lng);
		const supabase = getServiceSupabase();

		// Check if record exists
		const { data: existing } = await supabase
			.from('location_intelligence')
			.select('*')
			.eq('geohash', geohash)
			.eq('business_type', businessType)
			.single();

		if (existing) {
			// Update running average and merge signals
			const newTotal = (existing.total_searches || 0) + 1;
			const currentAvg = existing.avg_score || compositeScore;
			const newAvg = ((currentAvg * (newTotal - 1)) + compositeScore) / newTotal;

			// Merge positive/negative signals (keep unique, most recent 50)
			const existingPositive = existing.positive_signals || [];
			const existingNegative = existing.negative_signals || [];
			const mergedPositive = [...new Set([...(signals?.positive || []), ...existingPositive])].slice(0, 50);
			const mergedNegative = [...new Set([...(signals?.negative || []), ...existingNegative])].slice(0, 50);

			// Merge top factors (running average per factor)
			const existingFactors = existing.top_factors || {};
			const mergedFactors: Record<string, { avg: number; count: number }> = {};
			for (const [key, val] of Object.entries(existingFactors)) {
				const f = val as { avg: number; count: number };
				mergedFactors[key] = { avg: f.avg, count: f.count };
			}
			for (const [key, score] of Object.entries(topFactors || {})) {
				if (mergedFactors[key]) {
					const f = mergedFactors[key];
					f.avg = ((f.avg * f.count) + (score as number)) / (f.count + 1);
					f.count++;
				} else {
					mergedFactors[key] = { avg: score as number, count: 1 };
				}
			}

			// Build score distribution buckets
			const dist = existing.score_distribution || { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
			if (compositeScore <= 25) dist['0-25']++;
			else if (compositeScore <= 50) dist['26-50']++;
			else if (compositeScore <= 75) dist['51-75']++;
			else dist['76-100']++;

			const { error } = await supabase
				.from('location_intelligence')
				.update({
					avg_score: Math.round(newAvg * 10) / 10,
					total_searches: newTotal,
					positive_signals: mergedPositive,
					negative_signals: mergedNegative,
					top_factors: mergedFactors,
					score_distribution: dist,
					last_updated: new Date().toISOString()
				})
				.eq('geohash', geohash)
				.eq('business_type', businessType);

			if (error) {
				console.error('[Neighborhood Intel] Update error:', error);
				return json({ ok: false, error: error.message });
			}

			return json({ ok: true, action: 'updated', geohash, totalSearches: newTotal, avgScore: newAvg });
		} else {
			// Insert new record
			const dist: Record<string, number> = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
			if (compositeScore <= 25) dist['0-25'] = 1;
			else if (compositeScore <= 50) dist['26-50'] = 1;
			else if (compositeScore <= 75) dist['51-75'] = 1;
			else dist['76-100'] = 1;

			const initialFactors: Record<string, { avg: number; count: number }> = {};
			for (const [key, score] of Object.entries(topFactors || {})) {
				initialFactors[key] = { avg: score as number, count: 1 };
			}

			const { error } = await supabase
				.from('location_intelligence')
				.insert({
					geohash,
					business_type: businessType,
					avg_score: compositeScore,
					total_searches: 1,
					positive_signals: signals?.positive || [],
					negative_signals: signals?.negative || [],
					top_factors: initialFactors,
					score_distribution: dist
				});

			if (error) {
				console.error('[Neighborhood Intel] Insert error:', error);
				return json({ ok: false, error: error.message });
			}

			return json({ ok: true, action: 'created', geohash, totalSearches: 1, avgScore: compositeScore });
		}
	} catch (err) {
		console.error('[Neighborhood Intel] Error:', err);
		return json({ ok: false, error: 'Internal error' }, { status: 500 });
	}
};

/**
 * GET: Retrieve neighborhood intelligence for a location.
 *
 * Query params: lat, lng, businessType
 * Also returns nearby geohash data (adjacent cells) for broader context.
 */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const lat = parseFloat(url.searchParams.get('lat') || '');
		const lng = parseFloat(url.searchParams.get('lng') || '');
		const businessType = url.searchParams.get('businessType') || '';

		if (isNaN(lat) || isNaN(lng)) {
			return json({ error: 'Missing or invalid lat/lng' }, { status: 400 });
		}

		const geohash = encodeGeohash(lat, lng);
		const prefix = geohash.substring(0, 5); // ~5km radius for nearby lookups
		const supabase = getServiceSupabase();

		// Get exact match
		const { data: exact } = await supabase
			.from('location_intelligence')
			.select('*')
			.eq('geohash', geohash)
			.eq('business_type', businessType)
			.single();

		// Get nearby matches (same geohash prefix)
		const { data: nearby } = await supabase
			.from('location_intelligence')
			.select('geohash, business_type, avg_score, total_searches')
			.like('geohash', `${prefix}%`)
			.eq('business_type', businessType)
			.order('total_searches', { ascending: false })
			.limit(20);

		// Get all business types scored in this area
		const { data: allTypes } = await supabase
			.from('location_intelligence')
			.select('business_type, avg_score, total_searches')
			.like('geohash', `${prefix}%`)
			.order('total_searches', { ascending: false })
			.limit(50);

		// Compute area-wide stats
		const areaSearches = (nearby || []).reduce((sum, r) => sum + (r.total_searches || 0), 0);
		const areaAvg = nearby && nearby.length > 0
			? nearby.reduce((sum, r) => sum + (r.avg_score || 0) * (r.total_searches || 0), 0) / Math.max(1, areaSearches)
			: null;

		// Business type breakdown for the area
		const typeBreakdown: Record<string, { avgScore: number; searches: number }> = {};
		for (const row of allTypes || []) {
			if (!typeBreakdown[row.business_type]) {
				typeBreakdown[row.business_type] = { avgScore: 0, searches: 0 };
			}
			const tb = typeBreakdown[row.business_type];
			tb.avgScore = ((tb.avgScore * tb.searches) + (row.avg_score || 0) * (row.total_searches || 0)) /
				Math.max(1, tb.searches + (row.total_searches || 0));
			tb.searches += row.total_searches || 0;
		}

		return json({
			geohash,
			exact: exact || null,
			area: {
				totalSearches: areaSearches,
				avgScore: areaAvg ? Math.round(areaAvg * 10) / 10 : null,
				nearbyLocations: (nearby || []).length,
				typeBreakdown
			},
			// Human-readable summary for the UI
			summary: exact
				? `${exact.total_searches} ${businessType.replace(/_/g, ' ')} founder${exact.total_searches === 1 ? '' : 's'} scored this block — average score ${Math.round(exact.avg_score)}`
				: areaSearches > 0
					? `${areaSearches} founder${areaSearches === 1 ? '' : 's'} have scored nearby locations`
					: null
		});
	} catch (err) {
		console.error('[Neighborhood Intel] GET error:', err);
		return json({ error: 'Internal error' }, { status: 500 });
	}
};
