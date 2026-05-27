import type { LocationIntelReport } from '../types';
import type { SixIndexReport, VisionTier, PrecomputedScores, IndexScore, IndexSignal, IndexName } from '../six-index';
import type { IConceptEngine } from './types';
import { formatConcept } from '$lib/utils/conceptNames';
import { CONCEPT_TYPES, resolveConceptType } from '../six-index';

// Import Primitives
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

export const fitnessEngine: IConceptEngine = {
	compute(report, businessType, precomputed, visionTier, avgTicket, customWeights): SixIndexReport {
		const conceptType = resolveConceptType(businessType);
		const config = CONCEPT_TYPES[conceptType] || CONCEPT_TYPES['generic'];
		const w = customWeights || config.weights;
		const signals: IndexSignal[] = [];

		// 1. Compute Base Primitives
		const transit = computeTransitIndex(report, signals);
		const demographics = computeDemographicsIndex(report, signals);
		const competition = computeCompetitionIndex(report, signals);
		const vibrancy = computeVibrancyIndex(report, signals, businessType);
		const safety = computeSafetyIndex(report, signals);
		const momentum = computeMomentumIndex(report, signals);

		const neighborhoodHealth = precomputed?.neighborhoodHealth ?? 60;
		const survivalRate = precomputed?.survivalRate ?? config.survivalBaseline ?? 52;

		if (neighborhoodHealth > 70) signals.push({ index: 'neighborhoodHealth', type: 'positive', message: `Strong neighborhood business health (${neighborhoodHealth}/100)` });
		else if (neighborhoodHealth < 40) signals.push({ index: 'neighborhoodHealth', type: 'negative', message: `Weak neighborhood business health (${neighborhoodHealth}/100)` });
		
		if (survivalRate > 65) signals.push({ index: 'survivalRate', type: 'positive', message: `High business success rate in area (${survivalRate}%)` });
		else if (survivalRate < 40) signals.push({ index: 'survivalRate', type: 'negative', message: `Low business success rate in area (${survivalRate}%)` });

		// 2. Compute Generic 8-Dimension Composite
		const rawComposite = 
			transit * w.transit +
			demographics * w.demographics +
			competition * w.competition +
			vibrancy * w.vibrancy +
			safety * w.safety +
			momentum * w.momentum +
			neighborhoodHealth * w.neighborhoodHealth +
			survivalRate * w.survivalRate;
			
		const locationIQ = isNaN(rawComposite) ? 50 : Math.round(Math.max(5, Math.min(98, rawComposite)));

		const indices: Record<IndexName, IndexScore> = {
			transit: { score: clamp(transit), weight: w.transit, label: 'Transit Index', description: 'Subway access, foot traffic...', dataSources: sourceCount(report, 'transit').available, totalSources: sourceCount(report, 'transit').total },
			demographics: { score: clamp(demographics), weight: w.demographics, label: 'Demographics Fit', description: 'Income, education, age...', dataSources: sourceCount(report, 'demographics').available, totalSources: sourceCount(report, 'demographics').total },
			competition: { score: clamp(competition), weight: w.competition, label: 'Competition Score', description: 'Competitor density...', dataSources: sourceCount(report, 'competition').available, totalSources: sourceCount(report, 'competition').total },
			vibrancy: { score: clamp(vibrancy), weight: w.vibrancy, label: 'Concept Pulse', description: 'How alive your trade area is...', dataSources: sourceCount(report, 'vibrancy').available, totalSources: sourceCount(report, 'vibrancy').total },
			safety: { score: clamp(safety), weight: w.safety, label: 'Safety Index', description: 'Crime levels, quality of life...', dataSources: sourceCount(report, 'safety').available, totalSources: sourceCount(report, 'safety').total },
			momentum: { score: clamp(momentum), weight: w.momentum, label: 'Momentum Index', description: 'Development trajectory...', dataSources: sourceCount(report, 'momentum').available, totalSources: sourceCount(report, 'momentum').total },
			neighborhoodHealth: { score: clamp(neighborhoodHealth), weight: w.neighborhoodHealth, label: 'Neighborhood Health', description: 'Avg business quality', dataSources: precomputed?.neighborhoodHealth != null ? 1 : 0, totalSources: 1 },
			survivalRate: { score: clamp(survivalRate), weight: w.survivalRate, label: 'Business Success Rate', description: 'Percentage of businesses thriving', dataSources: precomputed?.survivalRate != null ? 1 : 0, totalSources: 1 },
		};

		return {
			locationIQ: clamp(locationIQ),
			grade: scoreToGrade(locationIQ),
			indices,
			conceptType,
			conceptLabel: formatConcept(conceptType),
			archetype: config.archetype,
			signals,
			sourcesPerIndex: INDEX_SOURCES
		};
	}
};
