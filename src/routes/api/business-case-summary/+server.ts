/**
 * POST /api/business-case-summary
 *
 * DELTA-03/04/05/07: Returns structured BC data that UX reads directly.
 * UX must never compute survival numbers, kill factors, verdicts, or blockLabels —
 * it reads what this endpoint returns.
 *
 * Body:
 * {
 *   businessType: string,
 *   locationIQ: number,
 *   fitIQ?: number,
 *   visionIQ?: number,
 *   rent: number,                    // monthly rent $
 *   dailyCustomers?: number,
 *   avgCheck?: number,
 *   locationScores?: {               // for kill factor evaluation
 *     transit?: number,
 *     competition?: number,
 *     demographics?: number,
 *     safety?: number,
 *     vibrancy?: number,
 *   },
 *   creditScoreBand?: string,        // 'excellent'|'good'|'fair'|'building'|'unknown'
 *   poiCount?: number,               // for isPartialSeed
 * }
 *
 * Returns:
 * {
 *   cashToOpen, monthsOfRunway, breakEvenMonth: {optimistic, base, stressed}, cushionNeeded,
 *   killFactors: [{type, value, threshold, label}], killFactorCount, verdictOverride?,
 *   creditGateMessage, isPartialSeed, verdict, blockLabel
 * }
 */

import type { RequestHandler } from '@sveltejs/kit';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';
import { computeFinancialProjection } from '$lib/financial-projections';
import { CONCEPT_KPIS, getDoc09Intelligence, DOC09_OCCUPANCY_CEILINGS } from '$lib/constants/conceptKPIs';
// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
import { normalizeBusinessType } from '$lib/intel/registry/business-type-registry';
import { fitTierLabel, blockTierLabel } from '$lib/utils/decision-engine';
import { tierFor } from '$lib/intel/tiers';
/**
 * T1-B (2026-04-16): Import canonical kill factor thresholds.
 *
 * REASON: This file previously used hardcoded inline numbers for transit (45)
 * and competition (40) kill factor checks. These were 15–20 points higher than
 * the canonical thresholds defined in KILL_FACTOR_THRESHOLDS (transit=25,
 * competition=25), causing over-aggressive flagging:
 *   - Transit score 35: incorrectly flagged as a Business Case kill factor
 *   - Competition score 30: incorrectly flagged as a Business Case kill factor
 * This inflated killFactorCount, which could trigger verdictOverride on viable
 * locations — showing a serious-risk verdict when none was warranted.
 *
 * CHANGE: Both thresholds now read from KILL_FACTOR_THRESHOLDS so this file
 * stays in sync with heads-up-engine.ts and coffee-watch-outs.ts (already wired).
 *
 * VERIFIED: Full audit in
 *   C:\sandbox_re_squared\jared_prod\Change Log\T1B_kill_factor_audit_2026-04-16_18-14.md
 */
import { KILL_FACTOR_THRESHOLDS } from '$lib/constants/scoring-thresholds';

const PARTIAL_SEED_THRESHOLD = 10;

/** Map credit score band to a human-readable assessment message. */
function getCreditGateMessage(band: string | undefined): string {
	switch (band) {
		case 'excellent':
			return 'Excellent credit. Eligible for all SBA 7(a) lenders at preferred rates. Full lender list in Loan Einstein.';
		case 'good':
			return 'Good credit. Eligible for all SBA 7(a) lenders at standard rates. Full lender list in Loan Einstein.';
		case 'fair':
			return 'Fair credit. Some lenders available — CDFIs and SBA Micro Loan program are your best path. Consider credit-building steps to expand options.';
		case 'building':
			return 'Credit is building. Mission-driven lenders (Accion, CDFI programs) may still fund you. Personal credit improvement unlocks more options in 6–12 months.';
		default:
			return 'Credit profile not provided. Enter your credit score range in your founder profile to see lender options.';
	}
}

/** Compute structured kill factors from concept KPIs + live scores. */
function computeKillFactors(
	bizType: string,
	rent: number,
	annualRevenue: number,
	locationScores: { transit?: number; competition?: number; demographics?: number; safety?: number; vibrancy?: number; visionIQ?: number }
): Array<{ type: string; value: number; threshold: number; label: string }> {
	const kpi = CONCEPT_KPIS[bizType] ?? CONCEPT_KPIS.specialty_coffee;
	const factors: Array<{ type: string; value: number; threshold: number; label: string }> = [];

	// 1. Rent-to-revenue check
	if (annualRevenue > 0) {
		const rentPct = Math.round((rent * 12) / annualRevenue * 100);
		const threshold = kpi.maxRentPercent ?? 10;
		if (rentPct > threshold) {
			factors.push({
				type: 'rent',
				value: rentPct,
				threshold,
				label: `Rent ${rentPct}% of revenue — above ${threshold}% threshold`
			});
		}
	}

	// 2. Low transit / foot traffic
	// T1-B (2026-04-16): was hardcoded < 45 — over-flagged scores 26–44 as kill factors.
	// Canonical threshold is 25 (car-only access risk). Scores 26–44 are caution, not kill.
	if ((locationScores.transit ?? 100) < KILL_FACTOR_THRESHOLDS.transit) {
		factors.push({
			type: 'transit',
			value: locationScores.transit ?? 0,
			threshold: KILL_FACTOR_THRESHOLDS.transit,
			label: `Transit score ${locationScores.transit ?? 0} — below ${KILL_FACTOR_THRESHOLDS.transit} (car-only access risk)`
		});
	}

	// 3. Competition saturation
	// T1-B (2026-04-16): was hardcoded < 40 — over-flagged scores 26–39 as kill factors.
	// Canonical threshold is 25 (extreme saturation). Scores 26–39 are elevated but not structural kills.
	if ((locationScores.competition ?? 100) < KILL_FACTOR_THRESHOLDS.competition) {
		factors.push({
			type: 'competition',
			value: locationScores.competition ?? 0,
			threshold: KILL_FACTOR_THRESHOLDS.competition,
			label: `Competition score ${locationScores.competition ?? 0} — market is saturated for this concept`
		});
	}

	// 4. Weak concept differentiation (Vision IQ)
	if ((locationScores.visionIQ ?? 100) > 0 && (locationScores.visionIQ ?? 100) < 50) {
		factors.push({
			type: 'concept',
			value: locationScores.visionIQ ?? 0,
			threshold: 50,
			label: `Concept detail ${locationScores.visionIQ ?? 0} — differentiation is weak`
		});
	}

	// Cap at 3 for display
	return factors.slice(0, 3);
}

export const POST: RequestHandler = async ({ request }) => {
	const limited = rateLimit(request, RATE_LIMITS.intel);
	if (limited) return limited;

	let body: {
		businessType?: string;
		locationIQ?: number;
		fitIQ?: number;
		visionIQ?: number;
		rent?: number;
		dailyCustomers?: number;
		avgCheck?: number;
		locationScores?: { transit?: number; competition?: number; demographics?: number; safety?: number; vibrancy?: number };
		creditScoreBand?: string;
		poiCount?: number;
	};

	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400, headers: { 'Content-Type': 'application/json' }
		});
	}

	const {
		businessType = 'specialty_coffee',
		locationIQ = 50,
		fitIQ,
		visionIQ = 0,
		rent = 5000,
		dailyCustomers,
		avgCheck,
		locationScores = {},
		creditScoreBand,
		poiCount,
	} = body;

	const normalizedType = normalizeBusinessType(businessType);

	try {
		// Compute base financial projection
		const baseProjection = computeFinancialProjection(
			{ businessType: normalizedType, rent, dailyCustomers, avgTransaction: avgCheck },
			{ locationIQ, fitIQ }
		);

		// Compute optimistic scenario (+15% customers)
		const optimisticProjection = computeFinancialProjection(
			{ businessType: normalizedType, rent, dailyCustomers: Math.round((dailyCustomers ?? baseProjection.breakEven.currentDailyTransactions) * 1.15), avgTransaction: avgCheck },
			{ locationIQ, fitIQ }
		);

		// Compute stressed scenario (-15% customers)
		const stressedProjection = computeFinancialProjection(
			{ businessType: normalizedType, rent, dailyCustomers: Math.round((dailyCustomers ?? baseProjection.breakEven.currentDailyTransactions) * 0.85), avgTransaction: avgCheck },
			{ locationIQ, fitIQ }
		);

		const cashToOpen = Math.round(baseProjection.startupCostEstimate);

		// monthsOfRunway: how long startup capital lasts at current monthly burn (before revenue)
		const monthlyBurn = Math.max(1, baseProjection.monthlyPL.totalExpenses);
		const monthsOfRunway = Math.round(cashToOpen / monthlyBurn);

		// breakEvenMonth: months to recoup startup investment in each scenario
		const breakEvenMonth = {
			optimistic: Math.max(1, optimisticProjection.monthsToRecoupStartup),
			base: Math.max(1, baseProjection.monthsToRecoupStartup),
			stressed: stressedProjection.monthsToRecoupStartup > 60 ? 999 : Math.max(1, stressedProjection.monthsToRecoupStartup),
		};

		// cushionNeeded: additional capital if stressed scenario burns more than base startup cost
		const stressedBurn = stressedProjection.monthlyPL.totalExpenses - stressedProjection.monthlyPL.revenue;
		const cushionNeeded = stressedBurn > 0 ? Math.round(stressedBurn * 6) : 0; // 6-month buffer

		// Kill factors — DELTA-04
		const annualRevenue = baseProjection.annualRevenue;
		const killFactors = computeKillFactors(
			normalizedType,
			rent,
			annualRevenue,
			{ ...locationScores, visionIQ }
		);
		const killFactorCount = killFactors.length;
		// EF-4: use canonical tierFor — never hardcode tier labels.
		const verdictOverride: string | undefined = killFactorCount >= 2 ? tierFor(0, 'fitIQ').label : undefined;

		// Credit gate message — DELTA-05
		const creditGateMessage = getCreditGateMessage(creditScoreBand);

		// isPartialSeed — DELTA-07
		const isPartialSeed = (poiCount ?? PARTIAL_SEED_THRESHOLD) < PARTIAL_SEED_THRESHOLD;

		// Canonical verdict + blockLabel — DELTA-01/02
		const effectiveFitIQ = fitIQ ?? locationIQ;
		const verdict = verdictOverride ?? fitTierLabel(effectiveFitIQ);
		const blockLabel = blockTierLabel(locationIQ) || 'Developing Block';

		// ── Doc09 Intelligence Advisories ──────────────────────────────────────
		// Concept-specific financial reality checks from 100+ trade sources.
		const doc09Advisories: string[] = [];
		const doc09 = getDoc09Intelligence(normalizedType);
		if (doc09) {
			// Startup capital reality check
			const [minStartup] = doc09.startupCapitalRange;
			if (cashToOpen > 0 && cashToOpen < minStartup * 0.8) {
				doc09Advisories.push(
					`Industry data suggests ${doc09.label} typically needs $${(minStartup / 1000).toFixed(0)}K+ to open. Your estimate of $${(cashToOpen / 1000).toFixed(0)}K may be undercapitalized.`
				);
			}
			// Occupancy cost ceiling from Doc09
			const ceiling = DOC09_OCCUPANCY_CEILINGS[normalizedType];
			if (ceiling && annualRevenue > 0) {
				const actualOccPct = Math.round((rent * 12) / annualRevenue * 100);
				if (actualOccPct > ceiling.maxPct) {
					doc09Advisories.push(
						`Rent is ${actualOccPct}% of projected revenue — exceeds the ${ceiling.maxPct}% ceiling for this business type. ${ceiling.note}.`
					);
				}
			}
			// Break-even reality check
			if (doc09.breakEvenMonths) {
				const [beMin, beMax] = doc09.breakEvenMonths;
				if (breakEvenMonth.base < beMin) {
					doc09Advisories.push(
						`Your break-even estimate (${breakEvenMonth.base} months) is faster than industry typical (${beMin}–${beMax} months). Verify assumptions.`
					);
				}
			}
			// Failure rate context
			if (doc09.failureRates) {
				doc09Advisories.push(
					`Industry reality: ${doc09.failureRates.year1Pct}% close in Year 1, ~${doc09.failureRates.year3Pct}% by Year 3. #1 cause: ${doc09.failureRates.topCause}.`
				);
			}
			// Unanticipated costs warning
			if (doc09.unanticipatedCosts && doc09.unanticipatedCosts.length > 0) {
				const topCosts = doc09.unanticipatedCosts.slice(0, 3).map(c => `${c.item} (${c.amount})`).join(', ');
				doc09Advisories.push(
					`Hidden costs to budget for: ${topCosts}.`
				);
			}
		}

		return new Response(JSON.stringify({
			// DELTA-03: Survival numbers
			cashToOpen,
			monthsOfRunway,
			breakEvenMonth,
			cushionNeeded,
			// DELTA-04: Kill factors
			killFactors,
			killFactorCount,
			verdictOverride,
			// DELTA-05: Credit gate
			creditGateMessage,
			// DELTA-07: Partial seed
			isPartialSeed,
			// DELTA-01/02: Canonical labels
			verdict,
			blockLabel,
			// Supporting financials for BC page
			annualRevenue: Math.round(annualRevenue),
			monthlyRevenue: Math.round(baseProjection.monthlyPL.revenue),
			monthlyExpenses: Math.round(baseProjection.monthlyPL.totalExpenses),
			netMargin: baseProjection.monthlyPL.netMargin,
			// Doc09 intelligence advisories
			doc09Advisories,
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
		});

	} catch (e: unknown) {
		console.error('[BC Summary] Error:', e);
		return new Response(JSON.stringify({
			error: 'Internal error computing business case summary',
			message: e instanceof Error ? e.message : 'Unknown error'
		}), {
			status: 500, headers: { 'Content-Type': 'application/json' }
		});
	}
};
