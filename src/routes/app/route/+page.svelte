<script lang="ts">
	// This page should never render — the server load always redirects.
	// If it does render (edge case), show a loading spinner.
</script>

<svelte:head><title>RE² — Route Planner</title></svelte:head>


<div class="route-loading">
	<div class="spinner"></div>
	<p>Setting up your experience...</p>
</div>

<style>
	.route-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		gap: 16px;
	}
	.spinner {
		width: 32px;
		height: 32px;
		border: 2px solid var(--border, #e5e7eb);
		border-top-color: var(--teal, #0D9488);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	p {
		font-size: 14px;
		color: var(--text-secondary, #6B7280);
	}
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
