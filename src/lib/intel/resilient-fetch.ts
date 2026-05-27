/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RE² Resilient Fetch — Circuit Breaker Registry for External APIs
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Wraps individual intel source fetches with per-source circuit breakers.
 * When an API fails 3 times, the breaker opens for 60s — subsequent calls
 * return null instantly instead of hitting a dead API.
 *
 * Usage:
 *   import { resilientFetch } from './resilient-fetch';
 *   const data = await resilientFetch('census', () => fetchCensusData(lat, lng));
 *   // Returns null if breaker is open, otherwise delegates to fetchCensusData
 */

import { createCircuitBreaker, type CircuitBreakerState } from './circuit-breaker';
import { trackLatency } from './latency-tracker';
import { trackSourceFailure } from './failure-tracker';

// ── Per-source circuit breakers ──────────────────────────────────────────────

type BreakerEntry = ReturnType<typeof createCircuitBreaker<any>>;

const breakers = new Map<string, BreakerEntry>();

// Config: external APIs with rate limits get tighter thresholds
const BREAKER_CONFIGS: Record<string, { failureThreshold: number; resetTimeout: number }> = {
	// External APIs with rate limits / cost — trip fast, wait longer
	google_places:   { failureThreshold: 2, resetTimeout: 90_000 },
	google_density:  { failureThreshold: 2, resetTimeout: 90_000 },
	walkscore:       { failureThreshold: 2, resetTimeout: 90_000 },
	foursquare:      { failureThreshold: 3, resetTimeout: 60_000 },
	yelp:            { failureThreshold: 3, resetTimeout: 60_000 },

	// Public APIs (Socrata / Census) — more lenient
	census:          { failureThreshold: 3, resetTimeout: 45_000 },
	census_housing:  { failureThreshold: 3, resetTimeout: 45_000 },
	overpass:        { failureThreshold: 3, resetTimeout: 60_000 },
	dohmh:           { failureThreshold: 3, resetTimeout: 45_000 },
	crime:           { failureThreshold: 3, resetTimeout: 45_000 },
	lpc:             { failureThreshold: 4, resetTimeout: 30_000 },
	mta:             { failureThreshold: 4, resetTimeout: 30_000 },
	dca:             { failureThreshold: 4, resetTimeout: 30_000 },
	dob:             { failureThreshold: 4, resetTimeout: 30_000 },
	complaints_311:  { failureThreshold: 4, resetTimeout: 30_000 },
	pedestrian:      { failureThreshold: 4, resetTimeout: 30_000 },
	pluto:           { failureThreshold: 4, resetTimeout: 30_000 },
	sidewalk_cafes:  { failureThreshold: 4, resetTimeout: 30_000 },
	liquor:          { failureThreshold: 4, resetTimeout: 30_000 },
	momentum:        { failureThreshold: 4, resetTimeout: 30_000 },
};

function getBreaker(source: string): BreakerEntry {
	let breaker = breakers.get(source);
	if (!breaker) {
		const config = BREAKER_CONFIGS[source] || { failureThreshold: 3, resetTimeout: 60_000 };
		breaker = createCircuitBreaker<any>(source, config);
		breakers.set(source, breaker);
	}
	return breaker;
}

/**
 * Execute a fetch function through its circuit breaker.
 * Returns null (not an error) when the breaker is open — the caller's
 * existing null-handling takes care of missing sources gracefully.
 */
export async function resilientFetch<T>(
	source: string,
	fn: () => Promise<T | null>,
): Promise<T | null> {
	const breaker = getBreaker(source);
	const t0 = Date.now();
	try {
		const result = await breaker.call(fn);
		const durationMs = Date.now() - t0;
		trackLatency(source, durationMs); // INFRA-03: p50/p95/p99 per source
		if (result === null) {
			trackSourceFailure(source, 'null_return', 'source returned null'); // INFRA-04
		}
		return result;
	} catch (err: any) {
		const durationMs = Date.now() - t0;
		trackLatency(source, durationMs); // INFRA-03: include timeouts in distribution
		// Circuit breaker open → return null (matches existing null-on-failure pattern)
		if (err?.message?.includes('Circuit breaker') && err?.message?.includes('OPEN')) {
			console.warn(`[ResilientFetch] ${source}: breaker OPEN — skipping`);
			trackSourceFailure(source, 'breaker_open', 'circuit breaker is OPEN'); // INFRA-04
			return null;
		}
		// Actual API error — the breaker has already recorded the failure
		const msg = err?.message || String(err);
		console.warn(`[ResilientFetch] ${source}: ${msg}`);
		trackSourceFailure(source, 'error', msg); // INFRA-04
		return null;
	}
}

// ─────────────────────────────────────────────────
// Observability — breaker state snapshot
// ─────────────────────────────────────────────────

/**
 * Return per-source circuit breaker states.
 * Used by GET /api/circuit-health for ops monitoring.
 * Sources without a breaker (never called) are omitted.
 */
export function getBreakerStates(): Record<string, {
	state: string;
	config: { failureThreshold: number; resetTimeout: number };
}> {
	const result: Record<string, { state: string; config: { failureThreshold: number; resetTimeout: number } }> = {};
	for (const [source, breaker] of breakers.entries()) {
		const config = BREAKER_CONFIGS[source] || { failureThreshold: 3, resetTimeout: 60_000 };
		result[source] = {
			state: breaker.getState(),
			config,
		};
	}
	return result;
}

