import { redirect } from "@sveltejs/kit";
import { d as db, k as founderSessions } from "../../../../chunks/db-server.js";
import { eq } from "drizzle-orm";
const load = async ({ locals }) => {
  const user = locals.user;
  if (!user?.id) {
    throw redirect(303, "/login");
  }
  try {
    const existingArr = await db.select({
      fullData: founderSessions.fullData,
      updatedAt: founderSessions.updatedAt,
      createdAt: founderSessions.createdAt
    }).from(founderSessions).where(eq(founderSessions.userId, user.id)).limit(1);
    const data = existingArr.length > 0 ? existingArr[0] : null;
    const rawData = data?.fullData;
    if (!rawData) {
      throw redirect(303, "/app/onboarding");
    }
    const sessionData = rawData;
    const chatStore = sessionData.chatStore;
    const session = sessionData.session;
    const launchpad = sessionData.launchpad;
    const hasPersona = !!(session?.personaType || chatStore?.extractedData?.personaType || launchpad?.businessType || // FIX-NAV-02: current launchpad-store writes businessType at top level
    sessionData.businessType);
    const hasChat = !!(chatStore?.messages && chatStore.messages.length > 1);
    const hasLaunchpad = !!(launchpad?.businessType || sessionData.businessType);
    if (!hasPersona && !hasChat && !hasLaunchpad) {
      throw redirect(303, "/app/onboarding");
    }
    const locationIQ = sessionData.locationIQ || session?.locationIQ || 0;
    const analyzedAddress = sessionData.analyzedAddress || session?.analyzedAddress || "";
    const legacyAddress = session?.locationData?.address || null;
    const legacyScore = session?.locationData?.compositeScore || null;
    const recap = {
      personaType: sessionData.businessType || session?.personaType || chatStore?.extractedData?.personaType || launchpad?.businessType || null,
      personaKey: sessionData.businessType || session?.personaKey || chatStore?.personaKey || null,
      conceptDescription: sessionData.differentiator || sessionData.visionStatement || session?.conceptDescription || chatStore?.extractedData?.conceptDescription || launchpad?.visionStatement || null,
      conceptName: chatStore?.extractedData?.conceptName || null,
      targetCustomers: chatStore?.extractedData?.targetCustomers || [],
      differentiators: chatStore?.extractedData?.differentiators || [],
      financialEstimates: chatStore?.extractedData?.financialEstimates || sessionData.financialGoals || session?.smartDefaults || null,
      // FIX-NAV-02: prefer current field names, fall back to legacy
      lastAddress: analyzedAddress || legacyAddress,
      lastScore: locationIQ || legacyScore,
      lastVerdict: sessionData.lastVerdict || session?.verdict || null,
      hasComparisonLocations: !!(sessionData.scoredLocations && sessionData.scoredLocations.length > 1),
      conversationPhase: chatStore?.conversationPhase || null,
      updatedAt: data?.updatedAt,
      createdAt: data?.createdAt
    };
    return {
      recap,
      userName: user.name || user.firstName || "there"
    };
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) throw err;
    console.error("[welcome-back] Error loading recap:", err);
    throw redirect(303, "/app/onboarding");
  }
};
export {
  load
};
