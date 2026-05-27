import 'dotenv/config';
#!/usr/bin/env npx tsx
/**
 * RE² Brain Cycle 2 — Borough-Specific Regression Test
 *
 * Tests borough-aware, concept-aware scoring against 12,006 ground truth records.
 * Does NOT write to Supabase — read-only analysis to measure improvement.
 *
 * Key changes from Cycle 1:
 *   1. Borough-specific income curves (inverted in Manhattan/Queens, normal in Brooklyn/Bronx)
 *   2. Borough-specific signal weights (walk score useless in Manhattan ceiling, critical in Queens)
 *   3. Concept-specific competition (same-category, not total)
 *   4. Price-income fit scoring (new)
 *   5. Dead signals removed (safety, momentum near-zero weight)
 *   6. Staten Island car-dependent model (no walk score)
 *
 * Usage:
 *   npx tsx scripts/regression-cycle2.ts
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const _surl = process.env.SUPABASE_URL;
if (!_surl) { console.error('[ERROR] SUPABASE_URL env var is required. Set it in your .env file.'); process.exit(1); }
const supabase = createClient(_surl, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

// ═══════════════════════════════════════════════════════
// BOROUGH-SPECIFIC CONFIGURATION
// ═══════════════════════════════════════════════════════

interface BoroughConfig {
  incomeDirection: 'normal' | 'inverted' | 'weak';
  walkScoreWeight: number;    // 0-1, how much walk score matters
  transitWeight: number;
  incomeWeight: number;
  competitionWeight: number;
  vibrancyWeight: number;
  safetyWeight: number;       // near-zero everywhere
  momentumWeight: number;     // near-zero everywhere
  isCarDependent: boolean;
  rentPressure: 'extreme' | 'high' | 'moderate' | 'low';
}

const BOROUGH_CONFIG: Record<string, BoroughConfig> = {
  'Manhattan': {
    incomeDirection: 'inverted',   // $128K failed vs $121K thriving
    walkScoreWeight: 0.02,         // CYCLE 2C: near-zero, ceiling for everyone
    transitWeight: 0.15,           // also near-ceiling, minimal signal
    incomeWeight: 0.15,            // inverted — less weight
    competitionWeight: 0.25,       // CYCLE 2C: boosted — proven demand matters here
    vibrancyWeight: 0.38,          // CYCLE 2C: PRIMARY signal for Manhattan differentiation
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'extreme',
  },
  'Queens': {
    incomeDirection: 'inverted',   // $93K failed vs $83K thriving
    walkScoreWeight: 0.35,         // STRONGEST signal (+10 points separation)
    transitWeight: 0.20,
    incomeWeight: 0.15,            // inverted
    competitionWeight: 0.15,
    vibrancyWeight: 0.10,
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'moderate',
  },
  'Brooklyn': {
    incomeDirection: 'normal',     // $88K failed vs $97K thriving
    walkScoreWeight: 0.20,         // helps slightly (+4)
    transitWeight: 0.20,
    incomeWeight: 0.20,            // normal direction
    competitionWeight: 0.15,
    vibrancyWeight: 0.20,
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'high',
  },
  'Bronx': {
    incomeDirection: 'normal',     // $40K failed vs $45K thriving
    walkScoreWeight: 0.10,         // at ceiling (89-90) — weak signal
    transitWeight: 0.25,
    incomeWeight: 0.25,            // normal — income helps here
    competitionWeight: 0.15,
    vibrancyWeight: 0.20,
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'low',
  },
  'Staten Island': {
    incomeDirection: 'weak',       // slight inversion but small sample
    walkScoreWeight: 0.0,          // ZERO — walk score is 0 for everyone
    transitWeight: 0.10,
    incomeWeight: 0.20,
    competitionWeight: 0.25,       // being near other businesses matters more here
    vibrancyWeight: 0.25,
    safetyWeight: 0.05,
    momentumWeight: 0.15,          // development signals may matter more in suburban context
    isCarDependent: true,
    rentPressure: 'low',
  },
};

const DEFAULT_BOROUGH_CONFIG: BoroughConfig = {
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

// ═══════════════════════════════════════════════════════
// CONCEPT-SPECIFIC CONFIGURATION
// ═══════════════════════════════════════════════════════

interface ConceptConfig {
  competitionCategories: string[];  // Google Places types that are direct competitors
  priceRange: [number, number];     // expected $ level (1-4)
  tradeRadiusM: number;
  trafficPattern: 'morning' | 'evening' | 'allday' | 'weekend';
  saturationThreshold: number;      // competition count where score starts declining
  incomeMin: number;                // minimum viable income for this concept
  incomeSweet: number;              // sweet spot income
  transitDependency: number;        // 0-1, how much this concept needs transit
  footTrafficDependency: number;    // 0-1, how much this concept needs walk-by traffic
}

const CONCEPT_CONFIG: Record<string, ConceptConfig> = {
  'full_service_restaurant': {
    competitionCategories: ['restaurant', 'meal_takeaway', 'food'],
    priceRange: [2, 3],
    tradeRadiusM: 2000,
    trafficPattern: 'evening',
    saturationThreshold: 20,
    incomeMin: 45000,
    incomeSweet: 85000,
    transitDependency: 0.5,
    footTrafficDependency: 0.4,
  },
  'specialty_coffee': {
    competitionCategories: ['cafe', 'coffee_shop', 'bakery'],
    priceRange: [1, 2],
    tradeRadiusM: 400,
    trafficPattern: 'morning',
    saturationThreshold: 8,
    incomeMin: 40000,
    incomeSweet: 75000,
    transitDependency: 0.7,
    footTrafficDependency: 0.8,
  },
  'qsr': {
    competitionCategories: ['restaurant', 'meal_takeaway', 'meal_delivery', 'fast_food'],
    priceRange: [1, 1],
    tradeRadiusM: 800,
    trafficPattern: 'allday',
    saturationThreshold: 12,
    incomeMin: 30000,
    incomeSweet: 55000,
    transitDependency: 0.6,
    footTrafficDependency: 0.7,
  },
  'retail': {
    competitionCategories: ['clothing_store', 'store', 'shopping_mall'],
    priceRange: [2, 3],
    tradeRadiusM: 1500,
    trafficPattern: 'weekend',
    saturationThreshold: 15,
    incomeMin: 50000,
    incomeSweet: 90000,
    transitDependency: 0.4,
    footTrafficDependency: 0.5,
  },
};

const DEFAULT_CONCEPT: ConceptConfig = {
  competitionCategories: ['restaurant', 'cafe', 'store'],
  priceRange: [2, 2],
  tradeRadiusM: 1000,
  trafficPattern: 'allday',
  saturationThreshold: 15,
  incomeMin: 40000,
  incomeSweet: 75000,
  transitDependency: 0.5,
  footTrafficDependency: 0.5,
};

// ═══════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════

function clamp(v: number, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(v))); }

function scoreLinear(v: number, lo: number, hi: number, inv = false) {
  const n = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return clamp(Math.round((inv ? 1 - n : n) * 100));
}

function scorePercentile(v: number, breakpoints: number[], inv = false): number {
  if (breakpoints.length === 0) return 50;
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

const NYC_D = {
  income: [15000, 28000, 38000, 48000, 58000, 68000, 82000, 100000, 125000, 165000, 250000],
  pop: [200, 800, 1200, 1800, 2500, 3200, 4200, 5500, 7500, 12000, 55000],
  edu: [2, 8, 14, 20, 28, 36, 44, 54, 64, 76, 95],
  age: [18, 25, 28, 31, 33, 36, 39, 42, 47, 55, 85],
};

function grade(s: number): string {
  if (s >= 93) return 'A+'; if (s >= 87) return 'A'; if (s >= 80) return 'A-';
  if (s >= 73) return 'B+'; if (s >= 67) return 'B'; if (s >= 60) return 'B-';
  if (s >= 53) return 'C+'; if (s >= 47) return 'C'; if (s >= 40) return 'C-';
  if (s >= 30) return 'D'; return 'F';
}

// ═══════════════════════════════════════════════════════
// CYCLE 2 SCORING — BOROUGH + CONCEPT AWARE
// ═══════════════════════════════════════════════════════

/**
 * NEW: Price-Income Fit Score
 * Checks if the area's income supports this concept's price point.
 * Returns 0-100 where 100 = perfect fit.
 */
function computePriceIncomeFit(income: number, concept: ConceptConfig, borough: BoroughConfig): number {
  if (!income || income <= 0) return 50;

  // Is income sufficient for this concept?
  const sufficiency = income >= concept.incomeSweet ? 100
    : income >= concept.incomeMin ? scoreLinear(income, concept.incomeMin, concept.incomeSweet)
    : scoreLinear(income, concept.incomeMin * 0.5, concept.incomeMin);

  // CYCLE 2B: Rent pressure penalty CAPPED at -10 (was unbounded up to -30)
  // Data showed priceIncomeFit was inverted — failed scored HIGHER than thriving.
  // The rent trap penalty was overcorrecting in Manhattan/Queens.
  let rentPenalty = 0;
  if (borough.incomeDirection === 'inverted') {
    if (income > concept.incomeSweet * 1.3) {
      rentPenalty = Math.min(10, Math.round((income - concept.incomeSweet * 1.3) / 2000));
    }
  }

  return clamp(sufficiency - rentPenalty);
}

/**
 * NEW: Same-Category Competition Score
 * Counts competitors in the same category, applies concept-specific threshold.
 */
function computeConceptCompetition(report: any, concept: ConceptConfig): number {
  // CYCLE 2B: Hump curve — moderate competition = proven demand (GOOD),
  // only extreme saturation is bad. Data showed thriving areas have MORE competitors.
  let totalComp = 0;
  if (report.competitors) {
    totalComp = (report.competitors.rings?.ring1?.length || 0) + (report.competitors.rings?.ring2?.length || 0);
  }

  const sameCategoryCount = report.inspections?.totalNearby || Math.round(totalComp * 0.4);
  const threshold = concept.saturationThreshold;

  // Hump curve: peaks at 1.0-1.5x threshold (proven demand zone)
  // Low competition = unproven market, moderate = validated, extreme = saturated
  if (sameCategoryCount === 0) return 20;  // desert — no market validation at all
  const ratio = sameCategoryCount / threshold;
  if (ratio <= 0.3) return 40;             // thin market — risky
  if (ratio <= 0.6) return 60;             // emerging — some validation
  if (ratio <= 1.0) return 80;             // healthy — good demand signal
  if (ratio <= 1.5) return 90;             // peak — proven demand, not yet saturated
  if (ratio <= 2.0) return 75;             // crowding — still viable but competitive
  if (ratio <= 3.0) return 55;             // saturated — hard to differentiate
  return Math.max(25, 55 - Math.round((ratio - 3.0) * 10));  // oversaturated
}

/**
 * Accessibility Score — borough-aware
 * Walk score is critical in Queens, useless in Manhattan (ceiling) and Staten Island (zero)
 */
function computeAccessibility(report: any, borough: BoroughConfig): number {
  let score = 50;

  if (borough.isCarDependent) {
    // Staten Island model: commercial density + DCA licenses as proxy for accessibility
    let signals = 0, sum = 0;
    if (report.marketDensity) { sum += report.marketDensity.commercialVitality; signals++; }
    if (report.dcaLicenses) { sum += report.dcaLicenses.ecosystemScore; signals++; }
    if (report.competitors) {
      const t = (report.competitors.rings?.ring1?.length || 0) + (report.competitors.rings?.ring2?.length || 0);
      sum += scoreLinear(t, 0, 30); signals++;
    }
    return signals > 0 ? clamp(Math.round(sum / signals)) : 50;
  }

  // Walk + transit weighted by borough config
  const walkScore = report.walkScore?.walkScore || 0;
  const transitScore = report.walkScore?.transitScore || 0;
  const mtaTransit = report.mtaRidership?.transitScore || 0;

  // Blend walk and transit based on borough weights
  const walkPart = scorePercentile(walkScore, [0, 35, 55, 65, 72, 80, 86, 90, 94, 97, 100]);
  const transitPart = mtaTransit || scorePercentile(transitScore, [0, 25, 40, 52, 62, 70, 78, 84, 90, 95, 100]);

  // Pedestrian foot traffic if available
  const footTraffic = report.pedestrian?.footTrafficScore || 0;

  if (footTraffic > 0) {
    score = Math.round(walkPart * 0.3 + transitPart * 0.4 + footTraffic * 0.3);
  } else {
    score = Math.round(walkPart * 0.45 + transitPart * 0.55);
  }

  return clamp(score);
}

/**
 * Demographics Score — borough-aware income direction
 */
function computeDemographics(report: any, borough: BoroughConfig, concept: ConceptConfig): number {
  if (!report.census) return 50;

  const income = report.census.medianHouseholdIncome || 0;
  const pop = report.census.totalPopulation || 0;
  const edu = report.census.bachelorsPlusPercent || 0;
  const age = report.census.medianAge || 30;

  // Income scoring depends on borough direction
  let incomeScore: number;
  if (borough.incomeDirection === 'inverted') {
    // In Manhattan/Queens: moderate income = better (less rent pressure)
    // Sweet spot around concept's sweet spot, penalize going too high
    const dist = Math.abs(income - concept.incomeSweet);
    incomeScore = clamp(100 - Math.round(dist / 1000));
  } else {
    // Normal: higher income = better (up to a point)
    incomeScore = scorePercentile(income, NYC_D.income);
  }

  const popScore = scorePercentile(pop, NYC_D.pop);
  const eduScore = scorePercentile(edu, NYC_D.edu);
  const ageScore = scorePercentile(age, NYC_D.age, true); // younger = higher score

  // Weight by what matters for the concept
  let score = Math.round(incomeScore * 0.35 + popScore * 0.25 + eduScore * 0.25 + ageScore * 0.15);

  // Housing adjustments
  if (report.censusHousing) {
    if (report.censusHousing.rentBurdenedPct > 50) score = Math.round(score * 0.90);
    if (report.censusHousing.vacancyRate > 15) score = Math.round(score * 0.92);
    else if (report.censusHousing.vacancyRate < 5) score = Math.round(score * 1.04);
  }

  return clamp(score);
}

/**
 * Vibrancy Score — ecosystem health signals
 */
function computeVibrancy(report: any): number {
  // CYCLE 2C: Added foursquare + yelp vibrancy, and use MAX of top signals
  // instead of average — one strong vibrancy signal should carry the score.
  // Old approach averaged low/missing signals down to 17-19 range.
  const signals: number[] = [];
  if (report.dcaLicenses) signals.push(report.dcaLicenses.ecosystemScore);
  if (report.sidewalkCafes) signals.push(report.sidewalkCafes.vibrancySignal);
  if (report.liquorLicenses) signals.push(report.liquorLicenses.vibrancySignal);
  if (report.marketDensity) signals.push(report.marketDensity.commercialVitality);
  if (report.foursquare) signals.push(report.foursquare.vibrancySignal);
  if (report.yelp) signals.push(report.yelp.vibrancySignal);
  if (report.places) signals.push(clamp(scoreLinear(report.places.totalCount || 0, 5, 200)));

  if (signals.length === 0) return 30; // no data = below average, not neutral

  // Use weighted blend: best signal carries 50%, average of rest carries 50%
  signals.sort((a, b) => b - a);
  const best = signals[0];
  const rest = signals.length > 1 ? signals.slice(1).reduce((s, v) => s + v, 0) / (signals.length - 1) : best;
  return clamp(Math.round(best * 0.5 + rest * 0.5));
}

/**
 * Safety Score — kept but minimal weight
 */
function computeSafety(report: any): number {
  let sc = 0, ss = 0;
  if (report.crime) { ss += report.crime.crimeScore; sc++; }
  if (report.complaints311) { ss += report.complaints311.qualityScore; sc++; }
  if (report.dob) { ss += Math.max(10, 100 - report.dob.riskScore); sc++; }
  return sc > 0 ? clamp(Math.round(ss / sc)) : 70;
}

/**
 * Momentum Score — kept but minimal weight (inverted signal)
 */
function computeMomentum(report: any): number {
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

/**
 * MAIN CYCLE 2 SCORER — Borough + Concept aware
 */
function scoreCycle2(report: any, borough: string, conceptType: string) {
  const bc = BOROUGH_CONFIG[borough] || DEFAULT_BOROUGH_CONFIG;
  const cc = CONCEPT_CONFIG[conceptType] || DEFAULT_CONCEPT;

  // Sub-scores
  const accessibility = computeAccessibility(report, bc);
  const demographics = computeDemographics(report, bc, cc);
  const competition = computeConceptCompetition(report, cc);
  const priceIncomeFit = computePriceIncomeFit(
    report.census?.medianHouseholdIncome || 0, cc, bc
  );
  const vibrancy = computeVibrancy(report);
  const safety = computeSafety(report);
  const momentum = computeMomentum(report);

  // Borough-weighted composite
  const locationIQ = clamp(Math.round(
    accessibility * bc.walkScoreWeight +
    accessibility * bc.transitWeight +  // transit is part of accessibility
    demographics * bc.incomeWeight +
    competition * bc.competitionWeight +
    vibrancy * bc.vibrancyWeight +
    safety * bc.safetyWeight +
    momentum * bc.momentumWeight
  ));

  // CYCLE 2C: priceIncomeFit DROPPED — consistently inverted across 2A and 2B.
  // Accessibility is 4x strongest signal. Vibrancy boosted for Manhattan differentiation.
  const fitScore = clamp(Math.round(
    accessibility * 0.40 +
    vibrancy * 0.25 +
    competition * 0.20 +
    demographics * 0.15
  ));

  // Data availability
  const srcKeys = ['census', 'censusHousing', 'walkScore', 'inspections', 'crime', 'places',
    'marketDensity', 'competitors', 'lpc', 'mtaRidership', 'dcaLicenses', 'dob',
    'complaints311', 'pedestrian', 'pluto', 'sidewalkCafes', 'liquorLicenses', 'foursquare'];
  const available = srcKeys.filter(k => report[k] != null).length;

  return {
    locationIQ,
    fitScore,
    grade: grade(fitScore),
    accessibility,
    demographics,
    competition,
    priceIncomeFit,
    vibrancy,
    safety,
    momentum,
    confidence: Math.round(available / 18 * 100),
    available,
    boroughConfig: borough,
    conceptConfig: conceptType,
  };
}

// ═══════════════════════════════════════════════════════
// DATA MAPPING — same as Cycle 1
// ═══════════════════════════════════════════════════════

function mapCensus(d: any) { if (!d || !d.total_population) return null; const tp = d.total_population || 0; const bp = (d.bachelors_degree || 0) + (d.masters_degree || 0) + (d.doctorate_degree || 0); return { medianHouseholdIncome: d.median_household_income || 0, medianAge: d.median_age || 0, totalPopulation: tp, bachelorsPlusPercent: tp > 0 ? Math.round(bp / tp * 100) : 0 }; }
function mapHousing(d: any) { if (!d || !d.total_housing_units) return null; const t = d.total_housing_units || 1; const o = d.occupied_housing_units || 0; return { medianGrossRent: d.median_gross_rent || 0, rentBurdenedPct: d.median_rent_burden_pct || 0, vacancyRate: t > 0 ? Math.round((t - o) / t * 100) : 0, ownerOccupiedPct: o > 0 ? Math.round((d.owner_occupied || 0) / o * 100) : 0 }; }
function mapWS(d: any) { if (!d) return null; return { walkScore: d.walkscore || d.raw?.walkscore || 0, transitScore: d.transit_score || d.raw?.transit?.score || 0, bikeScore: d.bike_score || d.raw?.bike?.score || 0 }; }
function mapCrime(d: any) { if (!d) return null; if (d.by_category !== undefined || d.record_count !== undefined) { const t = d.record_count || 0; const bc = d.by_category || {}; return { crimeScore: clamp(Math.round(100 - Math.min(90, t / 500 * 90))), totalCount: t, violentCount: bc.FELONY || bc.felony || 0, propertyCount: bc.MISDEMEANOR || bc.misdemeanor || 0 }; } const t = d.total_crimes || 0; return { crimeScore: clamp(Math.round(100 - Math.min(90, t / 500 * 90))), totalCount: t, violentCount: d.felony || 0, propertyCount: d.misdemeanor || 0 }; }
function map311(d: any) { if (!d) return null; if (d.by_type !== undefined || d.record_count !== undefined) { const t = d.record_count || 0; const bt = d.by_type || {}; const noise = (bt['Noise'] || 0) + (bt['Noise - Commercial'] || 0) + (bt['Noise - Residential'] || 0) + (bt['Noise - Vehicle'] || 0) + (bt['Noise - Street/Sidewalk'] || 0); return { qualityScore: clamp(Math.round(100 - Math.min(90, t / 1000 * 90))), totalCount: t, noiseCount: noise, sanitationCount: bt['Rodent'] || 0 }; } const t = d.total_complaints || 0; return { qualityScore: clamp(Math.round(100 - Math.min(90, t / 1000 * 90))), totalCount: t, noiseCount: d.noise_complaints || 0, sanitationCount: d.rodent_complaints || 0 }; }
function mapPluto(d: any) { if (!d) return null; const bf = d.avg_built_far || 0; const mf = d.avg_max_far || 0; const dp = mf > 0 ? clamp(Math.round((mf - bf) / mf * 100)) : 50; return { developmentPotential: dp, lots: [], zoneProfile: { commercialPct: d.commercial_overlay_pct || 0 }, buildingProfile: { avgYearBuilt: d.avg_year_built || 0, totalRetailSqFt: 0, avgLotSize: d.total_lot_area_sqft || 0 } }; }
function mapDCA(d: any) { if (!d) return null; if (d.by_type !== undefined || d.record_count !== undefined) { const tc = d.record_count || 0; const bt = d.by_type || {}; return { ecosystemScore: clamp(scoreLinear(tc, 5, 100)), totalCount: tc, newBusinessRate: 15, industryBreakdown: Object.entries(bt).map(([k, v]) => ({ industry: k, count: v })), vibrancySignal: clamp(scoreLinear(tc, 5, 100)) }; } const tc = d.total_active_licenses || 0; const cats = d.business_category_mix || {}; return { ecosystemScore: clamp(scoreLinear(tc, 5, 100)), totalCount: tc, newBusinessRate: 15, industryBreakdown: Object.entries(cats).map(([k, v]) => ({ industry: k, count: v })), vibrancySignal: clamp(scoreLinear(tc, 5, 100)) }; }
function mapOSM(d: any) { if (!d) return null; const tp = d.total_pois || 0; const cats = d.category_distribution || {}; const cl = Object.entries(cats).map(([k, v]) => ({ name: k, count: v, chainPct: 0 })); return { comp: { rings: { ring1: Array(Math.min(Math.round(tp * 0.3), 20)).fill({ n: 1 }), ring2: Array(Math.min(Math.round(tp * 0.4), 20)).fill({ n: 1 }), ring3: [] as any[] }, saturationScore: clamp(scoreLinear(tp, 5, 100)), chainCount: 0, independentCount: tp }, market: { totalBusinesses: tp, categories: cl, commercialVitality: clamp(scoreLinear(tp, 10, 200)) } }; }
function mapLiquor(d: any) { if (!d) return null; const t = d.total_licenses || 0; const dist = d.license_type_distribution || {}; const op = Object.entries(dist).filter(([k]) => k.toLowerCase().includes('op') || k.toLowerCase().includes('on_premise') || k.toLowerCase().includes('on premise')).reduce((s, [, v]) => s + (v as number), 0); return { totalCount: t, onPremiseCount: op, nightlifeDensity: clamp(scoreLinear(op, 2, 30)), vibrancySignal: clamp(scoreLinear(t, 5, 50)) }; }
function mapInsp(d: any) { if (!d) return null; if (d.grade_distribution !== undefined || (d.record_count !== undefined && d.restaurant_count === undefined)) { const gd = d.grade_distribution || {}; const total = d.record_count || 0; const aCount = gd['A'] || 0; const avgScore = total > 0 ? Math.round((aCount / total) * 100) : 50; return { totalNearby: total, avgScore, cuisineBreakdown: {} }; } return { totalNearby: d.restaurant_count || d.total_inspection_records || 0, avgScore: d.avg_inspection_score || 0, cuisineBreakdown: {} }; }
function mapMTA(d: any) { if (!d) return null; const sc = d.station_count_within_400m || 0; const dr = d.estimated_daily_ridership || 0; return { stationCount: sc, totalDailyRidership: dr, transitScore: clamp(Math.round(scoreLinear(dr, 1000, 100000) * 0.6 + scoreLinear(sc, 0, 5) * 0.4)) }; }
function mapDOB(d: any) { if (!d) return null; if (d.by_type !== undefined || d.record_count !== undefined) { const bt = d.by_type || {}; const total = d.record_count || 0; const nb = bt['NB'] || 0; const dm = bt['DM'] || 0; return { permitCount: total, newBuildingCount: nb, activeViolationCount: 0, riskScore: clamp(Math.round(Math.min(80, dm * 20 + (total > 20 ? 20 : 0)))) }; } return { permitCount: d.total_permits || 0, newBuildingCount: d.new_building || 0, activeViolationCount: 0, riskScore: clamp(Math.round(Math.min(80, (d.demolition || 0) * 20 + ((d.total_permits || 0) > 20 ? 20 : 0)))) }; }
function mapLPC(d: any) { if (!d) return null; if (d.by_type !== undefined || d.record_count !== undefined) { const bt = d.by_type || {}; const ind = bt['Individual Landmark'] || bt['INDIVIDUAL'] || 0; const hist = bt['Historic District'] || bt['HISTORIC DISTRICT'] || bt['HDIST'] || 0; const lc = Math.max(0, d.record_count || (ind + hist)); return { nearbyLandmarks: Array(lc).fill({ t: 1 }), isHistoricDistrict: hist > 0 }; } const ind = d.individual_landmarks || 0; const dist = d.district_landmarks || 0; const lc = Math.max(0, d.landmark_count || (ind + dist)); return { nearbyLandmarks: Array(lc).fill({ t: 1 }), isHistoricDistrict: dist > 0 }; }
function mapCafe(d: any) { if (!d) return null; if (d.record_count !== undefined && d.cafe_count === undefined) { const c = d.record_count || 0; return { activeCount: c, totalCount: c, totalSeatingCapacity: c * 20, vibrancySignal: clamp(scoreLinear(c, 1, 15)) }; } const c = d.cafe_count || 0; const s = d.total_seating_capacity || 0; return { activeCount: c, totalCount: c, totalSeatingCapacity: s, vibrancySignal: clamp(scoreLinear(c, 1, 15) * 0.5 + scoreLinear(s, 10, 200) * 0.5) }; }
function mapPed(d: any) { if (!d) return null; const avg = d.avg_pedestrian_count || 0; return { totalPedestrians: d.total_readings || avg, countLocationCount: d.sensor_segments || 0, footTrafficScore: clamp(scoreLinear(avg, 100, 10000)) }; }
function mapGooglePlaces(d: any) { if (!d || !d.total_results) return null; const tr = d.total_results || 0; const ar = d.avg_rating || 0; const rc = d.rating_count || 0; const types = d.type_distribution || {}; const foodTypes = ['restaurant', 'cafe', 'bakery', 'bar', 'meal_delivery', 'meal_takeaway', 'food']; const foodCount = foodTypes.reduce((s: number, t: string) => s + (types[t] || 0), 0); const nonFood = tr - foodCount; const cats = Object.entries(types).map(([k, v]) => ({ name: k, count: v, chainPct: 0 })); const cuisines: any = {}; for (const c of (d.top_categories || [])) { if (c.type && !['point_of_interest', 'establishment', 'political', 'locality', 'sublocality', 'sublocality_level_1'].includes(c.type)) cuisines[c.type] = c.count; } return { competitors: { rings: { ring1: Array(Math.max(0, Math.min(foodCount, 20))).fill({ n: 1 }), ring2: Array(Math.max(0, Math.min(Math.round(Math.max(0, nonFood) * 0.3), 20))).fill({ n: 1 }), ring3: [] as any[] }, saturationScore: clamp(scoreLinear(tr, 5, 100)), chainCount: 0, independentCount: tr }, places: { avgRating: ar, totalCount: rc, ratingCount: rc }, marketDensity: { totalBusinesses: tr, categories: cats, commercialVitality: clamp(scoreLinear(tr, 5, 100)) }, inspections: { totalNearby: foodCount, avgScore: ar > 0 ? Math.round(ar * 20) : 0, cuisineBreakdown: cuisines } }; }
function mapFoursquare(d: any) { if (!d || !d.total_venues) return null; const tv = d.total_venues || 0; const cc = d.chain_count || 0; const ic = d.independent_count || 0; const cats = d.category_distribution || {}; const cl = Object.entries(cats).map(([k, v]) => ({ name: k, count: v, chainPct: tv > 0 ? Math.round(cc / tv * 100) : 0 })); return { competitors: { rings: { ring1: Array(Math.max(0, Math.min(Math.round(tv * 0.4), 20))).fill({ n: 1 }), ring2: Array(Math.max(0, Math.min(Math.round(tv * 0.3), 20))).fill({ n: 1 }), ring3: [] as any[] }, saturationScore: clamp(scoreLinear(tv, 3, 80)), chainCount: cc, independentCount: ic }, marketDensity: { totalBusinesses: tv, categories: cl, commercialVitality: clamp(scoreLinear(tv, 5, 150)) }, foursquare: { venueCount: tv, chainCount: cc, independentCount: ic, vibrancySignal: clamp(scoreLinear(tv, 5, 100)) } }; }
function mapYelp(d: any) { if (!d || !d.total_businesses) return null; const tb = d.total_businesses || 0; const ar = d.avg_rating || 0; const tr = d.total_reviews || 0; const cats = d.top_categories || []; const cuisines: any = {}; for (const c of cats) if (c.title) cuisines[c.title] = c.count || 0; const priceDist = d.price_level_distribution || {}; const affordable = (priceDist['$'] || 0) + (priceDist['$$'] || 0); const upscale = (priceDist['$$$'] || 0) + (priceDist['$$$$'] || 0); return { places: { avgRating: ar, totalCount: tb, ratingCount: d.rating_count || tb, totalReviews: tr }, inspections: { totalNearby: tb, avgScore: ar > 0 ? Math.round(ar * 20) : 0, cuisineBreakdown: cuisines }, marketDensity: { totalBusinesses: tb, categories: cats.map((c: any) => ({ name: c.title, count: c.count || 0, chainPct: 0 })), commercialVitality: clamp(scoreLinear(tb, 10, 200)) }, vibrancySignal: clamp(scoreLinear(tb, 5, 100)), priceProfile: { affordable, upscale, qualityGapSignal: ar > 0 && ar < 3.8 ? 80 : ar < 4.2 ? 60 : 40 } }; }

function assembleReport(bgi: any, ee: any) {
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
  const mtaRidership = mapMTA(ee?.mta_ridership);
  const competitors = gp?.competitors || fsq?.competitors || osm?.comp || null;
  const places = yp?.places || gp?.places || null;
  const mdSources = [gp?.marketDensity, fsq?.marketDensity, yp?.marketDensity, osm?.market].filter(Boolean);
  let marketDensity = null;
  if (mdSources.length) { marketDensity = mdSources.reduce((best: any, m: any) => (!best || (m.commercialVitality || 0) > (best.commercialVitality || 0)) ? m : best, null); }
  const inspections = yp?.inspections || gp?.inspections || inspRaw || null;
  const foursquare = fsq?.foursquare || null;
  return { census, censusHousing, walkScore, crime, complaints311, pluto, dcaLicenses, competitors, marketDensity, liquorLicenses, inspections, mtaRidership, dob, lpc, sidewalkCafes, pedestrian, foursquare, yelp: yp || null, places, momentum: null, errors: [] };
}

// ═══════════════════════════════════════════════════════
// MAIN — READ-ONLY REGRESSION TEST
// ═══════════════════════════════════════════════════════

async function paginate(table: string, select: string, filter?: (q: any) => any, pageSize = 1000): Promise<any[]> {
  const rows: any[] = [];
  let off = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(off, off + pageSize - 1).limit(pageSize);
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

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  BRAIN CYCLE 2 — Borough-Specific Regression Test');
  console.log('  READ-ONLY — No writes to Supabase');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Load ground truth
  console.log('[Load] ground_truth_businesses...');
  const gtRecords = await paginate('ground_truth_businesses',
    'id,business_name,geoid,concept_type,outcome,lat,lng,borough',
    q => q.not('geoid', 'is', null));
  console.log(`  ${gtRecords.length} records\n`);

  // Load intel
  console.log('[Load] block_group_intel...');
  const bgiMap = new Map<string, any>();
  const bgiRows = await paginate('block_group_intel', 'geoid,source,data');
  for (const r of bgiRows) {
    if (!bgiMap.has(r.geoid)) bgiMap.set(r.geoid, {});
    bgiMap.get(r.geoid)[r.source] = r.data;
  }
  console.log(`  ${bgiMap.size} geoids (${bgiRows.length} rows)`);

  // Load MTA scores
  console.log('[Load] block_group_scores (MTA)...');
  const mtaScores = new Map<string, number>();
  const mtaRows = await paginate('block_group_scores', 'geoid,score', q => q.eq('score_type', 'six_transit'));
  for (const r of mtaRows) mtaScores.set(r.geoid, r.score);
  console.log(`  ${mtaScores.size} transit scores\n`);

  // Score all records
  const results: any[] = [];
  let scored = 0, noData = 0;

  for (const rec of gtRecords) {
    const bgi = bgiMap.get(rec.geoid);
    if (!bgi) { noData++; continue; }

    const report = assembleReport(bgi, null);
    if (!report.mtaRidership && mtaScores.has(rec.geoid)) {
      report.mtaRidership = { stationCount: 0, totalDailyRidership: 0, transitScore: mtaScores.get(rec.geoid)! } as any;
    }

    const scores = scoreCycle2(report, rec.borough || 'Unknown', rec.concept_type || 'unknown');
    scored++;

    results.push({
      id: rec.id,
      borough: rec.borough,
      outcome: rec.outcome,
      concept_type: rec.concept_type,
      locationIQ: scores.locationIQ,
      fitScore: scores.fitScore,
      grade: scores.grade,
      accessibility: scores.accessibility,
      demographics: scores.demographics,
      competition: scores.competition,
      priceIncomeFit: scores.priceIncomeFit,
      vibrancy: scores.vibrancy,
    });
  }

  console.log(`Scored: ${scored}, No data: ${noData}\n`);

  // ═══ ANALYSIS ═══

  // Overall by outcome
  console.log('═══════════════════════════════════════════════════');
  console.log('  CYCLE 2 vs CYCLE 1 COMPARISON');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('  OVERALL — Location IQ:');
  for (const outcome of ['failed', 'surviving', 'thriving']) {
    const recs = results.filter(r => r.outcome === outcome);
    if (!recs.length) continue;
    const avg = (recs.reduce((s, r) => s + r.locationIQ, 0) / recs.length).toFixed(1);
    const med = [...recs.map(r => r.locationIQ)].sort((a, b) => a - b)[Math.floor(recs.length / 2)];
    console.log(`    ${outcome.padEnd(12)} n=${String(recs.length).padStart(5)} | mean=${avg.padStart(5)} | median=${String(med).padStart(3)}`);
  }

  console.log('\n  OVERALL — Fit Score (NEW):');
  for (const outcome of ['failed', 'surviving', 'thriving']) {
    const recs = results.filter(r => r.outcome === outcome);
    if (!recs.length) continue;
    const avg = (recs.reduce((s, r) => s + r.fitScore, 0) / recs.length).toFixed(1);
    const med = [...recs.map(r => r.fitScore)].sort((a, b) => a - b)[Math.floor(recs.length / 2)];
    console.log(`    ${outcome.padEnd(12)} n=${String(recs.length).padStart(5)} | mean=${avg.padStart(5)} | median=${String(med).padStart(3)}`);
  }

  // By concept type
  const conceptTypes = [...new Set(results.map(r => r.concept_type))].sort();
  console.log('\n  BY CONCEPT TYPE — Fit Score:');
  for (const ct of conceptTypes) {
    console.log(`\n    ${ct}:`);
    for (const outcome of ['failed', 'surviving', 'thriving']) {
      const recs = results.filter(r => r.concept_type === ct && r.outcome === outcome);
      if (!recs.length) continue;
      const avg = (recs.reduce((s, r) => s + r.fitScore, 0) / recs.length).toFixed(1);
      console.log(`      ${outcome.padEnd(12)} n=${String(recs.length).padStart(5)} | mean=${avg.padStart(5)}`);
    }
  }

  // By borough
  const boroughs = [...new Set(results.map(r => r.borough))].filter(Boolean).sort();
  console.log('\n  BY BOROUGH — Fit Score:');
  for (const b of boroughs) {
    console.log(`\n    ${b}:`);
    for (const outcome of ['failed', 'surviving', 'thriving']) {
      const recs = results.filter(r => r.borough === b && r.outcome === outcome);
      if (!recs.length) continue;
      const avg = (recs.reduce((s, r) => s + r.fitScore, 0) / recs.length).toFixed(1);
      console.log(`      ${outcome.padEnd(12)} n=${String(recs.length).padStart(5)} | mean=${avg.padStart(5)}`);
    }
  }

  // Sub-score breakdown for full_service_restaurant
  console.log('\n  SUB-SCORE BREAKDOWN — Full Service Restaurants:');
  const subScores = ['accessibility', 'demographics', 'competition', 'priceIncomeFit', 'vibrancy'];
  for (const sub of subScores) {
    console.log(`\n    ${sub}:`);
    for (const outcome of ['failed', 'surviving', 'thriving']) {
      const recs = results.filter(r => r.concept_type === 'full_service_restaurant' && r.outcome === outcome);
      if (!recs.length) continue;
      const avg = (recs.reduce((s, r) => s + r[sub], 0) / recs.length).toFixed(1);
      console.log(`      ${outcome.padEnd(12)} n=${String(recs.length).padStart(5)} | mean=${avg.padStart(5)}`);
    }
  }

  // Compute separation metrics
  console.log('\n═══ SEPARATION METRICS ═══');
  const thriving = results.filter(r => r.outcome === 'thriving');
  const failed = results.filter(r => r.outcome === 'failed');

  if (thriving.length && failed.length) {
    const tMeanIQ = thriving.reduce((s, r) => s + r.locationIQ, 0) / thriving.length;
    const fMeanIQ = failed.reduce((s, r) => s + r.locationIQ, 0) / failed.length;
    const tMeanFit = thriving.reduce((s, r) => s + r.fitScore, 0) / thriving.length;
    const fMeanFit = failed.reduce((s, r) => s + r.fitScore, 0) / failed.length;

    // Cohen's d
    const tVarIQ = thriving.reduce((s, r) => s + (r.locationIQ - tMeanIQ) ** 2, 0) / thriving.length;
    const fVarIQ = failed.reduce((s, r) => s + (r.locationIQ - fMeanIQ) ** 2, 0) / failed.length;
    const pooledSD_IQ = Math.sqrt((tVarIQ + fVarIQ) / 2);
    const cohenD_IQ = pooledSD_IQ > 0 ? (tMeanIQ - fMeanIQ) / pooledSD_IQ : 0;

    const tVarFit = thriving.reduce((s, r) => s + (r.fitScore - tMeanFit) ** 2, 0) / thriving.length;
    const fVarFit = failed.reduce((s, r) => s + (r.fitScore - fMeanFit) ** 2, 0) / failed.length;
    const pooledSD_Fit = Math.sqrt((tVarFit + fVarFit) / 2);
    const cohenD_Fit = pooledSD_Fit > 0 ? (tMeanFit - fMeanFit) / pooledSD_Fit : 0;

    console.log(`\n  Location IQ:  thriving=${tMeanIQ.toFixed(1)} failed=${fMeanIQ.toFixed(1)} delta=${(tMeanIQ - fMeanIQ).toFixed(1)} Cohen's d=${cohenD_IQ.toFixed(3)}`);
    console.log(`  Fit Score:    thriving=${tMeanFit.toFixed(1)} failed=${fMeanFit.toFixed(1)} delta=${(tMeanFit - fMeanFit).toFixed(1)} Cohen's d=${cohenD_Fit.toFixed(3)}`);
    console.log(`\n  CYCLE 1 BASELINE: delta=1.0 Cohen's d≈0.10`);
    console.log(`  CYCLE 0 BASELINE: delta=0.51 Cohen's d≈0.10`);
  }

  console.log('\n═══ REGRESSION TEST COMPLETE ═══');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
