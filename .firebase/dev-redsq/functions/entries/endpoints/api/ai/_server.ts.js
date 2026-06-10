import { json } from "@sveltejs/kit";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
import { f as formatConcept } from "../../../../chunks/conceptNames.js";
import { p as private_env } from "../../../../chunks/private.js";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_MAP = {
  "claude-opus-4-1": "anthropic/claude-sonnet-4",
  // downgrade Opus → Sonnet for cost
  "claude-3-5-sonnet-20241022": "anthropic/claude-sonnet-4"
};
async function callClaudeAPI(systemPrompt, userMessage, model = "claude-3-5-sonnet-20241022", telemetry) {
  const apiKey = private_env.OPENROUTER_API_KEY || (typeof process !== "undefined" ? process.env.OPENROUTER_API_KEY : void 0);
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Configure it in your environment variables."
    );
  }
  const openRouterModel = MODEL_MAP[model] || "anthropic/claude-sonnet-4";
  const telemetryRoute = "claude.callClaudeAPI";
  {
    try {
      const { getCachedOrFetch } = await import("../../../../chunks/llm-cache.js");
      const result = await getCachedOrFetch({
        model: openRouterModel,
        systemPrompt,
        userMessage,
        ttlHours: telemetry?.cacheTtlHours ?? 24,
        route: telemetryRoute,
        userId: telemetry?.userId,
        sessionId: telemetry?.sessionId,
        metadata: telemetry?.metadata,
        fetcher: () => callOpenRouterRaw(apiKey, openRouterModel, systemPrompt, userMessage, telemetryRoute, telemetry)
      });
      return typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    } catch (cacheErr) {
      console.warn("[claude] getCachedOrFetch threw, falling through to direct call:", cacheErr);
    }
  }
  const startMs = Date.now();
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://resquared.io",
        "X-Title": "RE² AI Engine"
      },
      body: JSON.stringify({
        model: openRouterModel,
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        stream: false
      })
    });
    if (!response.ok) {
      try {
        const { logAiCall } = await import("../../../../chunks/telemetry.js");
        logAiCall({
          route: telemetryRoute,
          model: openRouterModel,
          durationMs: Date.now() - startMs,
          userId: telemetry?.userId,
          sessionId: telemetry?.sessionId,
          status: "error",
          errorCode: String(response.status),
          metadata: telemetry?.metadata
        });
      } catch {
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenRouter API error (${response.status}): ${errorData.error?.message || "Unknown error"}`
      );
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    try {
      const { logAiCall } = await import("../../../../chunks/telemetry.js");
      const usage = data.usage;
      logAiCall({
        route: telemetryRoute,
        model: openRouterModel,
        tokensIn: usage?.prompt_tokens,
        tokensOut: usage?.completion_tokens,
        durationMs: Date.now() - startMs,
        userId: telemetry?.userId,
        sessionId: telemetry?.sessionId,
        status: "ok",
        metadata: telemetry?.metadata
      });
    } catch {
    }
    if (!content) {
      throw new Error("Unexpected response format from OpenRouter API");
    }
    return content;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to call Claude API via OpenRouter: ${error.message}`);
    }
    throw error;
  }
}
async function callOpenRouterRaw(apiKey, openRouterModel, systemPrompt, userMessage, telemetryRoute, telemetry) {
  const startMs = Date.now();
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://resquared.io",
      "X-Title": "RE² AI Engine"
    },
    body: JSON.stringify({
      model: openRouterModel,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      stream: false
    })
  });
  if (!response.ok) {
    try {
      const { logAiCall } = await import("../../../../chunks/telemetry.js");
      logAiCall({
        route: telemetryRoute,
        model: openRouterModel,
        durationMs: Date.now() - startMs,
        userId: telemetry?.userId,
        sessionId: telemetry?.sessionId,
        status: "error",
        errorCode: String(response.status),
        metadata: { ...telemetry?.metadata ?? {}, cache_hit: false }
      });
    } catch {
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `OpenRouter API error (${response.status}): ${errorData.error?.message || "Unknown error"}`
    );
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Unexpected response format from OpenRouter API");
  }
  const usage = data.usage;
  return {
    content,
    tokensIn: usage?.prompt_tokens,
    tokensOut: usage?.completion_tokens
  };
}
async function generateLocationNarrative(intelReport, founderProfile, locationScore, alignmentScore, categoryConfig) {
  const category = categoryConfig?.name || "business";
  const address = intelReport?.address || "this location";
  const neighborhood = intelReport?.neighborhood || "the area";
  const systemPrompt = `You are an expert commercial real estate advisor analyzing a location for a ${category} business. Write a 2-3 paragraph narrative analysis. Don't just list numbers — interpret them. Explain what the data means for THIS specific business concept. Be specific about the address and neighborhood. Mention real competitor names from the data. Highlight the gap between Location Score and Alignment Score.`;
  const userMessage = `
Analyze this location for a ${category} business:

Location: ${address}, ${neighborhood}
Location Score: ${locationScore}/100
Alignment Score: ${alignmentScore}/100

Founder Profile:
- Business Vision: ${founderProfile?.businessVision || "Not specified"}
- Target Customer: ${founderProfile?.targetCustomer || "Not specified"}
- Unique Value Prop: ${founderProfile?.uniqueValueProp || "Not specified"}
- Budget: ${founderProfile?.budget || "Not specified"}

Location Intelligence:
${JSON.stringify(intelReport, null, 2)}

Category Config:
${JSON.stringify(categoryConfig, null, 2)}

Provide a compelling narrative that interprets what this location means for this specific business.
`;
  return callClaudeAPI(systemPrompt, userMessage, "claude-3-5-sonnet-20241022");
}
async function detectContradictions(founderProfile, intelReport, locationScore, alignmentScore) {
  const systemPrompt = `Analyze the founder's stated goals against the location data. Flag contradictions like: high-revenue targets in low-foot-traffic areas, premium positioning in budget neighborhoods, conservative risk tolerance in high-competition areas, etc.

Return a JSON array of contradiction objects with this structure:
{
  "severity": "high" | "medium" | "low",
  "category": "financial" | "market" | "risk" | "concept",
  "vision": "what the founder said",
  "reality": "what the data shows",
  "suggestion": "how to resolve"
}

Return only valid JSON, no other text.`;
  const userMessage = `
Founder Profile:
- Revenue Target: ${founderProfile?.revenueTarget || "Not specified"}
- Positioning: ${founderProfile?.positioning || "Not specified"}
- Risk Tolerance: ${founderProfile?.riskTolerance || "Not specified"}
- Growth Timeline: ${founderProfile?.growthTimeline || "Not specified"}
- Business Vision: ${founderProfile?.businessVision || "Not specified"}

Location Data:
- Location Score: ${locationScore}/100
- Alignment Score: ${alignmentScore}/100
- Foot Traffic: ${intelReport?.footTraffic || "Unknown"}
- Competition Level: ${intelReport?.competitionLevel || "Unknown"}
- Neighborhood Type: ${intelReport?.neighborhoodType || "Unknown"}
- Average Income: ${intelReport?.averageIncome || "Unknown"}

Identify all contradictions between the founder's vision and the location data.
`;
  try {
    const response = await callClaudeAPI(systemPrompt, userMessage, "claude-opus-4-1");
    const contradictions = JSON.parse(response);
    return Array.isArray(contradictions) ? contradictions : [];
  } catch (error) {
    console.error("Error detecting contradictions:", error);
    return [];
  }
}
async function generateBusinessPlan(founderProfile, intelReport, scores, categoryConfig) {
  const category = categoryConfig?.name || "business";
  const address = intelReport?.address || "this location";
  const systemPrompt = `Generate a structured business plan with sections: Executive Summary, Market Analysis, Competitive Landscape, Financial Projections (base/upside/downside scenarios with P&L breakdown), Risk Assessment, Location Strategy.

Use the location scores, vision inputs (avg check, hours, differentiators, food program), and rent data provided to build realistic projections. If monthly rent is provided, calculate rent as a percentage of projected revenue and flag if it exceeds industry benchmarks.

Financial Projections should include:
- Projected annual revenue (based on concept avg check × daily transactions × operating days)
- Major cost categories: COGS, labor, rent, overhead
- Simple KPIs: break-even timeline, rent-to-revenue ratio, gross margin
- Three scenarios: base, upside, downside

Return a JSON object with this exact structure:
{
  "title": "string",
  "executiveSummary": "string",
  "marketAnalysis": "string",
  "competitiveLandscape": "string",
  "financialProjections": {
    "base": { "revenue": number, "profit": number, "breakEvenMonths": number },
    "upside": { "revenue": number, "profit": number, "breakEvenMonths": number },
    "downside": { "revenue": number, "profit": number, "breakEvenMonths": number }
  },
  "riskAssessment": "string",
  "locationStrategy": "string",
  "recommendations": ["string"]
}

Return only valid JSON, no other text.`;
  const userMessage = `
Create a business plan for a ${category} business at ${address}.

Founder Profile:
- Business Vision: ${founderProfile?.businessVision || "Not specified"}
- Target Customer: ${founderProfile?.targetCustomer || "Not specified"}
- Unique Value Prop: ${founderProfile?.uniqueValueProp || "Not specified"}
- Revenue Target: ${founderProfile?.revenueTarget || "Not specified"}
- Budget: ${founderProfile?.budget || "Not specified"}
- Years to Profitability: ${founderProfile?.yearsToProfit || "2-3"}

Location Scores:
- Location Score: ${scores.locationScore}/100
- Alignment Score: ${scores.alignmentScore}/100

Location Intelligence:
${JSON.stringify(intelReport, null, 2)}

Category Config:
${JSON.stringify(categoryConfig, null, 2)}

Generate a comprehensive, realistic business plan tailored to this specific location and founder profile.
`;
  try {
    const response = await callClaudeAPI(systemPrompt, userMessage, "claude-opus-4-1");
    const plan = JSON.parse(response);
    return plan;
  } catch (error) {
    console.error("Error generating business plan:", error);
    return {
      title: `Business Plan for ${category} at ${address}`,
      executiveSummary: "Unable to generate business plan at this time. Please try again later.",
      marketAnalysis: "",
      competitiveLandscape: "",
      financialProjections: {
        base: { revenue: 0, profit: 0, breakEvenMonths: 0 },
        upside: { revenue: 0, profit: 0, breakEvenMonths: 0 },
        downside: { revenue: 0, profit: 0, breakEvenMonths: 0 }
      },
      riskAssessment: "",
      locationStrategy: "",
      recommendations: []
    };
  }
}
async function generateCompareRecommendation(addresses, conceptType, conceptLabel) {
  if (addresses.length < 2) {
    throw new Error("Compare requires at least 2 addresses");
  }
  if (addresses.length > 5) {
    throw new Error("Compare supports a maximum of 5 addresses");
  }
  const systemPrompt = `You are RE², an AI co-pilot for first-time retail and food & beverage founders.
You help founders choose the right NYC location for their concept by analyzing scoring data.

Your job is to compare ${addresses.length} locations and give a clear, honest recommendation.
Concept being evaluated: ${conceptLabel} (${conceptType})

Rules:
- Be direct. Lead with the winner and why.
- Use plain English — no jargon, no hedge words like "potentially" or "perhaps"
- Never mention rent, lease costs, or property prices (you don't have that data)
- Never mention specific competitors by name (you don't have verified competitor data)
- Never mention Yelp, specific review counts, or review platforms
- Reference only data provided: the location score and the 8 dimension scores
- "Business Success Rate" = survivalRate score (% of similar businesses thriving in area)
- "Neighborhood Health" = quality of existing businesses in the area (Google ratings + health grades)
- Keep recommendation to 2-4 sentences
- Reasons per address: one sentence each, factual, no fluff

Scoring reference (for your interpretation):
- 80-100: Excellent
- 65-79: Good
- 50-64: Average
- 35-49: Below average
- 0-34: Poor`;
  const addressLines = addresses.map((a, i) => {
    const idx = i + 1;
    return `Address ${idx}: "${a.label}"
  Score: ${a.fitIQ}  |  Block: ${a.locationIQ}  |  Concept Detail: ${a.visionIQ}
  Dimensions: Transit=${a.indexScores.transit}, Demographics=${a.indexScores.demographics}, Competition=${a.indexScores.competition}, Vibrancy=${a.indexScores.vibrancy}, Safety=${a.indexScores.safety}, Momentum=${a.indexScores.momentum}, NeighborhoodHealth=${a.indexScores.neighborhoodHealth}, BusinessSuccessRate=${a.indexScores.survivalRate}`;
  }).join("\n\n");
  const userMessage = `Compare these ${addresses.length} locations for a ${conceptLabel}:

${addressLines}

Return ONLY a JSON object with this exact structure (no markdown, no explanation outside the JSON):
{
  "recommendation": "<2-4 sentence plain-English recommendation>",
  "ranking": [<array of 1-indexed address numbers, best to worst>],
  "reasons": [<one-sentence reason per address, in same order as input>],
  "topStrength": "<single biggest strength of the top-ranked address>",
  "topRisk": "<single biggest risk of the top-ranked address>"
}`;
  const raw = await callClaudeAPI(systemPrompt, userMessage, "claude-3-5-sonnet-20241022");
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error(`Failed to parse compare response as JSON: ${cleaned.slice(0, 200)}`);
    }
  }
  if (!parsed.recommendation || !parsed.ranking || !parsed.reasons) {
    throw new Error("Invalid compare response structure from AI");
  }
  return parsed;
}
async function generateVisionAnchorResearch(concept, conceptLabel, neighborhood, borough, differentiators, targetClients, competitors, medianIncome) {
  const systemPrompt = `You are RE², an AI co-pilot for first-time retail and food & beverage founders in NYC.
You are a market researcher. Your job: find 2-3 REAL, CURRENT consumer trends and demand signals for this specific concept in this specific NYC neighborhood.

Rules:
- Research REAL trends — name actual brands, products, and market data. Examples:
  * Specialty coffee: "protein coffee mainstreaming — Blank Street, Starbucks launched protein add-ons in 2024-2025"
  * Bars: "zero-proof cocktails grew 33% in NYC since 2023; Spiritless, Seedlip, Curious Elixirs all expanding"
  * Fitness: "recovery studios (cold plunge, sauna) are the fastest-growing gym segment in NYC"
  * Bakery: "sourdough and laminated pastries driving 40% higher ticket than traditional bakeries"
  * Fast casual: "bowls and build-your-own formats outperforming fixed menus by 2x on repeat visits"
- Tailor to the SPECIFIC neighborhood — FiDi office workers vs Park Slope families vs Williamsburg creatives
- Each trend must have an ACTIONABLE insight the founder can implement
- demandSignal: is the timing good or bad for this concept in this specific area, and WHY
- differentiatorTip: the single most powerful thing to stand out from ${competitors} nearby competitors
- Be bold, specific, no hedge words. This founder needs to know what's working NOW.`;
  const userMessage = `Concept: ${conceptLabel} (${concept})
Location: ${neighborhood || borough}, NYC
Differentiators: ${differentiators || "Not specified yet"}
Target customers: ${targetClients || "General"}
Nearby competitors: ${competitors}
Area median household income: $${Math.round(medianIncome / 1e3)}K

Return ONLY a JSON object:
{
  "trends": [
    { "title": "<trend name, 3-6 words>", "insight": "<1-2 sentences, specific and actionable>" }
  ],
  "demandSignal": "<1 sentence: is the market timing good/bad and why>",
  "differentiatorTip": "<1 sentence: what would make this concept stand out HERE>"
}`;
  const raw = await callClaudeAPI(systemPrompt, userMessage, "claude-3-5-sonnet-20241022");
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error(`Failed to parse vision anchor response: ${cleaned.slice(0, 200)}`);
  }
  if (!parsed.trends || !parsed.demandSignal) throw new Error("Invalid vision anchor response structure");
  return parsed;
}
async function generateFitImprovementRecs(concept, conceptLabel, neighborhood, borough, fitIQ, locationIQ, visionIQ, sixScores, monthlyRent, avgCheck, competitors, differentiators, medianIncome) {
  const rentToRevGuess = monthlyRent > 0 && avgCheck > 0 ? Math.round(monthlyRent * 12 / (avgCheck * 150 * 312) * 100) : 0;
  const systemPrompt = `You are RE², an AI co-pilot for first-time retail and food & beverage founders in NYC.
You generate SPECIFIC, ACTIONABLE fit improvement recommendations for THIS founder in THIS exact location.

Rules:
- Every recommendation must reference ACTUAL NUMBERS from the data provided
- If rent-to-revenue is above 12%, one rec MUST be: "Reduce rent exposure to under X% — negotiate to $Y/mo or find a location at $Z/mo"
- If demographics score is below 50, one rec MUST address customer targeting mismatch
- If safety score is below 40, one rec MUST address operating hours or security
- If competition score is low (<40), address whether this is pioneer risk or opportunity
- Reference the SPECIFIC neighborhood by name — "In ${neighborhood || borough}" not "in your area"
- Reference the median income — "$${Math.round(medianIncome / 1e3)}K HHI means your avg check of $${avgCheck} is..."
- 3-5 recommendations, each with a NUMBER-BACKED impact estimate
- Priority: high = do this before signing, medium = critical for year 1, low = optimize in year 2
- overallAdvice: the single most important thing this founder needs to fix RIGHT NOW`;
  const userMessage = `Concept: ${conceptLabel} (${concept})
Location: ${neighborhood || borough}, NYC
Score: ${fitIQ}/100 (Block: ${locationIQ}, Concept: ${visionIQ})
Sub-Scores: Transit=${sixScores.transit || 0}, Demographics=${sixScores.demographics || 0}, Competition=${sixScores.competition || 0}, Vibrancy=${sixScores.vibrancy || 0}, Safety=${sixScores.safety || 0}, Momentum=${sixScores.momentum || 0}
Monthly rent: $${monthlyRent || 0} (est. ${rentToRevGuess}% of revenue)
Avg check: $${avgCheck || 0}
Nearby competitors: ${competitors}
Differentiators: ${differentiators || "Not specified"}
Area median HHI: $${Math.round(medianIncome / 1e3)}K

Return ONLY a JSON object:
{
  "recommendations": [
    { "action": "<specific action>", "impact": "<expected result>", "priority": "high|medium|low" }
  ],
  "overallAdvice": "<one direct sentence>"
}`;
  const raw = await callClaudeAPI(systemPrompt, userMessage, "claude-3-5-sonnet-20241022");
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error(`Failed to parse fit improvement response: ${cleaned.slice(0, 200)}`);
  }
  if (!parsed.recommendations || !parsed.overallAdvice) throw new Error("Invalid fit improvement response structure");
  return parsed;
}
async function generateNeighborhoodAttractiveness(concept, conceptLabel, borough, currentNeighborhood, locationIQ, fitIQ, transitScore, demographicsScore, vibrancyScore, medianIncome) {
  const systemPrompt = `You are RE², an AI co-pilot for first-time retail and food & beverage founders in NYC.
You know NYC neighborhoods deeply and can identify which areas in a given borough are best for specific business concepts.

Rules:
- List the top 3-4 neighborhoods in the specified borough that are attractive for this concept
- Be specific about WHY each neighborhood works (foot traffic, demo match, existing cluster, growth trend)
- avgRent: realistic range for small retail in that neighborhood (e.g. "$4,500–$7,000/mo for 800sf")
- currentAreaVerdict: honest 1-2 sentence assessment of their current neighborhood choice vs the alternatives
- Use real NYC knowledge — don't invent neighborhoods`;
  const userMessage = `Concept: ${conceptLabel} (${concept})
Borough: ${borough}
Current neighborhood: ${currentNeighborhood || "Not specified"}
Current score: ${fitIQ} (Block: ${locationIQ})
Area dimensions: Transit=${transitScore}, Demographics=${demographicsScore}, Vibrancy=${vibrancyScore}
Area median HHI: $${Math.round(medianIncome / 1e3)}K

Return ONLY a JSON object:
{
  "topNeighborhoods": [
    { "name": "<neighborhood>", "whyGood": "<1 sentence>", "avgRent": "<rent range>" }
  ],
  "currentAreaVerdict": "<1-2 sentences comparing current choice to alternatives>"
}`;
  const raw = await callClaudeAPI(systemPrompt, userMessage, "claude-3-5-sonnet-20241022");
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error(`Failed to parse neighborhood attractiveness response: ${cleaned.slice(0, 200)}`);
  }
  if (!parsed.topNeighborhoods || !parsed.currentAreaVerdict) throw new Error("Invalid neighborhood attractiveness response structure");
  return parsed;
}
async function generateBusinessCaseRecs(concept, conceptLabel, neighborhood, borough, address, locationIQ, fitIQ, visionIQ, sixScores, dailyCust, avgTicket, annualRevenue, monthlyRent, cogsPct, laborCost, preTaxProfit, marginPct, rentToRevenuePct, medianIncome, walkScore, competitors, crimeScore, differentiators, targetClients, foodProgram, storeType) {
  const systemPrompt = `You are RE², an AI co-pilot for first-time retail and food & beverage founders in NYC.
You generate 3 specific, actionable business case recommendations using ALL available data about the founder's concept, location, financials, and neighborhood.

You return exactly 3 recommendations:
1. REVENUE: How to grow revenue — be specific about the channel, tactic, or lever. Reference actual numbers (daily covers, ticket size, product mix, walk score, transit).
2. COST: How to optimize costs — reference actual rent %, labor cost, COGS, or operational efficiency. Give specific dollar savings or percentage targets.
3. POSITIONING: How to win in THIS specific neighborhood — reference the demographics, competition level, foot traffic patterns, and what works for this concept type here.

Rules:
- Be blunt and specific — use the actual numbers provided, not generic advice
- Every recommendation must reference at least 2 data points from the input
- Titles should be 4-8 words, action-oriented
- Body should be 2-3 sentences max, no hedge words
- If rent-to-revenue is above 12%, the cost rec MUST address this
- If margin is negative, the revenue rec MUST address volume or pricing
- Reference the neighborhood by name, not "your area"
- Reference competitor count and what it means for strategy`;
  const userMessage = `Concept: ${conceptLabel} (${concept})
Location: ${address}
Neighborhood: ${neighborhood || borough}, NYC
Borough: ${borough}

SCORES:
- Score: ${fitIQ} (Block: ${locationIQ}, Concept: ${visionIQ})
- Transit: ${sixScores.transit || 0}, Demographics: ${sixScores.demographics || 0}, Competition: ${sixScores.competition || 0}
- Vibrancy: ${sixScores.vibrancy || 0}, Safety: ${sixScores.safety || 0}, Momentum: ${sixScores.momentum || 0}

FINANCIALS:
- Daily customers: ${dailyCust}, Avg ticket: $${avgTicket}
- Annual revenue: $${Math.round(annualRevenue).toLocaleString()}
- Monthly rent: $${monthlyRent.toLocaleString()} (${rentToRevenuePct}% of revenue)
- COGS: ${cogsPct}%, Annual labor: $${Math.round(laborCost).toLocaleString()}
- Pre-tax profit: $${Math.round(preTaxProfit).toLocaleString()} (${marginPct}% margin)

LOCATION INTEL:
- Median HHI: $${Math.round(medianIncome / 1e3)}K
- Walk score: ${walkScore}
- Nearby competitors: ${competitors}
- Crime score: ${crimeScore}

VISION:
- Differentiators: ${differentiators || "Not specified"}
- Target clients: ${targetClients || "General"}
- Food program: ${foodProgram || "Not specified"}
- Store type: ${storeType || "Standard"}

Return ONLY a JSON object:
{
  "revenue": { "title": "<4-8 word action title>", "body": "<2-3 sentences with specific data references>" },
  "cost": { "title": "<4-8 word action title>", "body": "<2-3 sentences with specific data references>" },
  "positioning": { "title": "<4-8 word action title>", "body": "<2-3 sentences with specific data references>" }
}`;
  const raw = await callClaudeAPI(systemPrompt, userMessage, "claude-3-5-sonnet-20241022");
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error(`Failed to parse business case recs: ${cleaned.slice(0, 200)}`);
  }
  if (!parsed.revenue || !parsed.cost || !parsed.positioning) throw new Error("Invalid business case recs structure");
  return parsed;
}
const POST = async ({ request, platform }) => {
  const limited = rateLimit(request, RATE_LIMITS.ai);
  if (limited) return limited;
  try {
    const { checkAiBudget } = await import("../../../../chunks/budget-guard.js");
    const sessionId = request.headers.get("X-Session-Id");
    const block = await checkAiBudget({ sessionId });
    if (block) return block;
  } catch {
  }
  try {
    const { env } = await import("../../../../chunks/private.js").then((n) => n._);
    console.log("DEBUG: OPENROUTER_API_KEY exists?", !!env.OPENROUTER_API_KEY);
    console.log("DEBUG: process.env.OPENROUTER_API_KEY exists?", typeof process !== "undefined" ? !!process.env.OPENROUTER_API_KEY : "no-process");
    const body = await request.json();
    const processSingleRequest = async (body2) => {
      if (!body2.action) {
        return {
          success: false,
          error: "Missing required 'action' field. Must be one of: 'narrative', 'contradictions', 'business-plan'"
        };
      }
      const scores = body2.scores || {
        locationScore: body2.locationScore || 0,
        alignmentScore: body2.alignmentScore || 0
      };
      let result;
      switch (body2.action) {
        case "narrative": {
          if (!body2.intelReport || !body2.founderProfile || !body2.categoryConfig) {
            return { success: false, error: "Missing required fields for 'narrative': intelReport, founderProfile, categoryConfig" };
          }
          result = await generateLocationNarrative(body2.intelReport, body2.founderProfile, scores.locationScore, scores.alignmentScore, body2.categoryConfig);
          break;
        }
        case "contradictions": {
          if (!body2.founderProfile || !body2.intelReport) {
            return { success: false, error: "Missing required fields for 'contradictions': founderProfile, intelReport" };
          }
          result = await detectContradictions(body2.founderProfile, body2.intelReport, scores.locationScore, scores.alignmentScore);
          break;
        }
        case "business-plan": {
          if (!body2.founderProfile || !body2.intelReport || !body2.categoryConfig) {
            return { success: false, error: "Missing required fields for 'business-plan': founderProfile, intelReport, categoryConfig" };
          }
          result = await generateBusinessPlan(body2.founderProfile, body2.intelReport, scores, body2.categoryConfig);
          break;
        }
        case "compare": {
          if (!body2.addresses || body2.addresses.length < 2) {
            return { success: false, error: "Missing 'addresses' for compare action — requires 2-5 address objects" };
          }
          if (body2.addresses.length > 5) {
            return { success: false, error: "compare action supports a maximum of 5 addresses" };
          }
          const conceptType = body2.conceptType || "specialty_coffee";
          const conceptLabel = body2.conceptLabel || formatConcept(conceptType);
          result = await generateCompareRecommendation(body2.addresses, conceptType, conceptLabel);
          break;
        }
        case "vision-anchor": {
          const concept = body2.conceptType || "specialty_coffee";
          const label = body2.conceptLabel || formatConcept(concept);
          result = await generateVisionAnchorResearch(concept, label, body2.neighborhood || "", body2.borough || "", body2.differentiators || "", body2.targetClients || "", body2.competitors || 0, body2.medianIncome || 0);
          break;
        }
        case "fit-improvement": {
          const concept = body2.conceptType || "specialty_coffee";
          const label = body2.conceptLabel || formatConcept(concept);
          result = await generateFitImprovementRecs(concept, label, body2.neighborhood || "", body2.borough || "", body2.fitIQ || 0, body2.locationIQ || 0, body2.visionIQ || 0, body2.sixScores || {}, body2.monthlyRent || 0, body2.avgCheck || 0, body2.competitors || 0, body2.differentiators || "", body2.medianIncome || 0);
          break;
        }
        case "neighborhood-attractiveness": {
          const concept = body2.conceptType || "specialty_coffee";
          const label = body2.conceptLabel || formatConcept(concept);
          result = await generateNeighborhoodAttractiveness(concept, label, body2.borough || "Manhattan", body2.neighborhood || "", body2.locationIQ || 0, body2.fitIQ || 0, body2.transitScore || 0, body2.demographicsScore || 0, body2.vibrancyScore || 0, body2.medianIncome || 0);
          break;
        }
        case "business-case-recs": {
          const concept = body2.conceptType || "specialty_coffee";
          const label = body2.conceptLabel || formatConcept(concept);
          result = await generateBusinessCaseRecs(concept, label, body2.neighborhood || "", body2.borough || "", body2.address || "", body2.locationIQ || 0, body2.fitIQ || 0, body2.visionIQ || 0, body2.sixScores || {}, body2.dailyCust || 0, body2.avgCheck || 0, body2.annualRevenue || 0, body2.monthlyRent || 0, body2.cogsPct || 0, body2.laborCost || 0, body2.preTaxProfit || 0, body2.marginPct || 0, body2.rentToRevenuePct || 0, body2.medianIncome || 0, body2.walkScore || 0, body2.competitors || 0, body2.crimeScore || 0, body2.differentiators || "", body2.targetClients || "", body2.foodProgram || "", body2.storeType || "");
          break;
        }
        default: {
          return { success: false, error: `Invalid action '${body2.action}'. Must be one of: 'narrative', 'contradictions', 'business-plan', 'compare', 'vision-anchor', 'fit-improvement', 'neighborhood-attractiveness', 'business-case-recs'` };
        }
      }
      return { success: true, data: result };
    };
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map((req) => processSingleRequest(req).catch((err) => ({ success: false, error: err instanceof Error ? err.message : String(err) }))));
      return json({ success: true, data: results }, { status: 200 });
    } else {
      const result = await processSingleRequest(body);
      if (!result.success) {
        return json(result, { status: 400 });
      }
      return json(result, { status: 200 });
    }
  } catch (error) {
    console.error("API error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
};
export {
  POST
};
