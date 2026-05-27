import type { RequestHandler } from '@sveltejs/kit';
import { SITE_CONFIG } from '$lib/modules';
import { rateLimit, RATE_LIMITS } from '$lib/rate-limit';

export const GET: RequestHandler = async ({ url, request }) => {
	const limited = rateLimit(request, RATE_LIMITS.api);
	if (limited) return limited;
	const type = url.searchParams.get('type');

	if (type === 'overpass') {
		const data = url.searchParams.get('data');
		if (!data) {
			return new Response(JSON.stringify({ error: 'Missing data parameter' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		try {
			const overpassUrl = new URL('https://overpass-api.de/api/interpreter');
			overpassUrl.searchParams.append('data', data);

			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 15000);

			const response = await fetch(overpassUrl.toString(), {
				method: 'GET',
				headers: {
					'User-Agent': `${SITE_CONFIG.domain}/re2-location-iq`
				},
				signal: controller.signal
			});
			clearTimeout(timer);

			if (!response.ok) {
				return new Response(JSON.stringify({ error: 'Overpass API error' }), {
					status: response.status,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			const result = await response.json();
			return new Response(JSON.stringify(result), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
			} catch (error: unknown) {
			const msg = (error instanceof Error && error.name === 'AbortError') ? 'Overpass API timed out (15s)' : 'Failed to fetch from Overpass API';
			return new Response(JSON.stringify({ error: msg }), {
				status: 504,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	} else if (type === 'nominatim') {
		const q = url.searchParams.get('q');
		const format = url.searchParams.get('format') || 'json';
		const limit = url.searchParams.get('limit') || '5';
		const countrycodes = url.searchParams.get('countrycodes') || 'us';
		// Default viewbox covers Manhattan + nearby areas; outer boroughs still work
		// but Manhattan addresses get priority when ambiguous
		const viewbox = url.searchParams.get('viewbox') || '-74.03,40.69,-73.90,40.88';
		const bounded = url.searchParams.get('bounded') || '1';

		if (!q) {
			return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		try {
			const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
			nominatimUrl.searchParams.append('q', q);
			nominatimUrl.searchParams.append('format', format);
			nominatimUrl.searchParams.append('limit', limit);
			nominatimUrl.searchParams.append('viewbox', viewbox);
			nominatimUrl.searchParams.append('bounded', bounded);
			nominatimUrl.searchParams.append('countrycodes', countrycodes);

			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 10000);

			const response = await fetch(nominatimUrl.toString(), {
				method: 'GET',
				headers: {
					'User-Agent': `${SITE_CONFIG.domain}/re2-location-iq`
				},
				signal: controller.signal
			});
			clearTimeout(timer);

			if (!response.ok) {
				return new Response(JSON.stringify({ error: 'Nominatim API error' }), {
					status: response.status,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			const result = await response.json();
			// If bounded search returns no results, retry with NYC-appended query
			if (Array.isArray(result) && result.length === 0 && bounded === '1') {
				const fallbackUrl = new URL('https://nominatim.openstreetmap.org/search');
				// Append "New York, NY" to help disambiguate addresses
				fallbackUrl.searchParams.append('q', q + ', New York, NY');
				fallbackUrl.searchParams.append('format', format);
				fallbackUrl.searchParams.append('limit', limit);
				fallbackUrl.searchParams.append('countrycodes', countrycodes);
				// Use wider NYC bounding box for fallback
				fallbackUrl.searchParams.append('viewbox', '-74.26,40.49,-73.70,40.92');
				fallbackUrl.searchParams.append('bounded', '1');

				const fallbackResponse = await fetch(fallbackUrl.toString(), {
					method: 'GET',
					headers: {
						'User-Agent': `${SITE_CONFIG.domain}/re2-location-iq`
					},
					signal: controller.signal
				});

				if (fallbackResponse.ok) {
					const fallbackResult = await fallbackResponse.json();
					// Filter results to only include those within NYC bounding box
					const nycFiltered = Array.isArray(fallbackResult)
						? fallbackResult.filter((r: { lat: string; lon: string }) => {
							const lat = parseFloat(r.lat);
							const lon = parseFloat(r.lon);
							return lat >= 40.49 && lat <= 40.92 && lon >= -74.26 && lon <= -73.70;
						})
						: fallbackResult;
					return new Response(JSON.stringify(nycFiltered), {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					});
				}
			}

			return new Response(JSON.stringify(result), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			return new Response(JSON.stringify({ error: 'Failed to fetch from Nominatim API' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	return new Response(JSON.stringify({ error: 'Invalid type parameter' }), {
		status: 400,
		headers: { 'Content-Type': 'application/json' }
	});
};
