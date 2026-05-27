/**
 * V4 Patch 002: Daypart-Weighted Foot Traffic
 *
 * CONCEPT:
 * Different business types need foot traffic at different times of day.
 * A coffee shop needs morning commuters; a bar needs evening crowds.
 * Currently, V4's accessibility score uses total daily ridership/traffic.
 * This patch applies concept-specific daypart multipliers.
 *
 * DATA REALITY:
 * We don't have hourly MTA data in block_group_intel yet (only estimated_daily_ridership).
 * So we use research-based fractions from segment-intel.ts:
 *   - Morning peak (7:30-10am): 32% of daily MTA ridership, 83% within the peak window
 *   - Lunch (11am-2pm): ~18% of daily traffic
 *   - Evening peak (5-8pm): ~28% of daily traffic
 *   - Late night (9pm+): ~12% of daily traffic
 *
 * For each concept, we weight these fractions by relevance:
 *   - Coffee (morning pattern): morning 60%, lunch 25%, evening 15%
 *   - Bar (evening pattern): morning 5%, lunch 10%, evening 50%, late 35%
 *   - Restaurant (evening pattern): morning 5%, lunch 30%, evening 50%, late 15%
 *   - QSR (allday pattern): morning 25%, lunch 35%, evening 30%, late 10%
 *   - Retail (weekend/daytime): morning 15%, lunch 30%, evening 40%, late 15%
 *
 * The result is a concept-weighted transit score that replaces the flat daily score
 * in V4's computeAccessibility().
 *
 * TO APPLY: Add this function to score-all-v4.mjs and call it inside computeAccessibility()
 */

// Daypart fractions of daily MTA ridership (from NYC MTA data patterns)
const DAYPART_FRACTIONS = {
  morning: 0.265,   // 32% × 83% ≈ 26.5% of total daily during 7:30-10am
  lunch: 0.18,      // 11am-2pm
  evening: 0.28,    // 5pm-8pm
  late: 0.12,       // 9pm+
  other: 0.155,     // rest of day
};

// Concept-specific importance weights for each daypart
// These sum to 1.0 and reflect when the concept's target customers are moving
const CONCEPT_DAYPART_WEIGHTS = {
  // Morning-dominant concepts (routine interceptors)
  specialty_coffee:     { morning: 0.55, lunch: 0.25, evening: 0.12, late: 0.03, other: 0.05 },
  bakery:              { morning: 0.50, lunch: 0.25, evening: 0.15, late: 0.03, other: 0.07 },
  juice_bar:           { morning: 0.50, lunch: 0.30, evening: 0.12, late: 0.03, other: 0.05 },
  wellness_beverage:   { morning: 0.50, lunch: 0.30, evening: 0.12, late: 0.03, other: 0.05 },

  // Evening-dominant concepts (destination pull)
  bar_nightlife:       { morning: 0.02, lunch: 0.05, evening: 0.48, late: 0.40, other: 0.05 },
  full_service_restaurant: { morning: 0.05, lunch: 0.25, evening: 0.50, late: 0.15, other: 0.05 },

  // All-day concepts
  qsr:                 { morning: 0.20, lunch: 0.35, evening: 0.30, late: 0.10, other: 0.05 },
  fast_casual:         { morning: 0.15, lunch: 0.40, evening: 0.30, late: 0.10, other: 0.05 },

  // Daytime-dominant concepts
  retail:              { morning: 0.10, lunch: 0.30, evening: 0.40, late: 0.10, other: 0.10 },
  personal_services:   { morning: 0.15, lunch: 0.30, evening: 0.35, late: 0.10, other: 0.10 },
  fitness_studio:      { morning: 0.30, lunch: 0.15, evening: 0.35, late: 0.10, other: 0.10 },
  medical_office:      { morning: 0.25, lunch: 0.25, evening: 0.30, late: 0.05, other: 0.15 },
  florist:             { morning: 0.15, lunch: 0.35, evening: 0.35, late: 0.05, other: 0.10 },
};

const DEFAULT_DAYPART_WEIGHTS = { morning: 0.25, lunch: 0.25, evening: 0.30, late: 0.10, other: 0.10 };

/**
 * Compute a concept-weighted transit score from daily ridership.
 *
 * The idea: if you're a coffee shop, a station with 50K daily riders where
 * 26.5% pass through during morning rush is worth MORE to you than to a bar,
 * because your weighted score emphasizes the morning fraction.
 *
 * In practice, since we only have total daily ridership, the multiplier is:
 *   sum(daypartFraction × daypartImportanceWeight)
 * ...which produces a scaling factor between ~0.17 (bar at morning) and ~0.55 (coffee at morning)
 *
 * This factor modulates the raw transit score to be concept-aware.
 *
 * @param dailyRidership - Total estimated daily ridership
 * @param conceptType - V4 concept type
 * @returns Adjusted ridership number reflecting concept-relevant traffic
 */
function daypartWeightedRidership(dailyRidership, conceptType) {
  const weights = CONCEPT_DAYPART_WEIGHTS[conceptType] || DEFAULT_DAYPART_WEIGHTS;

  // Compute concept-relevance multiplier
  // This represents how much of the daily traffic matters for this concept
  let relevanceMultiplier = 0;
  for (const [daypart, fraction] of Object.entries(DAYPART_FRACTIONS)) {
    relevanceMultiplier += fraction * (weights[daypart] || 0);
  }

  // Normalize: the "allday" concept should get a multiplier of ~1.0
  // Default weights produce ~0.245, so normalize to that baseline
  const baselineMultiplier = 0.245;
  const conceptMultiplier = relevanceMultiplier / baselineMultiplier;

  // Apply as a score modifier: concepts aligned with peak traffic get a boost,
  // misaligned concepts get a penalty
  // Clamp to [0.7, 1.4] to prevent extreme swings
  const modifier = Math.max(0.70, Math.min(1.40, conceptMultiplier));

  return Math.round(dailyRidership * modifier);
}

/**
 * Compute daypart alignment score (0-100).
 *
 * How well does this location's traffic pattern match this concept's needs?
 * High transit + morning peak + coffee concept = high alignment.
 * High transit + evening peak + coffee concept = lower alignment.
 *
 * This is a supplementary signal that can be shown in the UI as
 * "Traffic-Concept Alignment: 82/100"
 */
function daypartAlignmentScore(transitScore, conceptType) {
  const weights = CONCEPT_DAYPART_WEIGHTS[conceptType] || DEFAULT_DAYPART_WEIGHTS;

  // For now, without actual hourly data, alignment is based on whether
  // the concept's peak hours align with NYC's peak transit hours
  // Morning-heavy concepts benefit from transit (most ridership is AM/PM peak)
  // Late-night concepts don't benefit as much from transit
  const peakAlignment = weights.morning * 0.265 + weights.evening * 0.28;
  const offPeakAlignment = weights.late * 0.12 + weights.other * 0.155;

  // Higher peakAlignment = transit score is more relevant for this concept
  const alignmentMultiplier = peakAlignment / (peakAlignment + offPeakAlignment);

  // Scale: 50 = neutral, higher = better alignment
  return Math.round(50 + (alignmentMultiplier - 0.5) * transitScore * 0.6);
}

export {
  daypartWeightedRidership,
  daypartAlignmentScore,
  CONCEPT_DAYPART_WEIGHTS,
  DAYPART_FRACTIONS,
};
