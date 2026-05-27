/**
 * ═══════════════════════════════════════════════════════
 * RE² Persona Configuration Engine
 * ═══════════════════════════════════════════════════════
 *
 * Defines 10 business persona types with:
 * - Weight profiles for the 6-index scoring model
 * - Persona-specific spoke labels for Compass visualization
 * - Hero copy, archetype badges, and concept placeholders
 * - Composite score computation using persona weights
 *
 * Each persona maps to an existing bizType/bizCategory in the store.
 */

import { BUSINESS_TYPE_CONFIGS } from './registry/business-type-registry';
import type { IndexName } from './six-index';

/**
 * The 6 scoring indices that must sum to 1.0 per persona.
 * Imported from six-index and re-exported here for backward compatibility.
 */
export type { IndexName } from './six-index';

/**
 * The 6 persona-specific scoring dimensions (subset of IndexName, excluding
 * neighborhoodHealth and survivalRate which are computed separately).
 */
export type PersonaIndexName = 'transit' | 'competition' | 'demographics' | 'vibrancy' | 'safety' | 'momentum';

/**
 * Supported persona types
 */
export type PersonaType = 'coffee' | 'restaurant' | 'gym' | 'dentist' | 'spa' | 'bodega' | 'bakery' | 'barber' | 'boutique' | 'florist';

/**
 * Weight profile for a persona — 6 indices that sum to 1.0
 */
export interface PersonaWeights {
	transit: number;
	competition: number;
	demographics: number;
	vibrancy: number;
	safety: number;
	momentum: number;
}

/**
 * Spoke label set for Compass visualization
 * Order: [transit, competition, demographics, vibrancy, safety, momentum]
 */
export interface SpokeLabels {
	transit: string;
	competition: string;
	demographics: string;
	vibrancy: string;
	safety: string;
	momentum: string;
}

/**
 * Complete persona configuration
 */
export interface PersonaConfig {
	personaType: PersonaType;
	label: string;
	emoji: string;
	heroCopy: string;
	archetypeBadge: string;
	conceptPlaceholder: string;
	weights: PersonaWeights;
	spokeLabels: SpokeLabels;
	bizType: string;
	bizCategory: string;
}

/**
 * Load persona defaults from JSON — single source of truth.
 * Override with Supabase rows (persona_configs table) when available.
 */
import DEFAULTS from './persona-defaults.json';

// Runtime override registry — populated by loadPersonaOverrides()
const _overrides = new Map<string, Partial<PersonaConfig>>();


function getDefault(type: string): Record<string, unknown> | null {
	return (DEFAULTS as Record<string, Record<string, unknown>>)[type] || null;
}

/**
 * Weight profiles for all 10 personas
 * Each persona's weights sum to 1.0
 */
/**
 * Weight profiles for all 10 personas.
 * The persona alias keys (e.g. 'coffee', 'gym') map to registry weights
 * so both pipelines stay in sync. The 6-index model omits neighborhoodHealth
 * and survivalRate (those are computed separately), so we pull the 6
 * normalized sub-weights from the registry and re-proportion them to 1.0.
 */
function registryWeightsFor(canonicalKey: keyof typeof BUSINESS_TYPE_CONFIGS): PersonaWeights {
	const w = BUSINESS_TYPE_CONFIGS[canonicalKey]?.weights;
	if (!w) return { transit: 0.17, competition: 0.17, demographics: 0.17, vibrancy: 0.17, safety: 0.16, momentum: 0.16 };
	// Pull the 6 sub-weights (excluding neighborhoodHealth + survivalRate)
	const sub = { transit: w.transit, competition: w.competition, demographics: w.demographics, vibrancy: w.vibrancy, safety: w.safety, momentum: w.momentum };
	const total = Object.values(sub).reduce((a, b) => a + b, 0);
	const norm = (v: number) => Math.round((v / total) * 1000) / 1000;
	return { transit: norm(sub.transit), competition: norm(sub.competition), demographics: norm(sub.demographics), vibrancy: norm(sub.vibrancy), safety: norm(sub.safety), momentum: norm(sub.momentum) };
}

export const PERSONA_WEIGHTS: Record<PersonaType, PersonaWeights> = {
	coffee:     registryWeightsFor('specialty_coffee'),
	restaurant: registryWeightsFor('full_service_restaurant'),
	gym:        registryWeightsFor('fitness_studio'),
	dentist:    registryWeightsFor('medical_office'),
	spa:        registryWeightsFor('wellness_spa'),
	bodega:     registryWeightsFor('retail'),
	bakery:     registryWeightsFor('bakery'),
	barber:     registryWeightsFor('personal_services'),
	boutique:   registryWeightsFor('retail'),
	florist:    registryWeightsFor('florist'),
};

/**
 * Spoke labels for Compass visualization
 * Order: [transit, competition, demographics, vibrancy, safety, momentum]
 */
export const SPOKE_LABELS: Record<PersonaType, SpokeLabels> = {
	coffee: {
		transit: 'The Rush',
		competition: 'Blue Ocean',
		demographics: 'The Tribe',
		vibrancy: 'Force Multiplier',
		safety: 'The Shield',
		momentum: 'The Wave'
	},
	restaurant: {
		transit: 'The Draw',
		competition: 'White Space',
		demographics: 'The Palette',
		vibrancy: 'The Scene',
		safety: 'Night Watch',
		momentum: 'The Wave'
	},
	gym: {
		transit: 'The Commute',
		competition: 'Open Mat',
		demographics: 'The Pack',
		vibrancy: 'Wellness Corridor',
		safety: 'The Wave',
		momentum: 'Dawn Patrol'
	},
	dentist: {
		transit: 'The Drive-By',
		competition: 'Chair Gap',
		demographics: 'The Families',
		vibrancy: 'The Strip',
		safety: 'Safe Walk',
		momentum: 'The Wave'
	},
	spa: {
		transit: 'The Reach',
		competition: 'Uncharted',
		demographics: 'The Clientele',
		vibrancy: 'The Corridor',
		safety: 'The Haven',
		momentum: 'The Wave'
	},
	bodega: {
		transit: 'The Corner',
		competition: 'Block Claim',
		demographics: 'The Block',
		vibrancy: 'The Anchor',
		safety: 'Block Watch',
		momentum: 'The Wave'
	},
	bakery: {
		transit: 'The Rush',
		competition: 'Blue Ocean',
		demographics: 'The Tribe',
		vibrancy: 'Force Multiplier',
		safety: 'The Shield',
		momentum: 'The Wave'
	},
	barber: {
		transit: 'The Commute',
		competition: 'Open Mat',
		demographics: 'The Pack',
		vibrancy: 'The Scene',
		safety: 'Block Watch',
		momentum: 'The Wave'
	},
	boutique: {
		transit: 'The Rush',
		competition: 'Blue Ocean',
		demographics: 'The Tribe',
		vibrancy: 'The Corridor',
		safety: 'The Shield',
		momentum: 'The Wave'
	},
	florist: {
		transit: 'The Rush',
		competition: 'Blue Ocean',
		demographics: 'The Tribe',
		vibrancy: 'Force Multiplier',
		safety: 'The Shield',
		momentum: 'The Wave'
	}
};

/**
 * Hero copy — the elevator pitch for each persona
 */
export const HERO_COPY: Record<PersonaType, string> = {
	coffee: 'Your morning rush. Your corner. Your score.',
	restaurant: 'Your cuisine. Your crowd. Your score.',
	gym: 'Your tribe. Your energy. Your score.',
	dentist: 'Your patients. Your practice. Your score.',
	spa: 'Your sanctuary. Your clientele. Your score.',
	bodega: 'Your block. Your community. Your score.',
	bakery: 'Your mornings. Your neighborhood. Your score.',
	barber: 'Your chair. Your regulars. Your score.',
	boutique: 'Your style. Your discovery. Your score.',
	florist: 'Your beauty. Your block. Your score.'
};

/**
 * Archetype badges — emoji + descriptor
 */
export const ARCHETYPE_BADGES: Record<PersonaType, string> = {
	coffee: '☕ The Community Curator',
	restaurant: '🍽️ The Experience Architect',
	gym: '🏋️ The Transformation Leader',
	dentist: '🦷 The Practice Builder',
	spa: '🧖 The Sanctuary Creator',
	bodega: '🏪 The Neighborhood Anchor',
	bakery: '🥐 The Morning Ritual Maker',
	barber: '💈 The Neighborhood Institution',
	boutique: '👗 The Taste Curator',
	florist: '💐 The Impulse Alchemist'
};

/**
 * Persona emojis
 */
export const PERSONA_EMOJI: Record<PersonaType, string> = {
	coffee: '☕',
	restaurant: '🍽️',
	gym: '🏋️',
	dentist: '🦷',
	spa: '🧖',
	bodega: '🏪',
	bakery: '🥐',
	barber: '💈',
	boutique: '👗',
	florist: '💐'
};

/**
 * Concept placeholders — example text for onboarding textarea
 */
export const CONCEPT_PLACEHOLDERS: Record<PersonaType, string> = {
	coffee: 'e.g., Protein coffee + smoothie bar, grab-and-go, near a gym',
	restaurant: 'e.g., Upscale Korean BBQ with full cocktail bar, dinner only',
	gym: 'e.g., Women\'s CrossFit box with childcare, morning focus',
	dentist: 'e.g., Family general dentistry, pediatric focus, Saturday hours',
	spa: 'e.g., Luxury day spa focused on bridal parties and corporate wellness',
	bodega: 'e.g., 24-hour deli with fresh juice bar and hot food counter',
	bakery: 'e.g., Sourdough bakery with morning coffee service, wholesale accounts',
	barber: 'e.g., High-end grooming lounge, appointments only, beard specialist',
	boutique: 'e.g., Curated vintage streetwear, consignment model, Instagram-first',
	florist: 'e.g., Wedding + event florals with a walk-in retail front'
};

/**
 * Mapping from persona type to canonical registry keys and display bizType.
 * bizCategory MUST match a ValidBusinessType so normalizeBusinessType() resolves it.
 */
export const PERSONA_BIZ_MAPPING: Record<PersonaType, { bizType: string; bizCategory: string }> = {
	coffee:     { bizType: 'Specialty Coffee / Café',       bizCategory: 'specialty_coffee' },
	restaurant: { bizType: 'Full-Service Restaurant',       bizCategory: 'full_service_restaurant' },
	gym:        { bizType: 'Fitness Studio',                bizCategory: 'fitness_studio' },
	dentist:    { bizType: 'Medical / Dental Office',       bizCategory: 'medical_office' },
	spa:        { bizType: 'Wellness / Spa',                bizCategory: 'wellness_spa' },
	bodega:     { bizType: 'Grocery / Specialty Food',      bizCategory: 'retail' },
	bakery:     { bizType: 'Bakery / Café',                 bizCategory: 'bakery' },
	barber:     { bizType: 'Salon / Spa / Barbershop',      bizCategory: 'personal_services' },
	boutique:   { bizType: 'Retail',                        bizCategory: 'retail' },
	florist:    { bizType: 'Florist',                       bizCategory: 'florist' },
};

/**
 * Get the full persona configuration for a given type
 * @param personaType - The persona type (e.g., 'coffee', 'restaurant')
 * @returns Complete PersonaConfig or null if not found
 */
export function getPersonaConfig(personaType: string): PersonaConfig | null {
	// First check Supabase overrides
	const override = _overrides.get(personaType);

	// Then check JSON defaults for dynamic persona types not in the TypeScript enum
	const jsonDefault = getDefault(personaType);

	if (!isValidPersonaType(personaType) && !jsonDefault && !override) {
		return null;
	}

	const type = personaType as PersonaType;

	// Build config: TypeScript defaults → JSON defaults → Supabase overrides
	const bizMapping = isValidPersonaType(personaType) ? PERSONA_BIZ_MAPPING[type] : { bizType: 'Other', bizCategory: 'other' };

	const base: PersonaConfig = {
		personaType: type,
		label: (jsonDefault?.label as string) || (isValidPersonaType(personaType) ? getPersonaLabel(type) : personaType),
		emoji: (jsonDefault?.emoji as string) || (isValidPersonaType(personaType) ? PERSONA_EMOJI[type] : '📍'),
		heroCopy: (jsonDefault?.heroCopy as string) || (isValidPersonaType(personaType) ? HERO_COPY[type] : 'Your concept. Your location. Your score.'),
		archetypeBadge: (jsonDefault?.archetype as string) || (isValidPersonaType(personaType) ? ARCHETYPE_BADGES[type] : 'The Founder'),
		conceptPlaceholder: (jsonDefault?.conceptPlaceholder as string) || (isValidPersonaType(personaType) ? CONCEPT_PLACEHOLDERS[type] : 'Describe your business concept...'),
		weights: (jsonDefault?.weights as PersonaWeights) || (isValidPersonaType(personaType) ? PERSONA_WEIGHTS[type] : { transit: 0.17, competition: 0.17, demographics: 0.17, vibrancy: 0.17, safety: 0.16, momentum: 0.16 }),
		spokeLabels: (jsonDefault?.spokeLabels as SpokeLabels) || (isValidPersonaType(personaType) ? SPOKE_LABELS[type] : { transit: 'Transit', competition: 'Competition', demographics: 'Demographics', vibrancy: 'Concept Pulse', safety: 'Safety', momentum: 'Momentum' }),
		bizType: (jsonDefault?.bizType as string) || bizMapping.bizType,
		bizCategory: (jsonDefault?.bizCategory as string) || bizMapping.bizCategory
	};

	// Apply Supabase overrides on top
	if (override) {
		return { ...base, ...override, personaType: type };
	}

	return base;
}

/**
 * Compute composite score using persona-specific weights
 * @param personaType - The persona type
 * @param indexScores - Raw scores for each of the 6 indices (0-100)
 * @returns Weighted composite score (0-100), or null if persona not found
 */
export function computePersonaScore(
	personaType: string,
	indexScores: Record<PersonaIndexName, number>
): number | null {
	if (!isValidPersonaType(personaType)) {
		return null;
	}

	const type = personaType as PersonaType;
	const weights = PERSONA_WEIGHTS[type];

	// Normalize each index score to 0-1 range
	const normalizedScores: Record<PersonaIndexName, number> = {
		transit:      Math.max(0, Math.min(1, indexScores.transit / 100)),
		competition:  Math.max(0, Math.min(1, indexScores.competition / 100)),
		demographics: Math.max(0, Math.min(1, indexScores.demographics / 100)),
		vibrancy:     Math.max(0, Math.min(1, indexScores.vibrancy / 100)),
		safety:       Math.max(0, Math.min(1, indexScores.safety / 100)),
		momentum:     Math.max(0, Math.min(1, indexScores.momentum / 100)),
	};

	// Compute weighted sum
	const compositeNormalized =
		normalizedScores.transit * weights.transit +
		normalizedScores.competition * weights.competition +
		normalizedScores.demographics * weights.demographics +
		normalizedScores.vibrancy * weights.vibrancy +
		normalizedScores.safety * weights.safety +
		normalizedScores.momentum * weights.momentum;

	// Scale back to 0-100 and round
	return Math.round(compositeNormalized * 100);
}

/**
 * Get the weight profile for a given persona
 * @param personaType - The persona type
 * @returns Weight profile (indices sum to 1.0), or null if not found
 */
export function getPersonaWeights(personaType: string): PersonaWeights | null {
	if (!isValidPersonaType(personaType)) {
		return null;
	}

	return { ...PERSONA_WEIGHTS[personaType as PersonaType] };
}

/**
 * Get the spoke labels for a given persona
 * @param personaType - The persona type
 * @returns SpokeLabels, or null if not found
 */
export function getPersonaSpokeLabels(personaType: string): SpokeLabels | null {
	if (!isValidPersonaType(personaType)) {
		return null;
	}

	return { ...SPOKE_LABELS[personaType as PersonaType] };
}


/**
 * Get human-readable label for a persona type
 * @param personaType - The persona type
 * @returns Display label
 */
export function getPersonaLabel(personaType: PersonaType): string {
	const labels: Record<PersonaType, string> = {
		coffee: 'Specialty Coffee / Café',
		restaurant: 'Restaurant',
		gym: 'Fitness Studio',
		dentist: 'Dental Practice',
		spa: 'Spa / Wellness',
		bodega: 'Bodega / Convenience',
		bakery: 'Bakery',
		barber: 'Barbershop / Salon',
		boutique: 'Boutique Retail',
		florist: 'Florist'
	};

	return labels[personaType];
}

/**
 * Check if a string is a valid persona type
 * @param value - The value to check
 * @returns True if the value is a valid PersonaType
 */
export function isValidPersonaType(value: string): value is PersonaType {
	const validTypes: PersonaType[] = [
		'coffee',
		'restaurant',
		'gym',
		'dentist',
		'spa',
		'bodega',
		'bakery',
		'barber',
		'boutique',
		'florist'
	];

	return validTypes.includes(value as PersonaType);
}



/**
 * Apply scoring hints from onboarding question answers to base persona weights.
 * Hints are additive deltas (e.g., +0.05 = add 5% to that index).
 * After applying, weights are re-normalized to sum to 1.0.
 *
 * @param personaType - The persona type for base weights
 * @param scoringHints - Object mapping index names to additive deltas
 * @returns Adjusted weights that sum to 1.0, or base weights if persona not found
 */
export function applyScoringHints(
	personaType: string,
	scoringHints: Partial<Record<PersonaIndexName, number>>
): PersonaWeights {
	// Get base weights
	const base = getPersonaWeights(personaType);
	if (!base) {
		return { transit: 0.17, competition: 0.17, demographics: 0.17, vibrancy: 0.17, safety: 0.16, momentum: 0.16 };
	}

	// Apply additive deltas
	const adjusted = { ...base } as Record<PersonaIndexName, number>;
	const indices: PersonaIndexName[] = ['transit', 'competition', 'demographics', 'vibrancy', 'safety', 'momentum'];

	for (const idx of indices) {
		if (scoringHints[idx]) {
			adjusted[idx] = Math.max(0.01, adjusted[idx] + (scoringHints[idx] ?? 0));
		}
	}

	// Re-normalize to sum to 1.0
	const sum = indices.reduce((acc, idx) => acc + adjusted[idx], 0);
	for (const idx of indices) {
		adjusted[idx] = Math.round((adjusted[idx] / sum) * 1000) / 1000;
	}

	// Fix rounding remainder on last index
	const newSum = indices.reduce((acc, idx) => acc + adjusted[idx], 0);
	adjusted.momentum += Math.round((1.0 - newSum) * 1000) / 1000;

	return adjusted as PersonaWeights;
}

