-- ═══════════════════════════════════════════════════════════════════
-- RE² Client Data, Security & AI Migration
-- Created: March 23, 2026
-- ═══════════════════════════════════════════════════════════════════
--
-- This migration adds:
--   1. Client profiles & preferences
--   2. Search history & saved analyses
--   3. Score events (ML training data)
--   4. Client document metadata (files in Supabase Storage)
--   5. Usage analytics & API metering
--   6. AI recommendation tables (feedback loops, embeddings)
--   7. Audit log for compliance
--   8. Hardened RLS policies (replaces permissive USING(true))
--   9. Helper functions for Clerk JWT ↔ Supabase auth bridge
--
-- Run against: Supabase project jtunulrrnhekljzirynu
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────
-- 0. Clerk ↔ Supabase Auth Bridge
-- ─────────────────────────────────────────────────
-- Since RE² uses Clerk (not Supabase Auth), we need a way for RLS
-- to identify the requesting user. Server-side routes pass user_id
-- via a custom header (x-user-id) set after Clerk JWT verification.
-- This function reads that header for use in RLS policies.

CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS TEXT AS $$
BEGIN
  -- Option 1: Custom header set by SvelteKit hooks.server.ts after Clerk verification
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('app.current_user_id', true)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.requesting_user_id() IS
  'Returns the Clerk user_id for the current request. Used in RLS policies.';


-- ─────────────────────────────────────────────────
-- 1. Client Profiles
-- ─────────────────────────────────────────────────
-- Extends the basic users table (which hooks.server.ts auto-creates)
-- with business profile data the client enters.

CREATE TABLE IF NOT EXISTS public.client_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,            -- Clerk user ID (matches users.id)

  -- Business info (client-entered)
  business_name TEXT,
  business_type TEXT,                       -- cafe, restaurant, retail, etc.
  concept_description TEXT,                 -- What's your concept?
  target_neighborhoods TEXT[],              -- Preferred NYC neighborhoods
  budget_range TEXT,                        -- 'under_3k', '3k_5k', '5k_10k', '10k_plus'
  timeline TEXT,                            -- 'asap', '1_3_months', '3_6_months', '6_plus_months'

  -- Preferences
  preferred_square_footage_min INTEGER,
  preferred_square_footage_max INTEGER,
  requires_outdoor_seating BOOLEAN DEFAULT false,
  requires_liquor_license BOOLEAN DEFAULT false,

  -- Onboarding status
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_client_profiles_user ON public.client_profiles(user_id);
CREATE INDEX idx_client_profiles_business_type ON public.client_profiles(business_type);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────
-- 2. Search History
-- ─────────────────────────────────────────────────
-- Every address a client has searched (whether they saved it or not).
-- Powers "recent searches", analytics, and AI recommendations.

CREATE TABLE IF NOT EXISTS public.search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- What they searched
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  business_type TEXT NOT NULL DEFAULT 'cafe',

  -- Quick result summary (so we don't need to re-fetch)
  location_iq INTEGER,
  grade TEXT,
  confidence INTEGER,
  sources_available INTEGER,
  sources_total INTEGER,

  -- Was this saved as a scored_location?
  scored_location_id UUID REFERENCES public.scored_locations(id) ON DELETE SET NULL,

  -- Response time
  computation_time_ms INTEGER,

  -- Metadata
  ip_hash TEXT,                             -- SHA-256 of IP (for rate limiting, not tracking)
  user_agent TEXT,
  searched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_search_history_user ON public.search_history(user_id);
CREATE INDEX idx_search_history_searched_at ON public.search_history(searched_at DESC);
CREATE INDEX idx_search_history_address ON public.search_history(address);
CREATE INDEX idx_search_history_location ON public.search_history USING gist (
  point(lng, lat)
);

ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────
-- 3. Score Events (ML Training Data)
-- ─────────────────────────────────────────────────
-- Every Location IQ computation. The feature vector is the input
-- matrix for the future ML model. Replaces the file-based JSONL logger.

CREATE TABLE IF NOT EXISTS public.score_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Input
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  business_type TEXT NOT NULL,

  -- Full 70+ feature vector (JSONB for flexibility as features evolve)
  features JSONB NOT NULL DEFAULT '{}',

  -- Computed scores
  location_iq INTEGER NOT NULL,
  niq INTEGER,
  siq INTEGER,
  tiq INTEGER,
  liq INTEGER,
  grade TEXT,

  -- Confidence
  confidence_level TEXT,
  confidence_pct INTEGER,

  -- Data availability
  source_availability JSONB DEFAULT '{}',   -- { "census": true, "crime": false, ... }
  sources_available INTEGER,
  sources_total INTEGER,

  -- Signal summary
  signal_count INTEGER,
  positive_signals INTEGER,
  negative_signals INTEGER,

  -- Performance
  computation_time_ms INTEGER,
  errors TEXT[] DEFAULT '{}',

  -- Metadata
  user_id TEXT,                              -- Nullable (logged-out previews?)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_score_events_created ON public.score_events(created_at DESC);
CREATE INDEX idx_score_events_user ON public.score_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_score_events_business_type ON public.score_events(business_type);
CREATE INDEX idx_score_events_grade ON public.score_events(grade);
CREATE INDEX idx_score_events_location ON public.score_events USING gist (
  point(lng, lat)
);

ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────
-- 4. Client Documents
-- ─────────────────────────────────────────────────
-- Metadata for files stored in Supabase Storage.
-- Actual files live in the 'client-documents' bucket.

CREATE TABLE IF NOT EXISTS public.client_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- File metadata
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,                   -- MIME type
  file_size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,                -- Path in Supabase Storage bucket

  -- Classification
  document_type TEXT NOT NULL DEFAULT 'other',  -- 'lease', 'floor_plan', 'financials', 'permit', 'photo', 'other'
  description TEXT,

  -- Association
  scored_location_id UUID REFERENCES public.scored_locations(id) ON DELETE SET NULL,

  -- Security
  is_encrypted BOOLEAN DEFAULT false,
  encryption_key_id TEXT,                    -- Reference to key management (future)

  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ                     -- Soft delete
);

CREATE INDEX idx_client_documents_user ON public.client_documents(user_id);
CREATE INDEX idx_client_documents_type ON public.client_documents(document_type);
CREATE INDEX idx_client_documents_location ON public.client_documents(scored_location_id);
CREATE INDEX idx_client_documents_active ON public.client_documents(user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────
-- 5. Usage Analytics & API Metering
-- ─────────────────────────────────────────────────

-- Daily usage counters per user
CREATE TABLE IF NOT EXISTS public.usage_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Counters
  searches INTEGER DEFAULT 0,
  saved_locations INTEGER DEFAULT 0,
  document_uploads INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,

  -- API cost tracking
  google_places_calls INTEGER DEFAULT 0,
  yelp_calls INTEGER DEFAULT 0,
  foursquare_calls INTEGER DEFAULT 0,
  walkscore_calls INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT usage_daily_user_date UNIQUE (user_id, date)
);

CREATE INDEX idx_usage_daily_user ON public.usage_daily(user_id);
CREATE INDEX idx_usage_daily_date ON public.usage_daily(date DESC);

ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;

-- Rate limit tracking (per-minute granularity)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,                  -- user_id or IP hash
  endpoint TEXT NOT NULL,                    -- '/api/location-intel', etc.
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,

  CONSTRAINT rate_limits_unique UNIQUE (identifier, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_lookup ON public.rate_limits(identifier, endpoint, window_start DESC);

-- Auto-cleanup: remove rate limit entries older than 1 hour
-- (run via Supabase pg_cron or scheduled function)

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────
-- 6. AI Recommendation Tables
-- ─────────────────────────────────────────────────

-- 6a. Location similarity cache
-- Pre-computed similar locations for "You might also like" recommendations
CREATE TABLE IF NOT EXISTS public.location_similarities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_location_id UUID NOT NULL REFERENCES public.scored_locations(id) ON DELETE CASCADE,
  similar_location_id UUID NOT NULL REFERENCES public.scored_locations(id) ON DELETE CASCADE,

  similarity_score REAL NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
  similarity_method TEXT DEFAULT 'cosine',   -- 'cosine', 'euclidean', 'jaccard'

  computed_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_similarity UNIQUE (source_location_id, similar_location_id)
);

CREATE INDEX idx_similarities_source ON public.location_similarities(source_location_id, similarity_score DESC);

ALTER TABLE public.location_similarities ENABLE ROW LEVEL SECURITY;

-- 6b. AI insights cache
-- Stores generated natural-language insights for locations
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scored_location_id UUID REFERENCES public.scored_locations(id) ON DELETE CASCADE,

  insight_type TEXT NOT NULL,                -- 'summary', 'risk_assessment', 'opportunity', 'comparison', 'segment_specific'
  business_type TEXT,                        -- Which business type this insight is tailored for

  -- The insight itself
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  confidence REAL CHECK (confidence BETWEEN 0 AND 1),

  -- What data went into generating this
  source_features JSONB,                     -- Feature snapshot used for generation
  model_version TEXT,                        -- Which model/prompt version produced this

  -- Feedback
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ                     -- Insights become stale when data changes
);

CREATE INDEX idx_ai_insights_location ON public.ai_insights(scored_location_id);
CREATE INDEX idx_ai_insights_type ON public.ai_insights(insight_type, business_type);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- 6c. Recommendation feedback
-- How users interact with AI recommendations — critical training signal
CREATE TABLE IF NOT EXISTS public.recommendation_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- What was recommended
  recommendation_type TEXT NOT NULL,          -- 'similar_location', 'insight', 'neighborhood', 'risk_alert'
  recommendation_id UUID,                     -- FK to the specific recommendation/insight
  recommended_item JSONB NOT NULL,            -- Snapshot of what was shown

  -- User action
  action TEXT NOT NULL,                       -- 'clicked', 'saved', 'dismissed', 'searched', 'upvoted', 'downvoted'

  -- Context
  context JSONB,                              -- Where in the UI, what they were looking at

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rec_feedback_user ON public.recommendation_feedback(user_id);
CREATE INDEX idx_rec_feedback_type ON public.recommendation_feedback(recommendation_type, action);

ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;

-- 6d. Scoring model versions
-- Track model evolution as ML improves scoring
CREATE TABLE IF NOT EXISTS public.scoring_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,              -- 'v1.0', 'v1.1-retrained', etc.

  description TEXT,

  -- Model metadata
  feature_count INTEGER,
  training_samples INTEGER,
  training_date TIMESTAMPTZ,

  -- Performance metrics
  mae REAL,                                  -- Mean Absolute Error vs outcomes
  correlation REAL,                          -- Correlation with real outcomes

  -- Status
  is_active BOOLEAN DEFAULT false,           -- Only one model is active at a time
  promoted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scoring_models ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────
-- 7. Audit Log
-- ─────────────────────────────────────────────────
-- Immutable append-only log for compliance. Tracks who did what, when.
-- No UPDATE or DELETE policies — entries are permanent.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Who
  user_id TEXT,
  user_email TEXT,
  ip_hash TEXT,                              -- SHA-256 of IP address

  -- What
  action TEXT NOT NULL,                      -- 'search', 'save_location', 'upload_document', 'delete_document', 'export_data', 'login', 'logout', 'admin_action'
  resource_type TEXT,                        -- 'scored_location', 'document', 'user', 'outcome'
  resource_id TEXT,                          -- UUID of affected resource

  -- Details
  details JSONB,                             -- Action-specific metadata

  -- When
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Partition-friendly index for time-range queries
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON public.audit_log(action, created_at DESC);
CREATE INDEX idx_audit_log_resource ON public.audit_log(resource_type, resource_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log trigger function — auto-logs changes to sensitive tables
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    COALESCE(
      current_setting('app.current_user_id', true),
      'system'
    ),
    TG_OP,                                   -- INSERT, UPDATE, DELETE
    TG_TABLE_NAME,
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'old', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers to sensitive tables
CREATE TRIGGER audit_client_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_client_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_scored_locations
  AFTER INSERT OR UPDATE OR DELETE ON public.scored_locations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_outcomes
  AFTER INSERT OR UPDATE OR DELETE ON public.outcomes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


-- ─────────────────────────────────────────────────
-- 8. Hardened RLS Policies
-- ─────────────────────────────────────────────────
-- Replace permissive USING(true) with proper user-scoped access.
--
-- Pattern: Server-side routes use the service_role key (bypasses RLS).
-- If anon key is used, these policies enforce user isolation.
-- The requesting_user_id() function reads the Clerk user ID from
-- a custom request setting (set via SvelteKit middleware).

-- 8a. Drop old permissive policies
DROP POLICY IF EXISTS "Users manage own scored_locations" ON public.scored_locations;
DROP POLICY IF EXISTS "Users manage own outcomes" ON public.outcomes;
DROP POLICY IF EXISTS "Users manage own checkins" ON public.outcome_checkins;
DROP POLICY IF EXISTS "Owners can manage whitelist" ON public.email_whitelist;

-- 8b. scored_locations — users see only their own
CREATE POLICY "scored_locations_select_own"
  ON public.scored_locations FOR SELECT
  USING (user_id = public.requesting_user_id());

CREATE POLICY "scored_locations_insert_own"
  ON public.scored_locations FOR INSERT
  WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY "scored_locations_update_own"
  ON public.scored_locations FOR UPDATE
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY "scored_locations_delete_own"
  ON public.scored_locations FOR DELETE
  USING (user_id = public.requesting_user_id());

-- 8c. outcomes — users see only their own
CREATE POLICY "outcomes_select_own"
  ON public.outcomes FOR SELECT
  USING (user_id = public.requesting_user_id());

CREATE POLICY "outcomes_insert_own"
  ON public.outcomes FOR INSERT
  WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY "outcomes_update_own"
  ON public.outcomes FOR UPDATE
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

-- 8d. outcome_checkins — users see only their own
CREATE POLICY "checkins_select_own"
  ON public.outcome_checkins FOR SELECT
  USING (user_id = public.requesting_user_id());

CREATE POLICY "checkins_insert_own"
  ON public.outcome_checkins FOR INSERT
  WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY "checkins_update_own"
  ON public.outcome_checkins FOR UPDATE
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

-- 8e. client_profiles — users manage only their own
CREATE POLICY "profiles_select_own"
  ON public.client_profiles FOR SELECT
  USING (user_id = public.requesting_user_id());

CREATE POLICY "profiles_insert_own"
  ON public.client_profiles FOR INSERT
  WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY "profiles_update_own"
  ON public.client_profiles FOR UPDATE
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

-- 8f. search_history — users see only their own
CREATE POLICY "search_history_select_own"
  ON public.search_history FOR SELECT
  USING (user_id = public.requesting_user_id());

CREATE POLICY "search_history_insert_own"
  ON public.search_history FOR INSERT
  WITH CHECK (user_id = public.requesting_user_id());

-- 8g. client_documents — users manage only their own (soft delete only)
CREATE POLICY "documents_select_own"
  ON public.client_documents FOR SELECT
  USING (user_id = public.requesting_user_id() AND deleted_at IS NULL);

CREATE POLICY "documents_insert_own"
  ON public.client_documents FOR INSERT
  WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY "documents_update_own"
  ON public.client_documents FOR UPDATE
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

-- 8h. usage_daily — users see only their own
CREATE POLICY "usage_select_own"
  ON public.usage_daily FOR SELECT
  USING (user_id = public.requesting_user_id());

-- 8i. score_events — insert-only for app, read for user's own
CREATE POLICY "score_events_select_own"
  ON public.score_events FOR SELECT
  USING (user_id = public.requesting_user_id());

CREATE POLICY "score_events_insert"
  ON public.score_events FOR INSERT
  WITH CHECK (true);  -- Server inserts with service_role key

-- 8j. ai_insights — readable by anyone (public knowledge)
CREATE POLICY "ai_insights_select"
  ON public.ai_insights FOR SELECT
  USING (true);

-- 8k. recommendation_feedback — users manage only their own
CREATE POLICY "rec_feedback_select_own"
  ON public.recommendation_feedback FOR SELECT
  USING (user_id = public.requesting_user_id());

CREATE POLICY "rec_feedback_insert_own"
  ON public.recommendation_feedback FOR INSERT
  WITH CHECK (user_id = public.requesting_user_id());

-- 8l. audit_log — INSERT only, no read/update/delete via API
-- (Admins read via Supabase dashboard or service_role key)
CREATE POLICY "audit_log_insert_only"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- 8m. scoring_models — read-only for all
CREATE POLICY "scoring_models_select"
  ON public.scoring_models FOR SELECT
  USING (true);

-- 8n. email_whitelist — admin only (service_role key bypasses RLS)
CREATE POLICY "whitelist_admin_only"
  ON public.email_whitelist FOR ALL
  USING (false);  -- No access via anon key; admins use service_role

-- 8o. rate_limits — service_role only
CREATE POLICY "rate_limits_service_only"
  ON public.rate_limits FOR ALL
  USING (false);

-- 8p. location_similarities — readable by authenticated users
CREATE POLICY "similarities_select"
  ON public.location_similarities FOR SELECT
  USING (true);


-- ─────────────────────────────────────────────────
-- 9. Helper Functions
-- ─────────────────────────────────────────────────

-- Increment daily usage counter (upsert pattern)
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id TEXT,
  p_field TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.usage_daily (user_id, date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, date) DO NOTHING;

  EXECUTE format(
    'UPDATE public.usage_daily SET %I = %I + $1, updated_at = now() WHERE user_id = $2 AND date = CURRENT_DATE',
    p_field, p_field
  ) USING p_amount, p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's usage for today (for rate limit display)
CREATE OR REPLACE FUNCTION public.get_today_usage(p_user_id TEXT)
RETURNS TABLE (
  searches INTEGER,
  saved_locations INTEGER,
  document_uploads INTEGER,
  api_calls INTEGER,
  google_places_calls INTEGER,
  yelp_calls INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(u.searches, 0),
    COALESCE(u.saved_locations, 0),
    COALESCE(u.document_uploads, 0),
    COALESCE(u.api_calls, 0),
    COALESCE(u.google_places_calls, 0),
    COALESCE(u.yelp_calls, 0)
  FROM public.usage_daily u
  WHERE u.user_id = p_user_id AND u.date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Clean up expired rate limit entries (call from pg_cron every hour)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_client_profiles_updated
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_usage_daily_updated
  BEFORE UPDATE ON public.usage_daily
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────
-- 10. Supabase Storage Bucket Setup
-- ─────────────────────────────────────────────────
-- Run these via Supabase dashboard or management API:
--
-- Bucket: client-documents
--   - Private (not public)
--   - Max file size: 50MB
--   - Allowed MIME types: application/pdf, image/jpeg, image/png,
--     image/webp, application/vnd.openxmlformats-officedocument.*
--
-- Storage RLS policies (set in Supabase dashboard):
--   SELECT: auth.uid()::text = (storage.foldername(name))[1]
--   INSERT: auth.uid()::text = (storage.foldername(name))[1]
--   DELETE: auth.uid()::text = (storage.foldername(name))[1]
--
-- File path convention: {user_id}/{document_type}/{filename}
-- Example: user_abc123/lease/commercial-lease-2026.pdf


-- ─────────────────────────────────────────────────
-- Done. Summary of new tables:
-- ─────────────────────────────────────────────────
-- client_profiles      — Business profile data entered by clients
-- search_history       — Every search performed
-- score_events         — ML training data (replaces JSONL file logger)
-- client_documents     — Metadata for uploaded files (Supabase Storage)
-- usage_daily          — Daily per-user usage counters
-- rate_limits          — Per-minute rate limiting
-- location_similarities — Pre-computed similar locations for AI recs
-- ai_insights          — Generated natural-language insights
-- recommendation_feedback — User interactions with recommendations
-- scoring_models       — ML model version tracking
-- audit_log            — Immutable compliance log with auto-triggers
