import { error, json } from "@sveltejs/kit";
import { p as private_env } from "../../../../../chunks/private.js";
import { d as db } from "../../../../../chunks/db-server.js";
import { sql } from "drizzle-orm";
import { s as sendWelcomeEmail } from "../../../../../chunks/email.js";
import { g as getAdminEmails, f as fetchPricingTiers } from "../../../../../chunks/modules.js";
const CLERK_API_BASE = "https://api.clerk.com/v1";
function getClerkSecretKey() {
  const key = private_env.CLERK_SECRET_KEY;
  if (!key) {
    throw new Error("CLERK_SECRET_KEY environment variable is not set");
  }
  return key;
}
async function clerkRequest(method, endpoint, body) {
  const secretKey = getClerkSecretKey();
  const url = `${CLERK_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : void 0
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Clerk API error (${method} ${endpoint}):`, response.status, errorText);
    throw error(response.status, `Clerk API error: ${response.statusText}`);
  }
  return response.json();
}
const GET = async ({ request, locals, url }) => {
  const userId = locals.user?.id;
  let isSuperAdmin = false;
  if (userId) {
    try {
      const res = await db.execute(sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`);
      const userData = res.rows[0];
      isSuperAdmin = userData ? (await getAdminEmails()).includes(userData.email?.toLowerCase() ?? "") : false;
    } catch (err) {
      console.error("Waitlist user query error:", err);
    }
  }
  if (!isSuperAdmin) {
    throw error(403, "Admin access required");
  }
  try {
    const status = url.searchParams.get("status") || "pending";
    const response = await clerkRequest("GET", `/waitlist_entries?status=${status}`);
    return json({
      entries: response.data,
      total_count: response.total_count,
      status
    });
  } catch (err) {
    console.error("Waitlist GET error:", err);
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to fetch waitlist entries");
  }
};
const POST = async ({ request, locals }) => {
  const userId = locals.user?.id;
  let isSuperAdmin = false;
  if (userId) {
    try {
      const res = await db.execute(sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`);
      const userData = res.rows[0];
      isSuperAdmin = userData ? (await getAdminEmails()).includes(userData.email?.toLowerCase() ?? "") : false;
    } catch (err) {
      console.error("Waitlist user query error:", err);
    }
  }
  if (!isSuperAdmin) {
    throw error(403, "Admin access required");
  }
  try {
    const body = await request.json();
    console.warn("[WAITLIST] API request:", { action: body.action, waitlistId: body.waitlistId });
    switch (body.action) {
      case "approveWaitlist":
        return await approveWaitlist(body);
      case "denyWaitlist":
        return await denyWaitlist(body);
      default:
        throw error(400, `Unknown action: ${body.action}`);
    }
  } catch (err) {
    console.error("Waitlist API error:", err);
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};
async function approveWaitlist(req) {
  const { waitlistId } = req;
  try {
    await clerkRequest("POST", `/waitlist_entries/${waitlistId}/approve`, {
      notify: true
    });
  } catch (e) {
    console.warn("[WAITLIST] Approve endpoint failed, trying PATCH fallback");
    await clerkRequest("PATCH", `/waitlist_entries/${waitlistId}`, {
      status: "accepted"
    });
  }
  try {
    const entry = await clerkRequest("GET", `/waitlist_entries/${waitlistId}`);
    if (entry?.email_address) {
      try {
        const modules = [...(await fetchPricingTiers()).scout?.modules ?? ["location-einstein"]];
        const email = entry.email_address.toLowerCase();
        await db.execute(sql`
					INSERT INTO email_whitelist (email, modules, added_by) 
					VALUES (${email}, ${JSON.stringify(modules)}, 'waitlist-approval') 
					ON CONFLICT (email) DO UPDATE SET modules = EXCLUDED.modules
				`);
      } catch (whitelistErr) {
        console.warn("Could not auto-whitelist:", whitelistErr.message);
      }
      const name = entry.first_name || entry.email_address.split("@")[0];
      sendWelcomeEmail(name, entry.email_address).catch(
        (err) => console.error("[WAITLIST] Welcome email failed:", err)
      );
    }
  } catch (e) {
    console.warn("Could not fetch waitlist entry for whitelist:", e);
  }
  return json({
    success: true,
    message: "Waitlist entry approved and invite email sent"
  });
}
async function denyWaitlist(req) {
  const { waitlistId } = req;
  try {
    await clerkRequest("POST", `/waitlist_entries/${waitlistId}/deny`, {});
  } catch (e) {
    console.warn("[WAITLIST] Deny endpoint failed, trying PATCH fallback");
    await clerkRequest("PATCH", `/waitlist_entries/${waitlistId}`, {
      status: "rejected"
    });
  }
  return json({
    success: true,
    message: "Waitlist entry denied"
  });
}
export {
  GET,
  POST
};
