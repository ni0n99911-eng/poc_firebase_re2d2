import { Resend } from "resend";
import { p as private_env } from "./private.js";
import { S as SITE_CONFIG, g as getAdminEmails } from "./modules.js";
function getResendClient() {
  const key = private_env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}
function getFromAddress() {
  return private_env.RESEND_FROM_ADDRESS || "RE² <onboarding@resend.dev>";
}
async function sendWelcomeEmail(name, email) {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[EMAIL] Welcome email skipped (no API key) for ${email}`);
    return;
  }
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: [email],
    subject: `✅ Welcome to RE² — Your Account is Active`,
    html: `
			<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
				<div style="background: linear-gradient(135deg, #0a0b10, #12131a); border-radius: 12px; padding: 32px; color: #d4d6e3;">
					<h1 style="color: #4CAF50; margin: 0 0 8px 0; font-size: 24px;">Welcome to RE², ${name}!</h1>
					<p style="color: #8a8d9d; margin: 0 0 24px 0; font-size: 14px;">Your account has been approved and is ready to use.</p>

					<a href="${SITE_CONFIG.url}/app/location" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #2d5a27, #4CAF50); color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;">
						Start Your Analysis →
					</a>

					<p style="color: #8a8d9d; font-size: 13px; margin-top: 24px;">
						Begin with your Founder Profile to calibrate RE²'s scoring engines to your specific business concept.
					</p>
				</div>
				<p style="color: #666; font-size: 11px; text-align: center; margin-top: 16px;">
					${SITE_CONFIG.name} — ${SITE_CONFIG.tagline} | ${SITE_CONFIG.domain}
				</p>
			</div>
		`
  });
  if (error) {
    console.error("[EMAIL] Welcome email failed:", error);
  } else {
    console.log(`[EMAIL] Welcome email sent to ${email}, ID: ${data?.id}`);
  }
}
async function sendNewUserNotification(name, email) {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[EMAIL] Admin notification skipped (no API key) for ${email}`);
    return;
  }
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: await getAdminEmails(),
    subject: `🆕 New User Pending Approval: ${name}`,
    html: `
			<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
				<div style="background: linear-gradient(135deg, #0a0b10, #12131a); border-radius: 12px; padding: 32px; color: #d4d6e3;">
					<h1 style="color: #00BCD4; margin: 0 0 8px 0; font-size: 24px;">New User Pending</h1>
					<p style="color: #8a8d9d; margin: 0 0 24px 0; font-size: 14px;">A new user has signed up and is waiting for approval.</p>

					<div style="background: rgba(0, 188, 212, 0.08); border: 1px solid rgba(0, 188, 212, 0.2); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
						<p style="margin: 0 0 8px 0;"><strong style="color: #00BCD4;">Name:</strong> <span style="color: #e0e0e0;">${name}</span></p>
						<p style="margin: 0;"><strong style="color: #00BCD4;">Email:</strong> <span style="color: #e0e0e0;">${email}</span></p>
					</div>

					<p style="color: #8a8d9d; font-size: 13px; margin: 0;">
						To approve this user, go to the <a href="${SITE_CONFIG.url}/admin" style="color: #00BCD4;">Admin Dashboard</a> and update their status.
					</p>
				</div>
				<p style="color: #666; font-size: 11px; text-align: center; margin-top: 16px;">
					${SITE_CONFIG.name} — ${SITE_CONFIG.tagline} | ${SITE_CONFIG.domain}
				</p>
			</div>
		`
  });
  if (error) {
    console.error("[EMAIL] Admin notification failed:", error);
  } else {
    console.log(`[EMAIL] Admin notification sent, ID: ${data?.id}`);
  }
}
export {
  sendNewUserNotification as a,
  sendWelcomeEmail as s
};
