import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
	if (!_supabase) {
		_supabase = createClient(
			env.PUBLIC_SUPABASE_URL || '',
			env.PUBLIC_SUPABASE_ANON_KEY || ''
		);
	}
	return _supabase;
}

/**
 * B2-0.1 + BUG-02 + D12 FIX: Create a Supabase client with a fresh Clerk JWT.
 *
 * Clerk JWTs expire in ~60s. The shared anon client has no auth header —
 * authenticated writes will fail once the token is stale. This helper returns
 * a client with the Bearer header set.
 *
 * Previous implementation called createClient() on every call, which spawned
 * multiple GoTrueClient auth sub-clients (visible as "Multiple GoTrueClient
 * instances" warning in DevTools). The duplicate GoTrue clients race each
 * other writing to localStorage and can overwrite each other's tokens.
 *
 * Fix: cache authed clients by token prefix. Identical tokens (within a
 * Clerk refresh window) reuse the same client. Auth sub-module is explicitly
 * disabled (persistSession/autoRefreshToken/detectSessionInUrl all false)
 * so a bearer-only client never instantiates a GoTrue storage listener.
 */
const _authedClients = new Map<string, SupabaseClient>();
const AUTHED_CLIENT_CACHE_MAX = 8; // Bound memory — 8 distinct fresh tokens is generous

export function getAuthedSupabase(token: string): SupabaseClient {
	if (!token) return getSupabase();
	// Use first 32 chars of token as cache key — sufficient entropy, avoids
	// storing full JWT in memory as a Map key.
	const key = token.slice(0, 32);
	const cached = _authedClients.get(key);
	if (cached) return cached;

	// Evict oldest when at capacity
	if (_authedClients.size >= AUTHED_CLIENT_CACHE_MAX) {
		const oldestKey = _authedClients.keys().next().value;
		if (oldestKey) _authedClients.delete(oldestKey);
	}

	const client = createClient(
		env.PUBLIC_SUPABASE_URL || '',
		env.PUBLIC_SUPABASE_ANON_KEY || '',
		{
			global: { headers: { Authorization: `Bearer ${token}` } },
			auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
		}
	);
	_authedClients.set(key, client);
	return client;
}

/**
 * B2-0.1: Fetch a fresh Clerk JWT and return an authed Supabase client.
 * Centralized so callers don't need to re-implement the skipCache + fallback
 * pattern. Returns the shared anon client if Clerk isn't loaded yet.
 *
 * Usage:
 *   const sb = await getFreshAuthedSupabase();
 *   await sb.from('founder_sessions').upsert(row);
 */
export async function getFreshAuthedSupabase(): Promise<SupabaseClient> {
	if (typeof window === 'undefined') return getSupabase();
	const clerkSession = (window as { Clerk?: { session?: { getToken?: (opts?: { skipCache?: boolean }) => Promise<string | null> } } }).Clerk?.session;
	if (!clerkSession?.getToken) return getSupabase();
	try {
		// skipCache: true forces a fresh JWT — Clerk's default template TTL is 60s
		// and a cached token may be expired by the time the upsert fires.
		const freshToken = await clerkSession.getToken({ skipCache: true });
		if (freshToken) return getAuthedSupabase(freshToken);
		console.warn('[Supabase] Clerk session exists but getToken returned null — using anon client');
		return getSupabase();
	} catch (err) {
		console.warn('[Supabase] JWT refresh failed — using anon client:', err);
		return getSupabase();
	}
}

// Backward-compatible default export — lazy getter
export const supabase = new Proxy({} as SupabaseClient, {
	get(_target, prop) {
		return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
	}
});

// Types for our data model
export interface ModuleAccess {
	id: number;
	user_id: string;
	module: 'location-einstein' | 'space-einstein' | 'business-einstein' | 'loan-einstein' | 'launch-einstein' | 'operations-einstein';
	access: 'view' | 'edit' | 'admin';
	granted_at: string;
}

export interface UserProfile {
	id: string;
	email: string;
	display_name: string;
	role: 'owner' | 'member';
	modules: string[];
}
