<script lang="ts">
	/**
	 * C11: Coffee-specific Watch-Out display component.
	 *
	 * Renders W1–W10 watch-outs as colored pills below the score card.
	 * DISTINCT from HeadsUpCards (C1–C5) which are build-out requirements.
	 * Watch-outs are about business viability at this specific location.
	 *
	 * Brain thread supplies the watch-out data via generateCoffeeWatchOuts()
	 * in segment-intel.ts. UX thread renders them here.
	 */
	import FeedbackButton from '$lib/components/FeedbackButton.svelte';
	import type { CoffeeWatchOut } from '$lib/intel/coffee-watch-outs';

	let { watchOuts = [], bizType = '' } = $props<{
		watchOuts: CoffeeWatchOut[];
		bizType?: string;
	}>();

	// Only show for coffee concepts
	let isCoffee = $derived(
		bizType === 'specialty_coffee' || bizType === 'coffee_shop' || bizType === 'coffee'
	);

	function sevColor(sev: CoffeeWatchOut['severity']): string {
		if (sev === 'critical') return '#dc2626';
		if (sev === 'important') return '#d97706';
		return '#6b7280';
	}

	function sevBg(sev: CoffeeWatchOut['severity']): string {
		if (sev === 'critical') return 'rgba(220, 38, 38, 0.08)';
		if (sev === 'important') return 'rgba(217, 119, 6, 0.06)';
		return 'rgba(107, 114, 128, 0.06)';
	}

	function sevLabel(sev: CoffeeWatchOut['severity']): string {
		if (sev === 'critical') return 'Critical';
		if (sev === 'important') return 'Watch';
		return 'Note';
	}
</script>

{#if isCoffee && watchOuts.length > 0}
	<div class="cwo-section">
		<div class="cwo-header">
			<span class="cwo-icon">☕</span>
			<div>
				<h3 class="cwo-title">Coffee Viability Watch-Outs</h3>
				<p class="cwo-sub">{watchOuts.length} location-specific flag{watchOuts.length > 1 ? 's' : ''} for your coffee concept</p>
			</div>
		</div>

		<div class="cwo-pills">
			{#each watchOuts as wo (wo.id)}
				<div class="cwo-pill" style="border-left-color: {sevColor(wo.severity)}; background: {sevBg(wo.severity)}">
					<div class="cwo-pill-top">
						<span class="cwo-pill-icon">{wo.icon}</span>
						<span class="cwo-pill-title">{wo.title}</span>
						<span class="cwo-pill-sev" style="color: {sevColor(wo.severity)}">{sevLabel(wo.severity)}</span>
					</div>
					<p class="cwo-pill-explain">{wo.explanation}</p>
				</div>
			{/each}
		</div>

		<div class="cwo-feedback">
			<FeedbackButton sectionId="coffee-watch-outs" />
		</div>
	</div>
{/if}

<style>
	.cwo-section {
		background: var(--surface, #fff);
		border: 1px solid var(--border, #E5E7EB);
		border-radius: 12px;
		padding: 20px;
		margin-bottom: 16px;
	}

	.cwo-header {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin-bottom: 16px;
	}

	.cwo-icon {
		font-size: 22px;
		line-height: 1;
		flex-shrink: 0;
	}

	.cwo-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--text, #1A1D23);
		margin: 0 0 2px 0;
	}

	.cwo-sub {
		font-size: 12px;
		color: var(--text-secondary, #5A6578);
		margin: 0;
	}

	.cwo-pills {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.cwo-pill {
		border-left: 4px solid;
		border-radius: 8px;
		padding: 12px 14px;
	}

	.cwo-pill-top {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.cwo-pill-icon {
		font-size: 16px;
		flex-shrink: 0;
	}

	.cwo-pill-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--text, #1A1D23);
		flex: 1;
	}

	.cwo-pill-sev {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		flex-shrink: 0;
	}

	.cwo-pill-explain {
		font-size: 12px;
		color: var(--text-secondary, #5A6578);
		line-height: 1.5;
		margin: 0;
		padding-left: 24px;
	}

	.cwo-feedback {
		margin-top: 12px;
		padding-top: 10px;
		border-top: 1px solid var(--border, #E5E7EB);
	}

	@media (max-width: 640px) {
		.cwo-section { padding: 14px; }
		.cwo-pill { padding: 10px 12px; }
	}
</style>
