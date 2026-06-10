import { error, json } from "@sveltejs/kit";
import { d as db, u as users, e as emailWhitelist, m as moduleAccess } from "../../../../chunks/db-server.js";
import { s as sendWelcomeEmail } from "../../../../chunks/email.js";
import { g as getAdminEmails } from "../../../../chunks/modules.js";
import { eq, and } from "drizzle-orm";
const POST = async ({ request, locals }) => {
  const userId = locals.user?.id;
  let isSuperAdmin = false;
  if (userId) {
    const userDataArr = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    const userData = userDataArr[0];
    isSuperAdmin = userData ? (await getAdminEmails()).includes(userData.email?.toLowerCase() ?? "") : false;
  }
  if (!isSuperAdmin) {
    throw error(403, "Admin access required");
  }
  try {
    const body = await request.json();
    console.warn("[ADMIN] API request:", { action: body.action, userId });
    switch (body.action) {
      case "approveUser":
        return await approveUser(body);
      case "denyUser":
        return await denyUser(body);
      case "updateModules":
        return await updateModules(body);
      case "changeRole":
        return await changeRole(body);
      case "deleteUser":
        return await deleteUser(body);
      case "addWhitelist":
        return await addWhitelist(body, userId || "");
      case "removeWhitelist":
        return await removeWhitelist(body);
      case "updateWhitelistModules":
        return await updateWhitelistModules(body);
      default:
        throw error(400, `Unknown action: ${body.action}`);
    }
  } catch (err) {
    console.error("Admin API error:", err);
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};
async function approveUser(req) {
  const { userId, role = "member", modules = [] } = req;
  const userDataArr = await db.select({ name: users.email, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const userData = userDataArr[0];
  try {
    await db.update(users).set({ role }).where(eq(users.id, userId));
  } catch (roleError) {
    throw error(500, `Failed to approve user: ${roleError.message}`);
  }
  if (modules.length > 0) {
    const moduleInserts = modules.map((module) => ({
      userId,
      module,
      grantedBy: userId
      // Self-granted by admin
    }));
    try {
      for (const mod of moduleInserts) {
        await db.insert(moduleAccess).values(mod).onConflictDoNothing();
      }
    } catch (modulesError) {
      throw error(500, `Failed to grant modules: ${modulesError.message}`);
    }
  }
  if (userData?.email) {
    sendWelcomeEmail(userData.name || "there", userData.email).catch(
      (err) => console.error("[APPROVE] Welcome email failed:", err)
    );
  }
  return json({ success: true, message: "User approved and welcome email sent" });
}
async function denyUser(req) {
  const { userId } = req;
  try {
    await db.delete(moduleAccess).where(eq(moduleAccess.userId, userId));
  } catch (accessError) {
    throw error(500, `Failed to revoke access: ${accessError.message}`);
  }
  try {
    await db.delete(users).where(eq(users.id, userId));
  } catch (userError) {
    throw error(500, `Failed to delete user: ${userError.message}`);
  }
  return json({ success: true, message: "User denied and removed" });
}
async function updateModules(req) {
  const { userId, module, grant } = req;
  if (grant) {
    try {
      await db.insert(moduleAccess).values({
        userId,
        module,
        grantedBy: userId
      }).onConflictDoNothing();
    } catch (grantError) {
      console.error("Grant module error:", grantError);
      throw error(500, `Failed to grant module: ${grantError.message}`);
    }
  } else {
    try {
      await db.delete(moduleAccess).where(and(eq(moduleAccess.userId, userId), eq(moduleAccess.module, module)));
    } catch (revokeError) {
      throw error(500, `Failed to revoke module: ${revokeError.message}`);
    }
  }
  return json({ success: true, message: `Module ${grant ? "granted" : "revoked"}` });
}
async function changeRole(req) {
  const { userId, role } = req;
  try {
    await db.update(users).set({ role }).where(eq(users.id, userId));
  } catch (err) {
    throw error(500, `Failed to change role: ${err.message}`);
  }
  return json({ success: true, message: "Role updated" });
}
async function deleteUser(req) {
  const { userId } = req;
  try {
    await db.delete(moduleAccess).where(eq(moduleAccess.userId, userId));
  } catch (accessError) {
    throw error(500, `Failed to revoke access: ${accessError.message}`);
  }
  try {
    await db.delete(users).where(eq(users.id, userId));
  } catch (userError) {
    throw error(500, `Failed to delete user: ${userError.message}`);
  }
  return json({ success: true, message: "User deleted" });
}
async function addWhitelist(req, adminId) {
  const { email, modules = [] } = req;
  try {
    await db.insert(emailWhitelist).values({
      email: email.toLowerCase(),
      modules
    }).onConflictDoNothing();
  } catch (err) {
    throw error(500, `Failed to add whitelist: ${err.message}`);
  }
  return json({ success: true, message: "Email added to whitelist" });
}
async function removeWhitelist(req) {
  const { email } = req;
  try {
    await db.delete(emailWhitelist).where(eq(emailWhitelist.email, email.toLowerCase()));
  } catch (err) {
    throw error(500, `Failed to remove whitelist: ${err.message}`);
  }
  return json({ success: true, message: "Email removed from whitelist" });
}
async function updateWhitelistModules(req) {
  const { email, modules } = req;
  try {
    await db.update(emailWhitelist).set({ modules }).where(eq(emailWhitelist.email, email.toLowerCase()));
  } catch (err) {
    throw error(500, `Failed to update modules: ${err.message}`);
  }
  return json({ success: true, message: "Whitelist modules updated" });
}
export {
  POST
};
