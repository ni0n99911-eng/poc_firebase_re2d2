/**
 * RE² Scoring Thresholds Registry — BL-B3 Audit (April 12, 2026)
 *
 * Single catalog of every hardcoded magic number used in the scoring pipeline.
 * Each constant is typed, documented with its source file + line context, and
 * grouped by scoring engine / concern.
 *
 * PURPOSE:
 *   1. Make all thresholds discoverable (ctrl-F instead of hunting across 15 files)
 *   2. Enable future A/B testing by swapping constants here vs editing scoring logic
 *   3. Provide the foundation for a runtime configuration layer (Supabase-backed)
 *
 * MIGRATION PLAN:
 *   Phase 1 (this file): Catalog + export all constants as readonly objects
 *   Phase 2 (future PR): Rewire location-iq.ts, six-index.ts, etc. to import from here
 *   Phase 3 (future):    Supabase-backed runtime config with fallback to these defaults
 *
 * DO NOT modify scoring behavior by changing values here yet — the source files
 * still use inline numbers until Phase 2 rewiring. This file is the REFERENCE.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 0. FORMULA VERSIONING (score persistence — addendum)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bumped on any formula change that would alter scores for the same inputs.
 * Stored alongside every persisted score. Version mismatch → auto re-score.
 * Format: "coffee-v{major}.{minor}" — major = dimension/weight changes,
 *         minor = threshold tweaks that shift scores ≤2 pts.
 */
export const COFFEE_FORMULA_VERSION = 'coffee-v2.0';

/** Max age (in days) before a stored score is considered stale and re-scored */
export const COFFEE_SCORE_MAX_AGE_DAYS = 30;

/**
 * Maps generic priceLevel ('1'–'4') to coffee-specific avgTicket + visionTier.
 * Used as a fallback when the user set priceLevel (all concepts) but didn't
 * go through the coffee-specific onboarding steps (q2b/q2d).
 */
export const PRICE_LEVEL_TO_COFFEE: Record<string, { avgTicket: number; visionTier: string; tierLabel: string }> = {
	'1': { avgTicket: 4.00,  visionTier: 'commodity',              tierLabel: 'budget coffee' },
	'2': { avgTicket: 6.00,  visionTier: 'standard',               tierLabel: 'neighborhood coffee shop' },
	'3': { avgTicket: 8.50,  visionTier: 'differentiated',         tierLabel: 'specialty coffee' },
	'4': { avgTicket: 12.00, visionTier: 'highly_differentiated',  tierLabel: 'premium coffee experience' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. VARIANCE EXPANSION (location-iq.ts)
// ═══════════════════════════════════════════════════════════════════════════════

/** Expansion factors to counteract averaging compression in multi-component scores */
export const VARIANCE_EXPANSION = {
	/** Pillar-level: undoes sub-component averaging (e.g., 5 NIQ inputs → 1 score) */
	pillar: 1.65,
	/** Composite-level: undoes 4-pillar averaging (NIQ+SIQ+TIQ+LIQ → LocationIQ) */
	composite: 1.55,
	/** Combined effective stretch: ~2.5x — turns [35,65] → [13,86] usable range */
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 2. NIQ (Neighborhood IQ) SUB-WEIGHTS — location-iq.ts lines 301-306
// ═══════════════════════════════════════════════════════════════════════════════

export const NIQ_WEIGHTS = {
	population:       0.25,
	lifecycle:        0.20,
	businessEcosystem: 0.30,
	disruption:       0.15,
	transit:          0.10,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SIQ (Storefront IQ) SUB-WEIGHTS — location-iq.ts lines 312-316
// ═══════════════════════════════════════════════════════════════════════════════

export const SIQ_WEIGHTS = {
	walkability:  0.30,
	competitors:  0.30,
	buildingRisk: 0.20,
	landmarks:    0.20,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 4. TIQ (Taste IQ) SUB-WEIGHTS — location-iq.ts lines 322-325
// ═══════════════════════════════════════════════════════════════════════════════

export const TIQ_WEIGHTS = {
	cuisineDiversity: 0.40,
	qualityGap:       0.30,
	marketGap:        0.30,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SCORE BOUNDS — location-iq.ts + six-index.ts
// ═══════════════════════════════════════════════════════════════════════════════

export const SCORE_BOUNDS = {
	/** Absolute floor — no score goes below this */
	min: 5,
	/** Absolute ceiling — no score exceeds this */
	max: 98,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CHURN RISK — location-iq.ts lines 348-354
// ═══════════════════════════════════════════════════════════════════════════════

export const CHURN_RISK = {
	/** Neutral baseline — score 50 = no data (no adjustment) */
	neutralBaseline: 50,
	/** Maps [0,100] → [-10, +10] adjustment magnitude */
	multiplier: 0.20,
	/** Tenant count in 5 years that triggers high-churn signal */
	highChurnThreshold: 4,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 7. RULE 6: POPULATION DENSITY MINIMUMS — location-iq.ts lines 378-385
// ═══════════════════════════════════════════════════════════════════════════════

export const POPULATION_MINIMUMS = {
	retail:                  10_000,
	specialty_coffee:         8_000,
	qsr:                     20_000,
	full_service_restaurant: 10_000,
	fitness_studio:          12_000,
	personal_services:        8_000,
	/** Cap applied when population falls below concept threshold */
	hardCap: 40,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 8. RULE 7: WALK SCORE MULTIPLIERS — location-iq.ts lines 396-401
// ═══════════════════════════════════════════════════════════════════════════════

export const WALK_SCORE_MULTIPLIERS = {
	/** Walk Score ≥ 90: walker's paradise */
	paradise:      1.10,
	/** Walk Score 70-89: very walkable (neutral) */
	walkable:      1.00,
	/** Walk Score 50-69: somewhat walkable */
	somewhatWalkable: 0.90,
	/** Walk Score < 50: car-dependent */
	carDependent:  0.75,
	/** Thresholds */
	thresholds: { paradise: 90, walkable: 70, somewhatWalkable: 50 },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 9. RULE 13: OUTER-BOROUGH ARBITRAGE — location-iq.ts lines 416-423
// ═══════════════════════════════════════════════════════════════════════════════

export const OUTER_BOROUGH_BONUS = {
	bronx: 10,
	brooklynQueens: 8,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 10. RULE 22: DEMOGRAPHIC ALIGNMENT — location-iq.ts lines 425-453
// ═══════════════════════════════════════════════════════════════════════════════

export const DEMOGRAPHIC_ALIGNMENT = {
	/** Income below target.min × this factor → severe mismatch */
	severeFloorFactor: 0.70,
	/** Divergence above this ratio → moderate penalty */
	divergenceThreshold: 0.30,
	/** Penalty for severe income mismatch */
	severePenalty: 15,
	/** Penalty for moderate divergence */
	moderatePenalty: 8,
} as const;

export const CONCEPT_INCOME_TARGETS = {
	specialty_coffee:        { min: 50_000, max: 200_000 },
	qsr:                     { min: 30_000, max: 120_000 },
	full_service_restaurant: { min: 60_000, max: 250_000 },
	bar_nightlife:           { min: 50_000, max: 200_000 },
	fitness_studio:          { min: 60_000, max: 250_000 },
	retail:                  { min: 40_000, max: 200_000 },
	coworking:               { min: 70_000, max: 300_000 },
	personal_services:       { min: 40_000, max: 180_000 },
	medical_office:          { min: 40_000, max: 250_000 },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 11. RULE 15: CLUSTERING PARADOX — location-iq.ts lines 455-486
// ═══════════════════════════════════════════════════════════════════════════════

export const CLUSTERING = {
	/** Comparison goods: minimum nearby for clustering bonus */
	comparisonMinNearby: 3,
	/** Maximum clustering bonus (pts) */
	comparisonBonusCap: 6,
	/** F&B sweet spot range (inclusive) */
	fbSweetSpot: { min: 2, max: 5 },
	/** F&B sweet spot bonus */
	fbSweetSpotBonus: 4,
	/** F&B saturation threshold */
	fbSaturationThreshold: 8,
	/** F&B saturation penalty */
	fbSaturationPenalty: 8,
	/** Service-based oversaturation threshold */
	serviceOverThreshold: 5,
	/** Service-based oversaturation penalty */
	serviceOverPenalty: 6,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 12. RULE 11: GENTRIFICATION STAGE — location-iq.ts lines 493-523
// ═══════════════════════════════════════════════════════════════════════════════

export const GENTRIFICATION = {
	/** Peak: income change > 25%, new biz rate > 20%, new buildings > 3 */
	peak:  { incomeChange: 25, newBizRate: 20, newBuildings: 3 },
	/** Mid: income change 10-25%, new biz rate ≥ 15 */
	mid:   { incomeChangeMin: 10, incomeChangeMax: 25, newBizRate: 15 },
	/** Late: income change > 25%, new biz rate < 15 */
	late:  { incomeChange: 25, newBizRateCeiling: 15 },
	/** Early: income change 0-10%, new biz rate ≥ 10 */
	early: { incomeChangeCeiling: 10, newBizRate: 10 },
	/** Score adjustments */
	midBonus: 12,
	peakPenalty: 5,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 13. RULE 12: NEIGHBORHOOD RECOVERY — location-iq.ts lines 525-542
// ═══════════════════════════════════════════════════════════════════════════════

export const NEIGHBORHOOD_RECOVERY = {
	/** Daytime ratio above this in Manhattan → office-dependent */
	officeDependentRatio: 2.0,
	/** Daytime ratio below this in BK/Queens → residential/recreational */
	residentialRatio: 1.3,
	/** Multipliers */
	officeDependentMultiplier: 0.85,
	residentialMultiplier: 1.05,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 14. RULE 14: ANCHOR TENANT HALO — location-iq.ts lines 544-559
// ═══════════════════════════════════════════════════════════════════════════════

export const ANCHOR_TENANT = {
	/** Commercial vitality threshold for anchor detection */
	vitalityThreshold: 80,
	/** Total businesses threshold for anchor halo */
	totalBizThreshold: 100,
	/** Anchor bonus */
	bonus: 7,
	/** Isolation: total biz below this AND vitality below threshold */
	isolationBizCeiling: 20,
	/** Isolation: vitality below this */
	isolationVitalityCeiling: 30,
	/** Isolation penalty */
	isolationPenalty: 8,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 15. LIQUOR LICENSE SATURATION (RULE 22-SLA) — location-iq.ts
// ═══════════════════════════════════════════════════════════════════════════════

export const LIQUOR_LICENSE = {
	/** ≥ 8 on-premise licenses within 200ft → severe constraint */
	severeThreshold: 8,
	/** 5-7 on-premise licenses → moderate constraint */
	moderateThreshold: 5,
	/** SIQ penalty for severe constraint */
	severeSiqPenalty: 12,
	/** Location IQ hard cap for severe constraint */
	severeIqCap: 45,
	/** SIQ penalty for moderate constraint */
	moderateSiqPenalty: 8,
	/** SIQ bonus for clear path (< 5 licenses) */
	clearPathBonus: 5,
	/** School violation penalty */
	schoolPenalty: 15,
	/** School violation hard cap */
	schoolCap: 30,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 16. SIX-INDEX WEIGHTS — six-index.ts
// ═══════════════════════════════════════════════════════════════════════════════

export const SIX_INDEX_RIDGE = {
	/** Ridge regression coefficients (V4 scorer calibration) */
	survivalRate:      0.567,
	neighborhoodHealth: 0.240,
	competition:       0.089,
	transit:           0.076,
} as const;

export const SIX_INDEX_DYNAMIC_WEIGHTS = {
	/** Transit weight: base + transitDependency × range */
	transit:       { base: 0.04, range: 0.10 },
	/** Vibrancy weight: base + footTrafficDependency × range */
	vibrancy:      { base: 0.02, range: 0.07 },
	/** Competition weight: base + compSensitivity × range */
	competition:   { base: 0.04, range: 0.10 },
	/** Demographics weight: base + incomeSensitivity × range */
	demographics:  { base: 0.02, range: 0.06 },
	/** Fixed weights */
	safety:        0.01,
	momentum:      0.02,
	/** Minimum allocation to survival + neighborhood health */
	minGuaranteed: 0.50,
	/** Split between neighborhood health and survival rate */
	healthWeight:  0.37,
	survivalWeight: 0.63,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 17. GRADE LETTER THRESHOLDS — six-index.ts lines 1051-1060
// ═══════════════════════════════════════════════════════════════════════════════

export const GRADE_THRESHOLDS = {
	'A+': 93,
	'A':  87,
	'A-': 80,
	'B+': 73,
	'B':  67,
	'B-': 60,
	'C+': 53,
	'C':  47,
	'C-': 40,
	'D':  30,
	'F':   0,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 18. CRIME SCORING — nyc-crime.ts
// ═══════════════════════════════════════════════════════════════════════════════

export const CRIME_THRESHOLDS = {
	/** Density thresholds (incidents per sq mi equivalent) */
	low:      200,
	typical:  600,
	elevated: 1500,
	/** Score ranges per density tier */
	scores: {
		low:      { min: 60, max: 75 },
		typical:  { min: 45, max: 60 },
		elevated: { min: 28, max: 45 },
		high:     { min: 10, max: 28 },
	},
	/** Violent crime ratio thresholds and penalties */
	violentRatioMajor: 0.30,
	violentRatioMinor: 0.15,
	majorPenalty: 15,
	minorPenalty: 8,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 19. 311 QUALITY OF LIFE — nyc-311.ts
// ═══════════════════════════════════════════════════════════════════════════════

export const QOL_311_THRESHOLDS = {
	/** Complaint density thresholds */
	low:     700,
	typical: 2000,
	noisy:   4000,
	/** Category ratio thresholds */
	noiseRatioMajor:      0.40,
	noiseRatioMinor:      0.20,
	sanitationRatioMajor: 0.30,
	sanitationRatioMinor: 0.15,
	/** Penalties */
	majorPenalty: 10,
	minorPenalty: 5,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 20. MTA RIDERSHIP — mta-ridership.ts
// ═══════════════════════════════════════════════════════════════════════════════

export const MTA_RIDERSHIP = {
	/** Estimated daily ridership by number of subway lines */
	estimatedDaily: {
		fourPlusLines: 25_000,
		threeLines:    15_000,
		twoLines:       8_000,
	},
	/** Peak hour calculations */
	peakRatio:          0.40,
	weekdayMultiplier:  1.15,
	weekendMultiplier:  0.65,
	fridayMultiplier:   0.95,
	sundayMultiplier:   0.85,
	saturdayMultiplier: 0.70,
	/** Transit score mapping (daily ridership → score) */
	scoreMap: [
		{ threshold: 100_000, score: 92 },
		{ threshold:  60_000, score: 80 },
		{ threshold:  30_000, score: 68 },
		{ threshold:  15_000, score: 52 },
		{ threshold:   5_000, score: 35 },
		{ threshold:       0, score: 15 },
	],
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 20a. TRANSIT SCORING ADJUSTMENTS — now consolidated into group 28 below.
// INF-05 dataQualityPenalty merged into TRANSIT_THRESHOLDS (group 28).
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 21. PLUTO DEVELOPMENT POTENTIAL — pluto.ts
// ═══════════════════════════════════════════════════════════════════════════════

export const PLUTO_DEVELOPMENT = {
	/** FAR (Floor Area Ratio) thresholds for development potential */
	farLow:      0.3,  // 20pt bonus
	farModerate: 0.5,  // 15pt bonus
	farHigh:     0.7,  // 8pt bonus
	farBuiltOut: 1.0,  // penalty territory
	/** Vacant lot thresholds */
	vacantHigh:   3,
	vacantSingle: 1,
	/** Alteration rate thresholds */
	alterationHigh:     0.2,  // 10pt bonus
	alterationModerate: 0.1,  // 5pt bonus
	/** Overlay bonus */
	overlayThreshold: 0.3,
	overlayBonus: 5,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 22. DATA QUALITY GATE — data-quality-gate.ts
// ═══════════════════════════════════════════════════════════════════════════════

export const DATA_QUALITY = {
	/** Grade thresholds */
	gradeA: 85,
	gradeB: 70,
	gradeC: 55,
	gradeD: 35,
	/** Consistency checks */
	rentToIncomeAlert: 0.50,
	rentBurdenAlert:   50,
	walkScoreFloor:    85,
	pedestrianCountInconsistency: 10_000,
	walkScoreHighPedExpectation:  135,
	ratingSpreadThreshold: 2.0,
	highVarianceSpread:    1.5,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 23. CONFIDENCE — confidence.ts
// ═══════════════════════════════════════════════════════════════════════════════

export const CONFIDENCE_THRESHOLDS = {
	/** Confidence level thresholds */
	high:     85,
	good:     65,
	moderate: 40,
	/** Band widths at each confidence level */
	bandWidths: { high: 3, good: 6, moderate: 10, low: 15 },
	/** Coefficient of variation thresholds for disagreement detection */
	cvLow:      15,
	cvModerate: 25,
	cvHigh:     35,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 24. LOCATION-IQ SUB-SCORE DEFAULTS & CAPS
// ═══════════════════════════════════════════════════════════════════════════════

/** Default baselines used when data is missing */
export const SUB_SCORE_DEFAULTS = {
	population:       50,
	lifecycle:        50,
	businessEcosystem: 50,
	disruption:       70,  // Low disruption = good default
	transit:          50,
	walkability:      50,
	competitors:      50,
	buildingRisk:     70,
	landmarks:        50,
	cuisineDiversity: 50,
	qualityGap:       50,
	marketGap:        50,
	laborPool:        50,
	commutability:    50,
	wageViability:    50,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 25. COMPETITOR SCORING — location-iq.ts + six-index.ts
// ═══════════════════════════════════════════════════════════════════════════════

export const COMPETITOR_SCORING = {
	/** Score when zero competitors found (unproven market) */
	zeroCompetitors: 40,
	/** Sweet spot range → high score */
	sweetSpot: { min: 1, max: 3, score: 85 },
	/** Moderate competition range */
	moderate:  { min: 4, max: 8, score: 65 },
	/** Points lost per competitor above saturation threshold */
	saturationPenaltyPerUnit: 5,
	/** Foursquare popularity threshold for bonus */
	foursquarePopularityThreshold: 0.6,
	/** Multiplier for high Foursquare popularity */
	foursquarePopularityMultiplier: 1.08,
	/** Category diversity threshold */
	categoryDiversityThreshold: 15,
	/** Chain percentage threshold */
	chainPercentageThreshold: 60,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 26. BUILDING RISK — location-iq.ts lines 1391-1425
// ═══════════════════════════════════════════════════════════════════════════════

export const BUILDING_RISK = {
	default: 70,
	/** DOB risk score below this → negative signal */
	dobRiskThreshold: 50,
	/** Minimum building risk floor */
	floor: 15,
	/** Commercial friendliness thresholds + multipliers */
	commercialFriendlyThreshold: 50,
	commercialFriendlyMultiplier: 1.10,
	lowCommercialThreshold: 20,
	lowCommercialMultiplier: 0.80,
	/** Retail square footage threshold */
	retailSqftThreshold: 50_000,
	/** Development potential threshold */
	devPotentialThreshold: 70,
	/** Historic building year cutoff */
	historicYearCutoff: 1940,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 27. INCOME SENSITIVITY — location-iq.ts (Med Spa / Luxury Services)
// ═══════════════════════════════════════════════════════════════════════════════

export const INCOME_SENSITIVITY = {
	/** Median income threshold for luxury/discretionary concepts */
	luxuryFloor: 60_000,
	luxuryPenalty: 15,
	/** Discretionary items (flowers, gifts) income threshold */
	discretionaryFloor: 80_000,
	discretionaryPenalty: 10,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 28. RENT BURDEN & VACANCY — location-iq.ts + six-index.ts
// ═══════════════════════════════════════════════════════════════════════════════

export const RENT_VACANCY = {
	/** Rent burden above this % triggers multiplier */
	rentBurdenThreshold: 50,
	rentBurdenMultiplier: 0.85,
	/** Vacancy above this % triggers multiplier */
	highVacancyThreshold: 15,
	highVacancyMultiplier: 0.90,
	/** Vacancy below this % triggers bonus */
	lowVacancyThreshold: 5,
	lowVacancyMultiplier: 1.05,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 28b. TRANSIT THRESHOLDS — canonical set (THR-01, April 12 2026)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Canonical transit threshold set (THR-01).
 *
 * Before this export, 6 separate threshold interpretations existed:
 *
 *   1. mta-ridership.ts lines 395–400: ridership bands → score (100K→92, 60K→80,
 *      30K→68, 15K→52, 5K→35, 0→15). Inline numbers.
 *   2. walkscore.ts lines 191–195: Walk Score description bands (90/70/50/25).
 *      Tied to Walk Score API labels — should NOT be changed.
 *   3. walkscore.ts lines 199–203: Transit Score description bands (90/70/50/25).
 *      Also tied to Walk Score API — should NOT be changed.
 *   4. walkscore.ts line 168: transitEstimate = walkScore × 0.85. Heuristic multiplier.
 *   5. location-iq.ts line 1311: transit > 70 → positive NIQ signal. Inline.
 *   6. nyc-pedestrian.ts lines 207–210: pedestrian count bands → foot traffic score
 *      (5000→85, 1000→60, 200→35). Inline.
 *
 * Sets 2 and 3 are Walk Score API vocabulary — they describe string labels from
 * the external API and must not be renamed. They are documented here for reference
 * but not extracted as configurable thresholds (changing them would lie about the
 * API response).
 *
 * Sets 1, 4, 5, 6 are internal scoring decisions — extracted below.
 *
 * ⚠ dataQuality NOTE (THR-01, April 12 2026):
 * MTA `dataQuality` field ('real' | 'estimated' | 'mixed') is computed in
 * mta-ridership.ts and propagated on MtaRidershipResult, but the scoring
 * pipeline (location-iq.ts) never checks it — estimated data scores the same
 * as real data. See TRANSIT_THRESHOLDS.dataQualityPenalty for the guard added
 * in this sprint. The field exists at 65% estimated rate (per Brain 2 audit
 * docs/ds-05-mta-data-quality-audit.md).
 */
export const TRANSIT_THRESHOLDS = {
	/** MTA daily ridership → transit score bands (mta-ridership.ts lines 395–400). */
	ridership: {
		/** >= this → score 92 (top tier) */
		tier1: 100_000,
		/** >= this → score 80 + interpolation */
		tier2: 60_000,
		/** >= this → score 68 + interpolation */
		tier3: 30_000,
		/** >= this → score 52 + interpolation */
		tier4: 15_000,
		/** >= this → score 35 + interpolation */
		tier5: 5_000,
		/** Base scores at tier entry points */
		scores: { tier1: 92, tier2: 80, tier3: 68, tier4: 52, tier5: 35, floor: 15 },
	},
	/** Bonus points for station count density (mta-ridership.ts lines 403–404). */
	stationBonus: { high: 4, highThreshold: 4, low: 3, lowThreshold: 2 },
	/** Bonus points for route variety (mta-ridership.ts lines 407–408). */
	routeBonus:   { high: 5, highThreshold: 6, low: 3, lowThreshold: 3 },
	/**
	 * Positive NIQ signal threshold — transit scores above this get a
	 * "excellent transit access" signal pushed to the NIQ layer
	 * (location-iq.ts line 1311).
	 */
	positiveSignalFloor: 70,
	/**
	 * Walk Score transit estimate heuristic — when no Walk Score API data is
	 * available, transit is estimated as walkScore × this multiplier
	 * (walkscore.ts line 168).
	 */
	walkScoreTransitMultiplier: 0.85,
	/**
	 * MTA + pedestrian blend ratio (location-iq.ts line 1317).
	 * transit = mtaScore × mtaWeight + pedScore × pedWeight.
	 */
	blendWeights: { mta: 0.6, pedestrian: 0.4 },
	/**
	 * Pedestrian count → foot traffic score bands (nyc-pedestrian.ts lines 207–210).
	 */
	pedestrian: {
		/** >= this avg/location → score 85+ */
		highFloor: 5_000,
		/** >= this → score 60+ */
		midFloor: 1_000,
		/** >= this → score 35+ */
		lowFloor: 200,
		scores: { high: 85, mid: 60, low: 35, floor: 15 },
	},
	/**
	 * Confidence penalty (0-100 points) applied to transit dimension confidence
	 * when MTA `dataQuality === 'estimated'`. Does NOT change the transit score —
	 * only signals to the confidence contract that this reading is less reliable.
	 *
	 * Rationale: estimated ridership is extrapolated from route count with ±25%
	 * accuracy (per docs/ds-05-mta-data-quality-audit.md). The confidence dial
	 * should reflect this so the UI can render "~N" (partial) rather than full.
	 *
	 * 'mixed' quality gets half the penalty (real data exists but is incomplete).
	 */
	dataQualityPenalty: { estimated: 25, mixed: 10 },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 29. EVIDENCE COPY THRESHOLDS — decision-engine.ts (C-08)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Thresholds for the evidenceCopy() HIGH/MED bands in decision-engine.ts.
 *
 * ⚠ MISALIGNMENT NOTE (C-08, April 12 2026):
 * The evidence copy bands (HIGH >= 70, MED >= 55) deliberately differ from the
 * direction classifier bands (DIRECTION_POSITIVE >= 70, DIRECTION_NEGATIVE < 50).
 * The 55-69 band is "MED copy" (moderate language) but "neutral direction" —
 * this is intentional after RC5 (April 11) aligned copy and direction for the
 * 65-69 band specifically. The MED floor (55) has NOT been reconciled with the
 * neutral floor (50). Brain (original) owns this alignment decision before
 * Phase 2 rewiring.
 *
 * TODO(brain-original): Should EVIDENCE_COPY_MED be raised to 60 to match the
 * neutral band floor? The 55-59 range currently gets "moderate" copy but
 * "neutral" direction — a subtle inconsistency.
 */
export const EVIDENCE_COPY = {
	/** Score >= this → HIGH copy branch ("Strong transit coverage...") */
	high: 70,
	/** Score >= this → MED copy branch ("Moderate transit access...") */
	med:  50,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 30. DIRECTION CLASSIFIER THRESHOLDS — decision-engine.ts (C-08)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Thresholds for classifying a signal's direction in the EvidenceItem payload.
 * RC5 (April 11) aligned these with EVIDENCE_COPY.high so the 65-69 band
 * no longer contradicts its copy ("moderate" in Working For You column).
 *
 * ⚠ MISALIGNMENT NOTE (C-08, April 12 2026):
 * DIRECTION_NEGATIVE (< 50) does not align with EVIDENCE_COPY_MED (>= 55).
 * Scores 50-54 are "neutral direction" but "LOW copy" (not MED). This is a
 * known gap. Brain (original) owns the resolution.
 */
export const DIRECTION_THRESHOLDS = {
	/** Score >= this → direction: 'positive' */
	positive: 70,
	/** Score < this → direction: 'negative' (50–69 is neutral) */
	negative: 50,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 31. HEADS-UP WATCH OUT TIER GATES — heads-up-engine.ts (C-09)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tier labels that trigger Watch Out propagation in heads-up-engine.ts.
 * RC6 (April 11) extended propagation to 'Average' so founders see anything
 * that isn't clearly positive.
 *
 * These strings MUST stay in sync with the 'lens' vocabulary in tiers.ts.
 * If tiers.ts lens labels change, update these constants in the same PR.
 */
export const HEADS_UP_WATCH_TIERS = ['Weak', 'Concerning', 'Average'] as const;

/** Tier label → severity mapping for heads-up-engine Watch Out items. */
export const HEADS_UP_SEVERITY: Record<string, 'critical' | 'important' | 'info'> = {
	Concerning: 'critical',
	Weak:       'important',
	Average:    'info',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 31b. TIER BOUNDARIES — canonical cutoffs for all scoring dimensions (C-04)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Single source of truth for tier classification cutoff points.
 * tiers.ts tierFor() imports these instead of using inline numbers.
 *
 * fitIQ:      Strong Path ≥ 75, Viable ≥ 65, Tight ≥ 50, Stretch ≥ 40, Rethink < 40
 * locationIQ: Prime Block ≥ 80, Solid Block ≥ 65, Mixed Block ≥ 50, Developing < 50
 * visionIQ:   Strong ≥ 75, Solid ≥ 60, Average ≥ 45, Weak ≥ 30, Concerning < 30
 * lens:       Strong ≥ 75, Solid ≥ 60, Average ≥ 45, Weak ≥ 30, Concerning < 30
 */
export const TIER_BOUNDARIES = {
	fitIQ:      { t1: 75, t2: 65, t3: 50, t4: 40 },
	locationIQ: { t1: 80, t2: 65, t3: 50 },
	visionIQ:   { t1: 75, t2: 60, t3: 45, t4: 30 },
	lens:       { t1: 75, t2: 60, t3: 45, t4: 30 },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 32. SURVIVAL DISCOUNT FACTORS (survival-rate.ts — SURV-OPT-C)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Non-food concept discount factors applied against block group food survival rate.
 * DOHMH only inspects food-service businesses. For non-food concepts, the local
 * food survival rate is a proxy — these factors adjust for how closely each
 * concept type correlates with food-service survival patterns.
 *
 * 1.00 = food proxy is directly applicable (e.g., bar/nightlife has DOHMH inspections)
 * Lower = weaker correlation with food-service survival dynamics
 *
 * Source: domain calibration (Kalpna-approved table, April 12, 2026)
 */
export const SURVIVAL_DISCOUNT_FACTORS: Record<string, number> = {
	salon:           0.95,
	nail:            0.95,
	barbershop:      0.95,
	fitness_studio:  0.90,
	retail:          0.85,
	medical:         0.92,
	dental:          0.92,
	coworking:       0.80,
	bar_nightlife:   1.00,
} as const;

/** Default discount factor for concepts not in SURVIVAL_DISCOUNT_FACTORS */
export const SURVIVAL_DISCOUNT_DEFAULT = 0.88;

// ═══════════════════════════════════════════════════════════════════════════════
// 33. KILL FACTOR THRESHOLDS (B2-1.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Per-dimension kill factor thresholds.
 *
 * A signal below these points → treated as a hard risk flag. Values are the
 * location-page canonical set (Kalpna-approved). Stricter cutoffs for
 * competition/transit than the generic 40 floor because a saturated trade
 * area or transit dead-zone is a structural risk, not a soft signal.
 *
 * Consumers MUST import from here rather than hardcoding. Known sites:
 *   - /api/business-case-summary              (Brain 3 — handoff pending)
 *   - src/routes/app/location/+page.svelte    (UX — handoff pending)
 *   - src/routes/app/dashboard/+page.svelte   (UX — handoff pending)
 *   - src/lib/intel/heads-up-engine.ts        (Brain 2 — wired)
 *   - src/lib/intel/coffee-watch-outs.ts      (Brain 2 — wired)
 *   - src/lib/intel/six-index.ts              (Brain 3 — handoff pending, survival line ~354)
 */
export const KILL_FACTOR_THRESHOLDS = {
	safety:       30,  // below 30 = unsafe block, customers avoid
	competition:  25,  // below 25 = saturated (or scan failed)
	transit:      25,  // below 25 = car-only access
	survival:     40,  // below 40% = structurally lossy area (NYC avg ~52)
	pulse:        35,  // below 35 = concept-specific dead ring
	vibrancy:     35,  // alias of pulse — same threshold
	demographics: 35,  // below 35 = income/age mismatch for the concept
} as const;
export type KillFactorDimension = keyof typeof KILL_FACTOR_THRESHOLDS;

/**
 * Generic kill/caution cutoffs used by classifySignal() in scoring-utils.
 * Kept separate from per-dim thresholds: this is the fallback classifier
 * when a signal doesn't have a dimension-specific threshold, or for the UI
 * kill/caution/ok trichotomy.
 */
export const SIGNAL_KILL_FLOOR    = 40;  // below → 'kill'
export const SIGNAL_CAUTION_FLOOR = 55;  // below → 'caution'

// ═══════════════════════════════════════════════════════════════════════════════
// 34. CONFIDENCE BANDS (B2-1.2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vision completeness → score confidence tier cutoffs.
 *
 * Used by /api/score/preview and /api/location-iq. Brain 3 owns location-iq
 * during this work package — they will import from here after their branch
 * merges.
 *
 *   preliminary: visionCompleteness < 0.50 → prelim badge ("PRELIM")
 *   partial:     0.50 ≤ completeness < 0.85 → partial badge
 *   confident:   completeness ≥ 0.85 → confident badge
 */
export const CONFIDENCE_BANDS = {
	preliminary: 0.50,
	partial:     0.85,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TOTAL AUDIT COUNTS (for tracking)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Audit summary (April 12, 2026):
 *   - 32 constant groups cataloged above
 *   - ~210 individual magic numbers identified
 *   - Source files: location-iq.ts (95+), six-index.ts (60+), confidence.ts (10),
 *     foursquare.ts (8), google-places.ts (6), nyc-crime.ts (12), nyc-311.ts (10),
 *     mta-ridership.ts (15), pluto.ts (12), data-quality-gate.ts (12),
 *     extrapolation.ts (30+), dynamic-concept-config.ts (8)
 *
 * Next steps:
 *   - Phase 2 PR: rewire location-iq.ts Rules 6/7/11/12/13/14/15/22 to import from here
 *   - Phase 2 PR: rewire six-index.ts weight calculations to import from here
 *   - Phase 3: runtime config layer with Supabase persistence
 */
