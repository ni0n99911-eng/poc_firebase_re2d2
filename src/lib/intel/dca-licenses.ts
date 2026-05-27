/**
 * NYC DCA Business Licenses client.
 *
 * Fetches active business licenses from NYC Open Data (Socrata API).
 * Free, no API key required.
 * Dataset: https://data.cityofnewyork.us/Business/Legally-Operating-Businesses/w7w3-xahh
 *
 * Provides:
 * - Business density near a location
 * - Industry mix (what types of businesses are nearby)
 * - New business rate (licenses issued recently)
 * - Business ecosystem score for location intelligence
 */

import { IntelCache, intelCache, TTL, socrataBoxWhere } from './cache';

export interface LicensedBusiness {
	name: string;
	industry: string;
	licenseType: string;
	status: string;
	startDate: string;
	address: string;
}

export interface DCALicenseData {
	businesses: LicensedBusiness[];
	totalCount: number;
	industryBreakdown: { industry: string; count: number }[];
	newBusinessRate: number;       // % of businesses opened in last 12 months
	businessDensity: number;       // businesses per sq mile
	ecosystemScore: number;        // 0-100 (higher = healthier ecosystem)
	source: 'dca-licenses';
	fetchedAt: string;
}

// DCA Legally Operating Businesses
const DCA_BASE = 'https://data.cityofnewyork.us/resource/w7w3-xahh.json';

/**
 * Fetch DCA license data near a location.
 */
export async function fetchDCALicenses(
	lat: number,
	lng: number,
	radiusMeters: number = 500
): Promise<DCALicenseData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'dca-licenses');
	const cached = await intelCache.getAsync<DCALicenseData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		// Query active businesses within radius
		// This dataset has latitude/longitude scalar columns (no geometry column)
		const bbox = socrataBoxWhere('latitude', 'longitude', lat, lng, radiusMeters);
		const url = `${DCA_BASE}?$where=${bbox} AND license_status='Active'&$select=business_name,business_category,license_type,license_status,license_creation_date,address_building,address_street_name&$order=license_creation_date DESC&$limit=500`;

		const { socrataFetch } = await import('./socrata-fetch');
		const raw = await socrataFetch<Array<Record<string, string>>>(url, 'DCA');
		if (!raw || !Array.isArray(raw)) return cached?.data || null;

		const oneYearAgo = new Date();
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
		let newCount = 0;

		const industryCounts: Record<string, number> = {};

		const businesses: LicensedBusiness[] = raw.map((r: Record<string, string>) => {
			const industry = r.business_category || 'Unknown';
			industryCounts[industry] = (industryCounts[industry] || 0) + 1;

			const creationDate = r.license_creation_date?.split('T')[0] || '';
			if (creationDate && new Date(creationDate) > oneYearAgo) {
				newCount++;
			}

			return {
				name: r.business_name || 'Unknown',
				industry,
				licenseType: r.license_type || '',
				status: r.license_status || 'Active',
				startDate: creationDate,
				address: `${r.address_building || ''} ${r.address_street_name || ''}`.trim()
			};
		});

		// Industry breakdown sorted by count
		const industryBreakdown = Object.entries(industryCounts)
			.map(([industry, count]) => ({ industry, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		// New business rate
		const newBusinessRate = businesses.length > 0
			? Math.round((newCount / businesses.length) * 100)
			: 0;

		// Business density per sq mile
		const radiusMi = radiusMeters / 1609.34;
		const areaSqMi = Math.PI * radiusMi * radiusMi;
		const businessDensity = areaSqMi > 0 ? Math.round(businesses.length / areaSqMi) : 0;

		const ecosystemScore = computeEcosystemScore(businesses.length, industryBreakdown.length, newBusinessRate, areaSqMi);

		const result: DCALicenseData = {
			businesses,
			totalCount: businesses.length,
			industryBreakdown,
			newBusinessRate,
			businessDensity,
			ecosystemScore,
			source: 'dca-licenses',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.LICENSES);
		return result;
	} catch (e) {
		console.error('[DCA] Fetch error:', e);
		return cached?.data || null;
	}
}

/**
 * Compute a business ecosystem health score.
 * 100 = thriving diverse ecosystem, 0 = dead zone.
 */
function computeEcosystemScore(
	totalBusinesses: number,
	industryCount: number,
	newBusinessRate: number,
	areaSqMi: number
): number {
	if (areaSqMi === 0) return 50;

	const density = totalBusinesses / areaSqMi;

	// Base score from density
	// NYC commercial areas: 500-2000+ per sq mi
	let score: number;
	if (density >= 1000) score = 80 + Math.min(15, Math.round((density - 1000) / 1000 * 15));
	else if (density >= 500) score = 65 + Math.round((density - 500) / 500 * 15);
	else if (density >= 200) score = 45 + Math.round((density - 200) / 300 * 20);
	else if (density >= 50) score = 25 + Math.round((density - 50) / 150 * 20);
	else score = Math.round(density / 50 * 25);

	// Diversity bonus: more industry types = healthier ecosystem
	if (industryCount >= 8) score += 10;
	else if (industryCount >= 5) score += 5;

	// New business rate bonus: 10-25% is healthy turnover
	if (newBusinessRate >= 10 && newBusinessRate <= 30) score += 5;
	else if (newBusinessRate > 30) score -= 5; // too much churn

	return Math.max(0, Math.min(100, score));
}
