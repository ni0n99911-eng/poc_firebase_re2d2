/**
 * Vacancy Detection API
 *
 * GET /api/vacancies?lat=40.7128&lng=-74.006&radius=500
 *
 * Returns nearby vacant/likely-vacant storefronts detected from
 * 6 public data sources (ACRIS, DOB, PLUTO, Google Places, DCA, churn model).
 */

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { detectVacancies } from '$lib/intel/vacancy-detection';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';

export const GET: RequestHandler = async ({ url, request }) => {
	const limited = rateLimit(request, RATE_LIMITS.intel);
	if (limited) return limited;

	const lat = parseFloat(url.searchParams.get('lat') || '');
	const lng = parseFloat(url.searchParams.get('lng') || '');
	const radius = parseInt(url.searchParams.get('radius') || '500');

	if (isNaN(lat) || isNaN(lng)) {
		return json({ error: 'lat and lng are required' }, { status: 400 });
	}

	if (radius < 100 || radius > 2000) {
		return json({ error: 'radius must be between 100 and 2000 meters' }, { status: 400 });
	}

	try {
		const result = await detectVacancies(lat, lng, radius);
		return json(result);
	} catch (e) {
		console.error('[API/VACANCIES]', e);
		return json({ error: 'Vacancy detection failed' }, { status: 500 });
	}
};
