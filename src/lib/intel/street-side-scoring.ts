/**
 * Street-Side Scoring — Client-Safe Computation
 *
 * Pure functions for computing street-side modifiers and concept sensitivity.
 * No server-side imports (no cache, no Supabase, no $env).
 *
 * The data-fetching counterpart lives in street-side.ts (server-only).
 */

import type { StreetSideData, ConceptSensitivity } from './street-side-types';

// ── Concept Sensitivity Mapping ────────────────────

const CONCEPT_SENSITIVITY_MAP: Record<string, ConceptSensitivity> = {
	// High sensitivity — habitual/impulse visits
	'cafe': { archetype: 'habitual', sensitivity: 0.9, label: 'Coffee is a daily habit — side of street matters a lot' },
	'coffee': { archetype: 'habitual', sensitivity: 0.9, label: 'Coffee is a daily habit — side of street matters a lot' },
	'Specialty Coffee / Café': { archetype: 'habitual', sensitivity: 0.9, label: 'Coffee is a daily habit — side of street matters a lot' },
	'juice': { archetype: 'impulse', sensitivity: 0.85, label: 'Impulse purchase — people rarely cross the street' },
	'bakery': { archetype: 'habitual', sensitivity: 0.85, label: 'Morning routine purchase — side matters' },
	'deli': { archetype: 'habitual', sensitivity: 0.8, label: 'Grab-and-go — people choose the convenient side' },

	// Moderate sensitivity — discovery/browsing
	'restaurant': { archetype: 'discovery', sensitivity: 0.5, label: 'People browse both sides but prefer the active one' },
	'Restaurant / Fast Casual': { archetype: 'discovery', sensitivity: 0.5, label: 'People browse both sides but prefer the active one' },
	'retail': { archetype: 'discovery', sensitivity: 0.6, label: 'Window shopping favors the busier side' },
	'boutique': { archetype: 'discovery', sensitivity: 0.55, label: 'Discovery shopping — moderate side preference' },
	'bar': { archetype: 'discovery', sensitivity: 0.4, label: 'Evening destination — less side-sensitive' },

	// Low sensitivity — appointment/destination
	'fitness': { archetype: 'destination', sensitivity: 0.2, label: 'Gym members will cross the street' },
	'gym': { archetype: 'destination', sensitivity: 0.2, label: 'Gym members will cross the street' },
	'yoga': { archetype: 'destination', sensitivity: 0.2, label: 'Yoga students will cross the street' },
	'Barbershop / Salon': { archetype: 'appointment', sensitivity: 0.15, label: 'Appointment-based — side barely matters' },
	'salon': { archetype: 'appointment', sensitivity: 0.15, label: 'Appointment-based — side barely matters' },
	'dentist': { archetype: 'appointment', sensitivity: 0.1, label: 'Appointment-based — side irrelevant' },
	'medical': { archetype: 'appointment', sensitivity: 0.1, label: 'Appointment-based — side irrelevant' },
	'tutoring': { archetype: 'destination', sensitivity: 0.1, label: 'Scheduled visits — side irrelevant' },
	'Other': { archetype: 'discovery', sensitivity: 0.4, label: 'Moderate street-side sensitivity' },
};

const DEFAULT_SENSITIVITY: ConceptSensitivity = {
	archetype: 'discovery', sensitivity: 0.4, label: 'Moderate street-side sensitivity'
};

/**
 * Get the concept sensitivity for a business type.
 */
export function getConceptSensitivity(categoryId: string): ConceptSensitivity {
	return CONCEPT_SENSITIVITY_MAP[categoryId] || DEFAULT_SENSITIVITY;
}

/**
 * Apply concept sensitivity to a street-side score.
 * High-sensitivity concepts (coffee) get the full penalty/bonus.
 * Low-sensitivity concepts (dentist) barely notice.
 *
 * Returns a modifier: 0.7 to 1.15
 */
export function streetSideModifier(
	streetSideData: StreetSideData,
	categoryId: string
): { modifier: number; sensitivity: ConceptSensitivity; explanation: string } {
	const sensitivity = getConceptSensitivity(categoryId);
	const { streetSideScore, hostilityPenalty, hostilityFactors } = streetSideData;

	// Base modifier from street-side score
	// Score 80+ → 1.10 bonus, Score 50 → 1.0 neutral, Score 30- → 0.80 penalty
	let baseModifier: number;
	if (streetSideScore >= 70) {
		baseModifier = 1.0 + (streetSideScore - 70) * 0.005; // up to 1.15
	} else if (streetSideScore >= 50) {
		baseModifier = 1.0;
	} else {
		baseModifier = 1.0 - (50 - streetSideScore) * 0.006; // down to 0.70
	}

	// Blend toward 1.0 based on sensitivity
	// sensitivity=1.0 → full modifier, sensitivity=0.0 → modifier=1.0
	const modifier = 1.0 + (baseModifier - 1.0) * sensitivity.sensitivity;
	const clampedModifier = Math.max(0.70, Math.min(1.15, modifier));

	// Build explanation
	let explanation: string;
	if (clampedModifier >= 1.05) {
		explanation = `Strong foot traffic on your side — ${sensitivity.label}`;
	} else if (clampedModifier >= 0.98) {
		explanation = `Balanced foot traffic across both sides`;
	} else if (clampedModifier >= 0.90) {
		explanation = `Most foot traffic is on the opposite side — ${sensitivity.label}`;
	} else {
		explanation = `Wrong side of the street for this concept — ${sensitivity.label}`;
	}

	if (hostilityPenalty < -5) {
		explanation += `. Traffic hostility nearby (${hostilityFactors.map(f => f.name).join(', ')})`;
	}

	return { modifier: Math.round(clampedModifier * 100) / 100, sensitivity, explanation };
}
