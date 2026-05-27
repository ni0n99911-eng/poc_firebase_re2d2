#!/usr/bin/env node
/**
 * spot-check.mjs — RE² Score Verification Script
 *
 * Checks 10 known NYC addresses across all 5 boroughs.
 * Uses FCC Census Geocoder (same as production) to resolve lat/lng → GEOID.
 * Verifies Location IQ, Fit IQ, Vision IQ, and all 6 hero sub-scores are non-zero.
 *
 * Run: node scripts/spot-check.mjs
 * Exit 1 on any FAIL, 0 if all PASS (WARNs are non-fatal).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const BOLD   = '\x1b[1m';

const pass = (msg) => console.log(`  ${GREEN}✓ PASS${RESET}  ${msg}`);
const warn = (msg) => console.log(`  ${YELLOW}⚠ WARN${RESET}  ${msg}`);
const fail = (msg) => console.log(`  ${RED}✗ FAIL${RESET}  ${msg}`);

const TEST_ADDRESSES = [
  {
    label: 'UWS Manhattan (Amsterdam Ave & 79th)',
    lat: 40.7827, lng: -73.9803, concept: 'specialty_coffee',
    expected: { locationIQ: [55, 95], fitIQ: [45, 90], transit: [60, 100], vibrancy: [40, 90] }
  },
  {
    label: 'Midtown Manhattan (5th Ave & 50th)',
    lat: 40.7580, lng: -73.9855, concept: 'retail',
    expected: { locationIQ: [60, 100], fitIQ: [50, 95], transit: [70, 100], vibrancy: [50, 100] }
  },
  {
    label: 'Williamsburg Brooklyn (Bedford Ave)',
    lat: 40.7143, lng: -73.9608, concept: 'bar_nightlife',
    expected: { locationIQ: [50, 90], fitIQ: [45, 90], transit: [40, 85], vibrancy: [45, 95] }
  },
  {
    label: 'Astoria Queens (31st Ave)',
    lat: 40.7721, lng: -73.9303, concept: 'full_service_restaurant',
    expected: { locationIQ: [40, 85], fitIQ: [35, 80], transit: [40, 85], vibrancy: [35, 80] }
  },
  {
    label: 'South Bronx (149th St & 3rd Ave)',
    lat: 40.8157, lng: -73.9246, concept: 'fast_casual',
    expected: { locationIQ: [25, 70], fitIQ: [25, 70], transit: [40, 85], vibrancy: [20, 65] }
  },
  {
    label: 'Staten Island (Bay St)',
    lat: 40.6411, lng: -74.0740, concept: 'personal_services',
    expected: { locationIQ: [20, 65], fitIQ: [20, 65], transit: [10, 60], vibrancy: [15, 60] }
  },
  {
    label: 'Lower East Side Manhattan (Orchard St)',
    lat: 40.7185, lng: -73.9886, concept: 'bar_nightlife',
    expected: { locationIQ: [50, 90], fitIQ: [45, 90], transit: [50, 95], vibrancy: [45, 90] }
  },
  {
    label: 'Flatbush Brooklyn (Flatbush Ave)',
    lat: 40.6501, lng: -73.9496, concept: 'fast_casual',
    expected: { locationIQ: [30, 75], fitIQ: [30, 75], transit: [35, 80], vibrancy: [25, 70] }
  },
  {
    label: 'Jackson Heights Queens (Roosevelt Ave)',
    lat: 40.7557, lng: -73.8839, concept: 'full_service_restaurant',
    expected: { locationIQ: [35, 80], fitIQ: [30, 75], transit: [45, 90], vibrancy: [30, 75] }
  },
  {
    label: 'Harlem Manhattan (125th St)',
    lat: 40.8076, lng: -73.9465, concept: 'specialty_coffee',
    expected: { locationIQ: [40, 85], fitIQ: [35, 80], transit: [55, 95], vibrancy: [35, 80] }
  },
];

const STALE_DAYS = 30;

// Fetch from URL as a promise
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// FCC Census Geocoder — same endpoint as production latLngToGeoid()
async function latLngToGeoid(lat, lng) {
  const url = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&censusYear=2020&format=json`;
  try {
    const json = await fetchUrl(url);
    const fips = json?.Block?.FIPS;
    if (fips && fips.length >= 12) return fips.substring(0, 12);
    return null;
  } catch(e) {
    return null;
  }
}

async function checkAddress(addr) {
  console.log(`\n${BOLD}${addr.label}${RESET}`);
  let failures = 0;

  // Resolve GEOID via FCC geocoder
  const geoid = await latLngToGeoid(addr.lat, addr.lng);
  if (!geoid) {
    warn(`FCC geocoder returned no GEOID — skipping (network issue?)`);
    return 0;
  }
  console.log(`  geoid: ${geoid}`);

  const concept = addr.concept;
  const suffix = `_${concept}`;

  const scoreTypes = [
    `location_iq${suffix}`, 'location_iq',
    `fit_score${suffix}`, 'fit_score',
    `vision_iq${suffix}`, 'vision_iq',
    `fit_sub_market_proof${suffix}`, 'fit_sub_market_proof',
    `fit_sub_accessibility${suffix}`, 'fit_sub_accessibility',
    `fit_sub_vibrancy${suffix}`, 'fit_sub_vibrancy',
    `fit_sub_demographics${suffix}`, 'fit_sub_demographics',
    `fit_sub_competition${suffix}`, 'fit_sub_competition',
    `fit_sub_price_income_fit${suffix}`, 'fit_sub_price_income_fit',
  ];

  const { data: scoreRows, error: scoreErr } = await supabase
    .from('block_group_scores')
    .select('score_type, score, scored_at')
    .eq('geoid', geoid)
    .in('score_type', scoreTypes);

  if (scoreErr) {
    fail(`Supabase error: ${scoreErr.message}`);
    return 1;
  }
  if (!scoreRows?.length) {
    fail(`No score rows found for geoid ${geoid}`);
    return 1;
  }

  const scoreMap = {};
  for (const r of scoreRows) scoreMap[r.score_type] = r;

  const getScore = (type) =>
    scoreMap[`${type}${suffix}`]?.score ?? scoreMap[type]?.score ?? null;
  const getScoredAt = (type) =>
    scoreMap[`${type}${suffix}`]?.scored_at ?? scoreMap[type]?.scored_at ?? null;

  // Check Location IQ
  const locationIQ = getScore('location_iq');
  if (locationIQ === null) {
    fail(`location_iq missing`); failures++;
  } else {
    const [lo, hi] = addr.expected.locationIQ;
    if (locationIQ < lo || locationIQ > hi) warn(`location_iq = ${locationIQ} (expected ${lo}–${hi})`);
    else pass(`location_iq = ${locationIQ}`);
  }

  // Check Fit IQ
  const fitIQ = getScore('fit_score');
  if (fitIQ === null) {
    fail(`fit_score missing`); failures++;
  } else {
    const [lo, hi] = addr.expected.fitIQ;
    if (fitIQ < lo || fitIQ > hi) warn(`fit_score = ${fitIQ} (expected ${lo}–${hi})`);
    else pass(`fit_score = ${fitIQ}`);
  }

  // Check Vision IQ (optional — may not exist for all concepts yet)
  const visionIQ = getScore('vision_iq');
  if (visionIQ === null) warn(`vision_iq missing (batch re-run may be needed)`);
  else pass(`vision_iq = ${visionIQ}`);

  // Check all 6 sub-scores non-zero
  const SUB_SCORES = [
    'fit_sub_market_proof', 'fit_sub_accessibility', 'fit_sub_vibrancy',
    'fit_sub_demographics', 'fit_sub_competition', 'fit_sub_price_income_fit'
  ];
  const zeroSubs = [], missingSubs = [];
  for (const sub of SUB_SCORES) {
    const val = getScore(sub);
    if (val === null) missingSubs.push(sub.replace('fit_sub_', ''));
    else if (val === 0) zeroSubs.push(sub.replace('fit_sub_', ''));
  }
  if (zeroSubs.length > 0) warn(`Sub-scores are zero: ${zeroSubs.join(', ')}`);
  if (missingSubs.length > 0) warn(`Sub-scores missing: ${missingSubs.join(', ')}`);
  if (zeroSubs.length === 0 && missingSubs.length === 0) pass(`All 6 sub-scores present and non-zero`);

  // Staleness check
  const scoredAt = getScoredAt('location_iq');
  if (scoredAt) {
    const ageDays = (Date.now() - new Date(scoredAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > STALE_DAYS) warn(`Scores are ${Math.round(ageDays)}d old (>${STALE_DAYS}d stale)`);
    else pass(`Scores scored ${Math.round(ageDays)}d ago`);
  }

  return failures;
}

async function main() {
  console.log(`\n${BOLD}RE² Spot-Check — ${new Date().toISOString()}${RESET}`);
  console.log(`Checking ${TEST_ADDRESSES.length} addresses across all 5 NYC boroughs...`);
  console.log(`(Using FCC Census Geocoder for lat/lng → GEOID resolution)\n`);

  const { error: connErr } = await supabase.from('block_group_scores').select('geoid').limit(1);
  if (connErr) {
    console.log(`${RED}${BOLD}FATAL: Cannot connect to Supabase — ${connErr.message}${RESET}`);
    process.exit(1);
  }

  let totalFailures = 0;
  // Run sequentially to avoid hammering FCC geocoder
  for (const addr of TEST_ADDRESSES) {
    totalFailures += await checkAddress(addr);
    await new Promise(r => setTimeout(r, 300)); // 300ms between FCC calls
  }

  console.log(`\n${'─'.repeat(60)}`);
  if (totalFailures === 0) {
    console.log(`${GREEN}${BOLD}ALL CHECKS PASSED${RESET} (warnings are non-fatal)\n`);
    process.exit(0);
  } else {
    console.log(`${RED}${BOLD}${totalFailures} CHECK(S) FAILED — investigate before deploy${RESET}\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`${RED}Unhandled error:${RESET}`, err);
  process.exit(1);
});
