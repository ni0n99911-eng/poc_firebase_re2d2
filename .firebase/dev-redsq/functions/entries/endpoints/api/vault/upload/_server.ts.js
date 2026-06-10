import { json } from "@sveltejs/kit";
import { d as db, v as vaultItems } from "../../../../../chunks/db-server.js";
import { a as getAdminApp } from "../../../../../chunks/server.js";
import crypto from "crypto";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  // .xlsx
];
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
const POST = async ({ request }) => {
  const userId = getUserId(request);
  if (!userId) return json({ error: "Unauthorized" }, { status: 401 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const propertyAddr = formData.get("property_addr") || "";
    const title = formData.get("title") || "";
    const tagsRaw = formData.get("tags") || "";
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
    if (!file) return json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return json({ error: "File too large (max 10MB)" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 100);
    const storagePath = `vault-files/${userId}/${Date.now()}-${safeName}`;
    const bucket = getAdminApp().storage().bucket();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const bucketFile = bucket.file(storagePath);
    await bucketFile.save(fileBuffer, {
      metadata: { contentType: file.type }
    });
    const itemId = crypto.randomUUID();
    const payload = {
      id: itemId,
      userId,
      propertyAddr,
      itemType: "file",
      title: title || file.name,
      body: "",
      filePath: storagePath,
      fileType: file.type,
      fileSize: file.size.toString(),
      tags,
      metadata: { originalName: file.name },
      pinned: "false"
    };
    await db.insert(vaultItems).values(payload);
    return json({ item: payload, storagePath });
  } catch (err) {
    console.error("[VaultUpload] Unexpected error:", err);
    return json({ error: err.message || "Upload failed" }, { status: 500 });
  }
};
export {
  POST
};
