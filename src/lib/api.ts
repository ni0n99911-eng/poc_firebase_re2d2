/**
 * Client-side API wrapper with automatic session refresh on 401.
 *
 * Problem: Clerk JWT expires every ~60s. The server hook has a 30-minute
 * user cache that handles MOST cases, but on cold starts (new function
 * instance) there's no cache → 401. The client currently doesn't retry.
 *
 * Solution: This wrapper detects 401, forces a Clerk session refresh,
 * and retries the request once. If Clerk JS isn't loaded (most pages),
 * it triggers a soft page reload to refresh the cookie via FAPI.
 */

const MAX_RETRIES = 1;

/**
 * Fetch wrapper that handles 401 by refreshing the Clerk session.
 * Drop-in replacement for `fetch()` on authenticated API routes.
 */
export async function apiFetch(
	url: string,
	options?: RequestInit & { timeout?: number }
): Promise<Response> {
	const timeout = options?.timeout ?? 25000;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);

		try {
			const res = await fetch(url, {
				...options,
				signal: controller.signal
			});
			clearTimeout(timer);

			if (res.status === 401 && attempt < MAX_RETRIES) {
				// Try to refresh the session before retrying
				const refreshed = await refreshSession();
				if (refreshed) continue; // Retry with fresh cookie
				// Couldn't refresh — return the 401 as-is
				return res;
			}

			return res;
		} catch (err) {
			clearTimeout(timer);

			if (err instanceof DOMException && err.name === 'AbortError') {
				throw new Error(`Request timed out (${timeout / 1000}s)`);
			}

			// Network error — retry once if we haven't already
			if (attempt < MAX_RETRIES) {
				await sleep(500);
				continue;
			}
			throw err;
		}
	}

	// Should never reach here, but TypeScript needs it
	throw new Error('Unexpected: all retries exhausted');
}

/**
 * Attempt to refresh the Clerk session cookie.
 *
 * Strategy:
 * 1. If Clerk JS is loaded (sign-in page, or if we add it globally later),
 *    call getToken() to get a fresh JWT and let Clerk update the cookie.
 * 2. Otherwise, fetch the current page URL to trigger a server-side
 *    session refresh via FAPI (Clerk's Frontend API sets __session on SSR).
 */
async function refreshSession(): Promise<boolean> {
	try {
		// Strategy 1: Clerk JS is available
		if (typeof window !== 'undefined' && window.Clerk?.session) {
			const token = await (window.Clerk.session as any).getToken();
			if (token) {
				// Clerk automatically updates the __session cookie when getToken() is called
				return true;
			}
		}

		// Strategy 2: Do a lightweight fetch to trigger cookie refresh.
		// The server hook will set a fresh __session cookie on the response
		// if the Clerk FAPI can issue one.
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

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
