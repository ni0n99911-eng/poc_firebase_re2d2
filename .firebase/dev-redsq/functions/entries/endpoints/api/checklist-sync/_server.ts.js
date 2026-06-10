import { error, json } from "@sveltejs/kit";
import { d as db } from "../../../../chunks/db-server.js";
import { sql } from "drizzle-orm";
const POST = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.id) {
    throw error(401, "Authentication required");
  }
  const body = await request.json();
  const { locationId, items } = body;
  if (!locationId || !Array.isArray(items) || items.length === 0) {
    throw error(400, "locationId and items[] are required");
  }
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const item of items) {
      const completedAt = item.done ? now : null;
      const notes = item.notes || "";
      await db.execute(sql`
				INSERT INTO checklist_progress (user_id, location_id, item_id, done, notes, completed_at, updated_at)
				VALUES (${user.id}, ${locationId}, ${item.itemId}, ${item.done}, ${notes}, ${completedAt}, ${now})
				ON CONFLICT (user_id, location_id, item_id) DO UPDATE SET
					done = EXCLUDED.done,
					notes = EXCLUDED.notes,
					completed_at = EXCLUDED.completed_at,
					updated_at = EXCLUDED.updated_at
			`);
    }
    return json({ success: true, updatedAt: now });
  } catch (err) {
    if (err?.status) throw err;
    console.error("[checklist-sync] Error:", err);
    return json({ success: false, error: "Internal error" }, { status: 500 });
  }
};
export {
  POST
};
