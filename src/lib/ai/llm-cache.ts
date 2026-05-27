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
	let supabase: Awaited<ReturnType<typeof getSupabaseService>> | null = null;
	try {
		supabase = await getSupabaseService();
	} catch (err) {
		// supabase-server module / env not available — skip caching, fall straight to fetcher
		console.warn('[LLM-cache] service client unavailable; bypassing cache:', err instanceof Error ? err.message : err);
	}

	if (supabase) {
		try {
			const { data, error } = await supabase
				.from('llm_cache')
				.select('response, tokens_in, tokens_out, expires_at')
				.eq('cache_key', cacheKey)
				.maybeSingle();

			if (!error && data) {
				const expires = new Date(data.expires_at as string).getTime();
				if (expires > Date.now()) {
					// Cache hit — log telemetry and return
					const fromCache: LlmCacheResult<T> = {
						content: data.response as T,
						fromCache: true,
						tokensIn:  data.tokens_in  as number | undefined,
						tokensOut: data.tokens_out as number | undefined,
					};
					try {
						logAiCall({
							route: req.route,
							model: req.model,
							tokensIn:  data.tokens_in  as number | null,
							tokensOut: data.tokens_out as number | null,
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
			if (error && error.code !== '42P01') {
				// 42P01 = table missing (migration not yet applied) — silent fall-through
				console.warn('[LLM-cache] read error (non-fatal):', error.code, error.message);
			}
		} catch (err) {
			// Any other read error — fall through to fetcher
			console.warn('[LLM-cache] read threw (non-fatal):', err);
		}
	}

	// ── Miss / unavailable: fetch fresh ────────────────────────────────
	const fresh = await req.fetcher();

	// ── Write path (fire-and-forget) ───────────────────────────────────
	if (supabase) {
		const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
		const row = {
			cache_key:  cacheKey,
			model:      req.model,
			response:   fresh.content,
			tokens_in:  fresh.tokensIn  ?? null,
			tokens_out: fresh.tokensOut ?? null,
			expires_at: expiresAt,
			metadata:   { route: req.route, ...(req.metadata ?? {}) },
		};
		// Upsert on cache_key so a stale-but-not-expired entry gets replaced
		supabase.from('llm_cache').upsert(row, { onConflict: 'cache_key' }).then(({ error }) => {
			if (error) {
				if (error.code === '42P01') return; // table missing — silent
				console.warn('[LLM-cache] write failed:', error.code, error.message);
			}
		}, (err: unknown) => {
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

// ─── Internal: lazy supabase client loader ──────────────────────────────
// Imported dynamically so test runs without DB env vars don't crash the
// module at load time.
async function getSupabaseService() {
	const { getServiceSupabase } = await import('$lib/supabase-server');
	return getServiceSupabase();
}
