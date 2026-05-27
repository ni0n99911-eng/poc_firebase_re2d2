/**
 * ═══════════════════════════════════════════════════════
 * Coffee Recalibration — Dimension 6: Base Viability
 * ═══════════════════════════════════════════════════════
 *
 * Computes the Base Viability score (bvScore) for the coffee scoring
 * engine. Weighted at 10% of the raw composite.
 *
 * This dimension answers: "Can ANY business survive here?" — regardless
 * of concept. It blends two precomputed block-group-level signals:
 *
 *   1. Survival Rate (50%): What percentage of businesses in this
 *      census block group survive their first year? Sourced from
 *      the block_group_scores table (batch-computed from DOB/DCA data).
 *
 *   2. Neighborhood Health (50%): Average business quality in the area
 *      based on Google ratings, review counts, and DOH inspection grades.
 *
 * These are "background" signals — they don't tell you if YOUR concept
 * will work, but they tell you if the neighborhood itself is viable
 * for commercial activity.
 *
 * Data sources:
 *   - block_group_scores.six_survival_rate (precomputed, 0–100)
 *   - block_group_scores.six_neighborhood_health (precomputed, 0–100)
 */

import type { IndexSignal } from '../six-index';

// ── Configuration ─────────────────────────────────────────────────────

/** Weight of survival rate in the base viability blend */
export const SURVIVAL_RATE_WEIGHT = 0.50;

/** Weight of neighborhood health in the base viability blend */
export const NEIGHBORHOOD_HEALTH_WEIGHT = 0.50;

/** Default survival rate when precomputed data is unavailable */
export const DEFAULT_SURVIVAL_RATE = 52;

/** Default neighborhood health when precomputed data is unavailable */
export const DEFAULT_NEIGHBORHOOD_HEALTH = 60;

/** Threshold below which survival rate generates a warning signal */
export const SURVIVAL_WARNING_THRESHOLD = 40;

/** Threshold below which neighborhood health generates a warning signal */
export const NEIGHBORHOOD_HEALTH_WARNING_THRESHOLD = 40;

// ── Result Interface ──────────────────────────────────────────────────

export interface BaseViabilityResult {
	/** The dimension score (0–100) */
	score: number;
	/** Survival rate component (0–100) */
	survivalRate: number;
	/** Neighborhood health component (0–100) */
	neighborhoodHealth: number;
	/** Whether real precomputed data was available for survival rate */
	hasSurvivalData: boolean;
	/** Whether real precomputed data was available for neighborhood health */
	hasNeighborhoodHealthData: boolean;
	/** Any signals generated for this dimension */
	signals: IndexSignal[];
}

// ── Core Computation ──────────────────────────────────────────────────

/**
 * Compute the Base Viability dimension score.
 *
 * Formula:
 *   bvScore = survivalRate × 0.50 + neighborhoodHealth × 0.50
 *
 * @param survivalRate - Business survival rate for the block group (0–100), or null/undefined
 * @param neighborhoodHealth - Neighborhood business health score (0–100), or null/undefined
 * @returns BaseViabilityResult with blended score and component breakdown
 */
export function computeBaseViability(
	survivalRate?: number | null,
	neighborhoodHealth?: number | null,
): BaseViabilityResult {
	// Step 1: Resolve values with defaults
	const hasSurvivalData = survivalRate != null;
	const hasNeighborhoodHealthData = neighborhoodHealth != null;
	const sr = survivalRate ?? DEFAULT_SURVIVAL_RATE;
	const nh = neighborhoodHealth ?? DEFAULT_NEIGHBORHOOD_HEALTH;

	// Step 2: Weighted blend
	const score = Math.round(sr * SURVIVAL_RATE_WEIGHT + nh * NEIGHBORHOOD_HEALTH_WEIGHT);

	// Step 3: Generate warning signals
	const signals: IndexSignal[] = [];

	if (sr < SURVIVAL_WARNING_THRESHOLD) {
		signals.push({
			index: 'survivalRate',
			type: 'negative',
			message: `Low business success rate in area (${sr}%) — many businesses fail here`,
		});
	}

	if (nh < NEIGHBORHOOD_HEALTH_WARNING_THRESHOLD) {
		signals.push({
			index: 'neighborhoodHealth',
			type: 'negative',
			message: `Weak neighborhood business health (${nh}/100) — low ratings and quality`,
		});
	}

	return {
		score,
		survivalRate: sr,
		neighborhoodHealth: nh,
		hasSurvivalData,
		hasNeighborhoodHealthData,
		signals,
	};
}
