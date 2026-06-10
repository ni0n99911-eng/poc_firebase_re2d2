import { r as requireAuth } from "./auth-middleware.js";
const __vite_import_meta_env__ = {};
const ADDRESS_CACHE = {};
const FIPS_CACHE = {};
const MAX_CACHE_SIZE = 500;
function pruneCache(cache) {
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE_SIZE) {
    for (let i = 0; i < 100; i++) delete cache[keys[i]];
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
async function censusGeocode(address) {
  try {
    const encoded = encodeURIComponent(address);
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encoded}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8e3) });
    if (!res.ok) {
      console.warn(`[Geocode] Census API ${res.status}`);
      return null;
    }
    const data = await res.json();
    const matches = data?.result?.addressMatches;
    if (!matches || matches.length === 0) return null;
    const best = matches[0];
    const coords = best.coordinates;
    if (!coords?.x || !coords?.y) return null;
    return {
      lat: coords.y,
      lng: coords.x,
      matchedAddress: best.matchedAddress || address,
      confidence: best.tigerLine?.side ? "exact" : "interpolated"
    };
  } catch (err) {
    console.warn("[Geocode] Census geocoder error:", err instanceof Error ? err.message : err);
    return null;
  }
}
async function googleGeocode(address) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || __vite_import_meta_env__?.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  try {
    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&components=administrative_area:NY|country:US&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5e3) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return null;
    const best = data.results[0];
    const loc = best.geometry?.location;
    if (!loc?.lat || !loc?.lng) return null;
    const locationType = best.geometry?.location_type;
    const confidence = locationType === "ROOFTOP" ? "exact" : locationType === "RANGE_INTERPOLATED" ? "interpolated" : "approximate";
    return {
      lat: loc.lat,
      lng: loc.lng,
      matchedAddress: best.formatted_address || address,
      confidence
    };
  } catch {
    return null;
  }
}
async function googleGeocodeAll(address) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || __vite_import_meta_env__?.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];
  try {
    const encoded = encodeURIComponent(address + ", New York, NY");
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&components=administrative_area:NY|country:US&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5e3) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return [];
    return data.results.slice(0, 5).map((r) => ({
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
      formattedAddress: r.formatted_address || address,
      confidence: r.geometry?.location_type === "ROOFTOP" ? "exact" : r.geometry?.location_type === "RANGE_INTERPOLATED" ? "interpolated" : "approximate"
    })).filter((r) => r.lat && r.lng);
  } catch {
    return [];
  }
}
async function latLngToGeoid(lat, lng) {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (cacheKey in FIPS_CACHE) return FIPS_CACHE[cacheKey];
  try {
    const url = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&censusYear=2020&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5e3) });
    if (!res.ok) {
      console.warn(`[Geocode] FCC API ${res.status}`);
      FIPS_CACHE[cacheKey] = null;
      return null;
    }
    const data = await res.json();
    const fips = data?.Block?.FIPS;
    if (!fips || fips.length < 12) {
      FIPS_CACHE[cacheKey] = null;
      return null;
    }
    const geoid = fips.substring(0, 12);
    pruneCache(FIPS_CACHE);
    FIPS_CACHE[cacheKey] = geoid;
    return geoid;
  } catch (err) {
    console.warn("[Geocode] FIPS lookup error:", err instanceof Error ? err.message : err);
    FIPS_CACHE[cacheKey] = null;
    return null;
  }
}
function isInNYC(lat, lng) {
  return lat >= 40.48 && lat <= 40.93 && lng >= -74.27 && lng <= -73.68;
}
async function addressToGeoid(address) {
  if (!address || address.trim().length < 5) return null;
  const normalizedAddr = address.trim().toLowerCase();
  if (normalizedAddr in ADDRESS_CACHE) return ADDRESS_CACHE[normalizedAddr];
  let geocoded = await censusGeocode(address);
  let source = "census";
  if (!geocoded) {
    geocoded = await googleGeocode(address);
    source = "google";
  }
  if (!geocoded) {
    ADDRESS_CACHE[normalizedAddr] = null;
    return null;
  }
  if (!isInNYC(geocoded.lat, geocoded.lng)) {
    console.warn(`[Geocode] Address resolved outside NYC: ${geocoded.lat}, ${geocoded.lng}`);
  }
  const geoid = await latLngToGeoid(geocoded.lat, geocoded.lng);
  if (!geoid) {
    ADDRESS_CACHE[normalizedAddr] = null;
    return null;
  }
  const result = {
    geoid,
    lat: geocoded.lat,
    lng: geocoded.lng,
    borough: geoidToBorough(geoid),
    matchedAddress: geocoded.matchedAddress,
    confidence: geocoded.confidence,
    source
  };
  pruneCache(ADDRESS_CACHE);
  ADDRESS_CACHE[normalizedAddr] = result;
  return result;
}
async function addressToGeoidWithCandidates(address) {
  const primary = await addressToGeoid(address);
  if (!primary) return null;
  const allResults = await googleGeocodeAll(address);
  if (allResults.length < 2) return primary;
  const NYC_BOROUGH_TERMS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
  const candidates = allResults.map((r) => {
    const borough = NYC_BOROUGH_TERMS.find(
      (b) => r.formattedAddress.includes(b) || b === "Bronx" && r.formattedAddress.includes("The Bronx")
    ) || "NYC";
    return { address: r.formattedAddress, borough, confidence: r.confidence };
  }).filter((c) => c.borough !== "NYC");
  const distinctBoroughs = [...new Set(candidates.map((c) => c.borough))];
  if (distinctBoroughs.length <= 1) return primary;
  const seen = /* @__PURE__ */ new Set();
  const dedupedCandidates = candidates.filter((c) => {
    if (seen.has(c.borough)) return false;
    seen.add(c.borough);
    return true;
  });
  return {
    ...primary,
    ambiguous: true,
    candidates: dedupedCandidates
  };
}
async function coordsToGeoid(lat, lng) {
  const geoid = await latLngToGeoid(lat, lng);
  if (!geoid) return null;
  return {
    geoid,
    lat,
    lng,
    borough: geoidToBorough(geoid),
    matchedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    confidence: "exact",
    source: "fcc_direct"
  };
}
async function resolveLocation(input) {
  if (input.geoid && input.geoid.length >= 12) {
    return {
      geoid: input.geoid,
      lat: input.lat || 0,
      lng: input.lng || 0,
      borough: geoidToBorough(input.geoid),
      matchedAddress: input.address || input.geoid,
      confidence: "exact",
      source: "fcc_direct"
    };
  }
  if (input.lat && input.lng) {
    return coordsToGeoid(input.lat, input.lng);
  }
  if (input.address) {
    return addressToGeoid(input.address);
  }
  return null;
}
const GET = async ({ url, request }) => {
  const auth = await requireAuth(request);
  if ("response" in auth) return auth.response;
  const address = url.searchParams.get("address");
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const geoid = url.searchParams.get("geoid");
  if (!address && isNaN(lat) && !geoid) {
    return new Response(JSON.stringify({
      error: "Provide address, lat+lng, or geoid",
      usage: "/api/geocode?address=123+Main+St+Brooklyn+NY"
    }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  try {
    const startMs = Date.now();
    const result = await resolveLocation({ address: address || void 0, lat: isNaN(lat) ? void 0 : lat, lng: isNaN(lng) ? void 0 : lng, geoid: geoid || void 0 });
    if (!result) {
      return new Response(JSON.stringify({
        error: "Could not resolve location to a NYC block group",
        hint: address ? 'Check the address format. Include city and state (e.g., "123 Main St, Brooklyn, NY")' : "The coordinates may be outside NYC"
      }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      ...result,
      _meta: { durationMs: Date.now() - startMs }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=3600"
        // 1 hour — addresses don't change
      }
    });
  } catch (err) {
    console.error("[Geocode] Error:", err);
    return new Response(JSON.stringify({
      error: "Geocoding failed",
      message: err instanceof Error ? err.message : "Unknown error"
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
export {
  GET as G,
  addressToGeoidWithCandidates as a
};
