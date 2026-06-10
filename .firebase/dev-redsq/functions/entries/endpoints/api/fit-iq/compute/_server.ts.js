import { r as requireAuth } from "../../../../../chunks/auth-middleware.js";
import { c as computeFitIQ } from "../../../../../chunks/fit-iq-engine.js";
import { d as db, h as fitIqShadowLog, i as fitIqCache } from "../../../../../chunks/db-server.js";
import { and, eq } from "drizzle-orm";
function hashLaunchpad(launchpad) {
  const sorted = JSON.stringify(launchpad, Object.keys(launchpad).sort());
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}
async function getCachedFitIQ(userId, geoid, businessType, launchpadHash) {
  try {
    const cachedRows = await db.select().from(fitIqCache).where(
      and(
        eq(fitIqCache.userId, userId),
        eq(fitIqCache.geoid, geoid)
      )
    );
    const validRow = cachedRows.find((row) => {
      const d = row.data || {};
      if (d.business_type !== businessType) return false;
      if (d.launchpad_hash !== launchpadHash) return false;
      if (d.expires_at && new Date(d.expires_at).getTime() < Date.now()) return false;
      return true;
    });
    if (!validRow) return null;
    const dData = validRow.data;
    return {
      fitIQ: validRow.score,
      grade: dData.grade,
      dimensions: dData.dimensions,
      archetype: dData.archetype,
      archetypeScore: dData.archetype_score,
      alignment: dData.alignment,
      _cached: true
    };
  } catch (err) {
    console.warn("[FitIQ] Cache read failed (non-blocking):", err instanceof Error ? err.message : err);
    return null;
  }
}
async function cacheFitIQResult(userId, geoid, businessType, launchpadHash, result) {
  try {
    const id = `${userId}_${geoid}_${businessType}`;
    await db.insert(fitIqCache).values({
      id,
      userId,
      geoid,
      score: result.fitIQ,
      data: {
        business_type: businessType,
        grade: result.grade,
        dimensions: result.dimensions,
        archetype: result.archetype || null,
        archetype_score: result.archetypeScore || null,
        alignment: result.alignment || null,
        launchpad_hash: launchpadHash,
        computed_at: (/* @__PURE__ */ new Date()).toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
      }
    }).onConflictDoUpdate({
      target: fitIqCache.id,
      set: {
        score: result.fitIQ,
        data: {
          business_type: businessType,
          grade: result.grade,
          dimensions: result.dimensions,
          archetype: result.archetype || null,
          archetype_score: result.archetypeScore || null,
          alignment: result.alignment || null,
          launchpad_hash: launchpadHash,
          computed_at: (/* @__PURE__ */ new Date()).toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString()
        }
      }
    });
  } catch (err) {
    console.warn("[FitIQ] Cache write failed (non-blocking):", err instanceof Error ? err.message : err);
  }
}
const POST = async ({ request }) => {
  const auth = await requireAuth(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json();
    if (!body.geoid || typeof body.geoid !== "string") {
      return new Response(JSON.stringify({
        error: "Missing or invalid geoid",
        usage: 'POST /api/fit-iq/compute with { geoid: "360610076001", launchpad: { businessType: "coffee", ... } }'
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (!body.launchpad?.businessType) {
      return new Response(JSON.stringify({
        error: "Missing launchpad.businessType — at minimum, we need to know what kind of business"
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const startMs = Date.now();
    const launchpadHash = hashLaunchpad(body.launchpad);
    const cached = await getCachedFitIQ(auth.userId, body.geoid, body.launchpad.businessType, launchpadHash);
    if (cached) {
      return new Response(JSON.stringify({
        ...cached,
        _meta: {
          geoid: body.geoid,
          businessType: body.launchpad.businessType,
          userId: auth.userId,
          durationMs: Date.now() - startMs,
          cached: true
        }
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=300"
        }
      });
    }
    const result = await computeFitIQ(body.geoid, body.launchpad);
    const durationMs = Date.now() - startMs;
    cacheFitIQResult(auth.userId, body.geoid, body.launchpad.businessType, launchpadHash, result);
    if (body.legacyFitIq !== void 0) {
      db.insert(fitIqShadowLog).values({
        id: crypto.randomUUID(),
        geoid: body.geoid,
        logData: {
          user_id: auth.userId,
          concept: body.launchpad.businessType,
          legacy_score: body.legacyFitIq,
          shadow_score: result.fitIQ,
          discrepancy: Math.abs(body.legacyFitIq - result.fitIQ),
          input_snapshot: body.launchpad
        }
      }).catch((err) => {
        console.warn("[FitIQ] Shadow log write failed:", err);
      });
    }
    return new Response(JSON.stringify({
      ...result,
      _meta: {
        geoid: body.geoid,
        businessType: body.launchpad.businessType,
        userId: auth.userId,
        durationMs,
        cached: false
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300"
        // 5 min browser cache
      }
    });
  } catch (err) {
    console.error("[FitIQ] Compute error:", err);
    return new Response(JSON.stringify({
      error: "Failed to compute Fit IQ",
      message: err instanceof Error ? err.message : "Unknown error"
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
export {
  POST
};
