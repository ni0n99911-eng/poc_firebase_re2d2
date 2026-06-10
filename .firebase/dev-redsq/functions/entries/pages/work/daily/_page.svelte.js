import { j as ensure_array_like, e as escape_html } from "../../../../chunks/index2.js";
function _page($$renderer) {
  const items = [
    {
      id: 1,
      source: "Deal Alert",
      timestamp: "8:14 AM",
      title: "Morgan Stanley — Managed Services RFP Dropped",
      body: "New RFP for cloud migration managed services. $2.4M TCV. Response deadline April 3.",
      commentary: "This is the kind of deal you've been positioning for. The timeline is tight but your Deloitte case study from Q4 maps almost 1:1. Worth pulling in the team early."
    },
    {
      id: 2,
      source: "Market Update",
      timestamp: "9:30 AM",
      title: "NYC Commercial Lease Rates — March Data",
      body: "Average asking rents in Manhattan retail dipped 2.3% month-over-month. East Village and LES both showing softening.",
      commentary: "The timing is working in your favor. Landlords are more negotiable. If you're serious about 2nd Ave, this is the window to push for a better rate."
    },
    {
      id: 3,
      source: "Follow-Up",
      timestamp: "10:45 AM",
      title: "Client: Blackstone — Contract Renewal at Risk",
      body: "Renewal conversation stalled 5 days ago. No response from procurement.",
      commentary: "Silence after a revision usually means they're shopping it. Direct call to your champion there rather than another email."
    }
  ];
  $$renderer.push(`<div class="container svelte-zcv5wo"><header class="page-header svelte-zcv5wo"><h1 class="svelte-zcv5wo">📋 Daily Digest</h1> <p class="subtitle svelte-zcv5wo">Monday, March 16, 2026 — Your day in deals and data</p></header> <div class="digest-list svelte-zcv5wo"><!--[-->`);
  const each_array = ensure_array_like(items);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let item = each_array[$$index];
    $$renderer.push(`<div class="digest-item svelte-zcv5wo"><div class="item-header svelte-zcv5wo"><span class="source-badge svelte-zcv5wo">${escape_html(item.source)}</span> <span class="timestamp svelte-zcv5wo">${escape_html(item.timestamp)}</span></div> <h3 class="item-title svelte-zcv5wo">${escape_html(item.title)}</h3> <p class="item-body svelte-zcv5wo">${escape_html(item.body)}</p> <div class="commentary-block svelte-zcv5wo"><div class="commentary-label svelte-zcv5wo">JARED'S TAKE</div> <p class="commentary-text svelte-zcv5wo">${escape_html(item.commentary)}</p></div></div>`);
  }
  $$renderer.push(`<!--]--></div></div>`);
}
export {
  _page as default
};
