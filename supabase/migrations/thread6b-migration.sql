-- ═══════════════════════════════════════════════════════
-- Migration: Thread 6B — Bot Intelligence Tables
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

BEGIN;

-- ─── founder_sessions: RE2D2 onboarding state ───────────
-- Stores the user's onboarding progress and answers.
-- One row per user (upserted on each answer).
CREATE TABLE IF NOT EXISTS public.founder_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,            -- Clerk user ID
  current_step INTEGER NOT NULL DEFAULT 1, -- 1-10
  answers JSONB NOT NULL DEFAULT '{}',     -- All answers keyed by field name
  last_answer TEXT,                         -- Most recent answer text
  fit_progress INTEGER DEFAULT 0,           -- 0-100 profile completeness
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fs_user ON public.founder_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fs_updated ON public.founder_sessions(updated_at DESC);

-- RLS: Enabled but wide-open policies.
-- RATIONALE (M3): All access goes through service-role endpoints that validate
-- auth via Clerk JWT in auth-middleware.ts. The service-role key bypasses RLS
-- anyway, so these policies only affect anon-key access (which we don't use).
-- POST-LAUNCH TODO: Lock down to USING (user_id = auth.uid()) once Clerk→Supabase
-- JWT claim mapping is configured. Track in backlog.
ALTER TABLE public.founder_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions" ON public.founder_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- ─── copilot_conversations: Track copilot interactions ──
-- Logs each copilot request/response for analytics + debugging.
CREATE TABLE IF NOT EXISTS public.copilot_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  copilot_type TEXT NOT NULL,              -- 're2d2', 'location', 'business'
  geoid TEXT,                               -- Block group (null for RE2D2)
  action TEXT NOT NULL,                     -- 'initial_analysis', 'explain_score', etc.
  request_data JSONB DEFAULT '{}',          -- Sanitized request (no secrets)
  response_summary TEXT,                    -- First 200 chars of response
  model_used TEXT,                          -- 'claude-sonnet-4' etc.
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_user ON public.copilot_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_type ON public.copilot_conversations(copilot_type);
CREATE INDEX IF NOT EXISTS idx_cc_geoid ON public.copilot_conversations(geoid);

-- RLS: Wide-open — same rationale as founder_sessions (M3). Service-role only.
ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access conversations" ON public.copilot_conversations
  FOR ALL USING (true) WITH CHECK (true);

-- ─── fit_iq_cache: Cache computed Fit IQ results ─────────
-- Avoids recomputing for the same user + geoid + business type.
CREATE TABLE IF NOT EXISTS public.fit_iq_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  geoid TEXT NOT NULL,
  business_type TEXT NOT NULL,
  fit_iq INTEGER NOT NULL,                  -- 0-100
  grade TEXT NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '[]',   -- Array of dimension scores
  archetype TEXT,
  archetype_score INTEGER,
  alignment INTEGER,                        -- Fit IQ - Location IQ
  launchpad_hash TEXT,                      -- Hash of launchpad to detect changes
  computed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  CONSTRAINT fit_iq_cache_unique UNIQUE (user_id, geoid, business_type)
);

CREATE INDEX IF NOT EXISTS idx_fic_user ON public.fit_iq_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_fic_geoid ON public.fit_iq_cache(geoid);
CREATE INDEX IF NOT EXISTS idx_fic_expires ON public.fit_iq_cache(expires_at);

-- RLS: Wide-open — same rationale as founder_sessions (M3). Service-role only.
ALTER TABLE public.fit_iq_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access fit_iq_cache" ON public.fit_iq_cache
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Cleanup function ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_fit_iq_cache()
RETURNS void AS $$
  DELETE FROM public.fit_iq_cache WHERE expires_at < now();
$$ LANGUAGE sql;

COMMIT;
