/**
 * F-15: Standardized error response format across all API routes
 *
 * Every API route should return errors in a consistent shape so the
 * client can handle them uniformly. This module provides:
 *
 *   1. apiError() — creates a standard JSON error Response
 *   2. apiSuccess() — creates a standard JSON success Response
 *   3. withErrorHandler() — wraps a SvelteKit RequestHandler with try/catch
 *
 * Standard error shape:
 *   {
 *     ok: false,
 *     error: { code: string, message: string, detail?: string },
 *     timestamp: string
 *   }
 *
 * Standard success shape:
 *   {
 *     ok: true,
 *     data: T,
 *     timestamp: string
 *   }
 */

import { json, type RequestEvent } from '@sveltejs/kit';

// ─── Error codes ────────────────────────────────────────────────────

export const API_ERROR_CODES = {
	BAD_REQUEST:       'BAD_REQUEST',
	UNAUTHORIZED:      'UNAUTHORIZED',
	FORBIDDEN:         'FORBIDDEN',
	NOT_FOUND:         'NOT_FOUND',
	RATE_LIMITED:      'RATE_LIMITED',
	VALIDATION_ERROR:  'VALIDATION_ERROR',
	UPSTREAM_FAILURE:  'UPSTREAM_FAILURE',
	INTERNAL_ERROR:    'INTERNAL_ERROR',
	TIMEOUT:           'TIMEOUT',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

// ─── Response builders ──────────────────────────────────────────────

export interface ApiErrorBody {
	ok: false;
	error: {
		code: ApiErrorCode;
		message: string;
		detail?: string;
	};
	timestamp: string;
}

export interface ApiSuccessBody<T = unknown> {
	ok: true;
	data: T;
	timestamp: string;
}

const STATUS_MAP: Record<ApiErrorCode, number> = {
	BAD_REQUEST:      400,
	UNAUTHORIZED:     401,
	FORBIDDEN:        403,
	NOT_FOUND:        404,
	RATE_LIMITED:     429,
	VALIDATION_ERROR: 422,
	UPSTREAM_FAILURE: 502,
	INTERNAL_ERROR:   500,
	TIMEOUT:          504,
};

/**
 * Create a standardized error response.
 *
 * @example
 *   return apiError('BAD_REQUEST', 'Missing lat/lng parameters');
 *   return apiError('UPSTREAM_FAILURE', 'Google Places API unavailable', error.message);
 */
export function apiError(
	code: ApiErrorCode,
	message: string,
	detail?: string,
): Response {
	const body: ApiErrorBody = {
		ok: false,
		error: { code, message, ...(detail ? { detail } : {}) },
		timestamp: new Date().toISOString(),
	};

	return json(body, { status: STATUS_MAP[code] });
}

/**
 * Create a standardized success response.
 *
 * @example
 *   return apiSuccess({ score: 85, components: {...} });
 */
export function apiSuccess<T>(data: T, status: number = 200): Response {
	const body: ApiSuccessBody<T> = {
		ok: true,
		data,
		timestamp: new Date().toISOString(),
	};

	return json(body, { status });
}

/**
 * Wrap a SvelteKit request handler with standardized error handling.
 * Catches thrown errors and converts them to apiError responses.
 *
 * @example
 *   export const GET = withErrorHandler(async (event) => {
 *     const lat = parseFloat(event.url.searchParams.get('lat') || '');
 *     if (isNaN(lat)) return apiError('BAD_REQUEST', 'Invalid lat parameter');
 *     // ... compute result ...
 *     return apiSuccess(result);
 *   });
 */
export function withErrorHandler(
	handler: (event: RequestEvent) => Promise<Response>
): (event: RequestEvent) => Promise<Response> {
	return async (event: RequestEvent) => {
		try {
			return await handler(event);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			const stack = err instanceof Error ? err.stack : undefined;

			// Log server-side for debugging
			console.error(
				`[API Error] ${event.request.method} ${event.url.pathname}:`,
				message,
				stack ? `\n${stack}` : ''
			);

			// Check for timeout-like errors
			if (message.includes('timeout') || message.includes('ETIMEDOUT') || message.includes('AbortError')) {
				return apiError('TIMEOUT', 'Request timed out', message);
			}

			// Check for upstream failures
			if (message.includes('ECONNREFUSED') || message.includes('fetch failed') || message.includes('ENOTFOUND')) {
				return apiError('UPSTREAM_FAILURE', 'External service unavailable', message);
			}

			return apiError('INTERNAL_ERROR', 'An unexpected error occurred', message);
		}
	};
}
