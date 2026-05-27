#!/usr/bin/env node
/**
 * aggregate-halo-scores.mjs — STUB (not yet implemented)
 *
 * Intended purpose: populate `halo:${conceptType}` rows in
 * `block_group_scores` so the compare-v2 / location-iq pipeline
 * can read cluster-halo lift values instead of falling back to null.
 *
 * Current status: NOT IMPLEMENTED.
 * The V4 scorer writes `vision_iq:${conceptType}` rows, but halo
 * rows are never written. All halo lookups currently return null
 * and are handled gracefully by `?? null` fallbacks downstream.
 *
 * Implementation spec: docs/cluster-detection-spec.md (BR-8)
 *
 * BR-8 defines halo as a blend of:
 *   1. Cluster compatibility — does this block group sit inside a
 *      peer cluster for the target concept (e.g. restaurant rows,
 *      coffee corridors, fitness strips)?
 *   2. Building facing — does the storefront face a high-traffic
 *      corridor vs a quiet side street? Requires NYC LION + MapPLUTO.
 *   3. Concept compatibility matrix — some concepts benefit from
 *      neighbors (bakery near coffee), others compete (two pizza
 *      shops on one block).
 *
 * Building this properly requires:
 *   - PostGIS enabled on block_group_scores (see project_postgis_backlog)
 *   - NYC LION street centerlines
 *   - NYC MapPLUTO building footprints
 *   - Multi-day implementation + calibration against real outcomes
 *
 * Until BR-8 ships, this script is a no-op stub so that:
 *   (a) the file exists and has valid syntax,
 *   (b) accidentally running it is harmless,
 *   (c) the intended schema + target concepts are documented here,
 *   (d) future implementers have a clear entry point.
 *
 * DO NOT wire this into any cron, CI, or deployment until BR-8 is
 * actually implemented. Calibrate, never wholesale-overwrite.
 */

const TARGET_CONCEPTS = [
  'specialty_coffee',
  'fast_casual',
  'full_service_restaurant',
  'bar_lounge',
  'boutique_retail',
  'fitness_wellness',
  'bakery',
  'juice_smoothie',
  'pizza',
  'bubble_tea',
  'wine_bar',
  'coworking',
  'salon_barbershop',
];

/**
 * Intended row shape when this script is implemented:
 *
 * {
 *   geoid: '360470001001',                  // block group GEOID
 *   score_type: 'halo:specialty_coffee',    // one row per concept per bg
 *   score: 0.72,                            // 0..1 halo lift factor
 *   payload: {
 *     cluster_compatibility: 0.68,
 *     building_facing: 0.81,
 *     concept_matrix_lift: 0.05,
 *     peer_count: 12,
 *     corridor_rank: 3,
 *     computed_at: '2026-04-10T...'
 *   }
 * }
 */

function log(msg) {
  console.log(`[halo-stub] ${msg}`);
}

async function main() {
  log('aggregate-halo-scores.mjs is a stub — BR-8 not yet implemented.');
  log('Spec: docs/cluster-detection-spec.md');
  log(`Target concepts (${TARGET_CONCEPTS.length}): ${TARGET_CONCEPTS.join(', ')}`);
  log('No rows will be written. Exiting cleanly.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[halo-stub] unexpected error:', err);
  process.exit(1);
});
