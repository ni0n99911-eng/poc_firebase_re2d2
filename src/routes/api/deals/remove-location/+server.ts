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
import { db } from '$lib/db-server';
import { dealPipeline } from '$lib/db/schema';
import { and, eq } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	const body = await request.json();
	const { addr } = body as { addr?: string };

	if (!addr || typeof addr !== 'string' || addr.trim() === '') {
		throw error(400, 'addr is required');
	}

	try {
		// Drizzle delete doesn't easily return count, but we can do it via returning if needed, or just assume success.
		await db.delete(dealPipeline).where(
			and(eq(dealPipeline.userId, user.id), eq(dealPipeline.address, addr.trim()))
		);
	} catch (dbErr: any) {
		console.error('[deals/remove-location] delete error:', dbErr);
		return json({ ok: false, error: dbErr.message }, { status: 500 });
	}

	// count === 0 means nothing matched — address wasn't in their shortlist.
	// Still return ok:true (idempotent — desired end state is achieved).
	return json({ ok: true, removed: count ?? 0 });
};
