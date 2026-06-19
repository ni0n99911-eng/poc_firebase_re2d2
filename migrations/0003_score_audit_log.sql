-- Score Audit Log — V2 Score Debuggability
-- Captures the full debug trace envelope for every score computation.
-- DE can search by address, geoid, or trace_id to investigate "score is wrong" reports.
-- 10-day auto-expiry to control storage growth.

CREATE TABLE IF NOT EXISTS score_audit_log (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trace_id       TEXT NOT NULL,                -- deterministic: score_{timestamp}_{location_id}_{concept}
  scored_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- Lookup keys (what the DE will search by)
  address        TEXT,
  lat            NUMERIC(9,6),
  lng            NUMERIC(9,6),
  geoid          TEXT,
  business_type  TEXT,
  user_id        TEXT,                          -- nullable (anonymous users)
  
  -- The score itself
  location_iq    INT,
  grade          TEXT,
  vision_iq      INT,
  fit_iq         INT,
  
  -- The full debug envelope (JSONB) — this is the golden artifact
  debug_envelope JSONB NOT NULL,
  
  -- Metadata
  serving_mode   TEXT,                          -- 'python_api' | 'fallback_golden_record' | 'bundle_builder'
  engine_version TEXT,
  computation_ms INT,
  
  -- Expiration (auto-cleanup after 10 days to control storage)
  expires_at     TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 days'
);

-- Indexes for fast DE lookups
CREATE INDEX IF NOT EXISTS idx_sal_address ON score_audit_log (address);
CREATE INDEX IF NOT EXISTS idx_sal_geoid   ON score_audit_log (geoid);
CREATE INDEX IF NOT EXISTS idx_sal_scored  ON score_audit_log (scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_sal_trace   ON score_audit_log (trace_id);

-- Auto-cleanup: delete expired rows (run via cron or Dagster schedule)
-- DELETE FROM score_audit_log WHERE expires_at < NOW();
