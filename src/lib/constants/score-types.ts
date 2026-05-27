/**
 * F-07: Score Type Registry
 *
 * Canonical list of active vs deprecated score_type values in block_group_scores.
 * Consumers should only read ACTIVE types. Deprecated types are retained for
 * reference but should be cleaned from the database.
 */

// ─── Active score types (written by V4 batch scorer) ────────────────

/** Location IQ v2 — current production Location IQ score */
export const SCORE_TYPE_LOCATION_IQ = 'location_iq_v2' as const;

/** Location IQ sub-scores */
export const SCORE_TYPE_SUB_SAFETY = 'location_sub_safety' as const;
export const SCORE_TYPE_SUB_MOMENTUM = 'location_sub_momentum' as const;

/** Fit IQ — concept-specific fit score (suffixed with `:concept_type`) */
export const SCORE_TYPE_FIT_IQ_PREFIX = 'fit_score' as const;

/** Fit IQ sub-scores (suffixed with `:concept_type`) */
export const FIT_SUB_PREFIXES = [
	'fit_sub_market_proof',
	'fit_sub_accessibility',
	'fit_sub_vibrancy',
	'fit_sub_demographics',
	'fit_sub_competition',
	'fit_sub_price_income_fit',
] as const;

/** Vision IQ (suffixed with `:concept_type`) */
export const SCORE_TYPE_VISION_IQ_PREFIX = 'vision_iq' as const;

/** Six-index pillar scores (written by V4 batch scorer, concept-agnostic) */
export const SIX_INDEX_TYPES = [
	'six_transit',
	'six_demographics',
	'six_competition',
	'six_vibrancy',
	'six_safety',
	'six_momentum',
] as const;

// ─── Deprecated score types (V3 / legacy — should be purged) ────────

/**
 * DEPRECATED: These score_types were written by older scoring pipelines.
 * V4 batch scorer does NOT produce them. Any rows with these types in
 * block_group_scores are stale and should be deleted.
 *
 * - location_iq_v1: replaced by location_iq_v2
 * - six_neighborhood_health: V3 composite, replaced by six-index pillars
 * - six_survival_rate: V3 phantom score (hardcoded 55), replaced by survival-rate.ts pipeline
 * - six_commercial_density: V3 composite, replaced by six-index pillars
 * - halo:*: experimental halo scores, no longer consumed
 */
export const DEPRECATED_SCORE_TYPES = [
	'location_iq_v1',
	'six_neighborhood_health',
	'six_survival_rate',
	'six_commercial_density',
] as const;

export const DEPRECATED_SCORE_TYPE_PREFIXES = [
	'halo:',
] as const;

/** All active types for querying (non-prefixed) */
export const ACTIVE_SCORE_TYPES = [
	'location_iq',       // V4 legacy alias (still written alongside v2)
	'location_iq_v2',
	'location_sub_safety',
	'location_sub_momentum',
	...SIX_INDEX_TYPES,
] as const;

/**
 * Check if a score_type is deprecated and should be ignored.
 */
export function isDeprecatedScoreType(scoreType: string): boolean {
	if ((DEPRECATED_SCORE_TYPES as readonly string[]).includes(scoreType)) return true;
	return DEPRECATED_SCORE_TYPE_PREFIXES.some(p => scoreType.startsWith(p));
}
