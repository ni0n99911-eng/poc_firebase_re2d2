/**
 * Profile Sync API — POST /api/profile-sync
 *
 * Upserts the current user's onboarding data into client_profiles.
 * Called once from handoff() when the user completes onboarding.
 *
 * Auth: Clerk JWT via __session cookie (requireAuth middleware).
 * RLS: client_profiles policies enforce user_id isolation.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/auth-middleware';
import { db } from '$lib/db-server';
import { clientProfiles } from '$lib/db/schema';
import type { LaunchPadData } from '$lib/launchpad-store';

// ── Budget range derivation ──
function deriveBudgetRange(monthlyRent: number): string | null {
	if (!monthlyRent || monthlyRent <= 0) return null;
	if (monthlyRent < 3000)  return 'under_3k';
	if (monthlyRent < 5000)  return '3k_5k';
	if (monthlyRent < 10000) return '5k_10k';
	return '10k_plus';
}

// ── Neighborhood string → array ──
function parseNeighborhoods(raw: string | undefined): string[] | null {
	if (!raw?.trim()) return null;
	const parts = raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
	return parts.length ? parts : null;
}

export const POST: RequestHandler = async ({ request }) => {
	// ── Auth ──
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;

	// ── Parse body ──
	let body: Partial<LaunchPadData>;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// ── Map LaunchPadData → client_profiles columns ──
	const sqft = body.financialGoals?.squareFootage ?? 0;
	const payload = {
		user_id: auth.userId,

		// Business identity
		business_name:        body.businessName   || null,
		business_type:        body.businessType   || null,
		concept_description:  body.differentiator || body.visionStatement || null,

		// Location preferences
		target_neighborhoods: parseNeighborhoods(body.preferredNeighborhoods),
		budget_range:         deriveBudgetRange(body.financialGoals?.monthlyRentBudget ?? 0),

		// Space requirements
		preferred_square_footage_min: sqft > 0 ? sqft            : null,
		preferred_square_footage_max: sqft > 0 ? Math.round(sqft * 1.5) : null,

		// Hard requirements (from sacred flags)
		requires_outdoor_seating: body.sacred?.['outdoor_seating'] ?? false,
		requires_liquor_license:  body.sacred?.['liquor_license']  ?? false,

		// Onboarding status
		onboarding_completed: true,
		onboarding_step:      10
	};

	// ── Upsert with user context for audit triggers ──
	try {
		await db.insert(clientProfiles)
			.values({ userId: auth.userId, data: payload })
			.onConflictDoUpdate({ target: clientProfiles.userId, set: { data: payload } });
	} catch (error: any) {
		console.error('[profile-sync] upsert failed:', error.message, error.code);
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return new Response(JSON.stringify({ ok: true }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
