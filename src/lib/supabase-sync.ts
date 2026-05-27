/**
 * ═══════════════════════════════════════════════════════
 * RE² Supabase Sync — Client-Side L2 Persistence Helper
 * ═══════════════════════════════════════════════════════
 *
 * Provides fire-and-forget write-through from localStorage (L1)
 * to Supabase (L2) via the /api/session-sync server endpoint.
 *
 * Also provides hydration: if localStorage is empty (new device,
 * cleared cache, incognito), pulls from Supabase L2.
 *
 * Pattern:
 *   saveChatStore(data)  → localStorage.setItem(...)  → syncChatToSupabase(data)
 *   loadChatStore()      → localStorage.getItem(...)  || hydrateFromSupabase()
 */

// ── Debounce tracking ──
let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingPayload: Record<string, unknown> = {};
const DEBOUNCE_MS = 1500; // Wait 1.5s after last change before syncing

/**
 * Fire-and-forget sync to Supabase via server API.
 * Debounces rapid successive saves (e.g. during chat).
 */
export function syncToSupabase(payload: {
	chatStore?: unknown;
	session?: unknown;
	launchpad?: unknown;
}): void {
	if (typeof window === 'undefined') return;

	// Merge with pending payload (in case multiple store types save rapidly)
	_pendingPayload = { ..._pendingPayload, ...payload };

	// Clear existing timer
	if (_syncTimer) clearTimeout(_syncTimer);

	// Debounce: wait for activity to settle
	_syncTimer = setTimeout(() => {
		const toSend = { ..._pendingPayload };
		_pendingPayload = {};

		fetch('/api/session-sync', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(toSend)
		}).catch((err) => {
			console.debug('[supabase-sync] Write-through failed (non-blocking):', err);
		});
	}, DEBOUNCE_MS);
}

/**
 * Load all user data from Supabase L2.
 * Call this when localStorage is empty and user is authenticated.
 * Returns null if no data found (new user).
 */
export async function loadFromSupabase(): Promise<{
	chatStore: unknown | null;
	session: unknown | null;
	launchpad: unknown | null;
} | null> {
	if (typeof window === 'undefined') return null;

	try {
		const response = await fetch('/api/session-sync');
		if (!response.ok) return null;

		const result = await response.json();
		if (!result.found || !result.data) return null;

		return {
			chatStore: result.data.chatStore || null,
			session: result.data.session || null,
			launchpad: result.data.launchpad || null
		};
	} catch (err) {
		console.debug('[supabase-sync] L2 load failed (non-blocking):', err);
		return null;
	}
}

/**
 * Check if the current user has existing session data in Supabase.
 * Used for new-vs-returning user detection at login time.
 * Returns { isReturning: boolean, data: ... }
 */
export async function checkUserHasData(): Promise<{
	isReturning: boolean;
	hasChat: boolean;
	hasSession: boolean;
	hasLaunchpad: boolean;
	personaType: string | null;
	conceptDescription: string | null;
}> {
	try {
		const result = await loadFromSupabase();
		if (!result) {
			return {
				isReturning: false,
				hasChat: false,
				hasSession: false,
				hasLaunchpad: false,
				personaType: null,
				conceptDescription: null
			};
		}

		const session = result.session as Record<string, unknown> | null;
		const chatStore = result.chatStore as Record<string, unknown> | null;

		return {
			isReturning: !!(result.chatStore || result.session || result.launchpad),
			hasChat: !!result.chatStore,
			hasSession: !!result.session,
			hasLaunchpad: !!result.launchpad,
			personaType: (session?.personaType as string) || (chatStore?.extractedData as any)?.personaType || null,
			conceptDescription: (session?.conceptDescription as string) || (chatStore?.extractedData as any)?.conceptDescription || null
		};
	} catch {
		return {
			isReturning: false,
			hasChat: false,
			hasSession: false,
			hasLaunchpad: false,
			personaType: null,
			conceptDescription: null
		};
	}
}
