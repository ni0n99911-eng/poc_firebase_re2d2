import type { LocationIntelReport } from '../types';
import type { IndexSignal, IndexName } from '../six-index';
import { getConceptScanRadius } from '../six-index';
// 04.19.2026 13:35 Score Consolidation — clamp and scoreLinear are now owned by
// geo-math.ts (canonical source). Imported here AND re-exported so all existing
// callers of primitives.ts continue to work without changes.
import { clamp, scoreLinear } from '$lib/intel/scoring/geo-math';
export { clamp, scoreLinear } from '$lib/intel/scoring/geo-math';

// clamp and scoreLinear are defined in geo-math.ts; imported above for internal use,
// re-exported above for backward-compat with primitives.ts callers.
// 04.19.2026 13:35 Score Consolidation — removed local definitions.

export function scoreToGrade(score: number): string {
	if (score >= 93) return 'A+';
	if (score >= 87) return 'A';
	if (score >= 80) return 'A-';
	if (score >= 73) return 'B+';
	if (score >= 67) return 'B';
	if (score >= 60) return 'B-';
	if (score >= 53) return 'C+';
	if (score >= 47) return 'C';
	if (score >= 40) return 'C-';
	if (score >= 30) return 'D';
	return 'F';
}

export const INDEX_SOURCES: Record<IndexName, string[]> = {
	transit: ['mtaRidership', 'pedestrian', 'walkScore', 'foursquare'],
	demographics: ['census', 'censusHousing'],
	competition: ['competitors', 'places', 'marketDensity', 'inspections', 'foursquare'],
	vibrancy: ['dcaLicenses', 'sidewalkCafes', 'liquorLicenses', 'marketDensity', 'foursquare'],
	safety: ['crime', 'complaints311', 'dob'],
	momentum: ['dob', 'pluto', 'dcaLicenses', 'lpc', 'momentum'],
	neighborhoodHealth: ['googleRatings', 'googleReviews', 'dohMHGrades'],
	survivalRate: ['businessTiers']
};

export function sourceCount(report: LocationIntelReport, indexName: IndexName): { available: number; total: number } {
	const sources = INDEX_SOURCES[indexName];
	const reportAny = report as unknown as Record<string, unknown>;
	const available = sources.filter(s => reportAny[s] != null).length;
	return { available, total: sources.length };
}

export function computeTransitIndex(r: LocationIntelReport, signals: IndexSignal[]): number {
	let score = 50;
	let hasRealData = false;

	if (r.mtaRidership) {
		score = r.mtaRidership.transitScore;
		hasRealData = true;
		if (score > 70) {
			signals.push({ index: 'transit', type: 'positive', message: `${r.mtaRidership.stationCount} subway stations, ${(r.mtaRidership.totalDailyRidership / 1000).toFixed(0)}K daily riders` });
		} else if (r.mtaRidership.stationCount === 0) {
			signals.push({ index: 'transit', type: 'negative', message: 'No subway stations within 800m — limited transit access' });
		}
	}

	if (r.pedestrian) {
		const pedScore = r.pedestrian.footTrafficScore;
		score = hasRealData ? Math.round(score * 0.7 + pedScore * 0.3) : pedScore;
		hasRealData = true;
		if (pedScore > 70) {
			signals.push({ index: 'transit', type: 'positive', message: `${r.pedestrian.totalPedestrians.toLocaleString()} pedestrians at ${r.pedestrian.countLocationCount} DOT count points` });
		}
	}

	if (r.walkScore) {
		const ws = r.walkScore.walkScore || 50;
		const ts = r.walkScore.transitScore || 50;
		const walkTransit = Math.round(ws * 0.5 + ts * 0.5);
		score = hasRealData ? Math.round(score * 0.90 + walkTransit * 0.10) : walkTransit;
		if (ws > 85) signals.push({ index: 'transit', type: 'positive', message: `Walk Score ${ws} — highly walkable location` });
	}

	if (r.foursquare && r.foursquare.peakTrafficScore > 0) {
		const fsqTraffic = r.foursquare.peakTrafficScore;
		score = hasRealData ? Math.round(score * 0.90 + fsqTraffic * 0.10) : fsqTraffic;
		if (r.foursquare.highTrafficVenues > 3) {
			signals.push({ index: 'transit', type: 'positive', message: `${r.foursquare.highTrafficVenues} high-traffic venues nearby (Foursquare) — proven foot traffic` });
		}
	}

	return clamp(score);
}

export function computeDemographicsIndex(r: LocationIntelReport, signals: IndexSignal[]): number {
	let score = 50;
	if (r.census) {
		const c = r.census;
		const incomeScore = scoreLinear(c.medianHouseholdIncome || 0, 30000, 150000);
		const ageScore = scoreLinear(c.medianAge || 30, 20, 50, true);
		const popDensity = scoreLinear(c.populationDensity || 0, 5000, 70000);
		const educScore = scoreLinear(c.bachelorsPlusPercent || 0, 10, 70);
		score = Math.round(incomeScore * 0.35 + popDensity * 0.25 + educScore * 0.25 + ageScore * 0.15);

		if (incomeScore > 70) signals.push({ index: 'demographics', type: 'positive', message: `Median income $${((c.medianHouseholdIncome || 0) / 1000).toFixed(0)}K supports spending power` });
		if (incomeScore < 40) signals.push({ index: 'demographics', type: 'negative', message: `Lower median income ($${((c.medianHouseholdIncome || 0) / 1000).toFixed(0)}K) may limit average ticket` });
		if (educScore > 70) signals.push({ index: 'demographics', type: 'positive', message: `${c.bachelorsPlusPercent}% college-educated — receptive to specialty concepts` });
	}
	if (r.censusHousing) {
		const h = r.censusHousing;
		if (h.rentBurdenedPct > 50) {
			score = Math.round(score * 0.85);
			signals.push({ index: 'demographics', type: 'negative', message: `${h.rentBurdenedPct}% rent-burdened — less disposable income` });
		}
		if (h.vacancyRate > 15) {
			score = Math.round(score * 0.90);
			signals.push({ index: 'demographics', type: 'negative', message: `${h.vacancyRate}% housing vacancy — possible population decline` });
		} else if (h.vacancyRate < 5) {
			score = Math.round(score * 1.05);
			signals.push({ index: 'demographics', type: 'positive', message: `Only ${h.vacancyRate}% vacancy — strong housing demand` });
		}
	}
	return clamp(score);
}

export function computeCompetitionIndex(r: LocationIntelReport, signals: IndexSignal[]): number {
	let score = 50;
	if (r.competitors) {
		const nearby = r.competitors.rings?.ring1?.length || 0;
		const mid = r.competitors.rings?.ring2?.length || 0;
		const total = nearby + mid;
		if (total === 0) { score = 40; signals.push({ index: 'competition', type: 'neutral', message: 'No direct competitors — unproven market or niche opportunity' }); }
		else if (total <= 3) { score = 85; signals.push({ index: 'competition', type: 'positive', message: `Only ${total} competitors within 800m — validated but uncrowded` }); }
		else if (total <= 8) score = 65;
		else { score = Math.max(25, 65 - (total - 8) * 5); signals.push({ index: 'competition', type: 'negative', message: `${total} competitors within 800m — saturated, differentiation critical` }); }
	}
	if (r.places) {
		const avgRating = r.places.avgRating || 0;
		if (avgRating > 0 && avgRating < 4.0) {
			score = Math.round(score * 1.08);
			signals.push({ index: 'competition', type: 'positive', message: `Average nearby rating ${avgRating.toFixed(1)}★ — quality gap to exploit` });
		}
	}
	if (r.marketDensity) {
		const highChainCats = r.marketDensity.categories.filter((c: any) => c.chainPct > 60 && c.count > 3);
		if (highChainCats.length > 0) {
			score = Math.round(score * 1.05);
			signals.push({ index: 'competition', type: 'positive', message: `Chain-heavy market — opportunity for authentic independent concept` });
		}
	}
	if (r.foursquare) {
		const fsq = r.foursquare;
		if (fsq.categoryDiversity > 15) {
			score = Math.round(score * 1.05);
			signals.push({ index: 'competition', type: 'positive', message: `${fsq.categoryDiversity} business categories (Foursquare 900+ taxonomy) — diverse ecosystem` });
		}
		if (fsq.avgRating > 0 && fsq.avgRating < 7.0) {
			score = Math.round(score * 1.05);
			signals.push({ index: 'competition', type: 'positive', message: `Average Foursquare rating ${fsq.avgRating.toFixed(1)}/10 — quality gap to exploit` });
		}
	}
	return clamp(score);
}

export function pulseTier(score: number): 'Buzzing' | 'Busy' | 'Steady' | 'Quiet' | 'Sleepy' {
	if (score >= 80) return 'Buzzing';
	if (score >= 65) return 'Busy';
	if (score >= 50) return 'Steady';
	if (score >= 35) return 'Quiet';
	return 'Sleepy';
}

export function conceptRevenueModel(businessType: string): 'walk-in' | 'destination' | 'appointment' | 'professional' {
	const key = (businessType || '').toLowerCase().replace(/[^a-z]/g, '_');
	if (/coffee|cafe|qsr|fast|bakery|juice|ice_cream|bar|nightlife/.test(key)) return 'walk-in';
	if (/restaurant|full_service|fine_dining|grocery|market|florist/.test(key)) return 'destination';
	if (/salon|spa|barber|nail|hair|medical|dental|clinic|fitness|yoga|pilates|gym|studio/.test(key)) return 'appointment';
	if (/law|legal|accounting|consult|office|professional/.test(key)) return 'professional';
	return 'walk-in';
}

export function pulseNarrative(tier: string, model: string, conceptRadius: number): string {
	const ring = `${conceptRadius}m`;
	if (tier === 'Sleepy' || 'Quiet') {
		if (model === 'walk-in') return `Concept Pulse — ${tier} (within ${ring}). Your customers walk here on impulse. Inside your ring this block is calm — you'll need to pull people in rather than catch them passing by.`;
		if (model === 'destination') return `Concept Pulse — ${tier} (within ${ring}). Your diners will walk ~10 min for a planned visit. This ring is light on co-visit traffic, so you'll rely on destination marketing more than spillover energy.`;
		if (model === 'appointment') return `Concept Pulse — ${tier} (within ${ring}). You don't need walk-ins, but a quiet ring means less visibility to future clients passing through. Bookings and referrals will carry more of the load.`;
		return `Concept Pulse — ${tier} (within ${ring}). Your ring has light co-tenancy. Credibility and referrals will matter more than foot traffic.`;
	}
	if (tier === 'Steady') return `Concept Pulse — Steady (within ${ring}). Normal commercial life in your trade area — not a draw, not dead. You'll neither ride nor fight the neighborhood.`;
	if (tier === 'Busy') return `Concept Pulse — Busy (within ${ring}). Plenty happening in your ring — steady foot traffic and co-visit opportunities.`;
	return `Concept Pulse — Buzzing (within ${ring}). Packed with activity in your trade area — expect to ride neighbor energy.`;
}

export function computeVibrancyIndex(r: LocationIntelReport, signals: IndexSignal[], businessType: string = 'cafe'): number {
	const FETCH_RADIUS = 500;
	const conceptRadius = getConceptScanRadius(businessType);
	const proximityFactor = Math.min(1.0, conceptRadius / FETCH_RADIUS);

	let score = 50;
	let boosts = 0;
	let boostSum = 0;

	if (r.dcaLicenses) {
		const ecoScore = r.dcaLicenses.ecosystemScore;
		if (ecoScore > 50) { boostSum += (ecoScore - 50) * proximityFactor; boosts++; }
		if (ecoScore > 70) signals.push({ index: 'vibrancy', type: 'positive', message: `Concept Pulse — ${r.dcaLicenses.totalCount} active licensed businesses within 500m drive a thriving ecosystem` });
		const rate = r.dcaLicenses.newBusinessRate;
		if (rate >= 10 && rate <= 25) { signals.push({ index: 'vibrancy', type: 'positive', message: `Concept Pulse — ${rate}% new businesses in 12mo shows healthy turnover` }); boostSum += 10 * proximityFactor; boosts++; }
	}

	if (r.sidewalkCafes) {
		if (r.sidewalkCafes.activeCount > 3) {
			boostSum += 20 * proximityFactor; boosts++;
			signals.push({ index: 'vibrancy', type: 'positive', message: `Concept Pulse — ${r.sidewalkCafes.activeCount} sidewalk café permits and ${r.sidewalkCafes.totalSeatingCapacity} outdoor seats within 500m` });
		} else if (r.sidewalkCafes.activeCount > 0) { boostSum += 10 * proximityFactor; boosts++; }
	}

	if (r.liquorLicenses) {
		if (r.liquorLicenses.nightlifeDensity > 50) { boostSum += Math.min(25, r.liquorLicenses.nightlifeDensity - 50) * proximityFactor; boosts++; }
		if (r.liquorLicenses.nightlifeDensity > 70) signals.push({ index: 'vibrancy', type: 'positive', message: `Concept Pulse — ${r.liquorLicenses.totalCount} liquor licenses indicate an active nightlife corridor` });
	}

	if (r.marketDensity) {
		const vitality = r.marketDensity.commercialVitality;
		if (vitality > 50) { boostSum += Math.min(25, vitality - 50) * proximityFactor; boosts++; }
		if (vitality > 70) signals.push({ index: 'vibrancy', type: 'positive', message: `Concept Pulse — commercial vitality ${vitality}/100 with ${r.marketDensity.totalBusinesses} businesses across ${r.marketDensity.categories.filter((c: any) => c.count > 0).length} categories` });
	}

	if (r.foursquare) {
		const allVenues = r.foursquare.venues || [];
		const nearbyVenues = allVenues.filter((v: { distance: number }) => v.distance <= conceptRadius);
		const farVenues = allVenues.filter((v: { distance: number }) => v.distance > conceptRadius);
		if (nearbyVenues.length > 0) {
			const nearbyAvgPop = nearbyVenues.reduce((sum: number, v: { popularity: number }) => sum + (v.popularity || 0), 0) / nearbyVenues.length;
			if (nearbyAvgPop > 0.3) { boostSum += Math.min(30, nearbyAvgPop * 60); boosts++; }
			if (nearbyAvgPop > 0.5) signals.push({ index: 'vibrancy', type: 'positive', message: `Concept Pulse — ${nearbyVenues.length} venues within ${conceptRadius}m with ${(nearbyAvgPop * 100).toFixed(0)}% avg popularity (strong immediate block)` });
		}
		if (farVenues.length > 0 && nearbyVenues.length === 0) {
			const farAvgPop = farVenues.reduce((sum: number, v: { popularity: number }) => sum + (v.popularity || 0), 0) / farVenues.length;
			if (farAvgPop > 0.5) {
				boostSum += Math.min(15, farAvgPop * 30) * proximityFactor; boosts++;
				signals.push({ index: 'vibrancy', type: 'neutral', message: `Concept Pulse — the buzz is ${conceptRadius}–500m away, not on your immediate block` });
			}
		}
		if (allVenues.length === 0) {
			const traffic = r.foursquare.peakTrafficScore;
			if (traffic > 50) { boostSum += Math.min(30, traffic - 50) * proximityFactor; boosts++; }
			if (r.foursquare.avgPopularity > 0.5) signals.push({ index: 'vibrancy', type: 'positive', message: `Concept Pulse — average venue popularity ${(r.foursquare.avgPopularity * 100).toFixed(0)}% shows the area draws consistent traffic` });
		}
	}

	if (boosts > 0) score = Math.round(50 + (boostSum / boosts));
	if (boosts === 0 && proximityFactor < 0.8) score = 40;

	const tier = pulseTier(score);
	const model = conceptRevenueModel(businessType);
	const narrative = pulseNarrative(tier, model, conceptRadius);
	const signalType: 'positive' | 'negative' | 'neutral' = (tier === 'Buzzing' || tier === 'Busy') ? 'positive' : (tier === 'Sleepy' || tier === 'Quiet') ? 'negative' : 'neutral';
	signals.push({ index: 'vibrancy', type: signalType, message: narrative });

	return clamp(score);
}

export function computeSafetyIndex(r: LocationIntelReport, signals: IndexSignal[]): number {
	let score = 50;
	let crimeScore: number | null = null;
	let qolScore: number | null = null;
	let dobScore: number | null = null;

	if (r.crime) {
		crimeScore = r.crime.crimeScore;
		if (r.crime.crimeScore < 50) signals.push({ index: 'safety', type: 'negative', message: `Safety score ${r.crime.crimeScore}/100 — elevated crime, ${r.crime.violentCount} violent incidents nearby` });
		else if (r.crime.crimeScore > 80) signals.push({ index: 'safety', type: 'positive', message: `Safety score ${r.crime.crimeScore}/100 — low crime area` });
	}

	if (r.complaints311) {
		qolScore = r.complaints311.qualityScore;
		if (r.complaints311.noiseCount > 20) signals.push({ index: 'safety', type: 'negative', message: `${r.complaints311.noiseCount} noise complaints in 3mo — could impact customer experience` });
		if (r.complaints311.qualityScore > 75) signals.push({ index: 'safety', type: 'positive', message: `Quality of life score ${r.complaints311.qualityScore}/100 — well-maintained area` });
	}

	if (r.dob) {
		dobScore = Math.max(10, 65 - Math.round(r.dob.riskScore * 0.60));
		if (r.dob.activeViolationCount > 5) signals.push({ index: 'safety', type: 'negative', message: `${r.dob.activeViolationCount} active building violations — inspect before signing lease` });
	}

	const parts: Array<{ score: number; weight: number }> = [];
	if (crimeScore !== null) parts.push({ score: crimeScore, weight: 0.60 });
	if (qolScore !== null)   parts.push({ score: qolScore,   weight: 0.25 });
	if (dobScore !== null)   parts.push({ score: dobScore,    weight: 0.15 });

	if (parts.length > 0) {
		const totalW = parts.reduce((sum, p) => sum + p.weight, 0);
		score = Math.round(parts.reduce((sum, p) => sum + p.score * (p.weight / totalW), 0));
	}
	return clamp(score);
}

export function computeMomentumIndex(r: LocationIntelReport, signals: IndexSignal[]): number {
	let score = 50;
	let components = 0;
	let componentSum = 0;

	if (r.momentum) {
		componentSum += r.momentum.compositeScore;
		components++;
		for (const sig of r.momentum.trendSignals) {
			const type = r.momentum.direction === 'growing' ? 'positive' : r.momentum.direction === 'declining' ? 'negative' : 'neutral';
			signals.push({ index: 'momentum', type, message: sig });
		}
		if (r.momentum.direction === 'growing') signals.push({ index: 'momentum', type: 'positive', message: `Area trending upward — momentum score ${r.momentum.compositeScore}/100` });
		else if (r.momentum.direction === 'declining') signals.push({ index: 'momentum', type: 'negative', message: `Area momentum declining — score ${r.momentum.compositeScore}/100` });
	}

	if (r.dob) {
		let dobMomentum = 50;
		if (r.dob.newBuildingCount > 3) {
			dobMomentum = 85;
			if (!r.momentum) signals.push({ index: 'momentum', type: 'positive', message: `${r.dob.newBuildingCount} new building permits — significant development activity` });
		} else if (r.dob.newBuildingCount > 0) { dobMomentum = 65; } else { dobMomentum = 40; }
		if (r.dob.permitCount > 10) dobMomentum = Math.min(95, dobMomentum + 10);
		componentSum += dobMomentum;
		components++;
	}

	if (r.pluto) {
		componentSum += r.pluto.developmentPotential;
		components++;
		if (r.pluto.developmentPotential > 70) signals.push({ index: 'momentum', type: 'positive', message: `Development potential ${r.pluto.developmentPotential}/100 — underbuilt area with growth runway` });
		else if (r.pluto.developmentPotential < 30) signals.push({ index: 'momentum', type: 'neutral', message: `Development potential ${r.pluto.developmentPotential}/100 — fully built out, limited growth` });
	}

	if (r.dcaLicenses && !r.momentum) {
		const rate = r.dcaLicenses.newBusinessRate;
		let dcaMomentum = 50;
		if (rate >= 15 && rate <= 25) dcaMomentum = 80;
		else if (rate >= 10) dcaMomentum = 65;
		else if (rate < 5) dcaMomentum = 30;
		else if (rate > 30) dcaMomentum = 50;
		componentSum += dcaMomentum;
		components++;
	}

	if (r.lpc) {
		const count = r.lpc.nearbyLandmarks?.length || 0;
		if (count > 0 || r.lpc.isHistoricDistrict) {
			componentSum += 65;
			components++;
			if (r.lpc.isHistoricDistrict) signals.push({ index: 'momentum', type: 'positive', message: 'Historic district — heritage appeal drives consistent foot traffic' });
		}
	}

	if (components > 0) score = Math.round(componentSum / components);
	return clamp(score);
}
