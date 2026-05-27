# Brain 2 Work Package — Verification Pass

**Date:** April 14, 2026
**Source brief:** `mnt/uploads/.../RE2-Brain2-Work-Package.docx` (Orch 1 v3-AUDITED + Live Site Defect Log)

---

## Scope

Brain 2 owns consolidation (unify scattered scoring constants),
infrastructure fixes (JWT refresh, AI rate limits), and external resilience
(Overpass fallback, lens coordinate race). **Brain 2 did NOT touch scoring
computation logic** — file ownership per the Work Package was respected
throughout; every commit targets only Brain 2-owned files.

---

## Branches shipped (7)

All branches cut from latest `main`. Each passes `svelte-check` at
645 errors / 423 warnings / 102 problem files — **no regressions** from the
post-defect-log baseline (target was 645 from PR #146).

| # | Branch | Task | Kind |
|---|--------|------|------|
| 1 | `fix/brain2-jwt-refresh` | B2-0.1 — JWT refresh hardening + per-token client cache | fix |
| 2 | `feat/brain2-ai-telemetry` | B2-0.2 — `ai_calls` table + `logAiCall` helper | feat |
| 3 | `fix/brain2-kill-threshold-unify` | B2-1.1 + B2-1.2 — unified kill thresholds + confidence bands | fix |
| 4 | `fix/brain2-vision-tiers-canonical` | B2-1.3 — `VISION_ARCHETYPES` → canonical `VISION_IQ_TIERS` in `tiers.ts` | fix |
| 5 | `fix/brain2-vision-archetypes-shared` | B2-1.4 — extract `VISION_ARCHETYPES` to `$lib/constants/visionArchetypes` | fix |
| 6 | `feat/brain2-occupancy-extras-config` | B2-3.4 — `occupancyExtras.ts` (BID + Insurance + CAM) | feat |
| 7 | `docs/brain2-cv-verifications` | B2-3.1 / B2-3.2 / B2-3.3 — heads-up / checklist / revenue-model counts | docs |
| 8 | `docs/brain2-location-iq-timeout-diag` | B2-2.3 — /api/location-iq 504 RCA | docs |

Each ready for independent review. No scoring-computation changes → no
`SCORER_VERSION` bumps needed (per Work Package Rule 4).

---

## Phase 0 — Infrastructure (DONE)

**B2-0.1 JWT refresh** — `fix/brain2-jwt-refresh`
- `getAuthedSupabase(token)` caches clients by token prefix (max 8 entries).
  Eliminates the "Multiple GoTrueClient instances" warning.
- New `getFreshAuthedSupabase()` helper centralizes `Clerk.session.getToken({
  skipCache: true })` + fallback logic.
- `launchpad-store.syncToSupabase()` refactored to consume the new helper —
  same behavior, smaller surface area.

**B2-0.2 AI telemetry skeleton** — `feat/brain2-ai-telemetry`
- Supabase migration `032_ai_calls.sql` — `ai_calls` table with user_id,
  route, model, token counts, cost_usd, duration_ms, status, metadata.
  Service-role only via RLS.
- `src/lib/ai/telemetry.ts` — `logAiCall(input)` fire-and-forget helper,
  `estimateCostUsd(model, in, out)` with April-2026 OpenRouter pricing.
- `callClaudeAPI` instrumented: success path emits `prompt_tokens` +
  `completion_tokens` from OpenRouter's `data.usage`; error path logs
  HTTP status.
- **Acceptance:** 3 CoPilot calls → 3 rows in `ai_calls` with non-null `cost_usd`.

---

## Phase 1 — Consolidation (DONE)

All four sub-tasks wired where Brain 2 owns the file. Handoff notes are in
each commit message for files owned by Brain 3 or UX.

**B2-1.1 Kill factor thresholds** — `fix/brain2-kill-threshold-unify`
- New exports in `src/lib/constants/scoring-thresholds.ts`:
  - `KILL_FACTOR_THRESHOLDS` = { safety 30, competition 25, transit 25,
    survival 40, pulse/vibrancy 35, demographics 35 }
  - `SIGNAL_KILL_FLOOR` = 40, `SIGNAL_CAUTION_FLOOR` = 55
- Wired: `heads-up-engine.ts`, `coffee-watch-outs.ts`, `scoring-utils.svelte.ts`.
- **Handoff:** Brain 3 to wire `six-index.ts` line 354 (`survivalRate < 40`)
  and `/api/business-case-summary`. UX to wire `location/+page.svelte` lines
  589–599 and `dashboard/+page.svelte`.

**B2-1.2 Confidence bands** — same branch as B2-1.1
- `CONFIDENCE_BANDS = { preliminary: 0.50, partial: 0.85 }` added to
  `scoring-thresholds.ts`.
- **Handoff:** `/api/location-iq` and `/api/score/preview` — both are Brain 3
  during this package.

**B2-1.3 Vision IQ tiers** — `fix/brain2-vision-tiers-canonical`
- New `VISION_IQ_TIERS` export in `tiers.ts` = { differentiated 80,
  established 65, emerging 50 }, plus `visionIQTier(score)` helper.
- **Handoff:** UX (location + dashboard), Brain 3 (`/api/location-iq`).

**B2-1.4 VISION_ARCHETYPES shared** — `fix/brain2-vision-archetypes-shared`
- New `src/lib/constants/visionArchetypes.ts` — built at module load from
  the existing `CONCEPT_KPIS` registry so client and server see identical
  values.
- Also exports `DEFAULT_ARCHETYPE` and `getVisionArchetype(conceptKey)`
  helper for drop-in replacement.
- **Handoff:** UX (U-1.8 deletes the inline copy in `location/+page.svelte`
  lines 2314–2331 and imports from here).

---

## Phase 2 — External Resilience

**B2-2.1 Overpass fallback chain** — ✅ **Already shipped** in PR #146
- 4-mirror chain: overpass-api.de → kumi.systems → private.coffee → osm.jp.
- Returns `null` explicitly when all mirrors exhausted (per Work Package:
  "DO NOT return empty arrays as success").

**B2-2.2 Lens-fetch coord race guard** — ✅ **Already shipped** in PR #146
- `loadLocationIqEnvelope()` verifies `re2_selected_location.addr` matches
  current `analysisAddress` before dispatching. Prevents Midtown-default
  coords (40.7580 / -73.9855) from being sent for a different borough.
- Note: implementation currently lives in `location/+page.svelte` (UX-owned
  under the current Work Package). Since it's already merged, leaving it
  in place. If future Work Packages want to relocate it to a service layer,
  that's a lift-and-shift.

**B2-2.3 /api/location-iq 504 RCA** — `docs/brain2-location-iq-timeout-diag`
- Per-segment timing table documented.
- Primary cause: LLM layers (Haiku quality gate, Haiku extraction, narratives,
  Sonnet analyst) have no caching at any level. Layer 4b (Sonnet) alone is
  2.5–6 s per call.
- Secondary cause: no response-level cache on the GET envelope.
- **Mitigation (shipped in PR #146):** module-level 5-minute response cache,
  keyed by coords + concept + priceLevel + visionTier. Call B now serves in
  ~5 ms on cache hit.
- **Open follow-ups for Brain 3:** drop Layer 4 narratives from GET,
  gate Layer 4b behind `?ai=true`, parallelize Layer 2 with Layer 1.

---

## Phase 3 — Missing CVs (DONE)

**B2-3.1 / 3.2 / 3.3 counts** — `docs/brain2-cv-verifications`
- **CV-11** (heads-up rules): ✅ 57 (8 universal + 49 concept-specific).
  V5 correct; Orch 2's ~56 was an undercount.
- **CV-12** (checklist items): ⚠️ 80 (not 51). Orch 2 closer; V5 was stale.
- **CV-13** (revenue models): ⚠️ 15 / 16. `grocery` missing explicit
  `revenueModel` (should be `'volume'`). Handoff to Brain 3.

**B2-3.4 Occupancy extras config** — `feat/brain2-occupancy-extras-config`
- New `src/lib/constants/occupancyExtras.ts`:
  - `BID_ASSESSMENTS` — representative subset of NYC's 76+ BIDs with
    per-area rate as % of base rent (0.3–0.8%), plus substring match keys.
    40+ entries across 5 boroughs.
  - `INSURANCE_BENCHMARKS` — per-concept premiums for all 15 live concepts
    (2025 NYC quotes).
  - `CAM_ESTIMATES_PER_SF_MONTHLY` — keyed by PLUTO BldgClass letter group.
- Resolvers: `resolveBidAssessment(addr)`, `resolveInsuranceBenchmark(concept)`,
  `resolveCamEstimate(bldgClass)`.
- **Handoff:** Brain 3 task B3-2.3 — wire into `business-case-store.svelte.ts`
  to populate `occupancyCostBreakdown`. No runtime consumers in this PR per
  the Work Package brief.

---

## Verification

- **svelte-check:** 645 errors / 423 warnings / 102 files-with-problems.
  Matches the post-PR #146 baseline — no new errors, no regressions on any
  of the 7 branches.
- **npm run build:** passes on each branch.
- **Coffee test cases:** all 4 targets still score within ±3 of the April 12
  validated values (49 / 79 / 86 / 78). No Brain 2 change touched coffee
  scoring logic.

---

## Collision Discipline

Every branch was cut from latest `main`. No branch-off-another-branch. No
merge conflicts encountered. Every `.ts` file edited was on Brain 2's
ownership list; every hand-off to Brain 3 or UX is documented in the
corresponding commit body.

**Files explicitly NOT touched** (from the Brain 2 exclusion list):
- `src/lib/intel/location-iq.ts` (Brain 3)
- `src/lib/stores/business-case-store.svelte.ts` (Brain 3)
- `src/lib/intel/conceptNormalizer.ts` (Brain 3)
- `src/lib/intel/six-index.ts` (Brain 3)
- `src/routes/api/business-case-summary/+server.ts` (Brain 3)
- `src/lib/intel/competition*.ts` (Brain 3)
- Every `+page.svelte` under `src/routes/app/` (UX)
- Every component under `src/lib/components/` (UX)

---

## Outstanding Handoffs

| Consumer | Owner | File | Change |
|----------|-------|------|--------|
| B2-1.1 | Brain 3 | `six-index.ts:354` | `survivalRate < 40` → `survivalRate < KILL_FACTOR_THRESHOLDS.survival` |
| B2-1.1 | Brain 3 | `/api/business-case-summary` | Kill-factor gates → import `KILL_FACTOR_THRESHOLDS` |
| B2-1.1 | UX | `location/+page.svelte:589–599` | safety/competition/transit cutoffs → import |
| B2-1.1 | UX | `dashboard/+page.svelte` | Kill-factor count display → import |
| B2-1.2 | Brain 3 | `/api/location-iq` + `/api/score/preview` | `< 0.50 / < 0.85` → `CONFIDENCE_BANDS` |
| B2-1.3 | UX + Brain 3 | location/dashboard/api | 80/70/60 and 80/65/50 → `VISION_IQ_TIERS` |
| B2-1.4 | UX | `location/+page.svelte:2314–2331` | delete inline, import `getVisionArchetype` |
| B2-2.3 | Brain 3 | `/api/location-iq` Layer 4/4b gating | drop narratives from GET, gate Sonnet behind `?ai=true` |
| B2-3.3 | Brain 3 | `conceptKPIs.ts grocery` block | add `revenueModel: 'volume'` |
| B2-3.4 | Brain 3 | `business-case-store.svelte.ts` | wire `resolveBidAssessment` / `resolveInsuranceBenchmark` / `resolveCamEstimate` into `occupancyCostBreakdown` |

All handoffs non-blocking — each Brain 2 branch is mergeable standalone.
