/**
 * ═══════════════════════════════════════════════════════
 * Coffee Recalibration — Dimension 3: Competition Context
 * ═══════════════════════════════════════════════════════
 *
 * SELF-CONTAINED — all scoring logic lives in this file.
 * No dependency on primitives.ts or segment-intel.ts. Tune everything here.
 *
 * Computes the Competition Context score (ccScore) for the coffee
 * scoring engine. Weighted at 15% of the raw composite.
 *
 * This dimension evaluates the competitive landscape around a location
 * at YOUR price point, combining:
 *   1. Base competition density (ring-based competitor count from Overpass,
 *      quality gap from Google, chain % from Foursquare/Market Density)
 *   2. Pricing sentiment adjustment (+15 to -15) based on blended
 *      competitor pricing analysis
 *
 * Data sources (all pre-fetched in the report — no live API calls):
 *   - report.competitors  → OpenStreetMap/Overpass (competitor count by ring)
 *   - report.places       → Google Places (ratings, price levels, types)
 *   - report.foursquare   → Foursquare (chain detection, pricing, ratings, category diversity)
 *   - report.marketDensity → Market density (chain % by category)
 *
 * Key concepts:
 *   - Base competition score computed from ring density + quality signals
 *   - Sentiment adjustment: +15 (great gap) to -15 (oversaturated)
 *   - Tier filtering: premium ($7+) excludes budget chains (Dunkin, carts)
 *   - Budget (<$5) excludes specialty/wellness competitors
 *
 * v1.1: Inlined base competition logic from primitives.computeCompetitionIndex()
 *   to make this module fully self-contained (same pattern as dim1/dim2).
 *   The primitives.ts version still exists for the 8-index Deep Dive display
 *   but scoring is now decoupled from it.
 */

import type { LocationIntelReport } from '../types';
import type { IndexSignal } from '../six-index';

// ── Utility ───────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
	return Math.max(min, Math.min(max, isNaN(v) ? min : v));
}

// ── Base Competition Index (inlined from primitives.ts) ───────────────
// Computes a 0–100 score from ring-based competitor density, Google
// ratings, market density chain %, and Foursquare ecosystem signals.
//
// This is the SCORING version — decoupled from primitives.ts so coffee
// dims can be tuned independently. The primitives.ts version continues
// to feed the Deep Dive tab's standard index display.

/**
 * Compute the base competition score from the report's competition data.
 *
 * Pipeline:
 *   1. Count competitors in ring1 + ring2 → density-based score
 *   2. Google Places avg rating < 4.0 → quality gap boost (+8%)
 *   3. Market density chain % > 60 → chain-heavy boost (+5%)
 *   4. Foursquare category diversity > 15 → ecosystem boost (+5%)
 *   5. Foursquare avg rating < 7.0 → quality gap boost (+5%)
 *
 * @param report - The full LocationIntelReport
 * @returns Base competition score (0–100)
 */
function computeBaseCompetitionScore(report: LocationIntelReport): number {
	const r = report as any;
	let score = 50;

	// Step 1: Ring-based competitor density
	if (r.competitors) {
		const nearby = r.competitors.rings?.ring1?.length || 0;
		const mid = r.competitors.rings?.ring2?.length || 0;
		const total = nearby + mid;
		if (total === 0) score = 40;
		else if (total <= 3) score = 85;
		else if (total <= 8) score = 65;
		else score = Math.max(25, 65 - (total - 8) * 5);
	}

	// Step 2: Google Places quality gap
	if (r.places) {
		const avgRating = r.places.avgRating || 0;
		if (avgRating > 0 && avgRating < 4.0) {
			score = Math.round(score * 1.08);
		}
	}

	// Step 3: Market density chain %
	if (r.marketDensity) {
		const highChainCats = r.marketDensity.categories.filter(
			(c: any) => c.chainPct > 60 && c.count > 3
		);
		if (highChainCats.length > 0) {
			score = Math.round(score * 1.05);
		}
	}

	// Step 4+5: Foursquare ecosystem + quality signals
	if (r.foursquare) {
		if (r.foursquare.categoryDiversity > 15) {
			score = Math.round(score * 1.05);
		}
		if (r.foursquare.avgRating > 0 && r.foursquare.avgRating < 7.0) {
			score = Math.round(score * 1.05);
		}
	}

	return clamp(score);
}

// ── Budget Chain Detection ────────────────────────────────────────────
// Known budget chain names. When your avgTicket is $7+, these are NOT
// your real competitors — Dunkin doesn't compete with a $9 protein latte.

export const BUDGET_CHAIN_NAMES = new Set([
	'dunkin', "dunkin'", 'dunkin donuts', 'starbucks', '7-eleven', '7 eleven',
	'wawa', 'mcdonald', "mcdonald's", 'tim hortons', 'pret a manger', 'pret',
	"gregory's", 'gregorys', 'joe coffee', 'bluestone lane',
]);

/**
 * Returns true if a competitor is a budget-tier chain.
 * Matches by known name, isChain + low price, or cart/bodega/deli heuristic.
 */
function isBudgetChain(c: { name: string; price: number; isChain: boolean }): boolean {
	const lower = c.name.toLowerCase().trim();
	if (BUDGET_CHAIN_NAMES.has(lower)) return true;
	// Foursquare isChain + budget price = budget chain
	if (c.isChain && c.price > 0 && c.price < 5.50) return true;
	// Name heuristics for carts/bodegas
	if (lower.includes('cart') || lower.includes('bodega') || lower.includes('deli')) return true;
	return false;
}

/**
 * Returns true if a competitor is specialty/wellness.
 * Excluded from competition when user's avgTicket is budget (<$5).
 */
function isSpecialtyWellness(c: { name: string; price: number }): boolean {
	const lower = c.name.toLowerCase().trim();
	return lower.includes('juice') || lower.includes('smoothie') || lower.includes('wellness')
		|| lower.includes('acai') || lower.includes('matcha') || (c.price > 0 && c.price >= 7.00);
}

// ── Foursquare Price Level Mapping ────────────────────────────────────
// Foursquare uses 1–4 price levels. We map to estimated avg ticket.

export const FSQ_PRICE_MAP: Record<number, number> = {
	1: 3.50,
	2: 4.75,
	3: 6.00,
	4: 7.50,
};

// ── Google Places Price Level Mapping ─────────────────────────────────

export const GOOGLE_PRICE_MAP: Record<number, number> = {
	1: 3.50,
	2: 5.00,
	3: 6.50,
	4: 8.00,
};

// ── Google Places Type Filter ─────────────────────────────────────────
// COFFEE-REWIRE Change 8: Premium coffee ($7+) competes with wellness/juice,
// not just other cafes. At $9 protein coffee, your competitors are
// wellness shops, not Starbucks.

export const COFFEE_TYPES_STANDARD = ['cafe', 'coffee_shop'];
export const COFFEE_TYPES_PREMIUM = ['cafe', 'coffee_shop', 'juice_bar', 'smoothie', 'health_food', 'meal_delivery'];

// ── Sentiment Adjustments ─────────────────────────────────────────────
// Applied to the base competition score based on pricing sentiment.
//
// Calibration notes (v1.0):
//   - "great": chain-heavy or underserved market → big opportunity → +15
//   - "good": moderate gap, room for quality → +5
//   - "caution": competitive, need differentiation → -5
//   - "warning": saturated with quality players → -15

export interface SentimentAdjustment {
	sentiment: 'great' | 'good' | 'caution' | 'warning';
	adjustment: number;
	label: string;
}

export const SENTIMENT_ADJUSTMENTS: SentimentAdjustment[] = [
	{ sentiment: 'great',   adjustment: +15, label: 'Strong opportunity — chain-heavy or underserved' },
	{ sentiment: 'good',    adjustment: +5,  label: 'Moderate opportunity — room for quality' },
	{ sentiment: 'caution', adjustment: -5,  label: 'Competitive — differentiation needed' },
	{ sentiment: 'warning', adjustment: -15, label: 'Saturated — significant headwind' },
];

export function getSentimentAdjustment(sentiment: string): number {
	const entry = SENTIMENT_ADJUSTMENTS.find(s => s.sentiment === sentiment);
	return entry?.adjustment ?? 0;
}

// ── Competitor Blend Interface ────────────────────────────────────────

interface CompetitorEntry {
	name: string;
	rating: number;
	price: number;
	distance: number;
	isChain: boolean;
}

interface CompetitorBlendResult {
	avgPrice: string | null;
	priceRange: string | null;
	avgRating: number;
	totalCount: number;
	tierCount: number;
	chainPct: number;
	independentPct: number;
	topCompetitors: CompetitorEntry[];
	tierCompetitors: CompetitorEntry[];
	marketGap: string;
	sentiment: 'great' | 'good' | 'caution' | 'warning';
}

// ── Result Interface ──────────────────────────────────────────────────

export interface CompetitionContextResult {
	/** The dimension score (0–100) */
	score: number;
	/** The base competition index before sentiment adjustment */
	baseCompetitionScore: number;
	/** Sentiment from blended competitor pricing analysis */
	sentiment: 'great' | 'good' | 'caution' | 'warning' | null;
	/** Points added/subtracted from sentiment */
	sentimentAdjustment: number;
	/** Total competitor count (unfiltered) */
	totalCompetitors: number | null;
	/** Tier-filtered competitor count (your actual competition) */
	tierCompetitors: number | null;
	/** Market gap analysis description */
	marketGap: string | null;
	/** Detailed blend result for inspection */
	blendResult: CompetitorBlendResult | null;
	/** Any signals generated for this dimension */
	signals: IndexSignal[];
}

// ── Competitor Blend Logic ────────────────────────────────────────────

/**
 * Blend competitor data from Foursquare + Google Places.
 * Performs tier filtering based on avgTicket, computes chain %,
 * avg rating, and determines market gap sentiment.
 *
 * @param report - The full LocationIntelReport
 * @param avgTicket - User's average ticket price
 * @returns Blended competitor analysis, or null if no competitors found
 */
function blendCompetitorPricing(report: any, avgTicket: number): CompetitorBlendResult | null {
	const fsq = report.foursquare;
	const places = report.places;

	// ── Collect all competitor data points ───────────────────
	const competitors: CompetitorEntry[] = [];

	// Foursquare venues (richest data — chain detection, pricing)
	if (fsq?.directCompetitors) {
		for (const v of fsq.directCompetitors) {
			const price = v.priceLevel ? (FSQ_PRICE_MAP[v.priceLevel] ?? null) : null;
			competitors.push({
				name: v.name,
				rating: v.rating ? v.rating / 2 : 0, // Foursquare 0–10 → 0–5
				price: price ?? 0,
				distance: v.distance,
				isChain: v.isChain,
			});
		}
	}

	// Google Places as supplement (concept-aware type filter)
	const googleTypes = avgTicket > 7 ? COFFEE_TYPES_PREMIUM : COFFEE_TYPES_STANDARD;

	if (places?.places && competitors.length < 5) {
		for (const p of places.places) {
			if (!p.types?.some((t: string) => googleTypes.includes(t))) continue;
			if (competitors.some(c => c.name === p.name)) continue; // dedup
			const price = p.priceLevel ? (GOOGLE_PRICE_MAP[p.priceLevel] ?? null) : null;
			competitors.push({
				name: p.name,
				rating: p.rating || 0,
				price: price ?? 0,
				distance: p.distance,
				isChain: false, // Google doesn't flag this reliably
			});
		}
	}

	if (competitors.length === 0) return null;

	// Sort by distance (closest first)
	competitors.sort((a, b) => a.distance - b.distance);

	// ── Tier filtering ──────────────────────────────────────────
	// Premium ($7+): exclude budget chains (Dunkin, carts, bodegas)
	// Budget (<$5): exclude specialty/wellness/juice
	// Standard ($5–7): no filtering
	const tierFiltered = competitors.filter(c => {
		if (avgTicket >= 7.00 && isBudgetChain(c)) return false;
		if (avgTicket < 5.00 && isSpecialtyWellness(c)) return false;
		return true;
	});

	// ── Compute metrics from tier-filtered set ──────────────────
	const tierPrices = tierFiltered.map(c => c.price).filter(p => p > 0);
	const tierRatings = tierFiltered.map(c => c.rating).filter(r => r > 0);
	const hasRealPrices = tierPrices.length > 0;
	const avgPrice = hasRealPrices ? tierPrices.reduce((a, b) => a + b, 0) / tierPrices.length : null;
	const minPrice = hasRealPrices ? Math.min(...tierPrices) : null;
	const maxPrice = hasRealPrices ? Math.max(...tierPrices) : null;
	const avgRating = tierRatings.length > 0 ? tierRatings.reduce((a, b) => a + b, 0) / tierRatings.length : 0;
	const chainCount = tierFiltered.filter(c => c.isChain).length;
	const chainPct = tierFiltered.length > 0 ? Math.round((chainCount / tierFiltered.length) * 100) : 0;

	// ── Market gap analysis ─────────────────────────────────────
	let marketGap = '';
	let sentiment: 'great' | 'good' | 'caution' | 'warning' = 'good';

	if (chainPct >= 60) {
		marketGap = 'Chain-heavy market — room for quality independent';
		sentiment = 'great';
	} else if (avgPrice !== null && avgPrice < 4.50 && avgRating < 4.0) {
		marketGap = 'Budget-focused area — premium positioning opportunity';
		sentiment = 'great';
	} else if (tierFiltered.length >= 8 && avgRating >= 4.3) {
		marketGap = 'Saturated with quality — need strong differentiator';
		sentiment = 'warning';
	} else if (tierFiltered.length <= 3) {
		marketGap = 'Underserved market — first-mover advantage';
		sentiment = 'great';
	} else {
		marketGap = 'Competitive market — differentiation is key';
		sentiment = 'caution';
	}

	return {
		avgPrice: avgPrice !== null ? '$' + avgPrice.toFixed(2) : null,
		priceRange: minPrice !== null && maxPrice !== null ? '$' + minPrice.toFixed(2) + ' – $' + maxPrice.toFixed(2) : null,
		avgRating: Math.round(avgRating * 10) / 10,
		totalCount: competitors.length,
		tierCount: tierFiltered.length,
		chainPct,
		independentPct: 100 - chainPct,
		topCompetitors: competitors.slice(0, 5),
		tierCompetitors: tierFiltered.slice(0, 5),
		marketGap,
		sentiment,
	};
}

// ── Core Computation ──────────────────────────────────────────────────

/**
 * Compute the Competition Context dimension score.
 *
 * Pipeline:
 *   1. Computes base competition score from ring density + quality signals
 *   2. Collects competitors from Foursquare + Google Places
 *   3. Tier-filters based on avgTicket (premium excludes budget chains)
 *   4. Computes chain %, avg rating, market gap → sentiment
 *   5. Applies sentiment adjustment (+15 to -15) to base competition score
 *   6. Clamps to 0–100
 *
 * @param report - The full LocationIntelReport from the intel pipeline
 * @param avgTicket - User's average ticket price (affects tier filtering)
 * @returns CompetitionContextResult with adjusted score and market analysis
 */
export function computeCompetitionContext(
	report: LocationIntelReport,
	avgTicket: number = 5.00
): CompetitionContextResult {
	// Step 1: Compute base competition score (inlined from primitives)
	const baseCompetitionScore = computeBaseCompetitionScore(report);

	// Step 2: Blend competitor pricing data across all sources
	const compData = blendCompetitorPricing(report, avgTicket);

	// Step 3: Calculate sentiment adjustment
	let sentimentAdj = 0;
	if (compData) {
		sentimentAdj = getSentimentAdjustment(compData.sentiment);
	}

	// Step 4: Apply adjustment to base score, clamped to 0–100
	const score = Math.max(0, Math.min(100, baseCompetitionScore + sentimentAdj));

	return {
		score,
		baseCompetitionScore,
		sentiment: compData?.sentiment ?? null,
		sentimentAdjustment: sentimentAdj,
		totalCompetitors: compData?.totalCount ?? null,
		tierCompetitors: compData?.tierCount ?? null,
		marketGap: compData?.marketGap ?? null,
		blendResult: compData,
		signals: [],
	};
}
