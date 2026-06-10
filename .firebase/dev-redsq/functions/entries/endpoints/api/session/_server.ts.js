import { json } from "@sveltejs/kit";
import { g as getAdminAuth } from "../../../../chunks/server.js";
const SESSION_COOKIE_NAME = "__session";
const POST = async ({ request, cookies }) => {
  try {
    const { idToken } = await request.json();
    await getAdminAuth().verifyIdToken(idToken);
    const expiresIn = 60 * 60 * 24 * 5 * 1e3;
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });
    cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: expiresIn / 1e3,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax"
    });
    return json({ status: "success" });
  } catch (error) {
    console.error("Session creation failed:", error);
    return json({ error: "Unauthorized request: " + (error.message || "Unknown error") }, { status: 401 });
  }
};
const DELETE = async ({ cookies }) => {
  cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
  return json({ status: "success" });
};
export {
  DELETE,
  POST
};
