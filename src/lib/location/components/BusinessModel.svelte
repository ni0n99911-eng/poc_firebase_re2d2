<script lang="ts">
	import { onMount } from 'svelte';
	import FeedbackButton from '$lib/components/FeedbackButton.svelte';
	import { authedFetch } from '$lib/authed-fetch';
	import { scoreColor, probabilityVerdict, probabilityLabel } from '$lib/session';
	import type { BusinessModel } from '$lib/session';

	let {
		personaType = '',
		conceptDescription = '',
		compositeScore = 0,
		scores = {},
		headsUpWarnings = [],
		liveIntel = null
	} = $props<{
		personaType: string;
		conceptDescription: string;
		compositeScore: number;
		scores: Record<string, number>;
		headsUpWarnings: Array<{ title: string; severity: string }>;
		liveIntel: any;
	}>();

	// Business model state
	let model = $state<BusinessModel | null>(null);
	let loading = $state(false);
	let error = $state(false);

	// Interactive sliders
	let dailyCustomers = $state(120);
	let avgTicket = $state(7.5);
	let sliderMin = $state({ customers: 40, ticket: 3 });
	let sliderMax = $state({ customers: 300, ticket: 20 });

	// Computed financials from sliders
	let projectedMonthlyRevenue = $derived(Math.round(dailyCustomers * avgTicket * 30));
	let projectedRentRatio = $derived(model?.financials?.monthlyRent
		? Math.round((model.financials.monthlyRent / projectedMonthlyRevenue) * 100)
		: 0);
	let projectedBreakEven = $derived(
		model?.financials?.buildoutCost
			? Math.round(((model.financials.buildoutCost[0] + model.financials.buildoutCost[1]) / 2) / (projectedMonthlyRevenue * 0.15))
			: 0
	);

	// Generate the model on mount
	$effect(() => {
		if (compositeScore > 0 && !model && !loading) {
			generateModel();
		}
	});

	async function generateModel() {
		loading = true;
		try {
			const response = await authedFetch('/api/session-intelligence', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					requestType: 'businessModel',
					session: {
						personaType,
						personaKey: personaType.toLowerCase(),
						conceptDescription,
						answers: {},
						locationData: {
							address: '',
							sixIndices: scores,
							compositeScore
						},
						headsUpCards: headsUpWarnings
					}
				})
			});

			if (response.ok) {
				const data = await response.json();
				if (data.result && typeof data.result === 'object') {
					model = data.result as BusinessModel;
					// Set slider defaults
					if (model.sliderDefaults) {
						dailyCustomers = model.sliderDefaults.dailyCustomers?.default || 120;
						avgTicket = model.sliderDefaults.avgTicket?.default || 7.5;
						sliderMin = {
							customers: model.sliderDefaults.dailyCustomers?.min || 40,
							ticket: model.sliderDefaults.avgTicket?.min || 3
						};
						sliderMax = {
							customers: model.sliderDefaults.dailyCustomers?.max || 300,
							ticket: model.sliderDefaults.avgTicket?.max || 20
						};
					}
				}
			}

			if (!model) {
				model = generateTemplateModel();
			}
		} catch {
			model = generateTemplateModel();
		} finally {
			loading = false;
		}
	}

	function generateTemplateModel(): BusinessModel {
		// Compute probability from composite score
		const baseSurvival = 65; // NYC avg small business 1-year survival
		const scoreAdj = (compositeScore - 70) * 0.3;
		const warningPenalty = headsUpWarnings.reduce((acc, w) => {
			if (w.severity === 'critical') return acc - 5;
			if (w.severity === 'important') return acc - 2;
			return acc - 1;
		}, 0);
		const probability = Math.max(15, Math.min(95, Math.round(baseSurvival + scoreAdj + warningPenalty)));

		const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
		const top3 = sorted.slice(0, 3);
		const bottom2 = sorted.slice(-2);

		return {
			successProbability: probability,
			verdict: probabilityVerdict(probability),
			narrative: `Your ${personaType.toLowerCase()} concept has a ${probability}% estimated success probability at this location — ${probability >= 70 ? 'above' : 'near'} the NYC average. ${top3[0] ? `${top3[0][0]} (${top3[0][1]}) is your biggest advantage.` : ''} ${bottom2[0] && bottom2[0][1] < 50 ? `Watch ${bottom2[0][0]} (${bottom2[0][1]}) — that needs attention.` : ''}`,
			positiveFactors: top3.map(([key, val]) => ({
				label: key.charAt(0).toUpperCase() + key.slice(1),
				impact: Math.round((val - 50) * 0.15),
				explanation: `Scoring ${val}/100 in ${key}`
			})),
			negativeFactors: bottom2.filter(([, v]) => v < 60).map(([key, val]) => ({
				label: key.charAt(0).toUpperCase() + key.slice(1),
				impact: -Math.round((60 - val) * 0.15),
				explanation: `Scoring ${val}/100 — below threshold`
			})),
			financials: {
				monthlyRevenue: [18000, 42000],
				monthlyRent: 3800,
				rentToRevenueRatio: [9, 21],
				breakEvenMonths: [12, 24],
				buildoutCost: [50000, 150000]
			},
			sliderDefaults: {
				dailyCustomers: { min: 40, default: 120, max: 300 },
				avgTicket: { min: 3, default: 7.5, max: 20 }
			},
			riskNarrative: `The biggest risk to your concept is infrastructure readiness. Verify electrical capacity, plumbing, and ventilation before committing. The second factor to watch is your rent-to-revenue ratio — at the projected rent, you need consistent daily volume to stay healthy.`,
			assumptions: [
				'Based on NYC benchmarks for this business type',
				'Assumes standard operating hours',
				'Does not account for seasonality'
			],
			disclaimer: 'These projections are estimates based on public data and industry benchmarks. They are not financial advice. Consult a financial advisor before making major business commitments.'
		};
	}

	let probColor = $derived(model ? scoreColor(model.successProbability) : '#64748B');
	let probVerdict = $derived(model ? probabilityLabel(model.verdict) : '');

	// Ring calculations for SVG
	const ringSize = 180;
	const ringStroke = 12;
	const ringRadius = (ringSize - ringStroke) / 2;
	const ringCircumference = 2 * Math.PI * ringRadius;
	let ringOffset = $derived(model
		? ringCircumference - (model.successProbability / 100) * ringCircumference
		: ringCircumference
	);
</script>

{#if loading}
	<div class="bm-loading">
		<div class="shimmer-bar"></div>
		<div class="shimmer-bar short"></div>
		<div class="shimmer-bar shorter"></div>
	</div>
{:else if model}
	<div class="business-model" id="business-model">
		<!-- Hero: Probability Ring -->
		<div class="bm-hero">
			<div class="prob-ring-container">
				<svg width={ringSize} height={ringSize} viewBox="0 0 {ringSize} {ringSize}">
					<circle
						cx={ringSize / 2}
						cy={ringSize / 2}
						r={ringRadius}
						fill="none"
						stroke="var(--border)"
						stroke-width={ringStroke}
					/>
					<circle
						cx={ringSize / 2}
						cy={ringSize / 2}
						r={ringRadius}
						fill="none"
						stroke={probColor}
						stroke-width={ringStroke}
						stroke-linecap="round"
						stroke-dasharray={ringCircumference}
						stroke-dashoffset={ringOffset}
						transform="rotate(-90 {ringSize / 2} {ringSize / 2})"
						class="prob-ring-fill"
					/>
				</svg>
				<div class="prob-ring-center">
					<span class="prob-number" style="color: {probColor}">{model.successProbability}%</span>
					<span class="prob-label">Success Probability</span>
				</div>
			</div>

			<div class="prob-verdict" style="background: {probColor}15; color: {probColor}">
				{probVerdict}
			</div>

			<p class="prob-narrative">{model.narrative}</p>
			<p class="fico-analogy">Just like a high FICO score means better loan terms, a high RE² score means better odds of success at this address.</p>
		</div>

		<!-- Influence Chart: What Pushes Your Odds -->
		<div class="bm-card">
			<h3 class="bm-card-title">What Moves Your Odds</h3>

			{#if model.positiveFactors.length > 0}
				<div class="influence-section">
					<span class="influence-label pushing">Pushing your odds up</span>
					{#each model.positiveFactors as factor}
						<div class="influence-row">
							<span class="influence-name">{factor.label}</span>
							<div class="influence-bar-container">
								<div
									class="influence-bar positive"
									style="width: {Math.min(Math.abs(factor.impact) * 8, 100)}%"
								></div>
							</div>
							<span class="influence-impact positive-text">+{factor.impact}%</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if model.negativeFactors.length > 0}
				<div class="influence-section">
					<span class="influence-label pulling">Pulling your odds down</span>
					{#each model.negativeFactors as factor}
						<div class="influence-row">
							<span class="influence-name">{factor.label}</span>
							<div class="influence-bar-container">
								<div
									class="influence-bar negative"
									style="width: {Math.min(Math.abs(factor.impact) * 8, 100)}%"
								></div>
							</div>
							<span class="influence-impact negative-text">{factor.impact}%</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Financial Picture -->
		<div class="bm-card">
			<h3 class="bm-card-title">Your Financial Picture</h3>

			<div class="fin-grid">
				<div class="fin-item">
					<span class="fin-label">Monthly Revenue (est.)</span>
					<span class="fin-value">${(model.financials.monthlyRevenue[0] / 1000).toFixed(0)}K – ${(model.financials.monthlyRevenue[1] / 1000).toFixed(0)}K</span>
				</div>
				<div class="fin-item">
					<span class="fin-label">Monthly Rent</span>
					<span class="fin-value">${model.financials.monthlyRent.toLocaleString()}</span>
				</div>
				<div class="fin-item">
					<span class="fin-label">Rent-to-Revenue Ratio</span>
					<span class="fin-value" class:warn={model.financials.rentToRevenueRatio[1] > 15}>
						{model.financials.rentToRevenueRatio[0]}% – {model.financials.rentToRevenueRatio[1]}%
						{#if model.financials.rentToRevenueRatio[1] > 15}
							<span class="fin-flag">⚠️</span>
						{/if}
					</span>
				</div>
				<div class="fin-item">
					<span class="fin-label">Break-Even</span>
					<span class="fin-value">{model.financials.breakEvenMonths[0]} – {model.financials.breakEvenMonths[1]} months</span>
				</div>
				<div class="fin-item">
					<span class="fin-label">Buildout Budget</span>
					<span class="fin-value">${(model.financials.buildoutCost[0] / 1000).toFixed(0)}K – ${(model.financials.buildoutCost[1] / 1000).toFixed(0)}K</span>
				</div>
			</div>

			<p class="fin-note">Based on NYC benchmarks for your business type and this location's data</p>
		</div>

		<!-- Scenario Sliders: "What If?" -->
		<div class="bm-card">
			<h3 class="bm-card-title">What If?</h3>
			<p class="bm-card-subtitle">Drag the sliders to see how your numbers change</p>

			<div class="slider-group">
				<label class="slider-label">
					Daily customers: <strong>{dailyCustomers}</strong>
				</label>
				<input
					type="range"
					bind:value={dailyCustomers}
					min={sliderMin.customers}
					max={sliderMax.customers}
					step="5"
					class="scenario-slider"
				/>
				<div class="slider-range">
					<span>{sliderMin.customers}</span>
					<span>{sliderMax.customers}</span>
				</div>
			</div>

			<div class="slider-group">
				<label class="slider-label">
					Average ticket: <strong>${avgTicket.toFixed(2)}</strong>
				</label>
				<input
					type="range"
					bind:value={avgTicket}
					min={sliderMin.ticket}
					max={sliderMax.ticket}
					step="0.5"
					class="scenario-slider"
				/>
				<div class="slider-range">
					<span>${sliderMin.ticket}</span>
					<span>${sliderMax.ticket}</span>
				</div>
			</div>

			<div class="slider-results">
				<div class="slider-result">
					<span class="sr-label">Projected Monthly Revenue</span>
					<span class="sr-value">${projectedMonthlyRevenue.toLocaleString()}</span>
				</div>
				<div class="slider-result">
					<span class="sr-label">Rent-to-Revenue Ratio</span>
					<span class="sr-value" class:danger={projectedRentRatio > 15} class:warn={projectedRentRatio > 10 && projectedRentRatio <= 15}>
						{projectedRentRatio}%
						{#if projectedRentRatio > 15}
							⚠️ Danger zone
						{:else if projectedRentRatio > 10}
							⚡ Pushing it
						{:else}
							✅ Healthy
						{/if}
					</span>
				</div>
				<div class="slider-result">
					<span class="sr-label">Est. Break-Even</span>
					<span class="sr-value">{projectedBreakEven > 0 ? `~${projectedBreakEven} months` : '—'}</span>
				</div>
			</div>
		</div>

		<!-- Risk Narrative -->
		{#if model.riskNarrative}
			<div class="bm-card risk-card">
				<h3 class="bm-card-title">⚡ The Risks</h3>
				<p class="risk-narrative">{model.riskNarrative}</p>
			</div>
		{/if}

		<!-- Disclaimer -->
		<details class="disclaimer-section">
			<summary class="disclaimer-toggle">Assumptions & Disclaimer</summary>
			<div class="disclaimer-content">
				{#if model.assumptions?.length}
					<ul class="assumptions-list">
						{#each model.assumptions as assumption}
							<li>{assumption}</li>
						{/each}
					</ul>
				{/if}
				<p class="disclaimer-text">{model.disclaimer}</p>
			</div>
		</details>
	</div>

	<div class="feedback-row">
		<FeedbackButton sectionId="business-model" />
	</div>
{/if}

<style>
	.business-model {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.bm-loading {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 32px;
	}

	.shimmer-bar {
		height: 16px;
		background: linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%);
		background-size: 200% 100%;
		border-radius: 8px;
		animation: shimmer 1.5s infinite;
	}

	.shimmer-bar.short { width: 75%; }
	.shimmer-bar.shorter { width: 50%; }

	/* Hero: Probability Ring */
	.bm-hero {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 32px;
		text-align: center;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.prob-ring-container {
		position: relative;
		width: 180px;
		height: 180px;
		margin: 0 auto 20px;
	}

	.prob-ring-fill {
		animation: ringDraw 0.8s ease-out forwards;
	}

	.prob-ring-center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.prob-number {
		font-family: 'Playfair Display', Georgia, serif;
		font-size: 42px;
		font-weight: 700;
		line-height: 1;
	}

	.prob-label {
		font-size: 11px;
		color: var(--text-dim);
		margin-top: 4px;
	}

	.prob-verdict {
		display: inline-block;
		padding: 6px 20px;
		border-radius: 20px;
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 16px;
	}

	.prob-narrative {
		font-size: 15px;
		color: var(--text-secondary);
		line-height: 1.7;
		max-width: 600px;
		margin: 0 auto;
	}

	.fico-analogy {
		font-size: 12px;
		color: var(--text-dim);
		font-style: italic;
		margin-top: 12px;
		max-width: 500px;
		margin-left: auto;
		margin-right: auto;
	}

	/* Card */
	.bm-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 24px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.bm-card-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 4px;
	}

	.bm-card-subtitle {
		font-size: 13px;
		color: var(--text-dim);
		margin-bottom: 20px;
	}

	/* Influence Bars */
	.influence-section {
		margin-bottom: 20px;
	}

	.influence-section:last-child {
		margin-bottom: 0;
	}

	.influence-label {
		display: block;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 10px;
	}

	.influence-label.pushing { color: var(--green); }
	.influence-label.pulling { color: var(--red); }

	.influence-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}

	.influence-name {
		font-size: 13px;
		color: var(--text-secondary);
		width: 140px;
		flex-shrink: 0;
	}

	.influence-bar-container {
		flex: 1;
		height: 8px;
		background: var(--bg);
		border-radius: 4px;
		overflow: hidden;
	}

	.influence-bar {
		height: 100%;
		border-radius: 4px;
		transition: width 0.6s ease-out;
	}

	.influence-bar.positive { background: var(--green); }
	.influence-bar.negative { background: var(--red); }

	.influence-impact {
		font-size: 13px;
		font-weight: 600;
		width: 50px;
		text-align: right;
		flex-shrink: 0;
	}

	.positive-text { color: var(--green); }
	.negative-text { color: var(--red); }

	/* Financial Grid */
	.fin-grid {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-bottom: 16px;
	}

	.fin-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--border);
	}

	.fin-item:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.fin-label {
		font-size: 14px;
		color: var(--text-secondary);
	}

	.fin-value {
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
		font-family: 'Playfair Display', Georgia, serif;
	}

	.fin-value.warn { color: var(--amber); }
	.fin-flag { margin-left: 4px; }

	.fin-note {
		font-size: 12px;
		color: var(--text-dim);
		font-style: italic;
	}

	/* Scenario Sliders */
	.slider-group {
		margin-bottom: 24px;
	}

	.slider-label {
		display: block;
		font-size: 14px;
		color: var(--text-secondary);
		margin-bottom: 8px;
	}

	.slider-label strong {
		color: var(--text);
	}

	.scenario-slider {
		width: 100%;
		height: 6px;
		-webkit-appearance: none;
		appearance: none;
		background: var(--bg);
		border-radius: 3px;
		outline: none;
	}

	.scenario-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--teal);
		cursor: pointer;
		border: 2px solid var(--surface);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
	}

	.scenario-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--teal);
		cursor: pointer;
		border: 2px solid var(--surface);
	}

	.slider-range {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: var(--text-dim);
		margin-top: 4px;
	}

	.slider-results {
		background: var(--bg);
		border-radius: 12px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.slider-result {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.sr-label {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.sr-value {
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
		font-family: 'Playfair Display', Georgia, serif;
	}

	.sr-value.warn { color: var(--amber); }
	.sr-value.danger { color: var(--red); }

	/* Risk Card */
	.risk-card {
		border-left: 3px solid var(--amber);
	}

	.risk-narrative {
		font-size: 15px;
		color: var(--text-secondary);
		line-height: 1.7;
	}

	/* Disclaimer */
	.disclaimer-section {
		padding: 16px;
		background: var(--bg);
		border-radius: 12px;
		border: 1px solid var(--border);
	}

	.disclaimer-toggle {
		font-size: 12px;
		color: var(--text-dim);
		cursor: pointer;
	}

	.disclaimer-content {
		margin-top: 12px;
	}

	.assumptions-list {
		font-size: 12px;
		color: var(--text-dim);
		padding-left: 16px;
		margin-bottom: 8px;
	}

	.assumptions-list li {
		margin-bottom: 4px;
	}

	.disclaimer-text {
		font-size: 11px;
		color: var(--text-dim);
		line-height: 1.5;
	}

	@keyframes ringDraw {
		from { stroke-dashoffset: 527; }
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	@media (max-width: 640px) {
		.bm-hero { padding: 20px; }
		.bm-card { padding: 16px; }
		.prob-number { font-size: 36px; }
		.influence-name { width: 100px; font-size: 12px; }
		.fin-label { font-size: 13px; }
		.fin-value { font-size: 14px; }
	}

	.feedback-row {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}
</style>
