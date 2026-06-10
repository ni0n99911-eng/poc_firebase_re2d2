import { e as escape_html, k as attr_style, i as stringify, d as derived, h as head, c as attr_class, j as ensure_array_like, b as attr } from "../../../../chunks/index2.js";
import { P as PageNav } from "../../../../chunks/PageNav.js";
import { a as createBusinessCaseStore } from "../../../../chunks/business-case-store.svelte.js";
/* empty css                                                           */
import { f as fitTierLabel, a as fitGrade, e as fitMeaningShort } from "../../../../chunks/decision-engine.js";
function SnapshotTab($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { store, model, isLoading = false } = $$props;
    const costToOpen = derived(() => model.costToOpen > 0 ? model.costToOpen : store.costToOpen ?? 0);
    const cashNeeded = derived(() => model.cashNeeded > 0 ? model.cashNeeded : store.cashNeeded ?? 0);
    const dailyTarget = derived(() => model.breakEvenPerDay > 0 ? model.breakEvenPerDay : store.breakEvenPerDay ?? 0);
    const breakEvenBase = derived(() => model.breakEvenMonth ?? store.breakEvenMonth ?? 0);
    const bemColor = derived(() => !breakEvenBase() ? "#6b7280" : breakEvenBase() <= 12 ? "#166534" : breakEvenBase() <= 24 ? "#d97706" : "#dc2626");
    const bemBg = derived(() => !breakEvenBase() ? "#f9fafb" : breakEvenBase() <= 12 ? "#f0fdf4" : breakEvenBase() <= 24 ? "#fffbeb" : "#fef2f2");
    const bemBorder = derived(() => !breakEvenBase() ? "#e5e7eb" : breakEvenBase() <= 12 ? "#bbf7d0" : breakEvenBase() <= 24 ? "#fde68a" : "#fca5a5");
    const bemRow = derived(() => model.scenarios?.find((r) => r.label === "Break-Even Month"));
    const optEditorialLabel = derived(() => store.scenarios?.optimistic?.editorialLabel ?? null);
    const rentRatio = derived(() => store.monthlyRevenue > 0 ? store.monthlyRent / store.monthlyRevenue : 0);
    const showKillChip = derived(() => rentRatio() > 0.12 && store.monthlyRevenue > 0 && store.monthlyRent > 0);
    const useOfFunds = derived(() => model.useOfFunds);
    const hasUseOfFunds = derived(() => useOfFunds() && useOfFunds().total > 0);
    const hasData = derived(() => store.dailyCustomers > 0 && store.avgTicket > 0);
    function fmtMoney(n) {
      if (!n || isNaN(n)) return "—";
      if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
      if (n >= 1e3) return "$" + Math.round(n / 1e3) + "K";
      return "$" + Math.round(n).toLocaleString();
    }
    $$renderer2.push(`<div class="snap-tab svelte-1i8pv8t">`);
    if (isLoading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="snap-loading-pill svelte-1i8pv8t">Calculating with location signals…</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (!hasData()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="snap-zero svelte-1i8pv8t">Use the sliders on the left to enter your daily customers, ticket size, and costs. Your numbers appear here instantly.</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="snap-grid svelte-1i8pv8t">`);
      if (costToOpen() > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="snap-cell svelte-1i8pv8t"><div class="sc-num svelte-1i8pv8t">${escape_html(fmtMoney(costToOpen()))}</div> <div class="sc-label svelte-1i8pv8t">Money to Open the Doors</div> <div class="sc-note svelte-1i8pv8t">Everything you need before opening day — buildout, equipment, permits, deposits, and first month's rent.</div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (cashNeeded() > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="snap-cell svelte-1i8pv8t"><div class="sc-num svelte-1i8pv8t">${escape_html(fmtMoney(cashNeeded()))}</div> <div class="sc-label svelte-1i8pv8t">Total Cash You'll Need</div> <div class="sc-note svelte-1i8pv8t">Your safety net: startup costs + 6 months of runway to cover early losses.</div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (dailyTarget() > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="snap-cell svelte-1i8pv8t"><div class="sc-num svelte-1i8pv8t">${escape_html(fmtMoney(dailyTarget()))}<span class="sc-suffix svelte-1i8pv8t">/day</span></div> <div class="sc-label svelte-1i8pv8t">Your Daily Target</div> <div class="sc-note svelte-1i8pv8t">The amount you need to ring up every single day to not lose money. Post it on the register. Check it at 6pm.</div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (breakEvenBase() > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="snap-cell snap-cell--bem svelte-1i8pv8t"${attr_style(`background:${stringify(bemBg())}; border-color:${stringify(bemBorder())}`)}><div class="sc-num svelte-1i8pv8t"${attr_style(`color:${stringify(bemColor())}`)}>Month ${escape_html(breakEvenBase())}</div> <div class="sc-label svelte-1i8pv8t">When You Start Keeping Money</div> <div class="sc-note svelte-1i8pv8t">The month the business pays for itself. After this point, profit is yours.</div> <div class="sc-benchmark svelte-1i8pv8t">`);
        if (breakEvenBase() <= 6) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`Most businesses in NYC break even in 6-12 months — you're ahead of the curve.`);
        } else if (breakEvenBase() <= 12) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`Most businesses in NYC break even in 6-12 months — you're right on track.`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`Most businesses in NYC break even in 6-12 months. Consider adjusting your numbers to get closer.`);
        }
        $$renderer2.push(`<!--]--></div> `);
        if (bemRow()) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="sc-range svelte-1i8pv8t"><div class="scr-row svelte-1i8pv8t"><span class="scr-tag scr-tag--opt svelte-1i8pv8t">Best</span> <span class="scr-val svelte-1i8pv8t">${escape_html(bemRow().optimistic)}</span></div> `);
          if (optEditorialLabel()) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="scr-editorial svelte-1i8pv8t">Based on ${escape_html(optEditorialLabel())} momentum.</div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <div class="scr-row svelte-1i8pv8t"><span class="scr-tag scr-tag--base svelte-1i8pv8t">Base</span> <span class="scr-val scr-val--base svelte-1i8pv8t">${escape_html(bemRow().base)}</span></div> <div class="scr-row svelte-1i8pv8t"><span class="scr-tag scr-tag--con svelte-1i8pv8t">Slow</span> <span class="scr-val svelte-1i8pv8t">${escape_html(bemRow().conservative)}</span></div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      if (showKillChip()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="snap-kill svelte-1i8pv8t"><span class="sk-icon svelte-1i8pv8t">⚠</span> <div class="sk-body svelte-1i8pv8t"><strong>Your rent-to-revenue ratio is ${escape_html(Math.round(rentRatio() * 100))}%</strong> — most successful operators keep this under 12%. This is common at this stage and fixable. Tenants in this area typically negotiate 15–25% off asking rent. Ask RE²D2 how: <div class="sk-actions svelte-1i8pv8t"><button class="sk-action svelte-1i8pv8t">How do I bring rent down? →</button> <button class="sk-action svelte-1i8pv8t">How do I make more revenue? →</button> <button class="sk-action svelte-1i8pv8t">Is my rent fair for this area? →</button></div></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (hasUseOfFunds()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="snap-funds svelte-1i8pv8t"><div class="sf-title svelte-1i8pv8t">Where Your Startup Money Goes</div> <div class="sf-grid svelte-1i8pv8t">`);
        if (useOfFunds().buildout > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="sf-row svelte-1i8pv8t"><span class="svelte-1i8pv8t">Buildout</span><span class="svelte-1i8pv8t">${escape_html(fmtMoney(useOfFunds().buildout))}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (useOfFunds().equipment > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="sf-row svelte-1i8pv8t"><span class="svelte-1i8pv8t">Equipment</span><span class="svelte-1i8pv8t">${escape_html(fmtMoney(useOfFunds().equipment))}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (useOfFunds().permits > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="sf-row svelte-1i8pv8t"><span class="svelte-1i8pv8t">Permits &amp; licenses</span><span class="svelte-1i8pv8t">${escape_html(fmtMoney(useOfFunds().permits))}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (useOfFunds().deposit > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="sf-row svelte-1i8pv8t"><span class="svelte-1i8pv8t">Security deposit</span><span class="svelte-1i8pv8t">${escape_html(fmtMoney(useOfFunds().deposit))}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (useOfFunds().workingCapital > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="sf-row svelte-1i8pv8t"><span class="svelte-1i8pv8t">Working capital buffer</span><span class="svelte-1i8pv8t">${escape_html(fmtMoney(useOfFunds().workingCapital))}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (useOfFunds().contingency > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="sf-row svelte-1i8pv8t"><span class="svelte-1i8pv8t">Contingency (10%)</span><span class="svelte-1i8pv8t">${escape_html(fmtMoney(useOfFunds().contingency))}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <div class="sf-row sf-row--total svelte-1i8pv8t"><span class="svelte-1i8pv8t">Total</span><span class="svelte-1i8pv8t">${escape_html(fmtMoney(useOfFunds().total))}</span></div></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const store = createBusinessCaseStore();
    let activeTab = "snapshot";
    let isModelLoading = false;
    let enriched = false;
    const tabs = [
      { id: "snapshot", label: "Can I Afford This?" },
      { id: "stress", label: "Will I Make Money?" },
      { id: "full", label: "What Does the Bank Need?" }
    ];
    const hasSession = derived(() => store.locationIQ > 0 || store.analysisAddress.length > 0);
    const activeModel = derived(() => store.model);
    const OCCUPANCY_CEILINGS = {
      full_service_restaurant: 0.1,
      restaurant: 0.1,
      qsr: 0.08,
      fast_casual: 0.08,
      quick_service: 0.08,
      grocery: 0.05,
      retail: 0.15,
      florist: 0.15,
      fitness: 0.25,
      fitness_studio: 0.25,
      specialty_coffee: 0.12,
      coffee_shop: 0.12,
      cafe: 0.12,
      personal_services: 0.14,
      spa_wellness: 0.14,
      barbershop: 0.14,
      bar_nightlife: 0.12,
      bar: 0.12,
      coworking: 0.15,
      medical_dental: 0.12
    };
    const occupancyCeiling = derived(() => OCCUPANCY_CEILINGS[store.conceptKey] ?? 0.15);
    const verdictState = derived(() => {
      const net = store.monthlyRevenue - store.monthlyTotal;
      const rentPct = store.monthlyRevenue > 0 ? store.monthlyRent / store.monthlyRevenue : 0;
      const bem = activeModel()?.breakEvenMonth ?? store.breakEvenMonth ?? 0;
      const ceilingPct = Math.round(occupancyCeiling() * 100);
      const fit = Math.round(store.fitIQ ?? 0);
      const grade = fit > 0 ? fitGrade(fit) : "";
      const tier = fit > 0 ? fitTierLabel(fit) : "";
      const meaning = fit > 0 ? fitMeaningShort(fit) : "";
      const gradeLead = fit > 0 ? `Grade ${grade} · ${tier} — ${meaning}` : "";
      if (rentPct > occupancyCeiling() * 1.5 && store.monthlyRevenue > 0) return {
        color: "#dc2626",
        bg: "#fef2f2",
        border: "#fca5a5",
        label: "Rent is too high for this concept.",
        detail: `Your rent is ${Math.round(rentPct * 100)}% of revenue — the ceiling for this business type is ${ceilingPct}%. Consider a cheaper space or higher revenue.`,
        grade,
        tier,
        meaning,
        gradeLead
      };
      if (net <= 0 || bem > 12) return {
        color: "#dc2626",
        bg: "#fef2f2",
        border: "#fca5a5",
        label: "Your numbers need work.",
        detail: "Adjust your inputs until the monthly profit goes positive.",
        grade,
        tier,
        meaning,
        gradeLead
      };
      if (rentPct > occupancyCeiling()) return {
        color: "#d97706",
        bg: "#fffbeb",
        border: "#fde68a",
        label: "Rent is eating your margin.",
        detail: `Rent is ${Math.round(rentPct * 100)}% of revenue (${ceilingPct}% ceiling for this type). Plan for a ${bem}-month ramp.`,
        grade,
        tier,
        meaning,
        gradeLead
      };
      if (bem > 9) return {
        color: "#d97706",
        bg: "#fffbeb",
        border: "#fde68a",
        label: "Your numbers are tight.",
        detail: `Plan for a ${bem}-month ramp. Rent is ${Math.round(rentPct * 100)}% of revenue (under the ${ceilingPct}% ceiling).`,
        grade,
        tier,
        meaning,
        gradeLead
      };
      return {
        color: "#166534",
        bg: "#f0fdf4",
        border: "#bbf7d0",
        label: "Your numbers work.",
        detail: `Break-even by Month ${bem} with $${Math.round(net).toLocaleString()}/mo profit. Rent is ${Math.round(rentPct * 100)}% of revenue (${ceilingPct}% ceiling).`,
        grade,
        tier,
        meaning,
        gradeLead
      };
    });
    function fmtScore(n) {
      return n > 0 ? String(Math.round(n)) : "–";
    }
    head("uaa0wx", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Business Case — RE²</title>`);
      });
    });
    $$renderer2.push(`<div class="bc-page svelte-uaa0wx">`);
    PageNav($$renderer2, {
      backHref: "/app/location",
      backLabel: "Your Score",
      nextHref: "/app/dashboard",
      nextLabel: "Dashboard"
    });
    $$renderer2.push(`<!----> `);
    if (!hasSession()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="bc-no-session svelte-uaa0wx"><span>You haven't run a location analysis yet.</span> <a href="/app/location" class="bc-no-session-btn svelte-uaa0wx">→ Analyze a location first</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <header class="bc-hero svelte-uaa0wx"><div class="bc-hero-inner svelte-uaa0wx"><div class="bc-hero-left"><div class="bc-eyebrow svelte-uaa0wx">Business Case</div> <h1 class="bc-headline svelte-uaa0wx">${escape_html(store.conceptLabel)}</h1> `);
    if (store.analysisAddress) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="bc-address-row svelte-uaa0wx"><span class="bc-address svelte-uaa0wx">${escape_html(store.analysisAddress)}</span> <a${attr("href", `/app/location?addr=${stringify(encodeURIComponent(store.analysisAddress))}`)} class="bc-loc-link svelte-uaa0wx">View your score →</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (store.fitIQ > 0) {
      $$renderer2.push("<!--[0-->");
      const _bcFit = Math.round(store.fitIQ);
      const _bcGrade = fitGrade(_bcFit);
      const _bcTier = fitTierLabel(_bcFit);
      $$renderer2.push(`<div class="bc-scores-wrap svelte-uaa0wx"><div class="bc-scores svelte-uaa0wx"><div class="bc-score-chip svelte-uaa0wx"><span class="bcs-num svelte-uaa0wx">${escape_html(fmtScore(store.fitIQ))}</span> <span class="bcs-label svelte-uaa0wx">Your Score</span> <span class="bcs-grade svelte-uaa0wx">Grade ${escape_html(_bcGrade)}</span></div></div> <div class="bc-scores-ctx svelte-uaa0wx">${escape_html(_bcTier)} — ${escape_html(_bcFit)}/100 from your location analysis</div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></header>  `);
    if (hasSession() && store.dailyCustomers > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="bc-verdict svelte-uaa0wx"${attr_style(`background:${stringify(verdictState().bg)}; border-color:${stringify(verdictState().border)}`)}><span class="bc-verdict-icon svelte-uaa0wx"${attr_style(`color:${stringify(verdictState().color)}`)}>${escape_html(verdictState().color === "#166534" ? "✓" : verdictState().color === "#d97706" ? "⚠" : "✗")}</span> <div class="bc-verdict-text svelte-uaa0wx">`);
      if (verdictState().gradeLead) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="bc-verdict-gradelead svelte-uaa0wx">${escape_html(verdictState().gradeLead)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <span class="bc-verdict-label svelte-uaa0wx"${attr_style(`color:${stringify(verdictState().color)}`)}>${escape_html(verdictState().label)}</span> <span class="bc-verdict-detail svelte-uaa0wx">${escape_html(verdictState().detail)}</span></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="bc-layout svelte-uaa0wx"><div${attr_class("bc-sidebar-wrap svelte-uaa0wx", void 0, { "collapsed": true })}><button class="bc-sidebar-toggle svelte-uaa0wx">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="toggle-icon svelte-uaa0wx">⚙</span> Adjust Numbers`);
    }
    $$renderer2.push(`<!--]--></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="bc-content svelte-uaa0wx"><nav class="bc-tabs svelte-uaa0wx"><!--[-->`);
    const each_array = ensure_array_like(tabs);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let tab = each_array[$$index];
      $$renderer2.push(`<button${attr_class("bc-tab svelte-uaa0wx", void 0, { "bc-tab--active": activeTab === tab.id })}>${escape_html(tab.label)}</button>`);
    }
    $$renderer2.push(`<!--]--> <div class="bc-tab-spacer svelte-uaa0wx"></div> `);
    if (hasSession()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button${attr_class("bc-run-btn svelte-uaa0wx", void 0, { "bc-run-btn--done": enriched })}${attr("disabled", isModelLoading, true)} title="Re-runs the model using your location's transit + vibrancy signals">`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`Use my location data`);
      }
      $$renderer2.push(`<!--]--></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></nav> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="bc-tab-body svelte-uaa0wx">`);
    {
      $$renderer2.push("<!--[0-->");
      SnapshotTab($$renderer2, {
        store,
        model: activeModel(),
        isLoading: isModelLoading
      });
    }
    $$renderer2.push(`<!--]--></div></div> <div${attr_class("bc-copilot-wrap svelte-uaa0wx", void 0, { "collapsed": true })}><button class="bc-copilot-toggle svelte-uaa0wx"${attr("title", "Ask Co-Pilot")}>`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="toggle-sparkle svelte-uaa0wx">✨</span><span class="toggle-label svelte-uaa0wx">Ask RE²D2</span>`);
    }
    $$renderer2.push(`<!--]--></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
  });
}
export {
  _page as default
};
