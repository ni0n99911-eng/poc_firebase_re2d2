<script lang="ts">
	import { onMount } from 'svelte';

	let { steps = [], currentStep = 0, onComplete = () => {} } = $props<{
		steps?: Array<{ label: string; key: string }>;
		currentStep?: number;
		onComplete?: () => void;
	}>();

	let activeStep = $state(0);
	let completed = $state(false);

	const defaultSteps = [
		{ label: 'Checking foot traffic patterns', key: 'traffic' },
		{ label: 'Analyzing nearby competition', key: 'competition' },
		{ label: 'Reviewing crime data and safety', key: 'safety' },
		{ label: 'Calculating rent benchmarks', key: 'rent' },
		{ label: 'Cross-referencing with your concept', key: 'concept' },
		{ label: 'Building your personalized report', key: 'report' }
	];

	let displaySteps = $derived(steps.length > 0 ? steps : defaultSteps);

	// If currentStep is being controlled externally, sync it
	$effect(() => {
		if (currentStep > 0) {
			activeStep = currentStep;
		}
	});

	// Auto-advance if not controlled externally
	onMount(() => {
		if (currentStep === 0 && steps.length === 0) {
			let step = 0;
			const interval = setInterval(() => {
				step++;
				activeStep = step;
				if (step >= displaySteps.length) {
					clearInterval(interval);
					setTimeout(() => {
						completed = true;
						onComplete();
					}, 600);
				}
			}, 800);
			return () => clearInterval(interval);
		}
	});
</script>

<div class="scoring-loader">
	<div class="loader-header">
		<div class="pulse-ring"></div>
		<h2 class="loader-title">Scoring your location</h2>
		<p class="loader-subtitle">Checking 20+ data sources to build your report</p>
	</div>

	<div class="steps-list">
		{#each displaySteps as step, i (step.key)}
			<div class="step-row" class:done={i < activeStep} class:active={i === activeStep} class:pending={i > activeStep}>
				<div class="step-indicator">
					{#if i < activeStep}
						<span class="step-check">✓</span>
					{:else if i === activeStep}
						<span class="step-spinner"></span>
					{:else}
						<span class="step-dot"></span>
					{/if}
				</div>
				<span class="step-label">{step.label}{i < activeStep ? '' : '...'}</span>
			</div>
		{/each}
	</div>

	{#if completed}
		<div class="complete-message">
			<span class="complete-icon">✨</span>
			<span>Report ready</span>
		</div>
	{/if}
</div>

<style>
	.scoring-loader {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		padding: 40px 24px;
		animation: fadeIn 0.3s ease-out;
	}

	.loader-header {
		text-align: center;
		margin-bottom: 40px;
	}

	.pulse-ring {
		width: 48px;
		height: 48px;
		border: 3px solid var(--primary);
		border-radius: 50%;
		margin: 0 auto 20px;
		animation: pulseRing 1.5s ease-in-out infinite;
	}

	.loader-title {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 24px;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 8px;
	}

	.loader-subtitle {
		font-size: 14px;
		color: var(--text-tertiary);
	}

	.steps-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 400px;
		width: 100%;
	}

	.step-row {
		display: flex;
		align-items: center;
		gap: 14px;
		transition: opacity 0.3s ease;
	}

	.step-row.pending {
		opacity: 0.3;
	}

	.step-row.active {
		opacity: 1;
	}

	.step-row.done {
		opacity: 0.7;
	}

	.step-indicator {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.step-check {
		color: var(--success);
		font-size: 16px;
		font-weight: 700;
		animation: checkPop 0.2s ease-out;
	}

	.step-spinner {
		width: 18px;
		height: 18px;
		border: 2px solid var(--border);
		border-top-color: var(--primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.step-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--border);
	}

	.step-label {
		font-size: 15px;
		color: var(--text-secondary);
	}

	.step-row.done .step-label {
		color: var(--text-tertiary);
	}

	.step-row.active .step-label {
		color: var(--text);
		font-weight: 500;
	}

	.complete-message {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 32px;
		padding: 12px 24px;
		background: rgba(16, 185, 129, 0.1);
		border-radius: 20px;
		color: var(--success);
		font-size: 15px;
		font-weight: 600;
		animation: fadeIn 0.3s ease-out;
	}

	.complete-icon {
		font-size: 18px;
	}

	@keyframes pulseRing {
		0%, 100% { transform: scale(1); opacity: 1; }
		50% { transform: scale(1.1); opacity: 0.7; }
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@keyframes checkPop {
		from { transform: scale(0); }
		to { transform: scale(1); }
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
