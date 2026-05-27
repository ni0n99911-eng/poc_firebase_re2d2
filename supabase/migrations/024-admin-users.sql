-- Migration 024: Admin Users Table
-- #55: Moves SUPER_ADMINS from hardcoded array in modules.ts to Supabase.
-- Callers should use getAdminEmails() from $lib/modules instead of SUPER_ADMINS
-- directly — the function queries this table and falls back to the hardcoded list.
--
-- Run: paste into Supabase SQL editor → Run

CREATE TABLE IF NOT EXISTS admin_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'admin',  -- 'admin' | 'super_admin' | 'readonly'
  active      BOOLEAN NOT NULL DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_users_updated_at ON admin_users;
CREATE TRIGGER admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_admin_users_updated_at();

-- RLS: service role can read/write; anon and authenticated can read active admins
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — no policy needed for service_role
CREATE POLICY "admin_users_read_active"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Seed: current SUPER_ADMINS (from modules.ts hardcoded list, March 2026)
INSERT INTO admin_users (email, role, notes) VALUES
  ('gaurav.joshi06@gmail.com', 'super_admin', 'Co-founder — seeded from SUPER_ADMINS March 2026'),
  ('kalpna.gaule@gmail.com',   'super_admin', 'Co-founder — seeded from SUPER_ADMINS March 2026')
ON CONFLICT (email) DO NOTHING;

-- Index for fast email lookup (used in auth middleware)
CREATE INDEX IF NOT EXISTS idx_admin_users_email  ON admin_users (email)  WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_admin_users_role   ON admin_users (role)   WHERE active = true;

-- Verify
-- SELECT email, role FROM admin_users WHERE active = true;
-- Expected: 2 rows (gaurav + kalpna)
