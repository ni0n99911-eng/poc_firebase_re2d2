import { h as head } from "../../../../chunks/index2.js";
import { loadLaunchPadData } from "../../../../chunks/launchpad-store.js";
/* empty css                                                       */
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    loadLaunchPadData();
    head("ynie6n", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Operations</title>`);
      });
    });
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
