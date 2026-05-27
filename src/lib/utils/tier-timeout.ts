/**
 * F-09: Tier-aware timeout ceiling
 *
 * Three dimensions of "tier":
 *   1. Netlify deployment tier (free 10s vs Pro 26s) — sets the hard ceiling
 *   2. Data freshness tier (cold/warm/hot) — scales the base timeout within the ceiling
 *   3. Location quality tier (prime/strong/promising/developing/unknown) —
 *      Strong/Prime locations get longer timeouts because users have more
 *      investment in the result. Lower-tier locations can fail fast.
 *
 * Cold locations (no cached data) need more time for 20 API calls.
 * Hot locations (fully cached) only need Supabase reads — much less time.
 */

export type DataTier = 'cold' | 'warm' | 'hot';
export type LocationQualityTier = 'prime' | 'strong' | 'promising' | 'developing' | 'unknown';

/** Multipliers by data freshness — cold needs full API calls, hot is cache-only */
const DATA_TIER_MULTIPLIER: Record<DataTier, number> = {
	cold: 1.0,    // Full timeout — all APIs must be called
	warm: 0.65,   // Partial cache — some APIs need refresh
	hot:  0.35,   // Fully cached — only Supabase reads
};

/**
 * Location quality multipliers — users invest more in Strong/Prime locations,
 * so we allow more time for their data to resolve.
 * Developing/unknown locations fail fast to free up resources.
 */
const LOCATION_QUALITY_MULTIPLIER: Record<LocationQualityTier, number> = {
	prime:      1.25,   // Top-tier — user is deep in analysis, maximize data quality
	strong:     1.15,   // High-value — extra patience for complete results
	promising:  1.0,    // Baseline — standard timeout
	developing: 0.85,   // Low-tier — fail faster, data less critical
	unknown:    1.0,    // No prior score — treat as baseline
};

/** Netlify platform ceiling (ms) with safety buffer */
const NETLIFY_CEILING = {
	free: 9500,   // 10s limit - 500ms buffer
	pro:  25000,  // 26s limit - 1s buffer
} as const;

/**
 * Derive location quality tier from a precomputed IQ score.
 * Matches the decision-engine tier thresholds (fitTierLabel / blockTierLabel).
 */
export function getLocationQualityTier(score: number | null | undefined): LocationQualityTier {
	if (score == null) return 'unknown';
	if (score >= 80) return 'prime';
	if (score >= 65) return 'strong';
	if (score >= 50) return 'promising';
	return 'developing';
}

/**
 * Get timeout ceiling based on Netlify tier alone (backward-compatible).
 */
export function getTierTimeout(base: number = 8000): number {
	const tier = typeof process !== 'undefined' ? process.env?.NETLIFY_TIER : undefined;
	const ceiling = tier === 'pro' ? NETLIFY_CEILING.pro : NETLIFY_CEILING.free;

	if (tier === 'pro') {
		return Math.min(base * 2.5, ceiling);
	}
	return Math.min(base, ceiling);
}

/**
 * Get timeout scaled by deployment tier, data freshness, AND location quality.
 *
 * @param base              Base timeout in ms (default 8000)
 * @param dataTier          How fresh the cached data is: 'cold' | 'warm' | 'hot'
 * @param locationQuality   How valuable this location is: 'prime' | 'strong' | ... | 'unknown'
 * @returns Timeout in ms, never exceeding Netlify ceiling
 *
 * @example
 *   getAdaptiveTimeout(8000, 'cold', 'prime')      // Free: 9500ms (capped), Pro: 25000ms
 *   getAdaptiveTimeout(8000, 'cold', 'developing')  // Free: 6800ms, Pro: 17000ms
 *   getAdaptiveTimeout(8000, 'hot', 'unknown')      // Free: 2800ms, Pro: 7000ms
 */
export function getAdaptiveTimeout(
	base: number = 8000,
	dataTier: DataTier = 'cold',
	locationQuality: LocationQualityTier = 'unknown',
): number {
	const tier = typeof process !== 'undefined' ? process.env?.NETLIFY_TIER : undefined;
	const ceiling = tier === 'pro' ? NETLIFY_CEILING.pro : NETLIFY_CEILING.free;
	const scaledBase = tier === 'pro' ? base * 2.5 : base;
	const adjusted = scaledBase
		* DATA_TIER_MULTIPLIER[dataTier]
		* LOCATION_QUALITY_MULTIPLIER[locationQuality];

	// Never go below 2s (even hot paths need some time for Supabase reads)
	return Math.max(2000, Math.min(adjusted, ceiling));
}

/**
 * Classify data freshness from cache state.
 * Used by location-iq and intel pipeline to pick the right timeout.
 */
export function classifyDataTier(
	hasCachedIntel: boolean,
	cachedAgeMs: number | null,
	staleThresholdMs: number = 6 * 3600 * 1000, // 6h default
): DataTier {
	if (!hasCachedIntel || cachedAgeMs === null) return 'cold';
	if (cachedAgeMs > staleThresholdMs) return 'warm';
	return 'hot';
}

/**
 * Create an AbortController that auto-aborts after the given timeout.
 * Returns both the controller (pass signal to fetch) and a cleanup function.
 */
export function createTimeoutController(timeoutMs: number): {
	controller: AbortController;
	cleanup: () => void;
} {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	return {
		controller,
		cleanup: () => clearTimeout(timer),
	};
}
