# Scorer Reconciliation: V4 (Batch) vs V5.1 (Live)

**Date:** April 12, 2026
**Author:** Brain Thread (ARCH-02)
**Status:** Audit complete — action items at bottom

---

## Executive Summary

Two scoring engines coexist. V4 (`scripts/score-all-v4.mjs`) is a batch CLI script that
precomputed 510K rows on March 27. V5.1 (`src/lib/intel/six-index.ts`) is the live
TypeScript engine deployed in SvelteKit. They use **different weight sets** and produce
**different scores** for the same location/concept pair. The API prefers V4 batch scores
when available and falls back to V5.1 live computation when not.

This is intentional hybrid architecture, not a bug. But the boundary must be documented
so future changes don't accidentally break the preference chain.

---

## What Each Engine Does

### V4 — `scripts/score-all-v4.mjs` (Batch, March 27)

**Purpose:** One-time batch scorer. Precomputes scores for all 6,807 NYC block groups
across 13 concept types.

**Writes to:** `block_group_scores` table via Supabase upsert (geoid + score_type key).

**Score types written (per block group):**

| Category | score_type | Count per BG |
|----------|-----------|-------------|
| Concept-independent | `location_iq`, `location_iq_v2`, `location_sub_safety`, `location_sub_momentum` | 4 |
| Legacy six-index | `six_transit`, `six_demographics`, `six_competition`, `six_vibrancy`, `six_safety`, `six_momentum` | 6 |
| Concept-specific fit | `fit_score:{concept}` (13 concepts) | 13 |
| Fit sub-scores | `fit_sub_market_proof:{concept}`, `fit_sub_accessibility:{concept}`, `fit_sub_vibrancy:{concept}` | 39 |
| Concept-specific vision | `vision_iq:{concept}` (13 concepts) | 13 |
| **Total** | | **75 rows** |

**Weight architecture:**
- Borough-specific competition multipliers (Manhattan 0.25, Brooklyn 0.15, etc.)
- Borough-specific vibrancy multipliers (Manhattan 0.38, Brooklyn 0.20, etc.)
- Ensemble blend: 54% composite fit + 46% linear model (`BLEND_ALPHA = 0.54, BLEND_POW = 1.1`)
- Hand-tuned to d=0.601 against DOHMH outcome data

**Key property:** Calibrated against ground truth. This is the validated model.

### V5.1 — `src/lib/intel/six-index.ts` (Live, Deployed)

**Purpose:** Real-time scoring for the `/api/location-iq` GET handler. Computes Location IQ
from 20 live intel sources + 2 precomputed dimensions.

**Reads from:** Live API calls (MTA, NYPD, Census, Overpass, etc.) + `block_group_scores`
for `six_neighborhood_health` and `six_survival_rate`.

**Returns:** `{ locationIQ, grade, indices: Record<string, { score, weight, label, tier }> }`

**Weight architecture:**
- ML-derived concept-specific weights (March 2026 ridge regression)
- 8 dimensions: transit, demographics, competition, vibrancy, safety, momentum + neighborhoodHealth + survivalRate
- No borough-specific multipliers — model learned concept-wide patterns
- survivalRate carries 0.48 weight (largest single dimension)

**Key property:** Uses live data (fresher), but weights are not validated against d=0.601 holdout.

---

## Which Runs at Score Time?

### GET `/api/location-iq` (Full Analysis)

```
1. Fetch 20 intel sources (live)
2. computeLocationIQ(report, businessType)     → V5.1 live LIQ
3. fetchPrecomputedScores(geoid, businessType)  → V4 batch fit/vision/survival
4. getSurvivalRate(geoid, concept, borough)     → SURV-WIRE live override
5. computeSixIndex(report, businessType, precomputed) → V5.1 live 8-index
6. Response: sixIndex.locationIQ as the Block Score
```

**Location IQ** = V5.1 live (always).
**Fit IQ** = V4 batch when `fit_score:{concept}` exists in DB; else live 60/40 blend.
**Vision IQ** = Always live (POST handler computes from user answers).

### POST `/api/location-iq` (Vision IQ Recompute)

```
1. Resolve concept, build dynamic config from answers
2. If lat/lng: fetchPrecomputedScores → V4 batch dimensions
3. getSurvivalRate override (SURV-WIRE)
4. computeDynamicVisionIQ(scores, dynamicConfig) → live Vision IQ
5. Fit IQ: prefer batch fit_score:{concept}; else 60% LIQ + 40% VIQ
```

### GET `/api/score/preview` (Quick Preview)

```
1. Zero DB access — uses indexScores passed from client
2. computeDynamicVisionIQ → live Vision IQ
3. fitIQ = 60% locationIQ + 40% visionIQ (always live, never batch)
```

---

## Weight Differences

| Dimension | V4 (batch, example: specialty_coffee, Manhattan) | V5.1 (live, specialty_coffee) |
|-----------|------------------------------------------------|------------------------------|
| Transit | concept-specific from `CONCEPT_CONFIGS` | 0.08 |
| Demographics | concept-specific | 0.02 |
| Competition | 0.25 (Manhattan borough multiplier) | 0.08 |
| Vibrancy | 0.38 (Manhattan borough multiplier) | 0.03 |
| Safety | concept-specific | 0.01 |
| Momentum | concept-specific | 0.02 |
| Neighborhood Health | not in V4 | 0.28 |
| Survival Rate | not in V4 | 0.48 |

**Critical difference:** V5.1 adds neighborhoodHealth (0.28) and survivalRate (0.48) which
don't exist in V4. These carry 76% of the total weight. V4's borough-specific multipliers
don't exist in V5.1.

---

## Single Source of Truth by Score Type

| Score | Authority | Why |
|-------|----------|-----|
| **Fit IQ** | V4 batch (`fit_score:{concept}`) | Calibrated to d=0.601. Live fallback only when batch missing. |
| **Location IQ** | V5.1 live (`computeSixIndex`) | Uses live data + live survival. Batch `location_iq_v2` is stale. |
| **Vision IQ** | Always live (`computeDynamicVisionIQ`) | Depends on user answers — can't be batch-precomputed. |
| **Six-index dimensions** | V5.1 live (via `computeSixIndex`) | Live intel sources. Batch `six_*` values are March 27 snapshots. |
| **Survival Rate** | Live via SURV-WIRE (`getSurvivalRate`) | DOHMH data + concept discount + borough fallback. |

---

## Known Gaps

1. **Survival rate provenance:** `six_survival_rate` rows in `block_group_scores` have unknown
   origin. SURV-WIRE now overrides them at query time with live DOHMH data, but the batch
   values were never documented. Not blocking — live override is authoritative.

2. **Neighborhood health source:** `six_neighborhood_health` rows exist in DB but the
   computation script is not in the current repo. Values are consumed by V5.1 at weight 0.28.
   If these are stale, 28% of Location IQ is based on unknown-age data.

3. **V4 batch is frozen March 27.** New intel sources, concept changes, or weight updates
   since then are NOT reflected in batch Fit IQ scores. The batch needs re-running after
   any model change. Currently no CI/CD pipeline for this — it's a manual `node` invocation.

4. **d=0.601 was measured on V4 ensemble, not V5.1 live.** The live engine's accuracy has
   never been independently measured. The Stats Guru Review (March 28) flagged the original
   d=0.601 as potentially overfit.

---

## Recommendations

### Keep (no change needed)

- **Hybrid architecture is correct.** Batch Fit IQ gives validated scores; live Location IQ
  gives fresh data. This is the right tradeoff.
- **SURV-WIRE override is correct.** Live survival data is strictly better than batch snapshots.

### Action Items

| # | Action | Priority | Effort |
|---|--------|----------|--------|
| A1 | Document `six_neighborhood_health` computation source | HIGH | 1hr |
| A2 | Add `scored_at` column audit: flag any batch scores older than 60 days | MED | 2hr |
| A3 | Create re-run script wrapper: `npm run score:batch` that invokes score-all-v4 with logging | MED | 1hr |
| A4 | Measure V5.1 live engine accuracy independently (need holdout set) | LOW | 4hr |
| A5 | Reconcile V4 borough multipliers into V5.1 as optional config | LOW | 3hr |

### Do NOT Do

- **Do not merge V4 and V5.1 into one engine.** They serve different purposes (batch
  calibration vs live freshness). Merging would lose the calibrated baseline.
- **Do not re-run V4 batch without verifying survival rate pipeline first.** The batch
  script doesn't call `getSurvivalRate` — it reads whatever's in the DB.
