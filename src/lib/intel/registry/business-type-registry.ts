/**
 * Single Canonical Business Type Registry.
 *
 * This file replaces the scattered "concept" maps across the application.
 * All API routers, scoring engines, and threshold checkers MUST pull from here.
 */

export const VALID_BUSINESS_TYPES = new Set([
	'specialty_coffee',
	'bakery',
	'fast_casual',
	'qsr',
	'full_service_restaurant',
	'fine_dining',
	'bar_nightlife',
	'fitness_studio',
	'retail',
	'coworking',
	'medical_office',
	'personal_services',
	'wellness_spa',
	'juice_bar',
	'florist',
	'wellness_beverage',
	'pharmacy',
	'doggie_daycare',
	'tutoring',
	'ethnic_market',
	'generic',
]);

export type ValidBusinessType = 
	| 'specialty_coffee'
	| 'bakery'
	| 'fast_casual'
	| 'qsr'
	| 'full_service_restaurant'
	| 'fine_dining'
	| 'bar_nightlife'
	| 'fitness_studio'
	| 'retail'
	| 'coworking'
	| 'medical_office'
	| 'personal_services'
	| 'wellness_spa'
	| 'juice_bar'
	| 'florist'
	| 'wellness_beverage'
	| 'pharmacy'
	| 'doggie_daycare'
	| 'tutoring'
	| 'ethnic_market'
	| 'generic';


export const BUSINESS_TYPE_ALIAS_MAP: Record<string, ValidBusinessType> = {
	// Onboarding RESTAURANT_SUBTYPES values
	'full_service':             'full_service_restaurant',
	'full-service':             'full_service_restaurant',
	'full service':             'full_service_restaurant',
	'full-service / sit-down':  'full_service_restaurant',
	'sit-down':                 'full_service_restaurant',
	'sit down':                 'full_service_restaurant',
	'restaurant':               'full_service_restaurant',
	'quick_service':            'fast_casual',
	'quick service':            'fast_casual',
	'counter service':          'fast_casual',
	'cafe_bakery':              'bakery',
	'cafe bakery':              'bakery',
	'café bakery':              'bakery',
	// Fitness sub-types
	'boutique_studio':          'fitness_studio',
	'boutique studio':          'fitness_studio',
	'cycling_studio':           'fitness_studio',
	'cycling studio':           'fitness_studio',
	'yoga_studio':              'fitness_studio',
	'yoga studio':              'fitness_studio',
	'pilates_studio':           'fitness_studio',
	'pilates studio':           'fitness_studio',
	'boutique_gym':             'fitness_studio',
	'boutique gym':             'fitness_studio',
	'big_box_gym':              'fitness_studio',
	'crossfit':                 'fitness_studio',
	'personal_training':        'fitness_studio',
	'fitness':                  'fitness_studio',
	'gym':                      'fitness_studio',
	'yoga':                     'fitness_studio',
	'fitness / wellness':       'fitness_studio',
	// Retail sub-types
	'clothing':                 'retail',
	'clothing boutique':        'retail',
	'clothing_boutique':        'retail',
	'apparel':                  'retail',
	'fashion':                  'retail',
	'boutique':                 'retail',
	'home_goods':               'retail',
	'bookstore':                'retail',
	'specialty_food':           'retail',
	'beauty_retail':            'retail',
	'retail / boutique':        'retail',
	// Coffee
	'cafe':                     'specialty_coffee',
	'coffee':                   'specialty_coffee',
	'coffee_shop':              'specialty_coffee',
	'coffee shop':              'specialty_coffee',
	'specialty coffee / café':  'specialty_coffee',
	'specialty coffee':         'specialty_coffee',
	// Bar / nightlife
	'bar':                      'bar_nightlife',
	'nightclub':                'bar_nightlife',
	'nightlife':                'bar_nightlife',
	'bar lounge':               'bar_nightlife',
	'bar_lounge':               'bar_nightlife',
	'bar / nightlife':          'bar_nightlife',
	// Wellness / spa
	'spa':                      'wellness_spa',
	'wellness':                 'wellness_spa',
	'day spa':                  'wellness_spa',
	'spa_wellness':             'wellness_spa',
	'wellness spa':             'wellness_spa',
	// NOTE: wellness_beverage is NOT an alias for wellness_spa — it's its own canonical key
	'wellness_beverage':        'wellness_beverage',
	'wellness beverage':        'wellness_beverage',
	'tea house':                'wellness_beverage',
	'tea room':                 'wellness_beverage',
	'boba':                     'wellness_beverage',
	'bubble tea':               'wellness_beverage',
	'matcha bar':               'wellness_beverage',
	'wellness bar':             'wellness_beverage',
	'wellness cafe':            'wellness_beverage',
	'superfood':                'wellness_beverage',
	// Juice bar
	'smoothie':                 'juice_bar',
	'smoothie bar':             'juice_bar',
	'acai bowl':                'juice_bar',
	'acai':                     'juice_bar',
	'cold press':               'juice_bar',
	'health food':              'juice_bar',
	// Bakery adjacents
	'patisserie':               'bakery',
	'pastry shop':              'bakery',
	'pastry':                   'bakery',
	'bread':                    'bakery',
	'cake shop':                'bakery',
	'donut':                    'bakery',
	'donut shop':               'bakery',
	'donuts':                   'bakery',
	'croissant':                'bakery',
	'boulangerie':              'bakery',
	'bakery / café':            'bakery',
	'bakery/café':              'bakery',
	// Restaurant adjacents
	'diner':                    'fast_casual',
	'eatery':                   'fast_casual',
	'pizza':                    'fast_casual',
	'pizzeria':                 'fast_casual',
	'sandwich shop':            'fast_casual',
	'deli':                     'fast_casual',
	'tacos':                    'fast_casual',
	'taco shop':                'fast_casual',
	'bistro':                   'full_service_restaurant',
	'steakhouse':               'full_service_restaurant',
	'sushi':                    'full_service_restaurant',
	'sushi restaurant':         'full_service_restaurant',
	'burger':                   'qsr',
	'burger joint':             'qsr',
	'fast food':                'qsr',
	'food truck':               'qsr',
	'takeout':                  'qsr',
	// Bar adjacents
	'pub':                      'bar_nightlife',
	'lounge':                   'bar_nightlife',
	'cocktail bar':             'bar_nightlife',
	'wine bar':                 'bar_nightlife',
	'taproom':                  'bar_nightlife',
	'brewery':                  'bar_nightlife',
	'craft beer':               'bar_nightlife',
	'dive bar':                 'bar_nightlife',
	'speakeasy':                'bar_nightlife',
	// Fitness adjacents
	'martial arts':             'fitness_studio',
	'dance studio':             'fitness_studio',
	'boxing gym':               'fitness_studio',
	'spin studio':              'fitness_studio',
	'barre':                    'fitness_studio',
	// Personal services
	'beauty salon':             'personal_services',
	'blow dry bar':             'personal_services',
	'eyebrow threading':        'personal_services',
	'lash studio':              'personal_services',
	'tattoo':                   'personal_services',
	'salon / barbershop':       'personal_services',
	'barbershop / salon':       'personal_services',
	'professional services':    'personal_services',
	// Retail adjacents
	'accessories':              'retail',
	'gift shop':                'retail',
	'stationery':               'retail',
	'home goods':               'retail',
	'jewelry':                  'retail',
	'grocery / market':         'retail',
	'grocery/market':           'retail',
	'grocery':                  'retail',
	'retail store':             'retail',
	// Coffee adjacents
	'café':                     'specialty_coffee',
	'coffeehouse':              'specialty_coffee',
	'espresso bar':             'specialty_coffee',
	// Coworking
	'co-working':               'coworking',
	'co_working':               'coworking',
	'cowork':                   'coworking',
	// Services
	'barber':                   'personal_services',
	'barbershop':               'personal_services',
	'salon':                    'personal_services',
	'hair salon':               'personal_services',
	'nail salon':               'personal_services',
	// Medical
	'dentist':                  'medical_office',
	'medical':                  'medical_office',
	'medical_dental':           'medical_office',
	'medical dental':           'medical_office',
	// Fast casual
	'fast casual':              'fast_casual',
	'fast-casual':              'fast_casual',
	// Display-string variants
	'spa / wellness':           'wellness_spa',
	'full-service restaurant':  'full_service_restaurant',
	'full service restaurant':  'full_service_restaurant',
	'restaurant (fast casual)':       'fast_casual',
	'restaurant (full service)':      'full_service_restaurant',
	'restaurant (full-service)':      'full_service_restaurant',
	'fitness / wellness studio':      'fitness_studio',
	'bar / lounge':                   'bar_nightlife',
	'dental / medical':               'medical_office',
	'grocery / specialty food':       'retail',
	// B3-2.1: Generic fallbacks
	'something_else':                 'generic',
	'something else':                 'generic',
	'other':                          'generic',
	'custom':                         'generic',
	'custom concept':                 'generic',
	'other/custom':                   'generic',
	'other / custom':                 'generic',
	'other / custom concept':         'generic',
	// SEG-02: New underserved segments
	'pharmacy':                       'pharmacy',
	'drugstore':                      'pharmacy',
	'independent pharmacy':           'pharmacy',
	'doggie daycare':                 'doggie_daycare',
	'dog daycare':                    'doggie_daycare',
	'pet daycare':                    'doggie_daycare',
	'dog boarding':                   'doggie_daycare',
	'tutoring center':                'tutoring',
	'tutoring':                       'tutoring',
	'test prep':                      'tutoring',
	'learning center':                'tutoring',
	'ethnic market':                  'ethnic_market',
	'ethnic grocery':                 'ethnic_market',
	'specialty grocer':               'ethnic_market',
	'halal market':                   'ethnic_market',
	'kosher market':                  'ethnic_market',
	'asian market':                   'ethnic_market',
	'latino market':                  'ethnic_market',
	'international market':           'ethnic_market',
};

/**
 * Standardize any string down to its canonical BusinessType key.
 * If unrecognized, returns 'specialty_coffee' as a safe pipeline default.
 * Use 'generic' when capturing "Other/Custom" deliberately.
 */
export function normalizeBusinessType(input: string | undefined | null): ValidBusinessType {
	if (!input) return 'specialty_coffee';
	const lower = input.toLowerCase().trim();
	if (VALID_BUSINESS_TYPES.has(lower)) return lower as ValidBusinessType;
	if (BUSINESS_TYPE_ALIAS_MAP[lower]) return BUSINESS_TYPE_ALIAS_MAP[lower];
	
	const spaced = lower.replace(/_/g, ' ');
	if (BUSINESS_TYPE_ALIAS_MAP[spaced]) return BUSINESS_TYPE_ALIAS_MAP[spaced];
	
	for (const key of VALID_BUSINESS_TYPES) {
		if (lower.includes(key) || key.includes(lower)) return key as ValidBusinessType;
	}

	if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
		console.warn(`[normalizeBusinessType] No mapping for "${input}" — falling back to specialty_coffee.`);
	}
	
	return 'specialty_coffee';
}

/**
 * Central Configuration Profile per Business Type.
 * Eliminates config drift across dynamic-concept-config, location-iq, and six-index.
 */
export interface BusinessTypeConfig {
	label: string;
	archetype: 'impulse' | 'planned' | 'destination' | 'routine_interceptor' | 'destination_pull' | 'need_filler';
	
	// Default base demographics & targets
	tradeRadiusM: number;
	saturationThreshold: number;
	populationMinimum: number;
	incomeMin: number;
	incomeSweet: number;

	// Hardcoded fallback for engines when DOHMH DB is absent
	survivalBaseline: number;

	// Standard Composite Engine Weights (V5)
	weights: {
		transit: number;
		demographics: number;
		competition: number;
		vibrancy: number;
		safety: number;
		momentum: number;
		neighborhoodHealth: number;
		survivalRate: number;
	};

	// Phase 2 LocationIQ Four-Pillar Weights
	locationWeights: {
		niq: number;
		siq: number;
		tiq: number;
		liq: number;
	};
}

// Constructing the unified config. These mappings consolidate weights from the old files.
export const BUSINESS_TYPE_CONFIGS: Record<ValidBusinessType, BusinessTypeConfig> = {
	specialty_coffee: {
		label: 'Specialty Coffee / Café',
		archetype: 'routine_interceptor',
		tradeRadiusM: 400, saturationThreshold: 8, populationMinimum: 8000, incomeMin: 40000, incomeSweet: 75000, survivalBaseline: 52,
		weights: { transit: 0.08, demographics: 0.02, competition: 0.08, vibrancy: 0.03, safety: 0.01, momentum: 0.02, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.40, tiq: 0.20, liq: 0.10 }
	},
	qsr: {
		label: 'Quick-Service Restaurant',
		archetype: 'routine_interceptor',
		tradeRadiusM: 800, saturationThreshold: 12, populationMinimum: 20000, incomeMin: 30000, incomeSweet: 55000, survivalBaseline: 48,
		weights: { transit: 0.08, demographics: 0.02, competition: 0.10, vibrancy: 0.02, safety: 0.01, momentum: 0.02, neighborhoodHealth: 0.27, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.35, tiq: 0.25, liq: 0.10 }
	},
	full_service_restaurant: {
		label: 'Full-Service Restaurant',
		archetype: 'destination_pull',
		tradeRadiusM: 2000, saturationThreshold: 20, populationMinimum: 10000, incomeMin: 45000, incomeSweet: 85000, survivalBaseline: 45,
		weights: { transit: 0.06, demographics: 0.03, competition: 0.08, vibrancy: 0.03, safety: 0.01, momentum: 0.03, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.20, tiq: 0.35, liq: 0.15 }
	},
	fitness_studio: {
		label: 'Fitness Studio',
		archetype: 'need_filler',
		tradeRadiusM: 1500, saturationThreshold: 10, populationMinimum: 12000, incomeMin: 50000, incomeSweet: 85000, survivalBaseline: 55,
		weights: { transit: 0.06, demographics: 0.03, competition: 0.10, vibrancy: 0.02, safety: 0.01, momentum: 0.03, neighborhoodHealth: 0.27, survivalRate: 0.48 },
		locationWeights: { niq: 0.25, siq: 0.35, tiq: 0.20, liq: 0.20 }
	},
	retail: {
		label: 'Retail',
		archetype: 'destination_pull',
		tradeRadiusM: 1500, saturationThreshold: 15, populationMinimum: 10000, incomeMin: 50000, incomeSweet: 90000, survivalBaseline: 48,
		weights: { transit: 0.08, demographics: 0.02, competition: 0.07, vibrancy: 0.04, safety: 0.01, momentum: 0.02, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.40, tiq: 0.20, liq: 0.10 }
	},
	bar_nightlife: {
		label: 'Bar / Nightlife',
		archetype: 'destination_pull',
		tradeRadiusM: 2000, saturationThreshold: 15, populationMinimum: 10000, incomeMin: 40000, incomeSweet: 70000, survivalBaseline: 42,
		weights: { transit: 0.05, demographics: 0.02, competition: 0.07, vibrancy: 0.04, safety: 0.01, momentum: 0.04, neighborhoodHealth: 0.28, survivalRate: 0.49 },
		locationWeights: { niq: 0.25, siq: 0.20, tiq: 0.35, liq: 0.20 }
	},
	coworking: {
		label: 'Co-Working Space',
		archetype: 'need_filler',
		tradeRadiusM: 3000, saturationThreshold: 5, populationMinimum: 20000, incomeMin: 70000, incomeSweet: 100000, survivalBaseline: 60,
		weights: { transit: 0.07, demographics: 0.02, competition: 0.08, vibrancy: 0.02, safety: 0.01, momentum: 0.04, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.25, siq: 0.30, tiq: 0.20, liq: 0.25 }
	},
	personal_services: {
		label: 'Salon / Spa / Barbershop',
		archetype: 'need_filler',
		tradeRadiusM: 800, saturationThreshold: 12, populationMinimum: 8000, incomeMin: 40000, incomeSweet: 70000, survivalBaseline: 58,
		weights: { transit: 0.06, demographics: 0.03, competition: 0.08, vibrancy: 0.03, safety: 0.01, momentum: 0.03, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.25, tiq: 0.25, liq: 0.20 }
	},
	medical_office: {
		label: 'Medical / Dental Office',
		archetype: 'need_filler',
		tradeRadiusM: 3000, saturationThreshold: 8, populationMinimum: 10000, incomeMin: 45000, incomeSweet: 80000, survivalBaseline: 75,
		weights: { transit: 0.06, demographics: 0.03, competition: 0.07, vibrancy: 0.02, safety: 0.01, momentum: 0.05, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.25, tiq: 0.20, liq: 0.25 }
	},
	// Newer segment values
	fast_casual: {
		label: 'Fast Casual Restaurant',
		archetype: 'routine_interceptor',
		tradeRadiusM: 800, saturationThreshold: 12, populationMinimum: 15000, incomeMin: 35000, incomeSweet: 65000, survivalBaseline: 48,
		weights: { transit: 0.08, demographics: 0.02, competition: 0.10, vibrancy: 0.02, safety: 0.01, momentum: 0.02, neighborhoodHealth: 0.27, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.35, tiq: 0.25, liq: 0.10 }
	},
	bakery: {
		label: 'Bakery / Café',
		archetype: 'routine_interceptor',
		tradeRadiusM: 500, saturationThreshold: 6, populationMinimum: 10000, incomeMin: 40000, incomeSweet: 75000, survivalBaseline: 52,
		weights: { transit: 0.08, demographics: 0.02, competition: 0.08, vibrancy: 0.03, safety: 0.01, momentum: 0.02, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.40, tiq: 0.20, liq: 0.10 }
	},
	wellness_spa: {
		label: 'Wellness / Spa',
		archetype: 'destination_pull',
		tradeRadiusM: 3000, saturationThreshold: 8, populationMinimum: 12000, incomeMin: 60000, incomeSweet: 95000, survivalBaseline: 60,
		weights: { transit: 0.05, demographics: 0.04, competition: 0.08, vibrancy: 0.03, safety: 0.01, momentum: 0.03, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.25, tiq: 0.25, liq: 0.20 }
	},
	wellness_beverage: {
		label: 'Wellness Beverage / Tea',
		archetype: 'routine_interceptor',
		tradeRadiusM: 500, saturationThreshold: 8, populationMinimum: 15000, incomeMin: 45000, incomeSweet: 75000, survivalBaseline: 50,
		weights: { transit: 0.08, demographics: 0.02, competition: 0.08, vibrancy: 0.03, safety: 0.01, momentum: 0.02, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.40, tiq: 0.20, liq: 0.10 }
	},
	juice_bar: {
		label: 'Juice / Smoothie Bar',
		archetype: 'routine_interceptor',
		tradeRadiusM: 500, saturationThreshold: 5, populationMinimum: 15000, incomeMin: 50000, incomeSweet: 90000, survivalBaseline: 50,
		weights: { transit: 0.08, demographics: 0.03, competition: 0.08, vibrancy: 0.03, safety: 0.01, momentum: 0.02, neighborhoodHealth: 0.27, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.40, tiq: 0.20, liq: 0.10 }
	},
	florist: {
		label: 'Florist',
		archetype: 'destination_pull',
		tradeRadiusM: 1200, saturationThreshold: 3, populationMinimum: 10000, incomeMin: 55000, incomeSweet: 95000, survivalBaseline: 55,
		weights: { transit: 0.07, demographics: 0.03, competition: 0.06, vibrancy: 0.03, safety: 0.01, momentum: 0.03, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.35, tiq: 0.25, liq: 0.10 }
	},
	// Missing specific overrides for newest underserved segments - mapped conservatively
	pharmacy: {
		label: 'Pharmacy',
		archetype: 'need_filler',
		tradeRadiusM: 800, saturationThreshold: 4, populationMinimum: 15000, incomeMin: 30000, incomeSweet: 65000, survivalBaseline: 65,
		weights: { transit: 0.07, demographics: 0.03, competition: 0.08, vibrancy: 0.03, safety: 0.01, momentum: 0.03, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.30, tiq: 0.20, liq: 0.20 }
	},
	doggie_daycare: {
		label: 'Doggie Daycare',
		archetype: 'destination_pull',
		tradeRadiusM: 2000, saturationThreshold: 3, populationMinimum: 12000, incomeMin: 65000, incomeSweet: 100000, survivalBaseline: 55,
		weights: { transit: 0.05, demographics: 0.04, competition: 0.08, vibrancy: 0.03, safety: 0.01, momentum: 0.04, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.30, tiq: 0.20, liq: 0.20 }
	},
	tutoring: {
		label: 'Tutoring Center',
		archetype: 'need_filler',
		tradeRadiusM: 3000, saturationThreshold: 5, populationMinimum: 15000, incomeMin: 60000, incomeSweet: 95000, survivalBaseline: 62,
		weights: { transit: 0.07, demographics: 0.04, competition: 0.07, vibrancy: 0.02, safety: 0.01, momentum: 0.03, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.35, siq: 0.25, tiq: 0.20, liq: 0.20 }
	},
	ethnic_market: {
		label: 'Ethnic Market / Grocery',
		archetype: 'destination_pull',
		tradeRadiusM: 5000, saturationThreshold: 4, populationMinimum: 10000, incomeMin: 30000, incomeSweet: 60000, survivalBaseline: 50,
		weights: { transit: 0.08, demographics: 0.05, competition: 0.06, vibrancy: 0.03, safety: 0.01, momentum: 0.02, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.35, siq: 0.35, tiq: 0.20, liq: 0.10 }
	},
	fine_dining: {
		label: 'Fine Dining',
		archetype: 'destination_pull',
		tradeRadiusM: 5000, saturationThreshold: 5, populationMinimum: 20000, incomeMin: 120000, incomeSweet: 250000, survivalBaseline: 40,
		weights: { transit: 0.04, demographics: 0.06, competition: 0.05, vibrancy: 0.05, safety: 0.01, momentum: 0.04, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.20, tiq: 0.40, liq: 0.10 }
	},
	generic: {
		label: 'Custom Concept',
		archetype: 'destination_pull',
		tradeRadiusM: 1500, saturationThreshold: 10, populationMinimum: 10000, incomeMin: 45000, incomeSweet: 75000, survivalBaseline: 52,
		weights: { transit: 0.07, demographics: 0.03, competition: 0.08, vibrancy: 0.03, safety: 0.01, momentum: 0.03, neighborhoodHealth: 0.28, survivalRate: 0.48 },
		locationWeights: { niq: 0.30, siq: 0.30, tiq: 0.25, liq: 0.15 }
	}
};
