-- Migration 025: Pricing Tiers Table
-- #57: Moves PRICING_TIERS from hardcoded config in modules.ts to Supabase.
-- Callers should use fetchPricingTiers() from $lib/modules instead of
-- inline PRICING_TIERS — the function queries this table and falls back to the
-- hardcoded config.
--
-- Run: paste into Supabase SQL editor → Run

CREATE TABLE IF NOT EXISTS pricing_tiers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,   -- 'scout' | 'builder' | 'pro' | 'enterprise'
  name           TEXT NOT NULL,
  price_cents    INT,                     -- NULL = free; otherwise monthly price in USD cents
  period         TEXT NOT NULL DEFAULT '/month',  -- e.g. '/month', 'during beta'
  modules        TEXT[] NOT NULL DEFAULT '{}',    -- EinsteinModule slugs granted by this tier
  display_order  INT NOT NULL DEFAULT 0,
  active         BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_pricing_tiers_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pricing_tiers_updated_at ON pricing_tiers;
CREATE TRIGGER pricing_tiers_updated_at
  BEFORE UPDATE ON pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION update_pricing_tiers_updated_at();

-- RLS: public read (pricing page is unauthenticated)
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_tiers_public_read"
  ON pricing_tiers
  FOR SELECT
  USING (active = true);

-- Seed: current PRICING_TIERS from modules.ts (as of March 2026)
INSERT INTO pricing_tiers (slug, name, price_cents, period, modules, display_order, notes) VALUES
  ('scout',      'Scout',      NULL,  'during beta', ARRAY['location-einstein'],                                                                                           1, 'Free tier — seeded from PRICING_TIERS March 2026'),
  ('builder',    'Builder',    7900,  '/month',      ARRAY['location-einstein', 'space-einstein', 'business-einstein'],                                                    2, 'Seeded from PRICING_TIERS March 2026'),
  ('pro',        'Pro',        14900, '/month',      ARRAY['location-einstein', 'space-einstein', 'business-einstein', 'loan-einstein'],                                   3, 'Seeded from PRICING_TIERS March 2026'),
  ('enterprise', 'Enterprise', 24900, '/month',      ARRAY['location-einstein', 'space-einstein', 'business-einstein', 'loan-einstein', 'launch-einstein', 'operations-einstein'], 4, 'Seeded from PRICING_TIERS March 2026')
ON CONFLICT (slug) DO NOTHING;

-- Index for fast slug lookup
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_slug ON pricing_tiers (slug) WHERE active = true;

-- Verify
-- SELECT slug, name, price_cents, array_length(modules, 1) as module_count FROM pricing_tiers ORDER BY display_order;
-- Expected: 4 rows
