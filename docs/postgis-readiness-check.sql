-- PostGIS Readiness Check — BR-8 § 8.2
-- Run these in Supabase SQL editor in sequence.
-- Report back: which checks pass, which fail.

-- ============================================================
-- CHECK 1: PostGIS extension enabled?
-- ============================================================
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name = 'postgis';
-- PASS: installed_version IS NOT NULL
-- FAIL: installed_version IS NULL → run: CREATE EXTENSION postgis;

-- ============================================================
-- CHECK 2: Does enriched_entities table exist?
-- ============================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'enriched_entities';
-- PASS: 1 row returned
-- FAIL: 0 rows → table does not exist, cluster detection pipeline cannot proceed

-- ============================================================
-- CHECK 3: Does enriched_entities have a geom column?
-- ============================================================
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'enriched_entities'
  AND column_name = 'geom';
-- PASS: 1 row, udt_name = 'geometry'
-- FAIL: 0 rows → geom column missing, need: ALTER TABLE enriched_entities ADD COLUMN geom geometry(Point, 4326);

-- ============================================================
-- CHECK 4: Does enriched_entities have lat/lng columns as fallback?
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'enriched_entities'
  AND column_name IN ('lat', 'lng', 'latitude', 'longitude');
-- PASS: 2+ rows (lat + lng or latitude + longitude)
-- FAIL: 0 rows → no coordinate columns at all, need schema design before proceeding

-- ============================================================
-- CHECK 5: How many rows in enriched_entities?
-- ============================================================
SELECT COUNT(*) AS total_rows,
       COUNT(CASE WHEN geom IS NOT NULL THEN 1 END) AS rows_with_geom,
       COUNT(CASE WHEN status = 'operational' THEN 1 END) AS operational_rows
FROM enriched_entities;
-- PASS: total_rows > 0, rows_with_geom > 0
-- FAIL: total_rows = 0 → table empty, need data import before cluster detection
-- FAIL: rows_with_geom = 0 but total_rows > 0 → geom column exists but not populated

-- ============================================================
-- CHECK 6: Does block_group_scores have a geom column?
-- ============================================================
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'block_group_scores'
  AND column_name = 'geom';
-- PASS: 1 row
-- FAIL: 0 rows → centroid geometry missing, ST_DWithin cannot run against block groups

-- ============================================================
-- CHECK 7: Sample ST_DWithin query (400ft = 121.92m) — 89 Graham Ave
-- Only run if checks 1–5 all pass
-- ============================================================
SELECT
  name,
  category,
  ST_Distance(
    geom::geography,
    ST_SetSRID(ST_MakePoint(-73.9440, 40.7131), 4326)::geography
  ) * 3.28084 AS distance_ft
FROM enriched_entities
WHERE ST_DWithin(
  geom::geography,
  ST_SetSRID(ST_MakePoint(-73.9440, 40.7131), 4326)::geography,
  121.92
)
  AND status = 'operational'
ORDER BY distance_ft ASC
LIMIT 20;
-- PASS: returns businesses within 400ft of 89 Graham Ave
-- FAIL: error → PostGIS not working or geom column wrong type
-- FAIL: 0 rows → no businesses in enriched_entities near 89 Graham (data gap)
