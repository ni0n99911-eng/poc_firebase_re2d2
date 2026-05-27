/**
 * B2-0.2: AI call telemetry.
 *
 * Server-side helper for emitting one row per LLM invocation to the ai_calls
 * table. Phase 0 scope: observe cost, don't enforce limits. A later phase will
 * add per-user / per-day budget caps by querying this table.
 *
 * Usage:
 *   const start = Date.now();
 *   const result = await callProvider(...);
 *   logAiCall({
 *     route: '/api/copilot/location',
 *     model: 'anthropic/claude-sonnet-4',
 *     tokensIn:  result.usage?.prompt_tokens,
 *     tokensOut: result.usage?.completion_tokens,
 *     durationMs: Date.now() - start,
 *     userId,
 *     sessionId,
 *     metadata: { action: 'narrative' },
 *   });
 *
 * Fire-and-forget — failures MUST NOT break the user-facing response.
 */

import { getServiceSupabase } from '$lib/supabase-server';

/**
 * OpenRouter per-model USD pricing per 1M tokens (input / output).
 *
 * Keep in sync with https://openrouter.ai/models periodically. When a model
 * isn't listed we fall back to Sonnet pricing (conservative estimate) and log
 * a one-time warning. Missing pricing data never throws.
 */
const PRICING_USD_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
	// Anthropic via OpenRouter — April 2026 list prices
	'anthropic/claude-sonnet-4':  { input: 3.00,  output: 15.00 },
	'anthropic/claude-opus-4':    { input: 15.00, output: 75.00 },
	'anthropic/claude-haiku-4':   { input: 0.80,  output: 4.00 },
	'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00 },
	'anthropic/claude-3-haiku':   { input: 0.25,  output: 1.25 },
	// Raw Anthropic SDK model ids — in case callers don't go through MODEL_MAP
	'claude-opus-4-1':            { input: 15.00, output: 75.00 },
	'claude-3-5-sonnet-20241022': { input: 3.00,  output: 15.00 },
};

// Fallback pricing when model isn't in the table — use Sonnet (conservative).
const FALLBACK_PRICING = { input: 3.00, output: 15.00 };

export function estimateCostUsd(model: string, tokensIn?: number | null, tokensOut?: number | null): number | null {
	if (tokensIn == null && tokensOut == null) return null;
	const pricing = PRICING_USD_PER_1M_TOKENS[model] ?? FALLBACK_PRICING;
	const inCost  = pricing.input  * ((tokensIn  ?? 0) / 1_000_000);
	const outCost = pricing.output * ((tokensOut ?? 0) / 1_000_000);
	const total = inCost + outCost;
	// Round to 6 decimals to match NUMERIC(10,6) column precision
	return Math.round(total * 1_000_000) / 1_000_000;
}

export interface AiCallLogInput {
	route: string;                        // e.g. '/api/copilot/location'
	model: string;                        // e.g. 'anthropic/claude-sonnet-4'
	tokensIn?:  number | null;
	tokensOut?: number | null;
	durationMs?: number;
	userId?: string | null;
	sessionId?: string | null;
	status?: 'ok' | 'error' | 'timeout';
	errorCode?: string | null;
	metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget. Never awaits. Never throws. Logs to console.warn on
 * insertion failure so we don't drop telemetry silently, but never blocks
 * the caller's response.
 */
export function logAiCall(input: AiCallLogInput): void {
	try {
		const cost_usd = estimateCostUsd(input.model, input.tokensIn, input.tokensOut);
		const row = {
			user_id:     input.userId     ?? null,
			session_id:  input.sessionId  ?? null,
			route:       input.route,
			model:       input.model,
			tokens_in:   input.tokensIn   ?? null,
			tokens_out:  input.tokensOut  ?? null,
			cost_usd,
			duration_ms: input.durationMs ?? null,
			status:      input.status     ?? 'ok',
			error_code:  input.errorCode  ?? null,
			metadata:    input.metadata   ?? {},
		};

		const sb = getServiceSupabase();
		// Fire-and-forget: no await. Any DB failure is logged but doesn't affect the caller.
		sb.from('ai_calls').insert(row).then(({ error }) => {
			if (error) {
				// 42P01 = table doesn't exist yet (migration not applied) — don't spam logs
				if (error.code === '42P01') return;
				console.warn('[AI telemetry] insert failed:', error.code, error.message);
			}
		}, (err: unknown) => {
			console.warn('[AI telemetry] insert threw:', err);
		});
	} catch (err) {
		// getServiceSupabase() can throw if env vars are missing at module load.
		// Never let telemetry break the request path.
		console.warn('[AI telemetry] logAiCall threw (non-fatal):', err);
	}
}
