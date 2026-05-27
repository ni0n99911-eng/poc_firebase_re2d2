/**
 * V4 Patch 001: Inject Hybrid Outcome Data into Market Proof
 *
 * This patch modifies computeMarketProof() in score-all-v4.mjs to blend in
 * the hybrid_outcomes data from block_group_intel.
 *
 * BEFORE (current):
 *   Market Proof = Foursquare independent count (65%) + ratio (35%)
 *                  blended with DCA ecosystem (20%) and DOHMH density (15%)
 *
 * AFTER (with hybrid feedback):
 *   Market Proof = [existing signals × 0.60] + [hybrid outcome score × 0.40]
 *   When hybrid data is absent, falls back to 100% existing signals (no change)
 *
 * The 60/40 blend was chosen because:
 * - Hybrid outcomes are actual observed business success (stronger signal)
 * - But they're backward-looking (businesses that exist now, not predictive)
 * - Location characteristics (Foursquare/DCA) capture potential that hybrid can't
 * - 40% weight gives hybrid meaningful influence without overfitting to survivors
 *
 * TO APPLY: Replace computeMarketProof() in score-all-v4.mjs with this version
 */

// New version of computeMarketProof that consumes hybrid_outcomes
function computeMarketProof(report, conceptType, rawBgi) {
  let locationScore = 35;  // baseline when no data

  // ── Existing signals (unchanged) ──
  if (report.foursquare) {
    const indep = report.foursquare.independentCount || 0;
    const total = report.foursquare.venueCount || 0;

    const indepScore = scoreLinear(indep, 15, 50);
    const indepRatio = total > 0 ? indep / total : 0.5;
    const ratioScore = clamp(Math.round(indepRatio * 120));

    locationScore = Math.round(indepScore * 0.65 + ratioScore * 0.35);
  }

  if (report.dcaLicenses) {
    const dcaScore = report.dcaLicenses.ecosystemScore;
    if (!report.foursquare) {
      locationScore = dcaScore;
    } else {
      locationScore = Math.round(locationScore * 0.80 + dcaScore * 0.20);
    }
  }

  if (report.inspections?.totalNearby) {
    const inspDensity = scoreLinear(report.inspections.totalNearby, 30, 250);
    locationScore = Math.round(locationScore * 0.85 + inspDensity * 0.15);
  }

  // ── NEW: Hybrid outcome data ──
  const hybrid = rawBgi?.hybrid_outcomes;
  if (hybrid) {
    let outcomeScore = null;

    // Try concept-specific outcome first
    if (conceptType && hybrid.by_concept?.[conceptType]) {
      const conceptOutcome = hybrid.by_concept[conceptType];
      if (conceptOutcome.confidence >= 30) {  // At least 30% confidence (n ≥ 6)
        outcomeScore = conceptOutcome.score;
      }
    }

    // Fall back to all-food outcome
    if (outcomeScore === null && hybrid.all_food) {
      if (hybrid.all_food.confidence >= 20) {  // At least 20% confidence (n ≥ 4)
        outcomeScore = hybrid.all_food.score;
      }
    }

    if (outcomeScore !== null) {
      // Blend: 60% location signals + 40% hybrid outcomes
      // The hybrid weight scales with confidence: at 100% confidence, full 40% weight
      // At 50% confidence, only 20% weight
      const hybridConfidence = (hybrid.by_concept?.[conceptType]?.confidence || hybrid.all_food?.confidence || 0) / 100;
      const hybridWeight = 0.40 * hybridConfidence;
      const locationWeight = 1.0 - hybridWeight;

      locationScore = clamp(Math.round(locationScore * locationWeight + outcomeScore * hybridWeight));
    }
  }

  return clamp(locationScore);
}

// Export for testing
export { computeMarketProof };
