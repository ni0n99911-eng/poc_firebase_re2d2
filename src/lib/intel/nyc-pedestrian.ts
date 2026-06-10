/**
 * NYC DOT Pedestrian Counts client.
 *
 * Fetches pedestrian count data from NYC Open Data (Socrata API).
 * Free, no API key required.
 * Dataset: https://data.cityofnewyork.us/Transportation/Bi-Annual-Pedestrian-Counts/7ym2-wayt
 *
 * Provides:
 * - Pedestrian volume near a location
 * - Real AM vs PM pedestrian patterns (from actual hourly data)
 * - Foot traffic score for location intelligence
 *
 * The dataset has 15-minute interval counts with hour (hh) and minute (mm) fields,
 * so we compute actual AM/PM splits instead of using a hardcoded ratio.
 */

import { IntelCache, intelCache, TTL } from './cache';
import { detectBorough } from '$lib/constants/borough-bounds';

export interface PedestrianCount {
	location: string;
	fromStreet: string;
	toStreet: string;
	amCount: number;        // real sum of counts where hh < 12
	pmCount: number;        // real sum of counts where hh >= 12
	totalCount: number;
	date: string;
	borough: string;
	segmentId: string;
}

export interface PedestrianData {
	counts: PedestrianCount[];
	totalPedestrians: number;       // sum of all nearby counts
	avgAMCount: number;
	avgPMCount: number;
	peakRatio: number;              // PM/AM ratio (>1 = more PM traffic)
	footTrafficScore: number;       // 0-100 (higher = more foot traffic)
	countLocationCount: number;     // number of DOT count points nearby
	dataQuality: 'real-hourly' | 'aggregated';
	source: 'nyc-pedestrian';
	fetchedAt: string;
}

// NYC DOT Bi-Annual Pedestrian Counts
const PED_BASE = 'https://data.cityofnewyork.us/resource/7ym2-wayt.json';

/**
 * Fetch pedestrian count data near a location.
 * Uses actual hourly data to compute real AM/PM splits.
 */
export async function fetchPedestrianCounts(lat: number,
	lng: number,
	radiusMeters: number = 500, signal?: AbortSignal): Promise<PedestrianData | null> {
	const cacheKey = IntelCache.locationKey(lat, lng, 'pedestrian');
	const cached = await intelCache.getAsync<PedestrianData>(cacheKey);
	if (cached?.fresh) return cached.data;

	try {
		// Pedestrian dataset uses wktgeom (State Plane WKT points).
		// Strategy: filter by borough + recent year, then aggregate by segment.
		// The dataset has: street, fromst, tost, hh, mm, vol, boro, yr, segmentid, wktgeom

		const boro = approximateBorough(lat, lng);

		// Fetch with hourly granularity so we can compute real AM/PM
		// Get the most recent data available (2022+)
		const url = `${PED_BASE}?$where=boro='${boro}' AND yr > '2022'` +
			`&$select=street,fromst,tost,hh,vol,boro,yr,m,d,segmentid` +
			`&$order=yr DESC,m DESC,d DESC` +
			`&$limit=2000`;

		const { socrataFetch } = await import('./socrata-fetch');
		const raw = await socrataFetch<Array<Record<string, string>>>(url, 'Pedestrian');
		if (!raw || !Array.isArray(raw)) return cached?.data || null;

		// Group by segment location, accumulate AM/PM from actual hour field
		const segmentMap = new Map<string, {
			street: string;
			fromst: string;
			tost: string;
			segmentId: string;
			boro: string;
			date: string;
			amTotal: number;
			pmTotal: number;
			total: number;
			recordCount: number;
		}>();

		for (const r of raw) {
			const segKey = r.segmentid || `${r.street || ''}-${r.fromst || ''}-${r.tost || ''}`;
			const vol = parseInt(r.vol) || 0;
			const hour = parseInt(r.hh) || 0;
			const isAM = hour < 12;

			if (!segmentMap.has(segKey)) {
				segmentMap.set(segKey, {
					street: r.street || 'Unknown',
					fromst: r.fromst || '',
					tost: r.tost || '',
					segmentId: r.segmentid || segKey,
					boro: r.boro || '',
					date: `${r.yr || ''}-${r.m || ''}-${r.d || ''}`,
					amTotal: 0,
					pmTotal: 0,
					total: 0,
					recordCount: 0
				});
			}

			const seg = segmentMap.get(segKey)!;
			seg.total += vol;
			seg.recordCount++;
			if (isAM) {
				seg.amTotal += vol;
			} else {
				seg.pmTotal += vol;
			}
		}

		// Convert to PedestrianCount entries
		// Each segment gets its AM/PM from actual hourly aggregation
		const counts: PedestrianCount[] = [];

		for (const [, seg] of segmentMap) {
			// Normalize to daily estimates:
			// DOT data has 15-min intervals, so the raw counts per segment span
			// some number of hours of observation. We keep the raw totals as
			// a relative measure — higher counts = more foot traffic.
			counts.push({
				location: seg.street,
				fromStreet: seg.fromst,
				toStreet: seg.tost,
				amCount: seg.amTotal,
				pmCount: seg.pmTotal,
				totalCount: seg.total,
				date: seg.date,
				borough: seg.boro,
				segmentId: seg.segmentId
			});
		}

		counts.sort((a, b) => b.totalCount - a.totalCount);

		// Compute aggregates from real data
		const totalPedestrians = counts.reduce((sum, c) => sum + c.totalCount, 0);
		const totalAM = counts.reduce((sum, c) => sum + c.amCount, 0);
		const totalPM = counts.reduce((sum, c) => sum + c.pmCount, 0);
		const avgAM = counts.length > 0 ? Math.round(totalAM / counts.length) : 0;
		const avgPM = counts.length > 0 ? Math.round(totalPM / counts.length) : 0;
		const peakRatio = totalAM > 0 ? Math.round((totalPM / totalAM) * 100) / 100 : 1;

		const footTrafficScore = computeFootTrafficScore(totalPedestrians, counts.length);

		const result: PedestrianData = {
			counts: counts.slice(0, 20), // keep top 20 segments
			totalPedestrians,
			avgAMCount: avgAM,
			avgPMCount: avgPM,
			peakRatio,
			footTrafficScore,
			countLocationCount: counts.length,
			dataQuality: 'real-hourly',
			source: 'nyc-pedestrian',
			fetchedAt: new Date().toISOString()
		};

		intelCache.set(cacheKey, result, TTL.PEDESTRIAN);
		return result;
	} catch (e) {
		console.error('[Pedestrian] Fetch error:', e);
		return cached?.data || null;
	}
}

/**
 * Approximate NYC borough from lat/lng.
 * Delegates to canonical BOROUGH_BOUNDS in borough-bounds.ts (C-10).
 * Previously used inline coordinates that diverged from the canonical values.
 */
function approximateBorough(lat: number, lng: number): string {
	return detectBorough(lat, lng)?.name ?? 'Manhattan';
}

/**
 * Compute foot traffic score (0-100, higher = more foot traffic).
 * Calibrated against actual DOT pedestrian count ranges.
 */
function computeFootTrafficScore(totalPedestrians: number, locationCount: number): number {
	if (locationCount === 0) return 15; // no data points nearby

	const avgPerLocation = totalPedestrians / locationCount;

	let score: number;
	if (avgPerLocation >= 5000) score = 85 + Math.min(15, Math.round((avgPerLocation - 5000) / 5000 * 15));
	else if (avgPerLocation >= 1000) score = 60 + Math.round((avgPerLocation - 1000) / 4000 * 25);
	else if (avgPerLocation >= 200) score = 35 + Math.round((avgPerLocation - 200) / 800 * 25);
	else score = 15 + Math.round(avgPerLocation / 200 * 20);

	// Bonus for multiple count locations (confirms area-wide traffic)
	if (locationCount >= 3) score += 5;
	else if (locationCount >= 2) score += 3;

	return Math.max(0, Math.min(100, score));
}
