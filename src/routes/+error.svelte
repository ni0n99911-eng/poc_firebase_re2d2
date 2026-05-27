<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let retrying = $state(false);

	// For 401 errors, attempt session refresh then reload
	onMount(() => {
		if ($page.status === 401) {
			retrying = true;
			// Give Clerk a moment to refresh the session, then reload
			setTimeout(() => {
				window.location.reload();
			}, 2000);
		}
	});

	function handleRetry() {
		retrying = true;
		window.location.reload();
	}
</script>

<svelte:head>
	<title>RE² — {$page.status === 401 ? 'Refreshing Session' : `${$page.status} Error`}</title>
</svelte:head>

<div class="error-page">
	<div class="error-content">
		{#if $page.status === 401}
			<!-- Session expired — auto-refresh -->
			<div class="error-code refresh-icon">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
			</div>
			<h1 class="error-title">Refreshing your session...</h1>
			<p class="error-message">Your session token expired. Reconnecting now — this takes just a moment.</p>
			<div class="error-actions">
				<a href="/login" class="error-btn-secondary">Sign in again</a>
			</div>
		{:else}
			<div class="error-code">{$page.status}</div>
			<h1 class="error-title">
				{#if $page.status === 404}
					Page not found
				{:else if $page.status === 403}
					Access denied
				{:else if $page.status >= 500}
					Something went wrong
				{:else}
					Unexpected error
				{/if}
			</h1>
			<p class="error-message">
				{#if $page.error?.message}
					{$page.error.message}
				{:else if $page.status === 404}
					The page you're looking for doesn't exist or has been moved.
				{:else if $page.status >= 500}
					The server hit an issue. This is usually temporary — try again in a moment.
				{:else}
					An unexpected error occurred. Please try again.
				{/if}
			</p>
			<div class="error-actions">
				<button class="error-btn" onclick={handleRetry} disabled={retrying}>
					{retrying ? 'Retrying...' : 'Try Again'}
				</button>
				{#if $page.data?.user}
					<a href="/app/location" class="error-btn-secondary">Back to Your Score</a>
				{:else}
					<a href="/" class="error-btn-secondary">Back to Home</a>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.error-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--white);
		padding: 24px;
	}

	.error-content {
		text-align: center;
		max-width: 480px;
	}

	.error-code {
		font-size: 72px;
		font-weight: 800;
		color: var(--teal);
		line-height: 1;
		margin-bottom: 8px;
		opacity: 0.8;
	}

	.error-title {
		font-size: 24px;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 12px 0;
	}

	.error-message {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0 0 32px 0;
		line-height: 1.5;
	}

	.error-actions {
		display: flex;
		gap: 12px;
		justify-content: center;
	}

	.error-btn {
		background: var(--teal);
		color: #ffffff;
		border: none;
		border-radius: 8px;
		padding: 12px 28px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.2s;
	}

	.error-btn:hover {
		background: #0B6B5F;
		transform: translateY(-1px);
		color: #ffffff;
	}

	.error-btn-secondary {
		background: transparent;
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px 28px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.2s;
	}

	.error-btn-secondary:hover {
		border-color: var(--teal);
		color: var(--teal);
	}

	.refresh-icon {
		font-size: 48px;
		color: var(--teal);
	}

	.spin {
		animation: spin 1.5s linear infinite;
		color: var(--teal);
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}
</style>
