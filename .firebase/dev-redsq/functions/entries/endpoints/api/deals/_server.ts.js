import { error, json } from "@sveltejs/kit";
import { d as db, g as dealPipeline } from "../../../../chunks/db-server.js";
import { eq, desc } from "drizzle-orm";
const STATUS_ORDER = ["watching", "touring", "negotiating", "signed", "passed", "lost"];
const GET = async ({ locals }) => {
  const user = locals.user;
  if (!user?.id) throw error(401, "Authentication required");
  try {
    const data = await db.select().from(dealPipeline).where(eq(dealPipeline.userId, user.id)).orderBy(desc(dealPipeline.createdAt));
    const pipeline2 = data || [];
    const counts2 = {};
    for (const s of STATUS_ORDER) counts2[s] = 0;
    for (const row of pipeline2) {
      const status = row.data?.status || row.stage || "watching";
      if (counts2[status] !== void 0) counts2[status]++;
    }
    return json({ pipeline: pipeline2, counts: counts2 });
  } catch (dbErr) {
    console.error("[deals GET] db error:", dbErr);
    return json({ pipeline: [], counts: {} }, { status: 500 });
  }
  return json({ pipeline, counts });
};
export {
  GET
};
