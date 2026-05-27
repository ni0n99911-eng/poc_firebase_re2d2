#!/usr/bin/env node
/**
 * DOHMH Proxy Scorer
 *
 * Scores ~22K unscored DOHMH food businesses using inspection signals only.
 * No Google Places dependency.
 *
 * Composite: Grade Signal (35%) + Consistency (25%) + Track Record (20%) + Longevity (20%)
 * Penalties: C-grade history (-10%), grade Z/N current (-15%)
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/proxy-score-dohmh.mjs
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

// ─── Weights ────────────────────────────────────────────────────────
const W_GRADE    = 0.35;  // Current grade quality
const W_CONSIST  = 0.25;  // A-grade percentage over all inspections
const W_STREAK   = 0.20;  // Consecutive A streak (operational discipline)
const W_LONGEVITY = 0.20; // Years of inspection history (survival signal)

// ─── Grade scoring ──────────────────────────────────────────────────
const GRADE_SCORE = {
  'A': 1.0,
  'B': 0.55,
  'C': 0.15,
  'Z': 0.25,   // Pending re-inspection — uncertain
  'N': 0.10,   // Not yet graded — minimal signal
};

// ─── Normalization caps ─────────────────────────────────────────────
const MAX_CONSECUTIVE_A = 12;  // 99th percentile from calibration data
const MAX_YEARS = 3.0;         // DOHMH data window cap
const MAX_INSPECTIONS = 20;    // For density weighting

// ─── Supabase helpers ───────────────────────────────────────────────
async function fetchAll(query) {
  // Supabase REST paginates at 1000 rows. Fetch all pages.
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

async function upsertBatch(rows) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/businesses?on_conflict=source,source_id`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) throw new Error(`Upsert failed: ${resp.status} ${await resp.text()}`);
}

// ─── Scoring function ───────────────────────────────────────────────
function computeProxyScore(biz) {
  const grade = biz.dohmh_latest_grade || 'N';
  const aPct = biz.dohmh_a_pct ?? 0;
  const consA = biz.dohmh_consecutive_a ?? 0;
  const years = biz.dohmh_years_history ?? 0;
  const hasCGrade = biz.dohmh_has_c_grade ?? false;
  const inspections = biz.dohmh_inspections ?? 0;

  // 1. Grade signal (0-1)
  const gradeScore = GRADE_SCORE[grade] ?? 0.1;

  // 2. Consistency signal (0-1): A-grade percentage
  const consistScore = aPct;

  // 3. Streak signal (0-1): consecutive A grades, capped and normalized
  const streakScore = Math.min(consA / MAX_CONSECUTIVE_A, 1.0);

  // 4. Longevity signal (0-1): years of history
  const longevityScore = Math.min(years / MAX_YEARS, 1.0);

  // Weighted composite
  let composite = (
    W_GRADE * gradeScore +
    W_CONSIST * consistScore +
    W_STREAK * streakScore +
    W_LONGEVITY * longevityScore
  );

  // Penalties
  if (hasCGrade) composite *= 0.90;           // -10% for C history
  if (grade === 'Z' || grade === 'N') composite *= 0.85;  // -15% for unresolved status

  // Confidence weight: businesses with very few inspections get dampened toward 0.5
  // This prevents 1-inspection A-grades from scoring as "thriving"
  const confidence = Math.min(inspections / 4, 1.0);  // Full confidence at 4+ inspections
  composite = composite * confidence + 0.35 * (1 - confidence);  // Blend toward 0.35 (surviving)

  return {
    composite: Math.round(composite * 1000) / 1000,
    components: {
      grade_score: gradeScore,
      consist_score: consistScore,
      streak_score: streakScore,
      longevity_score: longevityScore,
      confidence,
    }
  };
}

// ─── Tier assignment using fixed thresholds ─────────────────────────
// Calibrated to produce reasonable distribution matching Google-scored data
function assignTier(composite, biz) {
  // Override: Google-confirmed CLOSED_PERMANENTLY → closed
  if (biz.google_status === 'CLOSED_PERMANENTLY') return 'closed';

  // Grade Z with low consistency → at_risk (pending re-inspection, shaky history)
  if (biz.dohmh_latest_grade === 'Z' && (biz.dohmh_a_pct ?? 0) < 0.5) return 'at_risk';

  if (composite >= 0.75) return 'thriving';
  if (composite >= 0.55) return 'performing';
  if (composite >= 0.35) return 'surviving';
  if (composite >= 0.18) return 'at_risk';
  return 'at_risk';  // Floor at at_risk for DOHMH (they're still operating if they have records)
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching unscored DOHMH businesses with grade data...');

  const businesses = await fetchAll(
    'businesses?tier=eq.unscored&source=eq.DOHMH&dohmh_latest_grade=not.is.null' +
    '&select=id,name,vertical,concept,address,borough,zipcode,latitude,longitude,' +
    'source,source_id,phone,dohmh_latest_grade,dohmh_inspections,' +
    'dohmh_a_pct,dohmh_consecutive_a,dohmh_years_history,dohmh_has_c_grade,google_status'
  );

  console.log(`Fetched: ${businesses.length.toLocaleString()} businesses`);

  // Score all
  const scored = businesses.map(b => {
    const { composite, components } = computeProxyScore(b);
    const tier = assignTier(composite, b);
    return {
      ...b,
      composite,
      components,
      tier,
    };
  });

  // Distribution report
  const tierDist = {};
  const boroughTier = {};
  for (const s of scored) {
    tierDist[s.tier] = (tierDist[s.tier] || 0) + 1;
    const key = `${s.borough}|${s.tier}`;
    boroughTier[key] = (boroughTier[key] || 0) + 1;
  }

  console.log('\n=== Proxy Tier Distribution ===');
  for (const t of ['thriving', 'performing', 'surviving', 'at_risk', 'closed']) {
    const n = tierDist[t] || 0;
    const pct = (100 * n / scored.length).toFixed(1);
    console.log(`  ${t}: ${n.toLocaleString()} (${pct}%)`);
  }

  // Score distribution stats
  const scores = scored.map(s => s.composite).sort((a, b) => a - b);
  const p10 = scores[Math.floor(scores.length * 0.1)];
  const p25 = scores[Math.floor(scores.length * 0.25)];
  const p50 = scores[Math.floor(scores.length * 0.5)];
  const p75 = scores[Math.floor(scores.length * 0.75)];
  const p90 = scores[Math.floor(scores.length * 0.9)];
  console.log(`\n=== Score Distribution ===`);
  console.log(`  p10=${p10} p25=${p25} p50=${p50} p75=${p75} p90=${p90}`);

  // Borough breakdown
  console.log('\n=== Borough × Tier ===');
  const boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
  const tiers = ['thriving', 'performing', 'surviving', 'at_risk', 'closed'];
  console.log('  ' + ['Borough', ...tiers].map(s => s.padEnd(12)).join(''));
  for (const b of boroughs) {
    const row = tiers.map(t => (boroughTier[`${b}|${t}`] || 0).toString().padEnd(12));
    console.log('  ' + b.padEnd(12) + row.join(''));
  }

  // Cross-validate: score the 5,208 already-scored businesses and compare
  console.log('\n=== Cross-validation against Google-scored businesses ===');
  const googleScored = await fetchAll(
    'businesses?tier=neq.unscored&source=eq.DOHMH&dohmh_latest_grade=not.is.null' +
    '&select=id,name,tier,composite_score,dohmh_latest_grade,dohmh_inspections,' +
    'dohmh_a_pct,dohmh_consecutive_a,dohmh_years_history,dohmh_has_c_grade,google_status'
  );
  console.log(`  Google-scored DOHMH businesses: ${googleScored.length}`);

  let matches = 0;
  let adjacentMatches = 0;
  const tierOrder = ['closed', 'at_risk', 'surviving', 'performing', 'thriving'];
  const confMatrix = {};

  for (const b of googleScored) {
    const { composite } = computeProxyScore(b);
    const proxyTier = assignTier(composite, b);
    const googleTier = b.tier;

    const key = `${googleTier}→${proxyTier}`;
    confMatrix[key] = (confMatrix[key] || 0) + 1;

    if (proxyTier === googleTier) matches++;
    const diff = Math.abs(tierOrder.indexOf(proxyTier) - tierOrder.indexOf(googleTier));
    if (diff <= 1) adjacentMatches++;
  }

  console.log(`  Exact match: ${matches}/${googleScored.length} (${(100*matches/googleScored.length).toFixed(1)}%)`);
  console.log(`  Within 1 tier: ${adjacentMatches}/${googleScored.length} (${(100*adjacentMatches/googleScored.length).toFixed(1)}%)`);

  console.log('\n  Confusion matrix (Google → Proxy):');
  for (const gt of tierOrder) {
    const row = tierOrder.map(pt => {
      return (confMatrix[`${gt}→${pt}`] || 0).toString().padEnd(10);
    });
    console.log(`    ${gt.padEnd(12)} ${row.join('')}`);
  }

  // Upsert scores to Supabase (include required NOT NULL fields)
  console.log(`\nUpserting ${scored.length.toLocaleString()} proxy-scored businesses...`);
  let uploaded = 0;
  let errors = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < scored.length; i += BATCH_SIZE) {
    const batch = scored.slice(i, i + BATCH_SIZE).map(s => ({
      // Required NOT NULL fields (needed for upsert merge)
      name: s.name,
      vertical: s.vertical,
      borough: s.borough,
      source: s.source,
      source_id: s.source_id,
      // Score updates
      composite_score: s.composite,
      tier: s.tier,
      score_rating_norm: s.components.grade_score,
      score_review_norm: s.components.consist_score,
      score_longevity_norm: s.components.longevity_score,
      scored_at: now,
    }));

    let retries = 0;
    let success = false;
    while (!success && retries < 3) {
      try {
        await upsertBatch(batch);
        uploaded += batch.length;
        success = true;
        if (uploaded % 4000 === 0 || i + BATCH_SIZE >= scored.length) {
          const pct = ((uploaded / scored.length) * 100).toFixed(1);
          console.log(`  ${uploaded.toLocaleString()} / ${scored.length.toLocaleString()} (${pct}%)`);
        }
      } catch (err) {
        retries++;
        if (retries < 3) {
          await sleep(BATCH_DELAY_MS * retries * 2);
        } else {
          console.error(`  Batch ${i} failed: ${err.message.slice(0, 120)}`);
          errors++;
        }
      }
    }
    await sleep(BATCH_DELAY_MS);
  }

  console.log(`\n✓ Proxy scoring complete: ${uploaded.toLocaleString()} updated, ${errors} errors`);
}

main().catch(err => { console.error(err); process.exit(1); });
