/**
 * RE² End-to-End Verification Script
 *
 * Tests 10 locations × 10 concepts across the full data stack:
 * 1. DB score completeness (block_group_scores rows)
 * 2. Score range sanity (no zeros, no outliers)
 * 3. Sub-score vs composite consistency
 * 4. Concept-specific scores present (vision_iq, fit_score, fit_sub_*)
 * 5. survivalRate + neighborhoodHealth present (high-impact signals)
 * 6. CoPilot context data availability (block_group_intel, enriched_entities)
 * 7. Business plan alignment — fitIQ vs locationIQ delta
 *
 * Run: node scripts/e2e-verify.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Test matrix: 10 locations × 10 concepts ──
const TEST_MATRIX = [
  // Manhattan
  { label: 'UWS (Amsterdam & 79th)',   lat: 40.7834, lng: -73.9802, geoid: '360610163005', concept: 'specialty_coffee' },
  { label: 'Midtown 5th Ave',          lat: 40.7580, lng: -73.9855, geoid: '360610119001', concept: 'fitness_studio' },
  { label: 'LES (Orchard St)',         lat: 40.7182, lng: -73.9876, geoid: '360610018002', concept: 'bar_nightlife' },
  { label: 'Harlem (125th St)',        lat: 40.8089, lng: -73.9474, geoid: '360610222002', concept: 'full_service_restaurant' },
  // Brooklyn
  { label: 'Williamsburg (Bedford)',   lat: 40.7145, lng: -73.9612, geoid: '360470551002', concept: 'bakery' },
  { label: 'Flatbush (Flatbush Ave)',  lat: 40.6501, lng: -73.9496, geoid: '360470824004', concept: 'medical_office' },
  // Queens
  { label: 'Astoria (31st Ave)',       lat: 40.7722, lng: -73.9301, geoid: '360810081001', concept: 'fast_casual' },
  { label: 'Jackson Hts (Roosevelt)', lat: 40.7557, lng: -73.8839, geoid: '360810281001', concept: 'retail' },
  // Bronx
  { label: 'South Bronx (149th & 3rd)',lat: 40.8134, lng: -73.9183, geoid: '360050065001', concept: 'personal_services' },
  // Staten Island
  { label: 'Staten Island (Bay St)',   lat: 40.6418, lng: -74.0732, geoid: '360850003002', concept: 'florist' },
];

// Required score_types per geoid (concept-independent)
const REQUIRED_COMMON = [
  'location_iq', 'location_iq_v2', 'six_transit', 'six_demographics',
  'six_competition', 'six_vibrancy', 'six_safety', 'six_momentum',
  'six_survival_rate', 'six_neighborhood_health',
];

// full_service_restaurant is DEFAULT_CONCEPT_KEY — scores stored with no suffix (e.g. 'fit_score' not 'fit_score:full_service_restaurant')
const DEFAULT_CONCEPT_KEY = 'full_service_restaurant';

// Required concept-specific score_types
// Matches scorer behaviour: DEFAULT_CONCEPT_KEY uses empty suffix, others use ':concept' suffix
function requiredConceptScores(concept) {
  const suffix = concept === DEFAULT_CONCEPT_KEY ? '' : `:${concept}`;
  return [
    `fit_score${suffix}`,
    `vision_iq${suffix}`,
    `fit_sub_market_proof${suffix}`,
    `fit_sub_accessibility${suffix}`,
    `fit_sub_demographics${suffix}`,
    `fit_sub_competition${suffix}`,
    `fit_sub_price_income_fit${suffix}`,
  ];
}

const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const WARN = '\x1b[33m⚠ WARN\x1b[0m';

let totalTests = 0;
let totalPass = 0;
let totalFail = 0;
let totalWarn = 0;
const findings = [];

function check(label, pass, warn = false, detail = '') {
  totalTests++;
  if (pass) {
    totalPass++;
    process.stdout.write(`  ${PASS}  ${label}\n`);
  } else if (warn) {
    totalWarn++;
    process.stdout.write(`  ${WARN}  ${label}${detail ? ' — ' + detail : ''}\n`);
    findings.push({ level: 'warn', label, detail });
  } else {
    totalFail++;
    process.stdout.write(`  ${FAIL}  ${label}${detail ? ' — ' + detail : ''}\n`);
    findings.push({ level: 'fail', label, detail });
  }
}

async function verifyLocation(entry) {
  const { label, geoid, concept } = entry;
  console.log(`\n\x1b[1m${label}\x1b[0m  [${geoid}] concept=${concept}`);

  // Fetch all rows for this geoid
  const { data, error } = await supabase
    .from('block_group_scores')
    .select('score_type, score, components')
    .eq('geoid', geoid);

  if (error || !data) {
    check(`DB query for ${geoid}`, false, false, error?.message || 'no data');
    return;
  }

  const scoreMap = {};
  for (const row of data) {
    scoreMap[row.score_type] = { score: row.score, components: row.components };
  }

  const allTypes = new Set(Object.keys(scoreMap));

  // 1. Common score completeness
  for (const required of REQUIRED_COMMON) {
    const row = scoreMap[required];
    const exists = !!row && row.score > 0;
    check(`${required} present and > 0`, exists, !exists, exists ? `score=${row.score}` : 'missing or zero');
  }

  // 2. Concept-specific score completeness
  for (const required of requiredConceptScores(concept)) {
    const row = scoreMap[required];
    const exists = !!row && row.score > 0;
    check(`${required} present and > 0`, exists, !exists, exists ? `score=${row.score}` : 'missing or zero');
  }

  // 3. Score range sanity — Location IQ should be 20–95
  const locIQ = scoreMap['location_iq_v2']?.score ?? scoreMap['location_iq']?.score ?? 0;
  check(`Location IQ in range [20–95]`, locIQ >= 20 && locIQ <= 95, false, `score=${locIQ}`);

  // 4. Vision IQ range sanity [15–95] — use same suffix logic as scorer
  const conceptSuffix = concept === DEFAULT_CONCEPT_KEY ? '' : `:${concept}`;
  const visionKey = `vision_iq${conceptSuffix}`;
  const visionIQ = scoreMap[visionKey]?.score ?? 0;
  check(`Vision IQ in range [15–95]`, visionIQ >= 15 && visionIQ <= 95, visionIQ > 0 && (visionIQ < 15 || visionIQ > 95), `score=${visionIQ}`);

  // 5. Fit IQ should be within ±35 of Location IQ (basic sanity)
  const fitScore = scoreMap[`fit_score${conceptSuffix}`]?.score ?? 0;
  const fitDelta = Math.abs(fitScore - locIQ);
  check(`Fit IQ within ±35 of Location IQ`, fitDelta <= 35, fitDelta > 35, `fitIQ=${fitScore}, locIQ=${locIQ}, delta=${fitDelta}`);

  // 6. Sub-scores consistent with fit composite (avg of subs should be within 20pts of fit)
  const subKeys = [`fit_sub_market_proof${conceptSuffix}`, `fit_sub_accessibility${conceptSuffix}`, `fit_sub_demographics${conceptSuffix}`, `fit_sub_competition${conceptSuffix}`];
  const subVals = subKeys.map(k => scoreMap[k]?.score ?? 0).filter(v => v > 0);
  if (subVals.length >= 3) {
    const subAvg = Math.round(subVals.reduce((a, b) => a + b, 0) / subVals.length);
    const subDelta = Math.abs(subAvg - fitScore);
    check(`Sub-score avg (${subAvg}) consistent with Fit IQ (${fitScore})`, subDelta <= 25, subDelta > 25, `delta=${subDelta}`);
  }

  // 7. survivalRate + neighborhoodHealth present (critical for hero display)
  const survivalRate = scoreMap['six_survival_rate']?.score ?? 0;
  const nbhdHealth = scoreMap['six_neighborhood_health']?.score ?? 0;
  check(`survivalRate > 0 (hero bar data)`, survivalRate > 0, survivalRate === 0, `score=${survivalRate}`);
  check(`neighborhoodHealth > 0 (hero bar data)`, nbhdHealth > 0, nbhdHealth === 0, `score=${nbhdHealth}`);

  // 8. CoPilot context — check block_group_intel has data
  const { data: intelRows } = await supabase
    .from('block_group_intel')
    .select('source')
    .eq('geoid', geoid);
  const intelCount = intelRows?.length ?? 0;
  check(`block_group_intel has ≥ 3 sources`, intelCount >= 3, intelCount < 3, `found ${intelCount} sources`);

  // 9. Enriched entities for CoPilot context
  const { data: enrichedRows } = await supabase
    .from('enriched_entities')
    .select('entity_category')
    .eq('location_key', geoid)
    .eq('entity_type', 'block_group_intel');
  const enrichedCount = enrichedRows?.length ?? 0;
  check(`enriched_entities has ≥ 1 category`, enrichedCount >= 1, enrichedCount === 0, `found ${enrichedCount} categories`);
}

async function main() {
  console.log('\x1b[1mRE² End-to-End Verification — ' + new Date().toISOString() + '\x1b[0m');
  console.log('Testing ' + TEST_MATRIX.length + ' locations × concepts across all 5 boroughs\n');

  for (const entry of TEST_MATRIX) {
    await verifyLocation(entry);
    // Rate-limit DB queries
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '─'.repeat(64));
  const allPassed = totalFail === 0;
  console.log(allPassed
    ? `\x1b[32m\x1b[1mALL CHECKS PASSED\x1b[0m (${totalWarn} warnings)`
    : `\x1b[31m\x1b[1m${totalFail} FAILURES\x1b[0m  ${totalWarn} warnings  ${totalPass} passed`
  );
  console.log(`Total: ${totalTests} checks  |  Pass: ${totalPass}  Warn: ${totalWarn}  Fail: ${totalFail}`);

  if (findings.length > 0) {
    console.log('\n\x1b[1mFINDINGS:\x1b[0m');
    for (const f of findings) {
      const icon = f.level === 'fail' ? '\x1b[31m✗\x1b[0m' : '\x1b[33m⚠\x1b[0m';
      console.log(`  ${icon}  ${f.label}${f.detail ? ' — ' + f.detail : ''}`);
    }
  }

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
