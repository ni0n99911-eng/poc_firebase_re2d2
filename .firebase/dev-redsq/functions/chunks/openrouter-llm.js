const __vite_import_meta_env__ = {};
const MODELS = {
  /** Fast + cheap: RE2D2 acknowledgments, simple explanations */
  haiku: "anthropic/claude-3.5-haiku",
  /** Balanced: copilot responses, score explanations, what-if analysis */
  sonnet: "anthropic/claude-sonnet-4"
};
const _cache = /* @__PURE__ */ new Map();
const CACHE_TTL_MS = 30 * 60 * 1e3;
const MAX_CACHE_SIZE = 200;
function getCacheKey(model, system, lastMessage) {
  return `${model}:${system.slice(0, 50)}:${lastMessage.slice(0, 100)}`;
}
function getCached(key) {
  const entry = _cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.response;
  if (entry) _cache.delete(key);
  return null;
}
function setCache(key, response) {
  if (_cache.size >= MAX_CACHE_SIZE) {
    const firstKey = _cache.keys().next().value;
    if (firstKey) _cache.delete(firstKey);
  }
  _cache.set(key, { response, expiresAt: Date.now() + CACHE_TTL_MS });
}
async function callLLM(req) {
  const apiKey = process.env.OPENROUTER_API_KEY || __vite_import_meta_env__?.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");
  const modelId = MODELS[req.model];
  const lastMsg = req.messages[req.messages.length - 1]?.content || "";
  if (req.model === "haiku") {
    const cacheKey = getCacheKey(modelId, req.system, lastMsg);
    const cached = getCached(cacheKey);
    if (cached) {
      return {
        content: cached,
        model: modelId,
        tokens: { input: 0, output: 0 },
        latencyMs: 0
      };
    }
  }
  const startMs = Date.now();
  const body = {
    model: modelId,
    messages: [
      { role: "system", content: req.system },
      ...req.messages
    ],
    max_tokens: req.maxTokens || 512,
    temperature: req.temperature ?? 0.7
  };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://resquared.io",
      "X-Title": "RE2 Location Intelligence"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15e3)
    // 15s timeout
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    throw new Error(`OpenRouter ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const latencyMs = Date.now() - startMs;
  if (req.model === "haiku" && content) {
    const cacheKey = getCacheKey(modelId, req.system, lastMsg);
    setCache(cacheKey, content);
  }
  return {
    content,
    model: modelId,
    tokens: {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0
    },
    latencyMs
  };
}
async function generateResponse(model, system, userMessage, maxTokens = 512) {
  const result = await callLLM({
    model,
    system,
    messages: [{ role: "user", content: userMessage }],
    maxTokens
  });
  return result.content;
}
export {
  callLLM as c,
  generateResponse as g
};
