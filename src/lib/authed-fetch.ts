/**
 * Authenticated fetch wrapper for client-side API calls.
 *
 * Combines three fixes for Clerk JWT expiration (~60s):
 *
 * 1. Proactive: Calls Clerk.session.getToken({ skipCache: true }) BEFORE each
 *    request — forces Clerk to return a fresh token, never a stale cached one.
 *
 * 2. Reactive: On 401 response, refreshes the session and retries once.
 *    Uses Clerk JS if available, otherwise triggers FAPI cookie refresh.
 *
 * 3. Background keepalive: startTokenKeepAlive() runs every 45s to pre-warm
 *    the token so it's never expired when a user action fires a request.
 *    Call this from the root layout's onMount and clear on onDestroy.
 *
 * 4. Resilient: Includes timeout and network error retry.
 *
 * Drop-in replacement for fetch() on all client-side /api/* calls.
 */

declare global {
	interface Window {
		Clerk?: {
			session?: {
				getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>;
			};
		};
	}
}

const MAX_RETRIES = 1;
const DEFAULT_TIMEOUT = 25000;
const KEEPALIVE_INTERVAL_MS = 45_000; // refresh 15s before typical 60s expiry

/**
 * Get a fresh Clerk session token.
 * skipCache: true forces Clerk to call FAPI — never returns a stale cached JWT.
 * Returns null if Clerk isn't initialized (public routes, dev mode).
 */
async function getFreshToken(): Promise<string | null> {
	try {
		if (typeof window !== 'undefined' && window.Clerk?.session) {
			return await window.Clerk.session.getToken({ skipCache: true });
		}
	} catch (err) {
		console.warn('[authedFetch] Could not get Clerk token:', err);
	}
	return null;
}

/**
 * Attempt to refresh the Clerk session cookie.
 */
async function refreshSession(): Promise<boolean> {
	try {
		// Strategy 1: Clerk JS — force a fresh token to refresh cookie
		if (typeof window !== 'undefined' && window.Clerk?.session) {
			const token = await window.Clerk.session.getToken({ skipCache: true });
			return !!token;
		}

		// Strategy 2: Lightweight page fetch to trigger FAPI cookie refresh
		const res = await fetch('/', {
			method: 'HEAD',
			credentials: 'same-origin',
			cache: 'no-cache'
		});
		return res.ok;
	} catch {
		return false;
	}
}

/**
 * Start a background interval that keeps the Clerk session token alive.
 * Fires every 45s — call this from the root layout onMount.
 * Returns a cleanup function to clear the interval (call from onDestroy).
 *
 * Usage in +layout.svelte:
 *   import { startTokenKeepAlive } from '$lib/authed-fetch';
 *   let stopKeepAlive: () => void;
 *   onMount(() => { stopKeepAlive = startTokenKeepAlive(); });
 *   onDestroy(() => stopKeepAlive?.());
 */
export function startTokenKeepAlive(): () => void {
	if (typeof window === 'undefined') return () => {};

	const interval = setInterval(async () => {
		try {
			if (window.Clerk?.session) {
				await window.Clerk.session.getToken({ skipCache: true });
			}
		} catch {
			// Session gone — user logged out, don't spam console
		}
	}, KEEPALIVE_INTERVAL_MS);

	return () => clearInterval(interval);
}

/**
 * Authenticated fetch with Clerk token injection and 401 retry.
 *
 * Usage:
 *   import { authedFetch } from '$lib/authed-fetch';
 *   const res = await authedFetch('/api/location-intel?lat=40.7&lng=-74.0');
 */
export async function authedFetch(
	url: string,
	init?: RequestInit & { timeout?: number }
): Promise<Response> {
	const timeout = init?.timeout ?? DEFAULT_TIMEOUT;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);

		try {
			// Inject fresh Bearer token (skipCache: true — never use stale JWT)
			const token = await getFreshToken();
			const headers = new Headers(init?.headers);
			if (token) {
				headers.set('Authorization', `Bearer ${token}`);
			}
			// Ensure JSON content-type for POST requests that need it
			if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
				headers.set('Content-Type', 'application/json');
			}

			const res = await fetch(url, {
				...init,
				headers,
				signal: controller.signal
			});
			clearTimeout(timer);

			// 401 → refresh session and retry once
			if (res.status === 401 && attempt < MAX_RETRIES) {
				console.warn('[authedFetch] Got 401, refreshing session...');
				const refreshed = await refreshSession();
				if (refreshed) continue;
				return res; // can't refresh — return 401
			}

			return res;
		} catch (err) {
			clearTimeout(timer);

			if (err instanceof DOMException && err.name === 'AbortError') {
				throw new Error(`Request timed out (${timeout / 1000}s)`);
			}

			// Network error — retry once
			if (attempt < MAX_RETRIES) {
				await new Promise(r => setTimeout(r, 500));
				continue;
			}
			throw err;
		}
	}

	throw new Error('Unexpected: all retries exhausted');
}
