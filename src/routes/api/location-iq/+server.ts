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
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
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

	let data: any[] = [];
	try {
		const placeholders = scoreTypes.map(s => sql`${s}`);
		const query = sql`SELECT score_type, score, components FROM block_group_scores WHERE geoid = ${geoid} AND score_type IN (${sql.join(placeholders, sql`, `)})`;
		const res = await db.execute(query);
		data = res.rows;
	} catch (error: any) {
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
	const lat = parseFloat(url.searchParams.get('lat') || '');
	const lng = parseFloat(url.searchParams.get('lng') || '');
	const businessType = url.searchParams.get('type') || 'specialty_coffee';
	const debugMode = url.searchParams.get('debug') === 'true';

	if (isNaN(lat) || isNaN(lng)) {
		return new Response(JSON.stringify({ error: 'Missing or invalid lat/lng parameters' }), { status: 400 });
	}

	// ── V2: Try Python FastAPI backend first, fallback to getGoldenRecord ──
	let servingMode: 'python_api' | 'fallback_golden_record' = 'python_api';
	let pythonApiDebug: Record<string, unknown> | null = null;
	let fallbackReason: string | null = null;
	let pythonApiLatencyMs: number | null = null;

	try {
		// Step 1: Resolve coordinates to a census block group geoid
		const geoid = await latLngToGeoid(lat, lng);
		const locationId = geoid ? `bg_${geoid}` : null;

		if (locationId) {
			// Step 2: Call the Python FastAPI scoring backend
			const pythonApiUrl = `http://localhost:8000/api/v1/locations/${locationId}/score?business_type=${encodeURIComponent(businessType)}&debug=${debugMode}`;
			const pythonStart = Date.now();

			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
				const pythonRes = await fetch(pythonApiUrl, { signal: controller.signal });
				clearTimeout(timeout);
				pythonApiLatencyMs = Date.now() - pythonStart;

				if (pythonRes.ok) {
					const pyData = await pythonRes.json();
					console.log(`[LocationIQ] [SCORE_TRACE] ${pyData._trace_id || 'no-trace'} — served via python_api (${pythonApiLatencyMs}ms)`);

					// Map Python API response to SvelteKit frontend shape
					const iqScore = Math.round(pyData.composite_location_iq || 50);
					const grade = pyData.grade || 'C';
					const staticScores = pyData.static_scores || {};
					const signals = pyData.signals || [];
					const rawMetrics = pyData.raw_metrics || {};

					const responseBody: Record<string, unknown> = {
						lat, lng, businessType,
						locationIQ: iqScore,
						grade: grade,
						verdict: `Scored ${iqScore}/100. Powered by Python Scoring Engine v2.`,
						sixIndex: {
							locationIQ: iqScore, grade: grade, conceptType: businessType, conceptLabel: businessType.replace(/_/g, ' '),
							indices: {
								competition: { score: staticScores.competition ?? 50, weight: 10, label: "Competition Context", description: "Direct competitor density within 400m", dataSources: 1, totalSources: 1 },
								vibrancy: { score: staticScores.vibrancy ?? 50, weight: 15, label: "Vibrancy", description: "Commercial energy and daily population flow", dataSources: 1, totalSources: 1 },
								demographics: { score: staticScores.demographics ?? 50, weight: 8, label: "Demographics Fit", description: "Median income and housing rent tier alignment", dataSources: 1, totalSources: 1 },
								safety: { score: staticScores.safety ?? 50, weight: 8, label: "Safety", description: "NYPD crime rate and health inspection results", dataSources: 1, totalSources: 1 },
								transit: { score: staticScores.transit ?? 50, weight: 25, label: "Transit & Foot Traffic", description: "MTA ridership, pedestrian counts, Walk Score", dataSources: 1, totalSources: 1 },
								momentum: { score: staticScores.momentum ?? 50, weight: 10, label: "Momentum", description: "6-month DCA license growth trajectory", dataSources: 1, totalSources: 1 },
							},
							signals: signals,
							coffeeDimensions: businessType === 'specialty_coffee' ? {
								morningFootTraffic: staticScores.transit ?? 50,
								dailyRitualDensity: staticScores.daily_ritual_density ?? 50,
								competitionContext: staticScores.competition ?? 50,
								streetSide: staticScores.street_side ?? 50,
								demographicsFit: staticScores.demographics ?? 50,
								baseViability: staticScores.survival_rate ?? 50,
								visionMultiplier: 1.0,
								rawComposite: iqScore
							} : undefined,
						},
						lenses: [
							{ dimension: "competition", label: "Competitors", uxLabel: "Competitors", score: staticScores.competition ?? 50, verdictLine: `Active competitors: ${rawMetrics.total_competitors || 0}`, topSignals: signals.filter((s: any) => s.index === 'competition').slice(0, 3), mapHighlights: ['competitor', 'similar_business'] },
							{ dimension: "vibrancy", label: "Concept Pulse", uxLabel: "Concept Pulse", score: staticScores.vibrancy ?? 50, verdictLine: `Estimated morning passersby: ${rawMetrics.estimated_morning_passersby || 0}`, topSignals: signals.filter((s: any) => s.index === 'vibrancy').slice(0, 3), mapHighlights: ['foot_traffic', 'sidewalk_cafe'] },
							{ dimension: "demographics", label: "Demographics", uxLabel: "Who lives here", score: staticScores.demographics ?? 50, verdictLine: `Median Household Income: $${(rawMetrics.median_household_income || 0).toLocaleString()}`, topSignals: signals.filter((s: any) => s.index === 'demographics').slice(0, 3), mapHighlights: ['census_block'] },
							{ dimension: "safety", label: "Safety", uxLabel: "Safety", score: staticScores.safety ?? 50, verdictLine: `Crime incidents nearby: ${rawMetrics.crime_count || 0}`, topSignals: signals.filter((s: any) => s.index === 'safety').slice(0, 3), mapHighlights: ['crime_incident'] },
							{ dimension: "transit", label: "Transit", uxLabel: "Transit & Access", score: staticScores.transit ?? 50, verdictLine: `Daily ridership: ${(rawMetrics.total_daily_ridership || 0).toLocaleString()}`, topSignals: signals.filter((s: any) => s.index === 'transit').slice(0, 3), mapHighlights: ['subway', 'bus_stop'] },
							{ dimension: "momentum", label: "Momentum", uxLabel: "Momentum", score: staticScores.momentum ?? 50, verdictLine: `Neighborhood growth trajectory`, topSignals: signals.filter((s: any) => s.index === 'momentum').slice(0, 3), mapHighlights: ['new_permits'] },
						],
						threeScores: {
							locationIQ: { score: iqScore, grade: grade },
							visionIQ: pyData.dynamic_vision_iq ? { available: true, score: pyData.dynamic_vision_iq.score, grade: pyData.dynamic_vision_iq.score >= 80 ? 'A' : pyData.dynamic_vision_iq.score >= 60 ? 'B' : 'C' } : { available: false },
							fitIQ: { available: false },
						},
						confidence: { level: 'CONFIDENT', scoreAgreement: 0.9 },
						confidenceBySource: { transit: 100, safety: 100, demographics: 100, competition: 100, vibrancy: 100, momentum: 100, vision: 0 },
						dataSourceQuality: { competitors: 'verified' },
						dataFreshness: { ageLabel: 'Live from Python Engine v2', sources: [] },
						reconciled: { totalEntities: 0 },
						rawIntelErrors: [],
						// V2 transparency fields — always present
						_serving_mode: 'python_api' as const,
						_trace_id: pyData._trace_id || null,
						_engine_version: pyData._engine_version || 'unknown',
					};

					// Append debug envelope when requested
					if (debugMode && pyData._debug) {
						responseBody._debug = {
							...pyData._debug,
							_sveltekit_proxy: {
								_python_api_url: pythonApiUrl,
								_python_api_status: pythonRes.status,
								_python_api_latency_ms: pythonApiLatencyMs,
								_geoid_resolved: geoid,
								_geoid_source: `latLngToGeoid(${lat}, ${lng})`,
								_fallback_reason: null,
							},
						};
					}

					return new Response(JSON.stringify(responseBody), {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					});
				} else {
					// Python API returned an error — fall through to fallback
					fallbackReason = `python_api_error_${pythonRes.status}`;
					console.warn(`[LocationIQ] Python API returned ${pythonRes.status}, falling back to getGoldenRecord`);
				}
			} catch (fetchErr: any) {
				pythonApiLatencyMs = Date.now() - pythonStart;
				fallbackReason = fetchErr.name === 'AbortError' ? 'python_api_timeout' : 'python_api_unreachable';
				console.warn(`[LocationIQ] Python API unreachable (${fallbackReason}), falling back to getGoldenRecord`);
			}
		} else {
			fallbackReason = 'geoid_resolution_failed';
			console.warn(`[LocationIQ] Could not resolve geoid for (${lat}, ${lng}), falling back to getGoldenRecord`);
		}

		// ── FALLBACK: Use getGoldenRecord from Snowflake ──
		servingMode = 'fallback_golden_record';
		const { getGoldenRecord } = await import('$lib/snowflake');
		const record = await getGoldenRecord(lat, lng, businessType);

		if (!record) {
			return new Response(JSON.stringify({ error: 'No score found in Snowflake for this location' }), { status: 404 });
		}

		const iqScore = Math.round(record.FINAL_LOCATION_IQ || 50);
		let grade = 'C';
		if (iqScore >= 90) grade = 'A+';
		else if (iqScore >= 80) grade = 'A';
		else if (iqScore >= 70) grade = 'B';
		else if (iqScore >= 60) grade = 'C';
		else grade = 'D';

		console.log(`[LocationIQ] Served via fallback_golden_record — LocationIQ=${iqScore} (reason: ${fallbackReason})`);

		const responseBody: Record<string, unknown> = {
			lat, lng, businessType,
			locationIQ: iqScore,
			grade: grade,
			verdict: `Scored ${iqScore}/100. Ranked in the top ${Math.round((1 - (record.CATEGORY_PERCENTILE || 0)) * 100)}% of locations.`,
			sixIndex: {
				locationIQ: iqScore, grade: grade, conceptType: businessType, conceptLabel: businessType.replace('_', ' '),
				indices: {
					competition: { score: record.COMPETITION_CONTEXT_SCORE, weight: 15, label: "Competition Context" },
					vibrancy: { score: record.MORNING_FOOT_TRAFFIC_SCORE, weight: 40, label: "Morning Foot Traffic" },
					demographics: { score: record.DEMOGRAPHICS_FIT_SCORE, weight: 20, label: "Demographics Fit" },
					safety: { score: record.SAFETY_SCORE, weight: 5, label: "Safety" },
					transit: { score: record.MORNING_FOOT_TRAFFIC_SCORE, weight: 10, label: "Transit" },
					momentum: { score: record.BUSINESS_SURVIVAL_SCORE, weight: 10, label: "Momentum" }
				},
				signals: [],
				coffeeDimensions: businessType === 'specialty_coffee' ? {
					morningFootTraffic: record.MORNING_FOOT_TRAFFIC_SCORE,
					dailyRitualDensity: record.DAILY_RITUAL_DENSITY_SCORE,
					competitionContext: record.COMPETITION_CONTEXT_SCORE,
					streetSide: record.STREET_SIDE_SCORE,
					demographicsFit: record.DEMOGRAPHICS_FIT_SCORE,
					baseViability: record.BUSINESS_SURVIVAL_SCORE,
					visionMultiplier: 1.0,
					rawComposite: iqScore
				} : undefined
			},
			lenses: [
				{ dimension: "competition", label: "Competitors", uxLabel: "Competitors", score: record.COMPETITION_CONTEXT_SCORE, verdictLine: `Active competitors: ${record.TOTAL_COMPETITORS || 0}`, topSignals: [], mapHighlights: [] },
				{ dimension: "vibrancy", label: "Concept Pulse", uxLabel: "Concept Pulse", score: record.MORNING_FOOT_TRAFFIC_SCORE, verdictLine: `Estimated morning passersby: ${record.ESTIMATED_MORNING_PASSERSBY || 0}`, topSignals: [], mapHighlights: [] },
				{ dimension: "demographics", label: "Demographics", uxLabel: "Who lives here", score: record.DEMOGRAPHICS_FIT_SCORE, verdictLine: `Median Household Income: $${record.MEDIAN_HOUSEHOLD_INCOME || 0}`, topSignals: [], mapHighlights: [] },
				{ dimension: "safety", label: "Safety", uxLabel: "Safety", score: record.SAFETY_SCORE, verdictLine: "Powered by Snowflake (fallback)", topSignals: [], mapHighlights: [] },
				{ dimension: "transit", label: "Transit", uxLabel: "Transit & Access", score: record.MORNING_FOOT_TRAFFIC_SCORE, verdictLine: "Powered by Snowflake (fallback)", topSignals: [], mapHighlights: [] },
				{ dimension: "momentum", label: "Momentum", uxLabel: "Momentum", score: record.BUSINESS_SURVIVAL_SCORE, verdictLine: "Powered by Snowflake (fallback)", topSignals: [], mapHighlights: [] },
			],
			threeScores: { locationIQ: { score: iqScore, grade: grade }, visionIQ: { available: false }, fitIQ: { available: false } },
			confidence: { level: 'CONFIDENT', scoreAgreement: 0.8 },
			confidenceBySource: { transit: 100, safety: 100, demographics: 100, competition: 100, vibrancy: 100, momentum: 100, vision: 100 },
			dataSourceQuality: { competitors: 'verified' },
			dataFreshness: { ageLabel: 'Snowflake fallback', sources: [] },
			reconciled: { totalEntities: 0 },
			rawIntelErrors: [],
			// V2 transparency fields
			_serving_mode: 'fallback_golden_record' as const,
			_trace_id: null,
			_engine_version: 'snowflake_legacy',
		};

		// Debug envelope for fallback mode
		if (debugMode) {
			responseBody._debug = {
				_serving_mode: 'fallback_golden_record',
				_fallback_reason: fallbackReason,
				_python_api_latency_ms: pythonApiLatencyMs,
				_note: 'Score came from legacy Snowflake getGoldenRecord — Python API was not reachable. Debug envelope ①–⑥ is only available when served via python_api.',
			};
		}

		return new Response(JSON.stringify(responseBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
	} catch (e: any) {
		console.error('[LocationIQ] ERROR:', e);
		return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
