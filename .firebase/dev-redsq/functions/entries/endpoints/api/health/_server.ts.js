import { json } from "@sveltejs/kit";
import { d as db, k as founderSessions } from "../../../../chunks/db-server.js";
import { p as private_env } from "../../../../chunks/private.js";
import { g as getCacheStats } from "../../../../chunks/nyc-schools.js";
import { g as getCircuitStats, a as getRateLimitStats } from "../../../../chunks/retry.js";
import { g as getBreakerStates } from "../../../../chunks/resilient-fetch.js";
import { g as getCacheHitStats } from "../../../../chunks/cache.js";
const GET = async ({ request }) => {
  const checks = {};
  checks.clerk = {
    ok: true,
    detail: "bypassed for firebase session cookies"
  };
  try {
    await db.select({ userId: founderSessions.userId }).from(founderSessions).limit(1);
    checks.supabase = { ok: true };
  } catch (e) {
    checks.supabase = { ok: false, detail: String(e) };
  }
  checks.storage = { ok: true, detail: "bypassed for drizzle" };
  try {
    const key = private_env.OPENROUTER_API_KEY || "";
    if (!key) {
      checks.openrouter = { ok: false, detail: "OPENROUTER_API_KEY not set" };
    } else {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5e3);
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
          method: "HEAD",
          headers: { Authorization: `Bearer ${key}` },
          signal: ctrl.signal
        });
        clearTimeout(timer);
        checks.openrouter = { ok: res.ok || res.status === 405, detail: !res.ok && res.status !== 405 ? `HTTP ${res.status}` : void 0 };
      } catch {
        clearTimeout(timer);
        checks.openrouter = { ok: false, detail: "Network error or timeout" };
      }
    }
  } catch (e) {
    checks.openrouter = { ok: false, detail: String(e) };
  }
  const allOk = Object.values(checks).every((c) => c.ok);
  let schoolsCache = null;
  try {
    schoolsCache = getCacheStats();
  } catch {
    schoolsCache = null;
  }
  let retryCircuits = null;
  let sourceBreakers = null;
  try {
    retryCircuits = getCircuitStats();
  } catch {
    retryCircuits = null;
  }
  try {
    sourceBreakers = getBreakerStates();
  } catch {
    sourceBreakers = null;
  }
  let cacheHitStats = null;
  try {
    cacheHitStats = getCacheHitStats();
  } catch {
    cacheHitStats = null;
  }
  let rateLimits = null;
  let nearLimitApis = [];
  try {
    rateLimits = getRateLimitStats();
    nearLimitApis = Object.entries(rateLimits).filter(([, s]) => s.nearLimit).map(([label]) => label);
  } catch {
    rateLimits = null;
  }
  return json({
    ok: allOk,
    checks,
    caches: {
      schools: schoolsCache,
      hitRates: cacheHitStats
    },
    // MON-01 fields — non-gating observability
    circuits: {
      retryCircuits,
      sourceBreakers
    },
    quotas: {
      rateLimits,
      nearLimitApis,
      estimatedGoogleCostUsd: rateLimits?.["GooglePlaces"]?.estimatedCostUsd ?? 0
    }
  }, {
    status: 200,
    headers: { "Cache-Control": "no-store" }
  });
};
export {
  GET
};
