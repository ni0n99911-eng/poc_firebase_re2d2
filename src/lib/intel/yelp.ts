/**
 * Yelp Fusion API client for business search and competitor intelligence.
 *
 * Provides:
 *   - Business search by location and category
 *   - Ratings, review counts, price levels
 *   - Business hours, transactions (delivery, pickup, etc.)
 *   - Category taxonomy for competitor classification
 *
 * Requires: YELP_API_KEY environment variable (Fusion API Key)
 * Get one at: https://www.yelp.com/developers/v3/manage_app
 *
 * Free tier: 500 calls/day (sufficient for beta)
 * Docs: https://docs.developer.yelp.com/reference/v3_business_search
 *
 * Feeds into: Competitor synthesis, competition scoring, market density enrichment
 */

import { env } from '$env/dynamic/private';
import { IntelCache, intelCache, TTL } from './cache';

// ─────────────────────────────────────────────────
// Public interfaces
// ─────────────────────────────────────────────────

export interface YelpBusiness {
	id: string;
	name: string;
	categories: YelpCategory[];
	primaryCategory: string;
	rating: number;           // 1.0 - 5.0
	reviewCount: number;
	priceLevel: number;       // 1-4 ($ to $$$$)
	address: string;
	lat: number;
	lng: number;
	distance: number;         // meters from search point
	isClosed: boolean;
	isChain: boolean;
	phone: string;
	url: string;
	transactions: string[];   // ['delivery', 'pickup', 'restaurant_reservation']
}

export interface YelpCategory {
	alias: string;   // e.g. 'coffee', 'newamerican'
	title: string;   // e.g. 'Coffee & Tea', 'American (New)'
}

export interface YelpData {
	businesses: YelpBusiness[];
	totalCount: number;

	// Competition signals
	directCompetitors: YelpBusiness[];
	chainCount: number;
	independentCount: number;

	// Quality signals
	avgRating: number;
	avgReviewCount: number;
	avgPriceLevel: number;
	topRated: YelpBusiness[];   // top 5 by rating

	// Category analysis
	categoryBreakdown: { category: string; count: number }[];

	source: 'yelp';
	fetchedAt: string;
}

// ─────────────────────────────────────────────────
// Yelp category aliases for business types
// https://www.yelp.com/developers/documentation/v3/all_category_list
// ─────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
	// Every canonical concept from businessTypeNormalizer.ts MUST have an entry.
	// Yelp category aliases: https://www.yelp.com/developers/documentation/v3/all_category_list
	'specialty_coffee': 'coffee,coffeeroasteries',
	'cafe': 'coffee,cafes',
	'coffee': 'coffee,coffeeroasteries',
	'full_service_restaurant': 'restaurants',
	'restaurant': 'restaurants',
	'fast_casual': 'restaurants',                          // Yelp doesn't differentiate fast casual
	'qsr': 'hotdogs,burgers,pizza,sandwiches',
	'fast_food': 'hotdogs,burgers,pizza,sandwiches',
	'bakery': 'bakeries',
	'fitness_studio': 'gyms,fitness,yoga,pilates',
	'fitness': 'gyms,fitness',
	'gym': 'gyms,fitness',
	'bar_nightlife': 'bars,nightlife',
	'bar': 'bars,cocktailbars,sportsbars',
	'wellness_spa': 'spas,massage,skincare',
	'personal_services': 'beautysvc,hair,barbers',
	'retail': 'shopping',
	'coworking': 'sharedofficespaces',
	'medical_office': 'physicians,dentists,health',
	'wellness_beverage': 'tea,bubbletea',
	'juice_bar': 'juicebars,smoothies',
};

const YELP_BASE = 'https://api.yelp.com/v3/businesses/search';

// Known chains for chain detection (shared with other modules)
const CHAIN_NAMES = new Set([
	'starbucks', 'dunkin', "dunkin'", 'peet', "peet's", 'blue bottle',
	"gregory's", 'gregorys', 'joe coffee', 'think coffee', 'la colombe',
	'bluestone lane', 'philz', 'intelligentsia', 'blank street',
	'birch coffee', 'ground central', 'city of saints', 'felix roasting',
	'sweetgreen', 'chipotle', 'shake shack', 'panera', "mcdonald's",
	'mcdonalds', 'subway', 'chick-fil-a', "wendy's", 'burger king',
	'popeyes', "domino's", 'pizza hut', 'taco bell', 'five guys',
	'wingstop', 'equinox', 'planet fitness', 'orangetheory', 'soulcycle',
	'blink fitness', 'crunch', "barry's", 'lifetime fitness'
]);

// ─────────────────────────────────────────────────
// Main fetch function
// ─────────────────────────────────────────────────

/**
 * Fetch Yelp Fusion data near a location.
 * Returns null if API key is not configured (graceful degradation).
 */
export async function fetchYelpData(
	lat: number,
	lng: number,
	businessType: string = 'cafe',
	radiusMeters: number = 800
): Promise<YelpData | null> {
	const apiKey = env.YELP_API_KEY;
	if (!apiKey) {
		console.warn('[Yelp] No API key configured — skipping');
		return null;
	}

	const cacheKey = IntelCache.locationKey(lat, lng, `yelp-${businessType}`);
	const cached = await intelCache.getAsync<YelpData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		// Primary search: business type specific
		const categories = CATEGORY_MAP[businessType.toLowerCase()];
		if (!categories) {
			console.error(`[Yelp] ❌ CATEGORY_MAP miss for "${businessType}" — competitor query SKIPPED. Add this key to CATEGORY_MAP or fix the caller.`);
		}

		const params = new URLSearchParams({
			latitude: String(lat),
			longitude: String(lng),
			radius: String(Math.min(radiusMeters, 40000)), // Yelp max 40km
			limit: '50',   // Yelp max per request
			sort_by: 'distance'
		});
		if (categories) params.set('categories', categories);

		const { resilientFetch } = await import('./retry');

		console.log('[Yelp] Fetching:', `${YELP_BASE}?latitude=${lat}&longitude=${lng}&categories=${categories}`);
		const res = await resilientFetch(`${YELP_BASE}?${params}`, {
			timeout: 10000,
			label: 'Yelp',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Accept': 'application/json'
			}
		});

		console.log('[Yelp] API response status:', res.status);
		if (!res.ok) {
			if (res.status === 401 || res.status === 403) {
				console.error('[Yelp] Invalid API key (key starts with:', apiKey.substring(0, 8) + '...)');
			} else if (res.status === 429) {
				console.warn('[Yelp] Rate limited — daily limit may be exceeded');
			} else {
				const body = await res.text();
				console.error('[Yelp] API error:', res.status, body.substring(0, 200));
			}
			return cached?.data || null;
		}

		const data = await res.json();
		const rawBusinesses: RawYelpBusiness[] = data.businesses || [];
		console.log('[Yelp] Search returned', rawBusinesses.length, 'results (total:', data.total, ')');

		// Process businesses
		const businesses = rawBusinesses
			.map(b => processYelpBusiness(b))
			.filter((b): b is YelpBusiness => b !== null && !b.isClosed);

		// Direct competitors = same primary category
		const directCompetitors = businesses.filter(b =>
			isDirectCompetitor(b.categories, businessType)
		);

		// Chain vs independent
		const chainCount = businesses.filter(b => b.isChain).length;
		const independentCount = businesses.filter(b => !b.isChain).length;

		// Quality metrics
		const withRating = businesses.filter(b => b.rating > 0);
		const avgRating = withRating.length > 0
			? +(withRating.reduce((s, b) => s + b.rating, 0) / withRating.length).toFixed(1)
			: 0;
		const avgReviewCount = withRating.length > 0
			? Math.round(withRating.reduce((s, b) => s + b.reviewCount, 0) / withRating.length)
			: 0;
		const withPrice = businesses.filter(b => b.priceLevel > 0);
		const avgPriceLevel = withPrice.length > 0
			? +(withPrice.reduce((s, b) => s + b.priceLevel, 0) / withPrice.length).toFixed(1)
			: 0;

		// Top rated
		const topRated = [...businesses]
			.filter(b => b.rating > 0)
			.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
			.slice(0, 5);

		// Category breakdown
		const catCounts = new Map<string, number>();
		for (const b of businesses) {
			if (b.primaryCategory) {
				catCounts.set(b.primaryCategory, (catCounts.get(b.primaryCategory) || 0) + 1);
			}
		}
		const categoryBreakdown = Array.from(catCounts.entries())
			.map(([category, count]) => ({ category, count }))
			.sort((a, b) => b.count - a.count);

		const result: YelpData = {
			businesses,
			totalCount: businesses.length,
			directCompetitors,
			chainCount,
			independentCount,
			avgRating,
			avgReviewCount,
			avgPriceLevel,
			topRated,
			categoryBreakdown,
			source: 'yelp',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.PLACES); // 24h TTL
		return result;

	} catch (err) {
		console.error('[Yelp] Fetch error:', err);
		return cached?.data || null;
	}
}

// ─────────────────────────────────────────────────
// Raw API types
// ─────────────────────────────────────────────────

interface RawYelpBusiness {
	id?: string;
	name?: string;
	categories?: Array<{ alias?: string; title?: string }>;
	rating?: number;
	review_count?: number;
	price?: string;       // '$', '$$', '$$$', '$$$$'
	location?: {
		address1?: string;
		address2?: string;
		city?: string;
		state?: string;
		zip_code?: string;
		display_address?: string[];
	};
	coordinates?: {
		latitude?: number;
		longitude?: number;
	};
	distance?: number;     // meters
	is_closed?: boolean;
	phone?: string;
	url?: string;
	transactions?: string[];
}

// ─────────────────────────────────────────────────
// Processing
// ─────────────────────────────────────────────────

function processYelpBusiness(raw: RawYelpBusiness): YelpBusiness | null {
	if (!raw.name) return null;

	const categories: YelpCategory[] = (raw.categories || []).map(c => ({
		alias: c.alias || '',
		title: c.title || ''
	}));

	const priceStr = raw.price || '';
	const priceLevel = priceStr.length; // '$'=1, '$$'=2, '$$$'=3, '$$$$'=4

	const address = raw.location?.display_address?.join(', ') || raw.location?.address1 || '';

	return {
		id: raw.id || '',
		name: raw.name,
		categories,
		primaryCategory: categories[0]?.title || 'Unknown',
		rating: raw.rating || 0,
		reviewCount: raw.review_count || 0,
		priceLevel,
		address,
		lat: raw.coordinates?.latitude || 0,
		lng: raw.coordinates?.longitude || 0,
		distance: raw.distance || 0,
		isClosed: raw.is_closed || false,
		isChain: isChain(raw.name),
		phone: raw.phone || '',
		url: raw.url || '',
		transactions: raw.transactions || []
	};
}

function isDirectCompetitor(categories: YelpCategory[], businessType: string): boolean {
	const lower = businessType.toLowerCase();
	const aliases = categories.map(c => c.alias.toLowerCase());

	if (lower.includes('coffee') || lower.includes('cafe')) {
		return aliases.some(a => a.includes('coffee') || a.includes('cafe') || a.includes('tea') || a.includes('bakeries'));
	}
	if (lower.includes('restaurant') || lower.includes('food')) {
		return aliases.some(a =>
			a.includes('restaurant') || a.includes('food') || a.includes('burgers') ||
			a.includes('pizza') || a.includes('sandwiches')
		);
	}
	if (lower.includes('fitness') || lower.includes('gym')) {
		return aliases.some(a => a.includes('gym') || a.includes('fitness') || a.includes('yoga') || a.includes('pilates'));
	}
	if (lower.includes('bar')) {
		return aliases.some(a => a.includes('bar') || a.includes('pub') || a.includes('nightlife'));
	}
	return false;
}

function isChain(name: string): boolean {
	const lower = name.toLowerCase();
	for (const chain of CHAIN_NAMES) {
		if (lower.includes(chain)) return true;
	}
	return false;
}
