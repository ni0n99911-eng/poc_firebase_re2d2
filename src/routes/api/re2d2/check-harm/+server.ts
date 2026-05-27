/**
 * POST /api/re2d2/check-harm
 *
 * Haiku-based semantic harm check for differentiator answers.
 * Returns { safe: true } for all legitimate concepts including unusual ones.
 * Returns { safe: false } only for: terrorism, trafficking, sex work,
 * drug dealing, weapons dealing, organized crime, hate groups.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/auth-middleware';
import { generateResponse } from '$lib/openrouter-llm';

const HARM_SYSTEM_PROMPT = `You evaluate whether a business concept is legal and could legitimately operate in NYC.

Answer only YES (safe) or NO (harmful).

Answer NO ONLY for clearly illegal operations: terrorism, human trafficking, prostitution/sex work, drug dealing, illegal weapons dealing, organized crime, hate groups, or operations that explicitly exploit people illegally.

Answer YES for everything else — including unusual, quirky, niche, or provocative concepts. A sober bar, a cannabis dispensary, a strip club mentioned as a concept, an adult entertainment venue, an escort agency concept — these are legal businesses. Answer YES.

Be maximally permissive. Only answer NO for concepts where the primary business is inherently criminal.`;

export const POST: RequestHandler = async ({ request }) => {
    const auth = await requireAuth(request);
    if ('response' in auth) return auth.response;

    try {
        const { text } = await request.json() as { text: string };
        if (!text || typeof text !== 'string') {
            return new Response(JSON.stringify({ safe: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const trimmed = text.trim().slice(0, 500);

        // Fast pre-screen: if it's clearly too short or filler, skip Haiku
        if (trimmed.split(/\s+/).length < 2) {
            return new Response(JSON.stringify({ safe: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const userMsg = `Business concept: "${trimmed}"`;
        const response = await generateResponse('haiku', HARM_SYSTEM_PROMPT, userMsg, 5);
        const safe = !response?.trim().toUpperCase().startsWith('NO');

        return new Response(JSON.stringify({ safe }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        // If Haiku fails for any reason, default to safe — don't block users
        console.warn('[check-harm] Haiku check failed, defaulting to safe:', err instanceof Error ? err.message : err);
        return new Response(JSON.stringify({ safe: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
