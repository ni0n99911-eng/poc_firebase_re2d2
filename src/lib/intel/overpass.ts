import { SITE_CONFIG } from '$lib/modules';
// 04.19.2026 13:35 Score Consolidation — haversineKm imported from canonical geo-math.ts
import { haversineKm } from '$lib/intel/scoring/geo-math';

/**
 * Improved Overpass API client for competitor scanning.
 *
 * Structured Overpass API client for Location IQ, replacing the legacy monolith with
 * a structured, typed, cached client that supports:
 * - Parallel multi-query execution
 * - Ring-based competitor bucketing (immediate, walking, extended)
 * - Format-aware competitor detection (cafe, restaurant, gym, etc.)
 * - Chain vs independent classification
 * - De-duplication by name + proximity
 */

import { IntelCache, intelCache, TTL } from './cache';

export interface CompetitorPOI {
	name: string;
	brand?: string;
	lat: number;
	lng: number;
	distance: number;  // km from search point
	type: string;      // cafe, restaurant, gym, etc.
	isChain: boolean;
	tags: Record<string, string>;
}

export interface CompetitorRings {
	ring1: CompetitorPOI[];  // Immediate (< 200m for cafe, < 5min walk)
	ring2: CompetitorPOI[];  // Walking (200-400m, 5-10min)
	ring3: CompetitorPOI[];  // Extended (400-800m, 10-15min)
}

/**
 * Chain vs independent breakdown for a single competitor ring.
 * chainDominance is 0–1 (chains / total); 0 when the ring is empty.
 * topChains lists unique brand/name values for chains in this ring.
 */
export interface RingChainStats {
	chainCount: number;
	independentCount: number;
	total: number;
	chainDominance: number;   // 0–1 ratio; rounded to 2 dp
	topChains: string[];      // up to 10 unique chain names, insertion-order by distance
}

/** Per-ring chain vs independent breakdown for all three rings. */
export interface CompetitorRingStats {
	ring1: RingChainStats;
	ring2: RingChainStats;
	ring3: RingChainStats;
}

export interface OverpassData {
	competitors: CompetitorPOI[];
	rings: CompetitorRings;
	totalCount: number;
	chainCount: number;
	independentCount: number;
	/** Overall chain dominance ratio across all competitors (0–1). */
	chainDominance: number;
	/** Unique chain brand/name list across all competitors (up to 15). */
	topChains: string[];
	/** Per-ring chain vs independent breakdown for granular scoring signals. */
	ringStats: CompetitorRingStats;
	saturationScore: number;  // 0-100 (higher = more saturated)
	stations: CompetitorPOI[];
	amenities: {
		cafes: CompetitorPOI[];
		restaurants: CompetitorPOI[];
		gyms: CompetitorPOI[];
		yoga: CompetitorPOI[];
		health: CompetitorPOI[];
		bars: CompetitorPOI[];
		wellness: CompetitorPOI[];
		retail: CompetitorPOI[];
		personal: CompetitorPOI[];
	};
	source: 'overpass';
	fetchedAt: string;
}

// Ring distances by canonical concept key (in km)
// BRAIN-RADIUS-02: Rings aligned to approved trade radii (April 8 2026)
// Pattern: [~50% trade, trade, ~2.5x trade] in km
const RING_DISTANCES: Record<string, [number, number, number]> = {
	specialty_coffee:         [0.1,  0.2,  0.5],
	juice_bar:                [0.1,  0.2,  0.5],
	wellness_beverage:        [0.1,  0.2,  0.5],
	bakery:                   [0.2,  0.4,  1.0],
	qsr:                      [0.25, 0.5,  1.2],
	personal_services:        [0.25, 0.5,  1.2],
	retail:                   [0.25, 0.5,  1.2],
	fast_casual:              [0.3,  0.6,  1.5],
	fitness_studio:           [0.3,  0.6,  1.5],
	bar_nightlife:            [0.4,  0.8,  2.0],
	wellness_spa:             [0.4,  0.8,  2.0],
	medical_office:           [0.4,  0.8,  2.0],
	coworking:                [0.4,  0.8,  2.0],
	florist:                  [0.4,  0.8,  2.0],
	full_service_restaurant:  [0.5,  1.5,  3.0],
	// SEG-02: New segment ring distances
	nail_salon:              [0.15, 0.3,  0.8],   // hyperlocal walk-in
	barbershop:              [0.15, 0.3,  0.8],   // hyperlocal loyalty
	pharmacy:                [0.3,  0.6,  1.5],   // convenience radius
	doggie_daycare:          [0.4,  0.8,  2.0],   // destination service
	tutoring:                [0.4,  0.8,  2.0],   // school-proximate
	ethnic_market:           [0.4,  1.0,  2.5],   // community destination
	// Legacy fuzzy keys mapped to canonical equivalents
	cafe:        [0.1,  0.2,  0.5],
	coffee:      [0.1,  0.2,  0.5],
	restaurant:  [0.5,  1.5,  3.0],
	fitness:     [0.3,  0.6,  1.5],
	gym:         [0.3,  0.6,  1.5],
	bar:         [0.4,  0.8,  2.0],
	default:     [0.3,  0.6,  1.5]
};

const CHAIN_NAMES = new Set([
	// Coffee
	'starbucks', 'dunkin', "dunkin'", 'peet', "peet's", 'blue bottle',
	"gregory's", 'gregorys', 'joe coffee', 'think coffee', 'la colombe',
	'bluestone lane', 'philz', 'intelligentsia', 'blank street',
	'birch coffee', 'ground central', 'city of saints', 'felix roasting',
	// QSR / Fast casual / Restaurants
	'sweetgreen', 'chipotle', 'shake shack', 'panera', "mcdonald's",
	'subway', 'chick-fil-a', "wendy's", 'burger king', 'popeyes',
	"domino's", 'pizza hut', 'taco bell', 'five guys', 'wingstop',
	'cava', 'dig', 'just salad',
	// Fitness
	'equinox', 'planet fitness', 'orangetheory', 'soulcycle',
	'blink fitness', 'crunch', "barry's", 'lifetime fitness',
	'solidcore', 'rumble', 'y7 studio', 'peloton',
	// Bars
	'tgif', "applebee's", 'buffalo wild wings',
	// Spa / Wellness
	'hand & stone', 'massage envy', 'exhale', 'dry bar', 'drybar',
	// Personal services
	'supercuts', 'great clips', 'sport clips', 'european wax center',
	'ulta', 'sephora', 'glosslab', 'tenoverten',
	// Retail
	'h&m', 'zara', 'uniqlo', 'gap', 'old navy', 'forever 21',
	'urban outfitters', 'lululemon', 'nike', 'adidas', 'foot locker',
	// Bakery
	'paris baguette', 'tous les jours', 'au bon pain', 'le pain quotidien',
	// Juice / Wellness beverage
	'jamba', 'juice press', 'pressed juicery', 'kung fu tea', 'gong cha',
	// Coworking
	'wework', 'regus', 'spaces', 'industrious',
	// Medical
	'aspen dental', 'citymd', 'one medical'
]);

/**
 * Scan an area for competitors using Overpass API.
 * Runs 5 parallel queries for different business categories.
 */
export async function scanCompetitors(
	lat: number,
	lng: number,
	businessType: string = 'cafe',
	radiusMeters: number = 800
): Promise<OverpassData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, `overpass-${businessType}`);
	const cached = await intelCache.getAsync<OverpassData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		const r = radiusMeters;
		const lower = businessType.toLowerCase();
		// Use nwr (node/way/relation) instead of just node — many NYC businesses
		// (including Blank Street, etc.) are mapped as way polygons in OSM.
		// "out center;" returns centroid lat/lng for ways and relations.
		// NOTE: Transit stations removed from Overpass — MTA Socrata is single source of truth.
		// Overpass station queries were unreliable (rate-limited from Netlify IPs).
		//
		// ARCHITECTURE: 4 core market queries (always) + 1 concept-specific query (conditional).
		// Max 5 parallel queries to stay within Overpass rate limits on Netlify IPs.
		// The 4 core queries power market density context for ANY concept.
		// The 5th query fetches the actual concept's competitors when it's not covered by core 4.
		const coreQueries = [
			// Cafes & coffee shops
			`[out:json][timeout:12];(nwr["amenity"="cafe"](around:${r},${lat},${lng});nwr["cuisine"~"coffee"](around:${r},${lat},${lng});nwr["shop"="coffee"](around:${r},${lat},${lng}););out center;`,
			// Restaurants & fast food
			`[out:json][timeout:12];(nwr["amenity"="restaurant"](around:${r},${lat},${lng});nwr["amenity"="fast_food"](around:${r},${lat},${lng}););out center;`,
			// Gyms & fitness
			`[out:json][timeout:12];(nwr["leisure"="fitness_centre"](around:${r},${lat},${lng});nwr["sport"="fitness"](around:${r},${lat},${lng}););out center;`,
			// Yoga & wellness studios
			`[out:json][timeout:12];(nwr["sport"="yoga"](around:${r},${lat},${lng});nwr["leisure"~"yoga"](around:${r},${lat},${lng});nwr["shop"~"health_food|organic|nutrition"](around:${r},${lat},${lng}););out center;`,
		];

		// Concept-specific extra queries — only added when the concept ISN'T covered by core 4.
		// Core 4 covers: specialty_coffee, bakery, wellness_beverage, juice_bar, full_service_restaurant,
		// fast_casual, qsr, fitness_studio (+ yoga overlap). Everything else needs an extra query.
		const CONCEPT_EXTRA_QUERIES: Record<string, string> = {
			'bar_nightlife':     `[out:json][timeout:12];(nwr["amenity"="bar"](around:${r},${lat},${lng});nwr["amenity"="pub"](around:${r},${lat},${lng});nwr["amenity"="nightclub"](around:${r},${lat},${lng}););out center;`,
			'wellness_spa':      `[out:json][timeout:12];(nwr["amenity"="spa"](around:${r},${lat},${lng});nwr["leisure"="sauna"](around:${r},${lat},${lng});nwr["shop"="beauty"](around:${r},${lat},${lng});nwr["amenity"="beauty"](around:${r},${lat},${lng}););out center;`,
			'personal_services': `[out:json][timeout:12];(nwr["shop"="hairdresser"](around:${r},${lat},${lng});nwr["shop"="beauty"](around:${r},${lat},${lng});nwr["amenity"="beauty"](around:${r},${lat},${lng}););out center;`,
			'retail':            `[out:json][timeout:12];(nwr["shop"~"clothes|boutique|gift|jewelry|books"](around:${r},${lat},${lng}););out center;`,
			'coworking':         `[out:json][timeout:12];(nwr["amenity"="coworking_space"](around:${r},${lat},${lng});nwr["office"="coworking"](around:${r},${lat},${lng}););out center;`,
			'medical_office':    `[out:json][timeout:12];(nwr["amenity"="dentist"](around:${r},${lat},${lng});nwr["amenity"="doctors"](around:${r},${lat},${lng});nwr["amenity"="clinic"](around:${r},${lat},${lng}););out center;`,
		};

		const extraQuery = CONCEPT_EXTRA_QUERIES[lower] || null;
		const queries = extraQuery ? [...coreQueries, extraQuery] : coreQueries;

		const results = await Promise.all(
			queries.map(q => overpassQuery(q))
		);

		// FIX-012: If ALL queries failed (all null), return null so the caller
		// knows competition data is unavailable — not "zero competitors".
		// If SOME failed, fall back to [] for failed queries (partial data > nothing).
		const allFailed = results.every(r => r === null);
		if (allFailed) {
			console.warn('[Overpass] All queries failed — returning null (not empty)');
			return cached?.data || null;
		}

		const [cafeRaw, restRaw, gymRaw, yogaRaw, extraRaw] = results;

		// Treat individual query failures as empty (partial failure — use what we have)
		const cafes = dedupe(processElements(cafeRaw ?? [], lat, lng, 'cafe'));
		const restaurants = dedupe(processElements(restRaw ?? [], lat, lng, 'restaurant'));
		const gyms = dedupe(processElements(gymRaw ?? [], lat, lng, 'gym'));
		const yoga = dedupe(processElements(yogaRaw ?? [], lat, lng, 'wellness'));
		const health = dedupe(processElements(yogaRaw ?? [], lat, lng, 'health'));

		// Route the extra query result into the correct amenity bucket
		let bars: CompetitorPOI[] = [];
		let wellness: CompetitorPOI[] = [];
		let retail: CompetitorPOI[] = [];
		let personal: CompetitorPOI[] = [];
		if (extraRaw && extraQuery) {
			const extraPOIs = dedupe(processElements(extraRaw, lat, lng, lower));
			switch (lower) {
				case 'bar_nightlife':     bars = extraPOIs; break;
				case 'wellness_spa':      wellness = extraPOIs; break;
				case 'personal_services': personal = extraPOIs; break;
				case 'retail':            retail = extraPOIs; break;
				case 'coworking':         /* no amenity bucket — competitors come from cafes proxy */ break;
				case 'medical_office':    /* no amenity bucket — getPrimaryCompetitors returns [] */ break;
			}
		}
		const primaryCompetitors = getPrimaryCompetitors(businessType, {
			cafes, restaurants, gyms, yoga, health, bars, wellness, retail, personal
		});

		// Ring bucketing
		const ringDists = RING_DISTANCES[businessType.toLowerCase()] || RING_DISTANCES.default;
		const rings: CompetitorRings = {
			ring1: primaryCompetitors.filter(c => c.distance <= ringDists[0]),
			ring2: primaryCompetitors.filter(c => c.distance > ringDists[0] && c.distance <= ringDists[1]),
			ring3: primaryCompetitors.filter(c => c.distance > ringDists[1] && c.distance <= ringDists[2])
		};

		// Per-ring chain/independent breakdown
		const ringStats: CompetitorRingStats = {
			ring1: computeRingStats(rings.ring1),
			ring2: computeRingStats(rings.ring2),
			ring3: computeRingStats(rings.ring3),
		};

		let chainCount = 0;
		let independentCount = 0;
		const allChainNamesSeen = new Set<string>();
		const topChains: string[] = [];
		for (const c of primaryCompetitors) {
			if (c.isChain) {
				chainCount++;
				const label = (c.brand || c.name).trim();
				if (label && label !== 'Unnamed' && !allChainNamesSeen.has(label.toLowerCase())) {
					allChainNamesSeen.add(label.toLowerCase());
					topChains.push(label);
				}
			} else {
				independentCount++;
			}
		}
		const chainDominance = primaryCompetitors.length > 0
			? Math.round((chainCount / primaryCompetitors.length) * 100) / 100
			: 0;

		// Saturation score: how crowded is this area for this business type?
		const saturationScore = computeSaturation(primaryCompetitors, businessType);

		const result: OverpassData = {
			competitors: primaryCompetitors,
			rings,
			totalCount: primaryCompetitors.length,
			chainCount,
			independentCount,
			chainDominance,
			topChains: topChains.slice(0, 15),
			ringStats,
			saturationScore,
			stations: [], // Transit handled by MTA Socrata — not Overpass
			amenities: { cafes, restaurants, gyms, yoga, health, bars, wellness, retail, personal },
			source: 'overpass',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.COMPETITORS);
		return result;
	} catch (e) {
		console.error('[Overpass] Scan error:', e);
		return cached?.data || null;
	}
}

interface OverpassElement {
	type: 'node' | 'way' | 'relation';
	lat?: number;
	lon?: number;
	center?: { lat: number; lon: number };  // present for way/relation with "out center;"
	tags?: Record<string, string>;
}

// FIX-012: Return null on query failure (timeout, HTTP error, exception).
// D13: Overpass mirror list. Falls through on 5xx/network errors.
// Skips maps.mail.ru (blocks non-Russian traffic) and heavily-loaded kumi.systems.
const OVERPASS_ENDPOINTS: readonly string[] = [
	'https://overpass-api.de/api/interpreter',       // Official — primary
	'https://overpass.kumi.systems/api/interpreter', // Germany mirror
	'https://overpass.private.coffee/api/interpreter', // Community mirror
	'https://overpass.osm.jp/api/interpreter',       // Japan mirror (works from US)
];

// Return [] only on genuine empty result (Overpass responded OK with no elements).
// Callers use null to distinguish "data unavailable" from "no competitors found".
async function overpassQuery(query: string): Promise<OverpassElement[] | null> {
	const { resilientFetch } = await import('./retry');
	const encoded = encodeURIComponent(query);

	// D13: Try each endpoint in order on 5xx / network failure. First success wins.
	// Keep per-endpoint timeout short (8s) since we have fallbacks; total budget ~24s.
	for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
		const endpoint = OVERPASS_ENDPOINTS[i];
		try {
			const res = await resilientFetch(
				`${endpoint}?data=${encoded}`,
				{
					timeout: i === 0 ? 12000 : 8000,  // primary gets more time
					maxRetries: i === 0 ? 1 : 0,      // retries only on primary
					headers: { 'User-Agent': SITE_CONFIG.userAgent },
					label: `Overpass[${i}]`
				}
			);

			if (res.ok) {
				const data = await res.json();
				if (i > 0) console.info(`[Overpass] Served by fallback endpoint ${endpoint}`);
				return data.elements || [];
			}

			// 4xx (except 429): client error, don't try other mirrors — they'll likely fail the same way
			if (res.status >= 400 && res.status < 500 && res.status !== 429) {
				console.error(`[Overpass] HTTP ${res.status} on ${endpoint} — not retrying other mirrors`);
				return null;
			}

			// 5xx or 429: try next mirror
			console.warn(`[Overpass] HTTP ${res.status} on ${endpoint} — trying next mirror`);
		} catch (e) {
			// Network error, timeout, JSON parse: try next mirror
			console.warn(`[Overpass] ${endpoint} failed: ${e instanceof Error ? e.message : e} — trying next`);
		}
	}

	console.error('[Overpass] All mirrors failed — data unavailable');
	return null;
}

function processElements(elements: OverpassElement[], originLat: number, originLng: number, type: string): CompetitorPOI[] {
	return elements
		.map(e => {
			// Nodes have lat/lon directly; ways/relations have center.lat/center.lon
			const eLat = e.lat ?? e.center?.lat;
			const eLon = e.lon ?? e.center?.lon;
			if (!eLat || !eLon) return null;

			return {
				name: e.tags?.name || e.tags?.brand || 'Unnamed',
				brand: e.tags?.brand,
				lat: eLat,
				lng: eLon,
				distance: haversineKm(originLat, originLng, eLat, eLon),
				type,
				isChain: isKnownChain(e.tags?.name || '', e.tags?.brand || ''),
				tags: e.tags || {}
			};
		})
		.filter((p): p is CompetitorPOI => p !== null)
		.sort((a, b) => a.distance - b.distance);
}

function dedupe(pois: CompetitorPOI[]): CompetitorPOI[] {
	const seen = new Set<string>();
	return pois.filter(p => {
		const key = `${p.name.toLowerCase()}|${p.lat.toFixed(4)}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * Station-specific deduplication: subway entrances share a station name,
 * so we group by name only (not coordinates). Keeps the first (closest) entry
 * for each unique station name, filtering out "Unnamed" duplicates by proximity.
 */
function dedupeStations(pois: CompetitorPOI[]): CompetitorPOI[] {
	const seen = new Set<string>();
	const unnamed: CompetitorPOI[] = [];
	const named: CompetitorPOI[] = [];

	for (const p of pois) {
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

	// For unnamed entries, deduplicate by proximity (within 100m = same station)
	const keptUnnamed: CompetitorPOI[] = [];
	for (const u of unnamed) {
		const tooClose = [...named, ...keptUnnamed].some(
			s => haversineKm(s.lat, s.lng, u.lat, u.lng) < 0.1
		);
		if (!tooClose) keptUnnamed.push(u);
	}

	return [...named, ...keptUnnamed].sort((a, b) => a.distance - b.distance);
}

/**
 * Select the right competitor bucket based on canonical concept key.
 * Every concept from businessTypeNormalizer.ts MUST have a case here.
 */
function getPrimaryCompetitors(
	businessType: string,
	amenities: { cafes: CompetitorPOI[]; restaurants: CompetitorPOI[]; gyms: CompetitorPOI[]; yoga: CompetitorPOI[]; health: CompetitorPOI[]; bars: CompetitorPOI[]; wellness: CompetitorPOI[]; retail: CompetitorPOI[]; personal: CompetitorPOI[] }
): CompetitorPOI[] {
	const lower = businessType.toLowerCase();

	// ── Exact canonical key matching first ──
	switch (lower) {
		case 'specialty_coffee':     return [...amenities.cafes];
		case 'bakery':               return [...amenities.cafes];  // bakeries sit in cafe bucket in OSM
		case 'wellness_beverage':    return [...amenities.cafes, ...amenities.health];
		case 'juice_bar':            return [...amenities.cafes, ...amenities.health];
		case 'full_service_restaurant': return [...amenities.restaurants];
		case 'fast_casual':          return [...amenities.restaurants, ...amenities.cafes];
		case 'qsr':                  return [...amenities.restaurants];
		case 'fitness_studio':       return [...amenities.gyms, ...amenities.yoga];
		case 'bar_nightlife':        return [...amenities.bars];
		case 'wellness_spa':         return [...amenities.wellness, ...amenities.yoga, ...amenities.personal];
		case 'personal_services':    return [...amenities.personal, ...amenities.wellness];
		case 'retail':               return [...amenities.retail];
		case 'coworking':            return [...amenities.cafes];  // coworking not well-tagged in OSM; cafes are proxy
		case 'medical_office':       return [];  // medical competitors not available from OSM
	}

	// ── Fuzzy fallback for non-canonical strings ──
	if (lower.includes('coffee') || lower.includes('cafe')) return [...amenities.cafes];
	if (lower.includes('restaurant') || lower.includes('food')) return [...amenities.restaurants, ...amenities.cafes];
	if (lower.includes('fitness') || lower.includes('gym')) return [...amenities.gyms, ...amenities.yoga];
	if (lower.includes('bar') || lower.includes('nightlife')) return [...amenities.bars];
	if (lower.includes('spa') || lower.includes('wellness')) return [...amenities.wellness, ...amenities.yoga];
	if (lower.includes('retail') || lower.includes('boutique')) return [...amenities.retail];
	if (lower.includes('salon') || lower.includes('barber') || lower.includes('personal')) return [...amenities.personal];
	if (lower.includes('bakery') || lower.includes('pastry')) return [...amenities.cafes];

	return [];  // unknown concept — return empty, not cafes
}

function computeSaturation(competitors: CompetitorPOI[], businessType: string): number {
	// Saturation thresholds vary by business type — [low, high]
	const thresholds: Record<string, [number, number]> = {
		specialty_coffee: [5, 20],
		bakery: [3, 15],
		wellness_beverage: [3, 12],
		juice_bar: [3, 12],
		full_service_restaurant: [10, 40],
		fast_casual: [10, 40],
		qsr: [10, 40],
		fitness_studio: [3, 12],
		bar_nightlife: [5, 20],
		wellness_spa: [2, 8],
		personal_services: [3, 15],
		retail: [5, 25],
		coworking: [2, 8],
		medical_office: [3, 12],
		// Legacy fuzzy keys
		cafe: [5, 20],
		coffee: [5, 20],
		restaurant: [10, 40],
		fitness: [3, 12],
		gym: [3, 12],
		default: [5, 20]
	};

	const [low, high] = thresholds[businessType.toLowerCase()] || thresholds.default;
	const count = competitors.length;

	if (count <= low) return Math.round((count / low) * 40);           // 0-40
	if (count <= high) return 40 + Math.round(((count - low) / (high - low)) * 40); // 40-80
	return Math.min(100, 80 + Math.round(((count - high) / high) * 20)); // 80-100
}

function isKnownChain(name: string, brand: string): boolean {
	const lower = (name + ' ' + brand).toLowerCase();
	for (const chain of CHAIN_NAMES) {
		if (lower.includes(chain)) return true;
	}
	return false;
}

/**
 * Compute chain vs independent stats for a single competitor ring.
 * chainDominance = chains / total (0 when the ring is empty).
 * topChains lists unique brand/name values for chains, in distance order.
 */
function computeRingStats(ring: CompetitorPOI[]): RingChainStats {
	let chainCount = 0;
	let independentCount = 0;
	const chainNamesSeen = new Set<string>();
	const topChains: string[] = [];

	for (const c of ring) {
		if (c.isChain) {
			chainCount++;
			const label = (c.brand || c.name).trim();
			if (label && label !== 'Unnamed' && !chainNamesSeen.has(label.toLowerCase())) {
				chainNamesSeen.add(label.toLowerCase());
				topChains.push(label);
			}
		} else {
			independentCount++;
		}
	}

	const total = ring.length;
	return {
		chainCount,
		independentCount,
		total,
		chainDominance: total > 0 ? Math.round((chainCount / total) * 100) / 100 : 0,
		topChains: topChains.slice(0, 10),
	};
}

/**
 * Build OverpassData from Foursquare + Google Places when Overpass is unavailable.
 * This is the primary competitor source — Overpass is the fallback.
 *
 * Merges venues from both APIs, deduplicates by name+proximity,
 * classifies into rings, and computes saturation scores.
 */
export function buildCompetitorsFromSources(
	lat: number,
	lng: number,
	businessType: string,
	foursquareData: { venues: Array<{ name: string; distance: number; isChain: boolean; primaryCategory: string; chainName: string | null; categories: Array<{ name: string }> }>; directCompetitors: Array<{ name: string; distance: number; isChain: boolean; primaryCategory: string; chainName: string | null; categories: Array<{ name: string }> }> } | null,
	placesData: { places: Array<{ name: string; lat: number; lng: number; distance: number; types: string[]; rating: number; reviewCount: number }> } | null,
	yelpData?: { businesses: Array<{ name: string; lat: number; lng: number; distance: number; isChain: boolean; primaryCategory: string; categories: Array<{ alias: string; title: string }> }> } | null
): OverpassData | null {
	const allPOIs: CompetitorPOI[] = [];
	const seen = new Set<string>();

	// Helper to add a POI with deduplication
	function addPOI(poi: CompetitorPOI) {
		// Dedupe by normalized name + location.
		// For coord-approximate sources (Foursquare — all pins at address centroid),
		// use distance instead of lat/lng so two venues at different distances
		// are treated as distinct even when coords are identical.
		const locPart = poi.tags?.coordsApprox === 'true'
			? poi.distance.toFixed(3)
			: `${poi.lat.toFixed(3)},${poi.lng.toFixed(3)}`;
		const key = `${poi.name.toLowerCase().replace(/[^a-z0-9]/g, '')}|${locPart}`;
		if (seen.has(key)) return;
		seen.add(key);
		allPOIs.push(poi);
	}

	// 1. Foursquare direct competitors — already category-filtered by Foursquare's
	// search API. Treat ALL as primary competitors to avoid double-filtering.
	// Use the mapped type for amenity bucketing but force-include in the primary set.
	const forcedPrimaryPOIs: CompetitorPOI[] = [];

	if (foursquareData?.directCompetitors) {
		for (const v of foursquareData.directCompetitors) {
			const mappedType = mapFSQCategoryToType(v.primaryCategory, businessType);
			// FSQ directCompetitors are already category-filtered by the Foursquare search API.
			// If our mapper still returns 'other' (unrecognized FSQ category string), fall back
			// to a concept-appropriate bucket type so the amenity filter picks it up.
			// Never coerce to businessType — 'specialty_coffee' won't match bucket filters.
			const resolvedType = mappedType !== 'other' ? mappedType : getFallbackType(businessType);
			const poi: CompetitorPOI = {
				name: v.name,
				brand: v.chainName || undefined,
				lat: lat, // approx — Foursquare doesn't return coordinates; use address centroid
				lng: lng,
				distance: v.distance / 1000, // meters → km
				type: resolvedType,
				isChain: v.isChain,
				tags: { source: 'foursquare', coordsApprox: 'true', category: v.primaryCategory, directCompetitor: 'true' }
			};
			addPOI(poi);
			forcedPrimaryPOIs.push(poi);
		}
	}

	// 2. Foursquare general venues (broader ecosystem)
	if (foursquareData?.venues) {
		for (const v of foursquareData.venues) {
			const type = mapFSQCategoryToType(v.primaryCategory, businessType);
			// Only include venues that match competitor-relevant categories
			if (isCompetitorCategory(type, businessType)) {
				addPOI({
					name: v.name,
					brand: v.chainName || undefined,
					lat: lat, // approx — Foursquare doesn't return coordinates; use address centroid
					lng: lng,
					distance: v.distance / 1000,
					type,
					isChain: v.isChain,
					tags: { source: 'foursquare', coordsApprox: 'true', category: v.primaryCategory }
				});
			}
		}
	}

	// 3. Google Places (has lat/lng and ratings)
	if (placesData?.places) {
		for (const p of placesData.places) {
			const type = mapGoogleTypeToCompetitorType(p.types, businessType);
			if (type) {
				addPOI({
					name: p.name,
					lat: p.lat,
					lng: p.lng,
					distance: p.distance / 1000, // meters → km
					type,
					isChain: isKnownChain(p.name, ''),
					tags: { source: 'google-places', rating: String(p.rating), reviews: String(p.reviewCount) }
				});
			}
		}
	}

	// 4. Yelp businesses (ratings, reviews, price levels)
	if (yelpData?.businesses) {
		for (const b of yelpData.businesses) {
			const type = mapYelpCategoryToType(b.categories, businessType);
			if (type && isCompetitorCategory(type, businessType)) {
				addPOI({
					name: b.name,
					lat: b.lat,
					lng: b.lng,
					distance: b.distance / 1000, // meters → km
					type,
					isChain: b.isChain,
					tags: { source: 'yelp', category: b.primaryCategory }
				});
			}
		}
	}

	if (allPOIs.length === 0) {
		console.warn('[buildCompetitorsFromSources] No POIs after filtering. FSQ direct:', foursquareData?.directCompetitors?.length ?? 0, 'FSQ venues:', foursquareData?.venues?.length ?? 0, 'Places:', placesData?.places?.length ?? 0, 'Yelp:', yelpData?.businesses?.length ?? 0);
		return null;
	}

	// Sort by distance
	allPOIs.sort((a, b) => a.distance - b.distance);

	// Categorize into amenity buckets (covers all 13 RE² concepts)
	const cafes    = allPOIs.filter(p => p.type === 'cafe' || p.type === 'coffee');
	const restaurants = allPOIs.filter(p => p.type === 'restaurant' || p.type === 'fast_food');
	const gyms     = allPOIs.filter(p => p.type === 'gym' || p.type === 'fitness');
	const yoga     = allPOIs.filter(p => p.type === 'yoga');
	const health   = allPOIs.filter(p => p.type === 'health');
	const bars     = allPOIs.filter(p => p.type === 'bar');
	const wellness = allPOIs.filter(p => p.type === 'wellness');
	const retail   = allPOIs.filter(p => p.type === 'retail');
	const personal = allPOIs.filter(p => p.type === 'personal_services');

	// Get primary competitors for this business type, plus any forced from Foursquare directCompetitors
	const categoryFiltered = getPrimaryCompetitors(businessType, {
		cafes, restaurants, gyms, yoga, health, bars, wellness, retail, personal
	});
	// Merge in Foursquare directCompetitors that weren't already captured by category filtering
	const primaryNames = new Set(categoryFiltered.map(c => c.name.toLowerCase()));
	const extra = forcedPrimaryPOIs.filter(p => !primaryNames.has(p.name.toLowerCase()));
	const primaryCompetitors = [...categoryFiltered, ...extra].sort((a, b) => a.distance - b.distance);

	// Ring bucketing
	const ringDists = RING_DISTANCES[businessType.toLowerCase()] || RING_DISTANCES.default;
	const rings: CompetitorRings = {
		ring1: primaryCompetitors.filter(c => c.distance <= ringDists[0]),
		ring2: primaryCompetitors.filter(c => c.distance > ringDists[0] && c.distance <= ringDists[1]),
		ring3: primaryCompetitors.filter(c => c.distance > ringDists[1] && c.distance <= ringDists[2])
	};

	// Per-ring chain/independent breakdown
	const ringStats: CompetitorRingStats = {
		ring1: computeRingStats(rings.ring1),
		ring2: computeRingStats(rings.ring2),
		ring3: computeRingStats(rings.ring3),
	};

	let chainCount = 0;
	let independentCount = 0;
	const bcsChainNamesSeen = new Set<string>();
	const topChains: string[] = [];
	for (const c of primaryCompetitors) {
		if (c.isChain) {
			chainCount++;
			const label = (c.brand || c.name).trim();
			if (label && label !== 'Unnamed' && !bcsChainNamesSeen.has(label.toLowerCase())) {
				bcsChainNamesSeen.add(label.toLowerCase());
				topChains.push(label);
			}
		} else {
			independentCount++;
		}
	}
	const chainDominance = primaryCompetitors.length > 0
		? Math.round((chainCount / primaryCompetitors.length) * 100) / 100
		: 0;

	const saturationScore = computeSaturation(primaryCompetitors, businessType);

	return {
		competitors: primaryCompetitors,
		rings,
		totalCount: primaryCompetitors.length,
		chainCount,
		independentCount,
		chainDominance,
		topChains: topChains.slice(0, 15),
		ringStats,
		saturationScore,
		stations: [], // No transit data from Foursquare/Places — MTA handles this
		amenities: { cafes, restaurants, gyms, yoga, health, bars, wellness, retail, personal },
		source: 'overpass' as const, // Keep type compatible; real source in tags
		fetchedAt: new Date().toISOString()
	};
}

/**
 * Map Foursquare category names to our competitor types.
 */
function mapFSQCategoryToType(category: string, _businessType: string): string {
	const lower = category.toLowerCase();
	// Coffee — specialty terms first to avoid falling to 'other'
	if (lower.includes('specialty') && (lower.includes('coffee') || lower.includes('cafe'))) return 'cafe';
	if (lower.includes('espresso') || lower.includes('latte') || lower.includes('matcha') || lower.includes('boba') || lower.includes('bubble tea')) return 'cafe';
	if (lower.includes('coffee') || lower.includes('café') || lower.includes('cafe') || lower.includes('tea')) return 'cafe';
	// Bakery / pastry (maps to cafe bucket)
	if (lower.includes('bakery') || lower.includes('pastry') || lower.includes('patisserie') || lower.includes('dessert') || lower.includes('donut') || lower.includes('bagel') || lower.includes('croissant')) return 'cafe';
	// Restaurant types
	if (lower.includes('fine dining') || lower.includes('steakhouse') || lower.includes('sushi') || lower.includes('seafood') || lower.includes('dim sum') || lower.includes('tasting menu')) return 'restaurant';
	if (lower.includes('restaurant') || lower.includes('diner') || lower.includes('bistro') || lower.includes('eatery') || lower.includes('brasserie')) return 'restaurant';
	if (lower.includes('fast food') || lower.includes('quick service') || lower.includes('burger') || lower.includes('pizza') || lower.includes('sandwich') || lower.includes('taco') || lower.includes('kebab')) return 'fast_food';
	// Fitness
	if (lower.includes('gym') || lower.includes('fitness') || lower.includes('crossfit') || lower.includes('pilates') || lower.includes('spin studio') || lower.includes('barre') || lower.includes('boxing')) return 'gym';
	if (lower.includes('yoga') || lower.includes('meditation') || lower.includes('dance studio')) return 'yoga';
	// Wellness / spa
	if (lower.includes('spa') || lower.includes('massage') || lower.includes('float') || lower.includes('facial') || lower.includes('med spa') || lower.includes('medspa') || lower.includes('waxing') || lower.includes('cryotherapy')) return 'wellness';
	// Health / juice
	if (lower.includes('juice') || lower.includes('smoothie') || lower.includes('acai') || lower.includes('health food') || lower.includes('organic')) return 'health';
	// Bar / nightlife
	if (lower.includes('nightclub') || lower.includes('speakeasy') || lower.includes('cocktail bar') || lower.includes('wine bar') || lower.includes('taproom')) return 'bar';
	if (lower.includes('bar') || lower.includes('pub') || lower.includes('lounge') || lower.includes('brewery')) return 'bar';
	// Retail
	if (lower.includes('clothing') || lower.includes('apparel') || lower.includes('fashion') || lower.includes('boutique') || lower.includes('jewelry') || lower.includes('gift shop') || lower.includes('accessories')) return 'retail';
	if (lower.includes('bookstore') || lower.includes('home goods') || lower.includes('specialty store') || lower.includes('retail')) return 'retail';
	// Personal services
	if (lower.includes('salon') || lower.includes('barbershop') || lower.includes('barber') || lower.includes('nail') || lower.includes('lash') || lower.includes('eyebrow') || lower.includes('blow dry') || lower.includes('tattoo')) return 'personal_services';
	// Coworking
	if (lower.includes('coworking') || lower.includes('co-working') || lower.includes('shared office') || lower.includes('business center')) return 'coworking';
	// Medical / dental
	if (lower.includes('dentist') || lower.includes('dental') || lower.includes('medical') || lower.includes('doctor') || lower.includes('clinic') || lower.includes('orthodont')) return 'medical';
	return 'other';
}

/**
 * Map Yelp categories to our competitor types.
 */
function mapYelpCategoryToType(categories: Array<{ alias: string; title: string }>, _businessType: string): string {
	for (const cat of categories) {
		const alias = cat.alias.toLowerCase();
		const title = cat.title.toLowerCase();
		const s = alias + ' ' + title;
		// Coffee / cafe / bakery
		if (s.includes('coffee') || s.includes('cafe') || s.includes('tea') || s.includes('bakeries') || s.includes('pastries') || s.includes('donuts') || s.includes('bagels')) return 'cafe';
		// Restaurant
		if (s.includes('restaurant') || s.includes('burgers') || s.includes('pizza') || s.includes('sandwiches') || s.includes('sushi') || s.includes('steak') || s.includes('seafood') || s.includes('tacos')) return 'restaurant';
		if (s.includes('food') || s.includes('diner') || s.includes('bistro')) return 'restaurant';
		// Fast food
		if (s.includes('fast_food') || s.includes('hotdogs') || s.includes('chicken_wings') || s.includes('kebab')) return 'fast_food';
		// Fitness
		if (s.includes('gym') || s.includes('fitness') || s.includes('yoga') || s.includes('pilates') || s.includes('barre') || s.includes('spin') || s.includes('crossfit')) return 'gym';
		// Wellness / spa
		if (s.includes('spa') || s.includes('massage') || s.includes('facial') || s.includes('float') || s.includes('cryotherapy')) return 'wellness';
		// Bar / nightlife
		if (s.includes('bar') || s.includes('pub') || s.includes('nightlife') || s.includes('brewery') || s.includes('nightclub') || s.includes('cocktailbars') || s.includes('wine_bars')) return 'bar';
		// Health / juice
		if (s.includes('juice') || s.includes('smoothie') || s.includes('health') || s.includes('acai')) return 'health';
		// Retail
		if (s.includes('clothing') || s.includes('shopping') || s.includes('accessories') || s.includes('jewelry') || s.includes('bookstores') || s.includes('gifts')) return 'retail';
		// Personal services
		if (s.includes('salon') || s.includes('barbers') || s.includes('nails') || s.includes('lashes') || s.includes('tattoo') || s.includes('blowdry')) return 'personal_services';
	}
	return 'other';
}

/**
 * Map Google Places types to our competitor types.
 * Returns null if the place isn't a relevant competitor.
 */
function mapGoogleTypeToCompetitorType(types: string[], businessType: string): string | null {
	const typeSet = new Set(types.map(t => t.toLowerCase()));
	if (typeSet.has('cafe') || typeSet.has('coffee_shop')) return 'cafe';
	if (typeSet.has('restaurant') || typeSet.has('meal_delivery') || typeSet.has('meal_takeaway')) return 'restaurant';
	if (typeSet.has('gym') || typeSet.has('health')) return 'gym';
	if (typeSet.has('bar') || typeSet.has('night_club')) return 'bar';
	if (typeSet.has('bakery')) return 'cafe';
	// For cafe business type, include food establishments
	if (businessType.toLowerCase().includes('cafe') || businessType.toLowerCase().includes('coffee')) {
		if (typeSet.has('food') || typeSet.has('store')) return null; // too broad
	}
	return null;
}

/**
 * Check if a competitor type is relevant for the given business type.
 */
/**
 * Concept-aware fallback type when FSQ/Yelp category string is unrecognized.
 * Maps canonical concept keys → the bucket type competitors should land in.
 */
function getFallbackType(businessType: string): string {
	const lower = businessType.toLowerCase();
	if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('kiosk') || lower.includes('bakery') || lower.includes('wellness_beverage') || lower.includes('juice_bar')) return 'cafe';
	if (lower.includes('restaurant') || lower.includes('fast_casual') || lower.includes('qsr')) return 'restaurant';
	if (lower.includes('fitness') || lower.includes('gym')) return 'gym';
	if (lower.includes('bar') || lower.includes('nightlife')) return 'bar';
	if (lower.includes('wellness') || lower.includes('spa')) return 'wellness';
	if (lower.includes('retail')) return 'retail';
	if (lower.includes('personal')) return 'personal_services';
	if (lower.includes('medical') || lower.includes('dental')) return 'medical';
	return 'cafe'; // safe default
}

function isCompetitorCategory(type: string, businessType: string): boolean {
	const lower = businessType.toLowerCase();
	// Coffee / café / kiosk / wellness beverage / juice bar / bakery
	if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('kiosk') || lower.includes('wellness_beverage') || lower.includes('juice_bar') || lower.includes('bakery')) {
		return ['cafe', 'coffee', 'health'].includes(type);
	}
	// Restaurant (all types)
	if (lower.includes('restaurant') || lower.includes('fast_casual') || lower.includes('qsr') || lower.includes('food')) {
		return ['cafe', 'restaurant', 'fast_food'].includes(type);
	}
	// Fitness
	if (lower.includes('fitness') || lower.includes('gym')) {
		return ['gym', 'fitness', 'yoga', 'wellness'].includes(type);
	}
	// Bar / nightlife
	if (lower.includes('bar') || lower.includes('nightlife')) {
		return ['bar'].includes(type);
	}
	// Wellness / spa
	if (lower.includes('wellness_spa') || lower.includes('spa')) {
		return ['wellness', 'yoga', 'health'].includes(type);
	}
	// Retail
	if (lower.includes('retail')) {
		return ['retail'].includes(type);
	}
	// Personal services
	if (lower.includes('personal') || lower.includes('personal_services')) {
		return ['personal_services'].includes(type);
	}
	// Coworking — no venue competitors relevant
	if (lower.includes('coworking')) return false;
	// Medical / dental
	if (lower.includes('medical') || lower.includes('dental')) {
		return ['medical'].includes(type);
	}
	return ['cafe', 'restaurant'].includes(type);
}

// 04.19.2026 13:35 Score Consolidation — haversineKm removed. Imported from geo-math.ts above.
