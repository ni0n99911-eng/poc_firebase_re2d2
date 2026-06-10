/**
 * B2-T2: LLM response cache (24h Supabase, hash-keyed).
 *
 * Wraps a single OpenRouter / Anthropic / Haiku call so that identical
 * (model + prompt) pairs within the TTL window return the stored response
 * instead of re-hitting the provider. Cuts cold-cache CoPilot latency
 * from 7-21s down to <500ms on the second call for the same input.
 *
 * Migration: supabase/migrations/033_llm_cache.sql
 *
 * Caller pattern:
 *   const result = await getCachedOrFetch({
 *     model: 'anthropic/claude-sonnet-4',
 *     systemPrompt,
 *     userMessage,
 *     ttlHours: 24,
 *     route: '/api/copilot/location',
 *     fetcher: async () => callOpenRouter(...),  // only fires on miss
 *   });
 *   // result.fromCache is true on hit, false on miss.
 *
 * Failure modes:
 *   - Supabase down / table missing → miss, fall through to fetcher.
 *   - Cache row corrupt → miss, fall through to fetcher.
 *   - Fetcher throws → propagate (no swallowing).
 *
 * Telemetry parity: writes a logAiCall row with cache_hit=true on hit,
 * cache_hit=false on miss (in the metadata JSONB).
 */

import { createHash } from 'crypto';
import { logAiCall } from './telemetry';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';

export interface LlmCacheRequest<T> {
	/** Provider+model identifier, e.g. 'anthropic/claude-sonnet-4' */
	model: string;
	/** System prompt text — included in the cache key */
	systemPrompt: string;
	/** User message — included in the cache key */
	userMessage: string;
	/** TTL for new entries (default 24h) */
	ttlHours?: number;
	/** Route name for telemetry (e.g. '/api/copilot/location') */
	route: string;
	/** Optional Clerk user_id, persisted to ai_calls (NOT to the cache key) */
	userId?: string | null;
	/** Optional session id, persisted to ai_calls */
	sessionId?: string | null;
	/** Free-form metadata for telemetry only — keep small, no PII / raw prompts */
	metadata?: Record<string, unknown>;
	/** Function that performs the actual provider call. Only invoked on miss. */
	fetcher: () => Promise<{ content: T; tokensIn?: number; tokensOut?: number }>;
}

export interface LlmCacheResult<T> {
	content: T;
	fromCache: boolean;
	tokensIn?: number;
	tokensOut?: number;
}

/**
 * Hash (model + prompt) into a stable 64-char hex key. SHA-256 is overkill
 * for collision resistance here, but free at this volume and gives us a
 * clean fixed-length key for the UNIQUE index.
 */
export function llmCacheKey(model: string, systemPrompt: string, userMessage: string): string {
	const h = createHash('sha256');
	h.update(model);
	h.update('\u0000');
	h.update(systemPrompt);
	h.update('\u0000');
	h.update(userMessage);
	return h.digest('hex');
}

/**
 * Read-through cache. Always returns a result (cache or fresh) or throws
 * if the underlying fetcher throws.
 */
export async function getCachedOrFetch<T>(req: LlmCacheRequest<T>): Promise<LlmCacheResult<T>> {
	const ttlHours = Math.max(1, Math.min(168, req.ttlHours ?? 24));  // clamp 1h-7d
	const cacheKey = llmCacheKey(req.model, req.systemPrompt, req.userMessage);
	const startMs = Date.now();

	// ── Read path ───────────────────────────────────────────────────────
	let isDbAvailable = false;
	try {
		await db.execute(sql`SELECT 1`);
		isDbAvailable = true;
	} catch (err) {
		console.warn('[LLM-cache] DB unavailable; bypassing cache:', err instanceof Error ? err.message : err);
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
				const expires = new Date(row.expires_at as string).getTime();
				if (expires > Date.now()) {
					// Cache hit — log telemetry and return
					const fromCache: LlmCacheResult<T> = {
						content: row.response as T,
						fromCache: true,
						tokensIn:  row.tokens_in  as number | undefined,
						tokensOut: row.tokens_out as number | undefined,
					};
					try {
						logAiCall({
							route: req.route,
							model: req.model,
							tokensIn:  row.tokens_in  as number | null,
							tokensOut: row.tokens_out as number | null,
							durationMs: Date.now() - startMs,
							userId: req.userId,
							sessionId: req.sessionId,
							status: 'ok',
							metadata: { ...(req.metadata ?? {}), cache_hit: true },
						});
					} catch { /* telemetry never blocks */ }
					return fromCache;
				}
				// Expired — treat as miss; do NOT delete here, leave for cleanup job
			}
		} catch (err) {
			// Any other read error — fall through to fetcher
			console.warn('[LLM-cache] read threw (non-fatal):', err);
		}
	}

	// ── Miss / unavailable: fetch fresh ────────────────────────────────
	const fresh = await req.fetcher();

	if (isDbAvailable) {
		const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
		// Upsert on cache_key so a stale-but-not-expired entry gets replaced
		db.execute(sql`
			INSERT INTO llm_cache (cache_key, model, response, tokens_in, tokens_out, expires_at, metadata)
			VALUES (${cacheKey}, ${req.model}, ${JSON.stringify(fresh.content)}::jsonb, ${fresh.tokensIn ?? null}, ${fresh.tokensOut ?? null}, ${expiresAt}, ${JSON.stringify({ route: req.route, ...(req.metadata ?? {}) })}::jsonb)
			ON CONFLICT (cache_key) DO UPDATE SET
				model = EXCLUDED.model,
				response = EXCLUDED.response,
				tokens_in = EXCLUDED.tokens_in,
				tokens_out = EXCLUDED.tokens_out,
				expires_at = EXCLUDED.expires_at,
				metadata = EXCLUDED.metadata
		`).catch((err: unknown) => {
			console.warn('[LLM-cache] write threw:', err);
		});
	}

	// Telemetry (miss)
	try {
		logAiCall({
			route: req.route,
			model: req.model,
			tokensIn:  fresh.tokensIn,
			tokensOut: fresh.tokensOut,
			durationMs: Date.now() - startMs,
			userId: req.userId,
			sessionId: req.sessionId,
			status: 'ok',
			metadata: { ...(req.metadata ?? {}), cache_hit: false },
		});
	} catch { /* telemetry never blocks */ }

	return {
		content: fresh.content,
		fromCache: false,
		tokensIn:  fresh.tokensIn,
		tokensOut: fresh.tokensOut,
	};
}

