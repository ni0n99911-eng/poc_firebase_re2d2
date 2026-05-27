/**
 * POST /api/deals/save-location
 * Creates a deal_pipeline row + initial 'saved' event.
 * Called when user pins a location (shortlist button).
 * Idempotent: returns existing deal_id if already saved.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';

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

	const supabase = getServiceSupabase();

	// Idempotent: check for existing active deal
	const { data: existing } = await supabase
		.from('deal_pipeline')
		.select('id, status')
		.eq('user_id', user.id)
		.eq('address', address)
		.not('status', 'in', '("signed","passed","lost")')
		.maybeSingle();

	if (existing) {
		// Already saved — log a 'viewed' event and return existing id
		await supabase.from('deal_events').insert({
			deal_id: existing.id,
			user_id: user.id,
			event_type: 'viewed',
		});
		return json({ deal_id: existing.id, created: false });
	}

	// Create new deal row
	const { data: deal, error: insertErr } = await supabase
		.from('deal_pipeline')
		.insert({
			user_id: user.id,
			address,
			geoid: geoid ?? null,
			neighborhood: neighborhood ?? null,
			borough: borough ?? null,
			location_iq_score: location_iq_score ?? null,
			fit_iq_score: fit_iq_score ?? null,
			vision_iq_score: vision_iq_score ?? null,
			concept_type: concept_type ?? null,
			asking_rent_monthly,
			square_footage,
			status: 'watching',
		})
		.select('id')
		.single();

	if (insertErr || !deal) {
		console.error('[deals/save-location] insert error:', insertErr);
		return json({ ok: false, error: insertErr?.message }, { status: 500 });
	}

	// Log initial 'saved' event
	await supabase.from('deal_events').insert({
		deal_id: deal.id,
		user_id: user.id,
		event_type: 'saved',
	});

	return json({ deal_id: deal.id, created: true });
};
