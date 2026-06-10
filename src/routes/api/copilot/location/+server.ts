/**
 * Location Co-Pilot — Thread 6B
 *
 * POST /api/copilot/location
 *
 * Explains your location score in plain English.
 * Answers user questions about the location. Can ask follow-up
 * questions to improve your score.
 *
 * Uses Claude Sonnet via OpenRouter for interactive responses.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/auth-middleware';
import { callLLM } from '$lib/openrouter-llm';
import { db } from '$lib/db-server';
import * as schema from '$lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { computeFitIQ, type LaunchpadProfile } from '$lib/fit-iq-engine';
// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
import { normalizeBusinessType } from '$lib/intel/registry/business-type-registry';
import { extractEditorialSignal } from '$lib/intel/editorial-signals';
import { getDoc09Intelligence } from '$lib/constants/conceptKPIs';
import { fitGrade, fitTierLabel, fitNextTier } from '$lib/utils/decision-engine';

/** Build location-relevant concept knowledge from Doc 09 */
function buildLocationConceptKnowledge(bizType: string): string {
	const intel = getDoc09Intelligence(normalizeBusinessType(bizType));
	if (!intel) return '';
	const lines: string[] = [
		`\nLOCATION INTELLIGENCE FOR ${intel.label.toUpperCase()}:`,
		`- Pull radius: ${intel.pullRadius.walkMinutes}-minute walk (${intel.pullRadius.distanceMiles} mi) — ${intel.pullRadius.type} purchase behavior`,
		`- Min daily foot traffic: ${intel.minDailyFootTraffic.toLocaleString()} pedestrians/day`,
		`- Ideal space: ${intel.idealSqFtRange[0].toLocaleString()}–${intel.idealSqFtRange[1].toLocaleString()} SF`,
		`- Clustering: ${intel.clustering.impact} — ${intel.clustering.note}`,
		`- Rent ceiling: ${(intel.costStructure.rentCeilingPct * 100).toFixed(0)}% of revenue`,
		`- Failure rates: ${intel.failureRates.year1Pct}% Y1, ${intel.failureRates.year3Pct}% Y3 — #1 cause: ${intel.failureRates.topCause}`,
	];
	if (intel.regulatoryNotes.length > 0) {
		lines.push(`- Regulatory: ${intel.regulatoryNotes[0]}`);
	}
	return lines.join('\n');
}

// ── Types ──

interface LocationCopilotRequest {
	geoid?: string; // Optional: FCC API sometimes fails for outer-borough addresses
	question?: string;
	action: 'initial_analysis' | 'explain_score' | 'improve_fit' | 'ask_question';
	scoreType?: string;
	launchpad: LaunchpadProfile;
	// P0-D: full scoring context from the page — used when geoid is unavailable
	// BR-UX-07: grade, tier, nextTier, score, verdict now first-class so the LLM
	// can frame responses in BR-1 vocabulary instead of raw numbers.
	scoringContext?: {
		address?: string;
		concept?: string;
		neighborhood?: string;
		locationIQ?: number;
		fitIQ?: number;
		visionIQ?: number;
		subScores?: Record<string, number | undefined>;
		fitVerdict?: string | null;
		// BR-UX-07
		score?: number;
		grade?: 'A' | 'B' | 'C' | 'D' | 'F' | string;
		tier?: string;
		nextTier?: { points: number; label: string; threshold: number } | null;
		verdict?: string | null;
		surface?: string;
		// other enrichments the client sends
		killFactors?: string[];
		competitorScanStatus?: string;
		competitorCount?: number;
		visionCompletionPct?: number;
		visionIsPrelim?: boolean;
		visionFieldsStatus?: Record<string, unknown>;
		dataCompleteness?: { pct?: number; available?: number; total?: number };
		dataVintage?: unknown;
		// BR-08: per-field impact map from /api/location-iq POST response.
		// Keyed by questionId → { questionId, question, maxPoints, answered, rationale }.
		// The "which input matters most?" chip reads this to pick the top unanswered lever.
		perFieldImpact?: Record<
			string,
			{
				questionId: string;
				question: string;
				maxPoints: number;
				answered: boolean;
				rationale: string;
			}
		>;
		// BR-08: max remaining upside if the founder fills every unanswered question.
		maxUpside?: number;
	};
	// COP-01: property tax context snippet from DOF integration (per-address, not block-group)
	propertyTaxSnippet?: string;
	// IMP-02: tenancy history churn risk narrative snippet
	churnRiskSnippet?: string;
}

interface LocationCopilotResponse {
	message: string;
	suggestedPrompts?: string[];
	updatedFitScore?: number;
	fitDimensions?: { label: string; score: number }[];
	sources?: string[];
}

// ── Conversation Logging (M2 fix) ──

async function logCopilotConversation(
	userId: string,
	copilotType: string,
	geoid: string | null,
	action: string,
	requestData: Record<string, any>,
	responseSummary: string,
	modelUsed: string,
	latencyMs: number
): Promise<void> {
	try {
		await db.insert(schema.copilotConversations).values({
			id: crypto.randomUUID(),
			userId: userId,
			context: action,
			messages: {
				copilot_type: copilotType,
				geoid,
				action,
				request_data: requestData,
				response_summary: responseSummary.slice(0, 200),
				model_used: modelUsed,
				latency_ms: latencyMs,
			}
		});
	} catch (err) {
		// Non-critical — don't fail the request
		console.warn('[Copilot] Failed to log conversation:', err instanceof Error ? err.message : err);
	}
}

// ── Rate Limiting (S3 fix) ──
// Simple in-memory per-user rate limit. Resets on cold starts (serverless).
// Max 10 copilot requests per minute per user.

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const _rateLimitMap = new Map<string, number[]>();

function checkRateLimit(userId: string): Response | null {
	const now = Date.now();
	const timestamps = (_rateLimitMap.get(userId) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
	if (timestamps.length >= RATE_LIMIT_MAX) {
		return new Response(JSON.stringify({
			error: 'Rate limit exceeded. Max 10 requests per minute.',
		}), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } });
	}
	timestamps.push(now);
	_rateLimitMap.set(userId, timestamps);
	// Prune old users periodically
	if (_rateLimitMap.size > 1000) {
		for (const [uid, ts] of _rateLimitMap) {
			if (ts.every(t => now - t > RATE_LIMIT_WINDOW_MS)) _rateLimitMap.delete(uid);
		}
	}
	return null;
}

// ── Data Loading ──

interface LocationContext {
	geoid: string;
	scores: Record<string, { score: number; components: any }>;
	intel: Record<string, any>;
	enriched: Record<string, any>;
	vision: { narrative: string; structured: any } | null;
	// COP-01: optional tax snippet injected from request body after context load
	taxSnippet?: string;
	// Neighborhood name (e.g. "Williamsburg") used to look up editorial signals
	// in $lib/intel/editorial-signals. Populated from scoringContext at the
	// request boundary — not from geoid (that table has no neighborhood names).
	neighborhood?: string;
}

async function loadLocationContext(geoid: string): Promise<LocationContext> {
	let visionData = null;
	try {
		const vRes = await db.execute(sql`
			SELECT narrative, structured
			FROM block_group_visions
			WHERE geoid = ${geoid} AND vision_type = 'location'
			LIMIT 1
		`);
		if (vRes && vRes.length > 0) {
			visionData = vRes[0];
		}
	} catch (err: any) {
		console.warn('[LocationCopilot] block_group_visions query failed (M5 resilience):', err?.message || err);
	}

	let scoresResData: any[] = [];
	try {
		scoresResData = await db.select({
			score_type: schema.blockGroupScores.scoreType,
			score: schema.blockGroupScores.score,
			components: schema.blockGroupScores.components
		}).from(schema.blockGroupScores).where(eq(schema.blockGroupScores.geoid, geoid));
	} catch (e: any) {
		console.warn('[LocationCopilot] block_group_scores error:', e.message);
	}

	let intelResData: any[] = [];
	try {
		intelResData = await db.select({
			source: schema.blockGroupIntel.source,
			data: schema.blockGroupIntel.data
		}).from(schema.blockGroupIntel).where(eq(schema.blockGroupIntel.geoid, geoid));
	} catch (e: any) {
		console.warn('[LocationCopilot] block_group_intel error:', e.message);
	}

	let enrichedResData: any[] = [];
	try {
		enrichedResData = await db.execute(sql`
			SELECT entity_category, entity_data
			FROM enriched_entities
			WHERE location_key = ${geoid} AND entity_type = 'block_group_intel'
		`);
	} catch (e: any) {
		console.warn('[LocationCopilot] enriched_entities error:', e.message);
	}

	// F-07: Parse scores by type. Active score types: location_iq, location_iq_v2 (Location IQ),
	// vision_iq, vision_iq:* (Vision IQ), fit_iq (Fit IQ). Deprecated: location_iq_v1.
	const scores: Record<string, any> = {};
	for (const r of scoresResData) scores[r.score_type] = { score: r.score, components: r.components };

	const intel: Record<string, any> = {};
	for (const r of intelResData) intel[r.source] = r.data;

	const enriched: Record<string, any> = {};
	for (const r of enrichedResData) enriched[r.entity_category] = r.entity_data;

	return {
		geoid,
		scores,
		intel,
		enriched,
		vision: visionData,
	};
}

// ── Build Data Summary for LLM Context ──

// R5-1: Canonical tier labels matching ScoreRings.svelte (Excellent ≥85, Great ≥70, Good ≥50, Fair ≥30, Poor <30)
function scoreTier(s: number): string {
	if (s >= 85) return 'Excellent';
	if (s >= 70) return 'Great';
	if (s >= 50) return 'Good';
	if (s >= 30) return 'Fair';
	return 'Poor';
}

function buildDataSummary(ctx: LocationContext, businessType?: string): string {
	const parts: string[] = [];

	// B5: Inject explicit neighborhood name and business type at top of context
	const neighborhood = ctx.neighborhood || 'Unknown neighborhood';
	if (businessType) {
		parts.push(`LOCATION CONTEXT: ${neighborhood} — analyzing for a ${businessType.replace(/_/g, ' ')} concept.`);
	} else {
		parts.push(`LOCATION CONTEXT: ${neighborhood}.`);
	}

	// F-07: Location IQ v2 is current (location_iq_v2). Legacy v1 (location_iq) is deprecated.
	// Prefer location_iq_v2 if available.
	const locIQv2 = ctx.scores['location_iq_v2'];
	if (locIQv2) {
		const c = locIQv2.components || {};
		parts.push(`Location IQ v2: ${locIQv2.score}/100 (Grade: ${c.grade || 'N/A'}). Concept-independent location quality. Components: marketProof=${c.marketProof || '?'}, accessibility=${c.accessibility || '?'}, vibrancy=${c.vibrancy || '?'}, demographics=${c.demographics || '?'}, safety=${c.safety || '?'}, momentum=${c.momentum || '?'}, boroughBonus=${c.boroughBonus || '?'}.`);
	} else {
		// Fallback to v1 if v2 not available
		const iq = ctx.scores['location_iq'];
		if (iq) {
			const c = iq.components || {};
			parts.push(`Location IQ (v1): ${iq.score}/100 (Grade: ${c.grade || 'N/A'}). NIQ=${c.niq || '?'} SIQ=${c.siq || '?'} TIQ=${c.tiq || '?'} LIQ=${c.liq || '?'}. Confidence: ${c.confidence || '?'}%.`);
		}
	}

	// Vision IQ — check for concept-suffixed first, fall back to default
	const visionIQKeys = Object.keys(ctx.scores).filter(k => k.startsWith('vision_iq'));
	const visionIQ = visionIQKeys.length > 0
		? ctx.scores[visionIQKeys.find(k => k.includes(':')) || visionIQKeys[0]]
		: null;
	if (visionIQ) {
		const c = visionIQ.components || {};
		// B4: Inject explicit vision tier name so CoPilot can tailor advice to positioning
		const pl = Number(c.priceLevel || c.priceLevelRaw || 0);
		const visionTierName = pl >= 4 ? 'highly_differentiated' : pl >= 3 ? 'differentiated' : pl >= 2 ? 'standard' : 'commodity';
		parts.push(`Vision IQ: ${visionIQ.score}/100. Concept-specific fit. Vision Tier: ${visionTierName} (priceLevel=${pl}). This means the concept targets ${visionTierName === 'highly_differentiated' ? 'premium positioning, higher price points, and unique experience' : visionTierName === 'differentiated' ? 'above-average quality and moderate premium pricing' : visionTierName === 'standard' ? 'mainstream pricing and broad appeal' : 'value positioning and high volume'}. Tailor all advice to this tier. Components: competition=${c.competition || '?'}, priceIncomeFit=${c.priceIncomeFit || '?'}, ageFit=${c.ageFit || '?'} (ageFitNorm=${c.ageFitNorm || '?'}). Concept: ${c.conceptType || 'full_service_restaurant'}.`);
	}

	// Fit IQ (calibrated ensemble)
	const fitIQ = ctx.scores['fit_score'] || ctx.scores['fit_iq'];
	if (fitIQ) {
		parts.push(`Fit IQ: ${fitIQ.score}/100 — tier: "${scoreTier(fitIQ.score)}" (${fitIQ.score >= 85 ? '85–100' : fitIQ.score >= 70 ? '70–84' : fitIQ.score >= 50 ? '50–69' : fitIQ.score >= 30 ? '30–49' : '0–29'} range). Calibrated ensemble score (d=0.601). This is the primary recommendation score.`);
	}

	// R5-1: Inject tier labels for all three IQ scores so CoPilot can match the score ring vocabulary
	const locIQScore = locIQv2?.score ?? ctx.scores['location_iq']?.score;
	const visionIQScore = visionIQ?.score;
	const fitIQScore = fitIQ?.score;
	const tierSummaryParts: string[] = [];
	if (locIQScore != null) tierSummaryParts.push(`Location IQ: "${scoreTier(locIQScore)}"`);
	if (fitIQScore != null) tierSummaryParts.push(`Fit IQ: "${scoreTier(fitIQScore)}"`);
	if (visionIQScore != null) tierSummaryParts.push(`Vision IQ: "${scoreTier(visionIQScore)}"`);
	if (tierSummaryParts.length > 0) {
		parts.push(`SCORE TIER LABELS (canonical — match the score ring UI): ${tierSummaryParts.join(', ')}. Thresholds: Excellent ≥85, Great ≥70, Good ≥50, Fair ≥30, Poor <30.`);
	}

	// Safety & Momentum dedicated sub-scores
	const safetySub = ctx.scores['location_sub_safety'];
	const momentumSub = ctx.scores['location_sub_momentum'];
	if (safetySub || momentumSub) {
		parts.push(`Sub-scores: Safety=${safetySub?.score || '?'}/100, Momentum=${momentumSub?.score || '?'}/100.`);
	}

	// Six-Index
	const sixKeys = ['six_transit', 'six_demographics', 'six_competition', 'six_vibrancy', 'six_safety', 'six_momentum'];
	const sixScores = sixKeys.map(k => {
		const s = ctx.scores[k];
		return s ? `${k.replace('six_', '')}: ${s.score}` : null;
	}).filter(Boolean);
	if (sixScores.length) parts.push(`Six-Index: ${sixScores.join(', ')}.`);

	// Archetypes
	const archKeys = ['archetype_routine_interceptor', 'archetype_destination_pull', 'archetype_need_filler'];
	const archScores = archKeys.map(k => {
		const s = ctx.scores[k];
		return s ? `${k.replace('archetype_', '').replace(/_/g, ' ')}: ${s.score}` : null;
	}).filter(Boolean);
	if (archScores.length) parts.push(`Demand archetypes: ${archScores.join(', ')}.`);

	// Census
	const census = ctx.intel.census_demographics;
	if (census) {
		parts.push(`Demographics: Median income $${(census.median_household_income || 0).toLocaleString()}, median age ${census.median_age || '?'}, population ${(census.total_population || 0).toLocaleString()}.`);
	}

	// Housing
	const housing = ctx.intel.census_housing;
	if (housing) {
		parts.push(`Housing: Median rent $${(housing.median_gross_rent || 0).toLocaleString()}, vacancy ${housing.vacancy_rate || '?'}%, rent burden ${housing.median_rent_burden_pct || '?'}%.`);
	}

	// Walk Score
	const ws = ctx.intel.walkscore;
	if (ws) {
		parts.push(`Walkability: Walk Score ${ws.walkscore || ws.raw?.walkscore || '?'}, Transit Score ${ws.transit_score || ws.raw?.transit?.score || '?'}.`);
	}

	// Crime
	const crime = ctx.enriched.nypd_crime;
	if (crime) {
		parts.push(`Crime: ${crime.total_crimes || 0} incidents. Felonies: ${crime.felony || 0}, misdemeanors: ${crime.misdemeanor || 0}.`);
	}

	// MTA
	const mta = ctx.enriched.mta_ridership;
	if (mta) {
		parts.push(`Transit: ${(mta.estimated_daily_ridership || 0).toLocaleString()} daily riders, ${mta.station_count_within_400m || 0} stations within 400m.`);
	}

	// Pedestrian (Gap #4: only available for ~3% of block groups — flag when absent)
	const ped = ctx.enriched.pedestrian_counts;
	if (ped && ped.avg_pedestrian_count > 0) {
		parts.push(`Foot traffic: ${(ped.avg_pedestrian_count).toLocaleString()} avg daily pedestrians (sensor-measured).`);
	} else {
		parts.push(`Foot traffic: No pedestrian sensor data for this block group. Foot traffic is estimated from transit ridership and Walk Score only — do NOT cite specific pedestrian counts.`);
	}

	// OSM/Competition
	const osm = ctx.enriched.osm_pois;
	if (osm) {
		parts.push(`Market: ${osm.total_pois || 0} businesses. Categories: ${Object.keys(osm.category_distribution || {}).length}.`);
	}

	// Liquor
	const liquor = ctx.enriched.liquor_licenses;
	if (liquor) parts.push(`Liquor licenses: ${liquor.total_licenses || 0} total.`);

	// Inspections
	const insp = ctx.enriched.dohmh_inspections;
	if (insp) parts.push(`Food inspections: ${insp.restaurant_count || insp.total_inspection_records || 0} establishments, avg score ${insp.avg_inspection_score || '?'}.`);

	// DCA
	const dca = ctx.enriched.dca_licenses;
	if (dca) parts.push(`Business licenses: ${dca.total_active_licenses || 0} active DCA licenses.`);

	// 311
	const c311 = ctx.enriched['311_complaints'];
	if (c311) parts.push(`311 complaints: ${c311.total_complaints || 0} recent. Noise: ${c311.noise_complaints || 0}.`);

	// DOB
	const dob = ctx.enriched.dob_permits;
	if (dob) parts.push(`Building: ${dob.total_permits || 0} permits, ${dob.new_building || 0} new buildings.`);

	// LPC
	const lpc = ctx.enriched.lpc_landmarks;
	if (lpc) parts.push(`Landmarks: ${lpc.landmark_count || 0} nearby. ${(lpc.district_landmarks || 0) > 0 ? 'In historic district.' : ''}`);

	// Cafes
	const cafes = ctx.enriched.sidewalk_cafes;
	if (cafes) parts.push(`Sidewalk cafes: ${cafes.cafe_count || 0} permits, ${cafes.total_seating_capacity || 0} seats.`);

	// PLUTO
	const pluto = ctx.enriched.pluto_zoning;
	if (pluto) parts.push(`Zoning: Avg built FAR ${pluto.avg_built_far || '?'}, max FAR ${pluto.avg_max_far || '?'}.`);

	// Vision narrative
	if (ctx.vision?.narrative) {
		parts.push(`\nNeighborhood Vision: ${ctx.vision.narrative.slice(0, 400)}`);
	}

	// Editorial signal from the static neighborhoodBuzz dataset. Accepts either
	// a bare neighborhood name or a full address — getNeighborhoodBuzz does fuzzy
	// substring matching. Returns null (silent no-op) for uncovered areas, so
	// locations outside our 60-neighborhood coverage won't hallucinate.
	// NB: ctx.neighborhood may be a borough like "Brooklyn" (from geoidToBorough
	// fallback) which won't match any neighborhoodBuzz key — that path silently
	// returns null, which is the desired behavior.
	if (ctx.neighborhood && businessType) {
		const signal = extractEditorialSignal(ctx.neighborhood, businessType);
		if (signal) {
			parts.push(`\nEDITORIAL SIGNAL (${signal.neighborhood}): ${signal.narrativeContext} [trend=${signal.trend}, sentiment=${signal.founderSentiment}, risk=${signal.riskLevel}]`);
		} else {
			// B5: When neighborhoodBuzz has no entry, derive character from available data
			const sixVib = ctx.scores['six_vibrancy']?.score;
			const sixDemo = ctx.scores['six_demographics']?.score;
			const charParts: string[] = [];
			if (sixVib != null) charParts.push(`vibrancy ${sixVib}/100`);
			if (sixDemo != null) charParts.push(`demographic fit ${sixDemo}/100`);
			if (census) charParts.push(`median income $${(census.median_household_income || 0).toLocaleString()}`);
			if (charParts.length > 0) {
				parts.push(`\nNEIGHBORHOOD CHARACTER (${neighborhood}): No editorial signal available. Area profile: ${charParts.join(', ')}. Use these data points to describe the area character.`);
			}
		}
	}

	// COP-01: DOF property tax snippet (per-address, injected from request body)
	if (ctx.taxSnippet) {
		parts.push(`\nPROPERTY TAX DATA (DOF):\n${ctx.taxSnippet}`);
	}

	// IMP-02: tenancy churn risk snippet
	if ((ctx as any).churnSnippet) {
		parts.push(`\nTENANCY HISTORY:\n${(ctx as any).churnSnippet}`);
	}

	return parts.join('\n');
}

// ── System Prompts ──

const LOCATION_SYSTEM_PROMPT = `You are the RE² Location Co-Pilot — an AI assistant that helps small business founders understand location intelligence data for NYC commercial real estate.

RULES:
1. Be concise and specific. Use actual numbers from the data provided.
2. Tailor every response to the user's business type and profile.
3. When explaining scores, cite the specific data points that drive them.
4. If data is missing, say so. Never fabricate numbers.
5. Keep responses under 200 words unless asked for detail.
6. Speak in plain business English. No jargon.
7. Always suggest 2-3 follow-up questions the user might ask.
8. When explaining your score, reference the underlying data and concept fit without breaking down internal sub-scores.
9. PLAIN TEXT ONLY. Do not use markdown formatting. No ** bold markers, no * italic
   markers, no # headings, no inline code with backticks, no [links], no fenced code
   blocks. The CoPilot bubble renders raw text — markdown shows up as literal
   asterisks in the UI. (B2-NEW-2 / C3)

CRITICAL — SCORE TIER LANGUAGE (R5-1):
When describing scores, you MUST use the tier label provided in the SCORE TIER LABELS line
(Excellent/Great/Good/Fair/Poor). Never contradict the tier.
- A score labeled "Excellent" or "Great" must be described positively.
- A score labeled "Good" is neutral — note strengths and areas for improvement.
- A score labeled "Fair" or "Poor" can note challenges honestly.
- Match your tone to the tier, not to raw numbers. A Fit IQ of 72 ("Great") should never be
  described as "challenging" or "tight." A Fit IQ of 48 ("Fair") should not be described as "solid."
- The five tier labels are canonical: Excellent (≥85), Great (≥70), Good (≥50), Fair (≥30), Poor (<30).
- Never invent new tier names or use letter grades (A/B/C/D/F).

CRITICAL — GROUNDING RULE (B3):
Only reference amenities, features, and characteristics that are explicitly present in the data
provided below. If a feature is not mentioned in the data, do not infer or fabricate it. Say
"data not available" rather than guessing. Never mention rooftop decks, outdoor seating,
parking, or other physical features unless they appear in the Places or enriched data.

CRITICAL — PEDESTRIAN DATA:
- Pedestrian sensor counts are available for only ~3% of NYC block groups.
- If the data summary says "No pedestrian sensor data", you MUST NOT cite specific pedestrian counts.
- Instead, describe foot traffic qualitatively using transit ridership and Walk Score as proxies.
- Say things like "based on nearby transit ridership of X, this area likely sees moderate foot traffic" — NOT "12,000 daily pedestrians".
- When pedestrian sensor data IS available, it is labeled "(sensor-measured)" — only then can you cite the number directly.

CRITICAL — SCORE DISPLAY LABELS (ISS-01B):
When citing sub-scores, always use these user-facing labels — never internal variable names:
- "Transit" (not "transit", "six_transit", or "transitScore")
- "Demographics" (not "demographics" or "demo")
- "Competition" (not "competition" or "compScore")
- "Concept Pulse" (not "vibrancy", "vibrancy_index", or "Area Vibrancy") — this measures how alive the trade area is within the concept's specific walking radius (250m coffee, 500m restaurant, 800m grocery). A quiet Concept Pulse means destination marketing will matter more than walk-by traffic — it's NOT a judgment on the neighborhood. Visible inside the Highest Impact Factors section; if the user asks where it is, tell them to expand that accordion
- "Market Proof" (not "survivalRate", "survival_rate", or "marketProof")
- "Momentum" (not "momentum")
- "Safety" (not "safety")
Format: always say "Transit score of 70/100" not "transit: 70". If a sub-score isn't on the user's current view, tell them exactly where to find it rather than assuming they can see it.

CRITICAL — VERDICT TIER ON EVERY SCORE (B2-NEW-1, H8):
Whenever you cite any sub-score or headline score, you MUST append the verdict
tier inline using an em-dash. Format: "{score}/100 — {tier}". Never quote a
bare number. Tier cutoffs (canonical — do not invent new labels):
  0–29   → Weak
  30–49  → Low
  50–64  → Mixed
  65–79  → Strong
  80–100 → Excellent
Examples:
  ✓ "Transit score of 88/100 — Excellent"
  ✓ "Competition is 62/100 — Mixed"
  ✓ "Your Fit IQ is 75/100 — Strong"
  ✗ "Transit score of 88/100"
  ✗ "Competition: 62"
This applies to every score mention in every response, including follow-up
questions and CoPilot chips.`;

// ── Action Handlers ──

async function handleInitialAnalysis(
	ctx: LocationContext,
	launchpad: LaunchpadProfile
): Promise<LocationCopilotResponse> {
	const dataSummary = buildDataSummary(ctx, launchpad?.businessType);
	// Prefer V4 Location IQ v2, fall back to v1
	const locIQv2 = ctx.scores['location_iq_v2'];
	const locationIQ = locIQv2?.score ?? ctx.scores['location_iq']?.score ?? 0;
	const grade = locIQv2?.components?.grade ?? ctx.scores['location_iq']?.components?.grade ?? 'N/A';

	const conceptKnowledge = buildLocationConceptKnowledge(launchpad.businessType);
	const userMsg = `Analyze this location for a ${launchpad.businessType} business.
${conceptKnowledge}

LOCATION DATA:
${dataSummary}

USER PROFILE:
- Business type: ${launchpad.businessType}
- Budget: ${launchpad.budget || 'not specified'}
- Rent tolerance: ${launchpad.rent || 'not specified'}
- Target customer: ${launchpad.targetCustomer || 'not specified'}
- Experience: ${launchpad.experience || 'not specified'}
- Risk tolerance: ${launchpad.riskTolerance || 'not specified'}

Give a 3-4 sentence plain-English analysis: what's strong, what's weak, and how it relates to their specific business. Use simple language and avoid referencing multiple internal scoring components. End with 3 suggested follow-up questions.`;

	const result = await callLLM({
		model: 'sonnet',
		system: LOCATION_SYSTEM_PROMPT,
		messages: [{ role: 'user', content: userMsg }],
		maxTokens: 600,
		temperature: 0.5,
	});

	// Extract suggested prompts from response (look for numbered questions)
	const suggestedPrompts = extractSuggestions(result.content);

	// Track which data sources contributed
	const sources = [
		ctx.intel.census_demographics ? 'census' : null,
		ctx.intel.walkscore ? 'walkscore' : null,
		ctx.enriched.nypd_crime ? 'crime' : null,
		ctx.enriched.mta_ridership ? 'transit' : null,
		ctx.enriched.osm_pois ? 'market_density' : null,
		ctx.enriched.dohmh_inspections ? 'inspections' : null,
		ctx.vision ? 'vision_narrative' : null,
	].filter(Boolean) as string[];

	return {
		message: result.content,
		suggestedPrompts: suggestedPrompts.length > 0 ? suggestedPrompts : [
			'Why is competition scored this way?',
			'Is the foot traffic good for my business type?',
			'What are the biggest risks here?',
		],
		sources,
	};
}

async function handleExplainScore(
	ctx: LocationContext,
	scoreType: string,
	launchpad: LaunchpadProfile
): Promise<LocationCopilotResponse> {
	const dataSummary = buildDataSummary(ctx, launchpad?.businessType);

	// Map friendly names to score keys
	const scoreKeyMap: Record<string, string> = {
		'location_iq': 'location_iq',
		'location_iq_v2': 'location_iq_v2',
		'vision_iq': 'vision_iq',
		'fit_iq': 'fit_score',
		'fit_score': 'fit_score',
		'transit': 'six_transit',
		'demographics': 'six_demographics',
		'competition': 'six_competition',
		'vibrancy': 'six_vibrancy',
		'safety': 'six_safety',
		'momentum': 'six_momentum',
		'location_safety': 'location_sub_safety',
		'location_momentum': 'location_sub_momentum',
	};

	const scoreKey = scoreKeyMap[scoreType] || scoreType;
	const scoreData = ctx.scores[scoreKey];

	const conceptKnowledge = buildLocationConceptKnowledge(launchpad.businessType);
	const userMsg = `Explain the ${scoreType} score for this location in detail.
${conceptKnowledge}

Score: ${scoreData ? `${scoreData.score}/100` : 'not available'}
Components: ${scoreData ? JSON.stringify(scoreData.components) : 'none'}

FULL LOCATION DATA:
${dataSummary}

Business type: ${launchpad.businessType}
Target customer: ${launchpad.targetCustomer || 'not specified'}

Explain WHY it scored this way using actual data points. Be specific — cite numbers, station names if available, competitor counts. Then explain what this means for their ${launchpad.businessType} business specifically.`;

	const result = await callLLM({
		model: 'sonnet',
		system: LOCATION_SYSTEM_PROMPT,
		messages: [{ role: 'user', content: userMsg }],
		maxTokens: 500,
		temperature: 0.4,
	});

	return {
		message: result.content,
		suggestedPrompts: [
			'How does this compare to other areas?',
			`What would improve the ${scoreType} score?`,
			'Show me the raw data behind this.',
		],
	};
}

async function handleImproveFit(
	ctx: LocationContext,
	launchpad: LaunchpadProfile,
	geoid: string | undefined,
	scoringContext?: LocationCopilotRequest['scoringContext']
): Promise<LocationCopilotResponse> {
	// BR-07: When Vision completeness is below 50%, the fastest score improvement
	// comes from filling the Vision tab — NOT from LaunchpadProfile fields.
	// Short-circuit with a targeted nudge before falling back to the generic flow.
	const visionPct = typeof scoringContext?.visionCompletionPct === 'number'
		? scoringContext.visionCompletionPct
		: null;
	const visionFrac = visionPct != null && visionPct > 1 ? visionPct / 100 : (visionPct ?? null);

	if (visionFrac != null && visionFrac < 0.5) {
		const filledApprox = Math.round((visionFrac || 0) * 12);
		return {
			message: `The fastest 3 points: fill your Hours, Food Program, and Differentiator in the Vision tab. Each is worth about +2 points for your concept. Once you hit 6 of 12 inputs, your score will show as confident instead of preliminary.\n\nYou're currently at ${filledApprox} of 12 Vision inputs — filling three more flips the score from PRELIMINARY to PARTIAL and gives the Brain enough signal to recalibrate this location to your specific business model.`,
			suggestedPrompts: [
				'Take me to the Vision tab',
				'Why do those three fields matter most?',
				'What counts as "confident"?',
			],
		};
	}

	// Identify what's missing from the profile
	const missing: string[] = [];
	if (!launchpad.targetCustomer) missing.push('target customer');
	if (!launchpad.riskTolerance) missing.push('risk tolerance');
	if (!launchpad.experience) missing.push('experience level');
	if (!launchpad.hours) missing.push('operating hours');
	if (!launchpad.ownerType) missing.push('ownership type');
	if (!launchpad.rent) missing.push('rent budget');

	if (missing.length === 0) {
		// Profile is complete — recompute and explain
		const fitResult = await computeFitIQ(geoid || '', launchpad);
		return {
			message: `Your score is ${fitResult.fitIQ}/100 (${fitResult.grade}). Your profile is complete — all dimensions are fully scored. ${fitResult.alignment > 0 ? `This location is actually a better fit for YOUR specific business than the general market signals suggest (+${fitResult.alignment} points).` : fitResult.alignment < -5 ? `The market signals are stronger than your specific fit by ${Math.abs(fitResult.alignment)} points — this location may not be the best match for your concept.` : 'Your score closely matches the market signals — this is a well-rounded match.'}`,
			updatedFitScore: fitResult.fitIQ,
			fitDimensions: fitResult.dimensions.map(d => ({ label: d.label, score: d.score })),
			suggestedPrompts: [
				'What dimensions are weakest?',
				'How can I improve my score?',
				'Show me locations with a better score.',
			],
		};
	}

	// Ask for the most impactful missing field
	const fieldToAsk = missing[0];
	const questions: Record<string, string> = {
		'target customer': "Who is your ideal customer? (e.g., 'office lunch crowd', 'young families', 'health-conscious millennials')",
		'risk tolerance': "How would you describe your risk tolerance? Conservative, moderate, or aggressive?",
		'experience level': "How much experience do you have in this industry?",
		'operating hours': "What hours do you plan to operate?",
		'ownership type': "What's your ownership situation? Solo, partnership, franchise?",
		'rent budget': "What monthly rent can you handle?",
	};

	return {
		message: `To improve your score accuracy, I need one more piece of information: ${questions[fieldToAsk] || `What is your ${fieldToAsk}?`} This will help me better match the location data to your specific needs.`,
		suggestedPrompts: missing.length > 1
			? [`Skip this — what's my current score?`, `Why does ${fieldToAsk} matter?`]
			: undefined,
	};
}

async function handleAskQuestion(
	ctx: LocationContext,
	question: string,
	launchpad: LaunchpadProfile,
	scoringContext?: LocationCopilotRequest['scoringContext']
): Promise<LocationCopilotResponse> {
	const dataSummary = buildDataSummary(ctx, launchpad?.businessType);

	// Build a scored-page context block when scoringContext is passed (P0-D fix)
	// BR-UX-07: include grade, tier, nextTier so the LLM can frame answers in canonical
	// BR-1 vocabulary. Derive any fields the client didn't send from fitIQ via the
	// decision-engine — single source of truth.
	let liveScoreContext = '';
	let grade: string | undefined;
	let tier: string | undefined;
	let nextTier: { points: number; label: string; threshold: number } | null | undefined;
	let primaryScore: number | string = 'N/A';
	if (scoringContext?.address) {
		const ss = scoringContext.subScores || {};
		// Use unified score field, fallback to fitIQ for backward compat
		primaryScore = scoringContext.score ?? scoringContext.fitIQ ?? 'N/A';
		const fitForDerivation = typeof primaryScore === 'number' ? primaryScore : (scoringContext.fitIQ ?? 0);
		grade = scoringContext.grade ?? (fitForDerivation > 0 ? fitGrade(fitForDerivation) : undefined);
		tier = scoringContext.tier ?? (fitForDerivation > 0 ? fitTierLabel(fitForDerivation) : undefined);
		nextTier = scoringContext.nextTier !== undefined
			? scoringContext.nextTier
			: (fitForDerivation > 0 ? fitNextTier(fitForDerivation) : undefined);
		const verdict = scoringContext.verdict ?? scoringContext.fitVerdict ?? '';
		const gradeLine = grade && tier ? `\n- GRADE / TIER: Grade ${grade} · ${tier}` : '';
		const nextTierLine = nextTier
			? `\n- NEXT TIER: ${nextTier.points} points to ${nextTier.label} (threshold ${nextTier.threshold})`
			: (fitForDerivation > 0 ? '\n- NEXT TIER: already at Strong Path (top tier)' : '');
		liveScoreContext = `
SCORE CURRENTLY ON SCREEN FOR ${scoringContext.address}:
- Your Score: ${primaryScore}/100 (recommendation strength for ${scoringContext.concept})${gradeLine}${nextTierLine}
Sub-scores: Transit ${ss.transit ?? '?'}, Safety ${ss.safety ?? '?'}, Demographics ${ss.demographics ?? '?'}, Concept Pulse ${ss.vibrancy ?? '?'}, Market Proof ${ss.marketProof ?? '?'}, Momentum ${ss.momentum ?? '?'}
${verdict ? `Verdict: ${verdict.replace(/<[^>]+>/g, '')}` : ''}
Concept: ${scoringContext.concept}
`;
	}

	// ── BR-UX-02 / 03 / 04 + BR-08: Intent detection for the hero chip prompts ───
	// These match the exact text the hero chips fire via sendCopilotFromBar,
	// plus looser regex for the same intents typed by the user.
	const intent = (() => {
		// BR-08: "Which input matters most?" / "what matters most" / "biggest lever"
		// Matched BEFORE improve_levers so the more specific phrasing wins.
		if (/which (input|field|question|answer)s? matters?( most)?/i.test(question)) return 'which_input_matters';
		if (/(what|which) (is|are) (the )?(biggest|top) (lever|input|field)/i.test(question)) return 'which_input_matters';
		if (/most impactful (input|field|question|answer)/i.test(question)) return 'which_input_matters';
		// "How do I get from X to Y?" or "how do i improve" or "next tier"
		if (/^how do i (get from|improve|reach)|next tier|to (?:strong path|viable|tight|stretch)/i.test(question)) return 'improve_levers';
		if (/improve my chances/i.test(question)) return 'improve_levers';
		// "Why is this a N?" or "why is this a 62"
		if (/^why is this a\s*\d{1,3}/i.test(question) || /^why (is )?this score/i.test(question)) return 'explain_breakdown';
		// "What would kill this location?" / "what would kill this"
		if (/what would kill this/i.test(question) || /kill factors?|failure modes?/i.test(question)) return 'kill_factors';
		return 'general';
	})();

	// BR-08: "Which input matters most?" chip — short-circuit with a structured
	// answer read directly from perFieldImpact on the scoring context. No LLM
	// round trip. Picks the highest-maxPoints unanswered question, falls back
	// to the highest-impact answered question if everything is filled.
	if (intent === 'which_input_matters') {
		const impact = scoringContext?.perFieldImpact;
		if (impact && Object.keys(impact).length > 0) {
			const entries = Object.values(impact);
			const unanswered = entries.filter(e => !e.answered).sort((a, b) => b.maxPoints - a.maxPoints);
			const topUnanswered = unanswered[0];
			const maxUpside = scoringContext?.maxUpside ?? unanswered.reduce((s, e) => s + e.maxPoints, 0);

			if (topUnanswered) {
				const runnersUp = unanswered.slice(1, 3);
				const runnersUpLine = runnersUp.length
					? `\n\nRunner-ups: ${runnersUp.map(r => `${r.question.replace(/[?.]$/, '')} (+${r.maxPoints})`).join(', ')}.`
					: '';
				return {
					message: `Fill **${topUnanswered.question}** next — it's worth roughly +${topUnanswered.maxPoints} points for your concept. ${topUnanswered.rationale}${runnersUpLine}\n\nYou have ${Math.round(maxUpside)} total points of upside left across ${unanswered.length} unanswered ${unanswered.length === 1 ? 'input' : 'inputs'}.`,
					suggestedPrompts: [
						'Take me to that field',
						'Why does that field matter?',
						'Show me all remaining inputs',
					],
				};
			}

			// Everything answered — tell the user they're maxed out.
			const topAnswered = entries.sort((a, b) => b.maxPoints - a.maxPoints)[0];
			return {
				message: `All Vision inputs are filled. Your highest-leverage answer was **${topAnswered.question}** (~${topAnswered.maxPoints} points). The score you see now is the confident read — there are no more Vision levers to pull.`,
				suggestedPrompts: [
					'How do I improve the location itself?',
					'Show me the breakdown',
					'What would kill this location?',
				],
			};
		}

		// Fallback: scoringContext doesn't include perFieldImpact (older client).
		// Tell the user to refresh rather than fabricating an answer.
		return {
			message: `I don't have your per-field impact data on this page yet. Refresh the page and try again — once the Vision tab loads, I can tell you which specific input will move your score the most.`,
			suggestedPrompts: [
				'How do I improve my score?',
				'What would kill this location?',
				'Why is this score what it is?',
			],
		};
	}

	// BR-07: When Vision completeness is below 50% and the user is asking "how do I improve",
	// short-circuit with a Vision-first nudge before burning tokens on the full LLM round trip.
	// Matches the same behavior as handleImproveFit().
	if (intent === 'improve_levers') {
		const _visionPct = typeof scoringContext?.visionCompletionPct === 'number'
			? scoringContext.visionCompletionPct
			: null;
		const _visionFrac = _visionPct != null && _visionPct > 1 ? _visionPct / 100 : (_visionPct ?? null);
		if (_visionFrac != null && _visionFrac < 0.5) {
			const filledApprox = Math.round((_visionFrac || 0) * 12);
			return {
				message: `The fastest 3 points: fill your Hours, Food Program, and Differentiator in the Vision tab. Each is worth about +2 points for your concept. Once you hit 6 of 12 inputs, your score will show as confident instead of preliminary.\n\nYou're currently at ${filledApprox} of 12 Vision inputs — filling three more flips the score from PRELIMINARY to PARTIAL and gives the Brain enough signal to recalibrate this location to your specific business model.`,
				suggestedPrompts: [
					'Take me to the Vision tab',
					'Why do those three fields matter most?',
					'What counts as "confident"?',
				],
			};
		}
	}

	const conceptKnowledge = buildLocationConceptKnowledge(launchpad.businessType);

	// Build an intent-specific instruction block. The base prompt still gets the full
	// context; the intent block just tells the LLM the exact shape the answer must take.
	let intentInstructions = '';
	if (intent === 'improve_levers') {
		// BR-UX-02
		const target = nextTier ? `${nextTier.threshold} (${nextTier.label})` : 'the next tier';
		intentInstructions = `
INTENT: IMPROVE LEVERS (BR-UX-02)
The user wants to know how to climb from ${primaryScore} to ${target}.
Respond with EXACTLY the 3 highest-impact levers from this location's signal payload — no more, no less.
Format each lever as: "• {signal name} is {state} — {action} would add ~{N} points."
Rank by estimated point impact (highest first). Be specific to the sub-scores and kill factors
above, not generic advice. If a lever is already maxed out, skip it and pick the next one.
End with one short sentence on the most important next action.
Do NOT include follow-up question suggestions for this intent.`;
	} else if (intent === 'explain_breakdown') {
		// BR-UX-03
		intentInstructions = `
INTENT: EXPLAIN BREAKDOWN (BR-UX-03)
The user wants a clear breakdown of why this location scored what it scored.
Respond with EXACTLY 3 bullets in this order:
  ✓ Top contributing factor (positive) — cite the sub-score + one data source.
  ✓ Second contributing factor (positive) — cite the sub-score + one data source.
  ✗ Top detractor (negative) — cite the sub-score + one data source.
Each bullet must name the actual sub-score value from SCORE CURRENTLY ON SCREEN above, not a
generic adjective. Example: "✓ Strong foot traffic (+8) — Transit score 78/100 from MTA ridership".
Then close with one sentence in Grade/Tier framing (e.g. "That's why this is a B-grade Viable block").
Do NOT include follow-up question suggestions for this intent.`;
	} else if (intent === 'kill_factors') {
		// BR-UX-04
		intentInstructions = `
INTENT: KILL FACTORS (BR-UX-04)
The user wants to know the top failure modes for this specific concept + location.
Respond with EXACTLY the top 3 kill factors from the scoring engine for this location + concept.
Pull from the "KILL FACTORS" list in the data summary if present. Each kill factor must be:
  ⚠ {signal} is {value} — below the concept threshold of {threshold}. {why this kills this concept}.
If fewer than 3 kill factors exist, say "Only {N} material risks were flagged" and list them.
Never fabricate kill factors — if the engine didn't flag any, say so and suggest the user run the
stress test tab on the Business Case page.
Do NOT include follow-up question suggestions for this intent.`;
	}

	const userMsg = `User's question: "${question}"
${conceptKnowledge}
${liveScoreContext}
ADDITIONAL LOCATION DATA FROM DATABASE:
${dataSummary}

USER PROFILE:
- Business type: ${launchpad.businessType}
- Budget: ${launchpad.budget || 'not specified'}
- Rent tolerance: ${launchpad.rent || 'not specified'}
- Target customer: ${launchpad.targetCustomer || 'not specified'}
- Experience: ${launchpad.experience || 'not specified'}
${intentInstructions}

${intent === 'general'
	? `Answer their question using the scores and data above. Be specific, cite the actual numbers from SCORES ON SCREEN. Frame answers in Grade/Tier language when a GRADE / TIER line is present. If the question is about something not in the data, give general advice noting it's not location-specific.\n\nEnd with 2-3 suggested follow-up questions.`
	: `Follow the INTENT instructions above exactly. Do not deviate from the required format. Do not append follow-up questions for this intent — the UI already shows chips.`}`;

	const result = await callLLM({
		model: 'sonnet',
		system: LOCATION_SYSTEM_PROMPT,
		messages: [{ role: 'user', content: userMsg }],
		maxTokens: 600,
		temperature: intent === 'general' ? 0.5 : 0.35,
	});

	const suggestedPrompts = intent === 'general' ? extractSuggestions(result.content) : [];

	return {
		message: result.content,
		suggestedPrompts: intent === 'general' && suggestedPrompts.length > 0
			? suggestedPrompts
			: intent === 'general'
				? ['Tell me more about the competition here.', 'What are the biggest risks?', 'How does this area compare to alternatives?']
				: undefined,
	};
}

// ── Helpers ──

function extractSuggestions(text: string): string[] {
	const suggestions: string[] = [];
	// Look for numbered questions or questions after "you might ask" / "follow-up"
	const lines = text.split('\n');
	for (const line of lines) {
		const trimmed = line.trim();
		// Match patterns like "1. Why...", "- How...", "• What..."
		const match = trimmed.match(/^[\d\-•\*]\s*\.?\s*(.+\?)\s*$/);
		if (match && match[1].length > 10 && match[1].length < 100) {
			suggestions.push(match[1]);
		}
	}
	return suggestions.slice(0, 3);
}

// ── Handler ──

export const POST: RequestHandler = async ({ request }) => {
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;

	// S3: Rate limit check (in-memory, 10/min)
	const rateLimited = checkRateLimit(auth.userId);
	if (rateLimited) return rateLimited;

	// B2-T7: durable per-user hourly cap (10/hr from ai_calls table) +
	// site-wide monthly $50 budget cap. Stacks on top of the in-memory
	// per-minute limiter above — both must pass.
	try {
		const { checkAiBudget } = await import('$lib/ai/budget-guard');
		const block = await checkAiBudget({ userId: auth.userId });
		if (block) return block;
	} catch { /* budget guard fails open */ }

	try {
		const body = (await request.json()) as LocationCopilotRequest;

		// Validation
		// P0-D FIX: geoid is now optional — we accept scoringContext as a fallback
		// when geoid is unavailable (FCC API timeout for outer-borough addresses)
		if (!body.launchpad?.businessType) {
			return new Response(JSON.stringify({ error: 'Missing launchpad.businessType' }), {
				status: 400, headers: { 'Content-Type': 'application/json' },
			});
		}
		// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
		body.launchpad.businessType = normalizeBusinessType(body.launchpad.businessType);
		if (!['initial_analysis', 'explain_score', 'improve_fit', 'ask_question'].includes(body.action)) {
			return new Response(JSON.stringify({
				error: 'Invalid action. Must be: initial_analysis, explain_score, improve_fit, or ask_question',
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		const startMs = Date.now();
		// P0-D: When geoid is missing, load an empty context — scoringContext fills the gap
		const ctx = body.geoid ? await loadLocationContext(body.geoid) : {
			geoid: '', scores: {}, intel: {}, enriched: {}, vision: {},
		} as LocationContext;
		// COP-01: inject DOF tax snippet if provided (per-address, not in block-group DB)
		if (body.propertyTaxSnippet) ctx.taxSnippet = body.propertyTaxSnippet;
		// IMP-02: inject tenancy churn risk snippet
		if (body.churnRiskSnippet) (ctx as any).churnSnippet = body.churnRiskSnippet;
		// Editorial signal lookup key — must be a neighborhood NAME, not geoid
		if (body.scoringContext?.neighborhood) ctx.neighborhood = body.scoringContext.neighborhood;

		let result: LocationCopilotResponse;

		switch (body.action) {
			case 'initial_analysis':
				result = await handleInitialAnalysis(ctx, body.launchpad);
				break;
			case 'explain_score':
				if (!body.scoreType) {
					return new Response(JSON.stringify({ error: 'Missing scoreType for explain_score action' }), {
						status: 400, headers: { 'Content-Type': 'application/json' },
					});
				}
				result = await handleExplainScore(ctx, body.scoreType, body.launchpad);
				break;
			case 'improve_fit':
				result = await handleImproveFit(ctx, body.launchpad, body.geoid, body.scoringContext);
				break;
			case 'ask_question':
				if (!body.question) {
					return new Response(JSON.stringify({ error: 'Missing question for ask_question action' }), {
						status: 400, headers: { 'Content-Type': 'application/json' },
					});
				}
				result = await handleAskQuestion(ctx, body.question, body.launchpad, body.scoringContext);
				break;
			default:
				result = { message: 'Unknown action' };
		}

		const durationMs = Date.now() - startMs;

		// M2 FIX: Log conversation (fire-and-forget)
		logCopilotConversation(
			auth.userId, 'location', body.geoid || null, body.action,
			{ businessType: body.launchpad.businessType, scoreType: body.scoreType },
			result.message, 'claude-sonnet-4', durationMs
		);

		return new Response(JSON.stringify({
			...result,
			_meta: {
				geoid: body.geoid,
				action: body.action,
				durationMs,
			},
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

	} catch (err) {
		console.error('[LocationCopilot] Error:', err);
		return new Response(JSON.stringify({
			error: 'Location copilot error',
			message: err instanceof Error ? err.message : 'Unknown error',
		}), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
};
