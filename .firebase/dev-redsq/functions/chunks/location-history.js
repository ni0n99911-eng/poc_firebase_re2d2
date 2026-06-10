import { i as intelCache, T as TTL } from "./cache.js";
import { socrataFetch } from "./socrata-fetch.js";
const DOHMH_BASE = "https://data.cityofnewyork.us/resource/43nn-pn8j.json";
const DCA_BASE = "https://data.cityofnewyork.us/resource/w7w3-xahh.json";
function normalizeStreetName(name) {
  return name.toUpperCase().replace(/\b(AVENUE|STREET|BOULEVARD|ROAD|PLACE|DRIVE|LANE|COURT|PARKWAY)\b/g, (m) => {
    const abbr = {
      AVENUE: "AVE",
      STREET: "ST",
      BOULEVARD: "BLVD",
      ROAD: "RD",
      PLACE: "PL",
      DRIVE: "DR",
      LANE: "LN",
      COURT: "CT",
      PARKWAY: "PKWY"
    };
    return abbr[m] || m;
  }).trim();
}
function parseAddressParts(address) {
  const match = address.match(/^(\d+(?:-\d+)?)\s+(.+?)(?:,.*)?$/);
  if (!match) return null;
  return {
    building: match[1],
    street: normalizeStreetName(match[2].trim())
  };
}
function calcTenure(openDate, closeDate) {
  if (!openDate) return { months: null, label: "Unknown", status: "unknown" };
  const start = new Date(openDate);
  const end = closeDate ? new Date(closeDate) : /* @__PURE__ */ new Date();
  const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const years = Math.floor(monthsDiff / 12);
  const months = monthsDiff % 12;
  const label = closeDate ? years > 0 ? `${years} yr${years > 1 ? "s" : ""} ${months > 0 ? months + " mo" : ""}`.trim() : `${months} mo` : "Active";
  const status = closeDate ? "closed" : "active";
  return { months: monthsDiff, label, status };
}
async function fetchDohmhHistory(building, street) {
  const streetEscaped = street.replace(/'/g, "''");
  const firstWord = streetEscaped.split(" ")[0];
  const url = `${DOHMH_BASE}?$where=building='${building}' AND (street='${streetEscaped}' OR street LIKE '${firstWord}%')&$select=dba,cuisine_description,inspection_date,camis&$order=inspection_date ASC&$limit=500`;
  const raw = await socrataFetch(url, "DOHMH-History");
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  const byId = /* @__PURE__ */ new Map();
  for (const r of raw) {
    const id = r.camis || `${r.dba}-${r.building}`;
    if (!byId.has(id)) {
      byId.set(id, { name: r.dba || "Unknown", cuisine: r.cuisine_description || "Restaurant", dates: [] });
    }
    if (r.inspection_date) byId.get(id).dates.push(r.inspection_date);
  }
  const results = [];
  const now = /* @__PURE__ */ new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().split("T")[0];
  for (const [camis, biz] of byId) {
    if (biz.dates.length === 0) continue;
    const sorted = biz.dates.sort();
    const openDate = sorted[0].split("T")[0];
    const lastDate = sorted[sorted.length - 1].split("T")[0];
    const isActive = lastDate >= sixMonthsAgo;
    const closeDate = isActive ? null : lastDate;
    const tenure = calcTenure(openDate, closeDate);
    results.push({
      name: titleCase(biz.name),
      category: biz.cuisine,
      source: "dohmh",
      openDate,
      closeDate,
      tenureMonths: tenure.months,
      tenureLabel: tenure.label,
      status: tenure.status,
      camis
    });
  }
  return results;
}
async function fetchDcaHistory(building, street) {
  const streetEscaped = street.replace(/'/g, "''");
  const firstWord = streetEscaped.split(" ")[0];
  const url = `${DCA_BASE}?$where=address_building='${building}' AND (address_street_name='${streetEscaped}' OR address_street_name LIKE '${firstWord}%')&$select=business_name,business_category,license_creation_date,license_expiration_date,license_status,licenseid&$order=license_creation_date ASC&$limit=200`;
  const raw = await socrataFetch(url, "DCA-History");
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((r) => {
    const openDate = r.license_creation_date?.split("T")[0] || null;
    const isActive = r.license_status === "Active";
    const closeDate = isActive ? null : r.license_expiration_date?.split("T")[0] || null;
    const tenure = calcTenure(openDate, closeDate);
    return {
      name: titleCase(r.business_name || "Unknown"),
      category: r.business_category || "Business",
      source: "dca",
      openDate,
      closeDate,
      tenureMonths: tenure.months,
      tenureLabel: tenure.label,
      status: tenure.status,
      licenseId: r.licenseid
    };
  }).filter((b) => b.name && b.name !== "Unknown");
}
function mergeAndDedupe(dohmh, dca) {
  const combined = [...dohmh];
  const dohmhNames = new Set(dohmh.map((b) => b.name.toLowerCase().replace(/\s+/g, "")));
  for (const dcaBiz of dca) {
    const normalized = dcaBiz.name.toLowerCase().replace(/\s+/g, "");
    if (!dohmhNames.has(normalized)) {
      combined.push(dcaBiz);
    }
  }
  return combined.sort((a, b) => {
    if (!a.openDate && !b.openDate) return 0;
    if (!a.openDate) return 1;
    if (!b.openDate) return -1;
    return b.openDate.localeCompare(a.openDate);
  });
}
async function fetchLocationHistory(address, lat, lng) {
  const cacheKey = `location-history:${address.toLowerCase().replace(/\s+/g, "-")}`;
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  const parts = parseAddressParts(address);
  if (!parts) return null;
  const [dohmhResult, dcaResult] = await Promise.allSettled([
    fetchDohmhHistory(parts.building, parts.street),
    fetchDcaHistory(parts.building, parts.street)
  ]);
  const dohmh = dohmhResult.status === "fulfilled" ? dohmhResult.value : [];
  const dca = dcaResult.status === "fulfilled" ? dcaResult.value : [];
  if (dohmh.length === 0 && dca.length === 0) {
    const empty = {
      businesses: [],
      totalCount: 0,
      avgTenureMonths: null,
      avgTenureLabel: "No data",
      highTurnover: false,
      lastVacatedDate: null,
      hasActiveOccupant: false,
      source: "location-history",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    intelCache.set(cacheKey, empty, TTL.INSPECTIONS);
    return empty;
  }
  const businesses = mergeAndDedupe(dohmh, dca);
  const closed = businesses.filter((b) => b.status === "closed" && b.tenureMonths !== null);
  const avgTenureMonths = closed.length > 0 ? Math.round(closed.reduce((s, b) => s + (b.tenureMonths || 0), 0) / closed.length) : null;
  const avgYears = avgTenureMonths !== null ? Math.floor(avgTenureMonths / 12) : 0;
  const avgMos = avgTenureMonths !== null ? avgTenureMonths % 12 : 0;
  const avgTenureLabel = avgTenureMonths !== null ? avgYears > 0 ? `${avgYears} yr${avgYears > 1 ? "s" : ""} avg` : `${avgMos} mo avg` : "Insufficient data";
  const lastVacated = businesses.find((b) => b.status === "closed" && b.closeDate)?.closeDate || null;
  const hasActiveOccupant = businesses.some((b) => b.status === "active");
  const result = {
    businesses,
    totalCount: businesses.length,
    avgTenureMonths,
    avgTenureLabel,
    highTurnover: avgTenureMonths !== null && avgTenureMonths < 24,
    lastVacatedDate: lastVacated,
    hasActiveOccupant,
    source: "location-history",
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  intelCache.set(cacheKey, result, TTL.INSPECTIONS);
  return result;
}
function computeChurnRisk(history) {
  if (!history || history.totalCount === 0) {
    return { score: 50, tenantCount5yr: 0, avgTenureMonths: null, narrativeSnippet: "" };
  }
  const fiveYearsAgo = /* @__PURE__ */ new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const fiveYearStr = fiveYearsAgo.toISOString().split("T")[0];
  const recentBiz = history.businesses.filter((b) => {
    if (b.openDate && b.openDate >= fiveYearStr) return true;
    if (b.closeDate && b.closeDate >= fiveYearStr) return true;
    if (!b.closeDate && b.status === "active") return true;
    return false;
  });
  const tenantCount5yr = recentBiz.length;
  const avgTenure = history.avgTenureMonths;
  const rawScore = Math.max(0, Math.min(1, 1 - (tenantCount5yr - 1) * 0.15)) * 100;
  const score = Math.round(rawScore);
  let narrativeSnippet = "";
  if (tenantCount5yr === 0) {
    narrativeSnippet = "";
  } else if (tenantCount5yr === 1 && history.hasActiveOccupant) {
    const tenure = avgTenure ? ` (${Math.round(avgTenure / 12)} years and counting)` : "";
    narrativeSnippet = `This address has had a single tenant in 5 years${tenure} — excellent stability signal.`;
  } else if (tenantCount5yr <= 2) {
    narrativeSnippet = `This address has had ${tenantCount5yr} tenants in 5 years. Average tenure: ${avgTenure ? Math.round(avgTenure) + " months" : "unknown"}. Low turnover.`;
  } else if (tenantCount5yr <= 4) {
    narrativeSnippet = `This address has had ${tenantCount5yr} tenants in 5 years. Average tenure: ${avgTenure ? Math.round(avgTenure) + " months" : "unknown"}. Moderate turnover — investigate why businesses left.`;
  } else {
    narrativeSnippet = `This address has had ${tenantCount5yr} tenants in 5 years. Average tenure: ${avgTenure ? Math.round(avgTenure) + " months" : "unknown"}. High turnover — a significant risk signal. Ask the landlord why.`;
  }
  return { score, tenantCount5yr, avgTenureMonths: avgTenure, narrativeSnippet };
}
function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/['']S\b/g, "'s");
}
export {
  computeChurnRisk,
  fetchLocationHistory
};
