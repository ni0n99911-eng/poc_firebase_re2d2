/**
 * ═══════════════════════════════════════════════════════
 * Coffee Recalibration Engine
 * ═══════════════════════════════════════════════════════
 *
 * Drop-in replacement for coffee-engine.ts that delegates all
 * dimension scoring to the standalone recalibration modules.
 *
 * Same interface (IConceptEngine), same output (SixIndexReport),
 * same behavior — but every dimension is independently tunable.
 *
 * Architecture:
 *   This engine is a pure orchestrator — it contains NO scoring math.
 *   All scoring logic lives in the 7 recalibration modules:
 *     - dim1: coffee_recalibration_dim1_morningFootTraffic.ts
 *     - dim2: coffee_recalibration_dim2_dailyRitualDensity.ts
 *     - dim3: coffee_recalibration_dim3_competitionContext.ts
 *     - dim4: coffee_recalibration_dim4_streetSide.ts
 *     - dim5: coffee_recalibration_dim5_demographicsFit.ts
 *     // - dim6: coffee_recalibration_dim6_baseViability.ts  [COMMENTED OUT]
 *     - vision: coffee_recalibration_visionMultiplier.ts
 *
 * To activate in production, change ONE line in six-index.ts:
 *   import { coffeeRecalibrationEngine as coffeeEngine } from './engines/coffee_recalibration_engine';
 *
 * Until then, this file has ZERO impact on the running application.
 */

import type { LocationIntelReport } from '../types';
import type { SixIndexReport, VisionTier, PrecomputedScores, IndexScore, IndexSignal, IndexName } from '../six-index';
import type { IConceptEngine } from './types';
import { formatConcept } from '$lib/utils/conceptNames';
import { CONCEPT_TYPES, resolveConceptType } from '../six-index';

// Base primitives — only safety is still used (no coffee-specific dim for it).
// Transit, demographics, competition, vibrancy, and momentum are replaced by
// coffee dims in the Deep Dive display.
import {
	computeSafetyIndex,
	clamp,
	scoreToGrade,
	INDEX_SOURCES,
} from './primitives';

// ── Recalibration Dimension Modules ──────────────────────────────────
// Each module is self-contained — all thresholds, conversion rates,
// and formulas live inside. Edit any dim file independently.

import { computeMorningFootTraffic } from './coffee_recalibration_dim1_morningFootTraffic';
import { computeDailyRitualDensityDimension } from './coffee_recalibration_dim2_dailyRitualDensity';
import { computeCompetitionContext } from './coffee_recalibration_dim3_competitionContext';
import { computeStreetSide } from './coffee_recalibration_dim4_streetSide';
import { computeDemographicsFit } from './coffee_recalibration_dim5_demographicsFit';
// import { computeBaseViability } from './coffee_recalibration_dim6_baseViability';  // [COMMENTED OUT]
import { applyVisionMultiplier } from './coffee_recalibration_visionMultiplier';
import { buildCoffeeDeepDiveIndices } from './coffee_recalibrated_deep_dive';

// ── Dimension Weights ────────────────────────────────────────────────
// Controls how much each coffee dimension contributes to the raw composite.
// Must sum to 1.00.

const COFFEE_DIMENSION_WEIGHTS = {
	morningFootTraffic: 0.40,
	dailyRitualDensity: 0.25,
	competitionContext: 0.15,
	streetSide: 0.10,
	demographicsFit: 0.10,
	//baseViability: 0.10,
} as const;

// ── Engine Implementation ────────────────────────────────────────────

export const coffeeRecalibrationEngine: IConceptEngine = {
	compute(
		report: LocationIntelReport,
		businessType: string,
		precomputed?: PrecomputedScores,
		visionTier?: VisionTier,
		avgTicket?: number,
		customWeights?: Record<string, number>,
		historicalImpactTypes?: string[]
	): SixIndexReport {
		const conceptType = resolveConceptType(businessType);
		const config = CONCEPT_TYPES[conceptType] || CONCEPT_TYPES['generic'];
		const signals: IndexSignal[] = [];

		// ─── Phase 1: Compute Non-Coffee Primitives ────────────────
		// Only safety is still computed from primitives — the other 5
		// primitives (transit, demographics, competition, vibrancy,
		// momentum) have been replaced by coffee dims in the Deep Dive.
		const safety = computeSafetyIndex(report, signals);

		const neighborhoodHealth = precomputed?.neighborhoodHealth ?? 60;
		const survivalRate = precomputed?.survivalRate ?? config.survivalBaseline ?? 52;

		// Base primitive signals (neighborhood health + survival rate)
		if (neighborhoodHealth > 70) signals.push({ index: 'neighborhoodHealth', type: 'positive', message: `Strong neighborhood business health (${neighborhoodHealth}/100)` });
		else if (neighborhoodHealth < 40) signals.push({ index: 'neighborhoodHealth', type: 'negative', message: `Weak neighborhood business health (${neighborhoodHealth}/100)` });

		if (survivalRate > 65) signals.push({ index: 'survivalRate', type: 'positive', message: `High business success rate in area (${survivalRate}%)` });
		else if (survivalRate < 40) signals.push({ index: 'survivalRate', type: 'negative', message: `Low business success rate in area (${survivalRate}%)` });

		// ─── Phase 2: Compute 6 Coffee Dimensions ─────────────────
		// Each dimension is computed by its own recalibration module.
		// Thresholds, conversion rates, and formulas live in those files —
		// tune them independently without touching this orchestrator.

		const coffeeTicket = avgTicket ?? 5.00;

		const dim1 = computeMorningFootTraffic(report);
		const dim2 = computeDailyRitualDensityDimension(report, coffeeTicket);
		const dim3 = computeCompetitionContext(report, coffeeTicket);
		const dim4 = computeStreetSide(report);
		const dim5 = computeDemographicsFit(report, coffeeTicket);
		// const dim6 = computeBaseViability(survivalRate, neighborhoodHealth);  // [COMMENTED OUT]

		const ftScore = dim1.score;
		const rdScore = dim2.score;
		const ccScore = dim3.score;
		const ssScore = dim4.score;
		const dfScore = dim5.score;
		// const bvScore = dim6.score;  // [COMMENTED OUT]

		// Collect dimension-level signals
		signals.push(...dim1.signals);
		signals.push(...dim2.signals);
		signals.push(...dim3.signals);
		signals.push(...dim4.signals);
		signals.push(...dim5.signals);
		// signals.push(...dim6.signals);  // [COMMENTED OUT]

		// ─── Phase 3: Combine → Raw Composite ─────────────────────
		const w = COFFEE_DIMENSION_WEIGHTS;
		const rawComposite =
			ftScore * w.morningFootTraffic +
			rdScore * w.dailyRitualDensity +
			ccScore * w.competitionContext +
			ssScore * w.streetSide +
			dfScore * w.demographicsFit;
			// + bvScore * w.baseViability;  // [COMMENTED OUT]

		// ─── Phase 4: Apply Vision Multiplier → Final Score ───────
		const vm = applyVisionMultiplier(rawComposite, visionTier);
		const locationIQ = vm.locationIQ;

		// ─── Phase 5: Assemble Output ─────────────────────────────
		const coffeeDimensions = {
			morningFootTraffic: ftScore,
			dailyRitualDensity: rdScore,
			competitionContext: ccScore,
			streetSide: ssScore,
			demographicsFit: dfScore,
			// baseViability: bvScore,  // [COMMENTED OUT]
			baseViability: 0,  // dim6 disabled
			visionMultiplier: vm.visionMultiplier,
			rawComposite: Math.round(rawComposite),
		};

		// ─── Deep Dive: Coffee-specific indices ─────────────────
		// Uses actual coffee dim scores instead of generic primitives.
		// The Deep Dive tab now shows the real numbers that drive Location IQ.
		const iw = customWeights || config.weights;
		const indices = buildCoffeeDeepDiveIndices({
			dim1, dim2, dim3, dim4, dim5,
			safetyScore: safety,
			neighborhoodHealth,
			survivalRate,
			report,
			weights: iw,
		});

		return {
			locationIQ: clamp(locationIQ),
			grade: scoreToGrade(locationIQ),
			indices,
			conceptType: 'specialty_coffee',
			conceptLabel: formatConcept('specialty_coffee'),
			archetype: config.archetype,
			signals,
			sourcesPerIndex: INDEX_SOURCES,
			coffeeDimensions,

			// ─── Raw dim data for Watch Outs ─────────────────────────
			// Exposes the intermediate values that Watch Outs need to
			// trigger warnings (W1–W10). This replaces the old pattern
			// of re-calling segment-intel functions in location-iq.
			coffeeDimRawData: {
				morningRaw: dim1.morningRaw,
				ritualScore: dim2.score,
				estimatedDailyRitualPop: dim2.estimatedDailyPop,
				ritualBreakdown: dim2.breakdown.map(b => ({
					type: b.type,
					count: b.count,
					dailyPop: b.dailyPop,
				})),
				tierCompetitorCount: dim3.tierCompetitors ?? 0,
				tierAvgRating: dim3.blendResult?.avgRating ?? 0,
			},
		};
	}
};
