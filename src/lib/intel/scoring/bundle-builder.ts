/**
 * buildLocationScoreBundle — Canonical Location Scoring Orchestrator
 * ─────────────────────────────────────────────────────────────────────────────
 * 04.22.2026 — Created to eliminate the "Two Brains" problem.
 *
 * SINGLE ENTRY POINT for the full location scoring pipeline:
 *   1. Resolve geoid from lat/lng
 *   2. Fetch precomputed block_group_scores (neighborhoodHealth, survivalRate, etc.)
 *   3. Overlay live survival rate from DOHMH
 *   4. Fetch enhanced location intel (all 20 sources, 4-layer pipeline)
 *   5. Compute historical context (Power Broker priors)
 *   6. Run computeLocationIQ (legacy) + runIQScore (six-index model)
 *   7. Optionally compute dynamic Vision IQ + canonical Fit IQ blend
 *
 * Previously this pipeline was duplicated across:
 *   - routes/api/location-iq/+server.ts  (GET handler, lines ~554-632)
 *   - routes/api/re-score/+server.ts     (POST handler, lines ~148-209)
 *
 * Both endpoints now call buildLocationScoreBundle() and get identical
 * scoring math. The Fit IQ formula (0.60 * locationIQ + 0.40 * visionIQ)
 * lives HERE and nowhere else.
 *
 * This module is server-importable only (uses Supabase service client).
 */

import {
	fetchEnhancedLocationIntel,
	computeLocationIQ,
	computeConfidence,
	computeScoreAgreement,
	computeDynamicVisionIQ,
} from '$lib/intel';
import { runIQScore } from '$lib/intel/scoring/iq-score';
import { scoreToGrade } from '$lib/intel/scoring/grade-scale';
import type { IQScoreOutput } from '$lib/intel/scoring/iq-score';
import { lookupHistoricalContext } from '$lib/intel/data-quality-gate';
import type { PrecomputedScores, IndexName, VisionTier } from '$lib/intel/six-index';
import { buildDynamicConfig } from '$lib/intel/dynamic-concept-config';
import { resolveConceptType } from '$lib/intel/six-index';
import { latLngToGeoid } from '$lib/intel/block-group';
import { detectBorough } from '$lib/constants/geography';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
import { normalizeBusinessType } from '$lib/intel/registry/business-type-registry';
import { getSurvivalRate } from '$lib/intel/survival-rate';
import type { LocationIntelReport } from '$lib/intel/types';

// ─────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────

export interface LocationScoreBundleInput {
	/** Latitude of the location */
	lat: number;
	/** Longitude of the location */
	lng: number;
	/** Raw or normalized business type string (e.g. "cafe", "specialty_coffee") */
	businessType: string;
	/** Optional human-readable address string */
	address?: string;
	/** Optional concept answers from Vision questionnaire */
	conceptAnswers?: Record<string, string>;
	/** Vision tier from user's onboarding (commodity → highly_differentiated) */
	visionTier?: VisionTier;
	/** Average ticket price in dollars */
	avgTicket?: number;
	/** Whether to use AI-powered narrative enrichment */
	useAI?: boolean;
	/** AbortSignal for timeout control — outer endpoint can wrap with its own timeout */
	signal?: AbortSignal;
}

export interface LocationScoreBundle {
	/** The full 20-source intel report */
	report: LocationIntelReport;
	/** Resolved Census block group ID */
	geoid: string | null;
	/** Pre-computed scores from block_group_scores table */
	precomputed: PrecomputedScores & { visionIQ?: number; fitIQ?: number; fitComponents?: Record<string, unknown> };
	/** Legacy IQ computation result */
	iq: ReturnType<typeof computeLocationIQ>;
	/** Confidence metrics from computeConfidence */
	confidence: ReturnType<typeof computeConfidence> & { scoreAgreement?: ReturnType<typeof computeScoreAgreement> };
	/** Six-index model output (the canonical scoring result) */
	sixIndex: IQScoreOutput;
	/** Historical context impact types from Power Broker */
	historicalImpactTypes: string[];
	/** Final Location IQ score (from sixIndex) */
	locationIQ: number;
	/** Canonical six-dimension sub-scores */
	sixScores: Record<string, number>;
	/** Vision IQ score (null if no conceptAnswers provided) */
	visionIQ: number | null;
	/**
	 * Canonical Fit IQ score — THE SINGLE SOURCE OF TRUTH.
	 * Formula: Math.round(locationIQ * 0.60 + visionIQ * 0.40)
	 * Null if visionIQ is not available.
	 */
	fitScore: number | null;
	/** Normalized business type used for scoring */
	normalizedBusinessType: string;
}

// ─────────────────────────────────────────────────
// Shared helpers (extracted from location-iq/+server.ts)
// ─────────────────────────────────────────────────

/**
 * Fetch pre-computed neighborhood scores + Vision IQ + Fit IQ for a geoid.
 * Extracted from location-iq/+server.ts to be shared across endpoints.
 */
async function fetchPrecomputedScores(
	geoid: string,
	conceptType?: string
): Promise<PrecomputedScores & { visionIQ?: number; fitIQ?: number; fitComponents?: Record<string, unknown> }> {
	const scoreTypes = ['six_neighborhood_health', 'six_survival_rate', 'six_commercial_density'];
	if (conceptType) {
		scoreTypes.push(`halo:${conceptType}`);
		scoreTypes.push(`vision_iq:${conceptType}`);
		scoreTypes.push(`fit_score:${conceptType}`);
	}

	let data: any[] = [];
	try {
		const result = await db.execute(sql`
			SELECT score_type, score, components 
			FROM block_group_scores 
			WHERE geoid = ${geoid} AND score_type = ANY(${scoreTypes})
		`);
		data = result.rows || [];
	} catch (error: any) {
		console.error('[BundleBuilder] fetchPrecomputedScores error:', error.message, `(code: ${error.code})`);
		return {};
	}

	const result: PrecomputedScores & { visionIQ?: number; fitIQ?: number; fitComponents?: Record<string, unknown> } = {};
	for (const row of data) {
		if (row.score_type === 'six_neighborhood_health') result.neighborhoodHealth = row.score;
		if (row.score_type === 'six_survival_rate') result.survivalRate = row.score;
		if (row.score_type === 'six_commercial_density') result.commercialDensity = row.score;
		if (row.score_type.startsWith('halo:')) result.haloScore = row.score;
		if (row.score_type.startsWith('vision_iq:')) result.visionIQ = row.score;
		if (row.score_type.startsWith('fit_score:')) {
			result.fitIQ = row.score;
			result.fitComponents = row.components || {};
		}
	}
	return result;
}

/**
 * Compute a 5-character geohash for Power Broker historical context lookup.
 * Extracted from both location-iq and re-score (was duplicated inline).
 */
function computeGeohash5(lat: number, lng: number): string {
	const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
	let mla = -90, xla = 90, mlo = -180, xlo = 180, il = true, b = 0, ix = 0, h = '';
	while (h.length < 5) {
		const md = il ? (mlo + xlo) / 2 : (mla + xla) / 2;
		const v = il ? lng : lat;
		if (v >= md) { ix = ix * 2 + 1; if (il) mlo = md; else mla = md; }
		else         { ix = ix * 2;     if (il) xlo = md; else xla = md; }
		il = !il;
		if (++b === 5) { h += BASE32[ix]; b = 0; ix = 0; }
	}
	return h;
}

// ─────────────────────────────────────────────────
// FIT IQ — Canonical Formula
// ─────────────────────────────────────────────────

/** Location IQ weight in the Fit IQ blend */
const FIT_LOCATION_WEIGHT = 0.60;
/** Vision IQ weight in the Fit IQ blend */
const FIT_VISION_WEIGHT = 0.40;

/**
 * computeCanonicalFitIQ — THE SINGLE SOURCE OF TRUTH for Fit IQ calculation.
 *
 * 04.22.2026: Extracted from inline Math.round() calls scattered across:
 *   - re-score/+server.ts line 208
 *   - score/preview/+server.ts line 182
 *   - dashboard/+page.svelte (client-side recanonicalizeScores)
 *
 * ALL of those must be deprecated and replaced with this function or
 * its output from the bundle.
 */
export function computeCanonicalFitIQ(locationIQ: number, visionIQ: number): number {
	return Math.round(locationIQ * FIT_LOCATION_WEIGHT + visionIQ * FIT_VISION_WEIGHT);
}

// ─────────────────────────────────────────────────
// Main orchestrator
// ─────────────────────────────────────────────────

/**
 * buildLocationScoreBundle — runs the full scoring pipeline and returns
 * a rich bundle that both location-iq and re-score can consume.
 *
 * Timeout control: The caller (API endpoint) is responsible for wrapping
 * this call with its own AbortSignal/timeout. This function passes the
 * signal through to fetchEnhancedLocationIntel but does not set its own
 * timeout — that's a policy decision for the endpoint layer.
 */
export async function buildLocationScoreBundle(
	input: LocationScoreBundleInput
): Promise<LocationScoreBundle> {
	const {
		lat,
		lng,
		address,
		conceptAnswers,
		visionTier,
		avgTicket,
		useAI = false,
		signal,
	} = input;

	const normalizedBusinessType = normalizeBusinessType(input.businessType);

	// ── Step 1: Resolve geoid ──
	const geoid = await latLngToGeoid(lat, lng);

	// ── Step 2: Fetch precomputed scores ──
	let precomputed: PrecomputedScores & { visionIQ?: number; fitIQ?: number; fitComponents?: Record<string, unknown> } = {};
	if (geoid) {
		precomputed = await fetchPrecomputedScores(geoid, normalizedBusinessType);
	}

	// ── Step 3: Overlay live survival rate ──
	if (geoid) {
		const borough = detectBorough(lat, lng)?.name ?? 'Manhattan';
		const survResult = await getSurvivalRate(geoid, normalizedBusinessType, borough).catch(() => null);
		if (survResult) {
			precomputed.survivalRate = survResult.rate;
		}
	}

	// ── Step 4: Fetch enhanced location intel (all 20 sources) ──
	const report = await fetchEnhancedLocationIntel(lat, lng, normalizedBusinessType, address, { useAI, signal });

	// ── Step 5: Power Broker historical context ──
	const geohash = computeGeohash5(lat, lng);
	const historicalEntries = await lookupHistoricalContext(geohash).catch(() => []);
	const historicalImpactTypes = historicalEntries.map(e => e.impact_type);

	// ── Step 6: Compute IQ scores ──
	const iq = computeLocationIQ(
		report,
		normalizedBusinessType,
		historicalImpactTypes.length > 0 ? historicalImpactTypes : undefined,
	);

	const confidence = computeConfidence(report, normalizedBusinessType);

	const sixIndex = runIQScore({
		report,
		businessType: normalizedBusinessType,
		precomputed,
		visionTier,
		avgTicket,
		historicalImpactTypes,
	});

	const locationIQ = sixIndex.locationIQ;

	// Extract sub-scores
	const sixScores: Record<string, number> = {};
	for (const [name, idx] of Object.entries(sixIndex.indices)) {
		sixScores[name] = (idx as { score: number }).score;
	}

	// Score agreement
	confidence.scoreAgreement = computeScoreAgreement(sixScores);

	// ── Step 7: Vision IQ + Fit IQ (if conceptAnswers provided) ──
	let visionIQ: number | null = precomputed.visionIQ ?? null;
	let fitScore: number | null = precomputed.fitIQ ?? null;

	if (conceptAnswers && Object.keys(conceptAnswers).length > 0) {
		const conceptType = resolveConceptType(normalizedBusinessType);
		const dynamicConfig = buildDynamicConfig(conceptType, conceptAnswers);
		const dynamicVision = computeDynamicVisionIQ(
			sixScores as Record<IndexName, number>,
			dynamicConfig,
		);
		visionIQ = dynamicVision.score;
		// 04.22.2026: Canonical Fit IQ — single source of truth
		fitScore = computeCanonicalFitIQ(locationIQ, visionIQ);
	}

	return {
		report,
		geoid,
		precomputed,
		iq,
		confidence,
		sixIndex,
		historicalImpactTypes,
		locationIQ,
		sixScores,
		visionIQ,
		fitScore,
		normalizedBusinessType,
	};
}

// Re-export space scoring for backward compatibility if needed
export * from './space-score';
