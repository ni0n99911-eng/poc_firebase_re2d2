/**
 * F-20: enriched_entities TTL check.
 * DOHMH inspections update monthly. DCA licenses update weekly.
 * Stale-while-revalidate: serve cached, trigger background refresh if older than TTL.
 */

export const ENTITY_TTL_MS = 14 * 24 * 3600 * 1000; // 14 days

export function isEntityStale(fetchedAt: string | null): boolean {
	if (!fetchedAt) return true;
	return Date.now() - new Date(fetchedAt).getTime() > ENTITY_TTL_MS;
}

import { sql } from 'drizzle-orm';

export async function refreshEnrichedEntities(
	db: any,
	geoid: string,
	source: 'dohmh' | 'dca' = 'dohmh'
): Promise<void> {
	// Mark as needing refresh — actual refresh happens in the next scoring run
	// when the intel pipeline fetches fresh data from NYC Open Data.
	console.log(`[F-20] Marking ${source} entities stale for geoid=${geoid}`);
	await db.execute(sql`
		UPDATE enriched_entities 
		SET needs_refresh = true 
		WHERE location_key = ${geoid} AND entity_category = ${source}
	`);
}
