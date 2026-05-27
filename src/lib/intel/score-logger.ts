/**
 * Score Events Logger — captures every Location IQ computation for future ML training.
 *
 * PRIORITY #1: Every score computed without logging is training data we'll never get back.
 *
 * Architecture:
 *   1. File-based JSONL logging (works immediately, zero dependencies)
 *   2. Supabase insert when credentials are configured (future)
 *
 * Each score_event captures:
 *   - Input: lat/lng, address, businessType, conceptType
 *   - Raw features: extracted numeric signals from each data source
 *   - Computed scores: all sub-scores, composite, confidence
 *   - Metadata: timestamp, source availability, errors, computation time
 *
 * The raw feature vector is what the ML model will train on.
 * The computed scores are the labels we'll eventually validate against outcomes.
 */

import { writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import type { LocationIntelReport } from './types';
import type { LocationIQReport } from './location-iq';
import type { ConfidenceReport } from './confidence';
import { getServiceSupabase } from '$lib/supabase-server';

// ─────────────────────────────────────────────────
// Score Event interface
// ─────────────────────────────────────────────────

export interface ScoreEvent {
	id: string;                          // UUID
	timestamp: string;                   // ISO 8601
	computationTimeMs: number;           // How long the full pipeline took

	// Input
	lat: number;
	lng: number;
	address: string | undefined;
	businessType: string;

	// Raw feature vector — numeric signals extracted from each source
	features: FeatureVector;

	// Computed scores
	scores: {
		niq: number;
		siq: number;
		tiq: number;
		liq: number;
		locationIQ: number;
		grade: string;
		breakdown: LocationIQReport['breakdown'];
	};

	// Confidence
	confidence: {
		level: string;
		percentage: number;
	};

	// Data availability — which sources returned data
	sourceAvailability: Record<string, boolean>;

	// Errors from the fetch pipeline
	errors: string[];

	// Signals generated
	signalCount: number;
	positiveSignals: number;
	negativeSignals: number;
}

/**
 * Flat numeric feature vector for ML training.
 * Every field is a number or null (missing data).
 * This is the input matrix for the future regression model.
 */
export interface FeatureVector {
	// Census Demographics
	medianHouseholdIncome: number | null;
	medianAge: number | null;
	totalPopulation: number | null;
	bachelorsPlusPercent: number | null;

	// Census Housing
	medianGrossRent: number | null;
	rentBurdenedPct: number | null;
	severeRentBurdenPct: number | null;
	vacancyRate: number | null;
	ownerOccupiedPct: number | null;
	builtBefore1950Pct: number | null;
	builtAfter2010Pct: number | null;

	// Walk Score
	walkScore: number | null;
	transitScore: number | null;
	bikeScore: number | null;

	// Inspections
	inspectionCount: number | null;
	avgInspectionScore: number | null;
	cuisineTypeCount: number | null;

	// Crime
	totalCrimeCount: number | null;
	felonyCount: number | null;
	misdemeanorCount: number | null;
	safetyScore: number | null;

	// Google Places
	placesCount: number | null;
	avgRating: number | null;
	avgPriceLevel: number | null;

	// Market Density
	totalBusinesses: number | null;
	categoryCount: number | null;
	commercialVitality: number | null;
	avgChainPct: number | null;

	// Competitors
	ring1Count: number | null;
	ring2Count: number | null;
	ring3Count: number | null;
	totalCompetitors: number | null;
	saturationScore: number | null;
	chainCount: number | null;
	independentCount: number | null;

	// LPC Landmarks
	landmarkCount: number | null;
	isHistoricDistrict: boolean | null;

	// MTA Ridership
	stationCount: number | null;
	totalDailyRidership: number | null;
	transitScoreMTA: number | null;

	// DCA Licenses
	totalLicenseCount: number | null;
	newBusinessRate: number | null;
	ecosystemScore: number | null;
	industryDiversity: number | null;

	// DOB
	activePermitCount: number | null;
	newBuildingCount: number | null;
	activeViolationCount: number | null;
	dobRiskScore: number | null;

	// 311 Complaints
	totalComplaintCount: number | null;
	noiseCount: number | null;
	sanitationCount: number | null;
	qualityScore311: number | null;

	// Pedestrian
	totalPedestrians: number | null;
	countLocationCount: number | null;
	footTrafficScore: number | null;

	// PLUTO
	lotCount: number | null;
	commercialZonePct: number | null;
	mixedUseZonePct: number | null;
	avgBuiltFAR: number | null;
	avgMaxFAR: number | null;
	developmentPotential: number | null;
	totalRetailSqFt: number | null;
	avgYearBuilt: number | null;

	// Sidewalk Cafes
	sidewalkCafeCount: number | null;
	sidewalkCafeActiveCount: number | null;
	sidewalkCafeSeatingCapacity: number | null;
	sidewalkCafeVibrancy: number | null;

	// Liquor Licenses
	liquorLicenseCount: number | null;
	onPremiseLiquorCount: number | null;
	offPremiseLiquorCount: number | null;
	restaurantWineCount: number | null;
	nightlifeDensity: number | null;
	liquorVibrancy: number | null;

	// Foursquare
	foursquareVenueCount: number | null;
	foursquareDirectCompetitors: number | null;
	foursquareAvgPopularity: number | null;
	foursquarePeakTrafficScore: number | null;
	foursquareAvgRating: number | null;
	foursquareCategoryDiversity: number | null;
	foursquareChainCount: number | null;

	// Momentum
	momentumComposite: number | null;
	dobTrendChange: number | null;
	dcaTrendChange: number | null;
	complaintsTrendChange: number | null;
}

// ─────────────────────────────────────────────────
// Feature extraction — pull numeric signals from raw report
// ─────────────────────────────────────────────────

export function extractFeatures(report: LocationIntelReport): FeatureVector {
	const r = report;

	return {
		// Census
		medianHouseholdIncome: r.census?.medianHouseholdIncome ?? null,
		medianAge: r.census?.medianAge ?? null,
		totalPopulation: r.census?.totalPopulation ?? null,
		bachelorsPlusPercent: r.census?.bachelorsPlusPercent ?? null,

		// Housing
		medianGrossRent: r.censusHousing?.medianGrossRent ?? null,
		rentBurdenedPct: r.censusHousing?.rentBurdenedPct ?? null,
		severeRentBurdenPct: r.censusHousing?.severeRentBurdenPct ?? null,
		vacancyRate: r.censusHousing?.vacancyRate ?? null,
		ownerOccupiedPct: r.censusHousing?.ownerOccupiedPct ?? null,
		builtBefore1950Pct: r.censusHousing?.builtBefore1950Pct ?? null,
		builtAfter2010Pct: r.censusHousing?.builtAfter2010Pct ?? null,

		// Walk Score
		walkScore: r.walkScore?.walkScore ?? null,
		transitScore: r.walkScore?.transitScore ?? null,
		bikeScore: r.walkScore?.bikeScore ?? null,

		// Inspections
		inspectionCount: r.inspections?.totalNearby ?? null,
		avgInspectionScore: r.inspections?.avgScore ?? null,
		cuisineTypeCount: r.inspections?.cuisineBreakdown ? Object.keys(r.inspections.cuisineBreakdown).length : null,

		// Crime
		totalCrimeCount: r.crime?.totalCount ?? null,
		felonyCount: r.crime?.violentCount ?? null,
		misdemeanorCount: r.crime?.propertyCount ?? null,
		safetyScore: r.crime?.crimeScore ?? null,

		// Places
		placesCount: r.places?.places?.length ?? null,
		avgRating: r.places?.avgRating ?? null,
		avgPriceLevel: r.places?.avgPriceLevel ?? null,

		// Market Density
		totalBusinesses: r.marketDensity?.totalBusinesses ?? null,
		categoryCount: r.marketDensity?.categories?.filter(c => c.count > 0).length ?? null,
		commercialVitality: r.marketDensity?.commercialVitality ?? null,
		avgChainPct: r.marketDensity?.categories
			? Math.round(r.marketDensity.categories.reduce((sum, c) => sum + c.chainPct, 0) / Math.max(1, r.marketDensity.categories.length))
			: null,

		// Competitors
		ring1Count: r.competitors?.rings?.ring1?.length ?? null,
		ring2Count: r.competitors?.rings?.ring2?.length ?? null,
		ring3Count: r.competitors?.rings?.ring3?.length ?? null,
		totalCompetitors: r.competitors ? (
			(r.competitors.rings?.ring1?.length ?? 0) +
			(r.competitors.rings?.ring2?.length ?? 0) +
			(r.competitors.rings?.ring3?.length ?? 0)
		) : null,
		saturationScore: r.competitors?.saturationScore ?? null,
		chainCount: r.competitors?.chainCount ?? null,
		independentCount: r.competitors?.independentCount ?? null,

		// LPC
		landmarkCount: r.lpc?.nearbyLandmarks?.length ?? null,
		isHistoricDistrict: r.lpc?.isHistoricDistrict ?? null,

		// MTA
		stationCount: r.mtaRidership?.stationCount ?? null,
		totalDailyRidership: r.mtaRidership?.totalDailyRidership ?? null,
		transitScoreMTA: r.mtaRidership?.transitScore ?? null,

		// DCA
		totalLicenseCount: r.dcaLicenses?.totalCount ?? null,
		newBusinessRate: r.dcaLicenses?.newBusinessRate ?? null,
		ecosystemScore: r.dcaLicenses?.ecosystemScore ?? null,
		industryDiversity: r.dcaLicenses?.industryBreakdown?.length ?? null,

		// DOB
		activePermitCount: r.dob?.permitCount ?? null,
		newBuildingCount: r.dob?.newBuildingCount ?? null,
		activeViolationCount: r.dob?.activeViolationCount ?? null,
		dobRiskScore: r.dob?.riskScore ?? null,

		// 311
		totalComplaintCount: r.complaints311?.totalCount ?? null,
		noiseCount: r.complaints311?.noiseCount ?? null,
		sanitationCount: r.complaints311?.sanitationCount ?? null,
		qualityScore311: r.complaints311?.qualityScore ?? null,

		// Pedestrian
		totalPedestrians: r.pedestrian?.totalPedestrians ?? null,
		countLocationCount: r.pedestrian?.countLocationCount ?? null,
		footTrafficScore: r.pedestrian?.footTrafficScore ?? null,

		// PLUTO
		lotCount: r.pluto?.lots?.length ?? null,
		commercialZonePct: r.pluto?.zoneProfile?.commercialPct ?? null,
		mixedUseZonePct: r.pluto?.zoneProfile?.mixedUsePct ?? null,
		avgBuiltFAR: r.pluto?.buildingProfile?.avgLotSize ?? null,  // using lot size as proxy; FAR computed from zoning
		avgMaxFAR: r.pluto?.buildingProfile?.avgAssessedValuePerSqFt ?? null,  // assessed value as density proxy
		developmentPotential: r.pluto?.developmentPotential ?? null,
		totalRetailSqFt: r.pluto?.buildingProfile?.totalRetailSqFt ?? null,
		avgYearBuilt: r.pluto?.buildingProfile?.avgYearBuilt ?? null,

		// Sidewalk Cafes
		sidewalkCafeCount: r.sidewalkCafes?.totalCount ?? null,
		sidewalkCafeActiveCount: r.sidewalkCafes?.activeCount ?? null,
		sidewalkCafeSeatingCapacity: r.sidewalkCafes?.totalSeatingCapacity ?? null,
		sidewalkCafeVibrancy: r.sidewalkCafes?.vibrancySignal ?? null,

		// Liquor Licenses
		liquorLicenseCount: r.liquorLicenses?.totalCount ?? null,
		onPremiseLiquorCount: r.liquorLicenses?.onPremiseCount ?? null,
		offPremiseLiquorCount: r.liquorLicenses?.offPremiseCount ?? null,
		restaurantWineCount: r.liquorLicenses?.restaurantWineCount ?? null,
		nightlifeDensity: r.liquorLicenses?.nightlifeDensity ?? null,
		liquorVibrancy: r.liquorLicenses?.vibrancySignal ?? null,

		// Foursquare
		foursquareVenueCount: r.foursquare?.totalCount ?? null,
		foursquareDirectCompetitors: r.foursquare?.directCompetitors?.length ?? null,
		foursquareAvgPopularity: r.foursquare?.avgPopularity ?? null,
		foursquarePeakTrafficScore: r.foursquare?.peakTrafficScore ?? null,
		foursquareAvgRating: r.foursquare?.avgRating ?? null,
		foursquareCategoryDiversity: r.foursquare?.categoryDiversity ?? null,
		foursquareChainCount: r.foursquare?.chainCount ?? null,

		// Momentum
		momentumComposite: r.momentum?.compositeScore ?? null,
		dobTrendChange: r.momentum?.dobTrend?.changePercent ?? null,
		dcaTrendChange: r.momentum?.dcaTrend?.changePercent ?? null,
		complaintsTrendChange: r.momentum?.complaintsTrend?.changePercent ?? null,
	};
}

// ─────────────────────────────────────────────────
// Logging — file-based JSONL (works immediately)
// ─────────────────────────────────────────────────

const LOG_DIR = '/tmp/re2-score-events';
let logDirReady = false;

async function ensureLogDir(): Promise<void> {
	if (logDirReady) return;
	if (!existsSync(LOG_DIR)) {
		await mkdir(LOG_DIR, { recursive: true });
	}
	logDirReady = true;
}

function getLogFileName(): string {
	const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
	return `${LOG_DIR}/score-events-${date}.jsonl`;
}

function generateId(): string {
	// Simple UUID v4 without crypto dependency
	const hex = '0123456789abcdef';
	let id = '';
	for (let i = 0; i < 36; i++) {
		if (i === 8 || i === 13 || i === 18 || i === 23) id += '-';
		else if (i === 14) id += '4';
		else if (i === 19) id += hex[(Math.random() * 4) | 8];
		else id += hex[(Math.random() * 16) | 0];
	}
	return id;
}

// ─────────────────────────────────────────────────
// Supabase logging options (three-score + geoid context)
// ─────────────────────────────────────────────────

export interface ScoreLogOpts {
	geoid?:    string | null;    // Census block group GEOID (11-digit)
	fitIQ?:    number | null;    // Batch-calibrated FitIQ for this concept
	visionIQ?: number | null;    // Batch-calibrated VisionIQ for this concept
	composite?: number | null;   // sixIndex.locationIQ (user-facing composite)
	borough?:  string | null;    // 'Manhattan' | 'Brooklyn' | etc.
}

/**
 * Log a score event. Called after every Location IQ computation.
 * Fire-and-forget — never blocks or throws to the caller.
 *
 * opts (optional) — pass three-score values + geoid for Supabase ML log:
 *   geoid, fitIQ, visionIQ, composite (sixIndex user-facing), borough
 */
export async function logScoreEvent(
	report: LocationIntelReport,
	iq: LocationIQReport,
	confidence: { level: string; percentage: number },
	computationTimeMs: number,
	opts?: ScoreLogOpts
): Promise<void> {
	try {
		const event: ScoreEvent = {
			id: generateId(),
			timestamp: new Date().toISOString(),
			computationTimeMs,

			lat: report.lat,
			lng: report.lng,
			address: report.address,
			businessType: report.businessType,

			features: extractFeatures(report),

			scores: {
				niq: iq.niq,
				siq: iq.siq,
				tiq: iq.tiq,
				liq: iq.liq,
				locationIQ: iq.locationIQ,
				grade: iq.grade,
				breakdown: iq.breakdown,
			},

			confidence: {
				level: confidence.level,
				percentage: confidence.percentage,
			},

			sourceAvailability: {
				census: report.census != null,
				censusHousing: report.censusHousing != null,
				walkScore: report.walkScore != null,
				inspections: report.inspections != null,
				crime: report.crime != null,
				places: report.places != null,
				marketDensity: report.marketDensity != null,
				competitors: report.competitors != null,
				lpc: report.lpc != null,
				mtaRidership: report.mtaRidership != null,
				dcaLicenses: report.dcaLicenses != null,
				dob: report.dob != null,
				complaints311: report.complaints311 != null,
				pedestrian: report.pedestrian != null,
				pluto: report.pluto != null,
				sidewalkCafes: report.sidewalkCafes != null,
				liquorLicenses: report.liquorLicenses != null,
				foursquare: report.foursquare != null,
				momentum: report.momentum != null,
			},

			errors: report.errors,

			signalCount: iq.signals.length,
			positiveSignals: iq.signals.filter(s => s.type === 'positive').length,
			negativeSignals: iq.signals.filter(s => s.type === 'negative').length,
		};

		// Write to JSONL file (append)
		await ensureLogDir();
		const line = JSON.stringify(event) + '\n';
		await appendFile(getLogFileName(), line, 'utf-8');

		// ── Supabase ML training log (fire-and-forget) ──────────────────────
		// score_events table: one row per Location IQ computation.
		// Keyed by geoid+concept for future outcome label joins.
		// Never blocks scoring — insert failure is logged only.
		const sb = getServiceSupabase();
		if (sb) {
			const sourceCount = Object.values(event.sourceAvailability).filter(Boolean).length;
			Promise.resolve(sb.from('score_events').insert({
				geoid:               opts?.geoid    ?? null,
				concept:             report.businessType,
				borough:             opts?.borough  ?? null,
				location_iq:         opts?.composite ?? null,    // sixIndex composite (user-facing)
				fit_iq:              opts?.fitIQ    ?? null,
				vision_iq:           opts?.visionIQ ?? null,
				composite:           event.scores.locationIQ,    // raw NIQ/SIQ/TIQ/LIQ composite
				survival_confidence: confidence.percentage,
				lat:                 report.lat,
				lng:                 report.lng,
				source_count:        sourceCount,
				errors_count:        report.errors.length,
				computation_ms:      computationTimeMs,
			})).catch((err: unknown) => console.error('[ScoreLogger] Supabase insert failed:', err));
		}

		// Upsert neighborhood intelligence (fire-and-forget)
		upsertNeighborhoodIntel(event).catch(err => {
			console.error('[ScoreLogger] Neighborhood intel upsert failed:', err);
		});

	} catch (err) {
		// Never throw — logging failure must not affect the user's score request
		console.error('[ScoreLogger] Failed to log score event:', err);
	}
}

/**
 * Upsert neighborhood intelligence after scoring.
 * Posts to the server-side API endpoint which handles geohash encoding
 * and running-average aggregation.
 */
async function upsertNeighborhoodIntel(event: ScoreEvent): Promise<void> {
	const positiveSignals = event.scores.breakdown
		? Object.entries(event.scores.breakdown.niq || {})
			.filter(([, v]) => (v as number) >= 70)
			.map(([k]) => k)
		: [];
	const negativeSignals = event.scores.breakdown
		? Object.entries(event.scores.breakdown.siq || {})
			.filter(([, v]) => (v as number) < 40)
			.map(([k]) => k)
		: [];

	const topFactors: Record<string, number> = {
		niq: event.scores.niq,
		siq: event.scores.siq,
		tiq: event.scores.tiq,
		liq: event.scores.liq
	};

	// Use internal fetch (this runs server-side on Netlify functions)
	const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:5173';
	await fetch(`${baseUrl}/api/neighborhood-intelligence`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			lat: event.lat,
			lng: event.lng,
			businessType: event.businessType,
			compositeScore: event.scores.locationIQ,
			signals: { positive: positiveSignals, negative: negativeSignals },
			topFactors
		})
	});
}

/**
 * Get count of logged events (for monitoring/health check).
 */
export async function getScoreEventStats(): Promise<{
	todayCount: number;
	logFile: string;
	stats?: {
		averageLocationIQ: number;
		averageComputationTimeMs: number;
		computationTimeP50Ms: number;
		computationTimeP90Ms: number;
		failureRate: number;
	};
}> {
	try {
		await ensureLogDir();
		const file = getLogFileName();
		if (!existsSync(file)) return { todayCount: 0, logFile: file };

		const { readFile } = await import('fs/promises');
		const content = await readFile(file, 'utf-8');
		const lines = content.trim().split('\n').filter(l => l.length > 0);
		
		let totalLocationIQ = 0;
		let totalComputationTime = 0;
		let errorCount = 0;
		const computationTimes: number[] = [];
		const locationIQs: number[] = [];

		for (const line of lines) {
			try {
				const event = JSON.parse(line) as ScoreEvent;
				const liq = event.scores?.locationIQ || 0;
				const ms = event.computationTimeMs || 0;
				
				totalLocationIQ += liq;
				totalComputationTime += ms;
				computationTimes.push(ms);
				locationIQs.push(liq);
				
				if (event.errors && event.errors.length > 0) {
					errorCount++;
				}
			} catch (e) {
				// skip invalid manual manipulation in logs
			}
		}

		computationTimes.sort((a, b) => a - b);
		const p50 = computationTimes[Math.floor(computationTimes.length * 0.5)] || 0;
		const p90 = computationTimes[Math.floor(computationTimes.length * 0.9)] || 0;

		const averageLocationIQ = locationIQs.length > 0 ? totalLocationIQ / locationIQs.length : 0;
		const averageComputationTimeMs = computationTimes.length > 0 ? totalComputationTime / computationTimes.length : 0;
		const failureRate = lines.length > 0 ? errorCount / lines.length : 0;

		return { 
			todayCount: lines.length, 
			logFile: file,
			stats: {
				averageLocationIQ,
				averageComputationTimeMs,
				computationTimeP50Ms: p50,
				computationTimeP90Ms: p90,
				failureRate
			}
		};
	} catch {
		return { todayCount: 0, logFile: getLogFileName() };
	}
}
