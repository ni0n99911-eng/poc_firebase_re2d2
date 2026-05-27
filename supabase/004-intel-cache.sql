-- ============================================================
-- 004: Persistent Intel Cache (L2)
-- ============================================================
-- Stores API responses with source-appropriate TTLs so repeat
-- lookups for the same location hit Supabase instead of burning
-- external API quota.  The app still uses an in-memory L1 cache
-- (IntelCache class) for sub-millisecond hits within the same
-- function invocation.
--
-- Key design:
--   cache_key  = "<layer>:<lat>,<lng>"  (same format as IntelCache.locationKey)
--   data       = JSONB blob (the raw API response)
--   fetched_at = when the data was originally fetched
--   ttl_ms     = source-specific TTL in milliseconds
--   expires_at = computed column for easy "is it fresh?" queries
-- ============================================================

CREATE TABLE IF NOT EXISTS intel_cache (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cache_key   TEXT NOT NULL,
    source      TEXT NOT NULL,           -- e.g. 'census', 'crime', 'google-places'
    data        JSONB NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ttl_ms      INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookups by cache_key (the primary access pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_intel_cache_key ON intel_cache (cache_key);

-- For cleanup jobs: find stale entries by fetched_at
CREATE INDEX IF NOT EXISTS idx_intel_cache_fetched ON intel_cache (fetched_at);

-- For monitoring: count by source
CREATE INDEX IF NOT EXISTS idx_intel_cache_source ON intel_cache (source);

-- ============================================================
-- Upsert function — called from the app's cache.set()
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_intel_cache(
    p_cache_key  TEXT,
    p_source     TEXT,
    p_data       JSONB,
    p_ttl_ms     INTEGER
) RETURNS VOID AS $$
BEGIN
    INSERT INTO intel_cache (cache_key, source, data, fetched_at, ttl_ms)
    VALUES (p_cache_key, p_source, p_data, now(), p_ttl_ms)
    ON CONFLICT (cache_key) DO UPDATE SET
        source     = EXCLUDED.source,
        data       = EXCLUDED.data,
        fetched_at = EXCLUDED.fetched_at,
        ttl_ms     = EXCLUDED.ttl_ms;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Cleanup: delete entries that expired more than 24h ago
-- Run via pg_cron or a scheduled Netlify function
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_cache() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete entries where (age in ms) > ttl_ms + 24 hours buffer
    DELETE FROM intel_cache
    WHERE (extract(epoch from now()) - extract(epoch from fetched_at)) * 1000 > ttl_ms + 86400000;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS: intel_cache is server-side only (service_role key).
-- Enable RLS but create no user-facing policies — only the
-- service role can read/write.
-- ============================================================
ALTER TABLE intel_cache ENABLE ROW LEVEL SECURITY;

-- Allow the service role full access (it bypasses RLS anyway,
-- but this makes intent explicit)
CREATE POLICY "Service role full access on intel_cache"
    ON intel_cache
    FOR ALL
    USING (true)
    WITH CHECK (true);
