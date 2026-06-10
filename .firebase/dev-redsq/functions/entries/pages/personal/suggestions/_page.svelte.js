import { j as ensure_array_like, e as escape_html } from "../../../../chunks/index2.js";
function _page($$renderer) {
  let suggestions = [
    {
      icon: "☕",
      title: "Visit Black Fox Coffee for competitor research",
      details: "new East Village location",
      source: "Coffee business goals"
    },
    {
      icon: "📞",
      title: "Follow up with James L. (broker)",
      details: "2 weeks since last contact",
      source: "Relationship tracking"
    },
    {
      icon: "🏋️",
      title: "On track for 5/week workout goal",
      details: "consider rest day before Thursday review",
      source: "Health metrics & calendar"
    },
    {
      icon: "📊",
      title: "2 at-risk EY accounts",
      details: "loop in Sarah K. from Deloitte as warm lead",
      source: "Account health & network"
    },
    {
      icon: "🍽️",
      title: "Prep 1-pager on financials + RWA model for Neel's dinner",
      details: "before Wednesday 7:00 PM",
      source: "Upcoming activities & partnerships"
    }
  ];
  $$renderer.push(`<div class="container svelte-chyao7"><header class="page-header svelte-chyao7"><h1 class="svelte-chyao7">💡 Suggestions</h1> <p class="svelte-chyao7">Jared's recommendations based on your patterns and goals</p></header> <div class="suggestions-grid svelte-chyao7"><!--[-->`);
  const each_array = ensure_array_like(suggestions);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let suggestion = each_array[$$index];
    $$renderer.push(`<div class="suggestion-card svelte-chyao7"><div class="suggestion-icon svelte-chyao7">${escape_html(suggestion.icon)}</div> <div class="suggestion-content svelte-chyao7"><div class="suggestion-title svelte-chyao7">${escape_html(suggestion.title)}</div> <div class="suggestion-details svelte-chyao7">${escape_html(suggestion.details)}</div> <div class="suggestion-source svelte-chyao7">Based on: ${escape_html(suggestion.source)}</div></div></div>`);
  }
  $$renderer.push(`<!--]--></div></div>`);
}
export {
  _page as default
};
