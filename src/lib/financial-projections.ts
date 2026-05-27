/**
 * Financial Projection Engine — Thread 6B, Gap #2 (BLOCKER)
 *
 * Computes break-even analysis, monthly P&L, 12-month projections,
 * and scenario modeling for any business type at any location.
 *
 * 100% deterministic — no LLM. Uses industry benchmarks + location data
 * + user profile to generate financially grounded numbers.
 *
 * Consumed by:
 *   - Business Plan Co-Pilot (copilot-business-server.ts)
 *   - Business Plan page (Thread 7 UI)
 *   - Financials page (Thread 7 UI)
 */

import { getBenchmark, type IndustryBenchmark } from './industry-benchmarks';

// ── Types ──

export interface FinancialInputs {
	businessType: string;
	// User overrides (optional — falls back to benchmarks)
	rent?: number;               // Monthly rent $
	avgTransaction?: number;     // $ per transaction
	dailyCustomers?: number;     // Expected daily customers
	staffCount?: number;         // Employees per shift
	startupBudget?: number;      // Total startup capital
	operatingHours?: string;     // 'morning' | 'daytime' | 'evening' | 'late_night' | 'all_day'
	ownerOperator?: boolean;     // Owner works shifts (saves one salary)
}

export interface LocationModifiers {
	locationIQ?: number;         // 0-100
	fitIQ?: number;              // 0-100
	transitScore?: number;       // 0-100
	footTrafficScore?: number;   // 0-100
	competitionScore?: number;   // 0-100 (higher = less competition = better)
	medianIncome?: number;       // Median household income in the area
	walkScore?: number;          // 0-100
}

export interface MonthlyPL {
	revenue: number;
	cogs: number;
	grossProfit: number;
	labor: number;
	rent: number;
	marketing: number;
	utilities: number;
	insurance: number;
	otherOpex: number;
	totalExpenses: number;
	netIncome: number;
	netMargin: number;           // As decimal (e.g., 0.12)
}

export interface BreakEvenAnalysis {
	dailyTransactionsNeeded: number;   // To cover all costs
	monthlyRevenueNeeded: number;      // To break even
	currentDailyTransactions: number;  // Projected
	surplus: number;                    // Transactions above/below break-even
	daysToBreakEvenStartup: number;    // When startup cost is recovered
	cushionPct: number;                // % above break-even (negative = under)
}

export interface ProjectionMonth {
	month: number;               // 1-12
	label: string;               // "Month 1", "Month 2", ...
	revenue: number;
	expenses: number;
	netIncome: number;
	cumulativeNet: number;       // Running total
	rampFactor: number;          // 0-1, ramp-up curve
	seasonalFactor: number;      // 0.7-1.3, seasonal adjustment
}

export interface FinancialProjection {
	// ── Core Outputs ──
	monthlyPL: MonthlyPL;
	breakEven: BreakEvenAnalysis;
	twelveMonthProjection: ProjectionMonth[];

	// ── Key Metrics ──
	annualRevenue: number;
	annualNetIncome: number;
	startupCostEstimate: number;
	monthsToRecoupStartup: number;
	rentToRevenueRatio: number;
	laborToRevenueRatio: number;

	// ── Location Impact ──
	footTrafficMultiplier: number;   // How location adjusts customer count
	locationConfidence: number;       // 0-100, how much we trust the projection

	// ── Benchmark Comparison ──
	benchmarkUsed: string;
	deviations: {
		field: string;
		userValue: number;
		benchmarkValue: number;
		pctDiff: number;
		flag: 'ok' | 'caution' | 'warning';
	}[];
}

// ── Location-Adjusted Customer Count ──

function computeFootTrafficMultiplier(loc: LocationModifiers, bench: IndustryBenchmark): number {
	if (!loc.locationIQ && !loc.transitScore && !loc.footTrafficScore) return 1.0;

	let multiplier = 1.0;

	// Location IQ general adjustment (IQ 50 = baseline, 70 = +20%, 30 = -20%)
	if (loc.locationIQ !== undefined) {
		multiplier *= 0.80 + (loc.locationIQ / 100) * 0.40; // Range: 0.80 – 1.20
	}

	// Transit-sensitive businesses get a bigger bump from transit scores
	if (loc.transitScore !== undefined && bench.transitWeight > 0.5) {
		const transitBoost = (loc.transitScore - 50) / 100 * bench.transitWeight * 0.3;
		multiplier *= (1 + transitBoost); // ±15% max
	}

	// Foot traffic directly impacts walk-in businesses
	if (loc.footTrafficScore !== undefined && bench.footTrafficWeight > 0.5) {
		const ftBoost = (loc.footTrafficScore - 50) / 100 * bench.footTrafficWeight * 0.3;
		multiplier *= (1 + ftBoost);
	}

	// Competition adjustment (more competition = fewer customers per business)
	if (loc.competitionScore !== undefined && bench.competitionSensitivity > 0.3) {
		// competitionScore 100 = no competition (great), 0 = saturated
		const compAdj = (loc.competitionScore - 50) / 100 * bench.competitionSensitivity * 0.2;
		multiplier *= (1 + compAdj);
	}

	// Clamp to reasonable range
	return Math.max(0.50, Math.min(1.50, multiplier));
}

// ── Operating Hours Adjustment ──

function hoursMultiplier(hours: string | undefined, bench: IndustryBenchmark): number {
	if (!hours) return 1.0;
	const h = hours.toLowerCase();
	if (h.includes('all day')) return 1.10;        // More hours = more revenue (but more cost)
	if (h.includes('morning') || h.includes('5')) return 0.70;  // Morning only = fewer hours
	if (h.includes('evening') || h.includes('late')) {
		return bench.nightlifeRelevance > 0.5 ? 1.05 : 0.80; // Evening good for bars, bad for tutoring
	}
	if (h.includes('weekend')) return 0.45;          // Weekends only = ~30% of week
	return 1.0;
}

// ── Ramp-Up Curve ──
// New businesses don't hit full revenue from day 1.
// Month 1: ~40%, Month 3: ~65%, Month 6: ~85%, Month 9: ~95%, Month 12: ~100%

function rampFactor(month: number): number {
	if (month <= 0) return 0;
	// Logarithmic ramp: approaches 1.0 asymptotically
	return Math.min(1.0, 0.40 + 0.60 * (1 - Math.exp(-0.35 * month)));
}

// ── Seasonality ──
// Simple seasonal curve centered on month index within the year

function seasonalFactor(monthIndex: number, range: [number, number]): number {
	// monthIndex 0-11 (Jan-Dec)
	// Assume: summer/fall slightly higher, winter slightly lower
	const seasonCurve = [0.85, 0.88, 0.95, 1.00, 1.05, 1.08, 1.05, 1.02, 1.00, 1.05, 1.10, 1.00];
	const baseFactor = seasonCurve[monthIndex % 12] || 1.0;
	// Scale to the range
	const [lo, hi] = range;
	const mid = (lo + hi) / 2;
	const halfSpread = (hi - lo) / 2;
	return mid + halfSpread * (baseFactor - 1.0) / 0.15; // Normalize the ±0.15 swing
}

// ── Parse Helpers ──

function parseRentBudget(raw: string | number | undefined): number {
	if (typeof raw === 'number') return raw;
	if (!raw) return 0;
	const s = String(raw);
	const matches = s.match(/(\d[\d,]*)/g);
	if (!matches) return 0;
	const nums = matches.map(m => parseInt(m.replace(/,/g, '')));
	if (nums.length >= 2) return Math.round((nums[0] + nums[1]) / 2);
	const n = nums[0];
	return n < 100 ? n * 1000 : n;
}

// ── Main Entry Point ──

export function computeFinancialProjection(
	inputs: FinancialInputs,
	location: LocationModifiers = {}
): FinancialProjection {
	const bench = getBenchmark(inputs.businessType);

	// ── Resolve actuals (user overrides > location-adjusted benchmarks > raw benchmarks) ──

	const ftMultiplier = computeFootTrafficMultiplier(location, bench);
	const hrsMultiplier = hoursMultiplier(inputs.operatingHours, bench);

	const rent = inputs.rent || parseRentBudget(undefined) || bench.idealRentRange[1]; // Use upper ideal as default
	const avgTxn = inputs.avgTransaction || bench.avgTransaction;
	const baseDailyCustomers = inputs.dailyCustomers || bench.dailyCustomers;
	const adjustedDailyCustomers = Math.round(baseDailyCustomers * ftMultiplier * hrsMultiplier);
	const staffPerShift = inputs.staffCount || bench.staffPerShift;

	// Owner-operator saves one salary
	const ownerSaves = inputs.ownerOperator ? bench.avgHourlyWage * 8 * 30 : 0;

	// ── Monthly P&L ──
	const monthlyRevenue = avgTxn * adjustedDailyCustomers * 30;
	const cogs = monthlyRevenue * (bench.cogsPct / 100);
	const grossProfit = monthlyRevenue - cogs;
	const labor = (staffPerShift * bench.avgHourlyWage * 8 * 30 * bench.shiftsPerDay) + bench.managerSalary - ownerSaves;
	const marketing = monthlyRevenue * (bench.marketingPct / 100);
	const utilities = monthlyRevenue * (bench.utilityPct / 100);
	const insurance = monthlyRevenue * (bench.insurancePct / 100);
	const otherOpex = monthlyRevenue * (bench.otherOpexPct / 100);
	const totalExpenses = cogs + labor + rent + marketing + utilities + insurance + otherOpex;
	const netIncome = monthlyRevenue - totalExpenses;
	const netMargin = monthlyRevenue > 0 ? netIncome / monthlyRevenue : 0;

	const monthlyPL: MonthlyPL = {
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
		netMargin: Math.round(netMargin * 100) / 100,
	};

	// ── Break-Even Analysis ──
	const fixedMonthlyCosts = rent + labor + insurance + (monthlyRevenue * bench.marketingPct / 100 * 0.3); // Fixed portion of marketing
	const variableCostPerTxn = avgTxn * ((bench.cogsPct + bench.utilityPct) / 100);
	const contributionPerTxn = avgTxn - variableCostPerTxn;
	const dailyBreakEven = contributionPerTxn > 0 ? Math.ceil(fixedMonthlyCosts / 30 / contributionPerTxn) : 999;

	const startupCost = inputs.startupBudget || Math.round((bench.startupCostRange[0] + bench.startupCostRange[1]) / 2);
	const monthlyNetForRecoup = netIncome > 0 ? netIncome : 1; // Avoid division by zero
	const monthsToRecoup = netIncome > 0 ? Math.ceil(startupCost / netIncome) : 999;

	const breakEven: BreakEvenAnalysis = {
		dailyTransactionsNeeded: dailyBreakEven,
		monthlyRevenueNeeded: Math.round(dailyBreakEven * avgTxn * 30),
		currentDailyTransactions: adjustedDailyCustomers,
		surplus: adjustedDailyCustomers - dailyBreakEven,
		daysToBreakEvenStartup: netIncome > 0 ? Math.ceil(startupCost / (netIncome / 30)) : 9999,
		cushionPct: dailyBreakEven > 0 ? Math.round((adjustedDailyCustomers - dailyBreakEven) / dailyBreakEven * 100) : 0,
	};

	// ── 12-Month Projection ──
	const today = new Date();
	const startMonth = today.getMonth(); // 0-11

	let cumulativeNet = -startupCost; // Start negative (invested capital)
	const twelveMonthProjection: ProjectionMonth[] = [];

	for (let i = 1; i <= 12; i++) {
		const rf = rampFactor(i);
		const sf = seasonalFactor((startMonth + i) % 12, bench.seasonalityRange);
		const mRevenue = Math.round(monthlyRevenue * rf * sf);
		const mExpenses = Math.round(totalExpenses * (0.85 + rf * 0.15)); // Expenses ramp slower
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
			seasonalFactor: Math.round(sf * 100) / 100,
		});
	}

	// ── Benchmark Deviations ──
	const deviations: FinancialProjection['deviations'] = [];

	if (inputs.rent) {
		const pctDiff = Math.round((inputs.rent - bench.idealRentRange[1]) / bench.idealRentRange[1] * 100);
		deviations.push({
			field: 'rent',
			userValue: inputs.rent,
			benchmarkValue: bench.idealRentRange[1],
			pctDiff,
			flag: Math.abs(pctDiff) <= 20 ? 'ok' : Math.abs(pctDiff) <= 50 ? 'caution' : 'warning',
		});
	}

	if (inputs.avgTransaction) {
		const pctDiff = Math.round((inputs.avgTransaction - bench.avgTransaction) / bench.avgTransaction * 100);
		deviations.push({
			field: 'avgTransaction',
			userValue: inputs.avgTransaction,
			benchmarkValue: bench.avgTransaction,
			pctDiff,
			flag: Math.abs(pctDiff) <= 25 ? 'ok' : Math.abs(pctDiff) <= 50 ? 'caution' : 'warning',
		});
	}

	if (inputs.dailyCustomers) {
		const pctDiff = Math.round((inputs.dailyCustomers - bench.dailyCustomers) / bench.dailyCustomers * 100);
		deviations.push({
			field: 'dailyCustomers',
			userValue: inputs.dailyCustomers,
			benchmarkValue: bench.dailyCustomers,
			pctDiff,
			flag: Math.abs(pctDiff) <= 30 ? 'ok' : Math.abs(pctDiff) <= 60 ? 'caution' : 'warning',
		});
	}

	// ── Location Confidence ──
	// How many location signals did we have? More signals = higher confidence.
	const locSignals = [location.locationIQ, location.fitIQ, location.transitScore, location.footTrafficScore, location.competitionScore, location.medianIncome, location.walkScore];
	const locationConfidence = Math.round((locSignals.filter(v => v !== undefined).length / locSignals.length) * 100);

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
		deviations,
	};
}

// ── What-If Scenario Helper ──

export function computeWhatIf(
	base: FinancialProjection,
	changes: Partial<FinancialInputs>,
	inputs: FinancialInputs,
	location: LocationModifiers = {}
): { before: FinancialProjection; after: FinancialProjection; impact: Record<string, number> } {
	const after = computeFinancialProjection({ ...inputs, ...changes }, location);

	return {
		before: base,
		after,
		impact: {
			revenueChange: after.monthlyPL.revenue - base.monthlyPL.revenue,
			netIncomeChange: after.monthlyPL.netIncome - base.monthlyPL.netIncome,
			breakEvenChange: after.breakEven.dailyTransactionsNeeded - base.breakEven.dailyTransactionsNeeded,
			startupRecoupChange: after.monthsToRecoupStartup - base.monthsToRecoupStartup,
			annualNetChange: after.annualNetIncome - base.annualNetIncome,
		},
	};
}
