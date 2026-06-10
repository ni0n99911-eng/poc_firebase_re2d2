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
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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

	const address = addr.trim();

	// Check for an existing row
	const existingRes = await db.execute(sql`SELECT id, status FROM deal_pipeline WHERE user_id = ${user.id} AND address = ${address} LIMIT 1`);
	const existing = existingRes.rows[0] as any;

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

		try {
			const setClauses = Object.keys(updates).map(k => sql`${sql.identifier(k)} = ${updates[k]}`);
			const updateQuery = sql`UPDATE deal_pipeline SET ${sql.join(setClauses, sql`, `)} WHERE id = ${existing.id} AND user_id = ${user.id} RETURNING *`;
			const updatedRes = await db.execute(updateQuery);
			const updated = updatedRes.rows[0];

			// Append a deal_event if status changed
			if (status && status !== existing.status && STATUS_EVENT[status]) {
				await db.execute(sql`
					INSERT INTO deal_events (deal_id, user_id, event_type)
					VALUES (${existing.id}, ${user.id}, ${STATUS_EVENT[status]})
				`);
			}

			return json(updated);
		} catch (updateErr: any) {
			console.error('[deals/update-location] update error:', updateErr);
			return json({ ok: false, error: updateErr?.message }, { status: 500 });
		}
	} else {
		// INSERT — create a new deal with provided fields (status defaults to 'watching')
		try {
			const newId = uuidv4();
			const insertedRes = await db.execute(sql`
				INSERT INTO deal_pipeline (id, user_id, address, status, notes, pinned, starred)
				VALUES (${newId}, ${user.id}, ${address}, ${status ?? 'watching'}, ${note ?? null}, ${pinned ?? false}, ${starred ?? false})
				RETURNING *
			`);
			const inserted = insertedRes.rows[0];

			// Log initial saved event
			await db.execute(sql`
				INSERT INTO deal_events (deal_id, user_id, event_type)
				VALUES (${inserted.id}, ${user.id}, 'saved')
			`);

			return json(inserted);
		} catch (insertErr: any) {
			console.error('[deals/update-location] insert error:', insertErr);
			return json({ ok: false, error: insertErr?.message }, { status: 500 });
		}
	}
};
