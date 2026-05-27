/**
 * GET  /api/brokers  — list broker contacts for the user
 * POST /api/brokers  — create a new broker contact
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	const supabase = getServiceSupabase();

	const { data, error: dbErr } = await supabase
		.from('broker_contacts')
		.select('id, name, brokerage, email, phone, notes, created_at')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false });

	if (dbErr) {
		console.error('[brokers GET] error:', dbErr);
		return json({ brokers: [] }, { status: 500 });
	}

	return json({ brokers: data || [] });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	const body = await request.json();
	const { name, brokerage, email, phone, notes } = body;

	if (!name?.trim()) throw error(400, 'name is required');

	const supabase = getServiceSupabase();

	const { data, error: insertErr } = await supabase
		.from('broker_contacts')
		.insert({
			user_id: user.id,
			name: name.trim(),
			brokerage: brokerage?.trim() ?? null,
			email: email?.trim() ?? null,
			phone: phone?.trim() ?? null,
			notes: notes?.trim() ?? null,
		})
		.select('id')
		.single();

	if (insertErr || !data) {
		console.error('[brokers POST] error:', insertErr);
		return json({ ok: false, error: insertErr?.message }, { status: 500 });
	}

	return json({ broker_id: data.id, ok: true });
};
