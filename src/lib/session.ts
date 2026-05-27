/**
 * ═══════════════════════════════════════════════════════
 * RE² Session Intelligence — Unified Session Model
 * ═══════════════════════════════════════════════════════
 *
 * Single context object that accumulates throughout the session.
 * Every AI call receives the FULL session context so that
 * coaching, verdict, business model, and playbook are coherent.
 *
 * Persistence: localStorage L1 + Supabase L2 write-through
 */

import type { IndexName } from '$lib/intel/six-index';
import { syncToSupabase, loadFromSupabase } from '$lib/supabase-sync';
import { tierFor } from '$lib/intel/tiers';
import { bumpVersion } from '$lib/state-bridge';

// ── Core Types ──

export interface HeadsUpCard {
	icon: string;
	title: string;
	description: string;
	severity: 'critical' | 'important' | 'info';
}

export interface PlaybookStep {
	number: number;
	title: string;
	explanation: string;
	icon?: string;
}

export interface CoachingMessage {
	screen: string;
	prompt: string;
	response: string;
	timestamp: number;
}

export interface InfluenceFactor {
	label: string;
	impact: number;       // percentage points (positive = up, negative = down)
	explanation: string;
}

export interface BusinessModel {
	// Core
	successProbability: number;  // 15-95 range, never 0 or 100
	verdict: 'strong' | 'promising' | 'risky';
	narrative: string;           // AI-generated ESPN-style paragraph

	// Influence factors
	positiveFactors: InfluenceFactor[];
	negativeFactors: InfluenceFactor[];

	// Financials (ranges, not point estimates)
	financials: {
		monthlyRevenue: [number, number];
		monthlyRent: number;
		rentToRevenueRatio: [number, number];
		breakEvenMonths: [number, number];
		buildoutCost: [number, number];
	};

	// Interactive slider defaults
	sliderDefaults: {
		dailyCustomers: { min: number; default: number; max: number };
		avgTicket: { min: number; default: number; max: number };
	};

	// Risk narrative
	riskNarrative: string;

	// Assumptions & disclaimer
	assumptions: string[];
	disclaimer: string;
}

// ── The Unified Session ──

export interface RE2Session {
	// Session metadata
	sessionId: string;
	createdAt: number;
	updatedAt: number;

	// Identity (from onboarding)
	personaType: string;
	personaKey: string;
	conceptDescription: string;

	// From onboarding questions (Screen 3)
	answers: Record<string, {
		selected: string;
		scoringHint: Partial<Record<IndexName, number>>;
	}>;

	// Smart defaults (Screen 4)
	smartDefaults: {
		dailyRevenue: [number, number];
		avgTicket: number;
		dailyCustomers: [number, number];
		idealSqft: [number, number];
		maxHealthyRent: number;
		confirmed: boolean;  // did the founder confirm or adjust?
		adjustments?: Record<string, number>;
	} | null;

	// AI coaching history
	coachingThread: CoachingMessage[];

	// From scoring
	locationData: {
		address: string;
		lat: number;
		lng: number;
		sixIndices: Record<string, number>;
		compositeScore: number;
		rawApiSummary: Record<string, unknown>;
	} | null;

	// Generated insights
	headsUpCards: HeadsUpCard[];
	verdict: string;
	businessModel: BusinessModel | null;
	playbook: PlaybookStep[];

	// Comparison data
	comparisonLocations: Array<{
		address: string;
		compositeScore: number;
		sixIndices: Record<string, number>;
	}>;
}

// ── Session Helpers ──

const SESSION_KEY = 're2_session';

export function createSession(): RE2Session {
	return {
		sessionId: generateSessionId(),
		createdAt: Date.now(),
		updatedAt: Date.now(),
		personaType: '',
		personaKey: '',
		conceptDescription: '',
		answers: {},
		smartDefaults: null,
		coachingThread: [],
		locationData: null,
		headsUpCards: [],
		verdict: '',
		businessModel: null,
		playbook: [],
		comparisonLocations: []
	};
}

export function loadSession(): RE2Session {
	if (typeof window === 'undefined') return createSession();
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as RE2Session;
			return parsed;
		}
	} catch {
		// corrupt data — start fresh
	}

	// L1 miss — kick off async L2 hydration (won't block this call)
	hydrateSessionFromL2().catch(() => {});

	return createSession();
}

/**
 * Async hydration from Supabase L2 when localStorage is empty.
 * Writes into localStorage so subsequent loadSession() calls are fast.
 */
async function hydrateSessionFromL2(): Promise<boolean> {
	try {
		const remote = await loadFromSupabase();
		if (remote?.session) {
			const sessionData = remote.session as RE2Session;
			if (sessionData.sessionId) {
				localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
				return true;
			}
		}
	} catch {
		// Supabase unavailable — proceed with empty session
	}
	return false;
}

export function saveSession(session: RE2Session): void {
	if (typeof window === 'undefined') return;
	session.updatedAt = Date.now();
	try {
		// L1: localStorage (instant)
		localStorage.setItem(SESSION_KEY, JSON.stringify(session));
		// Signal cross-tab state change
		bumpVersion();
	} catch {
		// storage full — best effort
	}
	// L2: Supabase write-through (async, debounced, fire-and-forget)
	syncToSupabase({ session });
}

export function clearSession(): void {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(SESSION_KEY);
	bumpVersion();
	// Clear L2 session data
	syncToSupabase({ session: null });
}

/**
 * Merge partial updates into a session (immutable pattern)
 */
export function updateSession(session: RE2Session, updates: Partial<RE2Session>): RE2Session {
	return { ...session, ...updates, updatedAt: Date.now() };
}

/**
 * Add a coaching message to the thread
 */
export function addCoachingMessage(
	session: RE2Session,
	screen: string,
	prompt: string,
	response: string
): RE2Session {
	return {
		...session,
		coachingThread: [
			...session.coachingThread,
			{ screen, prompt, response, timestamp: Date.now() }
		],
		updatedAt: Date.now()
	};
}

/**
 * Get a summarized version of the session for AI context
 * (avoids sending the full rawApiSummary which can be huge)
 */
export function getSessionContextForAI(session: RE2Session): Record<string, unknown> {
	return {
		personaType: session.personaType,
		personaKey: session.personaKey,
		conceptDescription: session.conceptDescription,
		answers: session.answers,
		smartDefaults: session.smartDefaults,
		coachingHistory: session.coachingThread.map(m => ({
			screen: m.screen,
			response: m.response.slice(0, 200) // truncate for token economy
		})),
		location: session.locationData ? {
			address: session.locationData.address,
			sixIndices: session.locationData.sixIndices,
			compositeScore: session.locationData.compositeScore
		} : null,
		headsUpCards: session.headsUpCards.map(c => ({
			title: c.title,
			severity: c.severity
		})),
		verdict: session.verdict,
		businessModel: session.businessModel ? {
			successProbability: session.businessModel.successProbability,
			verdict: session.businessModel.verdict,
			positiveFactors: session.businessModel.positiveFactors.map(f => f.label),
			negativeFactors: session.businessModel.negativeFactors.map(f => f.label),
			financials: session.businessModel.financials
		} : null
	};
}

// ── Request types for /api/session-intelligence ──

export type IntelligenceRequestType =
	| 'coaching'
	| 'conceptAnalysis'
	| 'smartDefaults'
	| 'verdict'
	| 'businessModel'
	| 'playbook'
	| 'riskNarrative'
	| 'comparison';

export interface IntelligenceRequest {
	requestType: IntelligenceRequestType;
	session: RE2Session;
	extra?: Record<string, unknown>;
}

export interface IntelligenceResponse {
	requestType: IntelligenceRequestType;
	result: unknown;
	cached: boolean;
}

// ── Utility ──

function generateSessionId(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = 're2_';
	for (let i = 0; i < 12; i++) {
		id += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return id;
}

/**
 * Score color helper — traffic light system
 */
export function scoreColor(score: number): string {
	const c = tierFor(score, 'lens').color;
	return c === 'green' ? '#10B981' : c === 'amber' ? '#F97316' : c === 'red' ? '#EF4444' : '#94A3B8';
}

/**
 * Score verdict text
 */
// FIX-025: BR-1 unified verdict vocabulary
// EF-4 (April 11): delegate to canonical tierFor.
export function scoreVerdict(score: number): string {
	return tierFor(score, 'fitIQ').label;
}

/**
 * Business model verdict
 */
export function probabilityVerdict(probability: number): 'strong' | 'promising' | 'risky' {
	if (probability >= 75) return 'strong';
	if (probability >= 50) return 'promising';
	return 'risky';
}

export function probabilityLabel(verdict: 'strong' | 'promising' | 'risky'): string {
	switch (verdict) {
		case 'strong': return 'Strong Outlook';
		case 'promising': return 'Promising, With Work';
		case 'risky': return 'High Risk — Here\'s Why';
	}
}
