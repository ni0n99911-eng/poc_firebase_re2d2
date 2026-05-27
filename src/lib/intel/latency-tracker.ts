/**
 * RE² Latency Tracker — per-API-source p50/p95/p99 monitoring
 *
 * Tracks rolling 5-minute call latency for every named API source that
 * passes through resilient-fetch.ts. Timestamps are pruned on each write
 * so the window is always live. In-process only (Netlify stateless —
 * no cross-request persistence; values reset on cold-start).
 *
 * Wired from: resilient-fetch.ts (wraps every source call in fetchLocationIntel)
 * Consumed by: GET /api/circuit-health (added to latency section of response)
 *
 * INFRA-03 — Brain 2, April 12 2026
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LatencyStat {
	source:    string;
	count:     number;          // calls in the window
	p50Ms:     number;
	p95Ms:     number;
	p99Ms:     number;
	minMs:     number;
	maxMs:     number;
	windowMs:  number;          // window duration (ms)
}

interface LatencyEntry {
	ts:         number;         // epoch ms when call completed
	durationMs: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

/** Rolling window for percentile calculations */
const WINDOW_MS = 5 * 60 * 1000;          // 5 minutes

/** Safety cap per source to avoid unbounded memory in a long-lived instance */
const MAX_ENTRIES_PER_SOURCE = 1000;

// ── State ─────────────────────────────────────────────────────────────────────

const latencyStore = new Map<string, LatencyEntry[]>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a completed call for `source` with the given wall-clock duration.
 * Called from resilient-fetch.ts on both success and failure paths so that
 * timeouts and errors are included in the distribution (they affect p99 most).
 */
export function trackLatency(source: string, durationMs: number): void {
	const now = Date.now();
	let entries = latencyStore.get(source);
	if (!entries) {
		entries = [];
		latencyStore.set(source, entries);
	}

	// Prune entries outside the window
	const cutoff = now - WINDOW_MS;
	const firstValid = entries.findIndex(e => e.ts >= cutoff);
	if (firstValid > 0) entries.splice(0, firstValid);
	else if (firstValid === -1) entries.length = 0;

	// Enforce safety cap
	if (entries.length >= MAX_ENTRIES_PER_SOURCE) entries.shift();

	entries.push({ ts: now, durationMs });
}

/**
 * Return p50/p95/p99 stats for all sources that have recorded calls.
 * Sources with zero entries in the window are omitted.
 */
export function getLatencyStats(): Record<string, LatencyStat> {
	const now = Date.now();
	const cutoff = now - WINDOW_MS;
	const result: Record<string, LatencyStat> = {};

	for (const [source, entries] of latencyStore.entries()) {
		// Only entries inside the window
		const fresh = entries.filter(e => e.ts >= cutoff).map(e => e.durationMs);
		if (fresh.length === 0) continue;

		const sorted = [...fresh].sort((a, b) => a - b);
		result[source] = {
			source,
			count:    sorted.length,
			p50Ms:    percentile(sorted, 0.50),
			p95Ms:    percentile(sorted, 0.95),
			p99Ms:    percentile(sorted, 0.99),
			minMs:    sorted[0],
			maxMs:    sorted[sorted.length - 1],
			windowMs: WINDOW_MS,
		};
	}

	return result;
}

/**
 * Reset all counters. For tests only — do not call in production.
 */
export function resetLatencyCounters(): void {
	latencyStore.clear();
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Nearest-rank percentile on a sorted array (ascending).
 * Returns 0 for empty arrays.
 */
function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	if (sorted.length === 1) return sorted[0];

	// Nearest rank method (1-indexed)
	const rank = Math.ceil(p * sorted.length);
	return sorted[Math.min(rank - 1, sorted.length - 1)];
}
