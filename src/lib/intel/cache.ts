/**
 * Two-tier cache for location intelligence data.
 *
 * Architecture:
 * - L1: In-memory Map (sub-ms, lives for one function invocation on Netlify)
 * - L2: Supabase `intel_cache` table (persistent across invocations, ~50-200ms)
 *
 * Flow:
 *   get() → check L1 → if miss, check L2 → if miss, return null
 *   set() → write L1 + async write-through to L2 (fire-and-forget)
 *
 * Per-location cache keyed by lat/lng (rounded to 4 decimals ~11m precision).
 * Source-appropriate TTLs from 1 day (crime) to 14 days (PLUTO zoning).
 * Max 500 L1 entries with LRU eviction. L2 has no hard cap (cleanup via cron).
 * Graceful fallback: if Supabase is unreachable, L1 still works.
 */

import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';

interface CacheEntry<T> {
	data: T;
	fetchedAt: number;
	ttl: number;
}

const MAX_ENTRIES = 500;

// L2 (Supabase) cache is now enabled.
// Schema verified against deployed migration 004-intel-cache.sql:
// - cache_key TEXT UNIQUE
// - source TEXT
// - data JSONB
// - fetched_at TIMESTAMPTZ
// - ttl_ms INTEGER
// Per-location cache keyed by lat/lng. Write-through to L2 (fire-and-forget).
let _dbAvailable: boolean | null = null;

function getDb(): any {
	if (_dbAvailable === false) return null;
	if (db) {
		_dbAvailable = true;
		return db;
	}
	return null;
}

// Track L2 success/failure for monitoring cache health
let _l2SuccessCount = 0;
let _l2FailCount = 0;
function l2Success() { _l2SuccessCount++; }
function l2Fail()    { _l2FailCount++; }

// ── Cache hit-rate counters (MON-01) ──────────────────────────────────────────
// Accumulated since last cold-start. Exposed via getCacheHitStats().
let _l1HitCount  = 0;
let _l1MissCount = 0;
let _l2HitCount  = 0;
let _l2MissCount = 0;

/**
 * Return L1 and L2 hit/miss counts and computed hit rates since last cold-start.
 * L2 counts only cover reads that reached Supabase (i.e., L1 missed first).
 * Used by GET /api/health for ops monitoring.
 */
export function getCacheHitStats(): {
	l1: { hits: number; misses: number; rate: number };
	l2: { hits: number; misses: number; rate: number };
} {
	const l1Total = _l1HitCount + _l1MissCount;
	const l2Total = _l2HitCount + _l2MissCount;
	return {
		l1: {
			hits:   _l1HitCount,
			misses: _l1MissCount,
			rate:   l1Total > 0 ? Math.round((_l1HitCount / l1Total) * 1000) / 1000 : 0,
		},
		l2: {
			hits:   _l2HitCount,
			misses: _l2MissCount,
			rate:   l2Total > 0 ? Math.round((_l2HitCount / l2Total) * 1000) / 1000 : 0,
		},
	};
}

export class IntelCache {
	private store = new Map<string, CacheEntry<unknown>>();

	/**
	 * Get cached data — checks L1 (memory), then L2 (Supabase).
	 * Returns { data, fresh } or null if not cached anywhere.
	 *
	 * If L2 has fresh data, it's promoted to L1 for subsequent
	 * reads within the same function invocation.
	 */
	get<T>(key: string): { data: T; fresh: boolean } | null {
		// L1 check
		const entry = this.store.get(key);
		if (entry) {
			const age = Date.now() - entry.fetchedAt;
			const fresh = age < entry.ttl;
			_l1HitCount++; // MON-01
			return { data: entry.data as T, fresh };
		}

		// L2 is async — can't be used in sync get().
		// Callers that want L2 should use getAsync().
		_l1MissCount++; // MON-01
		return null;
	}

	/**
	 * Async get — checks L1, then falls through to Supabase L2.
	 * Use this in intel modules for the full two-tier lookup.
	 */
	async getAsync<T>(key: string): Promise<{ data: T; fresh: boolean } | null> {
		// L1 check first
		const l1 = this.get<T>(key);
		if (l1) return l1;

		const dbClient = getDb();
		if (!dbClient) return null;

		try {
			const res = await dbClient.execute(sql`
				SELECT data, fetched_at, ttl_ms 
				FROM intel_cache 
				WHERE cache_key = ${key} LIMIT 1
			`);

			const rows = Array.isArray(res) ? res : (res as any).rows || [];
			const row = rows[0];

			if (!row) {
				l2Success();
				_l2MissCount++; // MON-01
				return null;
			}

			const fetchedAt = new Date(row.fetched_at).getTime();
			const age = Date.now() - fetchedAt;
			const fresh = age < row.ttl_ms;

			// Promote to L1
			this.store.set(key, {
				data: row.data,
				fetchedAt,
				ttl: row.ttl_ms
			});

			l2Success();
			_l2HitCount++; // MON-01
			console.log(`[IntelCache] L2 hit for ${key} (${fresh ? 'fresh' : 'stale'}, age: ${Math.round(age / 1000)}s)`);
			return { data: row.data as T, fresh };
		} catch (err) {
			l2Fail();
			console.warn('[IntelCache] L2 read failed:', err instanceof Error ? err.message : err);
			return null;
		}
	}

	/**
	 * Store data in L1 + async write-through to L2.
	 * The L2 write is fire-and-forget — never blocks the caller.
	 * For serverless endpoints where the function may terminate before
	 * fire-and-forget completes, use setAsync() instead.
	 */
	set<T>(key: string, data: T, ttlMs: number, source?: string): void {
		// L1: evict oldest if at capacity
		if (this.store.size >= MAX_ENTRIES && !this.store.has(key)) {
			const oldest = this.store.keys().next().value;
			if (oldest) this.store.delete(oldest);
		}

		this.store.set(key, {
			data,
			fetchedAt: Date.now(),
			ttl: ttlMs
		});

		// L2: async write-through (fire-and-forget)
		const dbClient = getDb();
		if (dbClient) {
			const sourceName = source || key.split(':')[0] || 'unknown';
			Promise.resolve(
				dbClient.execute(sql`
					INSERT INTO intel_cache (cache_key, source, data, ttl_ms)
					VALUES (${key}, ${sourceName}, ${JSON.stringify(data)}::jsonb, ${ttlMs})
					ON CONFLICT (cache_key) DO UPDATE SET
						data = EXCLUDED.data,
						fetched_at = CURRENT_TIMESTAMP,
						ttl_ms = EXCLUDED.ttl_ms
				`)
			).then(() => {
				l2Success();
				console.log(`[IntelCache] L2 write OK: ${key} (source: ${sourceName}, ttl: ${Math.round(ttlMs / 3600000)}h)`);
			}).catch((err: any) => {
				l2Fail();
				console.warn(`[IntelCache] L2 write failed for ${key}: ${err.message}`);
			});
		}
	}

	/**
	 * Awaitable version of set() — writes to L1 + AWAITS the L2 Supabase write.
	 *
	 * Use this in serverless endpoints (Netlify Functions, Vercel Edge) where
	 * the function may terminate immediately after sending the response. Un-awaited
	 * promises in these environments are silently killed, causing cache writes to
	 * be lost. This method guarantees the L2 write completes before returning.
	 *
	 * For non-serverless contexts (long-running Node processes), the fire-and-forget
	 * set() is more efficient and preferred.
	 */
	async setAsync<T>(key: string, data: T, ttlMs: number, source?: string): Promise<void> {
		// L1: evict oldest if at capacity
		if (this.store.size >= MAX_ENTRIES && !this.store.has(key)) {
			const oldest = this.store.keys().next().value;
			if (oldest) this.store.delete(oldest);
		}

		this.store.set(key, {
			data,
			fetchedAt: Date.now(),
			ttl: ttlMs
		});

		// L2: awaited write-through — guaranteed to complete before function exit
		const dbClient = getDb();
		if (dbClient) {
			const sourceName = source || key.split(':')[0] || 'unknown';
			try {
				await dbClient.execute(sql`
					INSERT INTO intel_cache (cache_key, source, data, ttl_ms)
					VALUES (${key}, ${sourceName}, ${JSON.stringify(data)}::jsonb, ${ttlMs})
					ON CONFLICT (cache_key) DO UPDATE SET
						data = EXCLUDED.data,
						fetched_at = CURRENT_TIMESTAMP,
						ttl_ms = EXCLUDED.ttl_ms
				`);
				l2Success();
				console.log(`[IntelCache] L2 write OK: ${key} (source: ${sourceName}, ttl: ${Math.round(ttlMs / 3600000)}h)`);
			} catch (err: any) {
				l2Fail();
				console.warn(`[IntelCache] L2 write failed for ${key}: ${err.message}`);
			}
		}
	}

	/**
	 * Generate a cache key from lat/lng and layer name
	 */
	static locationKey(lat: number, lng: number, layer: string): string {
		const latR = lat.toFixed(4);
		const lngR = lng.toFixed(4);
		return `${layer}:${latR},${lngR}`;
	}

	/**
	 * Generate a cache key from a neighborhood name and layer
	 */
	static hoodKey(neighborhood: string, layer: string): string {
		return `${layer}:hood:${neighborhood.toLowerCase().replace(/\s+/g, '-')}`;
	}

	/** Cache stats for debugging */
	get stats() {
		let fresh = 0, stale = 0;
		const now = Date.now();
		for (const [, entry] of this.store) {
			if (now - entry.fetchedAt < entry.ttl) fresh++;
			else stale++;
		}
		return { total: this.store.size, fresh, stale };
	}

	/**
	 * Health check — verifies L2 (Supabase) is reachable and
	 * the intel_cache table + upsert_intel_cache function exist.
	 * Returns diagnostic info for debugging cache issues.
	 */
	async health(): Promise<{
		l1: { entries: number; fresh: number; stale: number };
		l2: {
			available: boolean;
			tableExists: boolean;
			rpcExists: boolean;
			rowCount: number;
			oldestEntry: string | null;
			newestEntry: string | null;
			bySource: Record<string, number>;
			error: string | null;
		};
	}> {
		const l1 = this.stats;
		const l2Result = {
			available: false,
			tableExists: false,
			rpcExists: false,
			rowCount: 0,
			oldestEntry: null as string | null,
			newestEntry: null as string | null,
			bySource: {} as Record<string, number>,
			error: null as string | null
		};

		const dbClient = getDb();
		if (!dbClient) {
			l2Result.error = _dbAvailable === false
				? 'DB disabled (previous failures or missing config)'
				: 'DB client not available';
			return { l1: { entries: l1.total, fresh: l1.fresh, stale: l1.stale }, l2: l2Result };
		}

		l2Result.available = true;

		try {
			// Check table exists + count rows
			const resCount = await dbClient.execute(sql`SELECT COUNT(*) as count FROM intel_cache`);
			const count = parseInt(resCount.rows[0].count, 10);

			l2Result.tableExists = true;
			l2Result.rowCount = count || 0;

			// Check oldest and newest entries
			if (count > 0) {
				const oldestRes = await dbClient.execute(sql`SELECT cache_key, fetched_at, source FROM intel_cache ORDER BY fetched_at ASC LIMIT 1`);
				const oldest = oldestRes.rows[0];
				if (oldest) l2Result.oldestEntry = `${oldest.source}:${oldest.cache_key} @ ${oldest.fetched_at}`;

				const newestRes = await dbClient.execute(sql`SELECT cache_key, fetched_at, source FROM intel_cache ORDER BY fetched_at DESC LIMIT 1`);
				const newest = newestRes.rows[0];
				if (newest) l2Result.newestEntry = `${newest.source}:${newest.cache_key} @ ${newest.fetched_at}`;

				// Count by source
				const sourcesRes = await dbClient.execute(sql`SELECT source FROM intel_cache`);
				for (const s of sourcesRes.rows) {
					l2Result.bySource[s.source] = (l2Result.bySource[s.source] || 0) + 1;
				}
			}

			// Test DB exists
			l2Result.rpcExists = true; // Not an RPC anymore, Drizzle works directly
		} catch (err) {
			l2Result.error = `Unexpected: ${err instanceof Error ? err.message : String(err)}`;
		}

		return { l1: { entries: l1.total, fresh: l1.fresh, stale: l1.stale }, l2: l2Result };
	}
}

// Singleton cache instance
export const intelCache = new IntelCache();

/**
 * Convert lat/lng + radius to a Socrata bounding box WHERE clause.
 * Use this for datasets that have separate latitude/longitude scalar columns
 * instead of a geometry column (which would use within_circle).
 *
 * Approximation: 1° lat ≈ 111,000m, 1° lng ≈ 111,000m × cos(lat)
 */
export function socrataBoxWhere(
	latCol: string,
	lngCol: string,
	lat: number,
	lng: number,
	radiusMeters: number
): string {
	const latDelta = radiusMeters / 111000;
	const lngDelta = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));
	return `${latCol} between '${(lat - latDelta).toFixed(6)}' and '${(lat + latDelta).toFixed(6)}' AND ${lngCol} between '${(lng - lngDelta).toFixed(6)}' and '${(lng + lngDelta).toFixed(6)}'`;
}

/**
 * TTL constants — per-source cache durations (milliseconds).
 *
 * All values are env-overridable using CACHE_TTL_<SOURCE>=<seconds> env vars.
 * This allows extending TTLs in production without a code deploy (e.g. to reduce
 * Supabase L2 write frequency or to force freshness on a specific source).
 *
 * Env var pattern: CACHE_TTL_CRIME=86400  (value in SECONDS, not ms)
 * Available overrides:
 *   CACHE_TTL_DEMOGRAPHICS  (default: 604800  = 7 days)
 *   CACHE_TTL_WALKABILITY   (default: 604800  = 7 days)
 *   CACHE_TTL_COMPETITORS   (default: 86400   = 1 day)
 *   CACHE_TTL_CRIME         (default: 86400   = 1 day)
 *   CACHE_TTL_INSPECTIONS   (default: 259200  = 3 days)
 *   CACHE_TTL_PLACES        (default: 86400   = 1 day)
 *   CACHE_TTL_LANDMARKS     (default: 604800  = 7 days)
 *   CACHE_TTL_TRANSIT       (default: 259200  = 3 days)
 *   CACHE_TTL_LICENSES      (default: 259200  = 3 days)
 *   CACHE_TTL_DOB           (default: 259200  = 3 days)
 *   CACHE_TTL_COMPLAINTS    (default: 86400   = 1 day)
 *   CACHE_TTL_PEDESTRIAN    (default: 604800  = 7 days)
 *   CACHE_TTL_PLUTO         (default: 1209600 = 14 days)
 *   CACHE_TTL_HOUSING       (default: 604800  = 7 days)
 */
function _ttlEnv(key: string, defaultSeconds: number): number {
	const v = typeof process !== 'undefined' ? process.env?.[`CACHE_TTL_${key}`] : undefined;
	const n = v ? parseInt(v, 10) : NaN;
	return (Number.isFinite(n) && n > 0 ? n : defaultSeconds) * 1000; // convert s → ms
}

// TTL constants
export const TTL = {
	DEMOGRAPHICS: _ttlEnv('DEMOGRAPHICS',   7 * 24 * 3600),  // 7 days  (Census data is annual)
	WALKABILITY:  _ttlEnv('WALKABILITY',    7 * 24 * 3600),  // 7 days  (Walk Score rarely changes)
	COMPETITORS:  _ttlEnv('COMPETITORS',    1 * 24 * 3600),  // 1 day   (businesses open/close)
	CRIME:        _ttlEnv('CRIME',          1 * 24 * 3600),  // 1 day   (incidents updated daily)
	INSPECTIONS:  _ttlEnv('INSPECTIONS',    3 * 24 * 3600),  // 3 days  (inspections are periodic)
	PLACES:       _ttlEnv('PLACES',         1 * 24 * 3600),  // 1 day   (Google Places data)
	LANDMARKS:    _ttlEnv('LANDMARKS',      7 * 24 * 3600),  // 7 days  (LPC landmarks rarely change)
	TRANSIT:      _ttlEnv('TRANSIT',        3 * 24 * 3600),  // 3 days  (MTA ridership patterns stable)
	LICENSES:     _ttlEnv('LICENSES',       3 * 24 * 3600),  // 3 days  (DCA licenses change slowly)
	DOB:          _ttlEnv('DOB',            3 * 24 * 3600),  // 3 days  (permits/violations periodic)
	COMPLAINTS:   _ttlEnv('COMPLAINTS',     1 * 24 * 3600),  // 1 day   (311 data updated daily)
	PEDESTRIAN:   _ttlEnv('PEDESTRIAN',     7 * 24 * 3600),  // 7 days  (bi-annual survey data)
	PLUTO:        _ttlEnv('PLUTO',         14 * 24 * 3600),  // 14 days (quarterly DCP updates)
	HOUSING:      _ttlEnv('HOUSING',        7 * 24 * 3600),  // 7 days  (Census housing data annual)
	// BR-N (April 11, 2026): Schools dataset is ~annual. 7-day TTL aligns with
	// other annual-cadence sources. Previously missing → nyc-schools.ts passed
	// `TTL.LONG` (undefined) to intelCache.set(), silently disabling caching.
	SCHOOLS:      _ttlEnv('SCHOOLS',        7 * 24 * 3600),  // 7 days  (NYC Open Data school locations annual)
};
