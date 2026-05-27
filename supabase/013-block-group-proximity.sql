-- ============================================================
-- 013: Block Group Proximity RPC
-- ============================================================
-- Adds nearby_block_group() RPC used by Walk Score and Google
-- Places DB-first lookups in walkscore.ts and google-places.ts.
--
-- Depends on: block_groups table with centroid_lat, centroid_lng columns
--             (created in earlier migrations)
-- ============================================================

CREATE OR REPLACE FUNCTION nearby_block_group(lat float, lng float)
RETURNS TABLE(geoid text, distance_meters float) AS $$
  SELECT
    geoid,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(centroid_lng, centroid_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
    ) AS distance_meters
  FROM block_groups
  WHERE centroid_lat IS NOT NULL AND centroid_lng IS NOT NULL
  ORDER BY distance_meters
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Grant access to authenticated and service roles
GRANT EXECUTE ON FUNCTION nearby_block_group(float, float) TO authenticated;
GRANT EXECUTE ON FUNCTION nearby_block_group(float, float) TO service_role;
