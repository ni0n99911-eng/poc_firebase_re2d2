<script lang="ts">
	import { getScoreColor } from '$lib/constants/scoreUtils';
	import type { FitIQRing } from '$lib/intel/segment-intel';
	import { formatConcept } from '$lib/utils/conceptNames';

	let {
		rings = [] as FitIQRing[],
		bizType = 'your business',
	}: {
		rings?: FitIQRing[];
		bizType?: string;
	} = $props();

	// Ring SVG config (smaller than main rings)
	const size = 80;
	const cx = size / 2;
	const cy = size / 2;
	const strokeW = 8;
	const radius = 30;
	const circumference = 2 * Math.PI * radius;

	function getColor(score: number): string {
		const s = score; // use canonical DECISION_STATES via scoreUtils
		if (s >= 75) return '#4a7c5c';  // strong_go + go_with_refinements
		if (s >= 50) return '#e8a838';  // worth_testing
		return '#e8345a';                     // RE² hot-pink — weak
	}

	function getDashOffset(score: number): number {
		return circumference * (1 - score / 100);
	}

	let expandedIdx = $state<number | null>(null);
</script>

{#if rings.length > 0}
	<div class="fit-dims">
		<div class="fit-dims-header">
			<h3 class="fit-dims-title">Score Breakdown</h3>
			<span class="fit-dims-subtitle">How {formatConcept(bizType) || bizType} maps to this location's signals</span>
		</div>

		<div class="fit-dims-row">
			{#each rings as ring, i (ring.label)}
				<button
					class="dim-card"
					class:expanded={expandedIdx === i}
					class:warn={ring.warn}
					onclick={() => (expandedIdx = expandedIdx === i ? null : i)}
				>
					<svg width={size} height={size} class="dim-ring">
						<!-- Background ring -->
						<circle
							cx={cx} cy={cy} r={radius}
							fill="none"
							stroke="rgba(0,0,0,0.06)"
							stroke-width={strokeW}
						/>
						<!-- Score ring -->
						<circle
							cx={cx} cy={cy} r={radius}
							fill="none"
							stroke={getColor(ring.score)}
							stroke-width={strokeW}
							stroke-linecap="round"
							stroke-dasharray={circumference}
							stroke-dashoffset={getDashOffset(ring.score)}
							transform="rotate(-90 {cx} {cy})"
							class="dim-arc"
						/>
						<!-- Score number -->
						<text x={cx} y={cy + 1} text-anchor="middle" dominant-baseline="central"
							class="dim-score-text" fill={getColor(ring.score)}>
							{ring.score}
						</text>
					</svg>
					<div class="dim-label">{ring.label}</div>
					{#if ring.warn}
						<div class="dim-warn-dot" title={ring.warn}>!</div>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Expanded detail -->
		{#if expandedIdx !== null && rings[expandedIdx]}
			{@const ring = rings[expandedIdx]}
			<div class="dim-detail">
				<p class="dim-detail-text">{ring.detail}</p>
				{#if ring.warn}
					<p class="dim-detail-warn">{ring.warn}</p>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.fit-dims {
		margin-top: 24px;
		background: var(--surface, #fff);
		border: 1px solid var(--border, #E5E7EB);
		border-radius: 16px;
		padding: 20px;
	}

	.fit-dims-header { margin-bottom: 16px; }
	.fit-dims-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text, #1A1D23);
		margin: 0 0 4px;
	}
	.fit-dims-subtitle {
		font-size: 12px;
		color: var(--text-secondary, #5A6578);
	}

	.fit-dims-row {
		display: flex;
		gap: 12px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.dim-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: var(--surface-alt, #F8F9FA);
		border: 1px solid transparent;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s;
		position: relative;
		min-width: 100px;
	}
	.dim-card:hover {
		border-color: var(--border, #E5E7EB);
		background: rgba(13, 124, 110, 0.03);
	}
	.dim-card.expanded {
		border-color: var(--teal, #0D7C6E);
		background: rgba(13, 124, 110, 0.05);
	}

	.dim-ring { display: block; }
	.dim-arc { transition: stroke-dashoffset 0.8s ease-out; }

	.dim-score-text {
		font-size: 18px;
		font-weight: 800;
		font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
	}

	.dim-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary, #5A6578);
		text-align: center;
		line-height: 1.3;
		max-width: 100px;
	}

	.dim-warn-dot {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #FF9500;
		color: #fff;
		font-size: 11px;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.dim-detail {
		margin-top: 16px;
		padding: 14px;
		background: var(--surface-alt, #F8F9FA);
		border-radius: 10px;
		animation: fadeIn 0.2s ease-out;
	}
	.dim-detail-text {
		font-size: 13px;
		line-height: 1.55;
		color: var(--text, #1A1D23);
		margin: 0;
	}
	.dim-detail-warn {
		font-size: 12px;
		color: #FF9500;
		margin: 8px 0 0;
		font-weight: 600;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (max-width: 640px) {
		.fit-dims-row { gap: 8px; }
		.dim-card { min-width: 80px; padding: 8px; }
	}
</style>
