/**
 * /api/analyze-concept — Sonnet-powered concept analysis for "Something Else" business types
 *
 * When a founder selects "Something Else" (custom business type), this endpoint
 * uses Claude Sonnet to analyze the concept description and return:
 * - A mapped closest-match persona key for scoring weight calibration
 * - Industry-specific heads-up warnings
 * - Financial benchmark estimates
 * - Location factor priorities
 * - A coaching opener tailored to the custom concept
 *
 * This is the "Section 5" handler from the Intelligence Build Spec.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { OPENROUTER_URL, openRouterHeaders } from '$lib/constants/aiConfig';

const OPENROUTER_KEY = env.OPENROUTER_API_KEY || '';
const MODEL = 'anthropic/claude-sonnet-4';

interface ConceptAnalysis {
  closestPersona: string;
  businessCategory: string;
  displayName: string;
  industryStats: {
    survivalRate5yr: string;
    avgRevenueFirstYear: string;
    growthTrend: string;
  };
  locationFactors: {
    critical: string[];
    important: string[];
    niceToHave: string[];
  };
  financialBenchmarks: {
    avgTicketRange: string;
    dailyCustomerRange: string;
    rentToRevenueMax: string;
    buildoutPerSqft: string;
    monthsToBreakeven: string;
  };
  headsUpWarnings: Array<{
    icon: string;
    title: string;
    description: string;
    severity: 'critical' | 'important' | 'info';
  }>;
  coachingOpener: string;
  commonMistakes: Array<{
    mistake: string;
    why: string;
    whatToDo: string;
  }>;
}

const ANALYSIS_PROMPT = `You are an expert commercial real estate analyst and small business advisor specializing in NYC.

A founder has described their business concept. It doesn't fit neatly into our standard personas (coffee shop, restaurant, florist, barbershop, spa/wellness, fitness, retail, medical/dental).

Analyze their concept and return a JSON object with the following structure. Be specific, data-driven, and NYC-focused. Every number should be realistic for a first-time founder in NYC.

Return ONLY valid JSON — no markdown, no explanation, no code fences.

{
  "closestPersona": "the closest standard persona key from: coffee_shop, restaurant, florist, barbershop, spa_wellness, fitness, retail, medical_dental",
  "businessCategory": "a concise category name (e.g., 'Pet Services', 'Coworking', 'Art Gallery')",
  "displayName": "a friendly display name for this concept type",
  "industryStats": {
    "survivalRate5yr": "e.g., '45%'",
    "avgRevenueFirstYear": "e.g., '$180K-$350K'",
    "growthTrend": "up, stable, or down"
  },
  "locationFactors": {
    "critical": ["top 2-3 location factors that will make or break this business"],
    "important": ["2-3 secondary factors"],
    "niceToHave": ["1-2 bonus factors"]
  },
  "financialBenchmarks": {
    "avgTicketRange": "e.g., '$15-$40'",
    "dailyCustomerRange": "e.g., '20-60'",
    "rentToRevenueMax": "e.g., '12%'",
    "buildoutPerSqft": "e.g., '$50-$120'",
    "monthsToBreakeven": "e.g., '12-18'"
  },
  "headsUpWarnings": [
    {
      "icon": "a single relevant emoji",
      "title": "short warning title (5-8 words)",
      "description": "specific, actionable warning with NYC context (1-2 sentences)",
      "severity": "critical | important | info"
    }
  ],
  "coachingOpener": "A warm, knowledgeable opening line that shows you understand their concept and its unique challenges. 1-2 sentences.",
  "commonMistakes": [
    {
      "mistake": "what founders typically get wrong",
      "why": "why this matters for their specific concept",
      "whatToDo": "the specific action to take instead"
    }
  ]
}

Include 3-5 headsUpWarnings (at least 1 critical, 1 important, 1 info).
Include 2-3 commonMistakes.
Be brutally practical — no fluff, no platitudes. Every sentence should contain a number, a name, or a specific action.`;

export const POST: RequestHandler = async ({ request }) => {
  if (!OPENROUTER_KEY) {
    throw error(500, 'OpenRouter API key not configured');
  }

  const body = await request.json();
  const { conceptDescription, businessName, targetCustomer, differentiators } = body;

  // ── L1: Soft validation — classify intent before hard-blocking ──
  // Old behavior: reject anything < 10 chars. New: classify and suggest.
  const trimmedDesc = (conceptDescription || '').trim();

  // True empty / gibberish — no business concept recoverable
  if (!trimmedDesc) {
    return json({ success: false, status: 'noise', message: "What type of business are you opening? Describe it in a few words." });
  }

  // Noise patterns: single random chars, keyboard mash, pure filler
  const noisePatterns = [/^[^a-zA-Z]+$/, /^(skip|n\/a|na|idk|tbd|pass|nope|no|yes|ok|okay|done|next|test|asdf|qwerty)$/i];
  if (noisePatterns.some(p => p.test(trimmedDesc))) {
    return json({ success: false, status: 'noise', message: "That doesn't look like a business concept. What are you opening?" });
  }

  // Incomplete but recognizable — single word or very short phrase that could be a real concept
  // Don't block these. Instead, enrich with suggestions and proceed to full analysis.
  const words = trimmedDesc.split(/\s+/).filter(w => w.length > 1);
  const isShort = words.length <= 2 && trimmedDesc.length < 15;

  // Generate concept suggestions for short inputs (e.g. "Protein" → ["Protein café", "Protein shake bar", "Protein bowl restaurant"])
  let suggestions: string[] = [];
  if (isShort) {
    const conceptStem = trimmedDesc.toLowerCase();
    // Rule-based suggestions for common short concepts — fast, no LLM needed
    const STEM_SUGGESTIONS: Record<string, string[]> = {
      'protein': ['Protein café', 'Protein shake bar', 'Protein bowl restaurant'],
      'coffee': ['Specialty coffee shop', 'Coffee and bakery café', 'Drive-through coffee'],
      'pizza': ['Neapolitan pizza restaurant', 'Pizza by the slice shop', 'Pizza delivery kitchen'],
      'burger': ['Gourmet burger restaurant', 'Smash burger counter', 'Burger bar'],
      'juice': ['Cold-pressed juice bar', 'Juice and smoothie bar', 'Wellness juice café'],
      'yoga': ['Yoga and pilates studio', 'Hot yoga studio', 'Community yoga space'],
      'gym': ['Boutique fitness gym', 'Personal training studio', 'CrossFit / functional fitness'],
      'bar': ['Cocktail bar and lounge', 'Wine bar', 'Natural wine bar'],
      'spa': ['Day spa and wellness center', 'Express treatment spa', 'Massage and recovery spa'],
      'salon': ['Hair salon', 'Blow dry bar', 'Full-service beauty salon'],
      'tacos': ['Taco restaurant', 'Mexican fast casual', 'Taco and mezcal bar'],
      'sushi': ['Sushi restaurant', 'Omakase sushi bar', 'Sushi counter and sake bar'],
      'bakery': ['Artisan bakery', 'Bakery and café', 'Specialty pastry shop'],
      'florist': ['Retail flower shop', 'Event florist studio', 'Flower subscription service'],
      'dental': ['General dentistry practice', 'Cosmetic dental office', 'Pediatric dentist'],
      'med': ['Medical office', 'Primary care clinic', 'Urgent care center'],
      'nail': ['Nail salon', 'Nail art studio', 'Luxury nail bar'],
      'boba': ['Boba tea shop', 'Bubble tea and snacks café', 'Asian beverage concept'],
      'matcha': ['Matcha café', 'Japanese tea house', 'Matcha and wellness bar'],
      'pet': ['Pet grooming salon', 'Dog daycare and boarding', 'Pet supply and grooming'],
      'kids': ['Children\'s enrichment center', 'Tutoring and education center', 'Kids activity studio'],
      'photo': ['Photography studio', 'Content creation studio', 'Headshot and portrait studio'],
      'co-work': ['Coworking space', 'Creative coworking studio', 'Flexible office and coworking'],
      'cowork': ['Coworking space', 'Creative coworking studio', 'Flexible office and coworking'],
    };
    for (const [stem, suggs] of Object.entries(STEM_SUGGESTIONS)) {
      if (conceptStem.includes(stem) || stem.includes(conceptStem)) {
        suggestions = suggs;
        break;
      }
    }
    // If no rule-based match, generate generic completions from stem
    if (!suggestions.length) {
      suggestions = [
        `${trimmedDesc} shop`,
        `${trimmedDesc} café`,
        `${trimmedDesc} studio`,
      ].map(s => s.charAt(0).toUpperCase() + s.slice(1));
    }
  }

  // Build the user message with all available context
  let userMessage = `Business concept: ${trimmedDesc}`;
  if (businessName) userMessage += `\nBusiness name: ${businessName}`;
  if (targetCustomer) userMessage += `\nTarget customer: ${targetCustomer}`;
  if (differentiators) userMessage += `\nKey differentiators: ${differentiators}`;
  userMessage += `\nLocation: New York City`;

  try {
    // #53/#54: OPENROUTER_URL and headers from shared aiConfig
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: openRouterHeaders(OPENROUTER_KEY),
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: ANALYSIS_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AnalyzeConcept] OpenRouter error:', response.status, errText);
      // Return a sensible fallback instead of failing
      return json({ ...buildFallbackAnalysis(trimmedDesc), status: isShort ? 'incomplete' : 'valid', suggestions });
    }

    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[AnalyzeConcept] Empty response from OpenRouter');
      return json({ ...buildFallbackAnalysis(trimmedDesc), status: isShort ? 'incomplete' : 'valid', suggestions });
    }

    // Parse JSON from response — strip any markdown fences if present
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    try {
      const analysis: ConceptAnalysis = JSON.parse(cleaned);

      // Validate required fields
      if (!analysis.closestPersona || !analysis.headsUpWarnings) {
        console.error('[AnalyzeConcept] Missing required fields in response');
        return json({ ...buildFallbackAnalysis(trimmedDesc), status: isShort ? 'incomplete' : 'valid', suggestions });
      }

      // Ensure closestPersona is one of our valid keys
      const validPersonas = ['coffee_shop', 'restaurant', 'florist', 'barbershop', 'spa_wellness', 'fitness', 'retail', 'medical_dental'];
      if (!validPersonas.includes(analysis.closestPersona)) {
        analysis.closestPersona = 'retail'; // safe default
      }

      // Validate severity values
      analysis.headsUpWarnings = analysis.headsUpWarnings.map(w => ({
        ...w,
        severity: ['critical', 'important', 'info'].includes(w.severity) ? w.severity : 'info'
      }));

      return json({
        success: true,
        status: isShort && suggestions.length ? 'incomplete' : 'valid',
        suggestions: isShort ? suggestions : [],
        analysis,
        model: MODEL,
        cached: false
      });

    } catch (parseErr) {
      console.error('[AnalyzeConcept] JSON parse error:', parseErr, 'Raw:', content.slice(0, 200));
      return json({ ...buildFallbackAnalysis(trimmedDesc), status: isShort ? 'incomplete' : 'valid', suggestions });
    }

  } catch (err) {
    console.error('[AnalyzeConcept] Fetch error:', err);
    return json({ ...buildFallbackAnalysis(trimmedDesc), status: isShort ? 'incomplete' : 'valid', suggestions });
  }
};

// GET: Return available persona keys for the frontend
export const GET: RequestHandler = async () => {
  return json({
    standardPersonas: [
      'coffee_shop', 'restaurant', 'florist', 'barbershop',
      'spa_wellness', 'fitness', 'retail', 'medical_dental'
    ],
    customSupported: true,
    model: MODEL
  });
};

/**
 * Fallback analysis when Sonnet is unavailable or returns invalid JSON.
 * Returns sensible generic guidance rather than failing.
 */
function buildFallbackAnalysis(conceptDescription: string): { success: boolean; analysis: ConceptAnalysis; model: string; cached: boolean } {
  const concept = conceptDescription.toLowerCase();

  // Simple keyword-based closest persona detection
  let closestPersona = 'retail';
  let category = 'General Retail/Service';
  if (concept.includes('food') || concept.includes('cook') || concept.includes('kitchen') || concept.includes('eat')) {
    closestPersona = 'restaurant';
    category = 'Food & Beverage';
  } else if (concept.includes('health') || concept.includes('therapy') || concept.includes('clinic')) {
    closestPersona = 'medical_dental';
    category = 'Health & Wellness';
  } else if (concept.includes('art') || concept.includes('gallery') || concept.includes('creative')) {
    closestPersona = 'retail';
    category = 'Creative & Arts';
  } else if (concept.includes('pet') || concept.includes('dog') || concept.includes('cat') || concept.includes('groom')) {
    closestPersona = 'spa_wellness';
    category = 'Pet Services';
  } else if (concept.includes('tech') || concept.includes('cowork') || concept.includes('office')) {
    closestPersona = 'retail';
    category = 'Workspace & Technology';
  } else if (concept.includes('child') || concept.includes('kid') || concept.includes('daycare') || concept.includes('tutor')) {
    closestPersona = 'medical_dental';
    category = 'Education & Childcare';
  }

  return {
    success: true,
    analysis: {
      closestPersona,
      businessCategory: category,
      displayName: category,
      industryStats: {
        survivalRate5yr: '40-50%',
        avgRevenueFirstYear: '$150K-$400K',
        growthTrend: 'stable'
      },
      locationFactors: {
        critical: ['Zoning permits your intended use', 'Foot traffic matches your customer acquisition model'],
        important: ['Demographics align with target customer', 'Competitor density is manageable'],
        niceToHave: ['Transit accessibility', 'Complementary neighboring businesses']
      },
      financialBenchmarks: {
        avgTicketRange: 'Varies by concept',
        dailyCustomerRange: 'Varies by concept',
        rentToRevenueMax: '10-15%',
        buildoutPerSqft: '$50-$150',
        monthsToBreakeven: '12-24'
      },
      headsUpWarnings: [
        {
          icon: '⚖️',
          title: 'Zoning Verification Required',
          description: 'Your business type may have specific zoning requirements. Verify with NYC Department of Buildings that your intended use is permitted.',
          severity: 'critical' as const
        },
        {
          icon: '♿',
          title: 'ADA Compliance',
          description: 'All customer-facing businesses must meet ADA accessibility requirements. Budget for ramps, restrooms, and doorway widths.',
          severity: 'important' as const
        },
        {
          icon: '📋',
          title: 'Lease Negotiation Basics',
          description: 'Negotiate: 2-3 months free rent, TI allowance ($20-$50/sqft), and an exit clause at year 3.',
          severity: 'info' as const
        }
      ],
      coachingOpener: "Interesting concept! Let's figure out whether this location can support your vision — every business type has different needs from its space.",
      commonMistakes: [
        {
          mistake: 'Signing a lease before verifying zoning',
          why: 'NYC zoning is complex — many commercial spaces restrict certain use types',
          whatToDo: 'Call 311 or check ZoLa (NYC Zoning & Land Use) before signing anything'
        },
        {
          mistake: 'Underestimating buildout costs',
          why: 'NYC construction costs are 2-3x the national average',
          whatToDo: 'Get 3 contractor bids before committing to a space, and add 30% contingency'
        }
      ]
    },
    model: 'fallback',
    cached: false
  };
}
