<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Fallback client-side redirect — the +page.server.ts 302 redirect
	// should fire first, but if we somehow land here (e.g., client-side
	// nav edge case), redirect immediately.
	onMount(() => {
		goto('/app/business-plan', { replaceState: true });
	});
</script>

<svelte:head><title>RE² — Redirecting…</title></svelte:head>

<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;color:#6b7280;font-size:1rem;">
	Redirecting to Business Case…
</div>
