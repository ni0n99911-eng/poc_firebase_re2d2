#!/usr/bin/env node
// ============================================================
// RE² HPD Landlord Data Loader
// Pulls HPD Building Registrations + Contacts from NYC Socrata
// and loads into Supabase `landlords` table for the 90K match.
//
// Usage:
//   cd ~/Desktop/jaredclaw && node ../RE2\ Production\ Plan/load-hpd-landlords.mjs
//
// Prerequisites:
//   1. Run the CREATE TABLE from landlord-thesis-query.sql in Supabase SQL Editor
//   2. .env must have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
//
// Socrata datasets:
//   - HPD Building Registrations: tesw-yqqr
//   - HPD Registration Contacts: feu5-w2e2
//   - HPD Violations:            b2iz-pps8
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// --------------- CONFIG ---------------
const SOCRATA_BASE = 'https://data.cityofnewyork.us/resource';
const HPD_REGISTRATIONS = 'tesw-yqqr';   // address → registration_id
const HPD_CONTACTS      = 'feu5-w2e2';   // registration_id → owner
const HPD_VIOLATIONS    = 'b2iz-pps8';   // boroid+block+lot → violations
const SOCRATA_LIMIT     = 1000;           // max per request
const BATCH_SIZE        = 50;             // addresses per batch (Socrata friendly)
const SUPABASE_UPSERT   = 200;           // rows per Supabase upsert
const CONCURRENCY       = 5;             // parallel Socrata requests

// Borough name mapping (businesses table → HPD format)
const BORO_MAP = {
  'Manhattan': 'MANHATTAN',
  'Brooklyn':  'BROOKLYN',
  'Queens':    'QUEENS',
  'Bronx':     'BRONX',
  'Staten Island': 'STATEN ISLAND',
  'MANHATTAN': 'MANHATTAN',
  'BROOKLYN':  'BROOKLYN',
  'QUEENS':    'QUEENS',
  'BRONX':     'BRONX',
  'STATEN ISLAND': 'STATEN ISLAND',
};

const BORO_ID_MAP = {
  'Manhattan': '1', 'MANHATTAN': '1',
  'Bronx': '2', 'BRONX': '2',
  'Brooklyn': '3', 'BROOKLYN': '3',
  'Queens': '4', 'QUEENS': '4',
  'Staten Island': '5', 'STATEN ISLAND': '5',
};

// --------------- ENV ---------------
// Load .env from the repo root
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  // Try repo root first, then current dir
  for (const envPath of [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../.env'),
  ]) {
    try {
      const raw = readFileSync(envPath, 'utf8');
      for (const line of raw.split('\n')) {
        const match = line.match(/^([A-Z_]+)=(.+)$/);
        if (match) process.env[match[1]] = match[2].trim();
      }
      console.log(`[env] Loaded from ${envPath}`);
      return;
    } catch { /* try next */ }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --------------- HELPERS ---------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function socrataFetch(dataset, params, retries = 3) {
  const url = new URL(`${SOCRATA_BASE}/${dataset}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
      });
      if (res.status === 429) {
        console.warn(`[socrata] Rate limited, waiting ${(attempt + 1) * 5}s...`);
        await sleep((attempt + 1) * 5000);
        continue;
      }
      if (!res.ok) {
        console.warn(`[socrata] ${dataset} HTTP ${res.status}: ${await res.text()}`);
        await sleep(2000);
        continue;
      }
      return await res.json();
    } catch (err) {
      console.warn(`[socrata] ${dataset} fetch error: ${err.message}`);
      await sleep(2000);
    }
  }
  return [];
}

// Parse address into house number + street
function parseAddress(address) {
  if (!address) return null;
  const clean = address.trim().replace(/,.*$/, ''); // drop city/state/zip after comma
  const match = clean.match(/^(\d+[\-\d]*)\s+(.+)/);
  if (!match) return null;
  return {
    houseNumber: match[1].replace(/-.*/, ''), // take first number from ranges like 123-125
    street: match[2].toUpperCase().trim()
      .replace(/\bSTREET\b/g, 'STREET')
      .replace(/\bAVENUE\b/g, 'AVENUE')
      .replace(/\bBOULEVARD\b/g, 'BOULEVARD')
      .replace(/\bDRIVE\b/g, 'DRIVE')
      .replace(/\bPLACE\b/g, 'PLACE')
      .replace(/\bROAD\b/g, 'ROAD'),
  };
}

// Classify owner entity type from name
function classifyOwner(name) {
  if (!name) return 'UNKNOWN';
  const upper = name.toUpperCase();
  if (/\bLLC\b|\bL\.L\.C\b/.test(upper)) return 'LLC';
  if (/\bCORP\b|\bINC\b|\bCO\b/.test(upper)) return 'CORP';
  if (/\bTRUST\b/.test(upper)) return 'TRUST';
  if (/\bBANK\b|\bMORTGAGE\b|\bSAVINGS\b|\bLENDING\b/.test(upper)) return 'BANK';
  if (/\bCITY OF\b|\bNYC\b|\bHPD\b|\bGOVERNMENT\b|\bHOUSING AUTH\b/.test(upper)) return 'GOVERNMENT';
  if (/\bCHURCH\b|\bTEMPLE\b|\bFOUNDATION\b|\bASSOC\b/.test(upper)) return 'NONPROFIT';
  return 'INDIVIDUAL';
}

// --------------- STEP 1: Pull unique addresses from Supabase ---------------
async function getUniqueAddresses() {
  console.log('[step 1] Pulling unique addresses from businesses table...');

  let allAddresses = [];
  let offset = 0;
  const pageSize = 1000; // Supabase caps at 1000 per request

  while (true) {
    const { data, error } = await supabase
      .from('businesses')
      .select('address, borough')
      .not('address', 'is', null)
      .not('borough', 'is', null)
      .order('id')
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(`[step 1] Supabase error at offset ${offset}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;

    allAddresses.push(...data);
    offset += pageSize;
    if (data.length < pageSize) break;
    process.stdout.write(`  ...${allAddresses.length} rows\r`);
  }

  console.log(`[step 1] Total rows with address+borough: ${allAddresses.length}`);

  // Deduplicate by address+borough
  const seen = new Set();
  const unique = [];
  for (const row of allAddresses) {
    const key = `${row.address}|${row.borough}`;
    if (!seen.has(key)) {
      seen.add(key);
      const parsed = parseAddress(row.address);
      if (parsed) {
        unique.push({
          address: row.address,
          borough: row.borough,
          houseNumber: parsed.houseNumber,
          street: parsed.street,
        });
      }
    }
  }

  console.log(`[step 1] Unique address+borough combos (parseable): ${unique.length}`);
  return unique;
}

// --------------- STEP 2: Query HPD registrations by address ---------------
async function lookupRegistrations(addresses) {
  console.log(`[step 2] Looking up HPD registrations for ${addresses.length} addresses...`);

  const results = [];
  let processed = 0;
  let found = 0;

  // Process in batches
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);

    // Run batch with concurrency limit
    const promises = batch.map(async (addr) => {
      const hpdBoro = BORO_MAP[addr.borough];
      if (!hpdBoro) return null;

      // HPD uses housenumber and streetname fields
      // Query by house number + first word of street to be fuzzy
      const streetWords = addr.street.split(/\s+/);
      const streetKey = streetWords[0]; // e.g., "BROADWAY", "5TH"

      const data = await socrataFetch(HPD_REGISTRATIONS, {
        '$where': `boro='${hpdBoro}' AND housenumber='${addr.houseNumber}' AND upper(streetname) LIKE '%${streetKey}%'`,
        '$limit': '5',
        '$select': 'registrationid,boroid,block,lot,housenumber,streetname,zip,registrationenddate,buildingid,lastregistrationdate',
      });

      if (data && data.length > 0) {
        return data.map(reg => ({
          ...addr,
          registrationId: reg.registrationid,
          boroId: reg.boroid,
          block: reg.block,
          lot: reg.lot,
          regStreet: reg.streetname,
          regZip: reg.zip,
          regEndDate: reg.lastregistrationdate || reg.registrationenddate,
          buildingId: reg.buildingid,
        }));
      }
      return null;
    });

    const batchResults = await Promise.allSettled(promises);
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        results.push(...r.value);
        found++;
      }
    }

    processed += batch.length;
    if (processed % 200 === 0 || processed === addresses.length) {
      console.log(`  [step 2] ${processed}/${addresses.length} addresses checked, ${found} matched, ${results.length} registrations`);
    }

    // Gentle rate limiting
    await sleep(200);
  }

  console.log(`[step 2] Total registrations found: ${results.length} across ${found} addresses`);
  return results;
}

// --------------- STEP 3: Get owner contacts for each registration ---------------
async function lookupContacts(registrations) {
  console.log(`[step 3] Looking up owner contacts for ${registrations.length} registrations...`);

  // Deduplicate by registrationId
  const regMap = new Map();
  for (const reg of registrations) {
    if (!regMap.has(reg.registrationId)) {
      regMap.set(reg.registrationId, reg);
    }
  }
  const uniqueRegs = [...regMap.values()];
  console.log(`  Unique registrations: ${uniqueRegs.length}`);

  const results = [];
  let processed = 0;

  for (let i = 0; i < uniqueRegs.length; i += BATCH_SIZE) {
    const batch = uniqueRegs.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (reg) => {
      // Get owner contacts (Type = CorporateOwner or IndividualOwner)
      const data = await socrataFetch(HPD_CONTACTS, {
        '$where': `registrationid='${reg.registrationId}' AND (type='CorporateOwner' OR type='IndividualOwner' OR type='Agent')`,
        '$limit': '10',
        '$select': 'registrationid,type,firstname,lastname,corporationname,businesshousenumber,businessstreetname,businessapartment,businesszip',
      });

      if (data && data.length > 0) {
        // Find the owner (prefer CorporateOwner, then IndividualOwner)
        const corp = data.find(c => c.type === 'CorporateOwner');
        const indiv = data.find(c => c.type === 'IndividualOwner');
        const agent = data.find(c => c.type === 'Agent');
        const owner = corp || indiv;

        const ownerName = owner
          ? (owner.corporationname || `${owner.firstname || ''} ${owner.lastname || ''}`.trim())
          : null;
        const agentName = agent
          ? (agent.corporationname || `${agent.firstname || ''} ${agent.lastname || ''}`.trim())
          : null;

        return {
          ...reg,
          ownerName,
          ownerType: owner?.type || null,
          agentName,
          ownerEntityType: classifyOwner(ownerName),
        };
      }
      return { ...reg, ownerName: null, ownerType: null, agentName: null, ownerEntityType: 'UNKNOWN' };
    });

    const batchResults = await Promise.allSettled(promises);
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value);
      }
    }

    processed += batch.length;
    if (processed % 200 === 0 || processed === uniqueRegs.length) {
      console.log(`  [step 3] ${processed}/${uniqueRegs.length} contacts resolved`);
    }

    await sleep(200);
  }

  const withOwner = results.filter(r => r.ownerName);
  console.log(`[step 3] Contacts resolved: ${withOwner.length} with owner, ${results.length - withOwner.length} unknown`);
  return results;
}

// --------------- STEP 4: Get violation counts per building ---------------
async function lookupViolations(registrations) {
  console.log(`[step 4] Looking up HPD violations...`);

  // Deduplicate by boroId+block+lot (BBL)
  const bblMap = new Map();
  for (const reg of registrations) {
    if (reg.boroId && reg.block && reg.lot) {
      const bbl = `${reg.boroId}${String(reg.block).padStart(5, '0')}${String(reg.lot).padStart(4, '0')}`;
      if (!bblMap.has(bbl)) {
        bblMap.set(bbl, { boroId: reg.boroId, block: reg.block, lot: reg.lot });
      }
    }
  }

  const uniqueBBLs = [...bblMap.entries()];
  console.log(`  Unique BBLs: ${uniqueBBLs.length}`);

  const violationCounts = new Map(); // bbl → { total, open }
  let processed = 0;

  for (let i = 0; i < uniqueBBLs.length; i += BATCH_SIZE) {
    const batch = uniqueBBLs.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async ([bbl, { boroId, block, lot }]) => {
      // Count total violations
      const totalData = await socrataFetch(HPD_VIOLATIONS, {
        '$where': `boroid='${boroId}' AND block='${block}' AND lot='${lot}'`,
        '$select': 'count(*) as total',
        '$limit': '1',
      });
      // Count open violations (not closed)
      const openData = await socrataFetch(HPD_VIOLATIONS, {
        '$where': `boroid='${boroId}' AND block='${block}' AND lot='${lot}' AND currentstatus != 'VIOLATION CLOSED'`,
        '$select': 'count(*) as total',
        '$limit': '1',
      });

      const total = (totalData && totalData.length > 0) ? parseInt(totalData[0].total) || 0 : 0;
      const open = (openData && openData.length > 0) ? parseInt(openData[0].total) || 0 : 0;
      return { bbl, total, open };
    });

    const batchResults = await Promise.allSettled(promises);
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        violationCounts.set(r.value.bbl, { total: r.value.total, open: r.value.open });
      }
    }

    processed += batch.length;
    if (processed % 200 === 0 || processed === uniqueBBLs.length) {
      console.log(`  [step 4] ${processed}/${uniqueBBLs.length} BBLs checked`);
    }

    await sleep(200);
  }

  console.log(`[step 4] Violations loaded for ${violationCounts.size} BBLs`);
  return violationCounts;
}

// --------------- STEP 5: Upsert into Supabase landlords table ---------------
async function upsertLandlords(contacts, violationCounts) {
  console.log(`[step 5] Upserting ${contacts.length} rows into landlords table...`);

  const rows = contacts.map(c => {
    const bbl = (c.boroId && c.block && c.lot)
      ? `${c.boroId}${String(c.block).padStart(5, '0')}${String(c.lot).padStart(4, '0')}`
      : null;
    const violations = bbl ? (violationCounts.get(bbl) || { total: 0, open: 0 }) : { total: 0, open: 0 };

    return {
      bbl,
      borough: c.borough,
      block: c.block ? String(c.block) : null,
      lot: c.lot ? String(c.lot) : null,
      house_number: c.houseNumber,
      street_name: c.regStreet || c.street,
      registration_id: c.registrationId,
      owner_name: c.ownerName,
      owner_type: c.ownerType,
      agent_name: c.agentName,
      last_registration_date: c.regEndDate || null,
      hpd_violation_count: violations.total,
      hpd_open_violations: violations.open,
      owner_entity_type: c.ownerEntityType,
    };
  });

  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += SUPABASE_UPSERT) {
    const batch = rows.slice(i, i + SUPABASE_UPSERT);
    const { error } = await supabase
      .from('landlords')
      .upsert(batch, { onConflict: 'registration_id' });

    if (error) {
      console.warn(`  [step 5] Upsert error at batch ${i}: ${error.message}`);
      errors++;
      // Fallback: insert one by one
      for (const row of batch) {
        const { error: singleErr } = await supabase
          .from('landlords')
          .upsert([row], { onConflict: 'registration_id' });
        if (!singleErr) upserted++;
      }
    } else {
      upserted += batch.length;
    }

    if (upserted % 1000 === 0 || i + SUPABASE_UPSERT >= rows.length) {
      console.log(`  [step 5] ${upserted}/${rows.length} upserted (${errors} batch errors)`);
    }
  }

  console.log(`[step 5] Done. ${upserted} rows in landlords table.`);
  return upserted;
}

// --------------- MAIN ---------------
async function main() {
  const startTime = Date.now();
  console.log('='.repeat(60));
  console.log('RE² HPD Landlord Data Loader');
  console.log('='.repeat(60));

  // Optional: --dry-run flag
  const dryRun = process.argv.includes('--dry-run');
  // Optional: --limit N to test with fewer addresses
  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1]) : null;

  if (dryRun) console.log('[mode] DRY RUN — will not write to Supabase');
  if (limit) console.log(`[mode] LIMITED to ${limit} addresses`);

  // Step 1: Get addresses
  let addresses = await getUniqueAddresses();
  if (limit) addresses = addresses.slice(0, limit);

  // Step 2: HPD registrations
  const registrations = await lookupRegistrations(addresses);
  if (registrations.length === 0) {
    console.log('No registrations found. Exiting.');
    return;
  }

  // Step 3: Owner contacts
  const contacts = await lookupContacts(registrations);

  // Step 4: Violation counts
  const violationCounts = await lookupViolations(contacts);

  // Step 5: Upsert
  if (!dryRun) {
    await upsertLandlords(contacts, violationCounts);
  } else {
    console.log(`[dry-run] Would upsert ${contacts.length} rows`);
    // Print a sample
    const sample = contacts.slice(0, 5);
    for (const s of sample) {
      console.log(`  ${s.houseNumber} ${s.street}, ${s.borough} → ${s.ownerName || 'NO OWNER'} (${s.ownerEntityType})`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('='.repeat(60));
  console.log(`Done in ${elapsed}s`);
  console.log('='.repeat(60));
  console.log('\nNext: run the analysis query from landlord-thesis-query.sql in Supabase SQL Editor');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
