function sanitizeCopilotText(text) {
  if (!text) return "";
  let out = text;
  out = out.replace(/\*\*(.+?)\*\*/g, "$1");
  out = out.replace(/__(.+?)__/g, "$1");
  out = out.replace(/(^|[\s(\[{])\*([^\s*][^*]*?[^\s*]|[^\s*])\*(?=[\s.,!?;:)\]}]|$)/g, "$1$2");
  out = out.replace(/(^|[\s(\[{])_([^\s_][^_]*?[^\s_]|[^\s_])_(?=[\s.,!?;:)\]}]|$)/g, "$1$2");
  out = out.replace(/`([^`]+?)`/g, "$1");
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  out = out.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");
  out = out.replace(/^[ \t]{0,3}[-*][ \t]+/gm, "");
  return out;
}
const SAFE_TAGS = /* @__PURE__ */ new Set([
  "strong",
  "b",
  "em",
  "i",
  "br",
  "span",
  "p",
  "ul",
  "ol",
  "li",
  "sub",
  "sup"
]);
function sanitizeHtml(html) {
  if (!html) return "";
  let out = html;
  out = out.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/(href|src)\s*=\s*(?:"|')?\s*javascript\s*:/gi, '$1="blocked:');
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tagName) => {
    if (SAFE_TAGS.has(tagName.toLowerCase())) return match;
    return "";
  });
  out = out.replace(/<script[\s>][\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s>][\s\S]*?<\/style>/gi, "");
  out = out.replace(/<iframe[\s>][\s\S]*?<\/iframe>/gi, "");
  return out;
}
export {
  sanitizeHtml as a,
  sanitizeCopilotText as s
};
