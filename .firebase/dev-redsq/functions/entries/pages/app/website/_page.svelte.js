import { h as head, e as escape_html, j as ensure_array_like, k as attr_style, i as stringify, c as attr_class } from "../../../../chunks/index2.js";
import { loadLaunchPadData } from "../../../../chunks/launchpad-store.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let activeCategory = "espresso";
    let lpData = loadLaunchPadData();
    const categories = {
      espresso: {
        name: "Espresso Drinks",
        items: [
          { name: "Espresso", price: "$3.50" },
          { name: "Americano", price: "$4/$5" },
          { name: "Cortado", price: "$4.50" },
          { name: "Flat White", price: "$5/$6" },
          { name: "Latte", price: "$5.50/$6.50" },
          { name: "Cappuccino", price: "$5/$6" },
          { name: "Mocha", price: "$6/$7" },
          { name: "Vanilla Latte", price: "$6/$7" }
        ]
      },
      drip: {
        name: "Drip & Cold Brew",
        items: [
          { name: "Drip Coffee", price: "$2.75/$3.25" },
          { name: "Cold Brew", price: "$4.50/$5.50" },
          { name: "Cold Brew + Oat", price: "$5.25/$6.25" }
        ]
      },
      tea: {
        name: "Tea Selection",
        items: [
          { name: "Green Tea", price: "$3.50/$4.50" },
          { name: "Earl Grey", price: "$3.50/$4.50" },
          { name: "Chamomile", price: "$3.50/$4.50" },
          { name: "Matcha Latte", price: "$6/$7" },
          { name: "Chai Latte", price: "$5.50/$6.50" },
          { name: "London Fog", price: "$5.50/$6.50" }
        ]
      },
      functional: {
        name: "Premium Signature Drinks",
        items: [
          {
            name: "Hot Protein Latte",
            price: "$9/$11",
            pillar: "ENERGIZE",
            desc: "25g protein"
          },
          {
            name: "Iced Protein Latte",
            price: "$9/$11",
            pillar: "ENERGIZE",
            desc: "25g protein"
          },
          {
            name: "Iced Protein Matcha",
            price: "$9/$11",
            pillar: "ENERGIZE",
            desc: "25g protein"
          },
          {
            name: "Hot Chai Ginger Collagen",
            price: "$9/$11",
            pillar: "GLOW",
            desc: "10g collagen"
          },
          {
            name: "Iced Cherry Lime Mag Spritz",
            price: "$9/$11",
            pillar: "RESET",
            desc: "72 cal"
          }
        ]
      },
      food: {
        name: "Food & Grab-and-Go",
        items: [
          { name: "Overnight Oats", price: "$6.50" },
          { name: "Greek Yogurt Parfait", price: "$6.50" },
          { name: "Chia Pudding", price: "$6" },
          { name: "Hummus & Veggie Box", price: "$7.50" },
          { name: "Cheese & Fruit Box", price: "$7.50" },
          { name: "Turkey Wrap", price: "$8.50" },
          { name: "Avocado Bowl", price: "$9" },
          { name: "Fresh Fruit Cup", price: "$5" },
          { name: "Croissant", price: "$4/$4.50" },
          { name: "Bagel + Cream Cheese", price: "$4.50" },
          { name: "Egg Panini", price: "$7.50" },
          { name: "Turkey Panini", price: "$8.50" },
          { name: "Grilled Cheese", price: "$6.50" },
          { name: "Spinach Feta Wrap", price: "$7.50" },
          { name: "Cookie", price: "$4" },
          { name: "Muffin", price: "$4.50" },
          { name: "Brownie", price: "$4.50" },
          { name: "Energy Ball 3-pk", price: "$5" }
        ]
      }
    };
    const bundles = [
      {
        name: "Morning Commuter",
        price: "$10",
        desc: "coffee + breakfast",
        savings: "Save $2"
      },
      {
        name: "Starter Bundle",
        price: "$13",
        desc: "signature + grab&go",
        savings: "Save $2-3"
      },
      {
        name: "Protein Power",
        price: "$13.50",
        desc: "signature 12oz + protein bake",
        savings: "Save $2"
      },
      {
        name: "Lunch Break",
        price: "$12",
        desc: "panini/wrap + drink",
        savings: "Save $2-2.50"
      },
      {
        name: "After-School Kids",
        price: "$7.50",
        desc: "kids drink + food",
        savings: "Save $1.50-2"
      }
    ];
    const pillars = [
      {
        name: "ENERGIZE",
        emoji: "⚡",
        desc: "Energy & Focus",
        color: "#ff2d55"
      },
      {
        name: "GLOW",
        emoji: "✨",
        desc: "Self-Care & Vitality",
        color: "#ffd60a"
      },
      {
        name: "RESET",
        emoji: "🧘",
        desc: "Calm & Relaxation",
        color: "#00e8cc"
      }
    ];
    head("bve9lm", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Website Preview</title>`);
      });
    });
    $$renderer2.push(`<div class="website-container svelte-bve9lm"><section class="hero-section svelte-bve9lm"><div class="hero-content svelte-bve9lm"><h1 class="soma-logo svelte-bve9lm">${escape_html(lpData.businessName?.split(" ")[0] || "Your Brand")}</h1> <p class="hero-subtitle svelte-bve9lm">${escape_html(lpData.businessType || "Your Business")}</p> <p class="hero-tagline svelte-bve9lm">${escape_html(lpData.visionStatement?.split(".")[0] || "Your vision, your way")}</p> <p class="location svelte-bve9lm">📍 ${escape_html(lpData.idealArea || "New York, NY")}</p> <button class="cta-button svelte-bve9lm">Order Now</button></div></section> <section class="pillars-section svelte-bve9lm"><h2 class="section-title svelte-bve9lm">Our Philosophy</h2> <div class="pillars-grid svelte-bve9lm"><!--[-->`);
    const each_array = ensure_array_like(pillars);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let pillar = each_array[$$index];
      $$renderer2.push(`<div class="pillar-card svelte-bve9lm"${attr_style(`--pillar-color: ${stringify(pillar.color)}`)}><div class="pillar-emoji svelte-bve9lm">${escape_html(pillar.emoji)}</div> <h3 class="svelte-bve9lm">${escape_html(pillar.name)}</h3> <p class="svelte-bve9lm">${escape_html(pillar.desc)}</p></div>`);
    }
    $$renderer2.push(`<!--]--></div></section> <section class="menu-section svelte-bve9lm"><h2 class="section-title svelte-bve9lm">Our Menu</h2> <div class="menu-tabs svelte-bve9lm"><!--[-->`);
    const each_array_1 = ensure_array_like(Object.entries(categories));
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let [key, cat] = each_array_1[$$index_1];
      $$renderer2.push(`<button${attr_class("tab-button svelte-bve9lm", void 0, { "active": activeCategory === key })}>${escape_html(cat.name)}</button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="menu-grid svelte-bve9lm"><!--[-->`);
    const each_array_2 = ensure_array_like(categories[activeCategory].items);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let item = each_array_2[$$index_2];
      $$renderer2.push(`<div${attr_class("menu-item svelte-bve9lm", void 0, { "functional": item.pillar })}><div class="item-name svelte-bve9lm">${escape_html(item.name)}</div> <div class="item-price svelte-bve9lm">${escape_html(item.price)}</div> `);
      if (item.pillar) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="pillar-badge svelte-bve9lm"${attr_style(`--badge-color: ${stringify(pillars.find((p) => p.name === item.pillar)?.color || "#999")}`)}>${escape_html(item.pillar)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div></section> <section class="bundles-section svelte-bve9lm"><h2 class="section-title svelte-bve9lm">Bundles &amp; Combos</h2> <div class="bundles-grid svelte-bve9lm"><!--[-->`);
    const each_array_3 = ensure_array_like(bundles);
    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
      let bundle = each_array_3[$$index_3];
      $$renderer2.push(`<div class="bundle-card svelte-bve9lm"><h3 class="svelte-bve9lm">${escape_html(bundle.name)}</h3> <p class="bundle-price svelte-bve9lm">${escape_html(bundle.price)}</p> <p class="bundle-desc svelte-bve9lm">${escape_html(bundle.desc)}</p> <p class="bundle-savings svelte-bve9lm">${escape_html(bundle.savings)}</p></div>`);
    }
    $$renderer2.push(`<!--]--></div></section> <section class="about-section svelte-bve9lm"><h2 class="section-title svelte-bve9lm">Our Story</h2> <div class="about-grid svelte-bve9lm"><div class="about-text svelte-bve9lm"><p class="about-lead svelte-bve9lm">${escape_html(lpData?.businessName || "Your Brand")} was born from a simple question: why can't your daily coffee actually make you healthier?</p> <p class="svelte-bve9lm">We're a team of wellness enthusiasts, coffee obsessives, and community builders creating something new in your target market. Every drink at ${escape_html(lpData?.businessName?.split(" ")[0] || "Your Brand")} is built with purpose — real adaptogens, transparent nutrition, zero fillers.</p> <p class="svelte-bve9lm">Located in a prime neighborhood, we're designed to be the community's daily ritual — for the office worker grabbing a protein latte before work, the wellness enthusiast recovering after class, and the parent supporting their family's health.</p> <p class="svelte-bve9lm">Our three pillars — <span style="color: #ff2d55">ENERGIZE</span>, <span style="color: #bf5af2">GLOW</span>, and <span style="color: #00e8cc">RESET</span> — guide everything we create. Building a full lineup of purpose-driven beverages tailored to your market.</p></div> <div class="about-stats svelte-bve9lm"><div class="about-stat svelte-bve9lm"><div class="about-stat-value svelte-bve9lm">74</div> <div class="about-stat-label svelte-bve9lm">Menu Items</div></div> <div class="about-stat svelte-bve9lm"><div class="about-stat-value svelte-bve9lm">3</div> <div class="about-stat-label svelte-bve9lm">Wellness Pillars</div></div> <div class="about-stat svelte-bve9lm"><div class="about-stat-value svelte-bve9lm">5</div> <div class="about-stat-label svelte-bve9lm">Signature Drinks</div></div> <div class="about-stat svelte-bve9lm"><div class="about-stat-value svelte-bve9lm">1</div> <div class="about-stat-label svelte-bve9lm">Mission</div></div></div></div> <div class="about-values svelte-bve9lm"><div class="value-card svelte-bve9lm"><div class="value-icon svelte-bve9lm">🌱</div> <h4 class="svelte-bve9lm">Real Ingredients</h4> <p class="svelte-bve9lm">Every ingredient is transparent, functional, and purposeful. No artificial anything.</p></div> <div class="value-card svelte-bve9lm"><div class="value-icon svelte-bve9lm">🔬</div> <h4 class="svelte-bve9lm">Science-Backed</h4> <p class="svelte-bve9lm">Our formulations are built on adaptogenic science — ashwagandha, collagen, magnesium, and more.</p></div> <div class="value-card svelte-bve9lm"><div class="value-icon svelte-bve9lm">🏘️</div> <h4 class="svelte-bve9lm">Community First</h4> <p class="svelte-bve9lm">From our kids menu to our loyalty program, ${escape_html(lpData?.businessName?.split(" ")[0] || "Your Brand")} is built for the neighborhood.</p></div></div></section> <footer class="website-footer svelte-bve9lm"><div class="footer-content svelte-bve9lm"><h3 class="svelte-bve9lm">${escape_html(lpData?.businessName || "Your Brand")}</h3> <p class="svelte-bve9lm">Fuel your purpose • 600 Sixth Avenue, Manhattan, NY • yourwebsite.com</p></div></footer></div>`);
  });
}
export {
  _page as default
};
