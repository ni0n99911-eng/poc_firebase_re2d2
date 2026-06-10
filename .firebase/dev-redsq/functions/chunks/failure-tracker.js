const MAX_FAILURES_TOTAL = 500;
const ring = [];
function trackSourceFailure(source, kind, message) {
  if (ring.length >= MAX_FAILURES_TOTAL) ring.shift();
  ring.push({ source, kind, message: String(message).slice(0, 300), ts: Date.now() });
}
function getFailureStats() {
  const bySource = /* @__PURE__ */ new Map();
  for (const rec of ring) {
    let arr = bySource.get(rec.source);
    if (!arr) {
      arr = [];
      bySource.set(rec.source, arr);
    }
    arr.push(rec);
  }
  const result = {};
  for (const [source, recs] of bySource.entries()) {
    const last = recs[recs.length - 1];
    result[source] = {
      source,
      failureCount: recs.length,
      lastKind: last.kind,
      lastError: last.message,
      lastSeenMs: last.ts,
      lastSeenIso: new Date(last.ts).toISOString()
    };
  }
  return result;
}
function getFailureRing(limit = 100) {
  return ring.slice(-limit);
}
export {
  getFailureRing as a,
  getFailureStats as g,
  trackSourceFailure as t
};
