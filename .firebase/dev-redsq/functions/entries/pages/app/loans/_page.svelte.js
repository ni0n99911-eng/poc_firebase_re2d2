import { c as attr_class, j as ensure_array_like, b as attr, i as stringify, e as escape_html, h as head, d as derived } from "../../../../chunks/index2.js";
import { D as DisclaimerBanner } from "../../../../chunks/DisclaimerBanner.js";
import { P as PageNav } from "../../../../chunks/PageNav.js";
function TabBar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      tabs = [],
      activeTab = "",
      compact = false
    } = $$props;
    $$renderer2.push(`<nav${attr_class("tab-bar svelte-1wwzsr0", void 0, { "compact": compact })} role="tablist"><!--[-->`);
    const each_array = ensure_array_like(tabs);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let tab = each_array[$$index];
      $$renderer2.push(`<button${attr_class("tab-item svelte-1wwzsr0", void 0, { "active": activeTab === tab.id })} role="tab"${attr("aria-selected", activeTab === tab.id)}${attr("aria-controls", `tabpanel-${stringify(tab.id)}`)}>`);
      if (tab.icon) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="tab-icon svelte-1wwzsr0">${escape_html(tab.icon)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <span class="tab-label">${escape_html(tab.label)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></nav>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const loanTabs = [
      { id: "readiness", label: "Loan Readiness" },
      { id: "profile", label: "Your Profile" },
      { id: "lenders", label: "Matched Lenders" },
      { id: "grants", label: "Grants & Programs" },
      { id: "documents", label: "Documents" }
    ];
    let activeTab = "readiness";
    let creditScore = 700;
    let rateAdjustment = 0;
    let expandedSections = {
      readiness: true
    };
    let useOfFunds = {
      leasehold: 12e4,
      equipment: 85e3,
      inventory: 25e3,
      workingCapital: 7e4,
      marketing: 3e4,
      deposits: 2e4
    };
    const preRevenueLendersBase = [
      {
        name: "Huntington Bank",
        programs: "SBA 7(a), SBA Express",
        maxLoan: "$5M",
        baseRate: 8.5,
        features: "No PG required under $100K, fast approval",
        match: "Excellent",
        minCredit: 650
      },
      {
        name: "Live Oak Bank",
        programs: "SBA 7(a), CRE",
        maxLoan: "$5M",
        baseRate: 8.25,
        features: "SBA specialist, expert in F&B lending",
        match: "Excellent",
        minCredit: 650
      },
      {
        name: "Celtic Bank",
        programs: "SBA 7(a), Equipment",
        maxLoan: "$2M",
        baseRate: 9,
        features: "Equipment financing strength",
        match: "Good",
        minCredit: 600
      },
      {
        name: "Pursuit Lending",
        programs: "SBA 7(a)",
        maxLoan: "$350K",
        baseRate: 9.25,
        features: "Minority/women-owned focus",
        match: "Excellent",
        minCredit: 600
      },
      {
        name: "Accion",
        programs: "Microloan, SBA 7(a)",
        maxLoan: "$50K–$350K",
        baseRate: 10.75,
        features: "Technical assistance included",
        match: "Good",
        minCredit: 550
      }
    ];
    const preRevenueLenders = derived(() => {
      return preRevenueLendersBase.filter((lender) => creditScore >= lender.minCredit).map((lender) => ({
        ...lender,
        rate: (lender.baseRate + rateAdjustment).toFixed(2) + "%",
        rateRange: `${(lender.baseRate + rateAdjustment).toFixed(2)}-${(lender.baseRate + rateAdjustment + 2).toFixed(2)}%`
      }));
    });
    Object.values(useOfFunds).reduce((a, b) => a + b, 0);
    const displayLenders = preRevenueLenders();
    const pendingDocuments = derived(() => [
      "Personal financial statement",
      "12 months bank statements",
      "Insurance quotes",
      "Executed lease"
    ].length);
    const strongestLender = derived(() => {
      const excellent = displayLenders.find((l) => l.match === "Excellent");
      return excellent || displayLenders[0] || null;
    });
    head("1jg1nwo", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Loan Readiness</title>`);
      });
    });
    $$renderer2.push(`<div class="container svelte-1jg1nwo">`);
    DisclaimerBanner($$renderer2);
    $$renderer2.push(`<!----> <header class="page-header svelte-1jg1nwo"><h1 class="svelte-1jg1nwo">Loan Readiness</h1> <p class="subtitle svelte-1jg1nwo">SBA 7(a), grants, and funding matched to your profile</p></header> <section class="hero-insight svelte-1jg1nwo"><div class="hero-content svelte-1jg1nwo"><h2 class="hero-headline svelte-1jg1nwo">68% Loan-Ready</h2> <p class="hero-description svelte-1jg1nwo">${escape_html(pendingDocuments())} ${escape_html(pendingDocuments() === 1 ? "document needed" : "documents needed")} to complete your SBA package.</p> `);
    if (strongestLender()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="hero-lender svelte-1jg1nwo"><strong class="svelte-1jg1nwo">Your strongest match:</strong> ${escape_html(strongestLender().name)} at ${escape_html(strongestLender().rate)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></section> `);
    TabBar($$renderer2, {
      tabs: loanTabs,
      activeTab,
      compact: true
    });
    $$renderer2.push(`<!----> <main class="content svelte-1jg1nwo">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="section section-active readiness-section svelte-1jg1nwo"><div class="section-header svelte-1jg1nwo"><div class="header-content svelte-1jg1nwo"><h2 class="svelte-1jg1nwo">Loan Readiness: 68% Complete</h2> <p class="section-subtitle svelte-1jg1nwo">Track your progress toward a complete SBA application</p></div> <div class="progress-indicator svelte-1jg1nwo"><div class="progress-bar svelte-1jg1nwo"><div class="progress-fill svelte-1jg1nwo" style="width: 68%"></div></div> <span class="progress-text svelte-1jg1nwo">68%</span></div></div> <div class="readiness-grid svelte-1jg1nwo"><div class="readiness-item completed svelte-1jg1nwo"><div class="readiness-icon svelte-1jg1nwo"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"></circle><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div> <div class="readiness-content svelte-1jg1nwo"><div class="readiness-label svelte-1jg1nwo">Business plan defined</div> <div class="readiness-meta svelte-1jg1nwo">Founder's Concept</div></div></div> <div class="readiness-item completed svelte-1jg1nwo"><div class="readiness-icon svelte-1jg1nwo"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"></circle><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div> <div class="readiness-content svelte-1jg1nwo"><div class="readiness-label svelte-1jg1nwo">Location analyzed</div> <div class="readiness-meta svelte-1jg1nwo">Location score: ${escape_html("Pending")} based on 19 data sources</div></div></div> <div class="readiness-item completed svelte-1jg1nwo"><div class="readiness-icon svelte-1jg1nwo"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"></circle><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div> <div class="readiness-content svelte-1jg1nwo"><div class="readiness-label svelte-1jg1nwo">Financial projections ready</div> <div class="readiness-meta svelte-1jg1nwo">Financials</div></div></div> <div class="readiness-item completed svelte-1jg1nwo"><div class="readiness-icon svelte-1jg1nwo"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"></circle><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div> <div class="readiness-content svelte-1jg1nwo"><div class="readiness-label svelte-1jg1nwo">Bank matches identified</div> <div class="readiness-meta svelte-1jg1nwo">${escape_html(displayLenders.length)} matched lenders</div></div></div> <button class="readiness-item pending interactive svelte-1jg1nwo"><div class="readiness-icon svelte-1jg1nwo">⬜</div> <div class="readiness-content svelte-1jg1nwo"><div class="readiness-label svelte-1jg1nwo">Personal financial statement</div> <div class="readiness-meta svelte-1jg1nwo">needed for SBA</div></div> <div class="readiness-cta-link svelte-1jg1nwo">Upload →</div></button> <button class="readiness-item pending interactive svelte-1jg1nwo"><div class="readiness-icon svelte-1jg1nwo">⬜</div> <div class="readiness-content svelte-1jg1nwo"><div class="readiness-label svelte-1jg1nwo">12 months bank statements</div> <div class="readiness-meta svelte-1jg1nwo">personal accounts</div></div> <div class="readiness-cta-link svelte-1jg1nwo">Upload →</div></button> <button class="readiness-item pending interactive svelte-1jg1nwo"><div class="readiness-icon svelte-1jg1nwo">⬜</div> <div class="readiness-content svelte-1jg1nwo"><div class="readiness-label svelte-1jg1nwo">Insurance quotes</div> <div class="readiness-meta svelte-1jg1nwo">GL + property coverage</div></div> <div class="readiness-cta-link svelte-1jg1nwo">Upload →</div></button> <button class="readiness-item pending interactive svelte-1jg1nwo"><div class="readiness-icon svelte-1jg1nwo">⬜</div> <div class="readiness-content svelte-1jg1nwo"><div class="readiness-label svelte-1jg1nwo">Executed lease</div> <div class="readiness-meta svelte-1jg1nwo">in negotiation</div></div> <div class="readiness-cta-link svelte-1jg1nwo">Upload →</div></button></div> <div class="readiness-cta svelte-1jg1nwo"><strong class="svelte-1jg1nwo">→ Complete the remaining 4 items to generate your full SBA 7(a) package</strong></div> <div class="collapsible-section svelte-1jg1nwo"><button class="collapsible-header svelte-1jg1nwo"><span class="header-text svelte-1jg1nwo">What Banks Want to See</span> <span${attr_class("expand-icon svelte-1jg1nwo", void 0, { "expanded": expandedSections.readiness })}>▼</span></button> `);
      {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="collapsible-content svelte-1jg1nwo"><div class="banks-intro svelte-1jg1nwo"><p class="svelte-1jg1nwo">Banks want to see that you've done your homework. Your Location Intelligence analysis demonstrates rigorous market research. Here's what makes your application strong:</p></div> <div class="banks-requirements svelte-1jg1nwo"><div class="req-item svelte-1jg1nwo"><div class="req-icon svelte-1jg1nwo"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"></circle><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div> <div class="req-content svelte-1jg1nwo"><div class="req-title svelte-1jg1nwo">Detailed market analysis</div> <div class="req-desc svelte-1jg1nwo">Your location analysis based on 19 data sources including traffic, competition, and demographic fit</div></div></div> <div class="req-item svelte-1jg1nwo"><div class="req-icon svelte-1jg1nwo"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"></circle><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div> <div class="req-content svelte-1jg1nwo"><div class="req-title svelte-1jg1nwo">Realistic financial projections</div> <div class="req-desc svelte-1jg1nwo">Your 3-scenario model (pessimistic/base/optimistic)</div></div></div> <div class="req-item svelte-1jg1nwo"><div class="req-icon svelte-1jg1nwo"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"></circle><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div> <div class="req-content svelte-1jg1nwo"><div class="req-title svelte-1jg1nwo">Industry experience</div> <div class="req-desc svelte-1jg1nwo">Add your background and relevant experience</div></div></div> <div class="req-item svelte-1jg1nwo"><div class="req-icon svelte-1jg1nwo"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"></circle><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg></span></div> <div class="req-content svelte-1jg1nwo"><div class="req-title svelte-1jg1nwo">Equity injection</div> <div class="req-desc svelte-1jg1nwo">How much of your own money are you putting in?</div></div></div> <div class="req-item warning svelte-1jg1nwo"><div class="req-icon svelte-1jg1nwo"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L1.5 13.5h13L8 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path><path d="M8 7v3M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></span></div> <div class="req-content svelte-1jg1nwo"><div class="req-title svelte-1jg1nwo">Collateral</div> <div class="req-desc svelte-1jg1nwo">SBA requires collateral for loans over $350K</div></div></div></div></div>`);
      }
      $$renderer2.push(`<!--]--></div></section>`);
    }
    $$renderer2.push(`<!--]--> `);
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
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></main> `);
    PageNav($$renderer2, {
      backHref: "/app/financials",
      backLabel: "Business Case",
      nextHref: "/app/operations",
      nextLabel: "Operations",
      nextIsGreen: true
    });
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _page as default
};
