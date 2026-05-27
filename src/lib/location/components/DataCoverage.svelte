<script lang="ts">
	import { slide } from 'svelte/transition';
	import type { LocationIntelReport } from '$lib/intel';

	let { liveIntel, onRetry = null }: { liveIntel: LocationIntelReport | null; onRetry?: (() => void) | null } = $props();

	// Compute coverage info
	const coverageInfo = $derived.by(() => {
		if (!liveIntel) {
			return { available: 0, total: 20, pct: 0, failedSources: [] };
		}

		const coverage = liveIntel.sourceCoverage || { available: 0, total: 20, pct: 0 };
		const failedSources = liveIntel.errors
			? liveIntel.errors.map((err) => {
					// Extract source name from error (e.g., "Google Places: ..." → "Google Places")
					const match = err.match(/^([^:]+):/);
					return match ? match[1] : err;
				})
			: [];

		return { ...coverage, failedSources };
	});

	let expanded = $state(false);

	// Map source names to display names
	const sourceDisplayNames: Record<string, string> = {
		'Places': 'Google Places',
		'Foursquare': 'Foursquare',
		'Yelp': 'Yelp',
		'Census': 'Census Demographics',
		'Census Housing': 'Census Housing',
		'WalkScore': 'Walk Score',
		'Inspections': 'Restaurant Inspections',
		'Crime': 'Crime Data',
		'Market Density': 'Market Density',
		'Competitors': 'Competitors',
		'LPC': 'LPC Landmarks',
		'MTA Ridership': 'MTA Ridership',
		'DCA Licenses': 'DCA Licenses',
		'DOB Permits': 'DOB Permits',
		'311 Complaints': '311 Service Requests',
		'Pedestrian Counts': 'Pedestrian Counts',
		'PLUTO': 'PLUTO Zoning',
		'Sidewalk Cafes': 'Sidewalk Cafes',
		'Liquor Licenses': 'Liquor Licenses',
		'Momentum': 'Momentum Trends'
	};
</script>

{#if liveIntel && coverageInfo.total > 0}
	<div class="data-coverage">
		<!-- Coverage bar with progress indicator -->
		<div class="coverage-header" onclick={() => (expanded = !expanded)}>
			<div class="coverage-label">
				<span class="coverage-text">{coverageInfo.available} of {coverageInfo.total} data sources responded</span>
				<span class="coverage-pct">{coverageInfo.pct}%</span>
			</div>
			<div class="coverage-bar">
				<div class="coverage-fill" style="width: {coverageInfo.pct}%"></div>
			</div>
			{#if coverageInfo.failedSources.length > 0}
				<div class="coverage-toggle">
					<span class="toggle-icon">{expanded ? '▼' : '▶'}</span>
				</div>
			{/if}
		</div>

		<!-- Expandable error list -->
		{#if expanded && coverageInfo.failedSources.length > 0}
			<div class="coverage-errors" transition:slide={{ duration: 200 }}>
				<div class="error-header">
					<span class="error-label">{coverageInfo.failedSources.length} sources unavailable:</span>
					{#if onRetry}
						<button class="retry-btn" onclick={onRetry}>
							Retry failed sources
						</button>
					{/if}
				</div>
				<div class="error-list">
					{#each coverageInfo.failedSources as source (source)}
						<div class="error-item">
							<span class="error-icon">◆</span>
							<span class="error-name">{sourceDisplayNames[source] || source}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.data-coverage {
		margin-top: 16px;
		padding: 12px;
		background: var(--bg);
		border-radius: 8px;
		border: 1px solid var(--border-subtle);
	}

	.coverage-header {
		cursor: pointer;
		user-select: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.coverage-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.coverage-text {
		font-size: 12px;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.coverage-pct {
		font-size: 11px;
		color: var(--text-dim);
		background: var(--border-subtle);
		padding: 2px 6px;
		border-radius: 3px;
		font-family: 'DM Mono', monospace;
		font-weight: 600;
	}

	.coverage-bar {
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
	}

	.coverage-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--cyan, #0af), var(--gold, #ff9500));
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.coverage-toggle {
		padding: 2px 4px;
		font-size: 10px;
		color: var(--text-dim);
	}

	.toggle-icon {
		display: inline-block;
		transition: transform 0.2s ease;
	}

	.coverage-errors {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--border-subtle);
	}

	.error-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.error-label {
		font-size: 11px;
		color: var(--text-secondary);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.retry-btn {
		padding: 4px 12px;
		background: var(--teal-bg);
		border: 1px solid var(--teal-ring);
		border-radius: 6px;
		color: var(--teal);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
	}

	.retry-btn:hover {
		background: rgba(13, 124, 110, 0.12);
		border-color: var(--teal);
	}

	.error-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.error-item {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--text-dim);
		background: var(--border-subtle);
		padding: 3px 6px;
		border-radius: 3px;
		white-space: nowrap;
	}

	.error-icon {
		font-size: 8px;
		opacity: 0.6;
	}

	.error-name {
		font-family: 'DM Sans', sans-serif;
	}

</style>
