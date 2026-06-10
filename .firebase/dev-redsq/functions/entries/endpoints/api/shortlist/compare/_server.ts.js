import { r as rateLimit, R as RATE_LIMITS } from "../../../../../chunks/rate-limit.js";
import { b as SIGNAL_KILL_FLOOR, c as SIGNAL_CAUTION_FLOOR } from "../../../../../chunks/scoring-thresholds.js";
import { a as fitGrade, f as fitTierLabel } from "../../../../../chunks/decision-engine.js";
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
function computeWinner(locations, metric) {
  const read = (loc) => {
    if (metric === "fit") return Number(loc.fitIQ ?? 0);
    if (metric === "location") return Number(loc.locationIQ ?? 0);
    return Number(loc.visionIQ ?? 0);
  };
  const vals = locations.map(read);
  const eligible = metric === "vision" ? vals.map((v, i) => v > 0 ? { v, i } : null).filter(Boolean) : vals.map((v, i) => ({ v, i }));
  if (eligible.length === 0) {
    return {
      index: null,
      addr: null,
      score: null,
      margin: null,
      reason: metric === "vision" ? "No Vision IQ data on any shortlisted location" : "No data"
    };
  }
  const max = Math.max(...eligible.map((e) => e.v));
  if (max <= 0) {
    return {
      index: null,
      addr: null,
      score: null,
      margin: null,
      reason: "All locations at zero for this metric"
    };
  }
  const topIdx = eligible.filter((e) => e.v === max).map((e) => e.i);
  if (topIdx.length > 1) {
    return {
      index: null,
      addr: null,
      score: max,
      margin: 0,
      reason: `Tie at ${max} across ${topIdx.length} locations`
    };
  }
  const winnerIdx = topIdx[0];
  const others = eligible.filter((e) => e.i !== winnerIdx);
  const margin = others.length > 0 ? max - Math.max(...others.map((e) => e.v)) : null;
  return {
    index: winnerIdx,
    addr: locations[winnerIdx].addr,
    score: max,
    margin,
    reason: others.length === 0 ? "Only eligible location" : `Leads by ${margin} points`
  };
}
function computeOverall(locations, fitWinner) {
  if (locations.length < 2) {
    return { index: null, addr: null, reasoning: "Need at least 2 locations to compare" };
  }
  const killCounts = locations.map(
    (loc) => loc.sixScores ? computeKillFactors(loc.sixScores).filter((f) => f.flag === "kill").length : 0
  );
  if (fitWinner.index != null) {
    const fWinKills = killCounts[fitWinner.index];
    if (fWinKills === 0) {
      return {
        index: fitWinner.index,
        addr: fitWinner.addr,
        reasoning: `Highest Fit IQ (${fitWinner.score}) with no kill factors — strongest overall pick.`
      };
    }
    const threshold = 7;
    const fitWinScore = Number(locations[fitWinner.index].fitIQ ?? 0);
    const cleanCloseAlt = locations.map((loc, i) => ({
      i,
      fit: Number(loc.fitIQ ?? 0),
      kills: killCounts[i]
    })).filter((x) => x.i !== fitWinner.index && x.kills === 0 && fitWinScore - x.fit <= threshold).sort((a, b) => b.fit - a.fit)[0];
    if (cleanCloseAlt) {
      return {
        index: cleanCloseAlt.i,
        addr: locations[cleanCloseAlt.i].addr,
        reasoning: `Fit IQ leader has a kill factor; this one scores ${cleanCloseAlt.fit} with zero red flags — safer pick.`
      };
    }
    return {
      index: fitWinner.index,
      addr: fitWinner.addr,
      reasoning: `Highest Fit IQ (${fitWinner.score}) but carries ${fWinKills} kill factor${fWinKills > 1 ? "s" : ""} — address before committing.`
    };
  }
  const minKills = Math.min(...killCounts);
  const cleanest = killCounts.map((k, i) => ({ k, i })).filter((x) => x.k === minKills);
  if (cleanest.length === 1) {
    return {
      index: cleanest[0].i,
      addr: locations[cleanest[0].i].addr,
      reasoning: minKills === 0 ? "Fit IQ is tied; this is the only location without kill factors." : `Fit IQ is tied; this one has the fewest kill factors (${minKills}).`
    };
  }
  return { index: null, addr: null, reasoning: "Too close to call — tied on Fit IQ and on kill factors." };
}
function buildNarrative(locations, winners) {
  if (locations.length < 2) return "";
  const clearWinners = [winners.fit, winners.location, winners.vision].filter(
    (w) => w.index != null
  );
  if (winners.overall.index == null) {
    return `These ${locations.length} locations are structurally similar — decide on qualitative factors (rent, landlord, timing) rather than the scores.`;
  }
  if (clearWinners.length >= 2 && clearWinners.every((w) => w.index === winners.overall.index)) {
    const lead = shortAddr(winners.overall.addr || "");
    return `${lead} is the strongest across the board — ${winners.overall.reasoning.toLowerCase()}`;
  }
  const fitLead = winners.fit.index != null ? shortAddr(winners.fit.addr || "") : null;
  const locLead = winners.location.index != null ? shortAddr(winners.location.addr || "") : null;
  const overallLead = shortAddr(winners.overall.addr || "");
  if (fitLead && locLead && fitLead !== locLead) {
    return `${overallLead} is the recommended pick — ${winners.overall.reasoning} ${locLead} has the stronger raw location score, but Fit IQ is the primary signal.`;
  }
  return `${overallLead} is the recommended pick. ${winners.overall.reasoning}`;
}
function shortAddr(addr) {
  if (!addr) return "";
  return addr.split(",")[0].trim() || addr;
}
function deriveLocation(loc) {
  const locationIQ = Number(loc.locationIQ ?? 0);
  const fitIQ = Number(loc.fitIQ ?? 0);
  const visionIQ = Number(loc.visionIQ ?? 0);
  const canonical = { fitIQ };
  const six = loc.sixScores ?? {};
  const flags = fitIQ > 0 ? computeKillFactors(six) : [];
  return {
    addr: loc.addr,
    geoid: loc.geoid ?? null,
    businessType: loc.businessType ?? null,
    scoredAt: loc.scoredAt ?? null,
    scores: { locationIQ, fitIQ, visionIQ },
    verdict: {
      tier: fitIQ > 0 ? fitTierLabel(fitIQ) : "Not scored",
      grade: fitIQ > 0 ? fitGrade(fitIQ) : "—",
      line: fitIQ > 0 ? getVerdict(canonical, six) : "Complete scoring to see verdict."
    },
    killFactors: flags.map((f) => ({
      signal: f.signal,
      label: f.label,
      value: f.value,
      flag: f.flag
    }))
  };
}
const POST = async ({ request }) => {
  const limited = rateLimit(request, RATE_LIMITS.api);
  if (limited) return limited;
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const locations = Array.isArray(body.locations) ? body.locations : [];
  if (locations.length < 2) {
    return new Response(
      JSON.stringify({
        error: "At least 2 locations are required to compare.",
        received: locations.length
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (locations.length > 3) {
    return new Response(
      JSON.stringify({
        error: "Compare supports a maximum of 3 locations. Unpin one to swap.",
        received: locations.length
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    if (!loc || typeof loc.addr !== "string" || !loc.addr.trim()) {
      return new Response(
        JSON.stringify({ error: `locations[${i}].addr is required` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }
  try {
    const derived = locations.map(deriveLocation);
    const fit = computeWinner(locations, "fit");
    const location = computeWinner(locations, "location");
    const vision = computeWinner(locations, "vision");
    const overall = computeOverall(locations, fit);
    const narrative = buildNarrative(locations, { fit, location, vision, overall });
    return new Response(
      JSON.stringify({
        locations: derived,
        winners: { fit, location, vision, overall },
        narrative,
        // Metadata so downstream consumers know what they're getting.
        meta: {
          source: "shortlist-compare",
          computedAt: (/* @__PURE__ */ new Date()).toISOString(),
          count: locations.length
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (e) {
    console.error("[ShortlistCompare] Error:", e);
    return new Response(
      JSON.stringify({
        error: "Internal error computing compare",
        message: e instanceof Error ? e.message : "Unknown error"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
export {
  POST
};
