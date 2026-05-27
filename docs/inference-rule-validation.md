# INF-07: Inference Engine Rule Validation

## Overview

The inference engine (`src/lib/intel/inference-engine.ts`) contains **8 deterministic rules** that analyze location data from 20+ API sources to produce business-specific intelligence. Each rule combines fields from multiple sources, applies threshold logic, and outputs a structured `Inference` object with verdict, confidence, sentiment, and lineage.

This document describes the validation test suite at `tests/inference-rule-validation.mjs`.

## Test Suite

**136 tests** across 14 test groups:

### Structure Tests (4 groups)
- **Rule IDs**: All 8 rules produce the correct `id` values
- **Thresholds**: Key constants in `const T` match specification (e.g., `EVENING_CRIME_HEAVY_PCT = 50`)
- **Categories**: Each rule maps to the correct analytical category (timing, pricing, concept_fit, demand, growth, competition, operations, risk)
- **Lineage names**: All 8 lineage rule names exist (e.g., `AFTER_HOURS_SAFETY`, `COMPETITION_CROSS_VALIDATED`)

### Scenario Tests (8 groups — one per rule)

Each rule is tested with two contrasting NYC neighborhoods:

| Rule | Positive Scenario | Negative Scenario |
|------|------------------|-------------------|
| 1: After-Hours Safety | Times Square (low evening crime, vibrant nightlife) | East New York (65% evening crime, businesses close early) |
| 2: Price Viability | Upper East Side ($130K income, premium pricing aligned) | South Bronx ($35K income, premium pricing misaligned) |
| 3: Takeout vs Sit-Down | West Village (12 sidewalk cafés, 18 on-premise licenses) | Midtown (65% delivery, 1 café) |
| 4: Commuter Rush | Herald Square (5 stations, 85K ridership, rush=100) | Red Hook (0 stations, rush=0) |
| 5: Growth Trajectory | DUMBO (22 permits, 28% new biz, growing) | Canarsie (6% new biz, declining) |
| 6: Competition | SoHo (28 competitors = saturated) | Mott Haven (2 competitors = open) |
| 7: Quality of Life | Park Slope (quality=80, 8 sanitation) | Hunts Point (quality=25, 45 sanitation) |
| 8: Zoning & Regulatory | Greenwich Village bar (historic + 32 liquor = 3 risks) | Financial District café (0 risks) |

### Edge Case Tests (2 groups)
- **Boundary values**: Tests exact threshold behavior (e.g., crime 50% is NOT evening-heavy, 51% IS)
- **Confidence calculation**: Validates the `inputConfidence()` formula across 5 scenarios from all-REAL to mostly-MISSING

### Cross-Cutting Tests (2 groups)
- **Coherence**: Full NYC location profiles (Flatiron=positive, Brownsville=negative) tested across multiple rules
- **Field ID validation**: All 45 field IDs referenced by rules exist in engine source
- **Business type sensitivity**: Verifies concept-specific logic branches (bar/restaurant, cafe/bakery)

## Running the Tests

```bash
node tests/inference-rule-validation.mjs
```

Expected output: `136 passed, 0 failed`

## Threshold Reference

All thresholds are centralized in `const T = {...}` (inference-engine.ts lines 400-527). Key values:

- Evening crime heavy: >50%
- Crime unsafe: <50/100
- Income tiers: $100K (high), $60K (moderate), $50K (budget)
- Rush score: >70 (strong), >40 (moderate)
- Competitors: >15 (saturated), >8 (competitive), >3 (moderate)
- Quality: >70 (positive), >40 (neutral)
- Liquor density: >20 (SLA scrutiny)
- Confidence: ≥70 (HIGH), ≥40 (MEDIUM)

## Changes Made

- `inference-engine.ts`: Added `runInferenceRules` to exports (line 1191)
- `tests/inference-rule-validation.mjs`: New test file (136 tests)
- `docs/inference-rule-validation.md`: This document
