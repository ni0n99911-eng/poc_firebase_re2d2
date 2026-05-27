-- Migration 018: BR-5 score drift event log
-- Records every score change > 3 points after Re-score action
-- Internal only — not user-facing. Used for future model learning.

CREATE TABLE IF NOT EXISTS score_drift_events (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             TEXT NOT NULL,
  address             TEXT NOT NULL,
  geoid               TEXT,
  old_score           NUMERIC NOT NULL,
  new_score           NUMERIC NOT NULL,
  delta               NUMERIC GENERATED ALWAYS AS (new_score - old_score) STORED,
  sub_scores_moved    JSONB NOT NULL DEFAULT '[]'::jsonb,
  old_scorer_version  TEXT NOT NULL,
  new_scorer_version  TEXT NOT NULL,
  old_inputs_hash     TEXT NOT NULL,
  new_inputs_hash     TEXT NOT NULL,
  logged_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_drift_user
  ON score_drift_events(user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_score_drift_delta
  ON score_drift_events(ABS(delta) DESC);

CREATE INDEX IF NOT EXISTS idx_score_drift_address
  ON score_drift_events(address);

-- RLS: users read own events only; server writes via service role
ALTER TABLE score_drift_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own drift events"
  ON score_drift_events FOR SELECT
  USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Service role writes drift events"
  ON score_drift_events FOR INSERT
  WITH CHECK (true);
