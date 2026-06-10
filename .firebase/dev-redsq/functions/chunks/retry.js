const RATE_LIMIT_CONFIGS = {
  GooglePlaces: {
    dailyLimit: 3125,
    // ~$100/day budget at $32/1K = 3125 calls/day
    warnFraction: 0.8,
    costPer1k: 32,
    isHardLimit: false
  },
  Foursquare: {
    dailyLimit: 1e3,
    warnFraction: 0.8,
    costPer1k: 0,
    isHardLimit: false
    // soft — degrades to cached data, not a hard block
  },
  Yelp: {
    dailyLimit: 500,
    warnFraction: 0.8,
    costPer1k: 0,
    isHardLimit: true
    // 429 returned after 500/day
  }
};
const _windows = /* @__PURE__ */ new Map();
const WINDOW_MS = 24 * 60 * 60 * 1e3;
function getWindow(label) {
  let w = _windows.get(label);
  if (!w) {
    w = { timestamps: [], lifetimeCount: 0 };
    _windows.set(label, w);
  }
  return w;
}
function pruneWindow(w) {
  const cutoff = Date.now() - WINDOW_MS;
  let i = 0;
  while (i < w.timestamps.length && w.timestamps[i] < cutoff) i++;
  if (i > 0) w.timestamps.splice(0, i);
}
function trackApiCall(label) {
  const w = getWindow(label);
  pruneWindow(w);
  w.timestamps.push(Date.now());
  w.lifetimeCount++;
  const config = RATE_LIMIT_CONFIGS[label];
  if (config) {
    const count = w.timestamps.length;
    const warnAt = Math.floor(config.dailyLimit * config.warnFraction);
    if (count === warnAt) {
      const est = config.costPer1k > 0 ? ` (~$${(count / 1e3 * config.costPer1k).toFixed(2)} spent today)` : "";
      console.warn(
        `[RateLimit] ${label}: ${count}/${config.dailyLimit} calls today${est}. ${config.isHardLimit ? "Hard limit — 429 approaching." : "Budget warning."}`
      );
    }
    if (config.isHardLimit && count >= config.dailyLimit) {
      console.error(
        `[RateLimit] ${label}: LIMIT REACHED (${count}/${config.dailyLimit}). API will return 429. Scoring pipeline will degrade gracefully.`
      );
    }
  }
}
function getRateLimitStats() {
  const result = {};
  for (const label of Object.keys(RATE_LIMIT_CONFIGS)) {
    const w = _windows.get(label);
    const pruned = w ? (pruneWindow(w), w.timestamps.length) : 0;
    const lifetimeCount = w?.lifetimeCount ?? 0;
    const config = RATE_LIMIT_CONFIGS[label];
    const utilizationPct = config.dailyLimit > 0 ? Math.round(pruned / config.dailyLimit * 100) : 0;
    const warnAt = Math.floor(config.dailyLimit * config.warnFraction);
    result[label] = {
      windowCount: pruned,
      lifetimeCount,
      dailyLimit: config.dailyLimit,
      utilizationPct,
      nearLimit: pruned >= warnAt,
      atLimit: pruned >= config.dailyLimit,
      estimatedCostUsd: config.costPer1k > 0 ? Math.round(pruned / 1e3 * config.costPer1k * 100) / 100 : 0,
      limitType: config.isHardLimit ? "hard" : config.costPer1k > 0 ? "budget" : "unknown"
    };
  }
  for (const [label, w] of _windows.entries()) {
    if (!RATE_LIMIT_CONFIGS[label]) {
      pruneWindow(w);
      result[label] = {
        windowCount: w.timestamps.length,
        lifetimeCount: w.lifetimeCount,
        dailyLimit: 0,
        utilizationPct: 0,
        nearLimit: false,
        atLimit: false,
        estimatedCostUsd: 0,
        limitType: "unknown"
      };
    }
  }
  return result;
}
const MAX_RETRIES = (() => {
  const env = typeof process !== "undefined" ? process.env?.NETLIFY_MAX_RETRIES : void 0;
  const parsed = env ? parseInt(env, 10) : 0;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
})();
const BASE_DELAY_MS = 500;
const MAX_TIMEOUT_MS = (() => {
  const env = typeof process !== "undefined" ? process.env?.NETLIFY_FETCH_TIMEOUT_MS : void 0;
  const parsed = env ? parseInt(env, 10) : 8e3;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8e3;
})();
const circuits = /* @__PURE__ */ new Map();
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 5 * 6e4;
function getHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url.split("/")[2] || "unknown";
  }
}
function isCircuitOpen(host) {
  const s = circuits.get(host);
  if (!s || s.state === "closed") return false;
  if (s.state === "open") {
    if (Date.now() - s.lastFailure > CIRCUIT_RESET_MS) {
      s.state = "half_open";
      console.info(`[CircuitBreaker] HALF_OPEN for ${host} — probe allowed`);
      return false;
    }
    return true;
  }
  if (s.state === "half_open") {
    return false;
  }
  return false;
}
function recordFailure(host) {
  const s = circuits.get(host) || { failures: 0, lastFailure: 0, state: "closed" };
  s.failures++;
  s.lastFailure = Date.now();
  if (s.state === "half_open") {
    s.state = "open";
    console.warn(`[CircuitBreaker] OPEN (probe failed) for ${host}`);
  } else if (s.failures >= CIRCUIT_THRESHOLD) {
    s.state = "open";
    console.warn(`[CircuitBreaker] OPEN for ${host} (${s.failures} failures)`);
  }
  circuits.set(host, s);
}
function recordSuccess(host) {
  const s = circuits.get(host);
  if (s) {
    if (s.state === "half_open") {
      console.info(`[CircuitBreaker] CLOSED for ${host} — probe succeeded`);
    }
    s.failures = 0;
    s.state = "closed";
  }
}
async function resilientFetch(url, options = {}) {
  const {
    timeout: rawTimeout = 12e3,
    maxRetries = MAX_RETRIES,
    headers = {},
    label = getHost(url)
  } = options;
  const timeout = Math.min(rawTimeout, MAX_TIMEOUT_MS);
  const host = getHost(url);
  if (isCircuitOpen(host)) {
    throw new Error(`[${label}] Circuit breaker OPEN — skipping (too many recent failures)`);
  }
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          ...headers
        }
      });
      clearTimeout(timer);
      if (res.ok) {
        recordSuccess(host);
        trackApiCall(label);
        return res;
      }
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter) * 1e3 : BASE_DELAY_MS * Math.pow(2, attempt);
        if (attempt < maxRetries) {
          console.warn(`[${label}] Rate limited (429), waiting ${waitMs}ms before retry ${attempt + 1}`);
          await sleep(Math.min(waitMs, 1e4));
          continue;
        }
      }
      if (res.status >= 500 && attempt < maxRetries) {
        console.warn(`[${label}] Server error ${res.status}, retry ${attempt + 1}/${maxRetries}`);
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      if (res.status >= 400 && res.status < 500) {
        return res;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") {
        lastError = new Error(`[${label}] Request timed out (${timeout / 1e3}s)`);
      }
      if (attempt < maxRetries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[${label}] Fetch error: ${lastError.message}, retry ${attempt + 1} in ${delay}ms`);
        await sleep(delay);
        continue;
      }
    }
  }
  recordFailure(host);
  throw lastError || new Error(`[${label}] All retries exhausted`);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function getCircuitStats() {
  const result = {};
  for (const [host, s] of circuits.entries()) {
    result[host] = {
      failures: s.failures,
      open: s.state !== "closed",
      state: s.state
    };
  }
  return result;
}
async function openrouterFetch(url, init, label = "OpenRouter") {
  const BACKOFF = [2e3, 4e3];
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if ((res.status === 429 || res.status >= 500) && attempt < 1) {
        const retryAfter = res.headers.get("Retry-After");
        const wait = retryAfter ? parseInt(retryAfter, 10) * 1e3 : BACKOFF[attempt];
        console.warn(`[${label}] HTTP ${res.status} — retrying in ${wait}ms (attempt ${attempt + 1}/1)`);
        await sleep(Math.min(wait, 8e3));
        continue;
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        console.error(`[${label}] HTTP ${res.status} (non-retriable)`);
        return null;
      }
      console.error(`[${label}] HTTP ${res.status} — retries exhausted`);
      return null;
    } catch (err) {
      if (attempt < 1) {
        console.warn(`[${label}] Fetch error: ${err instanceof Error ? err.message : err} — retrying in ${BACKOFF[attempt]}ms`);
        await sleep(BACKOFF[attempt]);
        continue;
      }
      console.error(`[${label}] Fetch failed after retry:`, err instanceof Error ? err.message : err);
      return null;
    }
  }
  return null;
}
const retry = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getCircuitStats,
  openrouterFetch,
  resilientFetch
}, Symbol.toStringTag, { value: "Module" }));
export {
  getRateLimitStats as a,
  retry as b,
  getCircuitStats as g,
  openrouterFetch as o,
  resilientFetch as r
};
