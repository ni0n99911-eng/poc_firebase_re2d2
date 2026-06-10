const PRIORITY_OVERRIDES = {
  full_service_restaurant: {
    "per-05": "now"
    // liquor license — start ASAP for FSR (6-12 month lead)
  },
  juice_bar: {
    "des-03": "later"
    // kitchen layout simplified for juice bars
  },
  boutique_retail: {
    "des-04": "now"
    // equipment/fixtures are the business for retail
  },
  fitness_wellness: {
    "fin-03": "now",
    // liability insurance critical for fitness
    "fin-04": "now"
    // workers comp critical for fitness
  }
};
const COST_ADJUSTMENTS = {
  boutique_retail: {
    "des-02": { costLow: 15e3, costHigh: 6e4 },
    // lighter build-out
    "des-04": { costLow: 1e4, costHigh: 5e4 },
    // retail fixtures cheaper
    "fin-03": { costLow: 1500, costHigh: 3e3 }
    // lower liability premiums
  },
  juice_bar: {
    "des-04": { costLow: 1e4, costHigh: 4e4 }
    // simpler equipment
  },
  fitness_wellness: {
    "fin-03": { costLow: 3e3, costHigh: 8e3 },
    // higher liability premiums
    "fin-04": { costLow: 3e3, costHigh: 1e4 }
    // higher workers comp
  }
};
const PRIORITY_ORDER = { now: 0, soon: 1, later: 2 };
function generateChecklistForConcept(allTemplates, concept, locationContext) {
  const filtered = allTemplates.filter((item) => {
    if (!item.concept_tags || item.concept_tags.length === 0) return true;
    return item.concept_tags.includes(concept);
  });
  const overrides = PRIORITY_OVERRIDES[concept] || {};
  const costAdj = COST_ADJUSTMENTS[concept] || {};
  const customized = filtered.map((item) => {
    const copy = { ...item };
    if (overrides[item.id]) {
      copy.priority = overrides[item.id];
    }
    if (costAdj[item.id]) {
      copy.cost_low = costAdj[item.id].costLow;
      copy.cost_high = costAdj[item.id].costHigh;
    }
    if (locationContext) {
      copy.description = injectLocationContext(copy, locationContext);
    }
    return copy;
  });
  customized.sort((a, b) => {
    if (a.phase !== b.phase) return a.sort_order - b.sort_order;
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;
    return a.weeks - b.weeks;
  });
  return customized;
}
function injectLocationContext(item, ctx) {
  let desc = item.description;
  if (item.id === "lea-03" && ctx.zoning) {
    const status = ctx.zoning.foodServicePermitted ? "✅ food service is permitted" : "⚠️ food service may NOT be permitted";
    desc = `Zone ${ctx.zoning.zoneCode} — ${status}. ${desc}`;
  }
  if (item.id === "lea-04" && ctx.dofData) {
    if (ctx.dofData.taxLiens) {
      desc = `⚠️ DOF records show tax liens on this property. ${desc}`;
    }
    if (ctx.dofData.highEscalation) {
      desc = `⚠️ High tax escalation detected — factor into lease negotiations. ${desc}`;
    }
  }
  if (item.phase === "lease" && ctx.dofData?.annualTax) {
    desc += ` Note: annual property tax is ~$${ctx.dofData.annualTax.toLocaleString()} — confirm whether this is passed through to tenant.`;
  }
  if (item.id === "ops-02" && ctx.competitorCount !== void 0) {
    if (ctx.competitorCount > 10) {
      desc = `${ctx.competitorCount} competitors nearby — differentiation in pricing is critical. ${desc}`;
    } else if (ctx.competitorCount > 5) {
      desc = `${ctx.competitorCount} competitors in area — competitive pricing matters. ${desc}`;
    }
  }
  if (item.id === "fin-01" && ctx.rent) {
    desc += ` Your monthly rent is ~$${ctx.rent.toLocaleString()} — include 6-month reserve ($${(ctx.rent * 6).toLocaleString()}) in your budget.`;
  }
  return desc;
}
function mergeWithProgress(templates, progress) {
  const progressMap = new Map(progress.map((p) => [p.item_id, p]));
  return templates.map((t) => {
    const p = progressMap.get(t.id);
    return {
      ...t,
      done: p?.done ?? false,
      notes: p?.notes ?? "",
      completed_at: p?.completed_at
    };
  });
}
function computeCostSummary(items, phases, dofAnnualTax) {
  const phaseMap = new Map(phases.map((p) => [p.id, p.name]));
  const byPhase = [];
  const phaseGroups = /* @__PURE__ */ new Map();
  for (const item of items) {
    const group = phaseGroups.get(item.phase) || { costLow: 0, costHigh: 0, weeks: 0 };
    group.costLow += item.cost_low;
    group.costHigh += item.cost_high;
    group.weeks = Math.max(group.weeks, item.weeks);
    phaseGroups.set(item.phase, group);
  }
  let totalCostLow = 0;
  let totalCostHigh = 0;
  let totalWeeks = 0;
  for (const [phaseId, group] of phaseGroups) {
    totalCostLow += group.costLow;
    totalCostHigh += group.costHigh;
    totalWeeks += group.weeks;
    byPhase.push({
      phase: phaseId,
      phaseName: phaseMap.get(phaseId) || phaseId,
      ...group
    });
  }
  const summary = { totalCostLow, totalCostHigh, totalWeeks, byPhase };
  if (dofAnnualTax) {
    summary.propertyTaxNote = `Annual property tax: ~$${dofAnnualTax.toLocaleString()}. If passed through to tenant, budget ~$${Math.round(dofAnnualTax / 12).toLocaleString()}/month additional.`;
  }
  return summary;
}
function reconcileWithBusinessCase(items) {
  const itemizedBreakdown = items.filter((i) => i.cost_low > 0 || i.cost_high > 0).map((i) => ({
    name: i.name,
    costLow: i.cost_low,
    costHigh: i.cost_high,
    phase: i.phase
  }));
  return {
    startupCostLow: itemizedBreakdown.reduce((sum, i) => sum + i.costLow, 0),
    startupCostHigh: itemizedBreakdown.reduce((sum, i) => sum + i.costHigh, 0),
    itemizedBreakdown
  };
}
export {
  computeCostSummary as c,
  generateChecklistForConcept as g,
  mergeWithProgress as m,
  reconcileWithBusinessCase as r
};
