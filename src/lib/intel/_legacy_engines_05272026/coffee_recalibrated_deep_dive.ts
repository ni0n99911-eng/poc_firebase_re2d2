/**
 * ═══════════════════════════════════════════════════════
 * Coffee Recalibrated Deep Dive
 * ═══════════════════════════════════════════════════════
 *
 * Replaces the generic primitives-based Deep Dive display with
 * coffee-specific dimension scores for specialty_coffee concepts.
 *
 * Problem:
 *   The Deep Dive tab shows 6 score rows (Foot Traffic, Spending Power,
 *   Room to Compete, etc.) sourced from primitives.ts. But the actual
 *   Location IQ score is computed by the 6 coffee recalibration dims,
 *   which use different math and produce different numbers. This creates
 *   a confusing disconnect: the scores the user SEES in Deep Dive don't
 *   match the score in the ring.
 *
 * Solution:
 *   This module generates the 8-index record using the actual coffee
 *   dimension scores. The Deep Dive tab renders from `sixScores`, which
 *   reads from `indices` in the SixIndexReport. By populating `indices`
 *   with coffee dim scores, the Deep Dive automatically shows the real
 *   numbers that drive Location IQ.
 *
 * Mapping:
 *   Deep Dive Row       | Old (primitives)            | New (coffee dims)
 *   ────────────────────|────────────────────────────|─────────────────────────
 *   Foot Traffic        | computeTransitIndex()       | dim1.morningFootTraffic
 *   Daily Ritual        | computeVibrancyIndex()      | dim2.dailyRitualDensity
 *   Room to Compete     | computeCompetitionIndex()   | dim3.competitionContext
 *   Street-Side         | computeMomentumIndex()      | dim4.streetSide
 *   Spending Power      | computeDemographicsIndex()  | dim5.demographicsFit
 *   Safety              | computeSafetyIndex()        | (unchanged — no coffee dim)
 *   Neighborhood Health | precomputed                 | (unchanged)
 *   Business Success    | precomputed                 | (unchanged)
 *
 * Usage:
 *   In coffee_recalibration_engine.ts:
 *     import { buildCoffeeDeepDiveIndices } from './coffee_recalibrated_deep_dive';
 *     const indices = buildCoffeeDeepDiveIndices({ dim1, dim2, dim3, dim4, dim5, ... });
 */

import type { IndexScore, IndexName } from '../six-index';
import type { LocationIntelReport } from '../types';
import type { MorningFootTrafficResult } from './coffee_recalibration_dim1_morningFootTraffic';
import type { DailyRitualDensityResult } from './coffee_recalibration_dim2_dailyRitualDensity';
import type { CompetitionContextResult } from './coffee_recalibration_dim3_competitionContext';
import type { StreetSideResult } from './coffee_recalibration_dim4_streetSide';
import type { DemographicsFitResult } from './coffee_recalibration_dim5_demographicsFit';
import { sourceCount } from './primitives';

// ── Input Interface ───────────────────────────────────────────────────

export interface CoffeeDeepDiveInput {
	/** Dimension 1 result */
	dim1: MorningFootTrafficResult;
	/** Dimension 2 result */
	dim2: DailyRitualDensityResult;
	/** Dimension 3 result */
	dim3: CompetitionContextResult;
	/** Dimension 4 result */
	dim4: StreetSideResult;
	/** Dimension 5 result */
	dim5: DemographicsFitResult;

	/** Safety score from primitives (no coffee-specific dim) */
	safetyScore: number;
	/** Neighborhood health from precomputed block_group_scores */
	neighborhoodHealth: number;
	/** Survival rate from precomputed + DOHMH overlay */
	survivalRate: number;

	/** The full report for source counting */
	report: LocationIntelReport;

	/** Index weights from concept config */
	weights: Record<string, number>;
}

// ── Deep Dive Label Overrides ─────────────────────────────────────────
// Coffee-specific labels and descriptions that replace the generic ones.
// These make the Deep Dive tab speak the coffee operator's language.

const COFFEE_DEEP_DIVE_META: Record<string, { label: string; description: string }> = {
	transit: {
		label: 'Morning Rush Traffic',
		description: 'Walk-by volume during the 7:30–10:00 AM coffee window',
	},
	vibrancy: {
		label: 'Daily Ritual Density',
		description: 'Concentration of offices, gyms, and commuters that generate repeat daily purchases',
	},
	competition: {
		label: 'Competition Context',
		description: 'Competitor density and market gap at your price point',
	},
	momentum: {
		label: 'Street-Side Quality',
		description: 'Sidewalk visibility, pedestrian approachability, and hostility factors',
	},
	demographics: {
		label: 'Demographics Fit',
		description: 'Area income, education, and spending power calibrated for your ticket price',
	},
	safety: {
		label: 'Safety',
		description: 'Crime levels, quality of life, and building conditions',
	},
	neighborhoodHealth: {
		label: 'Neighborhood Health',
		description: 'Average business quality in the area (ratings, reviews, inspections)',
	},
	survivalRate: {
		label: 'Business Success Rate',
		description: 'Percentage of businesses thriving in this block group',
	},
};

// ── Builder Function ──────────────────────────────────────────────────

/**
 * Build the Deep Dive indices record using coffee recalibration dim scores.
 *
 * This replaces the generic primitives-based indices so the Deep Dive
 * tab shows the actual scores that drive Location IQ for coffee concepts.
 *
 * Key mapping:
 *   - 'transit'             → dim1 (Morning Foot Traffic) — REPLACES primitives.computeTransitIndex
 *   - 'vibrancy'            → dim2 (Daily Ritual Density) — REPLACES primitives.computeVibrancyIndex
 *   - 'competition'         → dim3 (Competition Context)  — REPLACES primitives.computeCompetitionIndex
 *   - 'momentum'            → dim4 (Street-Side Quality)  — REPLACES primitives.computeMomentumIndex
 *   - 'demographics'        → dim5 (Demographics Fit)     — REPLACES primitives.computeDemographicsIndex
 *   - 'safety'              → unchanged (no coffee-specific dim)
 *   - 'neighborhoodHealth'  → unchanged (precomputed)
 *   - 'survivalRate'        → unchanged (precomputed)
 *
 * @param input - Coffee dim results + safety/precomputed scores
 * @returns Record<IndexName, IndexScore> for the SixIndexReport
 */
export function buildCoffeeDeepDiveIndices(input: CoffeeDeepDiveInput): Record<IndexName, IndexScore> {
	const { dim1, dim2, dim3, dim4, dim5, safetyScore, neighborhoodHealth, survivalRate, report, weights } = input;

	function clamp(v: number): number {
		return Math.max(0, Math.min(100, isNaN(v) ? 0 : v));
	}

	const meta = COFFEE_DEEP_DIVE_META;

	return {
		// ── Coffee Dim Scores (replaces primitives) ─────────────
		transit: {
			score: clamp(dim1.score),
			weight: weights.transit,
			label: meta.transit.label,
			description: meta.transit.description,
			dataSources: sourceCount(report, 'transit').available,
			totalSources: sourceCount(report, 'transit').total,
		},

		vibrancy: {
			score: clamp(dim2.score),
			weight: weights.vibrancy,
			label: meta.vibrancy.label,
			description: meta.vibrancy.description,
			dataSources: sourceCount(report, 'vibrancy').available,
			totalSources: sourceCount(report, 'vibrancy').total,
		},

		competition: {
			score: clamp(dim3.score),
			weight: weights.competition,
			label: meta.competition.label,
			description: meta.competition.description,
			dataSources: sourceCount(report, 'competition').available,
			totalSources: sourceCount(report, 'competition').total,
		},

		momentum: {
			score: clamp(dim4.score),
			weight: weights.momentum,
			label: meta.momentum.label,
			description: meta.momentum.description,
			dataSources: sourceCount(report, 'momentum').available,
			totalSources: sourceCount(report, 'momentum').total,
		},

		demographics: {
			score: clamp(dim5.score),
			weight: weights.demographics,
			label: meta.demographics.label,
			description: meta.demographics.description,
			dataSources: sourceCount(report, 'demographics').available,
			totalSources: sourceCount(report, 'demographics').total,
		},

		// ── Unchanged (no coffee-specific dim) ──────────────────
		safety: {
			score: clamp(safetyScore),
			weight: weights.safety,
			label: meta.safety.label,
			description: meta.safety.description,
			dataSources: sourceCount(report, 'safety').available,
			totalSources: sourceCount(report, 'safety').total,
		},

		neighborhoodHealth: {
			score: clamp(neighborhoodHealth),
			weight: weights.neighborhoodHealth,
			label: meta.neighborhoodHealth.label,
			description: meta.neighborhoodHealth.description,
			dataSources: neighborhoodHealth > 0 ? 1 : 0,
			totalSources: 1,
		},

		survivalRate: {
			score: clamp(survivalRate),
			weight: weights.survivalRate,
			label: meta.survivalRate.label,
			description: meta.survivalRate.description,
			dataSources: survivalRate > 0 ? 1 : 0,
			totalSources: 1,
		},
	};
}
