-- Migration 020: Seed enriched_entities from businesses table
-- BR-8 § 8 — Named business verification pipeline
-- Populates enriched_entities with 72K+ DOHMH NYC businesses
-- Source: businesses table (89K rows, imported from NYC DOHMH open data)
--
-- Category mapping follows BR-8 signal weights:
--   coffee_shop=10, full_service_restaurant=10, phone_repair=8,
--   bar_nightclub=7, fast_food=7, nail_salon=6, hair_salon=6,
--   gym_fitness=5, pharmacy=5, grocery=4, laundromat=4,
--   dry_cleaning=3, other_retail=2
--
-- NOTE: Migration 021 fixes category ordering (bakery before cafe)
-- and deduplicates by place_id. This migration is the initial seed.

INSERT INTO enriched_entities (
  entity_name,
  address,
  lat,
  lng,
  geom,
  status,
  place_id,
  re2_category,
  last_verified_at,
  location_key
)
SELECT
  b.name,
  b.address,
  b.latitude,
  b.longitude,
  ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326) AS geom,
  LOWER(COALESCE(b.google_status, 'operational')) AS status,
  b.google_place_id AS place_id,
  CASE
    WHEN LOWER(b.name) LIKE '%bakery%' OR LOWER(b.name) LIKE '%bake%'
      THEN 'bakery'
    WHEN LOWER(b.name) LIKE '%coffee%' OR LOWER(b.name) LIKE '%cafe%'
      OR LOWER(b.name) LIKE '%espresso%'
      THEN 'coffee_shop'
    WHEN LOWER(b.name) LIKE '%bar%' OR LOWER(b.name) LIKE '%pub%'
      OR LOWER(b.name) LIKE '%lounge%' OR LOWER(b.name) LIKE '%nightclub%'
      THEN 'bar_nightclub'
    WHEN LOWER(b.name) LIKE '%mcdonald%' OR LOWER(b.name) LIKE '%subway%'
      OR LOWER(b.name) LIKE '%dunkin%' OR LOWER(b.name) LIKE '%domino%'
      OR LOWER(b.name) LIKE '%pizza hut%' OR LOWER(b.name) LIKE '%burger king%'
      OR LOWER(b.name) LIKE '%kfc%' OR LOWER(b.name) LIKE '%wendy%'
      OR LOWER(b.name) LIKE '%chipotle%' OR LOWER(b.name) LIKE '%shake shack%'
      THEN 'fast_food'
    WHEN LOWER(b.name) LIKE '%nail%' OR LOWER(b.name) LIKE '%nails%'
      THEN 'nail_salon'
    WHEN LOWER(b.name) LIKE '%hair%' OR LOWER(b.name) LIKE '%barber%'
      OR LOWER(b.name) LIKE '%salon%' OR LOWER(b.name) LIKE '%beauty%'
      THEN 'hair_salon'
    WHEN LOWER(b.name) LIKE '%gym%' OR LOWER(b.name) LIKE '%fitness%'
      OR LOWER(b.name) LIKE '%yoga%' OR LOWER(b.name) LIKE '%crossfit%'
      THEN 'gym_fitness'
    WHEN LOWER(b.name) LIKE '%pharmacy%' OR LOWER(b.name) LIKE '%drug%'
      OR LOWER(b.name) LIKE '%cvs%' OR LOWER(b.name) LIKE '%walgreen%'
      OR LOWER(b.name) LIKE '%rite aid%'
      THEN 'pharmacy'
    WHEN LOWER(b.name) LIKE '%grocery%' OR LOWER(b.name) LIKE '%supermarket%'
      OR LOWER(b.name) LIKE '%market%' OR LOWER(b.name) LIKE '%deli%'
      OR LOWER(b.name) LIKE '%bodega%'
      THEN 'grocery'
    WHEN LOWER(b.name) LIKE '%laundromat%' OR LOWER(b.name) LIKE '%laundry%'
      OR LOWER(b.name) LIKE '%wash%'
      THEN 'laundromat'
    WHEN LOWER(b.name) LIKE '%dry clean%' OR LOWER(b.name) LIKE '%cleaner%'
      THEN 'dry_cleaning'
    WHEN LOWER(b.name) LIKE '%phone%' OR LOWER(b.name) LIKE '%repair%'
      OR LOWER(b.name) LIKE '%mobile%' OR LOWER(b.name) LIKE '%wireless%'
      THEN 'phone_repair'
    WHEN LOWER(b.name) LIKE '%restaurant%' OR LOWER(b.name) LIKE '%kitchen%'
      OR LOWER(b.name) LIKE '%bistro%' OR LOWER(b.name) LIKE '%grill%'
      OR LOWER(b.name) LIKE '%diner%' OR LOWER(b.name) LIKE '%eatery%'
      THEN 'full_service_restaurant'
    ELSE 'other_retail'
  END AS re2_category,
  NOW() AS last_verified_at,
  b.address || '|' || COALESCE(b.geoid, b.zipcode, 'unknown') AS location_key
FROM businesses b
WHERE
  b.latitude  IS NOT NULL
  AND b.longitude IS NOT NULL
  AND b.latitude  != 0
  AND b.longitude != 0
  AND b.address IS NOT NULL
ON CONFLICT (location_key) DO NOTHING;
