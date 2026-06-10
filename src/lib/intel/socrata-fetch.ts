/**
 * Resilient Socrata API fetch wrapper.
 *
 * Used by all NYC Open Data and NY State data modules.
 * Adds retry logic + circuit breaker on top of resilientFetch.
 *
 * Usage:
 *   import { socrataFetch } from './socrata-fetch';
 *   const data = await socrataFetch(url, 'Crime');
 */

import { resilientFetch } from './retry';

/**
 * Fetch JSON from a Socrata endpoint with retry and timeout.
 * Returns the parsed JSON array, or null on failure.
 */
export async function socrataFetch<T = unknown[]>(
	url: string,
	label: string,
	options?: { timeout?: number }
): Promise<T | null> {
	try {
		const res = await resilientFetch(url, { timeout: options?.timeout ?? 12000,
			maxRetries: 2,
			headers: { 'Accept': 'application/json' },
			label, signal });

		if (!res.ok) {
			console.error(`[${label}] Socrata API error: ${res.status}`);
			return null;
		}

		return await res.json() as T;
	} catch (err) {
		console.error(`[${label}] Fetch failed:`, err instanceof Error ? err.message : err);
		return null;
	}
}
