<script lang="ts">
	let { activeTab = 'score', hasModel = false, hasPlaybook = false, hasComparison = false } = $props<{
		activeTab?: string;
		hasModel?: boolean;
		hasPlaybook?: boolean;
		hasComparison?: boolean;
	}>();

	const tabs = [
		{ id: 'score', label: 'Score', always: true },
		{ id: 'business-model', label: 'Business Model', always: false, flag: 'hasModel' },
		{ id: 'playbook', label: 'Playbook', always: false, flag: 'hasPlaybook' },
		{ id: 'compare', label: 'Compare', always: false, flag: 'hasComparison' }
	];

	let visibleTabs = $derived(tabs.filter(t => {
		if (t.always) return true;
		if (t.flag === 'hasModel') return hasModel;
		if (t.flag === 'hasPlaybook') return hasPlaybook;
		if (t.flag === 'hasComparison') return hasComparison;
		return true;
	}));

	function scrollToSection(id: string) {
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}
</script>

<div class="tabs-bar">
	<div class="tabs-scroll">
		{#each visibleTabs as tab (tab.id)}
			<button
				class="tab-pill"
				class:active={activeTab === tab.id}
				onclick={() => scrollToSection(tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.tabs-bar {
		position: sticky;
		top: var(--header-h, 56px);
		z-index: 50;
		background: var(--bg);
		border-bottom: 1px solid var(--border);
		padding: 12px 0;
	}

	.tabs-scroll {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scrollbar-width: none;
		-ms-overflow-style: none;
		padding: 0 24px;
	}

	.tabs-scroll::-webkit-scrollbar {
		display: none;
	}

	.tab-pill {
		flex-shrink: 0;
		padding: 8px 20px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 20px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
		white-space: nowrap;
	}

	.tab-pill:hover {
		border-color: var(--border-hover);
		color: var(--text);
	}

	.tab-pill.active {
		background: var(--teal);
		border-color: var(--teal);
		color: white;
	}

	@media (max-width: 640px) {
		.tabs-scroll {
			padding: 0 16px;
		}

		.tab-pill {
			padding: 6px 16px;
			font-size: 12px;
		}
	}
</style>
