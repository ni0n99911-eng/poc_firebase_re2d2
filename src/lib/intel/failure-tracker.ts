/**
 * RE² Failure Tracker — per-API-source failure ring buffer
 *
 * Records failed and partially-null source results from resilient-fetch.ts
 * so that GET /api/request-failures can surface a persistent (in-process)
 * view of which sources are degraded without having to inspect individual
 * per-request errors arrays.
 *
 * In-process only (no cross-invocation persistence on Netlify stateless).
 * Ring buffer capped at MAX_FAILURES_TOTAL to prevent unbounded growth.
 *
 * Wired from: resilient-fetch.ts on both error and null-return paths.
 * Consumed by: GET /api/request-failures
 *
 * INFRA-04 — Brain 2, April 12 2026
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type FailureKind =
	| 'error'            // exception thrown by the source function
	| 'null_return'      // source returned null (API unreachable / no data)
	| 'breaker_open';    // circuit breaker blocked the call

export interface FailureRecord {
	source:      string;
	kind:        FailureKind;
	message:     string;
	ts:          number;         // epoch ms
}

export interface SourceFailureStat {
	source:        string;
	failureCount:  number;
	lastKind:      FailureKind;
	lastError:     string;
	lastSeenMs:    number;       // epoch ms of most recent failure
	lastSeenIso:   string;       // ISO-8601 for JSON consumers
}

// ── Config ────────────────────────────────────────────────────────────────────

/** Max total failure records across ALL sources */
const MAX_FAILURES_TOTAL = 500;

// ── State ─────────────────────────────────────────────────────────────────────

/** Global ring buffer — ordered oldest→newest */
const ring: FailureRecord[] = [];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a failure event for `source`.
 * Called from resilient-fetch.ts on exception, null-return, or open-breaker paths.
 */
export function trackSourceFailure(
	source:  string,
	kind:    FailureKind,
	message: string
): void {
	if (ring.length >= MAX_FAILURES_TOTAL) ring.shift();
	ring.push({ source, kind, message: String(message).slice(0, 300), ts: Date.now() });
}

/**
 * Return per-source failure stats aggregated from the ring buffer.
 * Sources with zero failures are omitted.
 *
 * Returns: `{ source, failureCount, lastKind, lastError, lastSeenMs, lastSeenIso }`
 */
export function getFailureStats(): Record<string, SourceFailureStat> {
	const bySource = new Map<string, FailureRecord[]>();

	for (const rec of ring) {
		let arr = bySource.get(rec.source);
		if (!arr) { arr = []; bySource.set(rec.source, arr); }
		arr.push(rec);
	}

	const result: Record<string, SourceFailureStat> = {};

	for (const [source, recs] of bySource.entries()) {
		// recs are in ring insertion order (oldest first) — last is most recent
		const last = recs[recs.length - 1];
		result[source] = {
			source,
			failureCount: recs.length,
			lastKind:     last.kind,
			lastError:    last.message,
			lastSeenMs:   last.ts,
			lastSeenIso:  new Date(last.ts).toISOString(),
		};
	}

	return result;
}

/**
 * Return the raw ring buffer (most recent last).
 * Used for detailed log view — limit applied by the caller.
 */
export function getFailureRing(limit = 100): FailureRecord[] {
	return ring.slice(-limit);
}

/**
 * Reset all failure records. For tests only.
 */
export function resetFailureCounters(): void {
	ring.length = 0;
}
