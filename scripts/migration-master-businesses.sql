-- ============================================================
-- Migration: Master Business Roster
-- All NYC brick-and-mortar businesses from DCA, DOHMH, OSM, NPI
-- Run in Supabase SQL Editor
-- Created: March 28, 2026
-- ============================================================

-- 1. ENUM types for consistent categorization
DO $$ BEGIN
    CREATE TYPE business_source AS ENUM ('DOHMH', 'DCA', 'OSM', 'NPI', 'GOOGLE', 'YELP', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE business_tier AS ENUM ('closed', 'at_risk', 'surviving', 'performing', 'thriving', 'unscored');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Master business roster — universal table for ALL business types
CREATE TABLE IF NOT EXISTS businesses (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Identity
    name            TEXT NOT NULL,
    vertical        TEXT NOT NULL,           -- 'Food & Beverage', 'Healthcare - Dental', etc.
    sub_category    TEXT,                     -- DOHMH cuisine, DCA license type, OSM tag, NPI taxonomy
    concept         TEXT,                     -- Normalized concept: 'Restaurant / Cafe / Bar', 'Dental Practice', etc.

    -- Location
    address         TEXT,
    borough         TEXT NOT NULL,
    zipcode         TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    geoid           TEXT,                     -- Census block group GEOID (for joining to block_group_intel)

    -- Source tracking
    source          business_source NOT NULL,
    source_id       TEXT,                     -- CAMIS, license_nbr, OSM ID, NPI number
    phone           TEXT,

    -- Google Places enrichment (populated later, borough by borough)
    google_place_id     TEXT,
    google_name         TEXT,
    google_rating       DOUBLE PRECISION,
    google_reviews      INTEGER,
    google_price_level  INTEGER,
    google_status       TEXT,                 -- OPERATIONAL, CLOSED_PERMANENTLY, CLOSED_TEMPORARILY
    google_types        TEXT[],
    google_match_confidence DOUBLE PRECISION,
    google_fetched_at   TIMESTAMPTZ,

    -- Yelp enrichment (populated later)
    yelp_id             TEXT,
    yelp_rating         DOUBLE PRECISION,
    yelp_reviews        INTEGER,
    yelp_price          TEXT,
    yelp_is_closed      BOOLEAN,
    yelp_fetched_at     TIMESTAMPTZ,

    -- 5-Tier scoring
    composite_score     DOUBLE PRECISION,
    tier                business_tier DEFAULT 'unscored',
    score_rating_norm   DOUBLE PRECISION,     -- Rating component (0-1)
    score_review_norm   DOUBLE PRECISION,     -- Review volume component (0-1)
    score_longevity_norm DOUBLE PRECISION,    -- Longevity component (0-1)
    scored_at           TIMESTAMPTZ,

    -- DOHMH-specific fields (null for non-food)
    dohmh_latest_grade  TEXT,
    dohmh_grade_date    TEXT,
    dohmh_score         INTEGER,
    dohmh_inspections   INTEGER,
    dohmh_a_pct         DOUBLE PRECISION,
    dohmh_consecutive_a INTEGER,
    dohmh_years_history DOUBLE PRECISION,
    dohmh_has_c_grade   BOOLEAN,

    -- Michelin (food only)
    is_michelin         BOOLEAN DEFAULT FALSE,
    michelin_level      TEXT,

    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    -- Dedup: one record per source + source_id
    CONSTRAINT uq_business_source UNIQUE (source, source_id)
);

-- 3. Indexes for the queries RE² will run
CREATE INDEX IF NOT EXISTS idx_biz_borough ON businesses (borough);
CREATE INDEX IF NOT EXISTS idx_biz_vertical ON businesses (vertical);
CREATE INDEX IF NOT EXISTS idx_biz_concept ON businesses (concept);
CREATE INDEX IF NOT EXISTS idx_biz_tier ON businesses (tier);
CREATE INDEX IF NOT EXISTS idx_biz_zipcode ON businesses (zipcode);
CREATE INDEX IF NOT EXISTS idx_biz_geoid ON businesses (geoid);
CREATE INDEX IF NOT EXISTS idx_biz_source ON businesses (source);
CREATE INDEX IF NOT EXISTS idx_biz_google_status ON businesses (google_status);
CREATE INDEX IF NOT EXISTS idx_biz_composite ON businesses (composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_biz_coords ON businesses (latitude, longitude);

-- Compound indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_biz_boro_concept ON businesses (borough, concept);
CREATE INDEX IF NOT EXISTS idx_biz_boro_tier ON businesses (borough, tier);
CREATE INDEX IF NOT EXISTS idx_biz_concept_tier ON businesses (concept, tier);

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_businesses_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_businesses_updated ON businesses;
CREATE TRIGGER trg_businesses_updated
    BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_businesses_timestamp();

-- 5. RLS policies
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Service role: full access (used by scripts and API)
CREATE POLICY "service_role_full_access" ON businesses
    FOR ALL USING (true) WITH CHECK (true);

-- Authenticated users: read-only
CREATE POLICY "authenticated_read_businesses" ON businesses
    FOR SELECT TO authenticated USING (true);

-- 6. Stats view for quick dashboard queries
CREATE OR REPLACE VIEW business_stats AS
SELECT
    borough,
    concept,
    tier::TEXT,
    COUNT(*) AS count,
    ROUND(AVG(google_rating)::NUMERIC, 2) AS avg_rating,
    ROUND(AVG(google_reviews)::NUMERIC, 0) AS avg_reviews,
    ROUND(AVG(composite_score)::NUMERIC, 3) AS avg_score
FROM businesses
WHERE borough IS NOT NULL
GROUP BY borough, concept, tier;

-- 7. Comments
COMMENT ON TABLE businesses IS 'Master roster of all NYC brick-and-mortar businesses. Sources: DCA, DOHMH, OSM, NPI. Google/Yelp enrichment added progressively.';
COMMENT ON COLUMN businesses.vertical IS 'Business vertical: Food & Beverage, Healthcare - Dental, Retail - Clothing, etc.';
COMMENT ON COLUMN businesses.concept IS 'Normalized concept name for scoring: Restaurant / Cafe / Bar, Dental Practice, etc.';
COMMENT ON COLUMN businesses.geoid IS 'Census block group GEOID for joining to block_group_intel scores';
COMMENT ON COLUMN businesses.tier IS 'Five-tier health rating: closed, at_risk, surviving, performing, thriving, unscored';
