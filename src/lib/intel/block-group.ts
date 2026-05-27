/**
 * ═══════════════════════════════════════════════════════
 * Block Group Intelligence Layer
 * ═══════════════════════════════════════════════════════
 *
 * Provides instant access to pre-computed scores and vision
 * narratives for NYC census block groups.
 *
 * ACTUAL SCHEMA:
 *   block_group_intel:   { geoid, source, data (jsonb) }  — one row per source
 *   block_group_scores:  { geoid, score_type, score, components }  — one row per score type
 *   block_group_visions: { geoid, vision_type, narrative, structured }  — one row per vision type
 *
 * Flow:
 *   1. lat/lng → FIPS GEOID (FCC Census Geocoder)
 *   2. GEOID → block_group_scores (instant Location IQ + Six-Index)
 *   3. GEOID → block_group_visions (instant vision narrative)
 */

import { getServiceSupabase } from '$lib/supabase-server';
import { normalizeBusinessType, VALID_BUSINESS_TYPES, BUSINESS_TYPE_CONFIGS } from './registry/business-type-registry';
import type { ValidBusinessType } from './registry/business-type-registry';

// ── V4 Valid Concept Types ──

export const VALID_CONCEPTS = [...VALID_BUSINESS_TYPES];
export type ConceptType = ValidBusinessType;

export function isValidConcept(value: string): value is ConceptType {
	return VALID_BUSINESS_TYPES.has(value as any);
}

// ── Types ──

export interface BlockGroupScores {
	geoid: string;
	location_iq: number;
	six_index: {
		transit: number;
		demographics: number;
		competition: number;
		vibrancy: number;
		safety: number;
		momentum: number;
	};
	niq?: number;
	siq?: number;
	tiq?: number;
	liq?: number;
	archetype_baselines?: {
		routine_interceptor: number;
		destination_pull: number;
		need_filler: number;
	};
	// ── Cycle 2H calibrated scores (Fit IQ) ──
	fit_score?: number;
	fit_grade?: string;
	fit_sub_scores?: {
		market_proof: number;
		accessibility: number;
		vibrancy: number;
		demographics: number;
		competition: number;
		price_income_fit: number;
	};
	fit_components?: Record<string, unknown>;
	// ── V4 Three-Score Architecture ──
	location_iq_v2?: number;
	location_iq_v2_grade?: string;
	location_iq_v2_components?: {
		locationIQ: number;
		marketProof: number;
		accessibility: number;
		vibrancy: number;
		demographics: number;
		safety: number;
		momentum: number;
		boroughBonus: number;
		grade: string;
	};
	vision_iq?: number;
	vision_iq_components?: {
		visionIQ: number;
		competition: number;
		priceIncomeFit: number;
		ageFit: number;
		ageFitNorm: number;
		conceptType: string;
	};
	safety_score?: number;
	momentum_score?: number;
	survival_rate?: number;       // six_survival_rate from block_group_scores
	neighborhood_health?: number; // six_neighborhood_health from block_group_scores
	concept_type?: string;
}

export interface BlockGroupVision {
	geoid: string;
	narrative: string;
	structured: {
		character: string;
		gaps: string;
		opportunities: string;
		momentum: string;
	};
	model: string;
	generated_at: string;
}

export interface BlockGroupResult {
	geoid: string;
	borough: string;
	scores: BlockGroupScores | null;
	vision: BlockGroupVision | null;
	serving_mode: 'stored' | 'stale_refresh' | 'cold';
}

// ── FIPS Lookup ──

const FIPS_CACHE: Record<string, string | null> = {};

/**
 * Convert lat/lng to Census Block Group GEOID via FCC Census Geocoder.
 * Returns a 12-digit GEOID (state + county + tract + block group).
 */
export async function latLngToGeoid(lat: number, lng: number): Promise<string | null> {
	const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
	if (cacheKey in FIPS_CACHE) return FIPS_CACHE[cacheKey];

	try {
		// Try FCC API first (primary source)
		const fccUrl = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&censusYear=2020&format=json`;
		const fccRes = await fetch(fccUrl, { signal: AbortSignal.timeout(10000) });

		if (fccRes.ok) {
			const fccData = await fccRes.json();
			const fips = fccData?.Block?.FIPS;

			if (fips && fips.length >= 12) {
				// FIPS is 15 digits (block level). Trim to 12 for block group.
				const geoid = fips.substring(0, 12);
				FIPS_CACHE[cacheKey] = geoid;
				return geoid;
			}
		}

		// FCC failed or timed out — try Census Bureau API as fallback
		console.warn('[BlockGroup] FCC API failed or returned no result, trying Census Bureau fallback');
		const censusUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=10&format=json`;
		const censusRes = await fetch(censusUrl, { signal: AbortSignal.timeout(10000) });

		if (censusRes.ok) {
			const censusData = await censusRes.json();
			const results = censusData?.result?.geographies?.['Census Block Groups']?.[0];
			if (results?.GEOID) {
				FIPS_CACHE[cacheKey] = results.GEOID;
				return results.GEOID;
			}
		}

		// Both APIs failed
		console.warn('[BlockGroup] Both FCC and Census geocoding APIs failed');
		FIPS_CACHE[cacheKey] = null;
		return null;
	} catch (e) {
		console.warn('[BlockGroup] FIPS lookup error:', e instanceof Error ? e.message : e);
		FIPS_CACHE[cacheKey] = null;
		return null;
	}
}

// ── Borough mapping ──

const COUNTY_TO_BOROUGH: Record<string, string> = {
	'061': 'Manhattan',
	'005': 'Bronx',
	'047': 'Brooklyn',
	'081': 'Queens',
	'085': 'Staten Island',
};

export function geoidToBorough(geoid: string): string {
	if (geoid.length >= 5) {
		const county = geoid.substring(2, 5);
		return COUNTY_TO_BOROUGH[county] || 'NYC';
	}
	return 'NYC';
}

// ── Helpers ──

/** Convert a 0-100 score to a letter grade. */
export function gradeFromScore(score: number): string {
	if (score >= 93) return 'A+';
	if (score >= 87) return 'A';
	if (score >= 80) return 'A-';
	if (score >= 73) return 'B+';
	if (score >= 67) return 'B';
	if (score >= 60) return 'B-';
	if (score >= 53) return 'C+';
	if (score >= 47) return 'C';
	if (score >= 40) return 'C-';
	if (score >= 30) return 'D';
	return 'F';
}

// ── Database queries ──

/**
 * Fetch all score rows for a geoid and assemble into BlockGroupScores.
 * Each row is (geoid, score_type, score, components).
 */
export async function getBlockGroupScores(
	geoid: string,
	conceptType?: string
): Promise<BlockGroupScores | null> {
	try {
		const supabase = getServiceSupabase();

		// Normalize concept type to canonical key before any DB lookup
		if (conceptType) conceptType = normalizeBusinessType(conceptType);
		// If concept type provided, look for concept-suffixed score_types too
		const suffix = conceptType ? `:${conceptType}` : '';

		const { data, error } = await supabase
			.from('block_group_scores')
			.select('score_type, score, components')
			.eq('geoid', geoid);

		if (error || !data || data.length === 0) return null;

		// Assemble from multiple rows
		const scoreMap: Record<string, { score: number; components: Record<string, unknown> }> = {};
		for (const row of data) {
			scoreMap[row.score_type] = {
				score: row.score ?? 0,
				components: row.components ?? {},
			};
		}

		// Prefer concept-suffixed fit_score if available (e.g., fit_score:specialty_coffee)
		const fitKey = suffix && scoreMap[`fit_score${suffix}`] ? `fit_score${suffix}` : 'fit_score';
		const fitRow = scoreMap[fitKey];

		const location_iq = scoreMap['location_iq']?.score ?? 0;
		if (location_iq === 0 && !scoreMap['location_iq']) return null;

		// Compute fit grade from fit_score
		const fitScore = fitRow?.score ?? 0;
		const fitGrade = gradeFromScore(fitScore);

		// Read Cycle 2H sub-scores (stored as separate rows or in fit_score components)
		const fitComponents = fitRow?.components ?? {};
		const fitSubScores = {
			market_proof: scoreMap[`fit_sub_market_proof${suffix}`]?.score ?? scoreMap['fit_sub_market_proof']?.score ?? (fitComponents as any).market_proof ?? 0,
			accessibility: scoreMap[`fit_sub_accessibility${suffix}`]?.score ?? scoreMap['fit_sub_accessibility']?.score ?? (fitComponents as any).accessibility ?? 0,
			vibrancy: scoreMap[`fit_sub_vibrancy${suffix}`]?.score ?? scoreMap['fit_sub_vibrancy']?.score ?? (fitComponents as any).vibrancy ?? 0,
			// demographics + competition: dedicated rows (future batch runs) fall back to fit_score.components
			demographics: scoreMap[`fit_sub_demographics${suffix}`]?.score ?? scoreMap['fit_sub_demographics']?.score ?? (fitComponents as any).demographics ?? 0,
			competition: scoreMap[`fit_sub_competition${suffix}`]?.score ?? scoreMap['fit_sub_competition']?.score ?? (fitComponents as any).competition ?? 0,
			// FIX: batch scorer writes "priceIncomeFit" (camelCase) but this code read "price_income_fit" (snake_case) → always 0.
			// Read both key forms so existing DB rows surface the value correctly.
			price_income_fit: scoreMap[`fit_sub_price_income_fit${suffix}`]?.score ?? scoreMap['fit_sub_price_income_fit']?.score ?? (fitComponents as any).price_income_fit ?? (fitComponents as any).priceIncomeFit ?? 0,
		};

		// ── V4 Three-Score Architecture ──
		// Location IQ v2 — prefer concept-suffixed score (e.g., location_iq_v2:wellness_spa),
		// fall back to concept-independent location_iq_v2. Concept-suffixed rows include
		// concept-specific competition/room sub-scores in components.
		const locIQv2Key = suffix && scoreMap[`location_iq_v2${suffix}`] ? `location_iq_v2${suffix}` : 'location_iq_v2';
		const locIQv2Row = scoreMap[locIQv2Key];
		const locIQv2Score = locIQv2Row?.score ?? 0;
		const locIQv2Components = locIQv2Row?.components as BlockGroupScores['location_iq_v2_components'] | undefined;
		const locIQv2Grade = (locIQv2Components?.grade) || (locIQv2Score > 0 ? gradeFromScore(locIQv2Score) : undefined);

		// Vision IQ (concept-specific) — prefer suffixed, fall back to default (FSR)
		const visionKey = suffix && scoreMap[`vision_iq${suffix}`] ? `vision_iq${suffix}` : 'vision_iq';
		const visionRow = scoreMap[visionKey];
		const visionIQScore = visionRow?.score ?? 0;
		const visionIQComponents = visionRow?.components as BlockGroupScores['vision_iq_components'] | undefined;

		// Safety and momentum dedicated sub-scores
		const safetyScore = scoreMap['location_sub_safety']?.score ?? 0;
		const momentumScore = scoreMap['location_sub_momentum']?.score ?? 0;

		// ── AF-01 FIX: Vibrancy floor from LIQ v2 components ──
		// six_vibrancy (simple average) underscores vibrant zones because sparse signals
		// (sidewalk cafes, DCA licenses) dilute strong signals (market density, liquor licenses).
		// location_iq_v2_components.vibrancy uses max-weighted formula → better estimate.
		// If six_vibrancy is low, use locIQv2 vibrancy as a floor.
		const rawSixVibrancy = scoreMap['six_vibrancy']?.score ?? scoreMap['vibrancy']?.score ?? 0;
		const liqV2Vibrancy = (locIQv2Components as any)?.vibrancy ?? 0;
		const sixVibrancy = liqV2Vibrancy > rawSixVibrancy
			? Math.round(rawSixVibrancy * 0.4 + liqV2Vibrancy * 0.6)  // blend toward better estimate
			: rawSixVibrancy;

		// ── AF-04 FIX: Accessibility floor from six-index transit ──
		// fit_sub_accessibility can be severely underscored when WalkScore/MTA data is missing
		// during batch scoring. Transit and accessibility are closely correlated — accessibility
		// can't legitimately be more than 10 points below the six-index transit score.
		const sixTransit = scoreMap['six_transit']?.score ?? scoreMap['transit']?.score ?? 0;
		if (fitSubScores.accessibility > 0 && sixTransit > 0) {
			fitSubScores.accessibility = Math.max(fitSubScores.accessibility, Math.max(0, sixTransit - 10));
		}

		// ── AF-05 FIX: Survival rate floor for appointment/destination concepts ──
		// DOHMH inspection pass rates are designed for food service. Appointment-based concepts
		// (personal services, medical, fitness) have inherently higher survival — their proxy
		// should not fall below 45.
		const rawSurvivalRate = (scoreMap['six_survival_rate']?.score ?? 0) > 0
			? Math.round(scoreMap['six_survival_rate'].score)
			: undefined;
		const survivalFloor = conceptType ? (BUSINESS_TYPE_CONFIGS[conceptType as ValidBusinessType]?.survivalBaseline ?? 0) : 0;
		const survivalRate = rawSurvivalRate !== undefined
			? Math.max(rawSurvivalRate, survivalFloor)
			: (survivalFloor > 0 ? survivalFloor : undefined);

		return {
			geoid,
			location_iq,
			six_index: {
				// Try v3 prefixed keys first (six_transit), fall back to unprefixed (transit)
				transit: sixTransit,
				demographics: scoreMap['six_demographics']?.score ?? scoreMap['demographics']?.score ?? 0,
				competition: scoreMap['six_competition']?.score ?? scoreMap['competition']?.score ?? 0,
				vibrancy: sixVibrancy,
				safety: scoreMap['six_safety']?.score ?? scoreMap['safety']?.score ?? 0,
				momentum: scoreMap['six_momentum']?.score ?? scoreMap['momentum']?.score ?? 0,
			},
			niq: scoreMap['niq']?.score,
			siq: scoreMap['siq']?.score,
			tiq: scoreMap['tiq']?.score,
			liq: scoreMap['liq']?.score,
			archetype_baselines: scoreMap['routine_interceptor'] ? {
				routine_interceptor: scoreMap['routine_interceptor']?.score ?? 0,
				destination_pull: scoreMap['destination_pull']?.score ?? 0,
				need_filler: scoreMap['need_filler']?.score ?? 0,
			} : undefined,
			// Cycle 2H fields (Fit IQ)
			fit_score: fitScore > 0 ? fitScore : undefined,
			fit_grade: fitScore > 0 ? fitGrade : undefined,
			fit_sub_scores: fitScore > 0 ? fitSubScores : undefined,
			fit_components: fitScore > 0 ? (fitComponents as Record<string, unknown>) : undefined,
			// V4 Three-Score Architecture
			location_iq_v2: locIQv2Score > 0 ? locIQv2Score : undefined,
			location_iq_v2_grade: locIQv2Grade || undefined,
			location_iq_v2_components: locIQv2Score > 0 ? locIQv2Components : undefined,
			vision_iq: visionIQScore > 0 ? visionIQScore : undefined,
			vision_iq_components: visionIQScore > 0 ? visionIQComponents : undefined,
			safety_score: safetyScore > 0 ? safetyScore : undefined,
			momentum_score: momentumScore > 0 ? momentumScore : undefined,
			survival_rate: survivalRate,
			neighborhood_health: (scoreMap['six_neighborhood_health']?.score ?? 0) > 0
				? Math.round(scoreMap['six_neighborhood_health'].score)
				: undefined,
			concept_type: conceptType || 'full_service_restaurant',
		};
	} catch {
		return null;
	}
}

export async function getBlockGroupVision(geoid: string): Promise<BlockGroupVision | null> {
	try {
		const supabase = getServiceSupabase();
		const { data, error } = await supabase
			.from('block_group_visions')
			.select('geoid, narrative, structured, model, generated_at')
			.eq('geoid', geoid)
			.eq('vision_type', 'location')
			.limit(1)
			.single();

		if (error || !data) return null;
		return data as BlockGroupVision;
	} catch {
		return null;
	}
}

// ── Main entry point ──

/**
 * Full block group intelligence lookup.
 * Returns scores + vision for a lat/lng in < 2 seconds.
 */
export async function getBlockGroupIntel(lat: number, lng: number, conceptType?: string): Promise<BlockGroupResult | null> {
	const geoid = await latLngToGeoid(lat, lng);
	if (!geoid) return null;

	const borough = geoidToBorough(geoid);

	// Fetch scores and vision in parallel
	const [scores, vision] = await Promise.all([
		getBlockGroupScores(geoid, conceptType),
		getBlockGroupVision(geoid),
	]);

	// Determine serving mode
	let serving_mode: BlockGroupResult['serving_mode'] = 'cold';
	if (scores || vision) {
		serving_mode = 'stored';
	}

	return { geoid, borough, scores, vision, serving_mode };
}
