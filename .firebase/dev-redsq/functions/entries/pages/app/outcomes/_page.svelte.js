import { h as head } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("9gpk5i", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Outcome Tracking</title>`);
      });
    });
    $$renderer2.push(`<div class="outcomes-page svelte-9gpk5i"><header class="page-header svelte-9gpk5i"><div><h1 class="svelte-9gpk5i">Outcome Tracking</h1> <p class="subtitle svelte-9gpk5i">How did your scored locations perform in the real world?</p></div></header> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="loading svelte-9gpk5i">Loading your scored locations...</div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
