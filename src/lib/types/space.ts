// ──────────────────────────────────────────────
// Space Einstein / Site IQ — Data Schema
// ──────────────────────────────────────────────

export type DocumentType = 'brochure' | 'lease' | 'floorplan' | 'photo';
export type BuildingClass = 'A' | 'B' | 'C';
export type ExistingCondition = 'raw' | 'partial_other' | 'partial_same' | 'turnkey';
export type GreaseTrapStatus = 'exists' | 'required' | 'not_needed';
export type LeaseType = 'NNN' | 'gross' | 'modified_gross';
export type EscalationType = 'fixed' | 'CPI' | 'stepped';
export type NegotiationPriority = 'high' | 'medium' | 'low';

export interface UploadedDocument {
	id: string;
	type: DocumentType;
	filename: string;
	/** base64 data URI (localStorage) or blob URL */
	dataUrl: string;
	parsedData: Record<string, unknown>;
	confidence: Record<string, number>;
	uploadedAt: string;
}

export interface SpaceDetails {
	address: string;
	neighborhood: string;
	squareFeet: number;
	usableSquareFeet: number;
	floor: string;
	ceilingHeight: number;
	frontageWidth: number;
	buildingClass: BuildingClass;
	yearBuilt: number;
	existingCondition: ExistingCondition;
	previousTenant: string | null;
	previousTenantType: string | null;
	greaseTrap: GreaseTrapStatus;
}

export interface LeaseTerms {
	baseRent: { monthly: number; annual: number; perSqFt: number };
	escalation: { type: EscalationType; rate: number; schedule: string };
	tiAllowance: { perSqFt: number; total: number; conditions: string };
	personalGuarantee: { months: number; burndown: boolean; burndownSchedule: string };
	leaseTerm: { years: number; startDate: string; endDate: string };
	renewalOptions: { count: number; termYears: number; rentAdjustment: string };
	exclusivity: { radius: string; category: string; enforceability: string };
	assignment: { allowed: boolean; conditions: string; landlordConsent: string };
	sublease: { allowed: boolean; conditions: string };
	camCharges: { monthly: number; annual: number; included: string[] };
	buildoutPeriod: { months: number; rentFree: boolean; rentFreeMonths: number };
	penalties: { latePayment: string; earlyTermination: string };
	signage: { allowed: boolean; restrictions: string };
	hoursRestriction: string | null;
	redFlags: string[];
	favorabilityScore: number;
}

export interface BuildoutLineItem {
	category: string;
	cost: number;
}

export interface BuildoutEstimate {
	lineItems: BuildoutLineItem[];
	subtotal: number;
	contingency: number;
	grandTotal: number;
	timelineWeeks: number;
	neighborhoodMultiplier: number;
	conditionMultiplier: number;
	greaseTrapCost: number;
}

export interface NegotiationCard {
	issue: string;
	ask: string;
	justification: string;
	leverage: string[];
	fallback: string;
	priority: NegotiationPriority;
	financialImpact: number;
}

export interface FitScoreGap {
	component: string;
	score: number;
	explanation: string;
	fix: string;
}

export interface FitScore {
	overall: number;
	physical: number;
	financial: number;
	risk: number;
	gaps: FitScoreGap[];
}

export type SpaceTab = 'overview' | 'physical' | 'lease' | 'buildout' | 'negotiation' | 'fit';

export interface SpaceAnalysis {
	id: string;
	createdAt: string;
	updatedAt: string;
	documents: UploadedDocument[];
	space: SpaceDetails;
	lease: LeaseTerms;
	buildout: BuildoutEstimate;
	negotiation: { cards: NegotiationCard[] };
	fitScore: FitScore;
}

/** Default empty space details for form initialization.
 *  Numeric fields default to null so HTML inputs show placeholders instead of "0". */
export function emptySpaceDetails(): SpaceDetails {
	return {
		address: '',
		neighborhood: '',
		squareFeet: null as unknown as number,
		usableSquareFeet: null as unknown as number,
		floor: 'Ground',
		ceilingHeight: null as unknown as number,
		frontageWidth: null as unknown as number,
		buildingClass: 'B',
		yearBuilt: null as unknown as number,
		existingCondition: 'raw',
		previousTenant: null,
		previousTenantType: null,
		greaseTrap: 'required'
	};
}

/** Default empty lease terms for form initialization.
 *  Numeric fields default to null so HTML inputs show placeholders instead of "0". */
export function emptyLeaseTerms(): LeaseTerms {
	return {
		baseRent: { monthly: null as unknown as number, annual: null as unknown as number, perSqFt: null as unknown as number },
		escalation: { type: 'fixed', rate: null as unknown as number, schedule: '' },
		tiAllowance: { perSqFt: null as unknown as number, total: null as unknown as number, conditions: '' },
		personalGuarantee: { months: null as unknown as number, burndown: false, burndownSchedule: '' },
		leaseTerm: { years: null as unknown as number, startDate: '', endDate: '' },
		renewalOptions: { count: 1, termYears: 5, rentAdjustment: '' },
		exclusivity: { radius: '', category: '', enforceability: '' },
		assignment: { allowed: false, conditions: '', landlordConsent: '' },
		sublease: { allowed: false, conditions: '' },
		camCharges: { monthly: null as unknown as number, annual: null as unknown as number, included: [] },
		buildoutPeriod: { months: 0, rentFree: false, rentFreeMonths: null as unknown as number },
		penalties: { latePayment: '', earlyTermination: '' },
		signage: { allowed: true, restrictions: '' },
		hoursRestriction: null,
		redFlags: [],
		favorabilityScore: 0
	};
}
