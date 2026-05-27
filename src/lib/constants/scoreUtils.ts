/**
 * scoreUtils.ts — Single source of truth for score thresholds, colors, grades, and verdicts.
 *
 * All UX components must import from here. Never hardcode score thresholds inline.
 * Decision state boundaries are defined in DECISION_STATES and all helpers derive from them.
 *
 * Canonical boundaries (from BRAIN-COP-04 calibration against V4 scorer):
 *   strong_go          75–100
 *   go_with_refinements 65–74
 *   worth_testing       50–64
 *   high_risk           40–49
 *   do_not_pursue        0–39
 */

import { DECISION_STATES, getDecisionState } from '$lib/intel/neighborhood-profiles';
export { DECISION_STATES, getDecisionState };

// ── Color ─────────────────────────────────────────────────────────────────────

/** Primary score color (ring fill, text, badge) */
export function getScoreColor(score: number): string {
	const state = getDecisionState(score);
	return state.color;
}

/** Soft background tint (card fill, pill bg) */
export function getScoreTint(score: number): string {
	const s = getDecisionState(score);
	switch (s.key) {
		case 'strong_go':           return 'rgba(39,174,96,0.15)';
		case 'go_with_refinements': return 'rgba(243,156,18,0.15)';
		case 'worth_testing':       return 'rgba(230,126,22,0.15)';
		case 'high_risk':           return 'rgba(231,76,60,0.15)';
		case 'do_not_pursue':       return 'rgba(192,57,43,0.15)';
	}
}

// ── Grade letters ──────────────────────────────────────────────────────────────

/**
 * Maps 5 decision states to letter grades.
 * A = strong_go, B = go_with_refinements, C = worth_testing, D = high_risk, F = do_not_pursue
 * Optional: scores ≥ 85 within strong_go get A+ as a display label.
 */
export function getScoreGrade(score: number): string {
	if (score >= 85) return 'A+';
	const s = getDecisionState(score);
	switch (s.key) {
		case 'strong_go':           return 'A';
		case 'go_with_refinements': return 'B';
		case 'worth_testing':       return 'C';
		case 'high_risk':           return 'D';
		case 'do_not_pursue':       return 'F';
	}
}

/** CSS class suffix for grade display (grade-a, grade-b, etc.) */
export function getScoreGradeClass(score: number): string {
	const grade = getScoreGrade(score);
	return `grade-${grade.toLowerCase().replace('+', 'plus')}`;
}

// ── Verdict ────────────────────────────────────────────────────────────────────

/** Short verdict label for pill/chip display */
export function getVerdictLabel(score: number): string {
	const s = getDecisionState(score);
	switch (s.key) {
		case 'strong_go':           return 'Strong';
		case 'go_with_refinements': return 'Promising';
		case 'worth_testing':       return 'Worth Testing';
		case 'high_risk':           return 'Caution';
		case 'do_not_pursue':       return 'Avoid';
	}
}

/** Verdict pill CSS class (used for background/text color) */
export function getVerdictClass(score: number): string {
	const s = getDecisionState(score);
	switch (s.key) {
		case 'strong_go':           return 'strong';
		case 'go_with_refinements': return 'promising';
		case 'worth_testing':       return 'testing';
		case 'high_risk':           return 'caution';
		case 'do_not_pursue':       return 'risk';
	}
}

/** Full verdict object with label, class, icon, and CTA copy */
export function getVerdictFull(score: number): {
	label: string;
	cls: string;
	icon: string;
	cta: string;
} {
	const s = getDecisionState(score);
	switch (s.key) {
		case 'strong_go':
			return { label: '✓ Proceed with confidence', cls: 'strong', icon: '✓', cta: 'Sign the lease' };
		case 'go_with_refinements':
			return { label: '→ Proceed with refinements', cls: 'promising', icon: '→', cta: 'Address the gaps' };
		case 'worth_testing':
			return { label: '⚠ Worth testing', cls: 'testing', icon: '⚠', cta: 'Validate before committing' };
		case 'high_risk':
			return { label: '⚠ Proceed with caution', cls: 'caution', icon: '⚠', cta: 'Review the risks' };
		case 'do_not_pursue':
			return { label: '✕ Do not pursue', cls: 'risk', icon: '✕', cta: 'Find another location' };
	}
}

// ── Sub-score color (transit, demographics, competition) ──────────────────────

/**
 * 3-tier sub-score color: ≥70 green, ≥50 amber, < 50 red.
 * Sub-scores use simplified 3-tier coloring (not the full 5-state model).
 */
export function getSubScoreColor(score: number): string {
	if (score >= 70) return '#15803d';
	if (score >= 50) return '#d97706';
	return '#ef4444';
}

/** CSS var version for components that use CSS custom properties */
export function getSubScoreVar(score: number): string {
	if (score >= 70) return 'var(--green)';
	if (score >= 50) return 'var(--amber)';
	return 'var(--red, #ef4444)';
}

// ── Coach tier ─────────────────────────────────────────────────────────────────

/** Maps score to coach message tier using decision states */
export type CoachTier = 'strong_go' | 'go_with_refinements' | 'worth_testing' | 'high_risk' | 'do_not_pursue';
export function getCoachTier(score: number): CoachTier {
	return getDecisionState(score).key as CoachTier;
}
