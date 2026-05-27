import { scoreToGrade } from '$lib/intel/scoring/grade-scale';

export interface SpaceCard {
  id: string;
  address: string;
  status: 'new' | 'reviewing' | 'visited' | 'negotiating' | 'signed' | 'passed';
  createdAt: string;
  updatedAt: string;

  // Physical details
  totalSqft: number;
  usableSqft: number;
  ceilingHeight: number; // feet
  floorLevel: 'ground' | 'second' | 'basement' | 'upper';
  previousUse: 'full_service_restaurant' | 'retail' | 'office' | 'raw' | 'other';

  // Physical readiness factors
  hvacPresent: boolean;
  hvacAdequate: boolean;
  plumbingPresent: boolean;
  plumbingAdequate: boolean;
  electricalCapacity: 'adequate' | 'needs-upgrade' | 'insufficient';
  gasLine: boolean;
  greaseTrap: boolean;
  hoodVent: boolean;
  flooringCondition: 'good' | 'fair' | 'needs-replacement';
  bathroomCount: number;
  bathroomAdaCompliant: boolean;

  // Visibility & access
  frontageWidth: number; // feet
  frontageType: 'full-glass' | 'partial-glass' | 'solid-wall' | 'roll-gate';
  cornerUnit: boolean;
  signageAllowed: boolean;
  signageType: 'blade' | 'awning' | 'window-only' | 'none';
  sidewalkWidth: number; // feet (for outdoor seating potential)
  nearestTransitDistance: number; // feet
  parkingSpaces: number;
  deliveryAccess: boolean;

  // Lease economics
  baseRentMonthly: number;
  rentPerSqft: number; // annual
  escalationRate: number; // percent per year
  escalationCap: number | null; // null = uncapped
  leaseTerm: number; // years
  renewalOptions: number; // number of renewal periods
  tiAllowance: number; // total TI $
  tiPerSqft: number;
  rentFreeMonths: number;
  personalGuarantee: 'full' | 'good-guy' | 'burnoff' | 'none';
  permittedUse: string;
  exclusivityClause: boolean;
  earlyTermination: boolean;
  assignmentRights: boolean;

  // Structural flexibility
  landlordApprovalRequired: boolean;
  coopBoard: boolean;
  roofAccess: boolean; // for venting
  maxElectricalLoad: number; // amps
  structuralModsAllowed: boolean;
  outdoorSeatingAllowed: boolean;
  alcoholLicenseAllowed: boolean;
  historicPreservation: boolean;

  // Computed (filled by scoring)
  spaceScore?: SpaceScoreResult;
  buildoutGap?: BuildoutGapEstimate;
}

export interface SpaceScoreResult {
  total: number; // 0-100
  grade: string; // A+ through F
  dimensions: {
    physicalReadiness: DimensionScore;
    visibilityAccess: DimensionScore;
    leaseEconomics: DimensionScore;
    structuralFlexibility: DimensionScore;
  };
  verdict: string;
  dealBreakers: string[];
}

export interface DimensionScore {
  score: number; // 0-100
  weight: number; // 0-1
  weighted: number; // score * weight
  factors: { name: string; score: number; maxScore: number; note: string }[];
}

export interface BuildoutGapEstimate {
  totalLow: number;
  totalHigh: number;
  items: { category: string; needed: boolean; lowCost: number; highCost: number; note: string }[];
  tiCoverage: number; // what % the TI allowance covers
}

import type { ValidBusinessType } from '$lib/intel/registry/business-type-registry';

const WEIGHT_MATRIX: Record<ValidBusinessType | string, Record<string, number>> = {
  specialty_coffee: {
    physical: 0.25,
    visibility: 0.30,
    lease: 0.30,
    structural: 0.15,
  },
  bakery: {
    physical: 0.30,
    visibility: 0.25,
    lease: 0.30,
    structural: 0.15,
  },
  fast_casual: {
    physical: 0.30,
    visibility: 0.25,
    lease: 0.25,
    structural: 0.20,
  },
  full_service_restaurant: {
    physical: 0.35,
    visibility: 0.20,
    lease: 0.25,
    structural: 0.20,
  },
  fitness_studio: {
    physical: 0.30,
    visibility: 0.15,
    lease: 0.30,
    structural: 0.25,
  },
  retail: {
    physical: 0.20,
    visibility: 0.35,
    lease: 0.30,
    structural: 0.15,
  },
};

/**
 * Get weight configuration for a business type
 */
export function getWeights(businessType: string): Record<string, number> {
  return WEIGHT_MATRIX[businessType] || WEIGHT_MATRIX.retail;
}

// 04.19.2026 13:35 Score Consolidation — scoreToGrade removed. Imported from canonical grade-scale.ts above.
// Note: previous thresholds (95/90/85/80...) were a divergence — canonical scale (93/87/80...) now applies.

/**
 * Identify deal breakers for a space given business type
 */
function getDealBreakers(
  card: SpaceCard,
  businessType: string
): string[] {
  const breakers: string[] = [];
  const isFood =
    businessType === 'full_service_restaurant' ||
    businessType === 'fast_casual' ||
    businessType === 'bakery';

  // Basement + food service
  if (card.floorLevel === 'basement' && isFood) {
    breakers.push(
      'Basement unit severely limits food service visibility'
    );
  }

  // Cannot install kitchen ventilation
  if (
    isFood &&
    !card.hoodVent &&
    !card.roofAccess
  ) {
    breakers.push(
      'Cannot install required kitchen ventilation'
    );
  }

  // Full personal guarantee on long lease
  if (card.personalGuarantee === 'full' && card.leaseTerm > 5) {
    breakers.push(
      'Full personal guarantee on 5+ year lease is high risk'
    );
  }

  // Uncapped escalation above 4%
  if (card.escalationRate > 4 && card.escalationCap === null) {
    breakers.push(
      'Uncapped escalation above 4% will erode margins'
    );
  }

  // Co-op board + structural mods needed
  if (card.coopBoard && !card.structuralModsAllowed) {
    breakers.push(
      'Co-op board approval required for structural modifications — high uncertainty'
    );
  }

  return breakers;
}

/**
 * Score Physical Readiness dimension (0-100)
 */
function scorePhysicalReadiness(card: SpaceCard): DimensionScore {
  const factors: { name: string; score: number; maxScore: number; note: string }[] = [];

  // HVAC (0-20)
  let hvacScore = 0;
  let hvacNote = '';
  if (card.hvacPresent && card.hvacAdequate) {
    hvacScore = 20;
    hvacNote = 'Present and adequate';
  } else if (card.hvacPresent) {
    hvacScore = 10;
    hvacNote = 'Present but needs upgrade';
  } else {
    hvacNote = 'Absent';
  }
  factors.push({ name: 'HVAC', score: hvacScore, maxScore: 20, note: hvacNote });

  // Plumbing (0-15)
  let plumbingScore = 0;
  let plumbingNote = '';
  if (card.plumbingPresent && card.plumbingAdequate) {
    plumbingScore = 15;
    plumbingNote = 'Present and adequate';
  } else if (card.plumbingPresent) {
    plumbingScore = 8;
    plumbingNote = 'Present but needs upgrade';
  } else {
    plumbingNote = 'Absent';
  }
  factors.push({ name: 'Plumbing', score: plumbingScore, maxScore: 15, note: plumbingNote });

  // Electrical (0-15)
  let electricalScore = 0;
  let electricalNote = '';
  if (card.electricalCapacity === 'adequate') {
    electricalScore = 15;
    electricalNote = 'Adequate capacity';
  } else if (card.electricalCapacity === 'needs-upgrade') {
    electricalScore = 8;
    electricalNote = 'Needs upgrade';
  } else {
    electricalNote = 'Insufficient';
  }
  factors.push({ name: 'Electrical', score: electricalScore, maxScore: 15, note: electricalNote });

  // Kitchen infrastructure (0-20)
  // gas + grease trap + hood: each present adds ~7
  let kitchenScore = 0;
  const kitchenParts: string[] = [];
  if (card.gasLine) {
    kitchenScore += 7;
    kitchenParts.push('gas');
  }
  if (card.greaseTrap) {
    kitchenScore += 7;
    kitchenParts.push('grease trap');
  }
  if (card.hoodVent) {
    kitchenScore += 7;
    kitchenParts.push('hood');
  }
  // Cap at 20
  if (kitchenScore > 20) kitchenScore = 20;
  const kitchenNote = kitchenParts.length > 0
    ? `${kitchenParts.join(', ')} present`
    : 'No kitchen infrastructure';
  factors.push({ name: 'Kitchen infrastructure', score: kitchenScore, maxScore: 20, note: kitchenNote });

  // Flooring (0-10)
  let flooringScore = 0;
  let flooringNote = '';
  if (card.flooringCondition === 'good') {
    flooringScore = 10;
    flooringNote = 'Good condition';
  } else if (card.flooringCondition === 'fair') {
    flooringScore = 5;
    flooringNote = 'Fair condition';
  } else {
    flooringNote = 'Needs replacement';
  }
  factors.push({ name: 'Flooring', score: flooringScore, maxScore: 10, note: flooringNote });

  // Bathroom (0-10)
  let bathroomScore = 0;
  let bathroomNote = '';
  if (card.bathroomCount >= 1 && card.bathroomAdaCompliant) {
    bathroomScore = 10;
    bathroomNote = `${card.bathroomCount} bathroom(s), ADA compliant`;
  } else if (card.bathroomCount >= 1) {
    bathroomScore = 6;
    bathroomNote = `${card.bathroomCount} bathroom(s), not ADA compliant`;
  } else {
    bathroomNote = 'No bathrooms';
  }
  factors.push({ name: 'Bathroom', score: bathroomScore, maxScore: 10, note: bathroomNote });

  // Ceiling height (0-10)
  let ceilingScore = 0;
  let ceilingNote = '';
  if (card.ceilingHeight >= 12) {
    ceilingScore = 10;
    ceilingNote = `${card.ceilingHeight}ft (excellent)`;
  } else if (card.ceilingHeight >= 10) {
    ceilingScore = 7;
    ceilingNote = `${card.ceilingHeight}ft (good)`;
  } else if (card.ceilingHeight >= 8) {
    ceilingScore = 4;
    ceilingNote = `${card.ceilingHeight}ft (marginal)`;
  } else {
    ceilingNote = `${card.ceilingHeight}ft (too low)`;
  }
  factors.push({ name: 'Ceiling height', score: ceilingScore, maxScore: 10, note: ceilingNote });

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const maxScore = factors.reduce((sum, f) => sum + f.maxScore, 0);
  const score = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  return {
    score: Math.round(score),
    weight: 0, // Will be set by caller
    weighted: 0, // Will be calculated by caller
    factors,
  };
}

/**
 * Score Visibility & Access dimension (0-100)
 */
function scoreVisibilityAccess(card: SpaceCard): DimensionScore {
  const factors: { name: string; score: number; maxScore: number; note: string }[] = [];

  // Floor level (0-20)
  let floorScore = 0;
  let floorNote = '';
  switch (card.floorLevel) {
    case 'ground':
      floorScore = 20;
      floorNote = 'Ground floor';
      break;
    case 'second':
      floorScore = 8;
      floorNote = 'Second floor';
      break;
    case 'basement':
      floorScore = 4;
      floorNote = 'Basement';
      break;
    case 'upper':
      floorScore = 2;
      floorNote = 'Upper floor';
      break;
  }
  factors.push({ name: 'Floor level', score: floorScore, maxScore: 20, note: floorNote });

  // Frontage (0-25)
  let frontageScore = 0;
  let frontageNote = '';
  const cornerBonus = card.cornerUnit ? 5 : 0;

  if (card.frontageType === 'full-glass') {
    frontageScore = 20 + cornerBonus;
    frontageNote = `Full glass (${card.cornerUnit ? 'corner' : 'non-corner'})`;
  } else if (card.frontageType === 'partial-glass') {
    frontageScore = 12 + cornerBonus;
    frontageNote = 'Partial glass';
  } else {
    frontageScore = 5 + cornerBonus;
    frontageNote = 'Solid wall or roll gate';
  }

  // Width adjustment: <10ft=-5, 10-15ft=0, 15-25ft=0 (base), >25ft=+5 (cap 25)
  let widthAdj = 0;
  if (card.frontageWidth < 10) {
    widthAdj = -5;
  } else if (card.frontageWidth > 25) {
    widthAdj = 5;
  }
  frontageScore += widthAdj;
  if (frontageScore > 25) frontageScore = 25;
  if (frontageScore < 0) frontageScore = 0;

  frontageNote += ` (${card.frontageWidth}ft width)`;
  factors.push({ name: 'Frontage', score: frontageScore, maxScore: 25, note: frontageNote });

  // Signage (0-15)
  let signageScore = 0;
  let signageNote = '';
  if (card.signageAllowed) {
    switch (card.signageType) {
      case 'blade':
        signageScore = 15;
        signageNote = 'Blade sign allowed';
        break;
      case 'awning':
        signageScore = 12;
        signageNote = 'Awning sign allowed';
        break;
      case 'window-only':
        signageScore = 6;
        signageNote = 'Window signage only';
        break;
      case 'none':
        signageNote = 'No signage allowed';
        break;
    }
  } else {
    signageNote = 'No signage allowed';
  }
  factors.push({ name: 'Signage', score: signageScore, maxScore: 15, note: signageNote });

  // Transit proximity (0-15)
  let transitScore = 0;
  let transitNote = '';
  if (card.nearestTransitDistance < 200) {
    transitScore = 15;
    transitNote = 'Within 200ft of transit';
  } else if (card.nearestTransitDistance < 500) {
    transitScore = 12;
    transitNote = 'Within 500ft of transit';
  } else if (card.nearestTransitDistance < 1000) {
    transitScore = 8;
    transitNote = 'Within 1000ft of transit';
  } else {
    transitScore = 3;
    transitNote = 'Over 1000ft from transit';
  }
  factors.push({ name: 'Transit proximity', score: transitScore, maxScore: 15, note: transitNote });

  // Sidewalk/outdoor seating (0-10)
  let sideWalkScore = 0;
  let sidewalkNote = '';
  if (card.sidewalkWidth > 12 && card.outdoorSeatingAllowed) {
    sideWalkScore = 10;
    sidewalkNote = `${card.sidewalkWidth}ft sidewalk, outdoor seating allowed`;
  } else if (card.sidewalkWidth > 8) {
    sideWalkScore = 6;
    sidewalkNote = `${card.sidewalkWidth}ft sidewalk`;
  } else {
    sideWalkScore = 3;
    sidewalkNote = `${card.sidewalkWidth}ft sidewalk (narrow)`;
  }
  factors.push({ name: 'Sidewalk/outdoor', score: sideWalkScore, maxScore: 10, note: sidewalkNote });

  // Parking (0-5)
  let parkingScore = 0;
  let parkingNote = '';
  if (card.parkingSpaces >= 5) {
    parkingScore = 5;
    parkingNote = `${card.parkingSpaces} spaces (excellent)`;
  } else if (card.parkingSpaces >= 1) {
    parkingScore = 3;
    parkingNote = `${card.parkingSpaces} space(s)`;
  } else {
    parkingNote = 'No parking';
  }
  factors.push({ name: 'Parking', score: parkingScore, maxScore: 5, note: parkingNote });

  // Delivery access (0-10)
  const deliveryScore = card.deliveryAccess ? 10 : 0;
  const deliveryNote = card.deliveryAccess ? 'Yes' : 'No';
  factors.push({ name: 'Delivery access', score: deliveryScore, maxScore: 10, note: deliveryNote });

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const maxScore = factors.reduce((sum, f) => sum + f.maxScore, 0);
  const score = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  return {
    score: Math.round(score),
    weight: 0,
    weighted: 0,
    factors,
  };
}

/**
 * Score Lease Economics dimension (0-100)
 */
function scoreLeaseEconomics(
  card: SpaceCard,
  rentBudget?: number
): DimensionScore {
  const factors: { name: string; score: number; maxScore: number; note: string }[] = [];

  // Rent vs budget (0-20)
  let rentScore = 0;
  let rentNote = '';
  if (rentBudget) {
    const rentDiff = ((card.baseRentMonthly - rentBudget) / rentBudget) * 100;
    if (rentDiff <= 0) {
      rentScore = 20;
      rentNote = `${card.baseRentMonthly}/mo (at/under $${rentBudget})`;
    } else if (rentDiff <= 10) {
      rentScore = 14;
      rentNote = `${card.baseRentMonthly}/mo (${Math.round(rentDiff)}% over budget)`;
    } else if (rentDiff <= 20) {
      rentScore = 8;
      rentNote = `${card.baseRentMonthly}/mo (${Math.round(rentDiff)}% over budget)`;
    } else {
      rentNote = `${card.baseRentMonthly}/mo (${Math.round(rentDiff)}% over budget)`;
    }
  } else {
    rentScore = 14; // neutral if no budget provided
    rentNote = `${card.baseRentMonthly}/mo`;
  }
  factors.push({ name: 'Rent vs budget', score: rentScore, maxScore: 20, note: rentNote });

  // Escalation (0-15)
  let escalationScore = 0;
  let escalationNote = '';
  if (card.escalationRate <= 2 || card.escalationCap !== null) {
    escalationScore = 15;
    escalationNote = `${card.escalationRate}% ${card.escalationCap ? `capped at ${card.escalationCap}%` : 'or CPI capped'}`;
  } else if (card.escalationRate === 3) {
    escalationScore = 10;
    escalationNote = '3% (uncapped)';
  } else if (card.escalationRate === 4 && card.escalationCap === null) {
    escalationScore = 5;
    escalationNote = '4% uncapped';
  } else {
    escalationNote = `${card.escalationRate}% uncapped (high)`;
  }
  factors.push({ name: 'Escalation', score: escalationScore, maxScore: 15, note: escalationNote });

  // TI allowance (0-15)
  let tiScore = 0;
  let tiNote = '';
  const tiPerSqft = card.tiPerSqft;
  if (tiPerSqft > 40) {
    tiScore = 15;
    tiNote = `$${tiPerSqft}/sqft (excellent)`;
  } else if (tiPerSqft >= 20) {
    tiScore = 10;
    tiNote = `$${tiPerSqft}/sqft (good)`;
  } else if (tiPerSqft >= 10) {
    tiScore = 6;
    tiNote = `$${tiPerSqft}/sqft (fair)`;
  } else if (tiPerSqft > 0) {
    tiScore = 2;
    tiNote = `$${tiPerSqft}/sqft (minimal)`;
  } else {
    tiNote = '$0 (none)';
  }
  factors.push({ name: 'TI allowance', score: tiScore, maxScore: 15, note: tiNote });

  // Lease term (0-10)
  let termScore = 0;
  let termNote = '';
  if (card.leaseTerm >= 10) {
    termScore = 10;
    termNote = `${card.leaseTerm} years (excellent)`;
  } else if (card.leaseTerm >= 7) {
    termScore = 8;
    termNote = `${card.leaseTerm} years (good)`;
  } else if (card.leaseTerm >= 5) {
    termScore = 6;
    termNote = `${card.leaseTerm} years (fair)`;
  } else if (card.leaseTerm >= 3) {
    termScore = 3;
    termNote = `${card.leaseTerm} years (short)`;
  } else {
    termNote = `${card.leaseTerm} years (very short)`;
  }
  factors.push({ name: 'Lease term', score: termScore, maxScore: 10, note: termNote });

  // Personal guarantee (0-15)
  let guaranteeScore = 0;
  let guaranteeNote = '';
  switch (card.personalGuarantee) {
    case 'none':
      guaranteeScore = 15;
      guaranteeNote = 'No personal guarantee';
      break;
    case 'burnoff':
      guaranteeScore = 12;
      guaranteeNote = 'Burnoff clause';
      break;
    case 'good-guy':
      guaranteeScore = 8;
      guaranteeNote = 'Good-guy guarantee';
      break;
    case 'full':
      guaranteeScore = 3;
      guaranteeNote = 'Full personal guarantee';
      break;
  }
  factors.push({ name: 'Personal guarantee', score: guaranteeScore, maxScore: 15, note: guaranteeNote });

  // Rent-free months (0-10)
  let freeScore = 0;
  let freeNote = '';
  if (card.rentFreeMonths >= 4) {
    freeScore = 10;
    freeNote = `${card.rentFreeMonths} months`;
  } else if (card.rentFreeMonths === 3) {
    freeScore = 8;
    freeNote = '3 months';
  } else if (card.rentFreeMonths === 2) {
    freeScore = 6;
    freeNote = '2 months';
  } else if (card.rentFreeMonths === 1) {
    freeScore = 3;
    freeNote = '1 month';
  } else {
    freeNote = 'None';
  }
  factors.push({ name: 'Rent-free months', score: freeScore, maxScore: 10, note: freeNote });

  // Renewal options (0-5)
  let renewalScore = 0;
  let renewalNote = '';
  if (card.renewalOptions >= 2) {
    renewalScore = 5;
    renewalNote = `${card.renewalOptions} renewal options`;
  } else if (card.renewalOptions === 1) {
    renewalScore = 3;
    renewalNote = '1 renewal option';
  } else {
    renewalNote = 'No renewal options';
  }
  factors.push({ name: 'Renewal options', score: renewalScore, maxScore: 5, note: renewalNote });

  // Assignment/subletting (0-5)
  const assignmentScore = card.assignmentRights ? 5 : 0;
  const assignmentNote = card.assignmentRights ? 'Yes' : 'No';
  factors.push({ name: 'Assignment rights', score: assignmentScore, maxScore: 5, note: assignmentNote });

  // Early termination (0-5)
  const earlyScore = card.earlyTermination ? 5 : 0;
  const earlyNote = card.earlyTermination ? 'Yes' : 'No';
  factors.push({ name: 'Early termination', score: earlyScore, maxScore: 5, note: earlyNote });

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const maxScore = factors.reduce((sum, f) => sum + f.maxScore, 0);
  const score = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  return {
    score: Math.round(score),
    weight: 0,
    weighted: 0,
    factors,
  };
}

/**
 * Score Structural Flexibility dimension (0-100)
 */
function scoreStructuralFlexibility(card: SpaceCard): DimensionScore {
  const factors: { name: string; score: number; maxScore: number; note: string }[] = [];

  // Mods allowed (0-25)
  const modsScore = card.structuralModsAllowed ? 25 : 0;
  const modsNote = card.structuralModsAllowed
    ? 'Structural modifications allowed'
    : 'Structural modifications not allowed';
  factors.push({ name: 'Structural modifications', score: modsScore, maxScore: 25, note: modsNote });

  // Roof access for venting (0-20)
  const roofScore = card.roofAccess ? 20 : 0;
  const roofNote = card.roofAccess ? 'Roof access available' : 'No roof access';
  factors.push({ name: 'Roof access', score: roofScore, maxScore: 20, note: roofNote });

  // No co-op board (0-15)
  const boardScore = !card.coopBoard ? 15 : 0;
  const boardNote = !card.coopBoard ? 'No co-op board' : 'Co-op board present';
  factors.push({ name: 'No co-op board', score: boardScore, maxScore: 15, note: boardNote });

  // Outdoor seating (0-10)
  const seatingScore = card.outdoorSeatingAllowed ? 10 : 0;
  const seatingNote = card.outdoorSeatingAllowed ? 'Allowed' : 'Not allowed';
  factors.push({ name: 'Outdoor seating', score: seatingScore, maxScore: 10, note: seatingNote });

  // Alcohol license (0-10)
  const alcoholScore = card.alcoholLicenseAllowed ? 10 : 0;
  const alcoholNote = card.alcoholLicenseAllowed ? 'Allowed' : 'Not allowed';
  factors.push({ name: 'Alcohol license', score: alcoholScore, maxScore: 10, note: alcoholNote });

  // Not historic (0-10)
  let historicScore = 0;
  let historicNote = '';
  if (!card.historicPreservation) {
    historicScore = 10;
    historicNote = 'No historic preservation restrictions';
  } else {
    historicScore = 3;
    historicNote = 'Historic preservation restrictions apply';
  }
  factors.push({ name: 'Historic restrictions', score: historicScore, maxScore: 10, note: historicNote });

  // Electrical capacity (0-10)
  let electricalLoadScore = 0;
  let electricalLoadNote = '';
  if (card.maxElectricalLoad >= 200) {
    electricalLoadScore = 10;
    electricalLoadNote = `${card.maxElectricalLoad}A (excellent)`;
  } else if (card.maxElectricalLoad >= 100) {
    electricalLoadScore = 6;
    electricalLoadNote = `${card.maxElectricalLoad}A (adequate)`;
  } else {
    electricalLoadScore = 2;
    electricalLoadNote = `${card.maxElectricalLoad}A (limited)`;
  }
  factors.push({ name: 'Electrical capacity', score: electricalLoadScore, maxScore: 10, note: electricalLoadNote });

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const maxScore = factors.reduce((sum, f) => sum + f.maxScore, 0);
  const score = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  return {
    score: Math.round(score),
    weight: 0,
    weighted: 0,
    factors,
  };
}

/**
 * Compute the complete Space Score for a card
 */
export function computeSpaceScore(
  card: SpaceCard,
  businessType: string,
  rentBudget?: number
): SpaceScoreResult {
  // Score each dimension
  const physicalReadiness = scorePhysicalReadiness(card);
  const visibilityAccess = scoreVisibilityAccess(card);
  const leaseEconomics = scoreLeaseEconomics(card, rentBudget);
  const structuralFlexibility = scoreStructuralFlexibility(card);

  // Get weights
  const weights = getWeights(businessType);

  // Apply weights
  physicalReadiness.weight = weights.physical;
  physicalReadiness.weighted = physicalReadiness.score * weights.physical;

  visibilityAccess.weight = weights.visibility;
  visibilityAccess.weighted = visibilityAccess.score * weights.visibility;

  leaseEconomics.weight = weights.lease;
  leaseEconomics.weighted = leaseEconomics.score * weights.lease;

  structuralFlexibility.weight = weights.structural;
  structuralFlexibility.weighted = structuralFlexibility.score * weights.structural;

  // Calculate total score
  const total = Math.round(
    physicalReadiness.weighted +
    visibilityAccess.weighted +
    leaseEconomics.weighted +
    structuralFlexibility.weighted
  );

  // Get grade
  const grade = scoreToGrade(total);

  // Get deal breakers
  const dealBreakers = getDealBreakers(card, businessType);

  // Generate verdict
  let verdict = '';
  if (dealBreakers.length > 0) {
    verdict = `Deal breakers present: ${dealBreakers.length} issue(s)`;
  } else if (total >= 80) {
    verdict = 'Strong candidate for further evaluation';
  } else if (total >= 65) {
    verdict = 'Viable option with considerations';
  } else if (total >= 50) {
    verdict = 'Proceed with caution';
  } else {
    verdict = 'Not recommended without significant improvements';
  }

  return {
    total,
    grade,
    dimensions: {
      physicalReadiness,
      visibilityAccess,
      leaseEconomics,
      structuralFlexibility,
    },
    verdict,
    dealBreakers,
  };
}

/**
 * Estimate buildout gap and costs
 */
export function estimateBuildoutGap(
  card: SpaceCard,
  businessType: string
): BuildoutGapEstimate {
  const items: { category: string; needed: boolean; lowCost: number; highCost: number; note: string }[] = [];

  // HVAC
  if (!card.hvacPresent) {
    items.push({
      category: 'HVAC installation',
      needed: true,
      lowCost: 15000,
      highCost: 40000,
      note: 'Full system installation',
    });
  } else if (card.hvacPresent && !card.hvacAdequate) {
    items.push({
      category: 'HVAC upgrade',
      needed: true,
      lowCost: 5000,
      highCost: 15000,
      note: 'Upgrade to adequate capacity',
    });
  }

  // Plumbing
  if (!card.plumbingPresent) {
    items.push({
      category: 'Plumbing installation',
      needed: true,
      lowCost: 20000,
      highCost: 50000,
      note: 'New plumbing system',
    });
  } else if (card.plumbingPresent && !card.plumbingAdequate) {
    items.push({
      category: 'Plumbing upgrade',
      needed: true,
      lowCost: 8000,
      highCost: 20000,
      note: 'Upgrade for adequate capacity',
    });
  }

  // Electrical
  if (card.electricalCapacity === 'insufficient' || card.electricalCapacity === 'needs-upgrade') {
    items.push({
      category: 'Electrical upgrade',
      needed: true,
      lowCost: 10000,
      highCost: 30000,
      note: 'Upgrade panel or capacity',
    });
  }

  // Gas line
  const isFood =
    businessType === 'full_service_restaurant' ||
    businessType === 'fast_casual' ||
    businessType === 'bakery';
  if (isFood && !card.gasLine) {
    items.push({
      category: 'Gas line installation',
      needed: true,
      lowCost: 5000,
      highCost: 12000,
      note: 'Natural gas line for cooking equipment',
    });
  }

  // Grease trap
  if (isFood && !card.greaseTrap) {
    items.push({
      category: 'Grease trap installation',
      needed: true,
      lowCost: 3000,
      highCost: 8000,
      note: 'Required for food service',
    });
  }

  // Hood/vent
  if (isFood && !card.hoodVent) {
    items.push({
      category: 'Hood/vent system installation',
      needed: true,
      lowCost: 15000,
      highCost: 45000,
      note: 'Kitchen exhaust system',
    });
  }

  // Flooring
  if (card.flooringCondition === 'needs-replacement') {
    items.push({
      category: 'Flooring replacement',
      needed: true,
      lowCost: 8000,
      highCost: 25000,
      note: 'New flooring installation',
    });
  }

  // Bathroom (ADA)
  if (card.bathroomCount === 0) {
    items.push({
      category: 'Bathroom installation',
      needed: true,
      lowCost: 20000,
      highCost: 50000,
      note: 'New bathroom with ADA compliance',
    });
  } else if (!card.bathroomAdaCompliant) {
    items.push({
      category: 'ADA bathroom upgrade',
      needed: true,
      lowCost: 15000,
      highCost: 35000,
      note: 'Retrofit for ADA compliance',
    });
  }

  // Calculate totals
  const totalLow = items.reduce((sum, item) => sum + (item.needed ? item.lowCost : 0), 0);
  const totalHigh = items.reduce((sum, item) => sum + (item.needed ? item.highCost : 0), 0);

  // Calculate TI coverage
  const tiCoverage = totalHigh > 0
    ? Math.min((card.tiAllowance / totalHigh) * 100, 100)
    : 100;

  return {
    totalLow,
    totalHigh,
    items,
    tiCoverage: Math.round(tiCoverage),
  };
}

/**
 * Compare multiple spaces and sort by score
 */
export function compareSpaces(
  cards: SpaceCard[],
  businessType: string,
  rentBudget?: number
): SpaceCard[] {
  return cards
    .map((card) => ({
      ...card,
      spaceScore: computeSpaceScore(card, businessType, rentBudget),
      buildoutGap: estimateBuildoutGap(card, businessType),
    }))
    .sort((a, b) => (b.spaceScore?.total || 0) - (a.spaceScore?.total || 0));
}

export function buildSpaceScoreBundle(
  card: SpaceCard,
  businessType: string,
  rentBudget?: number
): { spaceScore: SpaceScoreResult; buildoutGap: BuildoutGapEstimate } {
  return {
    spaceScore: computeSpaceScore(card, businessType, rentBudget),
    buildoutGap: estimateBuildoutGap(card, businessType),
  };
}
