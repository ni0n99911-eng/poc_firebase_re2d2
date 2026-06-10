import { json } from "@sveltejs/kit";
import { d as db, r as recommendationFeedback } from "../../../../chunks/db-server.js";
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      component,
      itemId,
      feedback,
      sessionId,
      userId,
      context
    } = body;
    if (!component || !feedback) {
      return json({ error: "Missing required fields: component, feedback" }, { status: 400 });
    }
    if (!["helpful", "not_helpful"].includes(feedback)) {
      return json({ error: 'feedback must be "helpful" or "not_helpful"' }, { status: 400 });
    }
    const validComponents = ["heads_up", "playbook", "verdict", "business_model"];
    if (!validComponents.includes(component)) {
      return json({ error: `component must be one of: ${validComponents.join(", ")}` }, { status: 400 });
    }
    await db.insert(recommendationFeedback).values({
      id: crypto.randomUUID(),
      userId: userId || "anonymous",
      recommendationId: null,
      feedback,
      data: {
        recommendation_type: component,
        recommended_item: {
          component,
          item_id: itemId || null,
          snapshot_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        action: feedback === "helpful" ? "upvoted" : "downvoted",
        context: {
          session_id: sessionId || null,
          source: "feedback_button",
          ...context || {}
        },
        session_id: sessionId || null,
        component,
        item_id: itemId || null
      }
    });
    return json({ ok: true });
  } catch (err) {
    console.error("[Feedback API] Error:", err);
    return json({ ok: false, error: "Internal error" }, { status: 500 });
  }
};
const GET = async ({ url }) => {
  try {
    const component = url.searchParams.get("component");
    let data = await db.select().from(recommendationFeedback);
    if (component) {
      data = data.filter((r) => {
        const d = r.data || {};
        return d.component === component || d.recommendation_type === component;
      });
    }
    const count = data.length;
    const stats = {};
    for (const row of data || []) {
      const d = row.data || {};
      const comp = d.component || d.recommendation_type || "unknown";
      if (!stats[comp]) {
        stats[comp] = { helpful: 0, not_helpful: 0, total: 0 };
      }
      stats[comp].total++;
      if (row.feedback === "helpful" || d.action === "upvoted") {
        stats[comp].helpful++;
      } else {
        stats[comp].not_helpful++;
      }
    }
    return json({ stats, totalRecords: count });
  } catch (err) {
    console.error("[Feedback API] GET error:", err);
    return json({ error: "Internal error" }, { status: 500 });
  }
};
export {
  GET,
  POST
};
