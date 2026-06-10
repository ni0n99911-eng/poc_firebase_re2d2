import { g as getBenchmark } from "./industry-benchmarks.js";
import { D as DOC09_OCCUPANCY_CEILINGS } from "./conceptKPIs.js";
function _rule2Check(ctx) {
  const bm = _benchmarkOrNull(ctx.businessType);
  const ceiling = DOC09_OCCUPANCY_CEILINGS[ctx.concept];
  if (!bm || !ceiling) {
    return { passes: true, severity: "info", data: { reason: "no_ceiling_for_concept" } };
  }
  const annualRev = bm.avgTransaction * bm.dailyCustomers * 365;
  const currentRentPct = bm.rentPct / 100;
  const currentAnnualRent = annualRev * currentRentPct;
  const maxRentPct = ceiling.maxPct / 100;
  const escRate = Math.max(0, Math.min(0.15, ctx.leaseTerms?.escalationPct ?? 0.03));
  const year3Rent = currentAnnualRent * Math.pow(1 + escRate, 3);
  const year3RentPct = year3Rent / annualRev;
  const passes = year3RentPct <= maxRentPct;
  return {
    passes,
    severity: passes ? "info" : "warn",
    data: {
      year3RentPct,
      year3RentPctDisplay: Math.round(year3RentPct * 100),
      ceilingPct: ceiling.maxPct,
      ceilingNote: ceiling.note,
      escalationPctUsed: Math.round(escRate * 1e3) / 10,
      // e.g. 3.0
      concept: ctx.concept
    }
  };
}
function _rule2Display(result) {
  const pct = result.data.year3RentPctDisplay;
  const ceilingPct = result.data.ceilingPct;
  const note = result.data.ceilingNote ?? "";
  if (result.passes) {
    return {
      verdict: "Rent escalation headroom OK",
      why: `Projected Year 3 rent stays at or below the ${ceilingPct}% occupancy ceiling for this concept.`
    };
  }
  return {
    verdict: "Rent escalation risk",
    why: `At 3%/yr, rent reaches ~${pct}% of revenue by Year 3, exceeding the ${ceilingPct}% ceiling for this concept. ${note}.`,
    fixHint: "Negotiate a lower escalation (2% or CPI-capped) or a free-rent period to offset Year 3 load."
  };
}
const rule2 = {
  id: 2,
  name: "Rent Escalation Stress Test",
  severity: "warn",
  check: _rule2Check,
  display: _rule2Display
};
function rule2RentEscalation(ctx) {
  return _rule2Check(ctx);
}
const REV_PER_SF_FLOORS = {
  coffee: 250,
  // $6.50 × 150 × 365 / 1200 = ~296, floor at 250
  cafe: 250,
  // 04.18.2026 Code Changes for Vital Rules Refactoring
  restaurant: 400,
  // Full-service industry minimum viability floor (was 200)
  "fast-casual": 300,
  // Volume model needs higher density
  bar: 200,
  bakery: 250,
  retail: 150,
  // Lower floor due to lower volume
  fitness: 100,
  // MRR model, revenue spread over membership
  salon: 150
};
function _rule3Check(ctx) {
  const bm = _benchmarkOrNull(ctx.businessType);
  if (!bm) {
    return { passes: true, severity: "info", data: { reason: "no_benchmark" } };
  }
  const annualRevEstimate = bm.avgTransaction * bm.dailyCustomers * 365;
  const maxSqft = bm.typicalSqft?.[1] || 1500;
  const impliedRevPerSF = Math.round(annualRevEstimate / maxSqft);
  const floor = REV_PER_SF_FLOORS[ctx.businessType] ?? 150;
  const passes = impliedRevPerSF >= floor;
  return {
    passes,
    severity: passes ? "info" : "warn",
    data: {
      impliedRevPerSF,
      floor,
      businessType: ctx.businessType
    }
  };
}
function _rule3Display(result) {
  const implied = result.data.impliedRevPerSF;
  const floor = result.data.floor;
  if (result.passes) {
    return {
      verdict: "Revenue-per-SF floor OK",
      why: `Implied $${implied}/SF meets or beats the $${floor}/SF minimum for this concept.`
    };
  }
  return {
    verdict: "Revenue-per-SF floor fail",
    why: `Revenue-per-SF floor fail: implied $${implied}/SF vs minimum $${floor}/SF for this concept. Economics may not work at this density.`,
    fixHint: "Look for a smaller footprint, raise ticket, or increase daily customer target — the floor is set by industry averages."
  };
}
const rule3 = {
  id: 3,
  name: "Revenue-per-SF Floor",
  severity: "warn",
  check: _rule3Check,
  display: _rule3Display
};
function rule3RevPerSFFloor(ctx) {
  return _rule3Check(ctx);
}
const RULE_17_SIGNAL_PREFIX = "🚫 SLA 200-ft BLOCK";
function _rule17Check(ctx) {
  const schools = ctx.schools;
  if (!schools) {
    return { passes: true, severity: "info", data: { reason: "no_school_data" } };
  }
  if (schools.slaBlocked) {
    const closest = schools.closestSchool;
    const distFt = closest ? Math.round(closest.distanceMeters * 3.281) : 0;
    return {
      passes: false,
      severity: "kill",
      data: {
        distFt,
        closestName: closest?.name ?? "School",
        within200ft: schools.within200ft
      }
    };
  }
  if (schools.within200ft === 0) {
    const closest = schools.closestSchool;
    const distFt = closest ? Math.round(closest.distanceMeters * 3.281) : null;
    return {
      passes: true,
      severity: "info",
      data: {
        reason: "clear",
        closestDistFt: distFt
      }
    };
  }
  return { passes: true, severity: "info", data: { reason: "clear" } };
}
function _rule17Display(result) {
  if (!result.passes) {
    const name = result.data.closestName;
    const dist = result.data.distFt;
    const within = result.data.within200ft;
    return {
      verdict: "Liquor license BLOCKED",
      why: `${RULE_17_SIGNAL_PREFIX}: ${name} is ${dist} ft away — liquor license is IMPOSSIBLE at this location. Zero exceptions. ${within} school(s) within 200 ft.`,
      fixHint: "If liquor is essential to the concept, this location is a hard no. Otherwise, proceed aware of the constraint."
    };
  }
  const d = result.data.closestDistFt;
  return {
    verdict: "SLA 200-ft school check clear",
    why: `SLA 200-ft school check CLEAR: no schools within 200 ft${d != null ? ` (closest: ${d} ft)` : ""}. Church proximity still requires manual verification.`
  };
}
const rule17 = {
  id: 17,
  name: "School/Church 200-ft SLA Proximity Block",
  severity: "kill",
  check: _rule17Check,
  display: _rule17Display
};
function _rule20Check(ctx) {
  const terms = ctx.leaseTerms;
  const rev = ctx.revenueY1toY3;
  const rate = Math.max(0, terms?.percentageRentRate ?? 0);
  const breakpoint = Math.max(0, terms?.percentageRentBreakpoint ?? 0);
  const hasClause = rate > 0 && breakpoint > 0;
  if (!hasClause) {
    return {
      passes: true,
      severity: "info",
      data: { reason: "no_clause" }
    };
  }
  if (!rev) {
    return {
      passes: true,
      severity: "warn",
      data: {
        triggered: false,
        dormant: true,
        rate,
        breakpoint,
        triggerYears: [],
        triggerAmounts: [],
        total3yr: 0
      }
    };
  }
  const years = [rev.y1, rev.y2, rev.y3];
  const triggerYears = [];
  const triggerAmounts = [];
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
      passes: true,
      // advisory, not a block
      severity: "warn",
      data: {
        triggered: false,
        dormant: true,
        rate,
        breakpoint,
        triggerYears,
        triggerAmounts,
        total3yr: 0
      }
    };
  }
  const heavy = total3yr > rev.y1 * 0.03;
  return {
    passes: false,
    severity: heavy ? "warn" : "warn",
    // both are 'warn' severity class — adapter maps to BC FLAG vs WARNING
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
      heavy
      // adapter reads this to choose FLAG vs WARNING
    }
  };
}
function _rule20Display(result) {
  const rate = result.data.rate ?? 0;
  const breakpoint = result.data.breakpoint ?? 0;
  const ratePct = Math.round(rate * 100);
  if (result.data.reason === "no_clause") {
    return {
      verdict: "No percentage rent clause",
      why: "Lease has no percentage rent component."
    };
  }
  if (result.data.dormant) {
    return {
      verdict: "Percentage rent clause dormant",
      why: `Percentage rent clause present (${ratePct}% over $${breakpoint.toLocaleString()} annual breakpoint) — does not trigger in the first 3 years at current revenue projections.`,
      fixHint: "Safe to sign as-is, but keep an eye on it past Year 3 as revenue grows."
    };
  }
  if (result.data.triggered) {
    const firstYr = result.data.firstYear;
    const firstAmt = result.data.firstAmount ?? 0;
    const total3yr = result.data.total3yr ?? 0;
    return {
      verdict: "Percentage rent triggers inside Y1-Y3",
      why: `Percentage rent triggers in Year ${firstYr}: $${Math.round(firstAmt).toLocaleString()} true-up (${ratePct}% × overage above $${breakpoint.toLocaleString()}). Y1–Y3 total $${Math.round(total3yr).toLocaleString()}.`,
      fixHint: "Negotiate a higher breakpoint or a natural breakpoint (base rent ÷ rate) before signing."
    };
  }
  return { verdict: "Percentage rent status unknown", why: "Insufficient data." };
}
const rule20 = {
  id: 20,
  name: "Percentage Rent Clause",
  severity: "warn",
  check: _rule20Check,
  display: _rule20Display
};
const RULES = {
  2: rule2,
  3: rule3,
  17: rule17,
  20: rule20
};
function _benchmarkOrNull(businessType) {
  try {
    const bm = getBenchmark(businessType);
    return bm ?? null;
  } catch {
    return null;
  }
}
export {
  RULES as R,
  rule2RentEscalation as a,
  rule3RevPerSFFloor as r
};
