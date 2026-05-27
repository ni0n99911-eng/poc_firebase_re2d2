/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RE² TERMINOLOGY STANDARD — L6
 *
 * User-facing score labels (Score Harmonization — unified April 2026):
 *
 *   "Your Score"      — the single unified score founders see (internally: fitIQ)
 *   "Block Score"     — block/neighbourhood quality (internally: locationIQ)
 *   "Concept Detail"  — concept specificity measure (internally: visionIQ)
 *
 * NEVER use in user-facing copy:
 *   ✗ "Fit IQ", "Location IQ", "Vision IQ" — retired terminology
 *   ✗ "Fit Score", "Location Score", "Vision Score"
 *
 * Internal variable names (code only — these don't appear in templates):
 *   fitIQ, locationIQ, visionIQ  (camelCase, no spaces — fine in TS/Svelte logic)
 *
 * UX thread: reference this map when writing all labels, tooltips, and copy.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * RE² Decision Engine — Logic Thread L3
 *
 * Converts a Fit Score + supporting signals into a structured decision state.
 * Replaces the one-liner fitVerdict() with a rich, actionable output.
 *
 * Five states, each with:
 *   - state key (machine-readable)
 *   - headline (1 bold line — the verdict)
 *   - summary (1–2 sentences — what this means practically)
 *   - action (1 CTA — what to do next)
 *   - reasons[] (2–4 specific signals that drove the state)
 *
 * Used by: location/+page.svelte (Zone 1 hero), welcome-back recap, dashboard shortlist
 *
 * Rule: no changes to scoring weights or sub-score calculations here.
 * This layer reads scores and produces human-readable interpretation only.
 */

export type DecisionStateKey =
	| 'strong_go'
	| 'go_with_refinements'
	| 'worth_testing'
	| 'high_risk'
	| 'do_not_pursue';

export interface DecisionState {
	state: DecisionStateKey;
	/** Short, bold verdict label — shown prominently in UI */
	headline: string;
	/** 1–2 sentence plain-English interpretation of what this score means */
	summary: string;
	/** Single recommended next action for the founder */
	action: string;
	/** 2–4 specific signals that drove this state — concept + location aware */
	reasons: string[];
	/** Colour token for UX — green | blue | amber | orange | red */
	color: 'green' | 'blue' | 'amber' | 'orange' | 'red';
}

// ── Score thresholds ──────────────────────────────────────────────────────────

const THRESHOLDS = {
	STRONG_GO:           75,
	GO_WITH_REFINEMENTS: 65,
	WORTH_TESTING:       50,
	HIGH_RISK:           40,
	// below 40 → do_not_pursue
};

// ── Concept display names (mirrors CONCEPT_LABELS on location page) ───────────

const CONCEPT_DISPLAY: Record<string, string> = {
	specialty_coffee:        'coffee shop',
	bakery:                  'bakery',
	fast_casual:             'fast casual restaurant',
	qsr:                     'quick-service restaurant',
	full_service_restaurant: 'full-service restaurant',
	fine_dining:             'fine dining restaurant',
	bar_nightlife:           'bar / nightlife venue',
	fitness_studio:          'fitness studio',
	retail:                  'retail store',
	coworking:               'coworking space',
	medical_office:          'medical office',
	personal_services:       'personal services business',
	wellness_spa:            'spa / wellness studio',
	juice_bar:               'juice bar',
	florist:                 'florist',
	wellness_beverage:       'wellness beverage concept',
};

function conceptLabel(bizType: string): string {
	return CONCEPT_DISPLAY[bizType] || bizType.replace(/_/g, ' ');
}

// ── Signal interpretation helpers ─────────────────────────────────────────────
function signalLabel(key: string, val: number, ctx?: { competitorCount?: number }): string {
	// C-11/B3-F1: Use canonical thresholds — same as evidenceCopy().
	const HIGH = val >= EVIDENCE_COPY.high;  // 70
	const MED  = val >= EVIDENCE_COPY.med;   // 55
	switch (key) {
		case 'transit':
			return HIGH ? 'strong transit access' : MED ? 'adequate transit access' : 'limited transit access';
		case 'demographics':
			return HIGH ? 'demographics align with your target customer' : MED ? 'demographic fit is moderate' : 'demographic mismatch for this concept';
		case 'competition':
			// BL-B10: Zero competitors → score 40 (unproven market), NOT "high competition."
			if (ctx?.competitorCount === 0) return 'unproven market — no established competition yet';
			return HIGH ? 'low competition density — room to own this block' : MED ? 'moderate competition' : 'high competition density';
		case 'safety':
			return HIGH ? 'strong safety profile' : MED ? 'average safety' : 'safety concerns on this block';
		case 'vibrancy':
		case 'vibrancy_index':
			return HIGH ? 'busy concept pulse — your trade-area ring is humming' : MED ? 'steady concept pulse in your trade area' : 'quiet concept pulse — your ring is calm, plan for destination marketing';
		case 'momentum':
			return HIGH ? 'neighborhood is growing — rising demand' : MED ? 'stable neighborhood' : 'neighborhood is declining';
		case 'survivalRate':
		case 'survival_rate':
			// EF-5 (April 11): Survival unit collapse. Founder-facing copy never
			// prints the 0-100 index — it's confusing next to the raw % we show
			// in the Business Case tab. Tier-only language here.
			return HIGH
				? 'strong business survival track record on this block'
				: val < 50
				? 'above-average business turnover on this block — meaningful risk'
				: 'business survival in line with the NYC average for this block type';
		default:
			return '';
	}
}

// Pick the 2–4 most relevant signals given the scores and direction (positive or negative)
function pickReasons(
	fitIQ: number,
	sixScores: Record<string, number>,
	fitSubScores: Record<string, number>,
	bizType: string,
	visionIsPrelim: boolean,
	direction: 'strengths' | 'risks' | 'mixed'
): string[] {
	const reasons: string[] = [];

	const s = {
		transit:      sixScores['transit']      || 0,
		demographics: sixScores['demographics'] || fitSubScores['demographics'] || 0,
		competition:  sixScores['competition']  || fitSubScores['competition']  || 0,
		safety:       sixScores['safety']       || 0,
		vibrancy:     sixScores['vibrancy']     || sixScores['vibrancy_index'] || 0,
		momentum:     sixScores['momentum']     || 0,
		survivalRate: sixScores['survivalRate'] || sixScores['survival_rate']  || 0,
	};

	// BL-B10: Extract competitor count for context-aware labels
	const competitorCount = fitSubScores['competitor_count'] ?? (s.competition === 40 ? 0 : undefined);
	const signalCtx = { competitorCount };

	if (direction === 'strengths' || direction === 'mixed') {
		// Surface the highest-scoring signals
		const ranked = Object.entries(s)
			.filter(([, v]) => v >= 65)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 2);
		for (const [key, val] of ranked) {
			const label = signalLabel(key, val, signalCtx);
			if (label) reasons.push(label.charAt(0).toUpperCase() + label.slice(1) + '.');
		}
	}

	if (direction === 'risks' || direction === 'mixed') {
		// Surface the weakest signals
		const weak = Object.entries(s)
			.filter(([, v]) => v > 0 && v < 50)
			.sort(([, a], [, b]) => a - b)
			.slice(0, 2);
		for (const [key, val] of weak) {
			const label = signalLabel(key, val, signalCtx);
			if (label) reasons.push(label.charAt(0).toUpperCase() + label.slice(1) + '.');
		}
	}

	// Vision preliminary notice
	if (visionIsPrelim && reasons.length < 3) {
		reasons.push('Vision score is preliminary — add concept details to sharpen this result.');
	}

	// Concept-specific fills if still light
	if (reasons.length < 2) {
		const mkt = fitSubScores['market_proof'] || 0;
		const acc = fitSubScores['accessibility'] || 0;
		if (mkt >= 60) reasons.push(`Market proof ${mkt} — similar ${conceptLabel(bizType)}s show strong survival on this block.`);
		else if (acc >= 65) reasons.push(`Accessibility ${acc} — easy to reach for walk-in customers.`);
		else {
			// BR-3: if no signals resolved, don't show a confusing "0 signals" message.
			// The score computed from block-level data — detailed signals sharpen on next load.
			const resolvedCount = Object.values(s).filter(v => v > 0).length;
			// BRAIN-BR-05: surface action-oriented text — this is the Today's Insight fallback on Dashboard
			if (resolvedCount > 0) {
				reasons.push(`${resolvedCount} location signal${resolvedCount !== 1 ? 's' : ''} scored. Complete your concept profile to unlock a personalised action plan.`);
			} else {
				// All signals zero — likely cache-only. Tell the user what to do.
				reasons.push('Re-score this address to pull fresh block-level data and unlock your personalised action plan.');
			}
		}
	}

	return reasons.slice(0, 4);
}

// ── L4: Score interpretation ──────────────────────────────────────────────────

export interface ScoreInterpretation {
	/** Plain-English band name: "Strong Path zone", "Viable zone", etc. (BR-1 vocabulary) */
	bandName: string;
	/** Score range for this band: e.g. "65–74" */
	bandRange: string;
	/** Points to next band (0 if already at top) */
	gapToNext: number;
	/** Name of the next band */
	nextBandName: string | null;
	/** The single lever most likely to move the score — concept or location */
	primaryLever: 'concept' | 'location' | 'both' | null;
	/** Plain-English description of what the primary lever means */
	leverCopy: string;
	/** Full interpretation sentence — "A score of X means..." */
	interpretation: string;
}

/**
 * L4: getScoreInterpretation
 *
 * Translates a raw Fit Score into:
 * - which band it sits in and the range
 * - how far to the next band
 * - which lever (concept vs location) has more room to move
 * - a full plain-English interpretation sentence
 */
export function getScoreInterpretation(
	fitIQ: number,
	locationIQ: number,
	visionIQ: number,
	bizType: string
): ScoreInterpretation {
	const concept = conceptLabel(bizType);

	if (fitIQ === 0) {
		return {
			bandName: 'Pending',
			bandRange: '—',
			gapToNext: 0,
			nextBandName: null,
			primaryLever: null,
			leverCopy: '',
			interpretation: 'Score pending — analyzing this location.',
		};
	}

	// Determine band
	let bandName: string;
	let bandRange: string;
	let gapToNext: number;
	let nextBandName: string | null;

	if (fitIQ >= 75) {
		bandName = 'Strong Path zone';
		bandRange = '75–100';
		gapToNext = 0;
		nextBandName = null;
	} else if (fitIQ >= 65) {
		bandName = 'Viable zone';
		bandRange = '65–74';
		gapToNext = 75 - fitIQ;
		nextBandName = 'Strong Path';
	} else if (fitIQ >= 50) {
		bandName = 'Tight zone';
		bandRange = '50–64';
		gapToNext = 65 - fitIQ;
		nextBandName = 'Viable';
	} else if (fitIQ >= 40) {
		bandName = 'Stretch zone';
		bandRange = '40–49';
		gapToNext = 50 - fitIQ;
		nextBandName = 'Tight';
	} else {
		bandName = 'Rethink zone';
		bandRange = '0–39';
		gapToNext = 40 - fitIQ;
		nextBandName = 'Stretch';
	}

	// Identify primary lever: which score has more room to improve?
	// Location IQ is harder to change (it's the block), Vision IQ is the concept lever
	const locGap  = Math.max(0, 80 - locationIQ);  // loc ceiling ~80 for a great block
	const visGap  = Math.max(0, 85 - visionIQ);    // vis ceiling ~85 when fully filled
	const bothLow = locationIQ < 55 && visionIQ < 55;

	let primaryLever: ScoreInterpretation['primaryLever'];
	let leverCopy: string;

	if (bothLow) {
		primaryLever = 'both';
		leverCopy = `Both your location signals and concept details have room to improve. Start with your concept details — they're faster to move.`;
	} else if (visionIQ < 60 && visionIQ > 0) {
		primaryLever = 'concept';
		const visPoints = Math.round((85 - visionIQ) * 0.35); // rough fit contribution
		leverCopy = `Your concept details (${visionIQ}) are the main lever here. Filling in your concept details could add ~${visPoints} points to your score.`;
	} else if (locationIQ < 58 && locationIQ > 0) {
		primaryLever = 'location';
		leverCopy = `The location itself is the constraint. A stronger block for a ${concept} could move this score significantly — try comparing nearby addresses.`;
	} else if (visGap > locGap) {
		primaryLever = 'concept';
		leverCopy = `Your concept details have more room than the location. Sharpening your concept profile is the fastest path to a higher score.`;
	} else {
		primaryLever = 'location';
		leverCopy = `The location signals are the binding constraint. Comparing nearby blocks would show whether a stronger address is available.`;
	}

	// Full interpretation sentence
	let interpretation: string;
	if (fitIQ >= 75) {
		interpretation = `A score of ${fitIQ} means the fundamentals are strong. This concept-location pairing is in the top tier — the block works and the concept signals back it up.`;
	} else if (fitIQ >= 65) {
		interpretation = `A score of ${fitIQ} is promising but not yet high-confidence. You're ${gapToNext} point${gapToNext === 1 ? '' : 's'} away from Strong Path — some signals are working, others need attention.`;
	} else if (fitIQ >= 50) {
		interpretation = `A score of ${fitIQ} means this version of the plan has potential but significant gaps. It's not ready to act on — but the right refinements could move it ${gapToNext} points into Go territory.`;
	} else if (fitIQ >= 40) {
		interpretation = `A score of ${fitIQ} is a warning sign. The concept-location pairing has meaningful friction that will show up in your P&L. This needs work before it's worth committing to.`;
	} else {
		interpretation = `A score of ${fitIQ} means the fundamentals are misaligned. This is a diagnosis, not a judgment — the concept, the block, or both need to change before this becomes a viable plan.`;
	}

	return {
		bandName,
		bandRange,
		gapToNext,
		nextBandName,
		primaryLever,
		leverCopy,
		interpretation,
	};
}

import { CONCEPT_KPIS } from '$lib/constants/conceptKPIs';
import { tierFor } from '$lib/intel/tiers';
import { EVIDENCE_COPY, DIRECTION_THRESHOLDS, SIGNAL_KILL_FLOOR, SIGNAL_CAUTION_FLOOR, KILL_FACTOR_THRESHOLDS } from '$lib/constants/scoring-thresholds';

// Re-export concept signals for convenience — consumers can import from decision-engine
export { getConceptSignals, getWhyStrip, type RenderedSignal, type SignalStatus, type LocationDataBag } from './concept-signals';

// ── L5: Evidence payload ──────────────────────────────────────────────────────

/**
 * §1c (April 11): EvidenceItem category — render grouping for UX-FIX-7.
 *
 * Groups evidence by the mental model UX wants to present on "How to gain
 * points": block/location signals vs. concept (vision) signals vs. money
 * (financials) vs. operational levers. UX sorts and renders a section
 * header per category in the top-3 + expander list.
 */
export type EvidenceCategory = 'location' | 'vision' | 'financials' | 'operations';

/**
 * A single evidence signal — one data point that is either helping or hurting.
 */
export interface EvidenceItem {
	/** Machine key for the signal (transit, demographics, etc.) */
	key: string;
	/** Display label */
	label: string;
	/** Raw score 0–100 */
	value: number;
	/** Direction of this signal relative to what the concept needs */
	direction: 'positive' | 'negative' | 'neutral';
	/**
	 * changeability: can the founder do anything about this?
	 * - fixed    = the block / neighborhood — not changeable without moving
	 * - flexible = concept details / positioning — founder can change this
	 */
	changeability: 'fixed' | 'flexible';
	/** Plain-English one-liner describing what this signal means for this concept */
	copy: string;
	/** §1c: Render category for grouped display in "How to gain points" */
	category: EvidenceCategory;
}

export interface EvidencePayload {
	/** Signals working in the founder's favour (direction: positive) */
	helping: EvidenceItem[];
	/** Signals working against (direction: negative) */
	hurting: EvidenceItem[];
	/** Everything that CAN be changed by adjusting concept/positioning */
	canChange: EvidenceItem[];
	/** Everything the founder has to live with (the block is the block) */
	cannotChange: EvidenceItem[];
}

/** Label map for display */
const SIGNAL_LABELS: Record<string, string> = {
	transit:      'Transit access',
	demographics: 'Demographics',
	competition:  'Competition density',
	safety:       'Safety profile',
	vibrancy:     'Area vibrancy',
	momentum:     'Neighbourhood momentum',
	survivalRate: 'Year-1 business survival',
	visionScore:  'Concept detail',
	marketProof:  'Market proof',
};

/** Which signals are under the founder's control vs. fixed to the block */
const CHANGEABILITY: Record<string, 'fixed' | 'flexible'> = {
	transit:      'fixed',
	demographics: 'fixed',
	competition:  'fixed',    // block-level — adjusting concept can partially offset
	safety:       'fixed',
	vibrancy:     'fixed',
	momentum:     'fixed',
	survivalRate: 'fixed',
	visionScore:  'flexible', // founder fills this in
	marketProof:  'flexible', // concept choice + positioning
};

/**
 * §1c (April 11): Render category map for UX-FIX-7 grouped display.
 *
 * Categories match the UX-log proposal — they mirror the mental model the
 * founder uses: block/location quality, concept (vision), financial viability,
 * and operational levers. If a new signal is added to SIGNAL_LABELS, add it
 * here too or it will fall through to 'location' by default.
 */
const CATEGORY: Record<string, EvidenceCategory> = {
	transit:      'location',
	demographics: 'location',
	competition:  'location',
	safety:       'location',
	vibrancy:     'location',
	momentum:     'location',
	survivalRate: 'financials',
	visionScore:  'vision',
	marketProof:  'vision',
};

/** Generate copy for a specific signal score, concept-aware */
function evidenceCopy(key: string, value: number, concept: string, ctx?: { competitorCount?: number }): string {
	// C-08: thresholds extracted to scoring-thresholds.ts EVIDENCE_COPY.
	// ⚠ MISALIGNMENT: EVIDENCE_COPY.med (55) ≠ DIRECTION_THRESHOLDS.negative (50).
	// BL-B2 RESOLVED: Bands fully consistent (>=70 HIGH+positive, 50-69 MED+neutral, <50 LOW+negative).
	const HIGH = value >= EVIDENCE_COPY.high;
	const MED  = value >= EVIDENCE_COPY.med;
	switch (key) {
		case 'transit':
			return HIGH
				? `Strong transit coverage — your target customer can reach this block easily.`
				: MED
				? `Moderate transit access — some customers will find this convenient, others won't.`
				: `Limited transit access — capturing walk-in traffic will take extra marketing effort.`;
		case 'demographics':
			return HIGH
				? `Demographics align with your price point and target customer profile.`
				: MED
				? `Demographic fit is moderate — income and density are workable but not ideal.`
				: `Demographic mismatch — the neighbourhood profile doesn't fit a ${concept} at your target price point.`;
		case 'competition':
			// BL-B10: Zero competitors = unproven market, not high competition
			if (ctx?.competitorCount === 0) {
				return `Unproven market — no direct ${concept} competitors found nearby. This means untested demand rather than validated foot traffic.`;
			}
			return HIGH
				? `Low competition density — this block doesn't yet have a strong ${concept} player.`
				: MED
				? `Moderate competition — there are existing players, but differentiation should be achievable.`
				: `High competition density — you'd be entering a crowded market on this block.`;
		case 'safety':
			return HIGH
				? `Strong safety profile — this shouldn't deter your target customer.`
				: MED
				? `Average safety — unlikely to be a deciding factor for most customers.`
				: `Safety concerns on this block — could affect footfall quality and conversion.`;
		case 'vibrancy':
		case 'vibrancy_index': {
			// RC4 (April 11): Concept-aware vibrancy language.
			// Coffee cares about morning commute density, not all-day pulse.
			const isCoffee = /coffee|café|cafe/i.test(concept);
			const isRestaurant = /restaurant|dining|food|bar|pub|tavern/i.test(concept);
			if (isCoffee) {
				return HIGH
					? `Strong morning rush momentum — high commuter density feeds walk-in demand before 10 AM.`
					: MED
					? `Moderate morning foot traffic — some commuter flow, but you'll supplement with regulars and destination visits.`
					: `Low morning rush energy — this block won't hand you commuters. Plan for destination marketing and a loyal-regular model.`;
			}
			if (isRestaurant) {
				return HIGH
					? `Busy peak-hour foot traffic — the block is active during lunch and dinner windows.`
					: MED
					? `Moderate foot traffic at peak hours — enough passersby to supplement reservations, but not enough to rely on walk-ins alone.`
					: `Quiet during peak hours — this location will depend on reservations and reputation rather than foot traffic.`;
			}
			return HIGH
				? `Busy trade-area ring — the block is humming with activity, handing you walk-by traffic.`
				: MED
				? `Steady foot traffic — normal commercial life in your ring; you'll neither ride the block nor fight it.`
				: `Quiet trade area — this location will depend on destination marketing, bookings, or a standout storefront rather than walk-by energy.`;
		}
		case 'momentum':
			return HIGH
				? `Neighbourhood is growing — you'd be opening into rising demand, not fighting decline.`
				: MED
				? `Stable neighbourhood — not declining, but not generating tail-winds either.`
				: `Neighbourhood is declining — this adds execution risk beyond the concept itself.`;
		case 'survivalRate':
		case 'survival_rate':
			// EF-5 (April 11): Survival unit collapse. Never emit the 0-100 index
			// in founder copy — the raw % lives in the Business Case tab. Tier
			// language only. The raw % + peer comparison is the canonical view.
			return HIGH
				? `Strong business survival track record — similar businesses on this block have an above-average chance of making it past year 1.`
				: value < 50
				? `Above-average business turnover here — this is a meaningful risk signal to weigh against your fit.`
				: `Business survival in line with the NYC average for this block type.`;
		case 'visionScore':
			return HIGH
				? `Your concept details are well-defined — your concept details are contributing meaningfully to your score.`
				: MED
				? `Concept detail is partially filled — adding more concept detail will sharpen your score.`
				: `Concept detail is thin — filling in concept details could add 8–14 points to your score.`;
		case 'marketProof':
			return HIGH
				? `Strong market proof — similar ${concept}s show a track record of surviving on this block.`
				: MED
				? `Moderate market proof — some precedent for this concept in this area.`
				: `Weak market proof — limited evidence that a ${concept} has worked in this immediate area.`;
		default:
			return `${key} score: ${value}`;
	}
}

/**
 * L5: getEvidencePayload
 *
 * Splits all available signals into helping/hurting buckets and
 * fixed/flexible buckets. Replaces the flat whyBullets array with
 * a structured payload that the UX layer can render as a split panel.
 *
 * Rules:
 * - direction: positive ≥ 70, negative < 50, neutral 50–69 (DIRECTION_THRESHOLDS)
 * - Only include signals where we actually have a value (> 0)
 * - Sort helping descending (best first), hurting ascending (worst first)
 * - Vision IQ only included if visionIQ > 0 (has been scored)
 */
export function getEvidencePayload(
	fitIQ: number,
	locationIQ: number,
	visionIQ: number,
	sixScores: Record<string, number>,
	fitSubScores: Record<string, number>,
	bizType: string,
	visionIsPrelim: boolean
): EvidencePayload {
	const concept = conceptLabel(bizType);

	// Gather raw signals — prefer sixScores, fall back to fitSubScores
	const rawSignals: Array<{ key: string; value: number }> = [
		{ key: 'transit',      value: sixScores['transit']      || 0 },
		{ key: 'demographics', value: sixScores['demographics'] || fitSubScores['demographics'] || 0 },
		{ key: 'competition',  value: sixScores['competition']  || fitSubScores['competition']  || 0 },
		{ key: 'safety',       value: sixScores['safety']       || 0 },
		{ key: 'vibrancy',     value: sixScores['vibrancy']     || sixScores['vibrancy_index']  || 0 },
		{ key: 'momentum',     value: sixScores['momentum']     || 0 },
		{ key: 'survivalRate', value: sixScores['survivalRate'] || sixScores['survival_rate']   || 0 },
		{ key: 'marketProof',  value: fitSubScores['market_proof'] || 0 },
	];

	// EF-2 (April 11): Narrative confidence guard.
	// When Vision is preliminary (user hasn't filled concept details yet), the visionScore
	// evidence copy was emitting the HIGH-branch "Your concept details are well-defined"
	// string — a hallucination that contradicts the PRELIM badge on the score. Inject a
	// dedicated "add Vision to sharpen" notice instead so the copy matches reality.
	if (visionIsPrelim) {
		rawSignals.push({ key: '__visionPrelim', value: 1 });
	} else if (visionIQ > 0) {
		rawSignals.push({ key: 'visionScore', value: visionIQ });
	}

	// BL-B10: Extract competitor count for context-aware copy
	const compScore = sixScores['competition'] || fitSubScores['competition'] || 0;
	const competitorCount = fitSubScores['competitor_count'] ?? (compScore === 40 ? 0 : undefined);
	const evidenceCtx = { competitorCount };

	// Build EvidenceItems for signals with data
	const items: EvidenceItem[] = rawSignals
		.filter(s => s.value > 0)
		.map(s => {
			if (s.key === '__visionPrelim') {
				return {
					key:           'visionScore',
					label:         SIGNAL_LABELS['visionScore'] || 'Concept detail',
					value:         0,
					direction:     'neutral' as const,
					changeability: 'flexible' as const,
					copy:          `We're scoring without your concept details. Add them to sharpen this by ~8 points.`,
					category:      'vision' as const,
				};
			}
			// RC5 (April 11): Align with evidenceCopy's HIGH >= 70. The 65-69 band
			// was producing "positive" direction (Working For You column) with
			// "moderate/not ideal" copy — a contradiction surface.
			// C-08: thresholds extracted to scoring-thresholds.ts DIRECTION_THRESHOLDS.
			// ⚠ MISALIGNMENT: DIRECTION_THRESHOLDS.negative (50) ≠ EVIDENCE_COPY.med (55).
			// BL-B2 RESOLVED: Bands fully aligned.
			const direction: EvidenceItem['direction'] =
				s.value >= DIRECTION_THRESHOLDS.positive ? 'positive'
				: s.value < DIRECTION_THRESHOLDS.negative ? 'negative'
				: 'neutral';
			return {
				key:           s.key,
				label:         SIGNAL_LABELS[s.key] || s.key,
				value:         s.value,
				direction,
				changeability: CHANGEABILITY[s.key] || 'fixed',
				copy:          evidenceCopy(s.key, s.value, concept, evidenceCtx),
				category:      CATEGORY[s.key] || 'location',
			};
		});

	// RC7 (April 11) + C-07: Competition ↔ Market Proof mutual exclusion.
	// Both derive from the same upstream fact (same-concept business count).
	// Low count → high competition score (positive) AND low marketProof (negative),
	// guaranteeing a mirror contradiction. Keep only the stronger signal.
	// C-07: Zero competitors get special handling — replace with neutral "unproven market".
	const compItem  = items.find(i => i.key === 'competition');
	const mpItem    = items.find(i => i.key === 'marketProof');
	const rc7Drop = new Set<string>();
	if (competitorCount === 0) {
		// C-07: Zero competitors — replace competition with neutral unproven-market item,
		// drop marketProof (can't have market proof with 0 competitors)
		if (compItem) rc7Drop.add('competition');
		if (mpItem) rc7Drop.add('marketProof');
		// Add explicit unproven-market evidence item
		if (!mpItem || mpItem.value === 0) {
			items.push({
				key: 'competition', label: SIGNAL_LABELS['competition'] || 'Competition density',
				value: 0, direction: 'neutral' as const, changeability: 'fixed' as const,
				copy: `No direct ${concept} competitors found nearby — this is an untested market. Validate demand before committing.`,
				category: 'location' as const,
			});
		}
	} else if (compItem && mpItem && compItem.direction !== mpItem.direction) {
		// They're in opposing columns — drop the weaker signal
		const compStrength = Math.abs(compItem.value - 60);  // distance from midpoint
		const mpStrength   = Math.abs(mpItem.value - 60);
		rc7Drop.add(compStrength >= mpStrength ? 'marketProof' : 'competition');
	}
	const filtered = rc7Drop.size > 0 ? items.filter(i => !rc7Drop.has(i.key)) : items;

	const helping     = filtered.filter(i => i.direction === 'positive').sort((a, b) => b.value - a.value);
	const hurting     = filtered.filter(i => i.direction === 'negative').sort((a, b) => a.value - b.value);
	const canChange   = filtered.filter(i => i.changeability === 'flexible');
	const cannotChange = filtered.filter(i => i.changeability === 'fixed');

	return { helping, hurting, canChange, cannotChange };
}

// ── L8: Concept-specific coaching ─────────────────────────────────────────────

export interface ConceptCoaching {
	/** Short title: what this coaching block is for */
	title: string;
	/** Kill factors from the KPI framework that appear to be active for this score profile */
	activeRisks: string[];
	/** Concrete next steps specific to concept + weak signals */
	nextSteps: string[];
	/** Revenue model context: what drives money for this concept type */
	revenueContext: string;
}

/** Revenue model plain-English context per concept type */
const REVENUE_MODEL_CONTEXT: Record<string, string> = {
	volume:       'Revenue is driven by daily transaction volume — foot traffic is the primary lever.',
	mrr:          'Revenue is driven by monthly memberships — first-month acquisition and retention matter more than walk-by traffic.',
	utilization:  'Revenue is driven by slot or space utilization — peak-hour density and accessibility are key.',
	sqft:         'Revenue is driven by rent-per-sqft economics — location prestige and tenant mix matter.',
	event_plus:   'Revenue is driven by event bookings plus daily walk-in — vibrancy and visibility are equally important.',
	peak_weighted:'Revenue is concentrated in peak nights — late-night energy, transit, and weekend foot traffic matter most.',
};

/**
 * Scan kill factor strings for keywords that match known signal weaknesses.
 * Returns kill factors that are likely active given current scores.
 */
function matchActiveRisks(
	killFactors: string[],
	scores: {
		transit: number;
		competition: number;
		demographics: number;
		safety: number;
		vibrancy: number;
		visionIQ: number;
	}
): string[] {
	const active: string[] = [];
	for (const kf of killFactors) {
		const lower = kf.toLowerCase();
		// Foot traffic / transit signals
		if ((lower.includes('foot traffic') || lower.includes('commuter') || lower.includes('transit'))
			&& scores.transit < 55) {
			active.push(kf);
		}
		// Competition signals
		else if ((lower.includes('competitor') || lower.includes('competition') || lower.includes('competing'))
			&& scores.competition < 55) {
			active.push(kf);
		}
		// Concept / differentiation signals
		else if ((lower.includes('distinguishing') || lower.includes('differentiation') || lower.includes('beyond'))
			&& scores.visionIQ > 0 && scores.visionIQ < 60) {
			active.push(kf);
		}
		// Demographics
		else if ((lower.includes('income') || lower.includes('demographic') || lower.includes('customer'))
			&& scores.demographics < 50) {
			active.push(kf);
		}
		// Safety
		else if (lower.includes('safety') && scores.safety < 50) {
			active.push(kf);
		}
		if (active.length >= 2) break; // cap at 2 active risks per concept
	}
	return active;
}

/**
 * L8: getConceptCoaching
 *
 * Produces concept-aware coaching: which kill factors are active, what to do next,
 * and the revenue model context for this concept type.
 *
 * Designed to appear below the evidence panel — adds the "what this concept specifically
 * needs from a location" layer that the generic evidence panel can't provide.
 */
export function getConceptCoaching(
	fitIQ: number,
	locationIQ: number,
	visionIQ: number,
	sixScores: Record<string, number>,
	fitSubScores: Record<string, number>,
	bizType: string
): ConceptCoaching | null {
	// Skip if score is 0 (still loading) or concept not found
	if (fitIQ === 0) return null;
	const kpi = CONCEPT_KPIS[bizType];
	if (!kpi) return null;

	const concept = conceptLabel(bizType);

	// Extract signal scores
	const sig = {
		transit:      sixScores['transit']      || 0,
		competition:  sixScores['competition']  || fitSubScores['competition']  || 0,
		demographics: sixScores['demographics'] || fitSubScores['demographics'] || 0,
		safety:       sixScores['safety']       || 0,
		vibrancy:     sixScores['vibrancy']     || sixScores['vibrancy_index']  || 0,
		visionIQ,
	};

	// Active kill factor risks
	const activeRisks = matchActiveRisks(kpi.killFactors || [], sig);

	// Concept-specific next steps based on what's weak
	const nextSteps: string[] = [];

	if (visionIQ > 0 && visionIQ < 60) {
		nextSteps.push(`Sharpen your concept details — "what makes yours different" is the fastest way to add points.`);
	}

	if (sig.transit < 55 && sig.transit > 0) {
		const footModel = kpi.revenueModel === 'mrr' || kpi.revenueModel === 'utilization'
			? `Transit access matters less for a ${concept} than for walk-in concepts, but check whether your target customer can reach this block.`
			: `This block lacks the foot traffic density a ${concept} typically needs — compare a busier nearby address.`;
		nextSteps.push(footModel);
	}

	if (sig.competition < 55 && sig.competition > 0) {
		// BL-B10: distinguish 0-count (unproven) from crowded (high competition)
		if (sig.competition === 40) {
			nextSteps.push(`No direct ${concept} competitors found nearby — this is an untested market. Validate demand before committing to a lease.`);
		} else {
			nextSteps.push(`Strong competitive pressure on this block — your differentiator needs to be specific enough to give customers a clear reason to choose you over existing ${concept}s.`);
		}
	}

	if (sig.demographics < 50 && sig.demographics > 0) {
		nextSteps.push(`The demographic profile here may not match your target customer's income or density expectations for a ${concept}.`);
	}

	if (locationIQ >= 65 && fitIQ < 55 && visionIQ < 55) {
		nextSteps.push(`The location is solid — your score is being dragged down by incomplete concept details. Fill in your concept details to unlock the block's potential.`);
	}

	// Always include at least one next step
	if (nextSteps.length === 0) {
		if (fitIQ >= 75) {
			nextSteps.push(`The fundamentals are strong for a ${concept}. Build your financial model to stress-test the revenue assumptions.`);
		} else {
			nextSteps.push(`Review the signals above and focus on the weakest one first — each point of improvement in a key signal can move your score by 2–5 points.`);
		}
	}

	// Revenue model context
	const revenueContext = REVENUE_MODEL_CONTEXT[kpi.revenueModel]
		?? 'Revenue model context not available for this concept type.';

	return {
		title: `${kpi.label} — what this concept needs`,
		activeRisks,
		nextSteps: nextSteps.slice(0, 3),
		revenueContext,
	};
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Convert a Fit Score into a full decision state with headline, summary,
 * action, and signal-driven reasons.
 *
 * @param fitIQ        - Fit Score (0–100)
 * @param locationIQ   - Location Score (0–100)
 * @param visionIQ     - Vision Score (0–100)
 * @param sixScores    - Raw sub-scores from the compass engine
 * @param fitSubScores - Fit IQ sub-scores
 * @param bizType      - Canonical concept key
 * @param visionIsPrelim - Whether Vision IQ is still incomplete
 */
export function getDecisionState(
	fitIQ: number,
	locationIQ: number,
	visionIQ: number,
	sixScores: Record<string, number>,
	fitSubScores: Record<string, number>,
	bizType: string,
	visionIsPrelim: boolean
): DecisionState {
	const concept = conceptLabel(bizType);

	if (fitIQ === 0) {
		return {
			state: 'worth_testing',
			headline: 'Analyzing...',
			summary: 'Scoring this location — this usually takes 10–20 seconds.',
			action: 'Wait for your score',
			reasons: [],
			color: 'amber',
		};
	}

	// ── Strong Path (75+) ─────────────────────────────────────────────────────
	if (fitIQ >= THRESHOLDS.STRONG_GO) {
		return {
			state: 'strong_go',
			headline: 'Strong Path',
			summary: `A score of ${fitIQ} means this concept-location pairing has strong fundamentals. The block works for a ${concept} and the signals back it up.`,
			action: 'Build your financial case →',
			reasons: pickReasons(fitIQ, sixScores, fitSubScores, bizType, visionIsPrelim, 'strengths'),
			color: 'green',
		};
	}

	// ── Viable (65–74) ──────────────────────────────────────────────────────
	if (fitIQ >= THRESHOLDS.GO_WITH_REFINEMENTS) {
		const lowVision = visionIQ > 0 && visionIQ < 60;
		const summary = lowVision
			? `A score of ${fitIQ} is promising. The location is solid — your concept details need sharpening to push this into high-confidence territory.`
			: `A score of ${fitIQ} is promising for a ${concept}. The fundamentals are working but there are a few signals worth addressing before committing.`;
		return {
			state: 'go_with_refinements',
			headline: 'Viable',
			summary,
			action: lowVision ? 'Sharpen your concept details →' : 'Review what needs work →',
			reasons: pickReasons(fitIQ, sixScores, fitSubScores, bizType, visionIsPrelim, 'mixed'),
			color: 'blue',
		};
	}

	// ── Tight (50–64) ────────────────────────────────────────────────────────
	if (fitIQ >= THRESHOLDS.WORTH_TESTING) {
		const highLoc = locationIQ >= 65;
		const summary = highLoc
			? `A score of ${fitIQ} suggests the location itself is strong, but the concept-location pairing needs work. Sharpening your concept angle or adjusting positioning could move this significantly.`
			: `A score of ${fitIQ} means this version isn't yet strong enough to act on with confidence. The block has potential, but key signals need improvement before this becomes a clear opportunity.`;
		return {
			state: 'worth_testing',
			headline: 'Tight',
			summary,
			action: 'See what to improve →',
			reasons: pickReasons(fitIQ, sixScores, fitSubScores, bizType, visionIsPrelim, 'mixed'),
			color: 'amber',
		};
	}

	// ── Stretch (40–49) ──────────────────────────────────────────────────────
	if (fitIQ >= THRESHOLDS.HIGH_RISK) {
		return {
			state: 'high_risk',
			headline: 'Stretch',
			summary: `A score of ${fitIQ} means significant gaps exist between this location and your concept. This version of the plan has meaningful risk. Consider adjusting your concept, price point, or exploring other blocks.`,
			action: 'Try a different block or refine your concept →',
			reasons: pickReasons(fitIQ, sixScores, fitSubScores, bizType, visionIsPrelim, 'risks'),
			color: 'orange',
		};
	}

	// ── Rethink (<40) ────────────────────────────────────────────────────────
	return {
		state: 'do_not_pursue',
		headline: 'Rethink',
		summary: `A score of ${fitIQ} indicates serious misalignment between this location and this concept. This is not a signal to give up — it's a diagnosis. The concept or the block, or both, need to change.`,
		action: 'Explore a different location →',
		reasons: pickReasons(fitIQ, sixScores, fitSubScores, bizType, visionIsPrelim, 'risks'),
		color: 'red',
	};
}

// ── Canonical block quality label (BR-5 spec) ────────────────────────────────
// EF-4 (April 11): Both of these now delegate to `tierFor()` in
// src/lib/intel/tiers.ts — the single source of truth for tier vocabulary.
// They are kept as named exports because dozens of call sites import them,
// but the label math lives in `tierFor` from now on.
// <50 = '' (no label — call site uses 'Developing' fallback)
export function blockTierLabel(locationIQ: number): string {
	if (locationIQ < 50) return '';
	return tierFor(locationIQ, 'locationIQ').label;
}

// ── Canonical Fit IQ verdict label (BR-1 unified vocabulary) ─────────────────
// FIX-025: These are the ONLY verdict labels allowed anywhere in the codebase.
// EF-4 (April 11): now delegates to `tierFor(fitIQ, 'fitIQ').label`.
export function fitTierLabel(fitIQ: number): string {
	return tierFor(fitIQ, 'fitIQ').label;
}

// ── Canonical letter grade (BR-UX-05) ────────────────────────────────────────
// One-to-one map with fitTierLabel thresholds. Single source of truth.
// Strong Path (≥75) = A, Viable (≥65) = B, Tight (≥50) = C, Stretch (≥40) = D, Rethink (<40) = F
export type FitGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export function fitGrade(fitIQ: number): FitGrade {
	if (fitIQ >= 75) return 'A';
	if (fitIQ >= 65) return 'B';
	if (fitIQ >= 50) return 'C';
	if (fitIQ >= 40) return 'D';
	return 'F';
}

/**
 * D11: Grade cap by critical risk signals.
 *
 * A Fit IQ of 75 ordinarily earns grade A, but if the location has a KILL-level
 * safety/competition/demographics signal or below-average 1Y survival, A is
 * misleading — the score overweights strong foot traffic while critical risks
 * go unflagged. Apply the cap anywhere the grade is displayed prominently
 * (hero card, dashboard cards, report).
 *
 * Caps:
 *   • Any KILL factor (any six-score < SIGNAL_KILL_FLOOR=40): max grade = C
 *   • Any CAUTION factor (any six-score < SIGNAL_CAUTION_FLOOR=55): max grade = B
 *   • Below-avg 1Y survival (< 45%): max grade = B
 * The cap is the WORSE of baseGrade and the ceiling.
 */
export function fitGradeCapped(
	fitIQ: number,
	sixScores?: Record<string, number | undefined>,
	survivalRatePct?: number
): FitGrade {
	const base = fitGrade(fitIQ);
	const order: FitGrade[] = ['A', 'B', 'C', 'D', 'F'];
	let cap: FitGrade = 'A';

	if (sixScores) {
		let hasKill = false;
		let hasCaution = false;
		for (const key of ['transit', 'safety', 'demographics', 'competition', 'vibrancy', 'momentum']) {
			const v = sixScores[key];
			if (typeof v !== 'number' || v <= 0) continue;
			if (v < SIGNAL_KILL_FLOOR) hasKill = true;
			else if (v < SIGNAL_CAUTION_FLOOR) hasCaution = true;
		}
		if (hasKill) cap = 'C';
		else if (hasCaution) cap = 'B';
	}
	if (typeof survivalRatePct === 'number' && survivalRatePct > 0 && survivalRatePct < 45) {
		// NYC avg is ~52% — below 45% is a real concern
		if (order.indexOf(cap) < order.indexOf('B')) cap = 'B';
	}

	// Return the WORSE (higher-index) of base and cap
	return order.indexOf(base) > order.indexOf(cap) ? base : cap;
}

/**
 * B3-1.5 (D11 tightened): Critical-risk cap with explicit reason.
 *
 * Per Brain 3 spec: if safety ≤ 35 OR survivalRatePct ≤ 40, cap letterGrade
 * at 'B' and verdict at 'Viable' regardless of Fit IQ. Returns the capped
 * values plus a human-readable reason that UX can render below the grade.
 *
 * Example: 200 Smith St (Brooklyn) scored Fit IQ 75 (Strong Path/A) despite
 * Safety 30 (WEAK) and Year-1 survival 39% (below avg). Founders would
 * over-trust the A. This cap drops grade → B, verdict → Viable, and surfaces
 * the underlying risk via capReason.
 *
 * This is layered on top of fitGradeCapped (the looser D11 cap used in
 * dashboard comparisons) — callers who want the reason use this helper.
 */
export function fitGradeCappedWithReason(
	fitIQ: number,
	opts: { safety?: number; survivalRatePct?: number }
): { grade: FitGrade; verdict: string; capReason: string | null } {
	const base = fitGrade(fitIQ);
	const baseVerdict = fitTierLabel(fitIQ);
	const safety = opts.safety;
	const survival = opts.survivalRatePct;
	const order: FitGrade[] = ['A', 'B', 'C', 'D', 'F'];

	// Use Brain 2 canonical thresholds: KILL_FACTOR_THRESHOLDS.safety=30, .survival=40
	const triggers: string[] = [];
	if (typeof safety === 'number' && safety > 0 && safety <= KILL_FACTOR_THRESHOLDS.safety) {
		triggers.push(`Safety score ${Math.round(safety)} is below our trusted floor (${KILL_FACTOR_THRESHOLDS.safety})`);
	}
	if (typeof survival === 'number' && survival > 0 && survival <= KILL_FACTOR_THRESHOLDS.survival) {
		triggers.push(`1-year survival rate ${Math.round(survival)}% is below the NYC average for this concept`);
	}

	if (triggers.length === 0) {
		return { grade: base, verdict: baseVerdict, capReason: null };
	}

	// Apply cap: grade max B, verdict 'Viable'
	const cappedGrade: FitGrade = order.indexOf(base) >= order.indexOf('B') ? base : 'B';
	return {
		grade: cappedGrade,
		verdict: 'Viable',
		capReason: triggers.join(' • '),
	};
}

// ── Plain-language meaning copy (BR-UX-06 + UX-02/UX-03 ESL rewrite) ─────────
// Long form: used on the Location Score hero. Rendered after the tier label:
//   "{fitIQ}/100 — {tier}. {fitMeaning(fitIQ)}"
// So each variant MUST be a full sentence starting with a capital (no leading
// "means…" — that reads as a typo after the period).
// Plain English, ESL-friendly. No idioms. Second person.
// Edit here and every surface that imports it updates in lock-step.
//
// §1d (April 11): Emotional-register rewrite. fitMeaning now accepts an
// optional context object (watchOutCount, topLever) and acknowledges the
// founder is about to sign a lease. Every variant is second-person and ends
// with an action, not a description. The watchOutCount suffix renders
// "N things to address before signing — we'll show you all of them."
// which UX-FIX-6 asked for.
//
// Backwards compatible: ctx is optional. Old callers (`fitMeaning(fitIQ)`)
// still work and receive the plain no-context copy.
export interface FitMeaningContext {
	/** How many Watch Out items the Brain has flagged for this location. */
	watchOutCount?: number;
	/**
	 * The single biggest improvable lever (e.g. "your concept details",
	 * "pricing", "daypart fit"). If provided, appended as an action sentence.
	 */
	topLever?: string;
}

/** Format the watch-out suffix: "Two things to address before signing — we'll show you both." */
function _watchOutSuffix(count: number): string {
	if (!count || count <= 0) return '';
	const word =
		count === 1 ? 'One thing' :
		count === 2 ? 'Two things' :
		count === 3 ? 'Three things' :
		`${count} things`;
	// UX-NEW-6 (H6/R4): removed tease — Watch Out panel shows the actual concerns
	return ` ${word} to address before signing.`;
}

/** Format the top-lever suffix: "Start with your concept details." */
function _topLeverSuffix(lever: string | undefined): string {
	if (!lever) return '';
	return ` Start with ${lever}.`;
}

export function fitMeaning(fitIQ: number, ctx: FitMeaningContext = {}): string {
	const watchSuffix = _watchOutSuffix(ctx.watchOutCount ?? 0);
	const leverSuffix = _topLeverSuffix(ctx.topLever);
	// When we have a lever, it's a stronger signal than watchOutCount — prefer one or the other.
	const actionSuffix = leverSuffix || watchSuffix;

	if (fitIQ >= 75)
		return `You're on solid ground here. The block supports your concept and you have real upside — move carefully and you're in a strong position.${actionSuffix}`;
	if (fitIQ >= 65)
		return `This block works for you. You're in workable territory — improve one or two things and it becomes a strong match.${actionSuffix}`;
	if (fitIQ >= 50)
		return `This is workable but it won't run itself. Founders who succeed on blocks like this one get one important thing right before signing anything.${actionSuffix}`;
	if (fitIQ >= 40)
		return `You've got real gaps to close before this becomes safe. You can fix them, but you need a clear plan before the lease — not after.${actionSuffix}`;
	return `The signals on this block are working against your concept. Before you commit, look at other blocks — or change the concept to match what this block actually wants.${actionSuffix}`;
}

/**
 * §1d (April 11): Short one-sentence verdict for the hero, concept-aware.
 * Replaces the redundant "{fitIQ}/100 — {_fitLabel}." prefix with a single
 * sentence like "Workable coffee location." that reads as plain English.
 *
 * Derives the adjective from `tierFor(fitIQ, 'fitIQ').copy` so it stays
 * locked to the canonical tier vocabulary — no drift risk.
 */
export function fitVerdictShort(fitIQ: number, concept: string = 'location'): string {
	const copy = tierFor(fitIQ, 'fitIQ').copy;
	const adj = copy.charAt(0).toUpperCase() + copy.slice(1);
	// Rethink tier uses a different grammar — "weak coffee location" reads wrong,
	// prefer "Rethink this coffee location."
	if (fitIQ < 40) {
		return `Rethink this ${concept} location.`;
	}
	return `${adj} ${concept} location.`;
}

// Short form: used on compact surfaces (Dashboard tile, Business Case verdict banner).
// One sentence, no leading "means", no idioms.
export function fitMeaningShort(fitIQ: number): string {
	if (fitIQ >= 75) return 'Strong fundamentals. Ready to act.';
	if (fitIQ >= 65) return 'This works. Improve one or two things to make it strong.';
	if (fitIQ >= 50) return 'Workable. Focus on getting one important thing right.';
	if (fitIQ >= 40) return 'Real gaps. Fixable with a clear plan.';
	return 'Signals work against you. Look at other blocks.';
}

// ── Next-tier gap (BR-UX-01) ─────────────────────────────────────────────────
// Returns how many points (and which tier) the user needs to climb to reach
// the next verdict tier. Null if already at Strong Path (top tier).
// Single source of truth for the "X points from {tier}" hero CTA and "How? →" CoPilot prompt.
export interface FitNextTier {
	points: number; // integer gap to the next threshold
	label: string; // next tier label (matches fitTierLabel)
	threshold: number; // score threshold to cross
}

export function fitNextTier(fitIQ: number): FitNextTier | null {
	if (fitIQ >= 75) return null;
	if (fitIQ >= 65) return { points: 75 - fitIQ, label: 'Strong Path', threshold: 75 };
	if (fitIQ >= 50) return { points: 65 - fitIQ, label: 'Viable', threshold: 65 };
	if (fitIQ >= 40) return { points: 50 - fitIQ, label: 'Tight', threshold: 50 };
	return { points: 40 - fitIQ, label: 'Stretch', threshold: 40 };
}
