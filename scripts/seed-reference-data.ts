#!/usr/bin/env npx tsx
/**
 * ═══════════════════════════════════════════════════════
 * Seed NYC Reference Data into Supabase
 * ═══════════════════════════════════════════════════════
 *
 * Fetches static NYC datasets from open APIs and bulk-inserts
 * them into Supabase reference tables. Run this periodically
 * (monthly or quarterly) to keep data fresh.
 *
 * Usage:
 *   npx tsx scripts/seed-reference-data.ts [--dataset=subway|bus|stations|all]
 *
 * Requires env vars:
 *   SUPABASE_URL (or PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ──────────────────────────────────────────

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
	console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
	console.error('   Set these env vars or create a .env file');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});

const BATCH_SIZE = 500; // Supabase upsert batch limit

// DB borough columns are CHAR(1) — map full names to single-char MTA codes
function toBoroughCode(b?: string): string | null {
	if (!b) return null;
	const map: Record<string, string> = {
		Manhattan: 'M', manhattan: 'M', M: 'M',
		Brooklyn: 'B', brooklyn: 'B', B: 'B',
		Queens: 'Q', queens: 'Q', Q: 'Q',
		Bronx: 'X', bronx: 'X', X: 'X',
		'Staten Island': 'S', 'staten island': 'S', S: 'S',
	};
	return map[b] ?? b.charAt(0).toUpperCase();
}

// ─── Helpers ─────────────────────────────────────────

async function fetchAllPages<T>(baseUrl: string, pageSize: number = 5000): Promise<T[]> {
	const all: T[] = [];
	let offset = 0;

	while (true) {
		const url = new URL(baseUrl);
		url.searchParams.set('$limit', String(pageSize));
		url.searchParams.set('$offset', String(offset));

		console.log(`  Fetching offset ${offset}...`);
		const resp = await fetch(url.toString(), {
			headers: { 'Accept': 'application/json' }
		});

		if (!resp.ok) {
			throw new Error(`API returned ${resp.status}: ${await resp.text()}`);
		}

		const page: T[] = await resp.json();
		all.push(...page);

		if (page.length < pageSize) break; // Last page
		offset += pageSize;
	}

	return all;
}

async function upsertBatches(table: string, rows: Record<string, unknown>[], onConflict?: string) {
	for (let i = 0; i < rows.length; i += BATCH_SIZE) {
		const batch = rows.slice(i, i + BATCH_SIZE);
		const opts: Record<string, unknown> = {};
		if (onConflict) opts.onConflict = onConflict;

		const { error } = await supabase
			.from(table)
			.upsert(batch, opts);

		if (error) {
			console.error(`  ❌ Batch ${i}-${i + batch.length} failed:`, error.message);
		} else {
			console.log(`  ✓ Inserted ${i + batch.length}/${rows.length}`);
		}
	}
}

async function recordSeed(dataset: string, rowCount: number, sourceUrl: string) {
	await supabase.from('reference_data_seeds').upsert({
		dataset_name: dataset,
		row_count: rowCount,
		seeded_at: new Date().toISOString(),
		source_url: sourceUrl
	});
}

// ─── Subway Entrances ────────────────────────────────

interface SubwayEntranceRaw {
	stop_name: string;
	daytime_routes?: string;
	entrance_type?: string;
	entry_allowed?: string;
	exit_allowed?: string;
	entrance_latitude?: string;
	entrance_longitude?: string;
	borough?: string;
	complex_id?: string;
	station_id?: string;
}

async function seedSubwayEntrances() {
	console.log('\n🚇 Seeding subway entrances...');
	const API_URL = 'https://data.ny.gov/resource/i9wp-a4ja.json';

	const raw = await fetchAllPages<SubwayEntranceRaw>(
		`${API_URL}?$select=stop_name,daytime_routes,entrance_type,entry_allowed,exit_allowed,entrance_latitude,entrance_longitude,borough,complex_id,station_id`
	);

	console.log(`  Fetched ${raw.length} entrances from API`);

	const rows = raw
		.filter(r => r.entrance_latitude && r.entrance_longitude)
		.map(r => {
			const lat = parseFloat(r.entrance_latitude!);
			const lng = parseFloat(r.entrance_longitude!);
			return {
				stop_name: r.stop_name,
				routes: r.daytime_routes || null,
				entrance_type: r.entrance_type || null,
				entry_allowed: r.entry_allowed === 'YES',
				exit_allowed: r.exit_allowed === 'YES',
				lat,
				lng,
				geom: `SRID=4326;POINT(${lng} ${lat})`,
				borough: toBoroughCode(r.borough),
				complex_id: r.complex_id || null,
				source_id: r.station_id || null,
				fetched_at: new Date().toISOString()
			};
		});

	// Clear and re-insert (simpler than upsert for reference data)
	console.log('  Clearing existing data...');
	await supabase.from('nyc_subway_entrances').delete().gte('id', 0);

	await upsertBatches('nyc_subway_entrances', rows);
	await recordSeed('subway_entrances', rows.length, API_URL);
	console.log(`  ✅ Seeded ${rows.length} subway entrances`);
}

// ─── Bus Stops ───────────────────────────────────────

interface BusStopRaw {
	stop_name: string;
	route_short_name?: string;
	route_long_name?: string;
	direction?: string;
	latitude?: string;
	longitude?: string;
	is_cbd?: string;
	stop_id?: string;
}

async function seedBusStops() {
	console.log('\n🚌 Seeding bus stops...');
	const API_URL = 'https://data.ny.gov/resource/ai5j-txmn.json';

	const raw = await fetchAllPages<BusStopRaw>(
		`${API_URL}?$select=stop_name,route_short_name,route_long_name,direction,latitude,longitude,is_cbd,stop_id`
	);

	console.log(`  Fetched ${raw.length} bus stops from API`);

	// Deduplicate by stop_id + route (same stop can appear multiple times for different schedules)
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
			const lat = parseFloat(r.latitude!);
			const lng = parseFloat(r.longitude!);
			return {
				stop_name: r.stop_name,
				route: r.route_short_name || null,
				route_long: r.route_long_name || null,
				direction: r.direction || null,
				lat,
				lng,
				geom: `SRID=4326;POINT(${lng} ${lat})`,
				is_cbd: r.is_cbd === 'true',
				stop_id: r.stop_id || null,
				fetched_at: new Date().toISOString()
			};
		});

	console.log('  Clearing existing data...');
	await supabase.from('nyc_bus_stops').delete().gte('id', 0);

	await upsertBatches('nyc_bus_stops', rows);
	await recordSeed('bus_stops', rows.length, API_URL);
	console.log(`  ✅ Seeded ${rows.length} bus stops (deduplicated from ${raw.length})`);
}

// ─── MTA Stations ────────────────────────────────────

interface MtaStationRaw {
	stop_name?: string;
	complex_id?: string;
	daytime_routes?: string;
	borough?: string;
	latitude?: string;   // API renamed from gtfs_latitude
	longitude?: string;  // API renamed from gtfs_longitude
}

async function seedMtaStations() {
	console.log('\n🚉 Seeding MTA stations...');
	const API_URL = 'https://data.ny.gov/resource/5f5g-n3cz.json';

	const raw = await fetchAllPages<MtaStationRaw>(
		`${API_URL}?$select=stop_name,complex_id,daytime_routes,borough,latitude,longitude`
	);

	console.log(`  Fetched ${raw.length} stations from API`);

	// Deduplicate by complex_id (multiple stops can share a complex)
	const complexMap = new Map<string, typeof raw[0]>();
	for (const r of raw) {
		if (!r.complex_id || !r.latitude || !r.longitude) continue;
		const existing = complexMap.get(r.complex_id);
		if (!existing) {
			complexMap.set(r.complex_id, r);
		} else {
			// Merge routes
			const existingRoutes = new Set((existing.daytime_routes || '').split(' '));
			for (const route of (r.daytime_routes || '').split(' ')) {
				existingRoutes.add(route);
			}
			existing.daytime_routes = [...existingRoutes].filter(Boolean).join(' ');
		}
	}

	const rows = [...complexMap.values()].map(r => {
		const lat = parseFloat(r.latitude!);
		const lng = parseFloat(r.longitude!);
		const routes = r.daytime_routes || '';
		const routeCount = routes.split(' ').filter(Boolean).length;

		// Estimate daily ridership from route count (same heuristic as mta-ridership.ts)
		let estimatedRidership = 8000;
		if (routeCount >= 4) estimatedRidership = 40000;
		else if (routeCount >= 3) estimatedRidership = 25000;
		else if (routeCount >= 2) estimatedRidership = 15000;

		return {
			station_name: r.stop_name || 'Unknown',
			complex_id: r.complex_id,
			routes,
			borough: toBoroughCode(r.borough),
			lat,
			lng,
			geom: `SRID=4326;POINT(${lng} ${lat})`,
			estimated_daily_ridership: estimatedRidership,
			route_count: routeCount,
			fetched_at: new Date().toISOString()
		};
	});

	console.log('  Clearing existing data...');
	await supabase.from('nyc_mta_stations').delete().gte('id', 0);

	await upsertBatches('nyc_mta_stations', rows);
	await recordSeed('mta_stations', rows.length, API_URL);
	console.log(`  ✅ Seeded ${rows.length} stations (deduplicated complexes from ${raw.length} stops)`);
}

// ─── Main ────────────────────────────────────────────

async function main() {
	const dataset = process.argv.find(a => a.startsWith('--dataset='))?.split('=')[1] || 'all';

	console.log('═══════════════════════════════════════════════');
	console.log(' NYC Reference Data Seeder');
	console.log(`═══════════════════════════════════════════════`);
	console.log(`Target: ${SUPABASE_URL}`);
	console.log(`Dataset: ${dataset}`);

	try {
		if (dataset === 'all' || dataset === 'subway') {
			await seedSubwayEntrances();
		}
		if (dataset === 'all' || dataset === 'bus') {
			await seedBusStops();
		}
		if (dataset === 'all' || dataset === 'stations') {
			await seedMtaStations();
		}

		// Show summary
		const { data: seeds } = await supabase
			.from('reference_data_seeds')
			.select('*')
			.order('seeded_at', { ascending: false });

		console.log('\n═══════════════════════════════════════════════');
		console.log(' Seed Summary');
		console.log('═══════════════════════════════════════════════');
		for (const seed of seeds || []) {
			console.log(`  ${seed.dataset_name}: ${seed.row_count} rows (${seed.seeded_at})`);
		}

		console.log('\n✅ Done!');
	} catch (err) {
		console.error('\n❌ Seeding failed:', err);
		process.exit(1);
	}
}

main();
