import { d as derived } from "./index2.js";
import { C as CONCEPT_KPIS } from "./conceptKPIs.js";
import { g as getConceptLabel } from "./concepts.js";
import { g as getConceptDefaults } from "./conceptDefaults.js";
import { r as rule3RevPerSFFloor, a as rule2RentEscalation, R as RULES } from "./vital-rules.js";
import { e as extractEditorialSignal, a as editorialScenarioBias } from "./editorial-signals.js";
const BID_ASSESSMENTS = [
  // ── Manhattan ──
  { name: "Times Square Alliance", borough: "Manhattan", rateOfBaseRent: 7e-3, matches: ["times square", "theater district", "42nd st", "broadway"] },
  { name: "Grand Central Partnership", borough: "Manhattan", rateOfBaseRent: 6e-3, matches: ["grand central", "midtown east", "42nd", "lexington", "vanderbilt"] },
  { name: "Bryant Park Corporation", borough: "Manhattan", rateOfBaseRent: 6e-3, matches: ["bryant park", "6th ave", "sixth avenue"] },
  { name: "Flatiron/23rd Street Partnership", borough: "Manhattan", rateOfBaseRent: 5e-3, matches: ["flatiron", "23rd st", "madison square"] },
  { name: "Fifth Avenue Association", borough: "Manhattan", rateOfBaseRent: 6e-3, matches: ["fifth avenue", "5th ave", "plaza district"] },
  { name: "Lower East Side Partnership", borough: "Manhattan", rateOfBaseRent: 4e-3, matches: ["lower east side", "les", "rivington", "orchard", "ludlow"] },
  { name: "SoHo Broadway Initiative", borough: "Manhattan", rateOfBaseRent: 5e-3, matches: ["soho", "broadway soho", "spring st", "prince st"] },
  { name: "Union Square Partnership", borough: "Manhattan", rateOfBaseRent: 5e-3, matches: ["union square", "14th st", "17th st"] },
  { name: "Chinatown Partnership", borough: "Manhattan", rateOfBaseRent: 3e-3, matches: ["chinatown", "mott st", "canal st"] },
  { name: "Village Alliance", borough: "Manhattan", rateOfBaseRent: 4e-3, matches: ["greenwich village", "west village", "bleecker"] },
  { name: "Hudson Yards Hell’s Kitchen Alliance", borough: "Manhattan", rateOfBaseRent: 5e-3, matches: ["hudson yards", "hell’s kitchen", "hells kitchen"] },
  { name: "Downtown Alliance", borough: "Manhattan", rateOfBaseRent: 5e-3, matches: ["financial district", "fidi", "wall st", "downtown manhattan"] },
  { name: "Columbus Avenue BID", borough: "Manhattan", rateOfBaseRent: 4e-3, matches: ["columbus ave", "upper west side", "uws"] },
  { name: "125th Street BID", borough: "Manhattan", rateOfBaseRent: 3e-3, matches: ["125th st", "harlem", "apollo"] },
  { name: "34th Street Partnership", borough: "Manhattan", rateOfBaseRent: 6e-3, matches: ["34th st", "herald square", "penn station"] },
  // ── Brooklyn ──
  { name: "Downtown Brooklyn Partnership", borough: "Brooklyn", rateOfBaseRent: 5e-3, matches: ["downtown brooklyn", "fulton st", "livingston"] },
  { name: "Park Slope 5th Avenue BID", borough: "Brooklyn", rateOfBaseRent: 4e-3, matches: ["park slope", "5th ave brooklyn", "fifth ave brooklyn"] },
  { name: "Bedford Stuyvesant Gateway BID", borough: "Brooklyn", rateOfBaseRent: 3e-3, matches: ["bed-stuy", "bedford-stuyvesant", "nostrand"] },
  { name: "Flatbush Avenue BID", borough: "Brooklyn", rateOfBaseRent: 3e-3, matches: ["flatbush ave", "flatbush"] },
  { name: "North Flatbush BID", borough: "Brooklyn", rateOfBaseRent: 4e-3, matches: ["north flatbush", "grand army plaza"] },
  { name: "Atlantic Avenue BID", borough: "Brooklyn", rateOfBaseRent: 4e-3, matches: ["atlantic ave", "boerum hill"] },
  { name: "Myrtle Avenue Brooklyn Partnership", borough: "Brooklyn", rateOfBaseRent: 3e-3, matches: ["myrtle ave", "fort greene", "clinton hill"] },
  { name: "DUMBO Improvement District", borough: "Brooklyn", rateOfBaseRent: 5e-3, matches: ["dumbo", "jay st", "washington st"] },
  { name: "Industry City / Sunset Park", borough: "Brooklyn", rateOfBaseRent: 3e-3, matches: ["sunset park", "industry city"] },
  { name: "Bay Ridge 5th Avenue BID", borough: "Brooklyn", rateOfBaseRent: 3e-3, matches: ["bay ridge"] },
  { name: "Kings Highway BID", borough: "Brooklyn", rateOfBaseRent: 3e-3, matches: ["kings highway", "midwood"] },
  // ── Queens ──
  { name: "Long Island City Partnership", borough: "Queens", rateOfBaseRent: 5e-3, matches: ["long island city", "lic", "vernon blvd", "jackson ave"] },
  { name: "Jamaica Center Improvement District", borough: "Queens", rateOfBaseRent: 4e-3, matches: ["jamaica center", "jamaica ave"] },
  { name: "Sutphin Boulevard BID", borough: "Queens", rateOfBaseRent: 3e-3, matches: ["sutphin blvd", "jamaica"] },
  { name: "Queens Plaza BID", borough: "Queens", rateOfBaseRent: 4e-3, matches: ["queens plaza"] },
  { name: "Steinway Astoria Partnership", borough: "Queens", rateOfBaseRent: 3e-3, matches: ["astoria", "steinway", "30th ave"] },
  { name: "Flushing BID", borough: "Queens", rateOfBaseRent: 4e-3, matches: ["flushing", "main st queens"] },
  { name: "82nd Street Partnership", borough: "Queens", rateOfBaseRent: 3e-3, matches: ["jackson heights", "82nd st"] },
  { name: "Sunnyside Shines", borough: "Queens", rateOfBaseRent: 3e-3, matches: ["sunnyside", "queens blvd"] },
  // ── Bronx ──
  { name: "Fordham Road BID", borough: "Bronx", rateOfBaseRent: 4e-3, matches: ["fordham rd", "fordham road"] },
  { name: "161st Street BID", borough: "Bronx", rateOfBaseRent: 3e-3, matches: ["161st st", "yankee stadium"] },
  { name: "Third Avenue BID", borough: "Bronx", rateOfBaseRent: 3e-3, matches: ["third ave bronx", "3rd ave bronx", "morrisania"] },
  { name: "Southern Boulevard BID", borough: "Bronx", rateOfBaseRent: 3e-3, matches: ["southern blvd"] },
  { name: "Bay Plaza BID", borough: "Bronx", rateOfBaseRent: 4e-3, matches: ["bay plaza", "co-op city"] },
  // ── Staten Island ──
  { name: "Forest Avenue BID", borough: "Staten Island", rateOfBaseRent: 3e-3, matches: ["forest ave"] },
  { name: "New Dorp Lane BID", borough: "Staten Island", rateOfBaseRent: 3e-3, matches: ["new dorp"] }
];
function resolveBidAssessment(address) {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const bid of BID_ASSESSMENTS) {
    if (bid.matches.some((k) => lower.includes(k.toLowerCase()))) return bid;
  }
  return null;
}
const INSURANCE_BENCHMARKS = {
  specialty_coffee: { conceptKey: "specialty_coffee", annualPremium: { low: 1800, typical: 3e3, high: 5500 }, note: "GL + property + workers comp; higher if espresso machine/gas lines." },
  bakery: { conceptKey: "bakery", annualPremium: { low: 2200, typical: 3800, high: 6500 }, note: "Higher fire risk (ovens) than coffee." },
  fast_casual: { conceptKey: "fast_casual", annualPremium: { low: 3e3, typical: 5200, high: 9e3 }, note: "Food handling + higher traffic elevate GL premium." },
  qsr: { conceptKey: "qsr", annualPremium: { low: 3500, typical: 6e3, high: 10500 }, note: "Franchise programs often require specific carriers." },
  full_service_restaurant: { conceptKey: "full_service_restaurant", annualPremium: { low: 4500, typical: 8500, high: 16e3 }, note: "Add liquor liability if serving alcohol ($2k-$6k additional)." },
  bar_nightlife: { conceptKey: "bar_nightlife", annualPremium: { low: 6500, typical: 14e3, high: 28e3 }, note: "Liquor liability is the primary cost driver." },
  juice_bar: { conceptKey: "juice_bar", annualPremium: { low: 1600, typical: 2800, high: 4800 }, note: "Low kitchen risk; product liability is the main category." },
  wellness_beverage: { conceptKey: "wellness_beverage", annualPremium: { low: 1600, typical: 2800, high: 4800 }, note: "Similar to juice bar — low fire risk." },
  retail: { conceptKey: "retail", annualPremium: { low: 1500, typical: 2500, high: 4500 }, note: "Lower GL baseline — no food handling." },
  florist: { conceptKey: "florist", annualPremium: { low: 1400, typical: 2400, high: 4e3 }, note: "Refrigerated inventory is the insurable asset." },
  fitness_studio: { conceptKey: "fitness_studio", annualPremium: { low: 2800, typical: 4800, high: 8500 }, note: "Member-injury GL + equipment coverage." },
  personal_services: { conceptKey: "personal_services", annualPremium: { low: 1800, typical: 3200, high: 5500 }, note: "Professional liability required for services touching clients." },
  wellness_spa: { conceptKey: "wellness_spa", annualPremium: { low: 3500, typical: 6500, high: 12e3 }, note: "Add professional liability + licensed practitioner coverage." },
  medical_office: { conceptKey: "medical_office", annualPremium: { low: 5e3, typical: 12e3, high: 28e3 }, note: "Malpractice is the dominant line; varies wildly by specialty." },
  coworking: { conceptKey: "coworking", annualPremium: { low: 3500, typical: 6e3, high: 11e3 }, note: "GL + property for member injury; tenant/landlord balance matters." }
};
function resolveInsuranceBenchmark(conceptKey) {
  return INSURANCE_BENCHMARKS[conceptKey] ?? null;
}
const CAM_ESTIMATES_PER_SF_MONTHLY = {
  C: { typical: 0.35, note: "Walk-up apartment with retail — landlord-borne utilities often rolled into CAM." },
  D: { typical: 0.75, note: "Elevator apartment — doorman/porter allocation adds to CAM." },
  K: { typical: 0.55, note: "Retail-primary building — cleanest CAM structure, fewer hidden charges." },
  L: { typical: 0.65, note: "Loft building — older systems, higher HVAC allocation." },
  O: { typical: 1.1, note: "Office building — lobby + elevators + common HVAC; highest CAM group." },
  R: { typical: 0.85, note: "Condo/co-op — board may pass through special assessments on top of CAM." },
  S: { typical: 0.3, note: "Small mixed-use — minimal common areas; low CAM." },
  H: { typical: 1.25, note: "Hotel ground-floor retail — 24/7 operations inflate shared utility costs." },
  Z: { typical: 0.6, note: "Mixed-use — negotiate the CAM formula line-by-line in the lease." }
};
const CAM_DEFAULT_PER_SF_MONTHLY = 0.5;
function resolveCamEstimate(bldgClass) {
  if (!bldgClass) return { perSfMonthly: CAM_DEFAULT_PER_SF_MONTHLY, note: "No building class on file — using city-wide default." };
  const letter = bldgClass.trim().toUpperCase().charAt(0);
  const entry = CAM_ESTIMATES_PER_SF_MONTHLY[letter];
  return entry ? { perSfMonthly: entry.typical, note: entry.note } : { perSfMonthly: CAM_DEFAULT_PER_SF_MONTHLY, note: "Building class not mapped — using city-wide default." };
}
function mapToFinancialModel(s) {
  let goNoGo = "go-with-conditions";
  if (s.goNoGo === "GO — with conditions") goNoGo = "go";
  else if (s.goNoGo === "NO-GO — here's why") goNoGo = "no-go";
  const yearRows = s.annualRows.map((r) => ({
    year: r.year,
    revenue: r.revenue,
    cogs: r.cogs,
    grossProfit: r.grossProfit,
    rent: r.rent,
    labor: r.labor,
    opex: r.opex,
    ebitda: r.ebitda,
    interest: r.interest,
    da: r.depreciation,
    netIncome: r.netIncome,
    ownersDraw: r.ownerDraw,
    dscr: isNaN(r.dscr) ? 0 : r.dscr
  }));
  const fmtK = (n) => Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;
  const bemStr = (m) => m != null ? `Month ${m}` : "Not within 3yr";
  const scenarios = [
    {
      label: "Year 1 Revenue",
      conservative: fmtK(s.scenarios.conservative.takeHomeY1 + s.scenarios.conservative.cashNeeded),
      base: fmtK(s.annualRows[0]?.revenue ?? 0),
      optimistic: fmtK(s.scenarios.optimistic.takeHomeY1 + s.scenarios.optimistic.cashNeeded)
    },
    {
      label: "Take-Home Year 1",
      conservative: fmtK(s.scenarios.conservative.takeHomeY1),
      base: fmtK(s.takeHomeY1),
      optimistic: fmtK(s.scenarios.optimistic.takeHomeY1)
    },
    {
      label: "Break-Even Month",
      conservative: bemStr(s.scenarios.conservative.breakEvenMonth),
      base: bemStr(s.breakEvenMonth),
      optimistic: bemStr(s.scenarios.optimistic.breakEvenMonth)
    },
    {
      label: "Cash Needed",
      conservative: fmtK(s.scenarios.conservative.cashNeeded),
      base: fmtK(s.cashNeeded),
      optimistic: fmtK(s.scenarios.optimistic.cashNeeded)
    }
  ];
  const conditions = s.conditions.filter((c) => !c.passed).map((c) => c.detail);
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
    yearRows,
    goNoGo,
    conditions,
    scenarios,
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
    totalInterest: s.totalInterest
  };
}
function calcMonthlyPayment(P, annualRatePct, termMonths) {
  if (P <= 0 || termMonths <= 0) return 0;
  if (annualRatePct <= 0) return P / termMonths;
  const r = annualRatePct / 100 / 12;
  return P * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}
function calcRemainingBalance(P, annualRatePct, termMonths, m) {
  if (P <= 0 || termMonths <= 0) return 0;
  if (annualRatePct <= 0) return Math.max(0, P - P / termMonths * m);
  const r = annualRatePct / 100 / 12;
  const n = termMonths;
  return P * (Math.pow(1 + r, n) - Math.pow(1 + r, m)) / (Math.pow(1 + r, n) - 1);
}
function calcInterestAtMonth(P, annualRatePct, termMonths, m) {
  if (P <= 0 || annualRatePct <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const bal = calcRemainingBalance(P, annualRatePct, termMonths, m - 1);
  return bal * r;
}
function getRampFactor(rampFactors, m) {
  return rampFactors[Math.min(m - 1, rampFactors.length - 1)] ?? 1;
}
function getMaturityCurve(m) {
  if (m >= 12) return 1;
  return 1.15 - 0.15 * (m - 1) / 11;
}
function getLaborEfficiency(m) {
  if (m >= 6) return 1;
  return 1.2 - 0.2 * (m - 1) / 5;
}
function creditScoreToRate(creditScore) {
  switch (creditScore) {
    case "excellent":
      return 8.5;
    case "good":
      return 9.5;
    case "fair":
      return 10.5;
    case "building":
      return 12;
    default:
      return 10.5;
  }
}
function getHourlyLaborRate(conceptKey) {
  const rates = {
    specialty_coffee: 18,
    bakery: 19,
    fast_casual: 19,
    qsr: 18,
    full_service_restaurant: 21,
    bar_nightlife: 22,
    juice_bar: 18,
    wellness_beverage: 18,
    retail: 18,
    fitness_studio: 20,
    personal_services: 22,
    medical_office: 25,
    florist: 19,
    wellness_spa: 22,
    coworking: 22
  };
  return rates[conceptKey] ?? 20;
}
function getDefaultMonthlyOpex(conceptKey) {
  const opex = {
    specialty_coffee: 5500,
    bakery: 5e3,
    fast_casual: 6e3,
    qsr: 5500,
    full_service_restaurant: 7500,
    bar_nightlife: 7e3,
    juice_bar: 4500,
    wellness_beverage: 4500,
    retail: 4e3,
    fitness_studio: 5500,
    personal_services: 3500,
    medical_office: 6e3,
    florist: 3e3,
    wellness_spa: 4500,
    coworking: 6e3
  };
  return opex[conceptKey] ?? 5e3;
}
function getEventCategory(conceptKey) {
  const map = {
    specialty_coffee: "food",
    bakery: "food",
    fast_casual: "food",
    qsr: "food",
    full_service_restaurant: "food",
    bar_nightlife: "food",
    juice_bar: "food",
    wellness_beverage: "food",
    retail: "retail",
    fitness_studio: "fitness",
    personal_services: "services",
    medical_office: "services",
    florist: "retail",
    wellness_spa: "services",
    coworking: "services"
  };
  return map[conceptKey] ?? "food";
}
function computeFullModel(inp) {
  const kpi = CONCEPT_KPIS[inp.conceptKey] ?? CONCEPT_KPIS["specialty_coffee"];
  const bc = kpi.businessCase ?? {
    // Safe fallback (should never hit if conceptKPIs.ts is complete)
    buildoutCost: 15e4,
    equipmentCost: 75e3,
    initialInventory: 8e3,
    permitsCost: 15e3,
    operatingHoursPerDay: 14,
    salvageRate: 0.15,
    valuationMultiple: 2.5,
    reinvestmentRate: { y1: 0.05, y2: 0.04, y3: 0.03, y4: 0.03, y5: 0.02 },
    usefulLifeYears: 10,
    footfallUnit: "customers",
    defaultLeaseTermYears: 10,
    defaultRentEscalation: 0.03,
    rampFactors: [
      0.45,
      0.52,
      0.58,
      0.63,
      0.68,
      0.72,
      0.76,
      0.8,
      0.84,
      0.87,
      0.91,
      0.95,
      0.97,
      0.99,
      1,
      1.01,
      1.02,
      1.03,
      1.05,
      1.06,
      1.07,
      1.08,
      1.09,
      1.1
    ]
  };
  const operatingDaysPerMonth = inp.daysPerWeek * 4.33 * 0.95;
  const operatingHoursPerDay = bc.operatingHoursPerDay;
  const ftRate = inp.fullTimeRate > 0 ? inp.fullTimeRate : getHourlyLaborRate(inp.conceptKey);
  const ptRate = inp.partTimeRate > 0 ? inp.partTimeRate : Math.max(15, ftRate - 3);
  const monthlyLaborCost = inp.fullTimeStaff * ftRate * 40 * 4.33 + inp.partTimeStaff * ptRate * 20 * 4.33;
  const effectiveLoanRate = inp.loanRate > 0 ? inp.loanRate : creditScoreToRate(inp.creditScore);
  const loanTermMonths = inp.loanTermYears * 12;
  const loanMonthlyPayment = calcMonthlyPayment(inp.loanAmount, effectiveLoanRate, loanTermMonths);
  const totalInterest = inp.loanAmount > 0 ? loanMonthlyPayment * loanTermMonths - inp.loanAmount : 0;
  inp.transitScore * 3 + inp.vibrancyScore * 2;
  const buildoutCost = bc.buildoutCost;
  const equipmentCost = bc.equipmentCost;
  const depositCost = inp.isCoop ? 0 : inp.monthlyRent * 2;
  const permitsCost = bc.permitsCost;
  const initialInventory = bc.initialInventory;
  const startupCosts = buildoutCost + equipmentCost + depositCost + permitsCost + initialInventory;
  const contingency = startupCosts * 0.1;
  const monthlyDepreciation = buildoutCost / (bc.usefulLifeYears * 12);
  const cogsDecimal = inp.cogsPercent / 100;
  const revenue = [];
  const cogs = [];
  const labor = [];
  const rent = [];
  const opex = [];
  const totalCosts = [];
  const cashFlow = [];
  const cumCF = [];
  const interest = [];
  const pctRate = Math.max(0, inp.percentageRentRate || 0);
  const pctBreak = Math.max(0, inp.percentageRentBreakpoint || 0);
  const hasPctRent = pctRate > 0 && pctBreak > 0;
  const pctRentByYear = [0, 0, 0, 0, 0];
  let yearToDateRev = 0;
  const effectiveEscalation = inp.escalationPct > 0 ? Math.min(0.15, inp.escalationPct) : bc.defaultRentEscalation;
  for (let i = 0; i < 60; i++) {
    const m = i + 1;
    const yearIdx = Math.floor(i / 12);
    const monthOfYear = i % 12;
    const ramp = getRampFactor(bc.rampFactors, m);
    const maturity = getMaturityCurve(m);
    const laborEff = getLaborEfficiency(m);
    const rentEscFactor = Math.pow(1 + effectiveEscalation, yearIdx);
    const opexInflFactor = Math.pow(1.02, yearIdx);
    const rev = inp.dailyCustomers * inp.avgTicket * operatingDaysPerMonth * ramp;
    const cg = rev * cogsDecimal * maturity;
    const lab = monthlyLaborCost * laborEff;
    const baseRnt = inp.monthlyRent * rentEscFactor;
    const opx = inp.monthlyOpEx * opexInflFactor;
    const intr = calcInterestAtMonth(inp.loanAmount, effectiveLoanRate, loanTermMonths, m);
    const taxEscFactor = Math.pow(1 + (inp.taxEscalationAnnual || 0), yearIdx);
    const tp = (inp.monthlyTaxPassThrough || 0) * taxEscFactor;
    yearToDateRev += rev;
    let pctRentThisMonth = 0;
    if (hasPctRent && monthOfYear === 11) {
      const overage = Math.max(0, yearToDateRev - pctBreak);
      pctRentThisMonth = overage * pctRate;
      if (yearIdx < 5) pctRentByYear[yearIdx] = pctRentThisMonth;
      yearToDateRev = 0;
    }
    const rnt = baseRnt + pctRentThisMonth;
    const costs = cg + lab + rnt + tp + opx + loanMonthlyPayment;
    const cf = rev - costs;
    revenue.push(rev);
    cogs.push(cg);
    labor.push(lab);
    rent.push(rnt + tp);
    opex.push(opx);
    totalCosts.push(costs);
    cashFlow.push(cf);
    interest.push(intr);
    cumCF.push(i === 0 ? cf - startupCosts : (cumCF[i - 1] ?? 0) + cf);
  }
  let breakEvenMonth = null;
  for (let i = 0; i < 36; i++) {
    if ((cashFlow[i] ?? 0) > 0) {
      breakEvenMonth = i + 1;
      break;
    }
  }
  let negativeBurn = 0;
  const bem = breakEvenMonth ?? 36;
  for (let i = 0; i < bem; i++) {
    if ((cashFlow[i] ?? 0) < 0) negativeBurn += Math.abs(cashFlow[i] ?? 0);
  }
  const cashNeeded = startupCosts + negativeBurn;
  const annRevY1 = revenue.slice(0, 12).reduce((s, v) => s + v, 0);
  const annCostY1 = totalCosts.slice(0, 12).reduce((s, v) => s + v, 0);
  const reinvY1 = annRevY1 * bc.reinvestmentRate.y1;
  const takeHomeY1 = annRevY1 - annCostY1 - reinvY1;
  const costToOpen = startupCosts + contingency;
  const monthlyBERevenue = totalCosts[11] ?? 0;
  const dailyBERevenue = monthlyBERevenue / Math.max(operatingDaysPerMonth, 1);
  const hourlyBERevenue = dailyBERevenue / Math.max(operatingHoursPerDay, 1);
  const breakEvenPerHour = Math.ceil(hourlyBERevenue / Math.max(inp.avgTicket, 0.01));
  const breakEvenPerDay = breakEvenPerHour * operatingHoursPerDay;
  const plannedHourlyCusts = inp.dailyCustomers / Math.max(operatingHoursPerDay, 1);
  const locationDeltaPct = breakEvenPerHour > 0 ? (plannedHourlyCusts - breakEvenPerHour) / breakEvenPerHour * 100 : 0;
  const remainingLeaseMonths = bc.defaultLeaseTermYears * 12 - 24;
  const pgExposure = inp.isCoop || !inp.hasPersonalGuarantee ? 0 : Math.max(0, remainingLeaseMonths) * inp.monthlyRent;
  const loanBalAtM24 = calcRemainingBalance(inp.loanAmount, effectiveLoanRate, loanTermMonths, 24);
  const unrecoverableBuildout = buildoutCost * (1 - bc.salvageRate);
  const maxLoss = {
    equity: inp.personalInvestment,
    pg: pgExposure,
    loans: loanBalAtM24,
    buildout: unrecoverableBuildout,
    total: inp.personalInvestment + pgExposure + loanBalAtM24 + unrecoverableBuildout
  };
  const remainingCash = negativeBurn;
  let sensitivityMonths = null;
  let cashBalance = remainingCash;
  for (let i = 0; i < 60; i++) {
    const stressedCF = (revenue[i] ?? 0) * 0.8 - (totalCosts[i] ?? 0);
    cashBalance += stressedCF;
    if (cashBalance < 0) {
      sensitivityMonths = i + 1;
      break;
    }
  }
  const annRevY3 = revenue.slice(24, 36).reduce((s, v) => s + v, 0);
  const annCostY3 = totalCosts.slice(24, 36).reduce((s, v) => s + v, 0);
  const reinvY3 = annRevY3 * bc.reinvestmentRate.y3;
  const takeHomeY3 = annRevY3 - annCostY3 - reinvY3;
  const annRevY5 = revenue.slice(48, 60).reduce((s, v) => s + v, 0);
  const annCostY5 = totalCosts.slice(48, 60).reduce((s, v) => s + v, 0);
  const takeHomeY5 = annRevY5 - annCostY5;
  const annualDepr = buildoutCost / bc.usefulLifeYears;
  const sdeY5 = takeHomeY5 + annualDepr;
  const valuationY5 = sdeY5 * bc.valuationMultiple;
  const annDebtService = loanMonthlyPayment * 12;
  const dscrByYear = [1, 2, 3, 4, 5].map((yr) => {
    if (inp.loanAmount <= 0) return NaN;
    const start = (yr - 1) * 12;
    const annRev = revenue.slice(start, start + 12).reduce((s, v) => s + v, 0);
    const annCogs = cogs.slice(start, start + 12).reduce((s, v) => s + v, 0);
    const annLab = labor.slice(start, start + 12).reduce((s, v) => s + v, 0);
    const annRnt = rent.slice(start, start + 12).reduce((s, v) => s + v, 0);
    const annOpx = opex.slice(start, start + 12).reduce((s, v) => s + v, 0);
    const annEbitda = annRev - annCogs - annLab - annRnt - annOpx;
    return annEbitda / Math.max(annDebtService, 1);
  });
  const cond1 = inp.loanAmount <= 0 || (dscrByYear[0] ?? 0) >= 1.15;
  const cond2 = breakEvenMonth !== null && breakEvenMonth <= 18;
  const cond3 = takeHomeY1 > 0;
  const cond5 = sensitivityMonths === null || sensitivityMonths >= 3;
  const beMonthDisplay = breakEvenMonth ? `Month ${breakEvenMonth}` : "not within 3 years";
  const dscrY1Display = isNaN(dscrByYear[0] ?? NaN) ? "N/A (no loan)" : `${(dscrByYear[0] ?? 0).toFixed(2)}x`;
  const fmt = (n) => `$${Math.round(Math.abs(n)).toLocaleString()}`;
  const conditions = [
    {
      id: "c1_dscr",
      passed: cond1,
      label: "Debt service coverage",
      detail: inp.loanAmount <= 0 ? "Self-funded — no debt service required" : `DSCR Year 1 is ${dscrY1Display} (SBA minimum: 1.15x)`
    },
    {
      id: "c2_breakeven",
      passed: cond2,
      label: "Break-even timeline",
      detail: `Break-even is ${beMonthDisplay} (target: within 18 months)`
    },
    {
      id: "c3_takehome",
      passed: cond3,
      label: "Year 1 owner income",
      detail: takeHomeY1 > 0 ? `Year 1 take-home is ${fmt(takeHomeY1)} (positive)` : `Year 1 take-home is −${fmt(takeHomeY1)} (still in the hole)`
    },
    // B3-1.4: c4_location removed — see comment above cond1 block.
    {
      id: "c5_sensitivity",
      passed: cond5,
      label: "Stress-test survivability",
      detail: sensitivityMonths === null ? "Runway covered — positive cashflow even under 20% revenue stress" : sensitivityMonths >= 60 ? "Survives 5+ years under 20% revenue stress" : `Cash runs out in ${sensitivityMonths} ${sensitivityMonths === 1 ? "month" : "months"} under 20% revenue stress`
    }
  ];
  const passedCount = conditions.filter((c) => c.passed).length;
  const evidenceFor = conditions.filter((c) => c.passed).map((c) => c.detail);
  const evidenceAgainst = conditions.filter((c) => !c.passed).map((c) => c.detail);
  let goNoGo;
  if (passedCount === 4) goNoGo = "GO — with conditions";
  else if (passedCount >= 2) goNoGo = "GO — with significant conditions";
  else goNoGo = "NO-GO — here's why";
  const _editSig = extractEditorialSignal(inp.analysisAddress || "", inp.conceptKey);
  const _editBias = editorialScenarioBias(_editSig);
  function computeScenario(factor, label, editFactor = 0, editLabel = null) {
    const adjustedFactor = factor * (1 + editFactor);
    const ticketFactor = adjustedFactor < 1 ? 0.95 : 1.05;
    const sDC = inp.dailyCustomers * adjustedFactor;
    const sAT = inp.avgTicket * ticketFactor;
    const sRevenue = [];
    const sCosts = [];
    const sCF = [];
    for (let i = 0; i < 60; i++) {
      const m = i + 1;
      const r = getRampFactor(bc.rampFactors, m);
      const rev = sDC * sAT * operatingDaysPerMonth * r;
      const cg = rev * cogsDecimal * getMaturityCurve(m);
      const lab = monthlyLaborCost * getLaborEfficiency(m);
      const rnt = inp.monthlyRent * Math.pow(1 + bc.defaultRentEscalation, Math.floor(i / 12));
      const opx = inp.monthlyOpEx * Math.pow(1.02, Math.floor(i / 12));
      sRevenue.push(rev);
      const cost = cg + lab + rnt + opx + loanMonthlyPayment;
      sCosts.push(cost);
      sCF.push(rev - cost);
    }
    let sBEM = null;
    for (let i = 0; i < 36; i++) {
      if ((sCF[i] ?? 0) > 0) {
        sBEM = i + 1;
        break;
      }
    }
    let sNegBurn = 0;
    for (let i = 0; i < (sBEM ?? 36); i++) {
      if ((sCF[i] ?? 0) < 0) sNegBurn += Math.abs(sCF[i] ?? 0);
    }
    const sCashNeeded = startupCosts + sNegBurn;
    const sAnnRevY1 = sRevenue.slice(0, 12).reduce((s, v) => s + v, 0);
    const sAnnCostY1 = sCosts.slice(0, 12).reduce((s, v) => s + v, 0);
    const sTakeHomeY1 = sAnnRevY1 - sAnnCostY1 - sAnnRevY1 * bc.reinvestmentRate.y1;
    const sAnnRevY3 = sRevenue.slice(24, 36).reduce((s, v) => s + v, 0);
    const sAnnCostY3 = sCosts.slice(24, 36).reduce((s, v) => s + v, 0);
    const sTakeHomeY3 = sAnnRevY3 - sAnnCostY3 - sAnnRevY3 * bc.reinvestmentRate.y3;
    let sDscr1 = NaN;
    if (inp.loanAmount > 0) {
      const sRevY1 = sRevenue.slice(0, 12).reduce((s, v) => s + v, 0);
      const sCgY1 = sRevY1 * cogsDecimal;
      const sLabY1 = labor.slice(0, 12).reduce((s, v) => s + v, 0);
      const sRntY1 = rent.slice(0, 12).reduce((s, v) => s + v, 0);
      const sOpxY1 = opex.slice(0, 12).reduce((s, v) => s + v, 0);
      const sEbitda = sRevY1 - sCgY1 - sLabY1 - sRntY1 - sOpxY1;
      sDscr1 = sEbitda / Math.max(annDebtService, 1);
    }
    return {
      label,
      factor: adjustedFactor,
      dailyCustomers: sDC,
      avgTicket: sAT,
      breakEvenMonth: sBEM,
      takeHomeY1: sTakeHomeY1,
      takeHomeY3: sTakeHomeY3,
      cashNeeded: sCashNeeded,
      dscrY1: sDscr1,
      editorialLabel: editLabel,
      editorialFactor: editFactor
    };
  }
  const scenarios = {
    conservative: computeScenario(0.8, "Conservative (−20%)"),
    base: computeScenario(1, "Base"),
    optimistic: computeScenario(1.25, "Optimistic (+25%)", _editBias.factor, _editBias.label)
  };
  const monthlyRows = revenue.map((rev, i) => {
    const m = i + 1;
    const yr = Math.floor(i / 12);
    const rRate = bc.reinvestmentRate[`y${yr + 1}`] ?? 0.03;
    const grossP = rev - (cogs[i] ?? 0);
    const ebitda = grossP - (labor[i] ?? 0) - (rent[i] ?? 0) - (opex[i] ?? 0);
    const intr = interest[i] ?? 0;
    const netInc = ebitda - intr - monthlyDepreciation;
    const draw = Math.max(0, netInc * (1 - rRate));
    const dscr = inp.loanAmount > 0 && loanMonthlyPayment > 0 ? (netInc + intr + monthlyDepreciation) / loanMonthlyPayment : NaN;
    return {
      month: m,
      revenue: rev,
      cogs: cogs[i] ?? 0,
      grossProfit: grossP,
      labor: labor[i] ?? 0,
      rent: rent[i] ?? 0,
      opex: opex[i] ?? 0,
      ebitda,
      interest: intr,
      depreciation: monthlyDepreciation,
      netIncome: netInc,
      ownerDraw: draw,
      cashFlow: cashFlow[i] ?? 0,
      cumulativeCF: cumCF[i] ?? 0,
      dscr
    };
  });
  const annualRows = [1, 2, 3, 4, 5].map((yr) => {
    const rows = monthlyRows.slice((yr - 1) * 12, yr * 12);
    const sum = (key) => rows.reduce((s, r) => s + r[key], 0);
    const rRate = bc.reinvestmentRate[`y${yr}`] ?? 0.03;
    const annNI = sum("netIncome");
    const draw = Math.max(0, annNI * (1 - rRate));
    const dscr = inp.loanAmount > 0 && annDebtService > 0 ? (sum("netIncome") + sum("interest") + sum("depreciation")) / annDebtService : NaN;
    return {
      year: yr,
      revenue: sum("revenue"),
      cogs: sum("cogs"),
      grossProfit: sum("grossProfit"),
      labor: sum("labor"),
      rent: sum("rent"),
      opex: sum("opex"),
      ebitda: sum("ebitda"),
      interest: sum("interest"),
      depreciation: sum("depreciation"),
      netIncome: annNI,
      ownerDraw: draw,
      dscr
    };
  });
  const useOfFunds = {
    buildout: buildoutCost,
    equipment: equipmentCost,
    deposit: depositCost,
    workingCapital: negativeBurn,
    permits: permitsCost,
    initialInventory,
    contingency,
    total: startupCosts + contingency
  };
  const fundingGap = Math.max(0, cashNeeded - inp.personalInvestment - inp.loanAmount);
  const taxPtM1 = inp.monthlyTaxPassThrough;
  const annualBaseRent = inp.monthlyRent * 12;
  const isManhattanAddress = (inp.analysisAddress || "").toLowerCase().includes("manhattan") || (inp.analysisAddress || "").toLowerCase().includes(", ny 100") || (inp.analysisAddress || "").toLowerCase().includes(", ny 101");
  const isSouthOf96th = typeof inp.lat === "number" ? inp.lat <= 40.7838 : true;
  const CRT_RATE = 0.039;
  const CRT_RENT_FLOOR = 25e4;
  const crtApplies = isManhattanAddress && isSouthOf96th && annualBaseRent > CRT_RENT_FLOOR;
  const monthlyCrt = crtApplies ? Math.round(inp.monthlyRent * CRT_RATE) : 0;
  const bidMatch = resolveBidAssessment(inp.analysisAddress);
  const monthlyBid = bidMatch ? Math.round(annualBaseRent * bidMatch.rateOfBaseRent / 12) : 0;
  const insuranceBenchmark = resolveInsuranceBenchmark(inp.conceptKey);
  const monthlyInsurance = insuranceBenchmark ? Math.round(insuranceBenchmark.annualPremium.typical / 12) : 250;
  const camEstimate = resolveCamEstimate(inp.bldgClass ?? null);
  const monthlyCAM = Math.round(camEstimate.perSfMonthly * Math.max(inp.squareFootage, 1));
  const occupancyCostBreakdown = {
    baseRent: inp.monthlyRent,
    taxPassThrough: taxPtM1,
    crt: monthlyCrt,
    bid: monthlyBid,
    insurance: monthlyInsurance,
    cam: monthlyCAM,
    total: inp.monthlyRent + taxPtM1 + monthlyCrt + monthlyBid + monthlyInsurance + monthlyCAM,
    // Metadata for UX tooltip rendering
    crtApplies,
    bidName: bidMatch?.name ?? null,
    insuranceNote: insuranceBenchmark?.note ?? null,
    camNote: camEstimate.note
  };
  const m1Rev = revenue[0] ?? 0;
  const annRevY1Val = annRevY1;
  const eventCategory = getEventCategory(inp.conceptKey);
  const universalEvents = [
    {
      id: "u1_competitor",
      risk: "Competitor Opens Nearby",
      category: "universal",
      dollarImpact: Math.round(m1Rev * 0.15 * 6),
      impactLabel: `${fmt(m1Rev * 0.15 * 6)} (−15% revenue × 6 months)`,
      meaning: "Revenue dip as market adjusts; loyal customers erode without action",
      action: `Lock in regulars now. Differentiate on ${kpi.label.toLowerCase()} specifics — lean into what chains can't replicate.`
    },
    {
      id: "u2_lease_loss",
      risk: "Building Sale / Lease Loss",
      category: "universal",
      dollarImpact: Math.round(unrecoverableBuildout + depositCost + 15e3),
      impactLabel: `${fmt(unrecoverableBuildout + depositCost + 15e3)} (buildout loss + deposit + relocation)`,
      meaning: "Complete loss of non-recoverable buildout, deposit, and moving costs",
      action: "Negotiate assignment clause now. Keep build-out modular where possible."
    },
    {
      id: "u3_construction",
      risk: "Street Construction / DOT Project",
      category: "universal",
      dollarImpact: Math.round(m1Rev * 0.35 * 4),
      impactLabel: `${fmt(m1Rev * 0.35 * 4)} (−35% revenue × 4 months)`,
      meaning: "Sidewalk closures reduce foot traffic; delivery partially offsets",
      action: "Check NYC DOT Capital Projects tracker before signing lease. Negotiate rent abatement clause."
    }
  ];
  const foodEvents = [
    {
      id: "f1_permit",
      risk: "DOB Permit Delay",
      category: "food",
      dollarImpact: Math.round(inp.monthlyRent * 3),
      impactLabel: `${fmt(inp.monthlyRent * 3)} (3 months dead rent)`,
      meaning: "+1–3 months paying rent before a single dollar of revenue",
      action: "Start DOB filing 6 months before target open. Budget for 2-month delay minimum."
    },
    {
      id: "f2_rent_spike",
      risk: "Rent Escalation Spike",
      category: "food",
      dollarImpact: Math.round(inp.monthlyRent * 0.01 * 12),
      impactLabel: `${fmt(inp.monthlyRent * 0.01 * 12)}/yr per extra 1% above expected escalation`,
      meaning: "Uncapped escalation compresses margin permanently",
      action: "Negotiate 3% annual cap in lease. Model worst-case in your projections."
    },
    {
      id: "f3_turnover",
      risk: "Staff Turnover (2 replacements)",
      category: "food",
      dollarImpact: 1e4,
      impactLabel: "$10,000 (~$5K per replacement + quality dip)",
      meaning: "4–6 week quality dip per departure; customer experience affected",
      action: "Cross-train. Pay above market. Build operations manual before launch."
    },
    {
      id: "f4_food_cost",
      risk: "Food Cost Inflation (+5% COGS)",
      category: "food",
      dollarImpact: Math.round(annRevY1Val * 0.05),
      impactLabel: `${fmt(annRevY1Val * 0.05)} lost margin (5% of Year 1 revenue)`,
      meaning: "Supplier price hikes compress already-thin margins directly",
      action: "Lock supplier pricing contracts. Adjust menu pricing quarterly. Build 2% buffer into COGS."
    }
  ];
  const fitnessEvents = [
    {
      id: "fit1_seasonal",
      risk: "Post-NYE Membership Drop (Jan–Mar)",
      category: "fitness",
      dollarImpact: Math.round(m1Rev * 0.25 * 3),
      impactLabel: `${fmt(m1Rev * 0.25 * 3)} (−25% revenue × 3 months)`,
      meaning: "Resolution members cancel; consistent members stay but revenue dips",
      action: "Pre-sell annual contracts in November. Heavy retention campaign in December."
    },
    {
      id: "fit2_equipment",
      risk: "Equipment Failure",
      category: "fitness",
      dollarImpact: 15e3,
      impactLabel: "$15,000 (avg replacement + repair, plus member churn risk)",
      meaning: "Core equipment down = classes canceled = churn accelerates",
      action: "Equipment insurance. Preventive maintenance schedule. $10K reserve fund."
    },
    {
      id: "fit3_franchise",
      risk: "New Franchise Opens Nearby",
      category: "fitness",
      dollarImpact: Math.round(m1Rev * 0.25 * 6),
      impactLabel: `${fmt(m1Rev * 0.25 * 6)} (−25% members × 6 months)`,
      meaning: "Price and marketing power of franchise cannibalizes casual members",
      action: "Community-first model. Loyalty rewards. Niche positioning that franchises can't replicate."
    },
    {
      id: "fit4_liability",
      risk: "Liability Incident",
      category: "fitness",
      dollarImpact: 25e3,
      impactLabel: "$25,000 (exposure beyond standard insurance coverage)",
      meaning: "Injury claim above policy limit; reputation damage accelerates churn",
      action: "Waivers. Proper liability insurance ($2M minimum). All staff certified and background-checked."
    }
  ];
  const retailEvents = [
    {
      id: "r1_shrinkage",
      risk: "Inventory Shrinkage",
      category: "retail",
      dollarImpact: Math.round(annRevY1Val * 0.02),
      impactLabel: `${fmt(annRevY1Val * 0.02)} (2% of Year 1 revenue to theft/damage)`,
      meaning: "Theft + damage is industry-wide; negligence makes it worse",
      action: "Security cameras. POS with inventory tracking. Staff training on loss prevention."
    },
    {
      id: "r2_ecommerce",
      risk: "E-Commerce Competition Accelerates",
      category: "retail",
      dollarImpact: Math.round(m1Rev * 0.15 * 12),
      impactLabel: `${fmt(m1Rev * 0.15 * 12)} (−15% foot traffic trend annually)`,
      meaning: "Online convenience permanently erodes walk-in traffic in most categories",
      action: "Experiential retail. Local-only or exclusive products. Click-and-collect capability."
    },
    {
      id: "r3_seasonal",
      risk: "Seasonal Cash Crunch (Jan–Apr)",
      category: "retail",
      dollarImpact: Math.round((totalCosts[0] ?? 0) * 3),
      impactLabel: `${fmt((totalCosts[0] ?? 0) * 3)} (3 months costs with minimal revenue)`,
      meaning: "60–70% of revenue concentrated in Q4 leaves 4 lean months",
      action: "Reserve 3 months operating costs. Diversify seasonal mix to even cash flow."
    },
    {
      id: "r4_supply",
      risk: "Supply Chain Disruption",
      category: "retail",
      dollarImpact: Math.round(m1Rev * 0.3),
      impactLabel: `${fmt(m1Rev * 0.3)} (−30% revenue during 2–4 week stockout)`,
      meaning: "Empty shelves drive customers to competitors permanently",
      action: "Multiple suppliers. Safety stock (4-week buffer). Pre-order system for top SKUs."
    }
  ];
  const servicesEvents = [
    {
      id: "s1_provider",
      risk: "Key Provider Departure",
      category: "services",
      dollarImpact: Math.round(m1Rev * 0.15),
      impactLabel: `${fmt(m1Rev * 0.15)}/month (30–50% of their client book walks out)`,
      meaning: "Client loyalty attaches to the person, not the brand, early on",
      action: "Non-compete clauses. Cross-book clients across providers. Build brand over individual."
    },
    {
      id: "s2_review",
      risk: "Online Review Crisis",
      category: "services",
      dollarImpact: Math.round(m1Rev * 0.4 * 2),
      impactLabel: `${fmt(m1Rev * 0.4 * 2)} (−40% bookings × 2 months)`,
      meaning: "1-star spiral cuts new bookings; recovery takes 6–12 months minimum",
      action: "Review response protocol before launch. Quality control checkpoints. Incentivize positive reviews."
    },
    {
      id: "s3_compliance",
      risk: "Licensing / Compliance Fine",
      category: "services",
      dollarImpact: 12e3,
      impactLabel: "$12,000 (surprise inspection fine $5–15K range)",
      meaning: "Regulatory surprise = immediate cost + forced operational pause",
      action: "Compliance calendar. Pre-inspection audits. Proper licensing before first client."
    },
    {
      id: "s4_trend",
      risk: "Service Category Trend Shift",
      category: "services",
      dollarImpact: Math.round(m1Rev * 0.15 * 12),
      impactLabel: `${fmt(m1Rev * 0.15 * 12)} (−15% annual demand trend)`,
      meaning: "Category demand declines; concept locked into lease and buildout",
      action: "Diversify service menu. Continuous education. Build pivot flexibility into operations."
    }
  ];
  const categoryMap = {
    food: foodEvents,
    fitness: fitnessEvents,
    retail: retailEvents,
    services: servicesEvents
  };
  const marketEvents = [
    ...universalEvents,
    ...categoryMap[eventCategory] ?? foodEvents
  ];
  const validations = [];
  const warn = (field, sev, message, value, range) => validations.push({ field, severity: sev, message, value, range });
  if (breakEvenMonth !== null) {
    if (breakEvenMonth < 3) warn("break_even_month", "WARNING", "Break-even unusually fast — check ramp factors for over-optimism", breakEvenMonth, "3–24 months expected");
    if (breakEvenMonth > 24) warn("break_even_month", "WARNING", "Break-even beyond 24 months — concept may not be viable at this location", breakEvenMonth, "3–24 months expected");
  }
  if (cashNeeded < 5e4) warn("cash_needed", "WARNING", "Cash needed under $50K — likely missing costs (check buildout and equipment)", cashNeeded, "$50K–$2M");
  if (cashNeeded > 2e6) warn("cash_needed", "WARNING", "Cash needed over $2M — unusual for single-unit; verify buildout assumptions", cashNeeded, "$50K–$2M");
  if (takeHomeY1 > 2e5) warn("take_home_y1", "WARNING", "Year 1 take-home over $200K — check COGS and labor inputs for errors", takeHomeY1, "−$100K to +$200K");
  if (takeHomeY1 < -1e5) warn("take_home_y1", "WARNING", "Year 1 take-home below −$100K — model may be misconfigured", takeHomeY1, "−$100K to +$200K");
  const dscrY1 = dscrByYear[0] ?? NaN;
  if (!isNaN(dscrY1)) {
    if (dscrY1 < 1) warn("dscr_y1", "FLAG", `DSCR ${dscrY1.toFixed(2)}x — cannot cover debt service (below 1.0x)`, dscrY1, "0.5x–3.0x");
    else if (dscrY1 < 1.15) warn("dscr_y1", "FLAG", `DSCR ${dscrY1.toFixed(2)}x — below SBA minimum of 1.15x`, dscrY1, "1.15x+ for SBA");
    if (dscrY1 > 3) warn("dscr_y1", "FLAG", "DSCR above 3.0x — loan amount may be too small relative to cash needs", dscrY1, "0.5x–3.0x");
  }
  if (breakEvenPerHour < 5) warn("breakeven_footfalls", "WARNING", "Breakeven under 5/hr — very low volume concept; verify ticket size", breakEvenPerHour, "5–100/hr");
  if (breakEvenPerHour > 100) warn("breakeven_footfalls", "WARNING", "Breakeven over 100/hr — extremely high volume needed; check avg ticket", breakEvenPerHour, "5–100/hr");
  if (locationDeltaPct < -50) warn("location_delta", "FLAG", "Location delivers less than 50% of needed traffic — concept+location pairing may be wrong", Math.round(locationDeltaPct), "−100% to +200%");
  if (locationDeltaPct > 100) warn("location_delta", "FLAG", "Location delta over +100% — check capture rate assumption", Math.round(locationDeltaPct), "−100% to +200%");
  if (maxLoss.total > 3e6) warn("max_loss", "FLAG", `Maximum exposure ${fmt(maxLoss.total)} — extreme PG risk; review lease terms carefully`, maxLoss.total, "Up to $3M typical");
  if (sensitivityMonths < 3) warn("sensitivity_months", "FLAG", "Cash runs out in under 3 months under 20% stress — critical risk", sensitivityMonths, "3+ months recommended");
  else if (sensitivityMonths < 6) warn("sensitivity_months", "FLAG", `Only ${sensitivityMonths} months of buffer under 20% stress — cautionary`, sensitivityMonths, "6+ months healthy");
  if (valuationY5 < startupCosts) warn("valuation_y5", "WARNING", "Business worth less at Year 5 than it cost to open — check growth assumptions", valuationY5, `Above ${fmt(startupCosts)}`);
  const rentToRevenuePct = m1Rev > 0 ? inp.monthlyRent / m1Rev * 100 : 0;
  if (rentToRevenuePct > 25) warn("rent_to_revenue", "FLAG", `Rent is ${Math.round(rentToRevenuePct)}% of revenue — model is broken above 25%`, Math.round(rentToRevenuePct), "5%–25%");
  else if (rentToRevenuePct > 20) warn("rent_to_revenue", "FLAG", `Rent is ${Math.round(rentToRevenuePct)}% of revenue — kill-factor territory (>20%)`, Math.round(rentToRevenuePct), "5%–20%");
  else if (rentToRevenuePct > 15) warn("rent_to_revenue", "FLAG", `Rent is ${Math.round(rentToRevenuePct)}% of revenue — compressed margin`, Math.round(rentToRevenuePct), "5%–15% healthy");
  if (inp.monthlyTaxPassThrough > 0 && m1Rev > 0) {
    const ocrPct = (inp.monthlyRent + inp.monthlyTaxPassThrough) / m1Rev * 100;
    if (ocrPct > 25) warn("occupancy_cost_ratio", "BLOCK", `Total occupancy cost (rent + property tax) is ${Math.round(ocrPct)}% of revenue — unviable`, Math.round(ocrPct), "Below 18%");
    else if (ocrPct > 18) warn("occupancy_cost_ratio", "FLAG", `Total occupancy cost (rent + property tax) is ${Math.round(ocrPct)}% of revenue — above 18% kill threshold`, Math.round(ocrPct), "Below 18%");
  }
  {
    const r3BC = rule3RevPerSFFloor({ businessType: inp.conceptKey, concept: inp.conceptKey });
    if (!r3BC.passes) {
      const implied = r3BC.data.impliedRevPerSF ?? 0;
      const floor = r3BC.data.floor ?? 150;
      warn("rev_per_sf_floor", "FLAG", `Benchmark revenue-per-SF ($${implied}/SF) is below the $${floor}/SF floor for this concept — BC economics may not work at current footprint/ticket assumptions`, implied, `Above $${floor}/SF`);
    }
  }
  {
    const r2BC = rule2RentEscalation({
      businessType: inp.conceptKey,
      concept: inp.conceptKey,
      leaseTerms: {
        baseRentMonthly: inp.monthlyRent,
        escalationPct: effectiveEscalation
      }
    });
    if (!r2BC.passes) {
      const pct = r2BC.data.year3RentPctDisplay ?? 0;
      const ceilingPct = r2BC.data.ceilingPct ?? 0;
      const escUsed = r2BC.data.escalationPctUsed ?? 3;
      warn("rent_escalation_stress", "FLAG", `Year 3 projected rent reaches ~${pct}% of revenue at ${escUsed}%/yr escalation, exceeding the ${ceilingPct}% occupancy ceiling for this concept. Negotiate a lower escalation (2% or CPI-capped) or a free-rent period.`, pct, `≤${ceilingPct}%`);
    }
  }
  if (hasPctRent) {
    const triggerYears = [];
    const triggerAmounts = [];
    for (let y = 0; y < 3; y++) {
      const overage = pctRentByYear[y] || 0;
      if (overage > 0) {
        triggerYears.push(y + 1);
        triggerAmounts.push(overage);
      }
    }
    void RULES[20].check({
      businessType: inp.conceptKey,
      concept: inp.conceptKey,
      leaseTerms: {
        baseRentMonthly: inp.monthlyRent,
        escalationPct: effectiveEscalation,
        percentageRentRate: pctRate,
        percentageRentBreakpoint: pctBreak
      },
      revenueY1toY3: {
        y1: annRevY1,
        y2: annualRows[1]?.revenue ?? 0,
        y3: annualRows[2]?.revenue ?? 0
      }
    });
    if (triggerYears.length === 0) {
      warn("percentage_rent", "WARNING", `Percentage rent clause present (${Math.round(pctRate * 100)}% over ${fmt(pctBreak)} annual breakpoint) — does not trigger in the first 3 years at current revenue projections.`, 0, `Dormant below ${fmt(pctBreak)}/yr`);
    } else {
      const firstYr = triggerYears[0];
      const firstAmt = triggerAmounts[0];
      const total3yr = triggerAmounts.reduce((s, v) => s + v, 0);
      const severity = total3yr > annRevY1 * 0.03 ? "FLAG" : "WARNING";
      warn("percentage_rent", severity, `Percentage rent triggers in Year ${firstYr}: ${fmt(firstAmt)} true-up (${Math.round(pctRate * 100)}% × overage above ${fmt(pctBreak)}). Y1–Y3 total ${fmt(total3yr)}. Negotiate a higher breakpoint or natural breakpoint (rate × base rent ÷ rate) before signing.`, Math.round(total3yr), `0 (no clause) or breakpoint ≥ Y3 revenue`);
    }
  }
  if (inp.isCoop) {
    warn("coop_unit", "WARNING", "Building is a co-op — negotiating directly with board, not a commercial landlord. Confirm subletting rights and board approval process before proceeding.", "coop", "N/A");
  }
  if (inp.cogsPercent < 20 || inp.cogsPercent > 60) warn("cogs_percent", "BLOCK", `COGS ${inp.cogsPercent}% is outside valid range (20–60%) — model inputs may be misconfigured`, inp.cogsPercent, "20%–60%");
  const laborPct = annRevY1 > 0 ? (annualRows[0]?.labor ?? 0) / annRevY1 * 100 : 0;
  if (laborPct < 15 || laborPct > 40) warn("labor_percent", "WARNING", `Labor is ${Math.round(laborPct)}% of Year 1 revenue — outside 15–40% healthy range`, Math.round(laborPct), "15%–40%");
  return {
    breakEvenMonth,
    cashNeeded,
    takeHomeY1,
    startupCosts,
    negativeBurn,
    costToOpen,
    breakEvenPerHour,
    breakEvenPerDay,
    footfallUnit: bc.footfallUnit,
    locationDeltaPct,
    maxLoss,
    sensitivityMonths,
    takeHomeY3,
    valuationY5,
    dscrByYear,
    goNoGo,
    passedCount,
    conditions,
    evidenceFor,
    evidenceAgainst,
    scenarios,
    monthlyRows,
    annualRows,
    useOfFunds,
    loanAmount: inp.loanAmount,
    loanMonthlyPayment,
    loanRate: effectiveLoanRate,
    loanTermMonths,
    totalInterest,
    fundingGap,
    marketEvents,
    validations,
    occupancyCostBreakdown,
    isCoop: inp.isCoop
  };
}
const LS_KEY = "re2_business_case_inputs";
function createBusinessCaseStore() {
  let dailyCustomers = 180;
  let avgTicket = 8.75;
  let cogsPercent = 30;
  let fullTimeStaff = 2;
  let fullTimeRate = 22;
  let partTimeStaff = 3;
  let partTimeRate = 18;
  let monthlyRent = 5e3;
  let monthlyOpEx = 5e3;
  let daysPerWeek = 6;
  let loanAmount = 15e4;
  let loanTermYears = 10;
  let loanRate = 0;
  let conceptKey = "specialty_coffee";
  let conceptLabelVal = "Specialty Coffee";
  let analysisAddress = "";
  let locationLat = void 0;
  let locationBldgClass = void 0;
  let locationIQ = 0;
  let fitIQ = 0;
  let visionIQ = 0;
  let transitScore = 0;
  let vibrancyScore = 0;
  let personalInvestment = 5e4;
  let startupCapital = 2e5;
  let monthlyTaxPassThrough = 0;
  let taxEscalationAnnual = 0;
  let isCoop = false;
  let creditScore = "good";
  let squareFootage = 1e3;
  let hasPersonalGuarantee = true;
  let percentageRentRate = 0;
  let percentageRentBreakpoint = 0;
  let escalationPct = 0;
  function saveInputs() {
    if (typeof window === "undefined") return;
    if (!dailyCustomers || !avgTicket) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        dailyCustomers,
        avgTicket,
        cogsPercent,
        fullTimeStaff,
        fullTimeRate,
        partTimeStaff,
        partTimeRate,
        monthlyRent,
        monthlyOpEx,
        daysPerWeek,
        loanAmount,
        loanTermYears,
        loanRate,
        percentageRentRate,
        percentageRentBreakpoint,
        escalationPct
      }));
    } catch {
    }
  }
  function initFromSession() {
    if (typeof window === "undefined") return;
    try {
      const lp = JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
      const sess = JSON.parse(localStorage.getItem("re2_session") || "{}");
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      const incomingConcept = lp.businessType || sess.bizType || sess.visionBizType || "specialty_coffee";
      const previousConcept = sess._lastConcept;
      if (previousConcept && previousConcept !== incomingConcept) {
        const CONCEPT_FIELDS = [
          "conceptAnswers",
          "visionDifferentiators",
          "visionAvgCheck",
          "visionFoodProgram",
          "visionHours",
          "visionTargetAge",
          "visionStoreType",
          "visionTargetClients",
          "visionSeatingCapacity",
          "visionCreditScore"
        ];
        for (const f of CONCEPT_FIELDS) delete sess[f];
        sess._lastConcept = incomingConcept;
        try {
          localStorage.setItem("re2_session", JSON.stringify(sess));
        } catch {
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("re2:concept-changed", {
            detail: {
              from: previousConcept,
              to: incomingConcept,
              clearedFields: CONCEPT_FIELDS
            }
          }));
        }
      } else if (!previousConcept) {
        sess._lastConcept = incomingConcept;
        try {
          localStorage.setItem("re2_session", JSON.stringify(sess));
        } catch {
        }
      }
      conceptKey = incomingConcept;
      conceptLabelVal = getConceptLabel(conceptKey);
      analysisAddress = sess.analyzedAddress || lp.idealArea || "";
      locationLat = typeof sess.lat === "number" ? sess.lat : void 0;
      locationBldgClass = sess.pluto?.bldgClass ?? void 0;
      locationIQ = sess.locationIQ || 0;
      fitIQ = sess.fitIQ || 0;
      visionIQ = sess.visionIQ || 0;
      transitScore = sess.sixScores?.transit || 0;
      vibrancyScore = sess.sixScores?.vibrancy || 0;
      personalInvestment = lp.financialGoals?.personalInvestment || lp.personalInvestment || 5e4;
      startupCapital = lp.budget || lp.financialGoals?.startupCapital || 2e5;
      creditScore = lp.creditScore || lp.financialGoals?.creditScore || "good";
      squareFootage = lp.squareFootage || lp.financialGoals?.squareFootage || 1e3;
      hasPersonalGuarantee = lp.financialGoals?.hasPersonalGuarantee ?? true;
      monthlyTaxPassThrough = sess.propertyTax?.monthlyTaxPassThrough || 0;
      taxEscalationAnnual = sess.propertyTax?.escalationAnnual || 0;
      isCoop = sess.propertyTax?.isCoop ?? false;
      const kpi = CONCEPT_KPIS[conceptKey] ?? CONCEPT_KPIS["specialty_coffee"];
      const cDefs = getConceptDefaults(conceptKey);
      const bc = kpi?.businessCase;
      dailyCustomers = saved.dailyCustomers || sess.sliderDefaults?.dailyCustomers || kpi?.revenueParams?.defaultDailyTransactions || 180;
      avgTicket = saved.avgTicket || lp.financialGoals?.avgTicket || kpi?.revenueParams?.defaultAvgTicket || 8.75;
      cogsPercent = saved.cogsPercent || Math.round((kpi?.revenueParams?.defaultCogsPercent ?? 0.3) * 100);
      monthlyRent = saved.monthlyRent || lp.financialGoals?.monthlyRentBudget || lp.monthlyRentBudget || 5e3;
      monthlyOpEx = saved.monthlyOpEx || getDefaultMonthlyOpex(conceptKey);
      daysPerWeek = saved.daysPerWeek || kpi?.revenueParams?.defaultOperatingDaysPerWeek || 6;
      fullTimeStaff = saved.fullTimeStaff ?? (cDefs.team > 0 ? Math.max(1, Math.floor(cDefs.team * 0.4)) : 2);
      partTimeStaff = saved.partTimeStaff ?? (cDefs.team > 0 ? Math.ceil(cDefs.team * 0.6) : 3);
      fullTimeRate = saved.fullTimeRate || getHourlyLaborRate(conceptKey);
      partTimeRate = saved.partTimeRate || Math.max(15, getHourlyLaborRate(conceptKey) - 3);
      loanAmount = saved.loanAmount ?? 15e4;
      loanTermYears = saved.loanTermYears || 10;
      loanRate = saved.loanRate ?? 0;
      percentageRentRate = saved.percentageRentRate ?? 0;
      percentageRentBreakpoint = saved.percentageRentBreakpoint ?? 0;
      escalationPct = saved.escalationPct ?? 0;
    } catch {
    }
  }
  const model = derived(() => computeFullModel({
    dailyCustomers,
    avgTicket,
    cogsPercent,
    fullTimeStaff,
    fullTimeRate,
    partTimeStaff,
    partTimeRate,
    monthlyRent,
    monthlyOpEx,
    daysPerWeek,
    conceptKey,
    transitScore,
    vibrancyScore,
    personalInvestment,
    creditScore,
    squareFootage,
    hasPersonalGuarantee,
    loanAmount,
    loanTermYears,
    loanRate,
    monthlyTaxPassThrough,
    taxEscalationAnnual,
    isCoop,
    percentageRentRate,
    percentageRentBreakpoint,
    escalationPct,
    // B3-2.3: Geo context for CRT + BID + CAM
    analysisAddress,
    lat: locationLat,
    bldgClass: locationBldgClass
  }));
  return {
    // Sidebar inputs — two-way via explicit setters
    get dailyCustomers() {
      return dailyCustomers;
    },
    set dailyCustomers(v) {
      dailyCustomers = +v;
      saveInputs();
    },
    get avgTicket() {
      return avgTicket;
    },
    set avgTicket(v) {
      avgTicket = +v;
      saveInputs();
    },
    get cogsPercent() {
      return cogsPercent;
    },
    set cogsPercent(v) {
      cogsPercent = +v;
      saveInputs();
    },
    get fullTimeStaff() {
      return fullTimeStaff;
    },
    set fullTimeStaff(v) {
      fullTimeStaff = +v;
      saveInputs();
    },
    get fullTimeRate() {
      return fullTimeRate;
    },
    set fullTimeRate(v) {
      fullTimeRate = +v;
      saveInputs();
    },
    get partTimeStaff() {
      return partTimeStaff;
    },
    set partTimeStaff(v) {
      partTimeStaff = +v;
      saveInputs();
    },
    get partTimeRate() {
      return partTimeRate;
    },
    set partTimeRate(v) {
      partTimeRate = +v;
      saveInputs();
    },
    get monthlyRent() {
      return monthlyRent;
    },
    set monthlyRent(v) {
      monthlyRent = +v;
      saveInputs();
    },
    get monthlyOpEx() {
      return monthlyOpEx;
    },
    set monthlyOpEx(v) {
      monthlyOpEx = +v;
      saveInputs();
    },
    get daysPerWeek() {
      return daysPerWeek;
    },
    set daysPerWeek(v) {
      daysPerWeek = +v;
      saveInputs();
    },
    get loanAmount() {
      return loanAmount;
    },
    set loanAmount(v) {
      loanAmount = +v;
      saveInputs();
    },
    get loanTermYears() {
      return loanTermYears;
    },
    set loanTermYears(v) {
      loanTermYears = +v;
      saveInputs();
    },
    get loanRate() {
      return loanRate;
    },
    set loanRate(v) {
      loanRate = +v;
      saveInputs();
    },
    // VITAL RULE 20: Percentage rent clause — two-way via explicit setters
    get percentageRentRate() {
      return percentageRentRate;
    },
    set percentageRentRate(v) {
      percentageRentRate = +v;
      saveInputs();
    },
    get percentageRentBreakpoint() {
      return percentageRentBreakpoint;
    },
    set percentageRentBreakpoint(v) {
      percentageRentBreakpoint = +v;
      saveInputs();
    },
    // BR-B': Lease escalation (decimal, e.g. 0.03 = 3%) — two-way.
    // UX-EF binds the Lease Terms section input here. Setting 0 resets to the
    // concept default on the next $derived tick.
    get escalationPct() {
      return escalationPct;
    },
    set escalationPct(v) {
      escalationPct = +v;
      saveInputs();
    },
    // BR-M2 (April 11, 2026): Read-only getter that returns the escalation %
    // the BC engine is ACTUALLY using — falls back to the concept default
    // (~0.03) when the user hasn't set one. UX-EF should `bind:value={...}`
    // to `escalationPct` for input but display this getter's value so the
    // field shows "3%" on first load instead of "0%".
    get effectiveEscalationPct() {
      const defaultEsc = CONCEPT_KPIS[conceptKey]?.businessCase?.defaultRentEscalation ?? 0.03;
      return escalationPct > 0 ? Math.min(0.15, escalationPct) : defaultEsc;
    },
    // BR-B': Y1/Y2/Y3 projected rent for the Lease Terms section in UX-EF.
    // Values come from the 60-month rent array via annualRows so they already
    // include the effective escalation AND any percentage-rent true-up AND
    // the tax pass-through. UX-EF reads these directly — no further math.
    get projectedRentY1() {
      return model().annualRows[0]?.rent ?? 0;
    },
    get projectedRentY2() {
      return model().annualRows[1]?.rent ?? 0;
    },
    get projectedRentY3() {
      return model().annualRows[2]?.rent ?? 0;
    },
    // Session context — read-only from UX
    get conceptKey() {
      return conceptKey;
    },
    get conceptLabel() {
      return conceptLabelVal;
    },
    get analysisAddress() {
      return analysisAddress;
    },
    get locationIQ() {
      return locationIQ;
    },
    get fitIQ() {
      return fitIQ;
    },
    get visionIQ() {
      return visionIQ;
    },
    get transitScore() {
      return transitScore;
    },
    get vibrancyScore() {
      return vibrancyScore;
    },
    get personalInvestment() {
      return personalInvestment;
    },
    get creditScore() {
      return creditScore;
    },
    get hasPersonalGuarantee() {
      return hasPersonalGuarantee;
    },
    // BC-01/02/03: DOF tax context — read-only
    get monthlyTaxPassThrough() {
      return monthlyTaxPassThrough;
    },
    get taxEscalationAnnual() {
      return taxEscalationAnnual;
    },
    get isCoop() {
      return isCoop;
    },
    // Master model — UX-facing FinancialModel (mapped from internal FinancialSummary)
    // This is passed to tab components; all field names match UX contracts.
    get model() {
      return mapToFinancialModel(model());
    },
    // Convenience top-level accessors (Tab 1 shortcuts)
    get breakEvenMonth() {
      return model().breakEvenMonth;
    },
    get cashNeeded() {
      return model().cashNeeded;
    },
    get takeHomeY1() {
      return model().takeHomeY1;
    },
    get startupCosts() {
      return model().startupCosts;
    },
    get monthlyRows() {
      return model().monthlyRows;
    },
    // Convenience Tab 2 shortcuts
    get costToOpen() {
      return model().costToOpen;
    },
    get breakEvenPerHour() {
      return model().breakEvenPerHour;
    },
    get breakEvenPerDay() {
      return model().breakEvenPerDay;
    },
    get footfallUnit() {
      return model().footfallUnit;
    },
    get locationDeltaPct() {
      return model().locationDeltaPct;
    },
    get maxLoss() {
      return model().maxLoss;
    },
    get sensitivityMonths() {
      return model().sensitivityMonths;
    },
    get takeHomeY3() {
      return model().takeHomeY3;
    },
    get valuationY5() {
      return model().valuationY5;
    },
    // Convenience Tab 3 shortcuts
    get goNoGo() {
      return model().goNoGo;
    },
    get conditions() {
      return model().conditions;
    },
    get scenarios() {
      return model().scenarios;
    },
    get annualRows() {
      return model().annualRows;
    },
    get validations() {
      return model().validations;
    },
    get marketEvents() {
      return model().marketEvents;
    },
    // ── Live P&L getters — used by BusinessCaseSidebar and tab fallback stubs ─
    // Computed directly from sidebar inputs (no ramp/maturity — steady-state M1 proxy)
    get monthlyRevenue() {
      return dailyCustomers * avgTicket * (daysPerWeek * 4.33 * 0.95);
    },
    get monthlyCOGS() {
      return dailyCustomers * avgTicket * (daysPerWeek * 4.33 * 0.95) * (cogsPercent / 100);
    },
    get monthlyLabor() {
      const ftr = fullTimeRate > 0 ? fullTimeRate : getHourlyLaborRate(conceptKey);
      const ptr = partTimeRate > 0 ? partTimeRate : Math.max(15, ftr - 3);
      return fullTimeStaff * ftr * 40 * 4.33 + partTimeStaff * ptr * 20 * 4.33;
    },
    get monthlyTotal() {
      const rev = dailyCustomers * avgTicket * (daysPerWeek * 4.33 * 0.95);
      const cogs = rev * (cogsPercent / 100);
      const ftr = fullTimeRate > 0 ? fullTimeRate : getHourlyLaborRate(conceptKey);
      const ptr = partTimeRate > 0 ? partTimeRate : Math.max(15, ftr - 3);
      const lab = fullTimeStaff * ftr * 40 * 4.33 + partTimeStaff * ptr * 20 * 4.33;
      return cogs + lab + monthlyRent + monthlyOpEx;
    },
    // Annual P&L aggregates (Year 1 from 60-month engine)
    get annualRevenue() {
      return model().annualRows[0]?.revenue ?? 0;
    },
    get annualCOGS() {
      return model().annualRows[0]?.cogs ?? 0;
    },
    get annualLabor() {
      return model().annualRows[0]?.labor ?? 0;
    },
    get annualOpEx() {
      return model().annualRows[0]?.opex ?? 0;
    },
    get annualRent() {
      return model().annualRows[0]?.rent ?? 0;
    },
    get annualProfit() {
      return model().annualRows[0]?.netIncome ?? 0;
    },
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
      if (typeof window === "undefined") return;
      try {
        const sess = JSON.parse(localStorage.getItem("re2_session") || "{}");
        const CONCEPT_FIELDS = [
          "conceptAnswers",
          "visionDifferentiators",
          "visionAvgCheck",
          "visionFoodProgram",
          "visionHours",
          "visionTargetAge",
          "visionStoreType",
          "visionTargetClients",
          "visionSeatingCapacity",
          "visionCreditScore"
        ];
        let changed = false;
        for (const field of CONCEPT_FIELDS) {
          if (field in sess) {
            delete sess[field];
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem("re2_session", JSON.stringify(sess));
        }
      } catch {
      }
    }
  };
}
export {
  createBusinessCaseStore as a,
  computeFullModel as c,
  mapToFinancialModel as m
};
