import type { LocationIntelReport } from '../types';
import type { SixIndexReport, VisionTier, PrecomputedScores } from '../six-index';

export interface IConceptEngine {
	compute(
		report: LocationIntelReport,
		businessType: string,
		precomputed?: PrecomputedScores,
		visionTier?: VisionTier,
		avgTicket?: number,
		customWeights?: Record<string, number>,
		historicalImpactTypes?: string[]
	): SixIndexReport;
}
