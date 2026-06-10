/**
 * Location Intelligence barrel export.
 *
 * Aggregates all intel sources into a single interface for the
 * /api/location-intel endpoint and scoring engine.
 *
 * Sources (21 total — 18 free + Foursquare when API key configured + Momentum trend analysis):
 * - Census demographics (ACS 5-year)
 * - Census housing (rent, vacancy, tenure)
 * - Walk Score / transit / bike scores
 * - NYC restaurant inspections (DOHMH)
 * - NYC crime data (NYPD complaints)
 * - Google Places (or Overpass fallback)
 * - Market density scan (multi-category ecosystem)
 * - Overpass competitor scan with ring bucketing
 * - NYC LPC landmarks
 * - MTA Subway ridership
 * - DCA Business Licenses
 * - DOB Permits & Violations
 * - 311 Service Requests
 * - NYC DOT Pedestrian Counts
 * - PLUTO tax lots (zoning, FAR, building class)
 * - Sidewalk Café Permits
 * - Liquor Licenses (NYS Liquor Authority)
 * - Foursquare Places (venues, popularity, categories)
 */

export { fetchCensusData, type CensusData } from './census';
export { fetchCensusHousing, type CensusHousingData } from './census-housing';
export { fetchWalkScore, type WalkScoreData } from './walkscore';
export { fetchInspections, cuisineDiversityScore, areaHealthScore, type InspectionData, type InspectionResult } from './nyc-inspections';
export { fetchCrimeData, type CrimeData, type CrimeIncident } from './nyc-crime';
export { fetchNearbyPlaces, fetchMarketDensity, type PlacesData, type PlaceResult, type MarketDensityData, type CategoryDensity } from './google-places';
export { scanCompetitors, buildCompetitorsFromSources, type OverpassData, type CompetitorPOI, type CompetitorRings } from './overpass';
export { fetchLPCData, type LPCData, type NearbyLandmark } from './nyc-lpc';
export { fetchMTARidership, type MTARidershipData, type StationRidership } from './mta-ridership';
export { fetchDCALicenses, type DCALicenseData, type LicensedBusiness } from './dca-licenses';
export { fetchDOBData, type DOBData, type BuildingPermit, type BuildingViolation } from './dob-permits';
export { fetch311Complaints, type NYC311Data, type Complaint311 } from './nyc-311';
export { fetchPedestrianCounts, type PedestrianData, type PedestrianCount } from './nyc-pedestrian';
export { fetchPLUTOData, type PLUTOData, type PLUTOLot, type ZoneProfile, type BuildingProfile } from './pluto';
export { fetchPropertyTaxProfile, type PropertyTaxProfile, type EscalationRisk, computeTaxBurdenAdjustment, computeEscalationPenalty, projectTaxPassThrough, buildTaxContextMessage, buildCopilotTaxSnippet, buildMortgageContext } from './dof-property-tax';
export { fetchLocationHistory, computeChurnRisk, type LocationHistoryData, type HistoricalBusiness } from './location-history';
export { fetchSidewalkCafes, type SidewalkCafeData, type SidewalkCafePermit } from './sidewalk-cafes';
export { fetchLiquorLicenses, type LiquorLicenseData, type LiquorLicense } from './liquor-licenses';
export { fetchFoursquareData, type FoursquareData, type FoursquareVenue, type FoursquareCategory } from './foursquare';
export { fetchMomentumData, type MomentumData, type TrendSignal } from './momentum';
export { fetchSchoolProximity, type SchoolProximityData, type NearbySchool } from './nyc-schools';
export { fetchYelpData, type YelpData, type YelpBusiness, type YelpCategory } from './yelp';
export { intelCache, TTL, IntelCache } from './cache';
export { computeLocationIQ, type LocationIQReport, type IQBreakdown, type IQSignal, type IQGrade } from './location-iq';
export { compareLocations, type ComparisonResult, type ComparisonLocation, type DimensionWinner } from './compare';
export { computeConfidence, computeScoreAgreement, type ConfidenceReport, type SourceCoverage } from './confidence';
export { logScoreEvent, getScoreEventStats, extractFeatures, type ScoreEvent, type FeatureVector } from './score-logger';
export { computeSixIndex, computeDynamicVisionIQ, CONCEPT_TYPES, getConceptScanRadius, type SixIndexReport, type IndexScore, type IndexSignal, type ConceptType, type IndexName, type DynamicVisionIQResult, type VisionTier, type CoffeeDimensions } from './six-index';
export { buildDynamicConfig, getQuestionsForConcept, getSupportedConcepts, estimateMaxImpact, computeVisionImpact, type DynamicConceptConfig, type ConceptQuestion, type ConceptOption, type VisionImpactSummary } from './dynamic-concept-config';
export { detectVacancies, type VacancyDetectionResult, type VacancyListing, type VacancySignal } from './vacancy-detection';
export { reconcileEntities, type ReconciliationResult, type EnrichedEntity, type DerivationChain, type DerivationInput } from './reconciliation';
export { generateExtrapolations, type ExtrapolationResult, type Extrapolation } from './extrapolation';
export { generateNarratives, type NarrativeResult, type AIInsight } from './narrative';
export { extractWithHaiku, type HaikuExtraction, type CompetitorFreshness, type SentimentSignal, type ConceptGap, type PricePositioning, type FootTrafficPattern } from './haiku-extractor';
export { analyzeNeighborhood, type NeighborhoodAnalysis, type MarketTiming, type ConceptFit, type HiddenRisk, type CompetitiveMoat, type RevenueConfidence } from './sonnet-analyst';
export { runDataQualityGate, type DataQualityReport, type DataQualityIssue } from './data-quality-gate';
export { computeStreetSideIntel, extractPOIsFromIntel } from './street-side';
export type { StreetSideData, ConceptSensitivity, HostilityFactor } from './street-side-types';
export { getConceptSensitivity, streetSideModifier } from './street-side-scoring';

import { fetchCensusData, type CensusData } from './census';
import { fetchCensusHousing, type CensusHousingData } from './census-housing';
import { fetchWalkScore, type WalkScoreData } from './walkscore';
import { fetchInspections, type InspectionData } from './nyc-inspections';
import { fetchCrimeData, type CrimeData } from './nyc-crime';
import { fetchNearbyPlaces, type PlacesData } from './google-places';
import { fetchMarketDensity, type MarketDensityData } from './google-places';
import { scanCompetitors, buildCompetitorsFromSources, type OverpassData } from './overpass';
import { fetchLPCData, type LPCData } from './nyc-lpc';
import { fetchMTARidership, type MTARidershipData } from './mta-ridership';
import { fetchDCALicenses, type DCALicenseData } from './dca-licenses';
import { fetchDOBData, type DOBData } from './dob-permits';
import { fetch311Complaints, type NYC311Data } from './nyc-311';
import { fetchPedestrianCounts, type PedestrianData } from './nyc-pedestrian';
import { fetchPLUTOData, type PLUTOData } from './pluto';
import { fetchSidewalkCafes, type SidewalkCafeData } from './sidewalk-cafes';
import { fetchLiquorLicenses, type LiquorLicenseData } from './liquor-licenses';
import { fetchFoursquareData, type FoursquareData } from './foursquare';
import { fetchMomentumData, type MomentumData } from './momentum';
import { fetchPropertyTaxProfile, type PropertyTaxProfile } from './dof-property-tax';
import { fetchYelpData, type YelpData } from './yelp';
import { fetchSchoolProximity, type SchoolProximityData } from './nyc-schools';
import { reconcileEntities, type ReconciliationResult } from './reconciliation';
import { generateExtrapolations, type ExtrapolationResult } from './extrapolation';
import { generateNarratives, type NarrativeResult } from './narrative';
import { extractWithHaiku, type HaikuExtraction } from './haiku-extractor';
import { analyzeNeighborhood, type NeighborhoodAnalysis } from './sonnet-analyst';
import { runDataQualityGate, type DataQualityReport } from './data-quality-gate';
import { lookupHistoricalContext } from './data-quality-gate';
import { applyConfidencePriors } from './confidence-priors';
import { computeStreetSideIntel, extractPOIsFromIntel } from './street-side';
import type { StreetSideData } from './street-side-types';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
import { resilientFetch } from './resilient-fetch';
import { getConceptScanRadius } from './six-index';
import type { LocationIntelReport } from './types';

// ── Geohash encoder (5-char precision ≈ ±2.4km) ──
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function encodeGeohash5(lat: number, lng: number): string {
	let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
	let isLng = true, bit = 0, idx = 0, hash = '';
	while (hash.length < 5) {
		const mid = isLng ? (minLng + maxLng) / 2 : (minLat + maxLat) / 2;
		const val = isLng ? lng : lat;
		if (val >= mid) { idx = idx * 2 + 1; if (isLng) minLng = mid; else minLat = mid; }
		else            { idx = idx * 2;     if (isLng) maxLng = mid; else maxLat = mid; }
		isLng = !isLng;
		if (++bit === 5) { hash += BASE32[idx]; bit = 0; idx = 0; }
	}
	return hash;
}

/**
 * Full location intelligence report — all sources combined.
 * Defined in ./types to break the circular dependency between
 * index.ts and sub-modules (confidence, reconciliation, extrapolation, narrative).
 */
export type { LocationIntelReport } from './types';

/**
 * Fetch a complete location intelligence report.
 * Runs all API calls in parallel with individual error handling.
 * Each source that fails returns null without blocking others.
 */
export async function fetchLocationIntel(
	lat: number,
	lng: number,
	businessType: string = 'cafe',
	address?: string
): Promise<LocationIntelReport> {
	const errors: string[] = [];

	// ── Cache check — direct Supabase read (service role, bypasses RLS) ──
	// FIX-019: Use actual intel_cache schema columns (cache_key/data/fetched_at/ttl_ms).
	// Previous code queried lat/lng/business_type/expires_at — none of which exist on the table.
	// Freshness is now computed as: now() - fetched_at < ttl_ms (no expires_at column needed).
	const latKey = Math.round(lat * 10000) / 10000;
	const lngKey = Math.round(lng * 10000) / 10000;
	const INTEL_CACHE_KEY = `location-intel:${latKey},${lngKey},${businessType || 'general'}`;
	const INTEL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

	try {
		const cacheQuery = db.execute(sql`SELECT data, fetched_at, ttl_ms FROM intel_cache WHERE cache_key = ${INTEL_CACHE_KEY} LIMIT 1`);
		let cacheTimeoutId: NodeJS.Timeout;
		const cacheTimeout = new Promise<null>((resolve) => {
			cacheTimeoutId = setTimeout(() => resolve(null), 2000);
		});
		const result = await Promise.race([cacheQuery, cacheTimeout]).finally(() => clearTimeout(cacheTimeoutId));

		if (result === null) {
			console.warn('[IntelCache] CHECK timed out (2s) — skipping cache');
		} else if ((Array.isArray(result) && result.length > 0) || (result.rows && result.rows.length > 0)) {
			const rows = Array.isArray(result) ? result : result.rows;
			const row = rows[0] as any;
			const age = Date.now() - new Date(row.fetched_at).getTime();
			const ttl = row.ttl_ms ?? INTEL_TTL_MS;
			if (age < ttl) {
				console.log(`[IntelCache] HIT for ${latKey},${lngKey} (age: ${Math.round(age / 1000)}s) — returning cached report`);
				return row.data as LocationIntelReport;
			} else {
				// FIX-5: stale-but-good — if coverage ≥ 12/20, extend TTL 24h and
				// background-refresh rather than blocking the user on a cold re-fetch.
				const cachedReport = row.data as LocationIntelReport;
				const goodCoverage = (cachedReport.sourceCoverage?.available ?? 0) >= 12;
				if (goodCoverage) {
					console.log(`[IntelCache] STALE but good coverage (${cachedReport.sourceCoverage?.available}/20) — serving cached, refreshing in background`);
					fetchEnhancedLocationIntel(lat, lng, businessType, address).catch(() => {});
					return cachedReport;
				}
				console.log(`[IntelCache] STALE + poor coverage (${cachedReport.sourceCoverage?.available ?? 0}/20) — re-fetching`);
			}
		} else {
			console.log(`[IntelCache] MISS for ${latKey},${lngKey} — fetching from APIs`);
		}
	} catch (e) {
		console.warn('[IntelCache] Check failed:', e);
	}

	// ── Hard ceiling: collect whatever finishes within 20s ──
	// Netlify Pro = 26s limit. 20s for Layer 1 leaves 6s buffer for post-processing.
	// Each call is individually wrapped so we keep results from fast calls
	// even if slow calls haven't finished when the ceiling hits.
	const HARD_CEILING_MS = 20000;
	const SOURCE_COUNT = 21;
	const results: PromiseSettledResult<any>[] = new Array(SOURCE_COUNT).fill({
		status: 'rejected' as const,
		reason: new Error('Hard ceiling timeout — source did not complete in time')
	});

	// B7: concept-specific trade radius for competitor/market fetches
	const radius = getConceptScanRadius(businessType);

	const abortController = new AbortController();
	const signal = abortController.signal;

	const calls = [
		resilientFetch('census',         () => fetchCensusData(lat, lng, signal)),
		resilientFetch('census_housing', () => fetchCensusHousing(lat, lng, signal)),
		resilientFetch('walkscore',      () => fetchWalkScore(lat, lng, address, signal)),
		resilientFetch('dohmh',          () => fetchInspections(lat, lng, 500, signal)),
		resilientFetch('crime',          () => fetchCrimeData(lat, lng, 300, signal)),
		resilientFetch('google_places',  () => fetchNearbyPlaces(lat, lng, businessType, radius, signal)),
		resilientFetch('google_density', () => fetchMarketDensity(lat, lng, radius, signal)),
		resilientFetch('overpass',       () => scanCompetitors(lat, lng, businessType, radius, signal)),
		resilientFetch('lpc',            () => fetchLPCData(lat, lng, 100, signal)),
		resilientFetch('mta',            () => fetchMTARidership(lat, lng, 800, signal)),
		resilientFetch('dca',            () => fetchDCALicenses(lat, lng, 500, signal)),
		resilientFetch('dob',            () => fetchDOBData(lat, lng, 300, signal)),
		resilientFetch('complaints_311', () => fetch311Complaints(lat, lng, 500, signal)),
		resilientFetch('pedestrian',     () => fetchPedestrianCounts(lat, lng, 500, signal)),
		resilientFetch('pluto',          () => fetchPLUTOData(lat, lng, 300, signal)),
		resilientFetch('sidewalk_cafes', () => fetchSidewalkCafes(lat, lng, 500, signal)),
		resilientFetch('liquor',         () => fetchLiquorLicenses(lat, lng, 500, signal)),
		resilientFetch('foursquare',     () => fetchFoursquareData(lat, lng, businessType, radius, signal)),
		resilientFetch('yelp',           () => fetchYelpData(lat, lng, businessType, radius, signal)),
		resilientFetch('momentum',       () => fetchMomentumData(lat, lng, 500, signal)),
		resilientFetch('schools',        () => fetchSchoolProximity(lat, lng, 305, signal))
	];

	// Track each call individually — write result as soon as it settles
	calls.forEach((p, i) => {
		p.then(
			(value) => { results[i] = { status: 'fulfilled', value }; },
			(reason) => { results[i] = { status: 'rejected', reason }; }
		);
	});

	// Wait for either all calls to finish OR the hard ceiling
	let hardCeilingId: NodeJS.Timeout;
	await Promise.race([
		Promise.allSettled(calls),
		new Promise<void>((resolve) =>
			hardCeilingId = setTimeout(() => {
				const done = results.filter(r => (r as PromiseRejectedResult).reason?.message !== 'Hard ceiling timeout — source did not complete in time').length;
				console.warn(`[LocationIntel] HARD CEILING HIT (${HARD_CEILING_MS}ms) — ${done}/${SOURCE_COUNT} sources completed. ABORTING trailing requests.`);
				abortController.abort(); // Cancel hanging sockets so serverless function can return
				resolve();
			}, HARD_CEILING_MS)
		)
	]).finally(() => clearTimeout(hardCeilingId));

	const [
		census, censusHousing, walkScore, inspections, crime, places, marketDensity,
		competitors, lpc, mtaRidership, dcaLicenses, dob, complaints311, pedestrian, pluto,
		sidewalkCafes, liquorLicenses, foursquare, yelp, momentum, schools
	] = results;

	function extract<T>(result: PromiseSettledResult<T | null>, label: string): T | null {
		if (result.status === 'fulfilled') {
			if (result.value === null) {
				errors.push(`${label}: returned null (API may be unreachable or returned no data)`);
			}
			return result.value;
		}
		errors.push(`${label}: ${result.reason?.message || 'Unknown error'}`);
		return null;
	}

	// Extract all sources
	const extractedPlaces = extract(places, 'Places');
	const extractedFoursquare = extract(foursquare, 'Foursquare');
	const extractedYelp = extract(yelp, 'Yelp');
	let extractedCompetitors = extract(competitors, 'Competitors');

	// If Overpass failed (rate-limited, timeout, etc.) or returned empty data,
	// build competitors from Foursquare + Google Places + Yelp data.
	const competitorsEmpty = !extractedCompetitors || extractedCompetitors.totalCount === 0;
	if (competitorsEmpty && (extractedFoursquare || extractedPlaces || extractedYelp)) {
		const synthesized = buildCompetitorsFromSources(
			lat, lng, businessType,
			extractedFoursquare,
			extractedPlaces,
			extractedYelp
		);
		if (synthesized && synthesized.totalCount > 0) {
			extractedCompetitors = synthesized;
			// Remove the Overpass error since we recovered
			const overpassErrIdx = errors.findIndex(e => e.startsWith('Competitors:'));
			if (overpassErrIdx >= 0) errors.splice(overpassErrIdx, 1);
		}
	}

	// ── Market density is the architectural source of truth for amenities ──
	// The competitor scan (Overpass → Foursquare/Google/Yelp fallback) focuses on
	// the user's primary businessType. Market density independently scans ALL 8
	// categories regardless of businessType. When the competitor scan has empty
	// amenity buckets (Overpass down, or fallback only queried user's type), market
	// density fills the gap. We always prefer named POIs from the competitor scan
	// but backfill counts from market density for any empty bucket.
	const extractedMarketDensity = extract(marketDensity, 'Market Density');
	if (extractedCompetitors && extractedMarketDensity) {
		// Map market density placeTypes → competitor amenity bucket names
		const densityToBucket: Record<string, keyof typeof extractedCompetitors.amenities> = {
			'cafe': 'cafes',
			'restaurant': 'restaurants',
			'gym': 'gyms',
		};

		for (const [densityType, bucketName] of Object.entries(densityToBucket)) {
			const mdCategory = extractedMarketDensity.categories.find((c: { placeType: string }) => c.placeType === densityType);
			const bucket = extractedCompetitors.amenities[bucketName];

			// Only backfill if market density found results but the competitor scan didn't
			if (mdCategory && mdCategory.count > 0 && bucket.length === 0) {
				// FIX-017: Synthetic POIs must NOT use human-readable names ("Nearby Cafe 1").
				// Names are suppressed so they can never be displayed as real businesses.
				// The count (mdCategory.count) is the only data consumers should render.
				extractedCompetitors.amenities[bucketName] = Array.from(
					{ length: mdCategory.count },
					() => ({
						name: '',           // intentionally blank — source='market-density' means suppress names
						lat: 0,
						lng: 0,
						distance: 0.25,
						type: densityType as 'cafe' | 'restaurant' | 'gym',
						isChain: false,
						tags: { source: 'market-density', avgRating: String(mdCategory.avgRating), chainPct: String(mdCategory.chainPct) }
					})
				);
			}
		}
	}

	const report = {
		lat,
		lng,
		address,
		businessType,
		census: extract(census, 'Census'),
		censusHousing: extract(censusHousing, 'Census Housing'),
		walkScore: extract(walkScore, 'WalkScore'),
		inspections: extract(inspections, 'Inspections'),
		crime: extract(crime, 'Crime'),
		places: extractedPlaces,
		marketDensity: extractedMarketDensity,
		competitors: extractedCompetitors,
		lpc: extract(lpc, 'LPC'),
		mtaRidership: extract(mtaRidership, 'MTA Ridership'),
		dcaLicenses: extract(dcaLicenses, 'DCA Licenses'),
		dob: extract(dob, 'DOB Permits'),
		complaints311: extract(complaints311, '311 Complaints'),
		pedestrian: extract(pedestrian, 'Pedestrian Counts'),
		pluto: extract(pluto, 'PLUTO'),
		sidewalkCafes: extract(sidewalkCafes, 'Sidewalk Cafes'),
		liquorLicenses: extract(liquorLicenses, 'Liquor Licenses'),
		foursquare: extractedFoursquare,
		yelp: extractedYelp,
		momentum: extract(momentum, 'Momentum'),
		schools: extract(schools, 'Schools'),
		fetchedAt: new Date().toISOString(),
		errors,
		sourceCoverage: { available: 0, total: 21, pct: 0 },
	};

	// Calculate source coverage
	const sourceKeys: (keyof typeof report)[] = [
		'census', 'censusHousing', 'walkScore', 'inspections', 'crime',
		'places', 'marketDensity', 'competitors', 'lpc', 'mtaRidership',
		'dcaLicenses', 'dob', 'complaints311', 'pedestrian', 'pluto',
		'sidewalkCafes', 'liquorLicenses', 'foursquare', 'yelp', 'momentum',
		'schools'
	];
	const available = sourceKeys.filter(k => report[k] !== null).length;
	report.sourceCoverage = { available, total: 21, pct: Math.round((available / 21) * 100) };

	// ── DOF Property Tax (runs after PLUTO — needs BBL) ──────────────────────
	// Source #21. Uses BBL from PLUTO nearest lot. 30-day cache (annual data).
	// Graceful degradation: if no BBL, propertyTax remains null.
	{
		const plutoData = extract(pluto, 'PLUTO');
		const bbl = plutoData?.nearestLot?.bbl ?? '';
		if (bbl) {
			try {
				const nearestLot = plutoData!.nearestLot!;
				const propertyTax = await fetchPropertyTaxProfile(
					bbl,
					0,                       // sqft: will be filled from session at scoring time
					nearestLot.bldgArea,
					nearestLot.bldgClass
				);
				(report as LocationIntelReport).propertyTax = propertyTax;
				if (propertyTax) {
					report.sourceCoverage = {
						available: (report.sourceCoverage?.available ?? 0) + 1,
						total: 21,
						pct: Math.round(((report.sourceCoverage?.available ?? 0) + 1) / 21 * 100),
					};
				}
			} catch (err) {
				console.warn('[Intel] DOF property tax failed:', err instanceof Error ? err.message : err);
				(report as LocationIntelReport).propertyTax = null;
			}
		} else {
			(report as LocationIntelReport).propertyTax = null;
		}
	}

	// ── Street-Side Intelligence (runs after POIs are available) ──
	// Fetches subway entrances + bus stops, combines with existing POIs,
	// and computes which side of the street has better foot traffic drivers.
	if (address) {
		try {
			const existingPOIs = extractPOIsFromIntel(report);
			const streetSide = await computeStreetSideIntel(lat, lng, address, existingPOIs);
			(report as LocationIntelReport).streetSide = streetSide;
		} catch (err) {
			console.warn('[Intel] Street-side analysis failed:', err instanceof Error ? err.message : err);
			(report as LocationIntelReport).streetSide = null;
		}
	}

	// ── Location History + Churn Risk (IMP-02) ──────────────────────────────────
	// Queries DOHMH + DCA for historical businesses at this exact address.
	// Derives churnRisk sub-score for Location IQ (d=3.4 predictor of failure).
	if (address) {
		try {
			const { fetchLocationHistory, computeChurnRisk } = await import('./location-history');
			const history = await fetchLocationHistory(address, lat, lng);
			(report as any).locationHistory = history;
			(report as any).churnRisk = computeChurnRisk(history);
		} catch (err) {
			console.warn('[Intel] Location history/churn risk failed:', err instanceof Error ? err.message : err);
			(report as any).locationHistory = null;
			(report as any).churnRisk = null;
		}
	}

	// ── Cache store — only write if source coverage meets quality threshold ──
	// FIX-4: Do not cache a degraded report (Overpass down, FSQ broken, etc.).
	// A report with < 8/20 sources would poison the cache for 7 days.
	const MIN_SOURCES_TO_CACHE = 8;
	const sourcesAvailable = (report as LocationIntelReport).sourceCoverage?.available ?? 0;
	if (sourcesAvailable < MIN_SOURCES_TO_CACHE) {
		console.warn(`[IntelCache] SKIPPED write — only ${sourcesAvailable}/20 sources (below ${MIN_SOURCES_TO_CACHE} threshold)`);
	} else {
	try {
		const fetchedAtStr = new Date().toISOString();
		await db.execute(sql`
			INSERT INTO intel_cache (cache_key, source, data, ttl_ms, fetched_at)
			VALUES (${INTEL_CACHE_KEY}, 'location-intel', ${JSON.stringify(report)}::jsonb, ${INTEL_TTL_MS}, ${fetchedAtStr})
			ON CONFLICT (cache_key) DO UPDATE SET
				source = EXCLUDED.source,
				data = EXCLUDED.data,
				ttl_ms = EXCLUDED.ttl_ms,
				fetched_at = EXCLUDED.fetched_at
		`);

		console.log(`[IntelCache] STORED ${sourcesAvailable}/20 sources for ${latKey},${lngKey} (key: ${INTEL_CACHE_KEY})`);
	} catch (e) {
		console.warn('[IntelCache] Store failed:', e);
	}
	} // end quality gate

	return report;
}

/**
 * Enhanced location intelligence report — all 4 layers.
 *
 * Layer 1: Raw API data (LocationIntelReport)
 * Layer 2: Reconciled entities (deduped, conflict-resolved)
 * Layer 3: Extrapolations (business-specific inferences)
 * Layer 4: AI narratives (human-readable insights with transparency)
 */
export interface EnhancedLocationIntelReport extends LocationIntelReport {
	// Data Quality Gate (runs between Layer 1 and Layer 2)
	qualityGate: DataQualityReport;
	// Layer 2
	reconciled: ReconciliationResult;
	// Layer 3
	extrapolated: ExtrapolationResult;
	// Layer 4
	narratives: NarrativeResult;
	// AI Intelligence layers (fire-and-forget, nullable)
	haikuExtraction: HaikuExtraction | null;
	neighborhoodAnalysis: NeighborhoodAnalysis | null;
	// Pipeline metadata
	pipeline: {
		version: string;
		layers: {
			layer1: { sources: number; total: number; ms: number };
			qualityGate: { grade: string; action: string; issues: number; ms: number };
			layer2: { entities: number; conflicts: number; ms: number };
			layer3: { extrapolations: number; avgConfidence: number; ms: number };
			layer4: { insights: number; mode: string; ms: number };
			haikuExtractor: { extracted: boolean; ms: number };
			sonnetAnalyst: { analyzed: boolean; ms: number };
		};
		totalMs: number;
	};
}

/**
 * Fetch a full 4-layer enhanced location intelligence report.
 *
 * Runs Layer 1 (raw APIs), then Layer 2 (reconciliation),
 * Layer 3 (extrapolation), and Layer 4 (narratives) in sequence.
 *
 * Each layer's outputs feed into the next, with full derivation
 * chains maintained throughout for audit/transparency.
 */
export async function fetchEnhancedLocationIntel(
	lat: number,
	lng: number,
	businessType: string = 'cafe',
	address?: string,
	options: { useAI?: boolean; signal?: AbortSignal } = {}
): Promise<EnhancedLocationIntelReport> {
	const pipelineStart = Date.now();

	// ── Layer 1: Raw API data ──
	const layer1Start = Date.now();
	const rawReport = await fetchLocationIntel(lat, lng, businessType, address);
	const layer1Ms = Date.now() - layer1Start;

	// ── Geohash + Historical Context (Power Broker) ──
	// Compute once, pass to both quality gate and Sonnet analyst.
	const geohash5 = encodeGeohash5(lat, lng);
	const historicalContext = await lookupHistoricalContext(geohash5).catch(() => []);

	// ── Time budget: skip enhanced layers if Layer 1 already ate most of our budget ──
	const SERVERLESS_BUDGET_MS = 24000; // Netlify Pro = 26s, leave 2s margin
	const remainingBudget = SERVERLESS_BUDGET_MS - layer1Ms;
	const skipEnhancedLayers = remainingBudget < 5000; // Need at least 5s for Layers 2-4

	if (skipEnhancedLayers) {
		console.warn(`[Pipeline] Layer 1 took ${layer1Ms}ms — skipping enhanced layers (${remainingBudget}ms remaining)`);
	}

	if (options.signal?.aborted) {
		console.warn(`[Pipeline] Aborted by caller before enhanced layers — halting execution`);
		throw new Error('Pipeline aborted by timeout');
	}

	// ── Quality Gate + Layer 2 + Haiku extraction (all parallel) ──
	// All three only need raw Layer 1 data, so fire them simultaneously.
	// Quality gate: Haiku LLM cross-checks data for contradictions (~300ms)
	// Reconciliation: deterministic dedup + conflict resolution
	// Haiku extraction: structured business intelligence extraction (~500ms)
	const layer2Start = Date.now();
	const haikuStart = Date.now();
	const gateStart = Date.now();

	const [qualityGate, reconciled, haikuExtraction] = skipEnhancedLayers
		? [
			{ grade: 'B' as const, action: 'proceed' as const, confidence: { level: 'GOOD' as const, percentage: 70, band: { low: 6, high: 6 }, sourceCoverage: [], criticalMissing: [], recommendation: 'Skipped — time budget exceeded.' }, issues: [], criticalCount: 0, warningCount: 0, infoCount: 0, summary: 'Enhanced layers skipped due to time constraints.', llmCheckRan: false, latencyMs: 0 } satisfies DataQualityReport,
			reconcileEntities(rawReport),
			null
		]
		: await Promise.all([
		runDataQualityGate(rawReport, businessType, geohash5).catch((err) => {
			console.error('[Pipeline] Quality gate failed (non-blocking):', err);
			// Return a permissive fallback — never block scoring on gate failure
			return {
				grade: 'B' as const,
				action: 'proceed' as const,
				confidence: { level: 'GOOD' as const, percentage: 70, band: { low: 6, high: 6 }, sourceCoverage: [], criticalMissing: [], recommendation: 'Quality gate unavailable — proceeding with default confidence.' },
				issues: [],
				criticalCount: 0,
				warningCount: 0,
				infoCount: 0,
				summary: 'Data quality check unavailable. Score generated with standard pipeline.',
				llmCheckRan: false,
				latencyMs: 0
			} satisfies DataQualityReport;
		}),
		Promise.resolve(reconcileEntities(rawReport)),
		extractWithHaiku(rawReport).catch((err) => {
			console.error('[Pipeline] Haiku extraction failed (non-blocking):', err);
			return null;
		}),
	]);

	const gateMs = Date.now() - gateStart;
	const layer2Ms = Date.now() - layer2Start;
	const haikuMs = Date.now() - haikuStart;

	// ── Layer 3: Contextual extrapolation ──
	const layer3Start = Date.now();
	const extrapolated = skipEnhancedLayers
		? { extrapolations: [], totalCount: 0, byCategory: {}, avgConfidence: 0, processingMs: 0 }
		: generateExtrapolations(rawReport, reconciled);
	const layer3Ms = Date.now() - layer3Start;

	if (options.signal?.aborted) {
		console.warn(`[Pipeline] Aborted by caller before Layer 4 LLM analysis — halting execution`);
		throw new Error('Pipeline aborted by timeout');
	}

	// ── Layer 4 + Sonnet analysis (parallel) ──
	// Sonnet needs Layers 1-3 complete for full context.
	// Runs in parallel with narrative generation since both are async AI calls.
	const layer4Start = Date.now();
	const sonnetStart = Date.now();

	const [narratives, neighborhoodAnalysis] = skipEnhancedLayers
		? [
			{ insights: [], totalInsights: 0, mode: 'local' as const, processingMs: 0, overallVerdict: 'Analysis skipped due to time constraints — raw data is available above.', overallSentiment: 'neutral' as const, transparencyNote: 'Enhanced layers skipped to stay within serverless time budget.' },
			null
		]
		: await Promise.all([
			generateNarratives(rawReport, reconciled, extrapolated, options),
			analyzeNeighborhood(rawReport, reconciled, extrapolated, haikuExtraction ?? undefined, historicalContext.length > 0 ? historicalContext : undefined).catch(
				(err) => {
					console.error('[Pipeline] Sonnet analysis failed (non-blocking):', err);
					return null;
				}
			),
		]);

	const layer4Ms = Date.now() - layer4Start;
	const sonnetMs = Date.now() - sonnetStart;

	return {
		...rawReport,
		qualityGate,
		reconciled,
		extrapolated,
		narratives,
		haikuExtraction,
		neighborhoodAnalysis,
		pipeline: {
			version: 'v1.2',
			layers: {
				layer1: {
					sources: rawReport.sourceCoverage?.available || 0,
					total: rawReport.sourceCoverage?.total || 20,
					ms: layer1Ms,
				},
				qualityGate: {
					grade: qualityGate.grade,
					action: qualityGate.action,
					issues: qualityGate.issues.length,
					ms: gateMs,
				},
				layer2: {
					entities: reconciled.totalEntities,
					conflicts: reconciled.conflictsResolved,
					ms: layer2Ms,
				},
				layer3: {
					extrapolations: extrapolated.totalCount,
					avgConfidence: extrapolated.avgConfidence,
					ms: layer3Ms,
				},
				layer4: {
					insights: narratives.totalInsights,
					mode: narratives.mode,
					ms: layer4Ms,
				},
				haikuExtractor: {
					extracted: haikuExtraction !== null,
					ms: haikuMs,
				},
				sonnetAnalyst: {
					analyzed: neighborhoodAnalysis !== null,
					ms: sonnetMs,
				},
			},
			totalMs: Date.now() - pipelineStart,
		},
	};
}
