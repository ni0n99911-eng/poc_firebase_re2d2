/**
 * RE² Dynamic Concept Config Builder
 *
 * PROBLEM:
 * The current system uses static concept configs. A $4 coffee cart and a $12
 * pour-over bar both map to "specialty_coffee" with the same weights.
 *
 * SOLUTION:
 * 3-4 concept-specific questions per business type. Each answer reshapes the
 * concept config itself — changing income ranges, competition categories.
 */

import { BUSINESS_TYPE_CONFIGS } from './registry/business-type-registry';
import type { ValidBusinessType } from './registry/business-type-registry';

// ─── Types ───

export interface ConceptQuestion {
	id: string;
	question: string;
	options: ConceptOption[];
	/** Why this question matters for scoring — shown to user */
	rationale: string;
	/** Which config fields this question modifies */
	affects: string[];
	/** Estimated max score impact in points */
	maxImpact: number;
}

export interface ConceptOption {
	value: string;
	label: string;
	/** Short explanation shown to user */
	hint?: string;
	/** Config modifications when this option is selected */
	configOverrides: Partial<DynamicConceptConfig>;
}

export interface DynamicConceptConfig {
	// Competition
	competitionCategories: string[];
	saturationThreshold: number;
	tradeRadiusM: number;

	// Income
	incomeMin: number;
	incomeSweet: number;

	// Traffic
	transitDependency: number;
	footTrafficDependency: number;
	trafficPattern: 'morning' | 'lunch' | 'evening' | 'allday' | 'weekend' | 'appointment';

	// Demographics
	targetAgeRange: [number, number];
	priceRange: [number, number]; // 1=$ to 4=$$$$

	// Archetype
	archetype: 'routine_interceptor' | 'destination_pull' | 'need_filler';

	// Weight overrides (optional — override V4 dimension weights)
	weightOverrides?: {
		competition?: number;
		priceIncomeFit?: number;
		accessibility?: number;
		vibrancy?: number;
		demographics?: number;
		marketProof?: number;
	};
}

// ─── Base Configs (starting point before user answers) ───

const BASE_CONFIGS: Record<string, DynamicConceptConfig> = {
	// ─── COFFEE & BEVERAGE ───
	// NOTE (Coffee Scoring Rewire, April 2026): saturationThreshold=8 applies to the
	// full 400m trade area. D09-1 in location-iq.ts uses saturation=2 for Ring 1 (100m).
	// Both coexist with ring-aware competition scoring (Decision D3).
	// Coffee scoring now uses 6-dimension model in six-index.ts — these configs feed
	// the Dynamic Vision IQ system, NOT the location composite.
	specialty_coffee: {
		competitionCategories: ['cafe', 'coffee_shop', 'bakery'],
		saturationThreshold: 8,
		tradeRadiusM: 400,
		incomeMin: 40000,
		incomeSweet: 75000,
		transitDependency: 0.7,
		footTrafficDependency: 0.8,
		trafficPattern: 'morning',
		targetAgeRange: [24, 42],
		priceRange: [1, 2],
		archetype: 'routine_interceptor',
	},
	juice_bar: {
		competitionCategories: ['juice_bar', 'smoothie', 'health_food_store', 'cafe'],
		saturationThreshold: 5,
		tradeRadiusM: 500,
		incomeMin: 50000,
		incomeSweet: 90000,
		transitDependency: 0.7,
		footTrafficDependency: 0.85,
		trafficPattern: 'morning',
		targetAgeRange: [22, 40],
		priceRange: [2, 3],
		archetype: 'routine_interceptor',
	},

	// ─── FOOD ───
	full_service_restaurant: {
		competitionCategories: ['restaurant', 'meal_takeaway', 'food'],
		saturationThreshold: 20,
		tradeRadiusM: 2000,
		incomeMin: 45000,
		incomeSweet: 85000,
		transitDependency: 0.5,
		footTrafficDependency: 0.4,
		trafficPattern: 'evening',
		targetAgeRange: [28, 55],
		priceRange: [2, 3],
		archetype: 'destination_pull',
	},
	qsr: {
		competitionCategories: ['restaurant', 'meal_takeaway', 'meal_delivery', 'fast_food'],
		saturationThreshold: 12,
		tradeRadiusM: 800,
		incomeMin: 30000,
		incomeSweet: 55000,
		transitDependency: 0.6,
		footTrafficDependency: 0.7,
		trafficPattern: 'allday',
		targetAgeRange: [18, 45],
		priceRange: [1, 1],
		archetype: 'routine_interceptor',
	},
	bakery: {
		competitionCategories: ['bakery', 'cafe', 'coffee_shop'],
		saturationThreshold: 6,
		tradeRadiusM: 500,
		incomeMin: 40000,
		incomeSweet: 75000,
		transitDependency: 0.6,
		footTrafficDependency: 0.8,
		trafficPattern: 'morning',
		targetAgeRange: [25, 55],
		priceRange: [1, 2],
		archetype: 'routine_interceptor',
	},
	bar_nightlife: {
		competitionCategories: ['bar', 'night_club', 'lounge'],
		saturationThreshold: 15,
		tradeRadiusM: 2000,
		incomeMin: 40000,
		incomeSweet: 70000,
		transitDependency: 0.6,
		footTrafficDependency: 0.3,
		trafficPattern: 'evening',
		targetAgeRange: [21, 40],
		priceRange: [2, 3],
		archetype: 'destination_pull',
	},

	// ─── FITNESS & WELLNESS ───
	fitness_studio: {
		competitionCategories: ['gym', 'fitness_center', 'yoga_studio'],
		saturationThreshold: 10,
		tradeRadiusM: 1500,
		incomeMin: 50000,
		incomeSweet: 85000,
		transitDependency: 0.4,
		footTrafficDependency: 0.3,
		trafficPattern: 'allday',
		targetAgeRange: [22, 45],
		priceRange: [2, 3],
		archetype: 'need_filler',
	},
	personal_services: {
		competitionCategories: ['hair_care', 'beauty_salon', 'spa'],
		saturationThreshold: 12,
		tradeRadiusM: 800,
		incomeMin: 40000,
		incomeSweet: 70000,
		transitDependency: 0.3,
		footTrafficDependency: 0.4,
		trafficPattern: 'appointment',
		targetAgeRange: [25, 55],
		priceRange: [2, 2],
		archetype: 'need_filler',
	},

	// ─── MEDICAL ───
	medical_office: {
		competitionCategories: ['doctor', 'dentist', 'health'],
		saturationThreshold: 8,
		tradeRadiusM: 3000,
		incomeMin: 45000,
		incomeSweet: 80000,
		transitDependency: 0.5,
		footTrafficDependency: 0.2,
		trafficPattern: 'appointment',
		targetAgeRange: [30, 70],
		priceRange: [3, 4],
		archetype: 'need_filler',
	},

	// ─── RETAIL ───
	retail: {
		competitionCategories: ['clothing_store', 'store', 'shopping_mall'],
		saturationThreshold: 15,
		tradeRadiusM: 1500,
		incomeMin: 50000,
		incomeSweet: 90000,
		transitDependency: 0.4,
		footTrafficDependency: 0.5,
		trafficPattern: 'weekend',
		targetAgeRange: [22, 50],
		priceRange: [2, 3],
		archetype: 'destination_pull',
	},

	// ─── OTHER ───
	florist: {
		competitionCategories: ['florist', 'store', 'gift_shop'],
		saturationThreshold: 3,
		tradeRadiusM: 1200,
		incomeMin: 55000,
		incomeSweet: 95000,
		transitDependency: 0.4,
		footTrafficDependency: 0.6,
		trafficPattern: 'allday',
		targetAgeRange: [28, 60],
		priceRange: [2, 3],
		archetype: 'destination_pull',
	},
};


// ═══════════════════════════════════════════════════════════════
//  CONCEPT-SPECIFIC QUESTIONS
//  Each business type gets 3-4 questions ranked by score impact
// ═══════════════════════════════════════════════════════════════

const CONCEPT_QUESTIONS: Record<string, ConceptQuestion[]> = {

	// ─── COFFEE & BEVERAGE ───
	specialty_coffee: [
		{
			id: 'coffee_price',
			question: 'What\'s your price point for a typical drink?',
			rationale: 'A $4 drip coffee needs volume and competes with everyone. A $10+ specialty drink needs destination customers with high income.',
			affects: ['incomeMin', 'incomeSweet', 'saturationThreshold', 'competitionCategories', 'archetype'],
			maxImpact: 18,
			options: [
				{
					value: 'budget', label: 'Under $5 (drip, basic espresso)',
					hint: 'Competes with bodegas, Dunkin\', Starbucks — needs raw volume',
					configOverrides: {
						incomeMin: 28000, incomeSweet: 50000,
						competitionCategories: ['cafe', 'coffee_shop', 'bakery', 'meal_takeaway', 'convenience_store'],
						saturationThreshold: 15,
						transitDependency: 0.85, footTrafficDependency: 0.90,
						archetype: 'routine_interceptor',
						priceRange: [1, 1],
					},
				},
				{
					value: 'mid', label: '$5-8 (specialty lattes, single origin)',
					hint: 'Core specialty coffee range — competes with indie cafes',
					configOverrides: {
						incomeMin: 45000, incomeSweet: 80000,
						competitionCategories: ['cafe', 'coffee_shop'],
						saturationThreshold: 8,
						priceRange: [2, 2],
					},
				},
				{
					value: 'premium', label: '$8-15 (pour-over bar, rare beans, tasting flights)',
					hint: 'Destination experience — competes with specialty only, needs affluent area',
					configOverrides: {
						incomeMin: 75000, incomeSweet: 130000,
						competitionCategories: ['cafe', 'specialty_coffee'],
						saturationThreshold: 3,
						transitDependency: 0.3, footTrafficDependency: 0.4,
						archetype: 'destination_pull',
						tradeRadiusM: 1500,
						priceRange: [3, 3],
						targetAgeRange: [28, 50],
					},
				},
			],
		},
		{
			id: 'coffee_format',
			question: 'What\'s the format?',
			rationale: 'A grab-and-go window lives on foot traffic. A sit-down café needs vibrancy and longer dwell time.',
			affects: ['footTrafficDependency', 'trafficPattern', 'tradeRadiusM', 'weightOverrides'],
			maxImpact: 12,
			options: [
				{
					value: 'grab_go', label: 'Grab-and-go / walk-up window / cart',
					hint: 'Pure volume play — every passing person is a potential sale',
					configOverrides: {
						footTrafficDependency: 0.95, transitDependency: 0.85,
						tradeRadiusM: 200,
						trafficPattern: 'morning',
						weightOverrides: { accessibility: 0.35, competition: 0.25, vibrancy: 0.05 },
					},
				},
				{
					value: 'cafe', label: 'Café with seating (15-40 seats)',
					hint: 'Neighborhood regulars + remote workers — needs vibrancy but not maximum foot traffic',
					configOverrides: {
						footTrafficDependency: 0.6, transitDependency: 0.5,
						tradeRadiusM: 600,
						trafficPattern: 'allday',
						weightOverrides: { vibrancy: 0.20, demographics: 0.15 },
					},
				},
				{
					value: 'roastery', label: 'Roastery / tasting room / destination café',
					hint: 'People travel to you — vibrancy and neighborhood character matter more than raw traffic',
					configOverrides: {
						footTrafficDependency: 0.3, transitDependency: 0.3,
						tradeRadiusM: 2000,
						trafficPattern: 'allday',
						archetype: 'destination_pull',
						weightOverrides: { marketProof: 0.30, vibrancy: 0.25, accessibility: 0.10 },
					},
				},
			],
		},
		{
			id: 'coffee_hours',
			question: 'What hours are you planning?',
			rationale: 'Morning-only needs AM commuter traffic. All-day needs lunch and afternoon crowds too.',
			affects: ['trafficPattern'],
			maxImpact: 8,
			options: [
				{ value: 'morning', label: 'Early morning to early afternoon (6am-2pm)', configOverrides: { trafficPattern: 'morning' } },
				{ value: 'allday', label: 'Full day (6am-8pm)', configOverrides: { trafficPattern: 'allday' } },
				{ value: 'late', label: 'Extended hours including evening (6am-10pm+)', configOverrides: { trafficPattern: 'evening' } },
			],
		},
	],

	juice_bar: [
		{
			id: 'juice_price',
			question: 'What\'s your average item price?',
			rationale: 'A $7 smoothie can work in moderate-income areas. A $15 cold-pressed juice needs a high-income, health-conscious customer base.',
			affects: ['incomeMin', 'incomeSweet', 'saturationThreshold', 'priceRange'],
			maxImpact: 15,
			options: [
				{
					value: 'affordable', label: 'Under $8 (smoothies, basic bowls)',
					configOverrides: { incomeMin: 38000, incomeSweet: 65000, priceRange: [1, 2], saturationThreshold: 8 },
				},
				{
					value: 'mid', label: '$8-13 (fresh juice, açaí bowls, health shots)',
					configOverrides: { incomeMin: 55000, incomeSweet: 95000, priceRange: [2, 3], saturationThreshold: 5 },
				},
				{
					value: 'premium', label: '$13+ (cold-pressed programs, cleanses, wellness packages)',
					configOverrides: {
						incomeMin: 80000, incomeSweet: 140000, priceRange: [3, 4], saturationThreshold: 3,
						archetype: 'destination_pull', tradeRadiusM: 1200, targetAgeRange: [26, 48],
					},
				},
			],
		},
		{
			id: 'juice_format',
			question: 'Grab-and-go or dine-in?',
			rationale: 'Counter-service needs maximum foot traffic. Dine-in bowl café needs neighborhood vibes.',
			affects: ['footTrafficDependency', 'tradeRadiusM'],
			maxImpact: 10,
			options: [
				{ value: 'counter', label: 'Counter service / grab-and-go', configOverrides: { footTrafficDependency: 0.90, tradeRadiusM: 300 } },
				{ value: 'dinein', label: 'Sit-down with bowls and food menu', configOverrides: { footTrafficDependency: 0.50, tradeRadiusM: 800 } },
			],
		},
		{
			id: 'juice_target',
			question: 'Who\'s your core customer?',
			rationale: 'Gym-goers means you need fitness studios nearby. Office workers means transit and lunch traffic.',
			affects: ['weightOverrides', 'targetAgeRange'],
			maxImpact: 8,
			options: [
				{ value: 'fitness', label: 'Gym-goers and fitness crowd', configOverrides: { targetAgeRange: [22, 40], weightOverrides: { competition: 0.15, demographics: 0.25 } } },
				{ value: 'office', label: 'Office workers (lunch / afternoon break)', configOverrides: { trafficPattern: 'lunch', targetAgeRange: [25, 50] } },
				{ value: 'wellness', label: 'Health-conscious residents', configOverrides: { targetAgeRange: [28, 55], footTrafficDependency: 0.4 } },
			],
		},
	],

	// ─── RESTAURANTS ───
	full_service_restaurant: [
		{
			id: 'restaurant_price',
			question: 'What price tier are you targeting?',
			rationale: 'A casual $15/plate restaurant needs different demographics and competition than a $60/plate fine dining spot.',
			affects: ['incomeMin', 'incomeSweet', 'priceRange', 'saturationThreshold', 'competitionCategories'],
			maxImpact: 20,
			options: [
				{
					value: 'casual', label: 'Casual ($12-20/plate)',
					configOverrides: {
						incomeMin: 38000, incomeSweet: 65000, priceRange: [1, 2],
						saturationThreshold: 25, tradeRadiusM: 1000,
						transitDependency: 0.6, footTrafficDependency: 0.5,
					},
				},
				{
					value: 'mid', label: 'Mid-range ($20-40/plate)',
					configOverrides: { incomeMin: 55000, incomeSweet: 95000, priceRange: [2, 3], saturationThreshold: 18 },
				},
				{
					value: 'upscale', label: 'Upscale ($40-80/plate)',
					configOverrides: {
						incomeMin: 85000, incomeSweet: 160000, priceRange: [3, 4],
						saturationThreshold: 10, tradeRadiusM: 3000,
						footTrafficDependency: 0.2, targetAgeRange: [30, 65],
					},
				},
				{
					value: 'fine', label: 'Fine dining ($80+/plate)',
					configOverrides: {
						incomeMin: 120000, incomeSweet: 250000, priceRange: [4, 4],
						saturationThreshold: 5, tradeRadiusM: 5000,
						footTrafficDependency: 0.1, transitDependency: 0.2,
						targetAgeRange: [32, 70],
						weightOverrides: { demographics: 0.30, marketProof: 0.25, vibrancy: 0.20, competition: 0.15 },
					},
				},
			],
		},
		{
			id: 'restaurant_cuisine',
			question: 'What cuisine?',
			rationale: 'Cuisine determines who you compete with. The 12th Italian restaurant on a block scores very differently than the first Ethiopian spot.',
			affects: ['competitionCategories', 'saturationThreshold'],
			maxImpact: 15,
			options: [
				{ value: 'american', label: 'American / New American', configOverrides: { competitionCategories: ['restaurant', 'american_restaurant', 'food'], saturationThreshold: 20 } },
				{ value: 'italian', label: 'Italian', configOverrides: { competitionCategories: ['restaurant', 'italian_restaurant', 'pizza_restaurant'], saturationThreshold: 12 } },
				{ value: 'asian', label: 'Asian (Chinese, Japanese, Thai, Korean, etc.)', configOverrides: { competitionCategories: ['restaurant', 'chinese_restaurant', 'japanese_restaurant', 'sushi_restaurant', 'thai_restaurant'], saturationThreshold: 15 } },
				{ value: 'mexican', label: 'Mexican / Latin', configOverrides: { competitionCategories: ['restaurant', 'mexican_restaurant'], saturationThreshold: 10 } },
				{ value: 'niche', label: 'Niche / Underrepresented (Ethiopian, Georgian, Filipino, etc.)', hint: 'Low competition = differentiation advantage', configOverrides: { competitionCategories: ['restaurant'], saturationThreshold: 3 } },
				{ value: 'fusion', label: 'Fusion / concept-driven', configOverrides: { competitionCategories: ['restaurant', 'food'], saturationThreshold: 8 } },
			],
		},
		{
			id: 'restaurant_liquor',
			question: 'Will you have a liquor license?',
			rationale: 'Full bar increases your vibrancy and nightlife dependency. BYOB changes your competition landscape entirely.',
			affects: ['weightOverrides', 'trafficPattern'],
			maxImpact: 10,
			options: [
				{ value: 'full_bar', label: 'Full bar', configOverrides: { trafficPattern: 'evening', weightOverrides: { vibrancy: 0.22 } } },
				{ value: 'beer_wine', label: 'Beer and wine only', configOverrides: { trafficPattern: 'evening' } },
				{ value: 'byob', label: 'BYOB', hint: 'No license = lower overhead but different customer expectation', configOverrides: { trafficPattern: 'evening', incomeSweet: 70000 } },
				{ value: 'none', label: 'No alcohol', configOverrides: { trafficPattern: 'allday' } },
			],
		},
	],

	qsr: [
		{
			id: 'qsr_type',
			question: 'What type of fast food / quick service?',
			rationale: 'A pizza slice shop competes differently than a poke bowl counter.',
			affects: ['competitionCategories', 'saturationThreshold', 'incomeSweet'],
			maxImpact: 12,
			options: [
				{ value: 'classic', label: 'Classic fast food (burgers, pizza, fried chicken)', configOverrides: { saturationThreshold: 15, incomeSweet: 50000 } },
				{ value: 'healthy', label: 'Healthy fast-casual (poke, salad, grain bowl)', configOverrides: { saturationThreshold: 8, incomeMin: 50000, incomeSweet: 85000, priceRange: [2, 2], targetAgeRange: [22, 42] } },
				{ value: 'ethnic', label: 'Ethnic quick service (taco stand, falafel, banh mi)', configOverrides: { saturationThreshold: 6, incomeSweet: 60000 } },
			],
		},
		{
			id: 'qsr_format',
			question: 'Counter-only or seating?',
			affects: ['footTrafficDependency', 'tradeRadiusM'],
			rationale: 'Counter-only is pure impulse traffic. Seating means people will travel slightly further.',
			maxImpact: 8,
			options: [
				{ value: 'counter', label: 'Counter / window only', configOverrides: { footTrafficDependency: 0.90, tradeRadiusM: 400 } },
				{ value: 'small', label: 'Small seating (10-20 seats)', configOverrides: { footTrafficDependency: 0.70, tradeRadiusM: 800 } },
				{ value: 'large', label: 'Full dining (30+ seats)', configOverrides: { footTrafficDependency: 0.50, tradeRadiusM: 1200 } },
			],
		},
	],

	bakery: [
		{
			id: 'bakery_type',
			question: 'What kind of bakery?',
			rationale: 'A croissant-and-coffee morning spot competes with cafes. A custom cake bakery is appointment-based.',
			affects: ['competitionCategories', 'trafficPattern', 'archetype', 'tradeRadiusM'],
			maxImpact: 15,
			options: [
				{ value: 'morning', label: 'Morning bakery-café (pastries, coffee, breakfast)', configOverrides: { competitionCategories: ['bakery', 'cafe', 'coffee_shop'], trafficPattern: 'morning' } },
				{ value: 'artisan', label: 'Artisan bread / sourdough', configOverrides: { competitionCategories: ['bakery'], saturationThreshold: 3, tradeRadiusM: 1500, archetype: 'destination_pull', incomeMin: 60000 } },
				{ value: 'custom', label: 'Custom cakes / special occasion', configOverrides: { competitionCategories: ['bakery'], saturationThreshold: 4, tradeRadiusM: 5000, archetype: 'destination_pull', trafficPattern: 'appointment', footTrafficDependency: 0.1 } },
				{ value: 'dessert', label: 'Dessert bar (cookies, cupcakes, ice cream)', configOverrides: { competitionCategories: ['bakery', 'ice_cream', 'dessert'], trafficPattern: 'allday', targetAgeRange: [18, 40] } },
			],
		},
		{
			id: 'bakery_price',
			question: 'What\'s your average item price?',
			affects: ['incomeMin', 'incomeSweet', 'priceRange'],
			rationale: 'A $3 croissant works in any neighborhood. A $9 viennoiserie needs a different customer.',
			maxImpact: 10,
			options: [
				{ value: 'budget', label: 'Under $5 per item', configOverrides: { incomeMin: 30000, incomeSweet: 55000, priceRange: [1, 1] } },
				{ value: 'mid', label: '$5-10 per item', configOverrides: { incomeMin: 50000, incomeSweet: 85000, priceRange: [2, 2] } },
				{ value: 'premium', label: '$10+ per item', configOverrides: { incomeMin: 75000, incomeSweet: 130000, priceRange: [3, 3] } },
			],
		},
	],

	bar_nightlife: [
		{
			id: 'bar_type',
			question: 'What kind of bar?',
			rationale: 'A sports bar needs TVs and casual crowd. A cocktail lounge needs affluent nightlife.',
			affects: ['competitionCategories', 'incomeSweet', 'targetAgeRange', 'saturationThreshold'],
			maxImpact: 18,
			options: [
				{ value: 'sports', label: 'Sports bar', configOverrides: { incomeMin: 35000, incomeSweet: 60000, targetAgeRange: [21, 50], saturationThreshold: 12 } },
				{ value: 'cocktail', label: 'Cocktail bar / speakeasy', configOverrides: { incomeMin: 70000, incomeSweet: 120000, targetAgeRange: [25, 45], saturationThreshold: 6, priceRange: [3, 4] } },
				{ value: 'wine', label: 'Wine bar', configOverrides: { incomeMin: 65000, incomeSweet: 110000, targetAgeRange: [28, 55], saturationThreshold: 5, priceRange: [3, 3] } },
				{ value: 'dive', label: 'Dive bar / neighborhood pub', configOverrides: { incomeMin: 28000, incomeSweet: 50000, targetAgeRange: [21, 55], saturationThreshold: 10, priceRange: [1, 2] } },
				{ value: 'club', label: 'Nightclub / dance venue', configOverrides: { incomeMin: 45000, incomeSweet: 80000, targetAgeRange: [21, 35], saturationThreshold: 8, tradeRadiusM: 5000, transitDependency: 0.7 } },
			],
		},
		{
			id: 'bar_food',
			question: 'Will you serve food?',
			rationale: 'Full kitchen means you compete with restaurants too. Bar snacks only keeps you in the bar lane.',
			affects: ['competitionCategories'],
			maxImpact: 8,
			options: [
				{ value: 'none', label: 'Drinks only', configOverrides: { competitionCategories: ['bar', 'night_club'] } },
				{ value: 'snacks', label: 'Bar snacks / small plates', configOverrides: { competitionCategories: ['bar', 'night_club', 'lounge'] } },
				{ value: 'full', label: 'Full food menu', configOverrides: { competitionCategories: ['bar', 'restaurant', 'food'], saturationThreshold: 20 } },
			],
		},
	],

	// ─── FITNESS & WELLNESS ───
	fitness_studio: [
		{
			id: 'fitness_type',
			question: 'What type of fitness?',
			rationale: 'A budget gym competes on price and volume. A boutique studio competes on experience and affluence.',
			affects: ['incomeMin', 'incomeSweet', 'saturationThreshold', 'tradeRadiusM', 'priceRange'],
			maxImpact: 20,
			options: [
				{
					value: 'budget', label: 'Budget gym ($15-40/mo)',
					hint: 'Planet Fitness, Blink — needs residential density and low competition',
					configOverrides: {
						incomeMin: 28000, incomeSweet: 55000, priceRange: [1, 1],
						saturationThreshold: 5, tradeRadiusM: 3000,
						weightOverrides: { demographics: 0.30, competition: 0.30, accessibility: 0.15 },
					},
				},
				{
					value: 'mid', label: 'Mid-range gym ($50-100/mo)',
					configOverrides: { incomeMin: 45000, incomeSweet: 80000, priceRange: [2, 2], saturationThreshold: 8 },
				},
				{
					value: 'boutique', label: 'Boutique studio ($25-45/class: yoga, pilates, cycling, barre)',
					configOverrides: {
						incomeMin: 75000, incomeSweet: 140000, priceRange: [3, 4],
						saturationThreshold: 4, tradeRadiusM: 800,
						targetAgeRange: [25, 48],
						weightOverrides: { demographics: 0.35, competition: 0.25, vibrancy: 0.15 },
					},
				},
				{
					value: 'crossfit', label: 'CrossFit / functional training',
					configOverrides: {
						incomeMin: 60000, incomeSweet: 100000, priceRange: [3, 3],
						saturationThreshold: 3, tradeRadiusM: 2000,
						targetAgeRange: [24, 42],
					},
				},
			],
		},
		{
			id: 'fitness_schedule',
			question: 'When will your peak hours be?',
			rationale: 'Early morning classes need commuter-friendly transit. After-work classes need office corridor proximity.',
			affects: ['trafficPattern'],
			maxImpact: 8,
			options: [
				{ value: 'morning', label: 'Morning-heavy (5-9am)', configOverrides: { trafficPattern: 'morning' } },
				{ value: 'evening', label: 'Evening-heavy (5-9pm)', configOverrides: { trafficPattern: 'evening' } },
				{ value: 'allday', label: 'Spread throughout the day', configOverrides: { trafficPattern: 'allday' } },
			],
		},
		{
			id: 'fitness_parking',
			question: 'Do your members need to drive?',
			rationale: 'In Manhattan, nobody drives. In Staten Island or outer Brooklyn, parking is essential.',
			affects: ['transitDependency'],
			maxImpact: 10,
			options: [
				{ value: 'transit', label: 'Most members walk or take transit', configOverrides: { transitDependency: 0.7 } },
				{ value: 'mixed', label: 'Mix of transit and driving', configOverrides: { transitDependency: 0.4 } },
				{ value: 'drive', label: 'Most members drive', configOverrides: { transitDependency: 0.1, footTrafficDependency: 0.1 } },
			],
		},
	],

	personal_services: [
		{
			id: 'salon_type',
			question: 'What type of personal service?',
			rationale: 'A barbershop needs neighborhood regulars. A med-spa needs high-income destination clients.',
			affects: ['incomeSweet', 'saturationThreshold', 'tradeRadiusM', 'priceRange', 'targetAgeRange'],
			maxImpact: 18,
			options: [
				{ value: 'barber', label: 'Barbershop', configOverrides: { incomeMin: 30000, incomeSweet: 55000, saturationThreshold: 8, tradeRadiusM: 500, priceRange: [1, 2], targetAgeRange: [18, 55] } },
				{ value: 'salon', label: 'Hair salon', configOverrides: { incomeMin: 40000, incomeSweet: 75000, saturationThreshold: 10, tradeRadiusM: 800, priceRange: [2, 3] } },
				{ value: 'nails', label: 'Nail salon', configOverrides: { incomeMin: 35000, incomeSweet: 65000, saturationThreshold: 12, tradeRadiusM: 600, priceRange: [1, 2] } },
				{ value: 'medspa', label: 'Med-spa / aesthetics', configOverrides: { incomeMin: 80000, incomeSweet: 150000, saturationThreshold: 4, tradeRadiusM: 3000, priceRange: [4, 4], targetAgeRange: [28, 60], archetype: 'destination_pull' } },
				{ value: 'spa', label: 'Day spa / massage', configOverrides: { incomeMin: 60000, incomeSweet: 110000, saturationThreshold: 5, tradeRadiusM: 2000, priceRange: [3, 3], targetAgeRange: [28, 55] } },
			],
		},
		{
			id: 'salon_walkin',
			question: 'Walk-in or appointment-based?',
			rationale: 'Walk-in shops need foot traffic. Appointment-based can be on a side street.',
			affects: ['footTrafficDependency', 'trafficPattern'],
			maxImpact: 10,
			options: [
				{ value: 'walkin', label: 'Mostly walk-ins', configOverrides: { footTrafficDependency: 0.8, trafficPattern: 'allday' } },
				{ value: 'mixed', label: 'Mix of walk-in and appointment', configOverrides: { footTrafficDependency: 0.5 } },
				{ value: 'appointment', label: 'Appointment-only', configOverrides: { footTrafficDependency: 0.15, trafficPattern: 'appointment' } },
			],
		},
	],

	// ─── MEDICAL ───
	medical_office: [
		{
			id: 'medical_type',
			question: 'What type of practice?',
			rationale: 'A dentist needs residential density. A specialist needs transit access and a wider draw area.',
			affects: ['competitionCategories', 'saturationThreshold', 'tradeRadiusM', 'incomeSweet', 'targetAgeRange'],
			maxImpact: 15,
			options: [
				{ value: 'dental', label: 'Dental practice', configOverrides: { competitionCategories: ['dentist', 'health'], saturationThreshold: 6, tradeRadiusM: 2000, targetAgeRange: [25, 65] } },
				{ value: 'primary', label: 'Primary care / urgent care', configOverrides: { competitionCategories: ['doctor', 'health'], saturationThreshold: 8, tradeRadiusM: 2500 } },
				{ value: 'specialist', label: 'Specialist (dermatology, ortho, etc.)', configOverrides: { competitionCategories: ['doctor', 'health'], saturationThreshold: 3, tradeRadiusM: 5000, transitDependency: 0.6 } },
				{ value: 'mental', label: 'Mental health / therapy', configOverrides: { competitionCategories: ['health', 'psychologist'], saturationThreshold: 10, tradeRadiusM: 3000, incomeMin: 55000, targetAgeRange: [22, 55] } },
				{ value: 'pediatric', label: 'Pediatrics', configOverrides: { competitionCategories: ['doctor', 'health'], saturationThreshold: 5, tradeRadiusM: 2500, targetAgeRange: [28, 50] } },
				{ value: 'cosmetic', label: 'Cosmetic / elective (plastic surgery, cosmetic dentistry)', configOverrides: { competitionCategories: ['doctor', 'dentist'], saturationThreshold: 3, tradeRadiusM: 8000, incomeMin: 100000, incomeSweet: 200000, priceRange: [4, 4], archetype: 'destination_pull' } },
			],
		},
		{
			id: 'medical_insurance',
			question: 'Are you accepting insurance or cash/concierge?',
			rationale: 'Insurance-based practices need volume and residential density. Cash-pay practices need affluent customers willing to pay out of pocket.',
			affects: ['incomeMin', 'incomeSweet', 'weightOverrides'],
			maxImpact: 12,
			options: [
				{ value: 'insurance', label: 'Insurance-based (Medicaid, commercial plans)', configOverrides: { incomeMin: 30000, incomeSweet: 65000, weightOverrides: { demographics: 0.35, competition: 0.25 } } },
				{ value: 'mixed', label: 'Mix of insurance and self-pay', configOverrides: { incomeMin: 45000, incomeSweet: 85000 } },
				{ value: 'concierge', label: 'Cash-pay / concierge / membership', configOverrides: { incomeMin: 90000, incomeSweet: 175000, priceRange: [4, 4], weightOverrides: { demographics: 0.40, vibrancy: 0.15 } } },
			],
		},
	],

	// ─── RETAIL ───
	retail: [
		{
			id: 'retail_type',
			question: 'What are you selling?',
			rationale: 'A convenience store needs residential foot traffic. A boutique clothing store needs destination shoppers.',
			affects: ['competitionCategories', 'saturationThreshold', 'tradeRadiusM', 'incomeSweet', 'archetype'],
			maxImpact: 18,
			options: [
				{ value: 'convenience', label: 'Convenience / bodega / corner store', configOverrides: { competitionCategories: ['convenience_store', 'store'], saturationThreshold: 8, tradeRadiusM: 400, incomeMin: 25000, incomeSweet: 50000, archetype: 'need_filler', priceRange: [1, 1] } },
				{ value: 'clothing', label: 'Clothing / fashion', configOverrides: { competitionCategories: ['clothing_store', 'shoe_store'], saturationThreshold: 15, tradeRadiusM: 2000, incomeMin: 55000, priceRange: [2, 3] } },
				{ value: 'home', label: 'Home goods / furniture', configOverrides: { competitionCategories: ['furniture_store', 'home_goods_store'], saturationThreshold: 5, tradeRadiusM: 5000, incomeMin: 70000, incomeSweet: 120000, footTrafficDependency: 0.2, archetype: 'destination_pull' } },
				{ value: 'specialty', label: 'Specialty (books, records, gifts, pet supplies)', configOverrides: { competitionCategories: ['store', 'book_store'], saturationThreshold: 3, tradeRadiusM: 1500, archetype: 'destination_pull' } },
				{ value: 'electronics', label: 'Electronics / phone repair', configOverrides: { competitionCategories: ['electronics_store', 'store'], saturationThreshold: 6, tradeRadiusM: 2000 } },
			],
		},
		{
			id: 'retail_online',
			question: 'Do you also sell online?',
			rationale: 'Online-supplemented stores don\'t need as much foot traffic. Foot-traffic-only stores live or die by walk-ins.',
			affects: ['footTrafficDependency', 'tradeRadiusM'],
			maxImpact: 10,
			options: [
				{ value: 'store_only', label: 'Physical store only — all revenue from walk-ins', configOverrides: { footTrafficDependency: 0.85, tradeRadiusM: 800 } },
				{ value: 'hybrid', label: 'Online + physical (50/50)', configOverrides: { footTrafficDependency: 0.45, tradeRadiusM: 2000 } },
				{ value: 'showroom', label: 'Mostly online — store is a showroom', configOverrides: { footTrafficDependency: 0.2, tradeRadiusM: 5000, weightOverrides: { vibrancy: 0.25, marketProof: 0.25 } } },
			],
		},
	],

	// ─── FLORIST ───
	florist: [
		{
			id: 'florist_type',
			question: 'What\'s your primary revenue source?',
			rationale: 'Walk-in bouquets need foot traffic. Event/wedding floristry is appointment-based and destination-driven.',
			affects: ['archetype', 'footTrafficDependency', 'tradeRadiusM', 'trafficPattern'],
			maxImpact: 15,
			options: [
				{ value: 'walkin', label: 'Walk-in retail bouquets', configOverrides: { archetype: 'routine_interceptor', footTrafficDependency: 0.75, tradeRadiusM: 600, trafficPattern: 'allday' } },
				{ value: 'events', label: 'Events and weddings', configOverrides: { archetype: 'destination_pull', footTrafficDependency: 0.1, tradeRadiusM: 10000, trafficPattern: 'appointment' } },
				{ value: 'mixed', label: 'Mix of walk-in and events', configOverrides: { footTrafficDependency: 0.4, tradeRadiusM: 2000 } },
			],
		},
		{
			id: 'florist_price',
			question: 'What\'s your average bouquet price?',
			affects: ['incomeMin', 'incomeSweet', 'priceRange'],
			rationale: 'Affordable flowers work anywhere. Luxury arrangements need an affluent customer base.',
			maxImpact: 10,
			options: [
				{ value: 'budget', label: 'Under $30', configOverrides: { incomeMin: 35000, incomeSweet: 60000, priceRange: [1, 2] } },
				{ value: 'mid', label: '$30-75', configOverrides: { incomeMin: 55000, incomeSweet: 95000, priceRange: [2, 3] } },
				{ value: 'luxury', label: '$75+', configOverrides: { incomeMin: 85000, incomeSweet: 150000, priceRange: [3, 4] } },
			],
		},
	],
};


// ═══════════════════════════════════════════════════════════════
//  CONFIG BUILDER
// ═══════════════════════════════════════════════════════════════

/**
 * Get the questions for a given business type.
 * Returns them sorted by maxImpact descending (highest leverage first).
 */
export function getQuestionsForConcept(conceptType: string): ConceptQuestion[] {
	return CONCEPT_QUESTIONS[conceptType] || [];
}

/**
 * Build a dynamic concept config from base type + user answers.
 *
 * @param conceptType - Base concept (e.g., 'specialty_coffee')
 * @param answers - Map of questionId → selected option value
 * @returns Merged config with all user overrides applied
 */
export function buildDynamicConfig(
	conceptType: string,
	answers: Record<string, string>
): DynamicConceptConfig {
	// Start with the base config
	const localBase = BASE_CONFIGS[conceptType];
	const registryBase = BUSINESS_TYPE_CONFIGS[conceptType as ValidBusinessType];
	
	if (!localBase || !registryBase) {
		throw new Error(`Unknown concept type: ${conceptType}`);
	}

	// Deep clone the base and inject canonical registry defaults beneath it
	const config: DynamicConceptConfig = {
		tradeRadiusM: registryBase.tradeRadiusM,
		saturationThreshold: registryBase.saturationThreshold,
		incomeMin: registryBase.incomeMin,
		incomeSweet: registryBase.incomeSweet,
		archetype: registryBase.archetype,
		...JSON.parse(JSON.stringify(localBase))
	};

	// Apply each answer's overrides in question order
	const questions = CONCEPT_QUESTIONS[conceptType] || [];
	for (const q of questions) {
		const answerValue = answers[q.id];
		if (!answerValue) continue;

		const selectedOption = q.options.find(o => o.value === answerValue);
		if (!selectedOption) continue;

		// Merge overrides into config
		const overrides = selectedOption.configOverrides;
		for (const [key, value] of Object.entries(overrides)) {
			if (key === 'weightOverrides') {
				// Merge weight overrides additively
				config.weightOverrides = {
					...(config.weightOverrides || {}),
					...(value as Record<string, number>),
				};
			} else {
				(config as any)[key] = value;
			}
		}
	}

	return config;
}

/**
 * Get list of all supported concept types
 */
export function getSupportedConcepts(): string[] {
	return Object.keys(BASE_CONFIGS);
}

/**
 * Estimate the max total score impact if user answers ALL questions
 * for a given concept type. Useful for UI: "Answer these questions
 * to refine your score by up to X points"
 */
export function estimateMaxImpact(conceptType: string): number {
	const questions = CONCEPT_QUESTIONS[conceptType] || [];
	// Not strictly additive, but gives a rough upper bound
	return Math.min(40, questions.reduce((sum, q) => sum + q.maxImpact, 0));
}

/**
 * BR-01 + BR-03: Remaining upside + per-field impact map.
 *
 * Given a concept type and the user's current answers, returns:
 *   - maxUpside: an upper bound on how many points the user could gain by
 *     filling every remaining question (clamped to 12 so the UI doesn't
 *     overpromise). This replaces the UX-05 hand-tuned fallback
 *     `Math.max(3, Math.min(12, remaining))` with real question impact data.
 *   - perFieldImpact: a map of `questionId → {maxPoints, question, answered}`
 *     so the UX-12 per-field chips can read real values instead of the
 *     hand-tuned constants (Hours +2, Avg Check +2, Food Program +1, …).
 *
 * Both values are derived from the same `maxImpact` numbers that live on
 * each ConceptQuestion. The UI is free to ignore answered fields; we still
 * include them in the map so the UX can render the full picture.
 */
export interface VisionImpactSummary {
	maxUpside: number;
	totalQuestions: number;
	answeredCount: number;
	unansweredCount: number;
	perFieldImpact: Record<
		string,
		{
			questionId: string;
			question: string;
			maxPoints: number;
			answered: boolean;
			rationale: string;
		}
	>;
}

export function computeVisionImpact(
	conceptType: string,
	answers: Record<string, string> = {}
): VisionImpactSummary {
	const questions = CONCEPT_QUESTIONS[conceptType] || [];
	const answeredIds = new Set(
		Object.entries(answers)
			.filter(([, v]) => v != null && v !== '')
			.map(([k]) => k)
	);

	// Unfilled impact: sum of maxImpact across questions the user hasn't answered.
	// Clamped at 12 so the UI never promises more than is plausibly deliverable —
	// the Brain Package spec requires maxUpside to be UX-renderable on a small chip.
	const unfilledRaw = questions
		.filter(q => !answeredIds.has(q.id))
		.reduce((sum, q) => sum + q.maxImpact, 0);
	const maxUpside = Math.max(0, Math.min(12, unfilledRaw));

	const perFieldImpact: VisionImpactSummary['perFieldImpact'] = {};
	for (const q of questions) {
		perFieldImpact[q.id] = {
			questionId: q.id,
			question: q.question,
			// Per-field impact is also clamped per-question so one monster question
			// (e.g., coffee_price with maxImpact 18) doesn't dominate the chip row.
			maxPoints: Math.max(1, Math.min(6, q.maxImpact)),
			answered: answeredIds.has(q.id),
			rationale: q.rationale
		};
	}

	return {
		maxUpside,
		totalQuestions: questions.length,
		answeredCount: answeredIds.size,
		unansweredCount: questions.length - answeredIds.size,
		perFieldImpact
	};
}

/**
 * F-18: Refresh concept distribution stats.
 * Cycle 2H calibration stats (March 2026) are baked into BOROUGH_CONFIG weights
 * in score-all-v4.mjs. Refresh with:
 *   SELECT concept_type, COUNT(*) FROM block_group_scores
 *   WHERE score_type='fit_score' GROUP BY concept_type ORDER BY count DESC;
 */
export async function refreshConceptDistribution(supabase: any): Promise<Record<string, number>> {
	const { data, error } = await supabase
		.from('block_group_scores')
		.select('concept_type')
		.eq('score_type', 'fit_score');
	if (error || !data) return {};
	const counts: Record<string, number> = {};
	for (const row of data as Array<{ concept_type: string }>) {
		counts[row.concept_type] = (counts[row.concept_type] || 0) + 1;
	}
	return counts;
}

export { BASE_CONFIGS, CONCEPT_QUESTIONS };
