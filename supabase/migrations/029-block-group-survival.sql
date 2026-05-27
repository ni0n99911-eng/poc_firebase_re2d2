-- 029-block-group-survival.sql
-- Block-group-level survival rates derived from DOHMH inspection data.
-- Consumed by: survival-rate.ts (getSurvivalRate)
-- Produced by: scripts/aggregate-dohmh-survival.mjs

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Block Group Survival — one row per census block group
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS block_group_survival (
  geoid           TEXT PRIMARY KEY,
  food_survival_rate NUMERIC(5,4) NOT NULL,   -- 0.0000 – 1.0000
  sample_size     INTEGER NOT NULL DEFAULT 0,
  confidence      TEXT NOT NULL DEFAULT 'NONE'
                  CHECK (confidence IN ('HIGH','MEDIUM','LOW','NONE')),
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  block_group_survival IS 'DOHMH-derived food business survival rates per census block group';
COMMENT ON COLUMN block_group_survival.food_survival_rate IS 'Fraction of DOHMH businesses maintaining A/B grade over 3+ consecutive inspections';
COMMENT ON COLUMN block_group_survival.confidence IS 'HIGH (>=10 biz), MEDIUM (4-9), LOW (1-3), NONE (0)';

-- Index for borough-median aggregation query (first 7 chars of geoid = state+county+tract prefix, but borough lookup uses a join)
CREATE INDEX IF NOT EXISTS idx_bgs_confidence ON block_group_survival (confidence);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Borough Survival Medians — one row per borough
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS borough_survival_medians (
  borough         TEXT PRIMARY KEY,
  median_survival_rate NUMERIC(5,4) NOT NULL,
  block_groups_counted INTEGER NOT NULL DEFAULT 0,
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  borough_survival_medians IS 'Borough-level median food survival rate (fallback when block group has no DOHMH data)';
COMMENT ON COLUMN borough_survival_medians.median_survival_rate IS 'Median of all block_group_survival.food_survival_rate values within the borough';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RLS — service role only (script + server-side reads)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE block_group_survival ENABLE ROW LEVEL SECURITY;
ALTER TABLE borough_survival_medians ENABLE ROW LEVEL SECURITY;

-- Allow authenticated reads (SvelteKit server routes use service role, but
-- future client reads should also work for logged-in users)
CREATE POLICY "Allow authenticated read on block_group_survival"
  ON block_group_survival FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on borough_survival_medians"
  ON borough_survival_medians FOR SELECT
  TO authenticated
  USING (true);

-- Service role gets full access (for the aggregation script)
CREATE POLICY "Service role full access on block_group_survival"
  ON block_group_survival FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on borough_survival_medians"
  ON borough_survival_medians FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
