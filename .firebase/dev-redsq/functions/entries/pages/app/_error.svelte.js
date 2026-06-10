import { h as head, f as store_get, b as attr, e as escape_html, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { p as page } from "../../../chunks/stores.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
function _error($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let retrying = false;
    head("1xkfkq5", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Something went wrong</title>`);
      });
    });
    $$renderer2.push(`<div class="app-error-wrap svelte-1xkfkq5"><div class="app-error-card svelte-1xkfkq5">`);
    if (store_get($$store_subs ??= {}, "$page", page).status === 401) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="app-error-icon svelte-1xkfkq5">🔄</div> <h2 class="app-error-title svelte-1xkfkq5">Refreshing session...</h2> <p class="app-error-sub svelte-1xkfkq5">Your session expired. Reconnecting — just a moment.</p> <a href="/login" class="app-error-btn secondary svelte-1xkfkq5">Sign in again</a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="app-error-icon svelte-1xkfkq5">⚠️</div> <h2 class="app-error-title svelte-1xkfkq5">`);
      if (store_get($$store_subs ??= {}, "$page", page).status === 404) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`Page not found`);
      } else if (store_get($$store_subs ??= {}, "$page", page).status >= 500) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`Server error`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`Something went wrong`);
      }
      $$renderer2.push(`<!--]--></h2> <p class="app-error-sub svelte-1xkfkq5">`);
      if (store_get($$store_subs ??= {}, "$page", page).status === 404) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`This page doesn't exist or has been moved.`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`RE² hit an unexpected error on this page. Your scored locations are safe.`);
      }
      $$renderer2.push(`<!--]--></p> <div class="app-error-actions svelte-1xkfkq5"><button class="app-error-btn primary svelte-1xkfkq5"${attr("disabled", retrying, true)}>${escape_html("↻ Reload page")}</button> <button class="app-error-btn secondary svelte-1xkfkq5">← Back to Score</button></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _error as default
};
