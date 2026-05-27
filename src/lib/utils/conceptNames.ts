/**
 * Concept name formatter — maps raw scoring slugs to human-readable labels.
 * Use formatConcept() everywhere a concept slug is displayed in the UI.
 */

const CONCEPT_LABELS: Record<string, string> = {
	specialty_coffee: 'Specialty Coffee',
	coffee_shop: 'Coffee Shop',
	coffee: 'Coffee',
	cafe: 'Café',
	bakery: 'Bakery',
	fast_casual: 'Fast Casual',
	full_service_restaurant: 'Full-Service Restaurant',
	restaurant: 'Restaurant',
	qsr: 'Quick-Service Restaurant',
	bar_nightlife: 'Bar / Nightlife',
	bar: 'Bar',
	juice_bar: 'Juice Bar',
	wellness_beverage: 'Wellness Beverage',
	retail: 'Retail',
	fitness_studio: 'Fitness Studio',
	personal_services: 'Personal Services',
	medical_office: 'Medical Office',
	florist: 'Florist',
	boutique: 'Boutique',
	salon: 'Salon',
	spa: 'Spa',
	something_else: 'Other',
};

/** Converts a concept slug like `full_service_restaurant` → "Full-Service Restaurant" */
export function formatConcept(slug: string | undefined | null): string {
	if (!slug) return '';
	return CONCEPT_LABELS[slug] ?? slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Returns "For [Concept]" subtitle, e.g. "For Full-Service Restaurant" */
export function conceptSubtitle(slug: string | undefined | null): string {
	const label = formatConcept(slug);
	return label ? `For ${label}` : '';
}

/** Pricing label per concept — for competitor cards */
export function conceptPriceLabel(slug: string | undefined | null): string {
	const map: Record<string, string> = {
		specialty_coffee: 'Avg coffee price',
		coffee_shop: 'Avg coffee price',
		coffee: 'Avg coffee price',
		cafe: 'Avg coffee price',
		bakery: 'Avg item price',
		fast_casual: 'Avg plate price',
		full_service_restaurant: 'Avg plate price',
		restaurant: 'Avg plate price',
		qsr: 'Avg item price',
		bar_nightlife: 'Avg drink price',
		bar: 'Avg drink price',
		juice_bar: 'Avg item price',
		wellness_beverage: 'Avg item price',
		retail: 'Avg item price',
		fitness_studio: 'Monthly membership',
	};
	return map[slug ?? ''] ?? 'Avg price';
}
