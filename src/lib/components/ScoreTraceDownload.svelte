<script lang="ts">
	/**
	 * ScoreTraceDownload — V2 Score Debuggability
	 * 
	 * Small download button that exports the current score's full trace as JSON.
	 * Place this next to the score display (e.g. ScoreRingHero, ScoreHeader).
	 * 
	 * The button is always visible but unobtrusive — users ignore it until
	 * support asks them to click it. When they do, it saves the DE hours.
	 * 
	 * Props:
	 *   scoreData — the full location-iq API response object
	 */

	import { downloadScoreTrace, storeScoreTrace } from '$lib/intel/score-trace-store';
	import { onMount } from 'svelte';

	let { scoreData }: { scoreData: Record<string, unknown> } = $props();

	// Auto-store the trace when component mounts (Layer ①)
	onMount(() => {
		if (scoreData) {
			storeScoreTrace(scoreData);
		}
	});

	function handleDownload() {
		if (scoreData) {
			downloadScoreTrace(scoreData);
		}
	}
</script>

<button
	class="trace-download-btn"
	onclick={handleDownload}
	title="Download score trace (JSON) for debugging"
	aria-label="Download score trace as JSON"
>
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M8 1v9m0 0l3-3m-3 3L5 7"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			d="M2 12v1a2 2 0 002 2h8a2 2 0 002-2v-1"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</button>

{#if scoreData?._serving_mode}
	<span
		class="serving-mode-badge"
		class:python={scoreData._serving_mode === 'python_api'}
		class:fallback={scoreData._serving_mode === 'fallback_golden_record'}
		class:bundle={scoreData._serving_mode === 'bundle_builder'}
		title="Scoring engine: {scoreData._serving_mode} ({scoreData._engine_version || 'unknown'})"
	>
		{#if scoreData._serving_mode === 'python_api'}
			🟢 PY
		{:else if scoreData._serving_mode === 'fallback_golden_record'}
			🟡 SF
		{:else if scoreData._serving_mode === 'bundle_builder'}
			🔵 BB
		{:else}
			⚪ ?
		{/if}
	</span>
{/if}

<style>
	.trace-download-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-muted, #888);
		cursor: pointer;
		transition: all 0.15s ease;
		opacity: 0.5;
	}

	.trace-download-btn:hover {
		background: var(--surface-hover, rgba(255, 255, 255, 0.08));
		color: var(--text-primary, #fff);
		opacity: 1;
	}

	.trace-download-btn:active {
		transform: scale(0.92);
	}

	.serving-mode-badge {
		display: inline-flex;
		align-items: center;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.03em;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-muted, #888);
		cursor: help;
		user-select: none;
		opacity: 0.6;
		transition: opacity 0.15s ease;
	}

	.serving-mode-badge:hover {
		opacity: 1;
	}

	.serving-mode-badge.python {
		color: #34d399;
	}

	.serving-mode-badge.fallback {
		color: #fbbf24;
	}

	.serving-mode-badge.bundle {
		color: #60a5fa;
	}
</style>
