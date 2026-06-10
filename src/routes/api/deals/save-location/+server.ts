/**
 * POST /api/deals/save-location
 * Creates a deal_pipeline row + initial 'saved' event.
 * Called when user pins a location (shortlist button).
 * Idempotent: returns existing deal_id if already saved.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	const body = await request.json();
	const {
		address,
		geoid,
		neighborhood,
		borough,
		location_iq_score,
		fit_iq_score,
		vision_iq_score,
		concept_type,
		asking_rent_monthly = null,
		square_footage = null,
	} = body;

	if (!address) throw error(400, 'address is required');

	// Idempotent: check for existing active deal
	const existingRes = await db.execute(sql`
		SELECT id, status FROM deal_pipeline 
		WHERE user_id = ${user.id} AND address = ${address} 
		AND status NOT IN ('signed', 'passed', 'lost') 
		LIMIT 1
	`);
	const existing = existingRes.rows[0] as any;

	if (existing) {
		// Already saved — log a 'viewed' event and return existing id
		await db.execute(sql`
			INSERT INTO deal_events (deal_id, user_id, event_type)
			VALUES (${existing.id}, ${user.id}, 'viewed')
		`);
		return json({ deal_id: existing.id, created: false });
	}

	let deal;
	try {
		const newId = uuidv4();
		const dataPayload = { neighborhood, borough, location_iq_score, fit_iq_score, vision_iq_score, concept_type, asking_rent_monthly, square_footage };
		await db.execute(sql`
			INSERT INTO deal_pipeline (id, user_id, address, geoid, status, data)
			VALUES (${newId}, ${user.id}, ${address}, ${geoid ?? null}, 'watching', ${JSON.stringify(dataPayload)})
		`);
		deal = { id: newId };
	} catch (insertErr: any) {
		console.error('[deals/save-location] insert error:', insertErr);
		return json({ ok: false, error: insertErr?.message }, { status: 500 });
	}

	// Log initial 'saved' event
	await db.execute(sql`
		INSERT INTO deal_events (deal_id, user_id, event_type)
		VALUES (${deal.id}, ${user.id}, 'saved')
	`);

	return json({ deal_id: deal.id, created: true });
};
