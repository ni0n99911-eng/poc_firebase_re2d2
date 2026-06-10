import { g as getBlockGroupScores, a as getBlockGroupVision, b as geoidToBorough, c as getBlockGroupIntel } from "../../../../chunks/block-group.js";
import { n as normalizeBusinessType } from "../../../../chunks/business-type-registry.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
import { d as db } from "../../../../chunks/db-server.js";
import { sql } from "drizzle-orm";
import { c as classifyStreetType } from "../../../../chunks/street-side.js";
const STREET_TYPE_BONUS = {
  diagonal: 6,
  // Broadway, etc. — highest-traffic corridors
  avenue: 4,
  // Named avenues (Amsterdam, Columbus, 5th, etc.)
  boulevard: 3,
  // Wider commercial roads
  street: 0,
  // Cross streets between avenues — baseline
  unknown: 0
};
const GET = async ({ url, request }) => {
  const limited = rateLimit(request, RATE_LIMITS.intel);
  if (limited) return limited;
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const geoidParam = url.searchParams.get("geoid");
  let conceptType = url.searchParams.get("concept") || void 0;
  if (conceptType) {
    conceptType = normalizeBusinessType(conceptType);
  }
  const address = url.searchParams.get("address") || void 0;
  if (!geoidParam && (isNaN(lat) || isNaN(lng))) {
    return new Response(JSON.stringify({
      error: "Missing lat/lng or geoid parameter",
      usage: "/api/block-group-intel?lat=40.7128&lng=-74.0060"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const startMs = Date.now();
    let result;
    if (geoidParam) {
      const [scores, vision] = await Promise.all([
        getBlockGroupScores(geoidParam, conceptType),
        getBlockGroupVision(geoidParam)
      ]);
      result = {
        geoid: geoidParam,
        borough: geoidToBorough(geoidParam),
        scores,
        vision,
        serving_mode: scores ? "stored" : "cold"
      };
    } else {
      result = await getBlockGroupIntel(lat, lng, conceptType);
    }
    const durationMs = Date.now() - startMs;
    if (result?.scores && address) {
      try {
        const { type: streetType } = classifyStreetType(address);
        const bonus = STREET_TYPE_BONUS[streetType] ?? 0;
        if (bonus > 0) {
          if (typeof result.scores.location_iq === "number") {
            result.scores.location_iq = Math.min(97, result.scores.location_iq + bonus);
          }
          if (typeof result.scores.location_iq_v2 === "number") {
            result.scores.location_iq_v2 = Math.min(97, result.scores.location_iq_v2 + bonus);
          }
          console.log(`[BlockGroupIntel] Street-type bonus: ${address} → ${streetType} → +${bonus} pts`);
        }
      } catch (err) {
        console.warn("[BlockGroupIntel] Street-type classification failed:", err instanceof Error ? err.message : err);
      }
    }
    if (!result) {
      return new Response(JSON.stringify({
        error: "Could not resolve block group for these coordinates",
        hint: "The FCC Census Geocoder may be unavailable, or these coordinates are outside NYC"
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      await db.execute(sql`
				INSERT INTO score_events (event_type, geoid, serving_mode, duration_ms, lat, lng)
				VALUES ('block_group_serve', ${result.geoid}, ${result.serving_mode}, ${durationMs}, ${isNaN(lat) ? null : lat}, ${isNaN(lng) ? null : lng})
			`);
    } catch {
    }
    return new Response(JSON.stringify({
      ...result,
      _meta: {
        duration_ms: durationMs,
        cached: result.serving_mode === "stored"
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=600"
        // 10 min cache — scores don't change often
      }
    });
  } catch (e) {
    console.error("[BlockGroupIntel] Error:", e);
    return new Response(JSON.stringify({
      error: "Internal error",
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
