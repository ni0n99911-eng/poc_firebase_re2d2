// neighborhood-recs.ts
// Deterministic neighborhood recommendation engine.
// No API calls — runs client-side, always returns, instant.
//
// Algorithm:
//   1. Rent Kill Gate  — eliminate neighborhoods where rent > concept break-even
//   2. Transitional Opportunity Score — rank survivors on rent gap + demand growth + competition gap
//   3. Contrarian Narrative — "Conventional wisdom says X, the math says try Y"

export interface HoodPick {
	hood: string;
	borough: string;
	score: number;           // 0–100
	rentPSF: number;
	rentGapPct: number;      // % cheaper than conventional wisdom foil
	monthlyEstimate: number; // typical_sqft × rentPSF/12
	bullets: [string, string, string];
	caution: string;
}

export interface HoodRecs {
	concept: string;
	borough: string;
	foil: {
		hood: string;
		rentPSF: number;
		monthlyEstimate: number;
		whyItLooksGood: string;
		killLine: string;       // one-liner kill statement
	};
	picks: HoodPick[];        // top 3, scored descending
}

// ── Neighborhood data ─────────────────────────────────────────────────────────
// rent_psf: annual $/sqft commercial retail
// income_idx: 0–100 relative household income index
// income_growth: decimal (e.g. 0.16 = 16% growth since 2020)
// age2544_pct: fraction of population aged 25–44
// trend: 0–1 momentum score (new openings, permit activity proxy)
// crime_idx: 0–100 (higher = more crime)

const HOOD_DATA: Record<string, {
	borough: 'Manhattan' | 'Brooklyn' | 'Queens' | 'Bronx' | 'Staten Island';
	rent_psf: number;
	income_idx: number;
	income_growth: number;
	age2544_pct: number;
	trend: number;
	crime_idx: number;
}> = {
	// Manhattan — expensive (foil territory)
	'West Village':     { borough: 'Manhattan', rent_psf: 195, income_idx: 95, income_growth: 0.04, age2544_pct: 0.38, trend: 0.30, crime_idx: 12 },
	'SoHo':             { borough: 'Manhattan', rent_psf: 220, income_idx: 98, income_growth: 0.02, age2544_pct: 0.35, trend: 0.20, crime_idx: 14 },
	'Flatiron':         { borough: 'Manhattan', rent_psf: 200, income_idx: 92, income_growth: 0.03, age2544_pct: 0.40, trend: 0.25, crime_idx: 13 },
	'Upper East Side':  { borough: 'Manhattan', rent_psf: 175, income_idx: 90, income_growth: 0.03, age2544_pct: 0.36, trend: 0.28, crime_idx: 11 },
	'Upper West Side':  { borough: 'Manhattan', rent_psf: 155, income_idx: 88, income_growth: 0.04, age2544_pct: 0.38, trend: 0.32, crime_idx: 12 },
	'Chelsea':          { borough: 'Manhattan', rent_psf: 160, income_idx: 85, income_growth: 0.05, age2544_pct: 0.45, trend: 0.40, crime_idx: 16 },
	// Manhattan — transitional (brain picks)
	'Lower East Side':  { borough: 'Manhattan', rent_psf: 115, income_idx: 62, income_growth: 0.09, age2544_pct: 0.45, trend: 0.70, crime_idx: 28 },
	'East Harlem':      { borough: 'Manhattan', rent_psf: 55,  income_idx: 38, income_growth: 0.14, age2544_pct: 0.40, trend: 0.78, crime_idx: 35 },
	'Hamilton Heights': { borough: 'Manhattan', rent_psf: 48,  income_idx: 42, income_growth: 0.16, age2544_pct: 0.42, trend: 0.82, crime_idx: 30 },
	'Inwood':           { borough: 'Manhattan', rent_psf: 40,  income_idx: 35, income_growth: 0.12, age2544_pct: 0.38, trend: 0.75, crime_idx: 32 },
	'Washington Heights':{ borough: 'Manhattan', rent_psf: 50, income_idx: 40, income_growth: 0.13, age2544_pct: 0.41, trend: 0.76, crime_idx: 31 },
	// Brooklyn — expensive
	'Williamsburg':     { borough: 'Brooklyn',  rent_psf: 175, income_idx: 82, income_growth: 0.05, age2544_pct: 0.52, trend: 0.40, crime_idx: 18 },
	'Park Slope':       { borough: 'Brooklyn',  rent_psf: 140, income_idx: 88, income_growth: 0.03, age2544_pct: 0.40, trend: 0.30, crime_idx: 12 },
	'DUMBO':            { borough: 'Brooklyn',  rent_psf: 165, income_idx: 90, income_growth: 0.04, age2544_pct: 0.42, trend: 0.35, crime_idx: 13 },
	'Cobble Hill':      { borough: 'Brooklyn',  rent_psf: 150, income_idx: 87, income_growth: 0.04, age2544_pct: 0.39, trend: 0.32, crime_idx: 11 },
	// Brooklyn — transitional
	'Crown Heights':    { borough: 'Brooklyn',  rent_psf: 68,  income_idx: 55, income_growth: 0.18, age2544_pct: 0.43, trend: 0.88, crime_idx: 28 },
	'Bed-Stuy':         { borough: 'Brooklyn',  rent_psf: 62,  income_idx: 52, income_growth: 0.20, age2544_pct: 0.44, trend: 0.90, crime_idx: 30 },
	'Bushwick':         { borough: 'Brooklyn',  rent_psf: 78,  income_idx: 50, income_growth: 0.15, age2544_pct: 0.50, trend: 0.82, crime_idx: 32 },
	'Ridgewood':        { borough: 'Brooklyn',  rent_psf: 58,  income_idx: 48, income_growth: 0.22, age2544_pct: 0.46, trend: 0.92, crime_idx: 25 },
	'Greenpoint':       { borough: 'Brooklyn',  rent_psf: 120, income_idx: 72, income_growth: 0.08, age2544_pct: 0.48, trend: 0.55, crime_idx: 16 },
	'Prospect Heights': { borough: 'Brooklyn',  rent_psf: 95,  income_idx: 70, income_growth: 0.10, age2544_pct: 0.44, trend: 0.65, crime_idx: 18 },
	'Sunset Park':      { borough: 'Brooklyn',  rent_psf: 45,  income_idx: 40, income_growth: 0.13, age2544_pct: 0.38, trend: 0.78, crime_idx: 30 },
	'Flatbush':         { borough: 'Brooklyn',  rent_psf: 52,  income_idx: 44, income_growth: 0.17, age2544_pct: 0.41, trend: 0.82, crime_idx: 28 },
	// Queens
	'LIC':              { borough: 'Queens',    rent_psf: 125, income_idx: 70, income_growth: 0.08, age2544_pct: 0.50, trend: 0.60, crime_idx: 18 },
	'Astoria':          { borough: 'Queens',    rent_psf: 72,  income_idx: 58, income_growth: 0.11, age2544_pct: 0.46, trend: 0.72, crime_idx: 22 },
	'Sunnyside':        { borough: 'Queens',    rent_psf: 60,  income_idx: 52, income_growth: 0.14, age2544_pct: 0.44, trend: 0.80, crime_idx: 20 },
	'Jackson Heights':  { borough: 'Queens',    rent_psf: 52,  income_idx: 45, income_growth: 0.12, age2544_pct: 0.42, trend: 0.75, crime_idx: 24 },
	'Forest Hills':     { borough: 'Queens',    rent_psf: 70,  income_idx: 65, income_growth: 0.09, age2544_pct: 0.40, trend: 0.68, crime_idx: 16 },
	'Flushing':         { borough: 'Queens',    rent_psf: 80,  income_idx: 55, income_growth: 0.11, age2544_pct: 0.44, trend: 0.70, crime_idx: 22 },
	// Bronx
	'Mott Haven':       { borough: 'Bronx',     rent_psf: 42,  income_idx: 30, income_growth: 0.18, age2544_pct: 0.40, trend: 0.85, crime_idx: 38 },
	'Fordham':          { borough: 'Bronx',     rent_psf: 35,  income_idx: 28, income_growth: 0.10, age2544_pct: 0.38, trend: 0.70, crime_idx: 42 },
};

// ── Concept configs ───────────────────────────────────────────────────────────

interface ConceptConfig {
	max_viable_rent_psf: number;
	typical_sqft: number;
	conventional_wisdom_hoods: string[];   // the "obvious" expensive picks
	demand_signal: string;                 // what demographic proxy matters most
}

const CONCEPT_CONFIG: Record<string, ConceptConfig> = {
	specialty_coffee:       { max_viable_rent_psf: 90,  typical_sqft: 1200, conventional_wisdom_hoods: ['West Village', 'SoHo', 'Williamsburg'],   demand_signal: 'age 25–44 density and walkability' },
	cafe_bakery:            { max_viable_rent_psf: 85,  typical_sqft: 1100, conventional_wisdom_hoods: ['West Village', 'Park Slope', 'Cobble Hill'], demand_signal: 'residential density and morning commute flow' },
	wine_bar:               { max_viable_rent_psf: 110, typical_sqft: 1800, conventional_wisdom_hoods: ['Williamsburg', 'West Village', 'Park Slope'], demand_signal: 'HHI $80K+ and evening vibrancy' },
	bar_nightlife:          { max_viable_rent_psf: 100, typical_sqft: 2000, conventional_wisdom_hoods: ['Williamsburg', 'LES', 'Chelsea'],           demand_signal: 'nightlife cluster density' },
	fast_casual:            { max_viable_rent_psf: 100, typical_sqft: 1400, conventional_wisdom_hoods: ['Flatiron', 'Chelsea', 'Upper East Side'],   demand_signal: 'office and lunch foot traffic' },
	full_service_restaurant:{ max_viable_rent_psf: 95,  typical_sqft: 2200, conventional_wisdom_hoods: ['West Village', 'SoHo', 'Cobble Hill'],      demand_signal: 'evening dining spend and HHI $65K+' },
	fitness_studio:         { max_viable_rent_psf: 85,  typical_sqft: 2500, conventional_wisdom_hoods: ['West Village', 'Park Slope', 'LIC'],        demand_signal: 'age 25–44 and transit commute radius' },
	yoga_wellness:          { max_viable_rent_psf: 80,  typical_sqft: 1800, conventional_wisdom_hoods: ['West Village', 'Park Slope', 'Upper West Side'], demand_signal: 'female 28–45 demographic and disposable income' },
	retail_boutique:        { max_viable_rent_psf: 90,  typical_sqft: 900,  conventional_wisdom_hoods: ['SoHo', 'West Village', 'DUMBO'],            demand_signal: 'tourist + local premium spend' },
	personal_services:      { max_viable_rent_psf: 75,  typical_sqft: 800,  conventional_wisdom_hoods: ['Upper East Side', 'Upper West Side', 'Park Slope'], demand_signal: 'residential repeat-client density' },
	// fallback for unmapped concepts
	default:                { max_viable_rent_psf: 90,  typical_sqft: 1200, conventional_wisdom_hoods: ['West Village', 'SoHo', 'Williamsburg'],     demand_signal: 'foot traffic and demographics' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthlyRent(rent_psf: number, sqft: number): number {
	return Math.round((rent_psf * sqft) / 12 / 100) * 100; // round to nearest $100
}

function fmt$(n: number): string {
	return '$' + n.toLocaleString();
}

function getBoroughHoods(borough: string): string[] {
	const b = borough?.trim() || '';
	return Object.keys(HOOD_DATA).filter(h => {
		if (!b || b === 'NYC') return true;
		return HOOD_DATA[h].borough === b;
	});
}

function scoreHood(hoodName: string, config: ConceptConfig): number {
	const h = HOOD_DATA[hoodName];
	if (!h) return 0;
	// Rent gap (30pts) — how much headroom below the kill ceiling
	const rentGap = Math.max(0, (config.max_viable_rent_psf - h.rent_psf) / config.max_viable_rent_psf) * 30;
	// Demographic growth (25pts) — income growth × age proxy
	const agebonus  = h.age2544_pct > 0.35 ? (h.age2544_pct - 0.35) * 10 : 0;
	const demGrowth = Math.min(25, h.income_growth * 0.8 * 100 + agebonus);
	// Trend momentum (20pts)
	const trend = h.trend * 20;
	// Survivability proxy (15pts) — inverted crime index
	const surv = (1 - h.crime_idx / 100) * 15;
	// Income floor (10pts) — ensures there's a customer base, not just cheap rent
	const incomeFloor = Math.min(10, (h.income_idx / 100) * 10);
	return Math.round(rentGap + demGrowth + trend + surv + incomeFloor);
}

function buildBullets(hoodName: string, config: ConceptConfig, foilPSF: number): [string, string, string] {
	const h = HOOD_DATA[hoodName];
	const saving = Math.round((1 - h.rent_psf / foilPSF) * 100);
	const foilMonthly = monthlyRent(foilPSF, config.typical_sqft);
	const thisMonthly = monthlyRent(h.rent_psf, config.typical_sqft);
	const growthPct   = Math.round(h.income_growth * 100);

	const b1 = `Rent ~${fmt$(thisMonthly)}/mo — ${saving}% less than the obvious choice (${fmt$(foilMonthly)}/mo)`;
	const b2 = `Median income up ${growthPct}% since 2020 — the ${config.demand_signal} is arriving ahead of rent repricing`;
	const b3 = h.trend >= 0.80
		? `Strong momentum (${Math.round(h.trend * 100)}/100) — new openings and permit activity tracking up`
		: `Steady trajectory (${Math.round(h.trend * 100)}/100) — established demand without the premium markup`;

	return [b1, b2, b3];
}

function buildCaution(hoodName: string): string {
	const h = HOOD_DATA[hoodName];
	if (h.crime_idx >= 35) return `Crime index ${h.crime_idx}/100 — storefront visibility and daytime anchoring matter for first impressions.`;
	if (h.crime_idx >= 25) return `Keep an eye on block specifics — crime index ${h.crime_idx}/100 varies street by street.`;
	if (h.income_idx < 40)  return `Income base is still building — plan for a 12–18 month ramp before the neighborhood fully converts.`;
	return `Transitional pace means tenant mix is still forming — pick the right block, not just the right neighborhood.`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function getNeighborhoodRecs(
	conceptType: string,
	borough: string,
	currentNeighborhood?: string
): HoodRecs | null {
	const config = CONCEPT_CONFIG[conceptType] ?? CONCEPT_CONFIG['default'];
	const boroughFilter = borough?.trim() || 'NYC';

	// Stage 1: identify conventional wisdom foil
	// Pick the most-expensive matching conventional hood in this borough (or city-wide)
	let foilName = config.conventional_wisdom_hoods.find(h => {
		const hd = HOOD_DATA[h];
		return hd && (boroughFilter === 'NYC' || hd.borough === boroughFilter);
	}) ?? config.conventional_wisdom_hoods[0];

	// If none match the borough, widen to city-wide
	if (!HOOD_DATA[foilName]) foilName = config.conventional_wisdom_hoods[0];
	const foilData = HOOD_DATA[foilName];
	if (!foilData) return null;

	const foilMonthly   = monthlyRent(foilData.rent_psf, config.typical_sqft);
	const foilKillLine  = `At ${fmt$(foilData.rent_psf)}/sqft that's ${fmt$(foilMonthly)}/mo — before payroll, COGS, or any profit margin.`;

	// Stage 2: score viable candidates (below rent ceiling, not the foil, not current)
	const candidates = getBoroughHoods(boroughFilter)
		.filter(h => {
			const hd = HOOD_DATA[h];
			return hd
				&& h !== foilName
				&& h !== currentNeighborhood
				&& hd.rent_psf <= config.max_viable_rent_psf;
		})
		.map(h => ({ name: h, score: scoreHood(h, config) }))
		.sort((a, b) => b.score - a.score)
		.slice(0, 3);

	if (candidates.length === 0) return null;

	// Stage 3: build picks
	const picks: HoodPick[] = candidates.map(c => {
		const hd = HOOD_DATA[c.name];
		return {
			hood:            c.name,
			borough:         hd.borough,
			score:           c.score,
			rentPSF:         hd.rent_psf,
			rentGapPct:      Math.round((1 - hd.rent_psf / foilData.rent_psf) * 100),
			monthlyEstimate: monthlyRent(hd.rent_psf, config.typical_sqft),
			bullets:         buildBullets(c.name, config, foilData.rent_psf),
			caution:         buildCaution(c.name),
		};
	});

	return {
		concept:  conceptType,
		borough:  boroughFilter,
		foil: {
			hood:             foilName,
			rentPSF:          foilData.rent_psf,
			monthlyEstimate:  foilMonthly,
			whyItLooksGood:   `high income, foot traffic, proven concept density`,
			killLine:         foilKillLine,
		},
		picks,
	};
}
