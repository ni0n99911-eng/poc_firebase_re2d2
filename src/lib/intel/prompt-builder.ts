/**
 * src/lib/intel/prompt-builder.ts
 *
 * Builds dynamic system prompts for the RE² onboarding coach.
 * Assembles persona-specific knowledge, benchmarks, extracted founder data,
 * and phase-specific coaching into context-aware prompts.
 */

import personaCoachingData from '$lib/intel/persona-coaching.json';

/**
 * Represents a common mistake a founder might make
 * Can be a string (current format) or an object with structured fields
 */
export type CommonMistakeItem = string | {
	mistake: string;
	why: string;
	whatToDo: string;
};

/**
 * Represents a success pattern
 * Can be a string (current format) or an object with structured fields
 */
export type SuccessPatternItem = string | {
	pattern: string;
	example: string;
	takeaway: string;
};

/**
 * Industry statistics and survival metrics
 */
export interface IndustryStats {
	survivalRate5yr: string;
	growthTrend: string;
}

/**
 * Financial benchmarks for a persona
 */
export interface FinancialBenchmarks {
	avgTicketRange: [number, number];
	dailyCustomerRange: [number, number];
	rentToRevenueMax: number;
	buildoutPerSqft: [number, number];
	monthsToBreakeven: [number, number];
}

/**
 * Target customer insights
 */
export interface TargetCustomerInsights {
	[key: string]: {
		description: string;
		locationSignal: string;
	} | string; // Support both v2 and v3 formats
}

/**
 * Coaching data for a specific persona type
 */
export interface PersonaCoaching {
	displayName: string;
	industryStats: IndustryStats | string;
	commonMistakes: CommonMistakeItem[];
	successPatterns: SuccessPatternItem[];
	financialBenchmarks: FinancialBenchmarks;
	targetCustomerInsights?: TargetCustomerInsights;
	coachingOpeners?: Record<string, string>;
	welcomeMessage?: string;
	didYouKnow?: string[];
	communityInsights?: Array<{
		quote: string;
		source: string;
		topic: string;
	}>;
	financialDefaults?: {
		avgTicket: [number, number];
		dailyCustomers: [number, number];
		dailyRevenue: [number, number];
		idealSqft: [number, number];
		maxRentPercent: number;
		buildoutPerSqft: [number, number];
		breakEvenMonths: [number, number];
	};
}

/**
 * Founder data extracted from conversation so far
 */
export interface ExtractedData {
	personaType?: string;
	conceptDescription?: string;
	conceptName?: string;
	targetCustomers?: string[];
	differentiators?: string[];
	financialEstimates?: {
		avgTicket?: number | [number, number];
		dailyCustomers?: number | [number, number];
		monthlyRevenue?: [number, number];
		maxRent?: number;
		idealSqft?: [number, number];
	};
	readyForAddress?: boolean;
}

/**
 * Builds the dynamic system prompt for onboarding coaching
 *
 * @param personaType - The business type key (e.g., 'coffee', 'restaurant')
 * @param coachingData - The persona-specific coaching data
 * @param conversationPhase - Current phase (e.g., 'concept', 'customers', 'address')
 * @param extractedData - Data extracted so far from the founder
 * @returns The assembled system prompt as a string
 */
export function buildOnboardingSystemPrompt(
	personaType: string,
	coachingData: PersonaCoaching,
	conversationPhase: string,
	extractedData: ExtractedData
): string {
	// Parse industry stats if it's a string
	let industryStatsText = '';
	if (typeof coachingData.industryStats === 'string') {
		industryStatsText = coachingData.industryStats;
	} else {
		industryStatsText = `${coachingData.industryStats.survivalRate5yr} survival rate. ${coachingData.industryStats.growthTrend}`;
	}

	// Format common mistakes
	const mistakesText = coachingData.commonMistakes
		.map(m => {
			if (typeof m === 'string') {
				return `- ${m}`;
			}
			return `- ${m.mistake}: ${m.why} → ${m.whatToDo}`;
		})
		.join('\n');

	// Format success patterns
	const patternsText = coachingData.successPatterns
		.map(p => {
			if (typeof p === 'string') {
				return `- ${p}`;
			}
			return `- ${p.pattern}: ${p.takeaway} (Example: ${p.example})`;
		})
		.join('\n');

	// Format financial benchmarks
	const benchmarksText = `
- Average ticket: $${coachingData.financialBenchmarks.avgTicketRange.join('-$')}
- Daily customers: ${coachingData.financialBenchmarks.dailyCustomerRange.join('-')}
- Rent/Revenue max: ${(coachingData.financialBenchmarks.rentToRevenueMax * 100).toFixed(0)}%
- Buildout: $${coachingData.financialBenchmarks.buildoutPerSqft.join('-$')}/sqft
- Break-even: ${coachingData.financialBenchmarks.monthsToBreakeven.join('-')} months`;

	// Format target customer insights only during customers phase
	let targetCustomersSection = '';
	if (conversationPhase === 'customers' && coachingData.targetCustomerInsights) {
		const insights = Object.entries(coachingData.targetCustomerInsights)
			.map(([key, val]) => {
				if (typeof val === 'string') {
					return `- ${key}: ${val}`;
				}
				return `- ${key}: ${val.description} (Location signal: ${val.locationSignal})`;
			})
			.join('\n');

		targetCustomersSection = `
Target customer insights:
${insights}
`;
	}

	// Format founder context section
	let founderContextSection = '';
	if (extractedData.conceptDescription) {
		founderContextSection = `
## WHAT THIS FOUNDER HAS TOLD YOU SO FAR
Concept: ${extractedData.conceptDescription}`;

		if (extractedData.targetCustomers && extractedData.targetCustomers.length > 0) {
			founderContextSection += `\nTarget customers: ${extractedData.targetCustomers.join(', ')}`;
		}

		if (extractedData.differentiators && extractedData.differentiators.length > 0) {
			founderContextSection += `\nDifferentiators: ${extractedData.differentiators.join(', ')}`;
		}

		founderContextSection += '\n';
	}

	// Get coaching opener for this phase (with fallback to empty string)
	const coachingOpener =
		coachingData.coachingOpeners?.[conversationPhase] ||
		coachingData.welcomeMessage ||
		'';

	// The 16x Standard rules
	const standardRules = `## RULES (THE 16x STANDARD)

BREVITY IS LAW — MAXIMUM 3 SENTENCES OF VISIBLE TEXT:
- One sentence to acknowledge. One sentence of insight with a real number. One question.
- This is iMessage, not an email. If your response is longer than a text message, it's too long.
- NEVER use markdown headers, bullet points, or lists. Plain conversational text only.

## CONVERSATION FLOW — TWO PATHS

YOUR VERY FIRST MESSAGE must:
1. In one warm sentence, ask the founder to share their business concept AND a location they're considering.
2. Example tone: "Tell me your concept and drop an address — I'll score it. Or if you want help building out your plan first, I can walk you through a few quick questions."

AFTER THEY RESPOND, detect which path they want:

PATH A — FAST TRACK (concept + location given):
- If they give you a concept AND an address in their first reply, acknowledge in one sentence with a quick insight, then move straight to scoring. 2-3 total exchanges.
- If they give a concept but no address, ask for the address. That's it. Don't ask more.
- If they give an address but vague concept, ask ONE clarifying question about the concept, then score.

PATH B — DEEP DIVE (they want more guidance):
- If they say they want help, OR they only give a concept with no address and seem uncertain, offer to walk through customers → financials → location. Keep it to 5-6 exchanges total.
- Each exchange: acknowledge in ≤5 words, give one insight with a real number, ask ONE question.
- Move through: concept → customers → financials → address → score.

CRITICAL: Do NOT force Path B on someone who's ready for Path A. If they have a concept and a location, GET TO SCORING. No unnecessary questions.

NO CHIT-CHAT:
- Do NOT ask how they're doing or make small talk. Jump straight into their business.
- After the greeting, every message must MOVE FORWARD. No pleasantries, no filler.
- If they give you info, acknowledge in ≤5 words and ask the next thing you need.
- Founders lose interest fast. Earn every reply.

MEMORY IS LAW — NEVER RE-ASK FOR INFORMATION:
- Read the FULL conversation history before responding.
- If the user already gave you an address, USE IT. Do not ask "got an address in mind?"
- If the user already told you their budget, USE IT. Do not ask again.
- NEVER repeat the same response or phrasing you used earlier in the conversation.

COACHING:
- Ask ONE question at a time.
- Use the benchmarks above. Be SPECIFIC — name numbers, neighborhoods, failure modes.
- Never ask what you can infer. Present inferences as defaults to confirm.
- Coaching opener for this phase: "${coachingOpener}"
- Design for the screenshot: what would the founder text to their co-founder?`;

	// Metadata format instructions
	const metadataFormat = `## METADATA FORMAT
After your visible response, emit a JSON block wrapped in <metadata> tags
(the client will parse and hide this from the founder):
<metadata>
{
  "extracted": { ... },
  "conversationPhase": "...",
  "scoringHints": { ... }
}
</metadata>`;

	// Assemble the complete prompt
	return `
You are RE²'s location intelligence coach — a retail location expert who talks via iMessage-style chat. You help founders evaluate locations in NYC.

YOUR PERSONALITY: Warm but direct. Like a busy mentor who genuinely cares but doesn't waste anyone's time. You get founders talking about THEIR vision immediately — no small talk, no filler. Every message earns the next reply.

## YOUR KNOWLEDGE FOR THIS BUSINESS TYPE: ${coachingData.displayName}

Industry context: ${industryStatsText}

Common mistakes founders make:
${mistakesText}

What successful ${coachingData.displayName.toLowerCase()}s do:
${patternsText}

Financial benchmarks:
${benchmarksText}
${targetCustomersSection}
${founderContextSection}
${standardRules}

${metadataFormat}
`.trim();
}

/**
 * Loads persona coaching data for a given persona type
 * @param personaType - The persona key (e.g., 'coffee', 'restaurant')
 * @returns The PersonaCoaching object or null if not found
 */
export function getPersonaCoaching(personaType: string): PersonaCoaching | null {
	const data = personaCoachingData as Record<string, unknown>;
	const coaching = data[personaType];

	if (!coaching) {
		return null;
	}

	return coaching as PersonaCoaching;
}

