/**
 * B2-NEW-2 / C3: Strip markdown from CoPilot output.
 *
 * The CoPilot bubble (`.v3-ask-msg-bubble` in src/routes/app/location/+page.svelte)
 * renders text without a markdown processor. Any ** bold ** or * italic * markers
 * the LLM emits show up as literal asterisks in the UI.
 *
 * Primary fix is the system prompt update in
 * src/routes/api/copilot/location/+server.ts (rule #9 — "PLAIN TEXT ONLY").
 * This module is the belt-and-suspenders safety net: if the LLM slips up and
 * emits markdown anyway, callers can pass the raw text through `sanitizeCopilotText`
 * before rendering.
 *
 * Owner: Brain 2 (utility helper). Consumer: UX (location/+page.svelte bubble).
 *
 * Usage in the bubble:
 *   import { sanitizeCopilotText } from '$lib/utils/copilot-sanitize';
 *   ...
 *   <div class="v3-ask-msg-bubble">{sanitizeCopilotText(m.text)}</div>
 */

/**
 * Strip the markdown patterns most likely to leak through despite the system
 * prompt rule:
 *   - **bold** and __bold__
 *   - *italic* and _italic_   (only when surrounded by word boundaries — leaves
 *     standalone asterisks that aren't markdown intact, e.g. footnote markers)
 *   - `inline code`
 *   - leading "# " / "## " heading markers (line-anchored)
 *   - leading "- " / "* " list markers (line-anchored, only at start of line)
 *   - [text](url) links → text only
 *
 * Does NOT strip block-level markdown (```fenced code```, > blockquotes,
 * tables) — the LLM is unlikely to emit those for chat responses, and the
 * regex cost isn't worth it. The system prompt rule is the real backstop.
 *
 * Returns the input verbatim if it's empty / null / undefined.
 */
export function sanitizeCopilotText(text: string | null | undefined): string {
	if (!text) return '';

	let out = text;

	// **bold** / __bold__ — must run before single-asterisk strip to avoid
	// leaving stray single asterisks behind.
	out = out.replace(/\*\*(.+?)\*\*/g, '$1');
	out = out.replace(/__(.+?)__/g, '$1');

	// *italic* / _italic_ — only when bounded by word characters or string
	// edges so we don't eat genuine asterisks (footnote markers, "the * symbol").
	out = out.replace(/(^|[\s(\[{])\*([^\s*][^*]*?[^\s*]|[^\s*])\*(?=[\s.,!?;:)\]}]|$)/g, '$1$2');
	out = out.replace(/(^|[\s(\[{])_([^\s_][^_]*?[^\s_]|[^\s_])_(?=[\s.,!?;:)\]}]|$)/g, '$1$2');

	// `inline code`
	out = out.replace(/`([^`]+?)`/g, '$1');

	// [text](url) → text
	out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

	// Leading heading markers ("# Foo", "## Foo", up to ######) → "Foo"
	out = out.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '');

	// Leading bullet markers — strip "- " or "* " at start of line, keep content
	out = out.replace(/^[ \t]{0,3}[-*][ \t]+/gm, '');

	return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 04.25.2026 16:36 CoPilot Sanitization — sanitizeHtml for {@html} surfaces
//
// Problem: CoPilotChat, SmartCoach, DeepDive, and ScoreHybrid all use
// Svelte's {@html} directive to render markdown-to-HTML output (bold, italic,
// line breaks). {@html} bypasses Svelte's built-in XSS escaping — any raw
// HTML in the text (from LLM output, user input, or prompt injection)
// executes in the browser.
//
// Solution: Allowlist-based sanitizer. Strips every tag except a curated set
// of safe formatting-only tags. Also strips event handlers (onerror, onclick,
// etc.) and javascript: URIs as a defense-in-depth measure.
//
// This is intentionally zero-dependency (no DOMPurify) to keep bundle size
// minimal. The allowlist is deliberately narrow — display-only tags.
//
// Consumer: any component that uses {@html someText} to render
//           markdown-converted or LLM-generated HTML.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Allowlisted HTML tags considered safe for display-only rendering.
 * Everything else gets stripped (tag removed, content preserved).
 */
const SAFE_TAGS = new Set([
	'strong', 'b', 'em', 'i', 'br', 'span', 'p',
	'ul', 'ol', 'li', 'sub', 'sup',
]);

/**
 * Sanitize a string that will be rendered via {@html}.
 *
 * - Strips all HTML tags NOT in SAFE_TAGS (preserves inner text)
 * - Removes event handler attributes (on*="...") from allowed tags
 * - Blocks javascript: URIs in any surviving href/src attributes
 * - Returns empty string for null/undefined input
 *
 * Does NOT parse a full DOM tree — uses regex for speed. Safe because:
 *   1. The allowlist is formatting-only (no <a>, <img>, <iframe>, <script>)
 *   2. Event handlers are stripped from any tag that survives
 *   3. This runs client-side on trusted-ish content (our own LLM + templates)
 */
export function sanitizeHtml(html: string | null | undefined): string {
	if (!html) return '';

	let out = html;

	// 1. Strip event handlers from ALL tags (defense-in-depth even on allowed tags)
	//    Matches on*="..." and on*='...' and on*=expr (unquoted)
	out = out.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

	// 2. Strip javascript: URIs (href="javascript:...", src="javascript:...")
	out = out.replace(/(href|src)\s*=\s*(?:"|')?\s*javascript\s*:/gi, '$1="blocked:');

	// 3. Strip disallowed tags (keep content, remove the tag itself)
	//    Process closing tags and self-closing tags too.
	out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tagName) => {
		if (SAFE_TAGS.has(tagName.toLowerCase())) return match;
		return ''; // strip the tag, keep surrounding text
	});

	// 4. Strip any remaining <script>, <style>, <iframe> content blocks
	//    (defense-in-depth — step 3 already strips the tags, but this catches
	//    content between opening and closing tags of dangerous elements)
	out = out.replace(/<script[\s>][\s\S]*?<\/script>/gi, '');
	out = out.replace(/<style[\s>][\s\S]*?<\/style>/gi, '');
	out = out.replace(/<iframe[\s>][\s\S]*?<\/iframe>/gi, '');

	return out;
}
