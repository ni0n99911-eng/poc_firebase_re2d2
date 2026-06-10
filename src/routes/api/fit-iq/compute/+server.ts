/**
 * Fit IQ API — Thread 6B
 *
 * POST /api/fit-iq/compute
 *
 * Computes Fit IQ (how well a location matches THIS specific business
 * concept + THIS specific founder) from the launchpad profile + block group data.
 *
 * This is deterministic — no LLM. Pure math on real data.
 *
 * M1 FIX: Now uses fit_iq_cache table to avoid recomputing for the same
 * user + geoid + business type + launchpad inputs.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/auth-middleware';
import { computeFitIQ, type LaunchpadProfile } from '$lib/fit-iq-engine';
import { db } from '$lib/db-server';
import * as schema from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface FitIQRequest {
	geoid: string;
	launchpad: LaunchpadProfile;
	legacyFitIq?: number;
}

// ── Launchpad hash — detect when user answers change ──

function hashLaunchpad(launchpad: LaunchpadProfile): string {
	// Deterministic JSON string of sorted keys → simple hash
	const sorted = JSON.stringify(launchpad, Object.keys(launchpad).sort());
	let hash = 0;
	for (let i = 0; i < sorted.length; i++) {
		const char = sorted.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash |= 0; // Convert to 32-bit integer
	}
	return hash.toString(36);
}

// ── Cache helpers ──

async function getCachedFitIQ(
	userId: string,
	geoid: string,
	businessType: string,
	launchpadHash: string
): Promise<any | null> {
	try {
		const cachedRows = await db
			.select()
			.from(schema.fitIqCache)
			.where(
				and(
					eq(schema.fitIqCache.userId, userId),
					eq(schema.fitIqCache.geoid, geoid)
				)
			);

		const validRow = cachedRows.find(row => {
			const d = row.data as any || {};
			if (d.business_type !== businessType) return false;
			if (d.launchpad_hash !== launchpadHash) return false;
			if (d.expires_at && new Date(d.expires_at).getTime() < Date.now()) return false;
			return true;
		});

		if (!validRow) return null;
		const dData = validRow.data as any;

		return {
			fitIQ: validRow.score,
			grade: dData.grade,
			dimensions: dData.dimensions,
			archetype: dData.archetype,
			archetypeScore: dData.archetype_score,
			alignment: dData.alignment,
			_cached: true,
		};
	} catch (err) {
		console.warn('[FitIQ] Cache read failed (non-blocking):', err instanceof Error ? err.message : err);
		return null;
	}
}

async function cacheFitIQResult(
	userId: string,
	geoid: string,
	businessType: string,
	launchpadHash: string,
	result: any
): Promise<void> {
	try {
		const id = `${userId}_${geoid}_${businessType}`;
		await db.insert(schema.fitIqCache).values({
			id,
			userId,
			geoid,
			score: result.fitIQ,
			data: {
				business_type: businessType,
				grade: result.grade,
				dimensions: result.dimensions,
				archetype: result.archetype || null,
				archetype_score: result.archetypeScore || null,
				alignment: result.alignment || null,
				launchpad_hash: launchpadHash,
				computed_at: new Date().toISOString(),
				expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			}
		}).onConflictDoUpdate({
			target: schema.fitIqCache.id,
			set: {
				score: result.fitIQ,
				data: {
					business_type: businessType,
					grade: result.grade,
					dimensions: result.dimensions,
					archetype: result.archetype || null,
					archetype_score: result.archetypeScore || null,
					alignment: result.alignment || null,
					launchpad_hash: launchpadHash,
					computed_at: new Date().toISOString(),
					expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
				}
			}
		});
	} catch (err) {
		// Non-critical — don't fail the request
		console.warn('[FitIQ] Cache write failed (non-blocking):', err instanceof Error ? err.message : err);
	}
}

// ── Handler ──

export const POST: RequestHandler = async ({ request }) => {
	// ── Auth ──
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;

	try {
		const body = (await request.json()) as FitIQRequest;

		// ── Validation ──
		if (!body.geoid || typeof body.geoid !== 'string') {
			return new Response(JSON.stringify({
				error: 'Missing or invalid geoid',
				usage: 'POST /api/fit-iq/compute with { geoid: "360610076001", launchpad: { businessType: "coffee", ... } }',
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		if (!body.launchpad?.businessType) {
			return new Response(JSON.stringify({
				error: 'Missing launchpad.businessType — at minimum, we need to know what kind of business',
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		const startMs = Date.now();
		const launchpadHash = hashLaunchpad(body.launchpad);

		// ── Check cache first (M1 fix) ──
		const cached = await getCachedFitIQ(auth.userId, body.geoid, body.launchpad.businessType, launchpadHash);
		if (cached) {
			return new Response(JSON.stringify({
				...cached,
				_meta: {
					geoid: body.geoid,
					businessType: body.launchpad.businessType,
					userId: auth.userId,
					durationMs: Date.now() - startMs,
					cached: true,
				},
			}), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'private, max-age=300',
				},
			});
		}

		// ── Compute fresh ──
		const result = await computeFitIQ(body.geoid, body.launchpad);
		const durationMs = Date.now() - startMs;

		// ── Write to cache (fire-and-forget) ──
		cacheFitIQResult(auth.userId, body.geoid, body.launchpad.businessType, launchpadHash, result);

		// ── Shadow Mode Logging (fire-and-forget) ──
		if (body.legacyFitIq !== undefined) {
			db.insert(schema.fitIqShadowLog).values({
				id: crypto.randomUUID(),
				geoid: body.geoid,
				logData: {
					user_id: auth.userId,
					concept: body.launchpad.businessType,
					legacy_score: body.legacyFitIq,
					shadow_score: result.fitIQ,
					discrepancy: Math.abs(body.legacyFitIq - result.fitIQ),
					input_snapshot: body.launchpad
				}
			}).catch(err => {
				console.warn('[FitIQ] Shadow log write failed:', err);
			});
		}

		return new Response(JSON.stringify({
			...result,
			_meta: {
				geoid: body.geoid,
				businessType: body.launchpad.businessType,
				userId: auth.userId,
				durationMs,
				cached: false,
			},
		}), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'private, max-age=300', // 5 min browser cache
			},
		});
	} catch (err) {
		console.error('[FitIQ] Compute error:', err);
		return new Response(JSON.stringify({
			error: 'Failed to compute Fit IQ',
			message: err instanceof Error ? err.message : 'Unknown error',
		}), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
};
