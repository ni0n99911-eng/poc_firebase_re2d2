import { h as head, b as attr, e as escape_html, i as stringify } from "../../../../../chunks/index2.js";
import "../../../../../chunks/client2.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("nvjumd", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Location Report${escape_html("")}</title>`);
      });
      $$renderer3.push(`<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700&amp;display=swap" rel="stylesheet" class="svelte-nvjumd"/>`);
    });
    $$renderer2.push(`<div class="report-page svelte-nvjumd"><nav class="topbar svelte-nvjumd"><div class="topbar-left svelte-nvjumd"><a href="/app/welcome-back" class="logo svelte-nvjumd">RE<sup class="svelte-nvjumd">2</sup></a> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="topbar-right svelte-nvjumd"><a${attr("href", `/app/location${stringify("")}`)} class="btn-ghost svelte-nvjumd">← Back to Analysis</a></div></nav> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="loading-state svelte-nvjumd"><div class="spinner svelte-nvjumd"></div> <p class="svelte-nvjumd">Loading report…</p></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
