/**
 * RE² Grade Scale — Canonical Source
 * ─────────────────────────────────────────────────────────────────────────────
 * 04.19.2026 13:35 Score Consolidation
 *
 * SINGLE SOURCE OF TRUTH for score → letter grade conversion.
 *
 * Previously, scoreToGrade was duplicated 4+ times with slight threshold drift:
 *   engines/primitives.ts  — ✅ canonical implementation lives here
 *   six-index.ts           — exact copy  → removed 04.19.2026
 *   location-iq.ts         — exact copy  → removed 04.19.2026
 *   fit-iq-engine.ts       — exact copy (named "grade") → removed 04.19.2026
 *   space-scores.ts        — diverged thresholds (95/90/85...) → replaced 04.19.2026
 *
 * ALL callers must import from here. Never define a new local scoreToGrade.
 *
 * The canonical RE² grade scale:
 *   A+  ≥ 93  |  A  ≥ 87  |  A-  ≥ 80
 *   B+  ≥ 73  |  B  ≥ 67  |  B-  ≥ 60
 *   C+  ≥ 53  |  C  ≥ 47  |  C-  ≥ 40
 *   D   ≥ 30  |  F  < 30
 */

// scoreToGrade is implemented in primitives.ts and re-exported here.
// All new callers import from grade-scale.ts (not directly from primitives.ts).
export { scoreToGrade } from '$lib/intel/engines/primitives';
