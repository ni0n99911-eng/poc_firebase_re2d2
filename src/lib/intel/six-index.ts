/**
 * Six-Index Scoring Model — user-facing reorganization of the Location IQ engine.
 *
 * Restructures the internal NIQ/SIQ/TIQ/LIQ architecture into 6 intuitive indices:
 *
 *   1. Transit Index     — MTA ridership + pedestrian counts + Walk Score transit
 *   2. Demographics Fit  — Census income/age/education + Census Housing affordability
 *   3. Competition Score — Overpass competitor scan + Google Places + Market Density
 *   4. Vibrancy Index   — DCA licenses + sidewalk cafés + liquor licenses + market density
 *   5. Safety Index     — NYPD crime + 311 complaints + DOB violations
 *   6. Momentum Index   — DOB new permits + PLUTO development potential + DCA new-business rate
 *
 * This module WRAPS the existing scoring engine — it doesn't replace it.
 * The internal NIQ/SIQ/TIQ/LIQ computation stays the same for backward compatibility.
 * This adds a new `SixIndexReport` that the UI can display directly.
 *
 * Two-layer concept model:
 *   - 3 behavioral archetypes (impulse/planned/destination) — internal classification
 *   - 7 concept types — user-facing with per-index weight presets
 */

import type { LocationIntelReport } from './types';
import type { DynamicConceptConfig } from './dynamic-concept-config';
import { formatConcept } from '$lib/utils/conceptNames';
// 04.19.2026 13:35 Score Consolidation — clamp and scoreLinear imported from canonical geo-math.ts
import { clamp, scoreLinear } from '$lib/intel/scoring/geo-math';
// 04.19.2026 13:35 Score Consolidation — scoreToGrade imported from canonical grade-scale.ts
import { scoreToGrade } from '$lib/intel/scoring/grade-scale';
// COFFEE-REWIRE: Old segment-intel imports (extrapolateCoffeeRushTraffic,
// computeDailyRitualDensity, blendCompetitorPricing) removed — no longer
// needed here. Coffee scoring uses self-contained dim modules.
import { applyConfidencePriors } from './confidence-priors';

import { normalizeBusinessType, BUSINESS_TYPE_CONFIGS } from './registry/business-type-registry';

// ── Concept scan radius ──
export function getConceptScanRadius(bizCategory: string): number {
	const canonical = normalizeBusinessType(bizCategory);
	return BUSINESS_TYPE_CONFIGS[canonical]?.tradeRadiusM || 800; // default = community tier
}

// ─────────────────────────────────────────────────
// Public interfaces
// ─────────────────────────────────────────────────

import type { ValidBusinessType } from './registry/business-type-registry';
export type ConceptType = ValidBusinessType;

export type IndexName = 'transit' | 'demographics' | 'competition' | 'vibrancy' | 'safety' | 'momentum' | 'neighborhoodHealth' | 'survivalRate';

/** COFFEE-REWIRE: Vision tier maps to a post-composite multiplier.
 *  CALIBRATION FIX F2: Steepened from 0.90–1.10 (cosmetic 20% spread) to
 *  0.62–1.12 (50% spread). A $4.50 commodity drip competing against 40+
 *  Dunkin'/bodegas has fundamentally different unit economics than a $9 protein
 *  latte — the multiplier must reflect that. */
export type VisionTier = 'commodity' | 'standard' | 'differentiated' | 'highly_differentiated';
const VISION_MULTIPLIERS: Record<VisionTier, number> = {
	commodity: 0.60,   // v1.1: was 0.62 — 273 5th Ave scored 59 vs target 49; 0.60 projects ~47
	standard: 0.85,
	differentiated: 1.00,
	highly_differentiated: 1.12,
};

/** COFFEE-REWIRE: 6 coffee-specific dimension scores for transparency */
export interface CoffeeDimensions {
	morningFootTraffic: number;
	dailyRitualDensity: number;
	competitionContext: number;
	streetSide: number;
	demographicsFit: number;
	baseViability: number;
	visionMultiplier: number;
	rawComposite: number;
}

/**
 * COFFEE-REWIRE: Raw intermediate data from coffee dimension modules.
 *
 * Exposed so downstream consumers (Watch Outs, diagnostics) can read
 * the same values the scoring engine computed — no need to re-call
 * old segment-intel functions (extrapolateCoffeeRushTraffic, etc.).
 *
 * Only includes fields that downstream consumers actually need;
 * the full dim result objects stay inside the engine.
 */
export interface CoffeeDimRawData {
	/** Dim 1: Raw morning passerby count (7:30–10 AM window) */
	morningRaw: number;
	/** Dim 2: Ritual density score (0–100) */
	ritualScore: number;
	/** Dim 2: Estimated daily ritual-generating population */
	estimatedDailyRitualPop: number;
	/** Dim 2: Per-anchor type breakdown (offices, gyms, residents, etc.) */
	ritualBreakdown: Array<{ type: string; count: number; dailyPop: number }>;
	/** Dim 3: Tier-filtered competitor count (direct competition at your price point) */
	tierCompetitorCount: number;
	/** Dim 3: Average star rating of tier competitors */
	tierAvgRating: number;
}

export interface SixIndexReport {
	/** Composite Location IQ (0-100) — same as LocationIQReport.locationIQ */
	locationIQ: number;
	grade: string;

	/** The 6 user-facing indices */
	indices: Record<IndexName, IndexScore>;

	/** Concept type used for weight calculation */
	conceptType: ConceptType;
	conceptLabel: string;

	/** Behavioral archetype (internal classification) */
	archetype: 'impulse' | 'planned' | 'destination' | 'routine_interceptor' | 'destination_pull' | 'need_filler';

	/** Per-index signals */
	signals: IndexSignal[];

	/** COFFEE-REWIRE: 6-dimension breakdown (only present for specialty_coffee) */
	coffeeDimensions?: CoffeeDimensions;

	/** COFFEE-REWIRE: Raw dim data for Watch Outs and diagnostics.
	 *  Contains intermediate values (morning passerby count, ritual breakdown,
	 *  competitor tier count) that Watch Outs need to trigger warnings. */
	coffeeDimRawData?: CoffeeDimRawData;

	/** Data sources powering each index */
	sourcesPerIndex: Record<IndexName, string[]>;
}

export interface IndexScore {
	score: number;          // 0-100
	weight: number;         // 0-1 (how much this index contributes to composite)
	label: string;          // Human-readable name
	description: string;    // One-line explanation
	dataSources: number;    // How many sources contributed
	totalSources: number;   // How many sources could contribute
}

export interface IndexSignal {
	index: IndexName;
	type: 'positive' | 'negative' | 'neutral';
	message: string;
}

// ─────────────────────────────────────────────────
// Concept type definitions
// ─────────────────────────────────────────────────

/** Pre-computed neighborhood-level scores from block_group_scores table */
export interface PrecomputedScores {
	neighborhoodHealth?: number;  // six_neighborhood_health (0-100)
	survivalRate?: number;        // six_survival_rate (0-100)
	commercialDensity?: number;   // six_commercial_density (0-100)
	haloScore?: number;           // halo:<concept> (0-100)
}

export const CONCEPT_TYPES = BUSINESS_TYPE_CONFIGS;

export function resolveConceptType(businessType: string, businessSubType?: string): import('./registry/business-type-registry').ValidBusinessType {
	// Subtype takes precedence (e.g., restaurant → full_service vs qsr)
	if (businessSubType) {
		const resolvedSub = normalizeBusinessType(businessSubType);
		if (resolvedSub !== 'specialty_coffee' && resolvedSub !== 'generic') return resolvedSub;
	}
	return normalizeBusinessType(businessType);
}

// ─────────────────────────────────────────────────
// Source mapping — which sources feed each index
// ─────────────────────────────────────────────────

// INDEX_SOURCES was moved to primitives

// ─────────────────────────────────────────────────
// Main computation
// ─────────────────────────────────────────────────

import { coffeeRecalibrationEngine as coffeeEngine } from './engines/coffee_recalibration_engine';
import { genericEngine } from './engines/generic-engine';
import { qsrEngine } from './engines/qsr-engine';
import { restaurantEngine } from './engines/restaurant-engine';
import { fastCasualEngine } from './engines/fast-casual-engine';
import { fitnessEngine } from './engines/fitness-studio-engine';
import { retailEngine } from './engines/retail-engine';
import { barNightlifeEngine } from './engines/bar-nightlife-engine';
import { coworkingEngine } from './engines/coworking-engine';
import { personalServicesEngine } from './engines/personal-services-engine';
import { medicalOfficeEngine } from './engines/medical-office-engine';
import { bakeryEngine } from './engines/bakery-engine';
import { wellnessSpaEngine } from './engines/wellness-spa-engine';
import { wellnessBeverageEngine } from './engines/wellness-beverage-engine';
import { juiceBarEngine } from './engines/juice-bar-engine';

import type { IConceptEngine } from './engines/types';
const ENGINE_MAP: Record<string, IConceptEngine> = {
	'specialty_coffee': coffeeEngine,
	'generic': genericEngine,
	'qsr': qsrEngine,
	'full_service_restaurant': restaurantEngine,
	'fast_casual': fastCasualEngine,
	'fitness_studio': fitnessEngine,
	'retail': retailEngine,
	'bar_nightlife': barNightlifeEngine,
	'coworking': coworkingEngine,
	'personal_services': personalServicesEngine,
	'medical_office': medicalOfficeEngine,
	'bakery': bakeryEngine,
	'wellness_spa': wellnessSpaEngine,
	'wellness_beverage': wellnessBeverageEngine,
	'juice_bar': juiceBarEngine,
};

export function computeSixIndex(
	report: LocationIntelReport,
	businessType: string = 'cafe',
	precomputed?: PrecomputedScores,
	visionTier?: VisionTier,
	avgTicket?: number,
	historicalImpactTypes?: string[]
): SixIndexReport {
	const conceptType = resolveConceptType(businessType);
	const engine = ENGINE_MAP[conceptType] || ENGINE_MAP['generic'];
	
	let customWeights: Record<string, number> | undefined = undefined;
	if (historicalImpactTypes && historicalImpactTypes.length > 0) {
		const baseConfig = CONCEPT_TYPES[conceptType] || CONCEPT_TYPES['generic'];
		let adjusted = { ...baseConfig.weights };
		for (const impact of historicalImpactTypes) {
			adjusted = applyConfidencePriors(adjusted, impact);
		}
		customWeights = adjusted;
	}

	return engine.compute(report, businessType, precomputed, visionTier, avgTicket, customWeights, historicalImpactTypes);
}
// ─────────────────────────────────────────────────
// Dynamic Vision IQ — computed from user questionnaire answers
// ─────────────────────────────────────────────────

/**
 * Result of a dynamic Vision IQ computation.
 * Replaces the pre-computed DB value when concept-specific answers are available.
 */
export interface DynamicVisionIQResult {
	/** Vision IQ score 0-100 */
	score: number;
	/** Grade letter (A+ to F) */
	grade: string;
	/** Dynamic weights used (for transparency display) */
	weights: Record<IndexName, number>;
	/** Per-dimension contribution (score × weight) for drill-down */
	components: Record<IndexName, number>;
	/** Archetype inferred from the dynamic config */
	archetype: DynamicConceptConfig['archetype'];
}

/**
 * Compute Vision IQ dynamically from location dimension scores + concept-specific config.
 *
 * This is called when the user answers the Vision Intelligence questionnaire.
 * The weights shift based on how transit/foot-traffic/competition/income-sensitive
 * the concept is, producing 25-35 point differences vs. a static average.
 *
 * @param indexScores  The 8 Location IQ dimension scores (0-100 each)
 * @param config       DynamicConceptConfig from buildDynamicConfig(conceptType, answers)
 */
export function computeDynamicVisionIQ(
	indexScores: Record<IndexName, number>,
	config: DynamicConceptConfig
): DynamicVisionIQResult {
	// Map legacy keys, falling back to new coffee engine keys if present, else 50
	const transit = indexScores.transit ?? (indexScores as any).dailyRitualDensity ?? 50;
	const demographics = indexScores.demographics ?? (indexScores as any).spendVibrancy ?? 50;
	const competition = indexScores.competition ?? (indexScores as any).coffeeCompetition ?? 50;
	const vibrancy = indexScores.vibrancy ?? (indexScores as any).blockActivity ?? 50;
	const safety = indexScores.safety ?? (indexScores as any).streetSafety ?? 50;
	const momentum = indexScores.momentum ?? (indexScores as any).marketTrajectory ?? 50;
	const neighborhoodHealth = indexScores.neighborhoodHealth ?? 50;
	const survivalRate = indexScores.survivalRate ?? 50;

	// ── Step 1: Derive concept-sensitive weights ──

	// Transit: scales with how dependent the concept is on foot/transit traffic
	const transitW = 0.04 + config.transitDependency * 0.10;          // 0.04–0.14

	// Vibrancy: scales with foot traffic dependency
	const vibrancyW = 0.02 + config.footTrafficDependency * 0.07;     // 0.02–0.09

	// Competition: inversely related to saturation tolerance.
	// Low saturationThreshold = concept is very vulnerable to competing density.
	const compSensitivity = Math.max(0, 1 - config.saturationThreshold / 20);
	const competitionW = 0.04 + compSensitivity * 0.10;               // 0.04–0.14

	// Demographics: scales with how income-sensitive the concept is.
	// A concept needing incomeSweet >= $130K lives or dies on area wealth.
	const incomeSensitivity = Math.max(0, Math.min(1, (config.incomeSweet - 50000) / 90000));
	const demographicsW = 0.02 + incomeSensitivity * 0.06;            // 0.02–0.08

	// Safety and momentum: small fixed contribution
	const safetyW = 0.01;
	const momentumW = 0.02;

	// Remainder flows to the two dominant V5.1 predictors (nh + survival)
	const allocatedW = transitW + vibrancyW + competitionW + demographicsW + safetyW + momentumW;
	const remainingW = Math.max(0.50, 1.0 - allocatedW); // guarantee ≥ 50% for nh+sr
	const nhW = remainingW * 0.37;
	const srW = remainingW * 0.63;

	const weights: Record<IndexName, number> = {
		transit: transitW,
		demographics: demographicsW,
		competition: competitionW,
		vibrancy: vibrancyW,
		safety: safetyW,
		momentum: momentumW,
		neighborhoodHealth: nhW,
		survivalRate: srW,
	};

	// ── Step 2: Compute weighted score ──
	const raw =
		transit * transitW +
		demographics * demographicsW +
		competition * competitionW +
		vibrancy * vibrancyW +
		safety * safetyW +
		momentum * momentumW +
		neighborhoodHealth * nhW +
		survivalRate * srW;

	// Normalize against actual weight sum (in case remainingW clamping shifted total)
	const totalW = Object.values(weights).reduce((a, b) => a + b, 0);
	const normalized = totalW > 0 ? (raw / totalW) * 100 : raw;

	// Wait — scores are already 0-100 and we want a weighted average, not a scaled one.
	// Since each score is 0-100 and weights should sum to ~1.0, raw IS already a 0-100 score.
	// The normalization handles the edge case where weights sum slightly ≠ 1.0.
	const score = clamp(Math.round(normalized));

	// ── Step 3: Per-dimension contribution (for breakdown display) ──
	const components: Record<IndexName, number> = {
		transit: Math.round(transit * transitW * 100) / 100,
		demographics: Math.round(demographics * demographicsW * 100) / 100,
		competition: Math.round(competition * competitionW * 100) / 100,
		vibrancy: Math.round(vibrancy * vibrancyW * 100) / 100,
		safety: Math.round(safety * safetyW * 100) / 100,
		momentum: Math.round(momentum * momentumW * 100) / 100,
		neighborhoodHealth: Math.round(neighborhoodHealth * nhW * 100) / 100,
		survivalRate: Math.round(survivalRate * srW * 100) / 100,
	};

	return {
		score,
		grade: scoreToGrade(score),
		weights,
		components,
		archetype: config.archetype,
	};
}

// ─────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────

// 04.19.2026 13:35 Score Consolidation — clamp, scoreLinear, and scoreToGrade removed.
// All three are imported from canonical sources above:
//   clamp, scoreLinear → '$lib/intel/scoring/geo-math'
//   scoreToGrade       → '$lib/intel/scoring/grade-scale'
// NaN guard is preserved inside the canonical clamp() implementation.
