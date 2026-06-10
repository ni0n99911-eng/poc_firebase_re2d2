import { T as TTL, I as IntelCache, i as intelCache } from "./cache.js";
import { h as haversineMeters } from "./geo-math.js";
const SCHOOLS_TTL_MS = TTL.SCHOOLS;
const BBOX_PRECISION = 3;
const _bboxCache = /* @__PURE__ */ new Map();
let _bboxHits = 0;
let _bboxMisses = 0;
function bboxKey(lat, lng) {
  return `${lat.toFixed(BBOX_PRECISION)},${lng.toFixed(BBOX_PRECISION)}`;
}
function getCacheStats() {
  const total = _bboxHits + _bboxMisses;
  return {
    entries: _bboxCache.size,
    hits: _bboxHits,
    misses: _bboxMisses,
    hitRate: total > 0 ? _bboxHits / total : 0,
    ttlHours: Math.round(SCHOOLS_TTL_MS / 36e5)
  };
}
const SCHOOLS_BASE = "https://data.cityofnewyork.us/resource/wg9x-4ke6.json";
async function fetchSchoolProximity(lat, lng, radiusMeters = 305) {
  const bKey = bboxKey(lat, lng);
  const bEntry = _bboxCache.get(bKey);
  if (bEntry && bEntry.expiresAt > Date.now()) {
    _bboxHits++;
    return bEntry.data;
  }
  _bboxMisses++;
  const cacheKey = IntelCache.locationKey(lat, lng, "nyc-schools");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) {
    _bboxCache.set(bKey, { data: cached.data, expiresAt: Date.now() + SCHOOLS_TTL_MS });
    return cached.data;
  }
  try {
    const url = `${SCHOOLS_BASE}?$where=within_circle(the_geom,${lat},${lng},${radiusMeters})&$select=location_name,primary_address_line_1,grades_text,latitude,longitude&$limit=100`;
    const { socrataFetch } = await import("./socrata-fetch.js");
    const raw = await socrataFetch(url, "schools");
    if (!raw || !Array.isArray(raw)) return cached?.data || null;
    const schools = raw.filter((r) => r.latitude && r.longitude).map((r) => {
      const sLat = parseFloat(r.latitude);
      const sLng = parseFloat(r.longitude);
      return {
        name: r.location_name || "Unknown School",
        address: r.primary_address_line_1 || "",
        gradeLevel: r.grades_text || "Unknown",
        distanceMeters: Math.round(haversineMeters(lat, lng, sLat, sLng)),
        lat: sLat,
        lng: sLng
      };
    }).sort((a, b) => a.distanceMeters - b.distanceMeters);
    const within200ft = schools.filter((s) => s.distanceMeters <= 61).length;
    const within500ft = schools.filter((s) => s.distanceMeters <= 152).length;
    const within1000ft = schools.length;
    const familyDensityScore = Math.min(100, Math.round(within1000ft * 20));
    const result = {
      schools,
      totalCount: schools.length,
      within200ft,
      within500ft,
      within1000ft,
      closestSchool: schools[0] || null,
      slaBlocked: within200ft > 0,
      familyDensityScore,
      source: "nyc-schools",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, SCHOOLS_TTL_MS, "schools");
    _bboxCache.set(bKey, { data: result, expiresAt: Date.now() + SCHOOLS_TTL_MS });
    return result;
  } catch (e) {
    console.error("[Schools] Fetch error:", e);
    return cached?.data || null;
  }
}
export {
  fetchSchoolProximity as f,
  getCacheStats as g
};
