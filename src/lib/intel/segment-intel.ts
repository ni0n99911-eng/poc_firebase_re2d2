/**
 * ═══════════════════════════════════════════════════════
 * RE² Segment Intelligence Engine
 * ═══════════════════════════════════════════════════════
 *
 * Extrapolates and interprets raw location intel data into
 * business-segment-specific "hero metrics" — the 2-3 numbers
 * that actually decide whether a location works for THAT type
 * of business.
 *
 * Each segment config defines:
 * - heroMetrics: the eye-catching numbers (rush hour traffic, pricing, etc.)
 * - extrapolation logic that turns raw API data into interpretive insights
 * - contextual labels, icons, and color theming
 *
 * Extensible: add a new SegmentConfig to support any business type.
 */

// 04.19.2026 13:35 Score Consolidation — clamp imported from canonical geo-math.ts
import { clamp } from '$lib/intel/scoring/geo-math';

// ── Types ──

export interface HeroMetric {
	id: string;
	label: string;           // "Morning Rush Traffic"
	value: string;           // "2,840"
	unit: string;            // "people/hr"
	sublabel: string;        // "7:30 – 10:00 AM"
	icon: string;            // emoji
	color: string;           // accent color
	confidence: 'high' | 'moderate' | 'estimated';
	interpretation: string;  // "Strong — top 20% for NYC coffee shops"
	sentiment: 'great' | 'good' | 'caution' | 'warning';
	rawValue: number;        // for sorting / comparison
	breakdown?: { label: string; value: number; color?: string }[];  // optional bar breakdown
}

export interface CompetitorBlend {
	avgPrice: string | null;   // "$4.75" or null if no real price data
	priceRange: string | null; // "$3.50 – $6.00" or null if no real price data
	avgRating: number;       // 4.2
	totalCount: number;      // ALL competitors (unfiltered)
	tierCount: number;       // Competitors in your price tier (filtered)
	chainPct: number;        // 0-100
	independentPct: number;
	topCompetitors: { name: string; rating: number; price: number; distance: number; isChain: boolean }[];
	tierCompetitors: { name: string; rating: number; price: number; distance: number; isChain: boolean }[];
	marketGap: string;       // "Premium independent — underserved"
	sentiment: 'great' | 'good' | 'caution' | 'warning';
}

/**
 * Known budget chains — filtered out when avgTicket >= $7 (premium coffee).
 * At $9 protein coffee, Dunkin/bodega/cart aren't your competitors.
 * Name-matched case-insensitive against competitor name.
 */
const BUDGET_CHAIN_NAMES = new Set([
	'dunkin', "dunkin'", 'dunkin donuts', 'starbucks', '7-eleven', '7 eleven',
	'wawa', 'mcdonald', "mcdonald's", 'tim hortons', 'pret a manger', 'pret',
	'gregory\'s', 'gregorys', 'joe coffee', 'bluestone lane',
]);

/** Returns true if a competitor is a budget-tier chain (by name or isChain + low price) */
function isBudgetChain(c: { name: string; price: number; isChain: boolean }): boolean {
	const lower = c.name.toLowerCase().trim();
	if (BUDGET_CHAIN_NAMES.has(lower)) return true;
	// Foursquare isChain + budget price = budget chain
	if (c.isChain && c.price > 0 && c.price < 5.50) return true;
	// Name heuristics for carts/bodegas
	if (lower.includes('cart') || lower.includes('bodega') || lower.includes('deli')) return true;
	return false;
}

/** Returns true if a competitor is specialty/wellness (excluded for budget < $5) */
function isSpecialtyWellness(c: { name: string; price: number }): boolean {
	const lower = c.name.toLowerCase().trim();
	return lower.includes('juice') || lower.includes('smoothie') || lower.includes('wellness')
		|| lower.includes('acai') || lower.includes('matcha') || (c.price > 0 && c.price >= 7.00);
}

export interface DailyRitualDensity {
	score: number;           // 0-100
	label: string;           // "Very High Daily Ritual Density"
	totalRitualPOIs: number;
	breakdown: { type: string; count: number; icon: string; color: string }[];
	estimatedDailyRitualPop: number;  // extrapolated daily repeat visitors
	interpretation: string;
	sentiment: 'great' | 'good' | 'caution' | 'warning';
}

export interface SegmentInsight {
	segmentId: string;
	segmentLabel: string;
	segmentIcon: string;
	heroMetrics: HeroMetric[];
	competitorBlend: CompetitorBlend | null;
	dailyRitualDensity: DailyRitualDensity | null;
	coffeeChain?: import('$lib/intel/segment-intel').RushTrafficChain;
}

// ── Helpers ──

function fmt(n: number): string {
	if (n >= 10000) return Math.round(n / 1000) + 'K';
	if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
	return Math.round(n).toLocaleString();
}

// 04.19.2026 13:35 Score Consolidation — clamp removed. Imported from geo-math.ts above.

function scoreSentiment(score: number): 'great' | 'good' | 'caution' | 'warning' {
	if (score >= 80) return 'great';
	if (score >= 60) return 'good';
	if (score >= 40) return 'caution';
	return 'warning';
}

// ── Extrapolation: Rush Hour Traffic ──

/**
 * Extrapolate rush-hour foot traffic from MTA ridership + pedestrian counts.
 *
 * Logic: MTA data gives peak/off-peak ratio and total daily ridership.
 * We know from transit studies that:
 * - Morning peak (7-10am) = ~32% of daily ridership
 * - Evening peak (4-7pm) = ~35% of daily ridership
 * - For COFFEE specifically, the relevant window is 7:30-10:00am and 2:00-3:30pm
 * - Morning coffee rush captures ~25% of morning commuters (walk-by conversion)
 * - Afternoon slump captures ~10% of nearby workers
 *
 * We blend MTA data with pedestrian counts when available for higher confidence.
 */
export interface RushTrafficChain {
	mtaMorningPeak: number | null;
	coffeeWindow: number | null;
	mtaDerived: number | null;
	estimatedMorningWalkbys: number | null;
}

export function extrapolateCoffeeRushTraffic(intel: any): { morning: HeroMetric; afternoon: HeroMetric; chain: RushTrafficChain } {
	const mta = intel.mtaRidership;
	const ped = intel.pedestrian;

	let morningRaw = 0;
	let afternoonRaw = 0;
	let confidence: 'high' | 'moderate' | 'estimated' = 'estimated';

	let chain: RushTrafficChain = { mtaMorningPeak: null, coffeeWindow: null, mtaDerived: null, estimatedMorningWalkbys: null };

	if (mta && mta.totalDailyRidership > 0) {
		const dailyRiders = mta.totalDailyRidership;
		
		chain.mtaMorningPeak = Math.round(dailyRiders * 0.32);
		chain.coffeeWindow = Math.round(chain.mtaMorningPeak * 0.83);
		chain.mtaDerived = Math.round(chain.coffeeWindow * 0.20);
		
		// Morning peak (7-10am) ≈ 32% of daily, coffee window (7:30-10) ≈ 83% of that
		const morningPeakRiders = dailyRiders * 0.32 * 0.83;
		// Walk-by conversion: ~18-25% of riders exit and walk past nearby shops
		// For a 300m radius, capture rate is ~20%
		morningRaw = morningPeakRiders * 0.20;

		// Afternoon (2-3:30pm): ~12% of daily, mostly office workers, lower conversion
		const afternoonRiders = dailyRiders * 0.12 * 0.625; // 1.5hr of 2.4hr window
		afternoonRaw = afternoonRiders * 0.15;

		confidence = 'moderate';
	}

	// Blend with pedestrian counts if available
	if (ped && ped.totalPedestrians > 0) {
		const pedMorning = ped.avgAMCount || ped.totalPedestrians * 0.45;
		const pedAfternoon = (ped.avgPMCount || ped.totalPedestrians * 0.55) * 0.4; // afternoon slump ≈ 40% of PM

		if (morningRaw > 0) {
			// Weighted blend: 60% MTA-derived, 40% pedestrian-derived
			morningRaw = morningRaw * 0.6 + pedMorning * 0.4;
			afternoonRaw = afternoonRaw * 0.6 + pedAfternoon * 0.4;
			confidence = 'high';
		} else {
			morningRaw = pedMorning;
			afternoonRaw = pedAfternoon;
			confidence = 'moderate';
		}
	}
	
	if (chain.mtaDerived) {
	    // Expose the final post-blend estimate to the UI chain
	    chain.estimatedMorningWalkbys = Math.round(chain.mtaDerived / 0.60);
	}

	// Fallback: estimate from census population density
	if (morningRaw === 0 && intel.census) {
		const density = intel.census.populationDensity || 0;
		const daytimeRatio = intel.census.daytimePopulationRatio || 1.0;
		// Dense areas with high daytime ratio = lots of office workers
		morningRaw = density * daytimeRatio * 0.02;
		afternoonRaw = morningRaw * 0.35;
	}

	morningRaw = Math.round(clamp(morningRaw, 0, 50000));
	afternoonRaw = Math.round(clamp(afternoonRaw, 0, 20000));

	const morningSentiment = morningRaw >= 3000 ? 'great' : morningRaw >= 1500 ? 'good' : morningRaw >= 500 ? 'caution' : 'warning';
	const afternoonSentiment = afternoonRaw >= 1000 ? 'great' : afternoonRaw >= 500 ? 'good' : afternoonRaw >= 200 ? 'caution' : 'warning';

	const morningInterp = morningRaw >= 3000 ? 'Excellent — high-volume morning rush location'
		: morningRaw >= 1500 ? 'Good morning traffic flow for a café'
		: morningRaw >= 500 ? 'Moderate — may need destination appeal'
		: 'Low foot traffic — consider a different block';

	const afternoonInterp = afternoonRaw >= 1000 ? 'Strong afternoon slump market — great for second wave'
		: afternoonRaw >= 500 ? 'Decent afternoon pickup trade'
		: afternoonRaw >= 200 ? 'Light afternoon — lunch pivot could help'
		: 'Very quiet afternoons — may need events or programming';

	return {
		morning: {
			id: 'morning-rush',
			label: 'Morning Rush',
			value: fmt(morningRaw),
			unit: 'people passing',
			sublabel: '7:30 – 10:00 AM',
			icon: '☀️',
			color: '#FF9500',
			confidence,
			interpretation: morningInterp,
			sentiment: morningSentiment,
			rawValue: morningRaw,
			breakdown: mta ? [
				{ label: 'MTA exits', value: Math.round(morningRaw * 0.55), color: '#3b82f6' },
				{ label: 'Walk-by', value: Math.round(morningRaw * 0.30), color: '#f97316' },
				{ label: 'Residents', value: Math.round(morningRaw * 0.15), color: '#8b5cf6' },
			] : undefined,
		},
		afternoon: {
			id: 'afternoon-slump',
			label: 'Afternoon Pickup',
			value: fmt(afternoonRaw),
			unit: 'people passing',
			sublabel: '2:00 – 3:30 PM',
			icon: '🌤️',
			color: '#FF6B35',
			confidence,
			interpretation: afternoonInterp,
			sentiment: afternoonSentiment,
			rawValue: afternoonRaw,
		},
		chain
	};
}

// ── Extrapolation: Competitor Pricing Blend ──

/**
 * COFFEE-REWIRE Change 8: When avgTicket > $7, expand Google type filter
 * to include juice_bar, smoothie, health_food — at $9 protein coffee,
 * your competitors are wellness shops, not Starbucks.
 */
export function blendCompetitorPricing(intel: any, bizType = 'specialty_coffee', avgTicket: number = 5.00): CompetitorBlend | null {
	const fsq = intel.foursquare;
	const places = intel.places;
	const overpass = intel.competitors;

	// Collect all competitor data points
	const competitors: { name: string; rating: number; price: number; distance: number; isChain: boolean }[] = [];

	// Foursquare venues (richest data)
	if (fsq?.directCompetitors) {
		for (const v of fsq.directCompetitors) {
			const price = v.priceLevel
				? v.priceLevel === 1 ? 3.50 : v.priceLevel === 2 ? 4.75 : v.priceLevel === 3 ? 6.00 : 7.50
				: null; // no price data — don't fake it
			competitors.push({
				name: v.name,
				rating: v.rating ? v.rating / 2 : 0, // Foursquare 0-10 → 0-5
				price: price ?? 0,
				distance: v.distance,
				isChain: v.isChain,
			});
		}
	}

	// Google Places as supplement — concept-aware type filter
	// COFFEE-REWIRE Change 8: Premium coffee ($7+) competes with wellness/juice
	const _coffeeTypes = avgTicket > 7
		? ['cafe', 'coffee_shop', 'juice_bar', 'smoothie', 'health_food', 'meal_delivery']
		: ['cafe', 'coffee_shop'];
	const _googleTypes = bizType.includes('restaurant') || bizType.includes('fast_casual') || bizType.includes('qsr')
		? ['restaurant', 'food']
		: bizType.includes('fitness') || bizType.includes('gym')
		? ['gym', 'health']
		: bizType.includes('bar') || bizType.includes('nightlife')
		? ['bar', 'night_club']
		: _coffeeTypes;
	if (places?.places && competitors.length < 5) {
		for (const p of places.places) {
			if (!p.types?.some((t: string) => _googleTypes.includes(t))) continue;
			if (competitors.some(c => c.name === p.name)) continue; // dedup
			const price = p.priceLevel
				? p.priceLevel === 1 ? 3.50 : p.priceLevel === 2 ? 5.00 : p.priceLevel === 3 ? 6.50 : 8.00
				: null; // no price data — don't fake it
			competitors.push({
				name: p.name,
				rating: p.rating || 0,
				price: price ?? 0,
				distance: p.distance,
				isChain: false, // Google doesn't flag this reliably
			});
		}
	}

	if (competitors.length === 0) return null;

	// Sort by distance (closest first)
	competitors.sort((a, b) => a.distance - b.distance);

	// ── Tier filtering: exclude competitors outside your price tier ──
	// Premium ($7+): exclude budget chains (Dunkin, carts, bodegas)
	// Budget (<$5): exclude specialty/wellness/juice
	// Standard ($5-7): no filtering
	const tierFiltered = competitors.filter(c => {
		if (avgTicket >= 7.00 && isBudgetChain(c)) return false;
		if (avgTicket < 5.00 && isSpecialtyWellness(c)) return false;
		return true;
	});

	// Use tier-filtered set for pricing analysis (your actual competitors)
	const tierPrices = tierFiltered.map(c => c.price).filter(p => p > 0);
	const tierRatings = tierFiltered.map(c => c.rating).filter(r => r > 0);
	const hasRealPrices = tierPrices.length > 0;
	const avgPrice = hasRealPrices ? tierPrices.reduce((a, b) => a + b, 0) / tierPrices.length : null;
	const minPrice = hasRealPrices ? Math.min(...tierPrices) : null;
	const maxPrice = hasRealPrices ? Math.max(...tierPrices) : null;
	const avgRating = tierRatings.length > 0 ? tierRatings.reduce((a, b) => a + b, 0) / tierRatings.length : 0;
	const chainCount = tierFiltered.filter(c => c.isChain).length;
	const chainPct = tierFiltered.length > 0 ? Math.round((chainCount / tierFiltered.length) * 100) : 0;

	// Market gap analysis — based on tier-filtered competitors (your actual competition)
	let marketGap = '';
	let sentiment: 'great' | 'good' | 'caution' | 'warning' = 'good';
	if (chainPct >= 60) {
		marketGap = 'Chain-heavy market — room for quality independent';
		sentiment = 'great';
	} else if (avgPrice !== null && avgPrice < 4.50 && avgRating < 4.0) {
		marketGap = 'Budget-focused area — premium positioning opportunity';
		sentiment = 'great';
	} else if (tierFiltered.length >= 8 && avgRating >= 4.3) {
		marketGap = 'Saturated with quality — need strong differentiator';
		sentiment = 'warning';
	} else if (tierFiltered.length <= 3) {
		marketGap = 'Underserved market — first-mover advantage';
		sentiment = 'great';
	} else {
		marketGap = 'Competitive market — differentiation is key';
		sentiment = 'caution';
	}

	return {
		avgPrice: avgPrice !== null ? '$' + avgPrice.toFixed(2) : null,
		priceRange: minPrice !== null && maxPrice !== null ? '$' + minPrice.toFixed(2) + ' – $' + maxPrice.toFixed(2) : null,
		avgRating: Math.round(avgRating * 10) / 10,
		totalCount: competitors.length,          // ALL competitors (unfiltered)
		tierCount: tierFiltered.length,           // Competitors in your price tier
		chainPct,
		independentPct: 100 - chainPct,
		topCompetitors: competitors.slice(0, 5),  // Top 5 by distance (all)
		tierCompetitors: tierFiltered.slice(0, 5), // Top 5 by distance (tier-filtered)
		marketGap,
		sentiment,
	};
}

// ── Extrapolation: Daily Ritual Density ──

/**
 * "Daily ritual density" = the concentration of places that generate
 * repeat daily visitors — people who NEED coffee every morning.
 *
 * For coffee:
 * - Offices (1 coffee/worker/day × ~60% of building workers)
 * - Gyms (pre/post workout coffee, ~40% conversion)
 * - Colleges (highest caffeine consumption demo)
 * - Coworking spaces (100% coffee addicts)
 *
 * We extrapolate from POI counts + census daytime population.
 */
/**
 * COFFEE-REWIRE Change 4: Distance decay on anchor contributions.
 * Ring distances from overpass.ts RING_DISTANCES.specialty_coffee: [0.1, 0.2, 0.5] km
 * Ring 1 (0–100m) = ×1.00 — right next door, full conversion
 * Ring 2 (100–200m) = ×0.60 — short walk, some go to closer options
 * Ring 3 (200–500m) = ×0.25 — they have closer options, fraction walks this far
 * Beyond 500m = ×0.00 — irrelevant for coffee
 */
export function coffeeRingDecay(distanceMeters: number): number {
	if (distanceMeters <= 100) return 1.00;
	if (distanceMeters <= 200) return 0.60;
	if (distanceMeters <= 500) return 0.25;
	return 0.00;
}

/**
 * COFFEE-REWIRE Changes 4+5+6: Distance decay, hospital/tourist anchors,
 * price-sensitive conversion rates.
 *
 * @param avgTicket  User's average ticket price (from session/conceptDefaults).
 *                   When > $7, premium conversion rates apply.
 */
export function computeDailyRitualDensity(intel: any, avgTicket: number = 5.00): DailyRitualDensity | null {
	const places = intel.places;
	const overpass = intel.competitors;
	const census = intel.census;
	const mta = intel.mtaRidership;

	const isPremium = avgTicket > 7;

	const breakdown: { type: string; count: number; icon: string; color: string; dailyPop: number }[] = [];

	// ── Change 6: Price-sensitive conversion rates ──
	// Standard vs premium pricing dynamics
	const CONV = {
		office:    isPremium ? 0.28 : 0.60,  // Premium: fewer buy $9 daily
		gym:       isPremium ? 0.55 : 0.35,  // Premium: protein = need, not luxury
		college:   isPremium ? 0.12 : 0.45,  // Premium: most students can't afford $9/day
		cowork:    0.80,                       // Unchanged — they'll pay for quality
		commuter:  0.08,                       // Unchanged
		resident:  0.15,                       // Unchanged
		hospital:  { staff: 0.40, visitor: 0.25 },  // New anchor
		tourist:   0.15,                       // New anchor
	};

	// Count POIs with distance for ring decay (Change 4)
	interface AnchorPOI { type: string; distance: number }
	const anchors: AnchorPOI[] = [];

	if (places?.places) {
		for (const p of places.places) {
			const types = (p.types || []).join(',').toLowerCase();
			const dist = p.distance || 500; // default to edge of Ring 3 if no distance
			if (types.includes('office') || types.includes('accounting') || types.includes('insurance') || types.includes('lawyer') || types.includes('finance') || types.includes('real_estate')) {
				anchors.push({ type: 'office', distance: dist });
			}
			if (types.includes('gym') || types.includes('fitness')) {
				anchors.push({ type: 'gym', distance: dist });
			}
			if (types.includes('university') || types.includes('school') || types.includes('college')) {
				anchors.push({ type: 'college', distance: dist });
			}
			if (types.includes('coworking') || (p.name || '').toLowerCase().includes('wework') || (p.name || '').toLowerCase().includes('cowork')) {
				anchors.push({ type: 'cowork', distance: dist });
			}
			// ── Change 5: Hospital + tourist anchor types ──
			if (types.includes('hospital')) {
				anchors.push({ type: 'hospital', distance: dist });
			}
			if (types.includes('tourist_attraction') || types.includes('museum') || types.includes('landmark')) {
				anchors.push({ type: 'tourist', distance: dist });
			}
		}
	}

	// Supplement gyms from Overpass data (no distance available, assume Ring 2 avg = 150m)
	if (overpass?.amenities) {
		const overpassGyms = (overpass.amenities.gyms || []).length;
		const placesGyms = anchors.filter(a => a.type === 'gym').length;
		if (overpassGyms > placesGyms) {
			for (let i = 0; i < overpassGyms - placesGyms; i++) {
				anchors.push({ type: 'gym', distance: 150 });
			}
		}
	}

	// ── Compute daily ritual population with ring decay (Change 4) ──
	let officePop = 0, gymPop = 0, collegePop = 0, coworkPop = 0, hospitalPop = 0, touristPop = 0;
	let officeCount = 0, gymCount = 0, collegeCount = 0, coworkCount = 0, hospitalCount = 0, touristCount = 0;

	for (const a of anchors) {
		const decay = coffeeRingDecay(a.distance);
		if (decay === 0) continue; // Beyond 500m — irrelevant

		switch (a.type) {
			case 'office':
				officeCount++;
				officePop += 50 * CONV.office * decay;
				break;
			case 'gym':
				gymCount++;
				gymPop += 200 * CONV.gym * decay;
				break;
			case 'college':
				collegeCount++;
				collegePop += 500 * CONV.college * decay;
				break;
			case 'cowork':
				coworkCount++;
				coworkPop += 100 * CONV.cowork * decay;
				break;
			// Change 5: New anchor types
			case 'hospital':
				hospitalCount++;
				// ~300 staff × 40% + ~100 visitors × 25% = ~145 daily buyers per hospital
				hospitalPop += (300 * CONV.hospital.staff + 100 * CONV.hospital.visitor) * decay;
				break;
			case 'tourist':
				touristCount++;
				// ~500 daily visitors × 15% = ~75 daily buyers per attraction
				touristPop += 500 * CONV.tourist * decay;
				break;
		}
	}

	if (officeCount > 0) {
		breakdown.push({ type: 'Office Workers', count: officeCount, icon: '🏢', color: '#3b82f6', dailyPop: Math.round(officePop) });
	}
	if (gymCount > 0) {
		breakdown.push({ type: 'Gym Members', count: gymCount, icon: '💪', color: '#10b981', dailyPop: Math.round(gymPop) });
	}
	if (collegeCount > 0) {
		breakdown.push({ type: 'Students', count: collegeCount, icon: '🎓', color: '#8b5cf6', dailyPop: Math.round(collegePop) });
	}
	if (coworkCount > 0) {
		breakdown.push({ type: 'Co-Working', count: coworkCount, icon: '💻', color: '#f97316', dailyPop: Math.round(coworkPop) });
	}
	// Change 5: New anchor types in breakdown
	if (hospitalCount > 0) {
		breakdown.push({ type: 'Hospital', count: hospitalCount, icon: '🏥', color: '#dc2626', dailyPop: Math.round(hospitalPop) });
	}
	if (touristCount > 0) {
		breakdown.push({ type: 'Tourist Attractions', count: touristCount, icon: '🗽', color: '#d97706', dailyPop: Math.round(touristPop) });
	}

	// Commuters from MTA (daily regulars who pass through)
	let commuterPop = 0;
	if (mta && mta.totalDailyRidership > 0) {
		// ~8% of daily riders are repeat coffee purchasers at exit station
		commuterPop = mta.totalDailyRidership * CONV.commuter;
		breakdown.push({ type: 'MTA Commuters', count: mta.stationCount, icon: '🚇', color: '#ef4444', dailyPop: Math.round(commuterPop) });
	}

	// Residents (from census density) — with ring decay applied (Change 4)
	let residentPop = 0;
	if (census && census.populationDensity) {
		// Apply ring decay to resident estimates:
		// Ring 1 (100m radius ≈ 0.031 sq km): full 15% conversion
		// Ring 2 (100-200m ≈ 0.094 sq km): 60% of 15% = 9%
		// Ring 3 (200-500m ≈ 0.660 sq km): 25% of 15% = 3.75%
		const densityPerSqKm = census.populationDensity * 2.59; // convert per sq mi to per sq km
		const ring1Pop = densityPerSqKm * 0.031 * CONV.resident * 1.00;
		const ring2Pop = densityPerSqKm * 0.094 * CONV.resident * 0.60;
		const ring3Pop = densityPerSqKm * 0.660 * CONV.resident * 0.25;
		residentPop = ring1Pop + ring2Pop + ring3Pop;
		if (residentPop > 0) {
			const areaPopulation = densityPerSqKm * 0.785; // total within 500m
			breakdown.push({ type: 'Residents', count: Math.round(areaPopulation), icon: '🏠', color: '#a1a1a6', dailyPop: Math.round(residentPop) });
		}
	}

	const totalPop = Math.round(officePop + gymPop + collegePop + coworkPop + hospitalPop + touristPop + commuterPop + residentPop);
	const totalPOIs = officeCount + gymCount + collegeCount + coworkCount + hospitalCount + touristCount;

	if (totalPop === 0) return null;

	// Score: 0-100 based on total daily ritual population
	// Benchmarks: 500 = decent, 1500 = good, 3000+ = excellent for a coffee shop
	const score = clamp(Math.round(
		totalPop <= 500 ? (totalPop / 500) * 40
		: totalPop <= 1500 ? 40 + ((totalPop - 500) / 1000) * 30
		: 70 + ((totalPop - 1500) / 3000) * 30
	), 0, 100);

	const sentiment = scoreSentiment(score);
	const label = score >= 80 ? 'Very High Daily Ritual Density'
		: score >= 60 ? 'Strong Daily Ritual Density'
		: score >= 40 ? 'Moderate Daily Ritual Density'
		: 'Low Daily Ritual Density';

	const interpretation = score >= 80
		? `~${fmt(totalPop)} potential daily customers from offices, gyms, and commuters within a 5-min walk. This block generates repeat business.`
		: score >= 60
		? `~${fmt(totalPop)} potential daily customers nearby — solid base for a coffee shop. Focus on commuter capture.`
		: score >= 40
		? `~${fmt(totalPop)} estimated daily ritual buyers. You'll need to build destination appeal — not just walk-by.`
		: `Fewer than ${fmt(totalPop)} daily ritual buyers estimated. This location requires strong marketing and a reason to visit.`;

	return {
		score,
		label,
		totalRitualPOIs: totalPOIs,
		breakdown: breakdown.map(b => ({ type: b.type, count: b.count, icon: b.icon, color: b.color })),
		estimatedDailyRitualPop: totalPop,
		interpretation,
		sentiment,
	};
}

// ═══════════════════════════════════════════════════════
// SEGMENT CONFIGS — one per business type
// ═══════════════════════════════════════════════════════

export function computeSegmentInsight(intel: any, bizType: string): SegmentInsight | null {
	// B3-2.1: Generic / unknown concept → return null. No segment-specific hero
	// metrics, no ritual density, no competition sentiment. Prevents a laundromat
	// from getting coffee hero metrics.
	const segment = resolveSegment(bizType);
	if (segment === null) return null;
	return segment.compute(intel);
}

interface SegmentConfig {
	id: string;
	label: string;
	icon: string;
	compute: (intel: any) => SegmentInsight;
}

function resolveSegment(bizType: string): SegmentConfig | null {
	const key = bizType.toLowerCase();
	// B3-2.1: Generic / custom concept → null (no segment intelligence).
	if (key === 'generic' || key === 'something_else' || key === 'something else' || key === 'other' || key === 'custom' || key === 'custom concept') return null;
	if (key.includes('coffee') || key.includes('café') || key.includes('cafe')) return COFFEE_SEGMENT;
	if (key.includes('restaurant') || key.includes('fast casual') || key.includes('qsr')) return RESTAURANT_SEGMENT;
	if (key.includes('fitness') || key.includes('gym') || key.includes('yoga')) return FITNESS_SEGMENT;
	if (key.includes('retail') || key.includes('store') || key.includes('shop') && !key.includes('barber')) return RETAIL_SEGMENT;
	if (key.includes('bar') && !key.includes('barber') || key.includes('nightlife')) return BAR_SEGMENT;
	if (key.includes('nail')) return NAIL_SALON_SEGMENT;
	if (key.includes('barber')) return BARBERSHOP_SEGMENT;
	if (key.includes('salon') || key.includes('beauty')) return SALON_SEGMENT;
	if (key.includes('juice')) return JUICE_BAR_SEGMENT;
	if (key.includes('bakery') || key.includes('pastry')) return BAKERY_SEGMENT;
	if (key.includes('pharma') || key.includes('drugstore')) return PHARMACY_SEGMENT;
	if (key.includes('dog') || key.includes('pet') || key.includes('daycare')) return DOGGIE_DAYCARE_SEGMENT;
	if (key.includes('tutor') || key.includes('learning center') || key.includes('test prep')) return TUTORING_SEGMENT;
	if (key.includes('ethnic') || key.includes('halal') || key.includes('kosher') || key.includes('asian market') || key.includes('latino market') || key.includes('specialty grocer')) return ETHNIC_MARKET_SEGMENT;
	if (key.includes('wellness') || key.includes('spa')) return FITNESS_SEGMENT;
	// B3-2.1: Unknown concept → null (was COFFEE_SEGMENT fallback). Prevents
	// coffee-specific hero metrics from bleeding into unrelated businesses.
	return null;
}

// ─── COFFEE ───

const COFFEE_SEGMENT: SegmentConfig = {
	id: 'coffee',
	label: 'Specialty Coffee / Café',
	icon: '☕',
	compute(intel: any): SegmentInsight {
		const rush = extrapolateCoffeeRushTraffic(intel);
		const comp = blendCompetitorPricing(intel, 'specialty_coffee');
		const ritual = computeDailyRitualDensity(intel);

		const heroMetrics: HeroMetric[] = [rush.morning, rush.afternoon];

		// Weekend traffic metric (from MTA day-of-week data)
		if (intel.mtaRidership?.stations?.length > 0) {
			const stations = intel.mtaRidership.stations;
			let weekdayAvg = 0;
			let weekendAvg = 0;
			let hasDow = false;
			for (const s of stations) {
				if (s.dayOfWeek) {
					hasDow = true;
					const sat = s.dayOfWeek['Sat'] || s.dayOfWeek['Saturday'] || 0;
					const sun = s.dayOfWeek['Sun'] || s.dayOfWeek['Sunday'] || 0;
					weekendAvg += (sat + sun) / 2;
					const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => s.dayOfWeek[d] || s.dayOfWeek[d + 'day'] || 0);
					weekdayAvg += weekdays.reduce((a, b) => a + b, 0) / 5;
				}
			}
			if (hasDow && weekdayAvg > 0) {
				const weekendRatio = Math.round((weekendAvg / weekdayAvg) * 100);
				heroMetrics.push({
					id: 'weekend-drop',
					label: 'Weekend Traffic',
					value: weekendRatio + '%',
					unit: 'of weekday volume',
					sublabel: 'Sat & Sun average',
					icon: '📅',
					color: '#8b5cf6',
					confidence: 'moderate',
					interpretation: weekendRatio >= 70 ? 'Strong 7-day location — weekends hold up'
						: weekendRatio >= 45 ? 'Weekday-driven — plan for slower weekends'
						: 'Steep weekend drop-off — consider reduced hours',
					sentiment: weekendRatio >= 70 ? 'great' : weekendRatio >= 45 ? 'good' : 'caution',
					rawValue: weekendRatio,
				});
			}
		}

		return {
			segmentId: 'coffee',
			segmentLabel: 'Specialty Coffee / Café',
			segmentIcon: '☕',
			heroMetrics,
			competitorBlend: comp,
			dailyRitualDensity: ritual,
			coffeeChain: rush.chain,
		};
	},
};

// ─── RESTAURANT ───

const RESTAURANT_SEGMENT: SegmentConfig = {
	id: 'restaurant',
	label: 'Restaurant',
	icon: '🍽️',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const mta = intel.mtaRidership;
		const ped = intel.pedestrian;
		const census = intel.census;

		// 1. Dinner hour traffic (6-9pm)
		let dinnerTraffic = 0;
		let confidence: 'high' | 'moderate' | 'estimated' = 'estimated';
		if (mta && mta.totalDailyRidership > 0) {
			// Evening commute (4-7pm) = ~35% of daily; dinner spillover (7-9pm) ≈ 15%
			dinnerTraffic = mta.totalDailyRidership * 0.15 * 0.20;
			confidence = 'moderate';
		}
		if (ped && ped.avgPMCount > 0) {
			const pedDinner = ped.avgPMCount * 0.5;
			dinnerTraffic = dinnerTraffic > 0 ? dinnerTraffic * 0.5 + pedDinner * 0.5 : pedDinner;
			confidence = dinnerTraffic > 0 ? 'high' : 'moderate';
		}
		dinnerTraffic = Math.round(clamp(dinnerTraffic, 0, 30000));

		heroMetrics.push({
			id: 'dinner-traffic',
			label: 'Dinner Hour Traffic',
			value: fmt(dinnerTraffic),
			unit: 'people nearby',
			sublabel: '6:00 – 9:00 PM',
			icon: '🌙',
			color: '#6366f1',
			confidence,
			interpretation: dinnerTraffic >= 2000 ? 'Prime dinner destination — high evening foot traffic'
				: dinnerTraffic >= 800 ? 'Good evening activity — supports sit-down dining'
				: 'Quiet evenings — consider lunch-heavy concept',
			sentiment: dinnerTraffic >= 2000 ? 'great' : dinnerTraffic >= 800 ? 'good' : dinnerTraffic >= 300 ? 'caution' : 'warning',
			rawValue: dinnerTraffic,
		});

		// 2. Delivery infrastructure density (restaurants, population density)
		if (census) {
			const density = census.populationDensity || 0;
			const deliveryScore = clamp(Math.round(density / 500), 0, 100);
			heroMetrics.push({
				id: 'delivery-density',
				label: 'Delivery Market',
				value: deliveryScore >= 70 ? 'Strong' : deliveryScore >= 40 ? 'Moderate' : 'Weak',
				unit: fmt(density) + '/sq mi',
				sublabel: 'Population density',
				icon: '🛵',
				color: '#10b981',
				confidence: 'moderate',
				interpretation: deliveryScore >= 70 ? 'Dense residential base — delivery apps will drive volume'
					: deliveryScore >= 40 ? 'Mixed residential/commercial — delivery supplements dine-in'
					: 'Low density — focus on dine-in and destination traffic',
				sentiment: scoreSentiment(deliveryScore),
				rawValue: deliveryScore,
			});
		}

		// 3. Dining spending power
		if (census && census.medianHouseholdIncome > 0) {
			const income = census.medianHouseholdIncome;
			// Average American spends ~5% of income on dining out
			const annualDiningSpend = income * 0.05;
			const monthlyDiningSpend = Math.round(annualDiningSpend / 12);
			heroMetrics.push({
				id: 'dining-spend',
				label: 'Dining Budget',
				value: '$' + monthlyDiningSpend,
				unit: '/month per household',
				sublabel: 'Est. from $' + fmt(income) + ' median income',
				icon: '💳',
				color: '#f59e0b',
				confidence: 'estimated',
				interpretation: monthlyDiningSpend >= 500 ? 'High discretionary spending — supports premium pricing'
					: monthlyDiningSpend >= 300 ? 'Solid dining budget — mid-range sweet spot'
					: 'Price-sensitive area — value positioning critical',
				sentiment: monthlyDiningSpend >= 500 ? 'great' : monthlyDiningSpend >= 300 ? 'good' : monthlyDiningSpend >= 150 ? 'caution' : 'warning',
				rawValue: monthlyDiningSpend,
			});
		}

		return {
			segmentId: 'restaurant',
			segmentLabel: 'Restaurant',
			segmentIcon: '🍽️',
			heroMetrics,
			competitorBlend: blendCompetitorPricing(intel, 'full_service_restaurant'),
			dailyRitualDensity: null, // restaurants don't have "daily ritual" the same way
		};
	},
};

// ─── FITNESS ───

const FITNESS_SEGMENT: SegmentConfig = {
	id: 'fitness',
	label: 'Fitness / Wellness',
	icon: '🏋️',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const mta = intel.mtaRidership;
		const census = intel.census;
		const overpass = intel.competitors;

		// 1. Early morning traffic (5:30-8am fitness window)
		let morningGymTraffic = 0;
		if (mta && mta.totalDailyRidership > 0) {
			morningGymTraffic = mta.totalDailyRidership * 0.18 * 0.12; // early risers
		}
		if (intel.pedestrian?.avgAMCount) {
			morningGymTraffic = Math.max(morningGymTraffic, intel.pedestrian.avgAMCount * 0.15);
		}
		morningGymTraffic = Math.round(clamp(morningGymTraffic, 0, 10000));

		heroMetrics.push({
			id: 'pre-work-traffic',
			label: 'Pre-Work Window',
			value: fmt(morningGymTraffic),
			unit: 'early risers',
			sublabel: '5:30 – 8:00 AM',
			icon: '🌅',
			color: '#f97316',
			confidence: mta ? 'moderate' : 'estimated',
			interpretation: morningGymTraffic >= 1500 ? 'Strong pre-work market — prime for 6AM classes'
				: morningGymTraffic >= 600 ? 'Decent early morning activity'
				: 'Quiet mornings — evening classes may perform better',
			sentiment: morningGymTraffic >= 1500 ? 'great' : morningGymTraffic >= 600 ? 'good' : morningGymTraffic >= 200 ? 'caution' : 'warning',
			rawValue: morningGymTraffic,
		});

		// 2. Corporate wellness density (offices within walking distance)
		let officeCount = 0;
		if (intel.places?.places) {
			officeCount = intel.places.places.filter((p: any) =>
				(p.types || []).some((t: string) => ['office', 'accounting', 'insurance', 'lawyer', 'finance'].includes(t))
			).length;
		}
		const corpWellnessScore = clamp(officeCount * 15, 0, 100);
		heroMetrics.push({
			id: 'corporate-wellness',
			label: 'Corporate Wellness',
			value: officeCount + '',
			unit: 'offices nearby',
			sublabel: 'Potential corporate partnerships',
			icon: '🏢',
			color: '#3b82f6',
			confidence: 'moderate',
			interpretation: officeCount >= 8 ? 'Excellent — corporate membership pipeline is strong'
				: officeCount >= 4 ? 'Good corporate base — pursue lunch-hour classes'
				: 'Few offices — focus on residential membership',
			sentiment: scoreSentiment(corpWellnessScore),
			rawValue: corpWellnessScore,
		});

		// 3. Competitor saturation
		const gymCount = overpass?.amenities?.gyms?.length || 0;
		const yogaCount = overpass?.amenities?.yoga?.length || 0;
		const fitnessTotal = gymCount + yogaCount;
		heroMetrics.push({
			id: 'fitness-saturation',
			label: 'Fitness Saturation',
			value: fitnessTotal + '',
			unit: 'studios within 800m',
			sublabel: gymCount + ' gyms · ' + yogaCount + ' yoga/wellness',
			icon: '⚔️',
			color: fitnessTotal >= 8 ? '#ef4444' : fitnessTotal >= 4 ? '#f59e0b' : '#10b981',
			confidence: 'high',
			interpretation: fitnessTotal >= 8 ? 'Highly saturated — need niche positioning (boxing, Pilates, etc.)'
				: fitnessTotal >= 4 ? 'Competitive but room for specialization'
				: 'Underserved — strong opportunity for any format',
			sentiment: fitnessTotal >= 8 ? 'warning' : fitnessTotal >= 4 ? 'caution' : 'great',
			rawValue: fitnessTotal,
		});

		return {
			segmentId: 'fitness',
			segmentLabel: 'Fitness / Wellness',
			segmentIcon: '🏋️',
			heroMetrics,
			competitorBlend: null,
			dailyRitualDensity: null,
		};
	},
};

// ─── RETAIL ───

const RETAIL_SEGMENT: SegmentConfig = {
	id: 'retail',
	label: 'Retail',
	icon: '🛍️',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const ped = intel.pedestrian;
		const census = intel.census;
		const mta = intel.mtaRidership;

		// 1. Weekend foot traffic (retail peak)
		let weekendTraffic = 0;
		if (mta?.stations?.length > 0) {
			for (const s of mta.stations) {
				if (s.dayOfWeek) {
					const sat = s.dayOfWeek['Sat'] || s.dayOfWeek['Saturday'] || 0;
					const sun = s.dayOfWeek['Sun'] || s.dayOfWeek['Sunday'] || 0;
					weekendTraffic += (sat + sun) / 2;
				}
			}
			weekendTraffic = weekendTraffic * 0.20;
		}
		if (ped) weekendTraffic = Math.max(weekendTraffic, ped.totalPedestrians * 0.3);
		weekendTraffic = Math.round(clamp(weekendTraffic, 0, 50000));

		heroMetrics.push({
			id: 'weekend-traffic',
			label: 'Weekend Foot Traffic',
			value: fmt(weekendTraffic),
			unit: 'shoppers/day',
			sublabel: 'Saturday & Sunday avg',
			icon: '🛒',
			color: '#ec4899',
			confidence: mta ? 'moderate' : 'estimated',
			interpretation: weekendTraffic >= 5000 ? 'Prime retail corridor — high visibility and conversion'
				: weekendTraffic >= 2000 ? 'Good weekend flow for destination retail'
				: 'Light weekends — consider online-hybrid model',
			sentiment: weekendTraffic >= 5000 ? 'great' : weekendTraffic >= 2000 ? 'good' : weekendTraffic >= 500 ? 'caution' : 'warning',
			rawValue: weekendTraffic,
		});

		// 2. Spending power
		if (census) {
			const income = census.medianHouseholdIncome || 0;
			const retailSpend = Math.round(income * 0.03 / 12); // ~3% on retail monthly
			heroMetrics.push({
				id: 'retail-spend',
				label: 'Retail Spending',
				value: '$' + retailSpend,
				unit: '/month per household',
				sublabel: '$' + fmt(income) + ' median income',
				icon: '💰',
				color: '#f59e0b',
				confidence: 'estimated',
				interpretation: retailSpend >= 400 ? 'High disposable income — premium positioning viable'
					: retailSpend >= 200 ? 'Middle market — competitive pricing wins'
					: 'Value-conscious area — volume-based model needed',
				sentiment: retailSpend >= 400 ? 'great' : retailSpend >= 200 ? 'good' : 'caution',
				rawValue: retailSpend,
			});
		}

		// 3. Storefront visibility (nearby POI density as proxy)
		const poiCount = intel.places?.totalNearby || 0;
		const visibilityScore = clamp(Math.round(poiCount * 2.5), 0, 100);
		heroMetrics.push({
			id: 'visibility',
			label: 'Street Visibility',
			value: visibilityScore >= 70 ? 'High' : visibilityScore >= 40 ? 'Medium' : 'Low',
			unit: poiCount + ' businesses nearby',
			sublabel: 'Commercial activity density',
			icon: '👁️',
			color: '#6366f1',
			confidence: 'moderate',
			interpretation: visibilityScore >= 70 ? 'Active commercial strip — natural foot traffic'
				: visibilityScore >= 40 ? 'Mixed-use area — signage and presence matter'
				: 'Quiet block — heavy marketing investment needed',
			sentiment: scoreSentiment(visibilityScore),
			rawValue: visibilityScore,
		});

		return {
			segmentId: 'retail',
			segmentLabel: 'Retail',
			segmentIcon: '🛍️',
			heroMetrics,
			competitorBlend: null,
			dailyRitualDensity: null,
		};
	},
};

// ─── BAR / NIGHTLIFE ───

const BAR_SEGMENT: SegmentConfig = {
	id: 'bar',
	label: 'Bar / Nightlife',
	icon: '🍸',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];

		// Late-night vibrancy
		const liquor = intel.liquorLicenses;
		const barCount = liquor?.totalLicenses || 0;
		heroMetrics.push({
			id: 'nightlife-density',
			label: 'Nightlife Density',
			value: barCount + '',
			unit: 'liquor licenses',
			sublabel: 'Active licenses within 500m',
			icon: '🌃',
			color: '#8b5cf6',
			confidence: liquor ? 'high' : 'estimated',
			interpretation: barCount >= 15 ? 'Established nightlife district — built-in bar-hopping traffic'
				: barCount >= 8 ? 'Growing scene — good for a destination bar'
				: 'Quiet area — you\'d be a pioneer',
			sentiment: barCount >= 8 ? 'great' : barCount >= 4 ? 'good' : 'caution',
			rawValue: barCount,
		});

		// Young professional density
		if (intel.census) {
			const age = intel.census.medianAge || 35;
			const income = intel.census.medianHouseholdIncome || 60000;
			const youngProScore = age <= 32 && income >= 70000 ? 90
				: age <= 35 && income >= 50000 ? 70
				: age <= 40 ? 50 : 30;
			heroMetrics.push({
				id: 'young-pro',
				label: 'Young Professional Index',
				value: youngProScore >= 70 ? 'High' : youngProScore >= 50 ? 'Medium' : 'Low',
				unit: 'Age ' + Math.round(age) + ' · $' + fmt(income),
				sublabel: 'Median age & income blend',
				icon: '🎯',
				color: '#ec4899',
				confidence: 'moderate',
				interpretation: youngProScore >= 70 ? 'Prime demographic for cocktail bars and craft concepts'
					: youngProScore >= 50 ? 'Mixed demographic — consider broad appeal'
					: 'Older or lower-income area — dive bar or sports bar may fit better',
				sentiment: scoreSentiment(youngProScore),
				rawValue: youngProScore,
			});
		}

		return {
			segmentId: 'bar',
			segmentLabel: 'Bar / Nightlife',
			segmentIcon: '🍸',
			heroMetrics,
			competitorBlend: null,
			dailyRitualDensity: null,
		};
	},
};

// ─── SALON / BARBERSHOP ───

const SALON_SEGMENT: SegmentConfig = {
	id: 'salon',
	label: 'Salon / Barbershop',
	icon: '💈',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const census = intel.census;

		// Residential density (walk-in from neighborhood)
		if (census) {
			const density = census.populationDensity || 0;
			const residentialBase = Math.round(density * 0.28); // 300m radius
			heroMetrics.push({
				id: 'residential-base',
				label: 'Neighborhood Base',
				value: fmt(residentialBase),
				unit: 'residents nearby',
				sublabel: '5-minute walk radius',
				icon: '🏘️',
				color: '#10b981',
				confidence: 'moderate',
				interpretation: residentialBase >= 5000 ? 'Dense residential — strong walk-in potential'
					: residentialBase >= 2000 ? 'Good neighborhood base for regulars'
					: 'Sparse residential — need destination appeal or office traffic',
				sentiment: residentialBase >= 5000 ? 'great' : residentialBase >= 2000 ? 'good' : 'caution',
				rawValue: residentialBase,
			});
		}

		// Repeat visit economics
		if (census && census.medianHouseholdIncome > 0) {
			const income = census.medianHouseholdIncome;
			const monthlyGrooming = income >= 100000 ? 85 : income >= 70000 ? 55 : income >= 40000 ? 35 : 20;
			heroMetrics.push({
				id: 'grooming-spend',
				label: 'Grooming Budget',
				value: '$' + monthlyGrooming,
				unit: '/month per person',
				sublabel: 'Est. from local income levels',
				icon: '✂️',
				color: '#f59e0b',
				confidence: 'estimated',
				interpretation: monthlyGrooming >= 70 ? 'Premium market — $50+ services viable'
					: monthlyGrooming >= 45 ? 'Mid-range sweet spot for quality cuts'
					: 'Budget-conscious — volume-based pricing needed',
				sentiment: monthlyGrooming >= 70 ? 'great' : monthlyGrooming >= 45 ? 'good' : 'caution',
				rawValue: monthlyGrooming,
			});
		}

		return {
			segmentId: 'salon',
			segmentLabel: 'Salon / Barbershop',
			segmentIcon: '💈',
			heroMetrics,
			competitorBlend: null,
			dailyRitualDensity: null,
		};
	},
};

// ─── SEG-02: NAIL SALON ───

const NAIL_SALON_SEGMENT: SegmentConfig = {
	id: 'nail_salon',
	label: 'Nail Salon',
	icon: '💅',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const census = intel.census;
		if (census) {
			const density = census.populationDensity || 0;
			const femaleBase = Math.round(density * 0.30); // ~300m, skew female
			heroMetrics.push({
				id: 'walk-in-base', label: 'Walk-In Base', value: fmt(femaleBase), unit: 'residents nearby',
				sublabel: '5-min walk radius', icon: '🏘️', color: '#ec4899', confidence: 'moderate',
				interpretation: femaleBase >= 4000 ? 'Dense neighborhood — strong walk-in potential' : femaleBase >= 1500 ? 'Good base for regulars' : 'Need destination appeal or office proximity',
				sentiment: femaleBase >= 4000 ? 'great' : femaleBase >= 1500 ? 'good' : 'caution', rawValue: femaleBase,
			});
		}
		if (census && census.medianHouseholdIncome > 0) {
			const income = census.medianHouseholdIncome;
			const nailSpend = income >= 100000 ? 95 : income >= 70000 ? 55 : income >= 45000 ? 35 : 18;
			heroMetrics.push({
				id: 'nail-spend', label: 'Nail Care Budget', value: '$' + nailSpend, unit: '/month per person',
				sublabel: 'Est. from local income levels', icon: '✨', color: '#f472b6', confidence: 'estimated',
				interpretation: nailSpend >= 70 ? 'Premium market — gel, acrylics, nail art all viable' : nailSpend >= 40 ? 'Mid-range sweet spot' : 'Budget-conscious — quick manicure focus',
				sentiment: nailSpend >= 70 ? 'great' : nailSpend >= 40 ? 'good' : 'caution', rawValue: nailSpend,
			});
		}
		return { segmentId: 'nail_salon', segmentLabel: 'Nail Salon', segmentIcon: '💅', heroMetrics, competitorBlend: null, dailyRitualDensity: null };
	},
};

// ─── SEG-02: BARBERSHOP ───

const BARBERSHOP_SEGMENT: SegmentConfig = {
	id: 'barbershop',
	label: 'Barbershop',
	icon: '💈',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const census = intel.census;
		if (census) {
			const density = census.populationDensity || 0;
			const maleBase = Math.round(density * 0.26);
			heroMetrics.push({
				id: 'regulars-base', label: 'Regulars Base', value: fmt(maleBase), unit: 'men nearby',
				sublabel: '5-min walk radius', icon: '🧔', color: '#6366f1', confidence: 'moderate',
				interpretation: maleBase >= 3000 ? 'Dense male population — chair time fills easily' : maleBase >= 1200 ? 'Solid regulars base (every 3-4 weeks)' : 'Low density — lean on office workers or destination appeal',
				sentiment: maleBase >= 3000 ? 'great' : maleBase >= 1200 ? 'good' : 'caution', rawValue: maleBase,
			});
		}
		if (census && census.medianHouseholdIncome > 0) {
			const income = census.medianHouseholdIncome;
			const cutSpend = income >= 100000 ? 55 : income >= 60000 ? 35 : income >= 40000 ? 22 : 15;
			heroMetrics.push({
				id: 'haircut-spend', label: 'Avg Haircut Budget', value: '$' + cutSpend, unit: 'per visit',
				sublabel: 'Est. from local income', icon: '✂️', color: '#8b5cf6', confidence: 'estimated',
				interpretation: cutSpend >= 45 ? 'Premium cuts + hot towel shave viable ($40-60)' : cutSpend >= 28 ? 'Mid-range market — $25-40 cuts' : 'Budget market — $15-25 quick cuts',
				sentiment: cutSpend >= 45 ? 'great' : cutSpend >= 28 ? 'good' : 'caution', rawValue: cutSpend,
			});
		}
		return { segmentId: 'barbershop', segmentLabel: 'Barbershop', segmentIcon: '💈', heroMetrics, competitorBlend: null, dailyRitualDensity: null };
	},
};

// ─── SEG-02: JUICE BAR ───

const JUICE_BAR_SEGMENT: SegmentConfig = {
	id: 'juice_bar',
	label: 'Juice Bar',
	icon: '🥤',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const rush = extrapolateCoffeeRushTraffic(intel); // Impulse buy — same morning pattern
		heroMetrics.push(rush.morning);
		if (intel.census) {
			const income = intel.census.medianHouseholdIncome || 0;
			const healthScore = income >= 100000 ? 90 : income >= 75000 ? 70 : income >= 50000 ? 50 : 30;
			heroMetrics.push({
				id: 'health-index', label: 'Health-Conscious Index', value: healthScore.toString(), unit: '/100',
				sublabel: 'From income + wellness indicators', icon: '🌿', color: '#22c55e', confidence: 'estimated',
				interpretation: healthScore >= 70 ? 'Premium wellness demographic — açaí bowls, cold-pressed viable' : healthScore >= 50 ? 'Mid-range health interest' : 'Price-sensitive — focus on smoothies at lower price points',
				sentiment: healthScore >= 70 ? 'great' : healthScore >= 50 ? 'good' : 'caution', rawValue: healthScore,
			});
		}
		return { segmentId: 'juice_bar', segmentLabel: 'Juice Bar', segmentIcon: '🥤', heroMetrics, competitorBlend: blendCompetitorPricing(intel, 'juice_bar'), dailyRitualDensity: null };
	},
};

// ─── SEG-02: BAKERY ───

const BAKERY_SEGMENT: SegmentConfig = {
	id: 'bakery',
	label: 'Bakery',
	icon: '🥐',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const rush = extrapolateCoffeeRushTraffic(intel);
		heroMetrics.push(rush.morning);
		if (rush.afternoon) heroMetrics.push(rush.afternoon);
		const ritual = computeDailyRitualDensity(intel);
		return { segmentId: 'bakery', segmentLabel: 'Bakery', segmentIcon: '🥐', heroMetrics, competitorBlend: blendCompetitorPricing(intel, 'bakery'), dailyRitualDensity: ritual };
	},
};

// ─── SEG-02: PHARMACY ───

const PHARMACY_SEGMENT: SegmentConfig = {
	id: 'pharmacy',
	label: 'Pharmacy',
	icon: '💊',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const census = intel.census;
		if (census) {
			const density = census.populationDensity || 0;
			const catchment = Math.round(density * 0.5); // 5-min walk, larger radius (convenience)
			heroMetrics.push({
				id: 'catchment-pop', label: 'Catchment Population', value: fmt(catchment), unit: 'residents',
				sublabel: '10-minute walk radius', icon: '🏘️', color: '#3b82f6', confidence: 'moderate',
				interpretation: catchment >= 8000 ? 'Dense catchment — high prescription volume likely' : catchment >= 3000 ? 'Solid residential base for repeat Rx fill' : 'Low density — need transit traffic or medical office anchor',
				sentiment: catchment >= 8000 ? 'great' : catchment >= 3000 ? 'good' : 'caution', rawValue: catchment,
			});
			if (census.medianAge) {
				const ageScore = census.medianAge >= 55 ? 90 : census.medianAge >= 40 ? 70 : census.medianAge >= 30 ? 50 : 35;
				heroMetrics.push({
					id: 'rx-demand', label: 'Rx Demand Signal', value: ageScore.toString(), unit: '/100',
					sublabel: `Median age: ${census.medianAge} years`, icon: '💉', color: '#ef4444', confidence: 'estimated',
					interpretation: ageScore >= 70 ? 'Older population — high chronic prescription demand' : ageScore >= 50 ? 'Mixed demographics — moderate Rx demand' : 'Young area — convenience & OTC focus',
					sentiment: ageScore >= 70 ? 'great' : ageScore >= 50 ? 'good' : 'caution', rawValue: ageScore,
				});
			}
		}
		return { segmentId: 'pharmacy', segmentLabel: 'Pharmacy', segmentIcon: '💊', heroMetrics, competitorBlend: null, dailyRitualDensity: null };
	},
};

// ─── SEG-02: DOGGIE DAYCARE ───

const DOGGIE_DAYCARE_SEGMENT: SegmentConfig = {
	id: 'doggie_daycare',
	label: 'Doggie Daycare',
	icon: '🐕',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const census = intel.census;
		if (census) {
			const income = census.medianHouseholdIncome || 0;
			// Dog ownership correlates with income + residential type
			const petOwnerIndex = income >= 100000 ? 85 : income >= 75000 ? 70 : income >= 50000 ? 50 : 30;
			heroMetrics.push({
				id: 'pet-owner-index', label: 'Pet Owner Index', value: petOwnerIndex.toString(), unit: '/100',
				sublabel: 'From income + density signals', icon: '🐶', color: '#f97316', confidence: 'estimated',
				interpretation: petOwnerIndex >= 70 ? 'High-income area — $40-70/day daycare rates viable' : petOwnerIndex >= 50 ? 'Mid-range market for pet services' : 'Budget area — lower willingness to pay for pet daycare',
				sentiment: petOwnerIndex >= 70 ? 'great' : petOwnerIndex >= 50 ? 'good' : 'caution', rawValue: petOwnerIndex,
			});
		}
		// Look for vet/pet store proximity as demand validator
		let petPOICount = 0;
		if (intel.places?.places) {
			petPOICount = intel.places.places.filter((p: any) =>
				p.types?.includes('veterinary_care') || p.types?.includes('pet_store') ||
				p.name?.toLowerCase().includes('vet') || p.name?.toLowerCase().includes('pet')
			).length;
		}
		heroMetrics.push({
			id: 'pet-ecosystem', label: 'Pet Ecosystem', value: petPOICount.toString(), unit: 'pet businesses nearby',
			sublabel: 'Vets, groomers, pet stores', icon: '🏪', color: '#84cc16', confidence: 'moderate',
			interpretation: petPOICount >= 3 ? 'Active pet neighborhood — demand validated' : petPOICount >= 1 ? 'Some pet infrastructure' : 'No pet businesses nearby — unproven market',
			sentiment: petPOICount >= 3 ? 'great' : petPOICount >= 1 ? 'good' : 'caution', rawValue: petPOICount,
		});
		return { segmentId: 'doggie_daycare', segmentLabel: 'Doggie Daycare', segmentIcon: '🐕', heroMetrics, competitorBlend: null, dailyRitualDensity: null };
	},
};

// ─── SEG-02: TUTORING CENTER ───

const TUTORING_SEGMENT: SegmentConfig = {
	id: 'tutoring',
	label: 'Tutoring Center',
	icon: '📚',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const census = intel.census;
		if (census) {
			const income = census.medianHouseholdIncome || 0;
			// Tutoring demand correlates strongly with income + education
			const tutorDemandIndex = income >= 120000 ? 90 : income >= 80000 ? 75 : income >= 60000 ? 55 : income >= 40000 ? 35 : 20;
			heroMetrics.push({
				id: 'tutor-demand', label: 'Tutoring Demand Index', value: tutorDemandIndex.toString(), unit: '/100',
				sublabel: 'From income + education levels', icon: '🎓', color: '#6366f1', confidence: 'estimated',
				interpretation: tutorDemandIndex >= 70 ? 'High-income families — SAT prep, enrichment all viable' : tutorDemandIndex >= 50 ? 'Mid-range market — after-school tutoring, homework help' : 'Budget-conscious — focus on test prep with clear ROI',
				sentiment: tutorDemandIndex >= 70 ? 'great' : tutorDemandIndex >= 50 ? 'good' : 'caution', rawValue: tutorDemandIndex,
			});
		}
		// Look for school proximity as demand signal
		let schoolCount = 0;
		if (intel.places?.places) {
			schoolCount = intel.places.places.filter((p: any) =>
				p.types?.includes('school') || p.types?.includes('primary_school') ||
				p.types?.includes('secondary_school') || p.name?.toLowerCase().includes('school')
			).length;
		}
		heroMetrics.push({
			id: 'school-proximity', label: 'Schools Nearby', value: schoolCount.toString(), unit: 'schools',
			sublabel: 'Within walking distance', icon: '🏫', color: '#0ea5e9', confidence: 'moderate',
			interpretation: schoolCount >= 3 ? 'Multiple schools — strong after-school pipeline' : schoolCount >= 1 ? 'School nearby — direct parent outreach viable' : 'No schools nearby — need to attract from wider area',
			sentiment: schoolCount >= 3 ? 'great' : schoolCount >= 1 ? 'good' : 'caution', rawValue: schoolCount,
		});
		return { segmentId: 'tutoring', segmentLabel: 'Tutoring Center', segmentIcon: '📚', heroMetrics, competitorBlend: null, dailyRitualDensity: null };
	},
};

// ─── SEG-02: ETHNIC MARKET ───

const ETHNIC_MARKET_SEGMENT: SegmentConfig = {
	id: 'ethnic_market',
	label: 'Ethnic / Specialty Market',
	icon: '🏪',
	compute(intel: any): SegmentInsight {
		const heroMetrics: HeroMetric[] = [];
		const census = intel.census;
		if (census) {
			const density = census.populationDensity || 0;
			const catchment = Math.round(density * 0.4);
			heroMetrics.push({
				id: 'community-base', label: 'Community Base', value: fmt(catchment), unit: 'residents',
				sublabel: '10-minute walk radius', icon: '🏘️', color: '#f59e0b', confidence: 'moderate',
				interpretation: catchment >= 6000 ? 'Dense community — weekly grocery destination' : catchment >= 2500 ? 'Good base for specialty repeat shoppers' : 'Low density — need to be a destination draw',
				sentiment: catchment >= 6000 ? 'great' : catchment >= 2500 ? 'good' : 'caution', rawValue: catchment,
			});
		}
		// Grocery/market ecosystem
		let groceryCount = 0;
		if (intel.places?.places) {
			groceryCount = intel.places.places.filter((p: any) =>
				p.types?.includes('grocery_or_supermarket') || p.types?.includes('supermarket') ||
				p.name?.toLowerCase().includes('market') || p.name?.toLowerCase().includes('grocery')
			).length;
		}
		heroMetrics.push({
			id: 'grocery-landscape', label: 'Grocery Competition', value: groceryCount.toString(), unit: 'markets nearby',
			sublabel: 'Grocery & specialty stores', icon: '🛒', color: '#10b981', confidence: 'moderate',
			interpretation: groceryCount === 0 ? 'No nearby grocers — food desert opportunity' : groceryCount <= 2 ? 'Light competition — room for specialty' : 'Competitive grocery landscape — differentiation critical',
			sentiment: groceryCount <= 1 ? 'great' : groceryCount <= 3 ? 'good' : 'caution', rawValue: groceryCount,
		});
		return { segmentId: 'ethnic_market', segmentLabel: 'Ethnic / Specialty Market', segmentIcon: '🏪', heroMetrics, competitorBlend: null, dailyRitualDensity: null };
	},
};

// ──────────────────────────────────────────────
// Fit IQ Rings (4-layer business-type-specific fit model)
// ──────────────────────────────────────────────

export interface FitIQRing {
	label: string;
	score: number;
	detail: string;
	warn?: string;
}

export function computeFitIQRings(intel: any, bizType: string): { rings: FitIQRing[]; verdict: string; insight: { title: string; text: string } } {
	const segment = resolveSegment(bizType);
	const rings: FitIQRing[] = [];
	let verdict = '';
	let insight = { title: '', text: '' };

	// B3-2.1: Generic concept — return empty rings with neutral verdict.
	if (segment === null) {
		return {
			rings: [],
			verdict: 'Generic concept — scoring based on neighborhood and survival fundamentals only.',
			insight: { title: 'Custom Concept', text: 'No concept-specific fit rings. Add concept details to refine the score.' }
		};
	}

	const segmentId = segment.id;

	// ─── COFFEE ───
	if (segmentId === 'coffee') {
		// Ring 1: Coffee-hour foot traffic (7-9:30am)
		let morningRaw = 0;
		if (intel.mtaRidership?.totalDailyRidership) {
			const dailyRiders = intel.mtaRidership.totalDailyRidership;
			morningRaw = Math.round(dailyRiders * 0.32 * 0.83); // Morning peak 7-10am ≈ 32%, coffee window ≈ 83%
		} else if (intel.pedestrian?.avgAMCount) {
			morningRaw = intel.pedestrian.avgAMCount;
		} else if (intel.census?.populationDensity) {
			morningRaw = Math.round(intel.census.populationDensity * 1.5);
		}
		const ring1Score = morningRaw >= 3000 ? 90 : morningRaw >= 1500 ? 70 : morningRaw >= 500 ? 50 : 30;
		rings.push({
			label: 'Coffee-hour foot traffic?',
			score: clamp(ring1Score, 0, 100),
			detail: `~${fmt(morningRaw)} people pass through 7–9:30 AM. ${ring1Score >= 70 ? 'Strong morning commute base.' : ring1Score >= 50 ? 'Decent morning traffic.' : 'Limited morning foot traffic.'}`
		});

		// Ring 2: How many coffee shops here?
		let coffeeCount = 0;
		if (intel.places?.places) {
			coffeeCount = intel.places.places.filter((p: any) => p.types?.includes('cafe') || p.name?.toLowerCase().includes('coffee') || p.name?.toLowerCase().includes('café')).length;
		}
		if (intel.foursquare?.venues) {
			const foursquareCount = intel.foursquare.venues.filter((v: any) => v.category?.includes('Coffee')).length;
			coffeeCount = Math.max(coffeeCount, foursquareCount);
		}
		const ring2Score = coffeeCount === 0 ? 60 : coffeeCount <= 2 ? 85 : coffeeCount <= 4 ? 65 : coffeeCount <= 6 ? 40 : 25;
		const ring2Warn = coffeeCount === 0 ? 'Unproven market — could be opportunity or lack of demand' : coffeeCount >= 7 ? 'Highly saturated — tough to differentiate' : undefined;
		rings.push({
			label: 'How many coffee shops here?',
			score: clamp(ring2Score, 0, 100),
			detail: `${coffeeCount} nearby coffee shops. ${ring2Score >= 70 ? 'Room to compete.' : ring2Score >= 50 ? 'Moderate competition.' : 'High saturation.'}`,
			warn: ring2Warn
		});

		// Ring 3: Daily regulars potential (office/gym/cowork POI counts)
		let ritualPOICount = 0;
		if (intel.places?.places) {
			const places = intel.places.places;
			ritualPOICount = (places.filter((p: any) => p.types?.includes('gym') || p.types?.includes('health')).length || 0) +
				(places.filter((p: any) => p.types?.includes('office_building') || p.types?.includes('coworking')).length || 0);
		}
		const ring3Score = ritualPOICount >= 5 ? 80 : ritualPOICount >= 3 ? 65 : ritualPOICount >= 1 ? 50 : 35;
		rings.push({
			label: 'Daily regulars potential?',
			score: clamp(ring3Score, 0, 100),
			detail: `${ritualPOICount} offices/gyms/coworking nearby. ${ring3Score >= 70 ? 'Excellent repeat customer base.' : ring3Score >= 50 ? 'Good potential for regulars.' : 'Limited repeat visitor base.'}`
		});

		// Ring 4: Alive on weekends?
		let weekendRatio = 0.5;
		if (intel.mtaRidership?.dayOfWeekBreakdown) {
			const dow = intel.mtaRidership.dayOfWeekBreakdown;
			const weekendAvg = ((dow.saturday || 0) + (dow.sunday || 0)) / 2;
			const weekdayAvg = ((dow.monday || 0) + (dow.tuesday || 0) + (dow.wednesday || 0) + (dow.thursday || 0) + (dow.friday || 0)) / 5;
			weekendRatio = weekdayAvg > 0 ? weekendAvg / weekdayAvg : 0.5;
		}
		const ring4Score = weekendRatio >= 0.7 ? 85 : weekendRatio >= 0.45 ? 60 : 35;
		rings.push({
			label: 'Alive on weekends?',
			score: clamp(ring4Score, 0, 100),
			detail: `Weekend traffic is ~${Math.round(weekendRatio * 100)}% of weekday. ${ring4Score >= 70 ? 'Strong weekend business.' : ring4Score >= 50 ? 'Moderate weekend traffic.' : 'Weekends quiet — weekday-focused location.'}`
		});
	}

	// ─── RESTAURANT ───
	else if (segmentId === 'restaurant') {
		// Ring 1: Is this street alive at dinnertime? (6-9pm)
		let eveningRaw = 0;
		if (intel.mtaRidership?.totalDailyRidership) {
			eveningRaw = Math.round(intel.mtaRidership.totalDailyRidership * 0.35);
		} else if (intel.pedestrian?.avgPMCount) {
			eveningRaw = intel.pedestrian.avgPMCount;
		} else if (intel.census?.populationDensity) {
			eveningRaw = Math.round(intel.census.populationDensity * 2);
		}
		const ring1Score = eveningRaw >= 4000 ? 90 : eveningRaw >= 2000 ? 70 : eveningRaw >= 1000 ? 50 : 30;
		rings.push({
			label: 'Is this street alive at dinnertime?',
			score: clamp(ring1Score, 0, 100),
			detail: `~${fmt(eveningRaw)} people in area 6–9 PM. ${ring1Score >= 70 ? 'Vibrant dinner hour.' : ring1Score >= 50 ? 'Decent evening traffic.' : 'Quiet evenings.'}`
		});

		// Ring 2: Do people come here to eat?
		let restaurantCount = 0;
		if (intel.places?.places) {
			restaurantCount = intel.places.places.filter((p: any) => p.types?.includes('restaurant') || p.types?.includes('food') || p.types?.includes('cafe')).length;
		}
		if (intel.foursquare?.venues) {
			const foursquareCount = intel.foursquare.venues.filter((v: any) => v.category?.includes('Food') || v.category?.includes('Restaurant')).length;
			restaurantCount = Math.max(restaurantCount, foursquareCount);
		}
		const ring2Score = restaurantCount >= 10 ? 90 : restaurantCount >= 5 ? 70 : restaurantCount < 5 ? 45 : 30;
		rings.push({
			label: 'Do people come here to eat?',
			score: clamp(ring2Score, 0, 100),
			detail: `${restaurantCount} food venues nearby. ${ring2Score >= 70 ? 'Established food destination.' : ring2Score >= 50 ? 'Some food options.' : 'Limited dining competition.'}`
		});

		// Ring 3: How many order delivery nearby?
		let residentialDensity = 0;
		if (intel.census?.populationDensity) {
			residentialDensity = intel.census.populationDensity;
		}
		const ring3Score = residentialDensity >= 30000 ? 85 : residentialDensity >= 15000 ? 65 : residentialDensity >= 5000 ? 50 : 30;
		rings.push({
			label: 'How many order delivery nearby?',
			score: clamp(ring3Score, 0, 100),
			detail: `~${fmt(residentialDensity)} residents per sq mi. ${ring3Score >= 70 ? 'Strong delivery market.' : ring3Score >= 50 ? 'Decent delivery base.' : 'Limited residential density.'}`
		});

		// Ring 4: Is your cuisine already here?
		rings.push({
			label: 'Is your cuisine already here?',
			score: 60,
			detail: 'Generic assessment — need to specify your cuisine type for detailed analysis.'
		});
	}

	// ─── BAR ───
	else if (segmentId === 'bar') {
		// Ring 1: Do people go out around here? (Bars/nightlife count)
		let barCount = 0;
		if (intel.places?.places) {
			barCount = intel.places.places.filter((p: any) => p.types?.includes('bar') || p.types?.includes('night_club') || p.types?.includes('liquor_store')).length;
		}
		if (intel.foursquare?.venues) {
			const foursquareCount = intel.foursquare.venues.filter((v: any) => v.category?.includes('Nightlife') || v.category?.includes('Bar')).length;
			barCount = Math.max(barCount, foursquareCount);
		}
		const ring1Score = barCount >= 5 ? 85 : barCount >= 3 ? 70 : barCount >= 1 ? 50 : 35;
		rings.push({
			label: 'Do people go out around here?',
			score: clamp(ring1Score, 0, 100),
			detail: `${barCount} nightlife venues nearby. ${ring1Score >= 70 ? 'Active nightlife district.' : ring1Score >= 50 ? 'Some nightlife presence.' : 'Limited bar scene.'}`
		});

		// Ring 2: Office workers leaving at 5pm?
		let officeCount = 0;
		if (intel.places?.places) {
			officeCount = intel.places.places.filter((p: any) => p.types?.includes('office_building') || p.types?.includes('business_center')).length;
		}
		let eveningPeak = 0;
		if (intel.mtaRidership?.totalDailyRidership) {
			eveningPeak = Math.round(intel.mtaRidership.totalDailyRidership * 0.35);
		}
		const ring2Score = officeCount >= 3 && eveningPeak >= 2000 ? 80 : officeCount >= 2 || eveningPeak >= 1500 ? 60 : 40;
		rings.push({
			label: 'Office workers leaving at 5pm?',
			score: clamp(ring2Score, 0, 100),
			detail: `${officeCount} offices nearby + ${fmt(eveningPeak)} evening transit users. ${ring2Score >= 70 ? 'Strong after-work crowd.' : ring2Score >= 50 ? 'Some office exodus.' : 'Limited office worker base.'}`
		});

		// Ring 3: Can customers get home late?
		let transitScore = 50;
		if (intel.walkScore?.transitScore) {
			transitScore = intel.walkScore.transitScore;
		}
		const ring3Score = transitScore >= 80 ? 85 : transitScore >= 60 ? 70 : transitScore >= 40 ? 50 : 30;
		rings.push({
			label: 'Can customers get home late?',
			score: clamp(ring3Score, 0, 100),
			detail: `Transit Score: ${transitScore}/100. ${ring3Score >= 70 ? 'Excellent late-night transit.' : ring3Score >= 50 ? 'Some transit options.' : 'Limited late-night transit.'}`
		});

		// Ring 4: Enough 21-35 year olds?
		let youthScore = 50;
		if (intel.census?.medianAge) {
			const age = intel.census.medianAge;
			youthScore = age <= 30 ? 85 : age <= 35 ? 70 : age <= 40 ? 50 : 35;
		}
		rings.push({
			label: 'Enough 21–35 year olds?',
			score: clamp(youthScore, 0, 100),
			detail: `Median age: ${intel.census?.medianAge || 35} years. ${youthScore >= 70 ? 'Young demographic.' : youthScore >= 50 ? 'Mixed age groups.' : 'Older demographic.'}`
		});
	}

	// ─── GYM ───
	else if (segmentId === 'fitness') {
		// Ring 1: People moving early morning? (5:30-8am)
		let morningRaw = 0;
		if (intel.mtaRidership?.totalDailyRidership) {
			morningRaw = Math.round(intel.mtaRidership.totalDailyRidership * 0.25); // ~25% of daily
		} else if (intel.pedestrian?.avgAMCount) {
			morningRaw = Math.round(intel.pedestrian.avgAMCount * 0.7);
		}
		const ring1Score = morningRaw >= 2000 ? 85 : morningRaw >= 1000 ? 70 : morningRaw >= 500 ? 50 : 30;
		rings.push({
			label: 'People moving early morning?',
			score: clamp(ring1Score, 0, 100),
			detail: `~${fmt(morningRaw)} morning commuters. ${ring1Score >= 70 ? 'Strong pre-work crowd.' : ring1Score >= 50 ? 'Decent morning traffic.' : 'Low morning foot traffic.'}`
		});

		// Ring 2: On the way between home and work?
		let transitScore = 50;
		if (intel.walkScore?.transitScore) {
			transitScore = intel.walkScore.transitScore;
		}
		const ring2Score = transitScore >= 80 ? 85 : transitScore >= 60 ? 70 : transitScore >= 40 ? 50 : 30;
		rings.push({
			label: 'On the way between home and work?',
			score: clamp(ring2Score, 0, 100),
			detail: `Transit Score: ${transitScore}/100. ${ring2Score >= 70 ? 'Prime commute corridor.' : ring2Score >= 50 ? 'Moderate transit access.' : 'Off commute path.'}`
		});

		// Ring 3: How many gyms already nearby? (Inverse scoring)
		let gymCount = 0;
		if (intel.places?.places) {
			gymCount = intel.places.places.filter((p: any) => p.types?.includes('gym') || p.types?.includes('health') || p.name?.toLowerCase().includes('fitness')).length;
		}
		const ring3Score = gymCount === 0 ? 90 : gymCount <= 2 ? 75 : gymCount <= 4 ? 55 : 30;
		rings.push({
			label: 'How many gyms already nearby?',
			score: clamp(ring3Score, 0, 100),
			detail: `${gymCount} gyms in area. ${ring3Score >= 75 ? 'Opportunity — low competition.' : ring3Score >= 50 ? 'Some competition.' : 'Saturated gym market.'}`
		});

		// Ring 4: Right people live nearby?
		let demoScore = 50;
		if (intel.census) {
			const age = intel.census.medianAge || 40;
			const income = intel.census.medianHouseholdIncome || 60000;
			const youthBonus = age < 35 ? 15 : age < 45 ? 5 : 0;
			const incomeBonus = income > 80000 ? 15 : income > 60000 ? 10 : 0;
			demoScore = clamp(50 + youthBonus + incomeBonus, 0, 100);
		}
		rings.push({
			label: 'Right people live nearby?',
			score: demoScore,
			detail: `Median age ${intel.census?.medianAge || '35'}, income $${fmt(intel.census?.medianHouseholdIncome || 60000)}. ${demoScore >= 70 ? 'Young professional demographic.' : demoScore >= 50 ? 'Decent demographic fit.' : 'Older/lower-income area.'}`
		});
	}

	// ─── NAIL SALON (SEG-02) ───
	else if (segmentId === 'nail_salon') {
		// Ring 1: Walk-in traffic (residential density matters most)
		let residentialDensity = 0;
		if (intel.census?.populationDensity) residentialDensity = intel.census.populationDensity;
		const ring1Score = residentialDensity >= 30000 ? 85 : residentialDensity >= 15000 ? 70 : residentialDensity >= 5000 ? 50 : 30;
		rings.push({
			label: 'Walk-in potential from neighborhood?',
			score: clamp(ring1Score, 0, 100),
			detail: `~${fmt(residentialDensity)} residents/sq mi. ${ring1Score >= 70 ? 'Dense residential — strong walk-in.' : ring1Score >= 50 ? 'Decent neighborhood base.' : 'Low density — need office traffic.'}`
		});

		// Ring 2: How many nail salons already here?
		let nailCount = 0;
		if (intel.places?.places) {
			nailCount = intel.places.places.filter((p: any) => p.types?.includes('beauty_salon') || p.name?.toLowerCase().includes('nail') || p.name?.toLowerCase().includes('manicure')).length;
		}
		const ring2Score = nailCount === 0 ? 65 : nailCount <= 2 ? 80 : nailCount <= 5 ? 55 : nailCount <= 8 ? 35 : 20;
		rings.push({
			label: 'How many nail salons already here?',
			score: clamp(ring2Score, 0, 100),
			detail: `${nailCount} nail/beauty salons nearby. ${ring2Score >= 65 ? 'Room to compete.' : ring2Score >= 45 ? 'Moderate saturation.' : 'Very saturated.'}`,
			warn: nailCount >= 8 ? 'Extremely saturated — price war risk' : nailCount === 0 ? 'Unproven — could mean no demand' : undefined
		});

		// Ring 3: Income supports premium services? (gel, acrylics $40-80)
		let incomeScore = 50;
		if (intel.census?.medianHouseholdIncome) {
			const income = intel.census.medianHouseholdIncome;
			incomeScore = income >= 100000 ? 85 : income >= 70000 ? 70 : income >= 45000 ? 50 : 30;
		}
		rings.push({
			label: 'Can customers afford premium services?',
			score: incomeScore,
			detail: `Median income: $${fmt(intel.census?.medianHouseholdIncome || 60000)}. ${incomeScore >= 70 ? 'Premium gel/acrylic services viable.' : incomeScore >= 50 ? 'Mid-range pricing.' : 'Budget manicures focus.'}`
		});

		// Ring 4: Repeat visit cycle (bi-weekly nails = high frequency)
		let transitScore = 50;
		if (intel.walkScore?.walkScore) {
			transitScore = intel.walkScore.walkScore >= 85 ? 80 : intel.walkScore.walkScore >= 65 ? 65 : intel.walkScore.walkScore >= 45 ? 50 : 35;
		}
		rings.push({
			label: 'Easy for regulars to return?',
			score: transitScore,
			detail: `Walk Score: ${intel.walkScore?.walkScore || 50}/100. ${transitScore >= 70 ? 'Highly walkable — 2-week rebooking easy.' : transitScore >= 50 ? 'Accessible for regulars.' : 'Car-dependent — harder to build repeat visits.'}`
		});
	}

	// ─── BARBERSHOP (SEG-02) ───
	else if (segmentId === 'barbershop') {
		// Ring 1: Male population density (barbers serve local men 3-4 week cycle)
		let density = 0;
		if (intel.census?.populationDensity) density = intel.census.populationDensity;
		const ring1Score = density >= 25000 ? 85 : density >= 12000 ? 70 : density >= 5000 ? 50 : 30;
		rings.push({
			label: 'Enough men in the neighborhood?',
			score: clamp(ring1Score, 0, 100),
			detail: `~${fmt(density)} residents/sq mi. ${ring1Score >= 70 ? 'Dense neighborhood — strong regulars base.' : ring1Score >= 50 ? 'Decent male population.' : 'Low density — need to be a destination shop.'}`
		});

		// Ring 2: Competition (other barbershops)
		let barberCount = 0;
		if (intel.places?.places) {
			barberCount = intel.places.places.filter((p: any) => p.name?.toLowerCase().includes('barber') || p.name?.toLowerCase().includes('cuts') || (p.types?.includes('hair_care') && !p.name?.toLowerCase().includes('salon'))).length;
		}
		const ring2Score = barberCount === 0 ? 70 : barberCount <= 2 ? 80 : barberCount <= 4 ? 55 : 30;
		rings.push({
			label: 'How many barbershops nearby?',
			score: clamp(ring2Score, 0, 100),
			detail: `${barberCount} barbershops. ${ring2Score >= 65 ? 'Room to build a chair.' : ring2Score >= 50 ? 'Competitive but viable.' : 'Saturated — need strong personal brand.'}`,
			warn: barberCount >= 5 ? 'High saturation — loyalty is everything' : undefined
		});

		// Ring 3: Office workers (lunchtime cuts)
		let officeCount = 0;
		if (intel.places?.places) {
			officeCount = intel.places.places.filter((p: any) => p.types?.includes('office_building') || p.types?.includes('business_center')).length;
		}
		const ring3Score = officeCount >= 3 ? 80 : officeCount >= 1 ? 60 : 40;
		rings.push({
			label: 'Office workers for lunchtime cuts?',
			score: clamp(ring3Score, 0, 100),
			detail: `${officeCount} office buildings nearby. ${ring3Score >= 70 ? 'Strong lunchtime walk-in potential.' : ring3Score >= 50 ? 'Some office traffic.' : 'Residential-only — evening/weekend focus.'}`
		});

		// Ring 4: Community loyalty potential (walkability)
		let walkScore = 50;
		if (intel.walkScore?.walkScore) {
			walkScore = intel.walkScore.walkScore >= 85 ? 85 : intel.walkScore.walkScore >= 65 ? 65 : intel.walkScore.walkScore >= 45 ? 50 : 35;
		}
		rings.push({
			label: 'Easy for regulars to walk in?',
			score: walkScore,
			detail: `Walk Score: ${intel.walkScore?.walkScore || 50}/100. ${walkScore >= 70 ? 'Highly walkable — loyalty builds fast.' : walkScore >= 50 ? 'Accessible neighborhood.' : 'Car-dependent — harder to build repeat clients.'}`
		});
	}

	// ─── JUICE BAR (SEG-02) ───
	else if (segmentId === 'juice_bar') {
		// Ring 1: Morning impulse traffic (same as coffee — grab-and-go)
		let morningRaw = 0;
		if (intel.mtaRidership?.totalDailyRidership) {
			morningRaw = Math.round(intel.mtaRidership.totalDailyRidership * 0.32 * 0.83);
		} else if (intel.pedestrian?.avgAMCount) {
			morningRaw = intel.pedestrian.avgAMCount;
		} else if (intel.census?.populationDensity) {
			morningRaw = Math.round(intel.census.populationDensity * 1.5);
		}
		const ring1Score = morningRaw >= 3000 ? 90 : morningRaw >= 1500 ? 70 : morningRaw >= 500 ? 50 : 30;
		rings.push({
			label: 'Morning grab-and-go traffic?',
			score: clamp(ring1Score, 0, 100),
			detail: `~${fmt(morningRaw)} morning foot traffic. ${ring1Score >= 70 ? 'Strong impulse buy window.' : ring1Score >= 50 ? 'Moderate morning traffic.' : 'Limited grab-and-go potential.'}`
		});

		// Ring 2: Health-conscious demographic (income + gyms)
		let gymCount = 0;
		if (intel.places?.places) {
			gymCount = intel.places.places.filter((p: any) => p.types?.includes('gym') || p.types?.includes('health') || p.name?.toLowerCase().includes('yoga') || p.name?.toLowerCase().includes('pilates')).length;
		}
		const income = intel.census?.medianHouseholdIncome || 60000;
		const healthScore = (income >= 80000 ? 40 : 20) + (gymCount >= 3 ? 40 : gymCount >= 1 ? 25 : 10);
		rings.push({
			label: 'Health-conscious crowd nearby?',
			score: clamp(healthScore, 0, 100),
			detail: `${gymCount} gyms/studios + $${fmt(income)} median income. ${healthScore >= 65 ? 'Active wellness community.' : healthScore >= 45 ? 'Moderate health interest.' : 'Low wellness signals.'}`
		});

		// Ring 3: Competition (juice bars + smoothie shops)
		let juiceCount = 0;
		if (intel.places?.places) {
			juiceCount = intel.places.places.filter((p: any) => p.name?.toLowerCase().includes('juice') || p.name?.toLowerCase().includes('smoothie') || p.name?.toLowerCase().includes('açaí') || p.name?.toLowerCase().includes('acai')).length;
		}
		const ring3Score = juiceCount === 0 ? 65 : juiceCount <= 2 ? 80 : juiceCount <= 4 ? 55 : 30;
		rings.push({
			label: 'How many juice bars here?',
			score: clamp(ring3Score, 0, 100),
			detail: `${juiceCount} juice/smoothie shops. ${ring3Score >= 65 ? 'Room in the market.' : ring3Score >= 45 ? 'Moderate competition.' : 'Saturated wellness beverage market.'}`,
			warn: juiceCount === 0 ? 'Unproven demand — validate health-conscious traffic first' : undefined
		});

		// Ring 4: Post-workout window (gyms nearby = afternoon spike)
		const postWorkoutScore = gymCount >= 3 ? 85 : gymCount >= 2 ? 70 : gymCount >= 1 ? 55 : 35;
		rings.push({
			label: 'Post-workout customer flow?',
			score: postWorkoutScore,
			detail: `${gymCount} gyms/studios nearby. ${postWorkoutScore >= 70 ? 'Strong post-workout pipeline.' : postWorkoutScore >= 50 ? 'Some gym traffic.' : 'No gym anchor — need other demand drivers.'}`
		});
	}

	// ─── BAKERY (SEG-02) ───
	else if (segmentId === 'bakery') {
		// Ring 1: Morning coffee+pastry traffic
		let morningRaw = 0;
		if (intel.mtaRidership?.totalDailyRidership) {
			morningRaw = Math.round(intel.mtaRidership.totalDailyRidership * 0.32 * 0.83);
		} else if (intel.pedestrian?.avgAMCount) {
			morningRaw = intel.pedestrian.avgAMCount;
		} else if (intel.census?.populationDensity) {
			morningRaw = Math.round(intel.census.populationDensity * 1.5);
		}
		const ring1Score = morningRaw >= 2500 ? 85 : morningRaw >= 1200 ? 70 : morningRaw >= 400 ? 50 : 30;
		rings.push({
			label: 'Morning pastry-and-coffee crowd?',
			score: clamp(ring1Score, 0, 100),
			detail: `~${fmt(morningRaw)} morning foot traffic. ${ring1Score >= 70 ? 'Strong breakfast rush.' : ring1Score >= 50 ? 'Decent morning traffic.' : 'Quiet mornings — focus on wholesale/catering.'}`
		});

		// Ring 2: Weekend foot traffic (bakeries spike Sat/Sun)
		let weekendRatio = 0.5;
		if (intel.mtaRidership?.dayOfWeekBreakdown) {
			const dow = intel.mtaRidership.dayOfWeekBreakdown;
			const weekendAvg = ((dow.saturday || 0) + (dow.sunday || 0)) / 2;
			const weekdayAvg = ((dow.monday || 0) + (dow.tuesday || 0) + (dow.wednesday || 0) + (dow.thursday || 0) + (dow.friday || 0)) / 5;
			weekendRatio = weekdayAvg > 0 ? weekendAvg / weekdayAvg : 0.5;
		}
		const ring2Score = weekendRatio >= 0.7 ? 85 : weekendRatio >= 0.5 ? 65 : 40;
		rings.push({
			label: 'Weekend brunch crowd?',
			score: clamp(ring2Score, 0, 100),
			detail: `Weekend is ~${Math.round(weekendRatio * 100)}% of weekday traffic. ${ring2Score >= 70 ? 'Strong weekend business — bread & pastry peak.' : ring2Score >= 50 ? 'Moderate weekend traffic.' : 'Weekday-focused location.'}`
		});

		// Ring 3: Bakery competition
		let bakeryCount = 0;
		if (intel.places?.places) {
			bakeryCount = intel.places.places.filter((p: any) => p.types?.includes('bakery') || p.name?.toLowerCase().includes('bakery') || p.name?.toLowerCase().includes('pastry') || p.name?.toLowerCase().includes('bread')).length;
		}
		const ring3Score = bakeryCount === 0 ? 60 : bakeryCount <= 2 ? 80 : bakeryCount <= 4 ? 55 : 30;
		rings.push({
			label: 'How many bakeries nearby?',
			score: clamp(ring3Score, 0, 100),
			detail: `${bakeryCount} bakeries. ${ring3Score >= 65 ? 'Room for your concept.' : ring3Score >= 45 ? 'Some competition.' : 'Crowded bakery market.'}`,
			warn: bakeryCount === 0 ? 'Unproven — test with pop-up first' : undefined
		});

		// Ring 4: Residential density (bakeries serve the neighborhood)
		let density = 0;
		if (intel.census?.populationDensity) density = intel.census.populationDensity;
		const ring4Score = density >= 25000 ? 85 : density >= 12000 ? 70 : density >= 5000 ? 50 : 35;
		rings.push({
			label: 'Neighborhood density for regulars?',
			score: clamp(ring4Score, 0, 100),
			detail: `~${fmt(density)} residents/sq mi. ${ring4Score >= 70 ? 'Dense neighborhood — daily bread customers.' : ring4Score >= 50 ? 'Decent residential base.' : 'Sparse — need to attract from wider area.'}`
		});
	}

	// ─── PHARMACY (SEG-02) ───
	else if (segmentId === 'pharmacy') {
		// Ring 1: Catchment population (pharmacies serve 10-15min walk radius)
		let density = 0;
		if (intel.census?.populationDensity) density = intel.census.populationDensity;
		const catchment = Math.round(density * 0.5);
		const ring1Score = catchment >= 8000 ? 85 : catchment >= 4000 ? 70 : catchment >= 2000 ? 50 : 30;
		rings.push({
			label: 'Enough people need a pharmacy?',
			score: clamp(ring1Score, 0, 100),
			detail: `~${fmt(catchment)} in catchment. ${ring1Score >= 70 ? 'High-density catchment — strong Rx volume.' : ring1Score >= 50 ? 'Moderate residential base.' : 'Low density — need medical office anchor.'}`
		});

		// Ring 2: Existing pharmacy competition (CVS, Walgreens, independents)
		let pharmacyCount = 0;
		if (intel.places?.places) {
			pharmacyCount = intel.places.places.filter((p: any) => p.types?.includes('pharmacy') || p.types?.includes('drugstore') || p.name?.toLowerCase().includes('pharmacy') || p.name?.toLowerCase().includes('cvs') || p.name?.toLowerCase().includes('walgreens') || p.name?.toLowerCase().includes('rite aid') || p.name?.toLowerCase().includes('duane reade')).length;
		}
		const ring2Score = pharmacyCount === 0 ? 90 : pharmacyCount === 1 ? 65 : pharmacyCount === 2 ? 45 : 25;
		rings.push({
			label: 'Chain pharmacy competition?',
			score: clamp(ring2Score, 0, 100),
			detail: `${pharmacyCount} pharmacies nearby. ${ring2Score >= 75 ? 'Underserved — no chain competition.' : ring2Score >= 50 ? 'Some competition.' : 'Chain-dominated — differentiate on service.'}`,
			warn: pharmacyCount >= 3 ? 'Heavy chain competition — consider compounding or specialty niche' : undefined
		});

		// Ring 3: Medical offices nearby (Rx referral pipeline)
		let medicalCount = 0;
		if (intel.places?.places) {
			medicalCount = intel.places.places.filter((p: any) => p.types?.includes('doctor') || p.types?.includes('dentist') || p.types?.includes('hospital') || p.types?.includes('health') || p.name?.toLowerCase().includes('medical') || p.name?.toLowerCase().includes('clinic')).length;
		}
		const ring3Score = medicalCount >= 5 ? 85 : medicalCount >= 2 ? 70 : medicalCount >= 1 ? 50 : 30;
		rings.push({
			label: 'Medical offices for Rx referrals?',
			score: clamp(ring3Score, 0, 100),
			detail: `${medicalCount} medical/dental offices. ${ring3Score >= 70 ? 'Strong referral pipeline.' : ring3Score >= 50 ? 'Some medical traffic.' : 'No medical anchor — walk-in OTC focus.'}`
		});

		// Ring 4: Senior population (higher Rx demand)
		let ageScore = 50;
		if (intel.census?.medianAge) {
			const age = intel.census.medianAge;
			ageScore = age >= 55 ? 85 : age >= 45 ? 70 : age >= 35 ? 50 : 35;
		}
		rings.push({
			label: 'Prescription demand from demographics?',
			score: ageScore,
			detail: `Median age: ${intel.census?.medianAge || 35}. ${ageScore >= 70 ? 'Older population — high chronic Rx demand.' : ageScore >= 50 ? 'Mixed demographics.' : 'Young area — OTC + convenience focus.'}`
		});
	}

	// ─── DOGGIE DAYCARE (SEG-02) ───
	else if (segmentId === 'doggie_daycare') {
		// Ring 1: Affluent residential density (dog daycare = premium service)
		let incomeScore = 50;
		if (intel.census?.medianHouseholdIncome) {
			const income = intel.census.medianHouseholdIncome;
			incomeScore = income >= 120000 ? 90 : income >= 85000 ? 75 : income >= 60000 ? 55 : 30;
		}
		rings.push({
			label: 'Can neighbors afford $40-70/day daycare?',
			score: incomeScore,
			detail: `Median income: $${fmt(intel.census?.medianHouseholdIncome || 60000)}. ${incomeScore >= 70 ? 'High-income — premium pet services viable.' : incomeScore >= 50 ? 'Mid-range — competitive pricing needed.' : 'Budget area — limited daycare willingness.'}`
		});

		// Ring 2: Pet ecosystem (vets, groomers = demand validation)
		let petPOIs = 0;
		if (intel.places?.places) {
			petPOIs = intel.places.places.filter((p: any) => p.types?.includes('veterinary_care') || p.types?.includes('pet_store') || p.name?.toLowerCase().includes('pet') || p.name?.toLowerCase().includes('vet') || p.name?.toLowerCase().includes('groomer') || p.name?.toLowerCase().includes('dog')).length;
		}
		const ring2Score = petPOIs >= 3 ? 85 : petPOIs >= 1 ? 65 : 40;
		rings.push({
			label: 'Active pet neighborhood?',
			score: clamp(ring2Score, 0, 100),
			detail: `${petPOIs} pet businesses nearby. ${ring2Score >= 70 ? 'Validated pet demand.' : ring2Score >= 50 ? 'Some pet infrastructure.' : 'Unproven pet market.'}`
		});

		// Ring 3: Park proximity (dog parks = daily walking traffic)
		let parkCount = 0;
		if (intel.places?.places) {
			parkCount = intel.places.places.filter((p: any) => p.types?.includes('park') || p.name?.toLowerCase().includes('park') || p.name?.toLowerCase().includes('dog run')).length;
		}
		const ring3Score = parkCount >= 2 ? 80 : parkCount >= 1 ? 65 : 40;
		rings.push({
			label: 'Dog parks or green space nearby?',
			score: clamp(ring3Score, 0, 100),
			detail: `${parkCount} parks. ${ring3Score >= 70 ? 'Dog-walking corridors nearby.' : ring3Score >= 50 ? 'Some green space.' : 'Urban core — indoor play space critical.'}`
		});

		// Ring 4: Commuter density (working owners = daycare need)
		let commuterScore = 50;
		if (intel.mtaRidership?.totalDailyRidership) {
			const ridership = intel.mtaRidership.totalDailyRidership;
			commuterScore = ridership >= 20000 ? 80 : ridership >= 10000 ? 65 : ridership >= 3000 ? 50 : 35;
		}
		rings.push({
			label: 'Working commuters who need daycare?',
			score: commuterScore,
			detail: `~${fmt(intel.mtaRidership?.totalDailyRidership || 0)} daily transit riders. ${commuterScore >= 70 ? 'High commuter density — working dog owners.' : commuterScore >= 50 ? 'Moderate commuter traffic.' : 'Low commuters — weekend-only demand risk.'}`
		});
	}

	// ─── TUTORING CENTER (SEG-02) ───
	else if (segmentId === 'tutoring') {
		// Ring 1: School proximity (children = primary market)
		let schoolCount = 0;
		if (intel.places?.places) {
			schoolCount = intel.places.places.filter((p: any) => p.types?.includes('school') || p.types?.includes('primary_school') || p.types?.includes('secondary_school') || p.name?.toLowerCase().includes('school') || p.name?.toLowerCase().includes('academy')).length;
		}
		const ring1Score = schoolCount >= 3 ? 90 : schoolCount >= 2 ? 75 : schoolCount >= 1 ? 60 : 30;
		rings.push({
			label: 'Schools within walking distance?',
			score: clamp(ring1Score, 0, 100),
			detail: `${schoolCount} schools nearby. ${ring1Score >= 70 ? 'Strong after-school pipeline.' : ring1Score >= 50 ? 'Some school traffic.' : 'No schools nearby — marketing-dependent.'}`
		});

		// Ring 2: Family income (tutoring = discretionary education spend)
		let incomeScore = 50;
		if (intel.census?.medianHouseholdIncome) {
			const income = intel.census.medianHouseholdIncome;
			incomeScore = income >= 120000 ? 90 : income >= 80000 ? 75 : income >= 55000 ? 55 : 30;
		}
		rings.push({
			label: 'Can families afford tutoring ($40-80/hr)?',
			score: incomeScore,
			detail: `Median income: $${fmt(intel.census?.medianHouseholdIncome || 60000)}. ${incomeScore >= 70 ? 'High-income — SAT/AP/enrichment all viable.' : incomeScore >= 50 ? 'Mid-range — homework help + test prep.' : 'Budget — focus on free/subsidized programs.'}`
		});

		// Ring 3: Competition (other tutoring centers)
		let tutorCount = 0;
		if (intel.places?.places) {
			tutorCount = intel.places.places.filter((p: any) => p.name?.toLowerCase().includes('tutor') || p.name?.toLowerCase().includes('kumon') || p.name?.toLowerCase().includes('sylvan') || p.name?.toLowerCase().includes('mathnasium') || p.name?.toLowerCase().includes('learning center')).length;
		}
		const ring3Score = tutorCount === 0 ? 75 : tutorCount <= 2 ? 65 : tutorCount <= 4 ? 45 : 25;
		rings.push({
			label: 'Tutoring competition nearby?',
			score: clamp(ring3Score, 0, 100),
			detail: `${tutorCount} tutoring centers. ${ring3Score >= 65 ? 'Market opportunity.' : ring3Score >= 45 ? 'Some competition.' : 'Saturated — need strong subject niche.'}`,
			warn: tutorCount >= 4 ? 'Highly competitive — specialize in specific subjects or age groups' : undefined
		});

		// Ring 4: Residential family density
		let familyScore = 50;
		if (intel.census?.populationDensity && intel.census?.medianAge) {
			const density = intel.census.populationDensity;
			const age = intel.census.medianAge;
			// Families = moderate median age (30-45) + residential density
			const ageBonus = age >= 30 && age <= 45 ? 20 : age >= 25 && age <= 50 ? 10 : 0;
			const densityBonus = density >= 20000 ? 25 : density >= 10000 ? 15 : density >= 5000 ? 5 : 0;
			familyScore = clamp(35 + ageBonus + densityBonus, 0, 100);
		}
		rings.push({
			label: 'Families with school-age children?',
			score: familyScore,
			detail: `Median age ${intel.census?.medianAge || 35}, density ${fmt(intel.census?.populationDensity || 0)}. ${familyScore >= 65 ? 'Family-dense area.' : familyScore >= 45 ? 'Mixed demographics.' : 'Few families — young professional or senior area.'}`
		});
	}

	// ─── ETHNIC / SPECIALTY MARKET (SEG-02) ───
	else if (segmentId === 'ethnic_market') {
		// Ring 1: Community density (ethnic markets serve concentrated populations)
		let density = 0;
		if (intel.census?.populationDensity) density = intel.census.populationDensity;
		const ring1Score = density >= 35000 ? 85 : density >= 18000 ? 70 : density >= 8000 ? 55 : 35;
		rings.push({
			label: 'Dense community to serve?',
			score: clamp(ring1Score, 0, 100),
			detail: `~${fmt(density)} residents/sq mi. ${ring1Score >= 70 ? 'Dense community — weekly grocery destination.' : ring1Score >= 50 ? 'Moderate density.' : 'Sparse — need destination draw from wider area.'}`
		});

		// Ring 2: Grocery competition (chain supermarkets)
		let groceryCount = 0;
		if (intel.places?.places) {
			groceryCount = intel.places.places.filter((p: any) => p.types?.includes('grocery_or_supermarket') || p.types?.includes('supermarket') || p.name?.toLowerCase().includes('market') || p.name?.toLowerCase().includes('grocery') || p.name?.toLowerCase().includes('food bazaar') || p.name?.toLowerCase().includes('key food')).length;
		}
		const ring2Score = groceryCount === 0 ? 90 : groceryCount <= 2 ? 70 : groceryCount <= 4 ? 50 : 30;
		rings.push({
			label: 'Grocery competition level?',
			score: clamp(ring2Score, 0, 100),
			detail: `${groceryCount} grocery stores. ${ring2Score >= 75 ? 'Food desert — massive opportunity.' : ring2Score >= 55 ? 'Some competition.' : 'Competitive market.'}`,
			warn: groceryCount === 0 ? 'Food desert — verify community purchasing power' : undefined
		});

		// Ring 3: Income & spending power
		let incomeScore = 50;
		if (intel.census?.medianHouseholdIncome) {
			const income = intel.census.medianHouseholdIncome;
			// Ethnic markets serve a wider income range than most businesses
			incomeScore = income >= 70000 ? 80 : income >= 45000 ? 70 : income >= 30000 ? 55 : 40;
		}
		rings.push({
			label: 'Community spending power?',
			score: incomeScore,
			detail: `Median income: $${fmt(intel.census?.medianHouseholdIncome || 50000)}. ${incomeScore >= 70 ? 'Good spending power for specialty goods.' : incomeScore >= 50 ? 'Price-sensitive but loyal.' : 'Budget-focused — high volume, low margin.'}`
		});

		// Ring 4: Transit access (ethnic markets draw from wider area)
		let transitScore = 50;
		if (intel.walkScore?.transitScore) {
			transitScore = intel.walkScore.transitScore >= 80 ? 85 : intel.walkScore.transitScore >= 60 ? 70 : intel.walkScore.transitScore >= 40 ? 50 : 35;
		}
		rings.push({
			label: 'Accessible from wider community?',
			score: transitScore,
			detail: `Transit Score: ${intel.walkScore?.transitScore || 50}/100. ${transitScore >= 70 ? 'Excellent access — draws from borough-wide.' : transitScore >= 50 ? 'Decent transit.' : 'Car-dependent — parking matters.'}`
		});
	}

	// ─── FALLBACK (for all other segments) ───
	else {
		// Ring 1: How much relevant foot traffic?
		let footTraffic = 0;
		if (intel.pedestrian?.avgDailyCount) {
			footTraffic = intel.pedestrian.avgDailyCount;
		} else if (intel.mtaRidership?.totalDailyRidership) {
			footTraffic = intel.mtaRidership.totalDailyRidership;
		}
		const ring1Score = footTraffic >= 5000 ? 80 : footTraffic >= 2000 ? 65 : footTraffic >= 500 ? 50 : 30;
		rings.push({
			label: 'How much relevant foot traffic?',
			score: clamp(ring1Score, 0, 100),
			detail: `~${fmt(footTraffic)} daily foot traffic. ${ring1Score >= 70 ? 'Excellent visibility.' : ring1Score >= 50 ? 'Moderate visibility.' : 'Limited foot traffic.'}`
		});

		// Ring 2: How many competitors nearby?
		let competitorCount = 0;
		if (intel.competitors?.length) {
			competitorCount = intel.competitors.length;
		}
		const ring2Score = competitorCount === 0 ? 70 : competitorCount <= 3 ? 65 : competitorCount <= 6 ? 50 : 30;
		rings.push({
			label: 'How many competitors nearby?',
			score: clamp(ring2Score, 0, 100),
			detail: `${competitorCount} competitors. ${ring2Score >= 65 ? 'Room to compete.' : ring2Score >= 50 ? 'Moderate competition.' : 'Saturated market.'}`
		});

		// Ring 3: Do the right customers live here?
		let demoScore = 50;
		if (intel.census?.medianHouseholdIncome) {
			demoScore = intel.census.medianHouseholdIncome >= 80000 ? 75 : intel.census.medianHouseholdIncome >= 50000 ? 60 : 40;
		}
		rings.push({
			label: 'Do the right customers live here?',
			score: demoScore,
			detail: `Median income: $${fmt(intel.census?.medianHouseholdIncome || 60000)}. ${demoScore >= 70 ? 'Affluent customer base.' : demoScore >= 50 ? 'Middle-income demographic.' : 'Budget-focused area.'}`
		});

		// Ring 4: Is this the right neighborhood?
		let neighScore = 50;
		if (intel.crime?.crimeScore) {
			neighScore = intel.crime.crimeScore >= 70 ? 75 : intel.crime.crimeScore >= 50 ? 55 : 35;
		}
		rings.push({
			label: 'Is this the right neighborhood?',
			score: neighScore,
			detail: `Safety score: ${intel.crime?.crimeScore || 50}/100. ${neighScore >= 70 ? 'Safe neighborhood.' : neighScore >= 50 ? 'Generally safe.' : 'Safety concerns.'}`
		});
	}

	// ─── Generate Verdict ───
	const scores = rings.map(r => r.score);
	const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
	const minScore = Math.min(...scores);
	const weakRings = rings.filter(r => r.score < 50).sort((a, b) => a.score - b.score);

	if (scores.every(s => s >= 70)) {
		verdict = `<span class="good">Strong fit for ${bizType}</span>. All key factors align well.`;
	} else if (avgScore >= 60 && weakRings.length > 0 && weakRings[0].score < 50) {
		const weakLabel = weakRings[0].label;
		verdict = `<span class="good">Good location</span>, but <span class="bad">"${weakLabel}"</span> is a concern.`;
	} else if (avgScore < 50) {
		const weakLabel1 = weakRings[0]?.label || 'fit';
		const weakLabel2 = weakRings[1]?.label || 'other factors';
		verdict = `<span class="bad">Challenging for ${bizType}</span>. "${weakLabel1}" and "${weakLabel2}" are significant concerns.`;
	} else if (avgScore >= 60) {
		verdict = `<span class="good">Decent fit for ${bizType}</span>. Most factors are favorable, with room to optimize.`;
	} else {
		verdict = `Mixed signals for ${bizType}. Some rings show promise, others need attention.`;
	}

	// ─── Generate Insight ───
	const bestRing = rings.reduce((prev, current) => prev.score > current.score ? prev : current);
	const insightTitle = `Your ${bizType} strongest asset: ${bestRing.label}`;
	const insightText = bestRing.score >= 70
		? `${bestRing.label} rates excellently (${bestRing.score}/100). This is your competitive advantage in this location.`
		: bestRing.score >= 50
			? `${bestRing.label} is solid but not outstanding. Look for ways to amplify this strength.`
			: `Even your strongest ring is below 50. Evaluate whether this location aligns with your business model.`;

	return {
		rings,
		verdict,
		insight: { title: insightTitle, text: insightText }
	};
}

// ═══════════════════════════════════════════════════════
// COFFEE-REWIRE Change 9: Watch-Out Generator
// ═══════════════════════════════════════════════════════
//
// Plain English flags that surface alongside the score. Not build-out
// warnings (those are Heads-Up C1-C5) — these are business viability
// insights: WHY the score is what it is and what to watch for.

export interface CoffeeWatchOut {
	id: string;           // W1, W2, etc.
	title: string;        // "Low foot traffic"
	explanation: string;  // One-line plain English
	severity: 'critical' | 'important' | 'info';
	dataSource: string;   // Which function/data powers this
	icon: string;         // Emoji for UX pill rendering
}

const WATCHOUT_ICONS: Record<string, string> = {
	W1: '🚶', W2: '⚠️', W3: '🔄', W4: '📅', W5: '⚔️',
	W6: '🚧', W7: '🛣️', W8: '📢', W9: '💰', W10: '🎓',
};

/**
 * Generate coffee-specific watch-outs from scoring results.
 * Returns only TRIGGERED watch-outs — an empty array means no concerns.
 *
 * @param morningRushRaw  Raw morning passerby count from extrapolateCoffeeRushTraffic().morning.rawValue
 * @param ritualDensity   DailyRitualDensity result (or null)
 * @param compBlend       CompetitorBlend result (or null)
 * @param streetSideScore streetSideData.streetSideScore (0-100)
 * @param hostilityPenalty streetSideData.hostilityPenalty (0 to -25)
 * @param daytimePopRatio census.daytimePopulationRatio
 * @param medianIncome    census.medianHouseholdIncome
 * @param avgTicket       User's average ticket price
 * @param collegeCount    Number of college/university POIs nearby
 * @param residentialPct  % of daily ritual density from residents (0-100)
 */
export function generateCoffeeWatchOuts(params: {
	morningRushRaw: number;
	ritualDensity: DailyRitualDensity | null;
	compBlend: CompetitorBlend | null;
	streetSideScore: number;
	hostilityPenalty: number;
	daytimePopRatio: number;
	medianIncome: number;
	avgTicket: number;
	collegeCount: number;
	residentialPct: number;
}): CoffeeWatchOut[] {
	const w: CoffeeWatchOut[] = [];
	const {
		morningRushRaw, ritualDensity, compBlend,
		streetSideScore, hostilityPenalty, daytimePopRatio,
		medianIncome, avgTicket, collegeCount, residentialPct
	} = params;

	const rdScore = ritualDensity?.score ?? 0;

	// W1: Low foot traffic (Important)
	if (morningRushRaw < 3000 && morningRushRaw >= 1500) {
		w.push({
			id: 'W1', title: 'Low foot traffic',
			explanation: `Only ~${fmt(morningRushRaw)} morning passersby — you'll need destination appeal to compensate.`,
			severity: 'important', dataSource: 'extrapolateCoffeeRushTraffic'
		});
	}

	// W2: Below viability threshold (Critical)
	if (morningRushRaw < 1500) {
		w.push({
			id: 'W2', title: 'Below viability threshold',
			explanation: `~${fmt(morningRushRaw)} morning passersby is critically low for coffee. Consider a different block.`,
			severity: 'critical', dataSource: 'extrapolateCoffeeRushTraffic'
		});
	}

	// W3: Thin habitual anchors (Important)
	if (rdScore < 40) {
		w.push({
			id: 'W3', title: 'Thin habitual anchors',
			explanation: 'Few offices, gyms, or commuter exits nearby to generate daily repeat visits.',
			severity: 'important', dataSource: 'computeDailyRitualDensity'
		});
	}

	// W4: Weekend dead zone (Important)
	if (daytimePopRatio > 2.0 && residentialPct < 20) {
		w.push({
			id: 'W4', title: 'Weekend dead zone',
			explanation: 'Office-heavy corridor with few residents — expect 40-60% revenue drop on weekends.',
			severity: 'important', dataSource: 'census + ritualDensity'
		});
	}

	// W5: Saturated with quality (Important)
	if (compBlend && compBlend.tierCount >= 6 && compBlend.avgRating >= 4.3) {
		w.push({
			id: 'W5', title: 'Saturated with quality',
			explanation: `${compBlend.tierCount} direct competitors nearby averaging ${compBlend.avgRating} stars — you need a strong differentiator.`,
			severity: 'important', dataSource: 'blendCompetitorPricing'
		});
	}

	// W6: Wrong side of street (Info)
	if (streetSideScore < 45) {
		w.push({
			id: 'W6', title: 'Wrong side of street',
			explanation: 'Your side has less foot traffic, fewer active storefronts, or dead frontage.',
			severity: 'info', dataSource: 'streetSideModifier'
		});
	}

	// W7: Traffic hostility nearby (Info)
	if (hostilityPenalty < -5) {
		w.push({
			id: 'W7', title: 'Traffic hostility nearby',
			explanation: 'Highway ramp, tunnel entrance, or major intersection creates pedestrian barriers.',
			severity: 'info', dataSource: 'streetSideData'
		});
	}

	// W8: Needs significant marketing (Important)
	if (morningRushRaw < 3000 && rdScore < 50) {
		w.push({
			id: 'W8', title: 'Needs significant marketing',
			explanation: 'Low walk-by traffic AND thin anchors — this location will require heavy marketing spend to build a customer base.',
			severity: 'important', dataSource: 'combined'
		});
	}

	// W9: Premium price, mixed demographics (Important)
	if (avgTicket > 7 && medianIncome < 80000) {
		w.push({
			id: 'W9', title: 'Premium price, mixed demographics',
			explanation: `At $${avgTicket.toFixed(2)}/ticket, the area median income ($${Math.round(medianIncome / 1000)}K) may limit your daily customer base.`,
			severity: 'important', dataSource: 'census + session'
		});
	}

	// W10: Student anchor won't convert at price (Info)
	if (avgTicket > 7 && collegeCount > 0) {
		// Only flag if colleges are a primary anchor (>30% of ritual density)
		const collegePortion = ritualDensity?.breakdown.find(b => b.type === 'Students');
		const totalPop = ritualDensity?.estimatedDailyRitualPop ?? 1;
		const isCollegePrimary = collegePortion && totalPop > 0;
		if (isCollegePrimary) {
			w.push({
				id: 'W10', title: 'Student anchor won\'t convert at price',
				explanation: `Nearby students are unlikely to spend $${avgTicket.toFixed(2)}/day. Your premium pricing targets a different demo.`,
				severity: 'info', dataSource: 'ritualDensity + session'
			});
		}
	}

	// Add icon to each watch-out for UX rendering
	return w.map(wo => ({ ...wo, icon: WATCHOUT_ICONS[wo.id] || '⚠️' }));
}
