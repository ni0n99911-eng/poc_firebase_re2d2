// ═══════════════════════════════════════════════
// RE² Location IQ — Scoring Engines
// VLF (35%), GLF (40%), R&R (25%) → PoS
// ═══════════════════════════════════════════════

import { HOOD_DATA, LAYER_DEFS, type HoodDataEntry } from '../data/constants';
import { haversine } from '../utils/helpers';
import type { POI, ScanData, LiveIntelReport } from '../api/geo';

// ── Financial model constants (extracted from inline magic numbers) ──
// These are VLF/GLF/R&R engine fallback defaults — concept-specific values from
// conceptKPIs.ts should always be preferred when available.
/** Average foot traffic capture rate for food & beverage concepts. Source: industry benchmarks 2023. */
const ENGINE_CAPTURE_RATE = 0.08;
/** Default average order value (AOV) when no concept-specific ticket is set. Source: NYC F&B market baseline. */
const ENGINE_DEFAULT_AOV = 8.75;
/** Default assumed floor area (sq ft) for rent estimation from $/PSF rates when no explicit sq footage provided. */
const ENGINE_DEFAULT_SQFT = 1200;
/** Last-resort monthly rent fallback when no address match found in HOOD_DATA. ~$15K/mo is mid-range Manhattan. */
const ENGINE_LAST_RESORT_RENT = 15000;

// ── Continuous scoring helpers (avoid coarse buckets) ──
function _clamp(v: number, lo = 0, hi = 100): number { return Math.max(lo, Math.min(hi, v)); }
function _sigmoid(x: number, mid: number, k = 0.1): number { return 100 / (1 + Math.exp(-k * (x - mid))); }
function _logCurve(x: number, half: number, cap = 97): number { return x <= 0 ? 0 : Math.min(cap, cap * Math.log(1 + x) / Math.log(1 + 2 * half)); }
function _bellCurve(x: number, peak: number, w: number, max = 95, min = 15): number { const z = (x - peak) / w; return min + (max - min) * Math.exp(-0.5 * z * z); }
function _lerp(x: number, pts: [number, number][]): number {
	if (!pts.length) return 50;
	if (x <= pts[0][0]) return pts[0][1];
	if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
	for (let i = 0; i < pts.length - 1; i++) {
		const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
		if (x >= x0 && x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
	}
	return pts[pts.length - 1][1];
}

// ── Types ──
export interface VLFResult { vlf: number; rule1A: number; rule1B: number; rule1C: number; rule1D: number; }
export interface GLFResult { glf: number; rule2A: number; rule2B: number; rule2C: number; rule2D: number; rule2E: number; }
export interface RRResult {
	rr: number;
	marketRisk: number;         // 0-100 (higher = LESS risky from market perspective)
	executionRisk: number;      // 0-100 (higher = LESS risky from execution perspective)
	substitutionRisk: number;   // legacy compat
	riskScore: number;          // legacy compat (maps to executionRisk)
	landlordRisk: number;       // legacy compat
	macroVulnerability: number; // legacy compat
	rentEstimate: number;       // monthly rent used in calculation
	rentSource: string;         // 'user' | 'hood_data' | 'default'
}
export interface PoSResult { low: number; base: number; high: number; uncertainty: number; downside: number; upside: number; verdict: string; }
export interface BlockScoreResult { comp: number; gym: number; yoga: number; health: number; transit: number; wellness: number; total: number; grade: string; }

interface RingBuckets { ring1: POI[]; ring2: POI[]; ring3: POI[]; }

// ── Ring Bucketing ──
function bucketByRing(results: ScanData, lat: number, lon: number, bizType: string): RingBuckets {
	let ring1Dist = 0.076, ring2Dist = 0.15, ring3Dist = 0.2;
	if (bizType.indexOf('Fitness') > -1 || bizType.indexOf('Salon') > -1 || bizType.indexOf('Barbershop') > -1) {
		ring1Dist = 5 / 60; ring2Dist = 10 / 60; ring3Dist = 15 / 60;
	} else if (bizType.indexOf('Fine') > -1 || bizType.indexOf('Restaurant') > -1) {
		ring1Dist = 10 / 60; ring2Dist = 20 / 60; ring3Dist = 30 / 60;
	}
	const all = [...(results.cafes || []), ...(results.gyms || []), ...(results.yoga || []), ...(results.health || []), ...(results.stations || [])];
	return {
		ring1: all.filter(x => x.dist <= ring1Dist),
		ring2: all.filter(x => x.dist > ring1Dist && x.dist <= ring2Dist),
		ring3: all.filter(x => x.dist > ring2Dist && x.dist <= ring3Dist),
	};
}

// ── Vision-Location Fit (VLF) ──
export function calculateVLF(
	scanData: ScanData,
	vision: string,
	goals: { bizType: string; targetRevY1?: number; location?: string },
	liveIntel?: LiveIntelReport | null
): VLFResult {
	const rings = bucketByRing(scanData, 0, 0, goals.bizType);
	const wellnessPOIs = rings.ring1.length;

	// Rule 1A: Demographic-Vision Match (35%)
	// Use live Census data when available; fall back to POI density proxy
	let rule1A: number;
	if (liveIntel?.census) {
		const c = liveIntel.census;
		// Income: continuous sigmoid centred at $75K — $40K→32, $67K→47, $100K→72, $150K→89
		const incomeScore = _clamp(_sigmoid(c.medianHouseholdIncome, 75000, 0.00004));
		// Education: continuous — 10%→13, 30%→39, 50%→65, 70%→91
		const eduScore = _clamp(c.bachelorsPlusPercent * 1.3);
		// Daytime pop ratio: continuous — 0.5→25, 1.0→50, 1.5→75, 2.0→95
		const daytimeScore = _clamp(c.daytimePopulationRatio * 50);
		rule1A = Math.round(incomeScore * 0.40 + eduScore * 0.30 + daytimeScore * 0.30);
	} else {
		// Fallback: logarithmic POI curve instead of 4 buckets
		rule1A = wellnessPOIs > 0 ? Math.round(_clamp(25 + _logCurve(wellnessPOIs, 4, 65))) : 28;
	}
	const hardCapA = wellnessPOIs < 1 && scanData.stations.length < 1 ? 45 : 100;
	rule1A = Math.min(rule1A, hardCapA);

	// Rule 1B: Brand-Neighborhood Identity (20%)
	const alignedSignals = (scanData.gyms.length + scanData.yoga.length + scanData.health.length) * 0.5;
	const conflictingSignals = Math.max(0, scanData.cafes.length - 3) * 0.3;
	let rule1B = alignedSignals > 0 ? Math.min(95, 50 + Math.round(alignedSignals * 3 - conflictingSignals * 2)) : 40;
	rule1B += wellnessPOIs > 0 && rings.ring1.length > 0 ? 10 : 0;

	// Rule 1C: Gap Analysis (25%) — bell curve peaks at 1-2 competitors (validated gap)
	const cafes = scanData.cafes.length;
	let rule1C = cafes === 0 ? 88 : Math.round(_bellCurve(cafes, 1.5, 2.5, 92, 18));
	rule1C -= scanData.cafes.some(c => c.name.indexOf('Starbucks') > -1) ? 12 : 0;
	rule1C += vision.indexOf('functional') > -1 || vision.indexOf('wellness') > -1 ? 15 : 0;

	// Rule 1D: Trend Alignment (20%)
	let rule1D = 65;
	let foundHood = false;
	if (liveIntel?.walkScore) {
		rule1D = Math.round(liveIntel.walkScore.walkScore * 0.5 + (liveIntel.census ? Math.min(100, liveIntel.census.daytimePopulationRatio * 60) : 50) * 0.5);
		foundHood = true;
	}
	if (!foundHood) {
		const visionLower = vision.toLowerCase();
		const locationLower = (goals.location || '').toLowerCase();
		for (const hood in HOOD_DATA) {
			const hoodLower = hood.toLowerCase();
			if (visionLower.includes(hoodLower) || locationLower.includes(hoodLower)) {
				rule1D = HOOD_DATA[hood].trend;
				foundHood = true;
				break;
			}
		}
	}

	const vlf = Math.round(rule1A * 0.35 + rule1B * 0.20 + rule1C * 0.25 + rule1D * 0.20);
	return { vlf: Math.min(100, Math.max(0, vlf)), rule1A, rule1B: Math.min(100, rule1B), rule1C: Math.min(100, rule1C), rule1D };
}

// ── Goal-Location Feasibility (GLF) ──
export function calculateGLF(
	scanData: ScanData,
	goals: {
		bizType: string; targetTicket?: number; targetTxns?: number; targetRevY1?: number;
		numLocations?: string; estimatedRent?: number; wageEstimate?: number; searchAddr?: string;
	},
	landlordData?: { lcs?: number },
	realTrafficData?: {
		mtaDailyRidership?: number;
		pedestrianCount?: number;
		pedestrianScore?: number;
	} | null
): GLFResult {
	// Use real foot traffic data when available, fall back to POI-based estimate
	let estimatedFootTraffic: number;
	if (realTrafficData?.mtaDailyRidership && realTrafficData.mtaDailyRidership > 0) {
		// MTA ridership is the strongest signal — actual daily subway riders nearby
		// Pedestrian counts supplement if available (captures non-subway foot traffic)
		estimatedFootTraffic = realTrafficData.mtaDailyRidership;
		if (realTrafficData.pedestrianCount && realTrafficData.pedestrianCount > 0) {
			// Blend: 70% MTA (proven daily volume) + 30% DOT pedestrian (street-level)
			estimatedFootTraffic = Math.round(
				realTrafficData.mtaDailyRidership * 0.7 +
				realTrafficData.pedestrianCount * 0.3
			);
		}
	} else if (realTrafficData?.pedestrianCount && realTrafficData.pedestrianCount > 0) {
		// Only pedestrian data available — use it directly
		estimatedFootTraffic = realTrafficData.pedestrianCount;
	} else {
		// Fallback: POI-based rough estimate (legacy)
		estimatedFootTraffic = Math.max(100, (scanData.stations.length || 1) * 500 + scanData.gyms.length * 200 + scanData.yoga.length * 150);
	}
	const captureRate = ENGINE_CAPTURE_RATE;
	const aov = goals.targetTicket || ENGINE_DEFAULT_AOV;
	const revenueCeiling = estimatedFootTraffic * captureRate * aov * 365;
	const targetRevY1 = goals.targetRevY1 || 950000;
	const minThreshold = targetRevY1 * 1.2;

	// Rule 2A: Revenue Ceiling Test (30%) — continuous sigmoid around target
	const ceilingRatio = revenueCeiling / targetRevY1;
	// ratio 0.5→22, 0.8→42, 1.0→62, 1.2→78, 1.5→89, 2.0→94
	let rule2A = Math.round(_clamp(_sigmoid(ceilingRatio, 1.0, 5)));

	// Rule 2B: Rent Burden Test (25%)
	// Smart rent: user-entered → HOOD_DATA lookup → fallback
	let estimatedRent = goals.estimatedRent || 0;
	if (!estimatedRent && goals.searchAddr) {
		const assumedSqFt = ENGINE_DEFAULT_SQFT;
		const addrLower = goals.searchAddr.toLowerCase();
		for (const hood in HOOD_DATA) {
			if (addrLower.includes(hood.toLowerCase())) {
				estimatedRent = Math.round((HOOD_DATA[hood].rentPSF * assumedSqFt) / 12);
				break;
			}
		}
	}
	if (!estimatedRent) estimatedRent = ENGINE_LAST_RESORT_RENT; // last resort — consider logging a warning
	const rentToRevenue = (estimatedRent * 12) / targetRevY1;
	// Continuous: 4%→96, 8%→85, 10%→72, 12%→55, 18%→28, 25%→12
	const rule2B = Math.round(_clamp(_lerp(rentToRevenue * 100, [
		[3, 97], [6, 90], [8, 82], [10, 72], [12, 58], [15, 42], [20, 25], [30, 10]
	])));

	// Rule 2C: Breakeven Timeline Test (20%)
	const cogs = targetRevY1 * 0.30;
	const labor = targetRevY1 * 0.28;
	const overhead = estimatedRent * 12 + 50000;
	const breakeven = overhead / (targetRevY1 - cogs - labor);
	// Continuous: 0.1→92, 0.15→84, 0.25→68, 0.35→48, 0.5→28, 0.7→12
	let rule2C = Math.round(_clamp(_lerp(breakeven * 100, [
		[5, 96], [10, 90], [15, 82], [20, 74], [25, 65], [30, 55], [40, 38], [50, 25], [70, 12]
	])));
	if (landlordData?.lcs) rule2C = Math.min(100, rule2C + Math.round(landlordData.lcs * 0.12));

	// Rule 2D: Multi-Unit Feasibility (10%)
	const rule2D = goals.numLocations?.indexOf('10') !== -1 ? 85 : goals.numLocations?.indexOf('Multiple') !== -1 ? 70 : 50;

	// Rule 2E: Talent Economics (15%) — continuous log curve for ridership
	const wageEnvironment = goals.wageEstimate || 17;
	let talentScore: number;
	if (realTrafficData?.mtaDailyRidership && realTrafficData.mtaDailyRidership > 0) {
		const daily = realTrafficData.mtaDailyRidership;
		// Continuous: 500→32, 3K→52, 10K→68, 30K→82, 80K→92
		talentScore = Math.round(_clamp(20 + _logCurve(daily, 15000, 75)));
	} else {
		// Station count: log curve — 0→22, 1→45, 2→58, 3→67, 5→78
		talentScore = Math.round(_clamp(22 + _logCurve(scanData.stations.length, 2.5, 58)));
	}
	const rule2E = Math.min(100, talentScore + (wageEnvironment < 19 ? 15 : 0));

	const glf = Math.round(rule2A * 0.30 + rule2B * 0.25 + rule2C * 0.20 + rule2D * 0.10 + rule2E * 0.15);
	return { glf: Math.min(100, Math.max(0, glf)), rule2A, rule2B: Math.min(100, rule2B), rule2C: Math.min(100, rule2C), rule2D, rule2E: Math.min(100, rule2E) };
}

// ── Risk & Resilience (R&R) — Two-Layer Model ──
// Market Risk (55%): competition density, pricing coverage, chain saturation, quality gap
// Execution Risk (45%): rent burden, safety, landlord risk
export function calculateRR(
	scanData: ScanData,
	context: {
		differentiator?: string;
		liveIntel?: LiveIntelReport | null;
		searchAddr?: string;
		lcs?: number;
		vision?: string;
		estimatedRent?: number;      // user-provided monthly rent (0 = auto)
		targetRevY1?: number;
	}
): RRResult {
	// ═══ MARKET RISK (55% of R&R) ═══
	// Higher score = LESS risky (more favorable market conditions)

	// 1. Competitor density (30% of market risk)
	let competitorScore = 50;
	const cafeCount = scanData.cafes.length;
	const li = context.liveIntel;

	// Use Overpass competitors ring data if available
	if (li?.competitors) {
		const ring1 = li.competitors.rings?.ring1?.length || 0;
		const ring2 = li.competitors.rings?.ring2?.length || 0;
		const total = ring1 + ring2;
		if (total === 0) {
			competitorScore = 42; // unproven
		} else {
			// Weighted count: ring1 competitors count 2x (immediate threat)
			const weighted = ring1 * 2 + ring2;
			// Bell curve: peaks at ~3 weighted competitors (validated but not saturated)
			competitorScore = Math.round(_bellCurve(weighted, 3, 4, 88, 12));
		}
	} else {
		// Fallback: bell curve on cafe count, peaks at 2
		if (cafeCount === 0) competitorScore = 42;
		else competitorScore = Math.round(_bellCurve(cafeCount, 2, 3.5, 86, 12));
	}

	// 2. Chain saturation (25% of market risk)
	// High chain presence = well-funded competition with locked-in customers
	let chainScore = 50;
	const fsq = li?.foursquare;
	const places = li?.places;

	if (fsq && (fsq.chainCount + fsq.independentCount) > 0) {
		const chainPct = fsq.chainCount / (fsq.chainCount + fsq.independentCount);
		// Continuous: 0%→88, 15%→72, 30%→55, 50%→35, 70%→18, 90%→8
		chainScore = Math.round(_clamp(_lerp(chainPct * 100, [
			[0, 88], [10, 78], [20, 68], [30, 55], [40, 42], [50, 32], [60, 22], [75, 14], [100, 6]
		])));
	} else if (places && (places.chainCount + places.independentCount) > 0) {
		const chainPct = places.chainCount / (places.chainCount + places.independentCount);
		chainScore = Math.round(_clamp(_lerp(chainPct * 100, [
			[0, 88], [10, 78], [20, 68], [30, 55], [40, 42], [50, 32], [60, 22], [75, 14], [100, 6]
		])));
	}

	// 3. Price point coverage (25% of market risk)
	// If competitors cover all price points (1-4), harder to find a gap
	let priceGapScore = 50;
	if (fsq && fsq.avgPriceLevel > 0) {
		const priceLevels = new Set<number>();
		for (const v of fsq.directCompetitors) {
			if (v.priceLevel) priceLevels.add(v.priceLevel);
		}
		const coverage = priceLevels.size;
		const totalCompetitors = fsq.directCompetitors.length;
		// Coverage matters, but so does how many competitors share each price point
		const densityPenalty = totalCompetitors > 0 ? Math.min(15, totalCompetitors * 1.5) : 0;
		// Continuous: 1 level→82, 2→62, 3→38, 4→15
		priceGapScore = Math.round(_clamp(_lerp(coverage, [[0, 85], [1, 78], [2, 58], [3, 35], [4, 14]]) - densityPenalty));
	} else if (places && places.avgPriceLevel > 0) {
		const priceLevels = new Set<number>();
		for (const p of places.places) {
			if (p.priceLevel > 0) priceLevels.add(p.priceLevel);
		}
		const coverage = priceLevels.size;
		priceGapScore = Math.round(_clamp(_lerp(coverage, [[0, 85], [1, 78], [2, 58], [3, 35], [4, 14]])));
	}

	// 4. Quality gap (20% of market risk)
	// Low avg competitor rating = quality gap to exploit (good for you)
	let qualityGapScore = 50;
	if (fsq && fsq.avgRating > 0) {
		// Foursquare 0-10: continuous — lower avg = bigger quality gap to exploit
		// 4.0→92, 5.5→78, 6.5→62, 7.5→42, 8.5→22, 9.5→8
		qualityGapScore = Math.round(_clamp(_lerp(fsq.avgRating, [
			[3, 95], [5, 82], [6, 68], [7, 52], [7.5, 42], [8, 32], [8.5, 22], [9, 14], [10, 6]
		])));
	} else if (places && places.avgRating > 0) {
		// Google 1-5: continuous — 2.5→92, 3.5→68, 4.0→48, 4.3→32, 4.7→14
		qualityGapScore = Math.round(_clamp(_lerp(places.avgRating, [
			[2, 95], [3, 82], [3.5, 68], [3.8, 55], [4.0, 45], [4.2, 35], [4.4, 25], [4.6, 16], [5, 8]
		])));
	}

	// Differentiation bonus
	let diffBonus = 0;
	if (context.differentiator) {
		const d = context.differentiator.toLowerCase();
		if (d.includes('functional') || d.includes('first') || d.includes('only')) diffBonus = 10;
		if (d.includes('wellness') || d.includes('protein') || d.includes('adaptogen')) diffBonus += 5;
	}

	const marketRisk = Math.max(5, Math.min(95, Math.round(
		competitorScore * 0.30 +
		chainScore * 0.25 +
		priceGapScore * 0.25 +
		qualityGapScore * 0.20 +
		diffBonus
	)));

	// ═══ EXECUTION RISK (45% of R&R) ═══
	// Higher score = LESS risky (more favorable execution conditions)

	// 1. Rent burden (40% of execution risk)
	// Use: user-entered rent → PLUTO assessed value → HOOD_DATA rentPSF → fallback
	let rentEstimate = 0;
	let rentSource = 'default';
	const targetRevY1 = context.targetRevY1 || 950000;
	const assumedSqFt = ENGINE_DEFAULT_SQFT;

	if (context.estimatedRent && context.estimatedRent > 0) {
		rentEstimate = context.estimatedRent;
		rentSource = 'user';
	} else if (li?.pluto?.buildingProfile?.avgAssessedValuePerSqFt > 0) {
		// PLUTO assessed value → estimate market rent
		// Rule of thumb: commercial rent ≈ 8-12% of assessed value per sqft annually
		// Use 10% as middle estimate, then divide by 12 for monthly
		const estimatedAnnualRentPSF = li.pluto.buildingProfile.avgAssessedValuePerSqFt * 0.10;
		rentEstimate = Math.round((estimatedAnnualRentPSF * assumedSqFt) / 12);
		rentSource = 'pluto_estimate';
	}
	if (rentEstimate === 0 && context.searchAddr) {
		// Try to match a neighborhood in HOOD_DATA
		const addrLower = context.searchAddr.toLowerCase();
		for (const hood in HOOD_DATA) {
			if (addrLower.includes(hood.toLowerCase())) {
				rentEstimate = Math.round((HOOD_DATA[hood].rentPSF * assumedSqFt) / 12);
				rentSource = 'hood_data';
				break;
			}
		}
	}
	if (rentEstimate === 0) {
		// Last resort fallback — but this should be flagged
		rentEstimate = 15000;
		rentSource = 'default';
	}

	const rentToRevenue = (rentEstimate * 12) / targetRevY1;
	// Continuous: 4%→95, 8%→85, 12%→68, 18%→42, 25%→22, 35%→8
	const rentScore = Math.round(_clamp(_lerp(rentToRevenue * 100, [
		[3, 96], [6, 90], [8, 84], [10, 76], [12, 65], [15, 52], [18, 40], [22, 28], [28, 16], [35, 8]
	])));

	// 2. Safety/crime (35% of execution risk)
	// Prefer live NYPD crime data; fall back to HOOD_DATA
	// FIX: Raw crime score can be absurdly low in high-foot-traffic areas (e.g., 17 for Chelsea)
	// because raw incident counts ≠ per-capita danger. Blend with neighborhood baseline.
	let safetyScore = 65;
	if (li?.crime) {
		const rawCrime = li.crime.crimeScore;
		// Find neighborhood baseline from HOOD_DATA
		let hoodBaseline = 65;
		if (context.searchAddr) {
			const addrLower = context.searchAddr.toLowerCase();
			for (const hood in HOOD_DATA) {
				if (addrLower.includes(hood.toLowerCase())) { hoodBaseline = HOOD_DATA[hood].crimeScore; break; }
			}
		}
		// Blend: 70% live data + 30% neighborhood baseline — prevents absurdly low scores
		// in safe neighborhoods with high incident counts from foot traffic volume
		safetyScore = Math.round(rawCrime * 0.70 + hoodBaseline * 0.30);
	} else if (context.searchAddr) {
		const addrLower = context.searchAddr.toLowerCase();
		for (const hood in HOOD_DATA) {
			if (addrLower.includes(hood.toLowerCase())) { safetyScore = HOOD_DATA[hood].crimeScore; break; }
		}
	}

	// 3. Landlord risk (15% of execution risk)
	const landlordScore = context.lcs ? Math.min(95, 50 + context.lcs * 0.45) : 50;

	// 4. Macro vulnerability (10% of execution risk)
	let macroScore = 60;
	if (context.vision?.indexOf('premium') !== -1) macroScore = 40; // premium is more recession-sensitive
	if (context.vision?.indexOf('wellness') !== -1) macroScore = 80; // wellness trend is resilient

	const executionRisk = Math.max(5, Math.min(95, Math.round(
		rentScore * 0.40 +
		safetyScore * 0.35 +
		landlordScore * 0.15 +
		macroScore * 0.10
	)));

	// ═══ COMPOSITE R&R ═══
	const rr = Math.max(10, Math.min(95, Math.round(
		marketRisk * 0.55 +
		executionRisk * 0.45
	)));

	// Legacy compat fields
	const substitutionRisk = competitorScore;
	const riskScore = safetyScore;
	const landlordRisk = context.lcs ? Math.min(10, 50 - context.lcs * 0.5) : 0;
	let macroVulnerability = 0;
	if (context.vision?.indexOf('premium') !== -1) macroVulnerability = -15;
	if (context.vision?.indexOf('wellness') !== -1) macroVulnerability = +15;

	return { rr, marketRisk, executionRisk, substitutionRisk, riskScore, landlordRisk, macroVulnerability, rentEstimate, rentSource };
}

// ── Probability of Success (PoS) ──
export function calculatePoS(vlf: number, glf: number, rr: number, dataCompleteness?: string): PoSResult {
	const completenessMap: Record<string, number> = { Full: 0.07, Moderate: 0.11, Minimal: 0.15 };
	const uncertainty = completenessMap[dataCompleteness || 'Moderate'] || 0.11;

	const base = Math.round(vlf * 0.35 + glf * 0.40 + rr * 0.25);
	const downside = Math.round(uncertainty * 0.15);
	const upside = Math.round(uncertainty * 0.10);

	const low = Math.max(0, base - downside);
	const high = Math.min(100, base + upside);
	const verdict = base >= 80 ? 'STRONG GO' : base >= 70 ? 'GO — MONITOR' : base >= 55 ? 'PROCEED W/ CAUTION' : 'HIGH RISK';

	return { low, base, high, uncertainty, downside, upside, verdict };
}

// ── Landlord Collaboration Score (LCS) ──
export function calculateLCS(inputs: {
	tiCredit?: number; trackRecord?: number;
	rentAbatement?: boolean; percentRent?: boolean; pgWaiver?: boolean; sublease?: boolean;
	activeInvestment?: boolean; bidMember?: boolean; coInvestment?: boolean;
}): number {
	const factorA = inputs.tiCredit || 50;
	const factorB = (inputs.rentAbatement ? 25 : 0) + (inputs.percentRent ? 20 : 0) + (inputs.pgWaiver ? 15 : 0) + (inputs.sublease ? 10 : 0);
	const factorC = inputs.trackRecord || 70;
	const factorD = (inputs.activeInvestment ? 85 : 0) + (inputs.bidMember ? 10 : 0) + (inputs.coInvestment ? 25 : 0);

	return Math.min(100, Math.max(0, Math.round(factorA * 0.35 + Math.min(100, factorB) * 0.25 + factorC * 0.25 + factorD * 0.15)));
}

// ── Block Score (composite neighborhood score) ──
export function blockScore(d: ScanData, liveIntel?: LiveIntelReport | null): BlockScoreResult {
	// Competition: bell curve peaks at 2 cafes (validated but not saturated)
	let comp: number;
	const cafeCount = d.cafes.length;
	if (cafeCount === 0) comp = 38;
	else comp = Math.round(_bellCurve(cafeCount, 2, 3.5, 88, 8));

	// Adjust for chain saturation from live intel
	if (liveIntel?.foursquare) {
		const fsq = liveIntel.foursquare;
		if ((fsq.chainCount + fsq.independentCount) > 0) {
			const chainPct = fsq.chainCount / (fsq.chainCount + fsq.independentCount);
			if (chainPct >= 0.5) comp = Math.max(5, comp - 15); // chain-dominated = harder
		}
	} else if (liveIntel?.places) {
		if ((liveIntel.places.chainCount + liveIntel.places.independentCount) > 0) {
			const chainPct = liveIntel.places.chainCount / (liveIntel.places.chainCount + liveIntel.places.independentCount);
			if (chainPct >= 0.5) comp = Math.max(5, comp - 15);
		}
	}

	// Log curves for gym/yoga/health — 0→0, 1→35, 2→52, 3→63, 5→76, 8→86
	const gym = d.gyms.length > 0 ? Math.round(_clamp(10 + _logCurve(d.gyms.length, 3, 88))) : 0;
	const yoga = d.yoga.length > 0 ? Math.round(_clamp(10 + _logCurve(d.yoga.length, 2.5, 88))) : 0;
	const health = d.health.length > 0 ? Math.round(_clamp(10 + _logCurve(d.health.length, 2, 88))) : 0;

	// Transit: continuous log curves for ridership/stations
	let transit: number;
	if (liveIntel?.mtaRidership && liveIntel.mtaRidership.totalDailyRidership > 0) {
		const daily = liveIntel.mtaRidership.totalDailyRidership;
		// Continuous log: 500→22, 3K→45, 10K→62, 30K→78, 60K→88, 100K→94
		transit = Math.round(_clamp(15 + _logCurve(daily, 25000, 82)));
		if (liveIntel.walkScore?.transitScore) {
			transit = Math.round(transit * 0.7 + liveIntel.walkScore.transitScore * 0.3);
		}
	} else if (liveIntel?.walkScore?.transitScore) {
		transit = liveIntel.walkScore.transitScore;
	} else {
		// Station count: log curve — 0→0, 1→35, 2→52, 3→63, 5→76, 8→86
		transit = d.stations.length > 0
			? Math.round(_clamp(10 + _logCurve(d.stations.length, 3, 85)))
			: 12;
	}

	const wellness = Math.round(gym * 0.35 + yoga * 0.35 + health * 0.30);
	const total = Math.min(100, Math.max(0, Math.round(comp * 0.25 + wellness * 0.35 + transit * 0.25 + Math.min(100, (d.gyms.length + d.yoga.length) * 14) * 0.15)));
	const grade = total >= 62 ? 'A' : total >= 38 ? 'B' : 'C';
	return { comp, gym, yoga, health, transit, wellness, total, grade };
}

// ── Build Layer Scores from Scan Data ──
export function buildL2FromScan(scanData: ScanData, sc: BlockScoreResult, liveIntel?: LiveIntelReport | null) {
	// Build transit detail string from best available data
	let transitValue = scanData.stations.length + ' stations';
	let transitDetail = scanData.stations.length + ' subway stations within 800m';
	if (liveIntel?.mtaRidership && liveIntel.mtaRidership.totalDailyRidership > 0) {
		const daily = liveIntel.mtaRidership.totalDailyRidership;
		transitValue = Math.round(daily / 1000) + 'K daily riders';
		transitDetail = daily.toLocaleString() + ' daily MTA riders nearby';
		if (liveIntel.mtaRidership.stationCount > 0) {
			transitDetail += ' (' + liveIntel.mtaRidership.stationCount + ' stations)';
		}
	} else if (liveIntel?.walkScore?.transitScore) {
		transitValue = 'Score: ' + liveIntel.walkScore.transitScore;
		transitDetail = 'Walk Score transit rating: ' + liveIntel.walkScore.transitScore + '/100';
	}

	return {
		score: sc.total, factors: [
			{ name: 'Foot Traffic Proxy', value: transitValue, score: sc.transit, detail: transitDetail, override: null },
			{ name: 'Competitor Density', value: scanData.cafes.length + ' cafes', score: sc.comp, detail: scanData.cafes.length + ' cafes/coffee shops within 300m radius', override: null },
			{ name: 'Wellness Ecosystem', value: scanData.gyms.length + ' gyms', score: sc.wellness, detail: scanData.gyms.length + ' gyms, ' + scanData.yoga.length + ' yoga, ' + scanData.health.length + ' health stores nearby', override: null },
			{ name: 'Gym Density', value: String(scanData.gyms.length), score: sc.gym, detail: 'Fitness centers within scanning radius', override: null },
			{ name: 'Yoga/Pilates Density', value: String(scanData.yoga.length), score: sc.yoga, detail: 'Yoga and Pilates studios nearby', override: null },
			{ name: 'Health Food Stores', value: String(scanData.health.length), score: sc.health, detail: 'Health food and organic stores nearby', override: null },
		]
	};
}

export function buildL3FromGoals(targetTicket: number, targetTxns: number, targetRevY1: number, targetSDE: number) {
	const dailyRev = targetTicket * targetTxns;
	const annualRev = dailyRev * 365;
	const ticketScore = targetTicket >= 8 ? Math.min(95, 60 + targetTicket * 2) : Math.max(20, targetTicket * 6);
	const txnScore = targetTxns >= 400 ? Math.min(95, 50 + targetTxns / 10) : Math.max(20, targetTxns / 5);
	const revScore = annualRev >= targetRevY1 ? Math.min(95, 80) : Math.max(20, (annualRev / targetRevY1) * 80);
	const sdeScore = targetSDE >= 250000 ? Math.min(95, 80) : Math.max(20, (targetSDE / 250000) * 80);
	const avg = Math.round((ticketScore + txnScore + revScore + sdeScore) / 4);
	return {
		score: avg, factors: [
			{ name: 'Target Avg Ticket', value: '$' + targetTicket.toFixed(2), score: Math.round(ticketScore), detail: 'Your pricing vs. industry benchmarks ($8-15)', override: null },
			{ name: 'Target Daily Txns', value: targetTxns + '/day', score: Math.round(txnScore), detail: 'Your transaction volume target feasibility', override: null },
			{ name: 'Year 1 Revenue Target', value: '$' + Math.round(targetRevY1).toLocaleString(), score: Math.round(revScore), detail: 'Alignment with stated revenue goal', override: null },
			{ name: 'Target SDE', value: '$' + Math.round(targetSDE).toLocaleString(), score: Math.round(sdeScore), detail: "Seller's Discretionary Earnings target", override: null },
		]
	};
}

// ── Composite Score ──
export function computeComposite(
	layerScores: Record<string, { score: number; factors: Array<{ score: number; override: number | null }> }>,
	weights: Record<string, number>
): number {
	let wSum = 0;
	for (const k in weights) wSum += weights[k];
	if (wSum === 0) return 0;

	let total = 0;
	LAYER_DEFS.forEach((l) => {
		const layerData = layerScores[l.id];
		if (!layerData) return;
		let ls = layerData.score;
		if (layerData.factors?.length) {
			let fSum = 0;
			layerData.factors.forEach((f) => { fSum += (f.override !== null ? f.override : f.score); });
			ls = Math.round(fSum / layerData.factors.length);
		}
		total += ls * (weights[l.id] / wSum);
	});
	return Math.round(total);
}

export function getLayerEffectiveScore(
	layerScores: Record<string, { score: number; factors: Array<{ score: number; override: number | null }> }>,
	layerId: string
): number {
	const ld = layerScores[layerId];
	if (!ld?.factors?.length) return ld?.score || 0;
	let sum = 0;
	ld.factors.forEach((f) => { sum += (f.override !== null ? f.override : f.score); });
	return Math.round(sum / ld.factors.length);
}

// ── Commentary Generator ──
export function generateCommentary(
	locationResult: { addr: string; data: ScanData; score: BlockScoreResult },
	vision: string,
	goals: { targetSDE: number; targetTxns: number },
	compositeScore: number
): string {
	const grade = compositeScore >= 70 ? 'A' : compositeScore >= 45 ? 'B' : 'C';
	const data = locationResult.data;
	const sc = locationResult.score;

	let doc = `Based on your vision of "${vision}" and your goal of $${Math.round(goals.targetSDE).toLocaleString()} SDE, here's our analysis of ${locationResult.addr}:\n\n`;

	doc += 'WHY THIS WORKS:\n';
	const positives: string[] = [];
	if (data.stations.length >= 4) positives.push(`Strong subway access (${data.stations.length} stations nearby) supports daily foot traffic`);
	if (data.gyms.length >= 5) positives.push(`High fitness ecosystem (${data.gyms.length} gyms + ${data.yoga.length} yoga studios) aligns with wellness-seeking demographic`);
	if (sc.comp <= 4) positives.push(`Low competition (${data.cafes.length} cafes) gives you room to establish market leadership`);
	if (data.health.length >= 3) positives.push(`Growing health-food segment (${data.health.length} nearby stores) validates your brand positioning`);
	if (!positives.length) positives.push('Location offers fundamental viability for your concept');
	positives.forEach(p => { doc += '• ' + p + '\n'; });

	doc += '\nKEY RISKS:\n';
	const negatives: string[] = [];
	if (data.stations.length < 2) negatives.push('Limited transit access may constrain foot traffic to your transaction targets');
	if (sc.comp > 8) negatives.push(`High cafe competition (${data.cafes.length}) requires strong differentiation`);
	if (data.gyms.length < 3) negatives.push('Thinner wellness ecosystem may limit your core audience density');
	if (sc.total < 55) negatives.push('Overall location score suggests elevated operational risk');
	if (!negatives.length) negatives.push('No major risk factors identified based on current scoring');
	negatives.forEach(r => { doc += '• ' + r + '\n'; });

	doc += '\nTO ACHIEVE YOUR GOALS:\n';
	const recs: string[] = [];
	if (goals.targetTxns >= 400) recs.push(`To hit ${goals.targetTxns} txns/day, lead with protein lattes in your marketing—target the ${data.gyms.length} nearby gyms with membership campaigns`);
	if (goals.targetSDE >= 250000) recs.push(`To reach $${Math.round(goals.targetSDE).toLocaleString()} SDE, focus on high-margin drink upsells (adaptogens, probiotics) and a dedicated kids menu for family dayparts`);
	if (data.stations.length >= 3) recs.push('Leverage strong transit: position as "quick wellness stop" for commuters during peak hours');
	if (data.health.length >= 2) recs.push('Partner with neighboring health-food stores for cross-promotion and shared foot traffic');
	if (!recs.length) recs.push('Focus on creating unique brand experiences and leveraging digital marketing to drive awareness');
	recs.forEach(rec => { doc += '• ' + rec + '\n'; });

	doc += '\nPROBABILITY ASSESSMENT:\n';
	doc += `Based on our 7-layer analysis, this location has a ${compositeScore >= 70 ? '72' : '58'}% alignment with your stated goals. ${compositeScore >= 70 ? 'Strong fundamentals support execution.' : 'Additional market validation recommended.'}`;

	return doc;
}
