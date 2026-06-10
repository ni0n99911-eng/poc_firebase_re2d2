import { j as ensure_array_like, e as escape_html, c as attr_class } from "../../../../chunks/index2.js";
function _page($$renderer) {
  const stats = [
    {
      id: 1,
      label: "Pipeline",
      value: "$8.7M",
      change: "+$1.2M",
      isPositive: true
    },
    {
      id: 2,
      label: "Won",
      value: "$640K TCV",
      change: "+2 deals",
      isPositive: true
    },
    {
      id: 3,
      label: "At Risk",
      value: "2 accounts",
      change: "Action needed",
      isPositive: false
    }
  ];
  const summary = {
    title: "Pipeline moved forward on 3 of 5 active opportunities",
    body: "Goldman infrastructure deal progressed. JPM renewal signed. Blackstone and Citadel stalling.",
    commentary: "Strong week on new business, but renewal pipeline is where the risk is. Two stalled renewals at once isn't coincidence — check for competitive play. Morgan Stanley RFP could be a nice offset."
  };
  $$renderer.push(`<div class="container svelte-11x54xa"><header class="page-header svelte-11x54xa"><h1 class="svelte-11x54xa">📊 Weekly Digest</h1> <p class="subtitle svelte-11x54xa">Week of March 9–15, 2026</p></header> <div class="stats-grid svelte-11x54xa"><!--[-->`);
  const each_array = ensure_array_like(stats);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let stat = each_array[$$index];
    $$renderer.push(`<div class="stat-card svelte-11x54xa"><div class="stat-label svelte-11x54xa">${escape_html(stat.label)}</div> <div class="stat-value svelte-11x54xa">${escape_html(stat.value)}</div> <div${attr_class("stat-change svelte-11x54xa", void 0, { "positive": stat.isPositive, "negative": !stat.isPositive })}>${escape_html(stat.change)}</div></div>`);
  }
  $$renderer.push(`<!--]--></div> <div class="summary-section svelte-11x54xa"><div class="summary-item svelte-11x54xa"><h3 class="item-title svelte-11x54xa">${escape_html(summary.title)}</h3> <p class="item-body svelte-11x54xa">${escape_html(summary.body)}</p> <div class="commentary-block svelte-11x54xa"><div class="commentary-label svelte-11x54xa">JARED'S TAKE</div> <p class="commentary-text svelte-11x54xa">${escape_html(summary.commentary)}</p></div></div></div></div>`);
}
export {
  _page as default
};
