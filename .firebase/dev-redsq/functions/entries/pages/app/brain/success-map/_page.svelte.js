import { h as head, b as attr, i as stringify, d as derived } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/index4.js";
import "maplibre-gl";
/* empty css                                                          */
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const addr = derived(() => page.url.searchParams.get("addr") ?? "");
    head("1026ky0", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Neighborhood Success Map</title>`);
      });
      $$renderer3.push(`<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" class="svelte-1026ky0"/>`);
    });
    $$renderer2.push(`<div class="brain-page svelte-1026ky0"><div class="tools-strip svelte-1026ky0"><a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1026ky0">Overview</a> <div class="tools-sep svelte-1026ky0"></div> <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab back-tab svelte-1026ky0">← Score</a> <div class="tools-sep svelte-1026ky0"></div> <a${attr("href", `/app/brain/compare${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1026ky0">Compare</a> <a${attr("href", `/app/brain/success-map${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab active svelte-1026ky0">Success Map</a> <a${attr("href", `/app/brain/daypart${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1026ky0">Daypart Traffic</a> <a${attr("href", `/app/brain/segments${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1026ky0">Segment Intel</a> <a${attr("href", `/app/brain/street${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1026ky0">Street View</a> <a${attr("href", `/app/brain/transparency${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1026ky0">Score Breakdown</a></div> <div class="page-body svelte-1026ky0">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-state svelte-1026ky0"><div class="empty-state-icon svelte-1026ky0">📍</div> <h2 class="svelte-1026ky0">No Location Scored Yet</h2> <p class="svelte-1026ky0">Score a location first to see this intelligence.</p> <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="empty-state-cta svelte-1026ky0">Score a Location</a></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
export {
  _page as default
};
