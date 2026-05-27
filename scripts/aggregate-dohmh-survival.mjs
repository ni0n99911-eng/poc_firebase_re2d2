#!/usr/bin/env node
/**
 * DOHMH Survival Rate Aggregation Script — BL-A1
 *
 * Groups ~22K DOHMH-inspected businesses by census block group (geoid) and
 * computes food_survival_rate: the fraction of businesses that have maintained
 * grade A/B over 3+ consecutive inspections.
 *
 * "Survived" definition:
 *   - dohmh_consecutive_a >= 3 (three or more consecutive A grades), OR
 *   - dohmh_latest_grade IN ('A','B') AND dohmh_a_pct >= 0.80
 *     (strong overall A-grade consistency with a current passing grade)
 *
 * Outputs:
 *   - block_group_survival: one row per geoid (upsert)
 *   - borough_survival_medians: one row per borough (upsert)
 *
 * Idempotent — safe to re-run. Upserts on geoid / borough.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/aggregate-dohmh-survival.mjs
 *
 * Prereqs:
 *   - Migration 029-block-group-survival.sql applied
 *   - businesses table populated with DOHMH records (load-businesses.mjs + proxy-score-dohmh.mjs)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const BATCH_SIZE = 200;
const BATCH_DELAY_MS = 300;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── NYC Borough → FIPS county codes (for geoid prefix mapping) ─────
const BOROUGH_BY_COUNTY_FIPS = {
  '36061': 'Manhattan',
  '36047': 'Brooklyn',
  '36081': 'Queens',
  '36005': 'Bronx',
  '36085': 'Staten Island',
};

function geoidToBorough(geoid) {
  if (!geoid || geoid.length < 5) return 'Unknown';
  const countyFips = geoid.substring(0, 5);
  return BOROUGH_BY_COUNTY_FIPS[countyFips] || 'Unknown';
}

// ─── Supabase REST helpers ──────────────────────────────────────────

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

async function upsertBatch(table, rows, conflictCol) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictCol}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) throw new Error(`Upsert to ${table} failed: ${resp.status} ${await resp.text()}`);
}

// ─── Survival classification ────────────────────────────────────────

function isSurvivor(biz) {
  const consA = biz.dohmh_consecutive_a ?? 0;
  const aPct = biz.dohmh_a_pct ?? 0;
  const grade = biz.dohmh_latest_grade ?? '';

  // Primary: 3+ consecutive A grades
  if (consA >= 3) return true;

  // Secondary: strong A consistency + currently passing
  if ((grade === 'A' || grade === 'B') && aPct >= 0.80) return true;

  return false;
}

function confidenceLevel(sampleSize) {
  if (sampleSize >= 10) return 'HIGH';
  if (sampleSize >= 4) return 'MEDIUM';
  if (sampleSize >= 1) return 'LOW';
  return 'NONE';
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('=== DOHMH Survival Rate Aggregation ===\n');

  // 1. Fetch all DOHMH businesses with grade data and a geoid
  console.log('Fetching DOHMH businesses with grade data...');
  const businesses = await fetchAll(
    'businesses?source=eq.DOHMH&dohmh_latest_grade=not.is.null' +
    '&geoid=not.is.null' +
    '&select=id,geoid,borough,dohmh_latest_grade,dohmh_a_pct,dohmh_consecutive_a'
  );
  console.log(`  Fetched ${businesses.length} DOHMH businesses with grades + geoid\n`);

  if (businesses.length === 0) {
    console.error('No DOHMH businesses found — is the businesses table populated?');
    process.exit(1);
  }

  // 2. Group by geoid
  const byGeoid = new Map();
  for (const biz of businesses) {
    if (!biz.geoid) continue;
    if (!byGeoid.has(biz.geoid)) byGeoid.set(biz.geoid, []);
    byGeoid.get(biz.geoid).push(biz);
  }
  console.log(`  ${byGeoid.size} unique block groups with DOHMH data\n`);

  // 3. Compute survival rate per block group
  const blockGroupRows = [];
  for (const [geoid, bizList] of byGeoid) {
    const survivors = bizList.filter(isSurvivor).length;
    const total = bizList.length;
    const rate = total > 0 ? survivors / total : 0;

    blockGroupRows.push({
      geoid,
      food_survival_rate: Math.round(rate * 10000) / 10000,  // 4 decimal places
      sample_size: total,
      confidence: confidenceLevel(total),
      last_updated: new Date().toISOString(),
    });
  }

  // 4. Upsert block_group_survival
  console.log(`Upserting ${blockGroupRows.length} block group survival rows...`);
  for (let i = 0; i < blockGroupRows.length; i += BATCH_SIZE) {
    const batch = blockGroupRows.slice(i, i + BATCH_SIZE);
    await upsertBatch('block_group_survival', batch, 'geoid');
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, blockGroupRows.length)} / ${blockGroupRows.length}\r`);
    if (i + BATCH_SIZE < blockGroupRows.length) await sleep(BATCH_DELAY_MS);
  }
  console.log(`\n  Done: ${blockGroupRows.length} block groups written\n`);

  // 5. Compute borough medians
  console.log('Computing borough median survival rates...');
  const byBorough = new Map();
  for (const row of blockGroupRows) {
    const borough = geoidToBorough(row.geoid);
    if (borough === 'Unknown') continue;
    if (!byBorough.has(borough)) byBorough.set(borough, []);
    byBorough.get(borough).push(row.food_survival_rate);
  }

  const boroughRows = [];
  for (const [borough, rates] of byBorough) {
    rates.sort((a, b) => a - b);
    const mid = Math.floor(rates.length / 2);
    const median = rates.length % 2 === 0
      ? (rates[mid - 1] + rates[mid]) / 2
      : rates[mid];

    boroughRows.push({
      borough,
      median_survival_rate: Math.round(median * 10000) / 10000,
      block_groups_counted: rates.length,
      last_updated: new Date().toISOString(),
    });

    console.log(`  ${borough}: median ${(median * 100).toFixed(1)}% (${rates.length} block groups)`);
  }

  // 6. Upsert borough_survival_medians
  console.log(`\nUpserting ${boroughRows.length} borough median rows...`);
  await upsertBatch('borough_survival_medians', boroughRows, 'borough');
  console.log('  Done\n');

  // 7. Summary stats
  const allRates = blockGroupRows.map(r => r.food_survival_rate).sort((a, b) => a - b);
  const globalMedian = allRates[Math.floor(allRates.length / 2)];
  const highConf = blockGroupRows.filter(r => r.confidence === 'HIGH').length;
  const medConf = blockGroupRows.filter(r => r.confidence === 'MEDIUM').length;
  const lowConf = blockGroupRows.filter(r => r.confidence === 'LOW').length;

  console.log('=== Summary ===');
  console.log(`  Total businesses processed: ${businesses.length}`);
  console.log(`  Total block groups: ${blockGroupRows.length}`);
  console.log(`  Global median survival rate: ${(globalMedian * 100).toFixed(1)}%`);
  console.log(`  Confidence distribution: HIGH=${highConf}, MEDIUM=${medConf}, LOW=${lowConf}`);
  console.log(`  Borough medians computed: ${boroughRows.length}`);
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
