import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getOperationsConfig } from '$lib/operations-data';
import { env } from '$env/dynamic/private';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface GenerateRequest {
	type: 'handbook' | 'sop';
	businessType: string;
	city: string;
	state: string;
	businessName: string;
	visionStatement?: string;
	operatingHours?: string;
	staffingModel?: string;
	laborBudget?: number;
	sqft?: number;
	seatingCapacity?: number;
}

async function callClaudeAPI(
	systemPrompt: string,
	userMessage: string
): Promise<string> {
	if (!env.OPENROUTER_API_KEY) {
		throw new Error('OPENROUTER_API_KEY is not set');
	}

	const response = await fetch(OPENROUTER_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
			'HTTP-Referer': 'https://resquared.io',
			'X-Title': 'RE² Operations Generator'
		},
		body: JSON.stringify({
			model: 'anthropic/claude-sonnet-4',
			max_tokens: 4096,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMessage }
			],
			stream: false
		})
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			`OpenRouter API error (${response.status}): ${(errorData as Record<string, Record<string, string>>).error?.message || 'Unknown error'}`
		);
	}

	const data = await response.json();
	const content = data.choices?.[0]?.message?.content;

	if (!content) {
		throw new Error('Unexpected response format from OpenRouter API');
	}

	return content;
}

async function generateHandbook(request: GenerateRequest) {
	const config = getOperationsConfig(
		request.businessType,
		request.city,
		request.state,
		request.businessName,
		request.visionStatement,
		request.operatingHours,
		request.staffingModel,
		request.laborBudget,
		request.sqft,
		request.seatingCapacity
	);

	const sections: Record<string, string> = {};

	for (const section of config.handbookSections) {
		const systemPrompt = `You are an expert HR consultant writing a professional employee handbook section for a ${config.businessType} business.
Write clear, comprehensive, and legally-compliant content for the "${section.title}" section.
Keep the tone professional but approachable. Use bullet points and numbered lists where appropriate.
Include specific examples relevant to a ${config.businessType} in ${config.city}, ${config.state}.
`;

		const userMessage = `
Write the "${section.title}" section for an employee handbook for:
- Business: ${config.businessName}
- Type: ${config.businessType}
- Location: ${config.city}, ${config.state}
${config.visionStatement ? `- Vision: ${config.visionStatement}` : ''}
${config.operatingHours ? `- Operating Hours: ${config.operatingHours}` : ''}
${config.staffingModel ? `- Staffing Model: ${config.staffingModel}` : ''}

Make this section about 300-500 words and ensure it covers all relevant policies and procedures for this type of business in this location.
Include any NYC/NYS specific requirements if applicable.
`;

		try {
			const content = await callClaudeAPI(systemPrompt, userMessage);
			sections[section.id] = content;
		} catch (e) {
			console.error(`Error generating section ${section.id}:`, e);
			sections[section.id] = `[Section ${section.title} - Content generation in progress]`;
		}
	}

	return {
		businessName: config.businessName,
		businessType: config.businessType,
		city: config.city,
		state: config.state,
		sections,
		generatedAt: new Date().toISOString(),
		compliananceRules: config.complianceRules.map(r => ({
			id: r.id,
			jurisdiction: r.jurisdiction,
			description: r.description
		}))
	};
}

async function generateSOP(request: GenerateRequest) {
	const config = getOperationsConfig(
		request.businessType,
		request.city,
		request.state,
		request.businessName,
		request.visionStatement,
		request.operatingHours,
		request.staffingModel,
		request.laborBudget,
		request.sqft,
		request.seatingCapacity
	);

	const allSOPs = [...config.universalSOPs, ...config.verticalSOPs];
	interface GeneratedSOP {
		id: string;
		title: string;
		category: string;
		frequency: string;
		responsibleRole: string;
		detailedSteps: string;
	}
	const generatedSOPs: GeneratedSOP[] = [];

	for (const sop of allSOPs) {
		const systemPrompt = `You are an operations expert creating detailed Standard Operating Procedures (SOPs) for a ${config.businessType} business.
Write clear, step-by-step instructions that any team member can follow.
Make the SOP specific to the business context: ${config.businessName} in ${config.city}, ${config.state}.
Include safety considerations, quality standards, and compliance requirements where relevant.
`;

		const userMessage = `
Create a detailed SOP for: "${sop.title}"
Category: ${sop.category}
Frequency: ${sop.frequency}
Responsible Role: ${sop.responsibleRole}

Business Context:
- Name: ${config.businessName}
- Type: ${config.businessType}
- Location: ${config.city}, ${config.state}
${config.operatingHours ? `- Hours: ${config.operatingHours}` : ''}
${config.staffingModel ? `- Staffing: ${config.staffingModel}` : ''}

Expand the basic steps into detailed procedures with:
1. Pre-conditions and setup required
2. Step-by-step instructions (minimum 8-12 detailed steps)
3. Quality checks and verification
4. Common issues and solutions
5. Cleanup and closeout procedures
6. Documentation and record-keeping

Make it practical and implementable by your team.
`;

		try {
			const content = await callClaudeAPI(systemPrompt, userMessage);
			generatedSOPs.push({
				id: sop.id,
				title: sop.title,
				category: sop.category,
				frequency: sop.frequency,
				responsibleRole: sop.responsibleRole,
				detailedSteps: content
			});
		} catch (e) {
			console.error(`Error generating SOP ${sop.id}:`, e);
			generatedSOPs.push({
				id: sop.id,
				title: sop.title,
				category: sop.category,
				frequency: sop.frequency,
				responsibleRole: sop.responsibleRole,
				detailedSteps: sop.steps.join('\n')
			});
		}
	}

	return {
		businessName: config.businessName,
		businessType: config.businessType,
		city: config.city,
		state: config.state,
		totalSOPs: generatedSOPs.length,
		universalCount: config.universalSOPs.length,
		verticalCount: config.verticalSOPs.length,
		sops: generatedSOPs,
		generatedAt: new Date().toISOString(),
		complianceRules: config.complianceRules
	};
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as GenerateRequest;

		if (!body.type || !['handbook', 'sop'].includes(body.type)) {
			return json(
				{ success: false, error: "Missing or invalid 'type' field (must be 'handbook' or 'sop')" },
				{ status: 400 }
			);
		}

		if (!body.businessType || !body.city || !body.state || !body.businessName) {
			return json(
				{ success: false, error: 'Missing required fields: businessType, city, state, businessName' },
				{ status: 400 }
			);
		}

		if (!env.OPENROUTER_API_KEY) {
			return json(
				{ success: false, error: 'OPENROUTER_API_KEY is not configured' },
				{ status: 500 }
			);
		}

		let result;

		if (body.type === 'handbook') {
			result = await generateHandbook(body);
		} else {
			result = await generateSOP(body);
		}

		return json({ success: true, data: result });
	} catch (error) {
		console.error('Error in generate-operations:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return json(
			{ success: false, error: errorMessage },
			{ status: 500 }
		);
	}
};
