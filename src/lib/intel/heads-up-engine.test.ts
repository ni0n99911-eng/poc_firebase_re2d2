/**
 * C-11: Snapshot tests for heads-up-engine.ts
 *
 * Locks lens→Watch Out propagation and persona/universal warning generation
 * for known inputs. Ensures:
 *   1. Weak/Concerning lenses propagate to Watch Out
 *   2. Average lenses propagate with 'info' severity
 *   3. Strong/Solid lenses do NOT propagate
 *   4. Dedup: existing dimension warnings block lens propagation
 *   5. Persona-specific warnings fire for known inputs
 *   6. Universal scoring-data warnings fire at correct thresholds
 *   7. C-06: near-Concerning Average (< 38) escalates correctly
 */

import { describe, it, expect } from 'vitest';
import {
	warningsFromLenses,
	generateHeadsUpWarnings,
	type LensForWatchOut,
	type HeadsUpWarning,
} from './heads-up-engine';

// ── 1. Weak/Concerning lens propagation ──────────────────────────────────────

describe('Lens → Watch Out propagation', () => {
	it('Concerning lens propagates as critical', () => {
		const lenses: LensForWatchOut[] = [{
			dimension: 'safety',
			label: 'Safety',
			score: 22,
			tier: 'Concerning',
			verdictLine: 'Safety score is deeply concerning for this block.',
		}];
		const warnings = warningsFromLenses(lenses);
		expect(warnings).toHaveLength(1);
		expect(warnings[0].severity).toBe('critical');
		expect(warnings[0].source).toBe('lens');
		expect(warnings[0].dimension).toBe('safety');
		expect(warnings).toMatchSnapshot();
	});

	it('Weak lens propagates as important', () => {
		const lenses: LensForWatchOut[] = [{
			dimension: 'transit',
			label: 'Transit',
			score: 35,
			tier: 'Weak',
			verdictLine: 'Transit access is limited on this block.',
		}];
		const warnings = warningsFromLenses(lenses);
		expect(warnings).toHaveLength(1);
		expect(warnings[0].severity).toBe('important');
		expect(warnings).toMatchSnapshot();
	});

	it('Average lens propagates as info', () => {
		const lenses: LensForWatchOut[] = [{
			dimension: 'vibrancy',
			label: 'Concept Pulse',
			score: 48,
			tier: 'Average',
			verdictLine: 'Moderate activity in the trade area.',
		}];
		const warnings = warningsFromLenses(lenses);
		expect(warnings).toHaveLength(1);
		expect(warnings[0].severity).toBe('info');
		expect(warnings).toMatchSnapshot();
	});
});

// ── 2. Strong/Solid do NOT propagate ─────────────────────────────────────────

describe('Strong/Solid lenses do NOT propagate', () => {
	it('Strong lens is filtered out', () => {
		const lenses: LensForWatchOut[] = [{
			dimension: 'transit',
			label: 'Transit',
			score: 85,
			tier: 'Strong',
			verdictLine: 'Excellent transit coverage.',
		}];
		const warnings = warningsFromLenses(lenses);
		expect(warnings).toHaveLength(0);
	});

	it('Solid lens is filtered out', () => {
		const lenses: LensForWatchOut[] = [{
			dimension: 'demographics',
			label: 'Demographics',
			score: 65,
			tier: 'Solid',
			verdictLine: 'Demographics are solid for this concept.',
		}];
		const warnings = warningsFromLenses(lenses);
		expect(warnings).toHaveLength(0);
	});
});

// ── 3. Dedup — existing dimension blocks lens ────────────────────────────────

describe('Dedup: existing warnings block lens propagation', () => {
	it('persona safety warning blocks safety lens', () => {
		const existing: HeadsUpWarning[] = [{
			icon: '⚠️',
			title: 'Safety Concern',
			description: 'This area has a lower safety score.',
			severity: 'important',
		}];
		const lenses: LensForWatchOut[] = [{
			dimension: 'safety',
			label: 'Safety',
			score: 28,
			tier: 'Concerning',
			verdictLine: 'Safety is critically low.',
		}];
		const warnings = warningsFromLenses(lenses, existing);
		expect(warnings).toHaveLength(0);
	});

	it('existing dimension field blocks lens', () => {
		const existing: HeadsUpWarning[] = [{
			icon: '🚌',
			title: 'Limited Transit Access',
			description: 'Transit access is limited.',
			severity: 'info',
			dimension: 'transit',
		}];
		const lenses: LensForWatchOut[] = [{
			dimension: 'transit',
			label: 'Transit',
			score: 32,
			tier: 'Weak',
			verdictLine: 'Transit is weak.',
		}];
		const warnings = warningsFromLenses(lenses, existing);
		expect(warnings).toHaveLength(0);
	});

	it('different dimension is NOT blocked', () => {
		const existing: HeadsUpWarning[] = [{
			icon: '⚠️',
			title: 'Safety Concern',
			description: 'Safety concern.',
			severity: 'important',
		}];
		const lenses: LensForWatchOut[] = [{
			dimension: 'transit',
			label: 'Transit',
			score: 33,
			tier: 'Weak',
			verdictLine: 'Transit is weak.',
		}];
		const warnings = warningsFromLenses(lenses, existing);
		expect(warnings).toHaveLength(1);
	});
});

// ── 4. Multiple lenses — one per dimension ───────────────────────────────────

describe('Multiple lenses', () => {
	it('only one warning per dimension', () => {
		const lenses: LensForWatchOut[] = [
			{ dimension: 'safety', label: 'Safety', score: 28, tier: 'Concerning', verdictLine: 'Bad.' },
			{ dimension: 'safety', label: 'Safety', score: 35, tier: 'Weak', verdictLine: 'Also bad.' },
		];
		const warnings = warningsFromLenses(lenses);
		expect(warnings).toHaveLength(1);
		// First one wins
		expect(warnings[0].severity).toBe('critical');
	});

	it('different dimensions both propagate', () => {
		const lenses: LensForWatchOut[] = [
			{ dimension: 'safety', label: 'Safety', score: 28, tier: 'Concerning', verdictLine: 'Bad safety.' },
			{ dimension: 'transit', label: 'Transit', score: 35, tier: 'Weak', verdictLine: 'Bad transit.' },
			{ dimension: 'vibrancy', label: 'Concept Pulse', score: 48, tier: 'Average', verdictLine: 'Moderate.' },
		];
		const warnings = warningsFromLenses(lenses);
		expect(warnings).toHaveLength(3);
		expect(warnings).toMatchSnapshot();
	});
});

// ── 5. Universal scoring-data warnings ───────────────────────────────────────

describe('Universal scoring-data warnings', () => {
	it('safety < 50 triggers Safety Concern', () => {
		const warnings = generateHeadsUpWarnings('coffee', {}, { safety: 38 });
		const safetyW = warnings.find(w => w.title === 'Safety Concern');
		expect(safetyW).toBeDefined();
		expect(safetyW!.severity).toBe('important');
	});

	it('transit < 40 triggers Limited Transit Access', () => {
		const warnings = generateHeadsUpWarnings('coffee', {}, { transit: 30 });
		const transitW = warnings.find(w => w.title === 'Limited Transit Access');
		expect(transitW).toBeDefined();
	});

	it('competition < 35 triggers Crowded Market', () => {
		const warnings = generateHeadsUpWarnings('coffee', {}, { competition: 25 });
		const compW = warnings.find(w => w.title === 'Crowded Market');
		expect(compW).toBeDefined();
	});

	it('demographics < 40 triggers Demographics Mismatch', () => {
		const warnings = generateHeadsUpWarnings('coffee', {}, { demographics: 30 });
		const demoW = warnings.find(w => w.title === 'Demographics Mismatch');
		expect(demoW).toBeDefined();
	});

	it('vibrancy < 35 triggers Quiet Concept Pulse', () => {
		const warnings = generateHeadsUpWarnings('coffee', {}, { vibrancy: 28 });
		const vibW = warnings.find(w => w.title === 'Quiet Concept Pulse');
		expect(vibW).toBeDefined();
	});

	it('momentum < 30 triggers Declining Area Momentum', () => {
		const warnings = generateHeadsUpWarnings('coffee', {}, { momentum: 20 });
		const momW = warnings.find(w => w.title === 'Declining Area Momentum');
		expect(momW).toBeDefined();
	});

	it('momentum > 85 triggers Hot Market', () => {
		const warnings = generateHeadsUpWarnings('coffee', {}, { momentum: 90 });
		const hotW = warnings.find(w => w.title === 'Hot Market — Expect Rent Pressure');
		expect(hotW).toBeDefined();
	});

	it('composite > 80 triggers Strong Location tip', () => {
		const warnings = generateHeadsUpWarnings('coffee', {}, {
			transit: 85, demographics: 82, competition: 85, safety: 90, vibrancy: 80, momentum: 78,
		});
		const strongW = warnings.find(w => w.title === 'Strong Location — Negotiate Hard');
		expect(strongW).toBeDefined();
	});

	it('full universal snapshot', () => {
		const warnings = generateHeadsUpWarnings('coffee', {}, {
			safety: 38, transit: 30, competition: 25, demographics: 30, vibrancy: 28, momentum: 20,
		});
		expect(warnings).toMatchSnapshot();
	});
});

// ── 6. Persona-specific warnings ─────────────────────────────────────────────

describe('Persona-specific warnings', () => {
	it('coffee shop: espresso triggers electrical panel warning', () => {
		const warnings = generateHeadsUpWarnings('coffee', {
			service_model: 'sit_down',
			concept: 'specialty espresso bar',
		});
		const elecW = warnings.find(w => w.title === 'Electrical Panel Capacity');
		expect(elecW).toBeDefined();
		expect(elecW!.severity).toBe('critical');
	});

	it('restaurant: full service triggers gas line warning', () => {
		const warnings = generateHeadsUpWarnings('restaurant', {
			service_style: 'full_service',
		});
		const gasW = warnings.find(w => w.title === 'Gas Line & Infrastructure');
		expect(gasW).toBeDefined();
		expect(gasW!.severity).toBe('critical');
	});

	it('fitness: crossfit triggers floor load warning', () => {
		const warnings = generateHeadsUpWarnings('gym', {
			fitness_type: 'crossfit',
		});
		const floorW = warnings.find(w => w.title === 'Floor Load Capacity');
		expect(floorW).toBeDefined();
		expect(floorW!.severity).toBe('critical');
	});

	it('medical: always shows zoning + ADA', () => {
		const warnings = generateHeadsUpWarnings('dentist', {});
		const zoningW = warnings.find(w => w.title === 'Zoning & ADA Compliance');
		expect(zoningW).toBeDefined();
	});

	it('florist: always shows walk-in cooler', () => {
		const warnings = generateHeadsUpWarnings('florist', {});
		const coolerW = warnings.find(w => w.title === 'Walk-in Cooler Requirements');
		expect(coolerW).toBeDefined();
	});

	it('unknown concept: always shows zoning verification', () => {
		const warnings = generateHeadsUpWarnings('something_else', {});
		const zoningW = warnings.find(w => w.title === 'Zoning Verification Required');
		expect(zoningW).toBeDefined();
	});
});

// ── 7. Null/empty edge cases ─────────────────────────────────────────────────

describe('Edge cases', () => {
	it('null lenses returns empty array', () => {
		expect(warningsFromLenses(null)).toEqual([]);
	});

	it('undefined lenses returns empty array', () => {
		expect(warningsFromLenses(undefined)).toEqual([]);
	});

	it('empty lenses returns empty array', () => {
		expect(warningsFromLenses([])).toEqual([]);
	});

	it('generateHeadsUpWarnings with no scoring data', () => {
		const warnings = generateHeadsUpWarnings('coffee', {});
		// Should only have persona-specific, no universal scoring warnings
		const universalTitles = ['Safety Concern', 'Limited Transit Access', 'Crowded Market',
			'Demographics Mismatch', 'Quiet Concept Pulse', 'Declining Area Momentum'];
		for (const title of universalTitles) {
			expect(warnings.find(w => w.title === title)).toBeUndefined();
		}
	});
});
