import { h as head, f as store_get, e as escape_html, b as attr, u as unsubscribe_stores } from "../../chunks/index2.js";
import { p as page } from "../../chunks/stores.js";
function _error($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let retrying = false;
    head("1j96wlh", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — ${escape_html(store_get($$store_subs ??= {}, "$page", page).status === 401 ? "Refreshing Session" : `${store_get($$store_subs ??= {}, "$page", page).status} Error`)}</title>`);
      });
    });
    $$renderer2.push(`<div class="error-page svelte-1j96wlh"><div class="error-content svelte-1j96wlh">`);
    if (store_get($$store_subs ??= {}, "$page", page).status === 401) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="error-code refresh-icon svelte-1j96wlh"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin svelte-1j96wlh"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg></div> <h1 class="error-title svelte-1j96wlh">Refreshing your session...</h1> <p class="error-message svelte-1j96wlh">Your session token expired. Reconnecting now — this takes just a moment.</p> <div class="error-actions svelte-1j96wlh"><a href="/login" class="error-btn-secondary svelte-1j96wlh">Sign in again</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="error-code svelte-1j96wlh">${escape_html(store_get($$store_subs ??= {}, "$page", page).status)}</div> <h1 class="error-title svelte-1j96wlh">`);
      if (store_get($$store_subs ??= {}, "$page", page).status === 404) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`Page not found`);
      } else if (store_get($$store_subs ??= {}, "$page", page).status === 403) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`Access denied`);
      } else if (store_get($$store_subs ??= {}, "$page", page).status >= 500) {
        $$renderer2.push("<!--[2-->");
        $$renderer2.push(`Something went wrong`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`Unexpected error`);
      }
      $$renderer2.push(`<!--]--></h1> <p class="error-message svelte-1j96wlh">`);
      if (store_get($$store_subs ??= {}, "$page", page).error?.message) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`${escape_html(store_get($$store_subs ??= {}, "$page", page).error.message)}`);
      } else if (store_get($$store_subs ??= {}, "$page", page).status === 404) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`The page you're looking for doesn't exist or has been moved.`);
      } else if (store_get($$store_subs ??= {}, "$page", page).status >= 500) {
        $$renderer2.push("<!--[2-->");
        $$renderer2.push(`The server hit an issue. This is usually temporary — try again in a moment.`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`An unexpected error occurred. Please try again.`);
      }
      $$renderer2.push(`<!--]--></p> <div class="error-actions svelte-1j96wlh"><button class="error-btn svelte-1j96wlh"${attr("disabled", retrying, true)}>${escape_html("Try Again")}</button> `);
      if (store_get($$store_subs ??= {}, "$page", page).data?.user) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<a href="/app/location" class="error-btn-secondary svelte-1j96wlh">Back to Your Score</a>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<a href="/" class="error-btn-secondary svelte-1j96wlh">Back to Home</a>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _error as default
};
