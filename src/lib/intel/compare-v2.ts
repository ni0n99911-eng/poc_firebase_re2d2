/**
 * RE² Location Comparison Engine v2 — V4 Three-Score Architecture
 *
 * Upgrades from v1:
 * - Uses V4 pre-computed scores (Location IQ v2, Vision IQ, Fit IQ) instead of NIQ/SIQ/TIQ
 * - Gap decomposition: identifies which single dimension drives the score difference
 * - Anomaly detection: flags when one factor overrides all others (e.g., Borough Bonus)
 * - Raw data transparency: exposes the actual input values behind each score
 * - Concept-specific ranking with per-dimension head-to-head
 * - Adjacent block group blending for boundary addresses
 *
 * This powers /api/compare (POST endpoint) and the future /app/compare UI route.
 */

import { getServiceSupabase } from '$lib/supabase-server';
import { latLngToGeoid, geoidToBorough } from './block-group';
// 04.19.2026 13:00 Changed from normalizeConceptKey to normalizeBusinessType (canonical registry)
import { normalizeBusinessType } from '$lib/intel/registry/business-type-registry';
// 04.19.2026 13:35 Score Consolidation — haversineM removed; imported from canonical geo-math.ts
import { haversineMeters as haversineM } from '$lib/intel/scoring/geo-math';

// ─── Types ───

export interface CompareLocation {
	lat: number;
	lng: number;
	address?: string;
	geoid: string;
	borough: string;
}

export interface DimensionScore {
	name: string;
	score: number;
	rawData: Record<string, any>;  // Actual input values for transparency
}

export interface LocationProfile {
	location: CompareLocation;
	fitScore: number;           // Location IQ (V5 composite)
	locationIQv2: number;       // Legacy Location IQ v2
	visionIQ: number;
	grade: string;
	dimensions: DimensionScore[];
	haloScore: number | null;   // Concept-specific halo effect score
	rawIntel: Record<string, any>;  // Full block_group_intel for this geoid
}

export interface DimensionComparison {
	dimension: string;
	scores: { locationIndex: number; score: number }[];
	winnerIndex: number;
	gap: number;           // max - min
	gapPct: number;        // gap as % of total Fit IQ spread
}

export interface Anomaly {
	type: 'single_factor_dominance' | 'boundary_artifact' | 'data_gap';
	description: string;
	severity: 'high' | 'medium' | 'low';
	affectedDimension?: string;
	detail: string;
}

export interface ComparisonResultV2 {
	locations: LocationProfile[];
	conceptType: string;
	ranking: number[];                     // Indices sorted by Fit IQ descending
	dimensionComparisons: DimensionComparison[];
	gapDecomposition: {
		totalGap: number;                    // Location IQ spread (max - min)
		topDriver: string;                   // Which dimension explains most of the gap
		topDriverContribution: number;       // % of gap explained by top driver
		linearVsComposite: string;           // V5 vs legacy agreement
	};
	anomalies: Anomaly[];
	recommendation: string;
	comparedAt: string;
}

// ─── Score Dimensions (V5 8-dim architecture) ───

const V5_DIMENSIONS = [
	'vibrancy',
	'demographics',
	'competition',
	'transit',
	'safety',
	'momentum',
	'neighborhoodHealth',
	'survivalRate',
] as const;

const DIMENSION_LABELS: Record<string, string> = {
	vibrancy: 'Concept Pulse',
	demographics: 'Demographics',
	competition: 'Competition',
	transit: 'Transit',
	safety: 'Safety',
	momentum: 'Momentum',
	neighborhoodHealth: 'Neighborhood Health',
	survivalRate: 'Business Success Rate',
};

// V5 score_type names in block_group_scores
const DIMENSION_SCORE_TYPES: Record<string, string> = {
	vibrancy: 'six_vibrancy',
	demographics: 'six_demographics',
	competition: 'six_competition',
	transit: 'six_transit',
	safety: 'six_safety',
	momentum: 'six_momentum',
	neighborhoodHealth: 'six_neighborhood_health',
	survivalRate: 'six_survival_rate',
};

// Which raw intel fields feed each dimension (for transparency)
const DIMENSION_RAW_FIELDS: Record<string, string[]> = {
	vibrancy: ['sidewalk_cafes.record_count', 'dca_licenses.record_count', 'liquor_licenses.total_licenses', 'foursquare.total_venues'],
	demographics: ['census_demographics.median_household_income', 'census_demographics.total_population', 'census_demographics.median_age', 'census_housing.median_rent_burden_pct', 'census_housing.median_gross_rent'],
	competition: ['google_places.total_results', 'google_places.type_distribution', 'osm_pois.total_pois', 'dohmh_inspections.record_count'],
	transit: ['walkscore.walkscore', 'walkscore.transit_score', 'walkscore.bike_score', 'mta_ridership.estimated_daily_ridership', 'mta_ridership.station_count_within_400m', 'pedestrian_counts.avg_pedestrian_count'],
	safety: ['nypd_crime.record_count', '311_complaints.record_count', 'dob_permits.record_count'],
	momentum: ['dob_permits.by_type', 'pluto_zoning.avg_built_far', 'pluto_zoning.avg_max_far', 'dca_licenses.record_count', 'lpc_landmarks.record_count'],
	neighborhoodHealth: ['google_ratings', 'google_reviews', 'dohmh_grades'],
	survivalRate: ['business_tiers'],
};

// ─── Data Loading ───

async function loadLocationProfile(
	location: CompareLocation,
	conceptType: string
): Promise<LocationProfile | null> {
	const supabase = getServiceSupabase();
	const suffix = conceptType === 'full_service_restaurant' ? '' : `:${conceptType}`;

	// Load scores and raw intel in parallel
	const [scoresRes, intelRes] = await Promise.all([
		supabase
			.from('block_group_scores')
			.select('score_type, score, components')
			.eq('geoid', location.geoid),
		supabase
			.from('block_group_intel')
			.select('source, data')
			.eq('geoid', location.geoid),
	]);

	if (!scoresRes.data || scoresRes.data.length === 0) return null;

	// Index scores by type
	const scores: Record<string, { score: number; components: any }> = {};
	for (const row of scoresRes.data) {
		scores[row.score_type] = { score: row.score ?? 0, components: row.components ?? {} };
	}

	// Index raw intel by source
	const rawIntel: Record<string, any> = {};
	if (intelRes.data) {
		for (const row of intelRes.data) {
			rawIntel[row.source] = row.data;
		}
	}

	// Get V5 scores
	const locIQ = scores['location_iq'] || scores['location_iq_v5'] || { score: 0, components: {} };
	const locIQv2 = scores['location_iq_v2'] || locIQ;
	const visionKey = `vision_iq${suffix}`;
	const vision = scores[visionKey] || scores['vision_iq'] || { score: 0, components: {} };

	// Halo score for this concept
	const haloScore = scores[`halo:${conceptType}`]?.score ?? scores['halo:general']?.score ?? null;

	// Build dimension scores from V5 pre-computed block_group_scores
	const dimensions: DimensionScore[] = V5_DIMENSIONS.map(dim => {
		const scoreType = DIMENSION_SCORE_TYPES[dim];
		const dimScore = scores[scoreType]?.score ?? 0;

		const rawFields = DIMENSION_RAW_FIELDS[dim] || [];
		const rawData: Record<string, any> = {};

		for (const field of rawFields) {
			const [source, ...path] = field.split('.');
			if (rawIntel[source]) {
				let val = rawIntel[source];
				for (const p of path) {
					val = val?.[p];
				}
				if (val !== undefined && val !== null) {
					rawData[field] = val;
				}
			}
		}

		return {
			name: dim,
			score: dimScore,
			rawData,
		};
	});

	// Use Location IQ as the primary comparison score
	const fitScore = locIQ.score ?? 0;
	let gradeStr = 'F';
	if (fitScore >= 93) gradeStr = 'A+';
	else if (fitScore >= 87) gradeStr = 'A';
	else if (fitScore >= 80) gradeStr = 'A-';
	else if (fitScore >= 73) gradeStr = 'B+';
	else if (fitScore >= 67) gradeStr = 'B';
	else if (fitScore >= 60) gradeStr = 'B-';
	else if (fitScore >= 53) gradeStr = 'C+';
	else if (fitScore >= 47) gradeStr = 'C';
	else if (fitScore >= 40) gradeStr = 'C-';
	else if (fitScore >= 30) gradeStr = 'D';

	return {
		location,
		fitScore,
		locationIQv2: locIQv2.score ?? 0,
		visionIQ: vision.score ?? 0,
		grade: gradeStr,
		dimensions,
		haloScore,
		rawIntel,
	};
}

// ─── Adjacent Block Group Blending ───

/**
 * For addresses near block group boundaries, find the nearest 2-3 block group
 * centroids and blend scores proportional to inverse distance.
 *
 * Returns the primary geoid + any blending candidates with weights.
 */
export async function findBlendCandidates(
	lat: number,
	lng: number,
	primaryGeoid: string
): Promise<{ geoid: string; weight: number }[]> {
	const supabase = getServiceSupabase();

	// Find nearby block groups by centroid distance
	// We can't do true PostGIS queries, so fetch all BGs in a bounding box
	const BBOX_DEG = 0.005; // ~550m
	const { data: nearbyBGs } = await supabase
		.from('block_groups')
		.select('geoid, centroid_lat, centroid_lng')
		.gte('centroid_lat', lat - BBOX_DEG)
		.lte('centroid_lat', lat + BBOX_DEG)
		.gte('centroid_lng', lng - BBOX_DEG)
		.lte('centroid_lng', lng + BBOX_DEG);

	if (!nearbyBGs || nearbyBGs.length <= 1) {
		return [{ geoid: primaryGeoid, weight: 1.0 }];
	}

	// Compute distances
	const withDist = nearbyBGs.map(bg => ({
		geoid: bg.geoid,
		dist: haversineM(lat, lng, bg.centroid_lat, bg.centroid_lng),
	})).sort((a, b) => a.dist - b.dist);

	const primary = withDist[0];
	const secondNearest = withDist.length > 1 ? withDist[1] : null;

	// If second-nearest centroid is > 300m away, no blending needed
	if (!secondNearest || secondNearest.dist > 300) {
		return [{ geoid: primaryGeoid, weight: 1.0 }];
	}

	// Distance-weighted blending
	// If both are equidistant, 50/50. If primary is much closer, it dominates.
	const totalDist = primary.dist + secondNearest.dist;
	if (totalDist === 0) {
		return [{ geoid: primaryGeoid, weight: 1.0 }];
	}

	// Inverse distance weights
	const w1 = secondNearest.dist / totalDist;  // Closer primary = higher weight
	const w2 = primary.dist / totalDist;

	// Minimum 70% weight to primary to avoid over-blending
	const primaryWeight = Math.max(0.70, w1);
	const secondWeight = 1.0 - primaryWeight;

	const result = [{ geoid: primary.geoid, weight: primaryWeight }];
	if (secondWeight > 0.05) {
		result.push({ geoid: secondNearest.geoid, weight: secondWeight });
	}

	return result;
}

// 04.19.2026 13:35 Score Consolidation — haversineM removed. Now aliased from haversineMeters in geo-math.ts above.

// ─── Gap Decomposition ───

function decomposeGap(profiles: LocationProfile[]): ComparisonResultV2['gapDecomposition'] {
	if (profiles.length < 2) {
		return { totalGap: 0, topDriver: 'none', topDriverContribution: 0, linearVsComposite: 'n/a' };
	}

	const fitScores = profiles.map(p => p.fitScore);
	const totalGap = Math.max(...fitScores) - Math.min(...fitScores);

	if (totalGap === 0) {
		return { totalGap: 0, topDriver: 'none', topDriverContribution: 0, linearVsComposite: 'match' };
	}

	// Find which dimension has the largest spread
	const dimSpreads: { dim: string; spread: number }[] = [];
	for (const dim of V5_DIMENSIONS) {
		const vals = profiles.map(p => {
			const d = p.dimensions.find(dd => dd.name === dim);
			return d?.score ?? 0;
		});
		dimSpreads.push({ dim, spread: Math.max(...vals) - Math.min(...vals) });
	}
	dimSpreads.sort((a, b) => b.spread - a.spread);

	const topDriver = dimSpreads[0];
	const topDriverContribution = totalGap > 0
		? Math.round((topDriver.spread / totalGap) * 100)
		: 0;

	// Check if legacy Location IQ v2 agrees with V5 composite
	const legacyScores = profiles.map(p => p.locationIQv2);
	const fitRanking = [...fitScores].map((s, i) => ({ i, s })).sort((a, b) => b.s - a.s);
	const legacyRanking = [...legacyScores].map((s, i) => ({ i, s })).sort((a, b) => b.s - a.s);
	const linearVsComposite = fitRanking[0].i === legacyRanking[0].i
		? 'V5 and legacy Location IQ agree on top pick'
		: `V5 and legacy disagree — V5 picks #${fitRanking[0].i + 1} but legacy picks #${legacyRanking[0].i + 1}`;

	return {
		totalGap,
		topDriver: DIMENSION_LABELS[topDriver.dim] || topDriver.dim,
		topDriverContribution,
		linearVsComposite,
	};
}

// ─── Anomaly Detection ───

function detectAnomalies(profiles: LocationProfile[]): Anomaly[] {
	const anomalies: Anomaly[] = [];

	if (profiles.length < 2) return anomalies;

	// 1. Single factor dominance: one dimension accounts for >60% of the total gap
	const fitScores = profiles.map(p => p.fitScore);
	const totalGap = Math.max(...fitScores) - Math.min(...fitScores);

	if (totalGap > 5) {
		for (const dim of V5_DIMENSIONS) {
			const vals = profiles.map(p => p.dimensions.find(d => d.name === dim)?.score ?? 0);
			const dimGap = Math.max(...vals) - Math.min(...vals);
			if (dimGap / totalGap > 0.60) {
				anomalies.push({
					type: 'single_factor_dominance',
					description: `${DIMENSION_LABELS[dim]} accounts for ${Math.round(dimGap / totalGap * 100)}% of the score gap`,
					severity: 'medium',
					affectedDimension: dim,
					detail: `The ${DIMENSION_LABELS[dim]} dimension is overwhelming all other factors in this comparison.`,
				});
			}
		}
	}

	// 2. Boundary artifact: profiles are in different block groups but within 200m
	if (profiles.length >= 2) {
		const geoids = profiles.map(p => p.location.geoid);
		const uniqueGeoids = new Set(geoids);
		if (uniqueGeoids.size > 1) {
			// Check if locations are physically close but in different block groups
			for (let i = 0; i < profiles.length; i++) {
				for (let j = i + 1; j < profiles.length; j++) {
					const dist = haversineM(
						profiles[i].location.lat, profiles[i].location.lng,
						profiles[j].location.lat, profiles[j].location.lng
					);
					if (dist < 200 && profiles[i].location.geoid !== profiles[j].location.geoid) {
						anomalies.push({
							type: 'boundary_artifact',
							description: `Locations ${i + 1} and ${j + 1} are ${Math.round(dist)}m apart but in different census block groups`,
							severity: 'high',
							detail: 'These locations likely share the same sidewalk traffic and commercial environment, but get different data profiles because a census boundary runs between them. Score differences may be artifacts of this boundary rather than real operational differences.',
						});
					}
				}
			}
		}
	}

	// 3. Data gaps: check if any profile has missing dimensions
	for (let i = 0; i < profiles.length; i++) {
		const missingDims = profiles[i].dimensions.filter(d => d.score === 0 && Object.keys(d.rawData).length === 0);
		if (missingDims.length > 2) {
			anomalies.push({
				type: 'data_gap',
				description: `Location ${i + 1} is missing data for ${missingDims.length} dimensions`,
				severity: 'medium',
				detail: `Missing: ${missingDims.map(d => DIMENSION_LABELS[d.name]).join(', ')}. Scores for these dimensions default to 50 (neutral) which may understate or overstate this location.`,
			});
		}
	}

	return anomalies;
}

// ─── Recommendation Generation ───

function generateRecommendation(profiles: LocationProfile[], conceptType: string, anomalies: Anomaly[]): string {
	if (profiles.length < 2) return 'Need at least 2 locations to compare.';

	const sorted = [...profiles].sort((a, b) => b.fitScore - a.fitScore);
	const top = sorted[0];
	const second = sorted[1];
	const gap = top.fitScore - second.fitScore;

	const hasBoundaryAnomaly = anomalies.some(a => a.type === 'boundary_artifact');
	const hasSingleFactor = anomalies.some(a => a.type === 'single_factor_dominance');

	let rec = '';

	if (gap < 3) {
		rec = `These locations are essentially tied (${top.fitScore} vs ${second.fitScore}). Focus on lease terms, rent, and personal site visit impressions.`;
	} else if (gap < 10) {
		rec = `${top.location.address || `Location ${profiles.indexOf(top) + 1}`} has a modest edge (${top.fitScore} vs ${second.fitScore}, Grade ${top.grade}).`;
	} else {
		rec = `${top.location.address || `Location ${profiles.indexOf(top) + 1}`} is the stronger pick (${top.fitScore} vs ${second.fitScore}, Grade ${top.grade} vs ${second.grade}).`;
	}

	if (hasBoundaryAnomaly) {
		rec += ' However, these locations may share identical foot traffic — the score difference could be a census boundary artifact. Verify with a site visit.';
	}

	if (hasSingleFactor) {
		const factor = anomalies.find(a => a.type === 'single_factor_dominance');
		rec += ` Note: the gap is mostly driven by ${factor?.affectedDimension ? DIMENSION_LABELS[factor.affectedDimension] : 'a single factor'}.`;
	}

	// Halo effect insight
	if (sorted[0].haloScore != null && sorted[0].haloScore > 60) {
		rec += ` Top pick benefits from a star-business halo effect (score ${sorted[0].haloScore}) — nearby high-quality businesses drive foot traffic.`;
	}

	// Legacy vs V5 divergence check
	if (sorted[0].locationIQv2 > 0 && sorted[1].locationIQv2 > 0) {
		if (sorted[0].locationIQv2 < sorted[1].locationIQv2 - 5) {
			rec += ` Note: the legacy scoring model (without neighborhood health data) favors the other location — V5 model accounts for business survival patterns.`;
		}
	}

	return rec;
}

// ─── Main Export ───

export async function compareLocationsV2(
	locations: { lat: number; lng: number; address?: string }[],
	conceptType: string = 'full_service_restaurant'
): Promise<ComparisonResultV2> {
	// BUG-ARCH-01: defensive normalization. Callers should already normalize,
	// but this key is used as an exact-match lookup against block_group_scores
	// (line 132 suffix logic + line 169 halo lookup). Silent-fail if mismatched.
	conceptType = normalizeBusinessType(conceptType);

	if (locations.length < 2 || locations.length > 5) {
		throw new Error('Provide 2-5 locations to compare');
	}

	// Resolve geoids for all locations
	const resolvedLocations: CompareLocation[] = [];
	for (const loc of locations) {
		const geoid = await latLngToGeoid(loc.lat, loc.lng);
		if (!geoid) {
			throw new Error(`Could not resolve block group for ${loc.lat},${loc.lng}`);
		}
		resolvedLocations.push({
			lat: loc.lat,
			lng: loc.lng,
			address: loc.address,
			geoid,
			borough: geoidToBorough(geoid),
		});
	}

	// Load profiles in parallel
	const profiles = await Promise.all(
		resolvedLocations.map(loc => loadLocationProfile(loc, conceptType))
	);

	const validProfiles = profiles.filter((p): p is LocationProfile => p !== null);
	if (validProfiles.length < 2) {
		throw new Error('Could not load scores for enough locations. At least 2 need V4 scores.');
	}

	// Dimension comparisons
	const dimensionComparisons: DimensionComparison[] = V5_DIMENSIONS.map(dim => {
		const scores = validProfiles.map((p, i) => ({
			locationIndex: i,
			score: p.dimensions.find(d => d.name === dim)?.score ?? 0,
		}));
		const maxScore = Math.max(...scores.map(s => s.score));
		const minScore = Math.min(...scores.map(s => s.score));
		const winnerIndex = scores.find(s => s.score === maxScore)?.locationIndex ?? 0;

		return {
			dimension: DIMENSION_LABELS[dim] || dim,
			scores,
			winnerIndex,
			gap: maxScore - minScore,
			gapPct: 0, // Filled below
		};
	});

	// Fill gapPct
	const totalDimGap = dimensionComparisons.reduce((s, d) => s + d.gap, 0);
	for (const dc of dimensionComparisons) {
		dc.gapPct = totalDimGap > 0 ? Math.round((dc.gap / totalDimGap) * 100) : 0;
	}

	// Ranking
	const ranking = validProfiles
		.map((p, i) => ({ i, score: p.fitScore }))
		.sort((a, b) => b.score - a.score)
		.map(x => x.i);

	// Gap decomposition
	const gapDecomposition = decomposeGap(validProfiles);

	// Anomaly detection
	const anomalies = detectAnomalies(validProfiles);

	// Recommendation
	const recommendation = generateRecommendation(validProfiles, conceptType, anomalies);

	return {
		locations: validProfiles,
		conceptType,
		ranking,
		dimensionComparisons,
		gapDecomposition,
		anomalies,
		recommendation,
		comparedAt: new Date().toISOString(),
	};
}
