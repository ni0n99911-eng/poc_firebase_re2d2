/**
 * B2-3.4: Occupancy cost extras — BID / Insurance / CAM configuration.
 *
 * Total occupancy cost is base rent + tax pass-through + these three extras.
 * Today's business-case model only captures base rent + tax (BC-01/02/03),
 * which understates real NYC occupancy cost by 2–8% of revenue depending on
 * location and building class.
 *
 * This file is a CONFIG-ONLY source. Brain 3 task B3-2.3 will wire it into
 * src/lib/stores/business-case-store.svelte.ts to populate the
 * occupancyCostBreakdown output field. No runtime consumers in this PR.
 *
 * Data sources:
 *   - BID_ASSESSMENTS: NYC SBS Business Improvement District registry
 *     (https://www.nyc.gov/site/sbs/neighborhoods/bids.page). Rates are the
 *     BID assessment expressed as a percent of base annual rent.
 *   - INSURANCE_BENCHMARKS: per-concept typical premiums (NYC commercial
 *     general liability + property insurance 2025 quotes).
 *   - CAM_ESTIMATES: PLUTO BldgClass → common-area-maintenance monthly rate
 *     per SF. Classes are first-letter groups in the NYC PLUTO taxonomy.
 *
 * All values are ESTIMATES — they're the "benchmark" column in the UX use-of-
 * funds table, not firm quotes. Founders should override with actual quotes
 * from their landlord / broker / carrier before signing.
 */

// ─── BID assessments ────────────────────────────────────────────────────────

export interface BidAssessment {
	/** Canonical name — matches NYC SBS registry */
	name: string;
	/** Borough the BID operates in */
	borough: 'Manhattan' | 'Brooklyn' | 'Queens' | 'Bronx' | 'Staten Island';
	/**
	 * Assessment rate — percent of BASE annual rent added to occupancy cost.
	 * E.g., 0.005 = 0.5% of annual rent. Typical NYC BID range: 0.003–0.008.
	 */
	rateOfBaseRent: number;
	/**
	 * Zone hint — keywords the geocoder can match on (neighborhood or
	 * street corridor). The resolver in business-case-store will do a
	 * case-insensitive substring match against the analysis address.
	 */
	matches: readonly string[];
}

/**
 * Representative subset of NYC's 76+ BIDs. Includes the ones with the most
 * retail density. Missing entries fall back to BID_DEFAULT_RATE (null — no
 * BID in this area, so no extra assessment).
 */
export const BID_ASSESSMENTS: readonly BidAssessment[] = [
	// ── Manhattan ──
	{ name: 'Times Square Alliance',             borough: 'Manhattan', rateOfBaseRent: 0.007, matches: ['times square', 'theater district', '42nd st', 'broadway'] },
	{ name: 'Grand Central Partnership',         borough: 'Manhattan', rateOfBaseRent: 0.006, matches: ['grand central', 'midtown east', '42nd', 'lexington', 'vanderbilt'] },
	{ name: 'Bryant Park Corporation',           borough: 'Manhattan', rateOfBaseRent: 0.006, matches: ['bryant park', '6th ave', 'sixth avenue'] },
	{ name: 'Flatiron/23rd Street Partnership',  borough: 'Manhattan', rateOfBaseRent: 0.005, matches: ['flatiron', '23rd st', 'madison square'] },
	{ name: 'Fifth Avenue Association',          borough: 'Manhattan', rateOfBaseRent: 0.006, matches: ['fifth avenue', '5th ave', 'plaza district'] },
	{ name: 'Lower East Side Partnership',       borough: 'Manhattan', rateOfBaseRent: 0.004, matches: ['lower east side', 'les', 'rivington', 'orchard', 'ludlow'] },
	{ name: 'SoHo Broadway Initiative',          borough: 'Manhattan', rateOfBaseRent: 0.005, matches: ['soho', 'broadway soho', 'spring st', 'prince st'] },
	{ name: 'Union Square Partnership',          borough: 'Manhattan', rateOfBaseRent: 0.005, matches: ['union square', '14th st', '17th st'] },
	{ name: 'Chinatown Partnership',             borough: 'Manhattan', rateOfBaseRent: 0.003, matches: ['chinatown', 'mott st', 'canal st'] },
	{ name: 'Village Alliance',                  borough: 'Manhattan', rateOfBaseRent: 0.004, matches: ['greenwich village', 'west village', 'bleecker'] },
	{ name: 'Hudson Yards Hell\u2019s Kitchen Alliance', borough: 'Manhattan', rateOfBaseRent: 0.005, matches: ['hudson yards', 'hell\u2019s kitchen', 'hells kitchen'] },
	{ name: 'Downtown Alliance',                 borough: 'Manhattan', rateOfBaseRent: 0.005, matches: ['financial district', 'fidi', 'wall st', 'downtown manhattan'] },
	{ name: 'Columbus Avenue BID',               borough: 'Manhattan', rateOfBaseRent: 0.004, matches: ['columbus ave', 'upper west side', 'uws'] },
	{ name: '125th Street BID',                  borough: 'Manhattan', rateOfBaseRent: 0.003, matches: ['125th st', 'harlem', 'apollo'] },
	{ name: '34th Street Partnership',           borough: 'Manhattan', rateOfBaseRent: 0.006, matches: ['34th st', 'herald square', 'penn station'] },

	// ── Brooklyn ──
	{ name: 'Downtown Brooklyn Partnership',     borough: 'Brooklyn',  rateOfBaseRent: 0.005, matches: ['downtown brooklyn', 'fulton st', 'livingston'] },
	{ name: 'Park Slope 5th Avenue BID',         borough: 'Brooklyn',  rateOfBaseRent: 0.004, matches: ['park slope', '5th ave brooklyn', 'fifth ave brooklyn'] },
	{ name: 'Bedford Stuyvesant Gateway BID',    borough: 'Brooklyn',  rateOfBaseRent: 0.003, matches: ['bed-stuy', 'bedford-stuyvesant', 'nostrand'] },
	{ name: 'Flatbush Avenue BID',               borough: 'Brooklyn',  rateOfBaseRent: 0.003, matches: ['flatbush ave', 'flatbush'] },
	{ name: 'North Flatbush BID',                borough: 'Brooklyn',  rateOfBaseRent: 0.004, matches: ['north flatbush', 'grand army plaza'] },
	{ name: 'Atlantic Avenue BID',               borough: 'Brooklyn',  rateOfBaseRent: 0.004, matches: ['atlantic ave', 'boerum hill'] },
	{ name: 'Myrtle Avenue Brooklyn Partnership', borough: 'Brooklyn', rateOfBaseRent: 0.003, matches: ['myrtle ave', 'fort greene', 'clinton hill'] },
	{ name: 'DUMBO Improvement District',        borough: 'Brooklyn',  rateOfBaseRent: 0.005, matches: ['dumbo', 'jay st', 'washington st'] },
	{ name: 'Industry City / Sunset Park',       borough: 'Brooklyn',  rateOfBaseRent: 0.003, matches: ['sunset park', 'industry city'] },
	{ name: 'Bay Ridge 5th Avenue BID',          borough: 'Brooklyn',  rateOfBaseRent: 0.003, matches: ['bay ridge'] },
	{ name: 'Kings Highway BID',                 borough: 'Brooklyn',  rateOfBaseRent: 0.003, matches: ['kings highway', 'midwood'] },

	// ── Queens ──
	{ name: 'Long Island City Partnership',      borough: 'Queens',    rateOfBaseRent: 0.005, matches: ['long island city', 'lic', 'vernon blvd', 'jackson ave'] },
	{ name: 'Jamaica Center Improvement District', borough: 'Queens',  rateOfBaseRent: 0.004, matches: ['jamaica center', 'jamaica ave'] },
	{ name: 'Sutphin Boulevard BID',             borough: 'Queens',    rateOfBaseRent: 0.003, matches: ['sutphin blvd', 'jamaica'] },
	{ name: 'Queens Plaza BID',                  borough: 'Queens',    rateOfBaseRent: 0.004, matches: ['queens plaza'] },
	{ name: 'Steinway Astoria Partnership',      borough: 'Queens',    rateOfBaseRent: 0.003, matches: ['astoria', 'steinway', '30th ave'] },
	{ name: 'Flushing BID',                      borough: 'Queens',    rateOfBaseRent: 0.004, matches: ['flushing', 'main st queens'] },
	{ name: '82nd Street Partnership',           borough: 'Queens',    rateOfBaseRent: 0.003, matches: ['jackson heights', '82nd st'] },
	{ name: 'Sunnyside Shines',                  borough: 'Queens',    rateOfBaseRent: 0.003, matches: ['sunnyside', 'queens blvd'] },

	// ── Bronx ──
	{ name: 'Fordham Road BID',                  borough: 'Bronx',     rateOfBaseRent: 0.004, matches: ['fordham rd', 'fordham road'] },
	{ name: '161st Street BID',                  borough: 'Bronx',     rateOfBaseRent: 0.003, matches: ['161st st', 'yankee stadium'] },
	{ name: 'Third Avenue BID',                  borough: 'Bronx',     rateOfBaseRent: 0.003, matches: ['third ave bronx', '3rd ave bronx', 'morrisania'] },
	{ name: 'Southern Boulevard BID',            borough: 'Bronx',     rateOfBaseRent: 0.003, matches: ['southern blvd'] },
	{ name: 'Bay Plaza BID',                     borough: 'Bronx',     rateOfBaseRent: 0.004, matches: ['bay plaza', 'co-op city'] },

	// ── Staten Island ──
	{ name: 'Forest Avenue BID',                 borough: 'Staten Island', rateOfBaseRent: 0.003, matches: ['forest ave'] },
	{ name: 'New Dorp Lane BID',                 borough: 'Staten Island', rateOfBaseRent: 0.003, matches: ['new dorp'] },
] as const;

/**
 * Default rate when the address falls outside any BID boundary. Null means
 * "no BID assessment" — not an error.
 */
export const BID_DEFAULT_RATE: number | null = null;

/**
 * Resolve a BID match for a given address. Simple case-insensitive substring
 * search against the `matches` keywords. Returns null for addresses outside
 * all known BIDs.
 */
export function resolveBidAssessment(address: string | null | undefined): BidAssessment | null {
	if (!address) return null;
	const lower = address.toLowerCase();
	for (const bid of BID_ASSESSMENTS) {
		if (bid.matches.some(k => lower.includes(k.toLowerCase()))) return bid;
	}
	return null;
}

// ─── Insurance benchmarks (per concept) ─────────────────────────────────────

export interface InsuranceBenchmark {
	/** Concept key matching CONCEPT_KPIS */
	conceptKey: string;
	/** Annual premium range (USD) for NYC commercial GL + property insurance */
	annualPremium: { low: number; typical: number; high: number };
	/** Notes on what's typically included at the "typical" premium */
	note: string;
}

/**
 * Per-concept commercial insurance benchmarks. 2025 NYC quotes for a typical
 * 1,000–2,500 SF storefront with 2–10 employees. Brain 3 should pick the
 * "typical" value by default; UX can expose the range as an advanced override.
 */
export const INSURANCE_BENCHMARKS: Record<string, InsuranceBenchmark> = {
	specialty_coffee:        { conceptKey: 'specialty_coffee',        annualPremium: { low: 1_800, typical:  3_000, high:  5_500 }, note: 'GL + property + workers comp; higher if espresso machine/gas lines.' },
	bakery:                  { conceptKey: 'bakery',                  annualPremium: { low: 2_200, typical:  3_800, high:  6_500 }, note: 'Higher fire risk (ovens) than coffee.' },
	fast_casual:             { conceptKey: 'fast_casual',             annualPremium: { low: 3_000, typical:  5_200, high:  9_000 }, note: 'Food handling + higher traffic elevate GL premium.' },
	qsr:                     { conceptKey: 'qsr',                     annualPremium: { low: 3_500, typical:  6_000, high: 10_500 }, note: 'Franchise programs often require specific carriers.' },
	full_service_restaurant: { conceptKey: 'full_service_restaurant', annualPremium: { low: 4_500, typical:  8_500, high: 16_000 }, note: 'Add liquor liability if serving alcohol ($2k-$6k additional).' },
	bar_nightlife:           { conceptKey: 'bar_nightlife',           annualPremium: { low: 6_500, typical: 14_000, high: 28_000 }, note: 'Liquor liability is the primary cost driver.' },
	juice_bar:               { conceptKey: 'juice_bar',               annualPremium: { low: 1_600, typical:  2_800, high:  4_800 }, note: 'Low kitchen risk; product liability is the main category.' },
	wellness_beverage:       { conceptKey: 'wellness_beverage',       annualPremium: { low: 1_600, typical:  2_800, high:  4_800 }, note: 'Similar to juice bar — low fire risk.' },
	retail:                  { conceptKey: 'retail',                  annualPremium: { low: 1_500, typical:  2_500, high:  4_500 }, note: 'Lower GL baseline — no food handling.' },
	florist:                 { conceptKey: 'florist',                 annualPremium: { low: 1_400, typical:  2_400, high:  4_000 }, note: 'Refrigerated inventory is the insurable asset.' },
	fitness_studio:          { conceptKey: 'fitness_studio',          annualPremium: { low: 2_800, typical:  4_800, high:  8_500 }, note: 'Member-injury GL + equipment coverage.' },
	personal_services:       { conceptKey: 'personal_services',       annualPremium: { low: 1_800, typical:  3_200, high:  5_500 }, note: 'Professional liability required for services touching clients.' },
	wellness_spa:            { conceptKey: 'wellness_spa',            annualPremium: { low: 3_500, typical:  6_500, high: 12_000 }, note: 'Add professional liability + licensed practitioner coverage.' },
	medical_office:          { conceptKey: 'medical_office',          annualPremium: { low: 5_000, typical: 12_000, high: 28_000 }, note: 'Malpractice is the dominant line; varies wildly by specialty.' },
	coworking:               { conceptKey: 'coworking',               annualPremium: { low: 3_500, typical:  6_000, high: 11_000 }, note: 'GL + property for member injury; tenant/landlord balance matters.' },
} as const;

export function resolveInsuranceBenchmark(conceptKey: string): InsuranceBenchmark | null {
	return INSURANCE_BENCHMARKS[conceptKey] ?? null;
}

// ─── CAM estimates (by PLUTO building class letter group) ───────────────────

/**
 * CAM (Common Area Maintenance) estimate per building-class group. Monthly
 * rate per square foot. Multiply by SF to get monthly CAM charge.
 *
 * Keyed by the first letter of the PLUTO BldgClass field (the "major class"):
 *   A = Single-family residential (rare in commercial)
 *   B = Two-family residential
 *   C = Walk-up apartment (ground-floor retail common)
 *   D = Elevator apartment (ground-floor retail common)
 *   E = Warehouse
 *   F = Factory/industrial
 *   G = Garage/parking
 *   H = Hotel
 *   I = Hospital/health
 *   J = Theater
 *   K = Store building (retail-primary)
 *   L = Loft (mixed use)
 *   M = Religious/nonprofit
 *   O = Office building
 *   P = Public place of assembly
 *   Q = Outdoor recreation
 *   R = Condominium/cooperative
 *   S = Primarily residential with 1–3 store units
 *   T = Transportation facility
 *   U = Utility
 *   V = Vacant land
 *   W = Educational
 *   Y = Selected government
 *   Z = Misc / mixed-use parcels with retail
 *
 * Source: 2024 NYC commercial real estate operating expense benchmarks
 * (Costar + REBNY). CAM varies ±40% within a class depending on building
 * age, amenities, and landlord reporting.
 */
export const CAM_ESTIMATES_PER_SF_MONTHLY: Record<string, { typical: number; note: string }> = {
	C: { typical: 0.35, note: 'Walk-up apartment with retail — landlord-borne utilities often rolled into CAM.' },
	D: { typical: 0.75, note: 'Elevator apartment — doorman/porter allocation adds to CAM.' },
	K: { typical: 0.55, note: 'Retail-primary building — cleanest CAM structure, fewer hidden charges.' },
	L: { typical: 0.65, note: 'Loft building — older systems, higher HVAC allocation.' },
	O: { typical: 1.10, note: 'Office building — lobby + elevators + common HVAC; highest CAM group.' },
	R: { typical: 0.85, note: 'Condo/co-op — board may pass through special assessments on top of CAM.' },
	S: { typical: 0.30, note: 'Small mixed-use — minimal common areas; low CAM.' },
	H: { typical: 1.25, note: 'Hotel ground-floor retail — 24/7 operations inflate shared utility costs.' },
	Z: { typical: 0.60, note: 'Mixed-use — negotiate the CAM formula line-by-line in the lease.' },
};

/** Default CAM rate ($/SF/month) when building class isn't mapped. */
export const CAM_DEFAULT_PER_SF_MONTHLY = 0.50;

/**
 * Resolve CAM from a PLUTO BldgClass string. Returns the typical rate for
 * the class's first-letter group, falling back to CAM_DEFAULT_PER_SF_MONTHLY.
 */
export function resolveCamEstimate(bldgClass: string | null | undefined): { perSfMonthly: number; note: string } {
	if (!bldgClass) return { perSfMonthly: CAM_DEFAULT_PER_SF_MONTHLY, note: 'No building class on file — using city-wide default.' };
	const letter = bldgClass.trim().toUpperCase().charAt(0);
	const entry = CAM_ESTIMATES_PER_SF_MONTHLY[letter];
	return entry
		? { perSfMonthly: entry.typical, note: entry.note }
		: { perSfMonthly: CAM_DEFAULT_PER_SF_MONTHLY, note: 'Building class not mapped — using city-wide default.' };
}
