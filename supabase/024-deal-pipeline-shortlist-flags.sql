-- ============================================================
-- 024: Deal Pipeline — Shortlist Flags
-- ============================================================
-- Adds pinned and starred boolean columns to deal_pipeline.
-- These support the Dashboard Shortlist card UI:
--   pinned  → keeps the card at the top of the shortlist
--   starred → user favourite / high-priority flag
--
-- Both default to false so existing rows are unaffected.
-- No data migration required.
-- ============================================================

ALTER TABLE public.deal_pipeline
  ADD COLUMN IF NOT EXISTS pinned  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT false;

-- Indexes to support filtered shortlist queries
CREATE INDEX IF NOT EXISTS idx_deal_pipeline_pinned
  ON public.deal_pipeline(user_id, pinned)
  WHERE pinned = true;

CREATE INDEX IF NOT EXISTS idx_deal_pipeline_starred
  ON public.deal_pipeline(user_id, starred)
  WHERE starred = true;
