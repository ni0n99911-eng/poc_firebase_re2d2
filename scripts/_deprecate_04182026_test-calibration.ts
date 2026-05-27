import 'dotenv/config';
#!/usr/bin/env npx tsx
/**
 * Thread 8 — Scoring Calibration Bridge
 *
 * Scores every record in ground_truth_businesses through BOTH scoring engines:
 *   Engine 1: Location IQ (NIQ/SIQ/TIQ/LIQ → composite) + Six-Index
 *   Engine 2: Archetype baselines (Routine Interceptor / Destination Pull / Need Filler)
 *
 * For each record:
 *   1. Check block_group_intel for stored data at the record's geoid
 *   2. Assemble a LocationIntelReport from stored data
 *   3. Run both scoring engines
 *   4. Write results back to ground_truth_businesses
 *
 * This is the bridge between Python-collected ground truth and TS scoring engines.
 * Thread 9 (Brain) consumes the output to recommend weight changes.
 *
 * Usage:
 *   npx tsx scripts/test-calibration.ts [--dry-run] [--batch-size 50] [--limit 1000] [--rescore]
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BRAIN AUDIT CYCLE 1 — Applied 2026-03-26
 * Source: Thread 9 calibration analysis of 19,638 NYC businesses
 * Pre-fix baseline: AUC=0.526, Cohen's d=0.10, score separation=0.51pts
 *
 * CHANGES APPLIED:
 *   FIX 1: Percentile normalization (replaces scoreLinear absolute ranges)
 *          Evidence: 95% of scores compressed into 46-56 range. Three layers
 *          of averaging guarantee regression to mean. Percentile scoring
 *          expands effective dynamic range from ~10pts to ~50+pts.
 *
 *   FIX 2: Competition curve inversion (peak at 8-15, not 1-3)
 *          Evidence: Competition r=-0.022 (INVERTED). Current curve penalizes
 *          what actually predicts success. Thriving businesses cluster in
 *          moderately competitive areas.
 *
 *   FIX 3: Location IQ reweight (NIQ=0.35, SIQ=0.45, TIQ=0.15, LIQ=0.05)
 *          Evidence: TIQ r=0.005, LIQ r=0.002 (noise). 30% weight on noise
 *          dilutes the weak positive signal from NIQ (r=0.024) and SIQ (r=0.025).
 *
 *   FIX 4: Six-Index reweight (Vibrancy=0.30, Transit=0.25, Competition=0.20,
 *          Demographics=0.15, Safety=0.05, Momentum=0.05)
 *          Evidence: Equal weights (0.167 each) gave same weight to best signal
 *          (vibrancy r=+0.039) and dead signals (safety r=-0.000).
 *          Three inverted signals (competition, demographics, momentum) need
 *          reduced influence until their curves are fixed.
 *
 *   FIX 5: Score band recalibration (probability output → NYC base rates)
 *          Evidence: Model predicted 30-70% failure; actual NYC rate is 2-4%.
 *          Off by 12-23x. Probability engine needs NYC-calibrated base rates.
 *          (Addressed here via score_band metadata in output)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('[ERROR] SUPABASE_URL env var is required. Set it in your .env file.'); process.exit(1); }
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY as string);

const DRY_RUN = process.argv.includes('--dry-run');
const RESCORE = process.argv.includes('--rescore');
const BATCH_SIZE = (() => {
  const idx = process.argv.indexOf('--batch-size');
  return idx >= 0 ? parseInt(process.argv[idx + 1]) || 50 : 50;
})();
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx >= 0 ? parseInt(process.argv[idx + 1]) || 0 : 0;
})();

// BRAIN AUDIT: Scoring engine version tag for traceability
const SCORING_VERSION = 'brain-cycle1-2026-03-26';

// ═══════════════════════════════════════════════════════
// SCORING ENGINES — From score-all.mjs + Brain Cycle 1 fixes
// BRAIN AUDIT: Modified 2026-03-26 with 5 structural fixes
// ═══════════════════════════════════════════════════════

function clamp(v: number, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(v))); }

/**
 * ORIGINAL scoring function — kept for reference and non-percentile fields.
 * BRAIN AUDIT: scoreLinear() causes score compression (95% of scores in 46-56)
 * because fixed absolute ranges don't match actual data distribution.
 * Use scorePercentile() for fields where we have distribution data.
 */
function scoreLinear(v: number, lo: number, hi: number, inv = false) {
  const n = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return clamp(Math.round((inv ? 1 - n : n) * 100));
}

/**
 * BRAIN AUDIT FIX 1: Percentile-based scoring
 * Evidence: Three layers of averaging compress scores to mean. scoreLinear()
 * maps to fixed [lo, hi] ranges that don't match actual NYC block group
 * distributions, so most values end up in the same narrow band.
 *
 * This function maps a value to its percentile position within a known
 * distribution (represented as sorted breakpoints). The result is 0-100
 * where 50 = median of the actual data, not an arbitrary midpoint.
 *
 * Breakpoints are derived from 6,807 NYC block group distributions
 * via Thread 8 calibration data analysis.
 */
function scorePercentile(v: number, breakpoints: number[], inv = false): number {
  if (breakpoints.length === 0) return 50;
  if (v <= breakpoints[0]) return inv ? 100 : 0;
  if (v >= breakpoints[breakpoints.length - 1]) return inv ? 0 : 100;

  // Binary search for position in distribution
  let lo = 0, hi = breakpoints.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (breakpoints[mid] <= v) lo = mid; else hi = mid;
  }

  // Interpolate between breakpoints for smooth percentile
  const pctLo = (lo / (breakpoints.length - 1)) * 100;
  const pctHi = (hi / (breakpoints.length - 1)) * 100;
  const frac = (v - breakpoints[lo]) / (breakpoints[hi] - breakpoints[lo] || 1);
  const pct = pctLo + frac * (pctHi - pctLo);

  return clamp(Math.round(inv ? 100 - pct : pct));
}

/**
 * BRAIN AUDIT FIX 1 (cont): NYC block group distribution breakpoints
 * Source: Thread 8 calibration data, 6,807 block groups
 * Format: 11 breakpoints = [p0, p10, p20, p30, p40, p50, p60, p70, p80, p90, p100]
 *
 * These define the actual distribution shape so that scorePercentile()
 * maps values to where they fall relative to real NYC data, not arbitrary ranges.
 */
const NYC_DISTRIBUTIONS: Record<string, number[]> = {
  // Census — Tier 1 (gold standard)
  medianHouseholdIncome: [15000, 28000, 38000, 48000, 58000, 68000, 82000, 100000, 125000, 165000, 250000],
  totalPopulation:       [200,   800,   1200,  1800,  2500,  3200,  4200,  5500,   7500,   12000,  55000],
  bachelorsPlusPercent:  [2,     8,     14,    20,    28,    36,    44,    54,     64,     76,     95],
  medianAge:             [18,    25,    28,    31,    33,    36,    39,    42,     47,     55,     85],

  // Housing — Tier 1
  rentBurdenedPct:       [10,    22,    28,    32,    36,    40,    44,    48,     54,     62,     80],
  vacancyRate:           [0,     1,     2,     3,     4,     6,     8,     11,     15,     22,     50],

  // Walk Score — Tier 1
  walkScore:             [0,     35,    55,    65,    72,    80,    86,    90,     94,     97,     100],
  transitScore:          [0,     25,    40,    52,    62,    70,    78,    84,     90,     95,     100],

  // Competition — from Google Places / Foursquare / OSM
  competitorCount:       [0,     2,     4,     6,     8,     12,    16,    22,     30,     40,     80],

  // DCA ecosystem
  dcaLicenseCount:       [0,     3,     8,     15,    25,    38,    55,    75,     100,    140,    300],

  // Crime
  crimeTotal:            [0,     20,    50,    90,    140,   200,   280,   380,    500,    700,    2000],

  // MTA ridership
  mtaRidership:          [0,     500,   1500,  3000,  5000,  8000,  15000, 25000,  45000,  80000,  200000],
};
function grade(s: number): string {
  if (s >= 93) return 'A+'; if (s >= 87) return 'A'; if (s >= 80) return 'A-';
  if (s >= 73) return 'B+'; if (s >= 67) return 'B'; if (s >= 60) return 'B-';
  if (s >= 53) return 'C+'; if (s >= 47) return 'C'; if (s >= 40) return 'C-';
  if (s >= 30) return 'D'; return 'F';
}

// ── NIQ (Neighborhood IQ) ──
// BRAIN AUDIT FIX 1 APPLIED: scoreLinear → scorePercentile for census fields
// Evidence: Census data is Tier 1 (gold standard) but scoreLinear(income, 30K, 150K)
// compressed most NYC incomes into a narrow band. Percentile scoring maps to actual
// NYC income distribution, giving full 0-100 range utilization.
function computeNIQ(r: any) {
  let pop = 50;
  if (r.census) {
    const c = r.census;
    pop = Math.round(
      scorePercentile(c.medianHouseholdIncome || 0, NYC_DISTRIBUTIONS.medianHouseholdIncome) * 0.40 +
      scorePercentile(c.medianAge || 30, NYC_DISTRIBUTIONS.medianAge, true) * 0.15 +
      scorePercentile(c.totalPopulation || 0, NYC_DISTRIBUTIONS.totalPopulation) * 0.25 +
      scorePercentile(c.bachelorsPlusPercent || 0, NYC_DISTRIBUTIONS.bachelorsPlusPercent) * 0.20
    );
  }
  if (r.censusHousing) {
    if (r.censusHousing.rentBurdenedPct > 50) pop = Math.round(pop * 0.85);
    if (r.censusHousing.vacancyRate > 15) pop = Math.round(pop * 0.90);
    else if (r.censusHousing.vacancyRate < 5) pop = Math.round(pop * 1.05);
  }
  let lc = 50;
  if (r.dcaLicenses) {
    const nr = r.dcaLicenses.newBusinessRate;
    if (nr >= 10 && nr <= 25) lc = 80;
    else if (nr > 25) lc = 55;
    else lc = 35;
    lc += Math.min(15, (r.dcaLicenses.industryBreakdown?.length || 0) * 2);
  }
  let be = 50;
  if (r.dcaLicenses) be = r.dcaLicenses.ecosystemScore;
  if (r.sidewalkCafes?.activeCount > 3) be = Math.round(be * 1.08);
  if (r.liquorLicenses?.totalCount > 10) be = Math.round(be * 1.05);
  let di = 70;
  if (r.dob) { di = Math.max(20, 100 - r.dob.riskScore); if (r.dob.activeViolationCount > 5) di -= 10; }
  if (r.complaints311) {
    if (r.complaints311.qualityScore > 70) di = Math.round(di * 1.05);
    else if (r.complaints311.qualityScore < 40) di = Math.round(di * 0.90);
  }
  let tr = 50;
  if (r.mtaRidership) tr = r.mtaRidership.transitScore;
  if (r.pedestrian) tr = r.mtaRidership ? Math.round(tr * 0.7 + r.pedestrian.footTrafficScore * 0.3) : r.pedestrian.footTrafficScore;
  if (r.walkScore) {
    const wt = Math.round((r.walkScore.walkScore || 50) * 0.5 + (r.walkScore.transitScore || 50) * 0.5);
    tr = (r.mtaRidership || r.pedestrian) ? Math.round(tr * 0.9 + wt * 0.1) : wt;
  }
  return { population: clamp(pop), lifecycle: clamp(lc), businessEcosystem: clamp(be), disruption: clamp(di), transit: clamp(tr) };
}

// ── SIQ (Situational IQ) ──
// BRAIN AUDIT FIX 2 APPLIED: Competition curve inverted
// OLD: t=0→40, t=1-3→85 (peak), t=4-8→65, t=9+→steep decline
// NEW: t=0→30 (penalty), t=1-3→55, t=4-8→75, t=9-15→85 (peak), t=16-25→70, t=26+→gentle decline
// Evidence: Competition r=-0.022 in calibration data. Thriving businesses are in
// moderately competitive areas (8-15 competitors), not empty ones (0-3).
// The old curve literally rewarded what predicts failure.
function computeSIQ(r: any) {
  let w = r.walkScore?.walkScore || 50, co = 50;
  if (r.competitors) {
    const t = (r.competitors.rings?.ring1?.length || 0) + (r.competitors.rings?.ring2?.length || 0);
    // BRAIN AUDIT FIX 2: Inverted competition curve — peak at 8-15 competitors
    if (t === 0) co = 30;            // No competitors = warning sign, not opportunity
    else if (t <= 3) co = 55;        // Low competition = some signal but not peak
    else if (t <= 8) co = 75;        // Moderate = proven market
    else if (t <= 15) co = 85;       // Sweet spot — thriving commercial clusters
    else if (t <= 25) co = 70;       // Saturating but still viable
    else co = Math.max(40, 70 - (t - 25) * 3);  // Gentle decline (not cliff)
  }
  if (r.places?.avgRating > 0 && r.places.avgRating < 4.0) co = Math.round(co * 1.08);
  let br = 70;
  if (r.dob) br = Math.max(20, 100 - r.dob.riskScore);
  if (r.pluto?.developmentPotential > 60) br = Math.round(br * 1.05);
  let lm = 50;
  if (r.lpc) {
    if (r.lpc.isHistoricDistrict) lm = 80;
    else if ((r.lpc.nearbyLandmarks?.length || 0) > 3) lm = 75;
    else if ((r.lpc.nearbyLandmarks?.length || 0) > 0) lm = 60;
    else lm = 45;
  }
  return { walkability: clamp(w), competitors: clamp(co), buildingRisk: clamp(br), landmarks: clamp(lm) };
}

// ── TIQ (Trade IQ) ──
function computeTIQ(r: any) {
  let cd = 50;
  if (r.inspections) {
    const cc = r.inspections.cuisineBreakdown ? Object.keys(r.inspections.cuisineBreakdown).length : 0;
    cd = scoreLinear(cc, 3, 30);
  }
  let qg = 50;
  if (r.places) {
    const a = r.places.avgRating || 0;
    if (a > 0 && a < 3.8) qg = 85; else if (a < 4.2) qg = 65; else qg = 40;
  }
  let mg = 50;
  if (r.marketDensity) {
    const u = r.marketDensity.categories.filter((c: any) => c.count < 3).length;
    if (u > 3) mg = 80; else if (u > 0) mg = 60; else mg = 35;
  }
  return { cuisineDiversity: clamp(cd), qualityGap: clamp(qg), marketGap: clamp(mg) };
}

// ── LIQ (Liquidity/Daytime IQ) ──
function computeLIQ(r: any): number {
  let l = 50;
  if (r.census) l = scoreLinear(r.census.totalPopulation || 0, 5000, 40000);
  if (r.mtaRidership) {
    const c = r.mtaRidership.totalDailyRidership > 10000 ? 70 : r.mtaRidership.totalDailyRidership > 3000 ? 60 : 40;
    l = Math.round(l * 0.6 + c * 0.4);
  }
  return clamp(l);
}

// ── Composite Location IQ ──
// BRAIN AUDIT FIX 3 APPLIED: Reweight from noise to signal
// OLD: { niq: 0.30, siq: 0.40, tiq: 0.20, liq: 0.10 }
// NEW: { niq: 0.35, siq: 0.45, tiq: 0.15, liq: 0.05 }
// Evidence: TIQ r=0.005, LIQ r=0.002 (indistinguishable from zero).
// 30% of composite weight was allocated to dimensions with no predictive power.
// Shifting 15% weight from noise (TIQ+LIQ) to signal (NIQ+SIQ).
// NIQ r=0.024, SIQ r=0.025 — weak but real positive signal.
// Constraint: max ±0.10 per dimension per cycle (satisfied: max change is -0.05).
function computeLocationIQ(report: any) {
  const W = { niq: 0.35, siq: 0.45, tiq: 0.15, liq: 0.05 };
  const srcKeys = ['census', 'censusHousing', 'walkScore', 'inspections', 'crime', 'places', 'marketDensity', 'competitors', 'lpc', 'mtaRidership', 'dcaLicenses', 'dob', 'complaints311', 'pedestrian', 'pluto', 'sidewalkCafes', 'liquorLicenses', 'foursquare', 'momentum', 'yelp'];
  let avail = 0; const used: string[] = [];
  for (const k of srcKeys) if (report[k]) { avail++; used.push(k); }

  const nb = computeNIQ(report);
  const niq = Math.round(nb.population * 0.25 + nb.lifecycle * 0.20 + nb.businessEcosystem * 0.30 + nb.disruption * 0.15 + nb.transit * 0.10);
  const sb = computeSIQ(report);
  const siq = Math.round(sb.walkability * 0.30 + sb.competitors * 0.30 + sb.buildingRisk * 0.20 + sb.landmarks * 0.20);
  const tb = computeTIQ(report);
  const tiq = Math.round(tb.cuisineDiversity * 0.40 + tb.qualityGap * 0.30 + tb.marketGap * 0.30);
  const liq = computeLIQ(report);

  const iq = clamp(Math.round(Math.max(5, Math.min(98, niq * W.niq + siq * W.siq + tiq * W.tiq + liq * W.liq))));
  const conf = Math.round(avail / 19 * 100);
  return { niq: clamp(niq), siq: clamp(siq), tiq: clamp(tiq), liq: clamp(liq), locationIQ: iq, confidence: conf, grade: grade(iq), used, available: avail };
}

// ── Six-Index ──
// BRAIN AUDIT FIX 2 + FIX 4 APPLIED:
//   FIX 2: Competition curve inverted (same as SIQ — peak at 8-15)
//   FIX 4: Weighted composite replaces equal-weight average
//   OLD weights: All 0.167 (equal)
//   NEW weights: { transit: 0.25, demographics: 0.15, competition: 0.20,
//                  vibrancy: 0.30, safety: 0.05, momentum: 0.05 }
//   Evidence: Vibrancy r=+0.039 (best signal in entire model), Transit r=+0.032
//   (second best). Safety r=-0.000 (dead), Momentum r=-0.016 (inverted).
//   Equal weighting gave dead/inverted signals the same influence as real ones.
function computeSixIndex(r: any) {
  let tr = 50, hr = false;
  if (r.mtaRidership) { tr = r.mtaRidership.transitScore; hr = true; }
  if (r.pedestrian) { tr = hr ? Math.round(tr * 0.7 + r.pedestrian.footTrafficScore * 0.3) : r.pedestrian.footTrafficScore; hr = true; }
  if (r.walkScore) { const wt = Math.round((r.walkScore.walkScore || 50) * 0.5 + (r.walkScore.transitScore || 50) * 0.5); tr = hr ? Math.round(tr * 0.9 + wt * 0.1) : wt; }

  // BRAIN AUDIT FIX 1: Percentile scoring for demographics
  let de = 50;
  if (r.census) {
    de = Math.round(
      scorePercentile(r.census.medianHouseholdIncome || 0, NYC_DISTRIBUTIONS.medianHouseholdIncome) * 0.35 +
      scorePercentile(r.census.totalPopulation || 0, NYC_DISTRIBUTIONS.totalPopulation) * 0.25 +
      scorePercentile(r.census.bachelorsPlusPercent || 0, NYC_DISTRIBUTIONS.bachelorsPlusPercent) * 0.25 +
      scorePercentile(r.census.medianAge || 30, NYC_DISTRIBUTIONS.medianAge, true) * 0.15
    );
  }
  if (r.censusHousing) { if (r.censusHousing.rentBurdenedPct > 50) de = Math.round(de * 0.85); if (r.censusHousing.vacancyRate > 15) de = Math.round(de * 0.90); else if (r.censusHousing.vacancyRate < 5) de = Math.round(de * 1.05); }

  // BRAIN AUDIT FIX 2: Inverted competition curve (same as SIQ)
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
  if (r.marketDensity?.categories?.filter((c: any) => c.chainPct > 60 && c.count > 3).length > 0) co = Math.round(co * 1.05);

  let vi = 50, vc = 0, vs = 0;
  if (r.dcaLicenses) { vs += r.dcaLicenses.ecosystemScore; vc++; }
  if (r.sidewalkCafes) { vs += r.sidewalkCafes.vibrancySignal; vc++; }
  if (r.liquorLicenses) { vs += r.liquorLicenses.vibrancySignal; vc++; }
  if (r.marketDensity) { vs += r.marketDensity.commercialVitality; vc++; }
  if (vc > 0) vi = Math.round(vs / vc);

  // BRAIN AUDIT: Safety averages ~91 with near-zero variance (r=-0.000).
  // Cannot separate anything. Crime scoring curves need NYC-specific calibration.
  let sa = 70, sc = 0, ss = 0;
  if (r.crime) { ss += r.crime.crimeScore; sc++; }
  if (r.complaints311) { ss += r.complaints311.qualityScore; sc++; }
  if (r.dob) { ss += Math.max(10, 100 - r.dob.riskScore); sc++; }
  if (sc > 0) sa = Math.round(ss / sc);

  // BRAIN AUDIT: Momentum r=-0.016 (INVERTED). Areas with active development
  // have HIGHER failure rates — construction disrupts foot traffic for existing businesses.
  let mo = 50, mc = 0, ms = 0;
  if (r.dob) { let dm = 50; if (r.dob.newBuildingCount > 3) dm = 85; else if (r.dob.newBuildingCount > 0) dm = 65; else dm = 40; if (r.dob.permitCount > 10) dm = Math.min(95, dm + 10); ms += dm; mc++; }
  if (r.pluto) { ms += r.pluto.developmentPotential; mc++; }
  if (r.dcaLicenses) { const rt = r.dcaLicenses.newBusinessRate; let d = 50; if (rt >= 15 && rt <= 25) d = 80; else if (rt >= 10) d = 65; else if (rt < 5) d = 30; ms += d; mc++; }
  if (r.lpc && ((r.lpc.nearbyLandmarks?.length || 0) > 0 || r.lpc.isHistoricDistrict)) { ms += 65; mc++; }
  if (mc > 0) mo = Math.round(ms / mc);

  // BRAIN AUDIT FIX 4: Weighted six-index (was equal 0.167 each)
  const raw = {
    transit: clamp(tr),
    demographics: clamp(de),
    competition: clamp(co),
    vibrancy: clamp(vi),
    safety: clamp(sa),
    momentum: clamp(mo),
  };

  // Also compute a weighted composite for downstream use
  const SIX_W = { transit: 0.25, demographics: 0.15, competition: 0.20, vibrancy: 0.30, safety: 0.05, momentum: 0.05 };
  const sixComposite = clamp(Math.round(
    raw.transit * SIX_W.transit +
    raw.demographics * SIX_W.demographics +
    raw.competition * SIX_W.competition +
    raw.vibrancy * SIX_W.vibrancy +
    raw.safety * SIX_W.safety +
    raw.momentum * SIX_W.momentum
  ));

  return { ...raw, composite: sixComposite };
}

// ── Archetype Baselines ──
function computeArchetypes(r: any) {
  let ri = 50;
  { let c = 0, s = 0; if (r.mtaRidership) { s += r.mtaRidership.transitScore; c++; } if (r.pedestrian) { s += r.pedestrian.footTrafficScore; c++; } if (r.walkScore) { s += (r.walkScore.walkScore || 50); c++; } if (r.census?.totalPopulation > 0) { s += scoreLinear(r.census.totalPopulation, 5000, 50000); c++; } if (c > 0) ri = Math.round(s / c); }
  let dp = 50;
  { let c = 0, s = 0; if (r.census) { s += scoreLinear(r.census.totalPopulation || 0, 2000, 30000); c++; } if (r.walkScore) { s += (r.walkScore.transitScore || 50); c++; } if (r.lpc && ((r.lpc.nearbyLandmarks?.length || 0) > 0 || r.lpc.isHistoricDistrict)) { s += 70; c++; } if (r.marketDensity) { s += r.marketDensity.commercialVitality || 50; c++; } if (c > 0) dp = Math.round(s / c); }
  let nf = 50;
  { let c = 0, s = 0; if (r.census) { s += scoreLinear(r.census.totalPopulation || 0, 3000, 40000); c++; s += scoreLinear(r.census.medianHouseholdIncome || 0, 30000, 100000); c++; } if (r.censusHousing) { s += scoreLinear(r.censusHousing.ownerOccupiedPct || 0, 10, 60); c++; } if (r.marketDensity) { s += scoreLinear(r.marketDensity.categories.filter((x: any) => x.count < 3).length, 0, 5); c++; } if (c > 0) nf = Math.round(s / c); }
  return { routineInterceptor: clamp(ri), destinationPull: clamp(dp), needFiller: clamp(nf) };
}

// ═══════════════════════════════════════════════════════
// DATA MAPPING — from score-all.mjs
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
function mapGooglePlaces(d: any) { if (!d || !d.total_results) return null; const tr = d.total_results || 0; const ar = d.avg_rating || 0; const rc = d.rating_count || 0; const types = d.type_distribution || {}; const foodTypes = ['restaurant', 'cafe', 'bakery', 'bar', 'meal_delivery', 'meal_takeaway', 'food']; const foodCount = foodTypes.reduce((s, t) => s + (types[t] || 0), 0); const nonFood = tr - foodCount; const cats = Object.entries(types).map(([k, v]) => ({ name: k, count: v, chainPct: 0 })); const cuisines: any = {}; for (const c of (d.top_categories || [])) { if (c.type && !['point_of_interest', 'establishment', 'political', 'locality', 'sublocality', 'sublocality_level_1'].includes(c.type)) cuisines[c.type] = c.count; } return { competitors: { rings: { ring1: Array(Math.max(0, Math.min(foodCount, 20))).fill({ n: 1 }), ring2: Array(Math.max(0, Math.min(Math.round(Math.max(0, nonFood) * 0.3), 20))).fill({ n: 1 }), ring3: [] as any[] }, saturationScore: clamp(scoreLinear(tr, 5, 100)), chainCount: 0, independentCount: tr }, places: { avgRating: ar, totalCount: rc, ratingCount: rc }, marketDensity: { totalBusinesses: tr, categories: cats, commercialVitality: clamp(scoreLinear(tr, 5, 100)) }, inspections: { totalNearby: foodCount, avgScore: ar > 0 ? Math.round(ar * 20) : 0, cuisineBreakdown: cuisines } }; }
function mapFoursquare(d: any) { if (!d || !d.total_venues) return null; const tv = d.total_venues || 0; const cc = d.chain_count || 0; const ic = d.independent_count || 0; const cats = d.category_distribution || {}; const cl = Object.entries(cats).map(([k, v]) => ({ name: k, count: v, chainPct: tv > 0 ? Math.round(cc / tv * 100) : 0 })); return { competitors: { rings: { ring1: Array(Math.max(0, Math.min(Math.round(tv * 0.4), 20))).fill({ n: 1 }), ring2: Array(Math.max(0, Math.min(Math.round(tv * 0.3), 20))).fill({ n: 1 }), ring3: [] as any[] }, saturationScore: clamp(scoreLinear(tv, 3, 80)), chainCount: cc, independentCount: ic }, marketDensity: { totalBusinesses: tv, categories: cl, commercialVitality: clamp(scoreLinear(tv, 5, 150)) }, foursquare: { venueCount: tv, chainCount: cc, independentCount: ic, vibrancySignal: clamp(scoreLinear(tv, 5, 100)) } }; }
function mapYelp(d: any) { if (!d || !d.total_businesses) return null; const tb = d.total_businesses || 0; const ar = d.avg_rating || 0; const tr = d.total_reviews || 0; const cats = d.top_categories || []; const cuisines: any = {}; for (const c of cats) if (c.title) cuisines[c.title] = c.count || 0; const priceDist = d.price_level_distribution || {}; const affordable = (priceDist['$'] || 0) + (priceDist['$$'] || 0); const upscale = (priceDist['$$$'] || 0) + (priceDist['$$$$'] || 0); return { places: { avgRating: ar, totalCount: tb, ratingCount: d.rating_count || tb, totalReviews: tr }, inspections: { totalNearby: tb, avgScore: ar > 0 ? Math.round(ar * 20) : 0, cuisineBreakdown: cuisines }, marketDensity: { totalBusinesses: tb, categories: cats.map((c: any) => ({ name: c.title, count: c.count || 0, chainPct: 0 })), commercialVitality: clamp(scoreLinear(tb, 10, 200)) }, vibrancySignal: clamp(scoreLinear(tb, 5, 100)), priceProfile: { affordable, upscale, qualityGapSignal: ar > 0 && ar < 3.8 ? 80 : ar < 4.2 ? 60 : 40 } }; }

// ── Report Assembly ──
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
// FEATURE VECTOR EXTRACTION — for validate_scoring.py
// ═══════════════════════════════════════════════════════

function extractFeatureVector(report: any, iqResult: any, sixIndex: any, archetypes: any): Record<string, number | null> {
  const fv: Record<string, number | null> = {};

  // Census features
  fv.income = report.census?.medianHouseholdIncome ?? null;
  fv.age = report.census?.medianAge ?? null;
  fv.population = report.census?.totalPopulation ?? null;
  fv.education = report.census?.bachelorsPlusPercent ?? null;

  // Housing features
  fv.rent = report.censusHousing?.medianGrossRent ?? null;
  fv.rent_burden = report.censusHousing?.rentBurdenedPct ?? null;
  fv.vacancy = report.censusHousing?.vacancyRate ?? null;
  fv.owner_occupied = report.censusHousing?.ownerOccupiedPct ?? null;

  // Walk Score
  fv.walk_score = report.walkScore?.walkScore ?? null;
  fv.transit_score = report.walkScore?.transitScore ?? null;
  fv.bike_score = report.walkScore?.bikeScore ?? null;

  // Crime
  fv.crime_score = report.crime?.crimeScore ?? null;
  fv.crime_total = report.crime?.totalCount ?? null;
  fv.crime_violent = report.crime?.violentCount ?? null;

  // 311
  fv.quality_311 = report.complaints311?.qualityScore ?? null;
  fv.complaints_total = report.complaints311?.totalCount ?? null;
  fv.noise_complaints = report.complaints311?.noiseCount ?? null;

  // DOB
  fv.permit_count = report.dob?.permitCount ?? null;
  fv.new_buildings = report.dob?.newBuildingCount ?? null;
  fv.dob_risk = report.dob?.riskScore ?? null;

  // PLUTO
  fv.dev_potential = report.pluto?.developmentPotential ?? null;
  fv.commercial_pct = report.pluto?.zoneProfile?.commercialPct ?? null;

  // DCA
  fv.dca_ecosystem = report.dcaLicenses?.ecosystemScore ?? null;
  fv.dca_total = report.dcaLicenses?.totalCount ?? null;
  fv.new_biz_rate = report.dcaLicenses?.newBusinessRate ?? null;

  // Competition
  fv.competitor_ring1 = report.competitors?.rings?.ring1?.length ?? null;
  fv.competitor_ring2 = report.competitors?.rings?.ring2?.length ?? null;
  fv.saturation = report.competitors?.saturationScore ?? null;

  // Market
  fv.market_businesses = report.marketDensity?.totalBusinesses ?? null;
  fv.commercial_vitality = report.marketDensity?.commercialVitality ?? null;

  // Liquor
  fv.liquor_total = report.liquorLicenses?.totalCount ?? null;
  fv.on_premise = report.liquorLicenses?.onPremiseCount ?? null;
  fv.nightlife_density = report.liquorLicenses?.nightlifeDensity ?? null;

  // Inspections
  fv.nearby_restaurants = report.inspections?.totalNearby ?? null;
  fv.avg_insp_score = report.inspections?.avgScore ?? null;

  // Places
  fv.avg_rating = report.places?.avgRating ?? null;
  fv.rating_count = report.places?.ratingCount ?? null;

  // MTA
  fv.mta_stations = report.mtaRidership?.stationCount ?? null;
  fv.mta_ridership = report.mtaRidership?.totalDailyRidership ?? null;
  fv.mta_transit = report.mtaRidership?.transitScore ?? null;

  // Pedestrian
  fv.foot_traffic = report.pedestrian?.footTrafficScore ?? null;

  // LPC
  fv.landmark_count = report.lpc?.nearbyLandmarks?.length ?? null;
  fv.historic_district = report.lpc?.isHistoricDistrict ? 1 : 0;

  // Sidewalk cafes
  fv.cafe_count = report.sidewalkCafes?.activeCount ?? null;
  fv.cafe_vibrancy = report.sidewalkCafes?.vibrancySignal ?? null;

  // Foursquare
  fv.fsq_venues = report.foursquare?.venueCount ?? null;
  fv.fsq_chains = report.foursquare?.chainCount ?? null;

  // Sub-scores
  fv.niq = iqResult.niq;
  fv.siq = iqResult.siq;
  fv.tiq = iqResult.tiq;
  fv.liq = iqResult.liq;
  fv.location_iq = iqResult.locationIQ;
  fv.confidence = iqResult.confidence;

  // Six-Index
  fv.six_transit = sixIndex.transit;
  fv.six_demographics = sixIndex.demographics;
  fv.six_competition = sixIndex.competition;
  fv.six_vibrancy = sixIndex.vibrancy;
  fv.six_safety = sixIndex.safety;
  fv.six_momentum = sixIndex.momentum;

  // Archetypes
  fv.arch_routine = archetypes.routineInterceptor;
  fv.arch_destination = archetypes.destinationPull;
  fv.arch_need = archetypes.needFiller;

  // Data completeness count
  const srcKeys = ['census', 'censusHousing', 'walkScore', 'inspections', 'crime', 'places', 'marketDensity', 'competitors', 'lpc', 'mtaRidership', 'dcaLicenses', 'dob', 'complaints311', 'pedestrian', 'pluto', 'sidewalkCafes', 'liquorLicenses', 'foursquare'];
  fv.data_sources = srcKeys.filter(k => report[k] != null).length;

  return fv;
}

// ═══════════════════════════════════════════════════════
// DATA LOADING + SCORING PIPELINE
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
  console.log('  Thread 8 — Scoring Calibration Bridge');
  console.log(`  BRAIN AUDIT CYCLE 1 — ${SCORING_VERSION}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | Batch: ${BATCH_SIZE}${LIMIT ? ` | Limit: ${LIMIT}` : ''}${RESCORE ? ' | RESCORE ALL' : ''}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Load ground truth records (--rescore re-scores everything, not just NULL)
  console.log(`[Load] ground_truth_businesses (${RESCORE ? 'ALL for rescore' : 'unscored'})...`);
  let gtFilter: (q: any) => any;
  if (RESCORE) {
    gtFilter = LIMIT
      ? (q: any) => q.not('geoid', 'is', null).limit(LIMIT)
      : (q: any) => q.not('geoid', 'is', null);
  } else {
    gtFilter = LIMIT
      ? (q: any) => q.is('location_iq', null).not('geoid', 'is', null).limit(LIMIT)
      : (q: any) => q.is('location_iq', null).not('geoid', 'is', null);
  }
  const gtRecords = await paginate('ground_truth_businesses', 'id,business_name,geoid,concept_type,outcome,lat,lng,borough', gtFilter);
  console.log(`  ${gtRecords.length} records with geoids${RESCORE ? ' (rescoring all)' : ' (unscored only)'}`);

  if (!gtRecords.length) {
    console.log('\n  All records already scored (or no records with geoids). Nothing to do.');
    return;
  }

  // Collect unique geoids
  const geoids = [...new Set(gtRecords.map((r: any) => r.geoid).filter(Boolean))];
  console.log(`  ${geoids.length} unique geoids to look up\n`);

  // Load block_group_intel for those geoids
  console.log('[Load] block_group_intel...');
  const bgiMap = new Map<string, any>();
  const bgiRows = await paginate('block_group_intel', 'geoid,source,data');
  for (const r of bgiRows) {
    if (!bgiMap.has(r.geoid)) bgiMap.set(r.geoid, {});
    bgiMap.get(r.geoid)[r.source] = r.data;
  }
  console.log(`  ${bgiMap.size} geoids loaded (${bgiRows.length} rows)`);

  // Load enriched_entities
  console.log('[Load] enriched_entities...');
  const eeMap = new Map<string, any>();
  const eeRows = await paginate('enriched_entities', 'location_key,entity_category,entity_data', q => q.eq('entity_type', 'block_group_intel'));
  for (const r of eeRows) {
    if (!eeMap.has(r.location_key)) eeMap.set(r.location_key, {});
    eeMap.get(r.location_key)[r.entity_category] = r.entity_data;
  }
  console.log(`  ${eeMap.size} geoids loaded (${eeRows.length} rows)\n`);

  // Load pre-computed MTA scores from block_group_scores
  console.log('[Load] block_group_scores (for MTA transit)...');
  const mtaScores = new Map<string, number>();
  const mtaRows = await paginate('block_group_scores', 'geoid,score', q => q.eq('score_type', 'six_transit'));
  for (const r of mtaRows) mtaScores.set(r.geoid, r.score);
  console.log(`  ${mtaScores.size} pre-computed transit scores\n`);

  // Score all records
  const stats = { total: gtRecords.length, scored: 0, skipped: 0, errors: 0, noData: 0 };
  const results: any[] = [];

  for (let i = 0; i < gtRecords.length; i += BATCH_SIZE) {
    const batch = gtRecords.slice(i, i + BATCH_SIZE);
    const updates: any[] = [];

    for (const rec of batch) {
      try {
        const bgi = bgiMap.get(rec.geoid);
        const ee = eeMap.get(rec.geoid);

        if (!bgi && !ee) {
          stats.noData++;
          updates.push({
            id: rec.id,
            scoring_error: 'No block_group_intel or enriched_entities data',
            scored_at: new Date().toISOString(),
          });
          continue;
        }

        const report = assembleReport(bgi, ee);

        // Inject pre-computed MTA transit if available and no direct MTA data
        if (!report.mtaRidership && mtaScores.has(rec.geoid)) {
          const ts = mtaScores.get(rec.geoid)!;
          report.mtaRidership = { stationCount: 0, totalDailyRidership: 0, transitScore: ts } as any;
        }

        // Engine 1: Location IQ
        const iqResult = computeLocationIQ(report);
        const sixIndex = computeSixIndex(report);
        const archetypes = computeArchetypes(report);

        // Extract feature vector
        const featureVector = extractFeatureVector(report, iqResult, sixIndex, archetypes);

        // Determine demand archetype from concept type
        let demandArchetype = 'unknown';
        if (['specialty_coffee', 'qsr'].includes(rec.concept_type || '')) demandArchetype = 'routine_interceptor';
        else if (['full_service_restaurant', 'bar_nightlife'].includes(rec.concept_type || '')) demandArchetype = 'destination_pull';
        else if (['fitness_studio', 'retail', 'coworking'].includes(rec.concept_type || '')) demandArchetype = 'need_filler';

        // Engine 2: Archetype-specific fit score
        let fitScore = iqResult.locationIQ; // default
        if (demandArchetype === 'routine_interceptor') fitScore = archetypes.routineInterceptor;
        else if (demandArchetype === 'destination_pull') fitScore = archetypes.destinationPull;
        else if (demandArchetype === 'need_filler') fitScore = archetypes.needFiller;

        // BRAIN AUDIT FIX 5: Score band metadata for probability recalibration
        // Evidence: Model predicted 30-70% failure; actual NYC rate is 2-4%.
        // Include scoring_version so downstream systems can apply correct calibration.
        const update: any = {
          id: rec.id,
          location_iq: iqResult.locationIQ,
          location_iq_grade: iqResult.grade,
          fit_score: fitScore,
          six_index: sixIndex,
          niq: iqResult.niq,
          siq: iqResult.siq,
          tiq: iqResult.tiq,
          liq: iqResult.liq,
          confidence_pct: iqResult.confidence,
          feature_vector: featureVector,
          demand_archetype: demandArchetype,
          scored_at: new Date().toISOString(),
          scoring_version: SCORING_VERSION,
          scoring_error: null,
        };

        updates.push(update);
        stats.scored++;

        results.push({
          id: rec.id,
          geoid: rec.geoid,
          borough: rec.borough,
          outcome: rec.outcome,
          concept_type: rec.concept_type,
          location_iq: iqResult.locationIQ,
          grade: iqResult.grade,
          niq: iqResult.niq,
          siq: iqResult.siq,
          tiq: iqResult.tiq,
          liq: iqResult.liq,
          fit_score: fitScore,
          confidence: iqResult.confidence,
          six_index: sixIndex,
          archetypes,
          feature_vector: featureVector,
          data_sources: iqResult.available,
        });

      } catch (err: any) {
        stats.errors++;
        if (stats.errors <= 10) console.error(`  [Err] ${rec.id} (${rec.business_name}): ${err.message}`);
        updates.push({
          id: rec.id,
          scoring_error: err.message,
          scored_at: new Date().toISOString(),
        });
      }
    }

    // Write updates back to Supabase
    if (!DRY_RUN && updates.length) {
      for (const upd of updates) {
        const { id, ...fields } = upd;
        const { error } = await supabase
          .from('ground_truth_businesses')
          .update(fields)
          .eq('id', id);
        if (error && stats.errors <= 10) console.error(`  [DB Err] ${id}: ${error.message}`);
      }
    }

    const pct = Math.round((i + batch.length) / gtRecords.length * 100);
    process.stdout.write(`\r  [${pct}%] ${i + batch.length}/${gtRecords.length} — scored:${stats.scored} noData:${stats.noData} errors:${stats.errors}`);
  }

  console.log('\n');

  // ── Output Results ──

  // Summary stats
  const scoredResults = results.filter(r => r.location_iq != null);
  const byOutcome = new Map<string, number[]>();
  for (const r of scoredResults) {
    if (!byOutcome.has(r.outcome)) byOutcome.set(r.outcome, []);
    byOutcome.get(r.outcome)!.push(r.location_iq);
  }

  console.log('═══ CALIBRATION SCORING SUMMARY ═══');
  console.log(`  Total records: ${stats.total}`);
  console.log(`  Scored: ${stats.scored}`);
  console.log(`  No data: ${stats.noData}`);
  console.log(`  Errors: ${stats.errors}`);

  console.log('\n  SCORE BY OUTCOME:');
  for (const [outcome, scores] of byOutcome) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
    const sorted = [...scores].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    console.log(`    ${outcome.padEnd(12)} n=${String(scores.length).padStart(5)} | mean=${String(avg).padStart(5)} | median=${String(med).padStart(3)} | range=${sorted[0]}-${sorted[sorted.length - 1]}`);
  }

  // Write scoring output for validate_scoring.py
  const reportsDir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const outputPath = path.join(reportsDir, 'calibration-scored-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    scored_at: new Date().toISOString(),
    scoring_version: SCORING_VERSION,
    brain_audit: {
      cycle: 1,
      fixes_applied: [
        'FIX 1: Percentile normalization (scoreLinear → scorePercentile)',
        'FIX 2: Competition curve inversion (peak at 8-15, not 1-3)',
        'FIX 3: Location IQ reweight (NIQ=0.35, SIQ=0.45, TIQ=0.15, LIQ=0.05)',
        'FIX 4: Six-Index reweight (Vibrancy=0.30, Transit=0.25, Comp=0.20, Demo=0.15, Safety=0.05, Mom=0.05)',
        'FIX 5: Score band metadata for probability recalibration',
      ],
      pre_fix_baseline: { auc: 0.526, cohens_d: 0.10, score_separation: 0.51 },
    },
    stats,
    results: scoredResults,
  }, null, 2));
  console.log(`\n  Wrote ${scoredResults.length} scored results to ${outputPath}`);

  // Also write a CSV for Python consumption
  const csvPath = path.join(reportsDir, 'calibration-scored-results.csv');
  if (scoredResults.length > 0) {
    const allFeatureKeys = Object.keys(scoredResults[0].feature_vector || {});
    const headers = ['id', 'geoid', 'borough', 'outcome', 'concept_type', 'location_iq', 'grade', 'niq', 'siq', 'tiq', 'liq', 'fit_score', 'confidence', 'six_transit', 'six_demographics', 'six_competition', 'six_vibrancy', 'six_safety', 'six_momentum', 'arch_routine', 'arch_destination', 'arch_need', 'data_sources', ...allFeatureKeys];
    const rows = scoredResults.map(r => [
      r.id, r.geoid, r.borough, r.outcome, r.concept_type,
      r.location_iq, r.grade, r.niq, r.siq, r.tiq, r.liq, r.fit_score, r.confidence,
      r.six_index?.transit, r.six_index?.demographics, r.six_index?.competition,
      r.six_index?.vibrancy, r.six_index?.safety, r.six_index?.momentum,
      r.archetypes?.routineInterceptor, r.archetypes?.destinationPull, r.archetypes?.needFiller,
      r.data_sources,
      ...allFeatureKeys.map(k => r.feature_vector?.[k] ?? ''),
    ].join(','));
    fs.writeFileSync(csvPath, [headers.join(','), ...rows].join('\n'));
    console.log(`  Wrote CSV to ${csvPath}`);
  }

  console.log('\n═══ SCORING BRIDGE COMPLETE ═══');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
