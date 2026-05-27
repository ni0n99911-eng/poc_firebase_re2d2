/**
 * Launch Pad persistent store — uses localStorage as L1 cache with Supabase write-through.
 *
 * Architecture:
 * - L1 (localStorage): Fast reads, no auth needed, instant access
 * - L2 (Supabase): Persistent, synced across devices
 *
 * Writing: localStorage immediately, then Supabase async (fire-and-forget)
 * Reading: localStorage first, fallback to Supabase if empty, fallback to defaults
 *
 * Session ID: Generated once, stored in localStorage. If user authenticates (Clerk),
 * use their user_id instead. This enables anon users without auth.
 */

import { getSupabase, getAuthedSupabase, getFreshAuthedSupabase } from './supabase';
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

		// L1 miss — try L2 cache (Supabase) in background
		// This is async, so we return defaults immediately but start the fetch
		loadFromSupabase().catch((err) => {
			console.debug('[Launchpad] Supabase load failed:', err);
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
 * Load data from Supabase and populate localStorage if found.
 * Called async from loadLaunchPadData() to avoid blocking the initial render.
 */
async function loadFromSupabase(): Promise<void> {
	if (typeof window === 'undefined') return;

	try {
		const supabase = getSupabase();
		const sessionId = getOrCreateSessionId();
		let userId: string | null = null;

		// Try to get Clerk user_id if available
		if (typeof window !== 'undefined' && (window as any).__clerkUserId) {
			userId = (window as any).__clerkUserId;
		}

		// FIX-006: Select both full_data AND shortlisted_locations (M015 column).
		// Session-autosave writes scored locations to shortlisted_locations (the structured column),
		// while this path historically wrote to full_data.scoredLocations. Read both so cross-device
		// sync works regardless of which write path was used on the source device.
		let query = supabase.from('founder_sessions').select('full_data, shortlisted_locations, updated_at');

		// Query by user_id (preferred) or session_id
		if (userId) {
			query = query.eq('user_id', userId);
		} else {
			query = query.eq('session_id', sessionId);
		}

		// BUG-FIX (2026-04-17): was .single() — returns 406 Not Acceptable when 0 rows
		// found (PostgREST contract: single() expects exactly 1 row). .maybeSingle()
		// returns null on 0 rows and never throws 406.
		const { data, error } = await query.maybeSingle();

		if (error) {
			// Table doesn't exist or row not found — both are okay
			if (error.code === '42P01' || error.code === 'PGRST116') {
				return;
			}
			throw error;
		}

		if (!data) {
			return;
		}

		// Found data in Supabase — only overwrite localStorage if Supabase is newer
		// FIX-02: Prevents Supabase from clobbering a mid-session launchpad change
		// FIX-006: If full_data is absent but shortlisted_locations has scored locations,
		//          inject them so the dashboard renders on a fresh device.
		const launchpadData = (data.full_data || {}) as LaunchPadData & { scoredLocations?: unknown[] };
		const remoteLocations = Array.isArray(data.shortlisted_locations) && data.shortlisted_locations.length > 0
			? data.shortlisted_locations
			: null;

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
				// Even if full_data is stale, always apply fresh shortlisted_locations
				// so scored locations show up cross-device regardless of launchpad sync age
				const lp = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as LaunchPadData & { scoredLocations?: unknown[] };
				if (!lp.scoredLocations?.length) {
					lp.scoredLocations = remoteLocations;
					localStorage.setItem(STORAGE_KEY, JSON.stringify(lp));
				}
			}
			// If local is newer, leave it — syncToSupabase will push on next save
		} catch {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(launchpadData));
		}
	} catch (err) {
		// Silently log — localStorage already has defaults
		console.debug('[Launchpad] Supabase load error:', err);
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

		// Write-through to Supabase (async, fire-and-forget)
		// This doesn't block the save, and gracefully handles Supabase unavailability
		syncToSupabase(merged).catch((err) => {
			// Silently log — localStorage is the source of truth
			console.debug('[Launchpad] Supabase sync failed:', err);
		});
	} catch (e) {
		console.error('Failed to save Launch Pad data:', e);
	}
}

/**
 * Sync localStorage data to Supabase `founder_sessions` table.
 * Handles both authenticated (Clerk) and anonymous users.
 */
async function syncToSupabase(data: LaunchPadData): Promise<void> {
	if (typeof window === 'undefined') return;

	try {
		const sessionId = getOrCreateSessionId();
		let userId: string | null = null;

		// Try to get Clerk user_id if available
		if (typeof window !== 'undefined' && (window as any).__clerkUserId) {
			userId = (window as any).__clerkUserId;
		}

		// B2-0.1: centralized fresh-JWT authed client helper. Clerk JWTs expire
		// in ~60s (template default); this helper calls getToken({skipCache:true})
		// and returns a cached per-token authed client (no duplicate GoTrueClient).
		const supabase = await getFreshAuthedSupabase();
		// Detect whether the returned client is the anon fallback (for a diagnostic
		// log after the upsert). getFreshAuthedSupabase returns getSupabase() on
		// no-Clerk / null-token paths; reference-equal check tells us which one.
		let authedWithFreshToken = supabase !== getSupabase();

		// FIX-SAVE-01: include location score fields in Supabase payload so server loads
		// (welcome-back, route) can read them without relying on localStorage.
		// Cast to any to access dynamic fields added by location page (scoredLocations,
		// lastAddress, lastScore, locationIQ, analyzedAddress).
		const dataAny = data as any;

		// Prepare the payload for founder_sessions table
		const payload = {
			user_id: userId,
			session_id: sessionId,
			persona_type: data.businessType || data.founderProfile?.motivation || null,
			concept_description: data.businessType ? `${data.businessType}: ${data.visionStatement || data.differentiator || ''}` : null,
			priority_ranking: JSON.stringify(data.weights || {}),
			address: dataAny.analyzedAddress || dataAny.lastAddress || data.idealArea || null,
			full_data: {
				// Spread the entire LaunchPadData for future reference
				...data,
				// FIX-SAVE-01: promote location score fields to top level of full_data so
				// welcome-back/+page.server.ts can read them directly from sessionData.*
				...(dataAny.locationIQ !== undefined && { locationIQ: dataAny.locationIQ }),
				...(dataAny.analyzedAddress !== undefined && { analyzedAddress: dataAny.analyzedAddress }),
				...(dataAny.lastScore !== undefined && { lastScore: dataAny.lastScore }),
				...(dataAny.lastAddress !== undefined && { lastAddress: dataAny.lastAddress }),
				...(dataAny.scoredLocations !== undefined && { scoredLocations: dataAny.scoredLocations }),
			}
		};

		// Upsert: insert if new session, update if existing
		const upsertRow = { ...payload, updated_at: new Date().toISOString() };
		const onConflict = userId ? 'user_id' : 'session_id';
		let { error } = await supabase
			.from('founder_sessions')
			.upsert(upsertRow, { onConflict });

		// D12: Retry once with a freshly-refreshed Clerk JWT on 401.
		// Happens when the token expired between refresh and upsert, or when we
		// fell back to the anon client but the table requires auth.
		if (error && ((error as any).status === 401 || (error as any).code === '401' || (error as any).code === 'PGRST301')) {
			console.warn('[Launchpad] 401 on first upsert — retrying with fresh JWT');
			try {
				const retryToken = (typeof window !== 'undefined') && (window as any).Clerk?.session
					? await (window as any).Clerk.session.getToken({ skipCache: true })
					: null;
				if (retryToken) {
					const retrySupabase = getAuthedSupabase(retryToken);
					const retry = await retrySupabase.from('founder_sessions').upsert(upsertRow, { onConflict });
					error = retry.error;
					if (!error) authedWithFreshToken = true;
				}
			} catch (retryErr) {
				console.warn('[Launchpad] 401 retry also failed:', retryErr);
			}
		}

		if (error) {
			// Table might not exist yet — that's okay
			if (error.code === '42P01') {
				console.debug('[Launchpad] founder_sessions table not yet created');
				return;
			}
			throw error;
		}
		if (!authedWithFreshToken && userId) {
			// We saved as anon, but a userId exists — row is owned by anon, not the user
			console.debug('[Launchpad] Upsert succeeded via anon client; row not linked to user_id');
		}
	} catch (err) {
		// Log but don't throw — localStorage is the source of truth
		console.debug('[Launchpad] Supabase sync error:', {
			message: (err as Error)?.message,
			code: (err as any)?.code,
			hint: (err as any)?.hint,
			details: (err as any)?.details,
			raw: err
		});
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
