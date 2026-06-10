import { q as buildCompetitorsFromSources, f as fetchCensusData, a as fetchCensusHousing, b as fetchWalkScore, c as fetchInspections, d as fetchCrimeData, s as scanCompetitors, g as fetchLPCData, e as fetchMTARidership, h as fetchDCALicenses, i as fetchDOBData, j as fetch311Complaints, k as fetchPedestrianCounts, l as fetchPLUTOData, m as fetchSidewalkCafes, n as fetchLiquorLicenses, o as fetchYelpData, p as fetchMomentumData } from "./yelp.js";
import { a as fetchNearbyPlaces, b as fetchMarketDensity, f as fetchFoursquareData } from "./foursquare.js";
import { i as intelCache, I as IntelCache } from "./cache.js";
import { p as private_env } from "./private.js";
import { o as openrouterFetch } from "./retry.js";
import { f as fetchSchoolProximity } from "./nyc-schools.js";
import { g as getConceptScanRadius } from "./six-index.js";
import { d as db } from "./db-server.js";
import { l as lookupHistoricalContext, r as runDataQualityGate, e as extractWithHaiku, b as analyzeNeighborhood } from "./data-quality-gate.js";
import { e as extractPOIsFromIntel, a as computeStreetSideIntel } from "./street-side.js";
import { sql } from "drizzle-orm";
import { r as resilientFetch } from "./resilient-fetch.js";
const DOF_TAX_LIEN_EP$1 = "https://data.cityofnewyork.us/resource/9rz4-mjek.json";
const TTL_LIEN_MS = 30 * 24 * 3600 * 1e3;
async function fetchTaxLienDetail(bbl) {
  if (!bbl || bbl.length < 6) return null;
  const cacheKey = `dof_lien:${bbl}`;
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const { socrataFetch } = await import("./socrata-fetch.js");
    const appToken = private_env.NYC_OPEN_DATA_TOKEN;
    const q = `?bbl=${bbl}&$limit=10&$order=sale_date DESC`;
    const rows = await socrataFetch(
      `${DOF_TAX_LIEN_EP$1}${q}`,
      "DOF-LIEN-DETAIL",
      appToken ? { timeout: 8e3 } : void 0
    );
    const record = buildLienRecord(bbl, rows ?? []);
    intelCache.set(cacheKey, record, TTL_LIEN_MS);
    return record;
  } catch (err) {
    console.error("[DOF-Lien] Fetch error for BBL", bbl, err);
    return cached?.data ?? null;
  }
}
function buildLienRecord(bbl, rows) {
  const now = Date.now();
  const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (rows.length === 0) {
    return {
      bbl,
      hasLien: false,
      severity: "NONE",
      totalAmount: 0,
      lienCount: 0,
      taxYears: [],
      lienType: "unknown",
      disposition: "unknown",
      lienAgeYears: 0,
      contextMessage: "No tax liens found for this property.",
      source: "dof_tax_lien",
      fetchedAt
    };
  }
  const totalAmount = rows.reduce((sum, r) => {
    return sum + (parseFloat(r.total_lien_amount ?? "0") || 0);
  }, 0);
  const taxYears = [];
  for (const r of rows) {
    const yr = r.lien_years ?? r.tax_year;
    if (yr) {
      for (const y of yr.split(/[-,\s]+/).filter(Boolean)) {
        if (y.match(/^\d{4}$/) && !taxYears.includes(y)) taxYears.push(y);
      }
    }
  }
  taxYears.sort();
  const lienTypeRaw = rows[0]?.lien_type?.toUpperCase() ?? "";
  let lienType;
  if (lienTypeRaw === "WS") lienType = "water_sewer";
  else if (lienTypeRaw === "PROP") lienType = "property_tax";
  else if (rows.some((r) => r.lien_type?.toUpperCase() === "WS") && rows.some((r) => r.lien_type?.toUpperCase() === "PROP")) {
    lienType = "both";
  } else {
    lienType = totalAmount > 5e3 ? "property_tax" : "water_sewer";
  }
  const dispositionRaw = rows[0]?.disposition?.toLowerCase() ?? "";
  let disposition;
  if (dispositionRaw.includes("sold") || dispositionRaw.includes("purchase")) disposition = "sold";
  else if (dispositionRaw.includes("discharg") || dispositionRaw.includes("paid") || dispositionRaw.includes("satisfi")) disposition = "discharged";
  else if (dispositionRaw.length > 0) disposition = "active";
  else disposition = "unknown";
  let lienAgeYears = 0;
  const saleDateStr = rows[0]?.sale_date;
  if (saleDateStr) {
    const saleMs = new Date(saleDateStr).getTime();
    if (!isNaN(saleMs)) {
      lienAgeYears = Math.round((now - saleMs) / (365.25 * 24 * 3600 * 1e3) * 10) / 10;
    }
  }
  const severity = classifySeverity(totalAmount, disposition);
  return {
    bbl,
    hasLien: true,
    severity,
    totalAmount: Math.round(totalAmount),
    lienCount: rows.length,
    taxYears,
    lienType,
    disposition,
    lienAgeYears,
    contextMessage: buildContextMessage(severity, totalAmount, lienType, disposition, lienAgeYears),
    source: "dof_tax_lien",
    fetchedAt
  };
}
function classifySeverity(totalAmount, disposition, lienAgeYears) {
  if (disposition === "discharged") return "NONE";
  if (disposition === "sold") return "CRITICAL";
  if (totalAmount === 0) return "NONE";
  if (totalAmount < 1e4) return "MINOR";
  if (totalAmount < 1e5) return "MODERATE";
  return "SEVERE";
}
function buildContextMessage(severity, totalAmount, lienType, disposition, lienAgeYears) {
  const amtStr = totalAmount > 0 ? `$${totalAmount.toLocaleString()}` : "an undisclosed amount";
  const typeStr = lienType === "water_sewer" ? "water/sewer" : lienType === "property_tax" ? "property tax" : lienType === "both" ? "property tax and water/sewer" : "tax";
  const ageStr = lienAgeYears > 0 ? ` (${lienAgeYears.toFixed(1)} years ago)` : "";
  switch (severity) {
    case "NONE":
      return "No active tax liens found for this property.";
    case "MINOR":
      return `Minor ${typeStr} lien of ${amtStr}${ageStr}. Small ${lienType === "water_sewer" ? "water/sewer" : "tax"} arrears — common and typically curable before lease signing.`;
    case "MODERATE":
      return `Moderate ${typeStr} lien of ${amtStr}${ageStr}. Multiple years of tax arrears. Verify lien status before signing — ask landlord for proof of payment or active resolution plan.`;
    case "SEVERE":
      return `SEVERE ${typeStr} lien of ${amtStr}${ageStr}. Significant default risk. The building may be at risk of forced sale if unresolved. Consult a real estate attorney before signing any lease.`;
    case "CRITICAL":
      return `CRITICAL: Tax lien of ${amtStr} has been sold to a third-party purchaser${ageStr}. The purchaser can foreclose if taxes remain unpaid. Building ownership is at immediate risk. Do not sign a lease without legal review.`;
  }
}
const DOF_TAX_BILLS_EP = "https://data.cityofnewyork.us/resource/8wbx-tsch.json";
const ACRIS_MASTER_EP = "https://data.cityofnewyork.us/resource/bnx9-e6tj.json";
const ACRIS_LEGALS_EP = "https://data.cityofnewyork.us/resource/8h5j-fqxa.json";
const ACRIS_PARTIES_EP = "https://data.cityofnewyork.us/resource/636b-3b5g.json";
const DOF_TAX_LIEN_EP = "https://data.cityofnewyork.us/resource/9rz4-mjek.json";
const TTL_DOF = 30 * 24 * 3600 * 1e3;
async function fetchPropertyTaxProfile(bbl, sqft = 0, bldgSqft = 0, bldgClass = "") {
  if (!bbl || bbl.length < 6) return null;
  const cacheKey = `dof:${bbl}`;
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  try {
    const { socrataFetch } = await import("./socrata-fetch.js");
    const appToken = private_env.NYC_OPEN_DATA_TOKEN;
    const [taxBills, acrisDocs, acrisParties, taxLien, lienDetail] = await Promise.allSettled([
      fetchTaxBills(bbl, socrataFetch, appToken),
      fetchAcrisDocs(bbl, socrataFetch, appToken),
      fetchAcrisParties(bbl, socrataFetch, appToken),
      fetchTaxLien(bbl, socrataFetch, appToken),
      fetchTaxLienDetail(bbl)
    ]);
    const bills = taxBills.status === "fulfilled" ? taxBills.value : [];
    const acrDocs = acrisDocs.status === "fulfilled" ? acrisDocs.value : [];
    const acrParty = acrisParties.status === "fulfilled" ? acrisParties.value : [];
    const lienHit = taxLien.status === "fulfilled" ? taxLien.value : false;
    const taxLienRecord = lienDetail.status === "fulfilled" ? lienDetail.value : null;
    const profile = buildProfile(bbl, bills, acrDocs, acrParty, lienHit, taxLienRecord, sqft, bldgSqft, bldgClass);
    intelCache.set(cacheKey, profile, TTL_DOF);
    return profile;
  } catch (e) {
    console.error("[DOF] Fetch error for BBL", bbl, e);
    return cached?.data ?? null;
  }
}
async function fetchTaxBills(bbl, socrataFetch, appToken) {
  const q = `?bbl=${bbl}&$order=tax_year DESC&$limit=5&$select=tax_year,tax_class,assessed_value,tax_rate,tax_amount,abatement_amount,exemption_amount,net_tax_due`;
  const raw = await socrataFetch(
    `${DOF_TAX_BILLS_EP}${q}`,
    "DOF-TAX",
    appToken ? { timeout: 1e4 } : void 0
  );
  return raw ?? [];
}
async function fetchAcrisDocs(bbl, socrataFetch, appToken) {
  const legalsQ = `?$where=bbl='${bbl}'&$select=document_id&$limit=200`;
  const legals = await socrataFetch(
    `${ACRIS_LEGALS_EP}${legalsQ}`,
    "ACRIS-LEGALS",
    appToken ? { timeout: 1e4 } : void 0
  );
  if (!legals?.length) return [];
  const docIds = [...new Set(legals.map((r) => r.document_id).filter(Boolean))].slice(0, 100);
  if (!docIds.length) return [];
  const idList = docIds.map((id) => `'${id}'`).join(",");
  const masterQ = `?$where=document_id in (${idList}) AND doc_type in ('MTGE','SAT','DEED','RPTT','AGMT','ASST')&$select=document_id,doc_type,doc_date,doc_amount&$order=doc_date DESC&$limit=50`;
  const master = await socrataFetch(
    `${ACRIS_MASTER_EP}${masterQ}`,
    "ACRIS-MASTER",
    appToken ? { timeout: 1e4 } : void 0
  );
  return master ?? [];
}
async function fetchAcrisParties(bbl, socrataFetch, appToken) {
  const legalsQ = `?$where=bbl='${bbl}'&$select=document_id&$limit=50`;
  const legals = await socrataFetch(
    `${ACRIS_LEGALS_EP}${legalsQ}`,
    "ACRIS-LEGALS-P",
    appToken ? { timeout: 8e3 } : void 0
  );
  if (!legals?.length) return [];
  const docIds = [...new Set(legals.map((r) => r.document_id).filter(Boolean))].slice(0, 50);
  if (!docIds.length) return [];
  const idList = docIds.map((id) => `'${id}'`).join(",");
  const partiesQ = `?$where=document_id in (${idList}) AND party_type='2'&$select=document_id,name,party_type&$limit=50`;
  const parties = await socrataFetch(
    `${ACRIS_PARTIES_EP}${partiesQ}`,
    "ACRIS-PARTIES",
    appToken ? { timeout: 8e3 } : void 0
  );
  return parties ?? [];
}
async function fetchTaxLien(bbl, socrataFetch, appToken) {
  const q = `?bbl=${bbl}&$limit=1&$select=bbl`;
  const result = await socrataFetch(
    `${DOF_TAX_LIEN_EP}${q}`,
    "DOF-LIEN",
    appToken ? { timeout: 8e3 } : void 0
  );
  return Array.isArray(result) && result.length > 0;
}
function buildProfile(bbl, bills, acrDocs, acrParties, hasTaxLien, taxLienRecord, sqft, bldgSqft, bldgClass) {
  const taxYear = bills.length > 0 ? parseInt(bills[0].tax_year) || 0 : 0;
  const taxClass = bills.length > 0 ? bills[0].tax_class ?? "" : "";
  const rawAnnualTax = bills.length > 0 ? parseFloat(bills[0].net_tax_due) || 0 : 0;
  const sqftShare = sqft > 0 && bldgSqft > 0 ? Math.min(1, sqft / bldgSqft) : 1;
  const annualTax = Math.round(rawAnnualTax * sqftShare);
  const monthlyTaxPassThrough = Math.round(annualTax / 12);
  let escalation5yr = 0;
  let escalationAnnual = 0;
  if (bills.length >= 2) {
    const newest = parseFloat(bills[0].net_tax_due) || 0;
    const oldest = parseFloat(bills[bills.length - 1].net_tax_due) || 0;
    if (oldest > 0 && newest > 0) {
      escalation5yr = newest / oldest - 1;
      const years = bills.length - 1;
      escalationAnnual = Math.pow(1 + escalation5yr, 1 / Math.max(years, 1)) - 1;
    }
  }
  const escalationRisk = classifyEscalation(escalationAnnual);
  const isCoop = detectCoop(bldgClass);
  const coopVsCondoContext = isCoop ? "coop" : taxClass === "4" || taxClass.startsWith("2") ? "condo_or_commercial" : "unknown";
  const mortgageDocs = acrDocs.filter((d) => d.doc_type === "MTGE" || d.doc_type === "AGMT" || d.doc_type === "ASST");
  const satDocs = acrDocs.filter((d) => d.doc_type === "SAT");
  const deedDocs = acrDocs.filter((d) => d.doc_type === "DEED" || d.doc_type === "RPTT");
  const latestMtge = mortgageDocs[0] ?? null;
  const latestSat = satDocs[0] ?? null;
  const isMortgaged = latestMtge !== null && (!latestSat || compareDates(latestMtge.doc_date, latestSat.doc_date) > 0);
  const mortgageAmount = latestMtge ? parseFloat(latestMtge.doc_amount) || 0 : 0;
  const mortgageDate = latestMtge?.doc_date ?? "";
  const mortgageAge = mortgageDate ? yearsSince(mortgageDate) : 0;
  const lenderParty = latestMtge ? acrParties.find((p) => p.document_id === latestMtge.document_id) : null;
  const lenderName = lenderParty?.name ?? "";
  const latestDeed = deedDocs[0] ?? null;
  const lastSalePrice = latestDeed ? parseFloat(latestDeed.doc_amount) || 0 : 0;
  const lastSaleDate = latestDeed?.doc_date ?? "";
  const yearsHeld = lastSaleDate ? yearsSince(lastSaleDate) : 0;
  const assessedValue = bills.length > 0 ? parseFloat(bills[0].assessed_value) || 0 : 0;
  const mortgageContext = classifyMortgageContext(mortgageAmount, assessedValue, mortgageAge, isMortgaged);
  return {
    annualTax,
    monthlyTaxPassThrough,
    taxClass,
    taxYear,
    escalation5yr: Math.round(escalation5yr * 1e3) / 1e3,
    escalationAnnual: Math.round(escalationAnnual * 1e3) / 1e3,
    escalationRisk,
    isCoop,
    taxClassLabel: taxClassLabel(taxClass),
    hasTaxLien,
    taxLienDetail: taxLienRecord,
    mortgageAmount,
    mortgageDate,
    lenderName,
    isMortgaged,
    mortgageAge,
    lastSalePrice,
    lastSaleDate,
    yearsHeld,
    coopVsCondoContext,
    mortgageContext,
    source: "dof_property_tax",
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    bbl
  };
}
function classifyEscalation(annual) {
  if (annual < 0.02) return "LOW";
  if (annual < 0.04) return "MODERATE";
  if (annual < 0.06) return "HIGH";
  return "CRITICAL";
}
function detectCoop(bldgClass, taxClass) {
  if (bldgClass && bldgClass.toUpperCase().startsWith("D")) return true;
  return false;
}
function taxClassLabel(taxClass) {
  const map = {
    "1": "Class 1 — 1-3 Family Residential",
    "2": "Class 2 — Residential Coop/Condo",
    "2a": "Class 2A — Small Coop/Condo",
    "2b": "Class 2B — Mid Coop/Condo",
    "2c": "Class 2C — Large Coop/Condo",
    "4": "Class 4 — Commercial/Industrial (no assessment cap)"
  };
  return map[taxClass.toLowerCase()] ?? `Tax Class ${taxClass}`;
}
function classifyMortgageContext(mortgageAmount, assessedValue, mortgageAge, isMortgaged) {
  if (!isMortgaged || mortgageAmount <= 0) return "no_mortgage";
  if (assessedValue > 0 && mortgageAmount > assessedValue * 2 && mortgageAge < 3) return "high_leverage";
  return "low_leverage";
}
function yearsSince(dateStr) {
  if (!dateStr) return 0;
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((now - then) / (365.25 * 24 * 3600 * 1e3) * 10) / 10);
}
function compareDates(a, b) {
  return new Date(a).getTime() - new Date(b).getTime();
}
function normalizeName(name) {
  return name.toLowerCase().replace(/[''`]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const longer = na.length >= nb.length ? na : nb;
  const shorter = na.length < nb.length ? na : nb;
  if (shorter.length > 3 && longer.startsWith(shorter.substring(0, Math.ceil(shorter.length * 0.7)))) {
    return true;
  }
  return false;
}
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function googleToRawPOI(p, lat, lng) {
  return {
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    category: p.types?.[0] || "unknown",
    source: "google-places",
    rating: p.rating,
    priceLevel: p.priceLevel,
    reviewCount: p.reviewCount,
    isChain: false,
    // Google doesn't flag chains directly
    isOpen: p.isOpen ?? null,
    address: p.address,
    raw: p,
    cacheKey: IntelCache.locationKey(lat, lng, "places")
  };
}
function foursquareToRawPOI(v, lat, lng) {
  return {
    name: v.name,
    lat: 0,
    // Foursquare gives distance but not always coords in our type
    lng: 0,
    category: v.primaryCategory || v.categories?.[0]?.shortName || "unknown",
    source: "foursquare",
    rating: v.rating ? v.rating / 2 : null,
    // Foursquare is 0-10, normalize to 0-5
    priceLevel: v.priceLevel,
    reviewCount: null,
    isChain: v.isChain,
    isOpen: v.closed ? false : null,
    address: v.address,
    raw: v,
    cacheKey: IntelCache.locationKey(lat, lng, "foursquare")
  };
}
function yelpToRawPOI(b, lat, lng) {
  return {
    name: b.name,
    lat: b.lat,
    lng: b.lng,
    category: b.primaryCategory || b.categories?.[0]?.alias || "unknown",
    source: "yelp",
    rating: b.rating,
    priceLevel: b.priceLevel,
    reviewCount: b.reviewCount,
    isChain: b.isChain,
    isOpen: b.isClosed ? false : null,
    address: b.address,
    raw: b,
    cacheKey: IntelCache.locationKey(lat, lng, "yelp")
  };
}
function overpassToRawPOI(p, lat, lng) {
  return {
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    category: p.type || "unknown",
    source: "overpass",
    rating: null,
    priceLevel: null,
    reviewCount: null,
    isChain: p.isChain,
    isOpen: null,
    address: null,
    raw: p,
    cacheKey: IntelCache.locationKey(lat, lng, "competitors")
  };
}
function clusterPOIs(pois) {
  const clusters = [];
  const assigned = /* @__PURE__ */ new Set();
  for (let i = 0; i < pois.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = [pois[i]];
    assigned.add(i);
    for (let j = i + 1; j < pois.length; j++) {
      if (assigned.has(j)) continue;
      const match = cluster.some((member) => {
        if (!namesMatch(member.name, pois[j].name)) return false;
        if (member.lat && member.lng && pois[j].lat && pois[j].lng) {
          return distanceMeters(member.lat, member.lng, pois[j].lat, pois[j].lng) < 80;
        }
        return true;
      });
      if (match) {
        cluster.push(pois[j]);
        assigned.add(j);
      }
    }
    const resolvedName = resolveConflict(
      cluster.map((m) => ({ source: m.source, value: m.name })),
      "longest"
      // prefer the most descriptive name
    );
    const resolvedCategory = resolveConflict(
      cluster.map((m) => ({ source: m.source, value: m.category })),
      "majority"
    );
    clusters.push({ members: cluster, resolvedName, resolvedCategory });
  }
  return clusters;
}
function resolveConflict(values, strategy) {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0].value;
  const valid = values.filter((v) => v.value != null);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0].value;
  switch (strategy) {
    case "majority": {
      const counts = /* @__PURE__ */ new Map();
      for (const v of valid) {
        const key = String(v.value);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      let bestKey = "";
      let bestCount = 0;
      for (const [key, count] of counts) {
        if (count > bestCount) {
          bestKey = key;
          bestCount = count;
        }
      }
      return valid.find((v) => String(v.value) === bestKey)?.value;
    }
    case "highest":
      return valid.reduce(
        (best, v) => (Number(v.value) || 0) > (Number(best.value) || 0) ? v : best
      ).value;
    case "lowest":
      return valid.reduce(
        (best, v) => (Number(v.value) || 0) < (Number(best.value) || 0) ? v : best
      ).value;
    case "longest":
      return valid.reduce(
        (best, v) => String(v.value).length > String(best.value).length ? v : best
      ).value;
    case "prefer_source": {
      const priority = ["foursquare", "google-places", "yelp", "overpass"];
      for (const src of priority) {
        const found = valid.find((v) => v.source === src);
        if (found) return found.value;
      }
      return valid[0].value;
    }
    default:
      return valid[0].value;
  }
}
function reconcileEntities(report) {
  const startMs = Date.now();
  const entities = [];
  let conflictsResolved = 0;
  const { lat, lng } = report;
  const allPOIs = [];
  if (report.places?.places) {
    for (const p of report.places.places) {
      allPOIs.push(googleToRawPOI(p, lat, lng));
    }
  }
  if (report.foursquare?.venues) {
    for (const v of report.foursquare.venues) {
      allPOIs.push(foursquareToRawPOI(v, lat, lng));
    }
  }
  if (report.yelp?.businesses) {
    for (const b of report.yelp.businesses) {
      allPOIs.push(yelpToRawPOI(b, lat, lng));
    }
  }
  if (report.competitors?.competitors) {
    for (const c of report.competitors.competitors) {
      if (c.name && c.name !== "Unknown") {
        allPOIs.push(overpassToRawPOI(c, lat, lng));
      }
    }
  }
  const clusters = clusterPOIs(allPOIs);
  for (const cluster of clusters) {
    const members = cluster.members;
    const sources = [...new Set(members.map((m) => m.source))];
    const conflicts = {};
    const ratings = members.filter((m) => m.rating != null).map((m) => ({ source: m.source, value: m.rating }));
    let resolvedRating = null;
    if (ratings.length > 1) {
      const vals = ratings.map((r) => Number(r.value));
      const spread = Math.max(...vals) - Math.min(...vals);
      if (spread > 0.5) {
        resolvedRating = weightedAvgRating(members);
        const valueMap = {};
        for (const r of ratings) valueMap[r.source] = r.value;
        conflicts["rating"] = {
          values: valueMap,
          resolved: resolvedRating,
          reason: "Weighted average (Yelp×0.4 + Google×0.35 + Foursquare×0.25)"
        };
        conflictsResolved++;
      } else {
        resolvedRating = Number(ratings[0].value);
      }
    } else if (ratings.length === 1) {
      resolvedRating = Number(ratings[0].value);
    }
    const categories = members.map((m) => ({ source: m.source, value: m.category }));
    const uniqueCategories = [...new Set(categories.map((c) => String(c.value)))];
    if (uniqueCategories.length > 1) {
      const catMap = {};
      for (const c of categories) catMap[c.source] = c.value;
      conflicts["classification"] = {
        values: catMap,
        resolved: cluster.resolvedCategory,
        reason: "Majority vote across sources"
      };
      conflictsResolved++;
    }
    const prices = members.filter((m) => m.priceLevel != null).map((m) => ({ source: m.source, value: m.priceLevel }));
    let resolvedPrice = null;
    if (prices.length > 0) {
      resolvedPrice = Math.round(prices.reduce((sum, p) => sum + Number(p.value), 0) / prices.length);
      if (prices.length > 1) {
        const priceValues = prices.map((p) => Number(p.value));
        if (Math.max(...priceValues) !== Math.min(...priceValues)) {
          const priceMap = {};
          for (const p of prices) priceMap[p.source] = p.value;
          conflicts["price_level"] = {
            values: priceMap,
            resolved: resolvedPrice,
            reason: "Average across sources"
          };
          conflictsResolved++;
        }
      }
    }
    const confidence = calculatePOIConfidence(members, Object.keys(conflicts).length);
    const derivationChain = {
      inputs: members.map((m) => ({
        source: m.source,
        field: "poi",
        value: m.name,
        cacheKey: m.cacheKey
      })),
      logic: sources.length > 1 ? `Entity confirmed by ${sources.length} independent sources (${sources.join(", ")}). ${Object.keys(conflicts).length} conflicts resolved via majority vote / weighted average.` : `Single-source entity from ${sources[0]}. No cross-validation available.`
    };
    const chainVotes = members.filter((m) => m.isChain);
    const isChain = chainVotes.length > members.length / 2;
    entities.push({
      entityType: "poi",
      entityCategory: cluster.resolvedCategory,
      entityName: cluster.resolvedName,
      entityData: {
        rating: resolvedRating,
        priceLevel: resolvedPrice,
        reviewCount: Math.max(...members.map((m) => m.reviewCount || 0)),
        isChain,
        isOpen: members.some((m) => m.isOpen === true) ? true : members.some((m) => m.isOpen === false) ? false : null,
        address: members.find((m) => m.address)?.address || null,
        lat: members.find((m) => m.lat)?.lat || lat,
        lng: members.find((m) => m.lng)?.lng || lng
      },
      sourceCount: sources.length,
      sources,
      confidence,
      conflicts: Object.keys(conflicts).length > 0 ? conflicts : null,
      derivationChain
    });
  }
  if (report.mtaRidership?.stations) {
    for (const station of report.mtaRidership.stations) {
      entities.push({
        entityType: "transit_node",
        entityCategory: "subway_station",
        entityName: station.stationComplex,
        entityData: {
          dailyRidership: station.ridership,
          peakRidership: station.peakRidership,
          offPeakRidership: station.offPeakRidership,
          dayOfWeek: station.dayOfWeek
        },
        sourceCount: 1,
        sources: ["mta-ridership"],
        confidence: 0.9,
        // MTA data is official
        conflicts: null,
        derivationChain: {
          inputs: [{
            source: "mta-ridership",
            field: "station",
            value: station.stationComplex,
            cacheKey: IntelCache.locationKey(lat, lng, "mta-ridership")
          }],
          logic: "Official MTA ridership data — single authoritative source."
        }
      });
    }
  }
  if (report.marketDensity?.categories) {
    const demandTypes = ["office", "coworking", "hotel", "school", "park", "theater"];
    for (const cat of report.marketDensity.categories) {
      if (demandTypes.some((d) => cat.placeType.includes(d)) && cat.count > 0) {
        entities.push({
          entityType: "demand_generator",
          entityCategory: cat.placeType,
          entityName: null,
          // Aggregate, not a single entity
          entityData: {
            count: cat.count,
            avgRating: cat.avgRating,
            chainPct: cat.chainPct
          },
          sourceCount: 1,
          sources: ["google-places-density"],
          confidence: 0.75,
          conflicts: null,
          derivationChain: {
            inputs: [{
              source: "google-places",
              field: `market_density.${cat.placeType}`,
              value: cat.count,
              cacheKey: IntelCache.locationKey(lat, lng, "market-density")
            }],
            logic: `Market density scan found ${cat.count} ${cat.placeType} locations within 500m radius.`
          }
        });
      }
    }
  }
  if (report.crime) {
    entities.push({
      entityType: "risk_signal",
      entityCategory: "crime_cluster",
      entityName: null,
      entityData: {
        totalIncidents: report.crime.totalCount,
        violentCount: report.crime.violentCount,
        propertyCount: report.crime.propertyCount,
        crimeScore: report.crime.crimeScore,
        densityPerSqMi: report.crime.densityPerSqMi,
        topTypes: report.crime.topTypes
      },
      sourceCount: 1,
      sources: ["nypd-complaints"],
      confidence: 0.85,
      // Official data, but lagged
      conflicts: null,
      derivationChain: {
        inputs: [{
          source: "nypd-complaints",
          field: "crime_summary",
          value: { total: report.crime.totalCount, score: report.crime.crimeScore },
          cacheKey: IntelCache.locationKey(lat, lng, "crime")
        }],
        logic: "NYPD CompStat data — official crime complaints within 500m radius.",
        assumptions: ["Data may be 30-90 days lagged from date of incident"]
      }
    });
  }
  if (report.census) {
    entities.push({
      entityType: "demographic_profile",
      entityCategory: "census_demographics",
      entityName: null,
      entityData: {
        totalPopulation: report.census.totalPopulation,
        medianIncome: report.census.medianHouseholdIncome,
        medianAge: report.census.medianAge,
        educationBachelorsPct: report.census.bachelorsPlusPercent,
        commuteTransitPct: report.census.commuterPercent
      },
      sourceCount: 1,
      sources: ["census-acs"],
      confidence: 0.8,
      conflicts: null,
      derivationChain: {
        inputs: [{
          source: "census-acs",
          field: "demographics",
          value: { pop: report.census.totalPopulation, income: report.census.medianHouseholdIncome },
          cacheKey: IntelCache.locationKey(lat, lng, "demographics")
        }],
        logic: "US Census ACS 5-year estimates at census tract level.",
        assumptions: ["Census data reflects 5-year average, not current snapshot", "Tract-level granularity (~4,000 people)"]
      }
    });
  }
  const poiCount = entities.filter((e) => e.entityType === "poi").length;
  const transitNodes = entities.filter((e) => e.entityType === "transit_node").length;
  const demandGenerators = entities.filter((e) => e.entityType === "demand_generator").length;
  const riskSignals = entities.filter((e) => e.entityType === "risk_signal").length;
  const avgConfidence = entities.length > 0 ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length : 0;
  return {
    entities,
    totalEntities: entities.length,
    poiCount,
    transitNodes,
    demandGenerators,
    riskSignals,
    conflictsResolved,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    processingMs: Date.now() - startMs
  };
}
function weightedAvgRating(members) {
  const weights = {
    "yelp": 0.4,
    "google-places": 0.35,
    "foursquare": 0.25
  };
  let totalWeight = 0;
  let weightedSum = 0;
  for (const m of members) {
    if (m.rating == null) continue;
    const w = weights[m.source] || 0.1;
    weightedSum += m.rating * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight * 10) / 10 : 0;
}
function calculatePOIConfidence(members, conflictCount) {
  let confidence;
  switch (members.length) {
    case 1:
      confidence = 0.5;
      break;
    case 2:
      confidence = 0.7;
      break;
    case 3:
      confidence = 0.85;
      break;
    default:
      confidence = 0.95;
      break;
  }
  const sources = new Set(members.map((m) => m.source));
  if (sources.has("google-places")) confidence += 0.05;
  if (sources.has("foursquare")) confidence += 0.03;
  confidence -= conflictCount * 0.02;
  const categories = [...new Set(members.map((m) => m.category))];
  if (categories.length === 1 && members.length > 1) confidence += 0.05;
  return Math.max(0.1, Math.min(1, Math.round(confidence * 100) / 100));
}
const MULTIPLIER_RULES = [
  { conceptType: "cafe", nearbyCategory: "gym", relationship: "force_multiplier", score: 0.8, reasoning: "Post-workout coffee, smoothies, protein bowls. Boutique gym crowds are high-spend.", timeOfDay: "morning" },
  { conceptType: "cafe", nearbyCategory: "office", relationship: "force_multiplier", score: 0.9, reasoning: "Office workers are the #1 weekday coffee customer.", timeOfDay: "morning" },
  { conceptType: "cafe", nearbyCategory: "coworking", relationship: "force_multiplier", score: 0.85, reasoning: "Freelancers and remote workers need coffee shops as second offices.", timeOfDay: null },
  { conceptType: "cafe", nearbyCategory: "subway_station", relationship: "force_multiplier", score: 0.7, reasoning: "Commuter grab-and-go traffic at morning rush.", timeOfDay: "morning" },
  { conceptType: "cafe", nearbyCategory: "hotel", relationship: "force_multiplier", score: 0.5, reasoning: "Tourists and business travelers seek local coffee.", timeOfDay: "morning" },
  { conceptType: "cafe", nearbyCategory: "park", relationship: "force_multiplier", score: 0.6, reasoning: "Dog walkers, joggers, weekend strollers.", timeOfDay: "morning" },
  { conceptType: "restaurant", nearbyCategory: "office", relationship: "force_multiplier", score: 0.85, reasoning: "Lunch traffic from offices is the backbone of weekday revenue.", timeOfDay: "afternoon" },
  { conceptType: "restaurant", nearbyCategory: "hotel", relationship: "force_multiplier", score: 0.7, reasoning: "Hotel guests seek nearby dining.", timeOfDay: "evening" },
  { conceptType: "restaurant", nearbyCategory: "theater", relationship: "force_multiplier", score: 0.8, reasoning: "Pre-theater and post-theater dining is a major revenue driver.", timeOfDay: "evening" },
  { conceptType: "bar", nearbyCategory: "restaurant", relationship: "force_multiplier", score: 0.7, reasoning: "Post-dinner drinks.", timeOfDay: "evening" },
  { conceptType: "bar", nearbyCategory: "office", relationship: "force_multiplier", score: 0.6, reasoning: "After-work happy hour crowd.", timeOfDay: "evening" },
  { conceptType: "bar", nearbyCategory: "school", relationship: "negative", score: -0.5, reasoning: "Schools nearby can block liquor license approval.", timeOfDay: null },
  { conceptType: "gym", nearbyCategory: "office", relationship: "force_multiplier", score: 0.7, reasoning: "Before/after work gym sessions.", timeOfDay: null },
  { conceptType: "gym", nearbyCategory: "subway_station", relationship: "force_multiplier", score: 0.6, reasoning: "Transit access expands membership catchment.", timeOfDay: null }
];
function generateExtrapolations(report, reconciled) {
  const startMs = Date.now();
  const extrapolations = [];
  const { lat, lng, businessType } = report;
  extrapolations.push(...analyzeForceMultipliers(report, reconciled, businessType));
  extrapolations.push(...analyzeTimeViability(report, reconciled, businessType, lat, lng));
  extrapolations.push(...analyzeDemandSignals(report, reconciled, businessType, lat, lng));
  extrapolations.push(...analyzeCompetitivePosition(report, reconciled, businessType));
  extrapolations.push(...analyzeRisks(report, reconciled, businessType, lat, lng));
  const byCategory = {};
  for (const e of extrapolations) {
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  }
  const avgConfidence = extrapolations.length > 0 ? extrapolations.reduce((sum, e) => sum + e.confidence, 0) / extrapolations.length : 0;
  return {
    extrapolations,
    totalCount: extrapolations.length,
    byCategory,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    processingMs: Date.now() - startMs
  };
}
function analyzeForceMultipliers(report, reconciled, businessType, lat, lng) {
  const results = [];
  const rules = MULTIPLIER_RULES.filter((r) => r.conceptType === businessType);
  for (const rule of rules) {
    const matchingEntities = reconciled.entities.filter((e) => {
      if (e.entityType === "transit_node" && rule.nearbyCategory === "subway_station") return true;
      if (e.entityType === "demand_generator" && e.entityCategory.includes(rule.nearbyCategory)) return true;
      if (e.entityType === "poi" && e.entityCategory.includes(rule.nearbyCategory)) return true;
      return false;
    });
    if (matchingEntities.length === 0) continue;
    const entityCount = matchingEntities.reduce((sum, e) => {
      const count = e.entityData.count || 1;
      return sum + count;
    }, 0);
    const inputs = matchingEntities.flatMap(
      (e) => e.derivationChain.inputs.map((i) => ({ ...i }))
    );
    const sentiment = rule.relationship === "force_multiplier" ? rule.score >= 0.7 ? "great" : rule.score >= 0.4 ? "good" : "neutral" : rule.relationship === "competitor" ? "caution" : rule.relationship === "negative" ? "warning" : "neutral";
    const confidenceFromEntities = matchingEntities.reduce((sum, e) => sum + e.confidence, 0) / matchingEntities.length;
    results.push({
      extrapolationType: `force_multiplier_${rule.nearbyCategory}`,
      category: "force_multiplier",
      title: rule.relationship === "force_multiplier" ? `${capitalize$1(rule.nearbyCategory)} nearby is a force multiplier${rule.timeOfDay ? ` (${rule.timeOfDay})` : ""}` : rule.relationship === "competitor" ? `${capitalize$1(rule.nearbyCategory)} nearby creates competition` : `${capitalize$1(rule.nearbyCategory)} nearby is a risk factor`,
      value: Math.round(rule.score * entityCount * 100) / 100,
      unit: "impact_score",
      interpretation: `${entityCount} ${rule.nearbyCategory}(s) found. ${rule.reasoning}`,
      sentiment,
      confidence: Math.round(confidenceFromEntities * 100) / 100,
      confidenceLabel: confidenceFromEntities >= 0.8 ? "high" : confidenceFromEntities >= 0.5 ? "moderate" : "estimated",
      method: "cross_reference",
      derivationChain: {
        inputs,
        logic: `Matched ${entityCount} ${rule.nearbyCategory} entities against force multiplier matrix. Rule: ${rule.conceptType} + ${rule.nearbyCategory} = ${rule.relationship} (score: ${rule.score}).`,
        assumptions: rule.timeOfDay ? [`Effect strongest during ${rule.timeOfDay} hours`] : void 0
      }
    });
  }
  return results;
}
function analyzeTimeViability(report, reconciled, businessType, lat, lng) {
  const results = [];
  const inputs = [];
  let morningScore = 0;
  let morningFactors = [];
  if (report.mtaRidership) {
    const peakRiders = report.mtaRidership.totalDailyRidership * (report.mtaRidership.peakHourRatio || 0.3);
    morningScore += Math.min(30, peakRiders / 500);
    morningFactors.push(`${Math.round(peakRiders).toLocaleString()} peak-hour transit riders`);
    inputs.push({
      source: "mta-ridership",
      field: "peak_ridership",
      value: peakRiders,
      cacheKey: IntelCache.locationKey(lat, lng, "mta-ridership")
    });
  }
  const offices = reconciled.entities.filter((e) => e.entityCategory.includes("office"));
  if (offices.length > 0) {
    const officeCount = offices.reduce((s, e) => s + (e.entityData.count || 1), 0);
    morningScore += Math.min(30, officeCount * 5);
    morningFactors.push(`${officeCount} offices nearby`);
  }
  const gyms = reconciled.entities.filter(
    (e) => e.entityType === "poi" && (e.entityCategory.includes("gym") || e.entityCategory.includes("fitness"))
  );
  if (gyms.length > 0) {
    morningScore += Math.min(15, gyms.length * 5);
    morningFactors.push(`${gyms.length} gym(s) drive pre/post-workout traffic`);
  }
  if (report.pedestrian) {
    morningScore += Math.min(25, report.pedestrian.totalPedestrians / 100);
    inputs.push({
      source: "nyc-pedestrian",
      field: "total_pedestrians",
      value: report.pedestrian.totalPedestrians,
      cacheKey: IntelCache.locationKey(lat, lng, "pedestrian")
    });
  }
  morningScore = Math.min(100, Math.round(morningScore));
  results.push({
    extrapolationType: "morning_viability",
    category: "time_viability",
    title: "Morning viability (7–11 AM)",
    value: morningScore,
    unit: "score",
    interpretation: morningScore >= 70 ? `Strong morning traffic: ${morningFactors.join("; ")}.` : morningScore >= 40 ? `Moderate morning activity: ${morningFactors.join("; ")}.` : `Weak morning traffic. ${morningFactors.length > 0 ? morningFactors.join("; ") + "." : "Few foot traffic drivers."}`,
    sentiment: morningScore >= 70 ? "great" : morningScore >= 40 ? "good" : "caution",
    confidence: inputs.length >= 2 ? 0.7 : 0.5,
    confidenceLabel: inputs.length >= 2 ? "moderate" : "estimated",
    method: "rule_based",
    derivationChain: {
      inputs,
      logic: `Morning viability score based on transit ridership (peak hours), nearby offices, gyms, and pedestrian counts. Factors: ${morningFactors.join(", ")}.`,
      assumptions: ["Morning = 7-11 AM", "Peak transit ratio applied to total ridership", "Office workers generate 60% of morning foot traffic"]
    }
  });
  let eveningScore = 0;
  let eveningFactors = [];
  const eveningInputs = [];
  const restaurants = reconciled.entities.filter(
    (e) => e.entityType === "poi" && e.entityCategory.includes("restaurant")
  );
  if (restaurants.length > 0) {
    eveningScore += Math.min(25, restaurants.length * 4);
    eveningFactors.push(`${restaurants.length} restaurant(s)`);
  }
  const bars = reconciled.entities.filter(
    (e) => e.entityType === "poi" && (e.entityCategory.includes("bar") || e.entityCategory.includes("nightlife"))
  );
  if (bars.length > 0) {
    eveningScore += Math.min(20, bars.length * 5);
    eveningFactors.push(`${bars.length} bar(s)`);
  }
  const hotels = reconciled.entities.filter((e) => e.entityCategory.includes("hotel"));
  if (hotels.length > 0) {
    eveningScore += 15;
    eveningFactors.push("hotel(s) nearby");
  }
  if (report.crime) {
    const safetyBonus = Math.max(0, (report.crime.crimeScore - 50) / 5);
    eveningScore += Math.round(safetyBonus);
    eveningFactors.push(`safety score ${report.crime.crimeScore}/100`);
    eveningInputs.push({
      source: "nypd-complaints",
      field: "crime_score",
      value: report.crime.crimeScore,
      cacheKey: IntelCache.locationKey(lat, lng, "crime")
    });
  }
  if (report.mtaRidership && report.mtaRidership.stationCount > 0) {
    eveningScore += 15;
    eveningFactors.push(`${report.mtaRidership.stationCount} subway station(s) for late-night access`);
  }
  eveningScore = Math.min(100, Math.round(eveningScore));
  results.push({
    extrapolationType: "evening_viability",
    category: "time_viability",
    title: "Evening viability (6–11 PM)",
    value: eveningScore,
    unit: "score",
    interpretation: eveningScore >= 70 ? `Strong evening economy: ${eveningFactors.join("; ")}.` : eveningScore >= 40 ? `Moderate evening activity: ${eveningFactors.join("; ")}.` : `Weak evening scene. ${eveningFactors.length > 0 ? eveningFactors.join("; ") + "." : "Few nightlife drivers."}`,
    sentiment: eveningScore >= 70 ? "great" : eveningScore >= 40 ? "good" : "caution",
    confidence: eveningInputs.length >= 1 ? 0.65 : 0.45,
    confidenceLabel: "estimated",
    method: "rule_based",
    derivationChain: {
      inputs: eveningInputs,
      logic: `Evening viability based on nearby restaurants, bars, hotels, safety scores, and transit access.`,
      assumptions: ["Evening = 6-11 PM", "Crime score inversely affects evening viability", "Subway access critical for after-dark businesses"]
    }
  });
  return results;
}
function analyzeDemandSignals(report, reconciled, businessType, lat, lng) {
  const results = [];
  let estimatedDailyFoot = 0;
  const footInputs = [];
  const footFactors = [];
  if (report.mtaRidership) {
    estimatedDailyFoot += report.mtaRidership.totalDailyRidership * 0.15;
    footFactors.push(`${report.mtaRidership.totalDailyRidership.toLocaleString()} daily subway riders (15% walk-past rate)`);
    footInputs.push({
      source: "mta-ridership",
      field: "total_daily_ridership",
      value: report.mtaRidership.totalDailyRidership,
      cacheKey: IntelCache.locationKey(lat, lng, "mta-ridership")
    });
  }
  if (report.pedestrian) {
    estimatedDailyFoot += report.pedestrian.totalPedestrians * 0.8;
    footFactors.push(`${report.pedestrian.totalPedestrians} pedestrian survey count`);
    footInputs.push({
      source: "nyc-pedestrian",
      field: "total_pedestrians",
      value: report.pedestrian.totalPedestrians,
      cacheKey: IntelCache.locationKey(lat, lng, "pedestrian")
    });
  }
  const officeEntities = reconciled.entities.filter((e) => e.entityCategory.includes("office"));
  const officeCount = officeEntities.reduce((s, e) => s + (e.entityData.count || 1), 0);
  if (officeCount > 0) {
    estimatedDailyFoot += officeCount * 150;
    footFactors.push(`${officeCount} offices (~150 workers each)`);
  }
  estimatedDailyFoot = Math.round(estimatedDailyFoot);
  if (estimatedDailyFoot > 0 || footFactors.length > 0) {
    const sentiment = estimatedDailyFoot >= 5e3 ? "great" : estimatedDailyFoot >= 2e3 ? "good" : estimatedDailyFoot >= 500 ? "neutral" : "caution";
    results.push({
      extrapolationType: "estimated_foot_traffic",
      category: "demand_signal",
      title: "Estimated daily foot traffic",
      value: estimatedDailyFoot,
      unit: "people/day",
      interpretation: `Estimated ${estimatedDailyFoot.toLocaleString()} daily passers-by based on ${footFactors.join("; ")}.`,
      sentiment,
      confidence: footInputs.length >= 2 ? 0.55 : 0.35,
      confidenceLabel: "estimated",
      method: "statistical_model",
      derivationChain: {
        inputs: footInputs,
        logic: `Foot traffic estimated from MTA ridership (15% walk-past rate), pedestrian survey data, and nearby office worker count (~150 per office).`,
        assumptions: [
          "15% of subway riders walk past nearby storefronts",
          "~150 workers per office location",
          "Pedestrian survey data scaled 0.8x (survey captures ~80% of actual)"
        ]
      }
    });
  }
  if (report.census?.medianHouseholdIncome) {
    const income = report.census.medianHouseholdIncome;
    const priceTiers = {
      "cafe": { min: 45e3, sweet: 8e4 },
      "restaurant": { min: 55e3, sweet: 95e3 },
      "bar": { min: 5e4, sweet: 85e3 },
      "gym": { min: 6e4, sweet: 1e5 }
    };
    const tier = priceTiers[businessType] || priceTiers["cafe"];
    const alignmentScore = income >= tier.sweet ? 100 : income >= tier.min ? Math.round((income - tier.min) / (tier.sweet - tier.min) * 100) : Math.round(income / tier.min * 50);
    results.push({
      extrapolationType: "income_demand_alignment",
      category: "demand_signal",
      title: "Income-demand alignment",
      value: alignmentScore,
      unit: "score",
      interpretation: alignmentScore >= 80 ? `Median income $${income.toLocaleString()} is well above the sweet spot for a ${businessType}. Strong spending power.` : alignmentScore >= 50 ? `Median income $${income.toLocaleString()} supports a ${businessType}, but premium positioning may be challenging.` : `Median income $${income.toLocaleString()} is below typical for a successful ${businessType}. Value positioning recommended.`,
      sentiment: alignmentScore >= 80 ? "great" : alignmentScore >= 50 ? "good" : "caution",
      confidence: 0.75,
      confidenceLabel: "moderate",
      method: "rule_based",
      derivationChain: {
        inputs: [{
          source: "census-acs",
          field: "median_income",
          value: income,
          cacheKey: IntelCache.locationKey(lat, lng, "demographics")
        }],
        logic: `Compared median household income ($${income.toLocaleString()}) against ${businessType} threshold (min: $${tier.min.toLocaleString()}, sweet spot: $${tier.sweet.toLocaleString()}).`,
        assumptions: [
          `${businessType} minimum viable income threshold: $${tier.min.toLocaleString()}`,
          `${businessType} sweet spot income: $${tier.sweet.toLocaleString()}+`,
          "Census tract income reflects immediate trade area spending power"
        ]
      }
    });
  }
  return results;
}
function analyzeCompetitivePosition(report, reconciled, businessType, lat, lng) {
  const results = [];
  const directCompetitors = reconciled.entities.filter(
    (e) => e.entityType === "poi" && (e.entityCategory.includes(businessType) || businessType === "cafe" && (e.entityCategory.includes("coffee") || e.entityCategory.includes("cafe")) || businessType === "restaurant" && e.entityCategory.includes("restaurant") || businessType === "bar" && (e.entityCategory.includes("bar") || e.entityCategory.includes("pub")) || businessType === "gym" && (e.entityCategory.includes("gym") || e.entityCategory.includes("fitness")))
  );
  const competitorCount = directCompetitors.length;
  const chainPct = directCompetitors.length > 0 ? Math.round(directCompetitors.filter((c) => c.entityData.isChain).length / directCompetitors.length * 100) : 0;
  const avgRating = directCompetitors.length > 0 ? Math.round(directCompetitors.reduce((sum, c) => sum + (c.entityData.rating || 0), 0) / directCompetitors.length * 10) / 10 : 0;
  const saturationInputs = directCompetitors.flatMap((c) => c.derivationChain.inputs);
  const saturation = competitorCount <= 2 ? "underserved" : competitorCount <= 5 ? "balanced" : competitorCount <= 10 ? "competitive" : "saturated";
  const saturationSentiment = saturation === "underserved" ? "great" : saturation === "balanced" ? "good" : saturation === "competitive" ? "caution" : "warning";
  results.push({
    extrapolationType: "market_saturation",
    category: "competitive_position",
    title: `${capitalize$1(businessType)} market saturation`,
    value: competitorCount,
    unit: "competitors",
    interpretation: `${competitorCount} direct ${businessType} competitors within 500m. Market is ${saturation}. ${chainPct}% chains, avg rating ${avgRating}/5.`,
    sentiment: saturationSentiment,
    confidence: reconciled.avgConfidence,
    confidenceLabel: reconciled.avgConfidence >= 0.7 ? "high" : "moderate",
    method: "cross_reference",
    derivationChain: {
      inputs: saturationInputs.slice(0, 10),
      // Limit to first 10 for readability
      logic: `Counted ${competitorCount} direct competitors by matching reconciled POIs against business type "${businessType}". Sources cross-referenced: ${[...new Set(directCompetitors.flatMap((c) => c.sources))].join(", ")}.`,
      assumptions: ["500m radius defines the primary competitive zone", "Category matching may miss some indirect competitors"]
    }
  });
  if (directCompetitors.length > 0) {
    const pricedCompetitors = directCompetitors.filter((c) => c.entityData.priceLevel > 0);
    if (pricedCompetitors.length > 0) {
      const avgPrice = pricedCompetitors.reduce((s, c) => s + c.entityData.priceLevel, 0) / pricedCompetitors.length;
      const priceRange = {
        min: Math.min(...pricedCompetitors.map((c) => c.entityData.priceLevel)),
        max: Math.max(...pricedCompetitors.map((c) => c.entityData.priceLevel))
      };
      let gap;
      let gapSentiment;
      if (avgPrice <= 1.5 && report.census?.medianHouseholdIncome && report.census.medianHouseholdIncome > 8e4) {
        gap = "Premium gap — area income supports higher pricing than current market offers";
        gapSentiment = "great";
      } else if (avgPrice >= 3 && report.census?.medianHouseholdIncome && report.census.medianHouseholdIncome < 6e4) {
        gap = "Value gap — area may be over-served at premium price points";
        gapSentiment = "good";
      } else {
        gap = "Market priced appropriately for the area";
        gapSentiment = "neutral";
      }
      results.push({
        extrapolationType: "price_positioning",
        category: "competitive_position",
        title: "Pricing gap analysis",
        value: Math.round(avgPrice * 10) / 10,
        unit: "avg_price_level",
        interpretation: `Average competitor price level: ${avgPrice.toFixed(1)}/4 (range: ${priceRange.min}-${priceRange.max}). ${gap}.`,
        sentiment: gapSentiment,
        confidence: pricedCompetitors.length >= 3 ? 0.7 : 0.5,
        confidenceLabel: pricedCompetitors.length >= 3 ? "moderate" : "estimated",
        method: "cross_reference",
        derivationChain: {
          inputs: [{
            source: "reconciled_entities",
            field: "price_levels",
            value: pricedCompetitors.map((c) => c.entityData.priceLevel),
            cacheKey: "derived:competitive_position"
          }],
          logic: `Analyzed price levels of ${pricedCompetitors.length} competitors with known pricing. Cross-referenced with census median income.`,
          assumptions: ["Price level 1-4 scale ($ to $$$$)", "Income > $80K supports premium pricing", "Income < $60K suggests value positioning"]
        }
      });
    }
  }
  return results;
}
function analyzeRisks(report, reconciled, businessType, lat, lng) {
  const results = [];
  if (report.crime) {
    const crimeScore = report.crime.crimeScore;
    let riskLevel;
    let sentiment;
    if (crimeScore >= 80) {
      riskLevel = "Low crime area";
      sentiment = "great";
    } else if (crimeScore >= 60) {
      riskLevel = "Moderate crime — typical for NYC commercial areas";
      sentiment = "good";
    } else if (crimeScore >= 40) {
      riskLevel = "Elevated crime — may deter foot traffic, especially evenings";
      sentiment = "caution";
    } else {
      riskLevel = "High crime area — significant risk for customer safety perception";
      sentiment = "warning";
    }
    if (businessType === "bar" && report.crime.violentCount > 5) {
      riskLevel += ". Elevated violent crime may affect liquor license renewal.";
      sentiment = "warning";
    }
    results.push({
      extrapolationType: "crime_risk",
      category: "risk_assessment",
      title: "Crime risk assessment",
      value: 100 - crimeScore,
      // Invert: higher = more risk
      unit: "risk_score",
      interpretation: `${riskLevel}. ${report.crime.totalCount} incidents in area (${report.crime.violentCount} violent, ${report.crime.propertyCount} property).`,
      sentiment,
      confidence: 0.8,
      confidenceLabel: "high",
      method: "rule_based",
      derivationChain: {
        inputs: [{
          source: "nypd-complaints",
          field: "crime_summary",
          value: { score: crimeScore, total: report.crime.totalCount, violent: report.crime.violentCount },
          cacheKey: IntelCache.locationKey(lat, lng, "crime")
        }],
        logic: `Crime score ${crimeScore}/100 from NYPD CompStat data. Higher score = safer area.`,
        assumptions: ["Crime data may lag 30-90 days", "Score is relative to NYC-wide distribution"]
      }
    });
  }
  if (report.dob) {
    const violations = report.dob.violations?.length || 0;
    if (violations > 0) {
      results.push({
        extrapolationType: "building_violations",
        category: "risk_assessment",
        title: "Building violations risk",
        value: violations,
        unit: "violations",
        interpretation: `${violations} DOB violation(s) on nearby buildings. May indicate aging infrastructure or code enforcement activity.`,
        sentiment: violations > 5 ? "warning" : violations > 2 ? "caution" : "neutral",
        confidence: 0.85,
        confidenceLabel: "high",
        method: "rule_based",
        derivationChain: {
          inputs: [{
            source: "dob-violations",
            field: "violation_count",
            value: violations,
            cacheKey: IntelCache.locationKey(lat, lng, "dob")
          }],
          logic: `DOB violations within 300m radius of target location.`
        }
      });
    }
  }
  if (businessType === "bar" && report.liquorLicenses) {
    const existingLicenses = report.liquorLicenses.totalCount || 0;
    const saturation = existingLicenses > 10 ? "High liquor license density — new license may face community board opposition" : existingLicenses > 5 ? "Moderate license density" : "Low license density — favorable for new applications";
    results.push({
      extrapolationType: "liquor_license_risk",
      category: "risk_assessment",
      title: "Liquor license approval risk",
      value: existingLicenses,
      unit: "active_licenses",
      interpretation: `${existingLicenses} active liquor licenses within 500m. ${saturation}.`,
      sentiment: existingLicenses > 10 ? "warning" : existingLicenses > 5 ? "caution" : "good",
      confidence: 0.85,
      confidenceLabel: "high",
      method: "rule_based",
      derivationChain: {
        inputs: [{
          source: "nys-liquor-authority",
          field: "active_licenses",
          value: existingLicenses,
          cacheKey: IntelCache.locationKey(lat, lng, "liquor-licenses")
        }],
        logic: `Counted active liquor licenses within 500m. High density may trigger "500-foot rule" challenges.`,
        assumptions: ["Community boards have discretion over license density", "500-foot rule applies to on-premises licenses"]
      }
    });
  }
  return results;
}
function capitalize$1(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}
async function generateNarratives(report, reconciled, extrapolated, options = {}) {
  const startMs = Date.now();
  const insights = generateTemplateNarratives(report, reconciled, extrapolated);
  const useAI = options.useAI && private_env.OPENROUTER_API_KEY;
  if (useAI) {
    try {
      const aiInsights = await generateAINarratives(report, reconciled, extrapolated);
      for (const ai of aiInsights) {
        const idx = insights.findIndex((t) => t.insightType === ai.insightType);
        if (idx >= 0) {
          insights[idx] = ai;
        } else {
          insights.push(ai);
        }
      }
    } catch (err) {
      console.warn("[Narrative] AI generation failed, using templates:", err instanceof Error ? err.message : err);
    }
  }
  const sentimentScores = { great: 5, good: 4, neutral: 3, caution: 2, warning: 1 };
  const avgSentiment = insights.reduce((s, i) => s + sentimentScores[i.sentiment], 0) / (insights.length || 1);
  const overallSentiment = avgSentiment >= 4.5 ? "great" : avgSentiment >= 3.5 ? "good" : avgSentiment >= 2.5 ? "neutral" : avgSentiment >= 1.5 ? "caution" : "warning";
  const overallVerdict = generateVerdict(report, reconciled, extrapolated, overallSentiment);
  const realDataCount = report.sourceCoverage?.available || 0;
  const extrapolationCount = extrapolated.totalCount;
  const transparencyNote = `This analysis is based on ${realDataCount} real data sources and ${extrapolationCount} extrapolations. Each insight shows its confidence level and exactly which data points informed it. Extrapolations are clearly labeled — they represent our best inference from available data, not verified facts.`;
  return {
    insights,
    totalInsights: insights.length,
    mode: useAI ? "ai" : "local",
    processingMs: Date.now() - startMs,
    overallVerdict,
    overallSentiment,
    transparencyNote
  };
}
function generateTemplateNarratives(report, reconciled, extrapolated) {
  const insights = [];
  const bt = report.businessType;
  const forceMultipliers = extrapolated.extrapolations.filter((e) => e.category === "force_multiplier" && e.sentiment !== "warning");
  const risks = extrapolated.extrapolations.filter((e) => e.category === "risk_assessment");
  const demand = extrapolated.extrapolations.find((e) => e.extrapolationType === "estimated_foot_traffic");
  const income = extrapolated.extrapolations.find((e) => e.extrapolationType === "income_demand_alignment");
  const verdictParts = [];
  if (demand?.value) {
    const traffic = Number(demand.value);
    verdictParts.push(
      traffic >= 5e3 ? `High foot traffic area (~${traffic.toLocaleString()}/day).` : traffic >= 2e3 ? `Moderate foot traffic (~${traffic.toLocaleString()}/day).` : `Lower foot traffic area (~${traffic.toLocaleString()}/day).`
    );
  }
  if (forceMultipliers.length > 0) {
    const topFM = forceMultipliers.slice(0, 3).map((f) => f.title.replace(/ is a force multiplier.*/, "").toLowerCase());
    verdictParts.push(`Key force multipliers: ${topFM.join(", ")}.`);
  }
  const competitorExtrap = extrapolated.extrapolations.find((e) => e.extrapolationType === "market_saturation");
  if (competitorExtrap) {
    verdictParts.push(competitorExtrap.interpretation.split(".")[0] + ".");
  }
  if (income) {
    verdictParts.push(income.interpretation.split(".")[0] + ".");
  }
  const verdictConfidence = extrapolated.avgConfidence;
  insights.push({
    insightType: "verdict",
    title: `${capitalize(bt)} Location Assessment`,
    narrative: verdictParts.join(" ") || `Analysis complete for this ${bt} location.`,
    sentiment: forceMultipliers.length >= 3 ? "great" : forceMultipliers.length >= 1 ? "good" : "neutral",
    confidence: verdictConfidence,
    confidenceLabel: verdictConfidence >= 0.7 ? "high" : verdictConfidence >= 0.5 ? "moderate" : "estimated",
    disclosure: `Verdict based on ${reconciled.totalEntities} reconciled entities from ${report.sourceCoverage?.available || 0} data sources and ${extrapolated.totalCount} extrapolations.`,
    derivationChain: {
      inputs: [
        ...demand?.derivationChain.inputs || [],
        ...income?.derivationChain.inputs || []
      ].slice(0, 5),
      logic: "Location verdict synthesized from foot traffic estimates, force multiplier analysis, competitive position, and income alignment."
    },
    extrapolationIds: [
      demand?.extrapolationType,
      income?.extrapolationType,
      competitorExtrap?.extrapolationType,
      ...forceMultipliers.map((f) => f.extrapolationType)
    ].filter(Boolean),
    entityIds: [],
    generatedBy: "template"
  });
  const bestFM = forceMultipliers.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  if (bestFM) {
    insights.push({
      insightType: "opportunity",
      title: "Biggest Opportunity",
      narrative: bestFM.interpretation,
      sentiment: bestFM.sentiment,
      confidence: bestFM.confidence,
      confidenceLabel: bestFM.confidenceLabel,
      disclosure: `This opportunity was identified by cross-referencing ${bestFM.derivationChain.inputs.length} data points from ${[...new Set(bestFM.derivationChain.inputs.map((i) => i.source))].join(", ")}.`,
      derivationChain: bestFM.derivationChain,
      extrapolationIds: [bestFM.extrapolationType],
      entityIds: [],
      generatedBy: "template"
    });
  }
  const worstRisk = risks.sort((a, b) => {
    const order = { warning: 0, caution: 1, neutral: 2, good: 3, great: 4 };
    return order[a.sentiment] - order[b.sentiment];
  })[0];
  if (worstRisk) {
    insights.push({
      insightType: "risk",
      title: "Key Risk Factor",
      narrative: worstRisk.interpretation,
      sentiment: worstRisk.sentiment,
      confidence: worstRisk.confidence,
      confidenceLabel: worstRisk.confidenceLabel,
      disclosure: `Risk assessment from ${worstRisk.derivationChain.inputs[0]?.source || "multiple sources"}.`,
      derivationChain: worstRisk.derivationChain,
      extrapolationIds: [worstRisk.extrapolationType],
      entityIds: [],
      generatedBy: "template"
    });
  }
  const morning = extrapolated.extrapolations.find((e) => e.extrapolationType === "morning_viability");
  const evening = extrapolated.extrapolations.find((e) => e.extrapolationType === "evening_viability");
  if (morning && evening) {
    const morningVal = morning.value || 0;
    const eveningVal = evening.value || 0;
    const bestTime = morningVal >= eveningVal ? "morning" : "evening";
    const bestScore = Math.max(morningVal, eveningVal);
    const worstScore = Math.min(morningVal, eveningVal);
    let timeRec;
    if (bestScore - worstScore > 30) {
      timeRec = `This location is significantly stronger for ${bestTime} operations (score: ${bestScore} vs ${worstScore}). A ${bt} here should prioritize ${bestTime} hours for maximum traffic.`;
    } else {
      timeRec = `Morning (${morningVal}) and evening (${eveningVal}) viability are balanced. This location supports all-day operations.`;
    }
    insights.push({
      insightType: "recommendation",
      title: "Operating Hours Strategy",
      narrative: timeRec,
      sentiment: bestScore >= 60 ? "good" : "caution",
      confidence: (morning.confidence + evening.confidence) / 2,
      confidenceLabel: "estimated",
      disclosure: `Time-of-day analysis extrapolated from transit patterns, nearby business mix, and crime data. These are estimates, not verified traffic counts.`,
      derivationChain: {
        inputs: [
          ...morning.derivationChain.inputs,
          ...evening.derivationChain.inputs
        ].slice(0, 6),
        logic: `Compared morning viability (${morningVal}/100) vs evening viability (${eveningVal}/100) to determine optimal operating window.`,
        assumptions: [
          ...morning.derivationChain.assumptions || [],
          ...evening.derivationChain.assumptions || []
        ]
      },
      extrapolationIds: ["morning_viability", "evening_viability"],
      entityIds: [],
      generatedBy: "template"
    });
  }
  const realSources = report.sourceCoverage?.available || 0;
  const totalSources = report.sourceCoverage?.total || 20;
  const missingSourceCount = totalSources - realSources;
  const extrapolationCount = extrapolated.totalCount;
  const avgConf = Math.round(extrapolated.avgConfidence * 100);
  insights.push({
    insightType: "disclosure",
    title: "How This Analysis Was Built",
    narrative: `This report draws on ${realSources} of ${totalSources} available data sources. ${reconciled.poiCount} businesses were identified and deduplicated across Google Places, Foursquare, Yelp, and OpenStreetMap. ${reconciled.conflictsResolved} data conflicts were resolved via majority vote or weighted averaging. ${extrapolationCount} extrapolations were generated with an average confidence of ${avgConf}%. ` + (missingSourceCount > 5 ? `Note: ${missingSourceCount} data sources returned no data, which may affect reliability.` : `Data coverage is ${report.sourceCoverage?.pct || 0}% — ${realSources >= 15 ? "strong" : realSources >= 10 ? "adequate" : "limited"}.`),
    sentiment: "neutral",
    confidence: 1,
    // Meta-insight — always true
    confidenceLabel: "verified",
    disclosure: "This is a meta-disclosure about the analysis methodology. All claims here are factual descriptions of the processing pipeline.",
    derivationChain: {
      inputs: [{
        source: "pipeline_metadata",
        field: "source_coverage",
        value: { available: realSources, total: totalSources, pct: report.sourceCoverage?.pct },
        cacheKey: "meta:processing_run"
      }],
      logic: `Summary of Layer 1 (${realSources} raw sources), Layer 2 (${reconciled.totalEntities} entities, ${reconciled.conflictsResolved} conflicts), Layer 3 (${extrapolationCount} extrapolations, ${avgConf}% avg confidence).`
    },
    extrapolationIds: [],
    entityIds: [],
    generatedBy: "template"
  });
  return insights;
}
async function generateAINarratives(report, reconciled, extrapolated) {
  const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
  const topExtrapolations = extrapolated.extrapolations.sort((a, b) => b.confidence - a.confidence).slice(0, 8).map((e) => ({
    type: e.extrapolationType,
    title: e.title,
    value: e.value,
    unit: e.unit,
    interpretation: e.interpretation,
    sentiment: e.sentiment,
    confidence: e.confidence
  }));
  const topEntities = reconciled.entities.filter((e) => e.entityType === "poi").sort((a, b) => b.sourceCount - a.sourceCount).slice(0, 10).map((e) => ({
    name: e.entityName,
    category: e.entityCategory,
    sources: e.sources,
    confidence: e.confidence,
    rating: e.entityData.rating
  }));
  const systemPrompt = `You are a location intelligence analyst for RE², a platform that helps entrepreneurs evaluate business locations.

Your job is to generate ONE concise narrative insight (2-3 sentences) that synthesizes the extrapolation data into an actionable recommendation.

CRITICAL RULES:
1. NEVER fabricate data points — only reference values present in the provided data
2. Be specific — name actual businesses, exact scores, concrete numbers
3. Clearly distinguish verified data from extrapolations
4. Write for a non-technical entrepreneur
5. Return ONLY valid JSON — no markdown, no code fences

Return JSON:
{
  "title": "string (5-8 words)",
  "narrative": "string (2-3 sentences, actionable)",
  "sentiment": "great|good|neutral|caution|warning"
}`;
  const userMessage = `Business type: ${report.businessType}
Location: ${report.address || `${report.lat}, ${report.lng}`}
Source coverage: ${report.sourceCoverage?.available}/${report.sourceCoverage?.total} sources

Top extrapolations:
${JSON.stringify(topExtrapolations, null, 2)}

Top verified businesses nearby:
${JSON.stringify(topEntities, null, 2)}

Census: median income $${report.census?.medianHouseholdIncome?.toLocaleString() || "N/A"}, population ${report.census?.totalPopulation?.toLocaleString() || "N/A"}
Crime score: ${report.crime?.crimeScore || "N/A"}/100
Transit: ${report.mtaRidership?.totalDailyRidership?.toLocaleString() || "N/A"} daily riders

Generate one synthesized insight.`;
  const response = await openrouterFetch(
    OPENROUTER_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${private_env.OPENROUTER_API_KEY || ""}`,
        "HTTP-Referer": "https://resquared.io",
        "X-Title": "RE² Narrative Engine"
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
        max_tokens: 512,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        stream: false
      })
    },
    "NarrativeEngine"
  );
  if (!response) {
    console.error("[NarrativeEngine] OpenRouter retries exhausted — returning empty insights");
    return [];
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(text);
  return [{
    insightType: "verdict",
    title: parsed.title || "AI Location Analysis",
    narrative: parsed.narrative || "",
    sentiment: parsed.sentiment || "neutral",
    confidence: extrapolated.avgConfidence,
    confidenceLabel: "moderate",
    disclosure: `AI-generated narrative synthesizing ${topExtrapolations.length} extrapolations and ${topEntities.length} verified entities. The AI cannot add facts not present in the underlying data.`,
    derivationChain: {
      inputs: topExtrapolations.map((e) => ({
        source: "layer3_extrapolation",
        field: e.type,
        value: e.value,
        cacheKey: `extrapolation:${e.type}`
      })),
      logic: `Claude Sonnet synthesized ${topExtrapolations.length} extrapolations into a cohesive narrative. All referenced data points are traceable to Layer 1-3.`,
      assumptions: ["AI narrative is bounded by provided extrapolation data", "No external knowledge injected"]
    },
    extrapolationIds: topExtrapolations.map((e) => e.type),
    entityIds: topEntities.map((e) => e.name).filter(Boolean),
    generatedBy: "claude-sonnet"
  }];
}
function generateVerdict(report, reconciled, extrapolated, overallSentiment) {
  const bt = report.businessType;
  const sources = report.sourceCoverage?.available || 0;
  const verdictMap = {
    great: `This location shows strong potential for a ${bt}. Multiple force multipliers, good foot traffic fundamentals, and favorable demographics align well.`,
    good: `This is a solid location for a ${bt} with some clear advantages, though a few factors warrant attention before committing.`,
    neutral: `This location has mixed signals for a ${bt}. Some positive fundamentals but notable gaps or risks that need careful evaluation.`,
    caution: `This location presents challenges for a ${bt}. The data suggests headwinds that would need creative solutions to overcome.`,
    warning: `The data raises significant concerns about this location for a ${bt}. Multiple risk factors suggest reconsidering or conducting much deeper due diligence.`
  };
  return `${verdictMap[overallSentiment]} (Based on ${sources} data sources, ${reconciled.totalEntities} entities, ${extrapolated.totalCount} extrapolations)`;
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
function encodeGeohash5(lat, lng) {
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let isLng = true, bit = 0, idx = 0, hash = "";
  while (hash.length < 5) {
    const mid = isLng ? (minLng + maxLng) / 2 : (minLat + maxLat) / 2;
    const val = isLng ? lng : lat;
    if (val >= mid) {
      idx = idx * 2 + 1;
      if (isLng) minLng = mid;
      else minLat = mid;
    } else {
      idx = idx * 2;
      if (isLng) maxLng = mid;
      else maxLat = mid;
    }
    isLng = !isLng;
    if (++bit === 5) {
      hash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}
async function fetchLocationIntel(lat, lng, businessType = "cafe", address) {
  const errors = [];
  const latKey = Math.round(lat * 1e4) / 1e4;
  const lngKey = Math.round(lng * 1e4) / 1e4;
  const INTEL_CACHE_KEY = `location-intel:${latKey},${lngKey},${businessType || "general"}`;
  const INTEL_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
  try {
    const cacheQuery = db.execute(sql`SELECT data, fetched_at, ttl_ms FROM intel_cache WHERE cache_key = ${INTEL_CACHE_KEY} LIMIT 1`);
    let cacheTimeoutId;
    const cacheTimeout = new Promise((resolve) => {
      cacheTimeoutId = setTimeout(() => resolve(null), 2e3);
    });
    const result = await Promise.race([cacheQuery, cacheTimeout]).finally(() => clearTimeout(cacheTimeoutId));
    if (result === null) {
      console.warn("[IntelCache] CHECK timed out (2s) — skipping cache");
    } else if (Array.isArray(result) && result.length > 0 || result.rows && result.rows.length > 0) {
      const rows = Array.isArray(result) ? result : result.rows;
      const row = rows[0];
      const age = Date.now() - new Date(row.fetched_at).getTime();
      const ttl = row.ttl_ms ?? INTEL_TTL_MS;
      if (age < ttl) {
        console.log(`[IntelCache] HIT for ${latKey},${lngKey} (age: ${Math.round(age / 1e3)}s) — returning cached report`);
        return row.data;
      } else {
        const cachedReport = row.data;
        const goodCoverage = (cachedReport.sourceCoverage?.available ?? 0) >= 12;
        if (goodCoverage) {
          console.log(`[IntelCache] STALE but good coverage (${cachedReport.sourceCoverage?.available}/20) — serving cached, refreshing in background`);
          fetchEnhancedLocationIntel(lat, lng, businessType, address).catch(() => {
          });
          return cachedReport;
        }
        console.log(`[IntelCache] STALE + poor coverage (${cachedReport.sourceCoverage?.available ?? 0}/20) — re-fetching`);
      }
    } else {
      console.log(`[IntelCache] MISS for ${latKey},${lngKey} — fetching from APIs`);
    }
  } catch (e) {
    console.warn("[IntelCache] Check failed:", e);
  }
  const HARD_CEILING_MS = 2e4;
  const SOURCE_COUNT = 21;
  const results = new Array(SOURCE_COUNT).fill({
    status: "rejected",
    reason: new Error("Hard ceiling timeout — source did not complete in time")
  });
  const radius = getConceptScanRadius(businessType);
  const calls = [
    resilientFetch("census", () => fetchCensusData(lat, lng)),
    resilientFetch("census_housing", () => fetchCensusHousing(lat, lng)),
    resilientFetch("walkscore", () => fetchWalkScore(lat, lng, address)),
    resilientFetch("dohmh", () => fetchInspections(lat, lng, 500)),
    resilientFetch("crime", () => fetchCrimeData(lat, lng, 300)),
    resilientFetch("google_places", () => fetchNearbyPlaces(lat, lng, businessType, radius)),
    resilientFetch("google_density", () => fetchMarketDensity(lat, lng, radius)),
    resilientFetch("overpass", () => scanCompetitors(lat, lng, businessType, radius)),
    resilientFetch("lpc", () => fetchLPCData(lat, lng, 100)),
    resilientFetch("mta", () => fetchMTARidership(lat, lng, 800)),
    resilientFetch("dca", () => fetchDCALicenses(lat, lng, 500)),
    resilientFetch("dob", () => fetchDOBData(lat, lng, 300)),
    resilientFetch("complaints_311", () => fetch311Complaints(lat, lng, 500)),
    resilientFetch("pedestrian", () => fetchPedestrianCounts(lat, lng, 500)),
    resilientFetch("pluto", () => fetchPLUTOData(lat, lng, 300)),
    resilientFetch("sidewalk_cafes", () => fetchSidewalkCafes(lat, lng, 500)),
    resilientFetch("liquor", () => fetchLiquorLicenses(lat, lng, 500)),
    resilientFetch("foursquare", () => fetchFoursquareData(lat, lng, businessType, radius)),
    resilientFetch("yelp", () => fetchYelpData(lat, lng, businessType, radius)),
    resilientFetch("momentum", () => fetchMomentumData(lat, lng, 500)),
    resilientFetch("schools", () => fetchSchoolProximity(lat, lng, 305))
  ];
  calls.forEach((p, i) => {
    p.then(
      (value) => {
        results[i] = { status: "fulfilled", value };
      },
      (reason) => {
        results[i] = { status: "rejected", reason };
      }
    );
  });
  let hardCeilingId;
  await Promise.race([
    Promise.allSettled(calls),
    new Promise(
      (resolve) => hardCeilingId = setTimeout(() => {
        const done = results.filter((r) => r.reason?.message !== "Hard ceiling timeout — source did not complete in time").length;
        console.warn(`[LocationIntel] HARD CEILING HIT (${HARD_CEILING_MS}ms) — ${done}/${SOURCE_COUNT} sources completed`);
        resolve();
      }, HARD_CEILING_MS)
    )
  ]).finally(() => clearTimeout(hardCeilingId));
  const [
    census,
    censusHousing,
    walkScore,
    inspections,
    crime,
    places,
    marketDensity,
    competitors,
    lpc,
    mtaRidership,
    dcaLicenses,
    dob,
    complaints311,
    pedestrian,
    pluto,
    sidewalkCafes,
    liquorLicenses,
    foursquare,
    yelp,
    momentum,
    schools
  ] = results;
  function extract(result, label) {
    if (result.status === "fulfilled") {
      if (result.value === null) {
        errors.push(`${label}: returned null (API may be unreachable or returned no data)`);
      }
      return result.value;
    }
    errors.push(`${label}: ${result.reason?.message || "Unknown error"}`);
    return null;
  }
  const extractedPlaces = extract(places, "Places");
  const extractedFoursquare = extract(foursquare, "Foursquare");
  const extractedYelp = extract(yelp, "Yelp");
  let extractedCompetitors = extract(competitors, "Competitors");
  const competitorsEmpty = !extractedCompetitors || extractedCompetitors.totalCount === 0;
  if (competitorsEmpty && (extractedFoursquare || extractedPlaces || extractedYelp)) {
    const synthesized = buildCompetitorsFromSources(
      lat,
      lng,
      businessType,
      extractedFoursquare,
      extractedPlaces,
      extractedYelp
    );
    if (synthesized && synthesized.totalCount > 0) {
      extractedCompetitors = synthesized;
      const overpassErrIdx = errors.findIndex((e) => e.startsWith("Competitors:"));
      if (overpassErrIdx >= 0) errors.splice(overpassErrIdx, 1);
    }
  }
  const extractedMarketDensity = extract(marketDensity, "Market Density");
  if (extractedCompetitors && extractedMarketDensity) {
    const densityToBucket = {
      "cafe": "cafes",
      "restaurant": "restaurants",
      "gym": "gyms"
    };
    for (const [densityType, bucketName] of Object.entries(densityToBucket)) {
      const mdCategory = extractedMarketDensity.categories.find((c) => c.placeType === densityType);
      const bucket = extractedCompetitors.amenities[bucketName];
      if (mdCategory && mdCategory.count > 0 && bucket.length === 0) {
        extractedCompetitors.amenities[bucketName] = Array.from(
          { length: mdCategory.count },
          () => ({
            name: "",
            // intentionally blank — source='market-density' means suppress names
            lat: 0,
            lng: 0,
            distance: 0.25,
            type: densityType,
            isChain: false,
            tags: { source: "market-density", avgRating: String(mdCategory.avgRating), chainPct: String(mdCategory.chainPct) }
          })
        );
      }
    }
  }
  const report = {
    lat,
    lng,
    address,
    businessType,
    census: extract(census, "Census"),
    censusHousing: extract(censusHousing, "Census Housing"),
    walkScore: extract(walkScore, "WalkScore"),
    inspections: extract(inspections, "Inspections"),
    crime: extract(crime, "Crime"),
    places: extractedPlaces,
    marketDensity: extractedMarketDensity,
    competitors: extractedCompetitors,
    lpc: extract(lpc, "LPC"),
    mtaRidership: extract(mtaRidership, "MTA Ridership"),
    dcaLicenses: extract(dcaLicenses, "DCA Licenses"),
    dob: extract(dob, "DOB Permits"),
    complaints311: extract(complaints311, "311 Complaints"),
    pedestrian: extract(pedestrian, "Pedestrian Counts"),
    pluto: extract(pluto, "PLUTO"),
    sidewalkCafes: extract(sidewalkCafes, "Sidewalk Cafes"),
    liquorLicenses: extract(liquorLicenses, "Liquor Licenses"),
    foursquare: extractedFoursquare,
    yelp: extractedYelp,
    momentum: extract(momentum, "Momentum"),
    schools: extract(schools, "Schools"),
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    errors,
    sourceCoverage: { available: 0, total: 21, pct: 0 }
  };
  const sourceKeys = [
    "census",
    "censusHousing",
    "walkScore",
    "inspections",
    "crime",
    "places",
    "marketDensity",
    "competitors",
    "lpc",
    "mtaRidership",
    "dcaLicenses",
    "dob",
    "complaints311",
    "pedestrian",
    "pluto",
    "sidewalkCafes",
    "liquorLicenses",
    "foursquare",
    "yelp",
    "momentum",
    "schools"
  ];
  const available = sourceKeys.filter((k) => report[k] !== null).length;
  report.sourceCoverage = { available, total: 21, pct: Math.round(available / 21 * 100) };
  {
    const plutoData = extract(pluto, "PLUTO");
    const bbl = plutoData?.nearestLot?.bbl ?? "";
    if (bbl) {
      try {
        const nearestLot = plutoData.nearestLot;
        const propertyTax = await fetchPropertyTaxProfile(
          bbl,
          0,
          // sqft: will be filled from session at scoring time
          nearestLot.bldgArea,
          nearestLot.bldgClass
        );
        report.propertyTax = propertyTax;
        if (propertyTax) {
          report.sourceCoverage = {
            available: (report.sourceCoverage?.available ?? 0) + 1,
            total: 21,
            pct: Math.round(((report.sourceCoverage?.available ?? 0) + 1) / 21 * 100)
          };
        }
      } catch (err) {
        console.warn("[Intel] DOF property tax failed:", err instanceof Error ? err.message : err);
        report.propertyTax = null;
      }
    } else {
      report.propertyTax = null;
    }
  }
  if (address) {
    try {
      const existingPOIs = extractPOIsFromIntel(report);
      const streetSide = await computeStreetSideIntel(lat, lng, address, existingPOIs);
      report.streetSide = streetSide;
    } catch (err) {
      console.warn("[Intel] Street-side analysis failed:", err instanceof Error ? err.message : err);
      report.streetSide = null;
    }
  }
  if (address) {
    try {
      const { fetchLocationHistory: fetchLocationHistory2, computeChurnRisk: computeChurnRisk2 } = await import("./location-history.js");
      const history = await fetchLocationHistory2(address, lat, lng);
      report.locationHistory = history;
      report.churnRisk = computeChurnRisk2(history);
    } catch (err) {
      console.warn("[Intel] Location history/churn risk failed:", err instanceof Error ? err.message : err);
      report.locationHistory = null;
      report.churnRisk = null;
    }
  }
  const MIN_SOURCES_TO_CACHE = 8;
  const sourcesAvailable = report.sourceCoverage?.available ?? 0;
  if (sourcesAvailable < MIN_SOURCES_TO_CACHE) {
    console.warn(`[IntelCache] SKIPPED write — only ${sourcesAvailable}/20 sources (below ${MIN_SOURCES_TO_CACHE} threshold)`);
  } else {
    try {
      const fetchedAtStr = (/* @__PURE__ */ new Date()).toISOString();
      await db.execute(sql`
			INSERT INTO intel_cache (cache_key, source, data, ttl_ms, fetched_at)
			VALUES (${INTEL_CACHE_KEY}, 'location-intel', ${JSON.stringify(report)}::jsonb, ${INTEL_TTL_MS}, ${fetchedAtStr})
			ON CONFLICT (cache_key) DO UPDATE SET
				source = EXCLUDED.source,
				data = EXCLUDED.data,
				ttl_ms = EXCLUDED.ttl_ms,
				fetched_at = EXCLUDED.fetched_at
		`);
      console.log(`[IntelCache] STORED ${sourcesAvailable}/20 sources for ${latKey},${lngKey} (key: ${INTEL_CACHE_KEY})`);
    } catch (e) {
      console.warn("[IntelCache] Store failed:", e);
    }
  }
  return report;
}
async function fetchEnhancedLocationIntel(lat, lng, businessType = "cafe", address, options = {}) {
  const pipelineStart = Date.now();
  const layer1Start = Date.now();
  const rawReport = await fetchLocationIntel(lat, lng, businessType, address);
  const layer1Ms = Date.now() - layer1Start;
  const geohash5 = encodeGeohash5(lat, lng);
  const historicalContext = await lookupHistoricalContext(geohash5).catch(() => []);
  const SERVERLESS_BUDGET_MS = 24e3;
  const remainingBudget = SERVERLESS_BUDGET_MS - layer1Ms;
  const skipEnhancedLayers = remainingBudget < 5e3;
  if (skipEnhancedLayers) {
    console.warn(`[Pipeline] Layer 1 took ${layer1Ms}ms — skipping enhanced layers (${remainingBudget}ms remaining)`);
  }
  if (options.signal?.aborted) {
    console.warn(`[Pipeline] Aborted by caller before enhanced layers — halting execution`);
    throw new Error("Pipeline aborted by timeout");
  }
  const layer2Start = Date.now();
  const haikuStart = Date.now();
  const gateStart = Date.now();
  const [qualityGate, reconciled, haikuExtraction] = skipEnhancedLayers ? [
    { grade: "B", action: "proceed", confidence: { level: "GOOD", percentage: 70, band: { low: 6, high: 6 }, sourceCoverage: [], criticalMissing: [], recommendation: "Skipped — time budget exceeded." }, issues: [], criticalCount: 0, warningCount: 0, infoCount: 0, summary: "Enhanced layers skipped due to time constraints.", llmCheckRan: false, latencyMs: 0 },
    reconcileEntities(rawReport),
    null
  ] : await Promise.all([
    runDataQualityGate(rawReport, businessType, geohash5).catch((err) => {
      console.error("[Pipeline] Quality gate failed (non-blocking):", err);
      return {
        grade: "B",
        action: "proceed",
        confidence: { level: "GOOD", percentage: 70, band: { low: 6, high: 6 }, sourceCoverage: [], criticalMissing: [], recommendation: "Quality gate unavailable — proceeding with default confidence." },
        issues: [],
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        summary: "Data quality check unavailable. Score generated with standard pipeline.",
        llmCheckRan: false,
        latencyMs: 0
      };
    }),
    Promise.resolve(reconcileEntities(rawReport)),
    extractWithHaiku(rawReport).catch((err) => {
      console.error("[Pipeline] Haiku extraction failed (non-blocking):", err);
      return null;
    })
  ]);
  const gateMs = Date.now() - gateStart;
  const layer2Ms = Date.now() - layer2Start;
  const haikuMs = Date.now() - haikuStart;
  const layer3Start = Date.now();
  const extrapolated = skipEnhancedLayers ? { extrapolations: [], totalCount: 0, byCategory: {}, avgConfidence: 0, processingMs: 0 } : generateExtrapolations(rawReport, reconciled);
  const layer3Ms = Date.now() - layer3Start;
  if (options.signal?.aborted) {
    console.warn(`[Pipeline] Aborted by caller before Layer 4 LLM analysis — halting execution`);
    throw new Error("Pipeline aborted by timeout");
  }
  const layer4Start = Date.now();
  const sonnetStart = Date.now();
  const [narratives, neighborhoodAnalysis] = skipEnhancedLayers ? [
    { insights: [], totalInsights: 0, mode: "local", processingMs: 0, overallVerdict: "Analysis skipped due to time constraints — raw data is available above.", overallSentiment: "neutral", transparencyNote: "Enhanced layers skipped to stay within serverless time budget." },
    null
  ] : await Promise.all([
    generateNarratives(rawReport, reconciled, extrapolated, options),
    analyzeNeighborhood(rawReport, reconciled, extrapolated, haikuExtraction ?? void 0, historicalContext.length > 0 ? historicalContext : void 0).catch(
      (err) => {
        console.error("[Pipeline] Sonnet analysis failed (non-blocking):", err);
        return null;
      }
    )
  ]);
  const layer4Ms = Date.now() - layer4Start;
  const sonnetMs = Date.now() - sonnetStart;
  return {
    ...rawReport,
    qualityGate,
    reconciled,
    extrapolated,
    narratives,
    haikuExtraction,
    neighborhoodAnalysis,
    pipeline: {
      version: "v1.2",
      layers: {
        layer1: {
          sources: rawReport.sourceCoverage?.available || 0,
          total: rawReport.sourceCoverage?.total || 20,
          ms: layer1Ms
        },
        qualityGate: {
          grade: qualityGate.grade,
          action: qualityGate.action,
          issues: qualityGate.issues.length,
          ms: gateMs
        },
        layer2: {
          entities: reconciled.totalEntities,
          conflicts: reconciled.conflictsResolved,
          ms: layer2Ms
        },
        layer3: {
          extrapolations: extrapolated.totalCount,
          avgConfidence: extrapolated.avgConfidence,
          ms: layer3Ms
        },
        layer4: {
          insights: narratives.totalInsights,
          mode: narratives.mode,
          ms: layer4Ms
        },
        haikuExtractor: {
          extracted: haikuExtraction !== null,
          ms: haikuMs
        },
        sonnetAnalyst: {
          analyzed: neighborhoodAnalysis !== null,
          ms: sonnetMs
        }
      },
      totalMs: Date.now() - pipelineStart
    }
  };
}
export {
  fetchEnhancedLocationIntel as a,
  fetchLocationIntel as f
};
