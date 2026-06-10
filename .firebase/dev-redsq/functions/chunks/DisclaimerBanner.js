import "clsx";
function DisclaimerBanner($$renderer) {
  {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="disclaimer-banner svelte-1m6a69n"><span class="disclaimer-icon svelte-1m6a69n">⚠️</span> <span class="disclaimer-text-container svelte-1m6a69n">`);
    {
      $$renderer.push("<!--[-1-->");
      $$renderer.push(`<button class="disclaimer-toggle svelte-1m6a69n">AI-generated analysis. Not financial advice. <span class="see-more svelte-1m6a69n">See full terms</span></button>`);
    }
    $$renderer.push(`<!--]--></span> <button class="dismiss-btn svelte-1m6a69n">✕</button></div>`);
  }
  $$renderer.push(`<!--]-->`);
}
export {
  DisclaimerBanner as D
};
