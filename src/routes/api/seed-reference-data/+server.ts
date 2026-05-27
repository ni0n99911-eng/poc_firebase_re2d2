/**
 * Reference Data Seeder Endpoint
 *
 * POST /api/seed-reference-data?dataset=all|subway|bus|stations
 *
 * Fetches static NYC datasets from open APIs and bulk-inserts
 * them into Supabase reference tables. Protected by CRON_SECRET.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { env as pubEnv } from '$env/dynamic/public';

const BATCH_SIZE = 500;

function getSupabase() {
	const url = pubEnv.PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '';
	const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
	if (!url || !key) return null;
	return createClient(url, key, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

async function fetchAllPages<T>(baseUrl: string, pageSize: number = 5000): Promise<T[]> {
	const all: T[] = [];
	let offset = 0;
	while (true) {
		const url = new URL(baseUrl);
		url.searchParams.set('$limit', String(pageSize));
		url.searchParams.set('$offset', String(offset));
		const resp = await fetch(url.toString(), {
			headers: { 'Accept': 'application/json' },
			signal: AbortSignal.timeout(30000)
		});
		if (!resp.ok) throw new Error(`API ${resp.status}`);
		const page: T[] = await resp.json();
		all.push(...page);
		if (page.length < pageSize) break;
		offset += pageSize;
	}
	return all;
}

async function upsertBatches(supabase: ReturnType<typeof createClient>, table: string, rows: Record<string, unknown>[]) {
	let inserted = 0;
	for (let i = 0; i < rows.length; i += BATCH_SIZE) {
		const batch = rows.slice(i, i + BATCH_SIZE);
		const { error } = await supabase.from(table).upsert(batch);
		if (error) throw new Error(`Batch ${i}: ${error.message}`);
		inserted += batch.length;
	}
	return inserted;
}

export const POST: RequestHandler = async ({ url, request }) => {
	// Auth: require CRON_SECRET header
	const secret = request.headers.get('x-cron-secret') || url.searchParams.get('secret');
	if (secret !== env.CRON_SECRET) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const dataset = url.searchParams.get('dataset') || 'all';
	const supabase = getSupabase();
	if (!supabase) {
		return json({ error: 'Supabase not configured' }, { status: 500 });
	}

	const results: Record<string, { rows: number; time: number; error?: string }> = {};

	// ── Subway Entrances ──
	if (dataset === 'all' || dataset === 'subway') {
		const start = Date.now();
		try {
			const raw = await fetchAllPages<Record<string, string>>(
				'https://data.ny.gov/resource/i9wp-a4ja.json?$select=stop_name,daytime_routes,entrance_type,entry_allowed,exit_allowed,entrance_latitude,entrance_longitude,borough,complex_id,station_id'
			);
			const rows = raw
				.filter(r => r.entrance_latitude && r.entrance_longitude)
				.map(r => {
					const lat = parseFloat(r.entrance_latitude);
					const lng = parseFloat(r.entrance_longitude);
					return {
						stop_name: r.stop_name,
						routes: r.daytime_routes || null,
						entrance_type: r.entrance_type || null,
						entry_allowed: r.entry_allowed === 'YES',
						exit_allowed: r.exit_allowed === 'YES',
						lat, lng,
						geom: `SRID=4326;POINT(${lng} ${lat})`,
						borough: r.borough || null,
						complex_id: r.complex_id || null,
						source_id: r.station_id || null,
						fetched_at: new Date().toISOString()
					};
				});
			await supabase.from('nyc_subway_entrances').delete().gte('id', 0);
			await upsertBatches(supabase, 'nyc_subway_entrances', rows);
			await supabase.from('reference_data_seeds').upsert({
				dataset_name: 'subway_entrances', row_count: rows.length,
				seeded_at: new Date().toISOString(),
				source_url: 'https://data.ny.gov/resource/i9wp-a4ja.json'
			});
			results.subway = { rows: rows.length, time: Date.now() - start };
		} catch (err) {
			results.subway = { rows: 0, time: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
		}
	}

	// ── Bus Stops ──
	if (dataset === 'all' || dataset === 'bus') {
		const start = Date.now();
		try {
			const raw = await fetchAllPages<Record<string, string>>(
				'https://data.ny.gov/resource/ai5j-txmn.json?$select=stop_name,route_short_name,route_long_name,direction,latitude,longitude,is_cbd,stop_id'
			);
			const seen = new Set<string>();
			const rows = raw
				.filter(r => r.latitude && r.longitude)
				.filter(r => {
					const key = `${r.stop_id}-${r.route_short_name}-${r.direction}`;
					if (seen.has(key)) return false;
					seen.add(key);
					return true;
				})
				.map(r => {
					const lat = parseFloat(r.latitude);
					const lng = parseFloat(r.longitude);
					return {
						stop_name: r.stop_name,
						route: r.route_short_name || null,
						route_long: r.route_long_name || null,
						direction: r.direction || null,
						lat, lng,
						geom: `SRID=4326;POINT(${lng} ${lat})`,
						is_cbd: r.is_cbd === 'true',
						stop_id: r.stop_id || null,
						fetched_at: new Date().toISOString()
					};
				});
			await supabase.from('nyc_bus_stops').delete().gte('id', 0);
			await upsertBatches(supabase, 'nyc_bus_stops', rows);
			await supabase.from('reference_data_seeds').upsert({
				dataset_name: 'bus_stops', row_count: rows.length,
				seeded_at: new Date().toISOString(),
				source_url: 'https://data.ny.gov/resource/ai5j-txmn.json'
			});
			results.bus = { rows: rows.length, time: Date.now() - start };
		} catch (err) {
			results.bus = { rows: 0, time: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
		}
	}

	// ── MTA Stations ──
	if (dataset === 'all' || dataset === 'stations') {
		const start = Date.now();
		try {
			const raw = await fetchAllPages<Record<string, string>>(
				'https://data.ny.gov/resource/5f5g-n3cz.json?$select=stop_name,complex_id,daytime_routes,borough,gtfs_latitude,gtfs_longitude'
			);
			const complexMap = new Map<string, Record<string, string>>();
			for (const r of raw) {
				if (!r.complex_id || !r.gtfs_latitude || !r.gtfs_longitude) continue;
				const existing = complexMap.get(r.complex_id);
				if (!existing) {
					complexMap.set(r.complex_id, { ...r });
				} else {
					const existingRoutes = new Set((existing.daytime_routes || '').split(' '));
					for (const route of (r.daytime_routes || '').split(' ')) existingRoutes.add(route);
					existing.daytime_routes = [...existingRoutes].filter(Boolean).join(' ');
				}
			}
			const rows = [...complexMap.values()].map(r => {
				const lat = parseFloat(r.gtfs_latitude);
				const lng = parseFloat(r.gtfs_longitude);
				const routes = r.daytime_routes || '';
				const routeCount = routes.split(' ').filter(Boolean).length;
				let est = 8000;
				if (routeCount >= 4) est = 40000;
				else if (routeCount >= 3) est = 25000;
				else if (routeCount >= 2) est = 15000;
				return {
					station_name: r.stop_name || 'Unknown',
					complex_id: r.complex_id,
					routes, borough: r.borough || null,
					lat, lng,
					geom: `SRID=4326;POINT(${lng} ${lat})`,
					estimated_daily_ridership: est,
					route_count: routeCount,
					fetched_at: new Date().toISOString()
				};
			});
			await supabase.from('nyc_mta_stations').delete().gte('id', 0);
			await upsertBatches(supabase, 'nyc_mta_stations', rows);
			await supabase.from('reference_data_seeds').upsert({
				dataset_name: 'mta_stations', row_count: rows.length,
				seeded_at: new Date().toISOString(),
				source_url: 'https://data.ny.gov/resource/5f5g-n3cz.json'
			});
			results.stations = { rows: rows.length, time: Date.now() - start };
		} catch (err) {
			results.stations = { rows: 0, time: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
		}
	}

	return json({ success: true, results });
};
