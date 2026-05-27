/**
 * U.S. Census Bureau API (American Community Survey) client.
 *
 * Provides real demographic data at the census tract level:
 * - Median household income
 * - Population density
 * - Age distribution
 * - Commuting patterns (daytime vs residential population)
 *
 * Free API: 500 req/day without key, unlimited with free key.
 * Docs: https://api.census.gov/data.html
 */

import { IntelCache, intelCache, TTL } from './cache';

export interface CensusData {
	medianHouseholdIncome: number;
	totalPopulation: number;
	populationDensity: number; // per sq mi
	medianAge: number;
	bachelorsPlusPercent: number; // % with bachelor's or higher
	commuterPercent: number; // % who commute by public transit
	daytimePopulationRatio: number; // daytime / residential
	tractId: string;
	source: 'census-acs';
	fetchedAt: string;
}

const ACS_BASE = 'https://api.census.gov/data/2022/acs/acs5';

// Census variables we need
const VARIABLES = [
	'B19013_001E', // Median household income
	'B01003_001E', // Total population
	'B01002_001E', // Median age
	'B15003_022E', // Bachelor's degree
	'B15003_023E', // Master's degree
	'B15003_024E', // Professional degree
	'B15003_025E', // Doctorate
	'B15003_001E', // Total education universe (25+)
	'B08301_010E', // Public transit commuters
	'B08301_001E', // Total commuters
	'B01001_001E', // Total population (for density calc)
].join(',');

/**
 * Convert lat/lng to FIPS codes using the Census geocoder.
 * Returns { state, county, tract, blockGroup }
 */
async function latLngToFIPS(lat: number, lng: number): Promise<{ state: string; county: string; tract: string } | null> {
	try {
		const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
		const { resilientFetch } = await import('./retry');
		const res = await resilientFetch(url, { timeout: 10000, label: 'Census' });

		if (!res.ok) return null;
		const data = await res.json();

		const geographies = data?.result?.geographies?.['Census Tracts']?.[0];
		if (!geographies) return null;

		return {
			state: geographies.STATE,
			county: geographies.COUNTY,
			tract: geographies.TRACT
		};
	} catch (e) {
		console.error('[Census] FIPS lookup failed:', e);
		return null;
	}
}

/**
 * Fetch ACS demographic data for a census tract.
 */
export async function fetchCensusData(lat: number, lng: number): Promise<CensusData | null> {
	// Check cache first
	const cacheKey = IntelCache.locationKey(lat, lng, 'census');
	const cached = await intelCache.getAsync<CensusData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		// Step 1: Get FIPS codes from coordinates
		const fips = await latLngToFIPS(lat, lng);
		if (!fips) {
			console.error('[Census] Could not determine census tract for', lat, lng);
			return cached?.data || null; // Return stale cache if available
		}

		// Step 2: Fetch ACS data for this tract
		const url = `${ACS_BASE}?get=${VARIABLES}&for=tract:${fips.tract}&in=state:${fips.state}%20county:${fips.county}`;
		const { resilientFetch } = await import('./retry');
		const res = await resilientFetch(url, { timeout: 15000, label: 'Census' });

		if (!res.ok) {
			console.error('[Census] ACS query failed:', res.status);
			return cached?.data || null;
		}

		const raw = await res.json();
		// Response format: [[header1, header2, ...], [value1, value2, ...]]
		if (!raw || raw.length < 2) return cached?.data || null;

		const headers = raw[0] as string[];
		const values = raw[1] as string[];
		const v = (name: string) => {
			const idx = headers.indexOf(name);
			return idx >= 0 ? parseFloat(values[idx]) || 0 : 0;
		};

		const totalPop = v('B01003_001E');
		const bachelorsPlus = v('B15003_022E') + v('B15003_023E') + v('B15003_024E') + v('B15003_025E');
		const eduUniverse = v('B15003_001E');
		const transitCommuters = v('B08301_010E');
		const totalCommuters = v('B08301_001E');

		// Approximate tract area: ~0.5 sq mi for Manhattan, ~1-2 sq mi outer boroughs
		// Use a rough estimate; proper area would need TIGER data
		const approxAreaSqMi = totalPop > 5000 ? 0.3 : totalPop > 2000 ? 0.8 : 1.5;

		const result: CensusData = {
			medianHouseholdIncome: v('B19013_001E'),
			totalPopulation: totalPop,
			populationDensity: Math.round(totalPop / approxAreaSqMi),
			medianAge: v('B01002_001E'),
			bachelorsPlusPercent: eduUniverse > 0 ? Math.round((bachelorsPlus / eduUniverse) * 100) : 0,
			commuterPercent: totalCommuters > 0 ? Math.round((transitCommuters / totalCommuters) * 100) : 0,
			daytimePopulationRatio: totalCommuters > 0 ? +(totalCommuters / totalPop).toFixed(2) : 1.0,
			tractId: `${fips.state}${fips.county}${fips.tract}`,
			source: 'census-acs',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.DEMOGRAPHICS);
		return result;
	} catch (e) {
		console.error('[Census] Fetch error:', e);
		return cached?.data || null;
	}
}
