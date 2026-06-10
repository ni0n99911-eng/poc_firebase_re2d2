/**
 * POST /api/deals/:id/events
 * Manually log an event (note, broker intro, etc.) on a deal.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';

const VALID_TYPES = [
	'saved', 'viewed', 'toured', 'broker_intro',
	'offer_submitted', 'counter_received',
	'signed', 'passed', 'lost', 'note',
];

export const POST: RequestHandler = async ({ request, locals, params }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	const dealId = params.id;
	if (!dealId) throw error(400, 'deal id required');

	const body = await request.json();
	const { event_type, notes, event_data = {} } = body;

	if (!event_type || !VALID_TYPES.includes(event_type)) {
		throw error(400, `event_type must be one of: ${VALID_TYPES.join(', ')}`);
	}

	try {
		// Verify ownership
		const resDeal = await db.execute(sql`
			SELECT id FROM deal_pipeline 
			WHERE id = ${dealId} AND user_id = ${user.id} LIMIT 1
		`);

		if (!resDeal.rows.length) throw error(404, 'Deal not found');

		await db.execute(sql`
			INSERT INTO deal_events (deal_id, user_id, event_type, notes, event_data)
			VALUES (${dealId}, ${user.id}, ${event_type}, ${notes ?? null}, ${JSON.stringify(event_data)})
		`);
	} catch (insertErr: any) {
		console.error('[deals/events POST] error:', insertErr);
		return json({ ok: false, error: insertErr.message }, { status: 500 });
	}

	return json({ ok: true });
};
