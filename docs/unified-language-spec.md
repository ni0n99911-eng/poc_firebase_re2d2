# RE² · Unified Language Spec · BR-1
**Brain Thread · April 5, 2026**
**Status: APPROVED — April 5, 2026**

---

## 0 · Purpose

Single source of truth for language, labels, numbers, and thresholds across Dashboard, Location IQ, and Business Case. Every label, threshold, and copy rule defined here applies identically on all three pages. No exceptions.

---

## 1 · Verdict Vocabulary (5 Path Labels)

One set of labels. Used at the top of Location IQ, in every Dashboard location card, and at the top of the Business Case Summary tab.

| Label | Plain meaning | Tone |
|---|---|---|
| **Strong Path** | Clear signals, healthy break-even, low structural risk | Honest confidence |
| **Workable** | Solid signals, 1–2 adjustments move it to Strong Path | Constructive |
| **Tight** | Viable but margins narrow — pressure-test assumptions before signing | Honest caution |
| **Stretch** | Requires meaningful changes to concept, rent, or mix before this works | Direct |
| **Rethink** | Current combo doesn't add up — path is to change inputs, not give up | Agency preserved |

**Rules:**
- None say "No" or "Don't." Every label preserves agency.
- No congratulatory copy when numbers don't support it. A Workable with an active kill factor is not a Strong Path.
- The label is always accompanied by one plain-language sentence explaining why. No label stands alone.
- Vision IQ PRELIM state: verdicts are marked `(estimate)` if Vision IQ is incomplete, because Fit IQ input is partial. Label still shows — never block the verdict — but `(estimate)` signals the user to complete their profile.

**Deprecated everywhere in product:** "Strong Go," "Go - With Refinements," "Walk Away," "Needs Work," "Solid Fit," "Strong," "Exceptional."

---

## 2 · The Four Survival Numbers

These four numbers appear on the **Dashboard** (best candidate's values) and the **Business Case Summary tab** (current location's values). They do not appear on Location IQ.

All formulas use the Business Case engine inputs. The engine runs once per input-set; both Summary and Detailed tabs read from the same run.

---

### 2.1 · Cash to Open
**Plain label:** "What you need before day one."

```
cashToOpen = startupCosts + (monthlyOperatingCosts × 3)

startupCosts = (monthlyRent × 3)          // security deposit + first + last month
             + ffeCost                    // fixtures, furniture, equipment
             + permitsAndBuild            // permits, build-out, signage
             + initialInventory           // concept-specific (table below)

monthlyOperatingCosts = monthlyRent
                      + (annualRevenue × cogsPct / 12)
                      + (annualRevenue × laborPct / 12)
                      + monthlyOpex
```

The `× 3` at the end is a 3-month cash buffer that must be on hand on day one — founders need operating runway before revenue arrives.

**Concept startup cost seeds (shown with "Using default" chip until user edits):**

| Concept | ffeCost | permitsAndBuild | initialInventory |
|---|---|---|---|
| full_service_restaurant | $45,000 | $80,000 | $8,000 |
| specialty_coffee | $35,000 | $40,000 | $5,000 |
| bakery | $30,000 | $35,000 | $4,000 |
| fast_casual | $28,000 | $45,000 | $5,000 |
| qsr | $25,000 | $35,000 | $4,000 |
| bar_nightlife | $40,000 | $60,000 | $10,000 |
| retail | $20,000 | $25,000 | $15,000 |
| fitness_studio | $50,000 | $40,000 | $3,000 |
| wellness_spa | $35,000 | $30,000 | $2,000 |
| juice_bar | $20,000 | $25,000 | $4,000 |
| wellness_beverage | $18,000 | $20,000 | $3,000 |
| coworking | $60,000 | $50,000 | $2,000 |
| salon_barbershop | $25,000 | $30,000 | $3,000 |
| medical_dental | $70,000 | $60,000 | $5,000 |

**Edge cases:**
- If `visionInitialCapital` is set by user: show it beside cashToOpen as "You said you have [range]. Estimated cash to open: $X."
- If `monthlyRent` = 0: show with "⚠ Rent not entered" flag. Use concept default from BP_DEFAULTS — do not hide the number.
- Missing concept: fall back to full_service_restaurant values.

---

### 2.2 · Months of Runway
**Plain label:** "How long you can operate if revenue lags."

```
monthsOfRunway = cashToOpen / monthlyOperatingCosts
```

Round to nearest whole month. Cap display at "24+ months" — implying unlimited runway is misleading.

**Edge cases:**
- `monthlyOperatingCosts` = 0: show "—" with "Enter your costs to calculate."

---

### 2.3 · Break-Even Month
**Plain label:** "Month you stop losing money."

```
breakEvenMonth = ceil( cashToOpen / monthlyProfit )

monthlyProfit = (annualRevenue / 12) - monthlyOperatingCosts
```

This is the month cumulative cash losses from startup are fully recovered — when total outflows are covered by total inflows. Not simply the month monthly profit turns positive (that ignores startup costs).

**Derivation for Detailed tab:**
```
ending cash at month n = -cashToOpen + (n × monthlyProfit)
breakEvenMonth         = ceil( cashToOpen / monthlyProfit )
```

Always round up (ceil). Month 22.1 = Month 23.

**Edge cases:**
- `monthlyProfit` ≤ 0: never breaks even at current inputs. Show: "Does not break even at current inputs." Do NOT show a negative month or infinity. Show the Rethink label and surface the highest-leverage pathway.
- `breakEvenMonth` > 60: same treatment as above — not viable within a 5-year window.

---

### 2.4 · Cushion Needed
**Plain label:** "Safety reserve if year 1 goes sideways."

```
cushionNeeded = abs( min(0, stressedAnnualProfit) ) + (monthlyOperatingCosts × 2)

stressedAnnualRevenue = annualRevenue × 0.75        // 25% revenue shortfall
stressedTotalCosts    = bpTotalCosts × 1.10         // 10% cost overrun
stressedAnnualProfit  = stressedAnnualRevenue - stressedTotalCosts
```

The `+ 2 months of operating costs` is the minimum reserve buffer regardless of scenario outcome.

**Edge cases:**
- `stressedAnnualProfit` > 0: business survives a 25% revenue shock with no extra reserves. Show: "2 months of operating costs ($X) — you have margin to absorb a slow start."
- `cushionNeeded` > `cashToOpen`: flag it. The safety reserve exceeds the startup budget — the founder needs more capital than the startup estimate alone suggests.

---

## 3 · Scenario Definitions (Optimistic / Expected / Stressed)

Every survival number shows a range across three scenarios. The same definitions drive Summary range bars and Detailed scenario comparison table.

| Scenario | Revenue multiplier | Cost multiplier | Button label |
|---|---|---|---|
| Optimistic | ×1.20 | ×0.95 | "If things go well" |
| Expected | ×1.00 | ×1.00 | "Most likely" |
| Stressed | ×0.75 | ×1.10 | "If year 1 is slow" |

The scenario toggle re-runs the Business Case engine with adjusted revenue and cost inputs. Both tabs update simultaneously.

---

## 4 · Verdict Thresholds (deterministic)

**Two separate computations — never mixed:**
- **Location IQ** uses score-only bands. No financial data flows into this verdict.
- **Business Case + Dashboard** uses financial bands. No Location IQ score changes these thresholds.

---

### 4.0 · Location IQ Verdict (score-only, no financials)

Driven entirely by the composite Location IQ score. The four Survival Numbers and break-even math are irrelevant here.

| Location IQ Score | Path Label |
|---|---|
| ≥ 80 | Strong Path |
| 65–79 | Workable |
| 50–64 | Tight |
| 40–49 | Stretch |
| < 40 | Rethink |

Append "Low signal" chip if fewer than 3 location signals resolved.
Append `(estimate)` if Vision IQ is PRELIM (Fit IQ partial — score is provisional).

---

### 4.1 · Business Case + Dashboard Verdict (financial-based)

Business Case computes this. Dashboard reads the result — never recomputes independently.

**Primary threshold: Break-Even Month**

| Break-Even Month | Base Path Label |
|---|---|
| ≤ 24 | Strong Path |
| 25–36 | Workable |
| 37–48 | Tight |
| 49–60 | Stretch |
| > 60 or no break-even | Rethink |

### 4.2 · Kill Factor Overrides (demote by 1 tier)

If ANY of the following are active, demote the Path Label by one tier:

1. **Rent kill factor:** `monthlyRent / (annualRevenue / 12) > maxRentPercent` (per concept from conceptKPIs.ts — 8% for full_service_restaurant, 10% for specialty_coffee, etc.)
2. **Thin runway:** `monthsOfRunway < 3`
3. **Stress capital gap:** `cushionNeeded > cashToOpen × 1.5`

**Double-demotion:** Two or more kill factors active → demote two tiers. Cap at Rethink.

**Kill factor always pairs with a pathway.** Never shown alone. Format: "To clear this: [specific action] → [quantified impact on break-even month]."

### 4.3 · Missing Data States

| State | Display |
|---|---|
| No Business Case inputs yet | "Enter your numbers to see your path." — no Path Label |
| Vision IQ PRELIM | Path Label + `(estimate)` · "Complete Vision IQ for a more accurate read." |
| Location scored, no Business Case | Dashboard shows score only, no Path Label |
| < 3 location signals | Append "Low signal" chip to Path Label |

---

## 5 · Copy Voice Rules

### 5.1 · Vocabulary replacements (hard rules — no exceptions)

| Don't say | Say instead |
|---|---|
| COGS | Cost of what you sell |
| OpEx | Other monthly costs |
| EBITDA | (never show) |
| Margin % | Profit as a % of revenue |
| Pre-tax profit | What you keep before taxes |
| Break-even analysis | When you stop losing money |
| Liquidity buffer | Safety reserve |
| Worst-case loss | If year 1 goes sideways |
| Revenue ceiling | Max you can realistically make |
| Go / No-Go | (use Path Labels only) |
| Strong Go | Strong Path |
| Walk Away | Rethink |

### 5.2 · Number formatting rules

- Every dollar amount carries a pathway sentence. "$187K to open" → "Closer to $142K if rent drops to $10K/mo."
- Every % is anchored. "88%" → "88% vs. NYC's 52% average."
- Every break-even month carries its stressed range. "Month 22" → "Month 22–31 depending on your first-year pace."
- No congratulatory framing when numbers don't support it.

### 5.3 · Do-say / Don't-say examples

**Dashboard headline:**
- ✅ Headline copy: "Your plan is taking shape." — always. Warm, positive, does not change.
- ✅ Sub-line: factual and specific to the user's actual data. Example: "1 location scored. Best Fit IQ: 84. Strongest candidate breaks even Month 22."
- ❌ Sub-line with no numbers: "You're making great progress — keep scoring locations." (no data, no value)
- ❌ Moving the headline negative: "Your plan has issues — review before proceeding." (violates agency rule)

**Business Case verdict:**
- ❌ "Strong probability of success — Top 28% of NYC locations."
- ✅ "Workable. Break-even Month 22. Lower rent by $1,500/mo → moves to Strong Path."

**Kill factor:**
- ❌ "Your rent-to-revenue ratio is above the kill threshold. This is a serious problem."
- ✅ "Rent is 11% of projected revenue — 3 points above the 8% safe zone for full-service restaurants. Negotiating $1,500/mo off brings you inside the threshold. That's the highest-leverage move right now."

**Score in context:**
- ❌ "Location IQ: 73."
- ✅ "Location IQ: 73 (B-). Above 61% of Manhattan blocks we've scored for full-service restaurants."

### 5.4 · Tone rules

- 4th-grader vocabulary. If a 10-year-old can't parse it, rewrite it.
- No judgment. "This doesn't work" → "At current inputs, this doesn't reach break-even."
- Always a pathway. Every warning has a "to fix this:" that is specific and quantified.
- Honest, not scary. Show the upside and the downside — ranges inform, they don't panic.
- Friendly local, not professor. "The Flatiron reputation is real — and so is the density."

---

## 6 · Score-to-Grade Mapping (confirmed from codebase — `scoreGrade()`)

| Score | Grade | Badge color |
|---|---|---|
| 90+ | A | Green (#dcfce7 / #15803d) |
| 85–89 | A- | Green |
| 80–84 | B+ | Green |
| 75–79 | B | Green |
| 70–74 | B- | Green |
| 65–69 | C+ | Amber (#fef3c7 / #92400e) |
| 60–64 | C | Amber |
| 55–59 | C- | Amber |
| < 55 | D | Red (#fee2e2 / #991b1b) |

---

## 7 · Dashboard Logic Rules

### 7.0 · Dashboard is a Recap

The Dashboard is a summary of all locations the user has scored — not a standalone analysis surface. It does not recompute scores or financials. It reads from `scored_locations` (Supabase).

### 7.1 · Grouping

Locations are grouped by concept type. Each concept gets its own card group. Header shows the concept name + count: "Full-Service Restaurant (3 locations)."

Only concepts with at least one scored location appear. Empty groups are hidden.

### 7.2 · Prioritization (sort order within each concept group)

**Primary sort: Fit IQ — descending (highest first).**
Fit IQ reflects how well the location matches the concept. It is the most meaningful signal at a glance.

**Secondary sort: Break-Even Month — ascending (earliest first).**
Among locations with similar Fit IQ (within 5 points), the one with the earlier break-even month ranks higher.

If no Business Case has been run for a location: sort as if break-even month = ∞ (rank last within the Fit IQ tier).

**Tie-breaker:** Location IQ score descending.

### 7.3 · What Shows Per Location Card

- Location name + neighborhood
- Fit IQ score (badge, color-coded by grade)
- Location IQ score (badge, color-coded by grade)
- Path Label (from Business Case if available; from Location IQ score-only bands if not)
- Break-even month (if Business Case run — otherwise "Run business case")
- One kill factor chip if active (highest severity only)

### 7.4 · Cross-Concept Comparison

No cross-concept ranking. A coffee shop at Fit IQ 88 does not rank above a restaurant at Fit IQ 72 — they serve different concepts and are not comparable. Each concept group is self-contained.

---

## 8 · Data Sync Rules (preview for BR-2)

To prevent the contradiction documented in the brief (Dashboard −$107K vs Business Case +$169K for same location):

1. **One engine, one run.** The Business Case computation runs once per input change. Dashboard reads from the same cached result — never re-derives independently.
2. **Supabase is the cache.** `scored_locations.businessCase` is the only source of truth for Dashboard. Business Case page writes to it; Dashboard reads from it.
3. **Fit IQ source.** Dashboard and Location IQ must read from the same `scored_locations.fitScore`. Dynamic recalculation on Location IQ (triggered by Vision IQ updates) is valid only if it writes back to Supabase before Dashboard reads. If not synced, Dashboard shows stale score — flagged for BR-2.
4. **Vision IQ source.** One number per page. `scored_locations.serverVisionIQ`. Local-state vision IQ (updated as user fills fields) must not bleed into Dashboard until saved.

---

## 9 · What This Spec Does NOT Define

Owned by other BR tasks — this spec does not pre-empt them:
- Root cause of Dashboard −$107K vs Business Case +$169K → **BR-2**
- Vision IQ 59 vs 79 on same page → **BR-5**
- Full monthly P&L schema and Detailed tab derivation → **BR-6**
- Halo algo cluster + environmental expansion → **BR-8**
- Homepage stat provenance → **BR-7**

---

*End of BR-1 · Brain Thread · April 5, 2026*
*Submit to Kalpna for approval. No UX wireframe or production code proceeds until approved.*

---

## Appendix A · BR-5.2 Backlog — Percentile Reference Caption (HIGH PRIORITY)

**Feature:** "Top N% of [Borough] block groups · Top N% of all NYC block groups" caption on Location IQ page.

**Current state:** Hardcoded numbers removed from UX-3 wireframe. Lines hidden (`display:none`) until live data is available.

**What must be true before this ships:**

1. **Score writeback** — After each live analysis, the computed `location_iq` must be written to `block_group_scores` with `score_type = 'location_iq'`. Currently, live scores are computed client-side and never persisted. The DB max is 77; 89 Graham's live score of 81 has no row.

2. **Cross-borough coverage** — `block_group_scores` currently holds 2,156 Brooklyn block groups only. A valid NYC comparison requires Manhattan, Queens, Bronx, and Staten Island to be scored. Without this, the "all NYC" line is Brooklyn vs. Brooklyn.

3. **Percentile query** (once 1 + 2 are done):
```sql
SELECT
  ROUND((1 - PERCENT_RANK() OVER (
    PARTITION BY substring(geoid,3,3) ORDER BY location_iq
  )) * 100) + 1 AS borough_pct,
  ROUND((1 - PERCENT_RANK() OVER (
    ORDER BY location_iq
  )) * 100) + 1 AS nyc_pct
FROM block_group_scores
WHERE score_type = 'location_iq' AND geoid = :geoid
```

**UX rendering rule:** Both lines render dynamically from the score API response. Template:
- `"Top {boroughPct}% of {borough} block groups"`
- `"Top {nycPct}% of all NYC block groups"`

When either value is unavailable (no DB row, incomplete coverage): **hide the line entirely**. No "—" placeholder, no spinner. The score + grade badge is sufficient; the percentile is supplementary context only.

**Borough label mapping** (from geoid county FIPS):
- `036005` → Bronx · `036047` → Brooklyn · `036061` → Manhattan · `036081` → Queens · `036085` → Staten Island
