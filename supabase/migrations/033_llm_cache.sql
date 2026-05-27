-- B2-T2: LLM response cache (24h TTL).
-- Wraps every Haiku/Sonnet/Claude call via getCachedOrFetch(prompt, model, ttl).
-- Same model+prompt within the TTL window returns the stored response instead
-- of re-hitting OpenRouter. Drops cold-cache /api/copilot/location latency
-- from 7-21s down to <500ms on the second call for the same input.

CREATE TABLE IF NOT EXISTS public.llm_cache (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- SHA-256 hash of (model + ':' + prompt). Hex-encoded, 64 chars.
    cache_key   TEXT NOT NULL UNIQUE,
    model       TEXT NOT NULL,         -- e.g. 'anthropic/claude-sonnet-4'
    response    JSONB NOT NULL,        -- full provider response, parsed
    tokens_in   INTEGER,               -- captured for telemetry parity with ai_calls
    tokens_out  INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    -- Free-form context for analysis: route name, action, etc. No PII / no raw prompts here.
    metadata    JSONB DEFAULT '{}'
);

-- Primary lookup: cache_key (already UNIQUE → indexed). Add expires_at for
-- cleanup queries and created_at for usage analytics.
CREATE INDEX IF NOT EXISTS llm_cache_expires_at_idx ON public.llm_cache (expires_at);
CREATE INDEX IF NOT EXISTS llm_cache_created_at_idx ON public.llm_cache (created_at DESC);
CREATE INDEX IF NOT EXISTS llm_cache_model_idx      ON public.llm_cache (model, created_at DESC);

-- RLS: service-role only. The helper runs server-side via getServiceSupabase().
ALTER TABLE public.llm_cache ENABLE ROW LEVEL SECURITY;

-- Optional: a scheduled job (pg_cron or external) can run periodically to
-- delete expired entries. The helper itself doesn't depend on this — it
-- treats expired rows as misses on read. But keeping the table small helps
-- index lookup speed.
COMMENT ON TABLE  public.llm_cache IS 'B2-T2: 24h LLM response cache. Service-role only. Expired rows are treated as misses, not auto-deleted.';
COMMENT ON COLUMN public.llm_cache.cache_key IS 'SHA-256 hex of (model + ":" + prompt). Stable across processes.';
COMMENT ON COLUMN public.llm_cache.metadata IS 'No raw prompts, no PII. Analytics tags only (route, action).';
