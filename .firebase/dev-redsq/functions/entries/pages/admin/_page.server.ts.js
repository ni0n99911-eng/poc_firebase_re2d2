import { error } from "@sveltejs/kit";
import { d as db } from "../../../chunks/db-server.js";
import { sql } from "drizzle-orm";
import { g as getAdminEmails } from "../../../chunks/modules.js";
const load = async ({ locals }) => {
  let isSuperAdmin = false;
  if (locals.user?.id) {
    try {
      const res = await db.execute(sql`SELECT email FROM users WHERE id = ${locals.user.id} LIMIT 1`);
      const userData = res.rows[0];
      isSuperAdmin = userData ? (await getAdminEmails()).includes(userData.email?.toLowerCase() ?? "") : false;
    } catch (err) {
      console.error("Error fetching admin status:", err);
    }
  }
  if (!isSuperAdmin) {
    throw error(403, "Access denied. Admin access required.");
  }
  try {
    const [usersResult, modulesResult, whitelistResult] = await Promise.allSettled([
      db.execute(sql`SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC`),
      db.execute(sql`SELECT user_id, module FROM module_access`),
      db.execute(sql`SELECT id, email, modules, added_by, created_at FROM email_whitelist ORDER BY created_at DESC`)
    ]);
    if (usersResult.status === "rejected") {
      console.error("Error fetching users:", usersResult.reason);
      throw error(500, "Failed to load users");
    }
    if (modulesResult.status === "rejected") {
      console.error("Error fetching modules:", modulesResult.reason);
    }
    if (whitelistResult.status === "rejected") {
      console.error("Error fetching whitelist:", whitelistResult.reason);
    }
    const usersData = usersResult.status === "fulfilled" ? usersResult.value.rows : [];
    const modulesData = modulesResult.status === "fulfilled" ? modulesResult.value.rows : [];
    const whitelistData = whitelistResult.status === "fulfilled" ? whitelistResult.value.rows : [];
    const modulesByUser = /* @__PURE__ */ new Map();
    for (const row of modulesData) {
      const existing = modulesByUser.get(row.user_id);
      if (existing) {
        existing.push(row.module);
      } else {
        modulesByUser.set(row.user_id, [row.module]);
      }
    }
    const usersWithModules = usersData.map((user) => ({
      ...user,
      modules: modulesByUser.get(user.id) || []
    }));
    return {
      users: usersWithModules,
      whitelist: whitelistData
    };
  } catch (err) {
    console.error("Admin page load error:", err);
    throw error(500, "Failed to load admin data");
  }
};
export {
  load
};
