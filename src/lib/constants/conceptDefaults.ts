/**
 * conceptDefaults.ts — Single source of truth for per-concept UI defaults.
 *
 * These are the startup cost, rent, sqft, revenue, ticket, team, and SDE values
 * shown to founders in the Vision IQ / Concept page before they override with their own.
 *
 * NOTE: Revenue model logic lives in conceptKPIs.ts.
 * These UI defaults are the flat "quick-fill" values surfaced in the concept form.
 *
 * #26: Replaces the inline CONCEPT_SMART_DEFAULTS object in vision/concept/+page.svelte.
 */

export interface ConceptUIDefaults {
  startup:      number;
  rent:         number;
  sqft:         number;
  revenue:      number;
  ticket:       number;
  transactions: number;
  team:         number;
  sde:          number;
}

export const CONCEPT_UI_DEFAULTS: Record<string, ConceptUIDefaults> = {
  specialty_coffee:        { startup: 150000, rent: 5000,  sqft: 900,  revenue: 380000,  ticket: 8.75, transactions: 180, team: 3,  sde: 55000  },
  coffee_shop:             { startup: 150000, rent: 5000,  sqft: 900,  revenue: 380000,  ticket: 8.75, transactions: 180, team: 3,  sde: 55000  },
  bakery:                  { startup: 180000, rent: 5000,  sqft: 1000, revenue: 420000,  ticket: 12,   transactions: 120, team: 4,  sde: 60000  },
  fast_casual:             { startup: 280000, rent: 10000, sqft: 1800, revenue: 620000,  ticket: 16,   transactions: 140, team: 8,  sde: 80000  },
  full_service_restaurant: { startup: 450000, rent: 14000, sqft: 2400, revenue: 900000,  ticket: 52,   transactions: 60,  team: 14, sde: 100000 },
  fine_dining:             { startup: 600000, rent: 18000, sqft: 2800, revenue: 1200000, ticket: 95,   transactions: 40,  team: 16, sde: 130000 },
  bar_nightlife:           { startup: 350000, rent: 10000, sqft: 2000, revenue: 650000,  ticket: 24,   transactions: 100, team: 9,  sde: 85000  },
  fitness_studio:          { startup: 220000, rent: 7000,  sqft: 2000, revenue: 360000,  ticket: 25,   transactions: 45,  team: 4,  sde: 65000  },
  retail:                  { startup: 200000, rent: 8000,  sqft: 1200, revenue: 480000,  ticket: 65,   transactions: 28,  team: 3,  sde: 60000  },
  coworking:               { startup: 400000, rent: 9000,  sqft: 5000, revenue: 480000,  ticket: 350,  transactions: 50,  team: 3,  sde: 70000  },
  medical_office:          { startup: 300000, rent: 8000,  sqft: 1400, revenue: 540000,  ticket: 150,  transactions: 12,  team: 5,  sde: 140000 },
  medical_dental:          { startup: 300000, rent: 8000,  sqft: 1400, revenue: 540000,  ticket: 150,  transactions: 12,  team: 5,  sde: 140000 },
  personal_services:       { startup: 80000,  rent: 4000,  sqft: 600,  revenue: 195000,  ticket: 35,   transactions: 18,  team: 2,  sde: 48000  },
  barbershop:              { startup: 80000,  rent: 4000,  sqft: 600,  revenue: 195000,  ticket: 35,   transactions: 18,  team: 2,  sde: 48000  },
  wellness_spa:            { startup: 250000, rent: 6000,  sqft: 1600, revenue: 400000,  ticket: 95,   transactions: 18,  team: 6,  sde: 75000  },
  spa_wellness:            { startup: 250000, rent: 6000,  sqft: 1600, revenue: 400000,  ticket: 95,   transactions: 18,  team: 6,  sde: 75000  },
};

export function getConceptDefaults(conceptKey: string): ConceptUIDefaults {
  return CONCEPT_UI_DEFAULTS[conceptKey] ?? CONCEPT_UI_DEFAULTS['specialty_coffee'];
}
