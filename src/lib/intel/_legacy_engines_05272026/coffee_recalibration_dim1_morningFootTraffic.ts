/**
 * ═══════════════════════════════════════════════════════
 * Coffee Recalibration — Dimension 1: Morning Foot Traffic
 * ═══════════════════════════════════════════════════════
 *
 * SELF-CONTAINED — all scoring logic lives in this file.
 * No dependency on segment-intel.ts. Tune everything here.
 *
 * Computes the Morning Foot Traffic score (ftScore) for the coffee
 * scoring engine. This is the highest-weighted dimension at 40% of
 * the raw composite.
 *
 * The score estimates how many potential coffee customers walk past
 * a location during the 7:30–10:00 AM morning rush window —
 * the make-or-break hours for any specialty coffee shop.
 *
 * Data sources (all pre-fetched in the report — no live API calls):
 *   - report.mtaRidership  → MTA ridership (subway station exits → walk-by conversion)
 *   - report.pedestrian    → NYC DOT pedestrian counts (direct sidewalk measurements)
 *   - report.census        → US Census population density (fallback when transit data missing)
 *
 * Extraction rationale:
 *   This file isolates the Morning Foot Traffic dimension from
 *   coffee-engine.ts for independent recalibration. The thresholds
 *   and conversion factors can be tuned here without touching the
 *   rest of the scoring pipeline.
 *
 *   v1.1: Inlined rush traffic extrapolation from segment-intel.ts
 *   to make this module fully self-contained (same pattern as dim2/dim3).
 *   The segment-intel.ts version still exists for the Segment Insights
 *   UI panel (hero metrics) but scoring is now decoupled from it.
 */

import type { LocationIntelReport } from '../types';
import type { IndexSignal } from '../six-index';

// ── Rush Traffic Conversion Constants ─────────────────────────────────
// These control how raw MTA/pedestrian data becomes a morning passerby
// estimate. Tuned independently from segment-intel.ts.
//
// MTA pipeline:
//   dailyRiders × 0.32 (morning peak 7-10am share)
//                × 0.83 (coffee window 7:30-10:00 as fraction of 7-10)
//                × 0.20 (walk-by capture rate within 300m radius)
//
// Pedestrian blend:
//   When both MTA + ped data exist: 60% MTA + 40% pedestrian
//   When only ped data: 100% pedestrian
//
// Census fallback:
//   populationDensity × daytimePopulationRatio × 0.02

/** Share of daily MTA ridership during morning peak (7–10am) */
export const MTA_MORNING_PEAK_SHARE = 0.32;

/** Coffee window (7:30–10:00) as fraction of 7–10am peak */
export const COFFEE_WINDOW_FRACTION = 0.83;

/** Walk-by capture rate: fraction of station exits that pass within 300m */
export const WALKBY_CAPTURE_RATE = 0.20;

/** Weight of MTA-derived estimate when blending with pedestrian data */
export const MTA_BLEND_WEIGHT = 0.60;

/** Weight of pedestrian-derived estimate when blending with MTA data */
export const PED_BLEND_WEIGHT = 0.40;

/** Fallback multiplier: census population density × daytime ratio → morning passersby */
export const CENSUS_FALLBACK_MULTIPLIER = 0.02;

/** Maximum clamped morning passerby value */
export const MORNING_RAW_CAP = 50_000;

// ── Score Thresholds ──────────────────────────────────────────────────
// Maps morning passerby volume to a 0–100 dimension score.
//
// Calibration notes (v1.0):
//   - 10K+ passersby → score 95: top-tier transit hubs (Times Sq, Penn Station)
//   - 5K–10K         → score 88: major commercial corridors
//   - 3K–5K          → score 72: strong neighborhood blocks
//   - 1.5K–3K        → score 52: moderate — needs destination appeal
//   - 500–1.5K       → score 30: weak foot traffic for impulse coffee
//   - <500           → score 12: very low — likely not viable for walk-in coffee

export interface MorningFootTrafficThreshold {
	/** Minimum morning passersby (inclusive) */
	minPassersby: number;
	/** Score assigned when passersby >= minPassersby */
	score: number;
	/** Human-readable label for this tier */
	label: string;
}

/**
 * Ordered descending by minPassersby. The first threshold whose
 * minPassersby <= morningRaw is used.
 */
export const MORNING_FOOT_TRAFFIC_THRESHOLDS: MorningFootTrafficThreshold[] = [
	{ minPassersby: 10000, score: 95, label: 'Exceptional — major transit hub' },
	{ minPassersby: 5000,  score: 88, label: 'Excellent — high-volume commercial corridor' },
	{ minPassersby: 3000,  score: 72, label: 'Strong — reliable morning foot traffic' },
	{ minPassersby: 1500,  score: 52, label: 'Moderate — needs destination appeal' },
	{ minPassersby: 500,   score: 30, label: 'Weak — low walk-in potential' },
];

/** Score assigned when morningRaw falls below all thresholds */
export const MORNING_FOOT_TRAFFIC_FLOOR_SCORE = 12;

// ── Result Interface ──────────────────────────────────────────────────

export interface MorningFootTrafficResult {
	/** The dimension score (0–100) */
	score: number;
	/** Raw estimated morning passersby (7:30–10:00 AM) */
	morningRaw: number;
	/** Human-readable tier label */
	tierLabel: string;
	/** Any signals generated for this dimension */
	signals: IndexSignal[];
}

// ── Rush Traffic Extrapolation (inlined from segment-intel.ts) ────────

/**
 * Extrapolate morning rush passersby from MTA ridership + pedestrian
 * counts + census fallback.
 *
 * This is a scoring-only version of segment-intel.ts's
 * extrapolateCoffeeRushTraffic(). It returns just the raw morning
 * passerby count — no HeroMetric formatting, no afternoon estimate,
 * no chain metadata. Those UI concerns stay in segment-intel.ts.
 *
 * Pipeline:
 *   1. MTA ridership → morning peak → coffee window → walk-by capture
 *   2. Blend with pedestrian counts (60/40 MTA/ped when both available)
 *   3. Census density fallback when neither MTA nor ped data exists
 *   4. Clamp to [0, 50K]
 *
 * @param report - The full LocationIntelReport from the intel pipeline
 * @returns Raw morning passerby estimate (clamped integer)
 */
function extrapolateMorningPassersby(report: LocationIntelReport): number {
	const mta = (report as any).mtaRidership;
	const ped = (report as any).pedestrian;
	const census = (report as any).census;

	let morningRaw = 0;

	// ── Source 1: MTA ridership ──────────────────────────────────────
	if (mta && mta.totalDailyRidership > 0) {
		const dailyRiders = mta.totalDailyRidership;

		// Morning peak (7–10am) ≈ 32% of daily
		// Coffee window (7:30–10:00) ≈ 83% of that
		// Walk-by capture within 300m ≈ 20%
		const morningPeakRiders = dailyRiders * MTA_MORNING_PEAK_SHARE * COFFEE_WINDOW_FRACTION;
		morningRaw = morningPeakRiders * WALKBY_CAPTURE_RATE;
	}

	// ── Source 2: Blend with pedestrian counts ──────────────────────
	if (ped && ped.totalPedestrians > 0) {
		const pedMorning = ped.avgAMCount || ped.totalPedestrians * 0.45;

		if (morningRaw > 0) {
			// Both MTA + ped available: weighted blend
			morningRaw = morningRaw * MTA_BLEND_WEIGHT + pedMorning * PED_BLEND_WEIGHT;
		} else {
			// Only pedestrian data available
			morningRaw = pedMorning;
		}
	}

	// ── Source 3: Census fallback ────────────────────────────────────
	if (morningRaw === 0 && census) {
		const density = census.populationDensity || 0;
		const daytimeRatio = census.daytimePopulationRatio || 1.0;
		// Dense areas with high daytime ratio = lots of office workers
		morningRaw = density * daytimeRatio * CENSUS_FALLBACK_MULTIPLIER;
	}

	// Clamp and round
	return Math.round(Math.max(0, Math.min(MORNING_RAW_CAP, morningRaw)));
}

// ── Core Computation ──────────────────────────────────────────────────

/**
 * Compute the Morning Foot Traffic dimension score.
 *
 * Pipeline:
 *   1. Extrapolates morning rush passersby from MTA + ped + census data
 *   2. Maps the raw passerby count to a score using tiered thresholds
 *   3. Generates warning signals when score is below 40
 *
 * @param report - The full LocationIntelReport from the intel pipeline
 * @returns MorningFootTrafficResult with score, raw value, and signals
 */
export function computeMorningFootTraffic(report: LocationIntelReport): MorningFootTrafficResult {
	// Step 1: Extrapolate morning rush traffic from available data sources
	const morningRaw = extrapolateMorningPassersby(report);

	// Step 2: Map raw passersby to score via threshold lookup
	const { score, label: tierLabel } = applyThresholds(morningRaw);

	// Step 3: Generate signals for low-scoring locations
	const signals: IndexSignal[] = [];
	if (score < 40) {
		signals.push({
			index: 'transit',
			type: 'negative',
			message: `Low morning foot traffic for coffee (${morningRaw.toLocaleString()} passersby)`,
		});
	}

	return { score, morningRaw, tierLabel, signals };
}

// ── Threshold Lookup ──────────────────────────────────────────────────

/**
 * Maps a raw morning passerby count to a dimension score using the
 * threshold table. Returns the score and tier label.
 *
 * @param morningRaw - Estimated passersby during 7:30–10:00 AM
 * @returns { score, label } from the matching threshold tier
 */
export function applyThresholds(morningRaw: number): { score: number; label: string } {
	for (const tier of MORNING_FOOT_TRAFFIC_THRESHOLDS) {
		if (morningRaw >= tier.minPassersby) {
			return { score: tier.score, label: tier.label };
		}
	}
	return { score: MORNING_FOOT_TRAFFIC_FLOOR_SCORE, label: 'Very low — unlikely viable for walk-in coffee' };
}
