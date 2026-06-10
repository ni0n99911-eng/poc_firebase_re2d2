import { h as head, b as attr, e as escape_html, i as stringify } from "../../../chunks/index2.js";
import { S as SiteNav } from "../../../chunks/SiteNav.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import { S as SITE_CONFIG } from "../../../chunks/modules.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let form = {
      name: "",
      email: "",
      businessType: "",
      neighborhood: "",
      project: ""
    };
    let submitted = false;
    head("1bv7ezn", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Contact</title>`);
      });
    });
    SiteNav($$renderer2);
    $$renderer2.push(`<!----> <div class="container svelte-1bv7ezn"><section class="hero svelte-1bv7ezn"><h1 class="headline svelte-1bv7ezn">Get in touch</h1> <p class="subtext svelte-1bv7ezn">Whether you're a founder, broker, or lender — we'd love to hear from you.</p></section> <div class="content-grid svelte-1bv7ezn"><div class="form-column svelte-1bv7ezn"><form><div class="form-group svelte-1bv7ezn"><label for="name" class="svelte-1bv7ezn">Name</label> <input id="name" type="text" placeholder="Your name"${attr("value", form.name)}${attr("disabled", submitted, true)} required="" class="svelte-1bv7ezn"/></div> <div class="form-group svelte-1bv7ezn"><label for="email" class="svelte-1bv7ezn">Email</label> <input id="email" type="email" placeholder="your@email.com"${attr("value", form.email)}${attr("disabled", submitted, true)} required="" class="svelte-1bv7ezn"/></div> <div class="form-group svelte-1bv7ezn"><label for="businessType" class="svelte-1bv7ezn">Business type</label> `);
    $$renderer2.select(
      {
        id: "businessType",
        value: form.businessType,
        disabled: submitted,
        required: true,
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`Select a type`);
        });
        $$renderer3.option({ value: "Coffee/Café" }, ($$renderer4) => {
          $$renderer4.push(`Coffee/Café`);
        });
        $$renderer3.option({ value: "Restaurant" }, ($$renderer4) => {
          $$renderer4.push(`Restaurant`);
        });
        $$renderer3.option({ value: "Retail" }, ($$renderer4) => {
          $$renderer4.push(`Retail`);
        });
        $$renderer3.option({ value: "Fitness" }, ($$renderer4) => {
          $$renderer4.push(`Fitness`);
        });
        $$renderer3.option({ value: "Professional Services" }, ($$renderer4) => {
          $$renderer4.push(`Professional Services`);
        });
        $$renderer3.option({ value: "Other" }, ($$renderer4) => {
          $$renderer4.push(`Other`);
        });
      },
      "svelte-1bv7ezn"
    );
    $$renderer2.push(`</div> <div class="form-group svelte-1bv7ezn"><label for="neighborhood" class="svelte-1bv7ezn">Target neighborhood</label> <input id="neighborhood" type="text" placeholder="e.g., Marina District, Downtown"${attr("value", form.neighborhood)}${attr("disabled", submitted, true)} required="" class="svelte-1bv7ezn"/></div> <div class="form-group svelte-1bv7ezn"><label for="project" class="svelte-1bv7ezn">Tell us about your project</label> <textarea id="project" placeholder="Share details about your vision and goals..."${attr("disabled", submitted, true)} required="" class="svelte-1bv7ezn">`);
    const $$body = escape_html(form.project);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea></div> <button type="submit" class="submit-btn svelte-1bv7ezn"${attr("disabled", submitted, true)}>${escape_html("Send Message")}</button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></form></div> <div class="info-column svelte-1bv7ezn"><div class="contact-info svelte-1bv7ezn"><div class="info-block svelte-1bv7ezn"><h3 class="svelte-1bv7ezn">General inquiries</h3> <a${attr("href", `mailto:${stringify(SITE_CONFIG.emails.hello)}`)} class="email-link svelte-1bv7ezn" data-sveltekit-reload="">${escape_html(SITE_CONFIG.emails.hello)}</a></div> <div class="info-block svelte-1bv7ezn"><h3 class="svelte-1bv7ezn">Enterprise &amp; teams</h3> <a${attr("href", `mailto:${stringify(SITE_CONFIG.emails.enterprise)}`)} class="email-link svelte-1bv7ezn" data-sveltekit-reload="">${escape_html(SITE_CONFIG.emails.enterprise)}</a></div> <div class="info-block response-time svelte-1bv7ezn"><p class="svelte-1bv7ezn">We respond within 24 hours</p></div></div></div></div></div>`);
  });
}
export {
  _page as default
};
