/**
 * NYC Crime Data client (NYPD Complaint Data).
 *
 * Fetches crime/complaint statistics from NYC Open Data (Socrata API).
 * Free, no API key required.
 * Dataset: https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Current-Year-To-Date-/5uac-w243
 *
 * Provides:
 * - Crime density near a location
 * - Crime type breakdown (violent vs property vs other)
 * - Trend indicators (recent vs historical)
 * - Safety score for location intelligence
 */

import { IntelCache, intelCache, TTL } from './cache';
import { getBoroughSafetyFloor as _getBoroughSafetyFloor } from '$lib/constants/geography';

export interface CrimeIncident {
	type: string;          // FELONY, MISDEMEANOR, VIOLATION
	description: string;   // e.g., "PETIT LARCENY"
	category: 'violent' | 'property' | 'other';
	date: string;
	lat: number;
	lng: number;
}

export interface CrimeData {
	incidents: CrimeIncident[];
	totalCount: number;
	violentCount: number;
	propertyCount: number;
	otherCount: number;
	crimeScore: number;          // 0-100 (higher = safer)
	densityPerSqMi: number;     // incidents per square mile
	topTypes: { type: string; count: number }[];
	source: 'nypd-complaints';
	fetchedAt: string;
}

// NYPD Complaint Data — current year
const NYPD_BASE = 'https://data.cityofnewyork.us/resource/5uac-w243.json';

// Violent crime offense descriptions
const VIOLENT_OFFENSES = new Set([
	'MURDER & NON-NEGL. MANSLAUGHTER',
	'RAPE',
	'ROBBERY',
	'FELONY ASSAULT',
	'KIDNAPPING & RELATED OFFENSES',
	'HOMICIDE-NEGLIGENT-VEHICLE',
	'ASSAULT 3 & RELATED OFFENSES',
	'SEX CRIMES'
]);

// Property crime offense descriptions
const PROPERTY_OFFENSES = new Set([
	'BURGLARY',
	'GRAND LARCENY',
	'PETIT LARCENY',
	'GRAND LARCENY OF MOTOR VEHICLE',
	'THEFT-FRAUD',
	'CRIMINAL MISCHIEF & RELATED OF',
	'ARSON',
	'STOLEN PROPERTY',
	'POSSESSION OF STOLEN PROPERTY'
]);

/**
 * Fetch crime data near a location from NYPD complaint records.
 */
export async function fetchCrimeData(
	lat: number,
	lng: number,
	radiusMeters: number = 300
): Promise<CrimeData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'crime');
	const cached = await intelCache.getAsync<CrimeData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
		const dateStr = sixMonthsAgo.toISOString().split('T')[0];

		// SoQL geo query
		const url = `${NYPD_BASE}?$where=within_circle(lat_lon,${lat},${lng},${radiusMeters}) AND cmplnt_fr_dt > '${dateStr}T00:00:00'&$select=law_cat_cd,ofns_desc,cmplnt_fr_dt,latitude,longitude&$order=cmplnt_fr_dt DESC&$limit=500`;

		const { socrataFetch } = await import('./socrata-fetch');
		const raw = await socrataFetch<Array<Record<string, string>>>(url, 'Crime');
		if (!raw || !Array.isArray(raw)) return cached?.data || null;

		let violentCount = 0;
		let propertyCount = 0;
		let otherCount = 0;
		const typeCounts: Record<string, number> = {};

		// Guard: empty results often mean the API silently dropped the query
		// (not that the area is actually crime-free). Use borough floor instead
		// of computing a synthetic 75 from zero-density.
		if (!raw || raw.length === 0) {
			const syntheticScore = getBoroughSafetyFloor(lat, lng);
			const result: CrimeData = {
				incidents: [],
				totalCount: 0,
				violentCount: 0,
				propertyCount: 0,
				otherCount: 0,
				crimeScore: syntheticScore,
				densityPerSqMi: 0,
				topTypes: [],
				source: 'nypd-complaints',
				fetchedAt: new Date().toISOString()
			};
			intelCache.set(cacheKey, result, TTL.CRIME);
			return result;
		}

		const incidents: CrimeIncident[] = raw.map(r => {
			const desc = r.ofns_desc || 'UNKNOWN';
			let category: 'violent' | 'property' | 'other' = 'other';

			if (VIOLENT_OFFENSES.has(desc)) {
				category = 'violent';
				violentCount++;
			} else if (PROPERTY_OFFENSES.has(desc)) {
				category = 'property';
				propertyCount++;
			} else {
				otherCount++;
			}

			typeCounts[desc] = (typeCounts[desc] || 0) + 1;

			return {
				type: r.law_cat_cd || 'UNKNOWN',
				description: desc,
				category,
				date: r.cmplnt_fr_dt?.split('T')[0] || '',
				lat: parseFloat(r.latitude) || lat,
				lng: parseFloat(r.longitude) || lng
			};
		});

		// Top crime types
		const topTypes = Object.entries(typeCounts)
			.map(([type, count]) => ({ type, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);

		// Crime density: incidents per square mile
		// radius in meters → area in sq mi (1 mi = 1609.34 m)
		const radiusMi = radiusMeters / 1609.34;
		const areaSqMi = Math.PI * radiusMi * radiusMi;
		const densityPerSqMi = areaSqMi > 0 ? Math.round(incidents.length / areaSqMi) : 0;

		// Annualize the 6-month count for scoring
		const annualizedCount = incidents.length * 2;

		// Crime score: 0-100 (higher = safer)
		// Based on annualized crime density per sq mi
		// NYC average: ~2000-4000/sq mi in Manhattan, ~500-1500 in outer boroughs
		const crimeScore = computeCrimeScore(annualizedCount, areaSqMi, violentCount);

		const result: CrimeData = {
			incidents,
			totalCount: incidents.length,
			violentCount,
			propertyCount,
			otherCount,
			crimeScore,
			densityPerSqMi,
			topTypes,
			source: 'nypd-complaints',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.CRIME);
		return result;
	} catch (e) {
		console.error('[Crime] Fetch error:', e);
		if (cached?.data) return cached.data;
		// Return a synthetic borough-floor result rather than null → 50 default
		return {
			incidents: [],
			totalCount: 0,
			violentCount: 0,
			propertyCount: 0,
			otherCount: 0,
			crimeScore: getBoroughSafetyFloor(lat, lng),
			densityPerSqMi: 0,
			topTypes: [],
			source: 'nypd-complaints',
			fetchedAt: new Date().toISOString()
		};
	}
}

/**
 * Compute a safety score from crime data.
 * 100 = very safe, 0 = very high crime.
 */
/**
 * Borough safety floor — delegates to canonical BOROUGH_BOUNDS in geography.ts.
 * Values: Manhattan 43, Bronx 29, Brooklyn 47, Queens 53, Staten Island 57.
 * Calibrated: NYPD 2023 stats, 300m query radius (tight radius avoids transit hub inflation).
 * Re-exported for backward compatibility with existing callers.
 */
export function getBoroughSafetyFloor(lat: number, lng: number): number {
	return _getBoroughSafetyFloor(lat, lng);
}

function computeCrimeScore(
	annualizedCount: number,
	areaSqMi: number,
	violentCount: number
): number {
	if (areaSqMi === 0) return 50;

	const density = annualizedCount / areaSqMi;
	const violentRatio = annualizedCount > 0 ? violentCount / (annualizedCount / 2) : 0;

	// Base score from density — calibrated for 300m search radius (≈0.11 sq mi search area)
	// Reduced from 500m: in dense Midtown Manhattan, 500m sweeps transit hubs (Penn Station, GCT)
	// that inflate crime density for adjacent premium blocks (e.g. Hudson Yards, Hudson Yards).
	// 300m keeps the query within the immediate block vicinity.
	// NYC real distribution: outer borough residential = 0-200/sq mi, typical commercial = 200-600/sq mi,
	// elevated (busy Manhattan/Bronx) = 600-1500/sq mi, high crime = 1500+/sq mi
	// Target: avg 55-65, stddev ≥15 across all NYC block groups (was avg=91, stddev=8 — ceiling effect)
	let score: number;
	if (density < 200) score = 60 + Math.round((200 - density) / 200 * 15);    // 60–75: genuinely low crime
	else if (density < 600) score = 45 + Math.round((600 - density) / 400 * 15); // 45–60: typical NYC
	else if (density < 1500) score = 28 + Math.round((1500 - density) / 900 * 17); // 28–45: elevated
	else score = Math.max(10, 28 - Math.round((density - 1500) / 1500 * 18));    // 10–28: high crime

	// Penalize for high violent crime ratio
	if (violentRatio > 0.3) score -= 15;
	else if (violentRatio > 0.15) score -= 8;

	return Math.max(0, Math.min(100, score));
}
