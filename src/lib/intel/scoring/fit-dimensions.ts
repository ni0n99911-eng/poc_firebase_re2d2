/**
 * RE² Fit IQ — Dimension Scoring Functions
 * ─────────────────────────────────────────────────────────────────────────────
 * 04.19.2026 13:35 Score Consolidation — Phase 4
 *
 * All pure dimension scoring functions extracted from fit-iq-engine.ts (lines 261–752).
 * These functions are deterministic with zero side effects (no Supabase, no async).
 *
 * Previous home: src/lib/fit-iq-engine.ts (993 lines)
 * New home: src/lib/intel/scoring/fit-dimensions.ts
 *
 * fit-iq-engine.ts retains: BUSINESS_CONFIGS, resolveConfig(), loadBlockGroupData(),
 * computeFitProgress(), applyDynamicOverrides(), computeFitIQ() (public API).
 * All callers of computeFitIQ() are unchanged.
 */

import { clamp, scoreLinear } from '$lib/intel/scoring/geo-math';
import type { LaunchpadProfile, FitDimension } from '$lib/fit-iq-engine';

// ─────────────────────────────────────────────────
// Types (canonical home for BlockGroupData)
// ─────────────────────────────────────────────────

/** Data bundle loaded from Supabase for a given geoid. */
export interface BlockGroupData {
	intel: Record<string, any>;       // from block_group_intel (keyed by source)
	enriched: Record<string, any>;    // from enriched_entities (keyed by entity_category)
	scores: Record<string, { score: number; components: any }>;  // from block_group_scores
}

/** Internal shape used by resolveConfig() in fit-iq-engine.ts */
export interface BusinessConfig {
	archetype: 'routine_interceptor' | 'destination_pull' | 'need_filler';
	dimensions: string[];
	dimWeights: number[];
	idealIncome?: [number, number];
	idealRent?: number;
}

// ─────────────────────────────────────────────────
// Variance Expansion
// 04.19.2026 13:35 Score Consolidation — extracted from fit-iq-engine.ts line 261
// Note: expandVariance uses a damped-parabola algorithm shared with Location IQ
// but with different strength values — do NOT merge into geo-math.ts.
// ─────────────────────────────────────────────────

/**
 * Expands a compressed 0-100 score away from the neutral midpoint (50).
 * Counteracts score clustering from multi-layer weighted averaging.
 *
 * @param raw - The compressed score (0-100)
 * @param strength - Expansion multiplier (1.0 = none, 1.65 = moderate)
 */
export function expandVariance(raw: number, strength: number): number {
	if (strength <= 1.0) return raw;
	const delta = raw - 50;
	const absDelta = Math.abs(delta);
	let expanded: number;
	if (absDelta <= 30) {
		expanded = delta * strength;
	} else {
		const base = 30 * strength;
		const remainder = absDelta - 30;
		const dampedRemainder = Math.sqrt(remainder) * Math.sqrt(30) * (strength - 1.0) + remainder;
		expanded = Math.sign(delta) * (base + dampedRemainder);
	}
	return clamp(Math.round(50 + expanded), 5, 98);
}

// ─────────────────────────────────────────────────
// Dimension Scoring Functions
// 04.19.2026 13:35 Score Consolidation — extracted from fit-iq-engine.ts lines 345–656
// Each returns { score: 0-100, explanation: string }
// ─────────────────────────────────────────────────

export function scoreFootTraffic(data: BlockGroupData): { score: number; explanation: string } {
	let score = 50;
	const parts: string[] = [];
	let hasMta = false;
	let hasPed = false;
	let hasWalk = false;

	// MTA ridership (available for ~41% of block groups — best transit proxy)
	const mta = data.enriched.mta_ridership || data.intel.mta_ridership;
	if (mta) {
		const ridership = mta.estimated_daily_ridership || mta.totalDailyRidership || 0;
		const stations = mta.station_count_within_400m || mta.stationCount || 0;
		const mtaScore = scoreLinear(ridership, 1000, 50000);
		score = mtaScore;
		hasMta = true;
		parts.push(`${ridership.toLocaleString()} daily transit riders, ${stations} station${stations !== 1 ? 's' : ''} nearby`);
	}

	// Pedestrian counts (available for only ~3% of block groups — treat as bonus signal)
	// Gap #4: Graceful degradation — NEVER claim precise counts when data is absent
	const ped = data.enriched.pedestrian_counts || data.intel.pedestrian_counts;
	if (ped && ped.avg_pedestrian_count > 0) {
		const avg = ped.avg_pedestrian_count;
		const pedScore = scoreLinear(avg, 100, 10000);
		score = hasMta ? Math.round(score * 0.6 + pedScore * 0.4) : pedScore;
		hasPed = true;
		parts.push(`${avg.toLocaleString()} avg daily pedestrians (sensor-measured)`);
	}

	// Walk Score (available for most block groups via WalkScore API)
	const ws = data.intel.walkscore;
	if (ws) {
		const walkVal = ws.walkscore || ws.raw?.walkscore || 50;
		hasWalk = true;
		if (!hasMta && !hasPed) {
			score = walkVal;
			parts.push(`Walk Score ${walkVal} (used as primary foot traffic proxy — no transit or pedestrian sensor data available for this block)`);
		} else {
			score = Math.round(score * 0.85 + walkVal * 0.15);
			parts.push(`Walk Score ${walkVal}`);
		}
	}

	// Data quality note when we lack strong signals
	if (!hasMta && !hasPed && !hasWalk) {
		parts.push('No foot traffic data available for this block group — score is an estimate based on nearby patterns');
		const transitScore = data.scores['six_transit']?.score;
		if (transitScore !== undefined) {
			score = transitScore;
			parts.push(`Using pre-computed transit score of ${transitScore} as proxy`);
		}
	} else if (!hasPed && hasMta) {
		parts.push('Pedestrian sensor data not available for this block — foot traffic estimated from transit ridership and walkability');
	}

	return {
		score: clamp(score),
		explanation: parts.join('. '),
	};
}

export function scoreCompetition(data: BlockGroupData, businessType: string): { score: number; explanation: string } {
	let score = 50;
	const parts: string[] = [];

	const osm = data.enriched.osm_pois;
	if (osm) {
		const totalPois = osm.total_pois || 0;
		if (totalPois === 0) { score = 40; parts.push('No direct competitors found — unproven market'); }
		else if (totalPois <= 5) { score = 85; parts.push(`Only ${totalPois} competitors — healthy demand signal with room`); }
		else if (totalPois <= 15) { score = 65; parts.push(`${totalPois} competitors — competitive but viable`); }
		else { score = Math.max(25, 65 - (totalPois - 15) * 3); parts.push(`${totalPois} competitors — saturated market`); }
	}

	// Restaurant inspections as proxy for dining competition
	const insp = data.enriched.dohmh_inspections;
	if (insp && ['restaurant', 'fast-casual', 'cafe', 'coffee'].includes(businessType.toLowerCase())) {
		const count = insp.restaurant_count || insp.total_inspection_records || 0;
		const avgScore = insp.avg_inspection_score || 0;
		if (avgScore > 0 && avgScore < 20) {
			score = Math.round(score * 1.05);
			parts.push(`Avg health inspection score ${avgScore} — quality gap opportunity`);
		}
		parts.push(`${count} food establishments inspected nearby`);
	}

	return { score: clamp(score), explanation: parts.join('. ') || 'Competition data unavailable' };
}

export function scoreDemographics(data: BlockGroupData, config: BusinessConfig): { score: number; explanation: string } {
	let score = 50;
	const parts: string[] = [];
	const census = data.intel.census_demographics;

	if (census) {
		const income = census.median_household_income || 0;
		const pop = census.total_population || 0;
		const [loIncome, hiIncome] = config.idealIncome || [40000, 150000];

		if (income >= loIncome && income <= hiIncome) {
			score = scoreLinear(income, loIncome * 0.5, hiIncome);
		} else if (income < loIncome) {
			score = Math.max(20, scoreLinear(income, 0, loIncome));
		} else {
			score = Math.max(40, 100 - scoreLinear(income, hiIncome, hiIncome * 2));
		}

		const education = (() => {
			const b = census.bachelors_degree || 0;
			const m = census.masters_degree || 0;
			const d = census.doctorate_degree || 0;
			const t = census.total_population || 1;
			return Math.round((b + m + d) / t * 100);
		})();

		const edScore = scoreLinear(education, 10, 60);
		const popScore = scoreLinear(pop, 1000, 30000);
		score = Math.round(score * 0.50 + edScore * 0.25 + popScore * 0.25);

		parts.push(`Median income $${income.toLocaleString()}, ${education}% college+, pop ${pop.toLocaleString()}`);
	}

	// Housing data for context
	const housing = data.intel.census_housing;
	if (housing) {
		const rentBurden = housing.median_rent_burden_pct || 0;
		if (rentBurden > 50) {
			score = Math.round(score * 0.90);
			parts.push(`High rent burden (${rentBurden}%) — less disposable income`);
		}
	}

	return { score: clamp(score), explanation: parts.join('. ') || 'Demographics data unavailable' };
}

export function scoreRentFit(data: BlockGroupData, launchpad: LaunchpadProfile, config: BusinessConfig): { score: number; explanation: string } {
	let score = 50;
	const parts: string[] = [];

	const housing = data.intel.census_housing;
	const userRent = parseRentBudget(launchpad.rent || launchpad.budget || '');
	const idealRent = config.idealRent || 8000;

	if (housing?.median_gross_rent) {
		const areaRent = housing.median_gross_rent;
		parts.push(`Area median rent $${areaRent.toLocaleString()}/mo`);

		const estCommercialRent = areaRent * 4;

		if (userRent > 0) {
			const ratio = userRent / estCommercialRent;
			if (ratio >= 1.2) { score = 85; parts.push(`Your budget ($${userRent.toLocaleString()}) comfortably covers estimated commercial rent`); }
			else if (ratio >= 0.8) { score = 65; parts.push(`Your budget ($${userRent.toLocaleString()}) is tight for this area`); }
			else { score = 35; parts.push(`Your budget ($${userRent.toLocaleString()}) may be below market for this area`); }
		} else {
			score = scoreLinear(estCommercialRent, idealRent * 2, idealRent * 0.5);
			parts.push(`Estimated commercial rent ~$${estCommercialRent.toLocaleString()}/mo`);
		}
	}

	return { score: clamp(score), explanation: parts.join('. ') || 'Rent data unavailable' };
}

export function scoreNightlife(data: BlockGroupData): { score: number; explanation: string } {
	let score = 50;
	const parts: string[] = [];

	const liquor = data.enriched.liquor_licenses;
	if (liquor) {
		const total = liquor.total_licenses || 0;
		const onPremise = (() => {
			const dist = liquor.license_type_distribution || {};
			return Object.entries(dist)
				.filter(([k]) => k.toLowerCase().includes('op') || k.toLowerCase().includes('on_premise') || k.toLowerCase().includes('on premise'))
				.reduce((s: number, [, v]: [string, any]) => s + (v as number), 0);
		})();
		score = scoreLinear(onPremise, 2, 30);
		parts.push(`${total} liquor licenses (${onPremise} on-premise)`);
	}

	const cafes = data.enriched.sidewalk_cafes;
	if (cafes) {
		const count = cafes.cafe_count || 0;
		if (count > 5) score = Math.round(score * 1.10);
		parts.push(`${count} sidewalk café permits`);
	}

	return { score: clamp(score), explanation: parts.join('. ') || 'Nightlife data unavailable' };
}

export function scoreIncome(data: BlockGroupData, config: BusinessConfig): { score: number; explanation: string } {
	const census = data.intel.census_demographics;
	if (!census) return { score: 50, explanation: 'Income data unavailable' };

	const income = census.median_household_income || 0;
	const [lo, hi] = config.idealIncome || [50000, 150000];
	const score = scoreLinear(income, lo * 0.5, hi);
	return {
		score: clamp(score),
		explanation: `Median household income $${income.toLocaleString()} (ideal range: $${lo.toLocaleString()}-$${hi.toLocaleString()})`,
	};
}

export function scoreTransitAccess(data: BlockGroupData): { score: number; explanation: string } {
	let score = 50;
	const parts: string[] = [];

	const mta = data.enriched.mta_ridership || data.intel.mta_ridership;
	if (mta) {
		const stations = mta.station_count_within_400m || mta.stationCount || 0;
		const ridership = mta.estimated_daily_ridership || mta.totalDailyRidership || 0;
		score = scoreLinear(stations, 0, 5) * 0.4 + scoreLinear(ridership, 1000, 50000) * 0.6;
		parts.push(`${stations} transit stations, ${ridership.toLocaleString()} daily riders`);
	}

	const ws = data.intel.walkscore;
	if (ws) {
		const transitScore = ws.transit_score || ws.raw?.transit?.score || 0;
		score = mta ? Math.round(score * 0.7 + transitScore * 0.3) : transitScore;
		parts.push(`Transit Score ${transitScore}`);
	}

	return { score: clamp(score), explanation: parts.join('. ') || 'Transit data unavailable' };
}

export function scorePopulationDensity(data: BlockGroupData): { score: number; explanation: string } {
	const census = data.intel.census_demographics;
	if (!census) return { score: 50, explanation: 'Population data unavailable' };

	const pop = census.total_population || 0;
	const score = scoreLinear(pop, 1000, 40000);
	return { score: clamp(score), explanation: `Population ${pop.toLocaleString()} in block group` };
}

export function scoreMarketGap(data: BlockGroupData): { score: number; explanation: string } {
	const osm = data.enriched.osm_pois;
	if (!osm) return { score: 50, explanation: 'Market data unavailable' };

	const cats = osm.category_distribution || {};
	const underserved = Object.entries(cats).filter(([, v]: [string, any]) => (v as number) < 3).length;
	const score = underserved > 3 ? 80 : underserved > 0 ? 60 : 35;
	return {
		score: clamp(score),
		explanation: `${underserved} underserved business categories in this area`,
	};
}

export function scoreFamilyDensity(data: BlockGroupData): { score: number; explanation: string } {
	const census = data.intel.census_demographics;
	if (!census) return { score: 50, explanation: 'Family data unavailable' };

	const pop = census.total_population || 0;
	const medianAge = census.median_age || 35;
	const ageScore = medianAge >= 28 && medianAge <= 45 ? 80 : medianAge < 28 ? 60 : 40;
	const popScore = scoreLinear(pop, 2000, 30000);
	const score = Math.round(ageScore * 0.5 + popScore * 0.5);
	return { score: clamp(score), explanation: `Median age ${medianAge}, pop ${pop.toLocaleString()}` };
}

export function scoreAgeDemographics(data: BlockGroupData): { score: number; explanation: string } {
	const census = data.intel.census_demographics;
	if (!census) return { score: 50, explanation: 'Age data unavailable' };

	const medianAge = census.median_age || 35;
	const score = medianAge >= 25 && medianAge <= 45 ? scoreLinear(medianAge, 20, 35) : scoreLinear(medianAge, 45, 25);
	return { score: clamp(score), explanation: `Median age ${medianAge} (ideal for nightlife: 25-45)` };
}

export function scoreHealthConscious(data: BlockGroupData): { score: number; explanation: string } {
	let score = 50;
	const parts: string[] = [];

	const census = data.intel.census_demographics;
	if (census) {
		const income = census.median_household_income || 0;
		const edu = (() => {
			const b = census.bachelors_degree || 0;
			const m = census.masters_degree || 0;
			const d = census.doctorate_degree || 0;
			const t = census.total_population || 1;
			return Math.round((b + m + d) / t * 100);
		})();
		score = Math.round(scoreLinear(income, 40000, 120000) * 0.5 + scoreLinear(edu, 15, 60) * 0.5);
		parts.push(`Income $${income.toLocaleString()}, ${edu}% college+`);
	}

	return { score: clamp(score), explanation: parts.join('. ') || 'Health-conscious data unavailable' };
}

export function scoreRenterDensity(data: BlockGroupData): { score: number; explanation: string } {
	const housing = data.intel.census_housing;
	if (!housing) return { score: 50, explanation: 'Housing data unavailable' };

	const occupied = housing.occupied_housing_units || 1;
	const ownerOcc = housing.owner_occupied || 0;
	const renterPct = Math.round((1 - ownerOcc / occupied) * 100);
	const score = scoreLinear(renterPct, 30, 90);
	return { score: clamp(score), explanation: `${renterPct}% renter-occupied (higher = more laundry demand)` };
}

// ─────────────────────────────────────────────────
// Dimension Router
// 04.19.2026 13:35 Score Consolidation — extracted from fit-iq-engine.ts line 661
// ─────────────────────────────────────────────────

/**
 * Dispatches a dimension label to the appropriate dimension scorer.
 * Uses label substring matching — same logic as the original engine.
 */
export function computeDimension(
	label: string,
	data: BlockGroupData,
	launchpad: LaunchpadProfile,
	config: BusinessConfig
): { score: number; explanation: string } {
	const l = label.toLowerCase();

	if (l.includes('foot traffic')) return scoreFootTraffic(data);
	if (l.includes('competition')) return scoreCompetition(data, launchpad.businessType);
	if (l.includes('demographics')) return scoreDemographics(data, config);
	if (l.includes('rent')) return scoreRentFit(data, launchpad, config);
	if (l.includes('nightlife')) return scoreNightlife(data);
	if (l.includes('dining demand')) return scoreFootTraffic(data); // Proxy: foot traffic ≈ dining demand
	if (l.includes('area income')) return scoreIncome(data, config);
	if (l.includes('income level')) return scoreIncome(data, config);
	if (l.includes('income match')) return scoreIncome(data, config);
	if (l.includes('transit')) return scoreTransitAccess(data);
	if (l.includes('parking')) return scoreTransitAccess(data); // Transit = proxy for non-car access
	if (l.includes('population')) return scorePopulationDensity(data);
	if (l.includes('market gap')) return scoreMarketGap(data);
	if (l.includes('healthcare gap')) return scoreMarketGap(data); // Proxy
	if (l.includes('shopping')) return scoreCompetition(data, 'retail');
	if (l.includes('family')) return scoreFamilyDensity(data);
	if (l.includes('school')) return scoreFamilyDensity(data); // Proxy
	if (l.includes('age demo')) return scoreAgeDemographics(data);
	if (l.includes('license')) return scoreNightlife(data);
	if (l.includes('health-conscious')) return scoreHealthConscious(data);
	if (l.includes('daytime')) return scoreFootTraffic(data);
	if (l.includes('renter')) return scoreRenterDensity(data);
	if (l.includes('insurance')) return scoreDemographics(data, config); // Proxy

	return { score: 50, explanation: 'Score computed with default methodology' };
}

// ─────────────────────────────────────────────────
// Post-Scoring Adjustments
// 04.19.2026 13:35 Score Consolidation — extracted from fit-iq-engine.ts lines 699–752
// ─────────────────────────────────────────────────

/** Adjusts dimension scores based on founder's risk tolerance profile. */
export function applyRiskTolerance(
	dimensions: FitDimension[],
	riskTolerance: string,
	safetyScore: number
): FitDimension[] {
	if (!riskTolerance) return dimensions;

	const rt = riskTolerance.toLowerCase();
	if (rt.includes('low') || rt.includes('conservative')) {
		return dimensions.map(d => {
			if (d.label.toLowerCase().includes('competition') && d.score < 50) {
				return { ...d, score: Math.round(d.score * 0.85), explanation: d.explanation + '. Adjusted down for low risk tolerance.' };
			}
			return d;
		});
	}
	if (rt.includes('high') || rt.includes('aggressive')) {
		return dimensions.map(d => {
			if (d.label.toLowerCase().includes('competition') && d.score < 50) {
				return { ...d, score: Math.round(d.score * 1.10), explanation: d.explanation + '. Adjusted up for high risk tolerance.' };
			}
			return d;
		});
	}
	return dimensions;
}

/** Adjusts final Fit IQ score based on founder's years of experience. */
export function applyExperience(fitIQ: number, experience: string): number {
	if (!experience) return fitIQ;
	const exp = experience.toLowerCase();
	if (exp.includes('none') || exp.includes('first') || exp.includes('0')) {
		return Math.round(fitIQ * 0.95); // Slight penalty — harder for first-timers
	}
	if (exp.includes('10+') || exp.includes('expert') || exp.includes('serial')) {
		return Math.round(fitIQ * 1.05); // Slight boost — experienced operators can make more work
	}
	return fitIQ;
}

/** Parses a rent/budget string (e.g. "$8,000/mo" or "96000") to a monthly number. */
export function parseRentBudget(raw: string): number {
	if (!raw) return 0;
	const cleaned = raw.replace(/[^0-9.]/g, '');
	const num = parseFloat(cleaned);
	if (isNaN(num)) return 0;
	if (num > 50000) return Math.round(num / 12);
	return Math.round(num);
}
