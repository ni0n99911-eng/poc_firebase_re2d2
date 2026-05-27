<script>
	import { page } from '$app/stores';
	let showMobileMenu = $state(false);
</script>

<nav class="site-nav">
	<div class="site-nav-container">
		<a href="/" class="site-nav-logo" data-sveltekit-reload>
			RE<sup>2</sup>
		</a>
		<div class="site-nav-links" class:mobile-open={showMobileMenu}>
			<a href="/#how-it-works" class="snav-link" data-sveltekit-reload>How It Works</a>
			<a href="/methodology" class="snav-link" class:active={$page.url.pathname === '/methodology'} data-sveltekit-reload>Methodology</a>
			<a href="/pricing" class="snav-link" class:active={$page.url.pathname === '/pricing'} data-sveltekit-reload>Pricing</a>
			<a href="/about" class="snav-link" class:active={$page.url.pathname === '/about'} data-sveltekit-reload>About</a>
			{#if $page.data.user}
				<a href="/app/route" class="snav-cta" data-sveltekit-reload>Dashboard</a>
			{:else}
				<a href="/login" class="snav-cta" data-sveltekit-reload>Get Your Score</a>
				<a href="/login" class="snav-link snav-signin" data-sveltekit-reload>Sign In →</a>
			{/if}
		</div>
		<button
			class="snav-mobile-btn"
			onclick={() => (showMobileMenu = !showMobileMenu)}
			aria-label="Toggle menu"
		>
			<span></span>
			<span></span>
			<span></span>
		</button>
	</div>
</nav>

<style>
	.site-nav {
		position: fixed;
		top: 0; left: 0; right: 0;
		z-index: 100;
		padding: 16px 48px;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--border);
	}
	.site-nav-container {
		max-width: 1280px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.site-nav-logo {
		font-size: 22px;
		font-weight: 800;
		color: var(--text);
		letter-spacing: -0.5px;
		text-decoration: none;
	}
	.site-nav-logo sup {
		color: var(--teal);
		font-size: 14px;
	}

	.site-nav-links {
		display: flex;
		align-items: center;
		gap: 32px;
	}
	.snav-link {
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 14px;
		font-weight: 500;
		transition: color 0.2s;
	}
	.snav-link:hover, .snav-link.active {
		color: var(--teal);
	}
	.snav-signin { font-weight: 600; }

	.snav-cta {
		background: var(--teal);
		color: white;
		padding: 8px 20px;
		border-radius: 8px;
		font-weight: 600;
		font-size: 13px;
		text-decoration: none;
		transition: background 0.2s;
	}
	.snav-cta:hover { background: var(--teal-bright); }

	.snav-mobile-btn {
		display: none;
		background: none;
		border: none;
		color: var(--text);
		cursor: pointer;
		flex-direction: column;
		gap: 5px;
		padding: 8px;
	}
	.snav-mobile-btn span {
		width: 20px;
		height: 2px;
		background: currentColor;
		border-radius: 1px;
	}

	@media (max-width: 768px) {
		.site-nav { padding: 16px 24px; }
		.site-nav-links { display: none; }
		.site-nav-links.mobile-open {
			display: flex;
			flex-direction: column;
			position: absolute;
			top: 100%;
			left: 0;
			right: 0;
			background: rgba(255, 255, 255, 0.98);
			backdrop-filter: blur(10px);
			padding: 24px;
			border-bottom: 1px solid var(--border);
			gap: 16px;
		}
		.snav-mobile-btn { display: flex; }
	}
</style>
