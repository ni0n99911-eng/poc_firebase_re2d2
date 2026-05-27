/**
 * BR-10: Shortlist compare endpoint.
 *
 * POST /api/shortlist/compare
 *
 * Harmonizes compare semantics for 2–3 shortlisted locations. The Dashboard
 * compare panel (shipped in 9f4dfa8) runs everything client-side from the
 * cached shortlist state — this endpoint is the *shared* compute layer so
 * future consumers (PDF export, email digest, CoPilot "should I pick A or B"
 * chip) get the exact same verdict + winner math without duplicating logic.
 *
 * Design constraints:
 * - STATELESS. No DB reads, no intel fetch. The client sends everything it
 *   already has (locationIQ, fitIQ, visionIQ, sixScores, addr, scoredAt) and
 *   the server only transforms + synthesizes.
 * - MIRRORS the Dashboard panel. Winner logic must match `winnerCol()` in
 *   src/routes/app/dashboard/+page.svelte exactly so the narrative and the
 *   visual "Best" badge never disagree.
 * - ADDS value client can't: cross-location narrative, kill-factor-adjusted
 *   overall recommendation, tie awareness.
 *
 * Response shape is designed to be consumed either by the Dashboard panel
 * (if it ever wants to swap from client-compute to server-compute for a
 * "refresh" button) or by export/email/AI callers. All fields are echoed
 * back with derived additions — no field is dropped.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';
import {
	computeKillFactors,
	getVerdict,
	type SixScores,
	type CanonicalScores,
} from '$lib/scoring-utils';
import { fitGrade, fitTierLabel } from '$lib/utils/decision-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompareInputLocation {
	/** Block group geoid, optional — compare doesn't require it. */
	geoid?: string | null;
	/** Display address — required, used as the stable identity key. */
	addr: string;
	/** Three-score architecture — all three are numeric, 0-100. */
	locationIQ?: number | null;
	fitIQ?: number | null;
	visionIQ?: number | null;
	/** Six-index scores for verdict + kill factor derivation. */
	sixScores?: SixScores | null;
	/** ISO timestamp of when this location was scored. */
	scoredAt?: string | null;
	/** Optional concept/business type echo — not used in compute, passed through. */
	businessType?: string | null;
}

interface CompareBody {
	locations?: CompareInputLocation[];
}

type MetricKey = 'fit' | 'location' | 'vision';

interface WinnerResult {
	/** Index into the input locations array; null when there is no single winner. */
	index: number | null;
	/** Echoed address of the winner; null when tied or all zero. */
	addr: string | null;
	/** The winning score value; null when tied or all zero. */
	score: number | null;
	/** Gap to second place; null when no meaningful winner. */
	margin: number | null;
	/** Plain-English reason, e.g. "tie", "all locations missing this metric". */
	reason: string;
}

// ─── Winner math ──────────────────────────────────────────────────────────────

/**
 * Mirrors `winnerCol()` in src/routes/app/dashboard/+page.svelte.
 *
 * Contract must stay in lock-step with the client so the UI "Best" badge never
 * disagrees with the narrative this endpoint returns.
 *
 * Rules:
 *   - Vision IQ: locations reporting 0 are excluded from the pool (partial-
 *     Vision shouldn't skew the badge). Same as client.
 *   - Fit / Location: zeros are eligible but can't win (max<=0 → no winner).
 *   - Tie on the max value → no winner (no false precision).
 */
function computeWinner(locations: CompareInputLocation[], metric: MetricKey): WinnerResult {
	const read = (loc: CompareInputLocation): number => {
		if (metric === 'fit') return Number(loc.fitIQ ?? 0);
		if (metric === 'location') return Number(loc.locationIQ ?? 0);
		return Number(loc.visionIQ ?? 0);
	};

	const vals = locations.map(read);
	const eligible =
		metric === 'vision'
			? vals.map((v, i) => (v > 0 ? { v, i } : null)).filter(Boolean) as Array<{ v: number; i: number }>
			: vals.map((v, i) => ({ v, i }));

	if (eligible.length === 0) {
		return {
			index: null,
			addr: null,
			score: null,
			margin: null,
			reason: metric === 'vision' ? 'No Vision IQ data on any shortlisted location' : 'No data'
		};
	}

	const max = Math.max(...eligible.map((e) => e.v));
	if (max <= 0) {
		return {
			index: null,
			addr: null,
			score: null,
			margin: null,
			reason: 'All locations at zero for this metric'
		};
	}

	const topIdx = eligible.filter((e) => e.v === max).map((e) => e.i);
	if (topIdx.length > 1) {
		return {
			index: null,
			addr: null,
			score: max,
			margin: 0,
			reason: `Tie at ${max} across ${topIdx.length} locations`
		};
	}

	const winnerIdx = topIdx[0];
	// Margin = winner - highest non-winner. If only 1 eligible location, margin is null.
	const others = eligible.filter((e) => e.i !== winnerIdx);
	const margin = others.length > 0 ? max - Math.max(...others.map((e) => e.v)) : null;

	return {
		index: winnerIdx,
		addr: locations[winnerIdx].addr,
		score: max,
		margin,
		reason: others.length === 0 ? 'Only eligible location' : `Leads by ${margin} points`
	};
}

// ─── Cross-location narrative ─────────────────────────────────────────────────

/**
 * Overall winner: picks the Fit IQ leader unless it has a hard kill factor
 * while a runner-up is clean. Mirrors the verdict engine's logic that kills
 * trump raw score. Returns null when the top two are tied on fit AND on
 * kill-factor count (a real coin flip — don't fabricate a winner).
 */
function computeOverall(
	locations: CompareInputLocation[],
	fitWinner: WinnerResult
): { index: number | null; addr: string | null; reasoning: string } {
	if (locations.length < 2) {
		return { index: null, addr: null, reasoning: 'Need at least 2 locations to compare' };
	}

	// Kill count per location (only 'kill' flags, not 'caution')
	const killCounts = locations.map((loc) =>
		loc.sixScores ? computeKillFactors(loc.sixScores).filter((f) => f.flag === 'kill').length : 0
	);

	// Start with the fit winner if there is one
	if (fitWinner.index != null) {
		const fWinKills = killCounts[fitWinner.index];
		if (fWinKills === 0) {
			return {
				index: fitWinner.index,
				addr: fitWinner.addr,
				reasoning: `Highest Fit IQ (${fitWinner.score}) with no kill factors — strongest overall pick.`
			};
		}
		// Fit winner has a kill — check if anyone else is clean AND close (within 7 pts)
		const threshold = 7;
		const fitWinScore = Number(locations[fitWinner.index].fitIQ ?? 0);
		const cleanCloseAlt = locations
			.map((loc, i) => ({
				i,
				fit: Number(loc.fitIQ ?? 0),
				kills: killCounts[i]
			}))
			.filter((x) => x.i !== fitWinner.index && x.kills === 0 && fitWinScore - x.fit <= threshold)
			.sort((a, b) => b.fit - a.fit)[0];

		if (cleanCloseAlt) {
			return {
				index: cleanCloseAlt.i,
				addr: locations[cleanCloseAlt.i].addr,
				reasoning: `Fit IQ leader has a kill factor; this one scores ${cleanCloseAlt.fit} with zero red flags — safer pick.`
			};
		}
		// No clean alternative close enough — stick with fit winner but flag the risk
		return {
			index: fitWinner.index,
			addr: fitWinner.addr,
			reasoning: `Highest Fit IQ (${fitWinner.score}) but carries ${fWinKills} kill factor${fWinKills > 1 ? 's' : ''} — address before committing.`
		};
	}

	// No single fit winner (tie or all-zero). Prefer the location with fewest kills.
	const minKills = Math.min(...killCounts);
	const cleanest = killCounts.map((k, i) => ({ k, i })).filter((x) => x.k === minKills);
	if (cleanest.length === 1) {
		return {
			index: cleanest[0].i,
			addr: locations[cleanest[0].i].addr,
			reasoning:
				minKills === 0
					? 'Fit IQ is tied; this is the only location without kill factors.'
					: `Fit IQ is tied; this one has the fewest kill factors (${minKills}).`
		};
	}

	return { index: null, addr: null, reasoning: 'Too close to call — tied on Fit IQ and on kill factors.' };
}

/**
 * Synthesizes a 1–2 sentence narrative for the compare panel footer / export.
 * Leans on the overall winner reasoning and calls out the biggest trade-off.
 */
function buildNarrative(
	locations: CompareInputLocation[],
	winners: {
		fit: WinnerResult;
		location: WinnerResult;
		vision: WinnerResult;
		overall: { index: number | null; addr: string | null; reasoning: string };
	}
): string {
	if (locations.length < 2) return '';

	// Count how many metrics have a clear winner
	const clearWinners = [winners.fit, winners.location, winners.vision].filter(
		(w) => w.index != null
	);

	if (winners.overall.index == null) {
		return `These ${locations.length} locations are structurally similar — decide on qualitative factors (rent, landlord, timing) rather than the scores.`;
	}

	// Single winner across the board
	if (clearWinners.length >= 2 && clearWinners.every((w) => w.index === winners.overall.index)) {
		const lead = shortAddr(winners.overall.addr || '');
		return `${lead} is the strongest across the board — ${winners.overall.reasoning.toLowerCase()}`;
	}

	// Split winners: call out the trade-off
	const fitLead = winners.fit.index != null ? shortAddr(winners.fit.addr || '') : null;
	const locLead = winners.location.index != null ? shortAddr(winners.location.addr || '') : null;
	const overallLead = shortAddr(winners.overall.addr || '');

	if (fitLead && locLead && fitLead !== locLead) {
		return `${overallLead} is the recommended pick — ${winners.overall.reasoning} ${locLead} has the stronger raw location score, but Fit IQ is the primary signal.`;
	}

	return `${overallLead} is the recommended pick. ${winners.overall.reasoning}`;
}

/** Mirror of Dashboard's shortAddr helper — keep first comma segment only. */
function shortAddr(addr: string): string {
	if (!addr) return '';
	return addr.split(',')[0].trim() || addr;
}

// ─── Per-location derivations ─────────────────────────────────────────────────

interface DerivedLocation {
	addr: string;
	geoid: string | null;
	businessType: string | null;
	scoredAt: string | null;
	scores: {
		locationIQ: number;
		fitIQ: number;
		visionIQ: number;
	};
	verdict: {
		tier: string;
		grade: string;
		line: string;
	};
	killFactors: Array<{
		signal: string;
		label: string;
		value: number;
		flag: SignalFlag;
	}>;
}

function deriveLocation(loc: CompareInputLocation): DerivedLocation {
	const locationIQ = Number(loc.locationIQ ?? 0);
	const fitIQ = Number(loc.fitIQ ?? 0);
	const visionIQ = Number(loc.visionIQ ?? 0);

	const canonical: CanonicalScores = { locationIQ, fitIQ, visionIQ };
	const six: SixScores = loc.sixScores ?? {};
	const flags = fitIQ > 0 ? computeKillFactors(six) : [];

	return {
		addr: loc.addr,
		geoid: loc.geoid ?? null,
		businessType: loc.businessType ?? null,
		scoredAt: loc.scoredAt ?? null,
		scores: { locationIQ, fitIQ, visionIQ },
		verdict: {
			tier: fitIQ > 0 ? fitTierLabel(fitIQ) : 'Not scored',
			grade: fitIQ > 0 ? fitGrade(fitIQ) : '—',
			line: fitIQ > 0 ? getVerdict(canonical, six) : 'Complete scoring to see verdict.'
		},
		killFactors: flags.map((f) => ({
			signal: f.signal,
			label: f.label,
			value: f.value,
			flag: f.flag
		}))
	};
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
	const limited = rateLimit(request, RATE_LIMITS.api);
	if (limited) return limited;

	let body: CompareBody;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const locations = Array.isArray(body.locations) ? body.locations : [];

	if (locations.length < 2) {
		return new Response(
			JSON.stringify({
				error: 'At least 2 locations are required to compare.',
				received: locations.length
			}),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	if (locations.length > 3) {
		return new Response(
			JSON.stringify({
				error: 'Compare supports a maximum of 3 locations. Unpin one to swap.',
				received: locations.length
			}),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	// Validate each location has at least an addr.
	for (let i = 0; i < locations.length; i++) {
		const loc = locations[i];
		if (!loc || typeof loc.addr !== 'string' || !loc.addr.trim()) {
			return new Response(
				JSON.stringify({ error: `locations[${i}].addr is required` }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}
	}

	try {
		const derived = locations.map(deriveLocation);

		const fit = computeWinner(locations, 'fit');
		const location = computeWinner(locations, 'location');
		const vision = computeWinner(locations, 'vision');
		const overall = computeOverall(locations, fit);

		const narrative = buildNarrative(locations, { fit, location, vision, overall });

		return new Response(
			JSON.stringify({
				locations: derived,
				winners: { fit, location, vision, overall },
				narrative,
				// Metadata so downstream consumers know what they're getting.
				meta: {
					source: 'shortlist-compare',
					computedAt: new Date().toISOString(),
					count: locations.length
				}
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store'
				}
			}
		);
	} catch (e: unknown) {
		console.error('[ShortlistCompare] Error:', e);
		return new Response(
			JSON.stringify({
				error: 'Internal error computing compare',
				message: e instanceof Error ? e.message : 'Unknown error'
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
