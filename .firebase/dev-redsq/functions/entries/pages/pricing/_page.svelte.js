import { h as head, c as attr_class, j as ensure_array_like, e as escape_html, b as attr, k as attr_style, d as derived, i as stringify } from "../../../chunks/index2.js";
import { S as SiteNav } from "../../../chunks/SiteNav.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import { S as SITE_CONFIG } from "../../../chunks/modules.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let billingPeriod = "monthly";
    const tiers = derived(() => [
      {
        name: "Scout",
        price: "Free",
        period: "during beta",
        description: "Get your Score. Know before you sign.",
        modules: [
          { icon: "📍", label: "Location", included: true },
          { icon: "🏢", label: "Space", included: false },
          { icon: "📊", label: "Business", included: false },
          { icon: "🏦", label: "Loan", included: false },
          { icon: "🚀", label: "Launch", included: false },
          { icon: "📋", label: "Operations", included: false }
        ],
        features: [
          "Block-level Score across 17 live data layers",
          "Neighborhood competitive analysis with chain vs indie breakdown",
          "AI-powered location recommendations tuned to your concept",
          "Foot traffic, transit ridership & pedestrian count insights",
          "Safety and quality-of-life scoring for your block",
          "Compare up to 3 addresses side-by-side"
        ],
        cta: "Get started — free",
        highlighted: false,
        badge: "Free during beta"
      },
      {
        name: "Builder",
        price: 79,
        period: "/month",
        description: "Find and evaluate your ideal space.",
        modules: [
          { icon: "📍", label: "Location", included: true },
          { icon: "🏢", label: "Space", included: true },
          { icon: "📊", label: "Business", included: true },
          { icon: "🏦", label: "Loan", included: false },
          { icon: "🚀", label: "Launch", included: false },
          { icon: "📋", label: "Operations", included: false }
        ],
        features: [
          "Everything in Scout, plus:",
          "Space IQ scoring for commercial listings (layout, condition, buildout cost)",
          "Lease vs. buy scenario modeling with break-even timelines",
          "Revenue projections calibrated to your concept and location data",
          "Business structure optimization (LLC, S-Corp, sole prop)",
          "Financial sensitivity analysis across best, expected, and conservative cases",
          "Exportable reports (PDF) ready for advisors and partners"
        ],
        cta: "Start free trial",
        highlighted: false
      },
      {
        name: "Pro",
        price: 149,
        period: "/month",
        description: "Full financial intelligence stack.",
        modules: [
          { icon: "📍", label: "Location", included: true },
          { icon: "🏢", label: "Space", included: true },
          { icon: "📊", label: "Business", included: true },
          { icon: "🏦", label: "Loan", included: true },
          { icon: "🚀", label: "Launch", included: false },
          { icon: "📋", label: "Operations", included: false }
        ],
        features: [
          "Everything in Builder, plus:",
          "Loan readiness scoring with SBA 7(a) and 504 routing",
          "Matched lenders, grants & capital sources based on your profile",
          "Capital structure recommendations (debt/equity mix, personal guarantee)",
          "Investor-ready pitch materials with location data baked in",
          "Lender comparison with terms, rates, and approval likelihood",
          "Lender-ready PDF package with all supporting data"
        ],
        cta: "Start Pro trial",
        highlighted: true,
        badge: "MOST POPULAR"
      },
      {
        name: "Enterprise",
        price: 249,
        period: "/month",
        description: "Launch-ready. From idea to open doors.",
        modules: [
          { icon: "📍", label: "Location", included: true },
          { icon: "🏢", label: "Space", included: true },
          { icon: "📊", label: "Business", included: true },
          { icon: "🏦", label: "Loan", included: true },
          { icon: "🚀", label: "Launch", included: true },
          { icon: "📋", label: "Operations", included: true }
        ],
        features: [
          "Everything in Pro, plus:",
          "Launch planning with go-to-market timeline and milestones",
          "Operations: auto-generated SOPs, employee handbooks & compliance checklists",
          "Project board (Kanban) with task management and deadline tracking",
          "Team seats + real-time collaboration on shared analyses",
          "API access & custom integrations for portfolio operators",
          "Dedicated account manager with priority support"
        ],
        cta: "Contact sales",
        highlighted: false
      }
    ]);
    const faqItems = [
      {
        question: "What are IQ modules?",
        answer: "Each IQ module is a standalone intelligence engine. Location scores addresses, Space evaluates physical units, Business models your financials, Loan finds your funding, Launch manages your go-to-market, and Operations generates your SOPs and handbooks. Pick the tier that matches your stage."
      },
      {
        question: "What happens after beta?",
        answer: "Scout tier users keep free access to Your Score. Higher modules and features will require a Builder, Pro, or Enterprise subscription."
      },
      {
        question: "Can I cancel anytime?",
        answer: "Yes. No contracts, no cancellation fees. Cancel from your account settings at any time."
      },
      {
        question: "Do you offer refunds?",
        answer: "Yes. If you are not satisfied within the first 30 days, we will issue a full refund — no questions asked."
      },
      {
        question: "What cities do you cover?",
        answer: "We currently cover all five NYC boroughs, with the strongest data coverage in Manhattan. We are expanding to LA, Chicago, Miami, and Dallas in 2026."
      }
    ];
    let expandedFAQ = null;
    head("1hrotn9", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Pricing</title>`);
      });
    });
    SiteNav($$renderer2);
    $$renderer2.push(`<!----> <div class="pricing-page svelte-1hrotn9"><section class="hero svelte-1hrotn9"><div class="hero-content svelte-1hrotn9"><h1 class="hero-title svelte-1hrotn9">Simple, transparent pricing</h1> <p class="hero-subtitle svelte-1hrotn9">Start free. Upgrade when you are ready to sign your lease.</p> <div class="billing-toggle svelte-1hrotn9"><button${attr_class("toggle-button svelte-1hrotn9", void 0, { "active": billingPeriod === "monthly" })}>Monthly</button> <button${attr_class("toggle-button svelte-1hrotn9", void 0, { "active": billingPeriod === "annual" })}>Annual <span class="savings-badge svelte-1hrotn9">Save 2 months</span></button></div></div></section> <section class="tiers-section svelte-1hrotn9"><div class="tiers-grid svelte-1hrotn9"><!--[-->`);
    const each_array = ensure_array_like(tiers());
    for (let index = 0, $$length = each_array.length; index < $$length; index++) {
      let tier = each_array[index];
      $$renderer2.push(`<div${attr_class("tier-card svelte-1hrotn9", void 0, { "highlighted": tier.highlighted })}>`);
      if (tier.badge) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="tier-badge svelte-1hrotn9">${escape_html(tier.badge)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="tier-header svelte-1hrotn9"><h2 class="tier-name svelte-1hrotn9">${escape_html(tier.name)}</h2> <p class="tier-description svelte-1hrotn9">${escape_html(tier.description)}</p></div> <div class="tier-price svelte-1hrotn9">`);
      if (typeof tier.price === "number") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="price-amount svelte-1hrotn9">$${escape_html(tier.price.toLocaleString())}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="price-amount svelte-1hrotn9">${escape_html(tier.price)}</span>`);
      }
      $$renderer2.push(`<!--]--> <span class="price-period svelte-1hrotn9">${escape_html(tier.period)}</span></div> <div class="module-grid svelte-1hrotn9"><!--[-->`);
      const each_array_1 = ensure_array_like(tier.modules);
      for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
        let mod = each_array_1[$$index];
        $$renderer2.push(`<div${attr_class("module-chip svelte-1hrotn9", void 0, { "included": mod.included, "excluded": !mod.included })}><span class="module-chip-icon svelte-1hrotn9">${escape_html(mod.icon)}</span> <span class="module-chip-label svelte-1hrotn9">${escape_html(mod.label)}</span> `);
        if (mod.included) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<svg class="module-check svelte-1hrotn9" viewBox="0 0 24 24" fill="none"><path d="M9 16.17L4.83 12M9 16.17L19.29 5.88" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<svg class="module-lock svelte-1hrotn9" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"></rect><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></div> `);
      if (tier.cta === "Contact sales") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<a${attr("href", `mailto:${stringify(SITE_CONFIG.emails.hello)}`)}${attr_class("cta-button svelte-1hrotn9", void 0, { "cta-primary": tier.highlighted })}>${escape_html(tier.cta)}</a>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<a href="/login"${attr_class("cta-button svelte-1hrotn9", void 0, { "cta-primary": tier.highlighted })} data-sveltekit-reload="">${escape_html(tier.cta)}</a>`);
      }
      $$renderer2.push(`<!--]--> <div class="features-list svelte-1hrotn9"><!--[-->`);
      const each_array_2 = ensure_array_like(tier.features);
      for (let featureIndex = 0, $$length2 = each_array_2.length; featureIndex < $$length2; featureIndex++) {
        let feature = each_array_2[featureIndex];
        $$renderer2.push(`<div class="feature-item svelte-1hrotn9"${attr_style(`animation-delay: ${stringify(featureIndex * 30)}ms`)}><svg class="feature-icon svelte-1hrotn9" viewBox="0 0 24 24" fill="none"><path d="M9 16.17L4.83 12M9 16.17L19.29 5.88" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg> <span>${escape_html(feature)}</span></div>`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    }
    $$renderer2.push(`<!--]--></div></section> <section class="faq-section svelte-1hrotn9"><div class="faq-container svelte-1hrotn9"><h2 class="faq-title svelte-1hrotn9">Frequently Asked Questions</h2> <div class="faq-list svelte-1hrotn9"><!--[-->`);
    const each_array_3 = ensure_array_like(faqItems);
    for (let index = 0, $$length = each_array_3.length; index < $$length; index++) {
      let item = each_array_3[index];
      $$renderer2.push(`<div${attr_class("faq-item svelte-1hrotn9", void 0, { "expanded": expandedFAQ === index })}><button class="faq-question svelte-1hrotn9"${attr("aria-expanded", expandedFAQ === index)}><span>${escape_html(item.question)}</span> <svg class="faq-toggle-icon svelte-1hrotn9" viewBox="0 0 24 24" fill="none"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></button> `);
      if (expandedFAQ === index) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="faq-answer svelte-1hrotn9"><p>${escape_html(item.answer)}</p></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></section> <section class="bottom-cta svelte-1hrotn9"><div class="cta-content svelte-1hrotn9"><p class="cta-text svelte-1hrotn9">Questions about pricing?</p> <a${attr("href", `mailto:${stringify(SITE_CONFIG.emails.hello)}`)} class="cta-link svelte-1hrotn9">${escape_html(SITE_CONFIG.emails.hello)}</a></div></section></div>`);
  });
}
export {
  _page as default
};
