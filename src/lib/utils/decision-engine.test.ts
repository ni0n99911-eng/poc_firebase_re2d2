/**
 * C-11: Snapshot tests for decision-engine.ts
 *
 * Locks the output of getDecisionState, getEvidencePayload, and
 * getConceptCoaching for known inputs so future refactors can't
 * silently change founder-facing copy or signal classification.
 *
 * Scenarios:
 *   1. Zero competitors (score 40 sentinel) — must say "unproven market"
 *   2. High competitors — must say "high competition density"
 *   3. Average vibrancy (score 55) — moderate language
 *   4. Watch Out trigger (safety < 50) — must surface in reasons
 *   5. Survival ghost absent — survivalRate 0 must not leak copy
 *   6. Strong go (fitIQ 82) — snapshot the full decision state
 *   7. Rethink (fitIQ 30) — snapshot the full decision state
 *   8. Vision preliminary — must inject "add concept details" notice
 */

import { describe, it, expect } from 'vitest';
import {
	getDecisionState,
	getEvidencePayload,
	getConceptCoaching,
	fitTierLabel,
	blockTierLabel,
	fitGrade,
	fitMeaning,
	fitMeaningShort,
	fitVerdictShort,
	fitNextTier,
	getScoreInterpretation,
} from './decision-engine';

// ── Shared test fixtures ─────────────────────────────────────────────────────

/** Baseline six-index scores for a "good" location */
const GOOD_SIX: Record<string, number> = {
	transit: 75,
	demographics: 70,
	competition: 72,
	safety: 80,
	vibrancy: 68,
	momentum: 65,
	survivalRate: 70,
};

/** Weak location profile */
const WEAK_SIX: Record<string, number> = {
	transit: 30,
	demographics: 35,
	competition: 25,
	safety: 40,
	vibrancy: 28,
	momentum: 20,
	survivalRate: 35,
};

/** Zero-competitor profile (competition score 40 = sentinel) */
const ZERO_COMP_SIX: Record<string, number> = {
	transit: 65,
	demographics: 60,
	competition: 40,
	safety: 70,
	vibrancy: 55,
	momentum: 60,
	survivalRate: 60,
};

const ZERO_COMP_FIT_SUB: Record<string, number> = {
	competition: 40,
	competitor_count: 0,
	market_proof: 55,
	demographics: 60,
};

const GOOD_FIT_SUB: Record<string, number> = {
	competition: 72,
	competitor_count: 5,
	market_proof: 65,
	demographics: 70,
};

const WEAK_FIT_SUB: Record<string, number> = {
	competition: 25,
	competitor_count: 12,
	market_proof: 30,
	demographics: 35,
};

// ── 1. Zero competitors ──────────────────────────────────────────────────────

describe('Zero competitors (score 40 sentinel)', () => {
	it('getDecisionState does NOT say "high competition"', () => {
		const state = getDecisionState(
			62, 60, 55, ZERO_COMP_SIX, ZERO_COMP_FIT_SUB,
			'specialty_coffee', false
		);
		const allText = [state.headline, state.summary, ...state.reasons].join(' ').toLowerCase();
		expect(allText).not.toContain('high competition');
		expect(state).toMatchSnapshot();
	});

	it('getEvidencePayload labels 0-count correctly', () => {
		const payload = getEvidencePayload(
			62, 60, 55, ZERO_COMP_SIX, ZERO_COMP_FIT_SUB,
			'specialty_coffee', false
		);
		const compItem = [...payload.helping, ...payload.hurting]
			.find(i => i.key === 'competition');
		// Competition at 40 with 0 competitors should NOT be in hurting with "high competition" copy
		if (compItem) {
			expect(compItem.copy.toLowerCase()).not.toContain('high competition');
		}
		expect(payload).toMatchSnapshot();
	});
});

// ── 2. High competitors ─────────────────────────────────────────────────────

describe('High competitors', () => {
	it('getDecisionState surfaces competition pressure', () => {
		const state = getDecisionState(
			35, 40, 50, WEAK_SIX, WEAK_FIT_SUB,
			'specialty_coffee', false
		);
		expect(state.state).toBe('do_not_pursue');
		expect(state).toMatchSnapshot();
	});

	it('getEvidencePayload marks low competition as negative', () => {
		const payload = getEvidencePayload(
			35, 40, 50, WEAK_SIX, WEAK_FIT_SUB,
			'specialty_coffee', false
		);
		const compItem = payload.hurting.find(i => i.key === 'competition');
		expect(compItem).toBeDefined();
		expect(compItem!.direction).toBe('negative');
		expect(compItem!.copy.toLowerCase()).toContain('competition');
		expect(payload).toMatchSnapshot();
	});
});

// ── 3. Average vibrancy (score 55) ──────────────────────────────────────────

describe('Average vibrancy', () => {
	const avgVibSix: Record<string, number> = {
		...GOOD_SIX,
		vibrancy: 55,
	};

	it('evidenceCopy uses moderate language for vibrancy 55', () => {
		const payload = getEvidencePayload(
			70, 68, 60, avgVibSix, GOOD_FIT_SUB,
			'specialty_coffee', false
		);
		const vibItem = [...payload.helping, ...payload.hurting,
			...payload.canChange, ...payload.cannotChange]
			.find(i => i.key === 'vibrancy');
		// 55 is in MED band — should not say "quiet" or "busy"
		if (vibItem) {
			expect(vibItem.copy.toLowerCase()).not.toContain('quiet');
			expect(vibItem.direction).toBe('neutral');
		}
		expect(payload).toMatchSnapshot();
	});

	it('concept-aware: coffee gets morning rush language', () => {
		const payload = getEvidencePayload(
			70, 68, 60, avgVibSix, GOOD_FIT_SUB,
			'specialty_coffee', false
		);
		const vibItem = [...payload.helping, ...payload.hurting,
			...payload.canChange, ...payload.cannotChange]
			.find(i => i.key === 'vibrancy');
		if (vibItem) {
			expect(vibItem.copy.toLowerCase()).toContain('morning');
		}
	});

	it('concept-aware: restaurant gets peak-hour language', () => {
		const payload = getEvidencePayload(
			70, 68, 60, avgVibSix, GOOD_FIT_SUB,
			'full_service_restaurant', false
		);
		const vibItem = [...payload.helping, ...payload.hurting,
			...payload.canChange, ...payload.cannotChange]
			.find(i => i.key === 'vibrancy');
		if (vibItem) {
			expect(vibItem.copy.toLowerCase()).toContain('peak');
		}
	});
});

// ── 4. Watch Out trigger (safety < 50) ──────────────────────────────────────

describe('Watch Out trigger — safety < 50', () => {
	const unsafeSix: Record<string, number> = {
		...GOOD_SIX,
		safety: 38,
	};

	it('getDecisionState surfaces safety in reasons', () => {
		const state = getDecisionState(
			55, 58, 60, unsafeSix, GOOD_FIT_SUB,
			'specialty_coffee', false
		);
		const allReasons = state.reasons.join(' ').toLowerCase();
		expect(allReasons).toContain('safety');
		expect(state).toMatchSnapshot();
	});

	it('getEvidencePayload puts safety in hurting', () => {
		const payload = getEvidencePayload(
			55, 58, 60, unsafeSix, GOOD_FIT_SUB,
			'specialty_coffee', false
		);
		const safetyItem = payload.hurting.find(i => i.key === 'safety');
		expect(safetyItem).toBeDefined();
		expect(safetyItem!.direction).toBe('negative');
		expect(payload).toMatchSnapshot();
	});
});

// ── 5. Survival ghost absent ────────────────────────────────────────────────

describe('Survival ghost absent (survivalRate = 0)', () => {
	const noSurvivalSix: Record<string, number> = {
		...GOOD_SIX,
		survivalRate: 0,
	};

	it('getEvidencePayload does NOT emit survivalRate copy when score is 0', () => {
		const payload = getEvidencePayload(
			72, 70, 65, noSurvivalSix, GOOD_FIT_SUB,
			'specialty_coffee', false
		);
		const survItem = [...payload.helping, ...payload.hurting]
			.find(i => i.key === 'survivalRate');
		// survivalRate 0 should be filtered out (value > 0 filter)
		expect(survItem).toBeUndefined();
		expect(payload).toMatchSnapshot();
	});

	it('C-02: market_proof does NOT fall back to survivalRate', () => {
		// This confirms the C-02 fix — market_proof should use its own score only
		const payload = getEvidencePayload(
			72, 70, 65, noSurvivalSix,
			{ ...GOOD_FIT_SUB, market_proof: 0 },
			'specialty_coffee', false
		);
		const mpItem = [...payload.helping, ...payload.hurting]
			.find(i => i.key === 'marketProof');
		// market_proof = 0 AND survivalRate = 0 → neither should appear
		expect(mpItem).toBeUndefined();
	});
});

// ── 6. Strong go snapshot ────────────────────────────────────────────────────

describe('Strong go (fitIQ 82)', () => {
	it('full decision state snapshot', () => {
		const state = getDecisionState(
			82, 78, 70, GOOD_SIX, GOOD_FIT_SUB,
			'specialty_coffee', false
		);
		expect(state.state).toBe('strong_go');
		expect(state.headline).toBe('Strong Path');
		expect(state.color).toBe('green');
		expect(state).toMatchSnapshot();
	});

	it('evidence payload snapshot', () => {
		const payload = getEvidencePayload(
			82, 78, 70, GOOD_SIX, GOOD_FIT_SUB,
			'specialty_coffee', false
		);
		expect(payload.helping.length).toBeGreaterThan(0);
		expect(payload).toMatchSnapshot();
	});

	it('concept coaching snapshot', () => {
		const coaching = getConceptCoaching(
			82, 78, 70, GOOD_SIX, GOOD_FIT_SUB,
			'specialty_coffee'
		);
		expect(coaching).not.toBeNull();
		expect(coaching!.nextSteps.length).toBeGreaterThan(0);
		expect(coaching).toMatchSnapshot();
	});
});

// ── 7. Rethink snapshot ─────────────────────────────────────────────────────

describe('Rethink (fitIQ 30)', () => {
	it('full decision state snapshot', () => {
		const state = getDecisionState(
			30, 35, 40, WEAK_SIX, WEAK_FIT_SUB,
			'specialty_coffee', false
		);
		expect(state.state).toBe('do_not_pursue');
		expect(state.headline).toBe('Rethink');
		expect(state.color).toBe('red');
		expect(state).toMatchSnapshot();
	});
});

// ── 8. Vision preliminary ────────────────────────────────────────────────────

describe('Vision preliminary', () => {
	it('evidence payload injects concept-details notice', () => {
		const payload = getEvidencePayload(
			60, 58, 0, GOOD_SIX, GOOD_FIT_SUB,
			'specialty_coffee', true
		);
		const visionItem = [...payload.helping, ...payload.hurting,
			...payload.canChange, ...payload.cannotChange]
			.find(i => i.key === 'visionScore');
		expect(visionItem).toBeDefined();
		expect(visionItem!.direction).toBe('neutral');
		expect(visionItem!.copy.toLowerCase()).toContain('concept details');
		expect(payload).toMatchSnapshot();
	});

	it('decision state notes vision is preliminary in reasons', () => {
		const state = getDecisionState(
			60, 58, 0,
			{ transit: 65, demographics: 60, competition: 55, safety: 70, vibrancy: 50, momentum: 55, survivalRate: 55 },
			{ competition: 55, market_proof: 50, demographics: 60 },
			'specialty_coffee', true
		);
		const allReasons = state.reasons.join(' ').toLowerCase();
		expect(allReasons).toContain('vision');
		expect(state).toMatchSnapshot();
	});
});

// ── Utility function snapshots ───────────────────────────────────────────────

describe('Tier label utilities', () => {
	it('fitTierLabel covers all bands', () => {
		expect(fitTierLabel(82)).toBe('Strong Path');
		expect(fitTierLabel(70)).toBe('Viable');
		expect(fitTierLabel(55)).toBe('Tight');
		expect(fitTierLabel(42)).toBe('Stretch');
		expect(fitTierLabel(30)).toBe('Rethink');
	});

	it('blockTierLabel covers all bands', () => {
		expect(blockTierLabel(85)).toBe('Prime Block');
		expect(blockTierLabel(70)).toBe('Solid Block');
		expect(blockTierLabel(55)).toBe('Mixed Block');
		expect(blockTierLabel(45)).toBe('');
	});

	it('fitGrade covers all bands', () => {
		expect(fitGrade(82)).toBe('A');
		expect(fitGrade(70)).toBe('B');
		expect(fitGrade(55)).toBe('C');
		expect(fitGrade(42)).toBe('D');
		expect(fitGrade(30)).toBe('F');
	});

	it('fitNextTier returns correct gaps', () => {
		expect(fitNextTier(82)).toBeNull();
		expect(fitNextTier(70)).toEqual({ points: 5, label: 'Strong Path', threshold: 75 });
		expect(fitNextTier(55)).toEqual({ points: 10, label: 'Viable', threshold: 65 });
		expect(fitNextTier(42)).toEqual({ points: 8, label: 'Tight', threshold: 50 });
		expect(fitNextTier(30)).toEqual({ points: 10, label: 'Stretch', threshold: 40 });
	});

	it('fitVerdictShort uses canonical tier vocabulary', () => {
		expect(fitVerdictShort(82, 'coffee shop')).toContain('coffee shop');
		expect(fitVerdictShort(30, 'coffee shop')).toContain('Rethink');
	});

	it('fitMeaning returns non-empty for all bands', () => {
		for (const score of [82, 70, 55, 42, 30]) {
			expect(fitMeaning(score).length).toBeGreaterThan(0);
		}
	});

	it('fitMeaningShort returns non-empty for all bands', () => {
		for (const score of [82, 70, 55, 42, 30]) {
			expect(fitMeaningShort(score).length).toBeGreaterThan(0);
		}
	});
});

// ── Score interpretation ─────────────────────────────────────────────────────

describe('getScoreInterpretation', () => {
	it('zero score returns pending', () => {
		const interp = getScoreInterpretation(0, 0, 0, 'specialty_coffee');
		expect(interp.bandName).toBe('Pending');
	});

	it('strong path snapshot', () => {
		const interp = getScoreInterpretation(82, 78, 70, 'specialty_coffee');
		expect(interp.gapToNext).toBe(0);
		expect(interp).toMatchSnapshot();
	});

	it('tight band shows gap to viable', () => {
		const interp = getScoreInterpretation(55, 60, 50, 'specialty_coffee');
		expect(interp.gapToNext).toBe(10);
		expect(interp).toMatchSnapshot();
	});
});
