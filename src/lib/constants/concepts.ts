/**
 * concepts.ts — Single source of truth for the concept/business-type registry.
 *
 * Replaces all inline BUSINESS_TYPES arrays and friendlyBizType() label maps
 * scattered across onboarding, overview, layout, and location pages.
 *
 * #30: replaces BUSINESS_TYPES in onboarding/+page.svelte
 * #31: replaces businessTypes[] in overview/+page.svelte
 * #33: replaces inline label mapping in +layout.svelte and location pages
 */

import type { ValidBusinessType } from '../intel/registry/business-type-registry';

export interface ConceptEntry {
  /** Canonical snake_case key — used in DB, scoring engine, session storage */
  key: ValidBusinessType;
  /** Short display label shown in UI dropdowns and pills */
  label: string;
  /** Longer display name for reports and headers (falls back to label) */
  displayName?: string;
}

/**
 * Master concept list. Order matters — this is the order shown in dropdowns.
 * Keys must match CONCEPT_UI_DEFAULTS in conceptDefaults.ts and CONCEPT_KPIS.
 */
export const CONCEPT_REGISTRY: ConceptEntry[] = [
  { key: 'specialty_coffee',        label: 'Coffee / Café',             displayName: 'Specialty Coffee / Café' },
  { key: 'bakery',                  label: 'Bakery / Café',             displayName: 'Bakery / Café' },
  { key: 'fast_casual',             label: 'Fast Casual',               displayName: 'Fast Casual Restaurant' },
  { key: 'full_service_restaurant', label: 'Full-Service Restaurant',   displayName: 'Full-Service Restaurant' },
  { key: 'fine_dining',             label: 'Fine Dining',               displayName: 'Fine Dining' },
  { key: 'bar_nightlife',           label: 'Bar / Lounge',              displayName: 'Bar / Lounge' },
  { key: 'fitness_studio',          label: 'Fitness / Gym',             displayName: 'Fitness / Wellness Studio' },
  { key: 'retail',                  label: 'Retail',                    displayName: 'Retail Store' },
  { key: 'coworking',               label: 'Coworking',                 displayName: 'Coworking Space' },
  { key: 'wellness_spa',            label: 'Spa / Wellness',            displayName: 'Spa / Wellness' },
  { key: 'personal_services',       label: 'Personal Services',         displayName: 'Personal Services' },
  { key: 'barbershop',              label: 'Barbershop / Salon',        displayName: 'Barbershop / Salon' },
  { key: 'medical_office',          label: 'Dental / Medical',          displayName: 'Dental / Medical Office' },
  { key: 'something_else',          label: 'Other',                     displayName: 'Custom Concept' },
];

/**
 * Flat label lookup: conceptKey → display label.
 * Covers canonical keys, legacy onboarding keys, and BIZ_TYPE_MAP display strings.
 * Used to replace all inline `friendlyBizType()` switch/map functions.
 */
export const CONCEPT_LABEL_MAP: Record<string, string> = {
  // ── Canonical keys ────────────────────────────────────────────────────────
  specialty_coffee:        'Coffee / Café',
  coffee_shop:             'Coffee / Café',
  bakery:                  'Bakery / Café',
  fast_casual:             'Fast Casual Restaurant',
  qsr:                     'Quick Service Restaurant',
  full_service_restaurant: 'Full-Service Restaurant',
  fine_dining:             'Fine Dining',
  bar_nightlife:           'Bar / Lounge',
  fitness_studio:          'Fitness / Wellness',
  retail:                  'Retail',
  florist:                 'Florist',
  coworking:               'Coworking',
  medical_office:          'Dental / Medical',
  medical_dental:          'Dental / Medical',
  personal_services:       'Personal Services',
  barbershop:              'Barbershop / Salon',
  wellness_spa:            'Spa / Wellness',
  spa_wellness:            'Spa / Wellness',
  juice_bar:               'Juice Bar',
  wellness_beverage:       'Wellness Beverage',
  something_else:          'Custom Concept',
  // ── BIZ_TYPE_MAP display strings (written by store.svelte.ts) ─────────────
  'Restaurant (Fast Casual)':   'Fast Casual Restaurant',
  'Restaurant (Full Service)':  'Full-Service Restaurant',
  'Fitness / Wellness Studio':  'Fitness / Wellness',
  'Barbershop / Salon':         'Barbershop / Salon',
  'Retail Store':               'Retail',
  'Grocery / Specialty Food':   'Grocery / Market',
  'Professional Services':      'Professional Services',
  'Bar / Lounge':               'Bar / Lounge',
  'Spa / Wellness':             'Spa / Wellness',
  'Dental / Medical':           'Dental / Medical',
  'Custom Concept':             'Custom Concept',
  // ── Legacy / raw onboarding keys ─────────────────────────────────────────
  coffee:          'Coffee / Café',
  restaurant:      'Restaurant',
  gym:             'Fitness / Wellness',
  fitness:         'Fitness / Wellness',
  dentist:         'Professional Services',
  spa:             'Spa / Wellness',
  bodega:          'Grocery / Market',
  barber:          'Barbershop / Salon',
  boutique:        'Retail',
  bar:             'Bar / Lounge',
};

/**
 * Resolve a raw concept key (from session, launchpad, or onboarding)
 * to a friendly display label. Returns 'Your Business' for unknown/empty keys.
 */
export function getConceptLabel(raw: string | undefined | null): string {
  if (!raw || raw === 'Other') return 'Your Business';
  return CONCEPT_LABEL_MAP[raw] || raw;
}

/**
 * Onboarding picker list — maps to { key, label } pairs shown to new users.
 * Only concepts with complete scoring pipelines (config + segment + V4 scorer + location-iq).
 * C-1: Removed wellness_spa, coworking, barbershop, something_else — all had broken paths.
 */
export const ONBOARDING_CONCEPT_LIST: Array<{ key: ValidBusinessType; label: string }> = [
  { key: 'specialty_coffee',        label: 'Coffee / Café' },
  { key: 'full_service_restaurant', label: 'Restaurant' },
  { key: 'fitness_studio',          label: 'Fitness / Gym' },
  { key: 'retail',                  label: 'Retail' },
  { key: 'bar_nightlife',           label: 'Bar / Lounge' },
  { key: 'medical_office',          label: 'Dental / Medical' },
];
