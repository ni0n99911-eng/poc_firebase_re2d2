import "../../../../chunks/cache.js";
import { d as detectBorough } from "../../../../chunks/borough-bounds.js";
import { b as SIGNAL_KILL_FLOOR, C as CONFIDENCE_BANDS } from "../../../../chunks/scoring-thresholds.js";
import "../../../../chunks/retry.js";
import { r as resolveConceptType, c as computeDynamicVisionIQ } from "../../../../chunks/six-index.js";
import { d as db } from "../../../../chunks/db-server.js";
import { b as buildDynamicConfig, c as computeVisionImpact } from "../../../../chunks/dynamic-concept-config.js";
import "../../../../chunks/data-quality-gate.js";
import { sql } from "drizzle-orm";
import { l as latLngToGeoid } from "../../../../chunks/block-group.js";
import { g as getSurvivalRate } from "../../../../chunks/survival-rate.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
import { d as fitGradeCappedWithReason } from "../../../../chunks/decision-engine.js";
const DATA_TIER_MULTIPLIER = {
  cold: 1,
  // Full timeout — all APIs must be called
  warm: 0.65,
  // Partial cache — some APIs need refresh
  hot: 0.35
  // Fully cached — only Supabase reads
};
const LOCATION_QUALITY_MULTIPLIER = {
  prime: 1.25,
  // Top-tier — user is deep in analysis, maximize data quality
  strong: 1.15,
  // High-value — extra patience for complete results
  promising: 1,
  // Baseline — standard timeout
  developing: 0.85,
  // Low-tier — fail faster, data less critical
  unknown: 1
  // No prior score — treat as baseline
};
const NETLIFY_CEILING = {
  free: 9500,
  // 10s limit - 500ms buffer
  pro: 25e3
  // 26s limit - 1s buffer
};
function getAdaptiveTimeout(base = 8e3, dataTier = "cold", locationQuality = "unknown") {
  const tier = typeof process !== "undefined" ? process.env?.NETLIFY_TIER : void 0;
  const ceiling = tier === "pro" ? NETLIFY_CEILING.pro : NETLIFY_CEILING.free;
  const scaledBase = tier === "pro" ? base * 2.5 : base;
  const adjusted = scaledBase * DATA_TIER_MULTIPLIER[dataTier] * LOCATION_QUALITY_MULTIPLIER[locationQuality];
  return Math.max(2e3, Math.min(adjusted, ceiling));
}
const TOTAL_VISION_INPUTS = 12;
function deriveScoreConfidence(visionCompleteness) {
  if (visionCompleteness < CONFIDENCE_BANDS.preliminary) {
    return {
      scoreConfidence: "preliminary",
      scoreConfidenceReason: `Only ${Math.round(visionCompleteness * TOTAL_VISION_INPUTS)} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score may shift as you add more.`
    };
  }
  if (visionCompleteness < CONFIDENCE_BANDS.partial) {
    return {
      scoreConfidence: "partial",
      scoreConfidenceReason: `${Math.round(visionCompleteness * TOTAL_VISION_INPUTS)} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score is stabilizing.`
    };
  }
  return {
    scoreConfidence: "confident",
    scoreConfidenceReason: `${Math.round(visionCompleteness * TOTAL_VISION_INPUTS)} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score is reliable for decision-making.`
  };
}
async function fetchPrecomputedScores(geoid, conceptType) {
  const scoreTypes = ["six_neighborhood_health", "six_survival_rate", "six_commercial_density"];
  if (conceptType) {
    scoreTypes.push(`halo:${conceptType}`);
    scoreTypes.push(`vision_iq:${conceptType}`);
    scoreTypes.push(`fit_score:${conceptType}`);
  }
  let data = [];
  try {
    const placeholders = scoreTypes.map((s) => sql`${s}`);
    const query = sql`SELECT score_type, score, components FROM block_group_scores WHERE geoid = ${geoid} AND score_type IN (${sql.join(placeholders, sql`, `)})`;
    const res = await db.execute(query);
    data = res.rows;
  } catch (error) {
    console.error("[LocationIQ] fetchPrecomputedScores error:", error.message, `(code: ${error.code})`);
    return {};
  }
  const result = {};
  for (const row of data || []) {
    if (row.score_type === "six_neighborhood_health") result.neighborhoodHealth = row.score;
    if (row.score_type === "six_survival_rate") result.survivalRate = row.score;
    if (row.score_type === "six_commercial_density") result.commercialDensity = row.score;
    if (row.score_type.startsWith("halo:")) result.haloScore = row.score;
    if (row.score_type.startsWith("vision_iq:")) result.visionIQ = row.score;
    if (row.score_type.startsWith("fit_score:")) {
      result.fitIQ = row.score;
      result.fitComponents = row.components || {};
    }
  }
  return result;
}
const GET = async ({ url, request }) => {
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const businessType = url.searchParams.get("type") || "specialty_coffee";
  if (isNaN(lat) || isNaN(lng)) {
    return new Response(JSON.stringify({ error: "Missing or invalid lat/lng parameters" }), { status: 400 });
  }
  try {
    const { getGoldenRecord } = await import("../../../../chunks/snowflake.js");
    const record = await getGoldenRecord(lat, lng, businessType);
    if (!record) {
      return new Response(JSON.stringify({ error: "No score found in Snowflake for this location" }), { status: 404 });
    }
    const iqScore = Math.round(record.FINAL_LOCATION_IQ || 50);
    let grade = "C";
    if (iqScore >= 90) grade = "A+";
    else if (iqScore >= 80) grade = "A";
    else if (iqScore >= 70) grade = "B";
    else if (iqScore >= 60) grade = "C";
    else grade = "D";
    const responseBody = {
      lat,
      lng,
      businessType,
      locationIQ: iqScore,
      grade,
      verdict: `Scored ${iqScore}/100. Ranked in the top ${Math.round((1 - (record.CATEGORY_PERCENTILE || 0)) * 100)}% of locations.`,
      sixIndex: {
        locationIQ: iqScore,
        grade,
        conceptType: businessType,
        conceptLabel: businessType.replace("_", " "),
        indices: {
          competition: { score: record.COMPETITION_CONTEXT_SCORE, weight: 15, label: "Competition Context" },
          vibrancy: { score: record.MORNING_FOOT_TRAFFIC_SCORE, weight: 40, label: "Morning Foot Traffic" },
          demographics: { score: record.DEMOGRAPHICS_FIT_SCORE, weight: 20, label: "Demographics Fit" },
          safety: { score: record.SAFETY_SCORE, weight: 5, label: "Safety" },
          transit: { score: record.MORNING_FOOT_TRAFFIC_SCORE, weight: 10, label: "Transit" },
          momentum: { score: record.BUSINESS_SURVIVAL_SCORE, weight: 10, label: "Momentum" }
        },
        signals: [],
        coffeeDimensions: businessType === "specialty_coffee" ? {
          morningFootTraffic: record.MORNING_FOOT_TRAFFIC_SCORE,
          dailyRitualDensity: record.DAILY_RITUAL_DENSITY_SCORE,
          competitionContext: record.COMPETITION_CONTEXT_SCORE,
          streetSide: record.STREET_SIDE_SCORE,
          demographicsFit: record.DEMOGRAPHICS_FIT_SCORE,
          baseViability: record.BUSINESS_SURVIVAL_SCORE,
          visionMultiplier: 1,
          rawComposite: iqScore
        } : void 0
      },
      lenses: [
        { dimension: "competition", label: "Competitors", uxLabel: "Competitors", score: record.COMPETITION_CONTEXT_SCORE, verdictLine: `Active competitors: ${record.TOTAL_COMPETITORS || 0}`, topSignals: [], mapHighlights: [] },
        { dimension: "vibrancy", label: "Concept Pulse", uxLabel: "Concept Pulse", score: record.MORNING_FOOT_TRAFFIC_SCORE, verdictLine: `Estimated morning passersby: ${record.ESTIMATED_MORNING_PASSERSBY || 0}`, topSignals: [], mapHighlights: [] },
        { dimension: "demographics", label: "Demographics", uxLabel: "Who lives here", score: record.DEMOGRAPHICS_FIT_SCORE, verdictLine: `Median Household Income: $${record.MEDIAN_HOUSEHOLD_INCOME || 0}`, topSignals: [], mapHighlights: [] },
        { dimension: "safety", label: "Safety", uxLabel: "Safety", score: record.SAFETY_SCORE, verdictLine: "Powered by Snowflake", topSignals: [], mapHighlights: [] },
        { dimension: "transit", label: "Transit", uxLabel: "Transit & Access", score: record.MORNING_FOOT_TRAFFIC_SCORE, verdictLine: "Powered by Snowflake", topSignals: [], mapHighlights: [] },
        { dimension: "momentum", label: "Momentum", uxLabel: "Momentum", score: record.BUSINESS_SURVIVAL_SCORE, verdictLine: "Powered by Snowflake", topSignals: [], mapHighlights: [] }
      ],
      threeScores: { locationIQ: { score: iqScore, grade }, visionIQ: { available: false }, fitIQ: { available: false } },
      confidence: { level: "CONFIDENT", scoreAgreement: 0.8 },
      confidenceBySource: { transit: 100, safety: 100, demographics: 100, competition: 100, vibrancy: 100, momentum: 100, vision: 100 },
      dataSourceQuality: { competitors: "verified" },
      dataFreshness: { ageLabel: "Live from Snowflake", sources: [] },
      reconciled: { totalEntities: 0 },
      rawIntelErrors: []
    };
    return new Response(JSON.stringify(responseBody), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[LocationIQ] ERROR:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
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
  const { lat, lng, businessType = "cafe", conceptAnswers, indexScores, locationIQScore } = body;
  if (!conceptAnswers || Object.keys(conceptAnswers).length === 0) {
    return new Response(JSON.stringify({ error: "conceptAnswers is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const postTimeoutMs = getAdaptiveTimeout(5e3, "warm");
    console.log(`[LocationIQ POST] F-09 timeout ceiling: ${postTimeoutMs}ms`);
    const conceptType = resolveConceptType(businessType);
    const dynamicConfig = buildDynamicConfig(conceptType, conceptAnswers);
    let scores;
    let precomputed;
    if (indexScores) {
      scores = indexScores;
    } else if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      const geoid = await latLngToGeoid(lat, lng);
      if (!geoid) {
        return new Response(JSON.stringify({ error: "Could not resolve block group for coordinates" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      precomputed = await fetchPrecomputedScores(geoid, businessType);
      const borough = detectBorough(lat, lng)?.name ?? "Manhattan";
      const survResult = await getSurvivalRate(geoid, businessType, borough).catch(() => null);
      if (precomputed && survResult) {
        precomputed.survivalRate = survResult.rate;
      }
      scores = {
        transit: 50,
        demographics: 50,
        competition: 50,
        vibrancy: 50,
        safety: 50,
        momentum: 50,
        neighborhoodHealth: precomputed.neighborhoodHealth ?? 60,
        survivalRate: precomputed.survivalRate ?? 55
      };
    } else {
      return new Response(JSON.stringify({ error: "Either indexScores or lat/lng is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const dynamicVisionIQ = computeDynamicVisionIQ(scores, dynamicConfig);
    const locScore = locationIQScore ?? 50;
    let fitScore;
    let fitSource;
    if (precomputed?.fitIQ != null && precomputed.fitIQ > 0) {
      fitScore = Math.round(precomputed.fitIQ);
      fitSource = "batch";
      console.log(`[LocationIQ] FitIQ from batch scores: ${fitScore} (concept: ${conceptType})`);
    } else {
      fitScore = Math.round(locScore * 0.6 + dynamicVisionIQ.score * 0.4);
      fitSource = "live";
      console.log(`[LocationIQ] FitIQ from live blend: ${fitScore} (no batch score for ${conceptType})`);
    }
    const answersUsed = Object.keys(conceptAnswers).length;
    const visionCompleteness = Math.min(1, answersUsed / TOTAL_VISION_INPUTS);
    const { scoreConfidence, scoreConfidenceReason } = deriveScoreConfidence(visionCompleteness);
    const visionImpact = computeVisionImpact(conceptType, conceptAnswers);
    const visionConfidence = Math.round(Math.max(0, Math.min(1, visionCompleteness)) * 100);
    return new Response(JSON.stringify({
      visionIQ: {
        ...dynamicVisionIQ,
        isDynamic: true,
        conceptType,
        answersUsed
      },
      fitIQ: (() => {
        const postCap = fitGradeCappedWithReason(fitScore, {
          safety: scores.safety,
          survivalRatePct: precomputed?.survivalRate ?? scores.survivalRate
        });
        return {
          score: fitScore,
          // BR-1 canonical grade from decision-engine (A/B/C/D/F).
          // Previous drifted thresholds (87/73/60/47) are removed.
          grade: postCap.grade,
          gradeCapReason: postCap.capReason,
          isDynamic: fitSource === "live",
          source: fitSource,
          locationIQWeight: fitSource === "live" ? 0.6 : void 0,
          visionIQWeight: fitSource === "live" ? 0.4 : void 0
        };
      })(),
      // B3-2.5: Kill-factor payload — scores that are below the kill threshold.
      // POST handler scans the `scores` object (constructed for dynamic VIQ).
      killFactors: (() => {
        const KILL_THRESHOLD = SIGNAL_KILL_FLOOR;
        const dimLabels = {
          transit: "Transit & walkability",
          demographics: "Demographics",
          competition: "Competition density",
          vibrancy: "Vibrancy",
          safety: "Safety",
          momentum: "Neighborhood momentum",
          neighborhoodHealth: "Neighborhood health",
          survivalRate: "1-year survival rate"
        };
        const killed = [];
        for (const [dim, score] of Object.entries(scores)) {
          if (typeof score === "number" && score > 0 && score < KILL_THRESHOLD) {
            killed.push({
              name: dim,
              reason: `${dimLabels[dim] || dim} scored ${score} — below kill threshold (${KILL_THRESHOLD}).`,
              threshold: KILL_THRESHOLD,
              actual: score
            });
          }
        }
        return killed;
      })(),
      // BR-02: confidence envelope — UX reads these to render PRELIM / PARTIAL / CONFIDENT stamps.
      scoreConfidence,
      scoreConfidenceReason,
      visionCompleteness,
      // §1b: partial confidenceBySource — UX spread-merges into its stored map.
      confidenceBySource: {
        vision: visionConfidence
      },
      totalVisionInputs: TOTAL_VISION_INPUTS,
      // BR-01 + BR-03: upside + per-field impact — UX reads these instead of hand-tuned constants.
      maxUpside: visionImpact.maxUpside,
      perFieldImpact: visionImpact.perFieldImpact,
      visionImpactSummary: {
        totalQuestions: visionImpact.totalQuestions,
        answeredCount: visionImpact.answeredCount,
        unansweredCount: visionImpact.unansweredCount
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  } catch (e) {
    console.error("[LocationIQ POST] Error computing dynamic Vision IQ:", e);
    return new Response(JSON.stringify({
      error: "Internal error computing dynamic Vision IQ",
      message: e instanceof Error ? e.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
export {
  GET,
  POST
};
