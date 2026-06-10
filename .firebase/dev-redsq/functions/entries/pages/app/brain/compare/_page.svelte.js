import { h as head, b as attr, i as stringify, d as derived } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/index4.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const addr = derived(() => page.url.searchParams.get("addr") ?? "");
    head("1t75kwv", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Compare Mode</title>`);
      });
    });
    $$renderer2.push(`<div class="brain-page svelte-1t75kwv"><div class="tools-strip svelte-1t75kwv"><a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1t75kwv">Overview</a> <div class="tools-sep svelte-1t75kwv"></div> <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab back-tab svelte-1t75kwv">← Score</a> <div class="tools-sep svelte-1t75kwv"></div> <a${attr("href", `/app/brain/compare${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab active svelte-1t75kwv">Compare</a> <a${attr("href", `/app/brain/success-map${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1t75kwv">Success Map</a> <a${attr("href", `/app/brain/daypart${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1t75kwv">Daypart Traffic</a> <a${attr("href", `/app/brain/segments${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1t75kwv">Segment Intel</a> <a${attr("href", `/app/brain/street${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1t75kwv">Street View</a> <a${attr("href", `/app/brain/transparency${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="tool-tab svelte-1t75kwv">Score Breakdown</a></div> <div class="page-body svelte-1t75kwv"><div class="page-title-row svelte-1t75kwv"><span class="page-label svelte-1t75kwv">Compare Mode</span></div> <div class="page-title svelte-1t75kwv">Side-by-Side Location Comparison</div> <div class="page-desc svelte-1t75kwv">Compare up to 5 locations head-to-head. Survival Rate leads the table — it's the highest-weight predictor of real business outcomes.</div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="no-data-state svelte-1t75kwv"><p>No location has been analyzed yet. <a${attr("href", `/app/location${stringify(addr() ? "?addr=" + encodeURIComponent(addr()) : "")}`)} class="svelte-1t75kwv">Analyze a location</a> to start comparing.</p></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
export {
  _page as default
};
