/**
 * Survival Rate Intelligence — SURV-OPT-C
 *
 * Provides real survival rates derived from DOHMH inspection data, replacing
 * the hardcoded default of 55 that previously carried ~48% of Location IQ weight.
 *
 * Data flow:
 *   1. aggregate-dohmh-survival.mjs populates block_group_survival + borough_survival_medians
 *   2. This module reads from those tables at runtime via Supabase service client
 *   3. For non-food concepts, applies a discount factor from SURVIVAL_DISCOUNT_FACTORS
 *   4. Falls back to borough median when block group has no data
 *
 * WIRED into Location IQ scoring (SURV-WIRE, April 12). Both GET and POST handlers
 * in location-iq/+server.ts call getSurvivalRate() after fetchPrecomputedScores,
 * overwriting the stale batch value so computeSixIndex sees live DOHMH data.
 */

import { getServiceSupabase } from '$lib/supabase-server';
import {
	SURVIVAL_DISCOUNT_FACTORS,
	SURVIVAL_DISCOUNT_DEFAULT,
} from '$lib/constants/scoring-thresholds';
import { intelCache, TTL } from './cache';

// ─── Types ──────────────────────────────────────────────────────────

export type SurvivalConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'FALLBACK';
export type SurvivalSource = 'dohmh_direct' | 'concept_proxy' | 'borough_median';

export interface SurvivalResult {
	/** Survival rate as 0–100 score (not 0–1 fraction) */
	rate: number;
	/** How confident we are in this number */
	confidence: SurvivalConfidence;
	/** Where the number came from */
	source: SurvivalSource;
	/** Raw food survival rate from DOHMH (0–1) before concept discount */
	rawFoodRate: number;
	/** Discount factor applied (1.0 if food concept) */
	discountFactor: number;
	/** Sample size from block group (0 if borough fallback) */
	sampleSize: number;
}

// ─── Concept classification ─────────────────────────────────────────

/**
 * Maps a user-facing concept string to a SURVIVAL_DISCOUNT_FACTORS key.
 * Returns null for food-service concepts (discount = 1.0, DOHMH directly applicable).
 */
function classifyConcept(concept: string): string | null {
	const c = (concept || '').toLowerCase().trim();

	// Food-service concepts: DOHMH is directly applicable, no discount
	if (
		c.includes('restaurant') || c.includes('cafe') || c.includes('coffee') ||
		c.includes('bakery') || c.includes('deli') || c.includes('pizza') ||
		c.includes('food') || c.includes('juice') || c.includes('ice cream') ||
		c.includes('sushi') || c.includes('ramen') || c.includes('bagel') ||
		c.includes('sandwich') || c.includes('taco') || c.includes('burger')
	) {
		return null; // Direct DOHMH applicability
	}

	// Bar / nightlife — DOHMH inspects these too
	if (c.includes('bar') || c.includes('nightlife') || c.includes('lounge') || c.includes('pub')) {
		return 'bar_nightlife';
	}

	// Non-food: match to discount factor keys
	if (c.includes('salon') || c.includes('beauty'))  return 'salon';
	if (c.includes('nail'))                            return 'nail';
	if (c.includes('barber'))                          return 'barbershop';
	if (c.includes('fitness') || c.includes('gym') || c.includes('yoga') || c.includes('pilates'))
		return 'fitness_studio';
	if (c.includes('medical') || c.includes('clinic') || c.includes('doctor'))
		return 'medical';
	if (c.includes('dental') || c.includes('dentist'))
		return 'dental';
	if (c.includes('cowork') || c.includes('co-work'))
		return 'coworking';
	if (
		c.includes('retail') || c.includes('shop') || c.includes('store') ||
		c.includes('boutique') || c.includes('clothing') || c.includes('fashion')
	) {
		return 'retail';
	}

	// Unknown concept — use default discount
	return '__default';
}

// ─── Cache helpers ──────────────────────────────────────────────────

const SURVIVAL_TTL = TTL.TRANSIT; // 6h — survival data changes infrequently

function blockGroupCacheKey(geoid: string): string {
	return `survival:bg:${geoid}`;
}

function boroughCacheKey(borough: string): string {
	return `survival:boro:${borough}`;
}

// ─── Supabase queries ───────────────────────────────────────────────

interface BlockGroupSurvivalRow {
	geoid: string;
	food_survival_rate: number;
	sample_size: number;
	confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

interface BoroughMedianRow {
	borough: string;
	median_survival_rate: number;
}

async function fetchBlockGroupSurvival(geoid: string): Promise<BlockGroupSurvivalRow | null> {
	const cached = await intelCache.getAsync<BlockGroupSurvivalRow>(blockGroupCacheKey(geoid));
	if (cached?.data) return cached.data;

	try {
		const supabase = getServiceSupabase();
		const { data, error } = await supabase
			.from('block_group_survival')
			.select('geoid, food_survival_rate, sample_size, confidence')
			.eq('geoid', geoid)
			.single();

		if (error || !data) return null;

		const row = data as BlockGroupSurvivalRow;
		intelCache.set(blockGroupCacheKey(geoid), row, SURVIVAL_TTL);
		return row;
	} catch (err) {
		console.warn('[survival-rate] Failed to fetch block group survival:', err);
		return null;
	}
}

async function fetchBoroughMedian(borough: string): Promise<number | null> {
	const cached = await intelCache.getAsync<BoroughMedianRow>(boroughCacheKey(borough));
	if (cached?.data) return cached.data.median_survival_rate;

	try {
		const supabase = getServiceSupabase();
		const { data, error } = await supabase
			.from('borough_survival_medians')
			.select('borough, median_survival_rate')
			.eq('borough', borough)
			.single();

		if (error || !data) return null;

		const row = data as BoroughMedianRow;
		intelCache.set(boroughCacheKey(borough), row, SURVIVAL_TTL);
		return row.median_survival_rate;
	} catch (err) {
		console.warn('[survival-rate] Failed to fetch borough median:', err);
		return null;
	}
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Get the survival rate for a census block group, adjusted for concept type.
 *
 * @param geoid   Census block group FIPS code (e.g., '360610001001')
 * @param concept User-facing concept string (e.g., 'Coffee Shop', 'Nail Salon')
 * @param borough NYC borough name (e.g., 'Manhattan') — used for fallback
 * @returns SurvivalResult with rate as 0–100 score
 */
export async function getSurvivalRate(
	geoid: string,
	concept: string,
	borough: string,
): Promise<SurvivalResult> {
	// 1. Determine concept discount factor
	const conceptKey = classifyConcept(concept);
	const isFoodDirect = conceptKey === null;
	const discountFactor = isFoodDirect
		? 1.0
		: (SURVIVAL_DISCOUNT_FACTORS[conceptKey] ?? SURVIVAL_DISCOUNT_DEFAULT);

	// 2. Try block group data first
	const bgData = await fetchBlockGroupSurvival(geoid);

	if (bgData && bgData.confidence !== 'NONE') {
		const rawRate = bgData.food_survival_rate;
		const adjustedRate = rawRate * discountFactor;

		return {
			rate: Math.round(adjustedRate * 100),
			confidence: bgData.confidence as SurvivalConfidence,
			source: isFoodDirect ? 'dohmh_direct' : 'concept_proxy',
			rawFoodRate: rawRate,
			discountFactor,
			sampleSize: bgData.sample_size,
		};
	}

	// 3. Fall back to borough median
	const boroughMedian = await fetchBoroughMedian(borough);

	if (boroughMedian !== null) {
		const adjustedRate = boroughMedian * discountFactor;

		return {
			rate: Math.round(adjustedRate * 100),
			confidence: 'FALLBACK',
			source: 'borough_median',
			rawFoodRate: boroughMedian,
			discountFactor,
			sampleSize: 0,
		};
	}

	// 4. No data at all — return the old default (55) with FALLBACK confidence
	// This preserves backward compatibility until all block groups are seeded
	console.warn(`[survival-rate] No survival data for geoid=${geoid}, borough=${borough}`);
	return {
		rate: 55,
		confidence: 'FALLBACK',
		source: 'borough_median',
		rawFoodRate: 0.55,
		discountFactor: 1.0,
		sampleSize: 0,
	};
}
