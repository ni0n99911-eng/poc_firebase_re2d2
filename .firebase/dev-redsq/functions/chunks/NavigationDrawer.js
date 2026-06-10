import { e as escape_html, j as ensure_array_like, c as attr_class, b as attr, d as derived, f as store_get, u as unsubscribe_stores } from "./index2.js";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./state.svelte.js";
import { p as page } from "./stores.js";
function NavigationDrawer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { currentPath = "", analyzedAddress = "" } = $$props;
    let sessionAddr = "";
    let displayAddress = derived(() => analyzedAddress || sessionAddr);
    let hasLocationIQ = false;
    let hasVisitedBusinessPlan = false;
    let hasVisitedChecklist = false;
    const modules = derived(() => [
      {
        num: 1,
        label: "Score",
        short: "Score",
        path: "/app/location",
        locked: false,
        done: hasLocationIQ,
        next: !hasLocationIQ
      },
      {
        num: 2,
        label: "Business Case",
        short: "Case",
        path: "/app/business-plan",
        locked: false,
        done: hasVisitedBusinessPlan,
        next: hasLocationIQ
      },
      {
        num: 3,
        label: "Dashboard",
        short: "Dashboard",
        path: "/app/dashboard",
        locked: !hasVisitedBusinessPlan,
        done: false,
        next: hasVisitedBusinessPlan
      },
      {
        num: 4,
        label: "Launch Checklist",
        short: "Checklist",
        path: "/app/checklist",
        locked: !hasVisitedBusinessPlan,
        done: hasVisitedChecklist,
        next: false
      }
    ]);
    function isActive(path) {
      return store_get($$store_subs ??= {}, "$page", page).url.pathname === path || store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith(path + "/");
    }
    $$renderer2.push(`<nav class="topbar svelte-qh60g9"><div class="topbar-left svelte-qh60g9"><a href="/app/dashboard" class="logo svelte-qh60g9">RE<sup class="svelte-qh60g9">2</sup></a> `);
    if (displayAddress()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sep svelte-qh60g9"></div> <span class="addr svelte-qh60g9">${escape_html(displayAddress())}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="topbar-right svelte-qh60g9"><div class="module-nav svelte-qh60g9"><!--[-->`);
    const each_array = ensure_array_like(modules());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let mod = each_array[$$index];
      $$renderer2.push(`<button${attr_class("mod-btn svelte-qh60g9", void 0, {
        "active": isActive(mod.path),
        "locked": mod.locked,
        "done": mod.done,
        "next": mod.next && !isActive(mod.path)
      })}${attr("disabled", mod.locked, true)}${attr("title", mod.locked ? "Complete the previous step to unlock" : void 0)}>`);
      if (mod.done) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="mod-num done svelte-qh60g9">✓</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="mod-num svelte-qh60g9">${escape_html(mod.num)}</span>`);
      }
      $$renderer2.push(`<!--]--> <span class="mod-label svelte-qh60g9">${escape_html(mod.label)}</span> <span class="mod-label-short svelte-qh60g9" aria-hidden="true">${escape_html(mod.short)}</span> `);
      if (mod.locked) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="mod-lock svelte-qh60g9"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" class="svelte-qh60g9"><rect x="3" y="11" width="18" height="11" rx="2" class="svelte-qh60g9"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4" class="svelte-qh60g9"></path></svg></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="mod-sep svelte-qh60g9"></div> <a href="/app/vault" class="tb-btn sec svelte-qh60g9" title="Data Vault">🗄</a> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></nav>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  NavigationDrawer as N
};
