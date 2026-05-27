/**
 * Contract tests for the canonical concept normalizer.
 * 04.19.2026 13:00 — Updated import: conceptNormalizer.ts was deleted;
 * normalizeBusinessType from business-type-registry is the canonical source.
 * All test assertions are unchanged — only the import target changed.
 */

import { describe, it, expect } from 'vitest';
// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
import { normalizeBusinessType as normalizeConceptKey } from '../intel/registry/business-type-registry';

const VALID_CANONICAL_KEYS = new Set([
	'specialty_coffee', 'bakery', 'fast_casual', 'qsr',
	'full_service_restaurant', 'fine_dining', 'bar_nightlife',
	'fitness_studio', 'retail', 'coworking', 'medical_office',
	'personal_services', 'wellness_spa', 'juice_bar', 'florist',
	'wellness_beverage',
]);

function expectCanonical(input: string) {
	const result = normalizeConceptKey(input);
	expect(VALID_CANONICAL_KEYS.has(result), `"${input}" → "${result}" is not a canonical key`).toBe(true);
}

describe('normalizeConceptKey — canonical output guarantee', () => {
	it('returns a canonical key for every falsy input', () => {
		expect(normalizeConceptKey(undefined)).toBe('specialty_coffee');
		expect(normalizeConceptKey(null)).toBe('specialty_coffee');
		expect(normalizeConceptKey('')).toBe('specialty_coffee');
	});

	it('passes through all 16 canonical keys unchanged', () => {
		for (const key of VALID_CANONICAL_KEYS) {
			expect(normalizeConceptKey(key)).toBe(key);
		}
	});

	// ---- Onboarding RESTAURANT_SUBTYPES ----
	it('maps restaurant subtype onboarding values', () => {
		expectCanonical('full_service');
		expectCanonical('full-service');
		expectCanonical('full service');
		expectCanonical('full-service / sit-down');
		expectCanonical('sit-down');
		expectCanonical('sit down');
		expectCanonical('restaurant');
		expectCanonical('quick_service');
		expectCanonical('quick service');
		expectCanonical('counter service');
		expectCanonical('cafe_bakery');
		expectCanonical('cafe bakery');
		expectCanonical('café bakery');
	});

	// ---- Medical ----
	it('maps medical_dental (exact key onboarding saves)', () => {
		expect(normalizeConceptKey('medical_dental')).toBe('medical_office');
		expect(normalizeConceptKey('medical dental')).toBe('medical_office');
		expect(normalizeConceptKey('dentist')).toBe('medical_office');
		expect(normalizeConceptKey('medical')).toBe('medical_office');
	});

	// ---- Fast casual spacing variants ----
	it('maps fast casual with space and hyphen variants', () => {
		expect(normalizeConceptKey('fast casual')).toBe('fast_casual');
		expect(normalizeConceptKey('fast-casual')).toBe('fast_casual');
	});

	// ---- Bar / nightlife ----
	it('maps bar concept variants', () => {
		expectCanonical('bar');
		expectCanonical('nightclub');
		expectCanonical('nightlife');
		expectCanonical('bar lounge');
		expectCanonical('bar_lounge');
		expectCanonical('bar / nightlife');
		expectCanonical('pub');
		expectCanonical('lounge');
		expectCanonical('cocktail bar');
		expectCanonical('wine bar');
		expectCanonical('brewery');
		expectCanonical('dive bar');
		expectCanonical('speakeasy');
	});

	// ---- Wellness / spa ----
	it('maps spa and wellness variants', () => {
		expect(normalizeConceptKey('spa')).toBe('wellness_spa');
		expect(normalizeConceptKey('wellness')).toBe('wellness_spa');
		expect(normalizeConceptKey('day spa')).toBe('wellness_spa');
		expect(normalizeConceptKey('spa_wellness')).toBe('wellness_spa');
		expect(normalizeConceptKey('wellness spa')).toBe('wellness_spa');
		expect(normalizeConceptKey('spa / wellness')).toBe('wellness_spa');
	});

	// ---- Wellness beverage (must NOT fall into wellness_spa) ----
	it('maps wellness_beverage variants to its own canonical key', () => {
		expect(normalizeConceptKey('wellness_beverage')).toBe('wellness_beverage');
		expect(normalizeConceptKey('wellness beverage')).toBe('wellness_beverage');
		expect(normalizeConceptKey('boba')).toBe('wellness_beverage');
		expect(normalizeConceptKey('matcha bar')).toBe('wellness_beverage');
	});

	// ---- Fitness ----
	it('maps fitness concept variants', () => {
		expect(normalizeConceptKey('boutique_studio')).toBe('fitness_studio');
		expect(normalizeConceptKey('yoga')).toBe('fitness_studio');
		expect(normalizeConceptKey('gym')).toBe('fitness_studio');
		expect(normalizeConceptKey('fitness')).toBe('fitness_studio');
		expect(normalizeConceptKey('fitness / wellness')).toBe('fitness_studio');
		expect(normalizeConceptKey('crossfit')).toBe('fitness_studio');
		expect(normalizeConceptKey('pilates_studio')).toBe('fitness_studio');
	});

	// ---- Personal services ----
	it('maps personal services variants', () => {
		expect(normalizeConceptKey('salon')).toBe('personal_services');
		expect(normalizeConceptKey('barbershop')).toBe('personal_services');
		expect(normalizeConceptKey('barber')).toBe('personal_services');
		expect(normalizeConceptKey('hair salon')).toBe('personal_services');
		expect(normalizeConceptKey('nail salon')).toBe('personal_services');
		expect(normalizeConceptKey('lash studio')).toBe('personal_services');
		expect(normalizeConceptKey('salon / barbershop')).toBe('personal_services');
	});

	// ---- Coffee ----
	it('maps coffee variants', () => {
		expect(normalizeConceptKey('cafe')).toBe('specialty_coffee');
		expect(normalizeConceptKey('café')).toBe('specialty_coffee');
		expect(normalizeConceptKey('coffee')).toBe('specialty_coffee');
		expect(normalizeConceptKey('coffee_shop')).toBe('specialty_coffee');
		expect(normalizeConceptKey('coffee shop')).toBe('specialty_coffee');
		expect(normalizeConceptKey('specialty coffee / café')).toBe('specialty_coffee');
		expect(normalizeConceptKey('coffeehouse')).toBe('specialty_coffee');
		expect(normalizeConceptKey('espresso bar')).toBe('specialty_coffee');
	});

	// ---- Retail ----
	it('maps retail variants', () => {
		expect(normalizeConceptKey('boutique')).toBe('retail');
		expect(normalizeConceptKey('clothing')).toBe('retail');
		expect(normalizeConceptKey('grocery')).toBe('retail');
		expect(normalizeConceptKey('gift shop')).toBe('retail');
		expect(normalizeConceptKey('retail / boutique')).toBe('retail');
		expect(normalizeConceptKey('grocery / market')).toBe('retail');
	});

	// ---- Bakery ----
	it('maps bakery variants', () => {
		expect(normalizeConceptKey('patisserie')).toBe('bakery');
		expect(normalizeConceptKey('donut')).toBe('bakery');
		expect(normalizeConceptKey('croissant')).toBe('bakery');
		expect(normalizeConceptKey('bakery / café')).toBe('bakery');
	});

	// ---- QSR ----
	it('maps QSR variants', () => {
		expect(normalizeConceptKey('burger')).toBe('qsr');
		expect(normalizeConceptKey('fast food')).toBe('qsr');
		expect(normalizeConceptKey('food truck')).toBe('qsr');
		expect(normalizeConceptKey('takeout')).toBe('qsr');
	});

	// ---- Case insensitivity ----
	it('is case-insensitive', () => {
		expect(normalizeConceptKey('COFFEE')).toBe('specialty_coffee');
		expect(normalizeConceptKey('Medical_Dental')).toBe('medical_office');
		expect(normalizeConceptKey('BAR')).toBe('bar_nightlife');
		expect(normalizeConceptKey('Yoga Studio')).toBe('fitness_studio');
	});

	// ---- Full-service restaurant display-string variants ----
	it('maps full-service restaurant display strings', () => {
		expect(normalizeConceptKey('full-service restaurant')).toBe('full_service_restaurant');
		expect(normalizeConceptKey('full service restaurant')).toBe('full_service_restaurant');
		expect(normalizeConceptKey('bistro')).toBe('full_service_restaurant');
		expect(normalizeConceptKey('steakhouse')).toBe('full_service_restaurant');
	});

	// ---- Coworking ----
	it('maps coworking variants', () => {
		expect(normalizeConceptKey('co-working')).toBe('coworking');
		expect(normalizeConceptKey('co_working')).toBe('coworking');
		expect(normalizeConceptKey('cowork')).toBe('coworking');
	});
});
