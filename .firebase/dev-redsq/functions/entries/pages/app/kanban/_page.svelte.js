import { h as head, e as escape_html, j as ensure_array_like, k as attr_style, i as stringify, b as attr } from "../../../../chunks/index2.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let businessName = "Project";
    let columns = {
      backlog: [
        {
          id: "b1",
          title: "Finalize lease agreement at 600 6th Ave",
          priority: "high",
          labels: ["Legal"],
          notes: ""
        },
        {
          id: "b2",
          title: "Order espresso machine & equipment",
          priority: "medium",
          labels: ["Operations"],
          notes: ""
        },
        {
          id: "b3",
          title: "Design interior layout with architect",
          priority: "high",
          labels: ["Operations"],
          notes: ""
        },
        {
          id: "b4",
          title: "Set up POS system (Square/Toast)",
          priority: "medium",
          labels: ["Tech"],
          notes: ""
        },
        {
          id: "b5",
          title: "Create employee handbook",
          priority: "low",
          labels: ["Operations"],
          notes: ""
        },
        {
          id: "b6",
          title: "File for food service permit",
          priority: "high",
          labels: ["Legal"],
          notes: ""
        },
        {
          id: "b7",
          title: "Set up business insurance",
          priority: "medium",
          labels: ["Finance"],
          notes: ""
        }
      ],
      inProgress: [
        {
          id: "ip1",
          title: "Complete SBA 7(a) loan application",
          priority: "high",
          labels: ["Finance"],
          notes: ""
        },
        {
          id: "ip2",
          title: "Finalize menu pricing strategy",
          priority: "high",
          labels: ["Finance"],
          notes: ""
        },
        {
          id: "ip3",
          title: "Build business website",
          priority: "medium",
          labels: ["Tech"],
          notes: ""
        },
        {
          id: "ip4",
          title: "Develop mobile app prototype",
          priority: "medium",
          labels: ["Tech"],
          notes: ""
        }
      ],
      review: [
        {
          id: "r1",
          title: "Menu deck v0.1 (complete)",
          priority: "high",
          labels: ["Marketing"],
          notes: ""
        },
        {
          id: "r2",
          title: "Location analysis for Chelsea",
          priority: "high",
          labels: ["Operations"],
          notes: ""
        },
        {
          id: "r3",
          title: "Brand identity & logo design",
          priority: "medium",
          labels: ["Marketing"],
          notes: ""
        }
      ],
      done: [
        {
          id: "d1",
          title: "Business entity formation (LLC)",
          priority: "high",
          labels: ["Legal"],
          notes: ""
        },
        {
          id: "d2",
          title: "Secure Clerk & Supabase accounts",
          priority: "high",
          labels: ["Tech"],
          notes: ""
        },
        {
          id: "d3",
          title: "Build JAREDCLAW command center",
          priority: "medium",
          labels: ["Tech"],
          notes: ""
        },
        {
          id: "d4",
          title: "Complete 3-year financial projections",
          priority: "high",
          labels: ["Finance"],
          notes: ""
        }
      ]
    };
    const columnConfig = {
      backlog: { label: "Backlog", color: "var(--border)" },
      inProgress: { label: "In Progress", color: "#ff6b35" },
      review: { label: "Review", color: "#ffa500" },
      done: { label: "Done", color: "#00d9a3" }
    };
    const priorityColors = { high: "#ff4d4d", medium: "#ffa500", low: "#4d9fff" };
    const labelColors = {
      Finance: "#e74c3c",
      Legal: "#9b59b6",
      Operations: "#3498db",
      Marketing: "#e91e63",
      Tech: "#00bcd4"
    };
    function getPriorityColor(priority) {
      return priorityColors[priority] || "#999";
    }
    function getLabelColor(label) {
      return labelColors[label] || "#666";
    }
    head("1a5kgq0", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Project Board</title>`);
      });
    });
    $$renderer2.push(`<div class="kanban-container svelte-1a5kgq0"><header class="page-header svelte-1a5kgq0"><h1 class="svelte-1a5kgq0">📋 ${escape_html(businessName)} Project Board</h1> <p class="subtitle svelte-1a5kgq0">Track all launch tasks and milestones</p></header> <div class="template-bar svelte-1a5kgq0"><div class="template-left svelte-1a5kgq0"><input type="file" accept=".json,.csv" style="display: none;"/> <button class="template-btn upload-btn svelte-1a5kgq0">↑ Upload Template</button> <button class="template-btn download-btn svelte-1a5kgq0">↓ Download Template</button></div> <button class="template-btn clear-btn svelte-1a5kgq0">✕ Clear Board</button></div> <div class="kanban-board svelte-1a5kgq0"><!--[-->`);
    const each_array = ensure_array_like(Object.entries(columns));
    for (let $$index_2 = 0, $$length = each_array.length; $$index_2 < $$length; $$index_2++) {
      let [columnKey, tasks] = each_array[$$index_2];
      $$renderer2.push(`<div class="column svelte-1a5kgq0"><div class="column-header svelte-1a5kgq0"${attr_style(`--column-color: ${stringify(columnConfig[columnKey].color)}`)}><h2 class="svelte-1a5kgq0">${escape_html(columnConfig[columnKey].label)}</h2> <span class="card-count svelte-1a5kgq0">${escape_html(tasks.length)}</span></div> <div class="tasks-list svelte-1a5kgq0"><!--[-->`);
      const each_array_1 = ensure_array_like(tasks);
      for (let $$index_1 = 0, $$length2 = each_array_1.length; $$index_1 < $$length2; $$index_1++) {
        let task = each_array_1[$$index_1];
        $$renderer2.push(`<div class="card svelte-1a5kgq0" draggable="true" role="button" tabindex="0"><div class="card-header svelte-1a5kgq0"><div class="priority-indicator svelte-1a5kgq0"${attr_style(`background-color: ${stringify(getPriorityColor(task.priority))}`)}${attr("title", `${stringify(task.priority.charAt(0).toUpperCase() + task.priority.slice(1))} Priority`)}></div> <h3 class="svelte-1a5kgq0">${escape_html(task.title)}</h3></div> <div class="card-labels svelte-1a5kgq0"><!--[-->`);
        const each_array_2 = ensure_array_like(task.labels);
        for (let $$index = 0, $$length3 = each_array_2.length; $$index < $$length3; $$index++) {
          let label = each_array_2[$$index];
          $$renderer2.push(`<span class="label svelte-1a5kgq0"${attr_style(`background-color: ${stringify(getLabelColor(label))}; background-color: ${stringify(getLabelColor(label))}20`)}>${escape_html(label)}</span>`);
        }
        $$renderer2.push(`<!--]--></div> `);
        if (task.notes) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="card-notes svelte-1a5kgq0"><p class="svelte-1a5kgq0">${escape_html(task.notes.substring(0, 50))}${escape_html(task.notes.length > 50 ? "..." : "")}</p></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></div> <button class="add-task-btn svelte-1a5kgq0">+ Add Task</button></div>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
