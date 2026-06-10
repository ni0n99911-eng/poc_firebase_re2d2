import { json } from "@sveltejs/kit";
import { i as intelCache } from "../../../../chunks/cache.js";
const GET = async () => {
  const health = await intelCache.health();
  return json({
    status: health.l2.tableExists && health.l2.rpcExists ? "healthy" : "degraded",
    ...health,
    diagnosis: getDiagnosis(health.l2),
    fix: health.l2.tableExists && health.l2.rpcExists ? null : "Run the Drizzle migrations to ensure intel_cache table exists"
  });
};
function getDiagnosis(l2) {
  if (!l2.available) return "Database client not available — check database connection string";
  if (!l2.tableExists) return "intel_cache table does not exist — migration has not been applied";
  if (!l2.rpcExists) return "Database client is available";
  if (l2.rowCount === 0) return "Cache is empty — L2 writes may have started but no data yet. Run a location search to populate.";
  return `Cache is working. ${l2.rowCount} entries stored.`;
}
export {
  GET
};
