/**
 * B2-1.4: Canonical VISION_ARCHETYPES constant.
 *
 * Previously inlined as `const VISION_ARCHETYPES` inside
 * src/routes/app/location/+page.svelte (~line 2314). Server code (like
 * /api/score/preview) could not consume it from there, creating client /
 * server drift of 5-10 points on visionIQ.
 *
 * This module re-shapes the concept KPI catalog (src/lib/constants/conceptKPIs.ts
 * — already the single source of truth for concept weights) into the same
 * object shape the location page expects, so both paths read identical values.
 *
 * Consumers:
 *   - src/routes/api/score/preview/+server.ts  (server-side vision scoring)
 *   - src/routes/app/location/+page.svelte     (UX will swap in their PR)
 *   - any future server route computing vision-weighted composites
 *
 * Shape:
 *   { footTrafficW, competitionW, demographicsW, vibrancyW,
 *     idealIncome: [low, high], idealCheck: [low, high], peakHours }
 */

import { CONCEPT_KPIS, type ConceptKPI } from './conceptKPIs';

export interface VisionArchetype {
	footTrafficW:   number;
	competitionW:   number;
	demographicsW:  number;
	vibrancyW:      number;
	idealIncome:    [number, number];
	idealCheck:     [number, number];
	peakHours:      'morning' | 'all_day' | 'evening';
}

function toArchetype(kpi: ConceptKPI): VisionArchetype {
	return {
		footTrafficW:  kpi.visionSignalWeights.footTrafficW,
		competitionW:  kpi.visionSignalWeights.competitionW,
		demographicsW: kpi.visionSignalWeights.demographicsW,
		vibrancyW:     kpi.visionSignalWeights.vibrancyW,
		idealIncome:   kpi.idealIncomeRange,
		idealCheck:    kpi.idealCheckRange,
		peakHours:     kpi.peakHours,
	};
}

/** Canonical archetype table. Built once at module load from CONCEPT_KPIS. */
export const VISION_ARCHETYPES: Record<string, VisionArchetype> = Object.fromEntries(
	Object.entries(CONCEPT_KPIS).map(([key, kpi]) => [key, toArchetype(kpi)])
);

/**
 * Neutral fallback for unknown concepts. Matches the DEFAULT_ARCHETYPE
 * currently inlined in location/+page.svelte line 2331.
 */
export const DEFAULT_ARCHETYPE: VisionArchetype = {
	footTrafficW:  0.25,
	competitionW:  0.25,
	demographicsW: 0.25,
	vibrancyW:     0.25,
	idealIncome:   [40_000, 150_000],
	idealCheck:    [5, 30],
	peakHours:     'all_day',
};

/**
 * Lookup helper: falls back to DEFAULT_ARCHETYPE when the concept isn't in
 * the registry. Mirrors the `VISION_ARCHETYPES[biz] || DEFAULT_ARCHETYPE`
 * pattern at every inline call site so the replacement is a drop-in.
 */
export function getVisionArchetype(conceptKey: string): VisionArchetype {
	return VISION_ARCHETYPES[conceptKey] ?? DEFAULT_ARCHETYPE;
}
