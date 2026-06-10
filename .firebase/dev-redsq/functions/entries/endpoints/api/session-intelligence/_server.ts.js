import { error, json } from "@sveltejs/kit";
import { p as private_env } from "../../../../chunks/private.js";
import { O as OPENROUTER_URL, o as openRouterHeaders } from "../../../../chunks/aiConfig.js";
function getSessionContextForAI(session) {
  return {
    personaType: session.personaType,
    personaKey: session.personaKey,
    conceptDescription: session.conceptDescription,
    answers: session.answers,
    smartDefaults: session.smartDefaults,
    coachingHistory: session.coachingThread.map((m) => ({
      screen: m.screen,
      response: m.response.slice(0, 200)
      // truncate for token economy
    })),
    location: session.locationData ? {
      address: session.locationData.address,
      sixIndices: session.locationData.sixIndices,
      compositeScore: session.locationData.compositeScore
    } : null,
    headsUpCards: session.headsUpCards.map((c) => ({
      title: c.title,
      severity: c.severity
    })),
    verdict: session.verdict,
    businessModel: session.businessModel ? {
      successProbability: session.businessModel.successProbability,
      verdict: session.businessModel.verdict,
      positiveFactors: session.businessModel.positiveFactors.map((f) => f.label),
      negativeFactors: session.businessModel.negativeFactors.map((f) => f.label),
      financials: session.businessModel.financials
    } : null
  };
}
const OPENROUTER_KEY = private_env.OPENROUTER_API_KEY || "";
const MODEL = "anthropic/claude-sonnet-4";
const POST = async ({ request }) => {
  const body = await request.json();
  const { requestType, session, extra } = body;
  if (!requestType || !session) {
    throw error(400, "Missing requestType or session");
  }
  const context = getSessionContextForAI(session);
  const systemPrompt = buildSystemPrompt(requestType);
  const userPrompt = buildUserPrompt(requestType, context, extra);
  if (!OPENROUTER_KEY) {
    return json({
      requestType,
      result: getTemplateFallback(requestType, context),
      cached: false
    });
  }
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: openRouterHeaders(OPENROUTER_KEY),
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2e3
      })
    });
    if (!response.ok) {
      console.error("OpenRouter error:", response.status);
      return json({
        requestType,
        result: getTemplateFallback(requestType, context),
        cached: false
      });
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { text: content };
    } catch {
      result = { text: content };
    }
    return json({ requestType, result, cached: false });
  } catch (err) {
    console.error("Session intelligence error:", err);
    return json({
      requestType,
      result: getTemplateFallback(requestType, context),
      cached: false
    });
  }
};
function buildSystemPrompt(requestType, _context, _extra) {
  const base = `You are the RE² AI coach — a warm, knowledgeable advisor who has helped hundreds of small business founders evaluate locations. You speak in plain English, never jargon. You cite specific numbers when available. You are encouraging but honest.

CRITICAL RULES:
- Never say "data layers" or "weighted scoring" — say "things we checked" or "what matters most for your business"
- Every number gets context — "65" means nothing, "65 — 3 competitors within 0.3mi" means everything
- Use traffic light language — green = good, orange = look twice, red = stop and think
- Be specific to their business type — a coffee shop and a dental office need completely different advice
- Always respond with valid JSON matching the requested schema`;
  switch (requestType) {
    case "coaching":
      return `${base}

You are providing real-time coaching during onboarding. Be warm, specific, and give immediate value. Reference real SMB learnings. Keep responses to 2-3 sentences unless analyzing a concept.

Respond with JSON: { "message": "your coaching text", "highlights": ["key point 1", "key point 2"] }`;
    case "conceptAnalysis":
      return `${base}

Analyze the founder's concept description. Identify strengths, potential warnings, suggest 2-3 creative business names, and provide differentiation tips.

Respond with JSON: { "strengths": ["..."], "warnings": ["..."], "nameIdeas": ["..."], "differentiationTips": "...", "targetCustomers": "..." }`;
    case "smartDefaults":
      return `${base}

Generate realistic financial defaults for this business concept in NYC. Use industry benchmarks adjusted for their specific concept. Always provide ranges, not point estimates.

Respond with JSON: { "dailyRevenue": [low, high], "avgTicket": number, "dailyCustomers": [low, high], "idealSqft": [low, high], "maxHealthyRent": number, "buildoutPerSqft": [low, high], "explanation": "how we calculated this" }`;
    case "verdict":
      return `${base}

Synthesize ALL scoring data into a 2-3 sentence verdict. Cite specific numbers. Be clear about whether they should proceed.

Respond with JSON: { "verdict": "your 2-3 sentence synthesis" }`;
    case "businessModel":
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
    case "playbook":
      return `${base}

Generate 5 specific, actionable next steps for this founder. Each step should reference actual data from the scoring. Include specific questions to ask, dollar amounts, and timeframes.

Respond with JSON: { "steps": [{ "number": 1, "title": "...", "explanation": "...", "icon": "emoji" }] }`;
    case "riskNarrative":
      return `${base}

Write a 2-3 paragraph risk narrative that reads like a story, not a list. Identify the biggest risk, quantify it, and give a specific action to mitigate it.

Respond with JSON: { "narrative": "your risk story" }`;
    case "comparison":
      return `${base}

Compare two locations for this specific business type. Be specific about which factors favor which location. End with a clear recommendation.

Respond with JSON: { "comparison": "your comparison narrative", "winner": "address1 or address2", "reasoning": "why" }`;
    default:
      return base;
  }
}
function buildUserPrompt(requestType, context, extra) {
  const sessionInfo = JSON.stringify(context, null, 2);
  switch (requestType) {
    case "coaching":
      return `Session context:
${sessionInfo}

Current screen: ${extra?.currentScreen || "unknown"}
User action: ${extra?.action || "viewing screen"}

Provide coaching for this moment.`;
    case "conceptAnalysis":
      return `Session context:
${sessionInfo}

Analyze this concept and provide strengths, warnings, name ideas, and differentiation tips.`;
    case "smartDefaults":
      return `Session context:
${sessionInfo}

Generate realistic NYC financial defaults for this specific concept.`;
    case "verdict":
      return `Session context:
${sessionInfo}

Synthesize all data into a clear verdict.`;
    case "businessModel":
      return `Session context:
${sessionInfo}

Generate the full business viability model.`;
    case "playbook":
      return `Session context:
${sessionInfo}

Generate 5 personalized next steps.`;
    case "riskNarrative":
      return `Session context:
${sessionInfo}

Write the risk narrative.`;
    case "comparison":
      return `Session context:
${sessionInfo}

Compare locations: ${JSON.stringify(extra?.locations || [])}`;
    default:
      return `Session context:
${sessionInfo}

Provide relevant intelligence.`;
  }
}
function getTemplateFallback(requestType, context) {
  const persona = context.personaType || "your business";
  const concept = context.conceptDescription || "";
  switch (requestType) {
    case "coaching":
      return {
        message: `Great choice with ${persona}. Location is everything for this type of business — the right spot can mean the difference between thriving and struggling. Let's find your perfect location.`,
        highlights: ["Location precision matters", "We check 20+ data sources"]
      };
    case "conceptAnalysis":
      return {
        strengths: concept ? ["Specific concept vision", "Clear target market"] : ["Getting started is the hardest part"],
        warnings: ["Define your unique angle to stand out from competitors"],
        nameIdeas: ["Your Brand Here"],
        differentiationTips: "Focus on what makes your version special — that specificity helps us give better advice.",
        targetCustomers: "We will identify your ideal customer profile once we score a location."
      };
    case "smartDefaults":
      return {
        dailyRevenue: [600, 1200],
        avgTicket: 8,
        dailyCustomers: [80, 150],
        idealSqft: [600, 1200],
        maxHealthyRent: 5e3,
        buildoutPerSqft: [75, 200],
        explanation: "Based on NYC benchmarks for your business type. These are starting estimates — we will refine once you pick an address."
      };
    case "verdict":
      return {
        verdict: "Score a location to see your personalized verdict with specific data-backed insights."
      };
    case "businessModel":
      return null;
    case "playbook":
      return {
        steps: [
          { number: 1, title: "Walk the block at peak hours", explanation: "Count foot traffic yourself at the times that matter most for your business.", icon: "🚶" },
          { number: 2, title: "Check the infrastructure", explanation: "Verify electrical, plumbing, and HVAC capacity before falling in love with the space.", icon: "🔌" },
          { number: 3, title: "Talk to neighboring businesses", explanation: "Ask them about foot traffic patterns, landlord responsiveness, and seasonal changes.", icon: "🗣️" },
          { number: 4, title: "Get a contractor walkthrough", explanation: "A $300-500 walkthrough can save you $30K+ in surprise buildout costs.", icon: "🔨" },
          { number: 5, title: "Negotiate before you sign", explanation: "Most landlords expect negotiation. Ask for rent-free buildout months and a TI allowance.", icon: "📝" }
        ]
      };
    case "riskNarrative":
      return {
        narrative: "Score a location to generate your personalized risk analysis."
      };
    case "comparison":
      return {
        comparison: "Score two locations to see a detailed comparison.",
        winner: "",
        reasoning: ""
      };
    default:
      return { message: "Intelligence will be generated once more data is available." };
  }
}
export {
  POST
};
