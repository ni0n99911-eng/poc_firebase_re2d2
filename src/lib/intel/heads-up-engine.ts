import { HEADS_UP_WATCH_TIERS, HEADS_UP_SEVERITY, KILL_FACTOR_THRESHOLDS } from '$lib/constants/scoring-thresholds';

export interface HeadsUpWarning {
  icon: string;
  title: string;
  description: string;
  severity: 'critical' | 'important' | 'info';
  /** EF-3: where this warning came from so we can dedupe across sources. */
  source?: 'persona' | 'universal' | 'lens';
  /** EF-3: which scoring dimension this warning relates to (for lens dedup). */
  dimension?: 'transit' | 'safety' | 'demographics' | 'competition' | 'vibrancy' | 'momentum' | string;
}

/**
 * EF-3 (April 11): Lens → Watch Out auto-propagation contract.
 *
 * BR-06 lens payload slices each compute a tier (Strong / Solid / Average /
 * Weak / Concerning). Before this contract, if a lens expanded to show
 * "Concerning — Demographics is BORING" the top-level Watch Out panel showed
 * "No major flags detected" — because the lens computed its verdict
 * independently and nothing pushed it up to the scoreData.watchOut array.
 *
 * Contract: any lens with tier in {'Weak', 'Concerning'} MUST surface at the
 * top level as a HeadsUpWarning. 'Concerning' → 'critical', 'Weak' →
 * 'important'. Dedup: if a persona / universal rule already flagged the same
 * scoring dimension, the lens warning is dropped (persona rules have more
 * context so they win).
 */
export interface LensForWatchOut {
  dimension: string;
  label: string;
  score: number;
  tier: 'Strong' | 'Solid' | 'Average' | 'Weak' | 'Concerning';
  verdictLine: string;
}

const LENS_ICON: Record<string, string> = {
  transit: '🚇',
  safety: '🛡️',
  demographics: '👥',
  competition: '🏪',
  vibrancy: '🏙️',
  momentum: '📈',
};

/**
 * Map a universal/persona warning title to the scoring dimension it
 * covers, so lens warnings for the same dimension can be deduped.
 */
const UNIVERSAL_TITLE_TO_DIMENSION: Record<string, string> = {
  'Safety Concern': 'safety',
  'Limited Transit Access': 'transit',
  'Crowded Market': 'competition',
  'Demographics Mismatch': 'demographics',
  'Quiet Concept Pulse': 'vibrancy',
  'Declining Area Momentum': 'momentum',
  'Hot Market — Expect Rent Pressure': 'momentum',
};

export function warningsFromLenses(
  lenses: LensForWatchOut[] | null | undefined,
  existing: HeadsUpWarning[] = []
): HeadsUpWarning[] {
  if (!lenses || lenses.length === 0) return [];

  // Build set of dimensions already covered by persona/universal warnings
  const covered = new Set<string>();
  for (const w of existing) {
    if (w.dimension) covered.add(w.dimension);
    const mapped = UNIVERSAL_TITLE_TO_DIMENSION[w.title];
    if (mapped) covered.add(mapped);
  }

  const out: HeadsUpWarning[] = [];
  for (const lens of lenses) {
    // RC6 (April 11): Propagate Average (45-59) lenses too — founders need
    // to see anything that isn't clearly positive. Severity escalates:
    //   Average   → 'info'      (amber, heads-up)
    //   Weak      → 'important' (orange, notable risk)
    //   Concerning → 'critical'  (red, kill factor)
    // C-09: tier gate and severity map extracted to scoring-thresholds.ts
    //   HEADS_UP_WATCH_TIERS / HEADS_UP_SEVERITY. Strings must stay in sync
    //   with the 'lens' vocabulary in tiers.ts.
    if (!(HEADS_UP_WATCH_TIERS as readonly string[]).includes(lens.tier)) continue;
    if (covered.has(lens.dimension)) continue;

    let severity: HeadsUpWarning['severity'] =
      HEADS_UP_SEVERITY[lens.tier] ?? 'info';
    // C-06: Average tier with score < 38 (within 8 pts of Concerning boundary)
    // escalates from 'info' to 'important' so founders don't miss borderline signals
    if (lens.tier === 'Average' && lens.score < 38) {
      severity = 'important';
    }
    out.push({
      icon: LENS_ICON[lens.dimension] || (severity === 'info' ? 'ℹ️' : '⚠️'),
      title: `${lens.label} — ${lens.tier} (${lens.score}/100)`,
      description: lens.verdictLine,
      severity,
      source: 'lens',
      dimension: lens.dimension,
    });
    // Only one lens warning per dimension
    covered.add(lens.dimension);
  }
  return out;
}

// Normalize persona keys: accept both old (coffee, gym, dentist) and v3 (coffee_shop, fitness, medical_dental)
function normalizePersonaKey(key: string): string {
  const map: Record<string, string> = {
    // ── Legacy persona keys (v3) — pass through unchanged ──
    coffee_shop: 'coffee_shop', restaurant: 'restaurant', florist: 'florist',
    medical_dental: 'medical_dental', spa_wellness: 'spa_wellness',
    fitness: 'fitness', barbershop: 'barbershop', retail: 'retail',
    something_else: 'something_else',
    // ── Short aliases ──
    coffee: 'coffee_shop', cafe: 'coffee_shop', café: 'coffee_shop',
    gym: 'fitness', yoga: 'fitness', crossfit: 'fitness',
    dentist: 'medical_dental', dental: 'medical_dental', medical: 'medical_dental',
    spa: 'spa_wellness', salon: 'spa_wellness',
    barber: 'barbershop', grooming: 'barbershop',
    boutique: 'retail', fashion: 'retail', bodega: 'retail',
    // ── B3-NEW-2: Canonical concept keys from normalizeConceptKey() ──
    // These are what AddressAnalyzer.svelte and HeadsUpCards.svelte pass after B3-2.1.
    specialty_coffee:        'coffee_shop',
    full_service_restaurant: 'restaurant',
    fast_casual:             'restaurant',
    qsr:                     'restaurant',
    fine_dining:             'restaurant',
    bakery:                  'restaurant',   // closest match — breakfast/pastry warnings overlap
    fitness_studio:          'fitness',
    medical_office:          'medical_dental',
    wellness_spa:            'spa_wellness',
    personal_services:       'barbershop',   // salon/nail/lash — barbershop warnings most relevant
    bar_nightlife:           'something_else', // no dedicated bar generator yet
    wellness_beverage:       'something_else',
    juice_bar:               'something_else',
    coworking:               'something_else',
    generic:                 'something_else',
    // SEG-02 underserved segments
    pharmacy:                'something_else',
    doggie_daycare:          'something_else',
    tutoring:                'something_else',
    ethnic_market:           'retail',
  };
  return map[key?.toLowerCase()] || 'something_else';
}

export function generateHeadsUpWarnings(
  personaKey: string,
  questionAnswers: Record<string, string>,
  scoringData?: Record<string, number>
): HeadsUpWarning[] {
  const warnings: HeadsUpWarning[] = [];
  const normalized = normalizePersonaKey(personaKey);

  // Persona-specific rules
  switch (normalized) {
    case 'coffee_shop':
      warnings.push(...generateCoffeeShopWarnings(questionAnswers));
      break;
    case 'restaurant':
      warnings.push(...generateRestaurantWarnings(questionAnswers));
      break;
    case 'fitness':
      warnings.push(...generateFitnessWarnings(questionAnswers));
      break;
    case 'medical_dental':
      warnings.push(...generateMedicalDentalWarnings(questionAnswers));
      break;
    case 'florist':
      warnings.push(...generateFloristWarnings(questionAnswers));
      break;
    case 'spa_wellness':
      warnings.push(...generateSpaWellnessWarnings(questionAnswers));
      break;
    case 'barbershop':
      warnings.push(...generateBarbershopWarnings(questionAnswers));
      break;
    case 'retail':
      warnings.push(...generateRetailWarnings(questionAnswers));
      break;
    case 'something_else':
      warnings.push(...generateSomethingElseWarnings(questionAnswers));
      break;
  }

  // ── Universal scoring-data rules (apply to every persona) ──
  if (scoringData) {
    // Safety concern
    if (scoringData.safety !== undefined && scoringData.safety < 50) {
      warnings.push({
        icon: '⚠️',
        title: 'Safety Concern',
        description:
          'This area has a lower safety score. Visit at night before committing — check lighting, foot traffic, and overall feel.',
        severity: 'important',
      });
    }

    // Limited transit
    if (scoringData.transit !== undefined && scoringData.transit < 40) {
      warnings.push({
        icon: '🚌',
        title: 'Limited Transit Access',
        description:
          'Limited transit access. Your customers will primarily need to drive or walk — verify parking availability.',
        severity: 'info',
      });
    }

    // High competition zone
    if (scoringData.competition !== undefined && scoringData.competition < 35) {
      warnings.push({
        icon: '🏪',
        title: 'Crowded Market',
        description:
          'High competitor density in this area. You need a clear differentiator — same-concept stores nearby will split your foot traffic.',
        severity: 'important',
      });
    }

    // Low demographics fit
    if (scoringData.demographics !== undefined && scoringData.demographics < 40) {
      warnings.push({
        icon: '📊',
        title: 'Demographics Mismatch',
        description:
          'The local demographics may not align with your target customer. Check household income, age distribution, and daytime population.',
        severity: 'important',
      });
    }

    // Low vibrancy / foot traffic — B2-1.1: threshold from canonical constant
    if (scoringData.vibrancy !== undefined && scoringData.vibrancy < KILL_FACTOR_THRESHOLDS.vibrancy) {
      warnings.push({
        icon: '🚶',
        title: 'Quiet Concept Pulse',
        description:
          'Your concept\u2019s trade-area ring is calm. Works well for destination businesses, bookings, or referral-driven concepts — riskier for walk-in dependent ones that need spillover traffic.',
        severity: 'info',
      });
    }

    // Negative momentum (declining area)
    if (scoringData.momentum !== undefined && scoringData.momentum < 30) {
      warnings.push({
        icon: '📉',
        title: 'Declining Area Momentum',
        description:
          'Permit activity and new business openings are trending down. This could mean the area is stagnating — or that rents are about to drop.',
        severity: 'info',
      });
    }

    // Strong momentum (gentrifying / hot zone)
    if (scoringData.momentum !== undefined && scoringData.momentum > 85) {
      warnings.push({
        icon: '📈',
        title: 'Hot Market — Expect Rent Pressure',
        description:
          'High momentum area with lots of new activity. Great for foot traffic, but negotiate rent escalation caps — landlords know this block is hot.',
        severity: 'info',
      });
    }

    // Excellent overall score — lease negotiation tip
    const composite = scoringData.composite ?? Object.values(scoringData).reduce((a, b) => a + b, 0) / Object.keys(scoringData).length;
    if (composite > 80) {
      warnings.push({
        icon: '💡',
        title: 'Strong Location — Negotiate Hard',
        description:
          'This location scores well for your concept. Use that confidence to negotiate: ask for 3 months free rent, a TI allowance, and a kick-out clause at year 3.',
        severity: 'info',
      });
    }
  }

  // 04.18.2026 Code Changes for Head Cap Refactoring
  // Sort by severity so critical warnings aren't dropped when capping
  const severityRank: Record<string, number> = { critical: 3, important: 2, info: 1 };
  warnings.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

  return warnings.slice(0, 5);
}

// ── COFFEE SHOP (5 rules) ──
function generateCoffeeShopWarnings(answers: Record<string, string>): HeadsUpWarning[] {
  const warnings: HeadsUpWarning[] = [];
  const serviceModel = answers['service_model']?.toLowerCase() || '';
  const concept = answers['concept']?.toLowerCase() || '';
  const espresso = answers['espresso']?.toLowerCase() === 'yes' || concept.includes('espresso');

  if (serviceModel === 'sit_down' || espresso) {
    warnings.push({
      icon: '⚡',
      title: 'Electrical Panel Capacity',
      description:
        "Espresso machines need 200-400 amps — most retail spaces have 100-200. Ask the landlord: 'What's the panel capacity and is it single or three-phase?'",
      severity: 'critical',
    });
  }

  if (concept.includes('food') || concept.includes('hot food') || concept.includes('kitchen')) {
    warnings.push({
      icon: '🔧',
      title: 'Grease Trap & Hood Ventilation',
      description:
        "Required if you serve hot food. Ask: 'Was this space previously food service?' Existing infrastructure saves $20K-$50K.",
      severity: 'important',
    });
  }

  if (serviceModel === 'grab_and_go') {
    warnings.push({
      icon: '👥',
      title: 'Street Visibility Is Everything',
      description:
        'Grab-and-go lives or dies on foot traffic and street visibility. Walk the block during your target hours before signing.',
      severity: 'info',
    });
  }

  // Plumbing for pour-over / specialty
  if (concept.includes('pour over') || concept.includes('specialty') || concept.includes('roast')) {
    warnings.push({
      icon: '💧',
      title: 'Water Quality & Plumbing',
      description:
        'Specialty coffee is 98% water. Verify water pressure, install a filtration system, and budget $2K-$5K for plumbing modifications.',
      severity: 'important',
    });
  }

  // WiFi infrastructure for remote workers
  if (serviceModel === 'sit_down' || concept.includes('cowork') || concept.includes('laptop')) {
    warnings.push({
      icon: '📶',
      title: 'WiFi & Power Outlets',
      description:
        'Sit-down cafes attract remote workers. Budget for commercial-grade WiFi and additional outlet installation — it drives repeat visits.',
      severity: 'info',
    });
  }

  return warnings;
}

// ── RESTAURANT (6 rules) ──
function generateRestaurantWarnings(answers: Record<string, string>): HeadsUpWarning[] {
  const warnings: HeadsUpWarning[] = [];
  const serviceStyle = answers['service_style']?.toLowerCase() || '';
  const mealPeriod = answers['meal_period']?.toLowerCase() || '';
  const pricePoint = answers['price_point']?.toLowerCase() || '';
  const concept = answers['concept']?.toLowerCase() || '';

  if (serviceStyle === 'full_service') {
    warnings.push({
      icon: '🔥',
      title: 'Gas Line & Infrastructure',
      description:
        'Gas line installation costs $10K-$50K+ if non-existent. Also verify grease trap, hood ventilation, and 3-phase electrical.',
      severity: 'critical',
    });
  }

  if (mealPeriod === 'late_night') {
    warnings.push({
      icon: '🔊',
      title: 'Noise Ordinance Check',
      description:
        'Late-night operation requires confirming local noise regulations. Weight safety score higher for after-11pm hours.',
      severity: 'important',
    });
  }

  if (pricePoint === 'fine' || pricePoint === 'upscale') {
    warnings.push({
      icon: '🍷',
      title: 'Liquor License Timeline',
      description:
        'NYC liquor license is $4,500+ and takes 3-6 months. Some zones restrict it. Community board approval may be needed.',
      severity: 'important',
    });
  }

  // Delivery-heavy model needs loading zone
  if (concept.includes('delivery') || concept.includes('ghost') || concept.includes('takeout')) {
    warnings.push({
      icon: '🚗',
      title: 'Loading Zone & Delivery Access',
      description:
        'Delivery-heavy models need a loading zone or double-parking tolerance. Check if the block has commercial vehicle restrictions.',
      severity: 'important',
    });
  }

  // Outdoor seating opportunity
  if (serviceStyle === 'full_service' || concept.includes('outdoor') || concept.includes('patio')) {
    warnings.push({
      icon: '🪑',
      title: 'Outdoor Seating Permits',
      description:
        'NYC Open Restaurants program allows sidewalk/roadway dining. Check if the DOT permits outdoor seating on this block — it can add 30% capacity.',
      severity: 'info',
    });
  }

  // Early morning bakery-style prep
  if (concept.includes('bakery') || concept.includes('pastry') || concept.includes('brunch')) {
    warnings.push({
      icon: '⏰',
      title: 'Early Morning Prep Hours',
      description:
        'Baking and brunch prep starts at 4-5am. Confirm your lease allows early-morning deliveries and equipment operation.',
      severity: 'info',
    });
  }

  return warnings;
}

// ── FITNESS (6 rules) ──
function generateFitnessWarnings(answers: Record<string, string>): HeadsUpWarning[] {
  const warnings: HeadsUpWarning[] = [];
  const fitnessType = answers['fitness_type']?.toLowerCase() || '';
  const peakSchedule = answers['peak_schedule']?.toLowerCase() || '';
  const concept = answers['concept']?.toLowerCase() || '';

  if (fitnessType === 'crossfit' || fitnessType === 'traditional' || concept.includes('weight')) {
    warnings.push({
      icon: '🏋️',
      title: 'Floor Load Capacity',
      description:
        'Heavy equipment like squat racks and platforms require structural floor load verification. Standard retail floors may not support it.',
      severity: 'critical',
    });
  }

  if (fitnessType === 'boutique' && peakSchedule === 'early_morning') {
    warnings.push({
      icon: '❄️',
      title: 'HVAC Capacity',
      description:
        "Standard retail HVAC won't handle 20+ people exercising. Budget $15K-$30K for commercial HVAC upgrades.",
      severity: 'important',
    });
  }

  // Noise always applies
  warnings.push({
    icon: '🔊',
    title: 'Noise & Soundproofing',
    description:
      'Check with landlord AND neighbors. Dropping weights, loud music, and early/late classes need soundproofing — budget $10-$20/sqft.',
    severity: 'important',
  });

  // Ceiling height for functional fitness
  if (fitnessType === 'crossfit' || concept.includes('climbing') || concept.includes('functional')) {
    warnings.push({
      icon: '📐',
      title: 'Ceiling Height Requirements',
      description:
        'Functional fitness needs 14-16ft ceilings minimum for pull-up rigs and rope climbs. Most retail spaces are 10-12ft.',
      severity: 'critical',
    });
  }

  // Shower/locker room plumbing
  if (fitnessType !== 'yoga_only') {
    warnings.push({
      icon: '🚿',
      title: 'Shower & Locker Plumbing',
      description:
        'Members expect showers, especially for AM classes. Plumbing buildout for locker rooms costs $30K-$60K — check if existing infrastructure exists.',
      severity: 'important',
    });
  }

  // Parking for suburban-style or large format
  if (concept.includes('parking') || fitnessType === 'traditional') {
    warnings.push({
      icon: '🅿️',
      title: 'Parking Requirements',
      description:
        'Large-format gyms need dedicated parking. Rule of thumb: 1 space per 200 sqft of gym floor.',
      severity: 'info',
    });
  }

  return warnings;
}

// ── MEDICAL / DENTAL (6 rules) ──
function generateMedicalDentalWarnings(answers: Record<string, string>): HeadsUpWarning[] {
  const warnings: HeadsUpWarning[] = [];
  const practiceType = answers['practice_type']?.toLowerCase() || '';
  const patientSource = answers['patient_source']?.toLowerCase() || '';
  const concept = answers['concept']?.toLowerCase() || '';

  // Always required
  warnings.push({
    icon: '⚖️',
    title: 'Zoning & ADA Compliance',
    description:
      'Medical use must be explicitly zoned. ADA compliance is mandatory. Dental buildout runs $150-$300/sqft.',
    severity: 'critical',
  });

  if (practiceType === 'specialty' || concept.includes('oral surgery') || concept.includes('orthodont')) {
    warnings.push({
      icon: '☢️',
      title: 'X-ray Shielding & Suction Plumbing',
      description:
        'Specialty practice needs lead-lined X-ray rooms and centralized suction/compressor systems — plan for a 6-month buildout.',
      severity: 'important',
    });
  }

  if (patientSource === 'walk_in' || patientSource !== 'referral') {
    warnings.push({
      icon: '🅿️',
      title: 'Patient Parking',
      description:
        'Medical offices need accessible parking. Industry standard: 1 space per 125 sqft.',
      severity: 'important',
    });
  }

  // Insurance network proximity
  if (concept.includes('insurance') || concept.includes('medicaid') || patientSource === 'insurance') {
    warnings.push({
      icon: '🏥',
      title: 'Insurance Network Density',
      description:
        'If you accept insurance, locate near populations with matching coverage. Medicaid-heavy areas have different unit economics than PPO zones.',
      severity: 'info',
    });
  }

  // HIPAA signage and layout
  warnings.push({
    icon: '🔒',
    title: 'HIPAA-Compliant Layout',
    description:
      'Reception, treatment rooms, and records storage must meet HIPAA privacy requirements. Factor soundproofing between operatories.',
    severity: 'important',
  });

  // Elevator access for ground-floor-challenged spaces
  if (concept.includes('pediatric') || concept.includes('elder') || concept.includes('geriatric')) {
    warnings.push({
      icon: '♿',
      title: 'Elevator & Accessibility',
      description:
        'Pediatric and geriatric practices need ground-floor access or a compliant elevator. Stair-only locations lose patients.',
      severity: 'important',
    });
  }

  return warnings;
}

// ── FLORIST (5 rules) ──
function generateFloristWarnings(answers: Record<string, string>): HeadsUpWarning[] {
  const warnings: HeadsUpWarning[] = [];
  const floralFocus = answers['floral_focus']?.toLowerCase() || '';
  const concept = answers['concept']?.toLowerCase() || '';

  if (floralFocus === 'walk_in' || concept.includes('walk-in') || concept.includes('retail')) {
    warnings.push({
      icon: '👥',
      title: 'Street Visibility Critical',
      description:
        'Foot traffic is king for walk-in floral retail. Weight street visibility heavily when scoring.',
      severity: 'important',
    });
  }

  if (floralFocus === 'events' || concept.includes('wedding') || concept.includes('event')) {
    warnings.push({
      icon: '📍',
      title: 'Venue Proximity',
      description:
        'Proximity to hospitals and event venues drives 40%+ of revenue for event florists — you can afford a side street.',
      severity: 'info',
    });
  }

  // Walk-in cooler always needed
  warnings.push({
    icon: '❄️',
    title: 'Walk-in Cooler Requirements',
    description:
      'Walk-in cooler needs significant electrical load + potential floor reinforcement. Budget $8K-$15K if not already installed.',
    severity: 'important',
  });

  // Loading dock / delivery access for wholesale
  if (floralFocus === 'events' || concept.includes('wholesale')) {
    warnings.push({
      icon: '🚚',
      title: 'Loading Access for Bulk Deliveries',
      description:
        'Event and wholesale florists receive large shipments 3-4x per week. Verify there is a loading zone or rear access.',
      severity: 'important',
    });
  }

  // Water drainage
  warnings.push({
    icon: '💧',
    title: 'Water & Floor Drainage',
    description:
      'Flower shops generate constant water runoff. Floor drains and waterproof flooring save you from damage claims.',
    severity: 'info',
  });

  return warnings;
}

// ── SPA & WELLNESS (6 rules) ──
function generateSpaWellnessWarnings(answers: Record<string, string>): HeadsUpWarning[] {
  const warnings: HeadsUpWarning[] = [];
  const spaType = answers['spa_type']?.toLowerCase() || '';
  const clientele = answers['clientele']?.toLowerCase() || '';
  const concept = answers['concept']?.toLowerCase() || '';

  if (spaType === 'day_spa' || spaType === 'med_spa') {
    warnings.push({
      icon: '💧',
      title: 'Plumbing Capacity',
      description:
        'Simultaneous hot water demand is critical. Locate wet areas near existing plumbing or costs multiply by 3-5x.',
      severity: 'critical',
    });
  }

  if (clientele === 'luxury' || concept.includes('luxury') || concept.includes('premium')) {
    warnings.push({
      icon: '🔊',
      title: 'Soundproofing Requirements',
      description:
        'Avoid ground floor on busy streets for luxury spa. Check if neighbors include bars, gyms, or construction.',
      severity: 'important',
    });
  }

  if (clientele === 'luxury' || spaType === 'med_spa') {
    warnings.push({
      icon: '🅿️',
      title: 'Client Parking',
      description:
        'Parking is non-negotiable for spa clients — verify nearby lots or street parking availability.',
      severity: 'important',
    });
  }

  // Med spa licensing
  if (spaType === 'med_spa' || concept.includes('medical') || concept.includes('injectable') || concept.includes('laser')) {
    warnings.push({
      icon: '⚖️',
      title: 'Medical Spa Licensing',
      description:
        'Med spas require a supervising physician and specific state licensing. Verify zoning allows medical use.',
      severity: 'critical',
    });
  }

  // Ventilation for nail services
  if (concept.includes('nail') || concept.includes('manicure') || concept.includes('pedicure')) {
    warnings.push({
      icon: '🌬️',
      title: 'Ventilation for Chemical Use',
      description:
        'Nail services require enhanced ventilation per OSHA standards. Budget for commercial air exchange systems.',
      severity: 'important',
    });
  }

  // Ambiance and neighbor considerations
  warnings.push({
    icon: '🧘',
    title: 'Ambient Environment Check',
    description:
      'Visit at your peak hours. Noise from neighboring tenants, street traffic, and vibrations can ruin the spa experience.',
    severity: 'info',
  });

  return warnings;
}

// ── BARBERSHOP (5 rules) ──
function generateBarbershopWarnings(answers: Record<string, string>): HeadsUpWarning[] {
  const warnings: HeadsUpWarning[] = [];
  const vibe = answers['vibe']?.toLowerCase() || '';
  const concept = answers['concept']?.toLowerCase() || '';

  if (vibe === 'premium' || concept.includes('luxury') || concept.includes('premium')) {
    warnings.push({
      icon: '📊',
      title: 'Demographics for Premium Positioning',
      description:
        'Premium barbershops need visible street presence and high-income neighborhoods. Verify the demographics match your $40-$80 price point.',
      severity: 'info',
    });
  }

  // Plumbing always needed
  warnings.push({
    icon: '💧',
    title: 'Plumbing for Multiple Stations',
    description:
      'Each barber station needs its own hot water supply. Verify the space can support your planned chair count.',
    severity: 'important',
  });

  // Walk-in dependent — visibility matters
  warnings.push({
    icon: '👥',
    title: 'Walk-in Visibility',
    description:
      'Barbershops are highly walk-in dependent. Ground-floor with large windows on a foot-traffic street is ideal.',
    severity: 'important',
  });

  // Waiting area capacity
  if (concept.includes('5+ chairs') || concept.includes('large') || concept.includes('team')) {
    warnings.push({
      icon: '🪑',
      title: 'Waiting Area Sizing',
      description:
        'Rule of thumb: waiting area should seat 2x your chair count. A 6-chair shop needs seating for 12 waiting clients.',
      severity: 'info',
    });
  }

  // Signage and local licensing
  warnings.push({
    icon: '📋',
    title: 'Barbering License & DOH Compliance',
    description:
      'NYC requires individual barber licenses and a shop license from the Department of Health. Inspections happen unannounced.',
    severity: 'info',
  });

  return warnings;
}

// ── RETAIL (6 rules) ──
function generateRetailWarnings(answers: Record<string, string>): HeadsUpWarning[] {
  const warnings: HeadsUpWarning[] = [];
  const trafficModel = answers['traffic_model']?.toLowerCase() || '';
  const concept = answers['concept']?.toLowerCase() || '';

  if (trafficModel === 'foot_traffic' || concept.includes('walk-in') || concept.includes('browse')) {
    warnings.push({
      icon: '👥',
      title: 'Street-Level Location Critical',
      description:
        'Street-level with large display windows is critical for foot traffic retail. Basement or second floor kills walk-in conversion.',
      severity: 'important',
    });
  }

  // Co-tenancy clause
  warnings.push({
    icon: '📋',
    title: 'Co-Tenancy Clause',
    description:
      'Retail lease tip: negotiate a co-tenancy clause — if the anchor store near you closes, you get rent relief or can exit.',
    severity: 'info',
  });

  // Seasonal inventory storage
  if (concept.includes('fashion') || concept.includes('boutique') || concept.includes('clothing')) {
    warnings.push({
      icon: '📦',
      title: 'Storage for Seasonal Inventory',
      description:
        'Fashion retail needs dedicated storage (ideally 20-30% of floor area). Verify ceiling height for shelving and back-of-house access.',
      severity: 'important',
    });
  }

  // Online-hybrid model
  if (concept.includes('online') || concept.includes('e-commerce') || concept.includes('ship')) {
    warnings.push({
      icon: '📦',
      title: 'Fulfillment-Friendly Layout',
      description:
        'Hybrid retail-online needs a packing/shipping area. Consider proximity to shipping carriers (UPS, FedEx, USPS) for daily pickups.',
      severity: 'info',
    });
  }

  // Security for high-value inventory
  if (concept.includes('jewelry') || concept.includes('electronics') || concept.includes('luxury')) {
    warnings.push({
      icon: '🔒',
      title: 'Security Infrastructure',
      description:
        'High-value inventory needs security gates, cameras, and possibly a safe room. Check if the space has existing security wiring.',
      severity: 'important',
    });
  }

  // Signage regulations
  warnings.push({
    icon: '🪧',
    title: 'Signage & Awning Permits',
    description:
      'NYC has strict signage regulations by district. Verify what size/type of signage your block allows before designing your storefront.',
    severity: 'info',
  });

  return warnings;
}

// ── SOMETHING ELSE (generic rules for unknown/custom business types) ──
function generateSomethingElseWarnings(answers: Record<string, string>): HeadsUpWarning[] {
  const warnings: HeadsUpWarning[] = [];
  const concept = answers['concept']?.toLowerCase() || '';

  // Always show zoning verification for unknown types
  warnings.push({
    icon: '⚖️',
    title: 'Zoning Verification Required',
    description:
      'Your business type may have specific zoning requirements. Verify with the NYC Department of Buildings that your intended use is permitted at this address.',
    severity: 'critical',
  });

  // ADA compliance
  warnings.push({
    icon: '♿',
    title: 'ADA Compliance Check',
    description:
      'All customer-facing businesses must meet ADA accessibility requirements. Budget for ramps, accessible restrooms, and doorway widths.',
    severity: 'important',
  });

  // Lease negotiation basics
  warnings.push({
    icon: '📋',
    title: 'Lease Negotiation Essentials',
    description:
      'Always negotiate: free rent period (2-3 months), tenant improvement allowance ($20-$50/sqft), and an out clause at year 3.',
    severity: 'info',
  });

  // If concept mentions anything food-related
  if (concept.includes('food') || concept.includes('cook') || concept.includes('kitchen') || concept.includes('eat')) {
    warnings.push({
      icon: '🔧',
      title: 'Food Service Infrastructure',
      description:
        'Food service requires grease traps, hood ventilation, and DOH permits. Verify if the space has prior food-use infrastructure.',
      severity: 'important',
    });
  }

  return warnings;
}
