<script lang="ts">
	let { message, highlights = [], icon = '💡', animate = true } = $props<{
		message: string;
		highlights?: string[];
		icon?: string;
		animate?: boolean;
	}>();
</script>

<div class="coaching-bubble" class:animate>
	<div class="bubble-header">
		<span class="bubble-icon">{icon}</span>
		<span class="bubble-label">RE² Coach</span>
	</div>
	<p class="bubble-message">{@html message}</p>
	{#if highlights.length > 0}
		<div class="bubble-highlights">
			{#each highlights as highlight}
				<span class="highlight-pill">{highlight}</span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.coaching-bubble {
		background: var(--teal-bg, rgba(13, 124, 110, 0.08));
		border: 1px solid var(--teal-ring, rgba(13, 124, 110, 0.15));
		border-radius: 16px;
		padding: 20px;
		font-size: 14px;
		line-height: 1.7;
		color: var(--text-secondary);
	}

	.coaching-bubble.animate {
		animation: bubbleIn 0.3s ease-out;
	}

	.bubble-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}

	.bubble-icon {
		font-size: 16px;
	}

	.bubble-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--teal);
	}

	.bubble-message {
		margin: 0;
		color: var(--text-secondary);
	}

	.bubble-message :global(strong) {
		color: var(--text);
		font-weight: 600;
	}

	.bubble-highlights {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}

	.highlight-pill {
		display: inline-flex;
		align-items: center;
		padding: 4px 12px;
		background: var(--teal-bg, rgba(13, 124, 110, 0.1));
		border-radius: 20px;
		font-size: 12px;
		font-weight: 500;
		color: var(--teal);
	}

	@keyframes bubbleIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (max-width: 640px) {
		.coaching-bubble {
			padding: 16px;
			font-size: 13px;
		}
	}
</style>
