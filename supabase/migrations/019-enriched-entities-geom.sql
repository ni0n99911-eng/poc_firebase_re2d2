-- Migration 019: enriched_entities geometry + cluster fields
-- BR-8 § 8 — Named business verification pipeline
-- Adds PostGIS geometry column + cluster metadata to enriched_entities
-- Required for ST_DWithin 400ft radius queries

-- Add geometry and cluster metadata columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'enriched_entities' AND column_name = 'lat'
    ) THEN
        ALTER TABLE enriched_entities ADD COLUMN lat double precision;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'enriched_entities' AND column_name = 'lng'
    ) THEN
        ALTER TABLE enriched_entities ADD COLUMN lng double precision;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'enriched_entities' AND column_name = 'geom'
    ) THEN
        ALTER TABLE enriched_entities ADD COLUMN geom geometry(Point, 4326);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'enriched_entities' AND column_name = 'status'
    ) THEN
        ALTER TABLE enriched_entities ADD COLUMN status text DEFAULT 'operational';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'enriched_entities' AND column_name = 'last_verified_at'
    ) THEN
        ALTER TABLE enriched_entities ADD COLUMN last_verified_at timestamptz;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'enriched_entities' AND column_name = 'place_id'
    ) THEN
        ALTER TABLE enriched_entities ADD COLUMN place_id text;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'enriched_entities' AND column_name = 're2_category'
    ) THEN
        ALTER TABLE enriched_entities ADD COLUMN re2_category text;
    END IF;
END $$;

-- GIST spatial index for ST_DWithin queries
CREATE INDEX IF NOT EXISTS idx_enriched_entities_geom
    ON enriched_entities USING GIST(geom);

-- Index on re2_category for cluster signal lookups
CREATE INDEX IF NOT EXISTS idx_enriched_entities_category
    ON enriched_entities (re2_category);

-- Index on place_id for dedup / freshness checks
CREATE INDEX IF NOT EXISTS idx_enriched_entities_place_id
    ON enriched_entities (place_id);
