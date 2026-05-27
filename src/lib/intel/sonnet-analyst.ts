/**
 * ═══════════════════════════════════════════════════════
 * Section 8B: Sonnet Neighborhood Analyst
 * ═══════════════════════════════════════════════════════
 *
 * Uses Claude Sonnet to perform deep cross-source analysis
 * that connects dots between datasets no single API provides.
 *
 * Analysis capabilities:
 * 1. Market timing: is this neighborhood on the way up, peaked, or declining?
 * 2. Concept-location fit: how well does THIS specific concept match THIS block?
 * 3. Hidden risks: lease traps, upcoming construction, zoning changes
 * 4. Competitive moat analysis: what would protect this business?
 * 5. Revenue projection confidence: how reliable are the financial estimates?
 *
 * This is the "deep reasoning" layer — called asynchronously after
 * initial scoring completes. Results are cached per geohash+businessType.
 *
 * Design:
 * - Sonnet tier: mid-cost, high reasoning quality
 * - Called after Layers 1-3 complete (has full data context)
 * - Results stored in neighborhood_intelligence table
 * - Fire-and-forget: never blocks UI
 */

import { env } from '$env/dynamic/private';
import type { LocationIntelReport } from './types';
import type { ExtrapolationResult } from './extrapolation';
import type { ReconciliationResult } from './reconciliation';
import type { HaikuExtraction } from './haiku-extractor';
import { openrouterFetch } from './retry';

const OPENROUTER_KEY = env?.OPENROUTER_API_KEY || '';
const SONNET_MODEL = 'anthropic/claude-sonnet-4';

// ── Types ──

// BRAIN-COP-03: Lease cost breakdown
export interface LeaseCostBreakdown {
	include: boolean;
	crtApplies: boolean;
	bidZone: string | null;
	estimatedComponents: Array<{ component: string; monthlyEst: string; annualEst: string }>;
	affordabilityVerdict: 'viable' | 'marginal' | 'red_flag' | 'unknown';
	leaseWarnings: string[];
}

export interface NeighborhoodAnalysis {
	marketTiming: MarketTiming;
	conceptFit: ConceptFit;
	hiddenRisks: HiddenRisk[];
	competitiveMoat: CompetitiveMoat;
	revenueConfidence: RevenueConfidence;
	leaseCostBreakdown?: LeaseCostBreakdown;
	executiveSummary: string;
	analyzedAt: string;
	model: string;
	latencyMs: number;
}

export interface MarketTiming {
	phase: 'emerging' | 'growing' | 'peak' | 'mature' | 'declining';
	trajectory: 'accelerating' | 'steady' | 'slowing' | 'reversing';
	confidence: number;
	reasoning: string;
	signals: string[];
	windowOfOpportunity: string;
}

export interface ConceptFit {
	score: number; // 0-100
	grade: string; // A+ to F
	strengths: string[];
	weaknesses: string[];
	dealBreakers: string[];
	oneLineSummary: string;
	// BRAIN-COP-04
	decisionState?: 'STRONG GO' | 'GO WITH REFINEMENTS' | 'WORTH TESTING' | 'HIGH RISK' | 'DO NOT PURSUE';
}

export interface HiddenRisk {
	risk: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	likelihood: number;
	dataSource: string;
	mitigation: string;
}

export interface CompetitiveMoat {
	existingCompetitors: number;
	moatStrength: 'strong' | 'moderate' | 'weak' | 'none';
	primaryAdvantage: string;
	vulnerabilities: string[];
	recommendation: string;
}

export interface RevenueConfidence {
	confidenceLevel: 'high' | 'moderate' | 'low' | 'speculative';
	dataCompleteness: number;
	keyAssumptions: string[];
	biggestUnknown: string;
}

// ── Empty fallback ──

function emptyAnalysis(): NeighborhoodAnalysis {
	return {
		marketTiming: {
			phase: 'mature', trajectory: 'steady', confidence: 0.3,
			reasoning: 'Insufficient data for AI analysis',
			signals: [], windowOfOpportunity: 'Unknown'
		},
		conceptFit: {
			score: 50, grade: 'C', strengths: [], weaknesses: [],
			dealBreakers: [], oneLineSummary: 'Insufficient data for detailed analysis'
		},
		hiddenRisks: [],
		competitiveMoat: {
			existingCompetitors: 0, moatStrength: 'none',
			primaryAdvantage: 'Unknown', vulnerabilities: [],
			recommendation: 'Gather more data before committing'
		},
		revenueConfidence: {
			confidenceLevel: 'speculative', dataCompleteness: 0,
			keyAssumptions: [], biggestUnknown: 'All projections need verification'
		},
		executiveSummary: 'AI analysis unavailable — using deterministic scoring only.',
		analyzedAt: new Date().toISOString(),
		model: 'none',
		latencyMs: 0,
	};
}

// ── Main analysis function ──

// BRAIN-PB-02: Historical context entry from historical_ground_truths
export interface HistoricalContextEntry {
	id: string;
	neighborhood: string;
	infrastructure: string;
	year_range?: string;
	impact_type: string;
	description?: string;
	current_relevance?: string;
	scoring_notes?: Record<string, unknown>;
}

export async function analyzeNeighborhood(
	report: LocationIntelReport,
	reconciled: ReconciliationResult,
	extrapolated: ExtrapolationResult,
	haikuData?: HaikuExtraction | null,
	// BRAIN-PB-02: historical context from Supabase lookup
	historicalContext?: HistoricalContextEntry[] | null,
	// BRAIN-GT: flags from scoring engine
	scoringFlags?: string[] | null
): Promise<NeighborhoodAnalysis> {
	if (!OPENROUTER_KEY) return emptyAnalysis();

	const start = Date.now();
	const briefing = buildAnalystBriefing(report, reconciled, extrapolated, haikuData);

	// BRAIN-PB-02: Build historical context block if entries provided
	let historicalContextBlock = '';
	if (historicalContext && historicalContext.length > 0) {
		const lines = historicalContext.map(entry => {
			const yearStr = entry.year_range ? ` (${entry.year_range})` : '';
			return `### ${entry.neighborhood}: ${entry.infrastructure}${yearStr}\n${entry.description || ''}\nCurrent relevance: ${entry.current_relevance || 'See scoring data.'}`;
		});
		historicalContextBlock = `\n## Historical Context (from documented sources)\nThe following historically documented facts are relevant to this location.\nUse them to EXPLAIN scoring patterns, not to override API data.\nIf current data contradicts historical patterns, note the divergence — it may indicate genuine transformation or a data gap.\n\n${lines.join('\n\n')}\n`;
	}

	// BRAIN-GT: Build scoring flags block
	let scoringFlagsBlock = '';
	if (scoringFlags && scoringFlags.length > 0) {
		scoringFlagsBlock = `\n## Scoring Engine Flags\nThe following flags were raised by the scoring engine for this location:\n${scoringFlags.map(f => `- ${f}`).join('\n')}\nReference these flags in hidden risks and lease economics sections.\n`;
	}

	const systemPrompt = `You are a senior commercial real estate analyst specializing in NYC retail locations. You've been given a comprehensive data briefing about a specific location and business concept.
${historicalContextBlock}${scoringFlagsBlock}
## Professional Broker Assessment Framework (BRAIN-COP-01)
When generating location analysis, frame observations using the 7-criterion professional broker assessment:
1. Business Diversity → use competition sub-score + type_distribution data
2. Concentrated Retail → use vibrancy sub-score + POI density
3. Gathering Spots/Transit → use accessibility sub-score (transit + park proximity)
4. Target Audience Proximity → use demographics + price-income fit sub-scores
5. Visibility (note if data unavailable — flag as unknown)
6. Double-Sided Streets (note if data unavailable — flag as unknown)
7. Parking/Car Access (note if data unavailable — flag for future data collection)

## Lease Economics Intelligence (BRAIN-COP-02)
When relevant (especially for Manhattan or high-rent areas), reference:
- Lease types: Gross (landlord covers expenses) vs NNN (tenant covers all operating costs)
- Escalation benchmark: 2-3% annual is standard. 3% annual = 34% cumulative by year 10
- TI allowance: $20-$80/SF typical. Free rent: 2-6 months during buildout
- Security deposit: 1-3 months rent. Insurance: $3M liability minimum
- 9 Critical Lease Clauses to warn about: Assignment/Subletting ("not unreasonably withheld"), Renewal (fixed rent, not FMV), Permitted Use (broad language), Escalation (cap at 2-3%), TI Allowance ($20-$80/SF), SNDA (pre-approved by lender), Insurance ($3M not $10M+), Default/Remedies (30-day cure), Restoration (as-is condition)
- NYC Legal Traps: CRT (Manhattan <96th St, +3.9%), no commercial rent stabilization (landlord can demand 50%+ at renewal), personal guaranty (negotiate burn-off 3-5 years or cap 6 months)

## Regulatory Cost Calculator (BRAIN-COP-03)
If CRT_ZONE, BID_ZONE, or ADA_RETROFIT_LIKELY flags are present in Scoring Engine Flags above,
include a "leaseCostBreakdown" section in your response with estimated components:
True Occupancy Cost = base_rent + CRT (3.9% if CRT_ZONE) + BID assessment + insurance + ADA retrofit (amortized)
Affordability benchmark: <8% of gross revenue = viable, 8-10% = marginal, >10% = RED FLAG

## Decision States (BRAIN-COP-04)
The RE² scoring system uses 5 decision states based on Fit IQ:
- STRONG GO (75-100): Location-concept match is compelling
- GO WITH REFINEMENTS (65-74): Viable with specific operational adjustments
- WORTH TESTING (50-64): Proceed only if rent is favorable and concept is differentiated
- HIGH RISK (40-49): Significant structural challenges — requires extraordinary concept or terms
- DO NOT PURSUE (0-39): Location does not support this concept type

Align your conceptFit.score and executiveSummary with the appropriate decision state.

Analyze the data and return ONLY valid JSON with this structure:
{
  "marketTiming": {
    "phase": "emerging|growing|peak|mature|declining",
    "trajectory": "accelerating|steady|slowing|reversing",
    "confidence": 0.0-1.0,
    "reasoning": "2-3 sentences connecting specific data points",
    "signals": ["max 4 specific data-backed signals"],
    "windowOfOpportunity": "1 sentence: when to act"
  },
  "conceptFit": {
    "score": 0-100,
    "grade": "A+ through F",
    "strengths": ["max 3, each must reference data"],
    "weaknesses": ["max 3, each must reference data"],
    "dealBreakers": ["only include if truly fatal — empty array is fine"],
    "oneLineSummary": "1 sentence plain-English verdict",
    "decisionState": "STRONG GO|GO WITH REFINEMENTS|WORTH TESTING|HIGH RISK|DO NOT PURSUE"
  },
  "hiddenRisks": [
    {"risk": "what could go wrong", "severity": "critical|high|medium|low", "likelihood": 0.0-1.0, "dataSource": "which data revealed this", "mitigation": "what to do about it"}
  ],
  "competitiveMoat": {
    "existingCompetitors": number,
    "moatStrength": "strong|moderate|weak|none",
    "primaryAdvantage": "this concept's best competitive angle at this location",
    "vulnerabilities": ["max 3"],
    "recommendation": "1-2 sentences"
  },
  "revenueConfidence": {
    "confidenceLevel": "high|moderate|low|speculative",
    "dataCompleteness": 0.0-1.0,
    "keyAssumptions": ["max 3 critical assumptions"],
    "biggestUnknown": "the one thing that could change everything"
  },
  "leaseCostBreakdown": {
    "include": true/false,
    "crtApplies": true/false,
    "bidZone": "BID name or null",
    "estimatedComponents": [{"component": "CRT (3.9%)", "monthlyEst": "$X", "annualEst": "$Y"}],
    "affordabilityVerdict": "viable|marginal|red_flag|unknown",
    "leaseWarnings": ["critical lease clause warnings"]
  },
  "executiveSummary": "3-4 sentences. Lead with the verdict including decision state. Every sentence must contain a specific number or data point. No fluff."
}

Rules:
- Every claim must trace to specific data from the briefing
- Be contrarian when the data warrants it — don't just confirm positive scores
- If data is missing, say so explicitly and lower confidence
- NYC-specific: reference neighborhoods, subway lines, zoning by name
- Max 3 hidden risks, max 3 deal breakers
- Include leaseCostBreakdown.include=true if CRT_ZONE or BID_ZONE flags are present
- Grade scale: A+ (95+), A (90-94), A- (87-89), B+ (83-86), B (78-82), B- (74-77), C+ (70-73), C (65-69), C- (60-64), D (50-59), F (<50)`;

	try {
		// FIX-010: use openrouterFetch (1 retry, 2s→4s backoff on 429/500; returns null on failure)
		const response = await openrouterFetch(
			'https://openrouter.ai/api/v1/chat/completions',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${OPENROUTER_KEY}`,
					'HTTP-Referer': 'https://resquared.io',
					'X-Title': 'RE² Neighborhood Analyst'
				},
				body: JSON.stringify({
					model: SONNET_MODEL,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: briefing }
					],
					temperature: 0.4,
					max_tokens: 2000
				})
			},
			'SonnetAnalyst'
		);

		if (!response) {
			// null = retries exhausted — graceful degrade
			return emptyAnalysis();
		}

		const completion = await response.json();
		const content = completion.choices?.[0]?.message?.content || '';
		const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

		try {
			const parsed = JSON.parse(cleaned);

			// Validate and clamp values
			const analysis: NeighborhoodAnalysis = {
				marketTiming: {
					phase: parsed.marketTiming?.phase || 'mature',
					trajectory: parsed.marketTiming?.trajectory || 'steady',
					confidence: Math.min(1, Math.max(0, parsed.marketTiming?.confidence || 0.5)),
					reasoning: parsed.marketTiming?.reasoning || '',
					signals: (parsed.marketTiming?.signals || []).slice(0, 4),
					windowOfOpportunity: parsed.marketTiming?.windowOfOpportunity || 'Unclear',
				},
				conceptFit: {
					score: Math.min(100, Math.max(0, parsed.conceptFit?.score || 50)),
					grade: parsed.conceptFit?.grade || 'C',
					strengths: (parsed.conceptFit?.strengths || []).slice(0, 3),
					weaknesses: (parsed.conceptFit?.weaknesses || []).slice(0, 3),
					dealBreakers: (parsed.conceptFit?.dealBreakers || []).slice(0, 3),
					oneLineSummary: parsed.conceptFit?.oneLineSummary || '',
				},
				hiddenRisks: (parsed.hiddenRisks || []).slice(0, 5).map((r: any) => ({
					risk: r.risk || '',
					severity: r.severity || 'medium',
					likelihood: Math.min(1, Math.max(0, r.likelihood || 0.5)),
					dataSource: r.dataSource || 'unknown',
					mitigation: r.mitigation || '',
				})),
				competitiveMoat: {
					existingCompetitors: parsed.competitiveMoat?.existingCompetitors || 0,
					moatStrength: parsed.competitiveMoat?.moatStrength || 'none',
					primaryAdvantage: parsed.competitiveMoat?.primaryAdvantage || '',
					vulnerabilities: (parsed.competitiveMoat?.vulnerabilities || []).slice(0, 3),
					recommendation: parsed.competitiveMoat?.recommendation || '',
				},
				revenueConfidence: {
					confidenceLevel: parsed.revenueConfidence?.confidenceLevel || 'speculative',
					dataCompleteness: Math.min(1, Math.max(0, parsed.revenueConfidence?.dataCompleteness || 0)),
					keyAssumptions: (parsed.revenueConfidence?.keyAssumptions || []).slice(0, 3),
					biggestUnknown: parsed.revenueConfidence?.biggestUnknown || '',
				},
				executiveSummary: parsed.executiveSummary || 'Analysis complete.',
				analyzedAt: new Date().toISOString(),
				model: SONNET_MODEL,
				latencyMs: Date.now() - start,
			};

			return analysis;
		} catch {
			console.error('[SonnetAnalyst] JSON parse failed');
			return emptyAnalysis();
		}
	} catch (err) {
		console.error('[SonnetAnalyst] Fetch error:', err);
		return emptyAnalysis();
	}
}

// ── Build analyst briefing from all available data ──

function buildAnalystBriefing(
	report: LocationIntelReport,
	reconciled: ReconciliationResult,
	extrapolated: ExtrapolationResult,
	haikuData?: HaikuExtraction | null
): string {
	const sections: string[] = [];

	sections.push(`# Location Analysis Briefing`);
	sections.push(`Address: ${report.address || `${report.lat}, ${report.lng}`}`);
	sections.push(`Business Type: ${report.businessType}`);
	sections.push(`Data Sources Available: ${report.sourceCoverage?.available || 0}/${report.sourceCoverage?.total || 20}`);

	// Demographics
	if (report.census) {
		const c = report.census as any;
		sections.push(`\n## Demographics`);
		sections.push(`Median household income: $${c.medianIncome?.toLocaleString() || '?'}`);
		sections.push(`Population density: ${c.populationDensity?.toLocaleString() || '?'}/sqmi`);
		if (c.medianAge) sections.push(`Median age: ${c.medianAge}`);
		if (c.bachelorsPct) sections.push(`College educated: ${c.bachelorsPct}%`);
	}

	if (report.censusHousing) {
		const h = report.censusHousing as any;
		if (h.medianRent) sections.push(`Median rent: $${h.medianRent?.toLocaleString()}`);
		if (h.vacancyRate) sections.push(`Vacancy rate: ${h.vacancyRate}%`);
	}

	// Transit & foot traffic
	sections.push(`\n## Transit & Foot Traffic`);
	if (report.walkScore) {
		const ws = report.walkScore as any;
		sections.push(`Walk Score: ${ws.walkscore || '?'}, Transit: ${ws.transit?.score || '?'}, Bike: ${ws.bike?.score || '?'}`);
	}
	if (report.mtaRidership?.stations?.length) {
		report.mtaRidership.stations.slice(0, 3).forEach(s => {
			sections.push(`Subway: ${s.stationName} — ${s.avgDailyRidership?.toLocaleString() || '?'} daily riders`);
		});
	}
	if (report.pedestrian?.counts?.length) {
		const p = report.pedestrian.counts[0] as any;
		sections.push(`Pedestrian count: ${p.count?.toLocaleString() || '?'} (${p.location || 'nearby'})`);
	}

	// Competition
	sections.push(`\n## Competition`);
	if (reconciled) {
		sections.push(`Unique entities (deduplicated): ${reconciled.totalEntities}`);
		sections.push(`Cross-source conflicts resolved: ${reconciled.conflictsResolved}`);
	}
	if (report.places?.results?.length) {
		sections.push(`Google Places competitors: ${report.places.results.length}`);
		const avgRating = report.places.results.reduce((s, p) => s + (p.rating || 0), 0) / report.places.results.length;
		sections.push(`Average competitor rating: ${avgRating.toFixed(1)}/5`);
	}
	if (report.yelp?.businesses?.length) {
		sections.push(`Yelp businesses: ${report.yelp.businesses.length}`);
		const priceDist = report.yelp.businesses.reduce((acc: Record<string, number>, b) => {
			const p = (b as any).price || '?';
			acc[p] = (acc[p] || 0) + 1;
			return acc;
		}, {});
		sections.push(`Price distribution: ${JSON.stringify(priceDist)}`);
	}

	// Market density
	if (report.marketDensity?.categories?.length) {
		sections.push(`\n## Market Ecosystem (500m)`);
		report.marketDensity.categories.forEach((c: any) => {
			sections.push(`${c.category}: ${c.count}`);
		});
	}

	// Safety & quality of life
	sections.push(`\n## Safety & Quality of Life`);
	if (report.crime) {
		const cr = report.crime as any;
		sections.push(`Crime incidents (500m): ${cr.totalIncidents || cr.total || '?'}`);
	}
	if (report.complaints311) {
		const c311 = report.complaints311 as any;
		sections.push(`311 complaints: ${c311.total || c311.complaints?.length || '?'}`);
	}
	if (report.dob) {
		const dob = report.dob as any;
		sections.push(`DOB violations: ${dob.violations?.length || dob.totalViolations || '?'}`);
		sections.push(`Active permits: ${dob.permits?.length || dob.totalPermits || '?'}`);
	}

	// Vibrancy signals
	sections.push(`\n## Vibrancy`);
	if (report.sidewalkCafes) {
		const sc = report.sidewalkCafes as any;
		sections.push(`Sidewalk café permits: ${sc.total || sc.permits?.length || 0}`);
	}
	if (report.liquorLicenses) {
		const ll = report.liquorLicenses as any;
		sections.push(`Liquor licenses: ${ll.total || ll.licenses?.length || 0}`);
	}
	if (report.dcaLicenses) {
		const d = report.dcaLicenses as any;
		sections.push(`Active business licenses: ${d.totalActive || d.total || '?'}`);
		if (d.newBusinessRate) sections.push(`New business rate: ${d.newBusinessRate}%`);
	}

	// Zoning
	if (report.pluto) {
		const pl = report.pluto as any;
		sections.push(`\n## Zoning`);
		if (pl.zoneDistrict || pl.zone) sections.push(`Zone: ${pl.zoneDistrict || pl.zone}`);
		if (pl.buildingClass) sections.push(`Building class: ${pl.buildingClass}`);
		if (pl.far) sections.push(`FAR: ${pl.far}`);
	}

	// Momentum
	if (report.momentum) {
		const m = report.momentum as any;
		sections.push(`\n## Momentum`);
		if (m.signals?.length) {
			m.signals.slice(0, 5).forEach((s: any) => {
				sections.push(`- ${s.description || s.signal}: ${s.direction || s.trend || '?'}`);
			});
		}
	}

	// Layer 3 extrapolations (deterministic)
	if (extrapolated.extrapolations.length > 0) {
		sections.push(`\n## Deterministic Extrapolations (Layer 3)`);
		extrapolated.extrapolations.slice(0, 8).forEach(e => {
			sections.push(`- [${e.category}] ${e.title}: ${e.interpretation} (confidence: ${(e.confidence * 100).toFixed(0)}%, sentiment: ${e.sentiment})`);
		});
	}

	// Haiku extraction results
	if (haikuData && haikuData.model !== 'none') {
		sections.push(`\n## Haiku AI Extraction Results`);
		if (haikuData.competitorFreshness.length) {
			sections.push(`Competitor freshness:`);
			haikuData.competitorFreshness.forEach(c => {
				sections.push(`- ${c.name}: ${c.estimatedAge} (confidence: ${c.confidence})`);
			});
		}
		if (haikuData.conceptGaps.length) {
			sections.push(`Concept gaps identified:`);
			haikuData.conceptGaps.forEach(g => {
				sections.push(`- Missing: ${g.missingType} — ${g.reasoning}`);
			});
		}
		if (haikuData.pricePositioning) {
			sections.push(`Price positioning: avg level ${haikuData.pricePositioning.areaAvgPriceLevel}, opening for ${haikuData.pricePositioning.openingFor}`);
		}
		if (haikuData.footTrafficPatterns.length) {
			sections.push(`Foot traffic patterns:`);
			haikuData.footTrafficPatterns.forEach(f => {
				sections.push(`- ${f.timeSlot}: ${f.intensity} (${f.primaryDrivers.join(', ')})`);
			});
		}
	}

	return sections.join('\n');
}
