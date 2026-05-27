import type { LocationIntelReport } from '../types';
import type { SixIndexReport, VisionTier, PrecomputedScores, IndexScore, IndexSignal, IndexName } from '../six-index';
import type { IConceptEngine } from './types';
import { formatConcept } from '$lib/utils/conceptNames';
import { extrapolateCoffeeRushTraffic, computeDailyRitualDensity, blendCompetitorPricing } from '../segment-intel';
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
	scoreLinear,
	scoreToGrade,
	INDEX_SOURCES,
	sourceCount
} from './primitives';

/**
 * Coffee-specific multipliers mapped to concept vision levels.
 */
const VISION_MULTIPLIERS = {
	commodity: 0.60,
	standard: 0.85,
	differentiated: 1.00,
	highly_differentiated: 1.12,
} as Record<string, number>;

export const coffeeEngine: IConceptEngine = {
	compute(report, businessType, precomputed, visionTier, avgTicket, customWeights): SixIndexReport {
		const conceptType = resolveConceptType(businessType);
		const config = CONCEPT_TYPES[conceptType] || CONCEPT_TYPES['generic'];
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

		// 2. Compute the 6-Dimension Special Score
		const rushData = extrapolateCoffeeRushTraffic(report);
		const morningRaw = rushData.morning.rawValue;
		const ftScore = morningRaw >= 10000 ? 95
			: morningRaw >= 5000 ? 88
			: morningRaw >= 3000 ? 72
			: morningRaw >= 1500 ? 52
			: morningRaw >= 500 ? 30
			: 12;

		const coffeeTicket = avgTicket ?? 5.00;
		const ritualData = computeDailyRitualDensity(report, coffeeTicket);
		const rdScore = ritualData?.score ?? 30;

		const compData = blendCompetitorPricing(report, 'specialty_coffee', coffeeTicket);
		let ccScore = competition;
		if (compData) {
			const sentimentAdj = compData.sentiment === 'great' ? 15
				: compData.sentiment === 'good' ? 5
				: compData.sentiment === 'caution' ? -5
				: -15;
			ccScore = Math.max(0, Math.min(100, competition + sentimentAdj));
		}

		const ssScore = (report as any).streetSide?.streetSideScore ?? 50;

		let dfScore = demographics;
		if (coffeeTicket > 7 && report.census) {
			const medianIncome = report.census.medianHouseholdIncome || 0;
			const premiumIncomeScore = scoreLinear(medianIncome, 50000, 200000);
			const nonIncomePortion = demographics * 0.65;
			const premiumIncomePortion = premiumIncomeScore * 0.35;
			dfScore = Math.round(nonIncomePortion / 0.65 * 0.65 + premiumIncomePortion);
		}

		const bvScore = Math.round(survivalRate * 0.5 + neighborhoodHealth * 0.5);

		// Combine 6 Dimensions
		const rawComposite = ftScore * 0.30 + rdScore * 0.25 + ccScore * 0.15 + ssScore * 0.10 + dfScore * 0.10 + bvScore * 0.10;
		const visionMultiplier = VISION_MULTIPLIERS[visionTier ?? 'standard'] || 1.0;
		
		const product = rawComposite * visionMultiplier;
		const locationIQ = isNaN(product) ? 50 : Math.round(Math.max(5, Math.min(98, product)));

		const coffeeDimensions = {
			morningFootTraffic: ftScore,
			dailyRitualDensity: rdScore,
			competitionContext: ccScore,
			streetSide: ssScore,
			demographicsFit: dfScore,
			baseViability: bvScore,
			visionMultiplier,
			rawComposite: Math.round(rawComposite),
		};

		if (ftScore < 40) signals.push({ index: 'transit', type: 'negative', message: `Low morning foot traffic for coffee (${morningRaw} passersby)` });
		if (rdScore < 40) signals.push({ index: 'vibrancy', type: 'negative', message: `Thin daily ritual anchors — few repeat-visit generators nearby` });

		const w = customWeights || config.weights;
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
			conceptType: 'specialty_coffee',
			conceptLabel: formatConcept('specialty_coffee'),
			archetype: config.archetype,
			signals,
			sourcesPerIndex: INDEX_SOURCES,
			coffeeDimensions
		};
	}
};
