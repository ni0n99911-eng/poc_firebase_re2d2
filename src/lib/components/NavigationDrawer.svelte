<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let {
		currentPath = '',
		analyzedAddress = ''
	} = $props<{
		currentPath?: string;
		analyzedAddress?: string;
	}>();

	// Resolve address from session if not passed as prop
	let sessionAddr = $state('');
	let displayHood = $state('');

	let displayAddress = $derived(analyzedAddress || sessionAddr);

	$effect(() => {
		if (!analyzedAddress) {
			try {
				const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
				sessionAddr = sess.analyzedAddress || '';
				displayHood = sess.neighborhood || sess.primaryHood || '';
			} catch {}
		}
	});

	// Dynamic unlock state based on session
	let hasLocationIQ = $state(false);
	let hasVisitedBusinessPlan = $state(false);
	let hasVisitedScenarios = $state(false);
	let hasVisitedChecklist = $state(false);

	function readUnlockState() {
		if (typeof window === 'undefined') return;
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			hasLocationIQ = (sess.locationIQ || 0) > 0;
		} catch {}
		try {
			hasVisitedBusinessPlan = localStorage.getItem('re2_businessplan_visited') === 'true';
		} catch {}
		try {
			hasVisitedScenarios = localStorage.getItem('re2_model_visited') === 'true';
		} catch {}
		try {
			hasVisitedChecklist = localStorage.getItem('re2_checklist_visited') === 'true';
		} catch {}
	}

	$effect(() => {
		readUnlockState();
		// Re-read when the location page writes locationIQ to localStorage
		window.addEventListener('storage', readUnlockState);
		return () => window.removeEventListener('storage', readUnlockState);
	});

	// Flow: Score → Business Case → Dashboard → Launch Checklist
	const modules = $derived([
		{ num: 1, label: 'Score',      short: 'Score',  path: '/app/location',      locked: false, done: hasLocationIQ,          next: !hasLocationIQ },
		{ num: 2, label: 'Business Case',    short: 'Case',      path: '/app/business-plan', locked: false, done: hasVisitedBusinessPlan, next: hasLocationIQ && !hasVisitedBusinessPlan },
		{ num: 3, label: 'Dashboard',        short: 'Dashboard', path: '/app/dashboard',     locked: !hasVisitedBusinessPlan, done: false, next: hasVisitedBusinessPlan && !hasVisitedChecklist },
		{ num: 4, label: 'Launch Checklist', short: 'Checklist', path: '/app/checklist',     locked: !hasVisitedBusinessPlan, done: hasVisitedChecklist, next: false },
	]);

	// Coming-soon pills (not steps, just pills)
	const comingSoonPills = [
		{ label: 'Store IQ' },
		{ label: 'Loan Package' },
	];

	function isActive(path: string): boolean {
		return $page.url.pathname === path || $page.url.pathname.startsWith(path + '/');
	}

	function handleModuleClick(path: string, locked: boolean) {
		if (!locked) goto(path);
	}

	// UX-G: firstName + initials from Clerk client-side
	let firstName = $state('');
	let initials = $state('');

	$effect(() => {
		if (typeof window === 'undefined') return;
		try {
			const clerkUser = (window as any).Clerk?.user;
			if (clerkUser) {
				firstName = clerkUser.firstName || clerkUser.fullName?.split(' ')[0] || '';
				const first = clerkUser.firstName?.[0] || '';
				const last = clerkUser.lastName?.[0] || '';
				initials = (first + last).toUpperCase() || clerkUser.fullName?.[0]?.toUpperCase() || '?';
			}
		} catch {}
	});

	function openProfile() {
		try { (window as any).Clerk?.openUserProfile(); } catch {}
	}
</script>

<nav class="topbar">
	<div class="topbar-left">
		<a href="/app/dashboard" class="logo">RE<sup>2</sup></a>
		{#if displayHood || displayAddress}
			<div class="sep"></div>
			<span class="addr">{displayHood || displayAddress}</span>
		{/if}
	</div>
	<div class="topbar-right">
		<div class="module-nav">
			{#each modules as mod}
				<button
					class="mod-btn"
					class:active={isActive(mod.path)}
					class:locked={mod.locked}
					class:done={mod.done}
					class:next={mod.next && !isActive(mod.path)}
					disabled={mod.locked}
					title={mod.locked ? 'Complete the previous step to unlock' : undefined}
					onclick={() => handleModuleClick(mod.path, mod.locked)}
				>
					{#if mod.done}
						<span class="mod-num done">✓</span>
					{:else}
						<span class="mod-num">{mod.num}</span>
					{/if}
					<span class="mod-label">{mod.label}</span>
					<span class="mod-label-short" aria-hidden="true">{mod.short}</span>
					{#if mod.locked}
						<span class="mod-lock"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
					{/if}
				</button>
			{/each}
		</div>
		<div class="mod-sep"></div>
		<a href="/app/vault" class="tb-btn sec" title="Data Vault">🗄</a>
		<!-- UX-G: firstName + initials avatar -->
		{#if firstName || initials}
		<div class="tb-user" onclick={openProfile} role="button" tabindex="0" title="Account settings">
			{#if firstName}<span class="tb-firstname">{firstName}</span>{/if}
			{#if initials}<div class="tb-avatar">{initials}</div>{/if}
		</div>
		{/if}
	</div>
</nav>

<style>
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 20px;
		background: #f5f0e8;
		border-bottom: 1px solid #e0ddd7;
		height: 52px;
		position: sticky;
		top: 0;
		z-index: 200;
		font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
	}

	.topbar-left {
		display: flex;
		align-items: center;
		gap: 16px;
		min-width: 0;
	}

	.logo {
		font-family: 'Playfair Display', Georgia, serif;
		font-size: 18px;
		font-weight: 700;
		color: #1e3a2a;
		text-decoration: none;
		flex-shrink: 0;
		letter-spacing: -0.3px;
	}

	.logo sup {
		color: #1e3a2a;
		font-size: 10px;
		opacity: 0.6;
	}

	.sep {
		width: 1px;
		height: 18px;
		background: #E5E7EB;
		flex-shrink: 0;
	}

	.addr {
		font-size: 13px;
		color: #374151;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.addr-sub {
		font-size: 10px;
		color: #9CA3AF;
		margin-left: 6px;
	}

	.topbar-right {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	.module-nav {
		display: flex;
		align-items: center;
		gap: 0;
	}

	.mod-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
		color: #374151;
		background: transparent;
		border: none;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s;
	}

	.mod-btn:hover:not(:disabled) {
		background: #F3F4F6;
	}

	.mod-btn.active {
		background: #e8f0ea;
		color: #1e3a2a;
	}

	.mod-btn.active .mod-num {
		background: #1e3a2a;
		color: white;
	}

	.mod-btn.locked {
		color: #9CA3AF;
		cursor: default;
		pointer-events: none;
	}

	.mod-btn.locked .mod-num {
		background: #F3F4F6;
		color: #9CA3AF;
	}

	/* done state — on-brand green check */
	.mod-btn.done .mod-num {
		background: #dcfce7;
		color: #15803d;
	}

	/* next state — on-brand green pulse (was blue, now matches brand) */
	.mod-btn.next {
		color: #15803d;
	}

	.mod-btn.next .mod-num {
		background: #dcfce7;
		color: #15803d;
		animation: pulse-ring 2.5s ease-in-out infinite;
	}

	@keyframes pulse-ring {
		0%, 100% { box-shadow: 0 0 0 0 rgba(21, 128, 61, 0.35); }
		50% { box-shadow: 0 0 0 4px rgba(21, 128, 61, 0); }
	}

	.mod-num {
		width: 17px;
		height: 17px;
		border-radius: 50%;
		font-size: 9px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #E5E7EB;
		color: #6B7280;
		flex-shrink: 0;
	}

	.mod-label {
		font-size: 11px;
	}

	.mod-lock {
		font-size: 9px;
		margin-left: 2px;
		opacity: 0.6;
	}

	.mod-sep {
		width: 1px;
		height: 18px;
		background: #E5E7EB;
		margin: 0 8px;
	}

	.tb-btn {
		font-size: 11px;
		padding: 4px 12px;
		border-radius: 6px;
		text-decoration: none;
		border: 1px solid #E5E7EB;
		color: #374151;
		background: white;
		cursor: pointer;
		white-space: nowrap;
	}

	.tb-btn.pri {
		background: #1e3a2a;
		color: white;
		border-color: #1e3a2a;
	}

	.tb-btn.pri:hover {
		background: #152e21;
	}

	.tb-btn.sec {
		font-size: 14px;
		padding: 3px 8px;
	}
	.tb-btn.sec:hover {
		background: #f3f4f6;
	}

	/* UX-G: User avatar group */
	.tb-user {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		padding: 3px 4px;
		border-radius: 6px;
		margin-left: 4px;
	}
	.tb-user:hover { background: rgba(0,0,0,0.05); }
	.tb-firstname {
		font-size: 12px;
		font-weight: 600;
		color: #374151;
	}
	.tb-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #1e3a2a;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 800;
		flex-shrink: 0;
	}

	/* Short labels: hidden on desktop, shown on mobile instead of hiding all labels */
	.mod-label-short { display: none; font-size: 9px; }

	@media (max-width: 768px) {
		.topbar {
			padding: 0 12px;
			gap: 8px;
		}
		.addr {
			max-width: 100px;
		}
		.mod-label {
			display: none;
		}
		.mod-label-short {
			display: block;
		}
		.mod-btn {
			padding: 4px 6px;
		}
	}

</style>
