import { h as head, b as attr, i as stringify, d as derived } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/index4.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const addr = derived(() => page.url.searchParams.get("addr") ?? "");
    head("lk10oc", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Segment Intelligence</title>`);
      });
    });
    $$renderer2.push(`<div class="brain-page svelte-lk10oc"><div class="tools-strip svelte-lk10oc"><a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-lk10oc">Overview</a> <div class="tools-sep svelte-lk10oc"></div> <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab back-tab svelte-lk10oc">← Score</a> <div class="tools-sep svelte-lk10oc"></div> <a${attr("href", `/app/brain/compare${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-lk10oc">Compare</a> <a${attr("href", `/app/brain/success-map${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-lk10oc">Success Map</a> <a${attr("href", `/app/brain/daypart${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-lk10oc">Daypart Traffic</a> <a${attr("href", `/app/brain/segments${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab active svelte-lk10oc">Segment Intel</a> <a${attr("href", `/app/brain/street${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-lk10oc">Street View</a> <a${attr("href", `/app/brain/transparency${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-lk10oc">Score Breakdown</a></div> <div class="page-body svelte-lk10oc">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-state svelte-lk10oc"><div class="empty-state-icon svelte-lk10oc">📍</div> <h2 class="svelte-lk10oc">No Location Scored Yet</h2> <p class="svelte-lk10oc">Score a location first to see this intelligence.</p> <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="empty-state-cta svelte-lk10oc">Score a Location</a></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
export {
  _page as default
};
