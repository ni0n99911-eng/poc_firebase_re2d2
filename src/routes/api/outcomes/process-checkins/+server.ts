/**
 * Cron endpoint — processes pending check-in emails.
 *
 * POST /api/outcomes/process-checkins
 *
 * Protected by a shared secret (CRON_SECRET env var).
 * Call from a cron job, scheduled task, or Netlify scheduled function.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getSupabase } from '$lib/supabase';
import { processCheckIns } from '$lib/outcome-checkins';

export const POST: RequestHandler = async ({ request }) => {
	// Verify cron secret
	const cronSecret = env.CRON_SECRET;
	if (cronSecret) {
		const authHeader = request.headers.get('authorization');
		const provided = authHeader?.replace('Bearer ', '');
		if (provided !== cronSecret) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	try {
		const supabase = getSupabase();
		const result = await processCheckIns(supabase);

		return new Response(JSON.stringify({
			ok: true,
			...result,
			processedAt: new Date().toISOString()
		}), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('[CRON] Process check-ins error:', err);
		return new Response(JSON.stringify({ error: 'Processing failed' }), { status: 500 });
	}
};
