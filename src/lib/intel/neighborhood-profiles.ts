/**
 * neighborhood-profiles.ts
 * BRAIN-BOR-01/02: Borough-level market data and neighborhood profiles
 * Sources: 01_Ground_Truth_Rules.md Section B1
 *
 * Used by CoPilot to contextualize scores with real NYC market data.
 * Injected into Sonnet prompt when block group matches a known corridor.
 */

export interface CorridorProfile {
  name: string;
  communityBoard?: string;
  vacancyRate?: number;       // e.g. 0.036 = 3.6%
  vacancyLabel?: string;      // 'TIGHT_MARKET' | 'HEALTHY_MARKET' | 'SOFT_MARKET' | 'WEAK_MARKET'
  medianHHI?: number;
  rentPressure: 'extreme' | 'high' | 'moderate' | 'low';
  dailyPedestrians?: number;
  geohashPrefixes: string[];  // 5-char prefixes
  notes: string[];
  conceptFitNotes?: Partial<Record<string, string>>;  // concept → fit note
}

/**
 * BRAIN-BOR-01: Manhattan corridor data (Lee 2025 + Times Square Annual 2025)
 * Vacancy rates as of 2025.
 */
export const MANHATTAN_CORRIDORS: CorridorProfile[] = [
  {
    name: 'Flatiron/Union Square',
    communityBoard: 'CB5',
    vacancyRate: 0.036,
    vacancyLabel: 'TIGHT_MARKET',
    medianHHI: 150000,
    rentPressure: 'extreme',
    geohashPrefixes: ['dr5re', 'dr5rd'],
    notes: [
      '3.60% vacancy (tied lowest in NYC as of 2025).',
      'Premium retail and office-serving F&D. Very competitive, landlord leverage maximum.',
      'Median HHI $150K+ — premium concepts viable but require strong differentiation.',
    ],
    conceptFitNotes: {
      specialty_coffee: 'High demand but saturated. Brand differentiation critical.',
      wellness_beverage: 'Strong demographic alignment. High competition.',
      fitness_studio: 'Dense office worker base. Evening and lunch peak strong.',
    },
  },
  {
    name: 'Williamsburg',
    communityBoard: 'CB1 Brooklyn',
    vacancyRate: 0.036,
    vacancyLabel: 'TIGHT_MARKET',
    rentPressure: 'high',
    geohashPrefixes: ['dr5qd', 'dr5qf'],
    notes: [
      '3.60% vacancy (tied lowest in NYC as of 2025).',
      'Mature gentrification market. Independent retail and F&D density high.',
      'L train access. Landlord leverage high. Differentiation required for new entrants.',
    ],
  },
  {
    name: 'SoHo',
    communityBoard: 'CB2',
    vacancyRate: 0.052,
    vacancyLabel: 'HEALTHY_MARKET',
    rentPressure: 'extreme',
    geohashPrefixes: ['dr5r5', 'dr5r4'],
    notes: [
      '5.20% vacancy (2025). Boutique retail destination.',
      'SoHo-Cast Iron Historic District: LPC signage restrictions apply.',
      'High chain penetration. Independent concepts struggle with rent escalation.',
    ],
    conceptFitNotes: {
      retail: 'Premium boutique viable but requires flagship-level brand.',
      specialty_coffee: 'High visibility but LPC signage restrictions reduce impulse capture.',
    },
  },
  {
    name: 'Fifth Avenue',
    communityBoard: 'CB5',
    vacancyRate: 0.058,
    vacancyLabel: 'HEALTHY_MARKET',
    rentPressure: 'extreme',
    geohashPrefixes: ['dr5rg', 'dr5rf'],
    notes: [
      '5.80% vacancy (2025). Premium retail and luxury flagship corridor.',
      'Tourist-driven foot traffic. Concept must have national brand recognition or strong local following.',
    ],
  },
  {
    name: 'Times Square',
    communityBoard: 'CB5',
    rentPressure: 'extreme',
    dailyPedestrians: 218093,
    geohashPrefixes: ['dr5ru', 'dr5rt'],
    notes: [
      '218,093 average daily pedestrians (+4.9% YoY, 2025).',
      'Hotel occupancy 86%. Retail spending $3.3B (+6% YoY).',
      'Broadway leases: 1.4M leasable SF in 2024.',
      'Tourist-dominated foot traffic. Concept must serve transient customers.',
    ],
    conceptFitNotes: {
      qsr: 'Very strong. High volume, transient customers, peak all-day.',
      full_service_restaurant: 'Viable for tourist-facing concepts with name recognition.',
      specialty_coffee: 'Excellent volume but margins tight due to extreme rent.',
    },
  },
  {
    name: 'Hudson Square',
    communityBoard: 'CB2',
    rentPressure: 'high',
    geohashPrefixes: ['dr5r6', 'dr5r3'],
    notes: [
      'Emerging tech/media office hub (Google campus nearby).',
      'Office-worker base with strong daytime demand.',
      'Startup and creative industry concentration.',
    ],
  },
  {
    name: 'Upper West Side',
    communityBoard: 'CB7/CB8',
    rentPressure: 'high',
    geohashPrefixes: ['dr5rx', 'dr5rv'],
    notes: [
      'Residential-driven retail. Moderate tourism from Central Park.',
      'Above 96th St: no CRT. Income demographics high.',
      'Family demographics. Neighborhood loyalty strong.',
    ],
  },
  {
    name: 'Lower Manhattan / Financial District',
    communityBoard: 'CB1/CB3',
    rentPressure: 'high',
    geohashPrefixes: ['dr5r7', 'dr5rk'],
    notes: [
      'Office recovery post-COVID. Residential conversion increasing.',
      'Weekday vs. weekend demand split is significant.',
      'Lunch peak dominates for F&D.',
    ],
  },
  {
    name: 'Chinatown',
    communityBoard: 'CB3',
    rentPressure: 'moderate',
    geohashPrefixes: ['dr5r9', 'dr5r8'],
    notes: [
      'Ethnic commercial corridor. F&D 25%+ is structural, not over-saturation.',
      'Community-driven retail. Concepts must serve or complement ethnic market.',
      'Low rent relative to adjacent SoHo/Tribeca.',
    ],
  },
  {
    name: 'Midtown East / Grand Central',
    communityBoard: 'CB5',
    rentPressure: 'extreme',
    dailyPedestrians: 750000, // Grand Central terminal daily ridership
    geohashPrefixes: ['dr5rf', 'dr5rg'],
    notes: [
      'Office-based retail. Commuter-oriented demand peaks AM and PM.',
      'Grand Central BID zone. Enhanced services.',
      'Lunch peak dominates for F&D. Weekend dead.',
    ],
    conceptFitNotes: {
      specialty_coffee: 'Excellent AM peak. High volume commuter traffic.',
      qsr: 'Strong all-day. Commuter base.',
      full_service_restaurant: 'Lunch strong. Evening limited (office workers leave).',
    },
  },
  {
    name: 'Harlem (125th Street)',
    communityBoard: 'CB10/CB11',
    rentPressure: 'moderate',
    geohashPrefixes: ['dr5rv', 'dr5rw'],
    notes: [
      'Above 96th St: NO CRT applies.',
      'Commercial revival driven by Apollo anchor + BRT investment.',
      'National retailers now present. Median HHI rose 40% since 2000.',
      'Moderate rent pressure — favorable for new concepts vs. Midtown.',
    ],
  },
];

/**
 * Vacancy rate interpretation (BRAIN-BOR-01)
 */
export function interpretVacancyRate(rate: number): { label: string; scoringImpact: string } {
  if (rate < 0.04) return { label: 'TIGHT_MARKET', scoringImpact: 'Landlord leverage maximum. Premium rents. High competition.' };
  if (rate < 0.06) return { label: 'HEALTHY_MARKET', scoringImpact: 'Balanced negotiating power. Viable for well-capitalized concepts.' };
  if (rate < 0.08) return { label: 'SOFT_MARKET', scoringImpact: 'Tenant leverage. Better deals available. Investigate structural causes.' };
  return { label: 'WEAK_MARKET', scoringImpact: 'High vacancy signals structural issues. Investigate before committing.' };
}


// BRAIN-COP-04: Decision state thresholds and labels
export const DECISION_STATES = {
  strong_go:          { min: 75, max: 100, label: 'STRONG GO',           color: '#27AE60' },
  go_with_refinements:{ min: 65, max: 74,  label: 'GO WITH REFINEMENTS', color: '#F39C12' },
  worth_testing:      { min: 50, max: 64,  label: 'WORTH TESTING',       color: '#E67E22' },
  high_risk:          { min: 40, max: 49,  label: 'HIGH RISK',           color: '#E74C3C' },
  do_not_pursue:      { min: 0,  max: 39,  label: 'DO NOT PURSUE',       color: '#C0392B' },
} as const;

export type DecisionStateKey = keyof typeof DECISION_STATES;

/**
 * Get the decision state for a given Fit IQ score.
 * BRAIN-COP-04: Used in scoring output and CoPilot narrative.
 */
export function getDecisionState(fitScore: number): {
  key: DecisionStateKey;
  label: string;
  color: string;
} {
  for (const [key, state] of Object.entries(DECISION_STATES)) {
    if (fitScore >= state.min && fitScore <= state.max) {
      return { key: key as DecisionStateKey, label: state.label, color: state.color };
    }
  }
  // Fallback
  return { key: 'do_not_pursue', label: 'DO NOT PURSUE', color: '#C0392B' };
}
