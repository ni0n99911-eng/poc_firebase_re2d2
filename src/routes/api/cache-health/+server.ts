/**
 * Cache Health Check API
 *
 * GET /api/cache-health
 *
 * Returns diagnostic info about the two-tier intel cache:
 * - L1 (in-memory) stats
 * - L2 (Supabase) connectivity, table existence, RPC availability, row counts
 *
 * Use this to diagnose why API timeouts aren't falling back to cached data.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { intelCache } from '$lib/intel/cache';

export const GET: RequestHandler = async () => {
	const health = await intelCache.health();

	return json({
		status: health.l2.tableExists && health.l2.rpcExists ? 'healthy' : 'degraded',
		...health,
		diagnosis: getDiagnosis(health.l2),
		fix: health.l2.tableExists && health.l2.rpcExists
			? null
			: 'Run the SQL in supabase/004-intel-cache.sql against your Supabase project (SQL Editor → paste → Run)'
	});
};

function getDiagnosis(l2: { available: boolean; tableExists: boolean; rpcExists: boolean; rowCount: number; error: string | null }): string {
	if (!l2.available) return 'Supabase client not available — check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars';
	if (!l2.tableExists) return 'intel_cache table does not exist — migration 004 has not been applied';
	if (!l2.rpcExists) return 'upsert_intel_cache function does not exist — migration 004 was partially applied';
	if (l2.rowCount === 0) return 'Cache is empty — L2 writes may have started but no data yet. Run a location search to populate.';
	return `Cache is working. ${l2.rowCount} entries stored.`;
}
