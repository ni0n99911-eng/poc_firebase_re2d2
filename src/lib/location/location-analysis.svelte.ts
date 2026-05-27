/**
 * 04.19.2026 18:00 - Location Analysis State Manager
 * 
 * Extracts the massive UI state graph out of the location/+page.svelte God Component.
 * Acts as the centralized "Brain" for all modular UI subcomponents to communicate
 * without heavy prop-drilling or entangled templates.
 */

import { getContext, setContext } from 'svelte';
import type { DuplicateMatch } from '$lib/utils/duplicate-detection';

export interface CompetitorPin {
	name: string;
	lat: number;
	lng: number;
	dist?: number;
	type?: string;
}

export class LocationAnalysisStore {
	// ── Map & Context State ──
	mapLat = $state(40.7580);
	mapLng = $state(-73.9855);
	competitors = $state<CompetitorPin[]>([]);
	competitorScanStatus = $state<'pending' | 'complete' | 'failed'>('pending');
	mapRef = $state<any>(null);

	// ── Search & UX State ──
	handoffProgressIdx = $state(0);
	handoffTimedOut = $state(false);
	scoringFailed = $state(false);

	// ── Duplicate Analysis Guard ──
	duplicateFound = $state<DuplicateMatch | null>(null);
	pendingAnalysisAddress = $state('');
	pendingAnalysisConceptType = $state('');

	// ── Scoring Context ──
	fitSubScores = $state<Record<string, number>>({});
	fitComplete = $state(false);
	animateRings = $state(false);

	// ── UI Interactivity ──
	showAllHelping = $state(false);
	showAllHurting = $state(false);

	// ── Shortlist & Pinning ──
	isPinned = $state(false);
	pinJustSaved = $state(false);
	shortlistToastVisible = $state(false);

	// 04.19.2026 18:00 - Modular Helpers

	clearDuplicateGuard() {
		this.duplicateFound = null;
		this.pendingAnalysisAddress = '';
		this.pendingAnalysisConceptType = '';
	}
}

// 04.19.2026 18:00 - Svelte 5 Context Binding
const LOCATION_ANALYSIS_KEY = Symbol('LOCATION_ANALYSIS');

export function initLocationAnalysisStore() {
	const store = new LocationAnalysisStore();
	setContext(LOCATION_ANALYSIS_KEY, store);
	return store;
}

export function getLocationAnalysisStore(): LocationAnalysisStore {
	return getContext<LocationAnalysisStore>(LOCATION_ANALYSIS_KEY);
}
