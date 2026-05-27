/**
 * Coffee Score Persistence — Addendum to Coffee Scoring Rewire Spec
 *
 * Stores and retrieves coffee scores so users see the SAME score on every visit.
 * Key: (session_id, lat_4dp, lng_4dp, concept, formula_version)
 *
 * Layer 1 — Supabase `score_events` table (extended with coffee_score JSONB column)
 * Layer 2 — localStorage (client-side, handled in Change F)
 *
 * Score is stored on first computation. On subsequent visits:
 *   1. Check for stored score matching key + formulaVersion + inputSnapshot
 *   2. If found AND age < 30 days → serve stored score (skip all API calls)
 *   3. If not found → compute fresh, store, serve
 *
 * Re-score triggers: user changes answers, clicks Refresh, formula version
 * changes, or score age > 30 days.
 */

import { getServiceSupabase } from '$lib/supabase-server';
import { COFFEE_FORMULA_VERSION, COFFEE_SCORE_MAX_AGE_DAYS } from '$lib/constants/scoring-thresholds';
import type { CoffeeDimensions, VisionTier } from './six-index';

// ── Types ──────────────────────────────────────────────────────────────

/** The complete stored score object — everything needed to render without recomputing */
export interface StoredCoffeeScore {
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
	scoredAt: string;             // ISO timestamp
	inputSnapshot: {
		avgTicket: number;
		visionTier: VisionTier | 'standard';
		concept: string;
	};
	confidenceLevel: string;      // HIGH / GOOD / MODERATE / PRELIMINARY
	grade: string;                // A+ / A / B+ / etc.
	verdict: string;              // Marginal / Viable / Strong / etc.
}

/** Key used to look up a stored score */
export interface CoffeeScoreKey {
	sessionId?: string;
	userId?: string;
	lat: number;
	lng: number;
	concept: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Round to 4 decimal places (~11m precision) — spec requirement */
function round4(n: number): number {
	return Math.round(n * 10000) / 10000;
}

/** Check if a stored score is still valid (not stale, formula matches, inputs match) */
function isScoreValid(
	stored: StoredCoffeeScore,
	currentInputs: { avgTicket: number; visionTier: VisionTier | 'standard'; concept: string }
): boolean {
	// Formula version mismatch → must re-score
	if (stored.formulaVersion !== COFFEE_FORMULA_VERSION) return false;

	// Age check → > 30 days is stale
	const ageMs = Date.now() - new Date(stored.scoredAt).getTime();
	const ageDays = ageMs / (1000 * 60 * 60 * 24);
	if (ageDays > COFFEE_SCORE_MAX_AGE_DAYS) return false;

	// Input snapshot mismatch → user changed answers
	const snap = stored.inputSnapshot;
	if (snap.avgTicket !== currentInputs.avgTicket) return false;
	if (snap.visionTier !== currentInputs.visionTier) return false;
	if (snap.concept !== currentInputs.concept) return false;

	return true;
}

// ── Retrieve ────────────────────────────────────────────────────────────

/**
 * Look up a previously stored coffee score from Supabase.
 * Returns the stored score if found AND valid, null otherwise.
 */
export async function getStoredCoffeeScore(
	key: CoffeeScoreKey,
	currentInputs: { avgTicket: number; visionTier: VisionTier | 'standard'; concept: string }
): Promise<StoredCoffeeScore | null> {
	try {
		const supabase = getServiceSupabase();
		const lat4 = round4(key.lat);
		const lng4 = round4(key.lng);

		// Query score_events for coffee_score JSONB matching our key
		// Use lat/lng rounded to 4dp as the spatial key
		const { data, error } = await supabase
			.from('score_events')
			.select('coffee_score')
			.eq('concept', key.concept)
			.gte('lat', lat4 - 0.0001)
			.lte('lat', lat4 + 0.0001)
			.gte('lng', lng4 - 0.0001)
			.lte('lng', lng4 + 0.0001)
			.not('coffee_score', 'is', null)
			.order('computed_at', { ascending: false })
			.limit(1);

		if (error || !data?.length) return null;

		const stored = data[0].coffee_score as StoredCoffeeScore;
		if (!stored || !stored.formulaVersion) return null;

		return isScoreValid(stored, currentInputs) ? stored : null;
	} catch {
		// Score retrieval failures are non-fatal — just recompute
		return null;
	}
}

// ── Store ───────────────────────────────────────────────────────────────

/**
 * Build a StoredCoffeeScore from fresh computation results.
 */
export function buildStoredScore(
	compositeScore: number,
	dimensions: CoffeeDimensions,
	watchOuts: Array<{ id: string; title: string; explanation: string; severity: string; dataSource?: string }>,
	confidenceLevel: string,
	grade: string,
	verdict: string,
	avgTicket: number,
	visionTier: VisionTier | 'standard',
	concept: string
): StoredCoffeeScore {
	return {
		compositeScore,
		dimensionScores: {
			footTraffic: dimensions.morningFootTraffic,
			ritualDensity: dimensions.dailyRitualDensity,
			competition: dimensions.competitionContext,
			streetSide: dimensions.streetSide,
			demographics: dimensions.demographicsFit,
			viability: dimensions.baseViability,
		},
		watchOuts,
		visionMultiplier: dimensions.visionMultiplier,
		formulaVersion: COFFEE_FORMULA_VERSION,
		scoredAt: new Date().toISOString(),
		inputSnapshot: { avgTicket, visionTier, concept },
		confidenceLevel,
		grade,
		verdict,
	};
}

/**
 * Persist a coffee score to Supabase score_events.coffee_score (fire-and-forget).
 * This extends the existing score_events row — it does NOT create a separate table.
 * The score_events insert happens in logScoreEvent(); this function updates the
 * most recent row for the same (lat, lng, concept) with the coffee_score JSONB.
 *
 * In practice, we call this RIGHT AFTER logScoreEvent(), so the row exists.
 */
export async function storeCoffeeScore(
	key: CoffeeScoreKey,
	score: StoredCoffeeScore
): Promise<void> {
	try {
		const supabase = getServiceSupabase();
		const lat4 = round4(key.lat);
		const lng4 = round4(key.lng);

		// Update the most recent score_events row for this (lat, lng, concept)
		// with the coffee_score JSONB blob
		const { error } = await supabase
			.from('score_events')
			.update({ coffee_score: score })
			.eq('concept', key.concept)
			.gte('lat', lat4 - 0.0001)
			.lte('lat', lat4 + 0.0001)
			.gte('lng', lng4 - 0.0001)
			.lte('lng', lng4 + 0.0001)
			.order('computed_at', { ascending: false })
			.limit(1);

		if (error) {
			console.warn('[CoffeeScoreStore] Failed to persist score:', error.message);
		}
	} catch (e) {
		// Fire-and-forget — never block the response
		console.warn('[CoffeeScoreStore] Store error:', e);
	}
}
