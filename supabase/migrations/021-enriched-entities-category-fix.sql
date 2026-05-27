-- Migration 021: Fix category mapping + deduplicate enriched_entities
-- BR-8 data quality pass
--
-- Fixes:
--   1. SMOR BAKERY and similar bakeries were tagged as coffee_shop because
--      the CASE statement checked LIKE '%cafe%' before '%bakery%'.
--      Fix: re-evaluate re2_category for all rows using corrected CASE order.
--
--   2. Duplicate DOHMH records (same business inspected multiple times)
--      show up as separate rows. Deduplicate by google_place_id, keeping
--      the row with the most recent last_verified_at.
--
--   3. Non-food/non-retail businesses (construction, medical, etc.) that
--      fell into 'other_retail' are left as-is — they carry minimal signal
--      weight in BR-8 and are not worth filtering aggressively without a
--      reliable vertical column.

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Re-categorize rows where re2_category was incorrectly assigned
--         (primarily bakery → coffee_shop misclassifications)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE enriched_entities
SET re2_category = CASE
  -- Bakery MUST come before coffee_shop (bakeries with "cafe" in name were
  -- misclassified as coffee_shop in migration 020)
  WHEN LOWER(entity_name) LIKE '%bakery%' OR LOWER(entity_name) LIKE '%bake%'
    THEN 'bakery'
  WHEN LOWER(entity_name) LIKE '%coffee%' OR LOWER(entity_name) LIKE '%cafe%'
    OR LOWER(entity_name) LIKE '%espresso%'
    THEN 'coffee_shop'
  WHEN LOWER(entity_name) LIKE '%bar%' OR LOWER(entity_name) LIKE '%pub%'
    OR LOWER(entity_name) LIKE '%lounge%' OR LOWER(entity_name) LIKE '%nightclub%'
    THEN 'bar_nightclub'
  WHEN LOWER(entity_name) LIKE '%mcdonald%' OR LOWER(entity_name) LIKE '%subway%'
    OR LOWER(entity_name) LIKE '%dunkin%' OR LOWER(entity_name) LIKE '%domino%'
    OR LOWER(entity_name) LIKE '%pizza hut%' OR LOWER(entity_name) LIKE '%burger king%'
    OR LOWER(entity_name) LIKE '%kfc%' OR LOWER(entity_name) LIKE '%wendy%'
    OR LOWER(entity_name) LIKE '%chipotle%' OR LOWER(entity_name) LIKE '%shake shack%'
    THEN 'fast_food'
  WHEN LOWER(entity_name) LIKE '%nail%' OR LOWER(entity_name) LIKE '%nails%'
    THEN 'nail_salon'
  WHEN LOWER(entity_name) LIKE '%hair%' OR LOWER(entity_name) LIKE '%barber%'
    OR LOWER(entity_name) LIKE '%salon%' OR LOWER(entity_name) LIKE '%beauty%'
    THEN 'hair_salon'
  WHEN LOWER(entity_name) LIKE '%gym%' OR LOWER(entity_name) LIKE '%fitness%'
    OR LOWER(entity_name) LIKE '%yoga%' OR LOWER(entity_name) LIKE '%crossfit%'
    THEN 'gym_fitness'
  WHEN LOWER(entity_name) LIKE '%pharmacy%' OR LOWER(entity_name) LIKE '%drug%'
    OR LOWER(entity_name) LIKE '%cvs%' OR LOWER(entity_name) LIKE '%walgreen%'
    OR LOWER(entity_name) LIKE '%rite aid%'
    THEN 'pharmacy'
  WHEN LOWER(entity_name) LIKE '%grocery%' OR LOWER(entity_name) LIKE '%supermarket%'
    OR LOWER(entity_name) LIKE '%market%' OR LOWER(entity_name) LIKE '%deli%'
    OR LOWER(entity_name) LIKE '%bodega%'
    THEN 'grocery'
  WHEN LOWER(entity_name) LIKE '%laundromat%' OR LOWER(entity_name) LIKE '%laundry%'
    OR LOWER(entity_name) LIKE '%wash%'
    THEN 'laundromat'
  WHEN LOWER(entity_name) LIKE '%dry clean%' OR LOWER(entity_name) LIKE '%cleaner%'
    THEN 'dry_cleaning'
  WHEN LOWER(entity_name) LIKE '%phone%' OR LOWER(entity_name) LIKE '%repair%'
    OR LOWER(entity_name) LIKE '%mobile%' OR LOWER(entity_name) LIKE '%wireless%'
    THEN 'phone_repair'
  WHEN LOWER(entity_name) LIKE '%restaurant%' OR LOWER(entity_name) LIKE '%kitchen%'
    OR LOWER(entity_name) LIKE '%bistro%' OR LOWER(entity_name) LIKE '%grill%'
    OR LOWER(entity_name) LIKE '%diner%' OR LOWER(entity_name) LIKE '%eatery%'
    THEN 'full_service_restaurant'
  ELSE 'other_retail'
END
WHERE re2_category IS NOT NULL
  AND entity_name IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Deduplicate by google_place_id
--   Keep the row with the lowest id (first inserted) when place_id is not null.
--   Rows with null place_id are kept as-is (no reliable dedup key).
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM enriched_entities
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY place_id
        ORDER BY id ASC
      ) AS rn
    FROM enriched_entities
    WHERE place_id IS NOT NULL
      AND place_id != ''
  ) ranked
  WHERE rn > 1
);

-- Verify counts after dedup
-- SELECT re2_category, COUNT(*) FROM enriched_entities GROUP BY re2_category ORDER BY COUNT(*) DESC;
