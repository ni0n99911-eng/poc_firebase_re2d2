import type { IConceptEngine } from './types';
import { computeStandardEightDimensionModel } from './standard-model';

export const fastCasualEngine: IConceptEngine = {
	compute(report, businessType, precomputed, visionTier, avgTicket) {
		// Clean, abstracted wrapper allowing customization without duplication
		return computeStandardEightDimensionModel(report, businessType, precomputed, visionTier, avgTicket);
	}
};
