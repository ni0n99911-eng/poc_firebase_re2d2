<script lang="ts">
	import { page } from '$app/stores';

	let {
		locationIQHref = '/app/location',
		hasLocationIQ = false,
		hasVisitedFinancials = false,
		hasVisitedChecklist = false,
		onMenuOpen = () => {}
	} = $props();

	function isActive(prefix: string): boolean {
		return $page.url.pathname.startsWith(prefix);
	}
</script>

<nav class="pwa-bottom-nav" role="navigation" aria-label="Main navigation">

	<!-- 1. Score -->
	<a href={locationIQHref} class="nav-item" class:active={isActive('/app/location') || isActive('/app/brain')} aria-label="Score">
		<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
			<circle cx="12" cy="10" r="3"/>
		</svg>
		<span class="nav-label">Location</span>
	</a>

	<!-- 2. Business Case (locked until scored) -->
	{#if hasLocationIQ}
		<a href="/app/business-plan" class="nav-item" class:active={isActive('/app/business-plan') || isActive('/app/model') || isActive('/app/scenarios')} aria-label="Business Case">
			<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="2" y="7" width="20" height="14" rx="2"/>
				<path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
				<line x1="12" y1="12" x2="12" y2="16"/>
				<line x1="10" y1="14" x2="14" y2="14"/>
			</svg>
			<span class="nav-label">Business Case</span>
		</a>
	{:else}
		<span class="nav-item locked" aria-label="Business Case (locked)">
			<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="2" y="7" width="20" height="14" rx="2"/>
				<path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
			</svg>
			<span class="nav-label">Business Case</span>
		</span>
	{/if}

	<!-- 3. Centre FAB — New Analysis -->
	<a href="/app/onboarding?fresh=true" class="nav-item nav-fab" aria-label="New analysis">
		<span class="fab-circle">
			<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
				<line x1="12" y1="5" x2="12" y2="19"/>
				<line x1="5" y1="12" x2="19" y2="12"/>
			</svg>
		</span>
		<span class="nav-label">New</span>
	</a>

	<!-- 4. Dashboard (locked until Financials visited) -->
	{#if hasVisitedFinancials}
		<a href="/app/dashboard" class="nav-item" class:active={isActive('/app/dashboard')} aria-label="Dashboard">
			<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="3" width="7" height="7" rx="1"/>
				<rect x="14" y="3" width="7" height="7" rx="1"/>
				<rect x="3" y="14" width="7" height="7" rx="1"/>
				<rect x="14" y="14" width="7" height="7" rx="1"/>
			</svg>
			<span class="nav-label">Dashboard</span>
		</a>
	{:else}
		<span class="nav-item locked" aria-label="Dashboard (locked)">
			<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="3" width="7" height="7" rx="1"/>
				<rect x="14" y="3" width="7" height="7" rx="1"/>
				<rect x="3" y="14" width="7" height="7" rx="1"/>
				<rect x="14" y="14" width="7" height="7" rx="1"/>
			</svg>
			<span class="nav-label">Dashboard</span>
		</span>
	{/if}

	<!-- 5. Checklist (locked until Financials visited) -->
	{#if hasVisitedFinancials}
		<a href="/app/checklist" class="nav-item" class:active={isActive('/app/checklist')} aria-label="Checklist">
			<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M9 11l3 3L22 4"/>
				<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
			</svg>
			<span class="nav-label">Checklist</span>
		</a>
	{:else}
		<span class="nav-item locked" aria-label="Checklist (locked)">
			<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M9 11l3 3L22 4"/>
				<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
			</svg>
			<span class="nav-label">Checklist</span>
		</span>
	{/if}

	<!-- 5. Menu -->
	<button class="nav-item nav-menu-btn" onclick={onMenuOpen} aria-label="More options">
		<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
			<circle cx="12" cy="5" r="1" fill="currentColor"/>
			<circle cx="12" cy="12" r="1" fill="currentColor"/>
			<circle cx="12" cy="19" r="1" fill="currentColor"/>
		</svg>
		<span class="nav-label">More</span>
	</button>

</nav>

<style>
	.pwa-bottom-nav {
		/* Hidden by default — shown on mobile and in PWA standalone mode */
		display: none;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: calc(64px + env(safe-area-inset-bottom, 0px));
		padding-bottom: env(safe-area-inset-bottom, 0px);
		background: rgba(250, 247, 242, 0.97);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-top: 1px solid var(--border-subtle, #E8E2D8);
		z-index: 300;
		flex-direction: row;
		align-items: stretch;
		justify-content: space-around;
	}

	/* Show on mobile */
	@media (max-width: 768px) {
		.pwa-bottom-nav { display: flex; }
	}

	/* Show when installed as PWA */
	@media (display-mode: standalone) {
		.pwa-bottom-nav { display: flex; }
	}

	/* ── Individual tab items ── */
	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 4px;
		padding: 10px 4px 8px;
		color: var(--text-muted, #9CA3AF);
		text-decoration: none;
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		transition: color 0.15s ease;
		-webkit-tap-highlight-color: transparent;
		position: relative;
	}

	.nav-item:active:not(.locked) {
		opacity: 0.7;
	}

	.nav-item.active {
		color: var(--primary, #1a3a2a);
	}

	/* Active indicator — small dot above icon */
	.nav-item.active::before {
		content: '';
		position: absolute;
		top: 6px;
		left: 50%;
		transform: translateX(-50%);
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--primary, #1a3a2a);
	}

	.nav-item.locked {
		opacity: 0.3;
		cursor: default;
		pointer-events: none;
	}

	.nav-icon {
		width: 22px;
		height: 22px;
		flex-shrink: 0;
	}

	.nav-item.active .nav-icon {
		stroke-width: 2.5;
	}

	.nav-label {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		line-height: 1;
		white-space: nowrap;
	}

	/* ── Centre FAB ── */
	.nav-fab {
		flex: 0 0 72px;
		padding-top: 4px;
		color: var(--text-muted, #9CA3AF);
	}

	/* FAB doesn't get the dot indicator */
	.nav-fab.active::before { display: none; }

	.fab-circle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		background: var(--primary, #1a3a2a);
		box-shadow: 0 4px 16px rgba(26, 58, 42, 0.4);
		margin-top: -10px; /* raise above nav bar */
		flex-shrink: 0;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.nav-fab:active .fab-circle {
		transform: scale(0.93);
		box-shadow: 0 2px 8px rgba(26, 58, 42, 0.3);
	}

	.nav-menu-btn {
		/* reset button styles already handled by .nav-item */
	}
</style>
