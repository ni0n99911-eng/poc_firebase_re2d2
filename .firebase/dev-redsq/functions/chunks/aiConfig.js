import { S as SITE_CONFIG } from "./modules.js";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
function openRouterHeaders(apiKey) {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": SITE_CONFIG.url,
    "X-Title": "RE² Location Intelligence"
  };
}
export {
  OPENROUTER_URL as O,
  openRouterHeaders as o
};
