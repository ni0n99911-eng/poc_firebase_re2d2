/**
 * Outcome Tracking API
 *
 * POST /api/outcomes           — Save a scored location OR submit an outcome
 * GET  /api/outcomes           — List user's scored locations + outcomes
 * GET  /api/outcomes?id=<uuid> — Get a single scored location with its outcomes
 *
 * Body shapes:
 *   { action: 'save_location', ... }  → insert into scored_locations + schedule check-ins
 *   { action: 'submit_outcome', ... } → insert into outcomes
 */

import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
import { rateLimit } from '$lib/rate-limit';
import { scheduleCheckIns } from '$lib/outcome-checkins';

const RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 };

// ─────────────────────────────────────────────────
// GET — List scored locations (with latest outcome)
// ─────────────────────────────────────────────────
export const GET: RequestHandler = async ({ request, url, locals }) => {
	const limited = rateLimit(request, RATE_LIMIT);
	if (limited) return limited;

	const userId = (locals as Record<string, unknown>).user
		? ((locals as Record<string, unknown>).user as { id: string }).id
		: null;
	if (!userId) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const singleId = url.searchParams.get('id');

	try {
		if (singleId) {
			// Single location with all outcomes
			const locRes = await db.execute(sql`SELECT * FROM scored_locations WHERE id = ${singleId} AND user_id = ${userId} LIMIT 1`);
			const location = locRes.rows[0];

			if (!location) {
				return new Response(JSON.stringify({ error: 'Location not found' }), { status: 404 });
			}

			const outRes = await db.execute(sql`SELECT * FROM outcomes WHERE scored_location_id = ${singleId} ORDER BY check_in_number ASC`);
			const outcomes = outRes.rows;

			return new Response(JSON.stringify({ location, outcomes: outcomes || [] }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// List all scored locations for this user
		let locations = [];
		try {
			const listRes = await db.execute(sql`SELECT * FROM scored_locations WHERE user_id = ${userId} ORDER BY scored_at DESC LIMIT 50`);
			locations = listRes.rows;
		} catch (listErr) {
			console.error('[OUTCOMES] List error:', listErr);
			return new Response(JSON.stringify({ error: 'Failed to fetch locations' }), { status: 500 });
		}

		// Get latest outcome for each location
		const locationIds = locations.map(l => l.id);
		let outcomesMap: Record<string, any> = {};

		if (locationIds.length > 0) {
			const inClause = locationIds.map(id => `'${id}'`).join(',');
			const outRes = await db.execute(sql.raw(`SELECT * FROM outcomes WHERE scored_location_id IN (${inClause}) ORDER BY check_in_number DESC`));
			const outcomes = outRes.rows;

			// Group by location, keep latest
			for (const o of outcomes) {
				if (!outcomesMap[o.scored_location_id as string]) {
					outcomesMap[o.scored_location_id as string] = o;
				}
			}
		}

		const enriched = locations.map(loc => ({
			...loc,
			latestOutcome: outcomesMap[loc.id as string] || null
		}));

		return new Response(JSON.stringify({ locations: enriched }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('[OUTCOMES] GET error:', err);
		return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
	}
};

// ─────────────────────────────────────────────────
// POST — Save scored location or submit outcome
// ─────────────────────────────────────────────────
export const POST: RequestHandler = async ({ request, locals }) => {
	const limited = rateLimit(request, RATE_LIMIT);
	if (limited) return limited;

	const userId = (locals as Record<string, unknown>).user
		? ((locals as Record<string, unknown>).user as { id: string; email?: string; name?: string }).id
		: null;
	if (!userId) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const user = (locals as Record<string, unknown>).user as { id: string; email?: string; name?: string };

	try {
		const body = await request.json();
		const { action } = body;

		if (action === 'save_location') {
			return await handleSaveLocation(user, body);
		} else if (action === 'submit_outcome') {
			return await handleSubmitOutcome(user, body);
		} else {
			return new Response(
				JSON.stringify({ error: 'Invalid action. Use "save_location" or "submit_outcome".' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}
	} catch (err) {
		console.error('[OUTCOMES] POST error:', err);
		return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
	}
};

// ─────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────

async function handleSaveLocation(
	user: { id: string; email?: string; name?: string },
	body: Record<string, any>
) {
	const {
		address, lat, lng, businessType, conceptType,
		locationIQ, niq, siq, tiq, liq, grade, confidence,
		transitScore, demographicsScore, competitionScore,
		vibrancyScore, safetyScore, momentumScore,
		dataSourcesAvailable, dataSourcesTotal, signals
	} = body;

	if (!address || lat == null || lng == null || locationIQ == null) {
		return new Response(
			JSON.stringify({ error: 'Required: address, lat, lng, locationIQ' }),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	let data: any = null;
	try {
		const res = await db.execute(sql`
			INSERT INTO scored_locations (
				user_id, address, lat, lng, business_type, concept_type, 
				location_iq, niq, siq, tiq, liq, grade, confidence, 
				transit_score, demographics_score, competition_score, 
				vibrancy_score, safety_score, momentum_score, 
				data_sources_available, data_sources_total, signals
			) VALUES (
				${user.id}, ${address}, ${lat}, ${lng}, ${businessType || 'cafe'}, ${conceptType || null},
				${locationIQ}, ${niq ?? null}, ${siq ?? null}, ${tiq ?? null}, ${liq ?? null}, ${grade ?? null}, ${confidence ?? null},
				${transitScore ?? null}, ${demographicsScore ?? null}, ${competitionScore ?? null},
				${vibrancyScore ?? null}, ${safetyScore ?? null}, ${momentumScore ?? null},
				${dataSourcesAvailable ?? null}, ${dataSourcesTotal ?? null}, ${JSON.stringify(signals ?? [])}
			) RETURNING *
		`);
		data = res.rows[0];
	} catch (error) {
		console.error('[OUTCOMES] Save location error:', error);
		return new Response(JSON.stringify({ error: 'Failed to save location' }), { status: 500 });
	}

	// Schedule check-in emails (fire and forget)
	if (user.email && data?.id) {
		scheduleCheckIns({
			scoredLocationId: data.id as string,
			userId: user.id,
			userEmail: user.email,
			userName: user.name || 'there'
		}).catch(err => console.error('[OUTCOMES] Schedule check-ins error:', err));
	}

	return new Response(JSON.stringify({ location: data }), {
		status: 201,
		headers: { 'Content-Type': 'application/json' }
	});
}

async function handleSubmitOutcome(
	user: { id: string },
	body: Record<string, any>
) {
	const {
		scoredLocationId, verdict, monthsOpen, revenueRange,
		satisfaction, notes, biggestSurprise, checkInNumber
	} = body;

	if (!scoredLocationId || !verdict) {
		return new Response(
			JSON.stringify({ error: 'Required: scoredLocationId, verdict' }),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	const validVerdicts = ['opened', 'passed', 'still_looking', 'closed'];
	if (!validVerdicts.includes(verdict as string)) {
		return new Response(
			JSON.stringify({ error: `verdict must be one of: ${validVerdicts.join(', ')}` }),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	let data: any = null;
	try {
		const res = await db.execute(sql`
			INSERT INTO outcomes (
				scored_location_id, user_id, verdict, months_open, 
				revenue_range, satisfaction, notes, biggest_surprise, check_in_number
			) VALUES (
				${scoredLocationId}, ${user.id}, ${verdict}, ${monthsOpen ?? null},
				${revenueRange ?? null}, ${satisfaction ?? null}, ${notes ?? null}, ${biggestSurprise ?? null}, ${checkInNumber ?? 1}
			) RETURNING *
		`);
		data = res.rows[0];
	} catch (error) {
		console.error('[OUTCOMES] Submit outcome error:', error);
		return new Response(JSON.stringify({ error: 'Failed to submit outcome' }), { status: 500 });
	}

	// Mark check-in as responded if applicable
	if (checkInNumber) {
		const nowStr = new Date().toISOString();
		await db.execute(sql`
			UPDATE outcome_checkins 
			SET status = 'responded', responded_at = ${nowStr}
			WHERE scored_location_id = ${scoredLocationId} 
			  AND check_in_number = ${checkInNumber} 
			  AND user_id = ${user.id}
		`);
	}

	return new Response(JSON.stringify({ outcome: data }), {
		status: 201,
		headers: { 'Content-Type': 'application/json' }
	});
}
