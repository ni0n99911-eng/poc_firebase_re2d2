/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RE² Checklist Sync API — POST /api/checklist-sync
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Saves user progress (check/uncheck, notes) to Supabase.
 * Upserts into checklist_progress using UNIQUE(user_id, location_id, item_id).
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user?.id) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();
	const { locationId, items } = body;

	if (!locationId || !Array.isArray(items) || items.length === 0) {
		throw error(400, 'locationId and items[] are required');
	}

	try {
		const supabase = getServiceSupabase();
		const now = new Date().toISOString();

		// Build upsert rows
		const rows = items.map((item: { itemId: string; done: boolean; notes: string }) => ({
			user_id: user.id,
			location_id: locationId,
			item_id: item.itemId,
			done: item.done,
			notes: item.notes || '',
			completed_at: item.done ? now : null,
			updated_at: now,
		}));

		const { error: dbError } = await supabase
			.from('checklist_progress')
			.upsert(rows, {
				onConflict: 'user_id,location_id,item_id',
			});

		if (dbError) {
			console.error('[checklist-sync] Supabase upsert error:', dbError);
			return json({ success: false, error: dbError.message }, { status: 500 });
		}

		return json({ success: true, updatedAt: now });
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('[checklist-sync] Error:', err);
		return json({ success: false, error: 'Internal error' }, { status: 500 });
	}
};
