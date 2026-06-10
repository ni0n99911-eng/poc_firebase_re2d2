import { json } from "@sveltejs/kit";
import { d as db, v as vaultItems } from "../../../../chunks/db-server.js";
import { and, eq, desc } from "drizzle-orm";
import crypto from "crypto";
function getUserId(request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    try {
      const payload = JSON.parse(atob(auth.split(".")[1]));
      return payload.sub || null;
    } catch {
      return null;
    }
  }
  return null;
}
const GET = async ({ request, url }) => {
  const userId = getUserId(request);
  if (!userId) return json({ error: "Unauthorized" }, { status: 401 });
  const property = url.searchParams.get("property");
  const itemType = url.searchParams.get("type");
  try {
    let conditions = [eq(vaultItems.userId, userId)];
    if (property) conditions.push(eq(vaultItems.propertyAddr, property));
    if (itemType) conditions.push(eq(vaultItems.itemType, itemType));
    const data = await db.select().from(vaultItems).where(and(...conditions)).orderBy(desc(vaultItems.pinned), desc(vaultItems.createdAt)).limit(200);
    return json({ items: data || [] });
  } catch (err) {
    console.error("[VaultAPI GET Error]:", err);
    return json({ error: err.message }, { status: 500 });
  }
};
const POST = async ({ request }) => {
  const userId = getUserId(request);
  if (!userId) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const itemId = crypto.randomUUID();
    const item = {
      id: itemId,
      userId,
      propertyAddr: body.property_addr || "",
      itemType: body.item_type || "note",
      title: body.title || "",
      body: body.body || "",
      filePath: body.file_path || "",
      fileType: body.file_type || "",
      fileSize: (body.file_size || 0).toString(),
      tags: body.tags || [],
      metadata: body.metadata || {},
      pinned: (body.pinned || false).toString()
    };
    await db.insert(vaultItems).values(item);
    return json({ item });
  } catch (err) {
    console.error("[VaultAPI POST Error]:", err);
    return json({ error: err.message }, { status: 500 });
  }
};
const PATCH = async ({ request }) => {
  const userId = getUserId(request);
  if (!userId) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.id) return json({ error: "id is required" }, { status: 400 });
    const updates = {};
    if (body.title !== void 0) updates.title = body.title;
    if (body.body !== void 0) updates.body = body.body;
    if (body.tags !== void 0) updates.tags = body.tags;
    if (body.metadata !== void 0) updates.metadata = body.metadata;
    if (body.pinned !== void 0) updates.pinned = body.pinned.toString();
    if (body.property_addr !== void 0) updates.propertyAddr = body.property_addr;
    await db.update(vaultItems).set(updates).where(and(eq(vaultItems.id, body.id), eq(vaultItems.userId, userId)));
    const updatedArr = await db.select().from(vaultItems).where(eq(vaultItems.id, body.id)).limit(1);
    return json({ item: updatedArr.length > 0 ? updatedArr[0] : null });
  } catch (err) {
    console.error("[VaultAPI PATCH Error]:", err);
    return json({ error: err.message }, { status: 500 });
  }
};
const DELETE = async ({ request, url }) => {
  const userId = getUserId(request);
  if (!userId) return json({ error: "Unauthorized" }, { status: 401 });
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id is required" }, { status: 400 });
  try {
    await db.delete(vaultItems).where(and(eq(vaultItems.id, id), eq(vaultItems.userId, userId)));
    return json({ success: true });
  } catch (err) {
    console.error("[VaultAPI DELETE Error]:", err);
    return json({ error: err.message }, { status: 500 });
  }
};
export {
  DELETE,
  GET,
  PATCH,
  POST
};
