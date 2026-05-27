# RE² · BR-5 · Location IQ Threshold Spec
**Brain Thread · April 5, 2026**
**Status: SPEC — for UX-3 (Location IQ) implementation**

This document defines the exact thresholds, reference populations, and rent math used on the Location IQ page. All values are confirmed from production code or approved by Kalpna. UX-3 implements against this spec.

---

## 1 · Block Labels

Three labels derived from Location IQ score. These appear on the Location IQ page as a badge adjacent to the score ring.

| LIQ Score | Block Label | Color token |
|---|---|---|
| ≥ 80 | Prime Block | `--color-green` |
| 65–79 | Solid Block | `--color-blue` (or neutral — not red/amber) |
| 50–64 | Mixed Block | `--color-amber` |
| < 50 | No block label | Show score + grade only |

**Confirmed by Kalpna: Prime = 80+.** This aligns with the `scoreGrade()` function boundary where 80–84 = B+, 85–89 = A-, 90+ = A (all green).

**89 Graham Ave at LIQ 81 = Prime Block.** This is the correct label. The previous wireframe error (showing "Solid Block") has been corrected.

**These labels are location-level quality indicators, not financial verdicts.** They describe the block's signal quality, not whether the user should open here. The financial Path Label (Strong Path / Workable / Tight / Stretch / Rethink) is separate and computed from break-even months, not from LIQ score.

---

## 2 · Score Grade Mapping

Used for the letter-grade badge next to the score number. Source: `scoreGrade()` in production.

| Score | Grade | Badge color |
|---|---|---|
| 90–100 | A | Green |
| 85–89 | A- | Green |
| 80–84 | B+ | Green |
| 75–79 | B | Green |
| 70–74 | B- | Green |
| 65–69 | C+ | Amber |
| 60–64 | C | Amber |
| 55–59 | C- | Amber |
| < 55 | D | Red |

---

## 3 · Percentile Captions

### 3.1 · Two reference populations

When the API returns real percentile data, two captions appear:

| Caption | Reference population | API field |
|---|---|---|
| "Top N% of [borough] block groups" | All scored block groups in the borough the address is in | `boroughPct` |
| "Top N% of all NYC block groups" | All ~6,300 NYC scored block groups | `nycPct` |

**Example for 89 Graham Ave (Brooklyn):** "Top 8% of Brooklyn block groups · Top 12% of NYC block groups"

### 3.2 · Hide rule — STRICT

**Do not show percentile captions unless both `boroughPct` and `nycPct` are present and non-null in the API response.** If either is absent:
- Remove the caption line entirely
- No placeholder, no dash, no spinner, no estimated value
- Score + grade badge stands alone

This is already in the UX-3 wireframe (FIX-3.2). Do not regress.

### 3.3 · API response shape (when available)

```json
{
  "boroughPct": 8,
  "borough": "Brooklyn",
  "nycPct": 12
}
```

`boroughPct` and `nycPct` are integers representing "Top N%" (lower = better). A `boroughPct` of 8 means this block group scores in the top 8% of all scored Brooklyn block groups.

### 3.4 · Supabase query to generate real values

Run against the `block_group_scores` table. Brain pending: Kalpna to run and report back.

```sql
-- Step 1: Find the geoid for the address being analyzed
SELECT geoid, location_iq, borough
FROM block_group_scores
WHERE geoid ILIKE '%36047%'  -- Brooklyn FIPS prefix (Kings County)
ORDER BY location_iq DESC
LIMIT 10;

-- Step 2: Compute real borough + NYC percentile
WITH ranked AS (
  SELECT
    geoid,
    location_iq,
    PERCENT_RANK() OVER (
      PARTITION BY borough
      ORDER BY location_iq DESC
    ) * 100 AS borough_pct,
    PERCENT_RANK() OVER (
      ORDER BY location_iq DESC
    ) * 100 AS nyc_pct
  FROM block_group_scores
  WHERE location_iq IS NOT NULL
)
SELECT
  ROUND(borough_pct::numeric, 1) AS brooklyn_top_pct,
  ROUND(nyc_pct::numeric, 1)     AS nyc_top_pct
FROM ranked
WHERE geoid = '[GEOID FROM STEP 1]';
```

**What to do with the output:** Replace the illustrative "Top 8% of Brooklyn block groups" in the UX-3 wireframe with the real numbers. These real numbers also define the API contract — when the scorer writes `block_group_scores`, it should compute and return `boroughPct` and `nycPct` as part of the scoring response.

### 3.5 · Current implementation status

The `block_group_scores` table exists in Supabase with location_iq data. The API does not currently return `boroughPct` / `nycPct` in its scoring response. Until the API is updated to include these fields, the caption line is hidden per the hide rule above. This is a future enhancement, not a Gate 2 blocker.

---

## 4 · Rent Math Formula

### 4.1 · The formula

```
rentPct = (monthlyRentBudget × 12) / steadyStateRevenue × 100
```

**Driving inputs:**
- `monthlyRentBudget` = from `lpData.financialGoals.monthlyRentBudget` (user's onboarding entry, or concept default — see table below)
- `steadyStateRevenue` = from `computeSteadyStateRevenue()` based on concept, daily transactions, avg ticket, and revenue model

**What it produces:** A percentage representing annual rent as a share of projected annual revenue.

### 4.2 · Concept rent defaults (when user hasn't entered a budget)

From production `CONCEPT_RENT_DEFAULTS` in `src/routes/app/financials/+page.svelte`:

| Concept | Monthly rent default |
|---|---|
| specialty_coffee | ~$6,000–8,000/mo |
| fast_casual | ~$8,000–10,000/mo |
| full_service_restaurant | ~$8,000–12,000/mo |
| co_working | ~$10,000–15,000/mo |
| fitness_studio | ~$6,000–8,000/mo |

*(Exact values in `CONCEPT_RENT_DEFAULTS` in the financials page — UX does not need these; they're used only by the Fit IQ engine.)*

### 4.3 · Kill factor thresholds by concept

Source: `CONCEPT_KPIS[concept].maxRentPercent` in `src/lib/constants/conceptKPIs.ts`.

| Concept | Max rent % of revenue | Severe threshold (1.5×) |
|---|---|---|
| specialty_coffee, fast_casual, full_service_restaurant, nail_salon | 10% | 15% |
| cocktail_bar, wine_bar | 8% | 12% |
| fitness_studio, yoga_studio | 10% | 15% |
| co_working | 15% | 22.5% |
| bakery, juice_bar, specialty_food | 12% | 18% |
| specialty_retail | 10% | 15% |

**Penalty tiers (from Location IQ scoring engine):**
```javascript
if (rentPct > maxPct * 1.5) rentPenalty = -12;   // Severe — 1.5× over benchmark
if (rentPct > maxPct)       rentPenalty = -6;    // Over benchmark
if (rentPct <= maxPct * 0.7) rentPenalty = +3;   // Well within — small bonus
```

### 4.4 · How this appears in UX-3

On the Location IQ page, the rent assessment block shows:
- "Rent: [X]% of revenue (target: < [maxRent]%)"
- Green if within threshold, amber warning if over

The "17% of projected revenue" referenced in the brief is an illustrative example of a `rentPct` value, not a hardcoded threshold. The real threshold is concept-specific per the table above.

---

## 5 · Score Reconciliation — Option A: Snapshot Model (Decision: April 5, 2026)

**Decision:** Saved wins. The Supabase record is canonical. No surface re-runs the scorer on load.

**Rationale:** Scores are snapshots tied to a specific set of inputs + data sources at a specific moment. Automatic recalculation introduces unpredictable drift between visits and adds latency + API cost without user benefit. Users who want a current score tap Re-score.

### 5.1 · Canonical Read Rule

- **One source of truth per scored location:** the Supabase `shortlisted_locations` record (or localStorage fallback per BUG-02 JWT pattern).
- **No surface re-runs the scorer on load.** Dashboard card, Location IQ page, comparison views, Business Case — all read from the saved record.
- **Retire live-recalc code paths** on Location IQ page load. On each retired path, add a code comment pointing back to this spec section.

### 5.2 · Required Score Record Fields

Every scored record must carry:

| Field | Type | Purpose |
|---|---|---|
| `scored_at` | ISO timestamp | When this snapshot was taken |
| `scorer_version` | string (e.g. `"v4.3"`) | Ties to V4 batch scorer version at time of run |
| `inputs_hash` | string (sha256 of user inputs + concept at scoring time) | Detects input drift between snapshots |

These three fields ship on every score surface (Dashboard card, Location IQ page). `scorer_version` is internal-only (not surfaced to users).

### 5.3 · Re-score Action

- Manual "Re-score ↻" button on the Location IQ page AND on each Dashboard card
- On tap:
  1. Run the full scorer against current inputs + current data sources
  2. Write a new `shortlisted_locations` row (or update in place, one canonical record per address)
  3. Update `scored_at`, `scorer_version`, `inputs_hash`
  4. Re-render all surfaces with the new record

### 5.4 · Drift Detection

If the new score drifts **> 3 points** from the previous saved score:

1. **Log `score_drift_event`:**
   ```typescript
   interface ScoreDriftEvent {
     address: string;
     oldScore: number;
     newScore: number;
     delta: number;
     subScoresMoved: Array<{ name: string; oldValue: number; newValue: number }>;
     oldScorerVersion: string;
     newScorerVersion: string;
     oldInputsHash: string;
     newInputsHash: string;
     loggedAt: string;
   }
   ```
   Write to Supabase `score_drift_events` table. Not user-facing — for future model learning.

2. **User-facing drift explanation** (inline note below score ring):
   ```
   Score shifted +[N] since last run. What changed: [top 2 sub-scores that moved, in plain language].
   ```
   Example: "Score shifted +4 since last run. What changed: foot traffic (new weekend data) and competition density (2 new coffee shops opened within 300ft)."

   Turns drift into a signal, not confusion.

If drift ≤ 3 points: silent update, no inline note, no drift event logged.

### 5.5 · Formal Disclaimer Copy (locked)

Tooltip / info-click copy, appears beside each score ring:

> "This score is a snapshot from your last scoring run. It does not update automatically. Refining your concept details, completing Vision IQ, or periodic updates to neighborhood data can produce variations on re-scoring. Such variations are typically non-material and rarely change the verdict band. Use Re-score to refresh."

Brain owns the copy. UX owns tooltip visual treatment.

### 5.6 · Meta-line (always visible, no click required)

Under each score ring:

```
Scored [relative date] · [Re-score ↻]
```

**Examples:**
- "Scored just now · Re-score ↻"
- "Scored 2 days ago · Re-score ↻"
- "Scored 3 weeks ago · Re-score ↻"

**Relative date formatting:** same convention as rest of product ("just now" / "N minutes ago" / "N hours ago" / "N days ago" / "N weeks ago" / "N months ago").

### 5.7 · Out of Scope (deferred)

- **Automatic background re-scoring on a schedule** — not doing this. Snapshot model is intentional.
- **"Score is N days old, consider re-scoring" nudges** — defer to post-launch. Users who want current tap Re-score.
- **Surfacing `scorer_version` to users** — internal field only for now.

### 5.8 · Migration Note

Existing `shortlisted_locations` rows that don't have `scorer_version` or `inputs_hash` should be backfilled on next user visit: on first load of a row missing these fields, populate `scorer_version = 'v4.legacy'` and `inputs_hash = 'legacy'`. Do not trigger re-score on legacy rows — only backfill metadata.

---

## 6 · LIQ Path Label (Location IQ page only)

The Location IQ page uses a **score-only verdict** — no financial data flows in. The path label is derived purely from LIQ score.

| LIQ Score | Path Label | Color |
|---|---|---|
| ≥ 80 | Strong Path | Green |
| 65–79 | Workable | Blue |
| 50–64 | Tight | Amber |
| 40–49 | Stretch | Orange |
| < 40 | Rethink | Red |

**Important:** Even if a Business Case exists in localStorage, the Location IQ page ignores it for the verdict. Financial path labels (break-even months) are computed only on the Business Case and Dashboard screens.

If Vision IQ is PRELIM (< 100% completion): append "(estimate)" to the path label.

---

*Deliverable for UX-3. Thresholds confirmed by Kalpna (Prime = 80+). Percentile data pending Supabase query. Score drift decision pending.*
