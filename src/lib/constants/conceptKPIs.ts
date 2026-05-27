/**
 * RE² Concept KPI Framework — v1.0 (March 29, 2026)
 *
 * Single source of truth for per-concept scoring, revenue modeling, and AI coaching.
 *
 * Key principle: different concepts run on fundamentally different economic engines.
 *   - Coffee/QSR live on transaction volume.
 *   - Fitness lives on monthly recurring revenue (members × fee).
 *   - Medical/personal services live on slot utilization.
 *   - Bars live on peak-night concentration.
 *   - Florists live on event contracts + holiday spikes.
 *
 * This file drives:
 *   - Revenue formula routing in model/+page.svelte and financials/+page.svelte
 *   - Per-concept Vision IQ field weights in location/+page.svelte
 *   - Per-concept Location IQ signal weights in /api/location-iq
 *   - AI coaching benchmarks (min viable, breakeven, strong thresholds)
 *   - visionFlags validation (ideal check ranges, kill factors)
 *
 * DO NOT duplicate these definitions elsewhere. Import from here.
 * VERSION HISTORY: v1.0 = research + first principles. v2.0 = calibrated from real client outcomes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type RevenueModelType =
  | 'volume'        // ticket × daily_transactions × operating_days × 52
  | 'mrr'           // members × monthly_fee × 12
  | 'utilization'   // slots × fill_rate × avg_fee × 52
  | 'peak_weighted' // (weekday_vol×5 + weekend_vol×2) × avg_ticket × 52
  | 'sqft'          // revenue_per_sqft × total_sqft (retail)
  | 'event_plus';   // base_walk_in_revenue + event_contracts + seasonal_multiplier

/** KPI scoring band — floor/viable/target/strong for each primary and secondary metric */
export interface KPIBand {
  floor:  number;  // below this = serious concern, coaching required
  viable: number;  // minimum to be considered survivable in NYC
  target: number;  // healthy middle of the range
  strong: number;  // above this = strong signal, validate assumptions are real
}

/** Vision IQ field weights per concept. Must sum to 100. */
export interface VisionWeights {
  bizType:          number;  // business type fit signal
  avgCheck:         number;  // ticket / price alignment
  differentiators:  number;  // differentiation strength
  hours:            number;  // hours alignment with concept peak demand
  demographic:      number;  // target demographic alignment
}

/**
 * Vision IQ signal weights per concept — used in location/+page.svelte Vision IQ computation.
 * These weight how much each LOCATION SIGNAL contributes to the Vision IQ score for this concept.
 * Different from VisionWeights (which weights the Vision questionnaire fields).
 * Must sum to 1.0.
 *
 * Source: migrated from VISION_ARCHETYPES inline object in location/+page.svelte (#20 fix).
 * UX thread will replace inline VISION_ARCHETYPES with an import of this field.
 */
export interface VisionSignalWeights {
  footTrafficW:  number;  // impulse concepts weight this high (coffee 0.35, QSR 0.35)
  competitionW:  number;  // fitness + personal services weight comp highest (0.30)
  demographicsW: number;  // destination + medical weight demographics most (0.30–0.40)
  vibrancyW:     number;  // bar/nightlife + coworking weight vibrancy highest (0.30)
}

/** Location IQ signal weights per concept. Must sum to 1.0. */
export interface LocationWeights {
  footTraffic:   number;
  transit:       number;
  competition:   number;
  demographics:  number;
  safety:        number;
  vibrancy:      number;
}

/** Revenue model parameters — defaults used when user hasn't provided inputs */
export interface RevenueModelParams {
  // Volume / event_plus / peak_weighted
  defaultAvgTicket?:             number;
  defaultDailyTransactions?:     number;
  defaultOperatingDaysPerWeek?:  number;

  // MRR model (fitness_studio)
  defaultMembers?:     number;
  defaultMonthlyFee?:  number;

  // Utilization model (medical_office, personal_services)
  defaultWeeklySlots?:  number;
  defaultFillRate?:     number;  // 0–1
  defaultAvgFee?:       number;

  // Peak-weighted modifier (bar_nightlife)
  weekendMultiplier?:  number;   // weekend covers ÷ weekday average (typically 3–4×)
  peakDaysPerWeek?:    number;   // typically 2 (Fri + Sat)

  // Event-plus modifiers (florist)
  baseWalkInShare?:    number;   // 0–1, walk-in as share of annual revenue
  holidayMultiplier?:  number;   // peak week revenue ÷ average week

  // COGS and labor defaults (differ significantly by revenue model type)
  defaultCogsPercent?:   number;
  defaultLaborPercent?:  number;
}

/** Full concept KPI definition */
export interface ConceptKPI {
  label:         string;
  revenueModel:  RevenueModelType;
  revenueParams: RevenueModelParams;

  primaryKPI: {
    label:  string;
    unit:   string;
    band:   KPIBand;
    invertedBand?: boolean;  // true when lower = better (e.g., churn rate)
  };
  secondaryKPI: {
    label:  string;
    unit:   string;
    band:   KPIBand;
    invertedBand?: boolean;
  };

  /** NYC-calibrated annual revenue thresholds */
  coaching: {
    minViableAnnualRevenue:  number;
    breakEvenAnnualRevenue:  number;
    strongAnnualRevenue:     number;
  };

  visionWeights:        VisionWeights;
  locationWeights:      LocationWeights;
  /** Vision IQ signal weights for location-side computation. Replaces VISION_ARCHETYPES inline object. */
  visionSignalWeights:  VisionSignalWeights;

  /** Used by visionFlags to detect absurd pricing inputs */
  idealCheckRange:  [number, number];

  /** Used by visionFlags to detect hours misalignment */
  peakHours: 'morning' | 'all_day' | 'evening';

  /** Household income range this concept typically serves */
  idealIncomeRange: [number, number];

  /**
   * Typical NYC build-out floor area (sq ft). Used for rent PSF calculations and
   * space requirement assessments. Source: migrated from CONCEPT_SQFT_DEFAULTS in
   * scoring.ts (#34 fix). Delete CONCEPT_SQFT_DEFAULTS from scoring.ts once UX thread confirms.
   */
  defaultSqFt: number;

  /**
   * Estimated NYC build-out cost range (USD). Used in financial projections.
   * Source: NYC commercial construction cost data 2023-2024.
   * (#21 fix: adding per-concept buildout costs).
   */
  buildoutCost: { low: number; high: number };

  /** Maximum rent as % of projected annual revenue before it's a kill factor */
  maxRentPercent: number;

  /** Fed directly to AI coaching layer */
  killFactors: string[];

  /**
   * Business Case calculation parameters — Brain Thread Build v2 (April 2026)
   * 14 fields required for every formula on the Business Case page.
   * Source: Brain Build Instructions v2, validated against IBISWorld / NRA / IHRSA.
   * RULE: These are calibrated starting points. Update with real client outcomes.
   */
  businessCase: BusinessCaseParams;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS CASE PARAMS  (14 new fields — added April 2026, Brain Thread Build v2)
// ─────────────────────────────────────────────────────────────────────────────

export interface BusinessCaseParams {
  /** Total construction/renovation cost ($). Midpoint estimate for single-unit NYC. */
  buildoutCost: number;
  /** Fixtures, machines, POS, furniture cost ($). */
  equipmentCost: number;
  /** Opening-day stock/inventory ($). */
  initialInventory: number;
  /** DOB + Health Dept + SLA + legal/filing fees ($). */
  permitsCost: number;
  /** Hours the business is open per day. Drives hourly breakeven and foot-traffic derivation. */
  operatingHoursPerDay: number;
  /**
   * Fraction of hourly passing foot traffic that converts to a transaction.
   * Destination concepts (fitness, medical) use lower rates; impulse concepts (coffee, QSR) higher.
   * Range: 0.01–0.10.  CALIBRATE with real data when available.
   */
  captureRate: number;
  /** Fraction of buildout cost recoverable if the business fails (landlord buyback, fixture resale). */
  salvageRate: number;
  /** SDE valuation multiple at exit. Midpoint of concept-specific range. */
  valuationMultiple: number;
  /**
   * Annual reinvestment % of revenue (decreasing — early years fund growth, later years = mature).
   * Fitness is higher (equipment replacement). Conservative across the board.
   */
  reinvestmentRate: { y1: number; y2: number; y3: number; y4: number; y5: number };
  /** Buildout depreciation period (years). Drives D&A line and SDE add-back at exit. */
  usefulLifeYears: number;
  /** Label used in breakeven display: 'customers' / 'covers' / 'members' / 'clients' / 'patients' / etc. */
  footfallUnit: string;
  /** Typical NYC lease length (years). Drives personal-guarantee exposure in max-loss calc. */
  defaultLeaseTermYears: number;
  /** Annual rent escalation rate (NYC standard: 3%). */
  defaultRentEscalation: number;
  /**
   * Monthly revenue ramp factors M1–M24+.
   * Index 0 = Month 1. For months beyond array length, last value is repeated.
   * Converges to ~1.0 at steady state; growth >1.0 in mature phase.
   * APPROXIMATE — calibrate against real client cohort outcomes.
   */
  rampFactors: number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCEPT KPI DEFINITIONS  (13 concepts)
// ─────────────────────────────────────────────────────────────────────────────

export const CONCEPT_KPIS: Record<string, ConceptKPI> = {

  // ── SPECIALTY COFFEE ───────────────────────────────────────────────────────
  specialty_coffee: {
    label: 'Specialty Coffee',
    revenueModel: 'volume',
    revenueParams: {
      defaultAvgTicket:            8.75,
      defaultDailyTransactions:    250,
      defaultOperatingDaysPerWeek: 6,
      defaultCogsPercent:          0.28,
      defaultLaborPercent:         0.32,
    },
    primaryKPI: {
      label: 'Daily Transactions',
      unit:  'visits/day',
      band:  { floor: 60, viable: 100, target: 220, strong: 350 },
    },
    secondaryKPI: {
      label: 'Avg Ticket',
      unit:  '$/visit',
      band:  { floor: 4.50, viable: 5.50, target: 7.50, strong: 11 },
    },
    coaching: {
      minViableAnnualRevenue:  200_000,
      breakEvenAnnualRevenue:  320_000,
      strongAnnualRevenue:     550_000,
    },
    visionWeights:   { bizType: 20, avgCheck: 20, differentiators: 25, hours: 20, demographic: 15 },
    locationWeights: { footTraffic: 0.30, transit: 0.28, competition: 0.20, demographics: 0.12, safety: 0.04, vibrancy: 0.06 },
    visionSignalWeights: { footTrafficW: 0.35, competitionW: 0.25, demographicsW: 0.20, vibrancyW: 0.20 },
    idealCheckRange:  [3, 12],
    peakHours:        'morning',
    idealIncomeRange: [45_000, 150_000],
    defaultSqFt:  900,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 80_000, high: 180_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 10,
    killFactors: [
      'Rent > 10% of projected revenue',
      'No morning commuter or residential foot traffic nearby',
      'Chain competitor (Starbucks, Blue Bottle) within 100ft with no differentiation',
      'No distinguishing concept beyond "good coffee"',
    ],
    businessCase: {
      buildoutCost:          150_000,
      equipmentCost:          75_000,
      initialInventory:        8_000,
      permitsCost:            15_000,
      operatingHoursPerDay:       14,
      captureRate:             0.060,
      salvageRate:             0.150,
      valuationMultiple:         2.5,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:      'customers',
      defaultLeaseTermYears:      10,
      defaultRentEscalation:    0.03,
      // Fast ramp: impulse purchase, high repeat visit, established morning routine by M3
      rampFactors: [0.45,0.52,0.58,0.63,0.68,0.72,0.76,0.80,0.84,0.87,0.91,0.95,0.97,0.99,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.09,1.10],
    },
  },

  // ── BAKERY ─────────────────────────────────────────────────────────────────
  bakery: {
    label: 'Bakery',
    revenueModel: 'volume',
    revenueParams: {
      defaultAvgTicket:            12,
      defaultDailyTransactions:    160,
      defaultOperatingDaysPerWeek: 6,      // 6 days/week × 52 = 312 days → $598K
      defaultCogsPercent:          0.35,   // higher — food production
      defaultLaborPercent:         0.32,   // FIX-012: differentiated from fast_casual
    },
    primaryKPI: {
      label: 'Daily Transactions',
      unit:  'visits/day',
      band:  { floor: 60, viable: 100, target: 150, strong: 250 },
    },
    secondaryKPI: {
      label: 'Sell-Through Rate',
      unit:  '%/day',
      band:  { floor: 65, viable: 75, target: 85, strong: 95 },
    },
    coaching: {
      minViableAnnualRevenue:  250_000,
      breakEvenAnnualRevenue:  380_000,
      strongAnnualRevenue:     600_000,
    },
    visionWeights:   { bizType: 20, avgCheck: 15, differentiators: 30, hours: 20, demographic: 15 },
    locationWeights: { footTraffic: 0.28, transit: 0.18, competition: 0.15, demographics: 0.22, safety: 0.05, vibrancy: 0.12 },
    visionSignalWeights: { footTrafficW: 0.30, competitionW: 0.20, demographicsW: 0.25, vibrancyW: 0.25 },
    idealCheckRange:  [6, 20],
    peakHours:        'morning',
    idealIncomeRange: [45_000, 130_000],
    defaultSqFt:  700,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 60_000, high: 140_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 10,
    killFactors: [
      'Production waste consistently above 20% of COGS',
      'No weekend destination or neighborhood foot traffic',
      'Kitchen buildout underestimated (ventilation, hood, fire suppression)',
      'No distinguishing baked specialty — generic pastries drive low repeat visits',
    ],
    businessCase: {
      buildoutCost:          175_000,
      equipmentCost:          80_000,
      initialInventory:       12_000,
      permitsCost:            15_000,
      operatingHoursPerDay:       12,
      captureRate:             0.040,
      salvageRate:             0.120,
      valuationMultiple:         2.5,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:      'customers',
      defaultLeaseTermYears:      10,
      defaultRentEscalation:    0.03,
      // Fast ramp: slightly slower than coffee — production capacity constraint early
      rampFactors: [0.43,0.50,0.56,0.62,0.67,0.72,0.76,0.80,0.84,0.87,0.91,0.95,0.97,0.99,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.09,1.10],
    },
  },

  // ── FAST CASUAL ────────────────────────────────────────────────────────────
  fast_casual: {
    label: 'Fast Casual',
    revenueModel: 'volume',
    revenueParams: {
      defaultAvgTicket:            16,
      defaultDailyTransactions:    140,    // FIX-012: was 120, bump to break $599K collision with bakery
      defaultOperatingDaysPerWeek: 7,      // FIX-012: 7 days/week → $16 × 140 × 364 = $814K (≠ bakery $598K)
      defaultCogsPercent:          0.30,
      defaultLaborPercent:         0.32,   // FIX-012: standardized
    },
    primaryKPI: {
      label: 'Lunch Covers (11am–2pm)',
      unit:  'covers/day',
      band:  { floor: 40, viable: 70, target: 110, strong: 180 },
    },
    secondaryKPI: {
      label: 'Avg Ticket',
      unit:  '$/visit',
      band:  { floor: 9, viable: 12, target: 16, strong: 22 },
    },
    coaching: {
      minViableAnnualRevenue:  350_000,
      breakEvenAnnualRevenue:  480_000,
      strongAnnualRevenue:     750_000,
    },
    visionWeights:   { bizType: 25, avgCheck: 25, differentiators: 20, hours: 20, demographic: 10 },
    locationWeights: { footTraffic: 0.30, transit: 0.28, competition: 0.22, demographics: 0.10, safety: 0.04, vibrancy: 0.06 },
    visionSignalWeights: { footTrafficW: 0.30, competitionW: 0.25, demographicsW: 0.25, vibrancyW: 0.20 },
    idealCheckRange:  [8, 24],
    peakHours:        'all_day',
    idealIncomeRange: [40_000, 120_000],
    defaultSqFt:  1200,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 100_000, high: 220_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 10,
    killFactors: [
      'Prep time exceeds 8 min average — queue builds, covers lost in lunch window',
      'High competition density with identical cuisine within 0.3mi',
      'No dinner pull: unit economics depend entirely on a 3-hour lunch window',
      'Daytime worker density under 5,000 within 0.5mi radius',
    ],
    businessCase: {
      buildoutCost:          200_000,
      equipmentCost:          90_000,
      initialInventory:       15_000,
      permitsCost:            18_000,
      operatingHoursPerDay:       14,
      captureRate:             0.070,
      salvageRate:             0.150,
      valuationMultiple:         3.0,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:      'customers',
      defaultLeaseTermYears:      10,
      defaultRentEscalation:    0.03,
      // Fast ramp: lunch-crowd habituation rapid, word-of-mouth by M2
      rampFactors: [0.45,0.52,0.58,0.63,0.68,0.72,0.76,0.80,0.84,0.87,0.91,0.95,0.97,0.99,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.09,1.10],
    },
  },

  // ── FULL-SERVICE RESTAURANT ────────────────────────────────────────────────
  full_service_restaurant: {
    label: 'Full-Service Restaurant',
    revenueModel: 'volume',
    revenueParams: {
      defaultAvgTicket:            52,
      defaultDailyTransactions:    55,    // covers/day
      defaultOperatingDaysPerWeek: 6,
      defaultCogsPercent:          0.30,
      defaultLaborPercent:         0.33,
    },
    primaryKPI: {
      label: 'Weekly Covers',
      unit:  'covers/week',
      band:  { floor: 150, viable: 280, target: 550, strong: 900 },
    },
    secondaryKPI: {
      label: 'Table Turns / Night',
      unit:  'turns/night',
      band:  { floor: 1.2, viable: 1.6, target: 2.3, strong: 2.9 },
    },
    coaching: {
      minViableAnnualRevenue:  600_000,
      breakEvenAnnualRevenue:  850_000,
      strongAnnualRevenue:     1_400_000,
    },
    visionWeights:   { bizType: 20, avgCheck: 25, differentiators: 25, hours: 15, demographic: 15 },
    locationWeights: { footTraffic: 0.18, transit: 0.20, competition: 0.20, demographics: 0.22, safety: 0.10, vibrancy: 0.10 },
    visionSignalWeights: { footTrafficW: 0.20, competitionW: 0.25, demographicsW: 0.30, vibrancyW: 0.25 },
    idealCheckRange:  [20, 100],
    peakHours:        'evening',
    idealIncomeRange: [65_000, 200_000],
    defaultSqFt:  2000,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 250_000, high: 500_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 8,
    killFactors: [
      'Rent above 8% of projected revenue',
      'No liquor license in a competitive market (revenue ceiling ~35–40% lower)',
      'No reservation strategy — table utilization will underperform at scale',
      'Ticket price misaligned with neighborhood median income',
    ],
    businessCase: {
      buildoutCost:          350_000,
      equipmentCost:         120_000,
      initialInventory:       25_000,
      permitsCost:            30_000,
      operatingHoursPerDay:       10,
      captureRate:             0.030,
      salvageRate:             0.100,
      valuationMultiple:         3.0,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:          'covers',
      defaultLeaseTermYears:      10,
      defaultRentEscalation:    0.03,
      // Medium ramp: destination dining needs press/reviews/word-of-mouth (M6-M12 breakout)
      rampFactors: [0.35,0.42,0.50,0.57,0.63,0.68,0.73,0.78,0.82,0.86,0.90,0.93,0.95,0.97,0.98,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.10],
    },
  },

  // ── QSR ────────────────────────────────────────────────────────────────────
  qsr: {
    label: 'QSR',
    revenueModel: 'volume',
    revenueParams: {
      defaultAvgTicket:            10,
      defaultDailyTransactions:    220,
      defaultOperatingDaysPerWeek: 7,
      defaultCogsPercent:          0.28,
      defaultLaborPercent:         0.25,
    },
    primaryKPI: {
      label: 'Transactions / Hour',
      unit:  'txns/hr',
      band:  { floor: 20, viable: 35, target: 55, strong: 80 },
    },
    secondaryKPI: {
      label: 'Avg Ticket',
      unit:  '$/visit',
      band:  { floor: 6, viable: 8, target: 11, strong: 15 },
    },
    coaching: {
      minViableAnnualRevenue:  450_000,
      breakEvenAnnualRevenue:  580_000,
      strongAnnualRevenue:     900_000,
    },
    visionWeights:   { bizType: 30, avgCheck: 25, differentiators: 15, hours: 20, demographic: 10 },
    locationWeights: { footTraffic: 0.32, transit: 0.22, competition: 0.25, demographics: 0.08, safety: 0.05, vibrancy: 0.08 },
    visionSignalWeights: { footTrafficW: 0.35, competitionW: 0.25, demographicsW: 0.15, vibrancyW: 0.25 },
    idealCheckRange:  [5, 18],
    peakHours:        'all_day',
    idealIncomeRange: [28_000, 100_000],
    defaultSqFt:  1000,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 80_000, high: 180_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 8,
    killFactors: [
      'Premium-market rent — QSR margins cannot support it',
      'Direct chain competitor (Chipotle, Shake Shack) within 200ft',
      'No drive-through or delivery integration in a car-dependent trade area',
    ],
    businessCase: {
      buildoutCost:          200_000,
      equipmentCost:          90_000,
      initialInventory:       15_000,
      permitsCost:            18_000,
      operatingHoursPerDay:       14,
      captureRate:             0.070,
      salvageRate:             0.150,
      valuationMultiple:         3.0,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:      'customers',
      defaultLeaseTermYears:      10,
      defaultRentEscalation:    0.03,
      // Fast ramp: highest volume, fastest throughput habit formation
      rampFactors: [0.47,0.54,0.60,0.65,0.70,0.74,0.78,0.82,0.86,0.89,0.92,0.95,0.97,0.99,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.09,1.10],
    },
  },

  // ── BAR / NIGHTLIFE ────────────────────────────────────────────────────────
  bar_nightlife: {
    label: 'Bar / Nightlife',
    revenueModel: 'peak_weighted',
    revenueParams: {
      defaultAvgTicket:            22,
      defaultDailyTransactions:    45,    // weekday average; weekend = 3–4×
      defaultOperatingDaysPerWeek: 6,
      weekendMultiplier:           3.5,   // Fri/Sat covers ÷ weekday average
      peakDaysPerWeek:             2,
      defaultCogsPercent:          0.22,  // alcohol margin is higher
      defaultLaborPercent:         0.30,
    },
    primaryKPI: {
      label: 'Weekend Revenue Share',
      unit:  '% of weekly',
      band:  { floor: 40, viable: 50, target: 60, strong: 72 },
    },
    secondaryKPI: {
      label: 'Avg Spend / Head',
      unit:  '$/person',
      band:  { floor: 14, viable: 18, target: 28, strong: 50 },
    },
    coaching: {
      minViableAnnualRevenue:  400_000,
      breakEvenAnnualRevenue:  560_000,
      strongAnnualRevenue:     950_000,
    },
    visionWeights:   { bizType: 20, avgCheck: 22, differentiators: 18, hours: 28, demographic: 12 },
    locationWeights: { footTraffic: 0.18, transit: 0.20, competition: 0.18, demographics: 0.14, safety: 0.18, vibrancy: 0.12 },
    visionSignalWeights: { footTrafficW: 0.20, competitionW: 0.25, demographicsW: 0.25, vibrancyW: 0.30 },
    idealCheckRange:  [10, 60],
    peakHours:        'evening',
    idealIncomeRange: [50_000, 160_000],
    defaultSqFt:  1600,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 150_000, high: 350_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 10,
    killFactors: [
      'Liquor license not started — 6–18 month NYC timeline, zero bar revenue during wait',
      'Dense residential directly above (noise complaints → early closure orders)',
      'No food program to extend dwell time and per-head spend',
      'Weeknight fixed costs identical to weekend but weeknight revenue is <25% of weekly total',
    ],
    businessCase: {
      buildoutCost:          250_000,
      equipmentCost:          60_000,
      initialInventory:       20_000,
      permitsCost:            35_000,   // SLA adds significant cost + time
      operatingHoursPerDay:        8,
      captureRate:             0.040,
      salvageRate:             0.120,
      valuationMultiple:         2.75,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:          'guests',
      defaultLeaseTermYears:      10,
      defaultRentEscalation:    0.03,
      // Medium ramp: nightlife reputation builds through social proof, slower than food
      rampFactors: [0.35,0.42,0.50,0.57,0.63,0.68,0.73,0.78,0.82,0.86,0.90,0.93,0.95,0.97,0.98,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.10],
    },
  },

  // ── JUICE BAR ──────────────────────────────────────────────────────────────
  juice_bar: {
    label: 'Juice Bar',
    revenueModel: 'volume',
    revenueParams: {
      defaultAvgTicket:            13,
      defaultDailyTransactions:    110,
      defaultOperatingDaysPerWeek: 6,
      defaultCogsPercent:          0.32,
      defaultLaborPercent:         0.30,
    },
    primaryKPI: {
      label: 'Daily Transactions',
      unit:  'visits/day',
      band:  { floor: 50, viable: 80, target: 110, strong: 180 },
    },
    secondaryKPI: {
      label: 'Avg Ticket',
      unit:  '$/visit',
      band:  { floor: 7, viable: 9, target: 13, strong: 18 },
    },
    coaching: {
      minViableAnnualRevenue:  220_000,
      breakEvenAnnualRevenue:  320_000,
      strongAnnualRevenue:     520_000,
    },
    visionWeights:   { bizType: 20, avgCheck: 22, differentiators: 25, hours: 18, demographic: 15 },
    locationWeights: { footTraffic: 0.26, transit: 0.22, competition: 0.18, demographics: 0.22, safety: 0.05, vibrancy: 0.07 },
    visionSignalWeights: { footTrafficW: 0.30, competitionW: 0.25, demographicsW: 0.25, vibrancyW: 0.20 },
    idealCheckRange:  [7, 20],
    peakHours:        'morning',
    idealIncomeRange: [55_000, 160_000],
    defaultSqFt:  700,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 60_000, high: 130_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 12,
    killFactors: [
      'Location in sub-$60K median income area — price point will not hold',
      'Established Juice Press, Pressed Juicery, or Daily Harvest within 200ft',
      'No functional/health differentiation beyond "fresh juice"',
    ],
    businessCase: {
      buildoutCost:          120_000,
      equipmentCost:          50_000,
      initialInventory:       10_000,
      permitsCost:            12_000,
      operatingHoursPerDay:       12,
      captureRate:             0.050,
      salvageRate:             0.150,
      valuationMultiple:         2.0,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:      'customers',
      defaultLeaseTermYears:      10,
      defaultRentEscalation:    0.03,
      // Fast ramp: health-conscious routine similar to coffee
      rampFactors: [0.43,0.50,0.56,0.62,0.67,0.72,0.76,0.80,0.84,0.87,0.91,0.95,0.97,0.99,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.09,1.10],
    },
  },

  // ── WELLNESS BEVERAGE ──────────────────────────────────────────────────────
  wellness_beverage: {
    label: 'Wellness Beverage',
    revenueModel: 'volume',
    revenueParams: {
      defaultAvgTicket:            11,
      defaultDailyTransactions:    130,
      defaultOperatingDaysPerWeek: 6,
      defaultCogsPercent:          0.30,
      defaultLaborPercent:         0.30,
    },
    primaryKPI: {
      label: 'Daily Transactions',
      unit:  'visits/day',
      band:  { floor: 60, viable: 90, target: 130, strong: 200 },
    },
    secondaryKPI: {
      label: 'Avg Ticket',
      unit:  '$/visit',
      band:  { floor: 7, viable: 9, target: 12, strong: 16 },
    },
    coaching: {
      minViableAnnualRevenue:  220_000,
      breakEvenAnnualRevenue:  300_000,
      strongAnnualRevenue:     480_000,
    },
    visionWeights:   { bizType: 20, avgCheck: 22, differentiators: 25, hours: 18, demographic: 15 },
    locationWeights: { footTraffic: 0.24, transit: 0.22, competition: 0.18, demographics: 0.24, safety: 0.05, vibrancy: 0.07 },
    visionSignalWeights: { footTrafficW: 0.25, competitionW: 0.25, demographicsW: 0.30, vibrancyW: 0.20 },
    idealCheckRange:  [6, 18],
    peakHours:        'morning',
    idealIncomeRange: [60_000, 180_000],
    defaultSqFt:  800,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 70_000, high: 150_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 12,
    killFactors: [
      'Trend-dependent concept with no habitual repeat-visit hook',
      'Pricing above $15 in non-premium demographic',
      'Limited daily occasion fit — wellness is habitual only when tied to daily routine',
    ],
    businessCase: {
      buildoutCost:          130_000,
      equipmentCost:          55_000,
      initialInventory:       10_000,
      permitsCost:            12_000,
      operatingHoursPerDay:       12,
      captureRate:             0.050,
      salvageRate:             0.150,
      valuationMultiple:         2.0,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:      'customers',
      defaultLeaseTermYears:      10,
      defaultRentEscalation:    0.03,
      // Fast ramp: impulse + routine similar to coffee, slight drag on trend adoption
      rampFactors: [0.42,0.49,0.55,0.61,0.66,0.71,0.75,0.79,0.83,0.87,0.90,0.94,0.97,0.99,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.09,1.10],
    },
  },

  // ── RETAIL ─────────────────────────────────────────────────────────────────
  retail: {
    label: 'Retail',
    revenueModel: 'sqft',
    revenueParams: {
      defaultAvgTicket:            65,
      defaultDailyTransactions:    35,
      defaultOperatingDaysPerWeek: 6,
      defaultCogsPercent:          0.40,
      defaultLaborPercent:         0.22,
    },
    primaryKPI: {
      label: 'Revenue per Sq Ft / Year',
      unit:  '$/sqft/yr',
      band:  { floor: 120, viable: 200, target: 380, strong: 620 },
    },
    secondaryKPI: {
      label: 'Avg Order Value',
      unit:  '$/transaction',
      band:  { floor: 25, viable: 40, target: 70, strong: 140 },
    },
    coaching: {
      minViableAnnualRevenue:  300_000,
      breakEvenAnnualRevenue:  420_000,
      strongAnnualRevenue:     750_000,
    },
    visionWeights:   { bizType: 20, avgCheck: 22, differentiators: 20, hours: 10, demographic: 28 },
    locationWeights: { footTraffic: 0.30, transit: 0.18, competition: 0.18, demographics: 0.22, safety: 0.06, vibrancy: 0.06 },
    visionSignalWeights: { footTrafficW: 0.30, competitionW: 0.20, demographicsW: 0.30, vibrancyW: 0.20 },
    idealCheckRange:  [15, 200],
    peakHours:        'all_day',
    idealIncomeRange: [50_000, 160_000],
    defaultSqFt:  1400,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 80_000, high: 200_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 10,
    killFactors: [
      'E-commerce dominates the product category (apparel, consumer electronics)',
      'Anchor store closes in same block — foot traffic collapse is immediate',
      'No omnichannel presence — pure brick-and-mortar in 2026 is high risk',
      'Product price point misaligned with neighborhood income',
    ],
    businessCase: {
      buildoutCost:          100_000,
      equipmentCost:          40_000,
      initialInventory:       40_000,
      permitsCost:            10_000,
      operatingHoursPerDay:       10,
      captureRate:             0.050,
      salvageRate:             0.200,  // fixtures + inventory more recoverable
      valuationMultiple:         2.0,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:        'shoppers',
      defaultLeaseTermYears:       5,
      defaultRentEscalation:    0.03,
      // Medium ramp: product discovery + repeat purchase takes 3-6 months
      rampFactors: [0.38,0.45,0.52,0.58,0.63,0.68,0.73,0.77,0.81,0.85,0.89,0.93,0.95,0.97,0.99,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.10],
    },
  },

  // ── FITNESS STUDIO ─────────────────────────────────────────────────────────
  fitness_studio: {
    label: 'Fitness Studio',
    revenueModel: 'mrr',
    revenueParams: {
      defaultMembers:     150,
      defaultMonthlyFee:  120,
      defaultCogsPercent:  0.08,   // minimal COGS — no physical product
      defaultLaborPercent: 0.40,   // instructor cost is the main variable
    },
    primaryKPI: {
      label: 'Active Members',
      unit:  'members',
      band:  { floor: 60, viable: 100, target: 180, strong: 350 },
    },
    secondaryKPI: {
      label: 'Monthly Churn Rate',
      unit:  '%/month',
      band:  { floor: 10, viable: 8, target: 5, strong: 2.5 },
      invertedBand: true,  // lower = better
    },
    coaching: {
      minViableAnnualRevenue:  144_000,  // 100 members × $120/mo × 12
      breakEvenAnnualRevenue:  216_000,  // 150 members × $120/mo × 12
      strongAnnualRevenue:     420_000,  // 280 members × $125/mo × 12
    },
    visionWeights:   { bizType: 20, avgCheck: 25, differentiators: 15, hours: 20, demographic: 20 },
    locationWeights: { footTraffic: 0.16, transit: 0.15, competition: 0.28, demographics: 0.28, safety: 0.07, vibrancy: 0.06 },
    visionSignalWeights: { footTrafficW: 0.20, competitionW: 0.30, demographicsW: 0.30, vibrancyW: 0.20 },
    idealCheckRange:  [50, 350],    // monthly membership fee range
    peakHours:        'morning',
    idealIncomeRange: [55_000, 180_000],
    defaultSqFt:  2500,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 150_000, high: 350_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 15,
    killFactors: [
      'Studio sqft cannot support member target at the chosen format (class size × schedule)',
      'No parking within 3 blocks — fitness requires gear, transit-only locations are a barrier',
      'High churn early (>8%/mo) — new member acquisition cannot outpace losses',
      'Long lease signed before validating member demand at the chosen price point',
    ],
    businessCase: {
      buildoutCost:          200_000,
      equipmentCost:         100_000,
      initialInventory:        5_000,
      permitsCost:            12_000,
      operatingHoursPerDay:       16,
      captureRate:             0.020,  // destination concept — referral + proximity driven
      salvageRate:             0.180,  // equipment has good resale
      valuationMultiple:         4.0,  // MRR premium commands higher multiple
      reinvestmentRate:  { y1: 0.07, y2: 0.05, y3: 0.04, y4: 0.03, y5: 0.02 },  // equipment replacement higher
      usefulLifeYears:             7,  // equipment-heavy = faster depreciation
      footfallUnit:         'members',
      defaultLeaseTermYears:       5,
      defaultRentEscalation:    0.03,
      // Slow ramp: member sign-up and churn stabilization takes 12-18 months
      rampFactors: [0.30,0.35,0.38,0.42,0.46,0.50,0.55,0.60,0.65,0.70,0.75,0.80,0.85,0.88,0.92,0.95,0.97,0.99,1.00,1.01,1.02,1.03,1.05,1.08],
    },
  },

  // ── PERSONAL SERVICES ──────────────────────────────────────────────────────
  personal_services: {
    label: 'Personal Services',
    revenueModel: 'utilization',
    revenueParams: {
      defaultWeeklySlots:  90,     // e.g., 5 chairs × 18 appts/week
      defaultFillRate:     0.72,
      defaultAvgFee:       85,
      defaultCogsPercent:  0.12,
      defaultLaborPercent: 0.42,   // commission-based — main variable cost
    },
    primaryKPI: {
      label: 'Station Utilization Rate',
      unit:  '%',
      band:  { floor: 45, viable: 60, target: 75, strong: 90 },
    },
    secondaryKPI: {
      label: 'Client Rebooking Rate',
      unit:  '%',
      band:  { floor: 30, viable: 45, target: 65, strong: 80 },
    },
    coaching: {
      minViableAnnualRevenue:  180_000,
      breakEvenAnnualRevenue:  260_000,
      strongAnnualRevenue:     480_000,
    },
    visionWeights:   { bizType: 20, avgCheck: 28, differentiators: 22, hours: 15, demographic: 15 },
    locationWeights: { footTraffic: 0.20, transit: 0.18, competition: 0.18, demographics: 0.28, safety: 0.08, vibrancy: 0.08 },
    visionSignalWeights: { footTrafficW: 0.20, competitionW: 0.30, demographicsW: 0.25, vibrancyW: 0.25 },
    idealCheckRange:  [40, 300],
    peakHours:        'all_day',
    idealIncomeRange: [50_000, 160_000],
    defaultSqFt:  800,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 50_000, high: 120_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 12,
    killFactors: [
      'Staff turnover — stylist/therapist book of business walks out with them',
      'No online booking system — missed appointments = wasted utilization',
      'Location demographic does not support service ticket price',
      'Too many stations relative to anticipated demand — utilization floor impossible',
    ],
    businessCase: {
      buildoutCost:           80_000,
      equipmentCost:          30_000,
      initialInventory:        5_000,
      permitsCost:            10_000,
      operatingHoursPerDay:       10,
      captureRate:             0.030,
      salvageRate:             0.200,  // chairs + equipment portable
      valuationMultiple:         2.5,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:         'clients',
      defaultLeaseTermYears:       5,
      defaultRentEscalation:    0.03,
      // Medium ramp: client book transfers and discovery take 4-8 months
      rampFactors: [0.38,0.45,0.52,0.58,0.63,0.68,0.73,0.77,0.81,0.85,0.89,0.93,0.95,0.97,0.99,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.10],
    },
  },

  // ── MEDICAL OFFICE ─────────────────────────────────────────────────────────
  medical_office: {
    label: 'Medical Office',
    revenueModel: 'utilization',
    revenueParams: {
      defaultWeeklySlots:  60,     // ~12 appts/day × 5 days
      defaultFillRate:     0.78,
      defaultAvgFee:       220,
      defaultCogsPercent:  0.15,
      defaultLaborPercent: 0.38,
    },
    primaryKPI: {
      label: 'Appointment Fill Rate',
      unit:  '%',
      band:  { floor: 50, viable: 65, target: 80, strong: 92 },
    },
    secondaryKPI: {
      label: 'Avg Revenue per Visit',
      unit:  '$/visit',
      band:  { floor: 100, viable: 150, target: 250, strong: 500 },
    },
    coaching: {
      minViableAnnualRevenue:  350_000,
      breakEvenAnnualRevenue:  500_000,
      strongAnnualRevenue:     900_000,
    },
    visionWeights:   { bizType: 20, avgCheck: 15, differentiators: 10, hours: 15, demographic: 40 },
    locationWeights: { footTraffic: 0.10, transit: 0.15, competition: 0.15, demographics: 0.40, safety: 0.10, vibrancy: 0.10 },
    visionSignalWeights: { footTrafficW: 0.15, competitionW: 0.30, demographicsW: 0.30, vibrancyW: 0.25 },
    idealCheckRange:  [80, 700],
    peakHours:        'all_day',
    idealIncomeRange: [45_000, 200_000],
    defaultSqFt:  1200,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 100_000, high: 250_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 10,
    killFactors: [
      'Insurance credentialing not started before lease signed (NYC: 60–120 day wait, zero revenue)',
      'Lease start before medical buildout is complete (plumbing, ADA, exam room specs, fire code)',
      'No-show rate above 15% — no reminder system = wasted appointment slots',
      'Payer mix weighted to low-reimbursement plans without volume to compensate',
    ],
    businessCase: {
      buildoutCost:          300_000,
      equipmentCost:         150_000,
      initialInventory:       20_000,
      permitsCost:            25_000,
      operatingHoursPerDay:        8,
      captureRate:             0.010,  // referral-based, not foot-traffic driven
      salvageRate:             0.100,  // specialized buildout = low recovery
      valuationMultiple:         4.5,  // strong multiple for established patient base
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:        'patients',
      defaultLeaseTermYears:      10,
      defaultRentEscalation:    0.03,
      // Very slow ramp: credentialing, patient panel building, insurance billing takes 18-24mo
      rampFactors: [0.20,0.25,0.30,0.35,0.40,0.45,0.50,0.55,0.60,0.65,0.70,0.75,0.79,0.83,0.87,0.91,0.94,0.97,0.99,1.00,1.01,1.02,1.03,1.05],
    },
  },

  // ── FLORIST ────────────────────────────────────────────────────────────────
  florist: {
    label: 'Florist',
    revenueModel: 'event_plus',
    revenueParams: {
      defaultAvgTicket:            68,
      defaultDailyTransactions:    18,
      defaultOperatingDaysPerWeek: 6,
      baseWalkInShare:             0.55,  // 55% walk-in; 45% events/delivery
      holidayMultiplier:           6.0,   // Valentine's and Mother's Day = 6× avg week
      defaultCogsPercent:          0.45,  // perishables are expensive
      defaultLaborPercent:         0.28,
    },
    primaryKPI: {
      label: 'Event Contract Revenue Share',
      unit:  '% of annual',
      band:  { floor: 15, viable: 25, target: 45, strong: 60 },
    },
    secondaryKPI: {
      label: 'Avg Walk-In Transaction',
      unit:  '$/visit',
      band:  { floor: 25, viable: 40, target: 70, strong: 120 },
    },
    coaching: {
      minViableAnnualRevenue:  180_000,
      breakEvenAnnualRevenue:  260_000,
      strongAnnualRevenue:     450_000,
    },
    visionWeights:   { bizType: 25, avgCheck: 18, differentiators: 25, hours: 12, demographic: 20 },
    locationWeights: { footTraffic: 0.22, transit: 0.14, competition: 0.14, demographics: 0.20, safety: 0.08, vibrancy: 0.22 },
    visionSignalWeights: { footTrafficW: 0.30, competitionW: 0.20, demographicsW: 0.30, vibrancyW: 0.20 },
    idealCheckRange:  [30, 250],
    peakHours:        'all_day',
    idealIncomeRange: [50_000, 160_000],
    defaultSqFt:  600,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 30_000, high: 80_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 12,
    killFactors: [
      'Opening October–January — misses spring/wedding season AND Valentine\'s/Mother\'s Day entirely',
      'No event pipeline within 6 months — pure walk-in margins are thin',
      'Perishable waste above 20% of COGS consistently',
      'No delivery infrastructure in a delivery-driven NYC market',
    ],
    businessCase: {
      buildoutCost:           60_000,
      equipmentCost:          20_000,
      initialInventory:       15_000,
      permitsCost:             8_000,
      operatingHoursPerDay:       10,
      captureRate:             0.040,
      salvageRate:             0.250,  // coolers, fixtures more portable
      valuationMultiple:         2.0,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:      'customers',
      defaultLeaseTermYears:       5,
      defaultRentEscalation:    0.03,
      // Medium ramp: walk-in builds fast but event pipeline takes 6-12 months to fill
      rampFactors: [0.38,0.45,0.52,0.58,0.63,0.68,0.73,0.77,0.81,0.85,0.89,0.93,0.95,0.97,0.99,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.10],
    },
  },

  // ── WELLNESS SPA ────────────────────────────────────────────────────────────
  wellness_spa: {
    label: 'Wellness Spa',
    revenueModel: 'utilization',
    revenueParams: {
      defaultWeeklySlots:  35,     // 3–4 treatment rooms × ~10 appts/week each
      defaultFillRate:     0.68,
      defaultAvgFee:       145,    // facial/massage/treatment avg
      defaultCogsPercent:  0.14,   // products, linens, supplies
      defaultLaborPercent: 0.44,   // esthetician/therapist commission
    },
    primaryKPI: {
      label: 'Treatment Room Utilization',
      unit:  '%',
      band:  { floor: 40, viable: 58, target: 72, strong: 88 },
    },
    secondaryKPI: {
      label: 'Avg Treatment Fee',
      unit:  '$/appt',
      band:  { floor: 75, viable: 100, target: 145, strong: 250 },
    },
    coaching: {
      minViableAnnualRevenue:  175_000,
      breakEvenAnnualRevenue:  280_000,
      strongAnnualRevenue:     500_000,
    },
    visionWeights:   { bizType: 15, avgCheck: 30, differentiators: 20, hours: 10, demographic: 25 },
    locationWeights: { footTraffic: 0.08, transit: 0.18, competition: 0.22, demographics: 0.38, safety: 0.08, vibrancy: 0.06 },
    visionSignalWeights: { footTrafficW: 0.10, competitionW: 0.30, demographicsW: 0.35, vibrancyW: 0.25 },
    idealCheckRange:  [75, 300],
    peakHours:        'all_day',
    idealIncomeRange: [80_000, 300_000],
    defaultSqFt:  1200,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 120_000, high: 280_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 12,
    killFactors: [
      'No licensed estheticians/therapists on payroll — contractor model means zero retention',
      'Buildout underestimated: plumbing for wet rooms, soundproofing, HVAC for treatment rooms',
      'No membership program — single-visit-only clients have 25% rebooking vs 65% for members',
      'Neighborhood median income below $80K — $145 avg treatment price will not hold',
    ],
    businessCase: {
      buildoutCost:          180_000,
      equipmentCost:          60_000,
      initialInventory:        8_000,
      permitsCost:            15_000,
      operatingHoursPerDay:       10,
      captureRate:             0.020,
      salvageRate:             0.150,
      valuationMultiple:         3.0,
      reinvestmentRate:  { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
      usefulLifeYears:            10,
      footfallUnit:         'clients',
      defaultLeaseTermYears:       7,
      defaultRentEscalation:    0.03,
      // Medium ramp: client loyalty builds over 6-12 months; memberships accelerate at M8+
      rampFactors: [0.35,0.42,0.50,0.57,0.63,0.68,0.73,0.78,0.82,0.86,0.90,0.93,0.95,0.97,0.98,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.10],
    },
  },

  // ── COWORKING ────────────────────────────────────────────────────────────────
  coworking: {
    label: 'Coworking Space',
    revenueModel: 'mrr',
    revenueParams: {
      defaultMembers:      80,
      defaultMonthlyFee:   500,
      defaultCogsPercent:  0.05,   // minimal physical product
      defaultLaborPercent: 0.25,   // community manager + ops
    },
    primaryKPI: {
      label: 'Active Members',
      unit:  'members',
      band:  { floor: 30, viable: 60, target: 100, strong: 200 },
    },
    secondaryKPI: {
      label: 'Desk Utilization Rate',
      unit:  '%',
      band:  { floor: 40, viable: 60, target: 80, strong: 95 },
    },
    coaching: {
      minViableAnnualRevenue:  240_000,  // 40 members × $500 × 12
      breakEvenAnnualRevenue:  480_000,  // 80 members × $500 × 12
      strongAnnualRevenue:     900_000,  // 150 members × $500 × 12
    },
    visionWeights:   { bizType: 15, avgCheck: 25, differentiators: 20, hours: 10, demographic: 30 },
    locationWeights: { footTraffic: 0.08, transit: 0.22, competition: 0.18, demographics: 0.35, safety: 0.10, vibrancy: 0.07 },
    visionSignalWeights: { footTrafficW: 0.10, competitionW: 0.20, demographicsW: 0.40, vibrancyW: 0.30 },
    idealCheckRange:  [200, 2000],
    peakHours:        'all_day',
    idealIncomeRange: [70_000, 250_000],
    defaultSqFt:  3000,                   // sq ft — migrated from scoring.ts CONCEPT_SQFT_DEFAULTS
    buildoutCost: { low: 200_000, high: 500_000 },  // NYC build-out cost estimate USD 2024
    maxRentPercent: 20,
    killFactors: [
      'WeWork or large chain within same block — price competition is immediate',
      'Poor transit access — freelancers and remote workers need transit-first locations',
      'Insufficient natural light, noise isolation, or dedicated phone booths — churn within 60 days',
      'No dedicated internet infrastructure budget — single failure drives member exodus',
    ],
    businessCase: {
      buildoutCost:          250_000,
      equipmentCost:          80_000,
      initialInventory:        3_000,
      permitsCost:            12_000,
      operatingHoursPerDay:       12,
      captureRate:             0.010,  // membership-based, not walk-in
      salvageRate:             0.150,
      valuationMultiple:         3.5,  // MRR premium
      reinvestmentRate:  { y1: 0.06, y2: 0.05, y3: 0.04, y4: 0.03, y5: 0.02 },  // tech/infra reinvestment
      usefulLifeYears:             7,
      footfallUnit:           'desks',
      defaultLeaseTermYears:       5,
      defaultRentEscalation:    0.03,
      // Slow ramp: enterprise/team contracts take 6-12 months; community density takes 9-15 months
      rampFactors: [0.28,0.33,0.38,0.43,0.48,0.52,0.57,0.62,0.67,0.72,0.77,0.82,0.86,0.89,0.93,0.96,0.98,0.99,1.00,1.01,1.02,1.03,1.05,1.08],
    },
  },

};

// ─────────────────────────────────────────────────────────────────────────────
// REVENUE COMPUTATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/** Inputs for revenue computation — any subset; missing values fall back to concept defaults */
export interface RevenueInputs {
  avgTicket?:            number;
  dailyTransactions?:    number;
  operatingDaysPerWeek?: number;
  // MRR model
  members?:              number;
  monthlyFee?:           number;
  // Utilization model
  weeklySlots?:          number;
  fillRate?:             number;  // 0–1
  avgFee?:               number;
  // Sqft model
  squareFeet?:           number;
  revenuePerSqFt?:       number;
}

/**
 * Computes annualized steady-state revenue using the concept's revenue model.
 * Falls back to concept defaults for any missing inputs.
 * This is the single function that replaces avgTicket×dailyTransactions×days for all concepts.
 */
export function computeSteadyStateRevenue(bizType: string, inputs: RevenueInputs = {}): number {
  const kpi = CONCEPT_KPIS[bizType] ?? CONCEPT_KPIS.specialty_coffee;
  const p   = kpi.revenueParams;

  switch (kpi.revenueModel) {

    case 'mrr': {
      const members = inputs.members    ?? p.defaultMembers    ?? 150;
      const fee     = inputs.monthlyFee ?? p.defaultMonthlyFee ?? 120;
      return Math.round(members * fee * 12);
    }

    case 'utilization': {
      const slots = inputs.weeklySlots ?? p.defaultWeeklySlots ?? 60;
      const fill  = inputs.fillRate    ?? p.defaultFillRate    ?? 0.75;
      const fee   = inputs.avgFee      ?? p.defaultAvgFee      ?? 180;
      return Math.round(slots * fill * fee * 52);
    }

    case 'peak_weighted': {
      const wkdayVol  = inputs.dailyTransactions ?? p.defaultDailyTransactions ?? 40;
      const wkndMult  = p.weekendMultiplier ?? 3.5;
      const wkndVol   = wkdayVol * wkndMult;
      const ticket    = inputs.avgTicket ?? p.defaultAvgTicket ?? 22;
      // (5 weekday days + 2 weekend days) × ticket × 52 weeks
      return Math.round(((wkdayVol * 5) + (wkndVol * 2)) * ticket * 52);
    }

    case 'sqft': {
      const sqFt = inputs.squareFeet    ?? 1200;
      const rpsf = inputs.revenuePerSqFt ?? 350;
      return Math.round(sqFt * rpsf);
    }

    case 'event_plus': {
      const ticket  = inputs.avgTicket         ?? p.defaultAvgTicket         ?? 60;
      const txns    = inputs.dailyTransactions ?? p.defaultDailyTransactions ?? 18;
      const days    = (inputs.operatingDaysPerWeek ?? p.defaultOperatingDaysPerWeek ?? 6) * 52;
      const base    = ticket * txns * days;
      // Two major holiday weeks (Valentine's + Mother's Day) at holidayMultiplier×
      const holidayLift = (p.holidayMultiplier ?? 5) * (base / 52) * 2;
      return Math.round(base + holidayLift);
    }

    case 'volume':
    default: {
      const ticket = inputs.avgTicket         ?? p.defaultAvgTicket         ?? 8.75;
      const txns   = inputs.dailyTransactions ?? p.defaultDailyTransactions ?? 200;
      const days   = (inputs.operatingDaysPerWeek ?? p.defaultOperatingDaysPerWeek ?? 6) * 52;
      return Math.round(ticket * txns * days);
    }
  }
}

/**
 * Per-model ramp factors for 5-year projections.
 * Year 3 = steady state (factor 1.00). Year 1 reflects ramp-up reality.
 * MRR and event_plus ramp slower because member/event pipelines take time to build.
 */
export const RAMP_FACTORS: Record<RevenueModelType, [number, number, number, number, number]> = {
  volume:       [0.62, 0.88, 1.00, 1.06, 1.12],
  mrr:          [0.40, 0.74, 1.00, 1.10, 1.18],   // member ramp is slow + steep once established
  utilization:  [0.55, 0.80, 1.00, 1.06, 1.11],
  peak_weighted:[0.65, 0.88, 1.00, 1.05, 1.10],
  sqft:         [0.70, 0.90, 1.00, 1.04, 1.08],
  event_plus:   [0.45, 0.75, 1.00, 1.10, 1.18],   // event pipeline takes 2+ years to establish
};

/**
 * Returns 5-year annual revenue projections [Y1, Y2, Y3, Y4, Y5].
 * Y3 = steady state. Use this everywhere instead of hardcoded arrays.
 */
export function computeRevenueProjection(bizType: string, inputs: RevenueInputs = {}): [number, number, number, number, number] {
  const kpi         = CONCEPT_KPIS[bizType] ?? CONCEPT_KPIS.specialty_coffee;
  const steadyState = computeSteadyStateRevenue(bizType, inputs);
  const ramp        = RAMP_FACTORS[kpi.revenueModel];
  return ramp.map(f => Math.round(steadyState * f)) as [number, number, number, number, number];
}

/**
 * Revenue coaching message based on projected annual revenue vs. concept benchmarks.
 * Used by AI CoPilot and Business Plan page.
 */
export function getRevenueCoachingMessage(
  bizType: string,
  projectedRevenue: number
): { level: 'critical' | 'warning' | 'healthy' | 'strong'; message: string } {
  const kpi = CONCEPT_KPIS[bizType] ?? CONCEPT_KPIS.specialty_coffee;
  const { minViableAnnualRevenue, breakEvenAnnualRevenue, strongAnnualRevenue } = kpi.coaching;
  const rev = (n: number) => `$${(n / 1_000).toFixed(0)}K`;

  if (projectedRevenue < minViableAnnualRevenue) {
    return {
      level:   'critical',
      message: `At ${rev(projectedRevenue)} projected, this is below the minimum viable threshold for a ${kpi.label} in NYC (${rev(minViableAnnualRevenue)}). Review your volume and pricing assumptions.`,
    };
  }
  if (projectedRevenue < breakEvenAnnualRevenue) {
    return {
      level:   'warning',
      message: `${rev(projectedRevenue)} is above survival but below the typical NYC breakeven for ${kpi.label} (${rev(breakEvenAnnualRevenue)}). Tight margins — review fixed cost assumptions.`,
    };
  }
  if (projectedRevenue >= strongAnnualRevenue) {
    return {
      level:   'strong',
      message: `${rev(projectedRevenue)} exceeds the strong benchmark for ${kpi.label} in NYC (${rev(strongAnnualRevenue)}). Double-check your volume assumptions are grounded in realistic location data.`,
    };
  }
  return {
    level:   'healthy',
    message: `${rev(projectedRevenue)} is in the healthy range for ${kpi.label} in NYC.`,
  };
}

/**
 * Computes Vision IQ score using per-concept field weights instead of flat weights.
 * Replaces the flat composite in location/+page.svelte.
 *
 * fieldScores should already be normalized to 0–100 per field before calling this.
 */
export function computeWeightedVisionScore(
  bizType: string,
  fieldScores: {
    bizType:        number;
    avgCheck:       number;
    differentiators: number;
    hours:          number;
    demographic:    number;
  }
): number {
  const kpi  = CONCEPT_KPIS[bizType] ?? CONCEPT_KPIS.specialty_coffee;
  const w    = kpi.visionWeights;
  const total = w.bizType + w.avgCheck + w.differentiators + w.hours + w.demographic; // always 100

  const raw =
    (fieldScores.bizType          * w.bizType          / total) +
    (fieldScores.avgCheck         * w.avgCheck         / total) +
    (fieldScores.differentiators  * w.differentiators  / total) +
    (fieldScores.hours            * w.hours            / total) +
    (fieldScores.demographic      * w.demographic      / total);

  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER ACCESSORS
// ─────────────────────────────────────────────────────────────────────────────

/** Revenue model type for a concept. Used for routing formulas and UI labels. */
export function getRevenueModel(bizType: string): RevenueModelType {
  return CONCEPT_KPIS[bizType]?.revenueModel ?? 'volume';
}

/** Primary KPI label — used in UI tooltips, coaching messages, Business Plan page */
export function getPrimaryKPILabel(bizType: string): string {
  return CONCEPT_KPIS[bizType]?.primaryKPI.label ?? 'Daily Transactions';
}

/** Primary KPI band — used by AI coaching to evaluate whether inputs are realistic */
export function getPrimaryKPIBand(bizType: string): KPIBand {
  return CONCEPT_KPIS[bizType]?.primaryKPI.band ?? { floor: 60, viable: 100, target: 200, strong: 350 };
}

/** Ideal check range — used by visionFlags for absurd pricing detection */
export function getIdealCheckRange(bizType: string): [number, number] {
  return CONCEPT_KPIS[bizType]?.idealCheckRange ?? [4, 20];
}

/** Peak hours for a concept — used by visionFlags for hours-mismatch detection */
export function getPeakHours(bizType: string): 'morning' | 'all_day' | 'evening' {
  return CONCEPT_KPIS[bizType]?.peakHours ?? 'all_day';
}

/** COGS percent default — used to initialize model/+page.svelte editable inputs */
export function getDefaultCogsPercent(bizType: string): number {
  return CONCEPT_KPIS[bizType]?.revenueParams.defaultCogsPercent ?? 0.30;
}

/** Labor percent default — used to initialize model/+page.svelte editable inputs */
export function getDefaultLaborPercent(bizType: string): number {
  return CONCEPT_KPIS[bizType]?.revenueParams.defaultLaborPercent ?? 0.30;
}

/** Kill factors for a concept — fed to AI CoPilot coaching layer */
export function getKillFactors(bizType: string): string[] {
  return CONCEPT_KPIS[bizType]?.killFactors ?? [];
}

/** Location IQ signal weights for a concept — used by scoring engine */
export function getLocationWeights(bizType: string): LocationWeights {
  return CONCEPT_KPIS[bizType]?.locationWeights ?? {
    footTraffic: 0.25, transit: 0.22, competition: 0.20,
    demographics: 0.18, safety: 0.08, vibrancy: 0.07,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 09: BUSINESS INTELLIGENCE KNOWLEDGE BASE
// Per-concept intelligence from 100+ trade sources. Feeds: copilot, business
// case brain, location page context, checklist engine.
// ─────────────────────────────────────────────────────────────────────────────

export interface Doc09CostStructure {
  cogsPct: number;              // COGS as % of revenue
  laborPct: number;             // Labor as % of revenue
  primeCostTarget: number;      // COGS + Labor ceiling
  rentCeilingPct: number;       // Max occupancy cost as % of revenue
  netMarginRange: [number, number]; // realistic net margin range
  creditCardFeePct?: number;    // card processing fee %
}

export interface Doc09FailureRates {
  year1Pct: number;             // % that close within Year 1
  year3Pct: number;             // cumulative % closed by Year 3
  year5Pct: number;             // cumulative % closed by Year 5
  topCause: string;             // #1 cause of failure
  mythBust?: string;            // common myth to debunk
}

export interface Doc09PullRadius {
  walkMinutes: number;          // walk time to pull customers
  distanceMiles: number;        // equivalent distance
  type: 'impulse' | 'planned' | 'routine' | 'destination' | 'comparison';
}

export interface Doc09ClusteringRule {
  impact: 'positive' | 'negative' | 'mixed';
  maxCompetitors500ft: number;  // competitors within 500ft before saturation
  note: string;
}

export interface Doc09Intelligence {
  label: string;
  costStructure: Doc09CostStructure;
  failureRates: Doc09FailureRates;
  pullRadius: Doc09PullRadius;
  clustering: Doc09ClusteringRule;
  startupCapitalRange: [number, number]; // min viable to full buildout
  breakEvenMonths: [number, number];     // range
  minDailyFootTraffic: number;           // minimum pedestrians/day
  idealSqFtRange: [number, number];
  unanticipatedCosts: Array<{ item: string; amount: string; frequency: string }>;
  competitiveStrategy: string[];         // top 3-4 strategic insights
  regulatoryNotes: string[];             // NYC-specific regulatory requirements
  seasonalPattern?: string;              // key seasonal revenue pattern
  successModels?: string[];              // NYC success examples
}

export const DOC09_INTELLIGENCE: Record<string, Doc09Intelligence> = {

  specialty_coffee: {
    label: 'Coffee Shop / Café',
    costStructure: {
      cogsPct: 0.30, laborPct: 0.28, primeCostTarget: 0.55,
      rentCeilingPct: 0.10, netMarginRange: [0.05, 0.10], creditCardFeePct: 0.03,
    },
    failureRates: {
      year1Pct: 30, year3Pct: 50, year5Pct: 74,
      topCause: 'Running out of money (73%) — insufficient working capital for ramp-up',
    },
    pullRadius: { walkMinutes: 3, distanceMiles: 0.15, type: 'impulse' },
    clustering: { impact: 'negative', maxCompetitors500ft: 2, note: 'Coffee: 2 before saturation' },
    startupCapitalRange: [80_000, 300_000],
    breakEvenMonths: [12, 18],
    minDailyFootTraffic: 5000,
    idealSqFtRange: [800, 1500],
    unanticipatedCosts: [
      { item: 'Espresso machine maintenance', amount: '$300–$800/yr', frequency: 'Annual' },
      { item: 'Grinder burr replacement', amount: '$100–$300', frequency: 'Every 6–12 months' },
      { item: 'Grease trap cleaning', amount: '$500–$1,500/yr', frequency: 'Every 6–12 months' },
      { item: 'Credit card processing', amount: '$15K–$36K/yr', frequency: 'On $500K revenue' },
      { item: 'Seasonal revenue swing', amount: '20–30% drop', frequency: 'June–August' },
      { item: 'Milk spoilage/waste', amount: '3–5% of dairy spend', frequency: 'Ongoing' },
    ],
    competitiveStrategy: [
      'Quality focus: specialty single-origin + proper technique beats chains',
      'Third-party delivery is a MARGIN KILLER: 15–30% commission on 5% net margin = total loss',
      'Loyalty programs: members spend 12–35% more per visit; 5% retention increase = 25–95% profit boost',
      'Retail beans at 73–75% gross margin + subscriptions at 60–70% margin = revenue diversification',
    ],
    regulatoryNotes: [
      'Food Service Establishment Permit (DOHMH) — annual renewal',
      'Food Protection Course: supervisor must pass and be on-site at all times',
      'Grease trap compliance: fines up to $10,000/day for violations',
      'Sidewalk cafe license: $1,050 (4-year term)',
    ],
    seasonalPattern: '20–30% revenue drop June–August; strongest months: Sept–Nov, Jan–March',
    successModels: ['Joe Coffee (21 locations, multi-format)', 'SEY Coffee (Bushwick, onsite roastery)', 'Devoción (sustainability story)', 'Coffee Project NY (8+ locations from 2015)'],
  },

  full_service_restaurant: {
    label: 'Full-Service Restaurant',
    costStructure: {
      cogsPct: 0.30, laborPct: 0.34, primeCostTarget: 0.65,
      rentCeilingPct: 0.10, netMarginRange: [0.05, 0.07], creditCardFeePct: 0.03,
    },
    failureRates: {
      year1Pct: 17, year3Pct: 59, year5Pct: 49,
      topCause: 'Cash flow (82% of failures) — not bad food or service, running out of money',
      mythBust: 'The "90% fail in Year 1" is FALSE — originated from a 2003 AmEx TV commercial with no data. Actual Year 1 rate: 14–17%.',
    },
    pullRadius: { walkMinutes: 10, distanceMiles: 0.5, type: 'planned' },
    clustering: { impact: 'mixed', maxCompetitors500ft: 8, note: 'Dining district effect positive up to 8, then saturation' },
    startupCapitalRange: [175_000, 750_000],
    breakEvenMonths: [24, 36],
    minDailyFootTraffic: 2000,
    idealSqFtRange: [1500, 4000],
    unanticipatedCosts: [
      { item: 'Equipment repair (per incident)', amount: '$75–$800', frequency: 'Per event' },
      { item: 'Walk-in cooler failure', amount: '$4K–$30K replacement', frequency: 'Rare but catastrophic' },
      { item: 'Pest control (NYC)', amount: '$200–$600/month', frequency: 'Monthly (DOH mandate)' },
      { item: 'Grease trap install', amount: '~$15,000', frequency: 'One-time' },
      { item: 'Hood system', amount: '$12K–$15K', frequency: 'One-time ($1K–$1.5K per linear foot)' },
      { item: 'Employee theft', amount: '~4% of sales', frequency: 'Ongoing (75% of shrinkage is internal)' },
      { item: 'Reservation no-shows', amount: '~$78K/yr', frequency: 'At 5% rate on 100 weekly reservations' },
      { item: 'Third-party delivery', amount: 'Eliminates ALL profit', frequency: '30% commission on 5–10% margin' },
    ],
    competitiveStrategy: [
      '1-star Yelp increase = 5–9% revenue increase for independents (chains unaffected)',
      'Private events/catering: 25–40% higher margins than regular service — fills off-peak capacity',
      'Going from 4 to 5 table turns per night = $1.8M additional annual revenue at $50 avg check',
      'Ghost kitchen alternative: $50K–$100K startup, no FOH labor or liquor license needed',
    ],
    regulatoryNotes: [
      'NYC Health Dept Grading: A (0–13 pts), B (14–27), C (28+ = monthly re-inspections)',
      'DOH grade program increased NYC restaurant sales 9.3% ($800M) after launch',
      'Liquor license: $960 (beer/wine) to $400K (full on-premises, scarce areas)',
      'Sexual harassment prevention training mandatory for all employees',
    ],
    seasonalPattern: 'Holiday season (Nov–Dec) peak; January lull; summer sidewalk dining boost',
  },

  qsr: {
    label: 'Quick-Service / Diner',
    costStructure: {
      cogsPct: 0.30, laborPct: 0.28, primeCostTarget: 0.60,
      rentCeilingPct: 0.08, netMarginRange: [0.05, 0.07],
    },
    failureRates: {
      year1Pct: 17, year3Pct: 45, year5Pct: 50,
      topCause: 'Cash flow — thin margins leave no room for error',
    },
    pullRadius: { walkMinutes: 5, distanceMiles: 0.25, type: 'impulse' },
    clustering: { impact: 'negative', maxCompetitors500ft: 3, note: 'Convenience business — proximity = price war' },
    startupCapitalRange: [100_000, 500_000],
    breakEvenMonths: [12, 24],
    minDailyFootTraffic: 3000,
    idealSqFtRange: [800, 2500],
    unanticipatedCosts: [
      { item: 'Equipment repair', amount: '$75–$800/incident', frequency: 'Per event' },
      { item: 'Pest control', amount: '$200–$600/month', frequency: 'Monthly' },
    ],
    competitiveStrategy: [
      'Higher table turns (8–12/day vs 4–5 full-service) = volume play',
      'Corner locations critical for grab-and-go visibility (+10 premium)',
      'Morning commute traffic >50% of daily = breakfast/lunch QSR sweet spot',
    ],
    regulatoryNotes: ['Same as full-service restaurant minus liquor license requirements'],
  },

  bar_nightlife: {
    label: 'Bar / Nightlife',
    costStructure: {
      cogsPct: 0.22, laborPct: 0.30, primeCostTarget: 0.55,
      rentCeilingPct: 0.12, netMarginRange: [0.10, 0.15],
    },
    failureRates: {
      year1Pct: 20, year3Pct: 50, year5Pct: 55,
      topCause: 'Liquor license denial or noise complaints shutting operations',
    },
    pullRadius: { walkMinutes: 30, distanceMiles: 2.0, type: 'destination' },
    clustering: { impact: 'mixed', maxCompetitors500ft: 6, note: 'Nightlife district effect positive up to 6' },
    startupCapitalRange: [110_000, 850_000],
    breakEvenMonths: [18, 30],
    minDailyFootTraffic: 1500,
    idealSqFtRange: [1000, 3000],
    unanticipatedCosts: [
      { item: 'Full on-premises liquor license (scarce area)', amount: '$12K–$400K', frequency: 'One-time' },
      { item: 'Initial liquor inventory', amount: '$6K–$30K', frequency: 'Opening' },
      { item: 'Soundproofing (if residential above)', amount: '$10K–$30K', frequency: 'One-time' },
    ],
    competitiveStrategy: [
      'Alcohol margins 60–80% gross (vs 30–40% for food) — bar profitability > restaurant',
      'SLA 200-ft rule is ABSOLUTE — verify before signing any lease',
      '500-ft clustering: 3+ licenses triggers Community Board review',
    ],
    regulatoryNotes: [
      'NYS SLA 200-ft rule: ABSOLUTE bar on license near schools/churches (no discretion)',
      'NYS SLA 500-ft rule: discretionary if 3+ licenses within 500ft',
      'Community Board approval required for all new on-premises licenses',
      'Timeline: 30+ days minimum for SLA approval',
    ],
    seasonalPattern: 'Holiday season (Nov–Dec) and summer rooftop peak; January/February dead',
  },

  fitness_studio: {
    label: 'Fitness Studio / Gym',
    costStructure: {
      cogsPct: 0.10, laborPct: 0.35, primeCostTarget: 0.50,
      rentCeilingPct: 0.20, netMarginRange: [0.10, 0.20],
    },
    failureRates: {
      year1Pct: 25, year3Pct: 45, year5Pct: 55,
      topCause: 'Member churn — 50% of new members quit within 6 months',
    },
    pullRadius: { walkMinutes: 15, distanceMiles: 0.75, type: 'routine' },
    clustering: { impact: 'negative', maxCompetitors500ft: 1, note: 'Same-modality competition = price war' },
    startupCapitalRange: [75_000, 500_000],
    breakEvenMonths: [12, 18],
    minDailyFootTraffic: 1000,
    idealSqFtRange: [1500, 15000],
    unanticipatedCosts: [
      { item: 'Equipment maintenance', amount: '3–5% of equipment value/yr', frequency: 'Annual' },
      { item: 'January member surge churn', amount: '40–50% of Jan joiners quit', frequency: 'By March' },
      { item: 'ClassPass discount impact', amount: 'Trains members to expect low prices', frequency: 'Ongoing' },
    ],
    competitiveStrategy: [
      'January surge: 50% of annual signups — invest in retention systems NOW',
      'ClassPass: 94% of users are new (great for trial) but discount prices destroy margin — convert within 3–6 months',
      'Summer slump: 20–30% higher churn June–August — outdoor activities compete',
      'Break-even: 40–60 members (boutique), 200–500 (standard gym)',
    ],
    regulatoryNotes: [
      'Reinforced floors required for heavy equipment',
      'Enhanced HVAC for air quality during exercise',
      'Soundproofing required if residential above/adjacent',
    ],
    seasonalPattern: 'January cash boom (50% of annual signups), 40–50% churn by March, summer slump June–August',
  },

  retail: {
    label: 'Retail Boutique',
    costStructure: {
      cogsPct: 0.45, laborPct: 0.20, primeCostTarget: 0.65,
      rentCeilingPct: 0.14, netMarginRange: [0.05, 0.15],
    },
    failureRates: {
      year1Pct: 22, year3Pct: 45, year5Pct: 55,
      topCause: 'Inventory management — shrinkage (1.6% avg: 36% theft, 29% employee, 27% admin error)',
    },
    pullRadius: { walkMinutes: 10, distanceMiles: 0.5, type: 'comparison' },
    clustering: { impact: 'positive', maxCompetitors500ft: 5, note: 'Comparison shopping clustering HELPS apparel/jewelry/home' },
    startupCapitalRange: [35_000, 100_000],
    breakEvenMonths: [12, 24],
    minDailyFootTraffic: 2000,
    idealSqFtRange: [1000, 3000],
    unanticipatedCosts: [
      { item: 'Shrinkage (theft + admin error)', amount: '1.6% of inventory value', frequency: 'Annual' },
      { item: 'Q4 inventory buy', amount: '30–40% of annual inventory budget', frequency: 'Sept–Oct prep' },
    ],
    competitiveStrategy: [
      'Amazon-proof: focus on experience, curation, personal service, try-before-you-buy',
      'Experiential retail: events, workshops, styling sessions, community',
      'Pre-order 4–6 weeks BEFORE season, not during',
      'Corner location = window display on two streets = maximum visibility (+10 premium)',
    ],
    regulatoryNotes: ['Frontage width minimum 15ft for window display visibility'],
    seasonalPattern: 'Q4 holiday season = 30–40% of annual revenue; January clearance',
  },

  personal_services: {
    label: 'Hair Salon / Barbershop',
    costStructure: {
      cogsPct: 0.15, laborPct: 0.45, primeCostTarget: 0.60,
      rentCeilingPct: 0.14, netMarginRange: [0.08, 0.18],
    },
    failureRates: {
      year1Pct: 25, year3Pct: 40, year5Pct: 50,
      topCause: 'Stylist turnover — 40% industry attrition, 61% leave within first year',
    },
    pullRadius: { walkMinutes: 10, distanceMiles: 0.5, type: 'routine' },
    clustering: { impact: 'negative', maxCompetitors500ft: 3, note: 'Moderate negative — differentiation by specialty/demographic/luxury tier required' },
    startupCapitalRange: [25_000, 300_000],
    breakEvenMonths: [6, 18],
    minDailyFootTraffic: 1500,
    idealSqFtRange: [800, 2500],
    unanticipatedCosts: [
      { item: 'Stylist turnover replacement', amount: '$2K–$5K per employee', frequency: 'Per departure' },
      { item: 'Training per employee', amount: '$1,000+', frequency: 'Per hire (4–8 week ramp)' },
      { item: 'Product retail inventory', amount: '10–15% of total revenue opportunity', frequency: 'Ongoing' },
    ],
    competitiveStrategy: [
      'Booth rental: 45–60% gross, 12–18% net — owner is landlord, NOT manager',
      'Commission model: 65–85% gross, but often 0–8% net in practice',
      'RISK: booth rental means stylist owns client relationships — they leave, clients leave',
      'Tiered commission reduces turnover 30%; add PTO + career paths + flexible scheduling',
    ],
    regulatoryNotes: [
      'Cosmetology license: 1,000 hours training + state exams + physician sign-off',
      'Natural hair styling: 300 hours (faster path)',
      'Barbershop permit separate from individual barber license',
      'All salons must be licensed by NY Department of State',
    ],
  },

  medical_office: {
    label: 'Med Spa / Medical Office',
    costStructure: {
      cogsPct: 0.20, laborPct: 0.30, primeCostTarget: 0.55,
      rentCeilingPct: 0.15, netMarginRange: [0.20, 0.25],
    },
    failureRates: {
      year1Pct: 15, year3Pct: 30, year5Pct: 40,
      topCause: 'Regulatory non-compliance — operating without proper medical director voids insurance + criminal liability',
    },
    pullRadius: { walkMinutes: 30, distanceMiles: 2.0, type: 'destination' },
    clustering: { impact: 'negative', maxCompetitors500ft: 2, note: 'Licensed physicians with broader scope compete for same clients' },
    startupCapitalRange: [200_000, 500_000],
    breakEvenMonths: [12, 18],
    minDailyFootTraffic: 1000,
    idealSqFtRange: [1000, 3500],
    unanticipatedCosts: [
      { item: 'Medical director cost', amount: '$50K–$150K/yr', frequency: 'Annual (REQUIRED)' },
      { item: 'Malpractice insurance ($1M/$3M)', amount: '$5K–$7.5K/yr', frequency: 'Annual' },
      { item: 'HIPAA compliance setup', amount: '$3K–$10K', frequency: 'One-time + ongoing' },
      { item: 'Client acquisition cost', amount: '$132 per client', frequency: 'Per new client' },
      { item: 'Equipment obsolescence', amount: 'Full replacement every 3–5 years', frequency: 'Cycle' },
    ],
    competitiveStrategy: [
      'Injectable margins are 60–80% — highest margin service',
      'Revenue per treatment room: $600–$1,000/hour',
      'NEVER do Groupon/discount: trains clients to expect low prices, destroys margin sustainability',
      '40% of clients never return — retention is existential; target 3:1 LTV/CAC ratio',
    ],
    regulatoryNotes: [
      'Medical Director MUST be NY-licensed MD/DO — cannot be PA ("real, not nominal" oversight)',
      'All clinical services through physician-owned PC or PLLC (NY Education Law §6522)',
      '2026 enforcement: 87 citations in 223 inspections — regulators are cracking down',
      'Malpractice insurance ($1M/$3M limits) REQUIRED — general liability does NOT cover medical procedures',
      'HIPAA: all patient records, treatment photos must be secured',
    ],
  },

  coworking: {
    label: 'Co-Working Space',
    costStructure: {
      cogsPct: 0.10, laborPct: 0.20, primeCostTarget: 0.35,
      rentCeilingPct: 0.20, netMarginRange: [0.10, 0.20],
    },
    failureRates: {
      year1Pct: 20, year3Pct: 40, year5Pct: 50,
      topCause: 'Oversupply in post-pandemic market + WeWork pricing pressure',
    },
    pullRadius: { walkMinutes: 15, distanceMiles: 0.75, type: 'routine' },
    clustering: { impact: 'negative', maxCompetitors500ft: 2, note: 'Pricing pressure from nearby coworking' },
    startupCapitalRange: [200_000, 500_000],
    breakEvenMonths: [18, 30],
    minDailyFootTraffic: 1000,
    idealSqFtRange: [3000, 10000],
    unanticipatedCosts: [
      { item: 'High-speed internet infrastructure', amount: '$5K–$20K', frequency: 'One-time + monthly' },
      { item: 'Furniture replacement cycle', amount: '10–15% of furnishing budget/yr', frequency: 'Annual' },
    ],
    competitiveStrategy: [
      'Niche positioning: industry-specific spaces (creative, tech, wellness) command premium',
      'Community events drive retention more than amenities',
    ],
    regulatoryNotes: ['ADA compliance critical for public workspace'],
  },

  // ── FLORIST ───────────────────────────────────────────────────────────────
  florist: {
    label: 'Florist',
    costStructure: {
      cogsPct: 0.30, laborPct: 0.25, primeCostTarget: 0.55,
      rentCeilingPct: 0.10, netMarginRange: [0.08, 0.15],
    },
    failureRates: {
      year1Pct: 20, year3Pct: 40, year5Pct: 55,
      topCause: 'Perishability — 15% waste rate industry avg; online competition ($5.2B catching brick-and-mortar $5.8B)',
      mythBust: 'Florists are NOT dying — event/wedding revenue ($3K–$15K/event) and subscriptions ($40–$150/mo) sustain modern shops',
    },
    pullRadius: { walkMinutes: 10, distanceMiles: 0.5, type: 'planned' },
    clustering: { impact: 'negative', maxCompetitors500ft: 1, note: 'Florist is negative clustering — homogeneous product, limited impulse' },
    startupCapitalRange: [80_000, 200_000],
    breakEvenMonths: [12, 24],
    minDailyFootTraffic: 2000,
    idealSqFtRange: [800, 1500],
    unanticipatedCosts: [
      { item: 'Walk-in cooler (34–38°F critical)', amount: '$5K–$15K', frequency: 'One-time' },
      { item: 'Display cooler', amount: '$2K–$5K', frequency: 'One-time' },
      { item: 'Flower waste/spoilage', amount: '15% of flower spend (target <5%)', frequency: 'Ongoing' },
      { item: 'Valentine\'s Day inventory surge', amount: '5–10x normal weekend spend', frequency: 'Annual' },
      { item: 'Delivery vehicle/service', amount: '$3K–$8K/yr', frequency: 'Annual' },
    ],
    competitiveStrategy: [
      'Valentine\'s Day = 30–35% of annual income in ONE WEEK — plan 3 months ahead',
      'Event/wedding revenue ($3K–$15K/event) is highest margin but labor-intensive',
      'Subscriptions create recurring revenue: 15–35% of total',
      'Corporate accounts: 10 clients × $100/week = $52K/yr recurring',
      'Instagram is PRIMARY marketing channel — visual medium fits perfectly',
      'Cannot outbid 1-800-Flowers on search; use their Local Exclusive Program instead',
    ],
    regulatoryNotes: [
      'Walk-in cooler temperature control: 34–38°F required for inventory preservation',
      '28th Street Flower District (NYC): wholesale before 8 AM, retail after — early-morning vendor runs required',
    ],
    seasonalPattern: 'Extreme: Valentine\'s (30–35% of annual), Mother\'s Day, Christmas = make-or-break. July–August + January = dead zone.',
  },

  // ── GROCERY (Independent) ─────────────────────────────────────────────────
  grocery: {
    label: 'Independent Grocery',
    revenueModel: 'volume',   // CV-13: was missing — falls back to 'volume' via getRevenueModel() default, now explicit
    costStructure: {
      cogsPct: 0.70, laborPct: 0.15, primeCostTarget: 0.85,
      rentCeilingPct: 0.05, netMarginRange: [0.01, 0.03],
    },
    failureRates: {
      year1Pct: 18, year3Pct: 42, year5Pct: 55,
      topCause: 'Razor-thin margins (1–3% net) + chain price competition + shrinkage (5–10% of inventory)',
      mythBust: 'Independent grocers survive by specializing — ethnic, organic, prepared foods — not competing on price/selection',
    },
    pullRadius: { walkMinutes: 10, distanceMiles: 0.5, type: 'planned' },
    clustering: { impact: 'negative', maxCompetitors500ft: 0, note: 'Grocery is STRONGLY negative clustering — homogeneous products, proximity = price war' },
    startupCapitalRange: [50_000, 200_000],
    breakEvenMonths: [24, 39],
    minDailyFootTraffic: 2000,
    idealSqFtRange: [2000, 5000],
    unanticipatedCosts: [
      { item: 'Shrinkage (theft + spoilage)', amount: '5–10% of inventory value ($70K–$140K on $1.4M)', frequency: 'Annual' },
      { item: 'Produce waste', amount: '10–15% of produce spend', frequency: 'Ongoing' },
      { item: 'Heavy refrigeration (walk-in + display)', amount: '$15K–$40K', frequency: 'One-time + $3K–$8K/yr maintenance' },
      { item: 'POS system (grocery-specific)', amount: '$15K–$40K', frequency: 'One-time' },
      { item: 'Pest control (NYC DOH mandated)', amount: '$200–$600/month', frequency: 'Monthly' },
    ],
    competitiveStrategy: [
      'You CANNOT compete with chains on price or selection — differentiate on specialty/niche',
      'Prepared foods/deli = margin engine: 40–60% gross vs 1–3% net on packaged goods',
      'Private label products: 45–55% margin vs 25–30% for national brands',
      'Curated selection beats breadth: Trader Joe\'s model (4,000 SKUs vs 30,000 industry)',
      'Ethnic/specialty positioning (Kalustyan\'s, H Mart, Patel Brothers model)',
    ],
    regulatoryNotes: [
      'SNAP/EBT acceptance may be required for viability in lower-income areas',
      'Loading dock/delivery access required for regular inventory shipments',
      'NYC DOH inspection compliance — pest control, refrigeration temp logs',
    ],
    seasonalPattern: 'Relatively stable. Holiday peaks (Thanksgiving, Christmas). Summer BBQ. Minimal dead zones — essential service.',
  },

  // ── BAKERY ────────────────────────────────────────────────────────────────
  bakery: {
    label: 'Bakery',
    costStructure: {
      cogsPct: 0.28, laborPct: 0.30, primeCostTarget: 0.58,
      rentCeilingPct: 0.10, netMarginRange: [0.05, 0.20],
    },
    failureRates: {
      year1Pct: 25, year3Pct: 45, year5Pct: 60,
      topCause: 'Perishability (24–72hr shelf life = total loss on unsold) + labor intensity (early morning shifts, skilled bakers)',
      mythBust: 'Bakeries that add cafe service and wholesale channels survive at much higher rates than pure retail',
    },
    pullRadius: { walkMinutes: 7, distanceMiles: 0.25, type: 'impulse' },
    clustering: { impact: 'negative', maxCompetitors500ft: 2, note: 'Moderate negative — differentiation by specialty (French, Asian, artisan) reduces overlap' },
    startupCapitalRange: [47_900, 100_000],
    breakEvenMonths: [12, 24],
    minDailyFootTraffic: 3000,
    idealSqFtRange: [800, 2000],
    unanticipatedCosts: [
      { item: 'Type II exhaust hood', amount: '$5K–$15K ($1K–$1.5K per linear foot)', frequency: 'One-time' },
      { item: 'Commercial oven electrical upgrade', amount: '$3K–$8K', frequency: 'One-time' },
      { item: 'Product waste (24–72hr shelf life)', amount: '8–15% of production cost', frequency: 'Ongoing' },
      { item: 'Baker wages (NYC)', amount: '$40K avg, lead baker $68K', frequency: 'Annual per baker' },
      { item: 'Proofer/sheeter/mixer maintenance', amount: '$2K–$5K/yr', frequency: 'Annual' },
    ],
    competitiveStrategy: [
      'Morning commute + coffee combo is #1 impulse driver — co-locate with transit/office',
      'Wholesale channel (restaurants, cafes) smooths demand and reduces waste',
      'Corporate catering pipeline from nearby offices: $500–$2K/week per account',
      'Specialty positioning (French, Asian, gluten-free, sourdough) creates defensible niche',
      'Pre-order model reduces waste dramatically — Instagram/website ordering',
    ],
    regulatoryNotes: [
      'Type II hood required for commercial baking ovens ($5K–$15K)',
      'Commercial ovens draw heavy electrical — verify panel capacity before lease',
      'DOHMH Food Service Establishment Permit + Food Protection Course',
      'Grease trap compliance if frying (fines up to $10K/day)',
    ],
    seasonalPattern: 'Holiday peaks (Thanksgiving, Christmas, Easter). Wedding cake season (May–October). January health-kick dip.',
  },
};

/** Look up Document 09 intelligence for a concept. Returns null if not covered. */
export function getDoc09Intelligence(bizType: string): Doc09Intelligence | null {
  return DOC09_INTELLIGENCE[bizType] ?? null;
}

/** Occupancy cost ceilings from Document 09 — comprehensive table */
export const DOC09_OCCUPANCY_CEILINGS: Record<string, { maxPct: number; note: string }> = {
  specialty_coffee:        { maxPct: 10, note: 'Never exceed; target 5–7%' },
  full_service_restaurant: { maxPct: 10, note: 'Fine dining may tolerate 12%' },
  qsr:                     { maxPct: 8,  note: 'Thin margins demand tight control' },
  bar_nightlife:           { maxPct: 12, note: 'Higher margins allow more rent' },
  retail:                  { maxPct: 14, note: 'Higher markups allow more rent (12–15% range)' },
  personal_services:       { maxPct: 14, note: 'Revenue per chair drives capacity' },
  fitness_studio:          { maxPct: 20, note: 'Membership model amortizes over time (15–25% range)' },
  medical_office:          { maxPct: 15, note: 'High revenue per SF supports it' },
  coworking:               { maxPct: 20, note: 'Must achieve high desk utilization' },
  florist:                 { maxPct: 10, note: 'Industry benchmark 8.5% ideal' },
  grocery:                 { maxPct: 5,  note: '1–3% net margin = zero rent tolerance' },
  bakery:                  { maxPct: 10, note: 'Similar to coffee shop' },
};
