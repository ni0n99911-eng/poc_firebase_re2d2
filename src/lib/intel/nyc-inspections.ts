/**
 * NYC DOHMH Restaurant Inspections client.
 *
 * Pulls restaurant inspection grades from NYC Open Data (Socrata API).
 * Free, no API key required (throttled at ~1000 req/hr without app token).
 * Dataset: https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j
 *
 * Provides ground-truth competitor data:
 * - Active restaurants/cafes near a location
 * - Inspection grades (proxy for quality)
 * - Cuisine types (competitive landscape)
 * - Violation history (neighborhood health trends)
 */

import { IntelCache, intelCache, TTL } from './cache';

export interface InspectionResult {
	name: string;
	address: string;
	cuisineType: string;
	grade: string;          // A, B, C, Z (pending), P (grade pending)
	score: number;          // lower = better (violation points)
	inspectionDate: string;
	lat: number;
	lng: number;
	zipcode: string;
}

export interface InspectionData {
	restaurants: InspectionResult[];
	totalNearby: number;
	gradeDistribution: { A: number; B: number; C: number; other: number };
	cuisineBreakdown: Record<string, number>; // cuisine → count
	avgScore: number;        // avg violation score (lower = cleaner area)
	source: 'nyc-dohmh';
	fetchedAt: string;
}

const SOCRATA_BASE = 'https://data.cityofnewyork.us/resource/43nn-pn8j.json';

/**
 * Fetch DOHMH inspection data near a location.
 * Uses Socrata's $where clause with within_circle for geo queries.
 */
export async function fetchInspections(lat: number,
	lng: number,
	radiusMeters: number = 500, signal?: AbortSignal): Promise<InspectionData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'inspections');
	const cached = await intelCache.getAsync<InspectionData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		// Socrata SoQL query: get recent inspections near location
		const url = `${SOCRATA_BASE}?$where=within_circle(location,${lat},${lng},${radiusMeters}) AND grade IS NOT NULL AND inspection_date > '${twoYearsAgo()}'&$select=dba,building,street,cuisine_description,grade,score,inspection_date,latitude,longitude,zipcode,camis&$order=inspection_date DESC&$limit=200`;

		const { socrataFetch } = await import('./socrata-fetch');
		const raw = await socrataFetch<Array<Record<string, string>>>(url, 'Inspections');
		if (!raw || !Array.isArray(raw)) return cached?.data || null;

		// Deduplicate by CAMIS (unique restaurant ID) — keep most recent inspection
		const seen = new Map<string, any>();
		for (const r of raw) {
			const camis = r.camis;
			if (!seen.has(camis) || r.inspection_date > seen.get(camis).inspection_date) {
				seen.set(camis, r);
			}
		}

		const restaurants: InspectionResult[] = [];
		const gradeDistribution = { A: 0, B: 0, C: 0, other: 0 };
		const cuisineBreakdown: Record<string, number> = {};
		let totalScore = 0;
		let scoreCount = 0;

		for (const [, r] of seen) {
			const grade = r.grade || 'N/A';
			const score = parseInt(r.score) || 0;

			restaurants.push({
				name: cleanName(r.dba || 'Unknown'),
				address: `${r.building || ''} ${r.street || ''}`.trim(),
				cuisineType: r.cuisine_description || 'Unknown',
				grade,
				score,
				inspectionDate: r.inspection_date?.split('T')[0] || '',
				lat: parseFloat(r.latitude) || lat,
				lng: parseFloat(r.longitude) || lng,
				zipcode: r.zipcode || ''
			});

			// Grade distribution
			if (grade === 'A') gradeDistribution.A++;
			else if (grade === 'B') gradeDistribution.B++;
			else if (grade === 'C') gradeDistribution.C++;
			else gradeDistribution.other++;

			// Cuisine breakdown
			const cuisine = r.cuisine_description || 'Other';
			cuisineBreakdown[cuisine] = (cuisineBreakdown[cuisine] || 0) + 1;

			if (score > 0) {
				totalScore += score;
				scoreCount++;
			}
		}

		const result: InspectionData = {
			restaurants,
			totalNearby: restaurants.length,
			gradeDistribution,
			cuisineBreakdown,
			avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
			source: 'nyc-dohmh',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.INSPECTIONS);
		return result;
	} catch (e) {
		console.error('[DOHMH] Fetch error:', e);
		return cached?.data || null;
	}
}

/**
 * Get cuisine diversity score (0-100) from inspection data.
 * Higher = more diverse competitive landscape.
 */
export function cuisineDiversityScore(data: InspectionData): number {
	const types = Object.keys(data.cuisineBreakdown).length;
	// Scale: 1-5 types = 30-50, 5-15 = 50-80, 15+ = 80-100
	if (types >= 15) return Math.min(100, 80 + types);
	if (types >= 5) return 50 + Math.round((types - 5) * 3);
	return 30 + types * 4;
}

/**
 * Get health/quality score (0-100) from inspection grades.
 * Higher = cleaner/healthier neighborhood.
 */
export function areaHealthScore(data: InspectionData): number {
	const total = data.gradeDistribution.A + data.gradeDistribution.B +
		data.gradeDistribution.C + data.gradeDistribution.other;
	if (total === 0) return 50;

	const aPercent = data.gradeDistribution.A / total;
	const bPercent = data.gradeDistribution.B / total;

	// Weight: A grades strongly positive, B slightly positive
	return Math.min(100, Math.round(aPercent * 90 + bPercent * 60 + (1 - aPercent - bPercent) * 20));
}

function twoYearsAgo(): string {
	const d = new Date();
	d.setFullYear(d.getFullYear() - 2);
	return d.toISOString().split('T')[0];
}

function cleanName(name: string): string {
	// DOHMH stores names in ALL CAPS — title-case them
	return name
		.toLowerCase()
		.replace(/\b\w/g, c => c.toUpperCase())
		.replace(/['']S\b/g, "'s"); // Fix possessives
}
