# MOD-01: Business Case Module — Scoping Brief

**Date:** April 12, 2026
**Author:** Brain Thread
**Status:** Audit complete — module is production-ready

---

## Module Identity

**Entry point:** `/src/routes/app/business-plan/+page.svelte`
**Store:** `/src/lib/stores/business-case-store.svelte.ts` (1,589 lines)
**Architecture:** Pure client-side $derived reactivity. No API calls on input change.
All financial math runs in `computeFullModel(ModelInputs): FinancialSummary` (~760 lines).

---

## UI Surface

Three tabs, each answering a founder question:

**Tab 1 — "Can I Afford This?" (SnapshotTab.svelte)**
Money to Open, Total Cash Needed, Daily Target, Break-Even Month (with scenario range),
Use of Funds breakdown, rent kill chip with copilot action buttons.

**Tab 2 — "Will I Make Money?" (StressTestTab.svelte)**
Monthly In vs Out, Three Futures (−20%/base/+25%), Buffer Months, Max Loss Breakdown
(equity + PG + loans + buildout), Sensitivity Months, Y3 Take-Home, Y5 Valuation.

**Tab 3 — "What Does the Bank Need?" (FullPictureTab.svelte)**
DSCR gauge, 5-Year P&L table, Go/No-Go verdict with evidence, Scenarios table,
Loan Serviceability, Risk Rating, Occupancy cost breakdown.

**Sidebar (BusinessCaseSidebar.svelte)**
Editable: dailyCustomers, avgTicket, COGS%, staff counts/rates, rent, opex, days/week,
loan params, escalation%, percentage rent rate/breakpoint.
Read-only from session: concept, address, LIQ, FIQ, VIQ, credit score, property tax.

---

## What's Fully Wired

| Feature | Lines | Status |
|---------|-------|--------|
| 60-month projection (revenue, COGS, labor, rent, opex, loan, tax) | 589–636 | LIVE |
| Ramp factors (24-month startup curve per concept) | conceptKPIs | LIVE |
| COGS maturity + labor efficiency curves | 589–636 | LIVE |
| Rent escalation (compound, user-overridable, clamped 0–15%) | 579–587 | LIVE (BR-B') |
| Percentage rent (December true-up, Rule 20) | 609–621 | LIVE (BR-L) |
| Tax pass-through (separate escalation) | 606–607 | LIVE (BC-01/02) |
| Break-even month (first positive CF, 1–36) | 640–644 | LIVE |
| Cash needed (startup + cumulative burn) | 646–653 | LIVE |
| Take-home Y1 (revenue − costs − reinvestment) | 656–659 | LIVE |
| DSCR Y1–Y5 | 724–735 | LIVE |
| Go/No-Go (5 conditions) | 737–794 | LIVE |
| Max Loss (equity + PG + loans + buildout) | 679–693 | LIVE |
| Sensitivity (−20% stress runway) | 695–705 | LIVE |
| Business valuation Y5 (SDE × multiplier) | 713–719 | LIVE |
| Scenario analysis (conservative/base/optimistic) | 797–849 | LIVE |
| Market events (4 universal + concept-specific) | 914–1071 | LIVE |
| Use of Funds breakdown | 891–901 | LIVE |
| Occupancy cost breakdown (BC-04) | 906–912 | LIVE |
| Coop advisory (BC-03: no deposit, no PG) | 1242–1243 | LIVE |
| 18+ validation gates | 1073–1244 | LIVE |
| Vital Rules 2, 3, 20 integration | 1128–1239 | LIVE (BR-L/M/M2) |

---

## What's Stub / Placeholder / Missing

| Item | Current State | What's Needed | Priority |
|------|--------------|---------------|----------|
| **CashFlowChart.svelte** | Component exists, not imported in any tab | Wire into StressTestTab or create dedicated chart view | LOW |
| **business-case-summary API** | Legacy endpoint, replaced by client $derived | Remove or mark deprecated | LOW |
| **Property tax UI controls** | Read-only from session, no sidebar edit fields | Add override inputs if founders need to test different tax scenarios | MED |
| **ACRIS mortgage narrative** | Data available in PropertyTaxProfile but not displayed in BC | Show lender context, leverage classification in Full Picture | MED |
| **Tax lien severity → model** | Severity classified but doesn't affect model assumptions | Could adjust contingency or interest rate based on CRITICAL liens | LOW |
| **Foot traffic proxy** | `(transitScore * 3) + (vibrancyScore * 2)` — linear approximation | Replace with SafeGraph/Replica when available (Placer.ai blocked) | BLOCKED |
| **Copilot integration** | onClick hooks in SnapshotTab, handler is external | RE²D2 copilot strategy execution (negotiate_rent, etc.) | FUTURE |
| **Location delta** | locationDeltaPct computed, used only in Go/No-Go Cond 4 | Could drive more model adjustments (e.g., capture rate scaling) | LOW |
| **sqft pro-rating** | `fetchPropertyTaxProfile(bbl, 0, ...)` — sqft defaults to 0 | Pass session sqft for accurate multi-tenant tax allocation | MED |

---

## Data Contracts

### ModelInputs (what the store feeds the engine)

```
dailyCustomers, avgTicket, cogsPercent, daysPerWeek
fullTimeStaff, fullTimeRate, partTimeStaff, partTimeRate
monthlyRent, monthlyOpEx, personalInvestment, creditScore
loanAmount, loanTermYears, loanRate, hasPersonalGuarantee
conceptKey, sqft, transitScore, vibrancyScore
locationIQ, fitIQ, visionIQ, sixScores
monthlyTaxPassThrough, taxEscalationAnnual, isCoop
escalationPct, percentageRentRate, percentageRentBreakpoint
```

### FinancialModel (what the UX renders)

```
breakEvenMonth, cashNeeded, takeHomeY1, startupCosts
breakEvenPerHour, breakEvenPerDay, locationWizardPct
maxLoss, maxLossBreakdown, sensitivityMonths
takeHomeY3, valuationY5
yearRows[], monthlyRows[], scenarios[]
goNoGo, evidenceFor[], evidenceAgainst[], conditions[]
loanAmount, loanMonthlyPayment, loanRate, loanTermYears, gapToFund
validations[], occupancyCostBreakdown, isCoop
useOfFunds, marketEvents[], totalInterest
```

### Session → Store Init (read at mount)

```
re2_launchpad: businessType, personalInvestment, creditScore, budget, squareFootage
re2_session: locationIQ, fitIQ, visionIQ, sixScores, propertyTax, sliderDefaults
re2_business_case_inputs: saved sidebar values (persisted by saveInputs)
CONCEPT_KPIS[conceptKey].businessCase: buildout, equipment, permits, ramp, etc.
```

---

## Vital Rules Integration

| Rule | Check | Severity | Trigger |
|------|-------|----------|---------|
| Rule 2 | Rent escalation stress | FLAG | Y3 rent % > occupancy ceiling |
| Rule 3 | Revenue per SF floor | FLAG | Implied rev/SF < $150 concept floor |
| Rule 20 | Percentage rent clause | WARNING/FLAG | Triggers in year N, 3-year impact |

All three call into `vital-rules.ts` registry functions. Results surface as
validation banners in Full Picture tab and sidebar alerts.

---

## Validation Gates (18+ checks)

Break-even bounds, cash needed bounds, take-home Y1 bounds, DSCR thresholds,
footfall bounds, location delta bounds, max loss cap, sensitivity floor,
valuation vs startup, rent-to-revenue (15%/20%/25%), occupancy cost ratio (18%/25%),
Rule 2/3/20 compliance, coop advisory, COGS range, labor range.

---

## Conclusion

The Business Case module is **fully production-ready**. All core financial calculations,
scenario analysis, validation gates, and Vital Rules integration are wired and deployed.
The remaining items are enhancements (chart wiring, ACRIS narrative, tax UI controls)
rather than missing functionality. No code changes needed for this scoping brief —
this document captures the full picture for future planning.
