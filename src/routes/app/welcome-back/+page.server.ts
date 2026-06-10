/**
 * ═══════════════════════════════════════════════════════
 * RE² Welcome Back — Server Load
 * ═══════════════════════════════════════════════════════
 *
 * Loads the returning user's session data from Supabase
 * and passes it to the page for the recap display.
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db-server';
import { founderSessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;

	if (!user?.id) {
		throw redirect(303, '/login');
	}

	try {
		// FIX-NAV-02: select fullData (current write path)
		const existingArr = await db.select({
			fullData: founderSessions.fullData,
			updatedAt: founderSessions.updatedAt,
			createdAt: founderSessions.createdAt
		}).from(founderSessions).where(eq(founderSessions.userId, user.id)).limit(1);

		const data = existingArr.length > 0 ? existingArr[0] : null;
		
		// FIX-NAV-02: use fullData
		const rawData = data?.fullData;

		if (!rawData) {
			// No data found — new user, send to onboarding
			throw redirect(303, '/app/onboarding');
		}

		const sessionData = rawData as Record<string, unknown>;
		// Legacy deep-nested sub-objects (old data shape)
		const chatStore = sessionData.chatStore as Record<string, unknown> | null;
		const session = sessionData.session as Record<string, unknown> | null;
		const launchpad = sessionData.launchpad as Record<string, unknown> | null;

		// Guard: user must have meaningful data to see welcome-back.
		// If they only have empty/minimal data, they're still "new" → onboarding.
		const hasPersona = !!(
			(session?.personaType) ||
			(chatStore?.extractedData as any)?.personaType ||
			(launchpad?.businessType) ||
			// FIX-NAV-02: current launchpad-store writes businessType at top level
			(sessionData.businessType)
		);
		const hasChat = !!(chatStore?.messages && (chatStore.messages as any[]).length > 1);
		const hasLaunchpad = !!(launchpad?.businessType || sessionData.businessType);

		if (!hasPersona && !hasChat && !hasLaunchpad) {
			// No real data — treat as new user
			throw redirect(303, '/app/onboarding');
		}

		// FIX-NAV-02: Read location results from the fields that location page actually writes.
		// Location page saves: re2_session.locationIQ, re2_session.analyzedAddress (localStorage).
		// launchpad-store.syncToSupabase() includes these as top-level fields in full_data.
		// Legacy shape: session.locationData.address + session.locationData.compositeScore.
		const locationIQ = (sessionData.locationIQ as number) || (session?.locationIQ as number) || 0;
		const analyzedAddress = (sessionData.analyzedAddress as string) || (session?.analyzedAddress as string) || '';
		const legacyAddress = (session?.locationData as any)?.address || null;
		const legacyScore = (session?.locationData as any)?.compositeScore || null;

		// Build the recap summary from whatever data we have
		const recap = {
			personaType: (sessionData.businessType as string)
				|| (session?.personaType as string)
				|| (chatStore?.extractedData as any)?.personaType
				|| (launchpad?.businessType as string)
				|| null,
			personaKey: (sessionData.businessType as string)
				|| (session?.personaKey as string)
				|| (chatStore?.personaKey as string)
				|| null,
			conceptDescription: (sessionData.differentiator as string)
				|| (sessionData.visionStatement as string)
				|| (session?.conceptDescription as string)
				|| (chatStore?.extractedData as any)?.conceptDescription
				|| (launchpad?.visionStatement as string)
				|| null,
			conceptName: (chatStore?.extractedData as any)?.conceptName || null,
			targetCustomers: (chatStore?.extractedData as any)?.targetCustomers || [],
			differentiators: (chatStore?.extractedData as any)?.differentiators || [],
			financialEstimates: (chatStore?.extractedData as any)?.financialEstimates
				|| (sessionData.financialGoals as any)
				|| (session?.smartDefaults as any)
				|| null,
			// FIX-NAV-02: prefer current field names, fall back to legacy
			lastAddress: analyzedAddress || legacyAddress,
			lastScore: locationIQ || legacyScore,
			lastVerdict: (sessionData.lastVerdict as string) || (session?.verdict as string) || null,
			hasComparisonLocations: !!(sessionData.scoredLocations && (sessionData.scoredLocations as any[]).length > 1),
			conversationPhase: (chatStore?.conversationPhase as string) || null,
			updatedAt: data?.updatedAt,
			createdAt: data?.createdAt
		};

		return {
			recap,
			userName: (user as any).name || (user as any).firstName || 'there'
		};
	} catch (err) {
		// Re-throw redirects
		if (err && typeof err === 'object' && 'status' in err) throw err;

		console.error('[welcome-back] Error loading recap:', err);
		throw redirect(303, '/app/onboarding');
	}
};
