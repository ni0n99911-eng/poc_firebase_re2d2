import { normalizeBusinessType } from '../intel/registry/business-type-registry';

/**
 * Session helpers for writing/reading the canonical concept key to/from localStorage.
 * These are the ONLY exports remaining in this file — all normalization logic
 * now lives in `business-type-registry.ts`.
 *
 * 04.19.2026 13:00 Removed normalizeConceptKey (deprecated proxy).
 * All call sites now import normalizeBusinessType directly from the registry.
 */

/**
 * Write the canonical concept key to re2_session once (at location page onMount).
 * Sets canonicalConcept + backward-compat aliases (bizType, visionBizType) atomically.
 */
export function writeCanonicalConcept(rawInput: string): string {
	const canonical = normalizeBusinessType(rawInput);
	try {
		const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
		sess.canonicalConcept = canonical;  
		sess.bizType          = canonical;  
		sess.visionBizType    = canonical;  
		localStorage.setItem('re2_session', JSON.stringify(sess));
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('re2:session-updated'));
		}
	} catch {}
	return canonical;
}

/**
 * Read the canonical concept key from re2_session.
 * Falls back to launchpad → bizType → visionBizType if canonicalConcept not yet set.
 */
export function readCanonicalConcept(): string {
	try {
		const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
		const lp   = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
		if (sess.canonicalConcept) return sess.canonicalConcept;
		const raw = lp.businessType || sess.bizType || sess.visionBizType || '';
		return normalizeBusinessType(raw);
	} catch {
		return 'specialty_coffee'; 
	}
}
