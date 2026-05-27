/**
 * PATCH /api/deals/:id
 * Update a deal's status, rent, sqft, broker, notes, or dates.
 * Auto-appends a deal_event when status changes.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';

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

	const supabase = getServiceSupabase();

	// Verify ownership
	const { data: existing, error: fetchErr } = await supabase
		.from('deal_pipeline')
		.select('id, status, user_id')
		.eq('id', dealId)
		.eq('user_id', user.id)
		.single();

	if (fetchErr || !existing) throw error(404, 'Deal not found');

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

	const { error: updateErr } = await supabase
		.from('deal_pipeline')
		.update(updates)
		.eq('id', dealId)
		.eq('user_id', user.id);

	if (updateErr) {
		console.error('[deals PATCH] update error:', updateErr);
		return json({ ok: false, error: updateErr.message }, { status: 500 });
	}

	// If status changed, append a matching event
	if (status && status !== existing.status && STATUS_EVENT[status]) {
		await supabase.from('deal_events').insert({
			deal_id: dealId,
			user_id: user.id,
			event_type: STATUS_EVENT[status],
		});
	}

	return json({ ok: true });
};
