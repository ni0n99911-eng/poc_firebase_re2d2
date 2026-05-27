#!/usr/bin/env node
import 'dotenv/config';
/**
 * RE² seed-six-index — Backfill stale six_transit and six_vibrancy sub-scores
 *
 * Problem: The S2 re-run wrote 13,614 location_iq rows but did NOT write
 * six_transit / six_vibrancy sub-scores. These are only computed on live
 * queries, so the dashboard shows 0 for transit/vibrancy for any geoid that
 * wasn't in the original v4 batch.
 *
 * Strategy (in order of data quality):
 *   1. If a geoid already has both six_transit AND six_vibrancy rows → skip.
 *   2. If a geoid has a location_iq_v2 row whose `components` JSON contains
 *      transit / vibrancy breakdown → extract those values directly.
 *   3. Fallback: derive from location_iq composite using a fixed ratio
 *      (transit ≈ composite × 1.06 + 2, vibrancy ≈ composite × 0.94 - 1) with caps.
 *
 * Usage:
 *   node scripts/seed-six-index.mjs              # Dry run — reports gaps
 *   node scripts/seed-six-index.mjs --push       # Write to Supabase
 *   node scripts/seed-six-index.mjs --push --limit 500   # Cap rows for test
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('[ERROR] SUPABASE_URL env var is required. Set it in your .env file.'); process.exit(1); }
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('[ERROR] SUPABASE_SERVICE_ROLE_KEY env var is required.'); process.exit(1); }

const PUSH  = process.argv.includes('--push');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i !== -1 ? parseInt(process.argv[i + 1]) : Infinity;
})();

// ─── Supabase REST helpers ────────────────────────────────────────────────────

async function supa(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function paginate(table, params = '', pageSize = 1000) {
  const all = [];
  let offset = 0;
  while (true) {
    const sep = params ? '&' : '';
    const rows = await supa(table, `${params}${sep}limit=${pageSize}&offset=${offset}`);
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
    if (all.length % 5000 === 0) process.stdout.write(`  ... ${all.length.toLocaleString()} rows\r`);
  }
  return all;
}

async function supaInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`POST ${table}: ${res.status} ${await res.text()}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

/**
 * Derive transit and vibrancy from a location_iq_v2 components object.
 * The v4 batch stored partial decompositions in the components JSON.
 */
function extractFromV2Components(comp) {
  if (!comp || typeof comp !== 'object') return null;
  const t = comp.transit ?? comp.six_transit ?? comp.transitScore ?? null;
  const v = comp.vibrancy ?? comp.six_vibrancy ?? comp.vibrancyScore ?? null;
  if (t != null && v != null) return { transit: clamp(t), vibrancy: clamp(v) };
  return null;
}

/**
 * Derive transit/vibrancy from composite when no decomposition exists.
 * Calibrated on v4 batch distribution (Manhattan avg ~68, outer boroughs ~55).
 */
function deriveFromComposite(compositeScore) {
  const base = Math.max(0, Math.min(100, compositeScore));
  const transit  = clamp(base * 1.06 + 2);   // transit tends to lead composite in NYC
  const vibrancy = clamp(base * 0.94 - 1);   // vibrancy is a lagging signal
  return { transit, vibrancy };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱  RE² seed-six-index  [${PUSH ? 'PUSH MODE' : 'DRY RUN'}]\n`);

  // 1. Load all geoids from the scores table
  console.log('Fetching all geoids with location_iq rows...');
  const liqRows = await paginate('block_group_scores', 'score_type=eq.location_iq&select=geoid,score');
  const geoids = [...new Set(liqRows.map(r => r.geoid))];
  const liqByGeoid = Object.fromEntries(liqRows.map(r => [r.geoid, r.score]));
  console.log(`  ${geoids.length.toLocaleString()} unique geoids with location_iq\n`);

  // 2. Load existing six_transit and six_vibrancy rows
  console.log('Fetching existing six_transit rows...');
  const sixTransitRows = await paginate('block_group_scores', 'score_type=eq.six_transit&select=geoid');
  const hasSixTransit  = new Set(sixTransitRows.map(r => r.geoid));

  console.log('Fetching existing six_vibrancy rows...');
  const sixVibrancyRows = await paginate('block_group_scores', 'score_type=eq.six_vibrancy&select=geoid');
  const hasSixVibrancy  = new Set(sixVibrancyRows.map(r => r.geoid));

  // 3. Identify geoids missing one or both
  const missingTransit  = geoids.filter(g => !hasSixTransit.has(g));
  const missingVibrancy = geoids.filter(g => !hasSixVibrancy.has(g));
  const missingEither   = geoids.filter(g => !hasSixTransit.has(g) || !hasSixVibrancy.has(g));

  console.log(`\n📊  Gap analysis:`);
  console.log(`  Missing six_transit:  ${missingTransit.length.toLocaleString()}`);
  console.log(`  Missing six_vibrancy: ${missingVibrancy.length.toLocaleString()}`);
  console.log(`  Missing either:       ${missingEither.length.toLocaleString()}`);

  if (missingEither.length === 0) {
    console.log('\n✅  Nothing to backfill — all geoids have six_transit and six_vibrancy.');
    return;
  }

  // 4. Load location_iq_v2 components for gap geoids (for extraction strategy)
  console.log('\nFetching location_iq_v2 components for gap geoids...');
  const v2Rows = await paginate('block_group_scores', 'score_type=eq.location_iq_v2&select=geoid,score,components');
  const v2ByGeoid = Object.fromEntries(v2Rows.map(r => [r.geoid, r]));

  // 5. Build rows to write
  const now = new Date().toISOString();
  const newTransitRows  = [];
  const newVibrancyRows = [];
  let strategyV2   = 0;
  let strategyComp = 0;

  const toProcess = missingEither.slice(0, LIMIT);

  for (const geoid of toProcess) {
    const needTransit  = !hasSixTransit.has(geoid);
    const needVibrancy = !hasSixVibrancy.has(geoid);

    const v2 = v2ByGeoid[geoid];
    const extracted = v2 ? extractFromV2Components(v2.components) : null;

    let transit, vibrancy;
    if (extracted) {
      ({ transit, vibrancy } = extracted);
      strategyV2++;
    } else {
      const composite = liqByGeoid[geoid] ?? (v2?.score ?? 50);
      ({ transit, vibrancy } = deriveFromComposite(composite));
      strategyComp++;
    }

    const source = extracted ? 'v2_components_extract' : 'composite_derive';
    const basis  = liqByGeoid[geoid] ?? null;

    if (needTransit)  newTransitRows.push({ geoid, score_type: 'six_transit',  score: transit,  components: { source, basis }, data_sources_used: [], scored_at: now });
    if (needVibrancy) newVibrancyRows.push({ geoid, score_type: 'six_vibrancy', score: vibrancy, components: { source, basis }, data_sources_used: [], scored_at: now });
  }

  console.log(`\n🔢  Rows to write:`);
  console.log(`  six_transit:  ${newTransitRows.length.toLocaleString()} (v2_extract: ${strategyV2}, composite_derive: ${strategyComp})`);
  console.log(`  six_vibrancy: ${newVibrancyRows.length.toLocaleString()}`);

  if (!PUSH) {
    console.log('\n⚠️   DRY RUN — no data written. Rerun with --push to commit.\n');
    const sample = [...newTransitRows.slice(0, 3), ...newVibrancyRows.slice(0, 3)];
    if (sample.length) {
      console.log('Sample rows:');
      sample.forEach(r => console.log(`  ${r.geoid}  ${r.score_type}=${r.score}  [${r.components?.source}]`));
    }
    return;
  }

  // 6. Write in batches of 500
  const BATCH = 500;
  let written = 0;
  const allRows = [...newTransitRows, ...newVibrancyRows];
  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH);
    await supaInsert('block_group_scores', batch);
    written += batch.length;
    process.stdout.write(`  Writing... ${written.toLocaleString()} / ${allRows.length.toLocaleString()}\r`);
  }

  console.log(`\n✅  Done. Wrote ${written.toLocaleString()} rows (${newTransitRows.length} six_transit + ${newVibrancyRows.length} six_vibrancy).\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
