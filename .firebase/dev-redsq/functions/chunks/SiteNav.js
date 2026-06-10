import { c as attr_class, f as store_get, u as unsubscribe_stores } from "./index2.js";
import { p as page } from "./stores.js";
function SiteNav($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let showMobileMenu = false;
    $$renderer2.push(`<nav class="site-nav svelte-1ezjbvk"><div class="site-nav-container svelte-1ezjbvk"><a href="/" class="site-nav-logo svelte-1ezjbvk" data-sveltekit-reload="">RE<sup class="svelte-1ezjbvk">2</sup></a> <div${attr_class("site-nav-links svelte-1ezjbvk", void 0, { "mobile-open": showMobileMenu })}><a href="/#how-it-works" class="snav-link svelte-1ezjbvk" data-sveltekit-reload="">How It Works</a> <a href="/methodology"${attr_class("snav-link svelte-1ezjbvk", void 0, {
      "active": store_get($$store_subs ??= {}, "$page", page).url.pathname === "/methodology"
    })} data-sveltekit-reload="">Methodology</a> <a href="/pricing"${attr_class("snav-link svelte-1ezjbvk", void 0, {
      "active": store_get($$store_subs ??= {}, "$page", page).url.pathname === "/pricing"
    })} data-sveltekit-reload="">Pricing</a> <a href="/about"${attr_class("snav-link svelte-1ezjbvk", void 0, {
      "active": store_get($$store_subs ??= {}, "$page", page).url.pathname === "/about"
    })} data-sveltekit-reload="">About</a> `);
    if (store_get($$store_subs ??= {}, "$page", page).data.user) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a href="/app/route" class="snav-cta svelte-1ezjbvk" data-sveltekit-reload="">Dashboard</a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<a href="/login" class="snav-cta svelte-1ezjbvk" data-sveltekit-reload="">Get Your Score</a> <a href="/login" class="snav-link snav-signin svelte-1ezjbvk" data-sveltekit-reload="">Sign In →</a>`);
    }
    $$renderer2.push(`<!--]--></div> <button class="snav-mobile-btn svelte-1ezjbvk" aria-label="Toggle menu"><span class="svelte-1ezjbvk"></span> <span class="svelte-1ezjbvk"></span> <span class="svelte-1ezjbvk"></span></button></div></nav>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  SiteNav as S
};
