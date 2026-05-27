/**
 * Category Configuration System for RE²
 * Defines business category configurations for multiple verticals
 */

import type { ValidBusinessType } from './business-type-registry';

export interface Daypart {
  name: string;
  startHour: number;
  endHour: number;
  revenueShare: number; // 0-100, should sum to 100 across all dayparts
}

export interface SizeTier {
  id: string;
  label: string;
  sqftMin: number;
  sqftMax: number;
  typicalRent: number; // annual rent in dollars
  typicalBuildout: number; // buildout cost in dollars
}

export interface FinancialDefaults {
  avgTicket: number;
  dailyTransactions: number;
  cogsPercent: number; // cost of goods sold as % of revenue
  laborPercent: number; // labor as % of revenue
  rentPercent: number; // rent as % of revenue
  targetMargin: number; // target profit margin %
}

export interface OSMTag {
  key: string;
  value: string;
}

export interface FormatOption {
  id: string;
  label: string;
}

export interface RegulatoryCheck {
  id: string;
  label: string;
  description: string;
}

export interface ScoringWeights {
  L0: number; // Population density
  L1: number; // Competition density
  L2: number; // Foot traffic
  L3: number; // Income level
  L4: number; // Real estate availability
  L5: number; // Zoning compliance
  L6: number; // Accessibility
  L7: number; // Local market trends
}

export interface CompetitorThresholds {
  low: number;
  high: number;
}

export interface Labels {
  competitorNoun: string; // singular (e.g., "cafe")
  competitorPlural: string; // plural (e.g., "cafes")
  unitNoun: string; // unit of consumption (e.g., "drink")
}

export interface CategoryConfig {
  id: string;
  label: string;
  icon: string;
  description: string;
  dayparts: Daypart[];
  sizeTiers: SizeTier[];
  financialDefaults: FinancialDefaults;
  osmTags: OSMTag[];
  formatOptions: FormatOption[];
  regulatoryChecks: RegulatoryCheck[];
  scoringWeights: ScoringWeights;
  competitorThresholds: CompetitorThresholds;
  labels: Labels;
}

// Coffee Category Configuration
const COFFEE_CONFIG: CategoryConfig = {
  id: "specialty_coffee",
  label: "Coffee",
  icon: "☕",
  description: "Coffee shops and cafes serving specialty beverages",
  dayparts: [
    { name: "Morning Rush", startHour: 6, endHour: 10, revenueShare: 45 },
    { name: "Late Morning", startHour: 10, endHour: 12, revenueShare: 20 },
    { name: "Lunch", startHour: 12, endHour: 14, revenueShare: 15 },
    { name: "Afternoon", startHour: 14, endHour: 17, revenueShare: 12 },
    { name: "Evening", startHour: 17, endHour: 20, revenueShare: 8 },
  ],
  sizeTiers: [
    { id: "kiosk", label: "Kiosk", sqftMin: 50, sqftMax: 150, typicalRent: 8000, typicalBuildout: 25000 },
    { id: "compact", label: "Compact", sqftMin: 200, sqftMax: 400, typicalRent: 18000, typicalBuildout: 60000 },
    { id: "small", label: "Small", sqftMin: 400, sqftMax: 800, typicalRent: 32000, typicalBuildout: 120000 },
    { id: "standard", label: "Standard", sqftMin: 800, sqftMax: 1500, typicalRent: 60000, typicalBuildout: 200000 },
    { id: "large", label: "Large", sqftMin: 1500, sqftMax: 3000, typicalRent: 120000, typicalBuildout: 400000 },
    { id: "flagship", label: "Flagship", sqftMin: 3000, sqftMax: 10000, typicalRent: 240000, typicalBuildout: 800000 },
  ],
  financialDefaults: {
    avgTicket: 8.75,
    dailyTransactions: 250,
    cogsPercent: 28,
    laborPercent: 32,
    rentPercent: 12,
    targetMargin: 15,
  },
  osmTags: [
    { key: "amenity", value: "cafe" },
    { key: "cuisine", value: "coffee" },
    { key: "shop", value: "coffee" },
  ],
  formatOptions: [
    { id: "kiosk", label: "Kiosk" },
    { id: "cafe", label: "Cafe" },
    { id: "fast-casual", label: "Fast Casual" },
    { id: "full-service", label: "Full Service" },
    { id: "ghost-kitchen", label: "Ghost Kitchen" },
    { id: "food-truck", label: "Food Truck" },
  ],
  regulatoryChecks: [
    { id: "food-permit", label: "Food Service Permit", description: "Required for any food/beverage service" },
    { id: "health-dept", label: "Health Department Approval", description: "Facility inspection and compliance" },
    { id: "liquor-license", label: "Liquor License", description: "If serving alcohol" },
    { id: "plumbing", label: "Plumbing Code Compliance", description: "Water, waste systems compliance" },
    { id: "ventilation", label: "Commercial Ventilation", description: "Hood system and air quality requirements" },
    { id: "accessibility", label: "ADA Accessibility", description: "Wheelchair access and facilities" },
  ],
  scoringWeights: {
    L0: 10,
    L1: 15,
    L2: 18,
    L3: 18,
    L4: 10,
    L5: 10,
    L6: 7,
    L7: 12,
  },
  competitorThresholds: {
    low: 3,
    high: 12,
  },
  labels: {
    competitorNoun: "cafe",
    competitorPlural: "cafes",
    unitNoun: "drink",
  },
};

// Bakery Category Configuration
const BAKERY_CONFIG: CategoryConfig = {
  id: "bakery",
  label: "Bakery",
  icon: "🥐",
  description: "Bakeries producing and selling baked goods",
  dayparts: [
    { name: "Pre-Dawn Wholesale", startHour: 4, endHour: 7, revenueShare: 20 },
    { name: "Morning", startHour: 7, endHour: 11, revenueShare: 35 },
    { name: "Lunch", startHour: 11, endHour: 14, revenueShare: 25 },
    { name: "Afternoon", startHour: 14, endHour: 17, revenueShare: 15 },
    { name: "Evening", startHour: 17, endHour: 20, revenueShare: 5 },
  ],
  sizeTiers: [
    { id: "micro", label: "Micro", sqftMin: 200, sqftMax: 500, typicalRent: 15000, typicalBuildout: 80000 },
    { id: "small", label: "Small", sqftMin: 500, sqftMax: 1000, typicalRent: 30000, typicalBuildout: 160000 },
    { id: "standard", label: "Standard", sqftMin: 1000, sqftMax: 2000, typicalRent: 60000, typicalBuildout: 300000 },
    { id: "large-production", label: "Large Production", sqftMin: 2000, sqftMax: 4000, typicalRent: 120000, typicalBuildout: 600000 },
  ],
  financialDefaults: {
    avgTicket: 12.5,
    dailyTransactions: 150,
    cogsPercent: 32,
    laborPercent: 28,
    rentPercent: 10,
    targetMargin: 18,
  },
  osmTags: [
    { key: "shop", value: "bakery" },
    { key: "craft", value: "bakery" },
    { key: "amenity", value: "cafe" },
  ],
  formatOptions: [
    { id: "retail-only", label: "Retail Only" },
    { id: "wholesale", label: "Wholesale Only" },
    { id: "retail-wholesale", label: "Retail + Wholesale" },
    { id: "cafe-bakery", label: "Cafe + Bakery" },
  ],
  regulatoryChecks: [
    { id: "food-permit", label: "Food Service Permit", description: "Required for food production and sales" },
    { id: "health-dept", label: "Health Department Approval", description: "Commercial kitchen inspection" },
    { id: "production-license", label: "Production License", description: "For wholesale/batch operations" },
    { id: "allergen-labeling", label: "Allergen Labeling Compliance", description: "Requirement for packaged goods" },
    { id: "flour-dust", label: "Dust Control Systems", description: "Fire safety for flour/grain handling" },
    { id: "commercial-kitchen", label: "Commercial Kitchen Standards", description: "Equipment and layout compliance" },
  ],
  scoringWeights: {
    L0: 8,
    L1: 12,
    L2: 20,
    L3: 20,
    L4: 12,
    L5: 10,
    L6: 8,
    L7: 10,
  },
  competitorThresholds: {
    low: 2,
    high: 8,
  },
  labels: {
    competitorNoun: "bakery",
    competitorPlural: "bakeries",
    unitNoun: "pastry",
  },
};

// Fast Casual Category Configuration
const FAST_CASUAL_CONFIG: CategoryConfig = {
  id: "fast_casual",
  label: "Fast Casual",
  icon: "🍲",
  description: "Fast casual dining with quick service and quality ingredients",
  dayparts: [
    { name: "Lunch", startHour: 11, endHour: 14, revenueShare: 45 },
    { name: "Afternoon", startHour: 14, endHour: 17, revenueShare: 15 },
    { name: "Dinner", startHour: 17, endHour: 21, revenueShare: 35 },
    { name: "Late Night", startHour: 21, endHour: 23, revenueShare: 5 },
  ],
  sizeTiers: [
    { id: "small", label: "Small", sqftMin: 600, sqftMax: 1000, typicalRent: 36000, typicalBuildout: 150000 },
    { id: "standard", label: "Standard", sqftMin: 1000, sqftMax: 1800, typicalRent: 72000, typicalBuildout: 280000 },
    { id: "large", label: "Large", sqftMin: 1800, sqftMax: 3000, typicalRent: 144000, typicalBuildout: 500000 },
  ],
  financialDefaults: {
    avgTicket: 14.0,
    dailyTransactions: 200,
    cogsPercent: 30,
    laborPercent: 30,
    rentPercent: 10,
    targetMargin: 20,
  },
  osmTags: [
    { key: "amenity", value: "fast_food" },
    { key: "amenity", value: "restaurant" },
  ],
  formatOptions: [
    { id: "counter-service", label: "Counter Service" },
    { id: "fast-casual", label: "Fast Casual" },
    { id: "ghost-kitchen", label: "Ghost Kitchen" },
    { id: "food-hall", label: "Food Hall" },
  ],
  regulatoryChecks: [
    { id: "food-permit", label: "Food Service Permit", description: "Required for food preparation and service" },
    { id: "health-dept", label: "Health Department Approval", description: "Commercial kitchen and dining area inspection" },
    { id: "liquor-license", label: "Liquor License", description: "If serving alcohol" },
    { id: "fire-safety", label: "Fire Safety Compliance", description: "Sprinklers, exits, and safety equipment" },
    { id: "ventilation", label: "Commercial Ventilation", description: "Cooking hood system compliance" },
    { id: "seating-capacity", label: "Occupancy Limits", description: "Fire code capacity restrictions" },
  ],
  scoringWeights: {
    L0: 10,
    L1: 14,
    L2: 20,
    L3: 22,
    L4: 10,
    L5: 8,
    L6: 6,
    L7: 10,
  },
  competitorThresholds: {
    low: 4,
    high: 15,
  },
  labels: {
    competitorNoun: "restaurant",
    competitorPlural: "restaurants",
    unitNoun: "meal",
  },
};

// Registry of all category configurations
const CATEGORY_CONFIGS: Record<ValidBusinessType | string, CategoryConfig> = {
  specialty_coffee: COFFEE_CONFIG,
  bakery: BAKERY_CONFIG,
  "fast_casual": FAST_CASUAL_CONFIG,
};

/**
 * Retrieves a category configuration by ID
 * @param id - The category ID (must map to a valid ValidBusinessType)
 * @returns The CategoryConfig object, or undefined if not found
 */
export function getCategoryConfig(id: ValidBusinessType): CategoryConfig | undefined {
  return CATEGORY_CONFIGS[id.toLowerCase()];
}

/**
 * Retrieves a list of all available categories with basic info
 * @returns Array of category summaries with id, label, and icon
 */
export function getCategoryList(): Array<{ id: string; label: string; icon: string }> {
  return Object.values(CATEGORY_CONFIGS).map((config) => ({
    id: config.id,
    label: config.label,
    icon: config.icon,
  }));
}

/**
 * Validates a category configuration for data integrity
 * @param config - The CategoryConfig to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateCategoryConfig(config: CategoryConfig): string[] {
  const errors: string[] = [];

  // Check daypart revenue shares sum to 100
  const daypartTotal = config.dayparts.reduce((sum, dp) => sum + dp.revenueShare, 0);
  if (Math.abs(daypartTotal - 100) > 0.01) {
    errors.push(`Daypart revenue shares must sum to 100, got ${daypartTotal}`);
  }

  // Check scoring weights sum to 100
  const weightsTotal = Object.values(config.scoringWeights).reduce((sum, w) => sum + w, 0);
  if (Math.abs(weightsTotal - 100) > 0.01) {
    errors.push(`Scoring weights must sum to 100, got ${weightsTotal}`);
  }

  // Check financial percentages are reasonable
  const financialTotal = config.financialDefaults.cogsPercent + config.financialDefaults.laborPercent + config.financialDefaults.rentPercent;
  if (financialTotal > 100) {
    errors.push(`COGS + Labor + Rent cannot exceed 100%, got ${financialTotal}%`);
  }

  // Check size tiers are in order
  for (let i = 1; i < config.sizeTiers.length; i++) {
    const prev = config.sizeTiers[i - 1];
    const curr = config.sizeTiers[i];
    if (curr.sqftMin < prev.sqftMax) {
      errors.push(`Size tier "${curr.label}" min sqft should be >= previous tier max`);
    }
  }

  return errors;
}

// Validate all configs on module load
const validationErrors = Object.entries(CATEGORY_CONFIGS).flatMap(([id, config]) => {
  const errors = validateCategoryConfig(config);
  return errors.map((err) => `${id}: ${err}`);
});

if (validationErrors.length > 0) {
  console.warn("Category configuration validation warnings:", validationErrors);
}
