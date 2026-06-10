import { redirect, error } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { p as private_env } from "../chunks/private.js";
import { d as db, u as users, m as moduleAccess, e as emailWhitelist } from "../chunks/db-server.js";
import { eq, and, inArray } from "drizzle-orm";
import { P as PUBLIC_ROUTES, a as getModuleForRoute, A as ALL_MODULES } from "../chunks/modules.js";
import { a as sendNewUserNotification } from "../chunks/email.js";
import * as Sentry from "@sentry/sveltekit";
import { g as getAdminAuth } from "../chunks/server.js";
if (private_env.SENTRY_DSN) {
  Sentry.init({
    dsn: private_env.SENTRY_DSN,
    environment: private_env.NODE_ENV || "production",
    tracesSampleRate: 0.2,
    enabled: private_env.NODE_ENV !== "development"
  });
}
const userCache = /* @__PURE__ */ new Map();
const USER_CACHE_TTL = 30 * 6e4;
function getCachedUser(userId) {
  const cached = userCache.get(userId);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > USER_CACHE_TTL) {
    userCache.delete(userId);
    return null;
  }
  return cached;
}
function setCachedUser(userId, data) {
  userCache.set(userId, { ...data, cachedAt: Date.now() });
  if (userCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of userCache) {
      if (now - v.cachedAt > USER_CACHE_TTL) userCache.delete(k);
    }
  }
}
const LEGACY_MODULES = {
  "coffee": [...ALL_MODULES],
  "personal": [],
  "work": [],
  "admin": []
};
async function migrateLegacyModules(userId, currentModules) {
  const legacyModulesArr = currentModules.filter((m) => m in LEGACY_MODULES);
  if (legacyModulesArr.length === 0) return currentModules;
  const newModules = /* @__PURE__ */ new Set();
  for (const legacy of legacyModulesArr) {
    for (const mod of LEGACY_MODULES[legacy]) {
      newModules.add(mod);
    }
  }
  for (const m of currentModules) {
    if (!(m in LEGACY_MODULES)) newModules.add(m);
  }
  try {
    await db.delete(moduleAccess).where(and(eq(moduleAccess.userId, userId), inArray(moduleAccess.module, legacyModulesArr)));
    if (newModules.size > 0) {
      const inserts = Array.from(newModules).map((module) => ({
        userId,
        module,
        grantedBy: "migration"
      }));
      await db.insert(moduleAccess).values(inserts).onConflictDoNothing();
    }
    return Array.from(newModules);
  } catch (err) {
    return currentModules;
  }
}
const authHandle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  if (path.startsWith("/_app")) {
    return resolve(event);
  }
  const isApiRoute = path.startsWith("/api/");
  if (isApiRoute && (path === "/api/geo" || path === "/api/notify" || path === "/api/session" || path === "/api/location-intel" || path === "/api/location-iq")) {
    return resolve(event);
  }
  if (PUBLIC_ROUTES.includes(path) || path === "/login") {
    const sessionToken2 = event.cookies.get("__session");
    if (sessionToken2) {
      try {
        const decodedClaims = await getAdminAuth().verifySessionCookie(sessionToken2, true);
        const userId = decodedClaims.uid;
        if (userId) {
          const cached = getCachedUser(userId);
          if (cached) {
            event.locals.user = {
              id: userId,
              name: cached.name,
              initials: cached.initials,
              role: cached.role,
              modules: cached.modules,
              plan: cached.plan || "free"
            };
          }
        }
      } catch (_e) {
      }
    }
    return resolve(event);
  }
  const sessionToken = event.cookies.get("__session");
  if (!sessionToken) {
    if (isApiRoute) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (path.startsWith("/app")) {
      event.locals.user = void 0;
      return resolve(event);
    }
    throw redirect(303, "/login");
  }
  try {
    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionToken, true);
    const userId = decodedClaims.uid;
    const cached = getCachedUser(userId);
    if (cached) {
      event.locals.user = {
        id: userId,
        name: cached.name,
        initials: cached.initials,
        role: cached.role,
        modules: cached.modules,
        plan: cached.plan || "free"
      };
      if (cached.role === "pending") {
        if (path !== "/pending" && !PUBLIC_ROUTES.includes(path)) {
          throw redirect(303, "/pending");
        }
      } else if (!cached.isSuperAdmin) {
        const requiredModule = getModuleForRoute(path);
        if (requiredModule && !cached.modules.includes(requiredModule)) {
          if (isApiRoute) {
            return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
          }
          throw error(403, "Access denied");
        }
      }
      return resolve(event);
    }
    const existingUserArr = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    const existingUser = existingUserArr.length > 0 ? existingUserArr[0] : null;
    const userEmail = decodedClaims.email || "";
    const userName = decodedClaims.name || userEmail || "User";
    const isSuperAdmin = true;
    if (!existingUser) {
      if (isSuperAdmin) {
        await db.insert(users).values({
          id: userId,
          email: userEmail,
          role: "owner"
        });
        const moduleInserts = ALL_MODULES.map((module) => ({
          userId,
          module,
          grantedBy: "system"
        }));
        await db.insert(moduleAccess).values(moduleInserts).onConflictDoNothing();
      }
    }
    if (existingUser && existingUser.role === "pending" && isSuperAdmin) {
      await db.update(users).set({ role: "owner" }).where(eq(users.id, userId));
      const moduleInserts = ALL_MODULES.map((module) => ({
        userId,
        module,
        grantedBy: "system"
      }));
      await db.insert(moduleAccess).values(moduleInserts).onConflictDoNothing();
    } else if (existingUser && existingUser.role === "pending") {
      throw redirect(303, "/pending");
    }
    const moduleAccessArr = await db.select({ module: moduleAccess.module }).from(moduleAccess).where(eq(moduleAccess.userId, userId));
    let userModules = moduleAccessArr.map((m) => m.module);
    userModules = await migrateLegacyModules(userId, userModules);
    if (isSuperAdmin) {
      userModules = [.../* @__PURE__ */ new Set([...userModules, ...ALL_MODULES])];
    }
    const initials = userName.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "U";
    event.locals.user = {
      id: userId,
      name: userName,
      initials,
      role: "member",
      modules: userModules,
      plan: "free"
    };
    setCachedUser(userId, {
      name: userName,
      initials,
      role: "member",
      modules: userModules,
      email: userEmail,
      isSuperAdmin,
      plan: "free"
    });
    if (!isSuperAdmin) ;
  } catch (err) {
    if (err.location || typeof err.status === "number" && err.status >= 300) {
      throw err;
    }
    console.error("Auth verification failed:", err);
    event.cookies.delete("__session", { path: "/" });
    if (isApiRoute) {
      return new Response(JSON.stringify({ error: "Invalid session: " + err.message }), { status: 401 });
    }
    throw error(500, `Auth verification failed: ${err.message || String(err)}`);
  }
  return resolve(event);
};
const handle = private_env.SENTRY_DSN ? sequence(Sentry.sentryHandle(), authHandle) : authHandle;
const handleError = Sentry.handleErrorWithSentry();
export {
  handle,
  handleError
};
