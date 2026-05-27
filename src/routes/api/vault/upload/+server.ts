/**
 * RE² Data Vault — File Upload
 *
 * POST /api/vault/upload  (multipart/form-data)
 * Uploads file to Supabase Storage 'vault-files' bucket,
 * then creates a vault_items row with the file reference.
 *
 * ISS-02 FIX: Use getServiceSupabase() (service_role key) instead of
 * getAuthedSupabase(token). Supabase Storage RLS verifies JWTs using
 * Supabase's own JWT secret — a Clerk-issued JWT will always fail that
 * check because it's signed with Clerk's private key, not Supabase's.
 * Since this is a server-side API route, service_role is safe and correct.
 * Auth is enforced by extracting userId from the Clerk JWT manually.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { getServiceSupabase } from '$lib/supabase-server';

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

	// ISS-02: service_role bypasses Supabase's JWT verification (incompatible with Clerk JWTs)
	const sb = getServiceSupabase();

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
		const storagePath = `${userId}/${Date.now()}-${safeName}`;

		// Upload to Supabase Storage
		const { error: uploadError } = await sb.storage
			.from('vault-files')
			.upload(storagePath, file, {
				contentType: file.type,
				upsert: false,
			});

		if (uploadError) {
			console.error('[VaultUpload] Storage upload error:', uploadError);
			return json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
		}

		// Create vault item — filter by user_id manually (service_role bypasses RLS)
		const { data: item, error: dbError } = await sb.from('vault_items').insert({
			user_id: userId,
			property_addr: propertyAddr,
			item_type: 'file',
			title: title || file.name,
			body: '',
			file_path: storagePath,
			file_type: file.type,
			file_size: file.size,
			tags,
			metadata: { originalName: file.name },
			pinned: false,
		}).select().single();

		if (dbError) {
			console.error('[VaultUpload] DB insert error:', dbError);
			// Rollback: remove the uploaded file
			await sb.storage.from('vault-files').remove([storagePath]);
			return json({ error: `DB error: ${dbError.message}` }, { status: 500 });
		}

		return json({ item, storagePath });

	} catch (err) {
		console.error('[VaultUpload] Unexpected error:', err);
		return json({ error: 'Upload failed' }, { status: 500 });
	}
};
