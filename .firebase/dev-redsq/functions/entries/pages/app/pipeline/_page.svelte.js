import { e as escape_html, c as attr_class, j as ensure_array_like, i as stringify, b as attr } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { N as NavigationDrawer } from "../../../../chunks/NavigationDrawer.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let pipeline = [];
    let counts = {};
    let brokers = [];
    let activeStatus = "all";
    NavigationDrawer($$renderer2, {});
    $$renderer2.push(`<!----> <div class="pipe-page svelte-1hz1ez7"><div class="pipe-header svelte-1hz1ez7"><div class="pipe-header-left"><h1 class="pipe-title svelte-1hz1ez7">Deal Pipeline</h1> <div class="pipe-subtitle svelte-1hz1ez7">Track your locations from score → signed lease</div></div> <div class="pipe-header-right"><button class="pipe-broker-btn svelte-1hz1ez7" type="button">+ Add Broker</button></div></div> `);
    if (pipeline.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="pipe-roi-bar svelte-1hz1ez7"><div class="pipe-roi-step svelte-1hz1ez7"><span class="roi-num svelte-1hz1ez7">${escape_html(pipeline.length)}</span> <span class="roi-label svelte-1hz1ez7">Scored</span></div> <div class="roi-arrow svelte-1hz1ez7">→</div> <div class="pipe-roi-step svelte-1hz1ez7"><span class="roi-num svelte-1hz1ez7">${escape_html((counts.touring || 0) + (counts.negotiating || 0))}</span> <span class="roi-label svelte-1hz1ez7">In Progress</span></div> <div class="roi-arrow svelte-1hz1ez7">→</div> <div${attr_class(`pipe-roi-step ${stringify(counts.signed > 0 ? "roi-signed" : "")}`, "svelte-1hz1ez7")}><span class="roi-num svelte-1hz1ez7">${escape_html(counts.signed || 0)}</span> <span class="roi-label svelte-1hz1ez7">Signed</span></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="pipe-tabs svelte-1hz1ez7"><!--[-->`);
    const each_array = ensure_array_like([
      { key: "all", label: "All" },
      { key: "active", label: "Active" },
      {
        key: "watching",
        label: `Watching ${counts.watching > 0 ? "(" + counts.watching + ")" : ""}`
      },
      {
        key: "touring",
        label: `Touring ${counts.touring > 0 ? "(" + counts.touring + ")" : ""}`
      },
      {
        key: "negotiating",
        label: `Negotiating ${counts.negotiating > 0 ? "(" + counts.negotiating + ")" : ""}`
      },
      {
        key: "signed",
        label: `Signed ${counts.signed > 0 ? "(" + counts.signed + ")" : ""}`
      }
    ]);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let tab = each_array[$$index];
      $$renderer2.push(`<button${attr_class(`pipe-tab ${stringify(activeStatus === tab.key ? "active" : "")}`, "svelte-1hz1ez7")} type="button">${escape_html(tab.label)}</button>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="pipe-empty svelte-1hz1ez7">Loading your pipeline...</div>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (brokers.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="pipe-brokers-section svelte-1hz1ez7"><div class="pbs-title svelte-1hz1ez7">Your Brokers (${escape_html(brokers.length)})</div> <div class="pbs-list svelte-1hz1ez7"><!--[-->`);
      const each_array_4 = ensure_array_like(brokers);
      for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
        let b = each_array_4[$$index_4];
        $$renderer2.push(`<div class="pbs-card svelte-1hz1ez7"><div class="pbs-name svelte-1hz1ez7">${escape_html(b.name)}</div> `);
        if (b.brokerage) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="pbs-firm svelte-1hz1ez7">${escape_html(b.brokerage)}</div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <div class="pbs-contacts svelte-1hz1ez7">`);
        if (b.email) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a${attr("href", `mailto:${stringify(b.email)}`)} class="pbs-contact svelte-1hz1ez7">${escape_html(b.email)}</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (b.phone) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="pbs-contact svelte-1hz1ez7">${escape_html(b.phone)}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div></div>`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
