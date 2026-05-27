/**
 * Industry Benchmarks — Thread 6B, Gap #5
 *
 * Hardcoded benchmarks for NYC small business types.
 * Sourced from BLS, IBISWorld, RestaurantOwner.com, NYC SBS, industry reports.
 *
 * Shared across:
 *   - Financial Projection Engine (Gap #2)
 *   - Business Plan Co-Pilot
 *   - Fit IQ Engine (rent tolerance)
 *   - Probability Formula (Gap #3)
 *
 * Each benchmark includes: revenue model, cost structure, staffing, and
 * location sensitivity factors.
 */

export interface IndustryBenchmark {
	// ── Revenue Model ──
	avgTransaction: number;           // $ per transaction
	dailyCustomers: number;           // Avg daily customer count
	peakHourMultiplier: number;       // Peak hours = base × this (e.g., 1.8)
	seasonalityRange: [number, number]; // Min/max monthly revenue as % of avg (e.g., [0.7, 1.3])
	repeatCustomerPct: number;        // % of revenue from repeat customers

	// ── Cost Structure (as % of revenue) ──
	cogsPct: number;                  // Cost of goods sold %
	laborPct: number;                 // Labor cost %
	rentPct: number;                  // Target rent as % of revenue (NYC rule of thumb: <10%)
	marketingPct: number;             // Marketing spend %
	utilityPct: number;               // Utilities %
	insurancePct: number;             // Insurance %
	otherOpexPct: number;             // Other operating expenses %
	grossMargin: number;              // 1 - cogsPct (derived, for convenience)
	netMarginTarget: number;          // Target net profit margin

	// ── Staffing ──
	staffPerShift: number;
	avgHourlyWage: number;            // NYC average
	shiftsPerDay: number;
	managerSalary: number;            // Monthly

	// ── Startup ──
	startupCostRange: [number, number]; // Min/max startup costs
	buildoutPerSqft: [number, number];  // Build-out cost per sqft
	typicalSqft: [number, number];      // Typical space size
	monthsToBreakEven: [number, number]; // Typical range

	// ── Rent Tolerance ──
	maxMonthlyRent: number;           // Hard ceiling before economics break
	idealRentRange: [number, number]; // Sweet spot

	// ── Location Sensitivity ──
	footTrafficWeight: number;        // 0-1: how much foot traffic matters
	transitWeight: number;            // 0-1: how much transit access matters
	demographicsWeight: number;       // 0-1: how much local demographics matter
	competitionSensitivity: number;   // 0-1: how much competition hurts (1 = very sensitive)
	nightlifeRelevance: number;       // 0-1: how relevant nightlife/evening economy is
}

// ── The Benchmarks ──

import type { ValidBusinessType } from '$lib/intel/registry/business-type-registry';

export const BENCHMARKS: Record<ValidBusinessType | string, IndustryBenchmark> = {
	'specialty_coffee': {
		avgTransaction: 6.50, dailyCustomers: 150, peakHourMultiplier: 2.0, seasonalityRange: [0.80, 1.15], repeatCustomerPct: 65,
		cogsPct: 30, laborPct: 28, rentPct: 8, marketingPct: 3, utilityPct: 3, insurancePct: 2, otherOpexPct: 5, grossMargin: 0.70, netMarginTarget: 0.12,
		staffPerShift: 2, avgHourlyWage: 18, shiftsPerDay: 2, managerSalary: 4500,
		startupCostRange: [80000, 250000], buildoutPerSqft: [100, 250], typicalSqft: [600, 1200], monthsToBreakEven: [12, 24],
		maxMonthlyRent: 8000, idealRentRange: [3000, 6000],
		footTrafficWeight: 0.90, transitWeight: 0.85, demographicsWeight: 0.50, competitionSensitivity: 0.70, nightlifeRelevance: 0.10,
	},
	'cafe': {
		avgTransaction: 14, dailyCustomers: 100, peakHourMultiplier: 1.8, seasonalityRange: [0.75, 1.20], repeatCustomerPct: 55,
		cogsPct: 35, laborPct: 30, rentPct: 9, marketingPct: 3, utilityPct: 3, insurancePct: 2, otherOpexPct: 5, grossMargin: 0.65, netMarginTarget: 0.10,
		staffPerShift: 3, avgHourlyWage: 18, shiftsPerDay: 2, managerSalary: 4800,
		startupCostRange: [100000, 300000], buildoutPerSqft: [120, 280], typicalSqft: [800, 1500], monthsToBreakEven: [14, 28],
		maxMonthlyRent: 10000, idealRentRange: [4000, 7500],
		footTrafficWeight: 0.80, transitWeight: 0.75, demographicsWeight: 0.60, competitionSensitivity: 0.65, nightlifeRelevance: 0.20,
	},
	'full_service_restaurant': {
		avgTransaction: 38, dailyCustomers: 80, peakHourMultiplier: 2.2, seasonalityRange: [0.70, 1.30], repeatCustomerPct: 40,
		cogsPct: 33, laborPct: 30, rentPct: 8, marketingPct: 4, utilityPct: 4, insurancePct: 3, otherOpexPct: 5, grossMargin: 0.60, netMarginTarget: 0.08,
		staffPerShift: 6, avgHourlyWage: 20, shiftsPerDay: 2, managerSalary: 5500,
		startupCostRange: [150000, 500000], buildoutPerSqft: [150, 350], typicalSqft: [1000, 2500], monthsToBreakEven: [18, 36],
		maxMonthlyRent: 15000, idealRentRange: [6000, 12000],
		footTrafficWeight: 0.50, transitWeight: 0.60, demographicsWeight: 0.75, competitionSensitivity: 0.55, nightlifeRelevance: 0.40,
	},
	'fast_casual': {
		avgTransaction: 15, dailyCustomers: 120, peakHourMultiplier: 2.5, seasonalityRange: [0.80, 1.15], repeatCustomerPct: 55,
		cogsPct: 32, laborPct: 27, rentPct: 8, marketingPct: 4, utilityPct: 3, insurancePct: 2, otherOpexPct: 5, grossMargin: 0.65, netMarginTarget: 0.10,
		staffPerShift: 3, avgHourlyWage: 17, shiftsPerDay: 2, managerSalary: 4500,
		startupCostRange: [100000, 350000], buildoutPerSqft: [120, 280], typicalSqft: [800, 1500], monthsToBreakEven: [12, 24],
		maxMonthlyRent: 10000, idealRentRange: [4000, 8000],
		footTrafficWeight: 0.85, transitWeight: 0.80, demographicsWeight: 0.55, competitionSensitivity: 0.70, nightlifeRelevance: 0.15,
	},
	'bar_nightlife': {
		avgTransaction: 28, dailyCustomers: 80, peakHourMultiplier: 2.5, seasonalityRange: [0.70, 1.35], repeatCustomerPct: 45,
		cogsPct: 22, laborPct: 25, rentPct: 8, marketingPct: 5, utilityPct: 3, insurancePct: 3, otherOpexPct: 5, grossMargin: 0.78, netMarginTarget: 0.15,
		staffPerShift: 3, avgHourlyWage: 18, shiftsPerDay: 1, managerSalary: 5000,
		startupCostRange: [150000, 400000], buildoutPerSqft: [150, 350], typicalSqft: [800, 2000], monthsToBreakEven: [14, 30],
		maxMonthlyRent: 12000, idealRentRange: [5000, 10000],
		footTrafficWeight: 0.40, transitWeight: 0.65, demographicsWeight: 0.60, competitionSensitivity: 0.50, nightlifeRelevance: 0.90,
	},
	'lounge': {
		avgTransaction: 35, dailyCustomers: 60, peakHourMultiplier: 2.5, seasonalityRange: [0.65, 1.40], repeatCustomerPct: 35,
		cogsPct: 22, laborPct: 28, rentPct: 9, marketingPct: 6, utilityPct: 3, insurancePct: 3, otherOpexPct: 5, grossMargin: 0.78, netMarginTarget: 0.12,
		staffPerShift: 4, avgHourlyWage: 20, shiftsPerDay: 1, managerSalary: 5500,
		startupCostRange: [200000, 500000], buildoutPerSqft: [180, 400], typicalSqft: [1000, 2500], monthsToBreakEven: [18, 36],
		maxMonthlyRent: 15000, idealRentRange: [7000, 13000],
		footTrafficWeight: 0.30, transitWeight: 0.60, demographicsWeight: 0.70, competitionSensitivity: 0.45, nightlifeRelevance: 0.95,
	},
	'bakery': {
		avgTransaction: 9, dailyCustomers: 100, peakHourMultiplier: 2.0, seasonalityRange: [0.80, 1.25], repeatCustomerPct: 60,
		cogsPct: 38, laborPct: 28, rentPct: 8, marketingPct: 3, utilityPct: 4, insurancePct: 2, otherOpexPct: 4, grossMargin: 0.62, netMarginTarget: 0.08,
		staffPerShift: 2, avgHourlyWage: 17, shiftsPerDay: 2, managerSalary: 4200,
		startupCostRange: [80000, 200000], buildoutPerSqft: [100, 250], typicalSqft: [600, 1200], monthsToBreakEven: [14, 28],
		maxMonthlyRent: 7000, idealRentRange: [3000, 5500],
		footTrafficWeight: 0.80, transitWeight: 0.70, demographicsWeight: 0.55, competitionSensitivity: 0.60, nightlifeRelevance: 0.05,
	},
	'retail': {
		avgTransaction: 45, dailyCustomers: 40, peakHourMultiplier: 1.5, seasonalityRange: [0.60, 1.50], repeatCustomerPct: 30,
		cogsPct: 50, laborPct: 20, rentPct: 10, marketingPct: 5, utilityPct: 2, insurancePct: 2, otherOpexPct: 4, grossMargin: 0.50, netMarginTarget: 0.07,
		staffPerShift: 2, avgHourlyWage: 17, shiftsPerDay: 2, managerSalary: 4200,
		startupCostRange: [50000, 200000], buildoutPerSqft: [60, 180], typicalSqft: [600, 1500], monthsToBreakEven: [12, 30],
		maxMonthlyRent: 8000, idealRentRange: [3500, 7000],
		footTrafficWeight: 0.75, transitWeight: 0.60, demographicsWeight: 0.65, competitionSensitivity: 0.60, nightlifeRelevance: 0.10,
	},
	'boutique': {
		avgTransaction: 68, dailyCustomers: 25, peakHourMultiplier: 1.4, seasonalityRange: [0.55, 1.60], repeatCustomerPct: 25,
		cogsPct: 45, laborPct: 18, rentPct: 10, marketingPct: 6, utilityPct: 2, insurancePct: 2, otherOpexPct: 4, grossMargin: 0.55, netMarginTarget: 0.08,
		staffPerShift: 2, avgHourlyWage: 18, shiftsPerDay: 1, managerSalary: 4500,
		startupCostRange: [80000, 250000], buildoutPerSqft: [80, 220], typicalSqft: [500, 1200], monthsToBreakEven: [14, 30],
		maxMonthlyRent: 10000, idealRentRange: [4000, 8000],
		footTrafficWeight: 0.60, transitWeight: 0.55, demographicsWeight: 0.80, competitionSensitivity: 0.50, nightlifeRelevance: 0.15,
	},
	'fitness_studio': {
		avgTransaction: 80, dailyCustomers: 50, peakHourMultiplier: 1.8, seasonalityRange: [0.75, 1.30], repeatCustomerPct: 80,
		cogsPct: 15, laborPct: 30, rentPct: 12, marketingPct: 5, utilityPct: 5, insurancePct: 4, otherOpexPct: 5, grossMargin: 0.85, netMarginTarget: 0.12,
		staffPerShift: 2, avgHourlyWage: 22, shiftsPerDay: 2, managerSalary: 5000,
		startupCostRange: [100000, 400000], buildoutPerSqft: [80, 200], typicalSqft: [1500, 4000], monthsToBreakEven: [12, 24],
		maxMonthlyRent: 12000, idealRentRange: [5000, 10000],
		footTrafficWeight: 0.40, transitWeight: 0.70, demographicsWeight: 0.75, competitionSensitivity: 0.65, nightlifeRelevance: 0.05,
	},
	'gym': {
		avgTransaction: 60, dailyCustomers: 70, peakHourMultiplier: 1.8, seasonalityRange: [0.75, 1.30], repeatCustomerPct: 85,
		cogsPct: 18, laborPct: 28, rentPct: 14, marketingPct: 5, utilityPct: 6, insurancePct: 4, otherOpexPct: 5, grossMargin: 0.82, netMarginTarget: 0.10,
		staffPerShift: 3, avgHourlyWage: 20, shiftsPerDay: 2, managerSalary: 5200,
		startupCostRange: [150000, 500000], buildoutPerSqft: [80, 220], typicalSqft: [2000, 6000], monthsToBreakEven: [14, 28],
		maxMonthlyRent: 15000, idealRentRange: [6000, 12000],
		footTrafficWeight: 0.35, transitWeight: 0.70, demographicsWeight: 0.70, competitionSensitivity: 0.60, nightlifeRelevance: 0.05,
	},
	'spa': {
		avgTransaction: 120, dailyCustomers: 15, peakHourMultiplier: 1.5, seasonalityRange: [0.70, 1.25], repeatCustomerPct: 60,
		cogsPct: 25, laborPct: 35, rentPct: 10, marketingPct: 5, utilityPct: 4, insurancePct: 3, otherOpexPct: 5, grossMargin: 0.75, netMarginTarget: 0.08,
		staffPerShift: 3, avgHourlyWage: 25, shiftsPerDay: 1, managerSalary: 5000,
		startupCostRange: [100000, 350000], buildoutPerSqft: [120, 300], typicalSqft: [800, 2000], monthsToBreakEven: [16, 30],
		maxMonthlyRent: 10000, idealRentRange: [4500, 8500],
		footTrafficWeight: 0.30, transitWeight: 0.50, demographicsWeight: 0.85, competitionSensitivity: 0.55, nightlifeRelevance: 0.05,
	},
	'wellness': {
		avgTransaction: 90, dailyCustomers: 18, peakHourMultiplier: 1.4, seasonalityRange: [0.75, 1.20], repeatCustomerPct: 65,
		cogsPct: 20, laborPct: 35, rentPct: 10, marketingPct: 5, utilityPct: 3, insurancePct: 3, otherOpexPct: 5, grossMargin: 0.80, netMarginTarget: 0.10,
		staffPerShift: 2, avgHourlyWage: 24, shiftsPerDay: 1, managerSalary: 4800,
		startupCostRange: [80000, 280000], buildoutPerSqft: [100, 260], typicalSqft: [700, 1800], monthsToBreakEven: [14, 26],
		maxMonthlyRent: 8000, idealRentRange: [3500, 7000],
		footTrafficWeight: 0.30, transitWeight: 0.50, demographicsWeight: 0.80, competitionSensitivity: 0.50, nightlifeRelevance: 0.05,
	},
	'tutoring': {
		avgTransaction: 55, dailyCustomers: 12, peakHourMultiplier: 1.6, seasonalityRange: [0.60, 1.35], repeatCustomerPct: 85,
		cogsPct: 10, laborPct: 45, rentPct: 10, marketingPct: 5, utilityPct: 2, insurancePct: 2, otherOpexPct: 4, grossMargin: 0.90, netMarginTarget: 0.15,
		staffPerShift: 1, avgHourlyWage: 30, shiftsPerDay: 2, managerSalary: 4500,
		startupCostRange: [20000, 80000], buildoutPerSqft: [40, 100], typicalSqft: [500, 1200], monthsToBreakEven: [8, 18],
		maxMonthlyRent: 5000, idealRentRange: [2000, 4000],
		footTrafficWeight: 0.20, transitWeight: 0.60, demographicsWeight: 0.90, competitionSensitivity: 0.40, nightlifeRelevance: 0.00,
	},
	'medical': {
		avgTransaction: 150, dailyCustomers: 20, peakHourMultiplier: 1.3, seasonalityRange: [0.85, 1.10], repeatCustomerPct: 70,
		cogsPct: 30, laborPct: 35, rentPct: 8, marketingPct: 3, utilityPct: 3, insurancePct: 5, otherOpexPct: 5, grossMargin: 0.70, netMarginTarget: 0.10,
		staffPerShift: 3, avgHourlyWage: 30, shiftsPerDay: 1, managerSalary: 6000,
		startupCostRange: [200000, 600000], buildoutPerSqft: [150, 350], typicalSqft: [1000, 2500], monthsToBreakEven: [18, 36],
		maxMonthlyRent: 10000, idealRentRange: [5000, 9000],
		footTrafficWeight: 0.20, transitWeight: 0.65, demographicsWeight: 0.80, competitionSensitivity: 0.35, nightlifeRelevance: 0.00,
	},
	'dental': {
		avgTransaction: 200, dailyCustomers: 12, peakHourMultiplier: 1.2, seasonalityRange: [0.85, 1.10], repeatCustomerPct: 75,
		cogsPct: 35, laborPct: 32, rentPct: 8, marketingPct: 4, utilityPct: 3, insurancePct: 5, otherOpexPct: 5, grossMargin: 0.65, netMarginTarget: 0.08,
		staffPerShift: 3, avgHourlyWage: 28, shiftsPerDay: 1, managerSalary: 5800,
		startupCostRange: [250000, 700000], buildoutPerSqft: [180, 400], typicalSqft: [1000, 2200], monthsToBreakEven: [20, 36],
		maxMonthlyRent: 9000, idealRentRange: [4500, 8000],
		footTrafficWeight: 0.15, transitWeight: 0.60, demographicsWeight: 0.80, competitionSensitivity: 0.30, nightlifeRelevance: 0.00,
	},
	'grocery': {
		avgTransaction: 28, dailyCustomers: 150, peakHourMultiplier: 1.6, seasonalityRange: [0.85, 1.15], repeatCustomerPct: 75,
		cogsPct: 68, laborPct: 12, rentPct: 6, marketingPct: 2, utilityPct: 4, insurancePct: 2, otherOpexPct: 3, grossMargin: 0.32, netMarginTarget: 0.03,
		staffPerShift: 3, avgHourlyWage: 17, shiftsPerDay: 2, managerSalary: 4500,
		startupCostRange: [100000, 400000], buildoutPerSqft: [60, 150], typicalSqft: [1500, 5000], monthsToBreakEven: [12, 24],
		maxMonthlyRent: 12000, idealRentRange: [5000, 10000],
		footTrafficWeight: 0.50, transitWeight: 0.55, demographicsWeight: 0.70, competitionSensitivity: 0.75, nightlifeRelevance: 0.00,
	},
	'laundromat': {
		avgTransaction: 9, dailyCustomers: 60, peakHourMultiplier: 1.4, seasonalityRange: [0.90, 1.10], repeatCustomerPct: 85,
		cogsPct: 20, laborPct: 15, rentPct: 12, marketingPct: 2, utilityPct: 15, insurancePct: 2, otherOpexPct: 4, grossMargin: 0.80, netMarginTarget: 0.15,
		staffPerShift: 1, avgHourlyWage: 16, shiftsPerDay: 2, managerSalary: 3500,
		startupCostRange: [100000, 350000], buildoutPerSqft: [80, 200], typicalSqft: [1000, 2500], monthsToBreakEven: [14, 28],
		maxMonthlyRent: 6000, idealRentRange: [2500, 5000],
		footTrafficWeight: 0.40, transitWeight: 0.50, demographicsWeight: 0.60, competitionSensitivity: 0.65, nightlifeRelevance: 0.00,
	},
	'deli': {
		avgTransaction: 10, dailyCustomers: 130, peakHourMultiplier: 2.2, seasonalityRange: [0.85, 1.10], repeatCustomerPct: 70,
		cogsPct: 35, laborPct: 25, rentPct: 8, marketingPct: 2, utilityPct: 3, insurancePct: 2, otherOpexPct: 4, grossMargin: 0.65, netMarginTarget: 0.10,
		staffPerShift: 2, avgHourlyWage: 17, shiftsPerDay: 2, managerSalary: 4000,
		startupCostRange: [60000, 180000], buildoutPerSqft: [80, 200], typicalSqft: [500, 1200], monthsToBreakEven: [10, 20],
		maxMonthlyRent: 7000, idealRentRange: [3000, 5500],
		footTrafficWeight: 0.90, transitWeight: 0.80, demographicsWeight: 0.45, competitionSensitivity: 0.70, nightlifeRelevance: 0.05,
	},
	'pharmacy': {
		avgTransaction: 22, dailyCustomers: 80, peakHourMultiplier: 1.3, seasonalityRange: [0.90, 1.10], repeatCustomerPct: 80,
		cogsPct: 65, laborPct: 12, rentPct: 6, marketingPct: 2, utilityPct: 2, insurancePct: 3, otherOpexPct: 3, grossMargin: 0.35, netMarginTarget: 0.05,
		staffPerShift: 2, avgHourlyWage: 22, shiftsPerDay: 2, managerSalary: 5500,
		startupCostRange: [150000, 450000], buildoutPerSqft: [100, 250], typicalSqft: [800, 2000], monthsToBreakEven: [14, 28],
		maxMonthlyRent: 8000, idealRentRange: [4000, 7000],
		footTrafficWeight: 0.55, transitWeight: 0.60, demographicsWeight: 0.70, competitionSensitivity: 0.60, nightlifeRelevance: 0.00,
	},
	'dry-cleaning': {
		avgTransaction: 15, dailyCustomers: 40, peakHourMultiplier: 1.3, seasonalityRange: [0.80, 1.15], repeatCustomerPct: 80,
		cogsPct: 25, laborPct: 25, rentPct: 10, marketingPct: 2, utilityPct: 5, insurancePct: 2, otherOpexPct: 4, grossMargin: 0.75, netMarginTarget: 0.12,
		staffPerShift: 1, avgHourlyWage: 17, shiftsPerDay: 1, managerSalary: 3800,
		startupCostRange: [80000, 200000], buildoutPerSqft: [60, 180], typicalSqft: [600, 1200], monthsToBreakEven: [12, 24],
		maxMonthlyRent: 5500, idealRentRange: [2500, 4500],
		footTrafficWeight: 0.60, transitWeight: 0.65, demographicsWeight: 0.60, competitionSensitivity: 0.55, nightlifeRelevance: 0.00,
	},
	// ── Doc09 additions: florist, salon/barbershop, med-spa, coworking ──────────
	'florist': {
		avgTransaction: 55, dailyCustomers: 30, peakHourMultiplier: 1.4, seasonalityRange: [0.50, 2.00], repeatCustomerPct: 35,
		cogsPct: 32, laborPct: 25, rentPct: 8, marketingPct: 5, utilityPct: 3, insurancePct: 2, otherOpexPct: 4, grossMargin: 0.60, netMarginTarget: 0.10,
		staffPerShift: 1, avgHourlyWage: 18, shiftsPerDay: 1, managerSalary: 4000,
		startupCostRange: [80000, 200000], buildoutPerSqft: [60, 150], typicalSqft: [800, 1500], monthsToBreakEven: [12, 24],
		maxMonthlyRent: 6000, idealRentRange: [2500, 5000],
		footTrafficWeight: 0.60, transitWeight: 0.50, demographicsWeight: 0.80, competitionSensitivity: 0.70, nightlifeRelevance: 0.00,
	},
	'salon': {
		avgTransaction: 65, dailyCustomers: 15, peakHourMultiplier: 1.3, seasonalityRange: [0.85, 1.15], repeatCustomerPct: 75,
		cogsPct: 12, laborPct: 40, rentPct: 10, marketingPct: 4, utilityPct: 3, insurancePct: 2, otherOpexPct: 4, grossMargin: 0.80, netMarginTarget: 0.10,
		staffPerShift: 3, avgHourlyWage: 18, shiftsPerDay: 1, managerSalary: 4200,
		startupCostRange: [25000, 200000], buildoutPerSqft: [30, 100], typicalSqft: [800, 2500], monthsToBreakEven: [10, 20],
		maxMonthlyRent: 7000, idealRentRange: [3000, 6000],
		footTrafficWeight: 0.45, transitWeight: 0.50, demographicsWeight: 0.75, competitionSensitivity: 0.55, nightlifeRelevance: 0.00,
	},
	'barbershop': {
		avgTransaction: 35, dailyCustomers: 20, peakHourMultiplier: 1.4, seasonalityRange: [0.90, 1.10], repeatCustomerPct: 80,
		cogsPct: 8, laborPct: 38, rentPct: 10, marketingPct: 3, utilityPct: 2, insurancePct: 2, otherOpexPct: 4, grossMargin: 0.85, netMarginTarget: 0.12,
		staffPerShift: 3, avgHourlyWage: 17, shiftsPerDay: 1, managerSalary: 3800,
		startupCostRange: [25000, 200000], buildoutPerSqft: [30, 100], typicalSqft: [600, 1500], monthsToBreakEven: [8, 18],
		maxMonthlyRent: 5000, idealRentRange: [2000, 4500],
		footTrafficWeight: 0.50, transitWeight: 0.50, demographicsWeight: 0.70, competitionSensitivity: 0.55, nightlifeRelevance: 0.00,
	},
	'med-spa': {
		avgTransaction: 350, dailyCustomers: 8, peakHourMultiplier: 1.2, seasonalityRange: [0.80, 1.20], repeatCustomerPct: 60,
		cogsPct: 20, laborPct: 30, rentPct: 10, marketingPct: 8, utilityPct: 3, insurancePct: 4, otherOpexPct: 5, grossMargin: 0.75, netMarginTarget: 0.22,
		staffPerShift: 3, avgHourlyWage: 30, shiftsPerDay: 1, managerSalary: 6500,
		startupCostRange: [200000, 500000], buildoutPerSqft: [150, 350], typicalSqft: [1000, 3500], monthsToBreakEven: [12, 18],
		maxMonthlyRent: 12000, idealRentRange: [5000, 10000],
		footTrafficWeight: 0.20, transitWeight: 0.45, demographicsWeight: 0.90, competitionSensitivity: 0.50, nightlifeRelevance: 0.00,
	},
	'coworking': {
		avgTransaction: 250, dailyCustomers: 30, peakHourMultiplier: 1.2, seasonalityRange: [0.85, 1.10], repeatCustomerPct: 90,
		cogsPct: 10, laborPct: 20, rentPct: 20, marketingPct: 5, utilityPct: 6, insurancePct: 2, otherOpexPct: 5, grossMargin: 0.85, netMarginTarget: 0.12,
		staffPerShift: 2, avgHourlyWage: 20, shiftsPerDay: 1, managerSalary: 5000,
		startupCostRange: [200000, 500000], buildoutPerSqft: [80, 200], typicalSqft: [3000, 10000], monthsToBreakEven: [18, 30],
		maxMonthlyRent: 20000, idealRentRange: [8000, 18000],
		footTrafficWeight: 0.30, transitWeight: 0.75, demographicsWeight: 0.60, competitionSensitivity: 0.55, nightlifeRelevance: 0.00,
	},
};

// ── Lookup Helper ──

const DEFAULT_BENCHMARK: IndustryBenchmark = {
	avgTransaction: 30, dailyCustomers: 50, peakHourMultiplier: 1.5, seasonalityRange: [0.75, 1.25], repeatCustomerPct: 50,
	cogsPct: 35, laborPct: 25, rentPct: 10, marketingPct: 4, utilityPct: 3, insurancePct: 3, otherOpexPct: 5, grossMargin: 0.65, netMarginTarget: 0.08,
	staffPerShift: 2, avgHourlyWage: 18, shiftsPerDay: 2, managerSalary: 4500,
	startupCostRange: [80000, 300000], buildoutPerSqft: [80, 220], typicalSqft: [600, 2000], monthsToBreakEven: [12, 30],
	maxMonthlyRent: 8000, idealRentRange: [3500, 7000],
	footTrafficWeight: 0.50, transitWeight: 0.55, demographicsWeight: 0.60, competitionSensitivity: 0.55, nightlifeRelevance: 0.10,
};

/**
 * Retrieve the canonical benchmark matching the Official Business Type.
 * Includes legacy alias map for callers that still use old keys
 * (e.g. 'coffee', 'restaurant', 'bar', 'fast-casual', 'fitness').
 */
const LEGACY_ALIASES: Record<string, string> = {
	'coffee': 'specialty_coffee',
	'coffee_shop': 'specialty_coffee',
	'coffee-shop': 'specialty_coffee',
	'restaurant': 'full_service_restaurant',
	'full-service-restaurant': 'full_service_restaurant',
	'fast-casual': 'fast_casual',
	'bar': 'bar_nightlife',
	'bar-nightlife': 'bar_nightlife',
	'fitness': 'fitness_studio',
	'fitness-studio': 'fitness_studio',
	'personal_services': 'salon',
	'personal-services': 'salon',
	'hair_salon': 'salon',
	'hair-salon': 'salon',
	'medical_office': 'medical',
	'medical-office': 'medical',
	'med_spa': 'med-spa',
	'dry_cleaning': 'dry-cleaning',
	'juice_bar': 'specialty_coffee',
	'wellness_beverage': 'specialty_coffee',
	'qsr': 'fast_casual',
};

export function getBenchmark(businessType: ValidBusinessType | string): IndustryBenchmark {
	const canonical = LEGACY_ALIASES[businessType] ?? businessType;
	return BENCHMARKS[canonical as ValidBusinessType] || DEFAULT_BENCHMARK;
}

/** List all supported business types */
export function getSupportedBusinessTypes(): string[] {
	return Object.keys(BENCHMARKS);
}
