/**
 * AUX-01: Location-based financial estimates
 *
 * When a user clicks "I don't know — estimate from my location," this module
 * derives financial inputs from their scored location data. Uses:
 *   - Median rent from PLUTO/rent analysis
 *   - Foot traffic → daily transactions estimate
 *   - Competition density → average ticket estimate
 *   - Business type → multipliers from concept defaults
 *
 * This replaces hardcoded concept defaults when location data is available,
 * giving users numbers grounded in their specific block group.
 */

import type { LaunchPadData } from '$lib/launchpad-store';
import { CONCEPT_UI_DEFAULTS } from '$lib/constants/conceptDefaults';

export interface LocationFinancialEstimate {
	startupCapital: number;
	monthlyRentBudget: number;
	squareFootage: number;
	revenueY1: number;
	avgTicket: number;
	teamSize: number;
	dailyTransactions: number;
	targetSDE: number;
	source: 'location' | 'concept_default';
	locationUsed?: string; // address of the scored location used
}

/**
 * Estimate financials from a scored location's data.
 *
 * @param conceptKey  Canonical concept key (e.g., 'specialty_coffee')
 * @param launchpad   Full launchpad data (contains scoredLocations)
 * @returns Location-grounded estimates, or null if no scored location available
 */
export function estimateFromLocation(
	conceptKey: string,
	launchpad: LaunchPadData & { scoredLocations?: any[] },
): LocationFinancialEstimate | null {
	const defaults = CONCEPT_UI_DEFAULTS[conceptKey];
	if (!defaults) return null;

	// Find the most recently scored location with data
	const locations = launchpad.scoredLocations || [];
	const scored = locations.find((loc: any) => loc.score > 0 || loc.fitScore > 0);
	if (!scored) return null;

	const sixScores = (scored as any).sixScores || {};
	const report = (scored as any).report || {};
	const rent = report.rentEstimate || report.pluto?.estimatedRent || null;
	const footTraffic = sixScores.transit || sixScores.vibrancy || 50;
	const competitionDensity = sixScores.competition || 50;

	// ── Rent: Use actual rent data if available ──────────────
	let monthlyRent = defaults.rent;
	if (rent && typeof rent === 'number' && rent > 0) {
		// rent is per sqft/year → convert to monthly for default sqft
		monthlyRent = Math.round((rent * defaults.sqft) / 12);
	}

	// ── Transactions: Scale from foot traffic score ──────────
	// High transit/vibrancy (80+) → 1.3x default transactions
	// Low traffic (< 40) → 0.7x default transactions
	const trafficMultiplier = 0.7 + (footTraffic / 100) * 0.6; // range 0.7–1.3
	const dailyTransactions = Math.round(defaults.transactions * trafficMultiplier);

	// ── Ticket: Adjust for competition density ──────────────
	// More competition (higher score) → slightly lower ticket (price pressure)
	// Less competition → can charge more (price power)
	const competitionMultiplier = 1.15 - (competitionDensity / 100) * 0.3; // range 0.85–1.15
	const avgTicket = Math.round(defaults.ticket * competitionMultiplier * 100) / 100;

	// ── Revenue: transactions × ticket × 365 ────────────────
	const revenueY1 = Math.round(dailyTransactions * avgTicket * 365);

	// ── SDE: Use default ratio ──────────────────────────────
	const sdeRatio = defaults.sde / defaults.revenue;
	const targetSDE = Math.round(revenueY1 * sdeRatio);

	return {
		startupCapital: defaults.startup, // keep concept default — hard to estimate from location
		monthlyRentBudget: monthlyRent,
		squareFootage: defaults.sqft,      // keep concept default
		revenueY1,
		avgTicket,
		teamSize: defaults.team,           // keep concept default
		dailyTransactions,
		targetSDE,
		source: 'location',
		locationUsed: scored.addr || scored.address || 'scored location',
	};
}
