-- ═══════════════════════════════════════════════════════
-- RE² Week 1 Migration: AI Briefs, Persona Configs, Founder Sessions
-- ═══════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to create the 3 tables
-- needed for Week 1 features.

-- 1. AI Briefs Cache
-- Stores AI-generated location coaching narratives with 24h TTL
CREATE TABLE IF NOT EXISTS ai_briefs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text UNIQUE NOT NULL,
  persona_type text NOT NULL,
  address text NOT NULL,
  narrative text NOT NULL,
  composite_score numeric,
  cached_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_briefs_cache_key ON ai_briefs(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_briefs_cached_at ON ai_briefs(cached_at);

-- 2. Persona Configs (Supabase overlay for persona-defaults.json)
-- Allows runtime persona weight/label overrides without code deploys
CREATE TABLE IF NOT EXISTS persona_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_type text UNIQUE NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  active boolean DEFAULT true NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_persona_configs_type ON persona_configs(persona_type);
CREATE INDEX IF NOT EXISTS idx_persona_configs_active ON persona_configs(active);

-- 3. Founder Sessions (launchpad-store persistence)
-- Write-through from localStorage L1 → Supabase L2
CREATE TABLE IF NOT EXISTS founder_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text UNIQUE NOT NULL,
  user_id text,
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_founder_sessions_session ON founder_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_founder_sessions_user ON founder_sessions(user_id);

-- Enable RLS on all new tables
ALTER TABLE ai_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: service role has full access (used by server-side code)
-- ai_briefs: read/write via service role only
CREATE POLICY "Service role full access on ai_briefs"
  ON ai_briefs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- persona_configs: read via anon (public config), write via service role
CREATE POLICY "Anon read on persona_configs"
  ON persona_configs FOR SELECT
  USING (true);

CREATE POLICY "Service role write on persona_configs"
  ON persona_configs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- founder_sessions: read/write via service role
CREATE POLICY "Service role full access on founder_sessions"
  ON founder_sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
