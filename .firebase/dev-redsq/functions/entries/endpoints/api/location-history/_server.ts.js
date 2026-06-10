import { json } from "@sveltejs/kit";
import { r as requireAuth } from "../../../../chunks/auth-middleware.js";
import { fetchLocationHistory } from "../../../../chunks/location-history.js";
import { r as rateLimit, R as RATE_LIMITS } from "../../../../chunks/rate-limit.js";
const GET = async ({ url, request }) => {
  const limited = rateLimit(request, RATE_LIMITS.intel);
  if (limited) return limited;
  const auth = await requireAuth(request);
  if ("response" in auth) return auth.response;
  const address = url.searchParams.get("address") || "";
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  if (!address || isNaN(lat) || isNaN(lng)) {
    return json({ error: "address, lat, and lng are required" }, { status: 400 });
  }
  const history = await fetchLocationHistory(address);
  if (!history) {
    return json({ businesses: [], totalCount: 0, source: "location-history" });
  }
  return json(history);
};
export {
  GET
};
