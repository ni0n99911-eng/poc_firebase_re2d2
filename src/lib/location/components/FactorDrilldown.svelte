<!--
	// 04.19.2026 18:00 - FactorDrilldown Component
	// Extracted from location/+page.svelte God Component
-->
<script lang="ts">
	import type { LocationAnalysisStore } from '../location-analysis.svelte';
	import type { EvidencePayload } from '$lib/utils/decision-engine';
	
	let { 
		store, 
		evidence 
	}: { 
		store: LocationAnalysisStore, 
		evidence: EvidencePayload 
	} = $props();
</script>

<div class="v3-ww-row">
	<div class="v3-ww-card">
		<div class="v3-ww-title v3-ww-green">✓ Working For You</div>
		{#if evidence.helping.length > 0}
			{#each (store.showAllHelping ? evidence.helping : evidence.helping.slice(0, 5)) as item}
			{@const _evLvl = item.value >= 70 ? 'Strong' : item.value >= 55 ? 'Moderate' : 'Limited'}
			<div class="v3-ww-item">
				<div class="v3-ww-dot v3-dot-g"></div>
				<div>
					<strong>{item.label}</strong> — {item.copy}
					<span class="v3-ev-badge v3-ev-{item.value >= 70 ? 'high' : item.value >= 55 ? 'med' : 'low'}">{_evLvl} evidence</span>
				</div>
			</div>
			{/each}
			<!-- UX-2.2: progressive disclosure — show all N when list > 5 -->
			{#if evidence.helping.length > 5}
				<button type="button" class="v3-ww-more" onclick={() => store.showAllHelping = !store.showAllHelping}>
					{store.showAllHelping ? 'Show less' : `Show all ${evidence.helping.length}`}
				</button>
			{/if}
		{:else}
			<div class="v3-ww-item v3-ww-empty">Complete your concept details to see what's working.</div>
		{/if}
	</div>
	<div class="v3-ww-card">
		<div class="v3-ww-title v3-ww-amber">⚠ Watch Out</div>
		{#if evidence.hurting.length > 0}
			{#each (store.showAllHurting ? evidence.hurting : evidence.hurting.slice(0, 5)) as item}
			{@const _evLvl = item.value >= 70 ? 'Strong' : item.value >= 55 ? 'Moderate' : 'Limited'}
			<div class="v3-ww-item">
				<div class="v3-ww-dot v3-dot-a"></div>
				<div>
					<strong>{item.label}</strong> — {item.copy}
					<span class="v3-ev-badge v3-ev-{item.value >= 70 ? 'high' : item.value >= 55 ? 'med' : 'low'}">{_evLvl} evidence</span>
				</div>
			</div>
			{/each}
			<!-- UX-2.2: progressive disclosure — show all N when list > 5 -->
			{#if evidence.hurting.length > 5}
				<button type="button" class="v3-ww-more" onclick={() => store.showAllHurting = !store.showAllHurting}>
					{store.showAllHurting ? 'Show less' : `Show all ${evidence.hurting.length}`}
				</button>
			{/if}
		{:else}
			<div class="v3-ww-item v3-ww-empty">No major flags detected. Keep going.</div>
		{/if}
	</div>
</div>
