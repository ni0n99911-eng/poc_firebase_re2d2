import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
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
		try {
			const res = await db.execute(sql`SELECT email FROM users WHERE id = ${locals.user.id} LIMIT 1`);
			const userData = res.rows[0];
			isSuperAdmin = userData ? (await getAdminEmails()).includes(userData.email?.toLowerCase() ?? '') : false;
		} catch (err) {
			console.error('Error fetching admin status:', err);
		}
	}

	if (!isSuperAdmin) {
		throw error(403, 'Access denied. Admin access required.');
	}

	try {
		// Fetch users, modules, and whitelist in parallel (avoids N+1 query)
		const [usersResult, modulesResult, whitelistResult] = await Promise.allSettled([
			db.execute(sql`SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC`),
			db.execute(sql`SELECT user_id, module FROM module_access`),
			db.execute(sql`SELECT id, email, modules, added_by, created_at FROM email_whitelist ORDER BY created_at DESC`)
		]);

		if (usersResult.status === 'rejected') {
			console.error('Error fetching users:', usersResult.reason);
			throw error(500, 'Failed to load users');
		}

		if (modulesResult.status === 'rejected') {
			console.error('Error fetching modules:', modulesResult.reason);
		}

		if (whitelistResult.status === 'rejected') {
			console.error('Error fetching whitelist:', whitelistResult.reason);
		}

		const usersData = usersResult.status === 'fulfilled' ? usersResult.value.rows : [];
		const modulesData = modulesResult.status === 'fulfilled' ? modulesResult.value.rows : [];
		const whitelistData = whitelistResult.status === 'fulfilled' ? whitelistResult.value.rows : [];

		// Group modules by user_id in a single pass
		const modulesByUser = new Map<string, string[]>();
		for (const row of modulesData) {
			const existing = modulesByUser.get(row.user_id as string);
			if (existing) {
				existing.push(row.module as string);
			} else {
				modulesByUser.set(row.user_id as string, [row.module as string]);
			}
		}

		const usersWithModules: UserWithModules[] = (usersData as any[]).map(user => ({
			...user,
			modules: modulesByUser.get(user.id as string) || []
		}));

		return {
			users: usersWithModules,
			whitelist: whitelistData as any[]
		};
	} catch (err) {
		console.error('Admin page load error:', err);
		throw error(500, 'Failed to load admin data');
	}
};
