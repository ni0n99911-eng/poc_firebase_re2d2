/**
 * ═══════════════════════════════════════════════════════
 * Coffee Engine V2 — Recalibration Build
 * ═══════════════════════════════════════════════════════
 *
 * Drop-in replacement for coffee-engine.ts that delegates all
 * dimension scoring to the standalone recalibration modules.
 *
 * Same interface (IConceptEngine), same output (SixIndexReport),
 * same behavior — but every dimension is independently tunable.
 *
 * To activate in production, change ONE line in six-index.ts:
 *   ENGINE_MAP['specialty_coffee'] = coffeeEngineV2;
 *
 * Until then, this file has ZERO impact on the running application.
 */

import type { LocationIntelReport } from '../types';
import type { SixIndexReport, VisionTier, PrecomputedScores, IndexScore, IndexSignal, IndexName } from '../six-index';
import type { IConceptEngine } from './types';
import { formatConcept } from '$lib/utils/conceptNames';
import { CONCEPT_TYPES, resolveConceptType } from '../six-index';

// Base primitives — same as v1, these compute the 8 standard indices
import {
	computeTransitIndex,
	computeDemographicsIndex,
	computeCompetitionIndex,
	computeVibrancyIndex,
	computeSafetyIndex,
	computeMomentumIndex,
	clamp,
	scoreToGrade,
	INDEX_SOURCES,
	sourceCount
} from './primitives';

// ── Recalibration Dimension Modules ──────────────────────────────────
import { computeMorningFootTraffic } from './coffee_recalibration_dim1_morningFootTraffic';
import { computeDailyRitualDensityDimension } from './coffee_recalibration_dim2_dailyRitualDensity';
import { computeCompetitionContext } from './coffee_recalibration_dim3_competitionContext';
import { computeStreetSide } from './coffee_recalibration_dim4_streetSide';
import { computeDemographicsFit } from './coffee_recalibration_dim5_demographicsFit';
import { computeBaseViability } from './coffee_recalibration_dim6_baseViability';
import { applyVisionMultiplier } from './coffee_recalibration_visionMultiplier';

// ── Dimension Weights ────────────────────────────────────────────────
// Extracted here for visibility. These control how much each coffee
// dimension contributes to the raw composite.

const COFFEE_DIMENSION_WEIGHTS = {
	morningFootTraffic: 0.30,
	dailyRitualDensity: 0.25,
	competitionContext: 0.15,
	streetSide: 0.10,
	demographicsFit: 0.10,
	baseViability: 0.10,
} as const;

// ── Engine Implementation ────────────────────────────────────────────

export const coffeeEngineV2: IConceptEngine = {
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

		// ─── Phase 1: Compute Base Primitives (same as v1) ───────────
		// These 8 indices feed both the standard index display AND the
		// coffee-specific dimensions (competition, demographics are reused).
		const transit = computeTransitIndex(report, signals);
		const demographics = computeDemographicsIndex(report, signals);
		const competition = computeCompetitionIndex(report, signals);
		const vibrancy = computeVibrancyIndex(report, signals, businessType);
		const safety = computeSafetyIndex(report, signals);
		const momentum = computeMomentumIndex(report, signals);

		const neighborhoodHealth = precomputed?.neighborhoodHealth ?? 60;
		const survivalRate = precomputed?.survivalRate ?? config.survivalBaseline ?? 52;

		// Base primitive signals (neighborhood health + survival rate)
		if (neighborhoodHealth > 70) signals.push({ index: 'neighborhoodHealth', type: 'positive', message: `Strong neighborhood business health (${neighborhoodHealth}/100)` });
		else if (neighborhoodHealth < 40) signals.push({ index: 'neighborhoodHealth', type: 'negative', message: `Weak neighborhood business health (${neighborhoodHealth}/100)` });

		if (survivalRate > 65) signals.push({ index: 'survivalRate', type: 'positive', message: `High business success rate in area (${survivalRate}%)` });
		else if (survivalRate < 40) signals.push({ index: 'survivalRate', type: 'negative', message: `Low business success rate in area (${survivalRate}%)` });

		// ─── Phase 2: Compute 6 Coffee Dimensions ────────────────────
		// Each dimension is computed by its own recalibration module.
		// Thresholds, conversion rates, and formulas live in those files —
		// tune them independently without touching this orchestrator.

		const coffeeTicket = avgTicket ?? 5.00;

		const dim1 = computeMorningFootTraffic(report);
		const dim2 = computeDailyRitualDensityDimension(report, coffeeTicket);
		const dim3 = computeCompetitionContext(report, competition, coffeeTicket);
		const dim4 = computeStreetSide(report);
		const dim5 = computeDemographicsFit(report, demographics, coffeeTicket);
		const dim6 = computeBaseViability(survivalRate, neighborhoodHealth);

		const ftScore = dim1.score;
		const rdScore = dim2.score;
		const ccScore = dim3.score;
		const ssScore = dim4.score;
		const dfScore = dim5.score;
		const bvScore = dim6.score;

		// Collect dimension-level signals
		signals.push(...dim1.signals);
		signals.push(...dim2.signals);
		signals.push(...dim3.signals);
		signals.push(...dim4.signals);
		signals.push(...dim5.signals);
		signals.push(...dim6.signals);

		// ─── Phase 3: Combine → Raw Composite ────────────────────────
		const w = COFFEE_DIMENSION_WEIGHTS;
		const rawComposite =
			ftScore * w.morningFootTraffic +
			rdScore * w.dailyRitualDensity +
			ccScore * w.competitionContext +
			ssScore * w.streetSide +
			dfScore * w.demographicsFit +
			bvScore * w.baseViability;

		// ─── Phase 4: Apply Vision Multiplier → Final Score ──────────
		const vm = applyVisionMultiplier(rawComposite, visionTier);
		const locationIQ = vm.locationIQ;

		// ─── Phase 5: Assemble Output ────────────────────────────────
		const coffeeDimensions = {
			morningFootTraffic: ftScore,
			dailyRitualDensity: rdScore,
			competitionContext: ccScore,
			streetSide: ssScore,
			demographicsFit: dfScore,
			baseViability: bvScore,
			visionMultiplier: vm.visionMultiplier,
			rawComposite: Math.round(rawComposite),
		};

		// Standard 8-index display (same shape as v1)
		const iw = customWeights || config.weights;
		const indices: Record<IndexName, IndexScore> = {
			transit:             { score: clamp(transit),             weight: iw.transit,             label: 'Transit Index',         description: 'Subway access, foot traffic...',        dataSources: sourceCount(report, 'transit').available,      totalSources: sourceCount(report, 'transit').total },
			demographics:        { score: clamp(demographics),        weight: iw.demographics,        label: 'Demographics Fit',      description: 'Income, education, age...',              dataSources: sourceCount(report, 'demographics').available, totalSources: sourceCount(report, 'demographics').total },
			competition:         { score: clamp(competition),         weight: iw.competition,         label: 'Competition Score',     description: 'Competitor density...',                  dataSources: sourceCount(report, 'competition').available,  totalSources: sourceCount(report, 'competition').total },
			vibrancy:            { score: clamp(vibrancy),            weight: iw.vibrancy,            label: 'Concept Pulse',         description: 'How alive your trade area is...',        dataSources: sourceCount(report, 'vibrancy').available,     totalSources: sourceCount(report, 'vibrancy').total },
			safety:              { score: clamp(safety),              weight: iw.safety,              label: 'Safety Index',          description: 'Crime levels, quality of life...',       dataSources: sourceCount(report, 'safety').available,       totalSources: sourceCount(report, 'safety').total },
			momentum:            { score: clamp(momentum),            weight: iw.momentum,            label: 'Momentum Index',        description: 'Development trajectory...',               dataSources: sourceCount(report, 'momentum').available,     totalSources: sourceCount(report, 'momentum').total },
			neighborhoodHealth:  { score: clamp(neighborhoodHealth),  weight: iw.neighborhoodHealth,  label: 'Neighborhood Health',   description: 'Avg business quality',                   dataSources: precomputed?.neighborhoodHealth != null ? 1 : 0, totalSources: 1 },
			survivalRate:        { score: clamp(survivalRate),        weight: iw.survivalRate,        label: 'Business Success Rate', description: 'Percentage of businesses thriving',      dataSources: precomputed?.survivalRate != null ? 1 : 0,       totalSources: 1 },
		};

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
		};
	}
};
