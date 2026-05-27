/**
 * Simple in-memory rate limiter for API routes.
 *
 * Uses a sliding window counter per IP address.
 * On Netlify serverless, each function instance maintains
 * its own window — this is a best-effort limiter, not
 * a distributed one. Good enough for abuse prevention.
 *
 * Usage:
 *   import { rateLimit } from '$lib/rate-limit';
 *
 *   export const GET: RequestHandler = async ({ request }) => {
 *     const limited = rateLimit(request, { maxRequests: 30, windowMs: 60_000 });
 *     if (limited) return limited;
 *     // ... handle request
 *   };
 */

interface RateLimitEntry {
	count: number;
	windowStart: number;
}

interface RateLimitOptions {
	maxRequests: number;    // max requests per window
	windowMs: number;       // window duration in ms
}

const DEFAULT_OPTIONS: RateLimitOptions = {
	maxRequests: 60,        // 60 requests
	windowMs: 60 * 1000     // per minute
};

// Per-route buckets tracking specific window sizes
const buckets = new Map<string, { windowMs: number, entries: Map<string, RateLimitEntry> }>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number): void {
	for (const [route, bucketObj] of buckets) {
		for (const [ip, entry] of bucketObj.entries) {
			// Expire entries that are twice as old as the route's configured window
			if (now - entry.windowStart > bucketObj.windowMs * 2) {
				bucketObj.entries.delete(ip);
			}
		}
		if (bucketObj.entries.size === 0) buckets.delete(route);
	}
}

function getClientIP(request: Request): string {
	// Netlify/Cloudflare pass real IP in headers
	return (
		request.headers.get('x-nf-client-connection-ip') ||
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		request.headers.get('cf-connecting-ip') ||
		request.headers.get('x-real-ip') ||
		'unknown'
	);
}

/**
 * Check rate limit for a request.
 * Returns a 429 Response if rate limited, or null if allowed.
 */
export function rateLimit(
	request: Request,
	options: Partial<RateLimitOptions> = {},
	routeKey?: string
): Response | null {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const ip = getClientIP(request);
	const route = routeKey || new URL(request.url).pathname;
	const now = Date.now();

	// Periodic cleanup
	if (now - lastCleanup > CLEANUP_INTERVAL) {
		cleanup(now);
		lastCleanup = now;
	}

	// Get or create bucket for this route
	if (!buckets.has(route)) {
		buckets.set(route, { windowMs: opts.windowMs, entries: new Map() });
	} else {
		// Update windowMs if it changed due to config updates
		buckets.get(route)!.windowMs = opts.windowMs;
	}
	const routeBucket = buckets.get(route)!.entries;

	// Get or create entry for this IP
	const entry = routeBucket.get(ip);

	if (!entry || now - entry.windowStart > opts.windowMs) {
		// New window
		routeBucket.set(ip, { count: 1, windowStart: now });
		return null;
	}

	// Same window — increment
	entry.count++;

	if (entry.count > opts.maxRequests) {
		const retryAfter = Math.ceil((entry.windowStart + opts.windowMs - now) / 1000);
		return new Response(JSON.stringify({
			error: 'Too many requests',
			retryAfter
		}), {
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': String(retryAfter),
				'X-RateLimit-Limit': String(opts.maxRequests),
				'X-RateLimit-Remaining': '0',
				'X-RateLimit-Reset': String(Math.ceil((entry.windowStart + opts.windowMs) / 1000))
			}
		});
	}

	return null;
}

/**
 * Rate limit presets for different route types.
 *
 * All limits are env-overridable — set env vars to tune without a code deploy.
 * Env vars (integer = requests per minute):
 *   RATE_LIMIT_API    — public API routes        (default: 30/min)
 *   RATE_LIMIT_INTEL  — intel/scoring routes     (default: 10/min)
 *   RATE_LIMIT_AUTH   — auth routes              (default: 10/min)
 *   RATE_LIMIT_AI     — AI generation routes     (default:  5/min)
 *   RATE_LIMIT_EXPORT — export/PDF generation    (default:  5/min)
 *
 * Example: set RATE_LIMIT_INTEL=20 in Netlify env to double intel budget on Pro tier.
 */
function _envInt(key: string, fallback: number): number {
	const v = typeof process !== 'undefined' ? process.env?.[key] : undefined;
	const n = v ? parseInt(v, 10) : NaN;
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const RATE_LIMITS = {
	/** Public API routes: 30 req/min (override: RATE_LIMIT_API) */
	api:    { maxRequests: _envInt('RATE_LIMIT_API',    30), windowMs: 60_000 },
	/** Intel/scoring routes (expensive): 10 req/min (override: RATE_LIMIT_INTEL) */
	intel:  { maxRequests: _envInt('RATE_LIMIT_INTEL',  10), windowMs: 60_000 },
	/** Auth-related routes: 10 req/min (override: RATE_LIMIT_AUTH) */
	auth:   { maxRequests: _envInt('RATE_LIMIT_AUTH',   10), windowMs: 60_000 },
	/** AI generation routes: 5 req/min (override: RATE_LIMIT_AI) */
	ai:     { maxRequests: _envInt('RATE_LIMIT_AI',      5), windowMs: 60_000 },
	/** Export/PDF generation: 5 req/min (override: RATE_LIMIT_EXPORT) */
	export: { maxRequests: _envInt('RATE_LIMIT_EXPORT',  5), windowMs: 60_000 },
};
