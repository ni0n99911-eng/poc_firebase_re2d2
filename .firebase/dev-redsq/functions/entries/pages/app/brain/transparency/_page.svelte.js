import { h as head, b as attr, i as stringify, d as derived } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/index4.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const addr = derived(() => page.url.searchParams.get("addr") ?? "");
    head("1v00q7o", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Score Breakdown</title>`);
      });
    });
    $$renderer2.push(`<div class="brain-page svelte-1v00q7o"><div class="tools-strip svelte-1v00q7o"><a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1v00q7o">Overview</a> <div class="tools-sep svelte-1v00q7o"></div> <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab back-tab svelte-1v00q7o">← Score</a> <div class="tools-sep svelte-1v00q7o"></div> <a${attr("href", `/app/brain/compare${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1v00q7o">Compare</a> <a${attr("href", `/app/brain/success-map${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1v00q7o">Success Map</a> <a${attr("href", `/app/brain/daypart${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1v00q7o">Daypart Traffic</a> <a${attr("href", `/app/brain/segments${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1v00q7o">Segment Intel</a> <a${attr("href", `/app/brain/street${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1v00q7o">Street View</a> <a${attr("href", `/app/brain/transparency${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab active svelte-1v00q7o">Score Breakdown</a></div> <div class="page-body svelte-1v00q7o">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-state svelte-1v00q7o"><div class="empty-state-icon svelte-1v00q7o">📍</div> <h2 class="svelte-1v00q7o">No Location Scored Yet</h2> <p class="svelte-1v00q7o">Score a location first to see this intelligence.</p> <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="empty-state-cta svelte-1v00q7o">Score a Location</a></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
export {
  _page as default
};
