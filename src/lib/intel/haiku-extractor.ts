/**
 * ═══════════════════════════════════════════════════════
 * Section 8A: Haiku API Extractors
 * ═══════════════════════════════════════════════════════
 *
 * Uses Claude Haiku (via OpenRouter) to extract structured
 * business intelligence from raw API responses that deterministic
 * code can't reliably parse.
 *
 * Extraction targets:
 * 1. Competitor freshness: which nearby businesses are new vs established
 * 2. Review sentiment signals: what customers love/hate about the area
 * 3. Concept gaps: what business types are missing from the neighborhood
 * 4. Price positioning: where the market sits on affordability
 * 5. Foot traffic patterns: when the block is alive vs dead
 *
 * Design principles:
 * - Fire-and-forget: never blocks the scoring pipeline
 * - Graceful degradation: returns empty extractions on failure
 * - Haiku-only: fast + cheap (~$0.001 per extraction)
 * - Structured JSON output: no free-text parsing
 */

import { env } from '$env/dynamic/private';
import type { LocationIntelReport } from './types';
import { openrouterFetch } from './retry';

const OPENROUTER_KEY = env?.OPENROUTER_API_KEY || '';
const HAIKU_MODEL = 'anthropic/claude-haiku-4.5';

// ── Types ──

export interface HaikuExtraction {
	competitorFreshness: CompetitorFreshness[];
	sentimentSignals: SentimentSignal[];
	conceptGaps: ConceptGap[];
	pricePositioning: PricePositioning | null;
	footTrafficPatterns: FootTrafficPattern[];
	extractedAt: string;
	model: string;
	latencyMs: number;
}

export interface CompetitorFreshness {
	name: string;
	source: string;
	estimatedAge: 'new_under_1yr' | 'established_1_3yr' | 'mature_3plus' | 'unknown';
	confidence: number;
	signals: string[];
}

export interface SentimentSignal {
	theme: string;
	sentiment: 'positive' | 'negative' | 'mixed';
	frequency: 'common' | 'occasional' | 'rare';
	relevantTo: string;
	example: string;
}

export interface ConceptGap {
	missingType: string;
	demandSignal: string;
	confidence: number;
	reasoning: string;
}

export interface PricePositioning {
	areaAvgPriceLevel: number;
	distribution: { budget: number; mid: number; upscale: number };
	openingFor: string;
	reasoning: string;
}

export interface FootTrafficPattern {
	timeSlot: string;
	intensity: 'high' | 'medium' | 'low' | 'dead';
	primaryDrivers: string[];
	source: string;
}

// ── Empty fallback ──

function emptyExtraction(): HaikuExtraction {
	return {
		competitorFreshness: [],
		sentimentSignals: [],
		conceptGaps: [],
		pricePositioning: null,
		footTrafficPatterns: [],
		extractedAt: new Date().toISOString(),
		model: 'none',
		latencyMs: 0,
	};
}

// ── Main extraction function ──

export async function extractWithHaiku(
	report: LocationIntelReport
): Promise<HaikuExtraction> {
	if (!OPENROUTER_KEY) return emptyExtraction();

	const start = Date.now();

	// Build a condensed data snapshot for Haiku (keep tokens low)
	const snapshot = buildDataSnapshot(report);
	if (!snapshot) return emptyExtraction();

	const systemPrompt = `You are a commercial real estate data analyst. Extract structured intelligence from raw API data about a NYC neighborhood.

Return ONLY valid JSON with this exact structure:
{
  "competitorFreshness": [{"name": "string", "source": "google|yelp|foursquare", "estimatedAge": "new_under_1yr|established_1_3yr|mature_3plus|unknown", "confidence": 0.0-1.0, "signals": ["why you think this"]}],
  "sentimentSignals": [{"theme": "string", "sentiment": "positive|negative|mixed", "frequency": "common|occasional|rare", "relevantTo": "business type this matters for", "example": "brief example"}],
  "conceptGaps": [{"missingType": "what's missing", "demandSignal": "evidence of demand", "confidence": 0.0-1.0, "reasoning": "why"}],
  "pricePositioning": {"areaAvgPriceLevel": 1-4, "distribution": {"budget": 0.0-1.0, "mid": 0.0-1.0, "upscale": 0.0-1.0}, "openingFor": "price tier with opportunity", "reasoning": "why"},
  "footTrafficPatterns": [{"timeSlot": "morning|lunch|afternoon|evening|late_night|weekend", "intensity": "high|medium|low|dead", "primaryDrivers": ["what drives traffic"], "source": "data source"}]
}

Be precise. Only include what the data supports. Max 5 items per array. No explanations outside JSON.`;

	try {
		// FIX-010: use openrouterFetch (1 retry, 2s→4s backoff on 429/500; returns null on failure)
		const response = await openrouterFetch(
			'https://openrouter.ai/api/v1/chat/completions',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${OPENROUTER_KEY}`,
					'HTTP-Referer': 'https://resquared.io',
					'X-Title': 'RE² Haiku Extractor'
				},
				body: JSON.stringify({
					model: HAIKU_MODEL,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: snapshot }
					],
					temperature: 0.2,
					max_tokens: 1500
				})
			},
			'HaikuExtractor'
		);

		if (!response) {
			// null = retries exhausted — graceful degrade
			return emptyExtraction();
		}

		const completion = await response.json();
		const content = completion.choices?.[0]?.message?.content || '';
		const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

		try {
			const parsed = JSON.parse(cleaned);
			return {
				competitorFreshness: (parsed.competitorFreshness || []).slice(0, 5),
				sentimentSignals: (parsed.sentimentSignals || []).slice(0, 5),
				conceptGaps: (parsed.conceptGaps || []).slice(0, 5),
				pricePositioning: parsed.pricePositioning || null,
				footTrafficPatterns: (parsed.footTrafficPatterns || []).slice(0, 6),
				extractedAt: new Date().toISOString(),
				model: HAIKU_MODEL,
				latencyMs: Date.now() - start,
			};
		} catch {
			console.error('[HaikuExtractor] JSON parse failed');
			return emptyExtraction();
		}
	} catch (err) {
		console.error('[HaikuExtractor] Fetch error:', err);
		return emptyExtraction();
	}
}

// ── Build condensed data snapshot ──

function buildDataSnapshot(report: LocationIntelReport): string | null {
	const parts: string[] = [];

	parts.push(`Location: ${report.address || `${report.lat},${report.lng}`}`);
	parts.push(`Business type: ${report.businessType}`);

	// Google Places competitors
	if (report.places?.results?.length) {
		const top = report.places.results.slice(0, 8);
		parts.push(`\nNearby competitors (Google Places):`);
		top.forEach(p => {
			parts.push(`- ${p.name}: rating ${p.rating || '?'}/5, ${p.user_ratings_total || 0} reviews, price_level ${p.price_level || '?'}`);
		});
	}

	// Yelp businesses
	if (report.yelp?.businesses?.length) {
		const top = report.yelp.businesses.slice(0, 8);
		parts.push(`\nNearby businesses (Yelp):`);
		top.forEach(b => {
			parts.push(`- ${b.name}: ${b.rating}/5, ${b.review_count} reviews, price=${b.price || '?'}, categories=[${(b.categories || []).map((c: any) => c.title || c.alias).join(', ')}]`);
		});
	}

	// Foursquare venues
	if (report.foursquare?.venues?.length) {
		const top = report.foursquare.venues.slice(0, 6);
		parts.push(`\nVenues (Foursquare):`);
		top.forEach(v => {
			parts.push(`- ${v.name}: popularity=${v.popularity || '?'}, categories=[${(v.categories || []).map((c: any) => c.name || c).join(', ')}]`);
		});
	}

	// Market density
	if (report.marketDensity?.categories?.length) {
		parts.push(`\nMarket density (500m radius):`);
		report.marketDensity.categories.forEach((c: any) => {
			parts.push(`- ${c.category}: ${c.count} businesses`);
		});
	}

	// Census demographics
	if (report.census) {
		const c = report.census;
		parts.push(`\nDemographics: median_income=$${c.medianIncome || '?'}, population_density=${c.populationDensity || '?'}/sqmi`);
	}

	// Transit
	if (report.mtaRidership?.stations?.length) {
		const topStation = report.mtaRidership.stations[0];
		parts.push(`\nNearest subway: ${topStation.stationName}, daily ridership ~${topStation.avgDailyRidership || '?'}`);
	}

	// Pedestrian counts
	if (report.pedestrian?.counts?.length) {
		const top = report.pedestrian.counts[0];
		parts.push(`Pedestrian count: ${top.count || '?'} at ${top.location || 'nearby intersection'}`);
	}

	// DCA licenses (business freshness signals)
	if (report.dcaLicenses) {
		const d = report.dcaLicenses as any;
		parts.push(`\nBusiness licenses: ${d.totalActive || d.total || '?'} active, new_business_rate=${d.newBusinessRate || '?'}%`);
	}

	// Sidewalk cafes + liquor licenses (vibrancy)
	if (report.sidewalkCafes) {
		const sc = report.sidewalkCafes as any;
		parts.push(`Sidewalk cafes: ${sc.total || sc.permits?.length || 0} permits nearby`);
	}
	if (report.liquorLicenses) {
		const ll = report.liquorLicenses as any;
		parts.push(`Liquor licenses: ${ll.total || ll.licenses?.length || 0} nearby`);
	}

	// Safety
	if (report.crime) {
		const cr = report.crime as any;
		parts.push(`\nCrime: ${cr.totalIncidents || cr.total || '?'} incidents (500m radius)`);
	}

	if (parts.length < 3) return null;
	return parts.join('\n');
}
