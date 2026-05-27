/**
 * One-time migration runner endpoint.
 * POST /api/run-migration?secret=CRON_SECRET
 *
 * Runs the 009-reference-data migration SQL to create
 * PostGIS tables for subway entrances, bus stops, and MTA stations.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { env as pubEnv } from '$env/dynamic/public';

function getSupabase() {
	const url = pubEnv.PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '';
	const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
	if (!url || !key) return null;
	return createClient(url, key, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

// Migration SQL broken into individual statements
const MIGRATION_STATEMENTS = [
	// PostGIS
	`CREATE EXTENSION IF NOT EXISTS postgis`,

	// Subway entrances table
	`CREATE TABLE IF NOT EXISTS nyc_subway_entrances (
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
	)`,
	`CREATE INDEX IF NOT EXISTS idx_subway_entrances_geom ON nyc_subway_entrances USING GIST (geom)`,
	`CREATE INDEX IF NOT EXISTS idx_subway_entrances_borough ON nyc_subway_entrances (borough)`,

	// Bus stops table
	`CREATE TABLE IF NOT EXISTS nyc_bus_stops (
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
	)`,
	`CREATE INDEX IF NOT EXISTS idx_bus_stops_geom ON nyc_bus_stops USING GIST (geom)`,
	`CREATE INDEX IF NOT EXISTS idx_bus_stops_route ON nyc_bus_stops (route)`,

	// MTA stations table
	`CREATE TABLE IF NOT EXISTS nyc_mta_stations (
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
	)`,
	`CREATE INDEX IF NOT EXISTS idx_mta_stations_geom ON nyc_mta_stations USING GIST (geom)`,

	// Pedestrian counts table
	`CREATE TABLE IF NOT EXISTS nyc_pedestrian_counts (
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
	)`,
	`CREATE INDEX IF NOT EXISTS idx_pedestrian_counts_geom ON nyc_pedestrian_counts USING GIST (geom)`,

	// Seed tracking table
	`CREATE TABLE IF NOT EXISTS reference_data_seeds (
		dataset_name    TEXT PRIMARY KEY,
		row_count       INTEGER DEFAULT 0,
		seeded_at       TIMESTAMPTZ DEFAULT now(),
		source_url      TEXT,
		notes           TEXT
	)`,

	// RPC: nearby subway entrances
	`CREATE OR REPLACE FUNCTION nearby_subway_entrances(
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
		ORDER BY distance_m
	$$ LANGUAGE SQL STABLE`,

	// RPC: nearby bus stops
	`CREATE OR REPLACE FUNCTION nearby_bus_stops(
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
		ORDER BY distance_m
	$$ LANGUAGE SQL STABLE`,

	// RPC: nearby MTA stations
	`CREATE OR REPLACE FUNCTION nearby_mta_stations(
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
		ORDER BY distance_m
	$$ LANGUAGE SQL STABLE`
];

export const POST: RequestHandler = async ({ url }) => {
	const secret = url.searchParams.get('secret');
	if (secret !== env.CRON_SECRET) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const supabase = getSupabase();
	if (!supabase) {
		return json({ error: 'Supabase not configured' }, { status: 500 });
	}

	const results: Array<{ statement: string; success: boolean; error?: string }> = [];

	for (const sql of MIGRATION_STATEMENTS) {
		const label = sql.substring(0, 60).replace(/\s+/g, ' ').trim();
		try {
			const { error } = await supabase.rpc('exec_sql', { sql_text: sql });
			if (error) {
				// Try raw query via postgrest - fallback
				const { error: error2 } = await supabase.from('_migration_runner').select().limit(0);
				// If RPC doesn't exist, we need to use the SQL endpoint directly
				results.push({ statement: label, success: false, error: error.message });
			} else {
				results.push({ statement: label, success: true });
			}
		} catch (err) {
			results.push({ statement: label, success: false, error: err instanceof Error ? err.message : String(err) });
		}
	}

	return json({ results });
};
