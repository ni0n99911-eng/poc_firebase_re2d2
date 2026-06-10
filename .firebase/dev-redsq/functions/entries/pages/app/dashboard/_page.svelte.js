import { h as head, e as escape_html, b as attr, k as attr_style, c as attr_class, i as stringify, j as ensure_array_like, d as derived } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { N as NavigationDrawer } from "../../../../chunks/NavigationDrawer.js";
import { a as fitGrade, f as fitTierLabel, e as fitMeaningShort, g as getDecisionState } from "../../../../chunks/decision-engine.js";
import { g as getVerdict, c as computeKillFactors, a as getDashboardHeadline, b as getTodaysInsight } from "../../../../chunks/scoring-utils.svelte.js";
import { f as formatConcept } from "../../../../chunks/conceptNames.js";
import { a as authedFetch } from "../../../../chunks/authed-fetch.js";
import { C as CONCEPT_KPIS, c as computeSteadyStateRevenue, R as RAMP_FACTORS } from "../../../../chunks/conceptKPIs.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const CIRC_LG = 207.3;
    function ringOffset(score, circ) {
      return circ * (1 - Math.max(0, Math.min(100, score || 0)) / 100);
    }
    function fitRingColor(v) {
      if (v >= 75) return "#15803d";
      if (v >= 55) return "#d97706";
      if (v >= 40) return "#c06a2a";
      return "#dc2626";
    }
    function fitTierStyle(v) {
      if (v >= 75) return "background:#dcfce7;color:#15803d";
      if (v >= 65) return "background:#e8edf2;color:#374151";
      if (v >= 50) return "background:#fef3c7;color:#92400e";
      return "background:#fee2e2;color:#991b1b";
    }
    function verdictPillClass(v) {
      if (v >= 75) return "pill-green";
      if (v >= 65) return "pill-viable";
      if (v >= 50) return "pill-amber";
      return "pill-red";
    }
    function verdictEmoji(v) {
      if (v >= 65) return "✅";
      if (v >= 50) return "⚠️";
      return "❌";
    }
    function fitBenchmark(v) {
      return fitTierLabel(v);
    }
    function timeAgo(ts) {
      if (!ts) return "—";
      const t = typeof ts === "number" ? ts : isFinite(Number(ts)) ? Number(ts) : new Date(ts).getTime();
      if (!t || isNaN(t)) return "—";
      const diff = Date.now() - t;
      const mins = Math.floor(diff / 6e4);
      if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs === 1 ? "1h ago" : `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return days === 1 ? "Yesterday" : `${days} days ago`;
    }
    function shortAddr(addr) {
      return (addr || "").split(",")[0];
    }
    function fmtMoney(n) {
      if (n === null || n === void 0 || n === 0 && !n) return "—";
      const abs = Math.abs(n);
      let str;
      if (abs >= 1e6) str = `$${(abs / 1e6).toFixed(1)}M`;
      else if (abs >= 1e3) str = `$${Math.round(abs / 1e3)}K`;
      else str = `$${abs}`;
      return n < 0 ? `(${str})` : str;
    }
    function greeting() {
      const h = (/* @__PURE__ */ new Date()).getHours();
      if (h < 12) return "Good morning";
      if (h < 17) return "Good afternoon";
      return "Good evening";
    }
    const DOC_TAGS = [
      {
        key: "marketing",
        label: "Marketing",
        icon: "📄",
        style: "background:#dbeafe;color:#1d4ed8;border-color:#93c5fd"
      },
      {
        key: "legal",
        label: "Legal",
        icon: "📋",
        style: "background:#ede9fe;color:#6d28d9;border-color:#c4b5fd"
      },
      {
        key: "financial",
        label: "Financial",
        icon: "💰",
        style: "background:#dcfce7;color:#15803d;border-color:#86efac"
      },
      {
        key: "property",
        label: "Property",
        icon: "🏢",
        style: "background:#fef3c7;color:#92400e;border-color:#fcd34d"
      }
    ];
    function docTagStyle(tag) {
      return DOC_TAGS.find((t) => t.key === tag)?.style ?? "";
    }
    function docTagIcon(tag) {
      return DOC_TAGS.find((t) => t.key === tag)?.icon ?? "📄";
    }
    function docTagLabel(tag) {
      return DOC_TAGS.find((t) => t.key === tag)?.label ?? tag;
    }
    function uniqueDocTags(docs) {
      if (!docs?.length) return [];
      return [...new Set(docs.map((d) => d.tag))];
    }
    let allLocations = [];
    let checklistDone = 0;
    let filterMode = "all";
    let sortMode = "fit";
    function _lsUpdateLoc(addr, patch) {
      try {
        const lp = JSON.parse(localStorage.getItem("re2_launchpad") || "{}");
        const locs = lp.scoredLocations || [];
        const idx = locs.findIndex((l) => l.addr === addr);
        if (idx >= 0) {
          Object.assign(locs[idx], patch);
          lp.scoredLocations = locs;
          localStorage.setItem("re2_launchpad", JSON.stringify(lp));
        }
      } catch {
      }
    }
    const STATUS_LABELS = {
      watching: "Exploring",
      touring: "Touring",
      negotiating: "In Negotiation",
      signed: "Signed ✓",
      passed: "Not Pursuing",
      lost: "Lost"
    };
    const STATUS_ORDER = [
      "watching",
      "touring",
      "negotiating",
      "signed",
      "passed",
      "lost"
    ];
    function updateStatus(loc, status) {
      loc.dealStatus = status;
      _lsUpdateLoc(loc.addr, { dealStatus: status });
      allLocations = [...allLocations];
      authedFetch("/api/deals/update-location", {
        method: "PATCH",
        body: JSON.stringify({ addr: loc.addr, status })
      }).catch(() => {
      });
    }
    let filteredLocations = derived(() => {
      let locs = allLocations;
      const toEpoch = (ts) => typeof ts === "number" ? ts : isFinite(Number(ts)) ? Number(ts) : new Date(ts || 0).getTime();
      const sorters = {
        fit: (a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0),
        location: (a, b) => (b.score ?? 0) - (a.score ?? 0),
        date: (a, b) => toEpoch(b.scoredAt) - toEpoch(a.scoredAt),
        revenue: (a, b) => (b.businessCase?.revenueY1 ?? 0) - (a.businessCase?.revenueY1 ?? 0)
      };
      const sorted = [...locs].sort(sorters[sortMode]);
      return sorted.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    });
    let pinnedCount = derived(() => allLocations.filter((l) => l.pinned).length);
    let starredCount = derived(() => allLocations.filter((l) => l.starred).length);
    let showCompare = false;
    let _sessionConceptFallback = "";
    let conceptGroups = derived(() => {
      const groups = {};
      for (const loc of filteredLocations()) {
        const key = loc.conceptType || loc.bizType || loc.personaType || loc.personaKey || _sessionConceptFallback || "unknown";
        if (!groups[key]) groups[key] = [];
        groups[key].push(loc);
      }
      return Object.entries(groups).sort(([, a], [, b]) => {
        const bestA = Math.max(...a.map((l) => l.fitScore ?? 0));
        const bestB = Math.max(...b.map((l) => l.fitScore ?? 0));
        return bestB - bestA;
      });
    });
    let hasLocationIQ = derived(() => allLocations.length > 0);
    let hasBusinessCase = derived(() => allLocations.some((l) => l.businessCase && !l.businessCase?.isPartialSeed));
    let hasChecklistStarted = derived(() => checklistDone > 0);
    let progressStep = derived(() => {
      if (!hasLocationIQ()) return {
        current: 0,
        total: 3,
        label: "Get started",
        next: "Get your Score"
      };
      if (!hasBusinessCase()) return {
        current: 1,
        total: 3,
        label: "Location scored",
        next: "Build a Business Case"
      };
      if (!hasChecklistStarted()) return {
        current: 2,
        total: 3,
        label: "Business Case built",
        next: "Prepare for Launch"
      };
      return {
        current: 3,
        total: 3,
        label: "You're launch-ready",
        next: "You're launch-ready"
      };
    });
    let _primaryConcept = derived(() => {
      if (!allLocations.length) return "";
      const first = allLocations[0];
      return first?.conceptType || first?.bizType || first?.personaType || _sessionConceptFallback || "";
    });
    let summaryBestFit = derived(() => allLocations.reduce((m, l) => Math.max(m, l.fitScore ?? 0), 0));
    let summaryBestFitLoc = derived(() => allLocations.find((l) => (l.fitScore ?? 0) === summaryBestFit()) ?? null);
    let summaryConceptCount = derived(() => new Set(allLocations.map((l) => l.conceptType || l.bizType || "unknown")).size);
    let locationsWithCase = derived(() => allLocations.filter((l) => l.businessCase && !l.businessCase.isPartialSeed));
    let summaryBestRevLoc = derived(() => locationsWithCase().length > 0 ? locationsWithCase().reduce((best, l) => (l.businessCase?.revenueY1 ?? 0) > (best.businessCase?.revenueY1 ?? 0) ? l : best, locationsWithCase()[0]) : null);
    let summaryAvgBreakEven = derived(() => locationsWithCase().length > 0 ? Math.round(locationsWithCase().reduce((s, l) => s + (l.businessCase?.breakEvenMonths ?? 0), 0) / locationsWithCase().length) : 0);
    let roughRevenueY1 = derived(() => {
      if (!_primaryConcept()) return null;
      const kpi = CONCEPT_KPIS[_primaryConcept()];
      if (!kpi) return null;
      const steady = computeSteadyStateRevenue(_primaryConcept());
      const ramp = RAMP_FACTORS[kpi.revenueModel]?.[0] ?? 0.62;
      const y1 = Math.round(steady * ramp);
      return { low: Math.round(y1 * 0.8), high: Math.round(y1 * 1.2) };
    });
    let _bestLoc = derived(summaryBestFitLoc);
    let _bestSix = derived(() => _bestLoc()?.sixScores ?? {});
    let _bestFit = derived(() => _bestLoc()?.fitScore ?? 0);
    let _bestLoc$ = derived(() => _bestLoc()?.score ?? 0);
    let _bestVision = derived(() => _bestLoc()?.visionScore ?? 0);
    let _visionIsPrelim = derived(() => _bestVision() < 30 || !_bestLoc());
    let _hasBC = derived(() => !!(_bestLoc()?.businessCase?.revenueY1 > 0 && !_bestLoc()?.businessCase?.isPartialSeed));
    let _bestDecision = derived(() => _bestFit() > 0 && _bestLoc()?.conceptType ? getDecisionState(_bestFit(), _bestLoc$(), _bestVision(), _bestSix(), {}, _bestLoc()?.conceptType, _visionIsPrelim()) : null);
    let _hasKill = derived(() => _bestDecision()?.state === "do_not_pursue" || _bestDecision()?.state === "high_risk");
    let dashboardHeadline = derived(() => getDashboardHeadline({
      hasScore: allLocations.length > 0,
      visionIsPrelim: _visionIsPrelim(),
      hasBusinessCase: _hasBC(),
      hasKillFactor: _hasKill(),
      killFactorName: _hasKill() ? _bestDecision()?.reasons?.[0]?.split(" ").slice(0, 3).join(" ") : void 0,
      locationCount: allLocations.length,
      bestFitIQ: _bestFit(),
      bestLocationIQ: _bestLoc$(),
      breakEvenMonth: _bestLoc()?.businessCase?.breakEvenMonth ?? null
    }));
    let todaysInsight = derived(() => _bestFit() > 0 && _bestDecision() && _bestLoc()?.conceptType ? getTodaysInsight({
      decisionState: _bestDecision(),
      visionIsPrelim: _visionIsPrelim(),
      visionCompletionPct: _visionIsPrelim() ? 40 : 100,
      sixScores: _bestSix(),
      fitSubScores: _bestLoc()?.fitSubScores ?? {},
      concept: _bestLoc()?.conceptType ?? "default",
      locationIQ: _bestLoc$(),
      fitIQ: _bestFit()
    }) : null);
    head("jrx8tb", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Dashboard</title>`);
      });
    });
    NavigationDrawer($$renderer2, {});
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="dash-page svelte-jrx8tb"><div class="page-hdr svelte-jrx8tb"><div class="page-hdr-left"><div class="page-greeting svelte-jrx8tb">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`${escape_html(greeting())} —`);
    }
    $$renderer2.push(`<!--]--> `);
    if (allLocations.length > 0 && _primaryConcept()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`here's where your <em class="svelte-jrx8tb">${escape_html(formatConcept(_primaryConcept()))}</em> stands.`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`let's find your perfect location.`);
    }
    $$renderer2.push(`<!--]--></div> <div class="page-sub svelte-jrx8tb">`);
    if (allLocations.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`Step ${escape_html(progressStep().current)} of ${escape_html(progressStep().total)} complete — ${escape_html(progressStep().label)}. Next: ${escape_html(progressStep().next)}`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`${escape_html(progressStep().next)}`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    if (allLocations.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="page-hdr-actions svelte-jrx8tb"><a href="/app/onboarding?fresh=true" class="btn-primary svelte-jrx8tb">＋ New Analysis</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="summary-strip svelte-jrx8tb"><div class="sum-card highlight svelte-jrx8tb"><div class="sum-label svelte-jrx8tb">Best Score</div> `);
    if (summaryBestFit() > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sum-ring-row svelte-jrx8tb"><div class="sum-ring-wrap svelte-jrx8tb"><svg class="sum-ring svelte-jrx8tb" viewBox="0 0 80 80" width="56" height="56"><circle cx="40" cy="40" r="33" fill="none" stroke="#e5e7eb" stroke-width="5"></circle><circle cx="40" cy="40" r="33" fill="none"${attr("stroke", fitRingColor(summaryBestFit()))} stroke-width="5"${attr("stroke-dasharray", CIRC_LG)}${attr("stroke-dashoffset", ringOffset(summaryBestFit(), CIRC_LG))} stroke-linecap="round" transform="rotate(-90 40 40)"></circle><text x="40" y="40" text-anchor="middle" dominant-baseline="central" font-size="20" font-weight="900"${attr("fill", fitRingColor(summaryBestFit()))}>${escape_html(summaryBestFit())}</text></svg> <div class="sum-grade-badge svelte-jrx8tb">${escape_html(fitGrade(summaryBestFit()))}</div></div> <div class="sum-ring-info svelte-jrx8tb"><div class="sum-ring-tier svelte-jrx8tb"${attr_style(fitTierStyle(summaryBestFit()))}>Grade ${escape_html(fitGrade(summaryBestFit()))} · ${escape_html(fitTierLabel(summaryBestFit()))}</div> <div class="sum-sub svelte-jrx8tb">${escape_html(shortAddr(summaryBestFitLoc()?.addr ?? ""))}</div> <div class="sum-meaning svelte-jrx8tb">${escape_html(fitMeaningShort(summaryBestFit()))}</div></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="sum-val svelte-jrx8tb">—</div> <div class="sum-sub svelte-jrx8tb">Paste an address — we'll tell you if it's the right spot in under 30 seconds.</div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="sum-card svelte-jrx8tb"><div class="sum-label svelte-jrx8tb">Locations Scored</div> <div class="sum-val svelte-jrx8tb">${escape_html(allLocations.length)}</div> <div class="sum-sub svelte-jrx8tb">Across ${escape_html(summaryConceptCount())} concept${escape_html(summaryConceptCount() !== 1 ? "s" : "")}</div></div> <div${attr_class("sum-card svelte-jrx8tb", void 0, { "sum-card-locked": !summaryBestRevLoc() })}><div class="sum-label svelte-jrx8tb">Best Est. Revenue Y1</div> `);
    if (summaryBestRevLoc()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sum-val green svelte-jrx8tb">${escape_html(fmtMoney(summaryBestRevLoc().businessCase.revenueY1))}</div> <div class="sum-sub svelte-jrx8tb">From Business Case · ${escape_html(shortAddr(summaryBestRevLoc().addr))}</div>`);
    } else if (roughRevenueY1()) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="sum-val muted svelte-jrx8tb">~${escape_html(fmtMoney(roughRevenueY1().low))}–${escape_html(fmtMoney(roughRevenueY1().high))}</div> <div class="sum-sub svelte-jrx8tb">Estimated based on your concept. <a href="/app/business-plan" class="sum-refine-link svelte-jrx8tb">Refine in Business Case →</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="sum-unlock-teaser svelte-jrx8tb"><span class="sum-lock-icon svelte-jrx8tb">🔒</span> <span>Est. Revenue Y1 — complete your Business Case to unlock</span></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div${attr_class("sum-card svelte-jrx8tb", void 0, { "sum-card-next": !summaryAvgBreakEven() })}>`);
    if (summaryAvgBreakEven() > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sum-label svelte-jrx8tb">Avg Break-Even</div> <div class="sum-val gold svelte-jrx8tb">${escape_html(summaryAvgBreakEven())} mo</div> <div class="sum-sub svelte-jrx8tb">Across ${escape_html(locationsWithCase().length)} location${escape_html(locationsWithCase().length !== 1 ? "s" : "")} with financials</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="sum-label svelte-jrx8tb">Your Next Step</div> <a${attr("href", progressStep().current < 2 ? "/app/business-plan" : "/app/checklist")} class="sum-next-link svelte-jrx8tb">${escape_html(progressStep().next)} →</a>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    if (allLocations.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="brain-strip svelte-jrx8tb"><div class="brain-headline svelte-jrx8tb"><div class="brain-hl-text svelte-jrx8tb">`);
      if (summaryBestFitLoc()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`You scored ${escape_html(shortAddr(summaryBestFitLoc().addr))} — Your Score ${escape_html(summaryBestFit())}/100, ${escape_html(fitTierLabel(summaryBestFit()))}. `);
        if (!hasBusinessCase()) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`Now let's see if the numbers work.`);
        } else if (!hasChecklistStarted()) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`Numbers look good. Time to plan your launch.`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`You're building momentum.`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`${escape_html(dashboardHeadline().text)}`);
      }
      $$renderer2.push(`<!--]--></div> <div class="brain-stepper-inline svelte-jrx8tb"><span${attr_class("bsi-dot svelte-jrx8tb", void 0, { "done": hasLocationIQ() })}>${escape_html(hasLocationIQ() ? "✓" : "1")}</span> <span${attr_class("bsi-line svelte-jrx8tb", void 0, { "done": hasLocationIQ() })}></span> <span${attr_class("bsi-dot svelte-jrx8tb", void 0, { "done": hasBusinessCase() })}>${escape_html(hasBusinessCase() ? "✓" : "2")}</span> <span${attr_class("bsi-line svelte-jrx8tb", void 0, { "done": hasBusinessCase() })}></span> <span${attr_class("bsi-dot svelte-jrx8tb", void 0, { "done": hasChecklistStarted() })}>${escape_html(hasChecklistStarted() ? "✓" : "3")}</span></div> `);
      if (!hasBusinessCase()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<a href="/app/business-plan" class="brain-next-cta svelte-jrx8tb">Build your Business Case →</a>`);
      } else if (!hasChecklistStarted()) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<a href="/app/checklist" class="brain-next-cta svelte-jrx8tb">Prepare for Launch →</a>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      if (todaysInsight()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div${attr_class(`brain-insight brain-insight--${stringify(todaysInsight().color)}`, "svelte-jrx8tb")}><div class="brain-insight-eyebrow svelte-jrx8tb">Today's Insight</div> <div class="brain-insight-text svelte-jrx8tb">${escape_html(todaysInsight().text)}</div> `);
        if (todaysInsight().color === "red" || todaysInsight().color === "amber") {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="brain-insight-action svelte-jrx8tb">`);
          if (_bestSix().safety < 60 && _bestSix().safety > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`On your site visit, check: corner position, street lighting, nearby daytime anchors.`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`Review your analysis detail to see what to address first.`);
          }
          $$renderer2.push(`<!--]--></div> <a${attr("href", summaryBestFitLoc()?.addr ? `/app/location?addr=${encodeURIComponent(summaryBestFitLoc().addr)}` : "/app/location")} class="brain-insight-cta svelte-jrx8tb">See full analysis →</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="brain-insight brain-insight--neutral svelte-jrx8tb"><div class="brain-insight-eyebrow svelte-jrx8tb">Today's Insight</div> <div class="brain-insight-text svelte-jrx8tb">Score your first location to unlock personalized insights.</div> <a href="/app/onboarding" class="brain-insight-cta svelte-jrx8tb">Analyze a location →</a></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (allLocations.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a href="/app/checklist" class="checklist-cta svelte-jrx8tb"><div class="checklist-cta-icon svelte-jrx8tb">🚀</div> <div class="checklist-cta-body svelte-jrx8tb">`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="checklist-cta-title svelte-jrx8tb">Your first 3 steps are free and take under an hour</div> <div class="checklist-cta-sub svelte-jrx8tb">Start with Legal — Get an EIN, finalize budget, claim your Google profile</div>`);
      }
      $$renderer2.push(`<!--]--></div> <div class="checklist-cta-progress svelte-jrx8tb">`);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <span class="checklist-cta-arrow svelte-jrx8tb">→</span></div></a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="filter-bar svelte-jrx8tb"><div class="filter-tabs svelte-jrx8tb"><button${attr_class("filter-tab svelte-jrx8tb", void 0, { "active": filterMode === "all" })} type="button">All (${escape_html(allLocations.length)})</button> <button${attr_class("filter-tab svelte-jrx8tb", void 0, { "active": filterMode === "starred" })} type="button">⭐ Starred (${escape_html(starredCount())})</button> <button${attr_class("filter-tab svelte-jrx8tb", void 0, { "active": filterMode === "pinned" })} type="button">📌 Shortlisted (${escape_html(pinnedCount())})</button> `);
    if (pinnedCount() >= 2) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button${attr_class("filter-tab filter-tab-compare svelte-jrx8tb", void 0, { "active": showCompare })} type="button" title="Side-by-side comparison of your shortlisted locations">⊞ Compare${escape_html("")}</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="sort-group svelte-jrx8tb"><span class="sort-label svelte-jrx8tb">Sort by</span> <button${attr_class("sort-btn svelte-jrx8tb", void 0, { "active": sortMode === "fit" })} type="button">Score</button> <button${attr_class("sort-btn svelte-jrx8tb", void 0, { "active": sortMode === "date" })} type="button">Recent</button> <button${attr_class("sort-btn svelte-jrx8tb", void 0, { "active": sortMode === "revenue" })} type="button">Revenue</button></div></div> `);
    if (allLocations.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-shortlist svelte-jrx8tb" style="border-color:#4a7c5c;background:#f0faf4"><div class="empty-shortlist-icon svelte-jrx8tb">📍</div> <div class="empty-shortlist-title svelte-jrx8tb">No locations scored yet</div> <div class="empty-shortlist-text svelte-jrx8tb">Score your first location to see your dashboard come alive.</div> <a href="/app/onboarding?fresh=true" class="empty-shortlist-btn svelte-jrx8tb">Run your first analysis →</a></div>`);
    } else {
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
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array_9 = ensure_array_like(conceptGroups());
    for (let gi = 0, $$length = each_array_9.length; gi < $$length; gi++) {
      let [conceptKey, locations] = each_array_9[gi];
      $$renderer2.push(`<div${attr_class("section-hdr svelte-jrx8tb", void 0, { "section-hdr-first": gi === 0 })}><div class="section-badge svelte-jrx8tb"${attr_style(`background:${stringify(gi === 0 ? "#1e3a2a" : gi === 1 ? "#4a7c5c" : "#6b7280")}`)}>${escape_html(formatConcept(conceptKey))}</div> <div class="section-count svelte-jrx8tb">${escape_html(locations.length)} location${escape_html(locations.length !== 1 ? "s" : "")}</div> <div class="section-line svelte-jrx8tb"></div> `);
      if (locations.length < 3) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<a${attr("href", `/app/location?concept=${stringify(conceptKey)}`)} class="section-add svelte-jrx8tb">＋ Add location for this concept</a>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <!--[-->`);
      const each_array_10 = ensure_array_like(locations);
      for (let li = 0, $$length2 = each_array_10.length; li < $$length2; li++) {
        let loc = each_array_10[li];
        if (loc && typeof loc.addr === "string" && loc.addr.length > 0) {
          $$renderer2.push("<!--[0-->");
          const fit = loc.fitScore ?? 0;
          const liq = loc.score ?? 0;
          const vis = loc.visionScore ?? 0;
          const visPrelim = vis === 0;
          const decision = getDecisionState(fit, liq, vis, {}, {}, conceptKey || "specialty_coffee", visPrelim);
          const _locSix = loc.sixScores ?? {};
          const _verdict = fit > 0 ? getVerdict({ fitIQ: fit }, _locSix) : null;
          const _killFlags = fit > 0 ? computeKillFactors(_locSix) : [];
          const docs = loc.documents ?? [];
          const tags = uniqueDocTags(docs);
          const isStale = loc.scoredAt && Date.now() - Number(loc.scoredAt) > 7 * 24 * 3600 * 1e3;
          $$renderer2.push(`<div${attr_class("loc-card svelte-jrx8tb", void 0, { "top-pick": li === 0 && fit >= 70, "pinned-card": loc.pinned })}><div${attr_class("loc-card-hdr svelte-jrx8tb", void 0, {
            "starred-card-hdr": loc.starred,
            "pinned-card-hdr": loc.pinned
          })}><div${attr_class("loc-rank svelte-jrx8tb", void 0, { "gold-rank": li === 0 })}>#${escape_html(li + 1)}</div> <div class="loc-addr-block svelte-jrx8tb"><div class="loc-addr-line svelte-jrx8tb">${escape_html(shortAddr(loc.addr))} `);
          if (loc.starred) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="starred-chip svelte-jrx8tb">⭐ Active</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (loc.pinned) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="shortlisted-chip svelte-jrx8tb">📌 Shortlisted</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div> <div class="loc-addr-sub svelte-jrx8tb">${escape_html(loc.addr.split(",").slice(1, 3).join(",").trim() || loc.addr)}</div></div> `);
          if (fit > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div${attr_class(`loc-verdict-pill ${stringify(verdictPillClass(fit))}`, "svelte-jrx8tb")}>${escape_html(verdictEmoji(fit))} ${escape_html(decision.headline)}</div> <div class="loc-benchmark svelte-jrx8tb">${escape_html(fit)}/100 — ${escape_html(fitBenchmark(fit))}</div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<div class="loc-verdict-pill svelte-jrx8tb" style="background:#f1f5f9;color:#64748b;font-size:0.78rem;border:1px dashed #cbd5e1">Re-score needed</div> <div class="loc-benchmark svelte-jrx8tb" style="color:#94a3b8;font-size:0.72rem">Location IQ: ${escape_html(liq)}/100 — Fit not yet computed</div>`);
          }
          $$renderer2.push(`<!--]--> <div class="loc-doc-tags svelte-jrx8tb">`);
          if (tags.length > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<!--[-->`);
            const each_array_11 = ensure_array_like(tags);
            for (let $$index_9 = 0, $$length3 = each_array_11.length; $$index_9 < $$length3; $$index_9++) {
              let tag = each_array_11[$$index_9];
              $$renderer2.push(`<span class="doc-tag svelte-jrx8tb"${attr_style(docTagStyle(tag))}>${escape_html(docTagIcon(tag))} ${escape_html(docTagLabel(tag))}</span>`);
            }
            $$renderer2.push(`<!--]-->`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div> <div class="hdr-icon-btns svelte-jrx8tb">`);
          if (allLocations.length >= 2) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<button${attr_class("icon-btn star-btn svelte-jrx8tb", void 0, { "active": loc.starred })} type="button"${attr("title", loc.starred ? "Remove star" : "Star")}>${escape_html(loc.starred ? "⭐" : "☆")}</button> <button${attr_class("icon-btn pin-btn-icon svelte-jrx8tb", void 0, { "active": loc.pinned })} type="button"${attr("title", loc.pinned ? "Unpin" : "Shortlist")}>${escape_html(loc.pinned ? "📌" : "📍")}</button>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <button class="icon-btn remove-btn svelte-jrx8tb" type="button" title="Remove from list">×</button></div></div> <div class="loc-card-body svelte-jrx8tb"><div class="loc-hero-row svelte-jrx8tb"><div class="loc-score-single svelte-jrx8tb"><span class="loc-score-num svelte-jrx8tb"${attr_style(`color:${stringify(fitRingColor(fit))}`)}>${escape_html(fit > 0 ? fit : "—")}</span> <span class="loc-score-of svelte-jrx8tb">/100</span> `);
          if (liq > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="loc-sub-score svelte-jrx8tb">Loc ${escape_html(liq)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (vis > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="loc-sub-score svelte-jrx8tb">Concept ${escape_html(vis)}${escape_html(visPrelim ? "✦" : "")}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div> <div class="loc-hero-rec svelte-jrx8tb"><div class="loc-rec-text svelte-jrx8tb">`);
          if (_verdict) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`${escape_html(_verdict)}`);
          } else if (decision.summary) {
            $$renderer2.push("<!--[1-->");
            $$renderer2.push(`${escape_html(decision.summary)}`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`Complete your concept details to unlock the full analysis.`);
          }
          $$renderer2.push(`<!--]--></div> `);
          if (_killFlags.length > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="loc-flag-chips svelte-jrx8tb"><!--[-->`);
            const each_array_12 = ensure_array_like(_killFlags);
            for (let $$index_10 = 0, $$length3 = each_array_12.length; $$index_10 < $$length3; $$index_10++) {
              let kf = each_array_12[$$index_10];
              $$renderer2.push(`<details class="loc-flag-detail svelte-jrx8tb"><summary${attr_class(`loc-flag-chip ${stringify(kf.flag === "kill" ? "chip-kill" : "chip-watch")}`, "svelte-jrx8tb")}>${escape_html(kf.label)} (${escape_html(kf.value)}) — ${escape_html(kf.recommendation?.split(".")[0] || "review before committing")}</summary> <div class="loc-flag-expand svelte-jrx8tb">${escape_html(kf.recommendation || "Check this metric before committing to a lease.")} <a${attr("href", loc?.addr ? `/app/location?addr=${encodeURIComponent(loc.addr)}` : "/app/location")} class="flag-expand-link svelte-jrx8tb">See full analysis →</a></div></details>`);
            }
            $$renderer2.push(`<!--]--></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div></div> `);
          if (_killFlags.length > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="loc-kill-chips svelte-jrx8tb"><!--[-->`);
            const each_array_13 = ensure_array_like(_killFlags.slice(0, 3));
            for (let $$index_11 = 0, $$length3 = each_array_13.length; $$index_11 < $$length3; $$index_11++) {
              let kf = each_array_13[$$index_11];
              $$renderer2.push(`<span${attr_class(`loc-kill-chip ${stringify(kf.flag === "kill" ? "chip-kill" : "chip-watch")}`, "svelte-jrx8tb")}>${escape_html(kf.label)} <span class="chip-score svelte-jrx8tb">${escape_html(kf.value)}</span></span>`);
            }
            $$renderer2.push(`<!--]--> `);
            if (_killFlags.length > 3) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<span class="loc-kill-chip chip-watch svelte-jrx8tb">+${escape_html(_killFlags.length - 3)} more</span>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <div class="loc-action-row svelte-jrx8tb"><div class="loc-status-text svelte-jrx8tb">`);
          if (loc.businessCase && !loc.businessCase.isPartialSeed) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="loc-fin-summary svelte-jrx8tb">${escape_html(fmtMoney(loc.businessCase.revenueY1))} rev · ${escape_html(fmtMoney(loc.businessCase.profitY1))} profit · ${escape_html(loc.businessCase.breakEvenMonths ? `~${loc.businessCase.breakEvenMonths}mo break-even` : "")}</div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<div class="loc-scored-line svelte-jrx8tb">✓ Scored ${escape_html(timeAgo(loc.scoredAt))}</div> <div class="loc-next-line svelte-jrx8tb">`);
            if (vis === 0) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<strong>Next:</strong> Finish your concept profile to unlock the business case`);
            } else {
              $$renderer2.push("<!--[-1-->");
              $$renderer2.push(`<strong>Next:</strong> <a href="/app/business-plan" class="svelte-jrx8tb">See if the numbers work →</a>`);
            }
            $$renderer2.push(`<!--]--></div>`);
          }
          $$renderer2.push(`<!--]--> `);
          if (isStale) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="stale-badge svelte-jrx8tb">STALE</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div> <div class="loc-primary-cta svelte-jrx8tb">`);
          if (!loc.businessCase || loc.businessCase?.isPartialSeed) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<a href="/app/business-plan" class="loc-btn-primary svelte-jrx8tb">Build Business Case →</a>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<a${attr("href", `/app/location?addr=${stringify(encodeURIComponent(loc.addr))}`)} class="loc-btn-primary svelte-jrx8tb">See Full Analysis →</a>`);
          }
          $$renderer2.push(`<!--]--></div> <div class="loc-text-links svelte-jrx8tb"><a${attr("href", `/app/location?addr=${stringify(encodeURIComponent(loc.addr))}`)} class="svelte-jrx8tb">Analysis</a> <span class="loc-link-dot svelte-jrx8tb">·</span> <button type="button" class="svelte-jrx8tb">Export</button> <span class="loc-link-dot svelte-jrx8tb">·</span> <button type="button" class="svelte-jrx8tb">Docs`);
          if (docs.length > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`(${escape_html(docs.length)})`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></button></div></div> `);
          if (allLocations.length >= 2) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<details class="loc-details svelte-jrx8tb"><summary class="loc-details-toggle svelte-jrx8tb">Show details</summary> <div class="loc-details-body svelte-jrx8tb"><div class="loc-detail-row svelte-jrx8tb">`);
            $$renderer2.select(
              {
                class: "deal-status-inline",
                value: loc.dealStatus || "watching",
                onchange: (e) => updateStatus(loc, e.target.value)
              },
              ($$renderer3) => {
                $$renderer3.push(`<!--[-->`);
                const each_array_14 = ensure_array_like(STATUS_ORDER);
                for (let $$index_12 = 0, $$length3 = each_array_14.length; $$index_12 < $$length3; $$index_12++) {
                  let s = each_array_14[$$index_12];
                  $$renderer3.option({ value: s }, ($$renderer4) => {
                    $$renderer4.push(`${escape_html(STATUS_LABELS[s])}`);
                  });
                }
                $$renderer3.push(`<!--]-->`);
              },
              "svelte-jrx8tb"
            );
            $$renderer2.push(` <button${attr_class("icon-btn star-btn svelte-jrx8tb", void 0, { "active": loc.starred })} type="button">${escape_html(loc.starred ? "⭐" : "☆")}</button> <button${attr_class("icon-btn pin-btn-icon svelte-jrx8tb", void 0, { "active": loc.pinned })} type="button">${escape_html(loc.pinned ? "📌" : "📍")}</button></div> <textarea class="loc-note-input svelte-jrx8tb" rows="2" placeholder="Add a note about this location…">`);
            const $$body = escape_html(loc.dealNote || "");
            if ($$body) {
              $$renderer2.push(`${$$body}`);
            }
            $$renderer2.push(`</textarea> `);
            if (docs.length === 0) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<button class="doc-nudge-inline svelte-jrx8tb" type="button">Have a lease or floor plan? Upload for a deeper analysis.</button>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></div></details>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div>  `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
