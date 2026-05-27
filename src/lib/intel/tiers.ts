/**
 * EF-4 (April 11): Canonical tier vocabulary — single source of truth.
 *
 * Before this file existed, three parallel code paths computed tier labels
 * independently:
 *   1. The neighborhood snapshot card read the raw score and looked up a tier
 *      with its own ternary mapping.
 *   2. The 6-lens payload from BR-06 computed lens verdicts with a different
 *      ternary mapping in location-iq/+server.ts.
 *   3. The narrative engine (decision-engine.ts) wrote sentences using
 *      adjective templates not tied to either mapping ("strong safety
 *      profile" when the score was 63).
 *
 * Result: "STRONG AVERAGE" (oxymoron), "Safety 63 · STRONG INFO", "Strong"
 * applied to 63/100 in one surface and "Average" applied to 63/100 in
 * another — guaranteed contradictions on every screen.
 *
 * Rule for every future surface: call `tierFor(score, dim)` and render
 * `.label` / `.copy` / `.color` / `.severity`. NEVER write a string literal
 * containing the tier words ("Strong", "Concerning", "Average", "Weak",
 * "Prime Block", "Solid Block", "Mixed Block", "Strong Path", "Viable",
 * "Tight", "Stretch", "Rethink", "Sharp Fit", "Clear", "Forming", "Fuzzy",
 * "Outline") in a narrative template. Inject from `tierFor` so the
 * vocabulary stays consistent.
 */

import { TIER_BOUNDARIES } from '$lib/constants/scoring-thresholds';

/** The kind of score being tiered. */
export type DimensionKey =
	/** Composite Fit IQ (0-100) — founder verdict vocabulary. */
	| 'fitIQ'
	/** Composite Location IQ (0-100) — block quality vocabulary. */
	| 'locationIQ'
	/** Any individual six-index lens score (transit, safety, demographics, etc). */
	| 'lens'
	/**
	 * Vision IQ (0-100) — concept specificity + fit vocabulary.
	 *
	 * Measures how well the founder's concept (business type, price point,
	 * hours, differentiators, target customer) is defined AND matched to
	 * this location. A low score means the concept is incomplete or a poor
	 * fit; a high score means sharp concept definition with strong location
	 * alignment. Score ceiling is ~85 when fully specified (six-index.ts
	 * vision gap comment).
	 *
	 * Vocabulary is concept-fit language ("Sharp Fit", "Clear", "Forming",
	 * "Fuzzy", "Outline") — distinct from FitIQ verdict words and Location IQ
	 * block words, so a founder can distinguish "my concept is unclear" from
	 * "my overall viability is uncertain".
	 */
	| 'visionIQ';

/** Severity drives: UI color, Watch Out propagation, and how hard narratives push back. */
export type Severity = 'good' | 'neutral' | 'warn' | 'kill';

/** Canonical tier shape — what every surface renders. */
export interface Tier {
	/** The pill word. Short. Capitalized. Safe for UI. */
	label: string;
	/** Adjective for narratives ("strong", "solid", "weak"). Lower-case, grammar-safe. */
	copy: string;
	/** UI color bucket. */
	color: 'green' | 'amber' | 'red' | 'neutral';
	/** Severity — drives EF-3 Watch Out propagation and narrative tone. */
	severity: Severity;
}

/**
 * Single source of truth for tier classification.
 *
 * Thresholds are intentionally different per dimension because the scales
 * mean different things: Fit IQ >= 65 is "Viable" (above NYC median);
 * lens dimensions >= 60 is "Solid" (above the neutral band); Location IQ
 * >= 65 is "Solid Block" (crosses into positive territory for the block).
 *
 * If you need to add a new dimension, add a case here. Do NOT write a local
 * ternary in any other file.
 */
export function tierFor(score: number, dim: DimensionKey): Tier {
	// C-04: All cutoffs imported from TIER_BOUNDARIES — single source of truth.
	const F = TIER_BOUNDARIES.fitIQ;
	const L = TIER_BOUNDARIES.locationIQ;
	const V = TIER_BOUNDARIES.visionIQ;
	const D = TIER_BOUNDARIES.lens;

	switch (dim) {
		case 'fitIQ':
			if (score >= F.t1) return { label: 'Strong Path', copy: 'strong',    color: 'green',   severity: 'good'    };
			if (score >= F.t2) return { label: 'Viable',      copy: 'workable',  color: 'green',   severity: 'good'    };
			if (score >= F.t3) return { label: 'Tight',       copy: 'tight',     color: 'amber',   severity: 'neutral' };
			if (score >= F.t4) return { label: 'Stretch',     copy: 'stretched', color: 'amber',   severity: 'warn'    };
			return                      { label: 'Rethink',     copy: 'weak',      color: 'red',     severity: 'kill'    };

		case 'locationIQ':
			if (score >= L.t1) return { label: 'Prime Block',      copy: 'prime',      color: 'green',   severity: 'good'    };
			if (score >= L.t2) return { label: 'Solid Block',      copy: 'solid',      color: 'green',   severity: 'good'    };
			if (score >= L.t3) return { label: 'Mixed Block',      copy: 'mixed',      color: 'amber',   severity: 'neutral' };
			return                      { label: 'Developing Block', copy: 'developing', color: 'amber',   severity: 'warn'    };

		case 'visionIQ':
			// Thresholds calibrated to Vision IQ's ~85 practical ceiling (six-index.ts).
			// 75+ means concept is well-specified AND meaningfully boosting Fit IQ.
			// 55–74 is the "forming" zone — completing details will move the score.
			// < 35 is effectively an outline — scoring is a rough placeholder only.
			if (score >= V.t1) return { label: 'Sharp Fit', copy: 'sharp',    color: 'green',   severity: 'good'    };
			if (score >= V.t2) return { label: 'Clear',     copy: 'clear',    color: 'green',   severity: 'good'    };
			if (score >= V.t3) return { label: 'Forming',   copy: 'forming',  color: 'amber',   severity: 'neutral' };
			if (score >= V.t4) return { label: 'Fuzzy',     copy: 'fuzzy',    color: 'amber',   severity: 'warn'    };
			return                      { label: 'Outline',   copy: 'outlined', color: 'red',     severity: 'kill'    };

		case 'lens':
		default:
			if (score >= D.t1) return { label: 'Strong',     copy: 'strong',     color: 'green',   severity: 'good'    };
			if (score >= D.t2) return { label: 'Solid',      copy: 'solid',      color: 'green',   severity: 'good'    };
			if (score >= D.t3) return { label: 'Average',    copy: 'average',    color: 'neutral', severity: 'neutral' };
			if (score >= D.t4) return { label: 'Weak',       copy: 'weak',       color: 'amber',   severity: 'warn'    };
			return                      { label: 'Concerning', copy: 'concerning', color: 'red',     severity: 'kill'    };
	}
}


/**
 * Convenience: tier label only. Use when you need just the string for a
 * UI pill and don't care about color/severity.
 */
export function tierLabelFor(score: number, dim: DimensionKey): string {
	return tierFor(score, dim).label;
}

/* ============================================================================
 * §1b Root Cause 6 — Confidence contract (April 11)
 *
 * Reliability dial for every metric surface. Server computes a 0-100
 * confidence per dimension based on source freshness + coverage, and UX
 * renders differently depending on tier:
 *
 *   confidence >= 80 (FULL)     → plain number, no decoration.
 *   60 <= confidence < 80 (PARTIAL) → "~" prefix + tooltip "Preliminary —
 *                                    based on partial data, refreshing soon."
 *   confidence < 60 (SKELETON)  → skeleton pill, no number. Aria-busy.
 *
 * Shape decision: `scoreData.confidenceBySource` is a SIBLING MAP, not a
 * per-metric field. Rationale: the six-index dimensions already ship as a
 * nested object; adding confidence to every metric across location-iq,
 * heads-up-engine, dashboard-brain, decision-engine, and the neighborhood
 * snapshot would touch too many contracts. A single sibling map lets the
 * server compute confidence per source and keeps metrics untouched.
 *
 * UX consumption: one `$derived` block on the location page pulls
 * `confidenceBySource[dim]`, passes `confidenceTier()` through the metric
 * component, and the component renders full/partial/skeleton accordingly.
 * ========================================================================== */

/** Below this, metric renders as "~N" + tooltip. */
export const CONFIDENCE_PARTIAL = 80;

/** Below this, metric renders as skeleton pill (no number shown). */
export const CONFIDENCE_SKELETON = 60;

/** Confidence tier for a given 0-100 score. */
export type ConfidenceTier = 'full' | 'partial' | 'skeleton';

/**
 * Classify a 0-100 confidence score into a render tier.
 * Edge-case safe: NaN, negatives, and > 100 all fall through to 'skeleton'.
 */
export function confidenceTier(n: number | null | undefined): ConfidenceTier {
	if (n == null || !Number.isFinite(n) || n < 0) return 'skeleton';
	if (n >= CONFIDENCE_PARTIAL) return 'full';
	if (n >= CONFIDENCE_SKELETON) return 'partial';
	return 'skeleton';
}

/**
 * Sibling map shape on `scoreData.confidenceBySource`.
 * Keys are the six-index dimensions + 'vision' for Vision IQ completeness.
 * Values are 0-100 confidence scores.
 *
 * Server-side (location-iq/+server.ts) computes these based on:
 *  - Source data freshness (MTA counts from 2024 = 100, 2020 = 60)
 *  - Source coverage (did we successfully fetch the data at all)
 *  - Vision IQ: completeness of user-provided concept details
 */
export interface ConfidenceBySource {
	transit?: number;
	safety?: number;
	demographics?: number;
	competition?: number;
	vibrancy?: number;
	momentum?: number;
	vision?: number;
}

/**
 * Points deducted from a dimension's confidence for each orchestrator-logged
 * error tied to one of its sources. Moved here from location-iq/+server.ts
 * as part of the confidence-contract single-source-of-truth refactor.
 */
export const CONFIDENCE_ERROR_PENALTY = 20;

/**
 * Dimension → source keyword map used to bind orchestrator errors to the
 * correct confidence dial. When an error key (from `report.errors`)
 * contains any of these keywords, the dimension takes a
 * `CONFIDENCE_ERROR_PENALTY` hit.
 *
 * Grouped here so future sources (Placer.ai, SafeGraph, new census products)
 * can be added in one place rather than patching the server handler.
 */
export const DIMENSION_SOURCE_KEYWORDS: Record<string, string[]> = {
	transit:      ['transit', 'mta', 'subway'],
	safety:       ['nypd', 'crime', 'safety'],
	demographics: ['census', 'demographics', 'acs'],
	competition:  ['overpass', 'google-places', 'foursquare', 'yelp'],
	vibrancy:     ['vibrancy', 'foot-traffic', '311'],
	momentum:     ['momentum', 'permits', 'dob'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// VISION IQ TIERS (B2-1.3)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vision IQ score → tier-label cutoffs.
 *
 * Kalpna-approved canonical values. Previously divergent:
 *   - location/+page.svelte used 80 / 70 / 60
 *   - dashboard/+page.svelte used 80 / 65 / 50
 *
 * Canonical map (apply everywhere):
 *   differentiated: score ≥ 80 — Vision differentiates the concept strongly
 *   established:    score ≥ 65 — Vision is coherent and positioned
 *   emerging:       score ≥ 50 — Vision is taking shape
 *   (below 50)      → caller decides how to render "unformed"
 *
 * Note: this is the SCORE-based display tier. It is separate from the
 * priceLevel-driven "visionTier" vocabulary (commodity / standard /
 * differentiated / highly_differentiated) which classifies the CONCEPT's
 * positioning, not the score output.
 *
 * Consumers (handoffs — NOT modified in this PR, other threads own these):
 *   - src/routes/app/location/+page.svelte  (UX — U-1.2)
 *   - src/routes/app/dashboard/+page.svelte (UX)
 *   - /api/score/preview, /api/location-iq  (Brain 3 owns location-iq)
 */
export const VISION_IQ_TIERS = {
	differentiated: 80,
	established:    65,
	emerging:       50,
} as const;
export type VisionIQTierLabel = keyof typeof VISION_IQ_TIERS;

/**
 * Classify a Vision IQ score into a tier label. Returns null for scores
 * below the emerging floor (50); caller decides how to render "unformed".
 */
export function visionIQTier(score: number): VisionIQTierLabel | null {
	if (score >= VISION_IQ_TIERS.differentiated) return 'differentiated';
	if (score >= VISION_IQ_TIERS.established)    return 'established';
	if (score >= VISION_IQ_TIERS.emerging)       return 'emerging';
	return null;
}
