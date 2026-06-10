/**
 * Fit IQ Computation Engine — Thread 6B
 *
 * Fit IQ ≠ Location IQ.
 * - Location IQ = How good is this location for ANY business (pre-computed)
 * - Fit IQ = How good is this location for THIS SPECIFIC business + THIS SPECIFIC founder
 *
 * This is 100% DETERMINISTIC — no LLM calls. Only the natural language
 * explanations in the API response use LLM (handled by the copilot endpoints).
 *
 * Inputs: block_group_intel + enriched_entities + block_group_scores + launchpad profile
 * Output: Fit IQ score (0-100) + dimension breakdown + grade + missing fields
 */

import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
import {
	buildDynamicConfig,
	type DynamicConceptConfig,
} from './intel/dynamic-concept-config';
import { resolveConceptType } from './intel/six-index';
// 04.19.2026 13:35 Score Consolidation — scoreToGrade imported from canonical grade-scale.ts
// Replaces the private grade() function that was a local copy of the same logic.
import { scoreToGrade } from '$lib/intel/scoring/grade-scale';

import { clamp, scoreLinear } from '$lib/intel/scoring/geo-math';

export interface LaunchpadProfile {
	businessType: string;
	vision?: string;
	budget?: string;
	rent?: string;
	address?: string;
	ownerType?: string;
	riskTolerance?: string;
	experience?: string;
	targetCustomer?: string;
	hours?: string;
	/** Answers to concept-specific questions from dynamic-concept-config */
	conceptAnswers?: Record<string, string>;
}

export interface FitDimension {
	label: string;
	score: number;
	weight: number;
	explanation: string;
}

export interface FitIQResult {
	fitIQ: number;
	grade: string;
	dimensions: FitDimension[];
	fitProgress: number;
	missingFields: string[];
	alignment: number;       // Gap between Location IQ and Fit IQ
	archetype: string;       // Which demand archetype this business maps to
	archetypeScore: number;  // The pre-computed archetype baseline for this location
	dynamicConfigApplied?: boolean;  // true when concept-specific answers reshaped the config
	/** V5 neighborhood intelligence signals used in scoring */
	neighborhoodIntel?: {
		neighborhoodHealth: number | null;
		survivalRate: number | null;
		haloScore: number | null;
		haloConceptType: string;
		neighborhoodBlendWeight: number;
		haloBlendWeight: number;
	};
}

// ── Business Type → Archetype Mapping ──


// 04.19.2026 13:35 Score Consolidation — BusinessConfig and Archetype types
// moved to fit-dimensions.ts. Imported at the top of this file.

import type { ValidBusinessType } from '$lib/intel/registry/business-type-registry';

const BUSINESS_CONFIGS: Record<ValidBusinessType | string, BusinessConfig> = {
	// Routine Interceptor businesses — need foot traffic + habitual visits
	'specialty_coffee': {
		archetype: 'routine_interceptor',
		dimensions: ['Foot Traffic Fit', 'Competition Fit', 'Demographics Fit', 'Rent Fit'],
		dimWeights: [0.35, 0.25, 0.20, 0.20],
		idealIncome: [50000, 150000],
		idealRent: 8000,
	},
	'fast_casual': {
		archetype: 'routine_interceptor',
		dimensions: ['Foot Traffic Fit', 'Competition Fit', 'Demographics Fit', 'Rent Fit'],
		dimWeights: [0.30, 0.25, 0.25, 0.20],
		idealIncome: [40000, 120000],
		idealRent: 10000,
	},
	'bakery': {
		archetype: 'routine_interceptor',
		dimensions: ['Foot Traffic Fit', 'Competition Fit', 'Demographics Fit', 'Rent Fit'],
		dimWeights: [0.35, 0.20, 0.25, 0.20],
		idealIncome: [45000, 130000],
		idealRent: 7000,
	},
	'deli': {
		archetype: 'routine_interceptor',
		dimensions: ['Foot Traffic Fit', 'Competition Fit', 'Demographics Fit', 'Rent Fit'],
		dimWeights: [0.35, 0.25, 0.20, 0.20],
		idealIncome: [35000, 100000],
		idealRent: 6000,
	},
	'dry-cleaning': {
		archetype: 'routine_interceptor',
		dimensions: ['Foot Traffic Fit', 'Competition Fit', 'Demographics Fit', 'Rent Fit'],
		dimWeights: [0.25, 0.30, 0.25, 0.20],
		idealIncome: [50000, 150000],
		idealRent: 5000,
	},

	// Destination Pull businesses — people make a trip specifically for this
	'restaurant': {
		archetype: 'destination_pull',
		dimensions: ['Dining Demand', 'Competition Density', 'Nightlife Score', 'Area Income'],
		dimWeights: [0.30, 0.25, 0.20, 0.25],
		idealIncome: [60000, 200000],
		idealRent: 15000,
	},
	'bar': {
		archetype: 'destination_pull',
		dimensions: ['Nightlife Demand', 'Competition Fit', 'Age Demographics', 'License Density'],
		dimWeights: [0.30, 0.25, 0.25, 0.20],
		idealIncome: [50000, 150000],
		idealRent: 12000,
	},
	'lounge': {
		archetype: 'destination_pull',
		dimensions: ['Nightlife Demand', 'Competition Fit', 'Age Demographics', 'License Density'],
		dimWeights: [0.30, 0.25, 0.25, 0.20],
		idealIncome: [60000, 180000],
		idealRent: 15000,
	},
	'boutique': {
		archetype: 'destination_pull',
		dimensions: ['Foot Traffic Fit', 'Shopping Density', 'Income Match', 'Rent Fit'],
		dimWeights: [0.25, 0.25, 0.30, 0.20],
		idealIncome: [70000, 200000],
		idealRent: 10000,
	},
	'spa': {
		archetype: 'destination_pull',
		dimensions: ['Income Level', 'Competition Gap', 'Parking/Transit', 'Demographics'],
		dimWeights: [0.30, 0.25, 0.20, 0.25],
		idealIncome: [70000, 200000],
		idealRent: 8000,
	},
	'wellness': {
		archetype: 'destination_pull',
		dimensions: ['Income Level', 'Competition Gap', 'Parking/Transit', 'Demographics'],
		dimWeights: [0.30, 0.25, 0.20, 0.25],
		idealIncome: [60000, 180000],
		idealRent: 7000,
	},

	// Need Filler businesses — essential goods, residential demand
	'fitness': {
		archetype: 'need_filler',
		dimensions: ['Health-Conscious Pop', 'Competition Gap', 'Parking/Transit', 'Daytime Traffic'],
		dimWeights: [0.30, 0.25, 0.25, 0.20],
		idealIncome: [50000, 150000],
		idealRent: 8000,
	},
	'gym': {
		archetype: 'need_filler',
		dimensions: ['Health-Conscious Pop', 'Competition Gap', 'Parking/Transit', 'Daytime Traffic'],
		dimWeights: [0.30, 0.25, 0.25, 0.20],
		idealIncome: [50000, 150000],
		idealRent: 10000,
	},
	'retail': {
		archetype: 'need_filler',
		dimensions: ['Foot Traffic', 'Shopping Density', 'Income Match', 'Rent Fit'],
		dimWeights: [0.25, 0.25, 0.25, 0.25],
		idealIncome: [40000, 120000],
		idealRent: 8000,
	},
	'tutoring': {
		archetype: 'need_filler',
		dimensions: ['Family Density', 'School Proximity', 'Transit Access', 'Income Match'],
		dimWeights: [0.30, 0.25, 0.20, 0.25],
		idealIncome: [50000, 150000],
		idealRent: 4000,
	},
	'medical': {
		archetype: 'need_filler',
		dimensions: ['Population Density', 'Healthcare Gap', 'Transit Access', 'Insurance Demographics'],
		dimWeights: [0.25, 0.30, 0.20, 0.25],
		idealIncome: [40000, 120000],
		idealRent: 8000,
	},
	'dental': {
		archetype: 'need_filler',
		dimensions: ['Population Density', 'Healthcare Gap', 'Transit Access', 'Insurance Demographics'],
		dimWeights: [0.25, 0.30, 0.20, 0.25],
		idealIncome: [45000, 130000],
		idealRent: 7000,
	},
	'grocery': {
		archetype: 'need_filler',
		dimensions: ['Population Density', 'Market Gap', 'Transit Access', 'Rent Fit'],
		dimWeights: [0.30, 0.30, 0.15, 0.25],
		idealIncome: [30000, 100000],
		idealRent: 10000,
	},
	'pharmacy': {
		archetype: 'need_filler',
		dimensions: ['Population Density', 'Healthcare Gap', 'Transit Access', 'Demographics'],
		dimWeights: [0.30, 0.25, 0.20, 0.25],
		idealIncome: [35000, 100000],
		idealRent: 6000,
	},
	'laundromat': {
		archetype: 'need_filler',
		dimensions: ['Population Density', 'Market Gap', 'Renter Density', 'Rent Fit'],
		dimWeights: [0.25, 0.30, 0.25, 0.20],
		idealIncome: [25000, 80000],
		idealRent: 4000,
	},
};

// Default config for unknown business types
const DEFAULT_CONFIG: BusinessConfig = {
	archetype: 'routine_interceptor',
	dimensions: ['Foot Traffic Fit', 'Competition Fit', 'Demographics Fit', 'Rent Fit'],
	dimWeights: [0.25, 0.25, 0.25, 0.25],
	idealIncome: [40000, 150000],
	idealRent: 8000,
};

// ─────────────────────────────────────────────────
// Phase 4 Extraction — fit-dimensions.ts
// 04.19.2026 13:35 Score Consolidation — all pure dimension scoring functions
// extracted to '$lib/intel/scoring/fit-dimensions' for independent testability.
// Extracted (18 functions): expandVariance, scoreFootTraffic, scoreCompetition,
//   scoreDemographics, scoreRentFit, scoreNightlife, scoreIncome, scoreTransitAccess,
//   scorePopulationDensity, scoreMarketGap, scoreFamilyDensity, scoreAgeDemographics,
//   scoreHealthConscious, scoreRenterDensity, computeDimension, applyRiskTolerance,
//   applyExperience, parseRentBudget
// Deleted: grade() — stale duplicate removed 04.19.2026 13:35 Score Consolidation
// ─────────────────────────────────────────────────
import {
	expandVariance,
	computeDimension,
	applyRiskTolerance,
	applyExperience,
	parseRentBudget,
	type BlockGroupData,
	type BusinessConfig,
} from '$lib/intel/scoring/fit-dimensions';

function resolveConfig(businessType: string): BusinessConfig {
	const key = businessType.toLowerCase().replace(/[\s\/]+/g, '-');
	return BUSINESS_CONFIGS[key] || DEFAULT_CONFIG;
}

// BlockGroupData type now lives in '$lib/intel/scoring/fit-dimensions' (imported above)
// 04.19.2026 13:35 Score Consolidation — extracted from fit-iq-engine.ts line 298

async function loadBlockGroupData(geoid: string): Promise<BlockGroupData> {
	// Fetch from all three tables in parallel using Drizzle
	const [intelRes, enrichedRes, scoresRes] = await Promise.all([
		db.execute(sql`SELECT source, data FROM block_group_intel WHERE geoid = ${geoid}`),
		db.execute(sql`SELECT entity_category, entity_data FROM enriched_entities WHERE location_key = ${geoid} AND entity_type = 'block_group_intel'`),
		db.execute(sql`SELECT score_type, score, components FROM block_group_scores WHERE geoid = ${geoid}`)
	]);

	const intel: Record<string, any> = {};
	if (intelRes.rows) {
		for (const row of intelRes.rows) intel[row.source as string] = row.data;
	}

	const enriched: Record<string, any> = {};
	if (enrichedRes.rows) {
		for (const row of enrichedRes.rows) enriched[row.entity_category as string] = row.entity_data;
	}

	const scores: Record<string, any> = {};
	if (scoresRes.rows) {
		for (const row of scoresRes.rows) {
			scores[row.score_type as string] = { score: row.score ?? 0, components: row.components ?? {} };
		}
	}

	return { intel, enriched, scores };
}

// ── Dimension Scoring Functions ──
// 04.19.2026 13:35 Score Consolidation — all dimension scorers extracted to fit-dimensions.ts
// scoreFootTraffic, scoreCompetition, scoreDemographics, scoreRentFit, scoreNightlife,
// scoreIncome, scoreTransitAccess, scorePopulationDensity, scoreMarketGap, scoreFamilyDensity,
// scoreAgeDemographics, scoreHealthConscious, scoreRenterDensity, computeDimension,
// applyRiskTolerance, applyExperience, parseRentBudget — all imported above.

function computeFitProgress(launchpad: LaunchpadProfile): { progress: number; missing: string[] } {
	const fields = [
		{ key: 'businessType', label: 'business_type' },
		{ key: 'budget', label: 'budget' },
		{ key: 'rent', label: 'rent' },
		{ key: 'targetCustomer', label: 'target_customer' },
		{ key: 'ownerType', label: 'owner_type' },
		{ key: 'riskTolerance', label: 'risk_tolerance' },
		{ key: 'experience', label: 'experience' },
		{ key: 'hours', label: 'hours' },
		{ key: 'vision', label: 'vision' },
	];

	const missing: string[] = [];
	let filled = 0;

	for (const f of fields) {
		const val = (launchpad as any)[f.key];
		if (val && String(val).trim()) filled++;
		else missing.push(f.label);
	}

	return { progress: Math.round(filled / fields.length * 100), missing };
}

// ── Dynamic Config → Static Config Bridge ──
// Merges dynamic concept config overrides into the static BusinessConfig
// so the existing dimension scorers can use them without rewriting everything.

function applyDynamicOverrides(
	staticConfig: BusinessConfig,
	dynamic: DynamicConceptConfig
): BusinessConfig {
	const merged = { ...staticConfig };

	// Income range override
	merged.idealIncome = [dynamic.incomeMin, dynamic.incomeSweet];

	// Archetype override
	merged.archetype = dynamic.archetype;

	// Weight overrides → remap to dimension weights
	// The static config has 4 dimensions with fixed labels.
	// Dynamic config has named weight overrides (competition, demographics, etc.)
	// We map the named overrides to the dimension positions by label matching.
	if (dynamic.weightOverrides) {
		const wo = dynamic.weightOverrides;
		const newWeights = [...merged.dimWeights];

		for (let i = 0; i < merged.dimensions.length; i++) {
			const label = merged.dimensions[i].toLowerCase();
			if (wo.competition !== undefined && label.includes('competition')) {
				newWeights[i] = wo.competition;
			}
			if (wo.demographics !== undefined && (label.includes('demographics') || label.includes('income'))) {
				newWeights[i] = wo.demographics;
			}
			if (wo.accessibility !== undefined && (label.includes('foot traffic') || label.includes('transit') || label.includes('parking'))) {
				newWeights[i] = wo.accessibility;
			}
			if (wo.vibrancy !== undefined && (label.includes('nightlife') || label.includes('dining'))) {
				newWeights[i] = wo.vibrancy;
			}
		}

		// Normalize weights to sum to 1.0
		const sum = newWeights.reduce((a, b) => a + b, 0);
		if (sum > 0) {
			merged.dimWeights = newWeights.map(w => w / sum);
		}
	}

	return merged;
}

// ── Main Entry Point ──

export async function computeFitIQ(geoid: string, launchpad: LaunchpadProfile): Promise<FitIQResult> {
	let config = resolveConfig(launchpad.businessType);

	// ── Dynamic concept config: reshape config based on user's concept-specific answers ──
	let dynamicConfig: DynamicConceptConfig | null = null;
	if (launchpad.conceptAnswers && Object.keys(launchpad.conceptAnswers).length > 0) {
		try {
			dynamicConfig = buildDynamicConfig(launchpad.businessType, launchpad.conceptAnswers);
			config = applyDynamicOverrides(config, dynamicConfig);
		} catch (err) {
			// If dynamic config fails (e.g., unknown concept type mapping), fall through to static
			console.warn('[FitIQ] Dynamic config build failed, using static config:', err instanceof Error ? err.message : err);
		}
	}

	const data = await loadBlockGroupData(geoid);

	// Get Location IQ for alignment calculation
	const locationIQ = data.scores['location_iq']?.score ?? 50;

	// Get archetype baseline score — uses dynamic archetype if available
	const archetypeKey = config.archetype === 'routine_interceptor'
		? 'archetype_routine_interceptor'
		: config.archetype === 'destination_pull'
			? 'archetype_destination_pull'
			: 'archetype_need_filler';
	const archetypeScore = data.scores[archetypeKey]?.score ?? 50;

	// Safety score for risk tolerance adjustment
	const safetyScore = data.scores['six_safety']?.score ?? 70;

	// Compute each dimension
	let dimensions: FitDimension[] = config.dimensions.map((label, i) => {
		const { score, explanation } = computeDimension(label, data, launchpad, config);
		return { label, score, weight: config.dimWeights[i], explanation };
	});

	// ── Dynamic scoring adjustments ──
	// When dynamic config provides traffic dependencies, scale the relevant dimensions
	if (dynamicConfig) {
		dimensions = dimensions.map(d => {
			const label = d.label.toLowerCase();

			// Foot traffic dependency: scales foot-traffic-related dimension scores
			// High dependency (0.9) = full weight on foot traffic score
			// Low dependency (0.2) = dampen foot traffic impact, regress toward 60
			if (label.includes('foot traffic') || label.includes('dining demand') || label.includes('daytime')) {
				const dep = dynamicConfig!.footTrafficDependency;
				const adjusted = Math.round(d.score * dep + 60 * (1 - dep));
				return {
					...d,
					score: clamp(adjusted),
					explanation: d.explanation + ` (foot traffic dependency: ${Math.round(dep * 100)}%)`,
				};
			}

			// Transit dependency: scales transit/parking dimensions
			if (label.includes('transit') || label.includes('parking')) {
				const dep = dynamicConfig!.transitDependency;
				const adjusted = Math.round(d.score * dep + 60 * (1 - dep));
				return {
					...d,
					score: clamp(adjusted),
					explanation: d.explanation + ` (transit dependency: ${Math.round(dep * 100)}%)`,
				};
			}

			return d;
		});
	}

	// Apply risk tolerance adjustment
	dimensions = applyRiskTolerance(dimensions, launchpad.riskTolerance || '', safetyScore);

	// Expand each dimension score to undo sub-component averaging compression
	dimensions = dimensions.map(d => ({
		...d,
		score: expandVariance(d.score, 1.5),
	}));

	// Compute weighted average of expanded dimensions
	let rawFitIQ = 0;
	for (const d of dimensions) {
		rawFitIQ += d.score * d.weight;
	}

	// ── V5 neighborhood intelligence blend ──
	// These are the most predictive signals (ρ=0.37-0.57) — blend into Fit IQ
	const neighborhoodHealth = data.scores['six_neighborhood_health']?.score;
	const survivalRate = data.scores['six_survival_rate']?.score;

	// Halo effect: concept-specific star proximity boost
	const conceptType = resolveConceptType(launchpad.businessType);
	const haloScore = data.scores[`halo:${conceptType}`]?.score
		?? data.scores['halo:general']?.score;

	// Neighborhood signals carry ~25% of Fit IQ when available
	// This rebalances from 70% dimensions / 30% archetype to:
	//   50% dimensions + 20% neighborhood + 10% archetype + 10% halo (if present)
	//   or 55% dimensions + 25% neighborhood + 20% archetype (if no halo)
	let neighborhoodBlend = 50; // neutral default
	let neighborhoodSignals = 0;

	if (neighborhoodHealth != null) {
		neighborhoodBlend = neighborhoodHealth;
		neighborhoodSignals++;
	}
	if (survivalRate != null) {
		neighborhoodBlend = neighborhoodSignals > 0
			? Math.round(neighborhoodBlend * 0.45 + survivalRate * 0.55)
			: survivalRate;
		neighborhoodSignals++;
	}

	if (neighborhoodSignals > 0 && haloScore != null && haloScore > 40) {
		// Full V5 blend: dimensions + neighborhood + archetype + halo
		rawFitIQ = Math.round(
			rawFitIQ * 0.50 +
			neighborhoodBlend * 0.20 +
			archetypeScore * 0.10 +
			haloScore * 0.20
		);
	} else if (neighborhoodSignals > 0) {
		// V5 blend without halo: dimensions + neighborhood + archetype
		rawFitIQ = Math.round(
			rawFitIQ * 0.55 +
			neighborhoodBlend * 0.25 +
			archetypeScore * 0.20
		);
	} else {
		// Original blend: dimensions + archetype (no neighborhood data)
		rawFitIQ = Math.round(rawFitIQ * 0.70 + archetypeScore * 0.30);
	}

	// Apply experience adjustment
	rawFitIQ = applyExperience(rawFitIQ, launchpad.experience || '');

	// Post-composite variance expansion: guarantees ≥ 25-pt spread between bad/good locations
	const fitIQ = expandVariance(clamp(rawFitIQ), 1.55);
	const { progress, missing } = computeFitProgress(launchpad);

	return {
		fitIQ,
		grade: scoreToGrade(fitIQ),
		dimensions,
		fitProgress: progress,
		missingFields: missing,
		alignment: fitIQ - locationIQ,
		archetype: config.archetype.replace(/_/g, ' '),
		archetypeScore,
		...(dynamicConfig ? { dynamicConfigApplied: true } : {}),
		// V5 neighborhood intelligence (for transparency in UI)
		neighborhoodIntel: {
			neighborhoodHealth: neighborhoodHealth ?? null,
			survivalRate: survivalRate ?? null,
			haloScore: haloScore ?? null,
			haloConceptType: conceptType,
			neighborhoodBlendWeight: neighborhoodSignals > 0 ? (haloScore != null && haloScore > 40 ? 0.20 : 0.25) : 0,
			haloBlendWeight: neighborhoodSignals > 0 && haloScore != null && haloScore > 40 ? 0.20 : 0,
		},
	};
}
