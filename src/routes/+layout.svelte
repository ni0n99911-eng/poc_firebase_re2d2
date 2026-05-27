<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { loadLaunchPadData } from '$lib/launchpad-store';
	import { restoreSession } from '$lib/session-autosave';
	import { initStateBridge } from '$lib/state-bridge';
	import PWAInstallPrompt from '$lib/components/PWAInstallPrompt.svelte';
	import PWABottomNav from '$lib/components/PWABottomNav.svelte';
	import { authedFetch } from '$lib/authed-fetch';
	import '../app.css';


	let { children, data } = $props();

	// Public paths that should NOT render inside the app shell (sidebar/header),
	// even when the user is authenticated. These pages have their own nav.
	const PUBLIC_SHELL_PATHS = ['/', '/login', '/pricing', '/about', '/methodology', '/contact', '/pending', '/sign-in', '/privacy', '/terms', '/demo'];
	let isPublicPage = $derived(PUBLIC_SHELL_PATHS.some(p => $page.url.pathname === p));

	// Onboarding paths get full-screen immersive treatment  -  no sidebar, no header
	// Also applies to welcome-back and the post-login router
	let isOnboarding = $derived(
		$page.url.pathname.startsWith('/app/onboarding') ||
		$page.url.pathname.startsWith('/app/welcome-back') ||
		$page.url.pathname.startsWith('/app/route')
	);

	// All non-onboarding app pages get the minimal top bar + dashboard drawer
	// instead of the sidebar shell — provides consistent navigation across the app
	let isResults = $derived(
		$page.url.pathname.startsWith('/app/') && !isOnboarding
	);

	let showSignOutMenu = $state(false);
	let showSaveModal = $state(false);
	let syncStatus = $state<'idle' | 'saving' | 'saved'>('idle');
	// Theme B: health check banner — amber if any backend dependency is down
	let healthBanner = $state<{ show: boolean; failing: string }>({ show: false, failing: '' });
	let syncTimer: ReturnType<typeof setTimeout> | null = null;

	// Listen for brain thread's re2:synced event to update the indicator
	$effect(() => {
		if (typeof window === 'undefined') return;
		function onSynced() {
			syncStatus = 'saved';
			if (syncTimer) clearTimeout(syncTimer);
			syncTimer = setTimeout(() => { syncStatus = 'idle'; }, 3000);
		}
		function onSyncing() { syncStatus = 'saving'; }
		window.addEventListener('re2:synced', onSynced);
		window.addEventListener('re2:syncing', onSyncing);
		return () => {
			window.removeEventListener('re2:synced', onSynced);
			window.removeEventListener('re2:syncing', onSyncing);
		};
	});
	let showMobileSidebar = $state(false);
	let dateStr = $state('');
	let hasLocationIQ = $state(false);
	let hasVisitedFinancials = $state(false);
	let hasVisitedChecklist = $state(false);
	let hasVisitedModel = $state(false);
	// NAV-FIX: last analyzed address — used to build Location IQ href so clicking nav
	// shows the scored result instead of the blank "Should you sign this lease?" landing state
	let lastAnalyzedAddress = $state('');

	// FIX-005: URL-param fitComplete unlock — uniform for all concepts
	let urlFitComplete = $derived($page.url.searchParams.get('fitComplete') === 'true');

	// Dynamic Location IQ href: uses current URL addr param if on location page, else
	// falls back to last cached address from re2_session, else plain /app/location
	let locationIQHref = $derived((() => {
		const urlAddr = $page.url.searchParams.get('addr');
		const addr = urlAddr || lastAnalyzedAddress;
		return addr ? `/app/location?addr=${encodeURIComponent(addr)}` : '/app/location';
	})());

	// GATE-2: reads re2_session and updates hasLocationIQ + bizType — called on mount, storage, and custom event
	function onSessionUpdate() {
		if (typeof window === 'undefined') return;
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			// FIX-005: unlock if locationIQ > 0 OR session.fitComplete OR URL fitComplete param
			hasLocationIQ = (sess.locationIQ || 0) > 0 || sess.fitComplete === true || urlFitComplete;
			// NAV-FIX: keep last analyzed address fresh so Location IQ nav link stays live
			if (sess.analyzedAddress) lastAnalyzedAddress = sess.analyzedAddress;
		} catch {}
		loadSessionBizType();
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		try {
			// FIX-005: Scenarios unlocks when financials visited OR when URL fitComplete is present
			hasVisitedFinancials = localStorage.getItem('re2_financials_visited') === 'true' || urlFitComplete;
			hasVisitedChecklist = localStorage.getItem('re2_checklist_visited') === 'true';
			hasVisitedModel = localStorage.getItem('re2_model_visited') === 'true';
		} catch {}
		onSessionUpdate(); // initial read
		// FIX-03: React to session changes from OTHER tabs (storage event is cross-tab only)
		const onStorage = (e: StorageEvent) => {
			if (e.key === 're2_session') onSessionUpdate();
		};
		// GATE-2: React to same-tab session writes via custom event
		window.addEventListener('storage', onStorage);
		window.addEventListener('re2:session-updated', onSessionUpdate);
		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener('re2:session-updated', onSessionUpdate);
		};
	});
	// Map raw persona keys and "Other" to friendly display names
	function friendlyBusinessType(raw: string): string {
		if (!raw || raw === 'Other') {
			// Try to get from session persona
			try {
				const sessionStr = typeof window !== 'undefined' ? localStorage.getItem('re2_session') : null;
				if (sessionStr) {
					const session = JSON.parse(sessionStr);
					const pt = session.personaType || session.personaKey || '';
					if (pt && pt !== 'Other') {
						const map: Record<string, string> = {
							'coffee_shop': 'Specialty Coffee / Café', 'coffee': 'Specialty Coffee / Café',
							'restaurant': 'Restaurant', 'gym': 'Fitness / Wellness Studio',
							'fitness': 'Fitness / Wellness Studio', 'dentist': 'Professional Services',
							'spa': 'Barbershop / Salon', 'bodega': 'Grocery / Market',
							'bakery': 'Bakery / Café', 'barber': 'Barbershop / Salon',
							'boutique': 'Retail Store', 'florist': 'Retail Store',
							'Specialty Coffee/Café': 'Specialty Coffee / Café',
							'Restaurant (Fast Casual)': 'Restaurant (Fast Casual)',
							'Restaurant (Full Service)': 'Restaurant (Full Service)',
							'Fitness / Wellness': 'Fitness / Wellness Studio',
							'Salon / Barbershop': 'Barbershop / Salon',
							'Professional Services': 'Professional Services',
							'Grocery / Market': 'Grocery / Market',
							'Retail': 'Retail Store',
						};
						return map[pt] || pt;
					}
				}
			} catch {}
			// If still "Other" or empty, try re2_persona localStorage
			try {
				const personaStr = typeof window !== 'undefined' ? localStorage.getItem('re2_persona') : null;
				if (personaStr) {
					const persona = JSON.parse(personaStr);
					if (persona.persona_type && persona.persona_type !== 'Other') {
						return persona.persona_type;
					}
				}
			} catch {}
			return raw || '';
		}
		// Map raw persona keys to friendly display names
		const keyMap: Record<string, string> = {
			// FIX-03: Add normalized bizType keys (used in re2_session.visionBizType)
			'specialty_coffee': 'Coffee / Café', 'bakery': 'Bakery / Café',
			'fast_casual': 'Fast Casual', 'full_service_restaurant': 'Restaurant',
			'qsr': 'Quick Service', 'bar_nightlife': 'Bar / Lounge',
			'fitness_studio': 'Fitness / Wellness', 'personal_services': 'Personal Services',
			'medical_office': 'Medical / Dental', 'florist': 'Florist',
			'juice_bar': 'Juice Bar', 'wellness_beverage': 'Wellness Beverage',
			// Legacy launchpad keys
			'coffee_shop': 'Coffee / Café', 'coffee': 'Coffee / Café',
			'restaurant': 'Restaurant', 'gym': 'Fitness / Wellness',
			'fitness': 'Fitness / Wellness', 'dentist': 'Professional Services',
			'spa': 'Spa / Wellness', 'spa_wellness': 'Spa / Wellness',
			'bodega': 'Grocery / Market', 'bakery': 'Bakery / Café',
			'barber': 'Barbershop / Salon', 'barbershop': 'Barbershop / Salon',
			'boutique': 'Retail', 'florist': 'Florist',
			'retail': 'Retail', 'bar': 'Bar / Lounge',
			'medical_dental': 'Dental / Medical',
			'something_else': 'Custom Concept',
		};
		// For custom concepts, show the user's typed name (stored in businessName)
		if (raw === 'something_else') {
			const bn = lpData?.businessName;
			if (bn && bn !== 'Other') return bn;
			return 'Custom Concept';
		}
		return keyMap[raw] || raw;
	}

	let lpData = $state(loadLaunchPadData());
	let sessionBizType = $state('');

	function loadSessionBizType() {
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			sessionBizType = sess.visionBizType || sess.bizType || '';
		} catch {}
	}

	// Re-read localStorage on every client-side navigation so the concept pill
	// stays current after the onboarding bot saves new data.
	afterNavigate(() => {
		lpData = loadLaunchPadData();
		loadSessionBizType();
		// NAV-01: Re-read gate states on every client-side navigation (including
		// browser back/forward). Without this, hasLocationIQ / hasVisitedFinancials /
		// hasVisitedChecklist can go stale and the module-nav shows wrong locked states.
		onSessionUpdate();
	});

	// ââ Clerk Session Keepalive ââ
	// Load Clerk's frontend SDK on all /app/* pages so it can refresh the
	// __session JWT cookie automatically. Without this, the short-lived JWT
	// expires after ~60s and all API calls return 401.
	let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

	function initClerkSession() {
		const path = window.location.pathname;
		if (!path.startsWith('/app') && !path.startsWith('/admin')) return;
		if (window.Clerk) {
			// Already loaded  -  just start the keepalive
			startSessionKeepalive();
			return;
		}

		const key = data.clerkPublishableKey;
		if (!key) return;

		const isDevKey = key.startsWith('pk_test_');
		const scriptUrl = isDevKey
			? 'https://related-cattle-47.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js'
			: 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';

		const script = document.createElement('script');
		script.src = scriptUrl;
		script.async = true;
		script.setAttribute('data-clerk-publishable-key', key);
		script.crossOrigin = 'anonymous';
		script.onload = async () => {
			try {
				if (window.Clerk) {
					await window.Clerk.load({ publishableKey: key });
					// BUG-FIX (2026-04-17): Set window.__clerkUserId so launchpad-store.ts
					// can query founder_sessions by user_id instead of falling back to
					// anonymous session_id. Without this, every read used session_id,
					// causing .single() 406 errors when no anonymous row existed.
					if (window.Clerk.user?.id) {
						(window as any).__clerkUserId = window.Clerk.user.id;
					}
					// Start periodic token refresh to keep session alive
					startSessionKeepalive();
				}
			} catch (err) {
				console.error('[Clerk] Failed to init session keepalive:', err);
			}
		};
		document.head.appendChild(script);
	}

	/**
	 * Proactively refresh the Clerk session every 50 seconds.
	 * Clerk JWTs expire after ~60s  -  by refreshing at 50s we ensure
	 * the cookie is always fresh, even if the user sits idle.
	 *
	 * BR-E (April 11, 2026): Each tick now does TWO things in parallel:
	 *   1. session.reload()    — refreshes Clerk session + user metadata
	 *                            (catches role/permission changes while tab
	 *                            is open, not just JWT rotation).
	 *   2. getToken(skipCache) — forces a fresh JWT on the next authedFetch.
	 *
	 * Both fail silently — the banner + health check catch the catastrophic
	 * case, and a single missed refresh just results in a 401 → retry.
	 */
	function startSessionKeepalive() {
		if (keepaliveInterval) return; // already running
		keepaliveInterval = setInterval(async () => {
			const session = window.Clerk?.session;
			if (!session) return;
			// Run in parallel — reload() refreshes metadata, getToken() forces a
			// new JWT. Wrapped in Promise.allSettled so one failure doesn't
			// cancel the other.
			await Promise.allSettled([
				(async () => {
					try { await session.reload(); }
					catch (err) { console.warn('[Clerk] session.reload failed:', err); }
				})(),
				(async () => {
					try { await session.getToken({ skipCache: true }); }
					catch (err) { console.warn('[Clerk] getToken refresh failed:', err); }
				})(),
			]);
		}, 50_000); // 50 seconds  -  well before 60s expiry
	}

	onDestroy(() => {
		if (keepaliveInterval) {
			clearInterval(keepaliveInterval);
			keepaliveInterval = null;
		}
	});

	onMount(() => {
		lpData = loadLaunchPadData();
		const now = new Date();
		const dayName = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
		const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
		const date = now.getDate();
		const year = now.getFullYear();
		dateStr = `${dayName}, ${month} ${date}, ${year}`;

		// Initialize cross-tab state synchronization bridge
		initStateBridge();

		// Re-read session/launchpad when another tab mutates state
		window.addEventListener('re2:state-changed', () => {
			lpData = loadLaunchPadData();
			onSessionUpdate();
		});

		// Start Clerk session keepalive for authenticated pages
		initClerkSession();

		// Theme B: backend health check — surface amber banner if any dep is down
		// Only runs on app pages, once per session
		if (window.location.pathname.startsWith('/app') && !sessionStorage.getItem('re2_health_ok')) {
			setTimeout(async () => {
				try {
					const res = await authedFetch('/api/health', { timeout: 8000 });
					if (res.ok) {
						const data = await res.json();
						if (data.ok) {
							sessionStorage.setItem('re2_health_ok', 'true');
						} else {
							const failing = Object.entries(data.checks || {})
								.filter(([, v]) => !(v as Record<string, unknown>).ok)
								.map(([k]) => k)
								.join(', ');
							healthBanner = { show: true, failing };
						}
					}
				} catch {
					// Health check itself failed — don't block the app
				}
			}, 2000); // delay 2s so it doesn't compete with page load
		}

		// SESSION RESTORE: if user is authenticated and localStorage is empty,
		// pull their last session from Supabase (device-switch / cleared browser).
		// Only runs when data.user exists — no-op for logged-out visitors.
		if (data.user) {
			restoreSession().then(restored => {
				if (restored) {
					// Re-read launchpad so the nav reflects restored data
					lpData = loadLaunchPadData();
				}
			});
		}
	});

	async function doSignOut() {
		try {
			if (window.Clerk) {
				await window.Clerk.signOut();
				window.location.href = '/login';
			}
		} catch (err) {
			console.error('Sign out error:', err);
			window.location.href = '/login';
		}
	}

	function handleSignOut() {
		showSignOutMenu = false;
		if (hasLocationIQ) {
			showSaveModal = true;
		} else {
			doSignOut();
		}
	}

	async function saveAndSignOut() {
		showSaveModal = false;
		syncStatus = 'saving';
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');
			await Promise.race([
				fetch('/api/session-sync', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ session: sess, launchpad: lp })
				}),
				new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
			]);
		} catch { /* non-blocking — sign out regardless */ }
		doSignOut();
	}

	// Streamlined navigation: Vision â Reality Check â Path Forward â Loan â Operations
	// Maps to the 5 product modules:
	//   1. Location IQ & Fit IQ (under Reality Check)
	//   2. Dynamic Business Case (Financials under Path Forward)
	//   3. Scenario Modeling (Model under Path Forward)
	//   4. Loan Package (under Loan Readiness)
	//   5. Post Go-Live SOP (Operations under Operations)
	const allNavGroups = [
		{
			name: 'YOUR VISION',
			phase: 1,
			module: 'location-einstein',
			color: 'var(--accent, #4a7c5c)',
			items: [
				{ label: 'Profile', href: '/app/vision/founder', icon: '', private: true },
				{ label: 'Concept & Goals', href: '/app/vision/concept', icon: '', private: true }
			]
		},
		{
			name: 'REALITY CHECK',
			phase: 2,
			module: 'location-einstein',
			color: 'var(--danger, #FF3B30)',
			items: [
				{ label: 'Score', href: '/app/location', icon: '', private: true },
				{ label: 'Recommendations', href: '/app/recommendations', icon: '', private: true },
				{ label: 'Space IQ', href: '/app/space', icon: '', private: true }
			]
		},
		{
			name: 'PATH FORWARD',
			phase: 3,
			module: 'location-einstein',
			color: 'var(--warning, #FF9500)',
			items: [
				{ label: 'Business Case', href: '/app/business-plan', icon: '', private: true }
			]
		},
		{
			name: 'LAUNCH',
			phase: 4,
			module: 'location-einstein',
			color: '#1B3A5C',
			items: [
				{ label: 'Launch Checklist', href: '/app/checklist', icon: '', private: true }
			]
		},
		{
			name: 'LOAN READINESS',
			phase: 5,
			module: 'location-einstein',
			color: '#5856D6',
			items: [
				{ label: 'Loan Package', href: '/app/loans', icon: '', private: true }
			]
		},
		{
			name: 'OPERATIONS',
			phase: 5,
			module: 'location-einstein',
			color: 'var(--success, #10B981)',
			items: [
				{ label: 'Post Go-Live SOP', href: '/app/operations', icon: '', private: true }
			]
		}
	];

	let userModules = $derived(data.user?.modules || []);
	let isAppRoute = $derived($page.url.pathname.startsWith('/app'));
	// UX-14: module-strip active-state flags (must be $derived, not {@const} — nav is a plain element)
	let _pScore = $derived($page.url.pathname.startsWith('/app/location') || $page.url.pathname.startsWith('/app/brain'));
	let _pBC = $derived($page.url.pathname.startsWith('/app/business-plan'));
	let _pDash = $derived($page.url.pathname.startsWith('/app/dashboard'));
	let _pChk = $derived($page.url.pathname.startsWith('/app/checklist'));
	// UX-10: Journey progress % — counts completed gates (0→25→50→75→100)
	let journeyPct = $derived(
		(hasLocationIQ ? 25 : 0) + (hasVisitedFinancials ? 25 : 0) + (hasVisitedChecklist ? 25 : 0) + (_pChk ? 25 : 0)
	);
	// When user is undefined (JWT refreshing) but we're on an /app route,
	// show all nav groups rather than hiding everything.
	let navGroups = $derived(allNavGroups.filter(group => {
		if (group.module === null) return true;
		if (!data.user && isAppRoute) return true; // show all during auth refresh
		return userModules.includes(group.module);
	}));

	function isActive(href: string): boolean {
		if (href === '/') {
			return $page.url.pathname === '/';
		}
		return $page.url.pathname.startsWith(href);
	}

	function getGroupColor(groupName: string): string {
		const group = navGroups.find(g => g.name === groupName);
		return group?.color || 'transparent';
	}

	// Progress indicators based on launchpad data
	function getGroupProgress(groupName: string): { completed: number; total: number; status: 'none' | 'partial' | 'complete' } {
		const fp = lpData?.founderProfile;
		const fg = lpData?.financialGoals;
		const hasFounder = fp?.motivation && fp?.ownerType && fp?.riskTolerance && fp?.experience;
		const hasConcept = lpData?.businessType && lpData?.businessName;
		const hasFinancial = fg?.revenueY1 > 0 && fg?.squareFootage > 0;
		const hasSaved = lpData?.lastSaved > 0;

		switch (groupName) {
			case 'YOUR VISION': {
				const done = [hasFounder, hasConcept && hasFinancial].filter(Boolean).length;
				return { completed: done, total: 2, status: done === 0 ? 'none' : done === 2 ? 'complete' : 'partial' };
			}
			case 'REALITY CHECK':
				return hasSaved && hasFounder ? { completed: 1, total: 2, status: 'partial' } : { completed: 0, total: 2, status: 'none' };
			case 'PATH FORWARD':
				return hasSaved && hasFinancial ? { completed: 1, total: 3, status: 'partial' } : { completed: 0, total: 3, status: 'none' };
			default:
				return { completed: 0, total: 0, status: 'none' };
		}
	}

	function closeMobileSidebar() {
		showMobileSidebar = false;
	}

	function handleSidebarBackdropClick() {
		closeMobileSidebar();
	}

	function getPageLabel(): string {
		const path = $page.url.pathname;
		const group = navGroups.find(g => g.items.some(item => item.href === path || (path.startsWith(item.href) && item.href !== '/')));
		if (group) {
			const item = group.items.find(i => i.href === path || (path.startsWith(i.href) && i.href !== '/'));
			if (item) {
				return item.label;
			}
		}
		return '';
	}
</script>

<svelte:head>
	<!-- Playfair Display: logo/headings. Inter: score numbers + UI (ISS-08 font consistency) -->
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
</svelte:head>

<!-- Theme B: amber banner when backend dependency is down -->
{#if healthBanner.show}
<div class="health-banner" role="alert">
	⚠ Some features are temporarily limited ({healthBanner.failing}).
	<button class="health-banner-close" onclick={() => healthBanner = { show: false, failing: '' }} aria-label="Dismiss">✕</button>
</div>
{/if}

{#if isOnboarding}
<!-- Onboarding: full-screen immersive -->
<div class="onboarding-shell">
	{@render children()}
</div>
{:else if isResults}
<!-- Results: minimal top bar, no sidebar -->
<div class="results-shell">
	<header class="results-topbar">
		<div class="topbar-left">
			<a href="/app/dashboard" class="results-logo">RE²</a>
		</div>
		<div class="topbar-right">
			<!-- UX-16: Shrunk to an icon button with label so the primary CTA on every page isn't "abandon this analysis". -->
			<a href="/app/onboarding?fresh=true" class="results-new-btn results-new-btn-icon" title="Start a new analysis" aria-label="Start a new analysis">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				<span class="results-new-btn-label">New</span>
			</a>
		</div>
	</header>
	<div class="module-strip">
		<nav class="module-nav">
			<!-- UX-14: done = step complete but not current (green check). current = active page (pulsing dot). -->
			<a href={locationIQHref} class="mod-btn" class:active={_pScore} class:done={hasLocationIQ && !_pScore} class:current={_pScore}>
				<span class="mod-num">{#if hasLocationIQ && !_pScore}✓{:else}1{/if}</span>
				<span class="mod-label">Score</span>
				{#if _pScore}<span class="mod-pulse" aria-hidden="true"></span>{/if}
			</a>
			<span class="mod-arrow" class:done={hasLocationIQ}>›</span>
			{#if hasLocationIQ}
				<a href="/app/business-plan" class="mod-btn" class:active={_pBC} class:done={hasVisitedFinancials && !_pBC} class:current={_pBC}>
					<span class="mod-num">{#if hasVisitedFinancials && !_pBC}✓{:else}2{/if}</span>
					<span class="mod-label">Business Case</span>
					{#if _pBC}<span class="mod-pulse" aria-hidden="true"></span>{/if}
				</a>
			{:else}
				<span class="mod-btn locked">
					<span class="mod-num">2</span>
					<span class="mod-label">Business Case</span>
					<span class="mod-lock"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
				</span>
			{/if}
			<span class="mod-arrow" class:done={hasVisitedFinancials}>›</span>
			{#if hasVisitedFinancials}
				<a href="/app/dashboard" class="mod-btn" class:active={_pDash} class:done={hasVisitedChecklist && !_pDash} class:current={_pDash}>
					<span class="mod-num">{#if hasVisitedChecklist && !_pDash}✓{:else}3{/if}</span>
					<span class="mod-label">Dashboard</span>
					{#if _pDash}<span class="mod-pulse" aria-hidden="true"></span>{/if}
				</a>
			{:else}
				<span class="mod-btn locked">
					<span class="mod-num">3</span>
					<span class="mod-label">Dashboard</span>
					<span class="mod-lock"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
				</span>
			{/if}
			<span class="mod-arrow" class:done={hasVisitedChecklist}>›</span>
			{#if hasVisitedFinancials}
				<a href="/app/checklist" class="mod-btn" class:active={_pChk} class:current={_pChk}>
					<span class="mod-num">4</span>
					<span class="mod-label">Checklist</span>
					{#if _pChk}<span class="mod-pulse" aria-hidden="true"></span>{/if}
				</a>
			{:else}
				<span class="mod-btn locked">
					<span class="mod-num">4</span>
					<span class="mod-label">Checklist</span>
					<span class="mod-lock"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
				</span>
			{/if}
			<div class="mod-sep"></div>
			<!-- R-11: COMING SOON pills hidden for tester build — re-enable when features ship -->
			<!-- <div class="cs-pill cs-pill-soon" title="Coming soon">Business Plan <span class="cs-tag cs-tag-soon">COMING SOON</span></div> -->
			<!-- <div class="cs-pill cs-pill-soon" title="Coming soon">Loan Package <span class="cs-tag cs-tag-soon">COMING SOON</span></div> -->
		</nav>
		<!-- UX-10: Journey progress bar — thin fill under the module-nav -->
		{#if journeyPct > 0 && journeyPct < 100}
		<div class="journey-bar">
			<div class="journey-fill" style="width:{journeyPct}%"></div>
		</div>
		{/if}
	</div>
	<!-- Dashboard Sidebar Overlay (triggered by Dashboard FAB) -->
	{#if showMobileSidebar}
		<div class="sidebar-backdrop" onclick={handleSidebarBackdropClick}></div>
		<nav class="dashboard-drawer">
			<div class="drawer-header">
				<span class="drawer-title">Dashboard</span>
				<button class="drawer-close" onclick={closeMobileSidebar}>✕</button>
			</div>
			{#each navGroups as group (group.name)}
				<div class="drawer-group">
					<div class="drawer-group-name" style="color: {group.color}">{group.name}</div>
					{#each group.items as item (item.href)}
						<a href={item.href === "/app/location" ? locationIQHref : item.href} class="drawer-item" class:active={isActive(item.href)} onclick={closeMobileSidebar}>
							{item.label}
						</a>
					{/each}
				</div>
			{/each}
		</nav>
	{/if}
	<main class="results-content">
		{@render children()}
	</main>
	<PWABottomNav
		locationIQHref={locationIQHref}
		hasLocationIQ={hasLocationIQ}
		hasVisitedFinancials={hasVisitedFinancials}
		hasVisitedChecklist={hasVisitedChecklist}
		onMenuOpen={() => showMobileSidebar = true}
	/>
</div>
{:else if (data.user || $page.url.pathname.startsWith('/app')) && !isPublicPage}
<div class="app-container">
	<!-- Header -->
	<header class="header">
		<div class="header-left">
			<!-- Hamburger Menu Button (Mobile Only) -->
			<button
				class="hamburger-menu show-mobile"
				onclick={() => (showMobileSidebar = !showMobileSidebar)}
				title="Toggle sidebar"
				aria-label="Toggle sidebar menu"
			>
				<span class="hamburger-line"></span>
				<span class="hamburger-line"></span>
				<span class="hamburger-line"></span>
			</button>

			<button class="logo" onclick={() => window.location.reload()}>
				RE²
			</button>
		</div>

		<div class="header-center">
			{#if getPageLabel()}
				<div class="breadcrumb">{getPageLabel()}</div>
			{/if}
		</div>

		<div class="header-right">
			{#if syncStatus === 'saving'}
				<span class="sync-status saving">
					<span class="sync-dot"></span> Saving…
				</span>
			{:else if syncStatus === 'saved'}
				<span class="sync-status saved">
					<span class="sync-dot"></span> Saved ✓
				</span>
			{/if}
			<div class="avatar-container">
				<button
					class="avatar"
					onclick={() => (showSignOutMenu = !showSignOutMenu)}
					title="User menu"
				>
					{data.user?.initials || 'U'}
				</button>
				{#if showSignOutMenu}
					<div class="user-menu">
						<div class="user-info">
							<div class="user-name">{data.user?.name || 'User'}</div>
							<div class="user-role">{data.user?.role || 'member'}</div>
						</div>
						<div class="menu-divider"></div>
						<button class="menu-item sign-out" onclick={handleSignOut}>
							Sign Out
						</button>
					</div>
				{/if}
			</div>
		</div>

		<!-- Save-before-sign-out modal -->
		{#if showSaveModal}
		<div class="save-modal-overlay" onclick={() => showSaveModal = false}>
			<div class="save-modal" onclick={(e) => e.stopPropagation()}>
				<div class="save-modal-icon">💾</div>
				<h3 class="save-modal-title">Save your work?</h3>
				<p class="save-modal-body">Your scores and plan are stored in this browser. Save them to your account so you can pick up on any device.</p>
				<div class="save-modal-actions">
					<button class="save-modal-btn primary" onclick={saveAndSignOut}>Save & Sign Out</button>
					<button class="save-modal-btn secondary" onclick={doSignOut}>Sign out anyway</button>
				</div>
			</div>
		</div>
		{/if}
	</header>

	<!-- Main Content -->
	<div class="main-container">
		<!-- Mobile Sidebar Backdrop -->
		{#if showMobileSidebar}
			<div class="sidebar-backdrop" onclick={handleSidebarBackdropClick}></div>
		{/if}

		<!-- Sidebar -->
		<nav class="sidebar" class:mobile-open={showMobileSidebar}>
			{#each navGroups as group, groupIndex (group.name)}
				<div class="nav-group">
					<div class="group-header" style={group.color ? `color: ${group.color}` : ''}>
						{group.name}
						{#if getGroupProgress(group.name).total > 0}
							<span class="progress-badge" class:complete={getGroupProgress(group.name).status === 'complete'} class:partial={getGroupProgress(group.name).status === 'partial'}>
								{#if getGroupProgress(group.name).status !== 'none'}
									*
								{/if}
							</span>
						{/if}
					</div>
					<div class="group-items">
						{#each group.items.filter(item => !item.requiredModule || userModules.includes(item.requiredModule)) as item (item.href)}
							<a
								href={item.href}
								class="nav-item"
								class:active={isActive(item.href)}
								style={isActive(item.href) && group.color ? `--group-color: ${group.color}` : ''}
								onclick={closeMobileSidebar}
							>
								<span class="nav-label">{item.label}</span>
							</a>
						{/each}
					</div>
				</div>
				{#if groupIndex < navGroups.length - 1}
					<div class="nav-divider"></div>
				{/if}
			{/each}
		</nav>

		<!-- Main Content Area -->
		<main class="main-content">
			{@render children()}
		</main>
	</div>
</div>
{:else}
<!-- Public pages: no sidebar/header -->
<div class="public-shell">
	{@render children()}
</div>
{/if}
<PWAInstallPrompt />

<style>
	/* Public pages: transparent pass-through shell */
	.public-shell {
		display: contents;
	}

	/* Theme B: backend health amber banner */
	.health-banner {
		position: sticky;
		top: 0;
		z-index: 9999;
		background: #fef3c7;
		border-bottom: 1px solid #fde68a;
		color: #92400e;
		font-size: 12px;
		font-weight: 600;
		padding: 7px 20px;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.health-banner-close {
		margin-left: auto;
		background: none;
		border: none;
		cursor: pointer;
		color: #92400e;
		font-size: 14px;
		padding: 0 4px;
		opacity: 0.7;
	}
	.health-banner-close:hover { opacity: 1; }

	/* Onboarding: full-screen immersive shell */
	.onboarding-shell {
		min-height: 100vh;
		background: var(--bg);
		color: var(--text);
	}

	/* Results: minimal top bar shell */
	.results-shell {
		min-height: calc(100vh - 100px);
		background: var(--bg);
		color: var(--text);
	}

	.results-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 32px;
		height: 56px;
		background: rgba(250, 247, 242, 0.96);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--border-subtle, #E8E2D8);
		position: sticky;
		top: 0;
		z-index: 200;
	}

	.topbar-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.topbar-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.module-strip {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 0 32px;
		height: 44px;
		background: #fff;
		border-bottom: 1px solid var(--border, #E8E2D8);
		position: sticky;
		top: 56px;
		z-index: 190;
		/* UX-10: sticky already creates a containing block for the absolute journey bar */
	}

	.ms-label {
		font-size: 10px;
		font-weight: 700;
		color: var(--text-muted, #9CA3AF);
		text-transform: uppercase;
		letter-spacing: 0.7px;
		white-space: nowrap;
		flex-shrink: 0;
		margin-right: 4px;
	}


	.results-logo {
		font-family: 'Playfair Display', serif;
		font-weight: 700;
		font-size: 17px;
		color: var(--text);
		text-decoration: none;
		letter-spacing: -0.5px;
	}



	.results-new-btn {
		padding: 6px 16px;
		background: var(--primary);
		color: white;
		border-radius: 20px;
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.results-new-btn:hover {
		background: #243f30;
		box-shadow: 0 2px 8px rgba(26, 58, 42, 0.25);
	}

	/* UX-16: minimized New-analysis button (icon + small label) */
	.results-new-btn-icon {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 11px 5px 9px;
		background: transparent;
		color: var(--text-muted, #6B7280);
		border: 1px solid var(--border, #E5E7EB);
		font-size: 12px;
	}
	.results-new-btn-icon:hover {
		background: rgba(26, 58, 42, 0.06);
		color: var(--primary, #1a3a2a);
		border-color: rgba(26, 58, 42, 0.25);
		box-shadow: none;
	}
	.results-new-btn-label { line-height: 1; }
	@media (max-width: 560px) {
		.results-new-btn-label { display: none; }
		.results-new-btn-icon { padding: 6px 8px; }
	}


	/* Module navigation — top right linear flow */
	.module-nav {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.mod-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 12px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted, #6B7280);
		background: transparent;
		border: 1px solid transparent;
		text-decoration: none;
		transition: all 0.15s;
		white-space: nowrap;
		cursor: pointer;
	}
	.mod-btn:hover:not(.locked) {
		color: var(--primary, #1a3a2a);
		background: rgba(26,58,42,0.06);
		border-color: rgba(26,58,42,0.15);
	}
	.mod-btn.active {
		color: var(--primary, #1a3a2a);
		background: rgba(74, 124, 92, 0.1);
		border-color: rgba(74, 124, 92, 0.25);
	}
	.mod-btn.locked { color: var(--locked, #D1D5DB); cursor: default; pointer-events: none; }
	.mod-lock { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; margin-left: 3px; opacity: 0.7; }
	.mod-lock svg { color: var(--locked, #D1D5DB); }
	.mod-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #6B7280;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
		flex-shrink: 0;
	}
	.mod-btn.active .mod-num, .mod-btn:hover:not(.locked) .mod-num {
		background: var(--primary, #1a3a2a);
	}
	.mod-btn.locked .mod-num { background: var(--locked, #D1D5DB); color: #fff; }
	/* UX-14: completion states — green check on done, pulsing dot on current */
	.mod-btn.done { color: #065f46; }
	.mod-btn.done .mod-num {
		background: #10b981;
		color: #fff;
		font-size: 11px;
	}
	.mod-btn.current { position: relative; }
	.mod-pulse {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #10b981;
		margin-left: 3px;
		flex-shrink: 0;
		box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6);
		animation: mod-pulse-anim 1.8s ease-in-out infinite;
	}
	@keyframes mod-pulse-anim {
		0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
		50%      { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
	}
	@media (prefers-reduced-motion: reduce) {
		.mod-pulse { animation: none; }
	}
	.mod-arrow {
		color: var(--text-muted, #CBD5E1);
		font-size: 14px;
		line-height: 1;
		transition: color 0.2s;
	}
	/* UX-09: arrow turns green when preceding step is complete */
	.mod-arrow.done { color: #10b981; }
	/* UX-10: Journey progress bar */
	.journey-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: rgba(0, 0, 0, 0.06);
	}
	.journey-fill {
		height: 100%;
		background: #10b981;
		border-radius: 0 1px 1px 0;
		transition: width 0.4s ease;
	}
	.mod-divider {
		color: var(--border, #E5E7EB);
		font-size: 14px;
		margin: 0 4px;
	}
	.mod-coming-soon {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		font-weight: 500;
		color: var(--text-muted, #9CA3AF);
		padding: 3px 8px;
		border-radius: 20px;
		border: 1px dashed #D1D5DB;
		background: transparent;
		white-space: nowrap;
		cursor: default;
		user-select: none;
	}
	.cs-badge {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #fff;
		background: #9CA3AF;
		border-radius: 4px;
		padding: 1px 4px;
	}
	.mod-sep {
		width: 1px;
		height: 20px;
		background: var(--border, #E5E7EB);
		margin: 0 8px;
		flex-shrink: 0;
	}
	.cs-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		font-weight: 500;
		color: var(--text-muted, #9CA3AF);
		padding: 4px 10px;
		border-radius: 20px;
		border: 1px dashed #D1D5DB;
		background: transparent;
		white-space: nowrap;
		cursor: default;
		user-select: none;
	}
	.cs-tag {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #fff;
		background: #C4B5A0;
		border-radius: 4px;
		padding: 1px 4px;
		line-height: 1.4;
	}
	.cs-tag-soon {
		background: #9CA3AF;
		letter-spacing: 0.03em;
	}

	/* Dashboard Drawer — slides in from right on results page */
	.dashboard-drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 280px;
		background: var(--surface, #fff);
		border-left: 1px solid var(--border, #E5E7EB);
		z-index: 201;
		padding: 0;
		overflow-y: auto;
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.08);
		animation: slideInRight 0.2s ease-out;
	}
	@keyframes slideInRight {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}
	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 20px 16px;
		border-bottom: 1px solid var(--border-subtle, #F0F0F0);
	}
	.drawer-title { font-size: 15px; font-weight: 700; color: var(--text, #1A1D23); }
	.drawer-close {
		background: none; border: none; font-size: 18px; cursor: pointer;
		color: var(--text-secondary, #5A6578); padding: 4px 8px; border-radius: 4px;
	}
	.drawer-close:hover { background: var(--surface-alt, #F4F6F8); }
	.drawer-group { padding: 16px 20px 8px; }
	.drawer-group-name {
		font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
		text-transform: uppercase; margin-bottom: 8px;
	}
	.drawer-item {
		display: block; padding: 8px 12px; font-size: 14px; font-weight: 500;
		color: var(--text-secondary, #5A6578); text-decoration: none;
		border-radius: 6px; transition: all 0.15s;
	}
	.drawer-item:hover { background: var(--surface-alt, #F4F6F8); color: var(--text, #1A1D23); }
	.drawer-item.active {
		background: rgba(74, 124, 92, 0.08);
		color: #4a7c5c;
		font-weight: 600;
	}

	.results-content {
		overflow-y: auto;
	}

	/* ── PWA / Mobile nav overrides ── */
	/* On mobile screens and when installed as a PWA:
	   - hide the module strip (bottom nav replaces it)
	   - pad the content so it doesn't hide behind the fixed bottom nav
	   - push topbar down for iOS status bar in standalone mode             */

	@media (max-width: 768px) {
		.module-strip {
			display: none;
		}
		.results-content {
			padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
		}
		.results-topbar {
			padding: 0 16px;
		}
	}

	@media (display-mode: standalone) {
		.module-strip {
			display: none;
		}
		.results-content {
			padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
		}
		.results-topbar {
			padding-top: env(safe-area-inset-top, 0px);
			height: calc(56px + env(safe-area-inset-top, 0px));
			top: 0;
		}
	}

	.app-container {
		display: grid;
		grid-template-rows: var(--header-h) 1fr;
		grid-template-columns: auto 1fr;
		min-height: 100vh;
		width: 100%;
		overflow-x: hidden;
		overflow-y: auto;
		--sidebar-w: 240px;
	}

	.header {
		grid-column: 1 / -1;
		grid-row: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 32px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		height: var(--header-h);
		z-index: 100;
		box-shadow: none;
		backdrop-filter: none;
	}

	.header-left {
		display: flex;
		align-items: center;
		flex: 1;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0;
		font-weight: 600;
		font-size: 18px;
		letter-spacing: 0;
		transition: all 0.2s ease;
		padding: 4px 8px;
		border-radius: 4px;
		text-decoration: none;
		cursor: pointer;
		border: none;
		background: none;
		color: var(--text);
	}

	.logo:hover {
		transform: none;
		background: none;
	}

	.header-center {
		display: flex;
		align-items: center;
		flex: 1;
		justify-content: center;
	}

	.breadcrumb {
		font-size: 13px;
		color: var(--text-secondary);
		letter-spacing: 0;
		font-weight: 500;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 20px;
		flex: 1;
		justify-content: flex-end;
	}

	.avatar-container {
		position: relative;
	}

	.avatar {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--surface-alt);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 600;
		color: var(--text);
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
	}

	.avatar:hover {
		border: none;
		box-shadow: none;
		transform: none;
		background: var(--surface-elevated);
	}

	.user-menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		min-width: 180px;
		overflow: hidden;
		animation: slideUp 0.2s ease;
		backdrop-filter: none;
	}

	.user-info {
		padding: 12px 16px;
	}

	.user-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 2px;
	}

	.user-role {
		font-size: 11px;
		color: var(--text-secondary);
		text-transform: capitalize;
	}

	.menu-divider {
		height: 1px;
		background: var(--border);
	}

	.menu-item {
		display: block;
		width: 100%;
		padding: 11px 16px;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: inherit;
	}

	.menu-item:hover {
		background: var(--surface-alt);
		color: var(--text);
	}

	.menu-item.sign-out {
		color: var(--primary);
	}

	.menu-item.sign-out:hover {
		background: var(--surface-alt);
	}

	.main-container {
		display: none;
		grid-template-columns: var(--sidebar-w) 1fr;
		min-height: calc(100vh - var(--header-h));
		overflow-y: auto;
		overflow-x: hidden;
		grid-column: 2;
		grid-row: 2;
	}

	/* Desktop: show sidebar as persistent column */
	@media (min-width: 1024px) {
		.main-container {
			display: grid;
			grid-template-columns: unset;
		}
	}

	.sidebar {
		background: var(--surface-alt);
		border-right: 1px solid var(--border);
		color: var(--text);
		overflow-y: auto;
		padding: 20px 0;
		display: flex;
		flex-direction: column;
		box-shadow: none;
		width: var(--sidebar-w);
		height: 100%;
	}

	/* Desktop: persistent sidebar */
	@media (min-width: 1024px) {
		.sidebar {
			position: fixed;
			left: 0;
			top: var(--header-h);
			height: calc(100vh - var(--header-h));
			width: var(--sidebar-w);
			z-index: 99;
		}
	}

	.nav-group {
		padding: 0 14px;
	}

	.nav-group:not(:last-child) {
		margin-bottom: 0;
	}

	.group-header {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		padding: 14px 16px;
		color: var(--text-tertiary);
		margin-bottom: 4px;
		display: flex;
		align-items: center;
		position: relative;
		font-family: inherit;
	}

	.progress-badge {
		margin-left: auto;
		font-size: 12px;
		padding: 0;
		border-radius: 0;
		background: none;
		color: var(--primary);
		font-weight: 600;
	}

	.progress-badge.partial {
		background: none;
		color: var(--primary);
	}

	.progress-badge.complete {
		background: none;
		color: var(--success);
	}

	.group-items {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 10px 16px;
		font-size: 14px;
		color: var(--text-secondary);
		border-radius: 4px;
		transition: all 0.2s ease;
		border-left: none;
		cursor: pointer;
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow: hidden;
		position: relative;
	}

	.nav-item:hover {
		color: var(--text);
		background: transparent;
		border-left-color: transparent;
		transform: none;
	}

	.nav-item.active {
		color: var(--primary);
		border-left-color: transparent;
		background: var(--teal-bg);
		font-weight: 600;
		box-shadow: none;
	}

	.nav-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nav-divider {
		height: 1px;
		background: var(--border);
		margin: 14px 16px;
	}

	.nav-divider-prominent {
		background: var(--border);
		margin: 14px 16px;
		opacity: 1;
	}

	.main-content {
		overflow-y: auto;
		background: var(--surface);
		grid-column: 1 / -1;
		grid-row: 1 / -1;
	}

	/* Desktop: main content respects persistent sidebar */
	@media (min-width: 1024px) {
		.main-content {
			grid-column: 1;
			grid-row: 1;
			margin-left: var(--sidebar-w);
		}
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* ===== HAMBURGER MENU ===== */
	.hamburger-menu {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 5px;
		margin-right: 12px;
		transition: all 0.2s ease;
	}

	.hamburger-menu:hover {
		transform: none;
	}

	.hamburger-line {
		width: 20px;
		height: 2px;
		background: #000000;
		border-radius: 1px;
		transition: all 0.2s ease;
	}

	.hamburger-menu:hover .hamburger-line {
		background: #4a7c5c;
	}

	/* Desktop (1024px+): hide hamburger menu and show persistent sidebar */
	@media (min-width: 1024px) {
		.hamburger-menu {
			display: none !important;
		}
	}

	/* Mobile/Tablet (< 1024px): show hamburger menu */
	@media (max-width: 1023px) {
		.hamburger-menu {
			display: flex !important;
		}
	}

	/* ===== RESPONSIVE LAYOUT ===== */

	/* Mobile/Tablet: hide sidebar by default, show as overlay */
	@media (max-width: 1023px) {
		.main-container {
			display: none;
		}

		.sidebar {
			position: fixed;
			left: 0;
			top: var(--header-h);
			height: calc(100vh - var(--header-h));
			width: 240px;
			z-index: 200;
			transform: translateX(-100%);
			transition: transform 0.2s ease;
			overflow-y: auto;
		}

		.sidebar.mobile-open {
			transform: translateX(0);
		}

		.sidebar-backdrop {
			position: fixed;
			top: var(--header-h);
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.5);
			z-index: 150;
			backdrop-filter: none;
		}

		.header {
			padding: 0 16px;
		}

		.header-left {
			gap: 8px;
		}

		.logo {
			font-size: 14px;
			gap: 0;
			padding: 4px 8px;
		}

		.header-center {
			flex: 0.5;
		}

		.avatar {
			width: 32px;
			height: 32px;
			font-size: 12px;
		}

		.group-header {
			font-size: 9px;
			padding: 10px 12px;
		}

		.nav-item {
			font-size: 12px;
			padding: 8px 12px;
		}
	}

	/* Tablet: narrow sidebar option */
	@media (min-width: 768px) and (max-width: 1023px) {
		.sidebar {
			width: 240px;
		}

		.header {
			padding: 0 24px;
		}

		.logo {
			font-size: 15px;
		}

		.header-right {
			gap: 16px;
		}

		.nav-item {
			font-size: 12px;
			padding: 9px 12px;
		}
	}

	/* Desktop: full layout */
	@media (min-width: 1024px) {
		.main-container {
			grid-template-columns: var(--sidebar-w) 1fr;
		}

		.sidebar {
			position: relative;
			width: var(--sidebar-w);
			transform: none !important;
		}

		.sidebar-backdrop {
			display: none;
		}
	}

	/* Content Area Responsive */
	@media (max-width: 640px) {
		.main-content {
			padding: 12px;
		}
	}

	@media (min-width: 641px) and (max-width: 1023px) {
		.main-content {
			padding: 16px;
		}
	}

	@media (min-width: 1024px) {
		.main-content {
			padding: 20px;
		}
	}

	/* Responsive font sizes */
	@media (max-width: 480px) {
		.header {
			font-size: 12px;
		}

		.logo {
			font-size: 12px;
		}

		.nav-group {
			padding: 0 8px;
		}

		.group-items {
			gap: 1px;
		}

		.nav-divider {
			margin: 8px 8px;
		}
	}

	/* Sync status indicator */
	.sync-status {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		font-weight: 500;
		padding: 3px 8px;
		border-radius: 10px;
		margin-right: 8px;
	}
	.sync-status.saving { color: #6B7280; background: #F3F4F6; }
	.sync-status.saved { color: #059669; background: #ECFDF5; }
	.sync-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
		display: inline-block;
	}
	.sync-status.saving .sync-dot {
		animation: pulse 1s ease-in-out infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	/* Save-before-sign-out modal */
	.save-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.4);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.save-modal {
		background: #fff;
		border-radius: 16px;
		padding: 28px 28px 24px;
		max-width: 360px;
		width: calc(100% - 32px);
		text-align: center;
		box-shadow: 0 20px 60px rgba(0,0,0,0.18);
	}
	.save-modal-icon { font-size: 32px; margin-bottom: 12px; }
	.save-modal-title { font-size: 17px; font-weight: 700; color: #1d1d1f; margin: 0 0 8px; }
	.save-modal-body { font-size: 13px; color: #6B7280; line-height: 1.5; margin: 0 0 20px; }
	.save-modal-actions { display: flex; flex-direction: column; gap: 8px; }
	.save-modal-btn {
		width: 100%;
		padding: 11px 16px;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		border: none;
		transition: all 0.15s;
	}
	.save-modal-btn.primary { background: #1d1d1f; color: #fff; }
	.save-modal-btn.primary:hover { background: #374151; }
	.save-modal-btn.secondary { background: #F3F4F6; color: #6B7280; }
	.save-modal-btn.secondary:hover { background: #E5E7EB; color: #374151; }
</style>
