-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 028: score_events — ML training log
--
-- Every Location IQ computation writes one row here (fire-and-forget from
-- score-logger.ts). Rows accumulate as raw training data: inputs (geoid +
-- concept) mapped to outputs (three IQ scores + confidence). Outcome labels
-- will be joined later via geoid + concept + time window.
--
-- ML-01 | Brain 2 | April 12 2026
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS score_events (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Location + concept (join keys for ML training)
    geoid                TEXT,                          -- Census block group GEOID (11-digit)
    concept              TEXT         NOT NULL,         -- businessType slug (e.g. 'specialty_coffee')
    borough              TEXT,                          -- 'Manhattan' | 'Brooklyn' | etc.

    -- Three-score architecture outputs
    location_iq          NUMERIC(5,1),                  -- six-index composite (user-facing LocationIQ)
    fit_iq               NUMERIC(5,1),                  -- batch-calibrated FitIQ for this concept
    vision_iq            NUMERIC(5,1),                  -- batch-calibrated VisionIQ for this concept
    composite            NUMERIC(5,1),                  -- raw NIQ/SIQ/TIQ/LIQ composite (location-iq.ts)

    -- Confidence
    survival_confidence  NUMERIC(5,2),                  -- 0.00–100.00 (confidence.percentage)

    -- Geo coordinates (for spatial queries + geoid backfill)
    lat                  NUMERIC(9,6),
    lng                  NUMERIC(9,6),

    -- Source coverage
    source_count         SMALLINT,                      -- how many of 20 sources returned data
    errors_count         SMALLINT,                      -- how many sources failed this run

    -- Timing
    computation_ms       INTEGER,                       -- full pipeline wall-clock time
    computed_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Indexes for ML training queries ──────────────────────────────────────────

-- Most common: "give me all events for geoid X and concept Y"
CREATE INDEX IF NOT EXISTS score_events_geoid_concept_idx
    ON score_events (geoid, concept);

-- Time-series queries: "scores computed in the last 30 days"
CREATE INDEX IF NOT EXISTS score_events_computed_at_idx
    ON score_events (computed_at DESC);

-- Borough-level aggregation: "average FitIQ for coffee in Brooklyn"
CREATE INDEX IF NOT EXISTS score_events_borough_concept_idx
    ON score_events (borough, concept);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- score_events are internal ML data — no user-level RLS needed.
-- Service role writes (from score-logger.ts). No public reads.
ALTER TABLE score_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- No user-facing SELECT policy — internal table only.

-- ── Comment ───────────────────────────────────────────────────────────────────
COMMENT ON TABLE score_events IS
    'ML training log — one row per Location IQ computation. '
    'Keyed by geoid+concept for future outcome label joins. '
    'Written fire-and-forget from score-logger.ts. Never block scoring on log writes.';
