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
import { getServiceSupabase } from '$lib/supabase-server';
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
		const supabase = getServiceSupabase();

		// Load phases + templates
		const [{ data: phases }, { data: templates }] = await Promise.all([
			supabase.from('checklist_phases').select('*').order('sort_order'),
			supabase.from('checklist_templates').select('*').order('sort_order'),
		]);

		if (!phases || !templates) {
			throw error(500, 'Failed to load checklist data');
		}

		// Filter for concept
		const filtered = generateChecklistForConcept(
			templates as ChecklistTemplate[],
			concept,
		);

		// Try to get DOF annual tax
		let dofAnnualTax: number | undefined;
		try {
			const { data: dofData } = await supabase
				.from('enriched_entities')
				.select('raw_data')
				.eq('geoid', locationId)
				.eq('source', 'dof_property_tax')
				.limit(1)
				.single();

			if (dofData?.raw_data?.annual_tax) {
				dofAnnualTax = dofData.raw_data.annual_tax;
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
