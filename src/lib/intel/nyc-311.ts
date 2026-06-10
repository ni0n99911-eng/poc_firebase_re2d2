/**
 * NYC 311 Complaints client.
 *
 * Fetches 311 service request data from NYC Open Data (Socrata API).
 * Free, no API key required.
 * Dataset: https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9
 *
 * Provides:
 * - Complaint density near a location
 * - Complaint type breakdown (noise, sanitation, etc.)
 * - Quality of life score for location intelligence
 */

import { IntelCache, intelCache, TTL } from './cache';
import { getBoroughQualityFloor as _getBoroughQualityFloor } from '$lib/constants/geography';

export interface Complaint311 {
	type: string;
	descriptor: string;
	date: string;
	status: string;
	agency: string;
}

export interface NYC311Data {
	complaints: Complaint311[];
	totalCount: number;
	topTypes: { type: string; count: number }[];
	noiseCount: number;
	sanitationCount: number;
	safetyCount: number;
	qualityScore: number;         // 0-100 (higher = better quality of life)
	complaintDensity: number;     // per sq mile
	source: 'nyc-311';
	fetchedAt: string;
}

// 311 Service Requests
const NYC311_BASE = 'https://data.cityofnewyork.us/resource/erm2-nwe9.json';

// Categorize complaint types
const NOISE_TYPES = new Set([
	'Noise - Residential', 'Noise - Commercial', 'Noise - Street/Sidewalk',
	'Noise - Vehicle', 'Noise - Helicopter', 'Noise - Park', 'Noise'
]);

const SANITATION_TYPES = new Set([
	'UNSANITARY CONDITION', 'Dirty Conditions', 'Sanitation Condition',
	'Missed Collection (All Materials)', 'Overflowing Litter Baskets',
	'Derelict Vehicle', 'Rodent', 'Standing Water'
]);

const SAFETY_TYPES = new Set([
	'Blocked Driveway', 'Illegal Parking', 'Street Light Condition',
	'Traffic Signal Condition', 'Damaged Tree', 'Sidewalk Condition',
	'Street Condition', 'Fire Safety Director - Loss of Certification'
]);

/**
 * Fetch 311 complaint data near a location.
 */
export async function fetch311Complaints(lat: number,
	lng: number,
	radiusMeters: number = 500, signal?: AbortSignal): Promise<NYC311Data | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'nyc-311');
	const cached = await intelCache.getAsync<NYC311Data>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		const threeMonthsAgo = new Date();
		threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
		const dateStr = threeMonthsAgo.toISOString().split('T')[0];

		const url = `${NYC311_BASE}?$where=within_circle(location,${lat},${lng},${radiusMeters}) AND created_date > '${dateStr}T00:00:00'&$select=complaint_type,descriptor,created_date,status,agency&$order=created_date DESC&$limit=500`;

		const { socrataFetch } = await import('./socrata-fetch');
		const raw = await socrataFetch<Array<Record<string, string>>>(url, '311');
		if (!raw || !Array.isArray(raw)) return cached?.data || null;

		let noiseCount = 0;
		let sanitationCount = 0;
		let safetyCount = 0;
		const typeCounts: Record<string, number> = {};

		const complaints: Complaint311[] = raw.map((r: Record<string, string>) => {
			const type = r.complaint_type || 'Other';
			typeCounts[type] = (typeCounts[type] || 0) + 1;

			if (NOISE_TYPES.has(type)) noiseCount++;
			else if (SANITATION_TYPES.has(type)) sanitationCount++;
			else if (SAFETY_TYPES.has(type)) safetyCount++;

			return {
				type,
				descriptor: r.descriptor || '',
				date: r.created_date?.split('T')[0] || '',
				status: r.status || '',
				agency: r.agency || ''
			};
		});

		const topTypes = Object.entries(typeCounts)
			.map(([type, count]) => ({ type, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 8);

		// Density
		const radiusMi = radiusMeters / 1609.34;
		const areaSqMi = Math.PI * radiusMi * radiusMi;
		const complaintDensity = areaSqMi > 0 ? Math.round(complaints.length / areaSqMi) : 0;

		// Annualize: 3 months → 12 months
		const annualizedCount = complaints.length * 4;
		const qualityScore = computeQualityScore(annualizedCount, areaSqMi, noiseCount, sanitationCount, safetyCount);

		const result: NYC311Data = {
			complaints,
			totalCount: complaints.length,
			topTypes,
			noiseCount,
			sanitationCount,
			safetyCount,
			qualityScore,
			complaintDensity,
			source: 'nyc-311',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.COMPLAINTS);
		return result;
	} catch (e) {
		console.error('[311] Fetch error:', e);
		if (cached?.data) return cached.data;
		return {
			complaints: [],
			totalCount: 0,
			topTypes: [],
			noiseCount: 0,
			sanitationCount: 0,
			safetyCount: 0,
			qualityScore: getBoroughQualityFloor(lat, lng),
			complaintDensity: 0,
			source: 'nyc-311',
			fetchedAt: new Date().toISOString()
		};
	}
}

/**
 * Borough 311 quality floor — delegates to canonical BOROUGH_BOUNDS in geography.ts.
 * Values: Manhattan 55, Bronx 52, Brooklyn 60, Queens 63, Staten Island 68.
 * Re-exported for backward compatibility with existing callers.
 */
export function getBoroughQualityFloor(lat: number, lng: number): number {
	return _getBoroughQualityFloor(lat, lng);
}

/**
 * Quality of life score (0-100, higher = better).
 * Low complaints = high quality.
 */
function computeQualityScore(
	annualizedCount: number,
	areaSqMi: number,
	noiseCount: number,
	sanitationCount: number,
	safetyCount: number
): number {
	if (areaSqMi === 0) return 50;

	const density = annualizedCount / areaSqMi;

	// Base score from complaint density — calibrated for 500m radius (≈0.30 sq mi area)
	// NYC calibration: quiet residential = 0-100 complaints/6mo (density 0-660/sq mi/yr),
	// typical commercial = 100-300/6mo (density 660-1980), noisy = 300-500/6mo (density 1980-3300)
	// Target: avg 55-65, stddev ≥12 (was ceiling-inflated like crime — 80+ for most areas)
	let score: number;
	if (density < 700)  score = 60 + Math.round((700  - density) / 700  * 15);  // 60–75: very quiet
	else if (density < 2000) score = 45 + Math.round((2000 - density) / 1300 * 15); // 45–60: typical
	else if (density < 4000) score = 28 + Math.round((4000 - density) / 2000 * 17); // 28–45: noisy
	else score = Math.max(10, 28 - Math.round((density - 4000) / 4000 * 18));        // 10–28: very noisy

	// Penalty for specific types (on 3-month raw counts)
	const total = noiseCount + sanitationCount + safetyCount;
	if (total > 0) {
		const noiseRatio = noiseCount / total;
		const sanitationRatio = sanitationCount / total;

		// Heavy noise = bad for retail
		if (noiseRatio > 0.4) score -= 10;
		else if (noiseRatio > 0.2) score -= 5;

		// Sanitation issues = bad signal
		if (sanitationRatio > 0.3) score -= 10;
		else if (sanitationRatio > 0.15) score -= 5;
	}

	return Math.max(0, Math.min(100, score));
}
