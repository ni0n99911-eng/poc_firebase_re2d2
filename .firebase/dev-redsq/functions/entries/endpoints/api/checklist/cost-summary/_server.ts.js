import { error, json } from "@sveltejs/kit";
import { d as db } from "../../../../../chunks/db-server.js";
import { sql } from "drizzle-orm";
import { g as generateChecklistForConcept, c as computeCostSummary, r as reconcileWithBusinessCase } from "../../../../../chunks/checklist-engine.js";
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
    const [phasesRes, templatesRes] = await Promise.all([
      db.execute(sql`SELECT * FROM checklist_phases ORDER BY sort_order ASC`),
      db.execute(sql`SELECT * FROM checklist_templates ORDER BY sort_order ASC`)
    ]);
    const phases = phasesRes.rows;
    const templates = templatesRes.rows;
    if (!phases || !templates) {
      throw error(500, "Failed to load checklist data");
    }
    const filtered = generateChecklistForConcept(
      templates,
      concept
    );
    let dofAnnualTax;
    try {
      const dofRes = await db.execute(sql`
				SELECT raw_data 
				FROM enriched_entities 
				WHERE location_key = ${locationId} AND entity_category = 'dof_property_tax' 
				LIMIT 1
			`);
      const dofData = dofRes.rows[0];
      if (dofData?.raw_data && typeof dofData.raw_data === "object" && "annual_tax" in dofData.raw_data) {
        dofAnnualTax = dofData.raw_data.annual_tax;
      }
    } catch {
    }
    const costSummary = computeCostSummary(
      filtered,
      phases,
      dofAnnualTax
    );
    const bcReconciliation = reconcileWithBusinessCase(filtered);
    return json({
      ...costSummary,
      bcReconciliation,
      concept,
      locationId
    });
  } catch (err) {
    if (err?.status) throw err;
    console.error("[checklist/cost-summary] Error:", err);
    return json({ error: "Internal error" }, { status: 500 });
  }
};
export {
  GET
};
