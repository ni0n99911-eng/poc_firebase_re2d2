import { I as IntelCache, i as intelCache, T as TTL, s as socrataBoxWhere } from "./cache.js";
import { S as SITE_CONFIG } from "./modules.js";
import { p as private_env } from "./private.js";
import { a as getBoroughSafetyFloor$1, b as getBoroughQualityFloor$1, d as detectBorough } from "./borough-bounds.js";
import { a as haversineKm, h as haversineMeters } from "./geo-math.js";
import { d as TRANSIT_THRESHOLDS } from "./scoring-thresholds.js";
const ACS_BASE$1 = "https://api.census.gov/data/2022/acs/acs5";
const VARIABLES$1 = [
  "B19013_001E",
  // Median household income
  "B01003_001E",
  // Total population
  "B01002_001E",
  // Median age
  "B15003_022E",
  // Bachelor's degree
  "B15003_023E",
  // Master's degree
  "B15003_024E",
  // Professional degree
  "B15003_025E",
  // Doctorate
  "B15003_001E",
  // Total education universe (25+)
  "B08301_010E",
  // Public transit commuters
  "B08301_001E",
  // Total commuters
  "B01001_001E"
  // Total population (for density calc)
].join(",");
async function latLngToFIPS$1(lat, lng) {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const { resilientFetch } = await import("./retry.js").then((n) => n.b);
    const res = await resilientFetch(url, { timeout: 1e4, label: "Census" });
    if (!res.ok) return null;
    const data = await res.json();
    const geographies = data?.result?.geographies?.["Census Tracts"]?.[0];
    if (!geographies) return null;
    return {
      state: geographies.STATE,
      county: geographies.COUNTY,
      tract: geographies.TRACT
    };
  } catch (e) {
    console.error("[Census] FIPS lookup failed:", e);
    return null;
  }
}
async function fetchCensusData(lat, lng) {
  const cacheKey = IntelCache.locationKey(lat, lng, "census");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const fips = await latLngToFIPS$1(lat, lng);
    if (!fips) {
      console.error("[Census] Could not determine census tract for", lat, lng);
      return cached?.data || null;
    }
    const url = `${ACS_BASE$1}?get=${VARIABLES$1}&for=tract:${fips.tract}&in=state:${fips.state}%20county:${fips.county}`;
    const { resilientFetch } = await import("./retry.js").then((n) => n.b);
    const res = await resilientFetch(url, { timeout: 15e3, label: "Census" });
    if (!res.ok) {
      console.error("[Census] ACS query failed:", res.status);
      return cached?.data || null;
    }
    const raw = await res.json();
    if (!raw || raw.length < 2) return cached?.data || null;
    const headers = raw[0];
    const values = raw[1];
    const v = (name) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? parseFloat(values[idx]) || 0 : 0;
    };
    const totalPop = v("B01003_001E");
    const bachelorsPlus = v("B15003_022E") + v("B15003_023E") + v("B15003_024E") + v("B15003_025E");
    const eduUniverse = v("B15003_001E");
    const transitCommuters = v("B08301_010E");
    const totalCommuters = v("B08301_001E");
    const approxAreaSqMi = totalPop > 5e3 ? 0.3 : totalPop > 2e3 ? 0.8 : 1.5;
    const result = {
      medianHouseholdIncome: v("B19013_001E"),
      totalPopulation: totalPop,
      populationDensity: Math.round(totalPop / approxAreaSqMi),
      medianAge: v("B01002_001E"),
      bachelorsPlusPercent: eduUniverse > 0 ? Math.round(bachelorsPlus / eduUniverse * 100) : 0,
      commuterPercent: totalCommuters > 0 ? Math.round(transitCommuters / totalCommuters * 100) : 0,
      daytimePopulationRatio: totalCommuters > 0 ? +(totalCommuters / totalPop).toFixed(2) : 1,
      tractId: `${fips.state}${fips.county}${fips.tract}`,
      source: "census-acs",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.DEMOGRAPHICS);
    return result;
  } catch (e) {
    console.error("[Census] Fetch error:", e);
    return cached?.data || null;
  }
}
const ACS_BASE = "https://api.census.gov/data/2022/acs/acs5";
const VARIABLES = [
  "B25064_001E",
  // Median gross rent
  "B25105_001E",
  // Median monthly housing costs (owner)
  "B25070_010E",
  // Rent 30-34.9% of income
  "B25070_011E",
  // Rent 35%+ (actually covers specific brackets, we sum high ones)
  "B25070_007E",
  // Rent 30-34.9%
  "B25070_008E",
  // Rent 35-39.9%
  "B25070_009E",
  // Rent 40-49.9%
  "B25070_010E",
  // Rent 50%+ (severe burden)
  "B25070_001E",
  // Total renters computed
  "B25002_001E",
  // Total housing units
  "B25002_003E",
  // Vacant units
  "B25003_001E",
  // Total occupied units
  "B25003_002E",
  // Owner-occupied
  "B25003_003E",
  // Renter-occupied
  "B25018_001E",
  // Median rooms
  "B25034_010E",
  // Built 1940-1949
  "B25034_011E",
  // Built 1939 or earlier
  "B25034_001E",
  // Total structures (for year built calc)
  "B25034_002E",
  // Built 2020 or later
  "B25034_003E"
  // Built 2010-2019
].join(",");
async function latLngToFIPS(lat, lng) {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const { resilientFetch } = await import("./retry.js").then((n) => n.b);
    const res = await resilientFetch(url, { timeout: 1e4, label: "CensusHousing" });
    if (!res.ok) return null;
    const data = await res.json();
    const geographies = data?.result?.geographies?.["Census Tracts"]?.[0];
    if (!geographies) return null;
    return {
      state: geographies.STATE,
      county: geographies.COUNTY,
      tract: geographies.TRACT
    };
  } catch {
    return null;
  }
}
async function fetchCensusHousing(lat, lng) {
  const cacheKey = IntelCache.locationKey(lat, lng, "census-housing");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const fips = await latLngToFIPS(lat, lng);
    if (!fips) {
      console.error("[Census Housing] FIPS lookup failed for", lat, lng);
      return cached?.data || null;
    }
    const url = `${ACS_BASE}?get=${VARIABLES}&for=tract:${fips.tract}&in=state:${fips.state}%20county:${fips.county}`;
    const { resilientFetch } = await import("./retry.js").then((n) => n.b);
    const res = await resilientFetch(url, { timeout: 15e3, label: "CensusHousing" });
    if (!res.ok) {
      console.error("[Census Housing] ACS query failed:", res.status);
      return cached?.data || null;
    }
    const raw = await res.json();
    if (!raw || raw.length < 2) return cached?.data || null;
    const headers = raw[0];
    const values = raw[1];
    const v = (name) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? parseFloat(values[idx]) || 0 : 0;
    };
    const totalUnits = v("B25002_001E");
    const vacantUnits = v("B25002_003E");
    const totalOccupied = v("B25003_001E");
    const ownerOccupied = v("B25003_002E");
    const renterOccupied = v("B25003_003E");
    const totalRentersComputed = v("B25070_001E");
    const burden30_34 = v("B25070_007E");
    const burden35_39 = v("B25070_008E");
    const burden40_49 = v("B25070_009E");
    const burden50plus = v("B25070_010E");
    const totalBurdened = burden30_34 + burden35_39 + burden40_49 + burden50plus;
    const totalStructures = v("B25034_001E");
    const pre1950 = v("B25034_010E") + v("B25034_011E");
    const post2010 = v("B25034_002E") + v("B25034_003E");
    const result = {
      medianGrossRent: v("B25064_001E"),
      medianMonthlyHousingCost: v("B25105_001E"),
      rentBurdenedPct: totalRentersComputed > 0 ? Math.round(totalBurdened / totalRentersComputed * 100) : 0,
      severeRentBurdenPct: totalRentersComputed > 0 ? Math.round(burden50plus / totalRentersComputed * 100) : 0,
      vacancyRate: totalUnits > 0 ? Math.round(vacantUnits / totalUnits * 100) : 0,
      ownerOccupiedPct: totalOccupied > 0 ? Math.round(ownerOccupied / totalOccupied * 100) : 0,
      renterOccupiedPct: totalOccupied > 0 ? Math.round(renterOccupied / totalOccupied * 100) : 0,
      totalHousingUnits: totalUnits,
      medianRooms: v("B25018_001E"),
      builtBefore1950Pct: totalStructures > 0 ? Math.round(pre1950 / totalStructures * 100) : 0,
      builtAfter2010Pct: totalStructures > 0 ? Math.round(post2010 / totalStructures * 100) : 0,
      tractId: `${fips.state}${fips.county}${fips.tract}`,
      source: "census-housing",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.HOUSING);
    return result;
  } catch (e) {
    console.error("[Census Housing] Fetch error:", e);
    return cached?.data || null;
  }
}
const WALKSCORE_BASE = "https://api.walkscore.com/score";
async function fetchWalkScore(lat, lng, address) {
  const cacheKey = IntelCache.locationKey(lat, lng, "walkscore");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const { db } = await import("./db-server.js").then((n) => n.n);
    const { sql } = await import("drizzle-orm");
    const nearestRes = await db.execute(sql`SELECT * FROM nearby_block_group(${lat}, ${lng})`);
    const nearest = Array.isArray(nearestRes) ? nearestRes : nearestRes.rows;
    if (nearest && nearest.length > 0) {
      const intelRes = await db.execute(sql`SELECT data FROM block_group_intel WHERE geoid = ${nearest[0].geoid} AND source = 'walkscore' LIMIT 1`);
      const intelRows = Array.isArray(intelRes) ? intelRes : intelRes.rows;
      const intel = intelRows[0];
      if (intel?.data) {
        const d = intel.data;
        const result = {
          walkScore: d.walkscore || 0,
          walkDescription: describeScore(d.walkscore || 0),
          transitScore: d.transit_score || 0,
          transitDescription: describeTransit(d.transit_score || 0),
          bikeScore: d.bike_score || 0,
          bikeDescription: describeBike(d.bike_score || 0),
          source: "walkscore-api",
          fetchedAt: d.fetched_at || (/* @__PURE__ */ new Date()).toISOString()
        };
        intelCache.set(cacheKey, result, TTL.WALKABILITY);
        return result;
      }
    }
  } catch (dbErr) {
    console.warn("[WalkScore-DB] Seeded lookup skipped:", dbErr);
  }
  const apiKey = private_env.WALKSCORE_API_KEY;
  if (apiKey) {
    try {
      const params = new URLSearchParams({
        format: "json",
        lat: lat.toString(),
        lon: lng.toString(),
        transit: "1",
        bike: "1",
        wsapikey: apiKey,
        ...address ? { address } : {}
      });
      const { resilientFetch } = await import("./retry.js").then((n) => n.b);
      const res = await resilientFetch(`${WALKSCORE_BASE}?${params}`, {
        timeout: 1e4,
        label: "WalkScore"
      });
      if (!res.ok) {
        console.error("[WalkScore] API error:", res.status);
        return cached?.data || null;
      }
      const data = await res.json();
      if (data.status !== 1) {
        console.error("[WalkScore] Bad status:", data.status, data.description);
        return cached?.data || estimateWalkScore(lat, lng);
      }
      const result = {
        walkScore: data.walkscore || 0,
        walkDescription: data.description || describeScore(data.walkscore || 0),
        transitScore: data.transit?.score || 0,
        transitDescription: data.transit?.description || describeTransit(data.transit?.score || 0),
        bikeScore: data.bike?.score || 0,
        bikeDescription: data.bike?.description || describeBike(data.bike?.score || 0),
        source: "walkscore-api",
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      intelCache.set(cacheKey, result, TTL.WALKABILITY);
      return result;
    } catch (e) {
      console.error("[WalkScore] Fetch error:", e);
      return cached?.data || estimateWalkScore(lat, lng);
    }
  }
  return cached?.data || estimateWalkScore(lat, lng);
}
async function estimateWalkScore(lat, lng) {
  try {
    const query = `[out:json][timeout:10];(
			node["amenity"~"cafe|restaurant|bar|bank|pharmacy|supermarket|school|hospital"](around:500,${lat},${lng});
			node["shop"~"supermarket|convenience|bakery"](around:500,${lat},${lng});
			node["railway"="station"](around:800,${lat},${lng});
			node["highway"="bus_stop"](around:300,${lat},${lng});
		);out count;`;
    const { resilientFetch } = await import("./retry.js").then((n) => n.b);
    const res = await resilientFetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      {
        timeout: 12e3,
        label: "WalkScore",
        headers: { "User-Agent": SITE_CONFIG.userAgent }
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const count = data?.elements?.[0]?.tags?.total || data?.elements?.length || 0;
    const walkScore = Math.min(100, Math.round(Math.min(count, 80) * 1.25));
    const transitEstimate = Math.min(100, Math.round(walkScore * 0.85));
    const bikeEstimate = Math.min(100, Math.round(walkScore * 0.75));
    const result = {
      walkScore,
      walkDescription: describeScore(walkScore),
      transitScore: transitEstimate,
      transitDescription: describeTransit(transitEstimate),
      bikeScore: bikeEstimate,
      bikeDescription: describeBike(bikeEstimate),
      source: "walkscore-estimate",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(IntelCache.locationKey(lat, lng, "walkscore"), result, TTL.WALKABILITY);
    return result;
  } catch (e) {
    console.error("[WalkScore] Estimation failed:", e);
    return null;
  }
}
function describeScore(score) {
  if (score >= 90) return "Walker's Paradise";
  if (score >= 70) return "Very Walkable";
  if (score >= 50) return "Somewhat Walkable";
  if (score >= 25) return "Car-Dependent";
  return "Almost All Errands Require a Car";
}
function describeTransit(score) {
  if (score >= 90) return "Rider's Paradise";
  if (score >= 70) return "Excellent Transit";
  if (score >= 50) return "Good Transit";
  if (score >= 25) return "Some Transit";
  return "Minimal Transit";
}
function describeBike(score) {
  if (score >= 90) return "Biker's Paradise";
  if (score >= 70) return "Very Bikeable";
  if (score >= 50) return "Bikeable";
  return "Somewhat Bikeable";
}
const SOCRATA_BASE = "https://data.cityofnewyork.us/resource/43nn-pn8j.json";
async function fetchInspections(lat, lng, radiusMeters = 500) {
  const cacheKey = IntelCache.locationKey(lat, lng, "inspections");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const url = `${SOCRATA_BASE}?$where=within_circle(location,${lat},${lng},${radiusMeters}) AND grade IS NOT NULL AND inspection_date > '${twoYearsAgo()}'&$select=dba,building,street,cuisine_description,grade,score,inspection_date,latitude,longitude,zipcode,camis&$order=inspection_date DESC&$limit=200`;
    const { socrataFetch } = await import("./socrata-fetch.js");
    const raw = await socrataFetch(url, "Inspections");
    if (!raw || !Array.isArray(raw)) return cached?.data || null;
    const seen = /* @__PURE__ */ new Map();
    for (const r of raw) {
      const camis = r.camis;
      if (!seen.has(camis) || r.inspection_date > seen.get(camis).inspection_date) {
        seen.set(camis, r);
      }
    }
    const restaurants = [];
    const gradeDistribution = { A: 0, B: 0, C: 0, other: 0 };
    const cuisineBreakdown = {};
    let totalScore = 0;
    let scoreCount = 0;
    for (const [, r] of seen) {
      const grade = r.grade || "N/A";
      const score = parseInt(r.score) || 0;
      restaurants.push({
        name: cleanName(r.dba || "Unknown"),
        address: `${r.building || ""} ${r.street || ""}`.trim(),
        cuisineType: r.cuisine_description || "Unknown",
        grade,
        score,
        inspectionDate: r.inspection_date?.split("T")[0] || "",
        lat: parseFloat(r.latitude) || lat,
        lng: parseFloat(r.longitude) || lng,
        zipcode: r.zipcode || ""
      });
      if (grade === "A") gradeDistribution.A++;
      else if (grade === "B") gradeDistribution.B++;
      else if (grade === "C") gradeDistribution.C++;
      else gradeDistribution.other++;
      const cuisine = r.cuisine_description || "Other";
      cuisineBreakdown[cuisine] = (cuisineBreakdown[cuisine] || 0) + 1;
      if (score > 0) {
        totalScore += score;
        scoreCount++;
      }
    }
    const result = {
      restaurants,
      totalNearby: restaurants.length,
      gradeDistribution,
      cuisineBreakdown,
      avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
      source: "nyc-dohmh",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.INSPECTIONS);
    return result;
  } catch (e) {
    console.error("[DOHMH] Fetch error:", e);
    return cached?.data || null;
  }
}
function twoYearsAgo() {
  const d = /* @__PURE__ */ new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().split("T")[0];
}
function cleanName(name) {
  return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/['']S\b/g, "'s");
}
const NYPD_BASE = "https://data.cityofnewyork.us/resource/5uac-w243.json";
const VIOLENT_OFFENSES = /* @__PURE__ */ new Set([
  "MURDER & NON-NEGL. MANSLAUGHTER",
  "RAPE",
  "ROBBERY",
  "FELONY ASSAULT",
  "KIDNAPPING & RELATED OFFENSES",
  "HOMICIDE-NEGLIGENT-VEHICLE",
  "ASSAULT 3 & RELATED OFFENSES",
  "SEX CRIMES"
]);
const PROPERTY_OFFENSES = /* @__PURE__ */ new Set([
  "BURGLARY",
  "GRAND LARCENY",
  "PETIT LARCENY",
  "GRAND LARCENY OF MOTOR VEHICLE",
  "THEFT-FRAUD",
  "CRIMINAL MISCHIEF & RELATED OF",
  "ARSON",
  "STOLEN PROPERTY",
  "POSSESSION OF STOLEN PROPERTY"
]);
async function fetchCrimeData(lat, lng, radiusMeters = 300) {
  const cacheKey = IntelCache.locationKey(lat, lng, "crime");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const sixMonthsAgo = /* @__PURE__ */ new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateStr = sixMonthsAgo.toISOString().split("T")[0];
    const url = `${NYPD_BASE}?$where=within_circle(lat_lon,${lat},${lng},${radiusMeters}) AND cmplnt_fr_dt > '${dateStr}T00:00:00'&$select=law_cat_cd,ofns_desc,cmplnt_fr_dt,latitude,longitude&$order=cmplnt_fr_dt DESC&$limit=500`;
    const { socrataFetch } = await import("./socrata-fetch.js");
    const raw = await socrataFetch(url, "Crime");
    if (!raw || !Array.isArray(raw)) return cached?.data || null;
    let violentCount = 0;
    let propertyCount = 0;
    let otherCount = 0;
    const typeCounts = {};
    if (!raw || raw.length === 0) {
      const syntheticScore = getBoroughSafetyFloor(lat, lng);
      const result2 = {
        incidents: [],
        totalCount: 0,
        violentCount: 0,
        propertyCount: 0,
        otherCount: 0,
        crimeScore: syntheticScore,
        densityPerSqMi: 0,
        topTypes: [],
        source: "nypd-complaints",
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      intelCache.set(cacheKey, result2, TTL.CRIME);
      return result2;
    }
    const incidents = raw.map((r) => {
      const desc = r.ofns_desc || "UNKNOWN";
      let category = "other";
      if (VIOLENT_OFFENSES.has(desc)) {
        category = "violent";
        violentCount++;
      } else if (PROPERTY_OFFENSES.has(desc)) {
        category = "property";
        propertyCount++;
      } else {
        otherCount++;
      }
      typeCounts[desc] = (typeCounts[desc] || 0) + 1;
      return {
        type: r.law_cat_cd || "UNKNOWN",
        description: desc,
        category,
        date: r.cmplnt_fr_dt?.split("T")[0] || "",
        lat: parseFloat(r.latitude) || lat,
        lng: parseFloat(r.longitude) || lng
      };
    });
    const topTypes = Object.entries(typeCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 5);
    const radiusMi = radiusMeters / 1609.34;
    const areaSqMi = Math.PI * radiusMi * radiusMi;
    const densityPerSqMi = areaSqMi > 0 ? Math.round(incidents.length / areaSqMi) : 0;
    const annualizedCount = incidents.length * 2;
    const crimeScore = computeCrimeScore(annualizedCount, areaSqMi, violentCount);
    const result = {
      incidents,
      totalCount: incidents.length,
      violentCount,
      propertyCount,
      otherCount,
      crimeScore,
      densityPerSqMi,
      topTypes,
      source: "nypd-complaints",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.CRIME);
    return result;
  } catch (e) {
    console.error("[Crime] Fetch error:", e);
    if (cached?.data) return cached.data;
    return {
      incidents: [],
      totalCount: 0,
      violentCount: 0,
      propertyCount: 0,
      otherCount: 0,
      crimeScore: getBoroughSafetyFloor(lat, lng),
      densityPerSqMi: 0,
      topTypes: [],
      source: "nypd-complaints",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
function getBoroughSafetyFloor(lat, lng) {
  return getBoroughSafetyFloor$1(lat, lng);
}
function computeCrimeScore(annualizedCount, areaSqMi, violentCount) {
  if (areaSqMi === 0) return 50;
  const density = annualizedCount / areaSqMi;
  const violentRatio = annualizedCount > 0 ? violentCount / (annualizedCount / 2) : 0;
  let score;
  if (density < 200) score = 60 + Math.round((200 - density) / 200 * 15);
  else if (density < 600) score = 45 + Math.round((600 - density) / 400 * 15);
  else if (density < 1500) score = 28 + Math.round((1500 - density) / 900 * 17);
  else score = Math.max(10, 28 - Math.round((density - 1500) / 1500 * 18));
  if (violentRatio > 0.3) score -= 15;
  else if (violentRatio > 0.15) score -= 8;
  return Math.max(0, Math.min(100, score));
}
const RING_DISTANCES = {
  specialty_coffee: [0.1, 0.2, 0.5],
  juice_bar: [0.1, 0.2, 0.5],
  wellness_beverage: [0.1, 0.2, 0.5],
  bakery: [0.2, 0.4, 1],
  qsr: [0.25, 0.5, 1.2],
  personal_services: [0.25, 0.5, 1.2],
  retail: [0.25, 0.5, 1.2],
  fast_casual: [0.3, 0.6, 1.5],
  fitness_studio: [0.3, 0.6, 1.5],
  bar_nightlife: [0.4, 0.8, 2],
  wellness_spa: [0.4, 0.8, 2],
  medical_office: [0.4, 0.8, 2],
  coworking: [0.4, 0.8, 2],
  florist: [0.4, 0.8, 2],
  full_service_restaurant: [0.5, 1.5, 3],
  // SEG-02: New segment ring distances
  nail_salon: [0.15, 0.3, 0.8],
  // hyperlocal walk-in
  barbershop: [0.15, 0.3, 0.8],
  // hyperlocal loyalty
  pharmacy: [0.3, 0.6, 1.5],
  // convenience radius
  doggie_daycare: [0.4, 0.8, 2],
  // destination service
  tutoring: [0.4, 0.8, 2],
  // school-proximate
  ethnic_market: [0.4, 1, 2.5],
  // community destination
  // Legacy fuzzy keys mapped to canonical equivalents
  cafe: [0.1, 0.2, 0.5],
  coffee: [0.1, 0.2, 0.5],
  restaurant: [0.5, 1.5, 3],
  fitness: [0.3, 0.6, 1.5],
  gym: [0.3, 0.6, 1.5],
  bar: [0.4, 0.8, 2],
  default: [0.3, 0.6, 1.5]
};
const CHAIN_NAMES$1 = /* @__PURE__ */ new Set([
  // Coffee
  "starbucks",
  "dunkin",
  "dunkin'",
  "peet",
  "peet's",
  "blue bottle",
  "gregory's",
  "gregorys",
  "joe coffee",
  "think coffee",
  "la colombe",
  "bluestone lane",
  "philz",
  "intelligentsia",
  "blank street",
  "birch coffee",
  "ground central",
  "city of saints",
  "felix roasting",
  // QSR / Fast casual / Restaurants
  "sweetgreen",
  "chipotle",
  "shake shack",
  "panera",
  "mcdonald's",
  "subway",
  "chick-fil-a",
  "wendy's",
  "burger king",
  "popeyes",
  "domino's",
  "pizza hut",
  "taco bell",
  "five guys",
  "wingstop",
  "cava",
  "dig",
  "just salad",
  // Fitness
  "equinox",
  "planet fitness",
  "orangetheory",
  "soulcycle",
  "blink fitness",
  "crunch",
  "barry's",
  "lifetime fitness",
  "solidcore",
  "rumble",
  "y7 studio",
  "peloton",
  // Bars
  "tgif",
  "applebee's",
  "buffalo wild wings",
  // Spa / Wellness
  "hand & stone",
  "massage envy",
  "exhale",
  "dry bar",
  "drybar",
  // Personal services
  "supercuts",
  "great clips",
  "sport clips",
  "european wax center",
  "ulta",
  "sephora",
  "glosslab",
  "tenoverten",
  // Retail
  "h&m",
  "zara",
  "uniqlo",
  "gap",
  "old navy",
  "forever 21",
  "urban outfitters",
  "lululemon",
  "nike",
  "adidas",
  "foot locker",
  // Bakery
  "paris baguette",
  "tous les jours",
  "au bon pain",
  "le pain quotidien",
  // Juice / Wellness beverage
  "jamba",
  "juice press",
  "pressed juicery",
  "kung fu tea",
  "gong cha",
  // Coworking
  "wework",
  "regus",
  "spaces",
  "industrious",
  // Medical
  "aspen dental",
  "citymd",
  "one medical"
]);
async function scanCompetitors(lat, lng, businessType = "cafe", radiusMeters = 800) {
  const cacheKey = IntelCache.locationKey(lat, lng, `overpass-${businessType}`);
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const r = radiusMeters;
    const lower = businessType.toLowerCase();
    const coreQueries = [
      // Cafes & coffee shops
      `[out:json][timeout:12];(nwr["amenity"="cafe"](around:${r},${lat},${lng});nwr["cuisine"~"coffee"](around:${r},${lat},${lng});nwr["shop"="coffee"](around:${r},${lat},${lng}););out center;`,
      // Restaurants & fast food
      `[out:json][timeout:12];(nwr["amenity"="restaurant"](around:${r},${lat},${lng});nwr["amenity"="fast_food"](around:${r},${lat},${lng}););out center;`,
      // Gyms & fitness
      `[out:json][timeout:12];(nwr["leisure"="fitness_centre"](around:${r},${lat},${lng});nwr["sport"="fitness"](around:${r},${lat},${lng}););out center;`,
      // Yoga & wellness studios
      `[out:json][timeout:12];(nwr["sport"="yoga"](around:${r},${lat},${lng});nwr["leisure"~"yoga"](around:${r},${lat},${lng});nwr["shop"~"health_food|organic|nutrition"](around:${r},${lat},${lng}););out center;`
    ];
    const CONCEPT_EXTRA_QUERIES = {
      "bar_nightlife": `[out:json][timeout:12];(nwr["amenity"="bar"](around:${r},${lat},${lng});nwr["amenity"="pub"](around:${r},${lat},${lng});nwr["amenity"="nightclub"](around:${r},${lat},${lng}););out center;`,
      "wellness_spa": `[out:json][timeout:12];(nwr["amenity"="spa"](around:${r},${lat},${lng});nwr["leisure"="sauna"](around:${r},${lat},${lng});nwr["shop"="beauty"](around:${r},${lat},${lng});nwr["amenity"="beauty"](around:${r},${lat},${lng}););out center;`,
      "personal_services": `[out:json][timeout:12];(nwr["shop"="hairdresser"](around:${r},${lat},${lng});nwr["shop"="beauty"](around:${r},${lat},${lng});nwr["amenity"="beauty"](around:${r},${lat},${lng}););out center;`,
      "retail": `[out:json][timeout:12];(nwr["shop"~"clothes|boutique|gift|jewelry|books"](around:${r},${lat},${lng}););out center;`,
      "coworking": `[out:json][timeout:12];(nwr["amenity"="coworking_space"](around:${r},${lat},${lng});nwr["office"="coworking"](around:${r},${lat},${lng}););out center;`,
      "medical_office": `[out:json][timeout:12];(nwr["amenity"="dentist"](around:${r},${lat},${lng});nwr["amenity"="doctors"](around:${r},${lat},${lng});nwr["amenity"="clinic"](around:${r},${lat},${lng}););out center;`
    };
    const extraQuery = CONCEPT_EXTRA_QUERIES[lower] || null;
    const queries = extraQuery ? [...coreQueries, extraQuery] : coreQueries;
    const results = [];
    for (let i = 0; i < queries.length; i++) {
      results.push(await overpassQuery(queries[i]));
      if (i < queries.length - 1) {
        await new Promise((r2) => setTimeout(r2, 600));
      }
    }
    const allFailed = results.every((r2) => r2 === null);
    if (allFailed) {
      console.warn("[Overpass] All queries failed — returning null (not empty)");
      return cached?.data || null;
    }
    const [cafeRaw, restRaw, gymRaw, yogaRaw, extraRaw] = results;
    const cafes = dedupe(processElements(cafeRaw ?? [], lat, lng, "cafe"));
    const restaurants = dedupe(processElements(restRaw ?? [], lat, lng, "restaurant"));
    const gyms = dedupe(processElements(gymRaw ?? [], lat, lng, "gym"));
    const yoga = dedupe(processElements(yogaRaw ?? [], lat, lng, "wellness"));
    const health = dedupe(processElements(yogaRaw ?? [], lat, lng, "health"));
    let bars = [];
    let wellness = [];
    let retail = [];
    let personal = [];
    if (extraRaw && extraQuery) {
      const extraPOIs = dedupe(processElements(extraRaw, lat, lng, lower));
      switch (lower) {
        case "bar_nightlife":
          bars = extraPOIs;
          break;
        case "wellness_spa":
          wellness = extraPOIs;
          break;
        case "personal_services":
          personal = extraPOIs;
          break;
        case "retail":
          retail = extraPOIs;
          break;
        case "coworking":
          break;
        case "medical_office":
          break;
      }
    }
    const primaryCompetitors = getPrimaryCompetitors(businessType, {
      cafes,
      restaurants,
      gyms,
      yoga,
      health,
      bars,
      wellness,
      retail,
      personal
    });
    const ringDists = RING_DISTANCES[businessType.toLowerCase()] || RING_DISTANCES.default;
    const rings = {
      ring1: primaryCompetitors.filter((c) => c.distance <= ringDists[0]),
      ring2: primaryCompetitors.filter((c) => c.distance > ringDists[0] && c.distance <= ringDists[1]),
      ring3: primaryCompetitors.filter((c) => c.distance > ringDists[1] && c.distance <= ringDists[2])
    };
    const ringStats = {
      ring1: computeRingStats(rings.ring1),
      ring2: computeRingStats(rings.ring2),
      ring3: computeRingStats(rings.ring3)
    };
    let chainCount = 0;
    let independentCount = 0;
    const allChainNamesSeen = /* @__PURE__ */ new Set();
    const topChains = [];
    for (const c of primaryCompetitors) {
      if (c.isChain) {
        chainCount++;
        const label = (c.brand || c.name).trim();
        if (label && label !== "Unnamed" && !allChainNamesSeen.has(label.toLowerCase())) {
          allChainNamesSeen.add(label.toLowerCase());
          topChains.push(label);
        }
      } else {
        independentCount++;
      }
    }
    const chainDominance = primaryCompetitors.length > 0 ? Math.round(chainCount / primaryCompetitors.length * 100) / 100 : 0;
    const saturationScore = computeSaturation(primaryCompetitors, businessType);
    const result = {
      competitors: primaryCompetitors,
      rings,
      totalCount: primaryCompetitors.length,
      chainCount,
      independentCount,
      chainDominance,
      topChains: topChains.slice(0, 15),
      ringStats,
      saturationScore,
      stations: [],
      // Transit handled by MTA Socrata — not Overpass
      amenities: { cafes, restaurants, gyms, yoga, health, bars, wellness, retail, personal },
      source: "overpass",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.COMPETITORS);
    return result;
  } catch (e) {
    console.error("[Overpass] Scan error:", e);
    return cached?.data || null;
  }
}
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  // Official — primary
  "https://overpass.kumi.systems/api/interpreter",
  // Germany mirror
  "https://overpass.private.coffee/api/interpreter",
  // Community mirror
  "https://lz4.overpass-api.de/api/interpreter"
  // Fast Germany mirror
];
async function overpassQuery(query) {
  const { resilientFetch } = await import("./retry.js").then((n) => n.b);
  const encoded = encodeURIComponent(query);
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const endpoint = OVERPASS_ENDPOINTS[i];
    try {
      const res = await resilientFetch(
        `${endpoint}?data=${encoded}`,
        {
          timeout: i === 0 ? 12e3 : 8e3,
          // primary gets more time
          maxRetries: i === 0 ? 1 : 0,
          // retries only on primary
          headers: { "User-Agent": SITE_CONFIG.userAgent },
          label: `Overpass[${i}]`
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (i > 0) console.info(`[Overpass] Served by fallback endpoint ${endpoint}`);
        return data.elements || [];
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        console.error(`[Overpass] HTTP ${res.status} on ${endpoint} — not retrying other mirrors`);
        return null;
      }
      console.warn(`[Overpass] HTTP ${res.status} on ${endpoint} — trying next mirror`);
    } catch (e) {
      console.warn(`[Overpass] ${endpoint} failed: ${e instanceof Error ? e.message : e} — trying next`);
    }
  }
  console.error("[Overpass] All mirrors failed — data unavailable");
  return null;
}
function processElements(elements, originLat, originLng, type) {
  return elements.map((e) => {
    const eLat = e.lat ?? e.center?.lat;
    const eLon = e.lon ?? e.center?.lon;
    if (!eLat || !eLon) return null;
    return {
      name: e.tags?.name || e.tags?.brand || "Unnamed",
      brand: e.tags?.brand,
      lat: eLat,
      lng: eLon,
      distance: haversineKm(originLat, originLng, eLat, eLon),
      type,
      isChain: isKnownChain(e.tags?.name || "", e.tags?.brand || ""),
      tags: e.tags || {}
    };
  }).filter((p) => p !== null).sort((a, b) => a.distance - b.distance);
}
function dedupe(pois) {
  const seen = /* @__PURE__ */ new Set();
  return pois.filter((p) => {
    const key = `${p.name.toLowerCase()}|${p.lat.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function getPrimaryCompetitors(businessType, amenities) {
  const lower = businessType.toLowerCase();
  switch (lower) {
    case "specialty_coffee":
      return [...amenities.cafes];
    case "bakery":
      return [...amenities.cafes];
    // bakeries sit in cafe bucket in OSM
    case "wellness_beverage":
      return [...amenities.cafes, ...amenities.health];
    case "juice_bar":
      return [...amenities.cafes, ...amenities.health];
    case "full_service_restaurant":
      return [...amenities.restaurants];
    case "fast_casual":
      return [...amenities.restaurants, ...amenities.cafes];
    case "qsr":
      return [...amenities.restaurants];
    case "fitness_studio":
      return [...amenities.gyms, ...amenities.yoga];
    case "bar_nightlife":
      return [...amenities.bars];
    case "wellness_spa":
      return [...amenities.wellness, ...amenities.yoga, ...amenities.personal];
    case "personal_services":
      return [...amenities.personal, ...amenities.wellness];
    case "retail":
      return [...amenities.retail];
    case "coworking":
      return [...amenities.cafes];
    // coworking not well-tagged in OSM; cafes are proxy
    case "medical_office":
      return [];
  }
  if (lower.includes("coffee") || lower.includes("cafe")) return [...amenities.cafes];
  if (lower.includes("restaurant") || lower.includes("food")) return [...amenities.restaurants, ...amenities.cafes];
  if (lower.includes("fitness") || lower.includes("gym")) return [...amenities.gyms, ...amenities.yoga];
  if (lower.includes("bar") || lower.includes("nightlife")) return [...amenities.bars];
  if (lower.includes("spa") || lower.includes("wellness")) return [...amenities.wellness, ...amenities.yoga];
  if (lower.includes("retail") || lower.includes("boutique")) return [...amenities.retail];
  if (lower.includes("salon") || lower.includes("barber") || lower.includes("personal")) return [...amenities.personal];
  if (lower.includes("bakery") || lower.includes("pastry")) return [...amenities.cafes];
  return [];
}
function computeSaturation(competitors, businessType) {
  const thresholds = {
    specialty_coffee: [5, 20],
    bakery: [3, 15],
    wellness_beverage: [3, 12],
    juice_bar: [3, 12],
    full_service_restaurant: [10, 40],
    fast_casual: [10, 40],
    qsr: [10, 40],
    fitness_studio: [3, 12],
    bar_nightlife: [5, 20],
    wellness_spa: [2, 8],
    personal_services: [3, 15],
    retail: [5, 25],
    coworking: [2, 8],
    medical_office: [3, 12],
    // Legacy fuzzy keys
    cafe: [5, 20],
    coffee: [5, 20],
    restaurant: [10, 40],
    fitness: [3, 12],
    gym: [3, 12],
    default: [5, 20]
  };
  const [low, high] = thresholds[businessType.toLowerCase()] || thresholds.default;
  const count = competitors.length;
  if (count <= low) return Math.round(count / low * 40);
  if (count <= high) return 40 + Math.round((count - low) / (high - low) * 40);
  return Math.min(100, 80 + Math.round((count - high) / high * 20));
}
function isKnownChain(name, brand) {
  const lower = (name + " " + brand).toLowerCase();
  for (const chain of CHAIN_NAMES$1) {
    if (lower.includes(chain)) return true;
  }
  return false;
}
function computeRingStats(ring) {
  let chainCount = 0;
  let independentCount = 0;
  const chainNamesSeen = /* @__PURE__ */ new Set();
  const topChains = [];
  for (const c of ring) {
    if (c.isChain) {
      chainCount++;
      const label = (c.brand || c.name).trim();
      if (label && label !== "Unnamed" && !chainNamesSeen.has(label.toLowerCase())) {
        chainNamesSeen.add(label.toLowerCase());
        topChains.push(label);
      }
    } else {
      independentCount++;
    }
  }
  const total = ring.length;
  return {
    chainCount,
    independentCount,
    total,
    chainDominance: total > 0 ? Math.round(chainCount / total * 100) / 100 : 0,
    topChains: topChains.slice(0, 10)
  };
}
function buildCompetitorsFromSources(lat, lng, businessType, foursquareData, placesData, yelpData) {
  const allPOIs = [];
  const seen = /* @__PURE__ */ new Set();
  function addPOI(poi) {
    const locPart = poi.tags?.coordsApprox === "true" ? poi.distance.toFixed(3) : `${poi.lat.toFixed(3)},${poi.lng.toFixed(3)}`;
    const key = `${poi.name.toLowerCase().replace(/[^a-z0-9]/g, "")}|${locPart}`;
    if (seen.has(key)) return;
    seen.add(key);
    allPOIs.push(poi);
  }
  const forcedPrimaryPOIs = [];
  if (foursquareData?.directCompetitors) {
    for (const v of foursquareData.directCompetitors) {
      const mappedType = mapFSQCategoryToType(v.primaryCategory);
      const resolvedType = mappedType !== "other" ? mappedType : getFallbackType(businessType);
      const poi = {
        name: v.name,
        brand: v.chainName || void 0,
        lat,
        // approx — Foursquare doesn't return coordinates; use address centroid
        lng,
        distance: v.distance / 1e3,
        // meters → km
        type: resolvedType,
        isChain: v.isChain,
        tags: { source: "foursquare", coordsApprox: "true", category: v.primaryCategory, directCompetitor: "true" }
      };
      addPOI(poi);
      forcedPrimaryPOIs.push(poi);
    }
  }
  if (foursquareData?.venues) {
    for (const v of foursquareData.venues) {
      const type = mapFSQCategoryToType(v.primaryCategory);
      if (isCompetitorCategory(type, businessType)) {
        addPOI({
          name: v.name,
          brand: v.chainName || void 0,
          lat,
          // approx — Foursquare doesn't return coordinates; use address centroid
          lng,
          distance: v.distance / 1e3,
          type,
          isChain: v.isChain,
          tags: { source: "foursquare", coordsApprox: "true", category: v.primaryCategory }
        });
      }
    }
  }
  if (placesData?.places) {
    for (const p of placesData.places) {
      const type = mapGoogleTypeToCompetitorType(p.types, businessType);
      if (type) {
        addPOI({
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          distance: p.distance / 1e3,
          // meters → km
          type,
          isChain: isKnownChain(p.name, ""),
          tags: { source: "google-places", rating: String(p.rating), reviews: String(p.reviewCount) }
        });
      }
    }
  }
  if (yelpData?.businesses) {
    for (const b of yelpData.businesses) {
      const type = mapYelpCategoryToType(b.categories);
      if (type && isCompetitorCategory(type, businessType)) {
        addPOI({
          name: b.name,
          lat: b.lat,
          lng: b.lng,
          distance: b.distance / 1e3,
          // meters → km
          type,
          isChain: b.isChain,
          tags: { source: "yelp", category: b.primaryCategory }
        });
      }
    }
  }
  if (allPOIs.length === 0) {
    console.warn("[buildCompetitorsFromSources] No POIs after filtering. FSQ direct:", foursquareData?.directCompetitors?.length ?? 0, "FSQ venues:", foursquareData?.venues?.length ?? 0, "Places:", placesData?.places?.length ?? 0, "Yelp:", yelpData?.businesses?.length ?? 0);
    return null;
  }
  allPOIs.sort((a, b) => a.distance - b.distance);
  const cafes = allPOIs.filter((p) => p.type === "cafe" || p.type === "coffee");
  const restaurants = allPOIs.filter((p) => p.type === "restaurant" || p.type === "fast_food");
  const gyms = allPOIs.filter((p) => p.type === "gym" || p.type === "fitness");
  const yoga = allPOIs.filter((p) => p.type === "yoga");
  const health = allPOIs.filter((p) => p.type === "health");
  const bars = allPOIs.filter((p) => p.type === "bar");
  const wellness = allPOIs.filter((p) => p.type === "wellness");
  const retail = allPOIs.filter((p) => p.type === "retail");
  const personal = allPOIs.filter((p) => p.type === "personal_services");
  const categoryFiltered = getPrimaryCompetitors(businessType, {
    cafes,
    restaurants,
    gyms,
    yoga,
    health,
    bars,
    wellness,
    retail,
    personal
  });
  const primaryNames = new Set(categoryFiltered.map((c) => c.name.toLowerCase()));
  const extra = forcedPrimaryPOIs.filter((p) => !primaryNames.has(p.name.toLowerCase()));
  const primaryCompetitors = [...categoryFiltered, ...extra].sort((a, b) => a.distance - b.distance);
  const ringDists = RING_DISTANCES[businessType.toLowerCase()] || RING_DISTANCES.default;
  const rings = {
    ring1: primaryCompetitors.filter((c) => c.distance <= ringDists[0]),
    ring2: primaryCompetitors.filter((c) => c.distance > ringDists[0] && c.distance <= ringDists[1]),
    ring3: primaryCompetitors.filter((c) => c.distance > ringDists[1] && c.distance <= ringDists[2])
  };
  const ringStats = {
    ring1: computeRingStats(rings.ring1),
    ring2: computeRingStats(rings.ring2),
    ring3: computeRingStats(rings.ring3)
  };
  let chainCount = 0;
  let independentCount = 0;
  const bcsChainNamesSeen = /* @__PURE__ */ new Set();
  const topChains = [];
  for (const c of primaryCompetitors) {
    if (c.isChain) {
      chainCount++;
      const label = (c.brand || c.name).trim();
      if (label && label !== "Unnamed" && !bcsChainNamesSeen.has(label.toLowerCase())) {
        bcsChainNamesSeen.add(label.toLowerCase());
        topChains.push(label);
      }
    } else {
      independentCount++;
    }
  }
  const chainDominance = primaryCompetitors.length > 0 ? Math.round(chainCount / primaryCompetitors.length * 100) / 100 : 0;
  const saturationScore = computeSaturation(primaryCompetitors, businessType);
  return {
    competitors: primaryCompetitors,
    rings,
    totalCount: primaryCompetitors.length,
    chainCount,
    independentCount,
    chainDominance,
    topChains: topChains.slice(0, 15),
    ringStats,
    saturationScore,
    stations: [],
    // No transit data from Foursquare/Places — MTA handles this
    amenities: { cafes, restaurants, gyms, yoga, health, bars, wellness, retail, personal },
    source: "overpass",
    // Keep type compatible; real source in tags
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function mapFSQCategoryToType(category, _businessType) {
  const lower = category.toLowerCase();
  if (lower.includes("specialty") && (lower.includes("coffee") || lower.includes("cafe"))) return "cafe";
  if (lower.includes("espresso") || lower.includes("latte") || lower.includes("matcha") || lower.includes("boba") || lower.includes("bubble tea")) return "cafe";
  if (lower.includes("coffee") || lower.includes("café") || lower.includes("cafe") || lower.includes("tea")) return "cafe";
  if (lower.includes("bakery") || lower.includes("pastry") || lower.includes("patisserie") || lower.includes("dessert") || lower.includes("donut") || lower.includes("bagel") || lower.includes("croissant")) return "cafe";
  if (lower.includes("fine dining") || lower.includes("steakhouse") || lower.includes("sushi") || lower.includes("seafood") || lower.includes("dim sum") || lower.includes("tasting menu")) return "restaurant";
  if (lower.includes("restaurant") || lower.includes("diner") || lower.includes("bistro") || lower.includes("eatery") || lower.includes("brasserie")) return "restaurant";
  if (lower.includes("fast food") || lower.includes("quick service") || lower.includes("burger") || lower.includes("pizza") || lower.includes("sandwich") || lower.includes("taco") || lower.includes("kebab")) return "fast_food";
  if (lower.includes("gym") || lower.includes("fitness") || lower.includes("crossfit") || lower.includes("pilates") || lower.includes("spin studio") || lower.includes("barre") || lower.includes("boxing")) return "gym";
  if (lower.includes("yoga") || lower.includes("meditation") || lower.includes("dance studio")) return "yoga";
  if (lower.includes("spa") || lower.includes("massage") || lower.includes("float") || lower.includes("facial") || lower.includes("med spa") || lower.includes("medspa") || lower.includes("waxing") || lower.includes("cryotherapy")) return "wellness";
  if (lower.includes("juice") || lower.includes("smoothie") || lower.includes("acai") || lower.includes("health food") || lower.includes("organic")) return "health";
  if (lower.includes("nightclub") || lower.includes("speakeasy") || lower.includes("cocktail bar") || lower.includes("wine bar") || lower.includes("taproom")) return "bar";
  if (lower.includes("bar") || lower.includes("pub") || lower.includes("lounge") || lower.includes("brewery")) return "bar";
  if (lower.includes("clothing") || lower.includes("apparel") || lower.includes("fashion") || lower.includes("boutique") || lower.includes("jewelry") || lower.includes("gift shop") || lower.includes("accessories")) return "retail";
  if (lower.includes("bookstore") || lower.includes("home goods") || lower.includes("specialty store") || lower.includes("retail")) return "retail";
  if (lower.includes("salon") || lower.includes("barbershop") || lower.includes("barber") || lower.includes("nail") || lower.includes("lash") || lower.includes("eyebrow") || lower.includes("blow dry") || lower.includes("tattoo")) return "personal_services";
  if (lower.includes("coworking") || lower.includes("co-working") || lower.includes("shared office") || lower.includes("business center")) return "coworking";
  if (lower.includes("dentist") || lower.includes("dental") || lower.includes("medical") || lower.includes("doctor") || lower.includes("clinic") || lower.includes("orthodont")) return "medical";
  return "other";
}
function mapYelpCategoryToType(categories, _businessType) {
  for (const cat of categories) {
    const alias = cat.alias.toLowerCase();
    const title = cat.title.toLowerCase();
    const s = alias + " " + title;
    if (s.includes("coffee") || s.includes("cafe") || s.includes("tea") || s.includes("bakeries") || s.includes("pastries") || s.includes("donuts") || s.includes("bagels")) return "cafe";
    if (s.includes("restaurant") || s.includes("burgers") || s.includes("pizza") || s.includes("sandwiches") || s.includes("sushi") || s.includes("steak") || s.includes("seafood") || s.includes("tacos")) return "restaurant";
    if (s.includes("food") || s.includes("diner") || s.includes("bistro")) return "restaurant";
    if (s.includes("fast_food") || s.includes("hotdogs") || s.includes("chicken_wings") || s.includes("kebab")) return "fast_food";
    if (s.includes("gym") || s.includes("fitness") || s.includes("yoga") || s.includes("pilates") || s.includes("barre") || s.includes("spin") || s.includes("crossfit")) return "gym";
    if (s.includes("spa") || s.includes("massage") || s.includes("facial") || s.includes("float") || s.includes("cryotherapy")) return "wellness";
    if (s.includes("bar") || s.includes("pub") || s.includes("nightlife") || s.includes("brewery") || s.includes("nightclub") || s.includes("cocktailbars") || s.includes("wine_bars")) return "bar";
    if (s.includes("juice") || s.includes("smoothie") || s.includes("health") || s.includes("acai")) return "health";
    if (s.includes("clothing") || s.includes("shopping") || s.includes("accessories") || s.includes("jewelry") || s.includes("bookstores") || s.includes("gifts")) return "retail";
    if (s.includes("salon") || s.includes("barbers") || s.includes("nails") || s.includes("lashes") || s.includes("tattoo") || s.includes("blowdry")) return "personal_services";
  }
  return "other";
}
function mapGoogleTypeToCompetitorType(types, businessType) {
  const typeSet = new Set(types.map((t) => t.toLowerCase()));
  if (typeSet.has("cafe") || typeSet.has("coffee_shop")) return "cafe";
  if (typeSet.has("restaurant") || typeSet.has("meal_delivery") || typeSet.has("meal_takeaway")) return "restaurant";
  if (typeSet.has("gym") || typeSet.has("health")) return "gym";
  if (typeSet.has("bar") || typeSet.has("night_club")) return "bar";
  if (typeSet.has("bakery")) return "cafe";
  if (businessType.toLowerCase().includes("cafe") || businessType.toLowerCase().includes("coffee")) {
    if (typeSet.has("food") || typeSet.has("store")) return null;
  }
  return null;
}
function getFallbackType(businessType) {
  const lower = businessType.toLowerCase();
  if (lower.includes("coffee") || lower.includes("cafe") || lower.includes("kiosk") || lower.includes("bakery") || lower.includes("wellness_beverage") || lower.includes("juice_bar")) return "cafe";
  if (lower.includes("restaurant") || lower.includes("fast_casual") || lower.includes("qsr")) return "restaurant";
  if (lower.includes("fitness") || lower.includes("gym")) return "gym";
  if (lower.includes("bar") || lower.includes("nightlife")) return "bar";
  if (lower.includes("wellness") || lower.includes("spa")) return "wellness";
  if (lower.includes("retail")) return "retail";
  if (lower.includes("personal")) return "personal_services";
  if (lower.includes("medical") || lower.includes("dental")) return "medical";
  return "cafe";
}
function isCompetitorCategory(type, businessType) {
  const lower = businessType.toLowerCase();
  if (lower.includes("coffee") || lower.includes("cafe") || lower.includes("kiosk") || lower.includes("wellness_beverage") || lower.includes("juice_bar") || lower.includes("bakery")) {
    return ["cafe", "coffee", "health"].includes(type);
  }
  if (lower.includes("restaurant") || lower.includes("fast_casual") || lower.includes("qsr") || lower.includes("food")) {
    return ["cafe", "restaurant", "fast_food"].includes(type);
  }
  if (lower.includes("fitness") || lower.includes("gym")) {
    return ["gym", "fitness", "yoga", "wellness"].includes(type);
  }
  if (lower.includes("bar") || lower.includes("nightlife")) {
    return ["bar"].includes(type);
  }
  if (lower.includes("wellness_spa") || lower.includes("spa")) {
    return ["wellness", "yoga", "health"].includes(type);
  }
  if (lower.includes("retail")) {
    return ["retail"].includes(type);
  }
  if (lower.includes("personal") || lower.includes("personal_services")) {
    return ["personal_services"].includes(type);
  }
  if (lower.includes("coworking")) return false;
  if (lower.includes("medical") || lower.includes("dental")) {
    return ["medical"].includes(type);
  }
  return ["cafe", "restaurant"].includes(type);
}
const LPC_BASE = "https://data.cityofnewyork.us/resource/buis-pvji.json";
async function fetchLPCData(lat, lng, radiusMeters = 100) {
  const cacheKey = IntelCache.locationKey(lat, lng, "lpc");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) {
    return cached.data;
  }
  try {
    const socrataGeoFilter = `within_circle(the_geom, ${lat}, ${lng}, ${radiusMeters})`;
    const url = new URL(LPC_BASE);
    url.searchParams.set("$where", socrataGeoFilter);
    url.searchParams.set("$limit", "100");
    const { socrataFetch } = await import("./socrata-fetch.js");
    const landmarks = await socrataFetch(url.toString(), "LPC");
    if (!landmarks) {
      if (cached) return cached.data;
      return null;
    }
    const lpcData = parseLPCResults(lat, lng, landmarks);
    intelCache.set(cacheKey, lpcData, TTL.LANDMARKS ?? 7 * 24 * 60 * 60 * 1e3);
    return lpcData;
  } catch (error) {
    console.error("LPC fetch error:", error);
    if (cached) return cached.data;
    return null;
  }
}
function parseLPCResults(queryLat, queryLng, landmarks) {
  if (!Array.isArray(landmarks)) {
    return createEmptyLPCData();
  }
  const results = landmarks;
  results.find((r) => {
    const coords = r.geometry?.coordinates || r.the_geom?.coordinates;
    if (!coords) return false;
    const [lng, lat] = coords;
    const distance = haversineMeters(queryLat, queryLng, lat, lng);
    return distance < 10;
  });
  const nearbyLandmarks = [];
  let isHistoricDistrict = false;
  let districtName = null;
  let buildingStatus = "None";
  for (const result of results) {
    const name = result.landmark_name || "Unknown Landmark";
    const type = result.landmark_status || "Individual Landmark";
    const coords = result.geometry?.coordinates || result.the_geom?.coordinates;
    if (!coords) continue;
    const [lng, lat] = coords;
    const distance = haversineMeters(queryLat, queryLng, lat, lng);
    if (distance < 100) {
      nearbyLandmarks.push({ name, type, distance, lat, lng });
      if (distance < 10) {
        buildingStatus = "Individual Landmark";
      }
    }
    if (result.historic_district === "Yes" || result.historic_district_name) {
      isHistoricDistrict = true;
      districtName = result.historic_district_name || "Unnamed Historic District";
      if (distance < 50) {
        buildingStatus = "In Historic District";
      }
    }
  }
  const signageRestricted = isHistoricDistrict || buildingStatus === "Individual Landmark";
  const restrictions = {
    exteriorAlterations: buildingStatus !== "None",
    interiorAlterations: buildingStatus === "Individual Landmark",
    // Stricter for individual landmarks
    signageRestricted,
    archaeologicalSite: false,
    // Would require additional dataset
    description: buildingStatus === "Individual Landmark" ? "Individual landmark status: façade, signage, and many interior changes require LPC approval." : buildingStatus === "In Historic District" ? "Located in historic district: exterior façade and signage are restricted. Many changes require LPC approval." : "No LPC restrictions apply at this address."
  };
  return {
    isHistoricDistrict,
    districtName,
    nearbyLandmarks: nearbyLandmarks.slice(0, 10),
    // Top 10 nearby
    signageRestrictions: signageRestricted,
    buildingStatus,
    restrictions,
    source: "nyc-lpc",
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function createEmptyLPCData() {
  return {
    isHistoricDistrict: false,
    districtName: null,
    nearbyLandmarks: [],
    signageRestrictions: false,
    buildingStatus: "None",
    restrictions: {
      exteriorAlterations: false,
      interiorAlterations: false,
      signageRestricted: false,
      archaeologicalSite: false,
      description: "No LPC restrictions apply at this address."
    },
    source: "nyc-lpc",
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
const STATION_BASE = "https://data.ny.gov/resource/5f5g-n3cz.json";
const RIDERSHIP_BASE = "https://data.ny.gov/resource/wujg-7c2s.json";
function estimateRidershipFallback(routes) {
  const lineCount = routes.length;
  if (lineCount >= 4) return 25e3;
  if (lineCount >= 3) return 15e3;
  if (lineCount >= 2) return 8e3;
  return 4e3;
}
const STATION_ALIASES = {
  // Times Square / 42 St complex
  "times sq-42 st": "times square - 42 street",
  "times square - 42 street": "times sq-42 st",
  "42 st-port authority bus terminal": "port authority bus terminal",
  // Union Square
  "14 st-union sq": "union sq - 14 st",
  "union sq - 14 st": "14 st-union sq",
  // Grand Central
  "grand central-42 st": "grand central - 42 st",
  "grand central - 42 st": "grand central-42 st",
  // 34 St / Herald Sq
  "34 st-herald sq": "herald square - 34 st",
  "herald square - 34 st": "34 st-herald sq",
  // 34 St / Penn Station (two complexes — keep them mapped consistently)
  "34 st-penn station": "penn station - 34 st",
  "penn station - 34 st": "34 st-penn station",
  // Atlantic Av-Barclays
  "atlantic av-barclays ctr": "atlantic avenue - barclays center",
  "atlantic avenue - barclays center": "atlantic av-barclays ctr",
  // Jay St-MetroTech
  "jay st-metrotech": "jay street - metrotech",
  "jay street - metrotech": "jay st-metrotech",
  // Court Sq complex
  "court sq": "court square",
  "court square": "court sq",
  // Lexington Av / 59 St
  "lexington av/59 st": "lexington av - 59 st",
  "lexington av - 59 st": "lexington av/59 st",
  // 59 St-Columbus Circle
  "59 st-columbus circle": "columbus circle - 59 st",
  "columbus circle - 59 st": "59 st-columbus circle"
};
function normalizeStationName(name) {
  if (!name) return "";
  let s = name.toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, "").trim();
  s = s.replace(/\s*-\s*/g, "-");
  s = s.replace(/\s*\/\s*/g, "/");
  s = s.replace(/\bst\b/g, "street");
  s = s.replace(/\bav\b/g, "avenue");
  s = s.replace(/\bave\b/g, "avenue");
  s = s.replace(/\bsq\b/g, "square");
  s = s.replace(/\bblvd\b/g, "boulevard");
  s = s.replace(/\bctr\b/g, "center");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a.length > b.length) {
    const tmp = a;
    a = b;
    b = tmp;
  }
  const prev = new Array(a.length + 1);
  const curr = new Array(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;
  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1,
        // insertion
        prev[i] + 1,
        // deletion
        prev[i - 1] + cost
        // substitution
      );
    }
    for (let i = 0; i <= a.length; i++) prev[i] = curr[i];
  }
  return prev[a.length];
}
function matchStationName(rows, targetName) {
  if (!rows.length || !targetName) return null;
  const target = normalizeStationName(targetName);
  const aliasTarget = STATION_ALIASES[target];
  if (aliasTarget) {
    for (const r of rows) {
      if (normalizeStationName(r.station_complex) === aliasTarget) return r;
    }
  }
  for (const r of rows) {
    if (normalizeStationName(r.station_complex) === target) return r;
  }
  for (const r of rows) {
    const n = normalizeStationName(r.station_complex);
    if (n.includes(target) || target.includes(n)) return r;
  }
  const threshold = Math.max(5, Math.floor(target.length * 0.25));
  let best = null;
  let bestScore = Infinity;
  for (const r of rows) {
    const score = levenshtein(target, normalizeStationName(r.station_complex));
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore <= threshold ? best : null;
}
async function fetchRealRidership(stationComplex, lat, lng) {
  try {
    const { socrataFetch } = await import("./socrata-fetch.js");
    const latDelta = 2e-3;
    const lngDelta = 3e-3;
    const url = `${RIDERSHIP_BASE}?$select=station_complex,sum(ridership) as total_ridership,count(*) as hour_count&$where=latitude between '${(lat - latDelta).toFixed(6)}' and '${(lat + latDelta).toFixed(6)}' AND longitude between '${(lng - lngDelta).toFixed(6)}' and '${(lng + lngDelta).toFixed(6)}' AND transit_timestamp > '2024-09-01'&$group=station_complex&$limit=5`;
    const rows = await socrataFetch(url, "MTA-Ridership");
    if (!rows || rows.length === 0) return null;
    const best = matchStationName(rows, stationComplex);
    if (!best) {
      console.warn(`[MTA-Ridership] DS-06 no fuzzy match for "${stationComplex}" within ${rows.length} bbox row(s) — returning null rather than wrong station`);
      return null;
    }
    const totalRidership = parseFloat(best.total_ridership) || 0;
    const hourCount = parseInt(best.hour_count) || 1;
    const avgHourly = totalRidership / hourCount;
    const avgDaily = Math.round(avgHourly * 24);
    const peakRatio = 0.4;
    const peakDaily = Math.round(avgDaily * peakRatio);
    const offPeakDaily = avgDaily - peakDaily;
    return {
      avgDaily,
      peakDaily,
      offPeakDaily,
      weekdayAvg: Math.round(avgDaily * 1.15),
      // weekdays run ~15% above average
      weekendAvg: Math.round(avgDaily * 0.65)
      // weekends run ~35% below average
    };
  } catch (err) {
    console.warn("[MTA-Ridership] Real ridership fetch failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
async function fetchMTARidership(lat, lng, radiusMeters = 800) {
  const cacheKey = IntelCache.locationKey(lat, lng, "mta-ridership");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const { db } = await import("./db-server.js").then((n) => n.n);
    const { sql } = await import("drizzle-orm");
    const dbRes = await db.execute(sql`
			SELECT * FROM nearby_mta_stations(${lat}, ${lng}, ${radiusMeters})
		`);
    const nearbyStations = Array.isArray(dbRes) ? dbRes : dbRes.rows;
    if (nearbyStations && nearbyStations.length > 0) {
      const stationCount = nearbyStations.length;
      const totalRidership = nearbyStations.reduce(
        (sum, s) => sum + (s.estimated_daily_ridership ?? 0),
        0
      );
      const allRoutesDb = new Set(nearbyStations.flatMap(
        (s) => (s.routes ?? "").split(",").map((r) => r.trim()).filter((x) => x.length > 0)
      ));
      const transitScore = computeTransitScore(totalRidership, stationCount, allRoutesDb.size);
      console.log(`[MTA-DB] ${stationCount} stations, ${totalRidership} riders, ${allRoutesDb.size} routes → transit score: ${transitScore}`);
      const result = {
        stations: nearbyStations.map((s) => ({
          stationComplex: s.station_name,
          ridership: s.estimated_daily_ridership,
          peakRidership: Math.round(s.estimated_daily_ridership * 0.4),
          offPeakRidership: Math.round(s.estimated_daily_ridership * 0.6),
          dayOfWeek: {},
          routes: (s.routes ?? "").split(",").map((r) => r.trim()).filter(Boolean),
          dataSource: "estimated"
        })),
        totalDailyRidership: totalRidership,
        avgDailyRidership: Math.round(totalRidership / stationCount),
        peakHourRatio: 0.4,
        transitScore: Math.max(0, Math.min(100, transitScore)),
        stationCount,
        routes: [...new Set(nearbyStations.flatMap((s) => (s.routes ?? "").split(",").map((r) => r.trim()).filter((x) => x.length > 0)))],
        source: "mta-ridership",
        dataQuality: "estimated",
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
        dataQualityConfidencePenalty: TRANSIT_THRESHOLDS.dataQualityPenalty.estimated
      };
      intelCache.set(cacheKey, result, TTL.TRANSIT);
      return result;
    }
  } catch (dbErr) {
    console.warn("[MTA-DB] Seeded lookup failed, falling back to live API:", dbErr);
  }
  try {
    const latDelta = radiusMeters / 111320;
    const lngDelta = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;
    const stationUrl = `${STATION_BASE}?$where=latitude between '${minLat}' and '${maxLat}' AND longitude between '${minLng}' and '${maxLng}'&$select=complex_id,stop_name,display_name,daytime_routes,latitude,longitude,borough,structure_type&$limit=30`;
    const { socrataFetch } = await import("./socrata-fetch.js");
    const raw = await socrataFetch(stationUrl, "MTA");
    if (!raw || !Array.isArray(raw)) return cached?.data || null;
    if (raw.length === 0) {
      const noTransit = {
        stations: [],
        totalDailyRidership: 0,
        avgDailyRidership: 0,
        peakHourRatio: 0,
        transitScore: 10,
        stationCount: 0,
        routes: [],
        source: "mta-ridership",
        dataQuality: "real",
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
        dataQualityConfidencePenalty: 0
      };
      intelCache.set(cacheKey, noTransit, TTL.TRANSIT);
      return noTransit;
    }
    const complexMap = /* @__PURE__ */ new Map();
    const allRoutes = /* @__PURE__ */ new Set();
    for (const s of raw) {
      const complexId = String(s.complex_id || s.stop_name);
      const routeStr = String(s.daytime_routes || "");
      const routes = routeStr.split(/\s+/).filter(Boolean);
      routes.forEach((r) => allRoutes.add(r));
      if (!complexMap.has(complexId)) {
        complexMap.set(complexId, {
          name: String(s.stop_name || ""),
          displayName: String(s.display_name || s.stop_name || ""),
          routes,
          lat: parseFloat(s.latitude) || 0,
          lng: parseFloat(s.longitude) || 0
        });
      } else {
        const existing = complexMap.get(complexId);
        for (const r of routes) {
          if (!existing.routes.includes(r)) existing.routes.push(r);
        }
      }
    }
    const stations = [];
    let totalDaily = 0;
    let totalPeak = 0;
    let totalOffPeak = 0;
    let realDataCount = 0;
    const ridershipPromises = [...complexMap.entries()].map(async ([, data]) => {
      const realData = await fetchRealRidership(data.displayName, data.lat, data.lng);
      if (realData && realData.avgDaily > 0) {
        realDataCount++;
        return {
          stationComplex: data.displayName,
          ridership: realData.avgDaily,
          peakRidership: realData.peakDaily,
          offPeakRidership: realData.offPeakDaily,
          dayOfWeek: {
            Mon: realData.weekdayAvg,
            Tue: realData.weekdayAvg,
            Wed: realData.weekdayAvg,
            Thu: realData.weekdayAvg,
            Fri: Math.round(realData.weekdayAvg * 0.95),
            Sat: realData.weekendAvg,
            Sun: Math.round(realData.weekendAvg * 0.85)
          },
          routes: data.routes,
          dataSource: "real"
        };
      } else {
        const estimated = estimateRidershipFallback(data.routes);
        return {
          stationComplex: data.displayName,
          ridership: estimated,
          peakRidership: Math.round(estimated * 0.4),
          offPeakRidership: Math.round(estimated * 0.6),
          dayOfWeek: {
            Mon: estimated,
            Tue: estimated,
            Wed: estimated,
            Thu: estimated,
            Fri: Math.round(estimated * 1.1),
            Sat: Math.round(estimated * 0.7),
            Sun: Math.round(estimated * 0.5)
          },
          routes: data.routes,
          dataSource: "estimated"
        };
      }
    });
    const results = await Promise.allSettled(ridershipPromises);
    for (const result2 of results) {
      if (result2.status === "fulfilled") {
        const station = result2.value;
        stations.push(station);
        totalDaily += station.ridership;
        totalPeak += station.peakRidership;
        totalOffPeak += station.offPeakRidership;
      }
    }
    stations.sort((a, b) => b.ridership - a.ridership);
    const avgDaily = stations.length > 0 ? Math.round(totalDaily / stations.length) : 0;
    const peakRatio = totalDaily > 0 ? Math.round(totalPeak / totalDaily * 100) / 100 : 0.4;
    const transitScore = computeTransitScore(totalDaily, stations.length, allRoutes.size);
    const dataQuality = realDataCount === stations.length ? "real" : realDataCount === 0 ? "estimated" : "mixed";
    const dataQualityConfidencePenalty = dataQuality === "estimated" ? TRANSIT_THRESHOLDS.dataQualityPenalty.estimated : dataQuality === "mixed" ? TRANSIT_THRESHOLDS.dataQualityPenalty.mixed : 0;
    const result = {
      stations,
      totalDailyRidership: totalDaily,
      avgDailyRidership: avgDaily,
      peakHourRatio: peakRatio,
      transitScore,
      stationCount: stations.length,
      routes: [...allRoutes].sort(),
      source: "mta-ridership",
      dataQuality,
      dataQualityConfidencePenalty,
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.TRANSIT);
    return result;
  } catch (err) {
    console.error("[MTA] Fetch error:", err);
    return cached?.data || null;
  }
}
function computeTransitScore(totalDailyRidership, stationCount, routeCount) {
  if (stationCount === 0) return 10;
  const { tier1, tier2, tier3, tier4, tier5, scores } = TRANSIT_THRESHOLDS.ridership;
  let score;
  if (totalDailyRidership >= tier1) score = scores.tier1;
  else if (totalDailyRidership >= tier2) score = scores.tier2 + Math.round((totalDailyRidership - tier2) / (tier1 - tier2) * (scores.tier1 - scores.tier2));
  else if (totalDailyRidership >= tier3) score = scores.tier3 + Math.round((totalDailyRidership - tier3) / (tier2 - tier3) * (scores.tier2 - scores.tier3));
  else if (totalDailyRidership >= tier4) score = scores.tier4 + Math.round((totalDailyRidership - tier4) / (tier3 - tier4) * (scores.tier3 - scores.tier4));
  else if (totalDailyRidership >= tier5) score = scores.tier5 + Math.round((totalDailyRidership - tier5) / (tier4 - tier5) * (scores.tier4 - scores.tier5));
  else score = scores.floor + Math.round(totalDailyRidership / tier5 * (scores.tier5 - scores.floor));
  const { stationBonus, routeBonus } = TRANSIT_THRESHOLDS;
  if (stationCount >= stationBonus.highThreshold) score += stationBonus.high;
  else if (stationCount >= stationBonus.lowThreshold) score += stationBonus.low;
  if (routeCount >= routeBonus.highThreshold) score += routeBonus.high;
  else if (routeCount >= routeBonus.lowThreshold) score += routeBonus.low;
  return Math.max(0, Math.min(100, score));
}
const DCA_BASE$1 = "https://data.cityofnewyork.us/resource/w7w3-xahh.json";
async function fetchDCALicenses(lat, lng, radiusMeters = 500) {
  const cacheKey = IntelCache.locationKey(lat, lng, "dca-licenses");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const bbox = socrataBoxWhere("latitude", "longitude", lat, lng, radiusMeters);
    const url = `${DCA_BASE$1}?$where=${bbox} AND license_status='Active'&$select=business_name,business_category,license_type,license_status,license_creation_date,address_building,address_street_name&$order=license_creation_date DESC&$limit=500`;
    const { socrataFetch } = await import("./socrata-fetch.js");
    const raw = await socrataFetch(url, "DCA");
    if (!raw || !Array.isArray(raw)) return cached?.data || null;
    const oneYearAgo = /* @__PURE__ */ new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    let newCount = 0;
    const industryCounts = {};
    const businesses = raw.map((r) => {
      const industry = r.business_category || "Unknown";
      industryCounts[industry] = (industryCounts[industry] || 0) + 1;
      const creationDate = r.license_creation_date?.split("T")[0] || "";
      if (creationDate && new Date(creationDate) > oneYearAgo) {
        newCount++;
      }
      return {
        name: r.business_name || "Unknown",
        industry,
        licenseType: r.license_type || "",
        status: r.license_status || "Active",
        startDate: creationDate,
        address: `${r.address_building || ""} ${r.address_street_name || ""}`.trim()
      };
    });
    const industryBreakdown = Object.entries(industryCounts).map(([industry, count]) => ({ industry, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    const newBusinessRate = businesses.length > 0 ? Math.round(newCount / businesses.length * 100) : 0;
    const radiusMi = radiusMeters / 1609.34;
    const areaSqMi = Math.PI * radiusMi * radiusMi;
    const businessDensity = areaSqMi > 0 ? Math.round(businesses.length / areaSqMi) : 0;
    const ecosystemScore = computeEcosystemScore(businesses.length, industryBreakdown.length, newBusinessRate, areaSqMi);
    const result = {
      businesses,
      totalCount: businesses.length,
      industryBreakdown,
      newBusinessRate,
      businessDensity,
      ecosystemScore,
      source: "dca-licenses",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.LICENSES);
    return result;
  } catch (e) {
    console.error("[DCA] Fetch error:", e);
    return cached?.data || null;
  }
}
function computeEcosystemScore(totalBusinesses, industryCount, newBusinessRate, areaSqMi) {
  if (areaSqMi === 0) return 50;
  const density = totalBusinesses / areaSqMi;
  let score;
  if (density >= 1e3) score = 80 + Math.min(15, Math.round((density - 1e3) / 1e3 * 15));
  else if (density >= 500) score = 65 + Math.round((density - 500) / 500 * 15);
  else if (density >= 200) score = 45 + Math.round((density - 200) / 300 * 20);
  else if (density >= 50) score = 25 + Math.round((density - 50) / 150 * 20);
  else score = Math.round(density / 50 * 25);
  if (industryCount >= 8) score += 10;
  else if (industryCount >= 5) score += 5;
  if (newBusinessRate >= 10 && newBusinessRate <= 30) score += 5;
  else if (newBusinessRate > 30) score -= 5;
  return Math.max(0, Math.min(100, score));
}
const DOB_PERMITS_BASE$1 = "https://data.cityofnewyork.us/resource/ipu4-2q9a.json";
const DOB_VIOLATIONS_BASE = "https://data.cityofnewyork.us/resource/3h2n-5cm9.json";
const HIGH_SEVERITY_TYPES = /* @__PURE__ */ new Set([
  "LL6291",
  "HBLVIO",
  "UB",
  "COMPBLD",
  "LL1081"
]);
async function fetchDOBData(lat, lng, radiusMeters = 300) {
  const cacheKey = IntelCache.locationKey(lat, lng, "dob");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const oneYearAgo = /* @__PURE__ */ new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dateStr = oneYearAgo.toISOString().split("T")[0];
    const { socrataFetch } = await import("./socrata-fetch.js");
    const permitsBbox = socrataBoxWhere("gis_latitude", "gis_longitude", lat, lng, radiusMeters);
    const [permitsRes, violationsRes] = await Promise.allSettled([
      socrataFetch(
        `${DOB_PERMITS_BASE$1}?$where=${permitsBbox} AND filing_date > '${dateStr}T00:00:00'&$select=job_type,job_doc___,filing_date,expiration_date,borough,house__,street_name&$order=filing_date DESC&$limit=200`,
        "DOB"
      ),
      socrataFetch(
        `${DOB_VIOLATIONS_BASE}?$limit=200`,
        "DOB"
      )
    ]);
    let permits = [];
    let newBuildingCount = 0;
    let demolitionCount = 0;
    if (permitsRes.status === "fulfilled" && permitsRes.value) {
      const rawPermits = permitsRes.value;
      if (Array.isArray(rawPermits)) {
        permits = rawPermits.map((r) => {
          const jobType = r.job_type || "";
          if (jobType === "NB") newBuildingCount++;
          if (jobType === "DM") demolitionCount++;
          return {
            jobType,
            description: r.job_doc___ || "",
            filingDate: r.filing_date?.split("T")[0] || "",
            expirationDate: r.expiration_date?.split("T")[0] || "",
            borough: r.borough || "",
            address: `${r.house__ || ""} ${r.street_name || ""}`.trim()
          };
        });
      }
    } else {
      console.error("[DOB] Permits API error");
    }
    let violations = [];
    let activeViolationCount = 0;
    if (violationsRes.status === "fulfilled" && violationsRes.value) {
      const rawViolations = violationsRes.value;
      if (Array.isArray(rawViolations)) {
        violations = rawViolations.map((r) => {
          const typeCode = r.violation_type_code || "";
          const isResolved = !!r.disposition_date;
          if (!isResolved) activeViolationCount++;
          let severity = "low";
          if (HIGH_SEVERITY_TYPES.has(typeCode)) severity = "high";
          else if (!isResolved) severity = "medium";
          return {
            violationType: r.violation_type || typeCode,
            description: r.violation_category || "",
            issueDate: r.issue_date?.split("T")[0] || "",
            status: isResolved ? "RESOLVED" : "ACTIVE",
            severity,
            address: `${r.house_number || ""} ${r.street || ""}`.trim()
          };
        });
      }
    } else {
      console.error("[DOB] Violations API error");
    }
    const developmentScore = computeDevelopmentScore(permits.length, newBuildingCount, demolitionCount);
    const riskScore = computeRiskScore(violations, activeViolationCount);
    const result = {
      permits,
      violations,
      permitCount: permits.length,
      activeViolationCount,
      newBuildingCount,
      demolitionCount,
      developmentScore,
      riskScore,
      source: "dob-permits",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.DOB);
    return result;
  } catch (e) {
    console.error("[DOB] Fetch error:", e);
    return cached?.data || null;
  }
}
function computeDevelopmentScore(totalPermits, newBuildings, demolitions) {
  if (totalPermits === 0) return 20;
  let score = 30;
  if (totalPermits >= 20) score += 40;
  else if (totalPermits >= 10) score += 30;
  else if (totalPermits >= 5) score += 20;
  else score += totalPermits * 4;
  score += Math.min(20, newBuildings * 10);
  if (demolitions > 3) score -= 10;
  return Math.max(0, Math.min(100, score));
}
function computeRiskScore(violations, activeCount) {
  if (violations.length === 0) return 5;
  let score = 10;
  score += Math.min(40, activeCount * 8);
  const highSeverity = violations.filter((v) => v.severity === "high").length;
  score += Math.min(30, highSeverity * 15);
  if (violations.length > 20) score += 15;
  else if (violations.length > 10) score += 10;
  return Math.max(0, Math.min(100, score));
}
const NYC311_BASE$1 = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";
const NOISE_TYPES = /* @__PURE__ */ new Set([
  "Noise - Residential",
  "Noise - Commercial",
  "Noise - Street/Sidewalk",
  "Noise - Vehicle",
  "Noise - Helicopter",
  "Noise - Park",
  "Noise"
]);
const SANITATION_TYPES = /* @__PURE__ */ new Set([
  "UNSANITARY CONDITION",
  "Dirty Conditions",
  "Sanitation Condition",
  "Missed Collection (All Materials)",
  "Overflowing Litter Baskets",
  "Derelict Vehicle",
  "Rodent",
  "Standing Water"
]);
const SAFETY_TYPES = /* @__PURE__ */ new Set([
  "Blocked Driveway",
  "Illegal Parking",
  "Street Light Condition",
  "Traffic Signal Condition",
  "Damaged Tree",
  "Sidewalk Condition",
  "Street Condition",
  "Fire Safety Director - Loss of Certification"
]);
async function fetch311Complaints(lat, lng, radiusMeters = 500) {
  const cacheKey = IntelCache.locationKey(lat, lng, "nyc-311");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const threeMonthsAgo = /* @__PURE__ */ new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().split("T")[0];
    const url = `${NYC311_BASE$1}?$where=within_circle(location,${lat},${lng},${radiusMeters}) AND created_date > '${dateStr}T00:00:00'&$select=complaint_type,descriptor,created_date,status,agency&$order=created_date DESC&$limit=500`;
    const { socrataFetch } = await import("./socrata-fetch.js");
    const raw = await socrataFetch(url, "311");
    if (!raw || !Array.isArray(raw)) return cached?.data || null;
    let noiseCount = 0;
    let sanitationCount = 0;
    let safetyCount = 0;
    const typeCounts = {};
    const complaints = raw.map((r) => {
      const type = r.complaint_type || "Other";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      if (NOISE_TYPES.has(type)) noiseCount++;
      else if (SANITATION_TYPES.has(type)) sanitationCount++;
      else if (SAFETY_TYPES.has(type)) safetyCount++;
      return {
        type,
        descriptor: r.descriptor || "",
        date: r.created_date?.split("T")[0] || "",
        status: r.status || "",
        agency: r.agency || ""
      };
    });
    const topTypes = Object.entries(typeCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    const radiusMi = radiusMeters / 1609.34;
    const areaSqMi = Math.PI * radiusMi * radiusMi;
    const complaintDensity = areaSqMi > 0 ? Math.round(complaints.length / areaSqMi) : 0;
    const annualizedCount = complaints.length * 4;
    const qualityScore = computeQualityScore(annualizedCount, areaSqMi, noiseCount, sanitationCount, safetyCount);
    const result = {
      complaints,
      totalCount: complaints.length,
      topTypes,
      noiseCount,
      sanitationCount,
      safetyCount,
      qualityScore,
      complaintDensity,
      source: "nyc-311",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.COMPLAINTS);
    return result;
  } catch (e) {
    console.error("[311] Fetch error:", e);
    if (cached?.data) return cached.data;
    return {
      complaints: [],
      totalCount: 0,
      topTypes: [],
      noiseCount: 0,
      sanitationCount: 0,
      safetyCount: 0,
      qualityScore: getBoroughQualityFloor(lat, lng),
      complaintDensity: 0,
      source: "nyc-311",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
function getBoroughQualityFloor(lat, lng) {
  return getBoroughQualityFloor$1(lat, lng);
}
function computeQualityScore(annualizedCount, areaSqMi, noiseCount, sanitationCount, safetyCount) {
  if (areaSqMi === 0) return 50;
  const density = annualizedCount / areaSqMi;
  let score;
  if (density < 700) score = 60 + Math.round((700 - density) / 700 * 15);
  else if (density < 2e3) score = 45 + Math.round((2e3 - density) / 1300 * 15);
  else if (density < 4e3) score = 28 + Math.round((4e3 - density) / 2e3 * 17);
  else score = Math.max(10, 28 - Math.round((density - 4e3) / 4e3 * 18));
  const total = noiseCount + sanitationCount + safetyCount;
  if (total > 0) {
    const noiseRatio = noiseCount / total;
    const sanitationRatio = sanitationCount / total;
    if (noiseRatio > 0.4) score -= 10;
    else if (noiseRatio > 0.2) score -= 5;
    if (sanitationRatio > 0.3) score -= 10;
    else if (sanitationRatio > 0.15) score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}
const PED_BASE = "https://data.cityofnewyork.us/resource/7ym2-wayt.json";
async function fetchPedestrianCounts(lat, lng, radiusMeters = 500) {
  const cacheKey = IntelCache.locationKey(lat, lng, "pedestrian");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const boro = approximateBorough(lat, lng);
    const url = `${PED_BASE}?$where=boro='${boro}' AND yr > '2022'&$select=street,fromst,tost,hh,vol,boro,yr,m,d,segmentid&$order=yr DESC,m DESC,d DESC&$limit=2000`;
    const { socrataFetch } = await import("./socrata-fetch.js");
    const raw = await socrataFetch(url, "Pedestrian");
    if (!raw || !Array.isArray(raw)) return cached?.data || null;
    const segmentMap = /* @__PURE__ */ new Map();
    for (const r of raw) {
      const segKey = r.segmentid || `${r.street || ""}-${r.fromst || ""}-${r.tost || ""}`;
      const vol = parseInt(r.vol) || 0;
      const hour = parseInt(r.hh) || 0;
      const isAM = hour < 12;
      if (!segmentMap.has(segKey)) {
        segmentMap.set(segKey, {
          street: r.street || "Unknown",
          fromst: r.fromst || "",
          tost: r.tost || "",
          segmentId: r.segmentid || segKey,
          boro: r.boro || "",
          date: `${r.yr || ""}-${r.m || ""}-${r.d || ""}`,
          amTotal: 0,
          pmTotal: 0,
          total: 0,
          recordCount: 0
        });
      }
      const seg = segmentMap.get(segKey);
      seg.total += vol;
      seg.recordCount++;
      if (isAM) {
        seg.amTotal += vol;
      } else {
        seg.pmTotal += vol;
      }
    }
    const counts = [];
    for (const [, seg] of segmentMap) {
      counts.push({
        location: seg.street,
        fromStreet: seg.fromst,
        toStreet: seg.tost,
        amCount: seg.amTotal,
        pmCount: seg.pmTotal,
        totalCount: seg.total,
        date: seg.date,
        borough: seg.boro,
        segmentId: seg.segmentId
      });
    }
    counts.sort((a, b) => b.totalCount - a.totalCount);
    const totalPedestrians = counts.reduce((sum, c) => sum + c.totalCount, 0);
    const totalAM = counts.reduce((sum, c) => sum + c.amCount, 0);
    const totalPM = counts.reduce((sum, c) => sum + c.pmCount, 0);
    const avgAM = counts.length > 0 ? Math.round(totalAM / counts.length) : 0;
    const avgPM = counts.length > 0 ? Math.round(totalPM / counts.length) : 0;
    const peakRatio = totalAM > 0 ? Math.round(totalPM / totalAM * 100) / 100 : 1;
    const footTrafficScore = computeFootTrafficScore(totalPedestrians, counts.length);
    const result = {
      counts: counts.slice(0, 20),
      // keep top 20 segments
      totalPedestrians,
      avgAMCount: avgAM,
      avgPMCount: avgPM,
      peakRatio,
      footTrafficScore,
      countLocationCount: counts.length,
      dataQuality: "real-hourly",
      source: "nyc-pedestrian",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.PEDESTRIAN);
    return result;
  } catch (e) {
    console.error("[Pedestrian] Fetch error:", e);
    return cached?.data || null;
  }
}
function approximateBorough(lat, lng) {
  return detectBorough(lat, lng)?.name ?? "Manhattan";
}
function computeFootTrafficScore(totalPedestrians, locationCount) {
  if (locationCount === 0) return 15;
  const avgPerLocation = totalPedestrians / locationCount;
  let score;
  if (avgPerLocation >= 5e3) score = 85 + Math.min(15, Math.round((avgPerLocation - 5e3) / 5e3 * 15));
  else if (avgPerLocation >= 1e3) score = 60 + Math.round((avgPerLocation - 1e3) / 4e3 * 25);
  else if (avgPerLocation >= 200) score = 35 + Math.round((avgPerLocation - 200) / 800 * 25);
  else score = 15 + Math.round(avgPerLocation / 200 * 20);
  if (locationCount >= 3) score += 5;
  else if (locationCount >= 2) score += 3;
  return Math.max(0, Math.min(100, score));
}
const PLUTO_ENDPOINT = "https://data.cityofnewyork.us/resource/64uk-42ks.json";
const LAND_USE_LABELS = {
  "01": "One & Two Family",
  "02": "Multi-Family Walkup",
  "03": "Multi-Family Elevator",
  "04": "Mixed Residential & Commercial",
  "05": "Commercial & Office",
  "06": "Industrial & Manufacturing",
  "07": "Transportation & Utility",
  "08": "Public Facilities & Institutions",
  "09": "Open Space & Recreation",
  "10": "Parking Facilities",
  "11": "Vacant Land"
};
async function fetchPLUTOData(lat, lng, radiusMeters = 300) {
  const cacheKey = IntelCache.locationKey(lat, lng, "pluto");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const bbox = socrataBoxWhere("latitude", "longitude", lat, lng, radiusMeters);
    const query = `$where=${bbox}&$select=bbl,address,zipcode,zonedist1,landuse,bldgclass,ownername,numfloors,unitstotal,numbldgs,lotarea,bldgarea,retailarea,officearea,yearbuilt,yearalter1,builtfar,residfar,commfar,facilfar,assessland,assesstot,latitude,longitude&$limit=200`;
    const { socrataFetch } = await import("./socrata-fetch.js");
    const appToken = private_env.NYC_OPEN_DATA_TOKEN;
    const raw = await socrataFetch(
      `${PLUTO_ENDPOINT}?${query}`,
      "PLUTO",
      appToken ? { timeout: 15e3 } : void 0
    );
    if (!raw?.length) return cached?.data || null;
    const lots = raw.map((r) => {
      const lotLat = parseFloat(r.latitude) || 0;
      const lotLng = parseFloat(r.longitude) || 0;
      const landUse = (r.landuse || "").padStart(2, "0");
      const residFar = parseFloat(r.residfar) || 0;
      const commFar = parseFloat(r.commfar) || 0;
      const facilFar = parseFloat(r.facilfar) || 0;
      const maxFAR = Math.max(residFar, commFar, facilFar);
      return {
        bbl: r.bbl || "",
        address: r.address || "",
        zipCode: r.zipcode || "",
        zoneDist1: r.zonedist1 || "",
        zoneDist2: r.zonedist2 || "",
        overlay1: r.overlay1 || "",
        landUse,
        landUseLabel: LAND_USE_LABELS[landUse] || "Unknown",
        bldgClass: r.bldgclass || "",
        ownType: r.ownertype || "",
        numFloors: parseFloat(r.numfloors) || 0,
        numUnits: parseInt(r.unitstotal) || 0,
        numBldgs: parseInt(r.numbldgs) || 0,
        lotArea: parseFloat(r.lotarea) || 0,
        bldgArea: parseFloat(r.bldgarea) || 0,
        retailArea: parseFloat(r.retailarea) || 0,
        officeArea: parseFloat(r.officearea) || 0,
        yearBuilt: parseInt(r.yearbuilt) || 0,
        yearAlter1: parseInt(r.yearalter1) || 0,
        builtFAR: parseFloat(r.builtfar) || 0,
        maxFAR,
        assessLand: parseFloat(r.assessland) || 0,
        assessTotal: parseFloat(r.assesstot) || 0,
        lat: lotLat,
        lng: lotLng,
        distance: haversineMeters(lat, lng, lotLat, lotLng)
      };
    }).sort((a, b) => a.distance - b.distance);
    const nearestLot = lots[0] || null;
    const zoneProfile = buildZoneProfile(lots);
    const buildingProfile = buildBuildingProfile(lots);
    const developmentPotential = scoreDevelopmentPotential(lots);
    const result = {
      lots,
      nearestLot,
      zoneProfile,
      buildingProfile,
      developmentPotential,
      source: "pluto",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.PLUTO);
    return result;
  } catch (e) {
    console.error("[PLUTO] Fetch error:", e);
    return cached?.data || null;
  }
}
function buildZoneProfile(lots) {
  const zoneTypes = {};
  let commercial = 0, residential = 0, manufacturing = 0, mixed = 0, overlays = 0;
  for (const lot of lots) {
    const zone = lot.zoneDist1;
    if (!zone) continue;
    zoneTypes[zone] = (zoneTypes[zone] || 0) + 1;
    const prefix = zone.charAt(0).toUpperCase();
    if (prefix === "C") commercial++;
    else if (prefix === "R") residential++;
    else if (prefix === "M") manufacturing++;
    if (lot.landUse === "04") mixed++;
    if (lot.overlay1) overlays++;
  }
  const total = lots.length || 1;
  const primaryZone = Object.entries(zoneTypes).sort(([, a], [, b]) => b - a)[0]?.[0] || "Unknown";
  return {
    primaryZone,
    zoneTypes,
    commercialOverlayCount: overlays,
    residentialPct: Math.round(residential / total * 100),
    commercialPct: Math.round(commercial / total * 100),
    manufacturingPct: Math.round(manufacturing / total * 100),
    mixedUsePct: Math.round(mixed / total * 100)
  };
}
function buildBuildingProfile(lots) {
  const withYear = lots.filter((l) => l.yearBuilt > 1800);
  const withFloors = lots.filter((l) => l.numFloors > 0);
  const withArea = lots.filter((l) => l.lotArea > 0);
  const withAssess = lots.filter((l) => l.assessTotal > 0 && l.bldgArea > 0);
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const avgYearBuilt = withYear.length > 0 ? Math.round(withYear.reduce((s, l) => s + l.yearBuilt, 0) / withYear.length) : 0;
  const floors = withFloors.map((l) => l.numFloors).sort((a, b) => a - b);
  const medianFloors = floors.length > 0 ? floors[Math.floor(floors.length / 2)] : 0;
  const avgLotSize = withArea.length > 0 ? Math.round(withArea.reduce((s, l) => s + l.lotArea, 0) / withArea.length) : 0;
  const totalRetailSqFt = lots.reduce((s, l) => s + l.retailArea, 0);
  const totalOfficeSqFt = lots.reduce((s, l) => s + l.officeArea, 0);
  const avgAssessedValuePerSqFt = withAssess.length > 0 ? Math.round(withAssess.reduce((s, l) => s + l.assessTotal / l.bldgArea, 0) / withAssess.length) : 0;
  const vacantLotCount = lots.filter((l) => l.landUse === "11").length;
  const recentAlterationCount = lots.filter((l) => l.yearAlter1 >= currentYear - 5).length;
  return {
    avgYearBuilt,
    medianFloors,
    avgLotSize,
    totalRetailSqFt,
    totalOfficeSqFt,
    avgAssessedValuePerSqFt,
    vacantLotCount,
    recentAlterationCount
  };
}
function scoreDevelopmentPotential(lots) {
  if (lots.length === 0) return 0;
  let score = 50;
  const withFAR = lots.filter((l) => l.maxFAR > 0 && l.builtFAR > 0);
  if (withFAR.length > 0) {
    const avgUtilization = withFAR.reduce((s, l) => s + l.builtFAR / l.maxFAR, 0) / withFAR.length;
    if (avgUtilization < 0.3) score += 20;
    else if (avgUtilization < 0.5) score += 15;
    else if (avgUtilization < 0.7) score += 8;
    else score -= 5;
  }
  const vacantCount = lots.filter((l) => l.landUse === "11").length;
  if (vacantCount >= 3) score += 15;
  else if (vacantCount >= 1) score += 8;
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const recentAlts = lots.filter((l) => l.yearAlter1 >= currentYear - 5).length;
  const altRate = recentAlts / lots.length;
  if (altRate > 0.2) score += 10;
  else if (altRate > 0.1) score += 5;
  const overlays = lots.filter((l) => l.overlay1).length;
  if (overlays > lots.length * 0.3) score += 5;
  return Math.max(0, Math.min(100, score));
}
const CAFE_BASE = "https://data.cityofnewyork.us/resource/qcdj-rwhu.json";
function toStatePlane(lat, lng) {
  const refLat = 40.7128, refLng = -74.006;
  const refX = 981e3, refY = 197e3;
  const ftPerDegLng = 312500;
  const ftPerDegLat = 363400;
  return {
    x: refX + (lng - refLng) * ftPerDegLng,
    y: refY + (lat - refLat) * ftPerDegLat
  };
}
async function fetchSidewalkCafes(lat, lng, radiusMeters = 500) {
  const cacheKey = IntelCache.locationKey(lat, lng, "sidewalk-cafes");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const { x, y } = toStatePlane(lat, lng);
    const radiusFt = radiusMeters * 3.28084;
    const minX = Math.round(x - radiusFt);
    const maxX = Math.round(x + radiusFt);
    const minY = Math.round(y - radiusFt);
    const maxY = Math.round(y + radiusFt);
    const url = `${CAFE_BASE}?$where=lic_status='Active' AND final_x between '${minX}' and '${maxX}' AND final_y between '${minY}' and '${maxY}'&$select=business_name,building,street,zip,swc_type,lic_status,swc_sq_ft,swc_tables,swc_chairs&$limit=200`;
    const { socrataFetch } = await import("./socrata-fetch.js");
    const raw = await socrataFetch(url, "SidewalkCafes");
    if (!raw || !Array.isArray(raw)) return cached?.data || null;
    const permits = raw.map((r) => ({
      businessName: String(r.business_name || ""),
      buildingNumber: String(r.building || ""),
      street: String(r.street || ""),
      borough: String(r.zip || ""),
      licenseType: String(r.swc_type || "Unknown"),
      licenseStatus: String(r.lic_status || "Unknown"),
      seatingCapacity: parseInt(String(r.swc_chairs || "0"), 10) || 0,
      issuanceDate: "",
      expirationDate: ""
    }));
    const activePermits = permits.filter(
      (p) => p.licenseStatus.toLowerCase().includes("active") || p.licenseStatus.toLowerCase().includes("issued")
    );
    const expiredPermits = permits.filter(
      (p) => p.licenseStatus.toLowerCase().includes("expired") || p.licenseStatus.toLowerCase().includes("revoked")
    );
    const typeCounts = /* @__PURE__ */ new Map();
    for (const p of permits) {
      const type = p.licenseType || "Unknown";
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }
    const typeBreakdown = Array.from(typeCounts.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
    const totalSeatingCapacity = permits.reduce((sum, p) => sum + p.seatingCapacity, 0);
    let vibrancySignal = 0;
    const activeCount = activePermits.length;
    if (activeCount === 0) vibrancySignal = 10;
    else if (activeCount <= 2) vibrancySignal = 35;
    else if (activeCount <= 5) vibrancySignal = 60;
    else if (activeCount <= 10) vibrancySignal = 80;
    else vibrancySignal = 90;
    if (totalSeatingCapacity > 100) vibrancySignal = Math.min(100, vibrancySignal + 5);
    if (typeBreakdown.length > 1) vibrancySignal = Math.min(100, vibrancySignal + 5);
    const result = {
      permits,
      totalCount: permits.length,
      activeCount,
      expiredCount: expiredPermits.length,
      typeBreakdown,
      totalSeatingCapacity,
      vibrancySignal,
      source: "sidewalk-cafes",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.WALKABILITY);
    return result;
  } catch (err) {
    console.error("[SidewalkCafes] Fetch error:", err);
    return cached?.data || null;
  }
}
const LIQUOR_BASE = "https://data.ny.gov/resource/9s3h-dpkz.json";
const ON_PREMISE_PATTERNS = [
  "restaurant",
  "food & beverage",
  "additional bar",
  "tavern",
  "hotel",
  "club",
  "catering",
  "caterer",
  "vessel",
  "theater",
  "stadium",
  "on premises"
];
const OFF_PREMISE_PATTERNS = [
  "liquor store",
  "drug store",
  "temporary retail",
  "off premises",
  "package",
  "wholesale liquor"
];
const RESTAURANT_WINE_PATTERNS = [
  "grocery",
  "wholesale wine",
  "wine wholesale",
  "beer/cider",
  "restaurant wine",
  "eating place beer",
  "restaurant beer"
];
function classifyLicense(description) {
  const lower = description.toLowerCase();
  if (ON_PREMISE_PATTERNS.some((p) => lower.includes(p))) return "on-premise";
  if (OFF_PREMISE_PATTERNS.some((p) => lower.includes(p))) return "off-premise";
  if (RESTAURANT_WINE_PATTERNS.some((p) => lower.includes(p))) return "restaurant-wine";
  return "other";
}
async function fetchLiquorLicenses(lat, lng, radiusMeters = 500) {
  const cacheKey = IntelCache.locationKey(lat, lng, "liquor-licenses");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const url = `${LIQUOR_BASE}?$where=within_circle(georeference,${lat},${lng},${radiusMeters})&$select=legalname,description,type,class,actualaddressofpremises,city,zipcode,effectivedate,expirationdate&$limit=300`;
    const { socrataFetch } = await import("./socrata-fetch.js");
    const raw = await socrataFetch(url, "LiquorLicenses");
    if (!raw || !Array.isArray(raw)) return cached?.data || null;
    const licenses = raw.map((r) => ({
      premiseName: String(r.legalname || ""),
      licenseType: String(r.description || ""),
      licenseClass: String(r.class || ""),
      address: String(r.actualaddressofpremises || ""),
      city: String(r.city || ""),
      zip: String(r.zipcode || ""),
      effectiveDate: String(r.effectivedate || ""),
      expirationDate: String(r.expirationdate || "")
    }));
    let onPremiseCount = 0;
    let offPremiseCount = 0;
    let restaurantWineCount = 0;
    const typeCounts = /* @__PURE__ */ new Map();
    for (const l of licenses) {
      const desc = l.licenseType;
      typeCounts.set(desc, (typeCounts.get(desc) || 0) + 1);
      const category = classifyLicense(desc);
      if (category === "on-premise") onPremiseCount++;
      else if (category === "off-premise") offPremiseCount++;
      else if (category === "restaurant-wine") restaurantWineCount++;
    }
    const typeBreakdown = Array.from(typeCounts.entries()).map(([type, count]) => ({ type, label: type, count })).sort((a, b) => b.count - a.count);
    let nightlifeDensity = 0;
    if (onPremiseCount === 0) nightlifeDensity = 5;
    else if (onPremiseCount <= 3) nightlifeDensity = 30;
    else if (onPremiseCount <= 10) nightlifeDensity = 55;
    else if (onPremiseCount <= 20) nightlifeDensity = 75;
    else nightlifeDensity = 90;
    const total = licenses.length;
    let vibrancySignal = 0;
    if (total === 0) vibrancySignal = 5;
    else if (total <= 5) vibrancySignal = 30;
    else if (total <= 15) vibrancySignal = 55;
    else if (total <= 30) vibrancySignal = 75;
    else vibrancySignal = 90;
    if (onPremiseCount > 0 && restaurantWineCount > 0) {
      vibrancySignal = Math.min(100, vibrancySignal + 5);
    }
    const result = {
      licenses,
      totalCount: licenses.length,
      typeBreakdown,
      onPremiseCount,
      offPremiseCount,
      restaurantWineCount,
      nightlifeDensity,
      vibrancySignal,
      source: "liquor-licenses",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.LICENSES);
    return result;
  } catch (err) {
    console.error("[LiquorLicenses] Fetch error:", err);
    return cached?.data || null;
  }
}
function getDateWindows() {
  const now = /* @__PURE__ */ new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  return {
    recentStart: sixMonthsAgo.toISOString().split("T")[0],
    recentEnd: now.toISOString().split("T")[0],
    priorStart: twelveMonthsAgo.toISOString().split("T")[0],
    priorEnd: sixMonthsAgo.toISOString().split("T")[0]
  };
}
function computeSlope(recent, prior) {
  if (prior === 0 && recent === 0) return { changePercent: 0, slope: "flat" };
  if (prior === 0) return { changePercent: 100, slope: "up" };
  const changePct = Math.round((recent - prior) / prior * 100);
  if (changePct > 10) return { changePercent: changePct, slope: "up" };
  if (changePct < -10) return { changePercent: changePct, slope: "down" };
  return { changePercent: changePct, slope: "flat" };
}
const DOB_PERMITS_BASE = "https://data.cityofnewyork.us/resource/ipu4-2q9a.json";
const DCA_BASE = "https://data.cityofnewyork.us/resource/w7w3-xahh.json";
const NYC311_BASE = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";
async function fetchSocrataCount(baseUrl, lat, lng, radiusMeters, dateColumn, startDate, endDate, geoColumn = "location", extraWhere = "") {
  const where = [
    `within_circle(${geoColumn},${lat},${lng},${radiusMeters})`,
    `${dateColumn}>='${startDate}'`,
    `${dateColumn}<'${endDate}'`,
    extraWhere
  ].filter(Boolean).join(" AND ");
  const url = `${baseUrl}?$select=count(*) as cnt&$where=${encodeURIComponent(where)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1e4);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json"
      }
    });
    clearTimeout(timer);
    if (!res.ok) return 0;
    const data = await res.json();
    return parseInt(String(data?.[0]?.cnt || "0"), 10);
  } catch {
    clearTimeout(timer);
    return 0;
  }
}
async function fetchMomentumData(lat, lng, radiusMeters = 500) {
  const cacheKey = IntelCache.locationKey(lat, lng, "momentum");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const { recentStart, recentEnd, priorStart, priorEnd } = getDateWindows();
    const [
      dobRecent,
      dobPrior,
      dcaRecent,
      dcaPrior,
      complaintsRecent,
      complaintsPrior
    ] = await Promise.allSettled([
      // DOB: new building + alteration permits
      fetchSocrataCount(
        DOB_PERMITS_BASE,
        lat,
        lng,
        radiusMeters,
        "filing_date",
        recentStart,
        recentEnd,
        "gis_latitude"
      ),
      fetchSocrataCount(
        DOB_PERMITS_BASE,
        lat,
        lng,
        radiusMeters,
        "filing_date",
        priorStart,
        priorEnd,
        "gis_latitude"
      ),
      // DCA: new business licenses
      fetchSocrataCount(
        DCA_BASE,
        lat,
        lng,
        radiusMeters,
        "license_creation_date",
        recentStart,
        recentEnd,
        "location"
      ),
      fetchSocrataCount(
        DCA_BASE,
        lat,
        lng,
        radiusMeters,
        "license_creation_date",
        priorStart,
        priorEnd,
        "location"
      ),
      // 311: complaints (declining = improving area)
      fetchSocrataCount(
        NYC311_BASE,
        lat,
        lng,
        radiusMeters,
        "created_date",
        recentStart,
        recentEnd,
        "location"
      ),
      fetchSocrataCount(
        NYC311_BASE,
        lat,
        lng,
        radiusMeters,
        "created_date",
        priorStart,
        priorEnd,
        "location"
      )
    ]);
    const extract = (r) => r.status === "fulfilled" ? r.value : 0;
    const dobRecentN = extract(dobRecent);
    const dobPriorN = extract(dobPrior);
    const dcaRecentN = extract(dcaRecent);
    const dcaPriorN = extract(dcaPrior);
    const complaintsRecentN = extract(complaintsRecent);
    const complaintsPriorN = extract(complaintsPrior);
    const dobSlope = computeSlope(dobRecentN, dobPriorN);
    const dcaSlope = computeSlope(dcaRecentN, dcaPriorN);
    const rawComplaintsSlope = computeSlope(complaintsRecentN, complaintsPriorN);
    const complaintsSlope = {
      changePercent: -rawComplaintsSlope.changePercent,
      // Invert: fewer complaints = positive
      slope: rawComplaintsSlope.slope === "up" ? "down" : rawComplaintsSlope.slope === "down" ? "up" : "flat"
    };
    const dobTrend = {
      recentCount: dobRecentN,
      priorCount: dobPriorN,
      changePercent: dobSlope.changePercent,
      slope: dobSlope.slope,
      label: "Building Permits"
    };
    const dcaTrend = {
      recentCount: dcaRecentN,
      priorCount: dcaPriorN,
      changePercent: dcaSlope.changePercent,
      slope: dcaSlope.slope,
      label: "New Businesses"
    };
    const complaintsTrend = {
      recentCount: complaintsRecentN,
      priorCount: complaintsPriorN,
      changePercent: complaintsSlope.changePercent,
      slope: complaintsSlope.slope,
      label: "Quality of Life"
    };
    const slopeScore = (s) => s === "up" ? 70 : s === "flat" ? 50 : 30;
    const compositeScore = Math.round(
      slopeScore(dobTrend.slope) * 0.4 + slopeScore(dcaTrend.slope) * 0.35 + slopeScore(complaintsTrend.slope) * 0.25
    );
    let direction;
    if (compositeScore > 58) direction = "growing";
    else if (compositeScore < 42) direction = "declining";
    else direction = "stable";
    const trendSignals = [];
    if (dobTrend.slope === "up") {
      trendSignals.push(`Building permits up ${dobTrend.changePercent}% (${dobPriorN} → ${dobRecentN}) — active development`);
    } else if (dobTrend.slope === "down") {
      trendSignals.push(`Building permits down ${Math.abs(dobTrend.changePercent)}% — development slowing`);
    }
    if (dcaTrend.slope === "up") {
      trendSignals.push(`New business licenses up ${dcaTrend.changePercent}% (${dcaPriorN} → ${dcaRecentN}) — commercial momentum`);
    } else if (dcaTrend.slope === "down") {
      trendSignals.push(`New business licenses down ${Math.abs(dcaTrend.changePercent)}% — commercial activity slowing`);
    }
    if (complaintsTrend.slope === "up") {
      trendSignals.push(`311 complaints declining ${Math.abs(rawComplaintsSlope.changePercent)}% — neighborhood quality improving`);
    } else if (complaintsTrend.slope === "down") {
      trendSignals.push(`311 complaints up ${rawComplaintsSlope.changePercent}% — quality of life pressure increasing`);
    }
    const result = {
      dobTrend,
      dcaTrend,
      complaintsTrend,
      compositeScore,
      direction,
      trendSignals,
      source: "momentum-v1",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.LICENSES);
    return result;
  } catch (err) {
    console.error("[Momentum] Computation error:", err);
    return cached?.data || null;
  }
}
const CATEGORY_MAP = {
  // Every canonical concept from businessTypeNormalizer.ts MUST have an entry.
  // Yelp category aliases: https://www.yelp.com/developers/documentation/v3/all_category_list
  "specialty_coffee": "coffee,coffeeroasteries",
  "cafe": "coffee,cafes",
  "coffee": "coffee,coffeeroasteries",
  "full_service_restaurant": "restaurants",
  "restaurant": "restaurants",
  "fast_casual": "restaurants",
  // Yelp doesn't differentiate fast casual
  "qsr": "hotdogs,burgers,pizza,sandwiches",
  "fast_food": "hotdogs,burgers,pizza,sandwiches",
  "bakery": "bakeries",
  "fitness_studio": "gyms,fitness,yoga,pilates",
  "fitness": "gyms,fitness",
  "gym": "gyms,fitness",
  "bar_nightlife": "bars,nightlife",
  "bar": "bars,cocktailbars,sportsbars",
  "wellness_spa": "spas,massage,skincare",
  "personal_services": "beautysvc,hair,barbers",
  "retail": "shopping",
  "coworking": "sharedofficespaces",
  "medical_office": "physicians,dentists,health",
  "wellness_beverage": "tea,bubbletea",
  "juice_bar": "juicebars,smoothies"
};
const YELP_BASE = "https://api.yelp.com/v3/businesses/search";
const CHAIN_NAMES = /* @__PURE__ */ new Set([
  "starbucks",
  "dunkin",
  "dunkin'",
  "peet",
  "peet's",
  "blue bottle",
  "gregory's",
  "gregorys",
  "joe coffee",
  "think coffee",
  "la colombe",
  "bluestone lane",
  "philz",
  "intelligentsia",
  "blank street",
  "birch coffee",
  "ground central",
  "city of saints",
  "felix roasting",
  "sweetgreen",
  "chipotle",
  "shake shack",
  "panera",
  "mcdonald's",
  "mcdonalds",
  "subway",
  "chick-fil-a",
  "wendy's",
  "burger king",
  "popeyes",
  "domino's",
  "pizza hut",
  "taco bell",
  "five guys",
  "wingstop",
  "equinox",
  "planet fitness",
  "orangetheory",
  "soulcycle",
  "blink fitness",
  "crunch",
  "barry's",
  "lifetime fitness"
]);
async function fetchYelpData(lat, lng, businessType = "cafe", radiusMeters = 800) {
  const apiKey = private_env.YELP_API_KEY;
  if (!apiKey) {
    console.warn("[Yelp] No API key configured — skipping");
    return null;
  }
  const cacheKey = IntelCache.locationKey(lat, lng, `yelp-${businessType}`);
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const categories = CATEGORY_MAP[businessType.toLowerCase()];
    if (!categories) {
      console.error(`[Yelp] ❌ CATEGORY_MAP miss for "${businessType}" — competitor query SKIPPED. Add this key to CATEGORY_MAP or fix the caller.`);
    }
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      radius: String(Math.min(radiusMeters, 4e4)),
      // Yelp max 40km
      limit: "50",
      // Yelp max per request
      sort_by: "distance"
    });
    if (categories) params.set("categories", categories);
    const { resilientFetch } = await import("./retry.js").then((n) => n.b);
    console.log("[Yelp] Fetching:", `${YELP_BASE}?latitude=${lat}&longitude=${lng}&categories=${categories}`);
    const res = await resilientFetch(`${YELP_BASE}?${params}`, {
      timeout: 1e4,
      label: "Yelp",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      }
    });
    console.log("[Yelp] API response status:", res.status);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.error("[Yelp] Invalid API key (key starts with:", apiKey.substring(0, 8) + "...)");
      } else if (res.status === 429) {
        console.warn("[Yelp] Rate limited — daily limit may be exceeded");
      } else {
        const body = await res.text();
        console.error("[Yelp] API error:", res.status, body.substring(0, 200));
      }
      return cached?.data || null;
    }
    const data = await res.json();
    const rawBusinesses = data.businesses || [];
    console.log("[Yelp] Search returned", rawBusinesses.length, "results (total:", data.total, ")");
    const businesses = rawBusinesses.map((b) => processYelpBusiness(b)).filter((b) => b !== null && !b.isClosed);
    const directCompetitors = businesses.filter(
      (b) => isDirectCompetitor(b.categories, businessType)
    );
    const chainCount = businesses.filter((b) => b.isChain).length;
    const independentCount = businesses.filter((b) => !b.isChain).length;
    const withRating = businesses.filter((b) => b.rating > 0);
    const avgRating = withRating.length > 0 ? +(withRating.reduce((s, b) => s + b.rating, 0) / withRating.length).toFixed(1) : 0;
    const avgReviewCount = withRating.length > 0 ? Math.round(withRating.reduce((s, b) => s + b.reviewCount, 0) / withRating.length) : 0;
    const withPrice = businesses.filter((b) => b.priceLevel > 0);
    const avgPriceLevel = withPrice.length > 0 ? +(withPrice.reduce((s, b) => s + b.priceLevel, 0) / withPrice.length).toFixed(1) : 0;
    const topRated = [...businesses].filter((b) => b.rating > 0).sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 5);
    const catCounts = /* @__PURE__ */ new Map();
    for (const b of businesses) {
      if (b.primaryCategory) {
        catCounts.set(b.primaryCategory, (catCounts.get(b.primaryCategory) || 0) + 1);
      }
    }
    const categoryBreakdown = Array.from(catCounts.entries()).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
    const result = {
      businesses,
      totalCount: businesses.length,
      directCompetitors,
      chainCount,
      independentCount,
      avgRating,
      avgReviewCount,
      avgPriceLevel,
      topRated,
      categoryBreakdown,
      source: "yelp",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, result, TTL.PLACES);
    return result;
  } catch (err) {
    console.error("[Yelp] Fetch error:", err);
    return cached?.data || null;
  }
}
function processYelpBusiness(raw) {
  if (!raw.name) return null;
  const categories = (raw.categories || []).map((c) => ({
    alias: c.alias || "",
    title: c.title || ""
  }));
  const priceStr = raw.price || "";
  const priceLevel = priceStr.length;
  const address = raw.location?.display_address?.join(", ") || raw.location?.address1 || "";
  return {
    id: raw.id || "",
    name: raw.name,
    categories,
    primaryCategory: categories[0]?.title || "Unknown",
    rating: raw.rating || 0,
    reviewCount: raw.review_count || 0,
    priceLevel,
    address,
    lat: raw.coordinates?.latitude || 0,
    lng: raw.coordinates?.longitude || 0,
    distance: raw.distance || 0,
    isClosed: raw.is_closed || false,
    isChain: isChain(raw.name),
    phone: raw.phone || "",
    url: raw.url || "",
    transactions: raw.transactions || []
  };
}
function isDirectCompetitor(categories, businessType) {
  const lower = businessType.toLowerCase();
  const aliases = categories.map((c) => c.alias.toLowerCase());
  if (lower.includes("coffee") || lower.includes("cafe")) {
    return aliases.some((a) => a.includes("coffee") || a.includes("cafe") || a.includes("tea") || a.includes("bakeries"));
  }
  if (lower.includes("restaurant") || lower.includes("food")) {
    return aliases.some(
      (a) => a.includes("restaurant") || a.includes("food") || a.includes("burgers") || a.includes("pizza") || a.includes("sandwiches")
    );
  }
  if (lower.includes("fitness") || lower.includes("gym")) {
    return aliases.some((a) => a.includes("gym") || a.includes("fitness") || a.includes("yoga") || a.includes("pilates"));
  }
  if (lower.includes("bar")) {
    return aliases.some((a) => a.includes("bar") || a.includes("pub") || a.includes("nightlife"));
  }
  return false;
}
function isChain(name) {
  const lower = name.toLowerCase();
  for (const chain of CHAIN_NAMES) {
    if (lower.includes(chain)) return true;
  }
  return false;
}
export {
  fetchCensusHousing as a,
  fetchWalkScore as b,
  fetchInspections as c,
  fetchCrimeData as d,
  fetchMTARidership as e,
  fetchCensusData as f,
  fetchLPCData as g,
  fetchDCALicenses as h,
  fetchDOBData as i,
  fetch311Complaints as j,
  fetchPedestrianCounts as k,
  fetchPLUTOData as l,
  fetchSidewalkCafes as m,
  fetchLiquorLicenses as n,
  fetchYelpData as o,
  fetchMomentumData as p,
  buildCompetitorsFromSources as q,
  scanCompetitors as s
};
