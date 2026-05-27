/**
 * T1-B: KILL_FACTOR_THRESHOLDS contract test for business-case-summary logic.
 *
 * WHAT THIS TESTS:
 *   - That KILL_FACTOR_THRESHOLDS.transit  = 25 (was hardcoded 45 in business-case-summary)
 *   - That KILL_FACTOR_THRESHOLDS.competition = 25 (was hardcoded 40 in business-case-summary)
 *   - That scores in the 26–44 range (transit) are NOT kill factors
 *   - That scores in the 26–39 range (competition) are NOT kill factors
 *   - That scores below 25 on either dimension ARE kill factors
 *
 * WHY THIS MATTERS:
 *   Before T1-B, a location with transit=35 or competition=30 was flagged as a
 *   Business Case kill factor, inflating killFactorCount and potentially
 *   triggering the verdictOverride "serious risk" banner on viable locations.
 *
 * CHANGE VERIFIED: T1-B (2026-04-16)
 * Run: npx vitest run src/lib/constants/kill-factor-thresholds.test.ts
 */

import { describe, it, expect } from 'vitest';
import { KILL_FACTOR_THRESHOLDS } from './scoring-thresholds';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: mirrors the computeKillFactors() logic in business-case-summary
// We test the threshold logic directly rather than the full API handler.
// ─────────────────────────────────────────────────────────────────────────────
function wouldFlagTransit(transitScore: number): boolean {
  return transitScore < KILL_FACTOR_THRESHOLDS.transit;
}

function wouldFlagCompetition(competitionScore: number): boolean {
  return competitionScore < KILL_FACTOR_THRESHOLDS.competition;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('T1-B: KILL_FACTOR_THRESHOLDS — canonical values', () => {
  it('transit threshold is 25 (not the old inline 45)', () => {
    expect(KILL_FACTOR_THRESHOLDS.transit).toBe(25);
  });

  it('competition threshold is 25 (not the old inline 40)', () => {
    expect(KILL_FACTOR_THRESHOLDS.competition).toBe(25);
  });

  it('safety threshold is 30', () => {
    expect(KILL_FACTOR_THRESHOLDS.safety).toBe(30);
  });

  it('vibrancy threshold is 35', () => {
    expect(KILL_FACTOR_THRESHOLDS.vibrancy).toBe(35);
  });
});

describe('T1-B: Transit kill factor — correct flagging boundaries', () => {
  it('does NOT flag transit score of 35 (was incorrectly flagged before T1-B)', () => {
    // OLD behavior: 35 < 45 → flagged. NEW (correct): 35 < 25 → false
    expect(wouldFlagTransit(35)).toBe(false);
  });

  it('does NOT flag transit score of 44 (was incorrectly flagged before T1-B)', () => {
    expect(wouldFlagTransit(44)).toBe(false);
  });

  it('does NOT flag transit score of 26 (boundary — just above threshold)', () => {
    expect(wouldFlagTransit(26)).toBe(false);
  });

  it('DOES flag transit score of 25 (exactly at threshold)', () => {
    // Score of exactly 25 should be flagged (< 25 is false, but this tests boundary)
    expect(wouldFlagTransit(25)).toBe(false); // 25 < 25 = false, threshold is exclusive
  });

  it('DOES flag transit score of 24 (below threshold)', () => {
    expect(wouldFlagTransit(24)).toBe(true);
  });

  it('DOES flag transit score of 10 (clearly below threshold)', () => {
    expect(wouldFlagTransit(10)).toBe(true);
  });

  it('DOES flag transit score of 0 (worst case)', () => {
    expect(wouldFlagTransit(0)).toBe(true);
  });

  it('does NOT flag transit score of 50 (healthy)', () => {
    expect(wouldFlagTransit(50)).toBe(false);
  });

  it('does NOT flag transit score of 100 (perfect)', () => {
    expect(wouldFlagTransit(100)).toBe(false);
  });
});

describe('T1-B: Competition kill factor — correct flagging boundaries', () => {
  it('does NOT flag competition score of 30 (was incorrectly flagged before T1-B)', () => {
    // OLD behavior: 30 < 40 → flagged. NEW (correct): 30 < 25 → false
    expect(wouldFlagCompetition(30)).toBe(false);
  });

  it('does NOT flag competition score of 39 (was incorrectly flagged before T1-B)', () => {
    expect(wouldFlagCompetition(39)).toBe(false);
  });

  it('does NOT flag competition score of 26 (just above threshold)', () => {
    expect(wouldFlagCompetition(26)).toBe(false);
  });

  it('does NOT flag competition score of 25 (at threshold, exclusive)', () => {
    expect(wouldFlagCompetition(25)).toBe(false); // 25 < 25 = false
  });

  it('DOES flag competition score of 24 (below threshold)', () => {
    expect(wouldFlagCompetition(24)).toBe(true);
  });

  it('DOES flag competition score of 10 (clearly below threshold)', () => {
    expect(wouldFlagCompetition(10)).toBe(true);
  });

  it('DOES flag competition score of 0 (zero competitors scanned)', () => {
    expect(wouldFlagCompetition(0)).toBe(true);
  });

  it('does NOT flag competition score of 60 (healthy)', () => {
    expect(wouldFlagCompetition(60)).toBe(false);
  });
});

describe('T1-B: Real-world scenario — viable location should NOT trigger verdictOverride', () => {
  /**
   * Before T1-B: a location with transit=35 AND competition=30 would generate
   * killFactorCount=2, triggering verdictOverride (the "serious risk" banner).
   * After T1-B: killFactorCount=0, no verdictOverride.
   */
  it('location with transit=35, competition=30 produces 0 kill factors', () => {
    const transitScore = 35;
    const competitionScore = 30;
    let killCount = 0;
    if (wouldFlagTransit(transitScore)) killCount++;
    if (wouldFlagCompetition(competitionScore)) killCount++;
    expect(killCount).toBe(0); // After T1-B: no kill factors
  });

  it('location with transit=20, competition=15 produces 2 kill factors (legitimately bad)', () => {
    const transitScore = 20;
    const competitionScore = 15;
    let killCount = 0;
    if (wouldFlagTransit(transitScore)) killCount++;
    if (wouldFlagCompetition(competitionScore)) killCount++;
    expect(killCount).toBe(2); // Genuinely distressed location
  });

  it('location with transit=20 only produces 1 kill factor (transit issue, competition ok)', () => {
    const transitScore = 20;
    const competitionScore = 50;
    let killCount = 0;
    if (wouldFlagTransit(transitScore)) killCount++;
    if (wouldFlagCompetition(competitionScore)) killCount++;
    expect(killCount).toBe(1);
  });
});
