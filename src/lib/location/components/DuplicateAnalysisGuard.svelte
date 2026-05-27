<!--
	// 04.19.2026 18:00 - Duplicate Analysis Guard
	// Extracted from location/+page.svelte God Component
-->
<script lang="ts">
	import type { LocationAnalysisStore } from '../location-analysis.svelte';

	let { store }: { store: LocationAnalysisStore } = $props();

	function proceedWithDuplicateAnalysis() {
		store.clearDuplicateGuard();
	}

	function viewExistingDuplicate() {
		if (!store.duplicateFound?.location) return;
		store.clearDuplicateGuard();
		// Future expansion: auto-scroll or highlight the existing item
	}
</script>

{#if store.duplicateFound}
	<div 
		class="duplicate-modal-overlay" 
		onclick={() => store.clearDuplicateGuard()} 
		role="presentation"
	></div>
	
	<div class="duplicate-modal">
		<div class="duplicate-modal-content">
			<div class="duplicate-modal-icon">⚠️</div>
			<h2 class="duplicate-modal-title">Already analyzed</h2>
			<p class="duplicate-modal-msg">
				You've already analyzed <strong>{store.duplicateFound.address}</strong> for <strong>{store.duplicateFound.conceptType}</strong>.
			</p>
			<div class="duplicate-modal-actions">
				<button class="duplicate-btn duplicate-btn-secondary" onclick={viewExistingDuplicate}>
					View Existing
				</button>
				<button class="duplicate-btn duplicate-btn-primary" onclick={proceedWithDuplicateAnalysis}>
					Re-analyze
				</button>
			</div>
		</div>
	</div>
{/if}
