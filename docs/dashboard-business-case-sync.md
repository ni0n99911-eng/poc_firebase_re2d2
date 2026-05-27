# RE² · BR-2 · Dashboard ↔ Business Case Data Sync Audit
**Brain Thread · April 5, 2026**
**Status: PROPOSAL — awaiting Kalpna approval before any code changes**

---

## 0 · Problem Statement

Dashboard shows a different profit figure than the Business Case page for the same location. Example: Dashboard shows −$107K, Business Case shows +$169K. Both are reading from localStorage. Neither is wrong — they're reading from different data paths at different stages of completeness.

---

## 1 · Root Cause

There are two separate `businessCase` write paths. They write different data to the same localStorage key at different points in the user journey.

### Path A — Location Page (seed)

**File:** `src/routes/app/location/+page.svelte` · Line ~1025

```javascript
...(idx2 < 0 && _seedRev > 0 ? {
  businessCase: { revenueY1: _seedRev, costsY1: 0, profitY1: 0, breakEvenMonths: 0 }
} : {}),
```

- Fires when the location is first added to the launchpad (before BC page is visited)
- `revenueY1` is seeded from financial goals (`targetRevY1`) — a user-entered target, not a modeled projection
- `costsY1 = 0`, `profitY1 = 0`, `breakEvenMonths = 0` — explicitly zeroed
- Guard `idx2 < 0` means this only fires on first write; it does **not** overwrite if a record already exists

### Path B — Financials Page (full model)

**File:** `src/routes/app/financials/+page.svelte` · Lines 1007–1037

```javascript
function saveBusinessCase() {
  const y1 = projections[1];
  const revenueY1 = Math.round(y1.revenue.base);
  const costsY1 = Math.round(cogs + labor + rent + opex + loanPayments);
  const profitY1 = revenueY1 - costsY1;
  // ... break-even walk ...
  locs[idx].businessCase = { revenueY1, costsY1, profitY1, breakEvenMonths };
  localStorage.setItem('re2_launchpad', JSON.stringify(lp));
}
```

- Fires on every `projections` change (via `$effect`) and on `beforeNavigate`
- Uses the full 5-year model: COGS %, labor, rent, opex, loan payments all computed
- Correctly populates all four fields
- **Only fires if the user visits the financials page for this location**

### Dashboard Merge (the collision point)

**File:** `src/routes/app/dashboard/+page.svelte` · Line ~661

```javascript
businessCase: loc.businessCase ?? r.businessCase,
```

- `loc` = local localStorage record
- `r` = Supabase record
- Local takes priority unconditionally
- `businessCase` is never written to Supabase (Supabase has no `business_case` column in `shortlisted_locations`)
- So `r.businessCase` is always `undefined` — this merge line is dead code

**Result:** Dashboard always shows whatever is in local localStorage. If the user has only visited the Location page (not the Financials page), that's the seeded record: `{ revenueY1: X, costsY1: 0, profitY1: 0, breakEvenMonths: 0 }`. Dashboard displays profit as **$0 or wrong**.

---

## 2 · Display Impact

| Dashboard field | What it shows (pre-BC visit) | What it should show |
|---|---|---|
| Year 1 Revenue | Seeded `targetRevY1` (user goal) | Modeled projection |
| Year 1 Costs | $0 | Full model costs |
| Year 1 Profit | $0 (or negative if computed from 0 costs) | Full model profit |
| Break-even | 0 months | Cumulative cash break-even |

Dashboard card renders `loc.businessCase.profitY1` directly — if this is the seed record, profit shows wrong until the user visits the financials page for that location.

---

## 3 · Proposed Fix

**Two-part change. No structural rewrite.**

### Part 1 — Tag partial seeds (location page)

Add `isPartialSeed: true` to the seed write so Dashboard can distinguish it from a real model result.

```javascript
// location/+page.svelte ~line 1025
businessCase: {
  revenueY1: _seedRev,
  costsY1: 0,
  profitY1: 0,
  breakEvenMonths: 0,
  isPartialSeed: true   // ← ADD THIS
}
```

### Part 2 — Dashboard: suppress partial seeds, show nudge

In the Dashboard card, check `isPartialSeed` before rendering profit/break-even. If true, show a nudge instead of wrong numbers.

```svelte
{#if loc.businessCase && !loc.businessCase.isPartialSeed}
  <!-- show profit, costs, break-even -->
{:else}
  <p class="nudge">Run your Business Case to see projected profit.</p>
{/if}
```

This is intentionally minimal — no new data sources, no Supabase schema changes, no computation on the Dashboard. The Financials page already writes the real data; we just need Dashboard to know when it hasn't arrived yet.

---

## 4 · Files Affected

| File | Change |
|---|---|
| `src/routes/app/location/+page.svelte` | Add `isPartialSeed: true` to seed write (~line 1025) |
| `src/routes/app/dashboard/+page.svelte` | Guard profit/BC display on `!isPartialSeed` |

No schema changes. No new API routes. No Supabase writes.

---

## 5 · What This Does NOT Fix

- `businessCase` is never persisted to Supabase → cross-device sync will never show BC data. This is a separate (lower priority) issue and requires a Supabase schema addition.
- Dashboard shows `targetRevY1` as revenue even in the seeded state — after this fix, that field will just not render until the full model runs.

---

## 6 · Estimated Effort

2 targeted edits, ~15 lines total. Type-safe (add `isPartialSeed?: boolean` to the businessCase type if one exists). No migration needed.

---

## Decision Required

**Approve this proposal to proceed with implementation on branch `brain/br-2-data-sync`.**
