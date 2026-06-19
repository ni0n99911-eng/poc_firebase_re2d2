/**
 * Launch Pad persistent store — uses localStorage as L1 cache with Cloud SQL write-through.
 *
 * Architecture:
 * - L1 (localStorage): Fast reads, no auth needed, instant access
 * - L2 (Cloud SQL): Persistent, synced across devices
 *
 * Writing: localStorage immediately, then Cloud SQL async (fire-and-forget)
 * Reading: localStorage first, fallback to Cloud SQL if empty, fallback to defaults
 *
 * Session ID: Generated once, stored in localStorage. If user authenticates (Clerk),
 * use their user_id instead. This enables anon users without auth.
 */

import { bumpVersion } from './state-bridge';

const STORAGE_KEY = 're2_launchpad';
const SESSION_ID_KEY = 're2_session_id';

/**
 * Get or create a session ID for anon users.
 * If Clerk user is authenticated, this becomes their user_id.
 */
function getOrCreateSessionId(): string {
	if (typeof window === 'undefined') return '';
	const existing = localStorage.getItem(SESSION_ID_KEY);
	if (existing) return existing;
	const newId = `anon_${Date.now()}_${Math.random().toString(36).substring(7)}`;
	localStorage.setItem(SESSION_ID_KEY, newId);
	return newId;
}

export interface FounderProfile {
	motivation: string;         // legacy | passion | sideincome | investment | community
	ownerType: string;          // fulltime | parttime | absentee | partnership
	riskTolerance: string;      // conservative | moderate | aggressive
	experience: string;         // firsttime | other-industry | experienced | serial
	yearOneGoals: {
		revenueTarget: number;
		personalIncomeTarget: number;
		employeeCount: number;
		locationCount: number;
	};
}

export interface CreditProfile {
	scoreRange: string;         // excellent | good | fair | building | unknown
	bankruptcy: boolean;
	latePayments: boolean;
	collections: boolean;
	existingDebt: string;       // yes | no | na
}

export interface LaunchPadData {
	// Founder Profile (Module 1)
	founderProfile: FounderProfile;

	// Credit Profile (Module 2)
	creditProfile: CreditProfile;

	// Business Identity
	businessType: string;
	businessSubType: string;     // Restaurant subtype: full_service | fast_casual | quick_service | cafe_bakery
	priceLevel: string;          // Price positioning: 1 ($) | 2 ($$) | 3 ($$$) | 4 ($$$$)
	businessName: string;
	visionStatement: string;
	differentiator: string;
	businessFormat: string;      // kiosk | cafe | fast-casual | full-service | ghost-kitchen | food-truck

	// Financial Goals
	financialGoals: {
		targetSDE: number;
		revenueY1: number;
		revenueY3: number;
		dailyTransactions: number;
		avgTicket: number;
		numberOfLocations: number;
		startupCapital: number;
		personalInvestment: number;
		emergencyReserveMonths: number;
		monthlyRentBudget: number;
		buildoutBudget: number;
		teamSize: number;
		squareFootage: number;
		liquidCapital: number;
		monthlyPersonalExpenses: number;
		externalFunding: number;
	};

	// Alignment Engine Weights
	weights: Record<string, number>;

	// Location Preferences
	idealArea: string;
	preferredNeighborhoods: string;

	// Sacred/Flexible
	sacred: Record<string, boolean>;
	flexible: Record<string, boolean>;

	// Launch Pack progress
	launchPackProgress: Record<string, string>; // taskId → 'not_started' | 'in_progress' | 'complete'

	// MCONCEPT-01-B: Array of concept profiles — one per concept the user has explored
	conceptProfiles: Array<{
		conceptKey: string;       // canonical concept type (e.g. 'specialty_coffee')
		businessType: string;
		businessSubType: string;
		priceLevel: string;
		differentiator: string;
		visionStatement: string;
		businessFormat: string;
		createdAt: number;
	}>;

	// Timestamp
	lastSaved: number;
}

const DEFAULTS: LaunchPadData = {
	founderProfile: {
		motivation: '',
		ownerType: '',
		riskTolerance: '',
		experience: '',
		yearOneGoals: {
			revenueTarget: 0,
			personalIncomeTarget: 0,
			employeeCount: 0,
			locationCount: 1
		}
	},
	creditProfile: {
		scoreRange: '',
		bankruptcy: false,
		latePayments: false,
		collections: false,
		existingDebt: ''
	},
	businessType: '',
	businessSubType: '',
	priceLevel: '',
	businessName: '',
	visionStatement: '',
	differentiator: '',
	businessFormat: '',
	financialGoals: {
		targetSDE: 0,
		revenueY1: 0,
		revenueY3: 0,
		dailyTransactions: 0,
		avgTicket: 0,
		numberOfLocations: 1,
		startupCapital: 0,
		personalInvestment: 0,
		emergencyReserveMonths: 0,
		monthlyRentBudget: 0,
		buildoutBudget: 0,
		teamSize: 0,
		squareFootage: 0,
		liquidCapital: 0,
		monthlyPersonalExpenses: 0,
		externalFunding: 0
	},
	weights: {
		l0_macro: 10,
		l1_city: 15,
		l2_block: 18,
		l3_planfit: 18,
		l4_talent: 10,
		l5_resilience: 10,
		l6_zoning: 7,
		l7_feel: 12
	},
	idealArea: '',
	preferredNeighborhoods: '',
	sacred: {},
	flexible: {},
	launchPackProgress: {},
	conceptProfiles: [],
	lastSaved: 0
};

export function loadLaunchPadData(): LaunchPadData {
	if (typeof window === 'undefined') return { ...DEFAULTS };
	try {
		// Try L1 cache (localStorage)
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return mergeWithDefaults(parsed);
		}

		// L1 miss — try L2 (Cloud SQL) in background when authenticated
		// This is async, so we return defaults immediately but start the fetch
		loadFromCloudSQL().catch((err) => {
			console.debug('[Launchpad] Cloud SQL load failed:', err);
		});

		return { ...DEFAULTS };
	} catch {
		return { ...DEFAULTS };
	}
}

/**
 * Merge loaded data with defaults to fill in any missing fields.
 */
function mergeWithDefaults(parsed: any): LaunchPadData {
	return {
		...DEFAULTS,
		...parsed,
		founderProfile: {
			...DEFAULTS.founderProfile,
			...parsed.founderProfile,
			yearOneGoals: {
				...DEFAULTS.founderProfile.yearOneGoals,
				...(parsed.founderProfile?.yearOneGoals || {})
			}
		},
		creditProfile: { ...DEFAULTS.creditProfile, ...parsed.creditProfile },
		financialGoals: { ...DEFAULTS.financialGoals, ...parsed.financialGoals },
		launchPackProgress: { ...DEFAULTS.launchPackProgress, ...parsed.launchPackProgress },
		conceptProfiles: parsed.conceptProfiles || [],
	};
}

/**
 * Load launchpad data from Cloud SQL (L2) and populate localStorage if found.
 * Called async from loadLaunchPadData() to avoid blocking the initial render.
 * Only syncs if the user is authenticated (session-sync returns noop otherwise).
 */
async function loadFromCloudSQL(): Promise<void> {
	if (typeof window === 'undefined') return;

	try {
		const res = await fetch('/api/session-sync');
		if (!res.ok) return;
		const json = await res.json();
		if (!json.found || !json.data) return;
		
		const launchpadData = (json.data.launchpad || {}) as LaunchPadData & { scoredLocations?: unknown[] };
		const remoteLocations = json.shortlistedLocations || null;

		// Prefer shortlisted_locations (M015 column) as the canonical scored-locations source
		if (remoteLocations && !launchpadData.scoredLocations?.length) {
			launchpadData.scoredLocations = remoteLocations;
		}

		// Nothing worth hydrating
		if (!Object.keys(launchpadData).length) return;

		try {
			const localData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as LaunchPadData;
			if (!localData.lastSaved || (launchpadData.lastSaved && launchpadData.lastSaved > localData.lastSaved)) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(launchpadData));
			} else if (remoteLocations) {
				const lp = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as LaunchPadData & { scoredLocations?: unknown[] };
				if (!lp.scoredLocations?.length) {
					lp.scoredLocations = remoteLocations;
					localStorage.setItem(STORAGE_KEY, JSON.stringify(lp));
				}
			}
		} catch {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(launchpadData));
		}
	} catch (err) {
		console.debug('[Launchpad] Cloud SQL load error:', err);
	}
}

export function saveLaunchPadData(data: Partial<LaunchPadData>): void {
	if (typeof window === 'undefined') return;
	try {
		const existing = loadLaunchPadData();

		// MCONCEPT-01-B: If businessType is changing, archive the outgoing concept
		if (data.businessType && existing.businessType
			&& data.businessType !== existing.businessType
			&& existing.businessType !== '') {
			const profiles = [...(existing.conceptProfiles || [])];
			// Don't duplicate if already archived
			if (!profiles.some(p => p.conceptKey === existing.businessType)) {
				profiles.push({
					conceptKey: existing.businessType,
					businessType: existing.businessType,
					businessSubType: existing.businessSubType,
					priceLevel: existing.priceLevel,
					differentiator: existing.differentiator,
					visionStatement: existing.visionStatement,
					businessFormat: existing.businessFormat,
					createdAt: existing.lastSaved || Date.now(),
				});
			}
			data = { ...data, conceptProfiles: profiles };
		}

		const merged = { ...existing, ...data, lastSaved: Date.now() };
		localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
		// Signal cross-tab state change
		bumpVersion();

		// Write-through to Cloud SQL (async, fire-and-forget)
		// This doesn't block the save, and gracefully handles cases where the user isn't logged in
		syncToCloudSQL(merged).catch((err) => {
			// Silently log — localStorage is the source of truth
			console.debug('[Launchpad] Cloud SQL sync failed:', err);
		});
	} catch (e) {
		console.error('Failed to save Launch Pad data:', e);
	}
}

/**
 * Sync localStorage data to Cloud SQL via /api/session-sync.
 * Handles both authenticated (Firebase) and anonymous users.
 * Anonymous users get a graceful 200 no-op — no error thrown.
 */
async function syncToCloudSQL(data: LaunchPadData): Promise<void> {
	if (typeof window === 'undefined') return;
	try {
		await fetch('/api/session-sync', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ launchpad: data, shortlistedLocations: (data as any).scoredLocations || undefined })
		});
	} catch (err) {
		console.debug('[Launchpad] API sync error:', err);
	}
}

export function getLaunchPadDefaults(): LaunchPadData {
	return { ...DEFAULTS };
}

/**
 * Check whether the user has completed their founder profile.
 * Returns true if they've filled in at least motivation (from the Profile page).
 * businessName/businessType come from the Concept page — checked separately.
 */
export function hasFounderProfile(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		// Check launchpad data first
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed.founderProfile?.motivation) return true;
		}
		// Fallback: check re2_session (set by onboarding chatbot)
		const sessionRaw = localStorage.getItem('re2_session');
		if (sessionRaw) {
			const session = JSON.parse(sessionRaw);
			if (session.personaType || session.bizType || session.budgetRange) return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Check whether the user has entered their business concept/goals.
 * Returns true if they've filled in at least a differentiator/vision OR business type.
 * Financial goals are optional — first-time founders often don't know these numbers.
 */
export function hasBusinessConcept(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		// Check launchpad data first
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed.businessType && (parsed.visionStatement || parsed.differentiator)) return true;
		}
		// Fallback: check re2_session (set by onboarding chatbot)
		const sessionRaw = localStorage.getItem('re2_session');
		if (sessionRaw) {
			const session = JSON.parse(sessionRaw);
			if (session.personaType || session.bizType) return true;
		}
		return false;
	} catch {
		return false;
	}
}
