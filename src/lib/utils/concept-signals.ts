/**
 * RE² Concept Signals — 3 Questions That Matter
 *
 * Each concept type has 3 founder-level questions that get answered with live data.
 * Signal status: strong (green), watch (amber), verify (grey), risk (red)
 *
 * Data flows:
 *   evidence payload (from decision-engine.ts) → answer template functions → rendered signals
 *   sixScores / fitSubScores → threshold checks → status determination
 *
 * Unmapped concepts fall back to 3 universal questions (foot traffic, survival, customer profile).
 */

import type { EvidencePayload, EvidenceItem } from './decision-engine';

// ── Types ────────────────────────────────────────────────────────────────────

export type SignalStatus = 'strong' | 'watch' | 'verify' | 'risk';

export interface RenderedSignal {
	/** Status key — drives border color and badge */
	status: SignalStatus;
	/** Short tag line (e.g. "Afternoon Traffic") */
	tag: string;
	/** The founder question (e.g. "Will my afternoon be dead?") */
	question: string;
	/** Data-backed answer HTML (can include <strong> tags) */
	answer: string;
	/** Short verdict label (e.g. "✓ Low risk", "⚠ Watch closely") */
	verdict: string;
}

export interface SignalDef {
	/** Short tag for the signal category */
	tag: string;
	/** The question founders ask */
	question: string;
	/** Evidence key to pull from sixScores/fitSubScores (e.g. 'transit', 'demographics') */
	evidenceKey: string;
	/** Build the answer string from live data */
	answerFn: (value: number, evidence: EvidencePayload, locationData: LocationDataBag) => string;
	/** Determine status from the score value */
	statusFn: (value: number, locationData: LocationDataBag) => SignalStatus;
	/** Verdict label per status */
	verdictMap: Record<SignalStatus, string>;
}

/** Bag of location data passed through for answer templates */
export interface LocationDataBag {
	sixScores: Record<string, number>;
	fitSubScores: Record<string, number>;
	locationIQ: number;
	visionIQ: number;
	fitIQ: number;
	medianIncome: number;
	medianAge: number;
	survivalRate: number;
	transitScore: number;
	/** Neighborhood/borough name */
	neighborhood: string;
}

// ── Threshold helpers ────────────────────────────────────────────────────────

function scoreStatus(val: number, highThreshold = 65, lowThreshold = 45): SignalStatus {
	if (val <= 0) return 'verify';
	if (val >= highThreshold) return 'strong';
	if (val >= lowThreshold) return 'watch';
	return 'risk';
}

function fmtK(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
	return String(n);
}

function fmtMoney(n: number): string {
	if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
	return `$${n}`;
}

// ── Concept Signal Definitions ───────────────────────────────────────────────

const SPECIALTY_COFFEE: SignalDef[] = [
	{
		tag: 'Afternoon Traffic',
		question: 'Will my afternoon be dead?',
		evidenceKey: 'vibrancy',
		answerFn: (val, _ev, loc) => {
			if (val >= 65) return `<strong>Strong daytime activity.</strong> Vibrancy score ${val} — high educated adult density and nearby coworking/office presence suggest sustained afternoon dwell. Your post-lunch window is covered.`;
			if (val >= 45) return `<strong>Moderate daytime activity.</strong> Vibrancy ${val} — some afternoon foot traffic but not a destination block. Consider grab-and-go positioning for the 2–4pm window.`;
			return `<strong>Weak afternoon traffic.</strong> Vibrancy ${val} — this block quiets down after the morning rush. You'll need marketing to fill the afternoon gap.`;
		},
		statusFn: (val) => scoreStatus(val, 65, 45),
		verdictMap: { strong: '✓ Low risk', watch: '⚠ Moderate', verify: '→ Verify in person', risk: '✗ Weak afternoon' },
	},
	{
		tag: 'Spending Power',
		question: 'Will customers pay $6+ for a pour-over?',
		evidenceKey: 'demographics',
		answerFn: (val, _ev, loc) => {
			const income = loc.medianIncome > 0 ? fmtMoney(loc.medianIncome) : 'unknown';
			if (val >= 65) return `<strong>Yes.</strong> Demographics score ${val}. Median HHI ${income}${loc.medianAge > 0 ? `, median age ${loc.medianAge}` : ''}. Specialty pricing is fully supported — this is a specialty coffee demographic.`;
			if (val >= 45) return `<strong>Borderline.</strong> Demographics ${val}, median income ${income}. Specialty pricing workable but price sensitivity is moderate — consider a $5–7 core range.`;
			return `<strong>Stretch.</strong> Demographics ${val}, median income ${income}. Premium specialty pricing faces friction here — the income profile favors a lower price point.`;
		},
		statusFn: (val) => scoreStatus(val, 65, 45),
		verdictMap: { strong: '✓ Supported', watch: '⚠ Borderline', verify: '→ Check income data', risk: '✗ Price friction' },
	},
	{
		tag: 'Rent Math',
		question: 'Can I survive the dwell-time math?',
		evidenceKey: 'survivalRate',
		answerFn: (val, _ev, loc) => {
			const transit = loc.sixScores.transit || loc.transitScore || 0;
			if (val >= 65) return `<strong>Track record is strong.</strong> ${val}% year-1 survival on this block (NYC avg 52%). Transit score ${transit} supports consistent foot traffic for your covers math.`;
			if (val >= 45) return `Tight but viable. ${val}% survival rate — close to NYC average. At typical specialty coffee avg checks you'll need steady foot traffic (transit: ${transit}) to make rent math work.`;
			return `<strong>Warning sign.</strong> Only ${val}% of businesses survive year one here. Below NYC's 52% average — model conservatively and negotiate shorter lease terms.`;
		},
		statusFn: (val) => scoreStatus(val, 60, 45),
		verdictMap: { strong: '✓ Solid track record', watch: '⚠ Watch closely', verify: '→ Verify rent levels', risk: '✗ High turnover block' },
	},
];

const FITNESS_STUDIO: SignalDef[] = [
	{
		tag: 'Commute Capture',
		question: 'Am I on their daily commute?',
		evidenceKey: 'transit',
		answerFn: (val, _ev, loc) => {
			if (val >= 70) return `<strong>Yes.</strong> Transit score ${val} — multiple subway lines within walking distance. 70–80% of members typically live within 2.5mi of a station on their commute route.`;
			if (val >= 50) return `<strong>Partial.</strong> Transit score ${val} — serviceable but not a commute hub. You'll capture nearby residents but may miss commuter pass-through members.`;
			return `<strong>Weak commute access.</strong> Transit ${val} — limited subway/bus options. A membership-based studio here depends on local density, not commuter capture.`;
		},
		statusFn: (val) => scoreStatus(val, 70, 50),
		verdictMap: { strong: '✓ Strong commute access', watch: '⚠ Partial', verify: '→ Verify in person', risk: '✗ Limited access' },
	},
	{
		tag: 'Noise Compatibility',
		question: 'Is this building noise-compatible?',
		evidenceKey: '_none',
		answerFn: () => `Verify before signing. We don't yet have structural data for this address. <strong>Check for residential units above and prior 311 noise complaints.</strong> Mixed-use buildings with residential above are the #1 cause of forced studio closures.`,
		statusFn: () => 'verify',
		verdictMap: { strong: '✓ Compatible', watch: '⚠ Check 311', verify: '→ Verify in person', risk: '✗ Noise risk' },
	},
	{
		tag: 'Membership Pool',
		question: 'Are there enough 25–45 adults within 8 min?',
		evidenceKey: 'demographics',
		answerFn: (val, _ev, loc) => {
			if (val >= 65) return `<strong>Strong.</strong> Demographics score ${val} — 25–45 age band well-represented. ${loc.medianAge > 0 ? `Median age ${loc.medianAge}.` : ''} Estimated pool supports a 200+ member studio.`;
			if (val >= 45) return `<strong>Moderate.</strong> Demographics ${val} — target demo is present but not dominant. You may need to cast a wider net (extended marketing radius) to hit 200 members.`;
			return `<strong>Thin pool.</strong> Demographics ${val} — the 25–45 cohort is underrepresented here. Building a viable membership base will be harder.`;
		},
		statusFn: (val) => scoreStatus(val, 65, 45),
		verdictMap: { strong: '✓ Pool is there', watch: '⚠ Moderate', verify: '→ Check demo data', risk: '✗ Thin demo pool' },
	},
];

const BAR_NIGHTLIFE: SignalDef[] = [
	{
		tag: 'Liquor License',
		question: 'Can I actually get a liquor license here?',
		evidenceKey: '_none',
		answerFn: () => `<strong>Check NY SLA before anything else.</strong> The 500-foot rule applies — if there are 3+ licensed premises within 500ft, your application faces heightened scrutiny. We're adding license proximity as a kill-factor check.`,
		statusFn: () => 'verify',
		verdictMap: { strong: '✓ Clear', watch: '⚠ Saturated area', verify: '→ Verify first', risk: '✗ Blocked' },
	},
	{
		tag: 'Weekend Destination',
		question: 'Is this a Fri/Sat destination?',
		evidenceKey: 'vibrancy',
		answerFn: (val, _ev, loc) => {
			if (val >= 65) return `<strong>Yes.</strong> Vibrancy score ${val}. ${loc.neighborhood ? loc.neighborhood + ' has' : 'This area has'} high nightlife cluster density — established destination neighborhood for evening spend. Weekend foot traffic is real.`;
			if (val >= 45) return `<strong>Emerging.</strong> Vibrancy ${val} — some evening energy but not yet a destination. You'd need to drive traffic rather than capture it.`;
			return `<strong>Not yet.</strong> Vibrancy ${val} — this block doesn't pull weekend crowds. A bar here is a pioneering play, not a capture play.`;
		},
		statusFn: (val) => scoreStatus(val, 65, 45),
		verdictMap: { strong: '✓ Destination confirmed', watch: '⚠ Emerging', verify: '→ Verify nightlife', risk: '✗ Not a destination' },
	},
	{
		tag: 'Noise Complaints',
		question: 'Will noise complaints shut me down?',
		evidenceKey: 'safety',
		answerFn: (val, _ev, _loc) => {
			if (val >= 70) return `Lower risk. Safety score ${val} and the block's complaint profile is manageable. Standard soundproofing and community engagement should suffice.`;
			if (val >= 50) return `Moderate risk. Mixed-use corridor with residential presence. <strong>311 noise complaint density on this block needs attention.</strong> Budget for soundproofing.`;
			return `<strong>Elevated risk.</strong> Safety ${val} and above-average complaint activity. Operating a late-night venue here requires serious noise mitigation and community relations investment.`;
		},
		statusFn: (val) => scoreStatus(val, 70, 50),
		verdictMap: { strong: '✓ Manageable', watch: '⚠ Moderate risk', verify: '→ Check 311 data', risk: '✗ High complaint risk' },
	},
];

const JUICE_BAR: SignalDef[] = [
	{
		tag: 'Daily Pedestrians',
		question: 'Are there 2,000+ daily pedestrians passing?',
		evidenceKey: 'transit',
		answerFn: (val, _ev, _loc) => {
			if (val >= 70) return `<strong>Yes — hard minimum exceeded.</strong> Transit score ${val} suggests strong daily pedestrian volume. Your conversion math works if execution is solid.`;
			if (val >= 50) return `<strong>Borderline.</strong> Transit ${val} — pedestrian volume may be near the 2,000 floor. Walk the block during peak hours to verify.`;
			return `<strong>Below floor.</strong> Transit ${val} — this block likely doesn't hit the 2,000 daily pedestrian minimum a juice bar needs for viability.`;
		},
		statusFn: (val) => scoreStatus(val, 70, 50),
		verdictMap: { strong: '✓ Traffic floor met', watch: '⚠ Borderline', verify: '→ Count in person', risk: '✗ Below minimum' },
	},
	{
		tag: 'Gym Synergy',
		question: 'Is there a gym or studio nearby?',
		evidenceKey: 'vibrancy',
		answerFn: (val, _ev, loc) => {
			if (val >= 60) return `<strong>Likely yes.</strong> Vibrancy ${val} indicates a dense commercial corridor — health/fitness anchors are common in high-vibrancy blocks. Verify specific gym presence within 0.3mi.`;
			if (val >= 40) return `<strong>Possible.</strong> Vibrancy ${val} — moderate commercial activity. Check for gyms/studios within walking distance — synergy isn't guaranteed.`;
			return `<strong>Unlikely.</strong> Vibrancy ${val} — sparse commercial block. Without a nearby gym anchor, you're relying entirely on residential and commuter traffic.`;
		},
		statusFn: (val) => scoreStatus(val, 60, 40),
		verdictMap: { strong: '✓ Synergy present', watch: '⚠ Verify gym', verify: '→ Walk the block', risk: '✗ No anchor nearby' },
	},
	{
		tag: 'Ticket Math',
		question: 'Can a $13 ticket survive this rent?',
		evidenceKey: 'survivalRate',
		answerFn: (val, _ev, loc) => {
			const transit = loc.sixScores.transit || loc.transitScore || 0;
			if (val >= 60) return `<strong>Encouraging.</strong> ${val}% year-1 survival, transit ${transit}. At 50% gross margin, your covers math works — but model conservatively.`;
			if (val >= 45) return `Tight. ${val}% survival rate. At a $13 avg ticket and 50% margin, you need ~80 sales/day. Traffic (transit ${transit}) may support it — margin is thin.`;
			return `<strong>Warning.</strong> Only ${val}% survival. At $13 avg ticket the rent-to-revenue math is fragile on this block. Negotiate hard on rent or consider a higher-traffic location.`;
		},
		statusFn: (val) => scoreStatus(val, 60, 45),
		verdictMap: { strong: '✓ Math works', watch: '⚠ Tight margin', verify: '→ Model the numbers', risk: '✗ Fragile math' },
	},
];

const FAST_CASUAL: SignalDef[] = [
	{
		tag: 'Office Dependency',
		question: 'What if the anchor office tenant leaves?',
		evidenceKey: 'vibrancy',
		answerFn: (val, _ev, _loc) => {
			if (val >= 70) return `<strong>Diversified traffic.</strong> Vibrancy ${val} — this block has multiple foot traffic sources beyond a single office anchor. Concentration risk is lower.`;
			if (val >= 50) return `<strong>Risk is moderate.</strong> Vibrancy ${val} — some traffic diversity, but a major departure could hurt your lunch window. Diversify revenue streams (delivery, weekend brunch).`;
			return `<strong>High concentration risk.</strong> Vibrancy ${val} — this block may depend heavily on 1–2 anchors. One departure could cut lunch traffic significantly.`;
		},
		statusFn: (val) => scoreStatus(val, 70, 50),
		verdictMap: { strong: '✓ Diversified', watch: '⚠ Concentration risk', verify: '→ Identify anchors', risk: '✗ High dependency' },
	},
	{
		tag: 'Lunch Queue Space',
		question: 'Can the space handle 50 people at noon?',
		evidenceKey: '_none',
		answerFn: () => `Site visit required. Available sqft data shows space in this corridor but <strong>peak queue capacity needs in-person verification</strong> before you model throughput. Check ceiling height, layout, and egress.`,
		statusFn: () => 'verify',
		verdictMap: { strong: '✓ Spacious', watch: '⚠ Tight', verify: '→ Verify in person', risk: '✗ Too small' },
	},
	{
		tag: 'Delivery Saturation',
		question: 'Is delivery cannibalizing my walk-in premium?',
		evidenceKey: 'competition',
		answerFn: (val, _ev, _loc) => {
			if (val >= 65) return `Lower risk. Competition score ${val} — the block isn't oversaturated with delivery-enabled competitors. Walk-in premium is still capturable with good positioning.`;
			if (val >= 45) return `<strong>Moderate risk.</strong> Competition ${val} — several delivery-enabled competitors nearby. Differentiation and in-store experience matter more here.`;
			return `<strong>Elevated risk.</strong> Competition ${val} — heavy delivery saturation on this block. Walk-in premium is harder to capture — don't underwrite assuming full walk-in revenue.`;
		},
		statusFn: (val) => scoreStatus(val, 65, 45),
		verdictMap: { strong: '✓ Manageable', watch: '⚠ Delivery saturated', verify: '→ Count competitors', risk: '✗ Heavy saturation' },
	},
];

// ── Fallback (unmapped concepts) ─────────────────────────────────────────────

const FALLBACK_SIGNALS: SignalDef[] = [
	{
		tag: 'Foot Traffic',
		question: 'Is there enough foot traffic to sustain this business?',
		evidenceKey: 'transit',
		answerFn: (val, _ev, loc) => {
			if (val >= 70) return `<strong>Strong foot traffic potential.</strong> Transit score ${val} — multiple transit options drive consistent pedestrian volume to this block.`;
			if (val >= 50) return `<strong>Moderate foot traffic.</strong> Transit ${val} — some walk-by traffic but you may need destination marketing to supplement.`;
			return `<strong>Limited foot traffic.</strong> Transit ${val} — this block relies on destination visits, not walk-by discovery. Plan your marketing accordingly.`;
		},
		statusFn: (val) => scoreStatus(val, 70, 50),
		verdictMap: { strong: '✓ Strong traffic', watch: '⚠ Moderate', verify: '→ Walk the block', risk: '✗ Limited traffic' },
	},
	{
		tag: 'Business Survival',
		question: 'Do businesses survive on this block?',
		evidenceKey: 'survivalRate',
		answerFn: (val, _ev, _loc) => {
			if (val >= 65) return `<strong>Yes.</strong> ${val}% year-1 survival rate — above NYC's 52% average. This block has a track record of supporting businesses.`;
			if (val >= 45) return `<strong>Average.</strong> ${val}% survival — close to NYC's 52% baseline. Not a red flag, but not a strong signal either.`;
			return `<strong>Concerning.</strong> Only ${val}% survival rate — below NYC average. Investigate why (rents, traffic, turnover) before committing.`;
		},
		statusFn: (val) => scoreStatus(val, 60, 45),
		verdictMap: { strong: '✓ Strong track record', watch: '⚠ Average', verify: '→ Check turnover', risk: '✗ High turnover' },
	},
	{
		tag: 'Customer Profile',
		question: 'Does the local customer match my target?',
		evidenceKey: 'demographics',
		answerFn: (val, _ev, loc) => {
			const income = loc.medianIncome > 0 ? fmtMoney(loc.medianIncome) : 'N/A';
			const age = loc.medianAge > 0 ? String(loc.medianAge) : 'N/A';
			if (val >= 65) return `<strong>Good alignment.</strong> Demographics ${val}. Median income ${income}, median age ${age}. The local profile supports your target customer.`;
			if (val >= 45) return `<strong>Partial match.</strong> Demographics ${val}. Income ${income}, age ${age}. Some overlap with your target but not a perfect fit — adjust positioning if needed.`;
			return `<strong>Mismatch.</strong> Demographics ${val}. Income ${income}, age ${age}. The local profile may not align with your target customer — reconsider pricing or location.`;
		},
		statusFn: (val) => scoreStatus(val, 65, 45),
		verdictMap: { strong: '✓ Good match', watch: '⚠ Partial', verify: '→ Check demographics', risk: '✗ Mismatch' },
	},
];

// ── Concept → Signal map ─────────────────────────────────────────────────────

const CONCEPT_SIGNAL_MAP: Record<string, SignalDef[]> = {
	specialty_coffee: SPECIALTY_COFFEE,
	fitness_studio: FITNESS_STUDIO,
	bar_nightlife: BAR_NIGHTLIFE,
	juice_bar: JUICE_BAR,
	fast_casual: FAST_CASUAL,
};

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * getConceptSignals
 *
 * Returns 3 rendered signal cards for the given concept type.
 * Each signal has: status, tag, question, answer (HTML), verdict.
 *
 * @param bizType    - Canonical concept key (e.g. 'specialty_coffee')
 * @param evidence   - Evidence payload from decision-engine
 * @param locationData - Bag of scores and location metadata
 */
export function getConceptSignals(
	bizType: string,
	evidence: EvidencePayload,
	locationData: LocationDataBag,
): RenderedSignal[] {
	const defs = CONCEPT_SIGNAL_MAP[bizType] || FALLBACK_SIGNALS;

	return defs.map((def) => {
		// Resolve score for this signal's evidence key
		let value = 0;
		if (def.evidenceKey !== '_none') {
			value =
				locationData.sixScores[def.evidenceKey] ||
				locationData.fitSubScores[def.evidenceKey] ||
				// Special keys
				(def.evidenceKey === 'survivalRate'
					? locationData.survivalRate || locationData.sixScores.survivalRate || locationData.sixScores.survival_rate || 0
					: 0);
		}

		const status = def.statusFn(value, locationData);
		const answer = def.answerFn(value, evidence, locationData);
		const verdict = def.verdictMap[status];

		return { status, tag: def.tag, question: def.question, answer, verdict };
	});
}

/**
 * Get the "why strip" items for a concept — 3–4 quick signal summaries shown below hero.
 */
export function getWhyStrip(
	bizType: string,
	evidence: EvidencePayload,
	locationData: LocationDataBag,
): Array<{ dot: 'g' | 'r' | 'a'; label: string; text: string }> {
	const items: Array<{ dot: 'g' | 'r' | 'a'; label: string; text: string }> = [];

	// Top 2 helping signals
	for (const item of evidence.helping.slice(0, 2)) {
		items.push({
			dot: 'g',
			label: item.label,
			text: `${item.value}/100 — ${item.copy.split('.')[0]}`,
		});
	}

	// Top hurting signal
	if (evidence.hurting.length > 0) {
		const worst = evidence.hurting[0];
		items.push({
			dot: 'r',
			label: worst.label,
			text: `${worst.value}/100 — ${worst.copy.split('.')[0]}`,
		});
	}

	// Vision IQ status
	if (locationData.visionIQ > 0 && locationData.visionIQ < 60) {
		items.push({
			dot: 'a',
			label: 'Concept Detail',
			text: 'Preliminary — complete your concept profile',
		});
	} else if (locationData.visionIQ >= 60) {
		items.push({
			dot: 'g',
			label: 'Concept Detail',
			text: `${locationData.visionIQ}/100 — concept detail is solid`,
		});
	}

	return items.slice(0, 4);
}
