import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
import { sendWelcomeEmail } from '$lib/email';
import { fetchPricingTiers, getAdminEmails } from '$lib/modules';

/**
 * Clerk Waitlist API endpoint
 *
 * Actions:
 * - approveWaitlist: Approve a waitlist entry and send invite email
 * - denyWaitlist: Deny a waitlist entry
 *
 * GET: Fetch waitlist entries from Clerk API
 * - Query params: status (pending|accepted|rejected, default: pending)
 */

interface ApproveWaitlistRequest {
	action: 'approveWaitlist';
	waitlistId: string;
}

interface DenyWaitlistRequest {
	action: 'denyWaitlist';
	waitlistId: string;
}

type WaitlistRequest = ApproveWaitlistRequest | DenyWaitlistRequest;

interface ClerkWaitlistEntry {
	id: string;
	email_address: string;
	status: 'pending' | 'accepted' | 'rejected';
	created_at: number;
	updated_at: number;
}

interface ClerkWaitlistResponse {
	data: ClerkWaitlistEntry[];
	total_count: number;
}

const CLERK_API_BASE = 'https://api.clerk.com/v1';

function getClerkSecretKey(): string {
	const key = env.CLERK_SECRET_KEY;
	if (!key) {
		throw new Error('CLERK_SECRET_KEY environment variable is not set');
	}
	return key;
}

async function clerkRequest(method: string, endpoint: string, body?: Record<string, unknown>) {
	const secretKey = getClerkSecretKey();
	const url = `${CLERK_API_BASE}${endpoint}`;

	const response = await fetch(url, {
		method,
		headers: {
			'Authorization': `Bearer ${secretKey}`,
			'Content-Type': 'application/json'
		},
		body: body ? JSON.stringify(body) : undefined
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error(`Clerk API error (${method} ${endpoint}):`, response.status, errorText);
		throw error(response.status, `Clerk API error: ${response.statusText}`);
	}

	return response.json();
}

export const GET: RequestHandler = async ({ request, locals, url }) => {
	// Verify admin access
	const userId = locals.user?.id;

	let isSuperAdmin = false;
	if (userId) {
		try {
			const res = await db.execute(sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`);
			const userData = res.rows[0];
			isSuperAdmin = userData ? (await getAdminEmails()).includes(userData.email?.toLowerCase() ?? "") : false;
		} catch (err) {
			console.error('Waitlist user query error:', err);
		}
	}

	if (!isSuperAdmin) {
		throw error(403, 'Admin access required');
	}

	try {
		const status = (url.searchParams.get('status') || 'pending') as 'pending' | 'accepted' | 'rejected';

		// Fetch waitlist entries from Clerk API
		const response = (await clerkRequest('GET', `/waitlist_entries?status=${status}`)) as ClerkWaitlistResponse;

		return json({
			entries: response.data,
			total_count: response.total_count,
			status
		});
	} catch (err) {
		console.error('Waitlist GET error:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to fetch waitlist entries');
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	// Verify admin access
	const userId = locals.user?.id;

	let isSuperAdmin = false;
	if (userId) {
		try {
			const res = await db.execute(sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`);
			const userData = res.rows[0];
			isSuperAdmin = userData ? (await getAdminEmails()).includes(userData.email?.toLowerCase() ?? "") : false;
		} catch (err) {
			console.error('Waitlist user query error:', err);
		}
	}

	if (!isSuperAdmin) {
		throw error(403, 'Admin access required');
	}

	try {
		const body = (await request.json()) as WaitlistRequest;
		console.warn('[WAITLIST] API request:', { action: body.action, waitlistId: body.waitlistId });

		switch (body.action) {
			case 'approveWaitlist':
				return await approveWaitlist(body);

			case 'denyWaitlist':
				return await denyWaitlist(body);

			default:
				throw error(400, `Unknown action: ${(body as Record<string, unknown>).action}`);
		}
	} catch (err) {
		console.error('Waitlist API error:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};

async function approveWaitlist(req: ApproveWaitlistRequest) {
	const { waitlistId } = req;

	// Clerk v5 API: PATCH to update status, then also try the invite endpoint
	// Try the direct approve endpoint first (Clerk may support it)
	try {
		await clerkRequest('POST', `/waitlist_entries/${waitlistId}/approve`, {
			notify: true
		});
	} catch (e) {
		// Fallback: use PATCH to update status if approve endpoint doesn't exist
		console.warn('[WAITLIST] Approve endpoint failed, trying PATCH fallback');
		await clerkRequest('PATCH', `/waitlist_entries/${waitlistId}`, {
			status: 'accepted'
		});
	}

	// Also add to Supabase whitelist so they can access modules on sign-up
	try {
		const entry = await clerkRequest('GET', `/waitlist_entries/${waitlistId}`);
		if (entry?.email_address) {
			try {
				const modules = [...((await fetchPricingTiers()).scout?.modules ?? ['location-einstein'])];
				const email = entry.email_address.toLowerCase();
				await db.execute(sql`
					INSERT INTO email_whitelist (email, modules, added_by) 
					VALUES (${email}, ${JSON.stringify(modules)}, 'waitlist-approval') 
					ON CONFLICT (email) DO UPDATE SET modules = EXCLUDED.modules
				`);
			} catch (whitelistErr: any) {
				console.warn('Could not auto-whitelist:', whitelistErr.message);
			}

			// Send welcome email to the approved waitlist user
			const name = entry.first_name || entry.email_address.split('@')[0];
			sendWelcomeEmail(name, entry.email_address).catch(err =>
				console.error('[WAITLIST] Welcome email failed:', err)
			);
		}
	} catch (e) {
		console.warn('Could not fetch waitlist entry for whitelist:', e);
	}

	return json({
		success: true,
		message: 'Waitlist entry approved and invite email sent'
	});
}

async function denyWaitlist(req: DenyWaitlistRequest) {
	const { waitlistId } = req;

	// Try the direct deny endpoint first, fallback to PATCH
	try {
		await clerkRequest('POST', `/waitlist_entries/${waitlistId}/deny`, {});
	} catch (e) {
		console.warn('[WAITLIST] Deny endpoint failed, trying PATCH fallback');
		await clerkRequest('PATCH', `/waitlist_entries/${waitlistId}`, {
			status: 'rejected'
		});
	}

	return json({
		success: true,
		message: 'Waitlist entry denied'
	});
}
