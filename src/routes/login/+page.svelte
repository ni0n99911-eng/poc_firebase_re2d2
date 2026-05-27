<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { SITE_CONFIG } from '$lib/modules';

	// Use key from server (set in load function from env var PUBLIC_CLERK_PUBLISHABLE_KEY).
	// Fall back to PUBLIC_ env var for local dev. Never hardcode keys here. (#51)
	const DEV_KEY = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY || '';
	let clerkKey = $derived($page.data?.clerkPublishableKey || DEV_KEY);

	let clerkLoaded = $state(false);
	let clerkError = $state(false);
	let mountElement: HTMLElement | null = null;

	/**
	 * Get the Clerk JS script URL.
	 * Production uses clerk.resquared.io (CNAME → frontend-api.clerk.services).
	 * Dev/staging uses clerk.jaredclaw.com.
	 * Dev keys use the accounts.dev subdomain directly.
	 */
	function getClerkScriptUrl(key: string): string {
		if (key.startsWith('pk_test_')) {
			return 'https://related-cattle-47.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
		}
		// Production: use Clerk's CDN for the JS bundle (the CNAME handles API calls)
		return 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
	}

	function loadClerk() {
		clerkError = false;
		clerkLoaded = false;

		const key = clerkKey;

		const script = document.createElement('script');
		script.src = getClerkScriptUrl(key);
		script.async = true;
		script.setAttribute('data-clerk-publishable-key', key);
		script.crossOrigin = 'anonymous';

		script.onload = async () => {
			try {
				if (window.Clerk) {
					await window.Clerk.load({ publishableKey: key });

					// If user is already signed in, redirect straight to dashboard
					// via full page load (not SvelteKit client navigation)
					if (window.Clerk.user) {
						window.location.href = '/app/route';
						return;
					}

					if (mountElement) {
						window.Clerk.mountSignIn(mountElement, {
							fallbackRedirectUrl: '/app/route',
							signUpUrl: '/login',
							appearance: {
								elements: {
									footerPagesLink: { display: 'none' },
									badge: { display: 'none' }
								}
							}
						});
						clerkLoaded = true;

						// Remove "Development mode" badge if present
						setTimeout(() => {
							mountElement?.querySelectorAll('p, div').forEach(el => {
								if (el.textContent?.trim() === 'Development mode') {
									el.closest('div')?.parentElement?.remove();
								}
							});
						}, 500);

						// Listen for successful sign-in and force a full page load
						// so the server hook picks up the __session cookie
						window.Clerk.addListener((resources) => {
							if (resources.session) {
								window.location.href = '/app/route';
							}
						});
					}
				}
			} catch (err) {
				console.error('Clerk load error:', err);
				clerkError = true;
			}
		};

		script.onerror = () => {
			console.error('Failed to load Clerk JS');
			clerkError = true;
		};

		document.head.appendChild(script);
	}

	onMount(() => {
		loadClerk();
		// Timeout: if Clerk hasn't loaded after 8 seconds, show error
		setTimeout(() => {
			if (!clerkLoaded && !clerkError) {
				clerkError = true;
			}
		}, 8000);
	});
</script>

<svelte:head>
	<title>RE² — Sign In</title>
</svelte:head>

<div class="login-page">
	<!-- Left panel — editorial, deep green -->
	<div class="left-panel">
		<a href="/" class="left-logo">RE<sup>2</sup></a>
		<div class="left-body">
			<p class="left-eyebrow">For founders who do the work</p>
			<h1 class="left-headline">The only number that matters before you <em>sign</em></h1>
			<div class="left-proof">
				<div class="proof-item">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
					<span>Score any NYC address in under 10 seconds</span>
				</div>
				<div class="proof-item">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
					<span>17 live data layers — foot traffic, competitors, survival rates</span>
				</div>
				<div class="proof-item">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
					<span>Model your financials before signing the lease</span>
				</div>
			</div>
		</div>
		<p class="left-footer">resquared.io — Location Intelligence for Founders</p>
	</div>

	<!-- Right panel — form -->
	<div class="right-panel">
		<a href="/" class="back-link">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
			Back
		</a>

		<div class="form-content">
			<div class="form-header">
				<h2>Welcome back</h2>
				<p class="form-sub">Sign in to your RE² account</p>
			</div>

			<div
				bind:this={mountElement}
				class="clerk-mount"
				class:loading={!clerkLoaded}
			></div>

			{#if clerkError}
				<div class="error-state">
					<p class="error-msg">Having trouble signing in? Refresh the page or contact {SITE_CONFIG.emails.support}</p>
					<button class="retry-btn" onclick={() => loadClerk()}>Try again</button>
				</div>
			{:else if !clerkLoaded}
				<div class="loader">
					<div class="spinner"></div>
					<p>Loading…</p>
				</div>
			{/if}
		</div>

		<p class="right-footer">Secure authentication by Clerk</p>
	</div>
</div>

<style>
	/* ── Layout ─────────────────────────────────────────────── */
	.login-page {
		display: flex;
		min-height: 100vh;
		font-family: var(--font-body);
	}

	/* ── Left panel — editorial deep green ──────────────────── */
	.left-panel {
		flex: 0 0 45%;
		background: var(--accent-deep-green);
		display: flex;
		flex-direction: column;
		padding: 48px 56px;
		position: relative;
		overflow: hidden;
	}

	.left-panel::after {
		content: '';
		position: absolute;
		bottom: -120px;
		right: -80px;
		width: 400px;
		height: 400px;
		background: rgba(255,255,255,0.03);
		border-radius: 50%;
		pointer-events: none;
	}

	.left-logo {
		font-family: var(--font-display);
		font-size: 28px;
		font-weight: 400;
		color: #ffffff;
		text-decoration: none;
		letter-spacing: -0.5px;
		margin-bottom: auto;
	}

	.left-logo sup {
		font-size: 14px;
		vertical-align: super;
	}

	.left-body {
		margin: auto 0;
		padding: 48px 0;
	}

	.left-eyebrow {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--accent);
		margin: 0 0 20px 0;
	}

	.left-headline {
		font-family: var(--font-display);
		font-size: 38px;
		font-weight: 400;
		color: #ffffff;
		line-height: 1.25;
		margin: 0 0 36px 0;
		letter-spacing: -0.5px;
	}

	.left-headline em {
		font-style: italic;
		color: var(--accent-marigold);
	}

	.left-proof {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.proof-item {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		color: rgba(255,255,255,0.75);
		font-size: 14px;
		line-height: 1.5;
	}

	.proof-item svg {
		flex-shrink: 0;
		margin-top: 2px;
		color: var(--accent);
	}

	.left-footer {
		font-size: 12px;
		color: rgba(255,255,255,0.35);
		margin: 0;
		margin-top: auto;
	}

	/* ── Right panel — form ──────────────────────────────────── */
	.right-panel {
		flex: 1;
		background: var(--bg);
		display: flex;
		flex-direction: column;
		padding: 32px 48px 40px;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--text-secondary);
		text-decoration: none;
		transition: color 0.2s;
		align-self: flex-start;
		margin-bottom: auto;
	}

	.back-link:hover {
		color: var(--text);
	}

	.form-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		max-width: 400px;
		width: 100%;
		margin: 0 auto;
		padding: 48px 0;
	}

	.form-header {
		margin-bottom: 32px;
	}

	.form-header h2 {
		font-family: var(--font-display);
		font-size: 30px;
		font-weight: 400;
		color: var(--text);
		margin: 0 0 8px 0;
		letter-spacing: -0.3px;
	}

	.form-sub {
		font-size: 14px;
		color: var(--text-secondary);
		margin: 0;
	}

	.clerk-mount {
		min-height: 100px;
	}

	.clerk-mount.loading {
		opacity: 0.3;
	}

	.loader {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 32px 0;
	}

	.spinner {
		width: 28px;
		height: 28px;
		border: 2px solid var(--border-warm);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	.loader p {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-state {
		text-align: center;
		padding: 24px 0;
	}

	.error-msg {
		font-size: 14px;
		color: #c0392b;
		margin: 0 0 16px 0;
		line-height: 1.5;
	}

	.retry-btn {
		background: var(--accent-deep-green);
		color: #ffffff;
		border: none;
		border-radius: 8px;
		padding: 10px 24px;
		font-size: 14px;
		font-weight: 600;
		font-family: var(--font-body);
		cursor: pointer;
		transition: all 0.2s;
	}

	.retry-btn:hover {
		background: var(--accent-deep-green-dark);
		transform: translateY(-1px);
	}

	.right-footer {
		font-size: 12px;
		color: var(--text-muted);
		margin: 0;
		text-align: center;
	}

	/* ── Clerk global overrides ──────────────────────────────── */
	:global(.cl-card),
	:global(.cl-signIn-root),
	:global(.cl-rootBox),
	:global(.cl-cardBox) {
		background: transparent !important;
		box-shadow: none !important;
		border: none !important;
	}

	:global(.cl-internal-b3fm6y),
	:global(.cl-footer),
	:global(.cl-footerAction),
	:global(.cl-footerPages),
	:global(.cl-footerPagesLink) {
		background: transparent !important;
	}

	:global(.cl-main),
	:global(.cl-form),
	:global(.cl-formFieldRow),
	:global(.cl-alternativeMethods),
	:global(.cl-identityPreview),
	:global(.cl-internal-19cy85v),
	:global(.cl-internal-1dauvpw) {
		background: transparent !important;
	}

	/* Hide dev mode badge */
	:global(.cl-internal-pe6vm4),
	:global(.cl-internal-1fpq5at),
	:global(.cl-badge--warning),
	:global(.cl-badge--development) {
		display: none !important;
	}

	:global(.cl-headerTitle),
	:global(.cl-headerSubtitle) {
		display: none !important;
	}

	:global(.cl-socialButtonsBlockButton) {
		background: #ffffff !important;
		border: 1px solid var(--border-warm) !important;
		color: var(--text) !important;
		border-radius: 10px !important;
		padding: 12px !important;
		font-weight: 600 !important;
		font-family: var(--font-body) !important;
		transition: all 0.2s !important;
	}

	:global(.cl-socialButtonsBlockButton:hover) {
		border-color: var(--accent) !important;
		box-shadow: 0 2px 8px rgba(74,124,92,0.12) !important;
	}

	:global(.cl-socialButtonsBlockButtonText) {
		color: var(--text) !important;
	}

	:global(.cl-dividerText) {
		color: var(--text-muted) !important;
		font-size: 12px !important;
	}

	:global(.cl-dividerLine) {
		background: var(--border-warm) !important;
	}

	:global(.cl-formFieldLabel) {
		color: var(--text-secondary) !important;
		font-size: 13px !important;
		font-weight: 500 !important;
		font-family: var(--font-body) !important;
	}

	:global(.cl-formFieldInput) {
		background: #ffffff !important;
		border: 1px solid var(--border-warm) !important;
		color: var(--text) !important;
		border-radius: 8px !important;
		padding: 12px 14px !important;
		font-size: 16px !important;
		font-family: var(--font-body) !important;
	}

	:global(.cl-formFieldInput:focus) {
		border-color: var(--accent) !important;
		box-shadow: 0 0 0 3px var(--sage-bg) !important;
	}

	:global(.cl-formButtonPrimary) {
		background: var(--accent-deep-green) !important;
		color: #ffffff !important;
		font-weight: 700 !important;
		border-radius: 8px !important;
		padding: 12px !important;
		font-size: 14px !important;
		font-family: var(--font-body) !important;
		transition: background 0.2s !important;
	}

	:global(.cl-formButtonPrimary:hover) {
		background: var(--accent-deep-green-dark) !important;
	}

	:global(.cl-footerActionText) {
		color: var(--text-secondary) !important;
	}

	:global(.cl-footerActionLink) {
		color: var(--accent) !important;
		font-weight: 600 !important;
	}

	:global(.clerk-mount *) {
		--clerk-bg: transparent;
	}

	:global(.cl-card > *),
	:global(.cl-signIn-root > *) {
		background-color: transparent !important;
	}

	:global(.cl-formFieldInputShowPasswordButton) {
		color: var(--text-muted) !important;
	}

	:global(.cl-otpCodeFieldInput) {
		background: #ffffff !important;
		border: 1px solid var(--border-warm) !important;
		color: var(--text) !important;
	}

	:global(.cl-identityPreview) {
		background: var(--bg-warm-alt) !important;
		border: 1px solid var(--border-warm) !important;
	}

	:global(.cl-identityPreviewText) {
		color: var(--text) !important;
	}

	:global(.cl-identityPreviewEditButton) {
		color: var(--accent) !important;
	}

	:global(.cl-formResendCodeLink) {
		color: var(--accent) !important;
	}

	:global(.cl-alert) {
		background: var(--bg-warm-alt) !important;
		border: 1px solid var(--border-warm) !important;
		color: var(--text) !important;
	}

	/* ── Responsive ──────────────────────────────────────────── */
	@media (max-width: 900px) {
		.left-panel {
			flex: 0 0 40%;
			padding: 40px 40px;
		}

		.left-headline {
			font-size: 30px;
		}

		.right-panel {
			padding: 32px 32px 40px;
		}
	}

	@media (max-width: 680px) {
		.login-page {
			flex-direction: column;
		}

		.left-panel {
			flex: none;
			padding: 32px 24px;
			min-height: auto;
		}

		.left-body {
			padding: 24px 0;
		}

		.left-headline {
			font-size: 26px;
		}

		.left-footer {
			display: none;
		}

		.right-panel {
			flex: 1;
			padding: 24px 24px 32px;
		}

		.form-content {
			padding: 24px 0;
		}
	}
</style>
