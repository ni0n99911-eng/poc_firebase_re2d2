/**
 * Geocode Bridge — Thread 6B, Gap #1 (BLOCKER)
 *
 * Converts addresses to block group GEOIDs via a two-step process:
 *   1. Address → lat/lng (Census Geocoder or Google fallback)
 *   2. lat/lng → 12-digit FIPS GEOID (FCC Census Block API)
 *
 * Also supports direct lat/lng → GEOID (reuses existing latLngToGeoid pattern).
 *
 * The GEOID is the key that unlocks all block-group-level data:
 * block_group_scores, block_group_intel, enriched_entities, block_group_visions.
 */

// ── Types ──

export interface AddressCandidate {
	address: string;         // Full formatted address
	borough: string;         // Detected NYC borough
	confidence: string;      // 'exact' | 'interpolated' | 'approximate'
}

export interface GeocodeResult {
	geoid: string;           // 12-digit FIPS (state + county + tract + block group)
	lat: number;
	lng: number;
	borough: string;
	matchedAddress: string;  // The address the geocoder resolved to
	confidence: 'exact' | 'approximate' | 'interpolated' | 'fallback';
	source: 'census' | 'google' | 'fcc_direct';
	// L2: ambiguity fields — populated when multiple NYC boroughs match the input
	ambiguous?: boolean;
	candidates?: AddressCandidate[];
}

// ── In-memory caches ──

const ADDRESS_CACHE: Record<string, GeocodeResult | null> = {};
const FIPS_CACHE: Record<string, string | null> = {};
const MAX_CACHE_SIZE = 500;

function pruneCache(cache: Record<string, any>) {
	const keys = Object.keys(cache);
	if (keys.length > MAX_CACHE_SIZE) {
		for (let i = 0; i < 100; i++) delete cache[keys[i]];
	}
}

// ── Borough mapping (NYC county FIPS → borough name) ──

const COUNTY_TO_BOROUGH: Record<string, string> = {
	'061': 'Manhattan',
	'005': 'Bronx',
	'047': 'Brooklyn',
	'081': 'Queens',
	'085': 'Staten Island',
};

function geoidToBorough(geoid: string): string {
	if (geoid.length >= 5) {
		const county = geoid.substring(2, 5);
		return COUNTY_TO_BOROUGH[county] || 'NYC';
	}
	return 'NYC';
}

// ── Step 1: Address → lat/lng ──

/**
 * Geocode an address to lat/lng using the US Census Geocoder.
 * Free, no API key, handles NYC addresses well.
 * Returns null if the address can't be resolved.
 */
async function censusGeocode(address: string): Promise<{
	lat: number; lng: number; matchedAddress: string; confidence: GeocodeResult['confidence'];
} | null> {
	try {
		const encoded = encodeURIComponent(address);
		const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encoded}&benchmark=Public_AR_Current&format=json`;

		const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
		if (!res.ok) {
			console.warn(`[Geocode] Census API ${res.status}`);
			return null;
		}

		const data = await res.json();
		const matches = data?.result?.addressMatches;

		if (!matches || matches.length === 0) return null;

		const best = matches[0];
		const coords = best.coordinates;
		if (!coords?.x || !coords?.y) return null;

		return {
			lat: coords.y,
			lng: coords.x,
			matchedAddress: best.matchedAddress || address,
			confidence: best.tigerLine?.side ? 'exact' : 'interpolated',
		};
	} catch (err) {
		console.warn('[Geocode] Census geocoder error:', err instanceof Error ? err.message : err);
		return null;
	}
}

/**
 * Fallback: Google Geocoding API.
 * Only used if Census Geocoder fails. Costs ~$5/1K requests.
 * Requires GOOGLE_PLACES_API_KEY env var.
 */
async function googleGeocode(address: string): Promise<{
	lat: number; lng: number; matchedAddress: string; confidence: GeocodeResult['confidence'];
} | null> {
	const apiKey = process.env.GOOGLE_PLACES_API_KEY || (import.meta as any).env?.GOOGLE_PLACES_API_KEY;
	if (!apiKey) return null; // No key = skip silently

	try {
		const encoded = encodeURIComponent(address);
		const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&components=administrative_area:NY|country:US&key=${apiKey}`;

		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return null;

		const data = await res.json();
		if (data.status !== 'OK' || !data.results?.length) return null;

		const best = data.results[0];
		const loc = best.geometry?.location;
		if (!loc?.lat || !loc?.lng) return null;

		const locationType = best.geometry?.location_type;
		const confidence: GeocodeResult['confidence'] =
			locationType === 'ROOFTOP' ? 'exact' :
			locationType === 'RANGE_INTERPOLATED' ? 'interpolated' :
			'approximate';

		return {
			lat: loc.lat,
			lng: loc.lng,
			matchedAddress: best.formatted_address || address,
			confidence,
		};
	} catch {
		return null;
	}
}

/**
 * L2: Return ALL Google Geocoder results for an address (up to 5).
 * Used to detect multi-borough ambiguity — e.g. "101 Broadway" exists
 * in both Manhattan and Brooklyn. Only called when we need to surface
 * disambiguation options to the user.
 */
async function googleGeocodeAll(address: string): Promise<Array<{
	lat: number; lng: number; formattedAddress: string; confidence: string;
}>> {
	const apiKey = process.env.GOOGLE_PLACES_API_KEY || (import.meta as any).env?.GOOGLE_PLACES_API_KEY;
	if (!apiKey) return [];

	try {
		const encoded = encodeURIComponent(address + ', New York, NY');
		const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&components=administrative_area:NY|country:US&key=${apiKey}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return [];

		const data = await res.json();
		if (data.status !== 'OK' || !data.results?.length) return [];

		return (data.results as any[]).slice(0, 5).map((r: any) => ({
			lat: r.geometry?.location?.lat,
			lng: r.geometry?.location?.lng,
			formattedAddress: r.formatted_address || address,
			confidence:
				r.geometry?.location_type === 'ROOFTOP' ? 'exact' :
				r.geometry?.location_type === 'RANGE_INTERPOLATED' ? 'interpolated' :
				'approximate',
		})).filter(r => r.lat && r.lng);
	} catch {
		return [];
	}
}

// ── Step 2: lat/lng → GEOID ──

/**
 * Convert lat/lng to Census Block Group GEOID via FCC Census Block API.
 * Returns a 12-digit GEOID (state + county + tract + block group).
 * This is the same approach as block-group.ts latLngToGeoid() but with
 * a shared cache that persists across geocode-bridge calls.
 */
async function latLngToGeoid(lat: number, lng: number): Promise<string | null> {
	const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
	if (cacheKey in FIPS_CACHE) return FIPS_CACHE[cacheKey];

	try {
		const url = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&censusYear=2020&format=json`;
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

		if (!res.ok) {
			console.warn(`[Geocode] FCC API ${res.status}`);
			FIPS_CACHE[cacheKey] = null;
			return null;
		}

		const data = await res.json();
		const fips = data?.Block?.FIPS;

		if (!fips || fips.length < 12) {
			FIPS_CACHE[cacheKey] = null;
			return null;
		}

		// FIPS is 15 digits (block level). Trim to 12 for block group.
		const geoid = fips.substring(0, 12);

		pruneCache(FIPS_CACHE);
		FIPS_CACHE[cacheKey] = geoid;
		return geoid;
	} catch (err) {
		console.warn('[Geocode] FIPS lookup error:', err instanceof Error ? err.message : err);
		FIPS_CACHE[cacheKey] = null;
		return null;
	}
}

// ── NYC Bounds Check ──

function isInNYC(lat: number, lng: number): boolean {
	// Rough bounding box for NYC (generous margins)
	return lat >= 40.48 && lat <= 40.93 && lng >= -74.27 && lng <= -73.68;
}

// ── Main Entry Points ──

/**
 * Geocode a street address to a block group GEOID.
 * Two-step: address → lat/lng → FIPS GEOID.
 *
 * Used by RE2D2 when the user enters an address in step 5.
 */
export async function addressToGeoid(address: string): Promise<GeocodeResult | null> {
	if (!address || address.trim().length < 5) return null;

	const normalizedAddr = address.trim().toLowerCase();
	if (normalizedAddr in ADDRESS_CACHE) return ADDRESS_CACHE[normalizedAddr];

	// Step 1: Address → lat/lng
	// Try Census Geocoder first (free), fall back to Google
	let geocoded = await censusGeocode(address);
	let source: GeocodeResult['source'] = 'census';

	if (!geocoded) {
		geocoded = await googleGeocode(address);
		source = 'google';
	}

	if (!geocoded) {
		ADDRESS_CACHE[normalizedAddr] = null;
		return null;
	}

	// Sanity check: is this in NYC?
	if (!isInNYC(geocoded.lat, geocoded.lng)) {
		console.warn(`[Geocode] Address resolved outside NYC: ${geocoded.lat}, ${geocoded.lng}`);
		// Still proceed — the block group lookup will fail gracefully if it's truly out of range
	}

	// Step 2: lat/lng → GEOID
	const geoid = await latLngToGeoid(geocoded.lat, geocoded.lng);
	if (!geoid) {
		ADDRESS_CACHE[normalizedAddr] = null;
		return null;
	}

	const result: GeocodeResult = {
		geoid,
		lat: geocoded.lat,
		lng: geocoded.lng,
		borough: geoidToBorough(geoid),
		matchedAddress: geocoded.matchedAddress,
		confidence: geocoded.confidence,
		source,
	};

	pruneCache(ADDRESS_CACHE);
	ADDRESS_CACHE[normalizedAddr] = result;
	return result;
}

/**
 * L2: addressToGeoid with ambiguity detection.
 *
 * Resolves an address to a GEOID exactly like addressToGeoid(), but also
 * checks whether multiple distinct NYC boroughs match the same street name.
 * When ambiguity is detected, populates result.ambiguous + result.candidates
 * so the caller can surface a disambiguation prompt to the user.
 *
 * Example: "101 Broadway" → ambiguous: true, candidates: [
 *   { address: "101 Broadway, New York, NY 10006", borough: "Manhattan", confidence: "exact" },
 *   { address: "101 Broadway, Brooklyn, NY 11249", borough: "Brooklyn", confidence: "exact" }
 * ]
 *
 * Falls back to plain addressToGeoid() if Google key is absent.
 */
export async function addressToGeoidWithCandidates(address: string): Promise<GeocodeResult | null> {
	// First resolve the primary address normally
	const primary = await addressToGeoid(address);
	if (!primary) return null;

	// Check for ambiguity using all Google results
	const allResults = await googleGeocodeAll(address);
	if (allResults.length < 2) return primary; // Only one result — no ambiguity

	// Map each result to a borough
	const NYC_BOROUGH_TERMS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
	const candidates: AddressCandidate[] = allResults
		.map(r => {
			const borough = NYC_BOROUGH_TERMS.find(b =>
				r.formattedAddress.includes(b) ||
				(b === 'Bronx' && r.formattedAddress.includes('The Bronx'))
			) || 'NYC';
			return { address: r.formattedAddress, borough, confidence: r.confidence };
		})
		.filter(c => c.borough !== 'NYC'); // Only show results with identifiable boroughs

	// Distinct boroughs
	const distinctBoroughs = [...new Set(candidates.map(c => c.borough))];
	if (distinctBoroughs.length <= 1) return primary; // All same borough — not ambiguous

	// Deduplicate candidates (same address, different formats) keeping one per borough
	const seen = new Set<string>();
	const dedupedCandidates = candidates.filter(c => {
		if (seen.has(c.borough)) return false;
		seen.add(c.borough);
		return true;
	});

	return {
		...primary,
		ambiguous: true,
		candidates: dedupedCandidates,
	};
}

/**
 * Resolve lat/lng directly to a GEOID.
 * Used when the user drops a pin or we already have coordinates.
 */
export async function coordsToGeoid(lat: number, lng: number): Promise<GeocodeResult | null> {
	const geoid = await latLngToGeoid(lat, lng);
	if (!geoid) return null;

	return {
		geoid,
		lat,
		lng,
		borough: geoidToBorough(geoid),
		matchedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
		confidence: 'exact',
		source: 'fcc_direct',
	};
}

/**
 * Smart resolver: accepts an address string, a lat/lng pair, or a raw geoid.
 * Returns a GeocodeResult with the GEOID regardless of input format.
 *
 * This is the main function RE2D2 and copilots should call.
 */
export async function resolveLocation(input: {
	address?: string;
	lat?: number;
	lng?: number;
	geoid?: string;
}): Promise<GeocodeResult | null> {
	// If we already have a geoid, just resolve the borough
	if (input.geoid && input.geoid.length >= 12) {
		return {
			geoid: input.geoid,
			lat: input.lat || 0,
			lng: input.lng || 0,
			borough: geoidToBorough(input.geoid),
			matchedAddress: input.address || input.geoid,
			confidence: 'exact',
			source: 'fcc_direct',
		};
	}

	// If we have coordinates, go direct
	if (input.lat && input.lng) {
		return coordsToGeoid(input.lat, input.lng);
	}

	// If we have an address, geocode it
	if (input.address) {
		return addressToGeoid(input.address);
	}

	return null;
}

// ── API Endpoint Handler ──
// This can be wired as GET /api/geocode?address=...&lat=...&lng=...

import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/auth-middleware';

export const GET: RequestHandler = async ({ url, request }) => {
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;

	const address = url.searchParams.get('address');
	const lat = parseFloat(url.searchParams.get('lat') || '');
	const lng = parseFloat(url.searchParams.get('lng') || '');
	const geoid = url.searchParams.get('geoid');

	if (!address && isNaN(lat) && !geoid) {
		return new Response(JSON.stringify({
			error: 'Provide address, lat+lng, or geoid',
			usage: '/api/geocode?address=123+Main+St+Brooklyn+NY',
		}), { status: 400, headers: { 'Content-Type': 'application/json' } });
	}

	try {
		const startMs = Date.now();
		const result = await resolveLocation({ address: address || undefined, lat: isNaN(lat) ? undefined : lat, lng: isNaN(lng) ? undefined : lng, geoid: geoid || undefined });

		if (!result) {
			return new Response(JSON.stringify({
				error: 'Could not resolve location to a NYC block group',
				hint: address
					? 'Check the address format. Include city and state (e.g., "123 Main St, Brooklyn, NY")'
					: 'The coordinates may be outside NYC',
			}), { status: 404, headers: { 'Content-Type': 'application/json' } });
		}

		return new Response(JSON.stringify({
			...result,
			_meta: { durationMs: Date.now() - startMs },
		}), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'private, max-age=3600', // 1 hour — addresses don't change
			},
		});
	} catch (err) {
		console.error('[Geocode] Error:', err);
		return new Response(JSON.stringify({
			error: 'Geocoding failed',
			message: err instanceof Error ? err.message : 'Unknown error',
		}), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
};
