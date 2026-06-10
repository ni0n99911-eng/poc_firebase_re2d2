import { error, json } from "@sveltejs/kit";
import { d as db, b as brokerContacts } from "../../../../chunks/db-server.js";
import { eq, desc } from "drizzle-orm";
import { v4 } from "uuid";
const GET = async ({ locals }) => {
  const user = locals.user;
  if (!user?.id) throw error(401, "Authentication required");
  try {
    const data = await db.select().from(brokerContacts).where(eq(brokerContacts.userId, user.id)).orderBy(desc(brokerContacts.createdAt));
    return json({ brokers: data || [] });
  } catch (dbErr) {
    console.error("[brokers GET] error:", dbErr);
    return json({ brokers: [] }, { status: 500 });
  }
};
const POST = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.id) throw error(401, "Authentication required");
  const body = await request.json();
  const { name, brokerage, email, phone, notes } = body;
  if (!name?.trim()) throw error(400, "name is required");
  try {
    const newId = v4();
    await db.insert(brokerContacts).values({
      id: newId,
      userId: user.id,
      name: name.trim(),
      brokerage: brokerage?.trim() ?? null,
      email: email?.trim() ?? null,
      phone: phone?.trim() ?? null,
      notes: notes?.trim() ?? null
    });
    return json({ broker_id: newId, ok: true });
  } catch (insertErr) {
    console.error("[brokers POST] error:", insertErr);
    return json({ ok: false, error: insertErr?.message }, { status: 500 });
  }
};
export {
  GET,
  POST
};
