import { h as head, b as attr, e as escape_html, j as ensure_array_like, d as derived, c as attr_class } from "../../../../chunks/index2.js";
import { P as PageNav } from "../../../../chunks/PageNav.js";
import { D as DisclaimerBanner } from "../../../../chunks/DisclaimerBanner.js";
import { a as authedFetch } from "../../../../chunks/authed-fetch.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let items = [];
    let loading = true;
    let error = "";
    let activeProperty = "all";
    let activeType = "all";
    let properties = [];
    let uploading = false;
    let filteredItems = derived(() => {
      let filtered = items;
      return filtered;
    });
    let groupedItems = derived(() => {
      const groups = {};
      for (const item of filteredItems()) {
        const key = item.property_addr || "General";
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      }
      return groups;
    });
    async function loadItems() {
      loading = true;
      error = "";
      try {
        const params = new URLSearchParams();
        if (activeProperty !== "all") ;
        if (activeType !== "all") ;
        const res = await authedFetch(`/api/vault?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          items = data.items || [];
        } else {
          const err = await res.json();
          error = err.error || "Failed to load vault";
        }
      } catch {
        error = "Failed to load vault";
      } finally {
        loading = false;
      }
    }
    function formatDate(iso) {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    function formatSize(bytes) {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    function typeIcon(type) {
      switch (type) {
        case "note":
          return "📝";
        case "file":
          return "📎";
        case "contact":
          return "👤";
        case "milestone":
          return "🏁";
        case "link":
          return "🔗";
        default:
          return "📄";
      }
    }
    function fileIcon(mimeType) {
      if (mimeType.startsWith("image/")) return "🖼";
      if (mimeType === "application/pdf") return "📑";
      if (mimeType.includes("spreadsheet") || mimeType.includes("csv")) return "📊";
      if (mimeType.includes("document") || mimeType.includes("word")) return "📄";
      return "📎";
    }
    head("e5chqr", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Data Vault</title>`);
      });
    });
    $$renderer2.push(`<div class="page svelte-e5chqr">`);
    DisclaimerBanner($$renderer2);
    $$renderer2.push(`<!----> <div class="page-header svelte-e5chqr"><div class="header-row svelte-e5chqr"><div><h1 class="svelte-e5chqr">Data Vault</h1> <p class="subtitle svelte-e5chqr">Your property CRM — documents, notes, contacts, and milestones.</p></div> <div class="header-actions svelte-e5chqr"><button class="btn-upload svelte-e5chqr"${attr("disabled", uploading, true)}>${escape_html("📎 Upload File")}</button> <button class="btn-add svelte-e5chqr">${escape_html("+ Add Item")}</button> <input type="file" accept="image/*,.pdf,.doc,.docx,.xlsx,.csv,.txt" style="display:none"/></div></div> <div class="filter-bar svelte-e5chqr"><div class="filter-group svelte-e5chqr"><span class="filter-label svelte-e5chqr">Property</span> `);
    $$renderer2.select(
      { value: activeProperty, onchange: loadItems, class: "" },
      ($$renderer3) => {
        $$renderer3.option({ value: "all" }, ($$renderer4) => {
          $$renderer4.push(`All properties`);
        });
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`General`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(properties);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let prop = each_array[$$index];
          $$renderer3.option({ value: prop }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(prop.length > 40 ? prop.slice(0, 40) + "..." : prop)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-e5chqr"
    );
    $$renderer2.push(`</div> <div class="filter-group svelte-e5chqr"><span class="filter-label svelte-e5chqr">Type</span> `);
    $$renderer2.select(
      { value: activeType, onchange: loadItems, class: "" },
      ($$renderer3) => {
        $$renderer3.option({ value: "all" }, ($$renderer4) => {
          $$renderer4.push(`All types`);
        });
        $$renderer3.option({ value: "note" }, ($$renderer4) => {
          $$renderer4.push(`📝 Notes`);
        });
        $$renderer3.option({ value: "file" }, ($$renderer4) => {
          $$renderer4.push(`📎 Files`);
        });
        $$renderer3.option({ value: "contact" }, ($$renderer4) => {
          $$renderer4.push(`👤 Contacts`);
        });
        $$renderer3.option({ value: "milestone" }, ($$renderer4) => {
          $$renderer4.push(`🏁 Milestones`);
        });
        $$renderer3.option({ value: "link" }, ($$renderer4) => {
          $$renderer4.push(`🔗 Links`);
        });
      },
      "svelte-e5chqr"
    );
    $$renderer2.push(`</div> <div class="filter-count svelte-e5chqr">${escape_html(filteredItems().length)} item${escape_html(filteredItems().length !== 1 ? "s" : "")}</div></div></div> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="error-banner svelte-e5chqr"><span>✕</span> ${escape_html(error)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="vault-content svelte-e5chqr">`);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-state svelte-e5chqr"><div class="spinner svelte-e5chqr"></div> Loading vault...</div>`);
    } else if (filteredItems().length === 0) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="empty-state svelte-e5chqr"><div class="empty-icon svelte-e5chqr">🗄</div> <div class="empty-title svelte-e5chqr">Your vault is empty</div> <div class="empty-sub svelte-e5chqr">Add notes, upload documents, save contacts and milestones for your properties.</div> <button class="btn-add svelte-e5chqr">+ Add your first item</button></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_2 = ensure_array_like(Object.entries(groupedItems()));
      for (let $$index_4 = 0, $$length = each_array_2.length; $$index_4 < $$length; $$index_4++) {
        let [property, group] = each_array_2[$$index_4];
        $$renderer2.push(`<div class="property-group svelte-e5chqr">`);
        if (Object.keys(groupedItems()).length > 1) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="property-label svelte-e5chqr">${escape_html(property === "" ? "General" : property)}</div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <!--[-->`);
        const each_array_3 = ensure_array_like(group);
        for (let $$index_3 = 0, $$length2 = each_array_3.length; $$index_3 < $$length2; $$index_3++) {
          let item = each_array_3[$$index_3];
          $$renderer2.push(`<div${attr_class("vault-item svelte-e5chqr", void 0, { "pinned": item.pinned })}><div class="item-left svelte-e5chqr"><span class="item-icon">${escape_html(item.item_type === "file" ? fileIcon(item.file_type) : typeIcon(item.item_type))}</span></div> <div class="item-main svelte-e5chqr"><div class="item-title-row svelte-e5chqr"><span class="item-title svelte-e5chqr">${escape_html(item.title)}</span> `);
          if (item.pinned) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="pin-badge svelte-e5chqr">📌</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (item.item_type === "file" && item.file_size > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="item-size svelte-e5chqr">${escape_html(formatSize(item.file_size))}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div> `);
          if (item.body) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="item-body svelte-e5chqr">${escape_html(item.body.length > 150 ? item.body.slice(0, 150) + "..." : item.body)}</div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (item.item_type === "contact" && item.metadata) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="item-contact svelte-e5chqr">`);
            if (item.metadata.role) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<span class="contact-role svelte-e5chqr">${escape_html(item.metadata.role)}</span>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--> `);
            if (item.metadata.phone) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<span class="contact-detail svelte-e5chqr">📞 ${escape_html(item.metadata.phone)}</span>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--> `);
            if (item.metadata.email) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<span class="contact-detail svelte-e5chqr">✉ ${escape_html(item.metadata.email)}</span>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <div class="item-meta svelte-e5chqr"><span class="item-date svelte-e5chqr">${escape_html(formatDate(item.created_at))}</span> `);
          if (item.tags.length > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<!--[-->`);
            const each_array_4 = ensure_array_like(item.tags);
            for (let $$index_2 = 0, $$length3 = each_array_4.length; $$index_2 < $$length3; $$index_2++) {
              let tag = each_array_4[$$index_2];
              $$renderer2.push(`<span class="item-tag svelte-e5chqr">${escape_html(tag)}</span>`);
            }
            $$renderer2.push(`<!--]-->`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div></div> <div class="item-actions svelte-e5chqr"><button class="item-action svelte-e5chqr"${attr("title", item.pinned ? "Unpin" : "Pin")}>📌</button> <button class="item-action danger svelte-e5chqr" title="Delete">✕</button></div></div>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div> `);
    PageNav($$renderer2, { backHref: "/app/dashboard", backLabel: "Dashboard" });
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _page as default
};
