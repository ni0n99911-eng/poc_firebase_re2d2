/**
 * GET /api/deals
 * Returns the user's full pipeline grouped by status with counts.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';

const STATUS_ORDER = ['watching', 'touring', 'negotiating', 'signed', 'passed', 'lost'];

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	const supabase = getServiceSupabase();

	const { data, error: dbErr } = await supabase
		.from('deal_pipeline')
		.select(`
			id, address, neighborhood, borough, status,
			location_iq_score, fit_iq_score, vision_iq_score, concept_type,
			asking_rent_monthly, square_footage, notes,
			first_seen_at, toured_at, offer_submitted_at, decision_at,
			created_at, updated_at,
			broker:broker_id ( id, name, brokerage, email, phone )
		`)
		.eq('user_id', user.id)
		.order('updated_at', { ascending: false });

	if (dbErr) {
		console.error('[deals GET] db error:', dbErr);
		return json({ pipeline: [], counts: {} }, { status: 500 });
	}

	const pipeline = data || [];

	// Build counts
	const counts: Record<string, number> = {};
	for (const s of STATUS_ORDER) counts[s] = 0;
	for (const row of pipeline) {
		if (counts[row.status] !== undefined) counts[row.status]++;
	}

	return json({ pipeline, counts });
};
