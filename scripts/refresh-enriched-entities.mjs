#!/usr/bin/env node
/**
 * F-20: Refresh enriched_entities that have exceeded their TTL.
 *
 * DOHMH inspections update monthly. DCA licenses update weekly.
 * This script finds stale entities (fetched_at > TTL) and refreshes
 * them from NYC Open Data Socrata APIs.
 *
 * TTL: 14 days (same as ENTITY_TTL_MS in entity-refresh.ts)
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/refresh-enriched-entities.mjs
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/refresh-enriched-entities.mjs --dry-run
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/refresh-enriched-entities.mjs --limit 100
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '500');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const TTL_DAYS = 14;
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Socrata endpoints ──────────────────────────────────────────────
const DOHMH_BASE = 'https://data.cityofnewyork.us/resource/43nn-pn8j.json';
const DCA_BASE = 'https://data.cityofnewyork.us/resource/w7w3-xahh.json';

// ─── Supabase helpers ───────────────────────────────────────────────
async function fetchAll(query) {
  let all = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${query}&limit=${pageSize}&offset=${offset}`;
    const resp = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
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

async function upsertEntity(entity) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/enriched_entities?on_conflict=location_key,entity_category`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([entity]),
  });
  if (!resp.ok) throw new Error(`Upsert failed: ${resp.status} ${await resp.text()}`);
}

// ─── Find stale entities ────────────────────────────────────────────
async function findStaleEntities() {
  const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 3600 * 1000).toISOString();

  // Entities with fetched_at older than TTL, or with needs_refresh flag
  const stale = await fetchAll(
    `enriched_entities?or=(fetched_at.lt.${cutoff},needs_refresh.eq.true)` +
    `&select=id,location_key,entity_category,entity_data,fetched_at` +
    `&order=fetched_at.asc`
  );

  return stale.slice(0, LIMIT);
}

// ─── Refresh from Socrata ───────────────────────────────────────────
async function refreshDohmh(locationKey) {
  // locationKey is typically a camis (DOHMH business ID) or geoid
  // For DOHMH, query by camis if numeric, otherwise by zipcode
  const isNumeric = /^\d+$/.test(locationKey);
  const query = isNumeric
    ? `${DOHMH_BASE}?camis=${locationKey}&$order=inspection_date DESC&$limit=20`
    : `${DOHMH_BASE}?zipcode=${locationKey}&$limit=50&$order=inspection_date DESC`;

  try {
    const resp = await fetch(query);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || data.length === 0) return null;

    return {
      inspections: data,
      latest_grade: data[0]?.grade || null,
      inspection_count: data.length,
      refreshed_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`  [DOHMH] Failed for ${locationKey}:`, err.message);
    return null;
  }
}

async function refreshDca(locationKey) {
  const query = `${DCA_BASE}?license_nbr=${locationKey}&$limit=10`;

  try {
    const resp = await fetch(query);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || data.length === 0) return null;

    return {
      licenses: data,
      license_count: data.length,
      latest_status: data[0]?.license_status || null,
      refreshed_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`  [DCA] Failed for ${locationKey}:`, err.message);
    return null;
  }
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log(`=== F-20: Enriched Entities Refresh ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  const stale = await findStaleEntities();
  console.log(`  Found ${stale.length} stale entities (limit: ${LIMIT})\n`);

  if (stale.length === 0) {
    console.log('Nothing to refresh.');
    return;
  }

  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < stale.length; i++) {
    const entity = stale[i];
    const { location_key, entity_category } = entity;

    if (DRY_RUN) {
      console.log(`  [DRY] Would refresh ${entity_category}:${location_key}`);
      skipped++;
      continue;
    }

    let newData = null;
    if (entity_category === 'dohmh') {
      newData = await refreshDohmh(location_key);
    } else if (entity_category === 'dca') {
      newData = await refreshDca(location_key);
    } else {
      console.log(`  [SKIP] Unknown category: ${entity_category}`);
      skipped++;
      continue;
    }

    if (newData) {
      await upsertEntity({
        location_key,
        entity_category,
        entity_data: newData,
        fetched_at: new Date().toISOString(),
        needs_refresh: false,
      });
      refreshed++;
    } else {
      // Keep existing data, just update timestamp to avoid re-querying
      await upsertEntity({
        location_key,
        entity_category,
        entity_data: entity.entity_data,
        fetched_at: new Date().toISOString(),
        needs_refresh: false,
      });
      failed++;
    }

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`  ${i + 1}/${stale.length} processed\r`);
    }
    if ((i + 1) % BATCH_SIZE === 0) await sleep(BATCH_DELAY_MS);
  }

  console.log(`\n\n=== Summary ===`);
  console.log(`  Refreshed: ${refreshed}`);
  console.log(`  Failed (kept old data): ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total processed: ${stale.length}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
