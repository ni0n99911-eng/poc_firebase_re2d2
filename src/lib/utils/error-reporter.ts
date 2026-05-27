/**
 * F-14: Global error boundary — client-side error reporter
 *
 * Captures unhandled runtime errors and sends them to /api/request-failures
 * for server-side logging. Used by the global error handlers in app.html
 * and can be imported by components for explicit error reporting.
 *
 * Rate-limited to prevent flood from error loops.
 */

const REPORT_INTERVAL_MS = 5_000;      // Max 1 report per 5 seconds
const MAX_REPORTS_PER_SESSION = 20;     // Cap to prevent runaway logging

let lastReportTime = 0;
let sessionReportCount = 0;

export interface ErrorReport {
	type: 'unhandled' | 'unhandledrejection' | 'component' | 'api';
	message: string;
	stack?: string;
	url?: string;
	line?: number;
	col?: number;
	timestamp: string;
	userAgent: string;
	route: string;
}

/**
 * Report an error to the server-side logging endpoint.
 * Rate-limited — drops reports if called too frequently.
 */
export async function reportError(report: Omit<ErrorReport, 'timestamp' | 'userAgent' | 'route'>): Promise<void> {
	if (typeof window === 'undefined') return;
	if (sessionReportCount >= MAX_REPORTS_PER_SESSION) return;

	const now = Date.now();
	if (now - lastReportTime < REPORT_INTERVAL_MS) return;

	lastReportTime = now;
	sessionReportCount++;

	const fullReport: ErrorReport = {
		...report,
		timestamp: new Date().toISOString(),
		userAgent: navigator.userAgent,
		route: window.location.pathname,
	};

	try {
		// Fire-and-forget — don't block the UI on error reporting
		fetch('/api/request-failures', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ source: 'error-boundary', ...fullReport }),
		}).catch(() => { /* reporting failure is not critical */ });
	} catch {
		// Swallow — never let error reporting cause more errors
	}
}

/**
 * Extract a clean error report from various error shapes.
 */
export function normalizeError(error: unknown): { message: string; stack?: string } {
	if (error instanceof Error) {
		return { message: error.message, stack: error.stack };
	}
	if (typeof error === 'string') {
		return { message: error };
	}
	try {
		return { message: JSON.stringify(error) };
	} catch {
		return { message: 'Unknown error' };
	}
}
