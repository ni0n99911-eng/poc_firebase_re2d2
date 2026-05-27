/**
 * /api/onboarding-chat — Streaming chat endpoint for onboarding conversation
 *
 * Powers the iMessage-style onboarding. The AI coach guides founders through
 * concept discovery, extracting structured data behind the scenes.
 *
 * Returns: streaming SSE with text chunks + a final JSON metadata block
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { buildOnboardingSystemPrompt, getPersonaCoaching } from '$lib/intel/prompt-builder';
import { OPENROUTER_URL, openRouterHeaders } from '$lib/constants/aiConfig';

const OPENROUTER_KEY = env.OPENROUTER_API_KEY || '';

// LLM Tiering: right model for the right moment
// ~70% Haiku (fast/cheap), ~20% Sonnet (mid), ~10% Opus (deep reasoning)
const TIER_MODELS: Record<string, string> = {
	haiku: 'anthropic/claude-haiku-4.5',
	sonnet: 'anthropic/claude-sonnet-4',
	opus: 'anthropic/claude-opus-4'
};

// Map conversation phases to tiers
const PHASE_TIER_MAP: Record<string, string> = {
	greeting: 'haiku',
	business_type: 'haiku',
	acknowledgment: 'haiku',
	concept: 'sonnet',
	customers: 'sonnet',
	differentiators: 'sonnet',
	financials: 'sonnet',
	address: 'sonnet',
	analysis: 'opus',
	verdict: 'opus',
	playbook: 'opus',
	business_model: 'opus',
	complete: 'haiku'
};

// Tier-specific generation params — keep responses SHORT
// Visible text should be ~3 sentences; metadata JSON adds ~200 tokens
const TIER_PARAMS: Record<string, { temperature: number; max_tokens: number }> = {
	haiku: { temperature: 0.6, max_tokens: 350 },
	sonnet: { temperature: 0.7, max_tokens: 450 },
	opus: { temperature: 0.75, max_tokens: 600 }
};

interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { messages, sessionContext, tier: requestedTier } = body as {
		messages: ChatMessage[];
		sessionContext?: Record<string, unknown>;
		tier?: string;
	};

	const isNewConcept = !!(sessionContext?.isNewConcept);

	if (!messages || !Array.isArray(messages)) {
		throw error(400, 'Missing messages array');
	}

	// Rate limit: max 20 exchanges
	const userMessages = messages.filter(m => m.role === 'user');
	if (userMessages.length > 20) {
		throw error(429, 'Maximum conversation length reached');
	}

	// Build persona-specific coaching context
	const personaKey = (sessionContext?.personaKey as string) || '';
	let coachingData = getPersonaCoaching(personaKey);

	// Resolve LLM tier: explicit request > phase-based > default sonnet
	const phase = (sessionContext?.conversationPhase as string) || 'greeting';
	const tier = requestedTier || PHASE_TIER_MAP[phase] || 'sonnet';
	const model = TIER_MODELS[tier] || TIER_MODELS.sonnet;
	const params = TIER_PARAMS[tier] || TIER_PARAMS.sonnet;

	// Build system prompt using the prompt-builder (dynamic, persona-aware)
	const extractedData = (sessionContext?.extractedData as Record<string, unknown>) || {};

	// "Something Else" handler: when user has described their concept, run Sonnet
	// concept analysis to get tailored coaching data and closest persona match
	let conceptAnalysis: Record<string, unknown> | null = null;
	if ((personaKey === 'something_else' || personaKey === 'other') && OPENROUTER_KEY) {
		const conceptDesc = (extractedData.conceptDescription as string) || '';
		const conceptName = (extractedData.conceptName as string) || '';
		// Also scan recent user messages for concept description if not yet extracted
		const recentUserText = userMessages.slice(-3).map(m => m.content).join(' ');
		const hasConceptInfo = conceptDesc.length > 10 || recentUserText.length > 30;

		if (hasConceptInfo && phase !== 'greeting' && phase !== 'persona') {
			try {
				// #53/#54: OPENROUTER_URL and headers from shared aiConfig
				const analyzeResponse = await fetch(OPENROUTER_URL, {
					method: 'POST',
					headers: openRouterHeaders(OPENROUTER_KEY),
					body: JSON.stringify({
						model: 'anthropic/claude-sonnet-4',
						messages: [
							{
								role: 'system',
								content: `You are a commercial real estate analyst. Analyze this business concept and return ONLY valid JSON with: closestPersona (one of: coffee_shop, restaurant, florist, barbershop, spa_wellness, fitness, retail, medical_dental), businessCategory (short name), financialBenchmarks ({avgTicketRange, dailyCustomerRange, rentToRevenueMax, buildoutPerSqft, monthsToBreakeven}), locationFactors ({critical: [], important: [], niceToHave: []}), commonMistakes ([{mistake, why, whatToDo}]). Be NYC-specific and data-driven.`
							},
							{
								role: 'user',
								content: `Business: ${conceptName || 'Custom concept'}. Description: ${conceptDesc || recentUserText}. Location: NYC.`
							}
						],
						temperature: 0.3,
						max_tokens: 1500
					})
				});

				if (analyzeResponse.ok) {
					const analyzeResult = await analyzeResponse.json();
					const analyzeContent = analyzeResult.choices?.[0]?.message?.content || '';
					const cleaned = analyzeContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
					try {
						conceptAnalysis = JSON.parse(cleaned);
						// Try to load coaching data for the closest matching persona
						const closestKey = (conceptAnalysis?.closestPersona as string) || '';
						const closestCoaching = getPersonaCoaching(closestKey);
						if (closestCoaching) {
							coachingData = closestCoaching;
						}
					} catch { /* use fallback */ }
				}
			} catch (err) {
				console.error('[OnboardingChat] Concept analysis failed:', err);
			}
		}
	}

	// Build system prompt — inject concept analysis if available
	let systemPrompt: string;
	if (coachingData) {
		systemPrompt = buildOnboardingSystemPrompt(personaKey, coachingData, phase, extractedData as any);
	} else {
		systemPrompt = buildFallbackSystemPrompt(tier);
	}

	// Inject returning-user context when starting a new concept
	if (isNewConcept && messages.length === 0) {
		systemPrompt += `\n\n## RETURNING USER — NEW CONCEPT
This is a returning user who already went through onboarding before.
- Welcome them back in ONE short sentence.
- Ask them to share the new concept AND drop an address if they have one — you'll score it right away.
- Also mention they can answer a few quick questions to build out a plan if they prefer.
- 2-3 sentences max. Be direct.`;
	}

	// Append concept analysis context for "Something Else" personas
	if (conceptAnalysis) {
		const ca = conceptAnalysis as Record<string, any>;
		systemPrompt += `\n\n## Custom Concept Analysis (from Sonnet)
Business Category: ${ca.businessCategory || 'Unknown'}
Closest Standard Persona: ${ca.closestPersona || 'retail'}
${ca.financialBenchmarks ? `Financial Benchmarks: Avg ticket ${ca.financialBenchmarks.avgTicketRange}, daily customers ${ca.financialBenchmarks.dailyCustomerRange}, rent-to-revenue max ${ca.financialBenchmarks.rentToRevenueMax}, buildout ${ca.financialBenchmarks.buildoutPerSqft}/sqft, breakeven ${ca.financialBenchmarks.monthsToBreakeven}` : ''}
${ca.locationFactors?.critical ? `Critical Location Factors: ${ca.locationFactors.critical.join(', ')}` : ''}
${ca.commonMistakes ? `Common Mistakes: ${ca.commonMistakes.map((m: any) => m.mistake).join('; ')}` : ''}

Use this analysis to give specific, data-backed coaching for this custom business type. Reference these benchmarks naturally in conversation.`;
	}

	// If no API key, return a template response
	if (!OPENROUTER_KEY) {
		const templateResponse = getTemplateResponse(messages, sessionContext);
		return new Response(JSON.stringify(templateResponse), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		// #53/#54: OPENROUTER_URL and headers from shared aiConfig
		const response = await fetch(OPENROUTER_URL, {
			method: 'POST',
			headers: openRouterHeaders(OPENROUTER_KEY),
			body: JSON.stringify({
				model,
				messages: [
					{ role: 'system', content: systemPrompt },
					...messages
				],
				...params,
				stream: false
			})
		});

		if (!response.ok) {
			console.error('OpenRouter error:', response.status);
			const templateResponse = getTemplateResponse(messages, sessionContext);
			return new Response(JSON.stringify(templateResponse), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content || '';

		// Parse the response: split visible text from hidden metadata JSON
		const { visibleText, metadata } = parseAIResponse(content);

		return new Response(JSON.stringify({
			message: visibleText,
			metadata
		}), {
			headers: { 'Content-Type': 'application/json' }
		});

	} catch (err) {
		console.error('Onboarding chat error:', err);
		const templateResponse = getTemplateResponse(messages, sessionContext);
		return new Response(JSON.stringify(templateResponse), {
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

/**
 * Fallback system prompt when no persona coaching data is available.
 * Used for 'something_else' or unknown persona types.
 */
function buildFallbackSystemPrompt(tier?: string): string {
	let prompt = `You are RE²'s location intelligence coach — a retail location expert who talks via iMessage-style chat.

YOUR PERSONALITY: Warm but direct. Like a busy mentor who genuinely cares but doesn't waste anyone's time.

BREVITY IS LAW:
- Maximum 3 sentences of visible text. No exceptions.
- NEVER use markdown, headers, bullet points, or lists. Plain conversational text only.
- This is iMessage, not an email. Keep it punchy.

CONVERSATION FLOW — TWO PATHS:

Your FIRST message must ask for their concept AND a location in one warm sentence. Also mention they can answer a few more questions if they want help building out a plan.

PATH A — FAST TRACK: If they give concept + address, acknowledge with one quick insight, then move to scoring. 2-3 total exchanges.
PATH B — DEEP DIVE: If they want guidance, walk through concept → customers → financials → address. 5-6 exchanges max.

CRITICAL: Do NOT force Path B on someone ready for Path A.

NO CHIT-CHAT:
- Do NOT ask how they're doing or make small talk.
- After the greeting, every message must MOVE FORWARD.
- If they give you info, acknowledge in ≤5 words and ask the next thing you need.

MEMORY IS LAW:
- NEVER re-ask for information already provided.
- NEVER repeat the same response pattern twice.

COACHING RULES:
- NEVER ask what you can infer. Present inferences as defaults.
- Specificity over generality. Name numbers, neighborhoods, failure modes.
- When you have concept + address, move to scoring. Don't stall.`;

	if (tier === 'haiku') {
		prompt += '\n\n2 sentences max. Acknowledge + next question.';
	} else if (tier === 'opus') {
		prompt += '\n\nYou may use up to 4 sentences for deep analysis. Cross-reference concept, customers, financials, location. Be revelatory but concise.';
	}

	prompt += `

CRITICAL: After your visible response, append a metadata block:
<metadata>
{"extracted":{"personaType":null,"conceptName":null,"conceptDescription":null,"targetCustomers":[],"differentiators":[],"financialEstimates":null,"readyForAddress":false},"conversationPhase":"concept","scoringHints":{}}
</metadata>

Update fields as you learn. Set "readyForAddress" to true when ready.

CRITICAL PHASE RULES — conversationPhase must be EXACTLY one of these strings (no variations, no custom names):
"greeting" | "concept" | "customers" | "financials" | "address" | "scoring"

When the user has provided BOTH a business concept AND a street address, you MUST set conversationPhase to exactly "scoring". Not "PATH_A_SCORING", not "complete", not "scoring_detailed" — the exact string "scoring".`;

	return prompt;
}

function normalizePhase(metadata: Record<string, unknown>): Record<string, unknown> {
	const phase = String(metadata.conversationPhase || '').toLowerCase();
	// If the AI used any variation containing "scor" or "complete", normalize to "scoring"
	if (phase.includes('scor') || phase === 'complete' || phase.includes('path_a')) {
		metadata.conversationPhase = 'scoring';
	}
	// Validate phase is one of the allowed values
	const validPhases = ['greeting', 'concept', 'customers', 'financials', 'address', 'scoring'];
	if (!validPhases.includes(metadata.conversationPhase as string)) {
		// Default to concept if unrecognized
		metadata.conversationPhase = 'concept';
	}
	return metadata;
}

function parseAIResponse(content: string): { visibleText: string; metadata: Record<string, unknown> | null } {
	let visibleText = content;
	let metadata: Record<string, unknown> | null = null;

	// Try <<<METADATA>>>...<<<END>>> format (fallback prompt)
	const tripleMatch = content.match(/<<<METADATA>>>([\s\S]*?)<<<END>>>/);
	if (tripleMatch) {
		visibleText = content.replace(/<<<METADATA>>>[\s\S]*?<<<END>>>/, '').trim();
		try {
			metadata = normalizePhase(JSON.parse(tripleMatch[1].trim()));
		} catch { /* Failed to parse */ }
		return { visibleText, metadata };
	}

	// Try <metadata>...</metadata> format (main prompt-builder)
	const xmlMatch = content.match(/<metadata>([\s\S]*?)<\/metadata>/);
	if (xmlMatch) {
		visibleText = content.replace(/<metadata>[\s\S]*?<\/metadata>/, '').trim();
		try {
			metadata = normalizePhase(JSON.parse(xmlMatch[1].trim()));
		} catch { /* Failed to parse */ }
		return { visibleText, metadata };
	}

	// Try trailing JSON block (some models just append raw JSON)
	const trailingJsonMatch = content.match(/\n\s*(\{[\s\S]*"extracted"[\s\S]*\})\s*$/);
	if (trailingJsonMatch) {
		visibleText = content.replace(/\n\s*\{[\s\S]*"extracted"[\s\S]*\}\s*$/, '').trim();
		try {
			metadata = normalizePhase(JSON.parse(trailingJsonMatch[1].trim()));
		} catch { /* Failed to parse */ }
	}

	// Last resort: if metadata parsing failed but the raw content contains scoring signals,
	// build a minimal metadata object so the UI can still advance
	if (!metadata) {
		const raw = content.toLowerCase();
		const hasScoring = raw.includes('"conversationphase"') && (raw.includes('scoring') || raw.includes('path_a') || raw.includes('complete'));
		const hasAddress = /\d+\s+\w+\s+(st|street|ave|avenue|blvd|boulevard|rd|road|way|place|broadway)/i.test(content);
		if (hasScoring || hasAddress) {
			// Strip any visible metadata remnants from the response
			visibleText = visibleText
				.replace(/<metadata>[\s\S]*/i, '')
				.replace(/<<<METADATA>>>[\s\S]*/i, '')
				.replace(/\{\s*"extracted"[\s\S]*/i, '')
				.trim();
			metadata = { conversationPhase: 'scoring', extracted: {} };
		}
	}

	return { visibleText, metadata };
}

// Template responses when no API key
function getTemplateResponse(
	messages: ChatMessage[],
	sessionContext?: Record<string, unknown>
): { message: string; metadata: Record<string, unknown> } {
	const userMsgCount = messages.filter(m => m.role === 'user').length;
	const userMessages = messages.filter(m => m.role === 'user');
	const lastUserMsg = userMessages.pop()?.content?.toLowerCase() || '';
	const allUserText = userMessages.map(m => m.content).join(' ').toLowerCase();

	// Detect persona from ALL user messages, not just the last one
	let detectedPersona: string | null = (sessionContext?.extractedData as any)?.personaType || null;
	if (!detectedPersona) {
		const personaMap: Record<string, string> = {
			'coffee': 'coffee_shop', 'cafe': 'coffee_shop', 'café': 'coffee_shop', 'espresso': 'coffee_shop', 'matcha': 'coffee_shop', 'protein coffee': 'coffee_shop',
			'restaurant': 'restaurant', 'dining': 'restaurant', 'bar': 'restaurant', 'food': 'restaurant',
			'florist': 'florist', 'flower': 'florist',
			'dentist': 'medical_dental', 'dental': 'medical_dental', 'medical': 'medical_dental', 'doctor': 'medical_dental',
			'spa': 'spa_wellness', 'wellness': 'spa_wellness', 'nail': 'spa_wellness', 'salon': 'spa_wellness',
			'gym': 'fitness', 'fitness': 'fitness', 'yoga': 'fitness', 'crossfit': 'fitness', 'pilates': 'fitness',
			'barber': 'barbershop', 'grooming': 'barbershop',
			'boutique': 'retail', 'retail': 'retail', 'fashion': 'retail', 'shop': 'retail',
			'bakery': 'restaurant', 'pastry': 'restaurant'
		};
		const searchText = allUserText + ' ' + lastUserMsg;
		for (const [keyword, persona] of Object.entries(personaMap)) {
			if (searchText.includes(keyword)) {
				detectedPersona = persona;
				break;
			}
		}
	}

	// Detect if user has provided an address (look for street numbers, "st", "ave", etc.)
	const addressPattern = /\d+\s+\w+\s+(st|street|ave|avenue|blvd|boulevard|rd|road|way|pl|place|west|east|north|south|broadway|madison|park|lex)/i;
	const allText = allUserText + ' ' + lastUserMsg;
	const hasAddress = addressPattern.test(allText);
	const addressMatch = allText.match(addressPattern);

	// Detect if user has mentioned budget/rent
	const hasBudget = /\$[\d,]+k?|\d+k/i.test(allText);

	// Smart phase detection based on what we actually know
	let phase: string;
	let message: string;

	const isNewConcept = !!(sessionContext?.isNewConcept);

	if (userMsgCount === 0 && isNewConcept) {
		phase = 'concept';
		message = "Welcome back! Tell me the new concept and drop an address — I'll score it right away. Or if you want, I can walk you through a few quick questions to build out your plan first.";
	} else if (userMsgCount === 0) {
		phase = 'concept';
		message = "I'm your location coach. Tell me your concept and drop an address — I'll score it. Or if you want help building out your plan, I can walk you through a few quick questions first.";
	} else if (hasAddress && detectedPersona) {
		// Fast track — they gave us enough, move to scoring
		phase = 'scoring';
		message = "Got it — let me score that location for you.";
	} else if (userMsgCount === 1 && !hasAddress) {
		phase = 'customers';
		message = "Got it. Do you have an address in mind? Drop it and I'll score it now — or I can walk you through customers and financials first to sharpen the results.";
	} else if (userMsgCount === 2 && !hasBudget) {
		phase = 'financials';
		message = "What's your target rent budget? I'll back into the rest of the numbers from there.";
	} else if (hasAddress && hasBudget) {
		// User already gave us an address AND budget — move to scoring
		phase = 'scoring';
		message = "Got everything I need. Let me score that location for you.";
	} else if (hasAddress) {
		// User gave address but no budget
		phase = 'financials';
		message = `Good location. What rent range are you targeting? That'll help me tell you if the numbers work there.`;
	} else if (hasBudget) {
		// User gave budget but no address
		phase = 'address';
		message = `Got it on the budget. Now — do you have an address or neighborhood in mind? Even a cross-street works.`;
	} else if (userMsgCount >= 3) {
		// General fallback for later messages — don't repeat the address ask if we already have it
		phase = 'address';
		message = "We've got a solid picture of your concept. Drop an address or neighborhood and I'll tell you if the numbers work there.";
	} else {
		phase = 'concept';
		message = "Tell me more about what makes your concept different from what's already out there.";
	}

	return {
		message,
		metadata: {
			extracted: {
				personaType: detectedPersona,
				conceptName: null,
				conceptDescription: userMsgCount >= 1 ? lastUserMsg : null,
				targetCustomers: [],
				differentiators: [],
				financialEstimates: hasBudget ? {
					avgTicket: 8,
					dailyCustomers: 120,
					monthlyRevenue: [28000, 38000],
					maxRent: 6000,
					idealSqft: [800, 1200]
				} : null,
				readyForAddress: hasAddress && hasBudget
			},
			conversationPhase: phase,
			scoringHints: {}
		}
	};
}
