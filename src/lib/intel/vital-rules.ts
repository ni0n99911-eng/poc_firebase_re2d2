/**
 * RE² Vital Rules Registry — Brain (Thread 9)
 *
 * Canonical home for the "vital rules" framework. Rules 2/3/17/20 are the
 * first tenants; the registry pattern is designed to absorb Rules 4/5 and any
 * future additions without callers having to change shape.
 *
 * ── Design principles ───────────────────────────────────────────────────────
 * 1. `check(ctx)` is PURE. It reads from the provided context + stable global
 *    constants (industry benchmarks, DOC09 ceilings) and returns a verdict.
 *    No mutation, no signal pushes, no score clamping.
 * 2. Side effects (SIQ / LIQ / locationIQ mutation, signal pushes, BC
 *    validations) live in the caller ("thin adapter"). Adapters call
 *    `RULES[N].check(ctx)`, inspect the result, and apply the exact same
 *    numeric penalties and signal messages they applied before the retrofit.
 * 3. `display(result)` is a FUNCTION — per Kalpna's Q6 ruling — because Rule 2
 *    needs tier-aware copy (warn vs info) and Rule 20 needs dormant-vs-
 *    triggered variants.
 * 4. Behavior is BIT-FOR-BIT preserved. This retrofit must hold svelte-check
 *    at the 643/430 baseline with zero new errors/warnings and zero changes
 *    to any scoring output. If you change math, you're doing BR-M, not BR-L.
 *
 * ── Interface contract (published for UX + BC store) ───────────────────────
 * - `LeaseTerms` type — lease-side inputs for Rule 2 projection
 * - `projectRentY1toY3(terms)` — Y1/Y2/Y3 rent projection helper (used by BR-B'
 *   + UX-EF Lease Terms section)
 * - `rule3RevPerSFFloor(ctx)` — exposed check for BR-M's Fit IQ + BC consumers
 * - `getRule3Diagnostics(ctx)` — UX-D display payload for Rule 3
 *
 * Sprint: BR-L (April 11, 2026 — Wave 1 item #1)
 */

import type { IndustryBenchmark } from '$lib/industry-benchmarks';
import { getBenchmark } from '$lib/industry-benchmarks';
import { DOC09_OCCUPANCY_CEILINGS } from '$lib/constants/conceptKPIs';

// ─────────────────────────────────────────────────────────────────────────────
// Core registry types
// ─────────────────────────────────────────────────────────────────────────────

export type RuleSeverity = 'kill' | 'warn' | 'info';

export interface RuleResult {
  /** True = the location passes this rule. False = rule flags it. */
  passes: boolean;
  /** Severity class when `passes === false`. When passing, still emitted so
   *  display() can render a "clear" info card if it wants to. */
  severity: RuleSeverity;
  /** Rule-specific diagnostics. Adapters read this for signal copy + penalty
   *  inputs. UX reads this for display. Keep keys stable — they're a contract. */
  data: Record<string, unknown>;
}

/**
 * Minimum fields each rule needs. Kept intentionally small so we don't fold
 * the entire LocationIntelReport into the registry. Rules pull stable
 * globals (benchmarks, ceilings) via direct import.
 */
export interface RuleContext {
  /** Benchmark key from `getBenchmark(businessType)` — e.g. "coffee", "restaurant". */
  businessType: string;
  /**
   * User-facing concept key, e.g. "specialty_coffee", "full_service_restaurant".
   * Used for DOC09_OCCUPANCY_CEILINGS lookup and display copy. String-typed
   * to avoid a circular import with location-iq.ts's ConceptType.
   */
  concept: string;

  /** Rule 2 + Rule 20 — lease terms for rent projection + percentage rent. */
  leaseTerms?: LeaseTerms;

  /**
   * Rule 20 — projected annual revenue for Y1/Y2/Y3. The BC store passes this
   * in so check() can decide whether the clause triggers. Dollars, not cents.
   */
  revenueY1toY3?: { y1: number; y2: number; y3: number };

  /** Rule 17 — NYC schools proximity result (shape mirrors nyc-schools.ts). */
  schools?: {
    slaBlocked: boolean;
    within200ft: number;
    closestSchool: { name?: string; distanceMeters: number } | null;
  };
}

export interface VitalRule {
  id: number;
  name: string;
  /** Max severity this rule can ever emit. Used by UX for sort/filter. */
  severity: RuleSeverity;
  check: (ctx: RuleContext) => RuleResult;
  display: (result: RuleResult) => {
    verdict: string;
    why: string;
    fixHint?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LeaseTerms contract (published here so BC store + UX share one type)
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaseTerms {
  /** Base rent, $/month. Required. */
  baseRentMonthly: number;
  /** Annual escalation as a decimal. 0.03 = 3%. Default 0.03, valid 0..0.15. */
  escalationPct: number;
  /** Percentage rent rate as a decimal. 0.06 = 6% of overage. 0 = disabled. */
  percentageRentRate?: number;
  /** Annual gross sales breakpoint $ — overage above this is owed. 0 = disabled. */
  percentageRentBreakpoint?: number;
}

/**
 * Project base rent (not percentage rent) for Y1/Y2/Y3 given a LeaseTerms
 * block. Returns annual totals. Y1 is month 1–12 compounded from the first-
 * month figure, Y2 applies one year of escalation over Y1's average, etc.
 *
 * This matches how location-iq.ts Rule 2 historically projected rent — 3%
 * annual, revenue flat — and it matches how business-case-store.svelte.ts
 * applies `rentEscFactor = (1 + esc)^yearIdx` inside the 60-month loop.
 *
 * BR-B' consumers: read `y1/y2/y3` and compare to occupancy ceiling revenue.
 */
export function projectRentY1toY3(terms: LeaseTerms): {
  y1: number;
  y2: number;
  y3: number;
} {
  const base = Math.max(0, terms.baseRentMonthly || 0);
  const esc = Math.max(0, Math.min(0.15, terms.escalationPct ?? 0.03));
  // Rent compounds at year boundaries. Y1 = 12 × base, Y2 = 12 × base × (1+esc)^1, etc.
  return {
    y1: Math.round(base * 12),
    y2: Math.round(base * 12 * Math.pow(1 + esc, 1)),
    y3: Math.round(base * 12 * Math.pow(1 + esc, 2)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 2 — Rent Escalation Stress Test
// ─────────────────────────────────────────────────────────────────────────────
// Legacy site: location-iq.ts ~line 1080. Uses DOC09_OCCUPANCY_CEILINGS and a
// 3%/yr × 3yr projection. Historically penalised SIQ -4 + carried the warning
// as a signal. The registry version returns the verdict; the thin adapter in
// location-iq.ts still applies the SIQ -4 penalty and pushes the same signal.

function _rule2Check(ctx: RuleContext): RuleResult {
  const bm = _benchmarkOrNull(ctx.businessType);
  const ceiling = DOC09_OCCUPANCY_CEILINGS[ctx.concept];
  if (!bm || !ceiling) {
    return { passes: true, severity: 'info', data: { reason: 'no_ceiling_for_concept' } };
  }

  const annualRev = bm.avgTransaction * bm.dailyCustomers * 365;
  const currentRentPct = bm.rentPct / 100;
  const currentAnnualRent = annualRev * currentRentPct;
  const maxRentPct = ceiling.maxPct / 100;

  // BR-M2 (April 11, 2026): optionally use the founder's actual escalation %
  // from ctx.leaseTerms when present. Location IQ callers don't pass leaseTerms,
  // so they still get the legacy 3%/yr behavior — bit-identical. The BC P&L
  // gate callers pass `effectiveEscalation` so the verdict reflects reality.
  const escRate = Math.max(0, Math.min(0.15, ctx.leaseTerms?.escalationPct ?? 0.03));
  const year3Rent = currentAnnualRent * Math.pow(1 + escRate, 3);
  const year3RentPct = year3Rent / annualRev;

  const passes = year3RentPct <= maxRentPct;
  return {
    passes,
    severity: passes ? 'info' : 'warn',
    data: {
      year3RentPct,
      year3RentPctDisplay: Math.round(year3RentPct * 100),
      ceilingPct: ceiling.maxPct,
      ceilingNote: ceiling.note,
      escalationPctUsed: Math.round(escRate * 1000) / 10, // e.g. 3.0
      concept: ctx.concept,
    },
  };
}

function _rule2Display(result: RuleResult) {
  const pct = result.data.year3RentPctDisplay as number | undefined;
  const ceilingPct = result.data.ceilingPct as number | undefined;
  const note = (result.data.ceilingNote as string | undefined) ?? '';
  if (result.passes) {
    return {
      verdict: 'Rent escalation headroom OK',
      why: `Projected Year 3 rent stays at or below the ${ceilingPct}% occupancy ceiling for this concept.`,
    };
  }
  return {
    verdict: 'Rent escalation risk',
    why: `At 3%/yr, rent reaches ~${pct}% of revenue by Year 3, exceeding the ${ceilingPct}% ceiling for this concept. ${note}.`,
    fixHint: 'Negotiate a lower escalation (2% or CPI-capped) or a free-rent period to offset Year 3 load.',
  };
}

export const rule2: VitalRule = {
  id: 2,
  name: 'Rent Escalation Stress Test',
  severity: 'warn',
  check: _rule2Check,
  display: _rule2Display,
};

/** Convenience export for BR-M2 consumer (BC P&L rent escalation gate). */
export function rule2RentEscalation(ctx: RuleContext): RuleResult {
  return _rule2Check(ctx);
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 3 — Revenue-per-SF Floor
// ─────────────────────────────────────────────────────────────────────────────
// Legacy site: location-iq.ts ~line 1046. REV_PER_SF_FLOORS record + cap at 35.
// BR-M will add TWO new consumers (Fit IQ kill-factor, BC P&L gate) while
// keeping the existing Location IQ cap at 35 intact — per Kalpna's Q1 ruling.

/** Minimum viable revenue-per-SF floors, industry standards. Concept-keyed. */
export const REV_PER_SF_FLOORS: Record<string, number> = {
  coffee:        250,  // $6.50 × 150 × 365 / 1200 = ~296, floor at 250
  cafe:          250,
  // 04.18.2026 Code Changes for Vital Rules Refactoring
  restaurant:    400,  // Full-service industry minimum viability floor (was 200)
  'fast-casual': 300,  // Volume model needs higher density
  bar:           200,
  bakery:        250,
  retail:        150,  // Lower floor due to lower volume
  fitness:       100,  // MRR model, revenue spread over membership
  salon:         150,
};

function _rule3Check(ctx: RuleContext): RuleResult {
  const bm = _benchmarkOrNull(ctx.businessType);
  if (!bm) {
    return { passes: true, severity: 'info', data: { reason: 'no_benchmark' } };
  }
  const annualRevEstimate = bm.avgTransaction * bm.dailyCustomers * 365;
  const maxSqft = bm.typicalSqft?.[1] || 1500;
  const impliedRevPerSF = Math.round(annualRevEstimate / maxSqft);
  const floor = REV_PER_SF_FLOORS[ctx.businessType] ?? 150;
  const passes = impliedRevPerSF >= floor;

  return {
    passes,
    severity: passes ? 'info' : 'warn',
    data: {
      impliedRevPerSF,
      floor,
      businessType: ctx.businessType,
    },
  };
}

function _rule3Display(result: RuleResult) {
  const implied = result.data.impliedRevPerSF as number | undefined;
  const floor = result.data.floor as number | undefined;
  if (result.passes) {
    return {
      verdict: 'Revenue-per-SF floor OK',
      why: `Implied $${implied}/SF meets or beats the $${floor}/SF minimum for this concept.`,
    };
  }
  return {
    verdict: 'Revenue-per-SF floor fail',
    why: `Revenue-per-SF floor fail: implied $${implied}/SF vs minimum $${floor}/SF for this concept. Economics may not work at this density.`,
    fixHint: 'Look for a smaller footprint, raise ticket, or increase daily customer target — the floor is set by industry averages.',
  };
}

export const rule3: VitalRule = {
  id: 3,
  name: 'Revenue-per-SF Floor',
  severity: 'warn',
  check: _rule3Check,
  display: _rule3Display,
};

/** Convenience export for BR-M consumers (Fit IQ + BC P&L gate). */
export function rule3RevPerSFFloor(ctx: RuleContext): RuleResult {
  return _rule3Check(ctx);
}

/**
 * BR-M / UX-D display helper — returns the triple-visible Rule 3 diagnostic
 * payload in one call. Fit IQ kill-factor card, BC P&L flag, and LIQ cap all
 * read the same numbers from this single source.
 */
export function getRule3Diagnostics(ctx: RuleContext): {
  projected: number;
  floor: number;
  concept: string;
  passes: boolean;
} {
  const res = _rule3Check(ctx);
  return {
    projected: (res.data.impliedRevPerSF as number) ?? 0,
    floor: (res.data.floor as number) ?? 0,
    concept: ctx.businessType,
    passes: res.passes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 17 — School / Church 200-ft SLA Block
// ─────────────────────────────────────────────────────────────────────────────
// Legacy site: location-iq.ts ~line 672. NY SLA prohibits liquor licenses
// within 200 ft of a school or place of worship — zero exceptions. Data comes
// from nyc-schools.ts; the adapter still owns the SIQ -15 penalty and
// locationIQ cap at 30.
//
// CONTRACT: adapters (and UX-J) rely on the `🚫 SLA 200-ft BLOCK` signal
// prefix. Do NOT change it without bumping the contract and deprecating the
// old prefix for one commit. Tracked in the sprint §5 interface table.

export const RULE_17_SIGNAL_PREFIX = '🚫 SLA 200-ft BLOCK';

function _rule17Check(ctx: RuleContext): RuleResult {
  const schools = ctx.schools;
  if (!schools) {
    return { passes: true, severity: 'info', data: { reason: 'no_school_data' } };
  }
  if (schools.slaBlocked) {
    const closest = schools.closestSchool;
    const distFt = closest ? Math.round(closest.distanceMeters * 3.281) : 0;
    return {
      passes: false,
      severity: 'kill',
      data: {
        distFt,
        closestName: closest?.name ?? 'School',
        within200ft: schools.within200ft,
      },
    };
  }
  if (schools.within200ft === 0) {
    const closest = schools.closestSchool;
    const distFt = closest ? Math.round(closest.distanceMeters * 3.281) : null;
    return {
      passes: true,
      severity: 'info',
      data: {
        reason: 'clear',
        closestDistFt: distFt,
      },
    };
  }
  // Edge case: schools present but none within 200 ft — treat as clear.
  return { passes: true, severity: 'info', data: { reason: 'clear' } };
}

function _rule17Display(result: RuleResult) {
  if (!result.passes) {
    const name = result.data.closestName as string;
    const dist = result.data.distFt as number;
    const within = result.data.within200ft as number;
    return {
      verdict: 'Liquor license BLOCKED',
      why: `${RULE_17_SIGNAL_PREFIX}: ${name} is ${dist} ft away — liquor license is IMPOSSIBLE at this location. Zero exceptions. ${within} school(s) within 200 ft.`,
      fixHint: 'If liquor is essential to the concept, this location is a hard no. Otherwise, proceed aware of the constraint.',
    };
  }
  const d = result.data.closestDistFt as number | null | undefined;
  return {
    verdict: 'SLA 200-ft school check clear',
    why: `SLA 200-ft school check CLEAR: no schools within 200 ft${
      d != null ? ` (closest: ${d} ft)` : ''
    }. Church proximity still requires manual verification.`,
  };
}

export const rule17: VitalRule = {
  id: 17,
  name: 'School/Church 200-ft SLA Proximity Block',
  severity: 'kill',
  check: _rule17Check,
  display: _rule17Display,
};

// ─────────────────────────────────────────────────────────────────────────────
// RULE 20 — Percentage Rent Clause
// ─────────────────────────────────────────────────────────────────────────────
// Legacy site: business-case-store.svelte.ts ~line 1098 (validation) + ~line
// 585 (math loop). The 60-month loop math stays in the store because it's
// tightly coupled to the rent[] array. `check()` here just decides whether
// the clause is dormant vs triggered given Y1–Y3 revenue, and the BC store
// adapter emits the same WARNING/FLAG it emitted pre-refactor.

function _rule20Check(ctx: RuleContext): RuleResult {
  const terms = ctx.leaseTerms;
  const rev = ctx.revenueY1toY3;
  const rate = Math.max(0, terms?.percentageRentRate ?? 0);
  const breakpoint = Math.max(0, terms?.percentageRentBreakpoint ?? 0);
  const hasClause = rate > 0 && breakpoint > 0;

  if (!hasClause) {
    return {
      passes: true,
      severity: 'info',
      data: { reason: 'no_clause' },
    };
  }

  if (!rev) {
    // Clause declared but no revenue projection — report as dormant advisory.
    return {
      passes: true,
      severity: 'warn',
      data: {
        triggered: false,
        dormant: true,
        rate,
        breakpoint,
        triggerYears: [],
        triggerAmounts: [],
        total3yr: 0,
      },
    };
  }

  // Compute the Y1/Y2/Y3 overages the way the BC store already does.
  const years = [rev.y1, rev.y2, rev.y3];
  const triggerYears: number[] = [];
  const triggerAmounts: number[] = [];
  years.forEach((r, idx) => {
    const overage = Math.max(0, r - breakpoint);
    if (overage > 0) {
      triggerYears.push(idx + 1);
      triggerAmounts.push(overage * rate);
    }
  });

  const total3yr = triggerAmounts.reduce((s, v) => s + v, 0);
  const triggered = triggerYears.length > 0;

  if (!triggered) {
    return {
      passes: true,                          // advisory, not a block
      severity: 'warn',
      data: {
        triggered: false,
        dormant: true,
        rate,
        breakpoint,
        triggerYears,
        triggerAmounts,
        total3yr: 0,
      },
    };
  }

  // Triggered — severity depends on Y1-Y3 dollar impact vs Y1 revenue.
  // This mirrors the BC store threshold: >3% of Y1 revenue → FLAG, else WARNING.
  const heavy = total3yr > rev.y1 * 0.03;
  return {
    passes: false,
    severity: heavy ? 'warn' : 'warn',     // both are 'warn' severity class — adapter maps to BC FLAG vs WARNING
    data: {
      triggered: true,
      dormant: false,
      rate,
      breakpoint,
      triggerYears,
      triggerAmounts,
      total3yr,
      firstYear: triggerYears[0],
      firstAmount: triggerAmounts[0],
      heavy,                                // adapter reads this to choose FLAG vs WARNING
    },
  };
}

function _rule20Display(result: RuleResult) {
  const rate = (result.data.rate as number | undefined) ?? 0;
  const breakpoint = (result.data.breakpoint as number | undefined) ?? 0;
  const ratePct = Math.round(rate * 100);

  if (result.data.reason === 'no_clause') {
    return {
      verdict: 'No percentage rent clause',
      why: 'Lease has no percentage rent component.',
    };
  }

  if (result.data.dormant) {
    return {
      verdict: 'Percentage rent clause dormant',
      why: `Percentage rent clause present (${ratePct}% over $${breakpoint.toLocaleString()} annual breakpoint) — does not trigger in the first 3 years at current revenue projections.`,
      fixHint: 'Safe to sign as-is, but keep an eye on it past Year 3 as revenue grows.',
    };
  }

  if (result.data.triggered) {
    const firstYr = result.data.firstYear as number;
    const firstAmt = (result.data.firstAmount as number) ?? 0;
    const total3yr = (result.data.total3yr as number) ?? 0;
    return {
      verdict: 'Percentage rent triggers inside Y1-Y3',
      why: `Percentage rent triggers in Year ${firstYr}: $${Math.round(firstAmt).toLocaleString()} true-up (${ratePct}% × overage above $${breakpoint.toLocaleString()}). Y1–Y3 total $${Math.round(total3yr).toLocaleString()}.`,
      fixHint: 'Negotiate a higher breakpoint or a natural breakpoint (base rent ÷ rate) before signing.',
    };
  }

  return { verdict: 'Percentage rent status unknown', why: 'Insufficient data.' };
}

export const rule20: VitalRule = {
  id: 20,
  name: 'Percentage Rent Clause',
  severity: 'warn',
  check: _rule20Check,
  display: _rule20Display,
};

// ─────────────────────────────────────────────────────────────────────────────
// RULES registry — keyed by rule id
// ─────────────────────────────────────────────────────────────────────────────

export const RULES: Record<number, VitalRule> = {
  2: rule2,
  3: rule3,
  17: rule17,
  20: rule20,
};

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps `getBenchmark()` with a soft-null fallback so rules don't throw on
 * unrecognised business types. Returns null if no benchmark exists; rules
 * treat null as "pass by default" with a `reason: 'no_benchmark'` note.
 */
function _benchmarkOrNull(businessType: string): IndustryBenchmark | null {
  try {
    const bm = getBenchmark(businessType);
    return bm ?? null;
  } catch {
    return null;
  }
}
