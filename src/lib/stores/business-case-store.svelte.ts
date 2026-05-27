/**
 * business-case-store.ts
 *
 * RE² Business Case Calculation Engine — Brain Thread Build v2
 * April 2026 — Complete rewrite per Brain Build Instructions v2
 *
 * Architecture:
 *   - 8 $state sidebar inputs (founder-adjustable, pre-filled from session)
 *   - Session context ($state, read-only, set via initFromSession)
 *   - ALL computed values are $derived — pure reactive, no API calls
 *   - One master $derived (model) calls computeFullModel() → returns FinancialSummary
 *   - Validation results embedded in FinancialSummary.validations[]
 *
 * Non-negotiable rules (from Brain Build Instructions v2):
 *   - SDE label NEVER appears in exports — use 'takeHome' / 'ownerDraw'
 *   - Zero-loan edge case: DSCR = N/A (NaN), loan components = 0
 *   - Break-even searches months 1–36 only; if not found → null → 'Not within 3 years'
 *   - Reinvestment rate decreases Y1→Y5 (per-year from conceptKPIs.businessCase)
 *   - All dollar impact formulas in market events use founder's actual model variables
 *   - Foot traffic derivation is APPROXIMATE — flag and calibrate with real data
 */

import { CONCEPT_KPIS, type BusinessCaseParams } from '$lib/constants/conceptKPIs';
import { getConceptLabel } from '$lib/constants/concepts';
import { getConceptDefaults } from '$lib/constants/conceptDefaults';
// BR-L Vital Rules Registry — Rule 20 verdict moved to vital-rules.ts.
// The 60-month math loop below stays in this file (tightly coupled to the
// rent[] array), but the validation emit path calls RULES[20].check().
// BR-M: rule3RevPerSFFloor is the BC P&L gate consumer — triple-visible with
// Location IQ cap (unchanged) and Fit IQ kill-factor in scoring-utils.
// BR-M2: rule2RentEscalation is the BC P&L gate consumer for Rule 2, using
// the founder's actual escalationPct (not the hardcoded 3% Location IQ uses).
import { RULES as VITAL_RULES, rule3RevPerSFFloor, rule2RentEscalation } from '$lib/intel/vital-rules';
import { extractEditorialSignal, editorialScenarioBias } from '$lib/intel/editorial-signals';
// B3-2.3: Occupancy cost extras — CRT, BID, insurance, CAM
import {
  resolveBidAssessment,
  resolveInsuranceBenchmark,
  resolveCamEstimate,
} from '$lib/constants/occupancyExtras';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'WARNING' | 'FLAG' | 'BLOCK';

// ─────────────────────────────────────────────────────────────────────────────
// UX-FACING TYPES  (what page components import and render)
// Keep these aligned with component expectations — do not rename without
// updating BusinessCaseSidebar, SnapshotTab, StressTestTab, FullPictureTab.
// ─────────────────────────────────────────────────────────────────────────────

/** 5-year projection row — UX uses 'da' (not 'depreciation') and 'ownersDraw' */
export interface YearRow {
  year:        number;
  revenue:     number;
  cogs:        number;
  grossProfit: number;
  rent:        number;
  labor:       number;
  opex:        number;
  ebitda:      number;
  interest:    number;
  da:          number;       // depreciation & amortization
  netIncome:   number;
  ownersDraw:  number;       // NEVER labeled SDE in display
  dscr:        number;       // 0 if no loan (not NaN — safer for display)
}

/** Flat 3-column scenario row for the comparison table in Full Picture */
export interface ScenarioRow {
  label:        string;
  conservative: number | string;
  base:         number | string;
  optimistic:   number | string;
}

/** UX-facing financial model — returned by the API endpoint and the store's model getter */
export interface FinancialModel {
  // Tab 1: Snapshot
  breakEvenMonth:    number | null;
  cashNeeded:        number;
  takeHomeY1:        number;
  monthlyRows:       MonthlyProjectionRow[];
  startupCosts:      number;

  // Tab 2: Stress Test
  breakEvenPerHour:  number;
  breakEvenPerDay:   number;
  locationWizardPct: number;         // UX name for locationDeltaPct
  maxLoss:           number;         // total exposure (number, not object)
  maxLossBreakdown:  MaxLossBreakdown;
  sensitivityMonths: number;
  takeHomeY3:        number;
  valuationY5:       number;

  // Tab 3: Full Picture
  yearRows:          YearRow[];
  goNoGo:            'go' | 'no-go' | 'go-with-conditions';
  evidenceFor:       string[];
  evidenceAgainst:   string[];
  conditions:        string[];        // derived from GoNoGoCondition[].detail
  scenarios:         ScenarioRow[];   // flat table rows
  loanAmount:        number;
  loanMonthlyPayment: number;
  loanRate:          number;
  loanTermYears:     number;          // derived from loanTermMonths / 12
  gapToFund:         number;          // UX name for fundingGap
  validations:       ValidationResult[];
  // BC-04: Total Occupancy Cost breakdown
  // B3-2.3: Expanded occupancy breakdown — baseRent + tax + CRT + BID + insurance + CAM.
  occupancyCostBreakdown: {
    baseRent:      number;  // Monthly base rent
    taxPassThrough: number; // Monthly property tax pass-through
    crt:           number;  // Commercial Rent Tax (Manhattan <96th St, annualRent >$250K)
    bid:           number;  // BID assessment (% of annual rent ÷ 12)
    insurance:     number;  // Monthly insurance benchmark (concept-specific annual ÷ 12)
    cam:           number;  // Common Area Maintenance ($/SF/mo × squareFootage)
    total:         number;  // Sum of all above
    // Metadata for UX tooltips
    crtApplies:    boolean;
    bidName:       string | null;
    insuranceNote: string | null;
    camNote:       string | null;
  };
  isCoop:            boolean;
  // Wired April 9 — previously computed but not exposed to UX
  useOfFunds:        UseOfFunds;
  marketEvents:      MarketEvent[];
  totalInterest:     number;
}

/** Maps internal FinancialSummary → UX-facing FinancialModel */
export function mapToFinancialModel(s: FinancialSummary): FinancialModel {
  // goNoGo: map Brain strings → UX keys
  let goNoGo: FinancialModel['goNoGo'] = 'go-with-conditions';
  if      (s.goNoGo === 'GO — with conditions')             goNoGo = 'go';
  else if (s.goNoGo === 'NO-GO — here\'s why')              goNoGo = 'no-go';
  // 'GO — with significant conditions' → 'go-with-conditions' (covered by default)

  // yearRows: rename da/ownersDraw fields, guard NaN dscr
  const yearRows: YearRow[] = s.annualRows.map(r => ({
    year: r.year, revenue: r.revenue, cogs: r.cogs, grossProfit: r.grossProfit,
    rent: r.rent, labor: r.labor, opex: r.opex, ebitda: r.ebitda,
    interest: r.interest,
    da: r.depreciation,
    netIncome: r.netIncome,
    ownersDraw: r.ownerDraw,
    dscr: isNaN(r.dscr) ? 0 : r.dscr,
  }));

  // scenarios: flat ScenarioRow[] table for the 3-column display
  const fmtK = (n: number) =>
    Math.abs(n) >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` :
    Math.abs(n) >= 1_000     ? `$${Math.round(n/1_000)}K`       :
    `$${Math.round(n)}`;
  const bemStr = (m: number | null) => m != null ? `Month ${m}` : 'Not within 3yr';
  const scenarios: ScenarioRow[] = [
    {
      label: 'Year 1 Revenue',
      conservative: fmtK(s.scenarios.conservative.takeHomeY1 + s.scenarios.conservative.cashNeeded),
      base:         fmtK(s.annualRows[0]?.revenue ?? 0),
      optimistic:   fmtK(s.scenarios.optimistic.takeHomeY1  + s.scenarios.optimistic.cashNeeded),
    },
    {
      label: 'Take-Home Year 1',
      conservative: fmtK(s.scenarios.conservative.takeHomeY1),
      base:         fmtK(s.takeHomeY1),
      optimistic:   fmtK(s.scenarios.optimistic.takeHomeY1),
    },
    {
      label: 'Break-Even Month',
      conservative: bemStr(s.scenarios.conservative.breakEvenMonth),
      base:         bemStr(s.breakEvenMonth),
      optimistic:   bemStr(s.scenarios.optimistic.breakEvenMonth),
    },
    {
      label: 'Cash Needed',
      conservative: fmtK(s.scenarios.conservative.cashNeeded),
      base:         fmtK(s.cashNeeded),
      optimistic:   fmtK(s.scenarios.optimistic.cashNeeded),
    },
  ];

  // conditions: extract detail strings from GoNoGoCondition[]
  const conditions = s.conditions
    .filter(c => !c.passed)
    .map(c => c.detail);

  return {
    breakEvenMonth: s.breakEvenMonth,
    cashNeeded: s.cashNeeded,
    takeHomeY1: s.takeHomeY1,
    monthlyRows: s.monthlyRows,
    startupCosts: s.startupCosts,
    breakEvenPerHour: s.breakEvenPerHour,
    breakEvenPerDay: s.breakEvenPerDay,
    locationWizardPct: s.locationDeltaPct,
    maxLoss: s.maxLoss.total,
    maxLossBreakdown: s.maxLoss,
    sensitivityMonths: s.sensitivityMonths,
    takeHomeY3: s.takeHomeY3,
    valuationY5: s.valuationY5,
    yearRows, goNoGo, conditions, scenarios,
    evidenceFor: s.evidenceFor,
    evidenceAgainst: s.evidenceAgainst,
    loanAmount: s.loanAmount,
    loanMonthlyPayment: s.loanMonthlyPayment,
    loanRate: s.loanRate,
    loanTermYears: Math.round(s.loanTermMonths / 12),
    gapToFund: s.fundingGap,
    validations: s.validations,
    occupancyCostBreakdown: s.occupancyCostBreakdown,
    isCoop: s.isCoop,
    useOfFunds: s.useOfFunds,
    marketEvents: s.marketEvents,
    totalInterest: s.totalInterest,
  };
}

export interface ValidationResult {
  field:    string;
  severity: ValidationSeverity;
  message:  string;
  value:    number | string | null;
  range?:   string;
}

export interface MonthlyProjectionRow {
  month:        number;   // 1-60
  revenue:      number;
  cogs:         number;
  grossProfit:  number;
  labor:        number;
  rent:         number;
  opex:         number;
  ebitda:       number;
  interest:     number;
  depreciation: number;
  netIncome:    number;
  ownerDraw:    number;   // NEVER labeled 'SDE' in exports
  cashFlow:     number;   // monthly_revenue - monthly_costs
  cumulativeCF: number;   // running sum including startup cost offset
  dscr:         number;   // monthly DSCR (NaN if no loan)
}

export interface AnnualSummaryRow {
  year:         number;   // 1-5
  revenue:      number;
  cogs:         number;
  grossProfit:  number;
  labor:        number;
  rent:         number;
  opex:         number;
  ebitda:       number;
  interest:     number;
  depreciation: number;
  netIncome:    number;
  ownerDraw:    number;   // NEVER labeled 'SDE' in exports
  dscr:         number;   // NaN if no loan
}

export interface MaxLossBreakdown {
  equity:   number;   // personal investment
  pg:       number;   // personal guarantee exposure on remaining lease
  loans:    number;   // outstanding loan balance at month 24 (assumed failure point)
  buildout: number;   // unrecoverable buildout (buildoutCost * (1 - salvageRate))
  total:    number;
}

export interface UseOfFunds {
  buildout:         number;
  equipment:        number;
  deposit:          number;   // 2 months rent
  workingCapital:   number;   // negative burn through break-even
  permits:          number;
  initialInventory: number;
  contingency:      number;   // 10% of startup costs
  total:            number;
}

export interface GoNoGoCondition {
  id:     string;
  passed: boolean;
  label:  string;
  detail: string;   // uses founder's actual numbers
}

export interface ScenarioSummary {
  label:           'Conservative (−20%)' | 'Base' | 'Optimistic (+25%)';
  factor:          number;
  dailyCustomers:  number;
  avgTicket:       number;
  breakEvenMonth:  number | null;
  takeHomeY1:      number;
  takeHomeY3:      number;
  cashNeeded:      number;
  dscrY1:          number;
  editorialLabel:  string | null;  // B2-CARRY-2: "Rising editorial momentum (…)" or null
  editorialFactor: number;         // bias applied (0 = none)
}

export interface MarketEvent {
  id:           string;
  risk:         string;
  dollarImpact: number;
  impactLabel:  string;   // human-readable formula + result
  meaning:      string;
  action:       string;
  category:     'universal' | 'food' | 'fitness' | 'retail' | 'services';
}

export interface FinancialSummary {
  // ── Tab 1: Snapshot ────────────────────────────────────────────────────────
  breakEvenMonth:    number | null;   // null → 'Not within 3 years'
  cashNeeded:        number;
  takeHomeY1:        number;          // NEVER labeled SDE
  startupCosts:      number;
  negativeBurn:      number;          // cash needed beyond startup costs

  // ── Tab 2: Stress Test (V-shape arc: context → fear → agency → reward) ────
  costToOpen:        number;          // Stat 1 Context = startupCosts
  breakEvenPerHour:  number;          // Stat 2 Reality Check — footfalls/hr needed
  breakEvenPerDay:   number;          // Stat 2 — daily total
  footfallUnit:      string;          // concept-specific label from businessCase
  locationDeltaPct:  number;          // Stat 3 Location Wizard — % above/below breakeven
  maxLoss:           MaxLossBreakdown;// Stat 4 THE TROUGH — peak fear
  sensitivityMonths: number | null;   // Stat 5 Agency — months before cash runs out at −20%. NULL = runway covered (infinite).
  takeHomeY3:        number;          // Stat 6 Recovery
  valuationY5:       number;          // Stat 7 THE CLOSER — business worth at exit

  // ── Tab 3: Full Picture ────────────────────────────────────────────────────
  dscrByYear:    number[];            // [Y1..Y5], NaN if loanAmount = 0
  goNoGo:        'GO — with conditions' | 'GO — with significant conditions' | 'NO-GO — here\'s why';
  passedCount:   number;
  conditions:    GoNoGoCondition[];   // 5 conditions, each with pass/fail + detail
  evidenceFor:   string[];
  evidenceAgainst: string[];
  scenarios:     { conservative: ScenarioSummary; base: ScenarioSummary; optimistic: ScenarioSummary };
  monthlyRows:   MonthlyProjectionRow[];  // 60 rows
  annualRows:    AnnualSummaryRow[];      // 5 rows
  useOfFunds:    UseOfFunds;
  loanAmount:    number;
  loanMonthlyPayment: number;
  loanRate:      number;              // annual %
  loanTermMonths: number;
  totalInterest: number;
  fundingGap:    number;              // MAX(0, cashNeeded - personalInvestment - loanAmount)
  marketEvents:  MarketEvent[];
  validations:   ValidationResult[];
  // BC-04: Total Occupancy Cost breakdown
  // B3-2.3: Expanded occupancy breakdown — baseRent + tax + CRT + BID + insurance + CAM.
  occupancyCostBreakdown: {
    baseRent:      number;  // Monthly base rent
    taxPassThrough: number; // Monthly property tax pass-through
    crt:           number;  // Commercial Rent Tax (Manhattan <96th St, annualRent >$250K)
    bid:           number;  // BID assessment (% of annual rent ÷ 12)
    insurance:     number;  // Monthly insurance benchmark (concept-specific annual ÷ 12)
    cam:           number;  // Common Area Maintenance ($/SF/mo × squareFootage)
    total:         number;  // Sum of all above
    // Metadata for UX tooltips
    crtApplies:    boolean;
    bidName:       string | null;
    insuranceNote: string | null;
    camNote:       string | null;
  };
  isCoop: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS (no Svelte — safe to call from $derived)
// ─────────────────────────────────────────────────────────────────────────────

/** Monthly loan payment (standard amortization). Returns 0 if P or r is 0. */
function calcMonthlyPayment(P: number, annualRatePct: number, termMonths: number): number {
  if (P <= 0 || termMonths <= 0) return 0;
  if (annualRatePct <= 0) return P / termMonths;
  const r = annualRatePct / 100 / 12;
  return P * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

/** Remaining loan balance at end of month m (1-indexed). */
function calcRemainingBalance(P: number, annualRatePct: number, termMonths: number, m: number): number {
  if (P <= 0 || termMonths <= 0) return 0;
  if (annualRatePct <= 0) return Math.max(0, P - (P / termMonths) * m);
  const r = annualRatePct / 100 / 12;
  const n = termMonths;
  return P * (Math.pow(1 + r, n) - Math.pow(1 + r, m)) / (Math.pow(1 + r, n) - 1);
}

/** Interest portion of payment at month m. */
function calcInterestAtMonth(P: number, annualRatePct: number, termMonths: number, m: number): number {
  if (P <= 0 || annualRatePct <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const bal = calcRemainingBalance(P, annualRatePct, termMonths, m - 1);
  return bal * r;
}

/** Monthly ramp factor for month m (1-indexed). Uses last value if beyond array. */
function getRampFactor(rampFactors: number[], m: number): number {
  return rampFactors[Math.min(m - 1, rampFactors.length - 1)] ?? 1.0;
}

/**
 * COGS maturity curve: M1 = 1.15 (wastage + overordering), tapering to 1.00 by M12.
 * Accounts for startup wastage and vendor relationship learning curve.
 */
function getMaturityCurve(m: number): number {
  if (m >= 12) return 1.0;
  return 1.15 - (0.15 * (m - 1) / 11);
}

/**
 * Labor efficiency curve: M1 = 1.20 (training overhead), tapering to 1.00 by M6.
 * Accounts for onboarding + early scheduling inefficiencies.
 */
function getLaborEfficiency(m: number): number {
  if (m >= 6) return 1.0;
  return 1.20 - (0.20 * (m - 1) / 5);
}

/** Credit score → loan rate tier (SBA 7(a) base rates). */
function creditScoreToRate(creditScore: string): number {
  switch (creditScore) {
    case 'excellent': return 8.5;
    case 'good':      return 9.5;
    case 'fair':      return 10.5;
    case 'building':  return 12.0;
    default:          return 10.5;  // unknown
  }
}

/** Concept key → hourly labor rate (NYC minimum + concept premium). */
function getHourlyLaborRate(conceptKey: string): number {
  const rates: Record<string, number> = {
    specialty_coffee:        18,
    bakery:                  19,
    fast_casual:             19,
    qsr:                     18,
    full_service_restaurant: 21,
    bar_nightlife:           22,
    juice_bar:               18,
    wellness_beverage:       18,
    retail:                  18,
    fitness_studio:          20,
    personal_services:       22,
    medical_office:          25,
    florist:                 19,
    wellness_spa:            22,
    coworking:               22,
  };
  return rates[conceptKey] ?? 20;
}

/** Concept key → default monthly opex (utilities + insurance + marketing + misc). */
function getDefaultMonthlyOpex(conceptKey: string): number {
  const opex: Record<string, number> = {
    specialty_coffee:        5_500,
    bakery:                  5_000,
    fast_casual:             6_000,
    qsr:                     5_500,
    full_service_restaurant: 7_500,
    bar_nightlife:           7_000,
    juice_bar:               4_500,
    wellness_beverage:       4_500,
    retail:                  4_000,
    fitness_studio:          5_500,
    personal_services:       3_500,
    medical_office:          6_000,
    florist:                 3_000,
    wellness_spa:            4_500,
    coworking:               6_000,
  };
  return opex[conceptKey] ?? 5_000;
}

/** Concept key → market event category. */
function getEventCategory(conceptKey: string): 'food' | 'fitness' | 'retail' | 'services' {
  const map: Record<string, 'food' | 'fitness' | 'retail' | 'services'> = {
    specialty_coffee:        'food',
    bakery:                  'food',
    fast_casual:             'food',
    qsr:                     'food',
    full_service_restaurant: 'food',
    bar_nightlife:           'food',
    juice_bar:               'food',
    wellness_beverage:       'food',
    retail:                  'retail',
    fitness_studio:          'fitness',
    personal_services:       'services',
    medical_office:          'services',
    florist:                 'retail',
    wellness_spa:            'services',
    coworking:               'services',
  };
  return map[conceptKey] ?? 'food';
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE ENGINE — computeFullModel()
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelInputs {
  // Sidebar $state
  dailyCustomers:   number;
  avgTicket:        number;
  cogsPercent:      number;   // 0-100 (percentage, not decimal)
  fullTimeStaff:    number;
  fullTimeRate:     number;   // $/hr — founder-adjustable
  partTimeStaff:    number;
  partTimeRate:     number;   // $/hr — founder-adjustable
  monthlyRent:      number;
  monthlyOpEx:      number;
  daysPerWeek:      number;
  // Session context
  conceptKey:       string;
  transitScore:     number;
  vibrancyScore:    number;
  personalInvestment: number;
  startupCapital:   number;
  creditScore:      string;
  squareFootage:    number;
  hasPersonalGuarantee: boolean;
  loanAmount:       number;
  loanTermYears:    number;
  loanRate:         number;   // annual %, 0 = auto from creditScore
  // BC-01/02/03: DOF property tax data (optional — default 0/false)
  monthlyTaxPassThrough: number;  // BC-01: monthly tax pass-through from PropertyTaxProfile
  taxEscalationAnnual:   number;  // BC-02: annual tax escalation rate (e.g. 0.05 = 5%)
  isCoop:                boolean; // BC-03: coop unit → no lease deposit, no PG exposure
  // ── VITAL RULE 20: Percentage Rent Clause (optional — default 0 = no clause) ──
  // Retail-style lease term: tenant pays base rent + X% of gross sales above an
  // annual breakpoint. Brain models this as a year-end true-up added to Dec of
  // each year so DSCR, cashflow, and break-even all reflect the real cost.
  percentageRentRate:         number; // e.g. 0.06 = 6% of overage. 0 disables.
  percentageRentBreakpoint:   number; // annual gross sales $ above which overage kicks in. 0 disables.
  // ── BR-B' (April 11, 2026): Lease escalation rate ──
  // Annual base-rent escalation as a decimal. 0.03 = 3%. When 0 is passed, the
  // 60-month loop falls back to the concept's `bc.defaultRentEscalation` so
  // existing behavior is preserved for callers that don't supply the field.
  // Valid range 0..0.15; values above 0.15 are clamped in the loop.
  escalationPct:              number;
  // B3-2.3: Optional geo context for CRT + BID + CAM calculation.
  // address → BID lookup (resolveBidAssessment substring match).
  // lat → CRT zone check (≤ 40.7838 = south of 96th St in Manhattan).
  // bldgClass → CAM estimate (PLUTO first-letter major class).
  analysisAddress?:           string;
  lat?:                       number;
  bldgClass?:                 string;
}

export function computeFullModel(inp: ModelInputs): FinancialSummary {
  const kpi = CONCEPT_KPIS[inp.conceptKey] ?? CONCEPT_KPIS['specialty_coffee'];
  const bc: BusinessCaseParams = kpi.businessCase ?? {
    // Safe fallback (should never hit if conceptKPIs.ts is complete)
    buildoutCost: 150_000, equipmentCost: 75_000, initialInventory: 8_000,
    permitsCost: 15_000, operatingHoursPerDay: 14, captureRate: 0.06,
    salvageRate: 0.15, valuationMultiple: 2.5,
    reinvestmentRate: { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
    usefulLifeYears: 10, footfallUnit: 'customers', defaultLeaseTermYears: 10,
    defaultRentEscalation: 0.03,
    rampFactors: [0.45,0.52,0.58,0.63,0.68,0.72,0.76,0.80,0.84,0.87,0.91,0.95,0.97,0.99,1.00,1.01,1.02,1.03,1.05,1.06,1.07,1.08,1.09,1.10],
  };

  // ── Intermediate inputs ──────────────────────────────────────────────────

  const operatingDaysPerMonth  = inp.daysPerWeek * 4.33 * 0.95;       // 0.95 for holidays
  const operatingHoursPerDay   = bc.operatingHoursPerDay;
  // Use founder's slider rates when provided; fall back to concept-based defaults
  const ftRate                 = inp.fullTimeRate  > 0 ? inp.fullTimeRate  : getHourlyLaborRate(inp.conceptKey);
  const ptRate                 = inp.partTimeRate  > 0 ? inp.partTimeRate  : Math.max(15, ftRate - 3);
  const monthlyLaborCost       = (inp.fullTimeStaff  * ftRate * 40 * 4.33)
                               + (inp.partTimeStaff  * ptRate * 20 * 4.33);

  // Effective loan rate: use provided if > 0, else derive from credit score
  const effectiveLoanRate    = inp.loanRate > 0 ? inp.loanRate : creditScoreToRate(inp.creditScore);
  const loanTermMonths       = inp.loanTermYears * 12;
  const loanMonthlyPayment   = calcMonthlyPayment(inp.loanAmount, effectiveLoanRate, loanTermMonths);
  const totalInterest        = inp.loanAmount > 0 ? (loanMonthlyPayment * loanTermMonths) - inp.loanAmount : 0;

  // Foot traffic derivation (APPROXIMATE — calibrate with SafeGraph/Replica data when available)
  const baseDailyTraffic     = (inp.transitScore * 3) + (inp.vibrancyScore * 2);  // range ~0–500
  const hourlyFootTraffic    = baseDailyTraffic / Math.max(operatingHoursPerDay, 1);

  // Startup costs
  const buildoutCost         = bc.buildoutCost;
  const equipmentCost        = bc.equipmentCost;
  // BC-03: Coop units have no lease → no security deposit, no personal guarantee exposure
  const depositCost          = inp.isCoop ? 0 : inp.monthlyRent * 2;  // standard NYC 2-month security
  const permitsCost          = bc.permitsCost;
  const initialInventory     = bc.initialInventory;
  const startupCosts         = buildoutCost + equipmentCost + depositCost + permitsCost + initialInventory;
  const contingency          = startupCosts * 0.10;

  const monthlyDepreciation  = buildoutCost / (bc.usefulLifeYears * 12);
  const cogsDecimal          = inp.cogsPercent / 100;

  // ── Build 60-month arrays ─────────────────────────────────────────────────

  const revenue:     number[] = [];
  const cogs:        number[] = [];
  const labor:       number[] = [];
  const rent:        number[] = [];
  const opex:        number[] = [];
  const totalCosts:  number[] = [];
  const cashFlow:    number[] = [];
  const cumCF:       number[] = [];
  const interest:    number[] = [];

  // ── VITAL RULE 20 scratch state ──
  // Running year-to-date revenue for percentage rent true-up. Resets each year.
  // Percentage rent is charged as a single Dec true-up so the lumpy cash impact
  // shows up in break-even, DSCR, and cashflow exactly when the landlord bills it.
  const pctRate   = Math.max(0, inp.percentageRentRate || 0);
  const pctBreak  = Math.max(0, inp.percentageRentBreakpoint || 0);
  const hasPctRent = pctRate > 0 && pctBreak > 0;
  // Per-year overage amounts so validations can cite specific years without
  // re-walking the arrays. Index 0 = Year 1.
  const pctRentByYear: number[] = [0, 0, 0, 0, 0];
  let yearToDateRev = 0;

  // ── BR-B': Effective rent escalation ──
  // User-supplied `inp.escalationPct` wins over the concept default when > 0.
  // Clamp to 0..0.15 to protect against fat-finger inputs. Falling back to
  // `bc.defaultRentEscalation` preserves pre-BR-B' behavior for any caller
  // that passes 0 (which is what the sidebar defaults to until the user
  // opens the Lease Terms section).
  const effectiveEscalation = inp.escalationPct > 0
    ? Math.min(0.15, inp.escalationPct)
    : bc.defaultRentEscalation;

  for (let i = 0; i < 60; i++) {
    const m              = i + 1;                                  // 1-indexed month
    const yearIdx        = Math.floor(i / 12);                     // 0-4
    const monthOfYear    = i % 12;                                 // 0 = Jan, 11 = Dec
    const ramp           = getRampFactor(bc.rampFactors, m);
    const maturity       = getMaturityCurve(m);
    const laborEff       = getLaborEfficiency(m);
    const rentEscFactor  = Math.pow(1 + effectiveEscalation, yearIdx);
    const opexInflFactor = Math.pow(1.02, yearIdx);

    const rev   = inp.dailyCustomers * inp.avgTicket * operatingDaysPerMonth * ramp;
    const cg    = rev * cogsDecimal * maturity;
    const lab   = monthlyLaborCost * laborEff;
    const baseRnt = inp.monthlyRent * rentEscFactor;
    const opx   = inp.monthlyOpEx * opexInflFactor;
    const intr  = calcInterestAtMonth(inp.loanAmount, effectiveLoanRate, loanTermMonths, m);
    // BC-01/02: Tax pass-through escalates at its own rate (separate from lease escalation)
    const taxEscFactor = Math.pow(1 + (inp.taxEscalationAnnual || 0), yearIdx);
    const tp    = (inp.monthlyTaxPassThrough || 0) * taxEscFactor;

    // ── VITAL RULE 20: Percentage Rent year-end true-up ──
    // Running revenue totals in the current lease year. At Dec (monthOfYear=11),
    // if YTD revenue exceeds the annual breakpoint, add (overage × rate) to rent
    // for that single month. This matches how commercial landlords bill — a
    // lumpy Dec true-up, not a smeared monthly addition.
    yearToDateRev += rev;
    let pctRentThisMonth = 0;
    if (hasPctRent && monthOfYear === 11) {
      const overage = Math.max(0, yearToDateRev - pctBreak);
      pctRentThisMonth = overage * pctRate;
      if (yearIdx < 5) pctRentByYear[yearIdx] = pctRentThisMonth;
      yearToDateRev = 0; // reset for next year
    }

    const rnt   = baseRnt + pctRentThisMonth;
    const costs = cg + lab + rnt + tp + opx + loanMonthlyPayment;
    const cf    = rev - costs;

    revenue.push(rev);
    cogs.push(cg);
    labor.push(lab);
    rent.push(rnt + tp);   // rent line = base rent + percentage rent + tax pass-through
    opex.push(opx);
    totalCosts.push(costs);
    cashFlow.push(cf);
    interest.push(intr);
    cumCF.push(i === 0 ? cf - startupCosts : (cumCF[i - 1] ?? 0) + cf);
  }

  // ── Tab 1: Snapshot ───────────────────────────────────────────────────────

  // Break-even month: first month (1-36) where monthly cash flow > 0
  let breakEvenMonth: number | null = null;
  for (let i = 0; i < 36; i++) {
    if ((cashFlow[i] ?? 0) > 0) { breakEvenMonth = i + 1; break; }
  }

  // Negative burn = sum of all negative cash flows from M1 to break-even
  let negativeBurn = 0;
  const bem = breakEvenMonth ?? 36;
  for (let i = 0; i < bem; i++) {
    if ((cashFlow[i] ?? 0) < 0) negativeBurn += Math.abs(cashFlow[i] ?? 0);
  }

  const cashNeeded = startupCosts + negativeBurn;

  // Owner take-home Y1 (NEVER labeled SDE)
  const annRevY1   = revenue.slice(0, 12).reduce((s, v) => s + v, 0);
  const annCostY1  = totalCosts.slice(0, 12).reduce((s, v) => s + v, 0);
  const reinvY1    = annRevY1 * bc.reinvestmentRate.y1;
  const takeHomeY1 = annRevY1 - annCostY1 - reinvY1;

  // ── Tab 2: Stress Test ────────────────────────────────────────────────────

  // Stat 1: Cost to open = startupCosts (bridge to cashNeeded in UX)
  // D6: Hero "Money to Open the Doors" now includes 10% contingency so the hero
  // matches the breakdown table total. Previously the table showed $287K
  // (startup + working capital + contingency) while the hero showed $258K
  // (startup only). Working capital is displayed separately as "Total Cash You'll Need".
  const costToOpen = startupCosts + contingency;

  // Stat 2: Breakeven footfalls
  const monthlyBERevenue   = totalCosts[11] ?? 0;                // M12 steady-state proxy
  const dailyBERevenue     = monthlyBERevenue / Math.max(operatingDaysPerMonth, 1);
  const hourlyBERevenue    = dailyBERevenue / Math.max(operatingHoursPerDay, 1);
  const breakEvenPerHour   = Math.ceil(hourlyBERevenue / Math.max(inp.avgTicket, 0.01));
  const breakEvenPerDay    = breakEvenPerHour * operatingHoursPerDay;

  // Stat 3: Location wizard — delta between PLAN and break-even requirement.
  // D9: Previous formula used `hourlyFootTraffic * captureRate` (transit*3 + vibrancy*2
  // divided by hours, then 6% capture) which severely underestimates NYC foot traffic
  // and produced false "-87%" deltas that contradicted the profitable revenue model.
  // Now compares the user's planned dailyCustomers to break-even so the metric is
  // self-consistent with the profit projection: positive delta = plan beats break-even.
  const plannedHourlyCusts = inp.dailyCustomers / Math.max(operatingHoursPerDay, 1);
  const locationDeltaPct   = breakEvenPerHour > 0
    ? ((plannedHourlyCusts - breakEvenPerHour) / breakEvenPerHour) * 100
    : 0;

  // Stat 4: Max loss breakdown
  const remainingLeaseMonths  = (bc.defaultLeaseTermYears * 12) - 24; // assume failure at Y2
  // BC-03: Coop units have no lease → zero PG exposure regardless of hasPersonalGuarantee flag
  const pgExposure            = (inp.isCoop || !inp.hasPersonalGuarantee)
    ? 0
    : Math.max(0, remainingLeaseMonths) * inp.monthlyRent;
  const loanBalAtM24          = calcRemainingBalance(inp.loanAmount, effectiveLoanRate, loanTermMonths, 24);
  const unrecoverableBuildout = buildoutCost * (1 - bc.salvageRate);
  const maxLoss: MaxLossBreakdown = {
    equity:   inp.personalInvestment,
    pg:       pgExposure,
    loans:    loanBalAtM24,
    buildout: unrecoverableBuildout,
    total:    inp.personalInvestment + pgExposure + loanBalAtM24 + unrecoverableBuildout,
  };

  // Stat 5: Sensitivity months (20% revenue stress — how long until cash runs out)
  // D7: Track REAL cash balance over time, not just cumulative loss.
  // Previous logic only summed negative months without crediting positive months back,
  // producing "1 month" runway even when the business becomes profitable after ramp.
  // That contradicted the "stay above zero" steady-state message in StressTestTab.
  const remainingCash = negativeBurn;  // cash buffer after startup, before break-even
  // B3-1.2: If cash balance stays positive across all 60 stressed months,
  // return sensitivityMonths = null (runway is "infinite" under this stress).
  // This resolves the D7 contradiction: previously we returned 60 in both
  // "Dangerous" territory and "survives 5+ years" territory, so the UX
  // couldn't distinguish "cash runs out month 60" from "never runs out".
  let sensitivityMonths: number | null = null;
  let cashBalance = remainingCash;
  for (let i = 0; i < 60; i++) {
    const stressedCF = (revenue[i] ?? 0) * 0.80 - (totalCosts[i] ?? 0);
    cashBalance += stressedCF;
    if (cashBalance < 0) { sensitivityMonths = i + 1; break; }
  }

  // Stat 6: Owner take-home Y3
  const annRevY3   = revenue.slice(24, 36).reduce((s, v) => s + v, 0);
  const annCostY3  = totalCosts.slice(24, 36).reduce((s, v) => s + v, 0);
  const reinvY3    = annRevY3 * bc.reinvestmentRate.y3;
  const takeHomeY3 = annRevY3 - annCostY3 - reinvY3;

  // Stat 7: Business valuation Y5 (THE CLOSER)
  const annRevY5   = revenue.slice(48, 60).reduce((s, v) => s + v, 0);
  const annCostY5  = totalCosts.slice(48, 60).reduce((s, v) => s + v, 0);
  const takeHomeY5 = annRevY5 - annCostY5;
  const annualDepr = buildoutCost / bc.usefulLifeYears;
  const sdeY5      = takeHomeY5 + annualDepr;  // add back depreciation (conservative — no owner perks)
  const valuationY5 = sdeY5 * bc.valuationMultiple;

  // ── Tab 3: Full Picture ───────────────────────────────────────────────────

  // DSCR by year
  const annDebtService = loanMonthlyPayment * 12;
  const dscrByYear: number[] = [1, 2, 3, 4, 5].map(yr => {
    if (inp.loanAmount <= 0) return NaN;
    const start = (yr - 1) * 12;
    const annRev         = revenue.slice(start, start + 12).reduce((s, v) => s + v, 0);
    const annCogs        = cogs.slice(start, start + 12).reduce((s, v) => s + v, 0);
    const annLab         = labor.slice(start, start + 12).reduce((s, v) => s + v, 0);
    const annRnt         = rent.slice(start, start + 12).reduce((s, v) => s + v, 0);
    const annOpx         = opex.slice(start, start + 12).reduce((s, v) => s + v, 0);
    // D8: Variable is named annNetIncome but is actually EBITDA (pre-D&A, pre-interest).
    // Standard DSCR = EBITDA / Debt Service. Adding annualDepr back in double-counts
    // since EBITDA already excludes depreciation. This produced the 6.31x-in-evidence
    // vs 5.67x-in-gauge mismatch (evidenceFor reads dscrByYear, gauge reads annualRows).
    const annEbitda = annRev - annCogs - annLab - annRnt - annOpx;
    return annEbitda / Math.max(annDebtService, 1);
  });

  // Go/No-Go conditions
  // B3-1.4: Removed c4_location (customer-rate vs breakeven) per Option A —
  // it compared Concept Pulse foot-traffic INDEX (0-100) against breakeven
  // units/MONTH, which is apples-to-oranges. Re-introduce once Placer.ai
  // daily-customer estimates are available.
  const cond1 = inp.loanAmount <= 0 || (dscrByYear[0] ?? 0) >= 1.15;
  const cond2 = breakEvenMonth !== null && breakEvenMonth <= 18;
  const cond3 = takeHomeY1 > 0;
  // B3-1.2: null = runway covered (infinite) — treat as passing
  const cond5 = sensitivityMonths === null || sensitivityMonths >= 3;

  const beMonthDisplay = breakEvenMonth ? `Month ${breakEvenMonth}` : 'not within 3 years';
  const dscrY1Display  = isNaN(dscrByYear[0] ?? NaN) ? 'N/A (no loan)' : `${(dscrByYear[0] ?? 0).toFixed(2)}x`;
  const fmt = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`;

  const conditions: GoNoGoCondition[] = [
    {
      id:     'c1_dscr',
      passed: cond1,
      label:  'Debt service coverage',
      detail: inp.loanAmount <= 0
        ? 'Self-funded — no debt service required'
        : `DSCR Year 1 is ${dscrY1Display} (SBA minimum: 1.15x)`,
    },
    {
      id:     'c2_breakeven',
      passed: cond2,
      label:  'Break-even timeline',
      detail: `Break-even is ${beMonthDisplay} (target: within 18 months)`,
    },
    {
      id:     'c3_takehome',
      passed: cond3,
      label:  'Year 1 owner income',
      detail: takeHomeY1 > 0
        ? `Year 1 take-home is ${fmt(takeHomeY1)} (positive)`
        : `Year 1 take-home is −${fmt(takeHomeY1)} (still in the hole)`,
    },
    // B3-1.4: c4_location removed — see comment above cond1 block.
    {
      id:     'c5_sensitivity',
      passed: cond5,
      label:  'Stress-test survivability',
detail: sensitivityMonths === null
        ? 'Runway covered — positive cashflow even under 20% revenue stress'
        : sensitivityMonths >= 60
          ? 'Survives 5+ years under 20% revenue stress'
          : `Cash runs out in ${sensitivityMonths} ${sensitivityMonths === 1 ? 'month' : 'months'} under 20% revenue stress`,
    },
  ];

  const passedCount    = conditions.filter(c => c.passed).length;
  const evidenceFor    = conditions.filter(c => c.passed).map(c => c.detail);
  const evidenceAgainst = conditions.filter(c => !c.passed).map(c => c.detail);

  let goNoGo: FinancialSummary['goNoGo'];
  // B3-1.4: Max passedCount now 4 (was 5) since c4_location was removed.
  if (passedCount === 4)      goNoGo = 'GO — with conditions';
  else if (passedCount >= 2)  goNoGo = 'GO — with significant conditions';
  else                        goNoGo = 'NO-GO — here\'s why';

  // B2-CARRY-2: editorial bias (computed once, applied to optimistic only)
  const _editSig  = extractEditorialSignal(inp.analysisAddress || '', inp.conceptKey);
  const _editBias = editorialScenarioBias(_editSig);

  // Scenario analysis
  function computeScenario(
    factor: number,
    label: ScenarioSummary['label'],
    editFactor = 0,
    editLabel: string | null = null,
  ): ScenarioSummary {
    const adjustedFactor = factor * (1 + editFactor);
    const ticketFactor = adjustedFactor < 1 ? 0.95 : 1.05;
    const sDC = inp.dailyCustomers * adjustedFactor;
    const sAT = inp.avgTicket * ticketFactor;
    const sRevenue: number[] = [];
    const sCosts:   number[] = [];
    const sCF:      number[] = [];
    for (let i = 0; i < 60; i++) {
      const m   = i + 1;
      const r   = getRampFactor(bc.rampFactors, m);
      const rev = sDC * sAT * operatingDaysPerMonth * r;
      const cg  = rev * cogsDecimal * getMaturityCurve(m);
      const lab = monthlyLaborCost * getLaborEfficiency(m);
      const rnt = inp.monthlyRent * Math.pow(1 + bc.defaultRentEscalation, Math.floor(i / 12));
      const opx = inp.monthlyOpEx * Math.pow(1.02, Math.floor(i / 12));
      sRevenue.push(rev);
      const cost = cg + lab + rnt + opx + loanMonthlyPayment;
      sCosts.push(cost);
      sCF.push(rev - cost);
    }
    let sBEM: number | null = null;
    for (let i = 0; i < 36; i++) { if ((sCF[i] ?? 0) > 0) { sBEM = i + 1; break; } }
    let sNegBurn = 0;
    for (let i = 0; i < (sBEM ?? 36); i++) { if ((sCF[i] ?? 0) < 0) sNegBurn += Math.abs(sCF[i] ?? 0); }
    const sCashNeeded   = startupCosts + sNegBurn;
    const sAnnRevY1     = sRevenue.slice(0, 12).reduce((s, v) => s + v, 0);
    const sAnnCostY1    = sCosts.slice(0, 12).reduce((s, v) => s + v, 0);
    const sTakeHomeY1   = sAnnRevY1 - sAnnCostY1 - sAnnRevY1 * bc.reinvestmentRate.y1;
    const sAnnRevY3     = sRevenue.slice(24, 36).reduce((s, v) => s + v, 0);
    const sAnnCostY3    = sCosts.slice(24, 36).reduce((s, v) => s + v, 0);
    const sTakeHomeY3   = sAnnRevY3 - sAnnCostY3 - sAnnRevY3 * bc.reinvestmentRate.y3;
    let sDscr1 = NaN;
    if (inp.loanAmount > 0) {
      const sRevY1 = sRevenue.slice(0, 12).reduce((s, v) => s + v, 0);
      const sCgY1  = sRevY1 * cogsDecimal;
      const sLabY1 = labor.slice(0, 12).reduce((s, v) => s + v, 0); // labor unchanged
      const sRntY1 = rent.slice(0, 12).reduce((s, v) => s + v, 0);
      const sOpxY1 = opex.slice(0, 12).reduce((s, v) => s + v, 0);
      // D8: Same EBITDA/DS correction — the variable named sNI is actually EBITDA
      const sEbitda = sRevY1 - sCgY1 - sLabY1 - sRntY1 - sOpxY1;
      sDscr1 = sEbitda / Math.max(annDebtService, 1);
    }
    return { label, factor: adjustedFactor, dailyCustomers: sDC, avgTicket: sAT, breakEvenMonth: sBEM,
      takeHomeY1: sTakeHomeY1, takeHomeY3: sTakeHomeY3, cashNeeded: sCashNeeded, dscrY1: sDscr1,
      editorialLabel: editLabel, editorialFactor: editFactor };
  }

  const scenarios = {
    conservative: computeScenario(0.80, 'Conservative (−20%)'),
    base:         computeScenario(1.00, 'Base'),
    optimistic:   computeScenario(1.25, 'Optimistic (+25%)', _editBias.factor, _editBias.label),
  };

  // 60-month projection rows
  const monthlyRows: MonthlyProjectionRow[] = revenue.map((rev, i) => {
    const m        = i + 1;
    const yr       = Math.floor(i / 12);
    const rRate    = bc.reinvestmentRate[`y${yr + 1}` as keyof typeof bc.reinvestmentRate] ?? 0.03;
    const grossP   = rev - (cogs[i] ?? 0);
    const ebitda   = grossP - (labor[i] ?? 0) - (rent[i] ?? 0) - (opex[i] ?? 0);
    const intr     = interest[i] ?? 0;
    const netInc   = ebitda - intr - monthlyDepreciation;
    const draw     = Math.max(0, netInc * (1 - rRate));
    const dscr     = inp.loanAmount > 0 && loanMonthlyPayment > 0
      ? (netInc + intr + monthlyDepreciation) / loanMonthlyPayment
      : NaN;
    return {
      month: m, revenue: rev, cogs: cogs[i] ?? 0, grossProfit: grossP,
      labor: labor[i] ?? 0, rent: rent[i] ?? 0, opex: opex[i] ?? 0,
      ebitda, interest: intr, depreciation: monthlyDepreciation, netIncome: netInc,
      ownerDraw: draw, cashFlow: cashFlow[i] ?? 0, cumulativeCF: cumCF[i] ?? 0, dscr,
    };
  });

  // Annual aggregates
  const annualRows: AnnualSummaryRow[] = [1, 2, 3, 4, 5].map(yr => {
    const rows  = monthlyRows.slice((yr - 1) * 12, yr * 12);
    const sum   = (key: keyof MonthlyProjectionRow) =>
      rows.reduce((s, r) => s + (r[key] as number), 0);
    const rRate = bc.reinvestmentRate[`y${yr}` as keyof typeof bc.reinvestmentRate] ?? 0.03;
    const annNI = sum('netIncome');
    const draw  = Math.max(0, annNI * (1 - rRate));
    const dscr  = inp.loanAmount > 0 && annDebtService > 0
      ? (sum('netIncome') + sum('interest') + sum('depreciation')) / annDebtService
      : NaN;
    return {
      year: yr, revenue: sum('revenue'), cogs: sum('cogs'),
      grossProfit: sum('grossProfit'), labor: sum('labor'), rent: sum('rent'),
      opex: sum('opex'), ebitda: sum('ebitda'), interest: sum('interest'),
      depreciation: sum('depreciation'), netIncome: annNI, ownerDraw: draw, dscr,
    };
  });

  // Use of funds
  // D6: "Total" now matches hero (Money to Open) — startupCosts + contingency.
  // Working capital is tracked separately but excluded from startup total to
  // prevent the hero/breakdown mismatch. Working capital is surfaced via the
  // separate "Total Cash You'll Need" hero cell.
  const useOfFunds: UseOfFunds = {
    buildout:         buildoutCost,
    equipment:        equipmentCost,
    deposit:          depositCost,
    workingCapital:   negativeBurn,
    permits:          permitsCost,
    initialInventory: initialInventory,
    contingency:      contingency,
    total:            startupCosts + contingency,
  };

  // Funding gap
  const fundingGap = Math.max(0, cashNeeded - inp.personalInvestment - inp.loanAmount);

  // BC-04 / B3-2.3: Expanded occupancy cost breakdown at M1.
  // Now includes CRT, BID assessment, insurance benchmark, and CAM estimate
  // alongside the existing base rent + tax pass-through.
  const taxPtM1 = inp.monthlyTaxPassThrough;  // M1 is year 0, no escalation yet

  // ── CRT (Commercial Rent Tax) ──────────────────────────────────────────────
  // Applies when: Manhattan location AND lat ≤ 40.7838 (south of 96th St)
  // AND annual base rent > $250,000. Rate: 3.9% of base rent.
  // Landlords typically don't disclose this — it's the tenant's liability.
  const annualBaseRent = inp.monthlyRent * 12;
  const isManhattanAddress = (inp.analysisAddress || '').toLowerCase().includes('manhattan')
    || (inp.analysisAddress || '').toLowerCase().includes(', ny 100')  // ZIP 10001–10099
    || (inp.analysisAddress || '').toLowerCase().includes(', ny 101'); // ZIP 10100–10199
  const isSouthOf96th = typeof inp.lat === 'number' ? inp.lat <= 40.7838 : true; // default true (conservative)
  const CRT_RATE = 0.039;
  const CRT_RENT_FLOOR = 250_000;
  const crtApplies = isManhattanAddress && isSouthOf96th && annualBaseRent > CRT_RENT_FLOOR;
  const monthlyCrt = crtApplies ? Math.round(inp.monthlyRent * CRT_RATE) : 0;

  // ── BID Assessment ─────────────────────────────────────────────────────────
  // Resolved by substring-matching the analysis address against the BID registry.
  const bidMatch = resolveBidAssessment(inp.analysisAddress);
  const monthlyBid = bidMatch
    ? Math.round((annualBaseRent * bidMatch.rateOfBaseRent) / 12)
    : 0;

  // ── Insurance ──────────────────────────────────────────────────────────────
  // Per-concept annual premium benchmark ÷ 12 for a monthly figure.
  const insuranceBenchmark = resolveInsuranceBenchmark(inp.conceptKey);
  const monthlyInsurance = insuranceBenchmark
    ? Math.round(insuranceBenchmark.annualPremium.typical / 12)
    : 250; // $3,000/yr generic fallback when concept not mapped

  // ── CAM (Common Area Maintenance) ──────────────────────────────────────────
  // $/SF/month from PLUTO building class. bldgClass from session PLUTO data
  // (optional — falls back to city-wide default when not available).
  const camEstimate = resolveCamEstimate(inp.bldgClass ?? null);
  const monthlyCAM = Math.round(camEstimate.perSfMonthly * Math.max(inp.squareFootage, 1));

  const occupancyCostBreakdown = {
    baseRent:       inp.monthlyRent,
    taxPassThrough: taxPtM1,
    crt:            monthlyCrt,
    bid:            monthlyBid,
    insurance:      monthlyInsurance,
    cam:            monthlyCAM,
    total:          inp.monthlyRent + taxPtM1 + monthlyCrt + monthlyBid + monthlyInsurance + monthlyCAM,
    // Metadata for UX tooltip rendering
    crtApplies,
    bidName:        bidMatch?.name ?? null,
    insuranceNote:  insuranceBenchmark?.note ?? null,
    camNote:        camEstimate.note,
  };

  // ── Market events ─────────────────────────────────────────────────────────

  const m1Rev         = revenue[0]  ?? 0;
  const annRevY1Val   = annRevY1;
  const eventCategory = getEventCategory(inp.conceptKey);

  const universalEvents: MarketEvent[] = [
    {
      id: 'u1_competitor', risk: 'Competitor Opens Nearby', category: 'universal',
      dollarImpact: Math.round(m1Rev * 0.15 * 6),
      impactLabel: `${fmt(m1Rev * 0.15 * 6)} (−15% revenue × 6 months)`,
      meaning: 'Revenue dip as market adjusts; loyal customers erode without action',
      action: `Lock in regulars now. Differentiate on ${kpi.label.toLowerCase()} specifics — lean into what chains can\'t replicate.`,
    },
    {
      id: 'u2_lease_loss', risk: 'Building Sale / Lease Loss', category: 'universal',
      dollarImpact: Math.round(unrecoverableBuildout + depositCost + 15_000),
      impactLabel: `${fmt(unrecoverableBuildout + depositCost + 15_000)} (buildout loss + deposit + relocation)`,
      meaning: 'Complete loss of non-recoverable buildout, deposit, and moving costs',
      action: 'Negotiate assignment clause now. Keep build-out modular where possible.',
    },
    {
      id: 'u3_construction', risk: 'Street Construction / DOT Project', category: 'universal',
      dollarImpact: Math.round(m1Rev * 0.35 * 4),
      impactLabel: `${fmt(m1Rev * 0.35 * 4)} (−35% revenue × 4 months)`,
      meaning: 'Sidewalk closures reduce foot traffic; delivery partially offsets',
      action: 'Check NYC DOT Capital Projects tracker before signing lease. Negotiate rent abatement clause.',
    },
  ];

  const foodEvents: MarketEvent[] = [
    {
      id: 'f1_permit', risk: 'DOB Permit Delay', category: 'food',
      dollarImpact: Math.round(inp.monthlyRent * 3),
      impactLabel: `${fmt(inp.monthlyRent * 3)} (3 months dead rent)`,
      meaning: '+1–3 months paying rent before a single dollar of revenue',
      action: 'Start DOB filing 6 months before target open. Budget for 2-month delay minimum.',
    },
    {
      id: 'f2_rent_spike', risk: 'Rent Escalation Spike', category: 'food',
      dollarImpact: Math.round(inp.monthlyRent * 0.01 * 12),
      impactLabel: `${fmt(inp.monthlyRent * 0.01 * 12)}/yr per extra 1% above expected escalation`,
      meaning: 'Uncapped escalation compresses margin permanently',
      action: 'Negotiate 3% annual cap in lease. Model worst-case in your projections.',
    },
    {
      id: 'f3_turnover', risk: 'Staff Turnover (2 replacements)', category: 'food',
      dollarImpact: 10_000,
      impactLabel: '$10,000 (~$5K per replacement + quality dip)',
      meaning: '4–6 week quality dip per departure; customer experience affected',
      action: 'Cross-train. Pay above market. Build operations manual before launch.',
    },
    {
      id: 'f4_food_cost', risk: 'Food Cost Inflation (+5% COGS)', category: 'food',
      dollarImpact: Math.round(annRevY1Val * 0.05),
      impactLabel: `${fmt(annRevY1Val * 0.05)} lost margin (5% of Year 1 revenue)`,
      meaning: 'Supplier price hikes compress already-thin margins directly',
      action: 'Lock supplier pricing contracts. Adjust menu pricing quarterly. Build 2% buffer into COGS.',
    },
  ];

  const fitnessEvents: MarketEvent[] = [
    {
      id: 'fit1_seasonal', risk: 'Post-NYE Membership Drop (Jan–Mar)', category: 'fitness',
      dollarImpact: Math.round(m1Rev * 0.25 * 3),
      impactLabel: `${fmt(m1Rev * 0.25 * 3)} (−25% revenue × 3 months)`,
      meaning: 'Resolution members cancel; consistent members stay but revenue dips',
      action: 'Pre-sell annual contracts in November. Heavy retention campaign in December.',
    },
    {
      id: 'fit2_equipment', risk: 'Equipment Failure', category: 'fitness',
      dollarImpact: 15_000,
      impactLabel: '$15,000 (avg replacement + repair, plus member churn risk)',
      meaning: 'Core equipment down = classes canceled = churn accelerates',
      action: 'Equipment insurance. Preventive maintenance schedule. $10K reserve fund.',
    },
    {
      id: 'fit3_franchise', risk: 'New Franchise Opens Nearby', category: 'fitness',
      dollarImpact: Math.round(m1Rev * 0.25 * 6),
      impactLabel: `${fmt(m1Rev * 0.25 * 6)} (−25% members × 6 months)`,
      meaning: 'Price and marketing power of franchise cannibalizes casual members',
      action: 'Community-first model. Loyalty rewards. Niche positioning that franchises can\'t replicate.',
    },
    {
      id: 'fit4_liability', risk: 'Liability Incident', category: 'fitness',
      dollarImpact: 25_000,
      impactLabel: '$25,000 (exposure beyond standard insurance coverage)',
      meaning: 'Injury claim above policy limit; reputation damage accelerates churn',
      action: 'Waivers. Proper liability insurance ($2M minimum). All staff certified and background-checked.',
    },
  ];

  const retailEvents: MarketEvent[] = [
    {
      id: 'r1_shrinkage', risk: 'Inventory Shrinkage', category: 'retail',
      dollarImpact: Math.round(annRevY1Val * 0.02),
      impactLabel: `${fmt(annRevY1Val * 0.02)} (2% of Year 1 revenue to theft/damage)`,
      meaning: 'Theft + damage is industry-wide; negligence makes it worse',
      action: 'Security cameras. POS with inventory tracking. Staff training on loss prevention.',
    },
    {
      id: 'r2_ecommerce', risk: 'E-Commerce Competition Accelerates', category: 'retail',
      dollarImpact: Math.round(m1Rev * 0.15 * 12),
      impactLabel: `${fmt(m1Rev * 0.15 * 12)} (−15% foot traffic trend annually)`,
      meaning: 'Online convenience permanently erodes walk-in traffic in most categories',
      action: 'Experiential retail. Local-only or exclusive products. Click-and-collect capability.',
    },
    {
      id: 'r3_seasonal', risk: 'Seasonal Cash Crunch (Jan–Apr)', category: 'retail',
      dollarImpact: Math.round((totalCosts[0] ?? 0) * 3),
      impactLabel: `${fmt((totalCosts[0] ?? 0) * 3)} (3 months costs with minimal revenue)`,
      meaning: '60–70% of revenue concentrated in Q4 leaves 4 lean months',
      action: 'Reserve 3 months operating costs. Diversify seasonal mix to even cash flow.',
    },
    {
      id: 'r4_supply', risk: 'Supply Chain Disruption', category: 'retail',
      dollarImpact: Math.round(m1Rev * 0.30),
      impactLabel: `${fmt(m1Rev * 0.30)} (−30% revenue during 2–4 week stockout)`,
      meaning: 'Empty shelves drive customers to competitors permanently',
      action: 'Multiple suppliers. Safety stock (4-week buffer). Pre-order system for top SKUs.',
    },
  ];

  const servicesEvents: MarketEvent[] = [
    {
      id: 's1_provider', risk: 'Key Provider Departure', category: 'services',
      dollarImpact: Math.round(m1Rev * 0.15),
      impactLabel: `${fmt(m1Rev * 0.15)}/month (30–50% of their client book walks out)`,
      meaning: 'Client loyalty attaches to the person, not the brand, early on',
      action: 'Non-compete clauses. Cross-book clients across providers. Build brand over individual.',
    },
    {
      id: 's2_review', risk: 'Online Review Crisis', category: 'services',
      dollarImpact: Math.round(m1Rev * 0.40 * 2),
      impactLabel: `${fmt(m1Rev * 0.40 * 2)} (−40% bookings × 2 months)`,
      meaning: '1-star spiral cuts new bookings; recovery takes 6–12 months minimum',
      action: 'Review response protocol before launch. Quality control checkpoints. Incentivize positive reviews.',
    },
    {
      id: 's3_compliance', risk: 'Licensing / Compliance Fine', category: 'services',
      dollarImpact: 12_000,
      impactLabel: '$12,000 (surprise inspection fine $5–15K range)',
      meaning: 'Regulatory surprise = immediate cost + forced operational pause',
      action: 'Compliance calendar. Pre-inspection audits. Proper licensing before first client.',
    },
    {
      id: 's4_trend', risk: 'Service Category Trend Shift', category: 'services',
      dollarImpact: Math.round(m1Rev * 0.15 * 12),
      impactLabel: `${fmt(m1Rev * 0.15 * 12)} (−15% annual demand trend)`,
      meaning: 'Category demand declines; concept locked into lease and buildout',
      action: 'Diversify service menu. Continuous education. Build pivot flexibility into operations.',
    },
  ];

  const categoryMap: Record<string, MarketEvent[]> = {
    food: foodEvents, fitness: fitnessEvents, retail: retailEvents, services: servicesEvents,
  };
  const marketEvents = [...universalEvents, ...(categoryMap[eventCategory] ?? foodEvents)];

  // ── Validations ───────────────────────────────────────────────────────────

  const validations: ValidationResult[] = [];
  const warn = (field: string, sev: ValidationSeverity, message: string, value: number | string | null, range?: string) =>
    validations.push({ field, severity: sev, message, value, range });

  if (breakEvenMonth !== null) {
    if (breakEvenMonth < 3)  warn('break_even_month', 'WARNING', 'Break-even unusually fast — check ramp factors for over-optimism', breakEvenMonth, '3–24 months expected');
    if (breakEvenMonth > 24) warn('break_even_month', 'WARNING', 'Break-even beyond 24 months — concept may not be viable at this location', breakEvenMonth, '3–24 months expected');
  }

  if (cashNeeded < 50_000)    warn('cash_needed', 'WARNING', 'Cash needed under $50K — likely missing costs (check buildout and equipment)', cashNeeded, '$50K–$2M');
  if (cashNeeded > 2_000_000) warn('cash_needed', 'WARNING', 'Cash needed over $2M — unusual for single-unit; verify buildout assumptions', cashNeeded, '$50K–$2M');

  if (takeHomeY1 > 200_000)   warn('take_home_y1', 'WARNING', 'Year 1 take-home over $200K — check COGS and labor inputs for errors', takeHomeY1, '−$100K to +$200K');
  if (takeHomeY1 < -100_000)  warn('take_home_y1', 'WARNING', 'Year 1 take-home below −$100K — model may be misconfigured', takeHomeY1, '−$100K to +$200K');

  const dscrY1 = dscrByYear[0] ?? NaN;
  if (!isNaN(dscrY1)) {
    if (dscrY1 < 1.0)  warn('dscr_y1', 'FLAG', `DSCR ${dscrY1.toFixed(2)}x — cannot cover debt service (below 1.0x)`, dscrY1, '0.5x–3.0x');
    else if (dscrY1 < 1.15) warn('dscr_y1', 'FLAG', `DSCR ${dscrY1.toFixed(2)}x — below SBA minimum of 1.15x`, dscrY1, '1.15x+ for SBA');
    if (dscrY1 > 3.0)  warn('dscr_y1', 'FLAG', 'DSCR above 3.0x — loan amount may be too small relative to cash needs', dscrY1, '0.5x–3.0x');
  }

  if (breakEvenPerHour < 5)   warn('breakeven_footfalls', 'WARNING', 'Breakeven under 5/hr — very low volume concept; verify ticket size', breakEvenPerHour, '5–100/hr');
  if (breakEvenPerHour > 100) warn('breakeven_footfalls', 'WARNING', 'Breakeven over 100/hr — extremely high volume needed; check avg ticket', breakEvenPerHour, '5–100/hr');

  if (locationDeltaPct < -50) warn('location_delta', 'FLAG', 'Location delivers less than 50% of needed traffic — concept+location pairing may be wrong', Math.round(locationDeltaPct), '−100% to +200%');
  if (locationDeltaPct > 100) warn('location_delta', 'FLAG', 'Location delta over +100% — check capture rate assumption', Math.round(locationDeltaPct), '−100% to +200%');

  if (maxLoss.total > 3_000_000) warn('max_loss', 'FLAG', `Maximum exposure ${fmt(maxLoss.total)} — extreme PG risk; review lease terms carefully`, maxLoss.total, 'Up to $3M typical');

  if (sensitivityMonths < 3)  warn('sensitivity_months', 'FLAG', 'Cash runs out in under 3 months under 20% stress — critical risk', sensitivityMonths, '3+ months recommended');
  else if (sensitivityMonths < 6) warn('sensitivity_months', 'FLAG', `Only ${sensitivityMonths} months of buffer under 20% stress — cautionary`, sensitivityMonths, '6+ months healthy');

  if (valuationY5 < startupCosts) warn('valuation_y5', 'WARNING', 'Business worth less at Year 5 than it cost to open — check growth assumptions', valuationY5, `Above ${fmt(startupCosts)}`);

  const rentToRevenuePct = m1Rev > 0 ? (inp.monthlyRent / m1Rev) * 100 : 0;
  if (rentToRevenuePct > 25)  warn('rent_to_revenue', 'FLAG', `Rent is ${Math.round(rentToRevenuePct)}% of revenue — model is broken above 25%`, Math.round(rentToRevenuePct), '5%–25%');
  else if (rentToRevenuePct > 20) warn('rent_to_revenue', 'FLAG', `Rent is ${Math.round(rentToRevenuePct)}% of revenue — kill-factor territory (>20%)`, Math.round(rentToRevenuePct), '5%–20%');
  else if (rentToRevenuePct > 15) warn('rent_to_revenue', 'FLAG', `Rent is ${Math.round(rentToRevenuePct)}% of revenue — compressed margin`, Math.round(rentToRevenuePct), '5%–15% healthy');

  // BC-05: Total Occupancy Cost Ratio (rent + tax) — kill factor threshold at 18%
  if (inp.monthlyTaxPassThrough > 0 && m1Rev > 0) {
    const ocrPct = ((inp.monthlyRent + inp.monthlyTaxPassThrough) / m1Rev) * 100;
    if (ocrPct > 25) warn('occupancy_cost_ratio', 'BLOCK', `Total occupancy cost (rent + property tax) is ${Math.round(ocrPct)}% of revenue — unviable`, Math.round(ocrPct), 'Below 18%');
    else if (ocrPct > 18) warn('occupancy_cost_ratio', 'FLAG', `Total occupancy cost (rent + property tax) is ${Math.round(ocrPct)}% of revenue — above 18% kill threshold`, Math.round(ocrPct), 'Below 18%');
  }

  // ── VITAL RULE 3: Revenue-per-SF Floor (BC P&L Gate) ──
  // BR-M: Third surface for Rule 3 alongside the Location IQ cap (kept at 35
  // in location-iq.ts per Q1) and the Fit IQ kill-factor (scoring-utils).
  // This emits a FLAG in the BC validations[] so Snapshot/Full Picture show
  // it inline with the other P&L concerns.
  {
    const r3BC = rule3RevPerSFFloor({
      businessType: inp.conceptKey,
      concept: inp.conceptKey,
    });
    if (!r3BC.passes) {
      const implied = (r3BC.data.impliedRevPerSF as number) ?? 0;
      const floor = (r3BC.data.floor as number) ?? 150;
      warn(
        'rev_per_sf_floor',
        'FLAG',
        `Benchmark revenue-per-SF ($${implied}/SF) is below the $${floor}/SF floor for this concept — BC economics may not work at current footprint/ticket assumptions`,
        implied,
        `Above $${floor}/SF`
      );
    }
  }

  // ── VITAL RULE 2: Rent Escalation Stress (BC P&L Gate) ──
  // BR-M2 (April 11, 2026): Second BC surface for Rule 2. Unlike the Location
  // IQ consumer (hardcoded 3%/yr), this one passes the founder's actual
  // `effectiveEscalation` via leaseTerms so the verdict reflects their real
  // clause. Emits `warn('rent_escalation_stress', 'FLAG', ...)` so the
  // UX-EF wireframe can render the warning banner in BC Tab 2.
  {
    const r2BC = rule2RentEscalation({
      businessType: inp.conceptKey,
      concept: inp.conceptKey,
      leaseTerms: {
        baseRentMonthly: inp.monthlyRent,
        escalationPct: effectiveEscalation,
      },
    });
    if (!r2BC.passes) {
      const pct = (r2BC.data.year3RentPctDisplay as number) ?? 0;
      const ceilingPct = (r2BC.data.ceilingPct as number) ?? 0;
      const escUsed = (r2BC.data.escalationPctUsed as number) ?? 3.0;
      warn(
        'rent_escalation_stress',
        'FLAG',
        `Year 3 projected rent reaches ~${pct}% of revenue at ${escUsed}%/yr escalation, exceeding the ${ceilingPct}% occupancy ceiling for this concept. Negotiate a lower escalation (2% or CPI-capped) or a free-rent period.`,
        pct,
        `≤${ceilingPct}%`
      );
    }
  }

  // ── VITAL RULE 20: Percentage Rent Clause Warning ──
  // Retrofit (BR-L): verdict comes from RULES[20].check(). The 60-month math
  // loop above already wrote `pctRentByYear[]` (Dec true-up amounts) so
  // DSCR/cashflow/break-even include the cost. We keep that here because it's
  // tightly coupled to the rent[] array. This block emits the same WARNING /
  // FLAG warn() calls as pre-refactor using the check() result.
  if (hasPctRent) {
    // Advisory even if no trigger — clause exists, founder should understand it
    const triggerYears: number[] = [];
    const triggerAmounts: number[] = [];
    for (let y = 0; y < 3; y++) {
      const overage = pctRentByYear[y] || 0;
      if (overage > 0) {
        triggerYears.push(y + 1);
        triggerAmounts.push(overage);
      }
    }

    // Delegate verdict/severity to the vital-rules registry. We pass the
    // revenueY1toY3 numbers so check() can re-derive the same 3%-of-Y1
    // threshold the BC store uses. The emit copy below is unchanged.
    // BR-L note: the BC store still uses `pctRentByYear[]` from the 60-month
    // loop (month-level accuracy with ramp) rather than the annualised
    // check() estimate so dollar figures stay bit-for-bit identical to the
    // pre-refactor output. The check() result is reserved for future UX
    // consumers (UX-EF) that want a single registry surface.
    void VITAL_RULES[20].check({
      businessType: inp.conceptKey,
      concept: inp.conceptKey,
      leaseTerms: {
        baseRentMonthly: inp.monthlyRent,
        escalationPct: effectiveEscalation,
        percentageRentRate: pctRate,
        percentageRentBreakpoint: pctBreak,
      },
      revenueY1toY3: {
        y1: annRevY1,
        y2: annualRows[1]?.revenue ?? 0,
        y3: annualRows[2]?.revenue ?? 0,
      },
    });

    if (triggerYears.length === 0) {
      // Clause is dormant within the first 3 years — note it, don't flag it.
      warn(
        'percentage_rent',
        'WARNING',
        `Percentage rent clause present (${Math.round(pctRate * 100)}% over ${fmt(pctBreak)} annual breakpoint) — does not trigger in the first 3 years at current revenue projections.`,
        0,
        `Dormant below ${fmt(pctBreak)}/yr`
      );
    } else {
      // Clause triggers — call out the first year and the Y1-Y3 total dollar impact.
      const firstYr = triggerYears[0];
      const firstAmt = triggerAmounts[0];
      const total3yr = triggerAmounts.reduce((s, v) => s + v, 0);
      const severity: 'BLOCK' | 'FLAG' = total3yr > (annRevY1 * 0.03) ? 'FLAG' : 'WARNING';
      warn(
        'percentage_rent',
        severity,
        `Percentage rent triggers in Year ${firstYr}: ${fmt(firstAmt)} true-up (${Math.round(pctRate * 100)}% × overage above ${fmt(pctBreak)}). Y1–Y3 total ${fmt(total3yr)}. Negotiate a higher breakpoint or natural breakpoint (rate × base rent ÷ rate) before signing.`,
        Math.round(total3yr),
        `0 (no clause) or breakpoint ≥ Y3 revenue`
      );
    }
  }

  // BC-03: Coop advisory
  if (inp.isCoop) {
    warn('coop_unit', 'WARNING', 'Building is a co-op — negotiating directly with board, not a commercial landlord. Confirm subletting rights and board approval process before proceeding.', 'coop', 'N/A');
  }

  if (inp.cogsPercent < 20 || inp.cogsPercent > 60)
    warn('cogs_percent', 'BLOCK', `COGS ${inp.cogsPercent}% is outside valid range (20–60%) — model inputs may be misconfigured`, inp.cogsPercent, '20%–60%');

  const laborPct = annRevY1 > 0 ? ((annualRows[0]?.labor ?? 0) / annRevY1) * 100 : 0;
  if (laborPct < 15 || laborPct > 40)
    warn('labor_percent', 'WARNING', `Labor is ${Math.round(laborPct)}% of Year 1 revenue — outside 15–40% healthy range`, Math.round(laborPct), '15%–40%');

  // ── Assemble final summary ────────────────────────────────────────────────

  return {
    breakEvenMonth, cashNeeded, takeHomeY1, startupCosts, negativeBurn,
    costToOpen, breakEvenPerHour, breakEvenPerDay, footfallUnit: bc.footfallUnit,
    locationDeltaPct, maxLoss, sensitivityMonths, takeHomeY3, valuationY5,
    dscrByYear, goNoGo, passedCount, conditions, evidenceFor, evidenceAgainst,
    scenarios, monthlyRows, annualRows, useOfFunds,
    loanAmount: inp.loanAmount, loanMonthlyPayment, loanRate: effectiveLoanRate,
    loanTermMonths, totalInterest, fundingGap, marketEvents, validations,
    occupancyCostBreakdown, isCoop: inp.isCoop,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY = 're2_business_case_inputs';

export function createBusinessCaseStore() {

  // ── Sidebar $state inputs (founder-adjustable) ────────────────────────────
  let dailyCustomers  = $state(180);
  let avgTicket       = $state(8.75);
  let cogsPercent     = $state(30);       // stored as 0-100 integer
  let fullTimeStaff   = $state(2);
  let fullTimeRate    = $state(22);       // $/hr
  let partTimeStaff   = $state(3);
  let partTimeRate    = $state(18);       // $/hr
  let monthlyRent     = $state(5_000);
  let monthlyOpEx     = $state(5_000);
  let daysPerWeek     = $state(6);

  // ── Loan inputs (sidebar-editable in Tab 3) ────────────────────────────────
  let loanAmount      = $state(150_000);
  let loanTermYears   = $state(10);
  let loanRate        = $state(0);        // 0 = auto-derive from creditScore

  // ── Session context ($state, set by initFromSession, read-only from UX) ───
  let conceptKey          = $state('specialty_coffee');
  let conceptLabelVal     = $state('Specialty Coffee');
  let analysisAddress     = $state('');
  // B3-2.3: Geo context for CRT (lat) + CAM (bldgClass). Read from session.
  let locationLat         = $state<number | undefined>(undefined);
  let locationBldgClass   = $state<string | undefined>(undefined);
  let locationIQ          = $state(0);
  let fitIQ               = $state(0);
  let visionIQ            = $state(0);
  let transitScore        = $state(0);
  let vibrancyScore       = $state(0);
  let personalInvestment  = $state(50_000);
  let startupCapital      = $state(200_000);
  // BC-01/02/03: DOF property tax context (from session intel, default off)
  let monthlyTaxPassThrough = $state(0);
  let taxEscalationAnnual   = $state(0);
  let isCoop                = $state(false);
  let creditScore         = $state('good');
  let squareFootage       = $state(1_000);
  let hasPersonalGuarantee = $state(true);   // default true for SBA loans
  // ── VITAL RULE 20: Percentage rent clause (lease term, default off) ──
  // Both default to 0 so users with no clause get zero impact and zero warnings.
  let percentageRentRate       = $state(0);    // e.g. 0.06 for 6%
  let percentageRentBreakpoint = $state(0);    // annual $ gross sales breakpoint
  // ── BR-B' (April 11, 2026): Lease escalation percent ──
  // Default 0 = fall back to concept's `bc.defaultRentEscalation` inside the
  // 60-month loop. User-supplied values > 0 override the concept default.
  // UX-EF binds the Lease Terms section input here.
  let escalationPct = $state(0);

  // ── Persist sidebar inputs ────────────────────────────────────────────────
  // Guard: never persist if core revenue drivers are 0 (e.g. during SSR or
  // if a stale event fires before initFromSession has run). A 0 write would
  // corrupt the next load because `0 || fallback` would use the fallback, but
  // `0 ?? fallback` (the old pattern) would lock in 0 permanently.
  function saveInputs() {
    if (typeof window === 'undefined') return;
    if (!dailyCustomers || !avgTicket) return;   // not ready yet
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        dailyCustomers, avgTicket, cogsPercent,
        fullTimeStaff, fullTimeRate, partTimeStaff, partTimeRate,
        monthlyRent, monthlyOpEx, daysPerWeek,
        loanAmount, loanTermYears, loanRate,
        percentageRentRate, percentageRentBreakpoint,
        escalationPct,
      }));
    } catch {}
  }

  // ── initFromSession: reads launchpad + session data, pre-fills sidebar ────
  function initFromSession() {
    if (typeof window === 'undefined') return;
    try {
      const lp    = JSON.parse(localStorage.getItem('re2_launchpad')  || '{}');
      const sess  = JSON.parse(localStorage.getItem('re2_session')    || '{}');
      const saved = JSON.parse(localStorage.getItem(LS_KEY)           || '{}');

      const incomingConcept = lp.businessType || sess.bizType || sess.visionBizType || 'specialty_coffee';

      // B3-NEW-1: Auto-clear concept-specific fields when bizType changes.
      // If the session has a different concept recorded than what's coming
      // in from the launchpad, the user started a new analysis with a
      // different concept — prior vision inputs (differentiators, food program,
      // hours, etc.) must not bleed into the new concept's scoring.
      const previousConcept = sess._lastConcept;
      if (previousConcept && previousConcept !== incomingConcept) {
        const CONCEPT_FIELDS = [
          'conceptAnswers', 'visionDifferentiators', 'visionAvgCheck',
          'visionFoodProgram', 'visionHours', 'visionTargetAge',
          'visionStoreType', 'visionTargetClients', 'visionSeatingCapacity',
          'visionCreditScore',
        ];
        for (const f of CONCEPT_FIELDS) delete sess[f];
        sess._lastConcept = incomingConcept;
        try { localStorage.setItem('re2_session', JSON.stringify(sess)); } catch { /* no-op */ }
        // B3-0.A: Dispatch event so reactive page state ($state vars initialized from
        // localStorage) can clear stale fields. The page reads localStorage synchronously
        // before this store runs, so $state is already set — UX must subscribe to this
        // event to reactively clear visionDifferentiators, conceptAnswers, etc.
        // UX: add `window.addEventListener('re2:concept-changed', handler)` in onMount.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('re2:concept-changed', {
            detail: { from: previousConcept, to: incomingConcept, clearedFields: CONCEPT_FIELDS }
          }));
        }
      } else if (!previousConcept) {
        // First load — stamp the concept so future changes are detectable
        sess._lastConcept = incomingConcept;
        try { localStorage.setItem('re2_session', JSON.stringify(sess)); } catch { /* no-op */ }
      }

      conceptKey         = incomingConcept;
      conceptLabelVal    = getConceptLabel(conceptKey);
      analysisAddress    = sess.analyzedAddress || lp.idealArea || '';
      // B3-2.3: lat for CRT zone check (south of 96th St); bldgClass for CAM lookup
      locationLat        = typeof sess.lat === 'number' ? sess.lat : undefined;
      locationBldgClass  = sess.pluto?.bldgClass ?? undefined;
      locationIQ         = sess.locationIQ  || 0;
      fitIQ              = sess.fitIQ        || 0;
      visionIQ           = sess.visionIQ    || 0;
      transitScore       = sess.sixScores?.transit   || 0;
      vibrancyScore      = sess.sixScores?.vibrancy  || 0;
      personalInvestment = lp.financialGoals?.personalInvestment || lp.personalInvestment || 50_000;
      startupCapital     = lp.budget || lp.financialGoals?.startupCapital || 200_000;
      creditScore        = lp.creditScore || lp.financialGoals?.creditScore || 'good';
      squareFootage      = lp.squareFootage || lp.financialGoals?.squareFootage || 1_000;
      hasPersonalGuarantee = lp.financialGoals?.hasPersonalGuarantee ?? true;

      // BC-01/02/03: Pull DOF property tax data from session intel (stored after location analysis)
      monthlyTaxPassThrough = sess.propertyTax?.monthlyTaxPassThrough || 0;
      taxEscalationAnnual   = sess.propertyTax?.escalationAnnual      || 0;
      isCoop                = sess.propertyTax?.isCoop                 ?? false;

      const kpi   = CONCEPT_KPIS[conceptKey] ?? CONCEPT_KPIS['specialty_coffee'];
      const cDefs = getConceptDefaults(conceptKey);
      const bc    = kpi?.businessCase;

      // Sidebar: saved values take priority; fall back to session → concept defaults.
      // NOTE: Use || not ?? for any field where 0 is invalid — ?? passes 0 through,
      // which corrupts sliders if re2_business_case_inputs ever got a 0 write.
      dailyCustomers = saved.dailyCustomers  // || chain: 0 = invalid, use fallback
        || sess.sliderDefaults?.dailyCustomers
        || kpi?.revenueParams?.defaultDailyTransactions || 180;

      avgTicket = saved.avgTicket            // 0 is invalid
        || lp.financialGoals?.avgTicket
        || kpi?.revenueParams?.defaultAvgTicket || 8.75;

      cogsPercent = saved.cogsPercent        // 0 is invalid
        || Math.round((kpi?.revenueParams?.defaultCogsPercent ?? 0.30) * 100);

      monthlyRent = saved.monthlyRent        // 0 is invalid
        || lp.financialGoals?.monthlyRentBudget
        || lp.monthlyRentBudget || 5_000;

      monthlyOpEx = saved.monthlyOpEx        // 0 is invalid
        || getDefaultMonthlyOpex(conceptKey);

      daysPerWeek = saved.daysPerWeek        // 0 is invalid
        || kpi?.revenueParams?.defaultOperatingDaysPerWeek || 6;

      fullTimeStaff = saved.fullTimeStaff    // 0 is valid (no FT staff) — keep ??
        ?? (cDefs.team > 0 ? Math.max(1, Math.floor(cDefs.team * 0.4)) : 2);

      partTimeStaff = saved.partTimeStaff    // 0 is valid (no PT staff) — keep ??
        ?? (cDefs.team > 0 ? Math.ceil(cDefs.team * 0.6) : 3);

      fullTimeRate  = saved.fullTimeRate  || getHourlyLaborRate(conceptKey);  // 0 invalid
      partTimeRate  = saved.partTimeRate  || Math.max(15, getHourlyLaborRate(conceptKey) - 3);

      loanAmount    = saved.loanAmount    ?? 150_000;  // 0 = no loan, valid
      loanTermYears = saved.loanTermYears || 10;       // 0 invalid
      loanRate      = saved.loanRate      ?? 0;        // 0 = auto from creditScore, valid

      // ── VITAL RULE 20: Percentage rent clause (0 = no clause, valid) ──
      percentageRentRate       = saved.percentageRentRate       ?? 0;
      percentageRentBreakpoint = saved.percentageRentBreakpoint ?? 0;
      // ── BR-B': Lease escalation percent (0 = use concept default, valid) ──
      escalationPct            = saved.escalationPct            ?? 0;
    } catch {}
  }

  // ── Master $derived: full reactive financial model ─────────────────────────
  // Re-runs whenever any $state changes. ~60ms max on modern hardware.
  const model = $derived(computeFullModel({
    dailyCustomers, avgTicket, cogsPercent,
    fullTimeStaff, fullTimeRate, partTimeStaff, partTimeRate,
    monthlyRent, monthlyOpEx, daysPerWeek,
    conceptKey, transitScore, vibrancyScore,
    personalInvestment, startupCapital, creditScore,
    squareFootage, hasPersonalGuarantee,
    loanAmount, loanTermYears, loanRate,
    monthlyTaxPassThrough, taxEscalationAnnual, isCoop,
    percentageRentRate, percentageRentBreakpoint,
    escalationPct,
    // B3-2.3: Geo context for CRT + BID + CAM
    analysisAddress,
    lat: locationLat,
    bldgClass: locationBldgClass,
  }));

  // ── Return: clean interface for UX thread ─────────────────────────────────
  // UX never does math — it only displays named exports from this store.
  return {

    // Sidebar inputs — two-way via explicit setters
    get dailyCustomers()  { return dailyCustomers; },
    set dailyCustomers(v: number)  { dailyCustomers = +v;  saveInputs(); },

    get avgTicket()       { return avgTicket; },
    set avgTicket(v: number)       { avgTicket = +v;       saveInputs(); },

    get cogsPercent()     { return cogsPercent; },
    set cogsPercent(v: number)     { cogsPercent = +v;     saveInputs(); },

    get fullTimeStaff()   { return fullTimeStaff; },
    set fullTimeStaff(v: number)   { fullTimeStaff = +v;   saveInputs(); },

    get fullTimeRate()    { return fullTimeRate; },
    set fullTimeRate(v: number)    { fullTimeRate  = +v;   saveInputs(); },

    get partTimeStaff()   { return partTimeStaff; },
    set partTimeStaff(v: number)   { partTimeStaff = +v;   saveInputs(); },

    get partTimeRate()    { return partTimeRate; },
    set partTimeRate(v: number)    { partTimeRate  = +v;   saveInputs(); },

    get monthlyRent()     { return monthlyRent; },
    set monthlyRent(v: number)     { monthlyRent = +v;     saveInputs(); },

    get monthlyOpEx()     { return monthlyOpEx; },
    set monthlyOpEx(v: number)     { monthlyOpEx = +v;     saveInputs(); },

    get daysPerWeek()     { return daysPerWeek; },
    set daysPerWeek(v: number)     { daysPerWeek = +v;     saveInputs(); },

    get loanAmount()      { return loanAmount; },
    set loanAmount(v: number)      { loanAmount = +v;      saveInputs(); },

    get loanTermYears()   { return loanTermYears; },
    set loanTermYears(v: number)   { loanTermYears = +v;   saveInputs(); },

    get loanRate()        { return loanRate; },
    set loanRate(v: number)        { loanRate = +v;        saveInputs(); },

    // VITAL RULE 20: Percentage rent clause — two-way via explicit setters
    get percentageRentRate()       { return percentageRentRate; },
    set percentageRentRate(v: number)       { percentageRentRate = +v;       saveInputs(); },

    get percentageRentBreakpoint() { return percentageRentBreakpoint; },
    set percentageRentBreakpoint(v: number) { percentageRentBreakpoint = +v; saveInputs(); },

    // BR-B': Lease escalation (decimal, e.g. 0.03 = 3%) — two-way.
    // UX-EF binds the Lease Terms section input here. Setting 0 resets to the
    // concept default on the next $derived tick.
    get escalationPct()            { return escalationPct; },
    set escalationPct(v: number)            { escalationPct = +v;            saveInputs(); },

    // BR-M2 (April 11, 2026): Read-only getter that returns the escalation %
    // the BC engine is ACTUALLY using — falls back to the concept default
    // (~0.03) when the user hasn't set one. UX-EF should `bind:value={...}`
    // to `escalationPct` for input but display this getter's value so the
    // field shows "3%" on first load instead of "0%".
    get effectiveEscalationPct()   {
      const defaultEsc = CONCEPT_KPIS[conceptKey]?.businessCase?.defaultRentEscalation ?? 0.03;
      return escalationPct > 0 ? Math.min(0.15, escalationPct) : defaultEsc;
    },

    // BR-B': Y1/Y2/Y3 projected rent for the Lease Terms section in UX-EF.
    // Values come from the 60-month rent array via annualRows so they already
    // include the effective escalation AND any percentage-rent true-up AND
    // the tax pass-through. UX-EF reads these directly — no further math.
    get projectedRentY1()          { return model.annualRows[0]?.rent ?? 0; },
    get projectedRentY2()          { return model.annualRows[1]?.rent ?? 0; },
    get projectedRentY3()          { return model.annualRows[2]?.rent ?? 0; },

    // Session context — read-only from UX
    get conceptKey()             { return conceptKey; },
    get conceptLabel()           { return conceptLabelVal; },
    get analysisAddress()        { return analysisAddress; },
    get locationIQ()             { return locationIQ; },
    get fitIQ()                  { return fitIQ; },
    get visionIQ()               { return visionIQ; },
    get transitScore()           { return transitScore; },
    get vibrancyScore()          { return vibrancyScore; },
    get personalInvestment()     { return personalInvestment; },
    get creditScore()            { return creditScore; },
    get hasPersonalGuarantee()   { return hasPersonalGuarantee; },
    // BC-01/02/03: DOF tax context — read-only
    get monthlyTaxPassThrough()  { return monthlyTaxPassThrough; },
    get taxEscalationAnnual()    { return taxEscalationAnnual; },
    get isCoop()                 { return isCoop; },

    // Master model — UX-facing FinancialModel (mapped from internal FinancialSummary)
    // This is passed to tab components; all field names match UX contracts.
    get model(): FinancialModel { return mapToFinancialModel(model); },

    // Convenience top-level accessors (Tab 1 shortcuts)
    get breakEvenMonth()   { return model.breakEvenMonth; },
    get cashNeeded()       { return model.cashNeeded; },
    get takeHomeY1()       { return model.takeHomeY1; },
    get startupCosts()     { return model.startupCosts; },
    get monthlyRows()      { return model.monthlyRows; },

    // Convenience Tab 2 shortcuts
    get costToOpen()       { return model.costToOpen; },
    get breakEvenPerHour() { return model.breakEvenPerHour; },
    get breakEvenPerDay()  { return model.breakEvenPerDay; },
    get footfallUnit()     { return model.footfallUnit; },
    get locationDeltaPct() { return model.locationDeltaPct; },
    get maxLoss()          { return model.maxLoss; },
    get sensitivityMonths(){ return model.sensitivityMonths; },
    get takeHomeY3()       { return model.takeHomeY3; },
    get valuationY5()      { return model.valuationY5; },

    // Convenience Tab 3 shortcuts
    get goNoGo()           { return model.goNoGo; },
    get conditions()       { return model.conditions; },
    get scenarios()        { return model.scenarios; },
    get annualRows()       { return model.annualRows; },
    get validations()      { return model.validations; },
    get marketEvents()     { return model.marketEvents; },

    // ── Live P&L getters — used by BusinessCaseSidebar and tab fallback stubs ─
    // Computed directly from sidebar inputs (no ramp/maturity — steady-state M1 proxy)
    get monthlyRevenue() {
      return dailyCustomers * avgTicket * (daysPerWeek * 4.33 * 0.95);
    },
    get monthlyCOGS() {
      return dailyCustomers * avgTicket * (daysPerWeek * 4.33 * 0.95) * (cogsPercent / 100);
    },
    get monthlyLabor() {
      const ftr = fullTimeRate  > 0 ? fullTimeRate  : getHourlyLaborRate(conceptKey);
      const ptr = partTimeRate  > 0 ? partTimeRate  : Math.max(15, ftr - 3);
      return (fullTimeStaff * ftr * 40 * 4.33) + (partTimeStaff * ptr * 20 * 4.33);
    },
    get monthlyTotal() {
      const rev  = dailyCustomers * avgTicket * (daysPerWeek * 4.33 * 0.95);
      const cogs = rev * (cogsPercent / 100);
      const ftr  = fullTimeRate  > 0 ? fullTimeRate  : getHourlyLaborRate(conceptKey);
      const ptr  = partTimeRate  > 0 ? partTimeRate  : Math.max(15, ftr - 3);
      const lab  = (fullTimeStaff * ftr * 40 * 4.33) + (partTimeStaff * ptr * 20 * 4.33);
      return cogs + lab + monthlyRent + monthlyOpEx;
    },

    // Annual P&L aggregates (Year 1 from 60-month engine)
    get annualRevenue() { return (model.annualRows[0]?.revenue  ?? 0); },
    get annualCOGS()    { return (model.annualRows[0]?.cogs     ?? 0); },
    get annualLabor()   { return (model.annualRows[0]?.labor    ?? 0); },
    get annualOpEx()    { return (model.annualRows[0]?.opex     ?? 0); },
    get annualRent()    { return (model.annualRows[0]?.rent     ?? 0); },
    get annualProfit()  { return (model.annualRows[0]?.netIncome ?? 0); },

    initFromSession,
    saveInputs,

    /**
     * B3-NEW-1: Clear concept-specific vision fields from re2_session.
     *
     * Call this when: (1) the user switches concept type during a session,
     * (2) a new address analysis starts with a different bizType.
     *
     * Clears only the concept-specific inputs — does NOT clear address,
     * bizType, location scores, or financial inputs. Those persist because
     * they are either concept-agnostic or set by the new analysis.
     *
     * Fields cleared (re2_session keys):
     *   conceptAnswers        — vision question answers (concept-specific)
     *   visionDifferentiators — custom differentiator text
     *   visionAvgCheck        — average check size override
     *   visionFoodProgram     — food program selection
     *   visionHours           — operating hours selection
     *   visionTargetAge       — target age demographic
     *   visionStoreType       — store format/type
     *   visionTargetClients   — target client profile
     *   visionSeatingCapacity — seating capacity
     *   visionCreditScore     — credit score vision input
     *
     * UX thread: call this when bizType changes or a new analysis begins.
     */
    clearConceptSpecificFields() {
      if (typeof window === 'undefined') return;
      try {
        const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
        const CONCEPT_FIELDS = [
          'conceptAnswers',
          'visionDifferentiators',
          'visionAvgCheck',
          'visionFoodProgram',
          'visionHours',
          'visionTargetAge',
          'visionStoreType',
          'visionTargetClients',
          'visionSeatingCapacity',
          'visionCreditScore',
        ];
        let changed = false;
        for (const field of CONCEPT_FIELDS) {
          if (field in sess) {
            delete sess[field];
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem('re2_session', JSON.stringify(sess));
        }
      } catch {
        // localStorage unavailable — no-op
      }
    },
  };
}

export type BusinessCaseStore = ReturnType<typeof createBusinessCaseStore>;
