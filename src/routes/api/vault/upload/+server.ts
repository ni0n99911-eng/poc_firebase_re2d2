/**
 * RE² Data Vault — File Upload
 *
 * POST /api/vault/upload  (multipart/form-data)
 * Uploads file to Firebase Storage (Google Cloud Storage)
 * then creates a vault_items row in Cloud SQL with the file reference.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/db-server';
import { vaultItems } from '$lib/db/schema';
import { getAdminApp } from '$lib/firebase/server';
import crypto from 'crypto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
	'image/jpeg', 'image/png', 'image/webp', 'image/gif',
	'application/pdf',
	'text/plain', 'text/csv',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];

function getUserId(request: Request): string | null {
	const auth = request.headers.get('authorization') || '';
	if (auth.startsWith('Bearer ')) {
		try {
			const payload = JSON.parse(atob(auth.split('.')[1]));
			return payload.sub || null;
		} catch { return null; }
	}
	return null;
}

export const POST: RequestHandler = async ({ request }) => {
	const userId = getUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const propertyAddr = (formData.get('property_addr') as string) || '';
		const title = (formData.get('title') as string) || '';
		const tagsRaw = (formData.get('tags') as string) || '';
		const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

		if (!file) return json({ error: 'No file provided' }, { status: 400 });
		if (file.size > MAX_FILE_SIZE) return json({ error: 'File too large (max 10MB)' }, { status: 400 });
		if (!ALLOWED_TYPES.includes(file.type)) return json({ error: `File type not allowed: ${file.type}` }, { status: 400 });

		// Generate unique path: user_id/timestamp-filename
		const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
		const storagePath = `vault-files/${userId}/${Date.now()}-${safeName}`;

		// Upload to Firebase Storage
		const bucket = getAdminApp().storage().bucket();
		const fileBuffer = Buffer.from(await file.arrayBuffer());
		
		const bucketFile = bucket.file(storagePath);
		await bucketFile.save(fileBuffer, {
			metadata: { contentType: file.type }
		});

		// Generate UUID for the item
		const itemId = crypto.randomUUID();

		// Create vault item in Cloud SQL
		const payload = {
			id: itemId,
			userId: userId,
			propertyAddr: propertyAddr,
			itemType: 'file',
			title: title || file.name,
			body: '',
			filePath: storagePath,
			fileType: file.type,
			fileSize: file.size.toString(),
			tags,
			metadata: { originalName: file.name },
			pinned: 'false',
		};

		await db.insert(vaultItems).values(payload as any);

		return json({ item: payload, storagePath });

	} catch (err: any) {
		console.error('[VaultUpload] Unexpected error:', err);
		return json({ error: err.message || 'Upload failed' }, { status: 500 });
	}
};
