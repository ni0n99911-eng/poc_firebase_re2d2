import { json } from "@sveltejs/kit";
import { p as private_env } from "../../../../chunks/private.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
const CONCEPT_MAP = {
  // Coffee
  coffee: "specialty_coffee",
  cafe: "specialty_coffee",
  espresso: "specialty_coffee",
  starbucks: "specialty_coffee",
  dunkin: "specialty_coffee",
  "blue bottle": "specialty_coffee",
  "think coffee": "specialty_coffee",
  "stumptown": "specialty_coffee",
  // Bakery
  bakery: "bakery",
  pastry: "bakery",
  patisserie: "bakery",
  donut: "bakery",
  // Fast casual / QSR
  "fast food": "fast_casual",
  "quick service": "fast_casual",
  subway: "fast_casual",
  chipotle: "fast_casual",
  "shake shack": "fast_casual",
  mcdonald: "fast_casual",
  // Restaurant
  restaurant: "full_service_restaurant",
  bistro: "full_service_restaurant",
  diner: "full_service_restaurant",
  "fine dining": "full_service_restaurant",
  // Bar
  bar: "bar_nightlife",
  wine: "bar_nightlife",
  cocktail: "bar_nightlife",
  pub: "bar_nightlife",
  nightclub: "bar_nightlife",
  brewery: "bar_nightlife",
  // Fitness
  gym: "fitness_studio",
  fitness: "fitness_studio",
  yoga: "fitness_studio",
  pilates: "fitness_studio",
  crossfit: "fitness_studio",
  "martial arts": "fitness_studio",
  // Wellness / spa
  spa: "wellness_spa",
  salon: "wellness_spa",
  nail: "wellness_spa",
  beauty: "wellness_spa",
  barber: "wellness_spa",
  massage: "wellness_spa",
  // Retail
  retail: "retail",
  boutique: "retail",
  clothing: "retail",
  apparel: "retail",
  shop: "retail",
  store: "retail",
  bookstore: "retail",
  "gift shop": "retail",
  // Juice / beverage
  juice: "juice_bar",
  smoothie: "juice_bar",
  "health food": "juice_bar",
  // Medical
  medical: "medical_office",
  dental: "medical_office",
  clinic: "medical_office",
  doctor: "medical_office",
  pharmacy: "medical_office",
  optometrist: "medical_office",
  // Florist
  flower: "florist",
  florist: "florist",
  floral: "florist"
};
const CONCEPT_LABELS = {
  specialty_coffee: "Coffee Shop",
  bakery: "Bakery",
  fast_casual: "Fast Casual",
  full_service_restaurant: "Restaurant",
  bar_nightlife: "Bar / Nightlife",
  fitness_studio: "Fitness Studio",
  wellness_spa: "Spa / Salon",
  retail: "Retail Store",
  juice_bar: "Juice Bar",
  medical_office: "Medical Office",
  florist: "Florist",
  personal_services: "Personal Services",
  vacant: "Vacant",
  unknown: "Unknown Business"
};
function mapToConcept(rawType) {
  const lower = (rawType || "").toLowerCase();
  for (const [keyword, concept] of Object.entries(CONCEPT_MAP)) {
    if (lower.includes(keyword)) {
      return { concept, label: CONCEPT_LABELS[concept] || concept };
    }
  }
  if (!rawType || lower.includes("vacant") || lower.includes("empty") || lower.includes("construction") || lower.includes("closed")) {
    return { concept: "vacant", label: "Vacant" };
  }
  return { concept: "unknown", label: CONCEPT_LABELS.unknown };
}
function yearsAgoDate(years) {
  const d = /* @__PURE__ */ new Date();
  d.setFullYear(d.getFullYear() - years);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
async function fetchStreetViewImage(lat, lng, date, apiKey) {
  const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&date=${date}&source=outdoor&key=${apiKey}`;
  try {
    const meta = await fetch(metaUrl, { signal: AbortSignal.timeout(5e3) });
    const metaJson = await meta.json();
    if (metaJson.status !== "OK") return null;
  } catch {
    return null;
  }
  const imgUrl = `https://maps.googleapis.com/maps/api/streetview?size=300x200&location=${lat},${lng}&date=${date}&source=outdoor&return_error_code=true&key=${apiKey}`;
  try {
    const res = await fetch(imgUrl, { signal: AbortSignal.timeout(6e3) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
}
async function identifyBusinessFromImage(imageDataUrl, openRouterKey) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openRouterKey}`,
      "HTTP-Referer": "https://resquared.io",
      "X-Title": "RE² Street View History"
    },
    body: JSON.stringify({
      model: "anthropic/claude-haiku-4-5",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageDataUrl }
            },
            {
              type: "text",
              text: `Look at this Google Street View image of a storefront. Identify the business operating there.

Read any visible signs, awnings, logos, window text. Respond ONLY with valid JSON:
{
  "businessName": "exact name from sign or 'Unknown'",
  "businessType": "one of: coffee shop, bakery, restaurant, bar, fitness gym, spa salon, retail store, juice bar, medical office, florist, vacant, other",
  "confidence": "high|medium|low",
  "isVacant": false
}

If the storefront appears empty, under construction, or no signage visible, set isVacant=true and businessName="Vacant".`
            }
          ]
        }
      ]
    }),
    signal: AbortSignal.timeout(12e3)
  });
  if (!response.ok) throw new Error(`OpenRouter vision error: ${response.status}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  try {
    const clean = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { businessName: "Unknown", businessType: "other", confidence: "low", isVacant: false };
  }
}
const GET = async ({ url, request }) => {
  const limited = rateLimit(request, RATE_LIMITS.intel);
  if (limited) return limited;
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const concept = url.searchParams.get("concept") || "specialty_coffee";
  if (isNaN(lat) || isNaN(lng)) {
    return json({ error: "lat and lng are required" }, { status: 400 });
  }
  const googleKey = private_env.GOOGLE_PLACES_API_KEY;
  const openRouterKey = private_env.OPENROUTER_API_KEY;
  if (!googleKey || !openRouterKey) {
    return json({ error: "Missing API keys" }, { status: 500 });
  }
  const YEARS = [0, 2, 5, 10];
  const dates = YEARS.map((y) => ({ year: (/* @__PURE__ */ new Date()).getFullYear() - y, dateStr: yearsAgoDate(y) }));
  const EMPTY_RESPONSE = { timeline: [], distinctBusinesses: 0, turnoverCount: 0, conceptMatchYears: [], sameConceptEverFailed: false, sameConceptName: null, highTurnover: false, source: "street-view-history", fetchedAt: (/* @__PURE__ */ new Date()).toISOString() };
  let timeoutId;
  const fnTimeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(null), 18e3);
  });
  const rawResults = await Promise.race([
    (async () => {
      const imageResults = await Promise.allSettled(
        dates.map(({ dateStr }) => fetchStreetViewImage(lat, lng, dateStr, googleKey))
      );
      const identifyTasks = imageResults.map(async (result2, i) => {
        const imageDataUrl = result2.status === "fulfilled" ? result2.value : null;
        if (!imageDataUrl) {
          return { year: dates[i].year, date: dates[i].dateStr, imageAvailable: false, businessName: "No imagery", businessType: "unknown", confidence: "low", isVacant: false };
        }
        try {
          const vision = await identifyBusinessFromImage(imageDataUrl, openRouterKey);
          return { year: dates[i].year, date: dates[i].dateStr, imageAvailable: true, ...vision };
        } catch {
          return { year: dates[i].year, date: dates[i].dateStr, imageAvailable: true, businessName: "Unknown", businessType: "other", confidence: "low", isVacant: false };
        }
      });
      return await Promise.allSettled(identifyTasks);
    })(),
    fnTimeout
  ]).finally(() => clearTimeout(timeoutId));
  if (!rawResults) return json(EMPTY_RESPONSE);
  const entries = rawResults.map((r, i) => {
    const raw = r.status === "fulfilled" ? r.value : {
      year: dates[i].year,
      date: dates[i].dateStr,
      imageAvailable: false,
      businessName: "Unknown",
      businessType: "unknown",
      confidence: "low",
      isVacant: false
    };
    const { concept: mappedConcept, label: conceptLabel } = mapToConcept(
      raw.isVacant ? "vacant" : `${raw.businessName} ${raw.businessType}`
    );
    return {
      year: raw.year,
      date: raw.date,
      businessName: raw.businessName,
      concept: mappedConcept,
      conceptLabel,
      confidence: raw.confidence,
      isVacant: raw.isVacant,
      imageAvailable: raw.imageAvailable
    };
  }).sort((a, b) => b.year - a.year);
  const dedupedTimeline = [];
  for (const entry of entries) {
    const last = dedupedTimeline[dedupedTimeline.length - 1];
    if (!last || last.businessName !== entry.businessName) {
      dedupedTimeline.push(entry);
    }
  }
  const nonVacantBusinesses = dedupedTimeline.filter((e) => !e.isVacant && e.businessName !== "Unknown" && e.businessName !== "No imagery");
  const distinctBusinesses = new Set(nonVacantBusinesses.map((e) => e.businessName)).size;
  let turnoverCount = 0;
  let prevNonVacant = "";
  for (const e of dedupedTimeline) {
    if (!e.isVacant && e.businessName !== "Unknown" && e.businessName !== "No imagery") {
      if (prevNonVacant && prevNonVacant !== e.businessName) turnoverCount++;
      prevNonVacant = e.businessName;
    }
  }
  const conceptMatchEntries = dedupedTimeline.filter((e) => e.concept === concept && !e.isVacant);
  const conceptMatchYears = conceptMatchEntries.map((e) => e.year);
  const currentEntry = dedupedTimeline[0];
  const sameConceptEverFailed = conceptMatchEntries.length > 0 && (!currentEntry || currentEntry.concept !== concept || currentEntry.isVacant);
  const sameConceptName = sameConceptEverFailed ? conceptMatchEntries.find((e) => e.businessName !== "Unknown")?.businessName || null : null;
  const result = {
    timeline: dedupedTimeline,
    distinctBusinesses,
    turnoverCount,
    conceptMatchYears,
    sameConceptEverFailed,
    sameConceptName,
    highTurnover: turnoverCount >= 2,
    source: "street-view-history",
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return json(result);
};
export {
  GET
};
