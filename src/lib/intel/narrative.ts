/**
 * ═══════════════════════════════════════════════════════
 * Layer 4: AI Narrative Generator
 * ═══════════════════════════════════════════════════════
 *
 * Takes extrapolations (Layer 3) + reconciled entities (Layer 2)
 * and produces human-readable AI narratives with full transparency.
 *
 * Key principles:
 * 1. Every insight carries a disclosure explaining what's real data
 *    vs what's extrapolated/inferred
 * 2. Derivation chains link back through all layers to raw API data
 * 3. Confidence labels help users gauge reliability
 * 4. Narratives are business-type-aware (cafe vs gym vs bar)
 *
 * Can run in two modes:
 * - Local (no LLM): template-based narratives from extrapolation data
 * - AI-enhanced: Claude generates richer narratives (requires API key)
 *
 * Local mode is the default — fast, free, deterministic, and still
 * provides full transparency. AI mode adds nuance and storytelling.
 */

import type { LocationIntelReport } from './types';
import type { ReconciliationResult, EnrichedEntity } from './reconciliation';
import type { ExtrapolationResult, Extrapolation } from './extrapolation';
import { env } from '$env/dynamic/private';
import { openrouterFetch } from './retry';

// ── Types ──

export interface AIInsight {
	insightType: 'verdict' | 'opportunity' | 'risk' | 'recommendation' | 'disclosure';
	title: string;
	narrative: string;
	sentiment: 'great' | 'good' | 'neutral' | 'caution' | 'warning';
	confidence: number;
	confidenceLabel: string;

	// Transparency
	disclosure: string;  // "Based on X real data points + Y extrapolations"
	derivationChain: {
		inputs: { source: string; field: string; value: unknown; cacheKey: string }[];
		logic: string;
		assumptions?: string[];
	};

	// Links to lower layers
	extrapolationIds: string[];  // which extrapolations fed into this
	entityIds: string[];  // which entities were referenced

	// AI metadata
	generatedBy: 'template' | 'claude-sonnet' | 'claude-opus';
}

export interface NarrativeResult {
	insights: AIInsight[];
	totalInsights: number;
	mode: 'local' | 'ai';
	processingMs: number;
	overallVerdict: string;
	overallSentiment: 'great' | 'good' | 'neutral' | 'caution' | 'warning';
	transparencyNote: string;
}

// ── Main generator ──

export async function generateNarratives(
	report: LocationIntelReport,
	reconciled: ReconciliationResult,
	extrapolated: ExtrapolationResult,
	options: { useAI?: boolean } = {}
): Promise<NarrativeResult> {
	const startMs = Date.now();

	// Always generate template-based narratives first
	const insights = generateTemplateNarratives(report, reconciled, extrapolated);

	// If AI mode requested and API key available, enhance with Claude
	const useAI = options.useAI && env.OPENROUTER_API_KEY;
	if (useAI) {
		try {
			const aiInsights = await generateAINarratives(report, reconciled, extrapolated);
			// Merge: AI insights replace template ones with matching insightType
			for (const ai of aiInsights) {
				const idx = insights.findIndex(t => t.insightType === ai.insightType);
				if (idx >= 0) {
					insights[idx] = ai;
				} else {
					insights.push(ai);
				}
			}
		} catch (err) {
			console.warn('[Narrative] AI generation failed, using templates:', err instanceof Error ? err.message : err);
		}
	}

	// Overall verdict
	const sentimentScores = { great: 5, good: 4, neutral: 3, caution: 2, warning: 1 };
	const avgSentiment = insights.reduce((s, i) => s + sentimentScores[i.sentiment], 0) / (insights.length || 1);
	const overallSentiment: NarrativeResult['overallSentiment'] =
		avgSentiment >= 4.5 ? 'great'
			: avgSentiment >= 3.5 ? 'good'
				: avgSentiment >= 2.5 ? 'neutral'
					: avgSentiment >= 1.5 ? 'caution'
						: 'warning';

	const overallVerdict = generateVerdict(report, reconciled, extrapolated, overallSentiment);

	// Transparency note
	const realDataCount = report.sourceCoverage?.available || 0;
	const extrapolationCount = extrapolated.totalCount;
	const transparencyNote =
		`This analysis is based on ${realDataCount} real data sources and ${extrapolationCount} extrapolations. ` +
		`Each insight shows its confidence level and exactly which data points informed it. ` +
		`Extrapolations are clearly labeled — they represent our best inference from available data, not verified facts.`;

	return {
		insights,
		totalInsights: insights.length,
		mode: useAI ? 'ai' : 'local',
		processingMs: Date.now() - startMs,
		overallVerdict,
		overallSentiment,
		transparencyNote,
	};
}

// ── Template-based narratives ──

function generateTemplateNarratives(
	report: LocationIntelReport,
	reconciled: ReconciliationResult,
	extrapolated: ExtrapolationResult
): AIInsight[] {
	const insights: AIInsight[] = [];
	const bt = report.businessType;

	// 1. Location Verdict
	const forceMultipliers = extrapolated.extrapolations.filter(e => e.category === 'force_multiplier' && e.sentiment !== 'warning');
	const risks = extrapolated.extrapolations.filter(e => e.category === 'risk_assessment');
	const demand = extrapolated.extrapolations.find(e => e.extrapolationType === 'estimated_foot_traffic');
	const income = extrapolated.extrapolations.find(e => e.extrapolationType === 'income_demand_alignment');

	const verdictParts: string[] = [];

	if (demand?.value) {
		const traffic = Number(demand.value);
		verdictParts.push(
			traffic >= 5000 ? `High foot traffic area (~${traffic.toLocaleString()}/day).`
				: traffic >= 2000 ? `Moderate foot traffic (~${traffic.toLocaleString()}/day).`
					: `Lower foot traffic area (~${traffic.toLocaleString()}/day).`
		);
	}

	if (forceMultipliers.length > 0) {
		const topFM = forceMultipliers.slice(0, 3).map(f => f.title.replace(/ is a force multiplier.*/, '').toLowerCase());
		verdictParts.push(`Key force multipliers: ${topFM.join(', ')}.`);
	}

	const competitorExtrap = extrapolated.extrapolations.find(e => e.extrapolationType === 'market_saturation');
	if (competitorExtrap) {
		verdictParts.push(competitorExtrap.interpretation.split('.')[0] + '.');
	}

	if (income) {
		verdictParts.push(income.interpretation.split('.')[0] + '.');
	}

	const verdictConfidence = extrapolated.avgConfidence;

	insights.push({
		insightType: 'verdict',
		title: `${capitalize(bt)} Location Assessment`,
		narrative: verdictParts.join(' ') || `Analysis complete for this ${bt} location.`,
		sentiment: forceMultipliers.length >= 3 ? 'great'
			: forceMultipliers.length >= 1 ? 'good'
				: 'neutral',
		confidence: verdictConfidence,
		confidenceLabel: verdictConfidence >= 0.7 ? 'high' : verdictConfidence >= 0.5 ? 'moderate' : 'estimated',
		disclosure: `Verdict based on ${reconciled.totalEntities} reconciled entities from ${report.sourceCoverage?.available || 0} data sources and ${extrapolated.totalCount} extrapolations.`,
		derivationChain: {
			inputs: [
				...(demand?.derivationChain.inputs || []),
				...(income?.derivationChain.inputs || []),
			].slice(0, 5),
			logic: 'Location verdict synthesized from foot traffic estimates, force multiplier analysis, competitive position, and income alignment.',
		},
		extrapolationIds: [
			demand?.extrapolationType,
			income?.extrapolationType,
			competitorExtrap?.extrapolationType,
			...forceMultipliers.map(f => f.extrapolationType),
		].filter(Boolean) as string[],
		entityIds: [],
		generatedBy: 'template',
	});

	// 2. Top Opportunity
	const bestFM = forceMultipliers.sort((a, b) => (b.value || 0) - (a.value || 0))[0];
	if (bestFM) {
		insights.push({
			insightType: 'opportunity',
			title: 'Biggest Opportunity',
			narrative: bestFM.interpretation,
			sentiment: bestFM.sentiment,
			confidence: bestFM.confidence,
			confidenceLabel: bestFM.confidenceLabel,
			disclosure: `This opportunity was identified by cross-referencing ${bestFM.derivationChain.inputs.length} data points from ${[...new Set(bestFM.derivationChain.inputs.map(i => i.source))].join(', ')}.`,
			derivationChain: bestFM.derivationChain,
			extrapolationIds: [bestFM.extrapolationType],
			entityIds: [],
			generatedBy: 'template',
		});
	}

	// 3. Top Risk
	const worstRisk = risks.sort((a, b) => {
		const order = { warning: 0, caution: 1, neutral: 2, good: 3, great: 4 };
		return order[a.sentiment] - order[b.sentiment];
	})[0];
	if (worstRisk) {
		insights.push({
			insightType: 'risk',
			title: 'Key Risk Factor',
			narrative: worstRisk.interpretation,
			sentiment: worstRisk.sentiment,
			confidence: worstRisk.confidence,
			confidenceLabel: worstRisk.confidenceLabel,
			disclosure: `Risk assessment from ${worstRisk.derivationChain.inputs[0]?.source || 'multiple sources'}.`,
			derivationChain: worstRisk.derivationChain,
			extrapolationIds: [worstRisk.extrapolationType],
			entityIds: [],
			generatedBy: 'template',
		});
	}

	// 4. Time-of-day recommendation
	const morning = extrapolated.extrapolations.find(e => e.extrapolationType === 'morning_viability');
	const evening = extrapolated.extrapolations.find(e => e.extrapolationType === 'evening_viability');
	if (morning && evening) {
		const morningVal = morning.value || 0;
		const eveningVal = evening.value || 0;
		const bestTime = morningVal >= eveningVal ? 'morning' : 'evening';
		const bestScore = Math.max(morningVal, eveningVal);
		const worstScore = Math.min(morningVal, eveningVal);

		let timeRec: string;
		if (bestScore - worstScore > 30) {
			timeRec = `This location is significantly stronger for ${bestTime} operations (score: ${bestScore} vs ${worstScore}). ` +
				`A ${bt} here should prioritize ${bestTime} hours for maximum traffic.`;
		} else {
			timeRec = `Morning (${morningVal}) and evening (${eveningVal}) viability are balanced. This location supports all-day operations.`;
		}

		insights.push({
			insightType: 'recommendation',
			title: 'Operating Hours Strategy',
			narrative: timeRec,
			sentiment: bestScore >= 60 ? 'good' : 'caution',
			confidence: (morning.confidence + evening.confidence) / 2,
			confidenceLabel: 'estimated',
			disclosure: `Time-of-day analysis extrapolated from transit patterns, nearby business mix, and crime data. These are estimates, not verified traffic counts.`,
			derivationChain: {
				inputs: [
					...morning.derivationChain.inputs,
					...evening.derivationChain.inputs,
				].slice(0, 6),
				logic: `Compared morning viability (${morningVal}/100) vs evening viability (${eveningVal}/100) to determine optimal operating window.`,
				assumptions: [
					...(morning.derivationChain.assumptions || []),
					...(evening.derivationChain.assumptions || []),
				],
			},
			extrapolationIds: ['morning_viability', 'evening_viability'],
			entityIds: [],
			generatedBy: 'template',
		});
	}

	// 5. Data transparency disclosure
	const realSources = report.sourceCoverage?.available || 0;
	const totalSources = report.sourceCoverage?.total || 20;
	const missingSourceCount = totalSources - realSources;
	const extrapolationCount = extrapolated.totalCount;
	const avgConf = Math.round(extrapolated.avgConfidence * 100);

	insights.push({
		insightType: 'disclosure',
		title: 'How This Analysis Was Built',
		narrative: `This report draws on ${realSources} of ${totalSources} available data sources. ` +
			`${reconciled.poiCount} businesses were identified and deduplicated across Google Places, Foursquare, Yelp, and OpenStreetMap. ` +
			`${reconciled.conflictsResolved} data conflicts were resolved via majority vote or weighted averaging. ` +
			`${extrapolationCount} extrapolations were generated with an average confidence of ${avgConf}%. ` +
			(missingSourceCount > 5
				? `Note: ${missingSourceCount} data sources returned no data, which may affect reliability.`
				: `Data coverage is ${report.sourceCoverage?.pct || 0}% — ${realSources >= 15 ? 'strong' : realSources >= 10 ? 'adequate' : 'limited'}.`),
		sentiment: 'neutral',
		confidence: 1.0, // Meta-insight — always true
		confidenceLabel: 'verified',
		disclosure: 'This is a meta-disclosure about the analysis methodology. All claims here are factual descriptions of the processing pipeline.',
		derivationChain: {
			inputs: [{
				source: 'pipeline_metadata',
				field: 'source_coverage',
				value: { available: realSources, total: totalSources, pct: report.sourceCoverage?.pct },
				cacheKey: 'meta:processing_run',
			}],
			logic: `Summary of Layer 1 (${realSources} raw sources), Layer 2 (${reconciled.totalEntities} entities, ${reconciled.conflictsResolved} conflicts), Layer 3 (${extrapolationCount} extrapolations, ${avgConf}% avg confidence).`,
		},
		extrapolationIds: [],
		entityIds: [],
		generatedBy: 'template',
	});

	return insights;
}

// ── AI-enhanced narratives (Claude) ──

async function generateAINarratives(
	report: LocationIntelReport,
	reconciled: ReconciliationResult,
	extrapolated: ExtrapolationResult
): Promise<AIInsight[]> {
	const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

	// Build a condensed data summary for the LLM
	const topExtrapolations = extrapolated.extrapolations
		.sort((a, b) => b.confidence - a.confidence)
		.slice(0, 8)
		.map(e => ({
			type: e.extrapolationType,
			title: e.title,
			value: e.value,
			unit: e.unit,
			interpretation: e.interpretation,
			sentiment: e.sentiment,
			confidence: e.confidence,
		}));

	const topEntities = reconciled.entities
		.filter(e => e.entityType === 'poi')
		.sort((a, b) => b.sourceCount - a.sourceCount)
		.slice(0, 10)
		.map(e => ({
			name: e.entityName,
			category: e.entityCategory,
			sources: e.sources,
			confidence: e.confidence,
			rating: e.entityData.rating,
		}));

	const systemPrompt = `You are a location intelligence analyst for RE², a platform that helps entrepreneurs evaluate business locations.

Your job is to generate ONE concise narrative insight (2-3 sentences) that synthesizes the extrapolation data into an actionable recommendation.

CRITICAL RULES:
1. NEVER fabricate data points — only reference values present in the provided data
2. Be specific — name actual businesses, exact scores, concrete numbers
3. Clearly distinguish verified data from extrapolations
4. Write for a non-technical entrepreneur
5. Return ONLY valid JSON — no markdown, no code fences

Return JSON:
{
  "title": "string (5-8 words)",
  "narrative": "string (2-3 sentences, actionable)",
  "sentiment": "great|good|neutral|caution|warning"
}`;

	const userMessage = `Business type: ${report.businessType}
Location: ${report.address || `${report.lat}, ${report.lng}`}
Source coverage: ${report.sourceCoverage?.available}/${report.sourceCoverage?.total} sources

Top extrapolations:
${JSON.stringify(topExtrapolations, null, 2)}

Top verified businesses nearby:
${JSON.stringify(topEntities, null, 2)}

Census: median income $${report.census?.medianHouseholdIncome?.toLocaleString() || 'N/A'}, population ${report.census?.totalPopulation?.toLocaleString() || 'N/A'}
Crime score: ${report.crime?.crimeScore || 'N/A'}/100
Transit: ${report.mtaRidership?.totalDailyRidership?.toLocaleString() || 'N/A'} daily riders

Generate one synthesized insight.`;

	// FIX-010: use openrouterFetch (1 retry, 2s→4s backoff on 429/500; returns null on failure)
	const response = await openrouterFetch(
		OPENROUTER_URL,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${env.OPENROUTER_API_KEY || ''}`,
				'HTTP-Referer': 'https://resquared.io',
				'X-Title': 'RE² Narrative Engine',
			},
			body: JSON.stringify({
				model: 'anthropic/claude-sonnet-4',
				max_tokens: 512,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userMessage }
				],
				stream: false,
			}),
		},
		'NarrativeEngine'
	);

	if (!response) {
		// null = retries exhausted — return empty insights, don't throw
		console.error('[NarrativeEngine] OpenRouter retries exhausted — returning empty insights');
		return [];
	}

	const data = await response.json();
	const text = data.choices?.[0]?.message?.content || '';
	const parsed = JSON.parse(text);

	return [{
		insightType: 'verdict',
		title: parsed.title || 'AI Location Analysis',
		narrative: parsed.narrative || '',
		sentiment: parsed.sentiment || 'neutral',
		confidence: extrapolated.avgConfidence,
		confidenceLabel: 'moderate',
		disclosure: `AI-generated narrative synthesizing ${topExtrapolations.length} extrapolations and ${topEntities.length} verified entities. The AI cannot add facts not present in the underlying data.`,
		derivationChain: {
			inputs: topExtrapolations.map(e => ({
				source: 'layer3_extrapolation',
				field: e.type,
				value: e.value,
				cacheKey: `extrapolation:${e.type}`,
			})),
			logic: `Claude Sonnet synthesized ${topExtrapolations.length} extrapolations into a cohesive narrative. All referenced data points are traceable to Layer 1-3.`,
			assumptions: ['AI narrative is bounded by provided extrapolation data', 'No external knowledge injected'],
		},
		extrapolationIds: topExtrapolations.map(e => e.type),
		entityIds: topEntities.map(e => e.name).filter(Boolean) as string[],
		generatedBy: 'claude-sonnet',
	}];
}

// ── Verdict generator ──

function generateVerdict(
	report: LocationIntelReport,
	reconciled: ReconciliationResult,
	extrapolated: ExtrapolationResult,
	overallSentiment: NarrativeResult['overallSentiment']
): string {
	const bt = report.businessType;
	const sources = report.sourceCoverage?.available || 0;

	const verdictMap: Record<string, string> = {
		great: `This location shows strong potential for a ${bt}. Multiple force multipliers, good foot traffic fundamentals, and favorable demographics align well.`,
		good: `This is a solid location for a ${bt} with some clear advantages, though a few factors warrant attention before committing.`,
		neutral: `This location has mixed signals for a ${bt}. Some positive fundamentals but notable gaps or risks that need careful evaluation.`,
		caution: `This location presents challenges for a ${bt}. The data suggests headwinds that would need creative solutions to overcome.`,
		warning: `The data raises significant concerns about this location for a ${bt}. Multiple risk factors suggest reconsidering or conducting much deeper due diligence.`,
	};

	return `${verdictMap[overallSentiment]} (Based on ${sources} data sources, ${reconciled.totalEntities} entities, ${extrapolated.totalCount} extrapolations)`;
}

// ── Utils ──

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}
