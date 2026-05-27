-- ============================================================
-- Migration 006: Learning Layer
-- Adds location_intelligence table for neighborhood aggregates
-- and ensures recommendation_feedback is ready for UI feedback
-- ============================================================

-- 1. Aggregate location intelligence — neighborhood-level scoring
CREATE TABLE IF NOT EXISTS public.location_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geohash TEXT NOT NULL,
  business_type TEXT NOT NULL,
  avg_score NUMERIC,
  total_searches INTEGER DEFAULT 0,
  positive_signals JSONB DEFAULT '[]',
  negative_signals JSONB DEFAULT '[]',
  top_factors JSONB DEFAULT '{}',
  score_distribution JSONB DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(geohash, business_type)
);

CREATE INDEX idx_location_intel_geohash ON public.location_intelligence(geohash);
CREATE INDEX idx_location_intel_type ON public.location_intelligence(business_type);
CREATE INDEX idx_location_intel_updated ON public.location_intelligence(last_updated DESC);

-- RLS: location_intelligence is public read, server-write
ALTER TABLE public.location_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "location_intelligence_public_read"
  ON public.location_intelligence FOR SELECT
  USING (true);

-- Service role handles inserts/updates (no user-scoped writes needed)
CREATE POLICY "location_intelligence_service_write"
  ON public.location_intelligence FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Add session_id column to recommendation_feedback if not present
-- (The existing table from 003 has user_id but the spec wants session_id too)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendation_feedback'
    AND column_name = 'session_id'
  ) THEN
    ALTER TABLE public.recommendation_feedback
      ADD COLUMN session_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendation_feedback'
    AND column_name = 'component'
  ) THEN
    ALTER TABLE public.recommendation_feedback
      ADD COLUMN component TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendation_feedback'
    AND column_name = 'item_id'
  ) THEN
    ALTER TABLE public.recommendation_feedback
      ADD COLUMN item_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recommendation_feedback'
    AND column_name = 'feedback'
  ) THEN
    ALTER TABLE public.recommendation_feedback
      ADD COLUMN feedback TEXT;
  END IF;
END $$;

-- Index for component-level feedback queries
CREATE INDEX IF NOT EXISTS idx_rec_feedback_component
  ON public.recommendation_feedback(component, feedback);
