/**
 * PATCH /api/deals/:id
 * Update a deal's status, rent, sqft, broker, notes, or dates.
 * Auto-appends a deal_event when status changes.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';

// Map status → event_type
const STATUS_EVENT: Record<string, string> = {
	touring: 'toured',
	negotiating: 'offer_submitted',
	signed: 'signed',
	passed: 'passed',
	lost: 'lost',
};

export const PATCH: RequestHandler = async ({ request, locals, params }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	const dealId = params.id;
	if (!dealId) throw error(400, 'deal id required');

	// Verify ownership
	const existingRes = await db.execute(sql`SELECT id, status, user_id FROM deal_pipeline WHERE id = ${dealId} AND user_id = ${user.id} LIMIT 1`);
	const existing = existingRes.rows[0] as any;

	if (!existing) throw error(404, 'Deal not found');

	const body = await request.json();
	const {
		status,
		asking_rent_monthly,
		square_footage,
		broker_id,
		toured_at,
		offer_submitted_at,
		decision_at,
		notes,
	} = body;

	// Build update payload — only include defined fields
	const updates: Record<string, unknown> = {};
	if (status !== undefined)               updates.status = status;
	if (asking_rent_monthly !== undefined)  updates.asking_rent_monthly = asking_rent_monthly;
	if (square_footage !== undefined)       updates.square_footage = square_footage;
	if (broker_id !== undefined)            updates.broker_id = broker_id;
	if (toured_at !== undefined)            updates.toured_at = toured_at;
	if (offer_submitted_at !== undefined)   updates.offer_submitted_at = offer_submitted_at;
	if (decision_at !== undefined)          updates.decision_at = decision_at;
	if (notes !== undefined)               updates.notes = notes;

	if (Object.keys(updates).length === 0) throw error(400, 'No fields to update');

	try {
		// Drizzle simple update via sql
		const setClauses = Object.keys(updates).map(k => sql`${sql.identifier(k)} = ${updates[k]}`);
		const updateQuery = sql`UPDATE deal_pipeline SET ${sql.join(setClauses, sql`, `)} WHERE id = ${dealId} AND user_id = ${user.id}`;
		await db.execute(updateQuery);

		// If status changed, append a matching event
		if (status && status !== existing.status && STATUS_EVENT[status]) {
			await db.execute(sql`
				INSERT INTO deal_events (deal_id, user_id, event_type)
				VALUES (${dealId}, ${user.id}, ${STATUS_EVENT[status]})
			`);
		}
	} catch (updateErr: any) {
		console.error('[deals PATCH] update error:', updateErr);
		return json({ ok: false, error: updateErr.message }, { status: 500 });
	}

	return json({ ok: true });
};
