import { b as attr, e as escape_html, c as attr_class } from "./index2.js";
/* empty css                                      */
function PageNav($$renderer, $$props) {
  let {
    backHref = "",
    backLabel = "",
    nextHref = "",
    nextLabel = "",
    nextIsGreen = false
  } = $$props;
  $$renderer.push(`<div class="page-nav svelte-glgdy8">`);
  if (backHref) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<a${attr("href", backHref)} class="nav-link back svelte-glgdy8">← Back: ${escape_html(backLabel)}</a>`);
  } else {
    $$renderer.push("<!--[-1-->");
    $$renderer.push(`<div></div>`);
  }
  $$renderer.push(`<!--]--> `);
  if (nextHref) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<a${attr("href", nextHref)}${attr_class("nav-link next svelte-glgdy8", void 0, { "green": nextIsGreen })}>Next: ${escape_html(nextLabel)} →</a>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div> <p class="re2-tm-line svelte-glgdy8">Don't work for AI. Make AI <em class="svelte-glgdy8">work for you.</em>™</p>`);
}
export {
  PageNav as P
};
