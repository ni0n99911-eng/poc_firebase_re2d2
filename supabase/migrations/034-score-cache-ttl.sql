-- Migration 034: Active Wipe for Stale Location Scores
-- Enforces a 20-day TTL (Time To Live) on cached LocationScoreBundles 
-- and coffee scores to comply with Google Maps 30-day storage limits.

-- 1. Create a function to perform the active wipe
CREATE OR REPLACE FUNCTION wipe_stale_location_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete from intel_cache where data is older than 20 days
  DELETE FROM intel_cache
  WHERE fetched_at < NOW() - INTERVAL '20 days';

  -- Delete from score_events where it's a coffee score and older than 20 days
  DELETE FROM score_events
  WHERE coffee_score IS NOT NULL 
  AND computed_at < NOW() - INTERVAL '20 days';
END;
$$;

-- 2. Schedule the wipe using pg_cron to run every night at 2:00 AM
-- Note: Requires pg_cron extension to be enabled in Supabase
SELECT cron.schedule(
  'wipe_stale_scores_nightly',
  '0 2 * * *',
  $$ SELECT wipe_stale_location_scores(); $$
);
