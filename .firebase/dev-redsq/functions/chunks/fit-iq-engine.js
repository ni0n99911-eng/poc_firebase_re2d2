import { d as db } from "./db-server.js";
import { sql } from "drizzle-orm";
import { b as buildDynamicConfig } from "./dynamic-concept-config.js";
import { r as resolveConceptType } from "./six-index.js";
import { s as scoreToGrade } from "./primitives.js";
import { c as clamp, s as scoreLinear } from "./geo-math.js";
function expandVariance(raw, strength) {
  if (strength <= 1) return raw;
  const delta = raw - 50;
  const absDelta = Math.abs(delta);
  let expanded;
  if (absDelta <= 30) {
    expanded = delta * strength;
  } else {
    const base = 30 * strength;
    const remainder = absDelta - 30;
    const dampedRemainder = Math.sqrt(remainder) * Math.sqrt(30) * (strength - 1) + remainder;
    expanded = Math.sign(delta) * (base + dampedRemainder);
  }
  return clamp(Math.round(50 + expanded), 5, 98);
}
function scoreFootTraffic(data) {
  let score = 50;
  const parts = [];
  let hasMta = false;
  let hasPed = false;
  let hasWalk = false;
  const mta = data.enriched.mta_ridership || data.intel.mta_ridership;
  if (mta) {
    const ridership = mta.estimated_daily_ridership || mta.totalDailyRidership || 0;
    const stations = mta.station_count_within_400m || mta.stationCount || 0;
    const mtaScore = scoreLinear(ridership, 1e3, 5e4);
    score = mtaScore;
    hasMta = true;
    parts.push(`${ridership.toLocaleString()} daily transit riders, ${stations} station${stations !== 1 ? "s" : ""} nearby`);
  }
  const ped = data.enriched.pedestrian_counts || data.intel.pedestrian_counts;
  if (ped && ped.avg_pedestrian_count > 0) {
    const avg = ped.avg_pedestrian_count;
    const pedScore = scoreLinear(avg, 100, 1e4);
    score = hasMta ? Math.round(score * 0.6 + pedScore * 0.4) : pedScore;
    hasPed = true;
    parts.push(`${avg.toLocaleString()} avg daily pedestrians (sensor-measured)`);
  }
  const ws = data.intel.walkscore;
  if (ws) {
    const walkVal = ws.walkscore || ws.raw?.walkscore || 50;
    hasWalk = true;
    if (!hasMta && !hasPed) {
      score = walkVal;
      parts.push(`Walk Score ${walkVal} (used as primary foot traffic proxy — no transit or pedestrian sensor data available for this block)`);
    } else {
      score = Math.round(score * 0.85 + walkVal * 0.15);
      parts.push(`Walk Score ${walkVal}`);
    }
  }
  if (!hasMta && !hasPed && !hasWalk) {
    parts.push("No foot traffic data available for this block group — score is an estimate based on nearby patterns");
    const transitScore = data.scores["six_transit"]?.score;
    if (transitScore !== void 0) {
      score = transitScore;
      parts.push(`Using pre-computed transit score of ${transitScore} as proxy`);
    }
  } else if (!hasPed && hasMta) {
    parts.push("Pedestrian sensor data not available for this block — foot traffic estimated from transit ridership and walkability");
  }
  return {
    score: clamp(score),
    explanation: parts.join(". ")
  };
}
function scoreCompetition(data, businessType) {
  let score = 50;
  const parts = [];
  const osm = data.enriched.osm_pois;
  if (osm) {
    const totalPois = osm.total_pois || 0;
    if (totalPois === 0) {
      score = 40;
      parts.push("No direct competitors found — unproven market");
    } else if (totalPois <= 5) {
      score = 85;
      parts.push(`Only ${totalPois} competitors — healthy demand signal with room`);
    } else if (totalPois <= 15) {
      score = 65;
      parts.push(`${totalPois} competitors — competitive but viable`);
    } else {
      score = Math.max(25, 65 - (totalPois - 15) * 3);
      parts.push(`${totalPois} competitors — saturated market`);
    }
  }
  const insp = data.enriched.dohmh_inspections;
  if (insp && ["restaurant", "fast-casual", "cafe", "coffee"].includes(businessType.toLowerCase())) {
    const count = insp.restaurant_count || insp.total_inspection_records || 0;
    const avgScore = insp.avg_inspection_score || 0;
    if (avgScore > 0 && avgScore < 20) {
      score = Math.round(score * 1.05);
      parts.push(`Avg health inspection score ${avgScore} — quality gap opportunity`);
    }
    parts.push(`${count} food establishments inspected nearby`);
  }
  return { score: clamp(score), explanation: parts.join(". ") || "Competition data unavailable" };
}
function scoreDemographics(data, config) {
  let score = 50;
  const parts = [];
  const census = data.intel.census_demographics;
  if (census) {
    const income = census.median_household_income || 0;
    const pop = census.total_population || 0;
    const [loIncome, hiIncome] = config.idealIncome || [4e4, 15e4];
    if (income >= loIncome && income <= hiIncome) {
      score = scoreLinear(income, loIncome * 0.5, hiIncome);
    } else if (income < loIncome) {
      score = Math.max(20, scoreLinear(income, 0, loIncome));
    } else {
      score = Math.max(40, 100 - scoreLinear(income, hiIncome, hiIncome * 2));
    }
    const education = (() => {
      const b = census.bachelors_degree || 0;
      const m = census.masters_degree || 0;
      const d = census.doctorate_degree || 0;
      const t = census.total_population || 1;
      return Math.round((b + m + d) / t * 100);
    })();
    const edScore = scoreLinear(education, 10, 60);
    const popScore = scoreLinear(pop, 1e3, 3e4);
    score = Math.round(score * 0.5 + edScore * 0.25 + popScore * 0.25);
    parts.push(`Median income $${income.toLocaleString()}, ${education}% college+, pop ${pop.toLocaleString()}`);
  }
  const housing = data.intel.census_housing;
  if (housing) {
    const rentBurden = housing.median_rent_burden_pct || 0;
    if (rentBurden > 50) {
      score = Math.round(score * 0.9);
      parts.push(`High rent burden (${rentBurden}%) — less disposable income`);
    }
  }
  return { score: clamp(score), explanation: parts.join(". ") || "Demographics data unavailable" };
}
function scoreRentFit(data, launchpad, config) {
  let score = 50;
  const parts = [];
  const housing = data.intel.census_housing;
  const userRent = parseRentBudget(launchpad.rent || launchpad.budget || "");
  const idealRent = config.idealRent || 8e3;
  if (housing?.median_gross_rent) {
    const areaRent = housing.median_gross_rent;
    parts.push(`Area median rent $${areaRent.toLocaleString()}/mo`);
    const estCommercialRent = areaRent * 4;
    if (userRent > 0) {
      const ratio = userRent / estCommercialRent;
      if (ratio >= 1.2) {
        score = 85;
        parts.push(`Your budget ($${userRent.toLocaleString()}) comfortably covers estimated commercial rent`);
      } else if (ratio >= 0.8) {
        score = 65;
        parts.push(`Your budget ($${userRent.toLocaleString()}) is tight for this area`);
      } else {
        score = 35;
        parts.push(`Your budget ($${userRent.toLocaleString()}) may be below market for this area`);
      }
    } else {
      score = scoreLinear(estCommercialRent, idealRent * 2, idealRent * 0.5);
      parts.push(`Estimated commercial rent ~$${estCommercialRent.toLocaleString()}/mo`);
    }
  }
  return { score: clamp(score), explanation: parts.join(". ") || "Rent data unavailable" };
}
function scoreNightlife(data) {
  let score = 50;
  const parts = [];
  const liquor = data.enriched.liquor_licenses;
  if (liquor) {
    const total = liquor.total_licenses || 0;
    const onPremise = (() => {
      const dist = liquor.license_type_distribution || {};
      return Object.entries(dist).filter(([k]) => k.toLowerCase().includes("op") || k.toLowerCase().includes("on_premise") || k.toLowerCase().includes("on premise")).reduce((s, [, v]) => s + v, 0);
    })();
    score = scoreLinear(onPremise, 2, 30);
    parts.push(`${total} liquor licenses (${onPremise} on-premise)`);
  }
  const cafes = data.enriched.sidewalk_cafes;
  if (cafes) {
    const count = cafes.cafe_count || 0;
    if (count > 5) score = Math.round(score * 1.1);
    parts.push(`${count} sidewalk café permits`);
  }
  return { score: clamp(score), explanation: parts.join(". ") || "Nightlife data unavailable" };
}
function scoreIncome(data, config) {
  const census = data.intel.census_demographics;
  if (!census) return { score: 50, explanation: "Income data unavailable" };
  const income = census.median_household_income || 0;
  const [lo, hi] = config.idealIncome || [5e4, 15e4];
  const score = scoreLinear(income, lo * 0.5, hi);
  return {
    score: clamp(score),
    explanation: `Median household income $${income.toLocaleString()} (ideal range: $${lo.toLocaleString()}-$${hi.toLocaleString()})`
  };
}
function scoreTransitAccess(data) {
  let score = 50;
  const parts = [];
  const mta = data.enriched.mta_ridership || data.intel.mta_ridership;
  if (mta) {
    const stations = mta.station_count_within_400m || mta.stationCount || 0;
    const ridership = mta.estimated_daily_ridership || mta.totalDailyRidership || 0;
    score = scoreLinear(stations, 0, 5) * 0.4 + scoreLinear(ridership, 1e3, 5e4) * 0.6;
    parts.push(`${stations} transit stations, ${ridership.toLocaleString()} daily riders`);
  }
  const ws = data.intel.walkscore;
  if (ws) {
    const transitScore = ws.transit_score || ws.raw?.transit?.score || 0;
    score = mta ? Math.round(score * 0.7 + transitScore * 0.3) : transitScore;
    parts.push(`Transit Score ${transitScore}`);
  }
  return { score: clamp(score), explanation: parts.join(". ") || "Transit data unavailable" };
}
function scorePopulationDensity(data) {
  const census = data.intel.census_demographics;
  if (!census) return { score: 50, explanation: "Population data unavailable" };
  const pop = census.total_population || 0;
  const score = scoreLinear(pop, 1e3, 4e4);
  return { score: clamp(score), explanation: `Population ${pop.toLocaleString()} in block group` };
}
function scoreMarketGap(data) {
  const osm = data.enriched.osm_pois;
  if (!osm) return { score: 50, explanation: "Market data unavailable" };
  const cats = osm.category_distribution || {};
  const underserved = Object.entries(cats).filter(([, v]) => v < 3).length;
  const score = underserved > 3 ? 80 : underserved > 0 ? 60 : 35;
  return {
    score: clamp(score),
    explanation: `${underserved} underserved business categories in this area`
  };
}
function scoreFamilyDensity(data) {
  const census = data.intel.census_demographics;
  if (!census) return { score: 50, explanation: "Family data unavailable" };
  const pop = census.total_population || 0;
  const medianAge = census.median_age || 35;
  const ageScore = medianAge >= 28 && medianAge <= 45 ? 80 : medianAge < 28 ? 60 : 40;
  const popScore = scoreLinear(pop, 2e3, 3e4);
  const score = Math.round(ageScore * 0.5 + popScore * 0.5);
  return { score: clamp(score), explanation: `Median age ${medianAge}, pop ${pop.toLocaleString()}` };
}
function scoreAgeDemographics(data) {
  const census = data.intel.census_demographics;
  if (!census) return { score: 50, explanation: "Age data unavailable" };
  const medianAge = census.median_age || 35;
  const score = medianAge >= 25 && medianAge <= 45 ? scoreLinear(medianAge, 20, 35) : scoreLinear(medianAge, 45, 25);
  return { score: clamp(score), explanation: `Median age ${medianAge} (ideal for nightlife: 25-45)` };
}
function scoreHealthConscious(data) {
  let score = 50;
  const parts = [];
  const census = data.intel.census_demographics;
  if (census) {
    const income = census.median_household_income || 0;
    const edu = (() => {
      const b = census.bachelors_degree || 0;
      const m = census.masters_degree || 0;
      const d = census.doctorate_degree || 0;
      const t = census.total_population || 1;
      return Math.round((b + m + d) / t * 100);
    })();
    score = Math.round(scoreLinear(income, 4e4, 12e4) * 0.5 + scoreLinear(edu, 15, 60) * 0.5);
    parts.push(`Income $${income.toLocaleString()}, ${edu}% college+`);
  }
  return { score: clamp(score), explanation: parts.join(". ") || "Health-conscious data unavailable" };
}
function scoreRenterDensity(data) {
  const housing = data.intel.census_housing;
  if (!housing) return { score: 50, explanation: "Housing data unavailable" };
  const occupied = housing.occupied_housing_units || 1;
  const ownerOcc = housing.owner_occupied || 0;
  const renterPct = Math.round((1 - ownerOcc / occupied) * 100);
  const score = scoreLinear(renterPct, 30, 90);
  return { score: clamp(score), explanation: `${renterPct}% renter-occupied (higher = more laundry demand)` };
}
function computeDimension(label, data, launchpad, config) {
  const l = label.toLowerCase();
  if (l.includes("foot traffic")) return scoreFootTraffic(data);
  if (l.includes("competition")) return scoreCompetition(data, launchpad.businessType);
  if (l.includes("demographics")) return scoreDemographics(data, config);
  if (l.includes("rent")) return scoreRentFit(data, launchpad, config);
  if (l.includes("nightlife")) return scoreNightlife(data);
  if (l.includes("dining demand")) return scoreFootTraffic(data);
  if (l.includes("area income")) return scoreIncome(data, config);
  if (l.includes("income level")) return scoreIncome(data, config);
  if (l.includes("income match")) return scoreIncome(data, config);
  if (l.includes("transit")) return scoreTransitAccess(data);
  if (l.includes("parking")) return scoreTransitAccess(data);
  if (l.includes("population")) return scorePopulationDensity(data);
  if (l.includes("market gap")) return scoreMarketGap(data);
  if (l.includes("healthcare gap")) return scoreMarketGap(data);
  if (l.includes("shopping")) return scoreCompetition(data, "retail");
  if (l.includes("family")) return scoreFamilyDensity(data);
  if (l.includes("school")) return scoreFamilyDensity(data);
  if (l.includes("age demo")) return scoreAgeDemographics(data);
  if (l.includes("license")) return scoreNightlife(data);
  if (l.includes("health-conscious")) return scoreHealthConscious(data);
  if (l.includes("daytime")) return scoreFootTraffic(data);
  if (l.includes("renter")) return scoreRenterDensity(data);
  if (l.includes("insurance")) return scoreDemographics(data, config);
  return { score: 50, explanation: "Score computed with default methodology" };
}
function applyRiskTolerance(dimensions, riskTolerance, safetyScore) {
  if (!riskTolerance) return dimensions;
  const rt = riskTolerance.toLowerCase();
  if (rt.includes("low") || rt.includes("conservative")) {
    return dimensions.map((d) => {
      if (d.label.toLowerCase().includes("competition") && d.score < 50) {
        return { ...d, score: Math.round(d.score * 0.85), explanation: d.explanation + ". Adjusted down for low risk tolerance." };
      }
      return d;
    });
  }
  if (rt.includes("high") || rt.includes("aggressive")) {
    return dimensions.map((d) => {
      if (d.label.toLowerCase().includes("competition") && d.score < 50) {
        return { ...d, score: Math.round(d.score * 1.1), explanation: d.explanation + ". Adjusted up for high risk tolerance." };
      }
      return d;
    });
  }
  return dimensions;
}
function applyExperience(fitIQ, experience) {
  if (!experience) return fitIQ;
  const exp = experience.toLowerCase();
  if (exp.includes("none") || exp.includes("first") || exp.includes("0")) {
    return Math.round(fitIQ * 0.95);
  }
  if (exp.includes("10+") || exp.includes("expert") || exp.includes("serial")) {
    return Math.round(fitIQ * 1.05);
  }
  return fitIQ;
}
function parseRentBudget(raw) {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (num > 5e4) return Math.round(num / 12);
  return Math.round(num);
}
const BUSINESS_CONFIGS = {
  // Routine Interceptor businesses — need foot traffic + habitual visits
  "specialty_coffee": {
    archetype: "routine_interceptor",
    dimensions: ["Foot Traffic Fit", "Competition Fit", "Demographics Fit", "Rent Fit"],
    dimWeights: [0.35, 0.25, 0.2, 0.2],
    idealIncome: [5e4, 15e4],
    idealRent: 8e3
  },
  "fast_casual": {
    archetype: "routine_interceptor",
    dimensions: ["Foot Traffic Fit", "Competition Fit", "Demographics Fit", "Rent Fit"],
    dimWeights: [0.3, 0.25, 0.25, 0.2],
    idealIncome: [4e4, 12e4],
    idealRent: 1e4
  },
  "bakery": {
    archetype: "routine_interceptor",
    dimensions: ["Foot Traffic Fit", "Competition Fit", "Demographics Fit", "Rent Fit"],
    dimWeights: [0.35, 0.2, 0.25, 0.2],
    idealIncome: [45e3, 13e4],
    idealRent: 7e3
  },
  "deli": {
    archetype: "routine_interceptor",
    dimensions: ["Foot Traffic Fit", "Competition Fit", "Demographics Fit", "Rent Fit"],
    dimWeights: [0.35, 0.25, 0.2, 0.2],
    idealIncome: [35e3, 1e5],
    idealRent: 6e3
  },
  "dry-cleaning": {
    archetype: "routine_interceptor",
    dimensions: ["Foot Traffic Fit", "Competition Fit", "Demographics Fit", "Rent Fit"],
    dimWeights: [0.25, 0.3, 0.25, 0.2],
    idealIncome: [5e4, 15e4],
    idealRent: 5e3
  },
  // Destination Pull businesses — people make a trip specifically for this
  "restaurant": {
    archetype: "destination_pull",
    dimensions: ["Dining Demand", "Competition Density", "Nightlife Score", "Area Income"],
    dimWeights: [0.3, 0.25, 0.2, 0.25],
    idealIncome: [6e4, 2e5],
    idealRent: 15e3
  },
  "bar": {
    archetype: "destination_pull",
    dimensions: ["Nightlife Demand", "Competition Fit", "Age Demographics", "License Density"],
    dimWeights: [0.3, 0.25, 0.25, 0.2],
    idealIncome: [5e4, 15e4],
    idealRent: 12e3
  },
  "lounge": {
    archetype: "destination_pull",
    dimensions: ["Nightlife Demand", "Competition Fit", "Age Demographics", "License Density"],
    dimWeights: [0.3, 0.25, 0.25, 0.2],
    idealIncome: [6e4, 18e4],
    idealRent: 15e3
  },
  "boutique": {
    archetype: "destination_pull",
    dimensions: ["Foot Traffic Fit", "Shopping Density", "Income Match", "Rent Fit"],
    dimWeights: [0.25, 0.25, 0.3, 0.2],
    idealIncome: [7e4, 2e5],
    idealRent: 1e4
  },
  "spa": {
    archetype: "destination_pull",
    dimensions: ["Income Level", "Competition Gap", "Parking/Transit", "Demographics"],
    dimWeights: [0.3, 0.25, 0.2, 0.25],
    idealIncome: [7e4, 2e5],
    idealRent: 8e3
  },
  "wellness": {
    archetype: "destination_pull",
    dimensions: ["Income Level", "Competition Gap", "Parking/Transit", "Demographics"],
    dimWeights: [0.3, 0.25, 0.2, 0.25],
    idealIncome: [6e4, 18e4],
    idealRent: 7e3
  },
  // Need Filler businesses — essential goods, residential demand
  "fitness": {
    archetype: "need_filler",
    dimensions: ["Health-Conscious Pop", "Competition Gap", "Parking/Transit", "Daytime Traffic"],
    dimWeights: [0.3, 0.25, 0.25, 0.2],
    idealIncome: [5e4, 15e4],
    idealRent: 8e3
  },
  "gym": {
    archetype: "need_filler",
    dimensions: ["Health-Conscious Pop", "Competition Gap", "Parking/Transit", "Daytime Traffic"],
    dimWeights: [0.3, 0.25, 0.25, 0.2],
    idealIncome: [5e4, 15e4],
    idealRent: 1e4
  },
  "retail": {
    archetype: "need_filler",
    dimensions: ["Foot Traffic", "Shopping Density", "Income Match", "Rent Fit"],
    dimWeights: [0.25, 0.25, 0.25, 0.25],
    idealIncome: [4e4, 12e4],
    idealRent: 8e3
  },
  "tutoring": {
    archetype: "need_filler",
    dimensions: ["Family Density", "School Proximity", "Transit Access", "Income Match"],
    dimWeights: [0.3, 0.25, 0.2, 0.25],
    idealIncome: [5e4, 15e4],
    idealRent: 4e3
  },
  "medical": {
    archetype: "need_filler",
    dimensions: ["Population Density", "Healthcare Gap", "Transit Access", "Insurance Demographics"],
    dimWeights: [0.25, 0.3, 0.2, 0.25],
    idealIncome: [4e4, 12e4],
    idealRent: 8e3
  },
  "dental": {
    archetype: "need_filler",
    dimensions: ["Population Density", "Healthcare Gap", "Transit Access", "Insurance Demographics"],
    dimWeights: [0.25, 0.3, 0.2, 0.25],
    idealIncome: [45e3, 13e4],
    idealRent: 7e3
  },
  "grocery": {
    archetype: "need_filler",
    dimensions: ["Population Density", "Market Gap", "Transit Access", "Rent Fit"],
    dimWeights: [0.3, 0.3, 0.15, 0.25],
    idealIncome: [3e4, 1e5],
    idealRent: 1e4
  },
  "pharmacy": {
    archetype: "need_filler",
    dimensions: ["Population Density", "Healthcare Gap", "Transit Access", "Demographics"],
    dimWeights: [0.3, 0.25, 0.2, 0.25],
    idealIncome: [35e3, 1e5],
    idealRent: 6e3
  },
  "laundromat": {
    archetype: "need_filler",
    dimensions: ["Population Density", "Market Gap", "Renter Density", "Rent Fit"],
    dimWeights: [0.25, 0.3, 0.25, 0.2],
    idealIncome: [25e3, 8e4],
    idealRent: 4e3
  }
};
const DEFAULT_CONFIG = {
  archetype: "routine_interceptor",
  dimensions: ["Foot Traffic Fit", "Competition Fit", "Demographics Fit", "Rent Fit"],
  dimWeights: [0.25, 0.25, 0.25, 0.25],
  idealIncome: [4e4, 15e4],
  idealRent: 8e3
};
function resolveConfig(businessType) {
  const key = businessType.toLowerCase().replace(/[\s\/]+/g, "-");
  return BUSINESS_CONFIGS[key] || DEFAULT_CONFIG;
}
async function loadBlockGroupData(geoid) {
  const [intelRes, enrichedRes, scoresRes] = await Promise.all([
    db.execute(sql`SELECT source, data FROM block_group_intel WHERE geoid = ${geoid}`),
    db.execute(sql`SELECT entity_category, entity_data FROM enriched_entities WHERE location_key = ${geoid} AND entity_type = 'block_group_intel'`),
    db.execute(sql`SELECT score_type, score, components FROM block_group_scores WHERE geoid = ${geoid}`)
  ]);
  const intel = {};
  if (intelRes.rows) {
    for (const row of intelRes.rows) intel[row.source] = row.data;
  }
  const enriched = {};
  if (enrichedRes.rows) {
    for (const row of enrichedRes.rows) enriched[row.entity_category] = row.entity_data;
  }
  const scores = {};
  if (scoresRes.rows) {
    for (const row of scoresRes.rows) {
      scores[row.score_type] = { score: row.score ?? 0, components: row.components ?? {} };
    }
  }
  return { intel, enriched, scores };
}
function computeFitProgress(launchpad) {
  const fields = [
    { key: "businessType", label: "business_type" },
    { key: "budget", label: "budget" },
    { key: "rent", label: "rent" },
    { key: "targetCustomer", label: "target_customer" },
    { key: "ownerType", label: "owner_type" },
    { key: "riskTolerance", label: "risk_tolerance" },
    { key: "experience", label: "experience" },
    { key: "hours", label: "hours" },
    { key: "vision", label: "vision" }
  ];
  const missing = [];
  let filled = 0;
  for (const f of fields) {
    const val = launchpad[f.key];
    if (val && String(val).trim()) filled++;
    else missing.push(f.label);
  }
  return { progress: Math.round(filled / fields.length * 100), missing };
}
function applyDynamicOverrides(staticConfig, dynamic) {
  const merged = { ...staticConfig };
  merged.idealIncome = [dynamic.incomeMin, dynamic.incomeSweet];
  merged.archetype = dynamic.archetype;
  if (dynamic.weightOverrides) {
    const wo = dynamic.weightOverrides;
    const newWeights = [...merged.dimWeights];
    for (let i = 0; i < merged.dimensions.length; i++) {
      const label = merged.dimensions[i].toLowerCase();
      if (wo.competition !== void 0 && label.includes("competition")) {
        newWeights[i] = wo.competition;
      }
      if (wo.demographics !== void 0 && (label.includes("demographics") || label.includes("income"))) {
        newWeights[i] = wo.demographics;
      }
      if (wo.accessibility !== void 0 && (label.includes("foot traffic") || label.includes("transit") || label.includes("parking"))) {
        newWeights[i] = wo.accessibility;
      }
      if (wo.vibrancy !== void 0 && (label.includes("nightlife") || label.includes("dining"))) {
        newWeights[i] = wo.vibrancy;
      }
    }
    const sum = newWeights.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      merged.dimWeights = newWeights.map((w) => w / sum);
    }
  }
  return merged;
}
async function computeFitIQ(geoid, launchpad) {
  let config = resolveConfig(launchpad.businessType);
  let dynamicConfig = null;
  if (launchpad.conceptAnswers && Object.keys(launchpad.conceptAnswers).length > 0) {
    try {
      dynamicConfig = buildDynamicConfig(launchpad.businessType, launchpad.conceptAnswers);
      config = applyDynamicOverrides(config, dynamicConfig);
    } catch (err) {
      console.warn("[FitIQ] Dynamic config build failed, using static config:", err instanceof Error ? err.message : err);
    }
  }
  const data = await loadBlockGroupData(geoid);
  const locationIQ = data.scores["location_iq"]?.score ?? 50;
  const archetypeKey = config.archetype === "routine_interceptor" ? "archetype_routine_interceptor" : config.archetype === "destination_pull" ? "archetype_destination_pull" : "archetype_need_filler";
  const archetypeScore = data.scores[archetypeKey]?.score ?? 50;
  data.scores["six_safety"]?.score ?? 70;
  let dimensions = config.dimensions.map((label, i) => {
    const { score, explanation } = computeDimension(label, data, launchpad, config);
    return { label, score, weight: config.dimWeights[i], explanation };
  });
  if (dynamicConfig) {
    dimensions = dimensions.map((d) => {
      const label = d.label.toLowerCase();
      if (label.includes("foot traffic") || label.includes("dining demand") || label.includes("daytime")) {
        const dep = dynamicConfig.footTrafficDependency;
        const adjusted = Math.round(d.score * dep + 60 * (1 - dep));
        return {
          ...d,
          score: clamp(adjusted),
          explanation: d.explanation + ` (foot traffic dependency: ${Math.round(dep * 100)}%)`
        };
      }
      if (label.includes("transit") || label.includes("parking")) {
        const dep = dynamicConfig.transitDependency;
        const adjusted = Math.round(d.score * dep + 60 * (1 - dep));
        return {
          ...d,
          score: clamp(adjusted),
          explanation: d.explanation + ` (transit dependency: ${Math.round(dep * 100)}%)`
        };
      }
      return d;
    });
  }
  dimensions = applyRiskTolerance(dimensions, launchpad.riskTolerance || "");
  dimensions = dimensions.map((d) => ({
    ...d,
    score: expandVariance(d.score, 1.5)
  }));
  let rawFitIQ = 0;
  for (const d of dimensions) {
    rawFitIQ += d.score * d.weight;
  }
  const neighborhoodHealth = data.scores["six_neighborhood_health"]?.score;
  const survivalRate = data.scores["six_survival_rate"]?.score;
  const conceptType = resolveConceptType(launchpad.businessType);
  const haloScore = data.scores[`halo:${conceptType}`]?.score ?? data.scores["halo:general"]?.score;
  let neighborhoodBlend = 50;
  let neighborhoodSignals = 0;
  if (neighborhoodHealth != null) {
    neighborhoodBlend = neighborhoodHealth;
    neighborhoodSignals++;
  }
  if (survivalRate != null) {
    neighborhoodBlend = neighborhoodSignals > 0 ? Math.round(neighborhoodBlend * 0.45 + survivalRate * 0.55) : survivalRate;
    neighborhoodSignals++;
  }
  if (neighborhoodSignals > 0 && haloScore != null && haloScore > 40) {
    rawFitIQ = Math.round(
      rawFitIQ * 0.5 + neighborhoodBlend * 0.2 + archetypeScore * 0.1 + haloScore * 0.2
    );
  } else if (neighborhoodSignals > 0) {
    rawFitIQ = Math.round(
      rawFitIQ * 0.55 + neighborhoodBlend * 0.25 + archetypeScore * 0.2
    );
  } else {
    rawFitIQ = Math.round(rawFitIQ * 0.7 + archetypeScore * 0.3);
  }
  rawFitIQ = applyExperience(rawFitIQ, launchpad.experience || "");
  const fitIQ = expandVariance(clamp(rawFitIQ), 1.55);
  const { progress, missing } = computeFitProgress(launchpad);
  return {
    fitIQ,
    grade: scoreToGrade(fitIQ),
    dimensions,
    fitProgress: progress,
    missingFields: missing,
    alignment: fitIQ - locationIQ,
    archetype: config.archetype.replace(/_/g, " "),
    archetypeScore,
    ...dynamicConfig ? { dynamicConfigApplied: true } : {},
    // V5 neighborhood intelligence (for transparency in UI)
    neighborhoodIntel: {
      neighborhoodHealth: neighborhoodHealth ?? null,
      survivalRate: survivalRate ?? null,
      haloScore: haloScore ?? null,
      haloConceptType: conceptType,
      neighborhoodBlendWeight: neighborhoodSignals > 0 ? haloScore != null && haloScore > 40 ? 0.2 : 0.25 : 0,
      haloBlendWeight: neighborhoodSignals > 0 && haloScore != null && haloScore > 40 ? 0.2 : 0
    }
  };
}
export {
  computeFitIQ as c
};
