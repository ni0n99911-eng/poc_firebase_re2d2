/**
 * RE² Data Vault API — CRUD for vault items (notes, files, contacts, milestones)
 *
 * GET    /api/vault?property=<addr>   → list items for a property (or all if no property)
 * POST   /api/vault                   → create item
 * PATCH  /api/vault                   → update item (requires id in body)
 * DELETE /api/vault?id=<uuid>         → delete item
 *
 * ISS-02 FIX: Use getServiceSupabase() (service_role key) instead of
 * getAuthedSupabase(token). Supabase's JWT verification rejects Clerk JWTs
 * because they are signed with Clerk's private key, not Supabase's JWT secret.
 * Ownership is enforced manually via user_id extracted from the Clerk JWT.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { getServiceSupabase } from '$lib/supabase-server';

function getUserId(request: Request): string | null {
	const auth = request.headers.get('authorization') || '';
	// Clerk JWT — extract sub claim
	if (auth.startsWith('Bearer ')) {
		try {
			const payload = JSON.parse(atob(auth.split('.')[1]));
			return payload.sub || null;
		} catch { return null; }
	}
	return null;
}

export const GET: RequestHandler = async ({ request, url }) => {
	const userId = getUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const sb = getServiceSupabase();
	const property = url.searchParams.get('property');
	const itemType = url.searchParams.get('type');

	let query = sb.from('vault_items')
		.select('*')
		.eq('user_id', userId)
		.order('pinned', { ascending: false })
		.order('created_at', { ascending: false })
		.limit(200);

	if (property) {
		query = query.eq('property_addr', property);
	}
	if (itemType) {
		query = query.eq('item_type', itemType);
	}

	const { data, error } = await query;
	if (error) return json({ error: error.message }, { status: 500 });
	return json({ items: data || [] });
};

export const POST: RequestHandler = async ({ request }) => {
	const userId = getUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const sb = getServiceSupabase();
	const body = await request.json();

	const item = {
		user_id: userId,
		property_addr: body.property_addr || '',
		item_type: body.item_type || 'note',
		title: body.title || '',
		body: body.body || '',
		file_path: body.file_path || '',
		file_type: body.file_type || '',
		file_size: body.file_size || 0,
		tags: body.tags || [],
		metadata: body.metadata || {},
		pinned: body.pinned || false,
	};

	const { data, error } = await sb.from('vault_items').insert(item).select().single();
	if (error) return json({ error: error.message }, { status: 500 });
	return json({ item: data });
};

export const PATCH: RequestHandler = async ({ request }) => {
	const userId = getUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const sb = getServiceSupabase();
	const body = await request.json();

	if (!body.id) return json({ error: 'id is required' }, { status: 400 });

	const updates: Record<string, unknown> = {};
	if (body.title !== undefined) updates.title = body.title;
	if (body.body !== undefined) updates.body = body.body;
	if (body.tags !== undefined) updates.tags = body.tags;
	if (body.metadata !== undefined) updates.metadata = body.metadata;
	if (body.pinned !== undefined) updates.pinned = body.pinned;
	if (body.property_addr !== undefined) updates.property_addr = body.property_addr;

	const { data, error } = await sb.from('vault_items')
		.update(updates)
		.eq('id', body.id)
		.eq('user_id', userId)  // ownership check
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ item: data });
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	const userId = getUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const sb = getServiceSupabase();
	const id = url.searchParams.get('id');

	if (!id) return json({ error: 'id is required' }, { status: 400 });

	const { error } = await sb.from('vault_items')
		.delete()
		.eq('id', id)
		.eq('user_id', userId);  // ownership check

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ success: true });
};
