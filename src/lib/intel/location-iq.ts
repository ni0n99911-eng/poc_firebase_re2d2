/**
 * Location IQ Scoring Engine — Phase 2
 *
 * Replaces hardcoded proxy scores with real computed scores
 * from 19 intelligence sources (17 free + Foursquare + Momentum trend analysis).
 *
 * Architecture:
 *   Location_IQ = (W_n × NIQ) + (W_s × SIQ) + (W_t × TIQ) + (W_l × LIQ)
 *
 * Where:
 *   NIQ = Neighborhood IQ: Pop(25%) + Lifecycle(20%) + BizEco(30%) + Disruption(15%) + Transit(10%)
 *   SIQ = Storefront IQ: WalkScore(30%) + Competitors(30%) + BuildingRisk(20%) + Landmarks(20%)
 *   TIQ = Taste IQ: CuisineDiversity(40%) + QualityGap(30%) + MarketGap(30%)
 *   LIQ = Labor IQ: (future — BLS data, not yet implemented)
 *
 * Two-layer concept model:
 *   7 concept types (user-facing): specialty_coffee, qsr, full_service_restaurant,
 *     fitness_studio, retail, bar_nightlife, coworking — each with tuned weights
 *   3 archetypes (internal): impulse, planned, destination — for sub-score logic
 */

import type { LocationIntelReport } from './types';
// 04.19.2026 13:35 Score Consolidation — scoreToGrade imported from canonical grade-scale.ts
import { scoreToGrade as _scoreToGrade } from '$lib/intel/scoring/grade-scale';
import { getBoroughTransitFloor as _getBoroughTransitFloor, detectBorough } from '$lib/constants/geography';
import { TRANSIT_THRESHOLDS } from '$lib/constants/scoring-thresholds';
import { getConfidenceMultipliers, type ConfidenceMultipliers } from './confidence-priors';
// BR-L Vital Rules Registry — Rules 2/3/17/20 centralised here (April 11, 2026).
// Thin adapters below call RULES[N].check(ctx) and apply the same numeric
// side effects (SIQ/LIQ/locationIQ mutations, signal pushes) as before.
// Rule 2 pulls `getBenchmark` + `DOC09_OCCUPANCY_CEILINGS` internally, so
// those imports were removed from this file when the rules moved.
import { RULES as VITAL_RULES, type RuleContext as VitalRuleContext } from './vital-rules';

// ─────────────────────────────────────────────────
// Public interfaces
// ─────────────────────────────────────────────────

export interface LocationIQReport {
	niq: number;                   // Neighborhood IQ (0-100)
	siq: number;                   // Storefront IQ (0-100)
	tiq: number;                   // Taste IQ (0-100)
	liq: number;                   // Labor IQ (0-100) — placeholder
	locationIQ: number;            // Composite (0-100)
	confidence: number;            // 0-100 based on data completeness
	grade: IQGrade;
	breakdown: IQBreakdown;
	signals: IQSignal[];           // Human-readable signals
	dataCompleteness: DataCompleteness;
}

export interface IQBreakdown {
	niq: {
		population: number;
		lifecycle: number;
		businessEcosystem: number;
		disruption: number;
		transit: number;
	};
	siq: {
		walkability: number;
		competitors: number;
		buildingRisk: number;
		landmarks: number;
	};
	tiq: {
		cuisineDiversity: number;
		qualityGap: number;
		marketGap: number;
	};
}

export interface IQSignal {
	layer: 'NIQ' | 'SIQ' | 'TIQ' | 'LIQ';
	type: 'positive' | 'negative' | 'neutral' | 'warning' | 'info';
	message: string;
}

export type IQGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
// 04.19.2026 13:35 Score Consolidation — thin typed wrapper so all call sites stay unaffected
function scoreToGrade(score: number): IQGrade { return _scoreToGrade(score) as IQGrade; }

export interface DataCompleteness {
	available: number;
	total: number;
	missing: string[];
	percentage: number;
}

import { normalizeBusinessType, BUSINESS_TYPE_CONFIGS } from './registry/business-type-registry';

export type ConceptType = import('./registry/business-type-registry').ValidBusinessType;
type Archetype = import('./registry/business-type-registry').BusinessTypeConfig['archetype'];

function resolveConceptType(businessType: string, businessSubType?: string): ConceptType {
	if (businessSubType) {
		const resolvedSub = normalizeBusinessType(businessSubType);
		if (resolvedSub !== 'specialty_coffee' && resolvedSub !== 'generic') return resolvedSub;
	}
	return normalizeBusinessType(businessType);
}

function getArchetype(businessType: string): Archetype {
	const concept = resolveConceptType(businessType);
	return BUSINESS_TYPE_CONFIGS[concept].archetype;
}

function getWeights(businessType: string): { niq: number; siq: number; tiq: number; liq: number } {
	const concept = resolveConceptType(businessType);
	return BUSINESS_TYPE_CONFIGS[concept].locationWeights;
}

// ─────────────────────────────────────────────────
// Main scoring function
// ─────────────────────────────────────────────────

export function computeLocationIQ(
	report: LocationIntelReport,
	businessType: string = 'cafe',
	/** Power Broker impact types for confidence prior adjustments */
	historicalImpactTypes?: string[]
): LocationIQReport {
	const signals: IQSignal[] = [];
	const missing: string[] = [];

	// Track what data we have
	let availableSources = 0;
	const totalSources = 19;
	if (report.census) availableSources++; else missing.push('Census');
	if (report.censusHousing) availableSources++; else missing.push('Census Housing');
	if (report.walkScore) availableSources++; else missing.push('WalkScore');
	if (report.inspections) availableSources++; else missing.push('Inspections');
	if (report.crime) availableSources++; else missing.push('Crime');
	if (report.places) availableSources++; else missing.push('Places');
	if (report.marketDensity) availableSources++; else missing.push('Market Density');
	if (report.competitors) availableSources++; else missing.push('Competitors');
	if (report.lpc) availableSources++; else missing.push('Landmarks');
	if (report.mtaRidership) availableSources++; else missing.push('MTA Ridership');
	if (report.dcaLicenses) availableSources++; else missing.push('DCA Licenses');
	if (report.dob) availableSources++; else missing.push('DOB');
	if (report.complaints311) availableSources++; else missing.push('311 Complaints');
	if (report.pedestrian) availableSources++; else missing.push('Pedestrian');
	if (report.pluto) availableSources++; else missing.push('PLUTO');
	if (report.sidewalkCafes) availableSources++; else missing.push('Sidewalk Cafes');
	if (report.liquorLicenses) availableSources++; else missing.push('Liquor Licenses');
	if (report.foursquare) availableSources++; else missing.push('Foursquare');
	if (report.momentum) availableSources++; else missing.push('Momentum');

	// ── Power Broker confidence priors (merge all matching impact types) ──
	// If this location matches historical ground truths, adjust sub-score
	// weights so structurally suppressed signals carry less (or more) weight.
	const priorMults: ConfidenceMultipliers = {};
	if (historicalImpactTypes && historicalImpactTypes.length > 0) {
		for (const impactType of historicalImpactTypes) {
			const m = getConfidenceMultipliers(impactType);
			for (const [k, v] of Object.entries(m)) {
				const key = k as keyof ConfidenceMultipliers;
				// Multiply together when multiple impact types overlap
				priorMults[key] = (priorMults[key] ?? 1.0) * (v ?? 1.0);
			}
		}
	}
	const pm = (key: keyof ConfidenceMultipliers): number => priorMults[key] ?? 1.0;

	// ── Data completeness fraction (used for variance expansion confidence) ──
	const dataFraction = availableSources / totalSources;

	// ── Compute NIQ ──
	const niqBreakdown = computeNIQ(report, businessType, signals);
	const niqRaw = Math.round(
		niqBreakdown.population * 0.25 * pm('demographics') +
		niqBreakdown.lifecycle * 0.20 * pm('momentum') +
		niqBreakdown.businessEcosystem * 0.30 * pm('competition') +
		niqBreakdown.disruption * 0.15 * pm('vibrancy') +
		niqBreakdown.transit * 0.10 * pm('transit')
	);
	let niq = expandVariance(niqRaw, 1.65, dataFraction);

	// ── Compute SIQ ──
	const siqBreakdown = computeSIQ(report, businessType, signals);
	const siqRaw = Math.round(
		siqBreakdown.walkability * 0.30 * pm('accessibility') +
		siqBreakdown.competitors * 0.30 * pm('competition') +
		siqBreakdown.buildingRisk * 0.20 * pm('safety') +
		siqBreakdown.landmarks * 0.20
	);
	let siq = expandVariance(siqRaw, 1.65, dataFraction);

	// ── Compute TIQ ──
	const tiqBreakdown = computeTIQ(report, businessType, signals);
	const tiqRaw = Math.round(
		tiqBreakdown.cuisineDiversity * 0.40 +
		tiqBreakdown.qualityGap * 0.30 +
		tiqBreakdown.marketGap * 0.30
	);
	let tiq = expandVariance(tiqRaw, 1.65, dataFraction);

	// ── Compute LIQ (Labor IQ) from Census + MTA data ──
	const liqRaw = computeLIQ(report, businessType, signals);
	let liq = expandVariance(liqRaw, 1.65, dataFraction);

	// ── Composite Location IQ ──
	// Pillar-level expansion (1.65x) undoes sub-component averaging compression.
	// Composite-level expansion (1.55x) undoes final 4-pillar averaging compression.
	// Combined effective stretch: ~2.5x — turns [35,65] clustered range into [13,86] usable range.
	const weights = getWeights(businessType);
	const compositeRaw = Math.round(
		Math.max(5, Math.min(98,
			niq * weights.niq +
			siq * weights.siq +
			tiq * weights.tiq +
			liq * weights.liq
		))
	);
	let locationIQ = expandVariance(compositeRaw, 1.55, dataFraction);

	// ── IMP-02: Churn Risk adjustment (0.10 weight equivalent = ±10 pts) ──
	// tenant_count_5yr predicts churn with d=3.4. Applied post-blend so it doesn't
	// distort the 4-pillar architecture. Score 50 = no data (neutral), below 50 = high churn.
	const churnData = (report as any).churnRisk;
	if (churnData && typeof churnData.score === 'number' && churnData.tenantCount5yr > 0) {
		// Map [0,100] → [-10, +10] adjustment (50=neutral)
		const churnAdj = Math.round((churnData.score - 50) * 0.20);
		locationIQ = Math.max(5, Math.min(98, locationIQ + churnAdj));
		if (churnData.tenantCount5yr >= 4) {
			signals.push({ layer: 'SIQ', type: 'negative', message: `High address turnover: ${churnData.tenantCount5yr} tenants in 5 years (avg tenure: ${churnData.avgTenureMonths ? Math.round(churnData.avgTenureMonths) + ' mo' : 'unknown'}). Investigate why businesses leave.` });
		} else if (churnData.tenantCount5yr === 1) {
			signals.push({ layer: 'SIQ', type: 'positive', message: `Stable address: single tenant in 5 years — low turnover risk.` });
		}
	}

	// ══════════════════════════════════════════════════════════════════════
	// 25 VITAL RULES — Phase 1 (post-composite adjustments)
	// These fire AFTER the 4-pillar IQ is computed but BEFORE the score is
	// presented. They enforce hard constraints, multipliers, and concept-
	// specific adjustments that the raw sub-scores don't capture.
	// ══════════════════════════════════════════════════════════════════════

	const concept = resolveConceptType(businessType);
	const borough = detectBorough(report.lat ?? 40.75, report.lng ?? -73.98);
	const boroughName = borough?.name || '';

	// ── RULE 6: Population Density Minimum (hard cap) ──
	// If catchment population is below concept threshold, cap at 40.
	if (report.census) {
		const pop = report.census.totalPopulation || 0;
		const POPULATION_MINIMUMS: Partial<Record<ConceptType, number>> = {
			retail: 10000,
			specialty_coffee: 8000,
			qsr: 20000,
			full_service_restaurant: 10000,
			fitness_studio: 12000,
			personal_services: 8000,
		};
		const minPop = POPULATION_MINIMUMS[concept];
		if (minPop && pop > 0 && pop < minPop) {
			locationIQ = Math.min(locationIQ, 40);
			signals.push({ layer: 'NIQ', type: 'negative', message: `Catchment population ${pop.toLocaleString()} is below the ${minPop.toLocaleString()} minimum for ${BUSINESS_TYPE_CONFIGS[concept].label}. Location capped at 40.` });
		}
	}

	// ── RULE 7: Walk Score Viability Multiplier ──
	// Walk Score modifies the final Location IQ as a multiplier.
	if (report.walkScore) {
		const ws = report.walkScore.walkScore || 50;
		let wsMult = 1.0;
		if (ws >= 90) wsMult = 1.10;
		else if (ws >= 70) wsMult = 1.00;
		else if (ws >= 50) wsMult = 0.90;
		else wsMult = 0.75;

		if (wsMult !== 1.0) {
			const before = locationIQ;
			locationIQ = Math.max(5, Math.min(98, Math.round(locationIQ * wsMult)));
			if (wsMult < 1.0) {
				signals.push({ layer: 'SIQ', type: 'negative', message: `Walk Score ${ws} (${ws < 50 ? 'car-dependent' : 'somewhat walkable'}) reduces Location IQ from ${before} → ${locationIQ}` });
			} else {
				signals.push({ layer: 'SIQ', type: 'positive', message: `Walk Score ${ws} (walker's paradise) boosts Location IQ from ${before} → ${locationIQ}` });
			}
		}
	}

	// ── RULE 13: Outer-Borough Arbitrage ──
	// Brooklyn/Queens/Bronx get a bonus when the concept serves local residential demand.
	const LOCAL_RESIDENTIAL_CONCEPTS: ConceptType[] = [
		'specialty_coffee', 'qsr', 'personal_services', 'fitness_studio', 'medical_office', 'retail',
	];
	if (['Brooklyn', 'Queens', 'Bronx'].includes(boroughName) && LOCAL_RESIDENTIAL_CONCEPTS.includes(concept)) {
		const outerBonus = boroughName === 'Bronx' ? 10 : 8;
		locationIQ = Math.min(98, locationIQ + outerBonus);
		signals.push({ layer: 'SIQ', type: 'positive', message: `${boroughName} location: +${outerBonus} pts — 40-60% lower rent than comparable Manhattan corridor with growing local demand` });
	}

	// ── RULE 22: Demographic Alignment ──
	// Penalize if median income diverges >30% from concept's target customer income range.
	if (report.census) {
		const medianIncome = report.census.medianHouseholdIncome || 0;
		const CONCEPT_INCOME_TARGETS: Partial<Record<ConceptType, { min: number; max: number }>> = {
			specialty_coffee: { min: 50000, max: 200000 },
			qsr: { min: 30000, max: 120000 },
			full_service_restaurant: { min: 60000, max: 250000 },
			bar_nightlife: { min: 50000, max: 200000 },
			fitness_studio: { min: 60000, max: 250000 },
			retail: { min: 40000, max: 200000 },
			coworking: { min: 70000, max: 300000 },
			personal_services: { min: 40000, max: 180000 },
			medical_office: { min: 40000, max: 250000 },
		};
		const target = CONCEPT_INCOME_TARGETS[concept];
		if (target && medianIncome > 0) {
			const mid = (target.min + target.max) / 2;
			const divergence = Math.abs(medianIncome - mid) / mid;
			if (medianIncome < target.min * 0.7) {
				// Income far below target — severe mismatch
				locationIQ = Math.max(5, locationIQ - 15);
				signals.push({ layer: 'NIQ', type: 'negative', message: `Median income $${(medianIncome / 1000).toFixed(0)}K is well below target range for ${BUSINESS_TYPE_CONFIGS[concept].label} — customer base may not support concept` });
			} else if (divergence > 0.30) {
				locationIQ = Math.max(5, locationIQ - 8);
				signals.push({ layer: 'NIQ', type: 'negative', message: `Median income $${(medianIncome / 1000).toFixed(0)}K diverges ${Math.round(divergence * 100)}% from ${BUSINESS_TYPE_CONFIGS[concept].label} target — demographic mismatch risk` });
			}
		}
	}

	// ── RULE 15: Clustering Paradox ──
	// Comparison goods (apparel, jewelry) BENEFIT from clustering.
	// Convenience goods (grocery, pharmacy) are HURT by clustering.
	// F&B has a sweet spot (2-5 competitors) before saturation.
	if (report.competitors) {
		const nearby = (report.competitors.rings?.ring1?.length || 0) + (report.competitors.rings?.ring2?.length || 0);

		// Comparison goods: clustering is positive
		const COMPARISON_CONCEPTS: ConceptType[] = ['retail']; // retail includes apparel, jewelry, home
		// Convenience goods: clustering is negative
		const CONVENIENCE_CONCEPTS: ConceptType[] = []; // grocery maps to 'retail' but is convenience — handled by archetype
		// F&B sweet spot
		const FB_CONCEPTS: ConceptType[] = ['specialty_coffee', 'qsr', 'full_service_restaurant', 'bar_nightlife'];

		if (COMPARISON_CONCEPTS.includes(concept) && nearby >= 3) {
			const clusterBonus = Math.min(6, nearby);
			locationIQ = Math.min(98, locationIQ + clusterBonus);
			signals.push({ layer: 'TIQ', type: 'positive', message: `${nearby} similar businesses nearby — comparison shopping district effect (+${clusterBonus} pts)` });
		} else if (FB_CONCEPTS.includes(concept)) {
			if (nearby >= 2 && nearby <= 5) {
				locationIQ = Math.min(98, locationIQ + 4);
				signals.push({ layer: 'TIQ', type: 'positive', message: `${nearby} competing F&B venues — dining district effect (+4 pts). Sweet spot before saturation.` });
			} else if (nearby > 8) {
				locationIQ = Math.max(5, locationIQ - 8);
				signals.push({ layer: 'TIQ', type: 'negative', message: `${nearby} F&B competitors within 800m — saturation zone (-8 pts). Differentiation critical.` });
			}
		}
		// Convenience/destination concepts with heavy local competition
		if (['personal_services', 'fitness_studio', 'medical_office'].includes(concept) && nearby >= 5) {
			locationIQ = Math.max(5, locationIQ - 6);
			signals.push({ layer: 'TIQ', type: 'negative', message: `${nearby} direct competitors for a service-based concept — oversaturation risk (-6 pts)` });
		}
	}

	// ══════════════════════════════════════════════════════════════════════
	// 25 VITAL RULES — Phase 2 (neighborhood timing + competitive positioning)
	// ══════════════════════════════════════════════════════════════════════

	// ── RULE 11: Gentrification Stage ──
	// Derived from income change + new business formation + building permits.
	// MID stage = optimal entry window (+12). PEAK = rent correction risk (-5).
	if (report.census && report.dcaLicenses && report.dob) {
		const incomeChange5yr = (report.census as any).incomeChange5yr ?? 0; // pct change — not yet on CensusData interface
		const newBizRate = report.dcaLicenses.newBusinessRate ?? 0;
		const newBuildings = report.dob.newBuildingCount ?? 0;

		let stage: 'early' | 'mid' | 'late' | 'peak' | 'unknown' = 'unknown';
		if (incomeChange5yr > 25 && newBizRate > 20 && newBuildings > 3) {
			stage = 'peak';
		} else if (incomeChange5yr >= 10 && incomeChange5yr <= 25 && newBizRate >= 15) {
			stage = 'mid';
		} else if (incomeChange5yr > 25 && newBizRate < 15) {
			stage = 'late';
		} else if (incomeChange5yr > 0 && incomeChange5yr < 10 && newBizRate >= 10) {
			stage = 'early';
		}

		if (stage === 'mid') {
			locationIQ = Math.min(98, locationIQ + 12);
			signals.push({ layer: 'NIQ', type: 'positive', message: `Mid-gentrification stage: income up ${Math.round(incomeChange5yr)}%, ${newBizRate}% new businesses — optimal entry window (+12 pts)` });
		} else if (stage === 'peak') {
			locationIQ = Math.max(5, locationIQ - 5);
			signals.push({ layer: 'NIQ', type: 'negative', message: `Peak gentrification: rapid income growth + high construction activity — rent correction risk (-5 pts)` });
		} else if (stage === 'early') {
			signals.push({ layer: 'NIQ', type: 'neutral', message: `Early-stage neighborhood change: income rising ${Math.round(incomeChange5yr)}% — cheaper rent but customer base still forming` });
		} else if (stage === 'late') {
			signals.push({ layer: 'NIQ', type: 'neutral', message: `Late-stage: high incomes but slower business growth — premium rent zone, only high-revenue concepts viable` });
		}
	}

	// ── RULE 12: Neighborhood Recovery Pattern ──
	// Post-pandemic: residential/recreational neighborhoods recovered; office-dependent still depressed.
	// We approximate neighborhood type from daytime population ratio + transit patterns.
	if (report.census) {
		const daytimeRatio = report.census.daytimePopulationRatio ?? 1.0;
		const isOfficeDependent = daytimeRatio > 2.0 && boroughName === 'Manhattan';
		const isResidentialRecreational = daytimeRatio < 1.3 && ['Brooklyn', 'Queens'].includes(boroughName);

		if (isOfficeDependent) {
			const before = locationIQ;
			locationIQ = Math.max(5, Math.round(locationIQ * 0.85));
			signals.push({ layer: 'NIQ', type: 'negative', message: `Office-dependent zone (daytime ratio ${daytimeRatio.toFixed(1)}x) — foot traffic still ~75-85% of pre-pandemic. Score ${before} → ${locationIQ}` });
		} else if (isResidentialRecreational) {
			const before = locationIQ;
			locationIQ = Math.min(98, Math.round(locationIQ * 1.05));
			signals.push({ layer: 'NIQ', type: 'positive', message: `Residential/recreational neighborhood — foot traffic recovered or exceeded pre-pandemic levels. Score ${before} → ${locationIQ}` });
		}
	}

	// ── RULE 14: Anchor Tenant Halo ──
	// If Google Places / Foursquare detects a major anchor nearby, bonus.
	// We use the market density and places data for anchor detection.
	if (report.marketDensity) {
		const md = report.marketDensity;
		const totalBiz = md.totalBusinesses || 0;
		// High-category-count + high-vitality = likely anchor presence
		const hasAnchor = md.commercialVitality > 80 && totalBiz > 100;
		// Low density = isolated
		const isIsolated = totalBiz < 20 && md.commercialVitality < 30;

		if (hasAnchor) {
			locationIQ = Math.min(98, locationIQ + 7);
			signals.push({ layer: 'NIQ', type: 'positive', message: `High commercial density (${totalBiz} businesses, vitality ${md.commercialVitality}/100) — likely anchor tenant halo effect (+7 pts)` });
		} else if (isIsolated) {
			locationIQ = Math.max(5, locationIQ - 8);
			signals.push({ layer: 'NIQ', type: 'negative', message: `Isolated commercial zone — only ${totalBiz} businesses, low vitality. All traffic generation falls on you (-8 pts)` });
		}
	}

	// ── RULE 16: Business Mix Divergence Opportunity ──
	// When a neighborhood's F&B/retail/services mix diverges >8% from citywide baseline,
	// score the gap as opportunity (underserved) or warning (oversaturated).
	if (report.dcaLicenses && report.dcaLicenses.industryBreakdown) {
		const breakdown = report.dcaLicenses.industryBreakdown;
		const total = report.dcaLicenses.totalCount || 1;
		// Citywide baseline: F&D 21%, Retail 29%, Services 32%
		const BASELINES: Record<string, number> = { food: 0.21, retail: 0.29, services: 0.32 };
		// Map concept to a category
		const CONCEPT_CATEGORY: Partial<Record<ConceptType, string>> = {
			specialty_coffee: 'food', qsr: 'food', full_service_restaurant: 'food', bar_nightlife: 'food',
			retail: 'retail', fitness_studio: 'services', personal_services: 'services',
			coworking: 'services', medical_office: 'services',
		};
		const targetCategory = CONCEPT_CATEGORY[concept];
		if (targetCategory && BASELINES[targetCategory]) {
			// Count licenses in target category (rough approximation from industry breakdown)
			const categoryCount = breakdown.filter((b: any) =>
				targetCategory === 'food' ? /food|restaurant|cafe|bar|bakery/i.test(b.industry || b.name || '') :
					targetCategory === 'retail' ? /retail|store|shop/i.test(b.industry || b.name || '') :
						/service|salon|gym|medical|office/i.test(b.industry || b.name || '')
			).reduce((sum: number, b: any) => sum + (b.count || 1), 0);
			const neighborhoodPct = categoryCount / total;
			const baseline = BASELINES[targetCategory];
			const divergence = neighborhoodPct - baseline;

			if (divergence < -0.08) {
				locationIQ = Math.min(98, locationIQ + 8);
				signals.push({ layer: 'TIQ', type: 'positive', message: `${targetCategory.charAt(0).toUpperCase() + targetCategory.slice(1)} underrepresented here (${Math.round(neighborhoodPct * 100)}% vs ${Math.round(baseline * 100)}% citywide) — gap opportunity (+8 pts)` });
			} else if (divergence > 0.10) {
				locationIQ = Math.max(5, locationIQ - 8);
				signals.push({ layer: 'TIQ', type: 'negative', message: `${targetCategory.charAt(0).toUpperCase() + targetCategory.slice(1)} oversaturated (${Math.round(neighborhoodPct * 100)}% vs ${Math.round(baseline * 100)}% citywide) — differentiation critical (-8 pts)` });
			}
		}
	}

	// ── RULE 24: Community Ecosystem ──
	// BID zones, cultural anchors, and merchant associations boost score.
	// Isolation (no community infrastructure) penalizes.
	// BID detection: liquor license density + sidewalk cafes as proxies for organized corridors.
	{
		let communityScore = 0;
		let hasCommunityInfra = false;

		// Sidewalk cafes = BID proxy (BIDs promote outdoor dining)
		if (report.sidewalkCafes && report.sidewalkCafes.activeCount > 5) {
			communityScore += 6;
			hasCommunityInfra = true;
			signals.push({ layer: 'NIQ', type: 'positive', message: `Active outdoor dining corridor (${report.sidewalkCafes.activeCount} permits) — likely BID zone with shared marketing and sanitation (+6 pts)` });
		}

		// Cultural anchor proxy: landmark district + high business diversity
		if (report.lpc && report.lpc.isHistoricDistrict) {
			communityScore += 4;
			hasCommunityInfra = true;
			signals.push({ layer: 'NIQ', type: 'positive', message: `Historic/cultural district — generates consistent visitor traffic and storytelling value (+4 pts)` });
		}

		if (communityScore > 0) {
			locationIQ = Math.min(98, locationIQ + communityScore);
		} else if (!hasCommunityInfra && report.marketDensity && (report.marketDensity.totalBusinesses || 0) < 30) {
			locationIQ = Math.max(5, locationIQ - 6);
			signals.push({ layer: 'NIQ', type: 'negative', message: `No community infrastructure detected (no BID, low business density) — all marketing falls on you (-6 pts)` });
		}
	}

	// ── RULE 17: Liquor License Proximity Lock ──
	// Concepts requiring an on-premises liquor license face two SLA constraints:
	// (a) 200-ft school/church rule — hard block, no SLA discretion. We don't
	//     currently have school location data, so we flag it as a MUST-VERIFY advisory.
	// (b) 500-ft clustering — 3+ existing on-premises licenses within 500 ft triggers
	//     the SLA "public interest" review. Our data pulls from a 500-meter radius
	//     (~1640 ft), so we use scaled thresholds:
	//       ≥ 8 on-premises in 500 m → SATURATED (hard penalty, -12 SIQ, cap 45)
	//       ≥ 5 on-premises in 500 m → DIFFICULT (-8 SIQ, flag)
	//       < 5 on-premises → CLEAR (+5 SIQ bonus — easier path to license)
	{
		const LIQUOR_CONCEPTS = new Set([
			'bar_nightlife', 'full_service_restaurant', 'fine_dining'
		]);

		if (LIQUOR_CONCEPTS.has(businessType) && report.liquorLicenses) {
			const onPremise = report.liquorLicenses.onPremiseCount ?? 0;

			if (onPremise >= 8) {
				// Saturated corridor — SLA will almost certainly deny or heavily condition
				siq = Math.max(5, siq - 12);
				locationIQ = Math.min(45, locationIQ);
				signals.push({
					layer: 'SIQ',
					type: 'negative',
					message: `Liquor license SATURATED: ${onPremise} on-premises licenses within 500 m — SLA will require "public interest" review and likely deny. Hard cap applied (-12 SIQ, max 45).`
				});
			} else if (onPremise >= 5) {
				// Difficult — clustering triggers extra scrutiny
				siq = Math.max(5, siq - 8);
				signals.push({
					layer: 'SIQ',
					type: 'negative',
					message: `Liquor license DIFFICULT: ${onPremise} on-premises licenses within 500 m — expect SLA "500-ft rule" scrutiny, 6–18 month timeline, possible denial (-8 SIQ).`
				});
			} else {
				// Clear corridor — license path is easier
				siq = Math.min(98, siq + 5);
				signals.push({
					layer: 'SIQ',
					type: 'positive',
					message: `Liquor license path CLEAR: only ${onPremise} on-premises licenses nearby — straightforward SLA approval expected (+5 SIQ).`
				});
			}

			// ── VITAL RULE 17: 200-ft school/church SLA block ──
			// Retrofit (BR-L): delegate verdict to RULES[17].check(); adapter still
			// owns the SIQ -15 penalty, locationIQ cap at 30, and signal push.
			if (report.schools) {
				const r17Ctx: VitalRuleContext = {
					businessType,
					concept,
					schools: {
						slaBlocked: !!report.schools.slaBlocked,
						within200ft: report.schools.within200ft ?? 0,
						closestSchool: report.schools.closestSchool
							? {
								name: report.schools.closestSchool.name,
								distanceMeters: report.schools.closestSchool.distanceMeters,
							}
							: null,
					},
				};
				const r17 = VITAL_RULES[17].check(r17Ctx);

				if (!r17.passes) {
					// SLA-blocked path: apply the legacy side effects verbatim.
					const distFt = (r17.data.distFt as number) ?? 0;
					const closestName = (r17.data.closestName as string) ?? 'School';
					const within200 = (r17.data.within200ft as number) ?? 0;
					siq = Math.max(5, siq - 15);
					locationIQ = Math.min(30, locationIQ);
					signals.push({
						layer: 'SIQ',
						type: 'negative',
						message: `🚫 SLA 200-ft BLOCK: ${closestName} is ${distFt} ft away — liquor license is IMPOSSIBLE at this location. Zero exceptions. ${within200} school(s) within 200 ft.`
					});
				} else if (report.schools.within200ft === 0) {
					signals.push({
						layer: 'SIQ',
						type: 'positive',
						message: `SLA 200-ft school check CLEAR: no schools within 200 ft (closest: ${report.schools.closestSchool ? Math.round(report.schools.closestSchool.distanceMeters * 3.281) + ' ft' : 'none nearby'}). Church proximity still requires manual verification.`
					});
				}
			} else {
				// No school data available — fall back to advisory (unchanged).
				signals.push({
					layer: 'SIQ',
					type: 'info',
					message: `MUST VERIFY: NYS SLA 200-ft rule — if a school or church entrance is within 200 ft on the same street, liquor license is BLOCKED with zero exceptions. Confirm with SLA before signing a lease.`
				});
			}

			// Recalculate locationIQ with updated SIQ (use same weight fn as composite)
			const r17w = getWeights(businessType);
			const r17Composite = Math.round(niq * r17w.niq + siq * r17w.siq + tiq * r17w.tiq + liq * r17w.liq);
			locationIQ = Math.max(5, Math.min(locationIQ, r17Composite));
		}
	}

	// ══════════════════════════════════════════════════════════════════════
	// 25 VITAL RULES — Phase 3 (Document 09: Business Intelligence KB)
	// Per-concept location rules derived from 100+ trade-publication sources.
	// ══════════════════════════════════════════════════════════════════════

	// B3-2.2: D09 trace hook — dev-only log of which rules fire per scoring run.
	// Every D09 rule block uses signals.push with a message starting with the
	// rule number or clear context; we tap into that by tracking signal deltas.
	// To avoid touching all 17 rule blocks, we snapshot signals.length before
	// the rule section and log the added D09 signals at the end.
	const _d09SignalsBefore = signals.length;
	const _d09Concept = concept;

	// ── RULE D09-1: Concept-Specific Clustering Thresholds ──
	// Doc 09 provides exact saturation points per concept (replaces generic Rule 15 buckets for covered types).
	{
		const nearby = report.competitors
			? (report.competitors.rings?.ring1?.length || 0) + (report.competitors.rings?.ring2?.length || 0)
			: 0;

		const CLUSTER_RULES: Partial<Record<ConceptType, { positive: number; saturation: number; effect: 'positive' | 'negative' | 'mixed' }>> = {
			// Coffee Scoring Rewire (D3): saturation=2 is Ring 1 (100m) threshold.
			// dynamic-concept-config.ts saturation=8 is full trade area (400m).
			// Both coexist — this fires on immediate neighbors, that on broader market.
			specialty_coffee: { positive: 0, saturation: 2, effect: 'negative' },       // coffee: 2 before saturation
			full_service_restaurant: { positive: 3, saturation: 8, effect: 'mixed' },           // dining district 3-8
			bar_nightlife: { positive: 3, saturation: 6, effect: 'mixed' },           // nightlife district 3-6
			retail: { positive: 3, saturation: 99, effect: 'positive' },        // retail: 5+ helps (comparison shopping)
			personal_services: { positive: 0, saturation: 3, effect: 'negative' },        // salons: 3 before saturation
			fitness_studio: { positive: 0, saturation: 1, effect: 'negative' },         // same-modality: 1 before price war
			medical_office: { positive: 0, saturation: 2, effect: 'negative' },         // med spa: 2 before competition
		};

		const rule = CLUSTER_RULES[concept];
		if (rule && nearby > 0) {
			if (rule.effect === 'negative' && nearby > rule.saturation) {
				const penalty = concept === 'fitness_studio' ? -10 : -6;
				tiq = Math.max(5, tiq + penalty);
				signals.push({
					layer: 'TIQ', type: 'negative',
					message: `${nearby} ${BUSINESS_TYPE_CONFIGS[concept].label} competitors nearby — exceeds saturation threshold of ${rule.saturation} (${penalty} pts). Differentiation critical.`
				});
			} else if (rule.effect === 'mixed') {
				// Already handled by Rule 15 above — D09-1 validates the thresholds
			}
		}
	}

	// ── RULE D09-2: Med Spa Income Floor ──
	// Med spa treatments are $200-$1,500/visit — discretionary luxury.
	// If median income <$60K, the market is too thin.
	if (concept === 'medical_office' && report.census) {
		const medIncome = report.census.medianHouseholdIncome || 0;
		if (medIncome > 0 && medIncome < 60000) {
			niq = Math.max(5, niq - 15);
			locationIQ = Math.max(5, locationIQ - 15);
			signals.push({
				layer: 'NIQ', type: 'negative',
				message: `Median income $${(medIncome / 1000).toFixed(0)}K is below $60K — med spa treatments ($200-$1,500/visit) are discretionary luxury; market too thin (-15 pts)`
			});
		}
	}

	// ── RULE D09-3: Second-Generation Space Bonus ──
	// If previous tenant ran the same type of business and space hasn't been vacant >12 months,
	// buildout savings are massive ($200K-$1M for restaurants). Bonus to SIQ.
	{
		const inspections = report.inspections as any;
		const prevTenantType = inspections?.previousTenantType || (report as any).previousTenantType;
		const vacantMonths = (report as any).vacantMonths ?? inspections?.vacantMonths;
		if (prevTenantType) {
			const prevConcept = resolveConceptType(prevTenantType);
			const isMatch = prevConcept === concept;
			const isRecentVacancy = vacantMonths == null || vacantMonths < 12;
			if (isMatch && isRecentVacancy) {
				siq = Math.min(98, siq + 10);
				signals.push({
					layer: 'SIQ', type: 'positive',
					message: `Second-generation space: previous tenant was same business type — saves $200K+ in buildout (exhaust hood, grease trap, plumbing already in place, +10 SIQ)`
				});
			} else if (!isMatch && prevTenantType) {
				signals.push({
					layer: 'SIQ', type: 'info',
					message: `Change of use required: previous tenant was ${prevTenantType}. Expect $5K-$50K+ in conversion costs and 6-18 months for new Certificate of Occupancy.`
				});
			}
		}
	}

	// ── RULE D09-4: Sidewalk Cafe Revenue Bonus ──
	// Sidewalk cafe eligibility adds 15-25% revenue for restaurants. Boost SIQ.
	{
		const FB_ELIGIBLE: ConceptType[] = ['full_service_restaurant', 'specialty_coffee', 'bar_nightlife', 'qsr'];
		if (FB_ELIGIBLE.includes(concept) && report.sidewalkCafes) {
			// Check if this specific location might be eligible (active permits on block = good sign)
			const activeNearby = report.sidewalkCafes.activeCount ?? 0;
			if (activeNearby > 0) {
				siq = Math.min(98, siq + 5);
				signals.push({
					layer: 'SIQ', type: 'positive',
					message: `Sidewalk cafe corridor (${activeNearby} active permits on block) — outdoor dining can add 15-25% revenue (+5 SIQ)`
				});
			}
		}
	}

	// ── RULE D09-5: Noise Complaint Risk for Nightlife ──
	// Bars/nightlife with residential above face noise complaint risk.
	if (concept === 'bar_nightlife' && report.complaints311) {
		const complaints = report.complaints311 as any;
		const noiseCount = complaints.noiseComplaints ?? complaints.totalComplaints ?? 0;
		if (noiseCount > 15) {
			siq = Math.max(5, siq - 8);
			signals.push({
				layer: 'SIQ', type: 'negative',
				message: `High noise complaint area (${noiseCount} recent 311 complaints) — residential neighbors likely above; expect Community Board pushback (-8 SIQ)`
			});
		}
	}

	// ── RULE D09-6: Anchor Proximity by Concept ──
	// Coffee near university/hospital/transit hub = captive repeat audience (+8).
	// Florist near event venues = revenue pipeline (+8).
	// Bakery near office buildings = corporate catering pipeline (+5).
	{
		const places = (report as any).places || (report as any).googlePlaces;
		if (places && Array.isArray(places)) {
			const placeTypes = new Set(places.flatMap((p: any) => p.types || []));

			// Coffee/bakery near university or hospital
			if (['specialty_coffee', 'qsr'].includes(concept)) {
				const hasAnchor = placeTypes.has('university') || placeTypes.has('hospital') ||
					placeTypes.has('school') || placeTypes.has('train_station') || placeTypes.has('subway_station');
				if (hasAnchor) {
					niq = Math.min(98, niq + 8);
					signals.push({
						layer: 'NIQ', type: 'positive',
						message: `Near university, hospital, or major transit hub — captive repeat audience for ${BUSINESS_TYPE_CONFIGS[concept].label} (+8 NIQ)`
					});
				}
			}

			// Fitness near transit
			if (concept === 'fitness_studio') {
				const nearTransit = placeTypes.has('train_station') || placeTypes.has('subway_station') || placeTypes.has('transit_station');
				if (nearTransit) {
					niq = Math.min(98, niq + 6);
					signals.push({
						layer: 'NIQ', type: 'positive',
						message: `Transit-adjacent fitness — commuters can work out before/after work (+6 NIQ)`
					});
				}
			}
		}
	}

	// ── RULE D09-7: Office-Dependent Weekday-Only Risk ──
	// Coffee shops in office districts lose 40%+ revenue on weekends.
	// Already partially covered by Rule 12, but D09 adds concept-specific penalty.
	if (['specialty_coffee', 'qsr'].includes(concept) && report.census) {
		const daytimeRatio = report.census.daytimePopulationRatio ?? 1.0;
		if (daytimeRatio > 2.0 && boroughName === 'Manhattan') {
			niq = Math.max(5, niq - 8);
			signals.push({
				layer: 'NIQ', type: 'negative',
				message: `Weekday-only risk: office district (daytime ratio ${daytimeRatio.toFixed(1)}x) — ${BUSINESS_TYPE_CONFIGS[concept].label} revenue drops 40%+ on weekends (-8 NIQ)`
			});
		}
	}

	// ── RULE D09-8: Walk Score Hard Floor for Impulse Concepts ──
	// Coffee shops depend on pedestrian impulse traffic. Walk Score <70 is a serious problem.
	if (['specialty_coffee', 'retail'].includes(concept) && report.walkScore) {
		const ws = report.walkScore.walkScore || 50;
		if (ws < 70) {
			niq = Math.max(5, niq - 12);
			signals.push({
				layer: 'NIQ', type: 'negative',
				message: `Walk Score ${ws} is below 70 — ${BUSINESS_TYPE_CONFIGS[concept].label} depends on pedestrian impulse traffic. Low walkability is a structural disadvantage (-12 NIQ)`
			});
		}
	}

	// ── RULE D09-9: Residential Density Bonus for Neighborhood Concepts ──
	// Salons, barbershops, diners thrive on dense residential repeat clients.
	if (['personal_services', 'qsr'].includes(concept) && report.census) {
		const pop = report.census.totalPopulation || 0;
		if (pop > 10000) {
			niq = Math.min(98, niq + 5);
			signals.push({
				layer: 'NIQ', type: 'positive',
				message: `Dense residential catchment (${pop.toLocaleString()} population) — ${BUSINESS_TYPE_CONFIGS[concept].label} thrives on repeat local clients (+5 NIQ)`
			});
		}
	}

	// ── RULE D09-10: Grocery Anti-Clustering ──
	// Grocery is NEGATIVE clustering — even 1 competitor within 500ft is a price war.
	if (concept === 'retail' && report.competitors) {
		const nearby = (report.competitors.rings?.ring1?.length || 0);
		// Check if this is a grocery concept (retail archetype but convenience goods)
		const isGrocery = /grocery|bodega|market|food.*store/i.test(businessType);
		if (isGrocery && nearby >= 1) {
			tiq = Math.max(5, tiq - 10);
			signals.push({
				layer: 'TIQ', type: 'negative',
				message: `Grocery has NEGATIVE clustering — ${nearby} competitor(s) within immediate radius means price war. Homogeneous products + proximity = margin destruction (-10 TIQ)`
			});
		}
	}

	// ── RULE D09-11: Florist Income Floor + Event Venue Proximity ──
	// Florists depend on discretionary spending — income floor $80K.
	// Nearby event venues (hotels, wedding venues) = revenue pipeline.
	{
		const isFlorist = /florist|flower/i.test(businessType);
		if (isFlorist && report.census) {
			const medIncome = report.census.medianHouseholdIncome || 0;
			if (medIncome > 0 && medIncome < 80000) {
				niq = Math.max(5, niq - 10);
				signals.push({
					layer: 'NIQ', type: 'negative',
					message: `Median income $${(medIncome / 1000).toFixed(0)}K is below $80K — flowers/gifts are discretionary; foot traffic alone won't sustain (-10 NIQ)`
				});
			}
		}
		if (isFlorist) {
			const places = (report as any).places || (report as any).googlePlaces;
			if (places && Array.isArray(places)) {
				const venueTypes = new Set(places.flatMap((p: any) => p.types || []));
				const hasEventVenues = venueTypes.has('lodging') || venueTypes.has('hotel') ||
					venueTypes.has('event_venue') || venueTypes.has('wedding_hall') || venueTypes.has('church');
				if (hasEventVenues) {
					niq = Math.min(98, niq + 8);
					signals.push({
						layer: 'NIQ', type: 'positive',
						message: `Near event venues (hotels, churches, event spaces) — wedding/event revenue pipeline ($3K-$15K/event) +8 NIQ`
					});
				}
			}
		}
	}

	// ── RULE D09-12: Grocery Food Desert Bonus ──
	// Underserved areas with no full-service grocery get a major boost.
	// SNAP/EBT population >30% requires acceptance for viability.
	{
		const isGrocery = /grocery|bodega|market|food.*store/i.test(businessType);
		if (isGrocery && report.competitors) {
			const nearby = (report.competitors.rings?.ring1?.length || 0) + (report.competitors.rings?.ring2?.length || 0);
			// Food desert = no grocery competitors at all — huge opportunity
			if (nearby === 0) {
				tiq = Math.min(98, tiq + 12);
				niq = Math.min(98, niq + 5);
				signals.push({
					layer: 'TIQ', type: 'positive',
					message: `No competing grocery within radius — potential food desert / underserved area. Essential service creates community loyalty (+12 TIQ, +5 NIQ)`
				});
			}
		}
	}

	// ── RULE D09-13: Bakery Morning Commute + Office Catering ──
	// Bakeries thrive on morning commute impulse and office catering pipelines.
	{
		const isBakery = /bakery|bake/i.test(businessType) || concept === 'specialty_coffee';
		if (isBakery && concept !== 'specialty_coffee') {
			// Already handled coffee above; this is bakery-specific
			const places = (report as any).places || (report as any).googlePlaces;
			if (places && Array.isArray(places)) {
				const placeTypes = new Set(places.flatMap((p: any) => p.types || []));
				const nearOffice = placeTypes.has('office') || placeTypes.has('corporate') ||
					placeTypes.has('finance') || placeTypes.has('accounting');
				if (nearOffice) {
					niq = Math.min(98, niq + 5);
					signals.push({
						layer: 'NIQ', type: 'positive',
						message: `Near office buildings — corporate catering pipeline potential ($500-$2K/week per account) +5 NIQ`
					});
				}
			}
			// Morning commute bonus via transit proximity
			if (report.census) {
				const daytimeRatio = report.census.daytimePopulationRatio ?? 1.0;
				if (daytimeRatio > 1.3) {
					signals.push({
						layer: 'NIQ', type: 'info',
						message: `Morning commute area (daytime ratio ${daytimeRatio.toFixed(1)}x) — bakery + coffee combo thrives on commute impulse`
					});
				}
			}
		}
	}

	// ── RULE D09-14: Retail Corner Location + Neighborhood Identity ──
	// Corner locations give 2-street visibility (+10 for retail).
	// Neighborhoods with strong identity (arts, ethnic, luxury) boost boutiques.
	if (concept === 'retail') {
		const places = (report as any).places || (report as any).googlePlaces;
		if (places && Array.isArray(places)) {
			const placeTypes = new Set(places.flatMap((p: any) => p.types || []));
			// Art galleries, museums, cultural landmarks = neighborhood identity
			const hasIdentity = placeTypes.has('art_gallery') || placeTypes.has('museum') ||
				placeTypes.has('tourist_attraction') || placeTypes.has('cultural_center');
			if (hasIdentity) {
				niq = Math.min(98, niq + 5);
				signals.push({
					layer: 'NIQ', type: 'positive',
					message: `Neighborhood has cultural identity (galleries, museums, landmarks) — boutiques thrive in areas with foot-traffic-drawing character (+5 NIQ)`
				});
			}
		}
	}

	// ── RULE D09-15: Fitness Residential Density + Parking ──
	// Dense residential = recurring membership base (+10 for >15K in half mile).
	// Parking matters more for gyms than other small businesses.
	if (concept === 'fitness_studio' && report.census) {
		const pop = report.census.totalPopulation || 0;
		if (pop > 15000) {
			niq = Math.min(98, niq + 10);
			signals.push({
				layer: 'NIQ', type: 'positive',
				message: `Dense residential catchment (${pop.toLocaleString()} population) — recurring membership base for fitness (+10 NIQ)`
			});
		}
	}

	// ── RULE D09-16: Salon/Barbershop Residential Density ──
	// Neighborhood salons thrive on repeat local clients (>8K in quarter mile = +8).
	if (concept === 'personal_services' && report.census) {
		const pop = report.census.totalPopulation || 0;
		if (pop > 8000 && pop <= 10000) {
			// D09-9 already covers >10K; this catches the 8K-10K band
			niq = Math.min(98, niq + 4);
			signals.push({
				layer: 'NIQ', type: 'positive',
				message: `Residential density (${pop.toLocaleString()}) supports neighborhood salon model — repeat local clients (+4 NIQ)`
			});
		}
	}

	// ── RULE D09-17: Med Spa Luxury Corridor + Specialist Competition ──
	// Near luxury retail = affluent foot traffic aligns with med spa clientele (+8).
	// Nearby dermatologists/plastic surgeons = licensed physicians with broader scope (-8 TIQ).
	if (concept === 'medical_office') {
		const places = (report as any).places || (report as any).googlePlaces;
		if (places && Array.isArray(places)) {
			const placeTypes = new Set(places.flatMap((p: any) => p.types || []));
			const placeNames = places.map((p: any) => (p.name || '').toLowerCase()).join(' ');

			const nearLuxury = placeTypes.has('jewelry_store') || placeTypes.has('clothing_store') ||
				placeTypes.has('department_store') || placeTypes.has('shopping_mall');
			if (nearLuxury) {
				niq = Math.min(98, niq + 8);
				signals.push({
					layer: 'NIQ', type: 'positive',
					message: `Near luxury retail corridor — affluent foot traffic aligns with med spa clientele (+8 NIQ)`
				});
			}

			const hasMedCompetition = /dermatolog|plastic.surg|cosmetic.surg|derm\b/i.test(placeNames);
			if (hasMedCompetition) {
				tiq = Math.max(5, tiq - 8);
				signals.push({
					layer: 'TIQ', type: 'negative',
					message: `Nearby dermatologists or plastic surgeons — licensed physicians with broader scope compete for same clients (-8 TIQ)`
				});
			}
		}
	}

	// B3-2.2: D09 trace — emit a summary of which rules fired for this run.
	// Dev-only (gated by import.meta.env.DEV) so production logs are unaffected.
	if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
		const d09Fired = signals.slice(_d09SignalsBefore);
		if (d09Fired.length > 0) {
			console.debug(
				`[D09 TRACE] concept=${_d09Concept} rulesFired=${d09Fired.length}`,
				d09Fired.map(s => ({ layer: s.layer, type: s.type, msg: s.message.slice(0, 80) }))
			);
		}
	}

	// ══════════════════════════════════════════════════════════════════════
	// UNIVERSAL CROSS-CUTTING RULES (Apply to ALL business types)
	// ══════════════════════════════════════════════════════════════════════

	// ── RULE UNI-1: Good Guy Guarantee Advisory ──
	// NYC market standard — full personal guarantee without GGG = excessive risk.
	if (boroughName) {
		signals.push({
			layer: 'LIQ', type: 'info',
			message: `NYC lease advisory: negotiate a Good Guy Guarantee — it's market standard and limits personal liability to the lease term. Full personal guarantee without GGG = excessive risk.`
		});
	}

	// ── RULE UNI-2: ADA Compliance Flag for Old Buildings ──
	// Buildings >30 years with no recent renovation likely need ADA upgrades (20% of renovation budget).
	{
		const places = (report as any).places || (report as any).googlePlaces;
		const dofProfile = (report as any).dof?.buildingProfile || (report as any).buildingProfile;
		const yearBuilt = dofProfile?.avgYearBuilt || 0;
		const currentYear = new Date().getFullYear();
		if (yearBuilt > 0 && (currentYear - yearBuilt) > 30) {
			const buildingAge = currentYear - yearBuilt;
			signals.push({
				layer: 'SIQ', type: 'info',
				message: `Building is ~${buildingAge} years old — budget for ADA compliance upgrades (typically 20% of renovation budget). Pre-1990 buildings almost always need ramp, restroom, and egress updates.`
			});
		}
	}

	// ── VITAL RULE 3: Revenue-per-SF Floor ──
	// Retrofit (BR-L): verdict comes from RULES[3].check(). Location IQ cap at
	// 35 and the signal push stay here — per Kalpna's Q1, the cap is preserved
	// even after BR-M adds Fit IQ + BC P&L consumers.
	{
		const r3 = VITAL_RULES[3].check({ businessType, concept });
		if (!r3.passes) {
			const impliedRevPerSF = (r3.data.impliedRevPerSF as number) ?? 0;
			const floor = (r3.data.floor as number) ?? 150;
			locationIQ = Math.min(locationIQ, 35);
			signals.push({
				layer: 'LIQ', type: 'negative',
				message: `Revenue-per-SF floor fail: implied $${impliedRevPerSF}/SF vs minimum $${floor}/SF for this concept. Economics may not work at this density.`
			});
		}
	}

	// ── VITAL RULE 2: Rent Escalation Stress Test ──
	// Retrofit (BR-L): verdict delegated to RULES[2].check(). Adapter still
	// owns the LIQ -4 penalty + signal push so scoring output is unchanged.
	{
		const r2 = VITAL_RULES[2].check({ businessType, concept });
		if (!r2.passes) {
			const year3PctDisplay = (r2.data.year3RentPctDisplay as number) ?? 0;
			const ceilingPct = (r2.data.ceilingPct as number) ?? 0;
			const ceilingNote = (r2.data.ceilingNote as string) ?? '';
			signals.push({
				layer: 'LIQ', type: 'warning',
				message: `Rent escalation risk: at 3%/yr, rent reaches ~${year3PctDisplay}% of revenue by Year 3, exceeding the ${ceilingPct}% ceiling for this concept. ${ceilingNote}.`
			});
			// Modest penalty — this is a warning, not a hard cap.
			locationIQ = Math.max(5, locationIQ - 4);
		}
	}

	// ── RULE UNI-3: Total Occupancy Cost Check ──
	// Base rent + CRT (Manhattan below 96th) + BID assessment + CAM + insurance vs ceiling.
	// NOTE: Actual rent data comes from user Vision IQ inputs — this is an advisory signal.
	{
		const isManhattanBelow96 = boroughName === 'Manhattan'; // Simplified — CRT applies below 96th
		if (isManhattanBelow96) {
			signals.push({
				layer: 'LIQ', type: 'info',
				message: `Manhattan Commercial Rent Tax (CRT) applies to ground-floor spaces below 96th St with annual rent >$250K (3.9% of excess). Factor into total occupancy cost calculation.`
			});
		}
	}

	// ── RULE UNI-4: Change of Use Cost/Timeline Advisory ──
	// Already partially in D09-3 (second-gen bonus). This adds the inverse: if no previous-tenant match,
	// flag the C of O timeline (6-18 months) as a cost/delay factor.
	// (D09-3 handles both cases — this is a documentation anchor)

	// Recalculate composite after Phase 3 + universal rules
	{
		const p3w = getWeights(businessType);
		const p3Composite = Math.round(niq * p3w.niq + siq * p3w.siq + tiq * p3w.tiq + liq * p3w.liq);
		locationIQ = expandVariance(p3Composite, 1.55, dataFraction);
	}

	// Re-clamp after all vital rules
	locationIQ = Math.max(5, Math.min(98, locationIQ));

	// ══════════════════════════════════════════════════════════════════════
	// END VITAL RULES — Phase 1 + 2 + Rule 17 + Phase 3 (Doc 09) + Universal
	// ══════════════════════════════════════════════════════════════════════

	// ── SIGNAL AGREEMENT INDICATOR ──
	// When 3+ pillars agree directionally, the composite is high-confidence.
	// When they diverge, flag the mixed signal so the user knows.
	{
		const pillars = [
			{ name: 'Neighborhood', score: niq },
			{ name: 'Site', score: siq },
			{ name: 'Trade Area', score: tiq },
			{ name: 'Lease', score: liq },
		];
		const strong = pillars.filter(p => p.score >= 65);
		const weak = pillars.filter(p => p.score < 40);

		if (strong.length >= 3) {
			const names = strong.map(p => p.name).join(', ');
			signals.push({
				layer: 'COMPOSITE', type: 'positive',
				message: `Strong consensus: ${strong.length} of 4 dimensions score well (${names}) — high-confidence result`
			});
		} else if (weak.length >= 3) {
			const names = weak.map(p => p.name).join(', ');
			signals.push({
				layer: 'COMPOSITE', type: 'negative',
				message: `Consistent concern: ${weak.length} of 4 dimensions flag risk (${names}) — location faces structural challenges`
			});
		} else if (strong.length >= 1 && weak.length >= 1) {
			const best = strong.map(p => p.name).join(', ');
			const worst = weak.map(p => p.name).join(', ');
			signals.push({
				layer: 'COMPOSITE', type: 'neutral',
				message: `Mixed signals: strong on ${best} but weak on ${worst} — dig into the specifics before deciding`
			});
		}
	}

	// Confidence based on data completeness
	const confidence = Math.round((availableSources / totalSources) * 100);

	return {
		niq: clamp(niq),
		siq: clamp(siq),
		tiq: clamp(tiq),
		liq: clamp(liq),
		locationIQ: clamp(locationIQ),
		confidence,
		grade: scoreToGrade(locationIQ),
		breakdown: { niq: niqBreakdown, siq: siqBreakdown, tiq: tiqBreakdown },
		signals,
		dataCompleteness: {
			available: availableSources,
			total: totalSources,
			missing,
			percentage: confidence
		}
	};
}

// ─────────────────────────────────────────────────
// NIQ: Neighborhood IQ
// ─────────────────────────────────────────────────

function computeNIQ(
	r: LocationIntelReport,
	_businessType: string,
	signals: IQSignal[]
): IQBreakdown['niq'] {
	// Population score (from Census + Census Housing)
	let population = 50; // default
	if (r.census) {
		const c = r.census;
		// NYC-calibrated: national scoreLinear(30k–150k) calls UWS ($181K) "average". Use NYC ranges.
		// NYC median HHI ~$70K. Top decile: $200K+. Bottom decile: <$25K.
		function scoreIncomeNYC(annualHHI: number): number {
			if (annualHHI <= 0) return 0;
			if (annualHHI < 35_000) return Math.round((annualHHI / 35_000) * 25);
			if (annualHHI < 70_000) return Math.round(25 + ((annualHHI - 35_000) / 35_000) * 25);
			if (annualHHI < 120_000) return Math.round(50 + ((annualHHI - 70_000) / 50_000) * 25);
			if (annualHHI < 200_000) return Math.round(75 + ((annualHHI - 120_000) / 80_000) * 20);
			return 95 + Math.min(5, Math.round((annualHHI - 200_000) / 40_000));
		}
		const incomeScore = scoreIncomeNYC(c.medianHouseholdIncome || 0);
		const ageScore = scoreLinear(c.medianAge || 30, 20, 50, true);
		// FIX: Use populationDensity (per sq mi) instead of totalPopulation — same fix as six-index.ts
		const popDensity = scoreLinear(c.populationDensity || 0, 5000, 70000);
		const educScore = scoreLinear(c.bachelorsPlusPercent || 0, 10, 70);
		population = Math.round(incomeScore * 0.40 + ageScore * 0.15 + popDensity * 0.25 + educScore * 0.20);

		if (incomeScore > 70) signals.push({ layer: 'NIQ', type: 'positive', message: `Median income $${((c.medianHouseholdIncome || 0) / 1000).toFixed(0)}K supports spending power` });
		if (incomeScore < 40) signals.push({ layer: 'NIQ', type: 'negative', message: `Lower median income ($${((c.medianHouseholdIncome || 0) / 1000).toFixed(0)}K) may limit average ticket` });
		if (educScore > 70) signals.push({ layer: 'NIQ', type: 'positive', message: `${c.bachelorsPlusPercent}% college-educated — receptive to specialty concepts` });
	}
	// Enrich population score with housing affordability data
	if (r.censusHousing) {
		const h = r.censusHousing;
		// High rent burden means less disposable income for discretionary spending
		if (h.rentBurdenedPct > 50) {
			population = Math.round(population * 0.85);
			signals.push({ layer: 'NIQ', type: 'negative', message: `${h.rentBurdenedPct}% rent-burdened — less disposable income for discretionary spending` });
		}
		// Low vacancy = stable demand; high vacancy = struggling area
		if (h.vacancyRate > 15) {
			population = Math.round(population * 0.90);
			signals.push({ layer: 'NIQ', type: 'negative', message: `${h.vacancyRate}% housing vacancy — possible population decline` });
		} else if (h.vacancyRate < 5) {
			population = Math.round(population * 1.05);
			signals.push({ layer: 'NIQ', type: 'positive', message: `Only ${h.vacancyRate}% vacancy — strong housing demand, stable neighborhood` });
		}
	}

	// Lifecycle score (from DCA licenses — new business rate)
	let lifecycle = 50;
	if (r.dcaLicenses) {
		const newRate = r.dcaLicenses.newBusinessRate;
		// 10-25% is healthy, too low = stagnant, too high = churn
		if (newRate >= 10 && newRate <= 25) lifecycle = 80;
		else if (newRate > 25) lifecycle = 55; // churn
		else lifecycle = 35; // stagnant

		const diversity = r.dcaLicenses.industryBreakdown.length;
		lifecycle += Math.min(15, diversity * 2);

		if (newRate > 25) signals.push({ layer: 'NIQ', type: 'negative', message: `High business turnover (${newRate}% new in 12mo) — market may be volatile` });
		if (newRate >= 10 && newRate <= 25) signals.push({ layer: 'NIQ', type: 'positive', message: `Healthy business turnover (${newRate}% new businesses) — active market` });
	}

	// Business ecosystem score (from DCA + sidewalk cafes + liquor licenses)
	let businessEcosystem = 50;
	if (r.dcaLicenses) {
		businessEcosystem = r.dcaLicenses.ecosystemScore;
		if (businessEcosystem > 70) signals.push({ layer: 'NIQ', type: 'positive', message: `${r.dcaLicenses.totalCount} active licensed businesses — thriving ecosystem` });
	}
	// Enrich ecosystem with vibrancy signals
	if (r.sidewalkCafes) {
		const cafes = r.sidewalkCafes;
		if (cafes.activeCount > 3) {
			businessEcosystem = Math.round(businessEcosystem * 1.08);
			signals.push({ layer: 'NIQ', type: 'positive', message: `${cafes.activeCount} sidewalk café permits, ${cafes.totalSeatingCapacity} outdoor seats — vibrant street life` });
		} else if (cafes.activeCount === 0) {
			signals.push({ layer: 'NIQ', type: 'neutral', message: 'No sidewalk café permits — limited outdoor dining culture' });
		}
	}
	if (r.liquorLicenses) {
		const liq = r.liquorLicenses;
		if (liq.totalCount > 10) {
			businessEcosystem = Math.round(businessEcosystem * 1.05);
			signals.push({ layer: 'NIQ', type: 'positive', message: `${liq.totalCount} liquor licenses (${liq.onPremiseCount} bars/restaurants) — active nightlife corridor` });
		}
		if (liq.nightlifeDensity > 70) {
			signals.push({ layer: 'NIQ', type: 'positive', message: `High nightlife density (${liq.nightlifeDensity}/100) — evening foot traffic advantage` });
		}
	}

	// Disruption score (from DOB + 311)
	let disruption = 70; // default = low disruption = good
	if (r.dob) {
		// Invert risk: low violations = high score
		disruption = Math.max(20, 100 - r.dob.riskScore);
		// But active development is mixed — positive long-term, disruptive short-term
		if (r.dob.newBuildingCount > 2) {
			signals.push({ layer: 'NIQ', type: 'neutral', message: `${r.dob.newBuildingCount} new building permits — area is developing but may face construction disruption` });
		}
		if (r.dob.activeViolationCount > 5) {
			signals.push({ layer: 'NIQ', type: 'negative', message: `${r.dob.activeViolationCount} active DOB violations nearby — building risk elevated` });
			disruption -= 10;
		}
	}
	if (r.complaints311) {
		// Quality of life adjusts disruption
		const qol = r.complaints311.qualityScore;
		disruption = Math.round(disruption * 0.6 + qol * 0.4);
		if (r.complaints311.noiseCount > 20) {
			signals.push({ layer: 'NIQ', type: 'negative', message: `${r.complaints311.noiseCount} noise complaints in 3mo — could impact customer experience` });
		}
	}

	// Transit score (from MTA + pedestrian)
	// Borough-aware floor — from canonical BOROUGH_BOUNDS in geography.ts.
	// Manhattan floor 72: dense subway grid; Bronx 55; Brooklyn 52; Queens 50; SI 30.
	let transit = _getBoroughTransitFloor(r.lat ?? 40.75, r.lng ?? -73.98);
	if (r.mtaRidership) {
		transit = r.mtaRidership.transitScore;
		// INF-05 (corrected): Data quality affects confidence, not the score.
		// The score reflects what the data says — confidence reflects how much to trust it.
		// Penalty moved to confidence.ts. No score deduction here.
		if (transit > TRANSIT_THRESHOLDS.positiveSignalFloor) signals.push({ layer: 'NIQ', type: 'positive', message: `${r.mtaRidership.stationCount} subway stations, ${(r.mtaRidership.totalDailyRidership / 1000).toFixed(0)}K daily riders — excellent transit access` });
	}
	if (r.pedestrian) {
		// Blend pedestrian data with transit
		const pedScore = r.pedestrian.footTrafficScore;
		transit = Math.round(transit * 0.6 + pedScore * 0.4);
		if (pedScore > 70) signals.push({ layer: 'NIQ', type: 'positive', message: `High verified foot traffic: ${r.pedestrian.totalPedestrians.toLocaleString()} pedestrians counted at ${r.pedestrian.countLocationCount} DOT points` });
	}

	return {
		population: clamp(population),
		lifecycle: clamp(lifecycle),
		businessEcosystem: clamp(businessEcosystem),
		disruption: clamp(disruption),
		transit: clamp(transit)
	};
}

// ─────────────────────────────────────────────────
// SIQ: Storefront IQ
// ─────────────────────────────────────────────────

function computeSIQ(
	r: LocationIntelReport,
	_businessType: string,
	signals: IQSignal[]
): IQBreakdown['siq'] {
	// Walkability (from WalkScore API)
	let walkability = 50;
	if (r.walkScore) {
		walkability = r.walkScore.walkScore || 50;
		if (r.walkScore.transitScore && r.walkScore.transitScore > 70) {
			walkability = Math.round(walkability * 0.7 + r.walkScore.transitScore * 0.3);
		}
		if (walkability > 80) signals.push({ layer: 'SIQ', type: 'positive', message: `Walk Score ${r.walkScore.walkScore} — highly walkable location` });
	}

	// Competitors (from Overpass + Places)
	let competitors = 50;
	if (r.competitors) {
		const rings = r.competitors.rings;
		// Ideal: some competitors (validates market) but not too many
		const nearby = rings?.ring1?.length || 0;
		const mid = rings?.ring2?.length || 0;
		const total = nearby + mid;

		if (total === 0) competitors = 40; // unproven
		else if (total <= 3) competitors = 85; // sweet spot
		else if (total <= 8) competitors = 65; // moderate
		else competitors = Math.max(25, 65 - (total - 8) * 5); // saturating

		if (total === 0) signals.push({ layer: 'SIQ', type: 'neutral', message: 'No direct competitors detected — unproven market or niche opportunity' });
		else if (total > 8) signals.push({ layer: 'SIQ', type: 'negative', message: `${total} competitors within 800m — saturated, differentiation critical` });
	}
	// Enrich competition analysis with Foursquare data
	if (r.foursquare) {
		const fsq = r.foursquare;
		// Foursquare direct competitor count cross-references Overpass
		if (fsq.directCompetitors.length > 0) {
			// High popularity among competitors = proven demand
			if (fsq.avgPopularity > 0.6) {
				competitors = Math.round(competitors * 1.08);
				signals.push({ layer: 'SIQ', type: 'positive', message: `High venue popularity (${(fsq.avgPopularity * 100).toFixed(0)}%) — proven customer demand in area` });
			}
			// Category diversity from Foursquare's 900+ taxonomy
			if (fsq.categoryDiversity > 15) {
				signals.push({ layer: 'SIQ', type: 'positive', message: `${fsq.categoryDiversity} business categories nearby (Foursquare) — diverse commercial ecosystem` });
			}
		}
		// Chain dominance from Foursquare (more reliable than OSM for chains)
		if (fsq.chainCount > 0 && fsq.independentCount > 0) {
			const chainPct = Math.round((fsq.chainCount / (fsq.chainCount + fsq.independentCount)) * 100);
			if (chainPct > 60) {
				signals.push({ layer: 'SIQ', type: 'positive', message: `${chainPct}% chain venues — opportunity for independent differentiation` });
			}
		}
	}

	// Building risk (from DOB violations + PLUTO zoning/FAR data)
	let buildingRisk = 70; // default = low risk = good
	if (r.dob) {
		buildingRisk = Math.max(15, 100 - r.dob.riskScore);
		if (r.dob.riskScore > 50) signals.push({ layer: 'SIQ', type: 'negative', message: `High building risk score (${r.dob.riskScore}/100) — inspect thoroughly before signing lease` });
	}
	if (r.pluto) {
		const p = r.pluto;
		// Zoning compatibility — commercial/mixed zones are better for retail
		const zone = p.zoneProfile;
		const commercialFriendly = zone.commercialPct + zone.mixedUsePct;
		if (commercialFriendly > 50) {
			buildingRisk = Math.round(buildingRisk * 1.1);
			signals.push({ layer: 'SIQ', type: 'positive', message: `${commercialFriendly}% commercial/mixed zoning — favorable for retail` });
		} else if (commercialFriendly < 20) {
			buildingRisk = Math.round(buildingRisk * 0.8);
			signals.push({ layer: 'SIQ', type: 'negative', message: `Only ${commercialFriendly}% commercial zoning — check use-group restrictions` });
		}
		// Retail square footage signals supply
		if (p.buildingProfile.totalRetailSqFt > 50000) {
			signals.push({ layer: 'SIQ', type: 'positive', message: `${(p.buildingProfile.totalRetailSqFt / 1000).toFixed(0)}K sq ft of retail nearby — established retail corridor` });
		}
		// Development potential
		if (p.developmentPotential > 70) {
			signals.push({ layer: 'SIQ', type: 'positive', message: `High development potential (${p.developmentPotential}/100) — area likely to grow` });
		}
		// Building age context
		if (p.buildingProfile.avgYearBuilt > 0 && p.buildingProfile.avgYearBuilt < 1940) {
			signals.push({ layer: 'SIQ', type: 'neutral', message: `Average building age ${new Date().getFullYear() - p.buildingProfile.avgYearBuilt}+ years — charming but check for infrastructure issues` });
		}
	}

	// ── DOF: Tax lien = building financial distress ──────────────────────────────
	// DS-04: severity-graded signal using full TaxLienRecord from dof-tax-lien.ts.
	// Falls back to flat -5 if detail unavailable (hasTaxLien boolean path).
	// LIQ-01: spec §3.3 — lien signal is concept-independent.
	const lienDetail = (r as any).propertyTax?.taxLienDetail;
	if (lienDetail && lienDetail.severity !== 'NONE') {
		const severityPenalty: Record<string, number> = {
			MINOR: 2, MODERATE: 5, SEVERE: 10, CRITICAL: 15
		};
		const penalty = severityPenalty[lienDetail.severity] ?? 5;
		buildingRisk = Math.max(0, buildingRisk - penalty);
		const amtText = lienDetail.totalLienAmount > 0
			? ` ($${Math.round(lienDetail.totalLienAmount / 1000)}K outstanding)`
			: '';
		const yearsText = lienDetail.yearsInArrears > 0
			? `, ${lienDetail.yearsInArrears} years in arrears` : '';
		signals.push({
			layer: 'SIQ', type: 'negative',
			message: `Tax lien ${lienDetail.severity.toLowerCase()} severity${amtText}${yearsText} — financial distress signal. Discuss property stability with attorney before signing.`
		});
	} else if ((r as any).propertyTax?.hasTaxLien) {
		// Fallback: boolean-only path (lien detail fetch failed or not yet available)
		buildingRisk = Math.max(0, buildingRisk - 5);
		signals.push({ layer: 'SIQ', type: 'negative', message: 'Building has outstanding tax liens — financial distress risk. Discuss stability with attorney before signing.' });
	}
	// High leverage + recent purchase = context flag (no score penalty per spec)
	if ((r as any).propertyTax?.mortgageContext === 'high_leverage') {
		signals.push({ layer: 'SIQ', type: 'negative', message: 'Highly leveraged owner with recent purchase — landlord may be under financial pressure to maintain high rents.' });
	}

	// Landmarks (from LPC)
	let landmarks = 50;
	if (r.lpc) {
		const count = r.lpc.nearbyLandmarks?.length || 0;
		if (count > 0) {
			landmarks = Math.min(90, 60 + count * 10);
			if (r.lpc.isHistoricDistrict) {
				landmarks += 10;
				signals.push({ layer: 'SIQ', type: 'positive', message: `Historic district — character draw, but check renovation restrictions` });
			}
		}
	}

	return {
		walkability: clamp(walkability),
		competitors: clamp(competitors),
		buildingRisk: clamp(buildingRisk),
		landmarks: clamp(landmarks)
	};
}

// ─────────────────────────────────────────────────
// TIQ: Taste IQ
// ─────────────────────────────────────────────────

function computeTIQ(
	r: LocationIntelReport,
	_businessType: string,
	signals: IQSignal[]
): IQBreakdown['tiq'] {
	// Cuisine diversity (from inspections)
	let cuisineDiversity = 50;
	if (r.inspections) {
		const cuisines = Object.keys(r.inspections.cuisineBreakdown || {}).length;
		cuisineDiversity = Math.min(95, 30 + cuisines * 5);
		if (cuisines > 10) signals.push({ layer: 'TIQ', type: 'positive', message: `${cuisines} cuisine types nearby — diverse food scene attracts adventurous eaters` });
	}

	// Quality gap (from inspection grades + Places ratings)
	let qualityGap = 50;
	if (r.inspections) {
		const avgGrade = r.inspections.avgScore || 50;
		// Lower avg grade = bigger quality gap = opportunity
		qualityGap = Math.max(20, 100 - avgGrade);
		if (avgGrade < 60) signals.push({ layer: 'TIQ', type: 'positive', message: `Average restaurant grade below B — room for a quality-first concept` });
	}
	if (r.places) {
		const avgRating = r.places.avgRating || 0;
		if (avgRating > 0 && avgRating < 4.0) {
			qualityGap += 10; // bigger gap
			signals.push({ layer: 'TIQ', type: 'positive', message: `Average nearby rating ${avgRating.toFixed(1)}★ — quality gap to exploit` });
		} else if (avgRating >= 4.3) {
			qualityGap -= 10; // tough competition
			signals.push({ layer: 'TIQ', type: 'neutral', message: `Average rating ${avgRating.toFixed(1)}★ — high quality bar, must match or exceed` });
		}
	}

	// Market gap (from DCA license mix + competitors + market density)
	let marketGap = 50;
	if (r.dcaLicenses && r.competitors) {
		const licensedBiz = r.dcaLicenses.totalCount;
		const competitorCount = (r.competitors.rings?.ring1?.length || 0) + (r.competitors.rings?.ring2?.length || 0);
		if (licensedBiz > 50 && competitorCount < 5) {
			marketGap = 80;
			signals.push({ layer: 'TIQ', type: 'positive', message: `${licensedBiz} businesses but only ${competitorCount} direct competitors — clear market gap` });
		} else if (competitorCount > licensedBiz * 0.1) {
			marketGap = 35;
		}
	}
	// Market density enriches the gap analysis
	if (r.marketDensity) {
		const md = r.marketDensity;
		// High commercial vitality + low direct competition = strong market gap
		if (md.commercialVitality > 70) {
			marketGap = Math.round(marketGap * 1.1);
			signals.push({ layer: 'TIQ', type: 'positive', message: `Commercial vitality ${md.commercialVitality}/100 — ${md.totalBusinesses} businesses across ${md.categories.filter(c => c.count > 0).length} categories` });
		}
		// Chain dominance signals opportunity for independents
		const highChainCats = md.categories.filter(c => c.chainPct > 60 && c.count > 3);
		if (highChainCats.length > 0) {
			signals.push({ layer: 'TIQ', type: 'positive', message: `Chain-heavy market (${highChainCats.map(c => c.category).join(', ')}) — opportunity for authentic independent concept` });
			marketGap = Math.round(marketGap * 1.05);
		}
	}

	return {
		cuisineDiversity: clamp(cuisineDiversity),
		qualityGap: clamp(qualityGap),
		marketGap: clamp(marketGap)
	};
}

// ─────────────────────────────────────────────────
// LIQ: Labor IQ
// Estimates labor market conditions from Census demographics,
// MTA transit data (commutability), and neighborhood dynamics.
// ─────────────────────────────────────────────────

function computeLIQ(
	r: LocationIntelReport,
	_businessType: string,
	signals: IQSignal[]
): number {
	let laborPool = 50;      // working-age population accessibility
	let commutability = 50;  // transit access for workers
	let wageViability = 50;  // income levels vs wage requirements

	// Labor Pool: Census age demographics + daytime population
	if (r.census) {
		const c = r.census;
		// Daytime population ratio > 1 means people commute IN (more potential workers nearby during shifts)
		const daytimeScore = scoreLinear(c.daytimePopulationRatio || 1, 0.5, 2.5);
		// FIX: Use populationDensity (per sq mi) — same fix as demographics
		const popScore = scoreLinear(c.populationDensity || 0, 5000, 80000);
		// Younger median age correlates with more available service workers
		const youthScore = scoreLinear(c.medianAge || 35, 20, 50, true);
		laborPool = Math.round(daytimeScore * 0.40 + popScore * 0.35 + youthScore * 0.25);

		if (daytimeScore > 70) {
			signals.push({ layer: 'LIQ', type: 'positive', message: `High daytime population ratio (${(c.daytimePopulationRatio || 1).toFixed(1)}x) — strong commuter labor pool` });
		}
		if (daytimeScore < 30) {
			signals.push({ layer: 'LIQ', type: 'negative', message: `Low daytime population — workers may need to commute in` });
		}
	}

	// Commutability: MTA ridership data indicates how easily workers can get here
	if (r.mtaRidership) {
		const mta = r.mtaRidership;
		const riderScore = scoreLinear(mta.totalDailyRidership || 0, 1000, 50000);
		const stationScore = scoreLinear(mta.stationCount || 0, 1, 8);
		commutability = Math.round(riderScore * 0.60 + stationScore * 0.40);

		if (mta.stationCount >= 3) {
			signals.push({ layer: 'LIQ', type: 'positive', message: `${mta.stationCount} subway stations nearby — easy commute for staff` });
		}
	} else if (r.walkScore) {
		// Fallback: use transit score from WalkScore
		commutability = r.walkScore.transitScore || 50;
	}

	// Wage Viability: areas with moderate income levels tend to have available service workers
	// Very high income areas = harder to find service workers willing to commute
	// Very low income areas = higher turnover risk
	if (r.census) {
		const income = r.census.medianHouseholdIncome || 60000;
		// Sweet spot: $40K-$80K median household income for labor availability
		if (income >= 40000 && income <= 80000) {
			wageViability = 75;
		} else if (income < 40000) {
			wageViability = 60; // Available but turnover risk
			signals.push({ layer: 'LIQ', type: 'neutral', message: 'Lower-income area may see higher staff turnover' });
		} else if (income <= 120000) {
			wageViability = 65; // Moderate — workers likely commute in
		} else {
			wageViability = 50; // High income — harder to source hourly workers locally
			signals.push({ layer: 'LIQ', type: 'neutral', message: 'High-income area — hourly workers likely commute from other neighborhoods' });
		}
	}

	return clamp(Math.round(laborPool * 0.40 + commutability * 0.35 + wageViability * 0.25));
}

// ─────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
	return Math.max(min, Math.min(max, Math.round(v)));
}

/**
 * Variance Expansion — counteracts the ~6x compression from nested averaging.
 *
 * Problem: 6 layers of weighted averaging (sub-components → pillars → composite)
 * collapse scores toward 50. A location with genuinely extreme signals (90th
 * percentile income + 95th Walk Score + zero competitors) still lands at ~62.
 *
 * Solution: Sigmoid-like expansion centered at 50. Scores near 50 get stretched
 * proportionally outward; scores already at extremes get less stretch (no runaway).
 *
 * The `strength` param controls how aggressive the expansion is:
 *   1.0 = no expansion (identity)
 *   1.65 = moderate (pillar-level, undo ~2x from sub-component averaging)
 *   2.0 = strong (composite-level, undo ~4x cumulative compression)
 *
 * Properties preserved:
 *   - Monotonic: if A > B before, A > B after
 *   - Center-anchored: 50 maps to 50
 *   - Bounded: output always in [5, 98]
 *   - Diminishing returns at extremes (scores > 85 or < 15 stretch less)
 *
 * @param raw - The compressed score (0-100)
 * @param strength - Expansion multiplier (1.0 = none, 2.0 = strong)
 * @param dataCompleteness - 0-1 fraction of data sources available. Low completeness
 *                           dampens expansion (less data = less confidence to spread).
 */
function expandVariance(raw: number, strength: number, dataCompleteness: number): number {
	if (strength <= 1.0) return raw;

	// Dampen expansion when data is sparse (< 60% sources = reduced confidence)
	const confidenceDamper = Math.min(1.0, dataCompleteness / 0.60);
	const effectiveStrength = 1.0 + (strength - 1.0) * confidenceDamper;

	// Distance from center
	const delta = raw - 50;

	// Apply power-curve expansion: stretches center more than extremes
	// sign(delta) * |delta|^(1/strength) * scale — but simpler: linear with soft-cap
	const absDelta = Math.abs(delta);

	// Soft diminishing returns above 30pts from center (prevents runaway at extremes)
	let expanded: number;
	if (absDelta <= 30) {
		expanded = delta * effectiveStrength;
	} else {
		// First 30 points get full stretch, remainder gets sqrt dampening
		const base = 30 * effectiveStrength;
		const remainder = absDelta - 30;
		const dampedRemainder = Math.sqrt(remainder) * Math.sqrt(30) * (effectiveStrength - 1.0) + remainder;
		expanded = Math.sign(delta) * (base + dampedRemainder);
	}

	return clamp(Math.round(50 + expanded), 5, 98);
}

/** Linear score mapping: value in [low, high] → [0, 100] */
function scoreLinear(value: number, low: number, high: number, invert = false): number {
	const normalized = Math.max(0, Math.min(1, (value - low) / (high - low)));
	const score = Math.round((invert ? 1 - normalized : normalized) * 100);
	return clamp(score);
}

// 04.19.2026 13:35 Score Consolidation — scoreToGrade removed. Imported from canonical grade-scale.ts above.
