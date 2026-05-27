-- ═══════════════════════════════════════════════════════════════════════════════
-- RE² Migration 027: Add PostGIS geometry column to block_group_scores
-- ═══════════════════════════════════════════════════════════════════════════════
-- Enables ST_DWithin spatial queries for neighborhood-level score lookups.
-- Mirrors the pattern from migration 019 (enriched_entities geom).
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure PostGIS is available
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column (WGS84 / SRID 4326)
ALTER TABLE block_group_scores
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Populate from existing lat/lng columns
UPDATE block_group_scores
  SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
  WHERE lat IS NOT NULL AND lng IS NOT NULL AND geom IS NULL;

-- Spatial index for ST_DWithin queries
CREATE INDEX IF NOT EXISTS idx_block_group_scores_geom
  ON block_group_scores USING GIST(geom);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. Spatial queries now supported on block_group_scores.
-- Example: SELECT * FROM block_group_scores
--          WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(-73.94, 40.71), 4326), 0.005);
-- ═══════════════════════════════════════════════════════════════════════════════
