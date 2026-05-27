/**
 * RE² Scoring Validation — Data Integration Examples
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file contains example implementations for connecting scoring-validation.mjs
 * to real data sources. Copy the relevant function to replace the placeholder
 * enrichWithActualScores() in the main script.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * EXAMPLE 1: Fetch from location_scores + location_outcomes tables
 *
 * Assumes:
 *   - location_scores(geoid, concept_type, location_iq, vision_iq, fit_iq, computed_at)
 *   - location_outcomes(geoid, concept_type, outcome INT, created_at)
 *
 * Use when: You have geoid-keyed score storage and separate outcome labels
 */
async function enrichWithActualScores_LocationTables(validationData) {
  if (!validationData || validationData.length === 0) return [];

  // Extract unique geoids from validation data
  const geoids = [...new Set(validationData.map(r => r.geoid || r.neighborhood))];

  console.log(`[FETCH] Querying location_scores for ${geoids.length} locations...`);

  // Fetch latest scores per geoid (window function: partition by geoid, order by computed_at DESC)
  const { data: scores, error: scoreError } = await supabase
    .from('location_scores')
    .select('geoid, concept_type, location_iq, vision_iq, fit_iq, computed_at')
    .in('geoid', geoids)
    .order('computed_at', { ascending: false });

  if (scoreError) throw new Error(`Score fetch failed: ${scoreError.message}`);

  console.log(`[FETCH] Querying location_outcomes for ${geoids.length} locations...`);

  // Fetch outcome labels
  const { data: outcomes, error: outcomeError } = await supabase
    .from('location_outcomes')
    .select('geoid, concept_type, outcome, created_at')
    .in('geoid', geoids);

  if (outcomeError) throw new Error(`Outcome fetch failed: ${outcomeError.message}`);

  // Build lookup maps: geoid+concept → (score, outcome)
  const scoreMap = {};
  for (const score of scores) {
    const key = `${score.geoid}|${score.concept_type}`;
    if (!scoreMap[key]) scoreMap[key] = score; // Keep earliest computed (latest first)
  }

  const outcomeMap = {};
  for (const outcome of outcomes) {
    const key = `${outcome.geoid}|${outcome.concept_type}`;
    if (!outcomeMap[key]) outcomeMap[key] = outcome;
  }

  // Enrich validation data
  const enriched = validationData.map((row) => {
    const geoid = row.geoid || row.neighborhood;
    const concept = row.concept_type || 'default';
    const key = `${geoid}|${concept}`;

    const score = scoreMap[key];
    const outcome = outcomeMap[key];

    return {
      ...row,
      location_iq: score?.location_iq || 50,
      vision_iq: score?.vision_iq || 50,
      fit_iq: score?.fit_iq || 50,
      outcome: outcome?.outcome !== undefined ? outcome.outcome : null,
    };
  });

  console.log(`[ENRICH] Enriched ${enriched.filter(r => r.outcome !== null).length}/${enriched.length} records with outcomes`);

  return enriched;
}

/**
 * EXAMPLE 2: Fetch from block_group_scores (V4 schema)
 *
 * Assumes:
 *   - block_group_scores(geoid, location_iq_v2, location_sub_safety, location_sub_momentum, ...)
 *   - business_outcomes(geoid, dba_name, success_flag, closure_date, ...)
 *
 * Use when: Scores are in block-group aggregation, outcomes from business registry
 */
async function enrichWithActualScores_BlockGroupV4(validationData) {
  if (!validationData || validationData.length === 0) return [];

  const geoids = [...new Set(validationData.map(r => r.geoid || r.neighborhood))];

  console.log(`[FETCH] Querying block_group_scores (V4) for ${geoids.length} block groups...`);

  const { data: bgScores, error: bgError } = await supabase
    .from('block_group_scores')
    .select(`
      geoid,
      location_iq_v2,
      location_sub_safety,
      location_sub_momentum,
      location_sub_vibrancy,
      vision_iq_coffee,
      vision_iq_pizza,
      fit_iq_v3,
      computed_at
    `)
    .in('geoid', geoids);

  if (bgError) throw new Error(`Block group scores fetch failed: ${bgError.message}`);

  console.log(`[FETCH] Querying business_outcomes for ${geoids.length} block groups...`);

  const { data: outcomes, error: outcomeError } = await supabase
    .from('business_outcomes')
    .select('geoid, dba_name, concept_type, success_flag, closure_date, years_operating')
    .in('geoid', geoids);

  if (outcomeError) throw new Error(`Business outcomes fetch failed: ${outcomeError.message}`);

  // Build geoid → score map (keep latest)
  const scoreMap = {};
  for (const score of bgScores) {
    if (!scoreMap[score.geoid]) scoreMap[score.geoid] = score;
  }

  // Build concept-specific outcome maps
  const outcomeMap = {};
  for (const outcome of outcomes) {
    const key = `${outcome.geoid}|${outcome.concept_type}`;
    // Success defined as: still operating (closure_date null) AND years_operating >= 3
    const success = outcome.closure_date === null && (outcome.years_operating || 0) >= 3 ? 1 : 0;
    outcomeMap[key] = { ...outcome, outcome: success };
  }

  // Enrich validation data
  const enriched = validationData.map((row) => {
    const geoid = row.geoid || row.neighborhood;
    const concept = row.concept_type || 'default';
    const key = `${geoid}|${concept}`;

    const score = scoreMap[geoid];
    const outcome = outcomeMap[key];

    // Choose vision_iq based on concept type
    let visionScore = 50;
    if (concept === 'coffee') visionScore = score?.vision_iq_coffee || 50;
    else if (concept === 'pizza') visionScore = score?.vision_iq_pizza || 50;

    return {
      ...row,
      location_iq: score?.location_iq_v2 || 50,
      location_sub_safety: score?.location_sub_safety || 50,
      location_sub_momentum: score?.location_sub_momentum || 50,
      vision_iq: visionScore,
      fit_iq: score?.fit_iq_v3 || 50,
      outcome: outcome?.outcome !== undefined ? outcome.outcome : null,
    };
  });

  console.log(`[ENRICH] Enriched ${enriched.filter(r => r.outcome !== null).length}/${enriched.length} records with outcomes`);

  return enriched;
}

/**
 * EXAMPLE 3: Load from regression_cycle2 test data (for validation against ground truth)
 *
 * Assumes:
 *   - regression_cycle2_data table from test runs (geoid, borough, concept, scores, actual_outcome)
 *   - Used for comparing V3 scores against V4 predictions
 *
 * Use when: Validating against regression test results
 */
async function enrichWithActualScores_RegressionData(validationData) {
  if (!validationData || validationData.length === 0) return [];

  const geoids = [...new Set(validationData.map(r => r.geoid || r.neighborhood))];

  console.log(`[FETCH] Querying regression_cycle2_data for ${geoids.length} test records...`);

  const { data: regressionData, error: regError } = await supabase
    .from('regression_cycle2_data')
    .select(`
      geoid,
      borough,
      concept_type,
      actual_outcome,
      fit_score,
      fit_sub_composite,
      fit_sub_linear,
      location_iq_v2,
      vision_iq,
      test_fold,
      validation_run_id
    `)
    .in('geoid', geoids);

  if (regError) throw new Error(`Regression data fetch failed: ${regError.message}`);

  // Build geoid+concept → regression row map
  const regMap = {};
  for (const row of regressionData) {
    const key = `${row.geoid}|${row.concept_type}`;
    if (!regMap[key]) regMap[key] = row;
  }

  // Enrich validation data
  const enriched = validationData.map((row) => {
    const geoid = row.geoid || row.neighborhood;
    const concept = row.concept_type || 'default';
    const key = `${geoid}|${concept}`;

    const reg = regMap[key];

    return {
      ...row,
      location_iq: reg?.location_iq_v2 || 50,
      vision_iq: reg?.vision_iq || 50,
      fit_iq: reg?.fit_sub_composite || reg?.fit_score || 50,
      outcome: reg?.actual_outcome !== undefined ? reg.actual_outcome : null,
      test_fold: reg?.test_fold,
    };
  });

  console.log(`[ENRICH] Enriched ${enriched.filter(r => r.outcome !== null).length}/${enriched.length} records with regression outcomes`);

  return enriched;
}

/**
 * EXAMPLE 4: Load from CSV file (for offline validation)
 *
 * Usage: Create validation-data.csv with columns:
 *   geoid,concept_type,location_iq,vision_iq,fit_iq,outcome
 *
 * Then: fs.readFileSync('validation-data.csv').toString().split('\n').map(...)
 */
async function enrichWithActualScores_CSVFile(validationData) {
  const fs = await import('fs');
  const csvPath = './scripts/validation-data.csv';

  if (!fs.existsSync(csvPath)) {
    console.warn(`[WARN] CSV file not found at ${csvPath}, returning synthetic data`);
    return validationData.map((row, idx) => ({
      ...row,
      location_iq: 50 + Math.random() * 40,
      vision_iq: 45 + Math.random() * 45,
      fit_iq: 48 + Math.random() * 42,
      outcome: (idx % 2) ? 1 : 0,
    }));
  }

  console.log(`[FETCH] Reading from ${csvPath}...`);

  const csv = fs.readFileSync(csvPath).toString();
  const lines = csv.split('\n');
  const header = lines[0].split(',');

  const csvRows = lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const values = line.split(',');
      const row = {};
      header.forEach((h, i) => {
        row[h.trim()] = values[i]?.trim();
      });
      return row;
    });

  // Build geoid+concept → CSV row map
  const csvMap = {};
  for (const row of csvRows) {
    const key = `${row.geoid}|${row.concept_type}`;
    if (!csvMap[key]) csvMap[key] = row;
  }

  // Enrich validation data
  const enriched = validationData.map((vRow) => {
    const geoid = vRow.geoid || vRow.neighborhood;
    const concept = vRow.concept_type || 'default';
    const key = `${geoid}|${concept}`;

    const csvRow = csvMap[key];

    return {
      ...vRow,
      location_iq: csvRow?.location_iq ? parseFloat(csvRow.location_iq) : 50,
      vision_iq: csvRow?.vision_iq ? parseFloat(csvRow.vision_iq) : 50,
      fit_iq: csvRow?.fit_iq ? parseFloat(csvRow.fit_iq) : 50,
      outcome: csvRow?.outcome ? parseInt(csvRow.outcome) : null,
    };
  });

  console.log(`[ENRICH] Enriched ${enriched.filter(r => r.outcome !== null).length}/${enriched.length} records from CSV`);

  return enriched;
}

/**
 * EXAMPLE 5: Multi-source fallback (try Supabase, fall back to CSV, then synthetic)
 *
 * Robust approach for development/testing where some data sources may be incomplete
 */
async function enrichWithActualScores_MultiSourceFallback(validationData) {
  let enriched;

  // Try Supabase first
  try {
    console.log('[MULTI-SOURCE] Attempting Supabase fetch...');
    enriched = await enrichWithActualScores_LocationTables(validationData);
    const withOutcome = enriched.filter(r => r.outcome !== null).length;
    if (withOutcome > validationData.length * 0.8) {
      console.log(`[MULTI-SOURCE] Success: ${withOutcome} records with outcomes from Supabase`);
      return enriched;
    }
    console.log(`[MULTI-SOURCE] Only ${withOutcome} records, trying fallback...`);
  } catch (err) {
    console.warn(`[MULTI-SOURCE] Supabase fetch failed: ${err.message}`);
  }

  // Try CSV fallback
  try {
    console.log('[MULTI-SOURCE] Attempting CSV fallback...');
    enriched = await enrichWithActualScores_CSVFile(validationData);
    const withOutcome = enriched.filter(r => r.outcome !== null).length;
    if (withOutcome > validationData.length * 0.5) {
      console.log(`[MULTI-SOURCE] Success: ${withOutcome} records with outcomes from CSV`);
      return enriched;
    }
  } catch (err) {
    console.warn(`[MULTI-SOURCE] CSV fallback failed: ${err.message}`);
  }

  // Final fallback: synthetic data
  console.log('[MULTI-SOURCE] Using synthetic data for validation');
  return validationData.map((row, idx) => ({
    ...row,
    location_iq: 50 + Math.random() * 40,
    vision_iq: 45 + Math.random() * 45,
    fit_iq: 48 + Math.random() * 42,
    outcome: (idx % 2) ? 1 : 0,
  }));
}

export {
  enrichWithActualScores_LocationTables,
  enrichWithActualScores_BlockGroupV4,
  enrichWithActualScores_RegressionData,
  enrichWithActualScores_CSVFile,
  enrichWithActualScores_MultiSourceFallback,
};
