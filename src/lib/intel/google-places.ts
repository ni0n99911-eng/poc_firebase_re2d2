import { SITE_CONFIG } from '$lib/modules';

/**
 * Google Places API client (Nearby Search).
 *
 * Provides real business data:
 * - Competitor names, ratings, review counts
 * - Price levels
 * - Operating hours
 * - Business types and categories
 *
 * Requires GOOGLE_PLACES_API_KEY env var.
 * Pricing: $32 per 1000 Nearby Search requests.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/nearby-search
 *
 * Falls back to Overpass data when no API key is available.
 */

import { IntelCache, intelCache, TTL } from './cache';
import { env } from '$env/dynamic/private';
// 04.19.2026 13:35 Score Consolidation — haversineMeters imported from canonical geo-math.ts
import { haversineMeters } from '$lib/intel/scoring/geo-math';

export interface PlaceResult {
	name: string;
	address: string;
	lat: number;
	lng: number;
	rating: number;        // 1.0 - 5.0
	reviewCount: number;
	priceLevel: number;    // 0-4 (0 = free, 4 = very expensive)
	types: string[];
	isOpen?: boolean;
	distance: number;      // meters from search point
}

export interface PlacesData {
	places: PlaceResult[];
	totalNearby: number;
	avgRating: number;
	avgPriceLevel: number;
	avgReviewCount: number;
	chainCount: number;        // known chain brands
	independentCount: number;
	topRated: PlaceResult[];   // top 5 by rating
	source: 'google-places' | 'overpass-fallback';
	fetchedAt: string;
}

// Raw response shapes from external APIs
interface GooglePlaceRaw {
	name?: string;
	vicinity?: string;
	geometry?: { location?: { lat?: number; lng?: number } };
	rating?: number;
	user_ratings_total?: number;
	price_level?: number;
	types?: string[];
	opening_hours?: { open_now?: boolean };
}

interface OverpassElement {
	lat: number;
	lon: number;
	tags?: Record<string, string>;
}

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

// Known chains for chain detection — covers all 14 concepts
const KNOWN_CHAINS = new Set([
	// Coffee
	'starbucks', 'dunkin', "dunkin'", 'peet', "peet's", 'blue bottle',
	'gregorys', "gregory's", 'joe coffee', 'think coffee', 'la colombe',
	'bluestone lane', 'philz', 'intelligentsia', 'counter culture',
	'blank street', 'birch coffee', 'ground central', 'city of saints',
	'felix roasting',
	// QSR / Fast casual / Restaurants
	'sweetgreen', 'chipotle', 'shake shack', 'panera', "mcdonald's",
	'mcdonalds', 'subway', 'chick-fil-a', 'wendys', "wendy's",
	'burger king', 'popeyes', "domino's", 'pizza hut', 'taco bell',
	'five guys', 'wingstop', 'cava', 'dig', 'just salad',
	// Fitness
	'equinox', 'planet fitness', 'orangetheory', 'soulcycle',
	'blink fitness', 'crunch', 'barry', "barry's", 'lifetime',
	'solidcore', 'rumble', 'y7 studio', 'peloton',
	// Bars
	'tgif', "applebee's", 'buffalo wild wings', "dave & buster",
	// Spa / Wellness
	'hand & stone', 'massage envy', 'exhale', 'aire ancient baths',
	'qc spa', 'russian & turkish', 'dry bar', 'drybar',
	// Personal services / Salon
	'supercuts', 'great clips', 'fantastic sams', 'sport clips',
	'european wax center', 'benefit brow bar', 'ulta', 'sephora',
	'glosslab', 'paintbox', 'tenoverten', 'chillhouse',
	// Retail
	'h&m', 'zara', 'uniqlo', 'gap', 'old navy', 'forever 21',
	'urban outfitters', 'anthropologie', 'free people', 'lululemon',
	'nike', 'adidas', 'foot locker', 'nordstrom', 'tj maxx', 'marshalls',
	// Bakery
	'paris baguette', 'tous les jours', 'panera', 'au bon pain',
	'le pain quotidien', 'magnolia bakery', "levain",
	// Juice / Wellness beverage
	'jamba', 'jamba juice', 'juice press', 'pressed juicery',
	'kung fu tea', 'gong cha', 'tiger sugar', 'boba guys',
	// Coworking
	'wework', 'regus', 'spaces', 'industrious',
	// Medical / Dental
	'aspen dental', 'citymd', 'carepoint', 'one medical'
]);

/**
 * Fetch nearby places from Google Places API.
 * businessType maps to Places API type parameter.
 */
export async function fetchNearbyPlaces(
	lat: number,
	lng: number,
	businessType: string = 'cafe',
	radiusMeters: number = 500
): Promise<PlacesData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, `places-${businessType}`);
	const cached = await intelCache.getAsync<PlacesData>(cacheKey);
	if (cached?.fresh) return cached.data;

	const apiKey = env.GOOGLE_PLACES_API_KEY;

	if (apiKey) {
		console.log('[Places] Using Google Places API (key starts with:', apiKey.substring(0, 8) + '...)');
		try {
			const result = await fetchFromGooglePlaces(lat, lng, businessType, radiusMeters, apiKey, cacheKey, cached?.data);
			console.log('[Places] Google API returned:', result ? `${result.totalNearby} places` : 'null');
			// If Google returned null (e.g. REQUEST_DENIED due to referrer restrictions), fall back to Overpass
			if (!result) {
				console.warn('[Places] Google API returned null — falling back to Overpass');
				return cached?.data || await fetchFromOverpass(lat, lng, businessType, radiusMeters, cacheKey);
			}
			return result;
		} catch (e) {
			console.error('[Places] Google API error:', e);
			return cached?.data || await fetchFromOverpass(lat, lng, businessType, radiusMeters, cacheKey);
		}
	}

	// No API key — fall back to Overpass
	console.warn('[Places] No GOOGLE_PLACES_API_KEY — falling back to Overpass');
	return cached?.data || await fetchFromOverpass(lat, lng, businessType, radiusMeters, cacheKey);
}

async function fetchFromGooglePlaces(
	lat: number,
	lng: number,
	businessType: string,
	radiusMeters: number,
	apiKey: string,
	cacheKey: string,
	staleData?: PlacesData | null
): Promise<PlacesData | null> {
	const placeType = mapBusinessTypeToPlacesType(businessType);

	// B3-2.4: bar_nightlife needs to query BOTH 'bar' and 'night_club' Google types.
	// Previously only 'bar' was queried, leaving dense nightlife corridors (e.g. 105
	// Rivington in LES) with zero competitors when they actually have 40+ clubs within
	// 300m. Each Google Places nearbysearch accepts only one type, so fan out.
	const extraTypes: string[] = [];
	const lowerConcept = businessType.toLowerCase();
	if (lowerConcept === 'bar_nightlife' || lowerConcept.includes('nightlife') || lowerConcept.includes('nightclub')) {
		extraTypes.push('night_club');
	}
	const typesToQuery = [placeType, ...extraTypes];

	const { resilientFetch } = await import('./retry');
	const allResults: GooglePlaceRaw[] = [];
	const seenPlaceIds = new Set<string>();

	for (const t of typesToQuery) {
		const params = new URLSearchParams({
			location: `${lat},${lng}`,
			radius: radiusMeters.toString(),
			type: t,
			key: apiKey
		});

		console.log('[Places] Fetching:', `${PLACES_BASE}?location=${lat},${lng}&radius=${radiusMeters}&type=${t}`);
		const res = await resilientFetch(`${PLACES_BASE}?${params}`, {
			timeout: 12000,
			label: `GooglePlaces:${t}`
		});

		console.log(`[Places] Google API response status for type=${t}:`, res.status);
		if (!res.ok) {
			console.error(`[Places] Google API HTTP error for type=${t}:`, res.status);
			// Partial failure — continue; return what we have if at least one type succeeded.
			continue;
		}

		const data = await res.json();
		console.log(`[Places] Google API body status for type=${t}:`, data.status, '| error:', data.error_message || 'none');

		if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
			console.error(`[Places] Google API status for type=${t}:`, data.status, '| error:', data.error_message);
			continue;
		}

		const results: GooglePlaceRaw[] = data.results || [];
		// Dedupe by place_id across type queries — a place tagged bar+night_club
		// would otherwise double-count in bar_nightlife competition density.
		for (const r of results) {
			const id = (r as { place_id?: string }).place_id || '';
			if (id && seenPlaceIds.has(id)) continue;
			if (id) seenPlaceIds.add(id);
			allResults.push(r);
		}
	}

	// All queries failed — return stale or null
	if (allResults.length === 0 && typesToQuery.length > 0) {
		// Check whether every type actually failed vs all returned ZERO_RESULTS.
		// We can't distinguish without more state; treat empty as legitimate ZERO.
	}

	console.log('[Places] Got', allResults.length, 'combined place results across types:', typesToQuery.join(','));
	const places = allResults.map((p) => parsePlaceResult(p, lat, lng));

	const result = aggregatePlaces(places, 'google-places');
	intelCache.set(cacheKey, result, TTL.PLACES);
	return result;
}

/**
 * Fallback: use Overpass API to get POI data when no Google key is available.
 * Less data (no ratings/reviews), but free and unlimited.
 */
async function fetchFromOverpass(
	lat: number,
	lng: number,
	businessType: string,
	radiusMeters: number,
	cacheKey: string
): Promise<PlacesData | null> {
	try {
		const overpassFilters = mapBusinessTypeToOverpass(businessType);
		const query = `[out:json][timeout:12];(${overpassFilters.map(f =>
			`nwr[${f}](around:${radiusMeters},${lat},${lng});`
		).join('')});out center;`;

		const { resilientFetch } = await import('./retry');
		const res = await resilientFetch(
			`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
			{
				timeout: 15000,
				label: 'GooglePlaces',
				headers: { 'User-Agent': SITE_CONFIG.userAgent }
			}
		);

		if (!res.ok) return null;
		const data = await res.json();

		const seen = new Set<string>();
		const rawElements = (data.elements || []) as Array<OverpassElement & { center?: { lat: number; lon: number } }>;
		const places: PlaceResult[] = rawElements
			.map((e) => {
				// Nodes have lat/lon directly; ways/relations use center from "out center;"
				const eLat = e.lat ?? e.center?.lat;
				const eLon = e.lon ?? e.center?.lon;
				if (!eLat || !eLon) return null;
				return { tags: e.tags, lat: eLat, lon: eLon };
			})
			.filter((e): e is { tags?: Record<string, string>; lat: number; lon: number } => {
				if (!e) return false;
				const key = (e.tags?.name || '') + e.lat;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.map((e) => ({
				name: e.tags?.name || e.tags?.brand || 'Unnamed',
				address: e.tags?.['addr:street'] ? `${e.tags['addr:housenumber'] || ''} ${e.tags['addr:street']}`.trim() : '',
				lat: e.lat,
				lng: e.lon,
				rating: 0,
				reviewCount: 0,
				priceLevel: 0,
				types: [e.tags?.amenity || e.tags?.shop || businessType].filter(Boolean),
				distance: haversineMeters(lat, lng, e.lat, e.lon)
			}))
			.sort((a: PlaceResult, b: PlaceResult) => a.distance - b.distance);

		const result = aggregatePlaces(places, 'overpass-fallback');
		intelCache.set(cacheKey, result, TTL.PLACES);
		return result;
	} catch (e) {
		console.error('[Places] Overpass fallback error:', e);
		return null;
	}
}

function aggregatePlaces(places: PlaceResult[], source: 'google-places' | 'overpass-fallback'): PlacesData {
	const withRatings = places.filter(p => p.rating > 0);
	const avgRating = withRatings.length > 0
		? +(withRatings.reduce((s, p) => s + p.rating, 0) / withRatings.length).toFixed(1)
		: 0;
	const avgPriceLevel = withRatings.length > 0
		? +(withRatings.reduce((s, p) => s + p.priceLevel, 0) / withRatings.length).toFixed(1)
		: 0;
	const avgReviewCount = withRatings.length > 0
		? Math.round(withRatings.reduce((s, p) => s + p.reviewCount, 0) / withRatings.length)
		: 0;

	let chainCount = 0;
	let independentCount = 0;
	for (const p of places) {
		if (isChain(p.name)) chainCount++;
		else independentCount++;
	}

	const topRated = [...places]
		.filter(p => p.rating > 0)
		.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
		.slice(0, 5);

	return {
		places,
		totalNearby: places.length,
		avgRating,
		avgPriceLevel,
		avgReviewCount,
		chainCount,
		independentCount,
		topRated,
		source,
		fetchedAt: new Date().toISOString()
	};
}

function parsePlaceResult(p: GooglePlaceRaw, originLat: number, originLng: number): PlaceResult {
	return {
		name: p.name || 'Unknown',
		address: p.vicinity || '',
		lat: p.geometry?.location?.lat || 0,
		lng: p.geometry?.location?.lng || 0,
		rating: p.rating || 0,
		reviewCount: p.user_ratings_total || 0,
		priceLevel: p.price_level || 0,
		types: p.types || [],
		isOpen: p.opening_hours?.open_now,
		distance: haversineMeters(
			originLat, originLng,
			p.geometry?.location?.lat || 0,
			p.geometry?.location?.lng || 0
		)
	};
}

function isChain(name: string): boolean {
	const lower = name.toLowerCase();
	for (const chain of KNOWN_CHAINS) {
		if (lower.includes(chain)) return true;
	}
	return false;
}

/**
 * Map canonical concept key → Google Places API `type` parameter.
 * Full list: https://developers.google.com/maps/documentation/places/web-service/supported_types
 *
 * Every canonical concept from businessTypeNormalizer.ts MUST have a case here.
 * Fallback is 'store' (generic) — never 'cafe'.
 */
function mapBusinessTypeToPlacesType(bizType: string): string {
	const lower = bizType.toLowerCase();

	// ── Exact canonical keys first (fastest path) ──
	const CANONICAL_MAP: Record<string, string> = {
		'specialty_coffee':         'cafe',
		'full_service_restaurant':  'restaurant',
		'fast_casual':              'restaurant',
		'qsr':                      'restaurant',
		'bakery':                   'bakery',
		'fitness_studio':           'gym',
		'bar_nightlife':            'bar',
		'wellness_spa':             'spa',
		'wellness_beverage':        'cafe',        // tea house / matcha bar — closest proxy
		'juice_bar':                'cafe',        // juice / smoothie bar — closest proxy
		'personal_services':        'beauty_salon',
		'retail':                   'clothing_store',
		'coworking':                'library',     // no coworking type; library is nearest proxy
		'medical_office':           'dentist',
	};

	if (CANONICAL_MAP[lower]) return CANONICAL_MAP[lower];

	// ── Fuzzy fallback for non-canonical strings ──
	if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('café')) return 'cafe';
	if (lower.includes('restaurant') || lower.includes('food') || lower.includes('diner')) return 'restaurant';
	if (lower.includes('fitness') || lower.includes('gym') || lower.includes('yoga') || lower.includes('pilates')) return 'gym';
	if (lower.includes('bar') || lower.includes('nightlife') || lower.includes('pub') || lower.includes('lounge')) return 'bar';
	if (lower.includes('spa') || lower.includes('wellness')) return 'spa';
	if (lower.includes('bakery') || lower.includes('pastry') || lower.includes('patisserie')) return 'bakery';
	if (lower.includes('salon') || lower.includes('barber') || lower.includes('beauty') || lower.includes('nail')) return 'beauty_salon';
	if (lower.includes('retail') || lower.includes('boutique') || lower.includes('clothing') || lower.includes('shop')) return 'clothing_store';
	if (lower.includes('medical') || lower.includes('dental') || lower.includes('dentist') || lower.includes('doctor')) return 'dentist';
	if (lower.includes('cowork')) return 'library';
	if (lower.includes('juice') || lower.includes('smoothie') || lower.includes('acai')) return 'cafe';
	if (lower.includes('tea') || lower.includes('matcha') || lower.includes('boba')) return 'cafe';

	return 'store';  // generic commercial — NEVER default to cafe
}

/**
 * Map canonical concept key → Overpass OSM tag filters.
 * Used as fallback when no Google Places API key is available.
 * Every canonical concept MUST have a case here.
 */
function mapBusinessTypeToOverpass(bizType: string): string[] {
	const lower = bizType.toLowerCase();

	const CANONICAL_MAP: Record<string, string[]> = {
		'specialty_coffee':         ['"amenity"="cafe"', '"cuisine"~"coffee"', '"shop"="coffee"'],
		'full_service_restaurant':  ['"amenity"="restaurant"'],
		'fast_casual':              ['"amenity"="restaurant"', '"amenity"="fast_food"'],
		'qsr':                      ['"amenity"="fast_food"'],
		'bakery':                   ['"shop"="bakery"', '"amenity"="cafe"'],
		'fitness_studio':           ['"leisure"="fitness_centre"', '"sport"="fitness"', '"sport"="yoga"'],
		'bar_nightlife':            ['"amenity"="bar"', '"amenity"="pub"', '"amenity"="nightclub"'],
		'wellness_spa':             ['"amenity"="spa"', '"leisure"="sauna"', '"shop"="beauty"'],
		'wellness_beverage':        ['"amenity"="cafe"', '"cuisine"~"tea|bubble_tea"'],
		'juice_bar':                ['"amenity"="cafe"', '"cuisine"~"juice|smoothie"'],
		'personal_services':        ['"shop"="hairdresser"', '"shop"="beauty"', '"amenity"="beauty"'],
		'retail':                   ['"shop"~"clothes|boutique|gift|jewelry|books"'],
		'coworking':                ['"amenity"="coworking_space"', '"office"="coworking"'],
		'medical_office':           ['"amenity"="dentist"', '"amenity"="doctors"', '"amenity"="clinic"'],
	};

	if (CANONICAL_MAP[lower]) return CANONICAL_MAP[lower];

	// Fuzzy fallback
	if (lower.includes('coffee') || lower.includes('cafe')) return CANONICAL_MAP['specialty_coffee'];
	if (lower.includes('restaurant') || lower.includes('food')) return CANONICAL_MAP['full_service_restaurant'];
	if (lower.includes('fitness') || lower.includes('gym')) return CANONICAL_MAP['fitness_studio'];
	if (lower.includes('bar') || lower.includes('pub')) return CANONICAL_MAP['bar_nightlife'];
	if (lower.includes('spa') || lower.includes('wellness')) return CANONICAL_MAP['wellness_spa'];
	if (lower.includes('bakery') || lower.includes('pastry')) return CANONICAL_MAP['bakery'];
	if (lower.includes('salon') || lower.includes('barber') || lower.includes('beauty')) return CANONICAL_MAP['personal_services'];
	if (lower.includes('retail') || lower.includes('boutique') || lower.includes('clothing')) return CANONICAL_MAP['retail'];
	if (lower.includes('medical') || lower.includes('dental')) return CANONICAL_MAP['medical_office'];
	if (lower.includes('cowork')) return CANONICAL_MAP['coworking'];

	return ['"shop"~"."'];  // generic commercial — NEVER default to cafe
}

/**
 * Market density scan — search multiple business categories in parallel
 * to understand the full commercial ecosystem around a location.
 *
 * Returns counts and quality metrics per category, plus an overall
 * commercial vitality score.
 */
export interface MarketDensityData {
	categories: CategoryDensity[];
	totalBusinesses: number;
	commercialVitality: number; // 0-100
	dominantCategory: string;
	avgOverallRating: number;
	source: 'google-places' | 'overpass-fallback';
	fetchedAt: string;
}

export interface CategoryDensity {
	category: string;
	placeType: string;
	count: number;
	avgRating: number;
	chainPct: number;
}

const MARKET_SCAN_TYPES = [
	{ category: 'Cafes & Coffee', type: 'cafe', extraTypes: [] as string[] },
	{ category: 'Restaurants', type: 'restaurant', extraTypes: [] as string[] },
	// B3-2.4: include 'night_club' so dense nightlife corridors (e.g. 105 Rivington in LES)
	// surface their night_club POIs alongside 'bar'-typed POIs. Previously the 'bar' type
	// alone missed most clubs and left some LES block groups with zero bar competitors.
	// We deliberately exclude 'liquor_store' — retail is a distinct competitor class.
	{ category: 'Bars & Nightlife', type: 'bar', extraTypes: ['night_club'] as string[] },
	{ category: 'Fitness & Gyms', type: 'gym', extraTypes: ['health'] },  // Equinox etc. classified as 'health' not 'gym'
	{ category: 'Retail & Shopping', type: 'store', extraTypes: [] as string[] },
	{ category: 'Banks & Finance', type: 'bank', extraTypes: [] as string[] },
	{ category: 'Groceries', type: 'supermarket', extraTypes: [] as string[] },
	{ category: 'Pharmacies', type: 'pharmacy', extraTypes: [] as string[] }
];

export async function fetchMarketDensity(
	lat: number,
	lng: number,
	radiusMeters: number = 500
): Promise<MarketDensityData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'market-density');
	const cached = await intelCache.getAsync<MarketDensityData>(cacheKey);
	if (cached?.fresh) return cached.data;

	// ── DB-FIRST: Check block_group_intel for pre-seeded market density data ──
	// Seeded via: npx tsx scripts/seed-api-data.ts --source google_places
	// Avoids per-request Google API cost ($32/1K) for baseline commercial density.
	try {
		const { createClient } = await import('@supabase/supabase-js');
		const { env: e } = await import('$env/dynamic/private');
		if (e.PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) {
			const supabase = createClient(e.PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY);
			const { data: nearest } = await supabase.rpc('nearby_block_group', { lat, lng });
			if (nearest && nearest.length > 0) {
				const { data: intel } = await supabase
					.from('block_group_intel')
					.select('data')
					.eq('geoid', nearest[0].geoid)
					.eq('source', 'google_places')
					.single();
				if (intel?.data) {
					console.log('[Places-DB] Using seeded market density data');
					const d = intel.data as {
						total_results: number;
						type_distribution: Record<string, number>;
						avg_rating: number | null;
						top_categories: Array<{ type: string; count: number }>;
					};
					const categories: CategoryDensity[] = MARKET_SCAN_TYPES.map(({ category, type }) => ({
						category,
						placeType: type,
						count: d.type_distribution?.[type] || 0,
						avgRating: d.avg_rating || 0,
						chainPct: 0 // not stored in seeded data
					}));
					const totalBusinesses = d.total_results || 0;
					const result: MarketDensityData = {
						categories,
						totalBusinesses,
						commercialVitality: Math.min(100, Math.round((totalBusinesses / 50) * 100)),
						dominantCategory: d.top_categories?.[0]?.type || 'unknown',
						avgOverallRating: d.avg_rating || 0,
						source: 'google-places',
						fetchedAt: new Date().toISOString()
					};
					intelCache.set(cacheKey, result, TTL.PLACES);
					return result;
				}
			}
		}
	} catch (dbErr) {
		console.warn('[Places-DB] Seeded market density lookup skipped:', dbErr);
	}
	// Falls through to live Google Places API or Overpass below

	const apiKey = env.GOOGLE_PLACES_API_KEY;

	try {
		let categories: CategoryDensity[];
		let source: 'google-places' | 'overpass-fallback';

		if (apiKey) {
			// Parallel Google Places searches across all categories.
			// Some categories need multiple type queries merged (e.g., Fitness needs
			// both 'gym' AND 'health' because Google classifies premium fitness
			// brands like Equinox as 'health', not 'gym').
			const results = await Promise.allSettled(
				MARKET_SCAN_TYPES.map(async ({ category, type, extraTypes }) => {
					// Build list of type queries: primary + extras
					const typesToSearch = [type, ...extraTypes];
					const allPlaces: GooglePlaceRaw[] = [];
					const seenNames = new Set<string>();

					for (const t of typesToSearch) {
						const params = new URLSearchParams({
							location: `${lat},${lng}`,
							radius: radiusMeters.toString(),
							type: t,
							key: apiKey
						});

						try {
							const { resilientFetch } = await import('./retry');
							const res = await resilientFetch(`${PLACES_BASE}?${params}`, {
								timeout: 10000,
								label: 'GooglePlaces'
							});

							if (res.ok) {
								const data = await res.json();
								const places: GooglePlaceRaw[] = (data.status === 'OK') ? data.results : [];
								// Deduplicate across type queries by name
								for (const p of places) {
									const key = (p.name || '').toLowerCase();
									if (!seenNames.has(key)) {
										seenNames.add(key);
										allPlaces.push(p);
									}
								}
							}
						} catch {
							// Single type query failed — continue with others
						}
					}

					return { category, type, places: allPlaces };
				})
			);

			categories = results.map((r, i) => {
				if (r.status !== 'fulfilled') {
					return { category: MARKET_SCAN_TYPES[i].category, placeType: MARKET_SCAN_TYPES[i].type, count: 0, avgRating: 0, chainPct: 0 };
				}
				const { category, type, places } = r.value;
				const withRating = places.filter((p: GooglePlaceRaw) => p.rating && p.rating > 0);
				const avgRating = withRating.length > 0
					? +(withRating.reduce((s: number, p: GooglePlaceRaw) => s + (p.rating || 0), 0) / withRating.length).toFixed(1)
					: 0;
				const chains = places.filter((p: GooglePlaceRaw) => isChain(p.name || ''));
				return {
					category,
					placeType: type,
					count: places.length,
					avgRating,
					chainPct: places.length > 0 ? Math.round((chains.length / places.length) * 100) : 0
				};
			});
			source = 'google-places';
		} else {
			// Overpass fallback — counts only, no ratings
			categories = await overpassMarketScan(lat, lng, radiusMeters);
			source = 'overpass-fallback';
		}

		const totalBusinesses = categories.reduce((s, c) => s + c.count, 0);
		const withRating = categories.filter(c => c.avgRating > 0);
		const avgOverallRating = withRating.length > 0
			? +(withRating.reduce((s, c) => s + c.avgRating, 0) / withRating.length).toFixed(1)
			: 0;

		// Commercial vitality score
		const categoriesPresent = categories.filter(c => c.count > 0).length;
		const diversityScore = (categoriesPresent / MARKET_SCAN_TYPES.length) * 40;
		const densityScore = Math.min(40, (totalBusinesses / 50) * 40);
		const qualityScore = (avgOverallRating / 5) * 20;
		const commercialVitality = Math.round(diversityScore + densityScore + qualityScore);

		const dominantCategory = categories.sort((a, b) => b.count - a.count)[0]?.category || 'None';

		const result: MarketDensityData = {
			categories,
			totalBusinesses,
			commercialVitality: Math.min(100, commercialVitality),
			dominantCategory,
			avgOverallRating,
			source,
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.PLACES);
		return result;
	} catch (e) {
		console.error('[MarketDensity] Fetch error:', e);
		return cached?.data || null;
	}
}

async function overpassMarketScan(lat: number, lng: number, radiusMeters: number): Promise<CategoryDensity[]> {
	const overpassTypes = [
		{ category: 'Cafes & Coffee', type: 'cafe', filter: '"amenity"="cafe"' },
		{ category: 'Restaurants', type: 'restaurant', filter: '"amenity"="restaurant"' },
		{ category: 'Bars & Nightlife', type: 'bar', filter: '"amenity"="bar"' },
		{ category: 'Fitness & Gyms', type: 'gym', filter: '"leisure"="fitness_centre"' },
		{ category: 'Retail & Shopping', type: 'store', filter: '"shop"~"."' },
		{ category: 'Banks & Finance', type: 'bank', filter: '"amenity"="bank"' },
		{ category: 'Groceries', type: 'supermarket', filter: '"shop"="supermarket"' },
		{ category: 'Pharmacies', type: 'pharmacy', filter: '"amenity"="pharmacy"' }
	];

	// Single Overpass query for all types — nwr catches nodes, ways, and relations
	const filters = overpassTypes.map(t =>
		`nwr[${t.filter}](around:${radiusMeters},${lat},${lng});`
	).join('');
	const query = `[out:json][timeout:15];(${filters});out center;`;

	try {
		const { resilientFetch } = await import('./retry');
		const res = await resilientFetch(
			`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
			{
				timeout: 18000,
				label: 'GooglePlaces',
				headers: { 'User-Agent': SITE_CONFIG.userAgent }
			}
		);

		if (!res.ok) return overpassTypes.map(t => ({ category: t.category, placeType: t.type, count: 0, avgRating: 0, chainPct: 0 }));
		const data = await res.json();
		const elements: OverpassElement[] = data.elements || [];

		// Bucket elements by matching type
		return overpassTypes.map(t => {
			const matching = elements.filter(e => {
				const tags = e.tags || {};
				if (t.type === 'store') return !!tags.shop;
				return tags.amenity === t.type || tags.leisure === (t.type === 'gym' ? 'fitness_centre' : '') || tags.shop === t.type;
			});
			const chains = matching.filter(e => isChain(e.tags?.name || ''));
			return {
				category: t.category,
				placeType: t.type,
				count: matching.length,
				avgRating: 0,
				chainPct: matching.length > 0 ? Math.round((chains.length / matching.length) * 100) : 0
			};
		});
	} catch {
		return overpassTypes.map(t => ({ category: t.category, placeType: t.type, count: 0, avgRating: 0, chainPct: 0 }));
	}
}

// 04.19.2026 13:35 Score Consolidation — haversineMeters removed. Imported from geo-math.ts above.
