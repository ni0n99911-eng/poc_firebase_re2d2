// ═══════════════════════════════════════════════
// RE² Location IQ — Reactive Store (Svelte 5 Runes)
// Replaces the monolith's global `S` object
// ═══════════════════════════════════════════════

import { WEIGHT_PROFILES, defaultLayerScores } from './data/constants';
import type { ScanData, LiveIntelReport, GeoResult } from './api/geo';
import type { VLFResult, GLFResult, RRResult, PoSResult, BlockScoreResult } from './scoring/engines';
import { loadLaunchPadData } from '$lib/launchpad-store';

export interface SearchStep { t: string; c: 'ok' | 'go' | 'bad'; }

export interface LocationResult {
	addr: string;
	geo: GeoResult;
	data: ScanData;
	score: BlockScoreResult;
	vlfData?: VLFResult;
	glfData?: GLFResult;
	rrData?: RRResult;
	posData?: PoSResult;
	liveIntel?: LiveIntelReport | null;
}

export interface ScrapeResult {
	data: ScanData | null;
	score: BlockScoreResult;
	ts: number;
	error: string | null;
	liveIntel?: LiveIntelReport | null;
}

// Map launchpad businessType to store bizType / bizCategory / weight profile key
// Includes both display names (from launchpad UI) and raw persona keys (from onboarding/Supabase)
const BIZ_TYPE_MAP: Record<string, { bizType: string; bizCategory: string; weightKey: string }> = {
	// Display name keys (from launchpad UI)
	'Specialty Coffee/Café':     { bizType: 'Specialty Coffee / Café', bizCategory: 'coffee', weightKey: 'Specialty Coffee / Café' },
	'Restaurant (Fast Casual)':  { bizType: 'Restaurant (Fast Casual)', bizCategory: 'restaurant', weightKey: 'Restaurant (Fast Casual)' },
	'Restaurant (Full Service)': { bizType: 'Restaurant (Full Service)', bizCategory: 'restaurant', weightKey: 'Restaurant (Full Service)' },
	'Retail':                    { bizType: 'Retail Store', bizCategory: 'retail', weightKey: 'Retail Store' },
	'Fitness / Wellness':        { bizType: 'Fitness / Wellness Studio', bizCategory: 'fitness', weightKey: 'Fitness / Wellness Studio' },
	'Salon / Barbershop':        { bizType: 'Barbershop / Salon', bizCategory: 'salon', weightKey: 'Barbershop / Salon' },
	'Professional Services':     { bizType: 'Professional Services', bizCategory: 'services', weightKey: 'Professional Services' },
	'Grocery / Market':          { bizType: 'Grocery / Specialty Food', bizCategory: 'grocery', weightKey: 'Grocery / Specialty Food' },
	'Other':                     { bizType: 'Other', bizCategory: 'other', weightKey: 'Other' },
	// Raw persona keys (from onboarding chat / Supabase sessions)
	'coffee_shop':               { bizType: 'Specialty Coffee / Café', bizCategory: 'coffee', weightKey: 'Specialty Coffee / Café' },
	'coffee':                    { bizType: 'Specialty Coffee / Café', bizCategory: 'coffee', weightKey: 'Specialty Coffee / Café' },
	// BUG-2 FIX: 'restaurant' alone defaults to fast_casual — subtype check below overrides for full_service
	'restaurant':                { bizType: 'Restaurant (Fast Casual)', bizCategory: 'restaurant', weightKey: 'Restaurant (Fast Casual)' },
	// BUG-2: Restaurant subtype keys — overrides generic 'restaurant' when businessSubType is present
	'full_service':              { bizType: 'Restaurant (Full Service)', bizCategory: 'restaurant', weightKey: 'Restaurant (Full Service)' },
	'full-service':              { bizType: 'Restaurant (Full Service)', bizCategory: 'restaurant', weightKey: 'Restaurant (Full Service)' },
	'fast_casual':               { bizType: 'Restaurant (Fast Casual)', bizCategory: 'restaurant', weightKey: 'Restaurant (Fast Casual)' },
	'quick_service':             { bizType: 'Restaurant (Fast Casual)', bizCategory: 'restaurant', weightKey: 'Restaurant (Fast Casual)' },
	'cafe_bakery':               { bizType: 'Specialty Coffee / Café', bizCategory: 'coffee', weightKey: 'Specialty Coffee / Café' },
	'gym':                       { bizType: 'Fitness / Wellness Studio', bizCategory: 'fitness', weightKey: 'Fitness / Wellness Studio' },
	'fitness':                   { bizType: 'Fitness / Wellness Studio', bizCategory: 'fitness', weightKey: 'Fitness / Wellness Studio' },
	'dentist':                   { bizType: 'Professional Services', bizCategory: 'services', weightKey: 'Professional Services' },
	'spa':                       { bizType: 'Barbershop / Salon', bizCategory: 'salon', weightKey: 'Barbershop / Salon' },
	'bodega':                    { bizType: 'Grocery / Specialty Food', bizCategory: 'grocery', weightKey: 'Grocery / Specialty Food' },
	'bakery':                    { bizType: 'Specialty Coffee / Café', bizCategory: 'coffee', weightKey: 'Specialty Coffee / Café' },
	'barber':                    { bizType: 'Barbershop / Salon', bizCategory: 'salon', weightKey: 'Barbershop / Salon' },
	'boutique':                  { bizType: 'Retail Store', bizCategory: 'retail', weightKey: 'Retail Store' },
	'something_else':            { bizType: 'Custom Concept', bizCategory: 'other', weightKey: 'Restaurant (Fast Casual)' },
	'bar':                       { bizType: 'Bar / Lounge', bizCategory: 'bar', weightKey: 'Restaurant (Full Service)' },
	'spa_wellness':              { bizType: 'Spa / Wellness', bizCategory: 'salon', weightKey: 'Barbershop / Salon' },
	'medical_dental':            { bizType: 'Dental / Medical', bizCategory: 'services', weightKey: 'Professional Services' },
	// ── Gap-fill: keys the onboarding generates that were missing from this map ──
	// Legacy Supabase key (pre-migration sessions wrote 'specialty_coffee' not 'coffee_shop')
	'specialty_coffee':          { bizType: 'Specialty Coffee / Café',   bizCategory: 'coffee',    weightKey: 'Specialty Coffee / Café' },
	// Onboarding BUSINESS_TYPES direct key ('barbershop' — only 'barber' alias existed)
	'barbershop':                { bizType: 'Barbershop / Salon',         bizCategory: 'salon',     weightKey: 'Barbershop / Salon' },
	// Fitness subtypes — selectFitnessSubtype() overwrites businessType with these keys
	'boutique_studio':           { bizType: 'Fitness / Wellness Studio',  bizCategory: 'fitness',   weightKey: 'Fitness / Wellness Studio' },
	'crossfit':                  { bizType: 'Fitness / Wellness Studio',  bizCategory: 'fitness',   weightKey: 'Fitness / Wellness Studio' },
	'big_box_gym':               { bizType: 'Fitness / Wellness Studio',  bizCategory: 'fitness',   weightKey: 'Fitness / Wellness Studio' },
	'personal_training':         { bizType: 'Fitness / Wellness Studio',  bizCategory: 'fitness',   weightKey: 'Fitness / Wellness Studio' },
	// Retail subtypes — selectRetailSubtype() overwrites businessType with these keys
	'clothing_boutique':         { bizType: 'Retail Store',               bizCategory: 'retail',    weightKey: 'Retail Store' },
	'home_goods':                { bizType: 'Retail Store',               bizCategory: 'retail',    weightKey: 'Retail Store' },
	'bookstore':                 { bizType: 'Retail Store',               bizCategory: 'retail',    weightKey: 'Retail Store' },
	'specialty_food':            { bizType: 'Grocery / Specialty Food',   bizCategory: 'grocery',   weightKey: 'Grocery / Specialty Food' },
	'beauty_retail':             { bizType: 'Barbershop / Salon',         bizCategory: 'salon',     weightKey: 'Barbershop / Salon' },
	// Canonical concept keys — writeCanonicalConcept() may write these directly to businessType
	'bar_nightlife':             { bizType: 'Bar / Lounge',               bizCategory: 'bar',       weightKey: 'Restaurant (Full Service)' },
	'full_service_restaurant':   { bizType: 'Restaurant (Full Service)',  bizCategory: 'restaurant', weightKey: 'Restaurant (Full Service)' },
	'personal_services':         { bizType: 'Personal Services',          bizCategory: 'services',  weightKey: 'Professional Services' },
	'medical_office':            { bizType: 'Dental / Medical',           bizCategory: 'services',  weightKey: 'Professional Services' },
	'fitness_studio':            { bizType: 'Fitness / Wellness Studio',  bizCategory: 'fitness',   weightKey: 'Fitness / Wellness Studio' },
	'wellness_spa':              { bizType: 'Spa / Wellness',             bizCategory: 'salon',     weightKey: 'Barbershop / Salon' },
	'juice_bar':                 { bizType: 'Specialty Coffee / Café',    bizCategory: 'coffee',    weightKey: 'Specialty Coffee / Café' },
	'wellness_beverage':         { bizType: 'Specialty Coffee / Café',    bizCategory: 'coffee',    weightKey: 'Specialty Coffee / Café' },
	'qsr':                       { bizType: 'Restaurant (Fast Casual)',   bizCategory: 'restaurant', weightKey: 'Restaurant (Fast Casual)' },
	'coworking':                 { bizType: 'Professional Services',      bizCategory: 'services',  weightKey: 'Professional Services' },
};

function resolveFromLaunchpad() {
	if (typeof window === 'undefined') return null;
	try {
		const lp = loadLaunchPadData();
		if (!lp || !lp.businessType) return null;

		// Try the launchpad businessType first
		let mapped = BIZ_TYPE_MAP[lp.businessType];

		// BUG-2 FIX: For restaurant, check businessSubType to get Full Service vs Fast Casual.
		// Without this, all restaurant subtypes (full_service, fast_casual, etc.) collapse to fast_casual.
		if (lp.businessType === 'restaurant' && lp.businessSubType) {
			const subMapped = BIZ_TYPE_MAP[lp.businessSubType];
			if (subMapped) mapped = subMapped;
		}

		// If it resolved to "Other" (but NOT a deliberate custom concept), check re2_session and re2_persona
		if ((!mapped || mapped.bizCategory === 'other') && lp.businessType !== 'something_else') {
			try {
				const sessionStr = localStorage.getItem('re2_session');
				if (sessionStr) {
					const session = JSON.parse(sessionStr);
					const pt = session.personaType || session.personaKey || '';
					if (pt) {
						const sessionMapped = BIZ_TYPE_MAP[pt];
						if (sessionMapped && sessionMapped.bizCategory !== 'other') {
							mapped = sessionMapped;
						}
					}
				}
			} catch { /* ignore session parse errors */ }
		}
		if ((!mapped || mapped.bizCategory === 'other') && lp.businessType !== 'something_else') {
			try {
				const personaStr = localStorage.getItem('re2_persona');
				if (personaStr) {
					const persona = JSON.parse(personaStr);
					if (persona.persona_type) {
						const personaMapped = BIZ_TYPE_MAP[persona.persona_type];
						if (personaMapped && personaMapped.bizCategory !== 'other') {
							mapped = personaMapped;
						}
					}
				}
			} catch { /* ignore persona parse errors */ }
		}

		// For custom concepts ("something_else"), use the user's typed business name as display
		const isCustomConcept = lp.businessType === 'something_else';
		const customDisplayName = isCustomConcept && lp.businessName ? lp.businessName : null;

		// Never surface "Other" as bizType — default to a real type
		const resolvedBizType = customDisplayName
			? customDisplayName
			: (mapped?.bizType && mapped.bizType !== 'Other') ? mapped.bizType : (() => {
			console.warn('[RE2] Store concept resolution failed — defaulting to Specialty Coffee. launchpad.businessType was:', lp?.businessType);
			return 'Specialty Coffee / Café';
		})();
		const resolvedBizCategory = (mapped?.bizCategory && mapped.bizCategory !== 'other') ? mapped.bizCategory : 'coffee';
		const resolvedWeightKey = (mapped?.weightKey && mapped.weightKey !== 'Other') ? mapped.weightKey : 'Specialty Coffee / Café';

		return {
			bizType: resolvedBizType,
			bizCategory: resolvedBizCategory,
			weightKey: resolvedWeightKey,
			vision: lp.visionStatement || '',
			differentiator: lp.differentiator || '',
			targetSDE: lp.financialGoals?.targetSDE || 0,
			targetRevY1: lp.financialGoals?.revenueY1 || 0,
			targetRevY3: lp.financialGoals?.revenueY3 || 0,
			targetTxns: lp.financialGoals?.dailyTransactions || 0,
			targetTicket: lp.financialGoals?.avgTicket || 0,
			numLocations: lp.financialGoals?.numberOfLocations || 1,
			estimatedRent: lp.financialGoals?.monthlyRentBudget || 0,
		};
	} catch { return null; }
}

export function createLocationStore() {
	const lp = resolveFromLaunchpad();
	const defaultBizType = lp?.bizType || 'Specialty Coffee / Café';
	const defaultBizCategory = lp?.bizCategory || 'coffee';
	const defaultWeightKey = lp?.weightKey || 'Specialty Coffee / Café';

	// Vision & Goals — hydrate from Concept & Goals if available
	let bizType = $state(defaultBizType);
	let bizCategory = $state(defaultBizCategory);
	let vision = $state(lp?.vision || '');
	let differentiator = $state(lp?.differentiator || '');
	let targetSDE = $state(lp?.targetSDE || 250000);
	let targetRevY1 = $state(lp?.targetRevY1 || 950000);
	let targetRevY3 = $state(lp?.targetRevY3 || 1600000);
	let targetTxns = $state(lp?.targetTxns || 500);
	let targetTicket = $state(lp?.targetTicket || 8.75);
	let numLocations = $state(lp?.numLocations ? `${lp.numLocations} location${lp.numLocations > 1 ? 's' : ''}` : 'First of 10 stores');
	let estimatedRent = $state(lp?.estimatedRent || 0);

	// Weights & Scoring — use profile matching user's business type
	let weights = $state({ ...(WEIGHT_PROFILES[defaultWeightKey] || WEIGHT_PROFILES['Specialty Coffee / Café']).w });
	let layerScores = $state(defaultLayerScores());
	let expandedLayer = $state<string | null>(null);

	// Location Search
	let searchAddr = $state('');
	let searching = $state(false);
	let searchSteps = $state<SearchStep[]>([]);
	let searchResult = $state<LocationResult | null>(null);
	let searchStep = $state(0);

	// Scoring Results
	let posData = $state<PoSResult | null>(null);
	let vlfData = $state<VLFResult | null>(null);
	let glfData = $state<GLFResult | null>(null);
	let rrData = $state<RRResult | null>(null);
	let liveIntel = $state<LiveIntelReport | null>(null);

	// Landlord Inputs
	let lcs = $state(0);
	let tiCredit = $state(50);
	let rentAbatement = $state(false);
	let percentRent = $state(false);
	let pgWaiver = $state(false);
	let sublease = $state(false);
	let trackRecord = $state(70);
	let activeInvestment = $state(false);
	let bidMember = $state(false);
	let coInvestment = $state(false);

	// Neighborhood Scanner
	let selectedNeighborhood = $state('Chelsea');
	let scrapeBorough = $state('Manhattan');
	let scraping = $state(false);
	let scrapeResults = $state<Record<string, ScrapeResult>>({});
	let scrapeQueue = $state<string[]>([]);
	let expandedHood = $state<string | null>(null);

	// Location Comparison
	let primaryResult = $state<LocationResult | null>(null);
	let altResults = $state<(LocationResult | null)[]>([null, null, null]);

	return {
		// Vision & Goals
		get bizType() { return bizType; }, set bizType(v) { bizType = v; },
		get bizCategory() { return bizCategory; }, set bizCategory(v) { bizCategory = v; },
		get vision() { return vision; }, set vision(v) { vision = v; },
		get differentiator() { return differentiator; }, set differentiator(v) { differentiator = v; },
		get targetSDE() { return targetSDE; }, set targetSDE(v) { targetSDE = v; },
		get targetRevY1() { return targetRevY1; }, set targetRevY1(v) { targetRevY1 = v; },
		get targetRevY3() { return targetRevY3; }, set targetRevY3(v) { targetRevY3 = v; },
		get targetTxns() { return targetTxns; }, set targetTxns(v) { targetTxns = v; },
		get targetTicket() { return targetTicket; }, set targetTicket(v) { targetTicket = v; },
		get numLocations() { return numLocations; }, set numLocations(v) { numLocations = v; },
		get estimatedRent() { return estimatedRent; }, set estimatedRent(v) { estimatedRent = v; },

		// Weights & Scoring
		get weights() { return weights; }, set weights(v) { weights = v; },
		get layerScores() { return layerScores; }, set layerScores(v) { layerScores = v; },
		get expandedLayer() { return expandedLayer; }, set expandedLayer(v) { expandedLayer = v; },

		// Search
		get searchAddr() { return searchAddr; }, set searchAddr(v) { searchAddr = v; },
		get searching() { return searching; }, set searching(v) { searching = v; },
		get searchSteps() { return searchSteps; }, set searchSteps(v) { searchSteps = v; },
		get searchResult() { return searchResult; }, set searchResult(v) { searchResult = v; },
		get searchStep() { return searchStep; }, set searchStep(v) { searchStep = v; },

		// Scoring Results
		get posData() { return posData; }, set posData(v) { posData = v; },
		get vlfData() { return vlfData; }, set vlfData(v) { vlfData = v; },
		get glfData() { return glfData; }, set glfData(v) { glfData = v; },
		get rrData() { return rrData; }, set rrData(v) { rrData = v; },
		get liveIntel() { return liveIntel; }, set liveIntel(v) { liveIntel = v; },

		// Landlord
		get lcs() { return lcs; }, set lcs(v) { lcs = v; },
		get tiCredit() { return tiCredit; }, set tiCredit(v) { tiCredit = v; },
		get rentAbatement() { return rentAbatement; }, set rentAbatement(v) { rentAbatement = v; },
		get percentRent() { return percentRent; }, set percentRent(v) { percentRent = v; },
		get pgWaiver() { return pgWaiver; }, set pgWaiver(v) { pgWaiver = v; },
		get sublease() { return sublease; }, set sublease(v) { sublease = v; },
		get trackRecord() { return trackRecord; }, set trackRecord(v) { trackRecord = v; },
		get activeInvestment() { return activeInvestment; }, set activeInvestment(v) { activeInvestment = v; },
		get bidMember() { return bidMember; }, set bidMember(v) { bidMember = v; },
		get coInvestment() { return coInvestment; }, set coInvestment(v) { coInvestment = v; },

		// Neighborhood Scanner
		get selectedNeighborhood() { return selectedNeighborhood; }, set selectedNeighborhood(v) { selectedNeighborhood = v; },
		get scrapeBorough() { return scrapeBorough; }, set scrapeBorough(v) { scrapeBorough = v; },
		get scraping() { return scraping; }, set scraping(v) { scraping = v; },
		get scrapeResults() { return scrapeResults; }, set scrapeResults(v) { scrapeResults = v; },
		get scrapeQueue() { return scrapeQueue; }, set scrapeQueue(v) { scrapeQueue = v; },
		get expandedHood() { return expandedHood; }, set expandedHood(v) { expandedHood = v; },

		// Comparison
		get primaryResult() { return primaryResult; }, set primaryResult(v) { primaryResult = v; },
		get altResults() { return altResults; }, set altResults(v) { altResults = v; },

		// Helper: push search step
		step(t: string) { searchSteps = [...searchSteps, { t, c: 'go' }]; },
		stepDone(t: string) {
			if (searchSteps.length) {
				const updated = [...searchSteps];
				updated[updated.length - 1] = { t, c: 'ok' };
				searchSteps = updated;
			}
		},
		stepBad(t: string) { searchSteps = [...searchSteps, { t, c: 'bad' }]; },
	};
}

export type LocationStore = ReturnType<typeof createLocationStore>;
