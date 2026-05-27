<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { apiFetch } from '$lib/api';

	const addr = $derived(page.url.searchParams.get('addr') ?? '');

	// UX-01: Consistent distance formatting (matches MapView/LocationMap fmtDist).
	// Raw dist arrives in meters from Overpass/Yelp/Foursquare (or km if <20).
	function fmtDist(d: number | undefined): string {
		if (!d || d <= 0) return '';
		const meters = d < 20 ? Math.round(d * 1000) : d;
		if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
		return `${(meters / 1000).toFixed(1)} km`;
	}

	let address = $state('');
	let neighborhood = $state('');
	let bizType = $state('specialty_coffee');
	let bizTypeLabel = $state('Specialty Coffee');
	let hasSession = $state(false);

	// Real data from session / intel
	let transitRiders = $state<number | null>(null);
	let competitorPriceAvg = $state<number | null>(null);
	let ritualDensity = $state<number | null>(null);
	let competitors = $state<Array<{ name: string; dist?: number; rating?: number; price?: string; type?: string }>>([]);
	let ritualPOIs = $state<{ coffee: number; breakfast: number; gym: number; pharmacy: number; total: number } | null>(null);

	// Derived extrapolation chain
	/* 04.21.2026 Deprecated: Frontend foot traffic math leak
	const morningPeakCoeff = 0.32;
	const coffeeCaptureCoeff = 0.83;
	const captureRate300m = 0.20;
	const pedMtaBlend = 0.60; // 60% MTA-derived in blend

	const mtaMorningPeak = $derived(transitRiders ? Math.round(transitRiders * morningPeakCoeff) : null);
	const coffeeWindow = $derived(mtaMorningPeak ? Math.round(mtaMorningPeak * coffeeCaptureCoeff) : null);
	const mtaDerived = $derived(coffeeWindow ? Math.round(coffeeWindow * captureRate300m) : null);
	const estimatedMorningWalkbys = $derived(mtaDerived ? Math.round(mtaDerived / pedMtaBlend) : null);
	*/

	// Reading directly from backend payload
	let mtaMorningPeak = $state<number | null>(null);
	let coffeeWindow = $state<number | null>(null);
	let mtaDerived = $state<number | null>(null);
	let estimatedMorningWalkbys = $state<number | null>(null);

	onMount(() => {
		try {
			const loc = JSON.parse(localStorage.getItem('re2_selected_location') || '{}');
			address = loc.addr || '';
			neighborhood = loc.neighborhood || '';
		} catch {}
		try {
			const session = JSON.parse(localStorage.getItem('re2_session') || '{}');
			hasSession = !!(session.analyzedAddress || session.locationIQ);
			bizType = session.visionBizType || session.bizType || session.businessType || 'specialty_coffee';
			// Load competitors from session cache
			if (session.competitors) competitors = session.competitors;
		} catch {}
		try {
			const intel = JSON.parse(localStorage.getItem('re2_location_intel') || '{}');
			if (intel.transitRiders) transitRiders = intel.transitRiders;
			if (intel.segmentInsight?.transitRiders) transitRiders = intel.segmentInsight.transitRiders;
			if (intel.segmentInsight?.competitorPriceAvg) competitorPriceAvg = intel.segmentInsight.competitorPriceAvg;
			if (intel.segmentInsight?.ritualDensity) ritualDensity = intel.segmentInsight.ritualDensity;
			if (intel.segmentInsight?.ritualPOIs) ritualPOIs = intel.segmentInsight.ritualPOIs;
			if (intel.segmentInsight?.coffeeChain) {
				mtaMorningPeak = intel.segmentInsight.coffeeChain.mtaMorningPeak;
				coffeeWindow = intel.segmentInsight.coffeeChain.coffeeWindow;
				mtaDerived = intel.segmentInsight.coffeeChain.mtaDerived;
				estimatedMorningWalkbys = intel.segmentInsight.coffeeChain.estimatedMorningWalkbys;
			}
		} catch {}
		try {
			// Try loading competitors from searchResult stored in session
			const sr = JSON.parse(localStorage.getItem('re2_search_result') || '{}');
			if (sr.cafes) competitors = [...competitors, ...sr.cafes.slice(0, 6).map((c: Record<string, unknown>) => ({ name: String(c.name || 'Coffee Shop'), dist: Number(c.dist || 0), rating: Number(c.rating || 0), price: String(c.price || '$$'), type: 'Coffee' }))];
		} catch {}
		const labelMap: Record<string, string> = {
			specialty_coffee: 'Specialty Coffee', coffee_shop: 'Coffee Shop', restaurant: 'Restaurant',
			fast_casual: 'Fast Casual', gym: 'Fitness Studio', fitness: 'Fitness Studio', bar: 'Bar / Nightlife'
		};
		bizTypeLabel = labelMap[bizType] ?? 'Your Concept';
	});
</script>

<svelte:head>
	<title>RE² — Segment Intelligence</title>
</svelte:head>

<div class="brain-page">
	<!-- TOOL STRIP -->
	<div class="tools-strip">
		<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Overview</a>
		<div class="tools-sep"></div>
		<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab back-tab">← Score</a>
		<div class="tools-sep"></div>
		<a href="/app/brain/compare{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Compare</a>
		<a href="/app/brain/success-map{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Success Map</a>
		<a href="/app/brain/daypart{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Daypart Traffic</a>
		<a href="/app/brain/segments{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab active">Segment Intel</a>
		<a href="/app/brain/street{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Street View</a>
		<a href="/app/brain/transparency{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Score Breakdown</a>
	</div>
	<!-- PAGE BODY -->
	<div class="page-body">
		{#if !hasSession}
			<div class="empty-state">
				<div class="empty-state-icon">📍</div>
				<h2>No Location Scored Yet</h2>
				<p>Score a location first to see this intelligence.</p>
				<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="empty-state-cta">Score a Location</a>
			</div>
		{:else}
			<div class="page-title-row">
				<span class="page-label">Segment Intelligence</span>
			</div>
			<div class="page-title">Segment Intelligence — Show the Math</div>
			<div class="page-desc">Hero metrics with the full extrapolation chain visible. See how transit data becomes business-specific estimates, plus competitor pricing and daily ritual density.</div>

			<div class="segment-frame">
			<!-- Hero metrics row -->
			<div class="segment-hero-row">
				<div class="segment-hero-card">
					<div class="hero-icon">🚶</div>
					{#if estimatedMorningWalkbys}
						<div class="hero-value">{estimatedMorningWalkbys.toLocaleString()} <span class="hero-unit">est.</span></div>
					{:else if transitRiders}
						<div class="hero-value">—</div>
					{:else}
						<div class="hero-value">—</div>
					{/if}
					<div class="hero-label">Morning Rush Walk-Bys (7:30–10 AM)</div>
					<span class="conf-badge conf-mod">Moderate Confidence · MTA estimate</span>
				</div>
				<div class="segment-hero-card">
					<div class="hero-icon">💰</div>
					{#if competitorPriceAvg && competitorPriceAvg >= 1}
						<div class="hero-value">${competitorPriceAvg.toFixed(2)} <span class="hero-unit">avg</span></div>
					{:else}
						<div class="hero-value">—</div>
					{/if}
					<div class="hero-label">Competitor Price (nearby {bizTypeLabel}s)</div>
					<span class="conf-badge conf-high">{competitorPriceAvg && competitorPriceAvg >= 1 ? 'High Confidence · Foursquare + Google' : 'Not yet loaded'}</span>
				</div>
				<div class="segment-hero-card">
					<div class="hero-icon">🔄</div>
					{#if ritualDensity}
						<div class="hero-value">{Math.round(ritualDensity)} <span class="hero-unit">/100</span></div>
					{:else}
						<div class="hero-value">—</div>
					{/if}
					<div class="hero-label">Daily Ritual Density (habitual-visit POIs)</div>
					<span class="conf-badge conf-high">{ritualDensity ? 'High Confidence · Google Places' : 'Not yet loaded'}</span>
				</div>
			</div>

			<!-- Extrapolation chain -->
			{#if transitRiders && mtaMorningPeak}
				<div class="chain-section">
					<div class="chain-title">How morning walk-by estimate is computed</div>
					<div class="chain-steps">
						<div class="chain-step">
							<span class="step-num">{transitRiders.toLocaleString()}</span>
							<span class="step-desc">daily MTA riders</span>
						</div>
						<span class="chain-arrow">→</span>
						<div class="chain-step">
							<span class="step-op">× {Math.round(morningPeakCoeff * 100)}%</span>
							<span class="step-desc">morning peak</span>
						</div>
						<span class="chain-arrow">→</span>
						<div class="chain-step">
							<span class="step-num">{mtaMorningPeak.toLocaleString()}</span>
							<span class="step-desc"></span>
						</div>
						{#if coffeeWindow}
							<span class="chain-arrow">→</span>
							<div class="chain-step">
								<span class="step-op">× {Math.round(coffeeCaptureCoeff * 100)}%</span>
								<span class="step-desc">coffee window</span>
							</div>
							<span class="chain-arrow">→</span>
							<div class="chain-step">
								<span class="step-num">{coffeeWindow.toLocaleString()}</span>
								<span class="step-desc"></span>
							</div>
						{/if}
						{#if mtaDerived}
							<span class="chain-arrow">→</span>
							<div class="chain-step">
								<span class="step-op">× {Math.round(captureRate300m * 100)}%</span>
								<span class="step-desc">capture rate (300m)</span>
							</div>
							<span class="chain-arrow">→</span>
							<div class="chain-step highlight">
								<span class="step-num green">{mtaDerived.toLocaleString()}</span>
								<span class="step-desc">MTA-derived</span>
							</div>
							{#if estimatedMorningWalkbys}
								<span class="chain-arrow">→</span>
								<div class="chain-step">
									<span class="step-op">÷ {Math.round(pedMtaBlend * 100)}%</span>
									<span class="step-desc">MTA share of blend</span>
								</div>
								<span class="chain-arrow">=</span>
								<div class="chain-step result">
									<span class="step-num green">{estimatedMorningWalkbys.toLocaleString()}</span>
									<span class="step-desc">est. morning walk-bys</span>
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{:else if !transitRiders}
				<div class="no-chain">
					<span>Analyze a location to see the extrapolation chain with real MTA data.</span>
				</div>
			{/if}

			<!-- Competitor blend -->
			<div class="comp-blend">
				<div class="comp-blend-card">
					<div class="comp-blend-title">Nearby Competitors (Foursquare + Google)</div>
					{#if competitors.length > 0}
						{#each competitors.slice(0, 6) as comp}
							<div class="comp-row">
								<span class="comp-name">{comp.name}</span>
								<span class="comp-meta">
									{#if comp.rating && Number(comp.rating) > 0}{Number(comp.rating).toFixed(1)}★ · {/if}
									{#if comp.price && comp.price !== '0' && comp.price !== '$0.00' && comp.price !== '0.00' && String(comp.price) !== '0'}{comp.price} · {/if}
									{#if comp.dist && Number(comp.dist) > 0}{fmtDist(Number(comp.dist))}{/if}
								</span>
							</div>
						{/each}
					{:else}
						<div class="comp-empty">Competitor data will load after location analysis.</div>
					{/if}
				</div>
				<div class="comp-blend-card">
					<div class="comp-blend-title">Daily Ritual POI Breakdown</div>
					{#if ritualPOIs}
						<div class="comp-row"><span>☕ Coffee Shops</span><span class="comp-count">{ritualPOIs.coffee ?? 0}</span></div>
						<div class="comp-row"><span>🍳 Breakfast Spots</span><span class="comp-count">{ritualPOIs.breakfast ?? 0}</span></div>
						<div class="comp-row"><span>💪 Gyms / Studios</span><span class="comp-count">{ritualPOIs.gym ?? 0}</span></div>
						<div class="comp-row"><span>💊 Pharmacies</span><span class="comp-count">{ritualPOIs.pharmacy ?? 0}</span></div>
						<div class="comp-row total-row"><span>Total Ritual POIs</span><span class="comp-count green">{ritualPOIs.total ?? 0}</span></div>
					{:else}
						<div class="comp-empty">POI density will load after location analysis.</div>
					{/if}
				</div>
			</div>
		</div>
		{/if}
	</div>
</div>

<style>
	:root {
		--sage: #4a7c5c;
		--hot-pink: #e8345a;
		--deep-green: #1a3a2a;
		--marigold: #e8a838;
		--accent: var(--sage);
		--bg: #faf7f2;
		--surface: #ffffff;
		--text: #2c2c2c;
		--text-light: #666666;
		--border: #e8e2d8;
		--sage-light: #e8f2ec;
		--sage-bg: rgba(74, 124, 92, 0.08);
	}
	.brain-page { min-height: 100vh; background: var(--bg); font-family: 'DM Sans', -apple-system, sans-serif; color: var(--text); }
	.topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: rgba(250,247,242,0.96); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); height: 56px; position: sticky; top: 0; z-index: 200; }
	.topbar-left { display: flex; align-items: center; gap: 16px; }
	.logo { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 400; color: var(--text); text-decoration: none; letter-spacing: -0.3px; }
	.logo sup { color: var(--hot-pink); font-size: 11px; }
	.sep { width: 1px; height: 20px; background: var(--border); }
	.addr { font-size: 13px; color: var(--text-light); font-weight: 600; }
	.addr-sub { font-size: 11px; color: var(--text-light); margin-left: 6px; font-weight: 400; }
	.addr-empty { font-style: italic; opacity: 0.5; }
	.topbar-right { display: flex; gap: 8px; align-items: center; }
	.tb-btn { font-size: 12px; padding: 6px 14px; border-radius: 8px; text-decoration: none; border: 1px solid var(--border); color: var(--text-light); background: var(--surface); cursor: pointer; font-family: inherit; font-weight: 500; transition: all 0.2s; }
	.tb-btn.pri { background: var(--deep-green); color: white; border-color: var(--deep-green); font-weight: 600; }
	.tb-btn:hover { border-color: var(--sage); }
	.tb-btn.pri:hover { background: #0f2218; }
	.tools-strip { display: flex; align-items: center; gap: 2px; padding: 0 14px; background: var(--surface); border-bottom: 1px solid var(--border); height: 42px; overflow-x: auto; flex-shrink: 0; position: sticky; top: 56px; z-index: 190; }
	.tools-strip::-webkit-scrollbar { display: none; }
	.tool-tab { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; color: var(--text-light); text-decoration: none; white-space: nowrap; transition: all 0.15s; border: 1px solid transparent; font-family: inherit; }
	.tool-tab:hover { background: #f5f0e8; color: var(--text); }
	.tool-tab.active { background: var(--deep-green); color: white; }
	.tools-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; flex-shrink: 0; }
	.page-body { max-width: 1100px; margin: 0 auto; padding: 28px 24px 80px; }
	.page-title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
	.page-label { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--sage); background: var(--sage-bg); padding: 3px 10px; border-radius: 4px; }
	.page-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 400; letter-spacing: -0.3px; color: var(--text); margin-bottom: 4px; }
	.page-desc { color: var(--text-light); font-size: 13px; margin-bottom: 24px; max-width: 700px; line-height: 1.5; }

	.segment-frame { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
	.segment-hero-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--border); }
	.segment-hero-card { background: var(--surface); padding: 24px 20px; }
	.hero-icon { font-size: 24px; margin-bottom: 8px; }
	.hero-value { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 400; letter-spacing: -0.5px; }
	.hero-unit { font-size: 13px; color: var(--text-light); font-weight: 500; }
	.hero-label { font-size: 12px; color: var(--text-light); margin-top: 4px; line-height: 1.4; }
	.conf-badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 3px; margin-top: 6px; }
	.conf-high { background: var(--sage-bg); color: var(--sage); }
	.conf-mod { background: rgba(232,168,56,0.1); color: var(--marigold); }

	.chain-section { padding: 20px 24px; border-top: 1px solid var(--border); }
	.chain-title { font-size: 12px; font-weight: 700; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; }
	.chain-steps { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; row-gap: 8px; }
	.chain-step { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 12px; background: #f5f0e8; border-radius: 8px; font-size: 12px; font-weight: 600; min-width: 64px; }
	.chain-step.highlight { background: var(--sage-bg); }
	.chain-step.result { background: var(--sage-bg); border: 1px solid rgba(74,124,92,0.2); }
	.chain-arrow { color: var(--text-light); font-size: 14px; padding: 0 2px; }
	.step-num { font-size: 16px; font-weight: 800; color: var(--text); }
	.step-num.green { color: var(--sage); }
	.step-op { font-size: 13px; color: var(--text-light); }
	.step-desc { font-size: 10px; color: var(--text-light); text-align: center; }

	.no-chain { padding: 16px 24px; border-top: 1px solid var(--border); font-size: 13px; color: var(--text-light); text-align: center; }

	.comp-blend { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 20px 24px; border-top: 1px solid var(--border); }
	.comp-blend-card { padding: 16px; background: #f5f0e8; border-radius: 10px; }
	.comp-blend-title { font-size: 12px; font-weight: 700; color: var(--text-light); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
	.comp-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; font-size: 12px; border-bottom: 1px solid var(--border); }
	.comp-row:last-child { border: none; }
	.comp-name { font-weight: 600; }
	.comp-meta { color: var(--text-light); font-size: 11px; }
	.comp-count { font-size: 14px; font-weight: 700; color: var(--text); }
	.total-row { font-weight: 700; }
	.comp-count.green { color: var(--sage); }
	.comp-empty { font-size: 12px; color: var(--text-light); font-style: italic; padding: 8px 0; }

	.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: 48px 24px; }
	.empty-state-icon { font-size: 48px; margin-bottom: 16px; }
	.empty-state h2 { font-family: 'Playfair Display', serif; font-size: 28px; color: var(--deep-green); margin: 0 0 8px; }
	.empty-state p { color: var(--text-light); font-size: 16px; margin: 0 0 24px; }
	.empty-state-cta { background: var(--deep-green); color: var(--bg); padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; }
	.empty-state-cta:hover { background: var(--sage); }

	@media (max-width: 768px) {
		.segment-hero-row { grid-template-columns: 1fr; }
		.comp-blend { grid-template-columns: 1fr; }
	}
</style>
