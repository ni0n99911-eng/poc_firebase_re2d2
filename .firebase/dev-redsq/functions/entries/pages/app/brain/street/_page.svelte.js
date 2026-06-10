import { h as head, b as attr, i as stringify, d as derived } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/index4.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const addr = derived(() => page.url.searchParams.get("addr") ?? "");
    head("w1cijf", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Street-Side Intelligence</title>`);
      });
    });
    $$renderer2.push(`<div class="brain-page svelte-w1cijf"><div class="tools-strip svelte-w1cijf"><a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-w1cijf">Overview</a> <div class="tools-sep svelte-w1cijf"></div> <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab back-tab svelte-w1cijf">← Score</a> <div class="tools-sep svelte-w1cijf"></div> <a${attr("href", `/app/brain/compare${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-w1cijf">Compare</a> <a${attr("href", `/app/brain/success-map${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-w1cijf">Success Map</a> <a${attr("href", `/app/brain/daypart${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-w1cijf">Daypart Traffic</a> <a${attr("href", `/app/brain/segments${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-w1cijf">Segment Intel</a> <a${attr("href", `/app/brain/street${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab active svelte-w1cijf">Street View</a> <a${attr("href", `/app/brain/transparency${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-w1cijf">Score Breakdown</a></div> <div class="page-body svelte-w1cijf">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-state svelte-w1cijf"><div class="empty-state-icon svelte-w1cijf">📍</div> <h2 class="svelte-w1cijf">No Location Scored Yet</h2> <p class="svelte-w1cijf">Score a location first to see this intelligence.</p> <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="empty-state-cta svelte-w1cijf">Score a Location</a></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
export {
  _page as default
};
