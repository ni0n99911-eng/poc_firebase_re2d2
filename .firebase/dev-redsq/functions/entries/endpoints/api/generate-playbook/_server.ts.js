import { p as private_env } from "../../../../chunks/private.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
function buildSystemPrompt() {
  return `You are RE², an AI co-pilot for first-time retail founders. Your role is to generate 5 actionable next steps that are:

- Specific and data-driven (reference actual scores where possible)
- Ordered by impact and timeline (do this first, then that)
- Written in plain, encouraging language
- Focused on de-risking the location decision
- Grounded in the founder's business type and score profile

Each step should have:
- A bold, action-oriented title (5-8 words max)
- A 1-2 sentence explanation that references specific data or context
- Clear reasoning about why this step matters

Output ONLY valid JSON with no markdown, no code blocks, no extra text:
{
  "steps": [
    { "number": 1, "title": "Title here", "description": "Description here." },
    ...
  ]
}`;
}
function buildUserPrompt(data) {
  const scoresSummary = Object.entries(data.scores).map(([key, val]) => `${key}: ${Math.round(val)}/100`).join(" | ");
  const warningsSummary = data.warnings && data.warnings.length > 0 ? `
Key Warnings: ${data.warnings.join(", ")}` : "";
  return `Generate exactly 5 actionable next steps for this ${data.conceptDescription} concept using the data below:

Location: ${data.address}
Business Type: ${data.conceptDescription}
Persona: ${data.personaType}
Composite Score: ${data.compositeScore}/100

Detailed Scores: ${scoresSummary}${warningsSummary}

The founder needs a clear roadmap for validating this location before signing a lease. Focus on practical, doable actions they can take this week or next.`;
}
function generateFallbackSteps() {
  return [
    {
      number: 1,
      title: "Walk the block at peak hours",
      description: "Observe customer flow, parking challenges, and competing venues during your target operating hours. This ground truth trumps any data."
    },
    {
      number: 2,
      title: "Talk to 5 existing operators",
      description: "Find similar businesses nearby and ask about rent trends, lease terms, and hidden costs. You'll learn what the spreadsheet doesn't reveal."
    },
    {
      number: 3,
      title: "Verify utilities and infrastructure",
      description: "Have an inspector check electrical, plumbing, HVAC capacity, and any major build-out costs. This often surprises first-timers."
    },
    {
      number: 4,
      title: "Review the lease term carefully",
      description: "Negotiate length, renewal options, rent escalation clauses, and any tenant improvement allowances. Landlord expectations vary widely."
    },
    {
      number: 5,
      title: "Run a 7-day validation sprint",
      description: "Work from a nearby cafe, co-working space, or office to immerse yourself in the neighborhood. Get a real feel before you commit."
    }
  ];
}
function parsePlaybookResponse(content) {
  try {
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed.steps)) {
      return generateFallbackSteps();
    }
    const steps = parsed.steps.map((step, idx) => ({
      number: idx + 1,
      title: String(step.title || "Step").slice(0, 100),
      description: String(step.description || "").slice(0, 300)
    }));
    while (steps.length < 5) {
      steps.push({
        number: steps.length + 1,
        title: `Step ${steps.length + 1}`,
        description: "Validate this location before moving forward."
      });
    }
    return steps.slice(0, 5);
  } catch (err) {
    console.error("[GeneratePlaybook] Failed to parse response:", err);
    return generateFallbackSteps();
  }
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
        message: "Expected JSON with persona_type, concept_description, address, composite_score, scores"
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  const required = ["persona_type", "concept_description", "address", "composite_score", "scores"];
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
    const apiKey = private_env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn("[GeneratePlaybook] No OPENROUTER_API_KEY; returning fallback steps");
      return new Response(
        JSON.stringify({
          steps: generateFallbackSteps()
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://resquared.io",
        "X-Title": "RE² Location Intelligence"
      },
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
              scores: body.scores,
              warnings: body.warnings
            })
          }
        ]
      })
    });
    if (!openRouterResponse.ok) {
      const errText = await openRouterResponse.text();
      console.error("[GeneratePlaybook] OpenRouter API error:", openRouterResponse.status, errText);
      return new Response(
        JSON.stringify({
          steps: generateFallbackSteps()
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const completion = await openRouterResponse.json();
    const content = completion.choices?.[0]?.message?.content || "";
    const steps = parsePlaybookResponse(content);
    return new Response(
      JSON.stringify({
        steps
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600"
        }
      }
    );
  } catch (error) {
    console.error("[GeneratePlaybook] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        steps: generateFallbackSteps()
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
export {
  POST
};
