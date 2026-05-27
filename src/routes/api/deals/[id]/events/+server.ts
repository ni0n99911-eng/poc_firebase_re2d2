/**
 * POST /api/deals/:id/events
 * Manually log an event (note, broker intro, etc.) on a deal.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';

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

	const supabase = getServiceSupabase();

	// Verify ownership
	const { data: deal } = await supabase
		.from('deal_pipeline')
		.select('id')
		.eq('id', dealId)
		.eq('user_id', user.id)
		.single();

	if (!deal) throw error(404, 'Deal not found');

	const { error: insertErr } = await supabase.from('deal_events').insert({
		deal_id: dealId,
		user_id: user.id,
		event_type,
		notes: notes ?? null,
		event_data,
	});

	if (insertErr) {
		console.error('[deals/events POST] error:', insertErr);
		return json({ ok: false, error: insertErr.message }, { status: 500 });
	}

	return json({ ok: true });
};
