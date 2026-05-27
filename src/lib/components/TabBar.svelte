<script lang="ts">
	/**
	 * RE² Unified Tab Bar Component
	 * Standard underline-style tabs with optional icons.
	 * Props:
	 *   tabs - Array of { id, label, icon? } objects
	 *   activeTab - Currently active tab id
	 *   onTabChange - Callback when tab changes
	 *   compact - Use compact spacing for many tabs (default: false)
	 */
	let {
		tabs = [],
		activeTab = '',
		onTabChange = (id: string) => {},
		compact = false
	} = $props();
</script>

<nav class="tab-bar" class:compact role="tablist">
	{#each tabs as tab (tab.id)}
		<button
			class="tab-item"
			class:active={activeTab === tab.id}
			onclick={() => onTabChange(tab.id)}
			role="tab"
			aria-selected={activeTab === tab.id}
			aria-controls="tabpanel-{tab.id}"
		>
			{#if tab.icon}
				<span class="tab-icon">{tab.icon}</span>
			{/if}
			<span class="tab-label">{tab.label}</span>
		</button>
	{/each}
</nav>

<style>
	.tab-bar {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 24px;
		border-bottom: 2px solid var(--border, #E0E5ED);
		overflow-x: auto;
		padding-bottom: 0;
		scroll-behavior: smooth;
	}

	.tab-bar::-webkit-scrollbar {
		height: 4px;
	}

	.tab-bar::-webkit-scrollbar-track {
		background: transparent;
	}

	.tab-bar::-webkit-scrollbar-thumb {
		background: var(--border-subtle, #EBF0F5);
		border-radius: 2px;
	}

	.tab-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		border: none;
		background: transparent;
		color: var(--text-secondary, #5A6578);
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
		white-space: nowrap;
		border-bottom: 3px solid transparent;
		transition: all 0.2s ease;
		position: relative;
		bottom: -2px;
		font-family: inherit;
	}

	.tab-item:hover {
		color: var(--text, #1A202C);
		border-bottom-color: var(--teal-bg, rgba(13, 124, 110, 0.3));
	}

	.tab-item.active {
		color: var(--teal, #0D7C6E);
		border-bottom-color: var(--teal, #0D7C6E);
	}

	.tab-icon {
		font-size: 14px;
	}

	/* Compact mode for many tabs */
	.compact .tab-item {
		padding: 10px 14px;
		font-size: 12px;
		gap: 6px;
	}

	@media (max-width: 640px) {
		.tab-bar {
			gap: 0.25rem;
		}

		.tab-item {
			padding: 10px 12px;
			font-size: 12px;
		}
	}
</style>
