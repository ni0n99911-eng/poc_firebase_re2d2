import type { Handle } from '@sveltejs/kit';
import { redirect, error } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { env } from '$env/dynamic/private';
import { getServiceSupabase } from '$lib/supabase-server';
import { getModuleForRoute, PUBLIC_ROUTES, ALL_MODULES, getAdminEmails } from '$lib/modules';
import { sendNewUserNotification } from '$lib/email';
import * as Sentry from '@sentry/sveltekit';

// Initialize Sentry for server-side error monitoring
if (env.SENTRY_DSN) {
	Sentry.init({
		dsn: env.SENTRY_DSN,
		environment: env.NODE_ENV || 'production',
		tracesSampleRate: 0.2,
		enabled: env.NODE_ENV !== 'development'
	});
}

function getClerkSecretKey() {
	return env.CLERK_SECRET_KEY || '';
}

let _clerk: ReturnType<typeof createClerkClient> | null = null;
function getClerk() {
	if (!_clerk) {
		_clerk = createClerkClient({ secretKey: getClerkSecretKey() });
	}
	return _clerk;
}

// Service-role Supabase client — bypasses RLS for auth/permission lookups.
// Lazy-initialized so env vars are available at call time.
let _serviceDb: ReturnType<typeof getServiceSupabase> | null = null;
function getServiceDb() {
	if (!_serviceDb) {
		_serviceDb = getServiceSupabase();
	}
	return _serviceDb;
}

// In-memory cache for verified JWT payloads — avoids re-verifying on every request
// Key: last 32 chars of token (unique signature portion), Value: { payload, expiresAt }
interface JWTPayload {
	sub?: string;
	exp?: number;
	iat?: number;
	[key: string]: unknown;
}

const tokenCache = new Map<string, { payload: JWTPayload; cachedAt: number; expiresAt: number }>();
const TOKEN_CACHE_TTL = 60_000; // 1 minute

function getTokenCacheKey(token: string): string {
	// Use the last 32 chars (signature portion) — far more unique than the header prefix
	return token.slice(-32);
}

function getCachedPayload(token: string): JWTPayload | null {
	const key = getTokenCacheKey(token);
	const cached = tokenCache.get(key);
	if (!cached) return null;

	const now = Date.now();
	// Evict if cache TTL exceeded OR if the JWT itself has expired
	if (now - cached.cachedAt > TOKEN_CACHE_TTL || now >= cached.expiresAt) {
		tokenCache.delete(key);
		return null;
	}
	return cached.payload;
}

function setCachedPayload(token: string, payload: JWTPayload) {
	const key = getTokenCacheKey(token);
	// Respect the JWT's own expiry — don't cache beyond token lifetime
	const expiresAt = payload.exp ? payload.exp * 1000 : Date.now() + TOKEN_CACHE_TTL;
	tokenCache.set(key, { payload, cachedAt: Date.now(), expiresAt });

	// Prune old entries periodically
	if (tokenCache.size > 100) {
		const now = Date.now();
		for (const [k, v] of tokenCache) {
			if (now - v.cachedAt > TOKEN_CACHE_TTL || now >= v.expiresAt) tokenCache.delete(k);
		}
	}
}

// ── Resolved-user cache ──────────────────────────────────────────────────
// Avoids hitting Clerk getUser() + Supabase on every sidebar click.
// Keyed by Clerk userId, holds the fully resolved locals.user object + modules.
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
const USER_CACHE_TTL = 30 * 60_000; // 30 minutes — user data changes rarely, and this is our primary defense against JWT-expiry bounces

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
	// Prune
	if (userCache.size > 200) {
		const now = Date.now();
		for (const [k, v] of userCache) {
			if (now - v.cachedAt > USER_CACHE_TTL) userCache.delete(k);
		}
	}
}

// Admin list from admin_users table (getAdminEmails — falls back to hardcoded list)

// Legacy module names that need migrating → map to new Einstein modules
const LEGACY_MODULES: Record<string, string[]> = {
	'coffee': [...ALL_MODULES],  // Legacy 'coffee' users get all modules
	'personal': [],
	'work': [],
	'admin': []
};

/**
 * Auto-migrate legacy module_access rows (e.g. 'coffee') to new Einstein module names.
 * Runs once per login when legacy rows are detected; deletes old rows and inserts new ones.
 */
async function migrateLegacyModules(userId: string, currentModules: string[]): Promise<string[]> {
	const legacyModules = currentModules.filter(m => m in LEGACY_MODULES);
	if (legacyModules.length === 0) return currentModules;

	// Collect all new modules this user should get based on their legacy access
	const newModules = new Set<string>();
	for (const legacy of legacyModules) {
		for (const mod of LEGACY_MODULES[legacy]) {
			newModules.add(mod);
		}
	}

	// Also keep any existing Einstein modules they already have
	for (const m of currentModules) {
		if (!(m in LEGACY_MODULES)) newModules.add(m);
	}

	try {
		// Delete legacy rows
		await getServiceDb().from('module_access').delete()
			.eq('user_id', userId)
			.in('module', legacyModules);

		// Insert new Einstein module rows (skip duplicates)
		if (newModules.size > 0) {
			const inserts = Array.from(newModules).map(module => ({
				user_id: userId, module, granted_by: 'migration'
			}));
			await getServiceDb().from('module_access').upsert(inserts, { onConflict: 'user_id,module' });
		}

		console.log(`[MIGRATION] Migrated user ${userId}: ${legacyModules.join(',')} → ${Array.from(newModules).join(',')}`);
		return Array.from(newModules);
	} catch (err) {
		console.error('[MIGRATION ERROR]', err);
		// Fall back to original modules if migration fails
		return currentModules;
	}
}

/**
 * Auth middleware — runs on every request.
 *
 * The middleware:
 * 1. Checks if route is public → allow through
 * 2. Validates Clerk JWT from __session cookie → redirect to login if missing
 * 3. Queries Supabase for user's module_access → 403 if unauthorized
 * 4. Populates event.locals.user with real data
 */
const authHandle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Static assets pass through
	if (path.startsWith('/_app')) {
		return resolve(event);
	}

	// API routes: authenticate but return JSON errors (never HTML redirects)
	const isApiRoute = path.startsWith('/api/');
	if (isApiRoute && (path === '/api/geo' || path === '/api/notify' || path === '/api/validate-sources' || path === '/api/location-intel' || path === '/api/cache-health' || path === '/api/street-side-test' || path === '/api/seed-reference-data' || path === '/api/onboarding-chat' || (env.NODE_ENV === 'development' && path === '/api/location-iq'))) {
		return resolve(event);
	}

	// Public routes — auth optional (try to populate user if session exists)
	if (PUBLIC_ROUTES.includes(path) || path === '/login') {
		const publicSessionToken = event.cookies.get('__session') ||
			(env.NODE_ENV === 'development' ? event.cookies.get('__clerk_db_jwt') : null);
		if (publicSessionToken) {
			try {
				const jwtPayload = getCachedPayload(publicSessionToken) || await verifyToken(publicSessionToken, { secretKey: getClerkSecretKey() });
				setCachedPayload(publicSessionToken, jwtPayload);
				const userId = jwtPayload.sub;
				if (userId) {
					// Fast path: use cached user
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
					} else {
						const user = await getClerk().users.getUser(userId);
						const userEmail = user.emailAddresses[0]?.emailAddress || '';
						const displayName = user.fullName || userEmail || 'User';
						const initials = displayName.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2) || 'U';

						const { data: moduleAccess } = await getServiceDb()
							.from('module_access')
							.select('module')
							.eq('user_id', userId);

						let userModules = (moduleAccess || []).map(m => m.module);
						userModules = await migrateLegacyModules(userId, userModules);
						const isSuperAdmin = (await getAdminEmails()).includes(userEmail.toLowerCase());

						const plan = ((user.publicMetadata as any)?.plan === 'pro' ? 'pro' : 'free') as 'free' | 'pro';
						event.locals.user = {
							id: userId,
							name: displayName,
							initials,
							role: 'member' as const,
							modules: userModules,
							plan
						};

						setCachedUser(userId, {
							name: displayName,
							initials,
							role: 'member',
							modules: userModules,
							email: userEmail,
							isSuperAdmin,
							plan
						});
					}
				}
			} catch (_e) {
				// Auth failed on public route — that's fine, continue as anonymous
			}
		}
		return resolve(event);
	}

	// --- AUTH CHECK ---
	// Extract session token: cookie for browser requests, Bearer header for API clients
	// __clerk_db_jwt is only checked in development (Clerk's dev-mode JWT)
	const bearerToken = isApiRoute
		? event.request.headers.get('authorization')?.replace('Bearer ', '')
		: null;
	const sessionToken = bearerToken ||
		event.cookies.get('__session') ||
		(env.NODE_ENV === 'development' ? event.cookies.get('__clerk_db_jwt') : null);

	if (!sessionToken) {
		if (isApiRoute) {
			return new Response(JSON.stringify({ error: 'Authentication required' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		// For /app/* routes, let the request through without user data.
		// The layout renders the app shell for /app/* paths even without user data,
		// and Clerk's client-side SDK will detect no session and redirect to login
		// client-side — avoiding the jarring server-side redirect flash.
		if (path.startsWith('/app')) {
			event.locals.user = undefined as any;
			return resolve(event);
		}
		throw redirect(303, '/login');
	}

	try {
		// Verify JWT token from Clerk (check cache first to avoid round-trip latency)
		const jwtPayload = getCachedPayload(sessionToken) || await verifyToken(sessionToken, { secretKey: getClerkSecretKey() });
		setCachedPayload(sessionToken, jwtPayload);
		const userId = jwtPayload.sub;
		if (!userId) {
			throw redirect(303, '/login');
		}

		// ── Fast path: use cached user data to skip Clerk + Supabase round-trips ──
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
						return new Response(JSON.stringify({ error: 'Access denied. You don\'t have permission.' }), {
							status: 403,
							headers: { 'Content-Type': 'application/json' }
						});
					}
					throw error(403, {
						message: 'Access denied. You don\'t have permission to view this section.'
					});
				}
			}

			return resolve(event);
		}

		// ── Slow path: first request or cache expired — full Clerk + Supabase lookup ──

		// Check if user exists in Supabase
		const { data: existingUser } = await getServiceDb()
			.from('users')
			.select('role')
			.eq('id', userId)
			.single();

		// Get user details from Clerk (needed for auto-create and display)
		const user = await getClerk().users.getUser(userId);

		// Get user email for super admin check
		const userEmail = user.emailAddresses[0]?.emailAddress || '';
		const isSuperAdmin = (await getAdminEmails()).includes(userEmail.toLowerCase());

		// Auto-create user if they don't exist
		if (!existingUser) {
			const userName = user.fullName || userEmail;

			if (isSuperAdmin) {
				// Super admins get auto-approved with full access
				await getServiceDb().from('users').insert({
					id: userId, email: userEmail, name: userName, role: 'owner'
				});
				const moduleInserts = ALL_MODULES.map(module => ({
					user_id: userId, module, granted_by: 'system'
				}));
				await getServiceDb().from('module_access').insert(moduleInserts);
			} else {
				// Check if email is whitelisted
				const { data: whitelistEntry } = await getServiceDb()
					.from('email_whitelist')
					.select('modules')
					.eq('email', userEmail.toLowerCase())
					.single();

				const role = whitelistEntry ? 'member' : 'pending';
				const modules = whitelistEntry?.modules || [];

				await getServiceDb().from('users').insert({
					id: userId, email: userEmail, name: userName, role
				});

				if (whitelistEntry && modules.length > 0) {
					const moduleInserts = modules.map((module: string) => ({
						user_id: userId, module, granted_by: 'system'
					}));
					await getServiceDb().from('module_access').insert(moduleInserts);
				}

				if (!whitelistEntry) {
					// Fire and forget — notify admins about new pending user
					sendNewUserNotification(userName, userEmail).catch(err =>
						console.error('[NOTIFY FAILED]', err)
					);

					throw redirect(303, '/pending');
				}
			}
		}

		// If user is pending but is a super admin, upgrade them
		if (existingUser && existingUser.role === 'pending' && isSuperAdmin) {
			await getServiceDb().from('users').update({ role: 'owner' }).eq('id', userId);
			const moduleInserts = ALL_MODULES.map(module => ({
				user_id: userId, module, granted_by: 'system'
			}));
			await getServiceDb().from('module_access').upsert(moduleInserts, { onConflict: 'user_id,module' });
		} else if (existingUser && existingUser.role === 'pending') {
			throw redirect(303, '/pending');
		}

		// Look up user's module access in Supabase
		const { data: moduleAccess, error: dbError } = await getServiceDb()
			.from('module_access')
			.select('module')
			.eq('user_id', userId);

		if (dbError) {
			console.error('Error fetching module access:', dbError);
			throw error(500, { message: 'Failed to load permissions' });
		}

		let userModules = (moduleAccess || []).map((m: { module: string }) => m.module);
		userModules = await migrateLegacyModules(userId, userModules);

		// Super admins always get all modules
		if (isSuperAdmin) {
			const missing = ALL_MODULES.filter(m => !userModules.includes(m));
			if (missing.length > 0) {
				userModules = [...new Set([...userModules, ...ALL_MODULES])];
			}
		}

		// Extract display name and initials
		const displayName = user.fullName || user.emailAddresses[0]?.emailAddress || 'User';
		const initials = displayName
			.split(' ')
			.map(part => part[0])
			.join('')
			.toUpperCase()
			.slice(0, 2) || 'U';

		// Populate event.locals.user
		const plan = ((user.publicMetadata as any)?.plan === 'pro' ? 'pro' : 'free') as 'free' | 'pro';
		event.locals.user = {
			id: userId,
			name: displayName,
			initials: initials,
			role: 'member' as const,
			modules: userModules,
			plan
		};

		// Cache the resolved user for fast subsequent navigations
		setCachedUser(userId, {
			name: displayName,
			initials,
			role: 'member',
			modules: userModules,
			email: userEmail,
			isSuperAdmin,
			plan
		});

		// --- MODULE ACCESS CHECK ---
		// Super admins bypass module gating entirely
		if (!isSuperAdmin) {
			const requiredModule = getModuleForRoute(path);

			if (requiredModule && !userModules.includes(requiredModule)) {
				if (isApiRoute) {
					return new Response(JSON.stringify({ error: 'Access denied. You don\'t have permission.' }), {
						status: 403,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				throw error(403, {
					message: 'Access denied. You don\'t have permission to view this section.'
				});
			}
		}
	} catch (err: unknown) {
		// Re-throw SvelteKit redirects and errors (they have status or location)
		if (err && typeof err === 'object') {
			const e = err as Record<string, unknown>;
			if (e.location || (typeof e.status === 'number' && e.status >= 300 && e.status < 400)) {
				// For API routes, convert redirects to JSON 401
				if (isApiRoute) {
					return new Response(JSON.stringify({ error: 'Authentication required' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				throw err; // redirect
			}
			if (typeof e.status === 'number' && e.body) {
				// For API routes, convert SvelteKit errors to JSON
				if (isApiRoute) {
					return new Response(JSON.stringify({ error: (e.body as Record<string, unknown>)?.message || 'Server error' }), {
						status: e.status as number,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				throw err; // SvelteKit error()
			}
		}

		const errMsg = String(err instanceof Error ? err.message : String(err)).toLowerCase();

		// Only these are truly unrecoverable — the token structure is broken.
		const isStructurallyBroken = errMsg.includes('malformed') ||
			errMsg.includes('invalid signature') ||
			errMsg.includes('wrong key') ||
			errMsg.includes('not a valid') ||
			errMsg.includes('decode');

		if (isStructurallyBroken) {
			// Token is garbage — clear it
			console.error('Auth failure (structurally broken token):', errMsg);
			event.cookies.delete('__session', { path: '/' });
			if (isApiRoute) {
				return new Response(JSON.stringify({ error: 'Invalid session' }), {
					status: 401, headers: { 'Content-Type': 'application/json' }
				});
			}
			throw redirect(303, '/login');
		}

		// ── Recovery path for expired / transient errors ──
		// Clerk JWTs expire every ~60s. Instead of bouncing to /login,
		// extract the userId from the JWT payload (base64, not encrypted)
		// and check the user cache. If we verified this user recently,
		// serve the request using cached data — zero redirect.
		const tokenParts = sessionToken.split('.');
		if (tokenParts.length === 3) {
			try {
				const payloadJson = Buffer.from(tokenParts[1], 'base64url').toString();
				const payload = JSON.parse(payloadJson);
				const userId = payload.sub;
				if (userId) {
					const cached = getCachedUser(userId);
					if (cached) {
						// User was verified recently — serve from cache
						event.locals.user = {
							id: userId,
							name: cached.name,
							initials: cached.initials,
							role: cached.role,
							modules: cached.modules,
							plan: cached.plan || 'free'
						};

						if (!cached.isSuperAdmin) {
							const requiredModule = getModuleForRoute(path);
							if (requiredModule && !cached.modules.includes(requiredModule)) {
								if (isApiRoute) {
									return new Response(JSON.stringify({ error: 'Access denied' }), {
										status: 403, headers: { 'Content-Type': 'application/json' }
									});
								}
								throw error(403, { message: 'Access denied.' });
							}
						}

						return resolve(event);
					}
				}
			} catch (_) {
				// JWT payload parse failed — fall through to transient handling
			}
		}

		// No cached user to recover from — let request through without user data.
		// The page will render (layout handles /app/* with undefined user)
		// and the next full-page load (or login visit) will refresh the session.
		console.error('Auth: no cached user, letting through:', errMsg);
		if (isApiRoute) {
			return new Response(JSON.stringify({ error: 'Session refresh needed' }), {
				status: 401, headers: { 'Content-Type': 'application/json' }
			});
		}
		event.locals.user = undefined as any;
		return resolve(event);
	}

	return resolve(event);
};

// Compose Sentry + auth handles using SvelteKit's sequence helper
export const handle = env.SENTRY_DSN
	? sequence(Sentry.sentryHandle(), authHandle)
	: authHandle;

// Server-side error handler — reports to Sentry when configured
export const handleError = Sentry.handleErrorWithSentry();
