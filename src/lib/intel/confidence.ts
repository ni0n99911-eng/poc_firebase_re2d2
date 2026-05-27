/**
 * Confidence Level Calculator (S-006).
 *
 * Determines how much to trust a Location IQ score based on:
 * - Data completeness (how many of 15 sources returned data)
 * - Data freshness (how old is the cached data)
 * - Source criticality (some sources matter more for certain business types)
 * - Data quality indicators (e.g., sample size for inspections)
 *
 * Confidence Levels:
 *   HIGH (85-100%)    — Full data + field validation
 *   GOOD (65-84%)     — All critical automated sources
 *   MODERATE (40-64%) — Partial data coverage
 *   PRELIMINARY (<40%) — Limited data, use for exploration only
 */

import type { LocationIntelReport } from './types';

export interface ConfidenceReport {
	level: 'HIGH' | 'GOOD' | 'MODERATE' | 'PRELIMINARY';
	percentage: number;      // 0-100
	band: { low: number; high: number }; // score uncertainty band
	sourceCoverage: SourceCoverage[];
	criticalMissing: string[];
	recommendation: string;
	/** V5: Sub-score agreement metric. Low CV = sub-scores agree = high confidence. */
	scoreAgreement?: {
		coefficientOfVariation: number;   // 0-100 (lower = more agreement)
		level: 'HIGH' | 'GOOD' | 'MODERATE' | 'LOW';
		explanation: string;
	};
}

export interface SourceCoverage {
	source: string;
	available: boolean;
	critical: boolean;      // is this source critical for the business type?
	weight: number;          // how much this source contributes to confidence
	freshness: 'live' | 'cached' | 'stale' | 'missing';
	/** Human-readable impact of this source being missing */
	impact?: string;
}

/** Describes what each missing source means for the user's analysis */
const SOURCE_IMPACT: Record<string, string> = {
	census: 'Population and demographic data unavailable — neighborhood demand estimates less reliable',
	censusHousing: 'Housing and rent data missing — lease affordability signals degraded',
	walkScore: 'Walk/transit/bike scores unavailable — foot traffic estimates less accurate',
	inspections: 'Restaurant inspection grades missing — food safety and compliance signals absent',
	crime: 'Crime data unavailable — safety scoring relies on defaults',
	places: 'Google Places data missing — nearby business ecosystem incomplete',
	marketDensity: 'Market density scan failed — amenity counts may be understated',
	competitors: 'Competitor scan failed — saturation analysis unavailable',
	lpc: 'Landmark data missing — no impact on most analyses',
	mtaRidership: 'Subway ridership data missing — transit demand estimates less precise',
	dcaLicenses: 'Business license data missing — local business activity signal absent',
	dob: 'Building permits/violations missing — construction activity unknown',
	complaints311: '311 complaint data missing — quality of life signals degraded',
	pedestrian: 'Pedestrian count data missing — foot traffic estimates rely on proxies',
	pluto: 'Tax lot data missing — zoning and building class unknown',
	sidewalkCafes: 'Sidewalk café data missing — minor impact (supplementary signal)',
	liquorLicenses: 'Liquor license data missing — SLA clustering analysis unavailable',
	foursquare: 'Foursquare venue data missing — competitor quality signals degraded',
	momentum: 'Trend data missing — neighborhood momentum direction unknown',
	schools: 'School proximity data missing — SLA 200-ft rule cannot be verified automatically',
};

/**
 * SOURCE_WEIGHTS — Per-source reliability weights for confidence score computation. (#45: documented)
 *
 * Higher weight = source is more reliable AND more critical to scoring quality.
 * Weights are NOT normalized to 1.0 — they're used to compute a weighted coverage score.
 * Sum ≈ 131. A location with all sources present gets confidence ≈ 100% (normalized by total).
 *
 * Calibration rationale:
 *   census/pluto (10): Gold standard government data. Updated annually. Very high reliability.
 *   mtaRidership/pedestrian/competitors (9): Real-time or frequently updated. High predictive power.
 *   dcaLicenses (9): Reflects actual business activity — not just potential. Strong signal quality.
 *   walkScore/inspections/dob/marketDensity/momentum (7): Reliable but less granular or frequent.
 *   censusHousing/crime/complaints311 (6): Good signal but more variable (reporting bias in 311).
 *   places/liquorLicenses/sidewalkCafes (5-6): Supplementary. Useful but lower uniqueness.
 *   lpc (3): Niche signal (landmark buildings). Very specific use case.
 *
 * To A/B test weights: make env-overridable with CONFIDENCE_WEIGHT_* env vars.
 */
const SOURCE_WEIGHTS: Record<string, number> = {
	census: 10,
	censusHousing: 6,
	walkScore: 7,
	inspections: 7,
	crime: 6,
	places: 5,
	marketDensity: 7,
	competitors: 9,
	lpc: 3,
	mtaRidership: 9,
	dcaLicenses: 9,
	dob: 7,
	complaints311: 6,
	pedestrian: 9,
	pluto: 10,
	sidewalkCafes: 6,
	liquorLicenses: 5,
	foursquare: 8,
	momentum: 7,
	schools: 4
};

// Which sources are critical per business archetype
const CRITICAL_SOURCES: Record<string, string[]> = {
	impulse: ['mtaRidership', 'pedestrian', 'competitors', 'walkScore', 'dcaLicenses', 'pluto', 'sidewalkCafes'],
	planned: ['census', 'censusHousing', 'inspections', 'dcaLicenses', 'competitors', 'crime', 'pluto', 'liquorLicenses', 'schools'],
	destination: ['competitors', 'dcaLicenses', 'census', 'walkScore', 'dob', 'pluto', 'marketDensity']
};

type Archetype = 'impulse' | 'planned' | 'destination';

const BIZ_ARCHETYPE: Record<string, Archetype> = {
	// Display names
	'Specialty Coffee/Café': 'impulse',
	'Quick-Service Restaurant': 'impulse',
	'Restaurant': 'planned',
	'Retail': 'impulse',
	'Fitness': 'destination',
	'Prof Services': 'destination',
	'Bar/Nightlife': 'planned',
	'Grocery': 'planned',
	'Salon': 'planned',
	// Lowercase slugs
	'cafe': 'impulse',
	'coffee': 'impulse',
	'qsr': 'impulse',
	'fast_food': 'impulse',
	'restaurant': 'planned',
	'retail': 'impulse',
	'fitness': 'destination',
	'gym': 'destination',
	'services': 'destination',
	'coworking': 'destination',
	'bar': 'planned',
	'nightlife': 'planned',
	'grocery': 'planned',
	'salon': 'planned'
};

/**
 * Compute confidence level for a Location IQ report.
 */
export function computeConfidence(
	report: LocationIntelReport,
	businessType: string = 'cafe'
): ConfidenceReport {
	const archetype = BIZ_ARCHETYPE[businessType] || 'impulse';
	const criticalSources = CRITICAL_SOURCES[archetype];

	const sources: Record<string, unknown | null> = {
		census: report.census,
		censusHousing: report.censusHousing,
		walkScore: report.walkScore,
		inspections: report.inspections,
		crime: report.crime,
		places: report.places,
		marketDensity: report.marketDensity,
		competitors: report.competitors,
		lpc: report.lpc,
		mtaRidership: report.mtaRidership,
		dcaLicenses: report.dcaLicenses,
		dob: report.dob,
		complaints311: report.complaints311,
		pedestrian: report.pedestrian,
		pluto: report.pluto,
		sidewalkCafes: report.sidewalkCafes,
		liquorLicenses: report.liquorLicenses,
		foursquare: report.foursquare,
		momentum: report.momentum,
		schools: report.schools
	};

	let weightedScore = 0;
	let totalWeight = 0;
	const criticalMissing: string[] = [];
	const sourceCoverage: SourceCoverage[] = [];

	for (const [key, weight] of Object.entries(SOURCE_WEIGHTS)) {
		const available = sources[key] != null;
		const isCritical = criticalSources.includes(key);

		// Critical sources get 1.5x weight
		const effectiveWeight = isCritical ? weight * 1.5 : weight;
		totalWeight += effectiveWeight;

		if (available) {
			weightedScore += effectiveWeight;
		} else if (isCritical) {
			criticalMissing.push(formatSourceName(key));
		}

		sourceCoverage.push({
			source: formatSourceName(key),
			available,
			critical: isCritical,
			weight: effectiveWeight,
			freshness: available ? 'live' : 'missing',
			impact: available ? undefined : SOURCE_IMPACT[key],
		});
	}

	// INF-05: MTA data quality reduces confidence, not the transit score.
	// Estimated ridership = lower-fidelity data → confidence penalty only.
	const mtaConfidencePenalty = report.mtaRidership?.dataQuality === 'estimated' ? 8
		: report.mtaRidership?.dataQuality === 'mixed' ? 4
		: 0;
	const percentage = Math.max(0, Math.round((weightedScore / totalWeight) * 100) - mtaConfidencePenalty);

	// Determine level
	let level: ConfidenceReport['level'];
	if (percentage >= 85) level = 'HIGH';
	else if (percentage >= 65) level = 'GOOD';
	else if (percentage >= 40) level = 'MODERATE';
	else level = 'PRELIMINARY';

	// Score uncertainty band (wider = less confidence)
	const bandWidth = percentage >= 85 ? 3 : percentage >= 65 ? 6 : percentage >= 40 ? 10 : 15;
	const band = { low: bandWidth, high: bandWidth };

	const recommendation = generateConfidenceRecommendation(level, criticalMissing, percentage);

	return {
		level,
		percentage,
		band,
		sourceCoverage,
		criticalMissing,
		recommendation
	};
}

/**
 * Compute sub-score agreement (coefficient of variation).
 *
 * Stats Guru Review fix: "Replace source-count confidence with sub-score CV.
 * When sub-scores disagree, confidence is LOW because the signals contradict."
 *
 * Example: transit=80, competition=30, vibrancy=75 → high disagreement → low confidence
 * Example: transit=68, competition=72, vibrancy=70 → high agreement → high confidence
 */
export function computeScoreAgreement(
	subScores: Record<string, number>
): ConfidenceReport['scoreAgreement'] {
	const values = Object.values(subScores).filter(v => v != null && v > 0);
	if (values.length < 3) {
		return {
			coefficientOfVariation: 50,
			level: 'MODERATE',
			explanation: 'Insufficient sub-scores to measure agreement'
		};
	}

	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	if (mean === 0) {
		return { coefficientOfVariation: 100, level: 'LOW', explanation: 'All sub-scores are zero' };
	}

	const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
	const sd = Math.sqrt(variance);
	const cv = Math.round((sd / mean) * 100);

	let level: 'HIGH' | 'GOOD' | 'MODERATE' | 'LOW';
	let explanation: string;

	if (cv < 15) {
		level = 'HIGH';
		explanation = `Sub-scores agree strongly (CV=${cv}%). All signals point the same direction — composite score is reliable.`;
	} else if (cv < 25) {
		level = 'GOOD';
		explanation = `Sub-scores mostly agree (CV=${cv}%). Minor signal disagreement — composite score is directionally reliable.`;
	} else if (cv < 35) {
		level = 'MODERATE';
		explanation = `Sub-scores show moderate disagreement (CV=${cv}%). Some signals conflict — drill into individual dimensions before deciding.`;
	} else {
		level = 'LOW';
		explanation = `Sub-scores disagree significantly (CV=${cv}%). Signals contradict each other — the composite score hides important nuance. Look at individual dimensions.`;
	}

	return { coefficientOfVariation: cv, level, explanation };
}

function formatSourceName(key: string): string {
	const names: Record<string, string> = {
		census: 'Census Demographics',
		censusHousing: 'Census Housing',
		walkScore: 'Walk Score',
		inspections: 'Health Inspections',
		crime: 'Crime Data',
		places: 'Google Places',
		marketDensity: 'Market Density',
		competitors: 'Competitor Scan',
		lpc: 'Landmarks',
		mtaRidership: 'MTA Ridership',
		dcaLicenses: 'Business Licenses',
		dob: 'Building Permits',
		complaints311: '311 Complaints',
		pedestrian: 'Pedestrian Counts',
		pluto: 'PLUTO Tax Lots',
		sidewalkCafes: 'Sidewalk Café Permits',
		liquorLicenses: 'Liquor Licenses',
		foursquare: 'Foursquare Places',
		momentum: 'Momentum Trends'
	};
	return names[key] || key;
}

function generateConfidenceRecommendation(
	level: ConfidenceReport['level'],
	criticalMissing: string[],
	percentage: number
): string {
	switch (level) {
		case 'HIGH':
			return 'Excellent data coverage. This Location IQ score is reliable for decision-making.';
		case 'GOOD':
			return criticalMissing.length > 0
				? `Good data coverage (${percentage}%). Missing: ${criticalMissing.join(', ')}. Score is directionally reliable.`
				: `Good data coverage (${percentage}%). Score is reliable for shortlisting and further investigation.`;
		case 'MODERATE':
			return `Partial data coverage (${percentage}%). Missing critical sources: ${criticalMissing.join(', ')}. Use for exploration — validate with field research before committing.`;
		case 'PRELIMINARY':
			return `Limited data coverage (${percentage}%). Missing: ${criticalMissing.join(', ')}. Treat this as a preliminary signal only — significantly more data needed.`;
	}
}
