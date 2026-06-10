const BOROUGH_BOUNDS = [
  {
    name: "Manhattan",
    lat: [40.7, 40.882],
    // Canonical: USGS upper bound (40.882)
    lng: [-74.047, -73.907],
    // Canonical: captures Battery Park City (-74.047)
    transitFloor: 72,
    // Dense subway grid; floor calibrated against 6,500 block group distributions
    qualityFloor: 55,
    // High commercial density → more 311 activity (lower score = more complaints)
    safetyFloor: 43
    // NYC-wide baseline; 300m radius, post-2023 NYPD data
  },
  {
    name: "Bronx",
    lat: [40.785, 40.917],
    lng: [-73.934, -73.748],
    transitFloor: 55,
    // Good subway coverage (2/5/6/D lines) but less dense than Manhattan
    qualityFloor: 52,
    safetyFloor: 29
    // Structurally higher crime density; floor reflects actual baseline
  },
  {
    name: "Brooklyn",
    lat: [40.57, 40.74],
    lng: [-74.042, -73.833],
    transitFloor: 52,
    // Subway coverage strong in north, thin in south/east
    qualityFloor: 60,
    safetyFloor: 47
  },
  {
    name: "Queens",
    lat: [40.541, 40.8],
    lng: [-73.962, -73.7],
    transitFloor: 50,
    // Most transit-variable borough; outer Queens is very thin
    qualityFloor: 63,
    safetyFloor: 53
  },
  {
    name: "Staten Island",
    lat: [40.477, 40.651],
    lng: [-74.259, -74.034],
    transitFloor: 30,
    // Largely auto-dependent; SIR + ferry, no subway
    qualityFloor: 68,
    safetyFloor: 57
  }
];
const DEFAULT_BOROUGH_FLOORS = {
  transitFloor: 30,
  qualityFloor: 50,
  safetyFloor: 35
};
function detectBorough(lat, lng) {
  for (const boro of BOROUGH_BOUNDS) {
    if (lat >= boro.lat[0] && lat <= boro.lat[1] && lng >= boro.lng[0] && lng <= boro.lng[1]) {
      return boro;
    }
  }
  return null;
}
function getBoroughTransitFloor(lat, lng) {
  return detectBorough(lat, lng)?.transitFloor ?? DEFAULT_BOROUGH_FLOORS.transitFloor;
}
function getBoroughQualityFloor(lat, lng) {
  return detectBorough(lat, lng)?.qualityFloor ?? DEFAULT_BOROUGH_FLOORS.qualityFloor;
}
function getBoroughSafetyFloor(lat, lng) {
  return detectBorough(lat, lng)?.safetyFloor ?? DEFAULT_BOROUGH_FLOORS.safetyFloor;
}
export {
  getBoroughSafetyFloor as a,
  getBoroughQualityFloor as b,
  detectBorough as d,
  getBoroughTransitFloor as g
};
