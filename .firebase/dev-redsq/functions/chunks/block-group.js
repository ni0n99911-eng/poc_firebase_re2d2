import { d as db } from "./db-server.js";
import { sql } from "drizzle-orm";
import { V as VALID_BUSINESS_TYPES, n as normalizeBusinessType, B as BUSINESS_TYPE_CONFIGS } from "./business-type-registry.js";
const VALID_CONCEPTS = [...VALID_BUSINESS_TYPES];
const FIPS_CACHE = {};
async function latLngToGeoid(lat, lng) {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (cacheKey in FIPS_CACHE) return FIPS_CACHE[cacheKey];
  try {
    const fccUrl = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&censusYear=2020&format=json`;
    const fccRes = await fetch(fccUrl, { signal: AbortSignal.timeout(1e4) });
    if (fccRes.ok) {
      const fccData = await fccRes.json();
      const fips = fccData?.Block?.FIPS;
      if (fips && fips.length >= 12) {
        const geoid = fips.substring(0, 12);
        FIPS_CACHE[cacheKey] = geoid;
        return geoid;
      }
    }
    console.warn("[BlockGroup] FCC API failed or returned no result, trying Census Bureau fallback");
    const censusUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=10&format=json`;
    const censusRes = await fetch(censusUrl, { signal: AbortSignal.timeout(1e4) });
    if (censusRes.ok) {
      const censusData = await censusRes.json();
      const results = censusData?.result?.geographies?.["Census Block Groups"]?.[0];
      if (results?.GEOID) {
        FIPS_CACHE[cacheKey] = results.GEOID;
        return results.GEOID;
      }
    }
    console.warn("[BlockGroup] Both FCC and Census geocoding APIs failed");
    FIPS_CACHE[cacheKey] = null;
    return null;
  } catch (e) {
    console.warn("[BlockGroup] FIPS lookup error:", e instanceof Error ? e.message : e);
    FIPS_CACHE[cacheKey] = null;
    return null;
  }
}
const COUNTY_TO_BOROUGH = {
  "061": "Manhattan",
  "005": "Bronx",
  "047": "Brooklyn",
  "081": "Queens",
  "085": "Staten Island"
};
function geoidToBorough(geoid) {
  if (geoid.length >= 5) {
    const county = geoid.substring(2, 5);
    return COUNTY_TO_BOROUGH[county] || "NYC";
  }
  return "NYC";
}
function gradeFromScore(score) {
  if (score >= 93) return "A+";
  if (score >= 87) return "A";
  if (score >= 80) return "A-";
  if (score >= 73) return "B+";
  if (score >= 67) return "B";
  if (score >= 60) return "B-";
  if (score >= 53) return "C+";
  if (score >= 47) return "C";
  if (score >= 40) return "C-";
  if (score >= 30) return "D";
  return "F";
}
async function getBlockGroupScores(geoid, conceptType) {
  try {
    if (conceptType) conceptType = normalizeBusinessType(conceptType);
    const suffix = conceptType ? `:${conceptType}` : "";
    const res = await db.execute(sql`SELECT score_type, score, components FROM block_group_scores WHERE geoid = ${geoid}`);
    if (!res.rows || res.rows.length === 0) return null;
    const data = res.rows;
    const scoreMap = {};
    for (const row of data) {
      scoreMap[row.score_type] = {
        score: row.score ?? 0,
        components: row.components ?? {}
      };
    }
    const fitKey = suffix && scoreMap[`fit_score${suffix}`] ? `fit_score${suffix}` : "fit_score";
    const fitRow = scoreMap[fitKey];
    const location_iq = scoreMap["location_iq"]?.score ?? 0;
    if (location_iq === 0 && !scoreMap["location_iq"]) return null;
    const fitScore = fitRow?.score ?? 0;
    const fitGrade = gradeFromScore(fitScore);
    const fitComponents = fitRow?.components ?? {};
    const fitSubScores = {
      market_proof: scoreMap[`fit_sub_market_proof${suffix}`]?.score ?? scoreMap["fit_sub_market_proof"]?.score ?? fitComponents.market_proof ?? 0,
      accessibility: scoreMap[`fit_sub_accessibility${suffix}`]?.score ?? scoreMap["fit_sub_accessibility"]?.score ?? fitComponents.accessibility ?? 0,
      vibrancy: scoreMap[`fit_sub_vibrancy${suffix}`]?.score ?? scoreMap["fit_sub_vibrancy"]?.score ?? fitComponents.vibrancy ?? 0,
      // demographics + competition: dedicated rows (future batch runs) fall back to fit_score.components
      demographics: scoreMap[`fit_sub_demographics${suffix}`]?.score ?? scoreMap["fit_sub_demographics"]?.score ?? fitComponents.demographics ?? 0,
      competition: scoreMap[`fit_sub_competition${suffix}`]?.score ?? scoreMap["fit_sub_competition"]?.score ?? fitComponents.competition ?? 0,
      // FIX: batch scorer writes "priceIncomeFit" (camelCase) but this code read "price_income_fit" (snake_case) → always 0.
      // Read both key forms so existing DB rows surface the value correctly.
      price_income_fit: scoreMap[`fit_sub_price_income_fit${suffix}`]?.score ?? scoreMap["fit_sub_price_income_fit"]?.score ?? fitComponents.price_income_fit ?? fitComponents.priceIncomeFit ?? 0
    };
    const locIQv2Key = suffix && scoreMap[`location_iq_v2${suffix}`] ? `location_iq_v2${suffix}` : "location_iq_v2";
    const locIQv2Row = scoreMap[locIQv2Key];
    const locIQv2Score = locIQv2Row?.score ?? 0;
    const locIQv2Components = locIQv2Row?.components;
    const locIQv2Grade = locIQv2Components?.grade || (locIQv2Score > 0 ? gradeFromScore(locIQv2Score) : void 0);
    const visionKey = suffix && scoreMap[`vision_iq${suffix}`] ? `vision_iq${suffix}` : "vision_iq";
    const visionRow = scoreMap[visionKey];
    const visionIQScore = visionRow?.score ?? 0;
    const visionIQComponents = visionRow?.components;
    const safetyScore = scoreMap["location_sub_safety"]?.score ?? 0;
    const momentumScore = scoreMap["location_sub_momentum"]?.score ?? 0;
    const rawSixVibrancy = scoreMap["six_vibrancy"]?.score ?? scoreMap["vibrancy"]?.score ?? 0;
    const liqV2Vibrancy = locIQv2Components?.vibrancy ?? 0;
    const sixVibrancy = liqV2Vibrancy > rawSixVibrancy ? Math.round(rawSixVibrancy * 0.4 + liqV2Vibrancy * 0.6) : rawSixVibrancy;
    const sixTransit = scoreMap["six_transit"]?.score ?? scoreMap["transit"]?.score ?? 0;
    if (fitSubScores.accessibility > 0 && sixTransit > 0) {
      fitSubScores.accessibility = Math.max(fitSubScores.accessibility, Math.max(0, sixTransit - 10));
    }
    const rawSurvivalRate = (scoreMap["six_survival_rate"]?.score ?? 0) > 0 ? Math.round(scoreMap["six_survival_rate"].score) : void 0;
    const survivalFloor = conceptType ? BUSINESS_TYPE_CONFIGS[conceptType]?.survivalBaseline ?? 0 : 0;
    const survivalRate = rawSurvivalRate !== void 0 ? Math.max(rawSurvivalRate, survivalFloor) : survivalFloor > 0 ? survivalFloor : void 0;
    return {
      geoid,
      location_iq,
      six_index: {
        // Try v3 prefixed keys first (six_transit), fall back to unprefixed (transit)
        transit: sixTransit,
        demographics: scoreMap["six_demographics"]?.score ?? scoreMap["demographics"]?.score ?? 0,
        competition: scoreMap["six_competition"]?.score ?? scoreMap["competition"]?.score ?? 0,
        vibrancy: sixVibrancy,
        safety: scoreMap["six_safety"]?.score ?? scoreMap["safety"]?.score ?? 0,
        momentum: scoreMap["six_momentum"]?.score ?? scoreMap["momentum"]?.score ?? 0
      },
      niq: scoreMap["niq"]?.score,
      siq: scoreMap["siq"]?.score,
      tiq: scoreMap["tiq"]?.score,
      liq: scoreMap["liq"]?.score,
      archetype_baselines: scoreMap["routine_interceptor"] ? {
        routine_interceptor: scoreMap["routine_interceptor"]?.score ?? 0,
        destination_pull: scoreMap["destination_pull"]?.score ?? 0,
        need_filler: scoreMap["need_filler"]?.score ?? 0
      } : void 0,
      // Cycle 2H fields (Fit IQ)
      fit_score: fitScore > 0 ? fitScore : void 0,
      fit_grade: fitScore > 0 ? fitGrade : void 0,
      fit_sub_scores: fitScore > 0 ? fitSubScores : void 0,
      fit_components: fitScore > 0 ? fitComponents : void 0,
      // V4 Three-Score Architecture
      location_iq_v2: locIQv2Score > 0 ? locIQv2Score : void 0,
      location_iq_v2_grade: locIQv2Grade || void 0,
      location_iq_v2_components: locIQv2Score > 0 ? locIQv2Components : void 0,
      vision_iq: visionIQScore > 0 ? visionIQScore : void 0,
      vision_iq_components: visionIQScore > 0 ? visionIQComponents : void 0,
      safety_score: safetyScore > 0 ? safetyScore : void 0,
      momentum_score: momentumScore > 0 ? momentumScore : void 0,
      survival_rate: survivalRate,
      neighborhood_health: (scoreMap["six_neighborhood_health"]?.score ?? 0) > 0 ? Math.round(scoreMap["six_neighborhood_health"].score) : void 0,
      concept_type: conceptType || "full_service_restaurant"
    };
  } catch {
    return null;
  }
}
async function getBlockGroupVision(geoid) {
  try {
    const res = await db.execute(sql`SELECT geoid, narrative, structured, model, generated_at FROM block_group_visions WHERE geoid = ${geoid} AND vision_type = 'location' LIMIT 1`);
    if (!res.rows || res.rows.length === 0) return null;
    return res.rows[0];
  } catch {
    return null;
  }
}
async function getBlockGroupIntel(lat, lng, conceptType) {
  const geoid = await latLngToGeoid(lat, lng);
  if (!geoid) return null;
  const borough = geoidToBorough(geoid);
  const [scores, vision] = await Promise.all([
    getBlockGroupScores(geoid, conceptType),
    getBlockGroupVision(geoid)
  ]);
  let serving_mode = "cold";
  if (scores || vision) {
    serving_mode = "stored";
  }
  return { geoid, borough, scores, vision, serving_mode };
}
export {
  VALID_CONCEPTS as V,
  getBlockGroupVision as a,
  geoidToBorough as b,
  getBlockGroupIntel as c,
  getBlockGroupScores as g,
  latLngToGeoid as l
};
