import { error, json } from "@sveltejs/kit";
import { d as db } from "../../../../../chunks/db-server.js";
import { sql } from "drizzle-orm";
import { v4 } from "uuid";
const VALID_STATUSES = /* @__PURE__ */ new Set([
  "watching",
  "touring",
  "negotiating",
  "signed",
  "passed",
  "lost"
]);
const STATUS_EVENT = {
  touring: "toured",
  negotiating: "offer_submitted",
  signed: "signed",
  passed: "passed",
  lost: "lost"
};
const PATCH = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.id) throw error(401, "Authentication required");
  const body = await request.json();
  const { addr, status, note, pinned, starred } = body;
  if (!addr || typeof addr !== "string" || addr.trim() === "") {
    throw error(400, "addr is required");
  }
  if (status !== void 0 && !VALID_STATUSES.has(status)) {
    throw error(400, `status must be one of: ${[...VALID_STATUSES].join(", ")}`);
  }
  const address = addr.trim();
  const existingRes = await db.execute(sql`SELECT id, status FROM deal_pipeline WHERE user_id = ${user.id} AND address = ${address} LIMIT 1`);
  const existing = existingRes.rows[0];
  const updates = {};
  if (status !== void 0) updates.status = status;
  if (note !== void 0) updates.notes = note;
  if (pinned !== void 0) updates.pinned = pinned;
  if (starred !== void 0) updates.starred = starred;
  if (existing) {
    if (Object.keys(updates).length === 0) {
      throw error(400, "No fields to update");
    }
    try {
      const setClauses = Object.keys(updates).map((k) => sql`${sql.identifier(k)} = ${updates[k]}`);
      const updateQuery = sql`UPDATE deal_pipeline SET ${sql.join(setClauses, sql`, `)} WHERE id = ${existing.id} AND user_id = ${user.id} RETURNING *`;
      const updatedRes = await db.execute(updateQuery);
      const updated = updatedRes.rows[0];
      if (status && status !== existing.status && STATUS_EVENT[status]) {
        await db.execute(sql`
					INSERT INTO deal_events (deal_id, user_id, event_type)
					VALUES (${existing.id}, ${user.id}, ${STATUS_EVENT[status]})
				`);
      }
      return json(updated);
    } catch (updateErr) {
      console.error("[deals/update-location] update error:", updateErr);
      return json({ ok: false, error: updateErr?.message }, { status: 500 });
    }
  } else {
    try {
      const newId = v4();
      const insertedRes = await db.execute(sql`
				INSERT INTO deal_pipeline (id, user_id, address, status, notes, pinned, starred)
				VALUES (${newId}, ${user.id}, ${address}, ${status ?? "watching"}, ${note ?? null}, ${pinned ?? false}, ${starred ?? false})
				RETURNING *
			`);
      const inserted = insertedRes.rows[0];
      await db.execute(sql`
				INSERT INTO deal_events (deal_id, user_id, event_type)
				VALUES (${inserted.id}, ${user.id}, 'saved')
			`);
      return json(inserted);
    } catch (insertErr) {
      console.error("[deals/update-location] insert error:", insertErr);
      return json({ ok: false, error: insertErr?.message }, { status: 500 });
    }
  }
};
export {
  PATCH
};
