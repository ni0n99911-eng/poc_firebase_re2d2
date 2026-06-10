import { h as head, c as attr_class, j as ensure_array_like, e as escape_html, b as attr } from "../../../../chunks/index2.js";
import { D as DisclaimerBanner } from "../../../../chunks/DisclaimerBanner.js";
import { P as PageNav } from "../../../../chunks/PageNav.js";
function emptySpaceDetails() {
  return {
    address: "",
    neighborhood: "",
    squareFeet: null,
    usableSquareFeet: null,
    floor: "Ground",
    ceilingHeight: null,
    frontageWidth: null,
    buildingClass: "B",
    yearBuilt: null,
    existingCondition: "raw",
    previousTenant: null,
    previousTenantType: null,
    greaseTrap: "required"
  };
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let space = emptySpaceDetails();
    let documents = [];
    let dragOver = false;
    let analysisRunning = false;
    let expandedSections = {
      "Property Basics": true,
      "Lease Terms": false,
      "Previous Tenant": false
    };
    const FLOOR_OPTIONS = ["Ground", "Second", "Third", "Basement", "Mezzanine"];
    head("1vqovzp", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Space IQ</title>`);
      });
    });
    $$renderer2.push(`<div class="page svelte-1vqovzp">`);
    DisclaimerBanner($$renderer2);
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="page-header svelte-1vqovzp"><h1 class="svelte-1vqovzp">Space IQ</h1> <p class="page-subtitle svelte-1vqovzp">Analyze a specific retail space — upload broker materials or enter details manually</p></div> <div class="upload-section svelte-1vqovzp"><div class="upload-label svelte-1vqovzp">Recommended: Upload a broker sheet</div> <div${attr_class("upload-zone svelte-1vqovzp", void 0, { "drag-over": dragOver })}><div class="upload-icon svelte-1vqovzp">📄</div> <p class="upload-title svelte-1vqovzp">Drop broker brochure, lease, or floorplan</p> <p class="upload-hint svelte-1vqovzp">or click to browse files</p> <p class="upload-formats svelte-1vqovzp">PDF, JPG, PNG up to 25MB</p> <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple="" class="file-input svelte-1vqovzp"/></div> `);
      if (documents.length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="uploaded-files svelte-1vqovzp"><!--[-->`);
        const each_array = ensure_array_like(documents);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let doc = each_array[$$index];
          $$renderer2.push(`<div class="uploaded-file svelte-1vqovzp"><span class="file-icon svelte-1vqovzp">${escape_html(doc.type === "brochure" || doc.type === "lease" ? "📄" : "📷")}</span> <span class="file-name svelte-1vqovzp">${escape_html(doc.filename)}</span> <button class="file-remove svelte-1vqovzp">✕</button></div>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="divider svelte-1vqovzp"><span>or enter details manually</span></div> <div class="form-container svelte-1vqovzp"><div class="collapsible-section svelte-1vqovzp"><button class="section-header svelte-1vqovzp"><span${attr_class("chevron svelte-1vqovzp", void 0, { "expanded": expandedSections["Property Basics"] })}>›</span> <span class="section-title svelte-1vqovzp">Property Basics</span></button> `);
      {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="form-grid section-content svelte-1vqovzp"><div class="form-group span-2 svelte-1vqovzp"><label for="address" class="svelte-1vqovzp">Address</label> <input id="address" type="text"${attr("value", space.address)} placeholder="e.g., 123 Main St, New York, NY" class="svelte-1vqovzp"/></div> <div class="form-group svelte-1vqovzp"><label for="neighborhood" class="svelte-1vqovzp">Neighborhood</label> <input id="neighborhood" type="text"${attr("value", space.neighborhood)} placeholder="e.g., Downtown" class="svelte-1vqovzp"/></div> <div class="form-group svelte-1vqovzp"><label for="sqft" class="svelte-1vqovzp">Square Feet</label> <input id="sqft" type="number"${attr("value", space.squareFeet)} placeholder="e.g., 1,200" class="svelte-1vqovzp"/></div> <div class="form-group svelte-1vqovzp"><label for="frontage" class="svelte-1vqovzp">Frontage Width (ft)</label> <input id="frontage" type="number"${attr("value", space.frontageWidth)} placeholder="e.g., 25" class="svelte-1vqovzp"/></div> <div class="form-group svelte-1vqovzp"><label for="floor" class="svelte-1vqovzp">Floor</label> `);
        $$renderer2.select(
          { id: "floor", value: space.floor, class: "" },
          ($$renderer3) => {
            $$renderer3.push(`<!--[-->`);
            const each_array_1 = ensure_array_like(FLOOR_OPTIONS);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let f = each_array_1[$$index_1];
              $$renderer3.option({ value: f }, ($$renderer4) => {
                $$renderer4.push(`${escape_html(f)}`);
              });
            }
            $$renderer3.push(`<!--]-->`);
          },
          "svelte-1vqovzp"
        );
        $$renderer2.push(`</div></div>`);
      }
      $$renderer2.push(`<!--]--></div> <div class="collapsible-section svelte-1vqovzp"><button class="section-header svelte-1vqovzp"><span${attr_class("chevron svelte-1vqovzp", void 0, { "expanded": expandedSections["Lease Terms"] })}>›</span> <span class="section-title svelte-1vqovzp">Lease Terms</span></button> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="collapsible-section svelte-1vqovzp"><button class="section-header svelte-1vqovzp"><span${attr_class("chevron svelte-1vqovzp", void 0, { "expanded": expandedSections["Previous Tenant"] })}>›</span> <span class="section-title svelte-1vqovzp">Previous Tenant</span></button> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div> <div class="emc2-section svelte-1vqovzp"><button class="btn-action svelte-1vqovzp"${attr("disabled", analysisRunning, true)}>${escape_html("Analyze Space")}</button></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--> `);
    PageNav($$renderer2, {
      backHref: "/app/location",
      backLabel: "Score",
      nextHref: "/app/financials",
      nextLabel: "Financials"
    });
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _page as default
};
