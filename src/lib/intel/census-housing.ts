/**
 * Census ACS Housing Data — rent burden, vacancy, tenure, housing costs.
 *
 * Complements the core Census demographic integration (census.ts) with
 * real estate–specific variables that inform Location IQ:
 * - Median gross rent & rent burden (rent as % of income)
 * - Vacancy rate (housing + commercial indicators)
 * - Owner vs renter split (neighborhood stability signal)
 * - Housing unit density and structure types
 *
 * Same ACS 5-year endpoint, separate variable set to keep payloads tight.
 * Shares the Census geocoder (FIPS lookup) from census.ts.
 */

import { IntelCache, intelCache, TTL } from './cache';

export interface CensusHousingData {
	medianGrossRent: number;         // Monthly rent ($)
	medianMonthlyHousingCost: number; // For owners (mortgage + taxes + insurance)
	rentBurdenedPct: number;         // % paying >30% income on rent
	severeRentBurdenPct: number;     // % paying >50% income on rent
	vacancyRate: number;             // % vacant units
	ownerOccupiedPct: number;        // % owner-occupied
	renterOccupiedPct: number;       // % renter-occupied
	totalHousingUnits: number;
	medianRooms: number;             // Median rooms per unit
	builtBefore1950Pct: number;      // % units built before 1950
	builtAfter2010Pct: number;       // % units built 2010+
	tractId: string;
	source: 'census-housing';
	fetchedAt: string;
}

const ACS_BASE = 'https://api.census.gov/data/2022/acs/acs5';

// Housing variables
const VARIABLES = [
	'B25064_001E', // Median gross rent
	'B25105_001E', // Median monthly housing costs (owner)
	'B25070_010E', // Rent 30-34.9% of income
	'B25070_011E', // Rent 35%+ (actually covers specific brackets, we sum high ones)
	'B25070_007E', // Rent 30-34.9%
	'B25070_008E', // Rent 35-39.9%
	'B25070_009E', // Rent 40-49.9%
	'B25070_010E', // Rent 50%+ (severe burden)
	'B25070_001E', // Total renters computed
	'B25002_001E', // Total housing units
	'B25002_003E', // Vacant units
	'B25003_001E', // Total occupied units
	'B25003_002E', // Owner-occupied
	'B25003_003E', // Renter-occupied
	'B25018_001E', // Median rooms
	'B25034_010E', // Built 1940-1949
	'B25034_011E', // Built 1939 or earlier
	'B25034_001E', // Total structures (for year built calc)
	'B25034_002E', // Built 2020 or later
	'B25034_003E', // Built 2010-2019
].join(',');

/**
 * Convert lat/lng to FIPS codes (same geocoder as census.ts).
 */
async function latLngToFIPS(lat: number, lng: number): Promise<{ state: string; county: string; tract: string } | null> {
	try {
		const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
		const { resilientFetch } = await import('./retry');
		const res = await resilientFetch(url, { timeout: 10000, label: 'CensusHousing' });

		if (!res.ok) return null;
		const data = await res.json();

		const geographies = data?.result?.geographies?.['Census Tracts']?.[0];
		if (!geographies) return null;

		return {
			state: geographies.STATE,
			county: geographies.COUNTY,
			tract: geographies.TRACT
		};
	} catch {
		return null;
	}
}

export async function fetchCensusHousing(lat: number, lng: number): Promise<CensusHousingData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'census-housing');
	const cached = await intelCache.getAsync<CensusHousingData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		const fips = await latLngToFIPS(lat, lng);
		if (!fips) {
			console.error('[Census Housing] FIPS lookup failed for', lat, lng);
			return cached?.data || null;
		}

		const url = `${ACS_BASE}?get=${VARIABLES}&for=tract:${fips.tract}&in=state:${fips.state}%20county:${fips.county}`;
		const { resilientFetch } = await import('./retry');
		const res = await resilientFetch(url, { timeout: 15000, label: 'CensusHousing' });

		if (!res.ok) {
			console.error('[Census Housing] ACS query failed:', res.status);
			return cached?.data || null;
		}

		const raw = await res.json();
		if (!raw || raw.length < 2) return cached?.data || null;

		const headers = raw[0] as string[];
		const values = raw[1] as string[];
		const v = (name: string) => {
			const idx = headers.indexOf(name);
			return idx >= 0 ? parseFloat(values[idx]) || 0 : 0;
		};

		const totalUnits = v('B25002_001E');
		const vacantUnits = v('B25002_003E');
		const totalOccupied = v('B25003_001E');
		const ownerOccupied = v('B25003_002E');
		const renterOccupied = v('B25003_003E');
		const totalRentersComputed = v('B25070_001E');

		// Rent burden: 30%+ of income on rent
		const burden30_34 = v('B25070_007E');
		const burden35_39 = v('B25070_008E');
		const burden40_49 = v('B25070_009E');
		const burden50plus = v('B25070_010E');
		const totalBurdened = burden30_34 + burden35_39 + burden40_49 + burden50plus;

		// Year built distribution
		const totalStructures = v('B25034_001E');
		const pre1950 = v('B25034_010E') + v('B25034_011E');
		const post2010 = v('B25034_002E') + v('B25034_003E');

		const result: CensusHousingData = {
			medianGrossRent: v('B25064_001E'),
			medianMonthlyHousingCost: v('B25105_001E'),
			rentBurdenedPct: totalRentersComputed > 0
				? Math.round((totalBurdened / totalRentersComputed) * 100)
				: 0,
			severeRentBurdenPct: totalRentersComputed > 0
				? Math.round((burden50plus / totalRentersComputed) * 100)
				: 0,
			vacancyRate: totalUnits > 0
				? Math.round((vacantUnits / totalUnits) * 100)
				: 0,
			ownerOccupiedPct: totalOccupied > 0
				? Math.round((ownerOccupied / totalOccupied) * 100)
				: 0,
			renterOccupiedPct: totalOccupied > 0
				? Math.round((renterOccupied / totalOccupied) * 100)
				: 0,
			totalHousingUnits: totalUnits,
			medianRooms: v('B25018_001E'),
			builtBefore1950Pct: totalStructures > 0
				? Math.round((pre1950 / totalStructures) * 100)
				: 0,
			builtAfter2010Pct: totalStructures > 0
				? Math.round((post2010 / totalStructures) * 100)
				: 0,
			tractId: `${fips.state}${fips.county}${fips.tract}`,
			source: 'census-housing',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.HOUSING);
		return result;
	} catch (e) {
		console.error('[Census Housing] Fetch error:', e);
		return cached?.data || null;
	}
}
