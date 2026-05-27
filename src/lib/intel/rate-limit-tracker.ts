/**
 * RE² Per-API Rate Limit Tracker — INFRA-02 (April 12, 2026)
 *
 * Tracks API call counts using an in-process sliding window.
 * Designed to surface quota pressure in the circuit-health endpoint and logs.
 *
 * ── Scope ──────────────────────────────────────────────────────────────────
 * Each Netlify function invocation is a separate process — this tracker only
 * sees calls made within the current request. It does NOT count across requests.
 *
 * For cross-request quota tracking, integrate with Supabase rate_limit_events
 * table (post-launch task). The interface is designed for that upgrade: callers
 * don't need to change when persistence is added.
 *
 * ── Tracked APIs ───────────────────────────────────────────────────────────
 * API Label          │ Daily Limit          │ Cost Basis
 * ───────────────────┼──────────────────────┼───────────────────────────────
 * GooglePlaces       │ Budget warning $5/hr │ $32 per 1,000 calls
 * Foursquare         │ 1,000/day (free tier)│ Free tier (upgrade to paid)
 * Yelp               │ 500/day (hard limit) │ Free — 429 if exceeded
 * ───────────────────┴──────────────────────┴───────────────────────────────
 *
 * Warning thresholds: 80% of daily limit triggers a console.warn.
 */

// ── Config ─────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
	/** Daily call limit (hard or budget-based) */
	dailyLimit: number;
	/** Warn when daily count reaches this fraction of the limit */
	warnFraction: number;
	/** Cost per 1000 calls in USD (0 = no cost, unlimited = budget warn only) */
	costPer1k: number;
	/** Whether exceeding this limit causes API to reject (true = hard limit) */
	isHardLimit: boolean;
}

export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
	GooglePlaces: {
		dailyLimit:   3125, // ~$100/day budget at $32/1K = 3125 calls/day
		warnFraction: 0.80,
		costPer1k:    32,
		isHardLimit:  false,
	},
	Foursquare: {
		dailyLimit:   1000,
		warnFraction: 0.80,
		costPer1k:    0,
		isHardLimit:  false,  // soft — degrades to cached data, not a hard block
	},
	Yelp: {
		dailyLimit:   500,
		warnFraction: 0.80,
		costPer1k:    0,
		isHardLimit:  true,   // 429 returned after 500/day
	},
};

// ── Sliding window state ───────────────────────────────────────────────────

interface WindowEntry {
	/** Timestamp of each call (ms since epoch) */
	timestamps: number[];
	/** Total calls in current process lifetime (not just window) */
	lifetimeCount: number;
}

/**
 * In-memory call log. Key = API label, value = sliding window entries.
 * Scoped to this process invocation only.
 */
const _windows = new Map<string, WindowEntry>();

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24-hour sliding window

function getWindow(label: string): WindowEntry {
	let w = _windows.get(label);
	if (!w) {
		w = { timestamps: [], lifetimeCount: 0 };
		_windows.set(label, w);
	}
	return w;
}

function pruneWindow(w: WindowEntry): void {
	const cutoff = Date.now() - WINDOW_MS;
	// Prune oldest entries (timestamps are append-only, so older = lower index)
	let i = 0;
	while (i < w.timestamps.length && w.timestamps[i] < cutoff) i++;
	if (i > 0) w.timestamps.splice(0, i);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Record an outbound API call.
 * Called by retry.ts after each successful request.
 * No-op for unknown labels (won't throw).
 */
export function trackApiCall(label: string): void {
	const w = getWindow(label);
	pruneWindow(w);
	w.timestamps.push(Date.now());
	w.lifetimeCount++;

	// Warn if near limit
	const config = RATE_LIMIT_CONFIGS[label];
	if (config) {
		const count = w.timestamps.length;
		const warnAt = Math.floor(config.dailyLimit * config.warnFraction);
		if (count === warnAt) {
			const est = config.costPer1k > 0
				? ` (~$${((count / 1000) * config.costPer1k).toFixed(2)} spent today)`
				: '';
			console.warn(
				`[RateLimit] ${label}: ${count}/${config.dailyLimit} calls today${est}. ` +
				`${config.isHardLimit ? 'Hard limit — 429 approaching.' : 'Budget warning.'}`
			);
		}
		if (config.isHardLimit && count >= config.dailyLimit) {
			console.error(
				`[RateLimit] ${label}: LIMIT REACHED (${count}/${config.dailyLimit}). ` +
				`API will return 429. Scoring pipeline will degrade gracefully.`
			);
		}
	}
}

// ── Stats / observability ──────────────────────────────────────────────────

export interface RateLimitStat {
	/** Calls in the current 24-hour sliding window (in-process only) */
	windowCount: number;
	/** Total calls since process started */
	lifetimeCount: number;
	/** Configured daily limit */
	dailyLimit: number;
	/** Fraction of daily limit consumed (window) */
	utilizationPct: number;
	/** True if within warnFraction of daily limit */
	nearLimit: boolean;
	/** True if at or over daily limit */
	atLimit: boolean;
	/** Estimated cost today (USD) for cost-based APIs */
	estimatedCostUsd: number;
	/** 'hard' | 'budget' | 'unknown' */
	limitType: 'hard' | 'budget' | 'unknown';
}

/**
 * Return current rate limit statistics for all tracked APIs.
 * Used by GET /api/circuit-health.
 */
export function getRateLimitStats(): Record<string, RateLimitStat> {
	const result: Record<string, RateLimitStat> = {};

	// Report configured APIs even if they have 0 calls
	for (const label of Object.keys(RATE_LIMIT_CONFIGS)) {
		const w = _windows.get(label);
		const pruned = w ? (pruneWindow(w), w.timestamps.length) : 0;
		const lifetimeCount = w?.lifetimeCount ?? 0;
		const config = RATE_LIMIT_CONFIGS[label];

		const utilizationPct = config.dailyLimit > 0
			? Math.round((pruned / config.dailyLimit) * 100)
			: 0;
		const warnAt = Math.floor(config.dailyLimit * config.warnFraction);

		result[label] = {
			windowCount:      pruned,
			lifetimeCount,
			dailyLimit:       config.dailyLimit,
			utilizationPct,
			nearLimit:        pruned >= warnAt,
			atLimit:          pruned >= config.dailyLimit,
			estimatedCostUsd: config.costPer1k > 0
				? Math.round((pruned / 1000) * config.costPer1k * 100) / 100
				: 0,
			limitType: config.isHardLimit ? 'hard' : (config.costPer1k > 0 ? 'budget' : 'unknown'),
		};
	}

	// Also include any unrecognized labels that accumulated calls
	for (const [label, w] of _windows.entries()) {
		if (!RATE_LIMIT_CONFIGS[label]) {
			pruneWindow(w);
			result[label] = {
				windowCount:      w.timestamps.length,
				lifetimeCount:    w.lifetimeCount,
				dailyLimit:       0,
				utilizationPct:   0,
				nearLimit:        false,
				atLimit:          false,
				estimatedCostUsd: 0,
				limitType:        'unknown',
			};
		}
	}

	return result;
}

/**
 * True if the given API is at or near its daily limit.
 * Used by callers to skip expensive APIs if budget is tight.
 */
export function isNearRateLimit(label: string): boolean {
	const config = RATE_LIMIT_CONFIGS[label];
	if (!config) return false;
	const w = _windows.get(label);
	if (!w) return false;
	pruneWindow(w);
	return w.timestamps.length >= Math.floor(config.dailyLimit * config.warnFraction);
}

/**
 * Reset all counters (for testing only).
 */
export function resetRateLimitCounters(): void {
	_windows.clear();
}
