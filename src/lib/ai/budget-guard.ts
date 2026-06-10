/**
 * B2-T7: AI rate limits + monthly budget cap.
 *
 * Two guards stacked at the entry of every AI/CoPilot route:
 *   1. Per-user hourly cap — count ai_calls rows for user_id in the last
 *      60 minutes. ≥ 10 → 429 with "CoPilot limit reached — resets in
 *      {minutes} minutes."
 *   2. Monthly budget cap — sum cost_usd across all ai_calls for the
 *      current calendar month (UTC). > $50 → 503 with "Monthly AI budget
 *      reached — contact support."
 *
 * Both checks query the ai_calls table populated by logAiCall (B2-0.2).
 * If migration 032 hasn't been applied, both checks silently pass — the
 * helper never blocks the user-facing request when telemetry isn't ready.
 *
 * Caller pattern:
 *   const block = await checkAiBudget({ userId, sessionId });
 *   if (block) return block;     // 429 or 503 Response
 *   // ... continue with the AI call
 */

import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';

/** Per-user, per-rolling-hour ceiling. */
export const AI_HOURLY_USER_LIMIT = 10;

/** Site-wide monthly budget ceiling in USD. */
export const AI_MONTHLY_BUDGET_USD = 50;

export interface BudgetGuardInput {
	/** Clerk user_id when authenticated; falls back to sessionId for anon. */
	userId?: string | null;
	/** getOrCreateSessionId() value — used as the rate-limit key for anon users. */
	sessionId?: string | null;
	/** Override the limit (for trusted internal callers). Optional. */
	hourlyLimit?: number;
	/** Override the monthly cap. Optional. */
	monthlyBudgetUsd?: number;
}

/**
 * Returns null when both checks pass. Returns a Response (429 or 503) when
 * either limit has been reached. Never throws — failures fall open so the
 * request path keeps working when the table or service-role key is missing.
 */
export async function checkAiBudget(input: BudgetGuardInput): Promise<Response | null> {
	const limit = input.hourlyLimit ?? AI_HOURLY_USER_LIMIT;
	const budget = input.monthlyBudgetUsd ?? AI_MONTHLY_BUDGET_USD;

	try {
		// Just a dummy check if db is available
		db.execute(sql`SELECT 1`);
	} catch {
		// Service-role env not configured — fail open
		return null;
	}

	// ── Per-user hourly cap ─────────────────────────────────────────────
	const rateKey = input.userId ?? input.sessionId ?? null;
	if (rateKey) {
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		try {
			const result = await db.execute(sql`
				SELECT count(*) as count FROM ai_calls
				WHERE user_id = ${rateKey} AND created_at >= ${oneHourAgo}
			`);
			const count = result.rows?.[0]?.count ? Number(result.rows[0].count) : 0;

			if (count >= limit) {
				// Compute reset time = oldest call in window + 60min, then ceil to next minute.
				// Cheap enough to do a second small query for the oldest timestamp.
				const oldest = await db.execute(sql`
					SELECT created_at FROM ai_calls
					WHERE user_id = ${rateKey} AND created_at >= ${oneHourAgo}
					ORDER BY created_at ASC
					LIMIT 1
				`);

				const oldestTs = oldest.rows?.[0]?.created_at as string | undefined;
				let minutes = 60;
				if (oldestTs) {
					const resetMs = new Date(oldestTs).getTime() + 60 * 60 * 1000 - Date.now();
					minutes = Math.max(1, Math.ceil(resetMs / 60_000));
				}
				return new Response(JSON.stringify({
					error: `CoPilot limit reached — resets in ${minutes} minutes.`,
					code:  'ai_hourly_limit',
					retryAfterMinutes: minutes,
				}), {
					status: 429,
					headers: {
						'Content-Type':  'application/json',
						'Retry-After':   String(minutes * 60),
					},
				});
			}
		} catch (err) {
			console.warn('[budget-guard] hourly check threw (failing open):', err);
		}
	}

	// ── Site-wide monthly budget ────────────────────────────────────────
	try {
		const monthStart = new Date();
		monthStart.setUTCDate(1);
		monthStart.setUTCHours(0, 0, 0, 0);

		// Sum is best done server-side via an RPC, but a paginated select still
		// works at this volume. cap the read at 10k rows to avoid pathological
		// runaway scans.
		const result = await db.execute(sql`
			SELECT cost_usd FROM ai_calls
			WHERE created_at >= ${monthStart.toISOString()}
			  AND cost_usd IS NOT NULL
			LIMIT 10000
		`);

		if (result.rows) {
			let totalUsd = 0;
			for (const row of result.rows) {
				const c = row.cost_usd;
				if (c == null) continue;
				totalUsd += typeof c === 'string' ? parseFloat(c) : Number(c);
			}
			if (totalUsd > budget) {
				return new Response(JSON.stringify({
					error: 'Monthly AI budget reached — contact support.',
					code:  'ai_monthly_budget',
					monthSpendUsd: Math.round(totalUsd * 100) / 100,
					budgetUsd: budget,
				}), {
					status: 503,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}
	} catch (err) {
		console.warn('[budget-guard] monthly check threw (failing open):', err);
	}

	return null;
}
