/**
 * ═══════════════════════════════════════════════════════
 * Coffee Recalibration — Dimension 4: Street-Side
 * ═══════════════════════════════════════════════════════
 *
 * Computes the Street-Side score (ssScore) for the coffee scoring
 * engine. Weighted at 10% of the raw composite.
 *
 * This dimension evaluates the physical street-level quality of the
 * location — visibility, sidewalk width, pedestrian hostility factors,
 * and overall "approachability" for a walk-in coffee customer.
 *
 * Data sources:
 *   - Street-side assessment module (streetSideScore)
 *   - Scaffolding data (hostility penalty)
 *   - Sidewalk width estimates
 *
 * Current implementation:
 *   The coffee engine reads `report.streetSide.streetSideScore` directly.
 *   If no street-side data is available, defaults to 50 (neutral).
 *   This dimension is a candidate for enrichment — adding factors like
 *   corner vs mid-block, street width, signage visibility, etc.
 */

import type { LocationIntelReport } from '../types';
import type { IndexSignal } from '../six-index';

// ── Configuration ─────────────────────────────────────────────────────

/** Default score when no street-side assessment data is available */
export const STREET_SIDE_DEFAULT_SCORE = 50;

/** Threshold below which a warning signal is generated */
export const STREET_SIDE_WARNING_THRESHOLD = 35;

// ── Result Interface ──────────────────────────────────────────────────

export interface StreetSideResult {
	/** The dimension score (0–100) */
	score: number;
	/** Whether real street-side data was available */
	hasData: boolean;
	/** Hostility penalty applied (scaffolding, construction, etc.) */
	hostilityPenalty: number;
	/** Any signals generated for this dimension */
	signals: IndexSignal[];
}

// ── Core Computation ──────────────────────────────────────────────────

/**
 * Compute the Street-Side dimension score.
 *
 * Pipeline:
 *   1. Reads streetSideScore from the report's street-side assessment
 *   2. Falls back to STREET_SIDE_DEFAULT_SCORE (50) if not available
 *   3. Generates a warning signal if score is below threshold
 *
 * @param report - The full LocationIntelReport from the intel pipeline
 * @returns StreetSideResult with score and data availability flag
 */
export function computeStreetSide(report: LocationIntelReport): StreetSideResult {
	// Step 1: Read street-side score (cast needed — streetSide is not on the base type)
	const streetSideData = (report as any).streetSide;
	const hasData = streetSideData?.streetSideScore != null;
	const score = streetSideData?.streetSideScore ?? STREET_SIDE_DEFAULT_SCORE;
	const hostilityPenalty = streetSideData?.hostilityPenalty ?? 0;

	// Step 2: Generate signals for poor street-side conditions
	const signals: IndexSignal[] = [];
	if (hasData && score < STREET_SIDE_WARNING_THRESHOLD) {
		signals.push({
			index: 'vibrancy',
			type: 'negative',
			message: `Poor street-side conditions (score ${score}/100)${hostilityPenalty > 0 ? ` — ${hostilityPenalty}pt hostility penalty (scaffolding/construction)` : ''}`,
		});
	}

	return { score, hasData, hostilityPenalty, signals };
}
