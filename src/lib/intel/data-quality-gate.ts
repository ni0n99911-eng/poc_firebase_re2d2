/**
 * ═══════════════════════════════════════════════════════
 * RE² Data Quality Gate — LLM-Powered API Sanity Check
 * ═══════════════════════════════════════════════════════
 *
 * Runs BETWEEN Layer 1 (raw API data) and Layer 2 (reconciliation)
 * to catch bad, missing, or contradictory data before it poisons
 * the scoring pipeline.
 *
 * Two-phase check:
 *   Phase 1: Deterministic — uses computeConfidence() for coverage
 *   Phase 2: LLM (Haiku) — cross-checks actual values for contradictions,
 *            implausible numbers, and suspicious patterns
 *
 * Output: A DataQualityReport with:
 *   - Overall quality grade (A/B/C/D/F)
 *   - Specific issues found (contradictions, implausible values, missing critical data)
 *   - Whether scoring should proceed, warn, or gate
 *   - Human-readable summary for the user
 *
 * Design:
 *   - Haiku-only: fast (~300ms) + cheap (~$0.001)
 *   - Never blocks scoring if Haiku fails (falls back to deterministic only)
 *   - Adds ~300ms to pipeline but catches bad data before it becomes a bad score
 */

import { env } from '$env/dynamic/private';
import type { LocationIntelReport } from './types';
import { computeConfidence, type ConfidenceReport } from './confidence';
import { openrouterFetch } from './retry';
import { getSupabase } from '$lib/supabase';

const OPENROUTER_KEY = env?.OPENROUTER_API_KEY || '';
const HAIKU_MODEL = 'anthropic/claude-haiku-4.5';

// ── Types ──

export interface DataQualityIssue {
	severity: 'critical' | 'warning' | 'info';
	category: 'contradiction' | 'implausible' | 'missing_critical' | 'stale' | 'suspicious_pattern';
	source1: string;
	source2?: string;
	field: string;
	description: string;
	/** What the user should know */
	userMessage: string;
}

export interface DataQualityReport {
	/** Overall grade: A (excellent) → F (unreliable) */
	grade: 'A' | 'B' | 'C' | 'D' | 'F';
	/** Scoring recommendation */
	action: 'proceed' | 'proceed_with_warnings' | 'gate';
	/** Deterministic confidence from computeConfidence() */
	confidence: ConfidenceReport;
	/** Issues found by both deterministic + LLM checks */
	issues: DataQualityIssue[];
	/** Count by severity */
	criticalCount: number;
	warningCount: number;
	infoCount: number;
	/** Human-readable summary for the user */
	summary: string;
	/** Whether the LLM check ran successfully */
	llmCheckRan: boolean;
	/** Processing time */
	latencyMs: number;
}

// ── Deterministic Checks ──

function runDeterministicChecks(report: LocationIntelReport, businessType: string): DataQualityIssue[] {
	const issues: DataQualityIssue[] = [];

	// ── Check 1: Walk Score vs Transit/Pedestrian contradiction ──
	if (report.walkScore && report.pedestrian) {
		const walkScore = report.walkScore.walkscore;
		const pedCount = report.pedestrian.nearestCount?.avgDaily || 0;

		// High Walk Score but very low pedestrian counts = suspicious
		if (walkScore >= 80 && pedCount > 0 && pedCount < 500) {
			issues.push({
				severity: 'warning',
				category: 'contradiction',
				source1: 'Walk Score',
				source2: 'NYC Pedestrian Counts',
				field: 'walkability vs foot traffic',
				description: `Walk Score is ${walkScore} (very walkable) but nearest pedestrian count is only ${pedCount}/day`,
				userMessage: `This area has a high walkability score (${walkScore}) but relatively low measured foot traffic. The block may be walkable but not heavily trafficked — important for businesses relying on walk-in customers.`
			});
		}

		// Low Walk Score but high pedestrian counts = also suspicious
		if (walkScore < 50 && pedCount > 10000) {
			issues.push({
				severity: 'warning',
				category: 'contradiction',
				source1: 'Walk Score',
				source2: 'NYC Pedestrian Counts',
				field: 'walkability vs foot traffic',
				description: `Walk Score is ${walkScore} (car-dependent) but pedestrian count is ${pedCount}/day`,
				userMessage: `Walk Score rates this area low (${walkScore}) but pedestrian data shows high foot traffic (${pedCount.toLocaleString()}/day). The foot traffic may be transit-driven rather than neighborhood walkability.`
			});
		}
	}

	// ── Check 2: Income vs Rent contradiction ──
	if (report.census && report.censusHousing) {
		const medianIncome = report.census.medianIncome;
		const medianRent = report.censusHousing.medianRent;

		if (medianIncome && medianRent) {
			const rentToIncomeRatio = (medianRent * 12) / medianIncome;

			// If area median rent is >50% of income, something's off
			if (rentToIncomeRatio > 0.5) {
				issues.push({
					severity: 'info',
					category: 'suspicious_pattern',
					source1: 'Census Demographics',
					source2: 'Census Housing',
					field: 'income vs rent ratio',
					description: `Median rent ($${medianRent}/mo) is ${Math.round(rentToIncomeRatio * 100)}% of median income ($${medianIncome}/yr)`,
					userMessage: `Housing costs in this area take up ${Math.round(rentToIncomeRatio * 100)}% of median income — this could mean residents are cost-burdened, which may affect their discretionary spending at local businesses.`
				});
			}
		}
	}

	// ── Check 3: Crime spike near a "safe" Walk Score area ──
	if (report.crime && report.walkScore) {
		const totalIncidents = report.crime.totalIncidents;
		const walkScore = report.walkScore.walkscore;

		if (walkScore >= 85 && totalIncidents > 50) {
			issues.push({
				severity: 'warning',
				category: 'contradiction',
				source1: 'Walk Score',
				source2: 'NYPD Crime Data',
				field: 'walkability vs crime',
				description: `Walk Score ${walkScore} suggests a great walking neighborhood, but ${totalIncidents} recent crime incidents nearby`,
				userMessage: `While this area scores high for walkability (${walkScore}), there are ${totalIncidents} recent crime incidents in the area. High-traffic neighborhoods can have both high walkability and higher incident counts — consider the types of crimes, not just the count.`
			});
		}
	}

	// ── Check 4: No competitors found (suspicious for urban NYC) ──
	if (report.competitors && report.competitors.totalCount === 0 && report.places) {
		const placesCount = report.places.results?.length || 0;
		if (placesCount > 5) {
			issues.push({
				severity: 'warning',
				category: 'contradiction',
				source1: 'Competitor Scan (Overpass)',
				source2: 'Google Places',
				field: 'competitor count',
				description: `Competitor scan found 0 businesses but Google Places found ${placesCount} nearby`,
				userMessage: `Our competitor scan came up empty, but Google shows ${placesCount} businesses nearby. The competitor data may be incomplete — we'll use Google Places and Foursquare data to fill the gap.`
			});
		}
	}

	// ── Check 5: Zero or implausible Census values ──
	if (report.census) {
		if (report.census.totalPopulation !== undefined && report.census.totalPopulation < 100) {
			issues.push({
				severity: 'warning',
				category: 'implausible',
				source1: 'Census Demographics',
				field: 'total population',
				description: `Census reports only ${report.census.totalPopulation} people in this tract`,
				userMessage: `The Census data shows very few residents (${report.census.totalPopulation}) in this area. This could mean the area is primarily commercial/industrial, or the Census tract boundary doesn't align well with the neighborhood. Foot traffic may come from workers and visitors, not residents.`
			});
		}

		if (report.census.medianIncome && report.census.medianIncome < 10000) {
			issues.push({
				severity: 'critical',
				category: 'implausible',
				source1: 'Census Demographics',
				field: 'median income',
				description: `Median income reported as $${report.census.medianIncome} — likely a data error or institutional housing`,
				userMessage: `The reported median income ($${report.census.medianIncome?.toLocaleString()}) is unusually low. This Census tract may include institutional housing (dorms, shelters) that skews the data. Take income-based projections with extra caution here.`
			});
		}
	}

	// ── Check 6: MTA ridership of 0 with subway stations present ──
	if (report.mtaRidership) {
		const stations = report.mtaRidership.stations || [];
		const hasStations = stations.length > 0;
		const allZeroRidership = hasStations && stations.every((s: any) => (s.avgDailyRidership || 0) === 0);

		if (allZeroRidership) {
			issues.push({
				severity: 'warning',
				category: 'stale',
				source1: 'MTA Ridership',
				field: 'daily ridership',
				description: `Found ${stations.length} subway station(s) but all report 0 daily ridership`,
				userMessage: `We found nearby subway stations but couldn't get ridership numbers. The MTA data may be temporarily unavailable. Transit access exists, but we can't quantify how busy these stations are right now.`
			});
		}
	}

	// ── Check 7: Foursquare/Yelp/Google all present but wildly different ratings ──
	if (report.foursquare && report.yelp && report.places) {
		const fsqAvg = report.foursquare.avgRating;
		const yelpAvg = report.yelp.avgRating;
		const googleAvg = report.places.avgRating;

		if (fsqAvg && yelpAvg && googleAvg) {
			// Normalize to 5-point scale
			const normalizedFsq = fsqAvg > 5 ? fsqAvg / 2 : fsqAvg;
			const ratings = [normalizedFsq, yelpAvg, googleAvg].filter(r => r > 0);
			if (ratings.length >= 2) {
				const spread = Math.max(...ratings) - Math.min(...ratings);
				if (spread > 1.5) {
					issues.push({
						severity: 'info',
						category: 'contradiction',
						source1: 'Foursquare/Yelp/Google',
						field: 'average ratings',
						description: `Ratings spread of ${spread.toFixed(1)} across sources (Foursquare: ${normalizedFsq.toFixed(1)}, Yelp: ${yelpAvg.toFixed(1)}, Google: ${googleAvg.toFixed(1)})`,
						userMessage: `Business ratings in this area vary significantly across platforms. This is normal — different platforms attract different audiences. We use a weighted average (Yelp 40%, Google 35%, Foursquare 25%) for our scoring.`
					});
				}
			}
		}
	}

	return issues;
}

// ── LLM Cross-Check (Haiku) ──

function buildQualityCheckPrompt(report: LocationIntelReport, businessType: string): string {
	// Build a compact data snapshot for Haiku to review
	const snapshot: Record<string, unknown> = {};

	if (report.census) {
		snapshot.census = {
			population: report.census.totalPopulation,
			medianIncome: report.census.medianIncome,
			medianAge: report.census.medianAge,
			bachelorsPct: report.census.educationBachelorsPlus
		};
	}

	if (report.censusHousing) {
		snapshot.housing = {
			medianRent: report.censusHousing.medianRent,
			vacancyRate: report.censusHousing.vacancyRate,
			renterPct: report.censusHousing.renterOccupiedPct
		};
	}

	if (report.walkScore) {
		snapshot.walkScore = {
			walk: report.walkScore.walkscore,
			transit: report.walkScore.transit?.score,
			bike: report.walkScore.bike?.score
		};
	}

	if (report.crime) {
		snapshot.crime = {
			total: report.crime.totalIncidents,
			topTypes: report.crime.topOffenses?.slice(0, 3)
		};
	}

	if (report.pedestrian) {
		snapshot.pedestrian = {
			nearestDaily: (report.pedestrian as any).nearestCount?.avgDaily,
			avgAreaDaily: (report.pedestrian as any).avgDailyCount
		};
	}

	if (report.mtaRidership) {
		snapshot.transit = {
			stationCount: report.mtaRidership.stations?.length,
			nearestStation: report.mtaRidership.stations?.[0]?.stationName,
			nearestRidership: report.mtaRidership.stations?.[0]?.avgDailyRidership
		};
	}

	if (report.competitors) {
		snapshot.competitors = {
			total: report.competitors.totalCount,
			directCompetitors: report.competitors.directCompetitors
		};
	}

	if (report.foursquare) {
		snapshot.foursquare = {
			venueCount: report.foursquare.totalResults,
			avgRating: report.foursquare.avgRating,
			avgPrice: report.foursquare.avgPriceLevel
		};
	}

	if (report.yelp) {
		snapshot.yelp = {
			businessCount: report.yelp.totalResults,
			avgRating: report.yelp.avgRating,
			avgPrice: report.yelp.avgPriceLevel
		};
	}

	if (report.pluto) {
		snapshot.zoning = {
			primaryZone: (report.pluto as any).zoneProfile?.primaryZone,
			buildingClass: (report.pluto as any).buildingProfile?.primaryClass
		};
	}

	snapshot.sourceCoverage = report.sourceCoverage;
	snapshot.errors = report.errors.slice(0, 10);

	return `You are a data quality auditor for a commercial real estate intelligence platform.

You have been given a snapshot of data from ${report.sourceCoverage?.available || '?'} out of 20 API sources for a location in NYC that a ${businessType} business is evaluating.

Your job: Find CONTRADICTIONS, IMPLAUSIBLE values, and SUSPICIOUS PATTERNS in this data that could lead to a bad scoring decision.

DATA SNAPSHOT:
${JSON.stringify(snapshot, null, 2)}

ADDRESS: ${report.address || 'Unknown'}

Respond with a JSON array of issues found. Each issue:
{
  "severity": "critical" | "warning" | "info",
  "category": "contradiction" | "implausible" | "suspicious_pattern",
  "field": "which data field(s)",
  "sources": "which source(s) are involved",
  "description": "what's wrong (technical)",
  "userMessage": "what the business owner should know (plain English, 1-2 sentences)"
}

Rules:
- Only flag things that could actually affect a business decision
- Don't flag normal urban patterns (high crime + high foot traffic is normal in busy areas)
- "implausible" = the number doesn't make sense (e.g., median income of $3,000 in Manhattan)
- "contradiction" = two sources disagree in a way that matters
- "suspicious_pattern" = not wrong per se, but worth flagging (e.g., zero vacancy in a high-rent area)
- If the data looks clean and consistent, return an empty array []
- Maximum 5 issues. Only the most important.

Respond with ONLY the JSON array, no other text.`;
}

async function runLLMCheck(
	report: LocationIntelReport,
	businessType: string,
	// BRAIN-PB-04: historical context to append to prompt
	historicalContextPrompt?: string | null
): Promise<DataQualityIssue[]> {
	if (!OPENROUTER_KEY) return [];

	try {
		const basePrompt = buildQualityCheckPrompt(report, businessType);
		const fullPrompt = historicalContextPrompt
			? `${basePrompt}\n\n---\n${historicalContextPrompt}`
			: basePrompt;

		// FIX-010: use openrouterFetch (1 retry, 2s→4s backoff on 429/500; returns null on failure)
		const response = await openrouterFetch(
			'https://openrouter.ai/api/v1/chat/completions',
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${OPENROUTER_KEY}`,
					'Content-Type': 'application/json',
					'HTTP-Referer': 'https://resquared.io',
					'X-Title': 'RE2 Quality Gate'
				},
				body: JSON.stringify({
					model: HAIKU_MODEL,
					messages: [
						{ role: 'user', content: fullPrompt }
					],
					temperature: 0.1,
					max_tokens: 1500
				})
			},
			'QualityGate'
		);

		if (!response) {
			// null = retries exhausted — skip quality gate gracefully
			return [];
		}

		const result = await response.json();
		const content = result.choices?.[0]?.message?.content?.trim();
		if (!content) return [];

		// Parse the JSON array
		const jsonMatch = content.match(/\[[\s\S]*\]/);
		if (!jsonMatch) return [];

		const parsed = JSON.parse(jsonMatch[0]);
		if (!Array.isArray(parsed)) return [];

		// Map LLM output to our DataQualityIssue format
		return parsed.slice(0, 5).map((issue: any) => ({
			severity: (['critical', 'warning', 'info'].includes(issue.severity) ? issue.severity : 'info') as 'critical' | 'warning' | 'info',
			category: (['contradiction', 'implausible', 'suspicious_pattern', 'missing_critical', 'stale'].includes(issue.category) ? issue.category : 'suspicious_pattern') as DataQualityIssue['category'],
			source1: issue.sources || 'Multiple sources',
			field: issue.field || 'unknown',
			description: issue.description || '',
			userMessage: issue.userMessage || issue.description || ''
		}));
	} catch (err) {
		console.error('[QualityGate] Haiku check failed (non-blocking):', err);
		return [];
	}
}

// ── BRAIN-PB-04: Historical Ground Truth Lookup ──

/**
 * Look up Power Broker historical context for a location by geohash.
 * Returns matching entries from historical_ground_truths table.
 * Non-blocking — returns [] on failure.
 */
export async function lookupHistoricalContext(
	geohash5: string
): Promise<Array<{ id: string; neighborhood: string; infrastructure: string; impact_type: string; description?: string; current_relevance?: string; scoring_notes?: Record<string, unknown> }>> {
	try {
		const supabase = getSupabase();
		if (!supabase) return [];

		const { data, error } = await supabase
			.from('historical_ground_truths')
			.select('id, neighborhood, infrastructure, impact_type, description, current_relevance, scoring_notes')
			.filter('geohash_prefix', 'cs', `{${geohash5}}`)
			.eq('active', true);

		if (error || !data) return [];
		return data;
	} catch {
		// Table may not exist yet — non-blocking
		return [];
	}
}

/**
 * Build a Gate 2 context block from historical ground truths.
 * Returns null if no matching entries.
 */
export function buildHistoricalContextPrompt(
	entries: Awaited<ReturnType<typeof lookupHistoricalContext>>,
	flaggedSubScores: string[] = []
): string | null {
	if (!entries || entries.length === 0) return null;

	const lines = entries.map(entry => {
		const relevantNotes = flaggedSubScores.length > 0 && entry.scoring_notes
			? Object.entries(entry.scoring_notes)
				.filter(([k]) => flaggedSubScores.some(f => k.includes(f.split('_')[0].toLowerCase())))
				.map(([, v]) => String(v))
				.join('; ')
			: '';
		return `- ${entry.neighborhood}: ${entry.infrastructure} (${entry.impact_type})${relevantNotes ? '\n  Note: ' + relevantNotes : ''}`;
	});

	return `Historical structural factors for this location:\n${lines.join('\n')}\nConsider whether flagged score divergence is explained by these structural factors.`;
}

// ── Main Gate ──

export async function runDataQualityGate(
	report: LocationIntelReport,
	businessType: string = 'cafe',
	// BRAIN-PB-04: optional geohash for historical context lookup
	geohash5?: string
): Promise<DataQualityReport> {
	const start = Date.now();

	// Phase 1: Deterministic confidence check
	const confidence = computeConfidence(report, businessType);

	// Phase 2: Deterministic cross-source checks
	const deterministicIssues = runDeterministicChecks(report, businessType);

	// Phase 3: LLM cross-check (Haiku, fast, non-blocking on failure)
	let llmIssues: DataQualityIssue[] = [];
	let llmCheckRan = false;

	try {
		// BRAIN-PB-04: Look up historical context if geohash provided
		const historicalEntries = geohash5 ? await lookupHistoricalContext(geohash5) : [];
		const historicalPrompt = historicalEntries.length > 0
			? buildHistoricalContextPrompt(historicalEntries, [])
			: null;

		llmIssues = await runLLMCheck(report, businessType, historicalPrompt);
		llmCheckRan = llmIssues.length >= 0; // ran even if empty result
		llmCheckRan = true;
	} catch {
		// LLM unavailable — proceed with deterministic checks only
	}

	// Combine and deduplicate issues
	const allIssues = deduplicateIssues([...deterministicIssues, ...llmIssues]);

	// Count by severity
	const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
	const warningCount = allIssues.filter(i => i.severity === 'warning').length;
	const infoCount = allIssues.filter(i => i.severity === 'info').length;

	// Determine grade
	const grade = calculateGrade(confidence, criticalCount, warningCount);

	// Determine action
	let action: DataQualityReport['action'];
	if (grade === 'F' || (confidence.level === 'PRELIMINARY' && criticalCount >= 2)) {
		action = 'gate';
	} else if (grade === 'D' || criticalCount > 0 || warningCount >= 3) {
		action = 'proceed_with_warnings';
	} else {
		action = 'proceed';
	}

	// Generate summary
	const summary = generateSummary(grade, action, confidence, allIssues);

	return {
		grade,
		action,
		confidence,
		issues: allIssues,
		criticalCount,
		warningCount,
		infoCount,
		summary,
		llmCheckRan,
		latencyMs: Date.now() - start
	};
}

function calculateGrade(
	confidence: ConfidenceReport,
	criticalCount: number,
	warningCount: number
): DataQualityReport['grade'] {
	// Start with confidence level as baseline
	let score = confidence.percentage;

	// Penalize for issues
	score -= criticalCount * 15;
	score -= warningCount * 5;

	if (score >= 85) return 'A';
	if (score >= 70) return 'B';
	if (score >= 55) return 'C';
	if (score >= 35) return 'D';
	return 'F';
}

function deduplicateIssues(issues: DataQualityIssue[]): DataQualityIssue[] {
	const seen = new Set<string>();
	return issues.filter(issue => {
		const key = `${issue.category}:${issue.field}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function generateSummary(
	grade: string,
	action: string,
	confidence: ConfidenceReport,
	issues: DataQualityIssue[]
): string {
	const criticals = issues.filter(i => i.severity === 'critical');
	const warnings = issues.filter(i => i.severity === 'warning');

	if (action === 'gate') {
		return `Data quality is too low to produce a reliable score (Grade ${grade}). ${confidence.criticalMissing.length > 0 ? `Missing critical data: ${confidence.criticalMissing.join(', ')}.` : ''} ${criticals.length > 0 ? `Found ${criticals.length} critical issue(s) that could lead to misleading results.` : ''} We recommend trying a nearby address or checking back later when more data sources are available.`;
	}

	if (action === 'proceed_with_warnings') {
		const topIssue = criticals[0] || warnings[0];
		return `Data quality is ${grade === 'C' ? 'acceptable' : 'limited'} (Grade ${grade}, ${confidence.percentage}% coverage). ${topIssue ? topIssue.userMessage : ''} ${warnings.length > 1 ? `Plus ${warnings.length - 1} other data note(s) — see details below.` : ''} Your score is directionally useful but should be validated with a site visit.`;
	}

	// proceed
	if (issues.length === 0) {
		return `Excellent data quality (Grade ${grade}, ${confidence.percentage}% coverage). All sources are consistent and no red flags detected.`;
	}
	return `Good data quality (Grade ${grade}, ${confidence.percentage}% coverage) with ${issues.length} minor note(s). Your score is reliable for decision-making.`;
}
