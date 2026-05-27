<script lang="ts">
	import FeedbackButton from '$lib/components/FeedbackButton.svelte';
	import { authedFetch } from '$lib/authed-fetch';

	let {
		personaType,
		conceptDescription,
		address,
		compositeScore,
		scores,
		warnings,
		liveIntel
	} = $props<{
		personaType: string;
		conceptDescription: string;
		address: string;
		compositeScore: number;
		scores: Record<string, number>;
		warnings: Array<{ title: string }>;
		liveIntel: any;
	}>();

	interface PlaybookStep {
		number: number;
		title: string;
		description: string;
	}

	let steps: PlaybookStep[] = $state([]);
	let loading = $state(false);
	let error = $state(false);

	// Fallback template when API is unavailable
	const fallbackSteps: PlaybookStep[] = [
		{
			number: 1,
			title: 'Walk the block at peak hours',
			description: 'Observe customer flow, parking challenges, and competing venues during your target operating hours. This ground truth trumps any data.'
		},
		{
			number: 2,
			title: 'Talk to 5 existing operators',
			description: "Find similar businesses nearby and ask about rent trends, lease terms, and hidden costs. You'll learn what the spreadsheet doesn't reveal."
		},
		{
			number: 3,
			title: 'Verify utilities and infrastructure',
			description: 'Have an inspector check electrical, plumbing, HVAC capacity, and any major build-out costs. This often surprises first-timers.'
		}
	];

	async function fetchPlaybook() {
		if (!compositeScore || compositeScore <= 0) {
			return;
		}

		loading = true;
		error = false;

		try {
			const response = await authedFetch('/api/generate-playbook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					persona_type: personaType,
					concept_description: conceptDescription,
					address,
					composite_score: compositeScore,
					scores,
					warnings: warnings.map((w) => w.title)
				})
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			const data = await response.json();
			if (data.steps && Array.isArray(data.steps)) {
				steps = data.steps;
			} else {
				steps = fallbackSteps;
			}
		} catch (err) {
			console.error('[Playbook] API fetch failed:', err);
			error = true;
			steps = fallbackSteps;
		} finally {
			loading = false;
		}
	}

	// Fetch on mount when score is available
	$effect(() => {
		if (compositeScore > 0 && steps.length === 0) {
			fetchPlaybook();
		}
	});
</script>

<div class="playbook-card">
	<div class="playbook-header">
		<span class="playbook-icon">🎯</span>
		<h3 class="playbook-title">Your Next 5 Moves</h3>
	</div>

	{#if loading}
		<!-- Loading skeleton -->
		<div class="steps-container">
			{#each [1, 2, 3, 4, 5] as _}
				<div class="skeleton-step">
					<div class="skeleton-circle"></div>
					<div class="skeleton-content">
						<div class="skeleton-title"></div>
						<div class="skeleton-description"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="steps-container">
			{#each steps as step (step.number)}
				<div class="step">
					<div class="step-connector"></div>
					<div class="step-circle">{step.number}</div>
					<div class="step-content">
						<h4 class="step-title">{step.title}</h4>
						<p class="step-description">{step.description}</p>
					</div>
				</div>
			{/each}
		</div>

		<div class="playbook-footer">
			<button class="download-button" disabled title="Coming soon">
				<span>📥</span> Download Full Report (PDF)
			</button>
		</div>

		<div class="feedback-row">
			<FeedbackButton sectionId="playbook" />
		</div>
	{/if}
</div>

<style>
	.playbook-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 24px;
		margin-bottom: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.playbook-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 24px;
	}

	.playbook-icon {
		font-size: 24px;
		line-height: 1;
	}

	.playbook-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text);
		margin: 0;
	}

	.steps-container {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 20px;
		margin-bottom: 20px;
	}

	/* Vertical dashed connecting line */
	.steps-container::before {
		content: '';
		position: absolute;
		left: 15px;
		top: 44px;
		bottom: 0;
		width: 2px;
		background-image: linear-gradient(to bottom, var(--border) 0%, var(--border) 60%, transparent 60%, transparent 100%);
		background-size: 2px 8px;
		background-repeat: repeat-y;
		pointer-events: none;
	}

	.step {
		display: flex;
		gap: 16px;
		position: relative;
		padding-left: 60px;
	}

	.step-connector {
		position: absolute;
		left: 0;
		top: 0;
		width: 32px;
		height: 32px;
	}

	.step-circle {
		position: absolute;
		left: -1px;
		top: -1px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--teal);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 14px;
		flex-shrink: 0;
	}

	.step-content {
		flex: 1;
		padding-top: 4px;
	}

	.step-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 6px 0;
	}

	.step-description {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	/* Loading skeleton */
	.skeleton-step {
		display: flex;
		gap: 16px;
		padding-left: 60px;
		animation: pulse 2s ease-in-out infinite;
	}

	.skeleton-circle {
		position: absolute;
		left: -1px;
		top: 8px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bg);
		flex-shrink: 0;
	}

	.skeleton-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.skeleton-title {
		height: 16px;
		background: var(--bg);
		border-radius: 4px;
		width: 60%;
	}

	.skeleton-description {
		height: 14px;
		background: var(--bg);
		border-radius: 4px;
		width: 85%;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	.playbook-footer {
		border-top: 1px solid var(--border);
		padding-top: 16px;
		display: flex;
		justify-content: center;
	}

	.download-button {
		padding: 10px 16px;
		border: 1px solid var(--teal);
		background: transparent;
		color: var(--teal);
		border-radius: 6px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.download-button:hover:not(:disabled) {
		background: rgba(13, 124, 110, 0.08);
	}

	.download-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.download-button:disabled:hover {
		position: relative;
	}

	.download-button:disabled::after {
		content: attr(title);
	}

	@media (max-width: 640px) {
		.playbook-card {
			padding: 16px;
		}

		.playbook-header {
			margin-bottom: 16px;
		}

		.step {
			padding-left: 48px;
		}

		.step-circle {
			width: 28px;
			height: 28px;
			font-size: 12px;
		}

		.steps-container::before {
			left: 13px;
		}

		.step-title {
			font-size: 14px;
		}

		.step-description {
			font-size: 12px;
		}
	}

	.feedback-row {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}
</style>
