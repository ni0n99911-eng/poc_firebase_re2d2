import { d as db } from "./db-server.js";
import { sql } from "drizzle-orm";
import { S as SURVIVAL_DISCOUNT_FACTORS, a as SURVIVAL_DISCOUNT_DEFAULT } from "./scoring-thresholds.js";
import { i as intelCache, T as TTL } from "./cache.js";
function classifyConcept(concept) {
  const c = (concept || "").toLowerCase().trim();
  if (c.includes("restaurant") || c.includes("cafe") || c.includes("coffee") || c.includes("bakery") || c.includes("deli") || c.includes("pizza") || c.includes("food") || c.includes("juice") || c.includes("ice cream") || c.includes("sushi") || c.includes("ramen") || c.includes("bagel") || c.includes("sandwich") || c.includes("taco") || c.includes("burger")) {
    return null;
  }
  if (c.includes("bar") || c.includes("nightlife") || c.includes("lounge") || c.includes("pub")) {
    return "bar_nightlife";
  }
  if (c.includes("salon") || c.includes("beauty")) return "salon";
  if (c.includes("nail")) return "nail";
  if (c.includes("barber")) return "barbershop";
  if (c.includes("fitness") || c.includes("gym") || c.includes("yoga") || c.includes("pilates"))
    return "fitness_studio";
  if (c.includes("medical") || c.includes("clinic") || c.includes("doctor"))
    return "medical";
  if (c.includes("dental") || c.includes("dentist"))
    return "dental";
  if (c.includes("cowork") || c.includes("co-work"))
    return "coworking";
  if (c.includes("retail") || c.includes("shop") || c.includes("store") || c.includes("boutique") || c.includes("clothing") || c.includes("fashion")) {
    return "retail";
  }
  return "__default";
}
const SURVIVAL_TTL = TTL.TRANSIT;
function blockGroupCacheKey(geoid) {
  return `survival:bg:${geoid}`;
}
function boroughCacheKey(borough) {
  return `survival:boro:${borough}`;
}
async function fetchBlockGroupSurvival(geoid) {
  const cached = await intelCache.getAsync(blockGroupCacheKey(geoid));
  if (cached?.data) return cached.data;
  try {
    const result = await db.execute(sql`
			SELECT geoid, food_survival_rate, sample_size, confidence
			FROM block_group_survival
			WHERE geoid = ${geoid}
		`);
    if (!result.rows || result.rows.length === 0) return null;
    const row = result.rows[0];
    intelCache.set(blockGroupCacheKey(geoid), row, SURVIVAL_TTL);
    return row;
  } catch (err) {
    console.warn("[survival-rate] Failed to fetch block group survival:", err);
    return null;
  }
}
async function fetchBoroughMedian(borough) {
  const cached = await intelCache.getAsync(boroughCacheKey(borough));
  if (cached?.data) return cached.data.median_survival_rate;
  try {
    const result = await db.execute(sql`
			SELECT borough, median_survival_rate
			FROM borough_survival_medians
			WHERE borough = ${borough}
		`);
    if (!result.rows || result.rows.length === 0) return null;
    const row = result.rows[0];
    intelCache.set(boroughCacheKey(borough), row, SURVIVAL_TTL);
    return row.median_survival_rate;
  } catch (err) {
    console.warn("[survival-rate] Failed to fetch borough median:", err);
    return null;
  }
}
async function getSurvivalRate(geoid, concept, borough) {
  const conceptKey = classifyConcept(concept);
  const isFoodDirect = conceptKey === null;
  const discountFactor = isFoodDirect ? 1 : SURVIVAL_DISCOUNT_FACTORS[conceptKey] ?? SURVIVAL_DISCOUNT_DEFAULT;
  const bgData = await fetchBlockGroupSurvival(geoid);
  if (bgData && bgData.confidence !== "NONE") {
    const rawRate = bgData.food_survival_rate;
    const adjustedRate = rawRate * discountFactor;
    return {
      rate: Math.round(adjustedRate * 100),
      confidence: bgData.confidence,
      source: isFoodDirect ? "dohmh_direct" : "concept_proxy",
      rawFoodRate: rawRate,
      discountFactor,
      sampleSize: bgData.sample_size
    };
  }
  const boroughMedian = await fetchBoroughMedian(borough);
  if (boroughMedian !== null) {
    const adjustedRate = boroughMedian * discountFactor;
    return {
      rate: Math.round(adjustedRate * 100),
      confidence: "FALLBACK",
      source: "borough_median",
      rawFoodRate: boroughMedian,
      discountFactor,
      sampleSize: 0
    };
  }
  console.warn(`[survival-rate] No survival data for geoid=${geoid}, borough=${borough}`);
  return {
    rate: 55,
    confidence: "FALLBACK",
    source: "borough_median",
    rawFoodRate: 0.55,
    discountFactor: 1,
    sampleSize: 0
  };
}
export {
  getSurvivalRate as g
};
