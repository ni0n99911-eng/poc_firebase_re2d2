/**
 * RE² Data Vault API — CRUD for vault items (notes, files, contacts, milestones)
 *
 * GET    /api/vault?property=<addr>   → list items for a property (or all if no property)
 * POST   /api/vault                   → create item
 * PATCH  /api/vault                   → update item (requires id in body)
 * DELETE /api/vault?id=<uuid>         → delete item
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/db-server';
import { vaultItems } from '$lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

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

	const property = url.searchParams.get('property');
	const itemType = url.searchParams.get('type');

	try {
		let conditions = [eq(vaultItems.userId, userId)];
		if (property) conditions.push(eq(vaultItems.propertyAddr, property));
		if (itemType) conditions.push(eq(vaultItems.itemType, itemType));

		const data = await db.select()
			.from(vaultItems)
			.where(and(...conditions))
			.orderBy(desc(vaultItems.pinned), desc(vaultItems.createdAt))
			.limit(200);

		return json({ items: data || [] });
	} catch (err: any) {
		console.error('[VaultAPI GET Error]:', err);
		return json({ error: err.message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const userId = getUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json();
		const itemId = crypto.randomUUID();

		const item = {
			id: itemId,
			userId: userId,
			propertyAddr: body.property_addr || '',
			itemType: body.item_type || 'note',
			title: body.title || '',
			body: body.body || '',
			filePath: body.file_path || '',
			fileType: body.file_type || '',
			fileSize: (body.file_size || 0).toString(),
			tags: body.tags || [],
			metadata: body.metadata || {},
			pinned: (body.pinned || false).toString(),
		};

		await db.insert(vaultItems).values(item as any);

		return json({ item: item });
	} catch (err: any) {
		console.error('[VaultAPI POST Error]:', err);
		return json({ error: err.message }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request }) => {
	const userId = getUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json();
		if (!body.id) return json({ error: 'id is required' }, { status: 400 });

		const updates: Record<string, unknown> = {};
		if (body.title !== undefined) updates.title = body.title;
		if (body.body !== undefined) updates.body = body.body;
		if (body.tags !== undefined) updates.tags = body.tags;
		if (body.metadata !== undefined) updates.metadata = body.metadata;
		if (body.pinned !== undefined) updates.pinned = body.pinned.toString();
		if (body.property_addr !== undefined) updates.propertyAddr = body.property_addr;

		await db.update(vaultItems)
			.set(updates as any)
			.where(and(eq(vaultItems.id, body.id), eq(vaultItems.userId, userId)));

		// Fetch the updated item to return
		const updatedArr = await db.select().from(vaultItems).where(eq(vaultItems.id, body.id)).limit(1);

		return json({ item: updatedArr.length > 0 ? updatedArr[0] : null });
	} catch (err: any) {
		console.error('[VaultAPI PATCH Error]:', err);
		return json({ error: err.message }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	const userId = getUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const id = url.searchParams.get('id');
	if (!id) return json({ error: 'id is required' }, { status: 400 });

	try {
		await db.delete(vaultItems)
			.where(and(eq(vaultItems.id, id), eq(vaultItems.userId, userId)));

		return json({ success: true });
	} catch (err: any) {
		console.error('[VaultAPI DELETE Error]:', err);
		return json({ error: err.message }, { status: 500 });
	}
};
