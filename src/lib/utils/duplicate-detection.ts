/**
 * Duplicate Analysis Detection
 * Checks localStorage scoredLocations for existing analyses with same address + concept type
 */

export interface ScoredLocation {
	addr: string;
	conceptType?: string;
	score?: number;
	fitScore?: number;
	visionScore?: number;
	scoredAt?: number;
	[key: string]: any;
}

export interface DuplicateMatch {
	found: true;
	location: ScoredLocation;
	address: string;
	conceptType: string;
}

export type DuplicateCheckResult = DuplicateMatch | { found: false };

/**
 * Normalize address for comparison (basic normalization)
 * Strips extra whitespace and converts to lowercase
 */
function normalizeAddress(addr: string): string {
	return addr.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check if address matches (fuzzy match allows minor variations)
 * - Exact match: normalized strings are identical
 * - Fuzzy match: one contains the other (handles partial addresses)
 */
function addressesMatch(addr1: string, addr2: string): boolean {
	const norm1 = normalizeAddress(addr1);
	const norm2 = normalizeAddress(addr2);

	// Exact match
	if (norm1 === norm2) return true;

	// Fuzzy: one contains the other (handles "123 Main St" vs "123 Main St, New York, NY 10001")
	if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

	return false;
}

/**
 * Normalize concept type for comparison
 * Handles variations in naming: display names, canonical keys, subtypes
 */
function normalizeConceptType(concept: string): string {
	if (!concept) return '';
	return concept.trim().toLowerCase();
}

/**
 * Check if an address+concept analysis has already been scored
 * Returns match details if found, otherwise { found: false }
 */
export function checkDuplicateAnalysis(
	address: string,
	conceptType: string,
	scoredLocations?: ScoredLocation[]
): DuplicateCheckResult {
	if (!address || !conceptType) {
		return { found: false };
	}

	// Load from localStorage if not provided
	const locations = scoredLocations ?? getStoredScoredLocations();
	if (!locations || locations.length === 0) {
		return { found: false };
	}

	const normalizedConcept = normalizeConceptType(conceptType);

	// Find first match with both address AND conceptType
	for (const location of locations) {
		if (!location.addr) continue;

		const addressMatch = addressesMatch(address, location.addr);
		const conceptMatch = normalizeConceptType(location.conceptType || '') === normalizedConcept;

		if (addressMatch && conceptMatch) {
			return {
				found: true,
				location,
				address: location.addr,
				conceptType: location.conceptType || conceptType,
			};
		}
	}

	return { found: false };
}

/**
 * Get stored scored locations from localStorage
 */
export function getStoredScoredLocations(): ScoredLocation[] {
	if (typeof window === 'undefined') return [];

	try {
		const data = localStorage.getItem('re2_launchpad');
		if (!data) return [];

		const parsed = JSON.parse(data);
		return (parsed.scoredLocations || []) as ScoredLocation[];
	} catch (e) {
		console.warn('[DuplicateDetection] Failed to read scoredLocations from localStorage:', e);
		return [];
	}
}
