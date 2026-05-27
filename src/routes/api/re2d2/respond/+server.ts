/**
 * RE2D2 Onboarding Bot — Thread 6B
 *
 * POST /api/re2d2/respond
 *
 * Powers the conversational onboarding flow. Mostly a STATE MACHINE —
 * the 10 questions are scripted. The LLM (Haiku via OpenRouter) is used
 * ONLY for warm, natural acknowledgment responses between questions.
 *
 * State machine: step N answer → acknowledgment → step N+1 question
 */

import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/auth-middleware';
import { generateResponse } from '$lib/openrouter-llm';
import { getServiceSupabase } from '$lib/supabase-server';
import { addressToGeoidWithCandidates, type GeocodeResult, type AddressCandidate } from '$lib/geocode-bridge';

// ── Types ──

interface RE2D2Request {
	step: number;
	answer: string;
	context: Record<string, string | undefined>;
}

interface RE2D2Response {
	acknowledgment: string;
	nextQuestion: string;
	nextStep: number;
	chips?: string[];
	inputType: 'chips' | 'text' | 'address' | 'number';
	fitProgress: number;
	canScore: boolean;
	/** Set when the address (step 5) resolves to a block group */
	geocode?: {
		geoid: string;
		lat: number;
		lng: number;
		borough: string;
		matchedAddress: string;
		confidence: string;
		/** L2: true when multiple NYC boroughs match the same street name */
		ambiguous?: boolean;
		/** L2: candidate addresses per borough for disambiguation UI */
		candidates?: AddressCandidate[];
	};
}

// ── Scripted Questions (State Machine) ──

interface QuestionDef {
	key: string;             // Context key to store the answer
	question: string;
	inputType: 'chips' | 'text' | 'address' | 'number';
	chips?: string[];
}

const QUESTIONS: QuestionDef[] = [
	// Step 1
	{
		key: 'businessType',
		question: "What type of business are you looking to open?",
		inputType: 'chips',
		chips: [
			'Coffee Shop / Café', 'Restaurant', 'Fast Casual', 'Bar / Lounge',
			'Bakery', 'Retail Store', 'Fitness / Gym', 'Spa / Wellness',
			'Tutoring Center', 'Medical / Dental', 'Boutique', 'Grocery',
			'Laundromat', 'Deli', 'Other',
		],
	},
	// Step 2
	{
		key: 'vision',
		question: "Tell me about your vision. What makes your concept unique?",
		inputType: 'text',
	},
	// Step 3
	{
		key: 'budget',
		question: "What's your rough startup budget?",
		inputType: 'chips',
		chips: ['Under $50K', '$50K–$100K', '$100K–$250K', '$250K–$500K', '$500K+'],
	},
	// Step 4
	{
		key: 'rent',
		question: "What monthly rent can you handle?",
		inputType: 'chips',
		chips: ['Under $3K', '$3K–$5K', '$5K–$8K', '$8K–$12K', '$12K–$20K', '$20K+'],
	},
	// Step 5
	{
		key: 'address',
		question: "Do you have a specific location in mind? Drop an address or neighborhood.",
		inputType: 'address',
	},
	// Step 6
	{
		key: 'ownerType',
		question: "What's your ownership situation?",
		inputType: 'chips',
		chips: ['Solo founder', 'Partnership', 'Family business', 'Franchise', 'Investor-backed'],
	},
	// Step 7
	{
		key: 'riskTolerance',
		question: "How would you describe your risk tolerance?",
		inputType: 'chips',
		chips: ['Conservative — I want a sure thing', 'Moderate — calculated risks', 'Aggressive — high risk, high reward'],
	},
	// Step 8
	{
		key: 'experience',
		question: "What's your experience level in this industry?",
		inputType: 'chips',
		chips: ['First-time owner', '1–3 years', '3–5 years', '5–10 years', '10+ years / Serial entrepreneur'],
	},
	// Step 9
	{
		key: 'targetCustomer',
		question: "Who is your ideal customer?",
		inputType: 'text',
	},
	// Step 10
	{
		key: 'hours',
		question: "What hours do you plan to operate?",
		inputType: 'chips',
		chips: ['Early morning (5–11 AM)', 'Daytime (9–5)', 'Evening (5–11 PM)', 'Late night (9 PM–3 AM)', 'All day', 'Weekends only'],
	},
];

// ── Acknowledgment Templates (fast fallback if LLM is unavailable) ──

const ACK_TEMPLATES: Record<string, string[]> = {
	businessType: [
		"Great choice! {answer} is one of the most exciting categories in NYC right now.",
		"Love it — {answer} has real potential in the right location.",
		"Nice! {answer} is a strong category. Let's find the perfect spot.",
	],
	vision: [
		"That's a compelling vision. The specificity will help us match you to the right neighborhood.",
		"I can see that working. Let's make sure the location matches the ambition.",
	],
	budget: [
		"Got it — {answer} gives us a clear range to work with.",
		"Good to know. {answer} opens up some solid options in NYC.",
	],
	rent: [
		"Noted — {answer} per month. We'll factor that into every location we analyze.",
		"{answer}/month — that's a healthy range for several NYC neighborhoods.",
	],
	address: [
		"Interesting area! Let me see what the data says about that location.",
		"Got it — we'll analyze that area and compare it to alternatives.",
	],
	ownerType: [
		"{answer} — that affects staffing costs and operating structure. Noted.",
		"Got it, {answer}. That's useful for modeling your break-even.",
	],
	riskTolerance: [
		"Understood — {answer}. We'll weight the scores accordingly.",
		"{answer} — that changes how we evaluate competition and safety.",
	],
	experience: [
		"{answer} — your experience level factors into our difficulty assessments.",
		"Noted! {answer} means we can adjust our recommendations accordingly.",
	],
	targetCustomer: [
		"Great — knowing your target customer helps us match demographics.",
		"That's specific. We'll check if the neighborhood demographics align.",
	],
	hours: [
		"{answer} — that impacts transit scores and foot traffic relevance.",
		"Got it — {answer}. We'll factor peak-hour foot traffic into your score.",
	],
};

function pickTemplate(key: string, answer: string): string {
	const templates = ACK_TEMPLATES[key] || ["Got it — noted!"];
	const tpl = templates[Math.floor(Math.random() * templates.length)];
	return tpl.replace('{answer}', answer);
}

// ── Fit Progress ──

function computeFitProgress(context: Record<string, string | undefined>): number {
	const keys = ['businessType', 'vision', 'budget', 'rent', 'address',
		'ownerType', 'riskTolerance', 'experience', 'targetCustomer', 'hours'];
	let filled = 0;
	for (const k of keys) {
		if (context[k] && String(context[k]).trim()) filled++;
	}
	return Math.round(filled / keys.length * 100);
}

// ── LLM Acknowledgment ──

const ACK_SYSTEM_PROMPT = `You are RE2D2, the friendly onboarding assistant for RE² (RE-Squared), a location intelligence platform for small business owners in NYC.

Your job: respond with a warm, encouraging 1-sentence acknowledgment of the user's answer. Be specific to what they said. Sound like a knowledgeable friend, not a corporate chatbot.

Rules:
- ONE sentence only. Max 30 words.
- Reference their specific answer (don't be generic).
- Be warm but not over-the-top. No exclamation marks overload.
- No questions in the acknowledgment (the next question is handled separately).
- Never say "Great choice!" — be more creative.`;

async function generateAcknowledgment(
	key: string,
	answer: string,
	context: Record<string, string | undefined>
): Promise<string> {
	try {
		const contextStr = Object.entries(context)
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ');

		const userMsg = `The user is setting up their business profile. They just answered the "${key}" question with: "${answer}".${contextStr ? ` What we know so far: ${contextStr}` : ''}

Write a warm 1-sentence acknowledgment.`;

		const response = await generateResponse('haiku', ACK_SYSTEM_PROMPT, userMsg, 60);
		if (response && response.length > 10 && response.length < 200) {
			return response.trim();
		}
	} catch (err) {
		console.warn('[RE2D2] LLM acknowledgment failed, using template:', err instanceof Error ? err.message : err);
	}

	// Fallback to template
	return pickTemplate(key, answer);
}

// ── Save to Supabase ──

async function saveToFounderSession(
	userId: string,
	step: number,
	answer: string,
	context: Record<string, string | undefined>
): Promise<void> {
	try {
		const supabase = getServiceSupabase();
		await supabase.from('founder_sessions').upsert({
			user_id: userId,
			current_step: step,
			answers: context,
			last_answer: answer,
			updated_at: new Date().toISOString(),
		}, { onConflict: 'user_id' });
	} catch (err) {
		// Non-critical — don't fail the request
		console.warn('[RE2D2] Failed to save session:', err instanceof Error ? err.message : err);
	}
}

// ── Handler ──

export const POST: RequestHandler = async ({ request }) => {
	// ── Auth ──
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;

	try {
		const body = (await request.json()) as RE2D2Request;

		// ── Validation ──
		const step = body.step;
		if (typeof step !== 'number' || step < 1 || step > 10) {
			return new Response(JSON.stringify({
				error: 'Invalid step. Must be 1-10.',
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		if (!body.answer || typeof body.answer !== 'string') {
			return new Response(JSON.stringify({
				error: 'Missing answer',
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		const answer = body.answer.trim().slice(0, 1000); // Limit answer length
		const context = body.context || {};
		const currentQ = QUESTIONS[step - 1];

		if (!currentQ) {
			return new Response(JSON.stringify({
				error: `No question defined for step ${step}`,
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		// Store the answer in context
		context[currentQ.key] = answer;

		// ── Geocode address (step 5) — BLOCKER Gap #1 ──
		// When the user provides an address, resolve it to a GEOID immediately.
		// This unlocks all block-group-level data for scoring and copilots.
		let geocode: RE2D2Response['geocode'] = undefined;
		if (currentQ.key === 'address' && answer.length > 5) {
			try {
				// L2: use ambiguity-aware resolver — same as addressToGeoid but also
			// detects multi-borough matches and populates candidates[] for the UI.
			const geoResult = await addressToGeoidWithCandidates(answer);
				if (geoResult) {
					geocode = {
						geoid: geoResult.geoid,
						lat: geoResult.lat,
						lng: geoResult.lng,
						borough: geoResult.borough,
						matchedAddress: geoResult.matchedAddress,
						confidence: geoResult.confidence,
						// L2: surface ambiguity to the client
						ambiguous: geoResult.ambiguous ?? false,
						candidates: geoResult.candidates ?? [],
					};
					// Persist geoid + coordinates in context for downstream use
					context._geoid = geoResult.geoid;
					context._lat = String(geoResult.lat);
					context._lng = String(geoResult.lng);
					context._borough = geoResult.borough;
				}
			} catch (err) {
				console.warn('[RE2D2] Geocode failed (non-blocking):', err instanceof Error ? err.message : err);
				// Non-blocking — onboarding continues even if geocoding fails
			}
		}

		// ── Generate acknowledgment (LLM or fallback) ──
		// If we geocoded the address, include the borough in the ack context
		let ackAnswer = answer;
		if (geocode) {
			ackAnswer = `${answer} (resolved to ${geocode.borough}, block group ${geocode.geoid})`;
		}
		const acknowledgment = await generateAcknowledgment(currentQ.key, ackAnswer, context);

		// ── Determine next step ──
		const nextStep = step < 10 ? step + 1 : 10;
		const isComplete = step >= 10;
		const nextQ = isComplete ? null : QUESTIONS[nextStep - 1];

		// ── Compute fit progress ──
		const fitProgress = computeFitProgress(context);
		const canScore = step >= 5; // After step 5, enough data for Location IQ

		// ── Save to Supabase (fire-and-forget) ──
		saveToFounderSession(auth.userId, step, answer, context);

		// ── Build response ──
		const response: RE2D2Response = {
			acknowledgment,
			nextQuestion: isComplete
				? "You're all set! Your profile is complete. Ready to explore locations?"
				: nextQ!.question,
			nextStep: isComplete ? -1 : nextStep,
			chips: isComplete ? ['Show me locations', 'Review my profile'] : nextQ!.chips,
			inputType: isComplete ? 'chips' : nextQ!.inputType,
			fitProgress,
			canScore,
			geocode,
		};

		return new Response(JSON.stringify(response), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

	} catch (err) {
		console.error('[RE2D2] Error:', err);
		return new Response(JSON.stringify({
			error: 'RE2D2 encountered an error',
			message: err instanceof Error ? err.message : 'Unknown error',
		}), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
};
