import { a as fetchEnhancedLocationIntel } from "./index3.js";
import { a as computeSixIndex, r as resolveConceptType, c as computeDynamicVisionIQ } from "./six-index.js";
import { n as normalizeBusinessType } from "./business-type-registry.js";
import { l as lookupHistoricalContext, c as computeConfidence, a as computeScoreAgreement } from "./data-quality-gate.js";
import { b as buildDynamicConfig } from "./dynamic-concept-config.js";
import { l as latLngToGeoid } from "./block-group.js";
import { d as detectBorough } from "./borough-bounds.js";
import { d as db } from "./db-server.js";
import { sql } from "drizzle-orm";
import { g as getSurvivalRate } from "./survival-rate.js";
import { c as computeLocationIQ } from "./location-iq.js";
function runIQScore(input) {
  const normalizedType = normalizeBusinessType(input.businessType);
  return computeSixIndex(
    input.report,
    normalizedType
  );
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
    const result2 = await db.execute(sql`
			SELECT score_type, score, components 
			FROM block_group_scores 
			WHERE geoid = ${geoid} AND score_type = ANY(${scoreTypes})
		`);
    data = result2.rows || [];
  } catch (error) {
    console.error("[BundleBuilder] fetchPrecomputedScores error:", error.message, `(code: ${error.code})`);
    return {};
  }
  const result = {};
  for (const row of data) {
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
function computeGeohash5(lat, lng) {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let mla = -90, xla = 90, mlo = -180, xlo = 180, il = true, b = 0, ix = 0, h = "";
  while (h.length < 5) {
    const md = il ? (mlo + xlo) / 2 : (mla + xla) / 2;
    const v = il ? lng : lat;
    if (v >= md) {
      ix = ix * 2 + 1;
      if (il) mlo = md;
      else mla = md;
    } else {
      ix = ix * 2;
      if (il) xlo = md;
      else xla = md;
    }
    il = !il;
    if (++b === 5) {
      h += BASE32[ix];
      b = 0;
      ix = 0;
    }
  }
  return h;
}
const FIT_LOCATION_WEIGHT = 0.6;
const FIT_VISION_WEIGHT = 0.4;
function computeCanonicalFitIQ(locationIQ, visionIQ) {
  return Math.round(locationIQ * FIT_LOCATION_WEIGHT + visionIQ * FIT_VISION_WEIGHT);
}
async function buildLocationScoreBundle(input) {
  const {
    lat,
    lng,
    address,
    conceptAnswers,
    useAI = false,
    signal
  } = input;
  const normalizedBusinessType = normalizeBusinessType(input.businessType);
  const geoid = await latLngToGeoid(lat, lng);
  let precomputed = {};
  if (geoid) {
    precomputed = await fetchPrecomputedScores(geoid, normalizedBusinessType);
  }
  if (geoid) {
    const borough = detectBorough(lat, lng)?.name ?? "Manhattan";
    const survResult = await getSurvivalRate(geoid, normalizedBusinessType, borough).catch(() => null);
    if (survResult) {
      precomputed.survivalRate = survResult.rate;
    }
  }
  const report = await fetchEnhancedLocationIntel(lat, lng, normalizedBusinessType, address, { useAI, signal });
  const geohash = computeGeohash5(lat, lng);
  const historicalEntries = await lookupHistoricalContext(geohash).catch(() => []);
  const historicalImpactTypes = historicalEntries.map((e) => e.impact_type);
  const iq = computeLocationIQ(
    report,
    normalizedBusinessType,
    historicalImpactTypes.length > 0 ? historicalImpactTypes : void 0
  );
  const confidence = computeConfidence(report, normalizedBusinessType);
  const sixIndex = runIQScore({
    report,
    businessType: normalizedBusinessType
  });
  const locationIQ = sixIndex.locationIQ;
  const sixScores = {};
  for (const [name, idx] of Object.entries(sixIndex.indices)) {
    sixScores[name] = idx.score;
  }
  confidence.scoreAgreement = computeScoreAgreement(sixScores);
  let visionIQ = precomputed.visionIQ ?? null;
  let fitScore = precomputed.fitIQ ?? null;
  if (conceptAnswers && Object.keys(conceptAnswers).length > 0) {
    const conceptType = resolveConceptType(normalizedBusinessType);
    const dynamicConfig = buildDynamicConfig(conceptType, conceptAnswers);
    const dynamicVision = computeDynamicVisionIQ(
      sixScores,
      dynamicConfig
    );
    visionIQ = dynamicVision.score;
    fitScore = computeCanonicalFitIQ(locationIQ, visionIQ);
  }
  return {
    report,
    geoid,
    precomputed,
    iq,
    confidence,
    sixIndex,
    historicalImpactTypes,
    locationIQ,
    sixScores,
    visionIQ,
    fitScore,
    normalizedBusinessType
  };
}
export {
  buildLocationScoreBundle as b,
  computeCanonicalFitIQ as c
};
