/**
 * RE² Geographic Math Utilities — Canonical Source
 * ─────────────────────────────────────────────────────────────────────────────
 * 04.19.2026 13:35 Score Consolidation
 *
 * SINGLE SOURCE OF TRUTH for all geographic distance and scoring math.
 *
 * Previously, these functions were duplicated across the codebase:
 *   haversine   — ~10 local copies (overpass, nyc-lpc, vacancy-detection, etc.)
 *   clamp       — ~7 local copies  (six-index, location-iq, fit-iq-engine, etc.)
 *   scoreLinear — ~5 local copies  (six-index, location-iq, fit-iq-engine, etc.)
 *
 * ALL callers must import from here. Never define a new local copy.
 * primitives.ts re-exports clamp/scoreLinear from here for backwards compatibility.
 */

// ── Earth Radii ──────────────────────────────────────────────────────────────

const EARTH_RADIUS_METERS = 6_371_000;
const EARTH_RADIUS_MILES  = 3_958.8;

// ── Haversine Distance ───────────────────────────────────────────────────────

/**
 * Haversine distance in METERS between two lat/lon points.
 *
 * This is the canonical internal unit — used by all intel data-source modules.
 *
 * 04.19.2026 13:35 Score Consolidation — replaces local copies in:
 *   nyc-schools.ts (haversineM), nyc-lpc.ts (haversineDistance),
 *   vacancy-detection.ts (haversineDistance), google-places.ts (haversineMeters),
 *   pluto.ts (haversineMeters), street-side.ts (haversineM), compare-v2.ts (haversineM)
 */
export function haversineMeters(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const dLat = (lat2 - lat1) * (Math.PI / 180);
	const dLon = (lon2 - lon1) * (Math.PI / 180);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * (Math.PI / 180)) *
		Math.cos(lat2 * (Math.PI / 180)) *
		Math.sin(dLon / 2) ** 2;
	return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Haversine distance in KILOMETERS.
 *
 * Used by overpass.ts for competitor ring bucketing
 * (ring distances are defined in km in RING_DISTANCES).
 *
 * 04.19.2026 13:35 Score Consolidation — replaces local haversineKm in overpass.ts
 */
export function haversineKm(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	return haversineMeters(lat1, lon1, lat2, lon2) / 1000;
}

/**
 * Haversine distance in MILES.
 *
 * Used by location/utils/helpers.ts for UI distance display (fmtD helper).
 *
 * 04.19.2026 13:35 Score Consolidation — replaces local haversine in helpers.ts
 */
export function haversine(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const dLat = (lat2 - lat1) * (Math.PI / 180);
	const dLon = (lon2 - lon1) * (Math.PI / 180);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * (Math.PI / 180)) *
		Math.cos(lat2 * (Math.PI / 180)) *
		Math.sin(dLon / 2) ** 2;
	return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Scoring Math ─────────────────────────────────────────────────────────────

/**
 * Clamp a value to [min, max].
 * Defaults to 0–100 (standard score range).
 * Handles NaN by returning 50 (neutral mid-point).
 *
 * 04.19.2026 13:35 Score Consolidation — replaces local copies in:
 *   six-index.ts, location-iq.ts, fit-iq-engine.ts, re2-scores.ts,
 *   segment-intel.ts, space/+page.svelte
 *   Also re-exported from primitives.ts for backward compatibility.
 */
export function clamp(v: number, min = 0, max = 100): number {
	if (isNaN(v)) return Math.round((min + max) / 2); // NaN → neutral midpoint
	return Math.max(min, Math.min(max, v));
}

/**
 * Map a raw value to a 0–100 score by linear interpolation.
 *   value ≤ low  → 0   (or 100 if invert=true)
 *   value ≥ high → 100 (or 0 if invert=true)
 *
 * 04.19.2026 13:35 Score Consolidation — replaces local copies in:
 *   six-index.ts, location-iq.ts, fit-iq-engine.ts, location/+page.svelte
 *   Also re-exported from primitives.ts for backward compatibility.
 */
export function scoreLinear(
	value: number,
	low: number,
	high: number,
	invert = false
): number {
	if (high === low) return 50; // degenerate range → neutral
	const normalized = Math.max(0, Math.min(1, (value - low) / (high - low)));
	const score = Math.round((invert ? 1 - normalized : normalized) * 100);
	return clamp(score, 0, 100);
}
