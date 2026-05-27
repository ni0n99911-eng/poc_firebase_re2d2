<script lang="ts">
	import { captureFeedback } from '$lib/analytics/capture';

	let {
		sectionId = '',
		itemId = '',
		sessionId = '',
		personaType = '',
		onFeedback = (_type: string, _section: string) => {}
	} = $props<{
		sectionId: string;
		itemId?: string;
		sessionId?: string;
		personaType?: string;
		onFeedback?: (type: string, section: string) => void;
	}>();

	let voted = $state<'up' | 'down' | null>(null);
	let persisting = $state(false);

	async function handleVote(type: 'up' | 'down') {
		if (voted === type) {
			voted = null;
			return;
		}

		voted = type;
		onFeedback(type, sectionId);

		// Persist to Supabase via API (fire-and-forget)
		persisting = true;
		try {
			await captureFeedback(
				sessionId || null,
				sectionId,
				itemId || sectionId,
				type === 'up' ? 'helpful' : 'not_helpful',
				personaType || undefined
			);
		} finally {
			persisting = false;
		}
	}
</script>

<div class="feedback-row">
	<span class="feedback-label">Was this helpful?</span>
	<div class="feedback-buttons">
		<button
			class="fb-btn"
			class:active={voted === 'up'}
			onclick={() => handleVote('up')}
			title="Helpful"
			disabled={persisting}
		>
			👍
		</button>
		<button
			class="fb-btn"
			class:active={voted === 'down'}
			onclick={() => handleVote('down')}
			title="Not helpful"
			disabled={persisting}
		>
			👎
		</button>
	</div>
	{#if voted}
		<span class="feedback-thanks">Thanks for the feedback</span>
	{/if}
</div>

<style>
	.feedback-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
	}

	.feedback-label {
		font-size: 12px;
		color: var(--text-dim);
	}

	.feedback-buttons {
		display: flex;
		gap: 4px;
	}

	.fb-btn {
		background: none;
		border: 1px solid transparent;
		border-radius: 6px;
		padding: 4px 8px;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.15s ease;
		opacity: 0.5;
	}

	.fb-btn:hover {
		opacity: 1;
		background: var(--bg);
	}

	.fb-btn.active {
		opacity: 1;
		border-color: var(--teal);
		background: var(--teal-bg);
	}

	.fb-btn:disabled {
		cursor: wait;
	}

	.feedback-thanks {
		font-size: 11px;
		color: var(--teal);
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
