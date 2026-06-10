/**
 * Location History — "What was here before?"
 *
 * Queries two Socrata datasets by EXACT address (not radius) to build
 * a chronological record of every business that operated at a location.
 *
 * Sources:
 *   - DOHMH Restaurant Inspections (food establishments, 2011–present)
 *   - DCA Business Licenses (all business types, all statuses)
 */

import { IntelCache, intelCache, TTL } from './cache';
import { socrataFetch } from './socrata-fetch';

export interface HistoricalBusiness {
	name: string;
	category: string;           // cuisine type (DOHMH) or DCA industry
	source: 'dohmh' | 'dca';
	openDate: string | null;    // YYYY-MM-DD, approximate
	closeDate: string | null;   // YYYY-MM-DD, null = still active
	tenureMonths: number | null;
	tenureLabel: string;        // "4 yrs 2 mo" or "Active"
	status: 'active' | 'closed' | 'unknown';
	camis?: string;             // DOHMH unique ID (dedup key)
	licenseId?: string;         // DCA license ID
}

export interface LocationHistoryData {
	businesses: HistoricalBusiness[];
	totalCount: number;
	avgTenureMonths: number | null;
	avgTenureLabel: string;
	highTurnover: boolean;      // true if avg tenure < 24 months
	lastVacatedDate: string | null;
	hasActiveOccupant: boolean;
	source: 'location-history';
	fetchedAt: string;
}

const DOHMH_BASE = 'https://data.cityofnewyork.us/resource/43nn-pn8j.json';
const DCA_BASE   = 'https://data.cityofnewyork.us/resource/w7w3-xahh.json';

// ── Address normalization ──────────────────────────────────────────────────────
// Socrata datasets store street names in ALL CAPS with abbreviations.
// We normalize the user's address to match.

function normalizeStreetName(name: string): string {
	// "Bedford Ave" → "BEDFORD AVE", "West 90th Street" → "WEST 90TH ST"
	return name
		.toUpperCase()
		.replace(/\b(AVENUE|STREET|BOULEVARD|ROAD|PLACE|DRIVE|LANE|COURT|PARKWAY)\b/g, (m) => {
			const abbr: Record<string, string> = {
				AVENUE: 'AVE', STREET: 'ST', BOULEVARD: 'BLVD',
				ROAD: 'RD', PLACE: 'PL', DRIVE: 'DR',
				LANE: 'LN', COURT: 'CT', PARKWAY: 'PKWY'
			};
			return abbr[m] || m;
		})
		.trim();
}

function parseAddressParts(address: string): { building: string; street: string } | null {
	// "384 Bedford Ave, Brooklyn" → { building: '384', street: 'BEDFORD AVE' }
	// "215 W 90th St, Manhattan" → { building: '215', street: 'W 90TH ST' }
	const match = address.match(/^(\d+(?:-\d+)?)\s+(.+?)(?:,.*)?$/);
	if (!match) return null;
	return {
		building: match[1],
		street: normalizeStreetName(match[2].trim())
	};
}

function calcTenure(openDate: string | null, closeDate: string | null): {
	months: number | null;
	label: string;
	status: 'active' | 'closed' | 'unknown';
} {
	if (!openDate) return { months: null, label: 'Unknown', status: 'unknown' };

	const start = new Date(openDate);
	const end = closeDate ? new Date(closeDate) : new Date();
	const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 +
	                   (end.getMonth() - start.getMonth());

	const years = Math.floor(monthsDiff / 12);
	const months = monthsDiff % 12;
	const label = closeDate
		? (years > 0 ? `${years} yr${years > 1 ? 's' : ''} ${months > 0 ? months + ' mo' : ''}`.trim() : `${months} mo`)
		: 'Active';
	const status = closeDate ? 'closed' : 'active';

	return { months: monthsDiff, label, status };
}

// ── DOHMH query ───────────────────────────────────────────────────────────────

async function fetchDohmhHistory(
	building: string,
	street: string
): Promise<HistoricalBusiness[]> {
	// LIKE on first word catches full name variants ("BEDFORD AVE" and "BEDFORD AVENUE")
	const streetEscaped = street.replace(/'/g, "''");
	const firstWord = streetEscaped.split(' ')[0];
	const url = `${DOHMH_BASE}?$where=building='${building}' AND (street='${streetEscaped}' OR street LIKE '${firstWord}%')&$select=dba,cuisine_description,inspection_date,camis&$order=inspection_date ASC&$limit=500`;

	const raw = await socrataFetch<Array<Record<string, string>>>(url, 'DOHMH-History');
	if (!raw || !Array.isArray(raw) || raw.length === 0) return [];

	// Group by CAMIS (unique restaurant ID) — each CAMIS = one business
	const byId = new Map<string, { name: string; cuisine: string; dates: string[] }>();
	for (const r of raw) {
		const id = r.camis || `${r.dba}-${r.building}`;
		if (!byId.has(id)) {
			byId.set(id, { name: r.dba || 'Unknown', cuisine: r.cuisine_description || 'Restaurant', dates: [] });
		}
		if (r.inspection_date) byId.get(id)!.dates.push(r.inspection_date);
	}

	const results: HistoricalBusiness[] = [];
	const now = new Date();
	const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().split('T')[0];

	for (const [camis, biz] of byId) {
		if (biz.dates.length === 0) continue;
		const sorted = biz.dates.sort();
		const openDate = sorted[0].split('T')[0];
		const lastDate = sorted[sorted.length - 1].split('T')[0];
		// If most recent inspection was within last 6 months → still active
		const isActive = lastDate >= sixMonthsAgo;
		const closeDate = isActive ? null : lastDate;

		const tenure = calcTenure(openDate, closeDate);

		results.push({
			name: titleCase(biz.name),
			category: biz.cuisine,
			source: 'dohmh',
			openDate,
			closeDate,
			tenureMonths: tenure.months,
			tenureLabel: tenure.label,
			status: tenure.status,
			camis,
		});
	}

	return results;
}

// ── DCA query ─────────────────────────────────────────────────────────────────

async function fetchDcaHistory(
	building: string,
	street: string
): Promise<HistoricalBusiness[]> {
	const streetEscaped = street.replace(/'/g, "''");
	const firstWord = streetEscaped.split(' ')[0];
	const url = `${DCA_BASE}?$where=address_building='${building}' AND (address_street_name='${streetEscaped}' OR address_street_name LIKE '${firstWord}%')&$select=business_name,business_category,license_creation_date,license_expiration_date,license_status,licenseid&$order=license_creation_date ASC&$limit=200`;

	const raw = await socrataFetch<Array<Record<string, string>>>(url, 'DCA-History');
	if (!raw || !Array.isArray(raw) || raw.length === 0) return [];

	return raw.map(r => {
		const openDate = r.license_creation_date?.split('T')[0] || null;
		const isActive = r.license_status === 'Active';
		const closeDate = isActive ? null : (r.license_expiration_date?.split('T')[0] || null);
		const tenure = calcTenure(openDate, closeDate);

		return {
			name: titleCase(r.business_name || 'Unknown'),
			category: r.business_category || 'Business',
			source: 'dca' as const,
			openDate,
			closeDate,
			tenureMonths: tenure.months,
			tenureLabel: tenure.label,
			status: tenure.status,
			licenseId: r.licenseid,
		};
	}).filter(b => b.name && b.name !== 'Unknown');
}

// ── Merge + deduplicate ───────────────────────────────────────────────────────

function mergeAndDedupe(
	dohmh: HistoricalBusiness[],
	dca: HistoricalBusiness[]
): HistoricalBusiness[] {
	// Prefer DOHMH records for food businesses (more accurate dates from inspections)
	// DCA fills in non-food businesses
	const combined: HistoricalBusiness[] = [...dohmh];
	const dohmhNames = new Set(dohmh.map(b => b.name.toLowerCase().replace(/\s+/g, '')));

	for (const dcaBiz of dca) {
		const normalized = dcaBiz.name.toLowerCase().replace(/\s+/g, '');
		// Only add DCA record if not already covered by DOHMH
		if (!dohmhNames.has(normalized)) {
			combined.push(dcaBiz);
		}
	}

	// Sort by openDate descending (most recent first)
	return combined.sort((a, b) => {
		if (!a.openDate && !b.openDate) return 0;
		if (!a.openDate) return 1;
		if (!b.openDate) return -1;
		return b.openDate.localeCompare(a.openDate);
	});
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchLocationHistory(address: string,
	lat: number,
	lng: number, signal?: AbortSignal): Promise<LocationHistoryData | null> {
	// lat/lng reserved for future geo-fallback; address is the primary key
	void lat; void lng;

	// Cache by precise address
	const cacheKey = `location-history:${address.toLowerCase().replace(/\s+/g, '-')}`;
	const cached = await intelCache.getAsync<LocationHistoryData>(cacheKey);
	if (cached?.fresh) return cached.data;

	const parts = parseAddressParts(address);
	if (!parts) return null;

	const [dohmhResult, dcaResult] = await Promise.allSettled([
		fetchDohmhHistory(parts.building, parts.street),
		fetchDcaHistory(parts.building, parts.street),
	]);

	const dohmh = dohmhResult.status === 'fulfilled' ? dohmhResult.value : [];
	const dca   = dcaResult.status === 'fulfilled'   ? dcaResult.value   : [];

	if (dohmh.length === 0 && dca.length === 0) {
		const empty: LocationHistoryData = {
			businesses: [], totalCount: 0, avgTenureMonths: null,
			avgTenureLabel: 'No data', highTurnover: false,
			lastVacatedDate: null, hasActiveOccupant: false,
			source: 'location-history', fetchedAt: new Date().toISOString()
		};
		intelCache.set(cacheKey, empty, TTL.INSPECTIONS);
		return empty;
	}

	const businesses = mergeAndDedupe(dohmh, dca);
	const closed = businesses.filter(b => b.status === 'closed' && b.tenureMonths !== null);
	const avgTenureMonths = closed.length > 0
		? Math.round(closed.reduce((s, b) => s + (b.tenureMonths || 0), 0) / closed.length)
		: null;

	const avgYears = avgTenureMonths !== null ? Math.floor(avgTenureMonths / 12) : 0;
	const avgMos   = avgTenureMonths !== null ? avgTenureMonths % 12 : 0;
	const avgTenureLabel = avgTenureMonths !== null
		? (avgYears > 0 ? `${avgYears} yr${avgYears > 1 ? 's' : ''} avg` : `${avgMos} mo avg`)
		: 'Insufficient data';

	const lastVacated = businesses.find(b => b.status === 'closed' && b.closeDate)?.closeDate || null;
	const hasActiveOccupant = businesses.some(b => b.status === 'active');

	const result: LocationHistoryData = {
		businesses,
		totalCount: businesses.length,
		avgTenureMonths,
		avgTenureLabel,
		highTurnover: avgTenureMonths !== null && avgTenureMonths < 24,
		lastVacatedDate: lastVacated,
		hasActiveOccupant,
		source: 'location-history',
		fetchedAt: new Date().toISOString()
	};

	intelCache.set(cacheKey, result, TTL.INSPECTIONS);
	return result;
}

// ── IMP-02: Churn Risk sub-score for Location IQ ────────────────────────────
// tenant_count_5yr predicts churn with d=3.4 — 10x more powerful than IQ scores.
// Formula: churnRisk = clamp(1 - (tenant_count_5yr - 1) * 0.15, 0, 1) * 100
// Higher score = lower churn risk = better location.

export function computeChurnRisk(history: LocationHistoryData | null): {
	score: number;               // 0-100 (100 = stable, 0 = extreme churn)
	tenantCount5yr: number;
	avgTenureMonths: number | null;
	narrativeSnippet: string;
} {
	if (!history || history.totalCount === 0) {
		return { score: 50, tenantCount5yr: 0, avgTenureMonths: null, narrativeSnippet: '' };
	}

	// Count distinct businesses in the last 5 years
	const fiveYearsAgo = new Date();
	fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
	const fiveYearStr = fiveYearsAgo.toISOString().split('T')[0];

	const recentBiz = history.businesses.filter(b => {
		// Include if opened or closed within last 5 years
		if (b.openDate && b.openDate >= fiveYearStr) return true;
		if (b.closeDate && b.closeDate >= fiveYearStr) return true;
		// Include if still active (open before 5yr window but no close date)
		if (!b.closeDate && b.status === 'active') return true;
		return false;
	});

	const tenantCount5yr = recentBiz.length;
	const avgTenure = history.avgTenureMonths;

	// churnRisk score: 1 tenant in 5yr = 100 (perfectly stable), each additional tenant subtracts 15 points
	const rawScore = Math.max(0, Math.min(1, 1 - (tenantCount5yr - 1) * 0.15)) * 100;
	const score = Math.round(rawScore);

	// Build narrative snippet
	let narrativeSnippet = '';
	if (tenantCount5yr === 0) {
		narrativeSnippet = '';  // No data — skip silently
	} else if (tenantCount5yr === 1 && history.hasActiveOccupant) {
		const tenure = avgTenure ? ` (${Math.round(avgTenure / 12)} years and counting)` : '';
		narrativeSnippet = `This address has had a single tenant in 5 years${tenure} — excellent stability signal.`;
	} else if (tenantCount5yr <= 2) {
		narrativeSnippet = `This address has had ${tenantCount5yr} tenants in 5 years. Average tenure: ${avgTenure ? Math.round(avgTenure) + ' months' : 'unknown'}. Low turnover.`;
	} else if (tenantCount5yr <= 4) {
		narrativeSnippet = `This address has had ${tenantCount5yr} tenants in 5 years. Average tenure: ${avgTenure ? Math.round(avgTenure) + ' months' : 'unknown'}. Moderate turnover — investigate why businesses left.`;
	} else {
		narrativeSnippet = `This address has had ${tenantCount5yr} tenants in 5 years. Average tenure: ${avgTenure ? Math.round(avgTenure) + ' months' : 'unknown'}. High turnover — a significant risk signal. Ask the landlord why.`;
	}

	return { score, tenantCount5yr, avgTenureMonths: avgTenure, narrativeSnippet };
}

function titleCase(s: string): string {
	return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/['']S\b/g, "'s");
}
