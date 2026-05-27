// ═══════════════════════════════════════════════
// RE² Location IQ — Utility Functions
// ═══════════════════════════════════════════════

// 04.19.2026 13:35 Score Consolidation — haversine (miles) removed; re-exported from canonical geo-math.ts
export { haversine } from '$lib/intel/scoring/geo-math';

/** Format distance: ft if <0.1mi, else mi */
export function fmtD(mi: number): string {
	return mi < 0.1 ? (mi * 5280).toFixed(0) + 'ft' : mi.toFixed(2) + 'mi';
}

/** CSS color variable based on score */
export function scoreColor(s: number): string {
	return s >= 75 ? 'var(--green)' : s >= 55 ? 'var(--yellow)' : 'var(--redtag)';
}

/** Grade class for CSS */
export function fitClass(g: string): string {
	return g === 'A' ? 'green' : g === 'B' ? 'yellow' : 'red';
}

/** Letter grade from numeric score */
export function getGrade(s: number): string {
	return s >= 70 ? 'A' : s >= 45 ? 'B' : 'C';
}

/** Verdict text from score */
export function getVerdict(s: number): string {
	return s >= 80 ? 'STRONG GO' : s >= 70 ? 'GO — MONITOR' : s >= 55 ? 'PROCEED W/ CAUTION' : 'HIGH RISK';
}

/** Controlled fetch with 15s timeout */
export async function cfetch(url: string): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 15000);
	try {
		const r = await fetch(url, { signal: controller.signal });
		clearTimeout(timer);
		if (!r.ok) throw new Error('Request failed: ' + r.status);
		return r;
	} catch (e: unknown) {
		clearTimeout(timer);
		if (e instanceof Error && e.name === 'AbortError') throw new Error('Request timed out (15s)');
		throw e;
	}
}
