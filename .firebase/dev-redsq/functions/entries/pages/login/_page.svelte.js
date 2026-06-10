import { h as head, b as attr, e as escape_html } from "../../../chunks/index2.js";
import "../../../chunks/client.js";
import "firebase/auth";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let email = "";
    let password = "";
    let isLoading = false;
    head("1x05zx6", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Sign In</title>`);
      });
    });
    $$renderer2.push(`<div class="login-page svelte-1x05zx6"><div class="left-panel svelte-1x05zx6"><a href="/" class="left-logo svelte-1x05zx6">RE<sup class="svelte-1x05zx6">2</sup></a> <div class="left-body svelte-1x05zx6"><p class="left-eyebrow svelte-1x05zx6">For founders who do the work</p> <h1 class="left-headline svelte-1x05zx6">The only number that matters before you <em class="svelte-1x05zx6">sign</em></h1> <div class="left-proof svelte-1x05zx6"><div class="proof-item svelte-1x05zx6"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="svelte-1x05zx6"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Score any NYC address in under 10 seconds</span></div> <div class="proof-item svelte-1x05zx6"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="svelte-1x05zx6"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>17 live data layers — foot traffic, competitors, survival rates</span></div> <div class="proof-item svelte-1x05zx6"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="svelte-1x05zx6"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Model your financials before signing the lease</span></div></div></div> <p class="left-footer svelte-1x05zx6">resquared.io — Location Intelligence for Founders</p></div> <div class="right-panel svelte-1x05zx6"><a href="/" class="back-link svelte-1x05zx6"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg> Back</a> <div class="form-content svelte-1x05zx6"><div class="form-header svelte-1x05zx6"><h2 class="svelte-1x05zx6">Welcome back</h2> <p class="form-sub svelte-1x05zx6">Sign in to your RE² account</p></div> <div class="auth-container svelte-1x05zx6"><button class="google-btn svelte-1x05zx6"${attr("disabled", isLoading, true)}><svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"></path><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"></path><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"></path><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"></path></g></svg> Continue with Google</button> <div class="divider svelte-1x05zx6"><span class="svelte-1x05zx6">OR</span></div> <form class="email-form svelte-1x05zx6"><div class="input-group svelte-1x05zx6"><label for="email" class="svelte-1x05zx6">Email</label> <input type="email" id="email"${attr("value", email)} required=""${attr("disabled", isLoading, true)} class="svelte-1x05zx6"/></div> <div class="input-group svelte-1x05zx6"><label for="password" class="svelte-1x05zx6">Password</label> <input type="password" id="password"${attr("value", password)} required=""${attr("disabled", isLoading, true)} class="svelte-1x05zx6"/></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button type="submit" class="submit-btn svelte-1x05zx6"${attr("disabled", isLoading, true)}>`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`${escape_html("Sign In")}`);
    }
    $$renderer2.push(`<!--]--></button> <button type="button" class="toggle-mode-btn svelte-1x05zx6">${escape_html("Don't have an account? Sign up")}</button></form></div></div> <p class="right-footer svelte-1x05zx6">Secure authentication by Firebase</p></div></div>`);
  });
}
export {
  _page as default
};
