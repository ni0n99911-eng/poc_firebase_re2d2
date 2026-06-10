import { b as attr, c as attr_class, u as unsubscribe_stores, f as store_get, h as head, k as attr_style, i as stringify, e as escape_html, j as ensure_array_like, d as derived } from "../../chunks/index2.js";
import { p as page } from "../../chunks/stores.js";
import { o as onDestroy } from "../../chunks/index-server.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/root.js";
import "../../chunks/state.svelte.js";
import { loadLaunchPadData } from "../../chunks/launchpad-store.js";
import "clsx";
import "../../chunks/client.js";
/* empty css               */
function PWAInstallPrompt($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    {
      $$renderer2.push("<!--[0-->");
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function PWABottomNav($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let {
      locationIQHref = "/app/location",
      hasLocationIQ = false,
      hasVisitedFinancials = false
    } = $$props;
    function isActive(prefix) {
      return store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith(prefix);
    }
    $$renderer2.push(`<nav class="pwa-bottom-nav svelte-sp3dbc" role="navigation" aria-label="Main navigation"><a${attr("href", locationIQHref)}${attr_class("nav-item svelte-sp3dbc", void 0, {
      "active": isActive("/app/location") || isActive("/app/brain")
    })} aria-label="Score"><svg class="nav-icon svelte-sp3dbc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> <span class="nav-label svelte-sp3dbc">Location</span></a> `);
    if (hasLocationIQ) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a href="/app/business-plan"${attr_class("nav-item svelte-sp3dbc", void 0, {
        "active": isActive("/app/business-plan") || isActive("/app/model") || isActive("/app/scenarios")
      })} aria-label="Business Case"><svg class="nav-icon svelte-sp3dbc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><line x1="12" y1="12" x2="12" y2="16"></line><line x1="10" y1="14" x2="14" y2="14"></line></svg> <span class="nav-label svelte-sp3dbc">Business Case</span></a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="nav-item locked svelte-sp3dbc" aria-label="Business Case (locked)"><svg class="nav-icon svelte-sp3dbc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path></svg> <span class="nav-label svelte-sp3dbc">Business Case</span></span>`);
    }
    $$renderer2.push(`<!--]--> <a href="/app/onboarding?fresh=true" class="nav-item nav-fab svelte-sp3dbc" aria-label="New analysis"><span class="fab-circle svelte-sp3dbc"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></span> <span class="nav-label svelte-sp3dbc">New</span></a> `);
    if (hasVisitedFinancials) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a href="/app/dashboard"${attr_class("nav-item svelte-sp3dbc", void 0, { "active": isActive("/app/dashboard") })} aria-label="Dashboard"><svg class="nav-icon svelte-sp3dbc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg> <span class="nav-label svelte-sp3dbc">Dashboard</span></a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="nav-item locked svelte-sp3dbc" aria-label="Dashboard (locked)"><svg class="nav-icon svelte-sp3dbc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg> <span class="nav-label svelte-sp3dbc">Dashboard</span></span>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (hasVisitedFinancials) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a href="/app/checklist"${attr_class("nav-item svelte-sp3dbc", void 0, { "active": isActive("/app/checklist") })} aria-label="Checklist"><svg class="nav-icon svelte-sp3dbc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg> <span class="nav-label svelte-sp3dbc">Checklist</span></a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="nav-item locked svelte-sp3dbc" aria-label="Checklist (locked)"><svg class="nav-icon svelte-sp3dbc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg> <span class="nav-label svelte-sp3dbc">Checklist</span></span>`);
    }
    $$renderer2.push(`<!--]--> <button class="nav-item nav-menu-btn svelte-sp3dbc" aria-label="More options"><svg class="nav-icon svelte-sp3dbc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="1" fill="currentColor"></circle><circle cx="12" cy="12" r="1" fill="currentColor"></circle><circle cx="12" cy="19" r="1" fill="currentColor"></circle></svg> <span class="nav-label svelte-sp3dbc">More</span></button></nav>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { children, data } = $$props;
    const PUBLIC_SHELL_PATHS = [
      "/",
      "/login",
      "/pricing",
      "/about",
      "/methodology",
      "/contact",
      "/pending",
      "/sign-in",
      "/privacy",
      "/terms",
      "/demo"
    ];
    let isPublicPage = derived(() => PUBLIC_SHELL_PATHS.some((p) => store_get($$store_subs ??= {}, "$page", page).url.pathname === p));
    let isOnboarding = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/app/onboarding") || store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/app/welcome-back") || store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/app/route"));
    let isResults = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/app/") && !isOnboarding());
    let showMobileSidebar = false;
    let hasLocationIQ = false;
    let hasVisitedFinancials = false;
    let hasVisitedChecklist = false;
    let lastAnalyzedAddress = "";
    let locationIQHref = derived(() => (() => {
      const urlAddr = store_get($$store_subs ??= {}, "$page", page).url.searchParams.get("addr");
      const addr = urlAddr || lastAnalyzedAddress;
      return addr ? `/app/location?addr=${encodeURIComponent(addr)}` : "/app/location";
    })());
    let lpData = loadLaunchPadData();
    onDestroy(() => {
    });
    const allNavGroups = [
      {
        name: "YOUR VISION",
        phase: 1,
        module: "location-einstein",
        color: "var(--accent, #4a7c5c)",
        items: [
          {
            label: "Profile",
            href: "/app/vision/founder",
            icon: "",
            private: true
          },
          {
            label: "Concept & Goals",
            href: "/app/vision/concept",
            icon: "",
            private: true
          }
        ]
      },
      {
        name: "REALITY CHECK",
        phase: 2,
        module: "location-einstein",
        color: "var(--danger, #FF3B30)",
        items: [
          {
            label: "Score",
            href: "/app/location",
            icon: "",
            private: true
          },
          {
            label: "Recommendations",
            href: "/app/recommendations",
            icon: "",
            private: true
          },
          {
            label: "Space IQ",
            href: "/app/space",
            icon: "",
            private: true
          }
        ]
      },
      {
        name: "PATH FORWARD",
        phase: 3,
        module: "location-einstein",
        color: "var(--warning, #FF9500)",
        items: [
          {
            label: "Business Case",
            href: "/app/business-plan",
            icon: "",
            private: true
          }
        ]
      },
      {
        name: "LAUNCH",
        phase: 4,
        module: "location-einstein",
        color: "#1B3A5C",
        items: [
          {
            label: "Launch Checklist",
            href: "/app/checklist",
            icon: "",
            private: true
          }
        ]
      },
      {
        name: "LOAN READINESS",
        phase: 5,
        module: "location-einstein",
        color: "#5856D6",
        items: [
          {
            label: "Loan Package",
            href: "/app/loans",
            icon: "",
            private: true
          }
        ]
      },
      {
        name: "OPERATIONS",
        phase: 5,
        module: "location-einstein",
        color: "var(--success, #10B981)",
        items: [
          {
            label: "Post Go-Live SOP",
            href: "/app/operations",
            icon: "",
            private: true
          }
        ]
      }
    ];
    let userModules = derived(() => data.user?.modules || []);
    let isAppRoute = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/app"));
    let _pScore = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/app/location") || store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/app/brain"));
    let _pChk = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/app/checklist"));
    let journeyPct = derived(() => 0 + 0 + 0 + (_pChk() ? 25 : 0));
    let navGroups = derived(() => allNavGroups.filter((group) => {
      if (group.module === null) return true;
      if (!data.user && isAppRoute()) return true;
      return userModules().includes(group.module);
    }));
    function isActive(href) {
      if (href === "/") {
        return store_get($$store_subs ??= {}, "$page", page).url.pathname === "/";
      }
      return store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith(href);
    }
    function getGroupProgress(groupName) {
      const fp = lpData?.founderProfile;
      const fg = lpData?.financialGoals;
      const hasFounder = fp?.motivation && fp?.ownerType && fp?.riskTolerance && fp?.experience;
      const hasConcept = lpData?.businessType && lpData?.businessName;
      const hasFinancial = fg?.revenueY1 > 0 && fg?.squareFootage > 0;
      const hasSaved = lpData?.lastSaved > 0;
      switch (groupName) {
        case "YOUR VISION": {
          const done = [hasFounder, hasConcept && hasFinancial].filter(Boolean).length;
          return {
            completed: done,
            total: 2,
            status: done === 0 ? "none" : done === 2 ? "complete" : "partial"
          };
        }
        case "REALITY CHECK":
          return hasSaved && hasFounder ? { completed: 1, total: 2, status: "partial" } : { completed: 0, total: 2, status: "none" };
        case "PATH FORWARD":
          return hasSaved && hasFinancial ? { completed: 1, total: 3, status: "partial" } : { completed: 0, total: 3, status: "none" };
        default:
          return { completed: 0, total: 0, status: "none" };
      }
    }
    function getPageLabel() {
      const path = store_get($$store_subs ??= {}, "$page", page).url.pathname;
      const group = navGroups().find((g) => g.items.some((item) => item.href === path || path.startsWith(item.href) && item.href !== "/"));
      if (group) {
        const item = group.items.find((i) => i.href === path || path.startsWith(i.href) && i.href !== "/");
        if (item) {
          return item.label;
        }
      }
      return "";
    }
    head("12qhfyh", $$renderer2, ($$renderer3) => {
      $$renderer3.push(`<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&amp;display=swap" rel="stylesheet" class="svelte-12qhfyh"/>`);
    });
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (isOnboarding()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="onboarding-shell svelte-12qhfyh">`);
      children($$renderer2);
      $$renderer2.push(`<!----></div>`);
    } else if (isResults()) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="results-shell svelte-12qhfyh"><header class="results-topbar svelte-12qhfyh"><div class="topbar-left svelte-12qhfyh"><a href="/app/dashboard" class="results-logo svelte-12qhfyh">RE²</a></div> <div class="topbar-right svelte-12qhfyh"><a href="/app/onboarding?fresh=true" class="results-new-btn results-new-btn-icon svelte-12qhfyh" title="Start a new analysis" aria-label="Start a new analysis"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="svelte-12qhfyh"><line x1="12" y1="5" x2="12" y2="19" class="svelte-12qhfyh"></line><line x1="5" y1="12" x2="19" y2="12" class="svelte-12qhfyh"></line></svg> <span class="results-new-btn-label svelte-12qhfyh">New</span></a></div></header> <div class="module-strip svelte-12qhfyh"><nav class="module-nav svelte-12qhfyh"><a${attr("href", locationIQHref())}${attr_class("mod-btn svelte-12qhfyh", void 0, {
        "active": _pScore(),
        "done": hasLocationIQ,
        "current": _pScore()
      })}><span class="mod-num svelte-12qhfyh">`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`1`);
      }
      $$renderer2.push(`<!--]--></span> <span class="mod-label svelte-12qhfyh">Score</span> `);
      if (_pScore()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="mod-pulse svelte-12qhfyh" aria-hidden="true"></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></a> <span${attr_class("mod-arrow svelte-12qhfyh", void 0, { "done": hasLocationIQ })}>›</span> `);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="mod-btn locked svelte-12qhfyh"><span class="mod-num svelte-12qhfyh">2</span> <span class="mod-label svelte-12qhfyh">Business Case</span> <span class="mod-lock svelte-12qhfyh"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" class="svelte-12qhfyh"><rect x="3" y="11" width="18" height="11" rx="2" class="svelte-12qhfyh"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4" class="svelte-12qhfyh"></path></svg></span></span>`);
      }
      $$renderer2.push(`<!--]--> <span${attr_class("mod-arrow svelte-12qhfyh", void 0, { "done": hasVisitedFinancials })}>›</span> `);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="mod-btn locked svelte-12qhfyh"><span class="mod-num svelte-12qhfyh">3</span> <span class="mod-label svelte-12qhfyh">Dashboard</span> <span class="mod-lock svelte-12qhfyh"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" class="svelte-12qhfyh"><rect x="3" y="11" width="18" height="11" rx="2" class="svelte-12qhfyh"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4" class="svelte-12qhfyh"></path></svg></span></span>`);
      }
      $$renderer2.push(`<!--]--> <span${attr_class("mod-arrow svelte-12qhfyh", void 0, { "done": hasVisitedChecklist })}>›</span> `);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="mod-btn locked svelte-12qhfyh"><span class="mod-num svelte-12qhfyh">4</span> <span class="mod-label svelte-12qhfyh">Checklist</span> <span class="mod-lock svelte-12qhfyh"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" class="svelte-12qhfyh"><rect x="3" y="11" width="18" height="11" rx="2" class="svelte-12qhfyh"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4" class="svelte-12qhfyh"></path></svg></span></span>`);
      }
      $$renderer2.push(`<!--]--> <div class="mod-sep svelte-12qhfyh"></div></nav> `);
      if (journeyPct() > 0 && journeyPct() < 100) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="journey-bar svelte-12qhfyh"><div class="journey-fill svelte-12qhfyh"${attr_style(`width:${stringify(journeyPct())}%`)}></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <main class="results-content svelte-12qhfyh">`);
      children($$renderer2);
      $$renderer2.push(`<!----></main> `);
      PWABottomNav($$renderer2, {
        locationIQHref: locationIQHref(),
        hasLocationIQ,
        hasVisitedFinancials
      });
      $$renderer2.push(`<!----></div>`);
    } else if ((data.user || store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith("/app")) && !isPublicPage()) {
      $$renderer2.push("<!--[2-->");
      $$renderer2.push(`<div class="app-container svelte-12qhfyh"><header class="header svelte-12qhfyh"><div class="header-left svelte-12qhfyh"><button class="hamburger-menu show-mobile svelte-12qhfyh" title="Toggle sidebar" aria-label="Toggle sidebar menu"><span class="hamburger-line svelte-12qhfyh"></span> <span class="hamburger-line svelte-12qhfyh"></span> <span class="hamburger-line svelte-12qhfyh"></span></button> <button class="logo svelte-12qhfyh">RE²</button></div> <div class="header-center svelte-12qhfyh">`);
      if (getPageLabel()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="breadcrumb svelte-12qhfyh">${escape_html(getPageLabel())}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="header-right svelte-12qhfyh">`);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="avatar-container svelte-12qhfyh"><button class="avatar svelte-12qhfyh" title="User menu">${escape_html(data.user?.initials || "U")}</button> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></header> <div class="main-container svelte-12qhfyh">`);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <nav${attr_class("sidebar svelte-12qhfyh", void 0, { "mobile-open": showMobileSidebar })}><!--[-->`);
      const each_array_2 = ensure_array_like(navGroups());
      for (let groupIndex = 0, $$length = each_array_2.length; groupIndex < $$length; groupIndex++) {
        let group = each_array_2[groupIndex];
        $$renderer2.push(`<div class="nav-group svelte-12qhfyh"><div class="group-header svelte-12qhfyh"${attr_style(group.color ? `color: ${group.color}` : "")}>${escape_html(group.name)} `);
        if (getGroupProgress(group.name).total > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span${attr_class("progress-badge svelte-12qhfyh", void 0, {
            "complete": getGroupProgress(group.name).status === "complete",
            "partial": getGroupProgress(group.name).status === "partial"
          })}>`);
          if (getGroupProgress(group.name).status !== "none") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`*`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <div class="group-items svelte-12qhfyh"><!--[-->`);
        const each_array_3 = ensure_array_like(group.items.filter((item) => !item.requiredModule || userModules().includes(item.requiredModule)));
        for (let $$index_2 = 0, $$length2 = each_array_3.length; $$index_2 < $$length2; $$index_2++) {
          let item = each_array_3[$$index_2];
          $$renderer2.push(`<a${attr("href", item.href)}${attr_class("nav-item svelte-12qhfyh", void 0, { "active": isActive(item.href) })}${attr_style(isActive(item.href) && group.color ? `--group-color: ${group.color}` : "")}><span class="nav-label svelte-12qhfyh">${escape_html(item.label)}</span></a>`);
        }
        $$renderer2.push(`<!--]--></div></div> `);
        if (groupIndex < navGroups().length - 1) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="nav-divider svelte-12qhfyh"></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></nav> <main class="main-content svelte-12qhfyh">`);
      children($$renderer2);
      $$renderer2.push(`<!----></main></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="public-shell svelte-12qhfyh">`);
      children($$renderer2);
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    PWAInstallPrompt($$renderer2);
    $$renderer2.push(`<!---->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _layout as default
};
