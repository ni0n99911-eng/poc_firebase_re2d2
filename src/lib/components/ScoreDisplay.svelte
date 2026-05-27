<script lang="ts">
	import type { LocationScoreResult, AlignmentScoreResult } from '$lib/re2-scores';
	import { onMount } from 'svelte';
	import { getScoreColor, getScoreTint } from '$lib/constants/scoreUtils';

	interface Props {
		locationScore: LocationScoreResult | null;
		alignmentScore: AlignmentScoreResult | null;
		loading?: boolean;
	}

	const { locationScore = null, alignmentScore = null, loading = false } = $props<Props>();

	let expandedLocation = $state(false);
	let expandedAlignment = $state(false);
	let animatedLocScore = $state(0);
	let animatedAlnScore = $state(0);
	let hasAnimated = $state(false);

	// Animate scores on mount
	$effect(() => {
		if (!loading && !hasAnimated && (locationScore || alignmentScore)) {
			hasAnimated = true;
			const targetLoc = locationScore?.score ?? 0;
			const targetAln = alignmentScore?.score ?? 0;
			const duration = 1200;
			const start = performance.now();

			function tick(now: number) {
				const elapsed = now - start;
				const progress = Math.min(elapsed / duration, 1);
				const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
				animatedLocScore = Math.round(targetLoc * ease);
				animatedAlnScore = Math.round(targetAln * ease);
				if (progress < 1) requestAnimationFrame(tick);
			}
			requestAnimationFrame(tick);
		}
	});

	function getGradeColor(grade: string): string {
		switch (grade) {
			case 'A': return '#34C759';
			case 'B': return '#0071E3';
			case 'C': return '#FF9500';
			case 'D': return '#FF3B30';
			default: return 'var(--text-secondary)';
		}
	}

	// getScoreColor imported from scoreUtils — single source of truth
	function getScoreGlow(score: number): string {
		return getScoreTint(score);
	}

	function getGapColor(gap: number): string {
		if (gap >= 15) return '#34C759';
		if (gap >= 5) return '#0071E3';
		if (gap >= -5) return '#FF9500';
		if (gap >= -15) return '#FF3B30';
		return '#FF3B30';
	}

	function getGapLabel(gap: number): string {
		if (gap >= 15) return 'Strong match';
		if (gap >= 5) return 'Good alignment';
		if (gap >= -5) return 'Neutral';
		if (gap >= -15) return 'Moderate tension';
		return 'Significant gap';
	}

	// SVG arc math for gauge rings
	const radius = 72;
	const circumference = 2 * Math.PI * radius;
	const locDash = $derived(`${(animatedLocScore / 100) * circumference} ${circumference}`);
	const alnDash = $derived(`${(animatedAlnScore / 100) * circumference} ${circumference}`);
</script>

<div class="container">
	{#if loading}
		<div class="loading-state">
			<div class="shimmer-card"></div>
			<div class="shimmer-gap"></div>
			<div class="shimmer-card"></div>
		</div>
	{:else}
		<div class="scores-grid">
			<!-- Location Score Card -->
			<div class="score-card">
				<div class="card-header">
					<h2>Your Score</h2>
					<span class="score-type">Universal</span>
				</div>
				<div class="score-content">
					<div class="gauge-container" style="--glow: {getScoreGlow(locationScore?.score ?? 0)}">
						<svg class="gauge" viewBox="0 0 180 180">
							<defs>
								<linearGradient id="locGrad" x1="0%" y1="0%" x2="100%" y2="100%">
									<stop offset="0%" stop-color={getScoreColor(locationScore?.score ?? 0)} stop-opacity="1" />
									<stop offset="100%" stop-color={getScoreColor(locationScore?.score ?? 0)} stop-opacity="0.4" />
								</linearGradient>
							</defs>
							<circle cx="90" cy="90" r={radius} class="bg-ring"></circle>
							<circle
								cx="90" cy="90" r={radius}
								class="score-ring"
								stroke="url(#locGrad)"
								stroke-dasharray={locDash}
							></circle>
						</svg>
						<div class="gauge-center">
							<span class="gauge-score">{animatedLocScore || '—'}</span>
							<span class="gauge-label">/ 100</span>
						</div>
						<div class="grade-badge" style="background: {getGradeColor(locationScore?.grade ?? '')}; box-shadow: 0 2px 12px {getGradeColor(locationScore?.grade ?? '')}44">
							{locationScore?.grade ?? '—'}
						</div>
					</div>
				</div>
				<p class="summary">{locationScore?.summary ?? 'Complete your analysis to see location scores.'}</p>

				<button
					class="expand-button"
					onclick={() => (expandedLocation = !expandedLocation)}
					aria-expanded={expandedLocation}
				>
					<span>Layer Breakdown</span>
					<svg class="expand-icon" style:transform={expandedLocation ? 'rotate(180deg)' : 'rotate(0deg)'} viewBox="0 0 20 20" fill="none" stroke="currentColor">
						<path d="M5 7.5L10 12.5L15 7.5" stroke-width="2" stroke-linecap="round" />
					</svg>
				</button>

				{#if expandedLocation && locationScore?.subScores}
					<div class="sub-scores">
						{#each locationScore.subScores as sub (sub.layer)}
							<div class="sub-score-item">
								<div class="sub-score-header">
									<span class="sub-score-label">{sub.label}</span>
									<span class="sub-score-value" style="color: {getScoreColor(sub.score)}">{sub.score}</span>
								</div>
								<div class="sub-score-bar-bg">
									<div class="sub-score-bar" style="width: {sub.score}%; background: {getScoreColor(sub.score)}"></div>
								</div>
								<div class="sub-score-weight">Weight: {Math.round(sub.weight * 100)}%</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Gap Indicator -->
			{#if locationScore && alignmentScore}
				<div class="gap-indicator">
					<div class="gap-arrow">
						<svg viewBox="0 0 40 80" class="gap-svg">
							<path d="M20 10 L20 70" stroke="#333" stroke-width="2" stroke-dasharray="4,4" />
							<circle cx="20" cy="40" r="18" fill="var(--surface-elevated)" stroke={getGapColor(alignmentScore.gap)} stroke-width="2" />
							<text x="20" y="44" text-anchor="middle" fill={getGapColor(alignmentScore.gap)} font-size="14" font-weight="700">{alignmentScore.gap > 0 ? '+' : ''}{alignmentScore.gap}</text>
						</svg>
					</div>
					<div class="gap-label" style="color: {getGapColor(alignmentScore.gap)}">{getGapLabel(alignmentScore.gap)}</div>
					<p class="gap-interpretation">{alignmentScore.gapInterpretation}</p>
				</div>
			{/if}

			<!-- Alignment Score Card -->
			<div class="score-card">
				<div class="card-header">
					<h2>Score Breakdown</h2>
					<span class="score-type">Personalized</span>
				</div>
				{#if alignmentScore}
					<div class="score-content">
						<div class="gauge-container" style="--glow: {getScoreGlow(alignmentScore.score)}">
							<svg class="gauge" viewBox="0 0 180 180">
								<defs>
									<linearGradient id="alnGrad" x1="0%" y1="0%" x2="100%" y2="100%">
										<stop offset="0%" stop-color={getScoreColor(alignmentScore.score)} stop-opacity="1" />
										<stop offset="100%" stop-color={getScoreColor(alignmentScore.score)} stop-opacity="0.4" />
									</linearGradient>
								</defs>
								<circle cx="90" cy="90" r={radius} class="bg-ring"></circle>
								<circle
									cx="90" cy="90" r={radius}
									class="score-ring"
									stroke="url(#alnGrad)"
									stroke-dasharray={alnDash}
								></circle>
							</svg>
							<div class="gauge-center">
								<span class="gauge-score">{animatedAlnScore || '—'}</span>
								<span class="gauge-label">/ 100</span>
							</div>
							<div class="grade-badge" style="background: {getGradeColor(alignmentScore.grade)}; box-shadow: 0 2px 12px {getGradeColor(alignmentScore.grade)}44">
								{alignmentScore.grade}
							</div>
						</div>
					</div>
					<p class="summary">{alignmentScore.gapInterpretation}</p>

					<button
						class="expand-button"
						onclick={() => (expandedAlignment = !expandedAlignment)}
						aria-expanded={expandedAlignment}
					>
						<span>Alignment Factors</span>
						<svg class="expand-icon" style:transform={expandedAlignment ? 'rotate(180deg)' : 'rotate(0deg)'} viewBox="0 0 20 20" fill="none" stroke="currentColor">
							<path d="M5 7.5L10 12.5L15 7.5" stroke-width="2" stroke-linecap="round" />
						</svg>
					</button>

					{#if expandedAlignment && alignmentScore.factors}
						<div class="factors">
							{#each alignmentScore.factors as factor (factor.name)}
								<div class="factor-item" class:factor-positive={factor.impact > 0} class:factor-negative={factor.impact < 0} class:factor-neutral={factor.impact === 0}>
									<div class="factor-header">
										<span class="factor-icon">{factor.impact > 0 ? '↑' : factor.impact < 0 ? '↓' : '→'}</span>
										<span class="factor-label">{factor.name}</span>
										<span class="factor-impact" style="color: {factor.impact > 0 ? '#34C759' : factor.impact < 0 ? '#FF3B30' : '#FF9500'}">{factor.impact > 0 ? '+' : ''}{factor.impact}</span>
									</div>
									<p class="factor-detail">{factor.detail}</p>
								</div>
							{/each}
						</div>
					{/if}
				{:else}
					<!-- No profile → show prompt to complete it -->
					<div class="no-profile-state">
						<div class="no-profile-icon">
							<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#0071E3" stroke-width="2">
								<circle cx="24" cy="18" r="8" />
								<path d="M8 40c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke-linecap="round" />
							</svg>
						</div>
						<p class="no-profile-title">Complete your profile</p>
						<p class="no-profile-text">Fill in your <a href="/app/vision/founder">Profile</a> and <a href="/app/vision/concept">Concept</a> to see how well this location fits your business.</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.container {
		width: 100%;
		padding: 1.5rem;
		background: var(--surface);
		border-radius: 16px;
		color: var(--text);
		border: 1px solid var(--border);
	}

	.scores-grid {
		display: grid;
		grid-template-columns: 1fr 140px 1fr;
		gap: 1.5rem;
		align-items: flex-start;
	}

	@media (max-width: 1024px) {
		.scores-grid { grid-template-columns: 1fr; gap: 1rem; }
	}

	@media (max-width: 640px) {
		.scores-container { padding: 1rem; border-radius: 12px; }
		.scores-grid { gap: 0.75rem; }
	}

	.score-card {
		background: var(--surface-elevated);
		border-radius: 16px;
		padding: 1.5rem;
		border: 1px solid var(--border);
		transition: transform 0.2s, border-color 0.3s;
	}
	.score-card:hover {
		transform: translateY(-2px);
		border-color: #d2d2d7;
	}

	@media (max-width: 640px) {
		.score-card { padding: 1rem; border-radius: 12px; }
		.card-header h2 { font-size: 12px; }
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.25rem;
	}
	.card-header h2 {
		font-size: 14px;
		font-weight: 700;
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text);
	}
	.score-type {
		font-size: 10px;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		background: var(--border);
		padding: 3px 8px;
		border-radius: 10px;
	}

	.score-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 1rem;
	}

	.gauge-container {
		position: relative;
		width: 180px;
		height: 180px;
	}
	.gauge {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
		filter: drop-shadow(0 0 12px var(--glow, transparent));
	}
	.bg-ring {
		fill: none;
		stroke: var(--border);
		stroke-width: 8;
	}
	.score-ring {
		fill: none;
		stroke-width: 8;
		stroke-linecap: round;
		transition: stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.gauge-center {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
	}
	.gauge-score {
		display: block;
		font-size: 42px;
		font-weight: 800;
		color: var(--text);
		line-height: 1;
		letter-spacing: -1px;
	}
	.gauge-label {
		font-size: 12px;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.grade-badge {
		position: absolute;
		bottom: 4px;
		right: 4px;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		font-weight: 800;
		color: #000;
	}

	.summary {
		text-align: center;
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0 0 1rem 0;
	}

	/* Expand Button */
	.expand-button {
		width: 100%;
		padding: 10px 12px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--text-secondary);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		transition: all 0.2s;
		margin-top: 8px;
	}
	.expand-button:hover {
		background: #f5f5f7;
		color: #1d1d1f;
		border-color: #d2d2d7;
	}
	.expand-icon {
		width: 14px;
		height: 14px;
		transition: transform 0.3s ease;
	}

	/* Sub-Scores */
	.sub-scores, .factors {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.sub-score-item {
		background: #f5f5f7;
		padding: 10px 12px;
		border-radius: 8px;
		border-left: 3px solid #d2d2d7;
	}
	.sub-score-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}
	.sub-score-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		color: #6e6e73;
	}
	.sub-score-value {
		font-size: 16px;
		font-weight: 800;
	}
	.sub-score-bar-bg {
		width: 100%;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 4px;
	}
	.sub-score-bar {
		height: 100%;
		border-radius: 2px;
		transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.sub-score-weight {
		font-size: 10px;
		color: var(--text-secondary);
		text-align: right;
	}

	/* Gap Indicator */
	.gap-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 1.5rem 0.5rem;
	}
	.gap-svg {
		width: 40px;
		height: 80px;
	}
	.gap-label {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.gap-interpretation {
		font-size: 11px;
		color: var(--text-secondary);
		text-align: center;
		margin: 0;
		line-height: 1.4;
	}

	/* Alignment Factors */
	.factor-item {
		background: #f5f5f7;
		padding: 10px 12px;
		border-radius: 8px;
		border-left: 3px solid #d2d2d7;
	}
	.factor-item.factor-positive { border-left-color: #34C759; }
	.factor-item.factor-negative { border-left-color: #FF3B30; }
	.factor-item.factor-neutral { border-left-color: #FF9500; }
	.factor-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}
	.factor-icon {
		font-size: 14px;
		font-weight: 700;
	}
	.factor-item.factor-positive .factor-icon { color: #34C759; }
	.factor-item.factor-negative .factor-icon { color: #FF3B30; }
	.factor-item.factor-neutral .factor-icon { color: #FF9500; }
	.factor-label {
		font-size: 12px;
		font-weight: 600;
		color: #1d1d1f;
		flex: 1;
	}
	.factor-impact {
		font-size: 14px;
		font-weight: 700;
	}
	.factor-detail {
		font-size: 11px;
		color: #6e6e73;
		margin: 0;
		line-height: 1.4;
	}

	/* No Profile State */
	.no-profile-state {
		text-align: center;
		padding: 24px 16px;
	}
	.no-profile-icon {
		margin-bottom: 12px;
		opacity: 0.6;
	}
	.no-profile-title {
		font-size: 15px;
		font-weight: 600;
		color: #1d1d1f;
		margin: 0 0 6px 0;
	}
	.no-profile-text {
		font-size: 13px;
		color: #6e6e73;
		margin: 0;
		line-height: 1.5;
	}
	.no-profile-text a {
		color: #0071E3;
		text-decoration: none;
		font-weight: 500;
	}
	.no-profile-text a:hover {
		text-decoration: underline;
	}

	/* Loading */
	.loading-state {
		display: grid;
		grid-template-columns: 1fr 140px 1fr;
		gap: 1.5rem;
	}
	@media (max-width: 1024px) {
		.loading-state { grid-template-columns: 1fr; }
	}
	@media (max-width: 640px) {
		.loading-state { gap: 0.75rem; }
		.shimmer-card { height: 280px; }
		.shimmer-gap { height: 120px; }
	}
	.shimmer-card, .shimmer-gap {
		background: linear-gradient(90deg, var(--surface-elevated) 25%, var(--border) 50%, var(--surface-elevated) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 16px;
		height: 400px;
	}
	.shimmer-gap { height: 200px; }

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}
</style>
