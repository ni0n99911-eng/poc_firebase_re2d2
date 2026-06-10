import { f as fetchCensusData, a as fetchCensusHousing, b as fetchWalkScore, c as fetchInspections, d as fetchCrimeData, s as scanCompetitors, e as fetchMTARidership, g as fetchLPCData, h as fetchDCALicenses, i as fetchDOBData, j as fetch311Complaints, k as fetchPedestrianCounts, l as fetchPLUTOData, m as fetchSidewalkCafes, n as fetchLiquorLicenses, o as fetchYelpData, p as fetchMomentumData } from "../../../../chunks/yelp.js";
import { a as fetchNearbyPlaces, b as fetchMarketDensity, f as fetchFoursquareData } from "../../../../chunks/foursquare.js";
function auditField(field, value, reliability, plausibilityCheck, note) {
  const populated = value !== null && value !== void 0 && value !== "" && value !== 0 && !(Array.isArray(value) && value.length === 0);
  const plausible = populated ? plausibilityCheck ? plausibilityCheck(value) : true : true;
  return { field, value: summarizeValue(value), populated, reliability, plausible, note: note || (plausible ? void 0 : "FAILED PLAUSIBILITY CHECK") };
}
function summarizeValue(v) {
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === "object" && v !== null) {
    const keys = Object.keys(v);
    if (keys.length > 5) return `{${keys.length} keys: ${keys.slice(0, 5).join(", ")}...}`;
    return v;
  }
  return v;
}
async function validateCensus(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchCensusData(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "Census Demographics", endpoint: "api.census.gov/data/2022/acs/acs5", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("medianHouseholdIncome", data.medianHouseholdIncome, "REAL_API", (v) => typeof v === "number" && v > 0 && v < 5e5),
      auditField("totalPopulation", data.totalPopulation, "REAL_API", (v) => typeof v === "number" && v > 0),
      auditField("populationDensity", data.populationDensity, "COMPUTED", (v) => typeof v === "number" && v > 0, "Derived from totalPop / estimated area (~0.3-1.5 sq mi)"),
      auditField("medianAge", data.medianAge, "REAL_API", (v) => typeof v === "number" && v > 15 && v < 90),
      auditField("bachelorsPlusPercent", data.bachelorsPlusPercent, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("commuterPercent", data.commuterPercent, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("daytimePopulationRatio", data.daytimePopulationRatio, "COMPUTED", (v) => typeof v === "number" && v > 0),
      auditField("tractId", data.tractId, "REAL_API")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "Census Demographics",
      endpoint: "api.census.gov/data/2022/acs/acs5",
      status: populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "SPENDING_POWER: medianHouseholdIncome → price point viability",
        "EDUCATION_PROXY: bachelorsPlusPercent → specialty/artisanal concept fit",
        "COMMUTER_DENSITY: commuterPercent → transit-dependent foot traffic",
        "DAYTIME_SURGE: daytimePopulationRatio → lunch/coffee demand multiplier",
        "AGE_TARGETING: medianAge → concept demographic fit"
      ],
      crossSourceLinks: [
        "WALKSCORE: transitScore validates commuterPercent",
        "MTA: stationCount validates commuter corridor assertion",
        "YELP: avgPriceLevel validates spending power inference",
        "PLUTO: zoneProfile validates residential vs commercial mix"
      ]
    };
  } catch (e) {
    return { source: "Census Demographics", endpoint: "api.census.gov/data/2022/acs/acs5", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateCensusHousing(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchCensusHousing(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "Census Housing", endpoint: "api.census.gov/data/2022/acs/acs5", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("medianGrossRent", data.medianGrossRent, "REAL_API", (v) => typeof v === "number" && v > 0 && v < 1e4),
      auditField("medianMonthlyHousingCost", data.medianMonthlyHousingCost, "REAL_API", (v) => typeof v === "number" && v > 0),
      auditField("rentBurdenedPct", data.rentBurdenedPct, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("vacancyRate", data.vacancyRate, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("ownerOccupiedPct", data.ownerOccupiedPct, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("renterOccupiedPct", data.renterOccupiedPct, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("totalHousingUnits", data.totalHousingUnits, "REAL_API", (v) => typeof v === "number" && v > 0),
      auditField("builtBefore1950Pct", data.builtBefore1950Pct, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("builtAfter2010Pct", data.builtAfter2010Pct, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100)
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "Census Housing",
      endpoint: "api.census.gov/data/2022/acs/acs5",
      status: populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "RENT_PROXY: medianGrossRent → commercial lease affordability estimate",
        "STABILITY: ownerOccupiedPct → neighborhood turnover risk",
        "GENTRIFICATION: builtAfter2010Pct + rentBurdenedPct → displacement risk",
        "VACANCY_OPPORTUNITY: vacancyRate → available commercial space signal",
        "BUILDING_AGE: builtBefore1950Pct → renovation cost / character indicator"
      ],
      crossSourceLinks: [
        "PLUTO: assessTotal validates rent proxy",
        "DOB: permitCount validates gentrification signal",
        "DCA: newBusinessRate validates neighborhood change"
      ]
    };
  } catch (e) {
    return { source: "Census Housing", endpoint: "api.census.gov/data/2022/acs/acs5", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateWalkScore(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchWalkScore(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "WalkScore", endpoint: "api.walkscore.com/score", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const isEstimated = data.source === "walkscore-estimate";
    const fields = [
      auditField("walkScore", data.walkScore, isEstimated ? "ESTIMATED" : "REAL_API", (v) => typeof v === "number" && v >= 0 && v <= 100, isEstimated ? "Estimated from Overpass POI count" : void 0),
      auditField("transitScore", data.transitScore, isEstimated ? "ESTIMATED" : "REAL_API", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("bikeScore", data.bikeScore, isEstimated ? "ESTIMATED" : "REAL_API", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("source", data.source, "HARDCODED")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "WalkScore",
      endpoint: "api.walkscore.com/score",
      status: isEstimated ? "PARTIAL" : populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "WALKABILITY: walkScore → foot traffic potential (primary for coffee/bakery)",
        "TRANSIT_ACCESS: transitScore → commuter concept viability",
        "BIKE_ACCESS: bikeScore → cycling culture fit (juice bars, bike shops)"
      ],
      crossSourceLinks: [
        "MTA: transitScore should correlate with station proximity",
        "PEDESTRIAN: footTrafficScore should correlate with walkScore",
        "GOOGLE_PLACES: totalNearby should correlate with walkScore"
      ]
    };
  } catch (e) {
    return { source: "WalkScore", endpoint: "api.walkscore.com/score", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateInspections(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchInspections(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "NYC Inspections", endpoint: "data.cityofnewyork.us/43nn-pn8j", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("totalNearby", data.totalNearby, "REAL_API", (v) => typeof v === "number" && v >= 0),
      auditField("restaurants", data.restaurants, "REAL_API"),
      auditField("gradeDistribution", data.gradeDistribution, "COMPUTED"),
      auditField("cuisineBreakdown", data.cuisineBreakdown, "COMPUTED"),
      auditField("avgScore", data.avgScore, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v < 100)
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "NYC Inspections",
      endpoint: "data.cityofnewyork.us/43nn-pn8j",
      status: populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "FOOD_DENSITY: totalNearby → restaurant saturation signal",
        "AREA_HEALTH: gradeDistribution → neighborhood quality proxy",
        "CUISINE_GAP: cuisineBreakdown → underserved cuisine opportunity",
        "COMPETITOR_QUALITY: avgScore → competitor maintenance standards"
      ],
      crossSourceLinks: [
        "YELP: restaurant ratings should inversely correlate with avgScore (lower inspection score = better)",
        "GOOGLE_PLACES: restaurant count should roughly match totalNearby",
        "LIQUOR: onPremiseCount should correlate with restaurant count"
      ],
      rawDataSample: data.restaurants?.slice(0, 3)
    };
  } catch (e) {
    return { source: "NYC Inspections", endpoint: "data.cityofnewyork.us/43nn-pn8j", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateCrime(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchCrimeData(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "NYPD Crime", endpoint: "data.cityofnewyork.us/5uac-w243", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("totalCount", data.totalCount, "REAL_API", (v) => typeof v === "number" && v >= 0),
      auditField("violentCount", data.violentCount, "COMPUTED"),
      auditField("propertyCount", data.propertyCount, "COMPUTED"),
      auditField("crimeScore", data.crimeScore, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("densityPerSqMi", data.densityPerSqMi, "COMPUTED"),
      auditField("topTypes", data.topTypes, "COMPUTED"),
      auditField("incidents", data.incidents, "REAL_API")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "NYPD Crime",
      endpoint: "data.cityofnewyork.us/5uac-w243",
      status: populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "SAFETY_SCORE: crimeScore → location safety for customers/staff",
        "VIOLENT_RATIO: violentCount/totalCount → severity profile",
        "TIME_SAFETY: incident dates → after-hours safety (CROSS with business hours)",
        "PROPERTY_RISK: propertyCount → theft/vandalism risk for inventory businesses",
        "NIGHT_ECONOMY: low crime after 6pm → safe for dinner/bar concepts"
      ],
      crossSourceLinks: [
        "311: safetyCount should loosely correlate",
        "YELP/FOURSQUARE: business hours → CROSS with crime timing for after-hours risk",
        "LIQUOR: nightlifeDensity + crime timing → nightlife safety profile"
      ],
      rawDataSample: data.topTypes?.slice(0, 5)
    };
  } catch (e) {
    return { source: "NYPD Crime", endpoint: "data.cityofnewyork.us/5uac-w243", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateGooglePlaces(lat, lng, type) {
  const start = Date.now();
  try {
    const data = await fetchNearbyPlaces(lat, lng, type);
    const ms = Date.now() - start;
    if (!data) return { source: "Google Places", endpoint: "maps.googleapis.com/nearbysearch", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const isOverpass = data.source === "overpass-fallback";
    const fields = [
      auditField("totalNearby", data.totalNearby, "REAL_API"),
      auditField("avgRating", data.avgRating, isOverpass ? "STUB" : "REAL_API", (v) => typeof v === "number" && v > 0 && v <= 5, isOverpass ? "No ratings from Overpass fallback" : void 0),
      auditField("avgPriceLevel", data.avgPriceLevel, isOverpass ? "STUB" : "REAL_API", void 0, isOverpass ? "No price data from Overpass" : void 0),
      auditField("avgReviewCount", data.avgReviewCount, isOverpass ? "STUB" : "REAL_API"),
      auditField("chainCount", data.chainCount, "COMPUTED"),
      auditField("independentCount", data.independentCount, "COMPUTED"),
      auditField("topRated", data.topRated, isOverpass ? "STUB" : "COMPUTED"),
      auditField("source", data.source, "HARDCODED"),
      auditField("places", data.places, "REAL_API")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "Google Places",
      endpoint: isOverpass ? "overpass-api.de (fallback)" : "maps.googleapis.com/nearbysearch",
      status: isOverpass ? "PARTIAL" : populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "COMPETITION_DENSITY: totalNearby → market saturation",
        "QUALITY_BENCHMARK: avgRating → area quality floor/ceiling",
        "PRICE_POSITIONING: avgPriceLevel → pricing strategy validation",
        "CHAIN_VS_INDIE: chainCount/independentCount → market character",
        "REVIEW_VELOCITY: avgReviewCount → customer engagement level"
      ],
      crossSourceLinks: [
        "YELP: ratings should roughly agree (Google 1-5, Yelp 1-5)",
        "FOURSQUARE: venue count should correlate with totalNearby",
        "INSPECTIONS: restaurant count should roughly match food places",
        "OVERPASS: OSM data validates existence of reported places"
      ],
      rawDataSample: data.places?.slice(0, 3).map((p) => ({ name: p.name, rating: p.rating, priceLevel: p.priceLevel, distance: p.distance, types: p.types?.slice(0, 3) }))
    };
  } catch (e) {
    return { source: "Google Places", endpoint: "maps.googleapis.com/nearbysearch", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateMarketDensity(lat, lng, type) {
  const start = Date.now();
  try {
    const data = await fetchMarketDensity(lat, lng, type);
    const ms = Date.now() - start;
    if (!data) return { source: "Market Density", endpoint: "maps.googleapis.com (multi-category)", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("totalBusinesses", data.totalBusinesses, "REAL_API"),
      auditField("commercialVitality", data.commercialVitality, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("dominantCategory", data.dominantCategory, "COMPUTED"),
      auditField("avgOverallRating", data.avgOverallRating, "COMPUTED"),
      auditField("categories", data.categories, "REAL_API")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "Market Density",
      endpoint: "maps.googleapis.com (8 category scans)",
      status: populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "COMMERCIAL_ECOSYSTEM: commercialVitality → is this a commercial corridor?",
        "CATEGORY_GAP: categories → what business types are missing?",
        "FORCE_MULTIPLIER: dominantCategory → what anchor tenants drive traffic?",
        "CLUSTERING: category distribution → co-tenancy patterns"
      ],
      crossSourceLinks: [
        "PLUTO: zoneProfile commercial % should match density",
        "DCA: totalCount should loosely match totalBusinesses",
        "FOURSQUARE: category diversity should match"
      ],
      rawDataSample: data.categories?.map((c) => ({ category: c.category, count: c.count, avgRating: c.avgRating, chainPct: c.chainPct }))
    };
  } catch (e) {
    return { source: "Market Density", endpoint: "maps.googleapis.com", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateOverpass(lat, lng, type) {
  const start = Date.now();
  try {
    const data = await scanCompetitors(lat, lng, type);
    const ms = Date.now() - start;
    if (!data) return { source: "Overpass (Competitors)", endpoint: "overpass-api.de", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("totalCount", data.totalCount, "REAL_API"),
      auditField("chainCount", data.chainCount, "COMPUTED"),
      auditField("independentCount", data.independentCount, "COMPUTED"),
      auditField("saturationScore", data.saturationScore, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("rings.ring1", data.rings?.ring1, "REAL_API"),
      auditField("rings.ring2", data.rings?.ring2, "REAL_API"),
      auditField("rings.ring3", data.rings?.ring3, "REAL_API"),
      auditField("stations", data.stations, "REAL_API"),
      auditField("competitors", data.competitors, "REAL_API")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "Overpass (Competitors)",
      endpoint: "overpass-api.de",
      status: populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "RING_ANALYSIS: ring1/2/3 → distance-weighted competition pressure",
        "CHAIN_DOMINANCE: chainCount → corporate vs independent market",
        "TRANSIT_PROXIMITY: stations → actual walking distance to transit",
        "SATURATION: saturationScore → market capacity"
      ],
      crossSourceLinks: [
        "GOOGLE_PLACES: totalNearby should roughly match competitor count",
        "FOURSQUARE: directCompetitors should correlate",
        "YELP: directCompetitors count should correlate",
        "MTA: station list should match stations from Overpass"
      ]
    };
  } catch (e) {
    return { source: "Overpass (Competitors)", endpoint: "overpass-api.de", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateMTA(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchMTARidership(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "MTA Ridership", endpoint: "data.ny.gov/5f5g-n3cz", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("stationCount", data.stationCount, "REAL_API"),
      auditField("routes", data.routes, "REAL_API"),
      auditField("totalDailyRidership", data.totalDailyRidership, "ESTIMATED", (v) => typeof v === "number" && v > 0, "ESTIMATED from route count heuristic, NOT real ridership data"),
      auditField("avgDailyRidership", data.avgDailyRidership, "ESTIMATED", void 0, "Derived from estimated totalDailyRidership"),
      auditField("peakHourRatio", data.peakHourRatio, "HARDCODED", void 0, "Fixed at 0.40 — NYC standard assumption"),
      auditField("transitScore", data.transitScore, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("stations", data.stations, "REAL_API")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "MTA Ridership",
      endpoint: "data.ny.gov/5f5g-n3cz",
      status: populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "STATION_ACCESS: stationCount → transit accessibility (REAL)",
        "LINE_DIVERSITY: routes → direction coverage (REAL)",
        "RIDERSHIP_PROXY: totalDailyRidership → foot traffic estimate (ESTIMATED — USE WITH CAUTION)",
        "COMMUTER_CORRIDOR: 4+ lines → hub station = high commuter through-traffic"
      ],
      crossSourceLinks: [
        "WALKSCORE: transitScore should correlate with MTA transitScore",
        "OVERPASS: station list should match",
        "PEDESTRIAN: footTrafficScore should loosely correlate near stations",
        "CENSUS: commuterPercent validates transit dependency"
      ]
    };
  } catch (e) {
    return { source: "MTA Ridership", endpoint: "data.ny.gov/5f5g-n3cz", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateLPC(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchLPCData(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "NYC Landmarks", endpoint: "data.cityofnewyork.us/buis-pvji", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("isHistoricDistrict", data.isHistoricDistrict, "REAL_API"),
      auditField("districtName", data.districtName, "REAL_API"),
      auditField("nearbyLandmarks", data.nearbyLandmarks, "REAL_API"),
      auditField("signageRestrictions", data.signageRestrictions, "COMPUTED"),
      auditField("buildingStatus", data.buildingStatus, "COMPUTED")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "NYC Landmarks",
      endpoint: "data.cityofnewyork.us/buis-pvji",
      status: populated >= 3 ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "SIGNAGE_RISK: isHistoricDistrict → branding/signage restrictions",
        "RENOVATION_COST: buildingStatus → exterior alteration limits",
        "CHARACTER: nearbyLandmarks → neighborhood prestige signal"
      ],
      crossSourceLinks: [
        "PLUTO: yearBuilt should correlate with historic status",
        "DOB: permit restrictions in historic zones"
      ]
    };
  } catch (e) {
    return { source: "NYC Landmarks", endpoint: "data.cityofnewyork.us/buis-pvji", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateDCA(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchDCALicenses(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "DCA Licenses", endpoint: "data.cityofnewyork.us/w7w3-xahh", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("totalCount", data.totalCount, "REAL_API"),
      auditField("industryBreakdown", data.industryBreakdown, "COMPUTED"),
      auditField("newBusinessRate", data.newBusinessRate, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("businessDensity", data.businessDensity, "COMPUTED"),
      auditField("ecosystemScore", data.ecosystemScore, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100)
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "DCA Licenses",
      endpoint: "data.cityofnewyork.us/w7w3-xahh",
      status: populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "CHURN_SIGNAL: newBusinessRate → neighborhood dynamism / instability",
        "ECOSYSTEM: industryBreakdown → business mix health",
        "DENSITY: businessDensity → commercial activity level"
      ],
      crossSourceLinks: [
        "MOMENTUM: dcaTrend validates churn direction",
        "MARKET_DENSITY: totalBusinesses should loosely correlate",
        "CENSUS_HOUSING: vacancyRate inversely related to business density"
      ]
    };
  } catch (e) {
    return { source: "DCA Licenses", endpoint: "data.cityofnewyork.us/w7w3-xahh", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateDOB(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchDOBData(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "DOB Permits", endpoint: "data.cityofnewyork.us/ipu4-2q9a", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("permitCount", data.permitCount, "REAL_API"),
      auditField("newBuildingCount", data.newBuildingCount, "COMPUTED"),
      auditField("demolitionCount", data.demolitionCount, "COMPUTED"),
      auditField("developmentScore", data.developmentScore, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("activeViolationCount", data.activeViolationCount, "REAL_API", void 0, "Violations query currently returns empty (geo filter broken)"),
      auditField("riskScore", data.riskScore, "COMPUTED"),
      auditField("permits", data.permits, "REAL_API"),
      auditField("violations", data.violations, "STUB", void 0, "DOB violations dataset geo query not working — returns empty")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "DOB Permits",
      endpoint: "data.cityofnewyork.us/ipu4-2q9a",
      status: populated >= 5 ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "DEVELOPMENT_VELOCITY: permitCount → area growth/change rate",
        "NEW_CONSTRUCTION: newBuildingCount → gentrification / rising area",
        "DEMOLITION: demolitionCount → area in transition (opportunity or risk)",
        "BUILDING_RISK: riskScore → potential structural issues (WEAK — violations broken)"
      ],
      crossSourceLinks: [
        "MOMENTUM: dobTrend validates permit direction",
        "PLUTO: developmentPotential should correlate with permits",
        "CENSUS_HOUSING: builtAfter2010Pct validates new construction"
      ]
    };
  } catch (e) {
    return { source: "DOB Permits", endpoint: "data.cityofnewyork.us/ipu4-2q9a", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validate311(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetch311Complaints(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "311 Complaints", endpoint: "data.cityofnewyork.us/erm2-nwe9", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("totalCount", data.totalCount, "REAL_API"),
      auditField("noiseCount", data.noiseCount, "COMPUTED"),
      auditField("sanitationCount", data.sanitationCount, "COMPUTED"),
      auditField("safetyCount", data.safetyCount, "COMPUTED"),
      auditField("qualityScore", data.qualityScore, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("topTypes", data.topTypes, "COMPUTED")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "311 Complaints",
      endpoint: "data.cityofnewyork.us/erm2-nwe9",
      status: populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "NOISE_RISK: noiseCount/totalCount → noise sensitivity for concepts needing quiet",
        "SANITATION: sanitationCount → cleanliness / pest risk for food businesses",
        "NEIGHBORHOOD_QUALITY: qualityScore → livability proxy",
        "COMPLAINT_TRENDING: CROSS with MOMENTUM complaintsTrend → improving or degrading?"
      ],
      crossSourceLinks: [
        "CRIME: safetyCount should loosely correlate with crime",
        "MOMENTUM: complaintsTrend validates direction",
        "INSPECTIONS: sanitation issues may correlate with low inspection grades nearby"
      ]
    };
  } catch (e) {
    return { source: "311 Complaints", endpoint: "data.cityofnewyork.us/erm2-nwe9", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validatePedestrian(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchPedestrianCounts(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "Pedestrian Counts", endpoint: "data.cityofnewyork.us/7ym2-wayt", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("totalPedestrians", data.totalPedestrians, "REAL_API", (v) => typeof v === "number" && v >= 0),
      auditField("avgAMCount", data.avgAMCount, "ESTIMATED", void 0, "AM/PM split is assumed 45%/55%, not real measured data"),
      auditField("avgPMCount", data.avgPMCount, "ESTIMATED"),
      auditField("peakRatio", data.peakRatio, "ESTIMATED"),
      auditField("footTrafficScore", data.footTrafficScore, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("countLocationCount", data.countLocationCount, "REAL_API"),
      auditField("counts", data.counts, "REAL_API", void 0, "Data is borough-approximated, not address-precise")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "Pedestrian Counts",
      endpoint: "data.cityofnewyork.us/7ym2-wayt",
      status: populated >= 4 ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "FOOT_TRAFFIC: totalPedestrians → raw walking volume (BOROUGH-LEVEL, not address)",
        "AM_VS_PM: peakRatio → morning vs evening bias (ESTIMATED, not measured)",
        "WALK_DENSITY: footTrafficScore → walkability proxy"
      ],
      crossSourceLinks: [
        "WALKSCORE: walkScore should correlate with footTrafficScore",
        "MTA: ridership should correlate with pedestrian volume near stations",
        "GOOGLE_PLACES: more businesses = more foot traffic"
      ]
    };
  } catch (e) {
    return { source: "Pedestrian Counts", endpoint: "data.cityofnewyork.us/7ym2-wayt", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validatePLUTO(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchPLUTOData(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "PLUTO Tax Lots", endpoint: "data.cityofnewyork.us/64uk-42ks", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("nearestLot", data.nearestLot ? "present" : null, "REAL_API"),
      auditField("zoneProfile", data.zoneProfile, "COMPUTED"),
      auditField("buildingProfile", data.buildingProfile, "COMPUTED"),
      auditField("developmentPotential", data.developmentPotential, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("lots", data.lots, "REAL_API")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "PLUTO Tax Lots",
      endpoint: "data.cityofnewyork.us/64uk-42ks",
      status: populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "ZONING: zoneProfile → what can legally operate here",
        "FAR_HEADROOM: developmentPotential → future construction risk/opportunity",
        "RETAIL_SQFT: buildingProfile.totalRetailSqFt → available commercial space",
        "BUILDING_AGE: buildingProfile.avgYearBuilt → renovation cost indicator",
        "ASSESSED_VALUE: → commercial rent proxy"
      ],
      crossSourceLinks: [
        "CENSUS_HOUSING: rent data should correlate with assessed values",
        "DOB: permits should appear in high developmentPotential areas",
        "LPC: historic buildings should have old yearBuilt"
      ]
    };
  } catch (e) {
    return { source: "PLUTO Tax Lots", endpoint: "data.cityofnewyork.us/64uk-42ks", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateSidewalkCafes(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchSidewalkCafes(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "Sidewalk Cafes", endpoint: "data.cityofnewyork.us/qcdj-rwhu", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("totalCount", data.totalCount, "REAL_API"),
      auditField("activeCount", data.activeCount, "COMPUTED"),
      auditField("totalSeatingCapacity", data.totalSeatingCapacity, "REAL_API"),
      auditField("vibrancySignal", data.vibrancySignal, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("typeBreakdown", data.typeBreakdown, "COMPUTED")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "Sidewalk Cafes",
      endpoint: "data.cityofnewyork.us/qcdj-rwhu",
      status: populated >= 3 ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "OUTDOOR_CULTURE: totalCount → street-level vibrancy",
        "SEATING_CAPACITY: → dining corridor signal",
        "VIBRANCY: vibrancySignal → pedestrian-friendly streetscape"
      ],
      crossSourceLinks: [
        "LIQUOR: on-premise licenses should correlate with sidewalk cafes",
        "INSPECTIONS: restaurant count should correlate",
        "WALKSCORE: walkScore should be high where sidewalk cafes exist"
      ]
    };
  } catch (e) {
    return { source: "Sidewalk Cafes", endpoint: "data.cityofnewyork.us/qcdj-rwhu", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateLiquor(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchLiquorLicenses(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "Liquor Licenses", endpoint: "data.ny.gov/9s3h-dpkz", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("totalCount", data.totalCount, "REAL_API"),
      auditField("onPremiseCount", data.onPremiseCount, "COMPUTED"),
      auditField("offPremiseCount", data.offPremiseCount, "COMPUTED"),
      auditField("restaurantWineCount", data.restaurantWineCount, "COMPUTED"),
      auditField("nightlifeDensity", data.nightlifeDensity, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("vibrancySignal", data.vibrancySignal, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("typeBreakdown", data.typeBreakdown, "COMPUTED")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "Liquor Licenses",
      endpoint: "data.ny.gov/9s3h-dpkz",
      status: populated === fields.length ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "NIGHTLIFE_DENSITY: onPremiseCount → evening economy strength",
        "BAR_SATURATION: nightlifeDensity → competition for bar/restaurant concepts",
        "DINING_CORRIDOR: restaurantWineCount → food-focused area signal",
        "ALCOHOL_COMPLIANCE: license availability → SLA application difficulty"
      ],
      crossSourceLinks: [
        "CRIME: nightlifeDensity + crime timing → nightlife safety",
        "INSPECTIONS: restaurant count should correlate with on-premise licenses",
        "SIDEWALK_CAFES: outdoor dining correlates with liquor licenses",
        "YELP/FOURSQUARE: bar/restaurant counts should match"
      ]
    };
  } catch (e) {
    return { source: "Liquor Licenses", endpoint: "data.ny.gov/9s3h-dpkz", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateFoursquare(lat, lng, type) {
  const start = Date.now();
  try {
    const data = await fetchFoursquareData(lat, lng, type);
    const ms = Date.now() - start;
    if (!data) return { source: "Foursquare", endpoint: "places-api.foursquare.com", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("totalCount", data.totalCount, "REAL_API"),
      auditField("directCompetitors", data.directCompetitors, "REAL_API"),
      auditField("chainCount", data.chainCount, "COMPUTED"),
      auditField("independentCount", data.independentCount, "COMPUTED"),
      auditField("avgPopularity", data.avgPopularity, "REAL_API", (v) => typeof v === "number" && v >= 0 && v <= 1, "Foursquare proprietary popularity metric"),
      auditField("highTrafficVenues", data.highTrafficVenues, "COMPUTED"),
      auditField("peakTrafficScore", data.peakTrafficScore, "COMPUTED"),
      auditField("avgRating", data.avgRating, "REAL_API", (v) => typeof v === "number" && v >= 0 && v <= 10, "Foursquare uses 1-10 scale"),
      auditField("avgPriceLevel", data.avgPriceLevel, "REAL_API"),
      auditField("categoryBreakdown", data.categoryBreakdown, "COMPUTED"),
      auditField("categoryDiversity", data.categoryDiversity, "COMPUTED")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "Foursquare",
      endpoint: "places-api.foursquare.com",
      status: populated >= 7 ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "POPULARITY: avgPopularity → real check-in based traffic signal (UNIQUE to Foursquare)",
        "PEAK_TRAFFIC: highTrafficVenues → identifies high-draw anchors",
        "CHAIN_MARKET: chainCount → corporate competition level",
        "CATEGORY_MIX: categoryDiversity → neighborhood commercial character",
        "PRICE_POINT: avgPriceLevel → area price expectations"
      ],
      crossSourceLinks: [
        "GOOGLE_PLACES: venue counts and ratings should roughly agree",
        "YELP: ratings should correlate (Foursquare 1-10, Yelp 1-5 → normalize)",
        "OVERPASS: competitor counts should be in same range"
      ]
    };
  } catch (e) {
    return { source: "Foursquare", endpoint: "places-api.foursquare.com", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateYelp(lat, lng, type) {
  const start = Date.now();
  try {
    const data = await fetchYelpData(lat, lng, type);
    const ms = Date.now() - start;
    if (!data) return { source: "Yelp", endpoint: "api.yelp.com/v3/businesses/search", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("totalCount", data.totalCount, "REAL_API"),
      auditField("directCompetitors", data.directCompetitors, "COMPUTED"),
      auditField("avgRating", data.avgRating, "REAL_API", (v) => typeof v === "number" && v > 0 && v <= 5),
      auditField("avgReviewCount", data.avgReviewCount, "REAL_API"),
      auditField("avgPriceLevel", data.avgPriceLevel, "REAL_API"),
      auditField("chainCount", data.chainCount, "COMPUTED"),
      auditField("independentCount", data.independentCount, "COMPUTED"),
      auditField("topRated", data.topRated, "COMPUTED"),
      auditField("categoryBreakdown", data.categoryBreakdown, "COMPUTED"),
      auditField("businesses", data.businesses, "REAL_API")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "Yelp",
      endpoint: "api.yelp.com/v3/businesses/search",
      status: populated >= 7 ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "REVIEW_DEPTH: avgReviewCount → customer engagement / brand loyalty signal",
        "QUALITY_FLOOR: avgRating → minimum quality expectation in area",
        "PRICE_POINT: avgPriceLevel → pricing strategy (Yelp $ to $$$$ = most reliable)",
        "COMPETITOR_QUALITY: topRated → who you compete against",
        "TRANSACTIONS: delivery/pickup → modern consumer expectations"
      ],
      crossSourceLinks: [
        "GOOGLE_PLACES: ratings should correlate (both 1-5 scale)",
        "FOURSQUARE: venue count / ratings should agree directionally",
        "INSPECTIONS: low Yelp ratings may correlate with inspection issues"
      ],
      rawDataSample: data.businesses?.slice(0, 3).map((b) => ({ name: b.name, rating: b.rating, reviews: b.reviewCount, price: b.priceLevel, dist: Math.round(b.distance), cat: b.primaryCategory }))
    };
  } catch (e) {
    return { source: "Yelp", endpoint: "api.yelp.com/v3/businesses/search", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
async function validateMomentum(lat, lng) {
  const start = Date.now();
  try {
    const data = await fetchMomentumData(lat, lng);
    const ms = Date.now() - start;
    if (!data) return { source: "Momentum", endpoint: "data.cityofnewyork.us (3 sources)", status: "NULL", responseTimeMs: ms, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [], inferenceCapabilities: [], crossSourceLinks: [] };
    const fields = [
      auditField("compositeScore", data.compositeScore, "COMPUTED", (v) => typeof v === "number" && v >= 0 && v <= 100),
      auditField("direction", data.direction, "COMPUTED"),
      auditField("dobTrend.slope", data.dobTrend?.slope, "COMPUTED"),
      auditField("dobTrend.changePercent", data.dobTrend?.changePercent, "COMPUTED"),
      auditField("dcaTrend.slope", data.dcaTrend?.slope, "COMPUTED"),
      auditField("dcaTrend.changePercent", data.dcaTrend?.changePercent, "COMPUTED"),
      auditField("complaintsTrend.slope", data.complaintsTrend?.slope, "COMPUTED"),
      auditField("complaintsTrend.changePercent", data.complaintsTrend?.changePercent, "COMPUTED"),
      auditField("trendSignals", data.trendSignals, "COMPUTED")
    ];
    const populated = fields.filter((f) => f.populated).length;
    return {
      source: "Momentum",
      endpoint: "data.cityofnewyork.us (DOB + DCA + 311)",
      status: populated >= 6 ? "SUCCESS" : "PARTIAL",
      responseTimeMs: ms,
      fieldCount: fields.length,
      populatedCount: populated,
      coveragePct: Math.round(populated / fields.length * 100),
      fields,
      inferenceCapabilities: [
        "GROWTH_SIGNAL: direction → is this area growing, stable, or declining?",
        "DEVELOPMENT: dobTrend → construction activity trend",
        "BUSINESS_CHURN: dcaTrend → new business formation trend",
        "LIVABILITY: complaintsTrend → quality of life trend (inverted: declining = good)",
        "TIMING: compositeScore → is this the right moment to enter?"
      ],
      crossSourceLinks: [
        "DOB: permitCount should support dobTrend direction",
        "DCA: newBusinessRate should support dcaTrend",
        "311: totalCount trend should match complaintsTrend",
        "CENSUS_HOUSING: builtAfter2010Pct supports growth narrative"
      ]
    };
  } catch (e) {
    return { source: "Momentum", endpoint: "data.cityofnewyork.us", status: "FAILED", responseTimeMs: Date.now() - start, fieldCount: 0, populatedCount: 0, coveragePct: 0, fields: [auditField("error", e.message, "STUB")], inferenceCapabilities: [], crossSourceLinks: [] };
  }
}
const GET = async ({ url }) => {
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const type = url.searchParams.get("type") || "cafe";
  const address = url.searchParams.get("address") || "";
  if (isNaN(lat) || isNaN(lng)) {
    return new Response(JSON.stringify({ error: "Missing lat/lng" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const totalStart = Date.now();
  const results = await Promise.allSettled([
    validateCensus(lat, lng),
    validateCensusHousing(lat, lng),
    validateWalkScore(lat, lng),
    validateInspections(lat, lng),
    validateCrime(lat, lng),
    validateGooglePlaces(lat, lng, type),
    validateMarketDensity(lat, lng, type),
    validateOverpass(lat, lng, type),
    validateMTA(lat, lng),
    validateLPC(lat, lng),
    validateDCA(lat, lng),
    validateDOB(lat, lng),
    validate311(lat, lng),
    validatePedestrian(lat, lng),
    validatePLUTO(lat, lng),
    validateSidewalkCafes(lat, lng),
    validateLiquor(lat, lng),
    validateFoursquare(lat, lng, type),
    validateYelp(lat, lng, type),
    validateMomentum(lat, lng)
  ]);
  const sources = results.map((r) => r.status === "fulfilled" ? r.value : {
    source: "UNKNOWN",
    endpoint: "UNKNOWN",
    status: "FAILED",
    responseTimeMs: 0,
    fieldCount: 0,
    populatedCount: 0,
    coveragePct: 0,
    fields: [auditField("error", r.reason?.message || "Unknown", "STUB")],
    inferenceCapabilities: [],
    crossSourceLinks: []
  });
  const totalMs = Date.now() - totalStart;
  const successCount = sources.filter((s) => s.status === "SUCCESS").length;
  const partialCount = sources.filter((s) => s.status === "PARTIAL").length;
  const failedCount = sources.filter((s) => s.status === "FAILED" || s.status === "NULL").length;
  const totalFields = sources.reduce((sum, s) => sum + s.fieldCount, 0);
  const totalPopulated = sources.reduce((sum, s) => sum + s.populatedCount, 0);
  const allInferences = sources.flatMap((s) => s.inferenceCapabilities);
  return new Response(JSON.stringify({
    location: { lat, lng, address, businessType: type },
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    totalTimeMs: totalMs,
    summary: {
      sourcesTotal: sources.length,
      sourcesSuccess: successCount,
      sourcesPartial: partialCount,
      sourcesFailed: failedCount,
      overallCoveragePct: totalFields > 0 ? Math.round(totalPopulated / totalFields * 100) : 0,
      totalFields,
      totalPopulated,
      totalInferenceCapabilities: allInferences.length
    },
    sources,
    inferenceIndex: allInferences
  }, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*"
    }
  });
};
const POST = async ({ request }) => {
  const body = await request.json();
  const locations = body.locations || [];
  const defaultType = body.businessType || "cafe";
  if (!locations.length) {
    return new Response(JSON.stringify({ error: "No locations provided" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const allResults = [];
  for (const loc of locations) {
    new URL(`http://localhost/api/validate-sources?lat=${loc.lat}&lng=${loc.lng}&type=${loc.type || defaultType}&address=${encodeURIComponent(loc.address || "")}`);
    const totalStart = Date.now();
    const results = await Promise.allSettled([
      validateCensus(loc.lat, loc.lng),
      validateCensusHousing(loc.lat, loc.lng),
      validateWalkScore(loc.lat, loc.lng),
      validateInspections(loc.lat, loc.lng),
      validateCrime(loc.lat, loc.lng),
      validateGooglePlaces(loc.lat, loc.lng, loc.type || defaultType),
      validateMarketDensity(loc.lat, loc.lng, loc.type || defaultType),
      validateOverpass(loc.lat, loc.lng, loc.type || defaultType),
      validateMTA(loc.lat, loc.lng),
      validateLPC(loc.lat, loc.lng),
      validateDCA(loc.lat, loc.lng),
      validateDOB(loc.lat, loc.lng),
      validate311(loc.lat, loc.lng),
      validatePedestrian(loc.lat, loc.lng),
      validatePLUTO(loc.lat, loc.lng),
      validateSidewalkCafes(loc.lat, loc.lng),
      validateLiquor(loc.lat, loc.lng),
      validateFoursquare(loc.lat, loc.lng, loc.type || defaultType),
      validateYelp(loc.lat, loc.lng, loc.type || defaultType),
      validateMomentum(loc.lat, loc.lng)
    ]);
    const sources = results.map((r) => r.status === "fulfilled" ? r.value : {
      source: "UNKNOWN",
      endpoint: "UNKNOWN",
      status: "FAILED",
      responseTimeMs: 0,
      fieldCount: 0,
      populatedCount: 0,
      coveragePct: 0,
      fields: [],
      inferenceCapabilities: [],
      crossSourceLinks: []
    });
    allResults.push({
      location: { lat: loc.lat, lng: loc.lng, address: loc.address, type: loc.type || defaultType },
      totalTimeMs: Date.now() - totalStart,
      sources
    });
  }
  return new Response(JSON.stringify({
    batchValidation: true,
    locationCount: allResults.length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    results: allResults
  }, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" }
  });
};
export {
  GET,
  POST
};
