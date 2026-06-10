import { h as head, e as escape_html, b as attr, i as stringify } from "../../../chunks/index2.js";
import { S as SiteNav } from "../../../chunks/SiteNav.js";
import { S as SITE_CONFIG } from "../../../chunks/modules.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("7ke6fz", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Privacy Policy</title>`);
      });
    });
    SiteNav($$renderer2);
    $$renderer2.push(`<!----> <main class="svelte-7ke6fz"><div class="container svelte-7ke6fz"><h1 class="svelte-7ke6fz">Privacy Policy</h1> <p class="effective-date svelte-7ke6fz">Effective Date: March 23, 2026 · Last Updated: March 23, 2026</p> <p class="intro svelte-7ke6fz">${escape_html(SITE_CONFIG.company)} ("we," "us," or "our") operates RE² at ${escape_html(SITE_CONFIG.domain)}.
			This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data.</p> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">1. Information We Collect</h2> <h3 class="svelte-7ke6fz">Information You Provide</h3> <ul class="svelte-7ke6fz"><li class="svelte-7ke6fz"><strong>Account information:</strong> name, email address (collected via Clerk authentication)</li> <li class="svelte-7ke6fz"><strong>Business information:</strong> business concept, target market, financial details, location preferences</li> <li class="svelte-7ke6fz"><strong>Uploaded documents:</strong> brochures, lease agreements, or other files you choose to upload</li> <li class="svelte-7ke6fz"><strong>Communications:</strong> emails, feedback, or support requests you send us</li></ul> <h3 class="svelte-7ke6fz">Information Collected Automatically</h3> <ul class="svelte-7ke6fz"><li class="svelte-7ke6fz"><strong>Usage data:</strong> pages visited, features used, time spent, button clicks</li> <li class="svelte-7ke6fz"><strong>Device information:</strong> browser type, operating system, screen resolution</li> <li class="svelte-7ke6fz"><strong>Log data:</strong> IP address, access times, referring URLs</li></ul></section> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">2. How We Use Your Information</h2> <p class="svelte-7ke6fz">We use your information to: (a) provide and improve the Service; (b) generate personalized
				analyses, scores, and recommendations; (c) process your data through AI models to create
				business plans, financial projections, and loan documents; (d) communicate with you about
				your account and updates; (e) analyze usage patterns to improve the platform; (f) comply
				with legal obligations.</p></section> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">3. AI Processing</h2> <p class="svelte-7ke6fz">Your business data is processed by AI models (including third-party AI services such as
				Anthropic's Claude API) to generate analyses and recommendations. Data sent to AI services
				is used solely for processing your request and is subject to those services' data handling
				policies. We do not use your business data to train AI models.</p></section> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">4. Data Sharing</h2> <p class="highlight svelte-7ke6fz"><strong>We do NOT sell your personal data.</strong></p> <p class="svelte-7ke6fz">We may share data with: (a) service providers who help us operate the platform (Clerk for
				authentication, Vercel for hosting, Anthropic for AI processing); (b) as required by law,
				regulation, or legal process; (c) to protect the rights, property, or safety of ${escape_html(SITE_CONFIG.company)},
				our users, or the public.</p></section> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">5. Data Retention</h2> <p class="svelte-7ke6fz">We retain your account data and generated analyses for as long as your account is active.
				You may request deletion of your data at any time by contacting <a${attr("href", `mailto:${stringify(SITE_CONFIG.emails.support)}`)} class="svelte-7ke6fz">${escape_html(SITE_CONFIG.emails.support)}</a>.
				We will delete your data within 30 days of a verified request, except where retention is required by law.</p></section> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">6. Data Security</h2> <p class="svelte-7ke6fz">We implement industry-standard security measures including encryption in transit (TLS),
				secure authentication (Clerk), and access controls. However, no system is 100% secure,
				and we cannot guarantee absolute security of your data.</p></section> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">7. Cookies and Tracking</h2> <p class="svelte-7ke6fz">We use essential cookies for authentication and session management. We may use analytics tools
				to understand how the Service is used. You can control cookie settings through your browser.</p></section> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">8. Your Rights</h2> <p class="svelte-7ke6fz">Depending on your location, you may have the right to: (a) access your personal data;
				(b) correct inaccurate data; (c) delete your data; (d) export your data in a portable format;
				(e) opt out of certain data processing. To exercise these rights, contact <a${attr("href", `mailto:${stringify(SITE_CONFIG.emails.support)}`)} class="svelte-7ke6fz">${escape_html(SITE_CONFIG.emails.support)}</a>.</p></section> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">9. California Residents (CCPA)</h2> <p class="svelte-7ke6fz">If you are a California resident, you have the right to: know what personal information we collect;
				request deletion of your data; opt out of the sale of personal information (we do not sell your data);
				and not be discriminated against for exercising these rights.</p></section> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">10. Children's Privacy</h2> <p class="svelte-7ke6fz">The Service is not intended for users under 18 years of age. We do not knowingly collect
				data from children. If you believe we have collected data from a minor, contact us immediately.</p></section> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">11. Changes to This Policy</h2> <p class="svelte-7ke6fz">We may update this Privacy Policy from time to time. We will notify you of material changes
				via email or in-app notification. Your continued use of the Service after changes constitutes acceptance.</p></section> <section class="svelte-7ke6fz"><h2 class="svelte-7ke6fz">12. Contact Us</h2> <p class="svelte-7ke6fz">For privacy-related questions or requests: <a${attr("href", `mailto:${stringify(SITE_CONFIG.emails.support)}`)} class="svelte-7ke6fz">${escape_html(SITE_CONFIG.emails.support)}</a></p></section></div></main>`);
  });
}
export {
  _page as default
};
