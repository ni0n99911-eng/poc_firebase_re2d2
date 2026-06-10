import { p as private_env } from "../../../../chunks/private.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
import { d as db, j as aiBriefs } from "../../../../chunks/db-server.js";
import { eq } from "drizzle-orm";
import { O as OPENROUTER_URL, o as openRouterHeaders } from "../../../../chunks/aiConfig.js";
function generateCacheKey(personaType, address) {
  const key = `${personaType.toLowerCase()}_${address.toLowerCase()}`;
  return Buffer.from(key).toString("base64");
}
function buildSystemPrompt() {
  return `You are RE², an AI co-pilot for first-time retail founders. Your role is to generate location intelligence briefs that are:

- Direct and warm in tone, never jargon-heavy
- Written for the founder's specific business type in their language
- Started with a clear verdict about the location fit
- Focused on the top 2-3 factors that matter most
- Alert to one non-obvious insight or hidden advantage
- Honest about one key risk or watch-out
- Closed with one specific, actionable next step

Your briefs are 3-5 paragraphs, data-informed, and designed to help founders make faster, better site selection decisions. Focus on what matters, not completeness. Use concrete details from the data (scores, counts, percentages) to anchor your analysis.`;
}
function buildUserPrompt(data) {
  const scoreDetails = data.spokeLabels.map((label, idx) => {
    const key = ["transit", "competition", "demographics", "vibrancy", "safety", "momentum"][idx];
    const score = data.indexScores[key] ?? 0;
    return `${label}: ${Math.round(score)}/100`;
  }).join(" | ");
  let context = `Location: ${data.address}
Business Type: ${data.conceptDescription}
Persona: ${data.personaType}
Composite Score: ${data.compositeScore}/100

Index Scores: ${scoreDetails}`;
  if (data.medianIncome) {
    context += `
Median Household Income: $${Math.round(data.medianIncome / 1e3)}k`;
  }
  if (data.competitorCount) {
    context += `
Competitors Nearby: ${data.competitorCount}`;
  }
  if (data.transitSummary) {
    context += `

Transit Context: ${data.transitSummary}`;
  }
  if (data.crimeSummary) {
    context += `
Safety Context: ${data.crimeSummary}`;
  }
  return `Generate a location intelligence brief for this ${data.conceptDescription} concept using the data below. The brief should be warm, direct coaching—help this founder decide if this location is worth pursuing.

${context}`;
}
const POST = async ({ request }) => {
  const limited = rateLimit(request, RATE_LIMITS.ai);
  if (limited) return limited;
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Invalid request body",
        message: "Expected JSON with persona_type, concept_description, address, etc."
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  const required = ["persona_type", "concept_description", "address", "composite_score", "index_scores"];
  for (const field of required) {
    if (!(field in body)) {
      return new Response(
        JSON.stringify({
          error: "Missing required field",
          field
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }
  try {
    const cacheKey = generateCacheKey(body.persona_type, body.address);
    let cachedBrief = null;
    try {
      const cachedRows = await db.select().from(aiBriefs).where(eq(aiBriefs.id, cacheKey)).limit(1);
      const cachedRow = cachedRows[0];
      const cached = cachedRow ? cachedRow.briefData : null;
      if (cached) {
        const cachedAtMs = new Date(cached.cached_at).getTime();
        const nowMs = Date.now();
        const age = (nowMs - cachedAtMs) / 1e3 / 60 / 60;
        if (age < 24) {
          cachedBrief = cached;
        }
      }
    } catch (cacheErr) {
      console.warn("[GenerateBrief] Cache check failed:", cacheErr instanceof Error ? cacheErr.message : cacheErr);
    }
    if (cachedBrief) {
      return new Response(
        JSON.stringify({
          narrative: cachedBrief.narrative,
          model: "anthropic/claude-sonnet-4",
          cached: true,
          cachedAt: cachedBrief.cached_at
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600"
          }
        }
      );
    }
    const apiKey = private_env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn("[GenerateBrief] No OPENROUTER_API_KEY; returning empty narrative");
      return new Response(
        JSON.stringify({
          narrative: "",
          model: "template",
          cached: false
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
    const openRouterResponse = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt()
          },
          {
            role: "user",
            content: buildUserPrompt({
              personaType: body.persona_type,
              conceptDescription: body.concept_description,
              address: body.address,
              compositeScore: body.composite_score,
              indexScores: body.index_scores,
              spokeLabels: body.spoke_labels || ["Transit", "Competition", "Demographics", "Concept Pulse", "Safety", "Momentum"],
              transitSummary: body.transit_summary,
              crimeSummary: body.crime_summary,
              competitorCount: body.competitor_count,
              medianIncome: body.median_income
            })
          }
        ]
      })
    });
    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      console.error("[GenerateBrief] OpenRouter API error:", openRouterResponse.status, errText);
      return new Response(
        JSON.stringify({ narrative: "", model: "template", cached: false }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const completion = await openRouterResponse.json();
    const narrative = completion.choices?.[0]?.message?.content || "";
    try {
      await db.insert(aiBriefs).values({
        id: cacheKey,
        briefData: {
          persona_type: body.persona_type,
          address: body.address,
          narrative,
          composite_score: body.composite_score,
          cached_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      }).onConflictDoUpdate({
        target: aiBriefs.id,
        set: {
          briefData: {
            persona_type: body.persona_type,
            address: body.address,
            narrative,
            composite_score: body.composite_score,
            cached_at: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      });
    } catch (cacheErr) {
      console.warn("[GenerateBrief] Cache write failed:", cacheErr instanceof Error ? cacheErr.message : cacheErr);
    }
    return new Response(
      JSON.stringify({
        narrative,
        model: "anthropic/claude-sonnet-4",
        cached: false
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=300"
          // Browser cache for 5 min
        }
      }
    );
  } catch (e) {
    console.error("[GenerateBrief] Error:", e);
    return new Response(
      JSON.stringify({
        narrative: "",
        model: "template",
        cached: false
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};
export {
  POST
};
