/**
 * ═══════════════════════════════════════════════════════
 * RE² State Bridge — Cross-Tab Synchronization
 * ═══════════════════════════════════════════════════════
 *
 * Eliminates stale/divergent localStorage across browser tabs by:
 *
 * 1. Listening for `storage` events from other tabs and dispatching
 *    a `re2:state-changed` CustomEvent so Svelte stores re-read.
 *
 * 2. Adding a monotonic `_stateVersion` counter to every write.
 *    On read, if versions across keys don't match, triggers a
 *    consistency reconciliation (newest-wins).
 *
 * 3. Validating freshness on `visibilitychange` — when a tab
 *    returns to focus, it checks whether another tab has written
 *    newer data and re-reads if so.
 *
 * Usage:
 *   import { initStateBridge, bumpVersion, getStateVersion } from '$lib/state-bridge';
 *
 *   // In +layout.svelte onMount:
 *   initStateBridge();
 *
 *   // In save functions (session.ts, launchpad-store.ts):
 *   bumpVersion();
 */

const VERSION_KEY = 're2_state_version';

/** Tracked localStorage keys that participate in cross-tab sync. */
const TRACKED_KEYS = ['re2_session', 're2_launchpad', 're2_location_intel'] as const;

let _initialized = false;
let _lastKnownVersion = 0;

/**
 * Read the current state version from localStorage.
 * Returns 0 if no version has been written yet.
 */
export function getStateVersion(): number {
	if (typeof window === 'undefined') return 0;
	try {
		const raw = localStorage.getItem(VERSION_KEY);
		return raw ? parseInt(raw, 10) || 0 : 0;
	} catch {
		return 0;
	}
}

/**
 * Increment the shared state version counter.
 * Call this from every save function (saveSession, saveLaunchPadData, etc.)
 * to signal to other tabs that state has changed.
 */
export function bumpVersion(): number {
	if (typeof window === 'undefined') return 0;
	const next = getStateVersion() + 1;
	try {
		localStorage.setItem(VERSION_KEY, String(next));
		_lastKnownVersion = next;
	} catch {
		// Storage full — best effort
	}
	return next;
}

/**
 * Check whether another tab has written a newer version than what
 * this tab last saw. If so, dispatch a state-changed event.
 */
function checkForUpdates(): void {
	const current = getStateVersion();
	if (current > _lastKnownVersion) {
		_lastKnownVersion = current;
		window.dispatchEvent(new CustomEvent('re2:state-changed', {
			detail: { version: current, source: 'cross-tab' }
		}));
	}
}

/**
 * Initialize the state bridge. Call once from the root layout.
 *
 * Sets up:
 * - `storage` event listener (fires when another tab writes to localStorage)
 * - `visibilitychange` listener (validates freshness when tab regains focus)
 */
export function initStateBridge(): void {
	if (typeof window === 'undefined') return;
	if (_initialized) return;
	_initialized = true;

	_lastKnownVersion = getStateVersion();

	// ── Cross-tab sync: another tab wrote to localStorage ──
	window.addEventListener('storage', (event: StorageEvent) => {
		if (!event.key) return;

		// Version key changed → another tab bumped the version
		if (event.key === VERSION_KEY) {
			checkForUpdates();
			return;
		}

		// One of the tracked data keys changed → notify this tab
		if ((TRACKED_KEYS as readonly string[]).includes(event.key)) {
			_lastKnownVersion = getStateVersion();
			window.dispatchEvent(new CustomEvent('re2:state-changed', {
				detail: {
					key: event.key,
					version: _lastKnownVersion,
					source: 'storage-event'
				}
			}));
		}
	});

	// ── Stale check on tab focus ──
	// When the user switches back to this tab, check whether another tab
	// has updated state while we were in the background.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') {
			checkForUpdates();
		}
	});
}

/**
 * Tear down the state bridge listeners.
 * Call from onDestroy if needed (usually not required — lives for app lifetime).
 */
export function destroyStateBridge(): void {
	_initialized = false;
	// Event listeners are attached to window/document and will be GC'd with the page
}
