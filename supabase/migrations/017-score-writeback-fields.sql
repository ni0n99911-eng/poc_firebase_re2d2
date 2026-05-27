-- Migration 017: BR-5 score writeback fields
-- Backfills scorer_version and inputs_hash into each location object
-- inside the founder_sessions.shortlisted_locations JSONB array.
--
-- NOTE: shortlisted_locations is a JSONB array column on founder_sessions,
-- not a separate table. scored_at already exists as 'scoredAt' (ms epoch) per M015.
-- This migration adds scorer_version and inputs_hash to legacy rows.

UPDATE founder_sessions
SET shortlisted_locations = (
  SELECT jsonb_agg(
    elem || jsonb_build_object(
      'scorer_version', COALESCE(elem->>'scorer_version', 'v4.legacy'),
      'inputs_hash',    COALESCE(elem->>'inputs_hash', 'legacy')
    )
  )
  FROM jsonb_array_elements(shortlisted_locations) AS elem
)
WHERE shortlisted_locations IS NOT NULL
  AND jsonb_array_length(shortlisted_locations) > 0
  AND shortlisted_locations @? '$[*] ? (!exists(@."scorer_version"))';
