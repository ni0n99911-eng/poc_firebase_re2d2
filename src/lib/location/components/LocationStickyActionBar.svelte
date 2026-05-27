<!--
	// 04.19.2026 18:00 - LocationStickyActionBar Component
	// Extracted from location/+page.svelte God Component
-->
<script lang="ts">
	let { 
		hasResult, 
		fitIQ, 
		showStickyBar, 
		analysisAddress 
	}: { 
		hasResult: boolean, 
		fitIQ: number, 
		showStickyBar: boolean, 
		analysisAddress: string 
	} = $props();
</script>

{#if hasResult && fitIQ > 0 && showStickyBar}
<div class="z1-sticky-bar">
	<div class="z1-sticky-addr">{analysisAddress ? analysisAddress.split(',')[0] : 'Location'}</div>
	<div class="z1-sticky-scores">
		<span class="z1-sticky-score">Score <strong>{fitIQ}/100</strong></span>
	</div>
	<a href="/app/business-plan" class="z1-sticky-cta">Business Case →</a>
</div>
{/if}
