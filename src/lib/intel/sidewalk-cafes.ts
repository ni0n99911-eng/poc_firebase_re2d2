/**
 * NYC Sidewalk Café Permits client.
 *
 * Fetches sidewalk café permits from NYC Open Data (Socrata API).
 * Dataset: https://data.cityofnewyork.us/Business/Sidewalk-Caf-Licenses-and-Applications/qcdj-rwhu
 *
 * Provides:
 * - Active sidewalk café permit count near a location
 * - Permit types (enclosed, unenclosed, small sidewalk café)
 * - Seasonal/permanent breakdown
 * - Vibrancy signal: areas with more sidewalk cafés are typically more commercially vibrant
 *
 * Feeds into: Vibrancy Index
 */

import { IntelCache, intelCache, TTL } from './cache';

export interface SidewalkCafePermit {
	businessName: string;
	buildingNumber: string;
	street: string;
	borough: string;
	licenseType: string;       // 'Enclosed', 'Unenclosed', 'Small Sidewalk Café'
	licenseStatus: string;     // 'Active', 'Expired', etc.
	seatingCapacity: number;
	issuanceDate: string;
	expirationDate: string;
}

export interface SidewalkCafeData {
	permits: SidewalkCafePermit[];
	totalCount: number;
	activeCount: number;
	expiredCount: number;
	typeBreakdown: { type: string; count: number }[];
	totalSeatingCapacity: number;
	vibrancySignal: number;    // 0-100: how much sidewalk café activity signals street vitality
	source: 'sidewalk-cafes';
	fetchedAt: string;
}

// NYC Sidewalk Café Licenses and Applications
const CAFE_BASE = 'https://data.cityofnewyork.us/resource/qcdj-rwhu.json';

/**
 * Approximate conversion from WGS-84 lat/lng to NY State Plane (Long Island zone, EPSG:2263).
 * Returns coordinates in US survey feet. Accuracy ~50ft for NYC, sufficient for proximity queries.
 * Calibration points: City Hall (40.7128,-74.0060)→(981000,197000), Grand Central (40.7527,-73.9772)→(990000,211500)
 */
function toStatePlane(lat: number, lng: number): { x: number; y: number } {
	// Linear approximation calibrated for NYC area
	const refLat = 40.7128, refLng = -74.0060;
	const refX = 981000, refY = 197000;
	const ftPerDegLng = 312500;  // ~ft per degree longitude at NYC latitude
	const ftPerDegLat = 363400;  // ~ft per degree latitude
	return {
		x: refX + (lng - refLng) * ftPerDegLng,
		y: refY + (lat - refLat) * ftPerDegLat
	};
}

/**
 * Fetch sidewalk café permit data near a location.
 */
export async function fetchSidewalkCafes(lat: number,
	lng: number,
	radiusMeters: number = 500, signal?: AbortSignal): Promise<SidewalkCafeData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'sidewalk-cafes');
	const cached = await intelCache.getAsync<SidewalkCafeData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		// Dataset uses State Plane coordinates (final_x, final_y) in US survey feet.
		// Convert lat/lng to State Plane and query with a bounding box.
		const { x, y } = toStatePlane(lat, lng);
		const radiusFt = radiusMeters * 3.28084;
		const minX = Math.round(x - radiusFt);
		const maxX = Math.round(x + radiusFt);
		const minY = Math.round(y - radiusFt);
		const maxY = Math.round(y + radiusFt);

		const url = `${CAFE_BASE}?$where=lic_status='Active' AND final_x between '${minX}' and '${maxX}' AND final_y between '${minY}' and '${maxY}'&$select=business_name,building,street,zip,swc_type,lic_status,swc_sq_ft,swc_tables,swc_chairs&$limit=200`;

		const { socrataFetch } = await import('./socrata-fetch');
		const raw = await socrataFetch<Array<Record<string, unknown>>>(url, 'SidewalkCafes');
		if (!raw || !Array.isArray(raw)) return cached?.data || null;

		const permits: SidewalkCafePermit[] = raw.map((r: Record<string, unknown>) => ({
			businessName: String(r.business_name || ''),
			buildingNumber: String(r.building || ''),
			street: String(r.street || ''),
			borough: String(r.zip || ''),
			licenseType: String(r.swc_type || 'Unknown'),
			licenseStatus: String(r.lic_status || 'Unknown'),
			seatingCapacity: parseInt(String(r.swc_chairs || '0'), 10) || 0,
			issuanceDate: '',
			expirationDate: '',
		}));

		const activePermits = permits.filter(p =>
			p.licenseStatus.toLowerCase().includes('active') ||
			p.licenseStatus.toLowerCase().includes('issued')
		);
		const expiredPermits = permits.filter(p =>
			p.licenseStatus.toLowerCase().includes('expired') ||
			p.licenseStatus.toLowerCase().includes('revoked')
		);

		// Type breakdown
		const typeCounts = new Map<string, number>();
		for (const p of permits) {
			const type = p.licenseType || 'Unknown';
			typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
		}
		const typeBreakdown = Array.from(typeCounts.entries())
			.map(([type, count]) => ({ type, count }))
			.sort((a, b) => b.count - a.count);

		const totalSeatingCapacity = permits.reduce((sum, p) => sum + p.seatingCapacity, 0);

		// Vibrancy signal: 0-100
		// More active sidewalk cafés = more vibrant street life
		// Benchmarks: 0 = dead, 3-5 = normal, 10+ = very vibrant
		let vibrancySignal = 0;
		const activeCount = activePermits.length;
		if (activeCount === 0) vibrancySignal = 10;
		else if (activeCount <= 2) vibrancySignal = 35;
		else if (activeCount <= 5) vibrancySignal = 60;
		else if (activeCount <= 10) vibrancySignal = 80;
		else vibrancySignal = 90;

		// Boost for high seating capacity
		if (totalSeatingCapacity > 100) vibrancySignal = Math.min(100, vibrancySignal + 5);
		// Boost for variety of types
		if (typeBreakdown.length > 1) vibrancySignal = Math.min(100, vibrancySignal + 5);

		const result: SidewalkCafeData = {
			permits,
			totalCount: permits.length,
			activeCount,
			expiredCount: expiredPermits.length,
			typeBreakdown,
			totalSeatingCapacity,
			vibrancySignal,
			source: 'sidewalk-cafes',
			fetchedAt: new Date().toISOString(),
		};

		intelCache.set(cacheKey, result, TTL.WALKABILITY); // 7 day TTL — permits don't change often
		return result;

	} catch (err) {
		console.error('[SidewalkCafes] Fetch error:', err);
		return cached?.data || null;
	}
}
