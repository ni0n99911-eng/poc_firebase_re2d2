/**
 * RE² Analytics — lightweight event tracking.
 *
 * Privacy-first: no cookies, no personal data collection.
 * Currently logs to console in dev and emits custom events.
 * Designed to plug into Plausible, Fathom, or any provider.
 *
 * Usage:
 *   import { track } from '$lib/analytics';
 *   track('search_address', { businessType: 'cafe' });
 */

import { browser } from '$app/environment';

interface TrackEvent {
	name: string;
	properties?: Record<string, string | number | boolean>;
	timestamp: number;
}

/**
 * Track a user event.
 * Currently stores in memory and logs to console in dev.
 * Will forward to analytics provider when configured.
 */
export function track(
	eventName: string,
	properties?: Record<string, string | number | boolean>
): void {
	if (!browser) return;

	const event: TrackEvent = {
		name: eventName,
		properties,
		timestamp: Date.now()
	};

	// Store in session buffer for batch sending
	if (!window.__re2_events) {
		window.__re2_events = [];
	}
	window.__re2_events.push(event);

	// Cap buffer at 100 events
	if (window.__re2_events.length > 100) {
		window.__re2_events.shift();
	}

	// Log in development
	if (import.meta.env.DEV) {
		console.log(`[Analytics] ${eventName}`, properties || '');
	}

	// Emit custom DOM event for any listener
	if (typeof CustomEvent !== 'undefined') {
		window.dispatchEvent(new CustomEvent('re2:track', { detail: event }));
	}
}

/**
 * Track a page view.
 */
export function trackPageView(path?: string): void {
	track('page_view', {
		path: path || (browser ? window.location.pathname : '/'),
		referrer: browser ? document.referrer : ''
	});
}

// Predefined event names for type safety
export const EVENTS = {
	// Landing page
	LANDING_VIEW: 'landing_view',
	LANDING_CTA_CLICK: 'landing_cta_click',
	VIDEO_PLAY: 'video_play',

	// Auth
	LOGIN_START: 'login_start',
	LOGIN_SUCCESS: 'login_success',

	// Location analysis
	SEARCH_ADDRESS: 'search_address',
	LOCATION_IQ_VIEW: 'location_iq_view',
	COMPARE_START: 'compare_start',

	// Vision / Launch Pad
	VISION_START: 'vision_start',
	VISION_COMPLETE: 'vision_complete',

	// Export
	EXPORT_PDF: 'export_pdf',
	EXPORT_PLAN: 'export_plan',

	// Pricing
	PRICING_VIEW: 'pricing_view',
	PRICING_CTA_CLICK: 'pricing_cta_click'
} as const;

// Type augmentation for the global window
declare global {
	interface Window {
		__re2_events?: TrackEvent[];
	}
}
