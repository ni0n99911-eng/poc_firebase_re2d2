<script lang="ts">
	/**
	 * RE² My Locations Page
	 *
	 * Displays all scored locations for the current user.
	 * Reads from: re2_launchpad.scoredLocations (array written by location page)
	 *             re2_session (current context — bizType, analyzedAddress)
	 *
	 * Features:
	 * - List of all scored locations with Fit IQ, Location IQ, Vision IQ rings
	 * - Sort by: Most Recent, Highest Score, Best Fit
	 * - Select 2 locations → Compare side-by-side (links to /app/space/compare)
	 * - Per-card actions: View Analysis, Export Report
	 * - "+ Score a New Location" → /app/onboarding
	 *
	 * Navigation: /app/locations
	 * Accessible from: "← My Locations" in NavigationDrawer, welcome-back dashboard
	 */
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { writeCanonicalConcept } from '$lib/constants/businessTypeNormalizer';
	// BR-UX-10: canonical grade / tier / meaning via decision-engine (single source of truth).
	import { fitTierLabel, fitGrade, fitMeaningShort } from '$lib/utils/decision-engine';
	import { loadLaunchPadData } from '$lib/launchpad-store';
	import { getScoreColor } from '$lib/constants/scoreUtils';
	import { getConceptLabel } from '$lib/constants/concepts';
	import NavigationDrawer from '$lib/components/NavigationDrawer.svelte';

	// ── Types ──
	interface ScoredLocation {
		addr: string;
		score: number;       // Location IQ composite
		fitScore?: number;   // Fit IQ if available
		visionScore?: number;// Vision IQ if available
		grade?: string;
		scoredAt: string;    // ISO timestamp string (or ms string)
		neighborhood?: string;
	}

	// ── State ──
	let locations = $state<ScoredLocation[]>([]);
	let bizType = $state('');
	let differentiator = $state('');
	let priceLevel = $state('');
	let isLoading = $state(true);
	let sortMode = $state<'recent' | 'score' | 'fit'>('recent');
	let selectedAddrs = $state<string[]>([]);

	// ── Derived ──
	let sortedLocations = $derived.by(() => {
		const locs = [...locations];
		if (sortMode === 'score') {
			return locs.sort((a, b) => (b.score || 0) - (a.score || 0));
		} else if (sortMode === 'fit') {
			return locs.sort((a, b) => (b.fitScore || b.score || 0) - (a.fitScore || a.score || 0));
		}
		// Most recent (default)
		return locs.sort((a, b) => {
			const ta = parseInt(a.scoredAt) || new Date(a.scoredAt).getTime() || 0;
			const tb = parseInt(b.scoredAt) || new Date(b.scoredAt).getTime() || 0;
			return tb - ta;
		});
	});

	let canCompare = $derived(selectedAddrs.length === 2);
	// #33: friendlyBizType replaced by getConceptLabel from src/lib/constants/concepts.ts
	let conceptLabel = $derived(getConceptLabel(bizType));

	// BR-UX-10: verdict = canonical BR-1 tier + grade-class from decision-engine.
	// Replaces old scoreUtils.getVerdictFull which used drifted vocabulary.
	function getVerdict(score: number): { label: string; cls: string; grade: string; meaning: string } {
		if (!score || score <= 0) return { label: '—', cls: '', grade: '', meaning: '' };
		const grade = fitGrade(score);
		return {
			label: fitTierLabel(score),
			cls: `grade-${grade.toLowerCase()}`,
			grade,
			meaning: fitMeaningShort(score)
		};
	}

	function ringColor(score: number): string {
		return getScoreColor(score);
	}

	function ringOffset(score: number, r = 22): number {
		return 2 * Math.PI * r * (1 - score / 100);
	}

	function formatDate(ts: string): string {
		if (!ts || ts === '0') return '';
		try {
			const ms = Number(ts);
			if (!isNaN(ms) && ms > 1_000_000_000_000) {
				// Numeric ms timestamp (e.g. "1775003540689") — direct
				return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
			}
			// ISO string fallback (e.g. "2026-03-31T12:00:00.000Z")
			const d = new Date(ts);
			if (!isNaN(d.getTime())) {
				return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
			}
			return '';
		} catch { return ''; }
	}

	// ── Selection logic ──
	function toggleSelect(addr: string) {
		const idx = selectedAddrs.indexOf(addr);
		if (idx > -1) {
			selectedAddrs = selectedAddrs.filter(a => a !== addr);
		} else if (selectedAddrs.length < 2) {
			selectedAddrs = [...selectedAddrs, addr];
		} else {
			// Replace oldest selection
			selectedAddrs = [selectedAddrs[1], addr];
		}
	}

	function isSelected(addr: string): boolean {
		return selectedAddrs.includes(addr);
	}

	function openCompare() {
		if (!canCompare) return;
		const [a, b] = selectedAddrs;
		goto(`/app/space/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
	}

	onMount(() => {
		try {
			const lp = loadLaunchPadData() as any;
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');

			bizType = writeCanonicalConcept(lp.businessType || sess.bizType || '');
			differentiator = lp.differentiator || lp.visionStatement || '';
			priceLevel = lp.priceLevel || sess.priceLevel || '';

			// Load scored locations from launchpad
			const scored: ScoredLocation[] = (lp.scoredLocations || []);

			// If no scoredLocations array but session has a score, synthesize one entry
			if (scored.length === 0 && sess.analyzedAddress && sess.locationIQ > 0) {
				scored.push({
					addr: sess.analyzedAddress,
					score: sess.locationIQ,
					fitScore: sess.fitScore || 0,
					visionScore: sess.serverVisionIQ || 0,
					scoredAt: String(sess.scoredAt || Date.now()),
					neighborhood: sess.neighborhood || sess.primaryHood || '',
				});
			}

			locations = scored;
		} catch {}

		isLoading = false;
	});
</script>

<svelte:head>
	<title>RE² — My Locations</title>
	<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="page">

	<!-- ═══ NAV ═══ -->
	<nav class="topbar">
		<div class="topbar-left">
			<a href="/app/welcome-back" class="logo">RE<sup>2</sup></a>
			<span class="nav-sep">›</span>
			<span class="nav-label">My Locations</span>
		</div>
		<div class="topbar-right">
			<a href="/app/dashboard" class="btn-ghost">← Dashboard</a>
			<a href="/app/location" class="btn-teal">+ Score New Location</a>
		</div>
	</nav>

	<div class="page-body">

		<!-- PAGE HEADER -->
		<div class="page-header">
			<div>
				<h1 class="page-title">My Locations</h1>
				<p class="page-subtitle">{locations.length} location{locations.length !== 1 ? 's' : ''} analyzed</p>
				{#if conceptLabel}
					<span class="concept-pill">{conceptLabel}</span>
				{/if}
			</div>
			{#if locations.length >= 2}
				<button
					class="btn-compare"
					class:active={canCompare}
					onclick={openCompare}
					disabled={!canCompare}
				>
					{canCompare ? 'Compare Selected →' : 'Select 2 to Compare'}
				</button>
			{/if}
		</div>

		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading your locations…</p>
			</div>
		{:else if locations.length === 0}
			<!-- EMPTY STATE -->
			<div class="empty-state">
				<div class="empty-icon">📍</div>
				<h2>No locations scored yet</h2>
				<p>Score your first location to see your analysis here.</p>
				<a href="/app/onboarding" class="btn-teal">Score a Location</a>
			</div>
		{:else}
			<!-- COMPARE BANNER -->
			{#if canCompare}
				<div class="compare-banner">
					<span class="compare-text">
						Comparing <strong>{selectedAddrs[0]}</strong> vs <strong>{selectedAddrs[1]}</strong>
					</span>
					<div style="display:flex;gap:8px">
						<button class="btn-ghost-sm" onclick={() => selectedAddrs = []}>Clear</button>
						<button class="btn-dark" onclick={openCompare}>View Side-by-Side →</button>
					</div>
				</div>
			{/if}

			<!-- SORT TOOLBAR -->
			<div class="toolbar">
				<div class="toolbar-left">
					<span class="sort-label">Sort:</span>
					<button class="filter-chip" class:active={sortMode === 'recent'} onclick={() => sortMode = 'recent'}>Most Recent</button>
					<button class="filter-chip" class:active={sortMode === 'score'} onclick={() => sortMode = 'score'}>Highest Score</button>
					<button class="filter-chip" class:active={sortMode === 'fit'} onclick={() => sortMode = 'fit'}>Best Fit</button>
				</div>
				{#if locations.length >= 2}
					<span class="toolbar-hint">Select 2 to compare side-by-side</span>
				{/if}
			</div>

			<!-- LOCATION CARDS -->
			<div class="locations-list">
				{#each sortedLocations as loc}
					{@const verdict = getVerdict(loc.fitScore || loc.score)}
					{@const selected = isSelected(loc.addr)}
					<div
						class="loc-card"
						class:selected
						onclick={() => toggleSelect(loc.addr)}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && toggleSelect(loc.addr)}
					>
						<div class="loc-card-inner">
							<!-- Checkbox -->
							<div class="loc-check" class:checked={selected} aria-hidden="true">
								{#if selected}✓{/if}
							</div>
							<!-- Info -->
							<div class="loc-info">
								<div class="loc-address">{loc.addr}</div>
								<div class="loc-meta">
									{#if loc.scoredAt}<span>{formatDate(loc.scoredAt)}</span>{/if}
									{#if loc.neighborhood}<span class="meta-sep">·</span><span>{loc.neighborhood}</span>{/if}
									{#if verdict.grade}
										<span class="meta-sep">·</span>
										<span class="verdict-pill {verdict.cls}">Grade {verdict.grade} · {verdict.label}</span>
									{/if}
								</div>
								{#if verdict.meaning}
									<div class="loc-meaning">{verdict.meaning}</div>
								{/if}
							</div>
							<!-- OSR-01 (Sprint 1 April 12): Single score ring — One-Score Rule.
							     Kills the 3-ring Fit IQ / Location IQ / Vision IQ display. The
							     founder sees one number, one verdict. -->
							<div class="loc-rings">
								<div class="ring-block">
									<div class="ring-sm">
										<svg width="52" height="52" viewBox="0 0 52 52" style="transform:rotate(-90deg)">
											<circle cx="26" cy="26" r="20" fill="none" stroke="#e5e7eb" stroke-width="5"/>
											<circle cx="26" cy="26" r="20" fill="none"
												stroke="{ringColor(loc.fitScore || loc.score)}" stroke-width="5"
												stroke-dasharray="{2*Math.PI*20}"
												stroke-dashoffset="{ringOffset(loc.fitScore || loc.score, 20)}"
												stroke-linecap="round"/>
										</svg>
										<span class="ring-val">{loc.fitScore || loc.score}<span class="ring-denom">/100</span></span>
									</div>
									<div class="ring-label">Score</div>
								</div>
							</div>
						</div>
						<!-- Card actions -->
						<div class="loc-actions" role="none">
							<button class="loc-action-btn"
								onclick={(e) => { e.stopPropagation(); goto(`/app/location/report?addr=${encodeURIComponent(loc.addr)}`); }}
							>📄 Report</button>
							<button class="loc-action-btn primary"
								onclick={(e) => { e.stopPropagation(); goto(`/app/location?addr=${encodeURIComponent(loc.addr)}`); }}
							>View Analysis →</button>
						</div>
					</div>
				{/each}
			</div>

			<!-- ADD NEW -->
			<div class="add-new">
				<p class="add-new-text">Add another address to your comparison</p>
				<a href="/app/onboarding" class="btn-teal">+ Score a New Location</a>
			</div>
		{/if}

	</div><!-- /page-body -->
</div><!-- /page -->

<!-- FIND-B-07: NavigationDrawer gives module strip + "← My Locations" consistency with rest of flow -->
<NavigationDrawer currentPath={$page.url.pathname} />

<style>
	* { box-sizing: border-box; }
	.page { min-height: 100vh; background: #f5f0e8; font-family: -apple-system, BlinkMacSystemFont, 'DM Sans', sans-serif; color: #111827; }

	/* ── NAV ── */
	.topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 56px; background: #f5f0e8; border-bottom: 1px solid #e0ddd7; position: sticky; top: 0; z-index: 100; }
	.topbar-left { display: flex; align-items: center; gap: 10px; }
	.logo { font-family: Georgia, serif; font-size: 17px; font-weight: 700; color: #111827; text-decoration: none; }
	.logo sup { color: #0D7C6E; font-size: 10px; }
	.nav-sep { color: #D1D5DB; font-size: 14px; }
	.nav-label { font-size: 13px; font-weight: 600; color: #374151; }
	.topbar-right { display: flex; gap: 8px; }
	.btn-ghost { font-size: 12px; padding: 5px 12px; border-radius: 6px; border: 1px solid #E5E7EB; background: white; color: #374151; cursor: pointer; text-decoration: none; white-space: nowrap; }
	.btn-teal { font-size: 12px; padding: 5px 14px; border-radius: 6px; background: #0D7C6E; color: white; cursor: pointer; font-weight: 600; text-decoration: none; border: none; white-space: nowrap; }
	.btn-dark { font-size: 12px; padding: 5px 14px; border-radius: 6px; background: #111827; color: white; cursor: pointer; font-weight: 600; border: none; white-space: nowrap; }
	.btn-ghost-sm { font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 1px solid #E5E7EB; background: white; color: #374151; cursor: pointer; }

	/* ── PAGE BODY ── */
	.page-body { max-width: 900px; margin: 0 auto; padding: 36px 24px 80px; }

	/* ── HEADER ── */
	.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
	.page-title { font-size: 24px; font-weight: 700; color: #111827; }
	.page-subtitle { font-size: 14px; color: #6B7280; margin-top: 3px; }
	.concept-pill { display: inline-flex; align-items: center; background: #e8f0ea; padding: 4px 10px; border-radius: 20px; font-size: 12px; color: #1e3a2a; font-weight: 600; margin-top: 8px; }
	.btn-compare { font-size: 12px; padding: 6px 14px; border-radius: 6px; border: 1px solid #e0ddd7; background: white; color: #374151; cursor: pointer; white-space: nowrap; }
	.btn-compare.active { background: #111827; color: white; border-color: #111827; }
	.btn-compare:disabled { opacity: 0.5; cursor: default; }

	/* ── COMPARE BANNER ── */
	.compare-banner { background: white; border: 1px solid #e0ddd7; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
	.compare-text { font-size: 13px; color: #374151; }

	/* ── TOOLBAR ── */
	.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
	.toolbar-left { display: flex; align-items: center; gap: 8px; }
	.sort-label { font-size: 12px; color: #6B7280; }
	.filter-chip { font-size: 12px; padding: 4px 10px; border-radius: 20px; border: 1px solid #E5E7EB; background: white; color: #374151; cursor: pointer; }
	.filter-chip.active { background: #1e3a2a; color: white; border-color: #1e3a2a; }
	.toolbar-hint { font-size: 12px; color: #9CA3AF; }

	/* ── CARDS ── */
	.locations-list { display: flex; flex-direction: column; gap: 12px; }
	.loc-card { background: white; border-radius: 12px; border: 1px solid #e0ddd7; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
	.loc-card:hover { border-color: #1e3a2a; box-shadow: 0 2px 10px rgba(0,0,0,0.07); }
	.loc-card.selected { border: 2px solid #1e3a2a; box-shadow: 0 0 0 2px rgba(30,58,42,0.12); }
	.loc-card-inner { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px; padding: 16px 18px; }
	.loc-check { width: 18px; height: 18px; border: 2px solid #D1D5DB; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
	.loc-check.checked { background: #1e3a2a; border-color: #1e3a2a; color: white; }
	.loc-info { min-width: 0; }
	.loc-address { font-size: 15px; font-weight: 700; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.loc-meta { font-size: 12px; color: #6B7280; margin-top: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
	.meta-sep { color: #D1D5DB; }
	.verdict-pill { display: inline-flex; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
	/* BR-UX-10: grade-based verdict pill colors (A→F, 1:1 with decision-engine thresholds) */
	.verdict-pill.grade-a { background: #d1fae5; color: #065f46; }
	.verdict-pill.grade-b { background: #e0f2fe; color: #075985; }
	.verdict-pill.grade-c { background: #fef3c7; color: #92400e; }
	.verdict-pill.grade-d { background: #ffedd5; color: #9a3412; }
	.verdict-pill.grade-f { background: #fee2e2; color: #991b1b; }
	.loc-meaning { margin-top: 6px; font-size: 12px; color: var(--text-secondary, #4b5563); line-height: 1.5; max-width: 560px; }
	.loc-rings { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
	.ring-block { display: flex; flex-direction: column; align-items: center; gap: 3px; }
	.ring-sm { position: relative; width: 52px; height: 52px; }
	.ring-val { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 13px; font-weight: 700; color: #111827; }
	.ring-denom { font-size: 9px; font-weight: 500; color: #9ca3af; }
	.ring-label { font-size: 9px; font-weight: 700; color: #9CA3AF; letter-spacing: 0.05em; text-transform: uppercase; }
	.loc-actions { border-top: 1px solid #f0ece4; padding: 8px 18px; display: flex; gap: 8px; justify-content: flex-end; background: #fafaf8; border-radius: 0 0 12px 12px; }
	.loc-action-btn { font-size: 11px; padding: 4px 10px; border-radius: 6px; border: 1px solid #e0ddd7; background: white; color: #374151; cursor: pointer; }
	.loc-action-btn.primary { background: #111827; color: white; border-color: #111827; }

	/* ── ADD NEW ── */
	.add-new { margin-top: 20px; padding: 20px; background: white; border-radius: 12px; border: 2px dashed #c4d8c9; text-align: center; }
	.add-new-text { font-size: 14px; color: #374151; margin-bottom: 10px; }

	/* ── LOADING / EMPTY ── */
	.loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; gap: 14px; text-align: center; padding: 24px; }
	.spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #0D7C6E; border-radius: 50%; animation: spin 0.7s linear infinite; }
	.empty-icon { font-size: 40px; }
	.empty-state h2 { font-size: 18px; font-weight: 600; color: #374151; }
	.empty-state p { font-size: 14px; color: #6B7280; }
	@keyframes spin { to { transform: rotate(360deg); } }

	@media (max-width: 600px) {
		.loc-rings { display: none; }
		.loc-card-inner { grid-template-columns: auto 1fr; }
	}
</style>
