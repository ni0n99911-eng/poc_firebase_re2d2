import { h as head, b as attr, i as stringify } from "../../../chunks/index2.js";
import { S as SITE_CONFIG } from "../../../chunks/modules.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("1g5c4ak", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Pending Approval</title>`);
      });
    });
    $$renderer2.push(`<div class="pending-container svelte-1g5c4ak"><div class="pending-card svelte-1g5c4ak"><div class="brand svelte-1g5c4ak">RE²</div> <div class="pending-icon svelte-1g5c4ak"><svg width="64" height="64" viewBox="0 0 64 64" fill="none" class="svelte-1g5c4ak"><circle cx="32" cy="32" r="30" stroke="#0D7C6E" stroke-width="2" stroke-dasharray="6 4" opacity="0.3" class="svelte-1g5c4ak"></circle><circle cx="32" cy="32" r="22" stroke="#0D7C6E" stroke-width="2" opacity="0.15" class="svelte-1g5c4ak"></circle><text x="32" y="38" text-anchor="middle" font-size="28" class="svelte-1g5c4ak">⏳</text></svg></div> <h1 class="svelte-1g5c4ak">You're Almost In</h1> <p class="svelte-1g5c4ak">Your account has been created and our team has been notified. We typically review new accounts within a few hours.</p> <div class="steps svelte-1g5c4ak"><div class="step done svelte-1g5c4ak"><span class="step-check svelte-1g5c4ak">✓</span> <span class="svelte-1g5c4ak">Account created</span></div> <div class="step done svelte-1g5c4ak"><span class="step-check svelte-1g5c4ak">✓</span> <span class="svelte-1g5c4ak">Admin team notified</span></div> <div class="step active svelte-1g5c4ak"><span class="step-dot svelte-1g5c4ak"></span> <span class="svelte-1g5c4ak">Approval in progress</span></div> <div class="step future svelte-1g5c4ak"><span class="step-circle svelte-1g5c4ak"></span> <span class="svelte-1g5c4ak">Access granted</span></div></div> <p class="hint svelte-1g5c4ak">You'll receive an email at your registered address once your account is approved.</p> <div class="actions svelte-1g5c4ak"><a href="/login" class="back-link svelte-1g5c4ak">← Back to Login</a> <a${attr("href", `mailto:${stringify(SITE_CONFIG.emails.hello)}`)} class="contact-link svelte-1g5c4ak">Questions? Contact Us</a></div></div></div>`);
  });
}
export {
  _page as default
};
