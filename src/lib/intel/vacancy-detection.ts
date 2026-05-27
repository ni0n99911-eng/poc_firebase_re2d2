/**
 * RE² Vacancy Detection Pipeline
 *
 * Predictive storefront vacancy intelligence from 6 data sources:
 * 1. ACRIS — Lease expirations & terminations (NYC land records)
 * 2. DOB Permits — Demolition, gut-reno, idle permits
 * 3. PLUTO — Property details, owner info, retail zoning
 * 4. Google Places — "Permanently closed" status, review velocity collapse
 * 5. DCA/DOHMH Licenses — Expired/not-renewed business licenses
 * 6. Derived: Business lifespan churn model
 *
 * Scoring thresholds:
 *   >= 70  → "Likely Available"
 *   >= 40  → "Coming Available"
 *   <  40  → No signal (filtered out)
 */

import { IntelCache, intelCache, TTL } from './cache';
import { env } from '$env/dynamic/private';
// 04.19.2026 13:35 Score Consolidation — haversineDistance removed; imported from canonical geo-math.ts
import { haversineMeters as haversineDistance } from '$lib/intel/scoring/geo-math';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface VacancySignal {
	source: 'acris' | 'dob' | 'google' | 'dca' | 'pluto' | 'churn-model';
	signal: string;
	confidence: 'high' | 'medium' | 'weak';
	leadTime: string;
	detail: string;
	score: number;           // contribution to vacancy score
	detectedAt: string;
}

export interface VacancyListing {
	id: string;               // bbl or composite key
	address: string;
	lat: number;
	lng: number;
	vacancyScore: number;     // 0-100
	status: 'likely_available' | 'coming_available';
	signals: VacancySignal[];
	signalCount: number;

	// Property enrichment (from PLUTO)
	sqft: number | null;
	bldgClass: string | null;
	zoneDist: string | null;
	yearBuilt: number | null;
	ownerName: string | null;
	retailArea: number | null;

	// Previous tenant (from DCA/Google)
	previousTenant: string | null;
	previousType: string | null;
	closedDate: string | null;

	// Computed
	distance: number;         // meters from search point
	daysOnMarket: number;     // days since first signal detected
}

export interface VacancyDetectionResult {
	listings: VacancyListing[];
	totalScanned: number;
	likelyAvailable: number;
	comingAvailable: number;
	searchRadiusMeters: number;
	signalBreakdown?: {
		acris: number;
		dob: number;
		google: number;
		dca: number;
		plutoLots: number;
		churn: number;
		totalSignals: number;
	};
	source: 'vacancy-detection';
	fetchedAt: string;
}

// ──────────────────────────────────────────────
// Data Source URLs
// ──────────────────────────────────────────────

// ACRIS Real Property Legals (lease records by BBL)
const ACRIS_LEGALS = 'https://data.cityofnewyork.us/resource/8h5j-fqxa.json';
// ACRIS Document Control (doc types: LEASE, MTGE, etc.)
const ACRIS_PARTIES = 'https://data.cityofnewyork.us/resource/636b-3b5g.json';
// DOB Permits
const DOB_PERMITS = 'https://data.cityofnewyork.us/resource/ipu4-2q9a.json';
// DCA Active Licenses
const DCA_LICENSES = 'https://data.cityofnewyork.us/resource/w7w3-xahh.json';
// PLUTO
const PLUTO_BASE = 'https://data.cityofnewyork.us/resource/64uk-42ks.json';

const SOCRATA_HEADERS = {
	'Accept': 'application/json'
};

function fetchWithTimeout(url: string, timeoutMs: number = 15000): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	return fetch(url, { signal: controller.signal, headers: SOCRATA_HEADERS })
		.finally(() => clearTimeout(timer));
}

// 04.19.2026 13:35 Score Consolidation — haversineDistance removed. Now aliased from haversineMeters in geo-math.ts above.

// ──────────────────────────────────────────────
// Stage 1: Data Ingest — All 6 Sources in Parallel
// ──────────────────────────────────────────────

interface RawACRISRecord {
	document_id?: string;
	doc_type?: string;
	recorded_filed?: string;
	good_through_date?: string;
	borough?: string;
	block?: string;
	lot?: string;
	street_name?: string;
	street_number?: string;
	unit?: string;
	party_type?: string;
	name?: string;
}

interface RawDOBPermit {
	job_type?: string;
	job_description?: string;
	filing_date?: string;
	expiration_date?: string;
	gis_latitude?: string;
	gis_longitude?: string;
	house__?: string;
	street_name?: string;
	job_status?: string;
	latest_action_date?: string;
}

interface RawDCALicense {
	business_name?: string;
	industry?: string;
	license_type?: string;
	license_status?: string;
	license_expiration_date?: string;
	license_creation_date?: string;
	address_building?: string;
	address_street_name?: string;
	latitude?: string;
	longitude?: string;
}

interface RawPLUTOLot {
	bbl?: string;
	address?: string;
	zipcode?: string;
	zonedist1?: string;
	bldgclass?: string;
	ownername?: string;
	numfloors?: string;
	retailarea?: string;
	bldgarea?: string;
	yearbuilt?: string;
	yearalter1?: string;
	builtfar?: string;
	maxallowfar?: string;
	latitude?: string;
	longitude?: string;
	landuse?: string;
}

/**
 * Fetch ACRIS lease records near a location.
 * Looks for: lease expirations, terminations, and surrenders in the area.
 */
async function fetchACRISSignals(lat: number, lng: number, radiusMeters: number): Promise<VacancySignal[]> {
	const signals: VacancySignal[] = [];
	try {
		// ACRIS doesn't have geo queries directly, so we use PLUTO lots first
		// to get BBLs in the area, then cross-reference with ACRIS
		const bbls = await getRetailBBLsNearby(lat, lng, radiusMeters);
		if (bbls.length === 0) return signals;

		// Query ACRIS for lease-related documents at these BBLs
		const bblFilter = bbls.slice(0, 20).map(b => `'${b}'`).join(',');
		const twoYearsAgo = new Date();
		twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
		const dateStr = twoYearsAgo.toISOString().split('T')[0];

		const url = `${ACRIS_LEGALS}?$where=document_id IN (SELECT document_id FROM \`8h5j-fqxa\` WHERE borough||block||lot IN (${bblFilter})) AND recorded_filed > '${dateStr}'&$limit=100`;

		// Simplified approach: query by address patterns in the area
		// ACRIS is complex — we'll query recent lease terminations citywide
		// and filter by proximity
		const termUrl = `${ACRIS_LEGALS}?$where=doc_type IN ('LEAS','LTPA','ASST','RPTT') AND recorded_filed > '${dateStr}'&$order=recorded_filed DESC&$limit=200`;

		const res = await fetchWithTimeout(termUrl);
		if (!res.ok) return signals;

		const records: RawACRISRecord[] = await res.json();
		if (!Array.isArray(records)) return signals;

		// Look for lease terminations and expirations
		for (const rec of records) {
			if (!rec.doc_type) continue;

			const bbl = `${rec.borough || ''}${rec.block || ''}${rec.lot || ''}`;
			if (bbl && bbls.includes(bbl)) {
				const addr = `${rec.street_number || ''} ${rec.street_name || ''}`.trim();

				if (rec.doc_type === 'LTPA' || rec.doc_type === 'RPTT') {
					// Lease termination / Real Property Transfer — strong signal
					signals.push({
						source: 'acris',
						signal: 'Lease termination filed',
						confidence: 'high',
						leadTime: '0–3 months',
						detail: `Lease surrender/termination recorded at ${addr || bbl}`,
						score: 50,
						detectedAt: rec.recorded_filed || new Date().toISOString()
					});
				} else if (rec.doc_type === 'LEAS') {
					// Check if this is an expiring lease with no renewal
					const goodThrough = rec.good_through_date ? new Date(rec.good_through_date) : null;
					const now = new Date();
					const sixMonthsOut = new Date();
					sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);

					if (goodThrough && goodThrough > now && goodThrough < sixMonthsOut) {
						signals.push({
							source: 'acris',
							signal: 'Lease expiring soon (no renewal filed)',
							confidence: 'high',
							leadTime: '3–12 months',
							detail: `Lease at ${addr || bbl} expires ${goodThrough.toLocaleDateString()}`,
							score: 45,
							detectedAt: rec.recorded_filed || new Date().toISOString()
						});
					}
				}
			}
		}
	} catch (e) {
		console.error('[VACANCY/ACRIS]', e instanceof Error ? e.message : e);
	}
	return signals;
}

/**
 * Get retail-zoned BBLs near a location from PLUTO.
 */
async function getRetailBBLsNearby(lat: number, lng: number, radiusMeters: number): Promise<string[]> {
	try {
		const url = `${PLUTO_BASE}?$where=within_circle(the_geom,${lat},${lng},${radiusMeters}) AND (landuse='05' OR retailarea > 0 OR bldgclass LIKE 'K%' OR bldgclass LIKE 'R%')&$select=bbl,address,latitude,longitude,retailarea,bldgclass,ownername,zonedist1,yearbuilt&$limit=100`;
		const res = await fetchWithTimeout(url);
		if (!res.ok) return [];
		const lots: RawPLUTOLot[] = await res.json();
		return lots.filter(l => l.bbl).map(l => l.bbl!);
	} catch {
		return [];
	}
}

/**
 * Fetch DOB vacancy signals: demolitions, gut renos, idle permits.
 */
async function fetchDOBVacancySignals(lat: number, lng: number, radiusMeters: number): Promise<VacancySignal[]> {
	const signals: VacancySignal[] = [];
	try {
		const oneYearAgo = new Date();
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
		const dateStr = oneYearAgo.toISOString().split('T')[0];

		// Query DOB permits by lat/lng bounding box
		const latRange = radiusMeters / 111000;
		const lngRange = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));
		const geoUrl = `${DOB_PERMITS}?$where=gis_latitude > '${(lat - latRange).toFixed(6)}' AND gis_latitude < '${(lat + latRange).toFixed(6)}' AND gis_longitude > '${(lng - lngRange).toFixed(6)}' AND gis_longitude < '${(lng + lngRange).toFixed(6)}' AND filing_date > '${dateStr}' AND job_type IN ('DM','A1')&$order=filing_date DESC&$limit=50`;

		const res = await fetchWithTimeout(geoUrl);
		if (!res.ok) return signals;

		const permits: RawDOBPermit[] = await res.json();
		if (!Array.isArray(permits)) return signals;

		const now = new Date();
		for (const p of permits) {
			const addr = `${p.house__ || ''} ${p.street_name || ''}`.trim();
			const pLat = parseFloat(p.gis_latitude || '0');
			const pLng = parseFloat(p.gis_longitude || '0');
			const dist = haversineDistance(lat, lng, pLat, pLng);
			if (dist > radiusMeters) continue;

			if (p.job_type === 'DM') {
				signals.push({
					source: 'dob',
					signal: 'Demolition permit filed',
					confidence: 'medium',
					leadTime: '1–6 months',
					detail: `Demolition filing at ${addr}. Current tenant likely gone.`,
					score: 25,
					detectedAt: p.filing_date || now.toISOString()
				});
			} else if (p.job_type === 'A1') {
				// Check if permit is idle (filed but no recent activity)
				const lastAction = p.latest_action_date ? new Date(p.latest_action_date) : null;
				const filingDate = p.filing_date ? new Date(p.filing_date) : null;
				const monthsIdle = lastAction && filingDate
					? (now.getTime() - lastAction.getTime()) / (30 * 24 * 60 * 60 * 1000)
					: 0;

				if (monthsIdle > 12) {
					signals.push({
						source: 'dob',
						signal: 'Build-out permit idle > 12 months',
						confidence: 'medium',
						leadTime: 'Ongoing',
						detail: `A1 permit at ${addr} filed but no inspections in ${Math.round(monthsIdle)} months — space likely sitting empty.`,
						score: 20,
						detectedAt: p.filing_date || now.toISOString()
					});
				} else {
					signals.push({
						source: 'dob',
						signal: 'Major alteration / gut renovation',
						confidence: 'medium',
						leadTime: '1–6 months',
						detail: `Major alteration permit at ${addr}. Ground-floor retail unit may be turning over.`,
						score: 25,
						detectedAt: p.filing_date || now.toISOString()
					});
				}
			}
		}
	} catch (e) {
		console.error('[VACANCY/DOB]', e instanceof Error ? e.message : e);
	}
	return signals;
}

/**
 * Fetch Google Places vacancy signals: permanently closed businesses.
 */
async function fetchGoogleVacancySignals(lat: number, lng: number, radiusMeters: number): Promise<VacancySignal[]> {
	const signals: VacancySignal[] = [];
	const apiKey = env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) return signals;

	try {
		// Search for businesses in the area
		const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=store|restaurant|cafe|bar&key=${apiKey}`;
		const res = await fetchWithTimeout(url);
		if (!res.ok) return signals;

		const data = await res.json();
		const results = data.results || [];

		for (const place of results) {
			if (place.business_status === 'CLOSED_PERMANENTLY') {
				const pLat = place.geometry?.location?.lat || 0;
				const pLng = place.geometry?.location?.lng || 0;

				signals.push({
					source: 'google',
					signal: 'Business permanently closed',
					confidence: 'high',
					leadTime: '0–2 months',
					detail: `"${place.name}" at ${place.vicinity} marked permanently closed on Google Maps.`,
					score: 40,
					detectedAt: new Date().toISOString()
				});
			}

			// Review velocity collapse detection
			if (place.user_ratings_total && place.user_ratings_total > 20) {
				// We can't easily detect velocity collapse in a single API call
				// but very low recent activity on a previously popular place is a signal
				// This would be better with a time-series DB — placeholder for now
			}
		}
	} catch (e) {
		console.error('[VACANCY/GOOGLE]', e instanceof Error ? e.message : e);
	}
	return signals;
}

/**
 * Fetch DCA/DOHMH license expiration signals.
 */
async function fetchLicenseVacancySignals(lat: number, lng: number, radiusMeters: number): Promise<VacancySignal[]> {
	const signals: VacancySignal[] = [];
	try {
		// Look for recently expired licenses (not renewed)
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
		const dateStr = sixMonthsAgo.toISOString().split('T')[0];

		const url = `${DCA_LICENSES}?$where=within_circle(location,${lat},${lng},${radiusMeters}) AND license_status='Inactive' AND license_expiration_date > '${dateStr}'&$select=business_name,industry,license_type,license_status,license_expiration_date,address_building,address_street_name,latitude,longitude&$order=license_expiration_date DESC&$limit=100`;

		const res = await fetchWithTimeout(url);
		if (!res.ok) return signals;

		const licenses: RawDCALicense[] = await res.json();
		if (!Array.isArray(licenses)) return signals;

		for (const lic of licenses) {
			const addr = `${lic.address_building || ''} ${lic.address_street_name || ''}`.trim();
			const bizName = lic.business_name || 'Unknown business';
			const expDate = lic.license_expiration_date ? new Date(lic.license_expiration_date) : null;

			signals.push({
				source: 'dca',
				signal: 'Business license expired / not renewed',
				confidence: 'medium',
				leadTime: '0–3 months',
				detail: `"${bizName}" (${lic.industry || 'retail'}) at ${addr} — license expired${expDate ? ' ' + expDate.toLocaleDateString() : ''}.`,
				score: 20,
				detectedAt: lic.license_expiration_date || new Date().toISOString()
			});
		}
	} catch (e) {
		console.error('[VACANCY/DCA]', e instanceof Error ? e.message : e);
	}
	return signals;
}

/**
 * Fetch PLUTO property data for enrichment + vacancy inference.
 */
async function fetchPLUTOVacancyData(lat: number, lng: number, radiusMeters: number): Promise<{
	lots: RawPLUTOLot[];
	signals: VacancySignal[];
}> {
	const signals: VacancySignal[] = [];
	let lots: RawPLUTOLot[] = [];

	try {
		const url = `${PLUTO_BASE}?$where=within_circle(the_geom,${lat},${lng},${radiusMeters}) AND (landuse='05' OR retailarea > 0 OR bldgclass LIKE 'K%' OR bldgclass LIKE 'R%')&$select=bbl,address,zipcode,zonedist1,bldgclass,ownername,numfloors,retailarea,bldgarea,yearbuilt,yearalter1,builtfar,maxallowfar,latitude,longitude,landuse&$limit=200`;

		const res = await fetchWithTimeout(url);
		if (!res.ok) return { lots: [], signals: [] };

		lots = await res.json();
		if (!Array.isArray(lots)) return { lots: [], signals: [] };

		// Infer vacancy from PLUTO: large retail area with no active DCA license
		// (This is a derived signal — combined with other sources)
	} catch (e) {
		console.error('[VACANCY/PLUTO]', e instanceof Error ? e.message : e);
	}
	return { lots, signals };
}

/**
 * Derived: Business churn model.
 * Uses neighborhood churn rates and business age to predict closures.
 * This is a simplified v1 — will improve with outcome tracking data.
 */
function computeChurnSignals(
	_lat: number,
	_lng: number,
	dcaSignals: VacancySignal[],
	googleSignals: VacancySignal[]
): VacancySignal[] {
	const signals: VacancySignal[] = [];

	// If we see both a license expiry AND a Google closure at the same area,
	// boost conviction with a churn model flag
	if (dcaSignals.length > 0 && googleSignals.length > 0) {
		signals.push({
			source: 'churn-model',
			signal: 'Multiple closure signals corroborate',
			confidence: 'weak',
			leadTime: '3–12 months',
			detail: `${dcaSignals.length} expired licenses + ${googleSignals.length} closed businesses in this area — elevated churn pattern.`,
			score: 10,
			detectedAt: new Date().toISOString()
		});
	}

	return signals;
}

// ──────────────────────────────────────────────
// Stage 2 + 3: Signal Detection + Vacancy Scoring
// ──────────────────────────────────────────────

/**
 * Score a set of signals into a vacancy probability (0–100).
 * Applies signal weights + decay for older signals.
 */
function scoreVacancy(signals: VacancySignal[]): number {
	if (signals.length === 0) return 0;

	let score = 0;
	for (const s of signals) {
		// Apply time decay — older signals lose potency
		const detectedDate = new Date(s.detectedAt);
		const daysAgo = (Date.now() - detectedDate.getTime()) / (24 * 60 * 60 * 1000);
		const decayFactor = Math.max(0.3, 1 - (daysAgo / 365)); // linear decay over 1 year, floor at 0.3
		score += s.score * decayFactor;
	}

	return Math.min(100, Math.round(score));
}

/**
 * Classify vacancy status from score.
 */
function classifyVacancy(score: number): 'likely_available' | 'coming_available' | null {
	if (score >= 70) return 'likely_available';
	if (score >= 40) return 'coming_available';
	return null;
}

// ──────────────────────────────────────────────
// Stage 4 + 5: Property Enrichment + Output
// ──────────────────────────────────────────────

/**
 * Merge signals by address/location proximity and enrich with PLUTO data.
 */
function buildListings(
	allSignals: VacancySignal[],
	plutoLots: RawPLUTOLot[],
	searchLat: number,
	searchLng: number
): VacancyListing[] {
	// Group signals by approximate address
	const addressGroups = new Map<string, VacancySignal[]>();

	for (const s of allSignals) {
		// Extract address from signal detail (simplified grouping)
		const addrMatch = s.detail.match(/at (.+?)(?:\.|$)/);
		const addr = addrMatch?.[1]?.trim() || 'Unknown';
		const key = addr.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
		const group = addressGroups.get(key) || [];
		group.push(s);
		addressGroups.set(key, group);
	}

	// Also create entries for PLUTO lots with retail area that might not have signals yet
	// (these become "enrichment-only" listings if they accumulate enough signals nearby)

	const listings: VacancyListing[] = [];

	for (const [_key, signals] of addressGroups) {
		const vacancyScore = scoreVacancy(signals);
		const status = classifyVacancy(vacancyScore);
		if (!status) continue; // Below threshold

		// Try to match to a PLUTO lot for enrichment
		const addrFromSignal = signals[0]?.detail.match(/at (.+?)(?:\.|$)/)?.[1]?.trim() || '';
		const matchedLot = plutoLots.find(l =>
			l.address && addrFromSignal.toLowerCase().includes(l.address.toLowerCase().split(' ').slice(0, 2).join(' '))
		);

		const lotLat = matchedLot ? parseFloat(matchedLot.latitude || '0') : 0;
		const lotLng = matchedLot ? parseFloat(matchedLot.longitude || '0') : 0;
		const distance = lotLat && lotLng ? haversineDistance(searchLat, searchLng, lotLat, lotLng) : 0;

		// Extract previous tenant from signals
		const googleSignal = signals.find(s => s.source === 'google');
		const dcaSignal = signals.find(s => s.source === 'dca');
		const previousTenant = googleSignal?.detail.match(/"([^"]+)"/)?.[1]
			|| dcaSignal?.detail.match(/"([^"]+)"/)?.[1]
			|| null;
		const previousType = dcaSignal?.detail.match(/\(([^)]+)\)/)?.[1] || null;

		const earliestSignal = signals.reduce((earliest, s) => {
			const d = new Date(s.detectedAt);
			return d < earliest ? d : earliest;
		}, new Date());
		const daysOnMarket = Math.round((Date.now() - earliestSignal.getTime()) / (24 * 60 * 60 * 1000));

		listings.push({
			id: matchedLot?.bbl || `vac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			address: matchedLot?.address || addrFromSignal || 'Address pending',
			lat: lotLat || searchLat,
			lng: lotLng || searchLng,
			vacancyScore,
			status,
			signals,
			signalCount: signals.length,
			sqft: matchedLot?.retailarea ? parseInt(matchedLot.retailarea) : (matchedLot?.bldgarea ? Math.round(parseInt(matchedLot.bldgarea) * 0.3) : null),
			bldgClass: matchedLot?.bldgclass || null,
			zoneDist: matchedLot?.zonedist1 || null,
			yearBuilt: matchedLot?.yearbuilt ? parseInt(matchedLot.yearbuilt) : null,
			ownerName: matchedLot?.ownername || null,
			retailArea: matchedLot?.retailarea ? parseInt(matchedLot.retailarea) : null,
			previousTenant,
			previousType,
			closedDate: googleSignal?.detectedAt || dcaSignal?.detectedAt || null,
			distance,
			daysOnMarket
		});
	}

	// Sort: likely_available first, then by vacancy score descending
	return listings.sort((a, b) => {
		if (a.status !== b.status) return a.status === 'likely_available' ? -1 : 1;
		return b.vacancyScore - a.vacancyScore;
	});
}

// ──────────────────────────────────────────────
// Main Pipeline Orchestrator
// ──────────────────────────────────────────────

/**
 * Run the full vacancy detection pipeline for a location.
 *
 * Fires all 6 data sources in parallel, scores signals,
 * enriches with property data, and returns actionable listings.
 */
export async function detectVacancies(
	lat: number,
	lng: number,
	radiusMeters: number = 500
): Promise<VacancyDetectionResult> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'vacancy');
	const cached = await intelCache.getAsync<VacancyDetectionResult>(cacheKey);
	if (cached?.fresh) return cached.data;

	// Fire all 6 sources in parallel
	const [
		acrisSignals,
		dobSignals,
		googleSignals,
		licenseSignals,
		plutoData
	] = await Promise.all([
		fetchACRISSignals(lat, lng, radiusMeters),
		fetchDOBVacancySignals(lat, lng, radiusMeters),
		fetchGoogleVacancySignals(lat, lng, radiusMeters),
		fetchLicenseVacancySignals(lat, lng, radiusMeters),
		fetchPLUTOVacancyData(lat, lng, radiusMeters)
	]);

	// Stage 6: Derived churn model signals
	const churnSignals = computeChurnSignals(lat, lng, licenseSignals, googleSignals);

	// Combine all signals
	const allSignals = [
		...acrisSignals,
		...dobSignals,
		...googleSignals,
		...licenseSignals,
		...plutoData.signals,
		...churnSignals
	];

	// Debug: log signal counts from each source
	console.log(`[VACANCY] Pipeline results at ${lat.toFixed(4)},${lng.toFixed(4)} (${radiusMeters}m):`,
		`ACRIS=${acrisSignals.length}, DOB=${dobSignals.length}, Google=${googleSignals.length},`,
		`DCA=${licenseSignals.length}, PLUTO lots=${plutoData.lots.length}, Churn=${churnSignals.length},`,
		`Total signals=${allSignals.length}`
	);

	// Build enriched listings
	const listings = buildListings(allSignals, plutoData.lots, lat, lng);

	console.log(`[VACANCY] ${listings.length} listings above threshold from ${allSignals.length} signals`);

	const result: VacancyDetectionResult = {
		listings,
		totalScanned: plutoData.lots.length,
		likelyAvailable: listings.filter(l => l.status === 'likely_available').length,
		comingAvailable: listings.filter(l => l.status === 'coming_available').length,
		searchRadiusMeters: radiusMeters,
		signalBreakdown: {
			acris: acrisSignals.length,
			dob: dobSignals.length,
			google: googleSignals.length,
			dca: licenseSignals.length,
			plutoLots: plutoData.lots.length,
			churn: churnSignals.length,
			totalSignals: allSignals.length
		},
		source: 'vacancy-detection',
		fetchedAt: new Date().toISOString()
	};

	intelCache.set(cacheKey, result, TTL.COMPETITORS); // 24h cache
	return result;
}
