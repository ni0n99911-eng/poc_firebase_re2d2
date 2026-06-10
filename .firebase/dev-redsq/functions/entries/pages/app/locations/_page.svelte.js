import { h as head, e as escape_html, c as attr_class, b as attr, f as store_get, u as unsubscribe_stores, d as derived } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { p as page } from "../../../../chunks/index4.js";
import { g as getConceptLabel } from "../../../../chunks/concepts.js";
import { N as NavigationDrawer } from "../../../../chunks/NavigationDrawer.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let locations = [];
    let bizType = "";
    let selectedAddrs = [];
    let canCompare = derived(() => selectedAddrs.length === 2);
    let conceptLabel = derived(() => getConceptLabel(bizType));
    head("1yxwj23", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — My Locations</title>`);
      });
      $$renderer3.push(`<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700&amp;display=swap" rel="stylesheet" class="svelte-1yxwj23"/>`);
    });
    $$renderer2.push(`<div class="page svelte-1yxwj23"><nav class="topbar svelte-1yxwj23"><div class="topbar-left svelte-1yxwj23"><a href="/app/welcome-back" class="logo svelte-1yxwj23">RE<sup class="svelte-1yxwj23">2</sup></a> <span class="nav-sep svelte-1yxwj23">›</span> <span class="nav-label svelte-1yxwj23">My Locations</span></div> <div class="topbar-right svelte-1yxwj23"><a href="/app/dashboard" class="btn-ghost svelte-1yxwj23">← Dashboard</a> <a href="/app/location" class="btn-teal svelte-1yxwj23">+ Score New Location</a></div></nav> <div class="page-body svelte-1yxwj23"><div class="page-header svelte-1yxwj23"><div class="svelte-1yxwj23"><h1 class="page-title svelte-1yxwj23">My Locations</h1> <p class="page-subtitle svelte-1yxwj23">${escape_html(locations.length)} location${escape_html(locations.length !== 1 ? "s" : "")} analyzed</p> `);
    if (conceptLabel()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="concept-pill svelte-1yxwj23">${escape_html(conceptLabel())}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (locations.length >= 2) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button${attr_class("btn-compare svelte-1yxwj23", void 0, { "active": canCompare() })}${attr("disabled", !canCompare(), true)}>${escape_html(canCompare() ? "Compare Selected →" : "Select 2 to Compare")}</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="loading-state svelte-1yxwj23"><div class="spinner svelte-1yxwj23"></div> <p class="svelte-1yxwj23">Loading your locations…</p></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
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
