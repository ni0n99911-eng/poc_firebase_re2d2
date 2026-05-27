-- ─────────────────────────────────────────────────
-- Outcome Tracking Tables
-- ─────────────────────────────────────────────────
-- Tracks real-world outcomes for locations that RE² scored,
-- enabling feedback loops for ML training and scoring calibration.

-- 1. Scored locations — every Location IQ computation the user saves
CREATE TABLE IF NOT EXISTS public.scored_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  business_type TEXT NOT NULL DEFAULT 'cafe',
  concept_type TEXT,

  -- Scores at time of analysis
  location_iq INTEGER NOT NULL,
  niq INTEGER,
  siq INTEGER,
  tiq INTEGER,
  liq INTEGER,
  grade TEXT,
  confidence INTEGER,

  -- Six-index scores (if computed)
  transit_score INTEGER,
  demographics_score INTEGER,
  competition_score INTEGER,
  vibrancy_score INTEGER,
  safety_score INTEGER,
  momentum_score INTEGER,

  -- Metadata
  data_sources_available INTEGER,
  data_sources_total INTEGER,
  signals JSONB DEFAULT '[]',

  scored_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scored_locations_user ON public.scored_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_scored_locations_scored_at ON public.scored_locations(scored_at);

-- 2. Outcomes — user-reported real-world results
CREATE TABLE IF NOT EXISTS public.outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scored_location_id UUID NOT NULL REFERENCES public.scored_locations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- What happened?
  verdict TEXT NOT NULL CHECK (verdict IN ('opened', 'passed', 'still_looking', 'closed')),
  months_open INTEGER,          -- How many months since opening (null if not opened)
  revenue_range TEXT,           -- 'below_plan', 'on_plan', 'above_plan' (self-reported)
  satisfaction INTEGER CHECK (satisfaction BETWEEN 1 AND 5),  -- 1=regret, 5=love it

  -- Free-text
  notes TEXT,
  biggest_surprise TEXT,        -- "What surprised you most about this location?"

  -- Which check-in produced this?
  check_in_number INTEGER DEFAULT 1,  -- 1st, 2nd, 3rd check-in etc.

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_user ON public.outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_location ON public.outcomes(scored_location_id);

-- 3. Check-in schedule — tracks when emails were sent
CREATE TABLE IF NOT EXISTS public.outcome_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scored_location_id UUID NOT NULL REFERENCES public.scored_locations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,

  check_in_number INTEGER NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,

  -- Email tracking
  email_id TEXT,                -- Resend message ID
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'responded', 'skipped')),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkins_scheduled ON public.outcome_checkins(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_checkins_user ON public.outcome_checkins(user_id);

-- RLS
ALTER TABLE public.scored_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcome_checkins ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own data
CREATE POLICY "Users manage own scored_locations" ON public.scored_locations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users manage own outcomes" ON public.outcomes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users manage own checkins" ON public.outcome_checkins
  FOR ALL USING (true) WITH CHECK (true);
