/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RE² Checklist Cost Summary API — GET /api/checklist/cost-summary
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Returns aggregated cost data, optionally enriched with DOF property tax.
 *
 * Query params:
 *   locationId: string
 *   concept: string
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db-server';
import { sql } from 'drizzle-orm';
import {
	generateChecklistForConcept,
	computeCostSummary,
	reconcileWithBusinessCase,
	type ChecklistPhase,
	type ChecklistTemplate,
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
		// Load phases + templates
		const [phasesRes, templatesRes] = await Promise.all([
			db.execute(sql`SELECT * FROM checklist_phases ORDER BY sort_order ASC`),
			db.execute(sql`SELECT * FROM checklist_templates ORDER BY sort_order ASC`),
		]);

		const phases = phasesRes.rows;
		const templates = templatesRes.rows;

		if (!phases || !templates) {
			throw error(500, 'Failed to load checklist data');
		}

		// Filter for concept
		const filtered = generateChecklistForConcept(
			templates as any as ChecklistTemplate[],
			concept,
		);

		// Try to get DOF annual tax
		let dofAnnualTax: number | undefined;
		try {
			const dofRes = await db.execute(sql`
				SELECT raw_data 
				FROM enriched_entities 
				WHERE location_key = ${locationId} AND entity_category = 'dof_property_tax' 
				LIMIT 1
			`);

			const dofData = dofRes.rows[0];
			if (dofData?.raw_data && typeof dofData.raw_data === 'object' && 'annual_tax' in dofData.raw_data) {
				dofAnnualTax = (dofData.raw_data as any).annual_tax;
			}
		} catch {
			// Non-fatal
		}

		const costSummary = computeCostSummary(
			filtered,
			phases as ChecklistPhase[],
			dofAnnualTax,
		);

		// Also provide BC reconciliation data
		const bcReconciliation = reconcileWithBusinessCase(filtered);

		return json({
			...costSummary,
			bcReconciliation,
			concept,
			locationId,
		});
	} catch (err: any) {
		if (err?.status) throw err;
		console.error('[checklist/cost-summary] Error:', err);
		return json({ error: 'Internal error' }, { status: 500 });
	}
};
