/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RE² Checklist API — GET /api/checklist
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Returns the generated checklist for a location + concept combination.
 * Loads templates from Supabase, applies concept filtering, loads user
 * progress, merges and returns.
 *
 * Query params:
 *   locationId: string (geoid or address hash)
 *   concept: string (e.g. "specialty_coffee")
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/supabase-server';
import {
	generateChecklistForConcept,
	mergeWithProgress,
	type ChecklistPhase,
	type ChecklistTemplate,
	type ChecklistProgress,
	type LocationContext,
} from '$lib/intel/checklist-engine';

export const GET: RequestHandler = async ({ url, locals }) => {
	const user = locals.user;
	if (!user?.id) {
		throw error(401, 'Authentication required');
	}

	const locationId = url.searchParams.get('locationId');
	const concept = url.searchParams.get('concept') || 'specialty_coffee';

	if (!locationId) {
		throw error(400, 'locationId is required');
	}

	try {
		const supabase = getServiceSupabase();

		// 1. Load phases
		const { data: phases, error: phaseErr } = await supabase
			.from('checklist_phases')
			.select('*')
			.order('sort_order');

		if (phaseErr) {
			console.error('[checklist] Phase load error:', phaseErr);
			throw error(500, 'Failed to load checklist phases');
		}

		// 2. Load all templates
		const { data: templates, error: tmplErr } = await supabase
			.from('checklist_templates')
			.select('*')
			.order('sort_order');

		if (tmplErr) {
			console.error('[checklist] Template load error:', tmplErr);
			throw error(500, 'Failed to load checklist templates');
		}

		// 3. Load user progress for this location
		const { data: progress, error: progErr } = await supabase
			.from('checklist_progress')
			.select('*')
			.eq('user_id', user.id)
			.eq('location_id', locationId);

		if (progErr) {
			console.error('[checklist] Progress load error:', progErr);
			// Non-fatal — return empty progress
		}

		// 4. Build location context for enrichment
		const locationContext = await buildLocationContext(supabase, locationId, concept);

		// 5. Filter and customize for concept
		const filteredTemplates = generateChecklistForConcept(
			(templates || []) as ChecklistTemplate[],
			concept,
			locationContext,
		);

		// 6. Merge with progress
		const items = mergeWithProgress(
			filteredTemplates,
			(progress || []) as ChecklistProgress[],
		);

		return json({
			phases: (phases || []) as ChecklistPhase[],
			items,
			progress: progress || [],
			locationId,
			concept,
		});
	} catch (err: any) {
		if (err?.status) throw err; // re-throw SvelteKit errors
		console.error('[checklist] Error:', err);
		return json({ error: 'Internal error' }, { status: 500 });
	}
};

/**
 * Build LocationContext from existing data for a given location.
 * Pulls from block_group_scores, enriched_entities, etc.
 */
async function buildLocationContext(
	supabase: any,
	locationId: string,
	concept: string,
): Promise<LocationContext | undefined> {
	try {
		const ctx: LocationContext = {};

		// Try to load DOF data from enriched_entities
		const { data: dofData } = await supabase
			.from('enriched_entities')
			.select('raw_data')
			.eq('geoid', locationId)
			.eq('source', 'dof_property_tax')
			.limit(1)
			.single();

		if (dofData?.raw_data) {
			const raw = dofData.raw_data;
			ctx.dofData = {
				taxLiens: raw.tax_liens === true,
				highEscalation: (raw.tax_rate_change_pct || 0) > 10,
				annualTax: raw.annual_tax,
			};
		}

		// Try to load competitor count from block_group_scores
		const { data: compData } = await supabase
			.from('block_group_scores')
			.select('raw_signals')
			.eq('geoid', locationId)
			.eq('score_type', 'competition')
			.limit(1)
			.single();

		if (compData?.raw_signals?.competitor_count) {
			ctx.competitorCount = compData.raw_signals.competitor_count;
		}

		// Try to load rent from block_group_scores
		const { data: rentData } = await supabase
			.from('block_group_scores')
			.select('raw_signals')
			.eq('geoid', locationId)
			.eq('score_type', 'rent')
			.limit(1)
			.single();

		if (rentData?.raw_signals?.monthly_rent) {
			ctx.rent = rentData.raw_signals.monthly_rent;
		}

		return Object.keys(ctx).length > 0 ? ctx : undefined;
	} catch {
		return undefined; // Non-fatal — context enrichment is optional
	}
}
