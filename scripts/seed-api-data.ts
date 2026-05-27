#!/usr/bin/env npx tsx
/**
 * Thread 3 — Paid API Seeding Pipeline
 * Seeds block_group_intel with WalkScore, Google Places, Foursquare, and Yelp data
 * for all block group centroids.
 *
 * Usage:
 *   npx tsx scripts/seed-api-data.ts                    # run all sources
 *   npx tsx scripts/seed-api-data.ts --source walkscore # run one source only
 *   npx tsx scripts/seed-api-data.ts --dry-run          # check centroids, no API calls
 *   npx tsx scripts/seed-api-data.ts --limit 10         # process only first N centroids
 *
 * Resumable: checks block_group_intel for existing fresh records before each API call.
 * Safe to restart at any time.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WALKSCORE_API_KEY = process.env.WALKSCORE_API_KEY || '';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY || '';
const YELP_API_KEY = process.env.YELP_API_KEY || '';

// Validate Supabase creds (always required)
if (!SUPABASE_URL) { console.error('FATAL: Missing env var SUPABASE_URL'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('FATAL: Missing env var SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

// Source-specific API key validation (only check what we need for this run)
const SOURCE_API_KEYS: Record<string, { key: string; name: string }> = {
  walkscore:     { key: WALKSCORE_API_KEY,     name: 'WALKSCORE_API_KEY' },
  google_places: { key: GOOGLE_PLACES_API_KEY, name: 'GOOGLE_PLACES_API_KEY' },
  foursquare:    { key: FOURSQUARE_API_KEY,    name: 'FOURSQUARE_API_KEY' },
  yelp:          { key: YELP_API_KEY,          name: 'YELP_API_KEY' },
};

const SOURCES = ["walkscore", "google_places", "foursquare", "yelp"] as const;
type Source = (typeof SOURCES)[number];

interface Centroid {
  geoid: string;
  centroid_lat: number;
  centroid_lng: number;
}

interface SeedResult {
  data: Record<string, unknown>;
  ttl_hours: number;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force"); // skip resumability, re-seed everything
const LIMIT = (() => {
  const idx = args.indexOf("--limit");
  return idx !== -1 ? parseInt(args[idx + 1], 10) : 0;
})();
const SOURCE_FILTER = (() => {
  const idx = args.indexOf("--source");
  if (idx === -1) return null;
  const val = args[idx + 1] as Source;
  if (!SOURCES.includes(val)) {
    console.error(`Unknown source: ${val}. Valid: ${SOURCES.join(", ")}`);
    process.exit(1);
  }
  return val;
})();

// Validate API key for the selected source(s)
const sourcesToValidate = SOURCE_FILTER ? [SOURCE_FILTER] : [...SOURCES];
for (const src of sourcesToValidate) {
  const { key, name } = SOURCE_API_KEYS[src];
  if (!key) { console.error(`FATAL: Missing env var ${name} (required for --source ${src})`); process.exit(1); }
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function supabaseGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "count=exact",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function supabaseUpsert(
  geoid: string,
  source: Source,
  data: Record<string, unknown>,
  ttl_hours: number
): Promise<void> {
  const body = {
    geoid,
    source,
    data,
    ttl_hours,
    fetched_at: new Date().toISOString(),
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/block_group_intel?on_conflict=geoid,source`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates", // upsert on unique constraint
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed for ${geoid}/${source}: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Resumability: batch-load all already-seeded geoids for a source
// ---------------------------------------------------------------------------

async function loadSeededGeoids(source: Source): Promise<Set<string>> {
  const seeded = new Set<string>();
  let offset = 0;
  const pageSize = 1000;
  const now = Date.now();
  while (true) {
    const rows = await supabaseGet<Array<{ geoid: string; fetched_at: string; ttl_hours: number }>>(
      `block_group_intel?source=eq.${source}&select=geoid,fetched_at,ttl_hours&order=geoid&offset=${offset}&limit=${pageSize}`
    );
    for (const { geoid, fetched_at, ttl_hours } of rows) {
      const expiresAt = new Date(fetched_at).getTime() + ttl_hours * 3600_000;
      if (now < expiresAt) seeded.add(geoid); // still fresh
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return seeded;
}

// ---------------------------------------------------------------------------
// Load centroids from block_groups
// ---------------------------------------------------------------------------

async function loadCentroids(): Promise<Centroid[]> {
  // Supabase paginates at 1000 rows — fetch all pages
  const all: Centroid[] = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const page = await supabaseGet<Centroid[]>(
      `block_groups?select=geoid,centroid_lat,centroid_lng&order=geoid&offset=${offset}&limit=${pageSize}`
    );
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Delay helper
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// API Seeders
// ---------------------------------------------------------------------------

async function seedWalkScore(lat: number, lng: number): Promise<SeedResult> {
  const url = `https://api.walkscore.com/score?format=json&lat=${lat}&lon=${lng}&transit=1&bike=1&wsapikey=${WALKSCORE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WalkScore HTTP ${res.status}`);
  const raw = await res.json();

  return {
    data: {
      walkscore: raw.walkscore ?? null,
      description: raw.description ?? null,
      transit_score: raw.transit?.score ?? null,
      transit_description: raw.transit?.description ?? null,
      transit_summary: raw.transit?.summary ?? null,
      bike_score: raw.bike?.score ?? null,
      bike_description: raw.bike?.description ?? null,
      raw, // keep full response for future use
    },
    ttl_hours: 720, // 30 days
  };
}

async function seedGooglePlaces(lat: number, lng: number): Promise<SeedResult> {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=400&key=${GOOGLE_PLACES_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`);
  const raw = await res.json();

  const results: Array<Record<string, unknown>> = raw.results ?? [];
  const totalResults = results.length;

  // Type distribution
  const typeCounts: Record<string, number> = {};
  for (const place of results) {
    const types = (place.types as string[]) ?? [];
    for (const t of types) {
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
  }

  // Rating stats
  const ratings = results.map((p) => p.rating as number).filter((r) => r != null);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  // Price level distribution
  const priceLevels: Record<number, number> = {};
  for (const place of results) {
    const pl = place.price_level as number | undefined;
    if (pl != null) {
      priceLevels[pl] = (priceLevels[pl] || 0) + 1;
    }
  }

  // Top categories (sorted by count, top 10)
  const topCategories = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => ({ type, count }));

  return {
    data: {
      total_results: totalResults,
      type_distribution: typeCounts,
      avg_rating: avgRating ? Math.round(avgRating * 100) / 100 : null,
      price_level_distribution: priceLevels,
      top_categories: topCategories,
      rating_count: ratings.length,
      status: raw.status,
    },
    ttl_hours: 720, // 30 days — Places data doesn't change daily; prevents expensive re-seed
  };
}

async function seedFoursquare(lat: number, lng: number): Promise<SeedResult> {
  // Migrated to new Foursquare Places API (old /v3/ endpoint returned 410 Gone)
  // New host: places-api.foursquare.com, requires X-Places-Api-Version header
  // NOTE: Requires a NEW Foursquare service key (old API keys are rejected 401)
  const url = `https://places-api.foursquare.com/places/search?ll=${lat},${lng}&radius=400&limit=50`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
      Accept: "application/json",
      "X-Places-Api-Version": "2025-06-17",
    },
  });
  if (!res.ok) throw new Error(`Foursquare HTTP ${res.status}`);
  const raw = await res.json();

  // New API: results array contains place objects with fsq_place_id, categories, etc.
  const results: Array<Record<string, unknown>> = raw.results ?? [];
  const totalVenues = results.length;

  // Category distribution
  const catCounts: Record<string, number> = {};
  for (const venue of results) {
    const cats = (venue.categories as Array<{ name: string }>) ?? [];
    for (const c of cats) {
      catCounts[c.name] = (catCounts[c.name] || 0) + 1;
    }
  }

  const topCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Popularity signals (chains vs independents)
  const chainCount = results.filter((v) => (v.chains as unknown[])?.length > 0).length;

  return {
    data: {
      total_venues: totalVenues,
      category_distribution: catCounts,
      top_categories: topCategories,
      chain_count: chainCount,
      independent_count: totalVenues - chainCount,
    },
    ttl_hours: 24,
  };
}

async function seedYelp(lat: number, lng: number): Promise<SeedResult> {
  const url = `https://api.yelp.com/v3/businesses/search?latitude=${lat}&longitude=${lng}&radius=400&limit=50`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${YELP_API_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Yelp HTTP ${res.status}`);
  const raw = await res.json();

  const businesses: Array<Record<string, unknown>> = raw.businesses ?? [];
  const totalBusinesses = businesses.length;

  // Rating distribution
  const ratings = businesses.map((b) => b.rating as number).filter((r) => r != null);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  // Review count distribution
  const reviewCounts = businesses.map((b) => b.review_count as number).filter((r) => r != null);
  const totalReviews = reviewCounts.reduce((a, b) => a + b, 0);

  // Price level distribution
  const priceLevels: Record<string, number> = {};
  for (const biz of businesses) {
    const pl = biz.price as string | undefined;
    if (pl) {
      priceLevels[pl] = (priceLevels[pl] || 0) + 1;
    }
  }

  // Top categories
  const catCounts: Record<string, number> = {};
  for (const biz of businesses) {
    const cats = (biz.categories as Array<{ title: string }>) ?? [];
    for (const c of cats) {
      catCounts[c.title] = (catCounts[c.title] || 0) + 1;
    }
  }
  const topCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([title, count]) => ({ title, count }));

  return {
    data: {
      total_businesses: totalBusinesses,
      avg_rating: avgRating ? Math.round(avgRating * 100) / 100 : null,
      total_reviews: totalReviews,
      price_level_distribution: priceLevels,
      top_categories: topCategories,
      rating_count: ratings.length,
    },
    ttl_hours: 24,
  };
}

// ---------------------------------------------------------------------------
// Source config: seeder function + delay + daily cap
// ---------------------------------------------------------------------------

interface SourceConfig {
  fn: (lat: number, lng: number) => Promise<SeedResult>;
  delayMs: number;
  dailyCap: number; // 0 = unlimited
}

const SOURCE_CONFIG: Record<Source, SourceConfig> = {
  walkscore: { fn: seedWalkScore, delayMs: 200, dailyCap: 5000 },
  google_places: { fn: seedGooglePlaces, delayMs: 100, dailyCap: 0 },
  foursquare: { fn: seedFoursquare, delayMs: 20, dailyCap: 0 },
  yelp: { fn: seedYelp, delayMs: 200, dailyCap: 500 },
};

// ---------------------------------------------------------------------------
// Main seeding loop for one source
// ---------------------------------------------------------------------------

async function seedSource(source: Source, centroids: Centroid[]): Promise<void> {
  const config = SOURCE_CONFIG[source];
  const total = centroids.length;
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let apiCalls = 0;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${source}] Starting — ${total} centroids to process`);
  if (config.dailyCap > 0) {
    console.log(`[${source}] Daily cap: ${config.dailyCap} calls/day`);
  }

  // Batch-load already-seeded geoids (one query vs N queries)
  let seededGeoids: Set<string>;
  if (FORCE) {
    seededGeoids = new Set();
    console.log(`[${source}] --force: skipping resumability, will re-seed all`);
  } else {
    console.log(`[${source}] Loading already-seeded geoids...`);
    try {
      seededGeoids = await loadSeededGeoids(source);
    } catch (e) {
      seededGeoids = new Set();
    }
    console.log(`[${source}] Found ${seededGeoids.size} fresh records to skip`);
  }
  console.log(`${"=".repeat(60)}`);

  for (let i = 0; i < total; i++) {
    const { geoid, centroid_lat, centroid_lng } = centroids[i];

    // Daily cap check
    if (config.dailyCap > 0 && apiCalls >= config.dailyCap) {
      console.log(
        `\n[${source}] DAILY CAP REACHED (${config.dailyCap}). ` +
          `${total - i} centroids remaining. Re-run tomorrow to continue.`
      );
      break;
    }

    // Resumability check (O(1) set lookup — no network call)
    if (seededGeoids.has(geoid)) {
      skipped++;
      processed++;
      if (processed % 100 === 0) {
        printProgress(source, processed, total, skipped, errors, apiCalls);
      }
      continue;
    }

    if (DRY_RUN) {
      processed++;
      apiCalls++;
      if (processed % 100 === 0) {
        console.log(`[${source}] DRY RUN — ${processed}/${total} (would call API here)`);
      }
      continue;
    }

    // Make the API call
    try {
      const result = await config.fn(centroid_lat, centroid_lng);
      await supabaseUpsert(geoid, source, result.data, result.ttl_hours);
      apiCalls++;
    } catch (err: unknown) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      // Log but don't stop — resumable design means we can retry on next run
      if (errors <= 10 || errors % 50 === 0) {
        console.error(`[${source}] ERROR on ${geoid}: ${msg}`);
      }

      // If we get a 429 (rate limited), back off significantly
      if (msg.includes("429")) {
        console.log(`[${source}] Rate limited. Backing off 60s...`);
        await sleep(60_000);
      }
    }

    processed++;
    if (processed % 100 === 0) {
      printProgress(source, processed, total, skipped, errors, apiCalls);
    }

    // Polite delay between calls
    if (!DRY_RUN) {
      await sleep(config.delayMs);
    }
  }

  // Final summary
  console.log(`\n[${source}] DONE — ${processed}/${total} processed`);
  console.log(`[${source}]   API calls made: ${apiCalls}`);
  console.log(`[${source}]   Skipped (fresh): ${skipped}`);
  console.log(`[${source}]   Errors: ${errors}`);
}

function printProgress(
  source: Source,
  processed: number,
  total: number,
  skipped: number,
  errors: number,
  apiCalls: number
): void {
  const remaining = total - processed;
  const pct = ((processed / total) * 100).toFixed(1);
  console.log(
    `[${source}] ${processed}/${total} complete (${pct}%), ` +
      `${remaining} remaining, ${skipped} skipped, ${errors} errors, ${apiCalls} API calls`
  );
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Thread 3 — Paid API Seeding Pipeline");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (LIMIT > 0) console.log(`Limit: ${LIMIT} centroids`);
  if (SOURCE_FILTER) console.log(`Source filter: ${SOURCE_FILTER}`);
  console.log();

  // Step 0: Load centroids
  console.log("Loading centroids from block_groups...");
  let centroids: Centroid[] = [];
  try {
    centroids = await loadCentroids();
  } catch (e) {
    console.error(
      "FATAL: Could not load block_groups table. " +
        "Thread 1 must create and populate it first.\n" +
        `Error: ${e instanceof Error ? e.message : e}`
    );
    process.exit(1);
  }

  if (centroids.length === 0) {
    console.error("FATAL: block_groups table is empty. Thread 1 must populate centroids first.");
    process.exit(1);
  }

  console.log(`Loaded ${centroids.length} centroids`);

  // Apply limit if set
  if (LIMIT > 0) {
    centroids = centroids.slice(0, LIMIT);
    console.log(`Limited to first ${centroids.length} centroids`);
  }

  // Determine which sources to run
  const sources: Source[] = SOURCE_FILTER ? [SOURCE_FILTER] : [...SOURCES];

  // Run sources sequentially (they share the event loop and we want clean logging)
  const startTime = Date.now();
  for (const source of sources) {
    await seedSource(source, centroids);
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`All sources complete. Total time: ${elapsed} minutes`);
  console.log(`${"=".repeat(60)}`);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
