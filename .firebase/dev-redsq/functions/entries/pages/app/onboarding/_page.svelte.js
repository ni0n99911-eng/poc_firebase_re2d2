import { h as head, j as ensure_array_like, c as attr_class, e as escape_html, k as attr_style, i as stringify, b as attr, d as derived } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/client2.js";
import { N as NavigationDrawer } from "../../../../chunks/NavigationDrawer.js";
import { s as sanitizeCopilotText } from "../../../../chunks/copilot-sanitize.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let phase = "welcome";
    let messages = [];
    let inputValue = "";
    const steps = [
      // UX-24: stepper label rename — more direct
      {
        id: 1,
        title: "Concept",
        subtitle: "What you're building · your edge"
      },
      {
        id: 2,
        title: "Plan",
        subtitle: "Startup capital · rent ceiling"
      },
      {
        id: 3,
        title: "Location",
        subtitle: "The block you're considering"
      },
      {
        id: 4,
        title: "Profile",
        subtitle: "Your operator background"
      },
      { id: 5, title: "Verdict", subtitle: "Your scored result" }
    ];
    let fitAnswers = {
      ownerType: "",
      riskTolerance: "",
      experience: "",
      targetCustomer: "",
      operatingHours: ""
    };
    let fitQuestionsAnswered = derived(() => Object.values(fitAnswers).filter((v) => v).length);
    let skippedSteps = /* @__PURE__ */ new Set();
    let activeStep = derived(() => {
      switch (phase) {
        case "welcome":
        case "q1_business":
        case "q1b_restaurant_subtype":
        case "q1b_fitness_subtype":
        case "q1b_retail_subtype":
        case "q1c_price_level":
          return 1;
        case "q2_differentiator":
        case "q2b_vision_tier":
        case "q2c_street_level":
        case "q2d_avg_ticket":
          return 1;
        case "q3_budget":
          return 2;
        case "q4_rent":
          return 2;
        case "q5_address":
        case "address_decision":
        case "address_disambiguate":
        case "address_confirm":
          return 3;
        case "fit_q1":
        case "fit_q2":
        case "fit_q3":
        case "fit_q4":
        case "fit_q5":
          return 4;
        case "handoff":
        case "fit_complete":
          return 5;
        default:
          return 1;
      }
    });
    let progressPercent = derived(() => (activeStep() - 1) / (steps.length - 1) * 100);
    let recapStep = derived(() => {
      return 1;
    });
    let inputPlaceholder = derived(() => "Type your answer...");
    head("2xni46", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Get Started</title>`);
      });
    });
    $$renderer2.push(`<div class="onboarding-shell svelte-2xni46">`);
    NavigationDrawer($$renderer2, {});
    $$renderer2.push(`<!----> <div class="onboarding-layout svelte-2xni46"><aside class="progress-panel svelte-2xni46"><div class="progress-panel-inner svelte-2xni46"><div class="stepper-vertical svelte-2xni46"><!--[-->`);
    const each_array = ensure_array_like(steps);
    for (let idx = 0, $$length = each_array.length; idx < $$length; idx++) {
      let step = each_array[idx];
      const isCompleted = activeStep() > step.id;
      const isCurrent = activeStep() === step.id;
      const isFuture = activeStep() < step.id;
      const isSkipped = skippedSteps.has(step.id);
      $$renderer2.push(`<div${attr_class("stepper-item svelte-2xni46", void 0, {
        "completed": isCompleted && !isSkipped,
        "skipped": isSkipped,
        "current": isCurrent,
        "future": isFuture
      })}><div class="stepper-dot svelte-2xni46">`);
      if (isSkipped) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="skip-mark svelte-2xni46">–</span>`);
      } else if (isCompleted) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<span class="check-mark svelte-2xni46">✓</span>`);
      } else if (isCurrent) {
        $$renderer2.push("<!--[2-->");
        $$renderer2.push(`<span class="pulse-dot svelte-2xni46"></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="future-dot svelte-2xni46"></span>`);
      }
      $$renderer2.push(`<!--]--></div> <div class="stepper-label svelte-2xni46"><div class="stepper-title svelte-2xni46">${escape_html(step.title)}</div> `);
      if (isSkipped) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="stepper-subtitle skipped-label svelte-2xni46">Skipped</div>`);
      } else if (step.id === 4 && activeStep() >= 4) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<div class="stepper-progress svelte-2xni46">${escape_html(fitQuestionsAnswered())} of 5 questions</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="stepper-subtitle svelte-2xni46">${escape_html(step.subtitle)}</div>`);
      }
      $$renderer2.push(`<!--]--></div></div> `);
      if (idx < steps.length - 1) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div${attr_class("stepper-connector svelte-2xni46", void 0, { "active": isCompleted })}></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div> <div class="journey-unlock svelte-2xni46"><div class="journey-divider svelte-2xni46"><span class="journey-divider-label svelte-2xni46">What you'll unlock</span></div> <div class="journey-items svelte-2xni46"><div class="journey-item ready svelte-2xni46"><div class="journey-dot svelte-2xni46"><svg viewBox="0 0 16 16" width="10" height="10" fill="none" class="svelte-2xni46"><path d="M3 8.5L6.5 12L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-2xni46"></path></svg></div> <div class="journey-label svelte-2xni46"><span class="journey-title svelte-2xni46">Business Plan</span> <span class="journey-tag ready-tag svelte-2xni46">Ready</span></div></div> <div class="journey-connector-mini svelte-2xni46"></div> <div class="journey-item soon svelte-2xni46"><div class="journey-dot svelte-2xni46"></div> <div class="journey-label svelte-2xni46"><span class="journey-title svelte-2xni46">Site IQ</span> <span class="journey-tag soon-tag svelte-2xni46">Soon</span></div></div> <div class="journey-connector-mini svelte-2xni46"></div> <div class="journey-item soon svelte-2xni46"><div class="journey-dot svelte-2xni46"></div> <div class="journey-label svelte-2xni46"><span class="journey-title svelte-2xni46">Loan Package</span> <span class="journey-tag soon-tag svelte-2xni46">Soon</span></div></div></div></div></div></aside> <aside class="recap-panel svelte-2xni46"><div class="recap-header svelte-2xni46"><span class="recap-logo svelte-2xni46">RE<sup class="recap-super svelte-2xni46">²</sup></span> <span class="recap-badge svelte-2xni46">Live Recap</span></div> <div class="recap-progress svelte-2xni46"><div class="progress-bar svelte-2xni46"><div class="progress-fill svelte-2xni46"${attr_style(`width: ${stringify(progressPercent())}%`)}></div></div> <span class="progress-label svelte-2xni46">${escape_html(recapStep())} of 6</span></div> <div class="recap-sections svelte-2xni46">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="recap-section empty svelte-2xni46"><div class="recap-section-header svelte-2xni46"><span class="recap-section-icon svelte-2xni46">💡</span> <span class="recap-section-title svelte-2xni46">Your Concept</span></div> <div class="recap-placeholder svelte-2xni46">Waiting for your answer...</div></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (activeStep() >= 3) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="recap-section empty svelte-2xni46"><div class="recap-section-header svelte-2xni46"><span class="recap-section-icon svelte-2xni46">💰</span> <span class="recap-section-title svelte-2xni46">Your Budget</span></div> <div class="recap-placeholder svelte-2xni46">${escape_html(skippedSteps.has(2) ? "— Skipped —" : "Coming up next...")}</div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (fitQuestionsAnswered() > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="recap-section filled svelte-2xni46"><div class="recap-section-header svelte-2xni46"><span class="recap-section-icon svelte-2xni46">⚡</span> <span class="recap-section-title svelte-2xni46">Your Fit Profile</span></div> `);
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
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="recap-trust svelte-2xni46"><div class="trust-item svelte-2xni46">✓ No payment required</div> <div class="trust-item svelte-2xni46">✓ 20 live NYC data sources</div> <div class="trust-item svelte-2xni46">✓ Your data stays private</div> <div class="trust-item svelte-2xni46">✓ Results in under 2 min</div></div>`);
    }
    $$renderer2.push(`<!--]--> <div class="recap-footer svelte-2xni46"><p class="svelte-2xni46">Under 2 minutes. Your data is saved automatically.</p></div></aside> <div class="chat-panel svelte-2xni46"><div class="chat-header svelte-2xni46"><div class="header-left svelte-2xni46"><a href="/app/welcome-back" class="back-link svelte-2xni46" aria-label="Back to dashboard"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-2xni46"><polyline points="15 18 9 12 15 6" class="svelte-2xni46"></polyline></svg></a> <span class="online-dot svelte-2xni46"></span> <div class="header-info svelte-2xni46"><span class="header-name svelte-2xni46">RE2D2</span> <span class="header-role svelte-2xni46">Ask me anything about this address.</span></div></div> <div class="header-actions svelte-2xni46">`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> <div class="chat-messages svelte-2xni46"><div class="messages-inner svelte-2xni46">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mission-canvas svelte-2xni46">`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="briefing-card briefing-state-1 svelte-2xni46"><p class="briefing-headline svelte-2xni46">Your lease is your biggest bet.</p> <div class="mb-equation svelte-2xni46"><div class="mb-eq-label svelte-2xni46">One score. 19 data sources. Your answer.</div> <div class="mb-eq-cta svelte-2xni46">We analyze foot traffic, competition, rent, demographics, safety, transit, and more — then calibrate everything to your specific concept. You get one number out of 100, a plain-English verdict, and the top 3 things you can do to improve your chances.</div></div> <div class="mb-example-card svelte-2xni46"><div class="mb-ex-label svelte-2xni46">What you'll get</div> <div class="mb-ex-scores svelte-2xni46"><div class="mb-ex-score svelte-2xni46"><div class="mb-ex-num svelte-2xni46" style="color:#1a3a2a">72</div> <div class="mb-ex-name svelte-2xni46">Score (B)</div></div></div> <div class="mb-ex-verdict svelte-2xni46">Viable. Plus the 3 things to fix.</div></div> <div class="mb-honest-strip svelte-2xni46">We don't predict success. We give you a data-backed view of the risk — before you sign anything.</div> <div class="briefing-proof svelte-2xni46"><span class="svelte-2xni46">20 live data sources</span> <span class="bp-dot svelte-2xni46">·</span> <span class="svelte-2xni46">NYC-specific scoring</span> <span class="bp-dot svelte-2xni46">·</span> <span class="svelte-2xni46">~2 min</span></div></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array_2 = ensure_array_like(messages);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let msg = each_array_2[$$index_2];
      $$renderer2.push(`<div${attr_class(`bubble-row ${stringify(msg.role)}`, "svelte-2xni46")}>`);
      if (msg.role === "bot") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="avatar svelte-2xni46"><span class="avatar-text svelte-2xni46">D2</span></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div${attr_class(`bubble ${stringify(msg.role)}`, "svelte-2xni46")}>${escape_html(sanitizeCopilotText(msg.text))}</div></div>`);
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
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="chat-input-container svelte-2xni46"><div class="input-wrapper svelte-2xni46"><form class="input-form svelte-2xni46"><input type="text"${attr_class("chat-input svelte-2xni46", void 0, { "address-phase": phase === "q5_address" })}${attr("value", inputValue)}${attr("placeholder", inputPlaceholder())} autocomplete="off"/> <button type="submit" class="send-btn svelte-2xni46"${attr("disabled", !inputValue.trim(), true)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svelte-2xni46"><line x1="22" y1="2" x2="11" y2="13" class="svelte-2xni46"></line><polygon points="22 2 15 22 11 13 2 9 22 2" class="svelte-2xni46"></polygon></svg></button></form> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
  });
}
export {
  _page as default
};
