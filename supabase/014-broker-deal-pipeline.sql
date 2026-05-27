-- ============================================================
-- 014: Broker & Deal Pipeline
-- ============================================================
-- Tracks the deal flow from RE² scoring → real broker engagement
-- → lease signed. Three tables:
--
--   broker_contacts  — real estate brokers the user works with
--   deal_pipeline    — specific spaces/addresses being evaluated
--   deal_events      — timestamped activity log per deal
--
-- ROI use case: when a user scores a location then contacts a broker
-- and eventually signs a lease, RE² can show the full attribution.
-- Also feeds the dashboard ROI meter and engagement analytics.
--
-- Depends on: requesting_user_id() function (003-client-data-security)
-- ============================================================

-- ─────────────────────────────────────────────────
-- 1. broker_contacts
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.broker_contacts (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      TEXT    NOT NULL,               -- Clerk user ID
  name         TEXT    NOT NULL,
  brokerage    TEXT,                           -- firm name
  email        TEXT,
  phone        TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_contacts_user ON public.broker_contacts(user_id);

-- ─────────────────────────────────────────────────
-- 2. deal_pipeline
-- ─────────────────────────────────────────────────
-- One row per space being evaluated. Status drives the kanban view.
--
-- Status lifecycle:
--   watching → touring → negotiating → signed
--                                    ↘ passed (no longer interested)
--                                    ↘ lost   (lost to another tenant)

CREATE TABLE IF NOT EXISTS public.deal_pipeline (
  id                           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                      TEXT    NOT NULL,

  -- Location
  address                      TEXT    NOT NULL,
  geoid                        TEXT,           -- census block group (links to scored_locations)
  neighborhood                 TEXT,
  borough                      TEXT,

  -- Space details (as known at time of evaluation)
  asking_rent_monthly          INTEGER,        -- $/month
  square_footage               INTEGER,
  lease_type                   TEXT,           -- 'nnn' | 'gross' | 'modified_gross'
  lease_term_years             NUMERIC(4,1),

  -- RE² scores at time of pin (snapshot — scores may improve later)
  location_iq_score            INTEGER,
  fit_iq_score                 INTEGER,
  vision_iq_score              INTEGER,
  concept_type                 TEXT,           -- canonical concept key at time of pin

  -- Pipeline status
  status                       TEXT    NOT NULL DEFAULT 'watching'
                                        CHECK (status IN ('watching','touring','negotiating','signed','passed','lost')),

  -- Broker association (optional)
  broker_id                    UUID    REFERENCES public.broker_contacts(id) ON DELETE SET NULL,

  -- Key dates
  first_seen_at                TIMESTAMPTZ DEFAULT now(),
  toured_at                    TIMESTAMPTZ,
  offer_submitted_at           TIMESTAMPTZ,
  decision_at                  TIMESTAMPTZ,

  -- Free-form notes
  notes                        TEXT,

  created_at                   TIMESTAMPTZ DEFAULT now(),
  updated_at                   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_pipeline_user       ON public.deal_pipeline(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_pipeline_status     ON public.deal_pipeline(user_id, status);
CREATE INDEX IF NOT EXISTS idx_deal_pipeline_geoid      ON public.deal_pipeline(geoid) WHERE geoid IS NOT NULL;

-- ─────────────────────────────────────────────────
-- 3. deal_events
-- ─────────────────────────────────────────────────
-- Append-only timeline for each deal. Never UPDATE rows here.

CREATE TABLE IF NOT EXISTS public.deal_events (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id      UUID    NOT NULL REFERENCES public.deal_pipeline(id) ON DELETE CASCADE,
  user_id      TEXT    NOT NULL,
  event_type   TEXT    NOT NULL
                       CHECK (event_type IN (
                         'saved','viewed','toured','broker_intro',
                         'offer_submitted','counter_received',
                         'signed','passed','lost','note'
                       )),
  event_data   JSONB   DEFAULT '{}',   -- flexible payload (e.g. { offer_amount: 9500 })
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_events_deal   ON public.deal_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_events_user   ON public.deal_events(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_events_type   ON public.deal_events(event_type);

-- ─────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────
ALTER TABLE public.broker_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_pipeline   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_events     ENABLE ROW LEVEL SECURITY;

-- broker_contacts
CREATE POLICY "brokers_select_own" ON public.broker_contacts
  FOR SELECT USING (user_id = public.requesting_user_id());
CREATE POLICY "brokers_insert_own" ON public.broker_contacts
  FOR INSERT WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY "brokers_update_own" ON public.broker_contacts
  FOR UPDATE USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY "brokers_delete_own" ON public.broker_contacts
  FOR DELETE USING (user_id = public.requesting_user_id());

-- deal_pipeline
CREATE POLICY "deals_select_own" ON public.deal_pipeline
  FOR SELECT USING (user_id = public.requesting_user_id());
CREATE POLICY "deals_insert_own" ON public.deal_pipeline
  FOR INSERT WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY "deals_update_own" ON public.deal_pipeline
  FOR UPDATE USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY "deals_delete_own" ON public.deal_pipeline
  FOR DELETE USING (user_id = public.requesting_user_id());

-- deal_events
CREATE POLICY "events_select_own" ON public.deal_events
  FOR SELECT USING (user_id = public.requesting_user_id());
CREATE POLICY "events_insert_own" ON public.deal_events
  FOR INSERT WITH CHECK (user_id = public.requesting_user_id());
-- No UPDATE/DELETE on events — append-only

-- ─────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_broker_contacts_updated ON public.broker_contacts;
CREATE TRIGGER set_broker_contacts_updated
  BEFORE UPDATE ON public.broker_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_deal_pipeline_updated ON public.deal_pipeline;
CREATE TRIGGER set_deal_pipeline_updated
  BEFORE UPDATE ON public.deal_pipeline
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────
-- Sanity check
-- ─────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('broker_contacts','deal_pipeline','deal_events')
ORDER BY table_name;
-- Expected: 3 rows
