-- 030-concept-distribution-stats.sql
-- F-18: Concept distribution stats computed by refresh-concept-distribution.mjs

CREATE TABLE IF NOT EXISTS concept_distribution_stats (
  concept        TEXT NOT NULL,
  borough        TEXT NOT NULL DEFAULT 'ALL',  -- borough name or 'ALL' for citywide
  count          INTEGER NOT NULL DEFAULT 0,
  mean_score     NUMERIC(6,2),
  median_score   NUMERIC(6,2),
  stddev         NUMERIC(6,2),
  p25            NUMERIC(6,2),
  p75            NUMERIC(6,2),
  min_score      NUMERIC(6,2),
  max_score      NUMERIC(6,2),
  last_updated   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (concept, borough)
);

COMMENT ON TABLE concept_distribution_stats IS 'Fit IQ score distribution per concept per borough — feeds dynamic-concept-config calibration';

ALTER TABLE concept_distribution_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read on concept_distribution_stats"
  ON concept_distribution_stats FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access on concept_distribution_stats"
  ON concept_distribution_stats FOR ALL TO service_role USING (true) WITH CHECK (true);
