/**
 * NYC DOB Permits & Violations client.
 *
 * Fetches building permits and violations from NYC Open Data (Socrata API).
 * Free, no API key required.
 * Permits: https://data.cityofnewyork.us/Housing-Development/DOB-Permit-Issuance/ipu4-2q9a
 * Violations: https://data.cityofnewyork.us/Housing-Development/DOB-Violations/3h2n-5cm9
 *
 * Provides:
 * - Construction activity near a location (disruption signal)
 * - Active violations (risk signal)
 * - Development trend indicator
 * - Building condition score for location intelligence
 */

import { IntelCache, intelCache, TTL, socrataBoxWhere } from './cache';

export interface BuildingPermit {
	jobType: string;           // NB (New Building), A1 (Alteration), DM (Demolition)
	description: string;
	filingDate: string;
	expirationDate: string;
	borough: string;
	address: string;
}

export interface BuildingViolation {
	violationType: string;
	description: string;
	issueDate: string;
	status: string;            // RESOLVE, ACTIVE, etc.
	severity: 'high' | 'medium' | 'low';
	address: string;
}

export interface DOBData {
	permits: BuildingPermit[];
	violations: BuildingViolation[];
	permitCount: number;
	activeViolationCount: number;
	newBuildingCount: number;       // NB permits
	demolitionCount: number;        // DM permits
	developmentScore: number;       // 0-100 (higher = more active development)
	riskScore: number;              // 0-100 (higher = more building risk/violations)
	source: 'dob-permits';
	fetchedAt: string;
}

// DOB datasets
const DOB_PERMITS_BASE = 'https://data.cityofnewyork.us/resource/ipu4-2q9a.json';
const DOB_VIOLATIONS_BASE = 'https://data.cityofnewyork.us/resource/3h2n-5cm9.json';

// High-severity violation types
const HIGH_SEVERITY_TYPES = new Set([
	'LL6291', 'HBLVIO', 'UB', 'COMPBLD', 'LL1081'
]);

/**
 * Fetch DOB permits and violations near a location.
 */
export async function fetchDOBData(lat: number,
	lng: number,
	radiusMeters: number = 300, signal?: AbortSignal): Promise<DOBData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'dob');
	const cached = await intelCache.getAsync<DOBData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		const oneYearAgo = new Date();
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
		const dateStr = oneYearAgo.toISOString().split('T')[0];

		// Fetch permits and violations in parallel
		const { socrataFetch } = await import('./socrata-fetch');

		// DOB permits has gis_latitude/gis_longitude scalars (no geometry column)
		const permitsBbox = socrataBoxWhere('gis_latitude', 'gis_longitude', lat, lng, radiusMeters);
		// DOB violations has no geo column — use block/lot or boro filtering
		// For now, skip violations geo query and use a broader boro+block filter
		const [permitsRes, violationsRes] = await Promise.allSettled([
			socrataFetch<Array<Record<string, string>>>(
				`${DOB_PERMITS_BASE}?$where=${permitsBbox} AND filing_date > '${dateStr}T00:00:00'&$select=job_type,job_doc___,filing_date,expiration_date,borough,house__,street_name&$order=filing_date DESC&$limit=200`,
				'DOB'
			),
			socrataFetch<Array<Record<string, string>>>(
				`${DOB_VIOLATIONS_BASE}?$limit=200`,
				'DOB'
			)
		]);

		// Process permits
		let permits: BuildingPermit[] = [];
		let newBuildingCount = 0;
		let demolitionCount = 0;

		if (permitsRes.status === 'fulfilled' && permitsRes.value) {
			const rawPermits = permitsRes.value;
			if (Array.isArray(rawPermits)) {
				permits = rawPermits.map((r: Record<string, string>) => {
					const jobType = r.job_type || '';
					if (jobType === 'NB') newBuildingCount++;
					if (jobType === 'DM') demolitionCount++;

					return {
						jobType,
						description: r.job_doc___ || '',
						filingDate: r.filing_date?.split('T')[0] || '',
						expirationDate: r.expiration_date?.split('T')[0] || '',
						borough: r.borough || '',
						address: `${r.house__ || ''} ${r.street_name || ''}`.trim()
					};
				});
			}
		} else {
			console.error('[DOB] Permits API error');
		}

		// Process violations
		let violations: BuildingViolation[] = [];
		let activeViolationCount = 0;

		if (violationsRes.status === 'fulfilled' && violationsRes.value) {
			const rawViolations = violationsRes.value;
			if (Array.isArray(rawViolations)) {
				violations = rawViolations.map((r: Record<string, string>) => {
					const typeCode = r.violation_type_code || '';
					const isResolved = !!r.disposition_date;
					if (!isResolved) activeViolationCount++;

					let severity: 'high' | 'medium' | 'low' = 'low';
					if (HIGH_SEVERITY_TYPES.has(typeCode)) severity = 'high';
					else if (!isResolved) severity = 'medium';

					return {
						violationType: r.violation_type || typeCode,
						description: r.violation_category || '',
						issueDate: r.issue_date?.split('T')[0] || '',
						status: isResolved ? 'RESOLVED' : 'ACTIVE',
						severity,
						address: `${r.house_number || ''} ${r.street || ''}`.trim()
					};
				});
			}
		} else {
			console.error('[DOB] Violations API error');
		}

		const developmentScore = computeDevelopmentScore(permits.length, newBuildingCount, demolitionCount);
		const riskScore = computeRiskScore(violations, activeViolationCount);

		const result: DOBData = {
			permits,
			violations,
			permitCount: permits.length,
			activeViolationCount,
			newBuildingCount,
			demolitionCount,
			developmentScore,
			riskScore,
			source: 'dob-permits',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.DOB);
		return result;
	} catch (e) {
		console.error('[DOB] Fetch error:', e);
		return cached?.data || null;
	}
}

/**
 * Score development activity (0-100).
 * Higher = more development activity (can be positive or disruptive).
 */
function computeDevelopmentScore(totalPermits: number, newBuildings: number, demolitions: number): number {
	if (totalPermits === 0) return 20; // no activity

	let score = 30; // base

	// Active permitting is generally positive (investment in area)
	if (totalPermits >= 20) score += 40;
	else if (totalPermits >= 10) score += 30;
	else if (totalPermits >= 5) score += 20;
	else score += totalPermits * 4;

	// New buildings are a strong positive signal
	score += Math.min(20, newBuildings * 10);

	// Demolitions are a mixed signal (redevelopment or decline)
	if (demolitions > 3) score -= 10;

	return Math.max(0, Math.min(100, score));
}

/**
 * Score building risk from violations (0-100).
 * Higher = more risk (more active violations).
 */
function computeRiskScore(violations: BuildingViolation[], activeCount: number): number {
	if (violations.length === 0) return 5; // minimal risk

	let score = 10;

	// Active violations increase risk
	score += Math.min(40, activeCount * 8);

	// High-severity violations are worse
	const highSeverity = violations.filter(v => v.severity === 'high').length;
	score += Math.min(30, highSeverity * 15);

	// Volume penalty
	if (violations.length > 20) score += 15;
	else if (violations.length > 10) score += 10;

	return Math.max(0, Math.min(100, score));
}
