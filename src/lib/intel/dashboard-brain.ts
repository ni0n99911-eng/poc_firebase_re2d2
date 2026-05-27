/**
 * dashboard-brain.ts
 *
 * Five deterministic logic functions that power Screens 08, 09, and 10.
 * No API calls. All inputs come from scoring engine state already in memory.
 *
 * Functions:
 *   getWhyBulletsV2()        — Screen 08: 3 fixed signal bullets under score ring
 *   getSuccessProb()         — Screen 09: probability ring + percentile string
 *   getRevenueProjections()  — Screen 09: Yr1/Yr2/Yr3 revenue bars
 *   getDashboardHeadline()   — Screen 10: 5-state aware headline
 *   getTodaysInsight()       — Screen 10: 2-sentence actionable coaching card
 */

import type { DecisionState, ConceptCoaching } from '$lib/utils/decision-engine';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WhyBullet {
	text: string;
	color: 'green' | 'amber' | 'red';
	icon: string;
}

export interface SuccessProb {
	pct: number;          // 0–88 (capped — nothing is certain in NYC)
	label: string;        // "Strong probability" | "Moderate probability" | "Uncertain"
	percentileStr: string;// "Top 18% of specialty coffee locations scored in NYC"
	color: 'green' | 'amber' | 'red';
}

export interface RevenueProjection {
	yr1: number;
	yr2: number;
	yr3: number;
	yr1Width: number;     // % of yr3 (bar width)
	yr2Width: number;
	yr3Width: number;     // always 100
	rentKill: boolean;    // true if monthlyRent/yr1Revenue > concept maxRentPercent
	rentKillMsg: string;
}

export type DashboardHeadlineState = 0 | 1 | 2 | 3 | 4;

export interface DashboardHeadline {
	state: DashboardHeadlineState;
	text: string;
	sub: string;
}

export interface TodaysInsight {
	text: string;         // 2 sentences max, no hedging, actionable only
	priority: 'kill' | 'vision' | 'signal' | 'coaching';
	color: 'red' | 'amber' | 'green';
}

// ── Per-concept score distributions (calibrated from Cycle 2H, d=0.601) ──────
// Used to produce "Top X% of [concept] in NYC" percentile strings.
// Values are approximate medians + standard deviations from our training run.
// mean = avg fitIQ across all scored locations for that concept
// sd   = standard deviation

const CONCEPT_DIST: Record<string, { mean: number; sd: number }> = {
	specialty_coffee:        { mean: 54, sd: 14 },
	cafe_bakery:             { mean: 52, sd: 13 },
	fast_casual:             { mean: 56, sd: 15 },
	qsr:                     { mean: 58, sd: 14 },
	full_service_restaurant: { mean: 51, sd: 15 },
	fine_dining:             { mean: 46, sd: 16 },
	bar_nightlife:           { mean: 53, sd: 14 },
	fitness_studio:          { mean: 50, sd: 14 },
	retail:                  { mean: 55, sd: 15 },
	coworking:               { mean: 57, sd: 13 },
	medical_office:          { mean: 60, sd: 12 },
	personal_services:       { mean: 56, sd: 13 },
	wellness_spa:            { mean: 49, sd: 14 },
	yoga_wellness:           { mean: 48, sd: 14 },
	juice_bar:               { mean: 52, sd: 13 },
	florist:                 { mean: 54, sd: 12 },
	default:                 { mean: 54, sd: 14 },
};

// Concept utilization ramp defaults (Yr1 / Yr2 / Yr3)
const UTILIZATION_RAMP: Record<string, [number, number, number]> = {
	specialty_coffee:        [0.55, 0.72, 0.88],
	cafe_bakery:             [0.52, 0.70, 0.85],
	fast_casual:             [0.50, 0.68, 0.83],
	qsr:                     [0.55, 0.72, 0.87],
	full_service_restaurant: [0.45, 0.62, 0.78],
	fine_dining:             [0.40, 0.58, 0.74],
	bar_nightlife:           [0.48, 0.65, 0.82],
	fitness_studio:          [0.42, 0.60, 0.78],
	retail:                  [0.50, 0.68, 0.84],
	coworking:               [0.45, 0.62, 0.80],
	medical_office:          [0.55, 0.72, 0.85],
	personal_services:       [0.52, 0.70, 0.85],
	wellness_spa:            [0.42, 0.60, 0.76],
	yoga_wellness:           [0.42, 0.60, 0.76],
	default:                 [0.50, 0.68, 0.83],
};

// Concept maxRentPercent (matches CONCEPT_KPIS)
const MAX_RENT_PCT: Record<string, number> = {
	specialty_coffee:        10, cafe_bakery:             10,
	fast_casual:             10, qsr:                     10,
	full_service_restaurant:  8, fine_dining:              8,
	bar_nightlife:           10, fitness_studio:          12,
	retail:                  12, coworking:               15,
	medical_office:          15, personal_services:       12,
	wellness_spa:            12, yoga_wellness:           12,
	default:                 10,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normal CDF approximation (Abramowitz & Stegun) */
function normalCDF(x: number): number {
	const t = 1 / (1 + 0.2316419 * Math.abs(x));
	const d = 0.3989423 * Math.exp(-x * x / 2);
	const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
	return x > 0 ? 1 - p : p;
}

function percentileRank(score: number, concept: string): number {
	const dist = CONCEPT_DIST[concept] ?? CONCEPT_DIST['default'];
	const z = (score - dist.mean) / dist.sd;
	// percentileRank = 1 - CDF (i.e. % of locations scoring BELOW this score)
	return Math.round((1 - normalCDF(z)) * 100);
}

function conceptLabel(concept: string, tierLabelOverride?: string): string {
	// If a tier-specific label is provided (e.g. "budget coffee"), use it for coffee concepts
	if (tierLabelOverride && (concept === 'specialty_coffee' || concept === 'coffee_shop' || concept === 'coffee' || concept === 'cafe')) {
		return tierLabelOverride;
	}
	const MAP: Record<string, string> = {
		specialty_coffee: 'specialty coffee', cafe_bakery: 'café/bakery',
		fast_casual: 'fast casual', qsr: 'QSR', full_service_restaurant: 'full-service restaurant',
		fine_dining: 'fine dining', bar_nightlife: 'bar/nightlife', fitness_studio: 'fitness studio',
		retail: 'retail', coworking: 'coworking', medical_office: 'medical office',
		personal_services: 'personal services', wellness_spa: 'spa/wellness',
		yoga_wellness: 'yoga/wellness', juice_bar: 'juice bar', florist: 'florist',
	};
	return MAP[concept] ?? concept.replace(/_/g, ' ');
}

// ── Function 1: Why Bullets (Screen 08) ──────────────────────────────────────
/**
 * Always returns exactly 3 bullets — survival rate, competitor count, transit.
 * Wireframe spec: green if strong, amber if caution, red if risk.
 * Source: sixScores.survivalRate, competitors.length, sixScores.transit
 */
export function getWhyBulletsV2(params: {
	survivalRate: number;
	competitorCount: number;
	transitScore: number;
	transitStations?: string;  // e.g. "A/C/E at 14th St · L at 8th Ave" if available
	competitorScanStatus?: 'pending' | 'complete' | 'failed';  // BRAIN-NEW-01
}): WhyBullet[] {
	const { survivalRate, competitorCount, transitScore, transitStations, competitorScanStatus } = params;

	// Bullet 1: Survival rate vs NYC baseline (52%)
	// EF-5 (April 11): Survival unit collapse. Canonical representation is
	// raw year-1 survival % vs the NYC 52% baseline. NEVER emit "/100" — that
	// reads as an index and contradicts the raw % elsewhere in the UI.
	let survText: string;
	let survColor: WhyBullet['color'];
	if (survivalRate <= 0) {
		survText = 'Survival rate data not yet available for this block.';
		survColor = 'amber';
	} else if (survivalRate >= 65) {
		survText = `${survivalRate}% of similar businesses on this block survive year 1 — well above the NYC average of 52%. Operators who fit this market tend to stick.`;
		survColor = 'green';
	} else if (survivalRate >= 52) {
		survText = `${survivalRate}% year-1 survival rate — in line with the NYC average of 52%. Steady block, no standout durability signal.`;
		survColor = 'amber';
	} else {
		survText = `${survivalRate}% year-1 survival rate — below the NYC average of 52%. Model conservative unit economics through year 2.`;
		survColor = 'red';
	}

	// Bullet 2: Competitor count within 0.3mi
	// BRAIN-NEW-01: When scan is pending/failed, don't misrepresent 0 as a real result.
	let compText: string;
	let compColor: WhyBullet['color'];
	if (competitorScanStatus && competitorScanStatus !== 'complete') {
		compText = 'Competitor scan in progress — check back after the full analysis loads.';
		compColor = 'amber';
	} else if (competitorCount === 0) {
		compText = 'No direct competitors mapped within 0.3mi — first-mover opportunity, but verify demand exists before committing.';
		compColor = 'amber';
	} else if (competitorCount <= 3) {
		compText = `${competitorCount} competitor${competitorCount === 1 ? '' : 's'} within 0.3mi — low density. Room to own this block if your differentiator is clear.`;
		compColor = 'green';
	} else if (competitorCount <= 8) {
		compText = `${competitorCount} competitors within 0.3mi — healthy cluster. Demand is proven; differentiation is your lever.`;
		compColor = 'green';
	} else if (competitorCount <= 20) {
		compText = `${competitorCount} competitors within 0.3mi — crowded. You need a clear reason for customers to choose you over existing options.`;
		compColor = 'amber';
	} else {
		compText = `${competitorCount} competitors within 0.3mi — saturated block. Consider whether volume supports another entrant.`;
		compColor = 'red';
	}

	// Bullet 3: Transit access
	let transitText: string;
	let transitColor: WhyBullet['color'];
	const stationStr = transitStations ? ` (${transitStations})` : '';
	if (transitScore >= 75) {
		transitText = `Excellent transit access${stationStr} — score ${transitScore}/100. Multiple lines nearby drive consistent foot traffic and reduce car-dependency.`;
		transitColor = 'green';
	} else if (transitScore >= 55) {
		transitText = `Good transit access${stationStr} — score ${transitScore}/100. Walk-in customers are viable; commuter traffic is moderate.`;
		transitColor = 'green';
	} else if (transitScore >= 35) {
		transitText = `Moderate transit access${stationStr} — score ${transitScore}/100. Foot traffic will require active marketing; parking or delivery may help.`;
		transitColor = 'amber';
	} else {
		transitText = `Limited transit access${stationStr} — score ${transitScore}/100. Car-dependent location. Ensure your concept and customer profile support this.`;
		transitColor = 'red';
	}

	return [
		{ text: survText,    color: survColor,    icon: survivalRate >= 52 ? '🏆' : '⚠️'  },
		{ text: compText,    color: compColor,    icon: competitorCount <= 8 ? '🎯' : '⚠️' },
		{ text: transitText, color: transitColor, icon: transitScore >= 55 ? '🚇' : '⚠️'  },
	];
}

// ── Function 2: Success Probability (Screen 09) ───────────────────────────────
/**
 * Single probability ring for the Business Case screen.
 * Formula from wireframe: (fitIQ × 0.6) + (locationIQ × 0.25) + (visionIQ × 0.15)
 * Capped at 88% — nothing is certain in NYC real estate.
 */
export function getSuccessProb(params: {
	fitIQ: number;
	locationIQ: number;
	visionIQ: number;
	visionIsPrelim: boolean;
	concept: string;
	/** Optional tier-aware label for coffee concepts (e.g. "budget coffee", "premium coffee experience") */
	tierLabel?: string;
}): SuccessProb {
	const { fitIQ, locationIQ, visionIQ, visionIsPrelim, concept, tierLabel } = params;

	const visionContrib = visionIsPrelim ? 0 : visionIQ * 0.15;
	const raw = (fitIQ * 0.6) + (locationIQ * 0.25) + visionContrib;
	const pct = Math.min(88, Math.round(raw));

	let label: string;
	let color: SuccessProb['color'];
	if (pct >= 75) {
		label = 'Strong probability';
		color = 'green';
	} else if (pct >= 60) {
		label = 'Moderate probability';
		color = 'amber';
	} else {
		label = 'Uncertain';
		color = 'red';
	}

	const topPct = percentileRank(fitIQ, concept);
	const cLabel  = conceptLabel(concept, tierLabel);
	const percentileStr = topPct <= 15
		? `Top ${topPct}% of ${cLabel} locations scored in NYC`
		: topPct <= 35
		? `Top third of ${cLabel} locations scored in NYC`
		: topPct <= 55
		? `Mid-range among ${cLabel} locations scored in NYC`
		: `Below median for ${cLabel} locations scored in NYC`;

	return { pct, label, percentileStr, color };
}

// ── Function 3: Revenue Projections (Screen 09) ───────────────────────────────
/**
 * 3-year revenue bars using concept-calibrated utilization ramps.
 * Bar widths are relative to Yr3 (Yr3 = 100% baseline).
 * Kill flag fires if monthlyRent/yr1Revenue > concept maxRentPercent.
 */
export function getRevenueProjections(params: {
	dailyCust: number;
	avgTicket: number;
	daysPerWeek: number;
	monthlyRent: number;
	concept: string;
	/** Optional tier-aware label for coffee concepts */
	tierLabel?: string;
}): RevenueProjection | null {
	const { dailyCust, avgTicket, daysPerWeek, monthlyRent, concept, tierLabel } = params;
	if (dailyCust <= 0 || avgTicket <= 0) return null;

	const ramp = UTILIZATION_RAMP[concept] ?? UTILIZATION_RAMP['default'];
	const baseRevenue = dailyCust * avgTicket * daysPerWeek * 52;

	const yr1 = Math.round(baseRevenue * ramp[0]);
	const yr2 = Math.round(baseRevenue * ramp[1]);
	const yr3 = Math.round(baseRevenue * ramp[2]);

	const maxRentPct = MAX_RENT_PCT[concept] ?? MAX_RENT_PCT['default'];
	const annualRent  = monthlyRent * 12;
	const rentToYr1   = yr1 > 0 ? (annualRent / yr1) * 100 : 0;
	const rentKill    = rentToYr1 > maxRentPct;
	const rentKillMsg = rentKill
		? `Rent is ${Math.round(rentToYr1)}% of Yr1 revenue — above the ${maxRentPct}% threshold for ${conceptLabel(concept, tierLabel)}. Negotiate rent or increase daily volume.`
		: '';

	return {
		yr1, yr2, yr3,
		yr1Width: Math.round((yr1 / yr3) * 100),
		yr2Width: Math.round((yr2 / yr3) * 100),
		yr3Width: 100,
		rentKill,
		rentKillMsg,
	};
}

// ── Function 4: Dashboard Headline State Machine (Screen 10) ──────────────────
/**
 * 5 states based on journey position.
 * State 0: no score yet
 * State 1: scored, Vision still PRELIM
 * State 2: scored + Vision complete, no Business Case
 * State 3: scored + Business Case + active kill factor
 * State 4: scored + Business Case + clean
 */
export function getDashboardHeadline(params: {
	hasScore: boolean;
	visionIsPrelim: boolean;
	hasBusinessCase: boolean;
	hasKillFactor: boolean;
	killFactorName?: string;
	// Real data for factual sub-lines
	locationCount?: number;
	bestFitIQ?: number;
	bestLocationIQ?: number;
	breakEvenMonth?: number | null;
}): DashboardHeadline {
	const {
		hasScore, visionIsPrelim, hasBusinessCase, hasKillFactor, killFactorName,
		locationCount = 0, bestFitIQ = 0, bestLocationIQ = 0, breakEvenMonth = null,
	} = params;

	if (!hasScore) return {
		state: 0,
		text: 'Score your first NYC location.',
		sub: 'Drop an address to see Location IQ, Fit IQ, and what the data says about your concept.',
	};

	const locStr = locationCount === 1 ? '1 location scored' : `${locationCount} locations scored`;
	const fitStr = bestFitIQ > 0 ? `Best Fit IQ: ${Math.round(bestFitIQ)}` : null;
	const liqStr = bestLocationIQ > 0 ? `Location IQ: ${Math.round(bestLocationIQ)}` : null;

	if (visionIsPrelim) return {
		state: 1,
		text: 'Strong start. Now complete your Vision IQ.',
		sub: [locStr, liqStr, 'Complete Vision IQ to sharpen Fit IQ.'].filter(Boolean).join(' · '),
	};

	if (!hasBusinessCase) return {
		state: 2,
		text: 'Ready to build your Business Case.',
		sub: [locStr, fitStr, liqStr, 'Run the Business Case to see your financial path.'].filter(Boolean).join(' · '),
	};

	if (hasKillFactor) return {
		state: 3,
		text: `Kill factor flagged${killFactorName ? `: ${killFactorName}` : ''}. Here's how to fix it.`,
		sub: [locStr, fitStr, 'One signal is working against you — review recommendations below.'].filter(Boolean).join(' · '),
	};

	// State 4: factual sub-line — real numbers, no generic copy
	const bePart = breakEvenMonth != null
		? `Strongest candidate breaks even Month ${breakEvenMonth}.`
		: 'Add your business case inputs to see break-even timing.';
	const sub4 = [locStr, fitStr, bePart].filter(Boolean).join(' · ');

	return {
		state: 4,
		text: 'Your plan is taking shape.',
		sub: sub4,
	};
}

// ── Function 5: Today's Insight (Screen 10) ───────────────────────────────────
/**
 * 2-sentence actionable coaching card for the dashboard.
 * Priority hierarchy (from wireframe):
 *   1. Active kill factor — name it + fix it
 *   2. Vision IQ incomplete — which specific fields remain
 *   3. Sub-score below 60 — what it means + what to look for
 *   4. General concept coaching from CONCEPT_KPIS.coaching
 *
 * Reads from decision-engine output + coaching object.
 * Max 2 sentences. No hedging. Actionable only.
 */
export function getTodaysInsight(params: {
	decisionState: DecisionState;
	coaching: ConceptCoaching | null;
	visionIsPrelim: boolean;
	visionCompletionPct: number;
	sixScores: Record<string, number>;
	fitSubScores: Record<string, number>;
	concept: string;
	locationIQ: number;
	fitIQ: number;
	/** Optional tier-aware label for coffee concepts */
	tierLabel?: string;
}): TodaysInsight {
	const {
		decisionState, coaching, visionIsPrelim, visionCompletionPct,
		sixScores, fitSubScores, concept, locationIQ, fitIQ, tierLabel,
	} = params;

	// Priority 1: active kill factor from coaching
	if (coaching?.activeRisks?.length) {
		const risk = coaching.activeRisks[0];
		return {
			text: `${risk} Fix this before signing a lease.`,
			priority: 'kill',
			color: 'red',
		};
	}

	// Priority 1b: decision state is do_not_pursue or high_risk with a specific reason
	if (decisionState.state === 'do_not_pursue' && decisionState.reasons.length) {
		return {
			text: `This location has a fundamental mismatch: ${decisionState.reasons[0].toLowerCase()}. ${decisionState.action}`,
			priority: 'kill',
			color: 'red',
		};
	}

	// Priority 2: Vision IQ still preliminary
	if (visionIsPrelim) {
		const pct = Math.round(visionCompletionPct);
		return {
			text: `Your Vision IQ is ${pct}% complete — it's still marked PRELIM, which caps your Fit IQ score. Add your differentiators and target customer profile to unlock the full score.`,
			priority: 'vision',
			color: 'amber',
		};
	}

	// Priority 3: worst sub-score below 60
	const subScoreMap: Record<string, string> = {
		transit:      'Transit score is low',
		demographics: 'Demographic fit is weak',
		competition:  'Competition density is high',
		safety:       'Safety score is a concern',
		vibrancy:     'Area vibrancy is limited',
		survivalRate: 'Business survival rate is below average',
	};

	let worstKey   = '';
	let worstScore = 60;
	for (const [k, v] of Object.entries(sixScores)) {
		if (v > 0 && v < worstScore && subScoreMap[k]) {
			worstScore = v;
			worstKey   = k;
		}
	}

	if (worstKey) {
		const label = subScoreMap[worstKey];
		const fixes: Record<string, string> = {
			transit:      'Look for blocks within 3 minutes of a subway entrance — transit proximity is the single biggest foot traffic driver.',
			demographics: 'Check if your target customer income band matches the area median — a $25 avg ticket needs $75K+ HHI nearby.',
			competition:  'Map which competitors are direct vs. adjacent — a crowded block with no exact match still has room.',
			safety:       'Corner locations with good lighting and daytime anchor businesses offset low safety scores significantly.',
			vibrancy:     'Check weekend vs. weekday foot traffic split — a quiet vibrancy score may just reflect an office-dominant block.',
			survivalRate: 'Model your break-even at 60% of projected revenue — if you can survive on that, the survival rate risk is manageable.',
		};
		return {
			text: `${label} for this block (${worstScore}/100). ${fixes[worstKey] || 'Review the signal detail for specific improvement levers.'}`,
			priority: 'signal',
			color: 'amber',
		};
	}

	// Priority 4: concept coaching from decision engine
	if (decisionState.reasons.length) {
		const positiveReasons = decisionState.reasons.filter(r =>
			decisionState.state === 'strong_go' || decisionState.state === 'go_with_refinements'
		);
		if (positiveReasons.length) {
			return {
				text: `${positiveReasons[0]}. ${decisionState.action}`,
				priority: 'coaching',
				color: 'green',
			};
		}
		return {
			text: `${decisionState.reasons[0]}. ${decisionState.action}`,
			priority: 'coaching',
			color: decisionState.color === 'green' ? 'green' : 'amber',
		};
	}

	// Fallback: generic coaching based on scores
	const cLabel = conceptLabel(concept, tierLabel);
	if (fitIQ >= 70 && locationIQ >= 70) {
		return {
			text: `Strong signals across the board for ${cLabel} here. The next step is stress-testing your unit economics in the Business Case.`,
			priority: 'coaching',
			color: 'green',
		};
	}

	return {
		text: `${locationIQ >= 60 ? 'The location fundamentals are in range' : 'The location needs more examination'} for ${cLabel}. Run the Business Case to see if the numbers support a lease decision here.`,
		priority: 'coaching',
		color: locationIQ >= 60 ? 'amber' : 'red',
	};
}
