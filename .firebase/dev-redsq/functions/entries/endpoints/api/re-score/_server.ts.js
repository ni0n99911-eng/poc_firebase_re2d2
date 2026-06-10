import { error, json } from "@sveltejs/kit";
import { b as buildLocationScoreBundle } from "../../../../chunks/bundle-builder.js";
import { d as db } from "../../../../chunks/db-server.js";
import { sql } from "drizzle-orm";
import { n as normalizeBusinessType } from "../../../../chunks/business-type-registry.js";
import { createHash } from "crypto";
function canonicalize(inputs) {
  const canonical = {
    address: inputs.address.trim().toLowerCase(),
    avg_ticket: inputs.avgTicket ?? null,
    buildout_budget: inputs.buildoutBudget ?? null,
    concept: inputs.concept.toLowerCase(),
    credit_score_band: inputs.creditScoreBand ?? null,
    daily_transactions: inputs.dailyTransactions ?? null,
    funding_capital: inputs.fundingCapital ?? null,
    lat: Math.round(inputs.lat * 1e5) / 1e5,
    lng: Math.round(inputs.lng * 1e5) / 1e5,
    monthly_rent_budget: inputs.monthlyRentBudget ?? null,
    scorer_version: inputs.scorerVersion,
    vision_iq_completion_pct: Math.round(inputs.visionIQCompletionPct ?? 0)
  };
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}
function computeInputsHash(inputs) {
  return createHash("sha256").update(canonicalize(inputs)).digest("hex");
}
const SCORER_VERSION = "v4.4";
const DRIFT_COPY = {
  transit: "transit data refreshed",
  demographics: "new census release",
  competition: "competition density updated",
  vibrancy: "new neighborhood signals",
  safety: "safety data updated",
  momentum: "momentum indicators updated",
  neighborhoodHealth: "updated neighborhood health indicators",
  survivalRate: "survival rate data refreshed"
};
function friendlyName(key) {
  const map = {
    transit: "transit access",
    demographics: "demographics",
    competition: "competition density",
    vibrancy: "foot traffic & vibrancy",
    safety: "safety",
    momentum: "neighborhood momentum",
    neighborhoodHealth: "neighborhood health",
    survivalRate: "business survival rate"
  };
  return map[key] ?? key;
}
const rateLimitMap = /* @__PURE__ */ new Map();
function isRateLimited(userId, address) {
  const key = `${userId}:${address}`;
  const now = Date.now();
  const window = 60 * 60 * 1e3;
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > window) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    if (rateLimitMap.size > 1e3) {
      for (const [k, v] of rateLimitMap) {
        if (now - v.windowStart > window) rateLimitMap.delete(k);
      }
      if (rateLimitMap.size > 2e3) rateLimitMap.clear();
    }
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
}
const POST = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.id) throw error(401, "Authentication required");
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { address, lat, lng, concept, conceptAnswers = {} } = body;
  if (!address || lat == null || lng == null || !concept) {
    return json({
      error: "Missing required fields",
      missing: ["address", "lat", "lng", "concept"].filter((f) => !body[f])
    }, { status: 400 });
  }
  if (isRateLimited(user.id, address)) {
    return json({ error: "Too many re-score requests for this address. Try again later." }, { status: 429 });
  }
  try {
    let fsRow;
    try {
      const fsRes = await db.execute(sql`SELECT shortlisted_locations FROM founder_sessions WHERE user_id = ${user.id} LIMIT 1`);
      fsRow = fsRes.rows[0];
    } catch (fsReadErr) {
      console.warn("[re-score] founder_sessions read error:", fsReadErr.message);
    }
    const locations = fsRow?.shortlisted_locations || [];
    const prevEntry = locations.find(
      (l) => l.addr?.toLowerCase() === address.toLowerCase()
    );
    const prevScore = typeof prevEntry?.score === "number" ? prevEntry.score : null;
    const prevSixScores = prevEntry?.sixScores || null;
    const bundle = await buildLocationScoreBundle({
      lat,
      lng,
      businessType: normalizeBusinessType(concept),
      address,
      conceptAnswers
    });
    const geoid = bundle.geoid;
    const newLocationIQ = bundle.locationIQ;
    const newSixScores = bundle.sixScores;
    const newVisionIQ = bundle.visionIQ ?? (prevEntry?.visionScore ?? 0);
    const newFitIQ = bundle.fitScore ?? (prevEntry?.fitScore ?? 0);
    const inputsHash = computeInputsHash({
      address,
      lat,
      lng,
      concept: normalizeBusinessType(concept),
      dailyTransactions: body.dailyTransactions ?? null,
      avgTicket: body.avgTicket ?? null,
      monthlyRentBudget: body.monthlyRentBudget ?? null,
      fundingCapital: body.fundingCapital ?? null,
      buildoutBudget: body.buildoutBudget ?? null,
      creditScoreBand: body.creditScoreBand ?? null,
      visionIQCompletionPct: body.visionIQCompletionPct ?? 0,
      scorerVersion: SCORER_VERSION
    });
    const scoredAt = Date.now();
    const updatedEntry = {
      ...prevEntry || {},
      addr: address,
      score: newLocationIQ,
      fitScore: newFitIQ,
      visionScore: newVisionIQ,
      sixScores: newSixScores,
      conceptType: normalizeBusinessType(concept),
      scoredAt,
      scorer_version: SCORER_VERSION,
      inputs_hash: inputsHash,
      geoid: geoid || prevEntry?.geoid || null
    };
    const updatedLocations = prevEntry ? locations.map((l) => l.addr?.toLowerCase() === address.toLowerCase() ? updatedEntry : l) : [...locations, updatedEntry];
    try {
      await db.execute(sql`
        UPDATE founder_sessions 
        SET shortlisted_locations = ${JSON.stringify(updatedLocations)}, updated_at = ${(/* @__PURE__ */ new Date()).toISOString()}
        WHERE user_id = ${user.id}
      `);
    } catch (writeErr) {
      console.error("[re-score] DB write error:", writeErr);
      return json({ error: "Failed to save score" }, { status: 500 });
    }
    let drift;
    if (prevScore !== null) {
      const delta = newLocationIQ - prevScore;
      if (Math.abs(delta) > 3) {
        const movers = Object.entries(newSixScores).map(([name, newVal]) => ({
          name,
          friendlyName: friendlyName(name),
          delta: newVal - (prevSixScores?.[name] ?? newVal),
          plainLanguage: DRIFT_COPY[name] ?? "data updated"
        })).filter((s) => Math.abs(s.delta) >= 3).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 2);
        drift = {
          delta,
          direction: delta > 0 ? "up" : "down",
          topMovers: movers
        };
        db.execute(sql`
          INSERT INTO score_drift_events (
            user_id, address, geoid, old_score, new_score, sub_scores_moved, 
            old_scorer_version, new_scorer_version, old_inputs_hash, new_inputs_hash
          ) VALUES (
            ${user.id}, ${address}, ${geoid || null}, ${prevScore}, ${newLocationIQ}, ${JSON.stringify(movers)},
            ${prevEntry?.scorer_version || "v4.legacy"}, ${SCORER_VERSION}, ${prevEntry?.inputs_hash || "legacy"}, ${inputsHash}
          )
        `).catch((err) => console.error("[re-score] score_drift_events insert error", err));
      }
    }
    return json({
      locationIQ: newLocationIQ,
      fitIQ: newFitIQ,
      visionIQ: newVisionIQ,
      sixScores: newSixScores,
      scoredAt: new Date(scoredAt).toISOString(),
      scorerVersion: SCORER_VERSION,
      inputsHash,
      ...drift ? { drift } : {}
    });
  } catch (e) {
    console.error("[re-score] Error:", e);
    return json({
      error: "Scoring failed",
      detail: e instanceof Error ? e.message : "Unknown error"
    }, { status: 500 });
  }
};
export {
  POST
};
