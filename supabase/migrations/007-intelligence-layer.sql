-- ============================================================
-- Migration 007: Intelligence Layer — Full Data Capture Schema
-- From RE2_Intelligence_Build_Spec Section 8
--
-- Tables: conversation_messages, founder_profiles,
--         founder_corrections, location_searches,
--         api_extractions, neighborhood_intelligence
-- ============================================================

-- 1. Conversation Messages — Full transcript with metadata
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ai', 'founder', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  model_tier TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conv_messages_session ON public.conversation_messages(session_id);
CREATE INDEX idx_conv_messages_created ON public.conversation_messages(created_at);

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_messages_service_all"
  ON public.conversation_messages FOR ALL
  USING (true) WITH CHECK (true);

-- 2. Founder Profiles — Structured extract from conversation
CREATE TABLE IF NOT EXISTS public.founder_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  user_id TEXT,
  persona_type TEXT NOT NULL,
  concept_name TEXT,
  concept_description TEXT,
  target_customers TEXT[] DEFAULT '{}',
  differentiators TEXT[] DEFAULT '{}',
  financial_estimates JSONB DEFAULT '{}',
  scoring_hints JSONB DEFAULT '{}',
  conversation_phase TEXT DEFAULT 'business_type',
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_founder_profiles_persona ON public.founder_profiles(persona_type);
CREATE INDEX idx_founder_profiles_user ON public.founder_profiles(user_id);

ALTER TABLE public.founder_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "founder_profiles_service_all"
  ON public.founder_profiles FOR ALL
  USING (true) WITH CHECK (true);

-- 3. Founder Corrections — When founders adjust AI suggestions
CREATE TABLE IF NOT EXISTS public.founder_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  correction_type TEXT NOT NULL CHECK (correction_type IN (
    'financial_estimate',
    'target_customer',
    'differentiator',
    'concept_detail',
    'location_preference',
    'smart_default_adjust',
    'smart_default_reject',
    'ai_coaching_reject'
  )),
  field_name TEXT NOT NULL,
  ai_suggested_value JSONB,
  founder_value JSONB,
  persona_type TEXT NOT NULL,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_corrections_persona ON public.founder_corrections(persona_type);
CREATE INDEX idx_corrections_type ON public.founder_corrections(correction_type);
CREATE INDEX idx_corrections_field ON public.founder_corrections(field_name);

ALTER TABLE public.founder_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corrections_service_all"
  ON public.founder_corrections FOR ALL
  USING (true) WITH CHECK (true);

-- 4. Location Searches — Every address scored with full context
CREATE TABLE IF NOT EXISTS public.location_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  address TEXT NOT NULL,
  neighborhood TEXT,
  borough TEXT,
  geohash TEXT NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  persona_type TEXT NOT NULL,
  concept_description TEXT,
  location_iq INTEGER,
  fit_iq INTEGER,
  six_indices JSONB DEFAULT '{}',
  heads_up_cards JSONB DEFAULT '[]',
  business_model JSONB DEFAULT '{}',
  api_sources_status JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_searches_geohash ON public.location_searches(geohash);
CREATE INDEX idx_searches_persona ON public.location_searches(persona_type);
CREATE INDEX idx_searches_neighborhood ON public.location_searches(neighborhood, persona_type);
CREATE INDEX idx_searches_score ON public.location_searches(location_iq);

ALTER TABLE public.location_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "searches_service_all"
  ON public.location_searches FOR ALL
  USING (true) WITH CHECK (true);

-- 5. API Extractions — Cached Haiku-extracted intelligence per API source
CREATE TABLE IF NOT EXISTS public.api_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  geohash TEXT NOT NULL,
  address TEXT NOT NULL,
  raw_response JSONB NOT NULL,
  extracted_intelligence JSONB NOT NULL,
  persona_type TEXT,
  model_tier TEXT DEFAULT 'haiku',
  tokens_used INTEGER,
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_extractions_lookup ON public.api_extractions(source, geohash);
CREATE INDEX idx_extractions_expires ON public.api_extractions(expires_at);

ALTER TABLE public.api_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extractions_public_read"
  ON public.api_extractions FOR SELECT
  USING (true);

CREATE POLICY "extractions_service_write"
  ON public.api_extractions FOR ALL
  USING (true) WITH CHECK (true);

-- 6. Neighborhood Intelligence — Aggregated block-level stats
-- (Richer version than migration 006's location_intelligence)
CREATE TABLE IF NOT EXISTS public.neighborhood_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geohash TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  borough TEXT NOT NULL,
  persona_type TEXT NOT NULL,
  total_searches INTEGER DEFAULT 0,
  avg_location_iq NUMERIC,
  avg_fit_iq NUMERIC,
  avg_six_indices JSONB DEFAULT '{}',
  common_heads_up TEXT[] DEFAULT '{}',
  avg_success_probability NUMERIC,
  correction_patterns JSONB DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(geohash, persona_type)
);

CREATE INDEX idx_neighborhood_intel ON public.neighborhood_intelligence(neighborhood, persona_type);

ALTER TABLE public.neighborhood_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "neighborhood_intel_public_read"
  ON public.neighborhood_intelligence FOR SELECT
  USING (true);

CREATE POLICY "neighborhood_intel_service_write"
  ON public.neighborhood_intelligence FOR ALL
  USING (true) WITH CHECK (true);
