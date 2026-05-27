<script lang="ts">
	import { onMount } from 'svelte';
	import { getScoreColor } from '$lib/constants/scoreUtils';

	interface LocationData {
		address: string;
		compositeScore: number;
		scores: Record<string, number>;
		spokeLabels: Record<string, string>;
	}

	let { locationA, locationB, personaType, conceptDescription } = $props();

	// Ring animation state
	let ringAProgress = $state(0);
	let ringBProgress = $state(0);

	// Compute winner per factor
	const factors = $derived.by(() => {
		const result: Array<{
			key: string;
			label: string;
			scoreA: number;
			scoreB: number;
			winner: 'A' | 'B' | 'tie';
		}> = [];

		const keys = Object.keys(locationA.scores);
		for (const key of keys) {
			const scoreA = locationA.scores[key] || 0;
			const scoreB = locationB.scores[key] || 0;
			const label = locationA.spokeLabels[key] || key;

			let winner: 'A' | 'B' | 'tie' = 'tie';
			if (scoreA > scoreB) winner = 'A';
			else if (scoreB > scoreA) winner = 'B';

			result.push({ key, label, scoreA, scoreB, winner });
		}

		return result;
	});

	// Compute overall winner
	const overallWinner = $derived.by(() => {
		if (locationA.compositeScore > locationB.compositeScore) return 'A';
		if (locationB.compositeScore > locationA.compositeScore) return 'B';
		return 'tie';
	});

	// Compute top factors for verdict
	const topFactors = $derived.by(() => {
		const sorted = [...factors].sort((a, b) => {
			const diffA = Math.abs(a.scoreA - a.scoreB);
			const diffB = Math.abs(b.scoreA - b.scoreB);
			return diffB - diffA;
		});
		return sorted.slice(0, 2);
	});

	// Verdict text (template-based)
	const verdictText = $derived.by(() => {
		if (overallWinner === 'tie') {
			return `Both locations are strong matches for your ${conceptDescription || personaType}. Review the detailed factors to choose.`;
		}

		const winnerLabel = overallWinner === 'A' ? 'Location A' : 'Location B';
		const loserLabel = overallWinner === 'A' ? 'Location B' : 'Location A';

		const topA = topFactors[0];
		const topB = topFactors[1];

		let reason = '';
		if (topA?.winner === overallWinner) {
			reason = `${topA.label} is a significant advantage`;
		} else if (topB?.winner === overallWinner) {
			reason = `${topB.label} gives it an edge`;
		} else {
			reason = 'the overall fit aligns better with your needs';
		}

		return `${winnerLabel} wins on ${topA?.label || 'key factors'}, while ${loserLabel} has the edge on ${topB?.label || 'other areas'}. For your ${conceptDescription || personaType}, we'd lean toward ${winnerLabel} because ${reason}.`;
	});

	onMount(() => {
		// Animate rings
		setTimeout(() => {
			ringAProgress = locationA.compositeScore;
			ringBProgress = locationB.compositeScore;
		}, 100);
	});

	// Helper: get color for score
	function getScoreColor(score: number): string {
		if (score >= 70) return 'var(--green)';
		if (score >= 50) return 'var(--amber)';
		return 'var(--red)';
	}

	// Helper: render SVG conic arc for ring
	function renderRingArc(score: number, cx: number = 60, cy: number = 60, radius: number = 50): string {
		const progress = Math.max(0, Math.min(100, score)) / 100;
		const angle = progress * 360;
		const rad = (angle * Math.PI) / 180;
		const x = cx + radius * Math.cos(rad - Math.PI / 2);
		const y = cy + radius * Math.sin(rad - Math.PI / 2);
		const largeArc = angle > 180 ? 1 : 0;

		return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 ${largeArc} 1 ${x} ${y}`;
	}
</script>

<div class="face-off-container">
	<!-- Header -->
	<div class="header">
		<h2 class="title">The Face-Off</h2>
		<div class="address-pills">
			<div class="address-pill">{locationA.address}</div>
			<span class="vs">VS</span>
			<div class="address-pill">{locationB.address}</div>
		</div>
	</div>

	<!-- Score Rings -->
	<div class="rings-section">
		<div class="ring-wrapper ring-a" class:winner={overallWinner === 'A'}>
			{#if overallWinner === 'A'}
				<div class="crown">👑</div>
			{/if}
			<svg viewBox="0 0 120 120" class="score-ring">
				<!-- Background circle -->
				<circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="8" />

				<!-- Progress arc -->
				<path
					d={renderRingArc(ringAProgress)}
					fill="none"
					stroke={getScoreColor(locationA.compositeScore)}
					stroke-width="8"
					stroke-linecap="round"
					stroke-dasharray="314"
					stroke-dashoffset={314 * (1 - ringAProgress / 100)}
					style="transition: stroke-dashoffset 0.8s ease-out;"
				/>
			</svg>
			<div class="ring-score">{Math.round(locationA.compositeScore)}</div>
		</div>

		<div class="vs-divider">VS</div>

		<div class="ring-wrapper ring-b" class:winner={overallWinner === 'B'}>
			{#if overallWinner === 'B'}
				<div class="crown">👑</div>
			{/if}
			<svg viewBox="0 0 120 120" class="score-ring">
				<!-- Background circle -->
				<circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="8" />

				<!-- Progress arc -->
				<path
					d={renderRingArc(ringBProgress)}
					fill="none"
					stroke={getScoreColor(locationB.compositeScore)}
					stroke-width="8"
					stroke-linecap="round"
					stroke-dasharray="314"
					stroke-dashoffset={314 * (1 - ringBProgress / 100)}
					style="transition: stroke-dashoffset 0.8s ease-out;"
				/>
			</svg>
			<div class="ring-score">{Math.round(locationB.compositeScore)}</div>
		</div>
	</div>

	<!-- Comparison Rows -->
	<div class="comparison-rows">
		{#each factors as factor, idx (factor.key)}
			<div class="index-row">
				<div class="row-left">
					<div class="winner-dot" class:winner-a={factor.winner === 'A'} class:winner-b={factor.winner === 'B'} class:tie={factor.winner === 'tie'}></div>
					<div class="mini-bar">
						<div
							class="bar-fill"
							style="width: {Math.max(5, factor.scoreA)}%; background-color: {getScoreColor(factor.scoreA)};"
						/>
					</div>
					<div class="score-number">{Math.round(factor.scoreA)}</div>
				</div>

				<div class="row-label">{factor.label}</div>

				<div class="row-right">
					<div class="score-number">{Math.round(factor.scoreB)}</div>
					<div class="mini-bar">
						<div
							class="bar-fill"
							style="width: {Math.max(5, factor.scoreB)}%; background-color: {getScoreColor(factor.scoreB)};"
						/>
					</div>
					<div class="winner-dot" class:winner-a={factor.winner === 'A'} class:winner-b={factor.winner === 'B'} class:tie={factor.winner === 'tie'}></div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Verdict Compare -->
	<div class="verdict-compare">
		<div class="verdict-panel verdict-a">
			<div class="panel-tag">Location A</div>
			<h3 class="panel-title">{overallWinner === 'A' ? 'Strong Match' : 'Good Option'}</h3>
			<p class="panel-body">
				{#if overallWinner === 'A'}
					This location edges out for your needs.
				{:else if overallWinner === 'tie'}
					Both have compelling strengths.
				{:else}
					Good fundamentals, but Location B has the edge.
				{/if}
			</p>
		</div>

		<div class="verdict-panel verdict-b">
			<div class="panel-tag">Location B</div>
			<h3 class="panel-title">{overallWinner === 'B' ? 'Strong Match' : 'Good Option'}</h3>
			<p class="panel-body">
				{#if overallWinner === 'B'}
					This location edges out for your needs.
				{:else if overallWinner === 'tie'}
					Both have compelling strengths.
				{:else}
					Good fundamentals, but Location A has the edge.
				{/if}
			</p>
		</div>
	</div>
</div>

<style>
	.face-off-container {
		background-color: var(--bg);
		border-radius: 12px;
		padding: 24px;
		color: var(--text);
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	/* Header */
	.header {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: center;
	}

	.title {
		font-size: 24px;
		font-weight: 700;
		margin: 0;
		color: var(--text);
	}

	.address-pills {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.address-pill {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 20px;
		padding: 8px 14px;
		font-size: 13px;
		color: var(--text-secondary);
		text-align: center;
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.vs {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-dim);
		text-transform: uppercase;
	}

	/* Rings Section */
	.rings-section {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		justify-content: center;
		gap: 24px;
	}

	.ring-wrapper {
		position: relative;
		width: 140px;
		height: 140px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: filter 0.3s ease;
	}

	.ring-wrapper.winner {
		filter: drop-shadow(0 4px 12px rgba(13, 124, 110, 0.1));
	}

	.ring-wrapper.ring-a.winner .score-ring circle:first-of-type {
		stroke: rgba(13, 124, 110, 0.15);
	}

	.ring-wrapper.ring-b.winner .score-ring circle:first-of-type {
		stroke: rgba(124, 58, 237, 0.15);
	}

	.crown {
		position: absolute;
		top: -8px;
		font-size: 20px;
		z-index: 10;
	}

	.score-ring {
		width: 120px;
		height: 120px;
	}

	.ring-score {
		position: absolute;
		font-size: 32px;
		font-weight: 700;
		color: var(--text);
		font-family: 'Playfair Display', serif;
	}

	.vs-divider {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background-color: var(--surface);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dim);
		text-transform: uppercase;
	}

	/* Comparison Rows */
	.comparison-rows {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.index-row {
		display: grid;
		grid-template-columns: 120px 1fr 120px;
		gap: 16px;
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 14px 20px;
		align-items: center;
	}

	.row-left,
	.row-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.row-right {
		flex-direction: row-reverse;
	}

	.winner-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.winner-dot.winner-a {
		background-color: var(--teal);
	}

	.winner-dot.winner-b {
		background-color: var(--purple);
	}

	.winner-dot.tie {
		background-color: var(--text-dim);
	}

	.mini-bar {
		flex: 1;
		height: 4px;
		background-color: var(--border);
		border-radius: 2px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.4s ease;
	}

	.score-number {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		font-family: 'Playfair Display', serif;
		min-width: 28px;
		text-align: center;
	}

	.row-label {
		font-size: 13px;
		color: var(--text);
		font-weight: 500;
		text-align: center;
	}

	/* Verdict Compare */
	.verdict-compare {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.verdict-panel {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 16px;
		border-top: 2px solid;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.verdict-a {
		border-top-color: var(--teal);
	}

	.verdict-b {
		border-top-color: var(--purple);
	}

	.panel-tag {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-secondary);
		letter-spacing: 0.5px;
	}

	.panel-title {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
		color: var(--text);
		font-family: 'Playfair Display', serif;
	}

	.panel-body {
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-secondary);
		margin: 0;
	}

	/* Mobile Responsive */
	@media (max-width: 640px) {
		.face-off-container {
			padding: 16px;
			gap: 20px;
		}

		.title {
			font-size: 20px;
		}

		.address-pills {
			flex-direction: column;
			gap: 8px;
		}

		.rings-section {
			grid-template-columns: 1fr;
		}

		.vs-divider {
			display: none;
		}

		.index-row {
			grid-template-columns: 1fr;
			gap: 8px;
			padding: 12px;
		}

		.row-left,
		.row-right {
			width: 100%;
			justify-content: space-between;
		}

		.row-label {
			order: -1;
			margin-bottom: 4px;
			text-align: left;
		}

		.verdict-compare {
			grid-template-columns: 1fr;
		}
	}
</style>
