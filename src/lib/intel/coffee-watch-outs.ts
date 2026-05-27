/**
 * C11: Coffee-specific watch-out types + client-side generator.
 *
 * Watch-outs (W1–W10) are about BUSINESS VIABILITY at a specific location.
 * Distinct from HeadsUpWarnings (C1–C5) which are about BUILD-OUT requirements.
 *
 * Two paths produce watch-outs:
 *   1. Server-side: segment-intel.ts generateCoffeeWatchOuts() — runs during
 *      /api/location-iq computation, stored in response + persistence layer.
 *      This is the authoritative source (has raw intel data).
 *   2. Client-side: this file's generateCoffeeWatchOuts() — lightweight fallback
 *      using compass scores (6 generic indices). Fires in AddressAnalyzer when
 *      API watch-outs aren't available yet.
 *
 * UX renders via CoffeeWatchOuts.svelte.
 */

import { KILL_FACTOR_THRESHOLDS } from '$lib/constants/scoring-thresholds';

export interface CoffeeWatchOut {
	/** Watch-out ID: W1, W2, etc. */
	id: string;
	/** Short title shown in the pill header */
	title: string;
	/** One-line explanation of why this matters */
	explanation: string;
	/** Severity: critical = red, important = amber, info = grey */
	severity: 'critical' | 'important' | 'info';
	/** Emoji icon for the pill */
	icon: string;
}

// ── Severity escalation: W3 + W9 together = deal_breaker ──────────────
function escalateSeverity(watchOuts: CoffeeWatchOut[]): CoffeeWatchOut[] {
	const ids = new Set(watchOuts.map(w => w.id));
	// W3 (3+ competitors in 100m) + W9 (saturated micro-zone) = critical
	if (ids.has('W3') && ids.has('W9')) {
		return watchOuts.map(w =>
			(w.id === 'W3' || w.id === 'W9') ? { ...w, severity: 'critical' as const } : w
		);
	}
	return watchOuts;
}

/**
 * Client-side coffee watch-out generator.
 *
 * Uses compass scores (generic 6-index) as proxy signals. Less precise than
 * the server-side generator (which has raw POI counts, MTA data, etc.), but
 * provides immediate feedback while the API response is in flight.
 *
 * @param scores - Compass scores: { transit, competition, demographics, vibrancy, safety, momentum }
 * @param bizType - Business type slug
 * @param avgTicket - Average ticket price (defaults to $5.00)
 */
export function generateCoffeeWatchOuts(
	scores: Record<string, number>,
	bizType: string,
	avgTicket: number = 5.00
): CoffeeWatchOut[] {
	// Only generate for coffee concepts
	const normalized = bizType.toLowerCase().replace(/[\s/]+/g, '_');
	if (normalized !== 'coffee' && normalized !== 'specialty_coffee' && normalized !== 'cafe') {
		return [];
	}

	const out: CoffeeWatchOut[] = [];
	const transit = scores.transit ?? 50;
	const competition = scores.competition ?? 50;
	const demographics = scores.demographics ?? 50;
	const vibrancy = scores.vibrancy ?? 50;
	const safety = scores.safety ?? 50;
	const survivalRate = scores.survivalRate ?? 60;

	// W1 — Low morning foot traffic (transit < 35 as proxy for low walk-in)
	if (transit < 35) {
		out.push({
			id: 'W1',
			title: 'Low foot traffic',
			explanation: 'Low morning walk-in traffic. This block doesn\'t hand you commuters — plan for destination marketing.',
			severity: 'important',
			icon: '🚶',
		});
	}

	// W2 — Few daily-repeat anchors (vibrancy < 40 as proxy for thin ritual density)
	if (vibrancy < 40) {
		out.push({
			id: 'W2',
			title: 'Thin daily anchors',
			explanation: 'Few daily-repeat anchors nearby. Coffee thrives on habits — this block may need time to build a routine customer base.',
			severity: 'important',
			icon: '🔄',
		});
	}

	// W3 — High competition density (competition < 35 = many competitors dragging score down)
	if (competition < 35) {
		out.push({
			id: 'W3',
			title: '3+ competitors nearby',
			explanation: '3+ coffee competitors within 100m. You\'re in a dogfight for the same walk-by customer.',
			severity: 'important',
			icon: '⚔️',
		});
	}

	// W4 — Pricing matches block average (competition between 40-55 with avg ticket)
	// Hard to detect precisely client-side; skip — server-side handles this via blendCompetitorPricing

	// W5 — No high-conversion anchors (vibrancy < 45 AND transit < 45)
	if (vibrancy < 45 && transit < 45) {
		out.push({
			id: 'W5',
			title: 'No anchor traffic',
			explanation: 'No high-conversion anchors (gyms, hospitals, tourist draws) within 200m. Your traffic is purely walk-by.',
			severity: 'important',
			icon: '🏥',
		});
	}

	// W6 — Below-average survival rate
	if (survivalRate < 50) {
		out.push({
			id: 'W6',
			title: 'Low survival block',
			explanation: 'Below-average year-1 survival on this block. Model conservative and plan for a longer ramp.',
			severity: 'important',
			icon: '📉',
		});
	}

	// W7 — Poor street-side conditions (safety < 40 as partial proxy)
	if (safety < 40) {
		out.push({
			id: 'W7',
			title: 'Street-level risk',
			explanation: 'Street-level conditions work against impulse stops — limited sidewalk width, poor visibility, or hostile pedestrian environment.',
			severity: 'important',
			icon: '🚧',
		});
	}

	// W8 — Demographics income mismatch
	if (avgTicket > 7 && demographics < 40) {
		out.push({
			id: 'W8',
			title: 'Income mismatch',
			explanation: 'Neighborhood income doesn\'t match your price point. Check whether your target customer actually lives or works here.',
			severity: 'important',
			icon: '💰',
		});
	} else if (avgTicket <= 5 && demographics > 80) {
		out.push({
			id: 'W8',
			title: 'Over-qualified block',
			explanation: 'High-income area with a value price point. You may face premium-brand competition that commoditizes your offer.',
			severity: 'info',
			icon: '💰',
		});
	}

	// W9 — Saturated micro-zone (competition very low = many direct competitors)
	// B2-1.1: threshold from canonical constant
	if (competition < KILL_FACTOR_THRESHOLDS.competition) {
		out.push({
			id: 'W9',
			title: 'Saturated micro-zone',
			explanation: 'Saturated micro-zone. Two or more direct competitors within 100m — differentiation is mandatory.',
			severity: 'important',
			icon: '🔴',
		});
	}

	// W10 — Weekend dead zone (hard to detect client-side without MTA weekend data)
	// Server-side handles via daytimePopRatio. Client proxy: high transit + low vibrancy
	// suggests office-heavy corridor that dies on weekends
	if (transit > 65 && vibrancy < KILL_FACTOR_THRESHOLDS.vibrancy) {
		out.push({
			id: 'W10',
			title: 'Weekend dead zone',
			explanation: 'This block goes quiet on weekends. If your model needs 7-day revenue, factor in a significant weekend drop.',
			severity: 'important',
			icon: '📅',
		});
	}

	return escalateSeverity(out);
}
