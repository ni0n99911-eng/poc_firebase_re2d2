/**
 * RE² Scoring Engine — computes dynamic scores based on Launch Pad inputs
 * and neighborhood proxy data. This replaces the hardcoded scores.
 *
 * Architecture:
 * - Phase 1 (current): Uses proxy data per neighborhood + user financial inputs
 * - Phase 2 (future): Will connect to live Overpass/Census/MTA APIs
 *
 * The scores ARE computed, not hardcoded. They change when you change:
 * - Business type → adjusts which factors matter most
 * - Financial inputs → adjusts rent burden, revenue ceiling, breakeven
 * - Alignment weights → adjusts how each layer contributes to final score
 */

import type { LaunchPadData } from './launchpad-store';
import { tierFor } from '$lib/intel/tiers';

// FIX-13: Concept-specific sqft defaults + display names for Where Else copy
const CONCEPT_SQFT_DEFAULTS: Record<string, number> = {
  'specialty_coffee': 900, 'coffee_shop': 900, 'coffee': 900,
  'bakery': 700,
  'fast_casual': 1200,
  'full_service_restaurant': 2000, 'restaurant': 2000,
  'bar_nightlife': 1600, 'bar': 1600,
  'fitness_studio': 2500, 'fitness': 2500,
  'retail': 1400,
  'personal_services': 800,
  'medical_office': 1200,
  'florist': 600,
  'qsr': 1000,
};

const CONCEPT_DISPLAY_NAMES: Record<string, string> = {
  'specialty_coffee': 'Coffee / Café', 'coffee_shop': 'Coffee / Café', 'coffee': 'Coffee / Café',
  'bakery': 'Bakery', 'fast_casual': 'Fast Casual',
  'full_service_restaurant': 'Restaurant', 'restaurant': 'Restaurant',
  'bar_nightlife': 'Bar / Lounge', 'bar': 'Bar / Lounge',
  'fitness_studio': 'Fitness Studio', 'fitness': 'Fitness Studio',
  'retail': 'Retail Store',
  'personal_services': 'Personal Services',
  'medical_office': 'Medical Office',
  'florist': 'Florist',
  'qsr': 'Quick Service',
};

function getConceptDisplayName(bizType: string): string {
  return CONCEPT_DISPLAY_NAMES[bizType.toLowerCase()] ?? bizType;
}


// ──────────────────────────────────────────────
// Neighborhood proxy data (will be replaced by live API data in Phase 2)
// ──────────────────────────────────────────────
export const NEIGHBORHOOD_DATA: Record<string, NeighborhoodProxy> = {
	'Chelsea': {
		rentPSF: 95, medianIncome: 115000, pop25to44Pct: 42, footTraffic: 38000,
		cafeCount: 3, gymCount: 5, yogaCount: 4, healthFoodCount: 3,
		subwayStations: 4, avgCompetitorRating: 3.7, trendScore: 88,
		wellnessIndex: 95, familyIndex: 65, officeIndex: 55,
		dobViolations: 0, scaffolding: 0, vacancy: 8, buildingAge: 1952
	},
	'Flatiron': {
		rentPSF: 130, medianIncome: 125000, pop25to44Pct: 44, footTraffic: 45000,
		cafeCount: 5, gymCount: 6, yogaCount: 3, healthFoodCount: 2,
		subwayStations: 5, avgCompetitorRating: 4.1, trendScore: 82,
		wellnessIndex: 88, familyIndex: 45, officeIndex: 90,
		dobViolations: 0, scaffolding: 0, vacancy: 10, buildingAge: 1920
	},
	'West Village': {
		rentPSF: 175, medianIncome: 145000, pop25to44Pct: 36, footTraffic: 28000,
		cafeCount: 6, gymCount: 3, yogaCount: 2, healthFoodCount: 2,
		subwayStations: 2, avgCompetitorRating: 4.4, trendScore: 70,
		wellnessIndex: 78, familyIndex: 55, officeIndex: 25,
		dobViolations: 0, scaffolding: 0, vacancy: 5, buildingAge: 1880
	},
	'SoHo': {
		rentPSF: 220, medianIncome: 150000, pop25to44Pct: 38, footTraffic: 55000,
		cafeCount: 10, gymCount: 4, yogaCount: 2, healthFoodCount: 3,
		subwayStations: 3, avgCompetitorRating: 4.2, trendScore: 72,
		wellnessIndex: 65, familyIndex: 30, officeIndex: 50,
		dobViolations: 1, scaffolding: 2, vacancy: 12, buildingAge: 1860
	},
	'East Village': {
		rentPSF: 100, medianIncome: 82000, pop25to44Pct: 50, footTraffic: 32000,
		cafeCount: 8, gymCount: 3, yogaCount: 5, healthFoodCount: 3,
		subwayStations: 3, avgCompetitorRating: 3.9, trendScore: 86,
		wellnessIndex: 80, familyIndex: 40, officeIndex: 20,
		dobViolations: 1, scaffolding: 1, vacancy: 11, buildingAge: 1910
	},
	'Tribeca': {
		rentPSF: 195, medianIncome: 175000, pop25to44Pct: 30, footTraffic: 20000,
		cafeCount: 3, gymCount: 3, yogaCount: 1, healthFoodCount: 1,
		subwayStations: 3, avgCompetitorRating: 4.0, trendScore: 65,
		wellnessIndex: 62, familyIndex: 90, officeIndex: 40,
		dobViolations: 0, scaffolding: 0, vacancy: 4, buildingAge: 1870
	},
	'Williamsburg': {
		rentPSF: 85, medianIncome: 95000, pop25to44Pct: 52, footTraffic: 28000,
		cafeCount: 12, gymCount: 4, yogaCount: 6, healthFoodCount: 4,
		subwayStations: 2, avgCompetitorRating: 4.0, trendScore: 90,
		wellnessIndex: 88, familyIndex: 50, officeIndex: 18,
		dobViolations: 0, scaffolding: 0, vacancy: 7, buildingAge: 1940
	},
	'Park Slope': {
		rentPSF: 78, medianIncome: 130000, pop25to44Pct: 34, footTraffic: 18000,
		cafeCount: 5, gymCount: 3, yogaCount: 2, healthFoodCount: 2,
		subwayStations: 3, avgCompetitorRating: 4.2, trendScore: 75,
		wellnessIndex: 70, familyIndex: 96, officeIndex: 15,
		dobViolations: 0, scaffolding: 0, vacancy: 3, buildingAge: 1900
	},
	'Midtown East': {
		rentPSF: 185, medianIncome: 100000, pop25to44Pct: 32, footTraffic: 60000,
		cafeCount: 15, gymCount: 7, yogaCount: 2, healthFoodCount: 2,
		subwayStations: 7, avgCompetitorRating: 3.4, trendScore: 55,
		wellnessIndex: 40, familyIndex: 25, officeIndex: 98,
		dobViolations: 2, scaffolding: 3, vacancy: 22, buildingAge: 1955
	},
	'Upper East Side': {
		rentPSF: 115, medianIncome: 155000, pop25to44Pct: 28, footTraffic: 22000,
		cafeCount: 4, gymCount: 5, yogaCount: 4, healthFoodCount: 3,
		subwayStations: 4, avgCompetitorRating: 4.0, trendScore: 62,
		wellnessIndex: 78, familyIndex: 92, officeIndex: 20,
		dobViolations: 0, scaffolding: 0, vacancy: 6, buildingAge: 1935
	},
	'Upper West Side': {
		rentPSF: 105, medianIncome: 135000, pop25to44Pct: 31, footTraffic: 24000,
		cafeCount: 5, gymCount: 4, yogaCount: 3, healthFoodCount: 3,
		subwayStations: 4, avgCompetitorRating: 4.1, trendScore: 68,
		wellnessIndex: 75, familyIndex: 90, officeIndex: 18,
		dobViolations: 0, scaffolding: 0, vacancy: 6, buildingAge: 1925
	},
	'FiDi': {
		rentPSF: 155, medianIncome: 105000, pop25to44Pct: 38, footTraffic: 52000,
		cafeCount: 9, gymCount: 5, yogaCount: 1, healthFoodCount: 1,
		subwayStations: 8, avgCompetitorRating: 3.5, trendScore: 58,
		wellnessIndex: 35, familyIndex: 25, officeIndex: 95,
		dobViolations: 1, scaffolding: 2, vacancy: 20, buildingAge: 1960
	},
	'Harlem': {
		rentPSF: 55, medianIncome: 48000, pop25to44Pct: 30, footTraffic: 12000,
		cafeCount: 2, gymCount: 1, yogaCount: 1, healthFoodCount: 0,
		subwayStations: 4, avgCompetitorRating: 3.3, trendScore: 78,
		wellnessIndex: 30, familyIndex: 72, officeIndex: 10,
		dobViolations: 3, scaffolding: 2, vacancy: 25, buildingAge: 1920
	},
	'LIC': {
		rentPSF: 68, medianIncome: 88000, pop25to44Pct: 46, footTraffic: 16000,
		cafeCount: 2, gymCount: 3, yogaCount: 2, healthFoodCount: 1,
		subwayStations: 3, avgCompetitorRating: 3.8, trendScore: 88,
		wellnessIndex: 62, familyIndex: 55, officeIndex: 45,
		dobViolations: 0, scaffolding: 0, vacancy: 10, buildingAge: 1970
	},
	'NoHo': {
		rentPSF: 190, medianIncome: 138000, pop25to44Pct: 37, footTraffic: 40000,
		cafeCount: 7, gymCount: 3, yogaCount: 2, healthFoodCount: 2,
		subwayStations: 4, avgCompetitorRating: 4.3, trendScore: 74,
		wellnessIndex: 68, familyIndex: 38, officeIndex: 52,
		dobViolations: 0, scaffolding: 1, vacancy: 9, buildingAge: 1870
	},
	'Bushwick': {
		rentPSF: 48, medianIncome: 45000, pop25to44Pct: 46, footTraffic: 10000,
		cafeCount: 4, gymCount: 1, yogaCount: 3, healthFoodCount: 1,
		subwayStations: 2, avgCompetitorRating: 3.8, trendScore: 85,
		wellnessIndex: 50, familyIndex: 45, officeIndex: 10,
		dobViolations: 2, scaffolding: 1, vacancy: 18, buildingAge: 1935
	},
	'Union Square': {
		rentPSF: 145, medianIncome: 110000, pop25to44Pct: 44, footTraffic: 50000,
		cafeCount: 8, gymCount: 5, yogaCount: 3, healthFoodCount: 3,
		subwayStations: 5, avgCompetitorRating: 3.9, trendScore: 82,
		wellnessIndex: 82, familyIndex: 50, officeIndex: 70,
		dobViolations: 0, scaffolding: 1, vacancy: 9, buildingAge: 1920
	},
	'Hudson Yards': {
		rentPSF: 185, medianIncome: 140000, pop25to44Pct: 38, footTraffic: 42000,
		cafeCount: 6, gymCount: 4, yogaCount: 2, healthFoodCount: 2,
		subwayStations: 3, avgCompetitorRating: 4.0, trendScore: 90,
		wellnessIndex: 72, familyIndex: 35, officeIndex: 88,
		dobViolations: 0, scaffolding: 0, vacancy: 12, buildingAge: 2019
	}
};

interface NeighborhoodProxy {
	rentPSF: number;
	medianIncome: number;
	pop25to44Pct: number;
	footTraffic: number;
	cafeCount: number;
	gymCount: number;
	yogaCount: number;
	healthFoodCount: number;
	subwayStations: number;
	avgCompetitorRating: number;
	trendScore: number;
	wellnessIndex: number;
	familyIndex: number;
	officeIndex: number;
	dobViolations: number;
	scaffolding: number;
	vacancy: number;
	buildingAge: number;
}

// ──────────────────────────────────────────────
// Competitive Intelligence types
// ──────────────────────────────────────────────
export interface CompetitiveIntel {
	directCompetitors: number;
	indirectCompetitors: number;
	totalCompetitors: number;
	saturationLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SATURATED';
	saturationScore: number;  // 0-100 (100 = wide open, 0 = saturated)
	gapAnalysis: GapItem[];
	competitorDensity: number; // competitors per 1000 daily foot traffic
	avgCompetitorQuality: number; // 0-5 rating
	chainPresence: string;
	marketOpportunity: string;
}

interface GapItem {
	gap: string;
	opportunity: 'HIGH' | 'MEDIUM' | 'LOW';
	description: string;
}

// ──────────────────────────────────────────────
// Business format modifiers (kiosk, café, restaurant, etc.)
// ──────────────────────────────────────────────
export type BusinessFormat = 'kiosk' | 'cafe' | 'fast-casual' | 'full-service' | 'ghost-kitchen' | 'food-truck';

const FORMAT_MODIFIERS: Record<BusinessFormat, FormatModifier> = {
	'kiosk': {
		sqftMultiplier: 0.4, rentTolerance: 1.3, captureMultiplier: 0.6,
		buildoutMultiplier: 0.35, teamMultiplier: 0.5, footTrafficWeight: 1.2
	},
	'cafe': {
		sqftMultiplier: 1.0, rentTolerance: 1.0, captureMultiplier: 1.0,
		buildoutMultiplier: 1.0, teamMultiplier: 1.0, footTrafficWeight: 1.0
	},
	'fast-casual': {
		sqftMultiplier: 1.3, rentTolerance: 0.9, captureMultiplier: 1.2,
		buildoutMultiplier: 1.4, teamMultiplier: 1.3, footTrafficWeight: 1.1
	},
	'full-service': {
		sqftMultiplier: 1.8, rentTolerance: 0.8, captureMultiplier: 0.7,
		buildoutMultiplier: 1.8, teamMultiplier: 1.8, footTrafficWeight: 0.7
	},
	'ghost-kitchen': {
		sqftMultiplier: 0.5, rentTolerance: 1.5, captureMultiplier: 0.3,
		buildoutMultiplier: 0.5, teamMultiplier: 0.6, footTrafficWeight: 0.2
	},
	'food-truck': {
		sqftMultiplier: 0.0, rentTolerance: 2.0, captureMultiplier: 0.4,
		buildoutMultiplier: 0.2, teamMultiplier: 0.4, footTrafficWeight: 1.5
	}
};

interface FormatModifier {
	sqftMultiplier: number;
	rentTolerance: number;
	captureMultiplier: number;
	buildoutMultiplier: number;
	teamMultiplier: number;
	footTrafficWeight: number;
}

export function getFormatModifier(format?: string): FormatModifier {
	if (!format || !(format in FORMAT_MODIFIERS)) return FORMAT_MODIFIERS['cafe'];
	return FORMAT_MODIFIERS[format as BusinessFormat];
}

// ──────────────────────────────────────────────
// Business type profiles — what matters for each type
// ──────────────────────────────────────────────
const BUSINESS_PROFILES: Record<string, BusinessProfile> = {
	'Specialty Coffee/Café': {
		footTrafficWeight: 0.8, wellnessWeight: 0.9, familyWeight: 0.5, officeWeight: 0.7,
		competitionIdeal: 3, captureRate: 0.015, avgTicketDefault: 8.75, laborPct: 0.30,
		rentCeiling: 0.10, buildoutPerSqft: 250
	},
	'Restaurant': {
		footTrafficWeight: 0.9, wellnessWeight: 0.3, familyWeight: 0.7, officeWeight: 0.6,
		competitionIdeal: 5, captureRate: 0.008, avgTicketDefault: 28, laborPct: 0.33,
		rentCeiling: 0.10, buildoutPerSqft: 350
	},
	'Retail': {
		footTrafficWeight: 1.0, wellnessWeight: 0.2, familyWeight: 0.5, officeWeight: 0.5,
		competitionIdeal: 4, captureRate: 0.005, avgTicketDefault: 45, laborPct: 0.20,
		rentCeiling: 0.12, buildoutPerSqft: 150
	},
	'Fitness': {
		footTrafficWeight: 0.5, wellnessWeight: 1.0, familyWeight: 0.4, officeWeight: 0.8,
		competitionIdeal: 2, captureRate: 0.003, avgTicketDefault: 120, laborPct: 0.35,
		rentCeiling: 0.15, buildoutPerSqft: 200
	},
	'Prof Services': {
		footTrafficWeight: 0.3, wellnessWeight: 0.1, familyWeight: 0.3, officeWeight: 1.0,
		competitionIdeal: 8, captureRate: 0.001, avgTicketDefault: 200, laborPct: 0.45,
		rentCeiling: 0.08, buildoutPerSqft: 100
	},
	'Grocery': {
		footTrafficWeight: 0.7, wellnessWeight: 0.5, familyWeight: 0.9, officeWeight: 0.3,
		competitionIdeal: 2, captureRate: 0.02, avgTicketDefault: 35, laborPct: 0.25,
		rentCeiling: 0.08, buildoutPerSqft: 180
	},
	'Salon': {
		footTrafficWeight: 0.6, wellnessWeight: 0.6, familyWeight: 0.5, officeWeight: 0.4,
		competitionIdeal: 3, captureRate: 0.004, avgTicketDefault: 65, laborPct: 0.40,
		rentCeiling: 0.12, buildoutPerSqft: 180
	}
};

interface BusinessProfile {
	footTrafficWeight: number;
	wellnessWeight: number;
	familyWeight: number;
	officeWeight: number;
	competitionIdeal: number;
	captureRate: number;
	avgTicketDefault: number;
	laborPct: number;
	rentCeiling: number;
	buildoutPerSqft: number;
}

function getProfile(bizType: string): BusinessProfile {
	return BUSINESS_PROFILES[bizType] || BUSINESS_PROFILES['Specialty Coffee/Café'];
}

// ──────────────────────────────────────────────
// VLF — Vision-Location Fit (0-100)
// ──────────────────────────────────────────────
export function computeVLF(hood: NeighborhoodProxy, inputs: LaunchPadData): number {
	const profile = getProfile(inputs.businessType);

	// Demographic match (income alignment)
	const incomeRatio = Math.min(hood.medianIncome / (inputs.financialGoals.avgTicket * 1000), 2);
	const demoScore = Math.min(95, incomeRatio * 45 + hood.pop25to44Pct);

	// Brand alignment (weighted by business type)
	const wellnessScore = hood.wellnessIndex * profile.wellnessWeight;
	const familyScore = hood.familyIndex * profile.familyWeight;
	const officeScore = hood.officeIndex * profile.officeWeight;
	const brandScore = Math.min(95, (wellnessScore + familyScore + officeScore) / (profile.wellnessWeight + profile.familyWeight + profile.officeWeight));

	// Competition (inverted urban scoring — v2.0)
	const idealDiff = Math.abs(hood.cafeCount - profile.competitionIdeal);
	const compScore = Math.max(20, 90 - idealDiff * 12);

	// Trend
	const trendScore = hood.trendScore;

	// Weighted VLF
	const vlf = (demoScore * 0.30 + brandScore * 0.30 + compScore * 0.20 + trendScore * 0.20);
	return Math.round(Math.min(98, Math.max(15, vlf)));
}

// ──────────────────────────────────────────────
// GLF — Goal-Location Feasibility (0-100)
// ──────────────────────────────────────────────
export function computeGLF(hood: NeighborhoodProxy, inputs: LaunchPadData): number {
	const profile = getProfile(inputs.businessType);
	const fg = inputs.financialGoals;

	// Revenue ceiling (foot traffic × capture rate × AOV × 365)
	const captureRate = profile.captureRate;
	const aov = fg.avgTicket || profile.avgTicketDefault;
	const revenueCeiling = hood.footTraffic * captureRate * aov * 365;
	const revenueRatio = revenueCeiling / Math.max(fg.revenueY1, 1);
	const revenueScore = revenueRatio >= 1.5 ? 90 : revenueRatio >= 1.2 ? 75 : revenueRatio >= 1.0 ? 55 : Math.max(20, revenueRatio * 50);

	// Rent burden
	const monthlyRent = hood.rentPSF * fg.squareFootage / 12;
	const monthlyRevenue = fg.revenueY1 / 12;
	const rentRatio = monthlyRent / Math.max(monthlyRevenue, 1);
	const rentScore = rentRatio <= 0.06 ? 95 : rentRatio <= 0.08 ? 85 : rentRatio <= 0.10 ? 70 : rentRatio <= 0.12 ? 55 : rentRatio <= 0.15 ? 40 : 25;

	// Breakeven (months)
	const buildoutCost = fg.buildoutBudget || (profile.buildoutPerSqft * fg.squareFootage);
	const monthlyOpex = monthlyRent + (fg.teamSize * 19 * 160) + (monthlyRevenue * 0.30); // rent + labor + COGS
	const monthlyProfit = monthlyRevenue * 0.70 - monthlyOpex + monthlyRent; // add back rent since it's in opex
	const breakeven = monthlyProfit > 0 ? buildoutCost / monthlyProfit : 999;
	const breakevenScore = breakeven <= 12 ? 90 : breakeven <= 18 ? 75 : breakeven <= 24 ? 60 : breakeven <= 36 ? 40 : 25;

	// Labor affordability
	const laborCost = fg.teamSize * 19 * 160; // $19/hr × 160hrs/mo
	const laborRatio = laborCost / Math.max(monthlyRevenue, 1);
	const laborScore = laborRatio <= profile.laborPct ? 85 : laborRatio <= profile.laborPct + 0.05 ? 70 : 45;

	const glf = (revenueScore * 0.35 + rentScore * 0.30 + breakevenScore * 0.20 + laborScore * 0.15);
	return Math.round(Math.min(98, Math.max(10, glf)));
}

// ──────────────────────────────────────────────
// R&R — Risk & Resilience (0-100)
// ──────────────────────────────────────────────
export function computeRR(hood: NeighborhoodProxy, vlf: number, glf: number): number {
	// Building risk
	const buildingRisk = Math.max(0, 100 - hood.dobViolations * 15 - hood.scaffolding * 10);

	// Market resilience (high income = more resilient)
	const marketResilience = Math.min(90, hood.medianIncome / 2000 + hood.trendScore * 0.3);

	// Competitive resilience (fewer competitors = easier recovery)
	const compResilience = hood.cafeCount <= 3 ? 80 : hood.cafeCount <= 6 ? 65 : 45;

	// Cross-engine validation (VLF and GLF both strong = lower risk)
	const crossValidation = (vlf + glf) / 2 >= 70 ? 85 : (vlf + glf) / 2 >= 55 ? 70 : 50;

	const rr = (buildingRisk * 0.20 + marketResilience * 0.25 + compResilience * 0.25 + crossValidation * 0.30);
	return Math.round(Math.min(98, Math.max(15, rr)));
}

// ──────────────────────────────────────────────
// PoS — Probability of Success (produces a range)
// ──────────────────────────────────────────────
export interface PoSResult {
	low: number;
	high: number;
	mid: number;
	verdict: string;
	confidence: string;
	dataPoints: number;
	totalPoints: number;
}

export function computePoS(vlf: number, glf: number, rr: number, weights: Record<string, number>): PoSResult {
	// Weighted composite — user's alignment weights affect this
	const totalWeight = (weights.l0_macro || 10) + (weights.l1_city || 15) + (weights.l2_block || 18) + (weights.l3_planfit || 18);
	const vlfWeight = ((weights.l0_macro || 10) + (weights.l1_city || 15)) / totalWeight;
	const glfWeight = ((weights.l2_block || 18) + (weights.l3_planfit || 18)) / totalWeight;

	const base = vlf * 0.30 * (1 + vlfWeight * 0.3) + glf * 0.35 * (1 + glfWeight * 0.3) + rr * 0.20;
	const normalized = Math.min(95, Math.max(15, base / 1.1));

	// Confidence band (±8 with proxy data, would be ±3 with live APIs)
	const band = 8;
	const low = Math.round(Math.max(10, normalized - band));
	const high = Math.round(Math.min(98, normalized + band));
	const mid = Math.round(normalized);

	const verdict = mid >= 75 ? 'STRONG GO' : mid >= 65 ? 'GO — MONITOR' : mid >= 50 ? 'PROCEED WITH CAUTION' : 'HIGH RISK';

	// Data completeness (proxy data = 10/18 points, live would be 18/18)
	const dataPoints = 10;
	const totalPoints = 18;
	const confidence = `${Math.round((dataPoints / totalPoints) * 100)}%`;

	return { low, high, mid, verdict, confidence, dataPoints, totalPoints };
}

// ──────────────────────────────────────────────
// Competitive Intelligence computation
// ──────────────────────────────────────────────
export function computeCompetitiveIntel(hood: NeighborhoodProxy, inputs: LaunchPadData): CompetitiveIntel {
	const profile = getProfile(inputs.businessType);
	const bizType = inputs.businessType.toLowerCase();

	// Direct competitors = businesses of same type (cafeCount for coffee, gymCount for fitness, etc.)
	let directCompetitors = hood.cafeCount;
	if (bizType.includes('fitness') || bizType.includes('gym')) directCompetitors = hood.gymCount;
	else if (bizType.includes('restaurant')) directCompetitors = Math.round(hood.cafeCount * 1.5);
	else if (bizType.includes('grocery')) directCompetitors = hood.healthFoodCount;
	else if (bizType.includes('salon')) directCompetitors = Math.round(hood.yogaCount + hood.gymCount * 0.3);

	// Indirect competitors = adjacent categories that overlap
	const indirectCompetitors = Math.round(
		hood.cafeCount * 0.3 + hood.gymCount * 0.2 + hood.yogaCount * 0.15 + hood.healthFoodCount * 0.15
	);
	const totalCompetitors = directCompetitors + indirectCompetitors;

	// Saturation: competitors per 1000 daily foot traffic
	const competitorDensity = totalCompetitors / Math.max(hood.footTraffic / 1000, 1);

	// Saturation scoring (relative to ideal)
	const idealDirect = profile.competitionIdeal;
	let saturationScore: number;
	let saturationLevel: CompetitiveIntel['saturationLevel'];

	if (directCompetitors === 0) {
		saturationScore = 40; // Unproven market
		saturationLevel = 'LOW';
	} else if (directCompetitors <= idealDirect) {
		saturationScore = 85; // Sweet spot
		saturationLevel = 'LOW';
	} else if (directCompetitors <= idealDirect * 2) {
		saturationScore = 60;
		saturationLevel = 'MODERATE';
	} else if (directCompetitors <= idealDirect * 3) {
		saturationScore = 35;
		saturationLevel = 'HIGH';
	} else {
		saturationScore = 15;
		saturationLevel = 'SATURATED';
	}

	// Avg competitor quality
	const avgCompetitorQuality = hood.avgCompetitorRating;

	// Chain presence detection (proxy based on neighborhood data)
	const isHighTraffic = hood.footTraffic > 30000;
	const chainPresence = isHighTraffic && hood.cafeCount > 5
		? 'Major chains present (Starbucks, Dunkin likely). Drives traffic but brand differentiation critical.'
		: isHighTraffic
		? 'Moderate chain presence. Halo traffic benefit possible.'
		: 'Low chain presence. Independent-friendly market.';

	// Gap analysis — what's missing in this neighborhood
	const gaps: GapItem[] = [];

	// Wellness gap
	if (hood.wellnessIndex < 60 && (bizType.includes('coffee') || bizType.includes('fitness'))) {
		gaps.push({
			gap: 'Wellness-focused offerings',
			opportunity: 'HIGH',
			description: `Only ${hood.yogaCount} yoga + ${hood.healthFoodCount} health food stores. Wellness demand underserved.`
		});
	}

	// Specialty coffee gap
	if (hood.cafeCount < 3 && bizType.includes('coffee')) {
		gaps.push({
			gap: 'Specialty coffee',
			opportunity: 'HIGH',
			description: `Only ${hood.cafeCount} cafes for ${(hood.footTraffic / 1000).toFixed(0)}K daily foot traffic. Strong unmet demand.`
		});
	}

	// Family-oriented gap
	if (hood.familyIndex > 70 && hood.cafeCount < 5) {
		gaps.push({
			gap: 'Family-friendly F&B',
			opportunity: 'MEDIUM',
			description: `Family index ${hood.familyIndex}/100 but limited cafe options. Kids menu could differentiate.`
		});
	}

	// Office crowd gap
	if (hood.officeIndex > 70 && hood.cafeCount < 6) {
		gaps.push({
			gap: 'Quick-service for office workers',
			opportunity: 'HIGH',
			description: `Office index ${hood.officeIndex}/100 with only ${hood.cafeCount} cafes. Morning rush underserved.`
		});
	}

	// Quality gap — low avg ratings = room for quality player
	if (hood.avgCompetitorRating < 4.0 && directCompetitors > 0) {
		gaps.push({
			gap: 'Quality differentiation',
			opportunity: 'HIGH',
			description: `Avg competitor rating ${hood.avgCompetitorRating}★. Room for a premium quality entrant.`
		});
	}

	// Healthy food gap
	if (hood.healthFoodCount < 2) {
		gaps.push({
			gap: 'Healthy food options',
			opportunity: 'MEDIUM',
			description: `Only ${hood.healthFoodCount} health food stores. Functional/clean menu is a differentiator.`
		});
	}

	// If no gaps found, provide a default
	if (gaps.length === 0) {
		gaps.push({
			gap: 'Product innovation',
			opportunity: 'MEDIUM',
			description: 'Market is well-served. Differentiation must come from unique product or experience.'
		});
	}

	// Market opportunity summary
	const marketOpportunity = saturationScore >= 70
		? `Strong opportunity. ${directCompetitors} direct competitors is below saturation for ${(hood.footTraffic / 1000).toFixed(0)}K daily foot traffic. ${gaps.length} market gap${gaps.length > 1 ? 's' : ''} identified.`
		: saturationScore >= 45
		? `Moderate opportunity. Market is active with ${directCompetitors} direct competitors. Differentiation required — ${gaps[0]?.gap || 'unique positioning'} is your best angle.`
		: `Challenging market. ${directCompetitors} direct competitors creates high density (${competitorDensity.toFixed(1)} per 1K traffic). Consider adjacent blocks or unique format.`;

	return {
		directCompetitors,
		indirectCompetitors,
		totalCompetitors,
		saturationLevel,
		saturationScore,
		gapAnalysis: gaps.slice(0, 4), // max 4 gaps
		competitorDensity: Math.round(competitorDensity * 10) / 10,
		avgCompetitorQuality,
		chainPresence,
		marketOpportunity
	};
}

// ──────────────────────────────────────────────
// Full neighborhood score computation
// ──────────────────────────────────────────────
export interface NeighborhoodScore {
	name: string;
	overallScore: number;
	vlf: number;
	glf: number;
	rr: number;
	pos: PoSResult;
	breakdown: {
		demographic: number;
		rent: number;
		competition: number;
		trend: number;
		footTraffic: number;
	};
	tags: string[];
	summary: string;
	monthlyRent: number;
	revenueCeiling: number;
	rentRatio: number;
	competitiveIntel: CompetitiveIntel;
}

export function scoreNeighborhood(name: string, inputs: LaunchPadData): NeighborhoodScore | null {
	const hood = NEIGHBORHOOD_DATA[name];
	if (!hood) return null;

	const profile = getProfile(inputs.businessType);
	const fg = inputs.financialGoals;

	const vlf = computeVLF(hood, inputs);
	const glf = computeGLF(hood, inputs);
	const rr = computeRR(hood, vlf, glf);
	const pos = computePoS(vlf, glf, rr, inputs.weights);

	// Computed financials
	const monthlyRent = hood.rentPSF * fg.squareFootage / 12;
	const revenueCeiling = hood.footTraffic * profile.captureRate * (fg.avgTicket || profile.avgTicketDefault) * 365;
	const rentRatio = monthlyRent / Math.max(fg.revenueY1 / 12, 1);

	// Breakdown scores
	const incomeRatio = Math.min(hood.medianIncome / (fg.avgTicket * 1000), 2);
	const demographic = Math.round(Math.min(95, incomeRatio * 45 + hood.pop25to44Pct));
	const rentBudgetFit = monthlyRent <= fg.monthlyRentBudget ? 85 : monthlyRent <= fg.monthlyRentBudget * 1.1 ? 70 : 55;
	const idealDiff = Math.abs(hood.cafeCount - profile.competitionIdeal);
	const competition = Math.round(Math.max(35, 85 - idealDiff * 10));

	// Tags
	const tags: string[] = [];
	if (hood.wellnessIndex >= 80) tags.push('Wellness ✓');
	else if (hood.wellnessIndex >= 60) tags.push('Wellness △');
	if (hood.familyIndex >= 70) tags.push('Family ✓');
	else if (hood.familyIndex >= 50) tags.push('Family △');
	if (hood.subwayStations >= 3) tags.push('Transit ✓');
	else tags.push('Transit △');
	if (monthlyRent <= fg.monthlyRentBudget) tags.push('Budget ✓');
	else tags.push('Budget ⚠');
	if (hood.officeIndex >= 70) tags.push('Office ✓');

	// Dynamic summary
	const summary = generateSummary(name, hood, inputs, profile, monthlyRent, vlf, glf);

	// Competitive intelligence
	const competitiveIntel = computeCompetitiveIntel(hood, inputs);

	const overallScore = Math.round(Math.min(98, Math.max(10, vlf * 0.40 + glf * 0.35 + rr * 0.25)));

	return {
		name, overallScore, vlf, glf, rr, pos,
		breakdown: { demographic, rent: rentBudgetFit, competition, trend: hood.trendScore, footTraffic: Math.round(Math.min(95, hood.footTraffic / 500)) },
		tags, summary, monthlyRent, revenueCeiling, rentRatio, competitiveIntel
	};
}

function generateSummary(name: string, hood: NeighborhoodProxy, inputs: LaunchPadData, profile: BusinessProfile, monthlyRent: number, vlf: number, glf: number): string {
	const fg = inputs.financialGoals;
	const parts: string[] = [];

	if (vlf >= 75) {
		parts.push(`Strong vision-location fit for your ${getConceptDisplayName(inputs.businessType)}.`);
	} else if (vlf >= 60) {
		parts.push(`Decent fit for your ${getConceptDisplayName(inputs.businessType)}, with some trade-offs.`);
	} else {
		parts.push(`Weak fit for your ${getConceptDisplayName(inputs.businessType)} — consider alternatives.`);
	}

	// Rent commentary — MEDIUM-2: derive sqft from budget if squareFootage is 0
	const displaySqft = fg.squareFootage > 0
		? fg.squareFootage
		: hood.rentPSF > 0
			? Math.round((fg.monthlyRentBudget * 12) / hood.rentPSF)
			: (CONCEPT_SQFT_DEFAULTS[inputs.businessType?.toLowerCase() ?? ''] ?? 1200); // FIX-13: concept-specific fallback
	// P1-4: Guard against $0K budget when user skipped the budget step
	if (fg.monthlyRentBudget > 0) {
		if (monthlyRent <= fg.monthlyRentBudget) {
			parts.push(`$${hood.rentPSF}/sqft rent fits within your $${(fg.monthlyRentBudget / 1000).toFixed(0)}K budget at ${displaySqft > 0 ? displaySqft : '~1,200'}sqft.`);
		} else {
			const over = Math.round(((monthlyRent - fg.monthlyRentBudget) / fg.monthlyRentBudget) * 100);
			parts.push(`$${hood.rentPSF}/sqft pushes rent ${over}% over your $${(fg.monthlyRentBudget / 1000).toFixed(0)}K budget.`);
		}
	} else {
		parts.push(`$${hood.rentPSF}/sqft rent — typical for this area at ~${displaySqft > 0 ? displaySqft : '1,200'}sqft.`);
	}

	// Competition
	if (hood.cafeCount <= profile.competitionIdeal) {
		parts.push(`${hood.cafeCount} competitors — room for your concept.`);
	} else {
		parts.push(`${hood.cafeCount} competitors — denser market, differentiation critical.`);
	}

	// Transit
	parts.push(`${hood.subwayStations} subway stations nearby. ${(hood.footTraffic / 1000).toFixed(0)}K daily foot traffic.`);

	return parts.join(' ');
}

/**
 * Score-to-label mapping per SOP Handbook Source Guide
 */
// FIX-025: BR-1 unified verdict vocabulary
export function getScoreLabel(score: number): { label: string; color: string; bgColor: string } {
	// EF-4 (April 11): label sourced from canonical tierFor. Hex colors stay
	// here because this surface (score pill) needs specific brand tints that
	// don't match the generic green/amber/red buckets tierFor returns.
	const label = tierFor(score, 'fitIQ').label;
	if (score >= 75) return { label, color: '#00ff88', bgColor: 'rgba(0, 255, 136, 0.15)' };
	if (score >= 65) return { label, color: '#00d4ff', bgColor: 'rgba(0, 212, 255, 0.15)' };
	if (score >= 50) return { label, color: '#ffbb00', bgColor: 'rgba(255, 187, 0, 0.15)' };
	if (score >= 40) return { label, color: '#ff6b35', bgColor: 'rgba(255, 107, 53, 0.15)' };
	return { label, color: '#ff3355', bgColor: 'rgba(255, 51, 85, 0.15)' };
}

/**
 * Score all known neighborhoods and return sorted by overall score
 */
export function scoreAllNeighborhoods(inputs: LaunchPadData): NeighborhoodScore[] {
	const results: NeighborhoodScore[] = [];
	for (const name of Object.keys(NEIGHBORHOOD_DATA)) {
		const score = scoreNeighborhood(name, inputs);
		if (score) results.push(score);
	}
	return results.sort((a, b) => b.overallScore - a.overallScore);
}
