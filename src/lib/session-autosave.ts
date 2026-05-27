/**
 * ═══════════════════════════════════════════════════════
 * RE² Session Auto-Save — Background Sync Utility
 * ═══════════════════════════════════════════════════════
 *
 * Fire-and-forget: reads localStorage L1, posts to /api/session-sync (L2).
 * Never blocks the caller. Never throws. Auth failures are silent —
 * if the user is not signed in, the endpoint 401s and we ignore it.
 *
 * Usage:
 *   import { backgroundSync, restoreSession } from '$lib/session-autosave';
 *
 *   // After scoring / save events:
 *   backgroundSync({ trigger: 'location_scored' });
 *
 *   // On login, hydrate localStorage from DB if local is empty:
 *   await restoreSession();
 */

export type SyncTrigger =
	| 'location_scored'
	| 'financials_visited'
	| 'model_visited'
	| 'manual_save';

/**
 * Reads re2_session + re2_launchpad from localStorage and posts to
 * /api/session-sync in the background. Returns immediately.
 * Also syncs shortlisted_locations and journey_state derived from session.
 */
export function backgroundSync(opts?: { trigger?: SyncTrigger }): void {
	if (typeof window === 'undefined') return;

	// Defer to next microtask so the caller's localStorage write settles first
	Promise.resolve().then(async () => {
		try {
			const rawSession  = localStorage.getItem('re2_session');
			const rawLaunchpad = localStorage.getItem('re2_launchpad');

			const session  = rawSession  ? JSON.parse(rawSession)  : null;
			const launchpad = rawLaunchpad ? JSON.parse(rawLaunchpad) : null;

			// Nothing worth syncing
			if (!session && !launchpad) return;

			// Build journey_state from current localStorage flags
			const journeyState = {
				locationScored:        (session?.locationIQ ?? 0) > 0,
				financialsVisited:     localStorage.getItem('re2_financials_visited') === 'true',
				modelVisited:          localStorage.getItem('re2_model_visited') === 'true',
				businessPlanGenerated: session?.businessPlanGenerated === true,
				lastTrigger:           opts?.trigger ?? 'unknown',
				lastSyncedAt:          new Date().toISOString(),
			};

			// Build shortlisted_locations from launchpad.scoredLocations
			const shortlistedLocations = launchpad?.scoredLocations ?? [];

			const body: Record<string, unknown> = { journeyState, shortlistedLocations };
			if (session)  body.session  = session;
			if (launchpad) body.launchpad = launchpad;

			const res = await fetch('/api/session-sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				// 8s timeout — enough for slow connections, doesn't block UX
				signal: AbortSignal.timeout(8_000),
			});

			if (res.ok) {
				// Dispatch an event so the UX thread's sync indicator can react
				window.dispatchEvent(new CustomEvent('re2:synced', {
					detail: { trigger: opts?.trigger, ok: true }
				}));
			}
		} catch {
			// Silently swallow — localStorage is always the primary source of truth
		}
	});
}

/**
 * Called on layout mount when user is authenticated.
 * If localStorage has no session data, fetches from /api/session-sync
 * and hydrates localStorage so the user picks up where they left off.
 * Returns true if data was restored, false otherwise.
 */
export async function restoreSession(): Promise<boolean> {
	if (typeof window === 'undefined') return false;

	try {
		// Only restore if localStorage is genuinely empty
		const existingSession  = localStorage.getItem('re2_session');
		const existingLaunchpad = localStorage.getItem('re2_launchpad');

		const sessionEmpty  = !existingSession  || JSON.parse(existingSession).locationIQ == null;
		const launchpadEmpty = !existingLaunchpad || Object.keys(JSON.parse(existingLaunchpad)).length === 0;

		if (!sessionEmpty && !launchpadEmpty) return false; // already have data locally

		const res = await fetch('/api/session-sync', {
			method: 'GET',
			signal: AbortSignal.timeout(6_000),
		});

		if (!res.ok) return false;

		const { found, data, shortlistedLocations } = await res.json();
		if (!found || !data) return false;

		// Hydrate — only write keys that are missing locally
		if (data.session && sessionEmpty) {
			localStorage.setItem('re2_session', JSON.stringify(data.session));
		}
		if (data.launchpad && launchpadEmpty) {
			localStorage.setItem('re2_launchpad', JSON.stringify(data.launchpad));
		} else if (Array.isArray(shortlistedLocations) && shortlistedLocations.length > 0 && launchpadEmpty) {
			// M015: if old launchpad blob is missing but shortlisted_locations column has data, use it
			const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
			if (!lp.scoredLocations?.length) {
				lp.scoredLocations = shortlistedLocations;
				localStorage.setItem('re2_launchpad', JSON.stringify(lp));
			}
		}
		if (data.session?.locationIQ > 0) {
			// Restore journey flags so the nav unlocks correctly
			if (data.journeyState?.financialsVisited) {
				localStorage.setItem('re2_financials_visited', 'true');
			}
			if (data.journeyState?.modelVisited) {
				localStorage.setItem('re2_model_visited', 'true');
			}
		}

		// Notify the layout to re-read session state
		window.dispatchEvent(new CustomEvent('re2:session-updated'));
		window.dispatchEvent(new StorageEvent('storage', {
			key: 're2_session',
			newValue: localStorage.getItem('re2_session'),
		}));

		return true;
	} catch {
		return false;
	}
}
