/**
 * Analytics Capture — Records founder interactions for the learning layer.
 *
 * Every founder interaction is intelligence: what they tell us, what they
 * correct, what they skip, and what they come back to.
 *
 * Uses Supabase client-side (anon key with RLS) for authenticated users,
 * or falls back to the server-side feedback API for anonymous users.
 *
 * All captures are fire-and-forget — never block the UI.
 */

// Supabase removed

// ─── Message Capture ───────────────────────────────────────

/**
 * Capture a conversation message (AI or founder) during onboarding.
 */
export async function captureMessage(
	sessionId: string,
	role: 'ai' | 'founder' | 'system',
	content: string,
	metadata: Record<string, unknown> = {},
	modelTier?: string,
	tokensIn?: number,
	tokensOut?: number,
	latencyMs?: number
): Promise<void> {
	// Supabase removed, function stubbed
	return Promise.resolve();
}

// ─── Correction Capture ────────────────────────────────────

/**
 * Capture when a founder corrects or adjusts an AI suggestion.
 * THE KEY SIGNAL: tells us if our benchmarks are wrong.
 */
export async function captureCorrection(
	sessionId: string,
	correctionType: string,
	fieldName: string,
	aiSuggested: unknown,
	founderValue: unknown,
	personaType: string,
	context?: string
): Promise<void> {
	// Supabase removed, function stubbed
	return Promise.resolve();
}

// ─── Feedback Capture ──────────────────────────────────────

/**
 * Capture thumbs up/down feedback on dashboard components.
 * Works both client-side (Supabase) and via server API fallback.
 */
export async function captureFeedback(
	sessionId: string | null,
	component: string,
	itemId: string,
	feedback: 'helpful' | 'not_helpful',
	personaType?: string,
	itemContent?: string
): Promise<void> {
	try {
		// Try server-side API (works for anonymous users too)
		await fetch('/api/feedback', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				component,
				itemId,
				feedback,
				sessionId,
				context: {
					persona_type: personaType,
					item_content: itemContent
				}
			})
		});
	} catch (err) {
		console.error('[Capture] Failed to capture feedback:', err);
	}
}

// ─── Location Search Capture ───────────────────────────────

/**
 * Capture a location scoring event — called after scoring completes.
 */
export async function captureLocationSearch(
	sessionId: string,
	data: {
		address: string;
		neighborhood?: string;
		borough?: string;
		geohash: string;
		lat: number;
		lng: number;
		personaType: string;
		conceptDescription?: string;
		locationIq: number;
		fitIq?: number;
		sixIndices: Record<string, number>;
		headsUpCards?: unknown[];
		businessModel?: Record<string, unknown>;
		apiSourcesStatus?: Record<string, string>;
	}
): Promise<void> {
	// Supabase removed, function stubbed
	return Promise.resolve();
}

// ─── Neighborhood Intelligence Upsert ──────────────────────

/**
 * Upsert neighborhood intelligence after scoring.
 * Fires to the server-side API which aggregates stats.
 */
export async function upsertNeighborhoodIntelligence(
	lat: number,
	lng: number,
	businessType: string,
	compositeScore: number,
	signals: { positive: string[]; negative: string[] },
	topFactors: Record<string, number>
): Promise<void> {
	try {
		await fetch('/api/neighborhood-intelligence', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				lat,
				lng,
				businessType,
				compositeScore,
				signals,
				topFactors
			})
		});
	} catch (err) {
		console.error('[Capture] Failed to upsert neighborhood intelligence:', err);
	}
}

// ─── Founder Profile Upsert ────────────────────────────────

/**
 * Create or update the founder's profile built from conversation.
 */
export async function upsertFounderProfile(
	sessionId: string,
	data: {
		personaType: string;
		conceptName?: string;
		conceptDescription?: string;
		targetCustomers?: string[];
		differentiators?: string[];
		financialEstimates?: Record<string, unknown>;
		scoringHints?: Record<string, unknown>;
		conversationPhase?: string;
		completed?: boolean;
	}
): Promise<void> {
	// Supabase removed, function stubbed
	return Promise.resolve();
}
