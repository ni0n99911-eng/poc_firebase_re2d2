const EARTH_RADIUS_METERS = 6371e3;
function haversineMeters(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function haversineKm(lat1, lon1, lat2, lon2) {
  return haversineMeters(lat1, lon1, lat2, lon2) / 1e3;
}
function clamp(v, min = 0, max = 100) {
  if (isNaN(v)) return Math.round((min + max) / 2);
  return Math.max(min, Math.min(max, v));
}
function scoreLinear(value, low, high, invert = false) {
  if (high === low) return 50;
  const normalized = Math.max(0, Math.min(1, (value - low) / (high - low)));
  const score = Math.round((invert ? 1 - normalized : normalized) * 100);
  return clamp(score, 0, 100);
}
export {
  haversineKm as a,
  clamp as c,
  haversineMeters as h,
  scoreLinear as s
};
