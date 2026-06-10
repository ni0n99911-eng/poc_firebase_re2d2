import { j as ensure_array_like, e as escape_html, k as attr_style, i as stringify } from "../../../../chunks/index2.js";
function _page($$renderer) {
  let metrics = [
    {
      emoji: "🫀",
      label: "Resting Heart Rate",
      value: 72,
      unit: "bpm",
      percent: 72,
      color: "#22c55e"
    },
    {
      emoji: "🚶",
      label: "Steps Today",
      value: 8241,
      unit: "",
      percent: 82,
      color: "#22c55e"
    },
    {
      emoji: "😴",
      label: "Sleep Last Night",
      value: 7.2,
      unit: "h",
      percent: 90,
      color: "#22c55e"
    },
    {
      emoji: "🏋️",
      label: "Workouts This Week",
      value: 4,
      unit: "",
      percent: 57,
      color: "#ff9f43"
    },
    {
      emoji: "💧",
      label: "Glasses of Water",
      value: 6,
      unit: "",
      percent: 75,
      color: "#3b82f6"
    },
    {
      emoji: "🧘",
      label: "Meditation Today",
      value: 15,
      unit: "m",
      percent: 100,
      color: "#a855f7"
    }
  ];
  $$renderer.push(`<div class="container svelte-131qhx4"><header class="page-header svelte-131qhx4"><h1 class="svelte-131qhx4">❤️ Health</h1> <p class="svelte-131qhx4">Vitals, activity, and wellness tracking</p></header> <div class="metrics-grid svelte-131qhx4"><!--[-->`);
  const each_array = ensure_array_like(metrics);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let metric = each_array[$$index];
    $$renderer.push(`<div class="metric-card svelte-131qhx4"><div class="metric-emoji svelte-131qhx4">${escape_html(metric.emoji)}</div> <div class="metric-value svelte-131qhx4">${escape_html(metric.value)}<span class="metric-unit svelte-131qhx4">${escape_html(metric.unit)}</span></div> <div class="metric-label svelte-131qhx4">${escape_html(metric.label)}</div> <div class="progress-bar svelte-131qhx4"><div class="progress-fill svelte-131qhx4"${attr_style(`width: ${stringify(metric.percent)}%; background-color: ${stringify(metric.color)}`)}></div></div></div>`);
  }
  $$renderer.push(`<!--]--></div></div>`);
}
export {
  _page as default
};
