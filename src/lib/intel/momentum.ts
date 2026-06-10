/**
 * Momentum Trend Analysis — v1 (no database required).
 *
 * Computes area trajectory by comparing recent vs prior 6-month windows
 * using Socrata date-filtered queries. No historical snapshot storage needed.
 *
 * Trend sources:
 *   - DOB permits: recent vs prior period new building + alteration permits
 *   - DCA licenses: recent vs prior period new business license rate
 *   - 311 complaints: recent vs prior period complaint volume (declining = improving)
 *
 * Each source produces a trend slope: positive (growing), flat (stable), negative (declining).
 * The composite Momentum Score combines these with configurable weights.
 *
 * v2 (requires database): MTA ridership time-series, rent trajectory, PLUTO assessment changes.
 */

import { IntelCache, intelCache, TTL } from './cache';

// ─────────────────────────────────────────────────
// Public interfaces
// ─────────────────────────────────────────────────

export interface MomentumData {
	dobTrend: TrendSignal;
	dcaTrend: TrendSignal;
	complaintsTrend: TrendSignal;
	compositeScore: number;        // 0-100 (50 = stable, >50 = growing, <50 = declining)
	direction: 'growing' | 'stable' | 'declining';
	trendSignals: string[];        // Human-readable trend descriptions
	source: 'momentum-v1';
	fetchedAt: string;
}

export interface TrendSignal {
	recentCount: number;
	priorCount: number;
	changePercent: number;         // positive = increasing, negative = decreasing
	slope: 'up' | 'flat' | 'down';
	label: string;
}

// ─────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────

function getDateWindows(): { recentStart: string; recentEnd: string; priorStart: string; priorEnd: string } {
	const now = new Date();
	const sixMonthsAgo = new Date(now);
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
	const twelveMonthsAgo = new Date(now);
	twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

	return {
		recentStart: sixMonthsAgo.toISOString().split('T')[0],
		recentEnd: now.toISOString().split('T')[0],
		priorStart: twelveMonthsAgo.toISOString().split('T')[0],
		priorEnd: sixMonthsAgo.toISOString().split('T')[0]
	};
}

function computeSlope(recent: number, prior: number): { changePercent: number; slope: 'up' | 'flat' | 'down' } {
	if (prior === 0 && recent === 0) return { changePercent: 0, slope: 'flat' };
	if (prior === 0) return { changePercent: 100, slope: 'up' };
	const changePct = Math.round(((recent - prior) / prior) * 100);
	// ±10% is "flat" — noise threshold
	if (changePct > 10) return { changePercent: changePct, slope: 'up' };
	if (changePct < -10) return { changePercent: changePct, slope: 'down' };
	return { changePercent: changePct, slope: 'flat' };
}

// ─────────────────────────────────────────────────
// Socrata date-range queries
// ─────────────────────────────────────────────────

const DOB_PERMITS_BASE = 'https://data.cityofnewyork.us/resource/ipu4-2q9a.json';
const DCA_BASE = 'https://data.cityofnewyork.us/resource/w7w3-xahh.json';
const NYC311_BASE = 'https://data.cityofnewyork.us/resource/erm2-nwe9.json';

async function fetchSocrataCount(
	baseUrl: string,
	lat: number,
	lng: number,
	radiusMeters: number,
	dateColumn: string,
	startDate: string,
	endDate: string,
	geoColumn: string = 'location',
	extraWhere: string = ''
): Promise<number> {
	const where = [
		`within_circle(${geoColumn},${lat},${lng},${radiusMeters})`,
		`${dateColumn}>='${startDate}'`,
		`${dateColumn}<'${endDate}'`,
		extraWhere
	].filter(Boolean).join(' AND ');

	const url = `${baseUrl}?$select=count(*) as cnt&$where=${encodeURIComponent(where)}`;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 10000);

	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				'Accept': 'application/json'
			}
		});
		clearTimeout(timer);

		if (!res.ok) return 0;
		const data = await res.json();
		return parseInt(String(data?.[0]?.cnt || '0'), 10);
	} catch {
		clearTimeout(timer);
		return 0;
	}
}

// ─────────────────────────────────────────────────
// Main computation
// ─────────────────────────────────────────────────

/**
 * Compute momentum trends by comparing recent vs prior 6-month periods.
 * Uses 6 parallel Socrata queries (2 per source × 3 sources).
 */
export async function fetchMomentumData(lat: number,
	lng: number,
	radiusMeters: number = 500, signal?: AbortSignal): Promise<MomentumData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'momentum');
	const cached = await intelCache.getAsync<MomentumData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		const { recentStart, recentEnd, priorStart, priorEnd } = getDateWindows();

		// Run 6 queries in parallel: recent + prior for each source
		const [
			dobRecent, dobPrior,
			dcaRecent, dcaPrior,
			complaintsRecent, complaintsPrior
		] = await Promise.allSettled([
			// DOB: new building + alteration permits
			fetchSocrataCount(DOB_PERMITS_BASE, lat, lng, radiusMeters,
				'filing_date', recentStart, recentEnd, 'gis_latitude'),
			fetchSocrataCount(DOB_PERMITS_BASE, lat, lng, radiusMeters,
				'filing_date', priorStart, priorEnd, 'gis_latitude'),

			// DCA: new business licenses
			fetchSocrataCount(DCA_BASE, lat, lng, radiusMeters,
				'license_creation_date', recentStart, recentEnd, 'location'),
			fetchSocrataCount(DCA_BASE, lat, lng, radiusMeters,
				'license_creation_date', priorStart, priorEnd, 'location'),

			// 311: complaints (declining = improving area)
			fetchSocrataCount(NYC311_BASE, lat, lng, radiusMeters,
				'created_date', recentStart, recentEnd, 'location'),
			fetchSocrataCount(NYC311_BASE, lat, lng, radiusMeters,
				'created_date', priorStart, priorEnd, 'location'),
		]);

		const extract = (r: PromiseSettledResult<number>) =>
			r.status === 'fulfilled' ? r.value : 0;

		const dobRecentN = extract(dobRecent);
		const dobPriorN = extract(dobPrior);
		const dcaRecentN = extract(dcaRecent);
		const dcaPriorN = extract(dcaPrior);
		const complaintsRecentN = extract(complaintsRecent);
		const complaintsPriorN = extract(complaintsPrior);

		// Compute trends
		const dobSlope = computeSlope(dobRecentN, dobPriorN);
		const dcaSlope = computeSlope(dcaRecentN, dcaPriorN);
		// For complaints: DECLINING is positive (area improving)
		const rawComplaintsSlope = computeSlope(complaintsRecentN, complaintsPriorN);
		const complaintsSlope = {
			changePercent: -rawComplaintsSlope.changePercent, // Invert: fewer complaints = positive
			slope: rawComplaintsSlope.slope === 'up' ? 'down' as const :
				rawComplaintsSlope.slope === 'down' ? 'up' as const : 'flat' as const
		};

		const dobTrend: TrendSignal = {
			recentCount: dobRecentN,
			priorCount: dobPriorN,
			changePercent: dobSlope.changePercent,
			slope: dobSlope.slope,
			label: 'Building Permits'
		};

		const dcaTrend: TrendSignal = {
			recentCount: dcaRecentN,
			priorCount: dcaPriorN,
			changePercent: dcaSlope.changePercent,
			slope: dcaSlope.slope,
			label: 'New Businesses'
		};

		const complaintsTrend: TrendSignal = {
			recentCount: complaintsRecentN,
			priorCount: complaintsPriorN,
			changePercent: complaintsSlope.changePercent,
			slope: complaintsSlope.slope,
			label: 'Quality of Life'
		};

		// Composite: convert slopes to scores
		// up = 70, flat = 50, down = 30
		const slopeScore = (s: 'up' | 'flat' | 'down') =>
			s === 'up' ? 70 : s === 'flat' ? 50 : 30;

		// Weights: DOB permits (40%) + DCA licenses (35%) + 311 quality (25%)
		const compositeScore = Math.round(
			slopeScore(dobTrend.slope) * 0.40 +
			slopeScore(dcaTrend.slope) * 0.35 +
			slopeScore(complaintsTrend.slope) * 0.25
		);

		// Direction
		let direction: MomentumData['direction'];
		if (compositeScore > 58) direction = 'growing';
		else if (compositeScore < 42) direction = 'declining';
		else direction = 'stable';

		// Human-readable signals
		const trendSignals: string[] = [];
		if (dobTrend.slope === 'up') {
			trendSignals.push(`Building permits up ${dobTrend.changePercent}% (${dobPriorN} → ${dobRecentN}) — active development`);
		} else if (dobTrend.slope === 'down') {
			trendSignals.push(`Building permits down ${Math.abs(dobTrend.changePercent)}% — development slowing`);
		}
		if (dcaTrend.slope === 'up') {
			trendSignals.push(`New business licenses up ${dcaTrend.changePercent}% (${dcaPriorN} → ${dcaRecentN}) — commercial momentum`);
		} else if (dcaTrend.slope === 'down') {
			trendSignals.push(`New business licenses down ${Math.abs(dcaTrend.changePercent)}% — commercial activity slowing`);
		}
		if (complaintsTrend.slope === 'up') {
			trendSignals.push(`311 complaints declining ${Math.abs(rawComplaintsSlope.changePercent)}% — neighborhood quality improving`);
		} else if (complaintsTrend.slope === 'down') {
			trendSignals.push(`311 complaints up ${rawComplaintsSlope.changePercent}% — quality of life pressure increasing`);
		}

		const result: MomentumData = {
			dobTrend,
			dcaTrend,
			complaintsTrend,
			compositeScore,
			direction,
			trendSignals,
			source: 'momentum-v1',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.LICENSES); // 3 day TTL
		return result;

	} catch (err) {
		console.error('[Momentum] Computation error:', err);
		return cached?.data || null;
	}
}
