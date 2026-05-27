/**
 * Coffee Score Client-Side Cache — Addendum Change F
 *
 * localStorage layer for instant coffee score display on return visits.
 * Key: re2_coffee_score:{lat_4dp}:{lng_4dp}:{concept}:{formulaVersion}
 *
 * On page load, UX checks this cache BEFORE hitting the API.
 * On fresh score, UX writes the full result here for next visit.
 *
 * This is Layer 2 (client). Layer 1 is Supabase (server, Changes A/B).
 * Both layers store the same StoredCoffeeScore shape.
 */

import { COFFEE_FORMULA_VERSION, COFFEE_SCORE_MAX_AGE_DAYS } from '$lib/constants/scoring-thresholds';

// ── Types (mirrors server-side StoredCoffeeScore) ──────────────────────

export interface CachedCoffeeScore {
	compositeScore: number;
	dimensionScores: {
		footTraffic: number;
		ritualDensity: number;
		competition: number;
		streetSide: number;
		demographics: number;
		viability: number;
	};
	watchOuts: Array<{ id: string; title: string; explanation: string; severity: string; dataSource?: string }>;
	visionMultiplier: number;
	formulaVersion: string;
	scoredAt: string;
	inputSnapshot: {
		avgTicket: number;
		visionTier: string;
		concept: string;
	};
	confidenceLevel: string;
	grade: string;
	verdict: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

const LS_PREFIX = 're2_coffee_score';

function round4(n: number): number {
	return Math.round(n * 10000) / 10000;
}

function cacheKey(lat: number, lng: number, concept: string): string {
	return `${LS_PREFIX}:${round4(lat)}:${round4(lng)}:${concept}:${COFFEE_FORMULA_VERSION}`;
}

function isBrowser(): boolean {
	return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Retrieve a cached coffee score from localStorage.
 * Returns null if not found, expired (>30 days), or formula version mismatch.
 */
export function getCachedCoffeeScore(
	lat: number,
	lng: number,
	concept: string,
	currentInputs: { avgTicket: number; visionTier: string; concept: string }
): CachedCoffeeScore | null {
	if (!isBrowser()) return null;

	try {
		const key = cacheKey(lat, lng, concept);
		const raw = localStorage.getItem(key);
		if (!raw) return null;

		const cached: CachedCoffeeScore = JSON.parse(raw);

		// Formula version mismatch → stale
		if (cached.formulaVersion !== COFFEE_FORMULA_VERSION) {
			localStorage.removeItem(key);
			return null;
		}

		// Age check
		const ageDays = (Date.now() - new Date(cached.scoredAt).getTime()) / (1000 * 60 * 60 * 24);
		if (ageDays > COFFEE_SCORE_MAX_AGE_DAYS) {
			localStorage.removeItem(key);
			return null;
		}

		// Input snapshot check
		const snap = cached.inputSnapshot;
		if (snap.avgTicket !== currentInputs.avgTicket) return null;
		if (snap.visionTier !== currentInputs.visionTier) return null;
		if (snap.concept !== currentInputs.concept) return null;

		return cached;
	} catch {
		return null;
	}
}

/**
 * Store a coffee score to localStorage after fresh computation.
 * Call this when the API returns a fresh (non-stored) coffee score.
 */
export function cacheCoffeeScore(
	lat: number,
	lng: number,
	concept: string,
	score: CachedCoffeeScore
): void {
	if (!isBrowser()) return;

	try {
		const key = cacheKey(lat, lng, concept);
		localStorage.setItem(key, JSON.stringify(score));
	} catch {
		// localStorage full or disabled — non-fatal
	}
}

/**
 * Clear a cached coffee score for a specific location.
 * Called when user clicks "Refresh Score" or changes onboarding answers.
 */
export function clearCachedCoffeeScore(
	lat: number,
	lng: number,
	concept: string
): void {
	if (!isBrowser()) return;

	try {
		const key = cacheKey(lat, lng, concept);
		localStorage.removeItem(key);
	} catch {
		// Non-fatal
	}
}

/**
 * Clear ALL cached coffee scores. Called on formula version bump
 * or when user wants a completely fresh start.
 */
export function clearAllCachedCoffeeScores(): void {
	if (!isBrowser()) return;

	try {
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(LS_PREFIX)) keys.push(key);
		}
		for (const key of keys) {
			localStorage.removeItem(key);
		}
	} catch {
		// Non-fatal
	}
}

/**
 * Build a CachedCoffeeScore from a fresh API response.
 * UX calls this after receiving a location-iq response with coffeeDimensions.
 */
export function buildCacheFromApiResponse(apiResponse: {
	locationIQ?: number;
	grade?: string;
	verdict?: string;
	coffeeDimensions?: {
		morningFootTraffic: number;
		dailyRitualDensity: number;
		competitionContext: number;
		streetSide: number;
		demographicsFit: number;
		baseViability: number;
		visionMultiplier: number;
	};
	coffeeWatchOuts?: Array<{ id: string; title: string; explanation: string; severity: string; dataSource?: string }>;
	formulaVersion?: string;
	scoredAt?: string;
	confidenceLevel?: string;
	scoreConfidence?: string;
}, avgTicket: number, visionTier: string, concept: string): CachedCoffeeScore | null {
	const dims = apiResponse.coffeeDimensions;
	if (!dims || apiResponse.locationIQ == null) return null;

	return {
		compositeScore: apiResponse.locationIQ,
		dimensionScores: {
			footTraffic: dims.morningFootTraffic,
			ritualDensity: dims.dailyRitualDensity,
			competition: dims.competitionContext,
			streetSide: dims.streetSide,
			demographics: dims.demographicsFit,
			viability: dims.baseViability,
		},
		watchOuts: apiResponse.coffeeWatchOuts ?? [],
		visionMultiplier: dims.visionMultiplier,
		formulaVersion: apiResponse.formulaVersion ?? COFFEE_FORMULA_VERSION,
		scoredAt: apiResponse.scoredAt ?? new Date().toISOString(),
		inputSnapshot: { avgTicket, visionTier, concept },
		confidenceLevel: apiResponse.scoreConfidence ?? apiResponse.confidenceLevel ?? 'PRELIMINARY',
		grade: apiResponse.grade ?? '',
		verdict: apiResponse.verdict ?? '',
	};
}
