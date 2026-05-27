/**
 * NYC Department of Finance (DOF) Property Tax & ACRIS Mortgage Integration
 *
 * Data sources (all free via NYC Open Data / Socrata):
 *   - DOF Property Tax Bills:  8wbx-tsch  (5-year trend, tax class, assessments)
 *   - ACRIS Mortgage Records:  bnx9-e6tj + 8h5j-fqxa + 636b-3b5g
 *   - ACRIS Deed Records:      bnx9-e6tj  (DEED, RPTT doc types)
 *   - DOF Tax Lien Sales:      9rz4-mjek
 *
 * Input: BBL (Borough-Block-Lot) derived from existing PLUTO lookup.
 * Cache TTL: 30 days (tax data is annual; mortgage data rarely changes).
 *
 * Spec: RE2-DOF-Integration-Spec, April 2026
 */

import { IntelCache, intelCache, TTL } from './cache';
import { env } from '$env/dynamic/private';
import { fetchTaxLienDetail, type TaxLienRecord } from './dof-tax-lien';

// socrataFetch type alias — avoids passing `Function` (which breaks generic calls in TS)
type SocrataFn = <T>(url: string, label: string, options?: { timeout?: number }) => Promise<T | null>;

// ─── Endpoints ───────────────────────────────────────────────────────────────
const DOF_TAX_BILLS_EP    = 'https://data.cityofnewyork.us/resource/8wbx-tsch.json';
const ACRIS_MASTER_EP     = 'https://data.cityofnewyork.us/resource/bnx9-e6tj.json';
const ACRIS_LEGALS_EP     = 'https://data.cityofnewyork.us/resource/8h5j-fqxa.json';
const ACRIS_PARTIES_EP    = 'https://data.cityofnewyork.us/resource/636b-3b5g.json';
const DOF_TAX_LIEN_EP     = 'https://data.cityofnewyork.us/resource/9rz4-mjek.json';

// 30-day TTL for tax data (annual updates)
const TTL_DOF = 30 * 24 * 3600 * 1000;

// ─── Types ───────────────────────────────────────────────────────────────────

export type EscalationRisk = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface PropertyTaxProfile {
	// Tax bill data
	annualTax:             number;        // Most recent year net tax due
	monthlyTaxPassThrough: number;        // annualTax / 12 (or prorated by sqft)
	taxClass:              string;        // '1','2','4' etc.
	taxYear:               number;        // Most recent tax year in dataset

	// 5-year trend
	escalation5yr:    number;             // (yr5 / yr1) - 1, total pct change
	escalationAnnual: number;             // CAGR annualised
	escalationRisk:   EscalationRisk;

	// Ownership structure
	isCoop:  boolean;                     // D* bldgclass or Class2 + coop indicators
	taxClassLabel: string;                // Human-readable tax class description

	// Tax lien
	hasTaxLien: boolean;
	/** DS-04: Full lien detail from 9rz4-mjek (severity, amount, age, disposition). Null if BBL not in lien sale list. */
	taxLienDetail: TaxLienRecord | null;

	// ACRIS mortgage
	mortgageAmount: number;
	mortgageDate:   string;               // ISO date
	lenderName:     string;
	isMortgaged:    boolean;
	mortgageAge:    number;               // years since mortgage date

	// ACRIS deed / last sale
	lastSalePrice: number;
	lastSaleDate:  string;               // ISO date
	yearsHeld:     number;

	// Derived context strings (for Business Case UI)
	coopVsCondoContext: 'condo_or_commercial' | 'coop' | 'unknown';
	mortgageContext:    'high_leverage' | 'low_leverage' | 'no_mortgage' | 'unknown';

	// Metadata
	source: 'dof_property_tax';
	fetchedAt: string;
	bbl: string;
}

// ─── Main fetch ──────────────────────────────────────────────────────────────

/**
 * Fetch full DOF property tax profile for a BBL.
 * Gracefully degrades — returns null on API failure or missing BBL.
 *
 * @param bbl      Borough-Block-Lot string (e.g. "1001860030")
 * @param sqft     Tenant's leased square footage (for pro-rating tax share)
 * @param bldgSqft Total building area from PLUTO (for pro-rating)
 * @param bldgClass Building class from PLUTO (e.g. "D4" = coop)
 */
export async function fetchPropertyTaxProfile(
	bbl: string,
	sqft: number = 0,
	bldgSqft: number = 0,
	bldgClass: string = ''
): Promise<PropertyTaxProfile | null> {
	if (!bbl || bbl.length < 6) return null;

	const cacheKey = `dof:${bbl}`;
	const cached = await intelCache.getAsync<PropertyTaxProfile>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		const { socrataFetch } = await import('./socrata-fetch');
		const appToken = env.NYC_OPEN_DATA_TOKEN;

		// Run all 5 queries in parallel — DS-04: added fetchTaxLienDetail for severity data
		const [taxBills, acrisDocs, acrisParties, taxLien, lienDetail] = await Promise.allSettled([
			fetchTaxBills(bbl, socrataFetch, appToken),
			fetchAcrisDocs(bbl, socrataFetch, appToken),
			fetchAcrisParties(bbl, socrataFetch, appToken),
			fetchTaxLien(bbl, socrataFetch, appToken),
			fetchTaxLienDetail(bbl),
		]);

		const bills         = taxBills.status    === 'fulfilled' ? taxBills.value    : [];
		const acrDocs       = acrisDocs.status   === 'fulfilled' ? acrisDocs.value   : [];
		const acrParty      = acrisParties.status === 'fulfilled' ? acrisParties.value : [];
		const lienHit       = taxLien.status     === 'fulfilled' ? taxLien.value     : false;
		const taxLienRecord = lienDetail.status  === 'fulfilled' ? lienDetail.value  : null;

		const profile = buildProfile(bbl, bills, acrDocs, acrParty, lienHit, taxLienRecord, sqft, bldgSqft, bldgClass);
		intelCache.set(cacheKey, profile, TTL_DOF);
		return profile;

	} catch (e) {
		console.error('[DOF] Fetch error for BBL', bbl, e);
		return cached?.data ?? null;
	}
}

// ─── Individual queries ───────────────────────────────────────────────────────

async function fetchTaxBills(
	bbl: string,
	socrataFetch: SocrataFn,
	appToken: string | undefined
): Promise<Record<string, string>[]> {
	const q = `?bbl=${bbl}&$order=tax_year DESC&$limit=5&$select=tax_year,tax_class,assessed_value,tax_rate,tax_amount,abatement_amount,exemption_amount,net_tax_due`;
	const raw = await socrataFetch<Record<string, string>[]>(
		`${DOF_TAX_BILLS_EP}${q}`, 'DOF-TAX', appToken ? { timeout: 10000 } : undefined
	);
	return raw ?? [];
}

async function fetchAcrisDocs(
	bbl: string,
	socrataFetch: SocrataFn,
	appToken: string | undefined
): Promise<Record<string, string>[]> {
	// Step 1: get document_ids for this BBL from legals table
	const legalsQ = `?$where=bbl='${bbl}'&$select=document_id&$limit=200`;
	const legals = await socrataFetch<Record<string, string>[]>(
		`${ACRIS_LEGALS_EP}${legalsQ}`, 'ACRIS-LEGALS', appToken ? { timeout: 10000 } : undefined
	);
	if (!legals?.length) return [];

	const docIds = ([...new Set(legals.map((r: any) => r.document_id as string).filter(Boolean))] as string[]).slice(0, 100);
	if (!docIds.length) return [];

	// Step 2: get master records for mortgage + deed doc types
	const idList = docIds.map(id => `'${id}'`).join(',');
	const masterQ = `?$where=document_id in (${idList}) AND doc_type in ('MTGE','SAT','DEED','RPTT','AGMT','ASST')&$select=document_id,doc_type,doc_date,doc_amount&$order=doc_date DESC&$limit=50`;
	const master = await socrataFetch<Record<string, string>[]>(
		`${ACRIS_MASTER_EP}${masterQ}`, 'ACRIS-MASTER', appToken ? { timeout: 10000 } : undefined
	);
	return master ?? [];
}

async function fetchAcrisParties(
	bbl: string,
	socrataFetch: SocrataFn,
	appToken: string | undefined
): Promise<Record<string, string>[]> {
	// Get lender names (party_type=2) via legals → parties join
	const legalsQ = `?$where=bbl='${bbl}'&$select=document_id&$limit=50`;
	const legals = await socrataFetch<Record<string, string>[]>(
		`${ACRIS_LEGALS_EP}${legalsQ}`, 'ACRIS-LEGALS-P', appToken ? { timeout: 8000 } : undefined
	);
	if (!legals?.length) return [];

	const docIds = ([...new Set(legals.map((r: any) => r.document_id as string).filter(Boolean))] as string[]).slice(0, 50);
	if (!docIds.length) return [];

	const idList = docIds.map(id => `'${id}'`).join(',');
	const partiesQ = `?$where=document_id in (${idList}) AND party_type='2'&$select=document_id,name,party_type&$limit=50`;
	const parties = await socrataFetch<Record<string, string>[]>(
		`${ACRIS_PARTIES_EP}${partiesQ}`, 'ACRIS-PARTIES', appToken ? { timeout: 8000 } : undefined
	);
	return parties ?? [];
}

async function fetchTaxLien(
	bbl: string,
	socrataFetch: SocrataFn,
	appToken: string | undefined
): Promise<boolean> {
	const q = `?bbl=${bbl}&$limit=1&$select=bbl`;
	const result = await socrataFetch<Record<string, string>[]>(
		`${DOF_TAX_LIEN_EP}${q}`, 'DOF-LIEN', appToken ? { timeout: 8000 } : undefined
	);
	return Array.isArray(result) && result.length > 0;
}

// ─── Profile builder ─────────────────────────────────────────────────────────

function buildProfile(
	bbl: string,
	bills: Record<string, string>[],
	acrDocs: Record<string, string>[],
	acrParties: Record<string, string>[],
	hasTaxLien: boolean,
	taxLienRecord: TaxLienRecord | null,
	sqft: number,
	bldgSqft: number,
	bldgClass: string
): PropertyTaxProfile {

	// ── Tax bills ────────────────────────────────────────────────────────────
	const taxYear     = bills.length > 0 ? parseInt(bills[0].tax_year) || 0 : 0;
	const taxClass    = bills.length > 0 ? (bills[0].tax_class ?? '') : '';
	const rawAnnualTax = bills.length > 0 ? parseFloat(bills[0].net_tax_due) || 0 : 0;

	// Pro-rate by sqft share if we have building area
	const sqftShare = (sqft > 0 && bldgSqft > 0) ? Math.min(1, sqft / bldgSqft) : 1;
	const annualTax = Math.round(rawAnnualTax * sqftShare);
	const monthlyTaxPassThrough = Math.round(annualTax / 12);

	// 5-year escalation: bills are DESC order (newest first), oldest = bills[4]
	let escalation5yr    = 0;
	let escalationAnnual = 0;
	if (bills.length >= 2) {
		const newest = parseFloat(bills[0].net_tax_due) || 0;
		const oldest = parseFloat(bills[bills.length - 1].net_tax_due) || 0;
		if (oldest > 0 && newest > 0) {
			escalation5yr    = (newest / oldest) - 1;
			const years      = bills.length - 1;
			escalationAnnual = Math.pow(1 + escalation5yr, 1 / Math.max(years, 1)) - 1;
		}
	}
	const escalationRisk = classifyEscalation(escalationAnnual);

	// ── Coop detection (D* bldgclass or Class 2 + coop bldgclass) ────────────
	const isCoop = detectCoop(bldgClass, taxClass);
	const coopVsCondoContext: PropertyTaxProfile['coopVsCondoContext'] =
		isCoop ? 'coop' : (taxClass === '4' || taxClass.startsWith('2') ? 'condo_or_commercial' : 'unknown');

	// ── ACRIS: split mortgages vs deeds ──────────────────────────────────────
	const mortgageDocs = acrDocs.filter(d => d.doc_type === 'MTGE' || d.doc_type === 'AGMT' || d.doc_type === 'ASST');
	const satDocs      = acrDocs.filter(d => d.doc_type === 'SAT');
	const deedDocs     = acrDocs.filter(d => d.doc_type === 'DEED' || d.doc_type === 'RPTT');

	// Most recent mortgage
	const latestMtge   = mortgageDocs[0] ?? null;   // already sorted DESC by date
	const latestSat    = satDocs[0] ?? null;
	const isMortgaged  = latestMtge !== null && (
		!latestSat || compareDates(latestMtge.doc_date, latestSat.doc_date) > 0
	);

	const mortgageAmount = latestMtge ? parseFloat(latestMtge.doc_amount) || 0 : 0;
	const mortgageDate   = latestMtge?.doc_date ?? '';
	const mortgageAge    = mortgageDate ? yearsSince(mortgageDate) : 0;

	// Lender name
	const lenderParty = latestMtge
		? acrParties.find(p => p.document_id === latestMtge.document_id)
		: null;
	const lenderName = lenderParty?.name ?? '';

	// Last sale
	const latestDeed   = deedDocs[0] ?? null;
	const lastSalePrice = latestDeed ? parseFloat(latestDeed.doc_amount) || 0 : 0;
	const lastSaleDate  = latestDeed?.doc_date ?? '';
	const yearsHeld     = lastSaleDate ? yearsSince(lastSaleDate) : 0;

	// Mortgage leverage context
	const assessedValue = bills.length > 0 ? parseFloat(bills[0].assessed_value) || 0 : 0;
	const mortgageContext = classifyMortgageContext(mortgageAmount, assessedValue, mortgageAge, isMortgaged);

	return {
		annualTax,
		monthlyTaxPassThrough,
		taxClass,
		taxYear,
		escalation5yr:    Math.round(escalation5yr * 1000) / 1000,
		escalationAnnual: Math.round(escalationAnnual * 1000) / 1000,
		escalationRisk,
		isCoop,
		taxClassLabel: taxClassLabel(taxClass),
		hasTaxLien,
		taxLienDetail: taxLienRecord,
		mortgageAmount,
		mortgageDate,
		lenderName,
		isMortgaged,
		mortgageAge,
		lastSalePrice,
		lastSaleDate,
		yearsHeld,
		coopVsCondoContext,
		mortgageContext,
		source: 'dof_property_tax',
		fetchedAt: new Date().toISOString(),
		bbl,
	};
}

// ─── Scoring helpers (used by score-all-v4 and Vision IQ) ────────────────────

/**
 * Compute taxBurdenRatio and the Vision IQ adjustment.
 * Exported so score-all-v4.mjs can import via dynamic require.
 */
export function computeTaxBurdenAdjustment(
	monthlyTaxPassThrough: number,
	projectedMonthlyRevenue: number
): { taxBurdenRatio: number; viqAdjustment: number } {
	if (!projectedMonthlyRevenue || projectedMonthlyRevenue <= 0) {
		return { taxBurdenRatio: 0, viqAdjustment: 0 };
	}

	const taxBurdenRatio = monthlyTaxPassThrough / projectedMonthlyRevenue;

	let viqAdjustment = 0;
	if (taxBurdenRatio < 0.02)       viqAdjustment = 0;
	else if (taxBurdenRatio < 0.04)  viqAdjustment = -Math.round(taxBurdenRatio * 150);  // -2 to -4
	else if (taxBurdenRatio < 0.07)  viqAdjustment = -Math.round(taxBurdenRatio * 120);  // -5 to -8
	else                              viqAdjustment = Math.max(-15, -Math.round(taxBurdenRatio * 100)); // -10 to -15

	return { taxBurdenRatio, viqAdjustment: Math.min(0, viqAdjustment) };
}

/**
 * Compute Vision IQ escalation penalty.
 * Properties escalating > 4%/year get a negative adjustment.
 * Formula from spec: -(escalationAnnual - 0.04) * 200 if > 0.04
 */
export function computeEscalationPenalty(escalationAnnual: number): number {
	if (escalationAnnual <= 0.04) return 0;
	return Math.max(-20, -Math.round((escalationAnnual - 0.04) * 200));
}

// ─── Private helpers ─────────────────────────────────────────────────────────

function classifyEscalation(annual: number): EscalationRisk {
	if (annual < 0.02) return 'LOW';
	if (annual < 0.04) return 'MODERATE';
	if (annual < 0.06) return 'HIGH';
	return 'CRITICAL';
}

function detectCoop(bldgClass: string, taxClass: string): boolean {
	// PLUTO bldgclass codes starting with 'D' are coops (D0-D9)
	if (bldgClass && bldgClass.toUpperCase().startsWith('D')) return true;
	// Class 2 without explicit non-coop markers is likely coop/condo
	// (be conservative — only flag D* as definitive coop)
	return false;
}

function taxClassLabel(taxClass: string): string {
	const map: Record<string, string> = {
		'1':  'Class 1 — 1-3 Family Residential',
		'2':  'Class 2 — Residential Coop/Condo',
		'2a': 'Class 2A — Small Coop/Condo',
		'2b': 'Class 2B — Mid Coop/Condo',
		'2c': 'Class 2C — Large Coop/Condo',
		'4':  'Class 4 — Commercial/Industrial (no assessment cap)',
	};
	return map[taxClass.toLowerCase()] ?? `Tax Class ${taxClass}`;
}

function classifyMortgageContext(
	mortgageAmount: number,
	assessedValue: number,
	mortgageAge: number,
	isMortgaged: boolean
): PropertyTaxProfile['mortgageContext'] {
	if (!isMortgaged || mortgageAmount <= 0) return 'no_mortgage';
	if (assessedValue > 0 && mortgageAmount > assessedValue * 2 && mortgageAge < 3) return 'high_leverage';
	return 'low_leverage';
}

function yearsSince(dateStr: string): number {
	if (!dateStr) return 0;
	const then = new Date(dateStr).getTime();
	const now  = Date.now();
	return Math.max(0, Math.round((now - then) / (365.25 * 24 * 3600 * 1000) * 10) / 10);
}

/** Returns positive if a is after b, negative if before */
function compareDates(a: string, b: string): number {
	return new Date(a).getTime() - new Date(b).getTime();
}

// ─── Business Case helpers (exported for BC model) ────────────────────────────

/**
 * Project tax pass-through cost for years 1–5 applying escalation.
 * Returns monthly amounts for each year.
 */
export function projectTaxPassThrough(
	monthlyTaxPassThrough: number,
	escalationAnnual: number,
	years: number = 5
): number[] {
	const result: number[] = [];
	for (let y = 1; y <= years; y++) {
		result.push(Math.round(monthlyTaxPassThrough * Math.pow(1 + escalationAnnual, y - 1)));
	}
	return result;
}

/**
 * Generate human-readable Business Case context message for tax situation.
 */
export function buildTaxContextMessage(profile: PropertyTaxProfile): string {
	const monthly = profile.monthlyTaxPassThrough;
	const pct5yr  = Math.round(profile.escalation5yr * 100);
	const annPct  = Math.round(profile.escalationAnnual * 100);

	if (profile.hasTaxLien) {
		return `WARNING: This property has outstanding tax liens. The building may be at risk of forced sale. Consider the stability of your lease if ownership changes.`;
	}

	if (profile.isCoop) {
		if (profile.escalationRisk === 'HIGH' || profile.escalationRisk === 'CRITICAL') {
			return `This is a coop building. Property taxes are included in your rent, but the building's taxes have risen ${pct5yr}% in 5 years. Budget for rent increases above your lease renewal rate.`;
		}
		return `This is a coop building. Property taxes are embedded in your rent, not a separate line item. Building taxes have been ${profile.escalationRisk === 'LOW' ? 'stable' : 'moderate'} (${pct5yr}% over 5 years).`;
	}

	if (monthly > 0) {
		const yr3Monthly = Math.round(monthly * Math.pow(1 + profile.escalationAnnual, 2));
		if (profile.escalationRisk === 'CRITICAL') {
			return `Property taxes: $${monthly.toLocaleString()}/mo (passed through in your lease). Escalating at ${annPct}%/year — a kill-factor level. Budget $${yr3Monthly.toLocaleString()}/mo by Year 3.`;
		}
		if (profile.escalationRisk === 'HIGH') {
			return `Property taxes: $${monthly.toLocaleString()}/mo (passed through in your lease). Escalating at ${annPct}%/year — above inflation. Budget $${yr3Monthly.toLocaleString()}/mo by Year 3.`;
		}
		return `Property taxes: $${monthly.toLocaleString()}/mo (passed through in your lease). Escalating at ${annPct}%/year — within normal range.`;
	}

	return 'Property tax data unavailable for this address.';
}

/**
 * Generate copilot narrative snippet for tax context.
 */
export function buildCopilotTaxSnippet(profile: PropertyTaxProfile | null): string {
	if (!profile || profile.annualTax === 0) return '';

	if (profile.hasTaxLien) {
		return `This property has outstanding tax liens — a serious risk signal. Discuss building financial stability with your attorney before signing any lease.`;
	}

	const annPct = Math.round(profile.escalationAnnual * 100);
	const pct5yr = Math.round(profile.escalation5yr * 100);

	if (profile.escalationRisk === 'LOW') {
		return `Property taxes are moderate and stable — no surprises in your occupancy budget. Taxes have risen only ${pct5yr}% over 5 years.`;
	}
	if (profile.escalationRisk === 'CRITICAL') {
		return `Property taxes on this building have risen ${pct5yr}% in 5 years (${annPct}%/year). Factor this aggressively into your lease negotiation — ask for a hard tax escalation cap. This is a kill-factor level risk.`;
	}
	if (profile.escalationRisk === 'HIGH') {
		return `Property taxes on this building have risen ${pct5yr}% in 5 years. Factor this into your lease negotiation — ask for a tax escalation cap.`;
	}
	return `Property taxes have increased ${pct5yr}% over 5 years — within normal range for NYC.`;
}

/**
 * Build mortgage negotiation context for Business Case display.
 */
export function buildMortgageContext(profile: PropertyTaxProfile | null): string {
	if (!profile) return '';

	if (profile.hasTaxLien) {
		return `WARNING: This property has outstanding tax liens. The building may be at risk of forced sale. Consider the stability of your lease if ownership changes.`;
	}

	if (profile.mortgageContext === 'high_leverage') {
		const yr = profile.mortgageDate ? new Date(profile.mortgageDate).getFullYear() : 'recently';
		const amt = profile.mortgageAmount > 0 ? `$${(profile.mortgageAmount / 1_000_000).toFixed(1)}M mortgage` : 'a large mortgage';
		return `The building was purchased in ${yr} with ${amt}. The landlord may be under financial pressure to maintain high rents. Negotiate hard on escalation caps.`;
	}

	if (profile.mortgageContext === 'no_mortgage' && profile.yearsHeld > 10) {
		const yr = profile.lastSaleDate ? new Date(profile.lastSaleDate).getFullYear() : '';
		return `The building has been held since ${yr} with low or no mortgage. The landlord has flexibility on pricing — this is a strong negotiation position for you.`;
	}

	return '';
}
