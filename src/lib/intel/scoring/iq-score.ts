/**
 * RE² IQ Score — Canonical Scoring Entry Point
 * ─────────────────────────────────────────────────────────────────────────────
 * 04.19.2026 13:35 Score Consolidation — Phase 3
 *
 * SINGLE ENTRY POINT for all Location IQ scoring.
 *
 * Previously, computeSixIndex() was called raw with positional arguments
 * from 3 different places, each doing its own concept normalization:
 *   routes/api/location-iq/+server.ts:625     → migrated 04.19.2026
 *   routes/api/re-score/+server.ts:175        → migrated 04.19.2026
 *   lib/location/components/AddressAnalyzer.svelte:1336 → migrated 04.19.2026
 *
 * All callers now use: runIQScore({ report, businessType, ... })
 *
 * This is a thin typed adapter today. Phase 4 additions (vital rule enforcement,
 * kill floor checks, Fit IQ hooks) will be inserted here without touching callers.
 *
 * computeSixIndex() is NOT deprecated — it remains the internal implementation.
 * Tests may still call computeSixIndex() directly.
 */

import type { LocationIntelReport } from '$lib/intel/types';
import type { PrecomputedScores, VisionTier, SixIndexReport } from '$lib/intel/six-index';
import { computeSixIndex } from '$lib/intel/six-index';
import { normalizeBusinessType } from '$lib/intel/registry/business-type-registry';

// ─────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────

export interface IQScoreInput {
	/** Raw location intel from fetchEnhancedLocationIntel() */
	report: LocationIntelReport;

	/**
	 * Business type string — may be raw (e.g. "Specialty Coffee Shop") or
	 * already normalized (e.g. "specialty_coffee"). runIQScore normalizes
	 * it via the canonical registry before scoring.
	 */
	businessType: string;

	/**
	 * Pre-computed block-group scores from block_group_scores table.
	 * neighborhoodHealth and survivalRate — defaults to neutral (60/55) if absent.
	 */
	precomputed?: PrecomputedScores;

	/**
	 * Vision tier from the user's Vision IQ questionnaire.
	 * Applies a post-composite multiplier (0.60 commodity → 1.12 highly differentiated).
	 */
	visionTier?: VisionTier;

	/**
	 * Average ticket price in dollars. Used by concept-specific engines
	 * (e.g. coffee) to calibrate unit economics sensitivity.
	 */
	avgTicket?: number;

	/**
	 * Power Broker historical context impact types (e.g., 'commercial_district_maturation').
	 * Adjusts weighting of primitive indices dynamically.
	 */
	historicalImpactTypes?: string[];
}

/**
 * IQScoreOutput — stable contract for all scoring consumers.
 * Shape is identical to SixIndexReport; aliased here for explicit import.
 */
export type IQScoreOutput = SixIndexReport;

// ─────────────────────────────────────────────────
// Canonical entry point
// ─────────────────────────────────────────────────

/**
 * runIQScore — canonical RE² Location IQ scoring entry point.
 *
 * 04.19.2026 13:35 Score Consolidation — replaces all direct computeSixIndex() calls.
 *
 * Usage:
 *   import { runIQScore } from '$lib/intel/scoring/iq-score';
 *   const result = runIQScore({ report, businessType, precomputed, visionTier });
 *
 * @param input  Typed scoring input — use named args, never raw positional
 * @returns      IQScoreOutput (= SixIndexReport) with locationIQ, grade, indices, signals
 */
export function runIQScore(input: IQScoreInput): IQScoreOutput {
	// 04.19.2026 13:35 Score Consolidation — normalize via canonical registry
	// This means callers don't each need to normalizeBusinessType() themselves.
	const normalizedType = normalizeBusinessType(input.businessType);

	return computeSixIndex(
		input.report,
		normalizedType,
		input.precomputed,
		input.visionTier,
		input.avgTicket,
		input.historicalImpactTypes
	);
}
