# RE² Scoring Validation Framework — File Index

## Quick Start
```bash
node scripts/scoring-validation.mjs              # Full validation
node scripts/scoring-validation.mjs --dry-run    # Data audit only
node scripts/scoring-validation.mjs --fold=2     # Specific fold
```

## Files Delivered

### 1. Core Framework
**`scripts/scoring-validation.mjs`** (27 KB, 697 lines)
- Complete validation framework with statistical functions
- Deterministic 80/20 holdout partitioning (geoid-based hash)
- Metrics: Cohen's d, AUC-ROC, bootstrap CI, 5-fold CV
- Circular predictor detection (Pearson ρ audit)
- Per-concept breakdown
- Three output modes: dry-run, single fold, full validation
- Dependencies: @supabase/supabase-js only

### 2. Documentation
**`SCORING-VALIDATION-README.md`** (11 KB)
- Complete methodology documentation
- Usage examples and interpretation guide
- Data requirements and current status
- Integration instructions for Supabase tables
- Statistical formulas and references
- Performance notes and future enhancements

### 3. Integration Examples
**`scripts/scoring-validation-integration-example.mjs`** (13 KB)
Five copy-paste implementations:
1. `enrichWithActualScores_LocationTables()` — location_scores + location_outcomes tables
2. `enrichWithActualScores_BlockGroupV4()` — V4 schema (block_group_scores)
3. `enrichWithActualScores_RegressionData()` — regression test data
4. `enrichWithActualScores_CSVFile()` — offline CSV mode
5. `enrichWithActualScores_MultiSourceFallback()` — robust hybrid approach

## What the Framework Does

### Input
- Reads historical_ground_truths from Supabase (15 Power Broker reference entries)
- Accepts location scores (location_iq, vision_iq, fit_iq) per geoid/concept
- Requires outcome labels (1=success, 0=failure)

### Processing
1. **Deterministic split**: 80% train, 20% holdout (hash-based, reproducible)
2. **Compute metrics on holdout only**:
   - Cohen's d: effect size between success/failure distributions
   - AUC-ROC: discrimination (probability of ranking success > failure)
   - Bootstrap CIs: 1000 resamples, 95% confidence
   - 5-fold CV: mean ± std across folds
3. **Per-concept breakdown**: separate results by concept type
4. **Circular predictor audit**: flag features with ρ > 0.5 to outcome

### Output
- **stdout**: Human-readable report with interpretation
- **scripts/validation-results.json**: Machine-readable JSON results

## Key Metrics Explained

### Cohen's d (Effect Size)
- Standardized difference: (μ_success - μ_failure) / pooled_σ
- **d > 0.8** = large effect, **d > 0.5** = medium, **d > 0.2** = small
- **d < 0.2** = negligible (model can't differentiate)
- 95% CI: bootstrap confidence interval (1000 resamples)

### AUC-ROC (Discrimination)
- Probability that model ranks random success > random failure
- **AUC = 0.5** = random chance, **0.6** = poor, **0.7** = fair, **0.8+** = good
- Robust to class imbalance (unlike accuracy)
- 95% CI: bootstrap confidence interval

### Cross-Validation Std
- **std < 0.05** = very stable ✓
- **std 0.05-0.10** = stable ✓
- **std > 0.10** = unstable (may be overfit or small sample)

### Circular Predictor Check
- Pearson correlation (ρ) between each feature and outcome
- **|ρ| > 0.7** = likely circular or data leakage (remove feature)
- **|ρ| > 0.5** = suspicious (investigate)
- **|ρ| < 0.5** = OK (no circular reasoning detected)

## Implementation Status

### Fully Implemented ✓
- Deterministic holdout splitting
- Cohen's d computation (from scratch)
- AUC-ROC computation (from scratch)
- Bootstrap 95% CIs (1000 resamples each)
- 5-fold cross-validation
- Per-concept breakdown
- Pearson correlation calculation
- Human and JSON output
- All three usage modes (dry-run, full, fold-specific)

### Data Integration (Examples Provided)
- Currently uses synthetic data for proof-of-concept
- 5 integration examples in scoring-validation-integration-example.mjs
- Ready to connect to real location_scores + location_outcomes tables

## Red Flags to Watch For

| Finding | Interpretation | Action |
|---------|---|---|
| d < 0.35 (n > 200) | Weak predictive power | Review features, check outcome definition |
| AUC < 0.60 | Barely better than random | Diagnose with per-concept breakdown |
| CV std > 0.10 | Unstable across folds | Small sample or overfit? Check per-concept |
| ρ > 0.7 on feature | Circular reasoning | Remove or redesign feature |
| Holdout size = 0 | No test set | Check hash function or data split |

## Usage Patterns

### Dry Run (Fast Sanity Check)
```bash
node scripts/scoring-validation.mjs --dry-run
# Output: data counts only, ~100ms
```
Use: Before full validation to verify data is loaded

### Single Fold (Debug One Test Set)
```bash
node scripts/scoring-validation.mjs --fold=0
# Output: metrics for fold 0/5 only, ~1 second
```
Use: Debugging or parallel execution across multiple machines

### Full Validation (Complete Analysis)
```bash
node scripts/scoring-validation.mjs
# Output: holdout metrics + 5-fold CV + per-concept + audit, ~3 seconds
```
Use: Production validation, comprehensive report

## Data Integration Steps

1. **Ensure Supabase tables exist**:
   ```sql
   CREATE TABLE location_scores(geoid TEXT, concept_type TEXT, location_iq NUMERIC, ...);
   CREATE TABLE location_outcomes(geoid TEXT, concept_type TEXT, outcome INT, ...);
   ```

2. **Choose integration approach** from scoring-validation-integration-example.mjs

3. **Replace placeholder function**:
   Find `enrichWithActualScores()` in scoring-validation.mjs
   Replace with chosen integration (copy from examples)

4. **Run**:
   ```bash
   node scripts/scoring-validation.mjs
   ```

## Interpretation Flow

1. **Check holdout metrics first**
   - d: effect size (medium/large = good)
   - AUC: discrimination (>0.70 = good)
   - CI: if CI > 0.5 for AUC, beats random

2. **Verify consistency with CV**
   - std < 0.05: very stable ✓
   - std > 0.10: unstable, needs investigation

3. **Diagnose with per-concept breakdown**
   - Is low d everywhere or one concept?
   - Is one concept driving the result?

4. **Validate with circular audit**
   - STATUS: PASS = no data leakage ✓
   - STATUS: ALERT = review flagged features

## References

- **Cohen, J.** (1988). Statistical Power Analysis for the Behavioral Sciences
- **Fawcett, T.** (2006). "An introduction to ROC analysis." Pattern Recognition Letters
- **Efron, B. & Tibshirani, R.** (1993). An Introduction to the Bootstrap

## Support

For detailed methodology, see: `SCORING-VALIDATION-README.md`
For integration examples, see: `scripts/scoring-validation-integration-example.mjs`

---
**Status**: Production Ready (Data Integration Pending)  
**Last Updated**: April 9, 2026
