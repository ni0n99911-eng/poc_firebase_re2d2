#!/usr/bin/env node
/**
 * F-18: Refresh concept distribution stats from block_group_scores
 *
 * Queries Supabase for Fit IQ scores (fit_score:*) grouped by concept type,
 * computes distribution stats per concept and per borough, and writes the
 * results to a `concept_distribution_stats` table.
 *
 * These stats feed into dynamic-concept-config.ts for calibration and
 * BOROUGH_CONFIG weights in score-all-v4.mjs.
 *
 * Idempotent — upserts on concept + borough.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/refresh-concept-distribution.mjs
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── NYC Borough → FIPS county codes ────────────────────────────────
const BOROUGH_BY_COUNTY_FIPS = {
  '36061': 'Manhattan',
  '36047': 'Brooklyn',
  '36081': 'Queens',
  '36005': 'Bronx',
  '36085': 'Staten Island',
};

function geoidToBorough(geoid) {
  if (!geoid || geoid.length < 5) return 'Unknown';
  return BOROUGH_BY_COUNTY_FIPS[geoid.substring(0, 5)] || 'Unknown';
}

// ─── Supabase helpers ───────────────────────────────────────────────
async function fetchAll(query) {
  let all = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${query}&limit=${pageSize}&offset=${offset}`;
    const resp = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status} ${await resp.text()}`);
    const rows = await resp.json();
    all = all.concat(rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
    await sleep(100);
  }
  return all;
}

async function upsertBatch(rows) {
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/concept_distribution_stats?on_conflict=concept,borough`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!resp.ok) {
      const text = await resp.text();
      // If table doesn't exist yet, provide helpful message
      if (text.includes('relation') && text.includes('does not exist')) {
        console.error('\n⚠️  Table concept_distribution_stats does not exist.');
        console.error('   Run the migration first: supabase/migrations/030-concept-distribution-stats.sql\n');
        process.exit(1);
      }
      throw new Error(`Upsert failed: ${resp.status} ${text}`);
    }
    if (i + BATCH < rows.length) await sleep(300);
  }
}

// ─── Stats helpers ──────────────────────────────────────────────────
function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function stddev(arr, mean) {
  const sumSqDiff = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
  return Math.sqrt(sumSqDiff / arr.length);
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('=== F-18: Concept Distribution Stats Refresh ===\n');

  // 1. Fetch all fit_score rows
  console.log('Fetching fit_score rows from block_group_scores...');
  const rows = await fetchAll(
    'block_group_scores?score_type=like.fit_score*&select=geoid,score_type,score'
  );
  console.log(`  Fetched ${rows.length} fit_score rows\n`);

  if (rows.length === 0) {
    console.warn('No fit_score rows found. Is the batch scorer run complete?');
    process.exit(0);
  }

  // 2. Parse concept from score_type (fit_score:specialty_coffee → specialty_coffee)
  const byConcept = new Map();
  for (const row of rows) {
    const parts = row.score_type.split(':');
    const concept = parts.length > 1 ? parts.slice(1).join(':') : 'unknown';
    const borough = geoidToBorough(row.geoid);
    const key = `${concept}::${borough}`;

    if (!byConcept.has(key)) byConcept.set(key, { concept, borough, scores: [] });
    byConcept.get(key).scores.push(row.score);
  }

  // 3. Also compute citywide stats
  const citywideByConcept = new Map();
  for (const row of rows) {
    const parts = row.score_type.split(':');
    const concept = parts.length > 1 ? parts.slice(1).join(':') : 'unknown';
    if (!citywideByConcept.has(concept)) citywideByConcept.set(concept, []);
    citywideByConcept.get(concept).push(row.score);
  }

  // 4. Build stats rows
  const statsRows = [];
  const now = new Date().toISOString();

  // Per-concept-per-borough
  for (const [, data] of byConcept) {
    const { concept, borough, scores } = data;
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    statsRows.push({
      concept,
      borough,
      count: scores.length,
      mean_score: Math.round(mean * 100) / 100,
      median_score: Math.round(median(scores) * 100) / 100,
      stddev: Math.round(stddev(scores, mean) * 100) / 100,
      p25: Math.round(percentile(scores, 25) * 100) / 100,
      p75: Math.round(percentile(scores, 75) * 100) / 100,
      min_score: Math.min(...scores),
      max_score: Math.max(...scores),
      last_updated: now,
    });
  }

  // Citywide (borough = 'ALL')
  for (const [concept, scores] of citywideByConcept) {
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    statsRows.push({
      concept,
      borough: 'ALL',
      count: scores.length,
      mean_score: Math.round(mean * 100) / 100,
      median_score: Math.round(median(scores) * 100) / 100,
      stddev: Math.round(stddev(scores, mean) * 100) / 100,
      p25: Math.round(percentile(scores, 25) * 100) / 100,
      p75: Math.round(percentile(scores, 75) * 100) / 100,
      min_score: Math.min(...scores),
      max_score: Math.max(...scores),
      last_updated: now,
    });
  }

  // 5. Upsert
  console.log(`Upserting ${statsRows.length} distribution stats rows...`);
  await upsertBatch(statsRows);

  // 6. Summary
  console.log('\n=== Summary ===');
  const concepts = [...citywideByConcept.keys()].sort();
  for (const c of concepts) {
    const scores = citywideByConcept.get(c);
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    console.log(`  ${c}: ${scores.length} block groups, mean=${mean.toFixed(1)}, median=${median(scores).toFixed(1)}`);
  }
  console.log(`\nTotal: ${statsRows.length} rows written across ${concepts.length} concepts.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
