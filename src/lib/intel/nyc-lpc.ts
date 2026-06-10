/**
 * NYC Landmarks Preservation Commission (LPC) Integration
 *
 * Fetches landmark and historic district data from NYC Open Data (Socrata API).
 * Free, no API key required.
 * Dataset: https://data.cityofnewyork.us/resource/buis-pvji.json (Individual Landmarks)
 *
 * Provides:
 * - Is the location in/near a historic district?
 * - Landmark buildings nearby and their restrictions
 * - Signage restrictions that apply to the address
 * - Building status (Individual Landmark vs. Historic District vs. None)
 *
 * Critical for real estate: LPC restrictions significantly impact:
 * - Façade changes (exterior modifications require approval)
 * - Signage (size, material, placement are heavily restricted)
 * - Interior alterations (some aspects regulated)
 * - Buildout costs and timeline (LPC review adds 4-8 weeks)
 */

import { IntelCache, intelCache, TTL } from './cache';
// 04.19.2026 13:35 Score Consolidation — haversineDistance removed; imported from canonical geo-math.ts
import { haversineMeters as haversineDistance } from '$lib/intel/scoring/geo-math';

export interface NearbyLandmark {
	name: string;
	type: string;        // 'Individual Landmark', 'Scenic Landmark', etc.
	distance: number;    // meters
	lat?: number;
	lng?: number;
}

export interface LPCData {
	isHistoricDistrict: boolean;
	districtName: string | null;
	nearbyLandmarks: NearbyLandmark[];
	signageRestrictions: boolean;
	buildingStatus: 'Individual Landmark' | 'In Historic District' | 'None';
	restrictions: {
		exteriorAlterations: boolean;
		interiorAlterations: boolean;
		signageRestricted: boolean;
		archaeologicalSite: boolean;
		description: string;
	};
	source: 'nyc-lpc';
	fetchedAt: string;
}

// NYC LPC Dataset (Socrata)
const LPC_BASE = 'https://data.cityofnewyork.us/resource/buis-pvji.json';

/**
 * Fetch LPC data for a location using Socrata's within_circle geospatial query.
 * Returns historic district + landmark status.
 * Cached with 7-day TTL (landmarks don't change frequently).
 */
export async function fetchLPCData(lat: number,
	lng: number,
	radiusMeters: number = 100, signal?: AbortSignal): Promise<LPCData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'lpc');
	const cached = await intelCache.getAsync<LPCData>(cacheKey);

	if (cached?.fresh) {
		return cached.data;
	}

	try {
		// Socrata within_circle(geo_column, lat, lng, radiusMeters) — radius is numeric, no quotes
		const socrataGeoFilter = `within_circle(the_geom, ${lat}, ${lng}, ${radiusMeters})`;

		// Construct SoQL query
		const url = new URL(LPC_BASE);
		url.searchParams.set('$where', socrataGeoFilter);
		url.searchParams.set('$limit', '100');

		const { socrataFetch } = await import('./socrata-fetch');
		const landmarks = await socrataFetch<LPCRawLandmark[]>(url.toString(), 'LPC');
		if (!landmarks) {
			// Return stale cache if available
			if (cached) return cached.data;
			return null;
		}

		// Parse results
		const lpcData = parseLPCResults(lat, lng, landmarks);

		// Cache with 7-day TTL
		intelCache.set(cacheKey, lpcData, TTL.LANDMARKS ?? 7 * 24 * 60 * 60 * 1000);

		return lpcData;
	} catch (error) {
		console.error('LPC fetch error:', error);
		// Return stale cache if available
		if (cached) return cached.data;
		return null;
	}
}

/**
 * Parse NYC LPC Socrata response into LPCData structure
 */
interface LPCRawLandmark {
	landmark_name?: string;
	landmark_status?: string;
	designation_date?: string;
	geometry?: { type: string; coordinates: [number, number] };
	the_geom?: { type: string; coordinates: [number, number] };
	historic_district?: string;
	historic_district_name?: string;
	address?: string;
	bbls?: string;
}

function parseLPCResults(
	queryLat: number,
	queryLng: number,
	landmarks: LPCRawLandmark[]
): LPCData {
	if (!Array.isArray(landmarks)) {
		return createEmptyLPCData();
	}

	const results = landmarks;

	// Check for exact match (building at this address)
	const exactMatch = results.find(r => {
		const coords = r.geometry?.coordinates || r.the_geom?.coordinates;
		if (!coords) return false;
		const [lng, lat] = coords;
		const distance = haversineDistance(queryLat, queryLng, lat, lng);
		return distance < 10; // Within 10m = same building
	});

	const nearbyLandmarks: NearbyLandmark[] = [];
	let isHistoricDistrict = false;
	let districtName: string | null = null;
	let buildingStatus: LPCData['buildingStatus'] = 'None';

	// Collect results
	for (const result of results) {
		const name = result.landmark_name || 'Unknown Landmark';
		const type = result.landmark_status || 'Individual Landmark';
		const coords = result.geometry?.coordinates || result.the_geom?.coordinates;

		if (!coords) continue;

		const [lng, lat] = coords;
		const distance = haversineDistance(queryLat, queryLng, lat, lng);

		if (distance < 100) {
			// Within ~100m
			nearbyLandmarks.push({ name, type, distance, lat, lng });

			// If exact match, set building status
			if (distance < 10) {
				buildingStatus = 'Individual Landmark';
			}
		}

		// Check for historic district
		if (result.historic_district === 'Yes' || result.historic_district_name) {
			isHistoricDistrict = true;
			districtName = result.historic_district_name || 'Unnamed Historic District';
			if (distance < 50) {
				buildingStatus = 'In Historic District';
			}
		}
	}

	// Signage restrictions: apply if in historic district OR exact match with landmark
	const signageRestricted = isHistoricDistrict || buildingStatus === 'Individual Landmark';

	// Build restrictions summary
	const restrictions = {
		exteriorAlterations: buildingStatus !== 'None',
		interiorAlterations: buildingStatus === 'Individual Landmark', // Stricter for individual landmarks
		signageRestricted,
		archaeologicalSite: false, // Would require additional dataset
		description: buildingStatus === 'Individual Landmark'
			? 'Individual landmark status: façade, signage, and many interior changes require LPC approval.'
			: buildingStatus === 'In Historic District'
			? 'Located in historic district: exterior façade and signage are restricted. Many changes require LPC approval.'
			: 'No LPC restrictions apply at this address.'
	};

	return {
		isHistoricDistrict,
		districtName,
		nearbyLandmarks: nearbyLandmarks.slice(0, 10), // Top 10 nearby
		signageRestrictions: signageRestricted,
		buildingStatus,
		restrictions,
		source: 'nyc-lpc',
		fetchedAt: new Date().toISOString()
	};
}

/**
 * Create empty LPCData when no results found
 */
function createEmptyLPCData(): LPCData {
	return {
		isHistoricDistrict: false,
		districtName: null,
		nearbyLandmarks: [],
		signageRestrictions: false,
		buildingStatus: 'None',
		restrictions: {
			exteriorAlterations: false,
			interiorAlterations: false,
			signageRestricted: false,
			archaeologicalSite: false,
			description: 'No LPC restrictions apply at this address.'
		},
		source: 'nyc-lpc',
		fetchedAt: new Date().toISOString()
	};
}

// 04.19.2026 13:35 Score Consolidation — haversineDistance removed. Now aliased from haversineMeters in geo-math.ts above.
