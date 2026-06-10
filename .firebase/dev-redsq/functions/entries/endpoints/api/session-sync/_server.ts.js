import { error, json } from "@sveltejs/kit";
import { d as db, k as founderSessions } from "../../../../chunks/db-server.js";
import { eq } from "drizzle-orm";
const POST = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.id) {
    throw error(401, "Authentication required");
  }
  const body = await request.json();
  const { chatStore, session, launchpad, journeyState, shortlistedLocations } = body;
  if (!chatStore && !session && !launchpad && !journeyState && !shortlistedLocations) {
    throw error(400, "No data provided. Send chatStore, session, launchpad, journeyState, or shortlistedLocations.");
  }
  try {
    const existingArr = await db.select({ fullData: founderSessions.fullData }).from(founderSessions).where(eq(founderSessions.userId, user.id)).limit(1);
    const existingData = (existingArr.length > 0 ? existingArr[0].fullData : {}) || {};
    const merged = { ...existingData };
    if (chatStore) merged.chatStore = chatStore;
    if (session) merged.session = session;
    if (launchpad) merged.launchpad = launchpad;
    const personaType = session?.personaType || chatStore?.extractedData?.personaType || existingData?.session?.personaType || null;
    const conceptDesc = session?.conceptDescription || chatStore?.extractedData?.conceptDescription || existingData?.session?.conceptDescription || null;
    const address = session?.locationData?.address || existingData?.session?.locationData?.address || null;
    const upsertPayload = {
      userId: user.id,
      sessionId: session?.sessionId || chatStore?.sessionId || existingData?.session?.sessionId || `sess_${user.id}`,
      personaType,
      conceptDescription: conceptDesc,
      address,
      fullData: merged,
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (journeyState) upsertPayload.journeyState = journeyState;
    if (shortlistedLocations) upsertPayload.shortlistedLocations = shortlistedLocations;
    await db.insert(founderSessions).values(upsertPayload).onConflictDoUpdate({
      target: founderSessions.userId,
      set: upsertPayload
    });
    return json({ ok: true });
  } catch (err) {
    console.error("[session-sync] Error:", err);
    return json({ ok: false, error: err.message || "Internal error" }, { status: 500 });
  }
};
const GET = async ({ locals }) => {
  const user = locals.user;
  if (!user?.id) {
    throw error(401, "Authentication required");
  }
  try {
    const existingArr = await db.select({
      fullData: founderSessions.fullData,
      journeyState: founderSessions.journeyState,
      shortlistedLocations: founderSessions.shortlistedLocations,
      updatedAt: founderSessions.updatedAt,
      createdAt: founderSessions.createdAt
    }).from(founderSessions).where(eq(founderSessions.userId, user.id)).limit(1);
    if (existingArr.length === 0) {
      return json({ found: false, data: null });
    }
    const data = existingArr[0];
    return json({
      found: true,
      data: data.fullData || null,
      journeyState: data.journeyState || null,
      shortlistedLocations: data.shortlistedLocations || [],
      updatedAt: data.updatedAt,
      createdAt: data.createdAt
    });
  } catch (err) {
    console.error("[session-sync] Error:", err);
    return json({ found: false, data: null, error: "Internal error" }, { status: 500 });
  }
};
export {
  GET,
  POST
};
