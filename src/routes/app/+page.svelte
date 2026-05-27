<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
			const scored: any[] = (lp.scoredLocations || []).filter((l: any) => (l.score || 0) > 0);

			// ISS-05: Smart routing — single-location first-timers go to their LIQ page.
			// Multi-location users or those who've visited Business Case go to Dashboard.
			// Rationale: 1 result is not a portfolio — forcing Dashboard feels like a dead end.
			const hasVisitedBC = scored.some((l: any) => l.businessCase && !l.businessCase.isPartialSeed);

			if (scored.length === 1 && !hasVisitedBC) {
				goto(`/app/location?addr=${encodeURIComponent(scored[0].addr)}`);
			} else if (scored.length >= 2 || (sess.locationIQ || 0) > 0) {
				goto('/app/dashboard');
			} else {
				goto('/app/location');
			}
		} catch {
			goto('/app/location');
		}
	});
</script>
