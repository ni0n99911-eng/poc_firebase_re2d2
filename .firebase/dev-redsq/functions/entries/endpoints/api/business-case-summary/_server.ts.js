import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
import { c as computeFinancialProjection } from "../../../../chunks/financial-projections.js";
import { g as getDoc09Intelligence, D as DOC09_OCCUPANCY_CEILINGS, C as CONCEPT_KPIS } from "../../../../chunks/conceptKPIs.js";
import { n as normalizeBusinessType } from "../../../../chunks/business-type-registry.js";
import { t as tierFor, f as fitTierLabel, b as blockTierLabel } from "../../../../chunks/decision-engine.js";
import { K as KILL_FACTOR_THRESHOLDS } from "../../../../chunks/scoring-thresholds.js";
const PARTIAL_SEED_THRESHOLD = 10;
function getCreditGateMessage(band) {
  switch (band) {
    case "excellent":
      return "Excellent credit. Eligible for all SBA 7(a) lenders at preferred rates. Full lender list in Loan Einstein.";
    case "good":
      return "Good credit. Eligible for all SBA 7(a) lenders at standard rates. Full lender list in Loan Einstein.";
    case "fair":
      return "Fair credit. Some lenders available — CDFIs and SBA Micro Loan program are your best path. Consider credit-building steps to expand options.";
    case "building":
      return "Credit is building. Mission-driven lenders (Accion, CDFI programs) may still fund you. Personal credit improvement unlocks more options in 6–12 months.";
    default:
      return "Credit profile not provided. Enter your credit score range in your founder profile to see lender options.";
  }
}
function computeKillFactors(bizType, rent, annualRevenue, locationScores) {
  const kpi = CONCEPT_KPIS[bizType] ?? CONCEPT_KPIS.specialty_coffee;
  const factors = [];
  if (annualRevenue > 0) {
    const rentPct = Math.round(rent * 12 / annualRevenue * 100);
    const threshold = kpi.maxRentPercent ?? 10;
    if (rentPct > threshold) {
      factors.push({
        type: "rent",
        value: rentPct,
        threshold,
        label: `Rent ${rentPct}% of revenue — above ${threshold}% threshold`
      });
    }
  }
  if ((locationScores.transit ?? 100) < KILL_FACTOR_THRESHOLDS.transit) {
    factors.push({
      type: "transit",
      value: locationScores.transit ?? 0,
      threshold: KILL_FACTOR_THRESHOLDS.transit,
      label: `Transit score ${locationScores.transit ?? 0} — below ${KILL_FACTOR_THRESHOLDS.transit} (car-only access risk)`
    });
  }
  if ((locationScores.competition ?? 100) < KILL_FACTOR_THRESHOLDS.competition) {
    factors.push({
      type: "competition",
      value: locationScores.competition ?? 0,
      threshold: KILL_FACTOR_THRESHOLDS.competition,
      label: `Competition score ${locationScores.competition ?? 0} — market is saturated for this concept`
    });
  }
  if ((locationScores.visionIQ ?? 100) > 0 && (locationScores.visionIQ ?? 100) < 50) {
    factors.push({
      type: "concept",
      value: locationScores.visionIQ ?? 0,
      threshold: 50,
      label: `Concept detail ${locationScores.visionIQ ?? 0} — differentiation is weak`
    });
  }
  return factors.slice(0, 3);
}
const POST = async ({ request }) => {
  const limited = rateLimit(request, RATE_LIMITS.intel);
  if (limited) return limited;
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const {
    businessType = "specialty_coffee",
    locationIQ = 50,
    fitIQ,
    visionIQ = 0,
    rent = 5e3,
    dailyCustomers,
    avgCheck,
    locationScores = {},
    creditScoreBand,
    poiCount
  } = body;
  const normalizedType = normalizeBusinessType(businessType);
  try {
    const baseProjection = computeFinancialProjection(
      { businessType: normalizedType, rent, dailyCustomers, avgTransaction: avgCheck },
      { locationIQ, fitIQ }
    );
    const optimisticProjection = computeFinancialProjection(
      { businessType: normalizedType, rent, dailyCustomers: Math.round((dailyCustomers ?? baseProjection.breakEven.currentDailyTransactions) * 1.15), avgTransaction: avgCheck },
      { locationIQ, fitIQ }
    );
    const stressedProjection = computeFinancialProjection(
      { businessType: normalizedType, rent, dailyCustomers: Math.round((dailyCustomers ?? baseProjection.breakEven.currentDailyTransactions) * 0.85), avgTransaction: avgCheck },
      { locationIQ, fitIQ }
    );
    const cashToOpen = Math.round(baseProjection.startupCostEstimate);
    const monthlyBurn = Math.max(1, baseProjection.monthlyPL.totalExpenses);
    const monthsOfRunway = Math.round(cashToOpen / monthlyBurn);
    const breakEvenMonth = {
      optimistic: Math.max(1, optimisticProjection.monthsToRecoupStartup),
      base: Math.max(1, baseProjection.monthsToRecoupStartup),
      stressed: stressedProjection.monthsToRecoupStartup > 60 ? 999 : Math.max(1, stressedProjection.monthsToRecoupStartup)
    };
    const stressedBurn = stressedProjection.monthlyPL.totalExpenses - stressedProjection.monthlyPL.revenue;
    const cushionNeeded = stressedBurn > 0 ? Math.round(stressedBurn * 6) : 0;
    const annualRevenue = baseProjection.annualRevenue;
    const killFactors = computeKillFactors(
      normalizedType,
      rent,
      annualRevenue,
      { ...locationScores, visionIQ }
    );
    const killFactorCount = killFactors.length;
    const verdictOverride = killFactorCount >= 2 ? tierFor(0, "fitIQ").label : void 0;
    const creditGateMessage = getCreditGateMessage(creditScoreBand);
    const isPartialSeed = (poiCount ?? PARTIAL_SEED_THRESHOLD) < PARTIAL_SEED_THRESHOLD;
    const effectiveFitIQ = fitIQ ?? locationIQ;
    const verdict = verdictOverride ?? fitTierLabel(effectiveFitIQ);
    const blockLabel = blockTierLabel(locationIQ) || "Developing Block";
    const doc09Advisories = [];
    const doc09 = getDoc09Intelligence(normalizedType);
    if (doc09) {
      const [minStartup] = doc09.startupCapitalRange;
      if (cashToOpen > 0 && cashToOpen < minStartup * 0.8) {
        doc09Advisories.push(
          `Industry data suggests ${doc09.label} typically needs $${(minStartup / 1e3).toFixed(0)}K+ to open. Your estimate of $${(cashToOpen / 1e3).toFixed(0)}K may be undercapitalized.`
        );
      }
      const ceiling = DOC09_OCCUPANCY_CEILINGS[normalizedType];
      if (ceiling && annualRevenue > 0) {
        const actualOccPct = Math.round(rent * 12 / annualRevenue * 100);
        if (actualOccPct > ceiling.maxPct) {
          doc09Advisories.push(
            `Rent is ${actualOccPct}% of projected revenue — exceeds the ${ceiling.maxPct}% ceiling for this business type. ${ceiling.note}.`
          );
        }
      }
      if (doc09.breakEvenMonths) {
        const [beMin, beMax] = doc09.breakEvenMonths;
        if (breakEvenMonth.base < beMin) {
          doc09Advisories.push(
            `Your break-even estimate (${breakEvenMonth.base} months) is faster than industry typical (${beMin}–${beMax} months). Verify assumptions.`
          );
        }
      }
      if (doc09.failureRates) {
        doc09Advisories.push(
          `Industry reality: ${doc09.failureRates.year1Pct}% close in Year 1, ~${doc09.failureRates.year3Pct}% by Year 3. #1 cause: ${doc09.failureRates.topCause}.`
        );
      }
      if (doc09.unanticipatedCosts && doc09.unanticipatedCosts.length > 0) {
        const topCosts = doc09.unanticipatedCosts.slice(0, 3).map((c) => `${c.item} (${c.amount})`).join(", ");
        doc09Advisories.push(
          `Hidden costs to budget for: ${topCosts}.`
        );
      }
    }
    return new Response(JSON.stringify({
      // DELTA-03: Survival numbers
      cashToOpen,
      monthsOfRunway,
      breakEvenMonth,
      cushionNeeded,
      // DELTA-04: Kill factors
      killFactors,
      killFactorCount,
      verdictOverride,
      // DELTA-05: Credit gate
      creditGateMessage,
      // DELTA-07: Partial seed
      isPartialSeed,
      // DELTA-01/02: Canonical labels
      verdict,
      blockLabel,
      // Supporting financials for BC page
      annualRevenue: Math.round(annualRevenue),
      monthlyRevenue: Math.round(baseProjection.monthlyPL.revenue),
      monthlyExpenses: Math.round(baseProjection.monthlyPL.totalExpenses),
      netMargin: baseProjection.monthlyPL.netMargin,
      // Doc09 intelligence advisories
      doc09Advisories
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  } catch (e) {
    console.error("[BC Summary] Error:", e);
    return new Response(JSON.stringify({
      error: "Internal error computing business case summary",
      message: e instanceof Error ? e.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
export {
  POST
};
