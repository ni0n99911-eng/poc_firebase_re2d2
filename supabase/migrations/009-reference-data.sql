-- ═══════════════════════════════════════════════════════
-- 009: NYC Reference Data Tables
-- ═══════════════════════════════════════════════════════
--
-- Static/semi-static NYC datasets seeded from open data APIs.
-- Queried locally instead of hitting live APIs at request time.
-- Eliminates timeout issues and rate-limit failures.
--
-- PostGIS extension for spatial queries (ST_DWithin, geography type).
-- ═══════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Subway Entrances ────────────────────────────────
-- Source: MTA Subway Entrances (data.ny.gov/resource/i9wp-a4ja)
-- ~1,800 rows, updated ~yearly
CREATE TABLE IF NOT EXISTS nyc_subway_entrances (
    id            BIGSERIAL PRIMARY KEY,
    stop_name     TEXT NOT NULL,
    routes        TEXT,            -- e.g. "1 2 3 7 A C E N Q R W S"
    entrance_type TEXT,            -- Stair, Elevator, Escalator
    entry_allowed BOOLEAN DEFAULT true,
    exit_allowed  BOOLEAN DEFAULT true,
    lat           DOUBLE PRECISION NOT NULL,
    lng           DOUBLE PRECISION NOT NULL,
    geom          GEOGRAPHY(Point, 4326),
    borough       CHAR(1),         -- M, B, Q, X, S
    complex_id    TEXT,
    source_id     TEXT,             -- original dataset row identifier
    fetched_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subway_entrances_geom
    ON nyc_subway_entrances USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_subway_entrances_borough
    ON nyc_subway_entrances (borough);

-- ─── Bus Stops ───────────────────────────────────────
-- Source: MTA Current Bus Stops (data.ny.gov/resource/ai5j-txmn)
-- ~16,000 rows, updated ~quarterly
CREATE TABLE IF NOT EXISTS nyc_bus_stops (
    id             BIGSERIAL PRIMARY KEY,
    stop_name      TEXT NOT NULL,
    route          TEXT,            -- e.g. "M42"
    route_long     TEXT,            -- full route description
    direction      CHAR(1),        -- N, S, E, W
    lat            DOUBLE PRECISION NOT NULL,
    lng            DOUBLE PRECISION NOT NULL,
    geom           GEOGRAPHY(Point, 4326),
    borough        TEXT,
    is_cbd         BOOLEAN DEFAULT false,  -- congestion pricing zone
    stop_id        TEXT,
    fetched_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bus_stops_geom
    ON nyc_bus_stops USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_bus_stops_route
    ON nyc_bus_stops (route);

-- ─── MTA Station Ridership ───────────────────────────
-- Source: MTA Subway Stations (data.ny.gov/resource/5f5g-n3cz)
-- ~500 rows, updated ~yearly
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

CREATE INDEX IF NOT EXISTS idx_mta_stations_geom
    ON nyc_mta_stations USING GIST (geom);

-- ─── Pedestrian Counts ───────────────────────────────
-- Source: NYC DOT Pedestrian Counts (data.cityofnewyork.us/7ym2-wayt)
-- ~100 locations with annual counts
CREATE TABLE IF NOT EXISTS nyc_pedestrian_counts (
    id              BIGSERIAL PRIMARY KEY,
    location_name   TEXT NOT NULL,
    borough         TEXT,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    geom            GEOGRAPHY(Point, 4326),
    am_count        INTEGER,
    pm_count        INTEGER,
    total_count     INTEGER,
    count_year      INTEGER,
    fetched_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedestrian_counts_geom
    ON nyc_pedestrian_counts USING GIST (geom);

-- ─── Seed tracking ──────────────────────────────────
-- Tracks when each dataset was last refreshed
CREATE TABLE IF NOT EXISTS reference_data_seeds (
    dataset_name    TEXT PRIMARY KEY,
    row_count       INTEGER DEFAULT 0,
    seeded_at       TIMESTAMPTZ DEFAULT now(),
    source_url      TEXT,
    notes           TEXT
);

-- ─── Helper function: nearby subway entrances ────────
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

-- ─── Helper function: nearby bus stops ───────────────
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

-- ─── Helper function: nearby MTA stations ────────────
CREATE OR REPLACE FUNCTION nearby_mta_stations(
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_radius_m INTEGER DEFAULT 800
)
RETURNS TABLE (
    station_name TEXT,
    routes TEXT,
    estimated_daily_ridership INTEGER,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    distance_m DOUBLE PRECISION
) AS $$
    SELECT
        s.station_name,
        s.routes,
        s.estimated_daily_ridership,
        s.lat,
        s.lng,
        ST_Distance(s.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) AS distance_m
    FROM nyc_mta_stations s
    WHERE ST_DWithin(
        s.geom,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        p_radius_m
    )
    ORDER BY distance_m;
$$ LANGUAGE SQL STABLE;
