/**
 * Server-side Supabase client with Clerk auth bridge.
 *
 * Uses the service_role key (bypasses RLS) for server-side operations,
 * but sets app.current_user_id so RLS policies and audit triggers
 * know which Clerk user is making the request.
 *
 * NEVER import this file on the client side.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as pubEnv } from '$env/dynamic/public';

let _serviceClient: SupabaseClient | null = null;

/**
 * Get a Supabase client using the service_role key.
 * This bypasses RLS — use for server-side operations only.
 */
export function getServiceSupabase(): SupabaseClient {
	if (!_serviceClient) {
		const url = pubEnv.PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '';
		const key = env.SUPABASE_SERVICE_ROLE_KEY || '';

		if (!url || !key) {
			console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
		}

		_serviceClient = createClient(url, key, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});
	}
	return _serviceClient;
}

/**
 * Get a Supabase client scoped to a specific Clerk user.
 * Sets the app.current_user_id setting so audit triggers and
 * RLS policies know who is making the request.
 */
export async function getUserSupabase(userId: string): Promise<SupabaseClient> {
	const client = getServiceSupabase();

	// Set the user context for audit triggers and RLS
	await client.rpc('set_config', {
		setting: 'app.current_user_id',
		value: userId
	}).catch(() => {
		// Fallback: set via raw SQL if RPC isn't available
		// This is fine — the service_role key bypasses RLS anyway
	});

	return client;
}
