<script lang="ts">
	import { tick } from 'svelte';

	/**
	 * E=MC² Button — The signature RE² interaction.
	 * Each Einstein module gets its own expansion phrase.
	 * Props:
	 *   expansionText - The module-specific acronym expansion
	 *   steps - Progress steps shown during processing
	 *   onTrigger - Async callback that performs the actual computation
	 *   disabled - Whether the button is disabled
	 */
	let {
		expansionText = 'Evaluate My Community Context',
		steps = ['Pulling demographics...', 'Scanning competitors...', 'Analyzing foot traffic...', 'Scoring your location...'],
		onTrigger = async () => {},
		disabled = false
	} = $props();

	type ButtonState = 'idle' | 'expanding' | 'processing' | 'done';
	let state: ButtonState = $state('idle');
	let completedSteps: string[] = $state([]);
	let currentStepIndex: number = $state(-1);
	let displayedChars: number = $state(0);
	let resultReady: boolean = $state(false);

	async function delay(ms: number): Promise<void> {
		return new Promise(r => setTimeout(r, ms));
	}

	async function handleClick() {
		if (state !== 'idle' || disabled) return;

		// Phase 1: Expand — typewriter effect
		state = 'expanding';
		displayedChars = 0;
		completedSteps = [];
		currentStepIndex = -1;
		resultReady = false;

		await tick();

		// Typewriter animation (40ms per character per spec)
		for (let i = 0; i <= expansionText.length; i++) {
			displayedChars = i;
			await delay(40);
		}
		await delay(400);

		// Phase 2: Processing — step-by-step progress
		state = 'processing';
		const startTime = Date.now();

		// Start the actual computation in parallel
		const computePromise = onTrigger();

		// Animate progress steps
		for (let i = 0; i < steps.length; i++) {
			currentStepIndex = i;
			await delay(500);
			completedSteps = [...completedSteps, steps[i]];
		}

		// Wait for actual computation to finish
		await computePromise;

		// Enforce 2-second minimum processing time
		const elapsed = Date.now() - startTime;
		if (elapsed < 2000) {
			await delay(2000 - elapsed);
		}

		// Phase 3: Done — collapse back
		state = 'done';
		resultReady = true;
		await delay(600);

		// Reset to idle (collapsed)
		state = 'idle';
	}

	let expandedText = $derived(expansionText.slice(0, displayedChars));
	let isActive = $derived(state !== 'idle');
</script>

<div class="emc2-container" class:active={isActive}>
	<button
		class="emc2-btn"
		class:expanding={state === 'expanding'}
		class:processing={state === 'processing'}
		class:done={state === 'done'}
		class:disabled={disabled}
		onclick={handleClick}
		{disabled}
		aria-label="Run RE² Analysis: {expansionText}"
		role="button"
	>
		<span class="emc2-formula">E=MC²</span>
		{#if state === 'expanding' || state === 'processing'}
			<span class="emc2-expansion">
				<span class="typewriter-text">{expandedText}</span>
				{#if state === 'expanding'}
					<span class="cursor">|</span>
				{/if}
			</span>
		{/if}
		{#if state === 'processing'}
			<span class="thinking">RE² is thinking...</span>
		{/if}
	</button>

	{#if state === 'processing' || state === 'done'}
		<div class="progress-steps">
			{#each steps as step, i}
				<div class="progress-step" class:active={i === currentStepIndex && !completedSteps.includes(step)} class:done={completedSteps.includes(step)} style="animation-delay: {i * 100}ms">
					<span class="step-icon">
						{#if completedSteps.includes(step)}
							✓
						{:else if i === currentStepIndex}
							⟳
						{:else}
							○
						{/if}
					</span>
					<span class="step-text">{step}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.emc2-container {
		margin: 24px 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.emc2-btn {
		background: linear-gradient(135deg, var(--einstein-dark, #2d5a27), var(--einstein, #4CAF50));
		color: #fff;
		font-family: 'Georgia', 'Times New Roman', serif;
		font-style: italic;
		font-size: 1.4rem;
		padding: 14px 36px;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		box-shadow: 0 0 20px var(--einstein-glow, rgba(76, 175, 80, 0.3));
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
		gap: 12px;
		position: relative;
		min-height: 52px;
		white-space: nowrap;
		overflow: hidden;
	}

	.emc2-btn:hover:not(.disabled) {
		box-shadow: 0 0 35px var(--einstein-glow-hover, rgba(76, 175, 80, 0.6));
		transform: scale(1.02);
	}

	.emc2-btn.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.emc2-btn.expanding,
	.emc2-btn.processing {
		max-width: 600px;
		width: 100%;
		justify-content: center;
		flex-wrap: wrap;
		white-space: normal;
		padding: 16px 28px;
		transition: max-width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94),
					width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94),
					padding 0.4s ease-out;
		box-shadow: 0 0 40px var(--einstein-glow-hover, rgba(76, 175, 80, 0.6));
	}

	.emc2-btn.done {
		transition: all 0.6s ease-in;
		box-shadow: 0 0 50px rgba(76, 175, 80, 0.8);
	}

	.emc2-formula {
		font-weight: 700;
		font-size: 1.5rem;
		letter-spacing: 1px;
		text-shadow: 0 0 10px rgba(76, 175, 80, 0.4);
	}

	.emc2-expansion {
		font-size: 1.1rem;
		font-weight: 400;
		opacity: 0.95;
		letter-spacing: 0.5px;
	}

	.cursor {
		animation: blink 0.6s step-end infinite;
		font-weight: 300;
	}

	@keyframes blink {
		50% { opacity: 0; }
	}

	.thinking {
		font-size: 0.85rem;
		opacity: 0.7;
		font-style: italic;
		width: 100%;
		text-align: center;
		margin-top: 4px;
	}

	.progress-steps {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		max-width: 400px;
	}

	.progress-step {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		color: var(--text-secondary, #5A6578);
		opacity: 0;
		animation: fadeIn 0.4s forwards;
		transition: color 0.3s;
	}

	.progress-step.active {
		color: #F59E0B;
	}

	.progress-step.done {
		color: #34C759;
	}

	.step-icon {
		font-size: 14px;
		width: 18px;
		text-align: center;
	}

	.progress-step.active .step-icon {
		animation: spin 1s linear infinite;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
