/**
 * GET /api/location-history?address=384+Bedford+Ave&lat=40.71&lng=-73.96
 *
 * Returns business history for a specific address.
 * Uses DOHMH restaurant inspections + DCA business licenses.
 * No new API keys — pure NYC Open Data.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/auth-middleware';
import { fetchLocationHistory } from '$lib/intel/location-history';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';

export const GET: RequestHandler = async ({ url, request }) => {
	const limited = rateLimit(request, RATE_LIMITS.intel);
	if (limited) return limited;

	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;

	const address = url.searchParams.get('address') || '';
	const lat     = parseFloat(url.searchParams.get('lat') || '');
	const lng     = parseFloat(url.searchParams.get('lng') || '');

	if (!address || isNaN(lat) || isNaN(lng)) {
		return json({ error: 'address, lat, and lng are required' }, { status: 400 });
	}

	const history = await fetchLocationHistory(address, lat, lng);
	if (!history) {
		return json({ businesses: [], totalCount: 0, source: 'location-history' });
	}

	return json(history);
};
