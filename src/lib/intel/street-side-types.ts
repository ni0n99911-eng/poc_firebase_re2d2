/**
 * Street-Side Intelligence — Shared Types
 *
 * These types are used by both server-side (street-side.ts)
 * and client-side (street-side-scoring.ts, re2-scores.ts) code.
 * No imports from server-only modules.
 */

export interface StreetSideData {
	address: string;
	streetName: string;
	streetType: 'avenue' | 'street' | 'boulevard' | 'diagonal' | 'unknown';
	addressSide: 'A' | 'B';  // A = east/uptown side, B = west/downtown side
	sideALabel: string;       // e.g. "East side" or "Uptown side"
	sideBLabel: string;       // e.g. "West side" or "Downtown side"

	// Raw counts per side
	sideA: SideSignals;
	sideB: SideSignals;

	// Traffic hostility zones affecting this location
	hostilityFactors: HostilityFactor[];
	hostilityPenalty: number;  // 0 to -25

	// Final scores
	sameScore: number;        // 0-100: quality of the address's side
	oppositeScore: number;    // 0-100: quality of the opposite side
	asymmetry: number;        // -1 to +1: positive = address side is better
	streetSideScore: number;  // 0-100: final score (before concept sensitivity)
}

export interface SideSignals {
	subwayEntrances: number;
	busStops: number;
	activePOIs: number;
	totalSignals: number;
}

export interface HostilityFactor {
	type: 'tunnel_approach' | 'highway_ramp' | 'bus_depot' | 'parking_garage_cluster' | 'construction_corridor';
	name: string;
	distance: number;  // meters from address
	bearing: number;   // degrees from address
	penalty: number;   // 0 to -15 per factor
}

export interface ConceptSensitivity {
	archetype: 'impulse' | 'habitual' | 'discovery' | 'appointment' | 'destination';
	sensitivity: number;  // 0.0 to 1.0 — how much street-side matters
	label: string;
}
