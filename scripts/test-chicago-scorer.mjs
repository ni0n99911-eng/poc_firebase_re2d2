#!/usr/bin/env node
/**
 * RE² Chicago Test Scorer
 *
 * Tests the V4 scoring logic against Chicago data to validate portability.
 * Uses only free, open data APIs — no keys required except Census (free key).
 *
 * Data sources:
 *   1. Census ACS (demographics, income, housing) — via api.census.gov
 *   2. Chicago 311 Service Requests — via data.cityofchicago.org (Socrata)
 *   3. Chicago Food Inspections (CDPH) — via data.cityofchicago.org
 *   4. CTA L Station Ridership — via data.cityofchicago.org
 *   5. Chicago Liquor Licenses — via data.cityofchicago.org
 *   6. FCC Census Geocoder — lat/lng → GEOID
 *
 * Usage:
 *   CENSUS_API_KEY=xxx node scripts/test-chicago-scorer.mjs [--push]
 *
 * Without --push: just prints scores to stdout.
 * With --push: stores results in a local JSON file for analysis.
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ───

const CENSUS_API_KEY = process.env.CENSUS_API_KEY || '';
const PUSH = process.argv.includes('--push');

// ─── 50 Test Locations Across Chicago ───
// Diverse neighborhoods covering different economic, demographic, and transit profiles.
// Format: [name, lat, lng, expectedProfile]

const TEST_LOCATIONS = [
	// === LOOP / DOWNTOWN (high density, high income, high transit) ===
	['Loop - State & Madison', 41.8819, -87.6278, 'premium_hub'],
	['Loop - Financial District', 41.8788, -87.6318, 'premium_hub'],
	['Millennium Park', 41.8826, -87.6226, 'premium_hub'],
	['River North', 41.8920, -87.6310, 'premium_hub'],
	['West Loop / Randolph', 41.8845, -87.6470, 'premium_hub'],

	// === NEAR NORTH / GOLD COAST (affluent, destination dining) ===
	['Gold Coast - Rush St', 41.9017, -87.6279, 'affluent_destination'],
	['Streeterville', 41.8920, -87.6180, 'affluent_destination'],
	['Old Town', 41.9100, -87.6350, 'affluent_destination'],
	['Lincoln Park - DePaul', 41.9220, -87.6490, 'affluent_destination'],
	['Lincoln Park - Armitage', 41.9180, -87.6360, 'affluent_destination'],

	// === NORTH SIDE (mixed, young professional) ===
	['Wicker Park', 41.9088, -87.6776, 'trendy_mixed'],
	['Bucktown', 41.9210, -87.6800, 'trendy_mixed'],
	['Logan Square', 41.9290, -87.6994, 'trendy_mixed'],
	['Lakeview - Wrigleyville', 41.9484, -87.6553, 'trendy_mixed'],
	['Andersonville', 41.9790, -87.6690, 'trendy_mixed'],
	['Uptown - Broadway', 41.9650, -87.6540, 'moderate_transit'],
	['Rogers Park', 42.0088, -87.6680, 'moderate_transit'],

	// === WEST SIDE (lower income, emerging, food deserts) ===
	['Humboldt Park', 41.9020, -87.7190, 'emerging_market'],
	['Garfield Park - East', 41.8810, -87.7190, 'emerging_market'],
	['Austin', 41.8900, -87.7620, 'emerging_market'],
	['Pilsen', 41.8560, -87.6650, 'emerging_market'],
	['Little Village', 41.8460, -87.7130, 'emerging_market'],
	['North Lawndale', 41.8600, -87.7190, 'emerging_market'],

	// === SOUTH SIDE (varied: Hyde Park affluent, others emerging) ===
	['Hyde Park - 53rd', 41.7990, -87.5870, 'institutional_anchor'],
	['Bronzeville', 41.8210, -87.6170, 'emerging_market'],
	['Bridgeport', 41.8370, -87.6490, 'moderate_residential'],
	['Woodlawn', 41.7790, -87.5950, 'emerging_market'],
	['South Shore', 41.7600, -87.5680, 'emerging_market'],
	['Chatham', 41.7400, -87.6120, 'moderate_residential'],
	['Englewood', 41.7790, -87.6440, 'underserved'],
	['Back of the Yards', 41.8120, -87.6620, 'emerging_market'],

	// === SOUTHWEST (working class, residential) ===
	['Brighton Park', 41.8190, -87.6920, 'moderate_residential'],
	['Gage Park', 41.7950, -87.6960, 'moderate_residential'],
	['Archer Heights', 41.8100, -87.7230, 'moderate_residential'],
	['Clearing', 41.7810, -87.7630, 'suburban_residential'],
	['Midway Area', 41.7868, -87.7522, 'transit_node'],

	// === FAR NORTH (mixed, some transit) ===
	['Edgewater', 41.9830, -87.6600, 'moderate_transit'],
	['Albany Park', 41.9680, -87.7230, 'moderate_residential'],
	['Irving Park', 41.9540, -87.7240, 'moderate_residential'],
	['Avondale', 41.9390, -87.7110, 'moderate_residential'],

	// === NORTHWEST (suburban feel, car-dependent) ===
	['Jefferson Park', 41.9700, -87.7600, 'suburban_residential'],
	['Portage Park', 41.9590, -87.7660, 'suburban_residential'],
	['Dunning', 41.9460, -87.7980, 'suburban_residential'],
	['Norwood Park', 41.9860, -87.8070, 'suburban_residential'],

	// === FAR SOUTH (low density, underserved) ===
	['Pullman', 41.6940, -87.6070, 'underserved'],
	['Roseland', 41.7010, -87.6260, 'underserved'],
	['Auburn Gresham', 41.7430, -87.6550, 'underserved'],
	['Beverly', 41.7170, -87.6720, 'moderate_residential'],
	['Mount Greenwood', 41.6970, -87.7050, 'suburban_residential'],

	// === SPECIAL: Near major transit hubs ===
	['Union Station area', 41.8787, -87.6402, 'premium_hub'],
];

// ─── Helpers ───

async function fetchJSON(url, retries = 2) {
	for (let i = 0; i <= retries; i++) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return await res.json();
		} catch (e) {
			if (i === retries) {
				console.warn(`  ⚠ Failed: ${url.substring(0, 80)}... — ${e.message}`);
				return null;
			}
			await new Promise(r => setTimeout(r, 1000 * (i + 1)));
		}
	}
}

function clamp(v, min = 0, max = 100) {
	return Math.max(min, Math.min(max, Math.round(v)));
}

function scoreLinear(v, lo, hi, inverse = false) {
	const n = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
	return clamp(Math.round((inverse ? 1 - n : n) * 100));
}

function grade(s) {
	if (s >= 93) return 'A+';
	if (s >= 87) return 'A';
	if (s >= 80) return 'A-';
	if (s >= 73) return 'B+';
	if (s >= 67) return 'B';
	if (s >= 60) return 'B-';
	if (s >= 53) return 'C+';
	if (s >= 47) return 'C';
	if (s >= 40) return 'C-';
	if (s >= 30) return 'D';
	return 'F';
}

// ─── Data Fetchers ───

// 1. FCC Census Geocoder → GEOID
async function getGeoid(lat, lng) {
	const url = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&censusYear=2020&format=json`;
	const data = await fetchJSON(url);
	if (!data?.Block?.FIPS) return null;
	return data.Block.FIPS.substring(0, 12); // 12-digit block group
}

// 2. Census ACS demographics
async function getCensusData(geoid) {
	if (!CENSUS_API_KEY) return null;
	const state = geoid.substring(0, 2);
	const county = geoid.substring(2, 5);
	const tract = geoid.substring(5, 11);
	const bg = geoid.substring(11, 12);

	// Key variables: median income, total pop, median age, bachelor's degree+
	const vars = 'B19013_001E,B01003_001E,B01002_001E,B15003_022E,B15003_023E,B15003_024E,B15003_025E,B25064_001E';

	// Try 2022 first, fall back to 2021 (some keys only work with certain years)
	for (const year of ['2022', '2021']) {
		const url = `https://api.census.gov/data/${year}/acs/acs5?get=${vars}&for=block%20group:${bg}&in=state:${state}+county:${county}+tract:${tract}&key=${CENSUS_API_KEY}`;
		const data = await fetchJSON(url);
		if (data && Array.isArray(data) && data.length >= 2) {
			return parseCensusRow(data[1]);
		}
	}

	// Last resort: try without key (Census allows limited keyless access)
	const noKeyUrl = `https://api.census.gov/data/2021/acs/acs5?get=${vars}&for=block%20group:${bg}&in=state:${state}+county:${county}+tract:${tract}`;
	const data = await fetchJSON(noKeyUrl);
	if (!data || !Array.isArray(data) || data.length < 2) return null;
	return parseCensusRow(data[1]);
}

function parseCensusRow(row) {
	return {
		median_household_income: parseInt(row[0]) || 0,
		total_population: parseInt(row[1]) || 0,
		median_age: parseFloat(row[2]) || 0,
		bachelors_degree: parseInt(row[3]) || 0,
		masters_degree: parseInt(row[4]) || 0,
		professional_degree: parseInt(row[5]) || 0,
		doctorate_degree: parseInt(row[6]) || 0,
		median_gross_rent: parseInt(row[7]) || 0,
	};
}

// 3. Chicago 311 within 500m (last 12 months)
async function getChicago311(lat, lng) {
	const radiusM = 500;
	const oneYearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().split('T')[0];
	const url = `https://data.cityofchicago.org/resource/v6vf-nfxy.json?$where=within_circle(location,${lat},${lng},${radiusM}) AND created_date>'${oneYearAgo}'&$select=sr_type,count(*)&$group=sr_type&$order=count DESC&$limit=50`;
	const data = await fetchJSON(url);
	if (!data || !Array.isArray(data)) return null;

	const types = {};
	let total = 0;
	for (const row of data) {
		const count = parseInt(row.count) || 0;
		types[row.sr_type] = count;
		total += count;
	}
	return { total, types };
}

// 4. Chicago food inspections within 500m
async function getFoodInspections(lat, lng) {
	const radiusM = 500;
	const url = `https://data.cityofchicago.org/resource/4ijn-s7e5.json?$where=within_circle(location,${lat},${lng},${radiusM})&$select=results,risk,count(*)&$group=results,risk&$limit=50`;
	const data = await fetchJSON(url);
	if (!data || !Array.isArray(data)) return null;

	let totalInspections = 0;
	let passCount = 0;
	let failCount = 0;
	let establishments = 0;
	for (const row of data) {
		const count = parseInt(row.count) || 0;
		totalInspections += count;
		if (row.results === 'Pass' || row.results === 'Pass w/ Conditions') passCount += count;
		if (row.results === 'Fail') failCount += count;
		establishments += count;
	}

	return {
		totalInspections,
		passRate: totalInspections > 0 ? Math.round(passCount / totalInspections * 100) : 0,
		failRate: totalInspections > 0 ? Math.round(failCount / totalInspections * 100) : 0,
		establishmentCount: establishments,
	};
}

// 5. Nearest CTA L station ridership (avg daily, last 90 days)
async function getCTARidership(lat, lng) {
	// First get stations near this point
	// CTA L stations dataset: 8pix-ypme
	const radiusM = 800;
	const url = `https://data.cityofchicago.org/resource/8pix-ypme.json?$where=within_circle(location,${lat},${lng},${radiusM})&$limit=10`;
	const stations = await fetchJSON(url);
	if (!stations || stations.length === 0) return { stationCount: 0, avgDailyRidership: 0 };

	// Get ridership for these stations (last 90 days weekday average)
	const stationIds = stations.map(s => s.map_id || s.station_id).filter(Boolean);
	if (stationIds.length === 0) return { stationCount: stations.length, avgDailyRidership: 0 };

	const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split('T')[0];
	const idFilter = stationIds.map(id => `station_id='${id}'`).join(' OR ');
	const riderUrl = `https://data.cityofchicago.org/resource/5neh-572f.json?$where=(${idFilter}) AND date>'${ninetyDaysAgo}' AND daytype='W'&$select=station_id,avg(rides)&$group=station_id`;
	const ridership = await fetchJSON(riderUrl);

	let totalAvg = 0;
	if (ridership && Array.isArray(ridership)) {
		for (const r of ridership) {
			totalAvg += parseFloat(r.avg_rides) || 0;
		}
	}

	return {
		stationCount: stations.length,
		stationNames: stations.map(s => s.station_name || s.stop_name).filter(Boolean),
		avgDailyRidership: Math.round(totalAvg),
	};
}

// 6. Chicago liquor licenses within 500m
async function getLiquorLicenses(lat, lng) {
	const radiusM = 500;
	const url = `https://data.cityofchicago.org/resource/nrmj-3kcf.json?$where=within_circle(location,${lat},${lng},${radiusM})&$select=license_description,count(*)&$group=license_description&$limit=20`;
	const data = await fetchJSON(url);
	if (!data || !Array.isArray(data)) return null;

	let total = 0;
	const types = {};
	for (const row of data) {
		const count = parseInt(row.count) || 0;
		types[row.license_description] = count;
		total += count;
	}
	return { total, types };
}

// ─── Scoring Engine (mirrors V4 logic, adapted for Chicago data) ───

function scoreLocation(census, cta, food, threeOneOne, liquor) {
	const scores = {};

	// === Demographics ===
	if (census) {
		const income = census.median_household_income;
		const pop = census.total_population;
		const eduPct = Math.round(
			(census.bachelors_degree + census.masters_degree + census.professional_degree + census.doctorate_degree)
			/ Math.max(census.total_population, 1) * 100
		);
		scores.demographics = clamp(
			scoreLinear(income, 30000, 120000) * 0.50 +
			scoreLinear(eduPct, 10, 60) * 0.25 +
			scoreLinear(pop, 500, 15000) * 0.25
		);
		scores.incomeRaw = income;
		scores.populationRaw = pop;
		scores.educationPct = eduPct;
	} else {
		scores.demographics = 50;
	}

	// === Transit / Accessibility ===
	if (cta) {
		const stationScore = scoreLinear(cta.stationCount, 0, 5);
		const riderScore = scoreLinear(cta.avgDailyRidership, 500, 30000);
		scores.transit = clamp(stationScore * 0.4 + riderScore * 0.6);
		scores.stationCount = cta.stationCount;
		scores.dailyRidership = cta.avgDailyRidership;
	} else {
		scores.transit = 30;
	}

	// === Competition (food establishments) ===
	// Chicago has denser commercial clusters than NYC block groups.
	// Moderate competition = proven demand. Extreme = saturation.
	// The sweet spot curve peaks around 10-20 establishments (not 5 like NYC).
	if (food) {
		const count = food.establishmentCount;
		if (count === 0) scores.competition = 30;       // dead zone — no demand signal
		else if (count <= 3) scores.competition = 50;    // thin market
		else if (count <= 10) scores.competition = 75;   // healthy — demand proven, room to compete
		else if (count <= 25) scores.competition = 85;   // vibrant commercial area — sweet spot
		else if (count <= 50) scores.competition = 70;   // dense but manageable
		else if (count <= 80) scores.competition = 55;   // getting saturated
		else scores.competition = Math.max(30, 55 - (count - 80) * 0.5);  // heavy saturation

		// Quality signal: high pass rate = quality market
		if (food.passRate > 85) scores.competition = clamp(scores.competition * 1.08);
		if (food.failRate > 20) scores.competition = clamp(scores.competition * 0.88);

		scores.foodEstablishments = count;
		scores.inspectionPassRate = food.passRate;
	} else {
		scores.competition = 50;
	}

	// === Vibrancy (311 as proxy — same logic as NYC borough bonus) ===
	if (threeOneOne) {
		// In NYC we use complaint subtypes as signals.
		// Chicago equivalents:
		// POSITIVE signals (indicate active commercial area):
		const positiveTypes = [
			'Restaurant Complaint',
			'Business Complaints',
			'Excessive Noise - Business',
			'Street Light Out Complaint',        // foot traffic proxy
			'Sidewalk Inspection Request',        // pedestrian activity
		];
		// NEGATIVE signals (indicate distress):
		const negativeTypes = [
			'Vacant/Abandoned Building Complaint',
			'Rodent Baiting/Rat Complaint',
			'Garbage Cart Complaint',
		];

		let positiveCount = 0;
		let negativeCount = 0;
		for (const [type, count] of Object.entries(threeOneOne.types)) {
			if (positiveTypes.some(p => type.includes(p.replace(' Complaint', '').replace(' Request', '')))) {
				positiveCount += count;
			}
			if (negativeTypes.some(n => type.includes(n.replace(' Complaint', '')))) {
				negativeCount += count;
			}
		}

		const activityScore = scoreLinear(threeOneOne.total, 50, 500);
		const sentimentRatio = (positiveCount + 1) / (negativeCount + 1);
		const sentimentScore = clamp(sentimentRatio * 30 + 30);
		scores.vibrancy = clamp(activityScore * 0.6 + sentimentScore * 0.4);
		scores.total311 = threeOneOne.total;
		scores.positive311 = positiveCount;
		scores.negative311 = negativeCount;
	} else {
		scores.vibrancy = 50;
	}

	// === Nightlife / Liquor ===
	if (liquor) {
		scores.nightlife = scoreLinear(liquor.total, 2, 40);
		scores.liquorLicenses = liquor.total;
	} else {
		scores.nightlife = 30;
	}

	// === Safety (infer from 311 violent/dangerous complaints) ===
	if (threeOneOne) {
		const safetyNeg = [
			'Abandoned Vehicle',
			'Vacant/Abandoned Building',
			'Gang Activity',
		];
		let dangerCount = 0;
		for (const [type, count] of Object.entries(threeOneOne.types)) {
			if (safetyNeg.some(s => type.includes(s))) dangerCount += count;
		}
		scores.safety = clamp(100 - scoreLinear(dangerCount, 0, 50) * 0.8);
	} else {
		scores.safety = 50;
	}

	// === Composite Location IQ ===
	// V4.1 weights: nightlife up (0.05→0.15), safety down (0.10→0.05), vibrancy down (0.28→0.23)
	// Based on Chicago calibration: nightlife ρ=0.807, safety ρ=0.024
	scores.locationIQ = clamp(
		scores.vibrancy * 0.23 +
		scores.demographics * 0.22 +
		scores.competition * 0.20 +
		scores.transit * 0.15 +
		scores.safety * 0.05 +
		scores.nightlife * 0.15
	);
	scores.grade = grade(scores.locationIQ);

	return scores;
}

// ─── Ground Truth: Business Outcomes ───
// Pull actual business outcomes within each block group to measure
// whether our scores predict real-world success.

async function getOutcomeData(lat, lng) {
	// Get ALL food inspections within 500m (not grouped) — we want establishment-level outcomes
	const radiusM = 500;
	const url = `https://data.cityofchicago.org/resource/4ijn-s7e5.json?$where=within_circle(location,${lat},${lng},${radiusM})&$select=dba_name,results,risk,inspection_date&$order=inspection_date DESC&$limit=200`;
	const data = await fetchJSON(url);
	if (!data || !Array.isArray(data) || data.length === 0) return null;

	// Group by establishment — latest inspection result per business
	const byBiz = {};
	for (const row of data) {
		const name = (row.dba_name || '').toUpperCase().trim();
		if (!name) continue;
		if (!byBiz[name]) byBiz[name] = row; // already sorted DESC, first = latest
	}

	const businesses = Object.values(byBiz);
	const passCount = businesses.filter(b => b.results === 'Pass' || b.results === 'Pass w/ Conditions').length;
	const failCount = businesses.filter(b => b.results === 'Fail').length;
	const total = businesses.length;
	const passRate = total > 0 ? passCount / total : 0;

	// Risk distribution — High Risk businesses in a high-pass area = thriving market
	const highRisk = businesses.filter(b => b.risk && b.risk.includes('1')).length;
	const highRiskPct = total > 0 ? highRisk / total : 0;

	// Outcome tier (our ground truth label):
	// A: thriving — many businesses, high pass rate, diverse risk levels
	// B: performing — moderate businesses, decent pass rate
	// C: surviving — few businesses or low pass rate
	// D: at_risk — very few businesses or high fail rate
	let tier;
	if (total >= 15 && passRate >= 0.80) tier = 'A';
	else if (total >= 8 && passRate >= 0.65) tier = 'B';
	else if (total >= 3 && passRate >= 0.50) tier = 'C';
	else tier = 'D';

	// Numeric outcome score (0-100) for Cohen's d
	const outcomeScore = clamp(
		(passRate * 60) +                         // 60% weight on pass rate
		(scoreLinear(total, 2, 25) * 0.30) +      // 30% weight on business density
		(highRiskPct * 10)                         // 10% bonus for high-risk (complex food = real restaurants)
	);

	return {
		businessCount: total,
		passRate: Math.round(passRate * 100),
		failRate: Math.round((failCount / Math.max(total, 1)) * 100),
		highRiskPct: Math.round(highRiskPct * 100),
		tier,
		outcomeScore,
	};
}

// ─── Cohen's d Calculation ───

function cohensD(group1, group2) {
	const n1 = group1.length;
	const n2 = group2.length;
	if (n1 < 2 || n2 < 2) return 0;

	const mean1 = group1.reduce((a, b) => a + b, 0) / n1;
	const mean2 = group2.reduce((a, b) => a + b, 0) / n2;
	const var1 = group1.reduce((a, b) => a + (b - mean1) ** 2, 0) / (n1 - 1);
	const var2 = group2.reduce((a, b) => a + (b - mean2) ** 2, 0) / (n2 - 1);
	const pooledSD = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));

	return pooledSD > 0 ? (mean1 - mean2) / pooledSD : 0;
}

function spearmanRank(x, y) {
	const n = x.length;
	if (n < 3) return 0;

	function rank(arr) {
		const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
		const ranks = new Array(n);
		for (let i = 0; i < n; i++) ranks[sorted[i].i] = i + 1;
		return ranks;
	}

	const rx = rank(x);
	const ry = rank(y);
	const d2 = rx.reduce((sum, r, i) => sum + (r - ry[i]) ** 2, 0);
	return 1 - (6 * d2) / (n * (n * n - 1));
}

// ─── Main ───

async function main() {
	console.log('╔══════════════════════════════════════════════════╗');
	console.log('║    RE² Chicago Test Scorer — V4 Logic Portability ║');
	console.log('╚══════════════════════════════════════════════════╝\n');

	if (!CENSUS_API_KEY) {
		console.log('⚠  No CENSUS_API_KEY — demographics will default to 50.\n   Get a free key at https://api.census.gov/data/key_signup.html\n');
	}

	const results = [];
	const profiles = {};

	for (let i = 0; i < TEST_LOCATIONS.length; i++) {
		const [name, lat, lng, profile] = TEST_LOCATIONS[i];
		process.stdout.write(`[${i + 1}/${TEST_LOCATIONS.length}] ${name}...`);

		// Fetch all data in parallel (including outcome data for calibration)
		const [geoid, cta, food, threeOneOne, liquor, outcomes] = await Promise.allSettled([
			getGeoid(lat, lng),
			getCTARidership(lat, lng),
			getFoodInspections(lat, lng),
			getChicago311(lat, lng),
			getLiquorLicenses(lat, lng),
			getOutcomeData(lat, lng),
		]);

		const geoidVal = geoid.status === 'fulfilled' ? geoid.value : null;
		let census = null;
		if (geoidVal && CENSUS_API_KEY) {
			census = await getCensusData(geoidVal);
		}

		const scores = scoreLocation(
			census,
			cta.status === 'fulfilled' ? cta.value : null,
			food.status === 'fulfilled' ? food.value : null,
			threeOneOne.status === 'fulfilled' ? threeOneOne.value : null,
			liquor.status === 'fulfilled' ? liquor.value : null,
		);

		const outcomeData = outcomes.status === 'fulfilled' ? outcomes.value : null;

		const result = {
			name, lat, lng, profile, geoid: geoidVal,
			...scores,
			outcome: outcomeData,
		};
		results.push(result);

		// Track by profile
		if (!profiles[profile]) profiles[profile] = [];
		profiles[profile].push(result);

		const outStr = outcomeData ? ` | Outcome: ${outcomeData.tier} (${outcomeData.outcomeScore})` : '';
		console.log(` → LIQ: ${scores.locationIQ} (${scores.grade}) | Demo: ${scores.demographics} | Transit: ${scores.transit} | Comp: ${scores.competition} | Vibe: ${scores.vibrancy}${outStr}`);

		// Rate limit — Socrata allows 1000 req/hr for unauthenticated
		if (i < TEST_LOCATIONS.length - 1) await new Promise(r => setTimeout(r, 500));
	}

	// ─── Analysis ───
	console.log('\n\n═══════════════════════════════════════════');
	console.log('  SCORE DISTRIBUTION BY NEIGHBORHOOD PROFILE');
	console.log('═══════════════════════════════════════════\n');

	for (const [profile, locs] of Object.entries(profiles).sort((a, b) => {
		const avgA = a[1].reduce((s, l) => s + l.locationIQ, 0) / a[1].length;
		const avgB = b[1].reduce((s, l) => s + l.locationIQ, 0) / b[1].length;
		return avgB - avgA;
	})) {
		const avg = Math.round(locs.reduce((s, l) => s + l.locationIQ, 0) / locs.length);
		const min = Math.min(...locs.map(l => l.locationIQ));
		const max = Math.max(...locs.map(l => l.locationIQ));
		const avgGrade = grade(avg);
		console.log(`  ${profile.padEnd(25)} avg=${avg} (${avgGrade})  range=[${min}-${max}]  n=${locs.length}`);
	}

	// ─── Sanity Checks ───
	console.log('\n\n═══════════════════════════════════════════');
	console.log('  SANITY CHECKS');
	console.log('═══════════════════════════════════════════\n');

	const sorted = [...results].sort((a, b) => b.locationIQ - a.locationIQ);
	const top5 = sorted.slice(0, 5);
	const bottom5 = sorted.slice(-5);

	console.log('  TOP 5:');
	for (const r of top5) console.log(`    ${r.locationIQ} (${r.grade}) ${r.name} [${r.profile}]`);

	console.log('\n  BOTTOM 5:');
	for (const r of bottom5) console.log(`    ${r.locationIQ} (${r.grade}) ${r.name} [${r.profile}]`);

	// Key test: does the scorer differentiate?
	const allScores = results.map(r => r.locationIQ);
	const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
	const variance = allScores.reduce((a, b) => a + (b - mean) ** 2, 0) / allScores.length;
	const stddev = Math.sqrt(variance);
	const spread = Math.max(...allScores) - Math.min(...allScores);

	console.log(`\n  Mean: ${Math.round(mean)}  StdDev: ${stddev.toFixed(1)}  Spread: ${spread}`);
	console.log(`  ${stddev > 10 ? '✅' : '❌'} Score differentiation ${stddev > 10 ? 'GOOD' : 'WEAK'} (stddev ${stddev > 10 ? '>' : '<'} 10)`);
	console.log(`  ${spread > 30 ? '✅' : '❌'} Score range ${spread > 30 ? 'GOOD' : 'NARROW'} (spread ${spread > 30 ? '>' : '<'} 30)`);

	// Profile ordering sanity
	const profileAvgs = Object.entries(profiles).map(([p, locs]) => ({
		profile: p,
		avg: Math.round(locs.reduce((s, l) => s + l.locationIQ, 0) / locs.length),
	})).sort((a, b) => b.avg - a.avg);

	const premiumFirst = profileAvgs[0].profile.includes('premium') || profileAvgs[0].profile.includes('affluent');
	const underservedLast = profileAvgs[profileAvgs.length - 1].profile.includes('underserved') || profileAvgs[profileAvgs.length - 1].profile.includes('suburban');
	console.log(`  ${premiumFirst ? '✅' : '⚠️'} Premium areas rank highest: ${profileAvgs[0].profile} (${profileAvgs[0].avg})`);
	console.log(`  ${underservedLast ? '✅' : '⚠️'} Underserved/suburban rank lowest: ${profileAvgs[profileAvgs.length - 1].profile} (${profileAvgs[profileAvgs.length - 1].avg})`);

	// ═══════════════════════════════════════════
	// CALIBRATION: Cohen's d & Spearman ρ
	// Does our Location IQ predict real business outcomes?
	// ═══════════════════════════════════════════

	const withOutcomes = results.filter(r => r.outcome);
	console.log('\n\n═══════════════════════════════════════════');
	console.log('  CALIBRATION — PREDICTIVE POWER');
	console.log('═══════════════════════════════════════════\n');
	console.log(`  Locations with outcome data: ${withOutcomes.length}/${results.length}`);

	if (withOutcomes.length >= 10) {
		// ── Spearman Rank Correlation: Location IQ vs Outcome Score ──
		const liqScores = withOutcomes.map(r => r.locationIQ);
		const outcomeScores = withOutcomes.map(r => r.outcome.outcomeScore);
		const rho = spearmanRank(liqScores, outcomeScores);
		console.log(`\n  Spearman ρ (Location IQ vs Outcome): ${rho.toFixed(3)}`);
		console.log(`  ${Math.abs(rho) > 0.3 ? '✅' : '❌'} ${Math.abs(rho) > 0.5 ? 'STRONG' : Math.abs(rho) > 0.3 ? 'MODERATE' : 'WEAK'} rank correlation`);

		// ── Per-dimension Spearman (which dimensions predict outcomes?) ──
		console.log('\n  Per-dimension correlation with outcomes:');
		const dims = ['demographics', 'transit', 'competition', 'vibrancy', 'safety', 'nightlife'];
		const dimCorrs = [];
		for (const dim of dims) {
			const dimScores = withOutcomes.map(r => r[dim] ?? 50);
			const dimRho = spearmanRank(dimScores, outcomeScores);
			dimCorrs.push({ dim, rho: dimRho });
			const bar = '█'.repeat(Math.round(Math.abs(dimRho) * 20));
			console.log(`    ${dim.padEnd(15)} ρ=${dimRho.toFixed(3)} ${bar}`);
		}
		dimCorrs.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));
		console.log(`\n  Strongest predictor: ${dimCorrs[0].dim} (ρ=${dimCorrs[0].rho.toFixed(3)})`);
		console.log(`  Weakest predictor:  ${dimCorrs[dimCorrs.length - 1].dim} (ρ=${dimCorrs[dimCorrs.length - 1].rho.toFixed(3)})`);

		// ── Cohen's d: Top tier vs Bottom tier ──
		const tierA = withOutcomes.filter(r => r.outcome.tier === 'A').map(r => r.locationIQ);
		const tierD = withOutcomes.filter(r => r.outcome.tier === 'D').map(r => r.locationIQ);
		const tierAB = withOutcomes.filter(r => r.outcome.tier === 'A' || r.outcome.tier === 'B').map(r => r.locationIQ);
		const tierCD = withOutcomes.filter(r => r.outcome.tier === 'C' || r.outcome.tier === 'D').map(r => r.locationIQ);

		console.log(`\n  Outcome tier distribution: A=${tierA.length} B=${withOutcomes.filter(r => r.outcome.tier === 'B').length} C=${withOutcomes.filter(r => r.outcome.tier === 'C').length} D=${tierD.length}`);

		if (tierA.length >= 2 && tierD.length >= 2) {
			const d_AD = cohensD(tierA, tierD);
			console.log(`\n  Cohen's d (A vs D): ${d_AD.toFixed(3)}`);
			console.log(`  ${Math.abs(d_AD) > 0.8 ? '🎯' : Math.abs(d_AD) > 0.5 ? '✅' : Math.abs(d_AD) > 0.2 ? '⚠️' : '❌'} Effect size: ${Math.abs(d_AD) > 0.8 ? 'LARGE' : Math.abs(d_AD) > 0.5 ? 'MEDIUM' : Math.abs(d_AD) > 0.2 ? 'SMALL' : 'NEGLIGIBLE'}`);
			console.log(`    Tier A avg LIQ: ${Math.round(tierA.reduce((a, b) => a + b, 0) / tierA.length)}`);
			console.log(`    Tier D avg LIQ: ${Math.round(tierD.reduce((a, b) => a + b, 0) / tierD.length)}`);
		}

		if (tierAB.length >= 2 && tierCD.length >= 2) {
			const d_split = cohensD(tierAB, tierCD);
			console.log(`\n  Cohen's d (A+B vs C+D): ${d_split.toFixed(3)}`);
			console.log(`  ${Math.abs(d_split) > 0.8 ? '🎯' : Math.abs(d_split) > 0.5 ? '✅' : Math.abs(d_split) > 0.2 ? '⚠️' : '❌'} Effect size: ${Math.abs(d_split) > 0.8 ? 'LARGE' : Math.abs(d_split) > 0.5 ? 'MEDIUM' : Math.abs(d_split) > 0.2 ? 'SMALL' : 'NEGLIGIBLE'}`);
			console.log(`    A+B avg LIQ: ${Math.round(tierAB.reduce((a, b) => a + b, 0) / tierAB.length)}  (n=${tierAB.length})`);
			console.log(`    C+D avg LIQ: ${Math.round(tierCD.reduce((a, b) => a + b, 0) / tierCD.length)}  (n=${tierCD.length})`);
		}

		// ── Weight Sensitivity Analysis ──
		// Try different weight combinations and see which gives best d
		console.log('\n\n═══════════════════════════════════════════');
		console.log('  WEIGHT OPTIMIZATION — FINDING BEST WEIGHTS');
		console.log('═══════════════════════════════════════════\n');

		const weightCombos = [
			{ label: 'Old V4',           w: { vibrancy: 0.28, demographics: 0.22, competition: 0.20, transit: 0.15, safety: 0.10, nightlife: 0.05 } },
			{ label: 'V4.1 (current)',   w: { vibrancy: 0.23, demographics: 0.22, competition: 0.20, transit: 0.15, safety: 0.05, nightlife: 0.15 } },
			{ label: 'Nightlife-max',    w: { vibrancy: 0.18, demographics: 0.20, competition: 0.20, transit: 0.12, safety: 0.05, nightlife: 0.25 } },
			{ label: 'Demo-heavy',       w: { vibrancy: 0.18, demographics: 0.35, competition: 0.15, transit: 0.10, safety: 0.05, nightlife: 0.17 } },
			{ label: 'Demo+Nightlife',   w: { vibrancy: 0.15, demographics: 0.30, competition: 0.15, transit: 0.10, safety: 0.05, nightlife: 0.25 } },
			{ label: 'Competition-fix',  w: { vibrancy: 0.20, demographics: 0.20, competition: 0.25, transit: 0.10, safety: 0.05, nightlife: 0.20 } },
			{ label: 'Transit-heavy',    w: { vibrancy: 0.18, demographics: 0.20, competition: 0.15, transit: 0.27, safety: 0.05, nightlife: 0.15 } },
			{ label: 'Balanced-v2',      w: { vibrancy: 0.18, demographics: 0.22, competition: 0.18, transit: 0.15, safety: 0.07, nightlife: 0.20 } },
		];

		// For each weight combo, recalculate composite LIQ and measure d
		let bestCombo = null;
		let bestD = -Infinity;
		for (const combo of weightCombos) {
			const reweighted = withOutcomes.map(r => {
				const newLIQ = clamp(
					(r.vibrancy ?? 50) * combo.w.vibrancy +
					(r.demographics ?? 50) * combo.w.demographics +
					(r.competition ?? 50) * combo.w.competition +
					(r.transit ?? 50) * combo.w.transit +
					(r.safety ?? 50) * combo.w.safety +
					(r.nightlife ?? 30) * combo.w.nightlife
				);
				return { ...r, reweightedLIQ: newLIQ };
			});

			const rwAB = reweighted.filter(r => r.outcome.tier === 'A' || r.outcome.tier === 'B').map(r => r.reweightedLIQ);
			const rwCD = reweighted.filter(r => r.outcome.tier === 'C' || r.outcome.tier === 'D').map(r => r.reweightedLIQ);

			if (rwAB.length >= 2 && rwCD.length >= 2) {
				const d = cohensD(rwAB, rwCD);
				const rwRho = spearmanRank(reweighted.map(r => r.reweightedLIQ), outcomeScores);
				console.log(`  ${combo.label.padEnd(22)} d=${d.toFixed(3)}  ρ=${rwRho.toFixed(3)}`);
				if (d > bestD) { bestD = d; bestCombo = combo; }
			}
		}

		if (bestCombo) {
			console.log(`\n  🏆 Best weight combo: "${bestCombo.label}" (d=${bestD.toFixed(3)})`);
			console.log(`     Weights: ${JSON.stringify(bestCombo.w)}`);
		}
	} else {
		console.log('  ⚠ Not enough outcome data for calibration (need ≥10 locations)');
	}

	// ─── Output ───
	if (PUSH) {
		const outputPath = new URL('../reports/chicago-test-scores.json', import.meta.url).pathname;
		const { writeFileSync, mkdirSync } = await import('fs');
		try { mkdirSync(new URL('../reports', import.meta.url).pathname, { recursive: true }); } catch {}
		writeFileSync(outputPath, JSON.stringify({
			generated: new Date().toISOString(),
			locationCount: results.length,
			stats: { mean: Math.round(mean), stddev: Math.round(stddev * 10) / 10, spread, min: Math.min(...allScores), max: Math.max(...allScores) },
			profileSummary: profileAvgs,
			results,
		}, null, 2));
		console.log(`\n📁 Results saved to ${outputPath}`);
	}

	console.log('\n✅ Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
