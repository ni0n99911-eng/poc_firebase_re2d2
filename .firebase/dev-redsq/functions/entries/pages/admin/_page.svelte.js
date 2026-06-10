import { h as head, e as escape_html, c as attr_class, b as attr, j as ensure_array_like, k as attr_style, i as stringify } from "../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const AVAILABLE_MODULES = [
      "location-einstein",
      "space-einstein",
      "business-einstein",
      "loan-einstein",
      "launch-einstein",
      "operations-einstein"
    ];
    const MODULE_LABELS = {
      "location-einstein": "📍 Location IQ",
      "space-einstein": "🏢 Space IQ",
      "business-einstein": "📊 Business Case",
      "loan-einstein": "🏦 Loan IQ",
      "launch-einstein": "🚀 Launch Kit",
      "operations-einstein": "📋 Operations"
    };
    const TIER_PRESETS = {
      founder: { label: "🆓 Founder (Free)", modules: ["location-einstein"] },
      pro: {
        label: "⭐ Pro ($99/mo)",
        modules: [
          "location-einstein",
          "space-einstein",
          "business-einstein",
          "loan-einstein",
          "operations-einstein"
        ]
      },
      enterprise: {
        label: "🏆 Enterprise ($199/mo)",
        modules: [
          "location-einstein",
          "space-einstein",
          "business-einstein",
          "loan-einstein",
          "launch-einstein",
          "operations-einstein"
        ]
      }
    };
    let { data } = $$props;
    let users = data.users;
    let whitelist = data.whitelist;
    let waitlist = [];
    let loading = false;
    let activeTab = "users";
    let expandedUserId = null;
    let pendingModules = {};
    function getUserModules(userId) {
      const user = users.find((u) => u.id === userId);
      return pendingModules[userId] || user?.modules || [];
    }
    function userHasChanges(userId) {
      if (!pendingModules[userId]) return false;
      const user = users.find((u) => u.id === userId);
      if (!user) return false;
      const orig = [...user.modules].sort();
      const curr = [...pendingModules[userId]].sort();
      return JSON.stringify(orig) !== JSON.stringify(curr);
    }
    function formatDate(dateStr) {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    function getRoleColor(role) {
      switch (role) {
        case "owner":
          return "var(--accent)";
        case "member":
          return "var(--work)";
        case "viewer":
          return "var(--personal)";
        case "pending":
          return "var(--coffee)";
        default:
          return "var(--text-dim)";
      }
    }
    function getPendingUsers() {
      return users.filter((u) => u.role === "pending");
    }
    function getApprovedUsers() {
      return users.filter((u) => u.role !== "pending");
    }
    function getPendingApprovalsCount() {
      return users.filter((u) => u.role === "pending").length;
    }
    function getWhitelistCount() {
      return whitelist.length;
    }
    function getWaitlistCount() {
      return waitlist.length;
    }
    head("1jef3w8", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Admin</title>`);
      });
    });
    $$renderer2.push(`<div class="admin-page svelte-1jef3w8"><div class="page-header svelte-1jef3w8"><h1 class="svelte-1jef3w8">⚙️ Admin Console</h1> <p class="page-sub svelte-1jef3w8">Manage user access and permissions</p></div> <div class="stats-section svelte-1jef3w8"><div class="stats-header svelte-1jef3w8"><h2 class="svelte-1jef3w8">📊 Visitor Stats</h2> <p class="stats-note svelte-1jef3w8">Connect Google Analytics or Plausible for real visitor stats</p></div> <div class="stats-grid svelte-1jef3w8"><div class="stat-card svelte-1jef3w8"><div class="stat-label svelte-1jef3w8">Total Registered Users</div> <div class="stat-value svelte-1jef3w8">${escape_html(users.length)}</div> <div class="stat-detail svelte-1jef3w8">All time</div></div> <div class="stat-card svelte-1jef3w8"><div class="stat-label svelte-1jef3w8">Active Users (7 days)</div> <div class="stat-value svelte-1jef3w8">3</div> <div class="stat-detail svelte-1jef3w8">Simulated</div></div> <div class="stat-card svelte-1jef3w8"><div class="stat-label svelte-1jef3w8">Page Views Today</div> <div class="stat-value svelte-1jef3w8">47</div> <div class="stat-detail svelte-1jef3w8">Simulated</div></div> <div class="stat-card svelte-1jef3w8"><div class="stat-label svelte-1jef3w8">Most Visited Page</div> <div class="stat-value-text svelte-1jef3w8">Location IQ</div> <div class="stat-detail svelte-1jef3w8">Simulated</div></div> <div class="stat-card svelte-1jef3w8"><div class="stat-label svelte-1jef3w8">Pending Approvals</div> <div class="stat-value svelte-1jef3w8">${escape_html(getPendingApprovalsCount())}</div> <div class="stat-detail svelte-1jef3w8">Awaiting review</div></div> <div class="stat-card svelte-1jef3w8"><div class="stat-label svelte-1jef3w8">Whitelisted Emails</div> <div class="stat-value svelte-1jef3w8">${escape_html(getWhitelistCount())}</div> <div class="stat-detail svelte-1jef3w8">Pre-approved</div></div></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="tabs svelte-1jef3w8"><button${attr_class("tab svelte-1jef3w8", void 0, { "active": activeTab === "users" })}${attr("disabled", loading, true)}>Users (${escape_html(users.length)})</button> <button${attr_class("tab svelte-1jef3w8", void 0, { "active": activeTab === "whitelist" })}${attr("disabled", loading, true)}>Whitelist (${escape_html(whitelist.length)})</button> <button${attr_class("tab svelte-1jef3w8", void 0, { "active": activeTab === "waitlist" })}${attr("disabled", loading, true)}>Waitlist (${escape_html(getWaitlistCount())})</button></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="tab-content svelte-1jef3w8">`);
      if (getPendingUsers().length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="section svelte-1jef3w8"><div class="section-header svelte-1jef3w8"><h2 class="svelte-1jef3w8">⏳ Pending Approval (${escape_html(getPendingUsers().length)})</h2></div> <div class="users-list svelte-1jef3w8"><!--[-->`);
        const each_array = ensure_array_like(getPendingUsers());
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let user = each_array[$$index];
          $$renderer2.push(`<div class="user-card pending svelte-1jef3w8"><div class="user-card-header svelte-1jef3w8"><div class="user-info svelte-1jef3w8"><div class="user-avatar svelte-1jef3w8" style="background: var(--coffee-dim); border-color: var(--coffee);">${escape_html(user.name.charAt(0).toUpperCase())}</div> <div class="user-details svelte-1jef3w8"><div class="user-name svelte-1jef3w8">${escape_html(user.name)}</div> <div class="user-email svelte-1jef3w8">${escape_html(user.email)}</div> <div class="user-joined svelte-1jef3w8">Joined ${escape_html(formatDate(user.created_at))}</div></div></div> <div class="user-actions svelte-1jef3w8"><button class="btn btn-accent svelte-1jef3w8"${attr("disabled", loading, true)}>Approve</button> <button class="btn btn-danger svelte-1jef3w8"${attr("disabled", loading, true)}>Deny</button></div></div></div>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (getApprovedUsers().length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="section svelte-1jef3w8"${attr_style(getPendingUsers().length > 0 ? "margin-top: 32px" : "")}><div class="section-header svelte-1jef3w8"><h2 class="svelte-1jef3w8">✓ Approved Users (${escape_html(getApprovedUsers().length)})</h2></div> <div class="users-list svelte-1jef3w8"><!--[-->`);
        const each_array_1 = ensure_array_like(getApprovedUsers());
        for (let $$index_4 = 0, $$length = each_array_1.length; $$index_4 < $$length; $$index_4++) {
          let user = each_array_1[$$index_4];
          $$renderer2.push(`<div${attr_class("user-card svelte-1jef3w8", void 0, { "expanded": expandedUserId === user.id })}><div class="user-card-header svelte-1jef3w8"><div class="user-info svelte-1jef3w8"><div class="user-avatar svelte-1jef3w8">${escape_html(user.name.charAt(0).toUpperCase())}</div> <div class="user-details svelte-1jef3w8"><div class="user-name svelte-1jef3w8">${escape_html(user.name)}</div> <div class="user-email svelte-1jef3w8">${escape_html(user.email)}</div> <div class="user-meta svelte-1jef3w8"><span class="role-badge svelte-1jef3w8"${attr_style(`color: ${stringify(getRoleColor(user.role))}`)}>${escape_html(user.role.toUpperCase())}</span> <span class="joined-text svelte-1jef3w8">Joined ${escape_html(formatDate(user.created_at))}</span></div></div></div> <div class="user-modules-compact svelte-1jef3w8"><!--[-->`);
          const each_array_2 = ensure_array_like(user.modules);
          for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
            let module = each_array_2[$$index_1];
            $$renderer2.push(`<span class="module-badge svelte-1jef3w8">${escape_html(MODULE_LABELS[module] || module)}</span>`);
          }
          $$renderer2.push(`<!--]--> `);
          if (user.modules.length === 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="module-badge empty svelte-1jef3w8">No access</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div> <div${attr_class("expand-icon svelte-1jef3w8", void 0, { "rotated": expandedUserId === user.id })}>▶</div></div> `);
          if (expandedUserId === user.id) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="user-card-expanded svelte-1jef3w8"><div class="expanded-section svelte-1jef3w8"><div class="module-header-row svelte-1jef3w8"><h4 class="svelte-1jef3w8">Module Access</h4> <div class="tier-quick-btns svelte-1jef3w8"><!--[-->`);
            const each_array_3 = ensure_array_like(Object.entries(TIER_PRESETS));
            for (let $$index_2 = 0, $$length2 = each_array_3.length; $$index_2 < $$length2; $$index_2++) {
              let [tier, preset] = each_array_3[$$index_2];
              $$renderer2.push(`<button class="btn btn-small tier-quick svelte-1jef3w8"${attr("disabled", loading, true)}>${escape_html(preset.label)}</button>`);
            }
            $$renderer2.push(`<!--]--></div></div> <div class="modules-grid svelte-1jef3w8"><!--[-->`);
            const each_array_4 = ensure_array_like(AVAILABLE_MODULES);
            for (let $$index_3 = 0, $$length2 = each_array_4.length; $$index_3 < $$length2; $$index_3++) {
              let module = each_array_4[$$index_3];
              $$renderer2.push(`<label class="module-toggle svelte-1jef3w8"><input type="checkbox"${attr("checked", getUserModules(user.id).includes(module), true)}${attr("disabled", loading, true)} class="svelte-1jef3w8"/> <span class="toggle-label svelte-1jef3w8">${escape_html(MODULE_LABELS[module])}</span></label>`);
            }
            $$renderer2.push(`<!--]--></div> `);
            if (userHasChanges(user.id)) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<button class="btn btn-accent save-modules-btn svelte-1jef3w8"${attr("disabled", loading, true)}>${escape_html("Save Changes")}</button>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></div> <div class="expanded-section svelte-1jef3w8"><h4 class="svelte-1jef3w8">User Actions</h4> <div class="action-buttons svelte-1jef3w8"><button class="btn btn-danger svelte-1jef3w8"${attr("disabled", loading, true)}>Remove User</button></div></div></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (users.length === 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="empty-state svelte-1jef3w8"><div class="empty-icon svelte-1jef3w8">👥</div> <div class="empty-text svelte-1jef3w8">No users yet</div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
