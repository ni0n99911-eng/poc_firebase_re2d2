<script>
	/**
	 * RE² Bottom Page Navigation
	 * Consistent Back/Next footer for all module pages.
	 * Props:
	 *   backHref - URL for back link (optional)
	 *   backLabel - Label for back link (e.g., "Business Model")
	 *   nextHref - URL for next link (optional)
	 *   nextLabel - Label for next link (e.g., "Financials")
	 *   nextIsGreen - Use green for cross-module transitions (default: false → red)
	 */
	let {
		backHref = '',
		backLabel = '',
		nextHref = '',
		nextLabel = '',
		nextIsGreen = false
	} = $props();
</script>

<div class="page-nav">
	{#if backHref}
		<a href={backHref} class="nav-link back">← Back: {backLabel}</a>
	{:else}
		<div></div>
	{/if}
	{#if nextHref}
		<a href={nextHref} class="nav-link next" class:green={nextIsGreen}>Next: {nextLabel} →</a>
	{/if}
</div>
<p class="re2-tm-line">Don't work for AI. Make AI <em>work for you.</em>™</p>

<style>
	.page-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px 0;
		margin-top: 32px;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
	}

	.nav-link {
		padding: 12px 24px;
		border-radius: 8px;
		font-weight: 600;
		font-size: 14px;
		text-decoration: none;
		transition: all 0.2s ease;
		white-space: nowrap;
	}
	/* P3-04 FIX: prevent label wrap on very narrow viewports (<360px) */
	@media (max-width: 360px) {
		.nav-link { font-size: 12px; padding: 10px 14px; }
	}

	.nav-link.back {
		background: var(--secondary-bg, #ffffff);
		border: 1px solid var(--secondary-border, #d2d2d7);
		color: var(--secondary-text, #1d1d1f);
	}

	.nav-link.back:hover {
		border-color: var(--cta, #FF3B30);
		color: var(--cta, #FF3B30);
	}

	.nav-link.next {
		background: #1e3a2a;
		border: 1px solid #1e3a2a;
		color: #ffffff;
	}

	.nav-link.next:hover {
		background: #15803d;
		border-color: #15803d;
	}

	.nav-link.next.green {
		background: #15803d;
		border-color: #15803d;
	}

	.nav-link.next.green:hover {
		background: #0f6630;
		border-color: #0f6630;
	}

	.re2-tm-line {
		text-align: center;
		font-size: 11.5px;
		color: #9ca3af;
		margin: 12px 0 0;
		line-height: 1.5;
	}
	.re2-tm-line em {
		font-style: normal;
		color: #059669;
		font-weight: 600;
	}
</style>
