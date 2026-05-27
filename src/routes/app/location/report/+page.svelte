<script lang="ts">
	/**
	 * RE² Location Report Page
	 *
	 * Shareable/printable analysis report for a scored location.
	 * Reads from: re2_session (locationIQ, analyzedAddress, sixScores, bizType, fitSubScores)
	 *             re2_launchpad (businessType, differentiator, priceLevel)
	 *             URL param: addr (optional, used when linking to a specific address)
	 *
	 * Actions: Print/Save PDF, Copy share link, Back to Analysis
	 *
	 * Navigation: /app/location/report?addr=<encoded-address>
	 * Accessible from: location page header "Export Report" button (to be added)
	 */
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { writeCanonicalConcept } from '$lib/constants/businessTypeNormalizer';
	import { getScoreColor } from '$lib/constants/scoreUtils';
	import { fitGrade, fitTierLabel, fitMeaningShort, fitNextTier } from '$lib/utils/decision-engine';
	import { getConceptLabel } from '$lib/constants/concepts';

	// ── State ──
	let address = $state('');
	let locationIQ = $state(0);
	let fitIQ = $state(0);
	let visionIQ = $state(0);
	// BR-UX-10: canonical grade / tier / meaning / nextTier via decision-engine.
	// The report's primary score is fitIQ (falls back to locationIQ if fit hasn't run yet).
	const reportScore = $derived(fitIQ || locationIQ);
	const reportGrade = $derived(reportScore > 0 ? fitGrade(reportScore) : '');
	const reportTier = $derived(reportScore > 0 ? fitTierLabel(reportScore) : '');
	const reportMeaning = $derived(reportScore > 0 ? fitMeaningShort(reportScore) : '');
	const reportNext = $derived(reportScore > 0 ? fitNextTier(reportScore) : null);
	let sixScores = $state<Record<string, number>>({});
	let bizType = $state('');
	let differentiator = $state('');
	let priceLevel = $state('');
	let neighborhood = $state('');
	let scoredAt = $state('');
	let isLoading = $state(true);
	let hasData = $state(false);
	let copySuccess = $state(false);
	// RPT-01: DOF property tax profile
	let propertyTax = $state<any>(null);

	// Grade helpers — BR-UX-10: single source of truth is decision-engine.fitGrade.
	// getGrade / getGradeClass delegate to it so the report never drifts from the
	// Location Score hero vocabulary (A/B/C/D/F, 75/65/50/40 thresholds).
	function getGrade(score: number): string { return score > 0 ? fitGrade(score) : '—'; }
	function getGradeClass(score: number): string {
		const g = score > 0 ? fitGrade(score) : '';
		return g ? `grade-${g.toLowerCase()}` : '';
	}

	// Color helper (was missing, now consistent with all other pages)
	const _getScoreColor = getScoreColor;

	// #33: friendlyBizType replaced by getConceptLabel from src/lib/constants/concepts.ts
	function friendlyBizType(raw: string): string {
		return getConceptLabel(raw);
	}

	function priceLevelLabel(pl: string): string {
		const map: Record<string, string> = {
			'1': '$ Budget', '2': '$$ Moderate', '3': '$$$ Upscale', '4': '$$$$ Premium'
		};
		return map[pl] || '';
	}

	function ringOffset(score: number, r = 32): number {
		const circ = 2 * Math.PI * r;
		return circ * (1 - score / 100);
	}

	function ringColor(score: number): string {
		if (score >= 65) return '#34C759';
		if (score >= 45) return '#0071E3';
		if (score >= 35) return '#FF9500';
		return '#FF3B30';
	}

	function formatDate(iso: string): string {
		if (!iso) return '';
		try {
			return new Date(parseInt(iso)).toLocaleDateString('en-US', {
				month: 'long', day: 'numeric', year: 'numeric'
			});
		} catch { return ''; }
	}

	// Six-index labels for the report
	const SIX_LABELS: Record<string, string> = {
		market_proof: 'Market Proof',
		accessibility: 'Accessibility',
		vibrancy: 'Foot Traffic',
		demographics: 'Demographics',
		competition: 'Competition',
		price_income_fit: 'Price Fit',
		transit: 'Transit',
		safety: 'Safety',
		neighborhoodHealth: 'Neighborhood Health',
		survivalRate: 'Survival Rate',
	};

	onMount(() => {
		const urlAddr = page.url.searchParams.get('addr');

		try {
			const sess = JSON.parse(localStorage.getItem('re2_session') || '{}');
			const lp = JSON.parse(localStorage.getItem('re2_launchpad') || '{}');

			address = urlAddr || sess.analyzedAddress || '';
			locationIQ = sess.locationIQ || 0;
			fitIQ = sess.fitScore || 0;
			visionIQ = sess.serverVisionIQ || 0;
			sixScores = sess.fitSubScores || sess.sixScores || {};
			bizType = writeCanonicalConcept(lp.businessType || sess.bizType || '');
			differentiator = lp.differentiator || lp.visionStatement || '';
			priceLevel = lp.priceLevel || sess.priceLevel || '';
			neighborhood = sess.neighborhood || sess.primaryHood || '';
			scoredAt = sess.scoredAt || '';
			propertyTax = sess.propertyTax || null;

			hasData = !!(address && locationIQ > 0);
		} catch {}

		isLoading = false;

		// If no address at all → redirect to location page
		if (!address) goto('/app/location');
	});

	async function copyShareLink() {
		try {
			const url = window.location.href;
			await navigator.clipboard.writeText(url);
			copySuccess = true;
			setTimeout(() => copySuccess = false, 2500);
		} catch {}
	}

	function handlePrint() {
		window.print();
	}

</script>

<svelte:head>
	<title>RE² — Location Report{address ? ` · ${address}` : ''}</title>
	<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="report-page">

	<!-- ═══ TOP NAV ═══ -->
	<nav class="topbar">
		<div class="topbar-left">
			<a href="/app/welcome-back" class="logo">RE<sup>2</sup></a>
			{#if address}
				<div class="sep"></div>
				<span class="addr">{address}</span>
				<div class="sep"></div>
				<span class="page-label">Report</span>
			{/if}
		</div>
		<div class="topbar-right">
			<a href="/app/location{address ? `?addr=${encodeURIComponent(address)}` : ''}" class="btn-ghost">← Back to Analysis</a>
		</div>
	</nav>

	{#if isLoading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading report…</p>
		</div>
	{:else if !hasData}
		<div class="empty-state">
			<div class="empty-icon">📊</div>
			<h2>No analysis found</h2>
			<p>Score a location first, then come back to generate your report.</p>
			<a href="/app/onboarding" class="btn-teal">Score a Location</a>
		</div>
	{:else}
		<!-- ═══ REPORT ═══ -->
		<div class="report-wrap" id="report-content">

			<!-- HEADER -->
			<div class="report-header">
				<div class="report-brand">
					<span class="brand-logo">RE<sup>2</sup></span>
					<span class="brand-tag">Location Intelligence Report</span>
				</div>
				<div class="report-address">{address}</div>
				<div class="report-meta">
					{#if scoredAt}Analyzed {formatDate(scoredAt)} · {/if}{propertyTax ? 21 : 20} data sources
				</div>
				<div class="report-pills">
					{#if bizType}<span class="concept-pill">{friendlyBizType(bizType)}</span>{/if}
					{#if priceLevel}<span class="concept-pill secondary">{priceLevelLabel(priceLevel)}</span>{/if}
					{#if reportGrade}
						<span class="verdict-badge grade-{reportGrade.toLowerCase()}">Grade {reportGrade} · {reportTier}</span>
					{/if}
				</div>
				{#if reportMeaning}
					<div class="report-meaning"><strong>{reportScore}/100 — {reportTier}.</strong> {reportMeaning}</div>
				{/if}
				{#if reportNext && reportNext.points > 0 && reportNext.points <= 15}
					<div class="report-nexttier">You're <strong>{reportNext.points} {reportNext.points === 1 ? 'point' : 'points'}</strong> from <strong>{reportNext.label}</strong> territory.</div>
				{/if}
			</div>

			<!-- SCORE TRIO -->
			<section class="section">
				<div class="section-title">Score Summary</div>
				<div class="score-trio">
					<!-- Fit IQ -->
					<div class="score-card primary">
						<div class="score-label">Your Score</div>
						<div class="ring-wrap">
							<svg width="88" height="88" viewBox="0 0 88 88" style="transform:rotate(-90deg)">
								<circle cx="44" cy="44" r="36" fill="none" stroke="#e5e7eb" stroke-width="9"/>
								<circle cx="44" cy="44" r="36" fill="none" stroke="{ringColor(fitIQ || locationIQ)}" stroke-width="9"
									stroke-dasharray="{2 * Math.PI * 36}" stroke-dashoffset="{ringOffset(fitIQ || locationIQ, 36)}"
									stroke-linecap="round"/>
							</svg>
							<span class="ring-val">{fitIQ || locationIQ}</span>
						</div>
						<div class="score-grade {getGradeClass(fitIQ || locationIQ)}">{getGrade(fitIQ || locationIQ)}</div>
						<div class="score-sub">Concept ↔ Location fit</div>
					</div>
					<!-- Location IQ -->
					<div class="score-card">
						<div class="score-label">Block Score</div>
						<div class="ring-wrap">
							<svg width="88" height="88" viewBox="0 0 88 88" style="transform:rotate(-90deg)">
								<circle cx="44" cy="44" r="36" fill="none" stroke="#e5e7eb" stroke-width="9"/>
								<circle cx="44" cy="44" r="36" fill="none" stroke="{ringColor(locationIQ)}" stroke-width="9"
									stroke-dasharray="{2 * Math.PI * 36}" stroke-dashoffset="{ringOffset(locationIQ, 36)}"
									stroke-linecap="round"/>
							</svg>
							<span class="ring-val">{locationIQ}</span>
						</div>
						<div class="score-grade {getGradeClass(locationIQ)}">{getGrade(locationIQ)}</div>
						<div class="score-sub">This block</div>
					</div>
					<!-- Vision IQ -->
					<div class="score-card">
						<div class="score-label">Concept Detail</div>
						<div class="ring-wrap">
							<svg width="88" height="88" viewBox="0 0 88 88" style="transform:rotate(-90deg)">
								<circle cx="44" cy="44" r="36" fill="none" stroke="#e5e7eb" stroke-width="9"/>
								{#if visionIQ > 0}
									<circle cx="44" cy="44" r="36" fill="none" stroke="{ringColor(visionIQ)}" stroke-width="9"
										stroke-dasharray="{2 * Math.PI * 36}" stroke-dashoffset="{ringOffset(visionIQ, 36)}"
										stroke-linecap="round"/>
								{:else}
									<circle cx="44" cy="44" r="36" fill="none" stroke="#e5e7eb" stroke-width="9"
										stroke-dasharray="4 8" stroke-linecap="round"/>
								{/if}
							</svg>
							<span class="ring-val" style="font-size:{visionIQ > 0 ? '20px' : '14px'}">{visionIQ > 0 ? visionIQ : 'PRELIM'}</span>
						</div>
						<div class="score-grade {visionIQ > 0 ? getGradeClass(visionIQ) : ''}">{visionIQ > 0 ? getGrade(visionIQ) : '—'}</div>
						<div class="score-sub">Your concept</div>
					</div>
				</div>
			</section>

			<!-- SIX INDEX BREAKDOWN -->
			{#if Object.keys(sixScores).length > 0}
				<section class="section">
					<div class="section-title">Signal Breakdown</div>
					<div class="six-grid">
						{#each Object.entries(sixScores).filter(([k]) => SIX_LABELS[k]) as [key, val]}
							<div class="six-item">
								<div class="six-label">{SIX_LABELS[key] || key}</div>
								<div class="six-bar-wrap">
									<div class="six-bar" style="width:{Math.min(val, 100)}%;background:{ringColor(val)}"></div>
								</div>
								<div class="six-score">{Math.round(val)}</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- RPT-01: PROPERTY TAX PROFILE -->
			{#if propertyTax && propertyTax.annualTax > 0}
				<section class="section">
					<div class="section-title">Property Tax Profile</div>
					<div class="tax-grid">

						<div class="tax-card">
							<div class="tax-num">${Math.round(propertyTax.annualTax).toLocaleString()}</div>
							<div class="tax-label">Annual Property Tax</div>
							<div class="tax-note">Most recent tax year on record</div>
						</div>

						<div class="tax-card">
							<div class="tax-num">${Math.round(propertyTax.monthlyTaxPassThrough).toLocaleString()}<span class="tax-mo">/mo</span></div>
							<div class="tax-label">Estimated Monthly Pass-Through</div>
							<div class="tax-note">Your pro-rated share of annual tax</div>
						</div>

						<div class="tax-card">
							<div class="tax-esc-badge tax-esc-{(propertyTax.escalationRisk || 'LOW').toLowerCase()}">
								{propertyTax.escalationRisk || 'LOW'} RISK
							</div>
							<div class="tax-label">5-Year Escalation</div>
							<div class="tax-note">+{Math.round((propertyTax.escalation5yr || 0) * 100)}% total · {Math.round((propertyTax.escalationAnnual || 0) * 100)}%/yr avg</div>
						</div>

					</div>

					{#if propertyTax.hasTaxLien}
						<div class="tax-alert tax-alert--lien">
							<strong>⚠ Outstanding Tax Lien</strong> — This building has unpaid property taxes. Consult a real estate attorney before signing any lease. Building ownership may be at risk.
						</div>
					{/if}

					{#if propertyTax.isCoop}
						<div class="tax-alert tax-alert--coop">
							<strong>🏢 Co-op Unit</strong> — You'll negotiate with the co-op board, not a commercial landlord. Confirm subletting rights and board approval process before proceeding.
						</div>
					{/if}

					{#if propertyTax.mortgageContext === 'high_leverage'}
						<div class="tax-note-line">
							<strong>Mortgage:</strong> Highly leveraged owner with a recent purchase. The landlord may be under financial pressure to maintain high rents — negotiate escalation caps aggressively.
						</div>
					{:else if propertyTax.mortgageContext === 'no_mortgage' && propertyTax.yearsHeld > 10}
						<div class="tax-note-line">
							<strong>Mortgage:</strong> Long-held building with low or no mortgage — landlord has pricing flexibility. You're in a strong negotiation position.
						</div>
					{/if}

				</section>
			{/if}

			<!-- DIFFERENTIATOR -->
			{#if differentiator}
				<section class="section">
					<div class="section-title">Your Concept Differentiator</div>
					<div class="differentiator-card">
						<p class="diff-quote">"{differentiator}"</p>
					</div>
				</section>
			{/if}

			<!-- FOOTER -->
			<div class="report-footer">
				Powered by RE² · {propertyTax ? 21 : 20} data sources · resquared.io<br>
				This report is for informational purposes only. Consult a commercial real estate professional before signing any lease.
			</div>
		</div><!-- /report-wrap -->

		<!-- ═══ STICKY ACTIONS BAR ═══ -->
		<div class="actions-bar">
			<div class="actions-left">Share this analysis with your landlord, partner, or investor.</div>
			<div class="actions-right">
				<button class="btn-ghost" onclick={handlePrint}>🖨 Print / Save PDF</button>
				<button class="btn-ghost" onclick={copyShareLink}>
					{copySuccess ? '✓ Copied!' : '🔗 Copy Link'}
				</button>
				<a href="/app/location{address ? `?addr=${encodeURIComponent(address)}` : ''}" class="btn-dark">← Analysis</a>
				<a href="/app/onboarding" class="btn-teal">Score Another</a>
			</div>
		</div>
	{/if}

</div><!-- /report-page -->

<style>
	* { box-sizing: border-box; }
	.report-page { min-height: 100vh; background: #f5f0e8; font-family: -apple-system, BlinkMacSystemFont, 'DM Sans', sans-serif; }

	/* ── NAV ── */
	.topbar {
		display: flex; align-items: center; justify-content: space-between;
		padding: 0 24px; height: 56px;
		background: #f5f0e8; border-bottom: 1px solid #e0ddd7;
		position: sticky; top: 0; z-index: 100;
	}
	.topbar-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
	.logo { font-family: Georgia, serif; font-size: 17px; font-weight: 700; color: #111827; text-decoration: none; }
	.logo sup { color: #0D7C6E; font-size: 10px; }
	.sep { width: 1px; height: 18px; background: #E5E7EB; }
	.addr { font-size: 13px; color: #374151; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
	.page-label { font-size: 12px; color: #9CA3AF; }
	.topbar-right { display: flex; gap: 10px; flex-shrink: 0; }
	.btn-ghost { font-size: 12px; padding: 5px 12px; border-radius: 6px; border: 1px solid #E5E7EB; background: white; color: #374151; cursor: pointer; text-decoration: none; white-space: nowrap; }
	.btn-teal { font-size: 12px; padding: 5px 14px; border-radius: 6px; background: #0D7C6E; color: white; cursor: pointer; font-weight: 600; text-decoration: none; border: none; white-space: nowrap; }
	.btn-dark { font-size: 12px; padding: 5px 14px; border-radius: 6px; background: #111827; color: white; cursor: pointer; font-weight: 600; text-decoration: none; border: none; white-space: nowrap; }

	/* ── REPORT ── */
	.report-wrap { max-width: 800px; margin: 0 auto; padding: 40px 24px 100px; }

	.report-header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e0ddd7; }
	.report-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
	.brand-logo { font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #1e3a2a; }
	.brand-logo sup { color: #0D7C6E; font-size: 10px; }
	.brand-tag { font-size: 11px; color: #6B7280; letter-spacing: 0.05em; text-transform: uppercase; }
	.report-address { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 4px; }
	.report-meta { font-size: 13px; color: #6B7280; }
	.report-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-items: center; }
	.concept-pill { display: inline-flex; align-items: center; background: #e8f0ea; padding: 4px 10px; border-radius: 20px; font-size: 12px; color: #1e3a2a; font-weight: 600; }
	.concept-pill.secondary { background: #f0f4ff; color: #1e3a8a; }
	.verdict-badge { display: inline-flex; align-items: center; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
	/* BR-UX-10: grade-based verdict pill styling (1:1 with fitTierLabel thresholds) */
	.verdict-badge.grade-a { background: #d1fae5; color: #065f46; }
	.verdict-badge.grade-b { background: #e0f2fe; color: #075985; }
	.verdict-badge.grade-c { background: #fef3c7; color: #92400e; }
	.verdict-badge.grade-d { background: #ffedd5; color: #9a3412; }
	.verdict-badge.grade-f { background: #fee2e2; color: #991b1b; }
	/* Report-level meaning + next-tier lines (BR-UX-06 + BR-UX-01) */
	.report-meaning { font-size: 14px; color: #1f2937; margin-top: 12px; line-height: 1.55; max-width: 640px; }
	.report-meaning strong { color: #111827; }
	.report-nexttier { font-size: 13px; color: #4b5563; margin-top: 6px; }
	.report-nexttier strong { color: #111827; }

	/* ── SECTION ── */
	.section { margin-bottom: 28px; }
	.section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #6B7280; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e8e4dc; }

	/* ── SCORE TRIO ── */
	.score-trio { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
	.score-card { background: white; border-radius: 12px; padding: 20px 14px; border: 1px solid #e0ddd7; text-align: center; }
	.score-card.primary { border: 2px solid #1e3a2a; }
	.score-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6B7280; margin-bottom: 8px; }
	.ring-wrap { position: relative; width: 88px; height: 88px; margin: 0 auto 8px; }
	.ring-val { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 20px; font-weight: 700; color: #111827; }
	.score-grade { font-size: 14px; font-weight: 700; }
	/* BR-UX-10: grade ring letter colors — 1:1 with fitGrade thresholds */
	.score-grade.grade-a { color: #15803d; }
	.score-grade.grade-b { color: #0369a1; }
	.score-grade.grade-c { color: #d97706; }
	.score-grade.grade-d { color: #c2410c; }
	.score-grade.grade-f { color: #b91c1c; }
	.score-sub { font-size: 11px; color: #6B7280; margin-top: 4px; }

	/* ── SIX INDEX ── */
	.six-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	.six-item { background: white; border-radius: 8px; padding: 12px 14px; border: 1px solid #e0ddd7; display: flex; align-items: center; gap: 10px; }
	.six-label { font-size: 12px; color: #374151; font-weight: 500; min-width: 110px; }
	.six-bar-wrap { flex: 1; height: 6px; background: #F3F4F6; border-radius: 3px; overflow: hidden; }
	.six-bar { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
	.six-score { font-size: 12px; font-weight: 600; color: #374151; min-width: 28px; text-align: right; }

	/* ── PROPERTY TAX ── */
	.tax-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 14px; }
	@media (max-width: 600px) { .tax-grid { grid-template-columns: 1fr; } }
	.tax-card { background: white; border: 1px solid #e0ddd7; border-radius: 10px; padding: 16px; }
	.tax-num { font-size: 26px; font-weight: 800; color: #1e3a2a; letter-spacing: -0.02em; line-height: 1; }
	.tax-mo { font-size: 13px; font-weight: 500; opacity: 0.55; }
	.tax-label { font-size: 12px; font-weight: 700; color: #374151; margin-top: 4px; }
	.tax-note { font-size: 11px; color: #9ca3af; margin-top: 2px; }
	.tax-esc-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; margin-bottom: 6px; }
	.tax-esc-low { background: #d1fae5; color: #065f46; }
	.tax-esc-moderate { background: #fef3c7; color: #92400e; }
	.tax-esc-high { background: #fee2e2; color: #991b1b; }
	.tax-esc-critical { background: #7f1d1d; color: #fff; }
	.tax-alert { border-radius: 8px; padding: 12px 14px; font-size: 13px; line-height: 1.5; margin-bottom: 10px; }
	.tax-alert--lien { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }
	.tax-alert--coop { background: #eff6ff; border: 1px solid #93c5fd; color: #1e40af; }
	.tax-note-line { font-size: 12px; color: #6b7280; line-height: 1.5; padding: 8px 0; border-top: 1px solid #f3f4f6; }

	/* ── DIFFERENTIATOR ── */
	.differentiator-card { background: white; border-radius: 10px; padding: 18px 20px; border: 1px solid #e0ddd7; border-left: 4px solid #0D7C6E; }
	.diff-quote { font-size: 14px; color: #374151; line-height: 1.6; font-style: italic; }

	/* ── FOOTER ── */
	.report-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0ddd7; font-size: 11px; color: #9CA3AF; text-align: center; line-height: 1.6; }

	/* ── ACTIONS BAR ── */
	.actions-bar {
		position: fixed; bottom: 0; left: 0; right: 0;
		background: white; border-top: 1px solid #e0ddd7;
		padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
		flex-wrap: wrap;
	}
	.actions-left { font-size: 13px; color: #6B7280; }
	.actions-right { display: flex; gap: 8px; flex-wrap: wrap; }

	/* ── LOADING / EMPTY ── */
	.loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 14px; text-align: center; padding: 24px; }
	.spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: #0D7C6E; border-radius: 50%; animation: spin 0.7s linear infinite; }
	.empty-icon { font-size: 40px; }
	.empty-state h2 { font-size: 18px; font-weight: 600; color: #374151; }
	.empty-state p { font-size: 14px; color: #6B7280; }
	@keyframes spin { to { transform: rotate(360deg); } }

	/* ── PRINT ── */
	@media print {
		.actions-bar { display: none; }
		.topbar { display: none; }
		.report-page { background: white; }
		.report-wrap { max-width: 100%; }
	}
</style>
