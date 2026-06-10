import { r as requireAuth } from "../../../../chunks/auth-middleware.js";
import { d as db, l as clientProfiles } from "../../../../chunks/db-server.js";
function deriveBudgetRange(monthlyRent) {
  if (!monthlyRent || monthlyRent <= 0) return null;
  if (monthlyRent < 3e3) return "under_3k";
  if (monthlyRent < 5e3) return "3k_5k";
  if (monthlyRent < 1e4) return "5k_10k";
  return "10k_plus";
}
function parseNeighborhoods(raw) {
  if (!raw?.trim()) return null;
  const parts = raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : null;
}
const POST = async ({ request }) => {
  const auth = await requireAuth(request);
  if ("response" in auth) return auth.response;
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const sqft = body.financialGoals?.squareFootage ?? 0;
  const payload = {
    user_id: auth.userId,
    // Business identity
    business_name: body.businessName || null,
    business_type: body.businessType || null,
    concept_description: body.differentiator || body.visionStatement || null,
    // Location preferences
    target_neighborhoods: parseNeighborhoods(body.preferredNeighborhoods),
    budget_range: deriveBudgetRange(body.financialGoals?.monthlyRentBudget ?? 0),
    // Space requirements
    preferred_square_footage_min: sqft > 0 ? sqft : null,
    preferred_square_footage_max: sqft > 0 ? Math.round(sqft * 1.5) : null,
    // Hard requirements (from sacred flags)
    requires_outdoor_seating: body.sacred?.["outdoor_seating"] ?? false,
    requires_liquor_license: body.sacred?.["liquor_license"] ?? false,
    // Onboarding status
    onboarding_completed: true,
    onboarding_step: 10
  };
  try {
    await db.insert(clientProfiles).values({ userId: auth.userId, data: payload }).onConflictDoUpdate({ target: clientProfiles.userId, set: { data: payload } });
  } catch (error) {
    console.error("[profile-sync] upsert failed:", error.message, error.code);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
};
export {
  POST
};
