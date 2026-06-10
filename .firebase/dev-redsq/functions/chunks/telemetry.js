import { d as db } from "./db-server.js";
import { sql } from "drizzle-orm";
const PRICING_USD_PER_1M_TOKENS = {
  // Anthropic via OpenRouter — April 2026 list prices
  "anthropic/claude-sonnet-4": { input: 3, output: 15 },
  "anthropic/claude-opus-4": { input: 15, output: 75 },
  "anthropic/claude-haiku-4": { input: 0.8, output: 4 },
  "anthropic/claude-3.5-sonnet": { input: 3, output: 15 },
  "anthropic/claude-3-haiku": { input: 0.25, output: 1.25 },
  // Raw Anthropic SDK model ids — in case callers don't go through MODEL_MAP
  "claude-opus-4-1": { input: 15, output: 75 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 }
};
const FALLBACK_PRICING = { input: 3, output: 15 };
function estimateCostUsd(model, tokensIn, tokensOut) {
  if (tokensIn == null && tokensOut == null) return null;
  const pricing = PRICING_USD_PER_1M_TOKENS[model] ?? FALLBACK_PRICING;
  const inCost = pricing.input * ((tokensIn ?? 0) / 1e6);
  const outCost = pricing.output * ((tokensOut ?? 0) / 1e6);
  const total = inCost + outCost;
  return Math.round(total * 1e6) / 1e6;
}
function logAiCall(input) {
  try {
    const cost_usd = estimateCostUsd(input.model, input.tokensIn, input.tokensOut);
    const row = {
      user_id: input.userId ?? null,
      session_id: input.sessionId ?? null,
      route: input.route,
      model: input.model,
      tokens_in: input.tokensIn ?? null,
      tokens_out: input.tokensOut ?? null,
      cost_usd,
      duration_ms: input.durationMs ?? null,
      status: input.status ?? "ok",
      error_code: input.errorCode ?? null,
      metadata: input.metadata ?? {}
    };
    db.execute(sql`
			INSERT INTO ai_calls (user_id, session_id, route, model, tokens_in, tokens_out, cost_usd, duration_ms, status, error_code, metadata)
			VALUES (${row.user_id}, ${row.session_id}, ${row.route}, ${row.model}, ${row.tokens_in}, ${row.tokens_out}, ${row.cost_usd}, ${row.duration_ms}, ${row.status}, ${row.error_code}, ${JSON.stringify(row.metadata)}::jsonb)
		`).catch((err) => {
      console.warn("[AI telemetry] insert threw:", err);
    });
  } catch (err) {
    console.warn("[AI telemetry] logAiCall threw (non-fatal):", err);
  }
}
export {
  estimateCostUsd,
  logAiCall
};
