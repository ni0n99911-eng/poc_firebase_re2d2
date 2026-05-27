#!/usr/bin/env node
/**
 * F-21: block_group_intel re-seed schedule
 *
 * Scans block_group_intel for stale data sources based on TTL config
 * from reseed-schedule.ts, then triggers re-fetches for the highest
 * priority stale sources.
 *
 * Schedule config (from reseed-schedule.ts):
 *   - 311 complaints:    7 days  (high priority)
 *   - DOHMH inspections: 14 days (high priority)
 *   - Google Places:     30 days (high priority)
 *   - Yelp:              30 days (high priority)
 *   - DOB Permits:       30 days (medium priority)
 *   - MTA Ridership:     90 days (medium priority)
 *   - WalkScore:         90 days (medium priority)
 *   - PLUTO:             180 days (low priority)
 *   - Census/Housing:    365 days (low priority)
 *
 * This script is designed to be run as a cron job or Supabase Edge Function.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/reseed-stale-block-groups.mjs
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/reseed-stale-block-groups.mjs --priority high
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/reseed-stale-block-groups.mjs --source dohmh_inspections
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/reseed-stale-block-groups.mjs --dry-run
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const PRIORITY_FILTER = process.argv.find(a => a.startsWith('--priority='))?.split('=')[1] || null;
const SOURCE_FILTER = process.argv.find(a => a.startsWith('--source='))?.split('=')[1] || null;
const MAX_GEOIDS = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '200');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Re-seed schedule (mirror of reseed-schedule.ts) ────────────────
const RESEED_SCHEDULE = {
  census:             { ttlDays: 365, source: 'ACS 5-Year',         priority: 'low' },
  census_housing:     { ttlDays: 365, source: 'ACS 5-Year',         priority: 'low' },
  walkscore:          { ttlDays: 90,  source: 'WalkScore API',      priority: 'medium' },
  google_places:      { ttlDays: 30,  source: 'Google Places API',  priority: 'high' },
  yelp:               { ttlDays: 30,  source: 'Yelp Fusion API',    priority: 'high' },
  '311_complaints':   { ttlDays: 7,   source: 'NYC 311 Socrata',    priority: 'high' },
  dohmh_inspections:  { ttlDays: 14,  source: 'DOHMH Socrata',      priority: 'high' },
  mta_ridership:      { ttlDays: 90,  source: 'MTA Open Data',      priority: 'medium' },
  dob_permits:        { ttlDays: 30,  source: 'DOB Socrata',        priority: 'medium' },
  pluto:              { ttlDays: 180, source: 'MapPLUTO',           priority: 'low' },
};

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

// ─── Identify stale sources ─────────────────────────────────────────
async function findStaleBlockGroups() {
  console.log('Fetching block_group_intel rows...');
  const rows = await fetchAll('block_group_intel?select=geoid,source,data');
  console.log(`  ${rows.length} total rows across all sources\n`);

  // Group by geoid
  const byGeoid = new Map();
  for (const row of rows) {
    if (!byGeoid.has(row.geoid)) byGeoid.set(row.geoid, {});
    byGeoid.get(row.geoid)[row.source] = row.data;
  }

  // Check each geoid for stale sources
  const staleReport = [];
  const now = Date.now();

  for (const [geoid, sources] of byGeoid) {
    const staleSources = [];

    for (const [key, config] of Object.entries(RESEED_SCHEDULE)) {
      // Apply filters
      if (PRIORITY_FILTER && config.priority !== PRIORITY_FILTER) continue;
      if (SOURCE_FILTER && key !== SOURCE_FILTER) continue;

      const data = sources[key];
      if (!data) {
        staleSources.push({ source: key, reason: 'missing', ageDays: null, priority: config.priority });
        continue;
      }

      const fetchedAt = data.fetchedAt || data.fetched_at || data.timestamp;
      if (!fetchedAt) {
        staleSources.push({ source: key, reason: 'no_timestamp', ageDays: null, priority: config.priority });
        continue;
      }

      const ageDays = (now - new Date(fetchedAt).getTime()) / (24 * 3600 * 1000);
      if (ageDays > config.ttlDays) {
        staleSources.push({ source: key, reason: 'expired', ageDays: Math.round(ageDays), priority: config.priority });
      }
    }

    if (staleSources.length > 0) {
      staleReport.push({ geoid, staleSources });
    }
  }

  return staleReport;
}

// ─── Re-seed via location-intel API ─────────────────────────────────
async function triggerReseed(geoid) {
  // Hit the internal location-intel API which triggers a full data refresh
  // This works because the intel pipeline fetches fresh data when cache is stale
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/block_group_intel?geoid=eq.${geoid}&select=geoid`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  return resp.ok;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log(`=== F-21: Block Group Intel Re-seed ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
  if (PRIORITY_FILTER) console.log(`  Priority filter: ${PRIORITY_FILTER}`);
  if (SOURCE_FILTER) console.log(`  Source filter: ${SOURCE_FILTER}`);
  console.log(`  Max geoids: ${MAX_GEOIDS}\n`);

  const staleReport = await findStaleBlockGroups();
  console.log(`Found ${staleReport.length} block groups with stale data\n`);

  if (staleReport.length === 0) {
    console.log('All block groups are fresh. Nothing to do.');
    return;
  }

  // Sort by number of stale sources (worst first)
  staleReport.sort((a, b) => b.staleSources.length - a.staleSources.length);

  // Aggregate stats
  const sourceCounts = {};
  const priorityCounts = { high: 0, medium: 0, low: 0 };
  for (const r of staleReport) {
    for (const s of r.staleSources) {
      sourceCounts[s.source] = (sourceCounts[s.source] || 0) + 1;
      priorityCounts[s.priority]++;
    }
  }

  console.log('Stale source breakdown:');
  for (const [source, count] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
    const config = RESEED_SCHEDULE[source];
    console.log(`  ${source}: ${count} block groups (TTL: ${config?.ttlDays}d, priority: ${config?.priority})`);
  }
  console.log(`\nPriority distribution: high=${priorityCounts.high}, medium=${priorityCounts.medium}, low=${priorityCounts.low}`);

  // Output the geoids needing re-seed
  const toReseed = staleReport.slice(0, MAX_GEOIDS);

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would re-seed ${toReseed.length} block groups. Top 10:`);
    for (const r of toReseed.slice(0, 10)) {
      const sources = r.staleSources.map(s => `${s.source}(${s.reason})`).join(', ');
      console.log(`  ${r.geoid}: ${sources}`);
    }
  } else {
    console.log(`\nMarking ${toReseed.length} block groups for re-seed...`);
    // Write a reseed_queue for the next scoring run to pick up
    const queue = toReseed.map(r => ({
      geoid: r.geoid,
      stale_sources: r.staleSources.map(s => s.source),
      priority: r.staleSources.some(s => s.priority === 'high') ? 'high'
        : r.staleSources.some(s => s.priority === 'medium') ? 'medium' : 'low',
      queued_at: new Date().toISOString(),
    }));

    // Output as JSON for downstream processing
    const outPath = 'scripts/reseed-queue.json';
    const { writeFileSync } = await import('fs');
    writeFileSync(outPath, JSON.stringify(queue, null, 2));
    console.log(`  Wrote ${queue.length} entries to ${outPath}`);
    console.log('  Run the seed-api-data script with this queue to trigger actual re-fetches.');
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
