import { j as ensure_array_like, e as escape_html } from "../../../../chunks/index2.js";
function _page($$renderer) {
  const entries = [
    {
      id: 1,
      tag: "Big Picture",
      date: "Mar 16 2026",
      title: "The Week Ahead — Three Threads Converging",
      analysis: "Neel's dinner (Wed) — pitch the tokenized loyalty play, not just the concept\n\nMorgan Stanley RFP — $2.4M but will eat bandwidth. Decide: all-in or protect launch prep time?\n\nNYC lease rates dropping — James hasn't heard from you in 2 weeks. Lock in the conversation.",
      metaPlay: "If Neel commits seed capital Wednesday and you lock a location by month end, your timeline accelerates 6 weeks. Worth more than the MS RFP. But only you know your risk tolerance."
    },
    {
      id: 2,
      tag: "Pattern",
      date: "Mar 15 2026",
      title: "Your Network is Your Unfair Advantage",
      analysis: "12 meaningful conversations past 30 days, 8 directly connect to your business or EY pipeline. That's not networking — that's operating.",
      metaPlay: null
    }
  ];
  $$renderer.push(`<div class="container svelte-15iwvh4"><header class="page-header svelte-15iwvh4"><h1 class="svelte-15iwvh4">🎙️ Commentary</h1> <p class="subtitle svelte-15iwvh4">Connecting dots across work, coffee concept, and personal network</p></header> <div class="entries-list svelte-15iwvh4"><!--[-->`);
  const each_array = ensure_array_like(entries);
  for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
    let entry = each_array[$$index_1];
    $$renderer.push(`<div class="entry-card svelte-15iwvh4"><div class="entry-meta svelte-15iwvh4"><span class="entry-tag svelte-15iwvh4">${escape_html(entry.tag)}</span> <span class="entry-date svelte-15iwvh4">${escape_html(entry.date)}</span></div> <h2 class="entry-title svelte-15iwvh4">${escape_html(entry.title)}</h2> <div class="analysis-block svelte-15iwvh4"><div class="analysis-label svelte-15iwvh4">JARED'S ANALYSIS</div> <div class="analysis-content svelte-15iwvh4"><!--[-->`);
    const each_array_1 = ensure_array_like(entry.analysis.split("\n\n"));
    for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
      let paragraph = each_array_1[$$index];
      $$renderer.push(`<p class="analysis-text svelte-15iwvh4">${escape_html(paragraph)}</p>`);
    }
    $$renderer.push(`<!--]--></div></div> `);
    if (entry.metaPlay) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<div class="meta-play-block svelte-15iwvh4"><div class="meta-play-label svelte-15iwvh4">META-PLAY</div> <p class="meta-play-text svelte-15iwvh4">${escape_html(entry.metaPlay)}</p></div>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--></div>`);
  }
  $$renderer.push(`<!--]--></div></div>`);
}
export {
  _page as default
};
