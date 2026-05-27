/**
 * Client-side block group intelligence fetcher.
 *
 * Calls /api/block-group-intel to get pre-computed scores + vision
 * for a lat/lng. This is the "fast path" — returns in < 2 seconds
 * instead of waiting for 20+ live API calls.
 *
 * Used by AddressAnalyzer to serve instant results while the full
 * live intel pipeline runs in the background.
 */

import { authedFetch } from '$lib/authed-fetch';

export interface BlockGroupClientResult {
	geoid: string;
	borough: string;
	scores: {
		location_iq: number;
		grade?: string;
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
		survival_rate?: number;       // six_survival_rate — high-impact Location IQ signal (48% wt)
		neighborhood_health?: number; // six_neighborhood_health — high-impact Location IQ signal (28% wt)
		concept_type?: string;
	} | null;
	vision: {
		narrative: string;
		structured: {
			character: string;
			gaps: string;
			opportunities: string;
			momentum: string;
		};
		model: string;
		generated_at: string;
	} | null;
	serving_mode: 'stored' | 'stale_refresh' | 'cold';
	_meta?: {
		duration_ms: number;
		cached: boolean;
	};
}

// Cache to avoid re-fetching for same coordinates
const BG_CACHE: Record<string, BlockGroupClientResult | null> = {};

/**
 * Fetch block group scores + vision for a lat/lng.
 * Returns null if the block group data doesn't exist (cold path).
 */
export async function fetchBlockGroupIntel(
	lat: number,
	lng: number,
	conceptType?: string,
	address?: string
): Promise<BlockGroupClientResult | null> {
	const conceptParam = conceptType ? `,${conceptType}` : '';
	const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}${conceptParam}`;
	if (cacheKey in BG_CACHE) return BG_CACHE[cacheKey];

	try {
		const conceptQuery = conceptType ? `&concept=${encodeURIComponent(conceptType)}` : '';
		const addrQuery = address ? `&address=${encodeURIComponent(address)}` : '';
		const url = `/api/block-group-intel?lat=${lat}&lng=${lng}${conceptQuery}${addrQuery}`;
		const res = await authedFetch(url, { timeout: 8000 });

		if (!res.ok) {
			BG_CACHE[cacheKey] = null;
			return null;
		}

		const data: BlockGroupClientResult = await res.json();

		// Only cache if we got actual scores
		if (data.scores) {
			BG_CACHE[cacheKey] = data;
		} else {
			BG_CACHE[cacheKey] = null;
		}

		return data.scores ? data : null;
	} catch (e) {
		console.warn('[BlockGroup] Client fetch error:', e instanceof Error ? e.message : e);
		BG_CACHE[cacheKey] = null;
		return null;
	}
}
