import "clsx";
import { b as SIGNAL_KILL_FLOOR, c as SIGNAL_CAUTION_FLOOR } from "./scoring-thresholds.js";
function conceptLabel(concept, tierLabelOverride) {
  if (tierLabelOverride && (concept === "specialty_coffee" || concept === "coffee_shop" || concept === "coffee" || concept === "cafe")) {
    return tierLabelOverride;
  }
  const MAP = {
    specialty_coffee: "specialty coffee",
    cafe_bakery: "café/bakery",
    fast_casual: "fast casual",
    qsr: "QSR",
    full_service_restaurant: "full-service restaurant",
    fine_dining: "fine dining",
    bar_nightlife: "bar/nightlife",
    fitness_studio: "fitness studio",
    retail: "retail",
    coworking: "coworking",
    medical_office: "medical office",
    personal_services: "personal services",
    wellness_spa: "spa/wellness",
    yoga_wellness: "yoga/wellness",
    juice_bar: "juice bar",
    florist: "florist"
  };
  return MAP[concept] ?? concept.replace(/_/g, " ");
}
function getWhyBulletsV2(params) {
  const { survivalRate, competitorCount, transitScore, transitStations, competitorScanStatus } = params;
  let survText;
  let survColor;
  if (survivalRate <= 0) {
    survText = "Survival rate data not yet available for this block.";
    survColor = "amber";
  } else if (survivalRate >= 65) {
    survText = `${survivalRate}% of similar businesses on this block survive year 1 — well above the NYC average of 52%. Operators who fit this market tend to stick.`;
    survColor = "green";
  } else if (survivalRate >= 52) {
    survText = `${survivalRate}% year-1 survival rate — in line with the NYC average of 52%. Steady block, no standout durability signal.`;
    survColor = "amber";
  } else {
    survText = `${survivalRate}% year-1 survival rate — below the NYC average of 52%. Model conservative unit economics through year 2.`;
    survColor = "red";
  }
  let compText;
  let compColor;
  if (competitorScanStatus && competitorScanStatus !== "complete") {
    compText = "Competitor scan in progress — check back after the full analysis loads.";
    compColor = "amber";
  } else if (competitorCount === 0) {
    compText = "No direct competitors mapped within 0.3mi — first-mover opportunity, but verify demand exists before committing.";
    compColor = "amber";
  } else if (competitorCount <= 3) {
    compText = `${competitorCount} competitor${competitorCount === 1 ? "" : "s"} within 0.3mi — low density. Room to own this block if your differentiator is clear.`;
    compColor = "green";
  } else if (competitorCount <= 8) {
    compText = `${competitorCount} competitors within 0.3mi — healthy cluster. Demand is proven; differentiation is your lever.`;
    compColor = "green";
  } else if (competitorCount <= 20) {
    compText = `${competitorCount} competitors within 0.3mi — crowded. You need a clear reason for customers to choose you over existing options.`;
    compColor = "amber";
  } else {
    compText = `${competitorCount} competitors within 0.3mi — saturated block. Consider whether volume supports another entrant.`;
    compColor = "red";
  }
  let transitText;
  let transitColor;
  const stationStr = transitStations ? ` (${transitStations})` : "";
  if (transitScore >= 75) {
    transitText = `Excellent transit access${stationStr} — score ${transitScore}/100. Multiple lines nearby drive consistent foot traffic and reduce car-dependency.`;
    transitColor = "green";
  } else if (transitScore >= 55) {
    transitText = `Good transit access${stationStr} — score ${transitScore}/100. Walk-in customers are viable; commuter traffic is moderate.`;
    transitColor = "green";
  } else if (transitScore >= 35) {
    transitText = `Moderate transit access${stationStr} — score ${transitScore}/100. Foot traffic will require active marketing; parking or delivery may help.`;
    transitColor = "amber";
  } else {
    transitText = `Limited transit access${stationStr} — score ${transitScore}/100. Car-dependent location. Ensure your concept and customer profile support this.`;
    transitColor = "red";
  }
  return [
    { text: survText, color: survColor, icon: survivalRate >= 52 ? "🏆" : "⚠️" },
    { text: compText, color: compColor, icon: competitorCount <= 8 ? "🎯" : "⚠️" },
    { text: transitText, color: transitColor, icon: transitScore >= 55 ? "🚇" : "⚠️" }
  ];
}
function getDashboardHeadline(params) {
  const {
    hasScore,
    visionIsPrelim,
    hasBusinessCase,
    hasKillFactor,
    killFactorName,
    locationCount = 0,
    bestFitIQ = 0,
    bestLocationIQ = 0,
    breakEvenMonth = null
  } = params;
  if (!hasScore) return {
    state: 0,
    text: "Score your first NYC location.",
    sub: "Drop an address to see Location IQ, Fit IQ, and what the data says about your concept."
  };
  const locStr = locationCount === 1 ? "1 location scored" : `${locationCount} locations scored`;
  const fitStr = bestFitIQ > 0 ? `Best Fit IQ: ${Math.round(bestFitIQ)}` : null;
  const liqStr = bestLocationIQ > 0 ? `Location IQ: ${Math.round(bestLocationIQ)}` : null;
  if (visionIsPrelim) return {
    state: 1,
    text: "Strong start. Now complete your Vision IQ.",
    sub: [locStr, liqStr, "Complete Vision IQ to sharpen Fit IQ."].filter(Boolean).join(" · ")
  };
  if (!hasBusinessCase) return {
    state: 2,
    text: "Ready to build your Business Case.",
    sub: [locStr, fitStr, liqStr, "Run the Business Case to see your financial path."].filter(Boolean).join(" · ")
  };
  if (hasKillFactor) return {
    state: 3,
    text: `Kill factor flagged${killFactorName ? `: ${killFactorName}` : ""}. Here's how to fix it.`,
    sub: [locStr, fitStr, "One signal is working against you — review recommendations below."].filter(Boolean).join(" · ")
  };
  const bePart = breakEvenMonth != null ? `Strongest candidate breaks even Month ${breakEvenMonth}.` : "Add your business case inputs to see break-even timing.";
  const sub4 = [locStr, fitStr, bePart].filter(Boolean).join(" · ");
  return {
    state: 4,
    text: "Your plan is taking shape.",
    sub: sub4
  };
}
function getTodaysInsight(params) {
  const {
    decisionState,
    visionIsPrelim,
    visionCompletionPct,
    sixScores,
    concept,
    locationIQ,
    fitIQ,
    tierLabel
  } = params;
  if (decisionState.state === "do_not_pursue" && decisionState.reasons.length) {
    return {
      text: `This location has a fundamental mismatch: ${decisionState.reasons[0].toLowerCase()}. ${decisionState.action}`,
      priority: "kill",
      color: "red"
    };
  }
  if (visionIsPrelim) {
    const pct = Math.round(visionCompletionPct);
    return {
      text: `Your Vision IQ is ${pct}% complete — it's still marked PRELIM, which caps your Fit IQ score. Add your differentiators and target customer profile to unlock the full score.`,
      priority: "vision",
      color: "amber"
    };
  }
  const subScoreMap = {
    transit: "Transit score is low",
    demographics: "Demographic fit is weak",
    competition: "Competition density is high",
    safety: "Safety score is a concern",
    vibrancy: "Area vibrancy is limited",
    survivalRate: "Business survival rate is below average"
  };
  let worstKey = "";
  let worstScore = 60;
  for (const [k, v] of Object.entries(sixScores)) {
    if (v > 0 && v < worstScore && subScoreMap[k]) {
      worstScore = v;
      worstKey = k;
    }
  }
  if (worstKey) {
    const label = subScoreMap[worstKey];
    const fixes = {
      transit: "Look for blocks within 3 minutes of a subway entrance — transit proximity is the single biggest foot traffic driver.",
      demographics: "Check if your target customer income band matches the area median — a $25 avg ticket needs $75K+ HHI nearby.",
      competition: "Map which competitors are direct vs. adjacent — a crowded block with no exact match still has room.",
      safety: "Corner locations with good lighting and daytime anchor businesses offset low safety scores significantly.",
      vibrancy: "Check weekend vs. weekday foot traffic split — a quiet vibrancy score may just reflect an office-dominant block.",
      survivalRate: "Model your break-even at 60% of projected revenue — if you can survive on that, the survival rate risk is manageable."
    };
    return {
      text: `${label} for this block (${worstScore}/100). ${fixes[worstKey] || "Review the signal detail for specific improvement levers."}`,
      priority: "signal",
      color: "amber"
    };
  }
  if (decisionState.reasons.length) {
    const positiveReasons = decisionState.reasons.filter(
      (r) => decisionState.state === "strong_go" || decisionState.state === "go_with_refinements"
    );
    if (positiveReasons.length) {
      return {
        text: `${positiveReasons[0]}. ${decisionState.action}`,
        priority: "coaching",
        color: "green"
      };
    }
    return {
      text: `${decisionState.reasons[0]}. ${decisionState.action}`,
      priority: "coaching",
      color: decisionState.color === "green" ? "green" : "amber"
    };
  }
  const cLabel = conceptLabel(concept, tierLabel);
  if (fitIQ >= 70 && locationIQ >= 70) {
    return {
      text: `Strong signals across the board for ${cLabel} here. The next step is stress-testing your unit economics in the Business Case.`,
      priority: "coaching",
      color: "green"
    };
  }
  return {
    text: `${locationIQ >= 60 ? "The location fundamentals are in range" : "The location needs more examination"} for ${cLabel}. Run the Business Case to see if the numbers support a lease decision here.`,
    priority: "coaching",
    color: locationIQ >= 60 ? "amber" : "red"
  };
}
function getCanonicalScores(result, _sixScores, _launchpad) {
  const locationIQ = result.compassComposite ?? 0;
  const visionIQ = result.serverVisionIQ && result.serverVisionIQ > 0 ? result.serverVisionIQ : 50;
  const fitIQ = result.fitScore && result.fitScore > 0 ? result.fitScore : 0;
  return { locationIQ, fitIQ, visionIQ };
}
function classifySignal(score) {
  if (score < SIGNAL_KILL_FLOOR) return "kill";
  if (score < SIGNAL_CAUTION_FLOOR) return "caution";
  return "ok";
}
const SIGNAL_META = {
  demographics: {
    label: "Customer Fit",
    killRec: "This area may lack your core customer base. Consider higher-traffic neighborhoods or pivot to a more accessible price point.",
    cautionRec: "Customer density is marginal. Validate foot traffic before committing."
  },
  vibrancy: {
    label: "Concept Pulse",
    killRec: "Very little activity inside your concept’s trade area. You’ll need to pull people in instead of catching passers-by — factor in destination marketing.",
    cautionRec: "Your trade-area ring is quiet. Plan for destination marketing or bookings to compensate for thin walk-by energy."
  },
  transit: {
    label: "Accessibility",
    killRec: "Poor transit access will cap your addressable market significantly.",
    cautionRec: "Limited transit. Parking availability and local density become critical."
  },
  competition: {
    label: "Competition",
    killRec: "Extreme competition density — existing players are entrenched. Requires clear differentiation.",
    cautionRec: "Competitive market. Your differentiator needs to be sharp and visible from the street."
  },
  market_proof: {
    label: "Market Proof",
    killRec: "No evidence of successful similar businesses nearby. First-mover risk is high.",
    cautionRec: "Limited comparable business success in the area. Proceed with caution."
  },
  safety: {
    label: "Safety",
    killRec: "Safety concerns will deter customers and elevate insurance/security costs.",
    cautionRec: "Safety score is below average. Evaluate specific block conditions before committing."
  },
  momentum: {
    label: "Momentum",
    killRec: "Area is declining. New entrants face headwinds from shrinking foot traffic.",
    cautionRec: "Flat growth signals. Look for evidence of near-term development plans."
  }
};
function computeKillFactors(sixScores) {
  const flags = [];
  for (const [key, meta] of Object.entries(SIGNAL_META)) {
    const score = sixScores[key];
    if (score == null) continue;
    const flag = classifySignal(score);
    if (flag === "ok") continue;
    const threshold = flag === "kill" ? 40 : 55;
    flags.push({
      signal: key,
      value: score,
      threshold,
      flag,
      label: meta.label,
      recommendation: flag === "kill" ? meta.killRec : meta.cautionRec
    });
  }
  return flags.sort((a, b) => a.value - b.value);
}
function getVerdict(scores, sixScores) {
  const { fitIQ } = scores;
  const flags = computeKillFactors(sixScores);
  const killFactors = flags.filter((f) => f.flag === "kill");
  const cautionFactors = flags.filter((f) => f.flag === "caution");
  if (fitIQ >= 80) {
    const best = Object.entries(sixScores).filter(([, v]) => v != null && v > 0).sort(([, a], [, b]) => b - a)[0];
    const bestLabel = best ? SIGNAL_META[best[0]]?.label || best[0] : "location signals";
    return `Strong fit. ${bestLabel} is the standout driver for this concept.`;
  }
  if (fitIQ >= 60) {
    if (cautionFactors.length > 0) {
      return `Viable with adjustments. Watch ${cautionFactors[0].label.toLowerCase()} — it's the key variable.`;
    }
    return "Viable location with minor trade-offs. Address the Watch signals before committing.";
  }
  if (killFactors.length > 0) {
    return `Significant headwinds. ${killFactors[0].label} is a structural concern — review the Watch section.`;
  }
  return "Below-average fit. Multiple signals need improvement before this location works for your concept.";
}
export {
  getDashboardHeadline as a,
  getTodaysInsight as b,
  computeKillFactors as c,
  getWhyBulletsV2 as d,
  getCanonicalScores as e,
  getVerdict as g
};
