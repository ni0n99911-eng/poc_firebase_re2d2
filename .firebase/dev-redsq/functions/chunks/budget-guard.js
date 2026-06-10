import { d as db } from "./db-server.js";
import { sql } from "drizzle-orm";
const AI_HOURLY_USER_LIMIT = 10;
const AI_MONTHLY_BUDGET_USD = 50;
async function checkAiBudget(input) {
  const limit = input.hourlyLimit ?? AI_HOURLY_USER_LIMIT;
  const budget = input.monthlyBudgetUsd ?? AI_MONTHLY_BUDGET_USD;
  try {
    db.execute(sql`SELECT 1`);
  } catch {
    return null;
  }
  const rateKey = input.userId ?? input.sessionId ?? null;
  if (rateKey) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3).toISOString();
    try {
      const result = await db.execute(sql`
				SELECT count(*) as count FROM ai_calls
				WHERE user_id = ${rateKey} AND created_at >= ${oneHourAgo}
			`);
      const count = result.rows?.[0]?.count ? Number(result.rows[0].count) : 0;
      if (count >= limit) {
        const oldest = await db.execute(sql`
					SELECT created_at FROM ai_calls
					WHERE user_id = ${rateKey} AND created_at >= ${oneHourAgo}
					ORDER BY created_at ASC
					LIMIT 1
				`);
        const oldestTs = oldest.rows?.[0]?.created_at;
        let minutes = 60;
        if (oldestTs) {
          const resetMs = new Date(oldestTs).getTime() + 60 * 60 * 1e3 - Date.now();
          minutes = Math.max(1, Math.ceil(resetMs / 6e4));
        }
        return new Response(JSON.stringify({
          error: `CoPilot limit reached — resets in ${minutes} minutes.`,
          code: "ai_hourly_limit",
          retryAfterMinutes: minutes
        }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(minutes * 60)
          }
        });
      }
    } catch (err) {
      console.warn("[budget-guard] hourly check threw (failing open):", err);
    }
  }
  try {
    const monthStart = /* @__PURE__ */ new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
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
        totalUsd += typeof c === "string" ? parseFloat(c) : Number(c);
      }
      if (totalUsd > budget) {
        return new Response(JSON.stringify({
          error: "Monthly AI budget reached — contact support.",
          code: "ai_monthly_budget",
          monthSpendUsd: Math.round(totalUsd * 100) / 100,
          budgetUsd: budget
        }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  } catch (err) {
    console.warn("[budget-guard] monthly check threw (failing open):", err);
  }
  return null;
}
export {
  AI_HOURLY_USER_LIMIT,
  AI_MONTHLY_BUDGET_USD,
  checkAiBudget
};
