/**
 * ═══════════════════════════════════════════════════════
 * Layer 2: Cross-Source Reconciliation Engine
 * ═══════════════════════════════════════════════════════
 *
 * Takes the raw LocationIntelReport (Layer 1) and produces
 * EnrichedEntities by:
 *
 * 1. Deduplicating POIs across Google/Foursquare/Yelp/Overpass
 *    (same business at same address from 3 different APIs)
 * 2. Resolving conflicting classifications (Google says "health",
 *    Foursquare says "gym" → resolved via majority vote + brand lookup)
 * 3. Assigning multi-source confidence scores
 * 4. Building derivation chains linking back to raw cache keys
 *
 * Every enriched entity knows exactly which raw data points
 * fed into it, so the user can always audit "where did this
 * come from?"
 */

import type { LocationIntelReport } from './types';
import type { PlaceResult } from './google-places';
import type { FoursquareVenue } from './foursquare';
import type { YelpBusiness } from './yelp';
import type { CompetitorPOI } from './overpass';
import type { StationRidership } from './mta-ridership';
import { IntelCache } from './cache';

// ── Types ──

export interface EnrichedEntity {
	entityType: 'poi' | 'transit_node' | 'demand_generator' | 'risk_signal' | 'demographic_profile';
	entityCategory: string;  // 'cafe', 'gym', 'subway_station', 'office_building', etc.
	entityName: string | null;
	entityData: Record<string, unknown>;

	// Multi-source validation
	sourceCount: number;
	sources: string[];
	confidence: number;  // 0.0 - 1.0

	// Conflict resolution
	conflicts: Record<string, { values: Record<string, unknown>; resolved: unknown; reason: string }> | null;

	// Lineage
	derivationChain: DerivationChain;
}

export interface DerivationChain {
	inputs: DerivationInput[];
	logic: string;
	assumptions?: string[];
}

export interface DerivationInput {
	source: string;
	field: string;
	value: unknown;
	cacheKey: string;
}

export interface ReconciliationResult {
	entities: EnrichedEntity[];
	totalEntities: number;
	poiCount: number;
	transitNodes: number;
	demandGenerators: number;
	riskSignals: number;
	conflictsResolved: number;
	avgConfidence: number;
	processingMs: number;
}

// ── Name matching ──

/** Normalize a business name for fuzzy matching */
function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[''`]/g, '')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Check if two names likely refer to the same business */
function namesMatch(a: string, b: string): boolean {
	const na = normalizeName(a);
	const nb = normalizeName(b);
	if (na === nb) return true;

	// One contains the other (handles "Starbucks" vs "Starbucks Coffee")
	if (na.includes(nb) || nb.includes(na)) return true;

	// Levenshtein-ish: if names are close enough relative to length
	const longer = na.length >= nb.length ? na : nb;
	const shorter = na.length < nb.length ? na : nb;
	if (shorter.length > 3 && longer.startsWith(shorter.substring(0, Math.ceil(shorter.length * 0.7)))) {
		return true;
	}

	return false;
}

/** Haversine distance in meters between two lat/lng points */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371000;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
		Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Unified POI representation for matching ──

interface RawPOI {
	name: string;
	lat: number;
	lng: number;
	category: string;
	source: string;
	rating: number | null;
	priceLevel: number | null;
	reviewCount: number | null;
	isChain: boolean;
	isOpen: boolean | null;
	address: string | null;
	raw: Record<string, unknown>;
	cacheKey: string;
}

function googleToRawPOI(p: PlaceResult, lat: number, lng: number): RawPOI {
	return {
		name: p.name,
		lat: p.lat,
		lng: p.lng,
		category: p.types?.[0] || 'unknown',
		source: 'google-places',
		rating: p.rating,
		priceLevel: p.priceLevel,
		reviewCount: p.reviewCount,
		isChain: false, // Google doesn't flag chains directly
		isOpen: p.isOpen ?? null,
		address: p.address,
		raw: p as unknown as Record<string, unknown>,
		cacheKey: IntelCache.locationKey(lat, lng, 'places'),
	};
}

function foursquareToRawPOI(v: FoursquareVenue, lat: number, lng: number): RawPOI {
	return {
		name: v.name,
		lat: 0, // Foursquare gives distance but not always coords in our type
		lng: 0,
		category: v.primaryCategory || v.categories?.[0]?.shortName || 'unknown',
		source: 'foursquare',
		rating: v.rating ? v.rating / 2 : null, // Foursquare is 0-10, normalize to 0-5
		priceLevel: v.priceLevel,
		reviewCount: null,
		isChain: v.isChain,
		isOpen: v.closed ? false : null,
		address: v.address,
		raw: v as unknown as Record<string, unknown>,
		cacheKey: IntelCache.locationKey(lat, lng, 'foursquare'),
	};
}

function yelpToRawPOI(b: YelpBusiness, lat: number, lng: number): RawPOI {
	return {
		name: b.name,
		lat: b.lat,
		lng: b.lng,
		category: b.primaryCategory || b.categories?.[0]?.alias || 'unknown',
		source: 'yelp',
		rating: b.rating,
		priceLevel: b.priceLevel,
		reviewCount: b.reviewCount,
		isChain: b.isChain,
		isOpen: b.isClosed ? false : null,
		address: b.address,
		raw: b as unknown as Record<string, unknown>,
		cacheKey: IntelCache.locationKey(lat, lng, 'yelp'),
	};
}

function overpassToRawPOI(p: CompetitorPOI, lat: number, lng: number): RawPOI {
	return {
		name: p.name,
		lat: p.lat,
		lng: p.lng,
		category: p.type || 'unknown',
		source: 'overpass',
		rating: null,
		priceLevel: null,
		reviewCount: null,
		isChain: p.isChain,
		isOpen: null,
		address: null,
		raw: p as unknown as Record<string, unknown>,
		cacheKey: IntelCache.locationKey(lat, lng, 'competitors'),
	};
}

// ── Matching & clustering ──

interface POICluster {
	members: RawPOI[];
	resolvedName: string;
	resolvedCategory: string;
}

/** Group raw POIs into clusters of the same real-world entity */
function clusterPOIs(pois: RawPOI[]): POICluster[] {
	const clusters: POICluster[] = [];
	const assigned = new Set<number>();

	for (let i = 0; i < pois.length; i++) {
		if (assigned.has(i)) continue;

		const cluster: RawPOI[] = [pois[i]];
		assigned.add(i);

		for (let j = i + 1; j < pois.length; j++) {
			if (assigned.has(j)) continue;

			// Check if POI j matches any member in the current cluster
			const match = cluster.some(member => {
				// Name match is required
				if (!namesMatch(member.name, pois[j].name)) return false;

				// If both have coordinates, check distance (< 80m = likely same place)
				if (member.lat && member.lng && pois[j].lat && pois[j].lng) {
					return distanceMeters(member.lat, member.lng, pois[j].lat, pois[j].lng) < 80;
				}

				// If only one has coords, name match is sufficient (Foursquare often lacks coords)
				return true;
			});

			if (match) {
				cluster.push(pois[j]);
				assigned.add(j);
			}
		}

		// Resolve the cluster
		const resolvedName = resolveConflict(
			cluster.map(m => ({ source: m.source, value: m.name })),
			'longest'  // prefer the most descriptive name
		) as string;

		const resolvedCategory = resolveConflict(
			cluster.map(m => ({ source: m.source, value: m.category })),
			'majority'
		) as string;

		clusters.push({ members: cluster, resolvedName, resolvedCategory });
	}

	return clusters;
}

// ── Conflict resolution ──

type ResolveStrategy = 'majority' | 'highest' | 'lowest' | 'longest' | 'prefer_source';

interface ConflictValue {
	source: string;
	value: unknown;
}

function resolveConflict(values: ConflictValue[], strategy: ResolveStrategy): unknown {
	if (values.length === 0) return null;
	if (values.length === 1) return values[0].value;

	// Filter nulls/undefined
	const valid = values.filter(v => v.value != null);
	if (valid.length === 0) return null;
	if (valid.length === 1) return valid[0].value;

	switch (strategy) {
		case 'majority': {
			// Most common value wins
			const counts = new Map<string, number>();
			for (const v of valid) {
				const key = String(v.value);
				counts.set(key, (counts.get(key) || 0) + 1);
			}
			let bestKey = '';
			let bestCount = 0;
			for (const [key, count] of counts) {
				if (count > bestCount) { bestKey = key; bestCount = count; }
			}
			return valid.find(v => String(v.value) === bestKey)?.value;
		}
		case 'highest':
			return valid.reduce((best, v) =>
				(Number(v.value) || 0) > (Number(best.value) || 0) ? v : best
			).value;
		case 'lowest':
			return valid.reduce((best, v) =>
				(Number(v.value) || 0) < (Number(best.value) || 0) ? v : best
			).value;
		case 'longest':
			return valid.reduce((best, v) =>
				String(v.value).length > String(best.value).length ? v : best
			).value;
		case 'prefer_source': {
			// Priority: foursquare > google > yelp > overpass
			const priority = ['foursquare', 'google-places', 'yelp', 'overpass'];
			for (const src of priority) {
				const found = valid.find(v => v.source === src);
				if (found) return found.value;
			}
			return valid[0].value;
		}
		default:
			return valid[0].value;
	}
}

// ── Main reconciliation ──

/**
 * Reconcile raw LocationIntelReport into deduplicated, confidence-scored entities.
 * This is the Layer 1 → Layer 2 transformation.
 */
export function reconcileEntities(report: LocationIntelReport): ReconciliationResult {
	const startMs = Date.now();
	const entities: EnrichedEntity[] = [];
	let conflictsResolved = 0;

	const { lat, lng } = report;

	// ── 1. Collect all raw POIs from every source ──
	const allPOIs: RawPOI[] = [];

	if (report.places?.places) {
		for (const p of report.places.places) {
			allPOIs.push(googleToRawPOI(p, lat, lng));
		}
	}
	if (report.foursquare?.venues) {
		for (const v of report.foursquare.venues) {
			allPOIs.push(foursquareToRawPOI(v, lat, lng));
		}
	}
	if (report.yelp?.businesses) {
		for (const b of report.yelp.businesses) {
			allPOIs.push(yelpToRawPOI(b, lat, lng));
		}
	}
	if (report.competitors?.competitors) {
		for (const c of report.competitors.competitors) {
			if (c.name && c.name !== 'Unknown') {
				allPOIs.push(overpassToRawPOI(c, lat, lng));
			}
		}
	}

	// ── 2. Cluster and deduplicate POIs ──
	const clusters = clusterPOIs(allPOIs);

	for (const cluster of clusters) {
		const members = cluster.members;
		const sources = [...new Set(members.map(m => m.source))];

		// Build conflict log
		const conflicts: Record<string, { values: Record<string, unknown>; resolved: unknown; reason: string }> = {};

		// Resolve rating conflicts
		const ratings = members.filter(m => m.rating != null).map(m => ({ source: m.source, value: m.rating }));
		let resolvedRating: number | null = null;
		if (ratings.length > 1) {
			const vals = ratings.map(r => Number(r.value));
			const spread = Math.max(...vals) - Math.min(...vals);
			if (spread > 0.5) {
				// Weighted average by source reliability: Yelp > Google > Foursquare for ratings
				resolvedRating = weightedAvgRating(members);
				const valueMap: Record<string, unknown> = {};
				for (const r of ratings) valueMap[r.source] = r.value;
				conflicts['rating'] = {
					values: valueMap,
					resolved: resolvedRating,
					reason: 'Weighted average (Yelp×0.4 + Google×0.35 + Foursquare×0.25)'
				};
				conflictsResolved++;
			} else {
				resolvedRating = Number(ratings[0].value);
			}
		} else if (ratings.length === 1) {
			resolvedRating = Number(ratings[0].value);
		}

		// Resolve category conflicts
		const categories = members.map(m => ({ source: m.source, value: m.category }));
		const uniqueCategories = [...new Set(categories.map(c => String(c.value)))];
		if (uniqueCategories.length > 1) {
			const catMap: Record<string, unknown> = {};
			for (const c of categories) catMap[c.source] = c.value;
			conflicts['classification'] = {
				values: catMap,
				resolved: cluster.resolvedCategory,
				reason: 'Majority vote across sources'
			};
			conflictsResolved++;
		}

		// Resolve price level
		const prices = members.filter(m => m.priceLevel != null).map(m => ({ source: m.source, value: m.priceLevel }));
		let resolvedPrice: number | null = null;
		if (prices.length > 0) {
			resolvedPrice = Math.round(prices.reduce((sum, p) => sum + Number(p.value), 0) / prices.length);
			if (prices.length > 1) {
				const priceValues = prices.map(p => Number(p.value));
				if (Math.max(...priceValues) !== Math.min(...priceValues)) {
					const priceMap: Record<string, unknown> = {};
					for (const p of prices) priceMap[p.source] = p.value;
					conflicts['price_level'] = {
						values: priceMap,
						resolved: resolvedPrice,
						reason: 'Average across sources'
					};
					conflictsResolved++;
				}
			}
		}

		// Calculate confidence based on source count and agreement
		const confidence = calculatePOIConfidence(members, Object.keys(conflicts).length);

		// Build derivation chain
		const derivationChain: DerivationChain = {
			inputs: members.map(m => ({
				source: m.source,
				field: 'poi',
				value: m.name,
				cacheKey: m.cacheKey,
			})),
			logic: sources.length > 1
				? `Entity confirmed by ${sources.length} independent sources (${sources.join(', ')}). ` +
				  `${Object.keys(conflicts).length} conflicts resolved via majority vote / weighted average.`
				: `Single-source entity from ${sources[0]}. No cross-validation available.`,
		};

		// Determine isChain across sources
		const chainVotes = members.filter(m => m.isChain);
		const isChain = chainVotes.length > members.length / 2;

		entities.push({
			entityType: 'poi',
			entityCategory: cluster.resolvedCategory,
			entityName: cluster.resolvedName,
			entityData: {
				rating: resolvedRating,
				priceLevel: resolvedPrice,
				reviewCount: Math.max(...members.map(m => m.reviewCount || 0)),
				isChain,
				isOpen: members.some(m => m.isOpen === true) ? true : members.some(m => m.isOpen === false) ? false : null,
				address: (members.find(m => m.address)?.address) || null,
				lat: members.find(m => m.lat)?.lat || lat,
				lng: members.find(m => m.lng)?.lng || lng,
			},
			sourceCount: sources.length,
			sources,
			confidence,
			conflicts: Object.keys(conflicts).length > 0 ? conflicts : null,
			derivationChain,
		});
	}

	// ── 3. Transit nodes from MTA ridership ──
	if (report.mtaRidership?.stations) {
		for (const station of report.mtaRidership.stations) {
			entities.push({
				entityType: 'transit_node',
				entityCategory: 'subway_station',
				entityName: station.stationComplex,
				entityData: {
					dailyRidership: station.ridership,
					peakRidership: station.peakRidership,
					offPeakRidership: station.offPeakRidership,
					dayOfWeek: station.dayOfWeek,
				},
				sourceCount: 1,
				sources: ['mta-ridership'],
				confidence: 0.9, // MTA data is official
				conflicts: null,
				derivationChain: {
					inputs: [{
						source: 'mta-ridership',
						field: 'station',
						value: station.stationComplex,
						cacheKey: IntelCache.locationKey(lat, lng, 'mta-ridership'),
					}],
					logic: 'Official MTA ridership data — single authoritative source.',
				},
			});
		}
	}

	// ── 4. Demand generators: offices, hotels, schools, parks from market density ──
	if (report.marketDensity?.categories) {
		const demandTypes = ['office', 'coworking', 'hotel', 'school', 'park', 'theater'];
		for (const cat of report.marketDensity.categories) {
			if (demandTypes.some(d => cat.placeType.includes(d)) && cat.count > 0) {
				entities.push({
					entityType: 'demand_generator',
					entityCategory: cat.placeType,
					entityName: null, // Aggregate, not a single entity
					entityData: {
						count: cat.count,
						avgRating: cat.avgRating,
						chainPct: cat.chainPct,
					},
					sourceCount: 1,
					sources: ['google-places-density'],
					confidence: 0.75,
					conflicts: null,
					derivationChain: {
						inputs: [{
							source: 'google-places',
							field: `market_density.${cat.placeType}`,
							value: cat.count,
							cacheKey: IntelCache.locationKey(lat, lng, 'market-density'),
						}],
						logic: `Market density scan found ${cat.count} ${cat.placeType} locations within 500m radius.`,
					},
				});
			}
		}
	}

	// ── 5. Risk signals from crime data ──
	if (report.crime) {
		entities.push({
			entityType: 'risk_signal',
			entityCategory: 'crime_cluster',
			entityName: null,
			entityData: {
				totalIncidents: report.crime.totalCount,
				violentCount: report.crime.violentCount,
				propertyCount: report.crime.propertyCount,
				crimeScore: report.crime.crimeScore,
				densityPerSqMi: report.crime.densityPerSqMi,
				topTypes: report.crime.topTypes,
			},
			sourceCount: 1,
			sources: ['nypd-complaints'],
			confidence: 0.85, // Official data, but lagged
			conflicts: null,
			derivationChain: {
				inputs: [{
					source: 'nypd-complaints',
					field: 'crime_summary',
					value: { total: report.crime.totalCount, score: report.crime.crimeScore },
					cacheKey: IntelCache.locationKey(lat, lng, 'crime'),
				}],
				logic: 'NYPD CompStat data — official crime complaints within 500m radius.',
				assumptions: ['Data may be 30-90 days lagged from date of incident'],
			},
		});
	}

	// ── 6. Demographic profile from Census ──
	if (report.census) {
		entities.push({
			entityType: 'demographic_profile',
			entityCategory: 'census_demographics',
			entityName: null,
			entityData: {
				totalPopulation: report.census.totalPopulation,
				medianIncome: report.census.medianHouseholdIncome,
				medianAge: report.census.medianAge,
				educationBachelorsPct: report.census.bachelorsPlusPercent,
				commuteTransitPct: report.census.commuterPercent,
			},
			sourceCount: 1,
			sources: ['census-acs'],
			confidence: 0.8,
			conflicts: null,
			derivationChain: {
				inputs: [{
					source: 'census-acs',
					field: 'demographics',
					value: { pop: report.census.totalPopulation, income: report.census.medianHouseholdIncome },
					cacheKey: IntelCache.locationKey(lat, lng, 'demographics'),
				}],
				logic: 'US Census ACS 5-year estimates at census tract level.',
				assumptions: ['Census data reflects 5-year average, not current snapshot', 'Tract-level granularity (~4,000 people)'],
			},
		});
	}

	// ── Stats ──
	const poiCount = entities.filter(e => e.entityType === 'poi').length;
	const transitNodes = entities.filter(e => e.entityType === 'transit_node').length;
	const demandGenerators = entities.filter(e => e.entityType === 'demand_generator').length;
	const riskSignals = entities.filter(e => e.entityType === 'risk_signal').length;
	const avgConfidence = entities.length > 0
		? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length
		: 0;

	return {
		entities,
		totalEntities: entities.length,
		poiCount,
		transitNodes,
		demandGenerators,
		riskSignals,
		conflictsResolved,
		avgConfidence: Math.round(avgConfidence * 100) / 100,
		processingMs: Date.now() - startMs,
	};
}

// ── Helpers ──

function weightedAvgRating(members: RawPOI[]): number {
	const weights: Record<string, number> = {
		'yelp': 0.4,
		'google-places': 0.35,
		'foursquare': 0.25,
	};

	let totalWeight = 0;
	let weightedSum = 0;

	for (const m of members) {
		if (m.rating == null) continue;
		const w = weights[m.source] || 0.1;
		weightedSum += m.rating * w;
		totalWeight += w;
	}

	return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
}

function calculatePOIConfidence(members: RawPOI[], conflictCount: number): number {
	// Base confidence by source count
	let confidence: number;
	switch (members.length) {
		case 1: confidence = 0.5; break;
		case 2: confidence = 0.7; break;
		case 3: confidence = 0.85; break;
		default: confidence = 0.95; break;
	}

	// Bonus for having premium sources
	const sources = new Set(members.map(m => m.source));
	if (sources.has('google-places')) confidence += 0.05;
	if (sources.has('foursquare')) confidence += 0.03;

	// Penalty for unresolved conflicts
	confidence -= conflictCount * 0.02;

	// Bonus if all sources agree on category
	const categories = [...new Set(members.map(m => m.category))];
	if (categories.length === 1 && members.length > 1) confidence += 0.05;

	return Math.max(0.1, Math.min(1.0, Math.round(confidence * 100) / 100));
}
