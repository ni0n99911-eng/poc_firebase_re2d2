import { t as trackSourceFailure } from "./failure-tracker.js";
function createCircuitBreaker(name, config = {}) {
  const failureThreshold = config.failureThreshold ?? 3;
  const baseResetTimeout = config.resetTimeout ?? 6e4;
  const maxResetTimeout = config.maxResetTimeout ?? 3e5;
  const onStateChange = config.onStateChange;
  const internal = {
    state: "CLOSED",
    failureCount: 0,
    lastFailureTime: null,
    probeInFlight: false,
    totalFailures: 0,
    totalSuccesses: 0,
    probeAttempts: 0,
    probeSuccesses: 0,
    currentResetTimeout: baseResetTimeout,
    consecutiveProbeFailures: 0
  };
  function transition(to) {
    if (internal.state === to) return;
    const from = internal.state;
    internal.state = to;
    if (onStateChange) {
      try {
        onStateChange(name, from, to);
      } catch {
      }
    }
    console.info(`[CircuitBreaker:${name}] ${from} → ${to}`);
  }
  return {
    async call(fn) {
      if (internal.state === "OPEN") {
        const elapsed = Date.now() - (internal.lastFailureTime ?? 0);
        if (elapsed >= internal.currentResetTimeout) {
          transition("HALF_OPEN");
          internal.probeInFlight = false;
        } else {
          throw new Error(
            `Circuit breaker ${name} is OPEN. Retry in ${Math.ceil((internal.currentResetTimeout - elapsed) / 1e3)}s`
          );
        }
      }
      if (internal.state === "HALF_OPEN") {
        if (internal.probeInFlight) {
          throw new Error(
            `Circuit breaker ${name} probe already in flight — wait for result`
          );
        }
        internal.probeInFlight = true;
        internal.probeAttempts++;
      }
      try {
        const result = await fn();
        internal.totalSuccesses++;
        if (internal.state === "HALF_OPEN") {
          internal.probeSuccesses++;
          internal.consecutiveProbeFailures = 0;
          internal.currentResetTimeout = baseResetTimeout;
          transition("CLOSED");
        }
        internal.failureCount = 0;
        internal.probeInFlight = false;
        return result;
      } catch (error) {
        internal.totalFailures++;
        internal.failureCount++;
        internal.lastFailureTime = Date.now();
        internal.probeInFlight = false;
        if (internal.state === "HALF_OPEN") {
          internal.consecutiveProbeFailures++;
          internal.currentResetTimeout = Math.min(
            baseResetTimeout * Math.pow(2, internal.consecutiveProbeFailures),
            maxResetTimeout
          );
          transition("OPEN");
          console.warn(
            `[CircuitBreaker:${name}] Probe failed — next probe in ${Math.round(internal.currentResetTimeout / 1e3)}s`
          );
        } else if (internal.failureCount >= failureThreshold) {
          transition("OPEN");
        }
        throw error;
      }
    },
    getState() {
      return internal.state;
    },
    getMetrics() {
      return {
        name,
        state: internal.state,
        failureCount: internal.failureCount,
        totalFailures: internal.totalFailures,
        totalSuccesses: internal.totalSuccesses,
        probeAttempts: internal.probeAttempts,
        probeSuccesses: internal.probeSuccesses,
        lastFailureTime: internal.lastFailureTime,
        currentResetTimeout: internal.currentResetTimeout
      };
    },
    reset() {
      transition("CLOSED");
      internal.failureCount = 0;
      internal.lastFailureTime = null;
      internal.probeInFlight = false;
      internal.consecutiveProbeFailures = 0;
      internal.currentResetTimeout = baseResetTimeout;
    }
  };
}
const WINDOW_MS = 5 * 60 * 1e3;
const MAX_ENTRIES_PER_SOURCE = 1e3;
const latencyStore = /* @__PURE__ */ new Map();
function trackLatency(source, durationMs) {
  const now = Date.now();
  let entries = latencyStore.get(source);
  if (!entries) {
    entries = [];
    latencyStore.set(source, entries);
  }
  const cutoff = now - WINDOW_MS;
  const firstValid = entries.findIndex((e) => e.ts >= cutoff);
  if (firstValid > 0) entries.splice(0, firstValid);
  else if (firstValid === -1) entries.length = 0;
  if (entries.length >= MAX_ENTRIES_PER_SOURCE) entries.shift();
  entries.push({ ts: now, durationMs });
}
const breakers = /* @__PURE__ */ new Map();
const BREAKER_CONFIGS = {
  // External APIs with rate limits / cost — trip fast, wait longer
  google_places: { failureThreshold: 2, resetTimeout: 9e4 },
  google_density: { failureThreshold: 2, resetTimeout: 9e4 },
  walkscore: { failureThreshold: 2, resetTimeout: 9e4 },
  foursquare: { failureThreshold: 3, resetTimeout: 6e4 },
  yelp: { failureThreshold: 3, resetTimeout: 6e4 },
  // Public APIs (Socrata / Census) — more lenient
  census: { failureThreshold: 3, resetTimeout: 45e3 },
  census_housing: { failureThreshold: 3, resetTimeout: 45e3 },
  overpass: { failureThreshold: 3, resetTimeout: 6e4 },
  dohmh: { failureThreshold: 3, resetTimeout: 45e3 },
  crime: { failureThreshold: 3, resetTimeout: 45e3 },
  lpc: { failureThreshold: 4, resetTimeout: 3e4 },
  mta: { failureThreshold: 4, resetTimeout: 3e4 },
  dca: { failureThreshold: 4, resetTimeout: 3e4 },
  dob: { failureThreshold: 4, resetTimeout: 3e4 },
  complaints_311: { failureThreshold: 4, resetTimeout: 3e4 },
  pedestrian: { failureThreshold: 4, resetTimeout: 3e4 },
  pluto: { failureThreshold: 4, resetTimeout: 3e4 },
  sidewalk_cafes: { failureThreshold: 4, resetTimeout: 3e4 },
  liquor: { failureThreshold: 4, resetTimeout: 3e4 },
  momentum: { failureThreshold: 4, resetTimeout: 3e4 }
};
function getBreaker(source) {
  let breaker = breakers.get(source);
  if (!breaker) {
    const config = BREAKER_CONFIGS[source] || { failureThreshold: 3, resetTimeout: 6e4 };
    breaker = createCircuitBreaker(source, config);
    breakers.set(source, breaker);
  }
  return breaker;
}
async function resilientFetch(source, fn) {
  const breaker = getBreaker(source);
  const t0 = Date.now();
  try {
    const result = await breaker.call(fn);
    const durationMs = Date.now() - t0;
    trackLatency(source, durationMs);
    if (result === null) {
      trackSourceFailure(source, "null_return", "source returned null");
    }
    return result;
  } catch (err) {
    const durationMs = Date.now() - t0;
    trackLatency(source, durationMs);
    if (err?.message?.includes("Circuit breaker") && err?.message?.includes("OPEN")) {
      console.warn(`[ResilientFetch] ${source}: breaker OPEN — skipping`);
      trackSourceFailure(source, "breaker_open", "circuit breaker is OPEN");
      return null;
    }
    const msg = err?.message || String(err);
    console.warn(`[ResilientFetch] ${source}: ${msg}`);
    trackSourceFailure(source, "error", msg);
    return null;
  }
}
function getBreakerStates() {
  const result = {};
  for (const [source, breaker] of breakers.entries()) {
    const config = BREAKER_CONFIGS[source] || { failureThreshold: 3, resetTimeout: 6e4 };
    result[source] = {
      state: breaker.getState(),
      config
    };
  }
  return result;
}
export {
  getBreakerStates as g,
  resilientFetch as r
};
