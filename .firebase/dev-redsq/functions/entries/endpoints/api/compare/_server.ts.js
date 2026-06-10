import { f as fetchLocationIntel } from "../../../../chunks/index3.js";
import { c as computeLocationIQ } from "../../../../chunks/location-iq.js";
import { d as db } from "../../../../chunks/db-server.js";
import { sql } from "drizzle-orm";
import { l as latLngToGeoid, b as geoidToBorough } from "../../../../chunks/block-group.js";
import { n as normalizeBusinessType } from "../../../../chunks/business-type-registry.js";
import { h as haversineMeters } from "../../../../chunks/geo-math.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
function compareLocations(reports, businessType = "cafe") {
  if (reports.length < 2) {
    throw new Error("Need at least 2 locations to compare");
  }
  if (reports.length > 5) {
    throw new Error("Maximum 5 locations for comparison");
  }
  const iqs = reports.map((r) => computeLocationIQ(r, businessType));
  const indexed = iqs.map((iq, i) => ({ iq, i, report: reports[i] }));
  indexed.sort((a, b) => b.iq.locationIQ - a.iq.locationIQ);
  const dimensions = analyzeDimensions(indexed.map((x) => x.iq));
  const locations = indexed.map((item, rank) => {
    const strengths = findRelativeStrengths(item.iq, iqs);
    const weaknesses = findRelativeWeaknesses(item.iq, iqs);
    return {
      lat: item.report.lat,
      lng: item.report.lng,
      address: item.report.address,
      iq: item.iq,
      rank: rank + 1,
      relativeStrengths: strengths,
      relativeWeaknesses: weaknesses
    };
  });
  const iqValues = iqs.map((iq) => iq.locationIQ);
  const confValues = iqs.map((iq) => iq.confidence);
  const iqSpread = Math.max(...iqValues) - Math.min(...iqValues);
  const confidenceSpread = Math.max(...confValues) - Math.min(...confValues);
  const topPick = indexed[0].i;
  const recommendation = generateRecommendation$1(locations, iqSpread);
  return {
    locations,
    businessType,
    recommendation,
    topPick,
    confidenceSpread,
    iqSpread,
    dimensionWinners: dimensions,
    comparedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function analyzeDimensions(iqs) {
  const dims = [
    { name: "Neighborhood IQ", getter: (iq) => iq.niq },
    { name: "Storefront IQ", getter: (iq) => iq.siq },
    { name: "Taste IQ", getter: (iq) => iq.tiq },
    { name: "Transit Access", getter: (iq) => iq.breakdown.niq.transit },
    { name: "Business Ecosystem", getter: (iq) => iq.breakdown.niq.businessEcosystem },
    { name: "Walkability", getter: (iq) => iq.breakdown.siq.walkability },
    { name: "Competition", getter: (iq) => iq.breakdown.siq.competitors },
    { name: "Building Safety", getter: (iq) => iq.breakdown.siq.buildingRisk }
  ];
  return dims.map((dim) => {
    const scores = iqs.map(dim.getter);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const winnerIndex = scores.indexOf(maxScore);
    return {
      dimension: dim.name,
      winnerIndex,
      winnerScore: maxScore,
      spread: maxScore - minScore
    };
  });
}
function findRelativeStrengths(iq, all, _rank) {
  const strengths = [];
  const avgNIQ = avg(all.map((x) => x.niq));
  const avgSIQ = avg(all.map((x) => x.siq));
  const avgTIQ = avg(all.map((x) => x.tiq));
  const avgTransit = avg(all.map((x) => x.breakdown.niq.transit));
  const avgEco = avg(all.map((x) => x.breakdown.niq.businessEcosystem));
  if (iq.niq > avgNIQ + 5) strengths.push(`Stronger neighborhood fundamentals (NIQ ${iq.niq} vs avg ${Math.round(avgNIQ)})`);
  if (iq.siq > avgSIQ + 5) strengths.push(`Better storefront conditions (SIQ ${iq.siq} vs avg ${Math.round(avgSIQ)})`);
  if (iq.tiq > avgTIQ + 5) strengths.push(`Stronger taste/market fit (TIQ ${iq.tiq} vs avg ${Math.round(avgTIQ)})`);
  if (iq.breakdown.niq.transit > avgTransit + 10) strengths.push(`Superior transit access`);
  if (iq.breakdown.niq.businessEcosystem > avgEco + 10) strengths.push(`Healthier business ecosystem`);
  if (iq.breakdown.siq.walkability > 80) strengths.push(`Highly walkable location`);
  if (iq.breakdown.siq.buildingRisk > 80) strengths.push(`Low building risk`);
  return strengths.slice(0, 3);
}
function findRelativeWeaknesses(iq, all, _rank) {
  const weaknesses = [];
  const avgNIQ = avg(all.map((x) => x.niq));
  const avgSIQ = avg(all.map((x) => x.siq));
  const avgTIQ = avg(all.map((x) => x.tiq));
  if (iq.niq < avgNIQ - 5) weaknesses.push(`Weaker neighborhood profile (NIQ ${iq.niq} vs avg ${Math.round(avgNIQ)})`);
  if (iq.siq < avgSIQ - 5) weaknesses.push(`Storefront conditions below average (SIQ ${iq.siq} vs avg ${Math.round(avgSIQ)})`);
  if (iq.tiq < avgTIQ - 5) weaknesses.push(`Less favorable market fit (TIQ ${iq.tiq} vs avg ${Math.round(avgTIQ)})`);
  if (iq.breakdown.niq.disruption < 40) weaknesses.push(`Higher disruption risk nearby`);
  if (iq.breakdown.siq.competitors < 35) weaknesses.push(`Saturated competitive landscape`);
  if (iq.confidence < 50) weaknesses.push(`Limited data coverage (${iq.confidence}% confidence)`);
  return weaknesses.slice(0, 3);
}
function generateRecommendation$1(locations, iqSpread) {
  const top = locations[0];
  const second = locations[1];
  if (iqSpread < 5) {
    return `These locations are very close in overall IQ. The differences are marginal — focus on lease terms, personal preference, and field conditions to make your final decision.`;
  }
  if (iqSpread < 15) {
    return `Location #1 (IQ ${top.iq.locationIQ}) has a modest edge over #2 (IQ ${second.iq.locationIQ}). The ${top.relativeStrengths[0] || "overall balance"} makes it the stronger pick, but both are viable — negotiating power and lease terms could tip the balance.`;
  }
  return `Location #1 (IQ ${top.iq.locationIQ}, Grade ${top.iq.grade}) is the clear frontrunner over #2 (IQ ${second.iq.locationIQ}, Grade ${second.iq.grade}). The ${iqSpread}-point spread is significant. ${top.relativeStrengths[0] ? `Key advantage: ${top.relativeStrengths[0]}.` : ""} Proceed with confidence on #1 unless lease terms dramatically favor #2.`;
}
function avg(arr) {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}
const V5_DIMENSIONS = [
  "vibrancy",
  "demographics",
  "competition",
  "transit",
  "safety",
  "momentum",
  "neighborhoodHealth",
  "survivalRate"
];
const DIMENSION_LABELS = {
  vibrancy: "Concept Pulse",
  demographics: "Demographics",
  competition: "Competition",
  transit: "Transit",
  safety: "Safety",
  momentum: "Momentum",
  neighborhoodHealth: "Neighborhood Health",
  survivalRate: "Business Success Rate"
};
const DIMENSION_SCORE_TYPES = {
  vibrancy: "six_vibrancy",
  demographics: "six_demographics",
  competition: "six_competition",
  transit: "six_transit",
  safety: "six_safety",
  momentum: "six_momentum",
  neighborhoodHealth: "six_neighborhood_health",
  survivalRate: "six_survival_rate"
};
const DIMENSION_RAW_FIELDS = {
  vibrancy: ["sidewalk_cafes.record_count", "dca_licenses.record_count", "liquor_licenses.total_licenses", "foursquare.total_venues"],
  demographics: ["census_demographics.median_household_income", "census_demographics.total_population", "census_demographics.median_age", "census_housing.median_rent_burden_pct", "census_housing.median_gross_rent"],
  competition: ["google_places.total_results", "google_places.type_distribution", "osm_pois.total_pois", "dohmh_inspections.record_count"],
  transit: ["walkscore.walkscore", "walkscore.transit_score", "walkscore.bike_score", "mta_ridership.estimated_daily_ridership", "mta_ridership.station_count_within_400m", "pedestrian_counts.avg_pedestrian_count"],
  safety: ["nypd_crime.record_count", "311_complaints.record_count", "dob_permits.record_count"],
  momentum: ["dob_permits.by_type", "pluto_zoning.avg_built_far", "pluto_zoning.avg_max_far", "dca_licenses.record_count", "lpc_landmarks.record_count"],
  neighborhoodHealth: ["google_ratings", "google_reviews", "dohmh_grades"],
  survivalRate: ["business_tiers"]
};
async function loadLocationProfile(location, conceptType) {
  const [scoresRes, intelRes] = await Promise.all([
    db.execute(sql`SELECT score_type, score, components FROM block_group_scores WHERE geoid = ${location.geoid}`),
    db.execute(sql`SELECT source, data FROM block_group_intel WHERE geoid = ${location.geoid}`)
  ]);
  if (!scoresRes.rows || scoresRes.rows.length === 0) return null;
  const scores = {};
  for (const row of scoresRes.rows) {
    scores[row.score_type] = { score: row.score ? Number(row.score) : 0, components: row.components ?? {} };
  }
  const rawIntel = {};
  if (intelRes.rows) {
    for (const row of intelRes.rows) {
      rawIntel[row.source] = row.data;
    }
  }
  const locIQ = scores["location_iq"] || scores["location_iq_v5"] || { score: 0 };
  const locIQv2 = scores["location_iq_v2"] || locIQ;
  const visionKey = `vision_iq${suffix}`;
  const vision = scores[visionKey] || scores["vision_iq"] || { score: 0 };
  const haloScore = scores[`halo:${conceptType}`]?.score ?? scores["halo:general"]?.score ?? null;
  const dimensions = V5_DIMENSIONS.map((dim) => {
    const scoreType = DIMENSION_SCORE_TYPES[dim];
    const dimScore = scores[scoreType]?.score ?? 0;
    const rawFields = DIMENSION_RAW_FIELDS[dim] || [];
    const rawData = {};
    for (const field of rawFields) {
      const [source, ...path] = field.split(".");
      if (rawIntel[source]) {
        let val = rawIntel[source];
        for (const p of path) {
          val = val?.[p];
        }
        if (val !== void 0 && val !== null) {
          rawData[field] = val;
        }
      }
    }
    return {
      name: dim,
      score: dimScore,
      rawData
    };
  });
  const fitScore = locIQ.score ?? 0;
  let gradeStr = "F";
  if (fitScore >= 93) gradeStr = "A+";
  else if (fitScore >= 87) gradeStr = "A";
  else if (fitScore >= 80) gradeStr = "A-";
  else if (fitScore >= 73) gradeStr = "B+";
  else if (fitScore >= 67) gradeStr = "B";
  else if (fitScore >= 60) gradeStr = "B-";
  else if (fitScore >= 53) gradeStr = "C+";
  else if (fitScore >= 47) gradeStr = "C";
  else if (fitScore >= 40) gradeStr = "C-";
  else if (fitScore >= 30) gradeStr = "D";
  return {
    location,
    fitScore,
    locationIQv2: locIQv2.score ?? 0,
    visionIQ: vision.score ?? 0,
    grade: gradeStr,
    dimensions,
    haloScore,
    rawIntel
  };
}
function decomposeGap(profiles) {
  if (profiles.length < 2) {
    return { totalGap: 0, topDriver: "none", topDriverContribution: 0, linearVsComposite: "n/a" };
  }
  const fitScores = profiles.map((p) => p.fitScore);
  const totalGap = Math.max(...fitScores) - Math.min(...fitScores);
  if (totalGap === 0) {
    return { totalGap: 0, topDriver: "none", topDriverContribution: 0, linearVsComposite: "match" };
  }
  const dimSpreads = [];
  for (const dim of V5_DIMENSIONS) {
    const vals = profiles.map((p) => {
      const d = p.dimensions.find((dd) => dd.name === dim);
      return d?.score ?? 0;
    });
    dimSpreads.push({ dim, spread: Math.max(...vals) - Math.min(...vals) });
  }
  dimSpreads.sort((a, b) => b.spread - a.spread);
  const topDriver = dimSpreads[0];
  const topDriverContribution = totalGap > 0 ? Math.round(topDriver.spread / totalGap * 100) : 0;
  const legacyScores = profiles.map((p) => p.locationIQv2);
  const fitRanking = [...fitScores].map((s, i) => ({ i, s })).sort((a, b) => b.s - a.s);
  const legacyRanking = [...legacyScores].map((s, i) => ({ i, s })).sort((a, b) => b.s - a.s);
  const linearVsComposite = fitRanking[0].i === legacyRanking[0].i ? "V5 and legacy Location IQ agree on top pick" : `V5 and legacy disagree — V5 picks #${fitRanking[0].i + 1} but legacy picks #${legacyRanking[0].i + 1}`;
  return {
    totalGap,
    topDriver: DIMENSION_LABELS[topDriver.dim] || topDriver.dim,
    topDriverContribution,
    linearVsComposite
  };
}
function detectAnomalies(profiles) {
  const anomalies = [];
  if (profiles.length < 2) return anomalies;
  const fitScores = profiles.map((p) => p.fitScore);
  const totalGap = Math.max(...fitScores) - Math.min(...fitScores);
  if (totalGap > 5) {
    for (const dim of V5_DIMENSIONS) {
      const vals = profiles.map((p) => p.dimensions.find((d) => d.name === dim)?.score ?? 0);
      const dimGap = Math.max(...vals) - Math.min(...vals);
      if (dimGap / totalGap > 0.6) {
        anomalies.push({
          type: "single_factor_dominance",
          description: `${DIMENSION_LABELS[dim]} accounts for ${Math.round(dimGap / totalGap * 100)}% of the score gap`,
          severity: "medium",
          affectedDimension: dim,
          detail: `The ${DIMENSION_LABELS[dim]} dimension is overwhelming all other factors in this comparison.`
        });
      }
    }
  }
  if (profiles.length >= 2) {
    const geoids = profiles.map((p) => p.location.geoid);
    const uniqueGeoids = new Set(geoids);
    if (uniqueGeoids.size > 1) {
      for (let i = 0; i < profiles.length; i++) {
        for (let j = i + 1; j < profiles.length; j++) {
          const dist = haversineMeters(
            profiles[i].location.lat,
            profiles[i].location.lng,
            profiles[j].location.lat,
            profiles[j].location.lng
          );
          if (dist < 200 && profiles[i].location.geoid !== profiles[j].location.geoid) {
            anomalies.push({
              type: "boundary_artifact",
              description: `Locations ${i + 1} and ${j + 1} are ${Math.round(dist)}m apart but in different census block groups`,
              severity: "high",
              detail: "These locations likely share the same sidewalk traffic and commercial environment, but get different data profiles because a census boundary runs between them. Score differences may be artifacts of this boundary rather than real operational differences."
            });
          }
        }
      }
    }
  }
  for (let i = 0; i < profiles.length; i++) {
    const missingDims = profiles[i].dimensions.filter((d) => d.score === 0 && Object.keys(d.rawData).length === 0);
    if (missingDims.length > 2) {
      anomalies.push({
        type: "data_gap",
        description: `Location ${i + 1} is missing data for ${missingDims.length} dimensions`,
        severity: "medium",
        detail: `Missing: ${missingDims.map((d) => DIMENSION_LABELS[d.name]).join(", ")}. Scores for these dimensions default to 50 (neutral) which may understate or overstate this location.`
      });
    }
  }
  return anomalies;
}
function generateRecommendation(profiles, conceptType, anomalies) {
  if (profiles.length < 2) return "Need at least 2 locations to compare.";
  const sorted = [...profiles].sort((a, b) => b.fitScore - a.fitScore);
  const top = sorted[0];
  const second = sorted[1];
  const gap = top.fitScore - second.fitScore;
  const hasBoundaryAnomaly = anomalies.some((a) => a.type === "boundary_artifact");
  const hasSingleFactor = anomalies.some((a) => a.type === "single_factor_dominance");
  let rec = "";
  if (gap < 3) {
    rec = `These locations are essentially tied (${top.fitScore} vs ${second.fitScore}). Focus on lease terms, rent, and personal site visit impressions.`;
  } else if (gap < 10) {
    rec = `${top.location.address || `Location ${profiles.indexOf(top) + 1}`} has a modest edge (${top.fitScore} vs ${second.fitScore}, Grade ${top.grade}).`;
  } else {
    rec = `${top.location.address || `Location ${profiles.indexOf(top) + 1}`} is the stronger pick (${top.fitScore} vs ${second.fitScore}, Grade ${top.grade} vs ${second.grade}).`;
  }
  if (hasBoundaryAnomaly) {
    rec += " However, these locations may share identical foot traffic — the score difference could be a census boundary artifact. Verify with a site visit.";
  }
  if (hasSingleFactor) {
    const factor = anomalies.find((a) => a.type === "single_factor_dominance");
    rec += ` Note: the gap is mostly driven by ${factor?.affectedDimension ? DIMENSION_LABELS[factor.affectedDimension] : "a single factor"}.`;
  }
  if (sorted[0].haloScore != null && sorted[0].haloScore > 60) {
    rec += ` Top pick benefits from a star-business halo effect (score ${sorted[0].haloScore}) — nearby high-quality businesses drive foot traffic.`;
  }
  if (sorted[0].locationIQv2 > 0 && sorted[1].locationIQv2 > 0) {
    if (sorted[0].locationIQv2 < sorted[1].locationIQv2 - 5) {
      rec += ` Note: the legacy scoring model (without neighborhood health data) favors the other location — V5 model accounts for business survival patterns.`;
    }
  }
  return rec;
}
async function compareLocationsV2(locations, conceptType = "full_service_restaurant") {
  conceptType = normalizeBusinessType(conceptType);
  if (locations.length < 2 || locations.length > 5) {
    throw new Error("Provide 2-5 locations to compare");
  }
  const resolvedLocations = [];
  for (const loc of locations) {
    const geoid = await latLngToGeoid(loc.lat, loc.lng);
    if (!geoid) {
      throw new Error(`Could not resolve block group for ${loc.lat},${loc.lng}`);
    }
    resolvedLocations.push({
      lat: loc.lat,
      lng: loc.lng,
      address: loc.address,
      geoid,
      borough: geoidToBorough(geoid)
    });
  }
  const profiles = await Promise.all(
    resolvedLocations.map((loc) => loadLocationProfile(loc, conceptType))
  );
  const validProfiles = profiles.filter((p) => p !== null);
  if (validProfiles.length < 2) {
    throw new Error("Could not load scores for enough locations. At least 2 need V4 scores.");
  }
  const dimensionComparisons = V5_DIMENSIONS.map((dim) => {
    const scores = validProfiles.map((p, i) => ({
      locationIndex: i,
      score: p.dimensions.find((d) => d.name === dim)?.score ?? 0
    }));
    const maxScore = Math.max(...scores.map((s) => s.score));
    const minScore = Math.min(...scores.map((s) => s.score));
    const winnerIndex = scores.find((s) => s.score === maxScore)?.locationIndex ?? 0;
    return {
      dimension: DIMENSION_LABELS[dim] || dim,
      scores,
      winnerIndex,
      gap: maxScore - minScore,
      gapPct: 0
      // Filled below
    };
  });
  const totalDimGap = dimensionComparisons.reduce((s, d) => s + d.gap, 0);
  for (const dc of dimensionComparisons) {
    dc.gapPct = totalDimGap > 0 ? Math.round(dc.gap / totalDimGap * 100) : 0;
  }
  const ranking = validProfiles.map((p, i) => ({ i, score: p.fitScore })).sort((a, b) => b.score - a.score).map((x) => x.i);
  const gapDecomposition = decomposeGap(validProfiles);
  const anomalies = detectAnomalies(validProfiles);
  const recommendation = generateRecommendation(validProfiles, conceptType, anomalies);
  return {
    locations: validProfiles,
    conceptType,
    ranking,
    dimensionComparisons,
    gapDecomposition,
    anomalies,
    recommendation,
    comparedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
const POST = async ({ request }) => {
  const limited = rateLimit(request, RATE_LIMITS.intel);
  if (limited) return limited;
  try {
    const body = await request.json();
    if (!body.locations || !Array.isArray(body.locations)) {
      return new Response(JSON.stringify({
        error: "Missing locations array",
        usage: 'POST /api/compare with { locations: [{ lat, lng }], businessType: "cafe", version: 2 }'
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (body.locations.length < 2 || body.locations.length > 5) {
      return new Response(JSON.stringify({
        error: "Provide 2-5 locations to compare"
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    for (const loc of body.locations) {
      if (isNaN(loc.lat) || isNaN(loc.lng) || loc.lat < -90 || loc.lat > 90 || loc.lng < -180 || loc.lng > 180) {
        return new Response(JSON.stringify({
          error: `Invalid coordinates: lat=${loc.lat}, lng=${loc.lng}`
        }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }
    const businessType = normalizeBusinessType(body.businessType || "cafe");
    const version = body.version || 1;
    if (version === 2) {
      const comparison2 = await compareLocationsV2(body.locations, businessType);
      return new Response(JSON.stringify({
        version: 2,
        ...comparison2
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const reports = await Promise.all(
      body.locations.map(
        (loc) => fetchLocationIntel(loc.lat, loc.lng, businessType, loc.address)
      )
    );
    const comparison = compareLocations(reports, businessType);
    return new Response(JSON.stringify({
      version: 1,
      ...comparison
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    console.error("[Compare] Endpoint error:", e);
    return new Response(JSON.stringify({
      error: "Internal error comparing locations",
      message: e instanceof Error ? e.message : "Unknown error"
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
export {
  POST
};
