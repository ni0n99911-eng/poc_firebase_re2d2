<!--
	// 04.19.2026 18:00 - Location Context Map
	// Extracted from location/+page.svelte God Component
-->
<script lang="ts">
	import GoogleMap from '$lib/components/GoogleMap.svelte';
	import type { LocationAnalysisStore } from '../location-analysis.svelte';
	import { env } from '$env/dynamic/public';

	let { store, compact = true, showPin = true }: { 
		store: LocationAnalysisStore,
		compact?: boolean,
		showPin?: boolean
	} = $props();

</script>

<GoogleMap
	bind:this={store.mapRef}
	lat={store.mapLat}
	lng={store.mapLng}
	competitors={store.competitors}
	businessType={store.bizCategory}
	apiKey={env.PUBLIC_GOOGLE_MAPS_API_KEY}
	compact={compact}
	showPin={showPin}
/>
