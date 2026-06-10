/**
 * NYC PLUTO (Primary Land Use Tax Lot Output) integration.
 *
 * The richest single dataset for real estate intelligence:
 * - Zoning district & commercial overlay
 * - Building class & land use category
 * - Floor area ratio (FAR) — built vs. max
 * - Lot dimensions & total units
 * - Year built & alteration dates
 * - Assessment values (land + total)
 * - Owner type (private, city, state, federal, mixed)
 *
 * Socrata dataset: 64uk-42ks (MapPLUTO)
 * Updated quarterly by NYC DCP.
 * Free, no auth required. X-App-Token recommended.
 */

import { IntelCache, intelCache, TTL, socrataBoxWhere } from './cache';
import { env } from '$env/dynamic/private';
// 04.19.2026 13:35 Score Consolidation — haversineMeters imported from canonical geo-math.ts
import { haversineMeters } from '$lib/intel/scoring/geo-math';

export interface PLUTOLot {
	bbl: string;             // Borough-Block-Lot (unique tax lot ID)
	address: string;
	zipCode: string;
	zoneDist1: string;       // Primary zoning (e.g., C1-9, M1-6, R8)
	zoneDist2: string;       // Secondary zoning overlay
	overlay1: string;        // Commercial overlay (e.g., C1-5, C2-5)
	landUse: string;         // 2-digit land use code
	landUseLabel: string;    // Human-readable label
	bldgClass: string;       // Building class (e.g., K1 = store, O4 = office)
	ownType: string;         // Owner type code
	numFloors: number;
	numUnits: number;        // Total units in building
	numBldgs: number;        // Buildings on lot
	lotArea: number;         // Lot area (sq ft)
	bldgArea: number;        // Total building area (sq ft)
	retailArea: number;      // Retail floor area (sq ft)
	officeArea: number;      // Office area (sq ft)
	yearBuilt: number;
	yearAlter1: number;      // Most recent alteration
	builtFAR: number;        // Built floor area ratio
	maxFAR: number;          // Maximum allowed FAR
	assessLand: number;      // Assessed land value
	assessTotal: number;     // Total assessed value
	lat: number;
	lng: number;
	distance: number;        // meters from search point
}

export interface PLUTOData {
	lots: PLUTOLot[];
	nearestLot: PLUTOLot | null;
	zoneProfile: ZoneProfile;
	buildingProfile: BuildingProfile;
	developmentPotential: number;  // 0-100 score
	source: 'pluto';
	fetchedAt: string;
}

export interface ZoneProfile {
	primaryZone: string;           // Most common zone in area
	zoneTypes: Record<string, number>;  // zone → count
	commercialOverlayCount: number;
	residentialPct: number;
	commercialPct: number;
	manufacturingPct: number;
	mixedUsePct: number;
}

export interface BuildingProfile {
	avgYearBuilt: number;
	medianFloors: number;
	avgLotSize: number;         // sq ft
	totalRetailSqFt: number;
	totalOfficeSqFt: number;
	avgAssessedValuePerSqFt: number;
	vacantLotCount: number;
	recentAlterationCount: number;  // altered in last 5 years
}

const PLUTO_ENDPOINT = 'https://data.cityofnewyork.us/resource/64uk-42ks.json';

// Land use code → human-readable label
const LAND_USE_LABELS: Record<string, string> = {
	'01': 'One & Two Family',
	'02': 'Multi-Family Walkup',
	'03': 'Multi-Family Elevator',
	'04': 'Mixed Residential & Commercial',
	'05': 'Commercial & Office',
	'06': 'Industrial & Manufacturing',
	'07': 'Transportation & Utility',
	'08': 'Public Facilities & Institutions',
	'09': 'Open Space & Recreation',
	'10': 'Parking Facilities',
	'11': 'Vacant Land'
};

/**
 * Fetch PLUTO tax lot data near a location.
 * Uses Socrata geo query (within_circle on the_geom).
 */
export async function fetchPLUTOData(lat: number,
	lng: number,
	radiusMeters: number = 300, signal?: AbortSignal): Promise<PLUTOData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'pluto');
	const cached = await intelCache.getAsync<PLUTOData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		// PLUTO has latitude/longitude scalar columns (no geometry column for within_circle)
		const bbox = socrataBoxWhere('latitude', 'longitude', lat, lng, radiusMeters);
		const query = `$where=${bbox}&$select=bbl,address,zipcode,zonedist1,landuse,bldgclass,ownername,numfloors,unitstotal,numbldgs,lotarea,bldgarea,retailarea,officearea,yearbuilt,yearalter1,builtfar,residfar,commfar,facilfar,assessland,assesstot,latitude,longitude&$limit=200`;

		const { socrataFetch } = await import('./socrata-fetch');
		const appToken = env.NYC_OPEN_DATA_TOKEN;
		const raw = await socrataFetch<Record<string, string>[]>(
			`${PLUTO_ENDPOINT}?${query}`,
			'PLUTO',
			appToken ? { timeout: 15000 } : undefined
		);
		if (!raw?.length) return cached?.data || null;

		const lots: PLUTOLot[] = raw.map(r => {
			const lotLat = parseFloat(r.latitude) || 0;
			const lotLng = parseFloat(r.longitude) || 0;
			const landUse = (r.landuse || '').padStart(2, '0');
			const residFar = parseFloat(r.residfar) || 0;
			const commFar = parseFloat(r.commfar) || 0;
			const facilFar = parseFloat(r.facilfar) || 0;
			const maxFAR = Math.max(residFar, commFar, facilFar);

			return {
				bbl: r.bbl || '',
				address: r.address || '',
				zipCode: r.zipcode || '',
				zoneDist1: r.zonedist1 || '',
				zoneDist2: r.zonedist2 || '',
				overlay1: r.overlay1 || '',
				landUse,
				landUseLabel: LAND_USE_LABELS[landUse] || 'Unknown',
				bldgClass: r.bldgclass || '',
				ownType: r.ownertype || '',
				numFloors: parseFloat(r.numfloors) || 0,
				numUnits: parseInt(r.unitstotal) || 0,
				numBldgs: parseInt(r.numbldgs) || 0,
				lotArea: parseFloat(r.lotarea) || 0,
				bldgArea: parseFloat(r.bldgarea) || 0,
				retailArea: parseFloat(r.retailarea) || 0,
				officeArea: parseFloat(r.officearea) || 0,
				yearBuilt: parseInt(r.yearbuilt) || 0,
				yearAlter1: parseInt(r.yearalter1) || 0,
				builtFAR: parseFloat(r.builtfar) || 0,
				maxFAR,
				assessLand: parseFloat(r.assessland) || 0,
				assessTotal: parseFloat(r.assesstot) || 0,
				lat: lotLat,
				lng: lotLng,
				distance: haversineMeters(lat, lng, lotLat, lotLng)
			};
		}).sort((a, b) => a.distance - b.distance);

		const nearestLot = lots[0] || null;
		const zoneProfile = buildZoneProfile(lots);
		const buildingProfile = buildBuildingProfile(lots);
		const developmentPotential = scoreDevelopmentPotential(lots);

		const result: PLUTOData = {
			lots,
			nearestLot,
			zoneProfile,
			buildingProfile,
			developmentPotential,
			source: 'pluto',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.PLUTO);
		return result;
	} catch (e) {
		console.error('[PLUTO] Fetch error:', e);
		return cached?.data || null;
	}
}

function buildZoneProfile(lots: PLUTOLot[]): ZoneProfile {
	const zoneTypes: Record<string, number> = {};
	let commercial = 0, residential = 0, manufacturing = 0, mixed = 0, overlays = 0;

	for (const lot of lots) {
		const zone = lot.zoneDist1;
		if (!zone) continue;
		zoneTypes[zone] = (zoneTypes[zone] || 0) + 1;

		const prefix = zone.charAt(0).toUpperCase();
		if (prefix === 'C') commercial++;
		else if (prefix === 'R') residential++;
		else if (prefix === 'M') manufacturing++;
		// Mixed-use zones often have both R and C designations
		if (lot.landUse === '04') mixed++;
		if (lot.overlay1) overlays++;
	}

	const total = lots.length || 1;
	const primaryZone = Object.entries(zoneTypes)
		.sort(([, a], [, b]) => b - a)[0]?.[0] || 'Unknown';

	return {
		primaryZone,
		zoneTypes,
		commercialOverlayCount: overlays,
		residentialPct: Math.round((residential / total) * 100),
		commercialPct: Math.round((commercial / total) * 100),
		manufacturingPct: Math.round((manufacturing / total) * 100),
		mixedUsePct: Math.round((mixed / total) * 100)
	};
}

function buildBuildingProfile(lots: PLUTOLot[]): BuildingProfile {
	const withYear = lots.filter(l => l.yearBuilt > 1800);
	const withFloors = lots.filter(l => l.numFloors > 0);
	const withArea = lots.filter(l => l.lotArea > 0);
	const withAssess = lots.filter(l => l.assessTotal > 0 && l.bldgArea > 0);
	const currentYear = new Date().getFullYear();

	const avgYearBuilt = withYear.length > 0
		? Math.round(withYear.reduce((s, l) => s + l.yearBuilt, 0) / withYear.length)
		: 0;

	// Median floors
	const floors = withFloors.map(l => l.numFloors).sort((a, b) => a - b);
	const medianFloors = floors.length > 0 ? floors[Math.floor(floors.length / 2)] : 0;

	const avgLotSize = withArea.length > 0
		? Math.round(withArea.reduce((s, l) => s + l.lotArea, 0) / withArea.length)
		: 0;

	const totalRetailSqFt = lots.reduce((s, l) => s + l.retailArea, 0);
	const totalOfficeSqFt = lots.reduce((s, l) => s + l.officeArea, 0);

	const avgAssessedValuePerSqFt = withAssess.length > 0
		? Math.round(withAssess.reduce((s, l) => s + l.assessTotal / l.bldgArea, 0) / withAssess.length)
		: 0;

	const vacantLotCount = lots.filter(l => l.landUse === '11').length;
	const recentAlterationCount = lots.filter(l => l.yearAlter1 >= currentYear - 5).length;

	return {
		avgYearBuilt,
		medianFloors,
		avgLotSize,
		totalRetailSqFt,
		totalOfficeSqFt,
		avgAssessedValuePerSqFt,
		vacantLotCount,
		recentAlterationCount
	};
}

/**
 * Score development potential 0-100 based on:
 * - FAR utilization (how much room to build up)
 * - Vacant lots nearby
 * - Recent alterations (active development area)
 * - Commercial overlay presence
 */
function scoreDevelopmentPotential(lots: PLUTOLot[]): number {
	if (lots.length === 0) return 0;

	let score = 50; // baseline

	// FAR headroom: if buildings are far below max FAR → development opportunity
	const withFAR = lots.filter(l => l.maxFAR > 0 && l.builtFAR > 0);
	if (withFAR.length > 0) {
		const avgUtilization = withFAR.reduce((s, l) => s + (l.builtFAR / l.maxFAR), 0) / withFAR.length;
		// Low utilization = high potential
		if (avgUtilization < 0.3) score += 20;
		else if (avgUtilization < 0.5) score += 15;
		else if (avgUtilization < 0.7) score += 8;
		else score -= 5; // built out
	}

	// Vacant lots nearby
	const vacantCount = lots.filter(l => l.landUse === '11').length;
	if (vacantCount >= 3) score += 15;
	else if (vacantCount >= 1) score += 8;

	// Recent alterations signal active development
	const currentYear = new Date().getFullYear();
	const recentAlts = lots.filter(l => l.yearAlter1 >= currentYear - 5).length;
	const altRate = recentAlts / lots.length;
	if (altRate > 0.2) score += 10;
	else if (altRate > 0.1) score += 5;

	// Commercial overlays increase development flexibility
	const overlays = lots.filter(l => l.overlay1).length;
	if (overlays > lots.length * 0.3) score += 5;

	return Math.max(0, Math.min(100, score));
}

// 04.19.2026 13:35 Score Consolidation — haversineMeters removed. Imported from geo-math.ts above.
