<script lang="ts">
	import type { PoSResult, BlockScoreResult } from '../scoring/engines';
	import type { LiveIntelReport } from '../api/geo';
	import type { LocationScoreResult } from '$lib/re2-scores';

	let { score, posData, liveIntel, addr, cafes, stations, locationScoreResult = null, scoreTimedOut = false }: {
		score: BlockScoreResult;
		posData: PoSResult | null;
		liveIntel: LiveIntelReport | null;
		addr: string;
		cafes: number;
		stations: number;
		locationScoreResult?: LocationScoreResult | null;
		scoreTimedOut?: boolean;
	} = $props();

	// Only display the unified RE² score — no fallbacks to PoS or BlockScore
	let isLoading = $derived(locationScoreResult == null && !scoreTimedOut);
	let mainScore = $derived(locationScoreResult?.score ?? 0);
	let verdictColor = $derived(
		scoreTimedOut ? 'neutral' : isLoading ? 'neutral' : mainScore >= 70 ? 'green' : mainScore >= 55 ? 'amber' : 'red'
	);
	let verdictHeadline = $derived(
		scoreTimedOut
			? 'Data unavailable'
			: isLoading
				? 'Analyzing your location...'
				: mainScore >= 70
					? '👍 This looks like a strong location for your concept.'
					: mainScore >= 55
						? '👀 This could work, but there are things to watch.'
						: '⚠️ This location has some serious challenges.'
	);
	let verdictSub = $derived(
		scoreTimedOut
			? 'The data APIs took too long to respond. Try again — cached results may load faster.'
			: isLoading
				? 'Waiting for live data from 20 sources. This usually takes 15–20 seconds.'
				: mainScore >= 70
					? 'The data supports moving forward. Review the details below before making a decision.'
					: mainScore >= 55
						? 'Some signals are good, others need attention. Scroll down to see what to watch for.'
						: 'Key risk factors are flagged below. Consider alternative locations or address the issues first.'
	);

	// Simple 0-100 signal bars that match the landing page language
	// Foot traffic: use the unified scoring engine value if available, else blend Walk Score
	let footTrafficScore = $derived(
		locationScoreResult?.layers?.footTraffic
			? locationScoreResult.layers.footTraffic
			: (liveIntel?.walkScore
				? Math.round((liveIntel.walkScore.walkScore + liveIntel.walkScore.transitScore) / 2)
				: score.transit)
	);
	let demographicsScore = $derived(
		locationScoreResult?.layers?.demographics
			? locationScoreResult.layers.demographics
			: (liveIntel?.census
				? Math.min(100, Math.round(
					(Math.min(liveIntel.census.medianHouseholdIncome / 1200, 100) +
					 Math.min(liveIntel.census.bachelorsPlusPercent * 2, 100)) / 2
				))
				: 65)
	);
	let competitionScore = $derived(
		locationScoreResult?.layers?.competition
			? locationScoreResult.layers.competition
			: score.comp
	);
	let safetyScore = $derived(
		locationScoreResult?.layers?.safety
			? locationScoreResult.layers.safety
			: (liveIntel?.crime ? liveIntel.crime.crimeScore : 70)
	);

	function barLabel(val: number, label?: string): string {
		if (val >= 80) return 'Strong';
		if (val >= 60) return 'Good';
		if (val >= 40) return 'Fair';
		// For competition, a low score means the market is saturated (too many competitors)
		if (label === 'Competition' && cafes > 10) return 'Saturated';
		return 'Weak';
	}
	function colorClass(val: number): string {
		if (val >= 80) return 'cyan';
		if (val >= 60) return 'cyan';
		if (val >= 40) return 'amber';
		return 'red';
	}

	let signals = $derived([
		{ label: 'Foot Traffic', value: footTrafficScore },
		{ label: 'Demographics', value: demographicsScore },
		{ label: 'Competition', value: competitionScore },
		{ label: 'Safety', value: safetyScore },
	]);
</script>

<div class="verdict-card">
	<!-- Score Header — matches landing page score-header pattern -->
	<div class="score-header">
		<div>
			<div class="score-location">Your Score</div>
			<div class="score-address">{addr}</div>
		</div>
		<div class="score-badge {verdictColor}">{scoreTimedOut ? '—' : isLoading ? '...' : mainScore}</div>
	</div>

	<!-- 2x2 Signal Grid — matches landing page score-grid pattern -->
	<div class="score-grid">
		{#each signals as signal}
			<div class="score-item">
				<div class="score-item-label">{signal.label}</div>
				<div class="score-item-row">
					<span class="score-item-value {colorClass(signal.value)}">{signal.value}</span>
					<span class="score-item-meta">{barLabel(signal.value, signal.label)}</span>
				</div>
				<div class="score-item-bar">
					<div class="score-item-fill fill-{colorClass(signal.value)}" style="width:{signal.value}%"></div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Summary line — matches landing page score-summary pattern -->
	<div class="score-summary {verdictColor}">
		<span class="summary-text"><strong>{verdictHeadline}</strong></span>
	</div>
	<div class="score-sub">{verdictSub}</div>

	<!-- Quick Stats -->
	{#if cafes > 0 || stations > 0 || liveIntel?.walkScore || liveIntel?.census}
		<div class="quick-stats">
			<div class="stat-pill">
				<span class="stat-val">{cafes}</span>
				<span class="stat-label">{cafes === 1 ? 'Competitor' : 'Competitors'} nearby</span>
			</div>
			<div class="stat-pill">
				<span class="stat-val">{stations}</span>
				<span class="stat-label">{stations === 1 ? 'Transit station' : 'Transit stations'}</span>
			</div>
			{#if liveIntel?.walkScore}
				<div class="stat-pill">
					<span class="stat-val">{liveIntel.walkScore.walkScore}</span>
					<span class="stat-label">Walk Score</span>
				</div>
			{/if}
			{#if liveIntel?.census}
				<div class="stat-pill">
					<span class="stat-val">${Math.round(liveIntel.census.medianHouseholdIncome / 1000)}k</span>
					<span class="stat-label">Median income</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.verdict-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 28px;
		margin-bottom: 20px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	/* Score Header */
	.score-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 24px;
	}

	.score-location {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--text-secondary);
		margin-bottom: 4px;
	}

	.score-address {
		font-size: 18px;
		font-weight: 700;
		color: var(--text);
	}

	.score-badge {
		font-size: 32px;
		font-weight: 800;
		padding: 10px 22px;
		border-radius: 12px;
		line-height: 1;
		flex-shrink: 0;
	}
	.score-badge.green {
		background: rgba(5, 150, 105, 0.1);
		border: 1px solid rgba(5, 150, 105, 0.2);
		color: var(--green);
	}
	.score-badge.amber {
		background: rgba(180, 83, 9, 0.1);
		border: 1px solid rgba(180, 83, 9, 0.2);
		color: var(--amber);
	}
	.score-badge.red {
		background: rgba(220, 38, 38, 0.1);
		border: 1px solid rgba(220, 38, 38, 0.2);
		color: var(--red);
	}
	.score-badge.neutral {
		background: rgba(100, 116, 139, 0.1);
		border: 1px solid rgba(100, 116, 139, 0.2);
		color: #64748b;
	}

	/* 2x2 Score Grid */
	.score-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 20px;
	}

	.score-item {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 14px 16px;
	}

	.score-item-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: var(--text-secondary);
		margin-bottom: 6px;
	}

	.score-item-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.score-item-value {
		font-size: 20px;
		font-weight: 800;
		font-family: 'Playfair Display', Georgia, serif;
	}
	.score-item-value.cyan { color: var(--teal); }
	.score-item-value.amber { color: var(--amber); }
	.score-item-value.red { color: var(--red); }

	.score-item-meta {
		font-size: 11px;
		color: var(--text-secondary);
	}

	.score-item-bar {
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		margin-top: 8px;
		overflow: hidden;
	}

	.score-item-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 1s ease;
	}
	.fill-cyan { background: var(--teal); }
	.fill-amber { background: var(--amber); }
	.fill-red { background: var(--red); }

	/* Summary */
	.score-summary {
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 16px 18px;
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 15px;
		margin-bottom: 8px;
	}
	.score-summary.green {
		background: rgba(5, 150, 105, 0.06);
		border-color: rgba(5, 150, 105, 0.15);
		color: var(--green);
	}
	.score-summary.amber {
		background: rgba(180, 83, 9, 0.06);
		border-color: rgba(180, 83, 9, 0.15);
		color: var(--amber);
	}
	.score-summary.red {
		background: rgba(220, 38, 38, 0.06);
		border-color: rgba(220, 38, 38, 0.15);
		color: var(--red);
	}
	.score-summary.neutral {
		background: rgba(100, 116, 139, 0.06);
		border-color: rgba(100, 116, 139, 0.15);
		color: #64748b;
	}

	.summary-text {
		font-weight: 600;
	}

	.score-sub {
		font-size: 13px;
		color: var(--text-dim);
		line-height: 1.5;
		margin-bottom: 20px;
		padding: 0 4px;
	}

	/* Quick Stats — pill badges */
	.quick-stats {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.stat-pill {
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding: 8px 14px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 13px;
	}

	.stat-val {
		font-size: 16px;
		font-weight: 700;
		color: var(--teal);
	}

	.stat-label {
		color: var(--text-dim);
		font-size: 12px;
	}

	/* Responsive */
	@media (max-width: 700px) {
		.verdict-card { padding: 20px; }
		.score-header { flex-direction: column; gap: 12px; }
		.score-badge { align-self: flex-start; }
		.score-grid { grid-template-columns: 1fr; }
		.quick-stats { justify-content: flex-start; }
	}
</style>
