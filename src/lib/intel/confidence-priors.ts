/**
 * confidence-priors.ts
 * BRAIN-PB-03: Adaptive confidence weight priors from Power Broker data
 * Source: RE2_Power_Broker_Architecture_Spec.md — Section 6
 *
 * When a block group matches a Power Broker geohash, multiply the relevant
 * sub-score weight by the confidence multiplier before computing fitScore.
 *
 * Multiplier > 1.0 = increase this sub-score's weight (more predictive here)
 * Multiplier < 1.0 = decrease this sub-score's weight (less reliable here)
 */

export type ImpactType =
  | 'destroyed_commercial_corridor'
  | 'isolated_neighborhood'
  | 'destroyed_organic_commercial_fabric'
  | 'systemic_pattern'
  | 'rapid_gentrification'
  | 'institutional_anchor'
  | 'transit_hub_effect'
  | 'commercial_district_maturation'
  | 'commercial_district_emergence'
  | 'commercial_district_revival'
  | 'residential_overbuild'
  | 'ethnic_commercial_corridor'
  | 'suburban_pattern';

export interface ConfidenceMultipliers {
  vibrancy?: number;
  transit?: number;
  safety?: number;
  momentum?: number;
  demographics?: number;
  competition?: number;
  accessibility?: number;
}

export interface ConfidencePrior {
  multipliers: ConfidenceMultipliers;
  notes: string[];
}

/**
 * Per-impact-type confidence priors.
 * Applied when a block group matches a Power Broker geohash entry.
 */
export const IMPACT_TYPE_PRIORS: Record<ImpactType, ConfidencePrior> = {
  destroyed_commercial_corridor: {
    multipliers: {
      vibrancy: 0.7,    // API data may miss structural damage
      safety: 0.8,
      momentum: 0.8,    // signals may be gentrification, not organic growth
    },
    notes: [
      'Vibrancy API data may not reflect structural corridor severance.',
      'Momentum signals should be interpreted as potential recovery, not current vitality.',
    ],
  },

  isolated_neighborhood: {
    multipliers: {
      vibrancy: 0.6,    // destination vibrancy ≠ daily foot traffic
      transit: 1.4,     // transit MORE predictive in isolated areas (absence is critical)
      accessibility: 1.3,
    },
    notes: [
      'Neighborhood is structurally isolated — transit absence is more punishing than average.',
      'Vibrancy from destination venues (breweries, art spaces) does not generate daily foot traffic.',
    ],
  },

  destroyed_organic_commercial_fabric: {
    multipliers: {
      demographics: 0.6, // Census may lag rapid change
      competition: 0.7,
      momentum: 0.9,
    },
    notes: [
      'Census demographics may lag 2-3 years behind actual neighborhood composition change.',
      'Competition data may not reflect the pre-displacement commercial mix.',
    ],
  },

  systemic_pattern: {
    multipliers: {
      transit: 1.3,     // PB-015: subway proximity even MORE predictive citywide
    },
    notes: [
      'Pre-1940 subway proximity is the strongest predictor of walkable commercial viability.',
      'Block groups near original IRT/BMT/IND stations have 40% higher commercial viability baseline.',
    ],
  },

  rapid_gentrification: {
    multipliers: {
      vibrancy: 1.1,
      competition: 1.1, // Competition is real and intense
      demographics: 0.9, // Demographics shifting — census may be 2 years stale
    },
    notes: [
      'Rapid gentrification area — census income data may understate current demographic.',
      'Competition is intense and growing. Saturation risks are real.',
    ],
  },

  institutional_anchor: {
    multipliers: {
      demographics: 0.8, // Student population inflates density, deflates income
      vibrancy: 0.9,      // Academic calendar creates seasonal dead zones
    },
    notes: [
      'Institutional anchor creates seasonal demand patterns — summer dead zones.',
      'Student demographics distort income scoring — actual discretionary spend lower than HHI suggests.',
    ],
  },

  transit_hub_effect: {
    multipliers: {
      accessibility: 1.2,
      vibrancy: 0.8, // Transit-transient foot traffic ≠ neighborhood vibrancy
    },
    notes: [
      'Transit hub generates high foot traffic counts but mostly transient commuters.',
      'Grab-and-go and commuter-serving concepts outperform destination retail here.',
    ],
  },

  commercial_district_maturation: {
    multipliers: {
      competition: 1.2, // Mature market — competition is real and intensifying
      momentum: 0.9,    // Growth plateau — momentum may not continue
    },
    notes: [
      'Mature commercial district — differentiation is critical for new entrants.',
      'High competition intensity. Chain penetration likely high.',
    ],
  },

  commercial_district_emergence: {
    multipliers: {
      vibrancy: 0.8,    // Retail lagging residential
      momentum: 1.2,    // Momentum is a leading indicator here
    },
    notes: [
      'Emerging district — retail infrastructure lags residential by 3-5 years.',
      'Momentum is the key signal; vibrancy will follow.',
    ],
  },

  commercial_district_revival: {
    multipliers: {
      momentum: 1.2,
      safety: 1.1,  // Safety improvements are real and meaningful here
    },
    notes: [
      'Revival corridor — safety improvements are confirmed by ground data.',
      'Momentum is leading. Demographics shifting toward higher income.',
    ],
  },

  residential_overbuild: {
    multipliers: {
      vibrancy: 0.7,    // Retail significantly lags residential
      momentum: 1.1,    // Construction pipeline is real
      demographics: 0.9,
    },
    notes: [
      'Rapid residential buildout without proportional retail infrastructure.',
      'Vibrancy will improve as retail catches up — timing is 3-5 years.',
    ],
  },

  ethnic_commercial_corridor: {
    multipliers: {
      demographics: 1.2, // Demographic alignment is especially predictive
      vibrancy: 0.9,     // F&D saturation flag may be false alarm
    },
    notes: [
      'Ethnic commercial corridor — demographic alignment is the primary success factor.',
      'F&D saturation benchmark is structural, not over-saturation.',
    ],
  },

  suburban_pattern: {
    multipliers: {
      transit: 0.7,        // Transit is less predictive in auto-dependent markets
      accessibility: 0.7,
    },
    notes: [
      'Auto-dependent market — transit and walkability metrics are less predictive.',
      'Parking availability and visibility from main roads are key factors not in current scoring.',
    ],
  },
};

/**
 * Get confidence multipliers for a given impact type.
 * Returns defaults (all 1.0) if impact type not found.
 */
export function getConfidenceMultipliers(impactType: string): ConfidenceMultipliers {
  const prior = IMPACT_TYPE_PRIORS[impactType as ImpactType];
  return prior?.multipliers ?? {};
}

/**
 * Apply confidence multipliers to sub-score weights.
 * @param weights - current sub-score weights object
 * @param impactType - impact type from historical_ground_truths
 * @returns adjusted weights
 */
export function applyConfidencePriors(
  weights: Record<string, number>,
  impactType: string
): Record<string, number> {
  const multipliers = getConfidenceMultipliers(impactType);
  const adjusted = { ...weights };

  for (const [key, mult] of Object.entries(multipliers)) {
    if (adjusted[key] !== undefined && mult !== undefined) {
      adjusted[key] = adjusted[key] * mult;
    }
  }

  return adjusted;
}

