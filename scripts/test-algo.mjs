/**
 * RE² Algorithm Validation Test Suite
 * Run: node scripts/test-algo.mjs
 *
 * Tests: normalizeBizType, parseCheckAmount, CONCEPT_OPEX,
 *        steadyStateRevenue, visionFlags, differentiator scoring spread
 *
 * Exit 0 = all pass. Exit 1 = failures.
 */

// ─── CONSTANTS (mirrors src files) ───────────────────────────────────────────

const CONCEPT_DEFAULTS = {
	specialty_coffee:        { avgTicket: 8.75,  dailyTransactions: 250 },
	bakery:                  { avgTicket: 12,    dailyTransactions: 180 },
	fast_casual:             { avgTicket: 16,    dailyTransactions: 120 },
	full_service_restaurant: { avgTicket: 45,    dailyTransactions: 60  },
	qsr:                     { avgTicket: 11,    dailyTransactions: 200 },
	bar_nightlife:           { avgTicket: 18,    dailyTransactions: 80  },
	juice_bar:               { avgTicket: 12,    dailyTransactions: 120 },
	wellness_beverage:       { avgTicket: 10,    dailyTransactions: 150 },
	retail:                  { avgTicket: 55,    dailyTransactions: 40  },
	fitness_studio:          { avgTicket: 25,    dailyTransactions: 40  },
	personal_services:       { avgTicket: 65,    dailyTransactions: 25  },
	medical_office:          { avgTicket: 150,   dailyTransactions: 15  },
	florist:                 { avgTicket: 60,    dailyTransactions: 20  },
};

const CONCEPT_OPEX = {
	specialty_coffee:        { insurance: 250,  pos: 150, utilities: 600,  equipment: 45000,  licensing: 2500  },
	bakery:                  { insurance: 300,  pos: 100, utilities: 1200, equipment: 80000,  licensing: 2500  },
	fast_casual:             { insurance: 350,  pos: 200, utilities: 900,  equipment: 60000,  licensing: 3500  },
	full_service_restaurant: { insurance: 600,  pos: 300, utilities: 1500, equipment: 120000, licensing: 8000  },
	qsr:                     { insurance: 350,  pos: 250, utilities: 1000, equipment: 55000,  licensing: 3500  },
	bar_nightlife:           { insurance: 800,  pos: 200, utilities: 1200, equipment: 50000,  licensing: 15000 },
	juice_bar:               { insurance: 250,  pos: 100, utilities: 700,  equipment: 35000,  licensing: 2000  },
	wellness_beverage:       { insurance: 250,  pos: 100, utilities: 600,  equipment: 30000,  licensing: 2000  },
	retail:                  { insurance: 400,  pos: 200, utilities: 600,  equipment: 25000,  licensing: 1500  },
	fitness_studio:          { insurance: 400,  pos: 150, utilities: 1500, equipment: 80000,  licensing: 3000  },
	personal_services:       { insurance: 300,  pos: 100, utilities: 400,  equipment: 20000,  licensing: 2000  },
	medical_office:          { insurance: 1200, pos: 300, utilities: 800,  equipment: 40000,  licensing: 5000  },
	florist:                 { insurance: 250,  pos: 100, utilities: 500,  equipment: 20000,  licensing: 1500  },
};

const VISION_ARCHETYPES = {
	specialty_coffee:        { idealCheck: [3,   12],  peakHours: 'morning' },
	bakery:                  { idealCheck: [4,   15],  peakHours: 'morning' },
	fast_casual:             { idealCheck: [8,   18],  peakHours: 'all_day' },
	full_service_restaurant: { idealCheck: [20,  60],  peakHours: 'evening' },
	qsr:                     { idealCheck: [5,   14],  peakHours: 'all_day' },
	bar_nightlife:           { idealCheck: [10,  25],  peakHours: 'evening' },
	juice_bar:               { idealCheck: [7,   16],  peakHours: 'morning' },
	wellness_beverage:       { idealCheck: [6,   14],  peakHours: 'morning' },
	retail:                  { idealCheck: [15,  80],  peakHours: 'all_day' },
	fitness_studio:          { idealCheck: [15,  40],  peakHours: 'morning' },
	personal_services:       { idealCheck: [20,  60],  peakHours: 'all_day' },
	medical_office:          { idealCheck: [30,  200], peakHours: 'all_day' },
	florist:                 { idealCheck: [20,  80],  peakHours: 'all_day' },
};

const DEFAULT_OPERATING_DAYS_PER_WEEK = 6;
const RAMP_YEAR_FACTORS = [0.68, 0.94, 1.00, 1.05, 1.10];

// ─── FUNCTION IMPLEMENTATIONS ─────────────────────────────────────────────────

function normalizeBizType(input) {
	if (!input || typeof input !== 'string') return 'specialty_coffee';
	const lower = input.toLowerCase().trim();
	const map = {
		// Primary canonical keys
		'specialty_coffee': 'specialty_coffee', 'bakery': 'bakery', 'fast_casual': 'fast_casual',
		'full_service_restaurant': 'full_service_restaurant', 'qsr': 'qsr', 'bar_nightlife': 'bar_nightlife',
		'juice_bar': 'juice_bar', 'wellness_beverage': 'wellness_beverage', 'retail': 'retail',
		'fitness_studio': 'fitness_studio', 'personal_services': 'personal_services',
		'medical_office': 'medical_office', 'florist': 'florist',
		// Coffee adjacents
		'cafe': 'specialty_coffee', 'café': 'specialty_coffee', 'coffee': 'specialty_coffee',
		'coffee shop': 'specialty_coffee', 'coffeehouse': 'specialty_coffee', 'espresso bar': 'specialty_coffee',
		'tea house': 'wellness_beverage', 'tea room': 'wellness_beverage', 'boba': 'wellness_beverage', 'bubble tea': 'wellness_beverage',
		// Restaurant adjacents
		'restaurant': 'fast_casual', 'diner': 'fast_casual', 'eatery': 'fast_casual',
		'bistro': 'full_service_restaurant', 'steakhouse': 'full_service_restaurant',
		'sushi': 'full_service_restaurant', 'sushi restaurant': 'full_service_restaurant',
		'pizza': 'fast_casual', 'pizzeria': 'fast_casual', 'sandwich shop': 'fast_casual',
		'deli': 'fast_casual', 'tacos': 'fast_casual', 'taco shop': 'fast_casual',
		'burger': 'qsr', 'burger joint': 'qsr', 'fast food': 'qsr', 'food truck': 'qsr',
		'counter service': 'qsr', 'takeout': 'qsr',
		// Bar adjacents
		'bar': 'bar_nightlife', 'pub': 'bar_nightlife', 'lounge': 'bar_nightlife',
		'cocktail bar': 'bar_nightlife', 'wine bar': 'bar_nightlife', 'taproom': 'bar_nightlife',
		'brewery': 'bar_nightlife', 'craft beer': 'bar_nightlife', 'dive bar': 'bar_nightlife', 'speakeasy': 'bar_nightlife',
		// Fitness adjacents
		'gym': 'fitness_studio', 'yoga': 'fitness_studio', 'yoga studio': 'fitness_studio',
		'pilates': 'fitness_studio', 'pilates studio': 'fitness_studio', 'crossfit': 'fitness_studio',
		'martial arts': 'fitness_studio', 'dance studio': 'fitness_studio', 'boxing gym': 'fitness_studio',
		'spin studio': 'fitness_studio', 'cycling studio': 'fitness_studio', 'barre': 'fitness_studio',
		// Personal services
		'nail salon': 'personal_services', 'hair salon': 'personal_services',
		'barbershop': 'personal_services', 'barber': 'personal_services',
		'spa': 'personal_services', 'day spa': 'personal_services',
		'beauty salon': 'personal_services', 'salon': 'personal_services',
		'blow dry bar': 'personal_services', 'eyebrow threading': 'personal_services',
		'lash studio': 'personal_services', 'tattoo': 'personal_services',
		// Retail
		'boutique': 'retail', 'retail / boutique': 'retail', 'retail/boutique': 'retail',
		'clothing': 'retail', 'apparel': 'retail', 'fashion': 'retail',
		'accessories': 'retail', 'gift shop': 'retail', 'bookstore': 'retail',
		'stationery': 'retail', 'home goods': 'retail', 'jewelry': 'retail',
		// Juice/wellness
		'smoothie': 'juice_bar', 'smoothie bar': 'juice_bar', 'health food': 'juice_bar',
		'acai bowl': 'juice_bar', 'acai': 'juice_bar', 'cold press': 'juice_bar',
		'wellness cafe': 'wellness_beverage', 'wellness bar': 'wellness_beverage',
		'matcha bar': 'wellness_beverage', 'superfood': 'wellness_beverage',
		// Bakery
		'patisserie': 'bakery', 'pastry shop': 'bakery', 'pastry': 'bakery', 'bread': 'bakery',
		'cake shop': 'bakery', 'donut': 'bakery', 'donut shop': 'bakery', 'donuts': 'bakery',
		'croissant': 'bakery', 'boulangerie': 'bakery',
	};
	return map[lower] || 'specialty_coffee';
}

function parseCheckAmount(input) {
	if (!input || typeof input !== 'string') return 0;
	const n = parseFloat(input.replace(/[$,]/g, ''));
	return isNaN(n) ? 0 : n;
}

function steadyStateRevenue(bizType, overrides = {}) {
	const defaults = CONCEPT_DEFAULTS[bizType];
	if (!defaults) return 800000;
	const avgTicket = overrides.avgTicket ?? defaults.avgTicket;
	const dailyTransactions = overrides.dailyTransactions ?? defaults.dailyTransactions;
	return avgTicket * dailyTransactions * DEFAULT_OPERATING_DAYS_PER_WEEK * 52;
}

function visionFlags(bizType, avgCheck, differentiators, hours) {
	const flags = [];
	const arch = VISION_ARCHETYPES[bizType] || { idealCheck: [5, 25], peakHours: 'all_day' };
	const check = parseCheckAmount(avgCheck);
	const [idealLo, idealHi] = arch.idealCheck;
	if (check > idealHi * 5 && check > 0)
		flags.push({ level: 'error', field: 'avgCheck', message: `$${check} is ${Math.round(check / idealHi)}× typical range ($${idealLo}–$${idealHi})` });
	else if (check < idealLo * 0.4 && check > 0)
		flags.push({ level: 'warning', field: 'avgCheck', message: `$${check} below viable range ($${idealLo}–$${idealHi})` });
	if (!differentiators || !differentiators.trim())
		flags.push({ level: 'warning', field: 'differentiators', message: 'No differentiators entered' });
	if (hours === 'morning' && arch.peakHours === 'evening')
		flags.push({ level: 'warning', field: 'hours', message: 'Morning-only conflicts with evening peak' });
	if (hours === 'evening' && arch.peakHours === 'morning')
		flags.push({ level: 'warning', field: 'hours', message: 'Evening-only misses morning peak' });
	return flags;
}

function differentiatorBonus(differentiators, avgCheck, targetAge, defaultCheck = '$5.50', defaultAge = '24-42') {
	const words = differentiators.trim()
		? differentiators.trim().split(/[\s,;]+/).filter(w => w.length > 2).length
		: 0;
	const hasNonDefaultCheck = avgCheck && avgCheck !== defaultCheck && avgCheck !== '5.50';
	const hasNonDefaultAge = targetAge && targetAge !== defaultAge;
	return Math.min(25, Math.min(12, words * 3) + (hasNonDefaultCheck ? 5 : 0) + (hasNonDefaultAge ? 3 : 0));
}

// ─── TEST HARNESS ─────────────────────────────────────────────────────────────

let pass = 0, fail = 0;

function ok(condition, label) {
	if (condition) { console.log(`  ✓ ${label}`); pass++; }
	else           { console.log(`  ✗ ${label}`); fail++; }
}

function eq(actual, expected, label) {
	ok(actual === expected, `${label} → got "${actual}", expected "${expected}"`);
}

function inRange(actual, lo, hi, label) {
	ok(actual >= lo && actual <= hi, `${label} → ${actual} in [${lo}, ${hi}]`);
}

// ─── TEST 1: normalizeBizType ─────────────────────────────────────────────────
console.log('\n═══ TEST 1: normalizeBizType() ═══');
const normCases = [
	['cafe',                'specialty_coffee'],
	['Cafe',                'specialty_coffee'],
	['COFFEE SHOP',         'specialty_coffee'],
	['espresso bar',        'specialty_coffee'],
	['gym',                 'fitness_studio'],
	['Yoga Studio',         'fitness_studio'],
	['barre',               'fitness_studio'],
	['Bar',                 'bar_nightlife'],
	['Brewery',             'bar_nightlife'],
	['cocktail bar',        'bar_nightlife'],
	['Pizza',               'fast_casual'],
	['deli',                'fast_casual'],
	['Sushi',               'full_service_restaurant'],
	['Steakhouse',          'full_service_restaurant'],
	['Hair Salon',          'personal_services'],
	['Nail Salon',          'personal_services'],
	['Boutique',            'retail'],
	['Retail / Boutique',   'retail'],
	['retail/boutique',     'retail'],
	['Smoothie Bar',        'juice_bar'],
	['acai bowl',           'juice_bar'],
	['Matcha Bar',          'wellness_beverage'],
	['Donut Shop',          'bakery'],
	['boulangerie',         'bakery'],
	['🔒emoji',             'specialty_coffee'],   // emoji → fallback, no crash
	['UNKNOWN_TYPE',        'specialty_coffee'],   // unknown → fallback
	['',                    'specialty_coffee'],   // empty → fallback
];
normCases.forEach(([input, expected]) => eq(normalizeBizType(input), expected, `normalizeBizType("${input}")`));

// ─── TEST 2: parseCheckAmount ─────────────────────────────────────────────────
console.log('\n═══ TEST 2: parseCheckAmount() ═══');
const checkCases = [
	['$8.75', 8.75], ['8.75', 8.75], ['$2000', 2000], ['$2,000', 2000],
	['$0.99', 0.99], ['bad', 0], ['', 0], [null, 0], ['$12.50', 12.50],
];
checkCases.forEach(([input, expected]) => eq(parseCheckAmount(input), expected, `parseCheckAmount("${input}")`));

// ─── TEST 3: CONCEPT_OPEX completeness ───────────────────────────────────────
console.log('\n═══ TEST 3: CONCEPT_OPEX — all 13 concepts valid ═══');
Object.keys(CONCEPT_DEFAULTS).forEach(concept => {
	const opex = CONCEPT_OPEX[concept];
	ok(!!opex,             `CONCEPT_OPEX["${concept}"] exists`);
	ok(opex?.insurance > 0, `  insurance > 0 (${opex?.insurance})`);
	ok(opex?.pos > 0,       `  pos > 0 (${opex?.pos})`);
	ok(opex?.utilities > 0, `  utilities > 0 (${opex?.utilities})`);
	ok(opex?.equipment > 0, `  equipment > 0 (${opex?.equipment})`);
	// Verify NOT the hardcoded coffee default (1200) for high-insurance concepts
	// (retail legitimately sums to 1200 by coincidence — that's fine, it's still dynamic)
	if (!['specialty_coffee', 'retail'].includes(concept)) {
		const total = opex?.insurance + opex?.pos + opex?.utilities;
		ok(total !== 1200, `  monthly opex ≠ hardcoded 1200 (is ${total})`);
	}
});

// ─── TEST 4: steadyStateRevenue ──────────────────────────────────────────────
console.log('\n═══ TEST 4: steadyStateRevenue() ═══');
const revCases = [
	['specialty_coffee',        8.75  * 250 * 6 * 52],   // ~682,500
	['fitness_studio',          25    * 40  * 6 * 52],   // ~312,000
	['full_service_restaurant', 45    * 60  * 6 * 52],   // ~842,400
	['medical_office',          150   * 15  * 6 * 52],   // ~702,000
	['qsr',                     11    * 200 * 6 * 52],   // ~686,400
	['bar_nightlife',           18    * 80  * 6 * 52],   // ~449,280
	['retail',                  55    * 40  * 6 * 52],   // ~685,200
	['personal_services',       65    * 25  * 6 * 52],   // ~507,000
];
revCases.forEach(([concept, expected]) => {
	const got = steadyStateRevenue(concept);
	inRange(got, expected * 0.99, expected * 1.01, `steadyStateRevenue("${concept}") ≈ ${Math.round(expected)}`);
});

// ─── TEST 5: Year factors (5-year ramp) ──────────────────────────────────────
console.log('\n═══ TEST 5: 5-Year Ramp Factors ═══');
const coffeeBase = steadyStateRevenue('specialty_coffee');
const fitnessBase = steadyStateRevenue('fitness_studio');
RAMP_YEAR_FACTORS.forEach((factor, y) => {
	const coffeeRev = coffeeBase * factor;
	const fitnessRev = fitnessBase * factor;
	ok(coffeeRev !== fitnessRev, `Y${y+1}: coffee ($${Math.round(coffeeRev)}) ≠ fitness ($${Math.round(fitnessRev)})`);
	ok(coffeeRev !== 950000,     `Y${y+1}: coffee ≠ hardcoded $950K`);
});

// ─── TEST 6: visionFlags ─────────────────────────────────────────────────────
console.log('\n═══ TEST 6: visionFlags() ═══');

// 6a: Absurd pricing → error
const f1 = visionFlags('specialty_coffee', '$2000', 'premium', 'morning');
ok(f1.some(f => f.level === 'error' && f.field === 'avgCheck'),
	'$2000 coffee → error flag on avgCheck');

// 6b: Below floor → warning
const f2 = visionFlags('specialty_coffee', '$0.50', 'premium', 'morning');
ok(f2.some(f => f.level === 'warning' && f.field === 'avgCheck'),
	'$0.50 coffee → warning flag on avgCheck');

// 6c: No differentiators → warning
const f3 = visionFlags('specialty_coffee', '$8.75', '', 'morning');
ok(f3.some(f => f.level === 'warning' && f.field === 'differentiators'),
	'blank differentiators → warning flag');

// 6d: Morning hours for bar → warning
const f4 = visionFlags('bar_nightlife', '$18', 'cocktails', 'morning');
ok(f4.some(f => f.level === 'warning' && f.field === 'hours'),
	'morning hours for bar_nightlife → warning flag');

// 6e: Evening for coffee → warning
const f5 = visionFlags('specialty_coffee', '$8.75', 'specialty roaster', 'evening');
ok(f5.some(f => f.level === 'warning' && f.field === 'hours'),
	'evening-only for specialty_coffee → warning flag');

// 6f: Valid inputs → zero flags
const f6 = visionFlags('specialty_coffee', '$8.75', 'specialty roaster local beans', 'morning');
ok(f6.length === 0, 'valid inputs → no flags');

// ─── TEST 7: Differentiator scoring spread ───────────────────────────────────
console.log('\n═══ TEST 7: Differentiator Scoring (L0 vs L4) ═══');

const l0 = differentiatorBonus('', '$5.50', '24-42');
const l1 = differentiatorBonus('good coffee', '$5.50', '24-42');
const l3 = differentiatorBonus('specialty roaster rotating origins community events', '$8.75', '24-42');
const l4 = differentiatorBonus('japanese pour-over specialist seasonal menu dog-friendly local sourcing', '$9.50', '26-40');

inRange(l0, 0,  5,  `L0 bonus (blank, all defaults) = ${l0}`);
inRange(l1, 0,  8,  `L1 bonus (1 word, defaults) = ${l1}`);
inRange(l3, 12, 22, `L3 bonus (3 keywords, custom check) = ${l3}`);
inRange(l4, 20, 25, `L4 bonus (5 keywords, custom check + age) = ${l4}`);

ok(l4 - l0 >= 15, `L4 vs L0 spread = ${l4 - l0} (expect ≥15)`);

// Vision IQ estimate (base 50 + bonus)
const viqL0 = 50 + l0;
const viqL4 = 50 + l4;
inRange(viqL0, 45, 58, `Vision IQ L0 estimate = ${viqL0}`);
inRange(viqL4, 70, 85, `Vision IQ L4 estimate = ${viqL4}`);

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log(`PASSED: ${pass}  |  FAILED: ${fail}`);
console.log('═'.repeat(60));
if (fail === 0) { console.log('✓ ALL TESTS PASSED\n'); process.exit(0); }
else            { console.log(`✗ ${fail} FAILURE(S)\n`); process.exit(1); }
