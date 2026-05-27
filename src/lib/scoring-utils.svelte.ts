/**
 * RE² Scoring Utilities — Canonical Score Computation
 * ──────────────────────────────────────────────────────────────────────────
 * Single source of truth for locationIQ / fitIQ / visionIQ calculation.
 *
 * WHY THIS EXISTS:
 *   handleScoresReady() on the LIQ page used to read Svelte $derived values
 *   (fitIQ, visionIQ) when writing to localStorage. Those $derived values are
 *   state-reactive and can hold stale values even after await tick() when
 *   multiple state writes are batched. The result: Dashboard reads scores that
 *   differ from what the LIQ rings display.
 *
 *   This utility computes canonical scores as pure functions — no reactive
 *   state, no Svelte context required. Both handleScoresReady() (write path)
 *   and the Dashboard (read/display path) must use getCanonicalScores() to
 *   guarantee consistent numbers everywhere.
 *
 * BRAIN-NEW-02 fix (April 7 2026): Created to resolve all-3-score discrepancy.
 * BR-08: Upgraded to P0 because Location IQ, Fit IQ, and Vision IQ all differ.
 */

// BR-M (April 11, 2026): Rule 3 Fit IQ kill-factor consumer.
import { rule3RevPerSFFloor } from '$lib/intel/vital-rules';
// B2-1.1: canonical kill/caution cutoffs
import { SIGNAL_KILL_FLOOR, SIGNAL_CAUTION_FLOOR } from '$lib/constants/scoring-thresholds';

export interface ScoringResult {
	compassComposite: number;
	fitScore?: number | null;         // server-side Fit IQ (pre-vision-adj)
	serverVisionIQ?: number | null;   // DB-calibrated Vision IQ for this block × concept
}

export interface LaunchpadData {
	financialGoals?: {
		monthlyRentBudget?: number;
	};
	founderProfile?: {
		riskTolerance?: string;
		creditScoreBand?: string;
	};
	differentiator?: string;
	visionStatement?: string;
}

export interface SixScores {
	demographics?: number;
	safety?: number;
	transit?: number;
	vibrancy?: number;
	competition?: number;
	momentum?: number;
	[key: string]: number | undefined;
}

export interface CanonicalScores {
	locationIQ: number;
	fitIQ: number;
	visionIQ: number;
}

/**
 * Compute the founder alignment modifier from launchpad profile data.
 * Mirrors the founderMod logic inside the fitIQ $derived block (±8 points).
 * Range: -6 to +7
 */
export function computeFounderMod(sixScores: SixScores, launchpad: LaunchpadData): number {
	let mod = 0;

	// Capital fit (±4 points)
	const rent = launchpad?.financialGoals?.monthlyRentBudget;
	if (rent && sixScores.demographics) {
		if (rent >= 15000 && sixScores.demographics >= 65) mod += 3;
		else if (rent < 8000 && sixScores.demographics >= 80) mod -= 3;
		else mod += 1;
	}

	// Risk match (±3 points)
	const risk = launchpad?.founderProfile?.riskTolerance;
	if (risk && sixScores.safety) {
		if (risk === 'conservative' && sixScores.safety < 55) mod -= 3;
		else if (risk === 'aggressive' && sixScores.safety < 55) mod += 2;
		else mod += 1;
	}

	// Concept clarity bonus (+2 points)
	if (launchpad?.differentiator && launchpad?.visionStatement) mod += 2;
	else if (launchpad?.differentiator || launchpad?.visionStatement) mod += 1;

	return mod;
}

/**
 * 04.22.2026 Deprecating: getCanonicalScores — client-side Fit IQ derivation.
 *
 * This function used a rogue formula:
 *   base = fitScore || locationIQ * 0.75
 *   fitIQ = base + visionAdj + founderMod
 *
 * This differs from the canonical server formula in bundle-builder.ts:
 *   fitIQ = Math.round(locationIQ * 0.60 + visionIQ * 0.40)
 *
 * The 0.75x fallback, the ±10pt visionAdj, and the founderMod adjustments
 * are all rogue client-side operations that cause Dashboard vs Location
 * score drift.
 *
 * Replacement: getCanonicalScores now trusts the server's fitScore directly.
 * If fitScore is not available (legacy data), it falls back to locationIQ
 * until the user triggers a re-score.
 */
/* 04.22.2026 Deprecated: getCanonicalScores — rogue 0.75x + visionAdj + founderMod formula
export function getCanonicalScores_deprecated(
	result: ScoringResult,
	sixScores: SixScores,
	launchpad: LaunchpadData
): CanonicalScores {
	const locationIQ = result.compassComposite ?? 0;
	const visionIQ = (result.serverVisionIQ && result.serverVisionIQ > 0)
		? result.serverVisionIQ
		: 50;
	const base = (result.fitScore && result.fitScore > 0)
		? result.fitScore
		: Math.round(locationIQ * 0.75);
	const visionAdj = visionIQ > 0
		? Math.round((visionIQ - 50) * 0.20)
		: -8;
	const founderMod = computeFounderMod(sixScores, launchpad);
	const fitIQ = Math.max(0, Math.min(100, Math.round(base + visionAdj + founderMod)));
	return { locationIQ, fitIQ, visionIQ };
}
*/

/**
 * getCanonicalScores — trusts server-persisted Fit IQ.
 *
 * The canonical Fit IQ formula lives in $lib/intel/scoring/bundle-builder.ts
 * (computeCanonicalFitIQ: Math.round(locationIQ * 0.60 + visionIQ * 0.40)).
 *
 * This function reads the server-provided fitScore and visionIQ from the
 * scoring result and passes them through without modification.
 *
 * @param result      Raw API scoring result
 * @param _sixScores  (unused — preserved for call-site compatibility)
 * @param _launchpad  (unused — preserved for call-site compatibility)
 */
export function getCanonicalScores(
	result: ScoringResult,
	_sixScores: SixScores,
	_launchpad: LaunchpadData
): CanonicalScores {
	const locationIQ = result.compassComposite ?? 0;

	// Vision IQ: trust server value; neutral 50 fallback if missing
	const visionIQ = (result.serverVisionIQ && result.serverVisionIQ > 0)
		? result.serverVisionIQ
		: 50;

	// Fit IQ: trust server-computed fitScore (from computeCanonicalFitIQ).
	// 04.22.2026: Strict mode — if fitScore is missing (legacy data), return 0
	// instead of silently substituting locationIQ. The UI must show "—" or
	// a "Re-score" badge for legacy locations, not a mislabeled block score.
	const fitIQ = (result.fitScore && result.fitScore > 0)
		? result.fitScore
		: 0;

	return { locationIQ, fitIQ, visionIQ };
}

/**
 * Kill-factor classification for a scoring signal.
 * Used by Watch-for section and BR-05 verdict engine.
 */
export type SignalFlag = 'kill' | 'caution' | 'ok';

export function classifySignal(score: number): SignalFlag {
	// B2-1.1: thresholds from canonical constant for traceability
	if (score < SIGNAL_KILL_FLOOR)    return 'kill';
	if (score < SIGNAL_CAUTION_FLOOR) return 'caution';
	return 'ok';
}

export interface KillFactor {
	signal: string;
	value: number;
	threshold: number;
	flag: SignalFlag;
	label: string;
	recommendation: string;
}

const SIGNAL_META: Record<string, { label: string; killRec: string; cautionRec: string }> = {
	demographics: {
		label: 'Customer Fit',
		killRec: 'This area may lack your core customer base. Consider higher-traffic neighborhoods or pivot to a more accessible price point.',
		cautionRec: 'Customer density is marginal. Validate foot traffic before committing.',
	},
	vibrancy:  {
		label: 'Concept Pulse',
		killRec: 'Very little activity inside your concept\u2019s trade area. You\u2019ll need to pull people in instead of catching passers-by — factor in destination marketing.',
		cautionRec: 'Your trade-area ring is quiet. Plan for destination marketing or bookings to compensate for thin walk-by energy.',
	},
	transit:   {
		label: 'Accessibility',
		killRec: 'Poor transit access will cap your addressable market significantly.',
		cautionRec: 'Limited transit. Parking availability and local density become critical.',
	},
	competition: {
		label: 'Competition',
		killRec: 'Extreme competition density — existing players are entrenched. Requires clear differentiation.',
		cautionRec: 'Competitive market. Your differentiator needs to be sharp and visible from the street.',
	},
	market_proof: {
		label: 'Market Proof',
		killRec: 'No evidence of successful similar businesses nearby. First-mover risk is high.',
		cautionRec: 'Limited comparable business success in the area. Proceed with caution.',
	},
	safety: {
		label: 'Safety',
		killRec: 'Safety concerns will deter customers and elevate insurance/security costs.',
		cautionRec: 'Safety score is below average. Evaluate specific block conditions before committing.',
	},
	momentum: {
		label: 'Momentum',
		killRec: 'Area is declining. New entrants face headwinds from shrinking foot traffic.',
		cautionRec: 'Flat growth signals. Look for evidence of near-term development plans.',
	},
};

/**
 * Extract kill-factor flags from six scores.
 * BR-06: Formalizes thresholds used by Watch-for section and verdict engine.
 * NOTE: Named computeKillFactors to avoid collision with conceptKPIs.getKillFactors.
 */
export function computeKillFactors(sixScores: SixScores): KillFactor[] {
	const flags: KillFactor[] = [];
	for (const [key, meta] of Object.entries(SIGNAL_META)) {
		const score = sixScores[key];
		if (score == null) continue;
		const flag = classifySignal(score);
		if (flag === 'ok') continue;
		const threshold = flag === 'kill' ? 40 : 55;
		flags.push({
			signal: key,
			value: score,
			threshold,
			flag,
			label: meta.label,
			recommendation: flag === 'kill' ? meta.killRec : meta.cautionRec,
		});
	}
	return flags.sort((a, b) => a.value - b.value); // worst first
}

/**
 * BR-M: Rule 3 (Revenue-per-SF Floor) kill-factor surface.
 *
 * Opt-in helper — callers that have `businessType` in scope push the result
 * onto their existing `killFactors[]` array alongside the six-scores signals.
 * Location IQ still caps at 35 in `location-iq.ts` (per Kalpna's Q1 ruling);
 * the BC P&L gate in `business-case-store.svelte.ts` emits the matching FLAG.
 * Triple-visible on purpose: LIQ cap + Fit IQ kill-factor + BC validation.
 *
 * Returns null when Rule 3 passes or when no benchmark exists for the concept.
 */
export function rule3KillFactor(businessType: string): KillFactor | null {
	const res = rule3RevPerSFFloor({ businessType, concept: businessType });
	if (res.passes) return null;

	const implied = (res.data.impliedRevPerSF as number) ?? 0;
	const floor = (res.data.floor as number) ?? 150;
	// Severity = 'caution' per Kalpna's spec — not a hard kill because the
	// founder can still pivot footprint or ticket, but Watch-for must show it.
	return {
		signal: 'rev_per_sf_floor',
		value: implied,
		threshold: floor,
		flag: 'caution',
		label: 'Revenue-per-SF Floor',
		recommendation: `Implied $${implied}/SF is below the $${floor}/SF floor for this concept. Consider a smaller footprint, a higher ticket, or a more dense trade area.`,
	};
}

/**
 * BR-05: Deterministic verdict engine.
 * Returns a concise 1-sentence verdict string for Dashboard + LIQ Co-Pilot.
 */
export function getVerdict(
	scores: CanonicalScores,
	sixScores: SixScores
): string {
	const { fitIQ } = scores;
	const flags = computeKillFactors(sixScores);
	const killFactors = flags.filter(f => f.flag === 'kill');
	const cautionFactors = flags.filter(f => f.flag === 'caution');

	if (fitIQ >= 80) {
		// Find best signal (highest score)
		const best = Object.entries(sixScores)
			.filter(([, v]) => v != null && (v as number) > 0)
			.sort(([, a], [, b]) => (b as number) - (a as number))[0];
		const bestLabel = best ? (SIGNAL_META[best[0]]?.label || best[0]) : 'location signals';
		return `Strong fit. ${bestLabel} is the standout driver for this concept.`;
	}

	if (fitIQ >= 60) {
		if (cautionFactors.length > 0) {
			return `Viable with adjustments. Watch ${cautionFactors[0].label.toLowerCase()} — it's the key variable.`;
		}
		return 'Viable location with minor trade-offs. Address the Watch signals before committing.';
	}

	// fitIQ < 60
	if (killFactors.length > 0) {
		return `Significant headwinds. ${killFactors[0].label} is a structural concern — review the Watch section.`;
	}
	return 'Below-average fit. Multiple signals need improvement before this location works for your concept.';
}
