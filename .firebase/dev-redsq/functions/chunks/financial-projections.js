import { g as getBenchmark } from "./industry-benchmarks.js";
function computeFootTrafficMultiplier(loc, bench) {
  if (!loc.locationIQ && !loc.transitScore && !loc.footTrafficScore) return 1;
  let multiplier = 1;
  if (loc.locationIQ !== void 0) {
    multiplier *= 0.8 + loc.locationIQ / 100 * 0.4;
  }
  if (loc.transitScore !== void 0 && bench.transitWeight > 0.5) {
    const transitBoost = (loc.transitScore - 50) / 100 * bench.transitWeight * 0.3;
    multiplier *= 1 + transitBoost;
  }
  if (loc.footTrafficScore !== void 0 && bench.footTrafficWeight > 0.5) {
    const ftBoost = (loc.footTrafficScore - 50) / 100 * bench.footTrafficWeight * 0.3;
    multiplier *= 1 + ftBoost;
  }
  if (loc.competitionScore !== void 0 && bench.competitionSensitivity > 0.3) {
    const compAdj = (loc.competitionScore - 50) / 100 * bench.competitionSensitivity * 0.2;
    multiplier *= 1 + compAdj;
  }
  return Math.max(0.5, Math.min(1.5, multiplier));
}
function hoursMultiplier(hours, bench) {
  if (!hours) return 1;
  const h = hours.toLowerCase();
  if (h.includes("all day")) return 1.1;
  if (h.includes("morning") || h.includes("5")) return 0.7;
  if (h.includes("evening") || h.includes("late")) {
    return bench.nightlifeRelevance > 0.5 ? 1.05 : 0.8;
  }
  if (h.includes("weekend")) return 0.45;
  return 1;
}
function rampFactor(month) {
  if (month <= 0) return 0;
  return Math.min(1, 0.4 + 0.6 * (1 - Math.exp(-0.35 * month)));
}
function seasonalFactor(monthIndex, range) {
  const seasonCurve = [0.85, 0.88, 0.95, 1, 1.05, 1.08, 1.05, 1.02, 1, 1.05, 1.1, 1];
  const baseFactor = seasonCurve[monthIndex % 12] || 1;
  const [lo, hi] = range;
  const mid = (lo + hi) / 2;
  const halfSpread = (hi - lo) / 2;
  return mid + halfSpread * (baseFactor - 1) / 0.15;
}
function parseRentBudget(raw) {
  return 0;
}
function computeFinancialProjection(inputs, location = {}) {
  const bench = getBenchmark(inputs.businessType);
  const ftMultiplier = computeFootTrafficMultiplier(location, bench);
  const hrsMultiplier = hoursMultiplier(inputs.operatingHours, bench);
  const rent = inputs.rent || parseRentBudget() || bench.idealRentRange[1];
  const avgTxn = inputs.avgTransaction || bench.avgTransaction;
  const baseDailyCustomers = inputs.dailyCustomers || bench.dailyCustomers;
  const adjustedDailyCustomers = Math.round(baseDailyCustomers * ftMultiplier * hrsMultiplier);
  const staffPerShift = inputs.staffCount || bench.staffPerShift;
  const ownerSaves = inputs.ownerOperator ? bench.avgHourlyWage * 8 * 30 : 0;
  const monthlyRevenue = avgTxn * adjustedDailyCustomers * 30;
  const cogs = monthlyRevenue * (bench.cogsPct / 100);
  const grossProfit = monthlyRevenue - cogs;
  const labor = staffPerShift * bench.avgHourlyWage * 8 * 30 * bench.shiftsPerDay + bench.managerSalary - ownerSaves;
  const marketing = monthlyRevenue * (bench.marketingPct / 100);
  const utilities = monthlyRevenue * (bench.utilityPct / 100);
  const insurance = monthlyRevenue * (bench.insurancePct / 100);
  const otherOpex = monthlyRevenue * (bench.otherOpexPct / 100);
  const totalExpenses = cogs + labor + rent + marketing + utilities + insurance + otherOpex;
  const netIncome = monthlyRevenue - totalExpenses;
  const netMargin = monthlyRevenue > 0 ? netIncome / monthlyRevenue : 0;
  const monthlyPL = {
    revenue: Math.round(monthlyRevenue),
    cogs: Math.round(cogs),
    grossProfit: Math.round(grossProfit),
    labor: Math.round(labor),
    rent: Math.round(rent),
    marketing: Math.round(marketing),
    utilities: Math.round(utilities),
    insurance: Math.round(insurance),
    otherOpex: Math.round(otherOpex),
    totalExpenses: Math.round(totalExpenses),
    netIncome: Math.round(netIncome),
    netMargin: Math.round(netMargin * 100) / 100
  };
  const fixedMonthlyCosts = rent + labor + insurance + monthlyRevenue * bench.marketingPct / 100 * 0.3;
  const variableCostPerTxn = avgTxn * ((bench.cogsPct + bench.utilityPct) / 100);
  const contributionPerTxn = avgTxn - variableCostPerTxn;
  const dailyBreakEven = contributionPerTxn > 0 ? Math.ceil(fixedMonthlyCosts / 30 / contributionPerTxn) : 999;
  const startupCost = inputs.startupBudget || Math.round((bench.startupCostRange[0] + bench.startupCostRange[1]) / 2);
  const monthsToRecoup = netIncome > 0 ? Math.ceil(startupCost / netIncome) : 999;
  const breakEven = {
    dailyTransactionsNeeded: dailyBreakEven,
    monthlyRevenueNeeded: Math.round(dailyBreakEven * avgTxn * 30),
    currentDailyTransactions: adjustedDailyCustomers,
    surplus: adjustedDailyCustomers - dailyBreakEven,
    daysToBreakEvenStartup: netIncome > 0 ? Math.ceil(startupCost / (netIncome / 30)) : 9999,
    cushionPct: dailyBreakEven > 0 ? Math.round((adjustedDailyCustomers - dailyBreakEven) / dailyBreakEven * 100) : 0
  };
  const today = /* @__PURE__ */ new Date();
  const startMonth = today.getMonth();
  let cumulativeNet = -startupCost;
  const twelveMonthProjection = [];
  for (let i = 1; i <= 12; i++) {
    const rf = rampFactor(i);
    const sf = seasonalFactor((startMonth + i) % 12, bench.seasonalityRange);
    const mRevenue = Math.round(monthlyRevenue * rf * sf);
    const mExpenses = Math.round(totalExpenses * (0.85 + rf * 0.15));
    const mNet = mRevenue - mExpenses;
    cumulativeNet += mNet;
    twelveMonthProjection.push({
      month: i,
      label: `Month ${i}`,
      revenue: mRevenue,
      expenses: mExpenses,
      netIncome: mNet,
      cumulativeNet: Math.round(cumulativeNet),
      rampFactor: Math.round(rf * 100) / 100,
      seasonalFactor: Math.round(sf * 100) / 100
    });
  }
  const deviations = [];
  if (inputs.rent) {
    const pctDiff = Math.round((inputs.rent - bench.idealRentRange[1]) / bench.idealRentRange[1] * 100);
    deviations.push({
      field: "rent",
      userValue: inputs.rent,
      benchmarkValue: bench.idealRentRange[1],
      pctDiff,
      flag: Math.abs(pctDiff) <= 20 ? "ok" : Math.abs(pctDiff) <= 50 ? "caution" : "warning"
    });
  }
  if (inputs.avgTransaction) {
    const pctDiff = Math.round((inputs.avgTransaction - bench.avgTransaction) / bench.avgTransaction * 100);
    deviations.push({
      field: "avgTransaction",
      userValue: inputs.avgTransaction,
      benchmarkValue: bench.avgTransaction,
      pctDiff,
      flag: Math.abs(pctDiff) <= 25 ? "ok" : Math.abs(pctDiff) <= 50 ? "caution" : "warning"
    });
  }
  if (inputs.dailyCustomers) {
    const pctDiff = Math.round((inputs.dailyCustomers - bench.dailyCustomers) / bench.dailyCustomers * 100);
    deviations.push({
      field: "dailyCustomers",
      userValue: inputs.dailyCustomers,
      benchmarkValue: bench.dailyCustomers,
      pctDiff,
      flag: Math.abs(pctDiff) <= 30 ? "ok" : Math.abs(pctDiff) <= 60 ? "caution" : "warning"
    });
  }
  const locSignals = [location.locationIQ, location.fitIQ, location.transitScore, location.footTrafficScore, location.competitionScore, location.medianIncome, location.walkScore];
  const locationConfidence = Math.round(locSignals.filter((v) => v !== void 0).length / locSignals.length * 100);
  const annualRevenue = twelveMonthProjection.reduce((s, m) => s + m.revenue, 0);
  const annualNetIncome = twelveMonthProjection.reduce((s, m) => s + m.netIncome, 0);
  return {
    monthlyPL,
    breakEven,
    twelveMonthProjection,
    annualRevenue,
    annualNetIncome,
    startupCostEstimate: startupCost,
    monthsToRecoupStartup: monthsToRecoup,
    rentToRevenueRatio: monthlyRevenue > 0 ? Math.round(rent / monthlyRevenue * 100) / 100 : 0,
    laborToRevenueRatio: monthlyRevenue > 0 ? Math.round(labor / monthlyRevenue * 100) / 100 : 0,
    footTrafficMultiplier: Math.round(ftMultiplier * 100) / 100,
    locationConfidence,
    benchmarkUsed: inputs.businessType,
    deviations
  };
}
function computeWhatIf(base, changes, inputs, location = {}) {
  const after = computeFinancialProjection({ ...inputs, ...changes }, location);
  return {
    before: base,
    after,
    impact: {
      revenueChange: after.monthlyPL.revenue - base.monthlyPL.revenue,
      netIncomeChange: after.monthlyPL.netIncome - base.monthlyPL.netIncome,
      breakEvenChange: after.breakEven.dailyTransactionsNeeded - base.breakEven.dailyTransactionsNeeded,
      startupRecoupChange: after.monthsToRecoupStartup - base.monthsToRecoupStartup,
      annualNetChange: after.annualNetIncome - base.annualNetIncome
    }
  };
}
export {
  computeWhatIf as a,
  computeFinancialProjection as c
};
