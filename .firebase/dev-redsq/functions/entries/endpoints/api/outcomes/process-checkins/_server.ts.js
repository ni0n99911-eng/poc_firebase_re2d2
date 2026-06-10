import { p as private_env } from "../../../../../chunks/private.js";
import { p as processCheckIns } from "../../../../../chunks/outcome-checkins.js";
const POST = async ({ request }) => {
  const cronSecret = private_env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const provided = authHeader?.replace("Bearer ", "");
    if (provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  try {
    const result = await processCheckIns();
    return new Response(JSON.stringify({
      ok: true,
      ...result,
      processedAt: (/* @__PURE__ */ new Date()).toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("[CRON] Process check-ins error:", err);
    return new Response(JSON.stringify({ error: "Processing failed" }), { status: 500 });
  }
};
export {
  POST
};
