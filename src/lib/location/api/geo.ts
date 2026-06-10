// ═══════════════════════════════════════════════
// RE² Location IQ — Geocoding & Area Scan APIs
// ═══════════════════════════════════════════════

import { NOMINATIM_URL, HOOD_DATA, type HoodDataEntry } from '../data/constants';

// Multiple public Overpass API mirrors — tried in order on 4xx/5xx/timeout.
// All support CORS + POST natively. Individual browser IPs are not rate-limited.
// Removed maps.mail.ru as it blocks US traffic.
const OVERPASS_MIRRORS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://overpass.private.coffee/api/interpreter',
	'https://lz4.overpass-api.de/api/interpreter'
];
import { haversine, cfetch } from '../utils/helpers';
import type { LocationIntelReport } from '../../intel/index';

export interface GeoCandidate {
	lat: number;
	lon: number;
	display: string;
	borough: string;
}

export interface GeoResult {
	lat: number;
	lon: number;
	display: string;
	/** When the address is ambiguous across boroughs, candidates are returned for disambiguation */
	ambiguous?: boolean;
	candidates?: GeoCandidate[];
}

export interface POI {
	name: string;
	dist: number;
	lat: number;
	lon: number;
}

export interface ScanData {
	cafes: POI[];
	gyms: POI[];
	yoga: POI[];
	health: POI[];
	stations: POI[];
}

/**
 * LiveIntelReport is the full LocationIntelReport from the intel pipeline.
 * Previously this was a narrow 4-field interface that silently discarded
 * ~15 data sources (MTA ridership, pedestrian counts, Foursquare, competitors,
 * places, marketDensity, pluto, 311, DCA, DOB, LPC, sidewalk cafes, liquor
 * licenses, census housing, momentum). Now it's the real thing.
 */
export type LiveIntelReport = LocationIntelReport;

// Cache for live intel
const LIVE_INTEL_CACHE: Record<string, LiveIntelReport> = {};

/**
 * Known NYC borough names — used to detect whether user already specified one.
 * If not, we append "Manhattan" to bias the geocoder toward Manhattan.
 */
const BOROUGH_NAMES = [
	'manhattan', 'brooklyn', 'queens', 'bronx', 'staten island',
	// Common neighborhood names that resolve without borough suffix
	'astoria', 'williamsburg', 'bushwick', 'dumbo', 'harlem', 'flushing',
	'jamaica', 'bayside', 'ridgewood', 'corona', 'elmhurst', 'forest hills',
	'jackson heights', 'woodside', 'sunnyside', 'long island city', 'lic',
	'park slope', 'flatbush', 'bed-stuy', 'bedford-stuyvesant', 'crown heights',
	'sunset park', 'bay ridge', 'bensonhurst', 'canarsie', 'sheepshead bay',
	'flatlands', 'borough park', 'east new york', 'brownsville', 'coney island',
	'greenpoint', 'red hook', 'carroll gardens', 'cobble hill', 'boerum hill',
	'fort greene', 'clinton hill', 'prospect heights', 'prospect park',
	'south bronx', 'fordham', 'riverdale', 'pelham bay', 'throgs neck',
	'morrisania', 'mott haven', 'hunts point', 'kingsbridge',
	'tottenville', 'st. george', 'stapleton', 'port richmond',
];

/** BUG-009: Neighborhood → borough fallback for geocoding retry */
const NEIGHBORHOOD_TO_BOROUGH: Record<string, string> = {
	'jackson heights': 'Queens', 'woodside': 'Queens', 'flushing': 'Queens',
	'astoria': 'Queens', 'sunnyside': 'Queens', 'long island city': 'Queens', 'lic': 'Queens',
	'ridgewood': 'Queens', 'corona': 'Queens', 'elmhurst': 'Queens', 'jamaica': 'Queens',
	'bayside': 'Queens', 'forest hills': 'Queens', 'kew gardens': 'Queens',
	'williamsburg': 'Brooklyn', 'bushwick': 'Brooklyn', 'dumbo': 'Brooklyn',
	'park slope': 'Brooklyn', 'flatbush': 'Brooklyn', 'bed-stuy': 'Brooklyn',
	'bedford-stuyvesant': 'Brooklyn', 'crown heights': 'Brooklyn', 'sunset park': 'Brooklyn',
	'bay ridge': 'Brooklyn', 'bensonhurst': 'Brooklyn', 'canarsie': 'Brooklyn',
	'sheepshead bay': 'Brooklyn', 'flatlands': 'Brooklyn', 'borough park': 'Brooklyn',
	'east new york': 'Brooklyn', 'brownsville': 'Brooklyn', 'coney island': 'Brooklyn',
	'greenpoint': 'Brooklyn', 'red hook': 'Brooklyn', 'carroll gardens': 'Brooklyn',
	'cobble hill': 'Brooklyn', 'boerum hill': 'Brooklyn', 'fort greene': 'Brooklyn',
	'clinton hill': 'Brooklyn', 'prospect heights': 'Brooklyn',
	'south bronx': 'Bronx', 'fordham': 'Bronx', 'riverdale': 'Bronx',
	'pelham bay': 'Bronx', 'throgs neck': 'Bronx', 'morrisania': 'Bronx',
	'mott haven': 'Bronx', 'hunts point': 'Bronx', 'kingsbridge': 'Bronx',
	'tottenville': 'Staten Island', 'stapleton': 'Staten Island',
	'port richmond': 'Staten Island', 'st. george': 'Staten Island',
};

import { env } from '$env/dynamic/public';

async function loadGoogleMaps(apiKey: string): Promise<void> {
	if (typeof window === 'undefined') return;
	if (window.google?.maps) return;

	return new Promise((resolve, reject) => {
		if (document.querySelector('script[src*="maps.googleapis.com"]')) {
			const checkLoaded = setInterval(() => {
				if (window.google?.maps) {
					clearInterval(checkLoaded);
					resolve();
				}
			}, 100);
			return;
		}

		const script = document.createElement('script');
		script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker,places&v=weekly&callback=__gmapsInitGeo`;
		script.async = true;
		script.defer = true;
		(window as any).__gmapsInitGeo = () => {
			delete (window as any).__gmapsInitGeo;
			resolve();
		};
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

async function geocodeQuery(query: string): Promise<{ lat: string; lon: string; display_name: string }[]> {
	const apiKey = env.PUBLIC_GOOGLE_MAPS_API_KEY;

	// 1. Try Google Maps JS SDK Geocoder if available (highest success rate, uses Maps JS quota)
	if (typeof window !== 'undefined' && apiKey) {
		try {
			await loadGoogleMaps(apiKey);
			if (window.google?.maps?.Geocoder) {
				const geocoder = new google.maps.Geocoder();
				const result = await new Promise<any>((resolve, reject) => {
					geocoder.geocode({ address: query }, (results, status) => {
						if (status === 'OK' && results && results.length > 0) {
							resolve(results);
						} else {
							reject(new Error(status));
						}
					});
				});
				return result.map((r: any) => ({
					lat: r.geometry.location.lat().toString(),
					lon: r.geometry.location.lng().toString(),
					display_name: r.formatted_address
				}));
			}
		} catch (e) {
			console.warn('[geo] Google JS Geocoder failed:', e);
		}
	}

	// 2. Try Nominatim (Free, rate-limited)
	try {
		const r = await fetch(NOMINATIM_URL + '&q=' + encodeURIComponent(query) + '&format=json&limit=5&countrycodes=us', { headers: { 'User-Agent': 'resquared-launchpad/1.0' } });
		if (r.ok) {
			const data = await r.json();
			if (data && data.length > 0) return data;
		}
	} catch (e) {
		console.warn('[geo] Nominatim fetch failed:', e);
	}

	// 3. Fallback to Google Geocoding HTTP API (Requires Geocoding API enabled in GCP)
	if (apiKey) {
		try {
			const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
			const res = await fetch(googleUrl);
			const data = await res.json();
			if (data.status === 'OK' && data.results.length > 0) {
				return data.results.map((r: any) => ({
					lat: r.geometry.location.lat.toString(),
					lon: r.geometry.location.lng.toString(),
					display_name: r.formatted_address
				}));
			}
			console.warn('[geo] Google Geocoding fallback returned:', data.status);
		} catch (err) {
			console.error('[geo] Google Geocoding fallback failed', err);
		}
	}
	return [];
}

export async function geocode(addr: string): Promise<GeoResult> {
	try {
		const lowerAddr = addr.toLowerCase();
		// PHASE 1D FIX: Never append "Manhattan" default — it biased all outer-borough geocoding.
		// Always query the address as-is with NYC fallback for truly ambiguous queries.
		const query = addr + ', New York City';

		let d = await geocodeQuery(query);

		// BUG-009: If first attempt fails, try replacing neighborhood name with borough
		if (!d || !d.length) {
			for (const [neighborhood, borough] of Object.entries(NEIGHBORHOOD_TO_BOROUGH)) {
				if (lowerAddr.includes(neighborhood)) {
					// Replace neighborhood with borough name for retry
					const retryAddr = addr.replace(new RegExp(neighborhood, 'i'), borough + ', NY');
					d = await geocodeQuery(retryAddr);
					if (d && d.length) break;
					// Also try just appending the borough
					d = await geocodeQuery(addr + ', ' + borough + ', NY');
					if (d && d.length) break;
				}
			}
		}

		if (!d || !d.length) throw new Error('Address not found');

		// Trust Nominatim's ranking — no Manhattan bias. d[0] is the best match.
		// Filter to NYC lat/lng range only to exclude irrelevant out-of-state results.
		const NYC_LAT_MIN = 40.4774;
		const NYC_LAT_MAX = 40.9176;
		const NYC_LNG_MIN = -74.2591;
		const NYC_LNG_MAX = -73.7004;
		const nycResults = d.filter((r: { lat: string; lon: string }) => {
			const lat = +r.lat; const lon = +r.lon;
			return lat >= NYC_LAT_MIN && lat <= NYC_LAT_MAX && lon >= NYC_LNG_MIN && lon <= NYC_LNG_MAX;
		});

		const best = nycResults[0] || d[0];
		const result: GeoResult = { lat: +best.lat, lon: +best.lon, display: best.display_name };

		// B6 FIX: Detect multi-borough ambiguity
		// If multiple NYC results land in different boroughs, return candidates for disambiguation
		if (nycResults.length >= 2) {
			const NYC_BOROUGHS: Record<string, string> = {
				'Manhattan': 'Manhattan', 'New York County': 'Manhattan',
				'Brooklyn': 'Brooklyn', 'Kings County': 'Brooklyn', 'Kings': 'Brooklyn',
				'Queens': 'Queens', 'Queens County': 'Queens',
				'Bronx': 'Bronx', 'The Bronx': 'Bronx', 'Bronx County': 'Bronx',
				'Staten Island': 'Staten Island', 'Richmond County': 'Staten Island',
			};
			const detectBorough = (displayName: string): string => {
				for (const [key, borough] of Object.entries(NYC_BOROUGHS)) {
					if (displayName.includes(key)) return borough;
				}
				return 'NYC';
			};
			const candidatesWithBorough = nycResults.map((r: { lat: string; lon: string; display_name: string }) => ({
				lat: +r.lat, lon: +r.lon, display: r.display_name, borough: detectBorough(r.display_name)
			}));
			// Dedupe: one per borough
			const seen = new Set<string>();
			const deduped = candidatesWithBorough.filter((c: GeoCandidate) => {
				if (c.borough === 'NYC' || seen.has(c.borough)) return false;
				seen.add(c.borough);
				return true;
			});
			if (deduped.length >= 2) {
				result.ambiguous = true;
				result.candidates = deduped;
			}
		}

		return result;
	} catch (e: unknown) {
		throw new Error('Geocoding failed: ' + (e instanceof Error ? e.message : String(e)));
	}
}

interface OverpassElement {
	lat: number;
	lon: number;
	center?: { lat: number; lon: number };
	tags?: Record<string, string>;
}

async function overpassQ(q: string): Promise<OverpassElement[]> {
	// Try each mirror in order — fall through on 4xx/5xx/timeout.
	for (const mirror of OVERPASS_MIRRORS) {
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 12000);
			const r = await fetch(mirror, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: 'data=' + encodeURIComponent(q),
				signal: controller.signal,
			});
			clearTimeout(timer);
			if (!r.ok) {
				console.warn(`[RE²] Overpass ${mirror} → HTTP ${r.status}, trying next mirror`);
				continue;
			}
			const data = await r.json();
			if (!data?.elements) {
				console.warn(`[RE²] Overpass ${mirror} → no elements, trying next mirror`);
				continue;
			}
			return data.elements;
		} catch (e: unknown) {
			console.warn(`[RE²] Overpass ${mirror} → ${e instanceof Error ? e.message : String(e)}, trying next mirror`);
		}
	}
	console.error('[RE²] All Overpass mirrors failed');
	return [];
}

function getCompetitorQuery(cat: string, radius: number, lat: number, lon: number): string {
	const a = `(around:${radius},${lat},${lon})`;
	// Use nwr (node/way/relation) — many NYC businesses are mapped as way polygons in OSM.
	// Combined with "out center;" in the query call, this returns centroid lat/lng for ways/relations.
	// Broader queries to catch all NYC-tagged variants (branded stores often use fast_food/restaurant
	// instead of cafe; many NYC coffee chains not tagged with cuisine=coffee in OSM).
	const queries: Record<string, string> = {
		coffee: `(nwr["amenity"="cafe"]${a};nwr["amenity"="fast_food"]["cuisine"~"coffee|tea"]${a};nwr["cuisine"~"coffee|tea|bubble_tea"]${a};nwr["shop"~"coffee|tea"]${a};nwr["brand"~"Starbucks|Dunkin|Blue Bottle|Gregorys|Think Coffee",i]${a};)`,
		bakery: `(nwr["shop"="bakery"]${a};nwr["amenity"="cafe"]["shop"="bakery"]${a};nwr["cuisine"~"bakery|pastry|cake"]${a};)`,
		'fast-casual': `(nwr["amenity"="fast_food"]${a};nwr["amenity"="restaurant"]${a};nwr["amenity"="cafe"]["cuisine"~"sandwich|salad|bowl|sushi|poke"]${a};)`,
		restaurant: `(nwr["amenity"="restaurant"]${a};nwr["amenity"="bar"]${a};nwr["amenity"="fast_food"]${a};)`,
		fitness: `(nwr["leisure"="fitness_centre"]${a};nwr["sport"="fitness"]${a};nwr["sport"="yoga"]${a};nwr["leisure"="sports_centre"]${a};)`,
		retail: `(nwr["shop"]${a};)`,
	};
	// Normalize canonical concept keys that don't map directly to query categories
	const catNorm: Record<string, string> = {
		specialty_coffee: 'coffee', coffee: 'coffee',
		bakery: 'bakery',
		fast_casual: 'fast-casual', qsr: 'fast-casual',
		full_service_restaurant: 'restaurant', bar_nightlife: 'restaurant',
		juice_bar: 'coffee', wellness_beverage: 'coffee',
		fitness_studio: 'fitness', boutique_gym: 'fitness', wellness_spa: 'fitness',
		retail: 'retail', florist: 'retail',
	};
	const normalizedCat = catNorm[cat] || cat;
	return queries[normalizedCat] || queries.coffee;
}

function proc(arr: OverpassElement[], lat: number, lon: number): POI[] {
	const seen: Record<string, boolean> = {};
	return arr
		.filter((e) => {
			// Ways/relations return center coords from "out center;"
			const eLat = e.lat ?? e.center?.lat;
			const eLon = e.lon ?? e.center?.lon;
			if (!eLat || !eLon) return false;
			const k = (e.tags?.name || '') + eLat.toFixed(4);
			if (seen[k]) return false;
			seen[k] = true;
			return true;
		})
		.map((e) => {
			const eLat = e.lat ?? e.center?.lat ?? 0;
			const eLon = e.lon ?? e.center?.lon ?? 0;
			return {
				name: e.tags?.name || e.tags?.brand || 'Unnamed',
				dist: haversine(lat, lon, eLat, eLon),
				lat: eLat,
				lon: eLon,
			};
		})
		.sort((a, b) => a.dist - b.dist);
}

/**
 * Station-specific processing: deduplicates by station name so that
 * multiple subway entrances for the same station count as one.
 */
function procStations(arr: OverpassElement[], lat: number, lon: number): POI[] {
	const all = proc(arr, lat, lon);
	const seen = new Set<string>();
	const named: POI[] = [];
	const unnamed: POI[] = [];

	for (const p of all) {
		const key = p.name.toLowerCase().trim();
		if (key === 'unnamed' || key === '') {
			unnamed.push(p);
		} else {
			if (!seen.has(key)) {
				seen.add(key);
				named.push(p);
			}
		}
	}

	// Unnamed entries: keep only if not within 100m of a known station
	const kept: POI[] = [];
	for (const u of unnamed) {
		const tooClose = [...named, ...kept].some(
			s => haversine(s.lat, s.lon, u.lat, u.lon) < 0.1
		);
		if (!tooClose) kept.push(u);
	}

	return [...named, ...kept].sort((a, b) => a.dist - b.dist);
}

/**
 * Concept-aware scan radius based on Document 09 pull radius data.
 * Impulse concepts (coffee, bakery) = tight radius (250m ≈ 3 min walk).
 * Planned concepts (grocery, restaurant) = moderate (400m ≈ 5-10 min walk).
 * Destination concepts (bar, med spa, fitness) = wide (600m ≈ 15 min walk).
 * Comparison shopping (retail) = moderate-wide (500m).
 */
export function getConceptScanRadius(bizCategory: string): number {
	const CONCEPT_RADII: Record<string, number> = {
		// Impulse (3 min walk = ~250m)
		coffee: 250, specialty_coffee: 250,
		// Impulse/planned (5 min walk = ~400m)
		bakery: 350, 'fast-casual': 400, qsr: 400, deli: 350,
		// Planned (10 min walk = ~800m)
		restaurant: 500, full_service_restaurant: 500, grocery: 800, florist: 500,
		// Routine/destination (15 min walk = ~1200m)
		fitness: 600, fitness_studio: 600, personal_services: 500, salon: 500,
		// Destination (15-30 min = wide)
		bar: 600, bar_nightlife: 600, medical: 600, medical_office: 600,
		// Comparison shopping
		retail: 500, boutique: 500,
		// Coworking
		coworking: 600,
	};
	const key = bizCategory.toLowerCase().replace(/[\s\/]+/g, '-');
	return CONCEPT_RADII[key] || CONCEPT_RADII[bizCategory] || 400;
}

export async function scanArea(lat: number, lon: number, radius: number, bizCategory: string = 'coffee'): Promise<ScanData> {
	// 04.22.2026: Removed direct Overpass API calls from the client to prevent 429 timeouts.
	// The application now strictly relies on the backend liveIntel payload (which fetches 
	// Google Places API) for all POI data, including competitors and demand proxies.
	return {
		cafes: [],
		gyms: [],
		yoga: [],
		health: [],
		stations: [] // Populated from MTA Socrata via enrichStationsFromMTA()
	};
}

/**
 * Populate ScanData.stations from MTA Socrata ridership data.
 * This is the single source of truth for transit stations —
 * replaces the old unreliable Overpass station query.
 */
export function enrichStationsFromMTA(data: ScanData, liveIntel: LiveIntelReport | null): ScanData {
	if (!liveIntel?.mtaRidership) return data;

	const mta = liveIntel.mtaRidership;
	if (!mta.stations || mta.stations.length === 0) {
		// MTA returned data but no stations — respect the result (area truly has no transit)
		return data;
	}

	const stations: POI[] = mta.stations.map(s => ({
		name: s.stationComplex || s.station_complex || 'Subway Station',
		dist: 0,
		lat: 0,
		lon: 0,
	}));

	return { ...data, stations };
}

export async function fetchLiveIntel(lat: number, lng: number, bizType: string, address?: string): Promise<LiveIntelReport | null> {
	const cacheKey = lat.toFixed(4) + ',' + lng.toFixed(4);
	if (LIVE_INTEL_CACHE[cacheKey]) return LIVE_INTEL_CACHE[cacheKey];

	try {
		let url = `/api/location-intel?lat=${lat}&lng=${lng}&type=${encodeURIComponent(bizType || 'cafe')}`;
		if (address) url += `&address=${encodeURIComponent(address)}`;

		// Use authedFetch for automatic token injection + 401 retry
		const { authedFetch } = await import('$lib/authed-fetch');
		const res = await authedFetch(url, { timeout: 85000 });

		if (!res.ok) {
			const errText = await res.text().catch(() => '');
			console.error('[LiveIntel] API error:', res.status, errText.slice(0, 200));
			return null;
		}
		const report: LiveIntelReport = await res.json();
		LIVE_INTEL_CACHE[cacheKey] = report;

		// Enrich HOOD_DATA if we can match a neighborhood
		enrichHoodData(report, address);
		return report;
	} catch (e: unknown) {
		console.error('[LiveIntel] Fetch error:', e instanceof Error ? e.message : String(e));
		return null;
	}
}

export function intelToHoodScores(report: LiveIntelReport): HoodDataEntry {
	const result: HoodDataEntry = { demScore: 60, rentPSF: 100, trend: 60, crimeScore: 60, wageBase: 16 };

	if (report.census) {
		const c = report.census;
		const incomeScore = Math.min(100, Math.round(c.medianHouseholdIncome / 1500));
		const eduScore = Math.min(100, c.bachelorsPlusPercent);
		const popScore = Math.min(100, Math.round(c.daytimePopulationRatio * 60));
		result.demScore = Math.round(incomeScore * 0.4 + eduScore * 0.3 + popScore * 0.3);
		result.wageBase = Math.max(15, Math.min(25, Math.round(c.medianHouseholdIncome / 6000)));
		result.trend = Math.round(popScore * 0.5 + eduScore * 0.5);
	}

	if (report.crime) {
		result.crimeScore = report.crime.crimeScore;
	}

	if (report.walkScore) {
		result.trend = Math.round(result.trend * 0.6 + report.walkScore.walkScore * 0.4);
	}

	return result;
}

function enrichHoodData(report: LiveIntelReport, address?: string): void {
	if (!address) return;
	const addr = address.toLowerCase();
	for (const hood in HOOD_DATA) {
		if (addr.indexOf(hood.toLowerCase()) > -1) {
			const scores = intelToHoodScores(report);
			Object.assign(HOOD_DATA[hood], scores);
			HOOD_DATA[hood]._live = true;
			break;
		}
	}
}
