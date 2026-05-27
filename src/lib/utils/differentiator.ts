/**
 * RE²D2 — Differentiator Guardrails
 *
 * Scores user responses to the "what makes yours different?" question.
 * Returns a tier (garbage / vague / good), a 0-100 score, and the trigger
 * phrase that caused the classification (for personalised bot responses).
 *
 * Used by: onboarding/+page.svelte, Vision IQ (future)
 */

export type DifferentiatorTier = 'garbage' | 'vague' | 'good';

export interface DifferentiatorScore {
	tier: DifferentiatorTier;
	/** 0–100, feeds into Vision IQ differentiator dimension */
	score: number;
	/** Which signal triggered the tier — used to personalise RE²D2 response */
	triggerPhrase: string | null;
}

// ── TIER 1: GARBAGE ──────────────────────────────────────────────────────────
// Keyboard mash and pure filler only — harm/illegal concepts are handled by Haiku in check-harm API
const GARBAGE_WORDS = [
	'wtf', 'lmao', 'lol', 'asdf', 'qwerty', 'aaaa', 'zzzz', 'xxxx',
];
const FILLER_PATTERNS = [
	/^(skip|n\/a|na|nothing|idk|no idea|not sure|tbd|later|pass|nope|no|nah|yes|yeah|ok|okay|sure|fine|whatever|done|next)$/i,
];

// ── TIER 2: GENERIC/VAGUE ─────────────────────────────────────────────────────
const GENERIC_PHRASES: string[] = [
	'great service', 'good service', 'excellent service', 'best service', 'amazing service',
	'high quality', 'great quality', 'quality products', 'quality coffee', 'quality food',
	'friendly staff', 'nice staff', 'great staff', 'amazing staff',
	'affordable prices', 'lowest prices', 'best prices', 'cheap prices',
	'convenient location', 'easy to find', 'easy access', 'accessible location',
	'fresh ingredients', 'fresh food', 'fresh products', 'locally sourced', 'organic ingredients',
	'passion for', 'love for', 'passionate about', 'love what we do', 'love coffee', 'love food',
	'best in the city', 'best in nyc', 'nothing like it', 'unique experience', 'one of a kind',
	'great atmosphere', 'cozy atmosphere', 'good vibes', 'warm atmosphere', 'welcoming atmosphere',
	'community focused', 'community driven', 'community feel',
];

// ── TIER 3: SPECIFICITY SIGNALS ──────────────────────────────────────────────
const SPECIFICITY_PATTERNS: RegExp[] = [
	/\d+/,                                          // any number ($25, 15-min, 3 locations)
	/\b(only|first|exclusive|no one else|signature|patented|trademarked|original)\b/i,
	/\b(membership|subscription|walk-?in|drop-?in|reservation-?only|no-?contract|prepaid|flat.?rate)\b/i,
	/\b(sourced|roasted|brewed|fermented|house-?made|scratch|hand-?rolled|wood-?fired|cold-?pressed|house-?cured)\b/i,
	/\b(certified|trained|licensed|award|michelin|james.?beard|wbc|certified|accredited)\b/i,
	/\b(vinyl|listening|gallery|pop-?up|rotating|residency|chef.?driven|chef-?owned)\b/i,
	/\b(designed for|targeting|built for|focused on|catered to|exclusively for)\b/i,
	/\b(natural wine|biodynamic|zero.?proof|sober.?curious|omakase|tasting menu|prix.?fixe)\b/i,
	/\b(24.?hour|24\/7|late.?night|early morning|pre-?dawn|after.?hours)\b/i,
	/\b(no.?menu|chef.?choice|market.?driven|daily.?changing|rotating.?menu)\b/i,
];

export function scoreDifferentiator(
	text: string,
	concept: string  // canonical concept key — reserved for concept-specific logic in v2
): DifferentiatorScore {
	const clean = text.trim().toLowerCase();
	const words = clean.split(/[\s,;.!?]+/).filter(w => w.length > 2);

	// ── Tier 1: Garbage checks ────────────────────────────────────────────────
	// Only reject truly empty responses — short niche terms (e.g. "protein coffee") are valid
	if (words.length < 1) {
		return { tier: 'garbage', score: 0, triggerPhrase: 'too short' };
	}

	for (const word of GARBAGE_WORDS) {
		if (clean.includes(word)) {
			return { tier: 'garbage', score: 0, triggerPhrase: word };
		}
	}

	for (const pattern of FILLER_PATTERNS) {
		if (pattern.test(clean)) {
			return { tier: 'garbage', score: 0, triggerPhrase: 'filler phrase' };
		}
	}

	// Gibberish: most words have no vowels
	const vowelPoorWords = words.filter(w => !/[aeiou]/.test(w) && w.length > 3);
	if (vowelPoorWords.length / words.length > 0.6) {
		return { tier: 'garbage', score: 0, triggerPhrase: 'gibberish' };
	}

	// ── Tier 3: Specificity signals (check before vague — specific beats generic) ─
	let specificityHits = 0;
	for (const pattern of SPECIFICITY_PATTERNS) {
		if (pattern.test(clean)) specificityHits++;
	}
	// 8+ word answer with 1+ specificity signal → good
	if (words.length >= 8 && specificityHits >= 1) {
		return { tier: 'good', score: 85 + Math.min(specificityHits * 5, 15), triggerPhrase: null };
	}
	// Short but 2+ specificity signals → also good
	if (specificityHits >= 2) {
		return { tier: 'good', score: 80, triggerPhrase: null };
	}

	// ── Tier 2: Generic/vague check ──────────────────────────────────────────
	for (const phrase of GENERIC_PHRASES) {
		if (clean.includes(phrase)) {
			return { tier: 'vague', score: 40, triggerPhrase: phrase };
		}
	}
	// Short answer (3–7 words) with no specificity signals → vague
	if (words.length <= 7 && specificityHits === 0) {
		return { tier: 'vague', score: 45, triggerPhrase: null };
	}

	// Default: accept (medium-length, no red flags, no obvious specificity signals)
	return { tier: 'good', score: 65, triggerPhrase: null };
}

// ── CONCEPT-AWARE RESPONSE HELPERS ───────────────────────────────────────────

const CONCEPT_PROBES: Record<string, string> = {
	specialty_coffee:        "What's the sourcing story, the format, or the price point that's different?",
	bar_nightlife:           "What's the experience — a theme, a format, a crowd?",
	fitness_studio:          "Is it a model thing (memberships, drop-ins), a modality, or a demographic?",
	wellness_spa:            "Express treatments? A membership model? A specific technique?",
	fast_casual:             "Is it the cuisine, the format, the price, or the speed?",
	full_service_restaurant: "The concept, the cuisine, or the experience?",
	personal_services:       "Walk-ins? Flat pricing? A specialty technique?",
	retail:                  "The curation, the sourcing, or who you're selling to?",
	coworking:               "The community, the amenities, or the pricing model?",
	medical_office:          "A specialty, a care model, or a patient experience thing?",
	bakery:                  "A technique, a cultural tradition, or a format?",
	juice_bar:               "A protocol, a sourcing story, or a customer ritual?",
	qsr:                     "Speed, price point, or a specific format/cuisine?",
};

const CONCEPT_AFFIRMATIONS: Record<string, string> = {
	specialty_coffee:        "That's a destination concept — not just another café.",
	bar_nightlife:           "That's a niche with real demand in NYC. Noted.",
	fitness_studio:          "Specific format + model — that's exactly what scoring needs.",
	wellness_spa:            "That's the kind of differentiation that drives repeat visits.",
	full_service_restaurant: "Strong concept. That goes into your score.",
	fast_casual:             "Clear positioning. That's going straight into scoring.",
	personal_services:       "Specific and ownable. Good.",
	retail:                  "Clear curation angle. Strong.",
	coworking:               "Distinct model. That's what investors want to see.",
	bakery:                  "That's a destination-worthy angle.",
	juice_bar:               "Specific protocol + ritual — that's a loyalty driver.",
	qsr:                     "Clear and ownable. Goes into scoring.",
};

/**
 * Builds the concept-aware "go deeper" probe for a vague answer.
 * triggerPhrase: the specific vague phrase that triggered the tier (can be null).
 */
export function buildVagueProbe(triggerPhrase: string | null, concept: string): string {
	const opener = triggerPhrase
		? `"${triggerPhrase.charAt(0).toUpperCase() + triggerPhrase.slice(1)}" — that's what most people say.`
		: "I need something more specific.";
	const probe = CONCEPT_PROBES[concept] ?? "A specific format, a pricing model, or a niche audience?";
	return `${opener} I need something only *you* do. ${probe}`;
}

/**
 * Builds the concept-aware affirmation for a good/specific answer.
 */
export function buildGoodAffirmation(text: string, concept: string): string {
	// text is reserved for future personalisation (e.g. echo a keyword back)
	void text;
	return CONCEPT_AFFIRMATIONS[concept] ?? "That's a strong angle. Goes into your score.";
}
