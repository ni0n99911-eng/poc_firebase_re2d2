import { p as private_env } from "../../../../chunks/private.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
import { O as OPENROUTER_URL, o as openRouterHeaders } from "../../../../chunks/aiConfig.js";
const SYSTEM_PROMPT = `You are RE², an AI co-pilot for first-time retail founders. Your task is to generate 2-3 onboarding questions for a custom business type that will help tune location scoring.

RE² scores locations on 6 indices: transit, competition, demographics, vibrancy, safety, momentum.

For each question, provide 2-4 options. Each option should include a scoringHint — small weight adjustments (between -0.05 and +0.08) that shift the scoring algorithm based on the founder's answer.

Also determine which of these 10 known personas is closest to the custom business type:
coffee, restaurant, gym, dentist, spa, bodega, bakery, barber, boutique, florist

Respond ONLY with valid JSON matching this exact schema (no markdown, no explanation):
{
  "conceptPrompt": "Tell us about your [business type]",
  "placeholder": "e.g., [example description relevant to this business]",
  "closestPersona": "coffee",
  "questions": [
    {
      "id": "short_snake_case_id",
      "label": "Question text?",
      "type": "single",
      "options": [
        {
          "value": "snake_case_value",
          "label": "Display Label",
          "icon": "emoji",
          "scoringHint": { "transit": 0.05, "demographics": -0.03 }
        }
      ]
    }
  ]
}`;
const POST = async ({ request }) => {
  const limited = rateLimit(request, RATE_LIMITS.ai);
  if (limited) return limited;
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!body.business_type || body.business_type.trim().length < 2) {
    return new Response(
      JSON.stringify({ error: "business_type is required (min 2 characters)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const apiKey = private_env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        conceptPrompt: `Tell us about your ${body.business_type.toLowerCase()}`,
        placeholder: `Describe your ${body.business_type.toLowerCase()} concept in 1-2 sentences`,
        closestPersona: "coffee",
        questions: [
          {
            id: "traffic_need",
            label: "How important is foot traffic?",
            type: "single",
            options: [
              { value: "critical", label: "Critical", icon: "🚶", scoringHint: { transit: 0.05 } },
              { value: "helpful", label: "Helpful but not essential", icon: "👍", scoringHint: {} },
              { value: "not_needed", label: "Not needed", icon: "📱", scoringHint: { transit: -0.05, demographics: 0.05 } }
            ]
          },
          {
            id: "customer_type",
            label: "Who is your primary customer?",
            type: "single",
            options: [
              { value: "local", label: "Local residents", icon: "🏘️", scoringHint: { demographics: 0.05 } },
              { value: "commuter", label: "Commuters / Workers", icon: "💼", scoringHint: { transit: 0.05 } },
              { value: "destination", label: "Destination seekers", icon: "🗺️", scoringHint: { vibrancy: 0.05 } }
            ]
          }
        ]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
        max_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Generate onboarding questions for this custom business type: "${body.business_type}"` }
        ]
      })
    });
    if (!response.ok) {
      console.error("[GenerateQuestions] OpenRouter error:", response.status);
      return new Response(
        JSON.stringify({
          conceptPrompt: `Tell us about your ${body.business_type.toLowerCase()}`,
          placeholder: `Describe your ${body.business_type.toLowerCase()} concept`,
          closestPersona: "coffee",
          questions: []
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[GenerateQuestions] Failed to parse LLM response:", content.substring(0, 200));
      return new Response(
        JSON.stringify({
          conceptPrompt: `Tell us about your ${body.business_type.toLowerCase()}`,
          placeholder: `Describe your ${body.business_type.toLowerCase()} concept`,
          closestPersona: "coffee",
          questions: []
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const sanitized = {
      conceptPrompt: parsed.conceptPrompt || `Tell us about your ${body.business_type.toLowerCase()}`,
      placeholder: parsed.placeholder || "",
      closestPersona: parsed.closestPersona || "coffee",
      questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3).map((q) => ({
        id: String(q.id || "q_" + Math.random().toString(36).slice(2, 6)),
        label: String(q.label || ""),
        type: "single",
        options: Array.isArray(q.options) ? q.options.slice(0, 4).map((o) => ({
          value: String(o.value || ""),
          label: String(o.label || ""),
          icon: String(o.icon || "📍"),
          scoringHint: sanitizeScoringHint(o.scoringHint)
        })) : []
      })) : []
    };
    return new Response(
      JSON.stringify(sanitized),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[GenerateQuestions] Error:", err);
    return new Response(
      JSON.stringify({
        conceptPrompt: `Tell us about your ${body.business_type.toLowerCase()}`,
        placeholder: "",
        closestPersona: "coffee",
        questions: []
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
};
function sanitizeScoringHint(hint) {
  if (!hint || typeof hint !== "object") return {};
  const validKeys = ["transit", "competition", "demographics", "vibrancy", "safety", "momentum"];
  const result = {};
  for (const [key, val] of Object.entries(hint)) {
    if (validKeys.includes(key) && typeof val === "number") {
      result[key] = Math.max(-0.1, Math.min(0.1, val));
    }
  }
  return result;
}
export {
  POST
};
