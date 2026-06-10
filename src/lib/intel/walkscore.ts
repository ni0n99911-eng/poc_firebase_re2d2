import { SITE_CONFIG } from '$lib/modules';

/**
 * Walk Score API client.
 *
 * Returns walkability, transit, and bike scores for a location.
 * Free tier: 5,000 req/day with API key.
 * Docs: https://www.walkscore.com/professional/api.php
 *
 * NOTE: Walk Score requires a free API key. Without one, we use a
 * heuristic based on transit proximity + POI density from Overpass.
 */

import { IntelCache, intelCache, TTL } from './cache';
import { env } from '$env/dynamic/private';

export interface WalkScoreData {
	walkScore: number;        // 0-100
	walkDescription: string;  // "Walker's Paradise", etc.
	transitScore: number;     // 0-100
	transitDescription: string;
	bikeScore: number;        // 0-100
	bikeDescription: string;
	source: 'walkscore-api' | 'walkscore-estimate';
	fetchedAt: string;
}

const WALKSCORE_BASE = 'https://api.walkscore.com/score';

/**
 * Fetch Walk Score data for a location.
 * Falls back to heuristic estimation if no API key is configured.
 */
export async function fetchWalkScore(lat: number,
	lng: number,
	address?: string, signal?: AbortSignal): Promise<WalkScoreData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'walkscore');
	const cached = await intelCache.getAsync<WalkScoreData>(cacheKey);
	if (cached?.fresh) return cached.data;

	// ── DB-FIRST: Check block_group_intel for pre-seeded Walk Score data ──
	// Seeded via: npx tsx scripts/seed-api-data.ts --source walkscore
	// Avoids live API calls and works even when the WalkScore API is down.
	try {
		const { db } = await import('$lib/db-server');
		const { sql } = await import('drizzle-orm');
		
		const nearestRes = await db.execute(sql`SELECT * FROM nearby_block_group(${lat}, ${lng})`);
		const nearest = Array.isArray(nearestRes) ? nearestRes : (nearestRes as any).rows;
		if (nearest && nearest.length > 0) {
			const intelRes = await db.execute(sql`SELECT data FROM block_group_intel WHERE geoid = ${nearest[0].geoid} AND source = 'walkscore' LIMIT 1`);
			const intelRows = Array.isArray(intelRes) ? intelRes : (intelRes as any).rows;
			const intel = intelRows[0];
			if (intel?.data) {
				const d = intel.data as Record<string, unknown>;
				const result: WalkScoreData = {
					walkScore: (d.walkscore as number) || 0,
					walkDescription: describeScore((d.walkscore as number) || 0),
					transitScore: (d.transit_score as number) || 0,
					transitDescription: describeTransit((d.transit_score as number) || 0),
					bikeScore: (d.bike_score as number) || 0,
					bikeDescription: describeBike((d.bike_score as number) || 0),
					source: 'walkscore-api',
					fetchedAt: (d.fetched_at as string) || new Date().toISOString()
				};
				intelCache.set(cacheKey, result, TTL.WALKABILITY);
				return result;
			}
		}
	} catch (dbErr) {
		console.warn('[WalkScore-DB] Seeded lookup skipped:', dbErr);
	}
	// Falls through to live API or Overpass estimate below

	const apiKey = env.WALKSCORE_API_KEY;

	if (apiKey) {
		try {
			const params = new URLSearchParams({
				format: 'json',
				lat: lat.toString(),
				lon: lng.toString(),
				transit: '1',
				bike: '1',
				wsapikey: apiKey,
				...(address ? { address } : {})
			});

			const { resilientFetch } = await import('./retry');
			const res = await resilientFetch(`${WALKSCORE_BASE}?${params}`, { timeout: 10000,
				label: 'WalkScore', signal });

			if (!res.ok) {
				console.error('[WalkScore] API error:', res.status);
				return cached?.data || null;
			}

			const data = await res.json();

			if (data.status !== 1) {
				console.error('[WalkScore] Bad status:', data.status, data.description);
				return cached?.data || estimateWalkScore(lat, lng);
			}

			const result: WalkScoreData = {
				walkScore: data.walkscore || 0,
				walkDescription: data.description || describeScore(data.walkscore || 0),
				transitScore: data.transit?.score || 0,
				transitDescription: data.transit?.description || describeTransit(data.transit?.score || 0),
				bikeScore: data.bike?.score || 0,
				bikeDescription: data.bike?.description || describeBike(data.bike?.score || 0),
				source: 'walkscore-api',
				fetchedAt: new Date().toISOString()
			};

			intelCache.set(cacheKey, result, TTL.WALKABILITY);
			return result;
		} catch (e) {
			console.error('[WalkScore] Fetch error:', e);
			return cached?.data || estimateWalkScore(lat, lng);
		}
	}

	// No API key — use heuristic estimation
	return cached?.data || estimateWalkScore(lat, lng);
}

/**
 * Estimate walk/transit/bike scores using Overpass POI density.
 * This is a rough heuristic for when no Walk Score API key is available.
 */
async function estimateWalkScore(lat: number, lng: number): Promise<WalkScoreData | null> {
	try {
		// Count nearby amenities using Overpass
		const query = `[out:json][timeout:10];(
			node["amenity"~"cafe|restaurant|bar|bank|pharmacy|supermarket|school|hospital"](around:500,${lat},${lng});
			node["shop"~"supermarket|convenience|bakery"](around:500,${lat},${lng});
			node["railway"="station"](around:800,${lat},${lng});
			node["highway"="bus_stop"](around:300,${lat},${lng});
		);out count;`;

		const { resilientFetch } = await import('./retry');
		const res = await resilientFetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { timeout: 12000,
				label: 'WalkScore',
				headers: { 'User-Agent': SITE_CONFIG.userAgent }, signal });

		if (!res.ok) return null;
		const data = await res.json();

		const count = data?.elements?.[0]?.tags?.total || data?.elements?.length || 0;

		// Heuristic: scale POI count to walk score range
		// Manhattan typically has 50-200+ POIs in 500m, suburbs have 5-20
		const walkScore = Math.min(100, Math.round(Math.min(count, 80) * 1.25));
		const transitEstimate = Math.min(100, Math.round(walkScore * 0.85));
		const bikeEstimate = Math.min(100, Math.round(walkScore * 0.75));

		const result: WalkScoreData = {
			walkScore,
			walkDescription: describeScore(walkScore),
			transitScore: transitEstimate,
			transitDescription: describeTransit(transitEstimate),
			bikeScore: bikeEstimate,
			bikeDescription: describeBike(bikeEstimate),
			source: 'walkscore-estimate',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(IntelCache.locationKey(lat, lng, 'walkscore'), result, TTL.WALKABILITY);
		return result;
	} catch (e) {
		console.error('[WalkScore] Estimation failed:', e);
		return null;
	}
}

function describeScore(score: number): string {
	if (score >= 90) return "Walker's Paradise";
	if (score >= 70) return 'Very Walkable';
	if (score >= 50) return 'Somewhat Walkable';
	if (score >= 25) return 'Car-Dependent';
	return 'Almost All Errands Require a Car';
}

function describeTransit(score: number): string {
	if (score >= 90) return "Rider's Paradise";
	if (score >= 70) return 'Excellent Transit';
	if (score >= 50) return 'Good Transit';
	if (score >= 25) return 'Some Transit';
	return 'Minimal Transit';
}

function describeBike(score: number): string {
	if (score >= 90) return "Biker's Paradise";
	if (score >= 70) return 'Very Bikeable';
	if (score >= 50) return 'Bikeable';
	return 'Somewhat Bikeable';
}
