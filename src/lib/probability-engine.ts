/**
 * Probability Engine — Thread 6B, Gap #3
 *
 * Converts Location IQ × Fit IQ into actionable probability percentages
 * for specific business outcomes. This is the "so what?" layer — it turns
 * abstract 0-100 scores into concrete likelihood numbers the user can act on.
 *
 * Formula philosophy:
 *   - Location IQ tells you "Can ANY business work here?"
 *   - Fit IQ tells you "Does THIS SPECIFIC business fit here?"
 *   - The probability formula combines both to answer: "What are the odds
 *     THIS business succeeds at THIS location?"
 *
 * 100% deterministic. No LLM.
 */

import { getBenchmark, type IndustryBenchmark } from '$lib/industry-benchmarks';

// ── Types ──

export interface ProbabilityResult {
	/** Overall success probability (0-100%) */
	overallSuccess: number;

	/** Per-metric probabilities */
	metrics: ProbabilityMetric[];

	/** Confidence in the estimate (0-100, based on data availability) */
	confidence: number;

	/** Risk tier: low/medium/high/very-high */
	riskTier: 'low' | 'medium' | 'high' | 'very-high';

	/** Human-readable summary sentence */
	summary: string;
}

export interface ProbabilityMetric {
	label: string;
	probability: number;      // 0-100%
	weight: number;            // How much this matters (0-1)
	dataPoints: number;        // How many data points contributed
	explanation: string;
}

export interface ProbabilityInputs {
	locationIQ: number;         // 0-100
	fitIQ: number;              // 0-100
	businessType: string;

	// Six-Index scores (optional, refines the estimate)
	sixIndex?: {
		transit?: number;
		demographics?: number;
		competition?: number;
		vibrancy?: number;
		safety?: number;
		momentum?: number;
	};

	// Fit dimensions (optional)
	fitDimensions?: { label: string; score: number }[];

	// Financial viability (optional, from financial projection engine)
	breakEvenCushion?: number;   // % above break-even (can be negative)
	rentToRevenueRatio?: number; // e.g., 0.08

	// Archetype scores (optional)
	archetypeScore?: number;     // The relevant archetype baseline
}

// ── Core Formula ──

/**
 * The fundamental probability model.
 *
 * P(success) = sigmoid(
 *   w_loc × normalize(LocationIQ) +
 *   w_fit × normalize(FitIQ) +
 *   w_fin × normalize(FinancialViability) +
 *   w_arch × normalize(ArchetypeScore)
 * )
 *
 * Where sigmoid maps the weighted sum to a 0-100% probability,
 * with calibration so that:
 *   - Both scores at 50 → ~50% probability (baseline)
 *   - Both scores at 75 → ~75% probability (good)
 *   - Both scores at 90 → ~92% probability (excellent, but never 100%)
 *   - Both scores at 30 → ~22% probability (poor)
 *   - Scores diverging (IQ high, Fit low) → moderate probability with warning
 */
function sigmoid(x: number): number {
	// Calibrated sigmoid: x=0 → 50%, x=2 → 88%, x=-2 → 12%
	return 100 / (1 + Math.exp(-1.5 * x));
}

function normalize(score: number): number {
	// Map 0-100 to -2 to +2 range (centered at 50)
	return (score - 50) / 25;
}

function computeOverallProbability(inputs: ProbabilityInputs, bench: IndustryBenchmark): number {
	// Base weights
	const w_loc = 0.35;   // Location quality matters most
	const w_fit = 0.35;   // Business-location fit is equally critical
	const w_fin = 0.20;   // Financial viability
	const w_arch = 0.10;  // Archetype alignment (bonus)

	let weightedSum = 0;

	// Location IQ contribution
	weightedSum += w_loc * normalize(inputs.locationIQ);

	// Fit IQ contribution
	weightedSum += w_fit * normalize(inputs.fitIQ);

	// Financial viability contribution
	if (inputs.breakEvenCushion !== undefined) {
		// Cushion > 0 means above break-even (good)
		// Cushion = 30% → score of 65, Cushion = -20% → score of 35
		const finScore = Math.max(0, Math.min(100, 50 + inputs.breakEvenCushion));
		weightedSum += w_fin * normalize(finScore);
	} else {
		// No financial data — use Location IQ as proxy (conservative)
		weightedSum += w_fin * normalize(inputs.locationIQ * 0.8);
	}

	// Archetype alignment
	if (inputs.archetypeScore !== undefined) {
		weightedSum += w_arch * normalize(inputs.archetypeScore);
	} else {
		weightedSum += w_arch * normalize((inputs.locationIQ + inputs.fitIQ) / 2);
	}

	// Rent penalty: if rent-to-revenue > 15%, that's dangerous
	if (inputs.rentToRevenueRatio !== undefined && inputs.rentToRevenueRatio > 0.15) {
		const penalty = (inputs.rentToRevenueRatio - 0.10) * 5; // Each % over 10% costs 5% probability
		weightedSum -= Math.min(0.8, penalty);
	}

	return Math.round(sigmoid(weightedSum));
}

// ── Per-Metric Probabilities ──

function computeMetricProbabilities(inputs: ProbabilityInputs, bench: IndustryBenchmark): ProbabilityMetric[] {
	const metrics: ProbabilityMetric[] = [];

	// ── Foot Traffic Adequacy ──
	{
		let score = inputs.locationIQ;
		let dataPoints = 1;
		if (inputs.sixIndex?.transit !== undefined) {
			score = score * 0.5 + inputs.sixIndex.transit * 0.5 * bench.transitWeight +
				inputs.sixIndex.transit * 0.5 * (1 - bench.transitWeight);
			dataPoints++;
		}
		if (inputs.archetypeScore !== undefined && bench.footTrafficWeight > 0.5) {
			score = score * 0.7 + inputs.archetypeScore * 0.3;
			dataPoints++;
		}
		const prob = Math.round(sigmoid(normalize(score)));
		metrics.push({
			label: 'Foot Traffic Adequacy',
			probability: prob,
			weight: bench.footTrafficWeight,
			dataPoints,
			explanation: prob > 65
				? 'Location has strong foot traffic patterns for your business type'
				: prob > 45
					? 'Foot traffic is moderate — you may need to build destination draw'
					: 'Low foot traffic zone — heavy reliance on marketing and destination traffic',
		});
	}

	// ── Competitive Survival ──
	{
		let score = 50;
		let dataPoints = 0;
		if (inputs.sixIndex?.competition !== undefined) {
			score = inputs.sixIndex.competition;
			dataPoints++;
		}
		const fitCompDim = inputs.fitDimensions?.find(d =>
			d.label.toLowerCase().includes('competition'));
		if (fitCompDim) {
			score = dataPoints > 0 ? score * 0.5 + fitCompDim.score * 0.5 : fitCompDim.score;
			dataPoints++;
		}
		if (dataPoints === 0) { score = inputs.fitIQ; dataPoints = 1; }
		const prob = Math.round(sigmoid(normalize(score)));
		metrics.push({
			label: 'Competitive Survival',
			probability: prob,
			weight: bench.competitionSensitivity,
			dataPoints,
			explanation: prob > 65
				? 'Competitive landscape is favorable — room for a new entrant'
				: prob > 45
					? 'Moderate competition — differentiation will be key'
					: 'Highly competitive area — strong concept and execution required',
		});
	}

	// ── Financial Viability ──
	{
		let score = (inputs.locationIQ + inputs.fitIQ) / 2; // Baseline
		let dataPoints = 2;
		if (inputs.breakEvenCushion !== undefined) {
			score = Math.max(0, Math.min(100, 50 + inputs.breakEvenCushion));
			dataPoints++;
		}
		if (inputs.rentToRevenueRatio !== undefined) {
			const rentScore = inputs.rentToRevenueRatio < 0.08 ? 80 :
				inputs.rentToRevenueRatio < 0.12 ? 60 :
				inputs.rentToRevenueRatio < 0.15 ? 40 : 20;
			score = score * 0.6 + rentScore * 0.4;
			dataPoints++;
		}
		const prob = Math.round(sigmoid(normalize(score)));
		metrics.push({
			label: 'Financial Viability',
			probability: prob,
			weight: 0.9, // Always critical
			dataPoints,
			explanation: prob > 65
				? 'Numbers look healthy — projected to be above break-even'
				: prob > 45
					? 'Tight margins — careful cost management will be essential'
					: 'Financial risk is elevated — revisit rent, pricing, or customer volume assumptions',
		});
	}

	// ── Demographic Alignment ──
	{
		let score = 50;
		let dataPoints = 0;
		if (inputs.sixIndex?.demographics !== undefined) {
			score = inputs.sixIndex.demographics;
			dataPoints++;
		}
		const fitDemDim = inputs.fitDimensions?.find(d =>
			d.label.toLowerCase().includes('demographic') || d.label.toLowerCase().includes('income'));
		if (fitDemDim) {
			score = dataPoints > 0 ? score * 0.5 + fitDemDim.score * 0.5 : fitDemDim.score;
			dataPoints++;
		}
		if (dataPoints === 0) { score = inputs.fitIQ; dataPoints = 1; }
		const prob = Math.round(sigmoid(normalize(score)));
		metrics.push({
			label: 'Demographic Alignment',
			probability: prob,
			weight: bench.demographicsWeight,
			dataPoints,
			explanation: prob > 65
				? 'Local demographics match your target customer profile well'
				: prob > 45
					? 'Partial demographic match — some customer segments align, others do not'
					: 'Demographic mismatch — your target customer is underrepresented in this area',
		});
	}

	// ── Safety & Stability ──
	{
		let score = 70; // NYC baseline is generally safe
		let dataPoints = 0;
		if (inputs.sixIndex?.safety !== undefined) {
			score = inputs.sixIndex.safety;
			dataPoints++;
		}
		if (inputs.sixIndex?.momentum !== undefined) {
			score = score * 0.7 + inputs.sixIndex.momentum * 0.3;
			dataPoints++;
		}
		if (dataPoints === 0) { dataPoints = 1; }
		const prob = Math.round(sigmoid(normalize(score)));
		metrics.push({
			label: 'Safety & Stability',
			probability: prob,
			weight: 0.5,
			dataPoints,
			explanation: prob > 65
				? 'Area is safe and stable — low risk of disruption'
				: prob > 45
					? 'Some safety or stability concerns — factor into insurance and security planning'
					: 'Higher risk area — budget for security measures and higher insurance',
		});
	}

	return metrics;
}

// ── Risk Tier ──

function computeRiskTier(probability: number): ProbabilityResult['riskTier'] {
	if (probability >= 70) return 'low';
	if (probability >= 50) return 'medium';
	if (probability >= 35) return 'high';
	return 'very-high';
}

// ── Confidence Score ──

function computeConfidence(inputs: ProbabilityInputs): number {
	let signals = 2; // locationIQ + fitIQ are always present
	let totalSignals = 10;

	if (inputs.sixIndex) {
		const six = inputs.sixIndex;
		if (six.transit !== undefined) signals++;
		if (six.demographics !== undefined) signals++;
		if (six.competition !== undefined) signals++;
		if (six.vibrancy !== undefined) signals++;
		if (six.safety !== undefined) signals++;
		if (six.momentum !== undefined) signals++;
	}
	if (inputs.fitDimensions?.length) signals++;
	if (inputs.breakEvenCushion !== undefined) signals++;
	if (inputs.rentToRevenueRatio !== undefined) signals++;
	if (inputs.archetypeScore !== undefined) signals++;

	return Math.round((signals / totalSignals) * 100);
}

// ── Summary Generator (deterministic, no LLM) ──

function generateSummary(
	probability: number,
	riskTier: string,
	businessType: string,
	locationIQ: number,
	fitIQ: number
): string {
	const alignment = fitIQ - locationIQ;
	const alignmentNote = Math.abs(alignment) < 5
		? 'Your business concept aligns well with the general location quality.'
		: alignment > 0
			? `Your specific concept scores ${alignment} points above the general location quality — this spot is a better fit for you than for most businesses.`
			: `Your concept scores ${Math.abs(alignment)} points below the general location quality — this location works better for other business types than yours.`;

	if (probability >= 70) {
		return `Strong match. With a ${probability}% estimated success probability, this location shows real promise for a ${businessType} business. ${alignmentNote}`;
	} else if (probability >= 50) {
		return `Moderate match. At ${probability}%, this location could work for a ${businessType} business, but success depends on execution and differentiation. ${alignmentNote}`;
	} else if (probability >= 35) {
		return `Challenging match. A ${probability}% probability means this location has meaningful headwinds for a ${businessType} business. Consider alternatives or plan for higher marketing spend. ${alignmentNote}`;
	} else {
		return `Difficult match. At ${probability}%, the data suggests significant challenges for a ${businessType} here. We recommend exploring other locations unless you have a compelling reason to be in this specific spot. ${alignmentNote}`;
	}
}

// ── Main Entry Point ──

export function computeProbability(inputs: ProbabilityInputs): ProbabilityResult {
	const bench = getBenchmark(inputs.businessType);

	const overallSuccess = computeOverallProbability(inputs, bench);
	const metrics = computeMetricProbabilities(inputs, bench);
	const confidence = computeConfidence(inputs);
	const riskTier = computeRiskTier(overallSuccess);
	const summary = generateSummary(overallSuccess, riskTier, inputs.businessType, inputs.locationIQ, inputs.fitIQ);

	return {
		overallSuccess,
		metrics,
		confidence,
		riskTier,
		summary,
	};
}

// ── API Endpoint Handler ──
// POST /api/probability/compute

import type { RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/auth-middleware';

export const POST: RequestHandler = async ({ request }) => {
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;

	try {
		const body = await request.json() as ProbabilityInputs;

		if (body.locationIQ === undefined || body.fitIQ === undefined || !body.businessType) {
			return new Response(JSON.stringify({
				error: 'Required: locationIQ (0-100), fitIQ (0-100), businessType (string)',
			}), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		const startMs = Date.now();
		const result = computeProbability(body);

		return new Response(JSON.stringify({
			...result,
			_meta: {
				businessType: body.businessType,
				locationIQ: body.locationIQ,
				fitIQ: body.fitIQ,
				durationMs: Date.now() - startMs,
			},
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err) {
		console.error('[Probability] Error:', err);
		return new Response(JSON.stringify({
			error: 'Probability computation failed',
			message: err instanceof Error ? err.message : 'Unknown error',
		}), { status: 500, headers: { 'Content-Type': 'application/json' } });
	}
};
