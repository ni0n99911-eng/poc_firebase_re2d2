import { json } from "@sveltejs/kit";
import { f as fetchFoursquareData, a as fetchNearbyPlaces } from "../../../../chunks/foursquare.js";
const GET = async ({ url }) => {
  const latStr = url.searchParams.get("lat");
  const lngStr = url.searchParams.get("lng");
  const radiusStr = url.searchParams.get("radius") || "600";
  if (!latStr || !lngStr) {
    return json({ error: "lat and lng are required" }, { status: 400 });
  }
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  const radius = Math.min(parseInt(radiusStr, 10) || 600, 1500);
  if (isNaN(lat) || isNaN(lng)) {
    return json({ error: "invalid lat/lng" }, { status: 400 });
  }
  try {
    const data = await fetchFoursquareData(lat, lng, "food_and_drink", radius);
    if (data) {
      const businesses = data.venues.filter((v) => v.lat != null && v.lng != null).map((v) => ({
        name: v.name,
        lat: v.lat,
        lng: v.lng,
        dist: v.distance,
        category: v.primaryCategory || "",
        popularity: v.popularity ?? 0,
        isChain: v.isChain,
        rating: v.rating
      }));
      console.log(`[nearby-businesses] Foursquare returned ${businesses.length} venues`);
      return json({ businesses, source: "foursquare", total: businesses.length });
    }
    console.warn("[nearby-businesses] Foursquare unavailable, trying Google Places / Overpass fallback");
    const placesData = await fetchNearbyPlaces(lat, lng, "food_and_drink", radius);
    if (placesData && placesData.places.length > 0) {
      const businesses = placesData.places.filter((p) => p.lat != null && p.lng != null).map((p) => ({
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        dist: p.distance,
        // Google Places types use underscore format e.g. 'coffee_shop' — join with space for keyword matching
        category: (p.types[0] || "").replace(/_/g, " "),
        // Normalize Google rating (1–5) to 0–1 popularity scale; 0 rating = unrated, default to 0.3 (Surviving)
        popularity: p.rating > 0 ? Math.min(p.rating / 5, 1) : 0.3,
        isChain: false,
        rating: p.rating || null
      }));
      console.log(`[nearby-businesses] ${placesData.source} returned ${businesses.length} venues`);
      return json({ businesses, source: placesData.source, total: businesses.length });
    }
    return json({ businesses: [], source: "none" });
  } catch (err) {
    console.error("[nearby-businesses] error:", err);
    return json({ businesses: [], source: "error", error: String(err) });
  }
};
export {
  GET
};
