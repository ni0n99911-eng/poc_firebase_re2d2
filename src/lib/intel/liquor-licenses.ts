/**
 * NYS Liquor License client.
 *
 * Fetches active liquor license data from NYS Open Data (Socrata API).
 * Dataset: https://data.ny.gov/Economic-Development/Current-Liquor-Authority-Active-Licenses/9s3h-dpkz
 *
 * Free, no API key required. Supports geo queries via `georeference` column.
 *
 * Provides:
 * - Active liquor license count near a location
 * - License type breakdown (on-premise, off-premise, beer/wine, etc.)
 * - Nightlife density signal
 * - Vibrancy signal: areas with more liquor licenses tend to have active nightlife/dining
 *
 * Feeds into: Vibrancy Index
 */

import { IntelCache, intelCache, TTL } from './cache';

export interface LiquorLicense {
	premiseName: string;
	licenseType: string;       // description from NYSLA (e.g. "Restaurant Wine", "On Premises Liquor")
	licenseClass: string;
	address: string;
	city: string;
	zip: string;
	effectiveDate: string;
	expirationDate: string;
}

export interface LiquorLicenseData {
	licenses: LiquorLicense[];
	totalCount: number;
	typeBreakdown: { type: string; label: string; count: number }[];
	onPremiseCount: number;        // Bars, restaurants — serve on-site
	offPremiseCount: number;       // Liquor stores — take-away
	restaurantWineCount: number;   // Beer/wine only (restaurants)
	nightlifeDensity: number;      // 0-100: how much nightlife activity
	vibrancySignal: number;        // 0-100: overall vibrancy from liquor licenses
	source: 'liquor-licenses';
	fetchedAt: string;
}

// NYS Liquor Authority — Current Active Licenses (data.ny.gov)
const LIQUOR_BASE = 'https://data.ny.gov/resource/9s3h-dpkz.json';

// Map NYSLA description field to on-premise / off-premise / restaurant-wine categories.
// Values come from data.ny.gov/resource/9s3h-dpkz (Current Active Licenses).
// Actual description values: Restaurant, Food & Beverage Business, Additional Bar,
// Catering Establishment, Club, Hotel, Tavern, Theater, Stadium, Vessel,
// Liquor Store, Drug Store, Temporary retail, Grocery Store, Wholesale Wine, Wholesale Liquor
const ON_PREMISE_PATTERNS = [
	'restaurant', 'food & beverage', 'additional bar', 'tavern', 'hotel',
	'club', 'catering', 'caterer', 'vessel', 'theater', 'stadium',
	'on premises'
];
const OFF_PREMISE_PATTERNS = [
	'liquor store', 'drug store', 'temporary retail', 'off premises',
	'package', 'wholesale liquor'
];
const RESTAURANT_WINE_PATTERNS = [
	'grocery', 'wholesale wine', 'wine wholesale', 'beer/cider',
	'restaurant wine', 'eating place beer', 'restaurant beer'
];

function classifyLicense(description: string): 'on-premise' | 'off-premise' | 'restaurant-wine' | 'other' {
	const lower = description.toLowerCase();
	if (ON_PREMISE_PATTERNS.some(p => lower.includes(p))) return 'on-premise';
	if (OFF_PREMISE_PATTERNS.some(p => lower.includes(p))) return 'off-premise';
	if (RESTAURANT_WINE_PATTERNS.some(p => lower.includes(p))) return 'restaurant-wine';
	return 'other';
}

/**
 * Fetch liquor license data near a location.
 */
export async function fetchLiquorLicenses(lat: number,
	lng: number,
	radiusMeters: number = 500, signal?: AbortSignal): Promise<LiquorLicenseData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'liquor-licenses');
	const cached = await intelCache.getAsync<LiquorLicenseData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		const url = `${LIQUOR_BASE}?$where=within_circle(georeference,${lat},${lng},${radiusMeters})&$select=legalname,description,type,class,actualaddressofpremises,city,zipcode,effectivedate,expirationdate&$limit=300`;

		const { socrataFetch } = await import('./socrata-fetch');
		const raw = await socrataFetch<Array<Record<string, unknown>>>(url, 'LiquorLicenses');
		if (!raw || !Array.isArray(raw)) return cached?.data || null;

		const licenses: LiquorLicense[] = raw.map((r: Record<string, unknown>) => ({
			premiseName: String(r.legalname || ''),
			licenseType: String(r.description || ''),
			licenseClass: String(r.class || ''),
			address: String(r.actualaddressofpremises || ''),
			city: String(r.city || ''),
			zip: String(r.zipcode || ''),
			effectiveDate: String(r.effectivedate || ''),
			expirationDate: String(r.expirationdate || ''),
		}));

		// Categorize licenses
		let onPremiseCount = 0;
		let offPremiseCount = 0;
		let restaurantWineCount = 0;

		const typeCounts = new Map<string, number>();
		for (const l of licenses) {
			const desc = l.licenseType;
			typeCounts.set(desc, (typeCounts.get(desc) || 0) + 1);

			const category = classifyLicense(desc);
			if (category === 'on-premise') onPremiseCount++;
			else if (category === 'off-premise') offPremiseCount++;
			else if (category === 'restaurant-wine') restaurantWineCount++;
		}

		const typeBreakdown = Array.from(typeCounts.entries())
			.map(([type, count]) => ({ type, label: type, count }))
			.sort((a, b) => b.count - a.count);

		// Nightlife density: focused on on-premise licenses (bars, clubs, restaurants with full liquor)
		let nightlifeDensity = 0;
		if (onPremiseCount === 0) nightlifeDensity = 5;
		else if (onPremiseCount <= 3) nightlifeDensity = 30;
		else if (onPremiseCount <= 10) nightlifeDensity = 55;
		else if (onPremiseCount <= 20) nightlifeDensity = 75;
		else nightlifeDensity = 90;

		// Overall vibrancy from liquor licenses
		const total = licenses.length;
		let vibrancySignal = 0;
		if (total === 0) vibrancySignal = 5;
		else if (total <= 5) vibrancySignal = 30;
		else if (total <= 15) vibrancySignal = 55;
		else if (total <= 30) vibrancySignal = 75;
		else vibrancySignal = 90;

		// Bonus for diversity (both bars and restaurants = more vibrant)
		if (onPremiseCount > 0 && restaurantWineCount > 0) {
			vibrancySignal = Math.min(100, vibrancySignal + 5);
		}

		const result: LiquorLicenseData = {
			licenses,
			totalCount: licenses.length,
			typeBreakdown,
			onPremiseCount,
			offPremiseCount,
			restaurantWineCount,
			nightlifeDensity,
			vibrancySignal,
			source: 'liquor-licenses',
			fetchedAt: new Date().toISOString(),
		};

		intelCache.set(cacheKey, result, TTL.LICENSES);
		return result;

	} catch (err) {
		console.error('[LiquorLicenses] Fetch error:', err);
		return cached?.data || null;
	}
}
