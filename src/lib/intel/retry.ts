/**
 * Retry utility for external API calls with exponential backoff.
 *
 * Wraps fetch() for all 20 intel sources. Handles:
 * - Transient network failures (retry up to 2 times)
 * - Server errors (5xx → retry, 4xx → don't retry)
 * - Rate limiting (429 → respect Retry-After header)
 * - Circuit breaker (skip APIs that have failed 3+ times in the last 5 min)
 * - Rate limit tracking (in-process sliding window per API label)
 *
 * Usage:
 *   import { resilientFetch } from './retry';
 *   const res = await resilientFetch('https://api.example.com/data', { timeout: 10000 });
 */

import { trackApiCall } from './rate-limit-tracker';

// MAX_RETRIES: controlled by env var — upgrade Netlify Free→Pro and set env vars to unlock retries.
//   NETLIFY_MAX_RETRIES=2   → retries on (Pro tier, 26s budget)
//   unset / 0               → zero retries (Free tier, 10s budget — safe default)
const MAX_RETRIES = (() => {
	const env = typeof process !== 'undefined' ? process.env?.NETLIFY_MAX_RETRIES : undefined;
	const parsed = env ? parseInt(env, 10) : 0;
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
})();
const BASE_DELAY_MS = 500;
// MAX_TIMEOUT_MS: also env-configurable. Free→Pro upgrade: set NETLIFY_FETCH_TIMEOUT_MS=12000.
const MAX_TIMEOUT_MS = (() => {
	const env = typeof process !== 'undefined' ? process.env?.NETLIFY_FETCH_TIMEOUT_MS : undefined;
	const parsed = env ? parseInt(env, 10) : 8000;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
})();

// ─────────────────────────────────────────────────
// Circuit breaker — track failures per API host
// ─────────────────────────────────────────────────

// F-13: Proper circuit breaker with half-open state.
// States: CLOSED (normal) → OPEN (blocking) → HALF_OPEN (one test allowed) → CLOSED/OPEN
// Previously: after CIRCUIT_RESET_MS the breaker fully closed without testing.
// Now: transitions to HALF_OPEN, allows a single probe, re-opens on failure.
interface CircuitState {
	failures: number;
	lastFailure: number;
	state: 'closed' | 'open' | 'half_open';
}

const circuits = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = 3;           // Failures before opening
const CIRCUIT_RESET_MS = 5 * 60_000;  // 5 min before half-open probe

function getHost(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url.split('/')[2] || 'unknown';
	}
}

function isCircuitOpen(host: string): boolean {
	const s = circuits.get(host);
	if (!s || s.state === 'closed') return false;

	if (s.state === 'open') {
		// Check if enough time has passed to try a probe
		if (Date.now() - s.lastFailure > CIRCUIT_RESET_MS) {
			s.state = 'half_open';
			console.info(`[CircuitBreaker] HALF_OPEN for ${host} — probe allowed`);
			return false; // allow one request through
		}
		return true; // still blocked
	}

	if (s.state === 'half_open') {
		// Half-open: allow through — success/failure recorded by caller
		return false;
	}

	return false;
}

function recordFailure(host: string): void {
	const s = circuits.get(host) || { failures: 0, lastFailure: 0, state: 'closed' as const };
	s.failures++;
	s.lastFailure = Date.now();
	if (s.state === 'half_open') {
		// Probe failed — re-open
		s.state = 'open';
		console.warn(`[CircuitBreaker] OPEN (probe failed) for ${host}`);
	} else if (s.failures >= CIRCUIT_THRESHOLD) {
		s.state = 'open';
		console.warn(`[CircuitBreaker] OPEN for ${host} (${s.failures} failures)`);
	}
	circuits.set(host, s);
}

function recordSuccess(host: string): void {
	const s = circuits.get(host);
	if (s) {
		if (s.state === 'half_open') {
			console.info(`[CircuitBreaker] CLOSED for ${host} — probe succeeded`);
		}
		s.failures = 0;
		s.state = 'closed';
	}
}

// ─────────────────────────────────────────────────
// Resilient fetch
// ─────────────────────────────────────────────────

export interface ResilientFetchOptions {
	timeout?: number;          // Request timeout in ms (default: 12000)
	maxRetries?: number;       // Override max retries (default: 2)
	headers?: Record<string, string>;
	signal?: AbortSignal;      // External abort signal
	label?: string;            // For logging (e.g., 'Census', 'Crime')
}

export async function resilientFetch(
	url: string,
	options: ResilientFetchOptions = {}
): Promise<Response> {
	const {
		timeout: rawTimeout = 12000,
		maxRetries = MAX_RETRIES,
		headers = {},
		label = getHost(url)
	} = options;
	const timeout = Math.min(rawTimeout, MAX_TIMEOUT_MS); // Cap at 8s regardless of caller

	const host = getHost(url);

	// Circuit breaker check
	if (isCircuitOpen(host)) {
		throw new Error(`[${label}] Circuit breaker OPEN — skipping (too many recent failures)`);
	}

	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);

		// If caller provided an external signal, abort when it fires
		if (options.signal) {
			options.signal.addEventListener('abort', () => controller.abort(), { once: true });
		}

		try {
			const res = await fetch(url, {
				signal: controller.signal,
				headers: {
					'Accept': 'application/json',
					...headers
				}
			});
			clearTimeout(timer);

			// Success
			if (res.ok) {
				recordSuccess(host);
				trackApiCall(label); // INFRA-02: per-label sliding window rate limit tracking
				return res;
			}

			// Rate limited — respect Retry-After if present
			if (res.status === 429) {
				const retryAfter = res.headers.get('Retry-After');
				const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : BASE_DELAY_MS * Math.pow(2, attempt);
				if (attempt < maxRetries) {
					console.warn(`[${label}] Rate limited (429), waiting ${waitMs}ms before retry ${attempt + 1}`);
					await sleep(Math.min(waitMs, 10000)); // Cap at 10s
					continue;
				}
			}

			// Server error (5xx) — retry
			if (res.status >= 500 && attempt < maxRetries) {
				console.warn(`[${label}] Server error ${res.status}, retry ${attempt + 1}/${maxRetries}`);
				await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
				continue;
			}

			// Client error (4xx except 429) — don't retry, return as-is
			if (res.status >= 400 && res.status < 500) {
				return res;
			}

			return res;
		} catch (err) {
			clearTimeout(timer);
			lastError = err instanceof Error ? err : new Error(String(err));

			if (lastError.name === 'AbortError') {
				lastError = new Error(`[${label}] Request timed out (${timeout / 1000}s)`);
			}

			if (attempt < maxRetries) {
				const delay = BASE_DELAY_MS * Math.pow(2, attempt);
				console.warn(`[${label}] Fetch error: ${lastError.message}, retry ${attempt + 1} in ${delay}ms`);
				await sleep(delay);
				continue;
			}
		}
	}

	// All retries exhausted
	recordFailure(host);
	throw lastError || new Error(`[${label}] All retries exhausted`);
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────
// Observability — circuit breaker stats
// ─────────────────────────────────────────────────

/**
 * Return current circuit breaker state for every host that has been seen.
 * Used by GET /api/circuit-health for ops monitoring.
 * Returns a snapshot — safe to call from any server context.
 */
export function getCircuitStats(): Record<string, { failures: number; open: boolean; state: string }> {
	const result: Record<string, { failures: number; open: boolean; state: string }> = {};
	for (const [host, s] of circuits.entries()) {
		result[host] = {
			failures: s.failures,
			open: s.state !== 'closed',
			state: s.state,
		};
	}
	return result;
}

// ─────────────────────────────────────────────────
// FIX-010: OpenRouter wrapper with 1-retry + backoff
// ─────────────────────────────────────────────────

/**
 * Wraps OpenRouter API calls with 1 retry (2s → 4s backoff) on 429 or 5xx.
 * Returns null on exhausted retries instead of throwing, so callers can
 * gracefully degrade rather than crash the scoring pipeline.
 *
 * Always uses 1 explicit retry — does NOT depend on NETLIFY_MAX_RETRIES env var.
 */
export async function openrouterFetch(
	url: string,
	init: RequestInit,
	label: string = 'OpenRouter'
): Promise<Response | null> {
	const BACKOFF = [2000, 4000] as const; // 2s first retry, 4s second (if maxRetries > 1)

	for (let attempt = 0; attempt <= 1; attempt++) {
		try {
			const res = await fetch(url, init);

			if (res.ok) return res;

			// Retriable errors: 429 or 5xx
			if ((res.status === 429 || res.status >= 500) && attempt < 1) {
				const retryAfter = res.headers.get('Retry-After');
				const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : BACKOFF[attempt];
				console.warn(`[${label}] HTTP ${res.status} — retrying in ${wait}ms (attempt ${attempt + 1}/1)`);
				await sleep(Math.min(wait, 8000)); // cap at 8s
				continue;
			}

			// Non-retriable error (4xx except 429) — return as-is so caller reads status
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

