/**
 * RE² Canonical Borough Bounds — C-10 (April 12, 2026)
 *
 * Single source of truth for NYC borough bounding boxes and per-borough
 * scoring floor adjustments. All scoring modules MUST import from here.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * Prior to C-10, BOROUGH_BOUNDS was defined in geography.ts and inline
 * approximations with divergent coordinates lived in nyc-pedestrian.ts.
 * This file is the canonical consolidation point; geography.ts re-exports
 * from here for backward compatibility.
 *
 * ── Canonical boundary decisions ────────────────────────────────────────────
 * Manhattan lat upper bound:  40.882  (USGS boundary, previously 40.878 in location-iq)
 * Manhattan lng west bound:   -74.047 (captures Battery Park City / lower west side)
 * These were previously inconsistent across location-iq.ts (40.878/-74.047)
 * and nyc-311.ts/nyc-crime.ts (40.882/-74.020). Resolved here: 40.882/-74.047.
 *
 * ── Do NOT change floor values ──────────────────────────────────────────────
 * Transit, quality, and safety floors were calibrated against V4 batch scorer
 * output distributions across 6,500 NYC block groups (March 2026).
 * Changing them without a calibration backtest will silently drift all scores.
 */

export interface BoroughBounds {
	/** Borough display name */
	name: string;
	/** Latitude range [min, max] */
	lat: [number, number];
	/** Longitude range [min, max] */
	lng: [number, number];
	/**
	 * Transit score floor — applied when no MTA ridership data is available.
	 * Calibrated against V4 scorer output distributions (March 2026).
	 * Manhattan 72: dense subway grid means even the worst blocks have
	 * reasonable transit access. Staten Island 30: largely auto-dependent.
	 */
	transitFloor: number;
	/**
	 * 311 quality floor — minimum quality-of-life score derived from 311
	 * complaint density patterns (2023 citywide data). Lower = more complaints.
	 * Manhattan 55: high commercial density creates more 311 activity.
	 */
	qualityFloor: number;
	/**
	 * Safety floor — minimum safety score from NYPD crime data.
	 * Based on 300m radius queries; conservative values because tight radius
	 * is highly localized and doesn't sweep transit hubs.
	 * Bronx 29: structurally higher crime density than other boroughs.
	 */
	safetyFloor: number;
}

/** Canonical NYC borough bounding boxes with per-borough scoring adjustments. */
export const BOROUGH_BOUNDS: BoroughBounds[] = [
	{
		name: 'Manhattan',
		lat: [40.700, 40.882],   // Canonical: USGS upper bound (40.882)
		lng: [-74.047, -73.907], // Canonical: captures Battery Park City (-74.047)
		transitFloor: 72,   // Dense subway grid; floor calibrated against 6,500 block group distributions
		qualityFloor:  55,  // High commercial density → more 311 activity (lower score = more complaints)
		safetyFloor:   43,  // NYC-wide baseline; 300m radius, post-2023 NYPD data
	},
	{
		name: 'Bronx',
		lat: [40.785, 40.917],
		lng: [-73.934, -73.748],
		transitFloor: 55,   // Good subway coverage (2/5/6/D lines) but less dense than Manhattan
		qualityFloor:  52,
		safetyFloor:   29,  // Structurally higher crime density; floor reflects actual baseline
	},
	{
		name: 'Brooklyn',
		lat: [40.570, 40.740],
		lng: [-74.042, -73.833],
		transitFloor: 52,   // Subway coverage strong in north, thin in south/east
		qualityFloor:  60,
		safetyFloor:   47,
	},
	{
		name: 'Queens',
		lat: [40.541, 40.800],
		lng: [-73.962, -73.700],
		transitFloor: 50,   // Most transit-variable borough; outer Queens is very thin
		qualityFloor:  63,
		safetyFloor:   53,
	},
	{
		name: 'Staten Island',
		lat: [40.477, 40.651],
		lng: [-74.259, -74.034],
		transitFloor: 30,   // Largely auto-dependent; SIR + ferry, no subway
		qualityFloor:  68,
		safetyFloor:   57,
	},
];

/** Default floors for non-NYC locations or when borough detection fails. */
export const DEFAULT_BOROUGH_FLOORS = {
	transitFloor:  30,
	qualityFloor:  50,
	safetyFloor:   35,
} as const;

/**
 * Detect which borough a lat/lng falls in.
 * Returns the matching BoroughBounds entry, or null for non-NYC locations.
 *
 * Usage in scoring modules — prefer specific helpers below for readability:
 *   const boro = detectBorough(lat, lng);
 *   const floor = boro?.transitFloor ?? DEFAULT_BOROUGH_FLOORS.transitFloor;
 */
export function detectBorough(lat: number, lng: number): BoroughBounds | null {
	for (const boro of BOROUGH_BOUNDS) {
		if (
			lat >= boro.lat[0] && lat <= boro.lat[1] &&
			lng >= boro.lng[0] && lng <= boro.lng[1]
		) {
			return boro;
		}
	}
	return null;
}

/** Transit score floor for a given lat/lng (used by location-iq.ts). */
export function getBoroughTransitFloor(lat: number, lng: number): number {
	return detectBorough(lat, lng)?.transitFloor ?? DEFAULT_BOROUGH_FLOORS.transitFloor;
}

/** 311 quality floor for a given lat/lng (used by nyc-311.ts). */
export function getBoroughQualityFloor(lat: number, lng: number): number {
	return detectBorough(lat, lng)?.qualityFloor ?? DEFAULT_BOROUGH_FLOORS.qualityFloor;
}

/** Safety floor for a given lat/lng (used by nyc-crime.ts). */
export function getBoroughSafetyFloor(lat: number, lng: number): number {
	return detectBorough(lat, lng)?.safetyFloor ?? DEFAULT_BOROUGH_FLOORS.safetyFloor;
}
