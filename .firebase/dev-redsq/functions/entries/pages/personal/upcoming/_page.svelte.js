import { j as ensure_array_like, e as escape_html, k as attr_style, i as stringify } from "../../../../chunks/index2.js";
function _page($$renderer) {
  let activities = [
    {
      date: "Tomorrow Tue Mar 17",
      time: "2:00 PM",
      badge: "Coffee",
      badge_color: "#ff9f43",
      title: "Coffee Tasting at Variety Coffee Roasters",
      description: "details about sampling origins"
    },
    {
      date: "Wed Mar 18",
      time: "7:00 PM",
      badge: "Personal",
      badge_color: "#a855f7",
      title: "Dinner with Neel — Rezdôra",
      description: "Neel wants to discuss angel investing"
    },
    {
      date: "Thu Mar 19",
      time: "9:00 AM",
      badge: "Work",
      badge_color: "#3b82f6",
      title: "EY Quarterly Review Prep",
      description: "prep deck, pull CRM numbers"
    }
  ];
  $$renderer.push(`<div class="container svelte-188e42s"><header class="page-header svelte-188e42s"><h1 class="svelte-188e42s">📅 Upcoming Activities</h1> <p class="svelte-188e42s">Your next few days at a glance</p></header> <div class="activities-list svelte-188e42s"><!--[-->`);
  const each_array = ensure_array_like(activities);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let activity = each_array[$$index];
    $$renderer.push(`<div class="activity-card svelte-188e42s"><div class="activity-header svelte-188e42s"><div class="activity-datetime svelte-188e42s"><div class="activity-date svelte-188e42s">${escape_html(activity.date)}</div> <div class="activity-time svelte-188e42s">· ${escape_html(activity.time)}</div></div> <div class="activity-badge svelte-188e42s"${attr_style(`background-color: ${stringify(activity.badge_color)}`)}>${escape_html(activity.badge)}</div></div> <div class="activity-title svelte-188e42s">${escape_html(activity.title)}</div> <div class="activity-description svelte-188e42s">${escape_html(activity.description)}</div></div>`);
  }
  $$renderer.push(`<!--]--></div></div>`);
}
export {
  _page as default
};
