/**
 * F-13: Circuit breaker with half-open probe + observable metrics
 *
 * States: CLOSED (normal) → OPEN (fail fast) → HALF_OPEN (single probe) → CLOSED/OPEN
 *
 * Half-open probe strategy:
 *   - After resetTimeout, state transitions to HALF_OPEN
 *   - Exactly ONE call is allowed through as a probe
 *   - If probe succeeds → CLOSED (reset failures)
 *   - If probe fails → OPEN (restart reset timer with backoff)
 *   - Backoff doubles resetTimeout on consecutive probe failures (max 5 min)
 *
 * Metrics exposed via getMetrics() for /api/circuit-health endpoint.
 */

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
	failureThreshold?: number;   // default 3
	resetTimeout?: number;       // default 60_000ms
	maxResetTimeout?: number;    // default 300_000ms (5 min cap)
	onStateChange?: (name: string, from: CircuitBreakerState, to: CircuitBreakerState) => void;
}

export interface CircuitBreakerMetrics {
	name: string;
	state: CircuitBreakerState;
	failureCount: number;
	totalFailures: number;
	totalSuccesses: number;
	probeAttempts: number;
	probeSuccesses: number;
	lastFailureTime: number | null;
	currentResetTimeout: number;
}

interface CircuitBreakerInternal {
	state: CircuitBreakerState;
	failureCount: number;
	lastFailureTime: number | null;
	probeInFlight: boolean;
	// Metrics
	totalFailures: number;
	totalSuccesses: number;
	probeAttempts: number;
	probeSuccesses: number;
	// Backoff
	currentResetTimeout: number;
	consecutiveProbeFailures: number;
}

export function createCircuitBreaker<T>(
	name: string,
	config: CircuitBreakerConfig = {}
) {
	const failureThreshold = config.failureThreshold ?? 3;
	const baseResetTimeout = config.resetTimeout ?? 60_000;
	const maxResetTimeout = config.maxResetTimeout ?? 300_000;
	const onStateChange = config.onStateChange;

	const internal: CircuitBreakerInternal = {
		state: 'CLOSED',
		failureCount: 0,
		lastFailureTime: null,
		probeInFlight: false,
		totalFailures: 0,
		totalSuccesses: 0,
		probeAttempts: 0,
		probeSuccesses: 0,
		currentResetTimeout: baseResetTimeout,
		consecutiveProbeFailures: 0,
	};

	function transition(to: CircuitBreakerState): void {
		if (internal.state === to) return;
		const from = internal.state;
		internal.state = to;
		if (onStateChange) {
			try { onStateChange(name, from, to); } catch { /* observer errors don't affect breaker */ }
		}
		console.info(`[CircuitBreaker:${name}] ${from} → ${to}`);
	}

	return {
		async call(fn: () => Promise<T>): Promise<T> {
			// OPEN → check if probe window elapsed
			if (internal.state === 'OPEN') {
				const elapsed = Date.now() - (internal.lastFailureTime ?? 0);
				if (elapsed >= internal.currentResetTimeout) {
					transition('HALF_OPEN');
					internal.probeInFlight = false;
				} else {
					throw new Error(
						`Circuit breaker ${name} is OPEN. Retry in ${Math.ceil((internal.currentResetTimeout - elapsed) / 1000)}s`
					);
				}
			}

			// HALF_OPEN → only one probe at a time
			if (internal.state === 'HALF_OPEN') {
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

				// Success handling
				internal.totalSuccesses++;
				if (internal.state === 'HALF_OPEN') {
					internal.probeSuccesses++;
					internal.consecutiveProbeFailures = 0;
					internal.currentResetTimeout = baseResetTimeout; // reset backoff
					transition('CLOSED');
				}
				internal.failureCount = 0;
				internal.probeInFlight = false;

				return result;
			} catch (error) {
				internal.totalFailures++;
				internal.failureCount++;
				internal.lastFailureTime = Date.now();
				internal.probeInFlight = false;

				if (internal.state === 'HALF_OPEN') {
					// Probe failed — reopen with backoff
					internal.consecutiveProbeFailures++;
					internal.currentResetTimeout = Math.min(
						baseResetTimeout * Math.pow(2, internal.consecutiveProbeFailures),
						maxResetTimeout
					);
					transition('OPEN');
					console.warn(
						`[CircuitBreaker:${name}] Probe failed — next probe in ${Math.round(internal.currentResetTimeout / 1000)}s`
					);
				} else if (internal.failureCount >= failureThreshold) {
					transition('OPEN');
				}

				throw error;
			}
		},

		getState(): CircuitBreakerState {
			return internal.state;
		},

		getMetrics(): CircuitBreakerMetrics {
			return {
				name,
				state: internal.state,
				failureCount: internal.failureCount,
				totalFailures: internal.totalFailures,
				totalSuccesses: internal.totalSuccesses,
				probeAttempts: internal.probeAttempts,
				probeSuccesses: internal.probeSuccesses,
				lastFailureTime: internal.lastFailureTime,
				currentResetTimeout: internal.currentResetTimeout,
			};
		},

		reset(): void {
			transition('CLOSED');
			internal.failureCount = 0;
			internal.lastFailureTime = null;
			internal.probeInFlight = false;
			internal.consecutiveProbeFailures = 0;
			internal.currentResetTimeout = baseResetTimeout;
		},
	};
}

// ─── Global breaker registry for health endpoint ────────────────────

const registry = new Map<string, ReturnType<typeof createCircuitBreaker>>();

/**
 * Create and register a circuit breaker (makes it visible to /api/circuit-health).
 */
export function createRegisteredBreaker<T>(
	name: string,
	config: CircuitBreakerConfig = {}
): ReturnType<typeof createCircuitBreaker<T>> {
	const breaker = createCircuitBreaker<T>(name, config);
	registry.set(name, breaker as any);
	return breaker;
}

/**
 * Get metrics for all registered circuit breakers.
 * Consumed by /api/circuit-health endpoint.
 */
export function getAllBreakerMetrics(): CircuitBreakerMetrics[] {
	return [...registry.values()].map(b => b.getMetrics());
}
