<script lang="ts">
	import { page } from '$app/stores';
	import { getScoreColor as _getScoreColor, getScoreGrade, getVerdictClass } from '$lib/constants/scoreUtils';

	const data = $derived($page.data as {
		recap: {
			personaType: string | null;
			personaKey: string | null;
			conceptDescription: string | null;
			conceptName: string | null;
			targetCustomers: string[];
			differentiators: string[];
			financialEstimates: {
				avgTicket?: number;
				dailyCustomers?: number;
				monthlyRevenue?: [number, number];
				maxRent?: number;
				idealSqft?: [number, number];
				maxHealthyRent?: number;
			} | null;
			lastAddress: string | null;
			lastScore: number | null;
			lastVerdict: string | null;
			hasComparisonLocations: boolean;
			conversationPhase: string | null;
			updatedAt: string;
			createdAt: string;
		};
		userName: string;
	});

	let showUserMenu = $state(false);
	let showDetails = $state(false);
	let showNewConceptConfirm = $state(false);
	let isSigningOut = $state(false);
	let isStartingNew = $state(false);

	function formatDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString('en-US', {
				month: 'short', day: 'numeric', year: 'numeric'
			});
		} catch { return ''; }
	}

	function formatCurrency(n: number): string {
		if (!n || !isFinite(n)) return '--';
		if (n >= 1000) return `$${Math.round(n / 1000)}K`;
		return `$${n}`;
	}

	function getInitials(name: string): string {
		return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
	}

	function getPersonaEmoji(pt: string | null): string {
		const map: Record<string, string> = {
			'coffee_shop': '☕', 'coffee': '☕', 'Specialty Coffee/Café': '☕',
			'restaurant': '🍽️', 'Restaurant (Fast Casual)': '🍽️', 'Restaurant (Full Service)': '🍽️',
			'gym': '💪', 'fitness': '💪', 'Fitness / Wellness': '💪',
			'dentist': '🦷', 'spa': '💆', 'bodega': '🏪', 'bakery': '🥐',
			'barber': '💈', 'boutique': '👗', 'florist': '💐',
		};
		return map[pt || ''] || '✨';
	}

	function getPersonaLabel(pt: string | null): string {
		// For custom concepts, try to get the user's typed name from launchpad
		if (pt === 'something_else') {
			try {
				const raw = typeof window !== 'undefined' ? localStorage.getItem('re2_launchpad') : null;
				if (raw) {
					const lp = JSON.parse(raw);
					if (lp.businessName && lp.businessName !== 'Other') return lp.businessName;
				}
			} catch {}
			return 'Your Business';
		}
		const map: Record<string, string> = {
			// Canonical keys (written by writeCanonicalConcept / server load)
			'specialty_coffee': 'Coffee / Café',       'bakery': 'Bakery / Café',
			'fast_casual': 'Fast Casual',               'full_service_restaurant': 'Full-Service Restaurant',
			'qsr': 'Quick Service',                     'bar_nightlife': 'Bar / Lounge',
			'juice_bar': 'Juice Bar',                   'wellness_beverage': 'Wellness Beverage',
			'fitness_studio': 'Fitness / Wellness',     'personal_services': 'Personal Services',
			'medical_office': 'Dental / Medical',       'wellness_spa': 'Spa / Wellness',
			'florist': 'Florist',                       'coworking': 'Coworking',
			// Legacy / onboarding keys
			'coffee_shop': 'Coffee / Café',             'coffee': 'Coffee / Café',
			'Specialty Coffee/Café': 'Coffee / Café',   'restaurant': 'Restaurant',
			'Restaurant (Fast Casual)': 'Fast Casual',  'Restaurant (Full Service)': 'Full Service',
			'gym': 'Fitness Studio',                    'fitness': 'Fitness Studio',
			'Fitness / Wellness': 'Fitness Studio',     'dentist': 'Dental Practice',
			'spa': 'Spa / Wellness',                    'spa_wellness': 'Spa / Wellness',
			'bodega': 'Grocery / Market',               'barber': 'Barbershop',
			'barbershop': 'Barbershop / Salon',         'boutique': 'Retail Boutique',
			'retail': 'Retail',                         'bar': 'Bar / Lounge',
			'medical_dental': 'Dental / Medical',       'Other': 'Your Business',
		};
		return map[pt || ''] || pt || 'Your Business';
	}

	async function handleSignOut() {
		if (isSigningOut) return;
		isSigningOut = true;
		try {
			if (window.Clerk) {
				await window.Clerk.signOut();
			}
			window.location.href = '/login';
		} catch {
			window.location.href = '/login';
		}
	}

	function handleEscapeKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (showNewConceptConfirm) showNewConceptConfirm = false;
			if (showUserMenu) showUserMenu = false;
		}
	}

	const hasScored = $derived(!!(data.recap.lastAddress && data.recap.lastScore));
	const firstName = $derived(data.userName.split(' ')[0] || 'there');

	// UX-A: client-side session data for sub-score chips + neighborhood
	let lastSixScores = $state<Record<string, number>>({});
	let lastNeighborhood = $state('');

	$effect(() => {
		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			lastSixScores = sess.sixScores || {};
			lastNeighborhood = sess.neighborhood || sess.primaryHood || '';
		} catch {}
	});

	// ── User State Detection ──
	// Complete: user filled everything AND scored a location
	const isComplete = $derived(hasScored);
	// Ready to score: finished onboarding but hasn't scored yet.
	// Also infer from data: if we have persona + concept + financials, they're ready.
	const isReadyToScore = $derived(
		!hasScored && (
			// Explicit phase says ready
			(data.recap.conversationPhase === 'complete' || data.recap.conversationPhase === 'scoring' || data.recap.conversationPhase === 'address') ||
			// Or inferred: has persona + concept + financials = ready even without phase
			(!!(data.recap.personaType && data.recap.conceptDescription && data.recap.financialEstimates))
		)
	);
	// Incomplete: user started onboarding but didn't finish (has some data, no score, not ready)
	const isIncomplete = $derived(!hasScored && !isReadyToScore && !!(data.recap.personaType || data.recap.conceptDescription));

	// Map conversation phase to a human-readable progress label.
	// When phase is null (older sessions), infer from actual data.
	function getProgressLabel(phase: string | null): string {
		// If we have an explicit phase, use it
		if (phase) {
			switch (phase) {
				case 'greeting':
				case 'persona': return 'Getting started — tell us your business type';
				case 'concept': return 'Defining your concept';
				case 'customers': return 'Identifying your customers';
				case 'financials': return 'Setting your financial targets';
				case 'address': return 'Ready to score a location';
				case 'scoring':
				case 'complete': return 'Onboarding complete';
			}
		}

		// Infer progress from actual data (for older sessions without phase tracking)
		const r = data.recap;
		if (r.lastScore) return 'Onboarding complete';
		if (r.financialEstimates) return 'Ready to score a location';
		if (r.targetCustomers?.length > 0 || r.differentiators?.length > 0) return 'Setting your financial targets';
		if (r.conceptDescription || r.conceptName) return 'Identifying your customers';
		if (r.personaType) return 'Defining your concept';
		return 'Getting started';
	}

	// getScoreColor → canonical DECISION_STATES via scoreUtils
	// Returns CSS class string for verdict-pill compatibility
	function getScoreColor(score: number): string {
		return getVerdictClass(score); // 'strong' | 'promising' | 'testing' | 'caution' | 'risk'
	}
</script>

<svelte:window onkeydown={handleEscapeKey} />

<svelte:head>
	<title>RE² — Welcome Back</title>
	<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
</svelte:head>

<div class="wb-page">
	<!-- ═══ NAV BAR ═══ -->
	<nav class="app-nav">
		<a href="/app/welcome-back" class="nav-back" aria-label="Back to dashboard">&larr;</a>
		<a href="/app/welcome-back" class="nav-logo">RE<sup>2</sup></a>
		<div class="nav-right">
			<a href="/app/onboarding" class="nav-cta">
				Score a Location
			</a>
			<div class="nav-avatar-wrap">
				<button class="nav-avatar" onclick={() => showUserMenu = !showUserMenu} aria-label="User menu" aria-expanded={showUserMenu}>
					{getInitials(data.userName)}
				</button>
				{#if showUserMenu}
					<div class="nav-dropdown" role="menu">
						<div class="nav-dropdown-name">{data.userName}</div>
						<div class="nav-dropdown-divider"></div>
						<button class="nav-dropdown-item" role="menuitem" onclick={() => { showUserMenu = false; showNewConceptConfirm = true; }}>New Concept</button>
						<button class="nav-dropdown-item signout" role="menuitem" onclick={handleSignOut} disabled={isSigningOut}>{isSigningOut ? 'Signing out...' : 'Sign Out'}</button>
					</div>
				{/if}
			</div>
		</div>
	</nav>

	<!-- ═══ MAIN CONTENT ═══ -->
	<div class="wb-body">
		<div class="wb-container">
			<!-- Greeting -->
			<div class="wb-header">
				<h1>Welcome back, <em>{firstName}</em>.</h1>
				{#if isComplete}
					<p class="wb-sub">Here's your concept and latest score. Score another location or try a new idea.</p>
				{:else if isReadyToScore}
					<p class="wb-sub">Your concept is dialed in — you're ready to score a location.</p>
				{:else if isIncomplete}
					<p class="wb-sub">You were making progress — pick up where you left off.</p>
				{:else}
					<p class="wb-sub">Pick up where you left off or try something new.</p>
				{/if}
				<!-- Progress status — shown for all states -->
				<div class="wb-progress-badge">
					<span class="progress-dot" class:complete={isComplete} class:ready={isReadyToScore} class:in-progress={isIncomplete}></span>
					<span class="progress-text">{getProgressLabel(data.recap.conversationPhase)}</span>
				</div>
			</div>

			<!-- ═══ INCOMPLETE USER: Continue Prompt ═══ -->
			{#if isIncomplete}
				<div class="continue-card">
					<div class="continue-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"></circle>
							<polyline points="12 6 12 12 16 14"></polyline>
						</svg>
					</div>
					<div class="continue-body">
						<span class="continue-title">You left off at: {getProgressLabel(data.recap.conversationPhase)}</span>
						{#if data.recap.conceptName || data.recap.personaType}
							<span class="continue-meta">
								{getPersonaEmoji(data.recap.personaType)}
								{data.recap.conceptName || getPersonaLabel(data.recap.personaType)}
							</span>
						{/if}
					</div>
					<a href="/app/onboarding" class="continue-btn" data-sveltekit-reload>
						Continue &rarr;
					</a>
				</div>
			{/if}

			<!-- ═══ CONCEPT CARD (always shown if we have data) ═══ -->
			{#if data.recap.personaType || data.recap.conceptDescription}
				<div class="concept-card">
					<div class="concept-top">
						<div class="concept-emoji">{getPersonaEmoji(data.recap.personaType)}</div>
						<div class="concept-meta">
							<span class="concept-type">{data.recap.conceptName ?? getPersonaLabel(data.recap.personaType)}</span>
							{#if data.recap.conceptName}
								<span class="concept-name">{data.recap.conceptName}</span>
							{/if}
						</div>
						<span class="concept-date">{formatDate(data.recap.updatedAt)}</span>
					</div>

					{#if data.recap.conceptDescription}
						<p class="concept-vision">"{data.recap.conceptDescription}"</p>
					{/if}

					<!-- Financial Chips -->
					{#if data.recap.financialEstimates}
						<div class="fin-row">
							{#if data.recap.financialEstimates.avgTicket}
								<div class="fin-chip">
									<span class="fin-num">${data.recap.financialEstimates.avgTicket}</span>
									<span class="fin-label">avg ticket</span>
								</div>
							{/if}
							{#if data.recap.financialEstimates.dailyCustomers}
								<div class="fin-chip">
									<span class="fin-num">{data.recap.financialEstimates.dailyCustomers}</span>
									<span class="fin-label">daily customers</span>
								</div>
							{/if}
							{#if data.recap.financialEstimates.monthlyRevenue?.length === 2}
								<div class="fin-chip">
									<span class="fin-num">{formatCurrency(data.recap.financialEstimates.monthlyRevenue[0])}–{formatCurrency(data.recap.financialEstimates.monthlyRevenue[1])}</span>
									<span class="fin-label">monthly rev</span>
								</div>
							{/if}
							{#if data.recap.financialEstimates.maxRent || data.recap.financialEstimates.maxHealthyRent}
								<div class="fin-chip">
									<span class="fin-num">{formatCurrency(data.recap.financialEstimates.maxRent || data.recap.financialEstimates.maxHealthyRent || 0)}</span>
									<span class="fin-label">max rent/mo</span>
								</div>
							{/if}
						</div>
					{/if}

					<!-- Progressive Disclosure -->
					{#if (data.recap.targetCustomers?.length ?? 0) > 0 || (data.recap.differentiators?.length ?? 0) > 0}
						<button class="details-toggle" onclick={() => showDetails = !showDetails}>
							{showDetails ? 'Hide details' : 'Show more details'}
							<span class="toggle-arrow" class:open={showDetails}>&#9662;</span>
						</button>
						{#if showDetails}
							<div class="details-panel">
								{#if data.recap.targetCustomers.length > 0}
									<div class="detail-row">
										<span class="detail-label">Target Customers</span>
										<span class="detail-value">{data.recap.targetCustomers.join(', ')}</span>
									</div>
								{/if}
								{#if data.recap.differentiators.length > 0}
									<div class="detail-row">
										<span class="detail-label">Differentiators</span>
										<span class="detail-value">{data.recap.differentiators.join(', ')}</span>
									</div>
								{/if}
							</div>
						{/if}
					{/if}

					<!-- UX-A: sub-score chips (loaded client-side from localStorage) -->
					{#if isComplete && (lastSixScores.transit || lastSixScores.demographics || lastSixScores.competition)}
						<div class="sub-score-chips">
							{#if lastSixScores.transit}
								<span class="sub-chip">
									<span class="sub-chip-label">Transit</span>
									<span class="sub-chip-val" style="color:{_getScoreColor(lastSixScores.transit)}">{lastSixScores.transit}</span>
								</span>
							{/if}
							{#if lastSixScores.demographics}
								<span class="sub-chip">
									<span class="sub-chip-label">Demo</span>
									<span class="sub-chip-val" style="color:{_getScoreColor(lastSixScores.demographics)}">{lastSixScores.demographics}</span>
								</span>
							{/if}
							{#if lastSixScores.competition}
								<span class="sub-chip">
									<span class="sub-chip-label">Comp.</span>
									<span class="sub-chip-val" style="color:{_getScoreColor(lastSixScores.competition)}">{lastSixScores.competition}</span>
								</span>
							{/if}
						</div>
					{/if}

					<!-- ═══ LOCATION IQ SCORE RECAP ═══ -->
					{#if isComplete}
						<div class="score-section">
							<div class="score-section-header">
								<span class="score-section-label">Your Score</span>
							</div>
							<div class="score-row">
								<!-- UX-A: SVG arc ring replaces CSS circle -->
								<div class="score-ring-svg">
									<svg viewBox="0 0 64 64" width="64" height="64">
										<circle cx="32" cy="32" r="26" fill="none" stroke="#e8e3dc" stroke-width="5"/>
										<circle cx="32" cy="32" r="26" fill="none"
											stroke={_getScoreColor(data.recap.lastScore ?? 0)}
											stroke-width="5"
											stroke-linecap="round"
											stroke-dasharray="163.4"
											stroke-dashoffset={163.4 * (1 - (data.recap.lastScore ?? 0) / 100)}
											transform="rotate(-90 32 32)"
										/>
									</svg>
									<div class="score-ring-inner">
										<span class="score-num">{data.recap.lastScore ?? '--'}</span>
										<span class="score-grade">{getScoreGrade(data.recap.lastScore ?? 0)}</span>
									</div>
								</div>
								<div class="score-info">
									<span class="score-addr">{data.recap.lastAddress?.split(',')[0]}</span>
									{#if lastNeighborhood}
										<span class="score-nbhd">{lastNeighborhood}</span>
									{/if}
									{#if data.recap.lastVerdict}
										<span class="score-verdict">{data.recap.lastVerdict}</span>
									{/if}
								</div>
								<a href="/app/location?addr={encodeURIComponent(data.recap.lastAddress || '')}" class="score-link" data-sveltekit-reload>
									Full report &rarr;
								</a>
							</div>
						</div>
					{:else if isReadyToScore}
						<!-- UX-A: locked score teaser — concept ready but no score yet -->
						<div class="score-section">
							<div class="score-section-header">
								<span class="score-section-label">Your Score</span>
							</div>
							<div class="score-row">
								<div class="score-ring-svg locked">
									<svg viewBox="0 0 64 64" width="64" height="64" opacity="0.35">
										<circle cx="32" cy="32" r="26" fill="none" stroke="#D1D5DB" stroke-width="5" stroke-dasharray="10 7"/>
									</svg>
									<div class="score-ring-inner locked">
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#9CA3AF" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
									</div>
								</div>
								<div class="score-info">
									<span class="score-addr muted">Pick an address to unlock your score</span>
								</div>
								<a href="/app/location" class="score-link primary" data-sveltekit-reload>Score Now &rarr;</a>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- ═══ ACTION CARDS ═══ -->
			<div class="actions">
				{#if isComplete}
					<!-- Complete users: primary action is Location IQ page -->
					<a href="/app/location" class="action-card primary" data-sveltekit-reload>
						<div class="action-content">
							<span class="action-title">Score Another Location</span>
							<span class="action-desc">Try a different address for the same concept</span>
						</div>
						<span class="action-arrow">&rarr;</span>
					</a>

					<a href="/app/location?addr={encodeURIComponent(data.recap.lastAddress || '')}" class="action-card location-iq" data-sveltekit-reload>
						<div class="action-content">
							<span class="action-title">View Your Score</span>
							<span class="action-desc">See your full analysis for {data.recap.lastAddress}</span>
						</div>
						<span class="action-arrow">&rarr;</span>
					</a>
				{:else if isReadyToScore}
					<!-- Onboarding done, no score yet: go straight to scoring -->
					<a href="/app/location" class="action-card primary" data-sveltekit-reload>
						<div class="action-content">
							<span class="action-title">Score Your First Location</span>
							<span class="action-desc">Your concept is ready — enter an address and get your score</span>
						</div>
						<span class="action-arrow">&rarr;</span>
					</a>
				{:else if isIncomplete}
					<!-- Incomplete users: primary action is continue onboarding -->
					<a href="/app/onboarding" class="action-card primary" data-sveltekit-reload>
						<div class="action-content">
							<span class="action-title">Continue Where You Left Off</span>
							<span class="action-desc">Finish your concept profile and score a location</span>
						</div>
						<span class="action-arrow">&rarr;</span>
					</a>
				{:else}
					<!-- Fallback -->
					<a href="/app/location" class="action-card primary" data-sveltekit-reload>
						<div class="action-content">
							<span class="action-title">Score Your First Location</span>
							<span class="action-desc">Enter an address and get your location intelligence report</span>
						</div>
						<span class="action-arrow">&rarr;</span>
					</a>
				{/if}

				<!-- Always show new concept option -->
				<button class="action-card secondary" onclick={() => showNewConceptConfirm = true}>
					<div class="action-content">
						<span class="action-title">Evaluate a New Concept</span>
						<span class="action-desc">Start fresh with a different business idea</span>
					</div>
					<span class="action-arrow">&rarr;</span>
				</button>
			</div>

			<!-- New Concept Confirmation Dialog -->
			{#if showNewConceptConfirm}
				<div class="confirm-overlay" onclick={() => showNewConceptConfirm = false} onkeydown={handleEscapeKey} role="presentation">
					<div class="confirm-dialog" role="dialog" aria-modal="true" aria-label="Confirm new concept" onclick={(e) => e.stopPropagation()}>
						<p class="confirm-text">Starting a new concept will replace your current one.{#if hasScored} Your previous scores will still be accessible.{/if}</p>
						<div class="confirm-actions">
							<button class="confirm-btn cancel" onclick={() => showNewConceptConfirm = false}>Keep Current</button>
							<button class="confirm-btn proceed" disabled={isStartingNew} onclick={() => { isStartingNew = true; localStorage.removeItem('re2_chat'); window.location.href = '/app/onboarding?newConcept=true'; }}>{isStartingNew ? 'Loading...' : 'Start New Concept'}</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* ═══ V3 DESIGN TOKENS ═══ */
	.wb-page {
		--cream: #faf7f2;
		--warm: #f5f0e8;
		--lilac: #e8f2ec;
		--lilac-deep: #4a7c5c;
		--blush: #ffe8e0;
		--hot-pink: #e8345a;
		--sage: #4a7c5c;
		--sage-light: #e8f2ec;
		--deep-green: #1a3a2a;
		--marigold: #e8a838;
		--ink: #1a1a1a;
		--ink-light: #4a4a4a;
		--ink-muted: #8a8a8a;
		--border: #e8e2d8;
		font-family: 'DM Sans', -apple-system, sans-serif;
		min-height: 100vh;
		background: var(--cream);
		display: flex;
		flex-direction: column;
	}

	/* ═══ NAV ═══ */
	.app-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 28px;
		height: 56px;
		background: rgba(250, 247, 242, 0.85);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		position: sticky;
		top: 0;
		z-index: 50;
	}

	.nav-back {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		color: var(--ink-light);
		text-decoration: none;
		font-size: 18px;
		transition: all 0.2s;
		margin-right: 8px;
	}
	.nav-back:hover {
		background: var(--warm);
		color: var(--ink);
	}

	.nav-logo {
		font-family: 'Playfair Display', serif;
		font-size: 22px;
		font-weight: 400;
		color: var(--deep-green);
		text-decoration: none;
		letter-spacing: -0.5px;
	}

	.nav-logo sup {
		color: var(--hot-pink);
		font-size: 14px;
	}

	.nav-right {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.nav-cta {
		font-family: 'DM Sans', sans-serif;
		font-size: 13px;
		font-weight: 600;
		color: white;
		background: var(--sage);
		padding: 8px 18px;
		border-radius: 24px;
		text-decoration: none;
		transition: all 0.2s;
	}

	.nav-cta:hover {
		background: var(--deep-green);
	}

	.nav-avatar-wrap { position: relative; }

	.nav-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--deep-green);
		color: white;
		font-size: 14px;
		font-weight: 700;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		font-family: 'DM Sans', sans-serif;
	}

	.nav-avatar:hover { opacity: 0.85; }

	.nav-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background: white;
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
		min-width: 180px;
		overflow: hidden;
		z-index: 100;
		animation: dropIn 0.15s ease-out;
	}

	.nav-dropdown-name {
		padding: 12px 16px 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
	}

	.nav-dropdown-divider { height: 1px; background: var(--border); margin: 4px 0; }

	.nav-dropdown-item {
		display: block;
		width: 100%;
		padding: 10px 16px;
		font-size: 13px;
		font-weight: 500;
		color: var(--ink-light);
		background: none;
		border: none;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s;
	}

	.nav-dropdown-item:hover { background: var(--warm); color: var(--ink); }
	.nav-dropdown-item.signout { color: var(--hot-pink); }
	.nav-dropdown-item.signout:hover { background: var(--blush); }

	@keyframes dropIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ═══ BODY ═══ */
	.wb-body {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px 24px 80px;
	}

	.wb-container {
		width: 100%;
		max-width: 540px;
	}

	.wb-header {
		text-align: center;
		margin-bottom: 36px;
	}

	h1 {
		font-family: 'Playfair Display', serif;
		font-size: 28px;
		font-weight: 400;
		color: var(--ink);
		margin: 0 0 10px 0;
		letter-spacing: -0.3px;
	}

	h1 em {
		font-style: italic;
		color: var(--hot-pink);
	}

	.wb-sub {
		font-size: 15px;
		color: var(--ink-muted);
		margin: 0;
		line-height: 1.6;
	}

	.wb-progress-badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-top: 14px;
		padding: 6px 16px;
		background: var(--warm);
		border: 1px solid var(--border);
		border-radius: 20px;
		font-size: 13px;
		color: var(--ink-light);
	}
	.progress-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ink-muted);
		flex-shrink: 0;
	}
	.progress-dot.complete { background: var(--sage); }
	.progress-dot.ready { background: var(--marigold); }
	/* LOW-3: in-progress dot should use marigold (brand) not hot-pink (error) */
	.progress-dot.in-progress { background: var(--marigold); animation: pulse-dot 2s ease-in-out infinite; }
	@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
	.progress-text {
		font-weight: 500;
	}

	/* ═══ LILAC CONCEPT CARD ═══ */
	.concept-card {
		background: var(--lilac);
		border: 1px solid var(--lilac-deep);
		border-radius: 20px;
		padding: 24px;
		margin-bottom: 24px;
	}

	.concept-top {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
	}

	.concept-emoji {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
		flex-shrink: 0;
	}

	.concept-meta {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.concept-type {
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--ink-light);
	}

	.concept-name {
		font-family: 'Playfair Display', serif;
		font-size: 18px;
		color: var(--ink);
	}

	.concept-date {
		font-size: 13px;
		color: var(--ink-muted);
		flex-shrink: 0;
		align-self: flex-start;
		margin-top: 2px;
	}

	.concept-vision {
		font-size: 14px;
		font-style: italic;
		color: var(--ink-light);
		line-height: 1.6;
		margin: 0 0 16px 0;
		padding: 12px 16px;
		background: rgba(255, 255, 255, 0.45);
		border-radius: 12px;
		overflow-wrap: break-word;
		word-break: break-word;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Financial Chips */
	.fin-row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.fin-chip {
		background: rgba(255, 255, 255, 0.55);
		border-radius: 10px;
		padding: 8px 14px;
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 80px;
	}

	.fin-num {
		font-size: 17px;
		font-weight: 700;
		color: var(--deep-green);
	}

	.fin-label {
		font-size: 14px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--ink-muted);
		font-weight: 600;
	}

	/* Progressive Disclosure */
	.details-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 12px;
		padding: 0;
		background: none;
		border: none;
		font-family: inherit;
		font-size: 14px;
		font-weight: 600;
		color: var(--ink-light);
		cursor: pointer;
		transition: color 0.2s;
	}

	.details-toggle:hover { color: var(--ink); }

	.toggle-arrow {
		font-size: 14px;
		transition: transform 0.2s;
	}

	.toggle-arrow.open { transform: rotate(180deg); }

	.details-panel {
		margin-top: 12px;
		padding: 12px 16px;
		background: rgba(255, 255, 255, 0.45);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		animation: slideDown 0.2s ease-out;
	}

	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.detail-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.detail-label {
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--ink-muted);
	}

	.detail-value {
		font-size: 13px;
		color: var(--ink-light);
		line-height: 1.5;
	}

	/* ═══ CONTINUE CARD (incomplete users) ═══ */
	.continue-card {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 20px;
		background: linear-gradient(135deg, #fff8e1 0%, #fff3cd 100%);
		border: 1px solid #f0d78c;
		border-radius: 16px;
		margin-bottom: 16px;
		animation: slideDown 0.3s ease-out;
	}

	.continue-icon {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: rgba(232, 168, 56, 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--marigold);
	}

	.continue-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.continue-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
	}

	.continue-meta {
		font-size: 14px;
		color: var(--ink-muted);
	}

	.continue-btn {
		padding: 8px 16px;
		background: var(--marigold);
		color: white;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		flex-shrink: 0;
		transition: all 0.2s;
		font-family: inherit;
	}

	.continue-btn:hover {
		background: #d49830;
		transform: translateY(-1px);
	}

	/* ═══ SCORE SECTION (inside concept card) ═══ */
	.score-section {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid rgba(255, 255, 255, 0.5);
	}

	.score-section-header {
		margin-bottom: 10px;
	}

	.score-section-label {
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--ink-muted);
	}

	/* Score Row */
	.score-row {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid rgba(255, 255, 255, 0.5);
	}

	.score-ring {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border: 4px solid;
		background: rgba(255, 255, 255, 0.7);
	}

	.score-ring.strong { border-color: var(--sage); }
	.score-ring.caution { border-color: var(--marigold); }
	.score-ring.risk { border-color: var(--hot-pink); }

	.score-num {
		font-size: 19px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}

	.score-ring.strong .score-num { color: var(--sage); }
	.score-ring.caution .score-num { color: #b8780a; }
	.score-ring.risk .score-num { color: var(--hot-pink); }

	.score-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.score-addr {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
		overflow-wrap: break-word;
		word-break: break-word;
	}

	.score-verdict {
		font-size: 14px;
		color: var(--ink-muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.score-link {
		font-size: 14px;
		font-weight: 600;
		color: var(--sage);
		text-decoration: none;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.score-link.primary {
		padding: 5px 12px;
		background: #1e3a2a;
		color: white;
		border-radius: 6px;
		font-size: 14px;
	}

	.score-link:hover { text-decoration: underline; }
	.score-link.primary:hover { background: #2d5a40; text-decoration: none; }

	.score-addr.muted { color: #9CA3AF; font-weight: 500; }

	.score-nbhd {
		font-size: 13px;
		color: var(--ink-muted);
		font-weight: 500;
	}

	/* UX-A: SVG arc ring */
	.score-ring-svg {
		position: relative;
		width: 64px;
		height: 64px;
		flex-shrink: 0;
	}

	.score-ring-svg svg {
		display: block;
	}

	.score-ring-inner {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
	}

	.score-ring-svg.locked .score-ring-inner {
		opacity: 0.5;
	}

	.score-grade {
		font-size: 13px;
		font-weight: 800;
		color: #6B7280;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* UX-A: sub-score chips */
	.sub-score-chips {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 8px;
	}

	.sub-chip {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 3px 9px;
		background: white;
		border: 1px solid #E5E7EB;
		border-radius: 12px;
		font-size: 13px;
	}

	.sub-chip-label {
		color: #6B7280;
		font-weight: 500;
	}

	.sub-chip-val {
		font-weight: 700;
	}

	/* ═══ ACTION CARDS ═══ */
	.actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.action-card {
		display: flex;
		align-items: center;
		gap: 16px;
		border-radius: 16px;
		padding: 20px 24px;
		text-decoration: none;
		transition: all 0.2s;
		cursor: pointer;
	}

	.action-card.primary {
		background: var(--sage);
		color: white;
	}

	.action-card.primary:hover {
		background: var(--deep-green);
		transform: translateY(-1px);
		box-shadow: 0 4px 16px rgba(26, 58, 42, 0.2);
	}

	.action-card.secondary {
		background: white;
		border: 1px solid var(--border);
		color: var(--ink);
	}

	.action-card.secondary:hover {
		border-color: var(--sage);
		transform: translateY(-1px);
		box-shadow: 0 2px 12px rgba(74, 124, 92, 0.1);
	}

	.action-card.location-iq {
		background: var(--lilac);
		border: 1px solid var(--lilac-deep);
		color: var(--ink);
	}

	.action-card.location-iq:hover {
		border-color: #a88fc4;
		transform: translateY(-1px);
		box-shadow: 0 2px 12px rgba(196, 176, 217, 0.3);
	}

	.action-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.action-title {
		font-size: 15px;
		font-weight: 600;
	}

	.action-desc {
		font-size: 13px;
		opacity: 0.75;
		line-height: 1.4;
		overflow-wrap: break-word;
		word-break: break-word;
	}

	.action-card.primary .action-desc { opacity: 0.8; }

	.action-arrow {
		font-size: 20px;
		flex-shrink: 0;
		transition: transform 0.2s;
		opacity: 0.7;
	}

	.action-card:hover .action-arrow {
		transform: translateX(3px);
		opacity: 1;
	}

	/* ═══ CONFIRMATION DIALOG ═══ */
	.confirm-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		animation: fadeIn 0.15s ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.confirm-dialog {
		background: white;
		border-radius: 16px;
		padding: 24px;
		max-width: 380px;
		width: 90%;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
		animation: slideUp 0.2s ease-out;
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.confirm-text {
		font-size: 14px;
		color: var(--ink);
		line-height: 1.6;
		margin: 0 0 20px 0;
	}

	.confirm-actions {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
	}

	.confirm-btn {
		padding: 8px 18px;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		border: none;
		transition: all 0.2s;
	}

	.confirm-btn.cancel {
		background: var(--warm);
		color: var(--ink-light);
	}

	.confirm-btn.cancel:hover {
		background: var(--border);
	}

	.confirm-btn.proceed {
		background: var(--hot-pink);
		color: white;
	}

	.confirm-btn.proceed:hover {
		background: #c92a4a;
	}

	.confirm-btn.proceed:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Focus-visible for keyboard nav */
	button:focus-visible, a:focus-visible {
		outline: 2px solid var(--sage);
		outline-offset: 2px;
	}

	/* ═══ RESPONSIVE ═══ */
	@media (max-width: 480px) {
		.app-nav { padding: 0 16px; }
		.wb-body { padding: 24px 16px 48px; }
		h1 { font-size: 24px; }
		.concept-card { padding: 16px; }
		.action-card { padding: 16px 18px; }
		.fin-row { flex-direction: column; }
		.nav-cta { font-size: 14px; padding: 6px 14px; }
		.wb-progress-badge { font-size: 14px; padding: 5px 12px; }
		.progress-text { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	}
</style>
