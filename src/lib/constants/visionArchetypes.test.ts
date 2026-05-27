/**
 * T1-A: VISION_ARCHETYPES canonical values contract test.
 *
 * WHAT THIS TESTS:
 *   - That VISION_ARCHETYPES imported from visionArchetypes.ts has the
 *     correct idealCheck ranges (sourced from conceptKPIs.ts).
 *   - That the old inline +page.svelte values are no longer in effect by
 *     verifying the canonical values are what flows through the shared module.
 *
 * WHY THIS MATTERS:
 *   The old inline copy in +page.svelte had idealCheck ranges that were
 *   systematically too narrow (all 15 concepts). This caused founders with
 *   premium pricing to be incorrectly penalized on the price-income fit score.
 *
 * CHANGE VERIFIED: T1-A (2026-04-16)
 * Run: npx vitest run src/lib/constants/visionArchetypes.test.ts
 */

import { describe, it, expect } from 'vitest';
import { VISION_ARCHETYPES, DEFAULT_ARCHETYPE } from './visionArchetypes';

// ─────────────────────────────────────────────────────────────────────────────
// Canonical idealCheck values (from conceptKPIs.ts — the source of truth)
// These are what SHOULD flow through after T1-A.
// The OLD inline +page.svelte values are in comments for reference.
// ─────────────────────────────────────────────────────────────────────────────
const EXPECTED_IDEAL_CHECK: Record<string, [number, number]> = {
  specialty_coffee:        [3,   12],   // was [3, 8]  in inline — hi was 4 too low
  bakery:                  [6,   20],   // was [4, 12] in inline — both ends wrong
  fast_casual:             [8,   24],   // was [8, 18] in inline — hi was 6 too low
  full_service_restaurant: [20, 100],   // was [20, 60] in inline — hi was 40 too low
  qsr:                     [5,   18],   // was [5, 14] in inline — hi was 4 too low
  bar_nightlife:           [10,  60],   // was [10, 25] in inline — hi was 35 too low
  juice_bar:               [7,   20],   // was [7, 16] in inline — hi was 4 too low
  wellness_beverage:       [6,   18],   // was [6, 14] in inline — hi was 4 too low
  retail:                  [15, 200],   // was [15, 80] in inline — hi was 120 too low
  fitness_studio:          [50, 350],   // was [15, 40] in inline — both ends wrong (monthly fee vs per-visit)
  personal_services:       [40, 300],   // was [20, 60] in inline — both ends wrong
  wellness_spa:            [75, 300],   // was [60, 150] in inline — both ends wrong
  medical_office:          [80, 700],   // was [30, 200] in inline — worst drift: $500 hi gap
  florist:                 [30, 250],   // was [20, 80] in inline — both ends wrong
  coworking:               [200, 2000], // was [200, 1200] in inline — hi was 800 too low
};

const EXPECTED_SIGNAL_WEIGHTS: Record<string, { footTrafficW: number; competitionW: number; demographicsW: number; vibrancyW: number }> = {
  specialty_coffee:        { footTrafficW: 0.35, competitionW: 0.25, demographicsW: 0.20, vibrancyW: 0.20 },
  bakery:                  { footTrafficW: 0.30, competitionW: 0.20, demographicsW: 0.25, vibrancyW: 0.25 },
  fast_casual:             { footTrafficW: 0.30, competitionW: 0.25, demographicsW: 0.25, vibrancyW: 0.20 },
  full_service_restaurant: { footTrafficW: 0.20, competitionW: 0.25, demographicsW: 0.30, vibrancyW: 0.25 },
  qsr:                     { footTrafficW: 0.35, competitionW: 0.25, demographicsW: 0.15, vibrancyW: 0.25 },
  bar_nightlife:           { footTrafficW: 0.20, competitionW: 0.25, demographicsW: 0.25, vibrancyW: 0.30 },
  juice_bar:               { footTrafficW: 0.30, competitionW: 0.25, demographicsW: 0.25, vibrancyW: 0.20 },
  wellness_beverage:       { footTrafficW: 0.25, competitionW: 0.25, demographicsW: 0.30, vibrancyW: 0.20 },
  retail:                  { footTrafficW: 0.30, competitionW: 0.20, demographicsW: 0.30, vibrancyW: 0.20 },
  fitness_studio:          { footTrafficW: 0.20, competitionW: 0.30, demographicsW: 0.30, vibrancyW: 0.20 },
  personal_services:       { footTrafficW: 0.20, competitionW: 0.30, demographicsW: 0.25, vibrancyW: 0.25 },
  wellness_spa:            { footTrafficW: 0.10, competitionW: 0.30, demographicsW: 0.35, vibrancyW: 0.25 },
  medical_office:          { footTrafficW: 0.15, competitionW: 0.30, demographicsW: 0.30, vibrancyW: 0.25 },
  florist:                 { footTrafficW: 0.30, competitionW: 0.20, demographicsW: 0.30, vibrancyW: 0.20 },
  coworking:               { footTrafficW: 0.10, competitionW: 0.20, demographicsW: 0.40, vibrancyW: 0.30 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('T1-A: VISION_ARCHETYPES — canonical idealCheck ranges', () => {
  it('exports archetypes for all 15 concepts', () => {
    const keys = Object.keys(EXPECTED_IDEAL_CHECK);
    for (const concept of keys) {
      expect(VISION_ARCHETYPES[concept], `Missing archetype for ${concept}`).toBeDefined();
    }
  });

  it('has correct idealCheck [lo, hi] for every concept (no old inline values)', () => {
    for (const [concept, [expectedLo, expectedHi]] of Object.entries(EXPECTED_IDEAL_CHECK)) {
      const arch = VISION_ARCHETYPES[concept];
      expect(arch, `Archetype missing for ${concept}`).toBeDefined();
      expect(arch.idealCheck[0], `${concept} idealCheck lo`).toBe(expectedLo);
      expect(arch.idealCheck[1], `${concept} idealCheck hi`).toBe(expectedHi);
    }
  });

  it('specialist concepts have wide idealCheck hi (not the old narrow inline caps)', () => {
    // These are the worst drift cases from the T1-A audit
    expect(VISION_ARCHETYPES.medical_office.idealCheck[1]).toBeGreaterThanOrEqual(500);
    expect(VISION_ARCHETYPES.personal_services.idealCheck[1]).toBeGreaterThanOrEqual(200);
    expect(VISION_ARCHETYPES.full_service_restaurant.idealCheck[1]).toBeGreaterThanOrEqual(80);
    expect(VISION_ARCHETYPES.bar_nightlife.idealCheck[1]).toBeGreaterThanOrEqual(50);
    expect(VISION_ARCHETYPES.retail.idealCheck[1]).toBeGreaterThanOrEqual(150);
  });

  it('signal weights match conceptKPIs.ts (unchanged by T1-A)', () => {
    for (const [concept, expected] of Object.entries(EXPECTED_SIGNAL_WEIGHTS)) {
      const arch = VISION_ARCHETYPES[concept];
      expect(arch.footTrafficW, `${concept} footTrafficW`).toBe(expected.footTrafficW);
      expect(arch.competitionW, `${concept} competitionW`).toBe(expected.competitionW);
      expect(arch.demographicsW, `${concept} demographicsW`).toBe(expected.demographicsW);
      expect(arch.vibrancyW, `${concept} vibrancyW`).toBe(expected.vibrancyW);
    }
  });

  it('all signal weights sum to 1.0 per concept', () => {
    for (const concept of Object.keys(EXPECTED_SIGNAL_WEIGHTS)) {
      const arch = VISION_ARCHETYPES[concept];
      const sum = arch.footTrafficW + arch.competitionW + arch.demographicsW + arch.vibrancyW;
      expect(sum, `${concept} weights sum`).toBeCloseTo(1.0, 5);
    }
  });

  it('DEFAULT_ARCHETYPE has safe fallback values', () => {
    expect(DEFAULT_ARCHETYPE.footTrafficW).toBe(0.25);
    expect(DEFAULT_ARCHETYPE.competitionW).toBe(0.25);
    expect(DEFAULT_ARCHETYPE.demographicsW).toBe(0.25);
    expect(DEFAULT_ARCHETYPE.vibrancyW).toBe(0.25);
    expect(DEFAULT_ARCHETYPE.idealCheck[0]).toBeGreaterThan(0);
    expect(DEFAULT_ARCHETYPE.idealCheck[1]).toBeGreaterThan(DEFAULT_ARCHETYPE.idealCheck[0]);
    expect(DEFAULT_ARCHETYPE.peakHours).toBe('all_day');
  });
});
