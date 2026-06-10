import { g as getNeighborhoodBuzz } from "./neighborhoodBuzz.js";
const CONCEPT_TAG_RELEVANCE = {
  specialty_coffee: ["coffee-hub", "brunch-destination", "remote-work", "gentrifying", "creative-corridor", "third-wave-coffee"],
  fast_casual: ["lunch-rush", "office-district", "food-hall", "fast-casual-boom", "delivery-heavy", "commuter-hub"],
  full_service_restaurant: ["dining-destination", "date-night", "fine-dining", "foodie-magnet", "brunch-destination", "celebrity-chef"],
  bar_lounge: ["nightlife", "cocktail-scene", "late-night", "bar-strip", "speakeasy", "rooftop-bar"],
  boutique_retail: ["shopping-corridor", "boutique-row", "gentrifying", "artisan", "creative-corridor", "vintage"],
  fitness_wellness: ["wellness-hub", "fitness-boom", "yoga", "boutique-fitness", "health-conscious", "athleisure"],
  bakery: ["brunch-destination", "artisan", "coffee-hub", "foodie-magnet", "patisserie", "morning-traffic"],
  juice_smoothie: ["health-conscious", "wellness-hub", "fitness-boom", "organic", "gentrifying", "morning-traffic"],
  pizza: ["late-night", "delivery-heavy", "family-friendly", "lunch-rush", "slice-joint", "commuter-hub"],
  bubble_tea: ["youth-magnet", "social-media", "asian-corridor", "student-area", "trendy", "gentrifying"],
  wine_bar: ["date-night", "dining-destination", "gentrifying", "cocktail-scene", "wine-bar", "upscale"],
  coworking: ["remote-work", "creative-corridor", "tech-hub", "office-district", "startup-scene", "gentrifying"],
  salon_barbershop: ["neighborhood-staple", "gentrifying", "residential", "family-friendly", "community-anchor"],
  // B2-CARRY-2: Canonical concept keys from normalizeConceptKey()
  bar_nightlife: ["nightlife", "cocktail-scene", "late-night", "bar-strip", "speakeasy", "rooftop-bar"],
  qsr: ["lunch-rush", "delivery-heavy", "commuter-hub", "fast-casual-boom", "food-hall"],
  fitness_studio: ["wellness-hub", "fitness-boom", "yoga", "boutique-fitness", "health-conscious", "athleisure"],
  retail: ["shopping-corridor", "boutique-row", "gentrifying", "artisan", "creative-corridor", "vintage"],
  personal_services: ["neighborhood-staple", "gentrifying", "residential", "family-friendly", "community-anchor"],
  medical_office: ["residential", "community-anchor", "gentrifying", "family-friendly"],
  wellness_spa: ["wellness-hub", "health-conscious", "gentrifying", "upscale", "boutique-fitness"],
  wellness_beverage: ["health-conscious", "wellness-hub", "fitness-boom", "organic", "gentrifying", "morning-traffic"],
  juice_bar: ["health-conscious", "wellness-hub", "fitness-boom", "organic", "gentrifying", "morning-traffic"],
  florist: ["neighborhood-staple", "gentrifying", "boutique-row", "artisan", "creative-corridor"],
  generic: []
};
function deriveIntensity(buzz, matchedTagCount, totalRelevantTags) {
  const buzzNorm = (buzz.buzzScore ?? 0) / 10;
  const foodNorm = (buzz.foodScore ?? 0) / 10;
  const tagOverlap = totalRelevantTags > 0 ? matchedTagCount / totalRelevantTags : 0;
  return Math.min(1, Math.max(
    0,
    Number((buzzNorm * 0.4 + foodNorm * 0.3 + tagOverlap * 0.3).toFixed(3))
  ));
}
function deriveSentiment(buzz, intensity) {
  if (buzz.trendDirection === "rising" && intensity >= 0.5) return "positive";
  if (buzz.trendDirection === "cooling" || intensity < 0.3) return "cautious";
  return "neutral";
}
function deriveRisk(buzz, intensity, matchedTagCount) {
  if (intensity >= 0.7 && matchedTagCount >= 3) return "high";
  if (buzz.trendDirection === "cooling") return "medium";
  if (intensity < 0.3) return "medium";
  return "low";
}
function buildNarrative(neighborhood, concept, buzz, sentiment, matchedTags, intensity) {
  const trendWord = buzz.trendDirection === "rising" ? "gaining momentum" : buzz.trendDirection === "cooling" ? "showing signs of cooling" : "holding steady";
  const tagPhrase = matchedTags.length > 0 ? `Known for: ${matchedTags.slice(0, 3).join(", ")}.` : "No strong editorial signals for this concept.";
  const sentimentPhrase = sentiment === "positive" ? "Editorial signals are favorable for new entrants." : sentiment === "cautious" ? "Caution warranted — editorial signals suggest headwinds or saturation." : "Mixed signals — neither strongly favorable nor unfavorable.";
  return `${neighborhood} is ${trendWord} (buzz: ${buzz.buzzScore}/10, food: ${buzz.foodScore}/10). ${tagPhrase} ${sentimentPhrase} Intensity: ${(intensity * 100).toFixed(0)}%.`;
}
function extractEditorialSignal(neighborhoodOrAddress, concept) {
  const match = getNeighborhoodBuzz(neighborhoodOrAddress);
  if (!match) return null;
  const { name: resolvedName, data: buzz } = match;
  const conceptKey = concept.toLowerCase().replace(/[\s\/\-]+/g, "_");
  const relevantTags = CONCEPT_TAG_RELEVANCE[conceptKey] || [];
  const buzzTags = (buzz.tags || []).map((t) => t.toLowerCase());
  const matchedTags = relevantTags.filter((tag) => buzzTags.includes(tag));
  const intensity = deriveIntensity(buzz, matchedTags.length, relevantTags.length);
  const sentiment = deriveSentiment(buzz, intensity);
  const risk = deriveRisk(buzz, intensity, matchedTags.length);
  const narrative = buildNarrative(resolvedName, concept, buzz, sentiment, matchedTags, intensity);
  return {
    neighborhood: resolvedName,
    concept,
    trend: buzz.trendDirection,
    intensity,
    founderSentiment: sentiment,
    riskLevel: risk,
    narrativeContext: narrative,
    relevantTags: matchedTags,
    sources: ["neighborhoodBuzz"],
    extractedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function editorialScenarioBias(signal) {
  if (!signal) return { factor: 0, label: null };
  const isRising = signal.trend === "rising" && signal.founderSentiment === "positive";
  const isCooling = signal.trend === "cooling" && signal.founderSentiment === "cautious";
  const high = signal.intensity >= 0.7;
  if (isRising) return { factor: high ? 0.05 : 0.03, label: `Rising editorial momentum (${signal.neighborhood} — TimeOut/Eater)` };
  if (isCooling) return { factor: high ? -0.05 : -0.03, label: `Cooling editorial signals (${signal.neighborhood} — TimeOut/Eater)` };
  return { factor: 0, label: null };
}
export {
  editorialScenarioBias as a,
  extractEditorialSignal as e
};
