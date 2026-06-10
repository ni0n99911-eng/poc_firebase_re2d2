/**
 * AI-powered location brief generation endpoint.
 *
 * POST /api/generate-brief
 *
 * Accepts a POST body with location scoring data and generates a 3-5 paragraph
 * coaching narrative using Claude Sonnet. Integrates with Supabase caching for
 * 24-hour response reuse (same location + persona = same brief).
 *
 * Request body:
 * {
 *   persona_type: string;           // 'coffee', 'bar', 'gym', etc.
 *   concept_description: string;    // "specialty coffee shop"
 *   address: string;                // "123 Main St, New York, NY"
 *   composite_score: number;        // 0-100
 *   index_scores: Record<string, number>; // { transit: 85, competition: 70, ... }
 *   spoke_labels: string[];         // ['Transit', 'Competition', 'Demographics', ...]
 *   transit_summary: string?;       // Optional detailed transit info
 *   crime_summary: string?;         // Optional detailed crime info
 *   competitor_count: number?;      // Optional count
 *   median_income: number?;         // Optional income figure
 * }
 *
 * Response:
 * {
 *   narrative: string;              // Generated coaching brief (or empty if API unavailable)
 *   model: string;                  // 'claude-sonnet-4-20250514' or 'template'
 *   cached: boolean;                // true if fetched from cache
 *   cachedAt?: string;              // ISO timestamp if cached
 * }
 *
 * Rate limiting: 5 requests per minute per IP (RATE_LIMITS.ai)
 * Caching: Supabase table 'ai_briefs' with 24-hour TTL
 */

import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';
import { db } from '$lib/db-server';
import * as schema from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { OPENROUTER_URL, openRouterHeaders } from '$lib/constants/aiConfig';

// Generate a stable cache key from input parameters
function generateCacheKey(personaType: string, address: string): string {
	const key = `${personaType.toLowerCase()}_${address.toLowerCase()}`;
	return Buffer.from(key).toString('base64');
}

// Build the system prompt for Claude
function buildSystemPrompt(): string {
	return `You are RE², an AI co-pilot for first-time retail founders. Your role is to generate location intelligence briefs that are:

- Direct and warm in tone, never jargon-heavy
- Written for the founder's specific business type in their language
- Started with a clear verdict about the location fit
- Focused on the top 2-3 factors that matter most
- Alert to one non-obvious insight or hidden advantage
- Honest about one key risk or watch-out
- Closed with one specific, actionable next step

Your briefs are 3-5 paragraphs, data-informed, and designed to help founders make faster, better site selection decisions. Focus on what matters, not completeness. Use concrete details from the data (scores, counts, percentages) to anchor your analysis.`;
}

// Build the user prompt with the location data
function buildUserPrompt(data: {
	personaType: string;
	conceptDescription: string;
	address: string;
	compositeScore: number;
	indexScores: Record<string, number>;
	spokeLabels: string[];
	transitSummary?: string;
	crimeSummary?: string;
	competitorCount?: number;
	medianIncome?: number;
}): string {
	const scoreDetails = data.spokeLabels
		.map((label, idx) => {
			const key = ['transit', 'competition', 'demographics', 'vibrancy', 'safety', 'momentum'][idx];
			const score = data.indexScores[key] ?? 0;
			return `${label}: ${Math.round(score)}/100`;
		})
		.join(' | ');

	let context = `Location: ${data.address}
Business Type: ${data.conceptDescription}
Persona: ${data.personaType}
Composite Score: ${data.compositeScore}/100

Index Scores: ${scoreDetails}`;

	if (data.medianIncome) {
		context += `\nMedian Household Income: $${Math.round(data.medianIncome / 1000)}k`;
	}
	if (data.competitorCount) {
		context += `\nCompetitors Nearby: ${data.competitorCount}`;
	}
	if (data.transitSummary) {
		context += `\n\nTransit Context: ${data.transitSummary}`;
	}
	if (data.crimeSummary) {
		context += `\nSafety Context: ${data.crimeSummary}`;
	}

	return `Generate a location intelligence brief for this ${data.conceptDescription} concept using the data below. The brief should be warm, direct coaching—help this founder decide if this location is worth pursuing.

${context}`;
}

interface BriefRequest {
	persona_type: string;
	concept_description: string;
	address: string;
	composite_score: number;
	index_scores: Record<string, number>;
	spoke_labels: string[];
	transit_summary?: string;
	crime_summary?: string;
	competitor_count?: number;
	median_income?: number;
}

export const POST: RequestHandler = async ({ request }) => {
	// Rate limiting: 5 req/min for AI generation
	const limited = rateLimit(request, RATE_LIMITS.ai);
	if (limited) return limited;

	// Parse request body
	let body: BriefRequest;
	try {
		body = await request.json();
	} catch (e) {
		return new Response(
			JSON.stringify({
				error: 'Invalid request body',
				message: 'Expected JSON with persona_type, concept_description, address, etc.'
			}),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	// Validate required fields
	const required = ['persona_type', 'concept_description', 'address', 'composite_score', 'index_scores'];
	for (const field of required) {
		if (!(field in body)) {
			return new Response(
				JSON.stringify({
					error: 'Missing required field',
					field
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}
	}

	try {
		// Generate cache key
		const cacheKey = generateCacheKey(body.persona_type, body.address);

		// Check Supabase cache (if client available)
		let cachedBrief: { narrative: string; cached_at: string } | null = null;
		try {
			const cachedRows = await db
				.select()
				.from(schema.aiBriefs)
				.where(eq(schema.aiBriefs.id, cacheKey))
				.limit(1);
			
			const cachedRow = cachedRows[0];
			const cached = cachedRow ? (cachedRow.briefData as any) : null;

			if (cached) {
				// Check if cache is still fresh (24 hours)
				const cachedAtMs = new Date(cached.cached_at).getTime();
				const nowMs = Date.now();
				const age = (nowMs - cachedAtMs) / 1000 / 60 / 60; // hours

				if (age < 24) {
					cachedBrief = cached;
				}
			}
		} catch (cacheErr) {
			// Supabase unavailable; continue to API call
			console.warn('[GenerateBrief] Cache check failed:', cacheErr instanceof Error ? cacheErr.message : cacheErr);
		}

		// Return cached brief if found
		if (cachedBrief) {
			return new Response(
				JSON.stringify({
					narrative: cachedBrief.narrative,
					model: 'anthropic/claude-sonnet-4',
					cached: true,
					cachedAt: cachedBrief.cached_at
				}),
				{
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'public, max-age=3600'
					}
				}
			);
		}

		// No API key? Return empty narrative gracefully
		const apiKey = env.OPENROUTER_API_KEY;
		if (!apiKey) {
			console.warn('[GenerateBrief] No OPENROUTER_API_KEY; returning empty narrative');
			return new Response(
				JSON.stringify({
					narrative: '',
					model: 'template',
					cached: false
				}),
				{
					status: 200,
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
		}

		// Call OpenRouter API (OpenAI-compatible)
		// #53/#54: OPENROUTER_URL and headers from shared aiConfig
		const openRouterResponse = await fetch(OPENROUTER_URL, {
			method: 'POST',
			headers: openRouterHeaders(apiKey),
			body: JSON.stringify({
				model: 'anthropic/claude-sonnet-4',
				max_tokens: 1024,
				messages: [
					{
						role: 'system',
						content: buildSystemPrompt()
					},
					{
						role: 'user',
						content: buildUserPrompt({
							personaType: body.persona_type,
							conceptDescription: body.concept_description,
							address: body.address,
							compositeScore: body.composite_score,
							indexScores: body.index_scores,
							spokeLabels: body.spoke_labels || ['Transit', 'Competition', 'Demographics', 'Concept Pulse', 'Safety', 'Momentum'],
							transitSummary: body.transit_summary,
							crimeSummary: body.crime_summary,
							competitorCount: body.competitor_count,
							medianIncome: body.median_income
						})
					}
				]
			})
		});

		if (!openRouterResponse.ok) {
			const errText = await openRouterResponse.text();
			console.error('[GenerateBrief] OpenRouter API error:', openRouterResponse.status, errText);
			return new Response(
				JSON.stringify({ narrative: '', model: 'template', cached: false }),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const completion = await openRouterResponse.json();
		const narrative = completion.choices?.[0]?.message?.content || '';

		// Cache the result (fire-and-forget)
		try {
			await db
				.insert(schema.aiBriefs)
				.values({
					id: cacheKey,
					briefData: {
						persona_type: body.persona_type,
						address: body.address,
						narrative,
						composite_score: body.composite_score,
						cached_at: new Date().toISOString()
					}
				})
				.onConflictDoUpdate({
					target: schema.aiBriefs.id,
					set: {
						briefData: {
							persona_type: body.persona_type,
							address: body.address,
							narrative,
							composite_score: body.composite_score,
							cached_at: new Date().toISOString()
						}
					}
				});
		} catch (cacheErr) {
			// Cache write failed; that's OK—return the result anyway
			console.warn('[GenerateBrief] Cache write failed:', cacheErr instanceof Error ? cacheErr.message : cacheErr);
		}

		return new Response(
			JSON.stringify({
				narrative,
				model: 'anthropic/claude-sonnet-4',
				cached: false
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'private, max-age=300' // Browser cache for 5 min
				}
			}
		);
	} catch (e: unknown) {
		console.error('[GenerateBrief] Error:', e);

		// If API call failed, return empty narrative instead of error
		// This ensures the UI never breaks
		return new Response(
			JSON.stringify({
				narrative: '',
				model: 'template',
				cached: false
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}
};
