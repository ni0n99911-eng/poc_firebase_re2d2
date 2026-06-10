import { error, json } from "@sveltejs/kit";
import { d as db } from "../../../../../chunks/db-server.js";
import { sql } from "drizzle-orm";
const STATUS_EVENT = {
  touring: "toured",
  negotiating: "offer_submitted",
  signed: "signed",
  passed: "passed",
  lost: "lost"
};
const PATCH = async ({ request, locals, params }) => {
  const user = locals.user;
  if (!user?.id) throw error(401, "Authentication required");
  const dealId = params.id;
  if (!dealId) throw error(400, "deal id required");
  const existingRes = await db.execute(sql`SELECT id, status, user_id FROM deal_pipeline WHERE id = ${dealId} AND user_id = ${user.id} LIMIT 1`);
  const existing = existingRes.rows[0];
  if (!existing) throw error(404, "Deal not found");
  const body = await request.json();
  const {
    status,
    asking_rent_monthly,
    square_footage,
    broker_id,
    toured_at,
    offer_submitted_at,
    decision_at,
    notes
  } = body;
  const updates = {};
  if (status !== void 0) updates.status = status;
  if (asking_rent_monthly !== void 0) updates.asking_rent_monthly = asking_rent_monthly;
  if (square_footage !== void 0) updates.square_footage = square_footage;
  if (broker_id !== void 0) updates.broker_id = broker_id;
  if (toured_at !== void 0) updates.toured_at = toured_at;
  if (offer_submitted_at !== void 0) updates.offer_submitted_at = offer_submitted_at;
  if (decision_at !== void 0) updates.decision_at = decision_at;
  if (notes !== void 0) updates.notes = notes;
  if (Object.keys(updates).length === 0) throw error(400, "No fields to update");
  try {
    const setClauses = Object.keys(updates).map((k) => sql`${sql.identifier(k)} = ${updates[k]}`);
    const updateQuery = sql`UPDATE deal_pipeline SET ${sql.join(setClauses, sql`, `)} WHERE id = ${dealId} AND user_id = ${user.id}`;
    await db.execute(updateQuery);
    if (status && status !== existing.status && STATUS_EVENT[status]) {
      await db.execute(sql`
				INSERT INTO deal_events (deal_id, user_id, event_type)
				VALUES (${dealId}, ${user.id}, ${STATUS_EVENT[status]})
			`);
    }
  } catch (updateErr) {
    console.error("[deals PATCH] update error:", updateErr);
    return json({ ok: false, error: updateErr.message }, { status: 500 });
  }
  return json({ ok: true });
};
export {
  PATCH
};
