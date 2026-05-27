/**
 * ═══════════════════════════════════════════════════════
 * Layer 3: Contextual Extrapolation Engine
 * ═══════════════════════════════════════════════════════
 *
 * Takes enriched entities (Layer 2) + raw report (Layer 1)
 * and produces business-specific inferences that no single
 * API provides.
 *
 * Extrapolation categories:
 * - Force multipliers: nearby businesses that drive customers TO you
 * - Time-of-day viability: when is this location alive vs dead?
 * - Demand signals: aggregate customer generation potential
 * - Competitive position: where you'd sit in the market
 * - Risk assessment: things that could kill the business
 *
 * Every extrapolation has:
 * - derivation_chain: exact data points that fed into it
 * - method: how it was derived (cross_reference, rule_based, etc.)
 * - confidence + confidence_label
 * - sentiment: great / good / neutral / caution / warning
 */

import type { LocationIntelReport } from './types';
import type { ReconciliationResult, EnrichedEntity, DerivationChain, DerivationInput } from './reconciliation';
import { IntelCache } from './cache';

// ── Types ──

export interface Extrapolation {
	extrapolationType: string;
	category: 'force_multiplier' | 'time_viability' | 'demand_signal' | 'competitive_position' | 'risk_assessment';
	title: string;
	value: number | null;
	unit: string | null;
	interpretation: string;
	sentiment: 'great' | 'good' | 'neutral' | 'caution' | 'warning';
	confidence: number;
	confidenceLabel: 'verified' | 'high' | 'moderate' | 'estimated' | 'speculative';
	method: 'cross_reference' | 'statistical_model' | 'rule_based' | 'time_series' | 'ai_inference';
	derivationChain: DerivationChain;
}

export interface ExtrapolationResult {
	extrapolations: Extrapolation[];
	totalCount: number;
	byCategory: Record<string, number>;
	avgConfidence: number;
	processingMs: number;
}

// ── Force multiplier matrix (mirrors DB seed data, used as fallback) ──

interface MultiplierRule {
	conceptType: string;
	nearbyCategory: string;
	relationship: 'force_multiplier' | 'competitor' | 'neutral' | 'negative';
	score: number;
	reasoning: string;
	timeOfDay: string | null;
}

const MULTIPLIER_RULES: MultiplierRule[] = [
	{ conceptType: 'cafe', nearbyCategory: 'gym', relationship: 'force_multiplier', score: 0.8, reasoning: 'Post-workout coffee, smoothies, protein bowls. Boutique gym crowds are high-spend.', timeOfDay: 'morning' },
	{ conceptType: 'cafe', nearbyCategory: 'office', relationship: 'force_multiplier', score: 0.9, reasoning: 'Office workers are the #1 weekday coffee customer.', timeOfDay: 'morning' },
	{ conceptType: 'cafe', nearbyCategory: 'coworking', relationship: 'force_multiplier', score: 0.85, reasoning: 'Freelancers and remote workers need coffee shops as second offices.', timeOfDay: null },
	{ conceptType: 'cafe', nearbyCategory: 'subway_station', relationship: 'force_multiplier', score: 0.7, reasoning: 'Commuter grab-and-go traffic at morning rush.', timeOfDay: 'morning' },
	{ conceptType: 'cafe', nearbyCategory: 'hotel', relationship: 'force_multiplier', score: 0.5, reasoning: 'Tourists and business travelers seek local coffee.', timeOfDay: 'morning' },
	{ conceptType: 'cafe', nearbyCategory: 'park', relationship: 'force_multiplier', score: 0.6, reasoning: 'Dog walkers, joggers, weekend strollers.', timeOfDay: 'morning' },
	{ conceptType: 'restaurant', nearbyCategory: 'office', relationship: 'force_multiplier', score: 0.85, reasoning: 'Lunch traffic from offices is the backbone of weekday revenue.', timeOfDay: 'afternoon' },
	{ conceptType: 'restaurant', nearbyCategory: 'hotel', relationship: 'force_multiplier', score: 0.7, reasoning: 'Hotel guests seek nearby dining.', timeOfDay: 'evening' },
	{ conceptType: 'restaurant', nearbyCategory: 'theater', relationship: 'force_multiplier', score: 0.8, reasoning: 'Pre-theater and post-theater dining is a major revenue driver.', timeOfDay: 'evening' },
	{ conceptType: 'bar', nearbyCategory: 'restaurant', relationship: 'force_multiplier', score: 0.7, reasoning: 'Post-dinner drinks.', timeOfDay: 'evening' },
	{ conceptType: 'bar', nearbyCategory: 'office', relationship: 'force_multiplier', score: 0.6, reasoning: 'After-work happy hour crowd.', timeOfDay: 'evening' },
	{ conceptType: 'bar', nearbyCategory: 'school', relationship: 'negative', score: -0.5, reasoning: 'Schools nearby can block liquor license approval.', timeOfDay: null },
	{ conceptType: 'gym', nearbyCategory: 'office', relationship: 'force_multiplier', score: 0.7, reasoning: 'Before/after work gym sessions.', timeOfDay: null },
	{ conceptType: 'gym', nearbyCategory: 'subway_station', relationship: 'force_multiplier', score: 0.6, reasoning: 'Transit access expands membership catchment.', timeOfDay: null },
];

// ── Main extrapolation ──

export function generateExtrapolations(
	report: LocationIntelReport,
	reconciled: ReconciliationResult
): ExtrapolationResult {
	const startMs = Date.now();
	const extrapolations: Extrapolation[] = [];
	const { lat, lng, businessType } = report;

	// ── Force multiplier analysis ──
	extrapolations.push(...analyzeForceMultipliers(report, reconciled, businessType, lat, lng));

	// ── Time-of-day viability ──
	extrapolations.push(...analyzeTimeViability(report, reconciled, businessType, lat, lng));

	// ── Demand signals ──
	extrapolations.push(...analyzeDemandSignals(report, reconciled, businessType, lat, lng));

	// ── Competitive position ──
	extrapolations.push(...analyzeCompetitivePosition(report, reconciled, businessType, lat, lng));

	// ── Risk assessment ──
	extrapolations.push(...analyzeRisks(report, reconciled, businessType, lat, lng));

	// ── Stats ──
	const byCategory: Record<string, number> = {};
	for (const e of extrapolations) {
		byCategory[e.category] = (byCategory[e.category] || 0) + 1;
	}
	const avgConfidence = extrapolations.length > 0
		? extrapolations.reduce((sum, e) => sum + e.confidence, 0) / extrapolations.length
		: 0;

	return {
		extrapolations,
		totalCount: extrapolations.length,
		byCategory,
		avgConfidence: Math.round(avgConfidence * 100) / 100,
		processingMs: Date.now() - startMs,
	};
}

// ── Force multiplier analysis ──

function analyzeForceMultipliers(
	report: LocationIntelReport,
	reconciled: ReconciliationResult,
	businessType: string,
	lat: number, lng: number
): Extrapolation[] {
	const results: Extrapolation[] = [];

	// Find relevant multiplier rules for this business type
	const rules = MULTIPLIER_RULES.filter(r => r.conceptType === businessType);

	// Check each rule against reconciled entities
	for (const rule of rules) {
		const matchingEntities = reconciled.entities.filter(e => {
			if (e.entityType === 'transit_node' && rule.nearbyCategory === 'subway_station') return true;
			if (e.entityType === 'demand_generator' && e.entityCategory.includes(rule.nearbyCategory)) return true;
			if (e.entityType === 'poi' && e.entityCategory.includes(rule.nearbyCategory)) return true;
			return false;
		});

		if (matchingEntities.length === 0) continue;

		const entityCount = matchingEntities.reduce((sum, e) => {
			const count = (e.entityData.count as number) || 1;
			return sum + count;
		}, 0);

		const inputs: DerivationInput[] = matchingEntities.flatMap(e =>
			e.derivationChain.inputs.map(i => ({ ...i }))
		);

		const sentiment = rule.relationship === 'force_multiplier'
			? (rule.score >= 0.7 ? 'great' : rule.score >= 0.4 ? 'good' : 'neutral')
			: rule.relationship === 'competitor'
				? 'caution'
				: rule.relationship === 'negative' ? 'warning' : 'neutral';

		const confidenceFromEntities = matchingEntities.reduce((sum, e) => sum + e.confidence, 0) / matchingEntities.length;

		results.push({
			extrapolationType: `force_multiplier_${rule.nearbyCategory}`,
			category: 'force_multiplier',
			title: rule.relationship === 'force_multiplier'
				? `${capitalize(rule.nearbyCategory)} nearby is a force multiplier${rule.timeOfDay ? ` (${rule.timeOfDay})` : ''}`
				: rule.relationship === 'competitor'
					? `${capitalize(rule.nearbyCategory)} nearby creates competition`
					: `${capitalize(rule.nearbyCategory)} nearby is a risk factor`,
			value: Math.round(rule.score * entityCount * 100) / 100,
			unit: 'impact_score',
			interpretation: `${entityCount} ${rule.nearbyCategory}(s) found. ${rule.reasoning}`,
			sentiment: sentiment as Extrapolation['sentiment'],
			confidence: Math.round(confidenceFromEntities * 100) / 100,
			confidenceLabel: confidenceFromEntities >= 0.8 ? 'high' : confidenceFromEntities >= 0.5 ? 'moderate' : 'estimated',
			method: 'cross_reference',
			derivationChain: {
				inputs,
				logic: `Matched ${entityCount} ${rule.nearbyCategory} entities against force multiplier matrix. ` +
					`Rule: ${rule.conceptType} + ${rule.nearbyCategory} = ${rule.relationship} (score: ${rule.score}).`,
				assumptions: rule.timeOfDay
					? [`Effect strongest during ${rule.timeOfDay} hours`]
					: undefined,
			},
		});
	}

	return results;
}

// ── Time-of-day viability ──

function analyzeTimeViability(
	report: LocationIntelReport,
	reconciled: ReconciliationResult,
	businessType: string,
	lat: number, lng: number
): Extrapolation[] {
	const results: Extrapolation[] = [];
	const inputs: DerivationInput[] = [];

	// Morning viability: transit + offices + gyms
	let morningScore = 0;
	let morningFactors: string[] = [];

	if (report.mtaRidership) {
		const peakRiders = report.mtaRidership.totalDailyRidership * (report.mtaRidership.peakHourRatio || 0.3);
		morningScore += Math.min(30, peakRiders / 500);
		morningFactors.push(`${Math.round(peakRiders).toLocaleString()} peak-hour transit riders`);
		inputs.push({
			source: 'mta-ridership',
			field: 'peak_ridership',
			value: peakRiders,
			cacheKey: IntelCache.locationKey(lat, lng, 'mta-ridership'),
		});
	}

	const offices = reconciled.entities.filter(e => e.entityCategory.includes('office'));
	if (offices.length > 0) {
		const officeCount = offices.reduce((s, e) => s + ((e.entityData.count as number) || 1), 0);
		morningScore += Math.min(30, officeCount * 5);
		morningFactors.push(`${officeCount} offices nearby`);
	}

	const gyms = reconciled.entities.filter(e =>
		e.entityType === 'poi' && (e.entityCategory.includes('gym') || e.entityCategory.includes('fitness'))
	);
	if (gyms.length > 0) {
		morningScore += Math.min(15, gyms.length * 5);
		morningFactors.push(`${gyms.length} gym(s) drive pre/post-workout traffic`);
	}

	if (report.pedestrian) {
		morningScore += Math.min(25, report.pedestrian.totalPedestrians / 100);
		inputs.push({
			source: 'nyc-pedestrian',
			field: 'total_pedestrians',
			value: report.pedestrian.totalPedestrians,
			cacheKey: IntelCache.locationKey(lat, lng, 'pedestrian'),
		});
	}

	morningScore = Math.min(100, Math.round(morningScore));

	results.push({
		extrapolationType: 'morning_viability',
		category: 'time_viability',
		title: 'Morning viability (7–11 AM)',
		value: morningScore,
		unit: 'score',
		interpretation: morningScore >= 70
			? `Strong morning traffic: ${morningFactors.join('; ')}.`
			: morningScore >= 40
				? `Moderate morning activity: ${morningFactors.join('; ')}.`
				: `Weak morning traffic. ${morningFactors.length > 0 ? morningFactors.join('; ') + '.' : 'Few foot traffic drivers.'}`,
		sentiment: morningScore >= 70 ? 'great' : morningScore >= 40 ? 'good' : 'caution',
		confidence: inputs.length >= 2 ? 0.7 : 0.5,
		confidenceLabel: inputs.length >= 2 ? 'moderate' : 'estimated',
		method: 'rule_based',
		derivationChain: {
			inputs,
			logic: `Morning viability score based on transit ridership (peak hours), nearby offices, gyms, and pedestrian counts. ` +
				`Factors: ${morningFactors.join(', ')}.`,
			assumptions: ['Morning = 7-11 AM', 'Peak transit ratio applied to total ridership', 'Office workers generate 60% of morning foot traffic'],
		},
	});

	// Evening viability: restaurants, bars, hotels, theaters
	let eveningScore = 0;
	let eveningFactors: string[] = [];
	const eveningInputs: DerivationInput[] = [];

	const restaurants = reconciled.entities.filter(e =>
		e.entityType === 'poi' && e.entityCategory.includes('restaurant')
	);
	if (restaurants.length > 0) {
		eveningScore += Math.min(25, restaurants.length * 4);
		eveningFactors.push(`${restaurants.length} restaurant(s)`);
	}

	const bars = reconciled.entities.filter(e =>
		e.entityType === 'poi' && (e.entityCategory.includes('bar') || e.entityCategory.includes('nightlife'))
	);
	if (bars.length > 0) {
		eveningScore += Math.min(20, bars.length * 5);
		eveningFactors.push(`${bars.length} bar(s)`);
	}

	const hotels = reconciled.entities.filter(e => e.entityCategory.includes('hotel'));
	if (hotels.length > 0) {
		eveningScore += 15;
		eveningFactors.push('hotel(s) nearby');
	}

	// Crime affects evening more than morning
	if (report.crime) {
		const safetyBonus = Math.max(0, (report.crime.crimeScore - 50) / 5);
		eveningScore += Math.round(safetyBonus);
		eveningFactors.push(`safety score ${report.crime.crimeScore}/100`);
		eveningInputs.push({
			source: 'nypd-complaints',
			field: 'crime_score',
			value: report.crime.crimeScore,
			cacheKey: IntelCache.locationKey(lat, lng, 'crime'),
		});
	}

	// Subway access is critical for evening businesses
	if (report.mtaRidership && report.mtaRidership.stationCount > 0) {
		eveningScore += 15;
		eveningFactors.push(`${report.mtaRidership.stationCount} subway station(s) for late-night access`);
	}

	eveningScore = Math.min(100, Math.round(eveningScore));

	results.push({
		extrapolationType: 'evening_viability',
		category: 'time_viability',
		title: 'Evening viability (6–11 PM)',
		value: eveningScore,
		unit: 'score',
		interpretation: eveningScore >= 70
			? `Strong evening economy: ${eveningFactors.join('; ')}.`
			: eveningScore >= 40
				? `Moderate evening activity: ${eveningFactors.join('; ')}.`
				: `Weak evening scene. ${eveningFactors.length > 0 ? eveningFactors.join('; ') + '.' : 'Few nightlife drivers.'}`,
		sentiment: eveningScore >= 70 ? 'great' : eveningScore >= 40 ? 'good' : 'caution',
		confidence: eveningInputs.length >= 1 ? 0.65 : 0.45,
		confidenceLabel: 'estimated',
		method: 'rule_based',
		derivationChain: {
			inputs: eveningInputs,
			logic: `Evening viability based on nearby restaurants, bars, hotels, safety scores, and transit access.`,
			assumptions: ['Evening = 6-11 PM', 'Crime score inversely affects evening viability', 'Subway access critical for after-dark businesses'],
		},
	});

	return results;
}

// ── Demand signals ──

function analyzeDemandSignals(
	report: LocationIntelReport,
	reconciled: ReconciliationResult,
	businessType: string,
	lat: number, lng: number
): Extrapolation[] {
	const results: Extrapolation[] = [];

	// Foot traffic estimation
	let estimatedDailyFoot = 0;
	const footInputs: DerivationInput[] = [];
	const footFactors: string[] = [];

	if (report.mtaRidership) {
		estimatedDailyFoot += report.mtaRidership.totalDailyRidership * 0.15; // 15% walk past
		footFactors.push(`${report.mtaRidership.totalDailyRidership.toLocaleString()} daily subway riders (15% walk-past rate)`);
		footInputs.push({
			source: 'mta-ridership',
			field: 'total_daily_ridership',
			value: report.mtaRidership.totalDailyRidership,
			cacheKey: IntelCache.locationKey(lat, lng, 'mta-ridership'),
		});
	}

	if (report.pedestrian) {
		estimatedDailyFoot += report.pedestrian.totalPedestrians * 0.8; // pedestrian counts are close to actual
		footFactors.push(`${report.pedestrian.totalPedestrians} pedestrian survey count`);
		footInputs.push({
			source: 'nyc-pedestrian',
			field: 'total_pedestrians',
			value: report.pedestrian.totalPedestrians,
			cacheKey: IntelCache.locationKey(lat, lng, 'pedestrian'),
		});
	}

	// Office demand
	const officeEntities = reconciled.entities.filter(e => e.entityCategory.includes('office'));
	const officeCount = officeEntities.reduce((s, e) => s + ((e.entityData.count as number) || 1), 0);
	if (officeCount > 0) {
		estimatedDailyFoot += officeCount * 150; // ~150 workers per office location walk-by
		footFactors.push(`${officeCount} offices (~150 workers each)`);
	}

	estimatedDailyFoot = Math.round(estimatedDailyFoot);

	if (estimatedDailyFoot > 0 || footFactors.length > 0) {
		const sentiment: Extrapolation['sentiment'] = estimatedDailyFoot >= 5000 ? 'great'
			: estimatedDailyFoot >= 2000 ? 'good'
				: estimatedDailyFoot >= 500 ? 'neutral' : 'caution';

		results.push({
			extrapolationType: 'estimated_foot_traffic',
			category: 'demand_signal',
			title: 'Estimated daily foot traffic',
			value: estimatedDailyFoot,
			unit: 'people/day',
			interpretation: `Estimated ${estimatedDailyFoot.toLocaleString()} daily passers-by based on ${footFactors.join('; ')}.`,
			sentiment,
			confidence: footInputs.length >= 2 ? 0.55 : 0.35,
			confidenceLabel: 'estimated',
			method: 'statistical_model',
			derivationChain: {
				inputs: footInputs,
				logic: `Foot traffic estimated from MTA ridership (15% walk-past rate), pedestrian survey data, and nearby office worker count (~150 per office).`,
				assumptions: [
					'15% of subway riders walk past nearby storefronts',
					'~150 workers per office location',
					'Pedestrian survey data scaled 0.8x (survey captures ~80% of actual)',
				],
			},
		});
	}

	// Income-demand alignment
	if (report.census?.medianHouseholdIncome) {
		const income = report.census.medianHouseholdIncome;
		const priceTiers: Record<string, { min: number; sweet: number }> = {
			'cafe': { min: 45000, sweet: 80000 },
			'restaurant': { min: 55000, sweet: 95000 },
			'bar': { min: 50000, sweet: 85000 },
			'gym': { min: 60000, sweet: 100000 },
		};

		const tier = priceTiers[businessType] || priceTiers['cafe'];
		const alignmentScore = income >= tier.sweet ? 100
			: income >= tier.min ? Math.round(((income - tier.min) / (tier.sweet - tier.min)) * 100)
				: Math.round((income / tier.min) * 50);

		results.push({
			extrapolationType: 'income_demand_alignment',
			category: 'demand_signal',
			title: 'Income-demand alignment',
			value: alignmentScore,
			unit: 'score',
			interpretation: alignmentScore >= 80
				? `Median income $${income.toLocaleString()} is well above the sweet spot for a ${businessType}. Strong spending power.`
				: alignmentScore >= 50
					? `Median income $${income.toLocaleString()} supports a ${businessType}, but premium positioning may be challenging.`
					: `Median income $${income.toLocaleString()} is below typical for a successful ${businessType}. Value positioning recommended.`,
			sentiment: alignmentScore >= 80 ? 'great' : alignmentScore >= 50 ? 'good' : 'caution',
			confidence: 0.75,
			confidenceLabel: 'moderate',
			method: 'rule_based',
			derivationChain: {
				inputs: [{
					source: 'census-acs',
					field: 'median_income',
					value: income,
					cacheKey: IntelCache.locationKey(lat, lng, 'demographics'),
				}],
				logic: `Compared median household income ($${income.toLocaleString()}) against ${businessType} threshold (min: $${tier.min.toLocaleString()}, sweet spot: $${tier.sweet.toLocaleString()}).`,
				assumptions: [
					`${businessType} minimum viable income threshold: $${tier.min.toLocaleString()}`,
					`${businessType} sweet spot income: $${tier.sweet.toLocaleString()}+`,
					'Census tract income reflects immediate trade area spending power',
				],
			},
		});
	}

	return results;
}

// ── Competitive position ──

function analyzeCompetitivePosition(
	report: LocationIntelReport,
	reconciled: ReconciliationResult,
	businessType: string,
	lat: number, lng: number
): Extrapolation[] {
	const results: Extrapolation[] = [];

	// Count direct competitors from reconciled POIs
	const directCompetitors = reconciled.entities.filter(e =>
		e.entityType === 'poi' && (
			e.entityCategory.includes(businessType) ||
			(businessType === 'cafe' && (e.entityCategory.includes('coffee') || e.entityCategory.includes('cafe'))) ||
			(businessType === 'restaurant' && e.entityCategory.includes('restaurant')) ||
			(businessType === 'bar' && (e.entityCategory.includes('bar') || e.entityCategory.includes('pub'))) ||
			(businessType === 'gym' && (e.entityCategory.includes('gym') || e.entityCategory.includes('fitness')))
		)
	);

	const competitorCount = directCompetitors.length;
	const chainPct = directCompetitors.length > 0
		? Math.round(directCompetitors.filter(c => c.entityData.isChain).length / directCompetitors.length * 100)
		: 0;

	const avgRating = directCompetitors.length > 0
		? Math.round(directCompetitors.reduce((sum, c) => sum + ((c.entityData.rating as number) || 0), 0) / directCompetitors.length * 10) / 10
		: 0;

	const saturationInputs: DerivationInput[] = directCompetitors.flatMap(c => c.derivationChain.inputs);

	// Market saturation
	const saturation = competitorCount <= 2 ? 'underserved'
		: competitorCount <= 5 ? 'balanced'
			: competitorCount <= 10 ? 'competitive'
				: 'saturated';

	const saturationSentiment: Extrapolation['sentiment'] =
		saturation === 'underserved' ? 'great'
			: saturation === 'balanced' ? 'good'
				: saturation === 'competitive' ? 'caution'
					: 'warning';

	results.push({
		extrapolationType: 'market_saturation',
		category: 'competitive_position',
		title: `${capitalize(businessType)} market saturation`,
		value: competitorCount,
		unit: 'competitors',
		interpretation: `${competitorCount} direct ${businessType} competitors within 500m. Market is ${saturation}. ${chainPct}% chains, avg rating ${avgRating}/5.`,
		sentiment: saturationSentiment,
		confidence: reconciled.avgConfidence,
		confidenceLabel: reconciled.avgConfidence >= 0.7 ? 'high' : 'moderate',
		method: 'cross_reference',
		derivationChain: {
			inputs: saturationInputs.slice(0, 10), // Limit to first 10 for readability
			logic: `Counted ${competitorCount} direct competitors by matching reconciled POIs against business type "${businessType}". ` +
				`Sources cross-referenced: ${[...new Set(directCompetitors.flatMap(c => c.sources))].join(', ')}.`,
			assumptions: ['500m radius defines the primary competitive zone', 'Category matching may miss some indirect competitors'],
		},
	});

	// Price positioning gap
	if (directCompetitors.length > 0) {
		const pricedCompetitors = directCompetitors.filter(c => (c.entityData.priceLevel as number) > 0);
		if (pricedCompetitors.length > 0) {
			const avgPrice = pricedCompetitors.reduce((s, c) => s + (c.entityData.priceLevel as number), 0) / pricedCompetitors.length;
			const priceRange = {
				min: Math.min(...pricedCompetitors.map(c => c.entityData.priceLevel as number)),
				max: Math.max(...pricedCompetitors.map(c => c.entityData.priceLevel as number)),
			};

			let gap: string;
			let gapSentiment: Extrapolation['sentiment'];
			if (avgPrice <= 1.5 && report.census?.medianHouseholdIncome && report.census.medianHouseholdIncome > 80000) {
				gap = 'Premium gap — area income supports higher pricing than current market offers';
				gapSentiment = 'great';
			} else if (avgPrice >= 3 && report.census?.medianHouseholdIncome && report.census.medianHouseholdIncome < 60000) {
				gap = 'Value gap — area may be over-served at premium price points';
				gapSentiment = 'good';
			} else {
				gap = 'Market priced appropriately for the area';
				gapSentiment = 'neutral';
			}

			results.push({
				extrapolationType: 'price_positioning',
				category: 'competitive_position',
				title: 'Pricing gap analysis',
				value: Math.round(avgPrice * 10) / 10,
				unit: 'avg_price_level',
				interpretation: `Average competitor price level: ${avgPrice.toFixed(1)}/4 (range: ${priceRange.min}-${priceRange.max}). ${gap}.`,
				sentiment: gapSentiment,
				confidence: pricedCompetitors.length >= 3 ? 0.7 : 0.5,
				confidenceLabel: pricedCompetitors.length >= 3 ? 'moderate' : 'estimated',
				method: 'cross_reference',
				derivationChain: {
					inputs: [{
						source: 'reconciled_entities',
						field: 'price_levels',
						value: pricedCompetitors.map(c => c.entityData.priceLevel),
						cacheKey: 'derived:competitive_position',
					}],
					logic: `Analyzed price levels of ${pricedCompetitors.length} competitors with known pricing. Cross-referenced with census median income.`,
					assumptions: ['Price level 1-4 scale ($ to $$$$)', 'Income > $80K supports premium pricing', 'Income < $60K suggests value positioning'],
				},
			});
		}
	}

	return results;
}

// ── Risk assessment ──

function analyzeRisks(
	report: LocationIntelReport,
	reconciled: ReconciliationResult,
	businessType: string,
	lat: number, lng: number
): Extrapolation[] {
	const results: Extrapolation[] = [];

	// Crime risk
	if (report.crime) {
		const crimeScore = report.crime.crimeScore;
		let riskLevel: string;
		let sentiment: Extrapolation['sentiment'];

		if (crimeScore >= 80) { riskLevel = 'Low crime area'; sentiment = 'great'; }
		else if (crimeScore >= 60) { riskLevel = 'Moderate crime — typical for NYC commercial areas'; sentiment = 'good'; }
		else if (crimeScore >= 40) { riskLevel = 'Elevated crime — may deter foot traffic, especially evenings'; sentiment = 'caution'; }
		else { riskLevel = 'High crime area — significant risk for customer safety perception'; sentiment = 'warning'; }

		// Special risk for bars: violent crime matters more
		if (businessType === 'bar' && report.crime.violentCount > 5) {
			riskLevel += '. Elevated violent crime may affect liquor license renewal.';
			sentiment = 'warning';
		}

		results.push({
			extrapolationType: 'crime_risk',
			category: 'risk_assessment',
			title: 'Crime risk assessment',
			value: 100 - crimeScore, // Invert: higher = more risk
			unit: 'risk_score',
			interpretation: `${riskLevel}. ${report.crime.totalCount} incidents in area (${report.crime.violentCount} violent, ${report.crime.propertyCount} property).`,
			sentiment,
			confidence: 0.8,
			confidenceLabel: 'high',
			method: 'rule_based',
			derivationChain: {
				inputs: [{
					source: 'nypd-complaints',
					field: 'crime_summary',
					value: { score: crimeScore, total: report.crime.totalCount, violent: report.crime.violentCount },
					cacheKey: IntelCache.locationKey(lat, lng, 'crime'),
				}],
				logic: `Crime score ${crimeScore}/100 from NYPD CompStat data. Higher score = safer area.`,
				assumptions: ['Crime data may lag 30-90 days', 'Score is relative to NYC-wide distribution'],
			},
		});
	}

	// DOB violations risk
	if (report.dob) {
		const violations = report.dob.violations?.length || 0;
		if (violations > 0) {
			results.push({
				extrapolationType: 'building_violations',
				category: 'risk_assessment',
				title: 'Building violations risk',
				value: violations,
				unit: 'violations',
				interpretation: `${violations} DOB violation(s) on nearby buildings. May indicate aging infrastructure or code enforcement activity.`,
				sentiment: violations > 5 ? 'warning' : violations > 2 ? 'caution' : 'neutral',
				confidence: 0.85,
				confidenceLabel: 'high',
				method: 'rule_based',
				derivationChain: {
					inputs: [{
						source: 'dob-violations',
						field: 'violation_count',
						value: violations,
						cacheKey: IntelCache.locationKey(lat, lng, 'dob'),
					}],
					logic: `DOB violations within 300m radius of target location.`,
				},
			});
		}
	}

	// Liquor license risk for bars
	if (businessType === 'bar' && report.liquorLicenses) {
		const existingLicenses = report.liquorLicenses.totalCount || 0;
		const saturation = existingLicenses > 10 ? 'High liquor license density — new license may face community board opposition'
			: existingLicenses > 5 ? 'Moderate license density'
				: 'Low license density — favorable for new applications';

		results.push({
			extrapolationType: 'liquor_license_risk',
			category: 'risk_assessment',
			title: 'Liquor license approval risk',
			value: existingLicenses,
			unit: 'active_licenses',
			interpretation: `${existingLicenses} active liquor licenses within 500m. ${saturation}.`,
			sentiment: existingLicenses > 10 ? 'warning' : existingLicenses > 5 ? 'caution' : 'good',
			confidence: 0.85,
			confidenceLabel: 'high',
			method: 'rule_based',
			derivationChain: {
				inputs: [{
					source: 'nys-liquor-authority',
					field: 'active_licenses',
					value: existingLicenses,
					cacheKey: IntelCache.locationKey(lat, lng, 'liquor-licenses'),
				}],
				logic: `Counted active liquor licenses within 500m. High density may trigger "500-foot rule" challenges.`,
				assumptions: ['Community boards have discretion over license density', '500-foot rule applies to on-premises licenses'],
			},
		});
	}

	return results;
}

// ── Utils ──

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}
