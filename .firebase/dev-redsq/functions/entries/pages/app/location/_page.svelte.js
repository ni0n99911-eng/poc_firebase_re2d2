import { c as attr_class, ac as bind_props, e as escape_html, b as attr, d as derived, i as stringify, j as ensure_array_like, ad as clsx, k as attr_style, ab as setContext, h as head } from "../../../../chunks/index2.js";
import { o as onDestroy, t as tick } from "../../../../chunks/index-server.js";
import { p as page } from "../../../../chunks/index4.js";
import "clsx";
import "maplibre-gl";
/* empty css                                                       */
import { t as tierFor, f as fitTierLabel, h as fitGradeCapped, i as fitMeaning, j as fitVerdictShort, c as fitNextTier, a as fitGrade, k as tierLabelFor, l as confidenceTier, g as getDecisionState, m as getEvidencePayload, n as getConceptCoaching, b as blockTierLabel } from "../../../../chunks/decision-engine.js";
import { a as sanitizeHtml, s as sanitizeCopilotText } from "../../../../chunks/copilot-sanitize.js";
import { h as html } from "../../../../chunks/html.js";
import { f as formatConcept } from "../../../../chunks/conceptNames.js";
import { B as BUSINESS_TYPE_CONFIGS, n as normalizeBusinessType } from "../../../../chunks/business-type-registry.js";
import { K as KILL_FACTOR_THRESHOLDS, H as HEADS_UP_WATCH_TIERS, e as HEADS_UP_SEVERITY, P as PRICE_LEVEL_TO_COFFEE } from "../../../../chunks/scoring-thresholds.js";
import { loadLaunchPadData } from "../../../../chunks/launchpad-store.js";
import { N as NavigationDrawer } from "../../../../chunks/NavigationDrawer.js";
import { a as authedFetch } from "../../../../chunks/authed-fetch.js";
import { g as getConceptDefaults } from "../../../../chunks/conceptDefaults.js";
import { g as getConceptLabel } from "../../../../chunks/concepts.js";
import { C as CONCEPT_KPIS, a as getLocationWeights } from "../../../../chunks/conceptKPIs.js";
import { g as getNeighborhoodBuzz, t as trendArrow, b as buzzLabel } from "../../../../chunks/neighborhoodBuzz.js";
import { d as getWhyBulletsV2, e as getCanonicalScores } from "../../../../chunks/scoring-utils.svelte.js";
import { P as PageNav } from "../../../../chunks/PageNav.js";
import { c as conceptRevenueModel, p as pulseNarrative, a as pulseTier } from "../../../../chunks/primitives.js";
const WEIGHT_PROFILES = {
  "Specialty Coffee / Café": { w: { L0: 8, L1: 12, L2: 28, L3: 18, L4: 14, L5: 12, L6: 8 }, insight: "Foot traffic IS the business. Walk-shed within 3-4 min determines your transaction ceiling." },
  "Restaurant / Fast Casual": { w: { L0: 10, L1: 12, L2: 25, L3: 20, L4: 15, L5: 10, L6: 8 }, insight: "Restaurants are unit economics machines. The margin between success and failure is razor-thin." },
  "Retail Store": { w: { L0: 12, L1: 14, L2: 28, L3: 18, L4: 8, L5: 12, L6: 8 }, insight: "Retail is a visibility game. Your storefront IS your marketing." },
  "Fitness / Wellness Studio": { w: { L0: 8, L1: 10, L2: 20, L3: 22, L4: 18, L5: 14, L6: 8 }, insight: "Instructors ARE the product. A great trainer in a mediocre location beats a mediocre trainer anywhere." },
  "Professional Services": { w: { L0: 6, L1: 18, L2: 10, L3: 22, L4: 20, L5: 14, L6: 10 }, insight: "Your people ARE your product. Talent attraction and city policy shape everything." },
  "Grocery / Specialty Food": { w: { L0: 15, L1: 14, L2: 22, L3: 20, L4: 8, L5: 12, L6: 9 }, insight: "Grocery margins are 1-3%. A 1% inflation shift can wipe out profit." },
  "Barbershop / Salon": { w: { L0: 6, L1: 10, L2: 22, L3: 18, L4: 22, L5: 14, L6: 8 }, insight: "When a great stylist leaves, they take their clients. Retention IS survival." },
  "Other": { w: { L0: 8, L1: 15, L2: 25, L3: 18, L4: 12, L5: 12, L6: 10 }, insight: "Balanced defaults. Customize weights based on what matters most for your business." }
};
function defaultLayerScores() {
  return {
    L0: {
      score: 72,
      factors: [
        { name: "Fed Rate Environment", value: "3.5-3.75%", score: 65, detail: "Elevated rates increase borrowing costs for buildout", override: null },
        { name: "F&B Inflation", value: "3.1-5.2%", score: 58, detail: "Food-away-from-home inflation at 4.0% YoY", override: null },
        { name: "Wellness Spending", value: "+13% YoY", score: 92, detail: "Only category with net-positive spending intent in 2026", override: null },
        { name: "Protein Demand", value: "57%", score: 88, detail: "57% of consumers prioritizing protein intake", override: null }
      ]
    },
    L1: {
      score: 61,
      factors: [
        { name: "Minimum Wage", value: "$17/hr", score: 45, detail: "NYC $17/hr; tipped food workers $11.35/hr + tip credit", override: null },
        { name: "SMB Friendliness", value: "50th", score: 32, detail: "NY ranked last nationally for small biz friendliness", override: null },
        { name: "Workforce Availability", value: "Strong", score: 78, detail: "Record employment; food services sector growing", override: null },
        { name: "City Stability", value: "Stable", score: 85, detail: "Manhattan employment +14.2% (265K workers) 2021-2023", override: null },
        { name: "Vacancy Rate", value: "14.2%", score: 65, detail: "Manhattan storefront vacancy — moderate availability", override: null }
      ]
    },
    L2: { score: 0, factors: [] },
    L3: { score: 0, factors: [] },
    L4: {
      score: 68,
      factors: [
        { name: "Wage Benchmark", value: "$17-24/hr", score: 55, detail: "NYC barista wages; tips add $200-500/week", override: null },
        { name: "Commute Feasibility", value: "TBD", score: 70, detail: "Depends on location transit access", override: null },
        { name: "Employee Safety", value: "TBD", score: 70, detail: "Depends on block-level crime data", override: null },
        { name: "Talent Pool Depth", value: "Strong", score: 72, detail: "Large hospitality workforce; high competition", override: null }
      ]
    },
    L5: {
      score: 63,
      factors: [
        { name: "Substitution Risk", value: "Medium", score: 55, detail: "Depends on competitor density at location", override: null },
        { name: "Customer Loyalty", value: "Medium", score: 65, detail: "Niche positioning builds stronger loyalty", override: null },
        { name: "Recovery-from-Disruption", value: "Moderate", score: 60, detail: "How fast can you bounce back from a closure?", override: null },
        { name: "Dependency Risk", value: "Moderate", score: 58, detail: "Revenue concentration on specific customer segments", override: null },
        { name: "Seasonal Variance", value: "Low-Med", score: 75, detail: "Year-round appeal assessment", override: null }
      ]
    },
    L6: {
      score: 70,
      factors: [
        { name: "Scaffolding Risk", value: "TBD", score: 60, detail: "Active construction or sidewalk sheds", override: null },
        { name: "DOB Violations", value: "Check", score: 65, detail: "Building-specific violation history", override: null },
        { name: "Slip/Trip Risk", value: "TBD", score: 75, detail: "Sidewalk condition, ice liability", override: null },
        { name: "Zoning Compliance", value: "TBD", score: 80, detail: "Zoning permits food service", override: null }
      ]
    }
  };
}
function getConceptScanRadius(bizCategory) {
  const CONCEPT_RADII = {
    // Impulse (3 min walk = ~250m)
    coffee: 250,
    specialty_coffee: 250,
    // Impulse/planned (5 min walk = ~400m)
    bakery: 350,
    "fast-casual": 400,
    qsr: 400,
    deli: 350,
    // Planned (10 min walk = ~800m)
    restaurant: 500,
    full_service_restaurant: 500,
    grocery: 800,
    florist: 500,
    // Routine/destination (15 min walk = ~1200m)
    fitness: 600,
    fitness_studio: 600,
    personal_services: 500,
    salon: 500,
    // Destination (15-30 min = wide)
    bar: 600,
    bar_nightlife: 600,
    medical: 600,
    medical_office: 600,
    // Comparison shopping
    retail: 500,
    boutique: 500,
    // Coworking
    coworking: 600
  };
  const key = bizCategory.toLowerCase().replace(/[\s\/]+/g, "-");
  return CONCEPT_RADII[key] || CONCEPT_RADII[bizCategory] || 400;
}
function backgroundSync(opts) {
  if (typeof window === "undefined") return;
  Promise.resolve().then(async () => {
    try {
      const rawSession = localStorage.getItem("re2_session");
      const rawLaunchpad = localStorage.getItem("re2_launchpad");
      const session = rawSession ? JSON.parse(rawSession) : null;
      const launchpad = rawLaunchpad ? JSON.parse(rawLaunchpad) : null;
      if (!session && !launchpad) return;
      const journeyState = {
        locationScored: (session?.locationIQ ?? 0) > 0,
        financialsVisited: localStorage.getItem("re2_financials_visited") === "true",
        modelVisited: localStorage.getItem("re2_model_visited") === "true",
        businessPlanGenerated: session?.businessPlanGenerated === true,
        lastTrigger: opts?.trigger ?? "unknown",
        lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const shortlistedLocations = launchpad?.scoredLocations ?? [];
      const body = { journeyState, shortlistedLocations };
      if (session) body.session = session;
      if (launchpad) body.launchpad = launchpad;
      const res = await fetch("/api/session-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        // 8s timeout — enough for slow connections, doesn't block UX
        signal: AbortSignal.timeout(8e3)
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("re2:synced", {
          detail: { trigger: opts?.trigger, ok: true }
        }));
      }
    } catch {
    }
  });
}
const MAX_RETRIES = 1;
async function apiFetch(url, options) {
  const timeout = options?.timeout ?? 25e3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.status === 401 && attempt < MAX_RETRIES) {
        const refreshed = await refreshSession();
        if (refreshed) continue;
        return res;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(`Request timed out (${timeout / 1e3}s)`);
      }
      if (attempt < MAX_RETRIES) {
        await sleep(500);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unexpected: all retries exhausted");
}
async function refreshSession() {
  try {
    if (typeof window !== "undefined" && window.Clerk?.session) {
      const token = await window.Clerk.session.getToken();
      if (token) {
        return true;
      }
    }
    const res = await fetch("/", {
      method: "HEAD",
      credentials: "same-origin",
      cache: "no-cache"
    });
    return res.ok;
  } catch {
    return false;
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function MapView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const {
      lat = 40.758,
      lng = -73.9855,
      zoom = 12,
      competitors = [],
      compact = false,
      showPin = false
    } = $$props;
    onDestroy(() => {
    });
    function resize() {
    }
    $$renderer2.push(`<div${attr_class("map-container svelte-njbu1f", void 0, { "compact": compact })}></div>`);
    bind_props($$props, { resize });
  });
}
function ScoreMetaLine($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      scoredAt = null,
      surface = "card",
      driftDot = false
    } = $$props;
    let state = "default";
    function relativeDate(ts) {
      if (!ts) return "—";
      const t = typeof ts === "number" ? ts : isFinite(Number(ts)) ? Number(ts) : new Date(ts).getTime();
      if (!t || isNaN(t)) return "—";
      const diff = Date.now() - t;
      const mins = Math.floor(diff / 6e4);
      if (mins < 60) return mins <= 1 ? "today" : `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return "today";
      const days = Math.floor(hrs / 24);
      if (days === 1) return "yesterday";
      if (days < 7) return `${days} days ago`;
      if (days < 14) return "last week";
      const d = new Date(t);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    let displayDate = derived(() => relativeDate(scoredAt));
    let rescoreHoverTitle = derived(() => {
      if (!scoredAt) return "Re-run scoring against the latest data.";
      const t = typeof scoredAt === "number" ? scoredAt : isFinite(Number(scoredAt)) ? Number(scoredAt) : new Date(scoredAt).getTime();
      if (!t || isNaN(t)) return "Re-run scoring against the latest data.";
      const ageHours = Math.max(0, (Date.now() - t) / 36e5);
      let ageStr;
      if (ageHours < 1) ageStr = `${Math.max(1, Math.round(ageHours * 60))} minutes ago`;
      else if (ageHours < 24) ageStr = `${Math.round(ageHours)} hours ago`;
      else ageStr = `${Math.round(ageHours / 24)} days ago`;
      return `Last scored ${ageStr}. Click to refresh if you want the latest Foursquare, census, and permit data.`;
    });
    const STALE_MS = 24 * 60 * 60 * 1e3;
    let isStale = derived(() => (() => {
      if (!scoredAt || state === "success") return false;
      const t = typeof scoredAt === "number" ? scoredAt : isFinite(Number(scoredAt)) ? Number(scoredAt) : new Date(scoredAt).getTime();
      if (!t || isNaN(t)) return false;
      return Date.now() - t > STALE_MS;
    })());
    onDestroy(() => {
    });
    $$renderer2.push(`<div${attr_class(`score-meta-line score-meta-line--${stringify(surface)} score-meta-line--${stringify(state)}`, "svelte-byt9od", { "has-drift": driftDot || state === "drift" })} role="button" tabindex="0" aria-label="Score snapshot info">`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <span class="ml-date svelte-byt9od">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`Scored ${escape_html(displayDate())}`);
    }
    $$renderer2.push(`<!--]--></span> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="ml-sep svelte-byt9od" aria-hidden="true">·</span> <button class="ml-rescore svelte-byt9od"${attr("disabled", state === "loading", true)} aria-label="Re-score this location"${attr("title", rescoreHoverTitle())} type="button">Re-score ↻</button> `);
      if (isStale()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="ml-stale-badge svelte-byt9od" title="Score is over 24 hours old — neighborhood data may have changed">Score may be outdated</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function LocationContextMap($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { store, compact = true, showPin = true } = $$props;
    MapView($$renderer2, {
      lat: store.mapLat,
      lng: store.mapLng,
      competitors: store.competitors,
      compact,
      showPin
    });
  });
}
function SearchSteps($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      steps = [],
      searchStep = 0,
      searching = false,
      onRetry = () => {
      }
    } = $$props;
    const hasBadStep = steps.some((s) => s.c === "bad");
    if (steps.length) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="steps svelte-1i0sdg7"><!--[-->`);
      const each_array = ensure_array_like(steps);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let s = each_array[$$index];
        $$renderer2.push(`<div${attr_class(clsx(s.c), "svelte-1i0sdg7")}>${escape_html(s.c === "ok" ? "✅" : s.c === "bad" ? "❌" : "⏳")} ${escape_html(s.t)}</div>`);
      }
      $$renderer2.push(`<!--]--> `);
      if (hasBadStep) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button class="retry-btn svelte-1i0sdg7">Try a different address</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (searching) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="loading-progress active svelte-1i0sdg7"><div${attr_class(`loading-progress-bar step${stringify(searchStep)}`, "svelte-1i0sdg7")}></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function RecommendationCards($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { vlfData, glfData, rrData, liveIntel, data, score } = $$props;
    let expandedCard = null;
    let cards = derived(() => {
      const items = [];
      if (vlfData) {
        const fit = vlfData.vlf;
        items.push({
          id: "fit",
          question: "Is this the right location for my business?",
          answer: fit >= 70 ? `Yes — this neighborhood is a strong match for your concept (${fit}/100). The demographics, local market, and customer base align well with what you're building.` : fit >= 50 ? `It could work (${fit}/100). The neighborhood has some good qualities for your concept, but there are gaps you should understand before committing.` : `Probably not (${fit}/100). This neighborhood doesn't match your target customer or concept well. Consider exploring nearby alternatives.`,
          badge: tierFor(fit, "fitIQ").label,
          badgeColor: fit >= 70 ? "green" : fit >= 50 ? "yellow" : "red",
          detail: `Demographic Match: ${vlfData.rule1A}/100 · Neighborhood Fit: ${Math.round(vlfData.rule1B)}/100 · Market Gap: ${Math.round(vlfData.rule1C)}/100 · Trend: ${vlfData.rule1D}/100`,
          tip: fit < 70 ? "Look at what your strongest competitors are doing in this area. If the demographics don't match, consider neighborhoods where your target customer already lives and shops." : "Your concept fits this area well. Focus on differentiating from nearby competitors."
        });
      }
      if (glfData) {
        const fin = glfData.glf;
        const rentOk = glfData.rule2B >= 60;
        items.push({
          id: "money",
          question: "Can I make money here?",
          answer: fin >= 70 ? `The numbers look good (${fin}/100). Revenue potential is solid and rent appears manageable relative to what you can earn here.` : fin >= 50 ? `It's tight (${fin}/100). ${!rentOk ? "Rent may eat too much of your revenue." : "Revenue potential exists but margins will be thin."} You'll need to negotiate well and control costs.` : `It will be hard (${fin}/100). ${!rentOk ? "Rent is very high relative to realistic revenue." : "Revenue potential is limited."} Unless you can get favorable lease terms, this is a tough spot financially.`,
          badge: fin >= 70 ? "Likely Yes" : fin >= 50 ? "Maybe" : "Unlikely",
          badgeColor: fin >= 70 ? "green" : fin >= 50 ? "yellow" : "red",
          detail: `Revenue Potential: ${Math.round(glfData.rule2A)}/100 · Rent Affordability: ${Math.round(glfData.rule2B)}/100 · Break-even: ${Math.round(glfData.rule2C)}/100 · Growth: ${Math.round(glfData.rule2D)}/100 · Talent: ${Math.round(glfData.rule2E)}/100`,
          tip: !rentOk ? "Negotiate hard on rent. Ask for 3-6 months free rent, a percentage-based rent clause, or TI (tenant improvement) allowance to reduce upfront costs." : "Revenue potential is there. Focus on capturing foot traffic early — grand opening events, social media presence, and neighborhood partnerships."
        });
      }
      const compCount = data.cafes.length + data.gyms.length + data.yoga.length + data.health.length;
      const compScore = score.comp;
      items.push({
        id: "competition",
        question: "Is there too much competition?",
        answer: compCount === 0 ? `No competitors found nearby. That could mean untapped demand — or it could mean this area doesn't support your concept. Research why.` : compCount <= 3 ? `${compCount} competitor${compCount > 1 ? "s" : ""} nearby — a healthy amount. There's proven demand without overcrowding.` : compCount <= 6 ? `${compCount} competitors nearby — getting crowded. You'll need a clear reason for customers to choose you over the others.` : `${compCount} competitors nearby — that's a lot. This area is very crowded. You need a very strong differentiator or a different location.`,
        badge: compCount <= 3 ? "Low" : compCount <= 6 ? "Moderate" : "High",
        badgeColor: compCount <= 3 ? "green" : compCount <= 6 ? "yellow" : "red",
        detail: `${compCount} direct competitors · ${data.gyms.length} gyms · ${data.yoga.length} yoga/pilates · ${data.stations.length} transit stations nearby`,
        tip: compCount >= 4 ? "Visit each competitor. Note what they do well and what they miss. Your concept needs to fill a gap they don't cover — pricing, hours, product, or experience." : "Low competition is a great start. Make sure it's because there's an opportunity, not because others have tried and failed here."
      });
      if (liveIntel?.crime) {
        const safety = liveIntel.crime.crimeScore;
        items.push({
          id: "safety",
          question: "Is it safe for my customers and staff?",
          answer: safety >= 75 ? `Yes — safety score ${safety}/100. This is a low-crime area. Customers and employees will feel comfortable here.` : safety >= 50 ? `Mostly (${safety}/100). Crime rates are moderate. It's fine during the day, but check evening safety if you plan late hours.` : `There are concerns (${safety}/100). Higher crime rates in this area could deter customers and increase your insurance and security costs.`,
          badge: safety >= 75 ? "Safe" : safety >= 50 ? "Moderate" : "Elevated Risk",
          badgeColor: safety >= 75 ? "green" : safety >= 50 ? "yellow" : "red",
          detail: `Safety Score: ${safety}/100` + (liveIntel.walkScore ? ` · Walk Score: ${liveIntel.walkScore.walkScore} · Transit Score: ${liveIntel.walkScore.transitScore}` : ""),
          tip: safety < 75 ? "Check crime maps for your specific block. Talk to neighboring business owners about their experience. Consider security cameras and good lighting." : "Safety is a strength here. Mention this in your marketing — customers value feeling safe."
        });
      }
      if (rrData) {
        const risk = rrData.rr;
        const mktRisk = rrData.marketRisk ?? rrData.substitutionRisk;
        const execRisk = rrData.executionRisk ?? rrData.riskScore;
        const topRisk = mktRisk < 40 ? "a crowded market (too many competitors covering all price points)" : execRisk < 40 ? "execution risk (high rent burden eats into your margins)" : "general market conditions";
        items.push({
          id: "risks",
          question: "What are the biggest risks?",
          answer: risk >= 75 ? `Risk assessment is strong (${risk}/100). No major red flags. Standard business risks apply, but nothing location-specific stands out.` : risk >= 50 ? `Moderate risk (${risk}/100). The biggest concern is ${topRisk}. Manageable if you plan for it.` : `High risk (${risk}/100). The main risk is ${topRisk}. Address this before signing a lease.`,
          badge: risk >= 75 ? "Low Risk" : risk >= 50 ? "Some Risk" : "High Risk",
          badgeColor: risk >= 75 ? "green" : risk >= 50 ? "yellow" : "red",
          detail: `Market Risk: ${Math.round(mktRisk)}/100 · Execution Risk: ${Math.round(execRisk)}/100 · Est. Rent: $${(rrData.rentEstimate ?? 15e3).toLocaleString()}/mo`,
          tip: risk < 75 ? "Negotiate lease flexibility — shorter initial term with renewal options, assignment clause, and caps on rent escalation. These protect you if things don't work out." : "Your risk profile is manageable. Focus on building a strong first-year plan."
        });
      }
      {
        const weakest = [
          {
            name: "financial feasibility",
            score: glfData?.glf || 50,
            action: "Run a detailed financial model before committing. Use our Financial Model tool to stress-test your numbers."
          },
          {
            name: "neighborhood fit",
            score: vlfData?.vlf || 50,
            action: "Walk the neighborhood at different times. Talk to local business owners. Make sure the vibe matches your concept."
          },
          {
            name: "competitive positioning",
            score: compScore,
            action: "Visit every competitor within walking distance. Document what they charge, how busy they are, and what's missing."
          },
          {
            name: "risk management",
            score: rrData?.rr || 50,
            action: "Get a real estate attorney to review any lease before signing. Ask about building violations, rent escalation, and exit clauses."
          }
        ].sort((a, b) => a.score - b.score);
        items.push({
          id: "nextsteps",
          question: "What should I do first?",
          answer: `Your weakest area is ${weakest[0].name} (${weakest[0].score}/100). Start there. ${weakest[0].action}`,
          badge: "Action Plan",
          badgeColor: "green",
          detail: `Priority 1: ${weakest[0].name} (${weakest[0].score}/100)
Priority 2: ${weakest[1].name} (${weakest[1].score}/100)
Priority 3: ${weakest[2].name} (${weakest[2].score}/100)`,
          tip: "Don't sign anything until you've addressed at least the top 2 priorities. Use RE² tools (Financial Model, Loan Einstein) to build your case."
        });
      }
      return items;
    });
    $$renderer2.push(`<div class="rec-cards svelte-1eudhn4"><div class="rec-header svelte-1eudhn4"><span class="rec-title svelte-1eudhn4">Your Recommendations</span> <span class="rec-subtitle svelte-1eudhn4">Plain answers to the questions that matter</span></div> <!--[-->`);
    const each_array = ensure_array_like(cards());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let card = each_array[$$index];
      $$renderer2.push(`<button${attr_class("qa-card svelte-1eudhn4", void 0, { "expanded": expandedCard === card.id })}><div class="qa-top svelte-1eudhn4"><div class="qa-question svelte-1eudhn4">${escape_html(card.question)}</div> <div${attr_class(`qa-badge ${stringify(card.badgeColor)}`, "svelte-1eudhn4")}>${escape_html(card.badge)}</div></div> <div class="qa-answer svelte-1eudhn4">${escape_html(card.answer)}</div> `);
      if (expandedCard === card.id) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="qa-expanded svelte-1eudhn4"><div class="qa-detail-section svelte-1eudhn4"><div class="qa-detail-label svelte-1eudhn4">Details</div> <div class="qa-detail-text svelte-1eudhn4">${escape_html(card.detail)}</div></div> <div class="qa-tip-section svelte-1eudhn4"><div class="qa-tip-icon svelte-1eudhn4">💡</div> <div class="qa-tip-text svelte-1eudhn4">${escape_html(card.tip)}</div></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="qa-expand-hint svelte-1eudhn4">${escape_html(expandedCard === card.id ? "Show less" : "See details & tips")}</div></button>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function ScoreHybrid($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const {
      locationScore = null,
      alignmentScore = null,
      loading = false,
      verdict = null,
      insight = null
    } = $$props;
    let score = derived(() => locationScore?.score ?? 0);
    let tier = derived(() => tierFor(score(), "locationIQ"));
    let liq = derived(() => locationScore?.score ?? 0);
    let viq = derived(() => alignmentScore?.score ?? 0);
    let viqTier = derived(() => tierFor(viq(), "visionIQ"));
    function tierColor(color) {
      switch (color) {
        case "green":
          return "#10b981";
        case "amber":
          return "#f59e0b";
        case "red":
          return "#ef4444";
        default:
          return "#9ca3af";
      }
    }
    const RADIUS = 56;
    const CIRC = 2 * Math.PI * RADIUS;
    $$renderer2.push(`<div class="sh-container svelte-1cow4qw">`);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sh-shimmer svelte-1cow4qw"></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      if (verdict) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="sh-verdict svelte-1cow4qw">${html(sanitizeHtml(verdict))}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="sh-ring-wrap svelte-1cow4qw"><svg viewBox="0 0 128 128" class="sh-ring-svg svelte-1cow4qw"><circle cx="64" cy="64"${attr("r", RADIUS)} fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="7" class="svelte-1cow4qw"></circle>`);
      if (score() > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<circle cx="64" cy="64"${attr("r", RADIUS)} fill="none"${attr("stroke", tierColor(tier().color))} stroke-width="7" stroke-linecap="round"${attr("stroke-dasharray", CIRC)}${attr("stroke-dashoffset", CIRC * (1 - score() / 100))} style="transform-origin:64px 64px;transform:rotate(-90deg);transition:stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)" class="svelte-1cow4qw"></circle>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></svg> <div class="sh-ring-center svelte-1cow4qw"><div class="sh-ring-num svelte-1cow4qw">${escape_html("—")}</div> <div class="sh-ring-of svelte-1cow4qw">/100</div> <div class="sh-ring-tier svelte-1cow4qw"${attr_style(`color:${stringify(tierColor(tier().color))}`)}>${escape_html(tier().label)}</div></div></div> `);
      if (liq() > 0 || viq() > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="sh-sub-row svelte-1cow4qw">`);
        if (liq() > 0) {
          $$renderer2.push("<!--[0-->");
          const lt = tierFor(liq(), "locationIQ");
          $$renderer2.push(`<div class="sh-sub-pill svelte-1cow4qw"><span class="sh-sub-label svelte-1cow4qw">Location</span> <span class="sh-sub-val svelte-1cow4qw">${escape_html(liq())}</span> <span class="sh-sub-tier svelte-1cow4qw"${attr_style(`color:${stringify(tierColor(lt.color))}`)}>${escape_html(lt.label)}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (viq() > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="sh-sub-pill svelte-1cow4qw"><span class="sh-sub-label svelte-1cow4qw">Concept</span> <span class="sh-sub-val svelte-1cow4qw">${escape_html(viq())}</span> <span class="sh-sub-tier svelte-1cow4qw"${attr_style(`color:${stringify(tierColor(viqTier().color))}`)}>${escape_html(viqTier().label)}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (insight) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="sh-insight svelte-1cow4qw"${attr_style(`border-left-color:${stringify(tierColor(tier().color))}`)}><div class="sh-insight-title svelte-1cow4qw"${attr_style(`color:${stringify(tierColor(tier().color))}`)}>${escape_html(insight.title)}</div> <div class="sh-insight-text svelte-1cow4qw">${escape_html(insight.text)}</div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function FitDimensionRings($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { rings = [], bizType = "your business" } = $$props;
    const size = 80;
    const cx = size / 2;
    const cy = size / 2;
    const strokeW = 8;
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    function getColor(score) {
      const s = score;
      if (s >= 75) return "#4a7c5c";
      if (s >= 50) return "#e8a838";
      return "#e8345a";
    }
    function getDashOffset(score) {
      return circumference * (1 - score / 100);
    }
    let expandedIdx = null;
    if (rings.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="fit-dims svelte-sty5y2"><div class="fit-dims-header svelte-sty5y2"><h3 class="fit-dims-title svelte-sty5y2">Score Breakdown</h3> <span class="fit-dims-subtitle svelte-sty5y2">How ${escape_html(formatConcept(bizType) || bizType)} maps to this location's signals</span></div> <div class="fit-dims-row svelte-sty5y2"><!--[-->`);
      const each_array = ensure_array_like(rings);
      for (let i = 0, $$length = each_array.length; i < $$length; i++) {
        let ring = each_array[i];
        $$renderer2.push(`<button${attr_class("dim-card svelte-sty5y2", void 0, { "expanded": expandedIdx === i, "warn": ring.warn })}><svg${attr("width", size)}${attr("height", size)} class="dim-ring svelte-sty5y2"><circle${attr("cx", cx)}${attr("cy", cy)}${attr("r", radius)} fill="none" stroke="rgba(0,0,0,0.06)"${attr("stroke-width", strokeW)}></circle><circle${attr("cx", cx)}${attr("cy", cy)}${attr("r", radius)} fill="none"${attr("stroke", getColor(ring.score))}${attr("stroke-width", strokeW)} stroke-linecap="round"${attr("stroke-dasharray", circumference)}${attr("stroke-dashoffset", getDashOffset(ring.score))}${attr("transform", `rotate(-90 ${stringify(cx)} ${stringify(cy)})`)} class="dim-arc svelte-sty5y2"></circle><text${attr("x", cx)}${attr("y", cy + 1)} text-anchor="middle" dominant-baseline="central" class="dim-score-text svelte-sty5y2"${attr("fill", getColor(ring.score))}>${escape_html(ring.score)}</text></svg> <div class="dim-label svelte-sty5y2">${escape_html(ring.label)}</div> `);
        if (ring.warn) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="dim-warn-dot svelte-sty5y2"${attr("title", ring.warn)}>!</div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></button>`);
      }
      $$renderer2.push(`<!--]--></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function DataCoverage($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { liveIntel } = $$props;
    const coverageInfo = derived(() => {
      if (!liveIntel) {
        return { available: 0, total: 20, pct: 0, failedSources: [] };
      }
      const coverage = liveIntel.sourceCoverage || { available: 0, total: 20, pct: 0 };
      const failedSources = liveIntel.errors ? liveIntel.errors.map((err) => {
        const match = err.match(/^([^:]+):/);
        return match ? match[1] : err;
      }) : [];
      return { ...coverage, failedSources };
    });
    if (liveIntel && coverageInfo().total > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="data-coverage svelte-1ae0604"><div class="coverage-header svelte-1ae0604"><div class="coverage-label svelte-1ae0604"><span class="coverage-text svelte-1ae0604">${escape_html(coverageInfo().available)} of ${escape_html(coverageInfo().total)} data sources responded</span> <span class="coverage-pct svelte-1ae0604">${escape_html(coverageInfo().pct)}%</span></div> <div class="coverage-bar svelte-1ae0604"><div class="coverage-fill svelte-1ae0604"${attr_style(`width: ${stringify(coverageInfo().pct)}%`)}></div></div> `);
      if (coverageInfo().failedSources.length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="coverage-toggle svelte-1ae0604"><span class="toggle-icon svelte-1ae0604">${escape_html("▶")}</span></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function registryWeightsFor(canonicalKey) {
  const w = BUSINESS_TYPE_CONFIGS[canonicalKey]?.weights;
  if (!w) return { transit: 0.17, competition: 0.17, demographics: 0.17, vibrancy: 0.17, safety: 0.16, momentum: 0.16 };
  const sub = { transit: w.transit, competition: w.competition, demographics: w.demographics, vibrancy: w.vibrancy, safety: w.safety, momentum: w.momentum };
  const total = Object.values(sub).reduce((a, b) => a + b, 0);
  const norm = (v) => Math.round(v / total * 1e3) / 1e3;
  return { transit: norm(sub.transit), competition: norm(sub.competition), demographics: norm(sub.demographics), vibrancy: norm(sub.vibrancy), safety: norm(sub.safety), momentum: norm(sub.momentum) };
}
({
  coffee: registryWeightsFor("specialty_coffee"),
  restaurant: registryWeightsFor("full_service_restaurant"),
  gym: registryWeightsFor("fitness_studio"),
  dentist: registryWeightsFor("medical_office"),
  spa: registryWeightsFor("wellness_spa"),
  bodega: registryWeightsFor("retail"),
  bakery: registryWeightsFor("bakery"),
  barber: registryWeightsFor("personal_services"),
  boutique: registryWeightsFor("retail"),
  florist: registryWeightsFor("florist")
});
function FeedbackButton($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      sectionId = "",
      itemId = "",
      sessionId = "",
      personaType = "",
      onFeedback = (_type, _section) => {
      }
    } = $$props;
    let voted = null;
    let persisting = false;
    $$renderer2.push(`<div class="feedback-row svelte-86xzc9"><span class="feedback-label svelte-86xzc9">Was this helpful?</span> <div class="feedback-buttons svelte-86xzc9"><button${attr_class("fb-btn svelte-86xzc9", void 0, { "active": voted === "up" })} title="Helpful"${attr("disabled", persisting, true)}>👍</button> <button${attr_class("fb-btn svelte-86xzc9", void 0, { "active": voted === "down" })} title="Not helpful"${attr("disabled", persisting, true)}>👎</button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
const LENS_ICON = {
  transit: "🚇",
  safety: "🛡️",
  demographics: "👥",
  competition: "🏪",
  vibrancy: "🏙️",
  momentum: "📈"
};
const UNIVERSAL_TITLE_TO_DIMENSION = {
  "Safety Concern": "safety",
  "Limited Transit Access": "transit",
  "Crowded Market": "competition",
  "Demographics Mismatch": "demographics",
  "Quiet Concept Pulse": "vibrancy",
  "Declining Area Momentum": "momentum",
  "Hot Market — Expect Rent Pressure": "momentum"
};
function warningsFromLenses(lenses, existing = []) {
  if (!lenses || lenses.length === 0) return [];
  const covered = /* @__PURE__ */ new Set();
  for (const w of existing) {
    if (w.dimension) covered.add(w.dimension);
    const mapped = UNIVERSAL_TITLE_TO_DIMENSION[w.title];
    if (mapped) covered.add(mapped);
  }
  const out = [];
  for (const lens of lenses) {
    if (!HEADS_UP_WATCH_TIERS.includes(lens.tier)) continue;
    if (covered.has(lens.dimension)) continue;
    let severity = HEADS_UP_SEVERITY[lens.tier] ?? "info";
    if (lens.tier === "Average" && lens.score < 38) {
      severity = "important";
    }
    out.push({
      icon: LENS_ICON[lens.dimension] || (severity === "info" ? "ℹ️" : "⚠️"),
      title: `${lens.label} — ${lens.tier} (${lens.score}/100)`,
      description: lens.verdictLine,
      severity,
      source: "lens",
      dimension: lens.dimension
    });
    covered.add(lens.dimension);
  }
  return out;
}
function normalizePersonaKey(key) {
  const map = {
    // ── Legacy persona keys (v3) — pass through unchanged ──
    coffee_shop: "coffee_shop",
    restaurant: "restaurant",
    florist: "florist",
    medical_dental: "medical_dental",
    spa_wellness: "spa_wellness",
    fitness: "fitness",
    barbershop: "barbershop",
    retail: "retail",
    something_else: "something_else",
    // ── Short aliases ──
    coffee: "coffee_shop",
    cafe: "coffee_shop",
    café: "coffee_shop",
    gym: "fitness",
    yoga: "fitness",
    crossfit: "fitness",
    dentist: "medical_dental",
    dental: "medical_dental",
    medical: "medical_dental",
    spa: "spa_wellness",
    salon: "spa_wellness",
    barber: "barbershop",
    grooming: "barbershop",
    boutique: "retail",
    fashion: "retail",
    bodega: "retail",
    // ── B3-NEW-2: Canonical concept keys from normalizeConceptKey() ──
    // These are what AddressAnalyzer.svelte and HeadsUpCards.svelte pass after B3-2.1.
    specialty_coffee: "coffee_shop",
    full_service_restaurant: "restaurant",
    fast_casual: "restaurant",
    qsr: "restaurant",
    fine_dining: "restaurant",
    bakery: "restaurant",
    // closest match — breakfast/pastry warnings overlap
    fitness_studio: "fitness",
    medical_office: "medical_dental",
    wellness_spa: "spa_wellness",
    personal_services: "barbershop",
    // salon/nail/lash — barbershop warnings most relevant
    bar_nightlife: "something_else",
    // no dedicated bar generator yet
    wellness_beverage: "something_else",
    juice_bar: "something_else",
    coworking: "something_else",
    generic: "something_else",
    // SEG-02 underserved segments
    pharmacy: "something_else",
    doggie_daycare: "something_else",
    tutoring: "something_else",
    ethnic_market: "retail"
  };
  return map[key?.toLowerCase()] || "something_else";
}
function generateHeadsUpWarnings(personaKey, questionAnswers, scoringData) {
  const warnings = [];
  const normalized = normalizePersonaKey(personaKey);
  switch (normalized) {
    case "coffee_shop":
      warnings.push(...generateCoffeeShopWarnings(questionAnswers));
      break;
    case "restaurant":
      warnings.push(...generateRestaurantWarnings(questionAnswers));
      break;
    case "fitness":
      warnings.push(...generateFitnessWarnings(questionAnswers));
      break;
    case "medical_dental":
      warnings.push(...generateMedicalDentalWarnings(questionAnswers));
      break;
    case "florist":
      warnings.push(...generateFloristWarnings(questionAnswers));
      break;
    case "spa_wellness":
      warnings.push(...generateSpaWellnessWarnings(questionAnswers));
      break;
    case "barbershop":
      warnings.push(...generateBarbershopWarnings(questionAnswers));
      break;
    case "retail":
      warnings.push(...generateRetailWarnings(questionAnswers));
      break;
    case "something_else":
      warnings.push(...generateSomethingElseWarnings(questionAnswers));
      break;
  }
  if (scoringData) {
    if (scoringData.safety !== void 0 && scoringData.safety < 50) {
      warnings.push({
        icon: "⚠️",
        title: "Safety Concern",
        description: "This area has a lower safety score. Visit at night before committing — check lighting, foot traffic, and overall feel.",
        severity: "important"
      });
    }
    if (scoringData.transit !== void 0 && scoringData.transit < 40) {
      warnings.push({
        icon: "🚌",
        title: "Limited Transit Access",
        description: "Limited transit access. Your customers will primarily need to drive or walk — verify parking availability.",
        severity: "info"
      });
    }
    if (scoringData.competition !== void 0 && scoringData.competition < 35) {
      warnings.push({
        icon: "🏪",
        title: "Crowded Market",
        description: "High competitor density in this area. You need a clear differentiator — same-concept stores nearby will split your foot traffic.",
        severity: "important"
      });
    }
    if (scoringData.demographics !== void 0 && scoringData.demographics < 40) {
      warnings.push({
        icon: "📊",
        title: "Demographics Mismatch",
        description: "The local demographics may not align with your target customer. Check household income, age distribution, and daytime population.",
        severity: "important"
      });
    }
    if (scoringData.vibrancy !== void 0 && scoringData.vibrancy < KILL_FACTOR_THRESHOLDS.vibrancy) {
      warnings.push({
        icon: "🚶",
        title: "Quiet Concept Pulse",
        description: "Your concept’s trade-area ring is calm. Works well for destination businesses, bookings, or referral-driven concepts — riskier for walk-in dependent ones that need spillover traffic.",
        severity: "info"
      });
    }
    if (scoringData.momentum !== void 0 && scoringData.momentum < 30) {
      warnings.push({
        icon: "📉",
        title: "Declining Area Momentum",
        description: "Permit activity and new business openings are trending down. This could mean the area is stagnating — or that rents are about to drop.",
        severity: "info"
      });
    }
    if (scoringData.momentum !== void 0 && scoringData.momentum > 85) {
      warnings.push({
        icon: "📈",
        title: "Hot Market — Expect Rent Pressure",
        description: "High momentum area with lots of new activity. Great for foot traffic, but negotiate rent escalation caps — landlords know this block is hot.",
        severity: "info"
      });
    }
    const composite = scoringData.composite ?? Object.values(scoringData).reduce((a, b) => a + b, 0) / Object.keys(scoringData).length;
    if (composite > 80) {
      warnings.push({
        icon: "💡",
        title: "Strong Location — Negotiate Hard",
        description: "This location scores well for your concept. Use that confidence to negotiate: ask for 3 months free rent, a TI allowance, and a kick-out clause at year 3.",
        severity: "info"
      });
    }
  }
  const severityRank = { critical: 3, important: 2, info: 1 };
  warnings.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
  return warnings.slice(0, 5);
}
function generateCoffeeShopWarnings(answers) {
  const warnings = [];
  const serviceModel = answers["service_model"]?.toLowerCase() || "";
  const concept = answers["concept"]?.toLowerCase() || "";
  const espresso = answers["espresso"]?.toLowerCase() === "yes" || concept.includes("espresso");
  if (serviceModel === "sit_down" || espresso) {
    warnings.push({
      icon: "⚡",
      title: "Electrical Panel Capacity",
      description: "Espresso machines need 200-400 amps — most retail spaces have 100-200. Ask the landlord: 'What's the panel capacity and is it single or three-phase?'",
      severity: "critical"
    });
  }
  if (concept.includes("food") || concept.includes("hot food") || concept.includes("kitchen")) {
    warnings.push({
      icon: "🔧",
      title: "Grease Trap & Hood Ventilation",
      description: "Required if you serve hot food. Ask: 'Was this space previously food service?' Existing infrastructure saves $20K-$50K.",
      severity: "important"
    });
  }
  if (serviceModel === "grab_and_go") {
    warnings.push({
      icon: "👥",
      title: "Street Visibility Is Everything",
      description: "Grab-and-go lives or dies on foot traffic and street visibility. Walk the block during your target hours before signing.",
      severity: "info"
    });
  }
  if (concept.includes("pour over") || concept.includes("specialty") || concept.includes("roast")) {
    warnings.push({
      icon: "💧",
      title: "Water Quality & Plumbing",
      description: "Specialty coffee is 98% water. Verify water pressure, install a filtration system, and budget $2K-$5K for plumbing modifications.",
      severity: "important"
    });
  }
  if (serviceModel === "sit_down" || concept.includes("cowork") || concept.includes("laptop")) {
    warnings.push({
      icon: "📶",
      title: "WiFi & Power Outlets",
      description: "Sit-down cafes attract remote workers. Budget for commercial-grade WiFi and additional outlet installation — it drives repeat visits.",
      severity: "info"
    });
  }
  return warnings;
}
function generateRestaurantWarnings(answers) {
  const warnings = [];
  const serviceStyle = answers["service_style"]?.toLowerCase() || "";
  const mealPeriod = answers["meal_period"]?.toLowerCase() || "";
  const pricePoint = answers["price_point"]?.toLowerCase() || "";
  const concept = answers["concept"]?.toLowerCase() || "";
  if (serviceStyle === "full_service") {
    warnings.push({
      icon: "🔥",
      title: "Gas Line & Infrastructure",
      description: "Gas line installation costs $10K-$50K+ if non-existent. Also verify grease trap, hood ventilation, and 3-phase electrical.",
      severity: "critical"
    });
  }
  if (mealPeriod === "late_night") {
    warnings.push({
      icon: "🔊",
      title: "Noise Ordinance Check",
      description: "Late-night operation requires confirming local noise regulations. Weight safety score higher for after-11pm hours.",
      severity: "important"
    });
  }
  if (pricePoint === "fine" || pricePoint === "upscale") {
    warnings.push({
      icon: "🍷",
      title: "Liquor License Timeline",
      description: "NYC liquor license is $4,500+ and takes 3-6 months. Some zones restrict it. Community board approval may be needed.",
      severity: "important"
    });
  }
  if (concept.includes("delivery") || concept.includes("ghost") || concept.includes("takeout")) {
    warnings.push({
      icon: "🚗",
      title: "Loading Zone & Delivery Access",
      description: "Delivery-heavy models need a loading zone or double-parking tolerance. Check if the block has commercial vehicle restrictions.",
      severity: "important"
    });
  }
  if (serviceStyle === "full_service" || concept.includes("outdoor") || concept.includes("patio")) {
    warnings.push({
      icon: "🪑",
      title: "Outdoor Seating Permits",
      description: "NYC Open Restaurants program allows sidewalk/roadway dining. Check if the DOT permits outdoor seating on this block — it can add 30% capacity.",
      severity: "info"
    });
  }
  if (concept.includes("bakery") || concept.includes("pastry") || concept.includes("brunch")) {
    warnings.push({
      icon: "⏰",
      title: "Early Morning Prep Hours",
      description: "Baking and brunch prep starts at 4-5am. Confirm your lease allows early-morning deliveries and equipment operation.",
      severity: "info"
    });
  }
  return warnings;
}
function generateFitnessWarnings(answers) {
  const warnings = [];
  const fitnessType = answers["fitness_type"]?.toLowerCase() || "";
  const peakSchedule = answers["peak_schedule"]?.toLowerCase() || "";
  const concept = answers["concept"]?.toLowerCase() || "";
  if (fitnessType === "crossfit" || fitnessType === "traditional" || concept.includes("weight")) {
    warnings.push({
      icon: "🏋️",
      title: "Floor Load Capacity",
      description: "Heavy equipment like squat racks and platforms require structural floor load verification. Standard retail floors may not support it.",
      severity: "critical"
    });
  }
  if (fitnessType === "boutique" && peakSchedule === "early_morning") {
    warnings.push({
      icon: "❄️",
      title: "HVAC Capacity",
      description: "Standard retail HVAC won't handle 20+ people exercising. Budget $15K-$30K for commercial HVAC upgrades.",
      severity: "important"
    });
  }
  warnings.push({
    icon: "🔊",
    title: "Noise & Soundproofing",
    description: "Check with landlord AND neighbors. Dropping weights, loud music, and early/late classes need soundproofing — budget $10-$20/sqft.",
    severity: "important"
  });
  if (fitnessType === "crossfit" || concept.includes("climbing") || concept.includes("functional")) {
    warnings.push({
      icon: "📐",
      title: "Ceiling Height Requirements",
      description: "Functional fitness needs 14-16ft ceilings minimum for pull-up rigs and rope climbs. Most retail spaces are 10-12ft.",
      severity: "critical"
    });
  }
  if (fitnessType !== "yoga_only") {
    warnings.push({
      icon: "🚿",
      title: "Shower & Locker Plumbing",
      description: "Members expect showers, especially for AM classes. Plumbing buildout for locker rooms costs $30K-$60K — check if existing infrastructure exists.",
      severity: "important"
    });
  }
  if (concept.includes("parking") || fitnessType === "traditional") {
    warnings.push({
      icon: "🅿️",
      title: "Parking Requirements",
      description: "Large-format gyms need dedicated parking. Rule of thumb: 1 space per 200 sqft of gym floor.",
      severity: "info"
    });
  }
  return warnings;
}
function generateMedicalDentalWarnings(answers) {
  const warnings = [];
  const practiceType = answers["practice_type"]?.toLowerCase() || "";
  const patientSource = answers["patient_source"]?.toLowerCase() || "";
  const concept = answers["concept"]?.toLowerCase() || "";
  warnings.push({
    icon: "⚖️",
    title: "Zoning & ADA Compliance",
    description: "Medical use must be explicitly zoned. ADA compliance is mandatory. Dental buildout runs $150-$300/sqft.",
    severity: "critical"
  });
  if (practiceType === "specialty" || concept.includes("oral surgery") || concept.includes("orthodont")) {
    warnings.push({
      icon: "☢️",
      title: "X-ray Shielding & Suction Plumbing",
      description: "Specialty practice needs lead-lined X-ray rooms and centralized suction/compressor systems — plan for a 6-month buildout.",
      severity: "important"
    });
  }
  if (patientSource === "walk_in" || patientSource !== "referral") {
    warnings.push({
      icon: "🅿️",
      title: "Patient Parking",
      description: "Medical offices need accessible parking. Industry standard: 1 space per 125 sqft.",
      severity: "important"
    });
  }
  if (concept.includes("insurance") || concept.includes("medicaid") || patientSource === "insurance") {
    warnings.push({
      icon: "🏥",
      title: "Insurance Network Density",
      description: "If you accept insurance, locate near populations with matching coverage. Medicaid-heavy areas have different unit economics than PPO zones.",
      severity: "info"
    });
  }
  warnings.push({
    icon: "🔒",
    title: "HIPAA-Compliant Layout",
    description: "Reception, treatment rooms, and records storage must meet HIPAA privacy requirements. Factor soundproofing between operatories.",
    severity: "important"
  });
  if (concept.includes("pediatric") || concept.includes("elder") || concept.includes("geriatric")) {
    warnings.push({
      icon: "♿",
      title: "Elevator & Accessibility",
      description: "Pediatric and geriatric practices need ground-floor access or a compliant elevator. Stair-only locations lose patients.",
      severity: "important"
    });
  }
  return warnings;
}
function generateFloristWarnings(answers) {
  const warnings = [];
  const floralFocus = answers["floral_focus"]?.toLowerCase() || "";
  const concept = answers["concept"]?.toLowerCase() || "";
  if (floralFocus === "walk_in" || concept.includes("walk-in") || concept.includes("retail")) {
    warnings.push({
      icon: "👥",
      title: "Street Visibility Critical",
      description: "Foot traffic is king for walk-in floral retail. Weight street visibility heavily when scoring.",
      severity: "important"
    });
  }
  if (floralFocus === "events" || concept.includes("wedding") || concept.includes("event")) {
    warnings.push({
      icon: "📍",
      title: "Venue Proximity",
      description: "Proximity to hospitals and event venues drives 40%+ of revenue for event florists — you can afford a side street.",
      severity: "info"
    });
  }
  warnings.push({
    icon: "❄️",
    title: "Walk-in Cooler Requirements",
    description: "Walk-in cooler needs significant electrical load + potential floor reinforcement. Budget $8K-$15K if not already installed.",
    severity: "important"
  });
  if (floralFocus === "events" || concept.includes("wholesale")) {
    warnings.push({
      icon: "🚚",
      title: "Loading Access for Bulk Deliveries",
      description: "Event and wholesale florists receive large shipments 3-4x per week. Verify there is a loading zone or rear access.",
      severity: "important"
    });
  }
  warnings.push({
    icon: "💧",
    title: "Water & Floor Drainage",
    description: "Flower shops generate constant water runoff. Floor drains and waterproof flooring save you from damage claims.",
    severity: "info"
  });
  return warnings;
}
function generateSpaWellnessWarnings(answers) {
  const warnings = [];
  const spaType = answers["spa_type"]?.toLowerCase() || "";
  const clientele = answers["clientele"]?.toLowerCase() || "";
  const concept = answers["concept"]?.toLowerCase() || "";
  if (spaType === "day_spa" || spaType === "med_spa") {
    warnings.push({
      icon: "💧",
      title: "Plumbing Capacity",
      description: "Simultaneous hot water demand is critical. Locate wet areas near existing plumbing or costs multiply by 3-5x.",
      severity: "critical"
    });
  }
  if (clientele === "luxury" || concept.includes("luxury") || concept.includes("premium")) {
    warnings.push({
      icon: "🔊",
      title: "Soundproofing Requirements",
      description: "Avoid ground floor on busy streets for luxury spa. Check if neighbors include bars, gyms, or construction.",
      severity: "important"
    });
  }
  if (clientele === "luxury" || spaType === "med_spa") {
    warnings.push({
      icon: "🅿️",
      title: "Client Parking",
      description: "Parking is non-negotiable for spa clients — verify nearby lots or street parking availability.",
      severity: "important"
    });
  }
  if (spaType === "med_spa" || concept.includes("medical") || concept.includes("injectable") || concept.includes("laser")) {
    warnings.push({
      icon: "⚖️",
      title: "Medical Spa Licensing",
      description: "Med spas require a supervising physician and specific state licensing. Verify zoning allows medical use.",
      severity: "critical"
    });
  }
  if (concept.includes("nail") || concept.includes("manicure") || concept.includes("pedicure")) {
    warnings.push({
      icon: "🌬️",
      title: "Ventilation for Chemical Use",
      description: "Nail services require enhanced ventilation per OSHA standards. Budget for commercial air exchange systems.",
      severity: "important"
    });
  }
  warnings.push({
    icon: "🧘",
    title: "Ambient Environment Check",
    description: "Visit at your peak hours. Noise from neighboring tenants, street traffic, and vibrations can ruin the spa experience.",
    severity: "info"
  });
  return warnings;
}
function generateBarbershopWarnings(answers) {
  const warnings = [];
  const vibe = answers["vibe"]?.toLowerCase() || "";
  const concept = answers["concept"]?.toLowerCase() || "";
  if (vibe === "premium" || concept.includes("luxury") || concept.includes("premium")) {
    warnings.push({
      icon: "📊",
      title: "Demographics for Premium Positioning",
      description: "Premium barbershops need visible street presence and high-income neighborhoods. Verify the demographics match your $40-$80 price point.",
      severity: "info"
    });
  }
  warnings.push({
    icon: "💧",
    title: "Plumbing for Multiple Stations",
    description: "Each barber station needs its own hot water supply. Verify the space can support your planned chair count.",
    severity: "important"
  });
  warnings.push({
    icon: "👥",
    title: "Walk-in Visibility",
    description: "Barbershops are highly walk-in dependent. Ground-floor with large windows on a foot-traffic street is ideal.",
    severity: "important"
  });
  if (concept.includes("5+ chairs") || concept.includes("large") || concept.includes("team")) {
    warnings.push({
      icon: "🪑",
      title: "Waiting Area Sizing",
      description: "Rule of thumb: waiting area should seat 2x your chair count. A 6-chair shop needs seating for 12 waiting clients.",
      severity: "info"
    });
  }
  warnings.push({
    icon: "📋",
    title: "Barbering License & DOH Compliance",
    description: "NYC requires individual barber licenses and a shop license from the Department of Health. Inspections happen unannounced.",
    severity: "info"
  });
  return warnings;
}
function generateRetailWarnings(answers) {
  const warnings = [];
  const trafficModel = answers["traffic_model"]?.toLowerCase() || "";
  const concept = answers["concept"]?.toLowerCase() || "";
  if (trafficModel === "foot_traffic" || concept.includes("walk-in") || concept.includes("browse")) {
    warnings.push({
      icon: "👥",
      title: "Street-Level Location Critical",
      description: "Street-level with large display windows is critical for foot traffic retail. Basement or second floor kills walk-in conversion.",
      severity: "important"
    });
  }
  warnings.push({
    icon: "📋",
    title: "Co-Tenancy Clause",
    description: "Retail lease tip: negotiate a co-tenancy clause — if the anchor store near you closes, you get rent relief or can exit.",
    severity: "info"
  });
  if (concept.includes("fashion") || concept.includes("boutique") || concept.includes("clothing")) {
    warnings.push({
      icon: "📦",
      title: "Storage for Seasonal Inventory",
      description: "Fashion retail needs dedicated storage (ideally 20-30% of floor area). Verify ceiling height for shelving and back-of-house access.",
      severity: "important"
    });
  }
  if (concept.includes("online") || concept.includes("e-commerce") || concept.includes("ship")) {
    warnings.push({
      icon: "📦",
      title: "Fulfillment-Friendly Layout",
      description: "Hybrid retail-online needs a packing/shipping area. Consider proximity to shipping carriers (UPS, FedEx, USPS) for daily pickups.",
      severity: "info"
    });
  }
  if (concept.includes("jewelry") || concept.includes("electronics") || concept.includes("luxury")) {
    warnings.push({
      icon: "🔒",
      title: "Security Infrastructure",
      description: "High-value inventory needs security gates, cameras, and possibly a safe room. Check if the space has existing security wiring.",
      severity: "important"
    });
  }
  warnings.push({
    icon: "🪧",
    title: "Signage & Awning Permits",
    description: "NYC has strict signage regulations by district. Verify what size/type of signage your block allows before designing your storefront.",
    severity: "info"
  });
  return warnings;
}
function generateSomethingElseWarnings(answers) {
  const warnings = [];
  const concept = answers["concept"]?.toLowerCase() || "";
  warnings.push({
    icon: "⚖️",
    title: "Zoning Verification Required",
    description: "Your business type may have specific zoning requirements. Verify with the NYC Department of Buildings that your intended use is permitted at this address.",
    severity: "critical"
  });
  warnings.push({
    icon: "♿",
    title: "ADA Compliance Check",
    description: "All customer-facing businesses must meet ADA accessibility requirements. Budget for ramps, accessible restrooms, and doorway widths.",
    severity: "important"
  });
  warnings.push({
    icon: "📋",
    title: "Lease Negotiation Essentials",
    description: "Always negotiate: free rent period (2-3 months), tenant improvement allowance ($20-$50/sqft), and an out clause at year 3.",
    severity: "info"
  });
  if (concept.includes("food") || concept.includes("cook") || concept.includes("kitchen") || concept.includes("eat")) {
    warnings.push({
      icon: "🔧",
      title: "Food Service Infrastructure",
      description: "Food service requires grease traps, hood ventilation, and DOH permits. Verify if the space has prior food-use infrastructure.",
      severity: "important"
    });
  }
  return warnings;
}
function HeadsUpCards($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { personaKey, questionAnswers, scoringData, lenses } = $$props;
    let personaWarnings = derived(() => generateHeadsUpWarnings(personaKey, questionAnswers, scoringData));
    let lensWarnings = derived(() => warningsFromLenses(lenses, personaWarnings()));
    const SEVERITY_ORDER = { critical: 0, important: 1, info: 2 };
    let warnings = derived(() => [...personaWarnings(), ...lensWarnings()].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)));
    function severityColor(severity) {
      if (severity === "critical") return "#dc2626";
      if (severity === "important") return "var(--amber, #f59e0b)";
      return "var(--teal, #0d7c6e)";
    }
    function severityBg(severity) {
      if (severity === "critical") return "rgba(220, 38, 38, 0.12)";
      if (severity === "important") return "rgba(180, 83, 9, 0.08)";
      return "rgba(13, 124, 110, 0.08)";
    }
    function severityLabel(severity) {
      if (severity === "critical") return "Deal Breaker";
      if (severity === "important") return "Important";
      return "Good to Know";
    }
    function severityIcon(severity, originalIcon) {
      if (severity === "critical") return "⛔";
      return originalIcon;
    }
    if (warnings().length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="heads-up-section svelte-10y7l5j"><div class="section-header svelte-10y7l5j"><span class="section-icon svelte-10y7l5j">⚠️</span> <div><h3 class="section-title svelte-10y7l5j">Heads Up</h3> <p class="section-sub svelte-10y7l5j">Things to verify before you sign</p></div></div> <div class="warnings-list svelte-10y7l5j"><!--[-->`);
      const each_array = ensure_array_like(warnings());
      for (let i = 0, $$length = each_array.length; i < $$length; i++) {
        let warning = each_array[i];
        $$renderer2.push(`<div${attr_class(`warning-card ${stringify(warning.severity === "critical" ? "warning-card-kill" : "")}`, "svelte-10y7l5j")}${attr_style(`border-left-color: ${stringify(severityColor(warning.severity))}; background: ${stringify(severityBg(warning.severity))}`)}><div class="warning-top svelte-10y7l5j"><span class="warning-icon svelte-10y7l5j">${escape_html(severityIcon(warning.severity, warning.icon))}</span> <div class="warning-content svelte-10y7l5j"><div class="warning-header svelte-10y7l5j"><h4 class="warning-title svelte-10y7l5j">${escape_html(warning.title)}</h4> <span${attr_class(`severity-badge ${stringify(warning.severity === "critical" ? "severity-badge-kill" : "")}`, "svelte-10y7l5j")}${attr_style(`color: ${stringify(warning.severity === "critical" ? "#fff" : severityColor(warning.severity))}; background: ${stringify(warning.severity === "critical" ? "#dc2626" : severityBg(warning.severity))}`)}>${escape_html(severityLabel(warning.severity))}</span></div> <p class="warning-desc svelte-10y7l5j">${escape_html(warning.description)}</p></div></div></div>`);
      }
      $$renderer2.push(`<!--]--></div> <div class="feedback-row svelte-10y7l5j">`);
      FeedbackButton($$renderer2, { sectionId: "heads-up-cards" });
      $$renderer2.push(`<!----></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function CoffeeWatchOuts($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { watchOuts = [], bizType = "" } = $$props;
    let isCoffee = derived(() => bizType === "specialty_coffee" || bizType === "coffee_shop" || bizType === "coffee");
    function sevColor(sev) {
      if (sev === "critical") return "#dc2626";
      if (sev === "important") return "#d97706";
      return "#6b7280";
    }
    function sevBg(sev) {
      if (sev === "critical") return "rgba(220, 38, 38, 0.08)";
      if (sev === "important") return "rgba(217, 119, 6, 0.06)";
      return "rgba(107, 114, 128, 0.06)";
    }
    function sevLabel(sev) {
      if (sev === "critical") return "Critical";
      if (sev === "important") return "Watch";
      return "Note";
    }
    if (isCoffee() && watchOuts.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="cwo-section svelte-16mzn64"><div class="cwo-header svelte-16mzn64"><span class="cwo-icon svelte-16mzn64">☕</span> <div><h3 class="cwo-title svelte-16mzn64">Coffee Viability Watch-Outs</h3> <p class="cwo-sub svelte-16mzn64">${escape_html(watchOuts.length)} location-specific flag${escape_html(watchOuts.length > 1 ? "s" : "")} for your coffee concept</p></div></div> <div class="cwo-pills svelte-16mzn64"><!--[-->`);
      const each_array = ensure_array_like(watchOuts);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let wo = each_array[$$index];
        $$renderer2.push(`<div class="cwo-pill svelte-16mzn64"${attr_style(`border-left-color: ${stringify(sevColor(wo.severity))}; background: ${stringify(sevBg(wo.severity))}`)}><div class="cwo-pill-top svelte-16mzn64"><span class="cwo-pill-icon svelte-16mzn64">${escape_html(wo.icon)}</span> <span class="cwo-pill-title svelte-16mzn64">${escape_html(wo.title)}</span> <span class="cwo-pill-sev svelte-16mzn64"${attr_style(`color: ${stringify(sevColor(wo.severity))}`)}>${escape_html(sevLabel(wo.severity))}</span></div> <p class="cwo-pill-explain svelte-16mzn64">${escape_html(wo.explanation)}</p></div>`);
      }
      $$renderer2.push(`<!--]--></div> <div class="cwo-feedback svelte-16mzn64">`);
      FeedbackButton($$renderer2, { sectionId: "coffee-watch-outs" });
      $$renderer2.push(`<!----></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function escalateSeverity(watchOuts) {
  const ids = new Set(watchOuts.map((w) => w.id));
  if (ids.has("W3") && ids.has("W9")) {
    return watchOuts.map(
      (w) => w.id === "W3" || w.id === "W9" ? { ...w, severity: "critical" } : w
    );
  }
  return watchOuts;
}
function generateCoffeeWatchOuts(scores, bizType, avgTicket = 5) {
  const normalized = bizType.toLowerCase().replace(/[\s/]+/g, "_");
  if (normalized !== "coffee" && normalized !== "specialty_coffee" && normalized !== "cafe") {
    return [];
  }
  const out = [];
  const transit = scores.transit ?? 50;
  const competition = scores.competition ?? 50;
  const demographics = scores.demographics ?? 50;
  const vibrancy = scores.vibrancy ?? 50;
  const safety = scores.safety ?? 50;
  const survivalRate = scores.survivalRate ?? 60;
  if (transit < 35) {
    out.push({
      id: "W1",
      title: "Low foot traffic",
      explanation: "Low morning walk-in traffic. This block doesn't hand you commuters — plan for destination marketing.",
      severity: "important",
      icon: "🚶"
    });
  }
  if (vibrancy < 40) {
    out.push({
      id: "W2",
      title: "Thin daily anchors",
      explanation: "Few daily-repeat anchors nearby. Coffee thrives on habits — this block may need time to build a routine customer base.",
      severity: "important",
      icon: "🔄"
    });
  }
  if (competition < 35) {
    out.push({
      id: "W3",
      title: "3+ competitors nearby",
      explanation: "3+ coffee competitors within 100m. You're in a dogfight for the same walk-by customer.",
      severity: "important",
      icon: "⚔️"
    });
  }
  if (vibrancy < 45 && transit < 45) {
    out.push({
      id: "W5",
      title: "No anchor traffic",
      explanation: "No high-conversion anchors (gyms, hospitals, tourist draws) within 200m. Your traffic is purely walk-by.",
      severity: "important",
      icon: "🏥"
    });
  }
  if (survivalRate < 50) {
    out.push({
      id: "W6",
      title: "Low survival block",
      explanation: "Below-average year-1 survival on this block. Model conservative and plan for a longer ramp.",
      severity: "important",
      icon: "📉"
    });
  }
  if (safety < 40) {
    out.push({
      id: "W7",
      title: "Street-level risk",
      explanation: "Street-level conditions work against impulse stops — limited sidewalk width, poor visibility, or hostile pedestrian environment.",
      severity: "important",
      icon: "🚧"
    });
  }
  if (avgTicket > 7 && demographics < 40) {
    out.push({
      id: "W8",
      title: "Income mismatch",
      explanation: "Neighborhood income doesn't match your price point. Check whether your target customer actually lives or works here.",
      severity: "important",
      icon: "💰"
    });
  } else if (avgTicket <= 5 && demographics > 80) {
    out.push({
      id: "W8",
      title: "Over-qualified block",
      explanation: "High-income area with a value price point. You may face premium-brand competition that commoditizes your offer.",
      severity: "info",
      icon: "💰"
    });
  }
  if (competition < KILL_FACTOR_THRESHOLDS.competition) {
    out.push({
      id: "W9",
      title: "Saturated micro-zone",
      explanation: "Saturated micro-zone. Two or more direct competitors within 100m — differentiation is mandatory.",
      severity: "important",
      icon: "🔴"
    });
  }
  if (transit > 65 && vibrancy < KILL_FACTOR_THRESHOLDS.vibrancy) {
    out.push({
      id: "W10",
      title: "Weekend dead zone",
      explanation: "This block goes quiet on weekends. If your model needs 7-day revenue, factor in a significant weekend drop.",
      severity: "important",
      icon: "📅"
    });
  }
  return escalateSeverity(out);
}
function AddressAnalyzer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { store, onScoresReady, onBeforeSearch, searchOnly = false } = $$props;
    let locationScore = null;
    let alignmentScore = null;
    let scoresLoading = false;
    let disambigCandidates = [];
    let brain3DimensionRings = [];
    let fitVerdict = null;
    let fitInsight = null;
    let personaType = "coffee";
    let compassScores = {
      transit: 0,
      competition: 0,
      demographics: 0,
      vibrancy: 0,
      safety: 0,
      momentum: 0
    };
    let questionAnswers = {};
    let scoringHints = {};
    let conceptDescription = "";
    let personaKey = "coffee";
    const _PRICE_MAP = {
      "1": { avgTicket: 4.5, visionTier: "commodity" },
      "2": { avgTicket: 5.5, visionTier: "standard" },
      "3": { avgTicket: 7.5, visionTier: "differentiated" },
      "4": { avgTicket: 9, visionTier: "highly_differentiated" }
    };
    const _lpData = (() => {
      try {
        return JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
      } catch {
        return {};
      }
    })();
    const _lpPriceLevel = _lpData.priceLevel || "";
    const _lpPriceMapped = _PRICE_MAP[_lpPriceLevel];
    const _lpAvgTicket = _lpData.avgTicket || _lpPriceMapped?.avgTicket || 5;
    _lpData.visionTier || _lpPriceMapped?.visionTier || "standard";
    function normalizePersonaType(pt) {
      if (!pt) return "coffee";
      const validKeys = [
        "coffee",
        "restaurant",
        "gym",
        "dentist",
        "spa",
        "bodega",
        "bakery",
        "barber",
        "boutique",
        "florist"
      ];
      if (validKeys.includes(pt)) return pt;
      const keyMap = {
        // Bot businessType keys (from onboarding BUSINESS_TYPES)
        coffee_shop: "coffee",
        fitness: "gym",
        retail: "boutique",
        bar: "restaurant",
        // closest persona profile
        spa_wellness: "spa",
        barbershop: "barber",
        medical_dental: "dentist",
        something_else: "coffee",
        // fallback for custom concepts
        // BUG-2 FIX: onboarding RESTAURANT_SUBTYPES keys
        full_service: "restaurant",
        fast_casual: "restaurant",
        quick_service: "restaurant",
        cafe_bakery: "bakery",
        // BUG-2 FIX: onboarding FITNESS_SUBTYPES keys
        boutique_studio: "gym",
        crossfit: "gym",
        big_box_gym: "gym",
        personal_training: "gym",
        // BUG-2 FIX: onboarding RETAIL_SUBTYPES keys
        clothing_boutique: "boutique",
        home_goods: "boutique",
        bookstore: "boutique",
        specialty_food: "bodega",
        beauty_retail: "barber",
        // BUG-2 FIX: canonical concept keys (written by businessTypeNormalizer / writeCanonicalConcept)
        specialty_coffee: "coffee",
        full_service_restaurant: "restaurant",
        fast_casual_restaurant: "restaurant",
        qsr: "restaurant",
        fine_dining: "restaurant",
        bar_nightlife: "restaurant",
        // closest persona profile
        fitness_studio: "gym",
        wellness_spa: "spa",
        juice_bar: "spa",
        wellness_beverage: "coffee",
        medical_office: "dentist",
        personal_services: "dentist",
        coworking: "boutique",
        // Display name mappings
        "Specialty Coffee/Café": "coffee",
        "Specialty Coffee / Café": "coffee",
        "Restaurant (Fast Casual)": "restaurant",
        "Restaurant (Full Service)": "restaurant",
        "Fitness / Wellness": "gym",
        "Fitness / Wellness Studio": "gym",
        "Fitness / Gym": "gym",
        "Salon / Barbershop": "spa",
        "Barbershop / Salon": "barber",
        "Professional Services": "dentist",
        "Dental / Medical": "dentist",
        "Grocery / Market": "bodega",
        "Grocery / Specialty Food": "bodega",
        Retail: "boutique",
        "Retail Store": "boutique",
        "Bar / Lounge": "restaurant",
        "Spa / Wellness": "spa",
        Other: "coffee"
      };
      return keyMap[pt] || "coffee";
    }
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("re2_persona");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.persona_type) personaType = normalizePersonaType(parsed.persona_type);
          if (parsed.question_answers) questionAnswers = parsed.question_answers;
          if (parsed.scoring_hints) scoringHints = parsed.scoring_hints;
          if (parsed.concept_description) conceptDescription = parsed.concept_description;
          personaKey = resolveToKey(parsed.persona_type);
        } else {
          const categoryToPersona = {
            coffee: "coffee",
            restaurant: "restaurant",
            fitness: "gym",
            salon: "spa",
            services: "dentist",
            grocery: "bodega",
            retail: "boutique",
            other: "coffee"
          };
          const derivedPersona = categoryToPersona[store.bizCategory] || "coffee";
          personaType = derivedPersona;
          personaKey = resolveToKey(derivedPersona);
        }
      } catch {
      }
    }
    function resolveToKey(pt) {
      if (!pt) return "coffee_shop";
      const directMap = {
        // Bot BUSINESS_TYPES keys
        coffee_shop: "coffee_shop",
        restaurant: "restaurant",
        fitness: "fitness",
        bar: "bar",
        spa_wellness: "spa_wellness",
        barbershop: "barbershop",
        florist: "florist",
        medical_dental: "medical_dental",
        retail: "retail",
        something_else: "something_else",
        // BUG-2 FIX: RESTAURANT_SUBTYPES keys
        full_service: "restaurant",
        fast_casual: "restaurant",
        quick_service: "restaurant",
        cafe_bakery: "restaurant",
        // BUG-2 FIX: FITNESS_SUBTYPES keys
        boutique_studio: "fitness",
        crossfit: "fitness",
        big_box_gym: "fitness",
        personal_training: "fitness",
        // BUG-2 FIX: RETAIL_SUBTYPES keys
        clothing_boutique: "retail",
        home_goods: "retail",
        bookstore: "retail",
        specialty_food: "retail",
        beauty_retail: "barbershop",
        // BUG-2 FIX: canonical concept keys (from businessTypeNormalizer)
        specialty_coffee: "coffee_shop",
        full_service_restaurant: "restaurant",
        fast_casual_restaurant: "restaurant",
        qsr: "restaurant",
        fine_dining: "restaurant",
        bakery: "restaurant",
        bar_nightlife: "bar",
        fitness_studio: "fitness",
        wellness_spa: "spa_wellness",
        juice_bar: "spa_wellness",
        wellness_beverage: "coffee_shop",
        medical_office: "medical_dental",
        personal_services: "medical_dental",
        coworking: "something_else"
      };
      if (directMap[pt]) return directMap[pt];
      const l = pt.toLowerCase();
      if (l.includes("coffee") || l.includes("café") || l.includes("cafe") || l.includes("espresso")) return "coffee_shop";
      if (l.includes("bar") || l.includes("lounge") || l.includes("cocktail") || l.includes("pub") || l.includes("nightclub") || l.includes("nightlife")) return "bar";
      if (l.includes("full service") || l.includes("full_service") || l.includes("fast casual") || l.includes("quick service") || l.includes("restaurant") || l.includes("dining") || l.includes("bakery") || l.includes("pastry")) return "restaurant";
      if (l.includes("gym") || l.includes("studio") || l.includes("fitness") || l.includes("yoga") || l.includes("crossfit") || l.includes("pilates") || l.includes("barre") || l.includes("cycling")) return "fitness";
      if (l.includes("dentist") || l.includes("dental") || l.includes("medical") || l.includes("doctor")) return "medical_dental";
      if (l.includes("florist") || l.includes("flower")) return "florist";
      if (l.includes("spa") || l.includes("salon") && !l.includes("barber") || l.includes("wellness") || l.includes("nail")) return "spa_wellness";
      if (l.includes("barber") || l.includes("grooming")) return "barbershop";
      if (l.includes("boutique") || l.includes("retail") || l.includes("fashion") || l.includes("shop")) return "retail";
      return "something_else";
    }
    const _LENS_LABELS = {
      transit: "Transit",
      safety: "Safety",
      demographics: "Your Customers",
      competition: "Competitors",
      vibrancy: "Concept Pulse",
      momentum: "Momentum"
    };
    function _lensTier(score) {
      return tierFor(score, "lens").label;
    }
    let synthesizedLenses = derived(() => {
      const out = [];
      for (const dim of Object.keys(_LENS_LABELS)) {
        const score = Math.round(compassScores[dim] ?? 0);
        if (score <= 0) continue;
        const tier = _lensTier(score);
        if (tier !== "Weak" && tier !== "Concerning") continue;
        out.push({
          dimension: dim,
          label: _LENS_LABELS[dim],
          score,
          tier,
          verdictLine: `${_LENS_LABELS[dim]} is ${score}/100 — ${tier === "Concerning" ? "this is a material risk for your concept on this block." : "weak for your concept. You'll need to work around it."}`
        });
      }
      return out;
    });
    let personaHeadsUp = derived(() => generateHeadsUpWarnings(personaKey, questionAnswers, compassScores));
    let lensPropagation = derived(() => warningsFromLenses(synthesizedLenses(), personaHeadsUp()));
    let headsUpWarnings = derived(() => [...personaHeadsUp(), ...lensPropagation()]);
    let _watchOutsFromApi = [];
    let coffeeWatchOuts = derived(() => _watchOutsFromApi.length > 0 ? _watchOutsFromApi : generateCoffeeWatchOuts(compassScores, store.bizType || "", _lpAvgTicket));
    function clearSearch() {
      store.searching = false;
      store.searchSteps = [];
      store.searchResult = null;
      store.posData = null;
      store.searchStep = 0;
    }
    let profileComplete = false;
    let conceptComplete = false;
    let canAnalyze = derived(() => profileComplete);
    let r = derived(() => store.searchResult);
    let sc = derived(() => r()?.score);
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div class="section svelte-1nr1soo">`);
      if (searchOnly) {
        $$renderer3.push("<!--[0-->");
        if (store.searching) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;gap:16px"><div style="width:40px;height:40px;border:3px solid #E5E7EB;border-top-color:#2d5a27;border-radius:50%;animation:spin 1s linear infinite"></div> <div style="font-size:15px;color:#6B7280;font-weight:500">Analyzing your location…</div> <div style="font-size:13px;color:#9CA3AF">${escape_html(store.searchAddr || "Scanning 20 data sources")}</div></div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (store.searchSteps?.length) {
          $$renderer3.push("<!--[0-->");
          SearchSteps($$renderer3, {
            steps: store.searchSteps,
            searchStep: store.searchStep,
            searching: store.searching
          });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      } else if (!canAnalyze()) {
        $$renderer3.push("<!--[1-->");
        $$renderer3.push(`<div class="gate-message svelte-1nr1soo"><div class="gate-icon svelte-1nr1soo">📋</div> <div class="gate-text svelte-1nr1soo"><h3 class="svelte-1nr1soo">Complete your profile first</h3> <p class="svelte-1nr1soo">Before analyzing a location, we need to understand your
					business so we can give you personalized scores.</p> <div class="gate-steps svelte-1nr1soo"><a href="/app/vision/founder"${attr_class("gate-step svelte-1nr1soo", void 0, { "done": profileComplete })}><span class="gate-check svelte-1nr1soo">${escape_html("1")}</span> <span>Your Profile</span></a> <a href="/app/vision/concept"${attr_class("gate-step svelte-1nr1soo", void 0, { "done": conceptComplete })}><span class="gate-check svelte-1nr1soo">${escape_html("2")}</span> <span>Concept &amp; Goals</span></a></div></div></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <div${attr_class("search-area svelte-1nr1soo", void 0, { "hero-mode": !r() && canAnalyze() })}${attr_style(searchOnly ? "display:none" : "")}><div${attr_class("search-bar svelte-1nr1soo", void 0, { "searching": store.searching })}><span class="search-icon svelte-1nr1soo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span> <input type="text" placeholder="e.g. 200 Broadway or 86-01 Roosevelt Ave, Queens, NY"${attr("value", store.searchAddr)} class="search-input svelte-1nr1soo"${attr("disabled", !canAnalyze(), true)}/> <button class="btn-analyze svelte-1nr1soo"${attr("disabled", store.searching || !canAnalyze(), true)}>`);
      if (store.searching) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<span class="analyze-spinner svelte-1nr1soo"></span> Analyzing...`);
      } else {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.push(`Analyze`);
      }
      $$renderer3.push(`<!--]--></button></div> `);
      if (disambigCandidates.length >= 2) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="disambig-panel svelte-1nr1soo"><div class="disambig-title svelte-1nr1soo">Which location did you mean?</div> <div class="disambig-subtitle svelte-1nr1soo">This address exists in multiple boroughs</div> <div class="disambig-options svelte-1nr1soo"><!--[-->`);
        const each_array = ensure_array_like(disambigCandidates);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let candidate = each_array[$$index];
          $$renderer3.push(`<button class="disambig-btn svelte-1nr1soo"><span class="disambig-borough svelte-1nr1soo">${escape_html(candidate.borough)}</span> <span class="disambig-addr svelte-1nr1soo">${escape_html(candidate.display.split(",").slice(0, 2).join(","))}</span></button>`);
        }
        $$renderer3.push(`<!--]--></div></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (!r() && canAnalyze() && !store.searching) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="search-hints svelte-1nr1soo"><span class="hint-label svelte-1nr1soo">Try:</span> <button class="hint-chip svelte-1nr1soo">200 Broadway</button> <button class="hint-chip svelte-1nr1soo">Chelsea Market</button> <button class="hint-chip svelte-1nr1soo">Cobble Hill</button></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (!r() && canAnalyze()) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="category-tabs svelte-1nr1soo"><span class="cat-tab svelte-1nr1soo">🚶 Walk</span> <span class="cat-tab svelte-1nr1soo">🚇 Ride</span> <span class="cat-tab svelte-1nr1soo">🛡️ Crime</span> <span class="cat-tab svelte-1nr1soo">👥 Foot Traffic</span> <span class="cat-tab svelte-1nr1soo">🏪 Competition</span> <span class="cat-tab svelte-1nr1soo">📈 Growth</span></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (store.searching) {
        $$renderer3.push("<!--[0-->");
        SearchSteps($$renderer3, {
          steps: store.searchSteps,
          searchStep: store.searchStep,
          searching: store.searching,
          onRetry: clearSearch
        });
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div> `);
      if (r() && sc() && !searchOnly) {
        $$renderer3.push("<!--[0-->");
        {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<div class="score-rings-section svelte-1nr1soo">`);
          ScoreHybrid($$renderer3, {
            locationScore,
            alignmentScore,
            loading: scoresLoading,
            bizType: store.bizType,
            verdict: fitVerdict,
            insight: fitInsight
          });
          $$renderer3.push(`<!----></div>`);
        }
        $$renderer3.push(`<!--]--> `);
        if (brain3DimensionRings.length > 0) {
          $$renderer3.push("<!--[0-->");
          FitDimensionRings($$renderer3, { rings: brain3DimensionRings, bizType: store.bizType });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        CoffeeWatchOuts($$renderer3, { watchOuts: coffeeWatchOuts(), bizType: store.bizType });
        $$renderer3.push(`<!----> `);
        if (headsUpWarnings().length > 0) {
          $$renderer3.push("<!--[0-->");
          HeadsUpCards($$renderer3, { personaKey, questionAnswers, scoringData: compassScores });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (store.vlfData || store.glfData || store.rrData || store.posData) {
          $$renderer3.push("<!--[0-->");
          RecommendationCards($$renderer3, {
            vlfData: store.vlfData,
            glfData: store.glfData,
            rrData: store.rrData,
            posData: store.posData,
            liveIntel: store.liveIntel,
            data: r().data,
            score: sc()
          });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (store.liveIntel && locationScore) ;
        else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (store.liveIntel) {
          $$renderer3.push("<!--[0-->");
          DataCoverage($$renderer3, { liveIntel: store.liveIntel });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
const BIZ_TYPE_MAP = {
  "Specialty Coffee/Café": {
    bizType: "Specialty Coffee / Café",
    bizCategory: "coffee",
    weightKey: "Specialty Coffee / Café"
  },
  "Restaurant (Fast Casual)": {
    bizType: "Restaurant (Fast Casual)",
    bizCategory: "restaurant",
    weightKey: "Restaurant (Fast Casual)"
  },
  "Restaurant (Full Service)": {
    bizType: "Restaurant (Full Service)",
    bizCategory: "restaurant",
    weightKey: "Restaurant (Full Service)"
  },
  "Retail": {
    bizType: "Retail Store",
    bizCategory: "retail",
    weightKey: "Retail Store"
  },
  "Fitness / Wellness": {
    bizType: "Fitness / Wellness Studio",
    bizCategory: "fitness",
    weightKey: "Fitness / Wellness Studio"
  },
  "Salon / Barbershop": {
    bizType: "Barbershop / Salon",
    bizCategory: "salon",
    weightKey: "Barbershop / Salon"
  },
  "Professional Services": {
    bizType: "Professional Services",
    bizCategory: "services",
    weightKey: "Professional Services"
  },
  "Grocery / Market": {
    bizType: "Grocery / Specialty Food",
    bizCategory: "grocery",
    weightKey: "Grocery / Specialty Food"
  },
  "Other": { bizType: "Other", bizCategory: "other", weightKey: "Other" },
  "coffee_shop": {
    bizType: "Specialty Coffee / Café",
    bizCategory: "coffee",
    weightKey: "Specialty Coffee / Café"
  },
  "coffee": {
    bizType: "Specialty Coffee / Café",
    bizCategory: "coffee",
    weightKey: "Specialty Coffee / Café"
  },
  "restaurant": {
    bizType: "Restaurant (Fast Casual)",
    bizCategory: "restaurant",
    weightKey: "Restaurant (Fast Casual)"
  },
  "full_service": {
    bizType: "Restaurant (Full Service)",
    bizCategory: "restaurant",
    weightKey: "Restaurant (Full Service)"
  },
  "full-service": {
    bizType: "Restaurant (Full Service)",
    bizCategory: "restaurant",
    weightKey: "Restaurant (Full Service)"
  },
  "fast_casual": {
    bizType: "Restaurant (Fast Casual)",
    bizCategory: "restaurant",
    weightKey: "Restaurant (Fast Casual)"
  },
  "quick_service": {
    bizType: "Restaurant (Fast Casual)",
    bizCategory: "restaurant",
    weightKey: "Restaurant (Fast Casual)"
  },
  "cafe_bakery": {
    bizType: "Specialty Coffee / Café",
    bizCategory: "coffee",
    weightKey: "Specialty Coffee / Café"
  },
  "gym": {
    bizType: "Fitness / Wellness Studio",
    bizCategory: "fitness",
    weightKey: "Fitness / Wellness Studio"
  },
  "fitness": {
    bizType: "Fitness / Wellness Studio",
    bizCategory: "fitness",
    weightKey: "Fitness / Wellness Studio"
  },
  "dentist": {
    bizType: "Professional Services",
    bizCategory: "services",
    weightKey: "Professional Services"
  },
  "spa": {
    bizType: "Barbershop / Salon",
    bizCategory: "salon",
    weightKey: "Barbershop / Salon"
  },
  "bodega": {
    bizType: "Grocery / Specialty Food",
    bizCategory: "grocery",
    weightKey: "Grocery / Specialty Food"
  },
  "bakery": {
    bizType: "Specialty Coffee / Café",
    bizCategory: "coffee",
    weightKey: "Specialty Coffee / Café"
  },
  "barber": {
    bizType: "Barbershop / Salon",
    bizCategory: "salon",
    weightKey: "Barbershop / Salon"
  },
  "boutique": {
    bizType: "Retail Store",
    bizCategory: "retail",
    weightKey: "Retail Store"
  },
  "something_else": {
    bizType: "Custom Concept",
    bizCategory: "other",
    weightKey: "Restaurant (Fast Casual)"
  },
  "bar": {
    bizType: "Bar / Lounge",
    bizCategory: "bar",
    weightKey: "Restaurant (Full Service)"
  },
  "spa_wellness": {
    bizType: "Spa / Wellness",
    bizCategory: "salon",
    weightKey: "Barbershop / Salon"
  },
  "medical_dental": {
    bizType: "Dental / Medical",
    bizCategory: "services",
    weightKey: "Professional Services"
  },
  "specialty_coffee": {
    bizType: "Specialty Coffee / Café",
    bizCategory: "coffee",
    weightKey: "Specialty Coffee / Café"
  },
  "barbershop": {
    bizType: "Barbershop / Salon",
    bizCategory: "salon",
    weightKey: "Barbershop / Salon"
  },
  "boutique_studio": {
    bizType: "Fitness / Wellness Studio",
    bizCategory: "fitness",
    weightKey: "Fitness / Wellness Studio"
  },
  "crossfit": {
    bizType: "Fitness / Wellness Studio",
    bizCategory: "fitness",
    weightKey: "Fitness / Wellness Studio"
  },
  "big_box_gym": {
    bizType: "Fitness / Wellness Studio",
    bizCategory: "fitness",
    weightKey: "Fitness / Wellness Studio"
  },
  "personal_training": {
    bizType: "Fitness / Wellness Studio",
    bizCategory: "fitness",
    weightKey: "Fitness / Wellness Studio"
  },
  "clothing_boutique": {
    bizType: "Retail Store",
    bizCategory: "retail",
    weightKey: "Retail Store"
  },
  "home_goods": {
    bizType: "Retail Store",
    bizCategory: "retail",
    weightKey: "Retail Store"
  },
  "bookstore": {
    bizType: "Retail Store",
    bizCategory: "retail",
    weightKey: "Retail Store"
  },
  "specialty_food": {
    bizType: "Grocery / Specialty Food",
    bizCategory: "grocery",
    weightKey: "Grocery / Specialty Food"
  },
  "beauty_retail": {
    bizType: "Barbershop / Salon",
    bizCategory: "salon",
    weightKey: "Barbershop / Salon"
  },
  "bar_nightlife": {
    bizType: "Bar / Lounge",
    bizCategory: "bar",
    weightKey: "Restaurant (Full Service)"
  },
  "full_service_restaurant": {
    bizType: "Restaurant (Full Service)",
    bizCategory: "restaurant",
    weightKey: "Restaurant (Full Service)"
  },
  "personal_services": {
    bizType: "Personal Services",
    bizCategory: "services",
    weightKey: "Professional Services"
  },
  "medical_office": {
    bizType: "Dental / Medical",
    bizCategory: "services",
    weightKey: "Professional Services"
  },
  "fitness_studio": {
    bizType: "Fitness / Wellness Studio",
    bizCategory: "fitness",
    weightKey: "Fitness / Wellness Studio"
  },
  "wellness_spa": {
    bizType: "Spa / Wellness",
    bizCategory: "salon",
    weightKey: "Barbershop / Salon"
  },
  "juice_bar": {
    bizType: "Specialty Coffee / Café",
    bizCategory: "coffee",
    weightKey: "Specialty Coffee / Café"
  },
  "wellness_beverage": {
    bizType: "Specialty Coffee / Café",
    bizCategory: "coffee",
    weightKey: "Specialty Coffee / Café"
  },
  "qsr": {
    bizType: "Restaurant (Fast Casual)",
    bizCategory: "restaurant",
    weightKey: "Restaurant (Fast Casual)"
  },
  "coworking": {
    bizType: "Professional Services",
    bizCategory: "services",
    weightKey: "Professional Services"
  }
};
function resolveFromLaunchpad() {
  if (typeof window === "undefined") return null;
  try {
    const lp = loadLaunchPadData();
    if (!lp || !lp.businessType) return null;
    let mapped = BIZ_TYPE_MAP[lp.businessType];
    if (lp.businessType === "restaurant" && lp.businessSubType) {
      const subMapped = BIZ_TYPE_MAP[lp.businessSubType];
      if (subMapped) mapped = subMapped;
    }
    if ((!mapped || mapped.bizCategory === "other") && lp.businessType !== "something_else") {
      try {
        const sessionStr = localStorage.getItem("re2_session");
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          const pt = session.personaType || session.personaKey || "";
          if (pt) {
            const sessionMapped = BIZ_TYPE_MAP[pt];
            if (sessionMapped && sessionMapped.bizCategory !== "other") {
              mapped = sessionMapped;
            }
          }
        }
      } catch {
      }
    }
    if ((!mapped || mapped.bizCategory === "other") && lp.businessType !== "something_else") {
      try {
        const personaStr = localStorage.getItem("re2_persona");
        if (personaStr) {
          const persona = JSON.parse(personaStr);
          if (persona.persona_type) {
            const personaMapped = BIZ_TYPE_MAP[persona.persona_type];
            if (personaMapped && personaMapped.bizCategory !== "other") {
              mapped = personaMapped;
            }
          }
        }
      } catch {
      }
    }
    const isCustomConcept = lp.businessType === "something_else";
    const customDisplayName = isCustomConcept && lp.businessName ? lp.businessName : null;
    const resolvedBizType = customDisplayName ? customDisplayName : mapped?.bizType && mapped.bizType !== "Other" ? mapped.bizType : (() => {
      console.warn("[RE2] Store concept resolution failed — defaulting to Specialty Coffee. launchpad.businessType was:", lp?.businessType);
      return "Specialty Coffee / Café";
    })();
    const resolvedBizCategory = mapped?.bizCategory && mapped.bizCategory !== "other" ? mapped.bizCategory : "coffee";
    const resolvedWeightKey = mapped?.weightKey && mapped.weightKey !== "Other" ? mapped.weightKey : "Specialty Coffee / Café";
    return {
      bizType: resolvedBizType,
      bizCategory: resolvedBizCategory,
      weightKey: resolvedWeightKey,
      vision: lp.visionStatement || "",
      differentiator: lp.differentiator || "",
      targetSDE: lp.financialGoals?.targetSDE || 0,
      targetRevY1: lp.financialGoals?.revenueY1 || 0,
      targetRevY3: lp.financialGoals?.revenueY3 || 0,
      targetTxns: lp.financialGoals?.dailyTransactions || 0,
      targetTicket: lp.financialGoals?.avgTicket || 0,
      numLocations: lp.financialGoals?.numberOfLocations || 1,
      estimatedRent: lp.financialGoals?.monthlyRentBudget || 0
    };
  } catch {
    return null;
  }
}
function createLocationStore() {
  const lp = resolveFromLaunchpad();
  const defaultBizType = lp?.bizType || "Specialty Coffee / Café";
  const defaultBizCategory = lp?.bizCategory || "coffee";
  const defaultWeightKey = lp?.weightKey || "Specialty Coffee / Café";
  let bizType = defaultBizType;
  let bizCategory = defaultBizCategory;
  let vision = lp?.vision || "";
  let differentiator = lp?.differentiator || "";
  let targetSDE = lp?.targetSDE || 25e4;
  let targetRevY1 = lp?.targetRevY1 || 95e4;
  let targetRevY3 = lp?.targetRevY3 || 16e5;
  let targetTxns = lp?.targetTxns || 500;
  let targetTicket = lp?.targetTicket || 8.75;
  let numLocations = lp?.numLocations ? `${lp.numLocations} location${lp.numLocations > 1 ? "s" : ""}` : "First of 10 stores";
  let estimatedRent = lp?.estimatedRent || 0;
  let weights = {
    ...(WEIGHT_PROFILES[defaultWeightKey] || WEIGHT_PROFILES["Specialty Coffee / Café"]).w
  };
  let layerScores = defaultLayerScores();
  let expandedLayer = null;
  let searchAddr = "";
  let searching = false;
  let searchSteps = [];
  let searchResult = null;
  let searchStep = 0;
  let posData = null;
  let vlfData = null;
  let glfData = null;
  let rrData = null;
  let liveIntel = null;
  let lcs = 0;
  let tiCredit = 50;
  let rentAbatement = false;
  let percentRent = false;
  let pgWaiver = false;
  let sublease = false;
  let trackRecord = 70;
  let activeInvestment = false;
  let bidMember = false;
  let coInvestment = false;
  let selectedNeighborhood = "Chelsea";
  let scrapeBorough = "Manhattan";
  let scraping = false;
  let scrapeResults = {};
  let scrapeQueue = [];
  let expandedHood = null;
  let primaryResult = null;
  let altResults = [null, null, null];
  return {
    // Vision & Goals
    get bizType() {
      return bizType;
    },
    set bizType(v) {
      bizType = v;
    },
    get bizCategory() {
      return bizCategory;
    },
    set bizCategory(v) {
      bizCategory = v;
    },
    get vision() {
      return vision;
    },
    set vision(v) {
      vision = v;
    },
    get differentiator() {
      return differentiator;
    },
    set differentiator(v) {
      differentiator = v;
    },
    get targetSDE() {
      return targetSDE;
    },
    set targetSDE(v) {
      targetSDE = v;
    },
    get targetRevY1() {
      return targetRevY1;
    },
    set targetRevY1(v) {
      targetRevY1 = v;
    },
    get targetRevY3() {
      return targetRevY3;
    },
    set targetRevY3(v) {
      targetRevY3 = v;
    },
    get targetTxns() {
      return targetTxns;
    },
    set targetTxns(v) {
      targetTxns = v;
    },
    get targetTicket() {
      return targetTicket;
    },
    set targetTicket(v) {
      targetTicket = v;
    },
    get numLocations() {
      return numLocations;
    },
    set numLocations(v) {
      numLocations = v;
    },
    get estimatedRent() {
      return estimatedRent;
    },
    set estimatedRent(v) {
      estimatedRent = v;
    },
    // Weights & Scoring
    get weights() {
      return weights;
    },
    set weights(v) {
      weights = v;
    },
    get layerScores() {
      return layerScores;
    },
    set layerScores(v) {
      layerScores = v;
    },
    get expandedLayer() {
      return expandedLayer;
    },
    set expandedLayer(v) {
      expandedLayer = v;
    },
    // Search
    get searchAddr() {
      return searchAddr;
    },
    set searchAddr(v) {
      searchAddr = v;
    },
    get searching() {
      return searching;
    },
    set searching(v) {
      searching = v;
    },
    get searchSteps() {
      return searchSteps;
    },
    set searchSteps(v) {
      searchSteps = v;
    },
    get searchResult() {
      return searchResult;
    },
    set searchResult(v) {
      searchResult = v;
    },
    get searchStep() {
      return searchStep;
    },
    set searchStep(v) {
      searchStep = v;
    },
    // Scoring Results
    get posData() {
      return posData;
    },
    set posData(v) {
      posData = v;
    },
    get vlfData() {
      return vlfData;
    },
    set vlfData(v) {
      vlfData = v;
    },
    get glfData() {
      return glfData;
    },
    set glfData(v) {
      glfData = v;
    },
    get rrData() {
      return rrData;
    },
    set rrData(v) {
      rrData = v;
    },
    get liveIntel() {
      return liveIntel;
    },
    set liveIntel(v) {
      liveIntel = v;
    },
    // Landlord
    get lcs() {
      return lcs;
    },
    set lcs(v) {
      lcs = v;
    },
    get tiCredit() {
      return tiCredit;
    },
    set tiCredit(v) {
      tiCredit = v;
    },
    get rentAbatement() {
      return rentAbatement;
    },
    set rentAbatement(v) {
      rentAbatement = v;
    },
    get percentRent() {
      return percentRent;
    },
    set percentRent(v) {
      percentRent = v;
    },
    get pgWaiver() {
      return pgWaiver;
    },
    set pgWaiver(v) {
      pgWaiver = v;
    },
    get sublease() {
      return sublease;
    },
    set sublease(v) {
      sublease = v;
    },
    get trackRecord() {
      return trackRecord;
    },
    set trackRecord(v) {
      trackRecord = v;
    },
    get activeInvestment() {
      return activeInvestment;
    },
    set activeInvestment(v) {
      activeInvestment = v;
    },
    get bidMember() {
      return bidMember;
    },
    set bidMember(v) {
      bidMember = v;
    },
    get coInvestment() {
      return coInvestment;
    },
    set coInvestment(v) {
      coInvestment = v;
    },
    // Neighborhood Scanner
    get selectedNeighborhood() {
      return selectedNeighborhood;
    },
    set selectedNeighborhood(v) {
      selectedNeighborhood = v;
    },
    get scrapeBorough() {
      return scrapeBorough;
    },
    set scrapeBorough(v) {
      scrapeBorough = v;
    },
    get scraping() {
      return scraping;
    },
    set scraping(v) {
      scraping = v;
    },
    get scrapeResults() {
      return scrapeResults;
    },
    set scrapeResults(v) {
      scrapeResults = v;
    },
    get scrapeQueue() {
      return scrapeQueue;
    },
    set scrapeQueue(v) {
      scrapeQueue = v;
    },
    get expandedHood() {
      return expandedHood;
    },
    set expandedHood(v) {
      expandedHood = v;
    },
    // Comparison
    get primaryResult() {
      return primaryResult;
    },
    set primaryResult(v) {
      primaryResult = v;
    },
    get altResults() {
      return altResults;
    },
    set altResults(v) {
      altResults = v;
    },
    // Helper: push search step
    step(t) {
      searchSteps = [...searchSteps, { t, c: "go" }];
    },
    stepDone(t) {
      if (searchSteps.length) {
        const updated = [...searchSteps];
        updated[updated.length - 1] = { t, c: "ok" };
        searchSteps = updated;
      }
    },
    stepBad(t) {
      searchSteps = [...searchSteps, { t, c: "bad" }];
    }
  };
}
function writeCanonicalConcept(rawInput) {
  const canonical = normalizeBusinessType(rawInput);
  try {
    const sess = JSON.parse(localStorage.getItem("re2_session") || "{}");
    sess.canonicalConcept = canonical;
    sess.bizType = canonical;
    sess.visionBizType = canonical;
    localStorage.setItem("re2_session", JSON.stringify(sess));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("re2:session-updated"));
    }
  } catch {
  }
  return canonical;
}
function toArchetype(kpi) {
  return {
    footTrafficW: kpi.visionSignalWeights.footTrafficW,
    competitionW: kpi.visionSignalWeights.competitionW,
    demographicsW: kpi.visionSignalWeights.demographicsW,
    vibrancyW: kpi.visionSignalWeights.vibrancyW,
    idealIncome: kpi.idealIncomeRange,
    idealCheck: kpi.idealCheckRange,
    peakHours: kpi.peakHours
  };
}
const VISION_ARCHETYPES = Object.fromEntries(
  Object.entries(CONCEPT_KPIS).map(([key, kpi]) => [key, toArchetype(kpi)])
);
const DEFAULT_ARCHETYPE = {
  footTrafficW: 0.25,
  competitionW: 0.25,
  demographicsW: 0.25,
  vibrancyW: 0.25,
  idealIncome: [4e4, 15e4],
  idealCheck: [5, 30],
  peakHours: "all_day"
};
function ScoreHeader($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      grade,
      verdict,
      verdictIcon = "",
      confidence = "confident",
      confidenceReason = ""
    } = $$props;
    $$renderer2.push(`<div class="sh-root svelte-1t7d2wj"><div class="sh-row svelte-1t7d2wj"><span${attr_class(`sh-grade-pill sh-grade-${stringify(grade.toLowerCase())}`, "svelte-1t7d2wj")}${attr("aria-label", `Letter grade ${stringify(grade)}`)}>Grade ${escape_html(grade)}</span> <span class="sh-verdict-pill svelte-1t7d2wj"${attr("aria-label", `Verdict ${stringify(verdict)}`)}>`);
    if (verdictIcon) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="sh-verdict-ico svelte-1t7d2wj" aria-hidden="true">${escape_html(verdictIcon)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> ${escape_html(verdict)}</span></div> `);
    if (confidence === "preliminary") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sh-prelim-row svelte-1t7d2wj"><span class="sh-prelim-pill sh-prelim-loud svelte-1t7d2wj"${attr("title", confidenceReason)}>PRELIM — score will sharpen as you add details</span></div>`);
    } else if (confidence === "partial") {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="sh-prelim-row svelte-1t7d2wj"><span class="sh-prelim-pill sh-prelim-soft svelte-1t7d2wj"${attr("title", confidenceReason)}>Partial read — add more details to sharpen your score.</span></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function canonicalize(inputs) {
  const canonical = {
    address: inputs.address.trim().toLowerCase(),
    avg_ticket: inputs.avgTicket ?? null,
    buildout_budget: inputs.buildoutBudget ?? null,
    concept: inputs.concept.toLowerCase(),
    credit_score_band: inputs.creditScoreBand ?? null,
    daily_transactions: inputs.dailyTransactions ?? null,
    funding_capital: inputs.fundingCapital ?? null,
    lat: Math.round(inputs.lat * 1e5) / 1e5,
    lng: Math.round(inputs.lng * 1e5) / 1e5,
    monthly_rent_budget: inputs.monthlyRentBudget ?? null,
    scorer_version: inputs.scorerVersion,
    vision_iq_completion_pct: Math.round(inputs.visionIQCompletionPct ?? 0)
  };
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}
async function computeInputsHashBrowser(inputs) {
  try {
    const msgBuffer = new TextEncoder().encode(canonicalize(inputs));
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "hash-unavailable";
  }
}
function normalizeAddress(addr) {
  return addr.trim().toLowerCase().replace(/\s+/g, " ");
}
function addressesMatch(addr1, addr2) {
  const norm1 = normalizeAddress(addr1);
  const norm2 = normalizeAddress(addr2);
  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  return false;
}
function normalizeConceptType(concept) {
  if (!concept) return "";
  return concept.trim().toLowerCase();
}
function checkDuplicateAnalysis(address, conceptType, scoredLocations) {
  if (!address || !conceptType) {
    return { found: false };
  }
  const locations = getStoredScoredLocations();
  if (!locations || locations.length === 0) {
    return { found: false };
  }
  const normalizedConcept = normalizeConceptType(conceptType);
  for (const location of locations) {
    if (!location.addr) continue;
    const addressMatch = addressesMatch(address, location.addr);
    const conceptMatch = normalizeConceptType(location.conceptType || "") === normalizedConcept;
    if (addressMatch && conceptMatch) {
      return {
        found: true,
        location,
        address: location.addr,
        conceptType: location.conceptType || conceptType
      };
    }
  }
  return { found: false };
}
function getStoredScoredLocations() {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem("re2_launchpad");
    if (!data) return [];
    const parsed = JSON.parse(data);
    return parsed.scoredLocations || [];
  } catch (e) {
    console.warn("[DuplicateDetection] Failed to read scoredLocations from localStorage:", e);
    return [];
  }
}
class LocationAnalysisStore {
  // ── Map & Context State ──
  mapLat = 40.758;
  mapLng = -73.9855;
  competitors = [];
  competitorScanStatus = "pending";
  mapRef = null;
  // ── Search & UX State ──
  handoffProgressIdx = 0;
  handoffTimedOut = false;
  scoringFailed = false;
  // ── Duplicate Analysis Guard ──
  duplicateFound = null;
  pendingAnalysisAddress = "";
  pendingAnalysisConceptType = "";
  // ── Scoring Context ──
  fitSubScores = {};
  fitComplete = false;
  animateRings = false;
  // ── UI Interactivity ──
  showAllHelping = false;
  showAllHurting = false;
  // ── Shortlist & Pinning ──
  isPinned = false;
  pinJustSaved = false;
  shortlistToastVisible = false;
  // 04.19.2026 18:00 - Modular Helpers
  clearDuplicateGuard() {
    this.duplicateFound = null;
    this.pendingAnalysisAddress = "";
    this.pendingAnalysisConceptType = "";
  }
}
const LOCATION_ANALYSIS_KEY = /* @__PURE__ */ Symbol("LOCATION_ANALYSIS");
function initLocationAnalysisStore() {
  const store = new LocationAnalysisStore();
  setContext(LOCATION_ANALYSIS_KEY, store);
  return store;
}
function DuplicateAnalysisGuard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { store } = $$props;
    if (store.duplicateFound) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="duplicate-modal-overlay" role="presentation"></div> <div class="duplicate-modal"><div class="duplicate-modal-content"><div class="duplicate-modal-icon">⚠️</div> <h2 class="duplicate-modal-title">Already analyzed</h2> <p class="duplicate-modal-msg">You've already analyzed <strong>${escape_html(store.duplicateFound.address)}</strong> for <strong>${escape_html(store.duplicateFound.conceptType)}</strong>.</p> <div class="duplicate-modal-actions"><button class="duplicate-btn duplicate-btn-secondary">View Existing</button> <button class="duplicate-btn duplicate-btn-primary">Re-analyze</button></div></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function LocationStickyActionBar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function FactorDrilldown($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { store, evidence } = $$props;
    $$renderer2.push(`<div class="v3-ww-row"><div class="v3-ww-card"><div class="v3-ww-title v3-ww-green">✓ Working For You</div> `);
    if (evidence.helping.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(store.showAllHelping ? evidence.helping : evidence.helping.slice(0, 5));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let item = each_array[$$index];
        const _evLvl = item.value >= 70 ? "Strong" : item.value >= 55 ? "Moderate" : "Limited";
        $$renderer2.push(`<div class="v3-ww-item"><div class="v3-ww-dot v3-dot-g"></div> <div><strong>${escape_html(item.label)}</strong> — ${escape_html(item.copy)} <span${attr_class(`v3-ev-badge v3-ev-${stringify(item.value >= 70 ? "high" : item.value >= 55 ? "med" : "low")}`)}>${escape_html(_evLvl)} evidence</span></div></div>`);
      }
      $$renderer2.push(`<!--]--> `);
      if (evidence.helping.length > 5) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button type="button" class="v3-ww-more">${escape_html(store.showAllHelping ? "Show less" : `Show all ${evidence.helping.length}`)}</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="v3-ww-item v3-ww-empty">Complete your concept details to see what's working.</div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="v3-ww-card"><div class="v3-ww-title v3-ww-amber">⚠ Watch Out</div> `);
    if (evidence.hurting.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_1 = ensure_array_like(store.showAllHurting ? evidence.hurting : evidence.hurting.slice(0, 5));
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let item = each_array_1[$$index_1];
        const _evLvl = item.value >= 70 ? "Strong" : item.value >= 55 ? "Moderate" : "Limited";
        $$renderer2.push(`<div class="v3-ww-item"><div class="v3-ww-dot v3-dot-a"></div> <div><strong>${escape_html(item.label)}</strong> — ${escape_html(item.copy)} <span${attr_class(`v3-ev-badge v3-ev-${stringify(item.value >= 70 ? "high" : item.value >= 55 ? "med" : "low")}`)}>${escape_html(_evLvl)} evidence</span></div></div>`);
      }
      $$renderer2.push(`<!--]--> `);
      if (evidence.hurting.length > 5) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button type="button" class="v3-ww-more">${escape_html(store.showAllHurting ? "Show less" : `Show all ${evidence.hurting.length}`)}</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="v3-ww-item v3-ww-empty">No major flags detected. Keep going.</div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const _COUNTY_TO_BOROUGH = {
      "061": "Manhattan",
      "005": "Bronx",
      "047": "Brooklyn",
      "081": "Queens",
      "085": "Staten Island"
    };
    const geoidToBorough = (geoid) => geoid.length >= 5 ? _COUNTY_TO_BOROUGH[geoid.substring(2, 5)] || "NYC" : "NYC";
    const store = createLocationStore();
    const analysisStore = initLocationAnalysisStore();
    {
      const _botAddr = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("addr") : page.url.searchParams.get("addr");
      if (_botAddr) store.searchResult = null;
    }
    let hasResult = derived(() => !!store.searchResult);
    let comingFromBot = derived(() => !!page.url.searchParams.get("addr"));
    const HANDOFF_MESSAGES = [
      "Looking at who walks past this block daily...",
      "Checking how many similar businesses thrive nearby...",
      "Reading the neighbourhood — income, density, energy...",
      "Mapping transit access for your target customer...",
      "Running the survival numbers for this block...",
      "Comparing this spot to 50K NYC businesses...",
      "Calculating how your concept fits this location...",
      "Almost ready — pulling it all together..."
    ];
    let handoffProgressIdx = 0;
    let sixScores = {};
    let fitSubScores = {};
    let isPinned = false;
    function syncPinState() {
      if (typeof window === "undefined") return;
      const lp = loadLaunchPadData();
      const found = (lp.scoredLocations || []).find((l) => l.addr === analysisAddress);
      isPinned = found?.pinned === true;
    }
    async function handleBeforeSearch(address) {
      const conceptType = store.bizType || store.bizCategory || "";
      if (!conceptType) {
        return true;
      }
      const result = checkDuplicateAnalysis(address, conceptType);
      if (result.found) {
        analysisStore.duplicateFound = result;
        analysisStore.pendingAnalysisAddress = address;
        analysisStore.pendingAnalysisConceptType = conceptType;
        return false;
      }
      return true;
    }
    function coffeeTierLabel() {
      try {
        const lp = JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
        const pl = lp.priceLevel;
        if (pl && PRICE_LEVEL_TO_COFFEE[pl]) return PRICE_LEVEL_TO_COFFEE[pl].tierLabel;
      } catch {
      }
      return "specialty coffee";
    }
    const CONCEPT_LABELS = {
      specialty_coffee: coffeeTierLabel(),
      coffee_shop: coffeeTierLabel(),
      coffee: coffeeTierLabel(),
      cafe: coffeeTierLabel(),
      bakery: "bakery",
      fast_casual: "fast casual",
      full_service_restaurant: "full-service restaurant",
      qsr: "QSR",
      bar_nightlife: "bar/nightlife",
      juice_bar: "juice bar",
      wellness_beverage: "wellness beverage",
      retail: "retail",
      fitness_studio: "fitness studio",
      personal_services: "personal services",
      wellness_spa: "spa/wellness",
      medical_office: "medical office",
      florist: "florist",
      coworking: "coworking"
    };
    let analysisAddress = "";
    let locationNeighborhood = "";
    let currentGeoid = "";
    let currentBorough = derived(() => currentGeoid ? geoidToBorough(currentGeoid) : "NYC");
    let serverFitIQ = null;
    let serverVisionIQ = null;
    let dataCompleteness = null;
    let threeScores = derived(() => {
      const d = store.searchResult?.data;
      return d?.threeScores ?? null;
    });
    let sixIndex = derived(() => {
      const d = store.searchResult?.data;
      return d?.sixIndex ?? null;
    });
    let apiKillFactors = derived(() => locationIqPayload?.killFactors ?? []);
    let apiKillBannerVisible = derived(() => apiKillFactors().length > 0 && // UX-3.2 + B3-1.5: Grade-cap reason + API-authoritative grade + verdict
    // B3-1.5: API emits verdict ('Viable', 'Tight', etc.) — prefer over client fitTierLabel
    // ── UX-J: Rule 17 (NY SLA 200-ft school rule) hard-block banner ──
    // Surfaces ONLY when:
    //   1. The iq.signals array contains a message starting with the stable
    //      `🚫 SLA 200-ft BLOCK` prefix (vital-rules.ts RULE_17_SIGNAL_PREFIX).
    //   2. The current concept depends on a liquor license. Non-liquor concepts
    //      (retail, coffee, wellness) get no banner — Rule 17 doesn't affect them.
    //
    // Read from the top-level `signals` array (spread from `...iq` in
    // /api/location-iq). `sixIndex.signals` is a different array scoped to
    // the 8-dimension computation — Rule 17 does NOT live there.
    //
    // Concept gating uses store.bizType directly (TDZ-safe — no dependency on
    // `visionBizType` / `conceptKeyForQuestions` which are declared later in
    // this script). If the founder changes concept via the questionnaire,
    // the banner re-evaluates once the next score payload lands.
    // Concept gate: only show for liquor-dependent concepts.
    // Use raw store.bizType — available immediately, no TDZ.
    // Parse "<school> is <X> ft away" out of the stable message format.
    // Format: `🚫 SLA 200-ft BLOCK: <schoolName> is <distFt> ft away — ...`
    // Drop the analyzed address and return to the Dashboard search.
    /* ignore */
    // Vision IQ questionnaire state (per UX-IMPLEMENTATION-RULES)
    // ── Percentile context: "Top X% of [concept] locations in NYC" ──
    // Calibrated from 13K scored locations per concept (Cycle 2H training data).
    // UX-FIX-5 (Emergency Fix Pack April 11): Unambiguous percentile framing.
    // Canonical copy for top-half: "Better than X% of NYC <concept> locations we've analyzed."
    // The compressed "Top 4%" phrasing was removed — founders couldn't tell if "top" meant good or bad.
    // Approximate CDF using Abramowitz-Stegun: Φ(z) ≈ 1/(1 + exp(-1.7155*z - 0.2716*z³))
    // Top half: "Better than 96% of NYC coffee locations we've analyzed"
    // Middle: plain-language — avoid percentile jargon
    // Below average: no "top" word, no percentile suffix — plain comparison
    // ── Doc 09 Intelligence: per-concept failure rates, cost structure, regulatory ──
    // Failure rate context line below the hero
    // Segment Intelligence from AddressAnalyzer (C2 fix: wire into E2b)
    // Fit IQ dimension rings from AddressAnalyzer (H2 fix: surface in E2b)
    // Error state for analysis failures
    // UXFIX-02: scoredAt for meta-line — reads from session on mount, updated after each score run
    // Addendum §2.4: Re-score comparison — track previous score so we can show "was X, now Y"
    // E2b: Vision form state — P1-A: initialize visionBizType from session.bizType at
    // declaration time so concept shows correctly on every render, including after back-navigation.
    // FIX-B: writes canonical key to session at page init
    // conceptAnswers: must be declared AFTER _initSess (line above) to avoid TDZ ReferenceError (caused 500 in 8c8eb7b)
    // B4 FIX: Re-read bizType from launchpad on navigate so concept doesn't stay stale
    /* noop */
    // Concept-aware initialization: food program and hours must match the CURRENT concept,
    // not a stale value from a previous session with a different concept type.
    // Only restore food program from session if it was set for a food concept; otherwise default to 'none'
    // Restore hours from session if present, otherwise use concept-appropriate default
    // L4 FIX: initialize from session like all other vision fields (was async-only via applyConceptDefaults
    // which caused completionPct to compute as 0-diff on first render → PRELIM badge flicker on restore)
    // RE²D2: Differentiator classifier state
    // V2: Credit score range for loan pre-qualification (persisted to session)
    // B-commit: New Vision IQ fields (persisted to session)
    // Vision IQ Completion Dial — weighted % (all fields must be filled for 100%)
    // Weights: BizType 8, StoreType 7, TargetSize 7, AvgCheck 12, Client1 7, TargetAge 7,
    //          FoodProgram 7, Hours 7, Differentiators 12, Employees 5, CreditScore 7, Capital 7, ConceptQs 7
    // Business Type: 8% — always filled (auto-set from onboarding)
    // Store Type: 7%
    // Target Size: 7%
    // Avg Check: 12% — any non-empty value counts (range strings from onboarding are valid)
    // Target Clients: 7%
    // Target Age: 7% — any non-empty value counts (defaults are valid choices)
    // Food Program: 7% — non-food concepts get full credit; food concepts count any selection
    // Hours: 7% — always has a value (auto-set), so always filled
    // Differentiators: 12% — ≥2 meaningful words (length > 2)
    // Employees: 5%
    // Credit Score: 7%
    // Initial Capital: 7%
    // Concept Questions: 7% — always credited (optional score boosters, not completion gates)
    // FIX: removing async timing bug where questions loading post-analysis dropped pct by 7%
    // causing completion to never reach 100% even when all visible fields are filled.
    // visionFieldsComplete is already 0–100 (weighted %)
    // PRELIM badge disappears ONLY at 100% — all fields filled
    // UX-05: Count filled vs total fields for PRELIM reframe
    // excludes concept questions (always credited)
    // BR-02: Score confidence envelope — derived client-side using the exact thresholds
    // the server applies (<0.5 preliminary / <0.85 partial / >=0.85 confident). Mirrors
    // what GET/POST /api/location-iq returns so UX-06 PRELIM stamp reads a single source.
    // UX-05: Real maxUpside from /api/score/preview — replaces hand-tuned +N pts formula.
    // Falls back to the old heuristic (remaining * 1, clamped 3-12) until the first preview
    // response lands so the UI never shows 0 on initial render.
    // BR-09: Concept Pulse envelope — built on the client with the same helpers
    // the server uses (pulseTier / conceptRevenueModel / pulseNarrative / getConceptScanRadius).
    // Shape identical to GET /api/location-iq so UX reads it instead of recomputing tiers.
    // ── UX-19 / UX-23: Lazy GET /api/location-iq fetch (BR-05 + BR-06) ────────
    // The full GET endpoint returns dataFreshness (21 sources × status × cadence)
    // and lenses (6 dimension slices with verdicts, signals, map highlights,
    // CoPilot prompts). It's expensive — touches every intel source — so the
    // client only calls it when the user actually opens the Data Sources modal
    // or flips a lens tab. Results are cached by analysis address so repeat
    // opens don't re-hammer the pipeline.
    // §1b (April 11): confidenceBySource is the sibling map Brain ships on
    // /api/location-iq GET/POST. Six lens dimensions + vision (0-100 each).
    // GET always ships vision: 0; UX overrides it locally from visionCompletionPct.
    // UX-3.1: kill factors from Brain 3
    // UX-3.2 + B3-1.5: grade cap + authoritative verdict from Brain 3
    // R6-2: Persist lens cache to sessionStorage so back-nav doesn't re-fetch
    // D14: Guard against stale coords. analysisStore.mapLat/analysisStore.mapLng default to Midtown (40.7580/-73.9855)
    // and are updated asynchronously from localStorage only when loc.addr === analysisAddress.
    // If the match hasn't happened yet, we'd fire the lens fetch with the wrong coords.
    // Verify coords correspond to the current analysisAddress via re2_selected_location.
    // Stored coords are for a DIFFERENT address — geocoder hasn't resolved yet.
    // Skip the fetch; it will be retried when coords settle.
    // localStorage parse failed — fall through with reactive coords
    // B1: Pass priceLevel (+ avgTicket/visionTier if available) to scoring API
    // Fallback: derive avgTicket/visionTier from priceLevel for coffee concepts
    // UX-19 / UX-I: Active lens selection. Flipping to a lens triggers the
    // lazy GET fetch (cached by address) the first time; subsequent flips
    // are instant.
    //
    // UX-I relabel + reorder per RE2-UX-Sprint-April11.md §2 — six purposeful
    // lenses with founder-language labels. Dimension keys still map 1:1 to
    // the BR-06 slice envelope (no Brain dependency); only the surface
    // copy and display order change.
    // §1b (April 11): Effective confidenceBySource — starts from whatever Brain
    // shipped on the payload. POST now ships a real `vision` value (Brain follow-up
    // 1fe6909); GET still ships `vision: 0`. When the server sends 0 we fall back
    // to the client-side visionCompletionPct so the vision lens doesn't render as
    // a skeleton pill on first load. When the server sends a real value (POST path)
    // we trust it because it factors in server-side completeness + error penalties.
    // R6-1: Backfill — if real sixScores exist but confidence is missing/0, treat as confirmed.
    // Fixes GET/cached path where confidence wasn't persisted but scores were.
    // Convenience tier lookups — components read these instead of recomputing.
    // Map dimension key → confidence tier, used by the 6-lens card header.
    // Hero percentile + LocationIQ overall confidence: aggregate across the six
    // location dimensions (vision excluded — vision is a separate score). Simple
    // average then classify. If the payload hasn't arrived yet, render 'full'
    // optimistically so the hero doesn't flicker to skeleton on every page load.
    // UX-23: Data Sources modal state. Opens on "View data sources" click near
    // the hero; lazy-fetches the GET envelope on first open (cached after).
    // Only fetch if we don't already have freshness data cached for this address
    // Grouped sources for the modal render — the 6 canonical categories in the
    // order the UX spec wants them (demographics first, momentum last).
    // ── UX-20: Live score preview (BR-04) ─────────────────────────────────────
    // Debounced POST to /api/score/preview that recomputes Vision IQ + Fit IQ from
    // partial Vision answers WITHOUT hitting the 20-source intel pipeline or DB.
    // Fires any time Vision inputs change (concept answer, hours, avg check, food
    // program, differentiator, etc.) so the hero ring animates to the new score in
    // <300ms. The canonical /api/location-iq POST still owns persistence; this is
    // a trajectory indicator only.
    // The 8 dimension keys /api/score/preview requires, pulled from whichever
    // source is populated (sixIndex payload is preferred because it matches the
    // server's IndexName contract verbatim; sixScores is the flattened fallback).
    // preview endpoint 400s on missing keys
    // Addendum Item 2: Pass avgTicket + visionTier from launchpad to scoring API
    // Fallback: derive avgTicket/visionTier from priceLevel for coffee concepts
    // ── Shadow Mode: Check against new engine ──
    // We fall back to 360610076001 if geoid isn't available dynamically for testing.
    // UX-05: Store real maxUpside from preview response
    /* preview is best-effort — silent failure keeps canonical score intact */
    // Public trigger — debounces ~300ms so chained keystrokes / click bursts
    // collapse into a single preview POST. Safe to call from any handler.
    // BR-12: Per-field status for Co-Pilot context — which fields are filled vs skipped.
    // Co-Pilot uses this to give targeted completion guidance instead of generic "fill Vision IQ".
    // C2-FIX-02: stale geocode callback guard — prevents prior analysis results corrupting new session
    // Track vision form revision count to trigger reactive recalc
    // E2b: RE² Insights toggle
    // E2b: Map expand toggle
    // E2b: Tab state for tabbed interface
    // CRITICAL-2: force-refresh clears the score cache so the engine re-runs
    // Addendum §2.4: Capture previous score before clearing so we can show comparison
    // invalidate cache
    // Addendum Step 4: Clear coffee score localStorage cache so fresh API data flows in
    // Reset and re-trigger via addr param
    // trick $effect into re-running
    // FIND-B-04: "Try Another Location" — clear result, scroll top, autofocus input
    // wait for {#if !hasResult} branch to mount
    // AddressAnalyzer renders .search-input inside .search-panel
    // P1-D: CoPilot collapse toggle with localStorage persistence
    // UX-FIX-01: Mapper fix banner (same flag as dashboard)
    // V3 Layout state
    // UX-FIX-7 (Emergency Fix April 11): "How to gain points" shows top-3 most
    // impactful levers by default; this toggle reveals the rest on demand.
    // §1c (April 11): Category-grouped rendering for "How to gain points".
    // Ordered list of category keys so group headers always render in a
    // predictable reading order regardless of which categories have items.
    // `operations` is reserved for future signals (rent burden, daypart
    // fit). No current signal emits it so this section stays empty today.
    // UX-FIX-2 (Emergency Fix April 11): Single shared AskAnything handler.
    // Every ask — hero chips, hero "How?" button, bottom copilot bar, per-lens "Ask
    // CoPilot →", or the inline input — goes through askCopilot(text). It pushes a
    // user message, opens the inline CP card, calls handleCoPilotMessage (which posts
    // to /api/copilot/location), then pushes the reply onto the SAME inlineCpMessages
    // list rendered on-screen. This is the bug the brief flagged — the chips were
    // firing but their replies were being dropped on the floor.
    // R6-3: Persist CoPilot history to sessionStorage keyed by address
    // Open & pin the inline card so the answer surface is visible.
    // UX-FIX-2: bottom bar + inline input both route through askCopilot.
    // UX Order 5: Bot-handoff timeout — cycles progress messages every 2s, fires Try Again after 15s
    // Start progress message cycle (every 2s)
    // Start 45s timeout
    // Detect failed analysis from store steps
    // BUG-005: Clear stale scores immediately when navigating to a new address
    // URL params use + for spaces; session/localStorage stores decoded addresses.
    // Decode before any comparison so "273+5th+avenue" matches "273 5th avenue".
    // FIX-003: Clear stale scoring data on every new address submission
    // FIX: also clear re2_selected_location so map/address don't snap to old location
    // C2-FIX-02: stamp active analysis token so stale async callbacks can be discarded
    // Use DECODED addr so handleScoresReady comparison works correctly.
    // 04.22.2026 Deprecating: L1 FIX localStorage competitor fallback.
    // Competitors are now exclusively provided by the server via
    // officialCompetitorsInfo in GET /api/location-iq response.
    // See bundle-builder.ts for the canonical competitor pipeline.
    // The localStorage read below has been commented out.
    // L1 FIX (ALWAYS): restore competitors from localStorage on ANY address load —
    // not just cache hits. handleScoresReady fires ~100ms later; if allComps=0 the
    // guard at line ~905 preserves these so the map shows known competitors immediately.
    // CRITICAL-2: if this addr matches session cache, restore from cache instead of resetting
    // BR-5 Option A: snapshot is canonical until user explicitly Re-scores. CACHE_TTL removed.
    // FIX: guard against false cache hits where originalAddrParam matches but analyzedAddress
    // is a completely different location. Compare leading house numbers — if they differ it's
    // a stale cross-session collision (e.g. "10 W 93rd" param but "215 W 90th" in session).
    // Compare decoded URL param so "273+5th" matches "273 5th" in session
    // BR-3: Guard against all-zero sixScores in cache — if every signal is 0, the six-index failed.
    // Treat as cache miss so scoring re-runs and real signals populate.
    // BR-5 § 5.1: no TTL — cache is permanent until Re-score action fires
    // P0-3: Restore scores from cache directly so they're available immediately
    // Use URL param address (what user typed) as canonical display address
    // C4-2: seed Vision IQ defaults on cache-restore path
    // Populate borough label from geoid for neighborhood display
    // Reset all score state so stale scores don't flash while new search runs
    // FIX: also clear stale selected_location so map doesn't snap to wrong address coords
    // FIX-003: Address-mismatch guard — detects cross-session contamination via re2_location_intel
    // FIX-006: Concept-aware avg check defaults (single numeric strings, no ranges)
    // C4-2: Standalone concept-default seeder — called from both live-analysis and cache-restore paths.
    // Reads saved vision fields from session before overwriting so user edits are never clobbered.
    // FIX-009: propagate onboarding hours selection → Vision IQ hours field
    // FIX-006: prefer numeric default from AVG_CHECK_DEFAULTS over range strings from defs
    // BUG-6 FIX: restore visionDifferentiators from session so _hasCustomDiff stays true on reload.
    // Without this, cache-restore blanks the differentiators field → _userHasCustomized=false
    // → visionIQ snaps back to serverVisionIQ → $effect overwrites session.visionIQ with lower value.
    // Callback when AddressAnalyzer produces scores
    // C2-FIX-02: Discard stale async callbacks from a prior analysis run
    // Track timeout/error state: if scoringTimedOut flag is true, mark as failed
    // Addendum §2.4: If this was a re-score, build comparison for the user
    // consume — only show once
    // BRAIN-NEW-01: reset on every new analysis
    // P0-3: Ensure hasResult flips true even on cache-restore path (comingFromBot reload)
    // C1 fix: Store server-side Fit IQ as source of truth (unifies CoPilot + UI)
    // FIX-C: Store server-side Vision IQ from DB calibrated model
    // BR-13: store data completeness for UI + Co-Pilot context
    // BR-14: store data vintage timestamp
    // FIX-011: store competitor data quality for transparency badges
    // ISS-03: Let Svelte 5 $derived recompute fitIQ (now: dynamicFitIQ or serverFitIQ only)
    // before we write it to localStorage. Without this tick(), fitIQ still holds the stale
    // pre-score value and Dashboard reads a different number than the LIQ rings show.
    // Auto-trigger score/preview for coffee concepts so the 6-dimension formula
    // with avgTicket/visionTier overwrites the stale batch score via dynamicFitIQ.
    // $derived fitIQ already prioritizes dynamicFitIQ over serverFitIQ.
    // R1-3: Auto-fire lens GET so lens data is ready when the user scrolls down.
    // Without this, the lens area shows "Lens data unavailable" until user clicks a pill.
    // C2 fix: Store segment intelligence for E2b rendering
    // H2 fix: Store Fit IQ dimension rings for E2b rendering
    // V3 FIX: Use server-provided competitor data (Source of Truth)
    /* 04.21.2026 Deprecated: Frontend logic leak
    // V3: Extract concept-aware analysisStore.competitors from ALL available sources:
    // 1. store.searchResult.data (raw Overpass from AddressAnalyzer)
    // 2. liveIntel.competitors.amenities (Overpass → Foursquare/Google/MarketDensity backfill)
    // 3. liveIntel.places (Google Places nearby)
    // 4. liveIntel.yelp.directCompetitors (Yelp concept-specific)
    try {
    	const allComps: Array<{name: string, lat: number, lng: number, dist?: number, type?: string}> = [];
    	const concept = writeCanonicalConcept(visionBizType || store.bizCategory || 'specialty_coffee');
    	const seenNames = new Set<string>();
    	const addComp = (name: string, lat: number, lng: number, dist?: number, type?: string) => {
    		const key = (name || '').toLowerCase().trim();
    		if (seenNames.has(key)) return;
    		seenNames.add(key);
    		allComps.push({ name, lat, lng, dist, type });
    	};
    
    	// Concept → relevant Overpass categories mapping
    	const FOOD_BEV = ['specialty_coffee', 'bakery', 'fast_casual', 'full_service_restaurant', 'qsr', 'bar_nightlife', 'juice_bar', 'wellness_beverage'];
    	const FITNESS_WELLNESS = ['fitness_studio', 'wellness_spa', 'personal_services'];
    	const HEALTH_MEDICAL = ['medical_office'];
    
    	// ── Source 1: Raw Overpass from AddressAnalyzer (store.searchResult.data) ──
    	const data = store.searchResult?.data as Record<string, any> | undefined;
    	if (data) {
    		if (FOOD_BEV.includes(concept) || concept === 'retail' || concept === 'florist') {
    			for (const c of (data.cafes || [])) {
    				if (c.lat && c.lon) addComp(c.name || 'Cafe', c.lat, c.lon, c.dist, 'Cafe');
    			}
    			for (const c of (data.restaurants || [])) {
    				if (c.lat && c.lon) addComp(c.name || 'Restaurant', c.lat, c.lon, c.dist, 'Restaurant');
    			}
    		}
    		if (FITNESS_WELLNESS.includes(concept)) {
    			for (const c of (data.gyms || [])) {
    				if (c.lat && c.lon) addComp(c.name || 'Gym', c.lat, c.lon, c.dist, 'Gym');
    			}
    			for (const c of (data.yoga || [])) {
    				if (c.lat && c.lon) addComp(c.name || 'Yoga', c.lat, c.lon, c.dist, 'Yoga');
    			}
    		}
    		if (FITNESS_WELLNESS.includes(concept) || HEALTH_MEDICAL.includes(concept) || concept === 'juice_bar' || concept === 'wellness_beverage') {
    			for (const c of (data.health || [])) {
    				if (c.lat && c.lon) addComp(c.name || 'Health', c.lat, c.lon, c.dist, 'Health');
    			}
    		}
    	}
    
    	// ── Source 2: liveIntel.competitors.amenities (enriched — Google Places + Foursquare + MarketDensity backfill) ──
    	// D15: type now includes bars, wellness, retail, personal (matches overpass.ts OverpassData shape)
    	const intelComps = result.liveIntel?.competitors as {
    		amenities?: {
    			cafes?: any[]; restaurants?: any[]; gyms?: any[]; yoga?: any[]; health?: any[];
    			bars?: any[]; wellness?: any[]; retail?: any[]; personal?: any[];
    		}
    	} | undefined;
    	if (intelComps?.amenities) {
    		const am = intelComps.amenities;
    		if (FOOD_BEV.includes(concept) || concept === 'retail' || concept === 'florist') {
    			for (const c of (am.cafes || [])) {
    				if (c.lat && c.lng) addComp(c.name || 'Cafe', c.lat, c.lng, c.distance, 'Cafe');
    			}
    			for (const c of (am.restaurants || [])) {
    				if (c.lat && c.lng) addComp(c.name || 'Restaurant', c.lat, c.lng, c.distance, 'Restaurant');
    			}
    		}
    		// D15: bar_nightlife must iterate bars — previously missing, caused "0 competitors" on Rivington LES
    		if (concept === 'bar_nightlife' || concept === 'bar') {
    			for (const c of (am.bars || [])) {
    				if (c.lat && c.lng) addComp(c.name || 'Bar', c.lat, c.lng, c.distance, 'Bar');
    			}
    			// Bars also compete for late-night spend with restaurants
    			for (const c of (am.restaurants || [])) {
    				if (c.lat && c.lng) addComp(c.name || 'Restaurant', c.lat, c.lng, c.distance, 'Restaurant');
    			}
    		}
    		if (FITNESS_WELLNESS.includes(concept)) {
    			for (const c of (am.gyms || [])) {
    				if (c.lat && c.lng) addComp(c.name || 'Gym', c.lat, c.lng, c.distance, 'Gym');
    			}
    			for (const c of (am.yoga || [])) {
    				if (c.lat && c.lng) addComp(c.name || 'Yoga', c.lat, c.lng, c.distance, 'Yoga');
    			}
    			for (const c of (am.wellness || [])) {
    				if (c.lat && c.lng) addComp(c.name || 'Wellness', c.lat, c.lng, c.distance, 'Wellness');
    			}
    		}
    		if (FITNESS_WELLNESS.includes(concept) || HEALTH_MEDICAL.includes(concept) || concept === 'juice_bar' || concept === 'wellness_beverage') {
    			for (const c of (am.health || [])) {
    				if (c.lat && c.lng) addComp(c.name || 'Health', c.lat, c.lng, c.distance, 'Health');
    			}
    		}
    		// D15: retail and personal_services also need their buckets
    		if (concept === 'retail' || concept === 'boutique' || concept === 'florist') {
    			for (const c of (am.retail || [])) {
    				if (c.lat && c.lng) addComp(c.name || 'Retail', c.lat, c.lng, c.distance, 'Retail');
    			}
    		}
    		if (concept === 'personal_services' || concept === 'salon' || concept === 'barbershop') {
    			for (const c of (am.personal || [])) {
    				if (c.lat && c.lng) addComp(c.name || 'Personal', c.lat, c.lng, c.distance, 'Personal');
    			}
    		}
    	}
    
    	// ── Source 3: liveIntel.places (Google Places Nearby Search) ──
    	// FIX: liveIntel.places is ALREADY the array, not { places: [...] }
    	const intelPlaces = result.liveIntel?.places;
    	const placesArr = Array.isArray(intelPlaces) ? intelPlaces : (intelPlaces as any)?.places || [];
    	for (const p of placesArr) {
    		if (p.lat && p.lng) addComp(p.name || 'Nearby Business', p.lat, p.lng, p.distance, 'Competitor');
    	}
    
    	// ── Source 4: Yelp directCompetitors — already concept-specific, always include ──
    	type YelpComp = { name?: string; lat?: number; lng?: number; distance?: number; primaryCategory?: string };
    	const yelpData = result.liveIntel?.yelp as { directCompetitors?: YelpComp[] } | undefined;
    	if (yelpData?.directCompetitors) {
    		for (const c of yelpData.directCompetitors) {
    			if (c.lat && c.lng) addComp(c.name || 'Competitor', c.lat, c.lng, c.distance, c.primaryCategory || 'Competitor');
    		}
    	}
    
    	// Only overwrite if we actually found analysisStore.competitors — cache-hit path has no scanData
    	// so allComps = 0 should NOT destroy the localStorage restore (L1 FIX preservation).
    	if (allComps.length > 0) {
    		analysisStore.competitors = allComps;
    		try {
    			localStorage.setItem('re2_competitors', JSON.stringify({ addr: result.address, items: allComps }));
    		} catch {}
    	}
    	console.log(`[RE²] competitors extracted: ${allComps.length} from 4 sources`);
    	// BRAIN-NEW-01: Mark scan complete regardless of count — 0 competitors is a real result.
    	analysisStore.competitorScanStatus = 'complete';
    } catch (e) {
    	console.warn('[RE²] Competitor extraction failed:', e);
    	analysisStore.competitorScanStatus = 'failed';
    }
    */
    /* 04.21.2026 Deprecated: Frontend logic leak
    // Fallback: if analysisStore.competitors still 0, read from cached liveIntel in localStorage
    if (analysisStore.competitors.length === 0) {
    	try {
    		const cachedIntel = JSON.parse(sessionStorage.getItem('re2_location_intel') || '{}');
    		const fallbackComps: Array<{name: string; lat: number; lng: number; dist?: number; type?: string}> = [];
    		const seen2 = new Set<string>();
    		const addFb = (arr: any[], type: string) => {
    			for (const c of (arr || [])) {
    				const key = (c.name || '').toLowerCase().trim();
    				if (key && !seen2.has(key) && (c.lat || c.latitude) && (c.lng || c.longitude || c.lon)) {
    					seen2.add(key);
    					fallbackComps.push({ name: c.name, lat: c.lat || c.latitude, lng: c.lng || c.longitude || c.lon, dist: c.distance, type });
    				}
    			}
    		};
    		// Try all known shapes
    		addFb(cachedIntel?.competitors?.amenities?.cafes, 'Cafe');
    		addFb(cachedIntel?.competitors?.amenities?.restaurants, 'Restaurant');
    		addFb(cachedIntel?.competitors?.amenities?.gyms, 'Gym');
    		const pl = cachedIntel?.places;
    		addFb(Array.isArray(pl) ? pl : pl?.places || [], 'Competitor');
    		addFb(cachedIntel?.yelp?.directCompetitors, 'Competitor');
    		if (fallbackComps.length > 0) {
    			analysisStore.competitors = fallbackComps;
    			console.log(`[RE²] competitors fallback from localStorage: ${fallbackComps.length}`);
    		}
    	} catch {}
    }
    */
    // Update map position from geocoded coordinates
    // FIX: only use re2_selected_location coords if addr matches — prevents map snapping to old location
    // Populate borough label from geoid when neighborhood isn't set from stored data
    // Store the composite score in localStorage so Recommendations can read it
    // CRITICAL-2: cache timestamp for 24h TTL
    // FIX-01: Write bizType + visionBizType so Business Case reads correct concept
    // Also reset downstream lock states — new analysis = fresh start for every module
    // FIX: persist serverVisionIQ so cache-restore path shows PRELIM correctly
    // P2-1 FIX: Write neighborhoodHealth + survivalRate into sixScores directly
    // Transparency page reads session.sixScores[key] — they must be inside sixScores, not top-level
    // keep legacy top-level too
    // F-22: isPartialSeed — block group has sparse entity coverage (< 10 POIs).
    // Financials page reads this to show a nudge card instead of the survival grid
    // when data is insufficient for reliable survival rate estimates.
    // DASHBOARD: Upsert into scoredLocations[] so all analyzed locations appear on dashboard.
    // Also writes conceptType here — this replaces T9/Brain Task 1.
    // P3-01: seed targetRevY1 so Dashboard revenue sort has a value before user visits Business Case
    // BR-5 § 5.2: compute real inputs_hash on initial score (browser-safe Web Crypto)
    // 04.22.2026: CANONICAL PERSISTENCE POINT.
    // getCanonicalScores() now trusts the server's fitScore directly
    // (no more rogue 0.75x formula). The entry written below is the
    // official LocationSnapshot persisted to localStorage and synced
    // to Supabase via session-sync.
    // BRAIN-NEW-02: Use getCanonicalScores() — pure function, no Svelte reactivity race.
    // This replaces reading $derived fitIQ/visionIQ which can hold stale values.
    // BRAIN-NEW-02: store sixScores so Dashboard getVerdict() + computeKillFactors() have real signal data
    // BR-5 § 5.2: snapshot fields
    // BR-5 § 5.2: stable SHA-256 of scoring inputs for drift detection
    // Seed businessCase.revenueY1 from financial goals so dashboard sort works before BC page visit
    // isPartialSeed: true flags this as pre-model data — Dashboard suppresses profit/break-even until Financials page runs
    // Trigger NavigationDrawer to re-evaluate unlock state reactively
    // GATE-2: Also fire custom event so same-tab layout listener fires (storage event is cross-tab only)
    // AUTO-SAVE: background sync to Supabase L2 — fire-and-forget, never blocks UX
    // Write location coordinates for downstream pages
    // Write full location intel (six scores + composite + live intel) for downstream pages
    // Include liveIntel data if available (walkScore, crime, census, inspections, etc.)
    // FIX-OB-01: Write scoredLocations + lastAddress to launchpad so that:
    // (a) onboarding initBot() can show super-user message ("You've got N locations")
    // (b) welcome-back server lastScore/lastAddress resolves correctly
    // (c) Supabase sync carries location data into founder_sessions.full_data
    // BRAIN-NEW-02: Use same canonical scores as the first write (no stale $derived race).
    // BRAIN-NEW-02: find prior entry to preserve pinned/documents/businessCase/scorer_version/inputs_hash
    // preserve existing fields (pinned, documents, businessCase, inputs_hash, scorer_version)
    // BRAIN-NEW-02: sixScores enables Dashboard getVerdict() + computeKillFactors() to show specific insights
    // R-6: persist blockLabel from API so Dashboard card reads it directly
    // Dedupe: if same address was scored before, replace it
    // FIX-SAVE-01: also persist these at top level so server reads can find them
    // Non-critical — localStorage session already has the data
    // Resize map after competitors are set
    // mapRef?.resize(); // 04.25.2026: removed — mapRef migrated to analysisStore, no longer accessible here
    // C4-2: Apply concept defaults via shared function (also called from cache-restore path)
    // UX-DELTA-02: launchpad.businessType wins over stale store.bizType
    // P1-A: Persist resolved vision fields to session so they survive reload
    // BUG-6 FIX (part A): Write visionIQ here so session always has the post-scoring computed value.
    // The $effect at line ~1082 also writes it, but only when fitIQ > 0 && hasResult.
    // Writing here ensures the cache-restore path also gets the updated value.
    // BUG-6 FIX (part B): persist differentiators so they survive cache-restore.
    // Load Vision IQ questions for this business type
    // Fire AI insights in background (non-blocking)
    // ── REACTIVE COMPETITOR EXTRACTION ──────────────────────────────────────────
    // handleScoresReady fires first from the block-group fast path when
    // store.searchResult and store.liveIntel are BOTH still undefined → competitors=0.
    // The second call (live path) only fires when liveIntel succeeds AND computeSixIndex
    // returns valid indices. If liveIntel fails (Netlify 10s timeout), the second call
    // never fires and competitors stays at 0 forever.
    // 04.22.2026 Deprecating: This $effect client-side competitor extraction is a logic
    // leak. Competitors are now provided by the server via officialCompetitorsInfo
    // in the GET /api/location-iq response (built by buildLocationScoreBundle).
    // This $effect should be removed once server-provided competitors are confirmed
    // to always arrive. Keeping it active for now as a safety net, but its localStorage
    // write has been gated.
    // This $effect reactively re-extracts competitors when data becomes available.
    // CRITICAL: use untrack() on competitors to avoid Svelte 5 circular reactivity
    // (reading + writing the same $state in an effect kills the effect).
    // Also read liveIntel from searchResult itself (set at same time as store.liveIntel)
    // Only run when we have SOME data source and analysisStore.competitors is still empty
    // untrack prevents competitors from becoming a dependency → no circular reactivity
    // Source 1: Raw Overpass from store.searchResult.data
    // D15: bars missing from raw Overpass iteration for bar_nightlife concepts
    // Source 2: liveIntel.competitors.amenities (use effectiveLI which merges both sources)
    // D15: extended type to include bars/wellness/retail/personal buckets from OverpassData
    // D15: iterate bars for bar_nightlife
    // Source 3: liveIntel.places (Google Places Nearby Search)
    // Source 4: Yelp directCompetitors
    // 04.22.2026 Deprecating: L1 localStorage write from $effect path.
    // Competitors should only be cached when received from the server.
    // L1: also persist from $effect path (covers liveIntel-only case)
    // Co-Pilot: send user question to /api/copilot/location
    // P0-D FIX: Gate on analysisAddress (always set after analysis), not geoid (often null for outer boroughs).
    // Also pass full scoring context so the AI actually knows what's on screen.
    // BUG-JWT-COPILOT (2026-04-18)
    // requireAuth() on the server reads Authorization: Bearer <token>.
    // apiFetch() is a plain fetch wrapper — it NEVER injects a Bearer token,
    // so every call returned 401 immediately. authedFetch() calls
    // Clerk.session.getToken({ skipCache: true }) before each request and
    // sets the Authorization header automatically.
    // Full scoring context — the AI needs this to answer questions about the current page
    // BR-07: enriched with verdict, kill factors, analysisStore.competitorScanStatus
    // UX-DELTA-05: launchpad-first
    // For editorial-signals lookup. Prefer a real neighborhood name; fall back
    // to the full address (getNeighborhoodBuzz does fuzzy substring matching).
    // Strip borough-only values from the geoidToBorough fallback path — they
    // won't match any neighborhoodBuzz key and just prevent address fallback.
    // Match UI display priority: sixIndex live value wins over cached sixScores
    // FIX-D: marketProof comes from fitSubScores (Cycle 2H), not sixScores
    // Also surface the two highest-impact signals for CoPilot context
    // BR-UX-07: send canonical grade + tier + nextTier + score so the CoPilot can
    // frame answers in BR-1 vocabulary instead of raw numbers. All derived via
    // decision-engine helpers — single source of truth.
    // BR-07 enrichments — make Co-Pilot responses more specific and less generic:
    // BR-12: Vision IQ completion — lets Co-Pilot guide the founder on what to fill in
    // BR-13: data source coverage — Co-Pilot can say "based on N of M sources"
    // BR-14: data freshness — Co-Pilot can reference when data was fetched
    // COP-01: DOF property tax snippet (per-address, not block-group)
    // UX-DELTA-05: launchpad-first
    // Derived: Location IQ — read from localStorage if set by callback, else compute from sixScores
    // DYNC-008: concept-aware fallback weights (API result overwrites on success)
    // ── VISION IQ: Dynamic scoring from form inputs + location data ──
    // Vision IQ measures how well THIS concept fits THIS location.
    // It recomputes every time a Vision form field changes.
    // UX-2.4: VISION_ARCHETYPES + DEFAULT_ARCHETYPE now imported from
    // $lib/constants/visionArchetypes (B2-1.4). Previously inlined here; server
    // routes (e.g. /api/score/preview) couldn't consume it, causing 5–10 point
    // visionIQ drift between client and server. Shared module eliminates that.
    // C2-FIX-05: Fallback daypart map when getConceptDefaults hasn't set visionHours
    // Normalize onboarding hours values to canonical scoring categories (morning/evening/all_day)
    // Resolved visionHours — uses session value, falls back to concept map, then 'all_day'
    // ── Vision IQ 4-panel: concept group → drives label + field slot swaps ────
    // Panel 2: avg check label adapts per group
    // Panel 2: avg check placeholder adapts per group
    // Panel 3 slot 3: F&B shows Food Program, all others show Team Size
    // Panel 3: target size placeholder shows concept-appropriate hint
    // Panel completeness per panel (drives pts badge colour)
    // Vision IQ — DYNAMIC: reacts to form inputs + location data
    // Touch visionRevision to subscribe to form changes
    // Use real location signals when available; neutral NYC baseline (50) before address is analyzed
    // This lets founders see concept-driven score changes BEFORE picking an address
    // ── Dimension 1: Competition fit (concept-specific) ──
    // Lower competition = better for new entrants
    // High competition score = low competition density = good
    // ── Dimension 2: Price-Income fit ──
    // Does the avg check align with area median income?
    // Annual dining spend ≈ check * visits/week * 52
    // Affordable if annual spend < 8% of income (routine) or 4% (destination)
    // ~2.5 visits/week assumption
    // routine vs destination
    // No income data: check if avg check is in ideal range for archetype
    // ── Concept-specific price ceiling — prevents income-paradox in high-income areas ──
    // Without this, a $95 coffee in SoHo (medianIncome $120K) can score HIGHER than $8.75
    // because the spendRatio formula rewards being closer to idealRatio × income.
    // A $95 coffee is wrong everywhere; income level doesn't change that.
    // ── Dimension 3: Age/demographics alignment ──
    // Bonus if area age profile matches target (young area + young target, etc.)
    // Young crowd + vibrant area
    // Older crowd + safe area
    // Universal sweet spot
    // ── Dimension 4: Hours/accessibility fit ──
    // Normalize raw visionHours value to canonical scoring category
    // Penalty for mismatch: morning-only business in evening-dominated area
    // ── Dimension 5: Food program fit ──
    // ── Dimension 6: Differentiator bonus ──
    // Completion bonus: rewards founders who specify their vision vs. leaving defaults
    // BUG-10 FIX: compare against concept-specific default, not hardcoded coffee defaults.
    // applyConceptDefaults() sets visionAvgCheck to '24' for bar_nightlife, '25' for fitness, etc.
    // Those values were not in the old ['$5.50','5.50','$6–10'] list → _hasCustomCheck = true
    // → _userHasCustomized = true → FIX-C never activated → client score (86–92) shown always.
    // AF-03 FIX: reduced from max-20 to max-13 so completionBonus can't overwhelm price/income penalties
    // ── Dimension 7: Rent-to-revenue fit (F2 feedback) ──
    // If founder has entered a rent budget, grade it against concept-specific max rent % of revenue
    // severe: 1.5× over benchmark
    // over benchmark
    // well within — small bonus
    /* no launchpad data — skip */
    // ── Dimension 8: Store type fit (B-commit new field) ──
    // ── Dimension 9: Target size fit (B-commit new field) ──
    // Concept-specific ideal size ranges (sqft midpoint)
    // oversized = rent burden
    // ── Dimension 10: Target client fit (B-commit new field) ──
    // selected but doesn't match area = neutral
    // ── Weighted composite ──
    // price-income uses demographics weight
    // age uses vibrancy weight
    // hours uses foot traffic weight
    // food is a fixed 10% factor
    // Normalize: weights sum to 1.0 (archetype) + 0.10 (food) = 1.10
    // New field modifiers are additive (like diffBonus/rentPenalty) to preserve calibration
    // FIX-C: When the user hasn't meaningfully customized their concept inputs (i.e. still on defaults
    // with no differentiators entered and no concept questions answered), prefer the DB-calibrated
    // server Vision IQ — it's the ensemble model score for this exact block group × concept.
    // Once the user starts editing (differentiators, avg check, concept Qs), client score takes over.
    // ── Vision validation flags ── red flags for absurd or misaligned inputs
    // subscribe to form changes
    // Flag 1: Absurd pricing (>5× concept high end)
    // Flag 2: Below viable floor (<40% of low end)
    // Flag 3: No differentiators entered
    // Flag 4: Hours conflict with concept peak times
    // Flag 5 (F2): Rent-to-revenue kill factor
    /* skip */
    // Derived: Fit IQ — UNIFIED score (C1 fix: server-side is source of truth)
    // When server-side fitScore is available (from block_group_intel or fit-iq-engine.ts),
    // use it directly so the CoPilot and UI always agree.
    // Falls back to client-side 55/45 blend only when server score is unavailable.
    /* 04.22.2026 Deprecated: Client-side fitIQ blend with visionAdj + founderMod.
     * The old formula used base = serverFitIQ (or locationIQ * 0.75 when missing)
     * plus a visionAdj (+-10pt from visionIQ) and founderMod (+-8pt from profile).
     * This created a client-only Fit number that differed from the server's canonical
     * fitScore and was incorrectly persisted to localStorage/Supabase.
     *
     * HYBRID APPROACH: fitIQ now shows one of two server-computed values:
     * 1. dynamicFitIQ.score — from POST /api/score/preview (fires ~300ms after
     *    Vision field changes, uses computeCanonicalFitIQ on the server)
     * 2. serverFitIQ — from GET /api/location-iq via buildLocationScoreBundle
     * If neither exists (legacy data), return 0 and UI shows "Re-score needed".
     */
    fitIQ() > 0 && fitIQ() <= 49);
    let gradeCapReason = derived(() => locationIqPayload?.gradeCapReason ?? null);
    let gradeCapped = derived(() => locationIqPayload?.gradeCapped ?? null);
    let apiVerdict = derived(() => locationIqPayload?.verdict ?? null);
    const LIQUOR_CONCEPTS = /* @__PURE__ */ new Set([
      "bar_nightlife",
      "full_service_restaurant",
      "wine_bar",
      "brewery",
      "cocktail_bar"
    ]);
    let rule17Block = derived(() => {
      const d = store.searchResult?.data;
      const topSignals = d?.signals ?? [];
      const blockSignal = topSignals.find((s) => typeof s?.message === "string" && s.message.startsWith("🚫 SLA 200-ft BLOCK"));
      if (!blockSignal) return null;
      const rawConcept = (store.bizType || "").toString().toLowerCase().replace(/\s+/g, "_");
      if (!LIQUOR_CONCEPTS.has(rawConcept)) return null;
      let schoolName = "";
      let distFt = "";
      const match = blockSignal.message.match(/^🚫 SLA 200-ft BLOCK:\s*(.+?)\s+is\s+(\d+)\s*ft/);
      if (match) {
        schoolName = match[1];
        distFt = match[2];
      }
      return { message: blockSignal.message, schoolName, distFt };
    });
    let dynamicVisionIQ = null;
    let dynamicFitIQ = null;
    let conceptQuestions = [];
    let visionScoreDelta = null;
    let visionDeltaTimeout = null;
    const CONCEPT_DIST = {
      specialty_coffee: { mean: 54, sd: 14 },
      cafe_bakery: { mean: 52, sd: 13 },
      fast_casual: { mean: 56, sd: 15 },
      qsr: { mean: 58, sd: 14 },
      full_service_restaurant: { mean: 51, sd: 15 },
      fine_dining: { mean: 46, sd: 16 },
      bar_nightlife: { mean: 53, sd: 14 },
      fitness_studio: { mean: 50, sd: 14 },
      retail: { mean: 55, sd: 15 },
      coworking: { mean: 57, sd: 13 },
      medical_office: { mean: 60, sd: 12 },
      personal_services: { mean: 56, sd: 13 },
      wellness_spa: { mean: 49, sd: 14 },
      yoga_wellness: { mean: 48, sd: 14 },
      juice_bar: { mean: 52, sd: 13 },
      florist: { mean: 54, sd: 12 }
    };
    let percentileText = derived(() => {
      if (
        // Approximate CDF using Abramowitz-Stegun: Φ(z) ≈ 1/(1 + exp(-1.7155*z - 0.2716*z³))
        // Top half: "Better than 96% of NYC coffee locations we've analyzed"
        // Middle: plain-language — avoid percentile jargon
        // Below average: no "top" word, no percentile suffix — plain comparison
        // ── Doc 09 Intelligence: per-concept failure rates, cost structure, regulatory ──
        // Failure rate context line below the hero
        // Segment Intelligence from AddressAnalyzer (C2 fix: wire into E2b)
        // Fit IQ dimension rings from AddressAnalyzer (H2 fix: surface in E2b)
        // Error state for analysis failures
        // UXFIX-02: scoredAt for meta-line — reads from session on mount, updated after each score run
        // Addendum §2.4: Re-score comparison — track previous score so we can show "was X, now Y"
        // E2b: Vision form state — P1-A: initialize visionBizType from session.bizType at
        // declaration time so concept shows correctly on every render, including after back-navigation.
        // FIX-B: writes canonical key to session at page init
        // conceptAnswers: must be declared AFTER _initSess (line above) to avoid TDZ ReferenceError (caused 500 in 8c8eb7b)
        // B4 FIX: Re-read bizType from launchpad on navigate so concept doesn't stay stale
        /* noop */
        // Concept-aware initialization: food program and hours must match the CURRENT concept,
        // not a stale value from a previous session with a different concept type.
        // Only restore food program from session if it was set for a food concept; otherwise default to 'none'
        // Restore hours from session if present, otherwise use concept-appropriate default
        // L4 FIX: initialize from session like all other vision fields (was async-only via applyConceptDefaults
        // which caused completionPct to compute as 0-diff on first render → PRELIM badge flicker on restore)
        // RE²D2: Differentiator classifier state
        // V2: Credit score range for loan pre-qualification (persisted to session)
        // B-commit: New Vision IQ fields (persisted to session)
        // Vision IQ Completion Dial — weighted % (all fields must be filled for 100%)
        // Weights: BizType 8, StoreType 7, TargetSize 7, AvgCheck 12, Client1 7, TargetAge 7,
        //          FoodProgram 7, Hours 7, Differentiators 12, Employees 5, CreditScore 7, Capital 7, ConceptQs 7
        // Business Type: 8% — always filled (auto-set from onboarding)
        // Store Type: 7%
        // Target Size: 7%
        // Avg Check: 12% — any non-empty value counts (range strings from onboarding are valid)
        // Target Clients: 7%
        // Target Age: 7% — any non-empty value counts (defaults are valid choices)
        // Food Program: 7% — non-food concepts get full credit; food concepts count any selection
        // Hours: 7% — always has a value (auto-set), so always filled
        // Differentiators: 12% — ≥2 meaningful words (length > 2)
        // Employees: 5%
        // Credit Score: 7%
        // Initial Capital: 7%
        // Concept Questions: 7% — always credited (optional score boosters, not completion gates)
        // FIX: removing async timing bug where questions loading post-analysis dropped pct by 7%
        // causing completion to never reach 100% even when all visible fields are filled.
        // visionFieldsComplete is already 0–100 (weighted %)
        // PRELIM badge disappears ONLY at 100% — all fields filled
        // UX-05: Count filled vs total fields for PRELIM reframe
        // excludes concept questions (always credited)
        // BR-02: Score confidence envelope — derived client-side using the exact thresholds
        // the server applies (<0.5 preliminary / <0.85 partial / >=0.85 confident). Mirrors
        // what GET/POST /api/location-iq returns so UX-06 PRELIM stamp reads a single source.
        // UX-05: Real maxUpside from /api/score/preview — replaces hand-tuned +N pts formula.
        // Falls back to the old heuristic (remaining * 1, clamped 3-12) until the first preview
        // response lands so the UI never shows 0 on initial render.
        // BR-09: Concept Pulse envelope — built on the client with the same helpers
        // the server uses (pulseTier / conceptRevenueModel / pulseNarrative / getConceptScanRadius).
        // Shape identical to GET /api/location-iq so UX reads it instead of recomputing tiers.
        // ── UX-19 / UX-23: Lazy GET /api/location-iq fetch (BR-05 + BR-06) ────────
        // The full GET endpoint returns dataFreshness (21 sources × status × cadence)
        // and lenses (6 dimension slices with verdicts, signals, map highlights,
        // CoPilot prompts). It's expensive — touches every intel source — so the
        // client only calls it when the user actually opens the Data Sources modal
        // or flips a lens tab. Results are cached by analysis address so repeat
        // opens don't re-hammer the pipeline.
        // §1b (April 11): confidenceBySource is the sibling map Brain ships on
        // /api/location-iq GET/POST. Six lens dimensions + vision (0-100 each).
        // GET always ships vision: 0; UX overrides it locally from visionCompletionPct.
        // UX-3.1: kill factors from Brain 3
        // UX-3.2 + B3-1.5: grade cap + authoritative verdict from Brain 3
        // R6-2: Persist lens cache to sessionStorage so back-nav doesn't re-fetch
        // D14: Guard against stale coords. analysisStore.mapLat/analysisStore.mapLng default to Midtown (40.7580/-73.9855)
        // and are updated asynchronously from localStorage only when loc.addr === analysisAddress.
        // If the match hasn't happened yet, we'd fire the lens fetch with the wrong coords.
        // Verify coords correspond to the current analysisAddress via re2_selected_location.
        // Stored coords are for a DIFFERENT address — geocoder hasn't resolved yet.
        // Skip the fetch; it will be retried when coords settle.
        // localStorage parse failed — fall through with reactive coords
        // B1: Pass priceLevel (+ avgTicket/visionTier if available) to scoring API
        // Fallback: derive avgTicket/visionTier from priceLevel for coffee concepts
        // UX-19 / UX-I: Active lens selection. Flipping to a lens triggers the
        // lazy GET fetch (cached by address) the first time; subsequent flips
        // are instant.
        //
        // UX-I relabel + reorder per RE2-UX-Sprint-April11.md §2 — six purposeful
        // lenses with founder-language labels. Dimension keys still map 1:1 to
        // the BR-06 slice envelope (no Brain dependency); only the surface
        // copy and display order change.
        // §1b (April 11): Effective confidenceBySource — starts from whatever Brain
        // shipped on the payload. POST now ships a real `vision` value (Brain follow-up
        // 1fe6909); GET still ships `vision: 0`. When the server sends 0 we fall back
        // to the client-side visionCompletionPct so the vision lens doesn't render as
        // a skeleton pill on first load. When the server sends a real value (POST path)
        // we trust it because it factors in server-side completeness + error penalties.
        // R6-1: Backfill — if real sixScores exist but confidence is missing/0, treat as confirmed.
        // Fixes GET/cached path where confidence wasn't persisted but scores were.
        // Convenience tier lookups — components read these instead of recomputing.
        // Map dimension key → confidence tier, used by the 6-lens card header.
        // Hero percentile + LocationIQ overall confidence: aggregate across the six
        // location dimensions (vision excluded — vision is a separate score). Simple
        // average then classify. If the payload hasn't arrived yet, render 'full'
        // optimistically so the hero doesn't flicker to skeleton on every page load.
        // UX-23: Data Sources modal state. Opens on "View data sources" click near
        // the hero; lazy-fetches the GET envelope on first open (cached after).
        // Only fetch if we don't already have freshness data cached for this address
        // Grouped sources for the modal render — the 6 canonical categories in the
        // order the UX spec wants them (demographics first, momentum last).
        // ── UX-20: Live score preview (BR-04) ─────────────────────────────────────
        // Debounced POST to /api/score/preview that recomputes Vision IQ + Fit IQ from
        // partial Vision answers WITHOUT hitting the 20-source intel pipeline or DB.
        // Fires any time Vision inputs change (concept answer, hours, avg check, food
        // program, differentiator, etc.) so the hero ring animates to the new score in
        // <300ms. The canonical /api/location-iq POST still owns persistence; this is
        // a trajectory indicator only.
        // The 8 dimension keys /api/score/preview requires, pulled from whichever
        // source is populated (sixIndex payload is preferred because it matches the
        // server's IndexName contract verbatim; sixScores is the flattened fallback).
        // preview endpoint 400s on missing keys
        // Addendum Item 2: Pass avgTicket + visionTier from launchpad to scoring API
        // Fallback: derive avgTicket/visionTier from priceLevel for coffee concepts
        // ── Shadow Mode: Check against new engine ──
        // We fall back to 360610076001 if geoid isn't available dynamically for testing.
        // UX-05: Store real maxUpside from preview response
        /* preview is best-effort — silent failure keeps canonical score intact */
        // Public trigger — debounces ~300ms so chained keystrokes / click bursts
        // collapse into a single preview POST. Safe to call from any handler.
        // BR-12: Per-field status for Co-Pilot context — which fields are filled vs skipped.
        // Co-Pilot uses this to give targeted completion guidance instead of generic "fill Vision IQ".
        // C2-FIX-02: stale geocode callback guard — prevents prior analysis results corrupting new session
        // Track vision form revision count to trigger reactive recalc
        // E2b: RE² Insights toggle
        // E2b: Map expand toggle
        // E2b: Tab state for tabbed interface
        // CRITICAL-2: force-refresh clears the score cache so the engine re-runs
        // Addendum §2.4: Capture previous score before clearing so we can show comparison
        // invalidate cache
        // Addendum Step 4: Clear coffee score localStorage cache so fresh API data flows in
        // Reset and re-trigger via addr param
        // trick $effect into re-running
        // FIND-B-04: "Try Another Location" — clear result, scroll top, autofocus input
        // wait for {#if !hasResult} branch to mount
        // AddressAnalyzer renders .search-input inside .search-panel
        // P1-D: CoPilot collapse toggle with localStorage persistence
        // UX-FIX-01: Mapper fix banner (same flag as dashboard)
        // V3 Layout state
        // UX-FIX-7 (Emergency Fix April 11): "How to gain points" shows top-3 most
        // impactful levers by default; this toggle reveals the rest on demand.
        // §1c (April 11): Category-grouped rendering for "How to gain points".
        // Ordered list of category keys so group headers always render in a
        // predictable reading order regardless of which categories have items.
        // `operations` is reserved for future signals (rent burden, daypart
        // fit). No current signal emits it so this section stays empty today.
        // UX-FIX-2 (Emergency Fix April 11): Single shared AskAnything handler.
        // Every ask — hero chips, hero "How?" button, bottom copilot bar, per-lens "Ask
        // CoPilot →", or the inline input — goes through askCopilot(text). It pushes a
        // user message, opens the inline CP card, calls handleCoPilotMessage (which posts
        // to /api/copilot/location), then pushes the reply onto the SAME inlineCpMessages
        // list rendered on-screen. This is the bug the brief flagged — the chips were
        // firing but their replies were being dropped on the floor.
        // R6-3: Persist CoPilot history to sessionStorage keyed by address
        // Open & pin the inline card so the answer surface is visible.
        // UX-FIX-2: bottom bar + inline input both route through askCopilot.
        // UX Order 5: Bot-handoff timeout — cycles progress messages every 2s, fires Try Again after 15s
        // Start progress message cycle (every 2s)
        // Start 45s timeout
        // Detect failed analysis from store steps
        // BUG-005: Clear stale scores immediately when navigating to a new address
        // URL params use + for spaces; session/localStorage stores decoded addresses.
        // Decode before any comparison so "273+5th+avenue" matches "273 5th avenue".
        // FIX-003: Clear stale scoring data on every new address submission
        // FIX: also clear re2_selected_location so map/address don't snap to old location
        // C2-FIX-02: stamp active analysis token so stale async callbacks can be discarded
        // Use DECODED addr so handleScoresReady comparison works correctly.
        // 04.22.2026 Deprecating: L1 FIX localStorage competitor fallback.
        // Competitors are now exclusively provided by the server via
        // officialCompetitorsInfo in GET /api/location-iq response.
        // See bundle-builder.ts for the canonical competitor pipeline.
        // The localStorage read below has been commented out.
        // L1 FIX (ALWAYS): restore competitors from localStorage on ANY address load —
        // not just cache hits. handleScoresReady fires ~100ms later; if allComps=0 the
        // guard at line ~905 preserves these so the map shows known competitors immediately.
        // CRITICAL-2: if this addr matches session cache, restore from cache instead of resetting
        // BR-5 Option A: snapshot is canonical until user explicitly Re-scores. CACHE_TTL removed.
        // FIX: guard against false cache hits where originalAddrParam matches but analyzedAddress
        // is a completely different location. Compare leading house numbers — if they differ it's
        // a stale cross-session collision (e.g. "10 W 93rd" param but "215 W 90th" in session).
        // Compare decoded URL param so "273+5th" matches "273 5th" in session
        // BR-3: Guard against all-zero sixScores in cache — if every signal is 0, the six-index failed.
        // Treat as cache miss so scoring re-runs and real signals populate.
        // BR-5 § 5.1: no TTL — cache is permanent until Re-score action fires
        // P0-3: Restore scores from cache directly so they're available immediately
        // Use URL param address (what user typed) as canonical display address
        // C4-2: seed Vision IQ defaults on cache-restore path
        // Populate borough label from geoid for neighborhood display
        // Reset all score state so stale scores don't flash while new search runs
        // FIX: also clear stale selected_location so map doesn't snap to wrong address coords
        // FIX-003: Address-mismatch guard — detects cross-session contamination via re2_location_intel
        // FIX-006: Concept-aware avg check defaults (single numeric strings, no ranges)
        // C4-2: Standalone concept-default seeder — called from both live-analysis and cache-restore paths.
        // Reads saved vision fields from session before overwriting so user edits are never clobbered.
        // FIX-009: propagate onboarding hours selection → Vision IQ hours field
        // FIX-006: prefer numeric default from AVG_CHECK_DEFAULTS over range strings from defs
        // BUG-6 FIX: restore visionDifferentiators from session so _hasCustomDiff stays true on reload.
        // Without this, cache-restore blanks the differentiators field → _userHasCustomized=false
        // → visionIQ snaps back to serverVisionIQ → $effect overwrites session.visionIQ with lower value.
        // Callback when AddressAnalyzer produces scores
        // C2-FIX-02: Discard stale async callbacks from a prior analysis run
        // Track timeout/error state: if scoringTimedOut flag is true, mark as failed
        // Addendum §2.4: If this was a re-score, build comparison for the user
        // consume — only show once
        // BRAIN-NEW-01: reset on every new analysis
        // P0-3: Ensure hasResult flips true even on cache-restore path (comingFromBot reload)
        // C1 fix: Store server-side Fit IQ as source of truth (unifies CoPilot + UI)
        // FIX-C: Store server-side Vision IQ from DB calibrated model
        // BR-13: store data completeness for UI + Co-Pilot context
        // BR-14: store data vintage timestamp
        // FIX-011: store competitor data quality for transparency badges
        // ISS-03: Let Svelte 5 $derived recompute fitIQ (now: dynamicFitIQ or serverFitIQ only)
        // before we write it to localStorage. Without this tick(), fitIQ still holds the stale
        // pre-score value and Dashboard reads a different number than the LIQ rings show.
        // Auto-trigger score/preview for coffee concepts so the 6-dimension formula
        // with avgTicket/visionTier overwrites the stale batch score via dynamicFitIQ.
        // $derived fitIQ already prioritizes dynamicFitIQ over serverFitIQ.
        // R1-3: Auto-fire lens GET so lens data is ready when the user scrolls down.
        // Without this, the lens area shows "Lens data unavailable" until user clicks a pill.
        // C2 fix: Store segment intelligence for E2b rendering
        // H2 fix: Store Fit IQ dimension rings for E2b rendering
        // V3 FIX: Use server-provided competitor data (Source of Truth)
        /* 04.21.2026 Deprecated: Frontend logic leak
        // V3: Extract concept-aware analysisStore.competitors from ALL available sources:
        // 1. store.searchResult.data (raw Overpass from AddressAnalyzer)
        // 2. liveIntel.competitors.amenities (Overpass → Foursquare/Google/MarketDensity backfill)
        // 3. liveIntel.places (Google Places nearby)
        // 4. liveIntel.yelp.directCompetitors (Yelp concept-specific)
        try {
        	const allComps: Array<{name: string, lat: number, lng: number, dist?: number, type?: string}> = [];
        	const concept = writeCanonicalConcept(visionBizType || store.bizCategory || 'specialty_coffee');
        	const seenNames = new Set<string>();
        	const addComp = (name: string, lat: number, lng: number, dist?: number, type?: string) => {
        		const key = (name || '').toLowerCase().trim();
        		if (seenNames.has(key)) return;
        		seenNames.add(key);
        		allComps.push({ name, lat, lng, dist, type });
        	};
        
        	// Concept → relevant Overpass categories mapping
        	const FOOD_BEV = ['specialty_coffee', 'bakery', 'fast_casual', 'full_service_restaurant', 'qsr', 'bar_nightlife', 'juice_bar', 'wellness_beverage'];
        	const FITNESS_WELLNESS = ['fitness_studio', 'wellness_spa', 'personal_services'];
        	const HEALTH_MEDICAL = ['medical_office'];
        
        	// ── Source 1: Raw Overpass from AddressAnalyzer (store.searchResult.data) ──
        	const data = store.searchResult?.data as Record<string, any> | undefined;
        	if (data) {
        		if (FOOD_BEV.includes(concept) || concept === 'retail' || concept === 'florist') {
        			for (const c of (data.cafes || [])) {
        				if (c.lat && c.lon) addComp(c.name || 'Cafe', c.lat, c.lon, c.dist, 'Cafe');
        			}
        			for (const c of (data.restaurants || [])) {
        				if (c.lat && c.lon) addComp(c.name || 'Restaurant', c.lat, c.lon, c.dist, 'Restaurant');
        			}
        		}
        		if (FITNESS_WELLNESS.includes(concept)) {
        			for (const c of (data.gyms || [])) {
        				if (c.lat && c.lon) addComp(c.name || 'Gym', c.lat, c.lon, c.dist, 'Gym');
        			}
        			for (const c of (data.yoga || [])) {
        				if (c.lat && c.lon) addComp(c.name || 'Yoga', c.lat, c.lon, c.dist, 'Yoga');
        			}
        		}
        		if (FITNESS_WELLNESS.includes(concept) || HEALTH_MEDICAL.includes(concept) || concept === 'juice_bar' || concept === 'wellness_beverage') {
        			for (const c of (data.health || [])) {
        				if (c.lat && c.lon) addComp(c.name || 'Health', c.lat, c.lon, c.dist, 'Health');
        			}
        		}
        	}
        
        	// ── Source 2: liveIntel.competitors.amenities (enriched — Google Places + Foursquare + MarketDensity backfill) ──
        	// D15: type now includes bars, wellness, retail, personal (matches overpass.ts OverpassData shape)
        	const intelComps = result.liveIntel?.competitors as {
        		amenities?: {
        			cafes?: any[]; restaurants?: any[]; gyms?: any[]; yoga?: any[]; health?: any[];
        			bars?: any[]; wellness?: any[]; retail?: any[]; personal?: any[];
        		}
        	} | undefined;
        	if (intelComps?.amenities) {
        		const am = intelComps.amenities;
        		if (FOOD_BEV.includes(concept) || concept === 'retail' || concept === 'florist') {
        			for (const c of (am.cafes || [])) {
        				if (c.lat && c.lng) addComp(c.name || 'Cafe', c.lat, c.lng, c.distance, 'Cafe');
        			}
        			for (const c of (am.restaurants || [])) {
        				if (c.lat && c.lng) addComp(c.name || 'Restaurant', c.lat, c.lng, c.distance, 'Restaurant');
        			}
        		}
        		// D15: bar_nightlife must iterate bars — previously missing, caused "0 competitors" on Rivington LES
        		if (concept === 'bar_nightlife' || concept === 'bar') {
        			for (const c of (am.bars || [])) {
        				if (c.lat && c.lng) addComp(c.name || 'Bar', c.lat, c.lng, c.distance, 'Bar');
        			}
        			// Bars also compete for late-night spend with restaurants
        			for (const c of (am.restaurants || [])) {
        				if (c.lat && c.lng) addComp(c.name || 'Restaurant', c.lat, c.lng, c.distance, 'Restaurant');
        			}
        		}
        		if (FITNESS_WELLNESS.includes(concept)) {
        			for (const c of (am.gyms || [])) {
        				if (c.lat && c.lng) addComp(c.name || 'Gym', c.lat, c.lng, c.distance, 'Gym');
        			}
        			for (const c of (am.yoga || [])) {
        				if (c.lat && c.lng) addComp(c.name || 'Yoga', c.lat, c.lng, c.distance, 'Yoga');
        			}
        			for (const c of (am.wellness || [])) {
        				if (c.lat && c.lng) addComp(c.name || 'Wellness', c.lat, c.lng, c.distance, 'Wellness');
        			}
        		}
        		if (FITNESS_WELLNESS.includes(concept) || HEALTH_MEDICAL.includes(concept) || concept === 'juice_bar' || concept === 'wellness_beverage') {
        			for (const c of (am.health || [])) {
        				if (c.lat && c.lng) addComp(c.name || 'Health', c.lat, c.lng, c.distance, 'Health');
        			}
        		}
        		// D15: retail and personal_services also need their buckets
        		if (concept === 'retail' || concept === 'boutique' || concept === 'florist') {
        			for (const c of (am.retail || [])) {
        				if (c.lat && c.lng) addComp(c.name || 'Retail', c.lat, c.lng, c.distance, 'Retail');
        			}
        		}
        		if (concept === 'personal_services' || concept === 'salon' || concept === 'barbershop') {
        			for (const c of (am.personal || [])) {
        				if (c.lat && c.lng) addComp(c.name || 'Personal', c.lat, c.lng, c.distance, 'Personal');
        			}
        		}
        	}
        
        	// ── Source 3: liveIntel.places (Google Places Nearby Search) ──
        	// FIX: liveIntel.places is ALREADY the array, not { places: [...] }
        	const intelPlaces = result.liveIntel?.places;
        	const placesArr = Array.isArray(intelPlaces) ? intelPlaces : (intelPlaces as any)?.places || [];
        	for (const p of placesArr) {
        		if (p.lat && p.lng) addComp(p.name || 'Nearby Business', p.lat, p.lng, p.distance, 'Competitor');
        	}
        
        	// ── Source 4: Yelp directCompetitors — already concept-specific, always include ──
        	type YelpComp = { name?: string; lat?: number; lng?: number; distance?: number; primaryCategory?: string };
        	const yelpData = result.liveIntel?.yelp as { directCompetitors?: YelpComp[] } | undefined;
        	if (yelpData?.directCompetitors) {
        		for (const c of yelpData.directCompetitors) {
        			if (c.lat && c.lng) addComp(c.name || 'Competitor', c.lat, c.lng, c.distance, c.primaryCategory || 'Competitor');
        		}
        	}
        
        	// Only overwrite if we actually found analysisStore.competitors — cache-hit path has no scanData
        	// so allComps = 0 should NOT destroy the localStorage restore (L1 FIX preservation).
        	if (allComps.length > 0) {
        		analysisStore.competitors = allComps;
        		try {
        			localStorage.setItem('re2_competitors', JSON.stringify({ addr: result.address, items: allComps }));
        		} catch {}
        	}
        	console.log(`[RE²] competitors extracted: ${allComps.length} from 4 sources`);
        	// BRAIN-NEW-01: Mark scan complete regardless of count — 0 competitors is a real result.
        	analysisStore.competitorScanStatus = 'complete';
        } catch (e) {
        	console.warn('[RE²] Competitor extraction failed:', e);
        	analysisStore.competitorScanStatus = 'failed';
        }
        */
        /* 04.21.2026 Deprecated: Frontend logic leak
        // Fallback: if analysisStore.competitors still 0, read from cached liveIntel in localStorage
        if (analysisStore.competitors.length === 0) {
        	try {
        		const cachedIntel = JSON.parse(sessionStorage.getItem('re2_location_intel') || '{}');
        		const fallbackComps: Array<{name: string; lat: number; lng: number; dist?: number; type?: string}> = [];
        		const seen2 = new Set<string>();
        		const addFb = (arr: any[], type: string) => {
        			for (const c of (arr || [])) {
        				const key = (c.name || '').toLowerCase().trim();
        				if (key && !seen2.has(key) && (c.lat || c.latitude) && (c.lng || c.longitude || c.lon)) {
        					seen2.add(key);
        					fallbackComps.push({ name: c.name, lat: c.lat || c.latitude, lng: c.lng || c.longitude || c.lon, dist: c.distance, type });
        				}
        			}
        		};
        		// Try all known shapes
        		addFb(cachedIntel?.competitors?.amenities?.cafes, 'Cafe');
        		addFb(cachedIntel?.competitors?.amenities?.restaurants, 'Restaurant');
        		addFb(cachedIntel?.competitors?.amenities?.gyms, 'Gym');
        		const pl = cachedIntel?.places;
        		addFb(Array.isArray(pl) ? pl : pl?.places || [], 'Competitor');
        		addFb(cachedIntel?.yelp?.directCompetitors, 'Competitor');
        		if (fallbackComps.length > 0) {
        			analysisStore.competitors = fallbackComps;
        			console.log(`[RE²] competitors fallback from localStorage: ${fallbackComps.length}`);
        		}
        	} catch {}
        }
        */
        // Update map position from geocoded coordinates
        // FIX: only use re2_selected_location coords if addr matches — prevents map snapping to old location
        // Populate borough label from geoid when neighborhood isn't set from stored data
        // Store the composite score in localStorage so Recommendations can read it
        // CRITICAL-2: cache timestamp for 24h TTL
        // FIX-01: Write bizType + visionBizType so Business Case reads correct concept
        // Also reset downstream lock states — new analysis = fresh start for every module
        // FIX: persist serverVisionIQ so cache-restore path shows PRELIM correctly
        // P2-1 FIX: Write neighborhoodHealth + survivalRate into sixScores directly
        // Transparency page reads session.sixScores[key] — they must be inside sixScores, not top-level
        // keep legacy top-level too
        // F-22: isPartialSeed — block group has sparse entity coverage (< 10 POIs).
        // Financials page reads this to show a nudge card instead of the survival grid
        // when data is insufficient for reliable survival rate estimates.
        // DASHBOARD: Upsert into scoredLocations[] so all analyzed locations appear on dashboard.
        // Also writes conceptType here — this replaces T9/Brain Task 1.
        // P3-01: seed targetRevY1 so Dashboard revenue sort has a value before user visits Business Case
        // BR-5 § 5.2: compute real inputs_hash on initial score (browser-safe Web Crypto)
        // 04.22.2026: CANONICAL PERSISTENCE POINT.
        // getCanonicalScores() now trusts the server's fitScore directly
        // (no more rogue 0.75x formula). The entry written below is the
        // official LocationSnapshot persisted to localStorage and synced
        // to Supabase via session-sync.
        // BRAIN-NEW-02: Use getCanonicalScores() — pure function, no Svelte reactivity race.
        // This replaces reading $derived fitIQ/visionIQ which can hold stale values.
        // BRAIN-NEW-02: store sixScores so Dashboard getVerdict() + computeKillFactors() have real signal data
        // BR-5 § 5.2: snapshot fields
        // BR-5 § 5.2: stable SHA-256 of scoring inputs for drift detection
        // Seed businessCase.revenueY1 from financial goals so dashboard sort works before BC page visit
        // isPartialSeed: true flags this as pre-model data — Dashboard suppresses profit/break-even until Financials page runs
        // Trigger NavigationDrawer to re-evaluate unlock state reactively
        // GATE-2: Also fire custom event so same-tab layout listener fires (storage event is cross-tab only)
        // AUTO-SAVE: background sync to Supabase L2 — fire-and-forget, never blocks UX
        // Write location coordinates for downstream pages
        // Write full location intel (six scores + composite + live intel) for downstream pages
        // Include liveIntel data if available (walkScore, crime, census, inspections, etc.)
        // FIX-OB-01: Write scoredLocations + lastAddress to launchpad so that:
        // (a) onboarding initBot() can show super-user message ("You've got N locations")
        // (b) welcome-back server lastScore/lastAddress resolves correctly
        // (c) Supabase sync carries location data into founder_sessions.full_data
        // BRAIN-NEW-02: Use same canonical scores as the first write (no stale $derived race).
        // BRAIN-NEW-02: find prior entry to preserve pinned/documents/businessCase/scorer_version/inputs_hash
        // preserve existing fields (pinned, documents, businessCase, inputs_hash, scorer_version)
        // BRAIN-NEW-02: sixScores enables Dashboard getVerdict() + computeKillFactors() to show specific insights
        // R-6: persist blockLabel from API so Dashboard card reads it directly
        // Dedupe: if same address was scored before, replace it
        // FIX-SAVE-01: also persist these at top level so server reads can find them
        // Non-critical — localStorage session already has the data
        // Resize map after competitors are set
        // mapRef?.resize(); // 04.25.2026: removed — mapRef migrated to analysisStore, no longer accessible here
        // C4-2: Apply concept defaults via shared function (also called from cache-restore path)
        // UX-DELTA-02: launchpad.businessType wins over stale store.bizType
        // P1-A: Persist resolved vision fields to session so they survive reload
        // BUG-6 FIX (part A): Write visionIQ here so session always has the post-scoring computed value.
        // The $effect at line ~1082 also writes it, but only when fitIQ > 0 && hasResult.
        // Writing here ensures the cache-restore path also gets the updated value.
        // BUG-6 FIX (part B): persist differentiators so they survive cache-restore.
        // Load Vision IQ questions for this business type
        // Fire AI insights in background (non-blocking)
        // ── REACTIVE COMPETITOR EXTRACTION ──────────────────────────────────────────
        // handleScoresReady fires first from the block-group fast path when
        // store.searchResult and store.liveIntel are BOTH still undefined → competitors=0.
        // The second call (live path) only fires when liveIntel succeeds AND computeSixIndex
        // returns valid indices. If liveIntel fails (Netlify 10s timeout), the second call
        // never fires and competitors stays at 0 forever.
        // 04.22.2026 Deprecating: This $effect client-side competitor extraction is a logic
        // leak. Competitors are now provided by the server via officialCompetitorsInfo
        // in the GET /api/location-iq response (built by buildLocationScoreBundle).
        // This $effect should be removed once server-provided competitors are confirmed
        // to always arrive. Keeping it active for now as a safety net, but its localStorage
        // write has been gated.
        // This $effect reactively re-extracts competitors when data becomes available.
        // CRITICAL: use untrack() on competitors to avoid Svelte 5 circular reactivity
        // (reading + writing the same $state in an effect kills the effect).
        // Also read liveIntel from searchResult itself (set at same time as store.liveIntel)
        // Only run when we have SOME data source and analysisStore.competitors is still empty
        // untrack prevents competitors from becoming a dependency → no circular reactivity
        // Source 1: Raw Overpass from store.searchResult.data
        // D15: bars missing from raw Overpass iteration for bar_nightlife concepts
        // Source 2: liveIntel.competitors.amenities (use effectiveLI which merges both sources)
        // D15: extended type to include bars/wellness/retail/personal buckets from OverpassData
        // D15: iterate bars for bar_nightlife
        // Source 3: liveIntel.places (Google Places Nearby Search)
        // Source 4: Yelp directCompetitors
        // 04.22.2026 Deprecating: L1 localStorage write from $effect path.
        // Competitors should only be cached when received from the server.
        // L1: also persist from $effect path (covers liveIntel-only case)
        // Co-Pilot: send user question to /api/copilot/location
        // P0-D FIX: Gate on analysisAddress (always set after analysis), not geoid (often null for outer boroughs).
        // Also pass full scoring context so the AI actually knows what's on screen.
        // BUG-JWT-COPILOT (2026-04-18)
        // requireAuth() on the server reads Authorization: Bearer <token>.
        // apiFetch() is a plain fetch wrapper — it NEVER injects a Bearer token,
        // so every call returned 401 immediately. authedFetch() calls
        // Clerk.session.getToken({ skipCache: true }) before each request and
        // sets the Authorization header automatically.
        // Full scoring context — the AI needs this to answer questions about the current page
        // BR-07: enriched with verdict, kill factors, analysisStore.competitorScanStatus
        // UX-DELTA-05: launchpad-first
        // For editorial-signals lookup. Prefer a real neighborhood name; fall back
        // to the full address (getNeighborhoodBuzz does fuzzy substring matching).
        // Strip borough-only values from the geoidToBorough fallback path — they
        // won't match any neighborhoodBuzz key and just prevent address fallback.
        // Match UI display priority: sixIndex live value wins over cached sixScores
        // FIX-D: marketProof comes from fitSubScores (Cycle 2H), not sixScores
        // Also surface the two highest-impact signals for CoPilot context
        // BR-UX-07: send canonical grade + tier + nextTier + score so the CoPilot can
        // frame answers in BR-1 vocabulary instead of raw numbers. All derived via
        // decision-engine helpers — single source of truth.
        // BR-07 enrichments — make Co-Pilot responses more specific and less generic:
        // BR-12: Vision IQ completion — lets Co-Pilot guide the founder on what to fill in
        // BR-13: data source coverage — Co-Pilot can say "based on N of M sources"
        // BR-14: data freshness — Co-Pilot can reference when data was fetched
        // COP-01: DOF property tax snippet (per-address, not block-group)
        // UX-DELTA-05: launchpad-first
        // Derived: Location IQ — read from localStorage if set by callback, else compute from sixScores
        // DYNC-008: concept-aware fallback weights (API result overwrites on success)
        // ── VISION IQ: Dynamic scoring from form inputs + location data ──
        // Vision IQ measures how well THIS concept fits THIS location.
        // It recomputes every time a Vision form field changes.
        // UX-2.4: VISION_ARCHETYPES + DEFAULT_ARCHETYPE now imported from
        // $lib/constants/visionArchetypes (B2-1.4). Previously inlined here; server
        // routes (e.g. /api/score/preview) couldn't consume it, causing 5–10 point
        // visionIQ drift between client and server. Shared module eliminates that.
        // C2-FIX-05: Fallback daypart map when getConceptDefaults hasn't set visionHours
        // Normalize onboarding hours values to canonical scoring categories (morning/evening/all_day)
        // Resolved visionHours — uses session value, falls back to concept map, then 'all_day'
        // ── Vision IQ 4-panel: concept group → drives label + field slot swaps ────
        // Panel 2: avg check label adapts per group
        // Panel 2: avg check placeholder adapts per group
        // Panel 3 slot 3: F&B shows Food Program, all others show Team Size
        // Panel 3: target size placeholder shows concept-appropriate hint
        // Panel completeness per panel (drives pts badge colour)
        // Vision IQ — DYNAMIC: reacts to form inputs + location data
        // Touch visionRevision to subscribe to form changes
        // Use real location signals when available; neutral NYC baseline (50) before address is analyzed
        // This lets founders see concept-driven score changes BEFORE picking an address
        // ── Dimension 1: Competition fit (concept-specific) ──
        // Lower competition = better for new entrants
        // High competition score = low competition density = good
        // ── Dimension 2: Price-Income fit ──
        // Does the avg check align with area median income?
        // Annual dining spend ≈ check * visits/week * 52
        // Affordable if annual spend < 8% of income (routine) or 4% (destination)
        // ~2.5 visits/week assumption
        // routine vs destination
        // No income data: check if avg check is in ideal range for archetype
        // ── Concept-specific price ceiling — prevents income-paradox in high-income areas ──
        // Without this, a $95 coffee in SoHo (medianIncome $120K) can score HIGHER than $8.75
        // because the spendRatio formula rewards being closer to idealRatio × income.
        // A $95 coffee is wrong everywhere; income level doesn't change that.
        // ── Dimension 3: Age/demographics alignment ──
        // Bonus if area age profile matches target (young area + young target, etc.)
        // Young crowd + vibrant area
        // Older crowd + safe area
        // Universal sweet spot
        // ── Dimension 4: Hours/accessibility fit ──
        // Normalize raw visionHours value to canonical scoring category
        // Penalty for mismatch: morning-only business in evening-dominated area
        // ── Dimension 5: Food program fit ──
        // ── Dimension 6: Differentiator bonus ──
        // Completion bonus: rewards founders who specify their vision vs. leaving defaults
        // BUG-10 FIX: compare against concept-specific default, not hardcoded coffee defaults.
        // applyConceptDefaults() sets visionAvgCheck to '24' for bar_nightlife, '25' for fitness, etc.
        // Those values were not in the old ['$5.50','5.50','$6–10'] list → _hasCustomCheck = true
        // → _userHasCustomized = true → FIX-C never activated → client score (86–92) shown always.
        // AF-03 FIX: reduced from max-20 to max-13 so completionBonus can't overwhelm price/income penalties
        // ── Dimension 7: Rent-to-revenue fit (F2 feedback) ──
        // If founder has entered a rent budget, grade it against concept-specific max rent % of revenue
        // severe: 1.5× over benchmark
        // over benchmark
        // well within — small bonus
        /* no launchpad data — skip */
        // ── Dimension 8: Store type fit (B-commit new field) ──
        // ── Dimension 9: Target size fit (B-commit new field) ──
        // Concept-specific ideal size ranges (sqft midpoint)
        // oversized = rent burden
        // ── Dimension 10: Target client fit (B-commit new field) ──
        // selected but doesn't match area = neutral
        // ── Weighted composite ──
        // price-income uses demographics weight
        // age uses vibrancy weight
        // hours uses foot traffic weight
        // food is a fixed 10% factor
        // Normalize: weights sum to 1.0 (archetype) + 0.10 (food) = 1.10
        // New field modifiers are additive (like diffBonus/rentPenalty) to preserve calibration
        // FIX-C: When the user hasn't meaningfully customized their concept inputs (i.e. still on defaults
        // with no differentiators entered and no concept questions answered), prefer the DB-calibrated
        // server Vision IQ — it's the ensemble model score for this exact block group × concept.
        // Once the user starts editing (differentiators, avg check, concept Qs), client score takes over.
        // ── Vision validation flags ── red flags for absurd or misaligned inputs
        // subscribe to form changes
        // Flag 1: Absurd pricing (>5× concept high end)
        // Flag 2: Below viable floor (<40% of low end)
        // Flag 3: No differentiators entered
        // Flag 4: Hours conflict with concept peak times
        // Flag 5 (F2): Rent-to-revenue kill factor
        /* skip */
        // Derived: Fit IQ — UNIFIED score (C1 fix: server-side is source of truth)
        // When server-side fitScore is available (from block_group_intel or fit-iq-engine.ts),
        // use it directly so the CoPilot and UI always agree.
        // Falls back to client-side 55/45 blend only when server score is unavailable.
        /* 04.22.2026 Deprecated: Client-side fitIQ blend with visionAdj + founderMod.
         * The old formula used base = serverFitIQ (or locationIQ * 0.75 when missing)
         * plus a visionAdj (+-10pt from visionIQ) and founderMod (+-8pt from profile).
         * This created a client-only Fit number that differed from the server's canonical
         * fitScore and was incorrectly persisted to localStorage/Supabase.
         *
         * HYBRID APPROACH: fitIQ now shows one of two server-computed values:
         * 1. dynamicFitIQ.score — from POST /api/score/preview (fires ~300ms after
         *    Vision field changes, uses computeCanonicalFitIQ on the server)
         * 2. serverFitIQ — from GET /api/location-iq via buildLocationScoreBundle
         * If neither exists (legacy data), return 0 and UI shows "Re-score needed".
         */
        fitIQ() <= 0
      ) return "";
      const concept = store.launchpadProfile?.businessType || "";
      const key = concept.toLowerCase().replace(/[\s\/]+/g, "_");
      const dist = CONCEPT_DIST[key] ?? { mean: 54, sd: 14 };
      const z = (fitIQ() - dist.mean) / dist.sd;
      const cdf = 1 / (1 + Math.exp(-1.7155 * z - 0.2716 * z * z * z));
      const topPct = Math.max(1, Math.min(99, Math.round((1 - cdf) * 100)));
      const betterThan = 100 - topPct;
      const label = (
        // Branch 1: Dynamic fit from score/preview (server-computed, fires on Vision changes)
        // Branch 2: Trust stored server value only. No client-side visionAdj/founderMod.
        // E2b: Vision sub-score values for form fields — DYNAMIC per-field scores
        // subscribe to form changes
        // Competition: how saturated is the area for THIS business type
        // Price-Income: does avg check match area spending power
        // Age alignment
        // Food program
        // Hours
        // Differentiators: count meaningful keywords + RE²D2 classifier boost
        // RE²D2 scoreBoost is additive (classifier adds specificity signal on top of word count)
        // Store type per-field score
        // Target size per-field score
        // Target clients per-field score
        // selected but area doesn't match
        // Employees: score based on concept-appropriate staffing level
        // lean but risky
        // overstaffed or understaffed
        // Initial Capital: score based on buildout budget coverage
        // E2b: color class for vision field score
        // FIX-10 + FIX-11: Concept-aware UI states
        // FIX-11: Show concept hint for direct-URL users before analysis runs
        // E2b: Fit IQ ring color (amber theme from wireframe)
        // deep green (celebration)
        // burnished copper (not caution amber)
        // orange
        // red
        // E2b: generate Fit IQ verdict text
        // E2b: generate Location insight text
        // E2b: generate Vision insight text
        // E2b: handle vision form recalc — bump revision counter to trigger $derived recomputation
        // UX-20: also kick a debounced preview POST so the hero ring animates to
        // the new Vision IQ + Fit IQ whenever hours / check / food program / sim
        // recommendations change. Safe no-op if sixIndex isn't loaded yet.
        // UX-11: Dispatch "Saved ✓" 2s flash in layout header when vision inputs change.
        // 'syncing' fires immediately; 'synced' fires after localStorage persist completes.
        // FIX: Explicit concept-change handler — resets ALL concept-specific defaults when
        // user changes business type in the Vision IQ dropdown. handleVisionRecalc() alone
        // only bumps the revision counter; it does NOT update avg check, hours, food program,
        // or reload questions, so gym would show coffee defaults. This fixes that permanently.
        // UX-3.6 (Brain 3 handoff): clear concept-specific Business Case session
        // fields on in-page concept switch. Brain 3's initFromSession auto-clear
        // catches the page-reload case; this explicit call catches the in-page
        // case so the BC store doesn't carry stale coffee avg-check into a gym.
        // RE²D2: reset differentiator classifier state — new concept = fresh start
        // F-05: Reset serverVisionIQ to force recomputation on next score read
        // Force-apply new concept defaults (no session guards — user made an explicit choice)
        // Reload concept questionnaire for the new type
        // Persist new concept selection to session so downstream pages (model, co-pilot) agree
        // Trigger score recalc
        // V2: Credit score change handler — persists to session for loan pre-qualification
        // B-commit: Persist new Vision IQ fields to session
        // Load concept questions after analysis (Vision IQ questionnaire)
        /* silently skip — questionnaire is enhancement */
        // Handle Vision IQ questionnaire answer
        // F-05: Bump visionRevision so the $derived visionIQ recomputes client-side.
        // Without this, concept answer changes only updated dynamicVisionIQ via the
        // preview POST but never re-triggered the client-side scoring formula at L2273.
        // handleVisionRecalc() bumps visionRevision + triggers score preview in one call.
        // Show error banner when search completes with bad steps
        // Persist fitIQ, visionIQ, and visionDifferentiators to localStorage so all pages stay in sync
        // BUG-6 FIX (part C): persist differentiators so cache-restore can reconstruct
        // _hasCustomDiff correctly and visionIQ doesn't regress to serverVisionIQ on reload.
        // FIX-FITIQ-SYNC: After fitIQ is computed with vision + founder adjustments,
        // write it back to scoredLocations so Dashboard reads the same adjusted value.
        // Without this, Dashboard shows raw serverFitIQ, not the live-adjusted fitIQ.
        // Update the entry with the adjusted fitIQ (includes vision + founder mods)
        // Derived: gap between scores
        // Check if Cycle 2H fit sub-scores are available
        // Fit dimension scores — use Cycle 2H when available, else legacy six-index
        // Six index bars — Cycle 2H dimensions when available, else legacy
        // Ring math
        // Display score with dash for zero/missing
        // BUG-016: Save score to database
        // ── EXPORT: Founder's Location Brief ────────────────────────────────────
        // D16: surface clear feedback in all paths (no data, popup blocked, success)
        // Gather founder/business name
        // Score tier helpers (plain functions — no reactive deps)
        // BR-UX-10: delegate tier / grade / meaning to decision-engine (single source of truth).
        // Never inline the 75/65/50/40 switch here — the founder brief is customer-facing and
        // must stay in lock-step with the Location Score hero vocabulary.
        // BL-B1: replaced local ternary with canonical tierFor('visionIQ') — was Well-Defined/Clear/Developing/Needs Input
        // Verdict headline (BR-1 unified vocabulary — BR-UX-10)
        // Now built from decision-engine exports so the founder brief stays in lock-step
        // with the Location Score hero. Icon is binary green/amber off the 65 threshold
        // (Strong Path + Viable get ✅; Tight/Stretch/Rethink get ⚠️).
        // Narrative — EF-2 (April 11) confidence guard.
        // When Vision is preliminary/empty, do NOT assert the founder "has a clear vision" or
        // that they're targeting a "well-defined customer" — that's a hallucination that
        // contradicts the PRELIM badge on the score. Emit an honest scoring-without-Vision
        // variant that invites the founder to fill in Vision to sharpen the result.
        // Score colors
        // Hero pills
        // Signal rows
        // Concept rows
        // Vis IQ note — UX-2.3: thresholds pulled from VISION_IQ_TIERS canonical constants
        // D16: Use Blob + download anchor (bypasses popup blockers, gives a real file)
        // Recommendations
        // UX Order 6: Derive 3 quick tips from live score data for inline recs section
        // FIX-12: concept-aware rec suppression
        // vibrancy tip removed (ML-validated near-zero predictive power — S5)
        // Friendly business type mapping (matches root layout)
        // #33: friendlyBizType replaced by getConceptLabel from src/lib/constants/concepts.ts
        // Normalize raw session bizType → canonical concept key.
        // 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
        // Biz type label for badge
        // UX-DELTA-02: visionBizType is launchpad-first (set at init from _initLp); fall back to store.bizType
        (bizTypeLabel() || "business").toLowerCase()
      );
      if (topPct <= 50) return `Better than ${betterThan}% of NYC ${label} locations we've analyzed`;
      if (topPct <= 60) return `Middle of the pack for NYC ${label} locations we've analyzed`;
      return `Below ${betterThan}% of NYC ${label} locations we've analyzed`;
    });
    let scoredAtDisplay = null;
    const _initSess = (() => {
      try {
        return JSON.parse(localStorage.getItem("re2_session") || "{}");
      } catch {
        return {};
      }
    })();
    const _initLp = (() => {
      try {
        return JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
      } catch {
        return {};
      }
    })();
    const _initPersona = (() => {
      try {
        return JSON.parse(localStorage.getItem("re2_persona") || "{}");
      } catch {
        return {};
      }
    })();
    const _rawConcept = _initLp.businessType || _initSess.bizType || _initSess.visionBizType || _initPersona.persona_type || "";
    let visionBizType = writeCanonicalConcept(_rawConcept);
    let conceptAnswers = _initSess.conceptAnswers || {};
    const _INIT_FOOD_BEV = [
      "specialty_coffee",
      "bakery",
      "fast_casual",
      "full_service_restaurant",
      "qsr",
      "bar_nightlife",
      "juice_bar",
      "wellness_beverage"
    ];
    const _isInitFoodConcept = _INIT_FOOD_BEV.includes(writeCanonicalConcept(_rawConcept));
    const _INIT_HOURS_MAP = {
      bar_nightlife: "evening",
      full_service_restaurant: "evening",
      retail: "all_day",
      fast_casual: "all_day",
      qsr: "all_day",
      personal_services: "all_day",
      medical_office: "all_day",
      florist: "all_day",
      coworking: "all_day",
      wellness_spa: "all_day",
      specialty_coffee: "morning",
      bakery: "morning",
      fitness_studio: "morning",
      juice_bar: "morning",
      wellness_beverage: "morning"
    };
    let visionAvgCheck = _initSess.visionAvgCheck || "";
    let visionTargetAge = _initSess.visionTargetAge || "24-42";
    let visionFoodProgram = _isInitFoodConcept ? _initSess.visionFoodProgram || "light_bites" : "none";
    let visionHours = _initSess.visionHours || _INIT_HOURS_MAP[writeCanonicalConcept(_rawConcept)] || "morning";
    let visionDifferentiators = _initSess.visionDifferentiators || "";
    let visionCreditScore = _initSess.visionCreditScore || "";
    let visionStoreType = _initSess.visionStoreType || "";
    let visionTargetSize = _initSess.visionTargetSize || "";
    let visionTargetClients = _initSess.visionTargetClients || "";
    _initSess.visionTargetClients2 || "";
    let visionEmployees = _initSess.visionEmployees || "";
    let visionInitialCapital = _initSess.visionInitialCapital || "";
    let visionFieldsComplete = derived(() => {
      let pct = 0;
      if (visionBizType) pct += 8;
      if (visionStoreType) pct += 7;
      if (visionTargetSize) pct += 7;
      if (visionAvgCheck && visionAvgCheck.trim()) pct += 12;
      if (visionTargetClients) pct += 7;
      if (visionTargetAge.trim()) pct += 7;
      const _isFoodConcept = [
        "specialty_coffee",
        "bakery",
        "fast_casual",
        "full_service_restaurant",
        "qsr",
        "bar_nightlife",
        "juice_bar",
        "wellness_beverage"
      ].includes(visionBizType);
      if (!_isFoodConcept || visionFoodProgram) pct += 7;
      if (visionHours) pct += 7;
      const _diffWords = visionDifferentiators.trim() ? visionDifferentiators.trim().split(/[\s,;]+/).filter((w) => w.length > 2).length : 0;
      if (_diffWords >= 2) pct += 12;
      if (visionEmployees) pct += 5;
      if (visionCreditScore) pct += 7;
      if (visionInitialCapital) pct += 7;
      pct += 7;
      return pct;
    });
    let visionCompletionPct = derived(visionFieldsComplete);
    let visionIsPrelim = derived(() => visionCompletionPct() < 100);
    let visionFieldsFilled = derived(() => {
      let filled = 0;
      let total = 11;
      if (visionBizType) filled++;
      if (visionStoreType) filled++;
      if (visionTargetSize) filled++;
      if (visionAvgCheck && visionAvgCheck.trim()) filled++;
      if (visionTargetClients) filled++;
      if (visionTargetAge.trim()) filled++;
      const _isFoodConcept = [
        "specialty_coffee",
        "bakery",
        "fast_casual",
        "full_service_restaurant",
        "qsr",
        "bar_nightlife",
        "juice_bar",
        "wellness_beverage"
      ].includes(visionBizType);
      if (!_isFoodConcept || visionFoodProgram) filled++;
      if (visionHours) filled++;
      const _diffWords = visionDifferentiators.trim() ? visionDifferentiators.trim().split(/[\s,;]+/).filter((w) => w.length > 2).length : 0;
      if (_diffWords >= 2) filled++;
      if (visionEmployees) filled++;
      if (visionCreditScore) filled++;
      if (visionInitialCapital) filled++;
      total++;
      return { filled, total, remaining: total - filled };
    });
    let scoreConfidence = derived(() => {
      const pct = visionFieldsFilled().total > 0 ? visionFieldsFilled().filled / visionFieldsFilled().total : 0;
      if (pct < 0.5) return "preliminary";
      if (pct < 0.85) return "partial";
      return "confident";
    });
    let scoreConfidenceReason = derived(() => {
      const { filled, total } = visionFieldsFilled();
      if (scoreConfidence() === "preliminary") return `Only ${filled} of ${total} concept inputs filled — score may shift as you add more.`;
      if (scoreConfidence() === "partial") return `${filled} of ${total} concept inputs filled — score is stabilizing.`;
      return `${filled} of ${total} concept inputs filled — score is reliable for decision-making.`;
    });
    let _apiMaxUpside = null;
    let conceptPulse = derived(() => {
      const score = sixScores["vibrancy"] || sixScores["vibrancy_index"] || 0;
      if (score <= 0 || !visionBizType) return null;
      const tier = pulseTier(score);
      const model = conceptRevenueModel(visionBizType);
      const radius = getConceptScanRadius(visionBizType);
      return {
        score,
        tier,
        model,
        conceptRadiusM: radius,
        narrative: pulseNarrative(tier, model, radius),
        verdict: `${tier} for a ${visionBizType.replace(/_/g, " ")}.`
      };
    });
    let locationIqCache = (() => {
      try {
        return JSON.parse(sessionStorage.getItem("re2_lensCache") || "{}");
      } catch {
        return {};
      }
    })();
    let locationIqFetching = false;
    let locationIqError = null;
    let locationIqPayload = null;
    async function loadLocationIqEnvelope(force = false) {
      if (!analysisAddress || !analysisStore.mapLat || !analysisStore.mapLng) return null;
      let resolvedLat = analysisStore.mapLat;
      let resolvedLng = analysisStore.mapLng;
      try {
        const loc = JSON.parse(sessionStorage.getItem("re2_selected_location") || "{}");
        if (loc.addr === analysisAddress && loc.lat && loc.lng) {
          resolvedLat = loc.lat;
          resolvedLng = loc.lng;
        } else if (loc.addr && loc.addr !== analysisAddress) {
          console.warn("[LocationIQ] D14 guard: skipping lens fetch — stored coords do not match current address");
          return null;
        }
      } catch {
      }
      const cacheKey = `${analysisAddress}::${visionBizType}`;
      if (!force && locationIqCache[cacheKey]) {
        locationIqPayload = locationIqCache[cacheKey];
        return locationIqPayload;
      }
      locationIqFetching = true;
      locationIqError = null;
      try {
        const _lpIq = (() => {
          try {
            return JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
          } catch {
            return {};
          }
        })();
        const _coffeeFallback = _lpIq.priceLevel && PRICE_LEVEL_TO_COFFEE[_lpIq.priceLevel] ? PRICE_LEVEL_TO_COFFEE[_lpIq.priceLevel] : null;
        const _resolvedAvgTicket = _lpIq.avgTicket || _coffeeFallback?.avgTicket || "";
        const _resolvedVisionTier = _lpIq.visionTier || _coffeeFallback?.visionTier || "";
        const qs = new URLSearchParams({
          lat: String(resolvedLat),
          lng: String(resolvedLng),
          type: visionBizType || "cafe",
          address: analysisAddress,
          ..._lpIq.priceLevel ? { priceLevel: String(_lpIq.priceLevel) } : {},
          ..._resolvedAvgTicket ? { avgTicket: String(_resolvedAvgTicket) } : {},
          ..._resolvedVisionTier ? { visionTier: _resolvedVisionTier } : {}
        });
        const res = await apiFetch(`/api/location-iq?${qs.toString()}`);
        if (!res.ok) {
          locationIqError = `Score data unavailable (${res.status})`;
          return null;
        }
        const data = await res.json();
        const payload = {
          lenses: data.lenses || [],
          dataFreshness: data.dataFreshness,
          confidenceBySource: data.confidenceBySource || void 0
        };
        locationIqCache = { ...locationIqCache, [cacheKey]: payload };
        try {
          sessionStorage.setItem("re2_lensCache", JSON.stringify(locationIqCache));
        } catch {
        }
        locationIqPayload = payload;
        return payload;
      } catch (e) {
        locationIqError = e instanceof Error ? e.message : "Fetch failed";
        return null;
      } finally {
        locationIqFetching = false;
      }
    }
    const LENS_TABS = [
      {
        key: "competition",
        label: "Competition",
        sub: "Who else is nearby"
      },
      {
        key: "transit",
        label: "Foot Traffic",
        sub: "How easy to reach"
      },
      {
        key: "demographics",
        label: "Your Customers",
        sub: "Who lives here"
      },
      {
        key: "momentum",
        label: "Trajectory",
        sub: "Where this block is heading"
      },
      {
        key: "safety",
        label: "Safety & Vibe",
        sub: "After-dark comfort"
      },
      {
        key: "vibrancy",
        label: "The Block",
        sub: "Street-level energy"
      }
    ];
    let activeLensKey = "competition";
    let activeLensSlice = derived(() => {
      const lenses = locationIqPayload?.lenses ?? [];
      return lenses.find((l) => l.dimension === activeLensKey) ?? null;
    });
    let confidenceBySource = derived(() => {
      const base = locationIqPayload?.confidenceBySource ?? {};
      const dims = [
        "transit",
        "safety",
        "demographics",
        "competition",
        "vibrancy",
        "momentum"
      ];
      for (const dim of dims) {
        if (sixScores?.[dim] > 0 && !base[dim]) base[dim] = 100;
      }
      const serverVision = base.vision ?? 0;
      return {
        ...base,
        vision: serverVision > 0 ? serverVision : Math.round(visionCompletionPct())
      };
    });
    let confidenceTransit = derived(() => confidenceTier(confidenceBySource().transit));
    let confidenceSafety = derived(() => confidenceTier(confidenceBySource().safety));
    let confidenceDemos = derived(() => confidenceTier(confidenceBySource().demographics));
    let confidenceCompetition = derived(() => confidenceTier(confidenceBySource().competition));
    let confidenceVibrancy = derived(() => confidenceTier(confidenceBySource().vibrancy));
    let confidenceMomentum = derived(() => confidenceTier(confidenceBySource().momentum));
    let confidenceForLens = derived(() => {
      return (dim) => {
        switch (dim) {
          case "transit":
            return confidenceTransit();
          case "safety":
            return confidenceSafety();
          case "demographics":
            return confidenceDemos();
          case "competition":
            return confidenceCompetition();
          case "vibrancy":
            return confidenceVibrancy();
          case "momentum":
            return confidenceMomentum();
          default:
            return "full";
        }
      };
    });
    let locationConfidenceAvg = derived(() => {
      const base = locationIqPayload?.confidenceBySource;
      if (!base) return 100;
      const vals = [
        base.transit,
        base.safety,
        base.demographics,
        base.competition,
        base.vibrancy,
        base.momentum
      ].filter((n) => typeof n === "number" && Number.isFinite(n));
      if (vals.length === 0) return 100;
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    });
    let locationConfidenceTier = derived(() => confidenceTier(locationConfidenceAvg()));
    let livePreviewActive = false;
    let livePreviewTimer = null;
    function buildPreviewIndexScores() {
      const src = sixIndex()?.indexScores ?? sixScores ?? {};
      const keys = [
        "transit",
        "demographics",
        "competition",
        "vibrancy",
        "safety",
        "momentum",
        "neighborhoodHealth",
        "survivalRate"
      ];
      const out = {};
      for (const k of keys) {
        const v = Number(src[k]);
        if (!isFinite(v)) return null;
        out[k] = Math.max(0, Math.min(100, v));
      }
      return out;
    }
    async function runScorePreview() {
      livePreviewTimer = null;
      const indexScores = buildPreviewIndexScores();
      if (!indexScores || !visionBizType) {
        livePreviewActive = false;
        return;
      }
      try {
        const _lp = (() => {
          try {
            return JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
          } catch {
            return {};
          }
        })();
        const _cfPreview = _lp.priceLevel && PRICE_LEVEL_TO_COFFEE[_lp.priceLevel] ? PRICE_LEVEL_TO_COFFEE[_lp.priceLevel] : null;
        const res = await apiFetch("/api/score/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessType: visionBizType,
            conceptAnswers,
            indexScores,
            locationIQScore: storedLocationIQ || threeScores()?.locationIQ?.score || // ── Shadow Mode: Check against new engine ──
            // We fall back to 360610076001 if geoid isn't available dynamically for testing.
            // UX-05: Store real maxUpside from preview response
            /* preview is best-effort — silent failure keeps canonical score intact */
            // Public trigger — debounces ~300ms so chained keystrokes / click bursts
            // collapse into a single preview POST. Safe to call from any handler.
            // BR-12: Per-field status for Co-Pilot context — which fields are filled vs skipped.
            // Co-Pilot uses this to give targeted completion guidance instead of generic "fill Vision IQ".
            // C2-FIX-02: stale geocode callback guard — prevents prior analysis results corrupting new session
            // Track vision form revision count to trigger reactive recalc
            // E2b: RE² Insights toggle
            // E2b: Map expand toggle
            // E2b: Tab state for tabbed interface
            // CRITICAL-2: force-refresh clears the score cache so the engine re-runs
            // Addendum §2.4: Capture previous score before clearing so we can show comparison
            // invalidate cache
            // Addendum Step 4: Clear coffee score localStorage cache so fresh API data flows in
            // Reset and re-trigger via addr param
            // trick $effect into re-running
            // FIND-B-04: "Try Another Location" — clear result, scroll top, autofocus input
            // wait for {#if !hasResult} branch to mount
            // AddressAnalyzer renders .search-input inside .search-panel
            // P1-D: CoPilot collapse toggle with localStorage persistence
            // UX-FIX-01: Mapper fix banner (same flag as dashboard)
            // V3 Layout state
            // UX-FIX-7 (Emergency Fix April 11): "How to gain points" shows top-3 most
            // impactful levers by default; this toggle reveals the rest on demand.
            // §1c (April 11): Category-grouped rendering for "How to gain points".
            // Ordered list of category keys so group headers always render in a
            // predictable reading order regardless of which categories have items.
            // `operations` is reserved for future signals (rent burden, daypart
            // fit). No current signal emits it so this section stays empty today.
            // UX-FIX-2 (Emergency Fix April 11): Single shared AskAnything handler.
            // Every ask — hero chips, hero "How?" button, bottom copilot bar, per-lens "Ask
            // CoPilot →", or the inline input — goes through askCopilot(text). It pushes a
            // user message, opens the inline CP card, calls handleCoPilotMessage (which posts
            // to /api/copilot/location), then pushes the reply onto the SAME inlineCpMessages
            // list rendered on-screen. This is the bug the brief flagged — the chips were
            // firing but their replies were being dropped on the floor.
            // R6-3: Persist CoPilot history to sessionStorage keyed by address
            // Open & pin the inline card so the answer surface is visible.
            // UX-FIX-2: bottom bar + inline input both route through askCopilot.
            // UX Order 5: Bot-handoff timeout — cycles progress messages every 2s, fires Try Again after 15s
            // Start progress message cycle (every 2s)
            // Start 45s timeout
            // Detect failed analysis from store steps
            // BUG-005: Clear stale scores immediately when navigating to a new address
            // URL params use + for spaces; session/localStorage stores decoded addresses.
            // Decode before any comparison so "273+5th+avenue" matches "273 5th avenue".
            // FIX-003: Clear stale scoring data on every new address submission
            // FIX: also clear re2_selected_location so map/address don't snap to old location
            // C2-FIX-02: stamp active analysis token so stale async callbacks can be discarded
            // Use DECODED addr so handleScoresReady comparison works correctly.
            // 04.22.2026 Deprecating: L1 FIX localStorage competitor fallback.
            // Competitors are now exclusively provided by the server via
            // officialCompetitorsInfo in GET /api/location-iq response.
            // See bundle-builder.ts for the canonical competitor pipeline.
            // The localStorage read below has been commented out.
            // L1 FIX (ALWAYS): restore competitors from localStorage on ANY address load —
            // not just cache hits. handleScoresReady fires ~100ms later; if allComps=0 the
            // guard at line ~905 preserves these so the map shows known competitors immediately.
            // CRITICAL-2: if this addr matches session cache, restore from cache instead of resetting
            // BR-5 Option A: snapshot is canonical until user explicitly Re-scores. CACHE_TTL removed.
            // FIX: guard against false cache hits where originalAddrParam matches but analyzedAddress
            // is a completely different location. Compare leading house numbers — if they differ it's
            // a stale cross-session collision (e.g. "10 W 93rd" param but "215 W 90th" in session).
            // Compare decoded URL param so "273+5th" matches "273 5th" in session
            // BR-3: Guard against all-zero sixScores in cache — if every signal is 0, the six-index failed.
            // Treat as cache miss so scoring re-runs and real signals populate.
            // BR-5 § 5.1: no TTL — cache is permanent until Re-score action fires
            // P0-3: Restore scores from cache directly so they're available immediately
            // Use URL param address (what user typed) as canonical display address
            // C4-2: seed Vision IQ defaults on cache-restore path
            // Populate borough label from geoid for neighborhood display
            // Reset all score state so stale scores don't flash while new search runs
            // FIX: also clear stale selected_location so map doesn't snap to wrong address coords
            // FIX-003: Address-mismatch guard — detects cross-session contamination via re2_location_intel
            // FIX-006: Concept-aware avg check defaults (single numeric strings, no ranges)
            // C4-2: Standalone concept-default seeder — called from both live-analysis and cache-restore paths.
            // Reads saved vision fields from session before overwriting so user edits are never clobbered.
            // FIX-009: propagate onboarding hours selection → Vision IQ hours field
            // FIX-006: prefer numeric default from AVG_CHECK_DEFAULTS over range strings from defs
            // BUG-6 FIX: restore visionDifferentiators from session so _hasCustomDiff stays true on reload.
            // Without this, cache-restore blanks the differentiators field → _userHasCustomized=false
            // → visionIQ snaps back to serverVisionIQ → $effect overwrites session.visionIQ with lower value.
            // Callback when AddressAnalyzer produces scores
            // C2-FIX-02: Discard stale async callbacks from a prior analysis run
            // Track timeout/error state: if scoringTimedOut flag is true, mark as failed
            // Addendum §2.4: If this was a re-score, build comparison for the user
            // consume — only show once
            // BRAIN-NEW-01: reset on every new analysis
            // P0-3: Ensure hasResult flips true even on cache-restore path (comingFromBot reload)
            // C1 fix: Store server-side Fit IQ as source of truth (unifies CoPilot + UI)
            // FIX-C: Store server-side Vision IQ from DB calibrated model
            // BR-13: store data completeness for UI + Co-Pilot context
            // BR-14: store data vintage timestamp
            // FIX-011: store competitor data quality for transparency badges
            // ISS-03: Let Svelte 5 $derived recompute fitIQ (now: dynamicFitIQ or serverFitIQ only)
            // before we write it to localStorage. Without this tick(), fitIQ still holds the stale
            // pre-score value and Dashboard reads a different number than the LIQ rings show.
            // Auto-trigger score/preview for coffee concepts so the 6-dimension formula
            // with avgTicket/visionTier overwrites the stale batch score via dynamicFitIQ.
            // $derived fitIQ already prioritizes dynamicFitIQ over serverFitIQ.
            // R1-3: Auto-fire lens GET so lens data is ready when the user scrolls down.
            // Without this, the lens area shows "Lens data unavailable" until user clicks a pill.
            // C2 fix: Store segment intelligence for E2b rendering
            // H2 fix: Store Fit IQ dimension rings for E2b rendering
            // V3 FIX: Use server-provided competitor data (Source of Truth)
            /* 04.21.2026 Deprecated: Frontend logic leak
            // V3: Extract concept-aware analysisStore.competitors from ALL available sources:
            // 1. store.searchResult.data (raw Overpass from AddressAnalyzer)
            // 2. liveIntel.competitors.amenities (Overpass → Foursquare/Google/MarketDensity backfill)
            // 3. liveIntel.places (Google Places nearby)
            // 4. liveIntel.yelp.directCompetitors (Yelp concept-specific)
            try {
            	const allComps: Array<{name: string, lat: number, lng: number, dist?: number, type?: string}> = [];
            	const concept = writeCanonicalConcept(visionBizType || store.bizCategory || 'specialty_coffee');
            	const seenNames = new Set<string>();
            	const addComp = (name: string, lat: number, lng: number, dist?: number, type?: string) => {
            		const key = (name || '').toLowerCase().trim();
            		if (seenNames.has(key)) return;
            		seenNames.add(key);
            		allComps.push({ name, lat, lng, dist, type });
            	};
            
            	// Concept → relevant Overpass categories mapping
            	const FOOD_BEV = ['specialty_coffee', 'bakery', 'fast_casual', 'full_service_restaurant', 'qsr', 'bar_nightlife', 'juice_bar', 'wellness_beverage'];
            	const FITNESS_WELLNESS = ['fitness_studio', 'wellness_spa', 'personal_services'];
            	const HEALTH_MEDICAL = ['medical_office'];
            
            	// ── Source 1: Raw Overpass from AddressAnalyzer (store.searchResult.data) ──
            	const data = store.searchResult?.data as Record<string, any> | undefined;
            	if (data) {
            		if (FOOD_BEV.includes(concept) || concept === 'retail' || concept === 'florist') {
            			for (const c of (data.cafes || [])) {
            				if (c.lat && c.lon) addComp(c.name || 'Cafe', c.lat, c.lon, c.dist, 'Cafe');
            			}
            			for (const c of (data.restaurants || [])) {
            				if (c.lat && c.lon) addComp(c.name || 'Restaurant', c.lat, c.lon, c.dist, 'Restaurant');
            			}
            		}
            		if (FITNESS_WELLNESS.includes(concept)) {
            			for (const c of (data.gyms || [])) {
            				if (c.lat && c.lon) addComp(c.name || 'Gym', c.lat, c.lon, c.dist, 'Gym');
            			}
            			for (const c of (data.yoga || [])) {
            				if (c.lat && c.lon) addComp(c.name || 'Yoga', c.lat, c.lon, c.dist, 'Yoga');
            			}
            		}
            		if (FITNESS_WELLNESS.includes(concept) || HEALTH_MEDICAL.includes(concept) || concept === 'juice_bar' || concept === 'wellness_beverage') {
            			for (const c of (data.health || [])) {
            				if (c.lat && c.lon) addComp(c.name || 'Health', c.lat, c.lon, c.dist, 'Health');
            			}
            		}
            	}
            
            	// ── Source 2: liveIntel.competitors.amenities (enriched — Google Places + Foursquare + MarketDensity backfill) ──
            	// D15: type now includes bars, wellness, retail, personal (matches overpass.ts OverpassData shape)
            	const intelComps = result.liveIntel?.competitors as {
            		amenities?: {
            			cafes?: any[]; restaurants?: any[]; gyms?: any[]; yoga?: any[]; health?: any[];
            			bars?: any[]; wellness?: any[]; retail?: any[]; personal?: any[];
            		}
            	} | undefined;
            	if (intelComps?.amenities) {
            		const am = intelComps.amenities;
            		if (FOOD_BEV.includes(concept) || concept === 'retail' || concept === 'florist') {
            			for (const c of (am.cafes || [])) {
            				if (c.lat && c.lng) addComp(c.name || 'Cafe', c.lat, c.lng, c.distance, 'Cafe');
            			}
            			for (const c of (am.restaurants || [])) {
            				if (c.lat && c.lng) addComp(c.name || 'Restaurant', c.lat, c.lng, c.distance, 'Restaurant');
            			}
            		}
            		// D15: bar_nightlife must iterate bars — previously missing, caused "0 competitors" on Rivington LES
            		if (concept === 'bar_nightlife' || concept === 'bar') {
            			for (const c of (am.bars || [])) {
            				if (c.lat && c.lng) addComp(c.name || 'Bar', c.lat, c.lng, c.distance, 'Bar');
            			}
            			// Bars also compete for late-night spend with restaurants
            			for (const c of (am.restaurants || [])) {
            				if (c.lat && c.lng) addComp(c.name || 'Restaurant', c.lat, c.lng, c.distance, 'Restaurant');
            			}
            		}
            		if (FITNESS_WELLNESS.includes(concept)) {
            			for (const c of (am.gyms || [])) {
            				if (c.lat && c.lng) addComp(c.name || 'Gym', c.lat, c.lng, c.distance, 'Gym');
            			}
            			for (const c of (am.yoga || [])) {
            				if (c.lat && c.lng) addComp(c.name || 'Yoga', c.lat, c.lng, c.distance, 'Yoga');
            			}
            			for (const c of (am.wellness || [])) {
            				if (c.lat && c.lng) addComp(c.name || 'Wellness', c.lat, c.lng, c.distance, 'Wellness');
            			}
            		}
            		if (FITNESS_WELLNESS.includes(concept) || HEALTH_MEDICAL.includes(concept) || concept === 'juice_bar' || concept === 'wellness_beverage') {
            			for (const c of (am.health || [])) {
            				if (c.lat && c.lng) addComp(c.name || 'Health', c.lat, c.lng, c.distance, 'Health');
            			}
            		}
            		// D15: retail and personal_services also need their buckets
            		if (concept === 'retail' || concept === 'boutique' || concept === 'florist') {
            			for (const c of (am.retail || [])) {
            				if (c.lat && c.lng) addComp(c.name || 'Retail', c.lat, c.lng, c.distance, 'Retail');
            			}
            		}
            		if (concept === 'personal_services' || concept === 'salon' || concept === 'barbershop') {
            			for (const c of (am.personal || [])) {
            				if (c.lat && c.lng) addComp(c.name || 'Personal', c.lat, c.lng, c.distance, 'Personal');
            			}
            		}
            	}
            
            	// ── Source 3: liveIntel.places (Google Places Nearby Search) ──
            	// FIX: liveIntel.places is ALREADY the array, not { places: [...] }
            	const intelPlaces = result.liveIntel?.places;
            	const placesArr = Array.isArray(intelPlaces) ? intelPlaces : (intelPlaces as any)?.places || [];
            	for (const p of placesArr) {
            		if (p.lat && p.lng) addComp(p.name || 'Nearby Business', p.lat, p.lng, p.distance, 'Competitor');
            	}
            
            	// ── Source 4: Yelp directCompetitors — already concept-specific, always include ──
            	type YelpComp = { name?: string; lat?: number; lng?: number; distance?: number; primaryCategory?: string };
            	const yelpData = result.liveIntel?.yelp as { directCompetitors?: YelpComp[] } | undefined;
            	if (yelpData?.directCompetitors) {
            		for (const c of yelpData.directCompetitors) {
            			if (c.lat && c.lng) addComp(c.name || 'Competitor', c.lat, c.lng, c.distance, c.primaryCategory || 'Competitor');
            		}
            	}
            
            	// Only overwrite if we actually found analysisStore.competitors — cache-hit path has no scanData
            	// so allComps = 0 should NOT destroy the localStorage restore (L1 FIX preservation).
            	if (allComps.length > 0) {
            		analysisStore.competitors = allComps;
            		try {
            			localStorage.setItem('re2_competitors', JSON.stringify({ addr: result.address, items: allComps }));
            		} catch {}
            	}
            	console.log(`[RE²] competitors extracted: ${allComps.length} from 4 sources`);
            	// BRAIN-NEW-01: Mark scan complete regardless of count — 0 competitors is a real result.
            	analysisStore.competitorScanStatus = 'complete';
            } catch (e) {
            	console.warn('[RE²] Competitor extraction failed:', e);
            	analysisStore.competitorScanStatus = 'failed';
            }
            */
            /* 04.21.2026 Deprecated: Frontend logic leak
            // Fallback: if analysisStore.competitors still 0, read from cached liveIntel in localStorage
            if (analysisStore.competitors.length === 0) {
            	try {
            		const cachedIntel = JSON.parse(sessionStorage.getItem('re2_location_intel') || '{}');
            		const fallbackComps: Array<{name: string; lat: number; lng: number; dist?: number; type?: string}> = [];
            		const seen2 = new Set<string>();
            		const addFb = (arr: any[], type: string) => {
            			for (const c of (arr || [])) {
            				const key = (c.name || '').toLowerCase().trim();
            				if (key && !seen2.has(key) && (c.lat || c.latitude) && (c.lng || c.longitude || c.lon)) {
            					seen2.add(key);
            					fallbackComps.push({ name: c.name, lat: c.lat || c.latitude, lng: c.lng || c.longitude || c.lon, dist: c.distance, type });
            				}
            			}
            		};
            		// Try all known shapes
            		addFb(cachedIntel?.competitors?.amenities?.cafes, 'Cafe');
            		addFb(cachedIntel?.competitors?.amenities?.restaurants, 'Restaurant');
            		addFb(cachedIntel?.competitors?.amenities?.gyms, 'Gym');
            		const pl = cachedIntel?.places;
            		addFb(Array.isArray(pl) ? pl : pl?.places || [], 'Competitor');
            		addFb(cachedIntel?.yelp?.directCompetitors, 'Competitor');
            		if (fallbackComps.length > 0) {
            			analysisStore.competitors = fallbackComps;
            			console.log(`[RE²] competitors fallback from localStorage: ${fallbackComps.length}`);
            		}
            	} catch {}
            }
            */
            // Update map position from geocoded coordinates
            // FIX: only use re2_selected_location coords if addr matches — prevents map snapping to old location
            // Populate borough label from geoid when neighborhood isn't set from stored data
            // Store the composite score in localStorage so Recommendations can read it
            // CRITICAL-2: cache timestamp for 24h TTL
            // FIX-01: Write bizType + visionBizType so Business Case reads correct concept
            // Also reset downstream lock states — new analysis = fresh start for every module
            // FIX: persist serverVisionIQ so cache-restore path shows PRELIM correctly
            // P2-1 FIX: Write neighborhoodHealth + survivalRate into sixScores directly
            // Transparency page reads session.sixScores[key] — they must be inside sixScores, not top-level
            // keep legacy top-level too
            // F-22: isPartialSeed — block group has sparse entity coverage (< 10 POIs).
            // Financials page reads this to show a nudge card instead of the survival grid
            // when data is insufficient for reliable survival rate estimates.
            // DASHBOARD: Upsert into scoredLocations[] so all analyzed locations appear on dashboard.
            // Also writes conceptType here — this replaces T9/Brain Task 1.
            // P3-01: seed targetRevY1 so Dashboard revenue sort has a value before user visits Business Case
            // BR-5 § 5.2: compute real inputs_hash on initial score (browser-safe Web Crypto)
            // 04.22.2026: CANONICAL PERSISTENCE POINT.
            // getCanonicalScores() now trusts the server's fitScore directly
            // (no more rogue 0.75x formula). The entry written below is the
            // official LocationSnapshot persisted to localStorage and synced
            // to Supabase via session-sync.
            // BRAIN-NEW-02: Use getCanonicalScores() — pure function, no Svelte reactivity race.
            // This replaces reading $derived fitIQ/visionIQ which can hold stale values.
            // BRAIN-NEW-02: store sixScores so Dashboard getVerdict() + computeKillFactors() have real signal data
            // BR-5 § 5.2: snapshot fields
            // BR-5 § 5.2: stable SHA-256 of scoring inputs for drift detection
            // Seed businessCase.revenueY1 from financial goals so dashboard sort works before BC page visit
            // isPartialSeed: true flags this as pre-model data — Dashboard suppresses profit/break-even until Financials page runs
            // Trigger NavigationDrawer to re-evaluate unlock state reactively
            // GATE-2: Also fire custom event so same-tab layout listener fires (storage event is cross-tab only)
            // AUTO-SAVE: background sync to Supabase L2 — fire-and-forget, never blocks UX
            // Write location coordinates for downstream pages
            // Write full location intel (six scores + composite + live intel) for downstream pages
            // Include liveIntel data if available (walkScore, crime, census, inspections, etc.)
            // FIX-OB-01: Write scoredLocations + lastAddress to launchpad so that:
            // (a) onboarding initBot() can show super-user message ("You've got N locations")
            // (b) welcome-back server lastScore/lastAddress resolves correctly
            // (c) Supabase sync carries location data into founder_sessions.full_data
            // BRAIN-NEW-02: Use same canonical scores as the first write (no stale $derived race).
            // BRAIN-NEW-02: find prior entry to preserve pinned/documents/businessCase/scorer_version/inputs_hash
            // preserve existing fields (pinned, documents, businessCase, inputs_hash, scorer_version)
            // BRAIN-NEW-02: sixScores enables Dashboard getVerdict() + computeKillFactors() to show specific insights
            // R-6: persist blockLabel from API so Dashboard card reads it directly
            // Dedupe: if same address was scored before, replace it
            // FIX-SAVE-01: also persist these at top level so server reads can find them
            // Non-critical — localStorage session already has the data
            // Resize map after competitors are set
            // mapRef?.resize(); // 04.25.2026: removed — mapRef migrated to analysisStore, no longer accessible here
            // C4-2: Apply concept defaults via shared function (also called from cache-restore path)
            // UX-DELTA-02: launchpad.businessType wins over stale store.bizType
            // P1-A: Persist resolved vision fields to session so they survive reload
            // BUG-6 FIX (part A): Write visionIQ here so session always has the post-scoring computed value.
            // The $effect at line ~1082 also writes it, but only when fitIQ > 0 && hasResult.
            // Writing here ensures the cache-restore path also gets the updated value.
            // BUG-6 FIX (part B): persist differentiators so they survive cache-restore.
            // Load Vision IQ questions for this business type
            // Fire AI insights in background (non-blocking)
            // ── REACTIVE COMPETITOR EXTRACTION ──────────────────────────────────────────
            // handleScoresReady fires first from the block-group fast path when
            // store.searchResult and store.liveIntel are BOTH still undefined → competitors=0.
            // The second call (live path) only fires when liveIntel succeeds AND computeSixIndex
            // returns valid indices. If liveIntel fails (Netlify 10s timeout), the second call
            // never fires and competitors stays at 0 forever.
            // 04.22.2026 Deprecating: This $effect client-side competitor extraction is a logic
            // leak. Competitors are now provided by the server via officialCompetitorsInfo
            // in the GET /api/location-iq response (built by buildLocationScoreBundle).
            // This $effect should be removed once server-provided competitors are confirmed
            // to always arrive. Keeping it active for now as a safety net, but its localStorage
            // write has been gated.
            // This $effect reactively re-extracts competitors when data becomes available.
            // CRITICAL: use untrack() on competitors to avoid Svelte 5 circular reactivity
            // (reading + writing the same $state in an effect kills the effect).
            // Also read liveIntel from searchResult itself (set at same time as store.liveIntel)
            // Only run when we have SOME data source and analysisStore.competitors is still empty
            // untrack prevents competitors from becoming a dependency → no circular reactivity
            // Source 1: Raw Overpass from store.searchResult.data
            // D15: bars missing from raw Overpass iteration for bar_nightlife concepts
            // Source 2: liveIntel.competitors.amenities (use effectiveLI which merges both sources)
            // D15: extended type to include bars/wellness/retail/personal buckets from OverpassData
            // D15: iterate bars for bar_nightlife
            // Source 3: liveIntel.places (Google Places Nearby Search)
            // Source 4: Yelp directCompetitors
            // 04.22.2026 Deprecating: L1 localStorage write from $effect path.
            // Competitors should only be cached when received from the server.
            // L1: also persist from $effect path (covers liveIntel-only case)
            // Co-Pilot: send user question to /api/copilot/location
            // P0-D FIX: Gate on analysisAddress (always set after analysis), not geoid (often null for outer boroughs).
            // Also pass full scoring context so the AI actually knows what's on screen.
            // BUG-JWT-COPILOT (2026-04-18)
            // requireAuth() on the server reads Authorization: Bearer <token>.
            // apiFetch() is a plain fetch wrapper — it NEVER injects a Bearer token,
            // so every call returned 401 immediately. authedFetch() calls
            // Clerk.session.getToken({ skipCache: true }) before each request and
            // sets the Authorization header automatically.
            // Full scoring context — the AI needs this to answer questions about the current page
            // BR-07: enriched with verdict, kill factors, analysisStore.competitorScanStatus
            // UX-DELTA-05: launchpad-first
            // For editorial-signals lookup. Prefer a real neighborhood name; fall back
            // to the full address (getNeighborhoodBuzz does fuzzy substring matching).
            // Strip borough-only values from the geoidToBorough fallback path — they
            // won't match any neighborhoodBuzz key and just prevent address fallback.
            // Match UI display priority: sixIndex live value wins over cached sixScores
            // FIX-D: marketProof comes from fitSubScores (Cycle 2H), not sixScores
            // Also surface the two highest-impact signals for CoPilot context
            // BR-UX-07: send canonical grade + tier + nextTier + score so the CoPilot can
            // frame answers in BR-1 vocabulary instead of raw numbers. All derived via
            // decision-engine helpers — single source of truth.
            // BR-07 enrichments — make Co-Pilot responses more specific and less generic:
            // BR-12: Vision IQ completion — lets Co-Pilot guide the founder on what to fill in
            // BR-13: data source coverage — Co-Pilot can say "based on N of M sources"
            // BR-14: data freshness — Co-Pilot can reference when data was fetched
            // COP-01: DOF property tax snippet (per-address, not block-group)
            // UX-DELTA-05: launchpad-first
            // Derived: Location IQ — read from localStorage if set by callback, else compute from sixScores
            locationIQ() || 0,
            avgTicket: _lp.avgTicket || _cfPreview?.avgTicket || 5,
            visionTier: _lp.visionTier || _cfPreview?.visionTier || "standard"
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.visionIQ) {
            const prev = (dynamicVisionIQ ?? threeScores()?.visionIQ)?.score ?? null;
            dynamicVisionIQ = data.visionIQ;
            if (prev !== null && typeof prev === "number") {
              visionScoreDelta = data.visionIQ.score - prev;
              if (visionDeltaTimeout) clearTimeout(visionDeltaTimeout);
              visionDeltaTimeout = setTimeout(
                () => {
                  visionScoreDelta = null;
                },
                3e3
              );
            }
          }
          if (data.fitIQ) {
            dynamicFitIQ = data.fitIQ;
          } else if (data.fitIQ === null) {
            dynamicFitIQ = null;
          }
          if (data.fitIQ) {
            const __lp = (() => {
              try {
                return JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
              } catch {
                return {};
              }
            })();
            authedFetch("/api/fit-iq/compute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                // We fall back to 360610076001 if geoid isn't available dynamically for testing.
                geoid: "360610076001",
                legacyFitIq: data.fitIQ.score,
                launchpad: __lp
              })
            }).catch(() => {
            });
          }
          if (typeof data.maxUpside === "number") _apiMaxUpside = data.maxUpside;
        }
      } catch {
      }
      livePreviewActive = false;
    }
    function triggerScorePreview() {
      if (livePreviewTimer) clearTimeout(livePreviewTimer);
      livePreviewActive = true;
      livePreviewTimer = setTimeout(runScorePreview, 300);
    }
    let _activeAnalysisToken = "";
    (() => {
      try {
        return localStorage.getItem("re2_copilot_open") !== "false";
      } catch {
        return true;
      }
    })();
    let activeV3Tab = "summary";
    let copilotInputText = "";
    let gainPointsExpanded = false;
    const GAIN_CATEGORY_ORDER = ["location", "vision", "financials", "operations"];
    const GAIN_CATEGORY_LABEL = {
      location: "Block & location",
      vision: "Your concept",
      financials: "Financial",
      // `operations` is reserved for future signals (rent burden, daypart
      // fit). No current signal emits it so this section stays empty today.
      operations: "Operations"
    };
    let inlineCpLoading = false;
    let inlineCpMessages = (() => {
      try {
        const addr = localStorage.getItem("re2_pending_address") || "";
        return JSON.parse(sessionStorage.getItem("re2_copilot_" + addr) || "[]");
      } catch {
        return [];
      }
    })();
    const AVG_CHECK_DEFAULTS = {
      specialty_coffee: "8.75",
      bakery: "12",
      fast_casual: "14",
      qsr: "10",
      full_service_restaurant: "52",
      fine_dining: "95",
      bar_nightlife: "24",
      fitness_studio: "25",
      retail: "65",
      coworking: "350",
      medical_office: "150",
      personal_services: "35",
      wellness_spa: "95",
      juice_bar: "13",
      wellness_beverage: "12",
      florist: "68"
    };
    function applyConceptDefaults(conceptKey) {
      const sess = (() => {
        try {
          return JSON.parse(localStorage.getItem("re2_session") || "{}");
        } catch {
          return {};
        }
      })();
      const normalized = normalizeBizType(conceptKey);
      if (normalized) visionBizType = normalized;
      const defs = getConceptDefaults(visionBizType) || getConceptDefaults(conceptKey);
      if (!defs) return;
      if (!sess.visionFoodProgram) visionFoodProgram = defs.foodProgram;
      if (!sess.visionHours) {
        const lp = (() => {
          try {
            return JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
          } catch {
            return {};
          }
        })();
        const onboardingHours = lp.founderProfile?.operatingHours || "";
        visionHours = HOURS_DAYPART_MAP[onboardingHours] || defs.hours;
      }
      const isBadDefault = !sess.visionAvgCheck || sess.visionAvgCheck === "$5.50" || sess.visionAvgCheck === "$6–10" || sess.visionAvgCheck === "";
      if (isBadDefault) {
        visionAvgCheck = AVG_CHECK_DEFAULTS[visionBizType] || defs.avgCheck;
      }
      if (!visionDifferentiators && sess.visionDifferentiators) {
        visionDifferentiators = sess.visionDifferentiators;
      }
    }
    async function handleScoresReady(result) {
      const _pendingAddr = (() => {
        try {
          return localStorage.getItem("re2_pending_address");
        } catch {
          return null;
        }
      })();
      if (_pendingAddr && _pendingAddr !== result.address && _activeAnalysisToken) ;
      result.scoringTimedOut === true;
      sixScores = result.compassScores;
      storedLocationIQ = result.compassComposite;
      analysisAddress = result.address;
      analysisStore.competitorScanStatus = "pending";
      syncPinState();
      if (!store.searchResult && result.address) {
        store.searchResult = { addr: result.address };
      }
      if (result.geoid) currentGeoid = result.geoid;
      if (result.fitSubScores) fitSubScores = result.fitSubScores;
      if (result.fitScore) {
        const fs = typeof result.fitScore === "object" ? result.fitScore.score : result.fitScore;
        if (fs > 0) serverFitIQ = fs;
      }
      if (result.serverVisionIQ && result.serverVisionIQ > 0) serverVisionIQ = result.serverVisionIQ;
      if (result.dataCompleteness) dataCompleteness = result.dataCompleteness;
      if (result.dataVintage) result.dataVintage;
      if (result.dataSourceQuality?.competitors) {
        result.dataSourceQuality.competitors;
      }
      await tick();
      const _isCoffeeConcept = visionBizType === "specialty_coffee" || visionBizType === "coffee_shop" || visionBizType === "coffee" || visionBizType === "cafe";
      if (_isCoffeeConcept && result.compassComposite > 0) {
        triggerScorePreview();
      }
      loadLocationIqEnvelope();
      if (result.segmentInsight) result.segmentInsight;
      if (result.fitRingsData) result.fitRingsData;
      if (result.fitVerdict) result.fitVerdict;
      if (result.officialCompetitorsInfo) {
        analysisStore.competitors = result.officialCompetitorsInfo.items || [];
        analysisStore.competitorScanStatus = "complete";
        try {
          localStorage.setItem("re2_competitors", JSON.stringify({ addr: result.address, items: analysisStore.competitors }));
        } catch {
        }
        console.log("[RE2] competitors received from backend:", analysisStore.competitors.length);
      }
      try {
        const loc = JSON.parse(sessionStorage.getItem("re2_selected_location") || "{}");
        if (loc.lat && loc.lng && loc.addr === result.address) {
          analysisStore.mapLat = loc.lat;
          analysisStore.mapLng = loc.lng;
        }
        if (loc.neighborhood && loc.addr === result.address) locationNeighborhood = loc.neighborhood;
      } catch {
      }
      if (result.geoid && !locationNeighborhood) {
        try {
          locationNeighborhood = geoidToBorough(result.geoid);
        } catch {
        }
      }
      try {
        const session = JSON.parse(localStorage.getItem("re2_session") || "{}");
        session.locationIQ = result.compassComposite;
        session.sixScores = result.compassScores;
        session.analyzedAddress = result.address;
        session.scoredAt = Date.now();
        scoredAtDisplay = session.scoredAt;
        session.bizType = visionBizType;
        session.visionBizType = visionBizType;
        session.visitedBusinessCase = false;
        session.visitedScenarios = false;
        if (result.geoid) session.geoid = result.geoid;
        if (result.fitSubScores) session.fitSubScores = result.fitSubScores;
        if (result.fitScore) session.fitScore = result.fitScore;
        if (result.serverVisionIQ && result.serverVisionIQ > 0) session.serverVisionIQ = result.serverVisionIQ;
        if (result.compassScores.neighborhoodHealth !== void 0) {
          session.sixScores.neighborhoodHealth = result.compassScores.neighborhoodHealth;
          session.neighborhoodHealth = result.compassScores.neighborhoodHealth;
        }
        if (result.compassScores.survivalRate !== void 0) {
          session.sixScores.survivalRate = result.compassScores.survivalRate;
          session.survivalRate = result.compassScores.survivalRate;
        }
        if (result.isPartialSeed !== void 0) {
          session.isPartialSeed = result.isPartialSeed;
        }
        localStorage.setItem("re2_session", JSON.stringify(session));
        try {
          const lp2 = JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
          const locs2 = lp2.scoredLocations || [];
          const idx2 = locs2.findIndex((l) => l.addr === result.address);
          const _lp2Goals = lp2.financialGoals || {};
          const _seedRev = store.targetRevY1 || _lp2Goals.targetRevY1 || _lp2Goals.revenueY1 || 0;
          const _inputsHash = await computeInputsHashBrowser({
            address: result.address,
            lat: analysisStore.mapLat,
            lng: analysisStore.mapLng,
            concept: visionBizType || "",
            dailyTransactions: _lp2Goals.dailyTransactions ?? null,
            avgTicket: _lp2Goals.avgTicket ?? null,
            monthlyRentBudget: _lp2Goals.monthlyRentBudget ?? null,
            fundingCapital: _lp2Goals.fundingCapital ?? null,
            buildoutBudget: _lp2Goals.buildoutBudget ?? null,
            creditScoreBand: lp2.founderProfile?.creditScoreBand ?? null,
            visionIQCompletionPct: visionCompletionPct() ?? 0,
            scorerVersion: "v4.3"
          });
          const _canonical = getCanonicalScores(
            {
              compassComposite: result.compassComposite,
              fitScore: result.fitScore,
              serverVisionIQ: result.serverVisionIQ
            },
            result.compassScores,
            lp2
          );
          const entry = {
            addr: result.address,
            score: _canonical.locationIQ,
            fitScore: _canonical.fitIQ,
            visionScore: _canonical.visionIQ,
            // BRAIN-NEW-02: store sixScores so Dashboard getVerdict() + computeKillFactors() have real signal data
            sixScores: result.compassScores,
            conceptType: visionBizType,
            scoredAt: Date.now(),
            scorer_version: "v4.3",
            // BR-5 § 5.2: snapshot fields
            inputs_hash: _inputsHash,
            // BR-5 § 5.2: stable SHA-256 of scoring inputs for drift detection
            pinned: idx2 >= 0 ? locs2[idx2].pinned ?? false : false,
            documents: idx2 >= 0 ? locs2[idx2].documents ?? [] : [],
            // Seed businessCase.revenueY1 from financial goals so dashboard sort works before BC page visit
            // isPartialSeed: true flags this as pre-model data — Dashboard suppresses profit/break-even until Financials page runs
            ...idx2 < 0 && _seedRev > 0 ? {
              businessCase: {
                revenueY1: _seedRev,
                costsY1: 0,
                profitY1: 0,
                breakEvenMonths: 0,
                isPartialSeed: true
              }
            } : {}
          };
          if (idx2 >= 0) {
            locs2[idx2] = { ...locs2[idx2], ...entry };
          } else {
            locs2.push(entry);
          }
          lp2.scoredLocations = locs2;
          localStorage.setItem("re2_launchpad", JSON.stringify(lp2));
        } catch {
        }
        window.dispatchEvent(new StorageEvent("storage", {
          key: "re2_session",
          newValue: localStorage.getItem("re2_session")
        }));
        try {
          window.dispatchEvent(new CustomEvent("re2:session-updated"));
        } catch {
        }
        backgroundSync({ trigger: "location_scored" });
        const selectedLocation = {
          addr: result.address,
          lat: analysisStore.mapLat,
          lng: analysisStore.mapLng
        };
        localStorage.setItem("re2_selected_location", JSON.stringify(selectedLocation));
        const locationIntel = {
          compassScores: result.compassScores,
          compassComposite: result.compassComposite,
          geoid: result.geoid || "",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (result.liveIntel) {
          Object.assign(locationIntel, result.liveIntel);
        }
        localStorage.setItem("re2_location_intel", JSON.stringify(locationIntel));
        try {
          const { loadLaunchPadData: _loadLP, saveLaunchPadData: _saveLP } = await import("../../../../chunks/launchpad-store.js");
          const existingLP = _loadLP();
          const prevLocations = existingLP.scoredLocations || [];
          const _ob1Canonical = getCanonicalScores(
            {
              compassComposite: result.compassComposite,
              fitScore: result.fitScore,
              serverVisionIQ: result.serverVisionIQ
            },
            result.compassScores,
            existingLP
          );
          const _priorEntry = prevLocations.find((l) => l.addr === result.address) ?? {};
          const newEntry = {
            ..._priorEntry,
            // preserve existing fields (pinned, documents, businessCase, inputs_hash, scorer_version)
            addr: result.address,
            score: _ob1Canonical.locationIQ,
            fitScore: _ob1Canonical.fitIQ,
            visionScore: _ob1Canonical.visionIQ,
            // BRAIN-NEW-02: sixScores enables Dashboard getVerdict() + computeKillFactors() to show specific insights
            sixScores: result.compassScores,
            grade: result.grade || scoreGrade(_ob1Canonical.locationIQ),
            scoredAt: String(Date.now()),
            neighborhood: result.neighborhood || result.primaryHood || "",
            conceptType: visionBizType || "",
            bizType: visionBizType || "",
            // R-6: persist blockLabel from API so Dashboard card reads it directly
            blockLabel: result.blockLabel || blockTierLabel(_ob1Canonical.locationIQ) || "Developing Block"
          };
          const deduped = prevLocations.filter((l) => l.addr !== result.address);
          _saveLP({
            ...existingLP,
            scoredLocations: [...deduped, newEntry],
            lastAddress: result.address,
            lastScore: _ob1Canonical.locationIQ,
            // FIX-SAVE-01: also persist these at top level so server reads can find them
            locationIQ: _ob1Canonical.locationIQ,
            analyzedAddress: result.address
          });
        } catch (lpErr) {
          console.debug("[location] launchpad scoredLocations write failed:", lpErr);
        }
      } catch {
      }
      setTimeout(
        () => {
        },
        300
      );
      const resolvedConcept = (() => {
        try {
          const lp = JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
          const sess = JSON.parse(localStorage.getItem("re2_session") || "{}");
          return lp.businessType || sess.visionBizType || sess.bizType || store.bizType || "";
        } catch {
          return store.bizType || "";
        }
      })();
      if (resolvedConcept) applyConceptDefaults(resolvedConcept);
      try {
        const _s = JSON.parse(localStorage.getItem("re2_session") || "{}");
        _s.visionBizType = visionBizType;
        _s.visionAvgCheck = visionAvgCheck;
        _s.visionFoodProgram = visionFoodProgram;
        _s.visionHours = visionHours;
        if (
          // BUG-6 FIX (part B): persist differentiators so they survive cache-restore.
          // Load Vision IQ questions for this business type
          // Fire AI insights in background (non-blocking)
          // ── REACTIVE COMPETITOR EXTRACTION ──────────────────────────────────────────
          // handleScoresReady fires first from the block-group fast path when
          // store.searchResult and store.liveIntel are BOTH still undefined → competitors=0.
          // The second call (live path) only fires when liveIntel succeeds AND computeSixIndex
          // returns valid indices. If liveIntel fails (Netlify 10s timeout), the second call
          // never fires and competitors stays at 0 forever.
          // 04.22.2026 Deprecating: This $effect client-side competitor extraction is a logic
          // leak. Competitors are now provided by the server via officialCompetitorsInfo
          // in the GET /api/location-iq response (built by buildLocationScoreBundle).
          // This $effect should be removed once server-provided competitors are confirmed
          // to always arrive. Keeping it active for now as a safety net, but its localStorage
          // write has been gated.
          // This $effect reactively re-extracts competitors when data becomes available.
          // CRITICAL: use untrack() on competitors to avoid Svelte 5 circular reactivity
          // (reading + writing the same $state in an effect kills the effect).
          // Also read liveIntel from searchResult itself (set at same time as store.liveIntel)
          // Only run when we have SOME data source and analysisStore.competitors is still empty
          // untrack prevents competitors from becoming a dependency → no circular reactivity
          // Source 1: Raw Overpass from store.searchResult.data
          // D15: bars missing from raw Overpass iteration for bar_nightlife concepts
          // Source 2: liveIntel.competitors.amenities (use effectiveLI which merges both sources)
          // D15: extended type to include bars/wellness/retail/personal buckets from OverpassData
          // D15: iterate bars for bar_nightlife
          // Source 3: liveIntel.places (Google Places Nearby Search)
          // Source 4: Yelp directCompetitors
          // 04.22.2026 Deprecating: L1 localStorage write from $effect path.
          // Competitors should only be cached when received from the server.
          // L1: also persist from $effect path (covers liveIntel-only case)
          // Co-Pilot: send user question to /api/copilot/location
          // P0-D FIX: Gate on analysisAddress (always set after analysis), not geoid (often null for outer boroughs).
          // Also pass full scoring context so the AI actually knows what's on screen.
          // BUG-JWT-COPILOT (2026-04-18)
          // requireAuth() on the server reads Authorization: Bearer <token>.
          // apiFetch() is a plain fetch wrapper — it NEVER injects a Bearer token,
          // so every call returned 401 immediately. authedFetch() calls
          // Clerk.session.getToken({ skipCache: true }) before each request and
          // sets the Authorization header automatically.
          // Full scoring context — the AI needs this to answer questions about the current page
          // BR-07: enriched with verdict, kill factors, analysisStore.competitorScanStatus
          // UX-DELTA-05: launchpad-first
          // For editorial-signals lookup. Prefer a real neighborhood name; fall back
          // to the full address (getNeighborhoodBuzz does fuzzy substring matching).
          // Strip borough-only values from the geoidToBorough fallback path — they
          // won't match any neighborhoodBuzz key and just prevent address fallback.
          // Match UI display priority: sixIndex live value wins over cached sixScores
          // FIX-D: marketProof comes from fitSubScores (Cycle 2H), not sixScores
          // Also surface the two highest-impact signals for CoPilot context
          // BR-UX-07: send canonical grade + tier + nextTier + score so the CoPilot can
          // frame answers in BR-1 vocabulary instead of raw numbers. All derived via
          // decision-engine helpers — single source of truth.
          // BR-07 enrichments — make Co-Pilot responses more specific and less generic:
          // BR-12: Vision IQ completion — lets Co-Pilot guide the founder on what to fill in
          // BR-13: data source coverage — Co-Pilot can say "based on N of M sources"
          // BR-14: data freshness — Co-Pilot can reference when data was fetched
          // COP-01: DOF property tax snippet (per-address, not block-group)
          // UX-DELTA-05: launchpad-first
          // Derived: Location IQ — read from localStorage if set by callback, else compute from sixScores
          // DYNC-008: concept-aware fallback weights (API result overwrites on success)
          // ── VISION IQ: Dynamic scoring from form inputs + location data ──
          // Vision IQ measures how well THIS concept fits THIS location.
          // It recomputes every time a Vision form field changes.
          // UX-2.4: VISION_ARCHETYPES + DEFAULT_ARCHETYPE now imported from
          // $lib/constants/visionArchetypes (B2-1.4). Previously inlined here; server
          // routes (e.g. /api/score/preview) couldn't consume it, causing 5–10 point
          // visionIQ drift between client and server. Shared module eliminates that.
          // C2-FIX-05: Fallback daypart map when getConceptDefaults hasn't set visionHours
          // Normalize onboarding hours values to canonical scoring categories (morning/evening/all_day)
          // Resolved visionHours — uses session value, falls back to concept map, then 'all_day'
          // ── Vision IQ 4-panel: concept group → drives label + field slot swaps ────
          // Panel 2: avg check label adapts per group
          // Panel 2: avg check placeholder adapts per group
          // Panel 3 slot 3: F&B shows Food Program, all others show Team Size
          // Panel 3: target size placeholder shows concept-appropriate hint
          // Panel completeness per panel (drives pts badge colour)
          // Vision IQ — DYNAMIC: reacts to form inputs + location data
          visionIQ() > 0
        ) _s.visionIQ = visionIQ();
        if (visionDifferentiators) _s.visionDifferentiators = visionDifferentiators;
        localStorage.setItem("re2_session", JSON.stringify(_s));
        try {
          window.dispatchEvent(new CustomEvent("re2:session-updated"));
        } catch {
        }
      } catch {
      }
      loadConceptQuestions(visionBizType);
      fetchAIInsights();
    }
    let storedLocationIQ = 0;
    let locationIQ = derived(() => {
      if (storedLocationIQ > 0) return storedLocationIQ;
      const s = sixScores;
      if (!s.transit && !s.demographics) return 0;
      const _lw = getLocationWeights(visionBizType);
      const w = {
        transit: _lw.transit,
        demographics: _lw.demographics,
        competition: _lw.competition,
        vibrancy: _lw.vibrancy,
        safety: _lw.safety,
        momentum: _lw.footTraffic
      };
      let total = 0;
      let wSum = 0;
      for (const [k, weight] of Object.entries(w)) {
        if (s[k] != null) {
          total += s[k] * weight;
          wSum += weight;
        }
      }
      return wSum > 0 ? Math.round(total / wSum) : 0;
    });
    const HOURS_DAYPART_MAP = {
      early_morning: "morning",
      morning_heavy: "morning",
      standard: "all_day",
      standard_retail: "all_day",
      dinner: "evening",
      evening: "evening",
      split_am_pm: "morning",
      all_day: "all_day",
      late_night: "evening",
      "24_7": "all_day"
    };
    function parseCheckAmount(val) {
      const n = parseFloat(val.replace(/[$,]/g, ""));
      return isNaN(n) ? 5.5 : n;
    }
    function parseAgeRange(val) {
      const parts = val.split("-").map((s) => parseInt(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return [parts[0], parts[1]];
      return [25, 40];
    }
    let visionIQ = derived(() => {
      const arch = VISION_ARCHETYPES[visionBizType] || DEFAULT_ARCHETYPE;
      const s = hasResult() && locationIQ() ? sixScores : {
        transit: 50,
        vibrancy: 50,
        demographics: 50,
        safety: 50,
        competition: 50
      };
      const check = parseCheckAmount(visionAvgCheck);
      const [ageLo, ageHi] = parseAgeRange(visionTargetAge);
      const rawComp = s.competition || 50;
      let competitionFit = rawComp;
      let priceIncomeFit = 50;
      try {
        const session = JSON.parse(localStorage.getItem("re2_session") || "{}");
        const intel = JSON.parse(sessionStorage.getItem("re2_location_intel") || "{}");
        const medianIncome = intel?.census?.medianHouseholdIncome || intel?.medianHouseholdIncome || 0;
        if (medianIncome > 0) {
          const annualSpend = check * 2.5 * 52;
          const spendRatio = annualSpend / medianIncome;
          const idealRatio = arch.footTrafficW > 0.25 ? 0.06 : 0.03;
          priceIncomeFit = Math.max(10, Math.min(95, Math.round(100 - Math.abs(spendRatio - idealRatio) * 800)));
        } else {
          const [lo, hi] = arch.idealCheck;
          if (check >= lo && check <= hi) priceIncomeFit = 75;
          else if (check < lo) priceIncomeFit = Math.max(30, 75 - (lo - check) * 5);
          else priceIncomeFit = Math.max(30, 75 - (check - hi) * 3);
        }
      } catch {
        const [lo, hi] = arch.idealCheck;
        priceIncomeFit = check >= lo && check <= hi ? 70 : 45;
      }
      const PRICE_CEILINGS = {
        specialty_coffee: 20,
        bakery: 25,
        fast_casual: 40,
        full_service_restaurant: 150,
        qsr: 30,
        bar_nightlife: 80,
        juice_bar: 35,
        wellness_beverage: 30,
        retail: 300,
        fitness_studio: 100,
        personal_services: 120,
        wellness_spa: 400,
        medical_office: 600,
        florist: 300,
        coworking: 2e3
      };
      const _priceCeiling = PRICE_CEILINGS[visionBizType] ?? arch.idealCheck[1] * 3;
      if (check > _priceCeiling) {
        const _overagePoints = Math.floor((check - _priceCeiling) * 1.5);
        priceIncomeFit = Math.max(10, priceIncomeFit - _overagePoints);
      }
      let ageFit = s.demographics || 50;
      const midAge = (ageLo + ageHi) / 2;
      if (midAge < 30 && (s.vibrancy || 50) >= 65) ageFit = Math.min(95, ageFit + 10);
      if (midAge > 45 && (s.safety || 50) >= 70) ageFit = Math.min(95, ageFit + 8);
      if (midAge >= 30 && midAge <= 45) ageFit = Math.min(95, ageFit + 5);
      let hoursFit = s.transit || 50;
      const hoursCategory = HOURS_DAYPART_MAP[visionHours] || visionHours || "all_day";
      if (hoursCategory === "morning" && arch.peakHours === "morning") hoursFit = Math.min(95, hoursFit + 8);
      else if (hoursCategory === "evening" && (s.vibrancy || 50) >= 60) hoursFit = Math.min(95, hoursFit + 6);
      else if (hoursCategory === "all_day") hoursFit = Math.min(90, hoursFit + 3);
      if (hoursCategory === "morning" && arch.peakHours === "evening") hoursFit = Math.max(20, hoursFit - 12);
      if (hoursCategory === "evening" && arch.peakHours === "morning") hoursFit = Math.max(20, hoursFit - 10);
      let foodFit = 60;
      if (visionFoodProgram === "full_kitchen" && (s.vibrancy || 50) >= 60) foodFit = 75;
      else if (visionFoodProgram === "light_bites" && arch.footTrafficW >= 0.3) foodFit = 72;
      else if (visionFoodProgram === "grab_go" && (s.transit || 50) >= 65) foodFit = 78;
      else if (visionFoodProgram === "none") foodFit = 55;
      let diffBonus = 0;
      const diffWords = visionDifferentiators.trim() ? visionDifferentiators.trim().split(/[\s,;]+/).filter((w) => w.length > 2).length : 0;
      const _conceptCheckDefault = AVG_CHECK_DEFAULTS[visionBizType] || "";
      const _stripDollar = (s2) => s2.replace(/^\$/, "").trim();
      const hasNonDefaultCheck = visionAvgCheck && _stripDollar(visionAvgCheck) !== "" && _stripDollar(visionAvgCheck) !== _conceptCheckDefault;
      const hasNonDefaultAge = visionTargetAge !== "24-42";
      const completionBonus = Math.min(8, diffWords * 2) + (hasNonDefaultCheck ? 3 : 0) + (hasNonDefaultAge ? 2 : 0);
      diffBonus = Math.min(13, completionBonus);
      let rentPenalty = 0;
      try {
        const lp = JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
        const monthlyRent = lp.financialGoals?.monthlyRentBudget || 0;
        if (monthlyRent > 0) {
          const kpi = CONCEPT_KPIS[visionBizType];
          const maxPct = kpi?.maxRentPercent || 12;
          const annualRent = monthlyRent * 12;
          const projRevenue = (() => {
            const v = kpi?.coaching?.breakEvenAnnualRevenue;
            if (!v) console.warn("[RE2] Missing breakEvenAnnualRevenue for concept:", visionBizType);
            return v ?? 4e5;
          })();
          const rentPct = annualRent / projRevenue * 100;
          if (rentPct > maxPct * 1.5) rentPenalty = -12;
          else if (rentPct > maxPct) rentPenalty = -6;
          else if (rentPct <= maxPct * 0.7) rentPenalty = 3;
        }
      } catch {
      }
      let storeTypeMod = 0;
      if (visionStoreType) {
        const transit = s.transit || 50;
        if (visionStoreType === "prominent_storefront") storeTypeMod = transit >= 70 ? 4 : 2;
        else if (visionStoreType === "kiosk") storeTypeMod = transit >= 80 ? 5 : 1;
        else if (visionStoreType === "large_sitdown") storeTypeMod = arch.peakHours === "evening" ? 3 : -1;
        else if (visionStoreType === "shared") storeTypeMod = -2;
        else if (visionStoreType === "popup") storeTypeMod = -3;
      }
      let sizeMod = 0;
      if (visionTargetSize) {
        const IDEAL_SIZE = {
          specialty_coffee: [400, 1200],
          bakery: [500, 1500],
          fast_casual: [800, 2e3],
          full_service_restaurant: [1500, 4e3],
          qsr: [600, 1500],
          bar_nightlife: [1e3, 3e3],
          juice_bar: [300, 800],
          wellness_beverage: [300, 800],
          retail: [500, 3e3],
          fitness_studio: [1500, 5e3],
          personal_services: [400, 1500],
          wellness_spa: [1e3, 3e3],
          medical_office: [800, 2500],
          florist: [300, 1e3],
          coworking: [2e3, 8e3]
        };
        const SIZE_MID = {
          under_500: 350,
          "500_1000": 750,
          "1000_2000": 1500,
          "2000_5000": 3500,
          "5000_plus": 7e3
        };
        const userMid = SIZE_MID[visionTargetSize] || 1e3;
        const [idealLo, idealHi] = IDEAL_SIZE[visionBizType] || [500, 3e3];
        if (userMid >= idealLo && userMid <= idealHi) sizeMod = 3;
        else if (userMid < idealLo) sizeMod = userMid < idealLo * 0.5 ? -3 : 0;
        else sizeMod = userMid > idealHi * 1.5 ? -4 : -1;
      }
      let clientMod = 0;
      if (visionTargetClients) {
        const vibrancy = s.vibrancy || 50;
        const transit = s.transit || 50;
        const demographics = s.demographics || 50;
        if (visionTargetClients === "young_professionals" && vibrancy >= 60 && demographics >= 50) clientMod = 3;
        else if (visionTargetClients === "families" && (s.safety || 50) >= 60 && demographics >= 55) clientMod = 3;
        else if (visionTargetClients === "students" && vibrancy >= 65) clientMod = 2;
        else if (visionTargetClients === "fitness_crowd" && transit >= 60) clientMod = 2;
        else if (visionTargetClients === "remote_workers" && vibrancy >= 50) clientMod = 2;
        else if (visionTargetClients === "tourists" && transit >= 70 && vibrancy >= 60) clientMod = 3;
        else if (visionTargetClients === "mixed") clientMod = 1;
        else if (visionTargetClients) clientMod = 0;
      }
      const weighted = competitionFit * arch.competitionW + priceIncomeFit * arch.demographicsW + // price-income uses demographics weight
      ageFit * arch.vibrancyW + // age uses vibrancy weight
      hoursFit * arch.footTrafficW + // hours uses foot traffic weight
      foodFit * 0.1;
      const normalized = weighted / 1.1;
      const clientScore = Math.max(0, Math.min(100, Math.round(normalized + diffBonus + rentPenalty + storeTypeMod + sizeMod + clientMod)));
      const _hasCustomDiff = visionDifferentiators.trim().split(/[\s,;]+/).filter((w) => w.length > 2).length >= 1;
      const _hasCustomCheck = visionAvgCheck && _stripDollar(visionAvgCheck) !== "" && _stripDollar(visionAvgCheck) !== (AVG_CHECK_DEFAULTS[visionBizType] || "");
      const _hasConceptQAnswers = Object.keys(conceptAnswers).filter((k) => conceptAnswers[k] !== "").length > 0;
      const _userHasCustomized = _hasCustomDiff || _hasCustomCheck || _hasConceptQAnswers;
      if (serverVisionIQ && serverVisionIQ > 0 && hasResult() && !_userHasCustomized) {
        return serverVisionIQ;
      }
      return clientScore;
    });
    let fitIQ = derived(() => {
      if (!hasResult() || !locationIQ()) return 0;
      if (dynamicFitIQ && dynamicFitIQ.score > 0) return dynamicFitIQ.score;
      return serverFitIQ && serverFitIQ > 0 ? serverFitIQ : 0;
    });
    function fitVerdict(fit, loc, vis) {
      if (fit >= 75) return "Strong fit. Excellent fundamentals and concept alignment for this block.";
      if (fit >= 65) return "Good fit. Solid fundamentals with room to optimize your concept.";
      if (fit >= 55) return "Moderate fit. The block has potential — refine your concept details to improve alignment.";
      if (fit >= 45) return "Mixed signals. Location fundamentals and concept fit need work — review the Concept panel for improvement areas.";
      if (fit >= 35) return "Below average. Significant gaps between this location and your concept. Consider adjusting your vision or exploring other blocks.";
      return "Weak fit. This location presents serious challenges for your concept. Explore alternative locations.";
    }
    async function loadConceptQuestions(bizType) {
      try {
        const res = await apiFetch(`/api/concept-config?type=${encodeURIComponent(bizType)}`);
        if (res.ok) {
          const data = await res.json();
          conceptQuestions = data.questions || [];
        }
      } catch {
      }
    }
    function scoreGrade(val) {
      if (val >= 90) return "A";
      if (val >= 85) return "A-";
      if (val >= 80) return "B+";
      if (val >= 75) return "B";
      if (val >= 70) return "B-";
      if (val >= 65) return "C+";
      if (val >= 60) return "C";
      if (val >= 55) return "C-";
      return "D";
    }
    function friendlyBizType(raw) {
      return getConceptLabel(raw);
    }
    function normalizeBizType(raw) {
      return normalizeBusinessType(raw);
    }
    let bizTypeLabel = derived(() => friendlyBizType(visionBizType || store.bizType));
    let whyBullets = derived(() => fitIQ() > 0 ? getWhyBulletsV2({
      survivalRate: sixScores["survivalRate"] || sixScores["survival_rate"] || 0,
      competitorCount: analysisStore.competitors.length,
      transitScore: sixScores["transit"] || sixScores["transitScore"] || 0,
      competitorScanStatus: analysisStore.competitorScanStatus
      // BRAIN-NEW-01: prevents "0 competitors" from being mistaken for a scan result
    }) : []);
    let decisionState = derived(() => getDecisionState(fitIQ(), locationIQ(), visionIQ(), sixScores, fitSubScores, visionBizType, visionIsPrelim()));
    let evidence = derived(() => getEvidencePayload(fitIQ(), locationIQ(), visionIQ(), sixScores, fitSubScores, visionBizType, visionIsPrelim()));
    let coaching = derived(() => getConceptCoaching(fitIQ(), locationIQ(), visionIQ(), sixScores, fitSubScores, visionBizType));
    let aiVisionAnchor = null;
    let aiVisionLoading = false;
    let aiFitRecs = null;
    let aiFitLoading = false;
    async function fetchAIInsights() {
      if (!hasResult() || !visionBizType || aiVisionLoading || aiFitLoading) return;
      let intelData = { census: { medianHouseholdIncome: 0, competitorCount: 0 } };
      try {
        intelData = JSON.parse(sessionStorage.getItem("re2_location_intel") || "{}");
      } catch {
      }
      const hood = locationNeighborhood || "";
      const boro = currentBorough() || (currentGeoid ? geoidToBorough(currentGeoid) : "Manhattan");
      const conceptLabel = bizTypeLabel();
      const concept = visionBizType;
      aiVisionLoading = true;
      aiFitLoading = true;
      const batchBody = [
        {
          action: "vision-anchor",
          conceptType: concept,
          conceptLabel,
          neighborhood: hood,
          borough: boro,
          differentiators: visionDifferentiators,
          targetClients: visionTargetClients,
          competitors: analysisStore.competitors.length,
          medianIncome: intelData.census?.medianHouseholdIncome || 0
        },
        {
          action: "fit-improvement",
          conceptType: concept,
          conceptLabel,
          neighborhood: hood,
          borough: boro,
          fitIQ: fitIQ(),
          locationIQ: locationIQ(),
          visionIQ: visionIQ(),
          sixScores,
          monthlyRent: 5e3,
          avgCheck: 0,
          competitors: analysisStore.competitors.length,
          differentiators: visionDifferentiators,
          medianIncome: intelData.census?.medianHouseholdIncome || 0
        }
      ];
      try {
        const res = await apiFetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batchBody)
        });
        if (res.ok) {
          const jsonRes = await res.json();
          if (jsonRes.success && Array.isArray(jsonRes.data)) {
            const [visionData, fitData] = jsonRes.data;
            if (visionData?.success && visionData.data) {
              aiVisionAnchor = visionData.data;
            } else {
              aiVisionAnchor = null;
              console.error("Vision AI error:", visionData?.error);
            }
            if (fitData?.success && fitData.data) {
              aiFitRecs = fitData.data;
            } else {
              aiFitRecs = null;
              console.error("Fit AI error:", fitData?.error);
            }
          }
        }
      } catch (err) {
        console.error("AI Insights fetch failed", err);
      } finally {
        aiVisionLoading = false;
        aiFitLoading = false;
      }
    }
    head("1bhv1ao", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE\\u00B2 \\u2014 Location Intelligence</title>`);
      });
      $$renderer3.push(`<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" class="svelte-1bhv1ao"/>`);
    });
    $$renderer2.push(`<div class="location-page svelte-1bhv1ao"><a href="/app/route" class="loc-back-link svelte-1bhv1ao">← Back to Dashboard</a> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (!hasResult()) {
      $$renderer2.push("<!--[0-->");
      if (comingFromBot()) {
        $$renderer2.push("<!--[0-->");
        {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div class="bot-handoff svelte-1bhv1ao">`);
          AddressAnalyzer($$renderer2, {
            store,
            onScoresReady: handleScoresReady,
            onBeforeSearch: handleBeforeSearch,
            searchOnly: true
          });
          $$renderer2.push(`<!----> <div class="handoff-progress svelte-1bhv1ao"><span class="handoff-spinner svelte-1bhv1ao"></span> <span class="handoff-progress-msg svelte-1bhv1ao">${escape_html(HANDOFF_MESSAGES[handoffProgressIdx])}</span></div></div>`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="pre-search svelte-1bhv1ao"><div class="map-panel-hero svelte-1bhv1ao">`);
        LocationContextMap($$renderer2, { store: analysisStore, compact: false, showPin: false });
        $$renderer2.push(`<!----> <div class="map-overlay svelte-1bhv1ao">`);
        if (!visionBizType && !store.bizType) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<h1 class="map-overlay-title svelte-1bhv1ao">Tell us about your concept first</h1> <p class="map-overlay-sub svelte-1bhv1ao">We need to know what kind of business you're
								opening before we can score a location. It takes
								about 2 minutes.</p> <a href="/app/onboarding" class="map-overlay-cta svelte-1bhv1ao">Get Started →</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div class="map-overlay-badge svelte-1bhv1ao">${escape_html(bizTypeLabel())}</div> <h1 class="map-overlay-title svelte-1bhv1ao">Should you sign this lease?</h1> <p class="map-overlay-sub svelte-1bhv1ao">Enter an address. We'll check everything that
								matters for your concept — foot traffic,
								competition, safety, and more.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div> `);
        if (visionBizType || store.bizType) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="search-panel svelte-1bhv1ao">`);
          AddressAnalyzer($$renderer2, {
            store,
            onScoresReady: handleScoresReady,
            onBeforeSearch: handleBeforeSearch
          });
          $$renderer2.push(`<!----></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      const _transitScore = sixScores["transit"] || sixScores["transitScore"] || 0;
      const _survivalScore = sixScores["survivalRate"] || sixScores["survival_rate"] || 0;
      sixScores["demographics"] || 0;
      sixScores["competition"] || 0;
      sixScores["vibrancy"] || sixScores["vibrancy_index"] || 0;
      sixScores["momentum"] || 0;
      const _safetyScore = sixScores["safety"] || 0;
      const _addrShort = analysisAddress ? analysisAddress.split(",")[0] : "Location";
      const _addrRest = analysisAddress ? analysisAddress.split(",").slice(1, 3).join(",").trim() : "";
      const _fitBand = fitIQ() >= 75 ? "strong" : fitIQ() >= 65 ? "viable" : fitIQ() >= 50 ? "tight" : fitIQ() >= 40 ? "stretch" : "rethink";
      const _fitLabel = apiVerdict() || fitTierLabel(fitIQ());
      const _fitGrade = gradeCapped() || fitGradeCapped(fitIQ(), sixScores, _survivalScore);
      const _watchOutCount = Math.min(evidence().hurting.length, 5);
      const _fitMeaning = fitMeaning(fitIQ(), { watchOutCount: _watchOutCount });
      const _conceptForVerdict = CONCEPT_LABELS[visionBizType] || "";
      const _fitVerdictShort = _conceptForVerdict ? fitVerdictShort(fitIQ(), _conceptForVerdict) : "";
      const _fitNextTier = fitNextTier(fitIQ());
      NavigationDrawer($$renderer2, { analyzedAddress: analysisAddress });
      $$renderer2.push(`<!----> `);
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
      $$renderer2.push(`<!--]-->             `);
      if (rule17Block()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="rule17-banner svelte-1bhv1ao" role="alert" aria-live="assertive"><div class="rule17-banner-inner svelte-1bhv1ao"><div class="rule17-banner-icon svelte-1bhv1ao" aria-hidden="true">🚫</div> <div class="rule17-banner-body svelte-1bhv1ao"><div class="rule17-banner-title svelte-1bhv1ao">This location cannot get a liquor license</div> <div class="rule17-banner-copy svelte-1bhv1ao">`);
        if (rule17Block().schoolName && rule17Block().distFt) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`${escape_html(rule17Block().schoolName)} is ${escape_html(rule17Block().distFt)}
								ft away. NY SLA 200-ft rule — zero exceptions.`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`A school is within 200 ft of this address. NY
								SLA 200-ft rule — zero exceptions.`);
        }
        $$renderer2.push(`<!--]--></div></div> <div class="rule17-banner-actions svelte-1bhv1ao"><button type="button" class="rule17-btn rule17-btn-primary svelte-1bhv1ao">Reset search</button> <button type="button" class="rule17-btn rule17-btn-ghost svelte-1bhv1ao">Proceed anyway</button></div></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (apiKillBannerVisible()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="kill-factor-banner svelte-1bhv1ao" role="alert" aria-live="polite"><div class="kill-factor-banner-inner svelte-1bhv1ao"><div class="kill-factor-banner-icon svelte-1bhv1ao">⛔</div> <div class="kill-factor-banner-body svelte-1bhv1ao"><div class="kill-factor-banner-title svelte-1bhv1ao">Kill factor detected: ${escape_html(apiKillFactors()[0].name)}</div> <div class="kill-factor-banner-copy svelte-1bhv1ao">Your Score capped at ${escape_html(fitIQ())} — ${escape_html(apiKillFactors()[0].reason)}`);
        if (apiKillFactors().length > 1) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="kill-factor-more svelte-1bhv1ao">(+${escape_html(apiKillFactors().length - 1)} more)</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div></div></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (fitIQ() > 0 || locationIQ() > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="v3-hero svelte-1bhv1ao"><div class="v3-hero-inner svelte-1bhv1ao"><div class="v3-hero-ring-wrap svelte-1bhv1ao"><svg width="120" height="120" viewBox="0 0 120 120" style="transform:rotate(-90deg)" class="svelte-1bhv1ao"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="6" class="svelte-1bhv1ao"></circle><circle cx="60" cy="60" r="52" fill="none"${attr("stroke", fitIQ() >= 65 ? "#34d399" : fitIQ() >= 50 ? "#fbbf24" : "#f87171")} stroke-width="6" stroke-dasharray="326.7"${attr("stroke-dashoffset", 326.7 * (1 - fitIQ() / 100))} stroke-linecap="round" class="svelte-1bhv1ao"></circle></svg> <div${attr_class("v3-hero-ring-num svelte-1bhv1ao", void 0, { "is-live-preview": livePreviewActive })}>${escape_html(fitIQ())}</div> <div class="v3-hero-ring-label svelte-1bhv1ao">Your Score</div>  `);
        if (gradeCapped() && gradeCapReason()) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="v3-hero-grade-cap-note svelte-1bhv1ao"${attr("title", gradeCapReason())}>Grade capped at ${escape_html(gradeCapped())}</div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (livePreviewActive) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="v3-hero-live-badge svelte-1bhv1ao" title="Updating score from your new inputs…">LIVE</div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <div class="v3-hero-text svelte-1bhv1ao">`);
        ScoreHeader($$renderer2, {
          grade: _fitGrade,
          verdict: _fitLabel,
          verdictIcon: fitIQ() >= 65 ? "✓" : fitIQ() >= 50 ? "◑" : "✗",
          confidence: scoreConfidence(),
          confidenceReason: scoreConfidenceReason()
        });
        $$renderer2.push(`<!----> <div class="v3-hero-addr svelte-1bhv1ao">${escape_html(_addrShort)} `);
        if (_addrRest) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="v3-hero-addr-sub svelte-1bhv1ao">· ${escape_html(_addrRest)}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <div class="v3-hero-meaning svelte-1bhv1ao">`);
        if (_fitVerdictShort) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<strong class="svelte-1bhv1ao">${escape_html(_fitVerdictShort)}</strong> ${escape_html(_fitMeaning)}`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<strong class="svelte-1bhv1ao">${escape_html(fitIQ())}/100 — ${escape_html(_fitLabel)}</strong> · ${escape_html(_fitMeaning)}`);
        }
        $$renderer2.push(`<!--]--> `);
        if (visionIsPrelim() && visionCompletionPct() < 50) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(` Based on ${escape_html(visionFieldsFilled().filled)} of ${escape_html(visionFieldsFilled().total)}
								inputs — <button type="button" class="v3-hero-sharpen-link svelte-1bhv1ao">add concept details to refine this score</button>.`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> `);
        if (_fitNextTier && _fitNextTier.points > 0 && _fitNextTier.points <= 15) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="v3-hero-next-tier svelte-1bhv1ao">You're <strong class="svelte-1bhv1ao">${escape_html(_fitNextTier.points)}
									${escape_html(_fitNextTier.points === 1 ? "point" : "points")}</strong> from <strong class="svelte-1bhv1ao">${escape_html(_fitNextTier.label)}</strong> territory. <button type="button" class="v3-hero-howlink svelte-1bhv1ao">How? →</button></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->  `);
        if (percentileText() && locationConfidenceTier() !== "skeleton") {
          $$renderer2.push("<!--[0-->");
          const _isLowVerdict = fitIQ() > 0 && fitIQ() < 65;
          const _displayPercentile = _isLowVerdict ? `In the middle range for NYC ${CONCEPT_LABELS[visionBizType] || "locations"}` : percentileText();
          if (locationConfidenceTier() === "partial") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="v3-hero-percentile v3-metric-partial svelte-1bhv1ao" title="Preliminary — based on partial data, refreshing soon.">~ ${escape_html(_displayPercentile)}</div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<div class="v3-hero-percentile svelte-1bhv1ao">${escape_html(_displayPercentile)}</div>`);
          }
          $$renderer2.push(`<!--]-->`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <div class="v3-hero-actions svelte-1bhv1ao"><a href="/app/business-plan" class="v3-hero-btn v3-hero-btn-primary svelte-1bhv1ao">Build your Business Case →</a> <button class="v3-hero-btn v3-hero-btn-ghost svelte-1bhv1ao" type="button">`);
        if (isPinned) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`✓ Shortlisted`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`⊕ Save to
									shortlist`);
        }
        $$renderer2.push(`<!--]--></button> <button class="v3-hero-btn v3-hero-btn-ghost svelte-1bhv1ao" type="button">↗ Export brief</button></div></div> <div class="v3-hero-cp-card svelte-1bhv1ao"><div class="v3-hero-cp-head svelte-1bhv1ao"><span class="v3-hero-cp-sparkle svelte-1bhv1ao">✨</span> <span class="v3-hero-cp-title svelte-1bhv1ao">Ask about this location</span></div> <div class="v3-hero-cp-sub svelte-1bhv1ao">about ${escape_html(_addrShort)}</div> <div class="v3-hero-cp-chips svelte-1bhv1ao"><button type="button" class="v3-hero-cp-chip svelte-1bhv1ao"${attr("disabled", inlineCpLoading, true)}>Why is this a ${escape_html(fitIQ())}?</button> <button type="button" class="v3-hero-cp-chip svelte-1bhv1ao"${attr("disabled", inlineCpLoading, true)}>How do I improve my chances?</button> <button type="button" class="v3-hero-cp-chip svelte-1bhv1ao"${attr("disabled", inlineCpLoading, true)}>What would kill this?</button></div></div></div>  <div class="v3-hero-meta svelte-1bhv1ao">`);
        ScoreMetaLine($$renderer2, {
          scoredAt: scoredAtDisplay,
          surface: "ring"
        });
        $$renderer2.push(`<!----> `);
        if (dataCompleteness && dataCompleteness.pct > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="v3-data-pill v3-data-pill--static svelte-1bhv1ao" title="Analyzed from 20+ live city + market data sources. Full list available in the exported brief.">Based on ${escape_html(dataCompleteness.available)} of ${escape_html(dataCompleteness.total)}
							data sources</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<span class="v3-data-pill v3-data-pill--static svelte-1bhv1ao" title="Analyzed from 20+ live city + market data sources. Full list available in the exported brief.">Analyzed from 20+ live city + market data sources</span>`);
        }
        $$renderer2.push(`<!--]--></div></div> `);
        {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (inlineCpMessages.length > 0 || inlineCpLoading) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="v3-ask-answer svelte-1bhv1ao" role="log" aria-live="polite" aria-label="Co-Pilot answers"><div class="v3-ask-answer-head svelte-1bhv1ao"><span class="v3-ask-answer-sparkle svelte-1bhv1ao" aria-hidden="true">✨</span> <span class="v3-ask-answer-title svelte-1bhv1ao">Co-Pilot</span> <button type="button" class="v3-ask-answer-clear svelte-1bhv1ao"${attr("disabled", inlineCpMessages.length === 0 || inlineCpLoading, true)}>Clear</button></div> <div class="v3-ask-answer-body svelte-1bhv1ao"><!--[-->`);
        const each_array = ensure_array_like(inlineCpMessages);
        for (let i = 0, $$length = each_array.length; i < $$length; i++) {
          let m = each_array[i];
          $$renderer2.push(`<div${attr_class(`v3-ask-msg v3-ask-msg--${stringify(m.role)}`, "svelte-1bhv1ao")}>`);
          if (m.role === "bot") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="v3-ask-msg-avatar svelte-1bhv1ao" aria-hidden="true">RE²</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <div class="v3-ask-msg-bubble svelte-1bhv1ao">${escape_html(sanitizeCopilotText(m.text))}</div></div>`);
        }
        $$renderer2.push(`<!--]--> `);
        {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (hasResult() && fitIQ() > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="v3-split svelte-1bhv1ao"><div class="v3-left svelte-1bhv1ao"><div class="v3-tabs svelte-1bhv1ao"><button${attr_class("v3-tab svelte-1bhv1ao", void 0, { "active": activeV3Tab === "summary" })}>Summary</button> <button${attr_class("v3-tab svelte-1bhv1ao", void 0, { "active": activeV3Tab === "deepdive" })}>Deep Dive</button> <button${attr_class("v3-tab svelte-1bhv1ao", void 0, { "active": activeV3Tab === "vision" })}>Your Concept</button></div> <div class="v3-tab-body svelte-1bhv1ao">`);
        {
          $$renderer2.push("<!--[0-->");
          const gainItemsSorted = [...evidence().canChange].sort((a, b) => a.value - b.value);
          const gainPrimary = gainItemsSorted.slice(0, 3);
          const gainMore = gainItemsSorted.slice(3);
          const gainVisible = gainPrimary;
          $$renderer2.push(`<div class="v3-meaning-card svelte-1bhv1ao"><div class="v3-meaning-eyebrow svelte-1bhv1ao">What this score means for you</div> <div class="v3-meaning-text svelte-1bhv1ao">`);
          if (decisionState()?.summary) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`${escape_html(decisionState().summary)}`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`${escape_html(fitVerdict(fitIQ(), locationIQ(), visionIQ()))}`);
          }
          $$renderer2.push(`<!--]--> `);
          if (coaching()?.revenueContext) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`${escape_html(coaching().revenueContext)}`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div></div> `);
          FactorDrilldown($$renderer2, { store: analysisStore, evidence: evidence() });
          $$renderer2.push(`<!---->   `);
          if (evidence().canChange.length > 0 || coaching()?.nextSteps && coaching().nextSteps.length > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="v3-improve-card svelte-1bhv1ao"><div class="v3-improve-title svelte-1bhv1ao">How to improve this score</div> `);
            if (evidence().canChange.length > 0) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<!--[-->`);
              const each_array_1 = ensure_array_like(GAIN_CATEGORY_ORDER);
              for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
                let cat = each_array_1[$$index_2];
                const _catItems = gainVisible.filter((it) => it.category === cat);
                if (_catItems.length > 0) {
                  $$renderer2.push("<!--[0-->");
                  $$renderer2.push(`<div class="v3-improve-group svelte-1bhv1ao"><div class="v3-improve-group-head svelte-1bhv1ao">${escape_html(GAIN_CATEGORY_LABEL[cat])}</div> <!--[-->`);
                  const each_array_2 = ensure_array_like(_catItems);
                  for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
                    let item = each_array_2[$$index_1];
                    $$renderer2.push(`<div class="v3-improve-item svelte-1bhv1ao"><span class="svelte-1bhv1ao">${escape_html(item.copy || item.label)}</span></div>`);
                  }
                  $$renderer2.push(`<!--]--></div>`);
                } else {
                  $$renderer2.push("<!--[-1-->");
                }
                $$renderer2.push(`<!--]-->`);
              }
              $$renderer2.push(`<!--]--> `);
              if (gainMore.length > 0) {
                $$renderer2.push("<!--[0-->");
                $$renderer2.push(`<button type="button" class="v3-improve-expander svelte-1bhv1ao"${attr("aria-expanded", gainPointsExpanded)}>${escape_html(`see ${gainMore.length} more way${gainMore.length === 1 ? "" : "s"} →`)}</button>`);
              } else {
                $$renderer2.push("<!--[-1-->");
              }
              $$renderer2.push(`<!--]-->`);
            } else if (coaching()?.nextSteps) {
              $$renderer2.push("<!--[1-->");
              $$renderer2.push(`<!--[-->`);
              const each_array_3 = ensure_array_like(coaching().nextSteps.slice(0, 3));
              for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
                let step = each_array_3[$$index_3];
                $$renderer2.push(`<div class="v3-improve-item svelte-1bhv1ao"><span class="svelte-1bhv1ao">${escape_html(step)}</span></div>`);
              }
              $$renderer2.push(`<!--]--> `);
              {
                $$renderer2.push("<!--[-1-->");
              }
              $$renderer2.push(`<!--]--> `);
              if (coaching().nextSteps.length > 3) {
                $$renderer2.push("<!--[0-->");
                $$renderer2.push(`<button type="button" class="v3-improve-expander svelte-1bhv1ao"${attr("aria-expanded", gainPointsExpanded)}>${escape_html(`see ${coaching().nextSteps.length - 3} more way${coaching().nextSteps.length - 3 === 1 ? "" : "s"} →`)}</button>`);
              } else {
                $$renderer2.push("<!--[-1-->");
              }
              $$renderer2.push(`<!--]-->`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (whyBullets().length > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="v3-why-bullets svelte-1bhv1ao"><!--[-->`);
            const each_array_5 = ensure_array_like(whyBullets());
            for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
              let b = each_array_5[$$index_5];
              $$renderer2.push(`<div class="v3-why-item svelte-1bhv1ao"><span${attr_class(`v3-why-dot v3-why-dot--${stringify(b.color)}`, "svelte-1bhv1ao")}></span> <span class="svelte-1bhv1ao">${escape_html(b.icon)} ${escape_html(b.text)}</span></div>`);
            }
            $$renderer2.push(`<!--]--></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <div${attr_class(`v3-terminal-cta v3-terminal--${stringify(_fitBand)}`, "svelte-1bhv1ao")}><div class="v3-terminal-title svelte-1bhv1ao">`);
          if (fitIQ() >= 65) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`Next step: Build your
										Business Case`);
          } else if (fitIQ() >= 50) {
            $$renderer2.push("<!--[1-->");
            $$renderer2.push(`Worth exploring — the
										numbers will tell you`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`We'd recommend trying another address
										too`);
          }
          $$renderer2.push(`<!--]--></div> <div class="v3-terminal-sub svelte-1bhv1ao">`);
          if (fitIQ() >= 65) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`We'll project revenue,
										costs, and break-even for this exact
										spot.`);
          } else if (fitIQ() >= 50) {
            $$renderer2.push("<!--[1-->");
            $$renderer2.push(`Build the business
										case to see if the financials make
										sense.`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`Compare before committing. Try
										another address or refine your vision.`);
          }
          $$renderer2.push(`<!--]--></div> <div class="v3-terminal-btns svelte-1bhv1ao">`);
          if (fitIQ() >= 50) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<a href="/app/business-plan" class="v3-terminal-btn-primary svelte-1bhv1ao">Build Business Case →</a>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <a href="/app/onboarding?fresh=true" class="v3-terminal-btn-ghost svelte-1bhv1ao">${escape_html(fitIQ() >= 50 ? "↺ Try another address" : "→ Try a different address")}</a></div></div>`);
        }
        $$renderer2.push(`<!--]--> `);
        {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <div class="v3-copilot-bar svelte-1bhv1ao"><span class="v3-copilot-sparkle svelte-1bhv1ao">✨</span> <input type="text" class="v3-copilot-input svelte-1bhv1ao" placeholder="Ask about this location — rent, traffic, competition, anything..."${attr("value", copilotInputText)}/> <button class="v3-copilot-send svelte-1bhv1ao"${attr("disabled", !copilotInputText?.trim(), true)}>Ask</button></div></div> <div class="v3-right svelte-1bhv1ao"><div class="v3-map-area svelte-1bhv1ao">`);
        LocationContextMap($$renderer2, { store: analysisStore, compact: true, showPin: true });
        $$renderer2.push(`<!----></div> <div class="v3-lenses svelte-1bhv1ao"><div class="v3-lens-pills svelte-1bhv1ao"><!--[-->`);
        const each_array_10 = ensure_array_like(LENS_TABS);
        for (let $$index_10 = 0, $$length = each_array_10.length; $$index_10 < $$length; $$index_10++) {
          let lens = each_array_10[$$index_10];
          $$renderer2.push(`<button type="button"${attr_class("v3-lens-pill svelte-1bhv1ao", void 0, { "active": activeLensKey === lens.key })}${attr("title", lens.sub)}>${escape_html(lens.label)}</button>`);
        }
        $$renderer2.push(`<!--]--></div> `);
        if (activeLensSlice()) {
          $$renderer2.push("<!--[0-->");
          const ls = activeLensSlice();
          const _lensConf = confidenceForLens()(ls.dimension);
          $$renderer2.push(`<div${attr_class(`v3-lens-card v3-lens-tier-${stringify(ls.tier.toLowerCase())}`, "svelte-1bhv1ao", {
            "v3-lens-partial": _lensConf === "partial",
            "v3-lens-skeleton": _lensConf === "skeleton"
          })}><div class="v3-lens-hdr svelte-1bhv1ao">`);
          if (_lensConf === "skeleton") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="v3-lens-score v3-metric-skeleton svelte-1bhv1ao" aria-busy="true"${attr("title", `Refreshing ${stringify(ls.label.toLowerCase())} data…`)}>—</span>`);
          } else if (_lensConf === "partial") {
            $$renderer2.push("<!--[1-->");
            $$renderer2.push(`<span class="v3-lens-score v3-metric-partial svelte-1bhv1ao" title="Preliminary — based on partial data, refreshing soon.">~${escape_html(ls.score)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<span class="v3-lens-score svelte-1bhv1ao">${escape_html(ls.score)}</span>`);
          }
          $$renderer2.push(`<!--]--> <span class="v3-lens-tier svelte-1bhv1ao">${escape_html(ls.tier)}</span></div> <div class="v3-lens-verdict svelte-1bhv1ao">${escape_html(ls.verdictLine)}</div> `);
          if (ls.topSignals && ls.topSignals.length > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<ul class="v3-lens-signals svelte-1bhv1ao"><!--[-->`);
            const each_array_11 = ensure_array_like(ls.topSignals);
            for (let $$index_11 = 0, $$length = each_array_11.length; $$index_11 < $$length; $$index_11++) {
              let sig = each_array_11[$$index_11];
              $$renderer2.push(`<li${attr_class(`v3-lens-sig v3-lens-sig-${stringify(sig.type)}`, "svelte-1bhv1ao")}><span class="v3-lens-sig-icon svelte-1bhv1ao">${escape_html(sig.type === "positive" ? "✓" : sig.type === "negative" ? "!" : "·")}</span> <span class="svelte-1bhv1ao">${escape_html(sig.message)}</span></li>`);
            }
            $$renderer2.push(`<!--]--></ul>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <div class="v3-lens-footer svelte-1bhv1ao"><span class="v3-lens-sources svelte-1bhv1ao">${escape_html(ls.dataSources.available)}/${escape_html(ls.dataSources.total)} sources live</span> <button type="button" class="v3-lens-cp svelte-1bhv1ao"${attr("disabled", inlineCpLoading, true)}>Ask CoPilot →</button></div></div>`);
        } else if (locationIqFetching) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`<div class="v3-lens-loading svelte-1bhv1ao"><div class="v3-lens-spinner svelte-1bhv1ao"></div> <span class="svelte-1bhv1ao">Pulling lens data…</span></div>`);
        } else if (locationIqError) {
          $$renderer2.push("<!--[2-->");
          $$renderer2.push(`<div class="v3-lens-empty svelte-1bhv1ao"><span class="svelte-1bhv1ao">Lens data unavailable.</span> <button type="button" class="v3-lens-retry svelte-1bhv1ao">Retry</button></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <div class="v3-hood-section svelte-1bhv1ao"><div class="v3-hood-title svelte-1bhv1ao">Neighborhood Snapshot</div>  `);
        if (confidenceTransit() !== "skeleton" && _transitScore > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="v3-hood-stat svelte-1bhv1ao"><span class="svelte-1bhv1ao">Transit Access</span> <span class="v3-hood-val svelte-1bhv1ao">`);
          if (confidenceTransit() === "partial") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="v3-metric-partial svelte-1bhv1ao" title="Preliminary — based on partial data, refreshing soon.">~${escape_html(_transitScore)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`${escape_html(_transitScore)}`);
          }
          $$renderer2.push(`<!--]--> <span${attr_class(`v3-hood-pill v3-hood-pill-${stringify(fitGrade(_transitScore).toLowerCase())}`, "svelte-1bhv1ao")}>${escape_html(tierLabelFor(_transitScore, "lens"))}</span></span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->  `);
        if (confidenceSafety() !== "skeleton" && _safetyScore > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="v3-hood-stat svelte-1bhv1ao"><span class="svelte-1bhv1ao">Safety</span> <span class="v3-hood-val svelte-1bhv1ao"${attr_style(_safetyScore < 55 ? "color:#d97706" : "")}>`);
          if (confidenceSafety() === "partial") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="v3-metric-partial svelte-1bhv1ao" title="Preliminary — based on partial data, refreshing soon.">~${escape_html(_safetyScore)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`${escape_html(_safetyScore)}`);
          }
          $$renderer2.push(`<!--]--> <span${attr_class(`v3-hood-pill v3-hood-pill-${stringify(fitGrade(_safetyScore).toLowerCase())}`, "svelte-1bhv1ao")}>${escape_html(tierLabelFor(_safetyScore, "lens"))}</span></span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (_survivalScore > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="v3-hood-stat svelte-1bhv1ao"><span class="svelte-1bhv1ao">Year-1 survival</span> <span class="v3-hood-val svelte-1bhv1ao">${escape_html(_survivalScore)}% <span class="v3-hood-sub svelte-1bhv1ao">NYC avg: 52%</span></span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (analysisStore.competitorScanStatus === "complete" && confidenceCompetition() !== "skeleton") {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="v3-hood-stat svelte-1bhv1ao"><span class="svelte-1bhv1ao">Competitors Nearby</span> <span class="v3-hood-val svelte-1bhv1ao">`);
          if (confidenceCompetition() === "partial") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="v3-metric-partial svelte-1bhv1ao" title="Preliminary — based on partial data, refreshing soon.">~${escape_html(analysisStore.competitors.length)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`${escape_html(analysisStore.competitors.length)}`);
          }
          $$renderer2.push(`<!--]--></span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <div class="v3-hood-stat svelte-1bhv1ao"${attr("title", conceptPulse()?.narrative ?? "")}><span class="svelte-1bhv1ao">Concept Pulse</span> <span class="v3-hood-val svelte-1bhv1ao">`);
        if (conceptPulse()) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`${escape_html(conceptPulse().score)} <span${attr_class(`v3-hood-pill v3-hood-pill-pulse v3-hood-pill-pulse-${stringify(conceptPulse().tier.toLowerCase())}`, "svelte-1bhv1ao")}>${escape_html(conceptPulse().tier)}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`—`);
        }
        $$renderer2.push(`<!--]--></span></div> `);
        if (locationNeighborhood) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="v3-hood-stat svelte-1bhv1ao"><span class="svelte-1bhv1ao">Neighborhood</span><span class="v3-hood-val svelte-1bhv1ao">${escape_html(locationNeighborhood)}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (locationNeighborhood) {
          $$renderer2.push("<!--[0-->");
          const _buzz = getNeighborhoodBuzz(locationNeighborhood);
          if (_buzz) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="v3-hood-buzz svelte-1bhv1ao"><div class="v3-hood-title svelte-1bhv1ao">Neighborhood Buzz</div> <div class="v3-hood-buzz-text svelte-1bhv1ao">${escape_html(locationNeighborhood)} is trending <strong class="svelte-1bhv1ao">${escape_html(trendArrow(_buzz.trend))}
											${escape_html(buzzLabel(_buzz.trend))}</strong> `);
            if (_buzz.note) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`— ${escape_html(_buzz.note)}`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></div></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]-->`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (locationIQ() > 0) {
        $$renderer2.push("<!--[0-->");
        PageNav($$renderer2, {
          backHref: "/app/onboarding",
          backLabel: "Edit Concept",
          nextHref: "/app/business-plan",
          nextLabel: "Business Case",
          nextIsGreen: true
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]-->  `);
    LocationStickyActionBar($$renderer2, {
      hasResult: hasResult(),
      fitIQ: fitIQ()
    });
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>  `);
    DuplicateAnalysisGuard($$renderer2, { store: analysisStore });
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
