/**
 * /api/session-intelligence — Unified AI endpoint
 *
 * One endpoint that receives the full RE2Session context and a requestType,
 * dispatches to the appropriate prompt template, and returns coherent AI output.
 *
 * All AI calls share session context so coaching, verdict, business model,
 * and playbook are self-consistent.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getSessionContextForAI, type IntelligenceRequestType } from '$lib/session';
import { OPENROUTER_URL, openRouterHeaders } from '$lib/constants/aiConfig';

const OPENROUTER_KEY = env.OPENROUTER_API_KEY || '';
const MODEL = 'anthropic/claude-sonnet-4';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { requestType, session, extra } = body as {
		requestType: IntelligenceRequestType;
		session: Record<string, unknown>;
		extra?: Record<string, unknown>;
	};

	if (!requestType || !session) {
		throw error(400, 'Missing requestType or session');
	}

	const context = getSessionContextForAI(session as any);
	const systemPrompt = buildSystemPrompt(requestType, context, extra);
	const userPrompt = buildUserPrompt(requestType, context, extra);

	// If no API key, return template responses
	if (!OPENROUTER_KEY) {
		return json({
			requestType,
			result: getTemplateFallback(requestType, context),
			cached: false
		});
	}

	try {
		// #53/#54: OPENROUTER_URL and headers from shared aiConfig
		const response = await fetch(OPENROUTER_URL, {
			method: 'POST',
			headers: openRouterHeaders(OPENROUTER_KEY),
			body: JSON.stringify({
				model: MODEL,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userPrompt }
				],
				temperature: 0.7,
				max_tokens: 2000
			})
		});

		if (!response.ok) {
			console.error('OpenRouter error:', response.status);
			return json({
				requestType,
				result: getTemplateFallback(requestType, context),
				cached: false
			});
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content || '';

		// Parse JSON response from the LLM
		let result: unknown;
		try {
			// Try to extract JSON from the response
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			result = jsonMatch ? JSON.parse(jsonMatch[0]) : { text: content };
		} catch {
			result = { text: content };
		}

		return json({ requestType, result, cached: false });

	} catch (err) {
		console.error('Session intelligence error:', err);
		return json({
			requestType,
			result: getTemplateFallback(requestType, context),
			cached: false
		});
	}
};

// ── Prompt Builders ──

function buildSystemPrompt(
	requestType: IntelligenceRequestType,
	_context: Record<string, unknown>,
	_extra?: Record<string, unknown>
): string {
	const base = `You are the RE² AI coach — a warm, knowledgeable advisor who has helped hundreds of small business founders evaluate locations. You speak in plain English, never jargon. You cite specific numbers when available. You are encouraging but honest.

CRITICAL RULES:
- Never say "data layers" or "weighted scoring" — say "things we checked" or "what matters most for your business"
- Every number gets context — "65" means nothing, "65 — 3 competitors within 0.3mi" means everything
- Use traffic light language — green = good, orange = look twice, red = stop and think
- Be specific to their business type — a coffee shop and a dental office need completely different advice
- Always respond with valid JSON matching the requested schema`;

	switch (requestType) {
		case 'coaching':
			return `${base}

You are providing real-time coaching during onboarding. Be warm, specific, and give immediate value. Reference real SMB learnings. Keep responses to 2-3 sentences unless analyzing a concept.

Respond with JSON: { "message": "your coaching text", "highlights": ["key point 1", "key point 2"] }`;

		case 'conceptAnalysis':
			return `${base}

Analyze the founder's concept description. Identify strengths, potential warnings, suggest 2-3 creative business names, and provide differentiation tips.

Respond with JSON: { "strengths": ["..."], "warnings": ["..."], "nameIdeas": ["..."], "differentiationTips": "...", "targetCustomers": "..." }`;

		case 'smartDefaults':
			return `${base}

Generate realistic financial defaults for this business concept in NYC. Use industry benchmarks adjusted for their specific concept. Always provide ranges, not point estimates.

Respond with JSON: { "dailyRevenue": [low, high], "avgTicket": number, "dailyCustomers": [low, high], "idealSqft": [low, high], "maxHealthyRent": number, "buildoutPerSqft": [low, high], "explanation": "how we calculated this" }`;

		case 'verdict':
			return `${base}

Synthesize ALL scoring data into a 2-3 sentence verdict. Cite specific numbers. Be clear about whether they should proceed.

Respond with JSON: { "verdict": "your 2-3 sentence synthesis" }`;

		case 'businessModel':
			return `${base}

Generate an ESPN Next Gen Stats style business viability analysis. Compute a success probability (15-95% range), identify what pushes odds up vs down, generate financial ranges, and write a risk narrative with specific action items.

Respond with JSON matching the BusinessModel interface: {
  "successProbability": number,
  "verdict": "strong" | "promising" | "risky",
  "narrative": "ESPN-style paragraph",
  "positiveFactors": [{ "label": "...", "impact": number, "explanation": "..." }],
  "negativeFactors": [{ "label": "...", "impact": number, "explanation": "..." }],
  "financials": { "monthlyRevenue": [low, high], "monthlyRent": number, "rentToRevenueRatio": [low, high], "breakEvenMonths": [low, high], "buildoutCost": [low, high] },
  "sliderDefaults": { "dailyCustomers": { "min": n, "default": n, "max": n }, "avgTicket": { "min": n, "default": n, "max": n } },
  "riskNarrative": "2-3 paragraphs with specific action items",
  "assumptions": ["..."],
  "disclaimer": "..."
}`;

		case 'playbook':
			return `${base}

Generate 5 specific, actionable next steps for this founder. Each step should reference actual data from the scoring. Include specific questions to ask, dollar amounts, and timeframes.

Respond with JSON: { "steps": [{ "number": 1, "title": "...", "explanation": "...", "icon": "emoji" }] }`;

		case 'riskNarrative':
			return `${base}

Write a 2-3 paragraph risk narrative that reads like a story, not a list. Identify the biggest risk, quantify it, and give a specific action to mitigate it.

Respond with JSON: { "narrative": "your risk story" }`;

		case 'comparison':
			return `${base}

Compare two locations for this specific business type. Be specific about which factors favor which location. End with a clear recommendation.

Respond with JSON: { "comparison": "your comparison narrative", "winner": "address1 or address2", "reasoning": "why" }`;

		default:
			return base;
	}
}

function buildUserPrompt(
	requestType: IntelligenceRequestType,
	context: Record<string, unknown>,
	extra?: Record<string, unknown>
): string {
	const sessionInfo = JSON.stringify(context, null, 2);

	switch (requestType) {
		case 'coaching':
			return `Session context:\n${sessionInfo}\n\nCurrent screen: ${extra?.currentScreen || 'unknown'}\nUser action: ${extra?.action || 'viewing screen'}\n\nProvide coaching for this moment.`;

		case 'conceptAnalysis':
			return `Session context:\n${sessionInfo}\n\nAnalyze this concept and provide strengths, warnings, name ideas, and differentiation tips.`;

		case 'smartDefaults':
			return `Session context:\n${sessionInfo}\n\nGenerate realistic NYC financial defaults for this specific concept.`;

		case 'verdict':
			return `Session context:\n${sessionInfo}\n\nSynthesize all data into a clear verdict.`;

		case 'businessModel':
			return `Session context:\n${sessionInfo}\n\nGenerate the full business viability model.`;

		case 'playbook':
			return `Session context:\n${sessionInfo}\n\nGenerate 5 personalized next steps.`;

		case 'riskNarrative':
			return `Session context:\n${sessionInfo}\n\nWrite the risk narrative.`;

		case 'comparison':
			return `Session context:\n${sessionInfo}\n\nCompare locations: ${JSON.stringify(extra?.locations || [])}`;

		default:
			return `Session context:\n${sessionInfo}\n\nProvide relevant intelligence.`;
	}
}

// ── Template Fallbacks (when no API key) ──

function getTemplateFallback(
	requestType: IntelligenceRequestType,
	context: Record<string, unknown>
): unknown {
	const persona = (context.personaType as string) || 'your business';
	const concept = (context.conceptDescription as string) || '';

	switch (requestType) {
		case 'coaching':
			return {
				message: `Great choice with ${persona}. Location is everything for this type of business — the right spot can mean the difference between thriving and struggling. Let's find your perfect location.`,
				highlights: ['Location precision matters', 'We check 20+ data sources']
			};

		case 'conceptAnalysis':
			return {
				strengths: concept ? ['Specific concept vision', 'Clear target market'] : ['Getting started is the hardest part'],
				warnings: ['Define your unique angle to stand out from competitors'],
				nameIdeas: ['Your Brand Here'],
				differentiationTips: 'Focus on what makes your version special — that specificity helps us give better advice.',
				targetCustomers: 'We will identify your ideal customer profile once we score a location.'
			};

		case 'smartDefaults':
			return {
				dailyRevenue: [600, 1200],
				avgTicket: 8,
				dailyCustomers: [80, 150],
				idealSqft: [600, 1200],
				maxHealthyRent: 5000,
				buildoutPerSqft: [75, 200],
				explanation: 'Based on NYC benchmarks for your business type. These are starting estimates — we will refine once you pick an address.'
			};

		case 'verdict':
			return {
				verdict: 'Score a location to see your personalized verdict with specific data-backed insights.'
			};

		case 'businessModel':
			return null;

		case 'playbook':
			return {
				steps: [
					{ number: 1, title: 'Walk the block at peak hours', explanation: 'Count foot traffic yourself at the times that matter most for your business.', icon: '🚶' },
					{ number: 2, title: 'Check the infrastructure', explanation: 'Verify electrical, plumbing, and HVAC capacity before falling in love with the space.', icon: '🔌' },
					{ number: 3, title: 'Talk to neighboring businesses', explanation: 'Ask them about foot traffic patterns, landlord responsiveness, and seasonal changes.', icon: '🗣️' },
					{ number: 4, title: 'Get a contractor walkthrough', explanation: 'A $300-500 walkthrough can save you $30K+ in surprise buildout costs.', icon: '🔨' },
					{ number: 5, title: 'Negotiate before you sign', explanation: 'Most landlords expect negotiation. Ask for rent-free buildout months and a TI allowance.', icon: '📝' }
				]
			};

		case 'riskNarrative':
			return {
				narrative: 'Score a location to generate your personalized risk analysis.'
			};

		case 'comparison':
			return {
				comparison: 'Score two locations to see a detailed comparison.',
				winner: '',
				reasoning: ''
			};

		default:
			return { message: 'Intelligence will be generated once more data is available.' };
	}
}
