#!/usr/bin/env node
/**
 * F-07: Remove deprecated score types from block_group_scores.
 *
 * Deletes rows with score_type values that are no longer produced by the
 * V4 batch scorer and are not consumed by any active pipeline:
 *   - location_iq_v1
 *   - six_neighborhood_health
 *   - six_survival_rate
 *   - six_commercial_density
 *   - halo:*  (prefix match)
 *
 * Safe to run multiple times (idempotent — deletes are by score_type).
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/cleanup-dead-scores.mjs
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/cleanup-dead-scores.mjs --dry-run
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const DEPRECATED_EXACT = [
  'location_iq_v1',
  'six_neighborhood_health',
  'six_survival_rate',
  'six_commercial_density',
];

const DEPRECATED_PREFIXES = ['halo:'];

async function countRows(query) {
  const url = `${SUPABASE_URL}/rest/v1/${query}`;
  const resp = await fetch(url, {
    method: 'HEAD',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact',
    },
  });
  const range = resp.headers.get('content-range');
  if (!range) return 0;
  const match = range.match(/\/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function deleteRows(filter) {
  const url = `${SUPABASE_URL}/rest/v1/block_group_scores?${filter}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal',
    },
  });
  if (!resp.ok) throw new Error(`Delete failed: ${resp.status} ${await resp.text()}`);
}

async function main() {
  console.log(`=== F-07: Dead Score Cleanup ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  let totalDeleted = 0;

  // 1. Exact match deprecated types
  for (const scoreType of DEPRECATED_EXACT) {
    const count = await countRows(`block_group_scores?score_type=eq.${scoreType}&select=geoid`);
    console.log(`  ${scoreType}: ${count} rows`);

    if (count > 0 && !DRY_RUN) {
      await deleteRows(`score_type=eq.${scoreType}`);
      console.log(`    → Deleted`);
    }
    totalDeleted += count;
  }

  // 2. Prefix match deprecated types
  for (const prefix of DEPRECATED_PREFIXES) {
    const count = await countRows(`block_group_scores?score_type=like.${encodeURIComponent(prefix + '*')}&select=geoid`);
    console.log(`  ${prefix}* (prefix): ${count} rows`);

    if (count > 0 && !DRY_RUN) {
      await deleteRows(`score_type=like.${encodeURIComponent(prefix + '*')}`);
      console.log(`    → Deleted`);
    }
    totalDeleted += count;
  }

  console.log(`\nTotal: ${totalDeleted} rows ${DRY_RUN ? 'would be' : ''} deleted.`);
  if (DRY_RUN) console.log('Re-run without --dry-run to execute.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
