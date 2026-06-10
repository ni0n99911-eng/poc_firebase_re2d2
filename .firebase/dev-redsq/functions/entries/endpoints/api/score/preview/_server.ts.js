import { r as resolveConceptType, c as computeDynamicVisionIQ } from "../../../../../chunks/six-index.js";
import { b as buildDynamicConfig, c as computeVisionImpact } from "../../../../../chunks/dynamic-concept-config.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../../chunks/rate-limit.js";
import { a as fitGrade } from "../../../../../chunks/decision-engine.js";
import { C as CONFIDENCE_BANDS } from "../../../../../chunks/scoring-thresholds.js";
import { c as computeCanonicalFitIQ } from "../../../../../chunks/bundle-builder.js";
const TOTAL_VISION_INPUTS = 12;
const SPARSE_VISION_CEILINGS = {
  commodity: 30,
  // v1.1: was 35 — $4.50 drip has near-zero vision value
  standard: 50,
  // unchanged
  differentiated: 75,
  // v1.1: was 65 — differentiated concepts earn stronger baseline
  highly_differentiated: 90
  // v1.1: was 75 — $9 protein coffee has built-in premium positioning
};
function deriveScoreConfidence(visionCompleteness) {
  const filled = Math.round(visionCompleteness * TOTAL_VISION_INPUTS);
  if (visionCompleteness < CONFIDENCE_BANDS.preliminary) {
    return {
      scoreConfidence: "preliminary",
      scoreConfidenceReason: `Only ${filled} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score may shift as you add more.`
    };
  }
  if (visionCompleteness < CONFIDENCE_BANDS.partial) {
    return {
      scoreConfidence: "partial",
      scoreConfidenceReason: `${filled} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score is stabilizing.`
    };
  }
  return {
    scoreConfidence: "confident",
    scoreConfidenceReason: `${filled} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score is reliable for decision-making.`
  };
}
const POST = async ({ request }) => {
  const limited = rateLimit(request, RATE_LIMITS.intel);
  if (limited) return limited;
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const {
    businessType = "cafe",
    conceptAnswers = {},
    indexScores,
    locationIQScore,
    avgTicket,
    visionTier
  } = body;
  if (!indexScores || typeof indexScores !== "object") {
    return new Response(
      JSON.stringify({
        error: "indexScores is required. Send the 8 dimension scores from the current GET /api/location-iq response (sixIndex.indices[X].score)."
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  for (const [k, v] of Object.entries(indexScores)) {
    if (typeof v !== "number" || isNaN(v) || v < 0 || v > 100) {
      return new Response(
        JSON.stringify({
          error: `indexScores.${k} must be a number between 0 and 100 (got ${JSON.stringify(v)})`
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }
  try {
    const conceptType = resolveConceptType(businessType);
    const dynamicConfig = buildDynamicConfig(conceptType, conceptAnswers);
    const dynamicVisionIQ = computeDynamicVisionIQ(indexScores, dynamicConfig);
    const answersUsed = Object.keys(conceptAnswers).length;
    const visionCompleteness = Math.min(1, answersUsed / TOTAL_VISION_INPUTS);
    let effectiveVisionScore = dynamicVisionIQ.score;
    let sparseInputCapped = false;
    if (visionCompleteness < 0.5) {
      const tier = visionTier || "standard";
      const ceiling = SPARSE_VISION_CEILINGS[tier] ?? 50;
      if (effectiveVisionScore > ceiling) {
        effectiveVisionScore = ceiling;
        sparseInputCapped = true;
      }
    }
    const safeVision = isNaN(effectiveVisionScore) ? 50 : effectiveVisionScore;
    let fitScore = null;
    if (typeof locationIQScore === "number" && !isNaN(locationIQScore)) {
      fitScore = computeCanonicalFitIQ(locationIQScore, safeVision);
    }
    const { scoreConfidence, scoreConfidenceReason } = deriveScoreConfidence(visionCompleteness);
    const visionImpact = computeVisionImpact(conceptType, conceptAnswers);
    return new Response(
      JSON.stringify({
        visionIQ: {
          ...dynamicVisionIQ,
          score: effectiveVisionScore,
          // override with capped score if sparse
          isDynamic: true,
          conceptType,
          answersUsed,
          // F1 traceability: expose the raw vs capped values so UX/CTO can debug
          rawScore: dynamicVisionIQ.score,
          sparseInputCapped,
          visionTier: visionTier || "standard"
        },
        fitIQ: fitScore != null ? {
          score: fitScore,
          grade: fitGrade(fitScore),
          isDynamic: true,
          source: "preview",
          locationIQWeight: 0.6,
          visionIQWeight: 0.4
        } : null,
        scoreConfidence,
        scoreConfidenceReason,
        visionCompleteness,
        totalVisionInputs: TOTAL_VISION_INPUTS,
        // BR-01 + BR-03: upside + per-field impact — same shape as /api/location-iq POST.
        maxUpside: visionImpact.maxUpside,
        perFieldImpact: visionImpact.perFieldImpact,
        visionImpactSummary: {
          totalQuestions: visionImpact.totalQuestions,
          answeredCount: visionImpact.answeredCount,
          unansweredCount: visionImpact.unansweredCount
        },
        // Calibration traceability: echo back avgTicket + visionTier so
        // localStorage and UX can trace which tier produced which score.
        avgTicket: avgTicket ?? 5,
        visionTier: visionTier || "standard",
        // Tell the UI this is a non-persisted preview. UX-20 can use this to
        // render a subtle "preview" hint next to the animated number.
        preview: true
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (e) {
    console.error("[ScorePreview] Error:", e);
    return new Response(
      JSON.stringify({
        error: "Internal error computing score preview",
        message: e instanceof Error ? e.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
export {
  POST
};
