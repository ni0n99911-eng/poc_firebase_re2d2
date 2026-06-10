import { C as CONCEPT_KPIS } from "./conceptKPIs.js";
import { T as TIER_BOUNDARIES, E as EVIDENCE_COPY, K as KILL_FACTOR_THRESHOLDS, D as DIRECTION_THRESHOLDS, b as SIGNAL_KILL_FLOOR, c as SIGNAL_CAUTION_FLOOR } from "./scoring-thresholds.js";
function tierFor(score, dim) {
  const F = TIER_BOUNDARIES.fitIQ;
  const L = TIER_BOUNDARIES.locationIQ;
  const V = TIER_BOUNDARIES.visionIQ;
  const D = TIER_BOUNDARIES.lens;
  switch (dim) {
    case "fitIQ":
      if (score >= F.t1) return { label: "Strong Path", copy: "strong", color: "green", severity: "good" };
      if (score >= F.t2) return { label: "Viable", copy: "workable", color: "green", severity: "good" };
      if (score >= F.t3) return { label: "Tight", copy: "tight", color: "amber", severity: "neutral" };
      if (score >= F.t4) return { label: "Stretch", copy: "stretched", color: "amber", severity: "warn" };
      return { label: "Rethink", copy: "weak", color: "red", severity: "kill" };
    case "locationIQ":
      if (score >= L.t1) return { label: "Prime Block", copy: "prime", color: "green", severity: "good" };
      if (score >= L.t2) return { label: "Solid Block", copy: "solid", color: "green", severity: "good" };
      if (score >= L.t3) return { label: "Mixed Block", copy: "mixed", color: "amber", severity: "neutral" };
      return { label: "Developing Block", copy: "developing", color: "amber", severity: "warn" };
    case "visionIQ":
      if (score >= V.t1) return { label: "Sharp Fit", copy: "sharp", color: "green", severity: "good" };
      if (score >= V.t2) return { label: "Clear", copy: "clear", color: "green", severity: "good" };
      if (score >= V.t3) return { label: "Forming", copy: "forming", color: "amber", severity: "neutral" };
      if (score >= V.t4) return { label: "Fuzzy", copy: "fuzzy", color: "amber", severity: "warn" };
      return { label: "Outline", copy: "outlined", color: "red", severity: "kill" };
    case "lens":
    default:
      if (score >= D.t1) return { label: "Strong", copy: "strong", color: "green", severity: "good" };
      if (score >= D.t2) return { label: "Solid", copy: "solid", color: "green", severity: "good" };
      if (score >= D.t3) return { label: "Average", copy: "average", color: "neutral", severity: "neutral" };
      if (score >= D.t4) return { label: "Weak", copy: "weak", color: "amber", severity: "warn" };
      return { label: "Concerning", copy: "concerning", color: "red", severity: "kill" };
  }
}
function tierLabelFor(score, dim) {
  return tierFor(score, dim).label;
}
const CONFIDENCE_PARTIAL = 80;
const CONFIDENCE_SKELETON = 60;
function confidenceTier(n) {
  if (n == null || !Number.isFinite(n) || n < 0) return "skeleton";
  if (n >= CONFIDENCE_PARTIAL) return "full";
  if (n >= CONFIDENCE_SKELETON) return "partial";
  return "skeleton";
}
const THRESHOLDS = {
  STRONG_GO: 75,
  GO_WITH_REFINEMENTS: 65,
  WORTH_TESTING: 50,
  HIGH_RISK: 40
  // below 40 → do_not_pursue
};
const CONCEPT_DISPLAY = {
  specialty_coffee: "coffee shop",
  bakery: "bakery",
  fast_casual: "fast casual restaurant",
  qsr: "quick-service restaurant",
  full_service_restaurant: "full-service restaurant",
  fine_dining: "fine dining restaurant",
  bar_nightlife: "bar / nightlife venue",
  fitness_studio: "fitness studio",
  retail: "retail store",
  coworking: "coworking space",
  medical_office: "medical office",
  personal_services: "personal services business",
  wellness_spa: "spa / wellness studio",
  juice_bar: "juice bar",
  florist: "florist",
  wellness_beverage: "wellness beverage concept"
};
function conceptLabel(bizType) {
  return CONCEPT_DISPLAY[bizType] || bizType.replace(/_/g, " ");
}
function signalLabel(key, val, ctx) {
  const HIGH = val >= EVIDENCE_COPY.high;
  const MED = val >= EVIDENCE_COPY.med;
  switch (key) {
    case "transit":
      return HIGH ? "strong transit access" : MED ? "adequate transit access" : "limited transit access";
    case "demographics":
      return HIGH ? "demographics align with your target customer" : MED ? "demographic fit is moderate" : "demographic mismatch for this concept";
    case "competition":
      if (ctx?.competitorCount === 0) return "unproven market — no established competition yet";
      return HIGH ? "low competition density — room to own this block" : MED ? "moderate competition" : "high competition density";
    case "safety":
      return HIGH ? "strong safety profile" : MED ? "average safety" : "safety concerns on this block";
    case "vibrancy":
    case "vibrancy_index":
      return HIGH ? "busy concept pulse — your trade-area ring is humming" : MED ? "steady concept pulse in your trade area" : "quiet concept pulse — your ring is calm, plan for destination marketing";
    case "momentum":
      return HIGH ? "neighborhood is growing — rising demand" : MED ? "stable neighborhood" : "neighborhood is declining";
    case "survivalRate":
    case "survival_rate":
      return HIGH ? "strong business survival track record on this block" : val < 50 ? "above-average business turnover on this block — meaningful risk" : "business survival in line with the NYC average for this block type";
    default:
      return "";
  }
}
function pickReasons(fitIQ, sixScores, fitSubScores, bizType, visionIsPrelim, direction) {
  const reasons = [];
  const s = {
    transit: sixScores["transit"] || 0,
    demographics: sixScores["demographics"] || fitSubScores["demographics"] || 0,
    competition: sixScores["competition"] || fitSubScores["competition"] || 0,
    safety: sixScores["safety"] || 0,
    vibrancy: sixScores["vibrancy"] || sixScores["vibrancy_index"] || 0,
    momentum: sixScores["momentum"] || 0,
    survivalRate: sixScores["survivalRate"] || sixScores["survival_rate"] || 0
  };
  const competitorCount = fitSubScores["competitor_count"] ?? (s.competition === 40 ? 0 : void 0);
  const signalCtx = { competitorCount };
  if (direction === "strengths" || direction === "mixed") {
    const ranked = Object.entries(s).filter(([, v]) => v >= 65).sort(([, a], [, b]) => b - a).slice(0, 2);
    for (const [key, val] of ranked) {
      const label = signalLabel(key, val, signalCtx);
      if (label) reasons.push(label.charAt(0).toUpperCase() + label.slice(1) + ".");
    }
  }
  if (direction === "risks" || direction === "mixed") {
    const weak = Object.entries(s).filter(([, v]) => v > 0 && v < 50).sort(([, a], [, b]) => a - b).slice(0, 2);
    for (const [key, val] of weak) {
      const label = signalLabel(key, val, signalCtx);
      if (label) reasons.push(label.charAt(0).toUpperCase() + label.slice(1) + ".");
    }
  }
  if (visionIsPrelim && reasons.length < 3) {
    reasons.push("Vision score is preliminary — add concept details to sharpen this result.");
  }
  if (reasons.length < 2) {
    const mkt = fitSubScores["market_proof"] || 0;
    const acc = fitSubScores["accessibility"] || 0;
    if (mkt >= 60) reasons.push(`Market proof ${mkt} — similar ${conceptLabel(bizType)}s show strong survival on this block.`);
    else if (acc >= 65) reasons.push(`Accessibility ${acc} — easy to reach for walk-in customers.`);
    else {
      const resolvedCount = Object.values(s).filter((v) => v > 0).length;
      if (resolvedCount > 0) {
        reasons.push(`${resolvedCount} location signal${resolvedCount !== 1 ? "s" : ""} scored. Complete your concept profile to unlock a personalised action plan.`);
      } else {
        reasons.push("Re-score this address to pull fresh block-level data and unlock your personalised action plan.");
      }
    }
  }
  return reasons.slice(0, 4);
}
const SIGNAL_LABELS = {
  transit: "Transit access",
  demographics: "Demographics",
  competition: "Competition density",
  safety: "Safety profile",
  vibrancy: "Area vibrancy",
  momentum: "Neighbourhood momentum",
  survivalRate: "Year-1 business survival",
  visionScore: "Concept detail",
  marketProof: "Market proof"
};
const CHANGEABILITY = {
  transit: "fixed",
  demographics: "fixed",
  competition: "fixed",
  // block-level — adjusting concept can partially offset
  safety: "fixed",
  vibrancy: "fixed",
  momentum: "fixed",
  survivalRate: "fixed",
  visionScore: "flexible",
  // founder fills this in
  marketProof: "flexible"
  // concept choice + positioning
};
const CATEGORY = {
  transit: "location",
  demographics: "location",
  competition: "location",
  safety: "location",
  vibrancy: "location",
  momentum: "location",
  survivalRate: "financials",
  visionScore: "vision",
  marketProof: "vision"
};
function evidenceCopy(key, value, concept, ctx) {
  const HIGH = value >= EVIDENCE_COPY.high;
  const MED = value >= EVIDENCE_COPY.med;
  switch (key) {
    case "transit":
      return HIGH ? `Strong transit coverage — your target customer can reach this block easily.` : MED ? `Moderate transit access — some customers will find this convenient, others won't.` : `Limited transit access — capturing walk-in traffic will take extra marketing effort.`;
    case "demographics":
      return HIGH ? `Demographics align with your price point and target customer profile.` : MED ? `Demographic fit is moderate — income and density are workable but not ideal.` : `Demographic mismatch — the neighbourhood profile doesn't fit a ${concept} at your target price point.`;
    case "competition":
      if (ctx?.competitorCount === 0) {
        return `Unproven market — no direct ${concept} competitors found nearby. This means untested demand rather than validated foot traffic.`;
      }
      return HIGH ? `Low competition density — this block doesn't yet have a strong ${concept} player.` : MED ? `Moderate competition — there are existing players, but differentiation should be achievable.` : `High competition density — you'd be entering a crowded market on this block.`;
    case "safety":
      return HIGH ? `Strong safety profile — this shouldn't deter your target customer.` : MED ? `Average safety — unlikely to be a deciding factor for most customers.` : `Safety concerns on this block — could affect footfall quality and conversion.`;
    case "vibrancy":
    case "vibrancy_index": {
      const isCoffee = /coffee|café|cafe/i.test(concept);
      const isRestaurant = /restaurant|dining|food|bar|pub|tavern/i.test(concept);
      if (isCoffee) {
        return HIGH ? `Strong morning rush momentum — high commuter density feeds walk-in demand before 10 AM.` : MED ? `Moderate morning foot traffic — some commuter flow, but you'll supplement with regulars and destination visits.` : `Low morning rush energy — this block won't hand you commuters. Plan for destination marketing and a loyal-regular model.`;
      }
      if (isRestaurant) {
        return HIGH ? `Busy peak-hour foot traffic — the block is active during lunch and dinner windows.` : MED ? `Moderate foot traffic at peak hours — enough passersby to supplement reservations, but not enough to rely on walk-ins alone.` : `Quiet during peak hours — this location will depend on reservations and reputation rather than foot traffic.`;
      }
      return HIGH ? `Busy trade-area ring — the block is humming with activity, handing you walk-by traffic.` : MED ? `Steady foot traffic — normal commercial life in your ring; you'll neither ride the block nor fight it.` : `Quiet trade area — this location will depend on destination marketing, bookings, or a standout storefront rather than walk-by energy.`;
    }
    case "momentum":
      return HIGH ? `Neighbourhood is growing — you'd be opening into rising demand, not fighting decline.` : MED ? `Stable neighbourhood — not declining, but not generating tail-winds either.` : `Neighbourhood is declining — this adds execution risk beyond the concept itself.`;
    case "survivalRate":
    case "survival_rate":
      return HIGH ? `Strong business survival track record — similar businesses on this block have an above-average chance of making it past year 1.` : value < 50 ? `Above-average business turnover here — this is a meaningful risk signal to weigh against your fit.` : `Business survival in line with the NYC average for this block type.`;
    case "visionScore":
      return HIGH ? `Your concept details are well-defined — your concept details are contributing meaningfully to your score.` : MED ? `Concept detail is partially filled — adding more concept detail will sharpen your score.` : `Concept detail is thin — filling in concept details could add 8–14 points to your score.`;
    case "marketProof":
      return HIGH ? `Strong market proof — similar ${concept}s show a track record of surviving on this block.` : MED ? `Moderate market proof — some precedent for this concept in this area.` : `Weak market proof — limited evidence that a ${concept} has worked in this immediate area.`;
    default:
      return `${key} score: ${value}`;
  }
}
function getEvidencePayload(fitIQ, locationIQ, visionIQ, sixScores, fitSubScores, bizType, visionIsPrelim) {
  const concept = conceptLabel(bizType);
  const rawSignals = [
    { key: "transit", value: sixScores["transit"] || 0 },
    { key: "demographics", value: sixScores["demographics"] || fitSubScores["demographics"] || 0 },
    { key: "competition", value: sixScores["competition"] || fitSubScores["competition"] || 0 },
    { key: "safety", value: sixScores["safety"] || 0 },
    { key: "vibrancy", value: sixScores["vibrancy"] || sixScores["vibrancy_index"] || 0 },
    { key: "momentum", value: sixScores["momentum"] || 0 },
    { key: "survivalRate", value: sixScores["survivalRate"] || sixScores["survival_rate"] || 0 },
    { key: "marketProof", value: fitSubScores["market_proof"] || 0 }
  ];
  if (visionIsPrelim) {
    rawSignals.push({ key: "__visionPrelim", value: 1 });
  } else if (visionIQ > 0) {
    rawSignals.push({ key: "visionScore", value: visionIQ });
  }
  const compScore = sixScores["competition"] || fitSubScores["competition"] || 0;
  const competitorCount = fitSubScores["competitor_count"] ?? (compScore === 40 ? 0 : void 0);
  const evidenceCtx = { competitorCount };
  const items = rawSignals.filter((s) => s.value > 0).map((s) => {
    if (s.key === "__visionPrelim") {
      return {
        key: "visionScore",
        label: SIGNAL_LABELS["visionScore"],
        value: 0,
        direction: "neutral",
        changeability: "flexible",
        copy: `We're scoring without your concept details. Add them to sharpen this by ~8 points.`,
        category: "vision"
      };
    }
    const direction = s.value >= DIRECTION_THRESHOLDS.positive ? "positive" : s.value < DIRECTION_THRESHOLDS.negative ? "negative" : "neutral";
    return {
      key: s.key,
      label: SIGNAL_LABELS[s.key] || s.key,
      value: s.value,
      direction,
      changeability: CHANGEABILITY[s.key] || "fixed",
      copy: evidenceCopy(s.key, s.value, concept, evidenceCtx),
      category: CATEGORY[s.key] || "location"
    };
  });
  const compItem = items.find((i) => i.key === "competition");
  const mpItem = items.find((i) => i.key === "marketProof");
  const rc7Drop = /* @__PURE__ */ new Set();
  if (competitorCount === 0) {
    if (compItem) rc7Drop.add("competition");
    if (mpItem) rc7Drop.add("marketProof");
    if (!mpItem || mpItem.value === 0) {
      items.push({
        key: "competition",
        label: SIGNAL_LABELS["competition"],
        value: 0,
        direction: "neutral",
        changeability: "fixed",
        copy: `No direct ${concept} competitors found nearby — this is an untested market. Validate demand before committing.`,
        category: "location"
      });
    }
  } else if (compItem && mpItem && compItem.direction !== mpItem.direction) {
    const compStrength = Math.abs(compItem.value - 60);
    const mpStrength = Math.abs(mpItem.value - 60);
    rc7Drop.add(compStrength >= mpStrength ? "marketProof" : "competition");
  }
  const filtered = rc7Drop.size > 0 ? items.filter((i) => !rc7Drop.has(i.key)) : items;
  const helping = filtered.filter((i) => i.direction === "positive").sort((a, b) => b.value - a.value);
  const hurting = filtered.filter((i) => i.direction === "negative").sort((a, b) => a.value - b.value);
  const canChange = filtered.filter((i) => i.changeability === "flexible");
  const cannotChange = filtered.filter((i) => i.changeability === "fixed");
  return { helping, hurting, canChange, cannotChange };
}
const REVENUE_MODEL_CONTEXT = {
  volume: "Revenue is driven by daily transaction volume — foot traffic is the primary lever.",
  mrr: "Revenue is driven by monthly memberships — first-month acquisition and retention matter more than walk-by traffic.",
  utilization: "Revenue is driven by slot or space utilization — peak-hour density and accessibility are key.",
  sqft: "Revenue is driven by rent-per-sqft economics — location prestige and tenant mix matter.",
  event_plus: "Revenue is driven by event bookings plus daily walk-in — vibrancy and visibility are equally important.",
  peak_weighted: "Revenue is concentrated in peak nights — late-night energy, transit, and weekend foot traffic matter most."
};
function matchActiveRisks(killFactors, scores) {
  const active = [];
  for (const kf of killFactors) {
    const lower = kf.toLowerCase();
    if ((lower.includes("foot traffic") || lower.includes("commuter") || lower.includes("transit")) && scores.transit < 55) {
      active.push(kf);
    } else if ((lower.includes("competitor") || lower.includes("competition") || lower.includes("competing")) && scores.competition < 55) {
      active.push(kf);
    } else if ((lower.includes("distinguishing") || lower.includes("differentiation") || lower.includes("beyond")) && scores.visionIQ > 0 && scores.visionIQ < 60) {
      active.push(kf);
    } else if ((lower.includes("income") || lower.includes("demographic") || lower.includes("customer")) && scores.demographics < 50) {
      active.push(kf);
    } else if (lower.includes("safety") && scores.safety < 50) {
      active.push(kf);
    }
    if (active.length >= 2) break;
  }
  return active;
}
function getConceptCoaching(fitIQ, locationIQ, visionIQ, sixScores, fitSubScores, bizType) {
  if (fitIQ === 0) return null;
  const kpi = CONCEPT_KPIS[bizType];
  if (!kpi) return null;
  const concept = conceptLabel(bizType);
  const sig = {
    transit: sixScores["transit"] || 0,
    competition: sixScores["competition"] || fitSubScores["competition"] || 0,
    demographics: sixScores["demographics"] || fitSubScores["demographics"] || 0,
    safety: sixScores["safety"] || 0,
    vibrancy: sixScores["vibrancy"] || sixScores["vibrancy_index"] || 0,
    visionIQ
  };
  const activeRisks = matchActiveRisks(kpi.killFactors || [], sig);
  const nextSteps = [];
  if (visionIQ > 0 && visionIQ < 60) {
    nextSteps.push(`Sharpen your concept details — "what makes yours different" is the fastest way to add points.`);
  }
  if (sig.transit < 55 && sig.transit > 0) {
    const footModel = kpi.revenueModel === "mrr" || kpi.revenueModel === "utilization" ? `Transit access matters less for a ${concept} than for walk-in concepts, but check whether your target customer can reach this block.` : `This block lacks the foot traffic density a ${concept} typically needs — compare a busier nearby address.`;
    nextSteps.push(footModel);
  }
  if (sig.competition < 55 && sig.competition > 0) {
    if (sig.competition === 40) {
      nextSteps.push(`No direct ${concept} competitors found nearby — this is an untested market. Validate demand before committing to a lease.`);
    } else {
      nextSteps.push(`Strong competitive pressure on this block — your differentiator needs to be specific enough to give customers a clear reason to choose you over existing ${concept}s.`);
    }
  }
  if (sig.demographics < 50 && sig.demographics > 0) {
    nextSteps.push(`The demographic profile here may not match your target customer's income or density expectations for a ${concept}.`);
  }
  if (locationIQ >= 65 && fitIQ < 55 && visionIQ < 55) {
    nextSteps.push(`The location is solid — your score is being dragged down by incomplete concept details. Fill in your concept details to unlock the block's potential.`);
  }
  if (nextSteps.length === 0) {
    if (fitIQ >= 75) {
      nextSteps.push(`The fundamentals are strong for a ${concept}. Build your financial model to stress-test the revenue assumptions.`);
    } else {
      nextSteps.push(`Review the signals above and focus on the weakest one first — each point of improvement in a key signal can move your score by 2–5 points.`);
    }
  }
  const revenueContext = REVENUE_MODEL_CONTEXT[kpi.revenueModel] ?? "Revenue model context not available for this concept type.";
  return {
    title: `${kpi.label} — what this concept needs`,
    activeRisks,
    nextSteps: nextSteps.slice(0, 3),
    revenueContext
  };
}
function getDecisionState(fitIQ, locationIQ, visionIQ, sixScores, fitSubScores, bizType, visionIsPrelim) {
  const concept = conceptLabel(bizType);
  if (fitIQ === 0) {
    return {
      state: "worth_testing",
      headline: "Analyzing...",
      summary: "Scoring this location — this usually takes 10–20 seconds.",
      action: "Wait for your score",
      reasons: [],
      color: "amber"
    };
  }
  if (fitIQ >= THRESHOLDS.STRONG_GO) {
    return {
      state: "strong_go",
      headline: "Strong Path",
      summary: `A score of ${fitIQ} means this concept-location pairing has strong fundamentals. The block works for a ${concept} and the signals back it up.`,
      action: "Build your financial case →",
      reasons: pickReasons(fitIQ, sixScores, fitSubScores, bizType, visionIsPrelim, "strengths"),
      color: "green"
    };
  }
  if (fitIQ >= THRESHOLDS.GO_WITH_REFINEMENTS) {
    const lowVision = visionIQ > 0 && visionIQ < 60;
    const summary = lowVision ? `A score of ${fitIQ} is promising. The location is solid — your concept details need sharpening to push this into high-confidence territory.` : `A score of ${fitIQ} is promising for a ${concept}. The fundamentals are working but there are a few signals worth addressing before committing.`;
    return {
      state: "go_with_refinements",
      headline: "Viable",
      summary,
      action: lowVision ? "Sharpen your concept details →" : "Review what needs work →",
      reasons: pickReasons(fitIQ, sixScores, fitSubScores, bizType, visionIsPrelim, "mixed"),
      color: "blue"
    };
  }
  if (fitIQ >= THRESHOLDS.WORTH_TESTING) {
    const highLoc = locationIQ >= 65;
    const summary = highLoc ? `A score of ${fitIQ} suggests the location itself is strong, but the concept-location pairing needs work. Sharpening your concept angle or adjusting positioning could move this significantly.` : `A score of ${fitIQ} means this version isn't yet strong enough to act on with confidence. The block has potential, but key signals need improvement before this becomes a clear opportunity.`;
    return {
      state: "worth_testing",
      headline: "Tight",
      summary,
      action: "See what to improve →",
      reasons: pickReasons(fitIQ, sixScores, fitSubScores, bizType, visionIsPrelim, "mixed"),
      color: "amber"
    };
  }
  if (fitIQ >= THRESHOLDS.HIGH_RISK) {
    return {
      state: "high_risk",
      headline: "Stretch",
      summary: `A score of ${fitIQ} means significant gaps exist between this location and your concept. This version of the plan has meaningful risk. Consider adjusting your concept, price point, or exploring other blocks.`,
      action: "Try a different block or refine your concept →",
      reasons: pickReasons(fitIQ, sixScores, fitSubScores, bizType, visionIsPrelim, "risks"),
      color: "orange"
    };
  }
  return {
    state: "do_not_pursue",
    headline: "Rethink",
    summary: `A score of ${fitIQ} indicates serious misalignment between this location and this concept. This is not a signal to give up — it's a diagnosis. The concept or the block, or both, need to change.`,
    action: "Explore a different location →",
    reasons: pickReasons(fitIQ, sixScores, fitSubScores, bizType, visionIsPrelim, "risks"),
    color: "red"
  };
}
function blockTierLabel(locationIQ) {
  if (locationIQ < 50) return "";
  return tierFor(locationIQ, "locationIQ").label;
}
function fitTierLabel(fitIQ) {
  return tierFor(fitIQ, "fitIQ").label;
}
function fitGrade(fitIQ) {
  if (fitIQ >= 75) return "A";
  if (fitIQ >= 65) return "B";
  if (fitIQ >= 50) return "C";
  if (fitIQ >= 40) return "D";
  return "F";
}
function fitGradeCapped(fitIQ, sixScores, survivalRatePct) {
  const base = fitGrade(fitIQ);
  const order = ["A", "B", "C", "D", "F"];
  let cap = "A";
  if (sixScores) {
    let hasKill = false;
    let hasCaution = false;
    for (const key of ["transit", "safety", "demographics", "competition", "vibrancy", "momentum"]) {
      const v = sixScores[key];
      if (typeof v !== "number" || v <= 0) continue;
      if (v < SIGNAL_KILL_FLOOR) hasKill = true;
      else if (v < SIGNAL_CAUTION_FLOOR) hasCaution = true;
    }
    if (hasKill) cap = "C";
    else if (hasCaution) cap = "B";
  }
  if (typeof survivalRatePct === "number" && survivalRatePct > 0 && survivalRatePct < 45) {
    if (order.indexOf(cap) < order.indexOf("B")) cap = "B";
  }
  return order.indexOf(base) > order.indexOf(cap) ? base : cap;
}
function fitGradeCappedWithReason(fitIQ, opts) {
  const base = fitGrade(fitIQ);
  const baseVerdict = fitTierLabel(fitIQ);
  const safety = opts.safety;
  const survival = opts.survivalRatePct;
  const order = ["A", "B", "C", "D", "F"];
  const triggers = [];
  if (typeof safety === "number" && safety > 0 && safety <= KILL_FACTOR_THRESHOLDS.safety) {
    triggers.push(`Safety score ${Math.round(safety)} is below our trusted floor (${KILL_FACTOR_THRESHOLDS.safety})`);
  }
  if (typeof survival === "number" && survival > 0 && survival <= KILL_FACTOR_THRESHOLDS.survival) {
    triggers.push(`1-year survival rate ${Math.round(survival)}% is below the NYC average for this concept`);
  }
  if (triggers.length === 0) {
    return { grade: base, verdict: baseVerdict, capReason: null };
  }
  const cappedGrade = order.indexOf(base) >= order.indexOf("B") ? base : "B";
  return {
    grade: cappedGrade,
    verdict: "Viable",
    capReason: triggers.join(" • ")
  };
}
function _watchOutSuffix(count) {
  if (!count || count <= 0) return "";
  const word = count === 1 ? "One thing" : count === 2 ? "Two things" : count === 3 ? "Three things" : `${count} things`;
  return ` ${word} to address before signing.`;
}
function _topLeverSuffix(lever) {
  if (!lever) return "";
  return ` Start with ${lever}.`;
}
function fitMeaning(fitIQ, ctx = {}) {
  const watchSuffix = _watchOutSuffix(ctx.watchOutCount ?? 0);
  const leverSuffix = _topLeverSuffix(ctx.topLever);
  const actionSuffix = leverSuffix || watchSuffix;
  if (fitIQ >= 75)
    return `You're on solid ground here. The block supports your concept and you have real upside — move carefully and you're in a strong position.${actionSuffix}`;
  if (fitIQ >= 65)
    return `This block works for you. You're in workable territory — improve one or two things and it becomes a strong match.${actionSuffix}`;
  if (fitIQ >= 50)
    return `This is workable but it won't run itself. Founders who succeed on blocks like this one get one important thing right before signing anything.${actionSuffix}`;
  if (fitIQ >= 40)
    return `You've got real gaps to close before this becomes safe. You can fix them, but you need a clear plan before the lease — not after.${actionSuffix}`;
  return `The signals on this block are working against your concept. Before you commit, look at other blocks — or change the concept to match what this block actually wants.${actionSuffix}`;
}
function fitVerdictShort(fitIQ, concept = "location") {
  const copy = tierFor(fitIQ, "fitIQ").copy;
  const adj = copy.charAt(0).toUpperCase() + copy.slice(1);
  if (fitIQ < 40) {
    return `Rethink this ${concept} location.`;
  }
  return `${adj} ${concept} location.`;
}
function fitMeaningShort(fitIQ) {
  if (fitIQ >= 75) return "Strong fundamentals. Ready to act.";
  if (fitIQ >= 65) return "This works. Improve one or two things to make it strong.";
  if (fitIQ >= 50) return "Workable. Focus on getting one important thing right.";
  if (fitIQ >= 40) return "Real gaps. Fixable with a clear plan.";
  return "Signals work against you. Look at other blocks.";
}
function fitNextTier(fitIQ) {
  if (fitIQ >= 75) return null;
  if (fitIQ >= 65) return { points: 75 - fitIQ, label: "Strong Path", threshold: 75 };
  if (fitIQ >= 50) return { points: 65 - fitIQ, label: "Viable", threshold: 65 };
  if (fitIQ >= 40) return { points: 50 - fitIQ, label: "Tight", threshold: 50 };
  return { points: 40 - fitIQ, label: "Stretch", threshold: 40 };
}
export {
  fitGrade as a,
  blockTierLabel as b,
  fitNextTier as c,
  fitGradeCappedWithReason as d,
  fitMeaningShort as e,
  fitTierLabel as f,
  getDecisionState as g,
  fitGradeCapped as h,
  fitMeaning as i,
  fitVerdictShort as j,
  tierLabelFor as k,
  confidenceTier as l,
  getEvidencePayload as m,
  getConceptCoaching as n,
  tierFor as t
};
