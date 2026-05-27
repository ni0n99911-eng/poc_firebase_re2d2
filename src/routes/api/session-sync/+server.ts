/**
 * ═══════════════════════════════════════════════════════
 * RE² Session Sync API — Supabase L2 Persistence
 * ═══════════════════════════════════════════════════════
 *
 * Server-side endpoint that bridges client localStorage (L1)
 * to Supabase (L2) using service_role key.
 *
 * POST: Upsert session data (chat store, session, or both)
 * GET:  Load session data for authenticated user (device switch / empty localStorage)
 *
 * Auth: Requires Clerk session (verified in hooks.server.ts)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user?.id) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();
	const { chatStore, session, launchpad, journeyState, shortlistedLocations } = body;

	if (!chatStore && !session && !launchpad && !journeyState && !shortlistedLocations) {
		throw error(400, 'No data provided. Send chatStore, session, launchpad, journeyState, or shortlistedLocations.');
	}

	try {
		const supabase = getServiceSupabase();

		// FIX-006: Read from full_data (migration 008 renamed 'data' → 'full_data').
		// Load existing data first so we merge, not overwrite
		const { data: existing } = await supabase
			.from('founder_sessions')
			.select('full_data')
			.eq('user_id', user.id)
			.single();

		const existingData = (existing as any)?.full_data || {};

		// Merge new data into existing
		const merged: Record<string, unknown> = { ...existingData };
		if (chatStore) merged.chatStore = chatStore;
		if (session) merged.session = session;
		if (launchpad) merged.launchpad = launchpad;

		// Extract top-level fields for query convenience
		const personaType = (session?.personaType || chatStore?.extractedData?.personaType || existingData?.session?.personaType || null);
		const conceptDesc = (session?.conceptDescription || chatStore?.extractedData?.conceptDescription || existingData?.session?.conceptDescription || null);
		const address = (session?.locationData?.address || existingData?.session?.locationData?.address || null);

		// Build upsert payload — include new columns if provided
		// FIX-006: Write to full_data (migration 008 renamed 'data' → 'full_data')
		const upsertPayload: Record<string, unknown> = {
			user_id: user.id,
			session_id: session?.sessionId || chatStore?.sessionId || existingData?.session?.sessionId || `sess_${user.id}`,
			persona_type: personaType,
			concept_description: conceptDesc,
			address: address,
			full_data: merged,
			updated_at: new Date().toISOString(),
		};
		if (journeyState)         upsertPayload.journey_state          = journeyState;
		if (shortlistedLocations) upsertPayload.shortlisted_locations  = shortlistedLocations;

		const { error: dbError } = await supabase
			.from('founder_sessions')
			.upsert(upsertPayload, { onConflict: 'user_id' });

		if (dbError) {
			console.error('[session-sync] Supabase upsert error:', dbError);
			// Don't throw — localStorage is primary, Supabase is L2
			return json({ ok: false, error: dbError.message }, { status: 500 });
		}

		return json({ ok: true });
	} catch (err) {
		console.error('[session-sync] Error:', err);
		return json({ ok: false, error: 'Internal error' }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user?.id) {
		throw error(401, 'Authentication required');
	}

	try {
		const supabase = getServiceSupabase();

		// FIX-006: Select full_data (migration 008 renamed 'data' → 'full_data')
		const { data, error: dbError } = await supabase
			.from('founder_sessions')
			.select('full_data, journey_state, shortlisted_locations, updated_at, created_at')
			.eq('user_id', user.id)
			.single();

		if (dbError) {
			// PGRST116 = no rows found — that's fine, new user
			if (dbError.code === 'PGRST116') {
				return json({ found: false, data: null });
			}
			console.error('[session-sync] Supabase read error:', dbError);
			return json({ found: false, data: null, error: dbError.message }, { status: 500 });
		}

		return json({
			found: true,
			data: (data as any)?.full_data || null,
			journeyState: data?.journey_state || null,
			shortlistedLocations: data?.shortlisted_locations || [],
			updatedAt: data?.updated_at,
			createdAt: data?.created_at
		});
	} catch (err) {
		console.error('[session-sync] Error:', err);
		return json({ found: false, data: null, error: 'Internal error' }, { status: 500 });
	}
};
