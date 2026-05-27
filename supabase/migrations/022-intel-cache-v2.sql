-- Migration 022: intel_cache v2 schema
-- The code in src/lib/intel/index.ts (FIX-019) was updated to use:
--   cache_key, source, data, ttl_ms, fetched_at
-- But the migration that creates those columns was never written.
-- The old table used: lat, lng, business_type, report, expires_at
-- This migration renames the old table to preserve data, then creates the
-- new table matching what index.ts expects.
-- Run in Supabase SQL editor.

-- Step 1: Preserve old data
ALTER TABLE intel_cache RENAME TO intel_cache_legacy;

-- Step 2: New table with schema index.ts expects
CREATE TABLE intel_cache (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cache_key   text UNIQUE NOT NULL,
  source      text NOT NULL DEFAULT 'location-intel',
  data        jsonb NOT NULL,
  ttl_ms      bigint NOT NULL DEFAULT 604800000, -- 7 days in ms
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intel_cache_key     ON intel_cache(cache_key);
CREATE INDEX idx_intel_cache_fetched ON intel_cache(fetched_at);

-- Step 3: RLS — service role bypasses, anon reads nothing
ALTER TABLE intel_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON intel_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 4: RPC for atomic upsert (used by cache write in index.ts)
CREATE OR REPLACE FUNCTION upsert_intel_cache(
  p_cache_key text,
  p_source    text,
  p_data      jsonb,
  p_ttl_ms    bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO intel_cache(cache_key, source, data, ttl_ms, fetched_at)
  VALUES (p_cache_key, p_source, p_data, p_ttl_ms, now())
  ON CONFLICT (cache_key)
  DO UPDATE SET
    data       = EXCLUDED.data,
    source     = EXCLUDED.source,
    ttl_ms     = EXCLUDED.ttl_ms,
    fetched_at = now();
END;
$$;
