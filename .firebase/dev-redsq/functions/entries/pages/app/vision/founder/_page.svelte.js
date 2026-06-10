import { c as attr_class, e as escape_html, i as stringify, h as head, j as ensure_array_like, b as attr, d as derived } from "../../../../../chunks/index2.js";
function Badge($$renderer, $$props) {
  let { variant = "info", text = "", small = false } = $$props;
  $$renderer.push(`<span${attr_class(`badge ${stringify(variant)}`, "svelte-dtbgkf", { "small": small })}>${escape_html(text)}</span>`);
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let founderProfile = {
      motivation: "",
      ownerType: "",
      riskTolerance: "",
      experience: ""
    };
    let creditProfile = {
      scoreRange: "",
      bankruptcy: false,
      latePayments: false,
      collections: false,
      existingDebt: "na"
    };
    let founderProfileComplete = derived(() => founderProfile.motivation !== "");
    head("bui6tx", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Profile</title>`);
      });
    });
    $$renderer2.push(`<div class="page svelte-bui6tx"><div class="page-header svelte-bui6tx"><h1 class="svelte-bui6tx">Tell us about you</h1> <p class="subtitle svelte-bui6tx">Just the essentials — everything here feeds directly into your score and recommendations. Takes about 2 minutes.</p></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="content svelte-bui6tx"><section class="section svelte-bui6tx"><div class="section-context-paragraph svelte-bui6tx">Your answers here feed directly into your score, financial projections, and lender matching.</div> <div class="section-header svelte-bui6tx"><h2 class="svelte-bui6tx">Founder Profile</h2> `);
    if (founderProfileComplete()) {
      $$renderer2.push("<!--[0-->");
      Badge($$renderer2, { variant: "success", text: "Complete" });
    } else {
      $$renderer2.push("<!--[-1-->");
      Badge($$renderer2, { variant: "warning", text: "Required" });
    }
    $$renderer2.push(`<!--]--></div> <div class="section-content svelte-bui6tx"><div class="profile-question svelte-bui6tx"><h3 class="profile-q-label svelte-bui6tx">What do you want from this business?</h3> <div class="card-options svelte-bui6tx"><!--[-->`);
    const each_array = ensure_array_like([
      {
        value: "legacy",
        label: "Legacy Builder",
        desc: "Generational wealth and a lasting brand"
      },
      {
        value: "passion",
        label: "Full-Time Career",
        desc: "This is your primary career and calling"
      },
      {
        value: "sideincome",
        label: "Side Income",
        desc: "Keep your day job, build on the side"
      },
      {
        value: "investment",
        label: "Investment Play",
        desc: "Portfolio play — returns matter most"
      }
    ]);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let opt = each_array[$$index];
      $$renderer2.push(`<button${attr_class("profile-card svelte-bui6tx", void 0, { "selected": founderProfile.motivation === opt.value })}><span class="card-title svelte-bui6tx">${escape_html(opt.label)}</span> <span class="card-desc svelte-bui6tx">${escape_html(opt.desc)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="profile-question svelte-bui6tx"><h3 class="profile-q-label svelte-bui6tx">What kind of owner will you be?</h3> <div class="card-options svelte-bui6tx"><!--[-->`);
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
      $$renderer2.push(`<button${attr_class("profile-card svelte-bui6tx", void 0, { "selected": founderProfile.ownerType === opt.value })}><span class="card-title svelte-bui6tx">${escape_html(opt.label)}</span> <span class="card-desc svelte-bui6tx">${escape_html(opt.desc)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="profile-question svelte-bui6tx"><h3 class="profile-q-label svelte-bui6tx">What's your risk tolerance?</h3> <div class="card-options card-options-3 svelte-bui6tx"><!--[-->`);
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
      $$renderer2.push(`<button${attr_class("profile-card svelte-bui6tx", void 0, { "selected": founderProfile.riskTolerance === opt.value })}><span class="card-title svelte-bui6tx">${escape_html(opt.label)}</span> <span class="card-desc svelte-bui6tx">${escape_html(opt.desc)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="profile-question svelte-bui6tx"><h3 class="profile-q-label svelte-bui6tx">Have you operated a business before?</h3> <div class="card-options svelte-bui6tx"><!--[-->`);
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
      $$renderer2.push(`<button${attr_class("profile-card svelte-bui6tx", void 0, { "selected": founderProfile.experience === opt.value })}><span class="card-title svelte-bui6tx">${escape_html(opt.label)}</span> <span class="card-desc svelte-bui6tx">${escape_html(opt.desc)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    if (founderProfileComplete()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="coaching-callout svelte-bui6tx"><div class="coaching-icon svelte-bui6tx">🎯</div> <div class="coaching-text svelte-bui6tx"><strong class="svelte-bui6tx">Profile Impact:</strong> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></section> <section class="section svelte-bui6tx"><div class="section-context-paragraph svelte-bui6tx">This adjusts your lender matching, interest rate estimates, and coaching. We never perform credit checks — this stays in your account.</div> <div class="section-header svelte-bui6tx"><h2 class="svelte-bui6tx">Credit Profile</h2> `);
    Badge($$renderer2, { variant: "info", text: "No Hard Pull" });
    $$renderer2.push(`<!----></div> <div class="section-content svelte-bui6tx"><div class="profile-question svelte-bui6tx"><h3 class="profile-q-label svelte-bui6tx">Select your credit score range</h3> <div class="card-options card-options-5 svelte-bui6tx"><!--[-->`);
    const each_array_4 = ensure_array_like([
      { value: "excellent", label: "750+", desc: "Excellent" },
      { value: "good", label: "700-749", desc: "Good" },
      { value: "fair", label: "650-699", desc: "Fair" },
      { value: "building", label: "Below 650", desc: "Building" },
      { value: "unknown", label: "Not Sure", desc: "I don't know" }
    ]);
    for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
      let opt = each_array_4[$$index_4];
      $$renderer2.push(`<button${attr_class("profile-card profile-card-sm svelte-bui6tx", void 0, { "selected": creditProfile.scoreRange === opt.value })}><span class="card-title svelte-bui6tx">${escape_html(opt.label)}</span> <span class="card-desc svelte-bui6tx">${escape_html(opt.desc)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="credit-flags svelte-bui6tx"><label class="credit-flag svelte-bui6tx"><input type="checkbox"${attr("checked", creditProfile.bankruptcy, true)} class="svelte-bui6tx"/> <span>Any bankruptcies in the last 7 years?</span></label> <label class="credit-flag svelte-bui6tx"><input type="checkbox"${attr("checked", creditProfile.latePayments, true)} class="svelte-bui6tx"/> <span>Any late payments in the last 12 months?</span></label> <label class="credit-flag svelte-bui6tx"><input type="checkbox"${attr("checked", creditProfile.collections, true)} class="svelte-bui6tx"/> <span>Outstanding collections?</span></label> <label class="credit-flag svelte-bui6tx"><input type="checkbox"${attr("checked", creditProfile.existingDebt === "yes", true)} class="svelte-bui6tx"/> <span>Existing business debt?</span></label></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="privacy-notice svelte-bui6tx">RE² never performs credit checks. This information stays in your account and is used only to match you with appropriate lenders and programs.</div></div></section> <div class="nav-footer svelte-bui6tx"><a href="/app/location" class="nav-link svelte-bui6tx">← Your Score</a> <a href="/app/vision/concept" class="nav-link primary svelte-bui6tx">Next: Concept &amp; Goals →</a></div></div></div>`);
  });
}
export {
  _page as default
};
