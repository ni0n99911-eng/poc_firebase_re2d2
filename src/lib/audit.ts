/**
 * Audit Logger — tracks all security-relevant actions for compliance.
 *
 * Every action that touches client data gets logged to the audit_log table.
 * The log is append-only (no UPDATE/DELETE via API).
 *
 * Usage:
 *   import { audit } from '$lib/audit';
 *   await audit.log(userId, 'search', 'scored_location', locationId, { address });
 */

import { db } from './db-server';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';

export type AuditAction =
	| 'login'
	| 'logout'
	| 'search'
	| 'save_location'
	| 'delete_location'
	| 'upload_document'
	| 'download_document'
	| 'delete_document'
	| 'submit_outcome'
	| 'export_data'
	| 'update_profile'
	| 'admin_action'
	| 'api_key_used'
	| 'rate_limit_hit'
	| 'auth_failure';

export type ResourceType =
	| 'scored_location'
	| 'document'
	| 'user'
	| 'outcome'
	| 'search'
	| 'profile'
	| 'system';

/**
 * Hash an IP address for privacy-preserving logging.
 * We never store raw IPs — only SHA-256 hashes for correlation.
 */
function hashIP(ip: string): string {
	return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

class AuditLogger {
	/**
	 * Log an auditable action. Fire-and-forget — never blocks the request.
	 */
	async log(
		userId: string | null,
		action: AuditAction,
		resourceType?: ResourceType,
		resourceId?: string,
		details?: Record<string, unknown>,
		options?: {
			userEmail?: string;
			ip?: string;
		}
	): Promise<void> {
		try {
			await db.execute(sql`
				INSERT INTO audit_log (user_id, user_email, ip_hash, action, resource_type, resource_id, details)
				VALUES (${userId}, ${options?.userEmail ?? null}, ${options?.ip ? hashIP(options.ip) : null}, ${action}, ${resourceType ?? null}, ${resourceId ?? null}, ${details ? JSON.stringify(details) : null}::jsonb)
			`);
		} catch (err) {
			// Never throw — audit failure must not affect the user's request
			console.error('[Audit] Failed to log:', action, err);
		}
	}

	/**
	 * Log a search event with usage increment.
	 */
	async logSearch(
		userId: string,
		address: string,
		lat: number,
		lng: number,
		businessType: string,
		result?: { locationIQ: number; grade: string; confidence: number },
		ip?: string
	): Promise<void> {
		// Insert search history
		await db.execute(sql`
			INSERT INTO search_history (user_id, address, lat, lng, business_type, location_iq, grade, confidence, ip_hash)
			VALUES (${userId}, ${address}, ${lat}, ${lng}, ${businessType}, ${result?.locationIQ ?? null}, ${result?.grade ?? null}, ${result?.confidence ?? null}, ${ip ? hashIP(ip) : null})
		`).catch(err => console.error('[Audit] Search history insert failed:', err));

		// Increment usage counter
		// Note: The increment_usage RPC will need to be replaced with Drizzle if usage tracking is moved
		await db.execute(sql`
			UPDATE users SET searches_count = COALESCE(searches_count, 0) + 1 WHERE id = ${userId}
		`).catch(err => console.error('[Audit] Usage increment failed:', err));

		// Audit log
		await this.log(userId, 'search', 'search', undefined, {
			address,
			lat,
			lng,
			business_type: businessType,
			result_grade: result?.grade
		}, { ip });
	}

	/**
	 * Log a document upload.
	 */
	async logDocumentUpload(
		userId: string,
		documentId: string,
		fileName: string,
		fileType: string,
		fileSizeBytes: number,
		ip?: string
	): Promise<void> {
		await supabaseIncrement(userId, 'document_uploads');
		await this.log(userId, 'upload_document', 'document', documentId, {
			file_name: fileName,
			file_type: fileType,
			file_size_bytes: fileSizeBytes
		}, { ip });
	}

	/**
	 * Log an authentication failure (for security monitoring).
	 */
	async logAuthFailure(
		reason: string,
		ip?: string,
		details?: Record<string, unknown>
	): Promise<void> {
		await this.log(null, 'auth_failure', 'system', undefined, {
			reason,
			...details
		}, { ip });
	}

	/**
	 * Log a rate limit hit.
	 */
	async logRateLimitHit(
		identifier: string,
		endpoint: string,
		ip?: string
	): Promise<void> {
		await this.log(null, 'rate_limit_hit', 'system', undefined, {
			identifier,
			endpoint
		}, { ip });
	}
}

/**
 * Helper: increment a usage counter field.
 */
async function supabaseIncrement(userId: string, field: string): Promise<void> {
	try {
		await db.execute(sql`
			UPDATE users SET ${sql.identifier(field + '_count')} = COALESCE(${sql.identifier(field + '_count')}, 0) + 1 WHERE id = ${userId}
		`);
	} catch (err) {
		console.error('[Audit] Usage increment failed:', err);
	}
}

// Singleton export
export const audit = new AuditLogger();
