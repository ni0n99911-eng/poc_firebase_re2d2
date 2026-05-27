/**
 * Concepts API endpoint.
 *
 * GET /api/concepts
 *
 * Returns the list of valid concept types with display labels.
 * Used by the concept selector dropdown in the UI.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { VALID_CONCEPTS } from '$lib/intel/block-group';

const CONCEPT_LABELS: Record<string, string> = {
	full_service_restaurant: 'Full-Service Restaurant',
	specialty_coffee: 'Specialty Coffee',
	qsr: 'Quick Service (QSR)',
	retail: 'Retail',
	fitness_studio: 'Fitness Studio',
	bar_nightlife: 'Bar / Nightlife',
	personal_services: 'Personal Services',
	medical_office: 'Medical Office',
	wellness_beverage: 'Wellness Beverage',
	juice_bar: 'Juice Bar',
	fast_casual: 'Fast Casual',
	bakery: 'Bakery',
	florist: 'Florist',
};

export const GET: RequestHandler = async () => {
	const concepts = VALID_CONCEPTS.map(value => ({
		value,
		label: CONCEPT_LABELS[value] || value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
	}));

	return new Response(JSON.stringify({
		concepts,
		default: 'full_service_restaurant',
		count: concepts.length,
	}), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=3600', // 1 hour — concepts rarely change
		},
	});
};
