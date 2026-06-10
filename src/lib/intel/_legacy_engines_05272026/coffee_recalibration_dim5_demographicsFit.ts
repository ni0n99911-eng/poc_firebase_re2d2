/**
 * ═══════════════════════════════════════════════════════
 * Coffee Recalibration — Dimension 5: Demographics Fit
 * ═══════════════════════════════════════════════════════
 *
 * SELF-CONTAINED — all scoring logic lives in this file.
 * No dependency on primitives.ts. Tune everything here.
 *
 * Computes the Demographics Fit score (dfScore) for the coffee
 * scoring engine. Weighted at 10% of the raw composite.
 *
 * For standard-priced coffee (<= $7), this computes a base demographics
 * score from census data (income, education, density, age).
 *
 * For premium-priced coffee (> $7), the score is reweighted to
 * emphasize median income — because a $9 protein latte lives or
 * dies on area wealth, not just population density.
 *
 * Data sources (all pre-fetched in the report — no live API calls):
 *   - report.census        → US Census ACS: median household income,
 *                            education (bachelor's+), population density, median age
 *   - report.censusHousing → Census Housing: rent burden, vacancy rate
 *
 * v1.1: Inlined base demographics logic from primitives.computeDemographicsIndex()
 *   to make this module fully self-contained (same pattern as dim1/dim2/dim3).
 *   The primitives.ts version still exists for the 8-index Deep Dive display
 *   but scoring is now decoupled from it.
 *
 * Premium reweighting formula:
 *   dfScore = baseDemographics × 0.65 + premiumIncomeScore × 0.35
 *   where premiumIncomeScore = scoreLinear(medianIncome, $50K, $200K)
 */

import type { LocationIntelReport } from '../types';
import type { IndexSignal } from '../six-index';

// ── Configuration ─────────────────────────────────────────────────────

/** Ticket price threshold above which premium income weighting applies */
export const PREMIUM_TICKET_THRESHOLD = 7.00;

/** Weight given to the base demographics index in premium mode */
export const PREMIUM_BASE_WEIGHT = 0.65;

/** Weight given to the income-specific score in premium mode */
export const PREMIUM_INCOME_WEIGHT = 0.35;

/** Lower bound of the premium income linear scale */
export const PREMIUM_INCOME_FLOOR = 50_000;

/** Upper bound of the premium income linear scale */
export const PREMIUM_INCOME_CEILING = 200_000;

// ── Utility ───────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
	return Math.max(min, Math.min(max, isNaN(v) ? min : v));
}

/**
 * Linear interpolation of a value to a 0–100 score.
 * Equivalent to scoreLinear from geo-math.ts, inlined here for
 * standalone testability.
 *
 * @param value - The input value to score
 * @param low - Value that maps to score 0
 * @param high - Value that maps to score 100
 * @param invert - If true, higher values get lower scores
 * @returns Score 0–100
 */
function scoreLinear(value: number, low: number, high: number, invert: boolean = false): number {
	if (high === low) return 50;
	const normalized = Math.max(0, Math.min(1, (value - low) / (high - low)));
	const score = Math.round(normalized * 100);
	return invert ? 100 - score : score;
}

// ── Base Demographics Index (inlined from primitives.ts) ──────────────
// Computes a 0–100 score from census income, education, density, and age.
// Also applies housing modifiers (rent burden, vacancy).
//
// This is the SCORING version — decoupled from primitives.ts so coffee
// dims can be tuned independently. The primitives.ts version continues
// to feed the Deep Dive tab's standard index display.

/**
 * Compute the base demographics score from census data.
 *
 * Pipeline:
 *   1. Income score: linear scale $30K → $150K
 *   2. Age score: linear scale 20 → 50 (inverted — younger = higher)
 *   3. Population density: linear scale 5K → 70K per sq mi
 *   4. Education: linear scale 10% → 70% bachelor's+
 *   5. Weighted blend: 35% income + 25% density + 25% education + 15% age
 *   6. Housing modifiers: rent burden > 50% → -15%, vacancy > 15% → -10%,
 *      vacancy < 5% → +5%
 *
 * @param report - The full LocationIntelReport
 * @returns Base demographics score (0–100)
 */
function computeBaseDemographicsScore(report: LocationIntelReport): number {
	const r = report as any;
	let score = 50;

	if (r.census) {
		const c = r.census;
		const incomeScore = scoreLinear(c.medianHouseholdIncome || 0, 30000, 150000);
		const ageScore = scoreLinear(c.medianAge || 30, 20, 50, true);
		const popDensity = scoreLinear(c.populationDensity || 0, 5000, 70000);
		const educScore = scoreLinear(c.bachelorsPlusPercent || 0, 10, 70);
		score = Math.round(incomeScore * 0.35 + popDensity * 0.25 + educScore * 0.25 + ageScore * 0.15);
	}

	if (r.censusHousing) {
		const h = r.censusHousing;
		if (h.rentBurdenedPct > 50) {
			score = Math.round(score * 0.85);
		}
		if (h.vacancyRate > 15) {
			score = Math.round(score * 0.90);
		} else if (h.vacancyRate < 5) {
			score = Math.round(score * 1.05);
		}
	}

	return clamp(score);
}

// ── Result Interface ──────────────────────────────────────────────────

export interface DemographicsFitResult {
	/** The dimension score (0–100) */
	score: number;
	/** The base demographics index (before premium adjustment) */
	baseDemographicsScore: number;
	/** Whether premium income weighting was applied */
	isPremiumAdjusted: boolean;
	/** The premium income sub-score (null if not premium) */
	premiumIncomeScore: number | null;
	/** Median household income used (null if no census data) */
	medianIncome: number | null;
	/** Any signals generated for this dimension */
	signals: IndexSignal[];
}

// ── Core Computation ──────────────────────────────────────────────────

/**
 * Compute the Demographics Fit dimension score.
 *
 * Pipeline:
 *   1. Computes base demographics score from census data
 *   2. For standard pricing (≤ $7): returns the base score as-is
 *   3. For premium pricing (> $7): reweights to 65% base + 35% income score
 *   4. The premium income score maps $50K–$200K median income to 0–100
 *
 * @param report - The full LocationIntelReport from the intel pipeline
 * @param avgTicket - User's average ticket price
 * @returns DemographicsFitResult with score and premium adjustment details
 */
export function computeDemographicsFit(
	report: LocationIntelReport,
	avgTicket: number = 5.00
): DemographicsFitResult {
	// Step 1: Compute base demographics score (inlined from primitives)
	const baseDemographicsScore = computeBaseDemographicsScore(report);

	const isPremium = avgTicket > PREMIUM_TICKET_THRESHOLD;
	let score = baseDemographicsScore;
	let premiumIncomeScoreValue: number | null = null;
	const medianIncome = report.census?.medianHouseholdIncome || null;

	// Premium adjustment: emphasize income for high-ticket concepts
	if (isPremium && report.census) {
		const income = report.census.medianHouseholdIncome || 0;
		premiumIncomeScoreValue = scoreLinear(income, PREMIUM_INCOME_FLOOR, PREMIUM_INCOME_CEILING);

		const basePortion = baseDemographicsScore * PREMIUM_BASE_WEIGHT;
		const incomePortion = premiumIncomeScoreValue * PREMIUM_INCOME_WEIGHT;
		score = Math.round(basePortion + incomePortion);
	}

	// Generate signals
	const signals: IndexSignal[] = [];
	if (isPremium && premiumIncomeScoreValue !== null && premiumIncomeScoreValue < 30) {
		signals.push({
			index: 'demographics',
			type: 'negative',
			message: `Low area income ($${Math.round((medianIncome || 0) / 1000)}K median) may not support $${avgTicket.toFixed(2)} avg ticket`,
		});
	}

	return {
		score,
		baseDemographicsScore,
		isPremiumAdjusted: isPremium && report.census != null,
		premiumIncomeScore: premiumIncomeScoreValue,
		medianIncome,
		signals,
	};
}
