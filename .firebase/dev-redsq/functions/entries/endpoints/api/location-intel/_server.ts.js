import { f as fetchLocationIntel, a as fetchEnhancedLocationIntel } from "../../../../chunks/index3.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
import { n as normalizeBusinessType } from "../../../../chunks/business-type-registry.js";
import { i as intelCache } from "../../../../chunks/cache.js";
import { l as latLngToGeoid } from "../../../../chunks/block-group.js";
import { createHash } from "crypto";
const SCHEMA_VERSION = 1;
const REPORT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
function buildReportCacheKey(lat, lng, businessType, legacy, useAI, geoid) {
  const geoComponent = geoid || `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const raw = `v${SCHEMA_VERSION}:${geoComponent}:${businessType}:${legacy ? "L" : "E"}:${useAI ? "AI" : "NA"}`;
  const hash = createHash("sha256").update(raw).digest("hex").substring(0, 16);
  return `location-report:${hash}`;
}
const GET = async ({ url, request }) => {
  const limited = rateLimit(request, RATE_LIMITS.intel);
  if (limited) return limited;
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const rawType = url.searchParams.get("type") || "cafe";
  const businessType = normalizeBusinessType(rawType);
  const address = url.searchParams.get("address") || void 0;
  const useAI = url.searchParams.get("ai") === "true";
  const legacy = url.searchParams.get("legacy") !== "false";
  const forceRefresh = url.searchParams.get("refresh") === "true";
  if (isNaN(lat) || isNaN(lng)) {
    return new Response(JSON.stringify({
      error: "Missing or invalid lat/lng parameters",
      usage: "/api/location-intel?lat=40.7128&lng=-74.0060&type=cafe"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return new Response(JSON.stringify({
      error: "lat must be -90 to 90, lng must be -180 to 180"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const geoid = await latLngToGeoid(lat, lng);
    const cacheKey = buildReportCacheKey(lat, lng, businessType, legacy, useAI, geoid);
    if (!forceRefresh) {
      const cached = await intelCache.getAsync(cacheKey);
      if (cached && cached.fresh) {
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=300",
            "X-Cache": "HIT",
            "X-Cache-Key": cacheKey,
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }
    let report;
    if (legacy) {
      report = await fetchLocationIntel(lat, lng, businessType, address);
    } else {
      report = await fetchEnhancedLocationIntel(lat, lng, businessType, address, { useAI });
    }
    try {
      await intelCache.setAsync(cacheKey, report, REPORT_CACHE_TTL_MS, "location-report");
    } catch (cacheWriteErr) {
      console.warn("[LocationIntel] Cache write failed:", cacheWriteErr instanceof Error ? cacheWriteErr.message : cacheWriteErr);
    }
    return new Response(JSON.stringify(report), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300",
        // Browser cache: 5 min; private to prevent CDN caching stale data
        "X-Cache": "MISS",
        "X-Cache-Key": cacheKey,
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    console.error("[LocationIntel] Endpoint error:", e);
    return new Response(JSON.stringify({
      error: "Internal error fetching location intelligence",
      message: e instanceof Error ? e.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
export {
  GET
};
