import { json } from "@sveltejs/kit";
import { s as sendWelcomeEmail, a as sendNewUserNotification } from "../../../../chunks/email.js";
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { type, name, email } = body;
    if (!type || !name || !email) {
      return json(
        { error: "Missing required fields: type, name, email" },
        { status: 400 }
      );
    }
    switch (type) {
      case "new_user":
        await sendNewUserNotification(name, email);
        break;
      case "user_approved":
        await sendWelcomeEmail(name, email);
        break;
      default:
        console.warn(`[NOTIFY] Unknown type: ${type}`, { name, email });
    }
    return json({ success: true, message: `Notification processed for ${type}` });
  } catch (err) {
    console.error("[NOTIFY API ERROR]", err);
    return json(
      { error: "Failed to process notification" },
      { status: 500 }
    );
  }
};
export {
  POST
};
