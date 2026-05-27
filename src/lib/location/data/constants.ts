// ═══════════════════════════════════════════════
// RE² Location IQ — Constants & Reference Data
// ═══════════════════════════════════════════════

export interface Hood {
	name: string;
	lat: number;
	lon: number;
	borough: string;
}

export interface WeightProfile {
	w: Record<string, number>;
	insight: string;
}

export interface LayerDef {
	id: string;
	name: string;
	icon: string;
	color: string;
}

export interface Bank {
	name: string;
	stage: string;
	sba: boolean;
	programs: string[];
	maxLoan: string;
	rate: string;
	features: string[];
	match: string;
}

export interface Broker {
	n: string;
	u: string;
	tag: string;
}

export interface HoodDataEntry {
	demScore: number;
	rentPSF: number;
	trend: number;
	crimeScore: number;
	wageBase: number;
	_live?: boolean;
}

// Direct browser call — bypasses Netlify proxy (10s timeout kills the proxy request).
// Overpass API supports CORS natively; individual user IPs are not rate-limited.
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const NOMINATIM_URL = '/api/geo?type=nominatim';

export const BROKERS: Broker[] = [
	{ n: 'LoopNet', u: 'https://www.loopnet.com/search/retail-space/new-york-ny/for-lease/', tag: '6,000+' },
	{ n: '42floors', u: 'https://42floors.com/for-lease/retail/us/ny/new-york-city', tag: '2,100+' },
	{ n: 'JLL', u: 'https://property.jll.com/rent-retail/new-york', tag: 'INST.' },
	{ n: 'Cushman', u: 'https://www.cushmanwakefield.com/en/united-states/properties/new-york/retail-for-lease-new-york', tag: 'INST.' },
	{ n: 'CBRE', u: 'https://www.cbre.com/services/property-types/retail/new-york-city-retail', tag: 'INST.' },
	{ n: 'Lee & Assoc', u: 'https://www.lee-associates.com/new-york/listings/', tag: 'NATL' },
	{ n: 'KSR', u: 'https://www.ksrny.com/', tag: 'NYC' },
	{ n: 'Retail by Mona', u: 'https://retailbymona.com/', tag: 'NYC' },
	{ n: 'Newmark', u: 'https://www.nmrk.com/properties', tag: 'NATL' },
];

export const HOODS: Hood[] = [
	{ name: 'Flatiron', lat: 40.7411, lon: -73.9897, borough: 'Manhattan' },
	{ name: 'Chelsea', lat: 40.7465, lon: -74.0014, borough: 'Manhattan' },
	{ name: 'SoHo', lat: 40.7233, lon: -73.9985, borough: 'Manhattan' },
	{ name: 'West Village', lat: 40.7358, lon: -74.0036, borough: 'Manhattan' },
	{ name: 'East Village', lat: 40.7265, lon: -73.9815, borough: 'Manhattan' },
	{ name: 'Tribeca', lat: 40.7163, lon: -74.0086, borough: 'Manhattan' },
	{ name: 'NoHo', lat: 40.7275, lon: -73.9926, borough: 'Manhattan' },
	{ name: 'Nolita', lat: 40.7234, lon: -73.9955, borough: 'Manhattan' },
	{ name: 'Midtown', lat: 40.7549, lon: -73.9840, borough: 'Manhattan' },
	{ name: 'UWS', lat: 40.7870, lon: -73.9754, borough: 'Manhattan' },
	{ name: 'UES', lat: 40.7736, lon: -73.9566, borough: 'Manhattan' },
	{ name: 'Gramercy', lat: 40.7368, lon: -73.9845, borough: 'Manhattan' },
	{ name: 'FiDi', lat: 40.7075, lon: -74.0113, borough: 'Manhattan' },
	{ name: 'Hells Kitchen', lat: 40.7638, lon: -73.9918, borough: 'Manhattan' },
	{ name: 'Murray Hill', lat: 40.7488, lon: -73.9776, borough: 'Manhattan' },
	{ name: 'LES', lat: 40.7168, lon: -73.9861, borough: 'Manhattan' },
	{ name: 'Harlem', lat: 40.8116, lon: -73.9465, borough: 'Manhattan' },
	{ name: 'Williamsburg', lat: 40.7081, lon: -73.9571, borough: 'Brooklyn' },
	{ name: 'DUMBO', lat: 40.7033, lon: -73.9893, borough: 'Brooklyn' },
	{ name: 'Park Slope', lat: 40.6710, lon: -73.9814, borough: 'Brooklyn' },
	{ name: 'Greenpoint', lat: 40.7274, lon: -73.9515, borough: 'Brooklyn' },
	{ name: 'Cobble Hill', lat: 40.6862, lon: -73.9968, borough: 'Brooklyn' },
	{ name: 'Fort Greene', lat: 40.6892, lon: -73.9742, borough: 'Brooklyn' },
	{ name: 'Astoria', lat: 40.7723, lon: -73.9174, borough: 'Queens' },
	{ name: 'LIC', lat: 40.7425, lon: -73.9580, borough: 'Queens' },
	{ name: 'Union Square', lat: 40.7359, lon: -73.9911, borough: 'Manhattan' },
	{ name: 'Hudson Yards', lat: 40.7535, lon: -74.0010, borough: 'Manhattan' },
];

export const WEIGHT_PROFILES: Record<string, WeightProfile> = {
	'Specialty Coffee / Café': { w: { L0: 8, L1: 12, L2: 28, L3: 18, L4: 14, L5: 12, L6: 8 }, insight: 'Foot traffic IS the business. Walk-shed within 3-4 min determines your transaction ceiling.' },
	'Restaurant / Fast Casual': { w: { L0: 10, L1: 12, L2: 25, L3: 20, L4: 15, L5: 10, L6: 8 }, insight: 'Restaurants are unit economics machines. The margin between success and failure is razor-thin.' },
	'Retail Store': { w: { L0: 12, L1: 14, L2: 28, L3: 18, L4: 8, L5: 12, L6: 8 }, insight: 'Retail is a visibility game. Your storefront IS your marketing.' },
	'Fitness / Wellness Studio': { w: { L0: 8, L1: 10, L2: 20, L3: 22, L4: 18, L5: 14, L6: 8 }, insight: 'Instructors ARE the product. A great trainer in a mediocre location beats a mediocre trainer anywhere.' },
	'Professional Services': { w: { L0: 6, L1: 18, L2: 10, L3: 22, L4: 20, L5: 14, L6: 10 }, insight: 'Your people ARE your product. Talent attraction and city policy shape everything.' },
	'Grocery / Specialty Food': { w: { L0: 15, L1: 14, L2: 22, L3: 20, L4: 8, L5: 12, L6: 9 }, insight: 'Grocery margins are 1-3%. A 1% inflation shift can wipe out profit.' },
	'Barbershop / Salon': { w: { L0: 6, L1: 10, L2: 22, L3: 18, L4: 22, L5: 14, L6: 8 }, insight: 'When a great stylist leaves, they take their clients. Retention IS survival.' },
	'Other': { w: { L0: 8, L1: 15, L2: 25, L3: 18, L4: 12, L5: 12, L6: 10 }, insight: 'Balanced defaults. Customize weights based on what matters most for your business.' },
};

export const LAYER_DEFS: LayerDef[] = [
	{ id: 'L0', name: 'Macro Climate', icon: '🌐', color: '#bf5af2' },
	{ id: 'L1', name: 'City Dynamics', icon: '🏙️', color: '#00e8cc' },
	{ id: 'L2', name: 'Block Intelligence', icon: '📍', color: '#3b82f6' },
	{ id: 'L3', name: 'Business Plan Fit', icon: '📊', color: '#34d399' },
	{ id: 'L4', name: 'Talent Accessibility', icon: '👥', color: '#f97316' },
	{ id: 'L5', name: 'Resilience & Wildcards', icon: '🛡️', color: '#fbbf24' },
	{ id: 'L6', name: 'Zoning & Physical Risk', icon: '🏗️', color: '#ef4444' },
];

export const BANKS: Bank[] = [
	{ name: 'Huntington Bank', stage: 'pre-revenue', sba: true, programs: ['SBA 7(a)', 'SBA Express'], maxLoan: '$5M', rate: 'Prime+2.25-2.75%', features: ['Pre-revenue friendly', 'Fast SBA Express up to $500K', 'Strong food/bev experience'], match: 'PRE-REVENUE SPECIALIST' },
	{ name: 'Live Oak Bank', stage: 'pre-revenue', sba: true, programs: ['SBA 7(a)', 'USDA'], maxLoan: '$5M', rate: 'Prime+2.0-2.75%', features: ['100% financing available', 'Industry-specialized lending', 'Startup-friendly underwriting'], match: 'STARTUP LENDING' },
	{ name: 'Celtic Bank', stage: 'pre-revenue', sba: true, programs: ['SBA 7(a)', 'SBA 504'], maxLoan: '$5M', rate: 'Prime+2.0-3.0%', features: ['Franchise & startup focus', 'Fast processing', 'Nationwide SBA'], match: 'SBA SPECIALIST' },
	{ name: 'Chase Bank', stage: 'post-revenue', sba: true, programs: ['SBA 7(a)', 'Term Loans', 'Lines of Credit'], maxLoan: '$5M+', rate: 'Prime+1.5-2.75%', features: ['Strong for expansion', 'Business checking integration', 'Large SBA lender'], match: 'EXPANSION GROWTH' },
	{ name: 'TD Bank', stage: 'post-revenue', sba: true, programs: ['SBA 7(a)', 'SBA Express', 'Equipment'], maxLoan: '$5M', rate: 'Prime+2.0-2.75%', features: ['NYC branch network', 'Small business focus', 'Quick approvals'], match: 'POST-REVENUE GROWTH' },
	{ name: 'Wells Fargo', stage: 'post-revenue', sba: true, programs: ['SBA 7(a)', 'Term Loans'], maxLoan: '$5M+', rate: 'Prime+1.75-2.75%', features: ['Large SBA volume lender', 'Competitive rates', 'Treasury management'], match: 'ESTABLISHED BUSINESS' },
	{ name: 'Pursuit Lending (CDFI)', stage: 'pre-revenue', sba: false, programs: ['Microloans', 'CDL', 'SBA Micro'], maxLoan: '$250K', rate: '6-9%', features: ['Community lender', 'Flexible underwriting', 'NYC focused', 'Technical assistance'], match: 'COMMUNITY LENDING' },
	{ name: 'Accion Opportunity Fund', stage: 'pre-revenue', sba: false, programs: ['Microloans', 'Small Business Loans'], maxLoan: '$250K', rate: '7-13%', features: ['Minority/women-owned focus', 'No minimum credit score', 'Startup friendly'], match: 'MISSION-DRIVEN LENDING' },
];

export const HOOD_DATA: Record<string, HoodDataEntry> = {
	'Chelsea': { demScore: 82, rentPSF: 140, trend: 78, crimeScore: 65, wageBase: 19 },
	'Flatiron': { demScore: 85, rentPSF: 130, trend: 80, crimeScore: 82, wageBase: 18 },
	'SoHo': { demScore: 80, rentPSF: 150, trend: 75, crimeScore: 78, wageBase: 20 },
	'West Village': { demScore: 88, rentPSF: 155, trend: 85, crimeScore: 85, wageBase: 21 },
	'East Village': { demScore: 70, rentPSF: 95, trend: 65, crimeScore: 60, wageBase: 17 },
	'Tribeca': { demScore: 82, rentPSF: 160, trend: 72, crimeScore: 88, wageBase: 22 },
	'NoHo': { demScore: 75, rentPSF: 120, trend: 70, crimeScore: 75, wageBase: 18 },
	'Nolita': { demScore: 78, rentPSF: 135, trend: 73, crimeScore: 80, wageBase: 19 },
	'Midtown': { demScore: 90, rentPSF: 125, trend: 88, crimeScore: 70, wageBase: 19 },
	'UWS': { demScore: 72, rentPSF: 85, trend: 68, crimeScore: 72, wageBase: 16 },
	'UES': { demScore: 75, rentPSF: 95, trend: 70, crimeScore: 78, wageBase: 17 },
	'Gramercy': { demScore: 80, rentPSF: 105, trend: 76, crimeScore: 75, wageBase: 18 },
	'FiDi': { demScore: 68, rentPSF: 115, trend: 62, crimeScore: 80, wageBase: 18 },
	'Hells Kitchen': { demScore: 74, rentPSF: 110, trend: 72, crimeScore: 68, wageBase: 17 },
	'Murray Hill': { demScore: 65, rentPSF: 90, trend: 60, crimeScore: 65, wageBase: 16 },
	'LES': { demScore: 72, rentPSF: 100, trend: 68, crimeScore: 62, wageBase: 16 },
	'Harlem': { demScore: 70, rentPSF: 75, trend: 65, crimeScore: 55, wageBase: 15 },
	'Williamsburg': { demScore: 76, rentPSF: 105, trend: 74, crimeScore: 68, wageBase: 17 },
	'DUMBO': { demScore: 78, rentPSF: 120, trend: 76, crimeScore: 76, wageBase: 18 },
	'Park Slope': { demScore: 74, rentPSF: 95, trend: 70, crimeScore: 75, wageBase: 17 },
	'Greenpoint': { demScore: 72, rentPSF: 90, trend: 68, crimeScore: 66, wageBase: 16 },
	'Cobble Hill': { demScore: 76, rentPSF: 105, trend: 72, crimeScore: 78, wageBase: 17 },
	'Fort Greene': { demScore: 70, rentPSF: 85, trend: 66, crimeScore: 70, wageBase: 16 },
	'Astoria': { demScore: 68, rentPSF: 80, trend: 64, crimeScore: 72, wageBase: 15 },
	'LIC': { demScore: 70, rentPSF: 95, trend: 66, crimeScore: 74, wageBase: 16 },
	'Union Square': { demScore: 80, rentPSF: 130, trend: 82, crimeScore: 68, wageBase: 18 },
	'Hudson Yards': { demScore: 88, rentPSF: 175, trend: 90, crimeScore: 82, wageBase: 20 },
	'Broadway': { demScore: 78, rentPSF: 120, trend: 75, crimeScore: 70, wageBase: 18 },
};

export function defaultLayerScores(): Record<string, { score: number; factors: Array<{ name: string; value: string; score: number; detail: string; override: number | null }> }> {
	return {
		L0: {
			score: 72, factors: [
				{ name: 'Fed Rate Environment', value: '3.5-3.75%', score: 65, detail: 'Elevated rates increase borrowing costs for buildout', override: null },
				{ name: 'F&B Inflation', value: '3.1-5.2%', score: 58, detail: 'Food-away-from-home inflation at 4.0% YoY', override: null },
				{ name: 'Wellness Spending', value: '+13% YoY', score: 92, detail: 'Only category with net-positive spending intent in 2026', override: null },
				{ name: 'Protein Demand', value: '57%', score: 88, detail: '57% of consumers prioritizing protein intake', override: null },
			]
		},
		L1: {
			score: 61, factors: [
				{ name: 'Minimum Wage', value: '$17/hr', score: 45, detail: 'NYC $17/hr; tipped food workers $11.35/hr + tip credit', override: null },
				{ name: 'SMB Friendliness', value: '50th', score: 32, detail: 'NY ranked last nationally for small biz friendliness', override: null },
				{ name: 'Workforce Availability', value: 'Strong', score: 78, detail: 'Record employment; food services sector growing', override: null },
				{ name: 'City Stability', value: 'Stable', score: 85, detail: 'Manhattan employment +14.2% (265K workers) 2021-2023', override: null },
				{ name: 'Vacancy Rate', value: '14.2%', score: 65, detail: 'Manhattan storefront vacancy — moderate availability', override: null },
			]
		},
		L2: { score: 0, factors: [] },
		L3: { score: 0, factors: [] },
		L4: {
			score: 68, factors: [
				{ name: 'Wage Benchmark', value: '$17-24/hr', score: 55, detail: 'NYC barista wages; tips add $200-500/week', override: null },
				{ name: 'Commute Feasibility', value: 'TBD', score: 70, detail: 'Depends on location transit access', override: null },
				{ name: 'Employee Safety', value: 'TBD', score: 70, detail: 'Depends on block-level crime data', override: null },
				{ name: 'Talent Pool Depth', value: 'Strong', score: 72, detail: 'Large hospitality workforce; high competition', override: null },
			]
		},
		L5: {
			score: 63, factors: [
				{ name: 'Substitution Risk', value: 'Medium', score: 55, detail: 'Depends on competitor density at location', override: null },
				{ name: 'Customer Loyalty', value: 'Medium', score: 65, detail: 'Niche positioning builds stronger loyalty', override: null },
				{ name: 'Recovery-from-Disruption', value: 'Moderate', score: 60, detail: 'How fast can you bounce back from a closure?', override: null },
				{ name: 'Dependency Risk', value: 'Moderate', score: 58, detail: 'Revenue concentration on specific customer segments', override: null },
				{ name: 'Seasonal Variance', value: 'Low-Med', score: 75, detail: 'Year-round appeal assessment', override: null },
			]
		},
		L6: {
			score: 70, factors: [
				{ name: 'Scaffolding Risk', value: 'TBD', score: 60, detail: 'Active construction or sidewalk sheds', override: null },
				{ name: 'DOB Violations', value: 'Check', score: 65, detail: 'Building-specific violation history', override: null },
				{ name: 'Slip/Trip Risk', value: 'TBD', score: 75, detail: 'Sidewalk condition, ice liability', override: null },
				{ name: 'Zoning Compliance', value: 'TBD', score: 80, detail: 'Zoning permits food service', override: null },
			]
		},
	};
}
