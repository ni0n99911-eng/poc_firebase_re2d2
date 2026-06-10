import { h as head, b as attr, e as escape_html, c as attr_class, k as attr_style, i as stringify, d as derived, f as store_get, u as unsubscribe_stores } from "../../../../chunks/index2.js";
import { p as page } from "../../../../chunks/stores.js";
import { g as getScoreColor, a as getScoreGrade } from "../../../../chunks/scoreUtils.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const data = derived(() => store_get($$store_subs ??= {}, "$page", page).data);
    let showUserMenu = false;
    let showDetails = false;
    function formatDate(iso) {
      try {
        return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      } catch {
        return "";
      }
    }
    function formatCurrency(n) {
      if (!n || !isFinite(n)) return "--";
      if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
      return `$${n}`;
    }
    function getInitials(name) {
      return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "U";
    }
    function getPersonaEmoji(pt) {
      const map = {
        "coffee_shop": "☕",
        "coffee": "☕",
        "Specialty Coffee/Café": "☕",
        "restaurant": "🍽️",
        "Restaurant (Fast Casual)": "🍽️",
        "Restaurant (Full Service)": "🍽️",
        "gym": "💪",
        "fitness": "💪",
        "Fitness / Wellness": "💪",
        "dentist": "🦷",
        "spa": "💆",
        "bodega": "🏪",
        "bakery": "🥐",
        "barber": "💈",
        "boutique": "👗",
        "florist": "💐"
      };
      return map[pt || ""] || "✨";
    }
    function getPersonaLabel(pt) {
      if (pt === "something_else") {
        try {
          const raw = typeof window !== "undefined" ? localStorage.getItem("re2_launchpad") : null;
          if (raw) {
            const lp = JSON.parse(raw);
            if (lp.businessName && lp.businessName !== "Other") return lp.businessName;
          }
        } catch {
        }
        return "Your Business";
      }
      const map = {
        // Canonical keys (written by writeCanonicalConcept / server load)
        "specialty_coffee": "Coffee / Café",
        "bakery": "Bakery / Café",
        "fast_casual": "Fast Casual",
        "full_service_restaurant": "Full-Service Restaurant",
        "qsr": "Quick Service",
        "bar_nightlife": "Bar / Lounge",
        "juice_bar": "Juice Bar",
        "wellness_beverage": "Wellness Beverage",
        "fitness_studio": "Fitness / Wellness",
        "personal_services": "Personal Services",
        "medical_office": "Dental / Medical",
        "wellness_spa": "Spa / Wellness",
        "florist": "Florist",
        "coworking": "Coworking",
        // Legacy / onboarding keys
        "coffee_shop": "Coffee / Café",
        "coffee": "Coffee / Café",
        "Specialty Coffee/Café": "Coffee / Café",
        "restaurant": "Restaurant",
        "Restaurant (Fast Casual)": "Fast Casual",
        "Restaurant (Full Service)": "Full Service",
        "gym": "Fitness Studio",
        "fitness": "Fitness Studio",
        "Fitness / Wellness": "Fitness Studio",
        "dentist": "Dental Practice",
        "spa": "Spa / Wellness",
        "spa_wellness": "Spa / Wellness",
        "bodega": "Grocery / Market",
        "barber": "Barbershop",
        "barbershop": "Barbershop / Salon",
        "boutique": "Retail Boutique",
        "retail": "Retail",
        "bar": "Bar / Lounge",
        "medical_dental": "Dental / Medical",
        "Other": "Your Business"
      };
      return map[pt || ""] || pt || "Your Business";
    }
    const hasScored = derived(() => !!(data().recap.lastAddress && data().recap.lastScore));
    const firstName = derived(() => data().userName.split(" ")[0] || "there");
    let lastSixScores = {};
    const isComplete = derived(hasScored);
    const isReadyToScore = derived(() => !hasScored() && // Explicit phase says ready
    (data().recap.conversationPhase === "complete" || data().recap.conversationPhase === "scoring" || data().recap.conversationPhase === "address" || // Or inferred: has persona + concept + financials = ready even without phase
    !!(data().recap.personaType && data().recap.conceptDescription && data().recap.financialEstimates)));
    const isIncomplete = derived(() => !hasScored() && !isReadyToScore() && !!(data().recap.personaType || data().recap.conceptDescription));
    function getProgressLabel(phase) {
      if (phase) {
        switch (phase) {
          case "greeting":
          case "persona":
            return "Getting started — tell us your business type";
          case "concept":
            return "Defining your concept";
          case "customers":
            return "Identifying your customers";
          case "financials":
            return "Setting your financial targets";
          case "address":
            return "Ready to score a location";
          case "scoring":
          case "complete":
            return "Onboarding complete";
        }
      }
      const r = data().recap;
      if (r.lastScore) return "Onboarding complete";
      if (r.financialEstimates) return "Ready to score a location";
      if (r.targetCustomers?.length > 0 || r.differentiators?.length > 0) return "Setting your financial targets";
      if (r.conceptDescription || r.conceptName) return "Identifying your customers";
      if (r.personaType) return "Defining your concept";
      return "Getting started";
    }
    head("1b34qkx", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Welcome Back</title>`);
      });
      $$renderer3.push(`<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700&amp;family=DM+Serif+Display:ital@0;1&amp;display=swap" rel="stylesheet" class="svelte-1b34qkx"/>`);
    });
    $$renderer2.push(`<div class="wb-page svelte-1b34qkx"><nav class="app-nav svelte-1b34qkx"><a href="/app/welcome-back" class="nav-back svelte-1b34qkx" aria-label="Back to dashboard">←</a> <a href="/app/welcome-back" class="nav-logo svelte-1b34qkx">RE<sup class="svelte-1b34qkx">2</sup></a> <div class="nav-right svelte-1b34qkx"><a href="/app/onboarding" class="nav-cta svelte-1b34qkx">Score a Location</a> <div class="nav-avatar-wrap svelte-1b34qkx"><button class="nav-avatar svelte-1b34qkx" aria-label="User menu"${attr("aria-expanded", showUserMenu)}>${escape_html(getInitials(data().userName))}</button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></nav> <div class="wb-body svelte-1b34qkx"><div class="wb-container svelte-1b34qkx"><div class="wb-header svelte-1b34qkx"><h1 class="svelte-1b34qkx">Welcome back, <em class="svelte-1b34qkx">${escape_html(firstName())}</em>.</h1> `);
    if (isComplete()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="wb-sub svelte-1b34qkx">Here's your concept and latest score. Score another location or try a new idea.</p>`);
    } else if (isReadyToScore()) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<p class="wb-sub svelte-1b34qkx">Your concept is dialed in — you're ready to score a location.</p>`);
    } else if (isIncomplete()) {
      $$renderer2.push("<!--[2-->");
      $$renderer2.push(`<p class="wb-sub svelte-1b34qkx">You were making progress — pick up where you left off.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="wb-sub svelte-1b34qkx">Pick up where you left off or try something new.</p>`);
    }
    $$renderer2.push(`<!--]--> <div class="wb-progress-badge svelte-1b34qkx"><span${attr_class("progress-dot svelte-1b34qkx", void 0, {
      "complete": isComplete(),
      "ready": isReadyToScore(),
      "in-progress": isIncomplete()
    })}></span> <span class="progress-text svelte-1b34qkx">${escape_html(getProgressLabel(data().recap.conversationPhase))}</span></div></div> `);
    if (isIncomplete()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="continue-card svelte-1b34qkx"><div class="continue-icon svelte-1b34qkx"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-1b34qkx"><circle cx="12" cy="12" r="10" class="svelte-1b34qkx"></circle><polyline points="12 6 12 12 16 14" class="svelte-1b34qkx"></polyline></svg></div> <div class="continue-body svelte-1b34qkx"><span class="continue-title svelte-1b34qkx">You left off at: ${escape_html(getProgressLabel(data().recap.conversationPhase))}</span> `);
      if (data().recap.conceptName || data().recap.personaType) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="continue-meta svelte-1b34qkx">${escape_html(getPersonaEmoji(data().recap.personaType))}
								${escape_html(data().recap.conceptName || getPersonaLabel(data().recap.personaType))}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <a href="/app/onboarding" class="continue-btn svelte-1b34qkx" data-sveltekit-reload="">Continue →</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (data().recap.personaType || data().recap.conceptDescription) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="concept-card svelte-1b34qkx"><div class="concept-top svelte-1b34qkx"><div class="concept-emoji svelte-1b34qkx">${escape_html(getPersonaEmoji(data().recap.personaType))}</div> <div class="concept-meta svelte-1b34qkx"><span class="concept-type svelte-1b34qkx">${escape_html(data().recap.conceptName ?? getPersonaLabel(data().recap.personaType))}</span> `);
      if (data().recap.conceptName) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="concept-name svelte-1b34qkx">${escape_html(data().recap.conceptName)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <span class="concept-date svelte-1b34qkx">${escape_html(formatDate(data().recap.updatedAt))}</span></div> `);
      if (data().recap.conceptDescription) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="concept-vision svelte-1b34qkx">"${escape_html(data().recap.conceptDescription)}"</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (data().recap.financialEstimates) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="fin-row svelte-1b34qkx">`);
        if (data().recap.financialEstimates.avgTicket) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="fin-chip svelte-1b34qkx"><span class="fin-num svelte-1b34qkx">$${escape_html(data().recap.financialEstimates.avgTicket)}</span> <span class="fin-label svelte-1b34qkx">avg ticket</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (data().recap.financialEstimates.dailyCustomers) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="fin-chip svelte-1b34qkx"><span class="fin-num svelte-1b34qkx">${escape_html(data().recap.financialEstimates.dailyCustomers)}</span> <span class="fin-label svelte-1b34qkx">daily customers</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (data().recap.financialEstimates.monthlyRevenue?.length === 2) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="fin-chip svelte-1b34qkx"><span class="fin-num svelte-1b34qkx">${escape_html(formatCurrency(data().recap.financialEstimates.monthlyRevenue[0]))}–${escape_html(formatCurrency(data().recap.financialEstimates.monthlyRevenue[1]))}</span> <span class="fin-label svelte-1b34qkx">monthly rev</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (data().recap.financialEstimates.maxRent || data().recap.financialEstimates.maxHealthyRent) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="fin-chip svelte-1b34qkx"><span class="fin-num svelte-1b34qkx">${escape_html(formatCurrency(data().recap.financialEstimates.maxRent || data().recap.financialEstimates.maxHealthyRent || 0))}</span> <span class="fin-label svelte-1b34qkx">max rent/mo</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if ((data().recap.targetCustomers?.length ?? 0) > 0 || (data().recap.differentiators?.length ?? 0) > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button class="details-toggle svelte-1b34qkx">${escape_html("Show more details")} <span${attr_class("toggle-arrow svelte-1b34qkx", void 0, { "open": showDetails })}>▾</span></button> `);
        {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (isComplete() && (lastSixScores.transit || lastSixScores.demographics || lastSixScores.competition)) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="sub-score-chips svelte-1b34qkx">`);
        if (lastSixScores.transit) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="sub-chip svelte-1b34qkx"><span class="sub-chip-label svelte-1b34qkx">Transit</span> <span class="sub-chip-val svelte-1b34qkx"${attr_style(`color:${stringify(getScoreColor(lastSixScores.transit))}`)}>${escape_html(lastSixScores.transit)}</span></span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (lastSixScores.demographics) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="sub-chip svelte-1b34qkx"><span class="sub-chip-label svelte-1b34qkx">Demo</span> <span class="sub-chip-val svelte-1b34qkx"${attr_style(`color:${stringify(getScoreColor(lastSixScores.demographics))}`)}>${escape_html(lastSixScores.demographics)}</span></span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (lastSixScores.competition) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="sub-chip svelte-1b34qkx"><span class="sub-chip-label svelte-1b34qkx">Comp.</span> <span class="sub-chip-val svelte-1b34qkx"${attr_style(`color:${stringify(getScoreColor(lastSixScores.competition))}`)}>${escape_html(lastSixScores.competition)}</span></span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (isComplete()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="score-section svelte-1b34qkx"><div class="score-section-header svelte-1b34qkx"><span class="score-section-label svelte-1b34qkx">Your Score</span></div> <div class="score-row svelte-1b34qkx"><div class="score-ring-svg svelte-1b34qkx"><svg viewBox="0 0 64 64" width="64" height="64" class="svelte-1b34qkx"><circle cx="32" cy="32" r="26" fill="none" stroke="#e8e3dc" stroke-width="5" class="svelte-1b34qkx"></circle><circle cx="32" cy="32" r="26" fill="none"${attr("stroke", getScoreColor(data().recap.lastScore ?? 0))} stroke-width="5" stroke-linecap="round" stroke-dasharray="163.4"${attr("stroke-dashoffset", 163.4 * (1 - (data().recap.lastScore ?? 0) / 100))} transform="rotate(-90 32 32)" class="svelte-1b34qkx"></circle></svg> <div class="score-ring-inner svelte-1b34qkx"><span class="score-num svelte-1b34qkx">${escape_html(data().recap.lastScore ?? "--")}</span> <span class="score-grade svelte-1b34qkx">${escape_html(getScoreGrade(data().recap.lastScore ?? 0))}</span></div></div> <div class="score-info svelte-1b34qkx"><span class="score-addr svelte-1b34qkx">${escape_html(data().recap.lastAddress?.split(",")[0])}</span> `);
        {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (data().recap.lastVerdict) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="score-verdict svelte-1b34qkx">${escape_html(data().recap.lastVerdict)}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <a${attr("href", `/app/location?addr=${stringify(encodeURIComponent(data().recap.lastAddress || ""))}`)} class="score-link svelte-1b34qkx" data-sveltekit-reload="">Full report →</a></div></div>`);
      } else if (isReadyToScore()) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<div class="score-section svelte-1b34qkx"><div class="score-section-header svelte-1b34qkx"><span class="score-section-label svelte-1b34qkx">Your Score</span></div> <div class="score-row svelte-1b34qkx"><div class="score-ring-svg locked svelte-1b34qkx"><svg viewBox="0 0 64 64" width="64" height="64" opacity="0.35" class="svelte-1b34qkx"><circle cx="32" cy="32" r="26" fill="none" stroke="#D1D5DB" stroke-width="5" stroke-dasharray="10 7" class="svelte-1b34qkx"></circle></svg> <div class="score-ring-inner locked svelte-1b34qkx"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#9CA3AF" stroke-width="2.5" stroke-linecap="round" class="svelte-1b34qkx"><rect x="3" y="11" width="18" height="11" rx="2" class="svelte-1b34qkx"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4" class="svelte-1b34qkx"></path></svg></div></div> <div class="score-info svelte-1b34qkx"><span class="score-addr muted svelte-1b34qkx">Pick an address to unlock your score</span></div> <a href="/app/location" class="score-link primary svelte-1b34qkx" data-sveltekit-reload="">Score Now →</a></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="actions svelte-1b34qkx">`);
    if (isComplete()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a href="/app/location" class="action-card primary svelte-1b34qkx" data-sveltekit-reload=""><div class="action-content svelte-1b34qkx"><span class="action-title svelte-1b34qkx">Score Another Location</span> <span class="action-desc svelte-1b34qkx">Try a different address for the same concept</span></div> <span class="action-arrow svelte-1b34qkx">→</span></a> <a${attr("href", `/app/location?addr=${stringify(encodeURIComponent(data().recap.lastAddress || ""))}`)} class="action-card location-iq svelte-1b34qkx" data-sveltekit-reload=""><div class="action-content svelte-1b34qkx"><span class="action-title svelte-1b34qkx">View Your Score</span> <span class="action-desc svelte-1b34qkx">See your full analysis for ${escape_html(data().recap.lastAddress)}</span></div> <span class="action-arrow svelte-1b34qkx">→</span></a>`);
    } else if (isReadyToScore()) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<a href="/app/location" class="action-card primary svelte-1b34qkx" data-sveltekit-reload=""><div class="action-content svelte-1b34qkx"><span class="action-title svelte-1b34qkx">Score Your First Location</span> <span class="action-desc svelte-1b34qkx">Your concept is ready — enter an address and get your score</span></div> <span class="action-arrow svelte-1b34qkx">→</span></a>`);
    } else if (isIncomplete()) {
      $$renderer2.push("<!--[2-->");
      $$renderer2.push(`<a href="/app/onboarding" class="action-card primary svelte-1b34qkx" data-sveltekit-reload=""><div class="action-content svelte-1b34qkx"><span class="action-title svelte-1b34qkx">Continue Where You Left Off</span> <span class="action-desc svelte-1b34qkx">Finish your concept profile and score a location</span></div> <span class="action-arrow svelte-1b34qkx">→</span></a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<a href="/app/location" class="action-card primary svelte-1b34qkx" data-sveltekit-reload=""><div class="action-content svelte-1b34qkx"><span class="action-title svelte-1b34qkx">Score Your First Location</span> <span class="action-desc svelte-1b34qkx">Enter an address and get your location intelligence report</span></div> <span class="action-arrow svelte-1b34qkx">→</span></a>`);
    }
    $$renderer2.push(`<!--]--> <button class="action-card secondary svelte-1b34qkx"><div class="action-content svelte-1b34qkx"><span class="action-title svelte-1b34qkx">Evaluate a New Concept</span> <span class="action-desc svelte-1b34qkx">Start fresh with a different business idea</span></div> <span class="action-arrow svelte-1b34qkx">→</span></button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
