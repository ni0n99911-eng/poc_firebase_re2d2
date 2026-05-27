// ──────────────────────────────────────────────
// Space Einstein — Buildout Cost Matrix
// NYC-specific averages as of 2026
// ──────────────────────────────────────────────

export type BusinessCategory = 'cafe' | 'restaurant' | 'retail' | 'fitness';

export interface CostCategory {
	label: string;
	key: string;
	/** Cost per sqft by business category */
	perSqFt: Record<BusinessCategory, number>;
}

/** Base cost per square foot by category and business type */
export const BUILDOUT_CATEGORIES: CostCategory[] = [
	{ label: 'Demolition & Cleanup', key: 'demolition', perSqFt: { cafe: 8, restaurant: 12, retail: 5, fitness: 8 } },
	{ label: 'Plumbing (incl grease trap)', key: 'plumbing', perSqFt: { cafe: 25, restaurant: 40, retail: 5, fitness: 15 } },
	{ label: 'Electrical & Lighting', key: 'electrical', perSqFt: { cafe: 20, restaurant: 25, retail: 15, fitness: 20 } },
	{ label: 'HVAC', key: 'hvac', perSqFt: { cafe: 18, restaurant: 22, retail: 12, fitness: 25 } },
	{ label: 'Fire Suppression', key: 'fire', perSqFt: { cafe: 8, restaurant: 10, retail: 6, fitness: 8 } },
	{ label: 'Permits & Expediting', key: 'permits', perSqFt: { cafe: 12, restaurant: 15, retail: 8, fitness: 10 } },
	{ label: 'Flooring & Walls', key: 'flooring', perSqFt: { cafe: 15, restaurant: 18, retail: 12, fitness: 10 } },
	{ label: 'Furniture & Fixtures', key: 'furniture', perSqFt: { cafe: 20, restaurant: 15, retail: 25, fitness: 30 } },
	{ label: 'Signage (Exterior + Interior)', key: 'signage', perSqFt: { cafe: 5, restaurant: 5, retail: 8, fitness: 5 } },
];

/** Neighborhood cost multipliers */
export const NEIGHBORHOOD_MULTIPLIERS: Record<string, { multiplier: number; tier: string }> = {
	// Premium
	'SoHo': { multiplier: 1.25, tier: 'Premium' },
	'Tribeca': { multiplier: 1.25, tier: 'Premium' },
	'West Village': { multiplier: 1.25, tier: 'Premium' },
	'Flatiron': { multiplier: 1.25, tier: 'Premium' },
	'Greenwich Village': { multiplier: 1.25, tier: 'Premium' },
	'NoHo': { multiplier: 1.25, tier: 'Premium' },
	// Standard
	'Chelsea': { multiplier: 1.0, tier: 'Standard' },
	'East Village': { multiplier: 1.0, tier: 'Standard' },
	'Upper West Side': { multiplier: 1.0, tier: 'Standard' },
	'Upper East Side': { multiplier: 1.0, tier: 'Standard' },
	'Gramercy': { multiplier: 1.0, tier: 'Standard' },
	'Midtown': { multiplier: 1.0, tier: 'Standard' },
	'Nolita': { multiplier: 1.0, tier: 'Standard' },
	// Value
	'Lower East Side': { multiplier: 0.85, tier: 'Value' },
	'Harlem': { multiplier: 0.85, tier: 'Value' },
	"Hell's Kitchen": { multiplier: 0.85, tier: 'Value' },
	'Murray Hill': { multiplier: 0.85, tier: 'Value' },
	'Financial District': { multiplier: 0.85, tier: 'Value' },
	'Chinatown': { multiplier: 0.85, tier: 'Value' },
	// Outer Borough
	'Williamsburg': { multiplier: 0.90, tier: 'Outer Borough' },
	'DUMBO': { multiplier: 0.90, tier: 'Outer Borough' },
	'Park Slope': { multiplier: 0.90, tier: 'Outer Borough' },
	'Bushwick': { multiplier: 0.90, tier: 'Outer Borough' },
	'Astoria': { multiplier: 0.90, tier: 'Outer Borough' },
	'Long Island City': { multiplier: 0.90, tier: 'Outer Borough' },
};

/** Condition adjustment multipliers */
export const CONDITION_MULTIPLIERS: Record<string, { multiplier: number; description: string }> = {
	'raw': { multiplier: 1.0, description: 'Full buildout required from bare walls' },
	'partial_other': { multiplier: 0.85, description: 'Some infrastructure exists but needs conversion' },
	'partial_same': { multiplier: 0.60, description: 'Prior tenant was similar business; plumbing/electric mostly usable' },
	'turnkey': { multiplier: 0.25, description: 'Previous cafe/restaurant; minimal work needed' },
};

/** Grease trap cost ranges by space size */
export function getGreaseTrapCost(sqft: number, previousTenantType: string | null): { status: string; low: number; high: number } {
	const foodTypes = ['restaurant', 'cafe', 'bakery', 'deli', 'food', 'kitchen', 'pizzeria', 'bar', 'diner'];
	const hasFoodHistory = previousTenantType && foodTypes.some(t => previousTenantType.toLowerCase().includes(t));

	if (hasFoodHistory) {
		return { status: 'Likely exists', low: 0, high: 0 };
	}

	// Installation cost scales with space size
	if (sqft < 800) return { status: 'Required — installation needed', low: 15000, high: 25000 };
	if (sqft < 1500) return { status: 'Required — installation needed', low: 20000, high: 35000 };
	return { status: 'Required — installation needed', low: 25000, high: 40000 };
}

/** Contingency percentage */
export const CONTINGENCY_RATE = 0.15;

/** Get neighborhood multiplier, defaulting to 1.0 for unknown neighborhoods */
export function getNeighborhoodMultiplier(neighborhood: string): { multiplier: number; tier: string } {
	// Try exact match first
	if (NEIGHBORHOOD_MULTIPLIERS[neighborhood]) {
		return NEIGHBORHOOD_MULTIPLIERS[neighborhood];
	}
	// Try case-insensitive partial match
	const lower = neighborhood.toLowerCase();
	for (const [name, data] of Object.entries(NEIGHBORHOOD_MULTIPLIERS)) {
		if (lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)) {
			return data;
		}
	}
	return { multiplier: 1.0, tier: 'Standard' };
}
