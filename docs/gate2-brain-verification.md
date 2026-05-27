# RE² · Gate 2 · Brain Verification Findings
**Brain Thread · April 5, 2026**
**Status: INTERIM — some findings confirmed from code, some require live data verification**

This document addresses all 8 VERIFY items from Kalpna's Gate 2 review. Each item is marked:
- ✅ CONFIRMED — verifiable from existing code/data
- ⚑ PENDING — requires live data query or external confirmation
- ✏️ DECISION NEEDED — Kalpna must pick between options

---

## BR-5 Verifications

### VERIFY-BR5.1 · Mixed/Solid/Prime Block thresholds

**Current codebase:** No explicit Mixed/Solid/Prime block label thresholds exist in the codebase. The `score_grade()` function in existing code uses: 90+=A, 85–89=A-, 80–84=B+, 75–79=B, 70–74=B-, 65–69=C+, 60–64=C, 55–59=C-, 50–54=D+.

**Proposed thresholds (BR-5 recommendation):**

| Label | Loc IQ range | Rationale |
|---|---|---|
| Prime Block | 80–100 | Top tier — strong signals across multiple dimensions |
| Solid Block | 65–79 | Mid tier — solid but at least one dimension below threshold |
| Mixed Block | 50–64 | Lower tier — signals mixed, risk elevated |
| Below threshold | <50 | Not labeled — Loc IQ shouldn't be the primary pitch here |

**FIX-3.1 consequence:** 89 Graham at LIQ 81 = **Prime Block** ✅ (wireframe corrected).

**Decision required:** Are these thresholds approved? If Prime starts at 85 instead of 80, that changes 89 Graham (81 would be Solid) and the tooltip copy must change. Brain recommends Prime at 80+ — aligns with score_grade() B+ boundary (80–84).

---

### VERIFY-BR5.2 · Top N% reference populations

**Current codebase:** The `top_pct_label` logic (if it exists in the scorer) references NYC-wide block group data. There is no current borough-segmented percentile calculation confirmed in the scoring engine.

**Proposed approach (BR-5 recommendation):**

Two badges, two reference populations:

| Badge | Population | Calculation |
|---|---|---|
| "Top N% of [borough] block groups" | All block groups in the borough the address is in | `NTILE(100) OVER (PARTITION BY borough ORDER BY location_iq DESC)` |
| "Top N% of all NYC block groups" | All ~6,300 NYC block groups | `NTILE(100) OVER (ORDER BY location_iq DESC)` |

**FIX-3.2 consequence:** 89 Graham = Williamsburg = Brooklyn → reference must be "Brooklyn block groups" ✅ (wireframe corrected). The exact % (8%, 12%) shown in the wireframe is illustrative and must be replaced with computed values from Supabase before shipping.

**⚑ PENDING:** Pull actual percentile values for 89 Graham from `block_group_scores` table.

```sql
-- Run against Supabase to get real values:
WITH ranked AS (
  SELECT geoid, location_iq,
    PERCENT_RANK() OVER (PARTITION BY borough ORDER BY location_iq DESC) * 100 AS borough_pct,
    PERCENT_RANK() OVER (ORDER BY location_iq DESC) * 100 AS nyc_pct
  FROM block_group_scores
  WHERE location_iq IS NOT NULL
)
SELECT borough_pct, nyc_pct FROM ranked
WHERE geoid = '[89 Graham Ave geoid]';
```

---

### VERIFY-BR5.3 · 89 Graham Ave score reconciliation (BR-2 check)

**Claim:** Loc IQ 81 / Fit IQ 74 / Vision IQ 78 should be consistent across Location IQ page and Dashboard.

**Root cause from BR-2:** The Dashboard merge strategy (`loc.businessCase ?? r.businessCase`) takes local localStorage first. Score figures (Loc IQ / Fit IQ) come from Supabase `shortlisted_locations` after M015. The drift Kalpna observed (Fit IQ 76 on Location IQ vs Fit IQ 70 on Dashboard) is likely from:
- Location IQ reading from the live scoring run (current session)
- Dashboard reading from the Supabase record (which may have been computed at a different time with different inputs)

**⚑ PENDING:** To confirm 89 Graham reconciles, query:
```sql
SELECT location_iq, fit_iq, vision_iq, scored_at
FROM shortlisted_locations
WHERE addr ILIKE '%89 Graham%' OR addr ILIKE '%graham ave%';
```
Compare against what the live scoring run returns for the same address. If they differ, the root cause is a re-scoring between pin and display — the M015 sync writes the score at pin time, but the scoring engine may produce slightly different results on re-run if signal data has updated.

**BR-2 fix (isPartialSeed)** does not address score drift — that's a separate issue. Score drift fix requires: either (a) always trust the Supabase record as canonical, or (b) re-run the scorer on page load and update Supabase if the result differs by >2 points.

---

## BR-6 Verifications

### VERIFY-BR6.1 · FICO copy provenance

**Confirmed:** The production financials page does NOT use the specific language "Based on your stated credit profile, you likely qualify for an SBA 7(a) loan up to $57K at 7–9% APR."

Production uses band messages:
```javascript
if (fundingCreditScore === '800+' || fundingCreditScore === '740-799')
  return 'SBA Ready — you qualify for the best rates';
if (fundingCreditScore === '670-739')
  return 'Good — SBA possible with documentation, consider traditional';
```

**FIX-2.2 consequence:** The wireframe's FICO block copy is **new**. The disclaimer "Estimate only — not a lending commitment. Actual terms vary by lender and individual profile." has been added to the UX-2 wireframe ✅.

**For implementation:** The production financials page's `creditGateMessage` logic and the loans page's SBA content together form the DO-NOT-TOUCH FICO block. The wireframe's Summary tab FICO block should either:
- Mirror the existing `creditGateMessage` string exactly (no disclaimer needed — existing copy is already hedged as an assessment, not a commitment), OR
- Use the new specific loan-amount language with the added disclaimer

Brain recommendation: **use existing production copy** (`creditGateMessage` output) in the Summary tab. The specific $57K / APR / monthly payment numbers belong in the Detailed tab's Loan detail section, where the derivation is shown explicitly.

---

### VERIFY-BR6.2 · $57K loan derivation chain

**From production code (`src/routes/app/financials/+page.svelte`):**

```javascript
// Loan amount:
fundingLoanAmount = Math.max(0, buildoutBudget - fundingCapital);
// e.g., buildout $122K - capital $65K = loan $57K

// Monthly payment:
const r = fundingInterestRate / 100 / 12;
const n = fundingLoanTerm * 12;
fundingMonthlyPayment = Math.round(fundingLoanAmount * (r * Math.pow(1+r,n)) / (Math.pow(1+r,n) - 1));
// e.g., $57K at 8% APR, 10 years = $692/mo (wireframe showed ~$620 — slight discrepancy)
```

**Discrepancy:** Wireframe shows "~$620/mo" — production formula at 8% / 10yr produces $692/mo. At 7% / 10yr: $663/mo. At 7% / 12yr: $590/mo. The $620 figure matches approximately 7% / 11-year term. The wireframe used an imprecise estimate.

**For implementation:** Use the actual `fundingMonthlyPayment` derived value, not a hand-estimated figure. The Detailed tab must show: principal ($57K) → rate (from user's credit band) → term (user-set) → monthly service (computed). Summary tab shows only the computed monthly service figure.

**`docs/business-case-logic-additions.md` must document:**
1. Loan amount formula: `max(0, buildoutBudget − personalCapital)`
2. Monthly service formula: standard amortization
3. Breakeven effect: `loanPayments × 12` added to Year 1 costs
4. Range calculation: Optimistic (×1.20 rev, ×0.95 costs), Stressed (×0.75 rev, ×1.10 costs) — these multipliers must be documented as canonical so Summary range bars and Detailed scenario comparison always use identical multipliers

---

## BR-8 Verifications

### VERIFY-BR8.1 · Named businesses in Pattern Logic cards

**Status: ⚑ PENDING — live data verification required**

The wireframe names:
- "Brooklyn Roasting Co. · Sey Coffee · 1 Dunkin" within 400ft of 89 Graham Ave
- "Barbershop · dry cleaner · bodega · pharmacy" as 4 morning-rhythm businesses within 200ft

**These are illustrative examples, not verified against live competitor data.**

Sey Coffee is at 18 Grattan St, Williamsburg — approximately 0.3 miles from 89 Graham Ave (within 400ft radius is questionable — 400ft ≈ 0.075 miles; 0.3 miles ≈ 1,600ft). Brooklyn Roasting Co. closed its Williamsburg location. These specific businesses may not be accurate.

**Required before shipping:** Run the cluster-detection query from BR-8 against the enriched_entities/Google Places data for the block group containing 89 Graham Ave. Replace illustrative business names with verified real names.

**Interim label for wireframe:** Pattern cards should show a placeholder note: "⚑ Business names illustrative — verified data loads from BR-8 cluster detection at runtime." This is already the correct UX pattern (Brain supplies live data, not static copy).

---

### VERIFY-BR8.2 · Building-facing data for 89 Graham Ave

**Status: ⚑ PENDING — building-facing detection not yet implemented**

The BR-8 spec (to be written) defines the facing detection method:
> Street-segment geometry + parcel position (odd/even address convention + parcel centroid relative to street centerline) → primary_facing (N/S/E/W/NE/NW/SE/SW)

This logic does not yet exist in the codebase. The "East-facing · high confidence · 3.1 hours AM sun" in the wireframe is estimated from:
- Graham Ave runs roughly NW-SE in Williamsburg
- Odd-numbered addresses (89 = odd) tend to be on the south/east side of the street in NYC grid
- East/SE-facing ground floor plausible but not confirmed via parcel geometry

**Interim label for wireframe:** "East-facing (pending parcel geometry confirmation)" — the wireframe should not claim "high confidence" until the detection logic runs.

**Required for BR-8 spec:** Document the facing detection method, data source (NYC MapPLUTO parcel centroid + LION street segment geometry), and the sun-hour formula (NYC lat 40.7° N + seasonal sun path table per compass direction).

---

### VERIFY-BR8.3 · Cluster-concept compatibility matrix

**Status: ⚑ PENDING — matrix must be formally defined in BR-8 spec**

The wireframe shows wine bar at 89 Graham flagged as "cluster mismatch" for Daily-ritual cluster — this is a correct intuition but must be produced by a defined matrix, not hand-tuned per example.

**Proposed matrix structure (BR-8 spec must formalize):**

| Cluster type | Compatible concepts | Neutral concepts | Mismatch concepts |
|---|---|---|---|
| Daily-ritual | specialty_coffee, bakery, fast_casual | fitness_studio, co_working | wine_bar, full_service_restaurant, cocktail_bar |
| Evening-destination | wine_bar, full_service_restaurant, cocktail_bar, live_music | specialty_coffee (if extended hours) | dry_cleaning, pharmacy |
| Service-errand | nail_salon, alterations, phone_repair | specialty_coffee, bakery | wine_bar, full_service_restaurant |
| Morning-sun (environmental) | specialty_coffee, bakery, juice_bar | co_working | wine_bar, cocktail_bar |
| West/SW-facing (evening sun) | wine_bar, cocktail_bar, full_service_restaurant | specialty_coffee | N/A |

**For BR-8 spec:** Formalize this matrix with halo weight modifiers. Compatible = +weight, Neutral = 0, Mismatch = shown as flag, no halo contribution. The matrix is the source of truth — the wireframe's "cluster mismatch" label derives from it, not from hand-written copy.

---

## Summary: What Blocks UX Implementation

| Item | Status | Blocker |
|---|---|---|
| BR-5.1 Thresholds | ✏️ Decision | Kalpna approves Prime=80+ or adjusts |
| BR-5.2 Real percentiles | ⚑ Pending | Supabase query needed |
| BR-5.3 Score reconciliation | ⚑ Pending | Supabase query + investigation |
| BR-6.1 FICO copy | ✅ Confirmed | Use production `creditGateMessage` copy |
| BR-6.2 Loan derivation | ✅ Confirmed | Formula documented above, `docs/bc-logic.md` pending |
| BR-8.1 Named businesses | ⚑ Pending | Run cluster detection against live data |
| BR-8.2 Building facing | ⚑ Pending | Parcel geometry logic not yet built |
| BR-8.3 Cluster matrix | ⚑ Pending | Must be in BR-8 spec before UX-5 ships |

**Gate 2 can close on UX-1, UX-2, UX-3** once Kalpna approves the revised wireframes.

**UX-5 (Pattern Logic)** cannot ship to production until BR-8.1 (real business data), BR-8.2 (facing verification), and BR-8.3 (cluster matrix) are complete. The wireframe is approved for design direction; the data claims in the live product must be verified before any user sees them.
