import type { Handle } from '@sveltejs/kit';
import { redirect, error } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import { db } from '$lib/db-server';
import { users, moduleAccess, emailWhitelist } from '$lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { getModuleForRoute, PUBLIC_ROUTES, ALL_MODULES } from '$lib/modules';
import { sendNewUserNotification } from '$lib/email';
import * as Sentry from '@sentry/sveltekit';
import { getAdminAuth } from '$lib/firebase/server';

// Initialize Sentry for server-side error monitoring
if (env.SENTRY_DSN) {
	Sentry.init({
		dsn: env.SENTRY_DSN,
		environment: env.NODE_ENV || 'production',
		tracesSampleRate: 0.2,
		enabled: env.NODE_ENV !== 'development'
	});
}

// ── Resolved-user cache ──────────────────────────────────────────────────
interface CachedUser {
	name: string;
	initials: string;
	role: 'member' | 'owner' | 'pending';
	modules: string[];
	email: string;
	isSuperAdmin: boolean;
	plan: 'free' | 'pro';
	cachedAt: number;
}
const userCache = new Map<string, CachedUser>();
const USER_CACHE_TTL = 30 * 60_000; // 30 minutes

function getCachedUser(userId: string): CachedUser | null {
	const cached = userCache.get(userId);
	if (!cached) return null;
	if (Date.now() - cached.cachedAt > USER_CACHE_TTL) {
		userCache.delete(userId);
		return null;
	}
	return cached;
}

function setCachedUser(userId: string, data: Omit<CachedUser, 'cachedAt'>) {
	userCache.set(userId, { ...data, cachedAt: Date.now() });
	if (userCache.size > 200) {
		const now = Date.now();
		for (const [k, v] of userCache) {
			if (now - v.cachedAt > USER_CACHE_TTL) userCache.delete(k);
		}
	}
}

const LEGACY_MODULES: Record<string, string[]> = {
	'coffee': [...ALL_MODULES],
	'personal': [],
	'work': [],
	'admin': []
};

async function migrateLegacyModules(userId: string, currentModules: string[]): Promise<string[]> {
	const legacyModulesArr = currentModules.filter(m => m in LEGACY_MODULES);
	if (legacyModulesArr.length === 0) return currentModules;

	const newModules = new Set<string>();
	for (const legacy of legacyModulesArr) {
		for (const mod of LEGACY_MODULES[legacy]) {
			newModules.add(mod);
		}
	}
	for (const m of currentModules) {
		if (!(m in LEGACY_MODULES)) newModules.add(m);
	}

	try {
		await db.delete(moduleAccess)
			.where(and(eq(moduleAccess.userId, userId), inArray(moduleAccess.module, legacyModulesArr)));

		if (newModules.size > 0) {
			const inserts = Array.from(newModules).map(module => ({
				userId, module, grantedBy: 'migration'
			}));
			// For simplicity during migration, just insert ignore (Postgres ON CONFLICT DO NOTHING)
			await db.insert(moduleAccess).values(inserts).onConflictDoNothing();
		}
		return Array.from(newModules);
	} catch (err) {
		return currentModules;
	}
}

const authHandle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	if (path.startsWith('/_app')) {
		return resolve(event);
	}

	const isApiRoute = path.startsWith('/api/');
	if (isApiRoute && (path === '/api/geo' || path === '/api/notify' || path === '/api/session' || path === '/api/location-intel' || path === '/api/location-iq')) {
		return resolve(event);
	}

	if (PUBLIC_ROUTES.includes(path) || path === '/login') {
		const sessionToken = event.cookies.get('__session');
		if (sessionToken) {
			try {
				const decodedClaims = await getAdminAuth().verifySessionCookie(sessionToken, true);
				const userId = decodedClaims.uid;
				if (userId) {
					const cached = getCachedUser(userId);
					if (cached) {
						event.locals.user = {
							id: userId,
							name: cached.name,
							initials: cached.initials,
							role: cached.role,
							modules: cached.modules,
							plan: cached.plan || 'free'
						};
					}
				}
			} catch (_e) {
				// Ignore auth failure on public routes
			}
		}
		return resolve(event);
	}

	// --- AUTH CHECK ---
	const sessionToken = event.cookies.get('__session');

	if (!sessionToken) {
		if (isApiRoute) {
			return new Response(JSON.stringify({ error: 'Authentication required' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		if (path.startsWith('/app')) {
			event.locals.user = undefined as any;
			return resolve(event);
		}
		throw redirect(303, '/login');
	}

	try {
		const decodedClaims = await getAdminAuth().verifySessionCookie(sessionToken, true);
		const userId = decodedClaims.uid;
		
		const cached = getCachedUser(userId);
		if (cached) {
			event.locals.user = {
				id: userId,
				name: cached.name,
				initials: cached.initials,
				role: cached.role,
				modules: cached.modules,
				plan: cached.plan || 'free'
			};

			if (cached.role === 'pending') {
				if (path !== '/pending' && !PUBLIC_ROUTES.includes(path)) {
					throw redirect(303, '/pending');
				}
			} else if (!cached.isSuperAdmin) {
				const requiredModule = getModuleForRoute(path);
				if (requiredModule && !cached.modules.includes(requiredModule)) {
					if (isApiRoute) {
						return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 });
					}
					throw error(403, 'Access denied');
				}
			}
			return resolve(event);
		}

		// Cache miss, lookup user
		const existingUserArr = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
		const existingUser = existingUserArr.length > 0 ? existingUserArr[0] : null;

		const userEmail = decodedClaims.email || '';
		const userName = decodedClaims.name || userEmail || 'User';
		const isSuperAdmin = true; // POC bypass

		if (!existingUser) {
			if (isSuperAdmin) {
				await db.insert(users).values({
					id: userId, email: userEmail, role: 'owner'
				});
				const moduleInserts = ALL_MODULES.map(module => ({
					userId, module, grantedBy: 'system'
				}));
				await db.insert(moduleAccess).values(moduleInserts).onConflictDoNothing();
			} else {
				const whitelistArr = await db.select({ modules: emailWhitelist.modules }).from(emailWhitelist).where(eq(emailWhitelist.email, userEmail.toLowerCase())).limit(1);
				const whitelistEntry = whitelistArr.length > 0 ? whitelistArr[0] : null;

				const role = whitelistEntry ? 'member' : 'pending';
				const modules = whitelistEntry?.modules || [];

				await db.insert(users).values({
					id: userId, email: userEmail, role
				});

				if (whitelistEntry && Array.isArray(modules) && modules.length > 0) {
					const moduleInserts = modules.map((module: string) => ({
						userId, module, grantedBy: 'system'
					}));
					await db.insert(moduleAccess).values(moduleInserts).onConflictDoNothing();
				}

				if (!whitelistEntry) {
					sendNewUserNotification(userName, userEmail).catch(err => console.error(err));
					throw redirect(303, '/pending');
				}
			}
		}

		if (existingUser && existingUser.role === 'pending' && isSuperAdmin) {
			await db.update(users).set({ role: 'owner' }).where(eq(users.id, userId));
			const moduleInserts = ALL_MODULES.map(module => ({
				userId, module, grantedBy: 'system'
			}));
			await db.insert(moduleAccess).values(moduleInserts).onConflictDoNothing();
		} else if (existingUser && existingUser.role === 'pending') {
			throw redirect(303, '/pending');
		}

		const moduleAccessArr = await db.select({ module: moduleAccess.module }).from(moduleAccess).where(eq(moduleAccess.userId, userId));

		let userModules = moduleAccessArr.map((m: { module: string }) => m.module);
		userModules = await migrateLegacyModules(userId, userModules);

		if (isSuperAdmin) {
			userModules = [...new Set([...userModules, ...ALL_MODULES])];
		}

		const initials = userName.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2) || 'U';
		
		event.locals.user = {
			id: userId,
			name: userName,
			initials,
			role: 'member',
			modules: userModules,
			plan: 'free'
		};

		setCachedUser(userId, {
			name: userName,
			initials,
			role: 'member',
			modules: userModules,
			email: userEmail,
			isSuperAdmin,
			plan: 'free'
		});

		if (!isSuperAdmin) {
			const requiredModule = getModuleForRoute(path);
			if (requiredModule && !userModules.includes(requiredModule)) {
				throw error(403, 'Access denied');
			}
		}
	} catch (err: any) {
		if (err.location || (typeof err.status === 'number' && err.status >= 300)) {
			throw err;
		}
		console.error('Auth verification failed:', err);
		event.cookies.delete('__session', { path: '/' });
		if (isApiRoute) {
			return new Response(JSON.stringify({ error: 'Invalid session: ' + err.message }), { status: 401 });
		}
		// Temporarily throw 500 instead of redirecting so we can see the exact error
		throw error(500, `Auth verification failed: ${err.message || String(err)}`);
	}

	return resolve(event);
};

export const handle = env.SENTRY_DSN
	? sequence(Sentry.sentryHandle(), authHandle)
	: authHandle;

export const handleError = Sentry.handleErrorWithSentry();
