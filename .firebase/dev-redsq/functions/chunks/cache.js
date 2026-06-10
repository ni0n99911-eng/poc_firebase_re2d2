import { d as db } from "./db-server.js";
import { sql } from "drizzle-orm";
const MAX_ENTRIES = 500;
let _dbAvailable = null;
function getDb() {
  if (_dbAvailable === false) return null;
  if (db) {
    _dbAvailable = true;
    return db;
  }
  return null;
}
function l2Success() {
}
let _l1HitCount = 0;
let _l1MissCount = 0;
let _l2HitCount = 0;
let _l2MissCount = 0;
function getCacheHitStats() {
  const l1Total = _l1HitCount + _l1MissCount;
  const l2Total = _l2HitCount + _l2MissCount;
  return {
    l1: {
      hits: _l1HitCount,
      misses: _l1MissCount,
      rate: l1Total > 0 ? Math.round(_l1HitCount / l1Total * 1e3) / 1e3 : 0
    },
    l2: {
      hits: _l2HitCount,
      misses: _l2MissCount,
      rate: l2Total > 0 ? Math.round(_l2HitCount / l2Total * 1e3) / 1e3 : 0
    }
  };
}
class IntelCache {
  store = /* @__PURE__ */ new Map();
  /**
   * Get cached data — checks L1 (memory), then L2 (Supabase).
   * Returns { data, fresh } or null if not cached anywhere.
   *
   * If L2 has fresh data, it's promoted to L1 for subsequent
   * reads within the same function invocation.
   */
  get(key) {
    const entry = this.store.get(key);
    if (entry) {
      const age = Date.now() - entry.fetchedAt;
      const fresh = age < entry.ttl;
      _l1HitCount++;
      return { data: entry.data, fresh };
    }
    _l1MissCount++;
    return null;
  }
  /**
   * Async get — checks L1, then falls through to Supabase L2.
   * Use this in intel modules for the full two-tier lookup.
   */
  async getAsync(key) {
    const l1 = this.get(key);
    if (l1) return l1;
    const dbClient = getDb();
    if (!dbClient) return null;
    try {
      const res = await dbClient.execute(sql`
				SELECT data, fetched_at, ttl_ms 
				FROM intel_cache 
				WHERE cache_key = ${key} LIMIT 1
			`);
      const rows = Array.isArray(res) ? res : res.rows || [];
      const row = rows[0];
      if (!row) {
        l2Success();
        _l2MissCount++;
        return null;
      }
      const fetchedAt = new Date(row.fetched_at).getTime();
      const age = Date.now() - fetchedAt;
      const fresh = age < row.ttl_ms;
      this.store.set(key, {
        data: row.data,
        fetchedAt,
        ttl: row.ttl_ms
      });
      l2Success();
      _l2HitCount++;
      console.log(`[IntelCache] L2 hit for ${key} (${fresh ? "fresh" : "stale"}, age: ${Math.round(age / 1e3)}s)`);
      return { data: row.data, fresh };
    } catch (err) {
      console.warn("[IntelCache] L2 read failed:", err instanceof Error ? err.message : err);
      return null;
    }
  }
  /**
   * Store data in L1 + async write-through to L2.
   * The L2 write is fire-and-forget — never blocks the caller.
   * For serverless endpoints where the function may terminate before
   * fire-and-forget completes, use setAsync() instead.
   */
  set(key, data, ttlMs, source) {
    if (this.store.size >= MAX_ENTRIES && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, {
      data,
      fetchedAt: Date.now(),
      ttl: ttlMs
    });
    const dbClient = getDb();
    if (dbClient) {
      const sourceName = source || key.split(":")[0] || "unknown";
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
        console.log(`[IntelCache] L2 write OK: ${key} (source: ${sourceName}, ttl: ${Math.round(ttlMs / 36e5)}h)`);
      }).catch((err) => {
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
  async setAsync(key, data, ttlMs, source) {
    if (this.store.size >= MAX_ENTRIES && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, {
      data,
      fetchedAt: Date.now(),
      ttl: ttlMs
    });
    const dbClient = getDb();
    if (dbClient) {
      const sourceName = source || key.split(":")[0] || "unknown";
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
        console.log(`[IntelCache] L2 write OK: ${key} (source: ${sourceName}, ttl: ${Math.round(ttlMs / 36e5)}h)`);
      } catch (err) {
        console.warn(`[IntelCache] L2 write failed for ${key}: ${err.message}`);
      }
    }
  }
  /**
   * Generate a cache key from lat/lng and layer name
   */
  static locationKey(lat, lng, layer) {
    const latR = lat.toFixed(4);
    const lngR = lng.toFixed(4);
    return `${layer}:${latR},${lngR}`;
  }
  /**
   * Generate a cache key from a neighborhood name and layer
   */
  static hoodKey(neighborhood, layer) {
    return `${layer}:hood:${neighborhood.toLowerCase().replace(/\s+/g, "-")}`;
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
  async health() {
    const l1 = this.stats;
    const l2Result = {
      available: false,
      tableExists: false,
      rpcExists: false,
      rowCount: 0,
      oldestEntry: null,
      newestEntry: null,
      bySource: {},
      error: null
    };
    const dbClient = getDb();
    if (!dbClient) {
      l2Result.error = _dbAvailable === false ? "DB disabled (previous failures or missing config)" : "DB client not available";
      return { l1: { entries: l1.total, fresh: l1.fresh, stale: l1.stale }, l2: l2Result };
    }
    l2Result.available = true;
    try {
      const resCount = await dbClient.execute(sql`SELECT COUNT(*) as count FROM intel_cache`);
      const count = parseInt(resCount.rows[0].count, 10);
      l2Result.tableExists = true;
      l2Result.rowCount = count || 0;
      if (count > 0) {
        const oldestRes = await dbClient.execute(sql`SELECT cache_key, fetched_at, source FROM intel_cache ORDER BY fetched_at ASC LIMIT 1`);
        const oldest = oldestRes.rows[0];
        if (oldest) l2Result.oldestEntry = `${oldest.source}:${oldest.cache_key} @ ${oldest.fetched_at}`;
        const newestRes = await dbClient.execute(sql`SELECT cache_key, fetched_at, source FROM intel_cache ORDER BY fetched_at DESC LIMIT 1`);
        const newest = newestRes.rows[0];
        if (newest) l2Result.newestEntry = `${newest.source}:${newest.cache_key} @ ${newest.fetched_at}`;
        const sourcesRes = await dbClient.execute(sql`SELECT source FROM intel_cache`);
        for (const s of sourcesRes.rows) {
          l2Result.bySource[s.source] = (l2Result.bySource[s.source] || 0) + 1;
        }
      }
      l2Result.rpcExists = true;
    } catch (err) {
      l2Result.error = `Unexpected: ${err instanceof Error ? err.message : String(err)}`;
    }
    return { l1: { entries: l1.total, fresh: l1.fresh, stale: l1.stale }, l2: l2Result };
  }
}
const intelCache = new IntelCache();
function socrataBoxWhere(latCol, lngCol, lat, lng, radiusMeters) {
  const latDelta = radiusMeters / 111e3;
  const lngDelta = radiusMeters / (111e3 * Math.cos(lat * Math.PI / 180));
  return `${latCol} between '${(lat - latDelta).toFixed(6)}' and '${(lat + latDelta).toFixed(6)}' AND ${lngCol} between '${(lng - lngDelta).toFixed(6)}' and '${(lng + lngDelta).toFixed(6)}'`;
}
function _ttlEnv(key, defaultSeconds) {
  const v = typeof process !== "undefined" ? process.env?.[`CACHE_TTL_${key}`] : void 0;
  const n = v ? parseInt(v, 10) : NaN;
  return (Number.isFinite(n) && n > 0 ? n : defaultSeconds) * 1e3;
}
const TTL = {
  DEMOGRAPHICS: _ttlEnv("DEMOGRAPHICS", 7 * 24 * 3600),
  // 7 days  (Census data is annual)
  WALKABILITY: _ttlEnv("WALKABILITY", 7 * 24 * 3600),
  // 7 days  (Walk Score rarely changes)
  COMPETITORS: _ttlEnv("COMPETITORS", 1 * 24 * 3600),
  // 1 day   (businesses open/close)
  CRIME: _ttlEnv("CRIME", 1 * 24 * 3600),
  // 1 day   (incidents updated daily)
  INSPECTIONS: _ttlEnv("INSPECTIONS", 3 * 24 * 3600),
  // 3 days  (inspections are periodic)
  PLACES: _ttlEnv("PLACES", 1 * 24 * 3600),
  // 1 day   (Google Places data)
  LANDMARKS: _ttlEnv("LANDMARKS", 7 * 24 * 3600),
  // 7 days  (LPC landmarks rarely change)
  TRANSIT: _ttlEnv("TRANSIT", 3 * 24 * 3600),
  // 3 days  (MTA ridership patterns stable)
  LICENSES: _ttlEnv("LICENSES", 3 * 24 * 3600),
  // 3 days  (DCA licenses change slowly)
  DOB: _ttlEnv("DOB", 3 * 24 * 3600),
  // 3 days  (permits/violations periodic)
  COMPLAINTS: _ttlEnv("COMPLAINTS", 1 * 24 * 3600),
  // 1 day   (311 data updated daily)
  PEDESTRIAN: _ttlEnv("PEDESTRIAN", 7 * 24 * 3600),
  // 7 days  (bi-annual survey data)
  PLUTO: _ttlEnv("PLUTO", 14 * 24 * 3600),
  // 14 days (quarterly DCP updates)
  HOUSING: _ttlEnv("HOUSING", 7 * 24 * 3600),
  // 7 days  (Census housing data annual)
  // BR-N (April 11, 2026): Schools dataset is ~annual. 7-day TTL aligns with
  // other annual-cadence sources. Previously missing → nyc-schools.ts passed
  // `TTL.LONG` (undefined) to intelCache.set(), silently disabling caching.
  SCHOOLS: _ttlEnv("SCHOOLS", 7 * 24 * 3600)
  // 7 days  (NYC Open Data school locations annual)
};
export {
  IntelCache as I,
  TTL as T,
  getCacheHitStats as g,
  intelCache as i,
  socrataBoxWhere as s
};
