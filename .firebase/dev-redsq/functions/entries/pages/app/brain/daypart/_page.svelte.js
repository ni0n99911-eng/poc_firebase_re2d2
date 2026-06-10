import { h as head, b as attr, i as stringify, d as derived } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/index4.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const addr = derived(() => page.url.searchParams.get("addr") ?? "");
    head("qyc697", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Daypart Traffic</title>`);
      });
    });
    $$renderer2.push(`<div class="brain-page svelte-qyc697"><div class="tools-strip svelte-qyc697"><a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-qyc697">Overview</a> <div class="tools-sep svelte-qyc697"></div> <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab back-tab svelte-qyc697">← Score</a> <div class="tools-sep svelte-qyc697"></div> <a${attr("href", `/app/brain/compare${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-qyc697">Compare</a> <a${attr("href", `/app/brain/success-map${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-qyc697">Success Map</a> <a${attr("href", `/app/brain/daypart${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab active svelte-qyc697">Daypart Traffic</a> <a${attr("href", `/app/brain/segments${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-qyc697">Segment Intel</a> <a${attr("href", `/app/brain/street${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-qyc697">Street View</a> <a${attr("href", `/app/brain/transparency${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-qyc697">Score Breakdown</a></div> <div class="page-body svelte-qyc697">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-state svelte-qyc697"><div class="empty-state-icon svelte-qyc697">📍</div> <h2 class="svelte-qyc697">No Location Scored Yet</h2> <p class="svelte-qyc697">Score a location first to see this intelligence.</p> <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="empty-state-cta svelte-qyc697">Score a Location</a></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
export {
  _page as default
};
