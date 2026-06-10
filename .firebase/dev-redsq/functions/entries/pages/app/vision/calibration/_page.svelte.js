import { c as attr_class, b as attr, d as derived, i as stringify, h as head, j as ensure_array_like, e as escape_html, k as attr_style } from "../../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
import { saveLaunchPadData } from "../../../../../chunks/launchpad-store.js";
/* empty css                                                             */
function EMC2Button($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      expansionText = "Evaluate My Community Context",
      disabled = false
    } = $$props;
    let state = "idle";
    let isActive = derived(() => state !== "idle");
    $$renderer2.push(`<div${attr_class("emc2-container svelte-1fhry61", void 0, { "active": isActive() })}><button${attr_class("emc2-btn svelte-1fhry61", void 0, {
      "expanding": state === "expanding",
      "processing": state === "processing",
      "done": state === "done",
      "disabled": disabled
    })}${attr("disabled", disabled, true)}${attr("aria-label", `Run RE² Analysis: ${stringify(expansionText)}`)} role="button"><span class="emc2-formula svelte-1fhry61">E=MC²</span> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let saveStatus = "";
    function triggerSave() {
      saveStatus = "Saving...";
      saveLaunchPadData({ businessType, weights });
      setTimeout(
        () => {
          saveStatus = "Auto-saved ✓";
        },
        300
      );
      setTimeout(
        () => {
          saveStatus = "";
        },
        2500
      );
    }
    let businessType = "Specialty Coffee/Café";
    const businessTypes = [
      "Specialty Coffee/Café",
      "Restaurant",
      "Retail",
      "Fitness",
      "Prof Services",
      "Grocery",
      "Salon",
      "Other"
    ];
    const defaultWeightsByType = {
      "Specialty Coffee/Café": {
        l0_macro: 10,
        l1_city: 15,
        l2_block: 18,
        l3_planfit: 18,
        l4_talent: 10,
        l5_resilience: 10,
        l6_zoning: 7,
        l7_feel: 12
      },
      "Restaurant": {
        l0_macro: 10,
        l1_city: 14,
        l2_block: 20,
        l3_planfit: 22,
        l4_talent: 10,
        l5_resilience: 8,
        l6_zoning: 6,
        l7_feel: 10
      },
      "Fitness": {
        l0_macro: 12,
        l1_city: 16,
        l2_block: 16,
        l3_planfit: 18,
        l4_talent: 12,
        l5_resilience: 10,
        l6_zoning: 6,
        l7_feel: 10
      }
    };
    const getDefaultWeights = (type) => {
      return defaultWeightsByType[type] || defaultWeightsByType["Specialty Coffee/Café"];
    };
    let weights = getDefaultWeights(businessType);
    let weightColors = [
      "#e74c3c",
      "#f39c12",
      "#f1c40f",
      "#27ae60",
      "#3498db",
      "#9b59b6",
      "#1abc9c",
      "#34495e"
    ];
    const liveScores = derived(() => {
      return null;
    });
    head("94j68w", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Concept: Engine Calibration</title>`);
      });
    });
    $$renderer2.push(`<div class="page svelte-94j68w"><div class="page-header svelte-94j68w"><div class="breadcrumbs svelte-94j68w"><a href="/app/vision/founder" class="breadcrumb completed svelte-94j68w">✓ Founder</a> <span class="breadcrumb-arrow svelte-94j68w">→</span> <a href="/app/vision/concept" class="breadcrumb completed svelte-94j68w">✓ Concept</a> <span class="breadcrumb-arrow svelte-94j68w">→</span> <a href="/app/vision/financial" class="breadcrumb completed svelte-94j68w">✓ Financial</a> <span class="breadcrumb-arrow svelte-94j68w">→</span> <a href="/app/vision/calibration" class="breadcrumb active svelte-94j68w">Calibration</a></div> <h1 class="svelte-94j68w">ENGINE CALIBRATION</h1> <p class="subtitle svelte-94j68w">Alignment Engine Weights (L0-L7)</p></div> `);
    if (saveStatus) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="save-indicator svelte-94j68w">${escape_html(saveStatus)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="content svelte-94j68w"><section class="section weight-section svelte-94j68w"><div class="section-context-paragraph svelte-94j68w">These weights determine how the algorithm scores locations for YOUR specific business. A coffee shop needs foot traffic above all else. A destination restaurant cares more about transit access and reputation. Adjust these to match what matters most to you.</div> <div class="section-header svelte-94j68w"><div><h2 class="svelte-94j68w">Alignment Engine Weights</h2> <p class="weight-subtitle svelte-94j68w">Adjust how much each factor matters for YOUR specific business</p></div> <button class="btn-reset svelte-94j68w">Reset to Default</button></div> <div class="section-content svelte-94j68w"><div class="form-group svelte-94j68w" style="margin-bottom: 2rem;"><label for="businessType" class="svelte-94j68w">Business Type (to auto-load preset weights)</label> `);
    $$renderer2.select(
      {
        value: businessType,
        id: "businessType",
        oninput: triggerSave,
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(businessTypes);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let type = each_array[$$index];
          $$renderer3.option({ value: type }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(type)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-94j68w"
    );
    $$renderer2.push(`</div> <div class="sliders-grid svelte-94j68w"><div class="slider-item svelte-94j68w"><div class="slider-label svelte-94j68w">L0 Macro Climate</div> <div class="slider-value svelte-94j68w">${escape_html(weights.l0_macro)}%</div> <input type="range" min="0" max="100"${attr("value", weights.l0_macro)} class="slider svelte-94j68w"/> <div class="slider-desc svelte-94j68w">Economic climate &amp; market trends</div></div> <div class="slider-item svelte-94j68w"><div class="slider-label svelte-94j68w">L1 City Dynamics</div> <div class="slider-value svelte-94j68w">${escape_html(weights.l1_city)}%</div> <input type="range" min="0" max="100"${attr("value", weights.l1_city)} class="slider svelte-94j68w"/> <div class="slider-desc svelte-94j68w">Urban development &amp; growth</div></div> <div class="slider-item svelte-94j68w"><div class="slider-label svelte-94j68w">L2 Block Intelligence</div> <div class="slider-value svelte-94j68w">${escape_html(weights.l2_block)}%</div> <input type="range" min="0" max="100"${attr("value", weights.l2_block)} class="slider svelte-94j68w"/> <div class="slider-desc svelte-94j68w">Foot traffic &amp; demographics</div></div> <div class="slider-item svelte-94j68w"><div class="slider-label svelte-94j68w">L3 Plan Fit</div> <div class="slider-value svelte-94j68w">${escape_html(weights.l3_planfit)}%</div> <input type="range" min="0" max="100"${attr("value", weights.l3_planfit)} class="slider svelte-94j68w"/> <div class="slider-desc svelte-94j68w">Space size &amp; rent alignment</div></div> <div class="slider-item svelte-94j68w"><div class="slider-label svelte-94j68w">L4 Talent</div> <div class="slider-value svelte-94j68w">${escape_html(weights.l4_talent)}%</div> <input type="range" min="0" max="100"${attr("value", weights.l4_talent)} class="slider svelte-94j68w"/> <div class="slider-desc svelte-94j68w">Labor availability &amp; wages</div></div> <div class="slider-item svelte-94j68w"><div class="slider-label svelte-94j68w">L5 Resilience</div> <div class="slider-value svelte-94j68w">${escape_html(weights.l5_resilience)}%</div> <input type="range" min="0" max="100"${attr("value", weights.l5_resilience)} class="slider svelte-94j68w"/> <div class="slider-desc svelte-94j68w">Economic stability &amp; diversity</div></div> <div class="slider-item svelte-94j68w"><div class="slider-label svelte-94j68w">L6 Zoning &amp; Legal</div> <div class="slider-value svelte-94j68w">${escape_html(weights.l6_zoning)}%</div> <input type="range" min="0" max="100"${attr("value", weights.l6_zoning)} class="slider svelte-94j68w"/> <div class="slider-desc svelte-94j68w">Zoning compliance &amp; permits</div></div> <div class="slider-item svelte-94j68w"><div class="slider-label svelte-94j68w">L7 Feel</div> <div class="slider-value svelte-94j68w">${escape_html(weights.l7_feel)}%</div> <input type="range" min="0" max="25"${attr("value", weights.l7_feel)} class="slider svelte-94j68w"/> <div class="slider-desc svelte-94j68w">Neighborhood vibe &amp; culture</div></div></div> <div class="weight-bar-container svelte-94j68w"><div class="weight-bar-bg svelte-94j68w"><!--[-->`);
    const each_array_1 = ensure_array_like(Object.entries(weights));
    for (let idx = 0, $$length = each_array_1.length; idx < $$length; idx++) {
      let [key, value] = each_array_1[idx];
      $$renderer2.push(`<div class="weight-segment svelte-94j68w"${attr_style(`width: ${stringify(value)}%; background-color: ${stringify(weightColors[idx])}`)}${attr("title", `${stringify(key)}: ${stringify(value)}%`)}></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="weight-labels svelte-94j68w"><span>L0</span> <span>L1</span> <span>L2</span> <span>L3</span> <span>L4</span> <span>L5</span> <span>L6</span> <span>L7</span></div></div> <div class="weight-total svelte-94j68w" style="margin-top: 2rem;"><strong class="svelte-94j68w">Total Weight:</strong> ${escape_html(Object.values(weights).reduce((a, b) => a + b, 0))}%</div> `);
    if (liveScores() && liveScores().length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sensitivity-panel svelte-94j68w"><h3 class="sensitivity-title svelte-94j68w">Live Score Preview</h3> <p class="sensitivity-desc svelte-94j68w">See how your weight changes affect neighborhood scores in real time.</p> <div class="sensitivity-scores svelte-94j68w"><!--[-->`);
      const each_array_2 = ensure_array_like(liveScores());
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let hood = each_array_2[$$index_2];
        $$renderer2.push(`<div class="sensitivity-card svelte-94j68w"><div class="sensitivity-name svelte-94j68w">${escape_html(hood.name)}</div> <div class="sensitivity-score svelte-94j68w"${attr_style(`color: ${stringify(hood.label.color)}`)}>${escape_html(hood.score)}</div> <div class="sensitivity-label svelte-94j68w"${attr_style(`color: ${stringify(hood.label.color)}; background: ${stringify(hood.label.bgColor)}`)}>${escape_html(hood.label.label)}</div> <div class="sensitivity-breakdown svelte-94j68w"><span title="Concept-Location Fit" class="svelte-94j68w">VLF ${escape_html(hood.vlf)}</span> <span title="Goal Feasibility" class="svelte-94j68w">GLF ${escape_html(hood.glf)}</span> <span title="Risk &amp; Resilience" class="svelte-94j68w">R&amp;R ${escape_html(hood.rr)}</span></div></div>`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></section> `);
    EMC2Button($$renderer2, {
      expansionText: "Evaluate My Concept Clarity"
    });
    $$renderer2.push(`<!----> <div class="nav-footer svelte-94j68w"><a href="/app/vision/financial" class="nav-link svelte-94j68w">← Back: Financial</a> <a href="/app/vision/review" class="nav-link primary svelte-94j68w">Next: Review →</a></div></div></div>`);
  });
}
export {
  _page as default
};
