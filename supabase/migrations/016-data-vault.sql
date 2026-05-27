-- ══════════════════════════════════════════════════════════════════
-- Migration 016: Data Vault (Founder CRM + Document Storage)
-- ══════════════════════════════════════════════════════════════════
-- Purpose: Give founders a per-property document vault for LOIs,
-- photos, notes, messages, contacts. Acts as a lightweight CRM
-- tied to their shortlisted locations.
--
-- Storage: Files stored in Supabase Storage bucket 'vault-files'.
-- This table stores metadata + references.
-- ══════════════════════════════════════════════════════════════════

-- Vault items: notes, files, contacts, milestones per property
CREATE TABLE IF NOT EXISTS vault_items (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       text NOT NULL,                           -- Clerk user ID
  property_addr text NOT NULL DEFAULT '',                -- linked property address (empty = general)
  item_type     text NOT NULL CHECK (item_type IN ('note', 'file', 'contact', 'milestone', 'link')),
  title         text NOT NULL DEFAULT '',
  body          text DEFAULT '',                         -- note body, contact details, link URL, milestone description
  file_path     text DEFAULT '',                         -- Supabase Storage path for files/photos
  file_type     text DEFAULT '',                         -- MIME type (image/jpeg, application/pdf, etc.)
  file_size     integer DEFAULT 0,                       -- bytes
  tags          text[] DEFAULT '{}',                     -- user-defined tags: ['LOI', 'photos', 'lease', 'inspection']
  metadata      jsonb DEFAULT '{}',                      -- flexible: contact phone/email, milestone date, etc.
  pinned        boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_vault_user     ON vault_items(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_property ON vault_items(user_id, property_addr);
CREATE INDEX IF NOT EXISTS idx_vault_type     ON vault_items(user_id, item_type);
CREATE INDEX IF NOT EXISTS idx_vault_tags     ON vault_items USING gin(tags);

-- RLS: users can only access their own vault items
ALTER TABLE vault_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY vault_select ON vault_items FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json ->> 'sub');

CREATE POLICY vault_insert ON vault_items FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json ->> 'sub');

CREATE POLICY vault_update ON vault_items FOR UPDATE
  USING (user_id = current_setting('request.jwt.claims', true)::json ->> 'sub');

CREATE POLICY vault_delete ON vault_items FOR DELETE
  USING (user_id = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- Supabase Storage bucket (must be created via Dashboard or API, SQL ref only)
-- CREATE BUCKET vault-files (public: false, file_size_limit: 10MB, allowed_mime_types: image/*, application/pdf, text/*)
-- Note: Run this in Supabase Dashboard → Storage → New bucket:
--   Name: vault-files
--   Public: OFF
--   File size limit: 10485760 (10MB)
--   Allowed MIME: image/jpeg, image/png, image/webp, application/pdf, text/plain

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_vault_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vault_updated_at
  BEFORE UPDATE ON vault_items
  FOR EACH ROW
  EXECUTE FUNCTION update_vault_updated_at();
