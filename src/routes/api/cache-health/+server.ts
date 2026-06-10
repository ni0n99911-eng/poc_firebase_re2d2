/**
 * Cache Health Check API
 *
 * GET /api/cache-health
 *
 * Returns diagnostic info about the two-tier intel cache:
 * - L1 (in-memory) stats
 * - L2 (Database) connectivity, table existence, availability, row counts
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
			: 'Run the Drizzle migrations to ensure intel_cache table exists'
	});
};

function getDiagnosis(l2: { available: boolean; tableExists: boolean; rpcExists: boolean; rowCount: number; error: string | null }): string {
	if (!l2.available) return 'Database client not available — check database connection string';
	if (!l2.tableExists) return 'intel_cache table does not exist — migration has not been applied';
	if (!l2.rpcExists) return 'Database client is available';
	if (l2.rowCount === 0) return 'Cache is empty — L2 writes may have started but no data yet. Run a location search to populate.';
	return `Cache is working. ${l2.rowCount} entries stored.`;
}
