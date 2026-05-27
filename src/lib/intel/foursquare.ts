/**
 * Foursquare Places API client (New Places API — places-api.foursquare.com).
 *
 * Migrated from legacy v3 (api.foursquare.com/v3) which returns 410 Gone
 * for accounts created after June 2025. Uses Service API Keys with Bearer auth.
 *
 * Why Foursquare over Google Places alone:
 *   - 900+ category taxonomy (vs Google's ~100) — better competition classification
 *   - Popularity scores from check-in data — real foot traffic proxy
 *   - Venue hours of operation — helps model peak demand windows
 *   - Free tier: 10K calls/month (plenty for beta)
 *
 * Requires: FOURSQUARE_API_KEY environment variable (Service API Key)
 * Get one free at: https://foursquare.com/developers/home
 *
 * Feeds into: Competition Score, Vibrancy Index, Transit Index (popularity as traffic proxy)
 */

import { env } from '$env/dynamic/private';
import { IntelCache, intelCache, TTL } from './cache';

// ─────────────────────────────────────────────────
// Public interfaces
// ─────────────────────────────────────────────────

export interface FoursquareVenue {
	fsqId: string;
	name: string;
	categories: FoursquareCategory[];
	primaryCategory: string;
	address: string;
	lat: number | null;         // venue latitude (for map pins)
	lng: number | null;         // venue longitude (for map pins)
	distance: number;           // meters from query point
	popularity: number;         // 0-1 popularity score (from check-ins)
	rating: number | null;      // 0-10 rating (if available)
	priceLevel: number | null;  // 1-4
	hours: string | null;       // formatted hours string
	isChain: boolean;
	chainName: string | null;
	verified: boolean;
	closed: boolean;
}

export interface FoursquareCategory {
	id: number;
	name: string;
	shortName: string;
	icon: string;
}

export interface FoursquareData {
	venues: FoursquareVenue[];
	totalCount: number;

	// Competition signals
	directCompetitors: FoursquareVenue[];
	chainCount: number;
	independentCount: number;

	// Category richness
	categoryBreakdown: { category: string; count: number }[];
	categoryDiversity: number;   // unique top-level categories

	// Popularity signals
	avgPopularity: number;       // 0-1 average popularity
	highTrafficVenues: number;   // venues with popularity > 0.7
	peakTrafficScore: number;    // 0-100 derived from popularity distribution

	// Quality signals
	avgRating: number;
	avgPriceLevel: number;

	source: 'foursquare';
	fetchedAt: string;
}

// ─────────────────────────────────────────────────
// Foursquare category IDs for business types
// See: https://location.foursquare.com/places/docs/categories
// ─────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
	// Every canonical concept from businessTypeNormalizer.ts MUST have an entry.
	// Foursquare v3 category taxonomy: https://location.foursquare.com/places/docs/categories
	'specialty_coffee': '13032',          // Coffee Shop
	'cafe': '13032',
	'coffee': '13032',
	'full_service_restaurant': '13065',   // Restaurant
	'restaurant': '13065',
	'fast_casual': '13065',               // Restaurant (Foursquare doesn't differentiate fast casual)
	'qsr': '13145',                       // Fast Food Restaurant
	'fast_food': '13145',
	'bakery': '13002',                    // Bakery
	'fitness_studio': '18021',            // Gym / Fitness Center
	'fitness': '18021',
	'bar_nightlife': '13003,13009',       // Bar (13003) + Nightclub (13009) — B3-2.2: 105 Rivington showed 0 competitors because LES venues are Nightclub-tagged, not Bar-tagged
	'bar': '13003,13009',
	'wellness_spa': '11062',              // Spa
	'personal_services': '11057',         // Salon / Barber
	'retail': '17000',                    // Retail (broad)
	'coworking': '11049',                 // Coworking Space
	'medical_office': '15014',            // Doctor's Office
	'wellness_beverage': '13032',         // Coffee Shop (closest proxy for tea/matcha)
	'juice_bar': '13036',                 // Juice Bar
};

// New Foursquare Places API base (replaces api.foursquare.com/v3/places)
const FSQ_BASE = 'https://places-api.foursquare.com/places';

// API version date (required header for new Places API)
const FSQ_API_VERSION = '2025-06-17';

// ─────────────────────────────────────────────────
// Shared headers builder
// ─────────────────────────────────────────────────

function fsqHeaders(apiKey: string): Record<string, string> {
	return {
		'Accept': 'application/json',
		'Authorization': `Bearer ${apiKey}`,
		'X-Places-Api-Version': FSQ_API_VERSION
	};
}

// ─────────────────────────────────────────────────
// Main fetch function
// ─────────────────────────────────────────────────

/**
 * Fetch Foursquare Places data near a location.
 * Returns null if API key is not configured (graceful degradation).
 */
export async function fetchFoursquareData(
	lat: number,
	lng: number,
	businessType: string = 'cafe',
	radiusMeters: number = 500
): Promise<FoursquareData | null> {
	const apiKey = env.FOURSQUARE_API_KEY;
	if (!apiKey) {
		// Gracefully degrade — Foursquare is an enhancement, not required
		console.warn('[Foursquare] No API key configured — skipping');
		return null;
	}

	const cacheKey = IntelCache.locationKey(lat, lng, `foursquare-${businessType}`);
	const cached = await intelCache.getAsync<FoursquareData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		// Fetch nearby places — new Places API uses /search endpoint
		const searchUrl = new URL(`${FSQ_BASE}/search`);
		searchUrl.searchParams.set('ll', `${lat},${lng}`);
		searchUrl.searchParams.set('radius', String(Math.min(radiusMeters, 2000)));
		searchUrl.searchParams.set('limit', '50');
		searchUrl.searchParams.set('sort', 'DISTANCE');
		// Explicitly request popularity + rating — these are opt-in on the new Places API v2
		searchUrl.searchParams.set('fields', 'fsq_id,name,categories,location,geocodes,distance,popularity,rating,price,closed_bucket,hours');

		const { resilientFetch } = await import('./retry');
		const res = await resilientFetch(searchUrl.toString(), {
			timeout: 10000,
			label: 'Foursquare',
			headers: fsqHeaders(apiKey)
		});

		console.log('[Foursquare] API response status:', res.status);
		if (!res.ok) {
			if (res.status === 401 || res.status === 403) {
				console.error('[Foursquare] Invalid API key (key starts with:', apiKey.substring(0, 8) + '...)');
			} else if (res.status === 410) {
				console.error('[Foursquare] 410 Gone — endpoint deprecated, check migration guide');
			} else if (res.status === 429) {
				console.warn('[Foursquare] Rate limited');
			} else {
				console.error('[Foursquare] API error:', res.status);
			}
			return cached?.data || null;
		}

		const data = await res.json();
		const results = data.results || [];
		console.log('[Foursquare] Search returned', results.length, 'results');

		// Also fetch competitors specifically if we have a category
		const competitorCategory = CATEGORY_MAP[businessType];
		if (!competitorCategory) {
			console.error(`[Foursquare] ❌ CATEGORY_MAP miss for "${businessType}" — competitor query SKIPPED. Add this key to CATEGORY_MAP or fix the caller.`);
		}
		let competitorResults: unknown[] = [];

		if (competitorCategory) {
			const compUrl = new URL(`${FSQ_BASE}/search`);
			compUrl.searchParams.set('ll', `${lat},${lng}`);
			compUrl.searchParams.set('radius', String(Math.min(radiusMeters, 1000)));
			compUrl.searchParams.set('categories', competitorCategory);
			compUrl.searchParams.set('limit', '50');
			compUrl.searchParams.set('sort', 'DISTANCE');
			compUrl.searchParams.set('fields', 'fsq_id,name,categories,location,geocodes,distance,popularity,rating,price,closed_bucket,hours');

			const compRes = await resilientFetch(compUrl.toString(), {
				timeout: 10000,
				label: 'Foursquare',
				headers: fsqHeaders(apiKey)
			});

			if (compRes.ok) {
				const compData = await compRes.json();
				competitorResults = compData.results || [];
			}
		}

		// Process venues
		const venues = processVenues(results);
		const directCompetitors = processVenues(competitorResults);

		// Deduplicate competitors against general venues
		const venueIds = new Set(venues.map(v => v.fsqId));
		for (const comp of directCompetitors) {
			if (!venueIds.has(comp.fsqId)) {
				venues.push(comp);
				venueIds.add(comp.fsqId);
			}
		}

		// Category breakdown
		const catCounts = new Map<string, number>();
		for (const v of venues) {
			if (v.primaryCategory) {
				catCounts.set(v.primaryCategory, (catCounts.get(v.primaryCategory) || 0) + 1);
			}
		}
		const categoryBreakdown = Array.from(catCounts.entries())
			.map(([category, count]) => ({ category, count }))
			.sort((a, b) => b.count - a.count);

		// Chain vs independent
		const chainCount = venues.filter(v => v.isChain).length;
		const independentCount = venues.filter(v => !v.isChain).length;

		// Popularity analysis
		const withPopularity = venues.filter(v => v.popularity > 0);
		const avgPopularity = withPopularity.length > 0
			? withPopularity.reduce((sum, v) => sum + v.popularity, 0) / withPopularity.length
			: 0;
		const highTrafficVenues = withPopularity.filter(v => v.popularity > 0.7).length;

		// Peak traffic score: 0-100
		let peakTrafficScore = 50;
		if (highTrafficVenues > 5) peakTrafficScore = 90;
		else if (highTrafficVenues > 2) peakTrafficScore = 75;
		else if (highTrafficVenues > 0) peakTrafficScore = 60;
		else if (avgPopularity > 0.5) peakTrafficScore = 55;
		else if (venues.length < 5) peakTrafficScore = 30;

		// Rating and price
		const withRating = venues.filter(v => v.rating !== null && v.rating > 0);
		const avgRating = withRating.length > 0
			? withRating.reduce((sum, v) => sum + (v.rating || 0), 0) / withRating.length
			: 0;
		const withPrice = venues.filter(v => v.priceLevel !== null);
		const avgPriceLevel = withPrice.length > 0
			? withPrice.reduce((sum, v) => sum + (v.priceLevel || 0), 0) / withPrice.length
			: 0;

		const result: FoursquareData = {
			venues,
			totalCount: venues.length,
			directCompetitors: directCompetitors.filter(v => !v.closed),
			chainCount,
			independentCount,
			categoryBreakdown,
			categoryDiversity: catCounts.size,
			avgPopularity,
			highTrafficVenues,
			peakTrafficScore,
			avgRating,
			avgPriceLevel,
			source: 'foursquare',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.PLACES); // 24h TTL
		return result;

	} catch (err) {
		console.error('[Foursquare] Fetch error:', err);
		return cached?.data || null;
	}
}

// ─────────────────────────────────────────────────
// Venue processing
// ─────────────────────────────────────────────────

/**
 * Process raw venue results from Foursquare API.
 * Handles both legacy v3 fields and new Places API fields:
 *   - fsq_id (v3) / fsq_place_id (new)
 *   - closed_bucket (v3) / date_closed (new)
 *   - verified (v3) / removed in new API
 *   - geocodes (v3) / latitude,longitude (new)
 */
function processVenues(raw: unknown[]): FoursquareVenue[] {
	return raw
		.filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
		.map(r => {
			const categories = Array.isArray(r.categories)
				? (r.categories as Record<string, unknown>[]).map(c => ({
					id: Number(c.id) || 0,
					name: String(c.name || ''),
					shortName: String(c.short_name || c.name || ''),
					icon: c.icon ? `${(c.icon as Record<string, string>).prefix}64${(c.icon as Record<string, string>).suffix}` : ''
				}))
				: [];

			const chains = Array.isArray(r.chains) ? r.chains as Record<string, unknown>[] : [];
			const isChain = chains.length > 0;
			const chainName = isChain ? String(chains[0]?.name || '') : null;

			const location = (r.location || {}) as Record<string, unknown>;

			// Handle both v3 (fsq_id) and new API (fsq_place_id) field names
			const fsqId = String(r.fsq_place_id || r.fsq_id || '');

			// Handle both v3 (closed_bucket) and new API (date_closed) for closure detection
			const isClosed = r.date_closed != null || String(r.closed_bucket || '').includes('Closed');

			// Extract lat/lng — new Places API returns latitude/longitude directly;
			// legacy v3 uses geocodes.main.latitude/longitude
			const geocodes = (r.geocodes as Record<string, unknown> | undefined);
			const mainGeo = geocodes?.main as Record<string, unknown> | undefined;
			const venueLat = r.latitude != null ? Number(r.latitude)
				: mainGeo?.latitude != null ? Number(mainGeo.latitude) : null;
			const venueLng = r.longitude != null ? Number(r.longitude)
				: mainGeo?.longitude != null ? Number(mainGeo.longitude) : null;

			return {
				fsqId,
				name: String(r.name || ''),
				categories,
				primaryCategory: categories[0]?.name || 'Unknown',
				address: String(location.formatted_address || location.address || ''),
				lat: venueLat,
				lng: venueLng,
				distance: Number(r.distance) || 0,
				popularity: Number(r.popularity) || 0,
				rating: r.rating != null ? Number(r.rating) : null,
				priceLevel: r.price != null ? Number(r.price) : null,
				hours: formatHours(r.hours),
				isChain,
				chainName,
				verified: Boolean(r.verified),
				closed: isClosed
			};
		})
		.filter(v => !v.closed); // Exclude permanently closed
}

function formatHours(hours: unknown): string | null {
	if (!hours || typeof hours !== 'object') return null;
	const h = hours as Record<string, unknown>;
	if (h.display) return String(h.display);
	if (h.regular && Array.isArray(h.regular)) {
		return `${(h.regular as Record<string, unknown>[]).length} scheduled days`;
	}
	return null;
}
