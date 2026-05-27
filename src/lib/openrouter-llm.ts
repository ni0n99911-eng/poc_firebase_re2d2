/**
 * OpenRouter LLM Client — Thread 6B
 *
 * Wraps OpenRouter API for Claude Sonnet (interactive) and Haiku (acknowledgments).
 * Includes response caching for common patterns.
 */

// ── Models ──
export const MODELS = {
	/** Fast + cheap: RE2D2 acknowledgments, simple explanations */
	haiku: 'anthropic/claude-3.5-haiku',
	/** Balanced: copilot responses, score explanations, what-if analysis */
	sonnet: 'anthropic/claude-sonnet-4',
} as const;

type ModelKey = keyof typeof MODELS;

interface LLMRequest {
	model: ModelKey;
	system: string;
	messages: { role: 'user' | 'assistant'; content: string }[];
	maxTokens?: number;
	temperature?: number;
}

interface LLMResponse {
	content: string;
	model: string;
	tokens: { input: number; output: number };
	latencyMs: number;
}

// ── Simple in-memory cache for common responses ──
const _cache = new Map<string, { response: string; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 200;

function getCacheKey(model: string, system: string, lastMessage: string): string {
	// Only cache short, predictable interactions (e.g., RE2D2 acknowledgments)
	return `${model}:${system.slice(0, 50)}:${lastMessage.slice(0, 100)}`;
}

function getCached(key: string): string | null {
	const entry = _cache.get(key);
	if (entry && entry.expiresAt > Date.now()) return entry.response;
	if (entry) _cache.delete(key);
	return null;
}

function setCache(key: string, response: string): void {
	if (_cache.size >= MAX_CACHE_SIZE) {
		// Evict oldest entries
		const firstKey = _cache.keys().next().value;
		if (firstKey) _cache.delete(firstKey);
	}
	_cache.set(key, { response, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Main LLM call ──

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
	const apiKey = process.env.OPENROUTER_API_KEY || (import.meta as any).env?.OPENROUTER_API_KEY;
	if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

	const modelId = MODELS[req.model];
	const lastMsg = req.messages[req.messages.length - 1]?.content || '';

	// Check cache for Haiku requests (acknowledgments)
	if (req.model === 'haiku') {
		const cacheKey = getCacheKey(modelId, req.system, lastMsg);
		const cached = getCached(cacheKey);
		if (cached) {
			return {
				content: cached,
				model: modelId,
				tokens: { input: 0, output: 0 },
				latencyMs: 0,
			};
		}
	}

	const startMs = Date.now();

	const body = {
		model: modelId,
		messages: [
			{ role: 'system' as const, content: req.system },
			...req.messages,
		],
		max_tokens: req.maxTokens || 512,
		temperature: req.temperature ?? 0.7,
	};

	const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
			'HTTP-Referer': 'https://resquared.io',
			'X-Title': 'RE2 Location Intelligence',
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(15000), // 15s timeout
	});

	if (!res.ok) {
		const errText = await res.text().catch(() => 'unknown');
		throw new Error(`OpenRouter ${res.status}: ${errText}`);
	}

	const data = await res.json();
	const content = data.choices?.[0]?.message?.content || '';
	const latencyMs = Date.now() - startMs;

	// Cache Haiku responses
	if (req.model === 'haiku' && content) {
		const cacheKey = getCacheKey(modelId, req.system, lastMsg);
		setCache(cacheKey, content);
	}

	return {
		content,
		model: modelId,
		tokens: {
			input: data.usage?.prompt_tokens || 0,
			output: data.usage?.completion_tokens || 0,
		},
		latencyMs,
	};
}

/**
 * Convenience: Generate a single response from a system prompt + user message.
 */
export async function generateResponse(
	model: ModelKey,
	system: string,
	userMessage: string,
	maxTokens = 512
): Promise<string> {
	const result = await callLLM({
		model,
		system,
		messages: [{ role: 'user', content: userMessage }],
		maxTokens,
	});
	return result.content;
}
