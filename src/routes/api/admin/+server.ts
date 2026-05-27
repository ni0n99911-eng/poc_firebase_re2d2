import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';
import { sendWelcomeEmail } from '$lib/email';
import { getAdminEmails } from '$lib/modules';

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

	// Check Supabase for the user's email to verify super admin status
	let isSuperAdmin = false;
	if (userId) {
		const { data: userData } = await supabase
			.from('users')
			.select('email')
			.eq('id', userId)
			.single();
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
	const { data: userData } = await supabase
		.from('users')
		.select('name, email')
		.eq('id', userId)
		.single();

	// Update user role
	const { error: roleError } = await supabase
		.from('users')
		.update({ role })
		.eq('id', userId);

	if (roleError) {
		throw error(500, `Failed to approve user: ${roleError.message}`);
	}

	// Grant modules
	if (modules.length > 0) {
		const moduleInserts = modules.map(module => ({
			user_id: userId,
			module,
			granted_by: userId // Self-granted by admin
		}));

		const { error: modulesError } = await supabase
			.from('module_access')
			.upsert(moduleInserts, { onConflict: 'user_id,module' });

		if (modulesError) {
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
	const { error: accessError } = await supabase
		.from('module_access')
		.delete()
		.eq('user_id', userId);

	if (accessError) {
		throw error(500, `Failed to revoke access: ${accessError.message}`);
	}

	// Delete the user
	const { error: userError } = await supabase.from('users').delete().eq('id', userId);

	if (userError) {
		throw error(500, `Failed to delete user: ${userError.message}`);
	}

	return json({ success: true, message: 'User denied and removed' });
}

async function updateModules(req: UpdateModulesRequest) {
	const { userId, module, grant } = req;

	if (grant) {
		// Grant module access — use upsert to handle duplicates
		const { error: grantError } = await supabase
			.from('module_access')
			.upsert({
				user_id: userId,
				module,
				granted_by: userId
			}, { onConflict: 'user_id,module' });

		if (grantError) {
			console.error('Grant module error:', grantError);
			throw error(500, `Failed to grant module: ${grantError.message}`);
		}
	} else {
		// Revoke module access
		const { error: revokeError } = await supabase
			.from('module_access')
			.delete()
			.eq('user_id', userId)
			.eq('module', module);

		if (revokeError) {
			throw error(500, `Failed to revoke module: ${revokeError.message}`);
		}
	}

	return json({ success: true, message: `Module ${grant ? 'granted' : 'revoked'}` });
}

async function changeRole(req: ChangeRoleRequest) {
	const { userId, role } = req;

	const { error: err } = await supabase
		.from('users')
		.update({ role })
		.eq('id', userId);

	if (err) {
		throw error(500, `Failed to change role: ${err.message}`);
	}

	return json({ success: true, message: 'Role updated' });
}

async function deleteUser(req: DeleteUserRequest) {
	const { userId } = req;

	// Delete all module access
	const { error: accessError } = await supabase
		.from('module_access')
		.delete()
		.eq('user_id', userId);

	if (accessError) {
		throw error(500, `Failed to revoke access: ${accessError.message}`);
	}

	// Delete user
	const { error: userError } = await supabase.from('users').delete().eq('id', userId);

	if (userError) {
		throw error(500, `Failed to delete user: ${userError.message}`);
	}

	return json({ success: true, message: 'User deleted' });
}

async function addWhitelist(req: AddWhitelistRequest, adminId: string) {
	const { email, modules = [] } = req;

	const { error: err } = await supabase.from('email_whitelist').insert({
		email: email.toLowerCase(),
		modules,
		added_by: adminId
	});

	if (err) {
		if (err.message.includes('unique')) {
			throw error(400, 'Email already whitelisted');
		}
		throw error(500, `Failed to add whitelist: ${err.message}`);
	}

	return json({ success: true, message: 'Email added to whitelist' });
}

async function removeWhitelist(req: RemoveWhitelistRequest) {
	const { email } = req;

	const { error: err } = await supabase
		.from('email_whitelist')
		.delete()
		.eq('email', email.toLowerCase());

	if (err) {
		throw error(500, `Failed to remove whitelist: ${err.message}`);
	}

	return json({ success: true, message: 'Email removed from whitelist' });
}

async function updateWhitelistModules(req: UpdateWhitelistModulesRequest) {
	const { email, modules } = req;

	const { error: err } = await supabase
		.from('email_whitelist')
		.update({ modules })
		.eq('email', email.toLowerCase());

	if (err) {
		throw error(500, `Failed to update modules: ${err.message}`);
	}

	return json({ success: true, message: 'Whitelist modules updated' });
}
