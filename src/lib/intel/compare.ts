/**
 * Location Comparison Engine.
 *
 * Compare 2-5 locations side-by-side using their Location IQ scores.
 * Produces a ranked comparison with relative strengths/weaknesses
 * and a recommendation signal.
 *
 * Usage:
 *   const comparison = compareLocations(reports, 'cafe');
 *   // returns ranked locations with relative analysis
 */

import type { LocationIntelReport } from './types';
import { computeLocationIQ, type LocationIQReport } from './location-iq';

export interface ComparisonLocation {
	lat: number;
	lng: number;
	address?: string;
	iq: LocationIQReport;
	rank: number;
	relativeStrengths: string[];
	relativeWeaknesses: string[];
}

export interface ComparisonResult {
	locations: ComparisonLocation[];
	businessType: string;
	recommendation: string;
	topPick: number;                // index of best location
	confidenceSpread: number;       // max - min confidence
	iqSpread: number;               // max - min IQ
	dimensionWinners: DimensionWinner[];
	comparedAt: string;
}

export interface DimensionWinner {
	dimension: string;
	winnerIndex: number;
	winnerScore: number;
	spread: number;           // max - min across locations
}

/**
 * Compare multiple locations.
 * Each location needs a pre-fetched LocationIntelReport.
 */
export function compareLocations(
	reports: LocationIntelReport[],
	businessType: string = 'cafe'
): ComparisonResult {
	if (reports.length < 2) {
		throw new Error('Need at least 2 locations to compare');
	}
	if (reports.length > 5) {
		throw new Error('Maximum 5 locations for comparison');
	}

	// Compute IQ for each location
	const iqs = reports.map(r => computeLocationIQ(r, businessType));

	// Rank by Location IQ (descending)
	const indexed = iqs.map((iq, i) => ({ iq, i, report: reports[i] }));
	indexed.sort((a, b) => b.iq.locationIQ - a.iq.locationIQ);

	// Dimension-level analysis
	const dimensions = analyzeDimensions(indexed.map(x => x.iq));

	// Build comparison locations
	const locations: ComparisonLocation[] = indexed.map((item, rank) => {
		const strengths = findRelativeStrengths(item.iq, iqs, rank);
		const weaknesses = findRelativeWeaknesses(item.iq, iqs, rank);

		return {
			lat: item.report.lat,
			lng: item.report.lng,
			address: item.report.address,
			iq: item.iq,
			rank: rank + 1,
			relativeStrengths: strengths,
			relativeWeaknesses: weaknesses
		};
	});

	const iqValues = iqs.map(iq => iq.locationIQ);
	const confValues = iqs.map(iq => iq.confidence);
	const iqSpread = Math.max(...iqValues) - Math.min(...iqValues);
	const confidenceSpread = Math.max(...confValues) - Math.min(...confValues);

	const topPick = indexed[0].i;
	const recommendation = generateRecommendation(locations, iqSpread);

	return {
		locations,
		businessType,
		recommendation,
		topPick,
		confidenceSpread,
		iqSpread,
		dimensionWinners: dimensions,
		comparedAt: new Date().toISOString()
	};
}

function analyzeDimensions(iqs: LocationIQReport[]): DimensionWinner[] {
	const dims: { name: string; getter: (iq: LocationIQReport) => number }[] = [
		{ name: 'Neighborhood IQ', getter: iq => iq.niq },
		{ name: 'Storefront IQ', getter: iq => iq.siq },
		{ name: 'Taste IQ', getter: iq => iq.tiq },
		{ name: 'Transit Access', getter: iq => iq.breakdown.niq.transit },
		{ name: 'Business Ecosystem', getter: iq => iq.breakdown.niq.businessEcosystem },
		{ name: 'Walkability', getter: iq => iq.breakdown.siq.walkability },
		{ name: 'Competition', getter: iq => iq.breakdown.siq.competitors },
		{ name: 'Building Safety', getter: iq => iq.breakdown.siq.buildingRisk },
	];

	return dims.map(dim => {
		const scores = iqs.map(dim.getter);
		const maxScore = Math.max(...scores);
		const minScore = Math.min(...scores);
		const winnerIndex = scores.indexOf(maxScore);

		return {
			dimension: dim.name,
			winnerIndex,
			winnerScore: maxScore,
			spread: maxScore - minScore
		};
	});
}

function findRelativeStrengths(iq: LocationIQReport, all: LocationIQReport[], _rank: number): string[] {
	const strengths: string[] = [];
	const avgNIQ = avg(all.map(x => x.niq));
	const avgSIQ = avg(all.map(x => x.siq));
	const avgTIQ = avg(all.map(x => x.tiq));
	const avgTransit = avg(all.map(x => x.breakdown.niq.transit));
	const avgEco = avg(all.map(x => x.breakdown.niq.businessEcosystem));

	if (iq.niq > avgNIQ + 5) strengths.push(`Stronger neighborhood fundamentals (NIQ ${iq.niq} vs avg ${Math.round(avgNIQ)})`);
	if (iq.siq > avgSIQ + 5) strengths.push(`Better storefront conditions (SIQ ${iq.siq} vs avg ${Math.round(avgSIQ)})`);
	if (iq.tiq > avgTIQ + 5) strengths.push(`Stronger taste/market fit (TIQ ${iq.tiq} vs avg ${Math.round(avgTIQ)})`);
	if (iq.breakdown.niq.transit > avgTransit + 10) strengths.push(`Superior transit access`);
	if (iq.breakdown.niq.businessEcosystem > avgEco + 10) strengths.push(`Healthier business ecosystem`);
	if (iq.breakdown.siq.walkability > 80) strengths.push(`Highly walkable location`);
	if (iq.breakdown.siq.buildingRisk > 80) strengths.push(`Low building risk`);

	return strengths.slice(0, 3);
}

function findRelativeWeaknesses(iq: LocationIQReport, all: LocationIQReport[], _rank: number): string[] {
	const weaknesses: string[] = [];
	const avgNIQ = avg(all.map(x => x.niq));
	const avgSIQ = avg(all.map(x => x.siq));
	const avgTIQ = avg(all.map(x => x.tiq));

	if (iq.niq < avgNIQ - 5) weaknesses.push(`Weaker neighborhood profile (NIQ ${iq.niq} vs avg ${Math.round(avgNIQ)})`);
	if (iq.siq < avgSIQ - 5) weaknesses.push(`Storefront conditions below average (SIQ ${iq.siq} vs avg ${Math.round(avgSIQ)})`);
	if (iq.tiq < avgTIQ - 5) weaknesses.push(`Less favorable market fit (TIQ ${iq.tiq} vs avg ${Math.round(avgTIQ)})`);
	if (iq.breakdown.niq.disruption < 40) weaknesses.push(`Higher disruption risk nearby`);
	if (iq.breakdown.siq.competitors < 35) weaknesses.push(`Saturated competitive landscape`);
	if (iq.confidence < 50) weaknesses.push(`Limited data coverage (${iq.confidence}% confidence)`);

	return weaknesses.slice(0, 3);
}

function generateRecommendation(locations: ComparisonLocation[], iqSpread: number): string {
	const top = locations[0];
	const second = locations[1];

	if (iqSpread < 5) {
		return `These locations are very close in overall IQ. The differences are marginal — focus on lease terms, personal preference, and field conditions to make your final decision.`;
	}

	if (iqSpread < 15) {
		return `Location #1 (IQ ${top.iq.locationIQ}) has a modest edge over #2 (IQ ${second.iq.locationIQ}). The ${top.relativeStrengths[0] || 'overall balance'} makes it the stronger pick, but both are viable — negotiating power and lease terms could tip the balance.`;
	}

	return `Location #1 (IQ ${top.iq.locationIQ}, Grade ${top.iq.grade}) is the clear frontrunner over #2 (IQ ${second.iq.locationIQ}, Grade ${second.iq.grade}). The ${iqSpread}-point spread is significant. ${top.relativeStrengths[0] ? `Key advantage: ${top.relativeStrengths[0]}.` : ''} Proceed with confidence on #1 unless lease terms dramatically favor #2.`;
}

function avg(arr: number[]): number {
	return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}
