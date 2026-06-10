import { createHash } from "crypto";
import { logAiCall } from "./telemetry.js";
import { d as db } from "./db-server.js";
import { sql } from "drizzle-orm";
function llmCacheKey(model, systemPrompt, userMessage) {
  const h = createHash("sha256");
  h.update(model);
  h.update("\0");
  h.update(systemPrompt);
  h.update("\0");
  h.update(userMessage);
  return h.digest("hex");
}
async function getCachedOrFetch(req) {
  const ttlHours = Math.max(1, Math.min(168, req.ttlHours ?? 24));
  const cacheKey = llmCacheKey(req.model, req.systemPrompt, req.userMessage);
  const startMs = Date.now();
  let isDbAvailable = false;
  try {
    await db.execute(sql`SELECT 1`);
    isDbAvailable = true;
  } catch (err) {
    console.warn("[LLM-cache] DB unavailable; bypassing cache:", err instanceof Error ? err.message : err);
  }
  if (isDbAvailable) {
    try {
      const result = await db.execute(sql`
				SELECT response, tokens_in, tokens_out, expires_at 
				FROM llm_cache 
				WHERE cache_key = ${cacheKey}
			`);
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        const expires = new Date(row.expires_at).getTime();
        if (expires > Date.now()) {
          const fromCache = {
            content: row.response,
            fromCache: true,
            tokensIn: row.tokens_in,
            tokensOut: row.tokens_out
          };
          try {
            logAiCall({
              route: req.route,
              model: req.model,
              tokensIn: row.tokens_in,
              tokensOut: row.tokens_out,
              durationMs: Date.now() - startMs,
              userId: req.userId,
              sessionId: req.sessionId,
              status: "ok",
              metadata: { ...req.metadata ?? {}, cache_hit: true }
            });
          } catch {
          }
          return fromCache;
        }
      }
    } catch (err) {
      console.warn("[LLM-cache] read threw (non-fatal):", err);
    }
  }
  const fresh = await req.fetcher();
  if (isDbAvailable) {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1e3).toISOString();
    db.execute(sql`
			INSERT INTO llm_cache (cache_key, model, response, tokens_in, tokens_out, expires_at, metadata)
			VALUES (${cacheKey}, ${req.model}, ${fresh.content}::jsonb, ${fresh.tokensIn ?? null}, ${fresh.tokensOut ?? null}, ${expiresAt}, ${JSON.stringify({ route: req.route, ...req.metadata ?? {} })}::jsonb)
			ON CONFLICT (cache_key) DO UPDATE SET
				model = EXCLUDED.model,
				response = EXCLUDED.response,
				tokens_in = EXCLUDED.tokens_in,
				tokens_out = EXCLUDED.tokens_out,
				expires_at = EXCLUDED.expires_at,
				metadata = EXCLUDED.metadata
		`).catch((err) => {
      console.warn("[LLM-cache] write threw:", err);
    });
  }
  try {
    logAiCall({
      route: req.route,
      model: req.model,
      tokensIn: fresh.tokensIn,
      tokensOut: fresh.tokensOut,
      durationMs: Date.now() - startMs,
      userId: req.userId,
      sessionId: req.sessionId,
      status: "ok",
      metadata: { ...req.metadata ?? {}, cache_hit: false }
    });
  } catch {
  }
  return {
    content: fresh.content,
    fromCache: false,
    tokensIn: fresh.tokensIn,
    tokensOut: fresh.tokensOut
  };
}
export {
  getCachedOrFetch,
  llmCacheKey
};
