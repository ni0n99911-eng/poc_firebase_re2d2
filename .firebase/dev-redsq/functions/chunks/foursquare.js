import { S as SITE_CONFIG } from "./modules.js";
import { I as IntelCache, i as intelCache, T as TTL } from "./cache.js";
import { p as private_env } from "./private.js";
import { h as haversineMeters } from "./geo-math.js";
const PLACES_BASE = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const KNOWN_CHAINS = /* @__PURE__ */ new Set([
  // Coffee
  "starbucks",
  "dunkin",
  "dunkin'",
  "peet",
  "peet's",
  "blue bottle",
  "gregorys",
  "gregory's",
  "joe coffee",
  "think coffee",
  "la colombe",
  "bluestone lane",
  "philz",
  "intelligentsia",
  "counter culture",
  "blank street",
  "birch coffee",
  "ground central",
  "city of saints",
  "felix roasting",
  // QSR / Fast casual / Restaurants
  "sweetgreen",
  "chipotle",
  "shake shack",
  "panera",
  "mcdonald's",
  "mcdonalds",
  "subway",
  "chick-fil-a",
  "wendys",
  "wendy's",
  "burger king",
  "popeyes",
  "domino's",
  "pizza hut",
  "taco bell",
  "five guys",
  "wingstop",
  "cava",
  "dig",
  "just salad",
  // Fitness
  "equinox",
  "planet fitness",
  "orangetheory",
  "soulcycle",
  "blink fitness",
  "crunch",
  "barry",
  "barry's",
  "lifetime",
  "solidcore",
  "rumble",
  "y7 studio",
  "peloton",
  // Bars
  "tgif",
  "applebee's",
  "buffalo wild wings",
  "dave & buster",
  // Spa / Wellness
  "hand & stone",
  "massage envy",
  "exhale",
  "aire ancient baths",
  "qc spa",
  "russian & turkish",
  "dry bar",
  "drybar",
  // Personal services / Salon
  "supercuts",
  "great clips",
  "fantastic sams",
  "sport clips",
  "european wax center",
  "benefit brow bar",
  "ulta",
  "sephora",
  "glosslab",
  "paintbox",
  "tenoverten",
  "chillhouse",
  // Retail
  "h&m",
  "zara",
  "uniqlo",
  "gap",
  "old navy",
  "forever 21",
  "urban outfitters",
  "anthropologie",
  "free people",
  "lululemon",
  "nike",
  "adidas",
  "foot locker",
  "nordstrom",
  "tj maxx",
  "marshalls",
  // Bakery
  "paris baguette",
  "tous les jours",
  "panera",
  "au bon pain",
  "le pain quotidien",
  "magnolia bakery",
  "levain",
  // Juice / Wellness beverage
  "jamba",
  "jamba juice",
  "juice press",
  "pressed juicery",
  "kung fu tea",
  "gong cha",
  "tiger sugar",
  "boba guys",
  // Coworking
  "wework",
  "regus",
  "spaces",
  "industrious",
  // Medical / Dental
  "aspen dental",
  "citymd",
  "carepoint",
  "one medical"
]);
async function fetchNearbyPlaces(lat, lng, businessType = "cafe", radiusMeters = 500) {
  const cacheKey = IntelCache.locationKey(lat, lng, `places-${businessType}`);
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  const apiKey = private_env.GOOGLE_PLACES_API_KEY;
  if (apiKey) {
    console.log("[Places] Using Google Places API (key starts with:", apiKey.substring(0, 8) + "...)");
    try {
      const result = await fetchFromGooglePlaces(lat, lng, businessType, radiusMeters, apiKey, cacheKey, cached?.data);
      console.log("[Places] Google API returned:", result ? `${result.totalNearby} places` : "null");
      if (!result) {
        console.warn("[Places] Google API returned null — falling back to Overpass");
        return cached?.data || await fetchFromOverpass(lat, lng, businessType, radiusMeters, cacheKey);
      }
      return result;
    } catch (e) {
      console.error("[Places] Google API error:", e);
      return cached?.data || await fetchFromOverpass(lat, lng, businessType, radiusMeters, cacheKey);
    }
  }
  console.warn("[Places] No GOOGLE_PLACES_API_KEY — falling back to Overpass");
  return cached?.data || await fetchFromOverpass(lat, lng, businessType, radiusMeters, cacheKey);
}
async function fetchFromGooglePlaces(lat, lng, businessType, radiusMeters, apiKey, cacheKey, staleData) {
  const placeType = mapBusinessTypeToPlacesType(businessType);
  const extraTypes = [];
  const lowerConcept = businessType.toLowerCase();
  if (lowerConcept === "bar_nightlife" || lowerConcept.includes("nightlife") || lowerConcept.includes("nightclub")) {
    extraTypes.push("night_club");
  }
  const typesToQuery = [placeType, ...extraTypes];
  const { resilientFetch } = await import("./retry.js").then((n) => n.b);
  const allResults = [];
  const seenPlaceIds = /* @__PURE__ */ new Set();
  for (const t of typesToQuery) {
    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: radiusMeters.toString(),
      type: t,
      key: apiKey
    });
    console.log("[Places] Fetching:", `${PLACES_BASE}?location=${lat},${lng}&radius=${radiusMeters}&type=${t}`);
    const res = await resilientFetch(`${PLACES_BASE}?${params}`, {
      timeout: 12e3,
      label: `GooglePlaces:${t}`
    });
    console.log(`[Places] Google API response status for type=${t}:`, res.status);
    if (!res.ok) {
      console.error(`[Places] Google API HTTP error for type=${t}:`, res.status);
      continue;
    }
    const data = await res.json();
    console.log(`[Places] Google API body status for type=${t}:`, data.status, "| error:", data.error_message || "none");
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(`[Places] Google API status for type=${t}:`, data.status, "| error:", data.error_message);
      continue;
    }
    const results = data.results || [];
    for (const r of results) {
      const id = r.place_id || "";
      if (id && seenPlaceIds.has(id)) continue;
      if (id) seenPlaceIds.add(id);
      allResults.push(r);
    }
  }
  if (allResults.length === 0 && typesToQuery.length > 0) ;
  console.log("[Places] Got", allResults.length, "combined place results across types:", typesToQuery.join(","));
  const places = allResults.map((p) => parsePlaceResult(p, lat, lng));
  const result = aggregatePlaces(places, "google-places");
  intelCache.set(cacheKey, result, TTL.PLACES);
  return result;
}
async function fetchFromOverpass(lat, lng, businessType, radiusMeters, cacheKey) {
  try {
    const overpassFilters = mapBusinessTypeToOverpass(businessType);
    const query = `[out:json][timeout:12];(${overpassFilters.map(
      (f) => `nwr[${f}](around:${radiusMeters},${lat},${lng});`
    ).join("")});out center;`;
    const { resilientFetch } = await import("./retry.js").then((n) => n.b);
    const res = await resilientFetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      {
        timeout: 15e3,
        label: "GooglePlaces",
        headers: { "User-Agent": SITE_CONFIG.userAgent }
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const seen = /* @__PURE__ */ new Set();
    const rawElements = data.elements || [];
    const places = rawElements.map((e) => {
      const eLat = e.lat ?? e.center?.lat;
      const eLon = e.lon ?? e.center?.lon;
      if (!eLat || !eLon) return null;
      return { tags: e.tags, lat: eLat, lon: eLon };
    }).filter((e) => {
      if (!e) return false;
      const key = (e.tags?.name || "") + e.lat;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((e) => ({
      name: e.tags?.name || e.tags?.brand || "Unnamed",
      address: e.tags?.["addr:street"] ? `${e.tags["addr:housenumber"] || ""} ${e.tags["addr:street"]}`.trim() : "",
      lat: e.lat,
      lng: e.lon,
      rating: 0,
      reviewCount: 0,
      priceLevel: 0,
      types: [e.tags?.amenity || e.tags?.shop || businessType].filter(Boolean),
      distance: haversineMeters(lat, lng, e.lat, e.lon)
    })).sort((a, b) => a.distance - b.distance);
    const result = aggregatePlaces(places, "overpass-fallback");
    intelCache.set(cacheKey, result, TTL.PLACES);
    return result;
  } catch (e) {
    console.error("[Places] Overpass fallback error:", e);
    return null;
  }
}
function aggregatePlaces(places, source) {
  const withRatings = places.filter((p) => p.rating > 0);
  const avgRating = withRatings.length > 0 ? +(withRatings.reduce((s, p) => s + p.rating, 0) / withRatings.length).toFixed(1) : 0;
  const avgPriceLevel = withRatings.length > 0 ? +(withRatings.reduce((s, p) => s + p.priceLevel, 0) / withRatings.length).toFixed(1) : 0;
  const avgReviewCount = withRatings.length > 0 ? Math.round(withRatings.reduce((s, p) => s + p.reviewCount, 0) / withRatings.length) : 0;
  let chainCount = 0;
  let independentCount = 0;
  for (const p of places) {
    if (isChain(p.name)) chainCount++;
    else independentCount++;
  }
  const topRated = [...places].filter((p) => p.rating > 0).sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 5);
  return {
    places,
    totalNearby: places.length,
    avgRating,
    avgPriceLevel,
    avgReviewCount,
    chainCount,
    independentCount,
    topRated,
    source,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function parsePlaceResult(p, originLat, originLng) {
  return {
    name: p.name || "Unknown",
    address: p.vicinity || "",
    lat: p.geometry?.location?.lat || 0,
    lng: p.geometry?.location?.lng || 0,
    rating: p.rating || 0,
    reviewCount: p.user_ratings_total || 0,
    priceLevel: p.price_level || 0,
    types: p.types || [],
    isOpen: p.opening_hours?.open_now,
    distance: haversineMeters(
      originLat,
      originLng,
      p.geometry?.location?.lat || 0,
      p.geometry?.location?.lng || 0
    )
  };
}
function isChain(name) {
  const lower = name.toLowerCase();
  for (const chain of KNOWN_CHAINS) {
    if (lower.includes(chain)) return true;
  }
  return false;
}
function mapBusinessTypeToPlacesType(bizType) {
  const lower = bizType.toLowerCase();
  const CANONICAL_MAP = {
    "specialty_coffee": "cafe",
    "full_service_restaurant": "restaurant",
    "fast_casual": "restaurant",
    "qsr": "restaurant",
    "bakery": "bakery",
    "fitness_studio": "gym",
    "bar_nightlife": "bar",
    "wellness_spa": "spa",
    "wellness_beverage": "cafe",
    // tea house / matcha bar — closest proxy
    "juice_bar": "cafe",
    // juice / smoothie bar — closest proxy
    "personal_services": "beauty_salon",
    "retail": "clothing_store",
    "coworking": "library",
    // no coworking type; library is nearest proxy
    "medical_office": "dentist"
  };
  if (CANONICAL_MAP[lower]) return CANONICAL_MAP[lower];
  if (lower.includes("coffee") || lower.includes("cafe") || lower.includes("café")) return "cafe";
  if (lower.includes("restaurant") || lower.includes("food") || lower.includes("diner")) return "restaurant";
  if (lower.includes("fitness") || lower.includes("gym") || lower.includes("yoga") || lower.includes("pilates")) return "gym";
  if (lower.includes("bar") || lower.includes("nightlife") || lower.includes("pub") || lower.includes("lounge")) return "bar";
  if (lower.includes("spa") || lower.includes("wellness")) return "spa";
  if (lower.includes("bakery") || lower.includes("pastry") || lower.includes("patisserie")) return "bakery";
  if (lower.includes("salon") || lower.includes("barber") || lower.includes("beauty") || lower.includes("nail")) return "beauty_salon";
  if (lower.includes("retail") || lower.includes("boutique") || lower.includes("clothing") || lower.includes("shop")) return "clothing_store";
  if (lower.includes("medical") || lower.includes("dental") || lower.includes("dentist") || lower.includes("doctor")) return "dentist";
  if (lower.includes("cowork")) return "library";
  if (lower.includes("juice") || lower.includes("smoothie") || lower.includes("acai")) return "cafe";
  if (lower.includes("tea") || lower.includes("matcha") || lower.includes("boba")) return "cafe";
  return "store";
}
function mapBusinessTypeToOverpass(bizType) {
  const lower = bizType.toLowerCase();
  const CANONICAL_MAP = {
    "specialty_coffee": ['"amenity"="cafe"', '"cuisine"~"coffee"', '"shop"="coffee"'],
    "full_service_restaurant": ['"amenity"="restaurant"'],
    "fast_casual": ['"amenity"="restaurant"', '"amenity"="fast_food"'],
    "qsr": ['"amenity"="fast_food"'],
    "bakery": ['"shop"="bakery"', '"amenity"="cafe"'],
    "fitness_studio": ['"leisure"="fitness_centre"', '"sport"="fitness"', '"sport"="yoga"'],
    "bar_nightlife": ['"amenity"="bar"', '"amenity"="pub"', '"amenity"="nightclub"'],
    "wellness_spa": ['"amenity"="spa"', '"leisure"="sauna"', '"shop"="beauty"'],
    "wellness_beverage": ['"amenity"="cafe"', '"cuisine"~"tea|bubble_tea"'],
    "juice_bar": ['"amenity"="cafe"', '"cuisine"~"juice|smoothie"'],
    "personal_services": ['"shop"="hairdresser"', '"shop"="beauty"', '"amenity"="beauty"'],
    "retail": ['"shop"~"clothes|boutique|gift|jewelry|books"'],
    "coworking": ['"amenity"="coworking_space"', '"office"="coworking"'],
    "medical_office": ['"amenity"="dentist"', '"amenity"="doctors"', '"amenity"="clinic"']
  };
  if (CANONICAL_MAP[lower]) return CANONICAL_MAP[lower];
  if (lower.includes("coffee") || lower.includes("cafe")) return CANONICAL_MAP["specialty_coffee"];
  if (lower.includes("restaurant") || lower.includes("food")) return CANONICAL_MAP["full_service_restaurant"];
  if (lower.includes("fitness") || lower.includes("gym")) return CANONICAL_MAP["fitness_studio"];
  if (lower.includes("bar") || lower.includes("pub")) return CANONICAL_MAP["bar_nightlife"];
  if (lower.includes("spa") || lower.includes("wellness")) return CANONICAL_MAP["wellness_spa"];
  if (lower.includes("bakery") || lower.includes("pastry")) return CANONICAL_MAP["bakery"];
  if (lower.includes("salon") || lower.includes("barber") || lower.includes("beauty")) return CANONICAL_MAP["personal_services"];
  if (lower.includes("retail") || lower.includes("boutique") || lower.includes("clothing")) return CANONICAL_MAP["retail"];
  if (lower.includes("medical") || lower.includes("dental")) return CANONICAL_MAP["medical_office"];
  if (lower.includes("cowork")) return CANONICAL_MAP["coworking"];
  return ['"shop"~"."'];
}
const MARKET_SCAN_TYPES = [
  { category: "Cafes & Coffee", type: "cafe", extraTypes: [] },
  { category: "Restaurants", type: "restaurant", extraTypes: [] },
  // B3-2.4: include 'night_club' so dense nightlife corridors (e.g. 105 Rivington in LES)
  // surface their night_club POIs alongside 'bar'-typed POIs. Previously the 'bar' type
  // alone missed most clubs and left some LES block groups with zero bar competitors.
  // We deliberately exclude 'liquor_store' — retail is a distinct competitor class.
  { category: "Bars & Nightlife", type: "bar", extraTypes: ["night_club"] },
  { category: "Fitness & Gyms", type: "gym", extraTypes: ["health"] },
  // Equinox etc. classified as 'health' not 'gym'
  { category: "Retail & Shopping", type: "store", extraTypes: [] },
  { category: "Banks & Finance", type: "bank", extraTypes: [] },
  { category: "Groceries", type: "supermarket", extraTypes: [] },
  { category: "Pharmacies", type: "pharmacy", extraTypes: [] }
];
async function fetchMarketDensity(lat, lng, radiusMeters = 500) {
  const cacheKey = IntelCache.locationKey(lat, lng, "market-density");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const { db } = await import("./db-server.js").then((n) => n.n);
    const { sql } = await import("drizzle-orm");
    const nearestRes = await db.execute(sql`
			SELECT bg.geoid 
			FROM block_groups bg
			ORDER BY bg.geom <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
			LIMIT 1
		`);
    const nearestRows = Array.isArray(nearestRes) ? nearestRes : nearestRes.rows || [];
    if (nearestRows.length > 0) {
      const nearestGeoid = nearestRows[0].geoid;
      const intelRes = await db.execute(sql`
				SELECT data
				FROM block_group_intel
				WHERE geoid = ${nearestGeoid} AND source = 'google_places'
				LIMIT 1
			`);
      const intelRows = Array.isArray(intelRes) ? intelRes : intelRes.rows || [];
      if (intelRows.length > 0 && intelRows[0].data) {
        console.log("[Places-DB] Using seeded market density data");
        const d = intelRows[0].data;
        const categories = MARKET_SCAN_TYPES.map(({ category, type }) => ({
          category,
          placeType: type,
          count: d.type_distribution?.[type] || 0,
          avgRating: d.avg_rating || 0,
          chainPct: 0
          // not stored in seeded data
        }));
        const totalBusinesses = d.total_results || 0;
        const result = {
          categories,
          totalBusinesses,
          commercialVitality: Math.min(100, Math.round(totalBusinesses / 50 * 100)),
          dominantCategory: d.top_categories?.[0]?.type || "unknown",
          avgOverallRating: d.avg_rating || 0,
          source: "google-places",
          fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        intelCache.set(cacheKey, result, TTL.PLACES);
        return result;
      }
    }
  } catch (dbErr) {
    console.warn("[Places-DB] Seeded market density lookup skipped:", dbErr);
  }
  const apiKey = private_env.GOOGLE_PLACES_API_KEY;
  try {
    let categories;
    let source;
    if (apiKey) {
      const results = await Promise.allSettled(
        MARKET_SCAN_TYPES.map(async ({ category, type, extraTypes }) => {
          const typesToSearch = [type, ...extraTypes];
          const allPlaces = [];
          const seenNames = /* @__PURE__ */ new Set();
          for (const t of typesToSearch) {
            const params = new URLSearchParams({
              location: `${lat},${lng}`,
              radius: radiusMeters.toString(),
              type: t,
              key: apiKey
            });
            try {
              const { resilientFetch } = await import("./retry.js").then((n) => n.b);
              const res = await resilientFetch(`${PLACES_BASE}?${params}`, {
                timeout: 1e4,
                label: "GooglePlaces"
              });
              if (res.ok) {
                const data = await res.json();
                const places = data.status === "OK" ? data.results : [];
                for (const p of places) {
                  const key = (p.name || "").toLowerCase();
                  if (!seenNames.has(key)) {
                    seenNames.add(key);
                    allPlaces.push(p);
                  }
                }
              }
            } catch {
            }
          }
          return { category, type, places: allPlaces };
        })
      );
      categories = results.map((r, i) => {
        if (r.status !== "fulfilled") {
          return { category: MARKET_SCAN_TYPES[i].category, placeType: MARKET_SCAN_TYPES[i].type, count: 0, avgRating: 0, chainPct: 0 };
        }
        const { category, type, places } = r.value;
        const withRating2 = places.filter((p) => p.rating && p.rating > 0);
        const avgRating = withRating2.length > 0 ? +(withRating2.reduce((s, p) => s + (p.rating || 0), 0) / withRating2.length).toFixed(1) : 0;
        const chains = places.filter((p) => isChain(p.name || ""));
        return {
          category,
          placeType: type,
          count: places.length,
          avgRating,
          chainPct: places.length > 0 ? Math.round(chains.length / places.length * 100) : 0
        };
      });
      source = "google-places";
    } else {
      categories = await overpassMarketScan(lat, lng, radiusMeters);
      source = "overpass-fallback";
    }
    const totalBusinesses = categories.reduce((s, c) => s + c.count, 0);
    const withRating = categories.filter((c) => c.avgRating > 0);
    const avgOverallRating = withRating.length > 0 ? +(withRating.reduce((s, c) => s + c.avgRating, 0) / withRating.length).toFixed(1) : 0;
    const categoriesPresent = categories.filter((c) => c.count > 0).length;
    const diversityScore = categoriesPresent / MARKET_SCAN_TYPES.length * 40;
    const densityScore = Math.min(40, totalBusinesses / 50 * 40);
    const qualityScore = avgOverallRating / 5 * 20;
    const commercialVitality = Math.round(diversityScore + densityScore + qualityScore);
    const dominantCategory = categories.sort((a, b) => b.count - a.count)[0]?.category || "None";
    const result = {
      categories,
      totalBusinesses,
      commercialVitality: Math.min(100, commercialVitality),
      dominantCategory,
      avgOverallRating,
      source,
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.PLACES);
    return result;
  } catch (e) {
    console.error("[MarketDensity] Fetch error:", e);
    return cached?.data || null;
  }
}
async function overpassMarketScan(lat, lng, radiusMeters) {
  const overpassTypes = [
    { category: "Cafes & Coffee", type: "cafe", filter: '"amenity"="cafe"' },
    { category: "Restaurants", type: "restaurant", filter: '"amenity"="restaurant"' },
    { category: "Bars & Nightlife", type: "bar", filter: '"amenity"="bar"' },
    { category: "Fitness & Gyms", type: "gym", filter: '"leisure"="fitness_centre"' },
    { category: "Retail & Shopping", type: "store", filter: '"shop"~"."' },
    { category: "Banks & Finance", type: "bank", filter: '"amenity"="bank"' },
    { category: "Groceries", type: "supermarket", filter: '"shop"="supermarket"' },
    { category: "Pharmacies", type: "pharmacy", filter: '"amenity"="pharmacy"' }
  ];
  const filters = overpassTypes.map(
    (t) => `nwr[${t.filter}](around:${radiusMeters},${lat},${lng});`
  ).join("");
  const query = `[out:json][timeout:15];(${filters});out center;`;
  try {
    const { resilientFetch } = await import("./retry.js").then((n) => n.b);
    const res = await resilientFetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      {
        timeout: 18e3,
        label: "GooglePlaces",
        headers: { "User-Agent": SITE_CONFIG.userAgent }
      }
    );
    if (!res.ok) return overpassTypes.map((t) => ({ category: t.category, placeType: t.type, count: 0, avgRating: 0, chainPct: 0 }));
    const data = await res.json();
    const elements = data.elements || [];
    return overpassTypes.map((t) => {
      const matching = elements.filter((e) => {
        const tags = e.tags || {};
        if (t.type === "store") return !!tags.shop;
        return tags.amenity === t.type || tags.leisure === (t.type === "gym" ? "fitness_centre" : "") || tags.shop === t.type;
      });
      const chains = matching.filter((e) => isChain(e.tags?.name || ""));
      return {
        category: t.category,
        placeType: t.type,
        count: matching.length,
        avgRating: 0,
        chainPct: matching.length > 0 ? Math.round(chains.length / matching.length * 100) : 0
      };
    });
  } catch {
    return overpassTypes.map((t) => ({ category: t.category, placeType: t.type, count: 0, avgRating: 0, chainPct: 0 }));
  }
}
const CATEGORY_MAP = {
  // Every canonical concept from businessTypeNormalizer.ts MUST have an entry.
  // Foursquare v3 category taxonomy: https://location.foursquare.com/places/docs/categories
  "specialty_coffee": "13032",
  // Coffee Shop
  "cafe": "13032",
  "coffee": "13032",
  "full_service_restaurant": "13065",
  // Restaurant
  "restaurant": "13065",
  "fast_casual": "13065",
  // Restaurant (Foursquare doesn't differentiate fast casual)
  "qsr": "13145",
  // Fast Food Restaurant
  "fast_food": "13145",
  "bakery": "13002",
  // Bakery
  "fitness_studio": "18021",
  // Gym / Fitness Center
  "fitness": "18021",
  "bar_nightlife": "13003,13009",
  // Bar (13003) + Nightclub (13009) — B3-2.2: 105 Rivington showed 0 competitors because LES venues are Nightclub-tagged, not Bar-tagged
  "bar": "13003,13009",
  "wellness_spa": "11062",
  // Spa
  "personal_services": "11057",
  // Salon / Barber
  "retail": "17000",
  // Retail (broad)
  "coworking": "11049",
  // Coworking Space
  "medical_office": "15014",
  // Doctor's Office
  "wellness_beverage": "13032",
  // Coffee Shop (closest proxy for tea/matcha)
  "juice_bar": "13036"
  // Juice Bar
};
const FSQ_BASE = "https://places-api.foursquare.com/places";
const FSQ_API_VERSION = "2025-06-17";
function fsqHeaders(apiKey) {
  return {
    "Accept": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "X-Places-Api-Version": FSQ_API_VERSION
  };
}
async function fetchFoursquareData(lat, lng, businessType = "cafe", radiusMeters = 500) {
  const apiKey = private_env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    console.warn("[Foursquare] No API key configured — skipping");
    return null;
  }
  const cacheKey = IntelCache.locationKey(lat, lng, `foursquare-${businessType}`);
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const searchUrl = new URL(`${FSQ_BASE}/search`);
    searchUrl.searchParams.set("ll", `${lat},${lng}`);
    searchUrl.searchParams.set("radius", String(Math.min(radiusMeters, 2e3)));
    searchUrl.searchParams.set("limit", "50");
    searchUrl.searchParams.set("sort", "DISTANCE");
    searchUrl.searchParams.set("fields", "fsq_id,name,categories,location,geocodes,distance,popularity,rating,price,closed_bucket,hours");
    const { resilientFetch } = await import("./retry.js").then((n) => n.b);
    const res = await resilientFetch(searchUrl.toString(), {
      timeout: 1e4,
      label: "Foursquare",
      headers: fsqHeaders(apiKey)
    });
    console.log("[Foursquare] API response status:", res.status);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.error("[Foursquare] Invalid API key (key starts with:", apiKey.substring(0, 8) + "...)");
      } else if (res.status === 410) {
        console.error("[Foursquare] 410 Gone — endpoint deprecated, check migration guide");
      } else if (res.status === 429) {
        console.warn("[Foursquare] Rate limited");
      } else {
        console.error("[Foursquare] API error:", res.status);
      }
      return cached?.data || null;
    }
    const data = await res.json();
    const results = data.results || [];
    console.log("[Foursquare] Search returned", results.length, "results");
    const competitorCategory = CATEGORY_MAP[businessType];
    if (!competitorCategory) {
      console.error(`[Foursquare] ❌ CATEGORY_MAP miss for "${businessType}" — competitor query SKIPPED. Add this key to CATEGORY_MAP or fix the caller.`);
    }
    let competitorResults = [];
    if (competitorCategory) {
      const compUrl = new URL(`${FSQ_BASE}/search`);
      compUrl.searchParams.set("ll", `${lat},${lng}`);
      compUrl.searchParams.set("radius", String(Math.min(radiusMeters, 1e3)));
      compUrl.searchParams.set("categories", competitorCategory);
      compUrl.searchParams.set("limit", "50");
      compUrl.searchParams.set("sort", "DISTANCE");
      compUrl.searchParams.set("fields", "fsq_id,name,categories,location,geocodes,distance,popularity,rating,price,closed_bucket,hours");
      const compRes = await resilientFetch(compUrl.toString(), {
        timeout: 1e4,
        label: "Foursquare",
        headers: fsqHeaders(apiKey)
      });
      if (compRes.ok) {
        const compData = await compRes.json();
        competitorResults = compData.results || [];
      }
    }
    const venues = processVenues(results);
    const directCompetitors = processVenues(competitorResults);
    const venueIds = new Set(venues.map((v) => v.fsqId));
    for (const comp of directCompetitors) {
      if (!venueIds.has(comp.fsqId)) {
        venues.push(comp);
        venueIds.add(comp.fsqId);
      }
    }
    const catCounts = /* @__PURE__ */ new Map();
    for (const v of venues) {
      if (v.primaryCategory) {
        catCounts.set(v.primaryCategory, (catCounts.get(v.primaryCategory) || 0) + 1);
      }
    }
    const categoryBreakdown = Array.from(catCounts.entries()).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
    const chainCount = venues.filter((v) => v.isChain).length;
    const independentCount = venues.filter((v) => !v.isChain).length;
    const withPopularity = venues.filter((v) => v.popularity > 0);
    const avgPopularity = withPopularity.length > 0 ? withPopularity.reduce((sum, v) => sum + v.popularity, 0) / withPopularity.length : 0;
    const highTrafficVenues = withPopularity.filter((v) => v.popularity > 0.7).length;
    let peakTrafficScore = 50;
    if (highTrafficVenues > 5) peakTrafficScore = 90;
    else if (highTrafficVenues > 2) peakTrafficScore = 75;
    else if (highTrafficVenues > 0) peakTrafficScore = 60;
    else if (avgPopularity > 0.5) peakTrafficScore = 55;
    else if (venues.length < 5) peakTrafficScore = 30;
    const withRating = venues.filter((v) => v.rating !== null && v.rating > 0);
    const avgRating = withRating.length > 0 ? withRating.reduce((sum, v) => sum + (v.rating || 0), 0) / withRating.length : 0;
    const withPrice = venues.filter((v) => v.priceLevel !== null);
    const avgPriceLevel = withPrice.length > 0 ? withPrice.reduce((sum, v) => sum + (v.priceLevel || 0), 0) / withPrice.length : 0;
    const result = {
      venues,
      totalCount: venues.length,
      directCompetitors: directCompetitors.filter((v) => !v.closed),
      chainCount,
      independentCount,
      categoryBreakdown,
      categoryDiversity: catCounts.size,
      avgPopularity,
      highTrafficVenues,
      peakTrafficScore,
      avgRating,
      avgPriceLevel,
      source: "foursquare",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.PLACES);
    return result;
  } catch (err) {
    console.error("[Foursquare] Fetch error:", err);
    return cached?.data || null;
  }
}
function processVenues(raw) {
  return raw.filter((r) => r != null && typeof r === "object").map((r) => {
    const categories = Array.isArray(r.categories) ? r.categories.map((c) => ({
      id: Number(c.id) || 0,
      name: String(c.name || ""),
      shortName: String(c.short_name || c.name || ""),
      icon: c.icon ? `${c.icon.prefix}64${c.icon.suffix}` : ""
    })) : [];
    const chains = Array.isArray(r.chains) ? r.chains : [];
    const isChain2 = chains.length > 0;
    const chainName = isChain2 ? String(chains[0]?.name || "") : null;
    const location = r.location || {};
    const fsqId = String(r.fsq_place_id || r.fsq_id || "");
    const isClosed = r.date_closed != null || String(r.closed_bucket || "").includes("Closed");
    const geocodes = r.geocodes;
    const mainGeo = geocodes?.main;
    const venueLat = r.latitude != null ? Number(r.latitude) : mainGeo?.latitude != null ? Number(mainGeo.latitude) : null;
    const venueLng = r.longitude != null ? Number(r.longitude) : mainGeo?.longitude != null ? Number(mainGeo.longitude) : null;
    return {
      fsqId,
      name: String(r.name || ""),
      categories,
      primaryCategory: categories[0]?.name || "Unknown",
      address: String(location.formatted_address || location.address || ""),
      lat: venueLat,
      lng: venueLng,
      distance: Number(r.distance) || 0,
      popularity: Number(r.popularity) || 0,
      rating: r.rating != null ? Number(r.rating) : null,
      priceLevel: r.price != null ? Number(r.price) : null,
      hours: formatHours(r.hours),
      isChain: isChain2,
      chainName,
      verified: Boolean(r.verified),
      closed: isClosed
    };
  }).filter((v) => !v.closed);
}
function formatHours(hours) {
  if (!hours || typeof hours !== "object") return null;
  const h = hours;
  if (h.display) return String(h.display);
  if (h.regular && Array.isArray(h.regular)) {
    return `${h.regular.length} scheduled days`;
  }
  return null;
}
export {
  fetchNearbyPlaces as a,
  fetchMarketDensity as b,
  fetchFoursquareData as f
};
