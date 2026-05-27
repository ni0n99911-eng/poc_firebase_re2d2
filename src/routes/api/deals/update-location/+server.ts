/**
 * PATCH /api/deals/update-location
 * Upserts a deal_pipeline row for the given address.
 *
 * Body: {
 *   addr:    string                                                  — required
 *   status?: 'watching'|'touring'|'negotiating'|'signed'|'passed'|'lost'
 *   note?:   string        — free-form note (maps to deal_pipeline.notes)
 *   pinned?: boolean       — pin to top of shortlist
 *   starred?: boolean      — mark as favourite
 * }
 *
 * If a deal_pipeline row exists for (user_id, address) → UPDATE.
 * If none exists → INSERT with status 'watching' as default.
 * Returns the updated/inserted row.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';

const VALID_STATUSES = new Set([
	'watching', 'touring', 'negotiating', 'signed', 'passed', 'lost',
]);

// Status → deal_events event_type mapping (mirrors /api/deals/[id])
const STATUS_EVENT: Record<string, string> = {
	touring:      'toured',
	negotiating:  'offer_submitted',
	signed:       'signed',
	passed:       'passed',
	lost:         'lost',
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	const body = await request.json() as {
		addr?:    string;
		status?:  string;
		note?:    string;
		pinned?:  boolean;
		starred?: boolean;
	};

	const { addr, status, note, pinned, starred } = body;

	if (!addr || typeof addr !== 'string' || addr.trim() === '') {
		throw error(400, 'addr is required');
	}

	if (status !== undefined && !VALID_STATUSES.has(status)) {
		throw error(400, `status must be one of: ${[...VALID_STATUSES].join(', ')}`);
	}

	const supabase = getServiceSupabase();
	const address = addr.trim();

	// Check for an existing row
	const { data: existing } = await supabase
		.from('deal_pipeline')
		.select('id, status')
		.eq('user_id', user.id)
		.eq('address', address)
		.maybeSingle();

	// Build the update/insert payload — only include defined fields
	const updates: Record<string, unknown> = {};
	if (status  !== undefined) updates.status  = status;
	if (note    !== undefined) updates.notes   = note;      // brief uses 'note', schema uses 'notes'
	if (pinned  !== undefined) updates.pinned  = pinned;
	if (starred !== undefined) updates.starred = starred;

	let dealId: string;

	if (existing) {
		// UPDATE existing row
		if (Object.keys(updates).length === 0) {
			throw error(400, 'No fields to update');
		}

		const { data: updated, error: updateErr } = await supabase
			.from('deal_pipeline')
			.update(updates)
			.eq('id', existing.id)
			.eq('user_id', user.id)
			.select()
			.single();

		if (updateErr || !updated) {
			console.error('[deals/update-location] update error:', updateErr);
			return json({ ok: false, error: updateErr?.message }, { status: 500 });
		}

		// Append a deal_event if status changed
		if (status && status !== existing.status && STATUS_EVENT[status]) {
			await supabase.from('deal_events').insert({
				deal_id: existing.id,
				user_id: user.id,
				event_type: STATUS_EVENT[status],
			});
		}

		return json(updated);
	} else {
		// INSERT — create a new deal with provided fields (status defaults to 'watching')
		const { data: inserted, error: insertErr } = await supabase
			.from('deal_pipeline')
			.insert({
				user_id: user.id,
				address,
				status: status ?? 'watching',
				notes:    note    ?? null,
				pinned:   pinned  ?? false,
				starred:  starred ?? false,
			})
			.select()
			.single();

		if (insertErr || !inserted) {
			console.error('[deals/update-location] insert error:', insertErr);
			return json({ ok: false, error: insertErr?.message }, { status: 500 });
		}

		// Log initial saved event
		await supabase.from('deal_events').insert({
			deal_id: inserted.id,
			user_id: user.id,
			event_type: 'saved',
		});

		return json(inserted);
	}
};
