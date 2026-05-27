import 'dotenv/config';
/**
 * RE² Block Group Scoring Engine v4 — Three-Score Architecture
 * Preserves Cycle 2H calibration (d=0.601) while adding Location IQ v2 + Vision IQ.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * V4 CHANGES (2026-03-27)
 *
 * THREE-SCORE ARCHITECTURE:
 *   • Location IQ v2  — concept-independent location quality (B2B product)
 *   • Vision IQ       — concept-specific fit (requires user concept input)
 *   • Fit IQ          — calibrated ensemble (unchanged from v3, preserves d=0.601)
 *
 * ADDITIONAL CHANGES:
 *   1. 5 new concept configs: wellness_beverage, juice_bar, fast_casual, bakery, florist
 *   2. targetAgeRange on ALL concept configs → computeAgeFit() bonus/penalty
 *   3. computeLocationIQv2() — concept-independent, reweighted from sub-scores
 *   4. computeVisionIQScore() — concept-specific: competition + priceIncomeFit + ageFit
 *   5. New score_types written: location_iq_v2, location_sub_safety, location_sub_momentum,
 *      vision_iq:{concept}
 *
 * PRESERVED FROM V3 (d=0.601):
 *   • scoreCycle2() — UNCHANGED
 *   • Ensemble blend: 54% composite + 46% linear, power-transformed
 *   • Z-normalization per borough (pooled across concepts)
 *   • All existing fit_score, fit_sub_*, six_*, location_iq rows
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { createClient } from '@supabase/supabase-js';
const _surl = process.env.SUPABASE_URL;
if (!_surl) { console.error('[ERROR] SUPABASE_URL env var is required. Set it in your .env file.'); process.exit(1); }
const supabase = createClient(_surl, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BATCH_ID = `v4-three-score-${Date.now()}`;

// === CONFIGURATION ===

/**
 * BOROUGH_CONFIG — Per-borough scoring weight calibration. (#39: documentation added)
 *
 * Weights were calibrated against real NYC business density and survival data (2023).
 * Do NOT change without running a calibration backtest.
 *
 * Key calibration decisions:
 *   Manhattan: income is 'inverted' (high income = saturated / expensive, not a pure positive);
 *              high transitWeight (0.15) because Manhattan's subway density is its primary
 *              commercial advantage; low walkScoreWeight because all Manhattan scores high.
 *   Brooklyn/Queens: income is 'normal' (higher income = better spending power without
 *              price insensitivity); lower transitWeight than Manhattan because transit
 *              access is more differentiated (some neighborhoods transit-poor).
 *   Staten Island: very low transitWeight (0.02) — car-dependent market. Parking and
 *              walkability weights would be higher if parking data were available.
 *
 * Source: RE² calibration cycle (March 2026) against 510K rows, d=0.601.
 */
const BOROUGH_CONFIG = {
  'Manhattan': {
    incomeDirection: 'inverted',
    walkScoreWeight: 0.02,
    transitWeight: 0.15,
    incomeWeight: 0.15,
    competitionWeight: 0.25,
    vibrancyWeight: 0.38,
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'extreme',
  },
  'Queens': {
    incomeDirection: 'inverted',
    walkScoreWeight: 0.35,
    transitWeight: 0.20,
    incomeWeight: 0.15,
    competitionWeight: 0.15,
    vibrancyWeight: 0.10,
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'moderate',
  },
  'Brooklyn': {
    incomeDirection: 'normal',
    walkScoreWeight: 0.20,
    transitWeight: 0.20,
    incomeWeight: 0.20,
    competitionWeight: 0.15,
    vibrancyWeight: 0.20,
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'high',
  },
  'Bronx': {
    incomeDirection: 'normal',
    walkScoreWeight: 0.10,
    transitWeight: 0.25,
    incomeWeight: 0.25,
    competitionWeight: 0.15,
    vibrancyWeight: 0.20,
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'low',
  },
  'Staten Island': {
    incomeDirection: 'weak',
    walkScoreWeight: 0.0,
    transitWeight: 0.10,
    incomeWeight: 0.20,
    competitionWeight: 0.25,
    vibrancyWeight: 0.25,
    safetyWeight: 0.05,
    momentumWeight: 0.15,
    isCarDependent: true,
    rentPressure: 'low',
  },
};

const DEFAULT_BOROUGH_CONFIG = {
  incomeDirection: 'normal',
  walkScoreWeight: 0.20,
  transitWeight: 0.20,
  incomeWeight: 0.20,
  competitionWeight: 0.15,
  vibrancyWeight: 0.20,
  safetyWeight: 0.02,
  momentumWeight: 0.03,
  isCarDependent: false,
  rentPressure: 'moderate',
};

const CONCEPT_CONFIG = {
  'full_service_restaurant': {
    competitionCategories: ['restaurant', 'meal_takeaway', 'food'],
    priceRange: [2, 3],
    tradeRadiusM: 1500,
    trafficPattern: 'evening',
    saturationThreshold: 20,
    incomeMin: 45000,
    incomeSweet: 85000,
    transitDependency: 0.5,
    footTrafficDependency: 0.4,
    targetAgeRange: [28, 55],
  },
  'specialty_coffee': {
    competitionCategories: ['cafe', 'coffee_shop', 'bakery'],
    priceRange: [1, 2],
    tradeRadiusM: 200,
    trafficPattern: 'morning',
    saturationThreshold: 8,
    incomeMin: 40000,
    incomeSweet: 75000,
    transitDependency: 0.7,
    footTrafficDependency: 0.8,
    targetAgeRange: [24, 42],
  },
  'qsr': {
    competitionCategories: ['restaurant', 'meal_takeaway', 'meal_delivery', 'fast_food'],
    priceRange: [1, 1],
    tradeRadiusM: 500,
    trafficPattern: 'allday',
    saturationThreshold: 12,
    incomeMin: 30000,
    incomeSweet: 55000,
    transitDependency: 0.6,
    footTrafficDependency: 0.7,
    targetAgeRange: [18, 45],
  },
  'retail': {
    competitionCategories: ['clothing_store', 'store', 'shopping_mall'],
    priceRange: [2, 3],
    tradeRadiusM: 500,
    trafficPattern: 'weekend',
    saturationThreshold: 15,
    incomeMin: 50000,
    incomeSweet: 90000,
    transitDependency: 0.4,
    footTrafficDependency: 0.5,
    targetAgeRange: [22, 50],
  },
  'fitness_studio': {
    competitionCategories: ['gym', 'fitness_center', 'yoga_studio'],
    priceRange: [2, 3],
    tradeRadiusM: 600,
    trafficPattern: 'allday',
    saturationThreshold: 10,
    incomeMin: 50000,
    incomeSweet: 85000,
    transitDependency: 0.4,
    footTrafficDependency: 0.3,
    targetAgeRange: [22, 45],
  },
  'bar_nightlife': {
    competitionCategories: ['bar', 'night_club', 'lounge'],
    priceRange: [2, 3],
    tradeRadiusM: 800,
    trafficPattern: 'evening',
    saturationThreshold: 15,
    incomeMin: 40000,
    incomeSweet: 70000,
    transitDependency: 0.6,
    footTrafficDependency: 0.3,
    targetAgeRange: [21, 40],
  },
  'personal_services': {
    competitionCategories: ['hair_care', 'beauty_salon', 'spa'],
    priceRange: [2, 2],
    tradeRadiusM: 500,
    trafficPattern: 'allday',
    saturationThreshold: 12,
    incomeMin: 40000,
    incomeSweet: 70000,
    transitDependency: 0.3,
    footTrafficDependency: 0.4,
    targetAgeRange: [25, 55],
  },
  'medical_office': {
    competitionCategories: ['doctor', 'dentist', 'health'],
    priceRange: [3, 4],
    tradeRadiusM: 800,
    trafficPattern: 'daytime',
    saturationThreshold: 8,
    incomeMin: 45000,
    incomeSweet: 80000,
    transitDependency: 0.5,
    footTrafficDependency: 0.2,
    targetAgeRange: [30, 70],
  },
  // === V4 NEW CONCEPT CONFIGS ===
  'wellness_beverage': {
    competitionCategories: ['juice_bar', 'smoothie', 'health_food_store', 'acai_shop'],
    priceRange: [3, 3],
    tradeRadiusM: 200,
    trafficPattern: 'morning',
    saturationThreshold: 4,
    incomeMin: 60000,
    incomeSweet: 100000,
    transitDependency: 0.8,
    footTrafficDependency: 0.9,
    targetAgeRange: [25, 42],
  },
  'juice_bar': {
    competitionCategories: ['juice_bar', 'smoothie', 'health_food_store', 'cafe'],
    priceRange: [2, 3],
    tradeRadiusM: 200,
    trafficPattern: 'morning',
    saturationThreshold: 5,
    incomeMin: 50000,
    incomeSweet: 90000,
    transitDependency: 0.7,
    footTrafficDependency: 0.85,
    targetAgeRange: [22, 40],
  },
  'fast_casual': {
    competitionCategories: ['restaurant', 'meal_takeaway', 'fast_food', 'cafe'],
    priceRange: [2, 2],
    tradeRadiusM: 600,
    trafficPattern: 'allday',
    saturationThreshold: 15,
    incomeMin: 40000,
    incomeSweet: 70000,
    transitDependency: 0.6,
    footTrafficDependency: 0.75,
    targetAgeRange: [22, 45],
  },
  'bakery': {
    competitionCategories: ['bakery', 'cafe', 'coffee_shop'],
    priceRange: [1, 2],
    tradeRadiusM: 400,
    trafficPattern: 'morning',
    saturationThreshold: 6,
    incomeMin: 40000,
    incomeSweet: 75000,
    transitDependency: 0.6,
    footTrafficDependency: 0.8,
    targetAgeRange: [25, 55],
  },
  'florist': {
    competitionCategories: ['florist', 'store', 'gift_shop'],
    priceRange: [2, 3],
    tradeRadiusM: 800,
    trafficPattern: 'daytime',
    saturationThreshold: 3,
    incomeMin: 55000,
    incomeSweet: 95000,
    transitDependency: 0.4,
    footTrafficDependency: 0.6,
    targetAgeRange: [28, 60],
  },
};

// All concept types to score per block group
const ALL_CONCEPTS = Object.keys(CONCEPT_CONFIG);
// Default concept for unsuffixed rows (backward compat)
const DEFAULT_CONCEPT_KEY = 'full_service_restaurant';

const DEFAULT_CONCEPT = {
  competitionCategories: ['restaurant', 'cafe', 'store'],
  priceRange: [2, 2],
  tradeRadiusM: 600,
  trafficPattern: 'allday',
  saturationThreshold: 15,
  incomeMin: 40000,
  incomeSweet: 75000,
  transitDependency: 0.5,
  footTrafficDependency: 0.5,
};

// Ensemble blend constants — calibrated via backtesting on NYC block groups (March 2026)
// BLEND_ALPHA: 54% composite (fitScore) + 46% linear. Re-calibrate if scoring formula changes.
const BLEND_ALPHA = 0.54;
const BLEND_POW = 1.1;  // Mild nonlinear separation — keeps scores from bunching at 50

// Global adjustment thresholds — named constants for reviewability (#42 fix)
/** Yelp reviews-per-business threshold: above this = saturated / tourist trap, not local gem */
const YELP_REVIEWS_PER_BIZ_SATURATION = 400;
/** DOB Future Occupancy (FO) permits: more than this in 0.25mi = incoming competition spike */
const DOB_FO_COMPETITION_THRESHOLD = 4;
/** Median age: below this = younger demographic (slight vibrancy bonus) */
const MEDIAN_AGE_YOUNG_THRESHOLD = 35;
/** Median age: below this = mixed (small vibrancy bonus) */
const MEDIAN_AGE_MID_THRESHOLD = 38;
/** Median age: above this = older demographic (mild vibrancy penalty for impulse concepts) */
const MEDIAN_AGE_OLD_THRESHOLD = 45;
/** Manhattan F&D density: above this = saturated, no room for new entrant without differentiation */
const MANHATTAN_FD_SATURATION_THRESHOLD = 12;
/** 311 Drinking complaints: Manhattan multiplier 4x vs outer borough 2x (higher base noise) */
const DRINKING_COMPLAINTS_MANHATTAN_MULT = 4.0;
const DRINKING_COMPLAINTS_OUTER_MULT = 2.0;

// === UTILITY ===
function clamp(v, min=0, max=100) { return Math.max(min, Math.min(max, Math.round(v))); }

function scoreLinear(v, lo, hi, inv=false) {
  const n = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return clamp(Math.round((inv ? 1 - n : n) * 100));
}

function scorePercentile(v, breakpoints, inv=false) {
  if (!breakpoints.length) return 50;
  if (v <= breakpoints[0]) return inv ? 100 : 0;
  if (v >= breakpoints[breakpoints.length - 1]) return inv ? 0 : 100;
  let lo = 0, hi = breakpoints.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (breakpoints[mid] <= v) lo = mid; else hi = mid;
  }
  const pctLo = (lo / (breakpoints.length - 1)) * 100;
  const pctHi = (hi / (breakpoints.length - 1)) * 100;
  const frac = (v - breakpoints[lo]) / (breakpoints[hi] - breakpoints[lo] || 1);
  return clamp(Math.round(inv ? 100 - (pctLo + frac * (pctHi - pctLo)) : pctLo + frac * (pctHi - pctLo)));
}

function grade(s) {
  if (s >= 93) return 'A+'; if (s >= 87) return 'A'; if (s >= 80) return 'A-';
  if (s >= 73) return 'B+'; if (s >= 67) return 'B'; if (s >= 60) return 'B-';
  if (s >= 53) return 'C+'; if (s >= 47) return 'C'; if (s >= 40) return 'C-';
  if (s >= 30) return 'D'; return 'F';
}

// BRAIN-COP-04: Decision state labels based on Fit IQ (from neighborhood-profiles.ts)
function getDecisionState(fitScore) {
  if (fitScore >= 75) return 'STRONG GO';
  if (fitScore >= 65) return 'GO WITH REFINEMENTS';
  if (fitScore >= 50) return 'WORTH TESTING';
  if (fitScore >= 40) return 'HIGH RISK';
  return 'DO NOT PURSUE';
}

// NYC block group distribution breakpoints
const NYC_D = {
  income: [15000, 28000, 38000, 48000, 58000, 68000, 82000, 100000, 125000, 165000, 250000],
  pop: [200, 800, 1200, 1800, 2500, 3200, 4200, 5500, 7500, 12000, 55000],
  edu: [2, 8, 14, 20, 28, 36, 44, 54, 64, 76, 95],
  age: [18, 25, 28, 31, 33, 36, 39, 42, 47, 55, 85],
};

// === CYCLE 2H SCORING FUNCTIONS ===

// FIQ-01: Extend with optional taxPassThrough (effective rent = base + tax).
// spec §3.2: effectiveRent = baseRent + monthlyTaxPassThrough; use in rent-to-income calc.
function computePriceIncomeFit(income, concept, borough, monthlyTaxPassThrough = 0) {
  if (!income || income <= 0) return 50;

  const sufficiency = income >= concept.incomeSweet ? 100
    : income >= concept.incomeMin ? scoreLinear(income, concept.incomeMin, concept.incomeSweet)
    : scoreLinear(income, concept.incomeMin * 0.5, concept.incomeMin);

  // IMP-01: Steepened rent penalty curve. BEFORE: /2000 divisor, max 10. AFTER: /1200 divisor, max 15.
  // Rationale: RENT_INCREASE closures score 70.3 vs 71.1 for successes — near-identical.
  // The old linear slope was too shallow to discriminate.
  let rentPenalty = 0;
  if (borough.incomeDirection === 'inverted') {
    if (income > concept.incomeSweet * 1.3) {
      rentPenalty = Math.min(15, Math.round((income - concept.incomeSweet * 1.3) / 1200));
    }
  }

  // Tax pass-through penalty: steepen rent penalty proportional to annual tax burden.
  // A $2,400/mo tax on a $400K/yr juice bar adds ~7% to occupancy cost — materially hurts.
  let taxPenalty = 0;
  if (monthlyTaxPassThrough > 0 && concept.defaultRevenue > 0) {
    const annualTaxBurden = (monthlyTaxPassThrough * 12) / concept.defaultRevenue;
    if (annualTaxBurden > 0.04) taxPenalty = Math.min(12, Math.round((annualTaxBurden - 0.04) * 120));
    else if (annualTaxBurden > 0.02) taxPenalty = Math.round((annualTaxBurden - 0.02) * 60);
  }

  return clamp(sufficiency - rentPenalty - taxPenalty);
}

function computeConceptCompetition(report, concept) {
  // Strategy C: filter marketDensity.categories by concept-specific competitionCategories.
  // Uses underscore/space normalization so 'Coffee Shop' matches 'coffee_shop' across
  // Google Places, Foursquare, and Yelp category naming conventions.
  const normalize = s => s.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
  const catDist = report.marketDensity?.categories || [];
  const sameCategoryCount = catDist
    .filter(c => concept.competitionCategories.some(cc => {
      const cn = normalize(c.name), ccn = normalize(cc);
      return cn.includes(ccn) || ccn.includes(cn);
    }))
    .reduce((sum, c) => sum + (c.count || 0), 0);
  const threshold = concept.saturationThreshold;

  if (sameCategoryCount === 0) return 20;
  const ratio = sameCategoryCount / threshold;
  if (ratio <= 0.3) return 40;
  if (ratio <= 0.6) return 60;
  if (ratio <= 1.0) return 80;
  if (ratio <= 1.5) return 90;
  if (ratio <= 2.0) return 75;
  if (ratio <= 3.0) return 55;
  return Math.max(25, 55 - Math.round((ratio - 3.0) * 10));
}

function computeAccessibility(report, borough) {
  let score = 50;

  if (borough.isCarDependent) {
    let signals = 0, sum = 0;
    if (report.marketDensity) { sum += report.marketDensity.commercialVitality; signals++; }
    if (report.dcaLicenses) { sum += report.dcaLicenses.ecosystemScore; signals++; }
    if (report.competitors) {
      const t = (report.competitors.rings?.ring1?.length || 0) + (report.competitors.rings?.ring2?.length || 0);
      sum += scoreLinear(t, 0, 30); signals++;
    }
    return signals > 0 ? clamp(Math.round(sum / signals)) : 50;
  }

  const walkScore = report.walkScore?.walkScore || 0;
  const transitScore = report.walkScore?.transitScore || 0;
  const mtaTransit = report.mtaRidership?.transitScore || 0;

  const walkPart = scorePercentile(walkScore, [0, 50, 70, 80, 85, 88, 91, 93, 95, 97, 100]);
  // FIX-T1: always compute WalkScore transit percentile; blend with MTA (WS=70%, MTA=30%)
  // Previously: mtaTransit || wsPercentile — this completely ignored WalkScore when MTA > 0
  const wsTransitPart = transitScore > 0
    ? scorePercentile(transitScore, [0, 40, 60, 72, 80, 85, 88, 91, 94, 97, 100])
    : 0;
  const transitPart = (mtaTransit > 0 && wsTransitPart > 0)
    ? Math.round(wsTransitPart * 0.70 + mtaTransit * 0.30)
    : (wsTransitPart || mtaTransit || 0);

  const footTraffic = report.pedestrian?.footTrafficScore || 0;

  if (footTraffic > 0) {
    score = Math.round(walkPart * 0.3 + transitPart * 0.4 + footTraffic * 0.3);
  } else {
    score = Math.round(walkPart * 0.45 + transitPart * 0.55);
  }

  return clamp(score);
}

function computeDemographics(report, borough, concept) {
  if (!report.census) return 50;

  const income = report.census.medianHouseholdIncome || 0;
  const pop = report.census.totalPopulation || 0;
  const edu = report.census.bachelorsPlusPercent || 0;
  const age = report.census.medianAge || 30;

  let incomeScore;
  if (borough.incomeDirection === 'inverted') {
    const dist = Math.abs(income - concept.incomeSweet);
    incomeScore = clamp(100 - Math.round(dist / 1000));
  } else {
    incomeScore = scorePercentile(income, NYC_D.income);
  }

  const popScore = scorePercentile(pop, NYC_D.pop);
  const eduScore = scorePercentile(edu, NYC_D.edu);
  const ageScore = scorePercentile(age, NYC_D.age, true);

  let score = Math.round(incomeScore * 0.20 + popScore * 0.20 + eduScore * 0.20 + ageScore * 0.40);

  if (report.censusHousing) {
    // IMP-01: Raised threshold from 35 to 40. Post-COVID, >60% of NYC census tracts
    // exceed 35% rent burden, making it non-discriminating. 40% better separates
    // high-demand neighborhoods from baseline.
    if (report.censusHousing.rentBurdenedPct > 40) score = Math.round(score * 1.06);
    if (report.censusHousing.vacancyRate > 15) score = Math.round(score * 0.92);
    else if (report.censusHousing.vacancyRate < 5) score = Math.round(score * 1.04);
  }

  return clamp(score);
}

function computeMarketProof(report) {
  let score = 35;

  if (report.foursquare) {
    const indep = report.foursquare.independentCount || 0;
    const total = report.foursquare.venueCount || 0;

    const indepScore = scoreLinear(indep, 15, 50);
    const indepRatio = total > 0 ? indep / total : 0.5;
    const ratioScore = clamp(Math.round(indepRatio * 120));

    score = Math.round(indepScore * 0.65 + ratioScore * 0.35);
  }

  if (report.dcaLicenses) {
    const dcaScore = report.dcaLicenses.ecosystemScore;
    if (!report.foursquare) {
      score = dcaScore;
    } else {
      score = Math.round(score * 0.80 + dcaScore * 0.20);
    }
  }

  if (report.inspections?.totalNearby) {
    const inspDensity = scoreLinear(report.inspections.totalNearby, 30, 250);
    score = Math.round(score * 0.85 + inspDensity * 0.15);
  }

  // FIX-019B: No Foursquare data = unknown, not terrible. Floor at 15.
  if (!report.foursquare) {
    score = Math.max(score, 15);
  }

  return clamp(score);
}

function computeVibrancy(report) {
  const signals = [];
  if (report.sidewalkCafes) signals.push(report.sidewalkCafes.vibrancySignal * 1.5);
  if (report.dcaLicenses) signals.push(report.dcaLicenses.ecosystemScore);
  if (report.liquorLicenses) signals.push(report.liquorLicenses.vibrancySignal);
  // BUG-7 FIX: nightlifeDensity (on-premise licenses only) captures bar/lounge zones missed by
  // total liquor vibrancySignal. Boosted ×1.2 — on-premise is direct evidence of evening activity.
  if (report.liquorLicenses?.nightlifeDensity) signals.push(report.liquorLicenses.nightlifeDensity * 1.2);
  if (report.marketDensity) signals.push(report.marketDensity.commercialVitality);
  // BUG-7 FIX: Foursquare venue density is the most direct measure of commercial activity on
  // a block — captures bars, restaurants, retail all in one signal. Missing before this fix.
  if (report.foursquare?.vibrancySignal) signals.push(report.foursquare.vibrancySignal);
  if (report.yelp?.priceProfile?.qualityGapSignal) signals.push(report.yelp.priceProfile.qualityGapSignal);

  if (signals.length === 0) return 30;

  signals.sort((a, b) => b - a);
  const best = Math.min(100, signals[0]);
  const rest = signals.length > 1 ? signals.slice(1).reduce((s, v) => s + v, 0) / (signals.length - 1) : best;
  return clamp(Math.round(best * 0.5 + rest * 0.5));
}

function computeSafety(report) {
  let sc = 0, ss = 0;
  if (report.crime) { ss += report.crime.crimeScore; sc++; }
  if (report.complaints311) { ss += report.complaints311.qualityScore; sc++; }
  if (report.dob) { ss += Math.max(10, 100 - report.dob.riskScore); sc++; }
  return sc > 0 ? clamp(Math.round(ss / sc)) : 70;
}

function computeMomentum(report) {
  let mc = 0, ms = 0;
  if (report.dob) {
    let dm = 50;
    if (report.dob.newBuildingCount > 3) dm = 85; else if (report.dob.newBuildingCount > 0) dm = 65; else dm = 40;
    if (report.dob.permitCount > 10) dm = Math.min(95, dm + 10);
    ms += dm; mc++;
  }
  if (report.pluto) { ms += report.pluto.developmentPotential; mc++; }
  if (report.dcaLicenses) {
    const rt = report.dcaLicenses.newBusinessRate;
    let d = 50;
    if (rt >= 15 && rt <= 25) d = 80; else if (rt >= 10) d = 65; else if (rt < 5) d = 30;
    ms += d; mc++;
  }
  return mc > 0 ? clamp(Math.round(ms / mc)) : 50;
}

// === V4 NEW FUNCTIONS ===

/**
 * Concept-Age Fit — bonus/penalty based on median age vs concept's target age range.
 * Returns a value in roughly [-8, +6] range that feeds into Vision IQ.
 */
function computeAgeFit(medianAge, conceptConfig) {
  if (!conceptConfig.targetAgeRange || !medianAge) return 0;
  const [idealMin, idealMax] = conceptConfig.targetAgeRange;
  const idealCenter = (idealMin + idealMax) / 2;
  if (medianAge >= idealMin && medianAge <= idealMax) {
    // Inside sweet spot — bonus scales from +6 at center to 0 at edges
    const distFromCenter = Math.abs(medianAge - idealCenter);
    const maxDist = (idealMax - idealMin) / 2;
    return Math.round(6 * (1 - distFromCenter / maxDist));
  }
  // Outside — penalty grows with distance
  const distOutside = medianAge < idealMin ? idealMin - medianAge : medianAge - idealMax;
  return -Math.min(8, Math.round(distOutside * 0.5));
}

/**
 * Location IQ v2 — concept-independent location quality score.
 * Uses only concept-independent sub-scores (no competition, no priceIncomeFit).
 * Designed as B2B product for real estate firms.
 */
function computeLocationIQv2(marketProof, accessibility, vibrancy, demographics, safety, momentum, boroughBonus) {
  const base =
    marketProof * 0.28 +
    accessibility * 0.25 +
    vibrancy * 0.15 +
    demographics * 0.10 +
    safety * 0.12 +
    momentum * 0.10;
  // Borough bonus contributes capped influence
  const bbContribution = Math.min(12, Math.max(-8, boroughBonus * 0.18));
  return clamp(Math.round(base + bbContribution));
}

/**
 * Vision IQ — concept-specific fit score.
 * Combines concept-differentiated signals: competition, priceIncomeFit, ageFit.
 * Forces user to provide concept details for nuanced scoring.
 */
function computeVisionIQScore(competition, priceIncomeFit, ageFit, taxAdjustment = 0) {
  // Normalize ageFit from [-8,+6] to [0,100] scale
  const ageFitNorm = clamp(Math.round(50 + ageFit * 3.5));
  const raw = Math.round(
    competition * 0.45 +
    priceIncomeFit * 0.35 +
    ageFitNorm * 0.20
  );
  // taxAdjustment: negative penalties from escalation risk (VIQ-02) and tax lien (VIQ-03)
  // Applied post-blend so they don't distort individual component weights
  return clamp(raw + taxAdjustment);
}

/**
 * COFFEE 6-DIMENSION SCORER — Batch version of the live coffee scoring rewire.
 * Mirrors six-index.ts computeSixIndex() coffee branch but works with batch report data.
 *
 * 6 dimensions: morningFootTraffic (0.30), dailyRitualDensity (0.25),
 * competitionContext (0.15), streetSide (0.10), demographicsFit (0.10),
 * baseViability (0.10).
 *
 * Batch context = no user session, so avgTicket defaults to $5.00 (standard, no
 * price-sensitive effects) and visionTier defaults to 'standard' (×1.00).
 * The live path applies user-specific avgTicket/visionTier at query time.
 */
function scoreCoffeeSixDim(report, c2hScores) {
  // ── Dimension 1: Morning Foot Traffic (weight 0.30) ──
  // MTA ridership + pedestrian counts as proxy for morning rush
  const mtaDaily = report.mtaRidership?.totalDailyRidership || 0;
  const pedCount = report.pedestrian?.avgAm || report.pedestrian?.totalCount || 0;
  // Estimate morning passersby: ~30% of daily MTA exits + pedestrian AM count
  const morningRaw = Math.round(mtaDaily * 0.30 + pedCount * 0.5);
  // CALIBRATION v1.1 Fix B: Matches six-index.ts live path brackets
  const ftScore = morningRaw >= 10000 ? 95   // True transit hub
    : morningRaw >= 5000 ? 88               // Strong corridor
    : morningRaw >= 3000 ? 72               // Good, not great
    : morningRaw >= 1500 ? 52               // Moderate
    : morningRaw >= 500 ? 30                // Thin traffic
    : 12;                                   // Destination only

  // ── Dimension 2: Daily Ritual Density (weight 0.25) ──
  // Proxy from commercial vitality + office density + gym/fitness presence
  const marketVitality = report.marketDensity?.commercialVitality || 0;
  const osmOffices = report.competitors?.amenities?.offices?.length || 0;
  const osmGyms = report.competitors?.amenities?.gyms?.length || 0;
  const dcaCount = report.dcaLicenses?.totalCount || 0;
  // Scale: offices + gyms generate daily repeat visitors
  const anchorSignal = Math.min(100, osmOffices * 8 + osmGyms * 12 + dcaCount * 2);
  const rdScore = clamp(Math.round(marketVitality * 0.4 + anchorSignal * 0.6));

  // ── Dimension 3: Competition Context (weight 0.15) ──
  // Use the existing c2h competition score + chain presence adjustment
  const baseCompetition = c2hScores.competition || 50;
  const fsqChainPct = report.foursquare?.chainPercentage || 0;
  // High chain % = room for quality independent (bonus), saturated independents = harder
  const chainAdj = fsqChainPct >= 60 ? 10 : fsqChainPct >= 40 ? 5 : 0;
  const ccScore = clamp(baseCompetition + chainAdj);

  // ── Dimension 4: Street-Side (weight 0.10) ──
  // No street-side data in batch context (requires per-address analysis)
  // Default to 50 (neutral). Live path overrides with real streetSideScore.
  const ssScore = 50;

  // ── Dimension 5: Demographics Fit (weight 0.10) ──
  // Standard curve at $5.00 default (no premium shift). Use c2h demographics.
  const dfScore = c2hScores.demographics || 50;

  // ── Dimension 6: Base Viability (weight 0.10) ──
  // Safety + market proof blend as viability proxy
  const bvScore = clamp(Math.round((c2hScores.safety || 50) * 0.3 + (c2hScores.marketProof || 50) * 0.7));

  // ── Composite: 6-dimension weighted sum ──
  const rawComposite = ftScore * 0.30
    + rdScore * 0.25
    + ccScore * 0.15
    + ssScore * 0.10
    + dfScore * 0.10
    + bvScore * 0.10;

  // Vision multiplier = 1.0 in batch (no user session)
  const locationIQ = clamp(Math.round(rawComposite));

  return {
    locationIQ,
    morningFootTraffic: ftScore,
    dailyRitualDensity: rdScore,
    competitionContext: ccScore,
    streetSide: ssScore,
    demographicsFit: dfScore,
    baseViability: bvScore,
    rawComposite: Math.round(rawComposite),
  };
}

/**
 * MAIN CYCLE 2H SCORER — Borough + Concept aware with ensemble model
 * Returns {fitScore, linearScore, accessibility, demographics, competition,
 *          marketProof, vibrancy, priceIncomeFit, boroughBonus}
 * *** UNCHANGED FROM V3 — preserves d=0.601 calibration ***
 */
function scoreCycle2(report, borough, conceptType, rawBgi) {
  const bc = BOROUGH_CONFIG[borough] || DEFAULT_BOROUGH_CONFIG;
  const cc = CONCEPT_CONFIG[conceptType] || DEFAULT_CONCEPT;

  // Sub-scores
  const accessibility = computeAccessibility(report, bc);
  const demographics = computeDemographics(report, bc, cc);
  const competition = computeConceptCompetition(report, cc);
  const priceIncomeFit = computePriceIncomeFit(
    report.census?.medianHouseholdIncome || 0, cc, bc,
    report.propertyTax?.monthlyTaxPassThrough || 0   // FIQ-01/VIQ-01: tax pass-through
  );
  const vibrancy = computeVibrancy(report);
  const marketProof = computeMarketProof(report);
  const safety = computeSafety(report);
  const momentum = computeMomentum(report);

  // Borough-specific bonus signals
  let boroughBonus = 0;
  if (borough === 'Manhattan') {
    let mhBonus = 0, mhCount = 0;

    const raw311 = rawBgi?.['311_complaints'];
    if (raw311?.by_type) {
      const bt = raw311.by_type;
      const posSignals = [
        (bt['Encampment'] || 0),
        (bt['Non-Residential Heat'] || 0),
        (bt['For Hire Vehicle Complaint'] || 0),
        (bt['Lost Property'] || 0),
        (bt['Water System'] || 0),
        (bt['Street Condition'] || 0),
        (bt['Noise - Helicopter'] || 0),
      ];
      const posTotal = posSignals.reduce((s, v) => s + v, 0);
      const posScore = scoreLinear(posTotal, 5, 60);

      const drinkingComplaints = bt['Drinking'] || 0;
      const drinkPenalty = scoreLinear(drinkingComplaints, 0, 5) * 0.3;

      mhBonus += Math.max(0, posScore - drinkPenalty); mhCount++;
    } else if (report.complaints311) {
      mhBonus += scoreLinear(report.complaints311.totalCount || 0, 30, 200); mhCount++;
    }

    const rawDob = rawBgi?.dob_permits;
    if (rawDob?.by_type?.EQ) {
      mhBonus += scoreLinear(rawDob.by_type.EQ, 0, 6); mhCount++;
    }

    if (report.dcaLicenses) {
      mhBonus += report.dcaLicenses.ecosystemScore; mhCount++;
    }

    if (report.census) {
      const laborForce = rawBgi?.census_demographics?.in_labor_force || 0;
      const pop = report.census.totalPopulation || 0;
      mhBonus += scoreLinear(laborForce + pop, 500, 3500); mhCount++;
    }

    boroughBonus = mhCount > 0 ? (mhBonus / mhCount) * 0.80 : 0;
  } else if (borough === 'Brooklyn') {
    let bkBonus = 0, bkPenalty = 0;
    let bkScore = 0, bkN = 0;

    if (report.walkScore) {
      bkScore += scoreLinear(report.walkScore.bikeScore || 0, 55, 90); bkN++;
      bkScore += scoreLinear(report.walkScore.walkScore || 0, 80, 98); bkN++;
    }
    if (report.foursquare) {
      bkScore += scoreLinear(report.foursquare.independentCount || 0, 10, 55); bkN++;
    }
    if (report.yelp?.places?.avgRating) {
      bkScore += scoreLinear(report.yelp.places.avgRating, 3.0, 4.3); bkN++;
    }

    const raw311bk = rawBgi?.['311_complaints'];
    if (raw311bk?.by_type) {
      const bt = raw311bk.by_type;
      const posSignals =
        (bt['Sidewalk Condition'] || 0) * 2.0 +
        (bt['Street Condition'] || 0) * 1.5 +
        (bt['Rodent'] || 0) * 1.5 +
        (bt['Homeless Person Assistance'] || 0) * 1.5 +
        (bt['SAFETY'] || 0) * 1.5;
      bkScore += scoreLinear(posSignals, 3, 35); bkN++;

      const maintFac = bt['Maintenance or Facility'] || 0;
      const resDisp = bt['Residential Disposal Complaint'] || 0;
      if (maintFac > 2) bkPenalty += Math.min(8, (maintFac - 2) * 2.0);
      if (resDisp > 1) bkPenalty += Math.min(5, resDisp * 2.0);
    }

    const dohmhBk = rawBgi?.dohmh_inspections;
    if (dohmhBk?.grade_distribution?.N && dohmhBk?.grade_distribution?.N > 8) {
      bkPenalty += Math.min(7, (dohmhBk.grade_distribution.N - 8) * 1.2);
    }

    if (rawBgi?.google_places?.price_level_distribution?.['3']) {
      const exp = rawBgi.google_places.price_level_distribution['3'];
      if (exp > 1) bkPenalty += Math.min(7, exp * 2.0);
    }

    const housingBk = rawBgi?.census_housing;
    if (housingBk?.median_gross_rent) {
      // IMP-01: Tightened rent band from [1600,2500] to [1900,2800] for post-COVID NYC rents.
      // Median gross rent in Brooklyn commercial corridors is now $2000-2400 (Census 2022).
      bkScore += scoreLinear(housingBk.median_gross_rent, 1900, 2800); bkN++;
    }

    boroughBonus = bkN > 0 ? (bkScore / bkN) * 0.70 - bkPenalty : -bkPenalty;
  } else if (borough === 'Queens') {
    let qnBonus = 0, qnPenalty = 0;

    if (report.walkScore) {
      qnBonus += scoreLinear(report.walkScore.bikeScore || 0, 45, 85) * 0.25;
      qnBonus += scoreLinear(report.walkScore.walkScore || 0, 82, 97) * 0.15;
    }
    if (report.foursquare) qnBonus += scoreLinear(report.foursquare.venueCount || 0, 10, 50) * 0.10;

    const yelpRaw = rawBgi?.yelp;
    if (yelpRaw?.price_level_distribution) {
      const mod = yelpRaw.price_level_distribution['$$'] || 0;
      const cheap = yelpRaw.price_level_distribution['$'] || 0;
      qnBonus += scoreLinear(mod, 5, 25) * 0.15;
      if (cheap > 10) qnPenalty += Math.min(10, (cheap - 10) * 1.0);
    }

    const raw311 = rawBgi?.['311_complaints'];
    if (raw311?.by_type) {
      const bt = raw311.by_type;
      const posSignals =
        (bt['Dirty Condition'] || 0) * 1.5 +
        (bt['Maintenance or Facility'] || 0) * 1.5 +
        (bt['Homeless Person Assistance'] || 0) * 1.5 +
        (bt['Sidewalk Condition'] || 0) * 1.0;
      qnBonus += scoreLinear(posSignals, 3, 25) * 0.08;

      const fhv = bt['For Hire Vehicle Complaint'] || 0;
      if (fhv > 5) qnPenalty += Math.min(14, (fhv - 5) * 1.0);
      const curb = bt['Curb Condition'] || 0;
      if (curb > 1) qnPenalty += Math.min(5, curb * 2.0);
      const traf = bt['Traffic'] || 0;
      if (traf > 2) qnPenalty += Math.min(6, (traf - 2) * 1.8);
    }

    if (rawBgi?.dob_permits?.by_type?.MH) {
      const mh = rawBgi.dob_permits.by_type.MH;
      if (mh > 2) qnPenalty += Math.min(8, (mh - 2) * 2.5);
    }
    if (rawBgi?.dob_permits?.by_type?.OT) {
      const ot = rawBgi.dob_permits.by_type.OT;
      if (ot > 3) qnPenalty += Math.min(5, (ot - 3) * 1.5);
    }

    const dohmhQn = rawBgi?.dohmh_inspections;
    if (dohmhQn?.grade_distribution?.P) {
      qnBonus += scoreLinear(dohmhQn.grade_distribution.P, 1, 5) * 0.07;
    }

    const housingQn = rawBgi?.census_housing;
    if (housingQn?.units_1_detached && housingQn.units_1_detached > 80) {
      qnPenalty += Math.min(5, (housingQn.units_1_detached - 80) / 20);
    }

    boroughBonus = qnBonus - qnPenalty;
  } else if (borough === 'Bronx') {
    let bxBonus = 0, bxPenalty = 0;

    if (report.foursquare) {
      bxBonus += scoreLinear(report.foursquare.venueCount || 0, 5, 50) * 0.15;
      bxBonus += scoreLinear(report.foursquare.chainCount || 0, 2, 20) * 0.15;
    }

    const gpRaw = rawBgi?.google_places;
    if (gpRaw?.price_level_distribution) {
      const cheap = gpRaw.price_level_distribution['1'] || gpRaw.price_level_distribution['$'] || 0;
      bxBonus += scoreLinear(cheap, 2, 15) * 0.15;
    }

    const raw311 = rawBgi?.['311_complaints'];
    if (raw311?.by_type) {
      const bt = raw311.by_type;
      const posSignals =
        (bt['Sewer'] || 0) * 3.0 +
        (bt['Traffic Signal Condition'] || 0) * 2.5 +
        (bt['Illegal Parking'] || 0) * 1.5;
      bxBonus += scoreLinear(posSignals, 2, 30) * 0.15;

      const noiseComm = bt['Noise - Commercial'] || 0;
      if (noiseComm > 1) bxPenalty += Math.min(8, noiseComm * 2.5);
    }

    if (gpRaw?.type_distribution?.park) {
      bxBonus += scoreLinear(gpRaw.type_distribution.park, 1, 8) * 0.10;
    }

    const cenRaw = rawBgi?.census_demographics;
    if (cenRaw?.unemployed) {
      const unemp = cenRaw.unemployed;
      if (unemp > 200) bxPenalty += Math.min(8, (unemp - 200) / 50);
    }

    if (cenRaw?.total_population && cenRaw.total_population > 4000) {
      bxPenalty += Math.min(5, (cenRaw.total_population - 4000) / 800);
    }

    const yelpRaw = rawBgi?.yelp;
    if (yelpRaw?.total_reviews && yelpRaw.total_reviews > 3000) {
      bxPenalty += Math.min(6, (yelpRaw.total_reviews - 3000) / 500);
    }

    boroughBonus = bxBonus - bxPenalty;
  } else if (borough === 'Staten Island') {
    let siBonus = 0, siPenalty = 0;

    if (report.foursquare) {
      siBonus += scoreLinear(report.foursquare.venueCount || 0, 3, 30) * 0.15;
      siBonus += scoreLinear(report.foursquare.chainCount || 0, 1, 10) * 0.12;
    }

    const dohmhSI = rawBgi?.dohmh_inspections;
    if (dohmhSI) {
      siBonus += scoreLinear(dohmhSI.record_count || 0, 30, 120) * 0.10;
      if (dohmhSI.grade_distribution?.B) {
        siBonus += scoreLinear(dohmhSI.grade_distribution.B, 3, 12) * 0.12;
      }
    }

    const raw311si = rawBgi?.['311_complaints'];
    if (raw311si?.by_type) {
      const bt = raw311si.by_type;
      const posSignals =
        (bt['Non-Emergency Police Matter'] || 0) * 2.5 +
        (bt['Noise - Residential'] || 0) * 1.5 +
        (bt['Blocked Driveway'] || 0) * 1.0 +
        (bt['Illegal Posting'] || 0) * 2.0 +
        (bt['Building/Use'] || 0) * 1.5;
      siBonus += scoreLinear(posSignals, 3, 25) * 0.12;

      const deadTree = bt['Dead/Dying Tree'] || 0;
      const noise = bt['Noise'] || 0;
      if (deadTree > 1) siPenalty += Math.min(4, deadTree * 1.5);
      if (noise > 1) siPenalty += Math.min(4, noise * 1.5);
    }

    const gpSI = rawBgi?.google_places;
    if (gpSI?.price_level_distribution?.['2']) {
      siBonus += scoreLinear(gpSI.price_level_distribution['2'], 1, 5) * 0.10;
    }
    if (gpSI?.type_distribution?.store) {
      siBonus += scoreLinear(gpSI.type_distribution.store, 2, 8) * 0.08;
    }

    if (report.dcaLicenses) {
      siBonus += scoreLinear(report.dcaLicenses.totalCount || 0, 5, 25) * 0.08;
    }

    if (gpSI?.type_distribution?.convenience_store && gpSI.type_distribution.convenience_store > 1) {
      siPenalty += Math.min(4, gpSI.type_distribution.convenience_store * 1.5);
    }
    if (gpSI?.type_distribution?.meal_delivery && gpSI.type_distribution.meal_delivery > 1) {
      siPenalty += Math.min(4, gpSI.type_distribution.meal_delivery * 1.5);
    }

    boroughBonus = siBonus - siPenalty;
  }

  // Composite fit score — concept-aware weights
  // Location-quality signals (concept-independent): marketProof, accessibility, vibrancy
  // Concept-specific signals: competition, priceIncomeFit
  // Composite fit sub-weights — calibrated (#41: rationale documented)
  //
  // demoWeight = 0.06 (intentionally low): demographics is already captured in Location IQ
  // (NIQ, SIQ). Including it at full weight here would double-count. Set to 0.00 for
  // boroughs where income direction is 'inverted' (Manhattan/Bronx) to avoid penalizing
  // high-income areas that are legitimately great markets.
  //
  // compWeight = 0.22 (highest): competition is the strongest concept-specific predictor.
  // A coffee shop in a sea of restaurants vs another restaurant are completely different
  // competitive situations. This weight makes the scoring most sensitive to concept fit.
  //
  // pifWeight = 0.12: price-income fit is a signal but secondary to competition and market proof.
  // It catches extreme mismatches (luxury concept in budget-income area) without overweighting.
  const demoWeight = (bc.incomeDirection === 'normal') ? 0.06 : 0.00;
  const compWeight = 0.22;    // concept-specific competition — PRIMARY differentiator (see above)
  const pifWeight = 0.12;     // concept-specific price-income fit (see above)
  const remainWeight = 1.0 - demoWeight - compWeight - pifWeight; // ~0.60
  const baseFit =
    marketProof * (remainWeight * 0.45) +    // ~0.27 of total
    accessibility * (remainWeight * 0.35) +   // ~0.21 of total
    vibrancy * (remainWeight * 0.20) +        // ~0.12 of total
    demographics * demoWeight +                // 0.06 (or 0 in Manhattan/Queens)
    competition * compWeight +                 // 0.22 — varies by concept!
    priceIncomeFit * pifWeight;                // 0.12 — varies by concept!

  // Global penalty/bonus signals
  let globalAdj = 0;

  if (report.yelp?.places?.totalReviews && report.yelp?.places?.totalCount) {
    const revPerBiz = report.yelp.places.totalReviews / Math.max(1, report.yelp.places.totalCount);
    if (revPerBiz > YELP_REVIEWS_PER_BIZ_SATURATION)
      globalAdj -= Math.min(10, (revPerBiz - YELP_REVIEWS_PER_BIZ_SATURATION) / 80);
  }

  if (rawBgi?.dob_permits?.by_type?.FO) {
    const fo = rawBgi.dob_permits.by_type.FO;
    if (fo > DOB_FO_COMPETITION_THRESHOLD)
      globalAdj -= Math.min(6, (fo - DOB_FO_COMPETITION_THRESHOLD) * 2);
  }

  if (report.census?.medianAge) {
    const age = report.census.medianAge;
    if (age < MEDIAN_AGE_YOUNG_THRESHOLD) globalAdj += 4;
    else if (age < MEDIAN_AGE_MID_THRESHOLD) globalAdj += 2;
    else if (age > MEDIAN_AGE_OLD_THRESHOLD) globalAdj -= 3;
  }

  if (borough === 'Manhattan' && rawBgi?.google_places?.type_distribution) {
    const food = rawBgi.google_places.type_distribution.food || 0;
    const restaurant = rawBgi.google_places.type_distribution.restaurant || 0;
    if (food + restaurant > MANHATTAN_FD_SATURATION_THRESHOLD)
      globalAdj -= Math.min(5, (food + restaurant - MANHATTAN_FD_SATURATION_THRESHOLD) * 0.8);
  }

  if (rawBgi?.['311_complaints']?.by_type?.['Drinking']) {
    const drinking = rawBgi['311_complaints'].by_type['Drinking'];
    const mult = borough === 'Manhattan' ? DRINKING_COMPLAINTS_MANHATTAN_MULT : DRINKING_COMPLAINTS_OUTER_MULT;
    if (drinking > 1) globalAdj -= Math.min(12, drinking * mult);
  }

  if (borough === 'Manhattan' && rawBgi?.['311_complaints']?.by_type?.['Missed Collection']) {
    const mc = rawBgi['311_complaints'].by_type['Missed Collection'];
    if (mc > 1) globalAdj -= Math.min(6, mc * 2);
  }

  // === BRAIN-V3: SCORING CONSTRAINT ACTIVATIONS ===
  const flags = [];

  // BRAIN-SCORE-03: rentPressure → global adjustment
  // IMP-01: Increased extreme penalty from -8 to -12, high from -4 to -6.
  // BEFORE: { low: +3, moderate: 0, high: -4, extreme: -8 }
  // AFTER:  { low: +3, moderate: 0, high: -6, extreme: -12 }
  const rentAdj = { low: +3, moderate: 0, high: -6, extreme: -12 };
  globalAdj += rentAdj[bc.rentPressure] || 0;
  if (borough === 'Manhattan') {
    // Ground Truth A2: CRT adds 3.9% occupancy cost below 96th Street
    globalAdj -= 2;
    flags.push('CRT_ZONE: Manhattan location subject to 3.9% Commercial Rent Tax');
  }

  // BRAIN-SCORE-01: footTrafficDependency gate
  const ftDep = cc.footTrafficDependency || 0.5;
  if (ftDep >= 0.7 && vibrancy < 30) {
    // High foot-traffic concept in dead zone: hard cap at 55
    flags.push('FOOT_TRAFFIC_GATE: vibrancy=' + vibrancy + ' below 30 threshold for ' + conceptType);
  }

  // BRAIN-SCORE-02: incomeMin hard cliff
  const areaIncome = report.census?.medianHouseholdIncome || 0;
  const incomeMinReq = cc.incomeMin || 40000;
  if (areaIncome > 0 && areaIncome < incomeMinReq * 0.75) {
    // Area income < 75% of concept minimum: hard cap at 45
    globalAdj -= 30; // Will bring most scores down to ≤45 range
    flags.push('INCOME_CLIFF: area median $' + areaIncome + ' < 75% of required $' + incomeMinReq);
  } else if (areaIncome > 0 && areaIncome < incomeMinReq) {
    globalAdj -= 8;
    flags.push('INCOME_SOFT_PENALTY: area median $' + areaIncome + ' below required $' + incomeMinReq);
  }

  // BRAIN-SCORE-04: transitDependency penalty in transit deserts
  const transitDep = cc.transitDependency || 0.5;
  if (transitDep >= 0.6 && accessibility < 35) {
    const transitPenalty = Math.round((35 - accessibility) * transitDep * 0.3);
    globalAdj -= transitPenalty;
    flags.push('TRANSIT_DESERT: accessibility=' + accessibility + ' for transit-dependent ' + conceptType);
  }

  // BRAIN-V3: Ground truth + regulatory flags (TASKS 07-15)
  // lat/geohash not available in batch scorer — pass undefined, GT will use borough fallback
  const gtResult = addGroundTruthFlags(report, rawBgi, borough, conceptType, undefined, undefined);
  for (const f of gtResult.flags) {
    if (!flags.includes(f)) flags.push(f);
  }
  boroughBonus += gtResult.boroughBonusAdj;

  // FIX-019A: Cap boroughBonus contribution to fitScore; kill-floor if market proof is thin
  const cappedBoroughBonus = Math.min(20, Math.max(-15, boroughBonus));
  let rawFitScore = Math.round(baseFit + cappedBoroughBonus + globalAdj);
  // Apply foot traffic gate cap AFTER raw score computed
  if (ftDep >= 0.7 && vibrancy < 30 && rawFitScore > 55) rawFitScore = 55;
  // Apply income cliff cap
  if (areaIncome > 0 && areaIncome < incomeMinReq * 0.75 && rawFitScore > 45) rawFitScore = 45;
  const fitScore = clamp(marketProof < 15 ? Math.min(70, rawFitScore) : rawFitScore);

  // Linear model: borough-agnostic + borough-specific raw features
  let linSum = 0, linW = 0;
  const addLin = (val, lo, hi, w, inv = false) => {
    if (val == null) return;
    let s = clamp(Math.round((val - lo) / (hi - lo) * 100));
    if (inv) s = 100 - s;
    linSum += s * w; linW += w;
  };

  // Global features
  addLin(rawBgi?.foursquare?.independent_count, 10, 55, 0.28);
  addLin(rawBgi?.foursquare?.total_venues, 10, 60, 0.22);
  addLin(rawBgi?.sidewalk_cafes?.record_count, 0, 10, 0.23);
  addLin(rawBgi?.dca_licenses?.record_count, 3, 25, 0.20);
  addLin(rawBgi?.census_demographics?.median_age, 25, 55, 0.14, true);
  addLin(rawBgi?.liquor_licenses?.total_licenses, 2, 40, 0.15);

  // Borough-specific top signals
  if (borough === 'Manhattan') {
    addLin(rawBgi?.['311_complaints']?.by_type?.['Drinking'], 0, 8, 0.76, true);
    addLin(rawBgi?.dob_permits?.by_type?.EQ, 0, 8, 0.68);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Noise - Helicopter'], 0, 3, 0.52);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Non-Residential Heat'], 0, 5, 0.49);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Encampment'], 0, 5, 0.45);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Lost Property'], 0, 5, 0.39);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Missed Collection'], 0, 5, 0.46, true);
    addLin(rawBgi?.census_demographics?.in_labor_force, 200, 2000, 0.26);
    addLin(rawBgi?.dob_permits?.by_type?.FO, 0, 8, 0.36, true);
  } else if (borough === 'Brooklyn') {
    addLin(rawBgi?.walkscore?.bike_score, 50, 95, 0.48);
    addLin(rawBgi?.walkscore?.walkscore, 80, 98, 0.40);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Sidewalk Condition'], 0, 5, 0.46);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Maintenance or Facility'], 0, 5, 0.54, true);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Residential Disposal Complaint'], 0, 5, 0.39, true);
    addLin(rawBgi?.dohmh_inspections?.grade_distribution?.N, 0, 20, 0.50, true);
    addLin(rawBgi?.google_places?.price_level_distribution?.['3'], 0, 5, 0.56, true);
    addLin(rawBgi?.yelp?.avg_rating, 3.0, 4.5, 0.34);
    // IMP-01: Tightened from [1500,2500] to [1800,2800] for post-COVID Manhattan rents.
    addLin(rawBgi?.census_housing?.median_gross_rent, 1800, 2800, 0.32);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Rodent'], 0, 5, 0.36);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Homeless Person Assistance'], 0, 5, 0.35);
  } else if (borough === 'Queens') {
    addLin(rawBgi?.walkscore?.bike_score, 40, 90, 0.78);
    addLin(rawBgi?.yelp?.price_level_distribution?.['$$'], 3, 25, 1.05);
    addLin(rawBgi?.['311_complaints']?.by_type?.['For Hire Vehicle Complaint'], 0, 30, 1.02, true);
    addLin(rawBgi?.walkscore?.walkscore, 80, 98, 0.59);
    addLin(rawBgi?.dob_permits?.by_type?.MH, 0, 8, 0.61, true);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Curb Condition'], 0, 5, 0.50, true);
    addLin(rawBgi?.yelp?.price_level_distribution?.['$'], 0, 20, 0.69, true);
    addLin(rawBgi?.dohmh_inspections?.grade_distribution?.P, 0, 5, 0.51);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Dirty Condition'], 0, 6, 0.34);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Traffic'], 0, 5, 0.43, true);
    addLin(rawBgi?.census_housing?.units_1_detached, 0, 200, 0.30, true);
  } else if (borough === 'Bronx') {
    addLin(rawBgi?.['311_complaints']?.by_type?.['Sewer'], 0, 5, 0.82);
    addLin(rawBgi?.foursquare?.chain_count, 1, 20, 0.74);
    addLin(rawBgi?.google_places?.type_distribution?.park, 0, 5, 1.31);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Traffic Signal Condition'], 0, 5, 0.71);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Noise - Commercial'], 0, 5, 0.62, true);
    addLin(rawBgi?.census_demographics?.unemployed, 0, 500, 0.52, true);
    addLin(rawBgi?.google_places?.price_level_distribution?.['1'], 1, 15, 0.75);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Illegal Parking'], 0, 10, 0.50);
    addLin(rawBgi?.census_demographics?.total_population, 500, 5000, 0.39, true);
  } else if (borough === 'Staten Island') {
    addLin(rawBgi?.dohmh_inspections?.grade_distribution?.B, 2, 12, 0.62);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Non-Emergency Police Matter'], 0, 5, 0.61);
    addLin(rawBgi?.google_places?.price_level_distribution?.['2'], 0, 5, 0.49);
    addLin(rawBgi?.foursquare?.total_venues, 3, 35, 0.41);
    addLin(rawBgi?.foursquare?.chain_count, 1, 10, 0.38);
    addLin(rawBgi?.dohmh_inspections?.record_count, 20, 120, 0.30);
    addLin(rawBgi?.google_places?.type_distribution?.store, 2, 8, 0.47);
    addLin(rawBgi?.['311_complaints']?.by_type?.['Dead/Dying Tree'], 0, 4, 0.48, true);
    addLin(rawBgi?.google_places?.type_distribution?.meal_delivery, 0, 4, 0.54, true);
  }

  const linearScore = linW > 0 ? clamp(Math.round(linSum / linW)) : 50;

  // Data availability
  const srcKeys = ['census', 'censusHousing', 'walkScore', 'inspections', 'crime', 'places',
    'marketDensity', 'competitors', 'lpc', 'mtaRidership', 'dcaLicenses', 'dob',
    'complaints311', 'pedestrian', 'pluto', 'sidewalkCafes', 'liquorLicenses', 'foursquare'];
  const available = srcKeys.filter(k => report[k] != null).length;

  return {
    fitScore,
    linearScore,
    accessibility,
    demographics,
    competition,
    priceIncomeFit,
    vibrancy,
    marketProof,
    safety,
    momentum,
    boroughBonus,
    flags,
    available,
    grade: grade(fitScore),
    decisionState: getDecisionState(fitScore),
  };
}

// === BRAIN-V3: GROUND TRUTH + REGULATORY FLAGS ENGINE (TASKS 07-15) ===

// TASK 08: CRT zone detection (lat-based)
function isCRTZone(borough, lat) {
  // 96th Street in Manhattan ≈ latitude 40.785
  return borough === 'Manhattan' && lat < 40.785;
}

// TASK 09: Zoning compatibility matrix (MVP: informational flags only)
const ZONING_PERMITTED = {
  C1: ['retail', 'office', 'personal_services', 'bakery'],
  C2: ['retail', 'office', 'personal_services', 'full_service_restaurant', 'bakery', 'specialty_coffee', 'fast_casual', 'qsr'],
  C3: ['retail', 'office', 'personal_services', 'full_service_restaurant', 'bar_nightlife', 'bakery', 'specialty_coffee', 'fast_casual', 'qsr'],
  C4: ['retail', 'office', 'personal_services', 'full_service_restaurant', 'bar_nightlife', 'medical_office', 'fitness_studio', 'bakery', 'specialty_coffee', 'fast_casual', 'qsr', 'florist', 'wellness_spa', 'wellness_beverage', 'juice_bar'],
  C5: ['ALL'],
  C6: ['ALL'],
  C7: ['SPECIAL_PERMIT_REQUIRED'],
  C8: ['SPECIAL_PERMIT_REQUIRED'],
};

// Known NYC BID geohash prefix map (5-char prefixes)
const BID_ZONES = {
  // Times Square Alliance — Midtown West
  'dr5ru': { name: 'Times Square Alliance', annualPerKSF: 25 },
  'dr5rt': { name: 'Times Square Alliance', annualPerKSF: 25 },
  // Grand Central Partnership — Midtown East
  'dr5rg': { name: 'Grand Central Partnership', annualPerKSF: 20 },
  'dr5rf': { name: 'Grand Central Partnership', annualPerKSF: 20 },
  // Bryant Park — Midtown
  'dr5rh': { name: 'Bryant Park Corporation', annualPerKSF: 15 },
  // Union Square Partnership — Flatiron/Union Sq
  'dr5re': { name: 'Union Square Partnership', annualPerKSF: 15 },
  'dr5rd': { name: 'Union Square Partnership', annualPerKSF: 15 },
  // Downtown Alliance — Lower Manhattan
  'dr5rk': { name: 'Downtown Alliance', annualPerKSF: 12 },
  'dr5r7': { name: 'Downtown Alliance', annualPerKSF: 12 },
  // Chelsea — West side
  'dr5r3': { name: 'Chelsea BID', annualPerKSF: 12 },
  // Hudson Square
  'dr5r6': { name: 'Hudson Square BID', annualPerKSF: 10 },
};

// Known Historic/Landmark district geohash prefixes
const LANDMARK_DISTRICTS = {
  'dr5r5': 'SoHo-Cast Iron Historic District',
  'dr5r4': 'Greenwich Village Historic District',
  'dr5r3': 'Chelsea Historic District',
  'dr5qc': 'Brooklyn Heights Historic District',
  'dr5qe': 'Park Slope Historic District',
  'dr72j': 'Riverdale Historic District',
};

// Known Enhanced Commercial District prefixes
const EC_DISTRICTS = {
  'dr5re': true, // 14th St / Union Square
  'dr5rf': true, // 42nd St / Grand Central
  'dr5rg': true, // Park Ave South
  'dr5ru': true, // Times Square corridor
};

// TASK 07: Business mix saturation benchmarks (DCP 2024)
const CITYWIDE_MIX = {
  food_and_drink: 0.21,
  retail: 0.29,
  services: 0.32,
  community: 0.18,
};

/**
 * addGroundTruthFlags — TASKS 07-15
 * Returns array of flag strings and any score adjustments.
 * @param {object} report - built report object
 * @param {object} rawBgi - raw block group intel
 * @param {string} borough
 * @param {string} conceptType
 * @param {number} lat - location latitude (may be undefined for batch)
 * @param {string} geohash - 5-char geohash prefix (may be undefined)
 * @returns {{ flags: string[], boroughBonusAdj: number }}
 */
function addGroundTruthFlags(report, rawBgi, borough, conceptType, lat, geohash) {
  const flags = [];
  let boroughBonusAdj = 0;

  // TASK 07: Business mix saturation
  if (rawBgi?.google_places?.type_distribution) {
    const td = rawBgi.google_places.type_distribution;
    const total = Object.values(td).reduce((s, v) => s + v, 0);
    if (total > 0) {
      const foodTypes = ['restaurant', 'cafe', 'bakery', 'bar', 'meal_delivery', 'meal_takeaway', 'food'];
      const foodCount = foodTypes.reduce((s, t) => s + (td[t] || 0), 0);
      const foodPct = foodCount / total;
      const serviceTypes = ['hair_care', 'beauty_salon', 'spa', 'laundry', 'insurance_agency', 'bank', 'finance'];
      const serviceCount = serviceTypes.reduce((s, t) => s + (td[t] || 0), 0);
      const servicePct = serviceCount / total;
      if (foodPct > 0.25) flags.push('MARKET_SATURATION_FOOD_DRINK: ' + Math.round(foodPct * 100) + '% F&D (citywide benchmark 21%)');
      if (servicePct > 0.35) flags.push('SERVICES_OVERSUPPLY: ' + Math.round(servicePct * 100) + '% services (citywide benchmark 32%)');
    }
  }

  // TASK 08: CRT zone (lat-based, or borough fallback)
  if (lat && isCRTZone(borough, lat)) {
    flags.push('CRT_ZONE: +3.9% occupancy cost. Quarterly filing required (RF-1). Non-refundable.');
  } else if (!lat && borough === 'Manhattan') {
    flags.push('CRT_ZONE: Manhattan — verify if below 96th St (+3.9% occupancy cost).');
  }

  // TASK 10: ADA + Environmental (pre-1978 buildings)
  if (rawBgi?.dob_permits?.avg_year_built || rawBgi?.pluto?.avg_year_built) {
    const yearBuilt = rawBgi.pluto?.avg_year_built || rawBgi.dob_permits?.avg_year_built || 0;
    if (yearBuilt > 0 && yearBuilt < 1978) {
      flags.push('ADA_RETROFIT_LIKELY: Pre-1978 building. Estimated cost $10,000-$30,000');
      flags.push('ENVIRONMENTAL_REVIEW: Pre-1978 building. Lead/asbestos presumed present.');
    } else if (yearBuilt > 0 && yearBuilt < 1981) {
      flags.push('ENVIRONMENTAL_REVIEW: Pre-1981 building. Asbestos presumed present.');
    }
  }

  // TASK 11: Environmental risk from DOB industrial permits
  if (rawBgi?.dob_permits?.by_type) {
    const bt = rawBgi.dob_permits.by_type;
    const industrialTypes = ['BX', 'MN']; // boiler/elevator, manufacturing
    const hasIndustrial = industrialTypes.some(t => (bt[t] || 0) > 0);
    if (hasIndustrial) {
      flags.push('ENVIRONMENTAL_HIGH_RISK: Former industrial use detected. Phase I ESA required ($1,500-$3,000).');
    }
  }

  // TASK 12: Occupancy cost kill rule
  if (borough === 'Manhattan' && rawBgi?.pluto && flags.some(f => f.startsWith('CRT_ZONE'))) {
    const bc = BOROUGH_CONFIG[borough] || DEFAULT_BOROUGH_CONFIG;
    if (bc.rentPressure === 'extreme') {
      flags.push('OCCUPANCY_COST_WARNING: Extreme rent pressure + CRT (3.9%) may exceed 10% kill threshold. Verify specific rent against revenue projections.');
    }
  }

  // TASK 13: Landmark/Historic District flagging
  if (geohash && LANDMARK_DISTRICTS[geohash]) {
    const districtName = LANDMARK_DISTRICTS[geohash];
    flags.push('LANDMARK_DISTRICT: ' + districtName + '. LPC approval required for exterior work. No internally illuminated signs. Max sign text 8-12". CofA timeline: 6-8 weeks.');
    // Impulse archetypes suffer more from signage restrictions
    const impulseTypes = ['specialty_coffee', 'bakery', 'juice_bar', 'wellness_beverage', 'fast_casual', 'qsr'];
    if (impulseTypes.includes(conceptType)) boroughBonusAdj -= 3;
  } else if (report.lpc?.isHistoricDistrict) {
    flags.push('LANDMARK_DISTRICT: Historic district overlay detected. Verify LPC requirements for signage and exterior work.');
  }

  // TASK 14: BID zone detection
  if (geohash && BID_ZONES[geohash]) {
    const bid = BID_ZONES[geohash];
    flags.push('BID_ZONE: ' + bid.name + '. Enhanced services (cleaning, security, marketing). Assessment ~$' + bid.annualPerKSF + '/1,000 SF/year.');
    boroughBonusAdj += 2;
  }

  // TASK 15: Enhanced Commercial District (EC)
  if (geohash && EC_DISTRICTS[geohash]) {
    flags.push('ENHANCED_COMMERCIAL: Active retail corridor. Ground floor retail use mandated. 60% glass transparency required. Banks/financial uses restricted.');
    boroughBonusAdj += 3;
    // Coworking in EC may need ground floor retail
    if (conceptType === 'coworking') {
      flags.push('ZONING_NOTE: Coworking in EC district may require ground-floor retail component.');
    }
  }

  // TASK 09: Zoning conflict (if pluto has zoning data)
  const zoneDist = rawBgi?.pluto?.zoning_district || null;
  if (zoneDist) {
    const permitted = ZONING_PERMITTED[zoneDist];
    if (permitted && permitted[0] !== 'ALL' && permitted[0] !== 'SPECIAL_PERMIT_REQUIRED') {
      if (!permitted.includes(conceptType)) {
        flags.push('ZONING_CONFLICT: ' + conceptType + ' may not be permitted in ' + zoneDist + ' district. Verify with NYC ZoLa.');
      }
    } else if (permitted && permitted[0] === 'SPECIAL_PERMIT_REQUIRED') {
      flags.push('ZONING_SPECIAL_PERMIT: ' + zoneDist + ' district requires special permit for most commercial uses.');
    }
  }

  return { flags, boroughBonusAdj };
}

// === LEGACY SCORING (for backward compatibility) ===
function computeLocationIQ(report) {
  const W = { niq: 0.35, siq: 0.45, tiq: 0.15, liq: 0.05 };
  let pop = 50;
  if (report.census) {
    const c = report.census;
    pop = Math.round(
      scorePercentile(c.medianHouseholdIncome || 0, NYC_D.income) * 0.40 +
      scorePercentile(c.medianAge || 30, NYC_D.age, true) * 0.15 +
      scorePercentile(c.totalPopulation || 0, NYC_D.pop) * 0.25 +
      scorePercentile(c.bachelorsPlusPercent || 0, NYC_D.edu) * 0.20
    );
  }
  if (report.censusHousing) {
    if (report.censusHousing.rentBurdenedPct > 50) pop = Math.round(pop * 0.85);
    if (report.censusHousing.vacancyRate > 15) pop = Math.round(pop * 0.90);
    else if (report.censusHousing.vacancyRate < 5) pop = Math.round(pop * 1.05);
  }

  let lc = 50;
  if (report.dcaLicenses) {
    const nr = report.dcaLicenses.newBusinessRate;
    if (nr >= 10 && nr <= 25) lc = 80;
    else if (nr > 25) lc = 55;
    else lc = 35;
    lc += Math.min(15, (report.dcaLicenses.industryBreakdown?.length || 0) * 2);
  }

  let be = 50;
  if (report.dcaLicenses) be = report.dcaLicenses.ecosystemScore;
  if (report.sidewalkCafes?.activeCount > 3) be = Math.round(be * 1.08);
  if (report.liquorLicenses?.totalCount > 10) be = Math.round(be * 1.05);

  let di = 70;
  if (report.dob) {
    di = Math.max(20, 100 - report.dob.riskScore);
    if (report.dob.activeViolationCount > 5) di -= 10;
  }
  if (report.complaints311) {
    if (report.complaints311.qualityScore > 70) di = Math.round(di * 1.05);
    else if (report.complaints311.qualityScore < 40) di = Math.round(di * 0.90);
  }

  let tr = 50, hr = false;
  if (report.mtaRidership) { tr = report.mtaRidership.transitScore; hr = true; }
  if (report.pedestrian) {
    tr = hr ? Math.round(tr * 0.7 + report.pedestrian.footTrafficScore * 0.3) : report.pedestrian.footTrafficScore;
    hr = true;
  }
  if (report.walkScore) {
    const wt = Math.round((report.walkScore.walkScore || 50) * 0.5 + (report.walkScore.transitScore || 50) * 0.5);
    tr = hr ? Math.round(tr * 0.9 + wt * 0.1) : wt;
  }

  const niq = Math.round(clamp(pop) * 0.25 + clamp(lc) * 0.20 + clamp(be) * 0.30 + clamp(di) * 0.15 + clamp(tr) * 0.10);

  let w = report.walkScore?.walkScore || 50, co = 50;
  if (report.competitors) {
    const t = (report.competitors.rings?.ring1?.length || 0) + (report.competitors.rings?.ring2?.length || 0);
    if (t === 0) co = 30;
    else if (t <= 3) co = 55;
    else if (t <= 8) co = 75;
    else if (t <= 15) co = 85;
    else if (t <= 25) co = 70;
    else co = Math.max(40, 70 - (t - 25) * 3);
  }
  if (report.places?.avgRating > 0 && report.places.avgRating < 4.0) co = Math.round(co * 1.08);

  let br = 70;
  if (report.dob) br = Math.max(20, 100 - report.dob.riskScore);
  if (report.pluto?.developmentPotential > 60) br = Math.round(br * 1.05);

  let lm = 50;
  if (report.lpc) {
    if (report.lpc.isHistoricDistrict) lm = 80;
    else if ((report.lpc.nearbyLandmarks?.length || 0) > 3) lm = 75;
    else if ((report.lpc.nearbyLandmarks?.length || 0) > 0) lm = 60;
    else lm = 45;
  }

  const siq = Math.round(clamp(w) * 0.30 + clamp(co) * 0.30 + clamp(br) * 0.20 + clamp(lm) * 0.20);

  let cd = 50;
  if (report.inspections) {
    const cc = report.inspections.cuisineBreakdown ? Object.keys(report.inspections.cuisineBreakdown).length : 0;
    cd = scoreLinear(cc, 3, 30);
  }

  let qg = 50;
  if (report.places) {
    const a = report.places.avgRating || 0;
    if (a > 0 && a < 3.8) qg = 85;
    else if (a < 4.2) qg = 65;
    else qg = 40;
  }

  let mg = 50;
  if (report.marketDensity) {
    const u = report.marketDensity.categories.filter(c => c.count < 3).length;
    if (u > 3) mg = 80;
    else if (u > 0) mg = 60;
    else mg = 35;
  }

  const tiq = Math.round(clamp(cd) * 0.40 + clamp(qg) * 0.30 + clamp(mg) * 0.30);

  let l = 50;
  if (report.census) l = scoreLinear(report.census.totalPopulation || 0, 5000, 40000);
  if (report.mtaRidership) {
    const c = report.mtaRidership.totalDailyRidership > 10000 ? 70 : report.mtaRidership.totalDailyRidership > 3000 ? 60 : 40;
    l = Math.round(l * 0.6 + c * 0.4);
  }
  const liq = clamp(l);

  const iq = clamp(Math.round(Math.max(5, Math.min(98, clamp(niq) * W.niq + clamp(siq) * W.siq + clamp(tiq) * W.tiq + liq * W.liq))));

  const srcKeys = ['census', 'censusHousing', 'walkScore', 'inspections', 'crime', 'places', 'marketDensity', 'competitors', 'lpc', 'mtaRidership', 'dcaLicenses', 'dob', 'complaints311', 'pedestrian', 'pluto', 'sidewalkCafes', 'liquorLicenses', 'foursquare', 'momentum', 'yelp'];
  let avail = 0;
  const used = [];
  for (const k of srcKeys) if (report[k]) { avail++; used.push(k); }
  const conf = Math.round(avail / 19 * 100);

  return { niq: clamp(niq), siq: clamp(siq), tiq: clamp(tiq), liq, locationIQ: iq, confidence: conf, grade: grade(iq), used, available: avail };
}

function computeSixIndex(r) {
  let tr = 50, hr = false;
  if (r.mtaRidership) { tr = r.mtaRidership.transitScore; hr = true; }
  if (r.pedestrian) {
    tr = hr ? Math.round(tr * 0.7 + r.pedestrian.footTrafficScore * 0.3) : r.pedestrian.footTrafficScore;
    hr = true;
  }
  if (r.walkScore) {
    const wt = Math.round((r.walkScore.walkScore || 50) * 0.5 + (r.walkScore.transitScore || 50) * 0.5);
    tr = hr ? Math.round(tr * 0.50 + wt * 0.50) : wt; // FIX-T2: 50/50 blend
  }

  let de = 50;
  if (r.census) {
    de = Math.round(
      scorePercentile(r.census.medianHouseholdIncome || 0, NYC_D.income) * 0.35 +
      scorePercentile(r.census.totalPopulation || 0, NYC_D.pop) * 0.25 +
      scorePercentile(r.census.bachelorsPlusPercent || 0, NYC_D.edu) * 0.25 +
      scorePercentile(r.census.medianAge || 30, NYC_D.age, true) * 0.15
    );
  }
  if (r.censusHousing) {
    if (r.censusHousing.rentBurdenedPct > 50) de = Math.round(de * 0.85);
    if (r.censusHousing.vacancyRate > 15) de = Math.round(de * 0.90);
    else if (r.censusHousing.vacancyRate < 5) de = Math.round(de * 1.05);
  }

  let co = 50;
  if (r.competitors) {
    const t = (r.competitors.rings?.ring1?.length || 0) + (r.competitors.rings?.ring2?.length || 0);
    if (t === 0) co = 30;
    else if (t <= 3) co = 55;
    else if (t <= 8) co = 75;
    else if (t <= 15) co = 85;
    else if (t <= 25) co = 70;
    else co = Math.max(40, 70 - (t - 25) * 3);
  }
  if (r.marketDensity?.categories?.filter(c => c.chainPct > 60 && c.count > 3).length > 0) co = Math.round(co * 1.05);

  // AF-01 FIX: max-weighted formula (best * 0.5 + avg(rest) * 0.5) mirrors computeVibrancy().
  // Simple average was dragging vibrant areas down when sparse signals (sidewalk cafes, DCA)
  // diluted strong ones (nightlife density, market density). Sidewalk cafes boosted ×1.5 to
  // match the weighting in computeVibrancy — they're direct evidence of street activity.
  let vi = 50;
  const _viSigs = [];
  if (r.dcaLicenses) _viSigs.push(r.dcaLicenses.ecosystemScore);
  if (r.sidewalkCafes) _viSigs.push(r.sidewalkCafes.vibrancySignal * 1.5);
  if (r.liquorLicenses) _viSigs.push(r.liquorLicenses.vibrancySignal);
  if (r.liquorLicenses?.nightlifeDensity) _viSigs.push(r.liquorLicenses.nightlifeDensity * 1.2);
  if (r.foursquare?.vibrancySignal) _viSigs.push(r.foursquare.vibrancySignal);
  if (r.marketDensity) _viSigs.push(r.marketDensity.commercialVitality);
  if (_viSigs.length > 0) {
    _viSigs.sort((a, b) => b - a);
    const _viBest = Math.min(100, _viSigs[0]);
    const _viRest = _viSigs.length > 1 ? _viSigs.slice(1).reduce((s, v) => s + v, 0) / (_viSigs.length - 1) : _viBest;
    vi = clamp(Math.round(_viBest * 0.5 + _viRest * 0.5));
  }

  let sa = 70, sc = 0, ss = 0;
  if (r.crime) { ss += r.crime.crimeScore; sc++; }
  if (r.complaints311) { ss += r.complaints311.qualityScore; sc++; }
  if (r.dob) { ss += Math.max(10, 100 - r.dob.riskScore); sc++; }
  if (sc > 0) sa = Math.round(ss / sc);

  let mo = 50, mc = 0, ms = 0;
  if (r.dob) {
    let dm = 50;
    if (r.dob.newBuildingCount > 3) dm = 85;
    else if (r.dob.newBuildingCount > 0) dm = 65;
    else dm = 40;
    if (r.dob.permitCount > 10) dm = Math.min(95, dm + 10);
    ms += dm; mc++;
  }
  if (r.pluto) { ms += r.pluto.developmentPotential; mc++; }
  if (r.dcaLicenses) {
    const rt = r.dcaLicenses.newBusinessRate;
    let d = 50;
    if (rt >= 15 && rt <= 25) d = 80;
    else if (rt >= 10) d = 65;
    else if (rt < 5) d = 30;
    ms += d; mc++;
  }
  if (r.lpc && ((r.lpc.nearbyLandmarks?.length || 0) > 0 || r.lpc.isHistoricDistrict)) { ms += 65; mc++; }
  if (mc > 0) mo = Math.round(ms / mc);

  const raw = { transit: clamp(tr), demographics: clamp(de), competition: clamp(co), vibrancy: clamp(vi), safety: clamp(sa), momentum: clamp(mo) };
  const SIX_W = { transit: 0.25, demographics: 0.15, competition: 0.20, vibrancy: 0.30, safety: 0.05, momentum: 0.05 };
  raw.composite = clamp(Math.round(raw.transit * SIX_W.transit + raw.demographics * SIX_W.demographics + raw.competition * SIX_W.competition + raw.vibrancy * SIX_W.vibrancy + raw.safety * SIX_W.safety + raw.momentum * SIX_W.momentum));
  return raw;
}

function computeArchetypes(r) {
  let ri = 50;
  {
    let c = 0, s = 0;
    if (r.mtaRidership) { s += r.mtaRidership.transitScore; c++; }
    if (r.pedestrian) { s += r.pedestrian.footTrafficScore; c++; }
    if (r.walkScore) { s += (r.walkScore.walkScore || 50); c++; }
    if (r.census?.totalPopulation > 0) { s += scoreLinear(r.census.totalPopulation, 5000, 50000); c++; }
    if (c > 0) ri = Math.round(s / c);
  }

  let dp = 50;
  {
    let c = 0, s = 0;
    if (r.census) { s += scoreLinear(r.census.totalPopulation || 0, 2000, 30000); c++; }
    if (r.walkScore) { s += (r.walkScore.transitScore || 50); c++; }
    if (r.lpc && ((r.lpc.nearbyLandmarks?.length || 0) > 0 || r.lpc.isHistoricDistrict)) { s += 70; c++; }
    if (r.marketDensity) { s += r.marketDensity.commercialVitality || 50; c++; }
    if (c > 0) dp = Math.round(s / c);
  }

  let nf = 50;
  {
    let c = 0, s = 0;
    if (r.census) {
      s += scoreLinear(r.census.totalPopulation || 0, 3000, 40000);
      c++;
      s += scoreLinear(r.census.medianHouseholdIncome || 0, 30000, 100000);
      c++;
    }
    if (r.censusHousing) { s += scoreLinear(r.censusHousing.ownerOccupiedPct || 0, 10, 60); c++; }
    if (r.marketDensity) { s += scoreLinear(r.marketDensity.categories.filter(x => x.count < 3).length, 0, 5); c++; }
    if (c > 0) nf = Math.round(s / c);
  }

  return { routineInterceptor: clamp(ri), destinationPull: clamp(dp), needFiller: clamp(nf) };
}

// === DATA MAPPING ===
function mapCensus(d) { if (!d || !d.total_population) return null; const tp = d.total_population || 0; const bp = (d.bachelors_degree || 0) + (d.masters_degree || 0) + (d.doctorate_degree || 0); return { medianHouseholdIncome: d.median_household_income || 0, medianAge: d.median_age || 0, totalPopulation: tp, bachelorsPlusPercent: tp > 0 ? Math.round(bp / tp * 100) : 0 }; }

function mapHousing(d) { if (!d || !d.total_housing_units) return null; const t = d.total_housing_units || 1; const o = d.occupied_housing_units || 0; return { medianGrossRent: d.median_gross_rent || 0, rentBurdenedPct: d.median_rent_burden_pct || 0, vacancyRate: t > 0 ? Math.round((t - o) / t * 100) : 0, ownerOccupiedPct: o > 0 ? Math.round((d.owner_occupied || 0) / o * 100) : 0 }; }

function mapWS(d) { if (!d) return null; return { walkScore: d.walkscore || d.raw?.walkscore || 0, transitScore: d.transit_score || d.raw?.transit?.score || 0, bikeScore: d.bike_score || d.raw?.bike?.score || 0 }; }

function mapCrime(d) { if (!d) return null; if (d.by_category !== undefined || d.record_count !== undefined) { const t = d.record_count || 0; const bc = d.by_category || {}; return { crimeScore: clamp(Math.round(100 - Math.min(90, t / 500 * 90))), totalCount: t, violentCount: bc.FELONY || bc.felony || 0, propertyCount: bc.MISDEMEANOR || bc.misdemeanor || 0 }; } const t = d.total_crimes || 0; return { crimeScore: clamp(Math.round(100 - Math.min(90, t / 500 * 90))), totalCount: t, violentCount: d.felony || 0, propertyCount: d.misdemeanor || 0 }; }

function map311(d) { if (!d) return null; if (d.by_type !== undefined || d.record_count !== undefined) { const t = d.record_count || 0; const bt = d.by_type || {}; const noise = (bt['Noise'] || 0) + (bt['Noise - Commercial'] || 0) + (bt['Noise - Residential'] || 0) + (bt['Noise - Vehicle'] || 0) + (bt['Noise - Street/Sidewalk'] || 0); return { qualityScore: clamp(Math.round(100 - Math.min(90, t / 1000 * 90))), totalCount: t, noiseCount: noise, sanitationCount: bt['Rodent'] || 0 }; } const t = d.total_complaints || 0; return { qualityScore: clamp(Math.round(100 - Math.min(90, t / 1000 * 90))), totalCount: t, noiseCount: d.noise_complaints || 0, sanitationCount: d.rodent_complaints || 0 }; }

function mapPluto(d) { if (!d) return null; const bf = d.avg_built_far || 0; const mf = d.avg_max_far || 0; const dp = mf > 0 ? clamp(Math.round((mf - bf) / mf * 100)) : 50; return { developmentPotential: dp, lots: [], zoneProfile: { commercialPct: d.commercial_overlay_pct || 0 }, buildingProfile: { avgYearBuilt: d.avg_year_built || 0, totalRetailSqFt: 0, avgLotSize: d.total_lot_area_sqft || 0 } }; }

function mapDCA(d) { if (!d) return null; if (d.by_type !== undefined || d.record_count !== undefined) { const tc = d.record_count || 0; const bt = d.by_type || {}; return { ecosystemScore: clamp(scoreLinear(tc, 2, 25) /* FIX-T5: Manhattan block scale */), totalCount: tc, newBusinessRate: 15, industryBreakdown: Object.entries(bt).map(([k, v]) => ({ industry: k, count: v })), vibrancySignal: clamp(scoreLinear(tc, 2, 25) /* FIX-T5: Manhattan block scale */) }; } const tc = d.total_active_licenses || 0; const cats = d.business_category_mix || {}; return { ecosystemScore: clamp(scoreLinear(tc, 2, 25) /* FIX-T5: Manhattan block scale */), totalCount: tc, newBusinessRate: 15, industryBreakdown: Object.entries(cats).map(([k, v]) => ({ industry: k, count: v })), vibrancySignal: clamp(scoreLinear(tc, 2, 25) /* FIX-T5: Manhattan block scale */) }; }

function mapOSM(d) { if (!d) return null; const tp = d.total_pois || 0; const cats = d.category_distribution || {}; const cl = Object.entries(cats).map(([k, v]) => ({ name: k, count: v, chainPct: 0 })); return { comp: { rings: { ring1: Array(Math.min(Math.round(tp * 0.3), 20)).fill({ n: 1 }), ring2: Array(Math.min(Math.round(tp * 0.4), 20)).fill({ n: 1 }), ring3: [] }, saturationScore: clamp(scoreLinear(tp, 5, 100)), chainCount: 0, independentCount: tp }, market: { totalBusinesses: tp, categories: cl, commercialVitality: clamp(scoreLinear(tp, 10, 200)) } }; }

function mapLiquor(d) { if (!d) return null; const t = d.total_licenses || 0; const dist = d.license_type_distribution || {}; const op = Object.entries(dist).filter(([k]) => k.toLowerCase().includes('op') || k.toLowerCase().includes('on_premise') || k.toLowerCase().includes('on premise')).reduce((s, [, v]) => s + v, 0); return { totalCount: t, onPremiseCount: op, nightlifeDensity: clamp(scoreLinear(op, 2, 30)), vibrancySignal: clamp(scoreLinear(t, 5, 50)) }; }

function mapInsp(d) { if (!d) return null; if (d.grade_distribution !== undefined || (d.record_count !== undefined && d.restaurant_count === undefined)) { const gd = d.grade_distribution || {}; const total = d.record_count || 0; const aCount = gd['A'] || 0; const avgScore = total > 0 ? Math.round((aCount / total) * 100) : 50; return { totalNearby: total, avgScore: avgScore, cuisineBreakdown: {} }; } return { totalNearby: d.restaurant_count || d.total_inspection_records || 0, avgScore: d.avg_inspection_score || 0, cuisineBreakdown: {} }; }

function mapMTA(d) { if (!d) return null; const sc = d.station_count_within_400m || 0; const dr = d.estimated_daily_ridership || 0; return { stationCount: sc, totalDailyRidership: dr, transitScore: clamp(Math.round(scoreLinear(dr, 500, 40000) * 0.6 + scoreLinear(sc, 0, 5) * 0.4)) }; }

function mapDOB(d) { if (!d) return null; if (d.by_type !== undefined || d.record_count !== undefined) { const bt = d.by_type || {}; const total = d.record_count || 0; const nb = bt['NB'] || 0; const dm = bt['DM'] || 0; return { permitCount: total, newBuildingCount: nb, activeViolationCount: 0, riskScore: clamp(Math.round(Math.min(80, dm * 20 + (total > 20 ? 20 : 0)))) }; } return { permitCount: d.total_permits || 0, newBuildingCount: d.new_building || 0, activeViolationCount: 0, riskScore: clamp(Math.round(Math.min(80, (d.demolition || 0) * 20 + ((d.total_permits || 0) > 20 ? 20 : 0)))) }; }

function mapLPC(d) { if (!d) return null; if (d.by_type !== undefined || d.record_count !== undefined) { const bt = d.by_type || {}; const ind = bt['Individual Landmark'] || bt['INDIVIDUAL'] || 0; const hist = bt['Historic District'] || bt['HISTORIC DISTRICT'] || bt['HDIST'] || 0; const lc = Math.max(0, d.record_count || (ind + hist)); return { nearbyLandmarks: Array(lc).fill({ t: 1 }), isHistoricDistrict: hist > 0 }; } const ind = d.individual_landmarks || 0; const dist = d.district_landmarks || 0; const lc = Math.max(0, d.landmark_count || (ind + dist)); return { nearbyLandmarks: Array(lc).fill({ t: 1 }), isHistoricDistrict: dist > 0 }; }

function mapCafe(d) { if (!d) return null; if (d.record_count !== undefined && d.cafe_count === undefined) { const c = d.record_count || 0; return { activeCount: c, totalCount: c, totalSeatingCapacity: c * 20, vibrancySignal: clamp(scoreLinear(c, 1, 15)) }; } const c = d.cafe_count || 0; const s = d.total_seating_capacity || 0; return { activeCount: c, totalCount: c, totalSeatingCapacity: s, vibrancySignal: clamp(scoreLinear(c, 1, 15) * 0.5 + scoreLinear(s, 10, 200) * 0.5) }; }

function mapPed(d) { if (!d) return null; const avg = d.avg_pedestrian_count || 0; return { totalPedestrians: d.total_readings || avg, countLocationCount: d.sensor_segments || 0, footTrafficScore: clamp(scoreLinear(avg, 100, 10000)) }; }

function mapGooglePlaces(d) { if (!d || !d.total_results) return null; const tr = d.total_results || 0; const ar = d.avg_rating || 0; const rc = d.rating_count || 0; const types = d.type_distribution || {}; const foodTypes = ['restaurant', 'cafe', 'bakery', 'bar', 'meal_delivery', 'meal_takeaway', 'food']; const foodCount = foodTypes.reduce((s, t) => s + (types[t] || 0), 0); const nonFood = tr - foodCount; const cats = Object.entries(types).map(([k, v]) => ({ name: k, count: v, chainPct: 0 })); const cuisines = {}; for (const c of (d.top_categories || [])) { if (c.type && !['point_of_interest', 'establishment', 'political', 'locality', 'sublocality', 'sublocality_level_1'].includes(c.type)) cuisines[c.type] = c.count; } return { competitors: { rings: { ring1: Array(Math.max(0, Math.min(foodCount, 20))).fill({ n: 1 }), ring2: Array(Math.max(0, Math.min(Math.round(Math.max(0, nonFood) * 0.3), 20))).fill({ n: 1 }), ring3: [] }, saturationScore: clamp(scoreLinear(tr, 5, 100)), chainCount: 0, independentCount: tr }, places: { avgRating: ar, totalCount: rc, ratingCount: rc }, marketDensity: { totalBusinesses: tr, categories: cats, commercialVitality: clamp(scoreLinear(tr, 5, 100)) }, inspections: { totalNearby: foodCount, avgScore: ar > 0 ? Math.round(ar * 20) : 0, cuisineBreakdown: cuisines } }; }

function mapFoursquare(d) { if (!d || !d.total_venues) return null; const tv = d.total_venues || 0; const cc = d.chain_count || 0; const ic = d.independent_count || 0; const cats = d.category_distribution || {}; const cl = Object.entries(cats).map(([k, v]) => ({ name: k, count: v, chainPct: tv > 0 ? Math.round(cc / tv * 100) : 0 })); return { competitors: { rings: { ring1: Array(Math.max(0, Math.min(Math.round(tv * 0.4), 20))).fill({ n: 1 }), ring2: Array(Math.max(0, Math.min(Math.round(tv * 0.3), 20))).fill({ n: 1 }), ring3: [] }, saturationScore: clamp(scoreLinear(tv, 3, 80)), chainCount: cc, independentCount: ic }, marketDensity: { totalBusinesses: tv, categories: cl, commercialVitality: clamp(scoreLinear(tv, 5, 150)) }, foursquare: { venueCount: tv, chainCount: cc, independentCount: ic, vibrancySignal: clamp(scoreLinear(tv, 5, 100)) } }; }

function mapYelp(d) { if (!d || !d.total_businesses) return null; const tb = d.total_businesses || 0; const ar = d.avg_rating || 0; const tr = d.total_reviews || 0; const cats = d.top_categories || []; const cuisines = {}; for (const c of cats) if (c.title) cuisines[c.title] = c.count || 0; const priceDist = d.price_level_distribution || {}; const affordable = (priceDist['$'] || 0) + (priceDist['$$'] || 0); const upscale = (priceDist['$$$'] || 0) + (priceDist['$$$$'] || 0); return { places: { avgRating: ar, totalCount: tb, ratingCount: d.rating_count || tb, totalReviews: tr }, inspections: { totalNearby: tb, avgScore: ar > 0 ? Math.round(ar * 20) : 0, cuisineBreakdown: cuisines }, marketDensity: { totalBusinesses: tb, categories: cats.map(c => ({ name: c.title, count: c.count || 0, chainPct: 0 })), commercialVitality: clamp(scoreLinear(tb, 10, 200)) }, vibrancySignal: clamp(scoreLinear(tb, 5, 100)), priceProfile: { affordable, upscale, qualityGapSignal: ar > 0 && ar < 3.8 ? 80 : ar < 4.2 ? 60 : 40 } }; }

function assembleReport(bgi, ee, mtaGeo) {
  const census = mapCensus(bgi?.census_demographics);
  const censusHousing = mapHousing(bgi?.census_housing);
  const walkScore = mapWS(bgi?.walkscore);
  const crime = mapCrime(bgi?.nypd_crime || ee?.nypd_crime);
  const complaints311 = map311(bgi?.['311_complaints'] || ee?.['311_complaints']);
  const pluto = mapPluto(bgi?.pluto_zoning || ee?.pluto_zoning);
  const dcaLicenses = mapDCA(bgi?.dca_licenses || ee?.dca_licenses);
  const osm = mapOSM(bgi?.osm_pois || ee?.osm_pois);
  const liquorLicenses = mapLiquor(bgi?.liquor_licenses || ee?.liquor_licenses);
  const inspRaw = mapInsp(bgi?.dohmh_inspections || ee?.dohmh_inspections);
  const dob = mapDOB(bgi?.dob_permits || ee?.dob_permits);
  const lpc = mapLPC(bgi?.lpc_landmarks || ee?.lpc_landmarks);
  const sidewalkCafes = mapCafe(bgi?.sidewalk_cafes || ee?.sidewalk_cafes);
  const pedestrian = mapPed(bgi?.pedestrian_counts || ee?.pedestrian_counts);
  const gp = mapGooglePlaces(bgi?.google_places);
  const fsq = mapFoursquare(bgi?.foursquare);
  const yp = mapYelp(bgi?.yelp);
  const mtaRidership = mtaGeo
    ? { stationCount: mtaGeo.stationCount, totalDailyRidership: mtaGeo.totalDailyRidership, transitScore: mtaGeo.transitScore }
    : mapMTA(ee?.mta_ridership);
  const competitors = gp?.competitors || fsq?.competitors || osm?.comp || null;
  const places = yp?.places || gp?.places || null;
  const mdSources = [gp?.marketDensity, fsq?.marketDensity, yp?.marketDensity, osm?.market].filter(Boolean);
  let marketDensity = null;
  if (mdSources.length) { marketDensity = mdSources.reduce((best, m) => (!best || (m.commercialVitality || 0) > (best.commercialVitality || 0)) ? m : best, null); }
  const inspections = yp?.inspections || gp?.inspections || inspRaw || null;
  const foursquare = fsq?.foursquare || null;
  return { census, censusHousing, walkScore, crime, complaints311, pluto, dcaLicenses, competitors, marketDensity, liquorLicenses, inspections, mtaRidership, dob, lpc, sidewalkCafes, pedestrian, foursquare, yelp: yp || null, places, momentum: null, errors: [] };
}

// === MTA Spatial Scoring ===
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildMtaMap(bgMap, stations, busStops) {
  const mtaMap = new Map();
  for (const [geoid, meta] of bgMap) {
    if (!meta.lat || !meta.lng) { mtaMap.set(geoid, null); continue; }
    const lat = meta.lat, lng = meta.lng;
    let stationCount = 0, totalRidership = 0, nearestM = 9999, routeSet = new Set();
    for (const st of stations) {
      const d = haversineM(lat, lng, st.lat, st.lng);
      if (d <= 400) { stationCount++; totalRidership += st.estimated_daily_ridership || 0; if (d < nearestM) nearestM = d; if (st.routes) st.routes.split(/[,\s]+/).forEach(r => r && routeSet.add(r)); }
    }
    let busCount = 0;
    for (const b of busStops) { const d = haversineM(lat, lng, b.lat, b.lng); if (d <= 250) busCount++; }
    const subwayScore = stationCount > 0 ? clamp(scoreLinear(nearestM, 400, 0) * 0.5 + scoreLinear(stationCount, 0, 3) * 0.5) : 0;
    const ridershipScore = clamp(scoreLinear(totalRidership, 500, 40000)); // FIX-T3: realistic NYC range
    const busScore = clamp(scoreLinear(busCount, 0, 10));
    const transitScore = stationCount > 0 ? clamp(Math.round(subwayScore * 0.60 + ridershipScore * 0.30 + busScore * 0.10)) : clamp(Math.round(busScore * 0.40));
    mtaMap.set(geoid, { stationCount, totalDailyRidership: totalRidership, nearestStationM: Math.round(nearestM), routeCount: routeSet.size, busCount, transitScore });
  }
  return mtaMap;
}

// === Data Loading ===
async function paginate(table, select, filter, pageSize = 1000, orderCols = null) {
  const rows = [];
  let off = 0;
  while (true) {
    let q = supabase.from(table).select(select);
    if (orderCols) { // FIX-T4: stable ORDER BY prevents row skipping on page boundaries
      const cols = Array.isArray(orderCols) ? orderCols : [orderCols];
      for (const col of cols) q = q.order(col);
    }
    q = q.range(off, off + pageSize - 1).limit(pageSize);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) { console.error(`[Page] ${table} err:`, error.message); break; }
    if (!data || !data.length) break;
    rows.push(...data);
    off += data.length;
    if (data.length < pageSize) break;
  }
  return rows;
}

async function loadAll() {
  console.log('[Load] block_groups...');
  const bgMap = new Map();
  const bgRows = await paginate('block_groups', 'geoid,borough,centroid_lat,centroid_lng');
  for (const r of bgRows) bgMap.set(r.geoid, { borough: r.borough, lat: r.centroid_lat, lng: r.centroid_lng });
  console.log(`  ${bgMap.size} block groups`);

  console.log('[Load] block_group_intel...');
  const bgiMap = new Map();
  const bgiRows = await paginate('block_group_intel', 'geoid,source,data', null, 1000, ['geoid','source']);
  for (const r of bgiRows) { if (!bgiMap.has(r.geoid)) bgiMap.set(r.geoid, {}); bgiMap.get(r.geoid)[r.source] = r.data; }
  console.log(`  ${bgiMap.size} geoids (${bgiRows.length} rows)`);

  console.log('[Load] enriched_entities...');
  const eeMap = new Map();
  const eeRows = await paginate('enriched_entities', 'location_key,entity_category,entity_data', q => q.eq('entity_type', 'block_group_intel'));
  for (const r of eeRows) { if (!eeMap.has(r.location_key)) eeMap.set(r.location_key, {}); eeMap.get(r.location_key)[r.entity_category] = r.entity_data; }
  console.log(`  ${eeMap.size} geoids (${eeRows.length} rows)`);

  console.log('[Load] nyc_mta_stations + nyc_bus_stops...');
  const stationRows = await paginate('nyc_mta_stations', 'lat,lng,estimated_daily_ridership,routes,route_count');
  const busRows = await paginate('nyc_bus_stops', 'lat,lng');
  console.log(`  ${stationRows.length} subway stations, ${busRows.length} bus stops`);
  const mtaMap = buildMtaMap(bgMap, stationRows, busRows);
  const mtaCovered = [...mtaMap.values()].filter(v => v && v.stationCount > 0).length;
  console.log(`  ${mtaCovered} block groups have subway within 400m`);

  return { bgMap, bgiMap, eeMap, mtaMap };
}

// === MAIN ===
async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  RE² Scoring v4 — Three-Score Architecture');
  console.log(`  Batch: ${BATCH_ID}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════\n');

  const { bgMap, bgiMap, eeMap, mtaMap } = await loadAll();
  // --borough filter: node score-all-v4.mjs --borough Manhattan
  const boroughArg = (() => {
    const idx = process.argv.indexOf('--borough');
    return idx !== -1 ? process.argv[idx + 1] : null;
  })();
  const allGeoids = boroughArg
    ? [...bgMap.entries()].filter(([, bg]) => bg.borough === boroughArg).map(([g]) => g)
    : [...bgMap.keys()];

  if (boroughArg) console.log(`\n[Run] Borough filter: ${boroughArg} — ${allGeoids.length} block groups\n`);
  else console.log(`\n[Run] ${allGeoids.length} block groups (all boroughs)\n`);

  const S = {
    total: allGeoids.length,
    scored: 0,
    failed: 0,
    events: 0,
    iq: [], fit: [], lin: [],
    results: [],
    boroughs: {},
  };

  // First pass: score all block groups for ALL concept types
  // allScores keyed by concept → array of per-block-group results
  const allScoresByConcept = {};
  for (const ct of ALL_CONCEPTS) allScoresByConcept[ct] = [];

  // Legacy scores (concept-independent) — one per block group
  const legacyScores = [];
  const BATCH = 100;

  console.log(`[Score] Scoring ${allGeoids.length} block groups × ${ALL_CONCEPTS.length} concepts (${ALL_CONCEPTS.join(', ')})...\n`);

  for (let i = 0; i < allGeoids.length; i += BATCH) {
    const batch = allGeoids.slice(i, i + BATCH);

    for (const geoid of batch) {
      const t0 = Date.now();
      try {
        const meta = bgMap.get(geoid);
        const report = assembleReport(bgiMap.get(geoid), eeMap.get(geoid), mtaMap.get(geoid));
        const iq = computeLocationIQ(report);
        const six = computeSixIndex(report);
        const arch = computeArchetypes(report);

        // Score for each concept type
        for (const conceptType of ALL_CONCEPTS) {
          const c2h = scoreCycle2(report, meta.borough, conceptType, bgiMap.get(geoid));

          // V4: Compute age fit and Vision IQ for this concept
          const medianAge = report.census?.medianAge || 0;
          const cc = CONCEPT_CONFIG[conceptType] || DEFAULT_CONCEPT;
          const ageFit = computeAgeFit(medianAge, cc);

          // VIQ-02/03: Tax adjustments from DOF property-tax data (null in batch context,
          // populated for live per-address scoring via LocationIntelReport.propertyTax)
          let viqTaxAdj = 0;
          const pt = report.propertyTax;
          if (pt) {
            // VIQ-02: escalation risk penalty — every 1% above 4% costs ~2 VIQ pts (cap -20)
            if (typeof pt.escalationAnnual === 'number' && pt.escalationAnnual > 0.04) {
              viqTaxAdj += Math.max(-20, -Math.round((pt.escalationAnnual - 0.04) * 200));
            }
            // VIQ-03: outstanding tax lien — hard -20 pt kill signal
            if (pt.hasTaxLien) viqTaxAdj -= 20;
          }

          const visionIQ = computeVisionIQScore(c2h.competition, c2h.priceIncomeFit, ageFit, viqTaxAdj);

          // V4.1: Compute concept-specific Location IQ v2.
          // Uses this concept's own competition/marketProof sub-scores so that
          // a spa at a geoid gets a different Location IQ than a coffee shop.
          const conceptLocIQv2 = computeLocationIQv2(
            c2h.marketProof,
            c2h.accessibility,
            c2h.vibrancy,
            c2h.demographics,
            c2h.safety,
            c2h.momentum,
            c2h.boroughBonus
          );

          // COFFEE-REWIRE: For specialty_coffee, compute 6-dim model and use as Location IQ
          let coffeeSixDim = null;
          let finalConceptLocIQv2 = conceptLocIQv2;
          if (conceptType === 'specialty_coffee') {
            coffeeSixDim = scoreCoffeeSixDim(report, c2h);
            finalConceptLocIQv2 = coffeeSixDim.locationIQ; // Override with 6-dim composite
          }

          allScoresByConcept[conceptType].push({
            geoid,
            borough: meta.borough,
            fitScore: c2h.fitScore,
            linearScore: c2h.linearScore,
            c2h,
            conceptType,
            ageFit,
            visionIQ,
            conceptLocIQv2: finalConceptLocIQv2,
            coffeeSixDim,  // null for non-coffee concepts
          });
        }

        // V4: Compute Location IQ v2 (concept-independent, once per BG)
        // Use default concept's c2h for the concept-independent sub-scores
        const defaultC2hForLoc = scoreCycle2(report, meta.borough, DEFAULT_CONCEPT_KEY, bgiMap.get(geoid));
        const locationIQv2 = computeLocationIQv2(
          defaultC2hForLoc.marketProof,
          defaultC2hForLoc.accessibility,
          defaultC2hForLoc.vibrancy,
          defaultC2hForLoc.demographics,
          defaultC2hForLoc.safety,
          defaultC2hForLoc.momentum,
          defaultC2hForLoc.boroughBonus
        );

        // Legacy scores (concept-independent, written once per block group)
        legacyScores.push({
          geoid,
          borough: meta.borough,
          iq: iq.locationIQ,
          six,
          arch,
          // V4 additions
          locationIQv2,
          safety: defaultC2hForLoc.safety,
          momentum: defaultC2hForLoc.momentum,
          marketProof: defaultC2hForLoc.marketProof,
          accessibility: defaultC2hForLoc.accessibility,
          vibrancy: defaultC2hForLoc.vibrancy,
          demographics: defaultC2hForLoc.demographics,
          boroughBonus: defaultC2hForLoc.boroughBonus,
        });

        const ms = Date.now() - t0;
        S.scored++;
        S.iq.push(iq.locationIQ);
        // Track stats for default concept
        const defaultC2h = allScoresByConcept[DEFAULT_CONCEPT_KEY].at(-1);
        S.fit.push(defaultC2h.fitScore);
        S.lin.push(defaultC2h.linearScore);
        const b = meta?.borough || 'Unknown';
        if (!S.boroughs[b]) S.boroughs[b] = { n: 0, fitSum: 0, linSum: 0, fitMin: 100, fitMax: 0, linMin: 100, linMax: 0 };
        S.boroughs[b].n++;
        S.boroughs[b].fitSum += defaultC2h.fitScore;
        S.boroughs[b].linSum += defaultC2h.linearScore;
        S.boroughs[b].fitMin = Math.min(S.boroughs[b].fitMin, defaultC2h.fitScore);
        S.boroughs[b].fitMax = Math.max(S.boroughs[b].fitMax, defaultC2h.fitScore);
        S.boroughs[b].linMin = Math.min(S.boroughs[b].linMin, defaultC2h.linearScore);
        S.boroughs[b].linMax = Math.max(S.boroughs[b].linMax, defaultC2h.linearScore);
      } catch (err) {
        S.failed++;
        if (S.failed <= 5) console.error(`[Err] ${geoid}: ${err.message}`);
      }
    }

    const pct = Math.round((i + batch.length) / allGeoids.length * 100);
    process.stdout.write(`\r[${pct}%] ${i + batch.length}/${allGeoids.length} — scored:${S.scored} failed:${S.failed}`);
  }

  console.log('\n');

  // SECOND PASS: Z-normalization per borough — ALL concepts pooled together
  // This ensures concept-specific differences survive normalization.
  // A block group that's great for coffee but bad for restaurants will show
  // different scores because they're normalized against the same distribution.
  console.log('[Norm] Computing z-scores per borough (all concepts pooled)...\n');

  // Collect all scores across all concepts for each borough
  const boroughNames = [...new Set(legacyScores.map(s => s.borough))];

  for (const b of boroughNames) {
    // Pool ALL concept scores for this borough into one array for normalization
    const allFitScores = [];
    const allLinScores = [];
    for (const conceptType of ALL_CONCEPTS) {
      const bScores = allScoresByConcept[conceptType].filter(s => s.borough === b);
      for (const s of bScores) {
        allFitScores.push(s.fitScore);
        allLinScores.push(s.linearScore);
      }
    }

    if (allFitScores.length < 10) continue;

    // Compute pooled mean/SD across all concepts in this borough
    const fitMean = allFitScores.reduce((s, v) => s + v, 0) / allFitScores.length;
    const fitSD = Math.sqrt(allFitScores.reduce((s, v) => s + (v - fitMean) ** 2, 0) / allFitScores.length);
    const linMean = allLinScores.reduce((s, v) => s + v, 0) / allLinScores.length;
    const linSD = Math.sqrt(allLinScores.reduce((s, v) => s + (v - linMean) ** 2, 0) / allLinScores.length);

    // Apply pooled z-norm to each concept's scores
    for (const conceptType of ALL_CONCEPTS) {
      const bScores = allScoresByConcept[conceptType].filter(s => s.borough === b);
      for (const s of bScores) {
        s.fitScoreNorm = fitSD >= 1 ? clamp(Math.round(50 + (s.fitScore - fitMean) / fitSD * 12)) : s.fitScore;
        s.linScoreNorm = linSD >= 1 ? clamp(Math.round(50 + (s.linearScore - linMean) / linSD * 12)) : s.linearScore;
      }
    }

    const nPerConcept = allFitScores.length / ALL_CONCEPTS.length;
    console.log(`  [${b}] ${Math.round(nPerConcept)} BGs × ${ALL_CONCEPTS.length} concepts pooled — fitSD=${fitSD.toFixed(1)} linSD=${linSD.toFixed(1)}`);
  }

  // THIRD PASS: Ensemble blend and write to DB — concept-specific rows
  console.log('[Write] Ensemble blend and bulk insert (concept-specific + legacy)...\n');
  let totalRows = 0;
  const now = new Date().toISOString();

  // 3A: Write concept-specific fit scores
  for (const conceptType of ALL_CONCEPTS) {
    const conceptScores = allScoresByConcept[conceptType];
    const isDefault = conceptType === DEFAULT_CONCEPT_KEY;
    const suffix = isDefault ? '' : `:${conceptType}`;

    console.log(`  [${conceptType}] Writing ${conceptScores.length} block groups (suffix: "${suffix || '(none)'}")...`);

    for (let i = 0; i < conceptScores.length; i += 100) {
      const batch = conceptScores.slice(i, i + 100);
      const scoreRows = [];

      for (const s of batch) {
        const raw = s.fitScoreNorm * BLEND_ALPHA + s.linScoreNorm * (1 - BLEND_ALPHA);
        const dev = raw - 50;
        const sign = dev >= 0 ? 1 : -1;
        const finalScore = clamp(Math.round(50 + sign * Math.pow(Math.abs(dev), BLEND_POW) * (12 / Math.pow(12, BLEND_POW))));

        const c2h = s.c2h;

        // Main fit_score entry (suffixed by concept type)
        const fitComponents = {
            fitScore: finalScore,
            linearScore: s.linScoreNorm,
            accessibility: c2h.accessibility,
            demographics: c2h.demographics,
            competition: c2h.competition,
            marketProof: c2h.marketProof,
            vibrancy: c2h.vibrancy,
            priceIncomeFit: c2h.priceIncomeFit,
            boroughBonus: c2h.boroughBonus,
            conceptType,
        };
        // COFFEE-REWIRE: Attach 6-dim breakdown to fit_score components
        if (s.coffeeSixDim) {
          fitComponents.coffeeDimensions = {
            morningFootTraffic: s.coffeeSixDim.morningFootTraffic,
            dailyRitualDensity: s.coffeeSixDim.dailyRitualDensity,
            competitionContext: s.coffeeSixDim.competitionContext,
            streetSide: s.coffeeSixDim.streetSide,
            demographicsFit: s.coffeeSixDim.demographicsFit,
            baseViability: s.coffeeSixDim.baseViability,
          };
          fitComponents.coffeeLocationIQ = s.coffeeSixDim.locationIQ;
          fitComponents.formulaVersion = 'coffee-v2.0';
        }
        scoreRows.push({
          geoid: s.geoid,
          score_type: `fit_score${suffix}`,
          score: finalScore,
          components: fitComponents,
          data_sources_used: [],
          scored_at: now,
        });

        // Sub-scores (suffixed)
        scoreRows.push({
          geoid: s.geoid,
          score_type: `fit_sub_market_proof${suffix}`,
          score: c2h.marketProof,
          components: {},
          data_sources_used: [],
          scored_at: now,
        });

        scoreRows.push({
          geoid: s.geoid,
          score_type: `fit_sub_accessibility${suffix}`,
          score: c2h.accessibility,
          components: {},
          data_sources_used: [],
          scored_at: now,
        });

        scoreRows.push({
          geoid: s.geoid,
          score_type: `fit_sub_vibrancy${suffix}`,
          score: c2h.vibrancy,
          components: {},
          data_sources_used: [],
          scored_at: now,
        });

        // Dedicated rows for demographics, competition, price_income_fit (snake_case keys).
        // These were previously only in fit_score.components as camelCase, causing block-group.ts
        // to read 0 for price_income_fit (key mismatch) and skip dedicated-row lookups for the others.
        scoreRows.push({
          geoid: s.geoid,
          score_type: `fit_sub_demographics${suffix}`,
          score: c2h.demographics,
          components: {},
          data_sources_used: [],
          scored_at: now,
        });

        scoreRows.push({
          geoid: s.geoid,
          score_type: `fit_sub_competition${suffix}`,
          score: c2h.competition,
          components: {},
          data_sources_used: [],
          scored_at: now,
        });

        scoreRows.push({
          geoid: s.geoid,
          score_type: `fit_sub_price_income_fit${suffix}`,
          score: c2h.priceIncomeFit,
          components: {},
          data_sources_used: [],
          scored_at: now,
        });

        // V4: Vision IQ row (concept-specific)
        scoreRows.push({
          geoid: s.geoid,
          score_type: `vision_iq${suffix}`,
          score: s.visionIQ,
          components: {
            visionIQ: s.visionIQ,
            competition: c2h.competition,
            priceIncomeFit: c2h.priceIncomeFit,
            ageFit: s.ageFit,
            ageFitNorm: clamp(Math.round(50 + s.ageFit * 3.5)),
            conceptType,
          },
          data_sources_used: [],
          scored_at: now,
        });

        // V4.1: Concept-specific Location IQ v2 — uses this concept's own
        // competition/marketProof so that a spa gets a different Location IQ
        // than a coffee shop at the same block group. Read at query time via
        // getBlockGroupScores() which prefers location_iq_v2:{concept} over
        // the concept-independent location_iq_v2.
        scoreRows.push({
          geoid: s.geoid,
          score_type: `location_iq_v2${suffix}`,
          score: s.conceptLocIQv2,
          components: {
            locationIQ: s.conceptLocIQv2,
            marketProof: c2h.marketProof,
            accessibility: c2h.accessibility,
            vibrancy: c2h.vibrancy,
            demographics: c2h.demographics,
            safety: c2h.safety,
            momentum: c2h.momentum,
            boroughBonus: c2h.boroughBonus,
            competition: c2h.competition,
            grade: grade(s.conceptLocIQv2),
            conceptType,
          },
          data_sources_used: [],
          scored_at: now,
        });

        // COFFEE-REWIRE: Write 6-dimension breakdown for specialty_coffee
        if (s.coffeeSixDim) {
          const cd = s.coffeeSixDim;
          // Dedicated coffee_dimensions row — stores full 6-dim breakdown
          scoreRows.push({
            geoid: s.geoid,
            score_type: `coffee_dimensions${suffix}`,
            score: cd.locationIQ,
            components: {
              morningFootTraffic: cd.morningFootTraffic,
              dailyRitualDensity: cd.dailyRitualDensity,
              competitionContext: cd.competitionContext,
              streetSide: cd.streetSide,
              demographicsFit: cd.demographicsFit,
              baseViability: cd.baseViability,
              rawComposite: cd.rawComposite,
              visionMultiplier: 1.0,
              formulaVersion: 'coffee-v2.0',
              conceptType,
            },
            data_sources_used: [],
            scored_at: now,
          });

          // Individual dimension sub-scores for granular queries
          const dimEntries = [
            ['morning_foot_traffic', cd.morningFootTraffic, 0.30],
            ['daily_ritual_density', cd.dailyRitualDensity, 0.25],
            ['competition_context', cd.competitionContext, 0.15],
            ['street_side', cd.streetSide, 0.10],
            ['demographics_fit', cd.demographicsFit, 0.10],
            ['base_viability', cd.baseViability, 0.10],
          ];
          for (const [dimKey, dimScore, dimWeight] of dimEntries) {
            scoreRows.push({
              geoid: s.geoid,
              score_type: `coffee_dim_${dimKey}${suffix}`,
              score: dimScore,
              components: { weight: dimWeight, conceptType },
              data_sources_used: [],
              scored_at: now,
            });
          }
        }
      }

      // Bulk write
      for (let j = 0; j < scoreRows.length; j += 500) {
        const b = scoreRows.slice(j, j + 500);
        const { error } = await supabase.from('block_group_scores').upsert(b, { onConflict: 'geoid,score_type' });
        if (error) console.error(`[BGS err] ${conceptType} batch ${i}+${j}:`, error.message);
        else totalRows += b.length;
      }
    }
    const coffeeExtra = conceptType === 'specialty_coffee' ? ' + coffee 6-dim breakdown' : '';
    console.log(`  [${conceptType}] Done — ${totalRows} cumulative rows${coffeeExtra}`);
  }

  // 3B: Write legacy + V4 location scores (concept-independent, once per block group)
  console.log(`\n  [legacy+v4] Writing ${legacyScores.length} block groups (location_iq + location_iq_v2 + six_index + subs)...`);

  for (let i = 0; i < legacyScores.length; i += 100) {
    const batch = legacyScores.slice(i, i + 100);
    const scoreRows = [];

    for (const s of batch) {
      // Legacy location_iq (unchanged)
      scoreRows.push({
        geoid: s.geoid,
        score_type: 'location_iq',
        score: s.iq,
        components: { niq: 0, siq: 0, tiq: 0, liq: 0, grade: grade(s.iq) },
        data_sources_used: [],
        scored_at: now,
      });

      // V4: Location IQ v2 (concept-independent, B2B product)
      scoreRows.push({
        geoid: s.geoid,
        score_type: 'location_iq_v2',
        score: s.locationIQv2,
        components: {
          locationIQ: s.locationIQv2,
          marketProof: s.marketProof,
          accessibility: s.accessibility,
          vibrancy: s.vibrancy,
          demographics: s.demographics,
          safety: s.safety,
          momentum: s.momentum,
          boroughBonus: s.boroughBonus,
          grade: grade(s.locationIQv2),
        },
        data_sources_used: [],
        scored_at: now,
      });

      // V4: Dedicated safety and momentum sub-score rows
      scoreRows.push({
        geoid: s.geoid,
        score_type: 'location_sub_safety',
        score: s.safety,
        components: {},
        data_sources_used: [],
        scored_at: now,
      });

      scoreRows.push({
        geoid: s.geoid,
        score_type: 'location_sub_momentum',
        score: s.momentum,
        components: {},
        data_sources_used: [],
        scored_at: now,
      });

      // Legacy six_index rows (unchanged)
      scoreRows.push({ geoid: s.geoid, score_type: 'six_transit', score: s.six.transit, components: {}, data_sources_used: [], scored_at: now });
      scoreRows.push({ geoid: s.geoid, score_type: 'six_demographics', score: s.six.demographics, components: {}, data_sources_used: [], scored_at: now });
      scoreRows.push({ geoid: s.geoid, score_type: 'six_competition', score: s.six.competition, components: {}, data_sources_used: [], scored_at: now });
      scoreRows.push({ geoid: s.geoid, score_type: 'six_vibrancy', score: s.six.vibrancy, components: {}, data_sources_used: [], scored_at: now });
      scoreRows.push({ geoid: s.geoid, score_type: 'six_safety', score: s.six.safety, components: {}, data_sources_used: [], scored_at: now });
      scoreRows.push({ geoid: s.geoid, score_type: 'six_momentum', score: s.six.momentum, components: {}, data_sources_used: [], scored_at: now });
    }

    for (let j = 0; j < scoreRows.length; j += 500) {
      const b = scoreRows.slice(j, j + 500);
      const { error } = await supabase.from('block_group_scores').upsert(b, { onConflict: 'geoid,score_type' });
      if (error) console.error(`[BGS err] legacy batch ${i}+${j}:`, error.message);
      else totalRows += b.length;
    }
  }
  console.log(`  [legacy+v4] Done — ${legacyScores.length * 10} rows`);

  console.log(`\n[TOTAL] ${totalRows} rows written across ${ALL_CONCEPTS.length} concepts + legacy`);

  console.log('\n');
  printReport(S);
  return S;
}

function ds(arr, label) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  const sum = s.reduce((a, b) => a + b, 0);
  const p = x => s[Math.floor(n * x / 100)] || 0;
  return {
    label, n, min: s[0], max: s[n - 1], mean: Math.round(sum / n * 10) / 10,
    med: p(50), p10: p(10), p25: p(25), p75: p(75), p90: p(90),
    sd: Math.round(Math.sqrt(s.reduce((x, v) => x + (v - sum / n) ** 2, 0) / n) * 10) / 10,
  };
}

function printReport(S) {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        DISTRIBUTION STATS — ALL BLOCK GROUPS (Cycle 2H Calibrated)           ║');
  console.log('╠═══════════════════╦══════╦═════╦═════╦══════╦═════╦════╦════╦════╦════╦═══════╣');
  console.log('║ Score             ║   N  ║ Min ║ Max ║ Mean ║ Med ║P10 ║P25 ║P75 ║P90 ║StdDev║');
  console.log('╠═══════════════════╬══════╬═════╬═════╬══════╬═════╬════╬════╬════╬════╬═══════╣');
  for (const r of [ds(S.iq, 'Location IQ'), ds(S.fit, 'Fit Score'), ds(S.lin, 'Linear Score')].filter(Boolean)) {
    const p = (v, w) => String(v).padStart(w);
    console.log(`║ ${r.label.padEnd(17)} ║${p(r.n, 6)}║${p(r.min, 5)}║${p(r.max, 5)}║${p(r.mean, 6)}║${p(r.med, 5)}║${p(r.p10, 4)}║${p(r.p25, 4)}║${p(r.p75, 4)}║${p(r.p90, 4)}║${p(r.sd, 7)}║`);
  }
  console.log('╚═══════════════════╩══════╩═════╩═════╩══════╩═════╩════╩════╩════╩════╩═══════╝');

  console.log('\n  BOROUGH BREAKDOWN:');
  for (const [b, v] of Object.entries(S.boroughs).sort((a, b) => b[1].n - a[1].n)) {
    const fitAvg = (v.fitSum / v.n).toFixed(1);
    const linAvg = (v.linSum / v.n).toFixed(1);
    console.log(`    ${b.padEnd(12)} ${String(v.n).padStart(5)} BGs | Fit: ${fitAvg} (${v.fitMin}-${v.fitMax}) | Lin: ${linAvg} (${v.linMin}-${v.linMax})`);
  }

  const avgIQ = (S.iq.reduce((a, b) => a + b, 0) / S.iq.length).toFixed(1);
  const avgFit = (S.fit.reduce((a, b) => a + b, 0) / S.fit.length).toFixed(1);
  const avgLin = (S.lin.reduce((a, b) => a + b, 0) / S.lin.length).toFixed(1);

  console.log(`\n═══ COMPLETE ═══ batch=${BATCH_ID} scored=${S.scored} failed=${S.failed} ═══`);
  console.log(`  Avg IQ=${avgIQ} Avg Fit=${avgFit} Avg Linear=${avgLin}\n`);
}

await run();
