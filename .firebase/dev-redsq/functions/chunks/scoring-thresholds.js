const PRICE_LEVEL_TO_COFFEE = {
  "1": { avgTicket: 4, visionTier: "commodity", tierLabel: "budget coffee" },
  "2": { avgTicket: 6, visionTier: "standard", tierLabel: "neighborhood coffee shop" },
  "3": { avgTicket: 8.5, visionTier: "differentiated", tierLabel: "specialty coffee" },
  "4": { avgTicket: 12, visionTier: "highly_differentiated", tierLabel: "premium coffee experience" }
};
const TRANSIT_THRESHOLDS = {
  /** MTA daily ridership → transit score bands (mta-ridership.ts lines 395–400). */
  ridership: {
    /** >= this → score 92 (top tier) */
    tier1: 1e5,
    /** >= this → score 80 + interpolation */
    tier2: 6e4,
    /** >= this → score 68 + interpolation */
    tier3: 3e4,
    /** >= this → score 52 + interpolation */
    tier4: 15e3,
    /** >= this → score 35 + interpolation */
    tier5: 5e3,
    /** Base scores at tier entry points */
    scores: { tier1: 92, tier2: 80, tier3: 68, tier4: 52, tier5: 35, floor: 15 }
  },
  /** Bonus points for station count density (mta-ridership.ts lines 403–404). */
  stationBonus: { high: 4, highThreshold: 4, low: 3, lowThreshold: 2 },
  /** Bonus points for route variety (mta-ridership.ts lines 407–408). */
  routeBonus: { high: 5, highThreshold: 6, low: 3, lowThreshold: 3 },
  /**
   * Positive NIQ signal threshold — transit scores above this get a
   * "excellent transit access" signal pushed to the NIQ layer
   * (location-iq.ts line 1311).
   */
  positiveSignalFloor: 70,
  /**
   * Walk Score transit estimate heuristic — when no Walk Score API data is
   * available, transit is estimated as walkScore × this multiplier
   * (walkscore.ts line 168).
   */
  walkScoreTransitMultiplier: 0.85,
  /**
   * MTA + pedestrian blend ratio (location-iq.ts line 1317).
   * transit = mtaScore × mtaWeight + pedScore × pedWeight.
   */
  blendWeights: { mta: 0.6, pedestrian: 0.4 },
  /**
   * Pedestrian count → foot traffic score bands (nyc-pedestrian.ts lines 207–210).
   */
  pedestrian: {
    /** >= this avg/location → score 85+ */
    highFloor: 5e3,
    /** >= this → score 60+ */
    midFloor: 1e3,
    /** >= this → score 35+ */
    lowFloor: 200,
    scores: { high: 85, mid: 60, low: 35, floor: 15 }
  },
  /**
   * Confidence penalty (0-100 points) applied to transit dimension confidence
   * when MTA `dataQuality === 'estimated'`. Does NOT change the transit score —
   * only signals to the confidence contract that this reading is less reliable.
   *
   * Rationale: estimated ridership is extrapolated from route count with ±25%
   * accuracy (per docs/ds-05-mta-data-quality-audit.md). The confidence dial
   * should reflect this so the UI can render "~N" (partial) rather than full.
   *
   * 'mixed' quality gets half the penalty (real data exists but is incomplete).
   */
  dataQualityPenalty: { estimated: 25, mixed: 10 }
};
const EVIDENCE_COPY = {
  /** Score >= this → HIGH copy branch ("Strong transit coverage...") */
  high: 70,
  /** Score >= this → MED copy branch ("Moderate transit access...") */
  med: 50
};
const DIRECTION_THRESHOLDS = {
  /** Score >= this → direction: 'positive' */
  positive: 70,
  /** Score < this → direction: 'negative' (50–69 is neutral) */
  negative: 50
};
const HEADS_UP_WATCH_TIERS = ["Weak", "Concerning", "Average"];
const HEADS_UP_SEVERITY = {
  Concerning: "critical",
  Weak: "important",
  Average: "info"
};
const TIER_BOUNDARIES = {
  fitIQ: { t1: 75, t2: 65, t3: 50, t4: 40 },
  locationIQ: { t1: 80, t2: 65, t3: 50 },
  visionIQ: { t1: 75, t2: 60, t3: 45, t4: 30 },
  lens: { t1: 75, t2: 60, t3: 45, t4: 30 }
};
const SURVIVAL_DISCOUNT_FACTORS = {
  salon: 0.95,
  nail: 0.95,
  barbershop: 0.95,
  fitness_studio: 0.9,
  retail: 0.85,
  medical: 0.92,
  dental: 0.92,
  coworking: 0.8,
  bar_nightlife: 1
};
const SURVIVAL_DISCOUNT_DEFAULT = 0.88;
const KILL_FACTOR_THRESHOLDS = {
  safety: 30,
  // below 30 = unsafe block, customers avoid
  competition: 25,
  // below 25 = saturated (or scan failed)
  transit: 25,
  // below 25 = car-only access
  survival: 40,
  // below 35 = concept-specific dead ring
  vibrancy: 35
};
const SIGNAL_KILL_FLOOR = 40;
const SIGNAL_CAUTION_FLOOR = 55;
const CONFIDENCE_BANDS = {
  preliminary: 0.5,
  partial: 0.85
};
export {
  CONFIDENCE_BANDS as C,
  DIRECTION_THRESHOLDS as D,
  EVIDENCE_COPY as E,
  HEADS_UP_WATCH_TIERS as H,
  KILL_FACTOR_THRESHOLDS as K,
  PRICE_LEVEL_TO_COFFEE as P,
  SURVIVAL_DISCOUNT_FACTORS as S,
  TIER_BOUNDARIES as T,
  SURVIVAL_DISCOUNT_DEFAULT as a,
  SIGNAL_KILL_FLOOR as b,
  SIGNAL_CAUTION_FLOOR as c,
  TRANSIT_THRESHOLDS as d,
  HEADS_UP_SEVERITY as e
};
