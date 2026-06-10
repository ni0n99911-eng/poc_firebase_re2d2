import { h as head, e as escape_html, j as ensure_array_like, k as attr_style, i as stringify, b as attr } from "../../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
import { g as getScoreColor } from "../../../../../chunks/scoreUtils.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let compareCards = [];
    let scoreResults = /* @__PURE__ */ new Map();
    function createRadarPath(physical, visibility, economics, structure) {
      const normalize = (val) => Math.max(0, Math.min(100, val)) / 100;
      const cx = 80;
      const cy = 80;
      const radius = 60;
      const p = normalize(physical);
      const v = normalize(visibility);
      const e = normalize(economics);
      const s = normalize(structure);
      const x1 = cx + radius * p;
      const y1 = cy;
      const x2 = cx;
      const y2 = cy - radius * v;
      const x3 = cx - radius * e;
      const y3 = cy;
      const x4 = cx;
      const y4 = cy + radius * s;
      return `${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`;
    }
    function getBestValue() {
      if (compareCards.length === 0) return null;
      return compareCards.reduce((best, current) => {
        const bestEffective = (best.baseRent || 0) - (best.tiAllowance || 0);
        const currentEffective = (current.baseRent || 0) - (current.tiAllowance || 0);
        return currentEffective < bestEffective ? current : best;
      });
    }
    function getMostReady() {
      if (compareCards.length === 0) return null;
      return compareCards.reduce((best, current) => {
        const bestPhysical = scoreResults.get(best.id)?.dimensions.physicalReadiness.score || 0;
        const currentPhysical = scoreResults.get(current.id)?.dimensions.physicalReadiness.score || 0;
        return currentPhysical > bestPhysical ? current : best;
      });
    }
    function getBestTerms() {
      if (compareCards.length === 0) return null;
      return compareCards.reduce((best, current) => {
        const bestEcon = scoreResults.get(best.id)?.dimensions.leaseEconomics.score || 0;
        const currentEcon = scoreResults.get(current.id)?.dimensions.leaseEconomics.score || 0;
        return currentEcon > bestEcon ? current : best;
      });
    }
    function getBestOverall() {
      if (compareCards.length === 0) return null;
      return compareCards.reduce((best, current) => {
        const bestScore = scoreResults.get(best.id)?.total || 0;
        const currentScore = scoreResults.get(current.id)?.total || 0;
        return currentScore > bestScore ? current : best;
      });
    }
    function isBest(card, id) {
      return card?.id === id;
    }
    head("bdaa6d", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>RE² — Space Comparison</title>`);
      });
    });
    $$renderer2.push(`<div class="page svelte-bdaa6d"><div class="page-header svelte-bdaa6d"><div class="header-top svelte-bdaa6d"><a href="/app/space" class="btn-back svelte-bdaa6d">← Back to Spaces</a> <h1 class="svelte-bdaa6d">SPACE COMPARISON</h1></div> <p class="subtitle svelte-bdaa6d">Side-by-side analysis of ${escape_html(compareCards.length)} locations</p></div> `);
    if (compareCards.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-state svelte-bdaa6d"><div class="empty-icon svelte-bdaa6d">📊</div> <div class="empty-text svelte-bdaa6d">No spaces selected for comparison.</div> <a href="/app/space" class="btn-back-home svelte-bdaa6d">Return to Spaces</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="content svelte-bdaa6d"><div class="cards-wrapper svelte-bdaa6d"><div class="cards-scroll svelte-bdaa6d"><!--[-->`);
      const each_array = ensure_array_like(compareCards);
      for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
        let card = each_array[$$index_1];
        $$renderer2.push(`<div class="comparison-card svelte-bdaa6d"><div class="card-header svelte-bdaa6d"><div class="address-block svelte-bdaa6d"><div class="address svelte-bdaa6d">${escape_html(card.address)}</div> <div class="sqft svelte-bdaa6d">${escape_html(card.sqft?.toLocaleString())} sq ft</div></div></div> <div class="photo-placeholder svelte-bdaa6d"><div class="photo-icon svelte-bdaa6d">📸</div> <div class="photo-text svelte-bdaa6d">Photo</div></div> <div class="score-section svelte-bdaa6d"><div class="score-circle svelte-bdaa6d"${attr_style(`border-color: ${stringify(getScoreColor(scoreResults.get(card.id)?.total || 0))}`)}><div class="score-value svelte-bdaa6d">${escape_html(Math.round(scoreResults.get(card.id)?.total || 0))}</div> <div class="score-label svelte-bdaa6d">SPACE SCORE</div></div></div> <div class="radar-section svelte-bdaa6d"><svg viewBox="0 0 160 160" class="radar-chart svelte-bdaa6d"><circle cx="80" cy="80" r="60" fill="none" stroke="#E0E5ED" stroke-width="1"></circle><circle cx="80" cy="80" r="40" fill="none" stroke="#E0E5ED" stroke-width="1"></circle><circle cx="80" cy="80" r="20" fill="none" stroke="#E0E5ED" stroke-width="1"></circle><line x1="80" y1="20" x2="80" y2="140" stroke="#CBD2DE" stroke-width="1"></line><line x1="20" y1="80" x2="140" y2="80" stroke="#CBD2DE" stroke-width="1"></line><polygon${attr("points", createRadarPath(scoreResults.get(card.id)?.dimensions.physicalReadiness.score || 0, scoreResults.get(card.id)?.dimensions.visibilityAccess.score || 0, scoreResults.get(card.id)?.dimensions.leaseEconomics.score || 0, scoreResults.get(card.id)?.dimensions.structuralFlexibility.score || 0))} fill="rgba(13, 124, 110, 0.15)" stroke="#0D7C6E" stroke-width="2"></polygon><text x="80" y="15" text-anchor="middle" font-size="10" fill="#8A95A8">P</text><text x="145" y="85" text-anchor="start" font-size="10" fill="#8A95A8">V</text><text x="80" y="155" text-anchor="middle" font-size="10" fill="#8A95A8">E</text><text x="15" y="85" text-anchor="end" font-size="10" fill="#8A95A8">S</text></svg></div> <div class="dimensions svelte-bdaa6d"><div class="dim-item svelte-bdaa6d"><span class="dim-name svelte-bdaa6d">Physical</span> <span class="dim-value svelte-bdaa6d"${attr_style(`color: ${stringify(getScoreColor(scoreResults.get(card.id)?.dimensions.physicalReadiness.score || 0))}`)}>${escape_html(Math.round(scoreResults.get(card.id)?.dimensions.physicalReadiness.score || 0))}</span></div> <div class="dim-item svelte-bdaa6d"><span class="dim-name svelte-bdaa6d">Visibility</span> <span class="dim-value svelte-bdaa6d"${attr_style(`color: ${stringify(getScoreColor(scoreResults.get(card.id)?.dimensions.visibilityAccess.score || 0))}`)}>${escape_html(Math.round(scoreResults.get(card.id)?.dimensions.visibilityAccess.score || 0))}</span></div> <div class="dim-item svelte-bdaa6d"><span class="dim-name svelte-bdaa6d">Economics</span> <span class="dim-value svelte-bdaa6d"${attr_style(`color: ${stringify(getScoreColor(scoreResults.get(card.id)?.dimensions.leaseEconomics.score || 0))}`)}>${escape_html(Math.round(scoreResults.get(card.id)?.dimensions.leaseEconomics.score || 0))}</span></div> <div class="dim-item svelte-bdaa6d"><span class="dim-name svelte-bdaa6d">Structure</span> <span class="dim-value svelte-bdaa6d"${attr_style(`color: ${stringify(getScoreColor(scoreResults.get(card.id)?.dimensions.structuralFlexibility.score || 0))}`)}>${escape_html(Math.round(scoreResults.get(card.id)?.dimensions.structuralFlexibility.score || 0))}</span></div></div> <div class="metrics-section svelte-bdaa6d"><div class="metric svelte-bdaa6d"><div class="metric-label svelte-bdaa6d">Base Rent (Annual)</div> <div class="metric-value svelte-bdaa6d">$${escape_html((card.baseRent || 0).toLocaleString())}</div></div> <div class="metric svelte-bdaa6d"><div class="metric-label svelte-bdaa6d">Per Sq Ft</div> <div class="metric-value svelte-bdaa6d">$${escape_html(((card.baseRent || 0) / (card.sqft || 1)).toFixed(2))}</div></div> <div class="metric svelte-bdaa6d"><div class="metric-label svelte-bdaa6d">TI Allowance</div> <div class="metric-value svelte-bdaa6d">$${escape_html((card.tiAllowance || 0).toLocaleString())}</div></div> <div class="metric svelte-bdaa6d"><div class="metric-label svelte-bdaa6d">Buildout Gap</div> <div class="metric-value svelte-bdaa6d">$${escape_html((card.buildoutGapEstimate || 0).toLocaleString())}</div></div> <div class="metric svelte-bdaa6d"><div class="metric-label svelte-bdaa6d">Lease Term</div> <div class="metric-value svelte-bdaa6d">${escape_html(card.leaseTerm || 0)} yrs</div></div> <div class="metric svelte-bdaa6d"><div class="metric-label svelte-bdaa6d">Renewal Option</div> <div class="metric-value svelte-bdaa6d">${escape_html(card.renewalOption ? "Yes" : "No")}</div></div></div> `);
        if (card.status) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="status-line svelte-bdaa6d"><span class="status-label svelte-bdaa6d">Status:</span> <span class="status-value svelte-bdaa6d">${escape_html(card.status)}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (card.dealBreakers && card.dealBreakers.length > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="breakers-section svelte-bdaa6d"><div class="breaker-header svelte-bdaa6d">Deal Breakers</div> <!--[-->`);
          const each_array_1 = ensure_array_like(card.dealBreakers);
          for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
            let breaker = each_array_1[$$index];
            $$renderer2.push(`<div class="breaker-item svelte-bdaa6d">${escape_html(breaker)}</div>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <div class="verdict-section svelte-bdaa6d"><div class="verdict-label svelte-bdaa6d">AI Verdict</div> <div class="verdict-placeholder svelte-bdaa6d">Coming soon</div></div></div>`);
      }
      $$renderer2.push(`<!--]--></div></div> <div class="highlights-section svelte-bdaa6d"><h2 class="svelte-bdaa6d">Comparison Highlights</h2> <div class="highlights-grid svelte-bdaa6d"><div class="highlight-card svelte-bdaa6d"><div class="highlight-label svelte-bdaa6d">Best Value</div> <div class="highlight-address svelte-bdaa6d">${escape_html(getBestValue()?.address || "—")}</div> <div class="highlight-metric svelte-bdaa6d">$${escape_html(((getBestValue()?.baseRent || 0) - (getBestValue()?.tiAllowance || 0)).toLocaleString())} net effective</div> `);
      if (isBest(getBestValue(), compareCards[0]?.id)) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="winner-badge svelte-bdaa6d">🏆</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="highlight-card svelte-bdaa6d"><div class="highlight-label svelte-bdaa6d">Most Ready</div> <div class="highlight-address svelte-bdaa6d">${escape_html(getMostReady()?.address || "—")}</div> <div class="highlight-metric svelte-bdaa6d">${escape_html(Math.round(scoreResults.get(getMostReady()?.id || "")?.dimensions.physicalReadiness.score || 0))} Physical Score</div> `);
      if (isBest(getMostReady(), compareCards[0]?.id)) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="winner-badge svelte-bdaa6d">🏆</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="highlight-card svelte-bdaa6d"><div class="highlight-label svelte-bdaa6d">Best Terms</div> <div class="highlight-address svelte-bdaa6d">${escape_html(getBestTerms()?.address || "—")}</div> <div class="highlight-metric svelte-bdaa6d">${escape_html(Math.round(scoreResults.get(getBestTerms()?.id || "")?.dimensions.leaseEconomics.score || 0))} Economics Score</div> `);
      if (isBest(getBestTerms(), compareCards[0]?.id)) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="winner-badge svelte-bdaa6d">🏆</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="highlight-card svelte-bdaa6d"><div class="highlight-label svelte-bdaa6d">Best Overall</div> <div class="highlight-address svelte-bdaa6d">${escape_html(getBestOverall()?.address || "—")}</div> <div class="highlight-metric svelte-bdaa6d">${escape_html(Math.round(scoreResults.get(getBestOverall()?.id || "")?.total || 0))} Total Score</div> `);
      if (isBest(getBestOverall(), compareCards[0]?.id)) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="winner-badge svelte-bdaa6d">🏆</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div></div></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
