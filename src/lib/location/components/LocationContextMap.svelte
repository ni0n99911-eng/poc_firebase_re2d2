<!--
	// 04.19.2026 18:00 - Location Context Map
	// Extracted from location/+page.svelte God Component
-->
<script lang="ts">
	import MapView from '$lib/components/MapView.svelte';
	import type { LocationAnalysisStore } from '../location-analysis.svelte';

	let { store, compact = true, showPin = true }: { 
		store: LocationAnalysisStore,
		compact?: boolean,
		showPin?: boolean
	} = $props();

</script>

<MapView
	bind:this={store.mapRef}
	lat={store.mapLat}
	lng={store.mapLng}
	competitors={store.competitors}
	compact={compact}
	showPin={showPin}
/>
