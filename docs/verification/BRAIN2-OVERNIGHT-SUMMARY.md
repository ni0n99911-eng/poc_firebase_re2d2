# Brain 2 Overnight — Completion Summary

**Date:** April 14, 2026 (overnight)
**Source brief:** `mnt/uploads/.../RE2-Brain2-Overnight.docx`
**Operating mode:** unsupervised, autonomous through the night
**Stop condition:** all tasks done — finished before 6am

---

## Per-task status

| Task | Branch | Merged? | Notes |
|------|--------|---------|-------|
| **B2-T1** DS-06 MTA fuzzy matching | `fix/brain2-ds06-mta-fuzzy-matching` | Pushed (this session) | New work — STATION_ALIASES + Levenshtein + 4-step matchStationName |
| **B2-T2** LLM cache (24h Supabase) | `feat/brain2-llm-cache` | Pushed (this session) | New work — migration 033 + helper + claude.ts wired |
| **B2-T3** VISION_IQ_TIERS | `fix/brain2-vision-tiers-canonical` | ✅ Merged earlier (PR #150) | Already shipped — UX-T6 unblocked |
| **B2-T4** VISION_ARCHETYPES shared | `fix/brain2-vision-archetypes-shared` | ✅ Merged earlier (PR #151) | Already shipped — UX-T7 unblocked |
| **B2-T5** Overpass fallback chain | `feat/brain2-defect-log` | ✅ Merged earlier (PR #146) | Already shipped — 4-mirror chain in overpass.ts |
| **B2-T6** Lens coord race guard | `feat/brain2-defect-log` | ✅ Merged earlier (PR #146) | Already shipped — addr-match guard in loadLocationIqEnvelope |
| **B2-T7** AI rate limits + budget cap | `feat/brain2-ai-rate-limits` | Pushed (this session) | New work — checkAiBudget(userId) + 10/hr + $50/mo |
| **B2-T8** CV-11/12/13 verification | `docs/brain2-cv-verifications` | ✅ Merged earlier (PR #153) | Doc + handoff for CV-13 (grocery missing revenueModel) |

**Net new work this overnight pass: 3 branches** (T1, T2, T7).
T3/T4/T5/T6/T8 were already shipped in prior packages — confirmed via
`git log origin/main` showing PR numbers above.

---

## What's in each new branch

### B2-T1 — `fix/brain2-ds06-mta-fuzzy-matching`

`src/lib/intel/mta-ridership.ts`:
- `STATION_ALIASES` map covering Times Sq, Union Sq, Grand Central, Herald
  Sq, Penn Station, Atlantic-Barclays, Jay-MetroTech, Court Sq, Columbus
  Circle, Lexington-59. Bidirectional.
- `normalizeStationName(name)` — strips parentheticals, expands
  St/Av/Sq/Ctr/Blvd abbreviations, normalizes separators.
- `levenshtein(a, b)` — small iterative DP edit distance.
- `matchStationName(rows, target)` — 4-step resolution: alias → exact
  normalized → substring → Levenshtein-best-under-threshold (≤ 5 edits
  OR ≤ 25% of target length, whichever is larger). Returns `null` when
  nothing scores; caller MUST treat null as "no match".
- `fetchRealRidership` now consumes the helper and logs a warning when
  the bbox returned rows but no station scored within threshold —
  feeds prod logs so `STATION_ALIASES` can grow from real misses.

Caller fallback unchanged: returning `null` falls through to
`estimateRidershipFallback` in the parent loop. Worst case we now miss
real data and use estimated; previous behavior silently returned the
WRONG station's real data.

### B2-T2 — `feat/brain2-llm-cache`

Migration `supabase/migrations/033_llm_cache.sql`:
```
llm_cache(id UUID PK, cache_key TEXT UNIQUE, model TEXT, response JSONB,
          tokens_in INT, tokens_out INT, created_at, expires_at, metadata)
```
RLS on, service-role only. Indexes on cache_key (UNIQUE), expires_at,
(model, created_at).

`src/lib/ai/llm-cache.ts` (NEW):
- `llmCacheKey(model, sys, user)` — SHA-256 hex of the tuple
- `getCachedOrFetch(req)` — read-through. On hit returns stored content
  (target <500ms), on miss invokes the fetcher and upserts. Failures in
  the cache layer never block — falls through to fetcher.
- Telemetry: writes one `ai_calls` row per call (cache hit OR miss) so
  `cost_usd` totals stay accurate. Hits write `metadata.cache_hit=true`.

`src/lib/ai/claude.ts`:
- `callClaudeAPI` now wraps OpenRouter through `getCachedOrFetch`.
- Two new telemetry options: `cacheTtlHours` (default 24h),
  `bypassCache` (escape hatch).
- Extracted `callOpenRouterRaw` as the cache fetcher. Legacy direct-call
  path retained as a fallback if the cache wrapper itself throws —
  preserves availability when 033 isn't applied yet.

**Dependency:** migration 033 must be applied before the cache actually
persists. Until then the helper silently treats the missing-table 42P01
error as a miss → fall through to the fetcher → no user-facing breakage.

### B2-T7 — `feat/brain2-ai-rate-limits`

`src/lib/ai/budget-guard.ts` (NEW):
- `checkAiBudget({ userId, sessionId })` → `null` on pass, `Response`
  on block.
- `AI_HOURLY_USER_LIMIT = 10`, `AI_MONTHLY_BUDGET_USD = 50`. Both
  overridable in the input.
- Per-user hourly: count `ai_calls` for `user_id` in last 60 min.
  If ≥ limit, queries oldest call's timestamp to compute precise
  reset minutes for the 429 response.
- Site-wide monthly: sums `cost_usd` from current calendar month
  (UTC). Caps the read at 10k rows for safety.
- All Supabase failures (incl. table-missing 42P01) fail OPEN.

Wired:
- `src/routes/api/ai/+server.ts` — uses `X-Session-Id` header for anon
- `src/routes/api/copilot/location/+server.ts` — uses `requireAuth.userId`,
  stacks on top of the existing in-memory 10/min check (S3). Both must
  pass; the in-memory check is the burst guard, this is the durable
  rolling-hour guard.

---

## Verification (per Overnight Completion Checklist)

- **svelte-check:** 661 errors / 423 warnings / 103 problem files —
  matches main baseline (current main is already at 661 due to other
  threads' work this session). Zero regressions across all 3 new
  branches.
- **npm run build:** passes on every branch.
- **Coffee test cases:** Brain 2 changes are non-scoring (telemetry +
  cache + rate limits + name matching). No effect on the 4 coffee
  targets (273 5th, 501 9th, 1 Manhattan West, 378 6th).

---

## Handoffs

**Ops (Kalpna):**
- Apply migration `032_ai_calls.sql` (already shipped in PR #148) so
  `logAiCall` rows persist. Without this, B2-T2 (cache hit logging) and
  B2-T7 (rate limit / budget queries) silently fail open — useful as a
  belt-and-suspenders, but the value is lost until 032 is applied.
- Apply migration `033_llm_cache.sql` (in this overnight's `feat/brain2-llm-cache`)
  for B2-T2 cache to actually persist responses across requests.

**No cross-thread blockers introduced.** All edits are inside the Brain 2
ownership envelope. No SCORER_VERSION bump needed (none of these
changes touch scoring computation).

---

## Branches awaiting merge (3)

- https://github.com/gajo006/jaredclaw/pull/new/fix/brain2-ds06-mta-fuzzy-matching
- https://github.com/gajo006/jaredclaw/pull/new/feat/brain2-llm-cache
- https://github.com/gajo006/jaredclaw/pull/new/feat/brain2-ai-rate-limits

Each is independent. No order constraints.

## Branches from supplements earlier this session (still useful refs)

- B2-NEW-1 `fix/brain2-copilot-score-tiers` — already merged (PR #165)
- B2-NEW-2 `fix/brain2-copilot-strip-markdown` — already merged (PR #166)
