/**
 * ⚠️ LEGACY — This file is DEAD CODE in the E2b flow (March 2026 audit).
 *
 * The E2b layout (+page.svelte) uses six-index.ts → compassScores/compassComposite
 * for Location IQ, and fit-iq-engine.ts (server-side) for Fit IQ.
 * This file's computeLocationScore and computeAlignmentScore are still called
 * by AddressAnalyzer but their results are NEVER read by the E2b page.
 *
 * Kept only for the pre-E2b search flow (the {#if !searchOnly} branch in
 * AddressAnalyzer.svelte). Remove once that flow is fully deprecated.
 *
 * RE² Scoring Model — Two-Score System (LEGACY)
 *
 * The RE² model separates location quality from founder alignment:
 *
 * 1. LOCATION SCORE (0-100): Universal, identical for all founders analyzing
 *    the same address with the same business type. Driven by objective location
 *    factors (demographics, transit, competition, safety, amenities).
 *
 * 2. ALIGNMENT SCORE (0-100): Founder-specific, depends on their Engine
 *    Calibration weights and financial profile. The GAP between these scores
 *    reveals the key insight: "strong location but wrong for your risk profile"
 *    or "weak location but perfectly aligned with your concept."
 *
 * Architecture:
 * - Location Score computed from LocationIntelReport (census, crime, overpass, etc.)
 * - Alignment Score re-weights Location Score layers using founder's Engine
 *   Calibration (L0-L7) + founder-specific financial/risk factors
 */

import type { LocationIntelReport } from '$lib/intel';
import { streetSideModifier } from '$lib/intel/street-side-scoring';
// 04.19.2026 13:35 Score Consolidation — clamp imported from canonical geo-math.ts
import { clamp } from '$lib/intel/scoring/geo-math';

// ──────────────────────────────────────────────
// LOCATION SCORE (Universal)
// ──────────────────────────────────────────────

export interface SubScore {
	layer: string;
	score: number;        // 0-100
	weight: number;       // 0-1
	label: string;        // Human-readable name
}

export interface LocationScoreResult {
	score: number;        // 0-100
	grade: 'A' | 'B' | 'C' | 'D';
	subScores: SubScore[];
	summary: string;
	layers: {
		demographics: number;      // Census income/education/density
		walkScore: number;         // Transit/walkability
		competition: number;       // Competitor density from Overpass
		safety: number;            // Crime data
		inspections: number;       // Restaurant health
		transit: number;           // Subway proximity
		footTraffic: number;       // POI density proxy
		wellness: number;          // Gym/yoga/health food
	};
}

/**
 * Compute RE² Location Score (0-100, universal).
 * Same score for any founder analyzing the same address + business type.
 *
 * Layers:
 * - Demographics (15%): Income quartile, education level, population density
 * - Walk Score (15%): Transit accessibility, walkability index
 * - Competition (20%): Competitor density, saturation from Overpass
 * - Safety (10%): Crime rate, incident density
 * - Inspections (5%): Health code violations, restaurant market health
 * - Transit (10%): Proximity to subway stations
 * - Foot Traffic (15%): POI density as proxy for pedestrian volume
 * - Wellness (10%): Gym, yoga, health food store density
 */
export function computeLocationScore(
	intelReport: LocationIntelReport,
	categoryId: string
): LocationScoreResult {
	const subScores: SubScore[] = [];
	const layers: LocationScoreResult['layers'] = {
		demographics: 0,
		walkScore: 0,
		competition: 0,
		safety: 0,
		inspections: 0,
		transit: 0,
		footTraffic: 0,
		wellness: 0
	};

	// ──── Demographics Layer (15%) ────
	const demoScore = computeDemographicsScore(intelReport.census);
	subScores.push({
		layer: 'demographics',
		score: demoScore,
		weight: 0.15,
		label: 'Census Demographics'
	});
	layers.demographics = demoScore;

	// ──── Walk Score Layer (15%) ────
	const walkScore = computeWalkScoreLayer(intelReport.walkScore);
	subScores.push({
		layer: 'walkScore',
		score: walkScore,
		weight: 0.15,
		label: 'Transit & Walkability'
	});
	layers.walkScore = walkScore;

	// ──── Competition Layer (20%) ────
	const compScore = computeCompetitionScore(
		intelReport.competitors, categoryId,
		intelReport.foursquare, intelReport.yelp, intelReport.places
	);
	subScores.push({
		layer: 'competition',
		score: compScore,
		weight: 0.20,
		label: 'Competitor Density'
	});
	layers.competition = compScore;

	// ──── Safety Layer (10%) ────
	const safetyScore = computeSafetyScore(intelReport.crime);
	subScores.push({
		layer: 'safety',
		score: safetyScore,
		weight: 0.10,
		label: 'Crime & Safety'
	});
	layers.safety = safetyScore;

	// ──── Inspections Layer (5%) ────
	const inspScore = computeInspectionsScore(intelReport.inspections);
	subScores.push({
		layer: 'inspections',
		score: inspScore,
		weight: 0.05,
		label: 'Market Health'
	});
	layers.inspections = inspScore;

	// ──── Transit Layer (10%) ────
	const transitScore = computeTransitScore(intelReport.census);
	subScores.push({
		layer: 'transit',
		score: transitScore,
		weight: 0.10,
		label: 'Transit Access'
	});
	layers.transit = transitScore;

	// ──── Foot Traffic Layer (15%) ────
	// Blended from real data: pedestrian counts, transit proximity, walkability, POI density
	const footTrafficScore = computeFootTrafficLayer(intelReport, categoryId);
	subScores.push({
		layer: 'footTraffic',
		score: footTrafficScore,
		weight: 0.15,
		label: 'Foot Traffic & Pedestrian Volume'
	});
	layers.footTraffic = footTrafficScore;

	// ──── Wellness Layer (10%) ────
	const wellnessScore = computeWellnessScore(intelReport.places);
	subScores.push({
		layer: 'wellness',
		score: wellnessScore,
		weight: 0.10,
		label: 'Wellness Ecosystem'
	});
	layers.wellness = wellnessScore;

	// Compute weighted average
	let totalScore = 0;
	for (const sub of subScores) {
		totalScore += sub.score * sub.weight;
	}
	const score = Math.round(totalScore);

	// Grade
	const grade: 'A' | 'B' | 'C' | 'D' =
		score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';

	// Summary
	const summary = generateLocationSummary(score, subScores);

	return {
		score,
		grade,
		subScores,
		summary,
		layers
	};
}

// ──────────────────────────────────────────────
// ALIGNMENT SCORE (Founder-Specific)
// ──────────────────────────────────────────────

export interface AlignmentFactor {
	name: string;
	impact: number;  // -15 to +15
	detail: string;
}

export interface AlignmentScoreResult {
	score: number;        // 0-100
	grade: 'A' | 'B' | 'C' | 'D';
	gap: number;          // Alignment - Location (can be negative)
	gapInterpretation: string;
	factors: AlignmentFactor[];
	reasoning: string;
}

/**
 * Compute RE² Alignment Score (0-100, founder-specific).
 * Depends on founder's Engine Calibration weights (L0-L7) and financial profile.
 *
 * The GAP is the insight:
 * - Positive gap: "Your profile boosts this location beyond its objective value"
 * - Negative gap: "This location doesn't match your risk/concept profile"
 *
 * Factors:
 * - Capital fit: Budget vs. rent/buildout costs (±15)
 * - Risk match: Tolerance vs. area volatility (±10)
 * - Concept alignment: Business type vs. demographics (±10)
 * - Format fit: Chosen format vs. space availability (±5)
 */
export function computeAlignmentScore(
	locationScore: LocationScoreResult,
	founderProfile: {
		totalBudget?: number;
		monthlyRent?: number;
		riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
		businessType?: string;
		format?: string;
		engineWeights?: Record<string, number>;
	},
	intelReport: LocationIntelReport
): AlignmentScoreResult {
	const factors: AlignmentFactor[] = [];

	// ──── Capital Fit (±15) ────
	let capitalImpact = 0;
	let capitalDetail = '';

	if (founderProfile.monthlyRent && intelReport.census) {
		const avgRent = estimateAverageRent(intelReport.census);
		const rentRatio = founderProfile.monthlyRent / avgRent;
		if (rentRatio >= 1.2) {
			capitalImpact = 15;
			capitalDetail = 'Your budget comfortably covers rent in this area.';
		} else if (rentRatio >= 1.0) {
			capitalImpact = 5;
			capitalDetail = 'Your budget aligns with typical rent.';
		} else if (rentRatio >= 0.8) {
			capitalImpact = -10;
			capitalDetail = 'Rent is tight against your budget.';
		} else {
			capitalImpact = -15;
			capitalDetail = 'Area is likely unaffordable given your budget.';
		}
	}
	factors.push({
		name: 'Capital Fit',
		impact: capitalImpact,
		detail: capitalDetail || 'Budget not assessed.'
	});

	// ──── Risk Match (±10) ────
	let riskImpact = 0;
	let riskDetail = '';

	if (founderProfile.riskTolerance) {
		// Area risk inferred from safety + crime score
		const areaRisk = 100 - intelReport.crime?.crimeScore || 50;
		const riskTolerance = founderProfile.riskTolerance === 'aggressive' ? 80 : founderProfile.riskTolerance === 'moderate' ? 50 : 30;

		if (areaRisk <= riskTolerance + 15) {
			riskImpact = 10;
			riskDetail = `Area risk (${Math.round(areaRisk)}) fits your ${founderProfile.riskTolerance} tolerance.`;
		} else if (areaRisk <= riskTolerance + 30) {
			riskImpact = 0;
			riskDetail = `Area risk is slightly higher than your preference.`;
		} else {
			riskImpact = -10;
			riskDetail = `Area risk (${Math.round(areaRisk)}) exceeds your ${founderProfile.riskTolerance} tolerance.`;
		}
	}
	factors.push({
		name: 'Risk Match',
		impact: riskImpact,
		detail: riskDetail || 'Risk profile not assessed.'
	});

	// ──── Concept Alignment (±10) ────
	let conceptImpact = 0;
	let conceptDetail = '';

	if (founderProfile.businessType) {
		// Concept fit is hard to measure without full category config
		// Use heuristic: coffee → wellness/density good, formal dining → family index good
		const bizType = founderProfile.businessType.toLowerCase();
		const isWellnessFocused = bizType.includes('coffee') || bizType.includes('yoga') || bizType.includes('health');
		const isFamilyFocused = bizType.includes('family') || bizType.includes('kids');

		if (isWellnessFocused && intelReport.places) {
			// Check wellness density in places data
			const wellnessCount = (intelReport.places.results || []).filter((p: PlaceResult) =>
				['gym', 'yoga', 'health', 'wellness'].some(t => p.types?.join(',').toLowerCase().includes(t))
			).length;
			if (wellnessCount >= 5) {
				conceptImpact = 10;
				conceptDetail = `Strong wellness ecosystem (${wellnessCount}+ POIs) for your ${founderProfile.businessType}.`;
			} else if (wellnessCount >= 2) {
				conceptImpact = 5;
				conceptDetail = `Moderate wellness presence for your concept.`;
			} else {
				conceptImpact = -5;
				conceptDetail = `Limited wellness ecosystem; different audience expected.`;
			}
		} else if (isFamilyFocused) {
			// Would check family index from census — placeholder
			conceptImpact = 5;
			conceptDetail = `Demographics may support family-oriented concept.`;
		} else {
			conceptImpact = 0;
			conceptDetail = `Concept alignment neutral.`;
		}
	}
	factors.push({
		name: 'Concept Alignment',
		impact: conceptImpact,
		detail: conceptDetail || 'Concept not provided.'
	});

	// ──── Format Fit (±5) ────
	let formatImpact = 0;
	let formatDetail = '';

	if (founderProfile.format) {
		// Format fit: check if area has suitable spaces
		// Kiosk/food truck → high foot traffic good
		// Café → diverse space availability
		// Full service → larger spaces needed
		const format = founderProfile.format.toLowerCase();
		const footTrafficScore = intelReport.places
			? Math.min(95, (intelReport.places.results || []).length * 3)
			: 50;

		if (format.includes('kiosk') || format.includes('food-truck')) {
			if (footTrafficScore >= 75) {
				formatImpact = 5;
				formatDetail = 'High foot traffic ideal for your format.';
			} else {
				formatImpact = -3;
				formatDetail = 'Lower foot traffic challenges your format.';
			}
		} else if (format.includes('cafe')) {
			formatImpact = 2;
			formatDetail = 'Café format widely adaptable.';
		} else {
			formatImpact = 0;
			formatDetail = 'Format fit neutral or unassessable.';
		}
	}
	factors.push({
		name: 'Format Fit',
		impact: formatImpact,
		detail: formatDetail || 'Format not provided.'
	});

	// Calculate total impact
	const totalImpact = factors.reduce((sum, f) => sum + f.impact, 0);

	// Compute Alignment Score: Location Score + weighted impact
	const baseAlignment = Math.max(0, Math.min(100, locationScore.score + totalImpact));
	const alignmentScore = Math.round(baseAlignment);

	// Gap analysis
	const gap = alignmentScore - locationScore.score;
	const gapInterpretation = interpretGap(gap, locationScore.score, alignmentScore);

	// Grade
	const grade: 'A' | 'B' | 'C' | 'D' =
		alignmentScore >= 80 ? 'A' : alignmentScore >= 65 ? 'B' : alignmentScore >= 50 ? 'C' : 'D';

	// Reasoning
	const reasoning = generateAlignmentReasoning(gap, factors, locationScore);

	return {
		score: alignmentScore,
		grade,
		gap,
		gapInterpretation,
		factors,
		reasoning
	};
}

// ── Internal helper types for loosely-structured API data ──
interface CensusData {
	medianIncome?: number;
	medianHouseholdIncome?: number;
	educationIndex?: number;
	populationDensity?: number;
	subwayStations?: number;
	transitScore?: number;
}

interface WalkScoreData {
	walkScore?: number;
	transitScore?: number;
}

interface CompetitorData {
	totalCount?: number;
	chainCount?: number;
	independentCount?: number;
	saturationScore?: number;
	competitors?: Array<{ name: string; type: string; distance: number }>;
	rings?: {
		ring1?: Array<unknown>;
		ring2?: Array<unknown>;
		ring3?: Array<unknown>;
	};
	amenities?: {
		cafes?: Array<unknown>;
		restaurants?: Array<unknown>;
		gyms?: Array<unknown>;
		yoga?: Array<unknown>;
		health?: Array<unknown>;
	};
}

interface FoursquareData {
	venues?: Array<{ name: string; distance?: number; categories?: Array<{ name: string }> }>;
	totalResults?: number;
}

interface YelpData {
	businesses?: Array<{ name: string; distance?: number; rating?: number }>;
	totalResults?: number;
}

interface CrimeData {
	crimeScore?: number;
}

interface InspectionResult {
	violationCount?: number;
}

interface InspectionsData {
	results?: InspectionResult[];
}

interface PlaceResult {
	name?: string;
	types?: string[];
}

interface PlacesData {
	results?: PlaceResult[];
}

// ──────────────────────────────────────────────
// Helper: Estimate Average Rent
// ──────────────────────────────────────────────
function estimateAverageRent(census: CensusData | null | undefined): number {
	// Placeholder: without full NYC rent database, estimate from income
	// Typical rent is 10-15% of median income
	if (!census?.medianIncome) return 5000;
	return Math.round(census.medianIncome / 12 * 0.12);
}

// ──────────────────────────────────────────────
// Continuous Scoring Curves
// ──────────────────────────────────────────────
// All sub-scores use continuous math (sigmoid, log, interpolation)
// instead of coarse buckets. This produces granular, differentiated
// values that reveal real differences between locations.

/** Sigmoid curve: smooth S-shaped 0→100 transition centred at `mid` */
function sigmoid(x: number, mid: number, steepness: number = 0.1): number {
	return 100 / (1 + Math.exp(-steepness * (x - mid)));
}

/** Logarithmic curve with diminishing returns — maps 0→∞ into ~0→cap */
function logCurve(x: number, halfPoint: number, cap: number = 97): number {
	if (x <= 0) return 0;
	// At x=halfPoint, score ≈ cap/2
	return Math.min(cap, cap * Math.log(1 + x) / Math.log(1 + 2 * halfPoint));
}

/** Bell curve: peaks at `peak`, falls off symmetrically. Good for "sweet spot" metrics. */
function bellCurve(x: number, peak: number, width: number, maxScore: number = 95, minScore: number = 20): number {
	const z = (x - peak) / width;
	return minScore + (maxScore - minScore) * Math.exp(-0.5 * z * z);
}

/** Linear interpolation between anchor points */
function lerp(x: number, anchors: [number, number][]): number {
	if (anchors.length === 0) return 50;
	if (x <= anchors[0][0]) return anchors[0][1];
	if (x >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];
	for (let i = 0; i < anchors.length - 1; i++) {
		const [x0, y0] = anchors[i];
		const [x1, y1] = anchors[i + 1];
		if (x >= x0 && x <= x1) {
			const t = (x - x0) / (x1 - x0);
			return y0 + t * (y1 - y0);
		}
	}
	return anchors[anchors.length - 1][1];
}

// 04.19.2026 13:35 Score Consolidation — clamp removed. Imported from geo-math.ts above.

// ──────────────────────────────────────────────
// Sub-score Helpers (0-100 each, continuous)
// ──────────────────────────────────────────────

function computeDemographicsScore(census: CensusData | null | undefined): number {
	if (!census) return 42; // below-average default signals "no data" rather than neutral

	const medianIncome = census.medianIncome ?? census.medianHouseholdIncome ?? 0;
	const educationIndex = census.educationIndex ?? 0;
	const populationDensity = census.populationDensity ?? 0;

	// Income: sigmoid centred at $75K (NYC median ≈ $67K), steeper rise to $150K
	// $40K → ~28, $67K → ~45, $100K → ~68, $150K → ~86, $200K+ → ~95
	const incomeScore = medianIncome > 0
		? clamp(sigmoid(medianIncome, 75000, 0.00004))
		: 35;

	// Education: pass through if real, otherwise penalize
	const eduScore = educationIndex > 0 ? clamp(educationIndex) : 30;

	// Density: bell curve peaks at 18K/sq mi (dense urban sweet spot for retail)
	// 3K → ~38, 10K → ~72, 18K → ~95, 30K → ~78, 60K → ~35
	const densityScore = populationDensity > 0
		? clamp(bellCurve(populationDensity, 18000, 12000, 95, 25))
		: 30;

	const score = incomeScore * 0.45 + eduScore * 0.2 + densityScore * 0.35;
	return Math.round(clamp(score));
}

function computeWalkScoreLayer(walkScore: WalkScoreData | null | undefined): number {
	if (!walkScore) return 38;

	// Walk Score API already returns 0-100 but apply slight curve to
	// reward truly walkable areas (85+) and penalize car-dependent (<40)
	const ws = walkScore.walkScore ?? 0;
	const ts = walkScore.transitScore ?? 0;

	// Amplify extremes: a Walk Score of 95 is dramatically better than 75
	const walkAdjusted = ws > 0
		? clamp(lerp(ws, [[0, 5], [25, 18], [50, 40], [70, 60], [85, 78], [92, 88], [100, 98]]))
		: 30;

	const transitAdjusted = ts > 0
		? clamp(lerp(ts, [[0, 8], [25, 20], [50, 42], [70, 62], [85, 80], [100, 97]]))
		: 30;

	const combined = walkAdjusted * 0.6 + transitAdjusted * 0.4;
	return Math.round(clamp(combined));
}

function computeCompetitionScore(
	competitors: CompetitorData | null | undefined,
	categoryId: string,
	foursquare?: FoursquareData | null,
	yelp?: YelpData | null,
	places?: PlacesData | null
): number {
	// ── Step 1: Count competitors from ALL available sources ──
	// Primary: Overpass competitor scan (has ring-based proximity data)
	// Secondary: Foursquare, Yelp, Google Places (broader venue databases)

	let competitorCount = 0;
	let nearbyCount = 0;    // Within ~200m (ring1)
	let walkingCount = 0;   // Within ~400m (ring2)
	let hasRingData = false;
	let sourcesAvailable = 0;

	// Overpass: the most structured source with ring proximity
	if (competitors) {
		sourcesAvailable++;
		// Use totalCount (the correct field on OverpassData)
		if (competitors.totalCount != null && competitors.totalCount > 0) {
			competitorCount = competitors.totalCount;
		}
		// Also read ring arrays for proximity weighting
		if (competitors.rings) {
			const r1 = Array.isArray(competitors.rings.ring1) ? competitors.rings.ring1.length : 0;
			const r2 = Array.isArray(competitors.rings.ring2) ? competitors.rings.ring2.length : 0;
			nearbyCount = r1;
			walkingCount = r1 + r2;
			hasRingData = r1 + r2 > 0;
		}
	}

	// Foursquare: venue database (often has more results than Overpass)
	let foursquareCount = 0;
	if (foursquare?.venues && foursquare.venues.length > 0) {
		sourcesAvailable++;
		foursquareCount = foursquare.totalResults || foursquare.venues.length;
	}

	// Yelp: business database (good for food/drink/services)
	let yelpCount = 0;
	if (yelp?.businesses && yelp.businesses.length > 0) {
		sourcesAvailable++;
		yelpCount = yelp.totalResults || yelp.businesses.length;
	}

	// Google Places: general POI database
	let placesCount = 0;
	if (places?.results && places.results.length > 0) {
		sourcesAvailable++;
		placesCount = places.results.length;
	}

	// If no sources at all, return neutral
	if (sourcesAvailable === 0) return 45;

	// ── Step 2: Blend counts into a best-estimate competitor count ──
	// Different sources have different scopes:
	// - Overpass: OSM data, good coverage for mapped businesses
	// - Foursquare: check-in based, may include closed venues
	// - Yelp: review-based, strong for food/drink, 800m radius
	// - Google Places: broadest but noisiest
	// Take the maximum of Overpass vs average of other sources to avoid
	// double-counting while not missing real competitors.

	const altCounts = [foursquareCount, yelpCount, placesCount].filter(c => c > 0);
	const altAvg = altCounts.length > 0 ? Math.round(altCounts.reduce((a, b) => a + b, 0) / altCounts.length) : 0;

	// Best estimate: if Overpass has data, blend with alt sources;
	// otherwise rely purely on alt sources
	const blendedCount = competitorCount > 0
		? Math.round(competitorCount * 0.6 + altAvg * 0.4)  // Overpass-anchored blend
		: altAvg;                                              // Fallback to alt sources

	// ── Step 3: Category-specific ideal competitor count ──
	const idealCounts: Record<string, number> = {
		'cafe': 4, 'coffee': 4, 'restaurant': 6, 'retail': 4, 'fitness': 3, 'bar': 4
	};
	const ideal = idealCounts[categoryId] || 4;

	if (blendedCount === 0) {
		return 38; // Unproven market — risky, below average
	}

	// ── Step 4: Bell curve scoring ──
	// Peaks at ideal count; too few = unproven, too many = saturated
	const ratio = blendedCount / ideal;
	let score = bellCurve(ratio, 1.0, 0.8, 92, 12);

	// ── Step 5: Proximity bonus/penalty ──
	// If we have ring data, adjust based on how close competitors are
	if (hasRingData && nearbyCount > 0) {
		// Many competitors within 200m = more saturated feel
		if (nearbyCount >= ideal * 1.5) {
			score -= 8;  // Feels crowded at street level
		} else if (nearbyCount >= ideal) {
			score -= 4;  // Noticeably competitive immediate area
		}
		// But some nearby = validated market
		if (nearbyCount >= 1 && nearbyCount <= ideal) {
			score += 3;  // Healthy nearby competition
		}
	}

	return Math.round(clamp(score));
}

function computeSafetyScore(crime: CrimeData | null | undefined): number {
	if (!crime) return 44;

	const crimeScore = crime.crimeScore ?? 0;
	if (crimeScore <= 0) return 40;

	// Amplify differences: most NYC areas cluster 40-70 on raw crime score.
	// Stretch that range so small differences become visible.
	// Raw 30 → 22, Raw 50 → 48, Raw 65 → 68, Raw 80 → 85, Raw 95 → 96
	return Math.round(clamp(lerp(crimeScore, [
		[0, 5], [20, 15], [35, 28], [50, 48], [60, 60],
		[70, 72], [80, 85], [90, 93], [100, 98]
	])));
}

function computeInspectionsScore(inspections: InspectionsData | null | undefined): number {
	if (!inspections) return 46;

	const { results = [] } = inspections;
	if (results.length === 0) return 46;

	const totalViolations = results.reduce((sum, r) => sum + (r.violationCount || 0), 0);
	const avgViolations = totalViolations / results.length;
	const violationRate = results.filter((r) => (r.violationCount || 0) > 0).length / results.length;

	// Continuous decay: more violations = lower score
	// avgViolations 0 → 88, 1 → 72, 2 → 58, 4 → 38, 8 → 18
	const avgScore = clamp(88 * Math.exp(-0.22 * avgViolations));

	// Violation prevalence: what fraction of establishments have any violations
	// rate 0% → 90, 30% → 68, 60% → 45, 90% → 25
	const rateScore = clamp(90 - 72 * violationRate);

	// Blend: average severity matters more than prevalence
	const score = avgScore * 0.65 + rateScore * 0.35;
	return Math.round(clamp(score));
}

function computeTransitScore(census: CensusData | null | undefined): number {
	if (!census) return 40;

	const stationCount = census.subwayStations ?? 0;
	const transitScore = census.transitScore ?? 0;

	// Logarithmic curve for stations: 0 → 15, 1 → 52, 2 → 68, 3 → 78, 5 → 88, 8+ → 95
	const stationScore = stationCount > 0
		? clamp(15 + logCurve(stationCount, 3, 82))
		: (transitScore > 0 ? clamp(transitScore * 0.85) : 18);

	// If we have both, blend them (station count is more concrete)
	if (stationCount > 0 && transitScore > 0) {
		return Math.round(clamp(stationScore * 0.7 + transitScore * 0.3));
	}

	return Math.round(clamp(stationScore));
}

/**
 * Blended Foot Traffic Layer — combines real data sources:
 *
 * 1. NYC DOT Pedestrian Counts (40%) — actual counted foot traffic by block
 * 2. Transit Proximity (30%) — MTA station count + Walk Score transit score
 * 3. Walk Score (25%) — walkability as proxy for pedestrian-friendly environment
 * 4. POI Density (5%) — number of nearby businesses as minor tiebreaker
 * 5. Thoroughfare Modifier — adjusts final score based on street classification
 *    (major corridor vs side street) so Broadway ≠ W 90th St
 *
 * Each sub-signal has smart fallbacks so one broken API doesn't tank the score.
 * If ALL sources fail, returns a conservative 35 instead of the old hardcoded 12.
 */
function computeFootTrafficLayer(report: LocationIntelReport, categoryId: string = 'cafe'): number {
	let pedScore = -1;    // -1 = no data
	let transitProxScore = -1;
	let walkabilityScore = -1;
	let poiScore = -1;

	// ── Signal 1: NYC DOT Pedestrian Counts (most authoritative) ──
	if (report.pedestrian && report.pedestrian.countLocationCount > 0) {
		// Use the pre-computed footTrafficScore from nyc-pedestrian.ts (0-100)
		pedScore = clamp(report.pedestrian.footTrafficScore);
	}

	// ── Signal 2: Transit Proximity (MTA stations + Walk Score transit) ──
	// More transit = more people walking past your door
	const mtaStations = report.mtaRidership?.stationCount ?? 0;
	const mtaRidership = report.mtaRidership?.totalDailyRidership ?? 0;
	const wsTransit = report.walkScore?.transitScore ?? 0;

	if (mtaStations > 0 || wsTransit > 0) {
		// Station count: 1 → 40, 2 → 58, 3 → 70, 5 → 82, 8+ → 92
		let stationSignal = mtaStations > 0
			? clamp(20 + logCurve(mtaStations, 3, 75))
			: 0;

		// Ridership volume bonus: 10K+/day → +10, 50K+ → +20
		if (mtaRidership > 50000) stationSignal = Math.min(95, stationSignal + 20);
		else if (mtaRidership > 10000) stationSignal = Math.min(90, stationSignal + 10);

		// Walk Score transit score (0-100, already calibrated)
		const transitSignal = wsTransit > 0 ? clamp(wsTransit) : 0;

		// Blend: prefer MTA if available, Walk Score transit as supplement
		if (mtaStations > 0 && wsTransit > 0) {
			transitProxScore = Math.round(stationSignal * 0.6 + transitSignal * 0.4);
		} else if (mtaStations > 0) {
			transitProxScore = Math.round(stationSignal);
		} else {
			transitProxScore = Math.round(transitSignal);
		}
	}

	// ── Signal 3: Walk Score (pedestrian-friendly environment) ──
	if (report.walkScore && report.walkScore.walkScore > 0) {
		walkabilityScore = clamp(report.walkScore.walkScore);
	}

	// ── Signal 4: POI Density (minor — nearby businesses as activity proxy) ──
	const poiCount = (report.places?.results || []).length;
	if (poiCount > 0) {
		poiScore = Math.round(clamp(logCurve(poiCount, 20, 90)));
	}

	// ── Blend available signals with dynamic weights ──
	// Weights shift based on what data is actually available
	const signals: Array<{ score: number; idealWeight: number }> = [];

	if (pedScore >= 0) signals.push({ score: pedScore, idealWeight: 0.40 });
	if (transitProxScore >= 0) signals.push({ score: transitProxScore, idealWeight: 0.30 });
	if (walkabilityScore >= 0) signals.push({ score: walkabilityScore, idealWeight: 0.25 });
	if (poiScore >= 0) signals.push({ score: poiScore, idealWeight: 0.05 });

	// If no signals at all, return conservative estimate
	if (signals.length === 0) return 35;

	// Normalize weights to sum to 1.0 based on what's available
	const totalWeight = signals.reduce((sum, s) => sum + s.idealWeight, 0);
	const blended = signals.reduce(
		(sum, s) => sum + s.score * (s.idealWeight / totalWeight),
		0
	);

	// ── Signal 5: Thoroughfare Modifier ──
	// Street type matters enormously: Broadway sees 5-10x more foot traffic
	// than a residential side street in the same neighborhood.
	// This modifier adjusts the blended score to reflect that reality.
	const thoroughfare = classifyThoroughfare(report.address, report.pedestrian?.counts);
	let adjusted = blended * thoroughfare.modifier;

	// ── Signal 6: Street-Side Modifier ──
	// Which side of the street is this address on? The "wrong" side near a
	// tunnel approach or with all subway exits on the opposite side can
	// cost 30-50% of walk-in traffic for habitual-visit concepts.
	// Concept sensitivity: coffee shops feel this acutely; dentists don't.
	if (report.streetSide) {
		const { modifier: ssMod } = streetSideModifier(report.streetSide, categoryId);
		adjusted = adjusted * ssMod;
	}

	return Math.round(clamp(adjusted));
}

// ─── Thoroughfare Classification ───────────────────────────────────
// Determines if an address is on a major commercial corridor, secondary
// avenue, or residential side street, and returns a scoring modifier.
//
// Two-pass approach:
//   1. Data-driven: check if the address street appears in DOT pedestrian
//      count segments (DOT primarily counts major corridors, so absence
//      from the data is itself a signal of lower foot traffic)
//   2. Heuristic: pattern-match the address for known street types

type ThoroughfareClass = 'major-corridor' | 'secondary-avenue' | 'side-street' | 'unknown';

interface ThoroughfareResult {
	class: ThoroughfareClass;
	modifier: number;          // multiplier applied to blended foot traffic score
	street: string;            // extracted street name for debugging
}

export function classifyThoroughfare(
	address: string | undefined,
	pedestrianCounts: Array<{ location: string; totalCount: number }> | undefined
): ThoroughfareResult {
	const DEFAULT: ThoroughfareResult = { class: 'unknown', modifier: 1.0, street: '' };
	if (!address) return DEFAULT;

	// Extract the street name from the address (before first comma)
	// "215 W 90th St, New York, NY" → "W 90th St"
	// "2465 Broadway, New York, NY 10025" → "Broadway"
	const streetPart = address.split(',')[0].trim();
	// Remove the building number to get just the street name
	const streetName = streetPart.replace(/^\d+[-\s]*/,'').trim();
	if (!streetName) return DEFAULT;

	const normalized = streetName.toLowerCase();

	// ── Pass 1: Data-driven — check pedestrian segment match ──
	// If the address street appears in the DOT top-20 segments, its rank
	// tells us how busy it is relative to the borough.
	if (pedestrianCounts && pedestrianCounts.length > 0) {
		const matchIdx = pedestrianCounts.findIndex(c =>
			normalizeStreetName(c.location) === normalizeStreetName(streetName) ||
			normalizeStreetName(c.location).includes(normalizeStreetName(streetName)) ||
			normalizeStreetName(streetName).includes(normalizeStreetName(c.location))
		);

		if (matchIdx >= 0) {
			// Street found in DOT data — rank determines modifier
			// Top 3 segments = major corridor (busiest streets in the borough)
			// Segments 4-10 = secondary avenue
			// Segments 11+ = lower-traffic counted street
			if (matchIdx <= 2) return { class: 'major-corridor', modifier: 1.15, street: streetName };
			if (matchIdx <= 9) return { class: 'secondary-avenue', modifier: 1.0, street: streetName };
			return { class: 'side-street', modifier: 0.90, street: streetName };
		}

		// Street NOT in DOT top-20 segments.
		// DOT primarily counts busy corridors, so absence suggests a quieter street.
		// Still check heuristic patterns below for confirmation.
	}

	// ── Pass 2: Heuristic classification from street name patterns ──

	// Tier 1: Major commercial corridors — highest foot traffic nationally
	const majorCorridors = [
		/\bbroadway\b/,
		/\b5th\s*ave/i, /\bfifth\s*ave/i,
		/\b(times|herald|union|madison)\s*sq/i,
		/\bmarket\s*st/i,          // SF, Philadelphia
		/\bmichigan\s*ave/i,       // Chicago
		/\bstate\s*st/i,           // Chicago
		/\bchestnut\s*st/i,        // Philadelphia
		/\bpeachtree\s*/i,         // Atlanta
	];
	if (majorCorridors.some(rx => rx.test(normalized))) {
		return { class: 'major-corridor', modifier: 1.15, street: streetName };
	}

	// Tier 2: Named avenues — secondary commercial streets
	const secondaryAvenues = [
		/\b(amsterdam|columbus|lexington|madison|park|third|second|first)\s*ave/i,
		/\bavenue\s*(a|b|c|d)\b/i,   // Alphabet City
		/\b\d+(st|nd|rd|th)\s*ave/i,  // Numbered avenues
		/\bavenue\b/i,                 // Generic "avenue" indicator
		/\bboulevard\b/i,              // Boulevards tend to be commercial
		/\bblvd\b/i,
	];
	if (secondaryAvenues.some(rx => rx.test(normalized))) {
		return { class: 'secondary-avenue', modifier: 1.0, street: streetName };
	}

	// Tier 3: Numbered side streets — typically residential cross-streets
	// "W 90th St", "E 42nd St", "123rd Street", etc.
	const sideStreetPatterns = [
		/^[we]\s*\d+/i,               // W 90th, E 42nd (NYC cross-streets)
		/^\d+(st|nd|rd|th)\s*st/i,     // "42nd Street" without avenue designation
		/\bstreet\b/i,                 // Generic "street" (not avenue/blvd)
	];
	if (sideStreetPatterns.some(rx => rx.test(normalized))) {
		return { class: 'side-street', modifier: 0.80, street: streetName };
	}

	return DEFAULT;
}

/**
 * Normalize a street name for comparison.
 * "BROADWAY" = "broadway", "W 90TH ST" = "w 90th st"
 */
function normalizeStreetName(name: string): string {
	return name
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.replace(/\./g, '')
		.trim();
}

/** Legacy POI count helper — still used by wellness score */
function computePOICount(places: PlacesData | null | undefined): number {
	if (!places) return 0;
	return (places.results || []).length;
}

function computeWellnessScore(places: PlacesData | null | undefined): number {
	if (!places) return 35;

	const results = places.results || [];
	if (results.length === 0) return 15;

	const wellnessKeywords = ['gym', 'yoga', 'health', 'wellness', 'spa', 'fitness', 'pilates', 'crossfit', 'barre'];
	const wellnessCount = results.filter((p) =>
		wellnessKeywords.some(kw => p.name?.toLowerCase().includes(kw) || p.types?.join(',').toLowerCase().includes(kw))
	).length;

	// Total POI count provides context: wellness as a % of total POIs matters
	const totalPOIs = results.length;
	const wellnessDensity = totalPOIs > 0 ? wellnessCount / totalPOIs : 0;

	// Raw count score: log curve — 0 → 8, 1 → 28, 3 → 52, 6 → 70, 10 → 82, 15+ → 92
	const countScore = wellnessCount > 0
		? clamp(8 + logCurve(wellnessCount, 6, 88))
		: 8;

	// Density bonus: if >10% of POIs are wellness, that's a strong wellness district
	const densityBonus = clamp(wellnessDensity * 200, 0, 15);

	return Math.round(clamp(countScore + densityBonus));
}

// ──────────────────────────────────────────────
// Narrative Helpers
// ──────────────────────────────────────────────

function generateLocationSummary(score: number, subScores: SubScore[]): string {
	if (score >= 80) {
		// Find top 2 layers
		const top = subScores.sort((a, b) => b.score - a.score).slice(0, 2);
		return `Strong location with excellent ${top.map(s => s.label.toLowerCase()).join(' and ')}. Well-positioned for growth.`;
	} else if (score >= 65) {
		const weak = subScores.filter(s => s.score < 60)[0];
		return `Solid location overall. ${weak ? `${weak.label} is a constraint.` : 'Minor trade-offs on specific factors.'}`;
	} else if (score >= 50) {
		const weakest = subScores.sort((a, b) => a.score - b.score)[0];
		return `Mixed potential. ${weakest.label} is a concern. Careful due diligence required.`;
	} else {
		return `Challenging location with significant headwinds. Reconsider alternatives.`;
	}
}

function interpretGap(gap: number, locationScore: number, alignmentScore: number): string {
	if (gap >= 15) {
		return `Your profile significantly boosts this location. Strong personal fit despite objective limitations.`;
	} else if (gap >= 5) {
		return `Your profile aligns well with this location. Your strengths complement the area.`;
	} else if (gap >= -5) {
		return `Your profile matches this location fairly evenly. No major synergies or conflicts.`;
	} else if (gap >= -15) {
		return `Your profile doesn't fully exploit this location. The location is stronger than your fit suggests.`;
	} else {
		return `Misalignment: This location doesn't suit your risk profile, budget, or concept well.`;
	}
}

function generateAlignmentReasoning(gap: number, factors: AlignmentFactor[], locationScore: LocationScoreResult): string {
	const positiveFactors = factors.filter(f => f.impact > 0);
	const negativeFactors = factors.filter(f => f.impact < 0);

	let reasoning = '';

	if (gap > 0) {
		reasoning = positiveFactors.length > 0
			? `You're well-positioned here: ${positiveFactors.map(f => f.name).join(', ')} are your strengths.`
			: `The location is inherently strong (score ${locationScore.score}), and your profile doesn't detract from it.`;
	} else if (gap < 0) {
		reasoning = negativeFactors.length > 0
			? `Caution: ${negativeFactors.map(f => f.name).join(', ')} don't align with your profile.`
			: `The location's inherent weaknesses aren't offset by your profile advantages.`;
	} else {
		reasoning = 'Your profile and the location are evenly matched—neither a major advantage nor disadvantage.';
	}

	return reasoning;
}

// ──────────────────────────────────────────────
// Location IQ Rings (4-layer intuitive model)
// ──────────────────────────────────────────────

export interface LocationIQRing {
	label: string;
	score: number;
	detail: string;
}

/**
 * Map the 8 Location Score layers into 4 intuitive Location IQ rings.
 *
 * Ring 1: "How busy is this spot?" — footTraffic + wellness (activity proxy)
 * Ring 2: "How easy to get here?" — walkScore + transit
 * Ring 3: "Is this area on the way up?" — demographics + inspections (market health)
 * Ring 4: "Does it feel safe and clean?" — safety + inspections
 */
export function computeLocationIQRings(result: LocationScoreResult, intelReport?: any): LocationIQRing[] {
	const L = result.layers;

	// Ring 1: How busy — blend foot traffic (60%) + wellness ecosystem (20%) + competition existence (20%)
	const busyScore = Math.round(L.footTraffic * 0.60 + L.wellness * 0.20 + Math.min(L.competition + 20, 100) * 0.20);
	let busyDetail = '';
	if (busyScore >= 80) busyDetail = 'Very high foot traffic and activity. This block is alive with people.';
	else if (busyScore >= 60) busyDetail = 'Good foot traffic. Enough people pass through to support walk-in businesses.';
	else if (busyScore >= 40) busyDetail = 'Moderate traffic. You may need to generate your own draw.';
	else busyDetail = 'Quiet area. Foot traffic alone won\'t sustain most businesses here.';

	// Add MTA data to detail if available
	if (intelReport?.mtaRidership?.totalDailyRidership) {
		const daily = intelReport.mtaRidership.totalDailyRidership;
		busyDetail += ` ~${Math.round(daily / 1000)}K daily transit riders nearby.`;
	}

	// Ring 2: How accessible — walkScore (60%) + transit (40%)
	const accessScore = Math.round(L.walkScore * 0.60 + L.transit * 0.40);
	let accessDetail = '';
	if (accessScore >= 80) accessDetail = 'Excellent transit access and walkability. People can easily reach this spot.';
	else if (accessScore >= 60) accessDetail = 'Good accessibility. Multiple ways to get here.';
	else if (accessScore >= 40) accessDetail = 'Moderate access. Not the easiest to reach without a car.';
	else accessDetail = 'Limited transit options. Customers need to make an effort to get here.';

	if (intelReport?.walkScore) {
		const ws = intelReport.walkScore;
		if (ws.walkScore) accessDetail += ` Walk Score: ${ws.walkScore}/100.`;
		if (ws.transitScore) accessDetail += ` Transit Score: ${ws.transitScore}/100.`;
	}

	// Ring 3: Area trending up — demographics (50%) + market health from inspections (20%) + competition as market validation (30%)
	const trendScore = Math.round(L.demographics * 0.50 + L.inspections * 0.20 + L.competition * 0.30);
	let trendDetail = '';
	if (trendScore >= 80) trendDetail = 'Thriving area with strong demographics and active business community.';
	else if (trendScore >= 60) trendDetail = 'Stable area with decent economic indicators.';
	else if (trendScore >= 40) trendDetail = 'Mixed signals. Some positive indicators, some concerns.';
	else trendDetail = 'Area may be struggling economically. Proceed with caution.';

	if (intelReport?.census?.medianIncome || intelReport?.census?.medianHouseholdIncome) {
		const income = intelReport.census.medianIncome || intelReport.census.medianHouseholdIncome || 0;
		if (income > 0) trendDetail += ` Median income: $${Math.round(income / 1000)}K.`;
	}

	// Ring 4: Safe and clean — safety (70%) + inspections (30%)
	const safeScore = Math.round(L.safety * 0.70 + L.inspections * 0.30);
	let safeDetail = '';
	if (safeScore >= 80) safeDetail = 'Very safe area with well-maintained buildings and businesses.';
	else if (safeScore >= 60) safeDetail = 'Generally safe. No major concerns.';
	else if (safeScore >= 40) safeDetail = 'Some safety concerns. Check specific crime data.';
	else safeDetail = 'Safety is a significant concern in this area.';

	if (intelReport?.crime) {
		safeDetail += ` Safety score: ${intelReport.crime.crimeScore}/100 based on NYPD data.`;
	}

	return [
		{ label: 'How busy is this spot?', score: clamp(busyScore), detail: busyDetail },
		{ label: 'How easy to get here?', score: clamp(accessScore), detail: accessDetail },
		{ label: 'Is this area on the way up?', score: clamp(trendScore), detail: trendDetail },
		{ label: 'Does it feel safe and clean?', score: clamp(safeScore), detail: safeDetail },
	];
}
