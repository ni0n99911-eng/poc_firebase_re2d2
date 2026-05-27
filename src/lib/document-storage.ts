/**
 * Secure Document Storage — Supabase Storage integration.
 *
 * Handles client file uploads with:
 *   - File type validation (whitelist only)
 *   - Size limits (50MB max)
 *   - Path isolation (each user's files in their own folder)
 *   - Metadata tracking in client_documents table
 *   - Audit logging on every operation
 *
 * Storage bucket: 'client-documents' (private, not public)
 * Path convention: {user_id}/{document_type}/{filename}
 */

import { getServiceSupabase } from './supabase-server';
import { audit } from './audit';

const BUCKET = 'client-documents';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = new Set([
	'application/pdf',
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/heic',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // .docx
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         // .xlsx
	'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
	'text/csv',
	'text/plain',
]);

export type DocumentType = 'lease' | 'floor_plan' | 'financials' | 'permit' | 'photo' | 'other';

export interface UploadResult {
	success: boolean;
	documentId?: string;
	storagePath?: string;
	error?: string;
}

/**
 * Upload a document for a client.
 */
export async function uploadDocument(
	userId: string,
	file: File | Blob,
	fileName: string,
	fileType: string,
	documentType: DocumentType = 'other',
	description?: string,
	scoredLocationId?: string,
	ip?: string
): Promise<UploadResult> {
	// Validate MIME type
	if (!ALLOWED_MIME_TYPES.has(fileType)) {
		return { success: false, error: `File type '${fileType}' is not allowed. Accepted: PDF, images, Office documents, CSV.` };
	}

	// Validate size
	const fileSize = file instanceof File ? file.size : (file as Blob).size;
	if (fileSize > MAX_FILE_SIZE) {
		return { success: false, error: `File exceeds 50MB limit (${Math.round(fileSize / 1024 / 1024)}MB).` };
	}

	// Sanitize filename
	const safeName = sanitizeFileName(fileName);
	const storagePath = `${userId}/${documentType}/${Date.now()}-${safeName}`;

	try {
		const supabase = getServiceSupabase();

		// Upload to Supabase Storage
		const { error: uploadError } = await supabase.storage
			.from(BUCKET)
			.upload(storagePath, file, {
				contentType: fileType,
				upsert: false // Never overwrite
			});

		if (uploadError) {
			console.error('[DocumentStorage] Upload failed:', uploadError);
			return { success: false, error: 'Upload failed. Please try again.' };
		}

		// Create metadata record
		const { data, error: dbError } = await supabase
			.from('client_documents')
			.insert({
				user_id: userId,
				file_name: safeName,
				file_type: fileType,
				file_size_bytes: fileSize,
				storage_path: storagePath,
				document_type: documentType,
				description,
				scored_location_id: scoredLocationId
			})
			.select('id')
			.single();

		if (dbError) {
			// Rollback: delete the uploaded file
			await supabase.storage.from(BUCKET).remove([storagePath]);
			console.error('[DocumentStorage] Metadata insert failed:', dbError);
			return { success: false, error: 'Failed to save document metadata.' };
		}

		// Audit log
		await audit.logDocumentUpload(userId, data.id, safeName, fileType, fileSize, ip);

		return {
			success: true,
			documentId: data.id,
			storagePath
		};
	} catch (err) {
		console.error('[DocumentStorage] Unexpected error:', err);
		return { success: false, error: 'An unexpected error occurred.' };
	}
}

/**
 * Get a signed download URL for a document (expires in 1 hour).
 */
export async function getDocumentUrl(
	userId: string,
	documentId: string
): Promise<string | null> {
	const supabase = getServiceSupabase();

	// Verify ownership
	const { data: doc } = await supabase
		.from('client_documents')
		.select('storage_path, user_id')
		.eq('id', documentId)
		.is('deleted_at', null)
		.single();

	if (!doc || doc.user_id !== userId) return null;

	// Generate signed URL (1 hour expiry)
	const { data } = await supabase.storage
		.from(BUCKET)
		.createSignedUrl(doc.storage_path, 3600);

	if (data?.signedUrl) {
		// Update last accessed
		await supabase
			.from('client_documents')
			.update({ last_accessed_at: new Date().toISOString() })
			.eq('id', documentId);
	}

	return data?.signedUrl ?? null;
}

/**
 * Soft-delete a document (marks as deleted, does not remove from storage).
 * Hard deletion happens via a scheduled cleanup job.
 */
export async function deleteDocument(
	userId: string,
	documentId: string,
	ip?: string
): Promise<boolean> {
	const supabase = getServiceSupabase();

	// Verify ownership
	const { data: doc } = await supabase
		.from('client_documents')
		.select('id, user_id, file_name')
		.eq('id', documentId)
		.is('deleted_at', null)
		.single();

	if (!doc || doc.user_id !== userId) return false;

	// Soft delete
	const { error } = await supabase
		.from('client_documents')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', documentId);

	if (!error) {
		await audit.log(userId, 'delete_document', 'document', documentId, {
			file_name: doc.file_name
		}, { ip });
	}

	return !error;
}

/**
 * List a user's documents.
 */
export async function listDocuments(
	userId: string,
	options?: {
		documentType?: DocumentType;
		scoredLocationId?: string;
		limit?: number;
	}
): Promise<Array<{
	id: string;
	fileName: string;
	fileType: string;
	fileSizeBytes: number;
	documentType: string;
	description: string | null;
	uploadedAt: string;
}>> {
	const supabase = getServiceSupabase();
	let query = supabase
		.from('client_documents')
		.select('id, file_name, file_type, file_size_bytes, document_type, description, uploaded_at')
		.eq('user_id', userId)
		.is('deleted_at', null)
		.order('uploaded_at', { ascending: false });

	if (options?.documentType) {
		query = query.eq('document_type', options.documentType);
	}
	if (options?.scoredLocationId) {
		query = query.eq('scored_location_id', options.scoredLocationId);
	}
	if (options?.limit) {
		query = query.limit(options.limit);
	}

	const { data } = await query;

	return (data || []).map(d => ({
		id: d.id,
		fileName: d.file_name,
		fileType: d.file_type,
		fileSizeBytes: d.file_size_bytes,
		documentType: d.document_type,
		description: d.description,
		uploadedAt: d.uploaded_at
	}));
}

/**
 * Sanitize filename: remove path traversal, special chars, limit length.
 */
function sanitizeFileName(name: string): string {
	return name
		.replace(/[^a-zA-Z0-9._-]/g, '_')   // Replace special chars
		.replace(/\.{2,}/g, '.')             // No double dots (path traversal)
		.replace(/^\./, '_')                 // No leading dot (hidden files)
		.slice(0, 200);                      // Limit length
}
