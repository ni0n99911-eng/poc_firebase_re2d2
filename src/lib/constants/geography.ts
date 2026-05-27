/**
 * RE² Borough Geography — backward-compat re-export shim (C-10, April 12, 2026)
 *
 * All borough bounds data has moved to `borough-bounds.ts`.
 * This file re-exports everything so existing imports keep working.
 *
 * New code should import directly from '$lib/constants/borough-bounds'.
 */

export {
	type BoroughBounds,
	BOROUGH_BOUNDS,
	DEFAULT_BOROUGH_FLOORS,
	detectBorough,
	getBoroughTransitFloor,
	getBoroughQualityFloor,
	getBoroughSafetyFloor,
} from '$lib/constants/borough-bounds';
