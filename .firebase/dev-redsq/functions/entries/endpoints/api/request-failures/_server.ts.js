import { json } from "@sveltejs/kit";
import { r as requireAuth } from "../../../../chunks/auth-middleware.js";
import { g as getFailureStats, a as getFailureRing } from "../../../../chunks/failure-tracker.js";
const GET = async ({ request }) => {
  const auth = await requireAuth(request);
  if ("response" in auth) return auth.response;
  const stats = getFailureStats();
  const ring = getFailureRing(50);
  const degradedSources = Object.keys(stats);
  const criticalSources = Object.entries(stats).filter(([, s]) => s.failureCount >= 5).map(([src]) => src);
  const sources = {};
  for (const [source, stat] of Object.entries(stats)) {
    sources[source] = {
      failureCount: stat.failureCount,
      lastKind: stat.lastKind,
      lastError: stat.lastError,
      lastSeen: stat.lastSeenIso
    };
  }
  return json({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    totalInRing: ring.length,
    sources,
    recentLog: ring.map((r) => ({
      source: r.source,
      kind: r.kind,
      message: r.message,
      ts: new Date(r.ts).toISOString()
    })),
    summary: {
      degradedSources,
      criticalSources
    }
  }, {
    status: 200,
    headers: { "Cache-Control": "no-store" }
  });
};
export {
  GET
};
