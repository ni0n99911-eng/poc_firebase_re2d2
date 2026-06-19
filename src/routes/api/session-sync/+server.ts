/**
 * ═══════════════════════════════════════════════════════
 * RE² Session Sync API — Cloud SQL (Drizzle) L2 Persistence
 * ═══════════════════════════════════════════════════════
 *
 * Server-side endpoint that bridges client localStorage (L1)
 * to Cloud SQL via Drizzle ORM (L2).
 *
 * POST: Upsert launchpad/session data for the authenticated user
 * GET:  Load session data (device switch / empty localStorage)
 *
 * Auth: Firebase session cookie (__session) verified in hooks.server.ts.
 *       Unauthenticated requests receive a graceful 200 no-op so the
 *       client-side store doesn't spam the console with 401 errors.
 *       LocalStorage (L1) is always the source of truth for anon users.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db-server';
import { founderSessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user?.id) {
		// Graceful no-op for unauthenticated users — localStorage (L1) is the source of truth.
		// Returning 200 prevents console spam when the launchpad store syncs before login.
		return json({ ok: true, noop: true });
	}

	const body = await request.json();
	const { chatStore, session, launchpad, journeyState, shortlistedLocations } = body;

	if (!chatStore && !session && !launchpad && !journeyState && !shortlistedLocations) {
		throw error(400, 'No data provided. Send chatStore, session, launchpad, journeyState, or shortlistedLocations.');
	}

	try {
		// Load existing data first so we merge, not overwrite
		const existingArr = await db.select({ fullData: founderSessions.fullData }).from(founderSessions).where(eq(founderSessions.userId, user.id)).limit(1);
		const existingData = (existingArr.length > 0 ? existingArr[0].fullData : {}) as any || {};

		// Merge new data into existing
		const merged: Record<string, unknown> = { ...existingData };
		if (chatStore) merged.chatStore = chatStore;
		if (session) merged.session = session;
		if (launchpad) merged.launchpad = launchpad;

		// Extract top-level fields for query convenience
		const personaType = (session?.personaType || chatStore?.extractedData?.personaType || existingData?.session?.personaType || null);
		const conceptDesc = (session?.conceptDescription || chatStore?.extractedData?.conceptDescription || existingData?.session?.conceptDescription || null);
		const address = (session?.locationData?.address || existingData?.session?.locationData?.address || null);

		// Build upsert payload
		const upsertPayload: Record<string, unknown> = {
			userId: user.id,
			sessionId: session?.sessionId || chatStore?.sessionId || existingData?.session?.sessionId || `sess_${user.id}`,
			personaType: personaType,
			conceptDescription: conceptDesc,
			address: address,
			fullData: merged,
			updatedAt: new Date(),
		};
		if (journeyState)         upsertPayload.journeyState          = journeyState;
		if (shortlistedLocations) upsertPayload.shortlistedLocations  = shortlistedLocations;

		// Perform upsert with Drizzle (Postgres specific)
		await db.insert(founderSessions)
			.values(upsertPayload as any)
			.onConflictDoUpdate({
				target: founderSessions.userId,
				set: upsertPayload as any
			});

		return json({ ok: true });
	} catch (err: any) {
		console.error('[session-sync] Error:', err);
		return json({ ok: false, error: err.message || 'Internal error' }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user?.id) {
		// Graceful no-op for unauthenticated users — return empty found so localStorage stays primary.
		return json({ found: false, data: null });
	}

	try {
		const existingArr = await db.select({
			fullData: founderSessions.fullData,
			journeyState: founderSessions.journeyState,
			shortlistedLocations: founderSessions.shortlistedLocations,
			updatedAt: founderSessions.updatedAt,
			createdAt: founderSessions.createdAt
		}).from(founderSessions).where(eq(founderSessions.userId, user.id)).limit(1);

		if (existingArr.length === 0) {
			return json({ found: false, data: null });
		}

		const data = existingArr[0];

		return json({
			found: true,
			data: data.fullData || null,
			journeyState: data.journeyState || null,
			shortlistedLocations: data.shortlistedLocations || [],
			updatedAt: data.updatedAt,
			createdAt: data.createdAt
		});
	} catch (err) {
		console.error('[session-sync] Error:', err);
		return json({ found: false, data: null, error: 'Internal error' }, { status: 500 });
	}
};
