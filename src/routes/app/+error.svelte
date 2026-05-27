<!--
  F-14: App-scoped error boundary for /app/* routes.
  SvelteKit's root +error.svelte handles routing errors, but JS runtime errors
  inside /app/* components bubble up without any recovery UI.
  This boundary catches them within the app shell — navigation stays intact,
  user gets a scoped recovery view instead of a blank screen.
-->
<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let retrying = $state(false);
	let errorDetail = $state<string | null>(null);

	// Surface the error message for debugging (collapsed by default)
	let showDetail = $state(false);

	onMount(() => {
		const msg = $page.error?.message;
		if (msg) errorDetail = msg;

		// Auto-retry on JWT/session errors
		if ($page.status === 401) {
			retrying = true;
			setTimeout(() => window.location.reload(), 2000);
		}
	});

	function handleBack() {
		goto('/app/location');
	}

	function handleReload() {
		retrying = true;
		window.location.reload();
	}
</script>

<svelte:head>
	<title>RE² — Something went wrong</title>
</svelte:head>

<div class="app-error-wrap">
	<div class="app-error-card">
		{#if $page.status === 401}
			<div class="app-error-icon">🔄</div>
			<h2 class="app-error-title">Refreshing session...</h2>
			<p class="app-error-sub">Your session expired. Reconnecting — just a moment.</p>
			<a href="/login" class="app-error-btn secondary">Sign in again</a>
		{:else}
			<div class="app-error-icon">⚠️</div>
			<h2 class="app-error-title">
				{#if $page.status === 404}
					Page not found
				{:else if $page.status >= 500}
					Server error
				{:else}
					Something went wrong
				{/if}
			</h2>
			<p class="app-error-sub">
				{#if $page.status === 404}
					This page doesn't exist or has been moved.
				{:else}
					RE² hit an unexpected error on this page. Your scored locations are safe.
				{/if}
			</p>
			<div class="app-error-actions">
				<button class="app-error-btn primary" onclick={handleReload} disabled={retrying}>
					{retrying ? 'Reloading...' : '↻ Reload page'}
				</button>
				<button class="app-error-btn secondary" onclick={handleBack}>
					← Back to Score
				</button>
			</div>
			{#if errorDetail}
				<button
					class="app-error-detail-toggle"
					onclick={() => showDetail = !showDetail}
					type="button"
				>{showDetail ? 'Hide' : 'Show'} error detail</button>
				{#if showDetail}
					<pre class="app-error-detail">{errorDetail}</pre>
				{/if}
			{/if}
		{/if}
	</div>
</div>

<style>
	.app-error-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - 64px); /* account for any persistent nav */
		padding: 40px 24px;
		background: #f9fafb;
	}

	.app-error-card {
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 16px;
		padding: 40px 36px;
		max-width: 440px;
		width: 100%;
		text-align: center;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
	}

	.app-error-icon {
		font-size: 40px;
		margin-bottom: 16px;
		line-height: 1;
	}

	.app-error-title {
		font-size: 20px;
		font-weight: 700;
		color: #111827;
		margin: 0 0 10px 0;
	}

	.app-error-sub {
		font-size: 14px;
		color: #6b7280;
		margin: 0 0 28px 0;
		line-height: 1.6;
	}

	.app-error-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.app-error-btn {
		display: block;
		width: 100%;
		padding: 11px 20px;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		text-align: center;
		text-decoration: none;
		border: none;
		transition: all 0.15s;
	}

	.app-error-btn.primary {
		background: #0d9488;
		color: #ffffff;
	}
	.app-error-btn.primary:hover:not(:disabled) {
		background: #0f766e;
	}
	.app-error-btn.primary:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.app-error-btn.secondary {
		background: transparent;
		color: #374151;
		border: 1px solid #d1d5db;
	}
	.app-error-btn.secondary:hover {
		border-color: #0d9488;
		color: #0d9488;
	}

	.app-error-detail-toggle {
		margin-top: 20px;
		background: none;
		border: none;
		font-size: 11px;
		color: #9ca3af;
		cursor: pointer;
		text-decoration: underline;
	}

	.app-error-detail {
		margin-top: 10px;
		padding: 12px;
		background: #f3f4f6;
		border-radius: 8px;
		font-size: 11px;
		color: #374151;
		text-align: left;
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 160px;
		overflow-y: auto;
	}
</style>
