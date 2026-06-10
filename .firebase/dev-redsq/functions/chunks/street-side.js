import { I as IntelCache, i as intelCache, T as TTL } from "./cache.js";
import { d as db } from "./db-server.js";
import { sql } from "drizzle-orm";
import { h as haversineMeters } from "./geo-math.js";
const MANHATTAN_GRID_ANGLE_DEG = 29;
const MANHATTAN_GRID_ANGLE_RAD = MANHATTAN_GRID_ANGLE_DEG * Math.PI / 180;
const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LNG = 111320 * Math.cos(40.75 * Math.PI / 180);
const SIDE_THRESHOLD_METERS = 8;
const SEARCH_RADIUS_M = 250;
const HOSTILITY_ZONES = [
  // Lincoln Tunnel approach — 9th Ave & 37th-39th St
  {
    name: "Lincoln Tunnel approach (9th Ave)",
    type: "tunnel_approach",
    lat: 40.7567,
    lng: -73.9936,
    radiusM: 300,
    bearingRange: [150, 240],
    penalty: -15
  },
  // Lincoln Tunnel Dyer Ave approach
  {
    name: "Lincoln Tunnel (Dyer Ave)",
    type: "tunnel_approach",
    lat: 40.758,
    lng: -73.9948,
    radiusM: 200,
    bearingRange: [180, 270],
    penalty: -12
  },
  // Holland Tunnel approach — Canal St / Varick
  {
    name: "Holland Tunnel approach (Canal/Varick)",
    type: "tunnel_approach",
    lat: 40.7254,
    lng: -74.0071,
    radiusM: 250,
    bearingRange: [180, 300],
    penalty: -12
  },
  // Queensboro Bridge approach — 2nd Ave & 59th-60th
  {
    name: "Queensboro Bridge approach",
    type: "tunnel_approach",
    lat: 40.7586,
    lng: -73.9602,
    radiusM: 200,
    bearingRange: [60, 150],
    penalty: -10
  },
  // FDR Drive entrance — multiple locations
  {
    name: "FDR Drive on-ramp (East 34th)",
    type: "highway_ramp",
    lat: 40.7445,
    lng: -73.9713,
    radiusM: 150,
    bearingRange: [60, 120],
    penalty: -8
  },
  // Port Authority Bus Terminal — heavy bus traffic
  {
    name: "Port Authority Bus Terminal",
    type: "bus_depot",
    lat: 40.7568,
    lng: -73.99,
    radiusM: 200,
    bearingRange: [0, 360],
    penalty: -10
  },
  // West Side Highway / 12th Ave
  {
    name: "West Side Highway corridor",
    type: "highway_ramp",
    lat: 40.759,
    lng: -73.999,
    radiusM: 100,
    bearingRange: [0, 360],
    penalty: -8
  },
  // BQE / Manhattan Bridge approach
  {
    name: "Manhattan Bridge approach (Canal/Bowery)",
    type: "tunnel_approach",
    lat: 40.7145,
    lng: -73.9976,
    radiusM: 200,
    bearingRange: [90, 180],
    penalty: -10
  },
  // Williamsburg Bridge approach
  {
    name: "Williamsburg Bridge approach (Delancey)",
    type: "tunnel_approach",
    lat: 40.7153,
    lng: -73.9835,
    radiusM: 200,
    bearingRange: [60, 150],
    penalty: -10
  }
];
async function fetchSubwayEntrances(lat, lng, radiusM = SEARCH_RADIUS_M) {
  const cacheKey = IntelCache.locationKey(lat, lng, "subway-entrances");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  let entrances = [];
  try {
    const dbRes = await db.execute(sql`
			SELECT * FROM nearby_subway_entrances(${lat}, ${lng}, ${radiusM})
		`);
    const rows = Array.isArray(dbRes) ? dbRes : dbRes.rows;
    if (rows && rows.length > 0) {
      entrances = rows.map((r) => ({
        lat: r.lat,
        lng: r.lng,
        type: "subway_entrance",
        name: `${r.stop_name} (${r.routes || ""})`,
        distance: Math.round(r.distance_m)
      }));
      console.log(`[StreetSide] DB: ${entrances.length} subway entrances within ${radiusM}m`);
      intelCache.set(cacheKey, entrances, TTL.TRANSIT, "subway-entrances");
      return entrances;
    }
  } catch (error) {
    console.warn("[StreetSide] DB subway query failed:", error.message);
  }
  try {
    const url = new URL("https://data.ny.gov/resource/i9wp-a4ja.json");
    url.searchParams.set("$select", "entrance_latitude,entrance_longitude,stop_name,daytime_routes,entry_allowed,exit_allowed");
    url.searchParams.set(
      "$where",
      `within_circle(entrance_georeference,${lat},${lng},${radiusM})`
    );
    url.searchParams.set("$limit", "100");
    const resp = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8e3),
      headers: { "Accept": "application/json" }
    });
    if (!resp.ok) {
      console.warn(`[StreetSide] Subway entrances API ${resp.status}`);
      return cached?.data || [];
    }
    const raw = await resp.json();
    entrances = raw.filter((r) => r.entrance_latitude && r.entrance_longitude).map((r) => {
      const eLat = parseFloat(r.entrance_latitude);
      const eLng = parseFloat(r.entrance_longitude);
      return {
        lat: eLat,
        lng: eLng,
        type: "subway_entrance",
        name: `${r.stop_name} (${r.daytime_routes})`,
        distance: haversineMeters(lat, lng, eLat, eLng)
      };
    }).filter((e) => e.distance <= radiusM).sort((a, b) => a.distance - b.distance);
    intelCache.set(cacheKey, entrances, TTL.TRANSIT, "subway-entrances");
    return entrances;
  } catch (err) {
    console.warn("[StreetSide] Subway entrances fetch error:", err instanceof Error ? err.message : err);
    return cached?.data || [];
  }
}
async function fetchBusStops(lat, lng, radiusM = SEARCH_RADIUS_M) {
  const cacheKey = IntelCache.locationKey(lat, lng, "bus-stops");
  const cached = await intelCache.getAsync(cacheKey);
  if (cached?.fresh) return cached.data;
  let stops = [];
  try {
    const dbRes = await db.execute(sql`
			SELECT * FROM nearby_bus_stops(${lat}, ${lng}, ${radiusM})
		`);
    const rows = Array.isArray(dbRes) ? dbRes : dbRes.rows;
    if (rows && rows.length > 0) {
      stops = rows.map((r) => ({
        lat: r.lat,
        lng: r.lng,
        type: "bus_stop",
        name: `${r.stop_name}${r.route ? ` (${r.route})` : ""}`,
        distance: Math.round(r.distance_m)
      }));
      console.log(`[StreetSide] DB: ${stops.length} bus stops within ${radiusM}m`);
      intelCache.set(cacheKey, stops, TTL.TRANSIT, "bus-stops");
      return stops;
    }
  } catch (error) {
    console.warn("[StreetSide] DB bus stops query failed:", error.message);
  }
  try {
    const url = new URL("https://data.ny.gov/resource/ai5j-txmn.json");
    url.searchParams.set("$select", "stop_name,latitude,longitude,route_short_name");
    url.searchParams.set(
      "$where",
      `within_circle(georeference,${lat},${lng},${radiusM})`
    );
    url.searchParams.set("$limit", "200");
    const resp = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8e3),
      headers: { "Accept": "application/json" }
    });
    if (!resp.ok) {
      console.warn(`[StreetSide] Bus stops API ${resp.status}`);
      return cached?.data || [];
    }
    const raw = await resp.json();
    stops = raw.filter((r) => r.latitude && r.longitude).map((r) => {
      const sLat = parseFloat(r.latitude);
      const sLng = parseFloat(r.longitude);
      return {
        lat: sLat,
        lng: sLng,
        type: "bus_stop",
        name: `${r.stop_name}${r.route_short_name ? ` (${r.route_short_name})` : ""}`,
        distance: haversineMeters(lat, lng, sLat, sLng)
      };
    }).filter((s) => s.distance <= radiusM).sort((a, b) => a.distance - b.distance);
    intelCache.set(cacheKey, stops, TTL.TRANSIT, "bus-stops");
    return stops;
  } catch (err) {
    console.warn("[StreetSide] Bus stops fetch error:", err instanceof Error ? err.message : err);
    return cached?.data || [];
  }
}
function extractPOIsFromIntel(intelReport) {
  const pois = [];
  if (intelReport.places?.results) {
    for (const p of intelReport.places.results) {
      if (p.lat && p.lng) {
        pois.push({
          lat: p.lat,
          lng: p.lng,
          type: "poi",
          name: p.name || "Unknown",
          distance: 0
          // will be computed later
        });
      }
    }
  }
  if (intelReport.competitors?.competitors) {
    for (const c of intelReport.competitors.competitors) {
      if (c.lat && c.lng) {
        pois.push({
          lat: c.lat,
          lng: c.lng,
          type: "poi",
          name: c.name || "Unknown",
          distance: c.distance * 1e3
          // km → m
        });
      }
    }
  }
  return pois;
}
const NAMED_DEVELOPMENTS = {
  "manhattan west": { frontageStreet: "9th Ave", type: "avenue", label: "9th ave" },
  "1 manhattan west": { frontageStreet: "9th Ave", type: "avenue", label: "9th ave" },
  "2 manhattan west": { frontageStreet: "9th Ave", type: "avenue", label: "9th ave" },
  "3 manhattan west": { frontageStreet: "9th Ave", type: "avenue", label: "9th ave" },
  "hudson yards": { frontageStreet: "10th Ave", type: "avenue", label: "10th ave" },
  "10 hudson yards": { frontageStreet: "10th Ave", type: "avenue", label: "10th ave" },
  "30 hudson yards": { frontageStreet: "10th Ave", type: "avenue", label: "10th ave" },
  "35 hudson yards": { frontageStreet: "10th Ave", type: "avenue", label: "10th ave" },
  "50 hudson yards": { frontageStreet: "10th Ave", type: "avenue", label: "10th ave" },
  "55 hudson yards": { frontageStreet: "10th Ave", type: "avenue", label: "10th ave" },
  "brookfield place": { frontageStreet: "West St", type: "avenue", label: "west st" },
  "world trade center": { frontageStreet: "West St", type: "avenue", label: "west st" },
  "one world trade": { frontageStreet: "West St", type: "avenue", label: "west st" },
  "1 world trade": { frontageStreet: "West St", type: "avenue", label: "west st" },
  "rockefeller center": { frontageStreet: "6th Ave", type: "avenue", label: "6th ave" },
  "rockefeller plaza": { frontageStreet: "6th Ave", type: "avenue", label: "6th ave" },
  "lincoln center": { frontageStreet: "Columbus Ave", type: "avenue", label: "columbus ave" },
  "columbus circle": { frontageStreet: "Broadway", type: "diagonal", label: "broadway" },
  "time warner center": { frontageStreet: "Broadway", type: "diagonal", label: "broadway" },
  "essex crossing": { frontageStreet: "Essex St", type: "avenue", label: "essex st" },
  "pier 17": { frontageStreet: "South St", type: "street", label: "south st" },
  "south street seaport": { frontageStreet: "South St", type: "street", label: "south st" },
  "battery park city": { frontageStreet: "West St", type: "avenue", label: "west st" },
  "stuyvesant town": { frontageStreet: "1st Ave", type: "avenue", label: "1st ave" },
  "peter cooper village": { frontageStreet: "1st Ave", type: "avenue", label: "1st ave" },
  "chelsea market": { frontageStreet: "9th Ave", type: "avenue", label: "9th ave" },
  "penn station": { frontageStreet: "7th Ave", type: "avenue", label: "7th ave" },
  "moynihan train hall": { frontageStreet: "8th Ave", type: "avenue", label: "8th ave" },
  "grand central": { frontageStreet: "Park Ave", type: "avenue", label: "park ave" },
  "penn plaza": { frontageStreet: "7th Ave", type: "avenue", label: "7th ave" },
  "1 penn plaza": { frontageStreet: "7th Ave", type: "avenue", label: "7th ave" },
  "2 penn plaza": { frontageStreet: "7th Ave", type: "avenue", label: "7th ave" }
};
function classifyStreetType(address) {
  const streetPart = address.split(",")[0].trim();
  const streetName = streetPart.replace(/^\d+[-\s]*/, "").trim().toLowerCase();
  const normalized = streetPart.toLowerCase().trim();
  for (const [key, dev] of Object.entries(NAMED_DEVELOPMENTS)) {
    if (normalized.includes(key)) {
      return { type: dev.type, name: dev.label };
    }
  }
  if (/\bbroadway\b/i.test(streetName)) {
    return { type: "diagonal", name: "Broadway" };
  }
  const namedAvenues = /\b(amsterdam|columbus|lexington|madison|park|york|west\s*end|riverside|allen|essex|bowery|chrystie|lafayette|varick|hudson|greenwich|washington|church|centre|mulberry|mott|elizabeth|baxter|mercer|wooster|greene|crosby)\b/i;
  if (namedAvenues.test(streetName)) {
    return { type: "avenue", name: streetName };
  }
  const avenuePatterns = [
    /\bave(nue)?\b/i,
    /\bav\b/i,
    /\b(1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th)\s*ave/i,
    /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s*ave/i
  ];
  if (avenuePatterns.some((rx) => rx.test(streetName))) {
    return { type: "avenue", name: streetName };
  }
  if (/\bblvd\b|\bboulevard\b/i.test(streetName)) {
    return { type: "boulevard", name: streetName };
  }
  const namedStreets = /\b(wall|fulton|canal|houston|delancey|spring|prince|bleecker|waverly|christopher|chambers|worth|duane|reade|barclay|vesey|liberty|cortlandt|maiden|john|pine|cedar|warren)\s*(st|street)?\b/i;
  if (namedStreets.test(streetName)) {
    return { type: "street", name: streetName };
  }
  const streetPatterns = [
    /\bst(reet)?\b/i,
    /\bstr\b/i,
    /^[ew]\s*\d+/i,
    /^\d+(st|nd|rd|th)/i
  ];
  if (streetPatterns.some((rx) => rx.test(streetName))) {
    return { type: "street", name: streetName };
  }
  if (/\b(place|row|pl)\b/i.test(streetName)) {
    return { type: "street", name: streetName };
  }
  return { type: "unknown", name: streetName };
}
function perpendicularOffset(baseLat, baseLng, pointLat, pointLng, streetType) {
  const dLatM = (pointLat - baseLat) * METERS_PER_DEG_LAT;
  const dLngM = (pointLng - baseLng) * METERS_PER_DEG_LNG;
  const cosA = Math.cos(MANHATTAN_GRID_ANGLE_RAD);
  const sinA = Math.sin(MANHATTAN_GRID_ANGLE_RAD);
  const gridX = dLngM * cosA + dLatM * sinA;
  const gridY = -dLngM * sinA + dLatM * cosA;
  switch (streetType) {
    case "avenue":
      return gridX;
    case "street":
      return gridY;
    case "diagonal":
      return (gridX - gridY) / Math.SQRT2;
    case "boulevard":
      return gridX;
    default:
      return Math.abs(gridX) > Math.abs(gridY) ? gridX : gridY;
  }
}
function addressSideFromNumber(address, streetType) {
  const match = address.match(/^(\d+)/);
  if (!match) return "A";
  const buildingNum = parseInt(match[1], 10);
  const isOdd = buildingNum % 2 === 1;
  if (streetType === "street") {
    return isOdd ? "A" : "B";
  }
  return isOdd ? "B" : "A";
}
function getSideLabels(streetType) {
  switch (streetType) {
    case "avenue":
      return { a: "East side", b: "West side" };
    case "street":
      return { a: "Uptown side (north)", b: "Downtown side (south)" };
    case "diagonal":
      return { a: "East side", b: "West side" };
    case "boulevard":
      return { a: "East side", b: "West side" };
    default:
      return { a: "Side A", b: "Side B" };
  }
}
function detectHostilityFactors(lat, lng) {
  const factors = [];
  for (const zone of HOSTILITY_ZONES) {
    const dist = haversineMeters(lat, lng, zone.lat, zone.lng);
    if (dist > zone.radiusM) continue;
    const bearing = bearingDeg(lat, lng, zone.lat, zone.lng);
    const [bMin, bMax] = zone.bearingRange;
    let inRange = false;
    if (bMin < bMax) {
      inRange = bearing >= bMin && bearing <= bMax;
    } else {
      inRange = bearing >= bMin || bearing <= bMax;
    }
    const proximityFactor = 1 - dist / zone.radiusM;
    const penalty = Math.round(zone.penalty * proximityFactor * (inRange ? 1 : 0.4));
    if (Math.abs(penalty) >= 2) {
      factors.push({
        type: zone.type,
        name: zone.name,
        distance: Math.round(dist),
        bearing: Math.round(bearing),
        penalty
      });
    }
  }
  return factors;
}
async function computeStreetSideIntel(lat, lng, address, existingPOIs = []) {
  const { type: streetType, name: streetName } = classifyStreetType(address);
  const labels = getSideLabels(streetType);
  const addressSide = addressSideFromNumber(address, streetType);
  const [subwayEntrances, busStops] = await Promise.all([
    fetchSubwayEntrances(lat, lng),
    fetchBusStops(lat, lng)
  ]);
  const allPoints = [
    ...subwayEntrances,
    ...busStops,
    ...existingPOIs.map((p) => ({
      ...p,
      distance: p.distance || haversineMeters(lat, lng, p.lat, p.lng)
    }))
  ].filter((p) => p.distance <= SEARCH_RADIUS_M);
  const sideA = { subwayEntrances: 0, busStops: 0, activePOIs: 0, totalSignals: 0 };
  const sideB = { subwayEntrances: 0, busStops: 0, activePOIs: 0, totalSignals: 0 };
  for (const point of allPoints) {
    const offset = perpendicularOffset(lat, lng, point.lat, point.lng, streetType);
    if (Math.abs(offset) < SIDE_THRESHOLD_METERS) continue;
    const side = offset > 0 ? sideA : sideB;
    const distanceWeight = Math.max(0.2, 1 - point.distance / SEARCH_RADIUS_M);
    switch (point.type) {
      case "subway_entrance":
        side.subwayEntrances += distanceWeight;
        side.totalSignals += distanceWeight * 3;
        break;
      case "bus_stop":
        side.busStops += distanceWeight;
        side.totalSignals += distanceWeight * 1.5;
        break;
      case "poi":
        side.activePOIs += distanceWeight;
        side.totalSignals += distanceWeight * 1;
        break;
    }
  }
  sideA.subwayEntrances = Math.round(sideA.subwayEntrances * 10) / 10;
  sideA.busStops = Math.round(sideA.busStops * 10) / 10;
  sideA.activePOIs = Math.round(sideA.activePOIs * 10) / 10;
  sideA.totalSignals = Math.round(sideA.totalSignals * 10) / 10;
  sideB.subwayEntrances = Math.round(sideB.subwayEntrances * 10) / 10;
  sideB.busStops = Math.round(sideB.busStops * 10) / 10;
  sideB.activePOIs = Math.round(sideB.activePOIs * 10) / 10;
  sideB.totalSignals = Math.round(sideB.totalSignals * 10) / 10;
  const totalSignals = sideA.totalSignals + sideB.totalSignals;
  let sameScore;
  let oppositeScore;
  if (totalSignals === 0) {
    sameScore = 50;
    oppositeScore = 50;
  } else {
    const sameSide = addressSide === "A" ? sideA : sideB;
    const oppSide = addressSide === "A" ? sideB : sideA;
    const sameRatio = sameSide.totalSignals / totalSignals;
    const oppRatio = oppSide.totalSignals / totalSignals;
    sameScore = Math.round(ratioToScore(sameRatio));
    oppositeScore = Math.round(ratioToScore(oppRatio));
  }
  const asymmetry = totalSignals > 0 ? Math.round((sameScore - oppositeScore) / 100 * 100) / 100 : 0;
  const hostilityFactors = detectHostilityFactors(lat, lng);
  const hostilityPenalty = hostilityFactors.reduce((sum, f) => sum + f.penalty, 0);
  const streetSideScore = Math.max(0, Math.min(
    100,
    sameScore + hostilityPenalty
  ));
  return {
    address,
    streetName,
    streetType,
    addressSide,
    sideALabel: labels.a,
    sideBLabel: labels.b,
    sideA,
    sideB,
    hostilityFactors,
    hostilityPenalty,
    sameScore,
    oppositeScore,
    asymmetry,
    streetSideScore
  };
}
function bearingDeg(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1R = lat1 * Math.PI / 180;
  const lat2R = lat2 * Math.PI / 180;
  const x = Math.sin(dLng) * Math.cos(lat2R);
  const y = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}
function ratioToScore(ratio) {
  if (ratio <= 0) return 15;
  if (ratio >= 1) return 95;
  const x = (ratio - 0.5) * 5;
  const sigmoid = 1 / (1 + Math.exp(-x));
  return 15 + sigmoid * 80;
}
export {
  computeStreetSideIntel as a,
  classifyStreetType as c,
  extractPOIsFromIntel as e
};
