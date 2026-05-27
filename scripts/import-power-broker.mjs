/**
 * import-power-broker.mjs
 * BRAIN-PB-01: Import Power Broker reference dataset into Supabase
 * Source: power_broker_reference_dataset.json (15 entries, PB-001 through PB-015)
 *
 * Usage:
 *   node scripts/import-power-broker.mjs
 *   node scripts/import-power-broker.mjs --dry-run
 *
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDryRun = process.argv.includes('--dry-run');

// Load env
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Load dataset from JSON if available, otherwise use hardcoded data from migration
const datasetPath = join(__dirname, '../data-sources/power_broker_reference_dataset.json');
let dataset;

if (existsSync(datasetPath)) {
  console.log('📂 Loading from:', datasetPath);
  dataset = JSON.parse(readFileSync(datasetPath, 'utf8'));
} else {
  console.log('📂 Dataset file not found — using migration seed data as source of truth');
  console.log('   Run migration 023 via Supabase SQL editor instead.');
  console.log('   File: supabase/migrations/023-historical-ground-truths.sql');
  process.exit(0);
}

/**
 * Transform raw dataset entry into Supabase row format.
 * Expects dataset entries with fields: id, neighborhood, geohash_prefix,
 * infrastructure, year_range, impact_type, description, current_relevance,
 * scoring_notes
 */
function transformEntry(entry) {
  return {
    id: entry.id,
    neighborhood: entry.neighborhood,
    geohash_prefix: Array.isArray(entry.geohash_prefix)
      ? entry.geohash_prefix
      : [entry.geohash_prefix],
    infrastructure: entry.infrastructure,
    year_range: entry.year_range || null,
    impact_type: entry.impact_type,
    description: entry.description || null,
    current_relevance: entry.current_relevance || null,
    scoring_notes: entry.scoring_notes || null,
    source: 'power_broker',
    active: true,
  };
}

async function main() {
  console.log(`\n🧠 Power Broker Import — ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(50));

  const entries = Array.isArray(dataset) ? dataset : dataset.entries || [];
  console.log(`📊 Dataset entries: ${entries.length}`);

  if (isDryRun) {
    for (const entry of entries) {
      const row = transformEntry(entry);
      console.log(`  ✓ ${row.id}: ${row.neighborhood} (${row.impact_type})`);
      console.log(`    geohash: ${row.geohash_prefix.join(', ')}`);
    }
    console.log('\n✅ Dry run complete — no data written');
    return;
  }

  // Upsert all entries
  const rows = entries.map(transformEntry);
  const { data, error } = await supabase
    .from('historical_ground_truths')
    .upsert(rows, { onConflict: 'id' })
    .select('id, neighborhood');

  if (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }

  console.log(`\n✅ Imported ${data?.length || 0} entries:`);
  for (const row of (data || [])) {
    console.log(`  ✓ ${row.id}: ${row.neighborhood}`);
  }

  // Verify count
  const { count } = await supabase
    .from('historical_ground_truths')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);

  console.log(`\n📊 Total active records: ${count}`);
  if (count !== 15) {
    console.warn(`⚠️  Expected 15, got ${count} — check for duplicates or missing entries`);
  } else {
    console.log('✅ Verification passed: 15 active Power Broker entries');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
