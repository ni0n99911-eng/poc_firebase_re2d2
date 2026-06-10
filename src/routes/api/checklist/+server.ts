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
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
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
		// 1. Load phases
		const phasesRes = await db.execute(sql`SELECT * FROM checklist_phases ORDER BY sort_order`);
		const phases = phasesRes.rows;

		// 2. Load all templates
		const templatesRes = await db.execute(sql`SELECT * FROM checklist_templates ORDER BY sort_order`);
		const templates = templatesRes.rows;

		// 3. Load user progress for this location
		const progressRes = await db.execute(sql`SELECT * FROM checklist_progress WHERE user_id = ${user.id} AND location_id = ${locationId}`);
		const progress = progressRes.rows;

		// 4. Build location context for enrichment
		const locationContext = await buildLocationContext(locationId, concept);

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
	locationId: string,
	concept: string,
): Promise<LocationContext | undefined> {
	try {
		const ctx: LocationContext = {};

		// Try to load DOF data from enriched_entities
		const dofRes = await db.execute(sql`SELECT raw_data FROM enriched_entities WHERE geoid = ${locationId} AND source = 'dof_property_tax' LIMIT 1`);
		const dofData = dofRes.rows[0] as any;

		if (dofData?.raw_data) {
			const raw = dofData.raw_data;
			ctx.dofData = {
				taxLiens: raw.tax_liens === true,
				highEscalation: (raw.tax_rate_change_pct || 0) > 10,
				annualTax: raw.annual_tax,
			};
		}

		// Try to load competitor count from block_group_scores
		const compRes = await db.execute(sql`SELECT raw_signals FROM block_group_scores WHERE geoid = ${locationId} AND score_type = 'competition' LIMIT 1`);
		const compData = compRes.rows[0] as any;

		if (compData?.raw_signals?.competitor_count) {
			ctx.competitorCount = compData.raw_signals.competitor_count;
		}

		// Try to load rent from block_group_scores
		const rentRes = await db.execute(sql`SELECT raw_signals FROM block_group_scores WHERE geoid = ${locationId} AND score_type = 'rent' LIMIT 1`);
		const rentData = rentRes.rows[0] as any;

		if (rentData?.raw_signals?.monthly_rent) {
			ctx.rent = rentData.raw_signals.monthly_rent;
		}

		return Object.keys(ctx).length > 0 ? ctx : undefined;
	} catch {
		return undefined; // Non-fatal — context enrichment is optional
	}
}
