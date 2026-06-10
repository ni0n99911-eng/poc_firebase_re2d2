import { error, json } from "@sveltejs/kit";
import { d as db } from "../../../../chunks/db-server.js";
import { sql } from "drizzle-orm";
import { g as generateChecklistForConcept, m as mergeWithProgress } from "../../../../chunks/checklist-engine.js";
const GET = async ({ url, locals }) => {
  const user = locals.user;
  if (!user?.id) {
    throw error(401, "Authentication required");
  }
  const locationId = url.searchParams.get("locationId");
  const concept = url.searchParams.get("concept") || "specialty_coffee";
  if (!locationId) {
    throw error(400, "locationId is required");
  }
  try {
    const phasesRes = await db.execute(sql`SELECT * FROM checklist_phases ORDER BY sort_order`);
    const phases = phasesRes.rows;
    const templatesRes = await db.execute(sql`SELECT * FROM checklist_templates ORDER BY sort_order`);
    const templates = templatesRes.rows;
    const progressRes = await db.execute(sql`SELECT * FROM checklist_progress WHERE user_id = ${user.id} AND location_id = ${locationId}`);
    const progress = progressRes.rows;
    const locationContext = await buildLocationContext(locationId, concept);
    const filteredTemplates = generateChecklistForConcept(
      templates || [],
      concept,
      locationContext
    );
    const items = mergeWithProgress(
      filteredTemplates,
      progress || []
    );
    return json({
      phases: phases || [],
      items,
      progress: progress || [],
      locationId,
      concept
    });
  } catch (err) {
    if (err?.status) throw err;
    console.error("[checklist] Error:", err);
    return json({ error: "Internal error" }, { status: 500 });
  }
};
async function buildLocationContext(locationId, concept) {
  try {
    const ctx = {};
    const dofRes = await db.execute(sql`SELECT raw_data FROM enriched_entities WHERE geoid = ${locationId} AND source = 'dof_property_tax' LIMIT 1`);
    const dofData = dofRes.rows[0];
    if (dofData?.raw_data) {
      const raw = dofData.raw_data;
      ctx.dofData = {
        taxLiens: raw.tax_liens === true,
        highEscalation: (raw.tax_rate_change_pct || 0) > 10,
        annualTax: raw.annual_tax
      };
    }
    const compRes = await db.execute(sql`SELECT raw_signals FROM block_group_scores WHERE geoid = ${locationId} AND score_type = 'competition' LIMIT 1`);
    const compData = compRes.rows[0];
    if (compData?.raw_signals?.competitor_count) {
      ctx.competitorCount = compData.raw_signals.competitor_count;
    }
    const rentRes = await db.execute(sql`SELECT raw_signals FROM block_group_scores WHERE geoid = ${locationId} AND score_type = 'rent' LIMIT 1`);
    const rentData = rentRes.rows[0];
    if (rentData?.raw_signals?.monthly_rent) {
      ctx.rent = rentData.raw_signals.monthly_rent;
    }
    return Object.keys(ctx).length > 0 ? ctx : void 0;
  } catch {
    return void 0;
  }
}
export {
  GET
};
