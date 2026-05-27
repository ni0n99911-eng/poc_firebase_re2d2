/**
 * Profile Sync — writes completed onboarding data to client_profiles.
 *
 * Called fire-and-forget from handoff() in onboarding/+page.svelte
 * after the user finishes the onboarding flow. Silently fails if auth
 * or network is unavailable — the launchpad data is already persisted.
 */

import { loadLaunchPadData } from './launchpad-store';

/**
 * Sync the current launchpad state to client_profiles in Supabase.
 * Only fires if there's meaningful data (businessType or businessName set).
 * Auth token is sent via the __session cookie automatically.
 */
export async function syncProfile(): Promise<void> {
	const data = loadLaunchPadData();

	// Don't bother if user never got past the first question
	if (!data.businessType && !data.businessName) return;

	const res = await fetch('/api/profile-sync', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: 'unknown' }));
		console.debug('[profile-sync] failed:', err);
	}
}
