import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db-server';
import { users, moduleAccess, emailWhitelist } from '$lib/db/schema';
import { sendWelcomeEmail } from '$lib/email';
import { getAdminEmails } from '$lib/modules';
import { eq, and } from 'drizzle-orm';

/**
 * Admin API endpoint - handles user management, module access, and whitelist operations
 *
 * Actions:
 * - approveUser: Approve a pending user and set their role
 * - denyUser: Remove/deny a pending user
 * - updateModules: Grant or revoke module access for a user
 * - changeRole: Change a user's role
 * - deleteUser: Remove a user completely
 * - addWhitelist: Add email to whitelist
 * - removeWhitelist: Remove email from whitelist
 * - updateWhitelistModules: Set default modules for whitelisted email
 */

interface ApproveUserRequest {
	action: 'approveUser';
	userId: string;
	role?: 'member' | 'viewer';
	modules?: string[];
}

interface DenyUserRequest {
	action: 'denyUser';
	userId: string;
}

interface UpdateModulesRequest {
	action: 'updateModules';
	userId: string;
	module: string;
	grant: boolean;
}

interface ChangeRoleRequest {
	action: 'changeRole';
	userId: string;
	role: 'owner' | 'member' | 'viewer';
}

interface DeleteUserRequest {
	action: 'deleteUser';
	userId: string;
}

interface AddWhitelistRequest {
	action: 'addWhitelist';
	email: string;
	modules?: string[];
}

interface RemoveWhitelistRequest {
	action: 'removeWhitelist';
	email: string;
}

interface UpdateWhitelistModulesRequest {
	action: 'updateWhitelistModules';
	email: string;
	modules: string[];
}

type AdminRequest =
	| ApproveUserRequest
	| DenyUserRequest
	| UpdateModulesRequest
	| ChangeRoleRequest
	| DeleteUserRequest
	| AddWhitelistRequest
	| RemoveWhitelistRequest
	| UpdateWhitelistModulesRequest;

export const POST: RequestHandler = async ({ request, locals }) => {
	// Verify admin access
	// Admin access: super admins always have access; no separate admin module in Einstein architecture
	const hasAdminModule = false; // Legacy — admin module no longer exists
	const userId = locals.user?.id;

	let isSuperAdmin = false;
	if (userId) {
		const userDataArr = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
		const userData = userDataArr[0];
		isSuperAdmin = userData ? (await getAdminEmails()).includes(userData.email?.toLowerCase() ?? '') : false;
	}

	// Must have admin module OR be a super admin
	if (!hasAdminModule && !isSuperAdmin) {
		throw error(403, 'Admin access required');
	}

	try {
		const body = (await request.json()) as AdminRequest;
		// Structured log for admin audit trail
		console.warn('[ADMIN] API request:', { action: body.action, userId });

		switch (body.action) {
			case 'approveUser':
				return await approveUser(body);

			case 'denyUser':
				return await denyUser(body);

			case 'updateModules':
				return await updateModules(body);

			case 'changeRole':
				return await changeRole(body);

			case 'deleteUser':
				return await deleteUser(body);

			case 'addWhitelist':
				return await addWhitelist(body, userId || '');

			case 'removeWhitelist':
				return await removeWhitelist(body);

			case 'updateWhitelistModules':
				return await updateWhitelistModules(body);

			default:
				throw error(400, `Unknown action: ${(body as Record<string, unknown>).action}`);
		}
	} catch (err) {
		console.error('Admin API error:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};

async function approveUser(req: ApproveUserRequest) {
	const { userId, role = 'member', modules = [] } = req;

	// Get user info for the welcome email
	const userDataArr = await db.select({ name: users.email, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
	const userData = userDataArr[0];

	// Update user role
	try {
		await db.update(users).set({ role }).where(eq(users.id, userId));
	} catch (roleError: any) {
		throw error(500, `Failed to approve user: ${roleError.message}`);
	}

	// Grant modules
	if (modules.length > 0) {
		const moduleInserts = modules.map(module => ({
			userId: userId,
			module,
			grantedBy: userId // Self-granted by admin
		}));

		try {
			for (const mod of moduleInserts) {
				await db.insert(moduleAccess).values(mod).onConflictDoNothing(); // simpler than complex upsert for access
			}
		} catch (modulesError: any) {
			throw error(500, `Failed to grant modules: ${modulesError.message}`);
		}
	}

	// Send welcome email to the approved user (fire and forget)
	if (userData?.email) {
		sendWelcomeEmail(userData.name || 'there', userData.email).catch(err =>
			console.error('[APPROVE] Welcome email failed:', err)
		);
	}

	return json({ success: true, message: 'User approved and welcome email sent' });
}

async function denyUser(req: DenyUserRequest) {
	const { userId } = req;

	// Delete all module access for this user
	try {
		await db.delete(moduleAccess).where(eq(moduleAccess.userId, userId));
	} catch (accessError: any) {
		throw error(500, `Failed to revoke access: ${accessError.message}`);
	}

	// Delete the user
	try {
		await db.delete(users).where(eq(users.id, userId));
	} catch (userError: any) {
		throw error(500, `Failed to delete user: ${userError.message}`);
	}

	return json({ success: true, message: 'User denied and removed' });
}

async function updateModules(req: UpdateModulesRequest) {
	const { userId, module, grant } = req;

	if (grant) {
		try {
			await db.insert(moduleAccess).values({
				userId,
				module,
				grantedBy: userId
			}).onConflictDoNothing();
		} catch (grantError: any) {
			console.error('Grant module error:', grantError);
			throw error(500, `Failed to grant module: ${grantError.message}`);
		}
	} else {
		// Revoke module access
		try {
			await db.delete(moduleAccess).where(and(eq(moduleAccess.userId, userId), eq(moduleAccess.module, module)));
		} catch (revokeError: any) {
			throw error(500, `Failed to revoke module: ${revokeError.message}`);
		}
	}

	return json({ success: true, message: `Module ${grant ? 'granted' : 'revoked'}` });
}

async function changeRole(req: ChangeRoleRequest) {
	const { userId, role } = req;

	try {
		await db.update(users).set({ role }).where(eq(users.id, userId));
	} catch (err: any) {
		throw error(500, `Failed to change role: ${err.message}`);
	}

	return json({ success: true, message: 'Role updated' });
}

async function deleteUser(req: DeleteUserRequest) {
	const { userId } = req;

	// Delete all module access
	try {
		await db.delete(moduleAccess).where(eq(moduleAccess.userId, userId));
	} catch (accessError: any) {
		throw error(500, `Failed to revoke access: ${accessError.message}`);
	}

	// Delete user
	try {
		await db.delete(users).where(eq(users.id, userId));
	} catch (userError: any) {
		throw error(500, `Failed to delete user: ${userError.message}`);
	}

	return json({ success: true, message: 'User deleted' });
}

async function addWhitelist(req: AddWhitelistRequest, adminId: string) {
	const { email, modules = [] } = req;

	try {
		await db.insert(emailWhitelist).values({
			email: email.toLowerCase(),
			modules
		}).onConflictDoNothing();
	} catch (err: any) {
		throw error(500, `Failed to add whitelist: ${err.message}`);
	}

	return json({ success: true, message: 'Email added to whitelist' });
}

async function removeWhitelist(req: RemoveWhitelistRequest) {
	const { email } = req;

	try {
		await db.delete(emailWhitelist).where(eq(emailWhitelist.email, email.toLowerCase()));
	} catch (err: any) {
		throw error(500, `Failed to remove whitelist: ${err.message}`);
	}

	return json({ success: true, message: 'Email removed from whitelist' });
}

async function updateWhitelistModules(req: UpdateWhitelistModulesRequest) {
	const { email, modules } = req;

	try {
		await db.update(emailWhitelist).set({ modules }).where(eq(emailWhitelist.email, email.toLowerCase()));
	} catch (err: any) {
		throw error(500, `Failed to update modules: ${err.message}`);
	}

	return json({ success: true, message: 'Whitelist modules updated' });
}
