import { h as head } from "../../../../chunks/index2.js";
/* empty css                                                          */
import { P as PageNav } from "../../../../chunks/PageNav.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("944c96", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Business</title>`);
      });
    });
    $$renderer2.push(`<div class="page svelte-944c96"><div class="page-header svelte-944c96"><h1 class="svelte-944c96">Scenarios</h1> <p class="page-subtitle svelte-944c96">Stress-test your Business Case across conservative, base, and optimistic outcomes</p></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="loading svelte-944c96"><p>Loading your business model...</p></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    PageNav($$renderer2, {
      backHref: "/app/financials",
      backLabel: "Financials",
      nextHref: "/app/dashboard",
      nextLabel: "Dashboard",
      nextIsGreen: true
    });
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _page as default
};
