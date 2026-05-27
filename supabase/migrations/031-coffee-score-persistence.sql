-- Coffee Score Persistence (Addendum to Coffee Scoring Rewire Spec)
--
-- Adds a JSONB column to score_events for storing complete coffee score results.
-- This enables "score once, serve always" — same address + concept + inputs =
-- identical score on every visit, with zero tolerance.
--
-- The coffee_score blob contains: compositeScore, dimensionScores (6 dims),
-- watchOuts[], visionMultiplier, formulaVersion, scoredAt, inputSnapshot,
-- confidenceLevel, grade, verdict.

ALTER TABLE score_events
ADD COLUMN IF NOT EXISTS coffee_score JSONB DEFAULT NULL;

-- Index for fast lookup by concept + location (rounded lat/lng)
-- Used by getStoredCoffeeScore() to find previous scores
CREATE INDEX IF NOT EXISTS idx_score_events_coffee_lookup
ON score_events (concept, lat, lng, computed_at DESC)
WHERE coffee_score IS NOT NULL;

COMMENT ON COLUMN score_events.coffee_score IS
'Complete stored coffee score (6-dim + watch-outs + inputSnapshot). Serves identical results on return visits. See COFFEE_FORMULA_VERSION for versioning.';
