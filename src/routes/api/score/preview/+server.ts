/**
 * BR-04: Lightweight score preview endpoint.
 *
 * POST /api/score/preview
 *
 * Recomputes Vision IQ + Fit IQ + score confidence from partial Vision answers
 * WITHOUT re-fetching intel sources and WITHOUT persisting anything.
 *
 * This is the debounced endpoint that powers UX-20 (live score feedback on
 * input change). The Vision tab calls this every ~300ms while the user is
 * editing, the UI animates the needle to the new score, and nothing hits the
 * 20-source intel pipeline or block_group_scores table.
 *
 * Contract:
 * - Client MUST send `indexScores` (the 8 dimension scores already known from
 *   the live GET /api/location-iq response). No DB fallback — this endpoint
 *   explicitly refuses to touch Supabase.
 * - Client MAY send `locationIQScore` so we can compute fitIQ via the live
 *   60/40 blend. If omitted, fitIQ comes back null and the UI should fall
 *   back to showing visionIQ only.
 * - Client sends `conceptAnswers` — any subset of the 12 Vision inputs. Empty
 *   object is legal (returns preliminary score).
 *
 * Response shape matches the Fit IQ section of POST /api/location-iq so the
 * UI can render the same chips without branching on endpoint.
 *
 * Rate limit: same bucket as location-iq POST (intel), max 10/min per user.
 * In practice UX-20 debounces at ~300ms so this never approaches the limit.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { computeDynamicVisionIQ, resolveConceptType } from '$lib/intel/six-index';
import type { IndexName } from '$lib/intel/six-index';
import { buildDynamicConfig, computeVisionImpact } from '$lib/intel/dynamic-concept-config';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';
import { fitGrade } from '$lib/utils/decision-engine';
import { CONFIDENCE_BANDS } from '$lib/constants/scoring-thresholds';
// 04.22.2026: Import canonical Fit IQ formula from bundle-builder (single source of truth)
import { computeCanonicalFitIQ } from '$lib/intel/scoring/bundle-builder';

/** Same constant as /api/location-iq — kept in sync by convention. */
const TOTAL_VISION_INPUTS = 12;

/**
 * CALIBRATION FIX F1: Sparse-input visionIQ ceilings.
 *
 * When < 6 of 12 concept inputs are filled, dynamicVisionIQ defaults to ~100
 * because the weighted average of high Midtown index scores IS legitimately high.
 * But with only 3 inputs (concept, tier, budget skip), the "vision" hasn't been
 * evaluated at all — so we cap it at a conservative tier-based default.
 *
 * These ceilings get bypassed once the user fills ≥ 6 inputs (visionCompleteness ≥ 0.5).
 */
const SPARSE_VISION_CEILINGS: Record<string, number> = {
	commodity: 30,            // v1.1: was 35 — $4.50 drip has near-zero vision value
	standard: 50,             // unchanged
	differentiated: 75,       // v1.1: was 65 — differentiated concepts earn stronger baseline
	highly_differentiated: 90, // v1.1: was 75 — $9 protein coffee has built-in premium positioning
};

function deriveScoreConfidence(visionCompleteness: number): {
	scoreConfidence: 'preliminary' | 'partial' | 'confident';
	scoreConfidenceReason: string;
} {
	const filled = Math.round(visionCompleteness * TOTAL_VISION_INPUTS);
	if (visionCompleteness < CONFIDENCE_BANDS.preliminary) {
		return {
			scoreConfidence: 'preliminary',
			scoreConfidenceReason: `Only ${filled} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score may shift as you add more.`
		};
	}
	if (visionCompleteness < CONFIDENCE_BANDS.partial) {
		return {
			scoreConfidence: 'partial',
			scoreConfidenceReason: `${filled} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score is stabilizing.`
		};
	}
	return {
		scoreConfidence: 'confident',
		scoreConfidenceReason: `${filled} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score is reliable for decision-making.`
	};
}

export const POST: RequestHandler = async ({ request }) => {
	const limited = rateLimit(request, RATE_LIMITS.intel);
	if (limited) return limited;

	let body: {
		businessType?: string;
		conceptAnswers?: Record<string, string>;
		indexScores?: Record<IndexName, number>;
		locationIQScore?: number;
		avgTicket?: number;
		visionTier?: string;
	};

	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const {
		businessType = 'cafe',
		conceptAnswers = {},
		indexScores,
		locationIQScore,
		avgTicket,
		visionTier,
	} = body;

	// Hard requirement: indexScores must come from the client (from the GET
	// response). This endpoint refuses to touch Supabase or re-fetch intel —
	// that's what makes it a "preview" rather than a full re-score.
	if (!indexScores || typeof indexScores !== 'object') {
		return new Response(
			JSON.stringify({
				error:
					'indexScores is required. Send the 8 dimension scores from the current GET /api/location-iq response (sixIndex.indices[X].score).'
			}),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	// Validate the shape — dimensions must be numbers in [0, 100].
	// Support both legacy IndexName keys and the new Coffee Engine keys.
	for (const [k, v] of Object.entries(indexScores)) {
		if (typeof v !== 'number' || isNaN(v) || v < 0 || v > 100) {
			return new Response(
				JSON.stringify({
					error: `indexScores.${k} must be a number between 0 and 100 (got ${JSON.stringify(v)})`
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}
	}

	try {
		const conceptType = resolveConceptType(businessType);
		const dynamicConfig = buildDynamicConfig(conceptType, conceptAnswers);
		const dynamicVisionIQ = computeDynamicVisionIQ(indexScores, dynamicConfig);

		const answersUsed = Object.keys(conceptAnswers).length;
		const visionCompleteness = Math.min(1, answersUsed / TOTAL_VISION_INPUTS);

		// ── CALIBRATION FIX F1: Sparse-input visionIQ ceiling ──
		// With < 6 of 12 inputs filled, the dynamicVisionIQ is a generic weighted
		// average of location index scores — it hasn't "seen" the user's concept
		// vision at all. Cap it at a conservative tier-based default so that
		// commodity shops don't score the same as highly differentiated ones.
		let effectiveVisionScore = dynamicVisionIQ.score;
		let sparseInputCapped = false;
		if (visionCompleteness < 0.5) {
			const tier = visionTier || 'standard';
			const ceiling = SPARSE_VISION_CEILINGS[tier] ?? 50;
			if (effectiveVisionScore > ceiling) {
				effectiveVisionScore = ceiling;
				sparseInputCapped = true;
			}
		}

		// Fit IQ: canonical 60/40 blend via computeCanonicalFitIQ.
		// 04.22.2026 Deprecating: was `Math.round(locationIQScore * 0.6 + safeVision * 0.4)`
		// hardcoded inline. Now uses the same function as buildLocationScoreBundle
		// so the preview and final scores share identical blend math.
		// Preview still never touches batch-calibrated scores — it's a trajectory
		// indicator, not a final answer.
		// U4/U5: Guard against NaN in effectiveVisionScore before blending
		const safeVision = isNaN(effectiveVisionScore) ? 50 : effectiveVisionScore;
		let fitScore: number | null = null;
		if (typeof locationIQScore === 'number' && !isNaN(locationIQScore)) {
			fitScore = computeCanonicalFitIQ(locationIQScore, safeVision);
		}
		const { scoreConfidence, scoreConfidenceReason } = deriveScoreConfidence(visionCompleteness);

		// BR-01 + BR-03: remaining upside + per-field impact map.
		// Same envelope as /api/location-iq POST so UX-05 and UX-12 can read it
		// from either endpoint without branching.
		const visionImpact = computeVisionImpact(conceptType, conceptAnswers);

		return new Response(
			JSON.stringify({
				visionIQ: {
					...dynamicVisionIQ,
					score: effectiveVisionScore, // override with capped score if sparse
					isDynamic: true,
					conceptType,
					answersUsed,
					// F1 traceability: expose the raw vs capped values so UX/CTO can debug
					rawScore: dynamicVisionIQ.score,
					sparseInputCapped,
					visionTier: visionTier || 'standard',
				},
				fitIQ:
					fitScore != null
						? {
								score: fitScore,
								grade: fitGrade(fitScore),
								isDynamic: true,
								source: 'preview',
								locationIQWeight: 0.6,
								visionIQWeight: 0.4
							}
						: null,
				scoreConfidence,
				scoreConfidenceReason,
				visionCompleteness,
				totalVisionInputs: TOTAL_VISION_INPUTS,
				// BR-01 + BR-03: upside + per-field impact — same shape as /api/location-iq POST.
				maxUpside: visionImpact.maxUpside,
				perFieldImpact: visionImpact.perFieldImpact,
				visionImpactSummary: {
					totalQuestions: visionImpact.totalQuestions,
					answeredCount: visionImpact.answeredCount,
					unansweredCount: visionImpact.unansweredCount
				},
				// Calibration traceability: echo back avgTicket + visionTier so
				// localStorage and UX can trace which tier produced which score.
				avgTicket: avgTicket ?? 5.00,
				visionTier: visionTier || 'standard',
				// Tell the UI this is a non-persisted preview. UX-20 can use this to
				// render a subtle "preview" hint next to the animated number.
				preview: true
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store'
				}
			}
		);
	} catch (e: unknown) {
		console.error('[ScorePreview] Error:', e);
		return new Response(
			JSON.stringify({
				error: 'Internal error computing score preview',
				message: e instanceof Error ? e.message : 'Unknown error'
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
