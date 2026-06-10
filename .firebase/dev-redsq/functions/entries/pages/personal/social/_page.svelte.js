import { j as ensure_array_like, k as attr_style, i as stringify, e as escape_html } from "../../../../chunks/index2.js";
function _page($$renderer) {
  let events = [
    {
      time: "Today 11:30 AM",
      dot_color: "#a855f7",
      title: "Coffee with Ravi S.",
      description: "discussed partnership for catering"
    },
    {
      time: "Yesterday 4:00 PM",
      dot_color: "#3b82f6",
      title: "LinkedIn message from Sarah K. at Deloitte",
      description: "interested in managed services"
    },
    {
      time: "Mar 14, 7:00 PM",
      dot_color: "#a855f7",
      title: "Dinner with Anika & Priya",
      description: "caught up, talked about coffee concept"
    },
    {
      time: "Mar 13, 2:00 PM",
      dot_color: "#ff9f43",
      title: "Met James L. (broker)",
      description: "toured 2nd Ave location"
    },
    {
      time: "Mar 12, 10:00 AM",
      dot_color: "#3b82f6",
      title: "Team standup with EY Advisory group",
      description: "pipeline review"
    }
  ];
  $$renderer.push(`<div class="container svelte-1yypg2l"><header class="page-header svelte-1yypg2l"><h1 class="svelte-1yypg2l">💬 Social Engagement</h1> <p class="svelte-1yypg2l">Connections, outreach, and relationship tracking</p></header> <div class="timeline svelte-1yypg2l"><!--[-->`);
  const each_array = ensure_array_like(events);
  for (let index = 0, $$length = each_array.length; index < $$length; index++) {
    let event = each_array[index];
    $$renderer.push(`<div class="timeline-item svelte-1yypg2l"><div class="timeline-dot svelte-1yypg2l"${attr_style(`background-color: ${stringify(event.dot_color)}`)}></div> <div class="timeline-content svelte-1yypg2l"><div class="timeline-time svelte-1yypg2l">${escape_html(event.time)}</div> <div class="timeline-title svelte-1yypg2l">${escape_html(event.title)}</div> <div class="timeline-description svelte-1yypg2l">${escape_html(event.description)}</div></div></div>`);
  }
  $$renderer.push(`<!--]--></div></div>`);
}
export {
  _page as default
};
