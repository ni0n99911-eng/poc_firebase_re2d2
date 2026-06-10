/**
 * GET  /api/brokers  — list broker contacts for the user
 * POST /api/brokers  — create a new broker contact
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db-server';
import { brokerContacts } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	try {
		const data = await db.select().from(brokerContacts).where(eq(brokerContacts.userId, user.id)).orderBy(desc(brokerContacts.createdAt));
		return json({ brokers: data || [] });
	} catch (dbErr) {
		console.error('[brokers GET] error:', dbErr);
		return json({ brokers: [] }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user?.id) throw error(401, 'Authentication required');

	const body = await request.json();
	const { name, brokerage, email, phone, notes } = body;

	if (!name?.trim()) throw error(400, 'name is required');

	try {
		const newId = uuidv4();
		await db.insert(brokerContacts).values({
			id: newId,
			userId: user.id,
			name: name.trim(),
			brokerage: brokerage?.trim() ?? null,
			email: email?.trim() ?? null,
			phone: phone?.trim() ?? null,
			notes: notes?.trim() ?? null,
		});
		return json({ broker_id: newId, ok: true });
	} catch (insertErr: any) {
		console.error('[brokers POST] error:', insertErr);
		return json({ ok: false, error: insertErr?.message }, { status: 500 });
	}
};
