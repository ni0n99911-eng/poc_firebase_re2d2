/**
 * GET /api/circuit-health
 *
 * Ops monitoring endpoint — returns the current state of all circuit breakers
 * in the RE² scoring pipeline. Two breaker registries are exposed:
 *
 *   retryCircuits   — low-level per-host breakers (retry.ts, tracks raw TCP/HTTP failures)
 *   sourceBreakers  — per-API-source breakers (resilient-fetch.ts, wraps all 20 intel sources)
 *
 * Response shape:
 * {
 *   timestamp: string,          // ISO 8601
 *   retryCircuits: {
 *     [host: string]: {
 *       failures: number,
 *       open: boolean,
 *       state: 'closed' | 'open' | 'half_open'
 *     }
 *   },
 *   sourceBreakers: {
 *     [source: string]: {
 *       state: 'CLOSED' | 'OPEN' | 'HALF_OPEN',
 *       config: { failureThreshold: number, resetTimeout: number }
 *     }
 *   },
 *   summary: {
 *     totalRetryCircuits: number,
 *     openRetryCircuits: number,
 *     totalSourceBreakers: number,
 *     openSourceBreakers: number
 *   }
 * }
 *
 * Auth: Clerk JWT required (same as all internal API routes).
 * Failures are silent — if this endpoint errors it does not affect scoring.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/auth-middleware';
import { getCircuitStats } from '$lib/intel/retry';
import { getBreakerStates } from '$lib/intel/resilient-fetch';
import { getRateLimitStats } from '$lib/intel/rate-limit-tracker';

export const GET: RequestHandler = async ({ request }) => {
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;

	try {
		const retryCircuits = getCircuitStats();
		const sourceBreakers = getBreakerStates();
		const rateLimits = getRateLimitStats();

		const openRetryCircuits = Object.values(retryCircuits).filter(c => c.open).length;
		const openSourceBreakers = Object.values(sourceBreakers).filter(b => b.state !== 'CLOSED').length;
		const nearLimitApis = Object.entries(rateLimits)
			.filter(([, s]) => s.nearLimit)
			.map(([label]) => label);

		return json({
			timestamp: new Date().toISOString(),
			retryCircuits,
			sourceBreakers,
			rateLimits,
			summary: {
				totalRetryCircuits: Object.keys(retryCircuits).length,
				openRetryCircuits,
				totalSourceBreakers: Object.keys(sourceBreakers).length,
				openSourceBreakers,
				nearLimitApis,
				estimatedGoogleCostUsd: rateLimits['GooglePlaces']?.estimatedCostUsd ?? 0,
			},
		});
	} catch (err) {
		// Never let monitoring break anything
		console.error('[circuit-health] Error reading circuit state:', err);
		return json(
			{ error: 'Failed to read circuit state', timestamp: new Date().toISOString() },
			{ status: 500 }
		);
	}
};
