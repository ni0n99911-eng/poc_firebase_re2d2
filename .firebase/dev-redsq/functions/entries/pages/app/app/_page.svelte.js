import { h as head, e as escape_html, j as ensure_array_like, c as attr_class } from "../../../../chunks/index2.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let activeTab = "menu";
    let brandName = "Your Brand";
    let tokenSymbol = "TOKEN";
    const features = [
      {
        name: "Browse Menu",
        icon: "☕",
        desc: "Browse your full menu"
      },
      { name: "Quick Order", icon: "📦", desc: "Bundles & combos" },
      { name: "Earn Rewards", icon: "⭐", desc: "Loyalty points" },
      { name: "Tokens", icon: "🪙", desc: "RWA governance" }
    ];
    const menuItems = [
      { name: "Espresso", price: "$3.50", category: "espresso" },
      { name: "Latte", price: "$5.50", category: "espresso" },
      { name: "Cold Brew", price: "$4.50", category: "drip" },
      { name: "Matcha Latte", price: "$6", category: "tea" },
      {
        name: "Signature Item",
        price: "$9",
        category: "functional",
        badge: "POPULAR"
      },
      { name: "Overnight Oats", price: "$6.50", category: "food" },
      {
        name: "Morning Bundle",
        price: "$10",
        category: "bundle",
        highlight: true
      }
    ];
    head("1w7ymk8", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — App Preview</title>`);
      });
    });
    $$renderer2.push(`<div class="container svelte-1w7ymk8"><header class="page-header svelte-1w7ymk8"><h1 class="svelte-1w7ymk8">📱 ${escape_html(brandName)} Mobile App</h1> <p class="subtitle svelte-1w7ymk8">Order, earn rewards, and govern with ${escape_html(tokenSymbol)} tokens</p></header> <section class="app-preview-section svelte-1w7ymk8"><div class="content-grid svelte-1w7ymk8"><div class="features-column svelte-1w7ymk8"><h2 class="svelte-1w7ymk8">App Features</h2> <div class="features-list svelte-1w7ymk8"><!--[-->`);
    const each_array = ensure_array_like(features);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let feature = each_array[$$index];
      $$renderer2.push(`<div class="feature-item svelte-1w7ymk8"><div class="feature-icon svelte-1w7ymk8">${escape_html(feature.icon)}</div> <div class="feature-text svelte-1w7ymk8"><h4 class="svelte-1w7ymk8">${escape_html(feature.name)}</h4> <p class="svelte-1w7ymk8">${escape_html(feature.desc)}</p></div></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="app-store-buttons svelte-1w7ymk8"><button class="store-btn app-store svelte-1w7ymk8"><span class="store-icon svelte-1w7ymk8">🍎</span> App Store</button> <button class="store-btn google-play svelte-1w7ymk8"><span class="store-icon svelte-1w7ymk8">🔵</span> Google Play</button></div></div> <div class="phone-column svelte-1w7ymk8"><div class="phone-frame svelte-1w7ymk8"><div class="phone-notch svelte-1w7ymk8"></div> <div class="phone-status-bar svelte-1w7ymk8"></div> <div class="phone-content svelte-1w7ymk8"><div class="phone-header svelte-1w7ymk8"><div class="header-title svelte-1w7ymk8"><span class="soma-text svelte-1w7ymk8">${escape_html(tokenSymbol)}</span> <span class="loyalty-badge svelte-1w7ymk8">✨ Gold</span></div> <p class="user-greeting svelte-1w7ymk8">Good morning!</p></div> <div class="tab-nav svelte-1w7ymk8"><button${attr_class("tab-nav-btn svelte-1w7ymk8", void 0, { "active": activeTab === "menu" })}>☕ Menu</button> <button${attr_class("tab-nav-btn svelte-1w7ymk8", void 0, { "active": activeTab === "bundles" })}>📦 Bundles</button> <button${attr_class("tab-nav-btn svelte-1w7ymk8", void 0, { "active": activeTab === "loyalty" })}>⭐ Rewards</button></div> <div class="phone-content-area svelte-1w7ymk8">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="menu-content svelte-1w7ymk8"><!--[-->`);
      const each_array_1 = ensure_array_like(menuItems);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let item = each_array_1[$$index_1];
        if (item.category !== "bundle") {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div${attr_class("phone-menu-item svelte-1w7ymk8", void 0, { "featured": item.highlight })}><div class="item-header svelte-1w7ymk8"><span class="item-name svelte-1w7ymk8">${escape_html(item.name)}</span> `);
          if (item.badge) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="item-badge svelte-1w7ymk8" style="--badge-color: #ff2d55">${escape_html(item.badge)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div> <span class="item-price svelte-1w7ymk8">${escape_html(item.price)}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="phone-cta svelte-1w7ymk8"><button class="cta-primary svelte-1w7ymk8">Order Now</button></div></div> <div class="phone-home-bar svelte-1w7ymk8"></div></div></div></div></section></div>`);
  });
}
export {
  _page as default
};
