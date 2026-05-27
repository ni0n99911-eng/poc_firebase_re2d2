<script>
	/**
	 * BusinessTypeCards — Visual persona selector rendered inside the first chat bubble
	 *
	 * Displayed as a grid of tappable cards with emoji + label.
	 * On selection, fires onSelect and the choice becomes a user message.
	 */

	let { onSelect, disabled = false } = $props();

	const personas = [
		{ id: 'coffee_shop', emoji: '☕', label: 'Coffee Shop' },
		{ id: 'restaurant', emoji: '🍽️', label: 'Restaurant' },
		{ id: 'florist', emoji: '💐', label: 'Florist' },
		{ id: 'medical_dental', emoji: '🦷', label: 'Dental / Medical' },
		{ id: 'spa_wellness', emoji: '💆', label: 'Spa / Wellness' },
		{ id: 'fitness', emoji: '💪', label: 'Fitness Studio' },
		{ id: 'barbershop', emoji: '✂️', label: 'Barbershop' },
		{ id: 'retail', emoji: '🛍️', label: 'Retail / Boutique' },
		{ id: 'something_else', emoji: '✨', label: 'Something else' }
	];
</script>

<div class="type-cards-wrapper">
	<div class="type-cards-grid">
		{#each personas as p (p.id)}
			<button
				class="type-card"
				{disabled}
				onclick={() => onSelect(p.id, p.label)}
			>
				<span class="type-emoji">{p.emoji}</span>
				<span class="type-label">{p.label}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.type-cards-wrapper {
		padding: 4px 0;
	}

	.type-cards-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.type-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px 8px;
		background: var(--surface);
		border: 1.5px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
	}

	.type-card:hover:not(:disabled) {
		border-color: var(--teal);
		background: var(--teal-bg);
		transform: translateY(-1px);
	}

	.type-card.selected {
		border-color: var(--teal);
		background: var(--teal-soft);
	}

	.type-card:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.type-emoji {
		font-size: 24px;
		line-height: 1;
	}

	.type-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
		text-align: center;
		line-height: 1.2;
	}

	@media (max-width: 480px) {
		.type-cards-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 6px;
		}

		.type-card {
			padding: 10px 6px;
		}

		.type-emoji {
			font-size: 20px;
		}

		.type-label {
			font-size: 10px;
		}
	}
</style>
