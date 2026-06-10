import { json } from "@sveltejs/kit";
import { I as IntelCache, i as intelCache, T as TTL } from "../../../../chunks/cache.js";
import { p as private_env } from "../../../../chunks/private.js";
import { h as haversineMeters } from "../../../../chunks/geo-math.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
const ACRIS_LEGALS = "https://data.cityofnewyork.us/resource/8h5j-fqxa.json";
const DOB_PERMITS = "https://data.cityofnewyork.us/resource/ipu4-2q9a.json";
const DCA_LICENSES = "https://data.cityofnewyork.us/resource/w7w3-xahh.json";
const PLUTO_BASE = "https://data.cityofnewyork.us/resource/64uk-42ks.json";
const SOCRATA_HEADERS = {
  "Accept": "application/json"
};
function fetchWithTimeout(url, timeoutMs = 15e3) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal, headers: SOCRATA_HEADERS }).finally(() => clearTimeout(timer));
}
async function fetchACRISSignals(lat, lng, radiusMeters) {
  const signals = [];
  try {
    const bbls = await getRetailBBLsNearby(lat, lng, radiusMeters);
    if (bbls.length === 0) return signals;
    const bblFilter = bbls.slice(0, 20).map((b) => `'${b}'`).join(",");
    const twoYearsAgo = /* @__PURE__ */ new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const dateStr = twoYearsAgo.toISOString().split("T")[0];
    const url = `${ACRIS_LEGALS}?$where=document_id IN (SELECT document_id FROM \`8h5j-fqxa\` WHERE borough||block||lot IN (${bblFilter})) AND recorded_filed > '${dateStr}'&$limit=100`;
    const termUrl = `${ACRIS_LEGALS}?$where=doc_type IN ('LEAS','LTPA','ASST','RPTT') AND recorded_filed > '${dateStr}'&$order=recorded_filed DESC&$limit=200`;
    const res = await fetchWithTimeout(termUrl);
    if (!res.ok) return signals;
    const records = await res.json();
    if (!Array.isArray(records)) return signals;
    for (const rec of records) {
      if (!rec.doc_type) continue;
      const bbl = `${rec.borough || ""}${rec.block || ""}${rec.lot || ""}`;
      if (bbl && bbls.includes(bbl)) {
        const addr = `${rec.street_number || ""} ${rec.street_name || ""}`.trim();
        if (rec.doc_type === "LTPA" || rec.doc_type === "RPTT") {
          signals.push({
            source: "acris",
            signal: "Lease termination filed",
            confidence: "high",
            leadTime: "0–3 months",
            detail: `Lease surrender/termination recorded at ${addr || bbl}`,
            score: 50,
            detectedAt: rec.recorded_filed || (/* @__PURE__ */ new Date()).toISOString()
          });
        } else if (rec.doc_type === "LEAS") {
          const goodThrough = rec.good_through_date ? new Date(rec.good_through_date) : null;
          const now = /* @__PURE__ */ new Date();
          const sixMonthsOut = /* @__PURE__ */ new Date();
          sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);
          if (goodThrough && goodThrough > now && goodThrough < sixMonthsOut) {
            signals.push({
              source: "acris",
              signal: "Lease expiring soon (no renewal filed)",
              confidence: "high",
              leadTime: "3–12 months",
              detail: `Lease at ${addr || bbl} expires ${goodThrough.toLocaleDateString()}`,
              score: 45,
              detectedAt: rec.recorded_filed || (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("[VACANCY/ACRIS]", e instanceof Error ? e.message : e);
  }
  return signals;
}
async function getRetailBBLsNearby(lat, lng, radiusMeters) {
  try {
    const url = `${PLUTO_BASE}?$where=within_circle(the_geom,${lat},${lng},${radiusMeters}) AND (landuse='05' OR retailarea > 0 OR bldgclass LIKE 'K%' OR bldgclass LIKE 'R%')&$select=bbl,address,latitude,longitude,retailarea,bldgclass,ownername,zonedist1,yearbuilt&$limit=100`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const lots = await res.json();
    return lots.filter((l) => l.bbl).map((l) => l.bbl);
  } catch {
    return [];
  }
}
async function fetchDOBVacancySignals(lat, lng, radiusMeters) {
  const signals = [];
  try {
    const oneYearAgo = /* @__PURE__ */ new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dateStr = oneYearAgo.toISOString().split("T")[0];
    const latRange = radiusMeters / 111e3;
    const lngRange = radiusMeters / (111e3 * Math.cos(lat * Math.PI / 180));
    const geoUrl = `${DOB_PERMITS}?$where=gis_latitude > '${(lat - latRange).toFixed(6)}' AND gis_latitude < '${(lat + latRange).toFixed(6)}' AND gis_longitude > '${(lng - lngRange).toFixed(6)}' AND gis_longitude < '${(lng + lngRange).toFixed(6)}' AND filing_date > '${dateStr}' AND job_type IN ('DM','A1')&$order=filing_date DESC&$limit=50`;
    const res = await fetchWithTimeout(geoUrl);
    if (!res.ok) return signals;
    const permits = await res.json();
    if (!Array.isArray(permits)) return signals;
    const now = /* @__PURE__ */ new Date();
    for (const p of permits) {
      const addr = `${p.house__ || ""} ${p.street_name || ""}`.trim();
      const pLat = parseFloat(p.gis_latitude || "0");
      const pLng = parseFloat(p.gis_longitude || "0");
      const dist = haversineMeters(lat, lng, pLat, pLng);
      if (dist > radiusMeters) continue;
      if (p.job_type === "DM") {
        signals.push({
          source: "dob",
          signal: "Demolition permit filed",
          confidence: "medium",
          leadTime: "1–6 months",
          detail: `Demolition filing at ${addr}. Current tenant likely gone.`,
          score: 25,
          detectedAt: p.filing_date || now.toISOString()
        });
      } else if (p.job_type === "A1") {
        const lastAction = p.latest_action_date ? new Date(p.latest_action_date) : null;
        const filingDate = p.filing_date ? new Date(p.filing_date) : null;
        const monthsIdle = lastAction && filingDate ? (now.getTime() - lastAction.getTime()) / (30 * 24 * 60 * 60 * 1e3) : 0;
        if (monthsIdle > 12) {
          signals.push({
            source: "dob",
            signal: "Build-out permit idle > 12 months",
            confidence: "medium",
            leadTime: "Ongoing",
            detail: `A1 permit at ${addr} filed but no inspections in ${Math.round(monthsIdle)} months — space likely sitting empty.`,
            score: 20,
            detectedAt: p.filing_date || now.toISOString()
          });
        } else {
          signals.push({
            source: "dob",
            signal: "Major alteration / gut renovation",
            confidence: "medium",
            leadTime: "1–6 months",
            detail: `Major alteration permit at ${addr}. Ground-floor retail unit may be turning over.`,
            score: 25,
            detectedAt: p.filing_date || now.toISOString()
          });
        }
      }
    }
  } catch (e) {
    console.error("[VACANCY/DOB]", e instanceof Error ? e.message : e);
  }
  return signals;
}
async function fetchGoogleVacancySignals(lat, lng, radiusMeters) {
  const signals = [];
  const apiKey = private_env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return signals;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=store|restaurant|cafe|bar&key=${apiKey}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return signals;
    const data = await res.json();
    const results = data.results || [];
    for (const place of results) {
      if (place.business_status === "CLOSED_PERMANENTLY") {
        const pLat = place.geometry?.location?.lat || 0;
        const pLng = place.geometry?.location?.lng || 0;
        signals.push({
          source: "google",
          signal: "Business permanently closed",
          confidence: "high",
          leadTime: "0–2 months",
          detail: `"${place.name}" at ${place.vicinity} marked permanently closed on Google Maps.`,
          score: 40,
          detectedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (place.user_ratings_total && place.user_ratings_total > 20) {
      }
    }
  } catch (e) {
    console.error("[VACANCY/GOOGLE]", e instanceof Error ? e.message : e);
  }
  return signals;
}
async function fetchLicenseVacancySignals(lat, lng, radiusMeters) {
  const signals = [];
  try {
    const sixMonthsAgo = /* @__PURE__ */ new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateStr = sixMonthsAgo.toISOString().split("T")[0];
    const url = `${DCA_LICENSES}?$where=within_circle(location,${lat},${lng},${radiusMeters}) AND license_status='Inactive' AND license_expiration_date > '${dateStr}'&$select=business_name,industry,license_type,license_status,license_expiration_date,address_building,address_street_name,latitude,longitude&$order=license_expiration_date DESC&$limit=100`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return signals;
    const licenses = await res.json();
    if (!Array.isArray(licenses)) return signals;
    for (const lic of licenses) {
      const addr = `${lic.address_building || ""} ${lic.address_street_name || ""}`.trim();
      const bizName = lic.business_name || "Unknown business";
      const expDate = lic.license_expiration_date ? new Date(lic.license_expiration_date) : null;
      signals.push({
        source: "dca",
        signal: "Business license expired / not renewed",
        confidence: "medium",
        leadTime: "0–3 months",
        detail: `"${bizName}" (${lic.industry || "retail"}) at ${addr} — license expired${expDate ? " " + expDate.toLocaleDateString() : ""}.`,
        score: 20,
        detectedAt: lic.license_expiration_date || (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  } catch (e) {
    console.error("[VACANCY/DCA]", e instanceof Error ? e.message : e);
  }
  return signals;
}
async function fetchPLUTOVacancyData(lat, lng, radiusMeters) {
  const signals = [];
  let lots = [];
  try {
    const url = `${PLUTO_BASE}?$where=within_circle(the_geom,${lat},${lng},${radiusMeters}) AND (landuse='05' OR retailarea > 0 OR bldgclass LIKE 'K%' OR bldgclass LIKE 'R%')&$select=bbl,address,zipcode,zonedist1,bldgclass,ownername,numfloors,retailarea,bldgarea,yearbuilt,yearalter1,builtfar,maxallowfar,latitude,longitude,landuse&$limit=200`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { lots: [], signals: [] };
    lots = await res.json();
    if (!Array.isArray(lots)) return { lots: [], signals: [] };
  } catch (e) {
    console.error("[VACANCY/PLUTO]", e instanceof Error ? e.message : e);
  }
  return { lots, signals };
}
function computeChurnSignals(_lat, _lng, dcaSignals, googleSignals) {
  const signals = [];
  if (dcaSignals.length > 0 && googleSignals.length > 0) {
    signals.push({
      source: "churn-model",
      signal: "Multiple closure signals corroborate",
      confidence: "weak",
      leadTime: "3–12 months",
      detail: `${dcaSignals.length} expired licenses + ${googleSignals.length} closed businesses in this area — elevated churn pattern.`,
      score: 10,
      detectedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  return signals;
}
function scoreVacancy(signals) {
  if (signals.length === 0) return 0;
  let score = 0;
  for (const s of signals) {
    const detectedDate = new Date(s.detectedAt);
    const daysAgo = (Date.now() - detectedDate.getTime()) / (24 * 60 * 60 * 1e3);
    const decayFactor = Math.max(0.3, 1 - daysAgo / 365);
    score += s.score * decayFactor;
  }
  return Math.min(100, Math.round(score));
}
function classifyVacancy(score) {
  if (score >= 70) return "likely_available";
  if (score >= 40) return "coming_available";
  return null;
}
function buildListings(allSignals, plutoLots, searchLat, searchLng) {
  const addressGroups = /* @__PURE__ */ new Map();
  for (const s of allSignals) {
    const addrMatch = s.detail.match(/at (.+?)(?:\.|$)/);
    const addr = addrMatch?.[1]?.trim() || "Unknown";
    const key = addr.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
    const group = addressGroups.get(key) || [];
    group.push(s);
    addressGroups.set(key, group);
  }
  const listings = [];
  for (const [_key, signals] of addressGroups) {
    const vacancyScore = scoreVacancy(signals);
    const status = classifyVacancy(vacancyScore);
    if (!status) continue;
    const addrFromSignal = signals[0]?.detail.match(/at (.+?)(?:\.|$)/)?.[1]?.trim() || "";
    const matchedLot = plutoLots.find(
      (l) => l.address && addrFromSignal.toLowerCase().includes(l.address.toLowerCase().split(" ").slice(0, 2).join(" "))
    );
    const lotLat = matchedLot ? parseFloat(matchedLot.latitude || "0") : 0;
    const lotLng = matchedLot ? parseFloat(matchedLot.longitude || "0") : 0;
    const distance = lotLat && lotLng ? haversineMeters(searchLat, searchLng, lotLat, lotLng) : 0;
    const googleSignal = signals.find((s) => s.source === "google");
    const dcaSignal = signals.find((s) => s.source === "dca");
    const previousTenant = googleSignal?.detail.match(/"([^"]+)"/)?.[1] || dcaSignal?.detail.match(/"([^"]+)"/)?.[1] || null;
    const previousType = dcaSignal?.detail.match(/\(([^)]+)\)/)?.[1] || null;
    const earliestSignal = signals.reduce((earliest, s) => {
      const d = new Date(s.detectedAt);
      return d < earliest ? d : earliest;
    }, /* @__PURE__ */ new Date());
    const daysOnMarket = Math.round((Date.now() - earliestSignal.getTime()) / (24 * 60 * 60 * 1e3));
    listings.push({
      id: matchedLot?.bbl || `vac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      address: matchedLot?.address || addrFromSignal || "Address pending",
      lat: lotLat || searchLat,
      lng: lotLng || searchLng,
      vacancyScore,
      status,
      signals,
      signalCount: signals.length,
      sqft: matchedLot?.retailarea ? parseInt(matchedLot.retailarea) : matchedLot?.bldgarea ? Math.round(parseInt(matchedLot.bldgarea) * 0.3) : null,
      bldgClass: matchedLot?.bldgclass || null,
      zoneDist: matchedLot?.zonedist1 || null,
      yearBuilt: matchedLot?.yearbuilt ? parseInt(matchedLot.yearbuilt) : null,
      ownerName: matchedLot?.ownername || null,
      retailArea: matchedLot?.retailarea ? parseInt(matchedLot.retailarea) : null,
      previousTenant,
      previousType,
      closedDate: googleSignal?.detectedAt || dcaSignal?.detectedAt || null,
      distance,
      daysOnMarket
    });
  }
  return listings.sort((a, b) => {
    if (a.status !== b.status) return a.status === "likely_available" ? -1 : 1;
    return b.vacancyScore - a.vacancyScore;
  });
}
async function detectVacancies(lat, lng, radiusMeters = 500) {
  const cacheKey = IntelCache.locationKey(lat, lng, "vacancy");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  const [
    acrisSignals,
    dobSignals,
    googleSignals,
    licenseSignals,
    plutoData
  ] = await Promise.all([
    fetchACRISSignals(lat, lng, radiusMeters),
    fetchDOBVacancySignals(lat, lng, radiusMeters),
    fetchGoogleVacancySignals(lat, lng, radiusMeters),
    fetchLicenseVacancySignals(lat, lng, radiusMeters),
    fetchPLUTOVacancyData(lat, lng, radiusMeters)
  ]);
  const churnSignals = computeChurnSignals(lat, lng, licenseSignals, googleSignals);
  const allSignals = [
    ...acrisSignals,
    ...dobSignals,
    ...googleSignals,
    ...licenseSignals,
    ...plutoData.signals,
    ...churnSignals
  ];
  console.log(
    `[VACANCY] Pipeline results at ${lat.toFixed(4)},${lng.toFixed(4)} (${radiusMeters}m):`,
    `ACRIS=${acrisSignals.length}, DOB=${dobSignals.length}, Google=${googleSignals.length},`,
    `DCA=${licenseSignals.length}, PLUTO lots=${plutoData.lots.length}, Churn=${churnSignals.length},`,
    `Total signals=${allSignals.length}`
  );
  const listings = buildListings(allSignals, plutoData.lots, lat, lng);
  console.log(`[VACANCY] ${listings.length} listings above threshold from ${allSignals.length} signals`);
  const result = {
    listings,
    totalScanned: plutoData.lots.length,
    likelyAvailable: listings.filter((l) => l.status === "likely_available").length,
    comingAvailable: listings.filter((l) => l.status === "coming_available").length,
    searchRadiusMeters: radiusMeters,
    signalBreakdown: {
      acris: acrisSignals.length,
      dob: dobSignals.length,
      google: googleSignals.length,
      dca: licenseSignals.length,
      plutoLots: plutoData.lots.length,
      churn: churnSignals.length,
      totalSignals: allSignals.length
    },
    source: "vacancy-detection",
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  intelCache.set(cacheKey, result, TTL.COMPETITORS);
  return result;
}
const GET = async ({ url, request }) => {
  const limited = rateLimit(request, RATE_LIMITS.intel);
  if (limited) return limited;
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const radius = parseInt(url.searchParams.get("radius") || "500");
  if (isNaN(lat) || isNaN(lng)) {
    return json({ error: "lat and lng are required" }, { status: 400 });
  }
  if (radius < 100 || radius > 2e3) {
    return json({ error: "radius must be between 100 and 2000 meters" }, { status: 400 });
  }
  try {
    const result = await detectVacancies(lat, lng, radius);
    return json(result);
  } catch (e) {
    console.error("[API/VACANCIES]", e);
    return json({ error: "Vacancy detection failed" }, { status: 500 });
  }
};
export {
  GET
};
