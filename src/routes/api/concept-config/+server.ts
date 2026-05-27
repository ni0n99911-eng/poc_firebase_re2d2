/**
 * Concept Config API endpoint.
 *
 * GET /api/concept-config?type=specialty_coffee
 *   → Returns concept-specific questions + max score impact
 *
 * POST /api/concept-config
 *   { conceptType: "specialty_coffee", answers: { coffee_price: "premium", coffee_format: "roastery" } }
 *   → Returns the built dynamic config with all overrides applied
 *
 * Used by the UI to show targeted questions per business type and
 * to build the config that feeds into Fit IQ scoring.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/auth-middleware';
import {
	getQuestionsForConcept,
	buildDynamicConfig,
	estimateMaxImpact,
	getSupportedConcepts,
} from '$lib/intel/dynamic-concept-config';

// ── GET: Return questions for a concept type ──

export const GET: RequestHandler = async ({ url, request }) => {
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;

	const conceptType = url.searchParams.get('type');

	// No type = return all supported concepts with their question counts + max impacts
	if (!conceptType) {
		const concepts = getSupportedConcepts().map(type => ({
			type,
			questionCount: getQuestionsForConcept(type).length,
			maxImpact: estimateMaxImpact(type),
		}));

		return new Response(JSON.stringify({ concepts }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=3600',
			},
		});
	}

	const questions = getQuestionsForConcept(conceptType);
	if (questions.length === 0) {
		return new Response(JSON.stringify({
			error: `No questions configured for concept type: ${conceptType}`,
			supported: getSupportedConcepts(),
		}), { status: 400, headers: { 'Content-Type': 'application/json' } });
	}

	return new Response(JSON.stringify({
		conceptType,
		questions,
		maxImpact: estimateMaxImpact(conceptType),
		questionCount: questions.length,
	}), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=3600',
		},
	});
};

// ── POST: Build config from answers ──

interface ConceptConfigRequest {
	conceptType: string;
	answers: Record<string, string>;
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;

	try {
		const body = (await request.json()) as ConceptConfigRequest;

		if (!body.conceptType) {
			return new Response(JSON.stringify({
				error: 'Missing conceptType',
				usage: 'POST /api/concept-config with { conceptType: "specialty_coffee", answers: { coffee_price: "premium" } }',
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		if (!body.answers || typeof body.answers !== 'object') {
			return new Response(JSON.stringify({
				error: 'Missing or invalid answers — must be an object of { questionId: selectedValue }',
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		const config = buildDynamicConfig(body.conceptType, body.answers);
		const questions = getQuestionsForConcept(body.conceptType);

		// Calculate which questions were answered and their individual impacts
		const answeredQuestions = questions
			.filter(q => body.answers[q.id])
			.map(q => ({
				id: q.id,
				question: q.question,
				answered: body.answers[q.id],
				maxImpact: q.maxImpact,
			}));

		return new Response(JSON.stringify({
			conceptType: body.conceptType,
			config,
			answeredQuestions,
			totalQuestionsAvailable: questions.length,
			totalQuestionsAnswered: answeredQuestions.length,
			estimatedMaxImpact: estimateMaxImpact(body.conceptType),
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err) {
		console.error('[ConceptConfig] Build error:', err);
		return new Response(JSON.stringify({
			error: 'Failed to build concept config',
			message: err instanceof Error ? err.message : 'Unknown error',
		}), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
};
