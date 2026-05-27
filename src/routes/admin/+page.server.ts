import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { getAdminEmails } from '$lib/modules';

interface UserWithModules {
	id: string;
	name: string;
	email: string;
	role: 'owner' | 'member' | 'pending' | 'viewer';
	created_at: string;
	modules: string[];
}

interface AdminPageData {
	users: UserWithModules[];
	whitelist: Array<{
		id: string;
		email: string;
		modules: string[];
		added_by: string | null;
		created_at: string;
	}>;
}

export const load: PageServerLoad<AdminPageData> = async ({ locals }) => {
	// Verify user has admin access (super admins always pass)
	let isSuperAdmin = false;
	if (locals.user?.id) {
		const { data: userData } = await supabase
			.from('users')
			.select('email')
			.eq('id', locals.user.id)
			.single();
		isSuperAdmin = userData ? (await getAdminEmails()).includes(userData.email?.toLowerCase() ?? '') : false;
	}

	if (!isSuperAdmin) {
		throw error(403, 'Access denied. Admin access required.');
	}

	try {
		// Fetch users, modules, and whitelist in parallel (avoids N+1 query)
		const [usersResult, modulesResult, whitelistResult] = await Promise.all([
			supabase
				.from('users')
				.select('id, name, email, role, created_at')
				.order('created_at', { ascending: false }),
			supabase
				.from('module_access')
				.select('user_id, module'),
			supabase
				.from('email_whitelist')
				.select('id, email, modules, added_by, created_at')
				.order('created_at', { ascending: false })
		]);

		if (usersResult.error) {
			console.error('Error fetching users:', usersResult.error);
			throw error(500, 'Failed to load users');
		}

		if (modulesResult.error) {
			console.error('Error fetching modules:', modulesResult.error);
		}

		if (whitelistResult.error) {
			console.error('Error fetching whitelist:', whitelistResult.error);
		}

		// Group modules by user_id in a single pass
		const modulesByUser = new Map<string, string[]>();
		for (const row of modulesResult.data || []) {
			const existing = modulesByUser.get(row.user_id);
			if (existing) {
				existing.push(row.module);
			} else {
				modulesByUser.set(row.user_id, [row.module]);
			}
		}

		const usersWithModules: UserWithModules[] = (usersResult.data || []).map(user => ({
			...user,
			modules: modulesByUser.get(user.id) || []
		}));

		return {
			users: usersWithModules,
			whitelist: whitelistResult.data || []
		};
	} catch (err) {
		console.error('Admin page load error:', err);
		throw error(500, 'Failed to load admin data');
	}
};
