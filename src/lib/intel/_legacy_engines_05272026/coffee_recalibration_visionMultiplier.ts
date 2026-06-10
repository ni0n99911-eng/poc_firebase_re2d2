/**
 * ═══════════════════════════════════════════════════════
 * Coffee Recalibration — Vision Multiplier
 * ═══════════════════════════════════════════════════════
 *
 * The Vision Multiplier is the final scaling factor applied AFTER the
 * 6-dimension raw composite is computed. It adjusts the Location IQ
 * to reflect the fundamental difference in unit economics between
 * concept tiers.
 *
 * Formula:
 *   Location IQ = clamp(rawComposite × visionMultiplier, 5, 98)
 *
 * Why it matters:
 *   A $4.50 commodity drip competing against 40+ Dunkin'/bodegas has
 *   fundamentally different viability than a $9 protein latte at the
 *   SAME location. The multiplier captures this — a location that's
 *   an A- for a differentiated concept might be a C for commodity.
 *
 * Calibration history:
 *   v1.0: Spread was 0.90–1.10 (cosmetic 20% range)
 *   v1.1: Steepened to 0.62–1.12 (50% range) — CALIBRATION FIX F2
 *   v1.2: Commodity adjusted from 0.62 → 0.60 after 273 5th Ave
 *          scored 59 vs target 49; 0.60 projects ~47
 *
 * The spread is intentionally steep:
 *   - 0.60 to 1.12 = 87% relative difference
 *   - A raw composite of 80 yields: commodity=48, standard=68,
 *     differentiated=80, highly_differentiated=90
 */

// ── Vision Tier Type ──────────────────────────────────────────────────

export type VisionTier = 'commodity' | 'standard' | 'differentiated' | 'highly_differentiated';

/** Default tier when no vision assessment is provided */
export const DEFAULT_VISION_TIER: VisionTier = 'standard';

// ── Multiplier Configuration ──────────────────────────────────────────

export interface VisionMultiplierConfig {
	/** The vision tier identifier */
	tier: VisionTier;
	/** The multiplier applied to rawComposite */
	multiplier: number;
	/** Typical avg ticket range for this tier */
	typicalTicket: string;
	/** Example concept descriptions */
	examples: string;
	/** Human-readable label */
	label: string;
}

/**
 * Vision multiplier configuration table.
 * Ordered from lowest to highest tier.
 */
export const VISION_MULTIPLIER_CONFIGS: VisionMultiplierConfig[] = [
	{
		tier: 'commodity',
		multiplier: 0.60,
		typicalTicket: '$3.00 – $4.50',
		examples: 'Basic drip, bodega coffee, cart, Dunkin competitor',
		label: 'Commodity',
	},
	{
		tier: 'standard',
		multiplier: 0.85,
		typicalTicket: '$4.50 – $6.50',
		examples: 'Standard espresso bar, neighborhood café',
		label: 'Standard',
	},
	{
		tier: 'differentiated',
		multiplier: 1.00,
		typicalTicket: '$6.50 – $8.50',
		examples: 'Single-origin specialty, curated experience',
		label: 'Differentiated',
	},
	{
		tier: 'highly_differentiated',
		multiplier: 1.12,
		typicalTicket: '$8.50+',
		examples: 'Protein latte, wellness coffee, rare origins, experiential',
		label: 'Highly Differentiated',
	},
];

/**
 * Quick lookup map: tier → multiplier value.
 */
export const VISION_MULTIPLIERS: Record<VisionTier, number> = Object.fromEntries(
	VISION_MULTIPLIER_CONFIGS.map(c => [c.tier, c.multiplier])
) as Record<VisionTier, number>;

// ── Final Score Bounds ────────────────────────────────────────────────

/** Minimum possible Location IQ (even the worst location gets a floor) */
export const LOCATION_IQ_FLOOR = 5;

/** Maximum possible Location IQ (prevents perfect 100) */
export const LOCATION_IQ_CEILING = 98;

/** Fallback Location IQ when computation produces NaN */
export const LOCATION_IQ_NAN_FALLBACK = 50;

// ── Result Interface ──────────────────────────────────────────────────

export interface VisionMultiplierResult {
	/** The final Location IQ score (5–98) */
	locationIQ: number;
	/** Letter grade (A+ to F) */
	grade: string;
	/** The raw composite before multiplier */
	rawComposite: number;
	/** The vision multiplier applied */
	visionMultiplier: number;
	/** The vision tier used */
	visionTier: VisionTier;
	/** The product before clamping (rawComposite × multiplier) */
	rawProduct: number;
}

// ── Grade Scale ───────────────────────────────────────────────────────

function scoreToGrade(score: number): string {
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

// ── Core Computation ──────────────────────────────────────────────────

/**
 * Apply the vision multiplier to a raw composite score to produce
 * the final Location IQ.
 *
 * Pipeline:
 *   1. Look up the multiplier for the given vision tier
 *   2. Multiply: rawComposite × multiplier
 *   3. Clamp to [5, 98] (NaN → 50 fallback)
 *   4. Assign letter grade
 *
 * @param rawComposite - The weighted sum of all 6 dimensions (0–100)
 * @param visionTier - The user's concept positioning tier
 * @returns VisionMultiplierResult with final score, grade, and breakdown
 */
export function applyVisionMultiplier(
	rawComposite: number,
	visionTier?: VisionTier | null
): VisionMultiplierResult {
	const tier = visionTier ?? DEFAULT_VISION_TIER;
	const multiplier = VISION_MULTIPLIERS[tier] ?? VISION_MULTIPLIERS[DEFAULT_VISION_TIER];

	const rawProduct = rawComposite * multiplier;
	const locationIQ = isNaN(rawProduct)
		? LOCATION_IQ_NAN_FALLBACK
		: Math.round(Math.max(LOCATION_IQ_FLOOR, Math.min(LOCATION_IQ_CEILING, rawProduct)));

	return {
		locationIQ,
		grade: scoreToGrade(locationIQ),
		rawComposite: Math.round(rawComposite * 10) / 10,
		visionMultiplier: multiplier,
		visionTier: tier,
		rawProduct: Math.round(rawProduct * 10) / 10,
	};
}

/**
 * Get the full config for a vision tier.
 */
export function getVisionTierConfig(tier: VisionTier): VisionMultiplierConfig {
	return VISION_MULTIPLIER_CONFIGS.find(c => c.tier === tier)!;
}
