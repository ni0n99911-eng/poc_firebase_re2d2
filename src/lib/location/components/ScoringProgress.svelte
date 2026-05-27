<script>
	/**
	 * ScoringProgress — Inline scoring loader in the chat thread
	 *
	 * Shows step-by-step progress as RE² analyzes the location.
	 * Rendered as a special card within the chat flow.
	 */
	import { onMount } from 'svelte';

	let { onComplete = null } = $props();

	const steps = [
		{ label: 'Mapping transit & walkability', icon: '🚇' },
		{ label: 'Scanning nearby competition', icon: '🏪' },
		{ label: 'Analyzing neighborhood demographics', icon: '👥' },
		{ label: 'Measuring street vibrancy', icon: '🌆' },
		{ label: 'Checking safety data', icon: '🛡️' },
		{ label: 'Building your score', icon: '📊' }
	];

	let activeStep = $state(0);
	let done = $state(false);

	onMount(() => {
		const interval = setInterval(() => {
			if (activeStep < steps.length - 1) {
				activeStep++;
			} else {
				done = true;
				clearInterval(interval);
				if (onComplete) {
					setTimeout(onComplete, 600);
				}
			}
		}, 800);

		return () => clearInterval(interval);
	});
</script>

<div class="scoring-card">
	<div class="scoring-header">
		{#if done}
			<span class="scoring-title done">Score ready</span>
		{:else}
			<span class="scoring-title">Analyzing your location...</span>
		{/if}
	</div>

	<div class="scoring-steps">
		{#each steps as step, i (i)}
			<div class="step" class:active={i === activeStep && !done} class:complete={i < activeStep || done}>
				<span class="step-icon">
					{#if i < activeStep || done}
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="step-check">
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
					{:else if i === activeStep}
						<span class="spinner"></span>
					{:else}
						<span class="step-dot"></span>
					{/if}
				</span>
				<span class="step-label">{step.label}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.scoring-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 18px;
		margin-top: 8px;
		min-width: 260px;
	}

	.scoring-header {
		margin-bottom: 14px;
	}

	.scoring-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
	}

	.scoring-title.done {
		color: var(--green);
	}

	.scoring-steps {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.step {
		display: flex;
		align-items: center;
		gap: 10px;
		opacity: 0.35;
		transition: opacity 0.3s ease;
	}

	.step.active, .step.complete {
		opacity: 1;
	}

	.step-icon {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.step-check {
		color: var(--green);
	}

	.step-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--border);
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid var(--border-subtle);
		border-top-color: var(--teal);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.step-label {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.step.complete .step-label {
		color: var(--text);
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
