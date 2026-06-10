import { h as head } from "../../../chunks/index2.js";
import { S as SiteNav } from "../../../chunks/SiteNav.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("1du1zi4", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Interactive Demo</title>`);
      });
    });
    SiteNav($$renderer2);
    $$renderer2.push(`<!----> <main class="svelte-1du1zi4"><div class="container svelte-1du1zi4"><div class="hero svelte-1du1zi4"><h1 class="svelte-1du1zi4">See RE² in action</h1> <p class="subtext svelte-1du1zi4">Explore a complete location analysis using sample data from a wellness café concept in
				Chelsea.</p></div> <div class="cards-grid svelte-1du1zi4"><div class="card svelte-1du1zi4"><h2 class="svelte-1du1zi4">Launch Pad</h2> <p class="svelte-1du1zi4">Define your business vision, budget, and priorities</p> <button class="cta-button svelte-1du1zi4" data-sveltekit-reload="">Explore Launch Pad</button></div> <div class="card svelte-1du1zi4"><h2 class="svelte-1du1zi4">Location Intelligence</h2> <p class="svelte-1du1zi4">Get your score across 19 data sources</p> <button class="cta-button svelte-1du1zi4" data-sveltekit-reload="">View your score</button></div> <div class="card svelte-1du1zi4"><h2 class="svelte-1du1zi4">Loan Readiness</h2> <p class="svelte-1du1zi4">Generate a lender-ready funding package</p> <button class="cta-button svelte-1du1zi4" data-sveltekit-reload="">See Loan Readiness</button></div></div> <div class="cta-section svelte-1du1zi4"><h2 class="svelte-1du1zi4">Ready to get your own score?</h2> <button class="primary-button svelte-1du1zi4" data-sveltekit-reload="">Sign Up or Log In</button></div> <div class="note svelte-1du1zi4"><p>This demo uses sample business data. Sign up to analyze your own business with personalized results.</p></div></div></main>`);
  });
}
export {
  _page as default
};
