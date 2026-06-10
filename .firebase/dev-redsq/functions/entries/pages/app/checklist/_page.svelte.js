import { k as attr_style, e as escape_html, j as ensure_array_like, c as attr_class, b as attr, i as stringify, d as derived, h as head } from "../../../../chunks/index2.js";
import { P as PageNav } from "../../../../chunks/PageNav.js";
import { N as NavigationDrawer } from "../../../../chunks/NavigationDrawer.js";
import { a as sanitizeHtml, s as sanitizeCopilotText } from "../../../../chunks/copilot-sanitize.js";
/* empty css                                                           */
import { h as html } from "../../../../chunks/html.js";
function CoPilotChat($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      title = "Location Co-Pilot",
      subtitle = "Ask anything about this location",
      initialMessages = [],
      suggestedPrompts = [],
      accentColor = "#4a7c5c"
    } = $$props;
    let messages = initialMessages;
    let userInput = "";
    let usedPrompts = /* @__PURE__ */ new Set();
    let isThinking = false;
    const isChipDisabled = (index) => usedPrompts.has(index);
    function renderMarkdown(text) {
      if (!text) return "";
      text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      text = text.replace(/(?<!<)\*([^*<>]+)\*(?!>)/g, "<em>$1</em>");
      text = text.replace(/\n/g, "<br>");
      return sanitizeHtml(text);
    }
    $$renderer2.push(`<div class="copilot-chat svelte-1ytr54q"${attr_style(`--copilot-accent: ${stringify(accentColor)}; --copilot-bg: #F5F5F7`)}><div class="copilot-header svelte-1ytr54q"><div class="header-content svelte-1ytr54q"><div class="icon-badge svelte-1ytr54q"${attr_style(`background-color: ${stringify(accentColor)}`)}><span class="icon svelte-1ytr54q">✨</span></div> <div class="header-text svelte-1ytr54q"><h3 class="header-title svelte-1ytr54q">${escape_html(title)}</h3> <p class="header-subtitle svelte-1ytr54q">${escape_html(subtitle)}</p></div></div></div> <div class="messages-area svelte-1ytr54q"><!--[-->`);
    const each_array = ensure_array_like(messages);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let message = each_array[$$index];
      $$renderer2.push(`<div${attr_class("message-wrapper svelte-1ytr54q", void 0, { "user": message.role === "user" })}>`);
      if (message.role === "bot") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="bot-avatar svelte-1ytr54q">RE²</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div${attr_class("message-bubble svelte-1ytr54q", void 0, {
        "bot": message.role === "bot",
        "user": message.role === "user"
      })}>${html(renderMarkdown(message.text))}</div></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (suggestedPrompts.length > 0 && messages.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="chips-container svelte-1ytr54q"><!--[-->`);
      const each_array_1 = ensure_array_like(suggestedPrompts);
      for (let index = 0, $$length = each_array_1.length; index < $$length; index++) {
        let prompt = each_array_1[index];
        $$renderer2.push(`<button${attr_class("chip svelte-1ytr54q", void 0, { "disabled": isChipDisabled(index) })}${attr("disabled", isChipDisabled(index), true)}>${escape_html(prompt)}</button>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="input-area svelte-1ytr54q"><input type="text" class="message-input svelte-1ytr54q" placeholder="Type your question..."${attr("value", userInput)}/> <button class="send-button svelte-1ytr54q"${attr("disabled", !userInput.trim() || isThinking, true)}>→</button></div></div>`);
  });
}
const PHASES = [
  { id: "entity", name: "Legal & Entity", icon: "⚖️", color: "#8E44AD", sort_order: 1, description: "Set up your business structure and professional team" },
  { id: "lease", name: "Lease & Real Estate", icon: "🏠", color: "#2E75B6", sort_order: 2, description: "Secure and negotiate your space" },
  { id: "design", name: "Design & Build-Out", icon: "🔨", color: "#E67E22", sort_order: 3, description: "Plan and construct your space" },
  { id: "permits", name: "Permits & Licenses", icon: "📋", color: "#27AE60", sort_order: 4, description: "Get legal permission to operate" },
  { id: "finance", name: "Financing & Insurance", icon: "💰", color: "#F39C12", sort_order: 5, description: "Fund your business and protect it" },
  { id: "ops", name: "Operations Setup", icon: "⚙️", color: "#3498DB", sort_order: 6, description: "Systems, staff, and suppliers" },
  { id: "marketing", name: "Marketing & Pre-Launch", icon: "📣", color: "#E74C3C", sort_order: 7, description: "Build awareness before you open" },
  { id: "opening", name: "Opening Week", icon: "🚀", color: "#1B3A5C", sort_order: 8, description: "Final checks and go-live" }
];
function ChecklistProgress($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { items, conceptLabel } = $$props;
    const doneCount = derived(() => items.filter((i) => i.done).length);
    const totalCount = derived(() => items.length);
    const pct = derived(() => totalCount() > 0 ? Math.round(doneCount() / totalCount() * 100) : 0);
    function dotState(phaseId) {
      const pi = items.filter((i) => i.phase === phaseId);
      if (pi.length === 0) return "";
      if (pi.every((i) => i.done)) return "done";
      if (pi.some((i) => i.done)) return "active";
      return "";
    }
    const quickWinsCount = derived(() => items.filter((i) => !i.done && i.costHigh === 0 && i.weeks < 1).length);
    const heroMessage = derived(() => {
      if (pct() === 0) return "You're on your way to opening day.";
      if (pct() < 25) return "Great start! Keep the momentum.";
      if (pct() < 50) return "You're halfway there!";
      if (pct() < 75) return "Almost there. Great work.";
      if (pct() < 100) return "One last push. You've got this.";
      return "Launch day is here! 🎉";
    });
    $$renderer2.push(`<div class="progress-strip svelte-9s0ua4"><div class="progress-header svelte-9s0ua4"><div class="progress-left">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="progress-context-tag svelte-9s0ua4">${escape_html(conceptLabel)}${escape_html("")}</div>`);
    }
    $$renderer2.push(`<!--]--> <div class="progress-title svelte-9s0ua4">Your path to opening day</div> <div class="progress-subtitle svelte-9s0ua4">${escape_html(heroMessage())} `);
    if (doneCount() === 0 && quickWinsCount() > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`Start with the ${escape_html(quickWinsCount())} free ones.`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> <div class="progress-stats svelte-9s0ua4">`);
    if (doneCount() > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="stat-muted svelte-9s0ua4">✓ ${escape_html(doneCount())} done</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> <div class="progress-bar svelte-9s0ua4"><div${attr_class("progress-fill svelte-9s0ua4", void 0, {
      "milestone-25": pct() >= 25 && pct() < 50,
      "milestone-50": pct() >= 50 && pct() < 75,
      "milestone-75": pct() >= 75 && pct() < 100,
      "milestone-100": pct() === 100
    })}${attr_style(`width: ${stringify(pct())}%`)}><span class="pct-label svelte-9s0ua4">${escape_html(pct())}%</span></div></div> <div class="phase-dots svelte-9s0ua4" aria-hidden="true"><!--[-->`);
    const each_array = ensure_array_like(PHASES);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let p = each_array[$$index];
      const state = dotState(p.id);
      $$renderer2.push(`<div class="phase-dot svelte-9s0ua4"><div${attr_class("dot svelte-9s0ua4", void 0, { "active": state === "active", "done": state === "done" })}></div> <span class="svelte-9s0ua4">${escape_html(p.name.split(" ")[0])}</span></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function ChecklistFilters($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { items, activeFilter } = $$props;
    const doneCount = derived(() => items.filter((i) => i.done).length);
    const todoCount = derived(() => items.length - doneCount());
    const totalCount = derived(() => items.length);
    const nowCount = derived(() => items.filter((i) => i.priority === "now").length);
    const soonCount = derived(() => items.filter((i) => i.priority === "soon").length);
    const laterCount = derived(() => items.filter((i) => i.priority === "later").length);
    const FILTERS = derived(() => [
      { id: "all", label: `All (${totalCount()})` },
      { id: "todo", label: `To Do (${todoCount()})` },
      { id: "done", label: `Done (${doneCount()})` },
      { id: "now", label: `Do Now (${nowCount()})` },
      { id: "soon", label: `Do Soon (${soonCount()})` },
      { id: "later", label: `Do Later (${laterCount()})` }
    ]);
    $$renderer2.push(`<div class="filters svelte-1fnadoe" role="group" aria-label="Filter tasks"><!--[-->`);
    const each_array = ensure_array_like(FILTERS());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let f = each_array[$$index];
      $$renderer2.push(`<button${attr_class("filter-chip svelte-1fnadoe", void 0, { "active": activeFilter === f.id })}>${escape_html(f.label)}</button>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function ChecklistItem($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      item,
      highlight = false,
      blockedBy = ""
    } = $$props;
    let expanded = false;
    function fmtCost(low, high) {
      if (high === 0) return "Free";
      if (low === high) return `$${low.toLocaleString()}`;
      return `$${low.toLocaleString()}–$${high.toLocaleString()}`;
    }
    function fmtWeeks(w) {
      if (w < 1) return "< 1 week";
      if (w === 1) return "1 week";
      return `${w} weeks`;
    }
    function fmtProType(t) {
      return t.replace(/_/g, " ");
    }
    const priorityLabel = derived(() => item.priority === "now" ? "Do Now" : item.priority === "soon" ? "Do Soon" : "Later");
    const costStr = derived(() => fmtCost(item.costLow, item.costHigh));
    const weekStr = derived(() => fmtWeeks(item.weeks));
    $$renderer2.push(`<div${attr_class("task svelte-1htk9dg", void 0, {
      "done": item.done,
      "expanded": expanded,
      "highlight": highlight,
      "priority-now": item.priority === "now" && !item.done,
      "priority-soon": item.priority === "soon" && !item.done,
      "expensive": item.costHigh >= 1e4 && !item.done
    })}><button${attr_class("task-check svelte-1htk9dg", void 0, { "checked": item.done })} role="checkbox"${attr("aria-checked", item.done)}${attr("aria-label", item.done ? `Unmark: ${item.name}` : `Mark complete: ${item.name}`)}></button> <div class="task-body svelte-1htk9dg" role="button" tabindex="0"${attr("aria-expanded", expanded)}><div class="task-badge-row svelte-1htk9dg"><div${attr_class(`task-priority ${stringify(item.priority)}`, "svelte-1htk9dg")}>${escape_html(priorityLabel())}</div> <div class="task-meta-inline svelte-1htk9dg"><span class="svelte-1htk9dg">${escape_html(costStr())}</span><span class="svelte-1htk9dg">·</span><span class="svelte-1htk9dg">${escape_html(weekStr())}</span> `);
    if (item.proType) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="svelte-1htk9dg">·</span><span class="svelte-1htk9dg">${escape_html(fmtProType(item.proType))}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> <div class="task-name svelte-1htk9dg">${escape_html(item.name)}</div> `);
    if (blockedBy) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="task-blocked-bar svelte-1htk9dg"><span class="blocked-icon svelte-1htk9dg">⚠</span> Complete "${escape_html(blockedBy)}" first</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (item.desc) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div${attr_class("task-desc svelte-1htk9dg", void 0, { "truncated": !expanded })}>${escape_html(item.desc)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="task-right svelte-1htk9dg"></div></div>`);
  });
}
function ChecklistPhase($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      phase,
      items,
      // filtered items for this phase (respects active filter)
      allItems,
      // ALL items (for dependency resolution)
      doneCount,
      // done count from ALL items in this phase (unfiltered)
      totalCount,
      // total items in this phase (unfiltered)
      highlightId = "",
      defaultOpen = true
    } = $$props;
    function getBlockedBy(item) {
      if (!item.dependsOn?.length) return "";
      const blocking = item.dependsOn.find((depId) => {
        const dep2 = allItems.find((i) => i.id === depId);
        return dep2 && !dep2.done;
      });
      if (!blocking) return "";
      const dep = allItems.find((i) => i.id === blocking);
      return dep?.name ?? "";
    }
    let open = defaultOpen;
    const allDone = derived(() => doneCount === totalCount && totalCount > 0);
    const phasePct = derived(() => totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0);
    const celebrationLine = derived(() => {
      if (!allDone()) return "";
      const map = {
        "entity": "Legal is locked in. One less thing to worry about.",
        "lease": "Your space is secured. Time to build it out.",
        "design": "Build-out planned. Now make it real.",
        "permits": "All permits in hand. You're official.",
        "finance": "Funded and protected. Smart move.",
        "ops": "Operations ready. The machine is built.",
        "marketing": "The buzz is building. Almost there.",
        "opening": "Launch day is here! You did it. 🎉"
      };
      return map[phase.id] || "Phase complete!";
    });
    $$renderer2.push(`<section class="phase svelte-n4q3gi"${attr("aria-label", phase.name)}><button${attr_class("phase-header svelte-n4q3gi", void 0, { "all-done": allDone() })}${attr("aria-expanded", open)}${attr("aria-controls", `phase-body-${stringify(phase.id)}`)}><div class="phase-icon svelte-n4q3gi"${attr_style(`background: ${stringify(phase.color)}28; color: ${stringify(phase.color)}`)} aria-hidden="true">${escape_html(phase.icon)}</div> <div class="phase-info svelte-n4q3gi"><div class="phase-name svelte-n4q3gi">${escape_html(phase.name)}</div> `);
    if (phase.description) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="phase-desc svelte-n4q3gi">${escape_html(phase.description)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="phase-progress-col svelte-n4q3gi"><div class="phase-count svelte-n4q3gi"${attr("aria-label", `${stringify(doneCount)} of ${stringify(totalCount)} complete`)}>${escape_html(doneCount)}/${escape_html(totalCount)} `);
    if (allDone()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="phase-done-badge svelte-n4q3gi">✓</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="phase-mini-bar svelte-n4q3gi"><div class="phase-mini-fill svelte-n4q3gi"${attr_style(`width: ${stringify(phasePct())}%; background: ${stringify(phase.color)}`)}></div></div></div> <span${attr_class("phase-chevron svelte-n4q3gi", void 0, { "open": open })} aria-hidden="true">▾</span></button> `);
    if (allDone() && celebrationLine()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="phase-celebration svelte-n4q3gi"${attr_style(`color: ${stringify(phase.color)}`)}>${escape_html(celebrationLine())}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (open) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div${attr("id", `phase-body-${stringify(phase.id)}`)} class="task-list svelte-n4q3gi"><!--[-->`);
      const each_array = ensure_array_like(items);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let item = each_array[$$index];
        ChecklistItem($$renderer2, {
          item,
          highlight: item.id === highlightId,
          blockedBy: getBlockedBy(item)
        });
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></section>`);
  });
}
function ChecklistCostSummary($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { items } = $$props;
    const doneItems = derived(() => items.filter((i) => i.done));
    const todoItems = derived(() => items.filter((i) => !i.done));
    const spentLow = derived(() => doneItems().reduce((s, i) => s + i.costLow, 0));
    const spentHigh = derived(() => doneItems().reduce((s, i) => s + i.costHigh, 0));
    const remainLow = derived(() => todoItems().reduce((s, i) => s + i.costLow, 0));
    const remainHigh = derived(() => todoItems().reduce((s, i) => s + i.costHigh, 0));
    const totalLow = derived(() => items.reduce((s, i) => s + i.costLow, 0));
    const totalHigh = derived(() => items.reduce((s, i) => s + i.costHigh, 0));
    const remainWeeks = derived(() => todoItems().reduce((s, i) => s + i.weeks, 0));
    const remainMonths = derived(() => Math.ceil(remainWeeks() / 4.33));
    function fmtK(n) {
      if (n === 0) return "$0";
      if (n < 1e3) return `$${n}`;
      return `$${Math.round(n / 1e3)}K`;
    }
    function fmtMonths(m) {
      if (m <= 1) return "< 1 mo";
      return `~${m} mo`;
    }
    $$renderer2.push(`<div class="summary-sticky svelte-dt2s4i"><div class="summary-row svelte-dt2s4i"><div class="summary-item svelte-dt2s4i"><span class="summary-label svelte-dt2s4i">Spent</span> <span class="summary-val spent svelte-dt2s4i">${escape_html(fmtK(spentLow()))}–${escape_html(fmtK(spentHigh()))}</span></div> <div class="summary-divider svelte-dt2s4i"></div> <div class="summary-item svelte-dt2s4i"><span class="summary-label svelte-dt2s4i">Remaining</span> <span class="summary-val remaining svelte-dt2s4i">${escape_html(fmtK(remainLow()))}–${escape_html(fmtK(remainHigh()))}</span></div> <div class="summary-divider svelte-dt2s4i"></div> <div class="summary-item svelte-dt2s4i"><span class="summary-label svelte-dt2s4i">Total</span> <span class="summary-val svelte-dt2s4i">${escape_html(fmtK(totalLow()))}–${escape_html(fmtK(totalHigh()))}</span></div> <div class="summary-divider svelte-dt2s4i"></div> <div class="summary-item svelte-dt2s4i"><span class="summary-label svelte-dt2s4i">Timeline</span> <span class="summary-val svelte-dt2s4i">${escape_html(fmtMonths(remainMonths()))} left</span></div></div></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let items = [];
    let filter = "now";
    let conceptLabel = "Specialty Coffee";
    const filteredItems = derived(() => items.filter((i) => i.priority === filter));
    let highlightId = "";
    const nextItem = derived(() => {
      const nowItems = items.filter((i) => !i.done && i.priority === "now");
      return nowItems.length > 0 ? nowItems[0] : null;
    });
    const quickWins = derived(() => items.filter((i) => !i.done && i.costHigh === 0 && i.weeks < 1));
    const firstIncompletePhaseId = derived(() => {
      for (const p of PHASES) {
        const pi = items.filter((i) => i.phase === p.id);
        if (pi.length > 0 && !pi.every((i) => i.done)) return p.id;
      }
      return "";
    });
    const phaseGreetings = {
      entity: "I can help with entity formation, EINs, finding a lawyer, and what to watch out for in NYC commercial leases.",
      lease: "I know NYC zoning, rent benchmarks, BID zones, and what to look for on site visits. Ask me anything about finding your space.",
      design: "Buildout is where budgets get real. I can help with cost estimates, permit timelines, and TI allowances.",
      permits: "I know the permit timelines, costs, and gotchas for every NYC agency. Tell me your business type and I'll map out your critical path.",
      finance: "Financing and insurance can be confusing. I can walk you through what you actually need and how to budget.",
      ops: "Operations setup is about systems, staff, and suppliers. I can help you prioritize before opening.",
      marketing: "Pre-launch marketing is where excitement meets reality. I can help you plan a realistic strategy.",
      opening: "Almost there! I can help with final inspections, CRT filing, insurance, and everything before opening day."
    };
    const phasePromptMap = {
      entity: [
        "What kind of entity should I form?",
        "How much does a CRE lawyer cost?",
        "What is a personal guaranty?",
        "Do I need an EIN first?"
      ],
      lease: [
        "How do I know if the rent is fair?",
        "What is a good occupancy cost ratio?",
        "What should I check on a site visit?",
        "Is there a tax on commercial rent?"
      ],
      design: [
        "How much does buildout cost per SF?",
        "What is a TI allowance?",
        "Do I need an architect?",
        "How long does a DOB permit take?"
      ],
      permits: [
        "What permits do I need to open?",
        "How long for a health dept license?",
        "What is a Certificate of Occupancy?",
        "How do I get a liquor license?"
      ],
      finance: [
        "What insurance do I need?",
        "How do SBA loans work?",
        "What is my total occupancy cost?",
        "How much reserve should I keep?"
      ],
      ops: [
        "What systems do I need before opening?",
        "How do I find suppliers in NYC?",
        "What staff do I need on day one?",
        "How do I set up payroll?"
      ],
      marketing: [
        "How do I market before opening?",
        "Should I do a soft opening?",
        "How much for pre-launch marketing?",
        "What social strategy works locally?"
      ],
      opening: [
        "What final inspections do I need?",
        "Do I need to file for CRT?",
        "What is my first CRT deadline?",
        "What ongoing compliance to track?"
      ]
    };
    function getCurrentPhase() {
      return firstIncompletePhaseId() || "entity";
    }
    const copilotInitialMessages = derived(() => (() => {
      const phase = getCurrentPhase();
      const msgs = [];
      const greeting = phaseGreetings[phase] || phaseGreetings.entity;
      const bizLabel = conceptLabel;
      msgs.push({
        role: "bot",
        text: `I'm your launch guide for **${bizLabel}** in NYC. ${greeting}`
      });
      const doneCount = items.filter((i) => i.done).length;
      const totalCount = items.length;
      if (totalCount > 0 && doneCount > 0) {
        msgs.push({
          role: "bot",
          text: `You've completed **${doneCount} of ${totalCount}** tasks. Keep going!`
        });
      }
      return msgs;
    })());
    const copilotSuggestedPrompts = derived(() => (() => {
      const phase = getCurrentPhase();
      return (phasePromptMap[phase] || phasePromptMap.entity).slice(0, 4);
    })());
    head("152zyv7", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Launch Checklist — RE²</title>`);
      });
    });
    $$renderer2.push(`<div class="cl-page svelte-152zyv7">`);
    NavigationDrawer($$renderer2, {});
    $$renderer2.push(`<!----> `);
    if (items.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="cl-no-session svelte-152zyv7"><span>You haven't analyzed a location yet.</span> <a href="/app/location" class="cl-no-session-btn svelte-152zyv7">→ Analyze a location first</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (items.length > 0) {
      $$renderer2.push("<!--[0-->");
      ChecklistProgress($$renderer2, { items, conceptLabel });
      $$renderer2.push(`<!----> `);
      ChecklistCostSummary($$renderer2, { items });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    ChecklistFilters($$renderer2, { items, activeFilter: filter });
    $$renderer2.push(`<!----> `);
    if (nextItem() && items.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="cl-next-up svelte-152zyv7"><div class="next-up-label svelte-152zyv7">Next Up</div> <div class="next-up-card svelte-152zyv7"><div class="next-up-info svelte-152zyv7"><div class="next-up-title svelte-152zyv7">${escape_html(nextItem().name)}</div> <div class="next-up-meta svelte-152zyv7">`);
      if (nextItem().costLow === nextItem().costHigh && nextItem().costHigh === 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span>Free</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span>$${escape_html(nextItem().costLow.toLocaleString())}–$${escape_html(nextItem().costHigh.toLocaleString())}</span>`);
      }
      $$renderer2.push(`<!--]--> <span>·</span> <span>${escape_html(nextItem().weeks < 1 ? "< 1 week" : nextItem().weeks === 1 ? "1 week" : nextItem().weeks + " weeks")}</span></div></div> <button class="next-up-start svelte-152zyv7">I'm working on this →</button></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (quickWins().length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="cl-quick-wins svelte-152zyv7"><div class="qw-label svelte-152zyv7">⚡ Start here <span class="qw-count svelte-152zyv7">${escape_html(quickWins().length)} tasks, all free, all under 10 minutes</span></div> <div class="qw-chips svelte-152zyv7"><!--[-->`);
      const each_array = ensure_array_like(quickWins().slice(0, 5));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let qw = each_array[$$index];
        $$renderer2.push(`<button class="qw-chip svelte-152zyv7">${escape_html(qw.name)} →</button>`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="cl-layout svelte-152zyv7"><div class="cl-content svelte-152zyv7"><!--[-->`);
    const each_array_1 = ensure_array_like(PHASES);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let phase = each_array_1[$$index_1];
      const phaseVisible = filteredItems().filter((i) => i.phase === phase.id);
      const phaseDone = items.filter((i) => i.phase === phase.id && i.done).length;
      const phaseTotal = items.filter((i) => i.phase === phase.id).length;
      if (phaseVisible.length > 0) {
        $$renderer2.push("<!--[0-->");
        ChecklistPhase($$renderer2, {
          phase,
          items: phaseVisible,
          allItems: items,
          doneCount: phaseDone,
          totalCount: phaseTotal,
          highlightId,
          defaultOpen: phase.id === firstIncompletePhaseId() || phaseDone < phaseTotal && phaseDone > 0
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--> `);
    if (filteredItems().length === 0 && items.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="cl-empty svelte-152zyv7"><div class="cl-empty-icon svelte-152zyv7">✓</div> <div class="cl-empty-msg svelte-152zyv7">${escape_html("No tasks match this filter.")}</div> <button class="cl-empty-reset svelte-152zyv7">Show all tasks</button></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="cl-page-nav-wrap svelte-152zyv7">`);
    PageNav($$renderer2, {
      backHref: "/app/dashboard",
      backLabel: "Dashboard",
      nextHref: "/app/dashboard",
      nextLabel: "Dashboard"
    });
    $$renderer2.push(`<!----></div></div> <aside${attr_class("cl-copilot-wrap svelte-152zyv7", void 0, { "collapsed": false })}><button class="cl-copilot-toggle svelte-152zyv7"${attr("title", "Hide guide")}>`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="toggle-close svelte-152zyv7">✕</span>`);
    }
    $$renderer2.push(`<!--]--></button> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mentor-greeting svelte-152zyv7"><div class="mentor-avi svelte-152zyv7">RE²</div> <div class="mentor-body svelte-152zyv7"><div class="mentor-name svelte-152zyv7">RE²D2 Launch Guide</div> <div class="mentor-msg svelte-152zyv7"><!--[-->`);
      const each_array_2 = ensure_array_like(copilotInitialMessages());
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let m = each_array_2[$$index_2];
        $$renderer2.push(`<p class="svelte-152zyv7">${escape_html(sanitizeCopilotText(m.text))}</p>`);
      }
      $$renderer2.push(`<!--]--></div></div></div> `);
      CoPilotChat($$renderer2, {
        title: "",
        subtitle: "",
        initialMessages: [],
        suggestedPrompts: copilotSuggestedPrompts(),
        accentColor: "#1B3A5C"
      });
      $$renderer2.push(`<!---->`);
    }
    $$renderer2.push(`<!--]--></aside></div></div>`);
  });
}
export {
  _page as default
};
