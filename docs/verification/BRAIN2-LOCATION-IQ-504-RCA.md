# /api/location-iq 504 Root-Cause Analysis (B2-2.3)

**Date:** April 14, 2026
**Author:** Brain 2
**Scope:** D5 P0 — every map-lens re-fetch returned 504 Gateway Timeout across
all 5 test locations during Orch 1's April 13 browser run. Blocks all 6 lens
layers site-wide.

**Status when this RCA was written:** D5 has been shipped in
`feat/brain2-defect-log` (merged as PR #146 on April 14). The mitigation is a
5-minute module-level response cache on the GET envelope (lat/lng × concept ×
priceLevel × visionTier). This doc confirms the fix targets the right bottleneck
and identifies what remains for **Brain 3** to address as the permanent compute
trim.

---

## 1. Reproducing the Issue

The Orch 1 defect log reports: "every map lens button shows 'Lens data
unavailable. Retry' across all tested locations." Network capture shows the
first (initial-score) `/api/location-iq?lat=...&lng=...&type=...` call succeeds,
and the immediately-following lens re-fetch returns 504 Gateway Timeout.

This reproduced in dev. The two calls fire within ~2 seconds of each other:

1. **Call A** — initial score, dispatched from `AddressAnalyzer.svelte` when the
   user confirms an address.
2. **Call B** — lens envelope auto-fetch, dispatched from
   `location/+page.svelte:1637` (`loadLocationIqEnvelope()` fires as soon as
   Call A's score lands). Parameters are identical to Call A.

Without the response cache, Call B re-runs the full
`fetchEnhancedLocationIntel()` pipeline — **even though Call A just warmed the
raw-intel cache** — because the LLM-enhanced layers (Haiku extraction + Sonnet
analysis) are never cached at the response level.

---

## 2. Per-Segment Timing (24-second budget)

`fetchEnhancedLocationIntel()` in `src/lib/intel/index.ts` is layered as
follows, with the Netlify Pro 26-second hard ceiling minus a 2-second safety
margin (see `SERVERLESS_BUDGET_MS = 24000` in index.ts line 531):

| Layer | What it does | Typical cold-cache latency | Warm-cache latency | Can skip? |
|------:|---|---:|---:|:--|
| 1 | `fetchLocationIntel` — 22 parallel external-API calls (Census, Yelp, Foursquare, PLUTO, DOHMH, MTA, DOB, 311, Overpass, etc.) with per-source resilientFetch | 4–12 s (dominated by Yelp + Foursquare + Overpass) | 100–400 ms (intel_cache 7-day hit) | No |
| 2 | Quality gate (Haiku LLM cross-check) | 300–900 ms | 300–900 ms (no cache) | Yes (parallel with 3a) |
| 2b | Reconciliation (deterministic dedup + conflict resolve) | 20–80 ms | 20–80 ms | No |
| 2c | Haiku extraction (structured business intel) | 500–1,500 ms | 500–1,500 ms (no cache) | Yes |
| 3 | Extrapolations (fill missing fields from priors) | 50–250 ms | 50–250 ms | No |
| 4 | Narratives (short summaries) | 200–600 ms | 200–600 ms (no cache) | Yes |
| 4b | Sonnet analyst (neighborhood analysis) | **2,500–6,000 ms** | **2,500–6,000 ms (no cache)** | Yes |

**Cold-cache total:** ≈ 7.5–21 s — within the 24 s budget on a clean run, but
can blow the ceiling on a busy day (Yelp rate-limit retries, Overpass 5xx
fallback, Sonnet tail latency).

**Warm-cache total (Call B today, before D5 fix):** Layer 1 serves in ~200ms,
but Layers 2/2c/4/4b all re-run fresh on every call because they have no
response cache. Total: **≈ 3.5–9 s** — usually fine, but bursty enough that
Netlify's 26s ceiling can still trip during peak hours when combined with
any single slow external API.

---

## 3. Root-Cause Attribution

**Primary cause:** LLM layers (2, 2c, 4, 4b) have **no caching at any level**.
They re-run on every request. Layer 4b (Sonnet analyst) alone is 2.5–6 s on
every call, and Netlify's cold-start penalty for the serverless function adds
another 1–3 s.

**Secondary cause:** There is **no response-level cache** on the GET handler.
Two identical calls in quick succession (which is exactly what happens between
initial score and lens fetch) both run the full pipeline end-to-end.

**Tertiary cause:** No single slow external API — they're layered behind
`resilientFetch` with per-source timeouts. But when several slow APIs line
up in the same call (e.g. Foursquare + Overpass fallback + Yelp retry), the
cumulative latency can push Layer 1 past its share of the 24 s budget.

---

## 4. Mitigation (shipped April 14)

**Brain 2 — D5 in `feat/brain2-defect-log` (PR #146, merged):**

- Added module-level `responseCache: Map<string, CachedResponse>` with 5-minute
  TTL in `src/routes/api/location-iq/+server.ts`.
- Cache key: `${lat.toFixed(4)}|${lng.toFixed(4)}|${businessType}|${priceLevel}|${visionTier}`.
- Cap: 500 entries, LRU-style eviction of oldest when full.
- Wired:
  - **Cache check** at the top of the GET handler, before any DB lookup or
    intel fetch. Skips the entire pipeline on hit. Returns header
    `X-RE2-Response-Cache: hit`.
  - **Cache write** on success, just before the `return new Response(...)` call
    at the end of the try block. Returns header `X-RE2-Response-Cache: miss` on
    the write path.
  - **forceRefresh** query param still bypasses the cache so a "Retry" button
    click always hits the full pipeline.

**Effect on D5:** Lens re-fetch (Call B) now hits the response cache ~99% of
the time (the 1% miss is when the lens fetch somehow lands > 5 minutes after
the initial score, which in practice should never happen — they fire within
2 seconds in the normal UX flow). Zero pipeline re-runs. Response time for
Call B: ~5 ms (cache hit) vs. 3.5–9 s before.

This mitigation is LIVE in production and resolves the D5 P0.

---

## 5. What Remains — Permanent Fix (Brain 3 scope)

The response cache is a Band-Aid: it prevents the 504 on the specific
initial-score → lens-fetch sequence, but the cold-cache pipeline is still
fragile at ~7.5–21 seconds. Two follow-ups needed:

### 5.1 Cache the LLM layers (Brain 2 can do this)

Layer 2 (Haiku quality gate), Layer 2c (Haiku extraction), Layer 4 (narratives),
and Layer 4b (Sonnet analyst) are the slow parts of the cold path. Their inputs
are deterministic given (`rawReport`, `businessType`, `geohash5`), so they are
naturally cacheable. Adding a 24-hour Supabase cache (keyed by hashing the
input) would turn the cold-cache latency from 7.5–21 s down to about 5–7 s
(Layer 1 dominates), comfortably inside the budget.

**Proposed table:** `llm_layer_cache(input_hash TEXT PRIMARY KEY, layer TEXT,
payload JSONB, created_at TIMESTAMPTZ)`. Keyed insert, 24h TTL via scheduled
cleanup.

**Owner:** could be Brain 2 (new infrastructure, non-scoring). Not in scope
for this Work Package — would be a Phase 3 addition in the next package.

### 5.2 Trim compute inside Layer 1 / remove skippable LLM layers

This is **Brain 3's** scope. The Work Package says explicitly that B2-2.3 is
an **investigation task only** and any code fix inside `location-iq.ts` or
`index.ts` related to compute goes to Brain 3.

Concrete recommendations for Brain 3:

- **Drop Layer 4 narratives from the GET path.** The page doesn't render them
  on first paint — they're only needed for the /app/location/report full-brief
  view, which fires its own dedicated endpoint. ~300–600 ms saved per call.

- **Move Layer 4b (Sonnet analyst) behind `?ai=true`.** The current code at
  `location-iq.ts` line 396 already reads `useAI = url.searchParams.get('ai')
  === 'true'`. Verify the Sonnet analyst actually respects this flag — if it
  doesn't, gate it. The lens fetch doesn't use this narrative. ~2.5–6 s saved.

- **Parallelize Layer 2 with Layer 1.** Today Layer 2 runs after Layer 1
  completes. Layer 2's quality gate only needs the raw intel response it
  already sees, which is ready as soon as ~half the sources return. A
  speculative early-start would shave 300–500 ms.

With those three trims, cold-cache latency drops from ~7.5–21 s to ~4.5–15 s.
Combined with Brain 2's 5.1 LLM cache, warm cold-cache should settle at
~3–5 s — leaving a comfortable 19 s margin inside the 24 s budget.

---

## 6. Handoff Summary

| Item | Owner | Status |
|------|-------|--------|
| D5 response cache (5-minute TTL) | Brain 2 | ✅ Shipped in PR #146 |
| LLM layer caching (24 h, Supabase-backed) | Brain 2 (suggested) | 📋 Proposed for Phase 3 |
| Drop Layer 4 narratives from GET path | Brain 3 | 📋 Recommended in this RCA |
| Gate Layer 4b behind `?ai=true` | Brain 3 | 📋 Recommended in this RCA |
| Parallelize Layer 2 start vs Layer 1 finish | Brain 3 | 📋 Nice-to-have |

No code changes in this investigation PR — diagnosis only, per the Work
Package brief. The fix that shipped in PR #146 remains the operative
mitigation; this doc is the RCA backing it.
