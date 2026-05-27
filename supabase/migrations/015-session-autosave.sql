-- ═══════════════════════════════════════════════════════
-- RE² Migration 015: Session Auto-Save Columns
-- ═══════════════════════════════════════════════════════
-- Adds shortlisted_locations and journey_state as top-level
-- columns on founder_sessions for direct queryability.
-- Both are nullable JSONB — populated on first sync, not required.

-- shortlisted_locations: array of locations the user has compared/saved
-- e.g. [{ addr, score, fitScore, visionScore, grade, neighborhood, scoredAt }]
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'founder_sessions' AND column_name = 'shortlisted_locations'
    ) THEN
        ALTER TABLE founder_sessions ADD COLUMN shortlisted_locations jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- journey_state: tracks which major milestones the user has completed
-- e.g. { locationScored, financialsVisited, modelVisited, businessPlanGenerated }
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'founder_sessions' AND column_name = 'journey_state'
    ) THEN
        ALTER TABLE founder_sessions ADD COLUMN journey_state jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Backfill journey_state from existing data column where possible
UPDATE founder_sessions
SET journey_state = jsonb_build_object(
    'locationScored',        COALESCE((data->'session'->>'locationIQ')::numeric > 0, false),
    'financialsVisited',     COALESCE(data->'session'->>'earlyAccess' = 'true', false),
    'modelVisited',          false,
    'businessPlanGenerated', false
)
WHERE journey_state = '{}'::jsonb
  AND data IS NOT NULL
  AND data != '{}'::jsonb;

-- Index for querying by journey milestone (e.g. find all users who scored a location)
CREATE INDEX IF NOT EXISTS idx_founder_sessions_journey
    ON founder_sessions USING gin(journey_state);

CREATE INDEX IF NOT EXISTS idx_founder_sessions_shortlist
    ON founder_sessions USING gin(shortlisted_locations);
