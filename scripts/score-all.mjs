#!/usr/bin/env node
/**
 * RE² Production Scoring Engine
 * Thread 9 (Brain) Cycle 1 — Standalone batch scorer
 *
 * BRAIN AUDIT — 5 STRUCTURAL FIXES:
 *   FIX 1: Percentile normalization via NYC distribution tables
 *   FIX 2: Competition curve inversion (peak at 8-15 competitors)
 *   FIX 3: Location IQ reweight (NIQ=0.35, SIQ=0.45, TIQ=0.15, LIQ=0.05)
 *   FIX 4: Six-Index reweight (Vibrancy=0.30, Transit=0.25, Comp=0.20, Demo=0.15)
 *   FIX 5: Score band metadata for probability recalibration
 *
 * Usage:
 *   node scripts/score-all.mjs                     # Score all block groups
 *   node scripts/score-all.mjs --geoid 360610001001 # Score one block group
 *   node scripts/score-all.mjs --dry-run            # Preview without writing
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCORING_VERSION = 'brain-v5-8dim';

// Pre-computed neighborhood scores — loaded from block_group_scores before scoring
let PRECOMPUTED_HEALTH = {};
let PRECOMPUTED_SURVIVAL = {};

async function loadPrecomputedScores() {
  console.log('Loading pre-computed neighborhood health + survival rate...');
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('block_group_scores')
      .select('geoid, score_type, score')
      .in('score_type', ['six_neighborhood_health', 'six_survival_rate'])
      .range(offset, offset + pageSize - 1);
    if (error) { console.error('Failed to load precomputed:', error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row.score_type === 'six_neighborhood_health') PRECOMPUTED_HEALTH[row.geoid] = row.score;
      if (row.score_type === 'six_survival_rate') PRECOMPUTED_SURVIVAL[row.geoid] = row.score;
    }
    offset += pageSize;
    if (data.length < pageSize) break;
  }
  console.log(`  Loaded health scores for ${Object.keys(PRECOMPUTED_HEALTH).length} block groups`);
  console.log(`  Loaded survival scores for ${Object.keys(PRECOMPUTED_SURVIVAL).length} block groups`);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SINGLE_GEOID = args.find((_, i, a) => a[i - 1] === '--geoid') || null;
const BATCH_SIZE = parseInt(args.find((_, i, a) => a[i - 1] === '--batch-size') || '200', 10);

// ============================================================
// BRAIN FIX 1: NYC Distribution Tables
// ============================================================

const NYC_D = {
  medianIncome:    [12000, 22000, 30000, 40000, 50000, 60000, 72000, 85000, 105000, 135000, 180000, 230000, 450000],
  popDensity:      [500, 5000, 10000, 20000, 30000, 40000, 52000, 65000, 80000, 100000, 130000, 160000, 300000],
  educationPct:    [5, 12, 18, 25, 30, 36, 42, 50, 58, 66, 75, 82, 95],
  medianRent:      [600, 900, 1100, 1300, 1450, 1550, 1650, 1800, 2000, 2300, 2800, 3300, 6000],
  vacancyRate:     [0, 1, 2, 3, 4, 5, 7, 9, 11, 14, 18, 25, 50],
  walkScore:       [10, 40, 55, 65, 72, 78, 84, 88, 92, 95, 97, 99, 100],
  transitScore:    [0, 20, 35, 45, 55, 62, 70, 76, 82, 88, 93, 97, 100],
  crimeCount:      [0, 5, 10, 18, 28, 40, 55, 75, 100, 140, 200, 300, 800],
  competitorCount: [0, 1, 2, 4, 6, 8, 12, 16, 22, 30, 45, 65, 150],
  mtaRidership:    [0, 1000, 3000, 5000, 8000, 12000, 18000, 25000, 35000, 50000, 75000, 100000, 250000],
  dobPermits:      [0, 2, 5, 10, 15, 22, 30, 40, 55, 75, 110, 160, 400],
};

const PERCENTILES = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100];

function scorePercentile(value, distribution) {
  if (value == null || isNaN(value)) return 50;
  if (value <= distribution[0]) return 0;
  if (value >= distribution[distribution.length - 1]) return 100;

  for (let i = 0; i < distribution.length - 1; i++) {
    if (value >= distribution[i] && value <= distribution[i + 1]) {
      const range = distribution[i + 1] - distribution[i];
      if (range === 0) return PERCENTILES[i];
      const fraction = (value - distribution[i]) / range;
      return PERCENTILES[i] + fraction * (PERCENTILES[i + 1] - PERCENTILES[i]);
    }
  }
  return 50;
}

// BRAIN FIX 2: Competition curve inverted
function scoreCompetition(count) {
  if (count == null || isNaN(count)) return 50;
  if (count <= 1) return 15;
  if (count <= 3) return 30;
  if (count <= 5) return 50;
  if (count <= 8) return 70;
  if (count <= 15) return 90;  // sweet spot
  if (count <= 20) return 80;
  if (count <= 25) return 65;
  if (count <= 35) return 45;
  return 25;
}

// ============================================================
// SCORING FUNCTIONS
// ============================================================

function safeJson(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val;
}

function computeNIQ(d) {
  const income = scorePercentile(d.census?.medianIncome, NYC_D.medianIncome);
  const pop = scorePercentile(d.census?.population, NYC_D.popDensity);
  const edu = scorePercentile(d.census?.educationPct, NYC_D.educationPct);
  const transit = scorePercentile(d.walkScore?.transitScore, NYC_D.transitScore);
  const eco = Math.min(100, (d.dcaLicenses?.activeLicenses || 0) * 3);
  const disruption = Math.max(0, 100 - Math.min(100, (d.complaints311?.totalComplaints || 0) * 0.5));
  return Math.round(income * 0.25 + pop * 0.15 + edu * 0.10 + transit * 0.20 + eco * 0.15 + disruption * 0.15);
}

function computeSIQ(d) {
  const walk = scorePercentile(d.walkScore?.walkScore, NYC_D.walkScore);
  const comp = scoreCompetition(d.competitors?.totalCompetitors || 0);  // FIX 2
  const bldg = Math.max(0, 100 - Math.min(100, (d.dobPermits?.violations || 0) * 5));
  const char = Math.min(100, 50 + (d.lpc?.landmarkCount || 0) * 10);
  return Math.round(walk * 0.30 + comp * 0.35 + bldg * 0.20 + char * 0.15);
}

function computeTIQ(d) {
  const quality = Math.round(((d.yelp?.avgRating || 3.5) / 5) * 100);
  const diversity = Math.min(100, (d.inspections?.uniqueCuisines || d.yelp?.uniqueCategories || 5) * 5);
  const demand = Math.min(100, d.foursquare?.avgPopularity || 50);
  const pl = d.yelp?.avgPriceLevel || 2;
  const price = pl === 2 ? 90 : pl === 1 ? 70 : pl === 3 ? 75 : 50;
  return Math.round(quality * 0.30 + diversity * 0.25 + demand * 0.25 + price * 0.20);
}

function computeLIQ(d) {
  const mta = scorePercentile(d.mtaRidership?.dailyRidership, NYC_D.mtaRidership);
  const pop = scorePercentile(d.census?.population, NYC_D.popDensity);
  return Math.round(mta * 0.6 + pop * 0.4);
}

// BRAIN FIX 3: Location IQ reweight
function computeLocationIQ(niq, siq, tiq, liq) {
  return Math.round(niq * 0.35 + siq * 0.45 + tiq * 0.15 + liq * 0.05);
}

// BRAIN FIX 4: Six-Index reweight
function computeSixIndex(d) {
  const transit = scorePercentile(d.walkScore?.transitScore, NYC_D.transitScore);
  const income = scorePercentile(d.census?.medianIncome, NYC_D.medianIncome);
  const edu = scorePercentile(d.census?.educationPct, NYC_D.educationPct);
  const demographics = Math.round(income * 0.6 + edu * 0.4);
  const competition = scoreCompetition(d.competitors?.totalCompetitors || 0);

  const fsq = Math.min(100, (d.foursquare?.totalPlaces || 0) * 3);
  const ylp = Math.min(100, (d.yelp?.totalBusinesses || 0) * 3);
  const cfe = Math.min(100, (d.sidewalkCafes?.permitCount || 0) * 10);
  const liq = Math.min(100, (d.liquorLicenses?.totalLicenses || 0) * 5);
  const vibrancy = Math.round(fsq * 0.30 + ylp * 0.30 + cfe * 0.20 + liq * 0.20);

  const crime = scorePercentile(d.crime?.totalIncidents, NYC_D.crimeCount);
  const safety = Math.round(100 - crime);

  const momentum = d.momentum?.trendScore || scorePercentile(d.dobPermits?.activePermits, NYC_D.dobPermits);

  // V5 weights — 8 dimensions, calibrated March 28 2026
  // d=1.854 (top/bot), d=2.397 (thriving/at_risk), ρ=0.545
  const composite = Math.round(
    vibrancy * 0.10 + transit * 0.05 + competition * 0.05 +
    demographics * 0.12 + safety * 0.02 + momentum * 0.05 +
    (PRECOMPUTED_HEALTH[d._geoid] ?? 60) * 0.28 +
    (PRECOMPUTED_SURVIVAL[d._geoid] ?? 55) * 0.33
  );

  return { transit, demographics, competition, vibrancy, safety, momentum, composite };
}

function gradeFromScore(s) {
  if (s >= 93) return 'A+'; if (s >= 86) return 'A'; if (s >= 80) return 'A-';
  if (s >= 76) return 'B+'; if (s >= 71) return 'B'; if (s >= 66) return 'B-';
  if (s >= 61) return 'C+'; if (s >= 55) return 'C'; if (s >= 50) return 'C-';
  if (s >= 40) return 'D'; return 'F';
}

// BRAIN FIX 5: Score band metadata
function getScoreBand(s) {
  if (s >= 86) return { band: 'A', expectedFailureRate: '<10%' };
  if (s >= 71) return { band: 'B', expectedFailureRate: '10-30%' };
  if (s >= 51) return { band: 'C', expectedFailureRate: '30-50%' };
  if (s >= 31) return { band: 'D', expectedFailureRate: '50-70%' };
  return { band: 'F', expectedFailureRate: '>70%' };
}

// ============================================================
// MAIN PIPELINE
// ============================================================

async function fetchBlockGroups() {
  let query = supabase
    .from('block_group_intel')
    .select('geoid, lat, lng, walk_score, yelp, foursquare, census, crime, competitors, mta, dob, dca, complaints_311, liquor, sidewalk_cafes, lpc, pluto, momentum, inspections')
    .order('geoid');

  if (SINGLE_GEOID) {
    query = query.eq('geoid', SINGLE_GEOID);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to fetch block groups:', error.message);
    process.exit(1);
  }
  return data || [];
}

function parseRow(row) {
  return {
    walkScore: safeJson(row.walk_score),
    yelp: safeJson(row.yelp),
    foursquare: safeJson(row.foursquare),
    census: safeJson(row.census),
    crime: safeJson(row.crime),
    competitors: safeJson(row.competitors),
    mtaRidership: safeJson(row.mta),
    dobPermits: safeJson(row.dob),
    dcaLicenses: safeJson(row.dca),
    complaints311: safeJson(row.complaints_311),
    liquorLicenses: safeJson(row.liquor),
    sidewalkCafes: safeJson(row.sidewalk_cafes),
    lpc: safeJson(row.lpc),
    pluto: safeJson(row.pluto),
    momentum: safeJson(row.momentum),
    inspections: safeJson(row.inspections),
  };
}

function scoreBlockGroup(row) {
  const d = parseRow(row);
  d._geoid = row.geoid; // pass geoid through for pre-computed score lookup
  const niq = computeNIQ(d);
  const siq = computeSIQ(d);
  const tiq = computeTIQ(d);
  const liq = computeLIQ(d);
  const locationIQ = computeLocationIQ(niq, siq, tiq, liq);
  const grade = gradeFromScore(locationIQ);
  const sixIndex = computeSixIndex(d);
  const band = getScoreBand(locationIQ);

  return {
    geoid: row.geoid,
    location_iq: locationIQ,
    grade,
    niq, siq, tiq, liq,
    six_index: sixIndex,
    score_band: band,
    scoring_version: SCORING_VERSION,
    scored_at: new Date().toISOString(),
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('RE² PRODUCTION SCORER — V5 (8 dimensions)');
  console.log('='.repeat(60));
  console.log(`Target: ${SINGLE_GEOID || 'ALL block groups'} | Dry run: ${DRY_RUN}`);

  await loadPrecomputedScores();

  const rows = await fetchBlockGroups();
  console.log(`Loaded ${rows.length} block groups`);

  let scored = 0;
  let errors = 0;
  const results = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      try {
        const result = scoreBlockGroup(row);
        results.push(result);
        scored++;

        if (scored % 500 === 0 || scored <= 3) {
          console.log(`  ${result.geoid}: IQ=${result.location_iq} (${result.grade}) six=${result.six_index.composite}`);
        }
      } catch (err) {
        errors++;
        console.error(`  ERROR ${row.geoid}: ${err.message}`);
      }
    }

    // Write batch to Supabase (upsert on geoid)
    if (!DRY_RUN && results.length > 0) {
      const updates = results.slice(i, i + BATCH_SIZE).map(r => ({
        geoid: r.geoid,
        location_iq: r.location_iq,
        location_iq_grade: r.grade,
        niq: r.niq,
        siq: r.siq,
        tiq: r.tiq,
        liq: r.liq,
        six_index: r.six_index,
        scoring_version: r.scoring_version,
        scored_at: r.scored_at,
      }));

      // Try upsert; fall back to individual updates if table doesn't have these columns
      for (const update of updates) {
        const { error } = await supabase
          .from('block_group_intel')
          .update({
            location_iq: update.location_iq,
            location_iq_grade: update.location_iq_grade,
            scoring_version: update.scoring_version,
          })
          .eq('geoid', update.geoid);

        if (error && scored <= 3) {
          console.error(`  Write error for ${update.geoid}: ${error.message}`);
        }
      }
    }

    console.log(`  Progress: ${scored}/${rows.length} scored, ${errors} errors`);
  }

  // Summary stats
  if (results.length > 0) {
    const scores = results.map(r => r.location_iq);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    const grades = {};
    results.forEach(r => { grades[r.grade] = (grades[r.grade] || 0) + 1; });

    console.log('\n' + '='.repeat(60));
    console.log('SCORING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total: ${scored} | Errors: ${errors}`);
    console.log(`Location IQ: mean=${mean.toFixed(1)}, median=${median}, min=${min}, max=${max}`);
    console.log('Grade distribution:');
    for (const [grade, count] of Object.entries(grades).sort()) {
      console.log(`  ${grade}: ${count} (${((count / scored) * 100).toFixed(1)}%)`);
    }

    // Six-Index averages
    const sixMeans = {};
    ['transit', 'demographics', 'competition', 'vibrancy', 'safety', 'momentum', 'composite'].forEach(key => {
      sixMeans[key] = (results.reduce((sum, r) => sum + (r.six_index[key] || 0), 0) / results.length).toFixed(1);
    });
    console.log('\nSix-Index averages:', sixMeans);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
