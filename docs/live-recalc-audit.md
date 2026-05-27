# Live-Recalc Audit — Location IQ Page
**Backend thread · April 5, 2026**
**File audited:** `src/routes/app/location/+page.svelte`
**Purpose:** Identify code paths that trigger scoring runs on load, per BR-5 § 5.1 (Option A — snapshot canonical, no recalc on load)

---

## Path 1 — RETIRE: 24-hour cache TTL auto-expiry (line 681)

**Location:** `src/routes/app/location/+page.svelte` line 681

```typescript
const CACHE_TTL = 24 * 60 * 60 * 1000;  // line 681
// ...
const cacheHit = addrMatch
  && sess.locationIQ > 0 && _hasValidSixScores
  && (Date.now() - (sess.scoredAt || 0)) < CACHE_TTL;  // line 694-696
```

**What it does:** After 24 hours, `cacheHit` = false → falls through → triggers full scorer re-run.

**Problem:** Option A says the snapshot is canonical until the user explicitly Re-scores. Time-based expiry violates this.

**Fix:** Remove the TTL condition entirely. Cache hit should be: address matches + score > 0 + valid sixScores. TTL check removed.

```typescript
// BEFORE:
const cacheHit = addrMatch
  && sess.locationIQ > 0 && _hasValidSixScores
  && (Date.now() - (sess.scoredAt || 0)) < CACHE_TTL;

// AFTER (BR-5 Option A):
const cacheHit = addrMatch
  && sess.locationIQ > 0 && _hasValidSixScores;
  // BR-5 § 5.1: snapshot is canonical until user Re-scores. TTL removed.
```

Also: remove the `CACHE_TTL` const declaration at line 681 — it's no longer used.

---

## Path 2 — KEEP: Vision IQ recalc on concept answer (line 2021)

**Location:** `src/routes/app/location/+page.svelte` line 2021

```typescript
async function onConceptAnswer(questionId: string, value: string) {
  // ...
  const res = await apiFetch('/api/location-iq', { ... });  // line 2021
```

**What it does:** Fires the scorer every time the user answers a Vision IQ question (user interaction).

**Decision: KEEP.** BR-5 § 5.1 says "no surface re-runs the scorer **on load**." This is user-initiated refinement, not a load-time recalc. This is how Vision IQ completion improves Fit IQ in real time. Do not retire.

Add a comment for clarity:
```typescript
// BR-5: user-initiated Vision IQ refinement — not a load-time recalc. Keep per § 5.1.
const res = await apiFetch('/api/location-iq', { ... });
```

---

## Path 3 — KEEP: onMount localStorage restore (line 2645)

**Location:** `src/routes/app/location/+page.svelte` line 2645

```typescript
if (typeof session.locationIQ === 'number' && session.locationIQ > 0 && session.sixScores && session.analyzedAddress) {
  storedLocationIQ = session.locationIQ;
  sixScores = session.sixScores;
```

**What it does:** Reads scores from localStorage on mount — no recalculation, just reading the cached value.

**Decision: KEEP as read-only restore.** Not a recalc. However, **future enhancement (post-migration 017):** this path should prefer the Supabase `shortlisted_locations` record over localStorage, since Supabase is the canonical store per Option A. localStorage remains a fallback for offline/JWT-expired state.

---

## Summary

| Path | Line | Action | Reason |
|---|---|---|---|
| 24hr TTL cache expiry | 681, 694–696 | **RETIRE** (remove TTL check) | Violates Option A snapshot model |
| Vision IQ recalc on answer | 2021 | **KEEP** | User-initiated, not load-time |
| onMount localStorage restore | 2645 | **KEEP** (read-only) | Not a recalc; future: prefer Supabase |

**One line change total to retire live-recalc:** remove `&& (Date.now() - (sess.scoredAt || 0)) < CACHE_TTL` from line 695–696 and delete the `CACHE_TTL` const at line 681.

---

*Audit complete. Brain to write Re-score API spec and PostGIS check queries next.*
