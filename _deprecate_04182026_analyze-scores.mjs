import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://jtunulrrnhekljzirynu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// FIVE GROUND TRUTH LOCATIONS - NYC ARCHETYPES
// ============================================================================

const GROUND_TRUTH_LOCATIONS = [
  {
    name: 'Times Square - Manhattan',
    geoid: '360610021001', // Manhattan, block group in Times Square area (approximate)
    borough: 'Manhattan',
    lat: 40.7580,
    lng: -73.9855,
    description: 'Extreme rent, extreme foot traffic, extreme competition, extreme vibrancy, high transit. Walk Score ~98. Median income ~$80K. Median age ~35.',
    estimates: {
      marketProof: 90,     // Extreme commercial density
      accessibility: 98,   // World's highest walk score
      vibrancy: 95,        // Massive foot traffic
      demographics: 65,    // Decent income but balanced against vibrancy dependency
      safety: 50,          // Times Square mixed - high transit but tourist congestion
      momentum: 70,        // Major development ongoing
      medianIncome: 80000,
      medianAge: 35,
      walkScore: 98,
      transitScore: 95,
      footTraffic: 95,
    },
    expectations: {
      specialty_coffee: { expectedGrade: 'C', reason: 'Saturated market, high rent, low income-to-concept fit. Too many competitors, rent pressure kills margins.' },
      full_service_restaurant: { expectedGrade: 'B-', reason: 'High traffic but saturated. Tourism-driven, not residential customer base.' },
      qsr: { expectedGrade: 'A-', reason: 'Perfect for QSR - massive foot traffic, low income expectations, diverse demographics.' },
      fitness_studio: { expectedGrade: 'C', reason: 'Rent too high, demographic drift younger but still insufficient to overcome rent.' },
      bar_nightlife: { expectedGrade: 'B+', reason: 'High vibrancy, tourist nightlife, excellent foot traffic.' },
      medical_office: { expectedGrade: 'D', reason: 'Rent far too high, no foot traffic dependency benefit, wrong concept fit.' },
    }
  },
  {
    name: 'Park Slope - Brooklyn',
    geoid: '360470002001', // Brooklyn, Park Slope-adjacent block group
    borough: 'Brooklyn',
    lat: 40.6710,
    lng: -73.9814,
    description: 'Residential, moderate-high income ($90K+), families, moderate competition, good transit, safe. Walk Score ~95.',
    estimates: {
      marketProof: 65,     // Good independent business presence
      accessibility: 82,   // High walkability but lower than Manhattan
      vibrancy: 65,        // Moderate - residential area, not tourist/nightlife
      demographics: 80,    // Higher income, family-oriented
      safety: 82,          // Safe, family neighborhood
      momentum: 60,        // Stable, mature neighborhood
      medianIncome: 95000,
      medianAge: 38,
      walkScore: 95,
      transitScore: 85,
      footTraffic: 55,     // Morning/daytime foot traffic, families
    },
    expectations: {
      specialty_coffee: { expectedGrade: 'A-', reason: 'Perfect for coffee - morning foot traffic from families, high income supports premium pricing, safe neighborhood.' },
      bakery: { expectedGrade: 'A', reason: 'Ideal demographic fit, strong morning traffic, family-oriented.' },
      full_service_restaurant: { expectedGrade: 'B', reason: 'Good evening dining demographic, but lower nightlife scene than Manhattan.' },
      bar_nightlife: { expectedGrade: 'D', reason: 'Family neighborhood = weak demographic fit for bars. Income supports price point but community doesnt.' },
      fitness_studio: { expectedGrade: 'B', reason: 'Good demographic fit, strong middle-class income, reasonable competition.' },
      medical_office: { expectedGrade: 'B+', reason: 'Good income, family demographic targets medical offices, steady foot traffic.' },
    }
  },
  {
    name: 'Astoria - Queens',
    geoid: '360810007001', // Queens, Astoria-adjacent block group
    borough: 'Queens',
    lat: 40.7592,
    lng: -73.9196,
    description: 'Diverse, moderate income ($60K), good transit (N/W), moderate competition, moderate vibrancy. Walk Score ~90.',
    estimates: {
      marketProof: 55,     // Moderate business presence
      accessibility: 88,   // Strong walk score and transit
      vibrancy: 60,        // Moderate commercial and cultural activity
      demographics: 60,    // Moderate income, diverse age
      safety: 70,          // Generally safe, diverse neighborhood
      momentum: 65,        // Steady development and residential growth
      medianIncome: 62000,
      medianAge: 36,
      walkScore: 90,
      transitScore: 88,
      footTraffic: 65,     // All-day foot traffic
    },
    expectations: {
      specialty_coffee: { expectedGrade: 'B', reason: 'Good transit and foot traffic, but income below sweet spot ($75K) - slight penalty on margin sustainability.' },
      fast_casual: { expectedGrade: 'A-', reason: 'Affordable area, diverse demographics, all-day foot traffic, strong transit = perfect fast casual market.' },
      qsr: { expectedGrade: 'B+', reason: 'Income and vibrancy support QSR well, good foot traffic, moderate competition.' },
      fitness_studio: { expectedGrade: 'B', reason: 'Decent income, good transit access, moderate competition, younger demographic.' },
      full_service_restaurant: { expectedGrade: 'B-', reason: 'Moderate income, decent foot traffic, but not as high-value dining as Park Slope.' },
      bar_nightlife: { expectedGrade: 'B', reason: 'Diverse nightlife scene, moderate income supports price point, decent foot traffic.' },
    }
  },
  {
    name: 'Mott Haven - South Bronx',
    geoid: '360850002001', // Bronx, Mott Haven area
    borough: 'Bronx',
    lat: 40.8090,
    lng: -73.9220,
    description: 'Emerging/gentrifying, low-moderate income ($35K), improving transit, low competition in some categories, lower safety, high momentum (new development).',
    estimates: {
      marketProof: 40,     // Low established business, emerging area
      accessibility: 70,   // Transit improving but walkability moderate
      vibrancy: 55,        // Emerging, still building commercial density
      demographics: 45,    // Lower income, younger population
      safety: 55,          // Emerging area, safety variable
      momentum: 80,        // HIGH momentum - heavy development, gentrification
      medianIncome: 38000,
      medianAge: 32,
      walkScore: 75,
      transitScore: 80,
      footTraffic: 45,     // Limited commercial foot traffic, emerging
    },
    expectations: {
      qsr: { expectedGrade: 'B', reason: 'Affordable area, younger demographic, emerging market = low competition but limited foot traffic. Opportunity play.' },
      fitness_studio: { expectedGrade: 'B', reason: 'Underserved market, income-challenged demographic but gentrifying = good growth opportunity.' },
      specialty_coffee: { expectedGrade: 'D', reason: 'Income ($38K) well below sweet spot ($75K). Rent-to-revenue ratio prohibitive. Too risky.' },
      wellness_beverage: { expectedGrade: 'D+', reason: 'Income far below sweet spot ($100K). Premium wellness concept on low-income area = weak fit.' },
      bar_nightlife: { expectedGrade: 'C+', reason: 'Emerging nightlife scene, lower income caps price point, but gentrification trending positive.' },
      medical_office: { expectedGrade: 'B', reason: 'Underserved market, transit improving, moderate income sufficient, growing population.' },
    }
  },
  {
    name: 'Tottenville - Staten Island',
    geoid: '360850041001', // Staten Island, Tottenville area
    borough: 'Staten Island',
    lat: 40.5026,
    lng: -74.2514,
    description: 'Car-dependent, suburban, moderate income ($70K), very low competition, no transit, low vibrancy.',
    estimates: {
      marketProof: 25,     // Very low commercial density
      accessibility: 35,   // Car-dependent, poor transit, low walk score
      vibrancy: 30,        // Suburban, quiet
      demographics: 65,    // Moderate income, suburban family
      safety: 75,          // Suburban = safe
      momentum: 45,        // Low development activity
      medianIncome: 72000,
      medianAge: 40,
      walkScore: 45,
      transitScore: 25,
      footTraffic: 15,     // Minimal foot traffic
    },
    expectations: {
      specialty_coffee: { expectedGrade: 'D', reason: 'No foot traffic, car-dependent = fatal flaw for coffee shop. Income decent but foot traffic dependency unkillable.' },
      qsr: { expectedGrade: 'C', reason: 'Car-dependent works for QSR drive-through/takeout, but low population density limits catchment.' },
      medical_office: { expectedGrade: 'B', reason: 'Underserved area, car-accessible, moderate income sufficient, aging population = good fit.' },
      bar_nightlife: { expectedGrade: 'D', reason: 'No nightlife scene, car-dependent, low vibrancy, suburban demographic = terrible fit.' },
      fitness_studio: { expectedGrade: 'C', reason: 'Car-accessible is acceptable for fitness, but very low foot traffic and population density limit market.' },
      full_service_restaurant: { expectedGrade: 'C-', reason: 'Car-dependent works but low population density, limited catchment, low vibrancy.' },
    }
  }
];

// ============================================================================
// COPY OF SCORING FUNCTIONS FROM score-all-v4.mjs
// ============================================================================

const BOROUGH_CONFIG = {
  'Manhattan': {
    incomeDirection: 'inverted',
    walkScoreWeight: 0.02,
    transitWeight: 0.15,
    incomeWeight: 0.15,
    competitionWeight: 0.25,
    vibrancyWeight: 0.38,
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'extreme',
  },
  'Queens': {
    incomeDirection: 'inverted',
    walkScoreWeight: 0.35,
    transitWeight: 0.20,
    incomeWeight: 0.15,
    competitionWeight: 0.15,
    vibrancyWeight: 0.10,
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'moderate',
  },
  'Brooklyn': {
    incomeDirection: 'normal',
    walkScoreWeight: 0.20,
    transitWeight: 0.20,
    incomeWeight: 0.20,
    competitionWeight: 0.15,
    vibrancyWeight: 0.20,
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'high',
  },
  'Bronx': {
    incomeDirection: 'normal',
    walkScoreWeight: 0.10,
    transitWeight: 0.25,
    incomeWeight: 0.25,
    competitionWeight: 0.15,
    vibrancyWeight: 0.20,
    safetyWeight: 0.02,
    momentumWeight: 0.03,
    isCarDependent: false,
    rentPressure: 'low',
  },
  'Staten Island': {
    incomeDirection: 'weak',
    walkScoreWeight: 0.0,
    transitWeight: 0.10,
    incomeWeight: 0.20,
    competitionWeight: 0.25,
    vibrancyWeight: 0.25,
    safetyWeight: 0.05,
    momentumWeight: 0.15,
    isCarDependent: true,
    rentPressure: 'low',
  },
};

const DEFAULT_BOROUGH_CONFIG = {
  incomeDirection: 'normal',
  walkScoreWeight: 0.20,
  transitWeight: 0.20,
  incomeWeight: 0.20,
  competitionWeight: 0.15,
  vibrancyWeight: 0.20,
  safetyWeight: 0.02,
  momentumWeight: 0.03,
  isCarDependent: false,
  rentPressure: 'moderate',
};

const CONCEPT_CONFIG = {
  'full_service_restaurant': {
    competitionCategories: ['restaurant', 'meal_takeaway', 'food'],
    priceRange: [2, 3],
    tradeRadiusM: 2000,
    trafficPattern: 'evening',
    saturationThreshold: 20,
    incomeMin: 45000,
    incomeSweet: 85000,
    transitDependency: 0.5,
    footTrafficDependency: 0.4,
    targetAgeRange: [28, 55],
  },
  'specialty_coffee': {
    competitionCategories: ['cafe', 'coffee_shop', 'bakery'],
    priceRange: [1, 2],
    tradeRadiusM: 400,
    trafficPattern: 'morning',
    saturationThreshold: 8,
    incomeMin: 40000,
    incomeSweet: 75000,
    transitDependency: 0.7,
    footTrafficDependency: 0.8,
    targetAgeRange: [24, 42],
  },
  'qsr': {
    competitionCategories: ['restaurant', 'meal_takeaway', 'meal_delivery', 'fast_food'],
    priceRange: [1, 1],
    tradeRadiusM: 800,
    trafficPattern: 'allday',
    saturationThreshold: 12,
    incomeMin: 30000,
    incomeSweet: 55000,
    transitDependency: 0.6,
    footTrafficDependency: 0.7,
    targetAgeRange: [18, 45],
  },
  'fitness_studio': {
    competitionCategories: ['gym', 'fitness_center', 'yoga_studio'],
    priceRange: [2, 3],
    tradeRadiusM: 1500,
    trafficPattern: 'allday',
    saturationThreshold: 10,
    incomeMin: 50000,
    incomeSweet: 85000,
    transitDependency: 0.4,
    footTrafficDependency: 0.3,
    targetAgeRange: [22, 45],
  },
  'bar_nightlife': {
    competitionCategories: ['bar', 'night_club', 'lounge'],
    priceRange: [2, 3],
    tradeRadiusM: 2000,
    trafficPattern: 'evening',
    saturationThreshold: 15,
    incomeMin: 40000,
    incomeSweet: 70000,
    transitDependency: 0.6,
    footTrafficDependency: 0.3,
    targetAgeRange: [21, 40],
  },
  'medical_office': {
    competitionCategories: ['doctor', 'dentist', 'health'],
    priceRange: [3, 4],
    tradeRadiusM: 3000,
    trafficPattern: 'daytime',
    saturationThreshold: 8,
    incomeMin: 45000,
    incomeSweet: 80000,
    transitDependency: 0.5,
    footTrafficDependency: 0.2,
    targetAgeRange: [30, 70],
  },
  'wellness_beverage': {
    competitionCategories: ['juice_bar', 'smoothie', 'health_food_store', 'acai_shop'],
    priceRange: [3, 3],
    tradeRadiusM: 600,
    trafficPattern: 'morning',
    saturationThreshold: 4,
    incomeMin: 60000,
    incomeSweet: 100000,
    transitDependency: 0.8,
    footTrafficDependency: 0.9,
    targetAgeRange: [25, 42],
  },
  'bakery': {
    competitionCategories: ['bakery', 'cafe', 'coffee_shop'],
    priceRange: [1, 2],
    tradeRadiusM: 500,
    trafficPattern: 'morning',
    saturationThreshold: 6,
    incomeMin: 40000,
    incomeSweet: 75000,
    transitDependency: 0.6,
    footTrafficDependency: 0.8,
    targetAgeRange: [25, 55],
  },
  'fast_casual': {
    competitionCategories: ['restaurant', 'meal_takeaway', 'fast_food', 'cafe'],
    priceRange: [2, 2],
    tradeRadiusM: 600,
    trafficPattern: 'allday',
    saturationThreshold: 15,
    incomeMin: 40000,
    incomeSweet: 70000,
    transitDependency: 0.6,
    footTrafficDependency: 0.75,
    targetAgeRange: [22, 45],
  },
};

const DEFAULT_CONCEPT = {
  competitionCategories: ['restaurant', 'cafe', 'store'],
  priceRange: [2, 2],
  tradeRadiusM: 1000,
  trafficPattern: 'allday',
  saturationThreshold: 15,
  incomeMin: 40000,
  incomeSweet: 75000,
  transitDependency: 0.5,
  footTrafficDependency: 0.5,
};

const NYC_D = {
  income: [15000, 28000, 38000, 48000, 58000, 68000, 82000, 100000, 125000, 165000, 250000],
  pop: [200, 800, 1200, 1800, 2500, 3200, 4200, 5500, 7500, 12000, 55000],
  edu: [2, 8, 14, 20, 28, 36, 44, 54, 64, 76, 95],
  age: [18, 25, 28, 31, 33, 36, 39, 42, 47, 55, 85],
};

const BLEND_ALPHA = 0.54;
const BLEND_POW = 1.1;

function clamp(v, min=0, max=100) { return Math.max(min, Math.min(max, Math.round(v))); }

function scoreLinear(v, lo, hi, inv=false) {
  const n = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return clamp(Math.round((inv ? 1 - n : n) * 100));
}

function scorePercentile(v, breakpoints, inv=false) {
  if (!breakpoints.length) return 50;
  if (v <= breakpoints[0]) return inv ? 100 : 0;
  if (v >= breakpoints[breakpoints.length - 1]) return inv ? 0 : 100;
  let lo = 0, hi = breakpoints.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (breakpoints[mid] <= v) lo = mid; else hi = mid;
  }
  const pctLo = (lo / (breakpoints.length - 1)) * 100;
  const pctHi = (hi / (breakpoints.length - 1)) * 100;
  const frac = (v - breakpoints[lo]) / (breakpoints[hi] - breakpoints[lo] || 1);
  return clamp(Math.round(inv ? 100 - (pctLo + frac * (pctHi - pctLo)) : pctLo + frac * (pctHi - pctLo)));
}

function grade(s) {
  if (s >= 93) return 'A+'; if (s >= 87) return 'A'; if (s >= 80) return 'A-';
  if (s >= 73) return 'B+'; if (s >= 67) return 'B'; if (s >= 60) return 'B-';
  if (s >= 53) return 'C+'; if (s >= 47) return 'C'; if (s >= 40) return 'C-';
  if (s >= 30) return 'D'; return 'F';
}

function computePriceIncomeFit(income, concept, borough) {
  if (!income || income <= 0) return 50;

  const sufficiency = income >= concept.incomeSweet ? 100
    : income >= concept.incomeMin ? scoreLinear(income, concept.incomeMin, concept.incomeSweet)
    : scoreLinear(income, concept.incomeMin * 0.5, concept.incomeMin);

  let rentPenalty = 0;
  if (borough.incomeDirection === 'inverted') {
    if (income > concept.incomeSweet * 1.3) {
      rentPenalty = Math.min(10, Math.round((income - concept.incomeSweet * 1.3) / 2000));
    }
  }

  return clamp(sufficiency - rentPenalty);
}

function computeConceptCompetition(marketDensity, concept) {
  const normalize = s => s.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
  const catDist = marketDensity?.categories || [];
  const sameCategoryCount = catDist
    .filter(c => concept.competitionCategories.some(cc => {
      const cn = normalize(c.name), ccn = normalize(cc);
      return cn.includes(ccn) || ccn.includes(cn);
    }))
    .reduce((sum, c) => sum + (c.count || 0), 0);
  const threshold = concept.saturationThreshold;

  if (sameCategoryCount === 0) return 20;
  const ratio = sameCategoryCount / threshold;
  if (ratio <= 0.3) return 40;
  if (ratio <= 0.6) return 60;
  if (ratio <= 1.0) return 80;
  if (ratio <= 1.5) return 90;
  if (ratio <= 2.0) return 75;
  if (ratio <= 3.0) return 55;
  return Math.max(25, 55 - Math.round((ratio - 3.0) * 10));
}

function computeAccessibility(walkScore, transitScore, footTraffic, borough) {
  const bc = BOROUGH_CONFIG[borough] || DEFAULT_BOROUGH_CONFIG;
  let score = 50;

  if (bc.isCarDependent) {
    return Math.round(footTraffic * 0.4 + 30);
  }

  const walkPart = scorePercentile(walkScore, [0, 50, 70, 80, 85, 88, 91, 93, 95, 97, 100]);
  const wsTransitPart = transitScore > 0
    ? scorePercentile(transitScore, [0, 40, 60, 72, 80, 85, 88, 91, 94, 97, 100])
    : 0;
  const transitPart = wsTransitPart || 0;

  if (footTraffic > 0) {
    score = Math.round(walkPart * 0.3 + transitPart * 0.4 + footTraffic * 0.3);
  } else {
    score = Math.round(walkPart * 0.45 + transitPart * 0.55);
  }

  return clamp(score);
}

function computeDemographics(medianIncome, medianAge, borough, concept) {
  const bc = BOROUGH_CONFIG[borough] || DEFAULT_BOROUGH_CONFIG;

  let incomeScore;
  if (bc.incomeDirection === 'inverted') {
    const dist = Math.abs(medianIncome - concept.incomeSweet);
    incomeScore = clamp(100 - Math.round(dist / 1000));
  } else {
    incomeScore = scorePercentile(medianIncome, NYC_D.income);
  }

  const ageScore = scorePercentile(medianAge, NYC_D.age, true);

  let score = Math.round(incomeScore * 0.50 + ageScore * 0.50);
  return clamp(score);
}

function computeAgeFit(medianAge, conceptConfig) {
  if (!conceptConfig.targetAgeRange || !medianAge) return 0;
  const [idealMin, idealMax] = conceptConfig.targetAgeRange;
  const idealCenter = (idealMin + idealMax) / 2;
  if (medianAge >= idealMin && medianAge <= idealMax) {
    const distFromCenter = Math.abs(medianAge - idealCenter);
    const maxDist = (idealMax - idealMin) / 2;
    return Math.round(6 * (1 - distFromCenter / maxDist));
  }
  const distOutside = medianAge < idealMin ? idealMin - medianAge : medianAge - idealMax;
  return -Math.min(8, Math.round(distOutside * 0.5));
}

function computeLocationIQv2(marketProof, accessibility, vibrancy, demographics, safety, momentum) {
  const base =
    marketProof * 0.28 +
    accessibility * 0.25 +
    vibrancy * 0.15 +
    demographics * 0.10 +
    safety * 0.12 +
    momentum * 0.10;
  return clamp(Math.round(base));
}

function computeVisionIQScore(competition, priceIncomeFit, ageFit) {
  const ageFitNorm = clamp(Math.round(50 + ageFit * 3.5));
  return clamp(Math.round(
    competition * 0.45 +
    priceIncomeFit * 0.35 +
    ageFitNorm * 0.20
  ));
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function analyzeLocation(location) {
  const { estimates, borough } = location;
  const bc = BOROUGH_CONFIG[borough] || DEFAULT_BOROUGH_CONFIG;

  const result = {
    location: location.name,
    estimates,
    calculations: {},
    conceptScores: {},
    anomalies: [],
    analysis: ''
  };

  // Calculate Location IQ v2
  const locationIQ = computeLocationIQv2(
    estimates.marketProof,
    estimates.accessibility,
    estimates.vibrancy,
    estimates.demographics,
    estimates.safety,
    estimates.momentum
  );
  result.calculations.locationIQ = locationIQ;
  result.calculations.locationIQGrade = grade(locationIQ);

  // Test all relevant concepts
  const conceptsToTest = ['specialty_coffee', 'full_service_restaurant', 'qsr', 'fitness_studio', 'bar_nightlife', 'medical_office', 'wellness_beverage', 'bakery', 'fast_casual'];

  for (const conceptKey of conceptsToTest) {
    const cc = CONCEPT_CONFIG[conceptKey] || DEFAULT_CONCEPT;

    // Estimate competition based on market characteristics
    let competition = 50;
    if (estimates.marketProof > 80) competition = 25;  // Saturated
    else if (estimates.marketProof > 60) competition = 50;
    else if (estimates.marketProof > 40) competition = 70;
    else competition = 85;  // Underserved

    const priceIncomeFit = computePriceIncomeFit(estimates.medianIncome, cc, bc);
    const ageFit = computeAgeFit(estimates.medianAge, cc);
    const visionIQ = computeVisionIQScore(competition, priceIncomeFit, ageFit);

    // Blend-like ensemble for overall fit
    // Simplified: average of location IQ and vision IQ with concept weighting
    const conceptFit = Math.round(locationIQ * 0.4 + visionIQ * 0.6);

    result.conceptScores[conceptKey] = {
      competition,
      priceIncomeFit,
      ageFit,
      ageFitNorm: clamp(Math.round(50 + ageFit * 3.5)),
      visionIQ,
      conceptFit,
      grade: grade(conceptFit),
    };
  }

  return result;
}

function checkGroundTruthViolations(location, analysis) {
  const violations = [];
  const { expectations, name } = location;
  const { conceptScores } = analysis;

  for (const [conceptKey, expected] of Object.entries(expectations)) {
    const computed = conceptScores[conceptKey];
    if (!computed) continue;

    const computedGrade = computed.grade;
    const expectedGrade = expected.expectedGrade;

    // Parse grades to numeric ranges for comparison
    const gradeToScore = (g) => {
      if (g === 'A+') return [93, 100];
      if (g === 'A') return [87, 92];
      if (g === 'A-') return [80, 86];
      if (g === 'B+') return [73, 79];
      if (g === 'B') return [67, 72];
      if (g === 'B-') return [60, 66];
      if (g === 'C+') return [53, 59];
      if (g === 'C') return [47, 52];
      if (g === 'C-') return [40, 46];
      if (g === 'D') return [30, 39];
      return [0, 29];
    };

    const [expectedMin, expectedMax] = gradeToScore(expectedGrade);
    const [computedMin, computedMax] = gradeToScore(computedGrade);

    // Allow 1 grade tier deviation
    const expectedTier = Math.floor(expectedMin / 10);
    const computedTier = Math.floor(computedMin / 10);
    const deviation = Math.abs(expectedTier - computedTier);

    if (deviation > 1) {
      violations.push({
        concept: conceptKey,
        expected: expectedGrade,
        computed: computedGrade,
        score: computed.conceptFit,
        reason: expected.reason,
        deviation: `Expected ${expectedGrade} (${expectedMin}-${expectedMax}), got ${computedGrade} (${computedMin}-${computedMax})`,
        tier_deviation: deviation,
      });
    }
  }

  return violations;
}

function identifyMissingSignals(location, analysis) {
  const missing = [];
  const { estimates, name, borough } = location;
  const bc = BOROUGH_CONFIG[borough] || DEFAULT_BOROUGH_CONFIG;

  // Check for rent pressure signals
  if (bc.rentPressure === 'extreme' && estimates.marketProof > 80) {
    // Times Square type - should penalize high-rent concepts
    const coffeeVision = analysis.conceptScores['specialty_coffee'];
    if (coffeeVision && coffeeVision.conceptFit > 65) {
      missing.push({
        signal: 'Rent Pressure on Specialty Coffee',
        issue: 'Model gives coffee shop above-average score at Times Square despite extreme rent pressure.',
        expectedBehavior: 'Specialty coffee with $40-75K sweet spot should score D-F in extreme-rent markets (>$10k/sqft).',
        missing: 'No rent-to-revenue ceiling for high-ticket concepts in inverted-income boroughs.',
      });
    }
  }

  // Check for foot traffic dependency
  if (estimates.footTraffic < 30 && estimates.walkScore < 50) {
    const coffeeVision = analysis.conceptScores['specialty_coffee'];
    const wellnessVision = analysis.conceptScores['wellness_beverage'];
    if (coffeeVision && coffeeVision.conceptFit > 60) {
      missing.push({
        signal: 'Foot Traffic Dependency (Specialty Coffee)',
        issue: 'Model scores specialty coffee above 60 in Tottenville (foot traffic=15) despite 0.8 foot traffic dependency.',
        expectedBehavior: 'Foot traffic <30 should auto-floor coffee shop to D-F.',
        missing: 'Foot traffic dependency not enforced as hard constraint in ensemble.',
      });
    }
  }

  // Check for demographic sweet spot
  if (estimates.medianIncome < 35000) {
    const wellnessVision = analysis.conceptScores['wellness_beverage'];
    if (wellnessVision && wellnessVision.conceptFit > 55) {
      missing.push({
        signal: 'Income Sweet Spot (Wellness Beverage)',
        issue: 'Model scores wellness_beverage above C in Mott Haven ($38K median) despite $100K sweet spot.',
        expectedBehavior: 'Income >30k below sweet spot should hard-floor score to D.',
        missing: 'Income cliffs not enforced; soft penalties insufficient.',
      });
    }
  }

  // Check for transit dependency in car-dependent areas
  if (bc.isCarDependent) {
    const qsrVision = analysis.conceptScores['qsr'];
    if (qsrVision && qsrVision.conceptFit > 70) {
      missing.push({
        signal: 'Transit Dependency in Car-Dependent Area',
        issue: 'Model may score transit-dependent concepts too high in Staten Island despite car dependency.',
        expectedBehavior: 'Car-dependent boroughs should hard-floor transit-heavy concepts.',
        missing: 'Car dependency vs. concept transit dependency not enforced.',
      });
    }
  }

  return missing;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('═'.repeat(100));
  console.log('RE² GROUND TRUTH SCORING ANALYSIS');
  console.log('═'.repeat(100));
  console.log('');

  const allAnalyses = [];
  const allViolations = [];
  const allMissing = [];

  for (const location of GROUND_TRUTH_LOCATIONS) {
    console.log(`\n${'═'.repeat(100)}`);
    console.log(`LOCATION: ${location.name.toUpperCase()}`);
    console.log(`${'═'.repeat(100)}`);
    console.log(`\nDescription: ${location.description}`);
    console.log(`Borough: ${location.borough}`);
    console.log(`Estimated Indices:`, location.estimates);

    const analysis = analyzeLocation(location);
    allAnalyses.push(analysis);

    console.log(`\nLocation IQ v2: ${analysis.calculations.locationIQ} (${analysis.calculations.locationIQGrade})`);
    console.log('\nConcept-Specific Scores:');
    console.log('─'.repeat(100));

    const conceptTableHeader = [
      'Concept',
      'Competition',
      'Price/Income Fit',
      'Age Fit',
      'Vision IQ',
      'Overall Fit',
      'Grade',
      'Expected'
    ].map(h => h.padEnd(20)).join('');
    console.log(conceptTableHeader);
    console.log('─'.repeat(100));

    for (const [conceptKey, scores] of Object.entries(analysis.conceptScores)) {
      if (!location.expectations[conceptKey]) continue;

      const row = [
        conceptKey.padEnd(20),
        scores.competition.toString().padEnd(20),
        scores.priceIncomeFit.toString().padEnd(20),
        scores.ageFit.toString().padEnd(20),
        scores.visionIQ.toString().padEnd(20),
        scores.conceptFit.toString().padEnd(20),
        scores.grade.padEnd(20),
        location.expectations[conceptKey].expectedGrade.padEnd(20),
      ].join('');
      console.log(row);
    }

    const violations = checkGroundTruthViolations(location, analysis);
    if (violations.length > 0) {
      console.log('\n⚠️ ANOMALIES DETECTED:');
      for (const v of violations) {
        console.log(`  - ${v.concept.toUpperCase()}: Expected ${v.expected}, got ${v.computed} (score: ${v.score})`);
        console.log(`    Reason: ${v.reason}`);
      }
      allViolations.push({ location: location.name, violations });
    }

    const missing = identifyMissingSignals(location, analysis);
    if (missing.length > 0) {
      console.log('\n❌ MISSING SIGNALS:');
      for (const m of missing) {
        console.log(`  - ${m.signal}`);
        console.log(`    Issue: ${m.issue}`);
        console.log(`    Missing: ${m.missing}`);
      }
      allMissing.push({ location: location.name, missing });
    }
  }

  // FINAL SUMMARY
  console.log(`\n\n${'═'.repeat(100)}`);
  console.log('SUMMARY REPORT');
  console.log(`${'═'.repeat(100)}`);

  console.log('\n1. VIOLATIONS BY SEVERITY');
  console.log('─'.repeat(100));
  let totalViolations = 0;
  for (const { location, violations } of allViolations) {
    totalViolations += violations.length;
    console.log(`\n${location}:`);
    for (const v of violations) {
      console.log(`  - ${v.concept}: ${v.deviation}`);
    }
  }
  console.log(`\nTotal Anomalies: ${totalViolations}`);

  console.log('\n2. MISSING SIGNALS AND ARCHITECTURAL GAPS');
  console.log('─'.repeat(100));
  const signalTypes = new Set();
  for (const { location, missing } of allMissing) {
    for (const m of missing) {
      signalTypes.add(m.signal);
    }
  }

  for (const signalType of signalTypes) {
    console.log(`\n${signalType}:`);
    const instances = allMissing
      .flatMap(({ location, missing }) => missing.map(m => ({ location, ...m })))
      .filter(m => m.signal === signalType);

    for (const inst of instances) {
      console.log(`  ${inst.location}: ${inst.issue}`);
    }
  }

  console.log('\n3. CONFIDENCE IN GROUND TRUTH');
  console.log('─'.repeat(100));
  console.log(`Locations tested: ${GROUND_TRUTH_LOCATIONS.length}`);
  console.log(`Concept-location pairs: ${GROUND_TRUTH_LOCATIONS.reduce((sum, l) => sum + Object.keys(l.expectations).length, 0)}`);
  console.log(`Anomalies detected: ${totalViolations}`);
  console.log(`Missing signals: ${allMissing.reduce((sum, m) => sum + m.missing.length, 0)}`);

  console.log('\n4. KEY FINDINGS');
  console.log('─'.repeat(100));
  if (totalViolations === 0 && allMissing.length === 0) {
    console.log('✅ MODEL PASSES GROUND TRUTH TEST - No major anomalies detected.');
  } else {
    console.log(`⚠️ MODEL SHOWS ${totalViolations} SCORE ANOMALIES AND ${allMissing.length} SIGNAL GAPS`);
    console.log('   Recommend immediate review of:');
    if (totalViolations > 0) {
      console.log('   - Rent pressure penalties in inverted-income boroughs');
      console.log('   - Foot traffic dependency enforcement');
      console.log('   - Income sweet spot cliffs');
    }
  }

  console.log('\n' + '═'.repeat(100));
}

main().catch(console.error);
