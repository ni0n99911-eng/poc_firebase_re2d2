/**
 * F-21: block_group_intel automated re-seed schedule.
 * Different data sources have different refresh cadences.
 * This config drives the scheduled re-seed job.
 */

export const RESEED_SCHEDULE: Record<string, { ttlDays: number; source: string; priority: 'high' | 'medium' | 'low' }> = {
	census: { ttlDays: 365, source: 'ACS 5-Year', priority: 'low' },
	census_housing: { ttlDays: 365, source: 'ACS 5-Year', priority: 'low' },
	walkscore: { ttlDays: 90, source: 'WalkScore API', priority: 'medium' },
	google_places: { ttlDays: 30, source: 'Google Places API', priority: 'high' },
	yelp: { ttlDays: 30, source: 'Yelp Fusion API', priority: 'high' },
	'311_complaints': { ttlDays: 7, source: 'NYC 311 Socrata', priority: 'high' },
	dohmh_inspections: { ttlDays: 14, source: 'DOHMH Socrata', priority: 'high' },
	mta_ridership: { ttlDays: 90, source: 'MTA Open Data', priority: 'medium' },
	dob_permits: { ttlDays: 30, source: 'DOB Socrata', priority: 'medium' },
	pluto: { ttlDays: 180, source: 'MapPLUTO', priority: 'low' },
};

export function getStaleSourcesForGeoid(intel: Record<string, any>): string[] {
	const stale: string[] = [];
	for (const [key, config] of Object.entries(RESEED_SCHEDULE)) {
		const data = intel[key];
		if (!data) {
			stale.push(key);
			continue;
		}
		const fetchedAt = data.fetchedAt || data.fetched_at;
		if (!fetchedAt) {
			stale.push(key);
			continue;
		}
		const age = Date.now() - new Date(fetchedAt).getTime();
		if (age > config.ttlDays * 24 * 3600 * 1000) stale.push(key);
	}
	return stale;
}
