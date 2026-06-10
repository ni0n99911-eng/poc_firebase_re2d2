import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is missing');

const sql = postgres(dbUrl, { prepare: false });

async function run() {
    console.log("Applying raw SQL...");

    await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    console.log("PostGIS created");

    // intel_cache
    await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS intel_cache (
          id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          cache_key   text UNIQUE NOT NULL,
          source      text NOT NULL DEFAULT 'location-intel',
          data        jsonb NOT NULL,
          ttl_ms      bigint NOT NULL DEFAULT 604800000,
          fetched_at  timestamptz NOT NULL DEFAULT now(),
          created_at  timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_intel_cache_key ON intel_cache(cache_key);
        CREATE INDEX IF NOT EXISTS idx_intel_cache_fetched ON intel_cache(fetched_at);
        
        CREATE OR REPLACE FUNCTION upsert_intel_cache(
          p_cache_key text,
          p_source    text,
          p_data      jsonb,
          p_ttl_ms    bigint
        ) RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          INSERT INTO intel_cache(cache_key, source, data, ttl_ms, fetched_at)
          VALUES (p_cache_key, p_source, p_data, p_ttl_ms, now())
          ON CONFLICT (cache_key)
          DO UPDATE SET
            data       = EXCLUDED.data,
            source     = EXCLUDED.source,
            ttl_ms     = EXCLUDED.ttl_ms,
            fetched_at = now();
        END;
        $$;
    `);
    console.log("intel_cache schema created");

    // Reference data tables
    await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS nyc_subway_entrances (
            id            BIGSERIAL PRIMARY KEY,
            stop_name     TEXT NOT NULL,
            routes        TEXT,
            entrance_type TEXT,
            entry_allowed BOOLEAN DEFAULT true,
            exit_allowed  BOOLEAN DEFAULT true,
            lat           DOUBLE PRECISION NOT NULL,
            lng           DOUBLE PRECISION NOT NULL,
            geom          GEOGRAPHY(Point, 4326),
            borough       CHAR(1),
            complex_id    TEXT,
            source_id     TEXT,
            fetched_at    TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_subway_entrances_geom ON nyc_subway_entrances USING GIST (geom);
        
        CREATE TABLE IF NOT EXISTS nyc_bus_stops (
            id             BIGSERIAL PRIMARY KEY,
            stop_name      TEXT NOT NULL,
            route          TEXT,
            route_long     TEXT,
            direction      CHAR(1),
            lat            DOUBLE PRECISION NOT NULL,
            lng            DOUBLE PRECISION NOT NULL,
            geom           GEOGRAPHY(Point, 4326),
            borough        TEXT,
            is_cbd         BOOLEAN DEFAULT false,
            stop_id        TEXT,
            fetched_at     TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_bus_stops_geom ON nyc_bus_stops USING GIST (geom);
        
        CREATE TABLE IF NOT EXISTS nyc_mta_stations (
            id              BIGSERIAL PRIMARY KEY,
            station_name    TEXT NOT NULL,
            complex_id      TEXT,
            routes          TEXT,
            borough         CHAR(1),
            lat             DOUBLE PRECISION NOT NULL,
            lng             DOUBLE PRECISION NOT NULL,
            geom            GEOGRAPHY(Point, 4326),
            estimated_daily_ridership  INTEGER,
            route_count     INTEGER,
            fetched_at      TIMESTAMPTZ DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_mta_stations_geom ON nyc_mta_stations USING GIST (geom);

        CREATE TABLE IF NOT EXISTS block_groups (
            geoid TEXT PRIMARY KEY,
            centroid_lat DOUBLE PRECISION,
            centroid_lng DOUBLE PRECISION,
            geom GEOMETRY(MultiPolygon, 4326)
        );
    `);
    console.log("Reference tables created");

    // Functions
    await sql.unsafe(`
        CREATE OR REPLACE FUNCTION nearby_subway_entrances(
            p_lat DOUBLE PRECISION,
            p_lng DOUBLE PRECISION,
            p_radius_m INTEGER DEFAULT 500
        )
        RETURNS TABLE (
            stop_name TEXT,
            routes TEXT,
            entrance_type TEXT,
            entry_allowed BOOLEAN,
            lat DOUBLE PRECISION,
            lng DOUBLE PRECISION,
            distance_m DOUBLE PRECISION
        ) AS $$
            SELECT
                e.stop_name,
                e.routes,
                e.entrance_type,
                e.entry_allowed,
                e.lat,
                e.lng,
                ST_Distance(e.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) AS distance_m
            FROM nyc_subway_entrances e
            WHERE ST_DWithin(
                e.geom,
                ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
                p_radius_m
            )
            ORDER BY distance_m;
        $$ LANGUAGE SQL STABLE;

        CREATE OR REPLACE FUNCTION nearby_bus_stops(
            p_lat DOUBLE PRECISION,
            p_lng DOUBLE PRECISION,
            p_radius_m INTEGER DEFAULT 500
        )
        RETURNS TABLE (
            stop_name TEXT,
            route TEXT,
            direction CHAR(1),
            lat DOUBLE PRECISION,
            lng DOUBLE PRECISION,
            distance_m DOUBLE PRECISION
        ) AS $$
            SELECT
                b.stop_name,
                b.route,
                b.direction,
                b.lat,
                b.lng,
                ST_Distance(b.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) AS distance_m
            FROM nyc_bus_stops b
            WHERE ST_DWithin(
                b.geom,
                ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
                p_radius_m
            )
            ORDER BY distance_m;
        $$ LANGUAGE SQL STABLE;

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
    `);
    console.log("Functions created");

    console.log("Done.");
    process.exit(0);
}

run().catch(console.error);
