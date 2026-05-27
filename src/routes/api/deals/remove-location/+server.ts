/**
 * DELETE /api/deals/remove-location
 * Removes a saved location from the user's shortlist.
 *
 * Body: { addr: string }
 * Action: hard-deletes the deal_pipeline row where address = addr AND user_id = current user.
 *         Associated deal_events rows are cascade-deleted by the FK constraint.
 * Returns: { ok: true }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	const body = await request.json();
	const { addr } = body as { addr?: string };

	if (!addr || typeof addr !== 'string' || addr.trim() === '') {
		throw error(400, 'addr is required');
	}

	const supabase = getServiceSupabase();

	const { error: dbErr, count } = await supabase
		.from('deal_pipeline')
		.delete({ count: 'exact' })
		.eq('user_id', user.id)
		.eq('address', addr.trim());

	if (dbErr) {
		console.error('[deals/remove-location] delete error:', dbErr);
		return json({ ok: false, error: dbErr.message }, { status: 500 });
	}

	// count === 0 means nothing matched — address wasn't in their shortlist.
	// Still return ok:true (idempotent — desired end state is achieved).
	return json({ ok: true, removed: count ?? 0 });
};
