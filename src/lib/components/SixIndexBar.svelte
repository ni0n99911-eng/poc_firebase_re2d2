<script lang="ts">
	import { onMount } from 'svelte';
	import { tierFor } from '$lib/intel/tiers';

	interface Props {
		scores?: Record<string, number>;
		fitSubScores?: Record<string, number>;
		animate?: boolean;
	}

	let { scores = {}, fitSubScores = {}, animate = true }: Props = $props();

	// Cycle 2H dimensions (preferred when fit_score data exists)
	const c2hDimensions = ['market_proof', 'accessibility', 'vibrancy', 'demographics', 'competition', 'price_income_fit'];
	const c2hLabels: Record<string, string> = {
		market_proof: 'Market Proof',
		accessibility: 'Accessibility',
		vibrancy: 'Concept Pulse',
		demographics: 'Demographics',
		competition: 'Competition',
		price_income_fit: 'Price Fit'
	};

	// Legacy six-index dimensions (fallback)
	const legacyDimensions = ['transit', 'demographics', 'competition', 'vibrancy', 'safety', 'momentum'];
	const legacyLabels: Record<string, string> = {
		transit: 'Transit',
		demographics: 'Demographics',
		competition: 'Competition',
		vibrancy: 'Concept Pulse',
		safety: 'Safety',
		momentum: 'Momentum'
	};

	// Use Cycle 2H when fit sub-scores are available, else legacy
	let hasFitSubScores = $derived(
		Object.values(fitSubScores).some(v => v > 0)
	);
	let dimensions = $derived(hasFitSubScores ? c2hDimensions : legacyDimensions);
	let labels = $derived(hasFitSubScores ? c2hLabels : legacyLabels);
	let activeScores = $derived(hasFitSubScores ? fitSubScores : scores);

	// Track animation state per dimension
	let animatedValues: Record<string, number> = $state({});

	onMount(() => {
		const dims = hasFitSubScores ? c2hDimensions : legacyDimensions;
		const src = hasFitSubScores ? fitSubScores : scores;
		if (animate) {
			dims.forEach((dim) => { animatedValues[dim] = 0; });
			setTimeout(() => {
				dims.forEach((dim) => { animatedValues[dim] = src[dim] || 0; });
			}, 16);
		} else {
			dims.forEach((dim) => { animatedValues[dim] = src[dim] || 0; });
		}
	});

	function getColor(value: number): string {
		if (value >= 80) return '#34C759'; // green
		if (value >= 60) return '#0071E3'; // blue
		if (value >= 40) return '#FF9500'; // orange
		return '#FF3B30'; // red
	}

	function getDisplayValue(dim: string): number {
		return animate ? (animatedValues[dim] ?? 0) : (activeScores[dim] || 0);
	}

	function getTierLabel(s: number): string {
		return tierFor(s, 'lens').label;
	}

	function getTierClass(s: number): string {
		const t = tierFor(s, 'lens');
		return t.color === 'green' ? 'tier-green' : t.color === 'amber' ? 'tier-amber' : t.color === 'red' ? 'tier-red' : 'tier-neutral';
	}
</script>

<div class="six-index-bar">
	{#each dimensions as dimension}
		{@const displayValue = getDisplayValue(dimension)}
		<div class="bar-container">
			<div class="bar-header">
				<span class="label">{labels[dimension] || dimension}</span>
				<div class="bar-header-right">
					<span class="tier-tag {getTierClass(displayValue)}">{getTierLabel(displayValue)}</span>
					<span class="value">{Math.round(displayValue)}</span>
				</div>
			</div>
			<div class="bar-track">
				<div
					class="bar-fill"
					style="
						width: {displayValue}%;
						background-color: {getColor(displayValue)};
					"
				/>
			</div>
		</div>
	{/each}
</div>

<style>
	.six-index-bar {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		width: 100%;
	}

	.bar-container {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.bar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.label {
		font-size: 12px;
		font-weight: 600;
		color: #333;
	}

	.value {
		font-size: 12px;
		font-weight: 600;
		color: #666;
	}

	.bar-header-right {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.tier-tag {
		font-size: 10px;
		font-weight: 700;
		padding: 1px 5px;
		border-radius: 3px;
		white-space: nowrap;
	}
	/* OSR-03: canonical tier colors from tierFor() */
	.tier-green { background: #dcfce7; color: #166534; }
	.tier-amber { background: #fef3c7; color: #92400e; }
	.tier-red { background: #fee2e2; color: #991b1b; }
	.tier-neutral { background: #e0f2fe; color: #0c4a6e; }

	.bar-track {
		width: 100%;
		height: 8px;
		background-color: #e5e5ea;
		border-radius: 4px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1) 0s;
	}

	/* Responsive: 2-column on narrow screens */
	@media (max-width: 768px) {
		.six-index-bar {
			grid-template-columns: repeat(2, 1fr);
			gap: 12px;
		}
	}

	/* Responsive: 1-column on mobile */
	@media (max-width: 480px) {
		.six-index-bar {
			grid-template-columns: 1fr;
			gap: 12px;
		}
	}
</style>