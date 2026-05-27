import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';
import { formatConcept } from '$lib/utils/conceptNames';
import {
	generateLocationNarrative,
	detectContradictions,
	generateBusinessPlan,
	generateCompareRecommendation,
	generateVisionAnchorResearch,
	generateFitImprovementRecs,
	generateNeighborhoodAttractiveness,
	generateBusinessCaseRecs,
	type Contradiction,
	type BusinessPlanData,
	type CompareAddress,
	type CompareResult,
	type VisionAnchorResearch,
	type FitImprovementRec,
	type NeighborhoodAttractiveness,
	type BusinessCaseRec,
	type FounderProfileInput,
	type IntelReportInput,
	type CategoryConfigInput
} from '$lib/ai/claude';

interface AIRequest {
	action: 'narrative' | 'contradictions' | 'business-plan' | 'compare' | 'vision-anchor' | 'fit-improvement' | 'neighborhood-attractiveness' | 'business-case-recs';
	intelReport?: IntelReportInput;
	founderProfile?: FounderProfileInput;
	scores?: { locationScore: number; alignmentScore: number };
	locationScore?: number;
	alignmentScore?: number;
	categoryConfig?: CategoryConfigInput;
	// compare action fields
	addresses?: CompareAddress[];
	conceptType?: string;
	conceptLabel?: string;
	// AI insight fields
	neighborhood?: string;
	borough?: string;
	differentiators?: string;
	targetClients?: string;
	competitors?: number;
	medianIncome?: number;
	fitIQ?: number;
	locationIQ?: number;
	visionIQ?: number;
	sixScores?: Record<string, number>;
	monthlyRent?: number;
	avgCheck?: number;
	transitScore?: number;
	demographicsScore?: number;
	vibrancyScore?: number;
	// business-case-recs fields
	address?: string;
	dailyCust?: number;
	cogsPct?: number;
	annualRevenue?: number;
	preTaxProfit?: number;
	marginPct?: number;
	rentToRevenuePct?: number;
	laborCost?: number;
	walkScore?: number;
	crimeScore?: number;
	foodProgram?: string;
	storeType?: string;
}

interface AIResponse<T = string | Contradiction[] | BusinessPlanData | CompareResult | VisionAnchorResearch | FitImprovementRec | NeighborhoodAttractiveness | BusinessCaseRec> {
	success: boolean;
	data?: T;
	error?: string;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const limited = rateLimit(request, RATE_LIMITS.ai);
	if (limited) return limited;

	// B2-T7: per-user hourly cap (10/hr) + site-wide monthly budget cap ($50).
	// Anon users key off the X-Session-Id header (or fall through if absent).
	try {
		const { checkAiBudget } = await import('$lib/ai/budget-guard');
		const sessionId = request.headers.get('X-Session-Id');
		const block = await checkAiBudget({ sessionId });
		if (block) return block;
	} catch { /* budget guard fails open */ }

	try {
		// ISS-01A fix: removed platform?.env check — that's Netlify Edge syntax only.
		// claude.ts reads OPENROUTER_API_KEY from $env/dynamic/private (standard SvelteKit).
		// If the key is missing, claude.ts throws and the catch block below returns a 500.

		const body = (await request.json()) as AIRequest;

		if (!body.action) {
			return json(
				{
					success: false,
					error: "Missing required 'action' field. Must be one of: 'narrative', 'contradictions', 'business-plan'"
				} as AIResponse,
				{ status: 400 }
			);
		}

		// Normalize scores from either format
		const scores = body.scores || {
			locationScore: body.locationScore || 0,
			alignmentScore: body.alignmentScore || 0
		};

		let result: string | Contradiction[] | BusinessPlanData | CompareResult | VisionAnchorResearch | FitImprovementRec | NeighborhoodAttractiveness | BusinessCaseRec;

		switch (body.action) {
			case 'narrative': {
				if (!body.intelReport || !body.founderProfile || !body.categoryConfig) {
					return json(
						{
							success: false,
							error: "Missing required fields for 'narrative': intelReport, founderProfile, categoryConfig"
						} as AIResponse,
						{ status: 400 }
					);
				}

				result = await generateLocationNarrative(
					body.intelReport,
					body.founderProfile,
					scores.locationScore,
					scores.alignmentScore,
					body.categoryConfig
				);
				break;
			}

			case 'contradictions': {
				if (!body.founderProfile || !body.intelReport) {
					return json(
						{
							success: false,
							error: "Missing required fields for 'contradictions': founderProfile, intelReport"
						} as AIResponse,
						{ status: 400 }
					);
				}

				result = await detectContradictions(
					body.founderProfile,
					body.intelReport,
					scores.locationScore,
					scores.alignmentScore
				);
				break;
			}

			case 'business-plan': {
				if (!body.founderProfile || !body.intelReport || !body.categoryConfig) {
					return json(
						{
							success: false,
							error: "Missing required fields for 'business-plan': founderProfile, intelReport, categoryConfig"
						} as AIResponse,
						{ status: 400 }
					);
				}

				result = await generateBusinessPlan(
					body.founderProfile,
					body.intelReport,
					scores,
					body.categoryConfig
				);
				break;
			}

			case 'compare': {
			if (!body.addresses || body.addresses.length < 2) {
				return json({ success: false, error: "Missing 'addresses' for compare action — requires 2-5 address objects" } as AIResponse, { status: 400 });
			}
			if (body.addresses.length > 5) {
				return json({ success: false, error: "compare action supports a maximum of 5 addresses" } as AIResponse, { status: 400 });
			}
			const conceptType = body.conceptType || 'specialty_coffee';
			const conceptLabel = body.conceptLabel || formatConcept(conceptType);
			result = await generateCompareRecommendation(body.addresses, conceptType, conceptLabel);
			break;
		}

		case 'vision-anchor': {
				const concept = body.conceptType || 'specialty_coffee';
				const label = body.conceptLabel || formatConcept(concept);
				result = await generateVisionAnchorResearch(
					concept, label,
					body.neighborhood || '', body.borough || '',
					body.differentiators || '', body.targetClients || '',
					body.competitors || 0, body.medianIncome || 0
				);
				break;
			}

			case 'fit-improvement': {
				const concept = body.conceptType || 'specialty_coffee';
				const label = body.conceptLabel || formatConcept(concept);
				result = await generateFitImprovementRecs(
					concept, label,
					body.neighborhood || '', body.borough || '',
					body.fitIQ || 0, body.locationIQ || 0, body.visionIQ || 0,
					body.sixScores || {}, body.monthlyRent || 0, body.avgCheck || 0,
					body.competitors || 0, body.differentiators || '',
					body.medianIncome || 0
				);
				break;
			}

			case 'neighborhood-attractiveness': {
				const concept = body.conceptType || 'specialty_coffee';
				const label = body.conceptLabel || formatConcept(concept);
				result = await generateNeighborhoodAttractiveness(
					concept, label,
					body.borough || 'Manhattan', body.neighborhood || '',
					body.locationIQ || 0, body.fitIQ || 0,
					body.transitScore || 0, body.demographicsScore || 0,
					body.vibrancyScore || 0, body.medianIncome || 0
				);
				break;
			}

			case 'business-case-recs': {
				const concept = body.conceptType || 'specialty_coffee';
				const label = body.conceptLabel || formatConcept(concept);
				result = await generateBusinessCaseRecs(
					concept, label,
					body.neighborhood || '', body.borough || '',
					body.address || '',
					body.locationIQ || 0, body.fitIQ || 0, body.visionIQ || 0,
					body.sixScores || {},
					body.dailyCust || 0, body.avgCheck || 0,
					body.annualRevenue || 0, body.monthlyRent || 0,
					body.cogsPct || 0, body.laborCost || 0,
					body.preTaxProfit || 0, body.marginPct || 0,
					body.rentToRevenuePct || 0,
					body.medianIncome || 0, body.walkScore || 0,
					body.competitors || 0, body.crimeScore || 0,
					body.differentiators || '', body.targetClients || '',
					body.foodProgram || '', body.storeType || ''
				);
				break;
			}

			default: {
				return json(
					{
						success: false,
						error: `Invalid action '${body.action}'. Must be one of: 'narrative', 'contradictions', 'business-plan', 'compare', 'vision-anchor', 'fit-improvement', 'neighborhood-attractiveness', 'business-case-recs'`
					} as AIResponse,
					{ status: 400 }
				);
			}
	}

		return json(
			{
				success: true,
				data: result
			} as AIResponse,
			{ status: 200 }
		);
	} catch (error) {
		console.error('API error:', error);

		const errorMessage =
			error instanceof Error ? error.message : 'An unexpected error occurred';

		return json(
			{
				success: false,
				error: errorMessage
			} as AIResponse,
			{ status: 500 }
		);
	}
};
