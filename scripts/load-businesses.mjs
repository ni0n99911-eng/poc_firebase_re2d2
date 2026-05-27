#!/usr/bin/env node
/**
 * Load master business roster into Supabase `businesses` table.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node load-businesses.mjs
 *
 * Reads: data-sources/master-business-roster-v2.json
 * Writes: Supabase `businesses` table (upsert on source + source_id)
 *
 * Batch size: 500 rows per request
 * Expected runtime: ~3 minutes for 90K records
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const BATCH_SIZE = 200;  // Smaller batches for free-tier rate limits
const BATCH_DELAY_MS = 300;  // Pause between batches
const RETRY_DELAY_MS = 100;  // Pause between individual retries
const DATA_FILE = join(import.meta.dirname, '..', 'data-sources', 'master-business-roster-v2.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Concept mapping (same as analysis script) ──────────────────────
const CONCEPT_MAP = {
  'Food & Beverage': 'Restaurant / Cafe / Bar',
  'Retail - Convenience/Bodega': 'Bodega / Convenience Store',
  'Retail - Grocery': 'Grocery / Supermarket',
  'Retail - Clothing': 'Clothing / Fashion',
  'Retail - Electronics': 'Electronics / Phone Store',
  'Retail - Secondhand': 'Thrift / Secondhand Store',
  'Retail - Tobacco': 'Smoke Shop / Tobacco',
  'Retail - Vape/E-Cig': 'Vape / E-Cigarette',
  'Retail - Liquor': 'Liquor / Wine Store',
  'Retail - Deli': 'Deli / Prepared Food',
  'Retail - Bakery': 'Bakery',
  'Retail - Jewelry': 'Jewelry Store',
  'Retail - Variety/Dollar': 'Dollar / Variety Store',
  'Retail - Florist': 'Florist',
  'Retail - Pet': 'Pet Store / Supply',
  'Retail - Beauty Supply': 'Beauty Supply',
  'Retail - Hardware': 'Hardware Store',
  'Retail - Optician': 'Optical / Eyewear',
  'Retail - Books': 'Bookstore',
  'Retail - Auto': 'Auto Dealer / Parts',
  'Retail - Auto Parts': 'Auto Dealer / Parts',
  'Retail - Pawnbroker': 'Pawnbroker',
  'Retail - Medical Supply': 'Medical Supply',
  'Retail - Newsstand': 'Newsstand',
  'Retail - Street Stand': 'Street Stand',
  'Services - Salon/Barber': 'Salon / Barbershop',
  'Services - Beauty/Spa': 'Spa / Beauty Services',
  'Services - Laundry/Dry Clean': 'Laundromat / Dry Cleaner',
  'Services - Car Wash': 'Car Wash',
  'Services - Auto Repair': 'Auto Repair',
  'Services - Parking': 'Parking Garage / Lot',
  'Services - Tailor': 'Tailor / Alterations',
  'Services - Tattoo': 'Tattoo / Piercing',
  'Services - Nail Salon': 'Nail Salon',
  'Services - Massage': 'Massage',
  'Services - Laundry': 'Laundromat / Dry Cleaner',
  'Services - Storage': 'Storage',
  'Services - Home Improvement': 'Home Improvement Contractor',
  'Services - Appliance Repair': 'Appliance Repair',
  'Services - Locksmith': 'Locksmith',
  'Services - Scrap/Recycling': 'Scrap / Recycling',
  'Services - Employment': 'Employment Agency',
  'Healthcare - Dental': 'Dental Practice',
  'Healthcare - Pharmacy': 'Pharmacy',
  'Healthcare - Medical': 'Medical Office / Clinic',
  'Healthcare - Clinic': 'Medical Office / Clinic',
  'Healthcare - Physical Therapy': 'Physical Therapy',
  'Healthcare - Chiropractic': 'Chiropractor',
  'Healthcare - Veterinary': 'Veterinary Clinic',
  'Healthcare - Podiatry': 'Podiatrist',
  'Healthcare - Acupuncture': 'Acupuncture',
  'Healthcare - Optometry': 'Optometry',
  'Healthcare - Hospital': 'Hospital',
  'Fitness - Gym': 'Gym / Fitness Studio',
  'Hospitality - Hotel': 'Hotel / Hostel',
  'Entertainment - Cinema': 'Entertainment Venue',
  'Entertainment - Theater': 'Entertainment Venue',
  'Entertainment - Nightclub': 'Nightclub / Lounge',
  'Entertainment - Bowling': 'Entertainment Venue',
  'Entertainment - Ticket Sales': 'Entertainment Venue',
  'Professional - Real Estate': 'Real Estate Office',
  'Professional - Legal': 'Legal Office',
  'Professional - Insurance': 'Insurance Office',
  'Professional - Accounting': 'Accounting Office',
};

// ─── Supabase REST upsert ────────────────────────────────────────────
async function upsertBatch(rows) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/businesses`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase error ${resp.status}: ${text}`);
  }
  return resp.status;
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('Loading master business roster...');
  const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  const businesses = raw.businesses;
  console.log(`Total records: ${businesses.length.toLocaleString()}`);

  // Also load 5-tier results if available (for food businesses with scores)
  let tierMap = {};
  try {
    const tierData = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'data-sources', '5-tier-results.json'), 'utf8'));
    for (const b of tierData.businesses) {
      tierMap[b.camis] = b;
    }
    console.log(`5-tier scores loaded: ${Object.keys(tierMap).length.toLocaleString()}`);
  } catch (e) {
    console.log('No 5-tier results found, skipping score population');
  }

  // Also load DOHMH success signals for years_history
  let signalMap = {};
  try {
    const signals = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'data-sources', 'dohmh_success_signals.json'), 'utf8'));
    for (const s of signals) {
      signalMap[s.camis] = s;
    }
    console.log(`DOHMH signals loaded: ${Object.keys(signalMap).length.toLocaleString()}`);
  } catch (e) {
    console.log('No DOHMH signals found');
  }

  // Also load Google enrichment
  let googleMap = {};
  try {
    const gData = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'data-sources', 'google-enrichment-checkpoint.json'), 'utf8'));
    googleMap = gData.completed || {};
    console.log(`Google enrichment loaded: ${Object.keys(googleMap).length.toLocaleString()}`);
  } catch (e) {
    console.log('No Google enrichment found');
  }

  // Transform to DB rows
  console.log('\nTransforming records...');
  const rows = [];

  for (const b of businesses) {
    const concept = CONCEPT_MAP[b.vertical] || b.vertical;
    const camis = b.source === 'DOHMH' ? b.source_id : null;

    // Tier data (food businesses with Google enrichment)
    const tier = camis && tierMap[camis] ? tierMap[camis] : null;

    // DOHMH signals
    const sig = camis && signalMap[camis] ? signalMap[camis] : null;

    // Google enrichment
    const google = camis && googleMap[camis] ? googleMap[camis] : null;

    const tierName = tier ? { 1: 'closed', 2: 'at_risk', 3: 'surviving', 4: 'performing', 5: 'thriving' }[tier.tier] || 'unscored' : 'unscored';

    rows.push({
      name: (b.name || 'Unknown').slice(0, 500),
      vertical: b.vertical,
      sub_category: b.sub_category || null,
      concept,
      address: b.address || null,
      borough: b.borough || 'Unknown',
      zipcode: b.zipcode || null,
      latitude: b.latitude ? parseFloat(b.latitude) : null,
      longitude: b.longitude ? parseFloat(b.longitude) : null,
      source: b.source,
      source_id: b.source_id || `${b.source}-${rows.length}`,
      phone: b.phone || null,

      // Google enrichment (if available)
      google_place_id: google ? google.google_place_id : null,
      google_name: google ? google.google_name : null,
      google_rating: google ? google.rating : null,
      google_reviews: google ? google.user_ratings_total : null,
      google_price_level: google ? google.price_level : null,
      google_status: google ? google.business_status : null,
      google_types: google ? google.types : null,
      google_match_confidence: google ? google.match_confidence : null,
      google_fetched_at: google ? new Date().toISOString() : null,

      // 5-tier scoring
      composite_score: tier ? tier.composite_score : null,
      tier: tierName,
      score_rating_norm: tier ? tier.score_components?.rating_norm : null,
      score_review_norm: tier ? tier.score_components?.review_norm : null,
      score_longevity_norm: tier ? tier.score_components?.longevity_norm : null,
      scored_at: tier ? new Date().toISOString() : null,

      // DOHMH-specific
      dohmh_latest_grade: sig ? sig.latest_grade : null,
      dohmh_grade_date: sig ? sig.latest_grade_date : null,
      dohmh_inspections: sig ? sig.total_inspections : null,
      dohmh_a_pct: sig ? sig.a_grade_pct : null,
      dohmh_consecutive_a: sig ? sig.consecutive_a_grades : null,
      dohmh_years_history: sig ? sig.years_history : null,
      dohmh_has_c_grade: sig ? sig.has_c_grade : null,

      // Michelin
      is_michelin: tier ? tier.is_michelin : false,
      michelin_level: tier ? tier.michelin_level : null,
    });
  }

  console.log(`Rows prepared: ${rows.length.toLocaleString()}`);

  // Stats
  const withGoogle = rows.filter(r => r.google_rating !== null).length;
  const withTier = rows.filter(r => r.tier !== 'unscored').length;
  console.log(`  With Google enrichment: ${withGoogle.toLocaleString()}`);
  console.log(`  With 5-tier score: ${withTier.toLocaleString()}`);

  // Batch upsert
  console.log(`\nUpserting in batches of ${BATCH_SIZE}...`);
  let uploaded = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    let retries = 0;
    let success = false;

    while (!success && retries < 3) {
      try {
        await upsertBatch(batch);
        uploaded += batch.length;
        success = true;
        if (uploaded % 2000 === 0 || i + BATCH_SIZE >= rows.length) {
          const pct = ((uploaded / rows.length) * 100).toFixed(1);
          console.log(`  ${uploaded.toLocaleString()} / ${rows.length.toLocaleString()} (${pct}%)`);
        }
      } catch (err) {
        retries++;
        if (retries < 3) {
          const backoff = BATCH_DELAY_MS * retries * 2;
          console.log(`  Batch ${i}-${i + BATCH_SIZE} failed (attempt ${retries}/3), retrying in ${backoff}ms...`);
          await sleep(backoff);
        } else {
          console.error(`  Batch ${i}-${i + BATCH_SIZE} failed after 3 attempts: ${err.message}`);
          errors++;
          // Retry individual records on final failure
          for (const row of batch) {
            try {
              await upsertBatch([row]);
              uploaded++;
            } catch (e2) {
              console.error(`    Row failed: ${row.name} (${row.source}/${row.source_id}): ${e2.message.slice(0, 100)}`);
              errors++;
            }
            await sleep(RETRY_DELAY_MS);
          }
        }
      }
    }
    await sleep(BATCH_DELAY_MS);
  }

  console.log(`\n✓ Upload complete: ${uploaded.toLocaleString()} rows, ${errors} errors`);
}

main().catch(err => { console.error(err); process.exit(1); });
