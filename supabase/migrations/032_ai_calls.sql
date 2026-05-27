-- B2-0.2: AI call telemetry (skeleton only — no enforcement yet).
-- Every server-side LLM invocation emits a row here with token counts + cost.
-- Phase 0 scope: observe, don't throttle. Phase 2 will add budget caps.

CREATE TABLE IF NOT EXISTS public.ai_calls (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      TEXT,                 -- Clerk user_id; null for anon
    session_id   TEXT,                 -- from getOrCreateSessionId()
    route        TEXT NOT NULL,        -- e.g. '/api/copilot/location', '/api/ai', 'claude.generateLocationNarrative'
    model        TEXT NOT NULL,        -- e.g. 'anthropic/claude-sonnet-4', 'anthropic/claude-haiku-4'
    tokens_in    INTEGER,              -- prompt tokens (null if provider didn't report)
    tokens_out   INTEGER,              -- completion tokens
    cost_usd     NUMERIC(10, 6),       -- computed cost in USD, 6-decimal precision
    duration_ms  INTEGER,              -- end-to-end latency of the LLM call
    status       TEXT NOT NULL DEFAULT 'ok',  -- 'ok' | 'error' | 'timeout'
    error_code   TEXT,                 -- provider error code / HTTP status when status != 'ok'
    metadata     JSONB DEFAULT '{}',   -- free-form: action name, concept, address hash, etc.
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the most common queries: cost-by-user, cost-by-day, error rate by route.
CREATE INDEX IF NOT EXISTS ai_calls_created_at_idx    ON public.ai_calls (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_calls_user_created_idx  ON public.ai_calls (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_calls_route_idx         ON public.ai_calls (route, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_calls_status_idx        ON public.ai_calls (status) WHERE status <> 'ok';

-- RLS: only service-role can write or read. Client code must go through
-- server routes (the telemetry helper runs server-side exclusively).
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  public.ai_calls IS 'B2-0.2: Per-invocation LLM telemetry. Service-role only (no direct client access).';
COMMENT ON COLUMN public.ai_calls.cost_usd IS 'Computed from model pricing at call time. Null if model unknown.';
COMMENT ON COLUMN public.ai_calls.metadata IS 'Free-form tags. Use sparingly — no raw prompts or PII.';
