import { h as head, e as escape_html, j as ensure_array_like, k as attr_style, i as stringify, c as attr_class, d as derived } from "../../../../chunks/index2.js";
import { loadLaunchPadData } from "../../../../chunks/launchpad-store.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let activePhase = 1;
    let lpData = loadLaunchPadData();
    let tokenSymbol = "TOKEN";
    const tokenomicsData = [
      { label: "Community & Rewards", percent: 40, color: "#ff2d55" },
      {
        label: "Operations & Development",
        percent: 30,
        color: "#00e8cc"
      },
      { label: "Team & Advisors", percent: 20, color: "#ffd60a" },
      { label: "Treasury Reserve", percent: 10, color: "#a0a0a0" }
    ];
    const roadmap = [
      {
        phase: 1,
        title: "Launch & Loyalty",
        timeline: "Q2 2024",
        items: [
          `${tokenSymbol} token launch (Base L2)`,
          "Loyalty program (Bronze/Silver/Gold)",
          "Mobile app launch",
          "500 txn/day baseline"
        ]
      },
      {
        phase: 2,
        title: "Fractional Ownership",
        timeline: "Q4 2024",
        items: [
          "Fractional store equity tokens",
          "Dividend distribution protocol",
          "SEC-compliant offering",
          "DAO governance framework"
        ]
      },
      {
        phase: 3,
        title: "Multi-Location Expansion",
        timeline: "Q1 2025",
        items: [
          "Second location tokenization",
          "Cross-location governance",
          "Revenue pooling mechanism",
          "Franchisee network launch"
        ]
      },
      {
        phase: 4,
        title: "Web3 Infrastructure",
        timeline: "Q3 2025",
        items: [
          "Autonomous cafe operations",
          "Real-time on-chain metrics",
          "Liquidity mining pools",
          "Cross-chain integration"
        ]
      }
    ];
    let features = derived(() => {
      return [
        {
          icon: "⚡",
          title: `Earn ${tokenSymbol} Tokens`,
          desc: `Get 1-3% ${tokenSymbol} per $ spent based on loyalty tier`,
          color: "#ff2d55"
        },
        {
          icon: "🏪",
          title: "Own Store Equity",
          desc: "Fractional store ownership for Gold-tier members (Phase 2)",
          color: "#00e8cc"
        },
        {
          icon: "🗳️",
          title: "Vote & Govern",
          desc: "Propose and vote on cafe strategy and menu items",
          color: "#ffd60a"
        },
        {
          icon: "💰",
          title: "Earn Dividends",
          desc: "Revenue sharing from cafe operations distributed weekly",
          color: "#ff2d55"
        }
      ];
    });
    const keyMetrics = [
      { metric: "$1.6M", label: "Annual Revenue Target" },
      { metric: "500", label: "Daily Transactions Target" },
      { metric: "75-78%", label: "Gross Margin at Scale" },
      { metric: "74", label: "Total Menu SKUs" }
    ];
    head("p332b9", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Risk Assessment</title>`);
      });
    });
    $$renderer2.push(`<div class="container svelte-p332b9"><header class="page-header svelte-p332b9"><h1 class="svelte-p332b9">🏢 RWA &amp; Tokenization</h1> <p class="subtitle svelte-p332b9">${escape_html(lpData.businessName || "Your business")} as a tokenized real-world asset</p></header> <section class="metrics-section svelte-p332b9"><div class="metrics-grid svelte-p332b9"><!--[-->`);
    const each_array = ensure_array_like(keyMetrics);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let metric = each_array[$$index];
      $$renderer2.push(`<div class="metric-card svelte-p332b9"><div class="metric-value svelte-p332b9">${escape_html(metric.metric)}</div> <div class="metric-label svelte-p332b9">${escape_html(metric.label)}</div></div>`);
    }
    $$renderer2.push(`<!--]--></div></section> <section class="features-section svelte-p332b9"><h2 class="section-title svelte-p332b9">Token Utility</h2> <div class="features-grid svelte-p332b9"><!--[-->`);
    const each_array_1 = ensure_array_like(features());
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let feature = each_array_1[$$index_1];
      $$renderer2.push(`<div class="feature-card svelte-p332b9"${attr_style(`--feature-color: ${stringify(feature.color)}`)}><div class="feature-icon svelte-p332b9">${escape_html(feature.icon)}</div> <h3 class="svelte-p332b9">${escape_html(feature.title)}</h3> <p class="svelte-p332b9">${escape_html(feature.desc)}</p></div>`);
    }
    $$renderer2.push(`<!--]--></div></section> <section class="tokenomics-section svelte-p332b9"><h2 class="section-title svelte-p332b9">Tokenomics Allocation</h2> <div class="tokenomics-layout svelte-p332b9"><div class="allocation-chart svelte-p332b9"><!--[-->`);
    const each_array_2 = ensure_array_like(tokenomicsData);
    for (let i = 0, $$length = each_array_2.length; i < $$length; i++) {
      let data = each_array_2[i];
      $$renderer2.push(`<div class="allocation-bar svelte-p332b9"><div class="allocation-fill svelte-p332b9"${attr_style(`width: ${stringify(data.percent)}%; background: ${stringify(data.color)}`)}></div> <span class="allocation-label svelte-p332b9">${escape_html(data.percent)}%</span></div> <div class="allocation-legend svelte-p332b9"><span class="legend-color svelte-p332b9"${attr_style(`background: ${stringify(data.color)}`)}></span> <span class="legend-text svelte-p332b9">${escape_html(data.label)}</span></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></section> <section class="roadmap-section svelte-p332b9"><h2 class="section-title svelte-p332b9">Development Roadmap</h2> <div class="roadmap-timeline svelte-p332b9"><!--[-->`);
    const each_array_3 = ensure_array_like(roadmap);
    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
      let phase = each_array_3[$$index_3];
      $$renderer2.push(`<button${attr_class("phase-button svelte-p332b9", void 0, { "active": activePhase === phase.phase })}><div class="phase-number svelte-p332b9">Phase ${escape_html(phase.phase)}</div> <div class="phase-time svelte-p332b9">${escape_html(phase.timeline)}</div></button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="phase-content svelte-p332b9"><!--[-->`);
    const each_array_4 = ensure_array_like(roadmap);
    for (let $$index_5 = 0, $$length = each_array_4.length; $$index_5 < $$length; $$index_5++) {
      let phase = each_array_4[$$index_5];
      if (activePhase === phase.phase) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="phase-details svelte-p332b9"><h3 class="svelte-p332b9">${escape_html(phase.title)}</h3> <p class="phase-timeline svelte-p332b9">${escape_html(phase.timeline)}</p> <ul class="phase-items svelte-p332b9"><!--[-->`);
        const each_array_5 = ensure_array_like(phase.items);
        for (let $$index_4 = 0, $$length2 = each_array_5.length; $$index_4 < $$length2; $$index_4++) {
          let item = each_array_5[$$index_4];
          $$renderer2.push(`<li class="svelte-p332b9">${escape_html(item)}</li>`);
        }
        $$renderer2.push(`<!--]--></ul></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></section> <section class="concept-section svelte-p332b9"><div class="concept-box svelte-p332b9"><h2 class="svelte-p332b9">The Concept</h2> <p class="svelte-p332b9">${escape_html(lpData.businessName || "Your business")} is tokenized as a real-world asset on the blockchain. Customers and supporters earn ${escape_html(tokenSymbol)} tokens with every purchase. Gold-tier members receive fractional ownership in the cafe, entitling them to:</p> <ul class="concept-list svelte-p332b9"><li class="svelte-p332b9"><strong class="svelte-p332b9">Governance Rights:</strong> Vote on menu items, pricing, expansion locations</li> <li class="svelte-p332b9"><strong class="svelte-p332b9">Revenue Sharing:</strong> Weekly dividend distribution from sales</li> <li class="svelte-p332b9"><strong class="svelte-p332b9">Appreciation:</strong> Token value tied to cafe profitability and growth</li> <li class="svelte-p332b9"><strong class="svelte-p332b9">Liquidity:</strong> Trade tokens on secondary markets (subject to regulations)</li></ul> <p style="margin-top: 20px; font-size: 0.95rem; color: var(--text-dim);" class="svelte-p332b9">This model aligns customer interests with business success, creating a community-owned cafe that scales globally while maintaining authentic local roots.</p></div></section></div>`);
  });
}
export {
  _page as default
};
