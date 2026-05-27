/**
 * ═══════════════════════════════════════════════════════
 * Street-Side Intelligence Layer
 * ═══════════════════════════════════════════════════════
 *
 * Estimates foot traffic quality on each side of a street
 * by stacking proxy signals:
 *
 * 1. Subway entrance proximity (which side are exits on?)
 * 2. Bus stop placement (which side has stops?)
 * 3. Active storefront density by side (POI clustering)
 * 4. Traffic hostility (tunnel approaches, highway ramps)
 *
 * NYC Insight: For habitual-visit concepts (coffee, juice),
 * being on the wrong side of the street can cost 30-50% of
 * walk-ins. For destination concepts (Kumon, dentist), the
 * penalty is much smaller.
 *
 * Manhattan's grid is rotated ~29° from true north.
 * Avenues run NNE–SSW, streets run ESE–WNW.
 */

import { intelCache, TTL, IntelCache } from './cache';
import { getServiceSupabase } from '$lib/supabase-server';
// 04.19.2026 13:35 Score Consolidation — haversineM removed; imported from canonical geo-math.ts
import { haversineMeters as haversineM } from '$lib/intel/scoring/geo-math';

// Re-export types from shared types file
export type { StreetSideData, SideSignals, HostilityFactor, ConceptSensitivity } from './street-side-types';
import type { StreetSideData, SideSignals, HostilityFactor, ConceptSensitivity } from './street-side-types';

// Re-export client-safe scoring functions
export { streetSideModifier, getConceptSensitivity } from './street-side-scoring';

interface NearbyPoint {
	lat: number;
	lng: number;
	type: 'subway_entrance' | 'bus_stop' | 'poi';
	name: string;
	distance: number;
}

// ── Constants ──────────────────────────────────────

// Manhattan grid is rotated ~29° clockwise from true north
const MANHATTAN_GRID_ANGLE_DEG = 29;
const MANHATTAN_GRID_ANGLE_RAD = MANHATTAN_GRID_ANGLE_DEG * Math.PI / 180;

// Meters per degree at NYC latitude (~40.75°)
const METERS_PER_DEG_LAT = 111_320;
const METERS_PER_DEG_LNG = 111_320 * Math.cos(40.75 * Math.PI / 180);

// Minimum perpendicular offset to count as "on a side" (vs on the centerline)
const SIDE_THRESHOLD_METERS = 8;  // ~half a street width

// Search radius for nearby signals
const SEARCH_RADIUS_M = 250;

// ── Known Traffic Hostility Zones (Manhattan) ──────

interface HostilityZone {
	name: string;
	type: HostilityFactor['type'];
	lat: number;
	lng: number;
	radiusM: number;      // affected radius
	bearingRange: [number, number];  // bearing range most affected (degrees)
	penalty: number;
}

const HOSTILITY_ZONES: HostilityZone[] = [
	// Lincoln Tunnel approach — 9th Ave & 37th-39th St
	{
		name: 'Lincoln Tunnel approach (9th Ave)',
		type: 'tunnel_approach',
		lat: 40.7567, lng: -73.9936,
		radiusM: 300, bearingRange: [150, 240], penalty: -15
	},
	// Lincoln Tunnel Dyer Ave approach
	{
		name: 'Lincoln Tunnel (Dyer Ave)',
		type: 'tunnel_approach',
		lat: 40.7580, lng: -73.9948,
		radiusM: 200, bearingRange: [180, 270], penalty: -12
	},
	// Holland Tunnel approach — Canal St / Varick
	{
		name: 'Holland Tunnel approach (Canal/Varick)',
		type: 'tunnel_approach',
		lat: 40.7254, lng: -74.0071,
		radiusM: 250, bearingRange: [180, 300], penalty: -12
	},
	// Queensboro Bridge approach — 2nd Ave & 59th-60th
	{
		name: 'Queensboro Bridge approach',
		type: 'tunnel_approach',
		lat: 40.7586, lng: -73.9602,
		radiusM: 200, bearingRange: [60, 150], penalty: -10
	},
	// FDR Drive entrance — multiple locations
	{
		name: 'FDR Drive on-ramp (East 34th)',
		type: 'highway_ramp',
		lat: 40.7445, lng: -73.9713,
		radiusM: 150, bearingRange: [60, 120], penalty: -8
	},
	// Port Authority Bus Terminal — heavy bus traffic
	{
		name: 'Port Authority Bus Terminal',
		type: 'bus_depot',
		lat: 40.7568, lng: -73.9900,
		radiusM: 200, bearingRange: [0, 360], penalty: -10
	},
	// West Side Highway / 12th Ave
	{
		name: 'West Side Highway corridor',
		type: 'highway_ramp',
		lat: 40.7590, lng: -73.9990,
		radiusM: 100, bearingRange: [0, 360], penalty: -8
	},
	// BQE / Manhattan Bridge approach
	{
		name: 'Manhattan Bridge approach (Canal/Bowery)',
		type: 'tunnel_approach',
		lat: 40.7145, lng: -73.9976,
		radiusM: 200, bearingRange: [90, 180], penalty: -10
	},
	// Williamsburg Bridge approach
	{
		name: 'Williamsburg Bridge approach (Delancey)',
		type: 'tunnel_approach',
		lat: 40.7153, lng: -73.9835,
		radiusM: 200, bearingRange: [60, 150], penalty: -10
	},
];

// ── Core Functions ─────────────────────────────────

/**
 * Fetch subway ENTRANCE coordinates (not station centroids)
 * from MTA Subway Entrances dataset.
 */
export async function fetchSubwayEntrances(
	lat: number, lng: number, radiusM: number = SEARCH_RADIUS_M
): Promise<NearbyPoint[]> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'subway-entrances');
	const cached = await intelCache.getAsync<NearbyPoint[]>(cacheKey);
	if (cached?.fresh) return cached.data;

	// Strategy: DB first → live API fallback
	let entrances: NearbyPoint[] = [];

	// ── 1. Try Supabase (seeded reference data) ──
	try {
		const supabase = getServiceSupabase();
		const { data: rows, error } = await supabase
			.rpc('nearby_subway_entrances', {
				p_lat: lat,
				p_lng: lng,
				p_radius_m: radiusM
			});

		if (!error && rows && rows.length > 0) {
			entrances = rows.map((r: { stop_name: string; routes: string; lat: number; lng: number; distance_m: number }) => ({
				lat: r.lat,
				lng: r.lng,
				type: 'subway_entrance' as const,
				name: `${r.stop_name} (${r.routes || ''})`,
				distance: Math.round(r.distance_m)
			}));
			console.log(`[StreetSide] DB: ${entrances.length} subway entrances within ${radiusM}m`);
			intelCache.set(cacheKey, entrances, TTL.TRANSIT, 'subway-entrances');
			return entrances;
		}
		// DB empty or RPC missing — fall through to live API
		if (error) console.warn('[StreetSide] DB subway query failed:', error.message);
	} catch {
		// DB not available — fall through
	}

	// ── 2. Fallback: live MTA API ──
	try {
		const url = new URL('https://data.ny.gov/resource/i9wp-a4ja.json');
		url.searchParams.set('$select', 'entrance_latitude,entrance_longitude,stop_name,daytime_routes,entry_allowed,exit_allowed');
		url.searchParams.set('$where',
			`within_circle(entrance_georeference,${lat},${lng},${radiusM})`
		);
		url.searchParams.set('$limit', '100');

		const resp = await fetch(url.toString(), {
			signal: AbortSignal.timeout(8000),
			headers: { 'Accept': 'application/json' }
		});

		if (!resp.ok) {
			console.warn(`[StreetSide] Subway entrances API ${resp.status}`);
			return cached?.data || [];
		}

		const raw: Array<{
			entrance_latitude: string;
			entrance_longitude: string;
			stop_name: string;
			daytime_routes: string;
			entry_allowed: string;
			exit_allowed: string;
		}> = await resp.json();

		entrances = raw
			.filter(r => r.entrance_latitude && r.entrance_longitude)
			.map(r => {
				const eLat = parseFloat(r.entrance_latitude);
				const eLng = parseFloat(r.entrance_longitude);
				return {
					lat: eLat,
					lng: eLng,
					type: 'subway_entrance' as const,
					name: `${r.stop_name} (${r.daytime_routes})`,
					distance: haversineM(lat, lng, eLat, eLng)
				};
			})
			.filter(e => e.distance <= radiusM)
			.sort((a, b) => a.distance - b.distance);

		intelCache.set(cacheKey, entrances, TTL.TRANSIT, 'subway-entrances');
		return entrances;
	} catch (err) {
		console.warn('[StreetSide] Subway entrances fetch error:', err instanceof Error ? err.message : err);
		return cached?.data || [];
	}
}

/**
 * Fetch nearby bus stops from MTA Current Bus Stops dataset.
 */
export async function fetchBusStops(
	lat: number, lng: number, radiusM: number = SEARCH_RADIUS_M
): Promise<NearbyPoint[]> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'bus-stops');
	const cached = await intelCache.getAsync<NearbyPoint[]>(cacheKey);
	if (cached?.fresh) return cached.data;

	let stops: NearbyPoint[] = [];

	// ── 1. Try Supabase (seeded reference data) ──
	try {
		const supabase = getServiceSupabase();
		const { data: rows, error } = await supabase
			.rpc('nearby_bus_stops', {
				p_lat: lat,
				p_lng: lng,
				p_radius_m: radiusM
			});

		if (!error && rows && rows.length > 0) {
			stops = rows.map((r: { stop_name: string; route: string; lat: number; lng: number; distance_m: number }) => ({
				lat: r.lat,
				lng: r.lng,
				type: 'bus_stop' as const,
				name: `${r.stop_name}${r.route ? ` (${r.route})` : ''}`,
				distance: Math.round(r.distance_m)
			}));
			console.log(`[StreetSide] DB: ${stops.length} bus stops within ${radiusM}m`);
			intelCache.set(cacheKey, stops, TTL.TRANSIT, 'bus-stops');
			return stops;
		}
		if (error) console.warn('[StreetSide] DB bus stops query failed:', error.message);
	} catch {
		// DB not available — fall through
	}

	// ── 2. Fallback: live MTA API ──
	try {
		const url = new URL('https://data.ny.gov/resource/ai5j-txmn.json');
		url.searchParams.set('$select', 'stop_name,latitude,longitude,route_short_name');
		url.searchParams.set('$where',
			`within_circle(georeference,${lat},${lng},${radiusM})`
		);
		url.searchParams.set('$limit', '200');

		const resp = await fetch(url.toString(), {
			signal: AbortSignal.timeout(8000),
			headers: { 'Accept': 'application/json' }
		});

		if (!resp.ok) {
			console.warn(`[StreetSide] Bus stops API ${resp.status}`);
			return cached?.data || [];
		}

		const raw: Array<{
			stop_name: string;
			latitude: string;
			longitude: string;
			route_short_name?: string;
		}> = await resp.json();

		stops = raw
			.filter(r => r.latitude && r.longitude)
			.map(r => {
				const sLat = parseFloat(r.latitude);
				const sLng = parseFloat(r.longitude);
				return {
					lat: sLat,
					lng: sLng,
					type: 'bus_stop' as const,
					name: `${r.stop_name}${r.route_short_name ? ` (${r.route_short_name})` : ''}`,
					distance: haversineM(lat, lng, sLat, sLng)
				};
			})
			.filter(s => s.distance <= radiusM)
			.sort((a, b) => a.distance - b.distance);

		intelCache.set(cacheKey, stops, TTL.TRANSIT, 'bus-stops');
		return stops;
	} catch (err) {
		console.warn('[StreetSide] Bus stops fetch error:', err instanceof Error ? err.message : err);
		return cached?.data || [];
	}
}

/**
 * Extract POIs with lat/lng from existing intel data.
 * Pulls from Google Places, Overpass competitors, and Foursquare.
 */
export function extractPOIsFromIntel(intelReport: {
	places?: { results?: Array<{ name?: string; lat?: number; lng?: number }> } | null;
	competitors?: { competitors?: Array<{ name: string; lat: number; lng: number; distance: number }> } | null;
}): NearbyPoint[] {
	const pois: NearbyPoint[] = [];

	// Google Places
	if (intelReport.places?.results) {
		for (const p of intelReport.places.results) {
			if (p.lat && p.lng) {
				pois.push({
					lat: p.lat, lng: p.lng,
					type: 'poi', name: p.name || 'Unknown',
					distance: 0  // will be computed later
				});
			}
		}
	}

	// Overpass competitors
	if (intelReport.competitors?.competitors) {
		for (const c of intelReport.competitors.competitors) {
			if (c.lat && c.lng) {
				pois.push({
					lat: c.lat, lng: c.lng,
					type: 'poi', name: c.name || 'Unknown',
					distance: c.distance * 1000  // km → m
				});
			}
		}
	}

	return pois;
}

// ── Geometry ───────────────────────────────────────

/**
 * Classify street type from address string.
 */
// ── Named Development → Frontage Street Mapping ──
// Major NYC developments that don't have traditional street addresses.
// Maps to the primary frontage street for street-type classification.
const NAMED_DEVELOPMENTS: Record<string, {
	frontageStreet: string;
	type: 'avenue' | 'street' | 'boulevard' | 'diagonal';
	label: string;
}> = {
	'manhattan west':     { frontageStreet: '9th Ave',       type: 'avenue',    label: '9th ave' },
	'1 manhattan west':   { frontageStreet: '9th Ave',       type: 'avenue',    label: '9th ave' },
	'2 manhattan west':   { frontageStreet: '9th Ave',       type: 'avenue',    label: '9th ave' },
	'3 manhattan west':   { frontageStreet: '9th Ave',       type: 'avenue',    label: '9th ave' },
	'hudson yards':       { frontageStreet: '10th Ave',      type: 'avenue',    label: '10th ave' },
	'10 hudson yards':    { frontageStreet: '10th Ave',      type: 'avenue',    label: '10th ave' },
	'30 hudson yards':    { frontageStreet: '10th Ave',      type: 'avenue',    label: '10th ave' },
	'35 hudson yards':    { frontageStreet: '10th Ave',      type: 'avenue',    label: '10th ave' },
	'50 hudson yards':    { frontageStreet: '10th Ave',      type: 'avenue',    label: '10th ave' },
	'55 hudson yards':    { frontageStreet: '10th Ave',      type: 'avenue',    label: '10th ave' },
	'brookfield place':   { frontageStreet: 'West St',       type: 'avenue',    label: 'west st' },
	'world trade center': { frontageStreet: 'West St',       type: 'avenue',    label: 'west st' },
	'one world trade':    { frontageStreet: 'West St',       type: 'avenue',    label: 'west st' },
	'1 world trade':      { frontageStreet: 'West St',       type: 'avenue',    label: 'west st' },
	'rockefeller center': { frontageStreet: '6th Ave',       type: 'avenue',    label: '6th ave' },
	'rockefeller plaza':  { frontageStreet: '6th Ave',       type: 'avenue',    label: '6th ave' },
	'lincoln center':     { frontageStreet: 'Columbus Ave',  type: 'avenue',    label: 'columbus ave' },
	'columbus circle':    { frontageStreet: 'Broadway',      type: 'diagonal',  label: 'broadway' },
	'time warner center': { frontageStreet: 'Broadway',      type: 'diagonal',  label: 'broadway' },
	'essex crossing':     { frontageStreet: 'Essex St',      type: 'avenue',    label: 'essex st' },
	'pier 17':            { frontageStreet: 'South St',      type: 'street',    label: 'south st' },
	'south street seaport': { frontageStreet: 'South St',    type: 'street',    label: 'south st' },
	'battery park city':  { frontageStreet: 'West St',       type: 'avenue',    label: 'west st' },
	'stuyvesant town':    { frontageStreet: '1st Ave',       type: 'avenue',    label: '1st ave' },
	'peter cooper village': { frontageStreet: '1st Ave',     type: 'avenue',    label: '1st ave' },
	'chelsea market':     { frontageStreet: '9th Ave',       type: 'avenue',    label: '9th ave' },
	'penn station':       { frontageStreet: '7th Ave',       type: 'avenue',    label: '7th ave' },
	'moynihan train hall': { frontageStreet: '8th Ave',      type: 'avenue',    label: '8th ave' },
	'grand central':      { frontageStreet: 'Park Ave',      type: 'avenue',    label: 'park ave' },
	'penn plaza':         { frontageStreet: '7th Ave',       type: 'avenue',    label: '7th ave' },
	'1 penn plaza':       { frontageStreet: '7th Ave',       type: 'avenue',    label: '7th ave' },
	'2 penn plaza':       { frontageStreet: '7th Ave',       type: 'avenue',    label: '7th ave' },
};

export function classifyStreetType(address: string): {
	type: 'avenue' | 'street' | 'boulevard' | 'diagonal' | 'unknown';
	name: string;
} {
	const streetPart = address.split(',')[0].trim();
	const streetName = streetPart.replace(/^\d+[-\s]*/,'').trim().toLowerCase();

	// Check named developments first
	const normalized = streetPart.toLowerCase().trim();
	for (const [key, dev] of Object.entries(NAMED_DEVELOPMENTS)) {
		if (normalized.includes(key)) {
			return { type: dev.type, name: dev.label };
		}
	}

	// Broadway is diagonal (not a true avenue or street)
	if (/\bbroadway\b/i.test(streetName)) {
		return { type: 'diagonal', name: 'Broadway' };
	}

	// Named avenues without "Ave" suffix (common in NYC)
	const namedAvenues = /\b(amsterdam|columbus|lexington|madison|park|york|west\s*end|riverside|allen|essex|bowery|chrystie|lafayette|varick|hudson|greenwich|washington|church|centre|mulberry|mott|elizabeth|baxter|mercer|wooster|greene|crosby)\b/i;
	if (namedAvenues.test(streetName)) {
		return { type: 'avenue', name: streetName };
	}

	// Avenues (N-S in Manhattan grid)
	const avenuePatterns = [
		/\bave(nue)?\b/i, /\bav\b/i,
		/\b(1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th)\s*ave/i,
		/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s*ave/i,
	];
	if (avenuePatterns.some(rx => rx.test(streetName))) {
		return { type: 'avenue', name: streetName };
	}

	// Boulevards (typically wider, sometimes diagonal)
	if (/\bblvd\b|\bboulevard\b/i.test(streetName)) {
		return { type: 'boulevard', name: streetName };
	}

	// Named streets that run E-W
	const namedStreets = /\b(wall|fulton|canal|houston|delancey|spring|prince|bleecker|waverly|christopher|chambers|worth|duane|reade|barclay|vesey|liberty|cortlandt|maiden|john|pine|cedar|warren)\s*(st|street)?\b/i;
	if (namedStreets.test(streetName)) {
		return { type: 'street', name: streetName };
	}

	// Numbered streets (E-W in Manhattan grid)
	const streetPatterns = [
		/\bst(reet)?\b/i, /\bstr\b/i,
		/^[ew]\s*\d+/i, /^\d+(st|nd|rd|th)/i,
	];
	if (streetPatterns.some(rx => rx.test(streetName))) {
		return { type: 'street', name: streetName };
	}

	// "Place" and "Row" are typically short E-W streets
	if (/\b(place|row|pl)\b/i.test(streetName)) {
		return { type: 'street', name: streetName };
	}

	return { type: 'unknown', name: streetName };
}

/**
 * Compute the perpendicular offset of a point from the street's
 * centerline, using Manhattan's rotated grid.
 *
 * Returns signed distance in meters:
 * - For avenues: positive = east side (grid-east), negative = west side
 * - For streets: positive = uptown side (grid-north), negative = downtown side
 * - For Broadway (diagonal at ~45°): use average of both axes
 */
function perpendicularOffset(
	baseLat: number, baseLng: number,
	pointLat: number, pointLng: number,
	streetType: 'avenue' | 'street' | 'boulevard' | 'diagonal' | 'unknown'
): number {
	// Convert lat/lng delta to meters
	const dLatM = (pointLat - baseLat) * METERS_PER_DEG_LAT;
	const dLngM = (pointLng - baseLng) * METERS_PER_DEG_LNG;

	// Rotate into Manhattan grid coordinates
	const cosA = Math.cos(MANHATTAN_GRID_ANGLE_RAD);
	const sinA = Math.sin(MANHATTAN_GRID_ANGLE_RAD);

	// Grid X = cross-avenue direction (roughly E-W)
	// Grid Y = along-avenue direction (roughly N-S)
	const gridX = dLngM * cosA + dLatM * sinA;
	const gridY = -dLngM * sinA + dLatM * cosA;

	switch (streetType) {
		case 'avenue':
			// Perpendicular to avenue = grid-X (east/west offset)
			return gridX;
		case 'street':
			// Perpendicular to street = grid-Y (uptown/downtown offset)
			return gridY;
		case 'diagonal':
			// Broadway runs at ~45° to grid — use the component that
			// gives the best separation. Broadway roughly follows
			// grid bearing 45° (NE), so perpendicular is at 135° (SE).
			return (gridX - gridY) / Math.SQRT2;
		case 'boulevard':
			// Treat like avenue by default
			return gridX;
		default:
			// Unknown — use the axis with more spread
			return Math.abs(gridX) > Math.abs(gridY) ? gridX : gridY;
	}
}

/**
 * Determine which side of the street an address is on,
 * using the building number (odd/even heuristic for NYC).
 *
 * NYC convention (Manhattan):
 * - E-W streets: odd on north, even on south
 * - N-S avenues: varies, but odd is typically west
 */
function addressSideFromNumber(address: string, streetType: string): 'A' | 'B' {
	const match = address.match(/^(\d+)/);
	if (!match) return 'A';
	const buildingNum = parseInt(match[1], 10);
	const isOdd = buildingNum % 2 === 1;

	if (streetType === 'street') {
		// Odd = north (grid-positive = A), Even = south (grid-negative = B)
		return isOdd ? 'A' : 'B';
	}
	// For avenues: odd typically west (grid-negative = B)
	return isOdd ? 'B' : 'A';
}

// ── Side Labels ────────────────────────────────────

function getSideLabels(streetType: string): { a: string; b: string } {
	switch (streetType) {
		case 'avenue': return { a: 'East side', b: 'West side' };
		case 'street': return { a: 'Uptown side (north)', b: 'Downtown side (south)' };
		case 'diagonal': return { a: 'East side', b: 'West side' };
		case 'boulevard': return { a: 'East side', b: 'West side' };
		default: return { a: 'Side A', b: 'Side B' };
	}
}

// ── Traffic Hostility ──────────────────────────────

function detectHostilityFactors(lat: number, lng: number): HostilityFactor[] {
	const factors: HostilityFactor[] = [];

	for (const zone of HOSTILITY_ZONES) {
		const dist = haversineM(lat, lng, zone.lat, zone.lng);
		if (dist > zone.radiusM) continue;

		const bearing = bearingDeg(lat, lng, zone.lat, zone.lng);
		const [bMin, bMax] = zone.bearingRange;

		// Check if bearing falls within the affected range
		let inRange = false;
		if (bMin < bMax) {
			inRange = bearing >= bMin && bearing <= bMax;
		} else {
			// Wraps around 360
			inRange = bearing >= bMin || bearing <= bMax;
		}

		// Penalty scales with proximity (closer = worse)
		const proximityFactor = 1 - (dist / zone.radiusM);
		const penalty = Math.round(zone.penalty * proximityFactor * (inRange ? 1.0 : 0.4));

		if (Math.abs(penalty) >= 2) {
			factors.push({
				type: zone.type,
				name: zone.name,
				distance: Math.round(dist),
				bearing: Math.round(bearing),
				penalty
			});
		}
	}

	return factors;
}

// ── Main Scoring Function ──────────────────────────

/**
 * Compute the street-side intelligence score.
 *
 * Returns a 0-100 score indicating how favorable the address's
 * side of the street is for foot traffic, plus detailed breakdowns.
 */
export async function computeStreetSideIntel(
	lat: number,
	lng: number,
	address: string,
	existingPOIs: NearbyPoint[] = []
): Promise<StreetSideData> {
	// 1. Classify the street
	const { type: streetType, name: streetName } = classifyStreetType(address);
	const labels = getSideLabels(streetType);
	const addressSide = addressSideFromNumber(address, streetType);

	// 2. Fetch transit data in parallel
	const [subwayEntrances, busStops] = await Promise.all([
		fetchSubwayEntrances(lat, lng),
		fetchBusStops(lat, lng)
	]);

	// 3. Combine all nearby points
	const allPoints: NearbyPoint[] = [
		...subwayEntrances,
		...busStops,
		...existingPOIs.map(p => ({
			...p,
			distance: p.distance || haversineM(lat, lng, p.lat, p.lng)
		}))
	].filter(p => p.distance <= SEARCH_RADIUS_M);

	// 4. Split points by side using perpendicular offset
	const sideA: SideSignals = { subwayEntrances: 0, busStops: 0, activePOIs: 0, totalSignals: 0 };
	const sideB: SideSignals = { subwayEntrances: 0, busStops: 0, activePOIs: 0, totalSignals: 0 };

	for (const point of allPoints) {
		const offset = perpendicularOffset(lat, lng, point.lat, point.lng, streetType);

		// Skip points too close to centerline
		if (Math.abs(offset) < SIDE_THRESHOLD_METERS) continue;

		const side = offset > 0 ? sideA : sideB;

		// Weight by distance — closer signals matter more
		const distanceWeight = Math.max(0.2, 1 - (point.distance / SEARCH_RADIUS_M));

		switch (point.type) {
			case 'subway_entrance':
				side.subwayEntrances += distanceWeight;
				side.totalSignals += distanceWeight * 3; // Subway entrances are high-signal
				break;
			case 'bus_stop':
				side.busStops += distanceWeight;
				side.totalSignals += distanceWeight * 1.5;
				break;
			case 'poi':
				side.activePOIs += distanceWeight;
				side.totalSignals += distanceWeight * 1;
				break;
		}
	}

	// Round for readability
	sideA.subwayEntrances = Math.round(sideA.subwayEntrances * 10) / 10;
	sideA.busStops = Math.round(sideA.busStops * 10) / 10;
	sideA.activePOIs = Math.round(sideA.activePOIs * 10) / 10;
	sideA.totalSignals = Math.round(sideA.totalSignals * 10) / 10;
	sideB.subwayEntrances = Math.round(sideB.subwayEntrances * 10) / 10;
	sideB.busStops = Math.round(sideB.busStops * 10) / 10;
	sideB.activePOIs = Math.round(sideB.activePOIs * 10) / 10;
	sideB.totalSignals = Math.round(sideB.totalSignals * 10) / 10;

	// 5. Compute side scores (0-100)
	const totalSignals = sideA.totalSignals + sideB.totalSignals;

	let sameScore: number;
	let oppositeScore: number;

	if (totalSignals === 0) {
		// No data — return neutral
		sameScore = 50;
		oppositeScore = 50;
	} else {
		const sameSide = addressSide === 'A' ? sideA : sideB;
		const oppSide = addressSide === 'A' ? sideB : sideA;

		// Score is proportion of signals on each side, scaled 0-100
		const sameRatio = sameSide.totalSignals / totalSignals;
		const oppRatio = oppSide.totalSignals / totalSignals;

		// Transform ratio to score using S-curve for meaningful spread
		// 0.5 ratio (even) → 60 score (fine)
		// 0.7+ ratio → 85+ (great)
		// 0.3- ratio → 35- (bad)
		sameScore = Math.round(ratioToScore(sameRatio));
		oppositeScore = Math.round(ratioToScore(oppRatio));
	}

	// 6. Asymmetry: -1 to +1 (positive = your side is better)
	const asymmetry = totalSignals > 0
		? Math.round(((sameScore - oppositeScore) / 100) * 100) / 100
		: 0;

	// 7. Traffic hostility
	const hostilityFactors = detectHostilityFactors(lat, lng);
	const hostilityPenalty = hostilityFactors.reduce((sum, f) => sum + f.penalty, 0);

	// 8. Final street-side score
	const streetSideScore = Math.max(0, Math.min(100,
		sameScore + hostilityPenalty
	));

	return {
		address,
		streetName,
		streetType,
		addressSide,
		sideALabel: labels.a,
		sideBLabel: labels.b,
		sideA,
		sideB,
		hostilityFactors,
		hostilityPenalty,
		sameScore,
		oppositeScore,
		asymmetry,
		streetSideScore
	};
}

// ── Utility Functions ──────────────────────────────

// 04.19.2026 13:35 Score Consolidation — haversineM removed. Now aliased from haversineMeters in geo-math.ts above.

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const lat1R = lat1 * Math.PI / 180;
	const lat2R = lat2 * Math.PI / 180;
	const x = Math.sin(dLng) * Math.cos(lat2R);
	const y = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
	return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}

/**
 * Convert a signal-share ratio (0-1) to a score (0-100)
 * using an S-curve that creates meaningful differentiation.
 */
function ratioToScore(ratio: number): number {
	// S-curve: ratio 0 → 15, 0.3 → 35, 0.5 → 60, 0.7 → 82, 1.0 → 95
	if (ratio <= 0) return 15;
	if (ratio >= 1) return 95;

	// Logistic-like curve centered at 0.5
	const x = (ratio - 0.5) * 5; // scale to [-2.5, 2.5]
	const sigmoid = 1 / (1 + Math.exp(-x));
	return 15 + sigmoid * 80;
}
