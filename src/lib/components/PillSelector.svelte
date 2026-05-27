<script lang="ts">
	let {
		options,
		selected = null,
		onselect = (_id: string) => {},
		columns = 3
	} = $props<{
		options: Array<{ id: string; emoji?: string; label: string; description?: string }>;
		selected?: string | null;
		onselect?: (id: string) => void;
		columns?: number;
	}>();
</script>

<div class="pill-grid" style="--cols: {columns}">
	{#each options as option (option.id)}
		<button
			class="pill-card"
			class:selected={selected === option.id}
			class:is-other={option.id === 'other'}
			onclick={() => onselect(option.id)}
		>
			{#if option.emoji}
				<span class="pill-emoji">{option.emoji}</span>
			{/if}
			<span class="pill-label">{option.label}</span>
			{#if option.description}
				<span class="pill-desc">{option.description}</span>
			{/if}
			{#if selected === option.id}
				<span class="pill-check">✓</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.pill-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols, 3), 1fr);
		gap: 12px;
	}

	.pill-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 24px 16px;
		background: var(--surface);
		border: 2px solid var(--border);
		border-radius: var(--radius);
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
		text-align: center;
		min-height: 120px;
	}

	.pill-card:hover {
		border-color: var(--border-hover);
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}

	.pill-card.selected {
		border-color: var(--primary);
		background: var(--teal-bg, rgba(13, 124, 110, 0.06));
		box-shadow: 0 0 0 3px var(--teal-ring, rgba(13, 124, 110, 0.15)), 0 4px 16px var(--teal-glow, rgba(13, 124, 110, 0.1));
	}

	.pill-card.is-other {
		border-style: dashed;
	}

	.pill-emoji {
		font-size: 32px;
		line-height: 1;
	}

	.pill-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.3px;
	}

	.pill-desc {
		font-size: 11px;
		color: var(--text-tertiary);
		line-height: 1.3;
	}

	.pill-check {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 22px;
		height: 22px;
		background: var(--primary);
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 700;
		animation: checkIn 0.2s ease-out;
	}

	@keyframes checkIn {
		from { transform: scale(0); }
		to { transform: scale(1); }
	}

	@media (max-width: 768px) {
		.pill-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 10px;
		}

		.pill-card {
			min-height: 100px;
			padding: 16px 12px;
			gap: 8px;
		}

		.pill-emoji { font-size: 28px; }
		.pill-label { font-size: 13px; }
	}

	@media (max-width: 480px) {
		.pill-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 8px;
		}

		.pill-card {
			min-height: 90px;
			padding: 14px 10px;
		}

		.pill-emoji { font-size: 24px; }
		.pill-label { font-size: 12px; }
		.pill-desc { font-size: 10px; }
	}
</style>
