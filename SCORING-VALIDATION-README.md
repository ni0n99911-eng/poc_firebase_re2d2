# RE² Scoring Validation Framework

## Overview

`scripts/scoring-validation.mjs` is a comprehensive statistical validation framework designed to measure honest (holdout-set) model performance. It addresses the independent audit finding that the reported d=0.601 was computed on training data only, not a true test set.

## Key Features

### 1. Deterministic Holdout Set Partitioning
- **80/20 split**: Uses deterministic hash of geoid/neighborhood to assign records
- **Reproducible**: Same record always goes to same partition
- **Unbiased**: Hash-based, not random (same results across runs)
- Implementation: `hashToFraction()` + `isHoldoutSet()`

### 2. Core Validation Metrics

#### Cohen's d (Effect Size)
- Standardized mean difference between success/failure score distributions
- d > 0.8 = large effect, d > 0.5 = medium, d > 0.2 = small, d < 0.2 = negligible
- Interpretation: "If d=0.40, the scoring model produces modest separation between successes and failures"

#### AUC-ROC (Discrimination)
- Probability that model ranks a random success higher than random failure
- AUC = 0.5 = random chance, 0.6 = poor, 0.7 = fair, 0.8 = good, 0.9 = excellent
- Robust to class imbalance (unlike accuracy)

#### Bootstrap 95% Confidence Intervals
- 1000 resamples with replacement to estimate uncertainty
- Reports [ci_lower, ci_upper] for both d and AUC
- Interpretation: "If CI doesn't contain 0.5 for AUC, model beats random chance with 95% confidence"

### 3. 5-Fold Cross-Validation
- Rotates holdout set 5 times (each fold is ~20% of data)
- Computes mean ± std for d and AUC across folds
- Detects stability: std > 0.10 indicates instability across different test sets
- Optional: `--fold=N` to run specific fold only

### 4. Per-Concept Breakdown
- Splits validation results by concept type
- Identifies concepts with weak/strong signal
- Useful for diagnosing whether low d is model-wide or concept-specific

### 5. Circular Predictor Audit
- Computes Pearson correlation (ρ) between each score type and outcome
- Flags |ρ| > 0.5 as potential circular reasoning or data leakage
- Examples of problematic patterns:
  - survival_rate directly measuring outcome instead of predicting it
  - outcome-driven feature engineering leaking ground truth into scores

## Data Requirements

### Current Status
The framework currently:
1. Reads `historical_ground_truths` table (15 Power Broker reference entries)
2. Extracts scoring notes from each entry
3. Creates synthetic validation data with placeholder scores

### To Enable Full Validation
You need to:
1. **Populate `location_scores` table** with actual scores (location_iq, vision_iq, fit_iq) keyed by geoid
2. **Create outcome labels** mapping geoid/neighborhood to success/failure
3. **Update `enrichWithActualScores()`** to fetch real scores from Supabase instead of synthetic data

### Expected Table Schema

```sql
-- Ground truth outcomes
CREATE TABLE location_outcomes (
  geoid TEXT PRIMARY KEY,
  neighborhood TEXT,
  concept_type TEXT,
  outcome INT, -- 1 = success, 0 = failure
  created_at TIMESTAMPTZ
);

-- Actual scores (latest per geoid)
CREATE TABLE location_scores (
  geoid TEXT,
  concept_type TEXT,
  location_iq NUMERIC,
  vision_iq NUMERIC,
  fit_iq NUMERIC,
  computed_at TIMESTAMPTZ,
  PRIMARY KEY (geoid, concept_type, computed_at DESC)
);
```

## Usage

### Basic Validation (Full Mode)
```bash
node scripts/scoring-validation.mjs
```
Outputs:
- Human-readable report to stdout
- JSON results to `scripts/validation-results.json`

### Dry Run (Data Audit Only)
```bash
node scripts/scoring-validation.mjs --dry-run
```
- Lists record counts
- No metrics computed
- Fast sanity check

### Specific Fold (5-Fold CV)
```bash
node scripts/scoring-validation.mjs --fold=2
```
- Runs fold 2 only (out of 5)
- Useful for debugging or parallel execution

## Output Interpretation

### Example Output
```
──────────────────────────────────────────────────────────────────────────────
RE² SCORING VALIDATION REPORT
──────────────────────────────────────────────────────────────────────────────

─ HOLDOUT SET VALIDATION (80/20 split) ─
Train set size: 4200
Test set size:  1050

Cohen's d:      0.412
  95% CI:       [0.385, 0.441]
  Interpretation: medium

AUC-ROC:        0.672
  95% CI:       [0.641, 0.703]
  Interpretation: fair discrimination
```

**Read as**: "The model achieves a medium effect size (d=0.412) on the holdout set, meaning scores for successful locations are systematically higher than failures. The 95% CI [0.385, 0.441] gives us confidence this isn't due to chance. AUC of 0.672 means the model beats random chance, but discriminates only fairly well."

### Cross-Validation Summary
```
─ 5-FOLD CROSS-VALIDATION ─
Folds evaluated: 5/5

Cohen's d summary:
  Mean ± Std: 0.398 ± 0.032
  Per-fold:
    Fold 0: d=0.412, n=1050
    Fold 1: d=0.385, n=1050
    ...
```

**Read as**: "The model is stable: mean d=0.398 with low std=0.032. Each fold (different 20% test set) produces similar results, suggesting generalization."

### Circular Predictor Audit
```
─ CIRCULAR PREDICTOR AUDIT ─
STATUS: ALERT (potential circular predictors found)

survival_rate:
  Pearson ρ: 0.812
  Severity: HIGH
  → Review survival_rate for circular inputs or data leakage
```

**Read as**: "survival_rate correlates so strongly with outcome (ρ=0.812) that it may be measuring outcome directly rather than predicting it. Remove or redesign this feature."

## Interpretation Guide

### When d is Low (< 0.35)
**Problem**: Model has weak predictive power
**Likely causes**:
- Missing key predictive features
- Weights calibrated on training data only (overfit)
- Outcome defined differently than scoring logic expects
- Small sample size (< 100)

**Action**: 
1. Check CI: if CI > 0.35, might just be small sample
2. Run per-concept breakdown: maybe some concepts are predictable, others aren't
3. Audit circular predictors: ensure no leakage
4. Consider adding new data sources (foot traffic, business hours, etc.)

### When AUC is Poor (< 0.60)
**Problem**: Model barely beats random coin flip
**Likely causes**:
- Scores don't differentiate successes from failures
- Outcome is influenced by factors unmeasured by scores (landlord quality, founder skill)
- Outcome is driven by structural factors (zoning, rent) not current neighborhood state

**Action**:
1. Check if AUC CI includes 0.5 (if so, not significantly better than random)
2. Examine per-concept breakdown: identify weak vs. strong concepts
3. Consider outcome redefinition (maybe success = "survived 3+ years" not "is currently operating")
4. Validate that outcome labels are accurate

### When CV Std is High (> 0.10)
**Problem**: Model is unstable — performance varies across test sets
**Likely causes**:
- Small sample size (< 200)
- Concept-specific performance varies wildly
- Weights need re-calibration by concept/borough

**Action**:
1. Check per-concept breakdown: is variance driven by one concept?
2. Increase data size if possible
3. Consider separate models by borough/concept
4. Review borough-specific weights (BOROUGH_CONFIG in score-all-v4.mjs)

## Integration with Existing Code

### Reading Scores
The framework uses `enrichWithActualScores()` to fetch scores. Currently it returns synthetic data:

```javascript
async function enrichWithActualScores(validationData) {
  // TODO: Replace with actual query
  return validationData.map((row, idx) => ({
    ...row,
    location_iq: 50 + Math.random() * 40,  // ← Replace with DB query
    vision_iq: 45 + Math.random() * 45,
    fit_iq: 48 + Math.random() * 42,
    outcome: (idx % 2) ? 1 : 0,  // ← Replace with truth label
  }));
}
```

To connect to real data:
```javascript
async function enrichWithActualScores(validationData) {
  const { data: scores } = await supabase
    .from('location_scores')
    .select('geoid, concept_type, location_iq, vision_iq, fit_iq')
    .in('geoid', validationData.map(r => r.geoid));
  
  const { data: outcomes } = await supabase
    .from('location_outcomes')
    .select('geoid, concept_type, outcome');
  
  // ... merge and return
}
```

### Reading from Block Group Scores
If you have block group level scores instead of geoid:

```javascript
async function enrichWithActualScores(validationData) {
  // Map geohash to block_group_id first
  const bgScores = await supabase
    .from('block_group_scores')
    .select('geoid, location_iq_v2, location_sub_safety, location_sub_momentum')
    .in('geoid', validationData.map(r => r.geoid));
  
  // Rename and enrich
  return validationData.map(vd => {
    const score = bgScores.find(s => s.geoid === vd.geoid);
    return {
      ...vd,
      location_iq: score?.location_iq_v2 || 50,
      outcome: ..., // fetch separately
    };
  });
}
```

## Statistics Methodology

### Cohen's d Formula
```
d = (mean_success - mean_failure) / pooled_std_dev

where:
  pooled_std_dev = sqrt((var_success + var_failure) / 2)
```

### AUC-ROC Calculation
Counts concordant pairs (success ranked higher than failure) / total possible pairs.

### Bootstrap CI Method
1. Resample the holdout set N=1000 times with replacement
2. Compute metric (d or AUC) on each resample
3. Sort the 1000 values
4. Take 2.5th and 97.5th percentiles for 95% CI

## Performance Notes

- **Runtime**: ~2-5 seconds for 1000s of records (mostly Supabase queries)
- **Memory**: ~100MB for 10K records
- **Bootstrap**: 1000 resamples per metric, takes ~1 second per metric

## Known Limitations

1. **Synthetic Data**: Currently uses placeholder scores. Requires real score integration.
2. **Geoid Mapping**: Ground truth uses geohash, scores use geoid. Need lookup table.
3. **Outcome Definition**: Requires defining what "success" means for your business.
4. **Concept-Outcome Pairing**: Need to know which concepts apply to each location.

## Future Enhancements

- [ ] Integrate with location_scores table once populated
- [ ] Add stratified k-fold (balanced by success/failure)
- [ ] Compute per-borough metrics (different models for different markets)
- [ ] Add ROC curve plotting (export coordinates for visualization)
- [ ] Add feature importance ranking (which inputs drive d the most?)
- [ ] Parallel fold execution (--parallel flag)
- [ ] Continuous monitoring (write to DB, track d over time)

## References

- **Cohen, J.** (1988). Statistical Power Analysis for the Behavioral Sciences (2nd ed.)
  - d = 0.2 (small), 0.5 (medium), 0.8 (large)
- **Fawcett, T.** (2006). "An introduction to ROC analysis." Pattern Recognition Letters
  - AUC interpretation and relationship to Wilcoxon statistic
- **Efron, B. & Tibshirani, R.** (1993). An Introduction to the Bootstrap
  - Percentile method for confidence intervals

---

**Author**: RE² Team  
**Created**: April 2026  
**Status**: Production Ready (Data Integration Pending)
