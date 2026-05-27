/**
 * Location IQ API endpoint.
 *
 * GET /api/location-iq?lat=40.7128&lng=-74.0060&type=cafe
 *
 * Returns a full Location IQ score report including:
 * - NIQ (Neighborhood IQ) — demographics, lifecycle, ecosystem, disruption, transit
 * - SIQ (Storefront IQ) — walkability, competitors, building risk, landmarks
 * - TIQ (Taste IQ) — cuisine diversity, quality gap, market gap
 * - LIQ (Labor IQ) — placeholder
 * - Composite Location IQ with letter grade
 * - Human-readable signals
 * - Data completeness metrics
 * - Enhanced intel layers (reconciled entities, extrapolations, narratives)
 *
 * Under the hood, this first fetches all 20 intel sources, runs the 4-layer
 * processing pipeline, then runs the IQ scoring engine on the results.
 */

import type { RequestHandler } from '@sveltejs/kit';
// 04.22.2026 Deprecating: fetchEnhancedLocationIntel, computeLocationIQ, and computeConfidence
// are no longer called directly in the GET handler — all orchestrated internally
// by buildLocationScoreBundle(). See $lib/intel/scoring/bundle-builder.ts.
// computeScoreAgreement and computeDynamicVisionIQ are still used by the POST handler
// and response assembly code, so they remain active.
import {
	// fetchEnhancedLocationIntel,   // 04.22.2026 Deprecating: handled by buildLocationScoreBundle
	// computeLocationIQ,            // 04.22.2026 Deprecating: handled by buildLocationScoreBundle
	// computeConfidence,            // 04.22.2026 Deprecating: handled by buildLocationScoreBundle
	computeScoreAgreement,
	computeDynamicVisionIQ,
} from '$lib/intel';
// 04.22.2026 Deprecating: runIQScore is no longer called directly in the GET handler —
// orchestrated internally by buildLocationScoreBundle().
// import { runIQScore } from '$lib/intel/scoring/iq-score';
// 04.22.2026: Canonical scoring orchestrator — replaces inline pipeline
import { buildLocationScoreBundle } from '$lib/intel/scoring/bundle-builder';
// 04.22.2026 Deprecating: lookupHistoricalContext is no longer called directly —
// geohash computation + Power Broker lookup handled by buildLocationScoreBundle().
// import { lookupHistoricalContext } from '$lib/intel/data-quality-gate';
import type { PrecomputedScores, IndexName } from '$lib/intel/six-index';
import { buildDynamicConfig, computeVisionImpact } from '$lib/intel/dynamic-concept-config';
import { resolveConceptType } from '$lib/intel/six-index';
import { pulseTier, conceptRevenueModel, pulseNarrative } from '$lib/intel/engines/primitives';
import { getConceptScanRadius } from '$lib/location/api/geo';
import { logScoreEvent } from '$lib/intel/score-logger';
import { latLngToGeoid } from '$lib/intel/block-group';
import { detectBorough } from '$lib/constants/geography';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';
import { getServiceSupabase } from '$lib/supabase-server';
// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
import { normalizeBusinessType, BUSINESS_TYPE_CONFIGS } from '$lib/intel/registry/business-type-registry';
import { fitTierLabel, blockTierLabel, fitGrade, fitGradeCappedWithReason } from '$lib/utils/decision-engine';
import { tierFor, CONFIDENCE_ERROR_PENALTY, DIMENSION_SOURCE_KEYWORDS } from '$lib/intel/tiers';
import { getSurvivalRate } from '$lib/intel/survival-rate';
// COFFEE-REWIRE: Old segment-intel functions (extrapolateCoffeeRushTraffic,
// computeDailyRitualDensity, blendCompetitorPricing) are no longer called here.
// Watch Outs now read from sixIndex.coffeeDimRawData — same values the scoring
// engine computed, no duplicate computation.
import { generateCoffeeWatchOuts } from '$lib/intel/segment-intel';
import { getAdaptiveTimeout, classifyDataTier, getLocationQualityTier } from '$lib/utils/tier-timeout';
import type { DataTier, LocationQualityTier } from '$lib/utils/tier-timeout';
import { getStoredCoffeeScore, storeCoffeeScore, buildStoredScore } from '$lib/intel/coffee-score-store';
import { COFFEE_FORMULA_VERSION, SIGNAL_KILL_FLOOR, CONFIDENCE_BANDS } from '$lib/constants/scoring-thresholds';

/**
 * BR-02: Total Vision IQ inputs in the concept questionnaire.
 * Derived via `visionCompleteness = answeredCount / TOTAL_VISION_INPUTS`.
 * Confidence tiers:
 *   - preliminary: < 0.5 completeness (< 6 of 12)
 *   - partial:     >= 0.5 and < 0.85
 *   - confident:   >= 0.85
 */
const TOTAL_VISION_INPUTS = 12;

/**
 * D5: Response-level cache for GET envelope (5-minute TTL).
 *
 * Fixes 504 timeouts on lens re-fetch. The initial score call and the lens
 * auto-fetch (loadLocationIqEnvelope on AddressAnalyzer completion) both hit
 * this endpoint within seconds. Without response caching, the second call
 * re-runs the full 4-layer pipeline (Haiku + Sonnet LLMs, ~6-12s) even though
 * fetchLocationIntel's intel_cache serves layer-1 data instantly.
 *
 * Module-level Map persists across warm serverless invocations. Keyed by
 * normalized coords (4-decimal) + concept + priceLevel so identical requests
 * within the TTL window skip the pipeline entirely.
 */
interface CachedResponse {
	body: string;          // serialized JSON response body
	expiresAt: number;     // epoch ms
}
const RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESPONSE_CACHE_MAX_ENTRIES = 500;      // bound memory in long-running workers
const responseCache = new Map<string, CachedResponse>();

function responseCacheKey(lat: number, lng: number, businessType: string, avgTicket: number, visionTier: string = 'standard'): string {
	// Round coords to 4 decimals (~11m precision) — same addresses map to same key
	return `${lat.toFixed(4)}|${lng.toFixed(4)}|${businessType}|${avgTicket.toFixed(2)}|${visionTier}`;
}

function getCachedResponse(key: string): string | null {
	const entry = responseCache.get(key);
	if (!entry) return null;
	if (entry.expiresAt < Date.now()) {
		responseCache.delete(key);
		return null;
	}
	return entry.body;
}

function setCachedResponse(key: string, body: string): void {
	// Bound cache size — evict oldest when over limit
	if (responseCache.size >= RESPONSE_CACHE_MAX_ENTRIES) {
		const oldestKey = responseCache.keys().next().value;
		if (oldestKey) responseCache.delete(oldestKey);
	}
	responseCache.set(key, { body, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS });
}

/**
 * BR-05: Data source freshness catalog.
 *
 * Each entry maps a field on LocationIntelReport to a user-facing label + category
 * so the UX "Data sources" modal can render a grouped list with freshness chips.
 * The `updateCadence` field tells the UI how often this source typically changes
 * (census = 5yr, DOF = quarterly, Google Places = real-time) which is what lets
 * the tooltip say "last scored 3 hours ago" meaningfully instead of just a number.
 */
const DATA_SOURCE_CATALOG: Array<{
	key: string;
	label: string;
	category: 'demographics' | 'businesses' | 'transit' | 'safety' | 'infrastructure' | 'momentum';
	reportField: string;
	updateCadence: string;
}> = [
	{ key: 'census', label: 'US Census — ACS demographics', category: 'demographics', reportField: 'census', updateCadence: 'Updated yearly' },
	{ key: 'censusHousing', label: 'US Census — housing', category: 'demographics', reportField: 'censusHousing', updateCadence: 'Updated yearly' },
	{ key: 'walkScore', label: 'Walk Score', category: 'transit', reportField: 'walkScore', updateCadence: 'Updated monthly' },
	{ key: 'mtaRidership', label: 'MTA ridership', category: 'transit', reportField: 'mtaRidership', updateCadence: 'Updated monthly' },
	{ key: 'places', label: 'Google Places', category: 'businesses', reportField: 'places', updateCadence: 'Real-time' },
	{ key: 'foursquare', label: 'Foursquare venues', category: 'businesses', reportField: 'foursquare', updateCadence: 'Updated weekly' },
	{ key: 'yelp', label: 'Yelp businesses', category: 'businesses', reportField: 'yelp', updateCadence: 'Updated weekly' },
	{ key: 'competitors', label: 'OpenStreetMap competitors', category: 'businesses', reportField: 'competitors', updateCadence: 'Updated weekly' },
	{ key: 'dcaLicenses', label: 'NYC DCA business licenses', category: 'businesses', reportField: 'dcaLicenses', updateCadence: 'Updated monthly' },
	{ key: 'liquorLicenses', label: 'NY State liquor licenses', category: 'businesses', reportField: 'liquorLicenses', updateCadence: 'Updated monthly' },
	{ key: 'sidewalkCafes', label: 'NYC sidewalk café permits', category: 'businesses', reportField: 'sidewalkCafes', updateCadence: 'Updated monthly' },
	{ key: 'inspections', label: 'NYC health inspections', category: 'businesses', reportField: 'inspections', updateCadence: 'Updated weekly' },
	{ key: 'crime', label: 'NYPD crime statistics', category: 'safety', reportField: 'crime', updateCadence: 'Updated weekly' },
	{ key: 'complaints311', label: 'NYC 311 complaints', category: 'safety', reportField: 'complaints311', updateCadence: 'Real-time' },
	{ key: 'dob', label: 'NYC DOB permits', category: 'infrastructure', reportField: 'dob', updateCadence: 'Updated daily' },
	{ key: 'pluto', label: 'NYC PLUTO property data', category: 'infrastructure', reportField: 'pluto', updateCadence: 'Updated quarterly' },
	{ key: 'lpc', label: 'Landmarks Preservation', category: 'infrastructure', reportField: 'lpc', updateCadence: 'Updated as needed' },
	{ key: 'pedestrian', label: 'NYC pedestrian counts', category: 'momentum', reportField: 'pedestrian', updateCadence: 'Updated yearly' },
	{ key: 'momentum', label: 'Neighborhood momentum', category: 'momentum', reportField: 'momentum', updateCadence: 'Updated weekly' },
	{ key: 'schools', label: 'NYC school locations', category: 'infrastructure', reportField: 'schools', updateCadence: 'Updated yearly' },
	{ key: 'propertyTax', label: 'NYC DOF property tax', category: 'infrastructure', reportField: 'propertyTax', updateCadence: 'Updated quarterly' }
];

function buildDataFreshness(
	report: Record<string, unknown>,
	fetchedAt: string,
	rawErrors: string[]
): {
	lastScoredAt: string;
	ageHours: number;
	ageLabel: string;
	sources: Array<{
		key: string;
		label: string;
		category: string;
		status: 'ok' | 'error' | 'missing';
		fetchedAt: string | null;
		ageHours: number | null;
		updateCadence: string;
		errorMessage?: string;
	}>;
	summary: { ok: number; error: number; missing: number; total: number };
} {
	const now = Date.now();
	const fetchedMs = new Date(fetchedAt).getTime();
	const ageHours = Math.max(0, (now - fetchedMs) / 3_600_000);

	// Pretty age label for the tooltip. "Scored 3 hours ago" / "Scored 2 days ago".
	let ageLabel: string;
	if (ageHours < 1) ageLabel = `Scored ${Math.max(1, Math.round(ageHours * 60))} min ago`;
	else if (ageHours < 24) ageLabel = `Scored ${Math.round(ageHours)} hours ago`;
	else ageLabel = `Scored ${Math.round(ageHours / 24)} days ago`;

	// rawIntelErrors is an array of "[sourceName] message" strings. Build a
	// lookup so we can mark the right sources as errored.
	const errorsByKey = new Map<string, string>();
	for (const err of rawErrors) {
		const match = err.match(/^\[([^\]]+)\]\s*(.*)$/);
		if (match) {
			// Normalize source names — "[census]" → "census", "[dca-licenses]" → "dcaLicenses"
			const rawKey = match[1].toLowerCase().replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase());
			errorsByKey.set(rawKey, match[2] || 'fetch failed');
		}
	}

	const sources = DATA_SOURCE_CATALOG.map(src => {
		const value = report[src.reportField];
		const hasData = value != null && value !== false;
		const errorMessage = errorsByKey.get(src.key);

		let status: 'ok' | 'error' | 'missing';
		if (errorMessage) status = 'error';
		else if (hasData) status = 'ok';
		else status = 'missing';

		return {
			key: src.key,
			label: src.label,
			category: src.category,
			status,
			fetchedAt: hasData ? fetchedAt : null,
			ageHours: hasData ? Math.round(ageHours * 10) / 10 : null,
			updateCadence: src.updateCadence,
			...(errorMessage ? { errorMessage } : {})
		};
	});

	const summary = {
		ok: sources.filter(s => s.status === 'ok').length,
		error: sources.filter(s => s.status === 'error').length,
		missing: sources.filter(s => s.status === 'missing').length,
		total: sources.length
	};

	return { lastScoredAt: fetchedAt, ageHours: Math.round(ageHours * 10) / 10, ageLabel, sources, summary };
}

/**
 * BR-06: LENS-01 — per-dimension slices of the scoring payload.
 *
 * UX-19 replaces the inert Competitors/Transit/Safety tabs with 6 purposeful
 * lenses. Each lens reconfigures the map, the neighborhood snapshot, and the
 * verdict line around one dimension. This builder produces a self-contained
 * slice per lens so the UX doesn't have to stitch data from multiple fields.
 *
 * Canonical 6 lenses (matching UX-19 spec):
 *   1. Competitors  — how dense and differentiated the competition is
 *   2. Transit      — how easy it is to reach this block by foot/transit
 *   3. Safety       — how safe this block is for staff + customers
 *   4. Demographics — who actually lives and works around this block
 *   5. Concept Pulse — how much commercial energy is in the immediate ring
 *   6. Momentum     — whether the neighborhood is rising, steady, or cooling
 *
 * Each lens provides:
 *   - dimension, label, score, tier
 *   - verdictLine — one-sentence read, concept-aware when possible
 *   - topSignals — up to 3 signals bucketed to this dimension
 *   - mapHighlights — POI types the UX should emphasize on the map
 *   - copilotPrompt — pre-canned question the CoPilot hook should fire
 */
const LENS_DIMENSIONS: Array<{
	key: 'competition' | 'transit' | 'safety' | 'demographics' | 'vibrancy' | 'momentum';
	label: string;
	uxLabel: string;
	mapHighlights: string[];
	copilotPrompt: string;
}> = [
	{
		key: 'competition',
		label: 'Competitors',
		uxLabel: 'Competitors',
		mapHighlights: ['competitor', 'similar_business', 'co_tenant'],
		copilotPrompt: 'Who are the 3 biggest competitors here and how do I differentiate?'
	},
	{
		key: 'transit',
		label: 'Transit',
		uxLabel: 'Transit & Access',
		mapHighlights: ['subway', 'bus_stop', 'bike_share', 'walk_node'],
		copilotPrompt: 'How do customers actually get to this location?'
	},
	{
		key: 'safety',
		label: 'Safety',
		uxLabel: 'Safety',
		mapHighlights: ['crime_incident', '311_complaint', 'police_station'],
		copilotPrompt: 'What are the top safety concerns for this block and how do I mitigate them?'
	},
	{
		key: 'demographics',
		label: 'Demographics',
		uxLabel: 'Who lives here',
		mapHighlights: ['census_block', 'residential', 'daytime_population'],
		copilotPrompt: 'Who is the 1-mile population and do they match my target customer?'
	},
	{
		key: 'vibrancy',
		label: 'Concept Pulse',
		uxLabel: 'Concept Pulse',
		mapHighlights: ['foot_traffic', 'sidewalk_cafe', 'nearby_retail', 'pedestrian_count'],
		copilotPrompt: 'How busy is this block for my specific concept?'
	},
	{
		key: 'momentum',
		label: 'Momentum',
		uxLabel: 'Momentum',
		mapHighlights: ['new_permits', 'new_licenses', 'development_projects'],
		copilotPrompt: 'Is this neighborhood rising or cooling? What should I watch for?'
	}
];

interface LensSlice {
	dimension: string;
	label: string;
	uxLabel: string;
	score: number;
	tier: 'Strong' | 'Solid' | 'Average' | 'Weak' | 'Concerning';
	weight: number;
	description: string;
	verdictLine: string;
	topSignals: Array<{ type: 'positive' | 'negative' | 'neutral'; message: string }>;
	mapHighlights: string[];
	copilotPrompt: string;
	dataSources: { available: number; total: number };
}

// EF-4 (April 11): lensTier now delegates to the canonical `tierFor` function
// in $lib/intel/tiers. Before this, the lens payload computed its tier words
// with a local ternary and the snapshot card + narrative engine each had
// their own — which is why GJ saw "STRONG AVERAGE" and "STRONG INFO" labels.
// Every tier word in the codebase now traces back to tierFor().
function lensTier(score: number): LensSlice['tier'] {
	return tierFor(score, 'lens').label as LensSlice['tier'];
}

function buildLenses(
	sixIndex: {
		indices: Record<string, { score: number; weight: number; label: string; description: string; dataSources: number; totalSources: number }>;
		signals: Array<{ index: string; type: 'positive' | 'negative' | 'neutral'; message: string }>;
	},
	businessType: string,
	conceptPulseNarrative: string
): LensSlice[] {
	const conceptNoun = businessType.replace(/_/g, ' ');

	return LENS_DIMENSIONS.map(lens => {
		const idx = sixIndex.indices[lens.key];
		const score = idx?.score ?? 50;
		const tier = lensTier(score);

		// Pull up to 3 signals bucketed to this dimension, preferring one of each
		// type (positive / negative / neutral) so the UX can show a balanced view.
		const dimSignals = sixIndex.signals.filter(s => s.index === lens.key);
		const pos = dimSignals.find(s => s.type === 'positive');
		const neg = dimSignals.find(s => s.type === 'negative');
		const neu = dimSignals.find(s => s.type === 'neutral');
		const topSignals = [pos, neg, neu].filter(Boolean).slice(0, 3) as LensSlice['topSignals'];

		// Concept-aware verdict line. Concept Pulse reuses the prebuilt narrative
		// from BR-09 so the sidebar and the lens stay consistent.
		let verdictLine: string;
		if (lens.key === 'vibrancy') {
			verdictLine = conceptPulseNarrative;
		} else if (tier === 'Strong') {
			verdictLine = `${lens.label} is ${score}/100 — strong for a ${conceptNoun} on this block.`;
		} else if (tier === 'Solid') {
			verdictLine = `${lens.label} is ${score}/100 — solid, won't get in your way.`;
		} else if (tier === 'Average') {
			verdictLine = `${lens.label} is ${score}/100 — average. Neither a lever nor a blocker.`;
		} else if (tier === 'Weak') {
			verdictLine = `${lens.label} is ${score}/100 — weak for a ${conceptNoun}. You'll need to work around it.`;
		} else {
			verdictLine = `${lens.label} is ${score}/100 — concerning. This is a material risk for a ${conceptNoun}.`;
		}

		return {
			dimension: lens.key,
			label: lens.label,
			uxLabel: lens.uxLabel,
			score,
			tier,
			weight: idx?.weight ?? 0,
			description: idx?.description ?? '',
			verdictLine,
			topSignals,
			mapHighlights: lens.mapHighlights,
			copilotPrompt: lens.copilotPrompt,
			dataSources: {
				available: idx?.dataSources ?? 0,
				total: idx?.totalSources ?? 0
			}
		};
	});
}

function deriveScoreConfidence(visionCompleteness: number): {
	scoreConfidence: 'preliminary' | 'partial' | 'confident';
	scoreConfidenceReason: string;
} {
	if (visionCompleteness < CONFIDENCE_BANDS.preliminary) {
		return {
			scoreConfidence: 'preliminary',
			scoreConfidenceReason: `Only ${Math.round(visionCompleteness * TOTAL_VISION_INPUTS)} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score may shift as you add more.`
		};
	}
	if (visionCompleteness < CONFIDENCE_BANDS.partial) {
		return {
			scoreConfidence: 'partial',
			scoreConfidenceReason: `${Math.round(visionCompleteness * TOTAL_VISION_INPUTS)} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score is stabilizing.`
		};
	}
	return {
		scoreConfidence: 'confident',
		scoreConfidenceReason: `${Math.round(visionCompleteness * TOTAL_VISION_INPUTS)} of ${TOTAL_VISION_INPUTS} Vision inputs filled — score is reliable for decision-making.`
	};
}

/** Fetch pre-computed neighborhood scores + Vision IQ + Fit IQ for a geoid */
async function fetchPrecomputedScores(geoid: string, conceptType?: string): Promise<PrecomputedScores & { visionIQ?: number; fitIQ?: number; fitComponents?: Record<string, unknown> }> {
	const scoreTypes = ['six_neighborhood_health', 'six_survival_rate', 'six_commercial_density'];
	if (conceptType) {
		scoreTypes.push(`halo:${conceptType}`);
		scoreTypes.push(`vision_iq:${conceptType}`);
		scoreTypes.push(`fit_score:${conceptType}`);
	}

	const supabaseAdmin = getServiceSupabase();
	const { data, error } = await supabaseAdmin
		.from('block_group_scores')
		.select('score_type, score, components')
		.eq('geoid', geoid)
		.in('score_type', scoreTypes);

	// FIX-008: check .error before using .data — previously silently returned
	// undefined scores when query failed (RLS denial, timeout, bad geoid).
	if (error) {
		console.error('[LocationIQ] fetchPrecomputedScores error:', error.message, `(code: ${error.code})`);
		return {}; // caller treats empty as "no precomputed scores" and falls back to live calc
	}

	const result: PrecomputedScores & { visionIQ?: number; fitIQ?: number; fitComponents?: Record<string, unknown> } = {};
	for (const row of data || []) {
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

export const GET: RequestHandler = async ({ url, request }) => {
	const limited = rateLimit(request, RATE_LIMITS.intel);
	if (limited) return limited;
	const lat = parseFloat(url.searchParams.get('lat') || '');
	const lng = parseFloat(url.searchParams.get('lng') || '');
	const businessType = normalizeBusinessType(url.searchParams.get('type') || 'cafe');
	const address = url.searchParams.get('address') || undefined;
	const useAI = url.searchParams.get('ai') === 'true';
	// ── B1: Price-level mapping ──────────────────────────────────────────
	// UX onboarding stores priceLevel (1-4). Brain needs avgTicket + visionTier.
	// Accept all three params — priceLevel is the fallback when avgTicket/visionTier aren't sent.
	const PRICE_LEVEL_MAP: Record<string, { avgTicket: number; visionTier: import('$lib/intel/six-index').VisionTier }> = {
		'1': { avgTicket: 4.50, visionTier: 'commodity' },
		'2': { avgTicket: 5.50, visionTier: 'standard' },
		'3': { avgTicket: 7.50, visionTier: 'differentiated' },
		'4': { avgTicket: 9.00, visionTier: 'highly_differentiated' },
	};
	const priceLevelParam = url.searchParams.get('priceLevel');
	const priceLevelDefaults = priceLevelParam ? PRICE_LEVEL_MAP[priceLevelParam] : undefined;

	const visionTierParam = url.searchParams.get('visionTier') as import('$lib/intel/six-index').VisionTier | null;
	const visionTier = (visionTierParam && ['commodity', 'standard', 'differentiated', 'highly_differentiated'].includes(visionTierParam))
		? visionTierParam
		: priceLevelDefaults?.visionTier ?? undefined;

	const forceRefresh = url.searchParams.get('refresh') === 'true';

	const avgTicketParam = parseFloat(url.searchParams.get('avgTicket') || '');
	const avgTicket = !isNaN(avgTicketParam) && avgTicketParam > 0
		? avgTicketParam
		: priceLevelDefaults?.avgTicket ?? 5.00;

	if (isNaN(lat) || isNaN(lng)) {
		return new Response(JSON.stringify({
			error: 'Missing or invalid lat/lng parameters',
			usage: '/api/location-iq?lat=40.7128&lng=-74.0060&type=cafe'
		}), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
		return new Response(JSON.stringify({
			error: 'lat must be -90 to 90, lng must be -180 to 180'
		}), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// ── D5: Response cache check — skips full 4-layer pipeline on lens re-fetch ──
	const cacheKey = responseCacheKey(lat, lng, businessType, avgTicket, visionTier ?? 'standard');
	if (!forceRefresh) {
		const cached = getCachedResponse(cacheKey);
		if (cached) {
			console.log(`[LocationIQ] D5 response cache HIT for ${cacheKey}`);
			return new Response(cached, {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'X-RE2-Response-Cache': 'hit',
				}
			});
		}
	}

	// ── ADDENDUM Change B: Stored-score fast path (coffee only) ──────────
	// Before fetching ANY API data, check for a stored coffee score.
	// If found + valid + not force-refreshing → return stored score immediately.
	const isCoffee = businessType === 'specialty_coffee';

	if (isCoffee && !forceRefresh) {
		try {
			const storedScore = await getStoredCoffeeScore(
				{ lat, lng, concept: businessType },
				{ avgTicket, visionTier: visionTier ?? 'standard', concept: businessType }
			);
			if (storedScore) {
				console.log(`[LocationIQ] Serving stored coffee score for (${lat.toFixed(4)}, ${lng.toFixed(4)}): ${storedScore.compositeScore}`);
				return new Response(JSON.stringify({
					lat, lng, businessType,
					storedScore: true,
					formulaVersion: storedScore.formulaVersion,
					scoredAt: storedScore.scoredAt,
					locationIQ: storedScore.compositeScore,
					grade: storedScore.grade,
					verdict: storedScore.verdict,
					coffeeDimensions: {
						morningFootTraffic: storedScore.dimensionScores.footTraffic,
						dailyRitualDensity: storedScore.dimensionScores.ritualDensity,
						competitionContext: storedScore.dimensionScores.competition,
						streetSide: storedScore.dimensionScores.streetSide,
						demographicsFit: storedScore.dimensionScores.demographics,
						baseViability: storedScore.dimensionScores.viability,
						visionMultiplier: storedScore.visionMultiplier,
						rawComposite: Math.round(storedScore.compositeScore / storedScore.visionMultiplier),
					},
					coffeeWatchOuts: storedScore.watchOuts,
					confidenceLevel: storedScore.confidenceLevel,
					inputSnapshot: storedScore.inputSnapshot,
				}), {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'public, max-age=3600',
						'X-RE2-Stored-Score': 'true',
					}
				});
			}
		} catch {
			// Fast-path lookup failed — fall through to fresh computation
		}
	}

	try {
		const startTime = Date.now();

		// ── 04.22.2026 Deprecating: Steps 0-5 inline scoring pipeline ──────
		// The following block (geoid lookup, precomputed scores fetch, survival
		// rate overlay, fetchEnhancedLocationIntel, geohash + Power Broker lookup,
		// computeLocationIQ, computeConfidence, and runIQScore) has been replaced
		// by a single call to buildLocationScoreBundle().
		// See $lib/intel/scoring/bundle-builder.ts for the canonical pipeline.
		//
		// F-09: Tier-aware timeout is still managed at the endpoint level.
		// We do an early geoid + precomputed lookup to determine the timeout tier,
		// then wrap the bundle call with the adaptive timeout.

		// Step 0: Early geoid + score lookup for timeout tier determination
		const earlyGeoid = await latLngToGeoid(lat, lng);
		let dataTier: DataTier = 'cold';
		let locationQuality: LocationQualityTier = 'unknown';

		if (earlyGeoid) {
			const earlyPrecomputed = await fetchPrecomputedScores(earlyGeoid, businessType);
			const existingScore = earlyPrecomputed.fitIQ ?? earlyPrecomputed.neighborhoodHealth ?? null;
			locationQuality = getLocationQualityTier(existingScore);
			dataTier = forceRefresh ? 'cold' : classifyDataTier(existingScore != null, existingScore != null ? 3600 * 1000 : null);
		}

		const timeoutMs = getAdaptiveTimeout(8000, dataTier, locationQuality);
		console.log(`[LocationIQ] F-09 timeout: ${timeoutMs}ms (data=${dataTier}, quality=${locationQuality}, geoid=${earlyGeoid ?? 'none'})`);

		// Step 1-5: Full scoring pipeline via canonical bundle builder — with timeout
		let timeoutId: NodeJS.Timeout;
		const abortController = new AbortController();
		const timeoutPromise = new Promise<never>((_, reject) =>
			timeoutId = setTimeout(() => {
				abortController.abort();
				reject(new Error(`F-09: Location intel timed out after ${timeoutMs}ms (tier: ${dataTier}/${locationQuality})`));
			}, timeoutMs)
		);
		const bundle = await Promise.race([
			buildLocationScoreBundle({
				lat,
				lng,
				businessType,
				address,
				visionTier,
				avgTicket,
				useAI,
				signal: abortController.signal,
			}),
			timeoutPromise,
		]).finally(() => clearTimeout(timeoutId));

		// Destructure bundle into local variables for response assembly
		const { report, geoid, precomputed, iq, confidence, sixIndex } = bundle;

		// Step 5a: COFFEE-REWIRE — generate watch-outs for coffee concepts
		// Now reads from sixIndex.coffeeDimRawData instead of re-calling old
		// segment-intel functions. The dim raw data was computed by the coffee
		// recalibration engine (dims 1–3) during scoring — same math, no duplication.
		const normalizedConcept = businessType;
		let coffeeWatchOuts: ReturnType<typeof generateCoffeeWatchOuts> | undefined;
		if (normalizedConcept === 'specialty_coffee') {
			const dimRaw = sixIndex.coffeeDimRawData;
			const streetSide = (report as any).streetSide;

			// ── Map dim raw data to watch-out parameters ──
			// morningRushRaw: dim1 computed this during scoring (was: extrapolateCoffeeRushTraffic)
			const morningRushRaw = dimRaw?.morningRaw ?? 0;

			// ritualDensity adapter: map dim2 raw data to the shape generateCoffeeWatchOuts expects
			// (was: computeDailyRitualDensity from segment-intel)
			const ritualData = dimRaw ? {
				score: dimRaw.ritualScore,
				estimatedDailyRitualPop: dimRaw.estimatedDailyRitualPop,
				breakdown: dimRaw.ritualBreakdown,
			} : null;

			// compBlend adapter: map dim3 raw data to the shape generateCoffeeWatchOuts expects
			// (was: blendCompetitorPricing from segment-intel)
			const compData = dimRaw ? {
				tierCount: dimRaw.tierCompetitorCount,
				avgRating: dimRaw.tierAvgRating,
			} : null;

			// Compute residential % from dim2 ritual breakdown
			let residentialPct = 0;
			if (ritualData && ritualData.estimatedDailyRitualPop > 0) {
				const resBd = ritualData.breakdown.find(b => b.type === 'Residents');
				residentialPct = resBd ? 15 : 0;
			}

			// Count colleges from Google Places (unchanged — not a dim concern)
			let collegeCount = 0;
			if (report.places?.places) {
				for (const p of report.places.places) {
					const types = ((p as any).types || []).join(',').toLowerCase();
					if (types.includes('university') || types.includes('college')) collegeCount++;
				}
			}

			coffeeWatchOuts = generateCoffeeWatchOuts({
				morningRushRaw,
				ritualDensity: ritualData as any,  // adapter matches the fields WatchOuts actually reads
				compBlend: compData as any,        // adapter matches the fields WatchOuts actually reads
				streetSideScore: streetSide?.streetSideScore ?? 50,
				hostilityPenalty: streetSide?.hostilityPenalty ?? 0,
				daytimePopRatio: report.census?.daytimePopulationRatio ?? 1.0,
				medianIncome: report.census?.medianHouseholdIncome ?? 75000,
				avgTicket,
				collegeCount,
				residentialPct,
			});
		}

		// Step 5b: Compute sub-score agreement (Stats Guru Review fix #7)
		// Low CV = sub-scores agree = composite is reliable; High CV = signals contradict
		const subScores: Record<string, number> = {};
		for (const [name, idx] of Object.entries(sixIndex.indices)) {
			subScores[name] = idx.score;
		}
		confidence.scoreAgreement = computeScoreAgreement(subScores);

		// Step 6: Log score event (fire-and-forget — never blocks response)
		const computationTimeMs = Date.now() - startTime;
		logScoreEvent(report, iq, confidence, computationTimeMs, {
			geoid:    geoid ?? undefined,
			fitIQ:    precomputed.fitIQ    ?? null,
			visionIQ: precomputed.visionIQ ?? null,
			composite: sixIndex.locationIQ,
			borough:  detectBorough(lat, lng)?.name ?? null,
		}).catch(() => {});

		// ── ADDENDUM Change A: Store coffee score for persistence ──────────
		// Fire-and-forget — never blocks response. Runs after logScoreEvent
		// so the score_events row exists for the update.
		if (isCoffee && sixIndex.coffeeDimensions) {
			// Compute verdict early for storage (same logic as DELTA-01 below)
			const earlyVerdict = (precomputed.fitIQ != null)
				? fitTierLabel(precomputed.fitIQ)
				: fitTierLabel(sixIndex.locationIQ);
			const storedScore = buildStoredScore(
				sixIndex.locationIQ,
				sixIndex.coffeeDimensions,
				coffeeWatchOuts ?? [],
				confidence.level || 'PRELIMINARY',
				sixIndex.grade,
				earlyVerdict,
				avgTicket,
				visionTier ?? 'standard',
				businessType
			);
			storeCoffeeScore(
				{ lat, lng, concept: businessType },
				storedScore
			).catch(() => {});
		}

		// Three-score architecture: Location IQ (from sixIndex), Vision IQ, Fit IQ
		const threeScores = {
			locationIQ: {
				score: sixIndex.locationIQ,
				grade: sixIndex.grade,
				conceptType: sixIndex.conceptType,
				conceptLabel: sixIndex.conceptLabel,
			},
			visionIQ: {
				score: precomputed.visionIQ ?? null,
				available: precomputed.visionIQ != null,
			},
			fitIQ: {
				score: precomputed.fitIQ ?? null,
				available: precomputed.fitIQ != null,
				components: precomputed.fitComponents ?? null,
			}
		};

		// FIX-011: Data source quality transparency layer.
		// UX renders [est.] / [approx.] badges based on this field.
		// FIX-017: When competitor source is synthetic (market-density backfill),
		// expose count-only summary. UI must never display synthetic names as real businesses.
		const competitorAmenities = report.competitors?.amenities;
		const syntheticBuckets: Array<{ type: string; count: number; radiusFt: number }> = [];
		let hasVerifiedCompetitors = false;
		let hasSyntheticCompetitors = false;

		if (competitorAmenities) {
			for (const [bucketKey, pois] of Object.entries(competitorAmenities) as [string, Array<{ tags?: { source?: string } }>][]) {
				if (!pois?.length) continue;
				const allSynthetic = pois.every(p => p.tags?.source === 'market-density');
				const anyVerified = pois.some(p => p.tags?.source === 'google-places' || p.tags?.source === 'foursquare' || p.tags?.source === 'yelp');
				if (allSynthetic) {
					hasSyntheticCompetitors = true;
					const typeMap: Record<string, string> = { cafes: 'cafe', restaurants: 'restaurant', gyms: 'gym', yoga: 'yoga', health: 'health' };
					syntheticBuckets.push({ type: typeMap[bucketKey] || bucketKey, count: pois.length, radiusFt: 400 });
				}
				if (anyVerified) hasVerifiedCompetitors = true;
			}
		}

		const competitorDataQuality = hasSyntheticCompetitors && !hasVerifiedCompetitors
			? 'synthetic'
			: hasSyntheticCompetitors
				? 'estimated'
				: report.competitors ? 'verified' : 'synthetic';

		const dataSourceQuality = {
			competitors: competitorDataQuality,
			syntheticCompetitors: syntheticBuckets.length > 0 ? syntheticBuckets : undefined,
		};

		// ── PHASE 2: CENTRAL COMPETITOR AGGREGATION ──
		// 04.21.2026: Official unified competitor array sourced purely from the backend.
		const allComps: Array<{ name: string; lat: number; lng: number; dist?: number; type?: string }> = [];
		const seenNames = new Set<string>();

		const addC = (name: string, lat: number, lng: number, dist?: number, type?: string) => {
			const n = name.toLowerCase().trim();
			if (!n || seenNames.has(n)) return;
			seenNames.add(n);
			allComps.push({ name, lat, lng, dist, type });
		};

		// Source 1: OpenStreetMap (Overpass)
		if (report.competitors?.amenities) {
			for (const [ptype, pois] of Object.entries(report.competitors.amenities)) {
				for (const p of pois) {
					if (p.lat && p.lon) addC(p.name || 'Nearby Business', p.lat, p.lon, p.distance, ptype);
				}
			}
		}

		// Source 2: Foursquare
		const fsData = report.foursquare as { places?: any[] } | undefined;
		if (fsData?.places) {
			for (const p of fsData.places) {
				if (p.geocodes?.main) addC(p.name || 'Competitor', p.geocodes.main.latitude, p.geocodes.main.longitude, p.distance, 'Competitor');
			}
		}

		// Source 3: Google Places
		const placesData = report.places as { places?: any[] } | undefined;
		if (placesData?.places) {
			for (const p of placesData.places) {
				if (p.lat && p.lng) addC(p.name || 'Nearby Business', p.lat, p.lng, p.distance, 'Competitor');
			}
		}

		// Source 4: Yelp
		const yelpData = report.yelp as { directCompetitors?: any[] } | undefined;
		if (yelpData?.directCompetitors) {
			for (const c of yelpData.directCompetitors) {
				if (c.lat && c.lng) addC(c.name || 'Competitor', c.lat, c.lng, c.distance, c.primaryCategory || 'Competitor');
			}
		}

		// Use registry to determine saturation status definitively from backend source of truth
		const config = BUSINESS_TYPE_CONFIGS[businessType] || BUSINESS_TYPE_CONFIGS['specialty_coffee'];
		const saturationStatus = allComps.length > (config.saturationThreshold || 8) ? 'Saturated' : 'Optimal';

		// Bundle into one cohesive object for UI consumption
		const officialCompetitorsInfo = {
			items: allComps,
			count: allComps.length,
			saturationStatus
		};

		// FIX-022: isPartialSeed — true when block group has sparse entity coverage.
		// Threshold: < 10 reconciled POIs. UX shows nudge card instead of survival grid.
		const PARTIAL_SEED_THRESHOLD = 10;
		const isPartialSeed = (report.reconciled.poiCount ?? 0) < PARTIAL_SEED_THRESHOLD;

		// DELTA-01: Canonical verdict string from decision engine — UX must read this, never compute it.
		// DELTA-02: Canonical block label from BR-5 spec — UX must read this, never compute it.
		const locationIQScore = sixIndex.locationIQ;
		const fitIQScore = precomputed.fitIQ ?? null;
		const rawVerdict = fitIQScore != null ? fitTierLabel(fitIQScore) : fitTierLabel(locationIQScore);
		const blockLabel = blockTierLabel(locationIQScore) || 'Developing Block';

		// B3-1.5: Grade cap for critical safety/survival risk. Prevents founders
		// from over-trusting an "A / Strong Path" when safety or survival is red.
		const safetyForCap = sixIndex.indices?.safety?.score;
		const survivalForCap = precomputed.survivalRate ?? sixIndex.indices?.survivalRate?.score;
		const capScoreForGrade = fitIQScore ?? locationIQScore;
		const gradeCapResult = fitGradeCappedWithReason(capScoreForGrade, {
			safety: safetyForCap,
			survivalRatePct: survivalForCap,
		});
		const cappedGrade = gradeCapResult.grade;
		const gradeCapReason = gradeCapResult.capReason;
		// Prefer capped verdict when the cap fired; else fall back to raw tier label.
		const verdict = gradeCapReason ? gradeCapResult.verdict : rawVerdict;

// B3-2.5: Kill-factor payload — each dimension scoring below the KILL
		// threshold (40) is surfaced so UX can render the "Fit IQ capped at 49"
		// banner with specific triggered factors.
		const KILL_THRESHOLD = SIGNAL_KILL_FLOOR; // canonical: 40, from scoring-thresholds.ts
		const killFactors: Array<{ name: string; reason: string; threshold: number; actual: number }> = [];
		if (sixIndex.indices) {
			const dimLabels: Record<string, string> = {
				transit: 'Transit & walkability',
				demographics: 'Demographics',
				competition: 'Competition density',
				vibrancy: 'Vibrancy',
				safety: 'Safety',
				momentum: 'Neighborhood momentum',
				neighborhoodHealth: 'Neighborhood health',
				survivalRate: '1-year survival rate',
			};
			for (const [dim, v] of Object.entries(sixIndex.indices)) {
				const score = (v as { score?: number })?.score;
				if (typeof score === 'number' && score > 0 && score < KILL_THRESHOLD) {
					killFactors.push({
						name: dim,
						reason: `${dimLabels[dim] || dim} scored ${score} — below kill threshold (${KILL_THRESHOLD}). This concept likely can't survive here without a major differentiator.`,
						threshold: KILL_THRESHOLD,
						actual: score,
					});
				}
			}
		}
		// BR-09: Concept Pulse envelope — single source of truth for the Pulse card.
		// UX reads score + tier + narrative + verdict from here, never computes them.
		const pulseScore = sixIndex.indices.vibrancy?.score ?? 50;
		const pulseTierLabel = pulseTier(pulseScore);
		const pulseModel = conceptRevenueModel(businessType);
		const pulseConceptRadius = getConceptScanRadius(businessType);
		const conceptPulse = {
			score: pulseScore,
			tier: pulseTierLabel,
			model: pulseModel,
			conceptRadiusM: pulseConceptRadius,
			narrative: pulseNarrative(pulseTierLabel, pulseModel, pulseConceptRadius),
			// Compact verdict string for sidebar chips. "Buzzing for a cafe." style.
			verdict: `${pulseTierLabel} for a ${businessType.replace(/_/g, ' ')}.`
		};

		// BR-02: Score confidence — GET handler has no Vision answers yet, so confidence
		// defaults to 'preliminary'. POST handler (with conceptAnswers) overrides this.
		const visionCompleteness = 0;
		const { scoreConfidence, scoreConfidenceReason } = deriveScoreConfidence(visionCompleteness);

		// BR-05: Data source freshness envelope — powers UX-22 re-score tooltip and
		// UX-23 data sources modal. Orchestrator-level timestamps: every source
		// that returned data is stamped with report.fetchedAt, errored sources
		// are marked 'error' with the message from rawIntelErrors, and missing
		// sources are marked 'missing'.
		const dataFreshness = buildDataFreshness(
			report as unknown as Record<string, unknown>,
			report.fetchedAt,
			report.errors || []
		);

		// BR-06: LENS-01 payload slices — 6 dimensions, each self-contained with
		// verdict, top signals, map highlights, and a canned CoPilot prompt.
		// UX-19 replaces the inert sidebar tabs with these lenses.
		const lenses = buildLenses(
			{ indices: sixIndex.indices as unknown as Record<string, { score: number; weight: number; label: string; description: string; dataSources: number; totalSources: number }>, signals: sixIndex.signals },
			businessType,
			conceptPulse.narrative
		);

		// §1b Root Cause 6 — Confidence contract (April 11).
		// Per-dimension reliability dial, 0-100. UX renders differently at
		// >=80 (full), >=60 (partial + tooltip), <60 (skeleton pill).
		// Computation: raw coverage ratio (dataSources/totalSources), then
		// penalize if the orchestrator logged an error for any source tied
		// to that dimension. Vision confidence tracks visionCompleteness
		// for GET (always 0 — no concept answers yet); POST overrides.
		//
		// Constants (CONFIDENCE_ERROR_PENALTY, DIMENSION_SOURCE_KEYWORDS)
		// live in $lib/intel/tiers as the canonical confidence contract.
		// Add new data sources there, not here.
		const errorKeys = new Set((report.errors || []).map(e => (e as { key?: string }).key || ''));
		function dimConfidence(dimKey: string): number {
			const idx = (sixIndex.indices as Record<string, { dataSources: number; totalSources: number }>)[dimKey];
			if (!idx || !idx.totalSources) return 0;
			const coverageRatio = Math.max(0, Math.min(1, idx.dataSources / idx.totalSources));
			let score = Math.round(coverageRatio * 100);
			// Error penalty: each logged error for a source tied to this dimension drops confidence
			const dimKeywords = DIMENSION_SOURCE_KEYWORDS[dimKey] || [dimKey];
			for (const ek of errorKeys) {
				if (!ek) continue;
				const lower = ek.toLowerCase();
				if (dimKeywords.some(k => lower.includes(k))) {
					score = Math.max(0, score - CONFIDENCE_ERROR_PENALTY);
				}
			}
			return score;
		}
		// THR-01: Apply MTA dataQuality confidence penalty to transit dimension.
		// dataQualityConfidencePenalty is 0 for real data, 25 for estimated, 12 for mixed.
		// Subtracted AFTER dimConfidence() so the coverage-ratio base is unaffected.
		const mtaDataQualityPenalty = report.mtaRidership?.dataQualityConfidencePenalty ?? 0;

		const confidenceBySource = {
			transit: Math.max(0, dimConfidence('transit') - mtaDataQualityPenalty),
			safety: dimConfidence('safety'),
			demographics: dimConfidence('demographics'),
			competition: dimConfidence('competition'),
			vibrancy: dimConfidence('vibrancy'),
			momentum: dimConfidence('momentum'),
			// GET has no concept answers yet, so vision confidence is 0.
			// POST returns visionCompleteness (0-1); UX multiplies by 100 and
			// overrides this field on the stored confidenceBySource map.
			vision: 0,
		};

		const responseBody = JSON.stringify({
			lat,
			lng,
			businessType,
			...iq,
			confidence,
			sixIndex,
			threeScores,
			verdict,
// B3-1.5: Capped letter grade + reason. UX renders below the grade badge
			// when gradeCapReason is non-null so founders see WHY an otherwise-strong
			// score was downgraded (safety or survival risk).
			gradeCapped: cappedGrade,
			gradeCapReason,
			// B3-2.5: Kill-factor array for UX banner rendering.
			killFactors,
			blockLabel,
			conceptPulse,
			scoreConfidence,
			scoreConfidenceReason,
			visionCompleteness,
			totalVisionInputs: TOTAL_VISION_INPUTS,
			dataFreshness,
			lenses,
			confidenceBySource,
			dataSourceQuality,
			officialCompetitorsInfo,
			isPartialSeed,
			// Layer 2-4 enhanced data
			reconciled: {
				totalEntities: report.reconciled.totalEntities,
				poiCount: report.reconciled.poiCount,
				transitNodes: report.reconciled.transitNodes,
				demandGenerators: report.reconciled.demandGenerators,
				conflictsResolved: report.reconciled.conflictsResolved,
				avgConfidence: report.reconciled.avgConfidence,
			},
			extrapolations: report.extrapolated.extrapolations,
			narratives: report.narratives,
			pipeline: report.pipeline,
			rawIntelErrors: report.errors,
			fetchedAt: report.fetchedAt,
			// COFFEE-REWIRE: 6-dimension breakdown + watch-outs (only for coffee concepts)
			...(sixIndex.coffeeDimensions ? { coffeeDimensions: sixIndex.coffeeDimensions } : {}),
			...(coffeeWatchOuts && coffeeWatchOuts.length > 0 ? { coffeeWatchOuts } : {}),
			// ADDENDUM: Persistence metadata — UX caches this to localStorage
			...(isCoffee ? { formulaVersion: COFFEE_FORMULA_VERSION, scoredAt: new Date().toISOString(), storedScore: false } : {}),
			// F-09: Timeout metadata — UX can use for transparency / debugging
			_timeout: {
				ceilingMs: timeoutMs,
				dataTier,
				locationQuality,
				actualMs: Date.now() - startTime,
			},
		});

		// D5: Cache the response for 5 minutes — lens re-fetch will hit this cache
		// instead of re-running the Haiku + Sonnet pipeline
		setCachedResponse(cacheKey, responseBody);

		return new Response(responseBody, {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=3600',
				'Access-Control-Allow-Origin': '*',
				'X-RE2-Response-Cache': 'miss',
			}
		});
	} catch (e: unknown) {
		// F-09: Distinguish timeout from other errors — 504 for timeout, 500 for rest
		const isTimeout = e instanceof Error && e.message.startsWith('F-09:');
		const status = isTimeout ? 504 : 500;
		const errorLabel = isTimeout ? 'Location intel request timed out' : 'Internal error computing Location IQ';
		console.error(`[LocationIQ] ${isTimeout ? 'TIMEOUT' : 'ERROR'}:`, e instanceof Error ? e.message : e);
		return new Response(JSON.stringify({
			error: errorLabel,
			message: e instanceof Error ? e.message : 'Unknown error',
			...(isTimeout ? { retryable: true, hint: 'Try again — cached data may speed up the next request' } : {}),
		}), {
			status,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

/**
 * POST /api/location-iq
 *
 * Accepts concept-specific questionnaire answers and returns a dynamically
 * computed Vision IQ that reflects the user's specific business model.
 *
 * This is a LIGHTWEIGHT endpoint — it does NOT re-fetch all 20 intel sources.
 * It takes the existing sixIndex scores already computed during the GET call
 * (which the client should pass back) and recomputes Vision IQ with new weights.
 *
 * Body: {
 *   lat: number,
 *   lng: number,
 *   businessType: string,
 *   conceptAnswers: Record<string, string>,   // e.g. { coffee_price: "premium", coffee_format: "cafe" }
 *   indexScores?: Record<IndexName, number>   // optional: pass sixIndex scores to avoid DB re-fetch
 * }
 *
 * Returns: {
 *   visionIQ: { score, grade, weights, components, archetype, isDynamic: true },
 *   fitIQ: { score, grade }   // recomputed if locationIQ score provided
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
	const limited = rateLimit(request, RATE_LIMITS.intel);
	if (limited) return limited;

	let body: {
		lat?: number;
		lng?: number;
		businessType?: string;
		conceptAnswers?: Record<string, string>;
		indexScores?: Record<IndexName, number>;
		locationIQScore?: number;
	};

	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400, headers: { 'Content-Type': 'application/json' }
		});
	}

	const { lat, lng, businessType = 'cafe', conceptAnswers, indexScores, locationIQScore } = body;

	if (!conceptAnswers || Object.keys(conceptAnswers).length === 0) {
		return new Response(JSON.stringify({ error: 'conceptAnswers is required' }), {
			status: 400, headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		// F-09: POST handler timeout — DB reads + computation only, shorter baseline.
		const postTimeoutMs = getAdaptiveTimeout(5000, 'warm');
		console.log(`[LocationIQ POST] F-09 timeout ceiling: ${postTimeoutMs}ms`);

		// Resolve concept type from business type string
		const conceptType = resolveConceptType(businessType);

		// Build dynamic config from user's answers
		const dynamicConfig = buildDynamicConfig(conceptType, conceptAnswers);

		// If indexScores were not passed, fetch from DB via lat/lng
		let scores: Record<IndexName, number>;
		// FIX-002: hoist precomputed so fitIQ is accessible after the if/else block
		let precomputed: Awaited<ReturnType<typeof fetchPrecomputedScores>> | undefined;

		if (indexScores) {
			scores = indexScores;
		} else if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
			// Need to fetch precomputed dimension scores from DB
			const geoid = await latLngToGeoid(lat, lng);
			if (!geoid) {
				return new Response(JSON.stringify({ error: 'Could not resolve block group for coordinates' }), {
					status: 400, headers: { 'Content-Type': 'application/json' }
				});
			}
			precomputed = await fetchPrecomputedScores(geoid, businessType);

			// SURV-WIRE: Live survival rate for POST handler (Vision IQ recompute).
			const borough = detectBorough(lat, lng)?.name ?? 'Manhattan';
			const survResult = await getSurvivalRate(geoid, businessType, borough).catch(() => null);
			if (precomputed && survResult) {
				precomputed.survivalRate = survResult.rate;
			}

			// Construct dimension scores from precomputed data + defaults
			scores = {
				transit: 50, demographics: 50, competition: 50, vibrancy: 50,
				safety: 50, momentum: 50,
				neighborhoodHealth: precomputed.neighborhoodHealth ?? 60,
				survivalRate: precomputed.survivalRate ?? 55,
			};
		} else {
			return new Response(JSON.stringify({ error: 'Either indexScores or lat/lng is required' }), {
				status: 400, headers: { 'Content-Type': 'application/json' }
			});
		}

		// Compute dynamic Vision IQ
		const dynamicVisionIQ = computeDynamicVisionIQ(scores, dynamicConfig);

		// FIX-002: Prefer batch-calibrated Fit IQ from block_group_scores when available.
		// The batch scorer (d=0.601) is more accurate than the live 60/40 blend.
		// Fall back to live blend only when no batch score exists for this concept+geoid.
		const locScore = locationIQScore ?? 50;
		let fitScore: number;
		let fitSource: 'batch' | 'live';

		if (precomputed?.fitIQ != null && precomputed.fitIQ > 0) {
			fitScore = Math.round(precomputed.fitIQ);
			fitSource = 'batch';
			console.log(`[LocationIQ] FitIQ from batch scores: ${fitScore} (concept: ${conceptType})`);
		} else {
			fitScore = Math.round(locScore * 0.60 + dynamicVisionIQ.score * 0.40);
			fitSource = 'live';
			console.log(`[LocationIQ] FitIQ from live blend: ${fitScore} (no batch score for ${conceptType})`);
		}

		// BR-02: Derive score confidence from Vision completeness.
		const answersUsed = Object.keys(conceptAnswers).length;
		const visionCompleteness = Math.min(1, answersUsed / TOTAL_VISION_INPUTS);
		const { scoreConfidence, scoreConfidenceReason } = deriveScoreConfidence(visionCompleteness);

		// BR-01 + BR-03: remaining upside + per-field impact map.
		// Replaces the UX-05 hand-tuned Math.max(3, Math.min(12, remaining)) fallback
		// and the UX-12 hand-tuned per-field constants (Hours +2, Avg Check +2, etc.).
		const visionImpact = computeVisionImpact(conceptType, conceptAnswers);

		// §1b follow-up (April 11): POST handler vision confidence override.
		// GET ships `confidenceBySource.vision = 0` because it has no concept
		// answers. POST now returns a `confidenceBySource` PARTIAL containing
		// the normalized vision confidence so UX can spread-merge with one
		// line: `scoreData.confidenceBySource = { ...prev, ...response.confidenceBySource }`.
		// The server does the 0-1 → 0-100 normalization so UX doesn't drift.
		const visionConfidence = Math.round(Math.max(0, Math.min(1, visionCompleteness)) * 100);

		return new Response(JSON.stringify({
			visionIQ: {
				...dynamicVisionIQ,
				isDynamic: true,
				conceptType,
				answersUsed,
			},
			fitIQ: (() => {
				// B3-1.5: Apply grade cap using safety + survival in POST handler too.
				const postCap = fitGradeCappedWithReason(fitScore, {
					safety: scores.safety,
					survivalRatePct: precomputed?.survivalRate ?? scores.survivalRate,
				});
				return {
					score: fitScore,
					// BR-1 canonical grade from decision-engine (A/B/C/D/F).
					// Previous drifted thresholds (87/73/60/47) are removed.
					grade: postCap.grade,
					gradeCapReason: postCap.capReason,
					isDynamic: fitSource === 'live',
					source: fitSource,
					locationIQWeight: fitSource === 'live' ? 0.60 : undefined,
					visionIQWeight: fitSource === 'live' ? 0.40 : undefined,
				};
			})(),
// B3-2.5: Kill-factor payload — scores that are below the kill threshold.
			// POST handler scans the `scores` object (constructed for dynamic VIQ).
			killFactors: (() => {
				const KILL_THRESHOLD = SIGNAL_KILL_FLOOR; // canonical: 40, from scoring-thresholds.ts
				const dimLabels: Record<string, string> = {
					transit: 'Transit & walkability',
					demographics: 'Demographics',
					competition: 'Competition density',
					vibrancy: 'Vibrancy',
					safety: 'Safety',
					momentum: 'Neighborhood momentum',
					neighborhoodHealth: 'Neighborhood health',
					survivalRate: '1-year survival rate',
				};
				const killed: Array<{ name: string; reason: string; threshold: number; actual: number }> = [];
				for (const [dim, score] of Object.entries(scores)) {
					if (typeof score === 'number' && score > 0 && score < KILL_THRESHOLD) {
						killed.push({
							name: dim,
							reason: `${dimLabels[dim] || dim} scored ${score} — below kill threshold (${KILL_THRESHOLD}).`,
							threshold: KILL_THRESHOLD,
							actual: score,
						});
					}
				}
				return killed;
			})(),
			// BR-02: confidence envelope — UX reads these to render PRELIM / PARTIAL / CONFIDENT stamps.
			scoreConfidence,
			scoreConfidenceReason,
			visionCompleteness,
			// §1b: partial confidenceBySource — UX spread-merges into its stored map.
			confidenceBySource: {
				vision: visionConfidence,
			},
			totalVisionInputs: TOTAL_VISION_INPUTS,
			// BR-01 + BR-03: upside + per-field impact — UX reads these instead of hand-tuned constants.
			maxUpside: visionImpact.maxUpside,
			perFieldImpact: visionImpact.perFieldImpact,
			visionImpactSummary: {
				totalQuestions: visionImpact.totalQuestions,
				answeredCount: visionImpact.answeredCount,
				unansweredCount: visionImpact.unansweredCount,
			},
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
		});

	} catch (e: unknown) {
		console.error('[LocationIQ POST] Error computing dynamic Vision IQ:', e);
		return new Response(JSON.stringify({
			error: 'Internal error computing dynamic Vision IQ',
			message: e instanceof Error ? e.message : 'Unknown error'
		}), {
			status: 500, headers: { 'Content-Type': 'application/json' }
		});
	}
};
