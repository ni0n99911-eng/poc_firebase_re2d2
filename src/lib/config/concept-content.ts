/**
 * Single source of truth for ALL concept-specific content and defaults.
 *
 * Every file that needs concept-aware text, defaults, or display strings
 * should import from here. This eliminates scattered hardcoded values and
 * ensures consistency across onboarding, CoPilot, scoring, and export.
 *
 * Canonical keys match businessTypeNormalizer.ts output.
 */

export interface ConceptContentEntry {
	/** Human-readable label (e.g., "coffee shop") */
	label: string;
	/** Short label for tight UI (e.g., "Coffee") */
	shortLabel: string;
	/** Bad/good differentiator examples for onboarding */
	differentiatorExample: { bad: string; good: string };
	/** Default average check ($) if user doesn't provide one */
	defaultAvgCheck: number;
	/** Target customer age range [lo, hi] */
	defaultTargetAge: [number, number];
	/** Ideal price range [lo, hi] in $ */
	idealPriceRange: [number, number];
	/** Price ceiling — max plausible avg check before penalty */
	priceCeiling: number;
	/** Peak operating hours */
	peakHours: 'morning' | 'lunch' | 'evening' | 'all_day';
	/** Location archetype */
	archetype: 'impulse' | 'planned' | 'destination';
}

import type { ValidBusinessType } from './intel/registry/business-type-registry';

export const CONCEPT_CONTENT: Record<ValidBusinessType | string, ConceptContentEntry> = {
	specialty_coffee: {
		label: 'coffee shop',
		shortLabel: 'Coffee',
		differentiatorExample: { bad: 'Great coffee', good: 'Single-origin roastery, $6 cap, no-laptop policy' },
		defaultAvgCheck: 6,
		defaultTargetAge: [22, 40],
		idealPriceRange: [4, 8],
		priceCeiling: 20,
		peakHours: 'morning',
		archetype: 'impulse',
	},
	bakery: {
		label: 'bakery',
		shortLabel: 'Bakery',
		differentiatorExample: { bad: 'Good bread', good: 'Sourdough-only menu, gluten-free line, 5am daily fresh, subscription model' },
		defaultAvgCheck: 10,
		defaultTargetAge: [25, 55],
		idealPriceRange: [5, 15],
		priceCeiling: 25,
		peakHours: 'morning',
		archetype: 'impulse',
	},
	fast_casual: {
		label: 'fast casual restaurant',
		shortLabel: 'Fast Casual',
		differentiatorExample: { bad: 'Fresh ingredients', good: 'Build-your-own grain bowls, 90-second service, loyalty app with 20% repeat rate' },
		defaultAvgCheck: 16,
		defaultTargetAge: [22, 45],
		idealPriceRange: [10, 22],
		priceCeiling: 40,
		peakHours: 'lunch',
		archetype: 'impulse',
	},
	qsr: {
		label: 'quick-service restaurant',
		shortLabel: 'QSR',
		differentiatorExample: { bad: 'Fast food', good: 'Halal-certified menu, drive-through + app ordering, $5 combo with real ingredients' },
		defaultAvgCheck: 10,
		defaultTargetAge: [18, 45],
		idealPriceRange: [5, 15],
		priceCeiling: 30,
		peakHours: 'lunch',
		archetype: 'impulse',
	},
	full_service_restaurant: {
		label: 'full-service restaurant',
		shortLabel: 'Restaurant',
		differentiatorExample: { bad: 'Good food', good: 'Farm-to-table prix fixe, open kitchen, natural wine only' },
		defaultAvgCheck: 45,
		defaultTargetAge: [28, 60],
		idealPriceRange: [25, 80],
		priceCeiling: 150,
		peakHours: 'evening',
		archetype: 'planned',
	},
	bar_nightlife: {
		label: 'bar / nightlife venue',
		shortLabel: 'Bar',
		differentiatorExample: { bad: 'Good drinks', good: 'Speakeasy craft cocktails, live jazz Thursdays, industry night pricing' },
		defaultAvgCheck: 18,
		defaultTargetAge: [25, 45],
		idealPriceRange: [12, 25],
		priceCeiling: 80,
		peakHours: 'evening',
		archetype: 'planned',
	},
	fitness_studio: {
		label: 'fitness studio',
		shortLabel: 'Fitness',
		differentiatorExample: { bad: 'Good workouts', good: 'HIIT + recovery combo, 5am classes for finance workers, heart-rate tracking' },
		defaultAvgCheck: 35,
		defaultTargetAge: [22, 45],
		idealPriceRange: [20, 50],
		priceCeiling: 100,
		peakHours: 'morning',
		archetype: 'destination',
	},
	wellness_spa: {
		label: 'spa / wellness studio',
		shortLabel: 'Spa',
		differentiatorExample: { bad: 'Relaxation', good: 'Medical-grade facials, 30-min express treatments, membership model' },
		defaultAvgCheck: 120,
		defaultTargetAge: [28, 55],
		idealPriceRange: [60, 250],
		priceCeiling: 400,
		peakHours: 'all_day',
		archetype: 'destination',
	},
	personal_services: {
		label: 'personal services business',
		shortLabel: 'Salon',
		differentiatorExample: { bad: 'Good service', good: 'Curly-hair specialist, organic products only, online booking with style gallery' },
		defaultAvgCheck: 60,
		defaultTargetAge: [22, 55],
		idealPriceRange: [30, 120],
		priceCeiling: 120,
		peakHours: 'all_day',
		archetype: 'destination',
	},
	retail: {
		label: 'retail store',
		shortLabel: 'Retail',
		differentiatorExample: { bad: 'Nice products', good: 'Curated local designers only, personal styling appointments, pop-up rotation' },
		defaultAvgCheck: 75,
		defaultTargetAge: [22, 55],
		idealPriceRange: [20, 200],
		priceCeiling: 300,
		peakHours: 'all_day',
		archetype: 'impulse',
	},
	coworking: {
		label: 'coworking space',
		shortLabel: 'Cowork',
		differentiatorExample: { bad: 'Nice workspace', good: 'Soundproof podcast booths, member-only events, 24/7 access with bike storage' },
		defaultAvgCheck: 350,
		defaultTargetAge: [25, 45],
		idealPriceRange: [200, 600],
		priceCeiling: 2000,
		peakHours: 'all_day',
		archetype: 'destination',
	},
	medical_office: {
		label: 'medical office',
		shortLabel: 'Medical',
		differentiatorExample: { bad: 'Good care', good: 'Same-day appointments, bilingual staff, transparent pricing, no insurance needed' },
		defaultAvgCheck: 200,
		defaultTargetAge: [25, 65],
		idealPriceRange: [100, 500],
		priceCeiling: 600,
		peakHours: 'all_day',
		archetype: 'destination',
	},
	wellness_beverage: {
		label: 'wellness beverage concept',
		shortLabel: 'Tea/Matcha',
		differentiatorExample: { bad: 'Good tea', good: 'Ceremonial matcha bar, adaptogen menu, mindfulness space with hourly tastings' },
		defaultAvgCheck: 8,
		defaultTargetAge: [22, 40],
		idealPriceRange: [5, 12],
		priceCeiling: 30,
		peakHours: 'morning',
		archetype: 'impulse',
	},
	juice_bar: {
		label: 'juice bar',
		shortLabel: 'Juice',
		differentiatorExample: { bad: 'Fresh juice', good: 'Cold-pressed daily, functional wellness shots, gym partnership discounts' },
		defaultAvgCheck: 12,
		defaultTargetAge: [22, 40],
		idealPriceRange: [8, 18],
		priceCeiling: 35,
		peakHours: 'morning',
		archetype: 'impulse',
	},
};

/**
 * Get concept content with fallback to specialty_coffee defaults.
 */
export function getConceptContent(conceptKey: ValidBusinessType | string): ConceptContentEntry {
	return CONCEPT_CONTENT[conceptKey] || CONCEPT_CONTENT['specialty_coffee'];
}

/**
 * Get human-readable label for a concept key.
 */
export function conceptLabel(conceptKey: ValidBusinessType | string): string {
	return CONCEPT_CONTENT[conceptKey]?.label || conceptKey.replace(/_/g, ' ');
}
