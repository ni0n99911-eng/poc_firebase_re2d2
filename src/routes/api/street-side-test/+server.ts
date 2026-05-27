/**
 * Street-Side Intelligence Test Endpoint
 *
 * GET /api/street-side-test?lat=40.7567&lng=-73.9900&address=450+9th+Ave&type=cafe
 *
 * Returns the street-side analysis for a given address without running
 * the full 20-source intel pipeline.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { computeStreetSideIntel } from '$lib/intel/street-side';
import { streetSideModifier, getConceptSensitivity } from '$lib/intel/street-side-scoring';

export const GET: RequestHandler = async ({ url }) => {
	const lat = parseFloat(url.searchParams.get('lat') || '0');
	const lng = parseFloat(url.searchParams.get('lng') || '0');
	const address = url.searchParams.get('address') || '';
	const type = url.searchParams.get('type') || 'cafe';

	if (!lat || !lng || !address) {
		return json({ error: 'Missing lat, lng, or address' }, { status: 400 });
	}

	try {
		const streetSide = await computeStreetSideIntel(lat, lng, address);
		const modifier = streetSideModifier(streetSide, type);
		const sensitivity = getConceptSensitivity(type);

		return json({
			streetSide,
			modifier,
			sensitivity,
			conceptType: type,
			summary: `${address}: ${streetSide.streetType} (${streetSide.addressSide === 'A' ? streetSide.sideALabel : streetSide.sideBLabel}). ` +
				`Street-side score: ${streetSide.streetSideScore}/100. ` +
				`Modifier for ${type}: ${modifier.modifier}x. ` +
				modifier.explanation
		});
	} catch (err) {
		return json({
			error: err instanceof Error ? err.message : 'Unknown error',
			stack: err instanceof Error ? err.stack : undefined
		}, { status: 500 });
	}
};
