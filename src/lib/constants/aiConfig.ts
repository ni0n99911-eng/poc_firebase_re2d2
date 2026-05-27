/**
 * aiConfig.ts — Shared constants for all server-side AI (OpenRouter) requests.
 *
 * #53: Replaces inline 'HTTP-Referer': 'https://resquared.io' in 5 API routes.
 * #54: Replaces inline 'https://openrouter.ai/api/v1/chat/completions' in 5 API routes.
 *
 * Import in any +server.ts that calls OpenRouter:
 *   import { OPENROUTER_URL, openRouterHeaders } from '$lib/constants/aiConfig';
 */

import { SITE_CONFIG } from '$lib/modules';

/** OpenRouter chat completions endpoint. */
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Standard headers for all OpenRouter requests.
 * Pass your Authorization token separately — do not hardcode it here.
 *
 * Usage:
 *   headers: {
 *     ...openRouterHeaders(apiKey),
 *     'Content-Type': 'application/json',
 *   }
 */
export function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': SITE_CONFIG.url,
    'X-Title': 'RE² Location Intelligence',
  };
}
