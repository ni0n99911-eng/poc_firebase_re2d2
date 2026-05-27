/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RE² Checklist Engine — Brain Logic for Concept-Aware Checklist Generation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Core responsibilities:
 *  1. Filter master item catalog by concept
 *  2. Apply priority overrides per concept
 *  3. Inject location intelligence context into descriptions
 *  4. Reconcile checklist costs with Business Case
 *  5. Sort items by priority + weeks
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChecklistPhase {
	id: string;
	name: string;
	icon: string;
	color: string;
	sort_order: number;
	description?: string;
}

export interface ChecklistTemplate {
	id: string;
	phase: string;
	name: string;
	description: string;
	priority: 'now' | 'soon' | 'later';
	cost_low: number;
	cost_high: number;
	weeks: number;
	pro_type: string | null;
	concept_tags: string[];
	nyc_specific: boolean;
	depends_on: string[];
	sort_order: number;
}

export interface ChecklistItem extends ChecklistTemplate {
	done: boolean;
	notes: string;
	completed_at?: string;
}

export interface ChecklistProgress {
	id?: string;
	user_id: string;
	location_id: string;
	item_id: string;
	done: boolean;
	notes: string;
	completed_at?: string;
	updated_at?: string;
}

export interface CostSummary {
	totalCostLow: number;
	totalCostHigh: number;
	totalWeeks: number;
	byPhase: Array<{
		phase: string;
		phaseName: string;
		costLow: number;
		costHigh: number;
		weeks: number;
	}>;
	propertyTaxNote?: string;
}

export interface LocationContext {
	zoning?: { zoneCode: string; foodServicePermitted: boolean };
	dofData?: { taxLiens: boolean; highEscalation: boolean; annualTax?: number };
	competitorCount?: number;
	rent?: number;
}

// ── Priority Overrides by Concept ────────────────────────────────────────────

const PRIORITY_OVERRIDES: Record<string, Record<string, 'now' | 'soon' | 'later'>> = {
	full_service_restaurant: {
		'per-05': 'now',    // liquor license — start ASAP for FSR (6-12 month lead)
	},
	juice_bar: {
		'des-03': 'later',  // kitchen layout simplified for juice bars
	},
	boutique_retail: {
		'des-04': 'now',    // equipment/fixtures are the business for retail
	},
	fitness_wellness: {
		'fin-03': 'now',    // liability insurance critical for fitness
		'fin-04': 'now',    // workers comp critical for fitness
	},
};

// ── Cost Adjustments by Concept ──────────────────────────────────────────────

const COST_ADJUSTMENTS: Record<string, Record<string, { costLow: number; costHigh: number }>> = {
	boutique_retail: {
		'des-02': { costLow: 15000, costHigh: 60000 },  // lighter build-out
		'des-04': { costLow: 10000, costHigh: 50000 },  // retail fixtures cheaper
		'fin-03': { costLow: 1500, costHigh: 3000 },    // lower liability premiums
	},
	juice_bar: {
		'des-04': { costLow: 10000, costHigh: 40000 },  // simpler equipment
	},
	fitness_wellness: {
		'fin-03': { costLow: 3000, costHigh: 8000 },    // higher liability premiums
		'fin-04': { costLow: 3000, costHigh: 10000 },   // higher workers comp
	},
};

// ── Priority Sort Order ──────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { now: 0, soon: 1, later: 2 };

// ── Core Engine ──────────────────────────────────────────────────────────────

/**
 * Filter and customize checklist items for a specific concept.
 * This is the main generation function (spec A2.2).
 */
export function generateChecklistForConcept(
	allTemplates: ChecklistTemplate[],
	concept: string,
	locationContext?: LocationContext,
): ChecklistTemplate[] {
	// 1. Filter by conceptTags
	const filtered = allTemplates.filter((item) => {
		if (!item.concept_tags || item.concept_tags.length === 0) return true; // universal
		return item.concept_tags.includes(concept);
	});

	// 2. Apply priority overrides
	const overrides = PRIORITY_OVERRIDES[concept] || {};
	const costAdj = COST_ADJUSTMENTS[concept] || {};

	const customized = filtered.map((item) => {
		const copy = { ...item };

		// Priority override
		if (overrides[item.id]) {
			copy.priority = overrides[item.id];
		}

		// Cost adjustment
		if (costAdj[item.id]) {
			copy.cost_low = costAdj[item.id].costLow;
			copy.cost_high = costAdj[item.id].costHigh;
		}

		// Location context injection (spec A7.2)
		if (locationContext) {
			copy.description = injectLocationContext(copy, locationContext);
		}

		return copy;
	});

	// 3. Sort: by phase sort_order, then priority (now→soon→later), then weeks ascending
	customized.sort((a, b) => {
		if (a.phase !== b.phase) return a.sort_order - b.sort_order; // phase grouping preserved by sort_order
		const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
		if (pDiff !== 0) return pDiff;
		return a.weeks - b.weeks;
	});

	return customized;
}

/**
 * Inject location-specific intelligence into item descriptions (spec A7.2).
 */
function injectLocationContext(item: ChecklistTemplate, ctx: LocationContext): string {
	let desc = item.description;

	// Zoning (lea-03)
	if (item.id === 'lea-03' && ctx.zoning) {
		const status = ctx.zoning.foodServicePermitted ? '✅ food service is permitted' : '⚠️ food service may NOT be permitted';
		desc = `Zone ${ctx.zoning.zoneCode} — ${status}. ${desc}`;
	}

	// DOF tax liens / escalation (lea-04)
	if (item.id === 'lea-04' && ctx.dofData) {
		if (ctx.dofData.taxLiens) {
			desc = `⚠️ DOF records show tax liens on this property. ${desc}`;
		}
		if (ctx.dofData.highEscalation) {
			desc = `⚠️ High tax escalation detected — factor into lease negotiations. ${desc}`;
		}
	}

	// DOF property tax note for lease items
	if (item.phase === 'lease' && ctx.dofData?.annualTax) {
		desc += ` Note: annual property tax is ~$${ctx.dofData.annualTax.toLocaleString()} — confirm whether this is passed through to tenant.`;
	}

	// Competition context (ops-02 menu pricing)
	if (item.id === 'ops-02' && ctx.competitorCount !== undefined) {
		if (ctx.competitorCount > 10) {
			desc = `${ctx.competitorCount} competitors nearby — differentiation in pricing is critical. ${desc}`;
		} else if (ctx.competitorCount > 5) {
			desc = `${ctx.competitorCount} competitors in area — competitive pricing matters. ${desc}`;
		}
	}

	// Rent context for budget item (fin-01)
	if (item.id === 'fin-01' && ctx.rent) {
		desc += ` Your monthly rent is ~$${ctx.rent.toLocaleString()} — include 6-month reserve ($${(ctx.rent * 6).toLocaleString()}) in your budget.`;
	}

	return desc;
}

/**
 * Merge template items with user progress data.
 */
export function mergeWithProgress(
	templates: ChecklistTemplate[],
	progress: ChecklistProgress[],
): ChecklistItem[] {
	const progressMap = new Map(progress.map((p) => [p.item_id, p]));

	return templates.map((t) => {
		const p = progressMap.get(t.id);
		return {
			...t,
			done: p?.done ?? false,
			notes: p?.notes ?? '',
			completed_at: p?.completed_at,
		};
	});
}

/**
 * Compute cost summary with optional DOF enrichment (spec A4.3).
 */
export function computeCostSummary(
	items: ChecklistTemplate[],
	phases: ChecklistPhase[],
	dofAnnualTax?: number,
): CostSummary {
	const phaseMap = new Map(phases.map((p) => [p.id, p.name]));

	const byPhase: CostSummary['byPhase'] = [];
	const phaseGroups = new Map<string, { costLow: number; costHigh: number; weeks: number }>();

	for (const item of items) {
		const group = phaseGroups.get(item.phase) || { costLow: 0, costHigh: 0, weeks: 0 };
		group.costLow += item.cost_low;
		group.costHigh += item.cost_high;
		group.weeks = Math.max(group.weeks, item.weeks); // phases run in parallel within themselves
		phaseGroups.set(item.phase, group);
	}

	let totalCostLow = 0;
	let totalCostHigh = 0;
	let totalWeeks = 0;

	for (const [phaseId, group] of phaseGroups) {
		totalCostLow += group.costLow;
		totalCostHigh += group.costHigh;
		totalWeeks += group.weeks; // phases are sequential
		byPhase.push({
			phase: phaseId,
			phaseName: phaseMap.get(phaseId) || phaseId,
			...group,
		});
	}

	const summary: CostSummary = { totalCostLow, totalCostHigh, totalWeeks, byPhase };

	if (dofAnnualTax) {
		summary.propertyTaxNote = `Annual property tax: ~$${dofAnnualTax.toLocaleString()}. If passed through to tenant, budget ~$${Math.round(dofAnnualTax / 12).toLocaleString()}/month additional.`;
	}

	return summary;
}

/**
 * Build a cost reconciliation payload for Business Case integration (spec A7.1).
 * Returns the itemized breakdown that feeds the BC startup cost lump sum.
 */
export function reconcileWithBusinessCase(
	items: ChecklistTemplate[],
): { startupCostLow: number; startupCostHigh: number; itemizedBreakdown: Array<{ name: string; costLow: number; costHigh: number; phase: string }> } {
	const itemizedBreakdown = items
		.filter((i) => i.cost_low > 0 || i.cost_high > 0)
		.map((i) => ({
			name: i.name,
			costLow: i.cost_low,
			costHigh: i.cost_high,
			phase: i.phase,
		}));

	return {
		startupCostLow: itemizedBreakdown.reduce((sum, i) => sum + i.costLow, 0),
		startupCostHigh: itemizedBreakdown.reduce((sum, i) => sum + i.costHigh, 0),
		itemizedBreakdown,
	};
}
