# RE² · BR-6 · Business Case Logic Additions
**Brain Thread · April 5, 2026**
**Status: SPEC — for UX-2 (Business Case) implementation**

This document is the authoritative source for all financial computation in the Business Case screens. All survival number formulas, loan derivation chains, scenario definitions, and edge cases are pulled directly from production code. UX renders from this spec — it does not compute independently.

---

## 1 · Core Architecture: Single Engine, Two Views

**One computation engine produces all numbers.** The `saveBusinessCase()` function in `src/routes/app/financials/+page.svelte` writes to `localStorage` on every projection change and before navigation. The Dashboard and Business Case Summary tab both read from this same record.

```
financials/+page.svelte → projections (5-year model)
                        → saveBusinessCase() on $effect + beforeNavigate
                        → re2_launchpad.scoredLocations[i].businessCase
                                    ↓
              Dashboard reads    Business Case Summary reads
              (with isPartialSeed guard — BR-2)
```

**Two-tab split (Summary / Detailed):**
- **Summary tab**: Reads the `businessCase` object from localStorage/Supabase. Shows 4 survival numbers + FICO block. No recomputation. Read-only.
- **Detailed tab**: Has live sliders. Reads from the live `projections` derivation. Scenario toggles apply here. Output feeds back into `saveBusinessCase()` which updates the Summary tab's source.

**Rule:** Summary and Detailed always show the same base-case numbers. If they diverge, a recompute has not yet fired — this is a display-only race condition (< 1 second), not a data conflict.

---

## 2 · The Four Survival Numbers

These are the only four numbers that appear in the Business Case Summary card and Dashboard Business Case section.

### 2.1 · Cash to Open

```
cashToOpen = buildoutBudget + preOpeningCosts
```

**Where these come from (production):**
- `buildoutBudget` = `lpData.financialGoals.buildoutBudget || 350000` (from onboarding)
- `preOpeningCosts` = Year 0 SDE: `buildoutBudget + 40,000` (base) / `+ 45,000` (pess) / `+ 50,000` (opt)
  - The $40–50K covers pre-opening labor ($20K), pre-opening opex ($20–30K)
  - Production code: `sde: { pess: -buildoutBudget - 40000, base: -buildoutBudget - 45000, opt: -buildoutBudget - 50000 }`

**Summary tab displays:** `Cash to Open: $[buildoutBudget + 45,000]` (base case)

**Edge cases:**
- If `buildoutBudget` is 0 or missing: show `$395,000` (fallback: $350K default + $45K)
- If user has overridden buildout in Detailed tab: show their overridden value

### 2.2 · Months of Runway

```
monthsOfRunway = fundingCapital / (|Year 0 SDE base| / 12)
```

**Simpler statement:** Personal capital ÷ monthly burn during pre-opening. Year 0 SDE is always negative (pre-revenue period). Monthly burn = `(buildoutBudget + 45,000) / 12`.

**Display cap:** Never show more than 24 months of runway — beyond 24 months, show "24+ months". Never show 0 — if `fundingCapital = 0`, show "Needs funding".

**Edge cases:**
- `fundingCapital = 0` → "Needs funding" state, not a number
- `fundingCapital ≥ cashToOpen` → "Fully funded" — no loan needed, runway is not a constraint

### 2.3 · Break-Even Month

This is the most important number. **Definition: first month where cumulative Σ SDE ≥ 0** (not first month of monthly profit being positive — that's a weaker threshold).

```javascript
// From saveBusinessCase() — production code:
let breakEvenMonths = 0;
for (let yi = 1; yi < projections.length; yi++) {
  const cum = projections[yi].cumulative_cash.base;
  const prevCum = projections[yi - 1].cumulative_cash.base;
  if (cum >= 0 && prevCum < 0) {
    const fraction = Math.abs(prevCum) / (Math.abs(prevCum) + cum);
    breakEvenMonths = Math.round(((yi - 1) + fraction) * 12);
    break;
  }
}
// If cumulative never crosses zero within 5 years:
if (breakEvenMonths === 0 && projections[projections.length - 1].cumulative_cash.base < 0) {
  breakEvenMonths = 60;  // Cap at 60 → "Rethink" verdict
}
```

`projections[yi]` is indexed by year (0–5). Year 0 is the pre-opening investment period. Break-even in month 24 = end of Year 2.

**Path Labels (BR-1):**

| Break-Even Month | Path Label | Color token |
|---|---|---|
| ≤ 24 | Strong Path | `--color-green` |
| 25–36 | Workable | `--color-blue` |
| 37–48 | Tight | `--color-amber` |
| 49–60 | Stretch | `--color-orange` |
| > 60 or never | Rethink | `--color-red` |

**Edge case:** If `breakEvenMonths = 60` and the model genuinely never crosses zero, show "60+ months" not "60 months". Verdict = Rethink.

### 2.4 · Cushion Needed

```
cushionNeeded = max(0, cashToOpen - fundingCapital)
```

This is the funding gap — how much more the user needs beyond personal capital.

**Edge cases:**
- `fundingCapital ≥ cashToOpen` → "Fully funded — no gap" state, not $0
- `fundingLoanAmount ≥ cushionNeeded` → "Gap covered by loan" sub-label under the number

---

## 3 · Loan Derivation Chain

### 3.1 · Loan Amount

```javascript
fundingLoanAmount = Math.max(0, buildoutBudget - fundingCapital);
```

The loan amount is what remains after personal capital is applied to the buildout. Never negative.

**Example:** Buildout $122K, capital $65K → loan $57K.

### 3.2 · Loan Types and Rates

| Type | Default rate | Range shown | Auto-selected when |
|---|---|---|---|
| SBA 7(a) | 10.5% | 8–13% | Credit 670+ |
| SBA Microloan | 10.0% | 8–13% | Manual selection |
| Traditional | 9.5% | 7–12% | Credit 580–669 |
| Alt Lender | 20.0% | 15–25% | Credit below 580 |

### 3.3 · Monthly Payment Formula

Standard amortization — production formula, exact:

```javascript
const r = fundingRate / 100 / 12;
const n = fundingLoanTerm * 12;
fundingMonthlyPayment = Math.round(
  fundingLoanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
);
```

**Reference table — $57K loan, 10-year term:**

| Rate | Monthly payment |
|---|---|
| 7.0% | $663/mo |
| 8.0% | $692/mo |
| 9.5% (Traditional) | $739/mo |
| 10.5% (SBA 7(a)) | $769/mo |
| 20.0% (Alt Lender) | $1,104/mo |

**⚠ UX-2 wireframe correction:** The wireframe showed "~$620/mo" for $57K. At SBA 7(a) default (10.5% / 10yr), the correct figure is **$769/mo**. At 8% / 10yr it is **$692/mo**. The UX thread must display the computed `fundingMonthlyPayment` value, not a hand-estimated figure. Update the wireframe before implementation.

### 3.4 · Break-Even Impact of Loan

Annual loan payment is treated as a fixed cost in every year's SDE:

```javascript
const annualLoanPayment = fundingMonthlyPayment * 12;
// SDE = Gross Profit − Labor − Rent − OpEx − annualLoanPayment
```

A higher monthly payment directly extends break-even. The Detailed tab should show this explicitly in the P&L table.

### 3.5 · FICO Block — Summary Tab Rule

**Summary tab: use production `creditGateMessage` only. No loan amounts, rates, or monthly payment figures in the Summary tab FICO block.**

Production copy (verbatim — do not alter):
```
800+ / 740–799  →  "SBA Ready — you qualify for the best rates"
670–739         →  "Good — SBA possible with documentation, consider traditional"
580–669         →  "Limited — traditional or microloan, higher rates apply"
below 580       →  "Alt lenders only — rates will be 15–25%"
```

Loan details (rate, payment, total cost) belong in the **Detailed tab's Funding section only**.

---

## 4 · Scenario System

### 4.1 · Three-Column Model (Conservative / Base / Optimistic)

Production uses three columns, not toggles. They apply multipliers to `steadyStateRevenue`:

```javascript
// At default confidence (revenueConfidence = 50):
pessimistic: 0.70  // Conservative column
base:        0.90  // Base column
optimistic:  1.10  // Optimistic column
```

At non-default confidence, `confidenceAdjust = (revenueConfidence - 50) / 250` shifts these slightly. At confidence = 70: pessimistic ≈ 0.708, base ≈ 0.912, optimistic ≈ 1.116.

These are **the canonical scenario multipliers**. UX Summary range bars must derive from the same function, not from hand-coded values.

### 4.2 · Five Named Scenario Toggles

The financials page has 5 named toggles (Competitor, Rent Escalation, Delivery, Second Location, Downturn). These are additive modifiers on the columns — they shift multipliers and PoS (probability of success).

**Detailed tab only.** Summary tab shows base-case numbers unless the user has activated toggles in Detailed and the `saveBusinessCase()` has re-fired with those effects applied.

### 4.3 · Concept-Specific Scenario Labels (DYNC-005)

Each named toggle has a concept-specific label. For example, "Competitor" for specialty_coffee might read "A third wave café opens on the block." The `scenarioLabels` derived object provides these. UX must use the derived labels, not generic toggle names.

### 4.4 · Which Survival Numbers Shift Under Scenarios

**Only Break-Even Month moves with revenue scenarios.** The other three survival numbers are driven by buildout/capital, not revenue. Summary tab range bars should reflect this:

| Survival Number | Shifts with Optimistic/Stressed? | Why |
|---|---|---|
| Cash to Open | No | `buildoutBudget + 45K` — fixed by concept buildout, not revenue |
| Months of Runway | No | `fundingCapital / (Year0 SDE / 12)` — capital and pre-opening burn, pre-revenue |
| **Break-Even Month** | **Yes** | Cumulative Σ SDE crosses zero later under stressed revenue, earlier under optimistic |
| Cushion Needed | No | `cashToOpen − fundingCapital` — buildout and capital only |

**Break-even scenario table (example — specialty coffee, $395K cashToOpen, $65K capital, $57K loan):**

| Scenario | Revenue multiplier | Break-even shift (illustrative) |
|---|---|---|
| Stressed | ×0.70 (pess base) | +8 to +14 months later |
| Base | ×0.90 | baseline |
| Optimistic | ×1.10 | −4 to −8 months earlier |

**Rule for UX:** Range bars on Cash to Open / Runway / Cushion should be flat (single-point displays or visually static). Only the Break-Even Month bar should render a min/max range across scenarios. Showing a ±range on the fixed numbers misleads the user into thinking they move.

**Exception:** If scenario toggles modify `monthlyRentBudget` (Rent Escalation toggle does this), then Cash to Open does NOT move but the annual loan-payment line shifts under "Rent Escalation" toggle because rent enters every year's SDE. This is captured in the Detailed tab P&L, not in the four summary numbers.

---

## 5 · Cost Structure Reference (Detailed Tab)

Year 1 cost breakdown, base case:

| Line | Formula |
|---|---|
| COGS | `revBase × (conceptCogsBase × 1.10)` — Year 1 has 10% inefficiency premium |
| Labor | `revBase × (conceptLaborBase × 1.03)` — Year 1 has 3% ramp premium |
| Rent | `monthlyRentBudget × 12` — fixed, not revenue-linked |
| OpEx | `revBase × 0.12` — steps down to 0.11 in Y3, 0.10 in Y5 |
| Loan payment | `fundingMonthlyPayment × 12` — fixed obligation |

---

## 6 · Kill Factor Demotion Logic

**Principle:** A kill factor is a structural problem in the business case that caps the verdict. One kill factor demotes one tier. Multiple kill factors demote two tiers. Verdict can never be promoted by kill factors.

### 6.1 · Three Kill Factors

| Kill Factor | Trigger Condition |
|---|---|
| Rent Kill | `(monthlyRent × 12) / revenueY1 × 100 > CONCEPT_KPIS[concept].maxRentPercent` |
| Thin Runway | `monthsOfRunway < 3` AND `fundingCapital > 0` |
| Stress Capital Gap | `cushionNeeded > cashToOpen × 1.5` (gap exceeds 150% of what's needed) |

### 6.2 · Demotion Table

Demotion is applied to the Business Case path label (break-even-derived), not the Location IQ verdict.

| # Kill Factors Active | Verdict Adjustment | Cap | Color rendered |
|---|---|---|---|
| 0 | No change | — | Raw verdict color |
| 1 | Demote 1 tier | Cap at Tight | **Demoted verdict color** (e.g. Strong Path → Workable = render blue, not green) |
| 2 | Demote 2 tiers | Cap at Stretch | Always Rethink red |
| 3 | Demote 2 tiers | Cap at Rethink | Always Rethink red |

**Tier order (best → worst):** Strong Path → Workable → Tight → Stretch → Rethink

**Color rendering rule (UX-approved):** Always render the color of the **post-demotion verdict**, never the pre-demotion color. The pre-demotion verdict is not shown to the user.

**Example:**
- Raw break-even verdict (month 22) = Strong Path (green)
- Rent Kill active → demote 1 tier → **Workable (blue)** — render blue, not green
- Rent Kill + Thin Runway → demote 2 tiers → **Rethink (red)** — render red

### 6.3 · Seed Guard

Kill factor evaluation requires `!businessCase.isPartialSeed && revenueY1 > 0`. On partial seeds, skip all kill factor logic — no verdict is displayed.

### 6.4 · UX Display

- 0 kill factors: no warning chips, clean verdict
- 1 kill factor: 1 amber warning chip, verdict label shows no special treatment beyond its color
- 2+ kill factors: red warning banner at top of Summary tab listing all active factors, verdict label rendered in Rethink color regardless

Chip copy format: `"⚠ [Factor name]: [specific value] vs [threshold]"`
- Rent Kill: `"⚠ Rent 14% — above 10% threshold"`
- Thin Runway: `"⚠ Runway 2 months — below 3-month floor"`
- Stress Capital Gap: `"⚠ Gap $680K — 1.7× cash-to-open"`

---

## 7 · Rent Kill Factor

**Source:** `CONCEPT_KPIS[concept].maxRentPercent` in `src/lib/constants/conceptKPIs.ts`

Kill factor triggers when: `monthlyRent / (annualRevenue / 12) × 100 > maxRentPercent`

Thresholds by concept:

| Concept | Max rent % |
|---|---|
| specialty_coffee, fast_casual, full_service_restaurant, nail_salon | 10% |
| cocktail_bar, wine_bar | 8% |
| fitness_studio, yoga_studio | 10% |
| co_working | 15% |
| bakery, juice_bar, specialty_food | 12% |
| specialty_retail | 10% |

Warning chip copy: `"⚠ Rent [X]% — above [threshold]% threshold"`

---

## 8 · isPartialSeed Guard (BR-2)

When the location page seeds the business case before the user has run the financials page, it writes:

```javascript
businessCase: { revenueY1: _seedRev, costsY1: 0, profitY1: 0, breakEvenMonths: 0, isPartialSeed: true }
```

Dashboard and Summary tab guard:
```javascript
if (loc.businessCase?.isPartialSeed || !loc.businessCase) {
  // Show nudge — do NOT render the 4 survival number boxes
}
```

**Nudge state design spec (UX-approved April 5):**
- Replaces the 4 survival number boxes entirely (does not slot inline)
- Copy (body): `"Run the Business Case to see survival numbers for this location."`
- CTA button: `"Build Business Case →"` → links to `/app/financials?addr=[addr]`
- Treatment: dashed grey card (muted), copy + separate CTA button (two elements, not single arrow link)
- Mobile: full-width card, no truncation, tap target = full CTA button width
- Does not show $0 or blank values — only the nudge

**When cleared:** User completes financials page → `saveBusinessCase()` fires without `isPartialSeed` → Dashboard and Summary tab show real survival numbers automatically.

---

## 9 · Edge Cases

| Condition | Behavior |
|---|---|
| `fundingCapital = 0` | Cushion Needed = full cashToOpen. Runway = "Needs funding" |
| `fundingCapital ≥ cashToOpen` | "Fully funded" state. Cushion = "No gap". |
| `breakEvenMonths = 60`, never crosses 0 | Show "60+ months". Verdict = Rethink. |
| `businessCase.isPartialSeed = true` | Show nudge instead of survival numbers |
| `businessCase` is null or absent | Same as isPartialSeed — show nudge |
| Vision IQ < 100% completion | Append "(estimate)" to path label. Does not affect survival number computation. |
| Rent > concept `maxRentPercent` | Show rent kill warning chip (amber) in Summary tab |
| 1 kill factor active | Demote 1 tier, cap at Tight. 1 amber chip below survival grid. |
| 2+ kill factors active | Demote 2 tiers, cap at Rethink. Red banner at top of Summary tab listing all active factors. |
| `fundingLoanAmount = 0` | No FICO block shown. No loan payment in cost breakdown. |
| `monthsOfRunway < 3` AND `fundingCapital > 0` | Thin Runway kill factor fires. Amber chip: "⚠ Runway [N] months — below 3-month floor" |
| `cushionNeeded > cashToOpen × 1.5` | Stress Capital Gap kill factor fires. Amber chip: "⚠ Gap $[X] — [Y]× cash-to-open" |
| Break-Even range bar with scenarios | Only Break-Even shows min/max bar (Optimistic/Base/Stressed). Other 3 survival numbers = single-point display, no bar. |

---

*Deliverable for UX-2. All formulas from production `src/routes/app/financials/+page.svelte` and `src/lib/constants/conceptKPIs.ts`. No values hand-tuned.*
