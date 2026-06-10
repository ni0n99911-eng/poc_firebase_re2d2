import { h as head, f as store_get, u as unsubscribe_stores } from "../../../../chunks/index2.js";
import { p as page } from "../../../../chunks/stores.js";
import { P as PageNav } from "../../../../chunks/PageNav.js";
import { D as DisclaimerBanner } from "../../../../chunks/DisclaimerBanner.js";
import { N as NavigationDrawer } from "../../../../chunks/NavigationDrawer.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    head("72v2i3", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Recommendations</title>`);
      });
    });
    $$renderer2.push(`<div class="rec-page svelte-72v2i3">`);
    DisclaimerBanner($$renderer2);
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="loading-state svelte-72v2i3">Loading recommendations...</div>`);
    }
    $$renderer2.push(`<!--]--> `);
    PageNav($$renderer2, {
      backHref: "/app/location",
      backLabel: "Your Score",
      nextHref: "/app/space",
      nextLabel: "Space IQ"
    });
    $$renderer2.push(`<!----></div> `);
    NavigationDrawer($$renderer2, {
      currentPath: store_get($$store_subs ??= {}, "$page", page).url.pathname
    });
    $$renderer2.push(`<!---->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
