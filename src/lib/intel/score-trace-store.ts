/**
 * Score Trace Store — V2 Score Debuggability
 * 
 * Three functions for client-side score trace management:
 * 
 * 1. storeScoreTrace() — auto-stores last 20 score traces in sessionStorage
 * 2. downloadScoreTrace() — downloads the current score as a JSON file
 * 3. getStoredTraces() — retrieves all stored traces (for DevTools inspection)
 * 
 * DE workflow:
 *   - User reports "score seems off" → support asks for the download
 *   - DE opens the JSON → goes straight to the numbered debug sections
 *   - Or: DevTools → Application → sessionStorage → re2_score_traces
 */

const STORAGE_KEY = 're2_score_traces';
const MAX_TRACES = 20;

export interface ScoreTraceEntry {
	timestamp: string;
	address?: string;
	lat: number;
	lng: number;
	businessType: string;
	locationIQ: number;
	grade: string;
	servingMode: string;
	traceId: string | null;
	engineVersion: string;
	sixIndex?: Record<string, unknown>;
	lenses?: unknown[];
	threeScores?: Record<string, unknown>;
	_debug?: Record<string, unknown> | null;
	confidence?: Record<string, unknown>;
	dataFreshness?: Record<string, unknown>;
	rawIntelErrors?: string[];
}

/**
 * Auto-stores a score trace in sessionStorage (rolling buffer of last 20).
 * Called after every location-iq GET response comes back.
 * 
 * Uses sessionStorage (not localStorage) because:
 * - Auto-clears when the tab closes — no PII lingering
 * - Sufficient for "I just saw a wrong score" reports (same session)
 * - No storage quota concerns (20 traces × ~5KB ≈ 100KB)
 */
export function storeScoreTrace(response: Record<string, unknown>): void {
	try {
		const trace: ScoreTraceEntry = {
			timestamp: new Date().toISOString(),
			address: (response.address as string) || undefined,
			lat: response.lat as number,
			lng: response.lng as number,
			businessType: (response.businessType as string) || 'unknown',
			locationIQ: (response.locationIQ as number) || 0,
			grade: (response.grade as string) || 'N/A',
			servingMode: (response._serving_mode as string) || 'unknown',
			traceId: (response._trace_id as string) || null,
			engineVersion: (response._engine_version as string) || 'unknown',
			sixIndex: response.sixIndex as Record<string, unknown> | undefined,
			lenses: response.lenses as unknown[] | undefined,
			threeScores: response.threeScores as Record<string, unknown> | undefined,
			_debug: (response._debug as Record<string, unknown>) || null,
			confidence: response.confidence as Record<string, unknown> | undefined,
			dataFreshness: response.dataFreshness as Record<string, unknown> | undefined,
			rawIntelErrors: response.rawIntelErrors as string[] | undefined,
		};

		const existing: ScoreTraceEntry[] = JSON.parse(
			sessionStorage.getItem(STORAGE_KEY) || '[]'
		);
		existing.unshift(trace); // newest first
		sessionStorage.setItem(
			STORAGE_KEY,
			JSON.stringify(existing.slice(0, MAX_TRACES))
		);
	} catch (err) {
		// Never throw — storage failure must not affect the user's experience
		console.warn('[ScoreTrace] Failed to store trace:', err);
	}
}

/**
 * Downloads the current score's full trace as a JSON file.
 * Called when the user clicks the download icon (↓) on the score card.
 * 
 * The downloaded file contains:
 * - _meta: export timestamp, app version, current URL
 * - All score data: locationIQ, grade, sixIndex, lenses, threeScores
 * - _debug envelope (when available) with full ①–⑥ audit trail
 * - Confidence and data freshness metadata
 */
export function downloadScoreTrace(scoreData: Record<string, unknown>): void {
	try {
		const trace = {
			_meta: {
				exported_at: new Date().toISOString(),
				export_format: 'score_trace_v2',
				url: typeof window !== 'undefined' ? window.location.href : 'server',
			},
			address: scoreData.address || scoreData.verdict || 'Unknown location',
			coordinates: {
				lat: scoreData.lat,
				lng: scoreData.lng,
			},
			businessType: scoreData.businessType,

			// The scores
			locationIQ: scoreData.locationIQ,
			grade: scoreData.grade,
			sixIndex: scoreData.sixIndex,
			lenses: scoreData.lenses,
			threeScores: scoreData.threeScores,

			// V2 transparency
			_serving_mode: scoreData._serving_mode || 'unknown',
			_trace_id: scoreData._trace_id || null,
			_engine_version: scoreData._engine_version || 'unknown',

			// Debug envelope (if available)
			_debug: scoreData._debug || {
				note: 'Debug data not available. Re-score with ?debug=true to get the full ①–⑥ audit trail.',
			},

			// Confidence & data quality
			confidence: scoreData.confidence,
			dataFreshness: scoreData.dataFreshness,
			rawIntelErrors: scoreData.rawIntelErrors,
		};

		// Generate descriptive filename
		const addressSlug =
			typeof scoreData.address === 'string'
				? scoreData.address.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)
				: 'location';
		const dateStr = new Date().toISOString().split('T')[0];
		const filename = `score_trace_${addressSlug}_${dateStr}.json`;

		const blob = new Blob([JSON.stringify(trace, null, 2)], {
			type: 'application/json',
		});
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	} catch (err) {
		console.error('[ScoreTrace] Failed to download trace:', err);
	}
}

/**
 * Retrieves all stored score traces from sessionStorage.
 * Useful for DevTools inspection or programmatic access.
 */
export function getStoredTraces(): ScoreTraceEntry[] {
	try {
		return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
	} catch {
		return [];
	}
}

/**
 * Clears all stored score traces from sessionStorage.
 */
export function clearStoredTraces(): void {
	try {
		sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
