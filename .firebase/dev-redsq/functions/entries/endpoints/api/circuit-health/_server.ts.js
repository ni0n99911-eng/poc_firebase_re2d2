import { json } from "@sveltejs/kit";
import { r as requireAuth } from "../../../../chunks/auth-middleware.js";
import { g as getCircuitStats, a as getRateLimitStats } from "../../../../chunks/retry.js";
import { g as getBreakerStates } from "../../../../chunks/resilient-fetch.js";
const GET = async ({ request }) => {
  const auth = await requireAuth(request);
  if ("response" in auth) return auth.response;
  try {
    const retryCircuits = getCircuitStats();
    const sourceBreakers = getBreakerStates();
    const rateLimits = getRateLimitStats();
    const openRetryCircuits = Object.values(retryCircuits).filter((c) => c.open).length;
    const openSourceBreakers = Object.values(sourceBreakers).filter((b) => b.state !== "CLOSED").length;
    const nearLimitApis = Object.entries(rateLimits).filter(([, s]) => s.nearLimit).map(([label]) => label);
    return json({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      retryCircuits,
      sourceBreakers,
      rateLimits,
      summary: {
        totalRetryCircuits: Object.keys(retryCircuits).length,
        openRetryCircuits,
        totalSourceBreakers: Object.keys(sourceBreakers).length,
        openSourceBreakers,
        nearLimitApis,
        estimatedGoogleCostUsd: rateLimits["GooglePlaces"]?.estimatedCostUsd ?? 0
      }
    });
  } catch (err) {
    console.error("[circuit-health] Error reading circuit state:", err);
    return json(
      { error: "Failed to read circuit state", timestamp: (/* @__PURE__ */ new Date()).toISOString() },
      { status: 500 }
    );
  }
};
export {
  GET
};
