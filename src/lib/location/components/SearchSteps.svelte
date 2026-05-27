<script lang="ts">
	import type { SearchStep } from '../store.svelte';
	let { steps = [], searchStep = 0, searching = false, onRetry = () => {} }: { steps: SearchStep[]; searchStep: number; searching: boolean; onRetry?: () => void } = $props();

	const hasBadStep = steps.some(s => s.c === 'bad');
</script>

{#if steps.length}
	<div class="steps">
		{#each steps as s}
			<div class={s.c}>
				{s.c === 'ok' ? '✅' : s.c === 'bad' ? '❌' : '⏳'} {s.t}
			</div>
		{/each}
		{#if hasBadStep}
			<button class="retry-btn" onclick={onRetry}>Try a different address</button>
		{/if}
	</div>
{/if}

{#if searching}
	<div class="loading-progress active">
		<div class="loading-progress-bar step{searchStep}"></div>
	</div>
{/if}

<style>
	.steps { margin-top: 12px; font-size: 11px; font-family: 'DM Mono', monospace; color: var(--muted); }
	.steps div { margin-bottom: 3px; animation: fadeInSlide 0.4s ease forwards; }
	.steps .ok { color: var(--cyan); }
	.steps .go { color: var(--gold); animation: pulse 1.5s ease-in-out infinite; }
	.steps .bad { color: var(--redtag); }
	.retry-btn { margin-top: 10px; padding: 8px 12px; border: 1px solid #e8e2d8; background: #f5f0e8; border-radius: 6px; font-size: 12px; color: #2c2c2c; cursor: pointer; transition: all 0.2s ease; }

	@keyframes fadeInSlide { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
	@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

	.loading-progress { height: 3px; background: var(--border); border-radius: 3px; margin-top: 8px; overflow: hidden; width: 100%; }
	.loading-progress.active { background: rgba(255, 45, 85, 0.3); }
	.loading-progress-bar { height: 100%; background: linear-gradient(90deg, var(--red), var(--cyan)); border-radius: 3px; width: 0%; animation: progressFill 8s linear forwards; }
	@keyframes progressFill { from { width: 0%; } to { width: 100%; } }
	:global(.loading-progress-bar.step0) { animation-duration: 2s; }
	:global(.loading-progress-bar.step1) { animation-duration: 4s; }
	:global(.loading-progress-bar.step2) { animation-duration: 6s; }
	:global(.loading-progress-bar.step3) { animation-duration: 8s; }
	:global(.loading-progress-bar.step4) { animation-duration: 10s; }
</style>
