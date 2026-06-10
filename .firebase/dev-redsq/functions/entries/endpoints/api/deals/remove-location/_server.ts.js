import { error, json } from "@sveltejs/kit";
import { d as db, g as dealPipeline } from "../../../../../chunks/db-server.js";
import { and, eq } from "drizzle-orm";
const DELETE = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.id) throw error(401, "Authentication required");
  const body = await request.json();
  const { addr } = body;
  if (!addr || typeof addr !== "string" || addr.trim() === "") {
    throw error(400, "addr is required");
  }
  try {
    await db.delete(dealPipeline).where(
      and(eq(dealPipeline.userId, user.id), eq(dealPipeline.address, addr.trim()))
    );
  } catch (dbErr) {
    console.error("[deals/remove-location] delete error:", dbErr);
    return json({ ok: false, error: dbErr.message }, { status: 500 });
  }
  return json({ ok: true, removed: count ?? 0 });
};
export {
  DELETE
};
