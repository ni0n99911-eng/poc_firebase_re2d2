import { h as head, j as ensure_array_like, e as escape_html, b as attr, c as attr_class, k as attr_style, i as stringify, d as derived } from "../../../../../chunks/index2.js";
import { C as CONCEPT_UI_DEFAULTS } from "../../../../../chunks/conceptDefaults.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    function autoSave() {
      return;
    }
    let businessType = "Specialty Coffee/Café";
    let businessName = "";
    let differentiator = "";
    let competitiveStrategy = {
      differentiators: {
        uniqueProduct: false,
        priceLeader: false,
        premiumExperience: false,
        healthWellness: false,
        technologyDriven: false,
        communityHub: false
      },
      targetSegments: {
        officeWorkers: false,
        families: false,
        students: false,
        healthEnthusiasts: false,
        remoteWorkers: false,
        tourists: false
      }
    };
    let idealArea = "";
    let preferredNeighborhoods = "";
    const businessTypes = [
      "Specialty Coffee/Café",
      "Restaurant (Fast Casual)",
      "Restaurant (Full Service)",
      "Retail",
      "Fitness / Wellness",
      "Salon / Barbershop",
      "Professional Services",
      "Grocery / Market",
      "Other"
    ];
    const differentiatorOptions = [
      { key: "uniqueProduct", label: "Unique Product", icon: "🌟" },
      { key: "priceLeader", label: "Price Leader", icon: "💲" },
      {
        key: "premiumExperience",
        label: "Premium Experience",
        icon: "✨"
      },
      { key: "healthWellness", label: "Health Focus", icon: "💚" },
      { key: "technologyDriven", label: "Tech-Driven", icon: "🤖" },
      { key: "communityHub", label: "Community Hub", icon: "🏠" }
    ];
    const segmentOptions = [
      { key: "officeWorkers", label: "Office Workers", icon: "🏢" },
      {
        key: "healthEnthusiasts",
        label: "Health / Fitness",
        icon: "💪"
      },
      { key: "families", label: "Families", icon: "👨‍👩‍👧" },
      { key: "students", label: "Students", icon: "🎓" },
      { key: "remoteWorkers", label: "Remote Workers", icon: "💻" },
      { key: "tourists", label: "Tourists", icon: "✈️" }
    ];
    const areaOptions = [
      "Nolita / NoHo",
      "East Village",
      "West Village",
      "SoHo",
      "Chelsea / Flatiron",
      "Lower East Side",
      "Tribeca",
      "Midtown",
      "UWS / UES",
      "Gramercy / Murray Hill",
      "Williamsburg",
      "DUMBO / Cobble Hill",
      "Park Slope",
      "Other"
    ];
    const BIZ_TYPE_TO_CONCEPT = {
      "Specialty Coffee/Café": "specialty_coffee",
      "Restaurant (Fast Casual)": "fast_casual",
      "Restaurant (Full Service)": "full_service_restaurant",
      "Retail": "retail",
      "Fitness / Wellness": "fitness_studio",
      "Salon / Barbershop": "personal_services",
      "Professional Services": "medical_office",
      "Grocery / Market": "retail"
    };
    const CONCEPT_SMART_DEFAULTS = CONCEPT_UI_DEFAULTS;
    let currentConceptKey = derived(() => BIZ_TYPE_TO_CONCEPT[businessType]);
    let smartDefaults = derived(() => currentConceptKey() ? CONCEPT_SMART_DEFAULTS[currentConceptKey()] : null);
    function formatCurrency(value) {
      if (!value && value !== 0) return "";
      return "$" + Number(value).toLocaleString("en-US");
    }
    let completeness = derived(() => () => {
      let filled = 0;
      let total = 10;
      filled++;
      return Math.round(filled / total * 100);
    });
    head("1cu3lp0", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Concept &amp; Goals</title>`);
      });
    });
    $$renderer2.push(`<div class="page svelte-1cu3lp0">`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="split-layout svelte-1cu3lp0"><div class="form-area svelte-1cu3lp0"><div class="page-header svelte-1cu3lp0"><h1 class="svelte-1cu3lp0">Concept &amp; Goals</h1> <p class="subtitle svelte-1cu3lp0">Your business identity and financial targets. Everything here feeds directly into your score and recommendations.</p></div> <section class="section svelte-1cu3lp0"><div class="section-header svelte-1cu3lp0"><div class="section-num svelte-1cu3lp0">1</div> <h2 class="svelte-1cu3lp0">Business Identity</h2></div> <div class="section-content svelte-1cu3lp0"><div class="form-row cols-2 svelte-1cu3lp0"><div class="form-group svelte-1cu3lp0"><label for="businessType" class="svelte-1cu3lp0">Business Type</label> `);
    $$renderer2.select(
      {
        value: businessType,
        id: "businessType",
        onchange: autoSave,
        class: "form-input"
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
      "svelte-1cu3lp0"
    );
    $$renderer2.push(`</div> <div class="form-group svelte-1cu3lp0"><label for="businessName" class="svelte-1cu3lp0">Business Name</label> <input class="form-input svelte-1cu3lp0" type="text" id="businessName"${attr("value", businessName)} placeholder="e.g. Green Bowl Co."/></div></div> <div class="form-group svelte-1cu3lp0"><label for="differentiator" class="svelte-1cu3lp0">What makes you different? <span class="feeds svelte-1cu3lp0">→ concept alignment</span></label> <textarea class="form-input form-textarea svelte-1cu3lp0" id="differentiator" placeholder="One sentence. What's your edge?" rows="2">`);
    const $$body = escape_html(differentiator);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea></div> <div class="form-group svelte-1cu3lp0"><label class="svelte-1cu3lp0">Target Customers <span class="feeds svelte-1cu3lp0">→ demographics match</span></label> <div class="chip-grid svelte-1cu3lp0"><!--[-->`);
    const each_array_1 = ensure_array_like(segmentOptions);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let seg = each_array_1[$$index_1];
      $$renderer2.push(`<button${attr_class("chip svelte-1cu3lp0", void 0, { "active": competitiveStrategy.targetSegments[seg.key] })}>${escape_html(seg.icon)} ${escape_html(seg.label)}</button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="form-group svelte-1cu3lp0"><label class="svelte-1cu3lp0">Key Differentiators <span class="feeds svelte-1cu3lp0">→ competition scoring</span></label> <div class="chip-grid svelte-1cu3lp0"><!--[-->`);
    const each_array_2 = ensure_array_like(differentiatorOptions);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let diff = each_array_2[$$index_2];
      $$renderer2.push(`<button${attr_class("chip svelte-1cu3lp0", void 0, { "active": competitiveStrategy.differentiators[diff.key] })}>${escape_html(diff.icon)} ${escape_html(diff.label)}</button>`);
    }
    $$renderer2.push(`<!--]--></div></div></div></section> <section class="section svelte-1cu3lp0"><div class="section-header svelte-1cu3lp0"><div class="section-num svelte-1cu3lp0">2</div> <h2 class="svelte-1cu3lp0">Financial Targets</h2> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="section-content svelte-1cu3lp0">`);
    {
      $$renderer2.push("<!--[0-->");
      if (smartDefaults()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="estimates-intro svelte-1cu3lp0">RE² pre-fills these from <strong>${escape_html(businessType)}</strong> benchmarks. Most founders use them as a starting point and refine after scoring a location.</p> <div class="estimates-grid svelte-1cu3lp0"><div class="estimates-item svelte-1cu3lp0"><span class="est-icon svelte-1cu3lp0">💰</span> <div><div class="est-label svelte-1cu3lp0">Year 1 Revenue</div> <div class="est-value svelte-1cu3lp0">~${escape_html(formatCurrency(smartDefaults().revenue))}</div></div></div> <div class="estimates-item svelte-1cu3lp0"><span class="est-icon svelte-1cu3lp0">🧾</span> <div><div class="est-label svelte-1cu3lp0">Avg Ticket</div> <div class="est-value svelte-1cu3lp0">$${escape_html(smartDefaults().ticket)}</div></div></div> <div class="estimates-item svelte-1cu3lp0"><span class="est-icon svelte-1cu3lp0">👥</span> <div><div class="est-label svelte-1cu3lp0">Customers / Day</div> <div class="est-value svelte-1cu3lp0">~${escape_html(smartDefaults().transactions)}</div></div></div> <div class="estimates-item svelte-1cu3lp0"><span class="est-icon svelte-1cu3lp0">🏠</span> <div><div class="est-label svelte-1cu3lp0">Monthly Rent</div> <div class="est-value svelte-1cu3lp0">${escape_html(formatCurrency(smartDefaults().rent))}/mo</div></div></div> <div class="estimates-item svelte-1cu3lp0"><span class="est-icon svelte-1cu3lp0">📐</span> <div><div class="est-label svelte-1cu3lp0">Space Needed</div> <div class="est-value svelte-1cu3lp0">${escape_html(smartDefaults().sqft.toLocaleString())} sq ft</div></div></div> <div class="estimates-item svelte-1cu3lp0"><span class="est-icon svelte-1cu3lp0">🔧</span> <div><div class="est-label svelte-1cu3lp0">Startup Capital</div> <div class="est-value svelte-1cu3lp0">~${escape_html(formatCurrency(smartDefaults().startup))}</div></div></div> <div class="estimates-item svelte-1cu3lp0"><span class="est-icon svelte-1cu3lp0">👤</span> <div><div class="est-label svelte-1cu3lp0">Team Size</div> <div class="est-value svelte-1cu3lp0">${escape_html(smartDefaults().team)} FTEs</div></div></div> <div class="estimates-item svelte-1cu3lp0"><span class="est-icon svelte-1cu3lp0">💵</span> <div><div class="est-label svelte-1cu3lp0">Owner's Take-Home</div> <div class="est-value svelte-1cu3lp0">~${escape_html(formatCurrency(smartDefaults().sde))}</div></div></div></div> <div class="estimates-actions svelte-1cu3lp0"><button class="estimates-use-btn svelte-1cu3lp0">Use these estimates — I'll refine later →</button> `);
        {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <button class="estimates-manual-btn svelte-1cu3lp0">I know my numbers</button></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<p class="estimates-intro svelte-1cu3lp0">Select a business type above to see RE² estimates, or enter your own numbers.</p> <button class="estimates-manual-btn standalone svelte-1cu3lp0">Enter my numbers →</button>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></section> <section class="section svelte-1cu3lp0"><div class="section-header svelte-1cu3lp0"><div class="section-num svelte-1cu3lp0">3</div> <h2 class="svelte-1cu3lp0">Location Preferences</h2></div> <div class="section-content svelte-1cu3lp0"><div class="form-row cols-2 svelte-1cu3lp0"><div class="form-group svelte-1cu3lp0"><label class="svelte-1cu3lp0">Preferred Area <span class="feeds svelte-1cu3lp0">→ location search</span></label> `);
    $$renderer2.select(
      { value: idealArea, class: "form-input", onchange: autoSave },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`Select an area...`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_3 = ensure_array_like(areaOptions);
        for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
          let area = each_array_3[$$index_3];
          $$renderer3.option({ value: area }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(area)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-1cu3lp0"
    );
    $$renderer2.push(`</div> <div class="form-group svelte-1cu3lp0"><label class="svelte-1cu3lp0">Preferred Neighborhoods</label> <input class="form-input svelte-1cu3lp0" type="text"${attr("value", preferredNeighborhoods)} placeholder="e.g. Nolita, East Village"/></div></div></div></section> <div class="nav-footer svelte-1cu3lp0"><a href="/app/vision/founder" class="nav-link svelte-1cu3lp0">← Back: Profile</a> <a href="/app/location" class="nav-link primary svelte-1cu3lp0">See your score →</a></div></div> <aside class="review-panel svelte-1cu3lp0"><div class="review-card svelte-1cu3lp0"><h3 class="svelte-1cu3lp0">📋 Concept Review</h3> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="review-section-label svelte-1cu3lp0">Concept &amp; Goals</div> <div class="review-row svelte-1cu3lp0"><span class="review-key svelte-1cu3lp0">Type</span> <span class="review-val svelte-1cu3lp0">${escape_html(businessType)}</span></div> <div class="review-row svelte-1cu3lp0"><span class="review-key svelte-1cu3lp0">Name</span> <span class="review-val svelte-1cu3lp0">${escape_html("—")}</span></div> <div class="review-row svelte-1cu3lp0"><span class="review-key svelte-1cu3lp0">Capital</span> <span class="review-val highlight svelte-1cu3lp0">${escape_html("—")}</span></div> <div class="review-row svelte-1cu3lp0"><span class="review-key svelte-1cu3lp0">Rent Budget</span> <span class="review-val highlight svelte-1cu3lp0">${escape_html("—")}</span></div> <div class="review-row svelte-1cu3lp0"><span class="review-key svelte-1cu3lp0">Sq Ft</span> <span class="review-val svelte-1cu3lp0">${escape_html("—")}</span></div> <div class="review-row svelte-1cu3lp0"><span class="review-key svelte-1cu3lp0">Y1 Revenue</span> <span class="review-val svelte-1cu3lp0">${escape_html("—")}</span></div> <div class="review-row svelte-1cu3lp0"><span class="review-key svelte-1cu3lp0">Ticket</span> <span class="review-val svelte-1cu3lp0">${escape_html("—")}</span></div> <div class="review-row svelte-1cu3lp0"><span class="review-key svelte-1cu3lp0">Team</span> <span class="review-val svelte-1cu3lp0">${escape_html("—")}</span></div> <div class="review-row svelte-1cu3lp0"><span class="review-key svelte-1cu3lp0">Area</span> <span class="review-val svelte-1cu3lp0">${escape_html("—")}</span></div> <div class="review-completeness svelte-1cu3lp0"><div class="review-pct svelte-1cu3lp0"><span>Completeness</span> <span class="review-pct-num svelte-1cu3lp0">${escape_html(completeness()())}%</span></div> <div class="review-bar svelte-1cu3lp0"><div class="review-bar-fill svelte-1cu3lp0"${attr_style(`width: ${stringify(completeness()())}%`)}></div></div></div> <a href="/app/location" class="review-cta svelte-1cu3lp0">→ See your score</a></div></aside></div></div>`);
  });
}
export {
  _page as default
};
