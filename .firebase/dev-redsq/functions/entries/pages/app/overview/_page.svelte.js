import { j as ensure_array_like, c as attr_class, e as escape_html, b as attr, ac as bind_props, k as attr_style, i as stringify, h as head, d as derived } from "../../../../chunks/index2.js";
import { saveLaunchPadData } from "../../../../chunks/launchpad-store.js";
import { C as CONCEPT_REGISTRY } from "../../../../chunks/concepts.js";
function FounderProfile($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { founderProfile = void 0, founderProfileComplete, onchange } = $$props;
    $$renderer2.push(`<section class="section founder-profile-section"><div class="section-context-paragraph">Before scoring a single location, let's understand you as a founder. Your answers here feed into every module — business model, financial projections, loan package, and coaching recommendations.</div> <div class="section-header"><h2>Founder Profile</h2> `);
    if (founderProfileComplete) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="section-badge complete svelte-1vsg8r7">Complete</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="section-badge svelte-1vsg8r7">Required</span>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="section-content"><div class="profile-question svelte-1vsg8r7"><h3 class="profile-q-label svelte-1vsg8r7">What do you want from this business?</h3> <div class="card-options svelte-1vsg8r7"><!--[-->`);
    const each_array = ensure_array_like([
      {
        value: "legacy",
        label: "Legacy",
        desc: "Generational wealth and a lasting brand"
      },
      {
        value: "passion",
        label: "Full-Time Passion",
        desc: "This is your primary career and calling"
      },
      {
        value: "sideincome",
        label: "Side Income",
        desc: "Keep your day job, build on the side"
      },
      {
        value: "investment",
        label: "Investment",
        desc: "Portfolio play — returns matter most"
      },
      {
        value: "community",
        label: "Community Impact",
        desc: "Mission-driven, serving your neighborhood"
      }
    ]);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let opt = each_array[$$index];
      $$renderer2.push(`<button${attr_class("profile-card svelte-1vsg8r7", void 0, { "selected": founderProfile.motivation === opt.value })}><span class="card-title svelte-1vsg8r7">${escape_html(opt.label)}</span> <span class="card-desc svelte-1vsg8r7">${escape_html(opt.desc)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="profile-question svelte-1vsg8r7"><h3 class="profile-q-label svelte-1vsg8r7">What kind of owner will you be?</h3> <div class="card-options svelte-1vsg8r7"><!--[-->`);
    const each_array_1 = ensure_array_like([
      {
        value: "fulltime",
        label: "Full-Time Operator",
        desc: "You're there every day running the show"
      },
      {
        value: "parttime",
        label: "Part-Time Operator",
        desc: "Evenings/weekends — manager runs day shift"
      },
      {
        value: "absentee",
        label: "Absentee Owner",
        desc: "Hire a full management team"
      },
      {
        value: "partnership",
        label: "Partnership",
        desc: "Splitting operations with a co-founder"
      }
    ]);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let opt = each_array_1[$$index_1];
      $$renderer2.push(`<button${attr_class("profile-card svelte-1vsg8r7", void 0, { "selected": founderProfile.ownerType === opt.value })}><span class="card-title svelte-1vsg8r7">${escape_html(opt.label)}</span> <span class="card-desc svelte-1vsg8r7">${escape_html(opt.desc)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="profile-question svelte-1vsg8r7"><h3 class="profile-q-label svelte-1vsg8r7">What's your risk tolerance?</h3> <div class="card-options card-options-3 svelte-1vsg8r7"><!--[-->`);
    const each_array_2 = ensure_array_like([
      {
        value: "conservative",
        label: "Conservative",
        desc: "Protect capital, slow and steady growth"
      },
      {
        value: "moderate",
        label: "Moderate",
        desc: "Willing to invest for faster returns"
      },
      {
        value: "aggressive",
        label: "Aggressive",
        desc: "Go big — accept higher risk for higher upside"
      }
    ]);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let opt = each_array_2[$$index_2];
      $$renderer2.push(`<button${attr_class("profile-card svelte-1vsg8r7", void 0, { "selected": founderProfile.riskTolerance === opt.value })}><span class="card-title svelte-1vsg8r7">${escape_html(opt.label)}</span> <span class="card-desc svelte-1vsg8r7">${escape_html(opt.desc)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="profile-question svelte-1vsg8r7"><h3 class="profile-q-label svelte-1vsg8r7">Have you operated a business before?</h3> <div class="card-options svelte-1vsg8r7"><!--[-->`);
    const each_array_3 = ensure_array_like([
      {
        value: "firsttime",
        label: "First-Time Founder",
        desc: "This is your first business venture"
      },
      {
        value: "other-industry",
        label: "Other Industry",
        desc: "Ran a business, but not in retail/food"
      },
      {
        value: "experienced",
        label: "Experienced Operator",
        desc: "You've run retail or food businesses"
      },
      {
        value: "serial",
        label: "Serial Entrepreneur",
        desc: "Multiple ventures under your belt"
      }
    ]);
    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
      let opt = each_array_3[$$index_3];
      $$renderer2.push(`<button${attr_class("profile-card svelte-1vsg8r7", void 0, { "selected": founderProfile.experience === opt.value })}><span class="card-title svelte-1vsg8r7">${escape_html(opt.label)}</span> <span class="card-desc svelte-1vsg8r7">${escape_html(opt.desc)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="profile-question svelte-1vsg8r7"><h3 class="profile-q-label svelte-1vsg8r7">What does success look like in Year 1?</h3> <div class="grid grid-2col"><div class="col"><div class="form-group"><label for="y1Revenue">Revenue Target</label> <input type="number" id="y1Revenue"${attr("value", founderProfile.yearOneGoals.revenueTarget)}/></div> <div class="form-group"><label for="y1Income">Personal Income Target</label> <input type="number" id="y1Income"${attr("value", founderProfile.yearOneGoals.personalIncomeTarget)}/></div></div> <div class="col"><div class="form-group"><label for="y1Employees">Number of Employees</label> <input type="number" id="y1Employees"${attr("value", founderProfile.yearOneGoals.employeeCount)}/></div> <div class="form-group"><label for="y1Locations">Number of Locations</label> <input type="number" id="y1Locations"${attr("value", founderProfile.yearOneGoals.locationCount)}/></div></div></div></div> `);
    if (founderProfileComplete) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="coaching-callout svelte-1vsg8r7"><div class="coaching-icon svelte-1vsg8r7">🎯</div> <div class="coaching-text svelte-1vsg8r7"><strong class="svelte-1vsg8r7">Profile Impact:</strong> `);
      if (founderProfile.ownerType === "absentee") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`Management salary ($55K-$75K/yr) will be added to your financial projections.`);
      } else if (founderProfile.ownerType === "parttime") {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`Part-time management costs factored into projections.`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (founderProfile.riskTolerance === "conservative") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`Scoring weights favor affordability and lower-risk neighborhoods.`);
      } else if (founderProfile.riskTolerance === "aggressive") {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`Scoring weights favor high-traffic premium neighborhoods.`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (founderProfile.experience === "firsttime") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`Additional coaching modules enabled. Conservative capture rates applied.`);
      } else if (founderProfile.experience === "serial") {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`Multi-location planning unlocked. Aggressive financial assumptions available.`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></section>`);
    bind_props($$props, { founderProfile });
  });
}
function CreditProfile($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { creditProfile = void 0, onchange } = $$props;
    $$renderer2.push(`<section class="section credit-profile-section"><div class="section-context-paragraph">This adjusts your lender matching, interest rate estimates, and coaching. We never perform credit checks — this stays in your account.</div> <div class="section-header"><h2>Credit Profile</h2> <span class="section-badge privacy svelte-1kxsgc1">No Hard Pull</span></div> <div class="section-content"><div class="profile-question svelte-1kxsgc1"><h3 class="profile-q-label svelte-1kxsgc1">Select your credit score range</h3> <div class="card-options card-options-5 svelte-1kxsgc1"><!--[-->`);
    const each_array = ensure_array_like([
      { value: "excellent", label: "750+", desc: "Excellent" },
      { value: "good", label: "700-749", desc: "Good" },
      { value: "fair", label: "650-699", desc: "Fair" },
      { value: "building", label: "Below 650", desc: "Building" },
      { value: "unknown", label: "Not Sure", desc: "I don't know" }
    ]);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let opt = each_array[$$index];
      $$renderer2.push(`<button${attr_class("profile-card profile-card-sm svelte-1kxsgc1", void 0, { "selected": creditProfile.scoreRange === opt.value })}><span class="card-title svelte-1kxsgc1">${escape_html(opt.label)}</span> <span class="card-desc svelte-1kxsgc1">${escape_html(opt.desc)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="credit-flags svelte-1kxsgc1"><label class="credit-flag svelte-1kxsgc1"><input type="checkbox"${attr("checked", creditProfile.bankruptcy, true)} class="svelte-1kxsgc1"/> <span>Any bankruptcies in the last 7 years?</span></label> <label class="credit-flag svelte-1kxsgc1"><input type="checkbox"${attr("checked", creditProfile.latePayments, true)} class="svelte-1kxsgc1"/> <span>Any late payments in the last 12 months?</span></label> <label class="credit-flag svelte-1kxsgc1"><input type="checkbox"${attr("checked", creditProfile.collections, true)} class="svelte-1kxsgc1"/> <span>Outstanding collections?</span></label> <label class="credit-flag svelte-1kxsgc1"><input type="checkbox"${attr("checked", creditProfile.existingDebt === "yes", true)} class="svelte-1kxsgc1"/> <span>Existing business debt?</span></label></div> `);
    if (creditProfile.scoreRange === "building") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="coaching-callout coaching-warning svelte-1kxsgc1"><div class="coaching-icon svelte-1kxsgc1">📋</div> <div class="coaching-text svelte-1kxsgc1"><strong class="svelte-1kxsgc1">Credit Coaching:</strong> To unlock SBA 7(a) at better rates, focus on improving to 700+. Matched lenders adjusted to microloans and CDFI programs. We'll show you a 90-day credit improvement plan.</div></div>`);
    } else if (creditProfile.scoreRange === "fair") {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="coaching-callout coaching-info svelte-1kxsgc1"><div class="coaching-icon svelte-1kxsgc1">💡</div> <div class="coaching-text svelte-1kxsgc1"><strong class="svelte-1kxsgc1">Tip:</strong> SBA microloans and CDFI programs are your best match. Improving to 700+ unlocks SBA 7(a) at better rates — here are 3 things you can do in 90 days.</div></div>`);
    } else if (creditProfile.scoreRange === "unknown") {
      $$renderer2.push("<!--[2-->");
      $$renderer2.push(`<div class="coaching-callout coaching-info svelte-1kxsgc1"><div class="coaching-icon svelte-1kxsgc1">🔍</div> <div class="coaching-text svelte-1kxsgc1"><strong class="svelte-1kxsgc1">Check your score for free:</strong> Credit Karma, Experian, or your bank's app. We'll show all lender options unfiltered, but results are more accurate with your credit range.</div></div>`);
    } else if (creditProfile.scoreRange === "excellent" || creditProfile.scoreRange === "good") {
      $$renderer2.push("<!--[3-->");
      $$renderer2.push(`<div class="coaching-callout coaching-success svelte-1kxsgc1"><div class="coaching-icon svelte-1kxsgc1">✓</div> <div class="coaching-text svelte-1kxsgc1"><strong class="svelte-1kxsgc1">Strong position.</strong> Eligible for all SBA 7(a) lenders at ${escape_html(creditProfile.scoreRange === "excellent" ? "preferred" : "standard")} rates. Full lender list available in Loan IQ.</div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="privacy-notice svelte-1kxsgc1">RE² never performs credit checks. This information stays in your account and is used only to match you with appropriate lenders and programs.</div></div></section>`);
    bind_props($$props, { creditProfile });
  });
}
function CompetitiveStrategy($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { competitiveStrategy = void 0 } = $$props;
    $$renderer2.push(`<section class="section"><div class="section-context-paragraph">Define your competitive positioning and target customer segments. The algorithm uses these to score locations for your specific strategic fit, not generic viability.</div> <div class="section-header"><h2>Competitive Strategy</h2></div> <div class="section-content"><div class="subsection"><h3 class="subsection-title">Your Key Differentiators (select all that apply)</h3> <div class="checkbox-grid"><div class="checkbox-item"><input type="checkbox" id="diff-unique"${attr("checked", competitiveStrategy.differentiators.uniqueProduct, true)}/> <label for="diff-unique">Unique product or service</label></div> <div class="checkbox-item"><input type="checkbox" id="diff-price"${attr("checked", competitiveStrategy.differentiators.priceLeader, true)}/> <label for="diff-price">Price leader / value positioning</label></div> <div class="checkbox-item"><input type="checkbox" id="diff-premium"${attr("checked", competitiveStrategy.differentiators.premiumExperience, true)}/> <label for="diff-premium">Premium experience / brand</label></div> <div class="checkbox-item"><input type="checkbox" id="diff-health"${attr("checked", competitiveStrategy.differentiators.healthWellness, true)}/> <label for="diff-health">Health / wellness focus</label></div> <div class="checkbox-item"><input type="checkbox" id="diff-tech"${attr("checked", competitiveStrategy.differentiators.technologyDriven, true)}/> <label for="diff-tech">Technology-driven innovation</label></div> <div class="checkbox-item"><input type="checkbox" id="diff-community"${attr("checked", competitiveStrategy.differentiators.communityHub, true)}/> <label for="diff-community">Community hub / gathering place</label></div></div></div> <div class="subsection"><h3 class="subsection-title">Target Customer Segments (select all that apply)</h3> <div class="checkbox-grid"><div class="checkbox-item"><input type="checkbox" id="seg-office"${attr("checked", competitiveStrategy.targetSegments.officeWorkers, true)}/> <label for="seg-office">Office / corporate workers</label></div> <div class="checkbox-item"><input type="checkbox" id="seg-families"${attr("checked", competitiveStrategy.targetSegments.families, true)}/> <label for="seg-families">Families with children</label></div> <div class="checkbox-item"><input type="checkbox" id="seg-students"${attr("checked", competitiveStrategy.targetSegments.students, true)}/> <label for="seg-students">Students / academic community</label></div> <div class="checkbox-item"><input type="checkbox" id="seg-health"${attr("checked", competitiveStrategy.targetSegments.healthEnthusiasts, true)}/> <label for="seg-health">Health / fitness enthusiasts</label></div> <div class="checkbox-item"><input type="checkbox" id="seg-remote"${attr("checked", competitiveStrategy.targetSegments.remoteWorkers, true)}/> <label for="seg-remote">Remote / freelance workers</label></div> <div class="checkbox-item"><input type="checkbox" id="seg-tourists"${attr("checked", competitiveStrategy.targetSegments.tourists, true)}/> <label for="seg-tourists">Tourists / visitors</label></div></div></div></div></section>`);
    bind_props($$props, { competitiveStrategy });
  });
}
function RiskTolerance($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { riskTolerance = void 0 } = $$props;
    $$renderer2.push(`<section class="section"><div class="section-context-paragraph">Describe your risk appetite and timeline expectations. Conservative operators need predictable neighborhoods; aggressive operators can take bets on emerging areas.</div> <div class="section-header"><h2>Risk Tolerance &amp; Timeline</h2></div> <div class="section-content"><div class="form-group" style="margin-bottom: 2rem;"><div class="label-with-helper svelte-m74jo5"><label style="margin-bottom: 0.5rem;">Risk Appetite: Conservative ↔ Aggressive</label> <span class="input-helper">Affects neighborhood stability scores and growth projections</span></div> <div class="risk-slider-container svelte-m74jo5"><div class="risk-label svelte-m74jo5">Conservative</div> <input type="range" min="10" max="90"${attr("value", riskTolerance.riskLevel)} class="risk-slider svelte-m74jo5"/> <div class="risk-label svelte-m74jo5">Aggressive</div></div> <div class="risk-value-display svelte-m74jo5">Current Risk Level: <strong class="svelte-m74jo5">${escape_html(riskTolerance.riskLevel)}%</strong> <span class="risk-description svelte-m74jo5">`);
    if (riskTolerance.riskLevel < 35) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`Very Conservative — Established areas, proven concepts`);
    } else if (riskTolerance.riskLevel < 55) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`Balanced — Mix of stable and emerging neighborhoods`);
    } else if (riskTolerance.riskLevel < 75) {
      $$renderer2.push("<!--[2-->");
      $$renderer2.push(`Growth-oriented — Willing to bet on emerging areas`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`Aggressive — High-growth, early-stage neighborhoods`);
    }
    $$renderer2.push(`<!--]--></span></div></div> <div class="grid grid-2col"><div class="form-group"><label for="maxBurn">Max Monthly Burn During Ramp-up</label> <input type="number" id="maxBurn"${attr("value", riskTolerance.maxMonthlyBurn)} placeholder="15000" min="5000" step="1000"/> <span class="input-helper">Maximum acceptable monthly cash burn before profitability</span></div> <div class="form-group"><label for="breakEven">Break-even Timeline Tolerance</label> `);
    $$renderer2.select({ value: riskTolerance.breakEvenTimeframe, id: "breakEven" }, ($$renderer3) => {
      $$renderer3.option({ value: "12mo" }, ($$renderer4) => {
        $$renderer4.push(`12 months`);
      });
      $$renderer3.option({ value: "18mo" }, ($$renderer4) => {
        $$renderer4.push(`18 months`);
      });
      $$renderer3.option({ value: "24mo" }, ($$renderer4) => {
        $$renderer4.push(`24 months`);
      });
      $$renderer3.option({ value: "36mo" }, ($$renderer4) => {
        $$renderer4.push(`36 months`);
      });
    });
    $$renderer2.push(` <span class="input-helper">How long until you expect to reach break-even</span></div></div></div></section>`);
    bind_props($$props, { riskTolerance });
  });
}
function AlignmentWeights($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { weights = void 0, onbalance, onreset, onsave } = $$props;
    $$renderer2.push(`<section class="section weight-section"><div class="section-context-paragraph">These weights determine how the algorithm scores locations for YOUR specific business. A coffee shop needs foot traffic above all else. A destination restaurant cares more about transit access and reputation. Adjust these to match what matters most to you.</div> <div class="section-header"><div><h2>Alignment Engine Weights</h2> <p class="weight-subtitle svelte-mxtm7x">Adjust how much each factor matters for YOUR specific business</p></div> <button class="btn-reset svelte-mxtm7x">Reset to Default</button></div> <div class="section-content"><div class="sliders-grid svelte-mxtm7x"><!--[-->`);
    const each_array = ensure_array_like([
      {
        key: "l0_macro",
        label: "L0 Macro Climate",
        desc: "Economic climate & market trends",
        max: 100
      },
      {
        key: "l1_city",
        label: "L1 City Dynamics",
        desc: "Urban development & growth",
        max: 100
      },
      {
        key: "l2_block",
        label: "L2 Block Intelligence",
        desc: "Local foot traffic & density",
        max: 100
      },
      {
        key: "l3_planfit",
        label: "L3 Business Plan Fit",
        desc: "Alignment with your plan",
        max: 100
      },
      {
        key: "l4_talent",
        label: "L4 Talent Accessibility",
        desc: "Quality staff availability",
        max: 100
      },
      {
        key: "l5_resilience",
        label: "L5 Resilience & Wildcards",
        desc: "Risk mitigation factors",
        max: 100
      },
      {
        key: "l6_zoning",
        label: "L6 Zoning & Physical Risk",
        desc: "Regulatory & environmental risks",
        max: 100
      },
      {
        key: "l7_feel",
        label: "L7 Location Feel",
        desc: "Your gut feeling about this location",
        max: 25
      }
    ]);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      $$renderer2.push(`<div class="slider-item svelte-mxtm7x"><div class="slider-label svelte-mxtm7x">${escape_html(item.label)}</div> <div class="slider-value svelte-mxtm7x">${escape_html(weights[item.key])}%</div> <input type="range" min="0"${attr("max", item.max)}${attr("value", weights[item.key])} class="slider svelte-mxtm7x"/> <div class="slider-desc svelte-mxtm7x">${escape_html(item.desc)}</div></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="weight-bar-container svelte-mxtm7x"><div class="weight-bar-bg svelte-mxtm7x"><div class="weight-segment svelte-mxtm7x"${attr_style(`width: ${stringify(weights.l0_macro)}%; background-color: #e74c3c;`)} title="L0"></div> <div class="weight-segment svelte-mxtm7x"${attr_style(`width: ${stringify(weights.l1_city)}%; background-color: #e67e22;`)} title="L1"></div> <div class="weight-segment svelte-mxtm7x"${attr_style(`width: ${stringify(weights.l2_block)}%; background-color: #f39c12;`)} title="L2"></div> <div class="weight-segment svelte-mxtm7x"${attr_style(`width: ${stringify(weights.l3_planfit)}%; background-color: #27ae60;`)} title="L3"></div> <div class="weight-segment svelte-mxtm7x"${attr_style(`width: ${stringify(weights.l4_talent)}%; background-color: #2980b9;`)} title="L4"></div> <div class="weight-segment svelte-mxtm7x"${attr_style(`width: ${stringify(weights.l5_resilience)}%; background-color: #8e44ad;`)} title="L5"></div> <div class="weight-segment svelte-mxtm7x"${attr_style(`width: ${stringify(weights.l6_zoning)}%; background-color: #c0392b;`)} title="L6"></div> <div class="weight-segment svelte-mxtm7x"${attr_style(`width: ${stringify(weights.l7_feel)}%; background-color: #d35400;`)} title="L7"></div></div> <div class="weight-labels svelte-mxtm7x"><span>L0</span><span>L1</span><span>L2</span><span>L3</span> <span>L4</span><span>L5</span><span>L6</span><span>L7</span></div></div></div></section>`);
    bind_props($$props, { weights });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let saveStatus = "";
    function triggerSave() {
      saveStatus = "Saving...";
      saveLaunchPadData({
        founderProfile,
        creditProfile,
        businessType,
        businessName,
        businessFormat,
        visionStatement,
        differentiator,
        financialGoals: {
          ...financialGoals,
          liquidCapital,
          monthlyPersonalExpenses,
          externalFunding
        },
        weights,
        idealArea,
        sacred,
        flexible,
        preferredNeighborhoods: locationPreferences.preferredNeighborhoods
      });
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
    function autoSave() {
      return;
    }
    let businessType = "";
    let businessName = "";
    let visionStatement = "";
    let differentiator = "";
    let communityImpact = "Serve underserved communities";
    let brandPositioning = "Premium wellness positioning";
    let teamEmployment = "Create 15+ jobs within 3 years";
    let founderProfile = {
      motivation: "",
      ownerType: "",
      riskTolerance: "",
      experience: "",
      yearOneGoals: {
        revenueTarget: 95e4,
        personalIncomeTarget: 8e4,
        employeeCount: 5,
        locationCount: 1
      }
    };
    let creditProfile = {
      scoreRange: "",
      bankruptcy: false,
      latePayments: false,
      collections: false,
      existingDebt: "na"
    };
    let businessFormat = "cafe";
    let liquidCapital = 8e4;
    let monthlyPersonalExpenses = 5e3;
    let externalFunding = 0;
    let founderProfileComplete = derived(() => founderProfile.motivation !== "" && founderProfile.ownerType !== "" && founderProfile.riskTolerance !== "" && founderProfile.experience !== "");
    let financialGoals = {
      targetSDE: 25e4,
      revenueY1: 95e4,
      revenueY3: 16e5,
      dailyTransactions: 500,
      avgTicket: 8.75,
      numberOfLocations: 1,
      startupCapital: 15e4,
      personalInvestment: 5e4,
      emergencyReserveMonths: 6,
      monthlyRentBudget: 15e3,
      buildoutBudget: 5e4,
      teamSize: 5,
      squareFootage: 1200
    };
    let sacred = { brand: true, coreProduct: true };
    let flexible = { pricing: true, hours: true, format: true };
    const businessTypes = CONCEPT_REGISTRY.map((c) => c.label);
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
    const balanceWeights = (changedKey, newValue) => {
      weights[changedKey] = Math.max(0, Math.min(newValue, 100));
      const min = changedKey === "l7_feel" ? 0 : 5;
      const max = changedKey === "l7_feel" ? 25 : 100;
      weights[changedKey] = Math.max(min, Math.min(newValue, max));
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      if (total !== 100) {
        const scaleFactor = (100 - weights[changedKey]) / (total - weights[changedKey]);
        for (const key in weights) {
          if (key !== changedKey) {
            weights[key] = Math.round(weights[key] * scaleFactor);
          }
        }
        const newTotal = Object.values(weights).reduce((a, b) => a + b, 0);
        if (newTotal !== 100) {
          const diff = 100 - newTotal;
          const keysToAdjust = Object.keys(weights).filter((k) => k !== changedKey);
          if (keysToAdjust.length > 0) {
            const adjustKey = keysToAdjust[0];
            weights[adjustKey] += diff;
          }
        }
      }
    };
    const resetWeights = () => {
      weights = getDefaultWeights(businessType);
    };
    let spaceType = "Standard Cafe (800-1500 sqft)";
    let sqftMin = 1e3;
    let sqftMax = 1500;
    let monthlyRentBudget = 15e3;
    let neighborhoodCharacteristics = {
      highFootTraffic: true,
      residentialDensity: false,
      officeCommercial: false,
      fitnessWellness: true,
      familyFriendly: true,
      nightlifeEntertainment: false,
      trendyEmerging: false,
      establishedStable: false
    };
    let idealArea = "Chelsea";
    let visibilityPreferences = {
      groundFloor: true,
      cornerLocation: false,
      nearSubway: false,
      outdoorSeating: false
    };
    let locationPreferences = {
      numberOfTargetLocations: 1,
      preferredNeighborhoods: "Chelsea, Flatiron",
      maxCommuteTime: 30,
      minFootTrafficThreshold: 5e3
    };
    let competitiveStrategy = {
      differentiators: {
        uniqueProduct: true,
        priceLeader: false,
        premiumExperience: true,
        healthWellness: true,
        technologyDriven: false,
        communityHub: true
      },
      targetSegments: {
        officeWorkers: true,
        families: false,
        students: false,
        healthEnthusiasts: true,
        remoteWorkers: true,
        tourists: false
      }
    };
    let riskTolerance = {
      riskLevel: 50,
      maxMonthlyBurn: 15e3,
      breakEvenTimeframe: "18mo"
    };
    const neighborhoodAreasList = [
      "Chelsea",
      "Flatiron",
      "SoHo",
      "West Village",
      "East Village",
      "Tribeca",
      "NoHo / Nolita",
      "Midtown",
      "UWS / UES",
      "Gramercy / Murray Hill",
      "LES / Chinatown",
      "Williamsburg",
      "DUMBO / Cobble Hill",
      "Park Slope",
      "Other"
    ];
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("10zkrpg", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>RE² — Launch Pad</title>`);
        });
      });
      $$renderer3.push(`<div class="page svelte-10zkrpg"><div class="page-header svelte-10zkrpg"><h1 class="svelte-10zkrpg">LAUNCH PAD</h1> <p class="subtitle svelte-10zkrpg">Define your business, set goals, and configure the alignment engine</p></div> `);
      if (saveStatus) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="save-indicator svelte-10zkrpg">${escape_html(saveStatus)}</div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <div class="quick-start-guide svelte-10zkrpg"><h3 class="svelte-10zkrpg">QUICK START GUIDE</h3> <div class="quick-start-steps svelte-10zkrpg"><a href="/app/vision/founder" class="quick-step svelte-10zkrpg"><span class="step-number svelte-10zkrpg">1</span> <span class="step-text">Review your vision below</span></a> <div class="step-arrow svelte-10zkrpg">→</div> <a href="/app/location" class="quick-step svelte-10zkrpg"><span class="step-number svelte-10zkrpg">2</span> <span class="step-text">Check your Score for insights</span></a> <div class="step-arrow svelte-10zkrpg">→</div> <a href="/app/recommendations" class="quick-step svelte-10zkrpg"><span class="step-number svelte-10zkrpg">3</span> <span class="step-text">See Recommendations for action items</span></a></div></div> <div class="content svelte-10zkrpg">`);
      FounderProfile($$renderer3, {
        founderProfileComplete: founderProfileComplete(),
        onchange: autoSave,
        get founderProfile() {
          return founderProfile;
        },
        set founderProfile($$value) {
          founderProfile = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      CreditProfile($$renderer3, {
        onchange: autoSave,
        get creditProfile() {
          return creditProfile;
        },
        set creditProfile($$value) {
          creditProfile = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> <section class="section svelte-10zkrpg"><div class="section-context-paragraph svelte-10zkrpg">Your business identity is the foundation of everything. The type of business you're building determines which neighborhoods, rent levels, and customer demographics are right for you. Be specific — vague visions produce vague recommendations.</div> <div class="section-header svelte-10zkrpg"><h2 class="svelte-10zkrpg">Business Identity</h2></div> <div class="section-content svelte-10zkrpg"><div class="grid grid-2col svelte-10zkrpg"><div class="col svelte-10zkrpg"><div class="form-group svelte-10zkrpg"><label for="businessType" class="svelte-10zkrpg">Business Type</label> `);
      $$renderer3.select(
        {
          value: businessType,
          id: "businessType",
          oninput: triggerSave,
          class: ""
        },
        ($$renderer4) => {
          $$renderer4.push(`<!--[-->`);
          const each_array = ensure_array_like(businessTypes);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let type = each_array[$$index];
            $$renderer4.option({ value: type }, ($$renderer5) => {
              $$renderer5.push(`${escape_html(type)}`);
            });
          }
          $$renderer4.push(`<!--]-->`);
        },
        "svelte-10zkrpg"
      );
      $$renderer3.push(`</div> <div class="form-group svelte-10zkrpg"><label for="businessName" class="svelte-10zkrpg">Business Name</label> <input type="text" id="businessName"${attr("value", businessName)} placeholder="Your business name" class="svelte-10zkrpg"/></div> <div class="form-group svelte-10zkrpg"><label for="vision" class="svelte-10zkrpg">Vision Statement</label> <textarea id="vision" rows="3" placeholder="Describe your vision..." class="svelte-10zkrpg">`);
      const $$body = escape_html(visionStatement);
      if ($$body) {
        $$renderer3.push(`${$$body}`);
      }
      $$renderer3.push(`</textarea></div></div> <div class="col svelte-10zkrpg"><div class="form-group svelte-10zkrpg"><label for="differentiator" class="svelte-10zkrpg">Differentiator</label> <textarea id="differentiator" rows="3" placeholder="What makes you unique..." class="svelte-10zkrpg">`);
      const $$body_1 = escape_html(differentiator);
      if ($$body_1) {
        $$renderer3.push(`${$$body_1}`);
      }
      $$renderer3.push(`</textarea></div> <div class="form-group svelte-10zkrpg"><div class="label-with-helper svelte-10zkrpg"><label class="svelte-10zkrpg">Sacred vs Flexible</label> <div class="helper-text svelte-10zkrpg"><span class="helper-item svelte-10zkrpg"><strong>Sacred:</strong> Algorithm will NEVER suggest changing</span> <span class="helper-divider svelte-10zkrpg">·</span> <span class="helper-item svelte-10zkrpg"><strong>Flexible:</strong> Algorithm MAY suggest adjustments to improve odds</span></div></div> <div class="toggles-row svelte-10zkrpg"><div${attr_class("chip svelte-10zkrpg", void 0, { "active": sacred.brand })} title="Sacred: Algorithm will NEVER suggest changing this"><input type="checkbox" id="sacred-brand"${attr("checked", sacred.brand, true)} class="svelte-10zkrpg"/> <label for="sacred-brand" class="svelte-10zkrpg">Brand</label></div> <div${attr_class("chip svelte-10zkrpg", void 0, { "active": sacred.coreProduct })} title="Sacred: Algorithm will NEVER suggest changing this"><input type="checkbox" id="sacred-core"${attr("checked", sacred.coreProduct, true)} class="svelte-10zkrpg"/> <label for="sacred-core" class="svelte-10zkrpg">Core Product</label></div> <div${attr_class("chip svelte-10zkrpg", void 0, { "active": flexible.pricing })} title="Flexible: Algorithm MAY suggest adjustments to improve your odds"><input type="checkbox" id="flex-pricing"${attr("checked", flexible.pricing, true)} class="svelte-10zkrpg"/> <label for="flex-pricing" class="svelte-10zkrpg">Pricing</label></div> <div${attr_class("chip svelte-10zkrpg", void 0, { "active": flexible.hours })} title="Flexible: Algorithm MAY suggest adjustments to improve your odds"><input type="checkbox" id="flex-hours"${attr("checked", flexible.hours, true)} class="svelte-10zkrpg"/> <label for="flex-hours" class="svelte-10zkrpg">Hours</label></div> <div${attr_class("chip svelte-10zkrpg", void 0, { "active": flexible.format })} title="Flexible: Algorithm MAY suggest adjustments to improve your odds"><input type="checkbox" id="flex-format"${attr("checked", flexible.format, true)} class="svelte-10zkrpg"/> <label for="flex-format" class="svelte-10zkrpg">Format</label></div></div></div></div></div></div></section> <section class="section svelte-10zkrpg"><div class="section-context-paragraph svelte-10zkrpg">These numbers drive the entire feasibility analysis. Your take-home target determines how much revenue you need, which determines the location's foot traffic requirements. Be realistic — optimistic projections lead to bad lease decisions.</div> <div class="section-header svelte-10zkrpg"><h2 class="svelte-10zkrpg">Financial Goals</h2></div> <div class="section-content svelte-10zkrpg"><div class="subsection svelte-10zkrpg"><h3 class="subsection-title svelte-10zkrpg">Revenue &amp; Profitability Targets</h3> <div class="grid grid-3col svelte-10zkrpg"><div class="form-group svelte-10zkrpg"><label for="sde" class="svelte-10zkrpg">Owner's Take-Home (Year 1)</label> <input type="number" id="sde"${attr("value", financialGoals.targetSDE)} placeholder="250000" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Your target seller discretionary earnings</span></div> <div class="form-group svelte-10zkrpg"><label for="y1rev" class="svelte-10zkrpg">Revenue Year 1</label> <input type="number" id="y1rev"${attr("value", financialGoals.revenueY1)} placeholder="950000" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">First-year total revenue target</span></div> <div class="form-group svelte-10zkrpg"><label for="y3rev" class="svelte-10zkrpg">Revenue Year 3</label> <input type="number" id="y3rev"${attr("value", financialGoals.revenueY3)} placeholder="1600000" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Three-year revenue projection</span></div></div></div> <div class="subsection svelte-10zkrpg"><h3 class="subsection-title svelte-10zkrpg">Transaction Targets</h3> <div class="grid grid-2col svelte-10zkrpg"><div class="form-group svelte-10zkrpg"><label for="dtx" class="svelte-10zkrpg">Daily Transactions</label> <input type="number" id="dtx"${attr("value", financialGoals.dailyTransactions)} placeholder="500" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Drives foot traffic requirements and location scoring</span></div> <div class="form-group svelte-10zkrpg"><label for="avgticket" class="svelte-10zkrpg">Average Ticket Size</label> <input type="number" id="avgticket"${attr("value", financialGoals.avgTicket)} placeholder="8.75" step="0.01" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Your average transaction value</span></div></div></div> <div class="subsection svelte-10zkrpg"><h3 class="subsection-title svelte-10zkrpg">Expansion &amp; Space Planning</h3> <div class="grid grid-3col svelte-10zkrpg"><div class="form-group svelte-10zkrpg"><label for="locations" class="svelte-10zkrpg">Number of Target Locations</label> <input type="number" id="locations"${attr("value", financialGoals.numberOfLocations)} placeholder="1" min="1" max="10" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Planning for multiple locations enables expansion sequencing</span></div> <div class="form-group svelte-10zkrpg"><label for="sqft" class="svelte-10zkrpg">Square Footage</label> <input type="number" id="sqft"${attr("value", financialGoals.squareFootage)} placeholder="1200" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Target space size in square feet</span></div> <div class="form-group svelte-10zkrpg"><label for="teamSize" class="svelte-10zkrpg">Target Team Size</label> <input type="number" id="teamSize"${attr("value", financialGoals.teamSize)} placeholder="5" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">FTEs needed for first location</span></div></div></div> <div class="subsection svelte-10zkrpg"><h3 class="subsection-title svelte-10zkrpg">Investment &amp; Capital</h3> <div class="grid grid-3col svelte-10zkrpg"><div class="form-group svelte-10zkrpg"><label for="startupCapital" class="svelte-10zkrpg">Total Startup Capital Available</label> <input type="number" id="startupCapital"${attr("value", financialGoals.startupCapital)} placeholder="150000" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Total capital you can deploy</span></div> <div class="form-group svelte-10zkrpg"><label for="personalInvestment" class="svelte-10zkrpg">Personal Investment Amount</label> <input type="number" id="personalInvestment"${attr("value", financialGoals.personalInvestment)} placeholder="50000" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Your personal equity in the deal</span></div> <div class="form-group svelte-10zkrpg"><label for="emergencyReserve" class="svelte-10zkrpg">Emergency Reserve (months)</label> <input type="number" id="emergencyReserve"${attr("value", financialGoals.emergencyReserveMonths)} placeholder="6" min="3" max="24" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Months of operating expenses to reserve</span></div></div></div> <div class="subsection svelte-10zkrpg"><h3 class="subsection-title svelte-10zkrpg">Space &amp; Rent Budget</h3> <div class="grid grid-2col svelte-10zkrpg"><div class="form-group svelte-10zkrpg"><label for="rentBudget2" class="svelte-10zkrpg">Monthly Rent Budget</label> <input type="number" id="rentBudget2"${attr("value", financialGoals.monthlyRentBudget)} placeholder="15000" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Maximum acceptable monthly rent</span></div> <div class="form-group svelte-10zkrpg"><label for="buildout" class="svelte-10zkrpg">Buildout Budget</label> <input type="number" id="buildout"${attr("value", financialGoals.buildoutBudget)} placeholder="50000" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Budget for tenant improvements</span></div></div></div></div></section> <section class="section svelte-10zkrpg"><div class="section-context-paragraph svelte-10zkrpg">Non-financial goals shape which neighborhoods align with your vision beyond just economics. A community-focused cafe needs different things than a grab-and-go kiosk.</div> <div class="section-header svelte-10zkrpg"><h2 class="svelte-10zkrpg">Non-Financial Goals</h2></div> <div class="section-content svelte-10zkrpg"><div class="grid grid-2col svelte-10zkrpg"><div class="form-group svelte-10zkrpg"><label for="community" class="svelte-10zkrpg">Community Impact</label> <input type="text" id="community"${attr("value", communityImpact)} placeholder="Community impact goal..." class="svelte-10zkrpg"/></div> <div class="form-group svelte-10zkrpg"><label for="branding" class="svelte-10zkrpg">Brand Positioning</label> <input type="text" id="branding"${attr("value", brandPositioning)} placeholder="Brand positioning..." class="svelte-10zkrpg"/></div> <div class="form-group svelte-10zkrpg"><label for="team" class="svelte-10zkrpg">Team / Employment</label> <input type="text" id="team"${attr("value", teamEmployment)} placeholder="Employment goals..." class="svelte-10zkrpg"/></div></div></div></section> `);
      AlignmentWeights($$renderer3, {
        onbalance: balanceWeights,
        onreset: resetWeights,
        onsave: triggerSave,
        get weights() {
          return weights;
        },
        set weights($$value) {
          weights = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> <section class="section svelte-10zkrpg"><div class="section-context-paragraph svelte-10zkrpg">The physical space you need directly impacts your rent budget, buildout cost, and which neighborhoods have suitable inventory. A 200 sqft kiosk is available everywhere. A 3000 sqft flagship limits you to specific blocks.</div> <div class="section-header svelte-10zkrpg"><h2 class="svelte-10zkrpg">Your Ideal Space</h2></div> <div class="section-content svelte-10zkrpg"><div class="form-group svelte-10zkrpg" style="margin-bottom: 1.5rem;"><label style="margin-bottom: 0.6rem;" class="svelte-10zkrpg">Space Type</label> <div class="radio-group svelte-10zkrpg"><div class="radio-item svelte-10zkrpg"><input type="radio" id="space-kiosk" value="Kiosk / Counter-only (50-200 sqft)"${attr("checked", spaceType === "Kiosk / Counter-only (50-200 sqft)", true)} name="spaceType" class="svelte-10zkrpg"/> <label for="space-kiosk" class="svelte-10zkrpg"><strong class="svelte-10zkrpg">Kiosk / Counter-only (50-200 sqft)</strong> <span class="radio-desc svelte-10zkrpg">Test the concept with minimal investment</span></label></div> <div class="radio-item svelte-10zkrpg"><input type="radio" id="space-compact" value="Compact Cafe (200-400 sqft)"${attr("checked", spaceType === "Compact Cafe (200-400 sqft)", true)} name="spaceType" class="svelte-10zkrpg"/> <label for="space-compact" class="svelte-10zkrpg"><strong class="svelte-10zkrpg">Compact Cafe (200-400 sqft)</strong> <span class="radio-desc svelte-10zkrpg">Counter-service with limited seating</span></label></div> <div class="radio-item svelte-10zkrpg"><input type="radio" id="space-small" value="Small Cafe (400-800 sqft)"${attr("checked", spaceType === "Small Cafe (400-800 sqft)", true)} name="spaceType" class="svelte-10zkrpg"/> <label for="space-small" class="svelte-10zkrpg"><strong class="svelte-10zkrpg">Small Cafe (400-800 sqft)</strong> <span class="radio-desc svelte-10zkrpg">Focused menu, grab-and-go emphasis</span></label></div> <div class="radio-item svelte-10zkrpg"><input type="radio" id="space-standard" value="Standard Cafe (800-1500 sqft)"${attr("checked", spaceType === "Standard Cafe (800-1500 sqft)", true)} name="spaceType" checked="" class="svelte-10zkrpg"/> <label for="space-standard" class="svelte-10zkrpg"><strong class="svelte-10zkrpg">Standard Cafe (800-1500 sqft)</strong> <span class="radio-desc svelte-10zkrpg">Full menu with limited seating</span></label></div> <div class="radio-item svelte-10zkrpg"><input type="radio" id="space-large" value="Large Cafe + Community (1500-3000 sqft)"${attr("checked", spaceType === "Large Cafe + Community (1500-3000 sqft)", true)} name="spaceType" class="svelte-10zkrpg"/> <label for="space-large" class="svelte-10zkrpg"><strong class="svelte-10zkrpg">Large Cafe + Community (1500-3000 sqft)</strong> <span class="radio-desc svelte-10zkrpg">Full menu, seating, community events space</span></label></div> <div class="radio-item svelte-10zkrpg"><input type="radio" id="space-flagship" value="Flagship (3000+ sqft)"${attr("checked", spaceType === "Flagship (3000+ sqft)", true)} name="spaceType" class="svelte-10zkrpg"/> <label for="space-flagship" class="svelte-10zkrpg"><strong class="svelte-10zkrpg">Flagship (3000+ sqft)</strong> <span class="radio-desc svelte-10zkrpg">Full experience: cafe, events, co-working, retail</span></label></div></div></div> <div class="grid grid-2col svelte-10zkrpg" style="margin-bottom: 1.5rem;"><div class="form-group svelte-10zkrpg"><label for="sqftMin" class="svelte-10zkrpg">Square Footage Range — Min</label> <input type="number" id="sqftMin"${attr("value", sqftMin)} placeholder="1000" class="svelte-10zkrpg"/></div> <div class="form-group svelte-10zkrpg"><label for="sqftMax" class="svelte-10zkrpg">Square Footage Range — Max</label> <input type="number" id="sqftMax"${attr("value", sqftMax)} placeholder="1500" class="svelte-10zkrpg"/></div></div> <div class="form-group svelte-10zkrpg" style="margin-bottom: 1.5rem;"><label for="rentBudget" class="svelte-10zkrpg">Monthly Rent Budget</label> <input type="number" id="rentBudget"${attr("value", monthlyRentBudget)} placeholder="15000" class="svelte-10zkrpg"/></div> <div class="form-group svelte-10zkrpg" style="margin-bottom: 1.5rem;"><label style="margin-bottom: 0.6rem;" class="svelte-10zkrpg">Ideal Neighborhood Characteristics (select all that apply)</label> <div class="checkbox-grid svelte-10zkrpg"><div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="char-traffic"${attr("checked", neighborhoodCharacteristics.highFootTraffic, true)} class="svelte-10zkrpg"/> <label for="char-traffic" class="svelte-10zkrpg">High foot traffic (transit hub, busy street)</label></div> <div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="char-residential"${attr("checked", neighborhoodCharacteristics.residentialDensity, true)} class="svelte-10zkrpg"/> <label for="char-residential" class="svelte-10zkrpg">Residential density (apartment buildings, families)</label></div> <div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="char-office"${attr("checked", neighborhoodCharacteristics.officeCommercial, true)} class="svelte-10zkrpg"/> <label for="char-office" class="svelte-10zkrpg">Office/commercial (weekday workers, lunch crowd)</label></div> <div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="char-fitness"${attr("checked", neighborhoodCharacteristics.fitnessWellness, true)} class="svelte-10zkrpg"/> <label for="char-fitness" class="svelte-10zkrpg">Fitness/wellness ecosystem (gyms, yoga, health food)</label></div> <div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="char-family"${attr("checked", neighborhoodCharacteristics.familyFriendly, true)} class="svelte-10zkrpg"/> <label for="char-family" class="svelte-10zkrpg">Family-friendly (schools, parks, playgrounds)</label></div> <div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="char-nightlife"${attr("checked", neighborhoodCharacteristics.nightlifeEntertainment, true)} class="svelte-10zkrpg"/> <label for="char-nightlife" class="svelte-10zkrpg">Nightlife/entertainment (bars, restaurants, evening traffic)</label></div> <div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="char-trendy"${attr("checked", neighborhoodCharacteristics.trendyEmerging, true)} class="svelte-10zkrpg"/> <label for="char-trendy" class="svelte-10zkrpg">Trendy/emerging (new businesses, rising neighborhood)</label></div> <div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="char-established"${attr("checked", neighborhoodCharacteristics.establishedStable, true)} class="svelte-10zkrpg"/> <label for="char-established" class="svelte-10zkrpg">Established/stable (mature businesses, loyal residents)</label></div></div></div> <div class="form-group svelte-10zkrpg" style="margin-bottom: 1.5rem;"><label for="idealArea" class="svelte-10zkrpg">Ideal General Area</label> `);
      $$renderer3.select(
        { value: idealArea, id: "idealArea", class: "" },
        ($$renderer4) => {
          $$renderer4.push(`<!--[-->`);
          const each_array_1 = ensure_array_like(neighborhoodAreasList);
          for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
            let area = each_array_1[$$index_1];
            $$renderer4.option({ value: area }, ($$renderer5) => {
              $$renderer5.push(`${escape_html(area)}`);
            });
          }
          $$renderer4.push(`<!--]-->`);
        },
        "svelte-10zkrpg"
      );
      $$renderer3.push(`</div> <div class="form-group svelte-10zkrpg"><label style="margin-bottom: 0.6rem;" class="svelte-10zkrpg">Visibility Preferences</label> <div class="checkbox-grid svelte-10zkrpg"><div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="vis-ground"${attr("checked", visibilityPreferences.groundFloor, true)} class="svelte-10zkrpg"/> <label for="vis-ground" class="svelte-10zkrpg">Ground floor (street-level)</label></div> <div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="vis-corner"${attr("checked", visibilityPreferences.cornerLocation, true)} class="svelte-10zkrpg"/> <label for="vis-corner" class="svelte-10zkrpg">Corner location</label></div> <div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="vis-subway"${attr("checked", visibilityPreferences.nearSubway, true)} class="svelte-10zkrpg"/> <label for="vis-subway" class="svelte-10zkrpg">Near subway entrance</label></div> <div class="checkbox-item svelte-10zkrpg"><input type="checkbox" id="vis-outdoor"${attr("checked", visibilityPreferences.outdoorSeating, true)} class="svelte-10zkrpg"/> <label for="vis-outdoor" class="svelte-10zkrpg">Outdoor seating potential</label></div></div></div></div></section> <section class="section svelte-10zkrpg"><div class="section-context-paragraph svelte-10zkrpg">Define your expansion and location search strategy. Multi-location planning unlocks different site profiles and economies of scale than single-site searches.</div> <div class="section-header svelte-10zkrpg"><h2 class="svelte-10zkrpg">Location Preferences</h2></div> <div class="section-content svelte-10zkrpg"><div class="grid grid-2col svelte-10zkrpg"><div class="form-group svelte-10zkrpg"><label for="numLocations" class="svelte-10zkrpg">Number of Target Locations (Expansion Plan)</label> <input type="number" id="numLocations"${attr("value", locationPreferences.numberOfTargetLocations)} placeholder="1" min="1" max="10" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Planning for multiple locations enables our model to recommend expansion sequencing</span></div> <div class="form-group svelte-10zkrpg"><label for="maxCommute" class="svelte-10zkrpg">Max Commute Time (minutes)</label> <input type="number" id="maxCommute"${attr("value", locationPreferences.maxCommuteTime)} placeholder="30" min="5" max="120" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Maximum acceptable commute from your base</span></div></div> <div class="grid grid-2col svelte-10zkrpg"><div class="form-group svelte-10zkrpg"><label for="neighborhoods" class="svelte-10zkrpg">Preferred Neighborhoods (comma-separated)</label> <input type="text" id="neighborhoods"${attr("value", locationPreferences.preferredNeighborhoods)} placeholder="Chelsea, Flatiron, West Village" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Focus your search geographically</span></div> <div class="form-group svelte-10zkrpg"><label for="footTraffic" class="svelte-10zkrpg">Minimum Foot Traffic Threshold (daily)</label> <input type="number" id="footTraffic"${attr("value", locationPreferences.minFootTrafficThreshold)} placeholder="5000" min="1000" step="500" class="svelte-10zkrpg"/> <span class="input-helper svelte-10zkrpg">Minimum daily pedestrian traffic to qualify</span></div></div></div></section> `);
      CompetitiveStrategy($$renderer3, {
        get competitiveStrategy() {
          return competitiveStrategy;
        },
        set competitiveStrategy($$value) {
          competitiveStrategy = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      RiskTolerance($$renderer3, {
        get riskTolerance() {
          return riskTolerance;
        },
        set riskTolerance($$value) {
          riskTolerance = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> <div class="info-box svelte-10zkrpg"><div class="info-icon svelte-10zkrpg">📊</div> <div class="info-content svelte-10zkrpg"><h3 class="svelte-10zkrpg">How This Feeds Your Analysis</h3> <p class="svelte-10zkrpg">Your Launch Pad inputs drive three core outputs:</p> <ul class="info-list svelte-10zkrpg"><li class="svelte-10zkrpg"><strong>Recommendations:</strong> Based on your financial targets, risk tolerance, and differentiators, we suggest neighborhoods and specific locations that align with your business model.</li> <li class="svelte-10zkrpg"><strong>Financials:</strong> Your revenue, transaction, and expense targets are modeled against typical location-based unit economics to validate feasibility.</li> <li class="svelte-10zkrpg"><strong>Loan Readiness:</strong> Your startup capital, personal investment, and break-even timeline inform SBA lending strategy and debt capacity recommendations.</li></ul> <p style="margin-top: 1rem; font-size: 14px; color: #a1a1a6;" class="svelte-10zkrpg">Change any value above and re-run the analysis to see how sensitive your location recommendations are to your assumptions.</p></div></div></div></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
export {
  _page as default
};
