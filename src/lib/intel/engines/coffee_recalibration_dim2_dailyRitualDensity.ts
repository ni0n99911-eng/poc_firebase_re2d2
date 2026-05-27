/**
 * ═══════════════════════════════════════════════════════
 * Coffee Recalibration — Dimension 2: Daily Ritual Density
 * ═══════════════════════════════════════════════════════
 *
 * SELF-CONTAINED — all scoring logic lives in this file.
 * No dependency on segment-intel.ts. Tune everything here.
 *
 * Computes the Daily Ritual Density score (rdScore) for the coffee
 * scoring engine. This is the second-highest weighted dimension at
 * 25% of the raw composite.
 *
 * "Daily ritual density" measures the concentration of places and
 * people that generate REPEAT daily coffee purchases — offices,
 * gyms, colleges, coworking spaces, hospitals, tourist attractions,
 * commuters, and residents within a 500m trade radius.
 *
 * Data sources (all pre-fetched in the report — no live API calls):
 *   - report.places      → Google Places (offices, gyms, colleges, coworking, hospitals, tourist)
 *   - report.competitors → OpenStreetMap/Overpass (supplemental gym data)
 *   - report.mtaRidership → MTA ridership (daily commuter conversion)
 *   - report.census      → US Census (population density → resident base)
 */

import type { LocationIntelReport } from '../types';
import type { IndexSignal } from '../six-index';

// ── Distance Decay (Ring System) ──────────────────────────────────────
// Controls how much credit an anchor POI gets based on distance.
//
// Ring distances from overpass.ts RING_DISTANCES.specialty_coffee: [0.1, 0.2, 0.5] km
//   Ring 1 (0–100m)   = ×1.00 — right next door, full conversion
//   Ring 2 (100–200m) = ×0.60 — short walk, some go to closer options
//   Ring 3 (200–500m) = ×0.25 — they have closer options, fraction walks this far
//   Beyond 500m       = ×0.00 — irrelevant for coffee

export interface RingDecayConfig {
	maxMeters: number;
	multiplier: number;
}

export const RING_DECAY: RingDecayConfig[] = [
	{ maxMeters: 100, multiplier: 1.00 },
	{ maxMeters: 200, multiplier: 0.60 },
	{ maxMeters: 500, multiplier: 0.25 },
];

export function coffeeRingDecay(distanceMeters: number): number {
	for (const ring of RING_DECAY) {
		if (distanceMeters <= ring.maxMeters) return ring.multiplier;
	}
	return 0.00;
}

// ── Anchor Type Definitions ───────────────────────────────────────────
// Each anchor has a base population and a conversion rate.
// Premium pricing ($7+) changes conversion rates for price-sensitive anchors.

export interface AnchorConfig {
	/** Base population per POI (workers, members, students, etc.) */
	basePopulation: number;
	/** Conversion rate for standard pricing (<$7) */
	standardConversion: number;
	/** Conversion rate for premium pricing ($7+) */
	premiumConversion: number;
	/** Icon for UI breakdown */
	icon: string;
	/** Color for UI breakdown */
	color: string;
	/** Display label for UI breakdown */
	label: string;
}

export const ANCHOR_CONFIGS: Record<string, AnchorConfig> = {
	office: {
		basePopulation: 50,
		standardConversion: 0.60,   // 1 coffee/worker/day × 60% of 50 workers
		premiumConversion: 0.28,    // fewer buy $9 daily
		icon: '🏢', color: '#3b82f6', label: 'Office Workers',
	},
	gym: {
		basePopulation: 200,
		standardConversion: 0.35,   // pre/post workout coffee
		premiumConversion: 0.55,    // protein = need, not luxury
		icon: '💪', color: '#10b981', label: 'Gym Members',
	},
	college: {
		basePopulation: 500,
		standardConversion: 0.45,   // highest caffeine consumption demo
		premiumConversion: 0.12,    // most students can't afford $9/day
		icon: '🎓', color: '#8b5cf6', label: 'Students',
	},
	cowork: {
		basePopulation: 100,
		standardConversion: 0.80,   // 100% coffee addicts
		premiumConversion: 0.80,    // unchanged — they'll pay for quality
		icon: '💻', color: '#f97316', label: 'Co-Working',
	},
	hospital: {
		basePopulation: 0,          // special: uses staff+visitor formula below
		standardConversion: 0,
		premiumConversion: 0,
		icon: '🏥', color: '#dc2626', label: 'Hospital',
	},
	tourist: {
		basePopulation: 500,
		standardConversion: 0.15,   // ~500 daily visitors × 15%
		premiumConversion: 0.15,    // tourists will pay for specialty
		icon: '🗽', color: '#d97706', label: 'Tourist Attractions',
	},
};

/** Hospital-specific conversion (staff + visitor model) */
export const HOSPITAL_CONFIG = {
	staffCount: 300,
	staffConversion: 0.40,
	visitorCount: 100,
	visitorConversion: 0.25,
};

/** MTA commuter conversion rate */
export const COMMUTER_CONVERSION = 0.08;

/** Resident conversion rate (within 500m) */
export const RESIDENT_CONVERSION = 0.15;

// ── Google Places Type Mapping ────────────────────────────────────────
// Maps Google Places types to our anchor types.

const TYPE_MAPPING: Record<string, string[]> = {
	office:   ['office', 'accounting', 'insurance', 'lawyer', 'finance', 'real_estate'],
	gym:      ['gym', 'fitness'],
	college:  ['university', 'school', 'college'],
	cowork:   ['coworking'],
	hospital: ['hospital'],
	tourist:  ['tourist_attraction', 'museum', 'landmark'],
};

/** Coworking name patterns (Google often lacks a "coworking" type) */
const COWORK_NAMES = ['wework', 'cowork'];

// ── Scoring Curve ─────────────────────────────────────────────────────
// Maps total daily ritual population to a 0–100 score.
//
// Calibration notes (v1.0):
//   pop ≤ 500:        score = (pop / 500) × 40          → 0–40
//   500 < pop ≤ 1500: score = 40 + ((pop - 500)/1000) × 30  → 40–70
//   pop > 1500:       score = 70 + ((pop - 1500)/3000) × 30 → 70–100

/** Score assigned when ritual density data is completely unavailable */
export const DAILY_RITUAL_FALLBACK_SCORE = 30;

function clamp(v: number, min = 0, max = 100): number {
	return Math.max(min, Math.min(max, isNaN(v) ? min : v));
}

function fmt(n: number): string {
	if (n >= 10000) return Math.round(n / 1000) + 'K';
	if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
	return Math.round(n).toLocaleString();
}

function scoreSentiment(score: number): 'great' | 'good' | 'caution' | 'warning' {
	if (score >= 80) return 'great';
	if (score >= 60) return 'good';
	if (score >= 40) return 'caution';
	return 'warning';
}

// ── Result Interface ──────────────────────────────────────────────────

export interface RitualBreakdownItem {
	type: string;
	count: number;
	icon: string;
	color: string;
	dailyPop: number;
}

export interface DailyRitualDensityResult {
	/** The dimension score (0–100) */
	score: number;
	/** Estimated daily ritual population */
	estimatedDailyPop: number;
	/** Total ritual-generating POIs */
	totalRitualPOIs: number;
	/** Human-readable tier label */
	tierLabel: string;
	/** Detailed interpretation text */
	interpretation: string;
	/** Sentiment assessment */
	sentiment: 'great' | 'good' | 'caution' | 'warning';
	/** Per-anchor breakdown with population estimates */
	breakdown: RitualBreakdownItem[];
	/** Any signals generated for this dimension */
	signals: IndexSignal[];
}

// ── Core Computation ──────────────────────────────────────────────────

/**
 * Compute the Daily Ritual Density dimension score.
 *
 * Pipeline:
 *   1. Scan Google Places for anchor POIs (offices, gyms, colleges, etc.)
 *   2. Supplement gym count from Overpass data
 *   3. Apply distance decay (ring system) to each anchor
 *   4. Apply price-sensitive conversion rates (standard vs premium)
 *   5. Add MTA commuter population
 *   6. Add census-derived resident population with ring decay
 *   7. Map total daily ritual population to 0–100 score
 *
 * @param report - The full LocationIntelReport from the intel pipeline
 * @param avgTicket - User's average ticket price (affects conversion rates)
 * @returns DailyRitualDensityResult with score, population estimate, and breakdown
 */
export function computeDailyRitualDensityDimension(
	report: LocationIntelReport,
	avgTicket: number = 5.00
): DailyRitualDensityResult {
	const places = (report as any).places;
	const overpass = (report as any).competitors;
	const census = (report as any).census;
	const mta = (report as any).mtaRidership;

	const isPremium = avgTicket > 7;

	// ── Step 1: Classify anchor POIs from Google Places ──────────────
	interface AnchorPOI { type: string; distance: number }
	const anchors: AnchorPOI[] = [];

	if (places?.places) {
		for (const p of places.places) {
			const types = (p.types || []).join(',').toLowerCase();
			const dist = p.distance || 500; // default to Ring 3 edge
			const name = (p.name || '').toLowerCase();

			// Check each anchor type
			for (const [anchorType, typePatterns] of Object.entries(TYPE_MAPPING)) {
				if (typePatterns.some(pattern => types.includes(pattern))) {
					anchors.push({ type: anchorType, distance: dist });
				}
			}

			// Coworking name detection (Google often lacks "coworking" type)
			if (COWORK_NAMES.some(n => name.includes(n)) && !anchors.some(a => a.type === 'cowork' && a.distance === dist)) {
				anchors.push({ type: 'cowork', distance: dist });
			}
		}
	}

	// ── Step 2: Supplement gyms from Overpass ────────────────────────
	if (overpass?.amenities) {
		const overpassGyms = (overpass.amenities.gyms || []).length;
		const placesGyms = anchors.filter(a => a.type === 'gym').length;
		if (overpassGyms > placesGyms) {
			for (let i = 0; i < overpassGyms - placesGyms; i++) {
				anchors.push({ type: 'gym', distance: 150 }); // assume Ring 2 avg
			}
		}
	}

	// ── Step 3+4: Compute daily pop with ring decay + conversion ────
	const popByType: Record<string, number> = {};
	const countByType: Record<string, number> = {};

	for (const a of anchors) {
		const decay = coffeeRingDecay(a.distance);
		if (decay === 0) continue; // Beyond 500m

		const config = ANCHOR_CONFIGS[a.type];
		if (!config) continue;

		countByType[a.type] = (countByType[a.type] || 0) + 1;

		if (a.type === 'hospital') {
			// Special hospital formula: staff + visitors
			const hospPop = (HOSPITAL_CONFIG.staffCount * HOSPITAL_CONFIG.staffConversion +
				HOSPITAL_CONFIG.visitorCount * HOSPITAL_CONFIG.visitorConversion) * decay;
			popByType[a.type] = (popByType[a.type] || 0) + hospPop;
		} else {
			const conv = isPremium ? config.premiumConversion : config.standardConversion;
			popByType[a.type] = (popByType[a.type] || 0) + config.basePopulation * conv * decay;
		}
	}

	// ── Step 5: MTA Commuters ───────────────────────────────────────
	let commuterPop = 0;
	if (mta && mta.totalDailyRidership > 0) {
		commuterPop = mta.totalDailyRidership * COMMUTER_CONVERSION;
	}

	// ── Step 6: Census Residents with ring decay ────────────────────
	let residentPop = 0;
	if (census?.populationDensity) {
		const densityPerSqKm = census.populationDensity * 2.59; // sq mi → sq km
		const ring1Pop = densityPerSqKm * 0.031 * RESIDENT_CONVERSION * 1.00;
		const ring2Pop = densityPerSqKm * 0.094 * RESIDENT_CONVERSION * 0.60;
		const ring3Pop = densityPerSqKm * 0.660 * RESIDENT_CONVERSION * 0.25;
		residentPop = ring1Pop + ring2Pop + ring3Pop;
	}

	// ── Build breakdown ─────────────────────────────────────────────
	const breakdown: RitualBreakdownItem[] = [];
	let totalAnchorPop = 0;

	for (const [type, config] of Object.entries(ANCHOR_CONFIGS)) {
		const pop = popByType[type] || 0;
		const count = countByType[type] || 0;
		if (count > 0) {
			breakdown.push({
				type: config.label,
				count,
				icon: config.icon,
				color: config.color,
				dailyPop: Math.round(pop),
			});
			totalAnchorPop += pop;
		}
	}

	if (commuterPop > 0) {
		breakdown.push({
			type: 'MTA Commuters',
			count: mta.stationCount,
			icon: '🚇',
			color: '#ef4444',
			dailyPop: Math.round(commuterPop),
		});
	}

	if (residentPop > 0 && census) {
		const areaPopulation = census.populationDensity * 2.59 * 0.785;
		breakdown.push({
			type: 'Residents',
			count: Math.round(areaPopulation),
			icon: '🏠',
			color: '#a1a1a6',
			dailyPop: Math.round(residentPop),
		});
	}

	// ── Step 7: Compute total pop + score ────────────────────────────
	const totalPop = Math.round(totalAnchorPop + commuterPop + residentPop);
	const totalPOIs = Object.values(countByType).reduce((sum, c) => sum + c, 0);

	if (totalPop === 0) {
		return {
			score: DAILY_RITUAL_FALLBACK_SCORE,
			estimatedDailyPop: 0,
			totalRitualPOIs: 0,
			tierLabel: 'No data available',
			interpretation: 'No ritual-generating anchors detected nearby.',
			sentiment: 'warning',
			breakdown: [],
			signals: [{
				index: 'vibrancy',
				type: 'negative',
				message: 'Thin daily ritual anchors — few repeat-visit generators nearby',
			}],
		};
	}

	// Score curve: piecewise linear
	const score = clamp(Math.round(
		totalPop <= 500 ? (totalPop / 500) * 40
		: totalPop <= 1500 ? 40 + ((totalPop - 500) / 1000) * 30
		: 70 + ((totalPop - 1500) / 3000) * 30
	), 0, 100);

	const sentiment = scoreSentiment(score);
	const tierLabel = score >= 80 ? 'Very High Daily Ritual Density'
		: score >= 60 ? 'Strong Daily Ritual Density'
		: score >= 40 ? 'Moderate Daily Ritual Density'
		: 'Low Daily Ritual Density';

	const interpretation = score >= 80
		? `~${fmt(totalPop)} potential daily customers from offices, gyms, and commuters within a 5-min walk. This block generates repeat business.`
		: score >= 60
		? `~${fmt(totalPop)} potential daily customers nearby — solid base for a coffee shop. Focus on commuter capture.`
		: score >= 40
		? `~${fmt(totalPop)} estimated daily ritual buyers. You'll need to build destination appeal — not just walk-by.`
		: `Fewer than ${fmt(totalPop)} daily ritual buyers estimated. This location requires strong marketing and a reason to visit.`;

	// Generate signals
	const signals: IndexSignal[] = [];
	if (score < 40) {
		signals.push({
			index: 'vibrancy',
			type: 'negative',
			message: 'Thin daily ritual anchors — few repeat-visit generators nearby',
		});
	}

	return {
		score,
		estimatedDailyPop: totalPop,
		totalRitualPOIs: totalPOIs,
		tierLabel,
		interpretation,
		sentiment,
		breakdown,
		signals,
	};
}
