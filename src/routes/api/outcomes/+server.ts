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
import { getSupabase } from '$lib/supabase';
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

	const supabase = getSupabase();
	const singleId = url.searchParams.get('id');

	try {
		if (singleId) {
			// Single location with all outcomes
			const { data: location, error: locErr } = await supabase
				.from('scored_locations')
				.select('*')
				.eq('id', singleId)
				.eq('user_id', userId)
				.single();

			if (locErr || !location) {
				return new Response(JSON.stringify({ error: 'Location not found' }), { status: 404 });
			}

			const { data: outcomes } = await supabase
				.from('outcomes')
				.select('*')
				.eq('scored_location_id', singleId)
				.order('check_in_number', { ascending: true });

			return new Response(JSON.stringify({ location, outcomes: outcomes || [] }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// List all scored locations for this user
		const { data: locations, error: listErr } = await supabase
			.from('scored_locations')
			.select('*')
			.eq('user_id', userId)
			.order('scored_at', { ascending: false })
			.limit(50);

		if (listErr) {
			console.error('[OUTCOMES] List error:', listErr);
			return new Response(JSON.stringify({ error: 'Failed to fetch locations' }), { status: 500 });
		}

		// Get latest outcome for each location
		const locationIds = (locations || []).map(l => l.id);
		let outcomesMap: Record<string, unknown> = {};

		if (locationIds.length > 0) {
			const { data: outcomes } = await supabase
				.from('outcomes')
				.select('*')
				.in('scored_location_id', locationIds)
				.order('check_in_number', { ascending: false });

			// Group by location, keep latest
			for (const o of outcomes || []) {
				if (!outcomesMap[o.scored_location_id]) {
					outcomesMap[o.scored_location_id] = o;
				}
			}
		}

		const enriched = (locations || []).map(loc => ({
			...loc,
			latestOutcome: outcomesMap[loc.id] || null
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
	const supabase = getSupabase();

	try {
		const body = await request.json();
		const { action } = body;

		if (action === 'save_location') {
			return await handleSaveLocation(supabase, user, body);
		} else if (action === 'submit_outcome') {
			return await handleSubmitOutcome(supabase, user, body);
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

interface SupabaseClient {
	from: (table: string) => {
		insert: (data: Record<string, unknown>) => { select: (cols?: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }> } };
		select: (cols?: string) => {
			eq: (col: string, val: unknown) => {
				single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
				order: (col: string, opts?: Record<string, unknown>) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }> };
			};
			in: (col: string, vals: unknown[]) => {
				order: (col: string, opts?: Record<string, unknown>) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>;
			};
		};
	};
}

async function handleSaveLocation(
	supabase: ReturnType<typeof getSupabase>,
	user: { id: string; email?: string; name?: string },
	body: Record<string, unknown>
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

	const { data, error } = await supabase
		.from('scored_locations')
		.insert({
			user_id: user.id,
			address,
			lat,
			lng,
			business_type: businessType || 'cafe',
			concept_type: conceptType || null,
			location_iq: locationIQ,
			niq: niq ?? null,
			siq: siq ?? null,
			tiq: tiq ?? null,
			liq: liq ?? null,
			grade: grade ?? null,
			confidence: confidence ?? null,
			transit_score: transitScore ?? null,
			demographics_score: demographicsScore ?? null,
			competition_score: competitionScore ?? null,
			vibrancy_score: vibrancyScore ?? null,
			safety_score: safetyScore ?? null,
			momentum_score: momentumScore ?? null,
			data_sources_available: dataSourcesAvailable ?? null,
			data_sources_total: dataSourcesTotal ?? null,
			signals: signals ?? []
		})
		.select()
		.single();

	if (error) {
		console.error('[OUTCOMES] Save location error:', error);
		return new Response(JSON.stringify({ error: 'Failed to save location' }), { status: 500 });
	}

	// Schedule check-in emails (fire and forget)
	if (user.email && data?.id) {
		scheduleCheckIns(supabase, {
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
	supabase: ReturnType<typeof getSupabase>,
	user: { id: string },
	body: Record<string, unknown>
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

	const { data, error } = await supabase
		.from('outcomes')
		.insert({
			scored_location_id: scoredLocationId,
			user_id: user.id,
			verdict,
			months_open: monthsOpen ?? null,
			revenue_range: revenueRange ?? null,
			satisfaction: satisfaction ?? null,
			notes: notes ?? null,
			biggest_surprise: biggestSurprise ?? null,
			check_in_number: checkInNumber ?? 1
		})
		.select()
		.single();

	if (error) {
		console.error('[OUTCOMES] Submit outcome error:', error);
		return new Response(JSON.stringify({ error: 'Failed to submit outcome' }), { status: 500 });
	}

	// Mark check-in as responded if applicable
	if (checkInNumber) {
		await supabase
			.from('outcome_checkins')
			.update({ status: 'responded', responded_at: new Date().toISOString() })
			.eq('scored_location_id', scoredLocationId)
			.eq('check_in_number', checkInNumber)
			.eq('user_id', user.id);
	}

	return new Response(JSON.stringify({ outcome: data }), {
		status: 201,
		headers: { 'Content-Type': 'application/json' }
	});
}
