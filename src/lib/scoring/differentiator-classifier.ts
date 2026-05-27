/**
 * differentiator-classifier.ts
 * Classifies a user's differentiator input into a quality tier.
 *
 * Used by:
 *   - RE²D2 onboarding (Panel 1 inline badge below the Differentiators input)
 *   - Vision IQ scoring (scoreBoost is additive on top of existing diffScore)
 *
 * Tier hierarchy:
 *   empty   → blank / whitespace only
 *   garbage → too short, pure noise, or non-words
 *   vague   → only generic table-stakes words — sounds good, says nothing
 *   good    → contains at least one specific/niche signal
 */

export type DiffTier = 'empty' | 'garbage' | 'vague' | 'good';

export interface DiffResult {
	tier:       DiffTier;
	reason:     string;   // short badge label e.g. "Too generic" / "Strong signal"
	hint:       string;   // one-line tip shown below badge
	scoreBoost: number;   // 0 | 5 | 15 — additive on top of existing diffScore
}

// ─────────────────────────────────────────────
// Word lists
// ─────────────────────────────────────────────

/** Generic table-stakes phrases that tell us nothing about why THIS business wins */
const VAGUE_WORDS = new Set([
	'good', 'great', 'best', 'better', 'amazing', 'awesome', 'excellent',
	'affordable', 'cheap', 'inexpensive', 'reasonable', 'competitive',
	'quality', 'premium', 'high-quality', 'high quality',
	'nice', 'clean', 'modern', 'cozy', 'comfortable',
	'fresh', 'natural', 'healthy', 'organic',         // only vague if used alone
	'unique', 'different', 'special', 'one-of-a-kind', 'one of a kind',
	'local', 'community', 'neighborhood',
	'friendly', 'welcoming', 'warm', 'personalized', 'personal',
	'professional', 'experienced', 'expert', 'skilled',
	'fast', 'quick', 'efficient', 'convenient',
	'authentic', 'traditional', 'classic', 'original',
	'innovative', 'creative', 'cutting-edge', 'cutting edge',
	'sustainable', 'eco', 'green', 'eco-friendly',    // only vague if used alone
	'trusted', 'reliable', 'consistent',
	'passion', 'passionate', 'love', 'care', 'dedicated',
]);

/**
 * Noise patterns — pure garbage inputs
 * Tested BEFORE vague detection.
 */
const NOISE_PATTERNS: RegExp[] = [
	/^[^a-z]+$/i,                  // no letters at all
	/^(.)\1{2,}$/,                 // repeated single char e.g. "aaa", "!!!"
	/^\d+$/,                       // pure numbers
	/^(skip|idk|n\/a|na|none|nothing|no|nope|tbd|tba|unsure|unknown|yes|yep|ok|okay)$/i,
	/^[a-z]{1,2}$/i,              // single or double letter
];

/**
 * Specific / niche signal patterns — any match → 'good'
 * These indicate the user has a real differentiator, not just filler.
 */
const SPECIFIC_PATTERNS: RegExp[] = [
	// Numbers signal specificity: "3 roasters on-site", "14-day dry-aged"
	/\d/,

	// Named formats / models
	/\b(omakase|kaiseki|prix fixe|prix-fixe|tasting menu|table d'hôte)\b/i,
	/\b(fast casual|counter service|full[- ]service|walk[- ]up|drive[- ]thru|drive thru)\b/i,
	/\b(membership|subscription|retainer|pay[- ]what[- ]you[- ]can|sliding scale)\b/i,
	/\b(ghost kitchen|virtual brand|dark kitchen|pop[- ]up|residency)\b/i,

	// Sourcing / provenance
	/\b(single[- ]origin|direct[- ]trade|farm[- ]to[- ]table|farm to table|estate[- ]grown|micro[- ]roast)\b/i,
	/\b(regenerative|biodynamic|heirloom|heritage breed|pasture[- ]raised|wild[- ]caught)\b/i,
	/\b(hyperlocal|within \d+ miles?|grown (on[- ]site|in[- ]house|locally))\b/i,

	// Technique / method specificity
	/\b(cold[- ]brew|nitro|pour[- ]over|aeropress|chemex|siphon|espresso|cortado|v60)\b/i,
	/\b(sous[- ]vide|wood[- ]fired|brick[- ]oven|live[- ]fire|fermented|cured|smoked)\b/i,
	/\b(low[- ]and[- ]slow|pitmaster|whole[- ]animal|nose[- ]to[- ]tail|zero[- ]waste)\b/i,
	/\b(handmade|hand[- ]crafted|from[- ]scratch|in[- ]house|house[- ]made)\b/i,

	// Certifications / credentials
	/\b(michelin|james beard|certified|licensed|board[- ]certified|insured|bonded|accredited)\b/i,
	/\b(usda|fda|nsf|haccp|kosher|halal|vegan[- ]certified|gluten[- ]free certified)\b/i,

	// Named cultural / regional references
	/\b(neapolitan|szechuan|sichuan|oaxacan|levantine|yemeni|cantonese|tonkotsu|hakata)\b/i,
	/\b(brooklyn|queens|bronx|harlem|astoria|flushing|williamsburg|bedstuy|lower east side)\b/i,

	// Niche audience signals
	/\b(lgbtq|queer|women[- ]owned|black[- ]owned|latina[- ]owned|veteran[- ]owned|minority[- ]owned)\b/i,
	/\b(senior|accessibility|ada|wheelchair|low[- ]income|community[- ]supported)\b/i,

	// Format specificity (space / experience)
	/\b(coworking|co[- ]working|meditation room|recording studio|podcast|event space|private dining)\b/i,
	/\b(rooftop|outdoor|garden|patio|terrace|basement|speakeasy|hidden|secret)\b/i,
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Count words with 3+ meaningful characters */
function countRealWords(text: string): number {
	return text
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.replace(/[^a-z]/g, '').length >= 3)
		.length;
}

/** True if every real word in the text is on the vague list */
function isAllVague(text: string): boolean {
	const words = text
		.toLowerCase()
		.replace(/[^\w\s-]/g, ' ')
		.split(/\s+/)
		.map((w) => w.replace(/^-+|-+$/g, ''))
		.filter((w) => w.length >= 3);

	if (words.length === 0) return false;
	return words.every((w) => VAGUE_WORDS.has(w));
}

/** True if any specific-signal pattern matches the text */
function hasSpecificSignal(text: string): boolean {
	return SPECIFIC_PATTERNS.some((re) => re.test(text));
}

// ─────────────────────────────────────────────
// Main classifier
// ─────────────────────────────────────────────

export function classifyDifferentiator(text: string): DiffResult {
	const trimmed = (text ?? '').trim();

	// ── empty ──────────────────────────────────
	if (trimmed.length === 0) {
		return {
			tier:       'empty',
			reason:     'No input',
			hint:       'What makes your concept different from the 10 others on the same block?',
			scoreBoost: 0,
		};
	}

	// ── garbage ────────────────────────────────
	const isNoise = NOISE_PATTERNS.some((re) => re.test(trimmed));
	const realWordCount = countRealWords(trimmed);

	if (isNoise || realWordCount < 2) {
		return {
			tier:       'garbage',
			reason:     'Not specific enough',
			hint:       'Try describing your format, sourcing, technique, or target customer.',
			scoreBoost: 0,
		};
	}

	// ── good (check before vague — specifics override generic words) ──
	if (hasSpecificSignal(trimmed)) {
		return {
			tier:       'good',
			reason:     'Strong signal',
			hint:       'This gives your location score a boost — specifics build credibility.',
			scoreBoost: 15,
		};
	}

	// ── vague ──────────────────────────────────
	if (isAllVague(trimmed)) {
		return {
			tier:       'vague',
			reason:     'Too generic',
			hint:       'Everyone says this. Add a technique, sourcing detail, or named format.',
			scoreBoost: 5,
		};
	}

	// ── partial specificity → treat as good ────
	// Text has real words that aren't all on the vague list but didn't match
	// a specific pattern. Give partial credit rather than penalising.
	return {
		tier:       'good',
		reason:     'Looks good',
		hint:       'Adding a concrete detail (technique, sourcing, certification) strengthens your score.',
		scoreBoost: 15,
	};
}
