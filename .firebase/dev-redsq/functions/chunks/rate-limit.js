const DEFAULT_OPTIONS = {
  maxRequests: 60,
  // 60 requests
  windowMs: 60 * 1e3
  // per minute
};
const buckets = /* @__PURE__ */ new Map();
const CLEANUP_INTERVAL = 5 * 60 * 1e3;
let lastCleanup = Date.now();
function cleanup(now) {
  for (const [route, bucketObj] of buckets) {
    for (const [ip, entry] of bucketObj.entries) {
      if (now - entry.windowStart > bucketObj.windowMs * 2) {
        bucketObj.entries.delete(ip);
      }
    }
    if (bucketObj.entries.size === 0) buckets.delete(route);
  }
}
function getClientIP(request) {
  return request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown";
}
function rateLimit(request, options = {}, routeKey) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const ip = getClientIP(request);
  const route = new URL(request.url).pathname;
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanup(now);
    lastCleanup = now;
  }
  if (!buckets.has(route)) {
    buckets.set(route, { windowMs: opts.windowMs, entries: /* @__PURE__ */ new Map() });
  } else {
    buckets.get(route).windowMs = opts.windowMs;
  }
  const routeBucket = buckets.get(route).entries;
  const entry = routeBucket.get(ip);
  if (!entry || now - entry.windowStart > opts.windowMs) {
    routeBucket.set(ip, { count: 1, windowStart: now });
    return null;
  }
  entry.count++;
  if (entry.count > opts.maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + opts.windowMs - now) / 1e3);
    return new Response(JSON.stringify({
      error: "Too many requests",
      retryAfter
    }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(opts.maxRequests),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil((entry.windowStart + opts.windowMs) / 1e3))
      }
    });
  }
  return null;
}
function _envInt(key, fallback) {
  const v = typeof process !== "undefined" ? process.env?.[key] : void 0;
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const RATE_LIMITS = {
  /** Public API routes: 100 req/min (override: RATE_LIMIT_API) */
  api: { maxRequests: _envInt("RATE_LIMIT_API", 100), windowMs: 6e4 },
  /** Intel/scoring routes (expensive): 50 req/min (override: RATE_LIMIT_INTEL) */
  intel: { maxRequests: _envInt("RATE_LIMIT_INTEL", 50), windowMs: 6e4 },
  /** Auth-related routes: 50 req/min (override: RATE_LIMIT_AUTH) */
  auth: { maxRequests: _envInt("RATE_LIMIT_AUTH", 50) },
  /** AI generation routes: 50 req/min (override: RATE_LIMIT_AI) */
  ai: { maxRequests: _envInt("RATE_LIMIT_AI", 50), windowMs: 6e4 },
  /** Export/PDF generation: 50 req/min (override: RATE_LIMIT_EXPORT) */
  export: { maxRequests: _envInt("RATE_LIMIT_EXPORT", 50), windowMs: 6e4 }
};
export {
  RATE_LIMITS as R,
  rateLimit as r
};
