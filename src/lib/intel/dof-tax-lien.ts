/**
 * NYC DOF Tax Lien Detail Integration — DS-04 (April 12, 2026)
 *
 * Extends the boolean `hasTaxLien` in dof-property-tax.ts with full structured
 * lien records from the DOF Tax Lien Sales dataset (9rz4-mjek).
 *
 * ── What this adds vs dof-property-tax.ts ──────────────────────────────────
 * dof-property-tax.ts fetchTaxLien():  returns boolean (presence only, $limit=1)
 * This module:                         returns full lien detail — amount, type,
 *                                      age, years covered, sale/disposition status
 *
 * ── Data source ────────────────────────────────────────────────────────────
 * NYC DOF Tax Lien Sales List: https://data.cityofnewyork.us/resource/9rz4-mjek.json
 * Updated annually (each lien sale cycle). Free, no auth required.
 * NYC Open Data App Token speeds up queries but is optional.
 *
 * ── Integration path ───────────────────────────────────────────────────────
 * 1. Called from fetchPropertyTaxProfile() (dof-property-tax.ts) when more
 *    detail is needed than a boolean — replace fetchTaxLien() stub
 * 2. Wire into Business Case copilot narrative for lien severity context
 * 3. Wire into Location IQ building risk scoring (severe liens → cap LocationIQ)
 *    [Post-launch, requires sign-off]
 *
 * ── Lien severity classification ───────────────────────────────────────────
 * NONE     — no lien on record
 * MINOR    — < $10K total (water/sewer arrears, common)
 * MODERATE — $10K–$100K (multiple years of tax arrears)
 * SEVERE   — > $100K (risk of forced sale / ownership change)
 * CRITICAL — lien already sold to a third party (ownership transfer imminent)
 */

import { IntelCache, intelCache } from './cache';
import { env } from '$env/dynamic/private';

// ─── Endpoint ────────────────────────────────────────────────────────────────

const DOF_TAX_LIEN_EP = 'https://data.cityofnewyork.us/resource/9rz4-mjek.json';

// 30-day cache — lien sales are annual, data is stable
const TTL_LIEN_MS = 30 * 24 * 3600 * 1000;

// ─── Types ───────────────────────────────────────────────────────────────────

export type LienSeverity = 'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL';

export interface TaxLienRecord {
	/** Borough-Block-Lot */
	bbl: string;
	/** True if any lien appears in the dataset for this BBL */
	hasLien: boolean;
	/** Severity classification based on total amount + disposition */
	severity: LienSeverity;

	/** Total lien amount across all open liens (USD) */
	totalAmount: number;
	/** Number of distinct lien records found */
	lienCount: number;
	/** Tax years covered by the lien(s), e.g. ["2022", "2023"] */
	taxYears: string[];
	/** Type of lien (property_tax | water_sewer | both | unknown) */
	lienType: 'property_tax' | 'water_sewer' | 'both' | 'unknown';

	/**
	 * Disposition status of the most recent lien record.
	 * 'sold'       — lien sold to a third-party purchaser (highest risk)
	 * 'active'     — lien is in active collection by the city
	 * 'discharged' — lien has been paid/settled
	 * 'unknown'    — disposition field not available
	 */
	disposition: 'sold' | 'active' | 'discharged' | 'unknown';

	/**
	 * Age of the most recent lien in years (from sale/listing date).
	 * Older liens may be discharged but not yet removed from the dataset.
	 */
	lienAgeYears: number;

	/** Human-readable context for Business Case display */
	contextMessage: string;

	/** Source metadata */
	source: 'dof_tax_lien';
	fetchedAt: string;
}

/** Raw row from DOF Tax Lien Sales Socrata endpoint */
interface LienRow {
	bbl?: string;
	bbl_formatted?: string;
	tax_year?: string;
	lien_years?: string;
	open_lien_count?: string;
	total_lien_amount?: string;
	building_class?: string;
	owner_name?: string;
	sale_date?: string;
	disposition?: string;
	lien_type?: string;        // 'PROP' | 'WS' etc. (if present)
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Fetch full tax lien detail for a BBL.
 * Returns a TaxLienRecord with severity=NONE if no lien found.
 * Never throws — returns null only on hard network failure.
 *
 * @param bbl  Borough-Block-Lot (10-digit, e.g. "1001860030")
 */
export async function fetchTaxLienDetail(bbl: string, signal?: AbortSignal): Promise<TaxLienRecord | null> {
	if (!bbl || bbl.length < 6) return null;

	const cacheKey = `dof_lien:${bbl}`;
	const cached = await intelCache.getAsync<TaxLienRecord>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		const { socrataFetch } = await import('./socrata-fetch');
		const appToken = env.NYC_OPEN_DATA_TOKEN;

		// Fetch all lien records for this BBL (there may be multiple years)
		const q = `?bbl=${bbl}&$limit=10&$order=sale_date DESC`;
		const rows = await socrataFetch<LienRow[]>(
			`${DOF_TAX_LIEN_EP}${q}`,
			'DOF-LIEN-DETAIL',
			appToken ? { timeout: 8000 } : undefined
		);

		const record = buildLienRecord(bbl, rows ?? []);
		intelCache.set(cacheKey, record, TTL_LIEN_MS);
		return record;

	} catch (err) {
		console.error('[DOF-Lien] Fetch error for BBL', bbl, err);
		return cached?.data ?? null;
	}
}

// ─── Builder ─────────────────────────────────────────────────────────────────

function buildLienRecord(bbl: string, rows: LienRow[]): TaxLienRecord {
	const now = Date.now();
	const fetchedAt = new Date().toISOString();

	if (rows.length === 0) {
		return {
			bbl,
			hasLien: false,
			severity: 'NONE',
			totalAmount: 0,
			lienCount: 0,
			taxYears: [],
			lienType: 'unknown',
			disposition: 'unknown',
			lienAgeYears: 0,
			contextMessage: 'No tax liens found for this property.',
			source: 'dof_tax_lien',
			fetchedAt,
		};
	}

	// Aggregate totals
	const totalAmount = rows.reduce((sum, r) => {
		return sum + (parseFloat(r.total_lien_amount ?? '0') || 0);
	}, 0);

	// Collect tax years (from lien_years or tax_year fields)
	const taxYears: string[] = [];
	for (const r of rows) {
		const yr = r.lien_years ?? r.tax_year;
		if (yr) {
			// lien_years may be a range like "2021-2023" or a single year
			for (const y of yr.split(/[-,\s]+/).filter(Boolean)) {
				if (y.match(/^\d{4}$/) && !taxYears.includes(y)) taxYears.push(y);
			}
		}
	}
	taxYears.sort();

	// Lien type detection from building_class or lien_type fields
	const lienTypeRaw = rows[0]?.lien_type?.toUpperCase() ?? '';
	let lienType: TaxLienRecord['lienType'];
	if (lienTypeRaw === 'WS') lienType = 'water_sewer';
	else if (lienTypeRaw === 'PROP') lienType = 'property_tax';
	else if (rows.some(r => r.lien_type?.toUpperCase() === 'WS') && rows.some(r => r.lien_type?.toUpperCase() === 'PROP')) {
		lienType = 'both';
	} else {
		// Heuristic: if no explicit type, treat as property_tax (more common in this dataset)
		lienType = totalAmount > 5000 ? 'property_tax' : 'water_sewer';
	}

	// Disposition from most recent row
	const dispositionRaw = rows[0]?.disposition?.toLowerCase() ?? '';
	let disposition: TaxLienRecord['disposition'];
	if (dispositionRaw.includes('sold') || dispositionRaw.includes('purchase')) disposition = 'sold';
	else if (dispositionRaw.includes('discharg') || dispositionRaw.includes('paid') || dispositionRaw.includes('satisfi')) disposition = 'discharged';
	else if (dispositionRaw.length > 0) disposition = 'active';
	else disposition = 'unknown';

	// Lien age in years from sale_date of most recent row
	let lienAgeYears = 0;
	const saleDateStr = rows[0]?.sale_date;
	if (saleDateStr) {
		const saleMs = new Date(saleDateStr).getTime();
		if (!isNaN(saleMs)) {
			lienAgeYears = Math.round(((now - saleMs) / (365.25 * 24 * 3600 * 1000)) * 10) / 10;
		}
	}

	// Severity classification
	const severity = classifySeverity(totalAmount, disposition, lienAgeYears);

	return {
		bbl,
		hasLien: true,
		severity,
		totalAmount: Math.round(totalAmount),
		lienCount: rows.length,
		taxYears,
		lienType,
		disposition,
		lienAgeYears,
		contextMessage: buildContextMessage(severity, totalAmount, lienType, disposition, lienAgeYears),
		source: 'dof_tax_lien',
		fetchedAt,
	};
}

// ─── Severity logic ───────────────────────────────────────────────────────────

function classifySeverity(
	totalAmount: number,
	disposition: TaxLienRecord['disposition'],
	lienAgeYears: number
): LienSeverity {
	// Discharged liens are historical — don't penalize if resolved
	if (disposition === 'discharged') return 'NONE';

	// Lien sold to third party = highest risk (forced sale may follow)
	if (disposition === 'sold') return 'CRITICAL';

	// Active lien — classify by amount
	if (totalAmount === 0) return 'NONE';          // data gap — treat as no lien
	if (totalAmount < 10_000) return 'MINOR';      // water/sewer arrears, often curable
	if (totalAmount < 100_000) return 'MODERATE';  // multiple years of tax arrears
	return 'SEVERE';                               // >$100K — significant default risk
}

// ─── Context messaging ────────────────────────────────────────────────────────

function buildContextMessage(
	severity: LienSeverity,
	totalAmount: number,
	lienType: TaxLienRecord['lienType'],
	disposition: TaxLienRecord['disposition'],
	lienAgeYears: number
): string {
	const amtStr = totalAmount > 0 ? `$${totalAmount.toLocaleString()}` : 'an undisclosed amount';
	const typeStr = lienType === 'water_sewer' ? 'water/sewer'
		: lienType === 'property_tax' ? 'property tax'
		: lienType === 'both' ? 'property tax and water/sewer'
		: 'tax';
	const ageStr = lienAgeYears > 0 ? ` (${lienAgeYears.toFixed(1)} years ago)` : '';

	switch (severity) {
		case 'NONE':
			return 'No active tax liens found for this property.';

		case 'MINOR':
			return `Minor ${typeStr} lien of ${amtStr}${ageStr}. Small ${lienType === 'water_sewer' ? 'water/sewer' : 'tax'} arrears — common and typically curable before lease signing.`;

		case 'MODERATE':
			return `Moderate ${typeStr} lien of ${amtStr}${ageStr}. Multiple years of tax arrears. Verify lien status before signing — ask landlord for proof of payment or active resolution plan.`;

		case 'SEVERE':
			return `SEVERE ${typeStr} lien of ${amtStr}${ageStr}. Significant default risk. The building may be at risk of forced sale if unresolved. Consult a real estate attorney before signing any lease.`;

		case 'CRITICAL':
			return `CRITICAL: Tax lien of ${amtStr} has been sold to a third-party purchaser${ageStr}. The purchaser can foreclose if taxes remain unpaid. Building ownership is at immediate risk. Do not sign a lease without legal review.`;
	}
}

// ─── Business Case helpers ───────────────────────────────────────────────────

/**
 * Return a CoPilot-ready narrative snippet for the tax lien situation.
 * Returns empty string if no lien (callers should filter before inserting).
 */
export function buildLienCopilotSnippet(lien: TaxLienRecord | null): string {
	if (!lien || !lien.hasLien || lien.severity === 'NONE') return '';
	return lien.contextMessage;
}

/**
 * True if the lien severity warrants blocking or hard-capping the Location IQ score.
 * CRITICAL and SEVERE liens should trigger a building risk cap.
 * Wire into location-iq.ts building risk rules post-launch (requires sign-off).
 */
export function isLienRiskBlocking(lien: TaxLienRecord | null): boolean {
	if (!lien) return false;
	return lien.severity === 'CRITICAL' || lien.severity === 'SEVERE';
}
