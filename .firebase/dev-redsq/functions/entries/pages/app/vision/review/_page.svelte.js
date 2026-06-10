import { h as head } from "../../../../../chunks/index2.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("1792x3e", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Concept Review</title>`);
      });
    });
    $$renderer2.push(`<div class="page svelte-1792x3e"><div class="page-header svelte-1792x3e"><h1 class="svelte-1792x3e">Concept Review</h1> <p class="page-subtitle svelte-1792x3e">Summary of your inputs across the concept builder</p></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="loading svelte-1792x3e">Loading your concept data...</div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
