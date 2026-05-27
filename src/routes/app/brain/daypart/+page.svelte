<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	const addr = $derived(page.url.searchParams.get('addr') ?? '');

	let address = $state('');
	let neighborhood = $state('');
	let bizType = $state('specialty_coffee');
	let bizTypeLabel = $state('Specialty Coffee');
	let transitRiders = $state<number | null>(null);
	let stationCount  = $state<number | null>(null);
	let peakHourRatio = $state<number | null>(null);
	let dataQuality   = $state<string>('');
	let routes        = $state<string[]>([]);
	let locationIQ = $state(0);
	let sixScores = $state<Record<string, number>>({});
	let hasSession = $state(false);

	// Business type → peak window config
	const PEAK_CONFIGS: Record<string, {
		primaryPeak: string;
		secondaryPeak: string;
		eveningPeak: string;
		primaryCoeff: number;
		description: string;
		industryBenchmark: string;
	}> = {
		// Normalized keys (match normalizeBizType output)
		specialty_coffee:        { primaryPeak: '7–10 AM', secondaryPeak: '12–2 PM', eveningPeak: '4–6 PM', primaryCoeff: 0.32, description: 'Morning commute is your primary revenue window. Secondary afternoon pickup at lunchtime.', industryBenchmark: '62% of revenue in 7–11 AM window (SCA 2023)' },
		bakery:                  { primaryPeak: '7–10 AM', secondaryPeak: '11 AM–1 PM', eveningPeak: '3–5 PM', primaryCoeff: 0.30, description: 'Morning rush and weekend brunch are peak periods. Afternoon shoulder for impulse pastry purchases.', industryBenchmark: '58% of revenue before noon (bakery industry avg)' },
		full_service_restaurant: { primaryPeak: '12–2 PM', secondaryPeak: '6–9 PM', eveningPeak: '11 AM–12 PM', primaryCoeff: 0.18, description: 'Lunch and dinner are the primary windows. Evening dinner service generates the highest check averages.', industryBenchmark: 'Lunch + dinner = 78% of full-service revenue (NRA 2023)' },
		fast_casual:             { primaryPeak: '12–2 PM', secondaryPeak: '11 AM–12 PM', eveningPeak: '5–7 PM', primaryCoeff: 0.20, description: 'Lunch is the dominant window for fast casual. Strong dinner carry-out performance.', industryBenchmark: 'Lunch = 42% of QSR daily revenue (NRA 2023)' },
		qsr:                     { primaryPeak: '12–2 PM', secondaryPeak: '7–9 AM', eveningPeak: '5–7 PM', primaryCoeff: 0.22, description: 'Lunch peak for QSR, with morning breakfast daypart second. Late afternoon dinner carry-out spike.', industryBenchmark: 'Lunch = 42% of QSR daily revenue (NRA 2023)' },
		fitness_studio:          { primaryPeak: '6–8 AM', secondaryPeak: '5–8 PM', eveningPeak: '12–1 PM', primaryCoeff: 0.22, description: 'Early morning and after-work are your two peak utilization windows.', industryBenchmark: '6 AM–8 AM and 5 PM–8 PM = 55% of daily check-ins (IHRSA)' },
		bar_nightlife:           { primaryPeak: '8 PM–12 AM', secondaryPeak: '5–8 PM', eveningPeak: '3–5 PM', primaryCoeff: 0.08, description: 'Evening and late-night drive the vast majority of revenue. Happy hour creates a secondary spike.', industryBenchmark: 'After 8 PM = 58% of bar revenue on Fri/Sat (CGA US 2023)' },
		juice_bar:               { primaryPeak: '7–10 AM', secondaryPeak: '12–2 PM', eveningPeak: '4–6 PM', primaryCoeff: 0.30, description: 'Morning health-routine commuters are your primary audience. Lunch wellness crowd secondary.', industryBenchmark: '60%+ of juice bar revenue before 2 PM (industry avg)' },
		wellness_beverage:       { primaryPeak: '7–10 AM', secondaryPeak: '12–2 PM', eveningPeak: '4–6 PM', primaryCoeff: 0.30, description: 'Morning commute and midday wellness breaks are the strongest windows.', industryBenchmark: 'Morning = primary window for wellness-oriented concepts' },
		retail:                  { primaryPeak: '11 AM–3 PM', secondaryPeak: '3–6 PM', eveningPeak: '6–8 PM', primaryCoeff: 0.20, description: 'Midday and early afternoon are peak retail browsing windows. Evenings and weekends are secondary.', industryBenchmark: 'Noon–6 PM = ~65% of boutique retail transactions (NRF)' },
		personal_services:       { primaryPeak: '10 AM–1 PM', secondaryPeak: '4–7 PM', eveningPeak: '7–9 AM', primaryCoeff: 0.18, description: 'Late morning and after-work are peak appointment windows for personal services.', industryBenchmark: 'Appointment services: 10 AM–7 PM = 80%+ of bookings' },
		medical_office:          { primaryPeak: '9 AM–12 PM', secondaryPeak: '1–4 PM', eveningPeak: '8–9 AM', primaryCoeff: 0.20, description: 'Morning appointments are the primary window. Afternoon hours fill with follow-up visits.', industryBenchmark: 'Office visits: 70% between 9 AM–4 PM (CMS data)' },
		florist:                 { primaryPeak: '10 AM–2 PM', secondaryPeak: '8–10 AM', eveningPeak: '4–6 PM', primaryCoeff: 0.18, description: 'Midday is peak for walk-in and scheduled pickups. Morning handles pre-orders and deliveries.', industryBenchmark: 'Valentine\'s, Mother\'s Day = 30%+ of annual floral revenue' },
		// Legacy aliases (in case session has un-normalized value)
		coffee_shop:       { primaryPeak: '7–10 AM', secondaryPeak: '12–2 PM', eveningPeak: '4–6 PM', primaryCoeff: 0.32, description: 'Morning commute drives the majority of daily transactions.', industryBenchmark: '62% of revenue in 7–11 AM window (SCA 2023)' },
		restaurant:        { primaryPeak: '12–2 PM', secondaryPeak: '6–9 PM', eveningPeak: '11 AM–12 PM', primaryCoeff: 0.18, description: 'Lunch and dinner are the primary windows.', industryBenchmark: 'Lunch + dinner = 78% of full-service revenue (NRA 2023)' },
		gym:               { primaryPeak: '6–8 AM', secondaryPeak: '5–8 PM', eveningPeak: '12–1 PM', primaryCoeff: 0.22, description: 'Early morning and after-work are your two peak utilization windows.', industryBenchmark: '6 AM–8 AM and 5 PM–8 PM = 55% of daily check-ins (IHRSA)' },
		fitness:           { primaryPeak: '6–8 AM', secondaryPeak: '5–8 PM', eveningPeak: '12–1 PM', primaryCoeff: 0.22, description: 'Early morning and after-work are your two peak utilization windows.', industryBenchmark: '6 AM–8 AM and 5 PM–8 PM = 55% of daily check-ins (IHRSA)' },
		bar:               { primaryPeak: '8 PM–12 AM', secondaryPeak: '5–8 PM', eveningPeak: '3–5 PM', primaryCoeff: 0.08, description: 'Evening and late-night drive the vast majority of revenue.', industryBenchmark: 'After 8 PM = 58% of bar revenue on Fri/Sat (CGA US 2023)' },
	};

	const config = $derived(PEAK_CONFIGS[bizType] ?? PEAK_CONFIGS.specialty_coffee);

	// MTA morning peak: prefer intel override, fallback to transitRiders × primaryCoeff
	let mtaMorningPeakOverride = $state<number | null>(null);
	const mtaMorningPeak = $derived(
		mtaMorningPeakOverride ?? (transitRiders ? Math.round(transitRiders * config.primaryCoeff) : null)
	);

	onMount(() => {
		try {
			const loc = JSON.parse(localStorage.getItem('re2_selected_location') || '{}');
			address = loc.addr || '';
			neighborhood = loc.neighborhood || '';
		} catch {}
		try {
			const session = JSON.parse(localStorage.getItem('re2_session') || '{}');
			hasSession = !!(session.analyzedAddress || session.locationIQ);
			locationIQ = session.locationIQ || 0;
			sixScores = session.sixScores || {};
			bizType = session.visionBizType || session.bizType || session.businessType || 'specialty_coffee';
		} catch {}
		try {
			const intel = JSON.parse(localStorage.getItem('re2_location_intel') || '{}');
			// T9-01: read from correct nested path (mtaRidership object)
			const mta = intel.mtaRidership;
			if (intel.segmentInsight?.coffeeChain?.mtaMorningPeak) mtaMorningPeakOverride = intel.segmentInsight.coffeeChain.mtaMorningPeak;
			if (mta?.totalDailyRidership > 0) {
				transitRiders = mta.totalDailyRidership;
				stationCount  = mta.stationCount ?? null;
				peakHourRatio = mta.peakHourRatio ?? null;
				dataQuality   = mta.dataQuality ?? '';
				routes        = mta.routes ?? [];
			}
			// Legacy flat key fallback (older cached sessions)
			if (!transitRiders && intel.transitRiders) transitRiders = intel.transitRiders;
			if (!transitRiders && intel.segmentInsight?.transitRiders) transitRiders = intel.segmentInsight.transitRiders;
		} catch {}
		// Map bizType to label (normalized + legacy aliases)
		const labelMap: Record<string, string> = {
			specialty_coffee: 'Specialty Coffee', coffee_shop: 'Coffee Shop',
			bakery: 'Bakery', juice_bar: 'Juice Bar', wellness_beverage: 'Wellness Beverage',
			full_service_restaurant: 'Full-Service Restaurant', restaurant: 'Restaurant',
			fast_casual: 'Fast Casual', qsr: 'QSR',
			bar_nightlife: 'Bar / Nightlife', bar: 'Bar / Nightlife',
			fitness_studio: 'Fitness Studio', gym: 'Fitness Studio', fitness: 'Fitness Studio',
			retail: 'Retail', florist: 'Florist',
			personal_services: 'Personal Services', medical_office: 'Medical Office',
		};
		bizTypeLabel = labelMap[bizType] ?? 'Your Concept';
	});
</script>

<svelte:head>
	<title>RE² — Daypart Traffic</title>
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
		<a href="/app/brain/daypart{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab active">Daypart Traffic</a>
		<a href="/app/brain/segments{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Segment Intel</a>
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
				<span class="page-label">Daypart Traffic</span>
			</div>
			<div class="page-title">Daypart Traffic Analysis</div>
			<div class="page-desc">Concept-specific peak windows with MTA transit data. Shows when your customer is most likely to pass by and what industry data says about revenue timing.</div>

			{#if !locationIQ && !address}
			<div class="no-data-state">
				<p>No location has been analyzed yet. <a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}">Analyze a location</a> to see daypart traffic.</p>
			</div>
		{:else}
			<div class="daypart-grid">
				<!-- Peak Windows Card -->
				<div class="dp-card peak-card">
					<div class="dc-header">
						<span class="dc-icon">⏰</span>
						<div>
							<div class="dc-title">Your Peak Windows — {bizTypeLabel}</div>
							<div class="dc-sub">Based on concept type</div>
						</div>
					</div>
					<div class="peak-rows">
						<div class="peak-row primary">
							<span class="peak-badge primary-badge">Primary</span>
							<span class="peak-window">{config.primaryPeak}</span>
						</div>
						<div class="peak-row secondary">
							<span class="peak-badge secondary-badge">Secondary</span>
							<span class="peak-window">{config.secondaryPeak}</span>
						</div>
						<div class="peak-row evening">
							<span class="peak-badge evening-badge">Shoulder</span>
							<span class="peak-window">{config.eveningPeak}</span>
						</div>
					</div>
					<div class="dc-note">{config.description}</div>
				</div>

				<!-- MTA Transit Card -->
				<div class="dp-card transit-card">
					<div class="dc-header">
						<span class="dc-icon">🚇</span>
						<div>
							<div class="dc-title">MTA Transit Data</div>
							<div class="dc-sub">Real ridership from MTA open data</div>
						</div>
					</div>
					{#if transitRiders}
						<div class="metric-row">
							<span class="metric-label">Daily MTA Riders (400m radius)</span>
							<span class="metric-value">{transitRiders.toLocaleString()}</span>
						</div>
						{#if stationCount != null}
						<div class="metric-row">
							<span class="metric-label">Subway Stations Nearby</span>
							<span class="metric-value">{stationCount}</span>
						</div>
						{/if}
						{#if routes.length > 0}
						<div class="metric-row">
							<span class="metric-label">Lines</span>
							<span class="metric-value routes-val">{routes.slice(0, 8).join(' · ')}{routes.length > 8 ? ' +more' : ''}</span>
						</div>
						{/if}
						{#if mtaMorningPeak}
							<div class="metric-row">
								<span class="metric-label">Est. Peak-Hour Pass-Bys ({config.primaryPeak})</span>
								<span class="metric-value sage">{mtaMorningPeak.toLocaleString()}</span>
							</div>
							<div class="calc-chain">
								<span class="cc-step">{transitRiders.toLocaleString()} daily riders</span>
								<span class="cc-arrow">×</span>
								<span class="cc-step">{Math.round(config.primaryCoeff * 100)}% peak coefficient</span>
								<span class="cc-arrow">=</span>
								<span class="cc-result">{mtaMorningPeak.toLocaleString()} est. peak-hour</span>
							</div>
						{/if}
						<div class="dc-note dc-note-amber">{dataQuality === 'real' ? 'Real MTA ridership data' : dataQuality === 'mixed' ? 'Mixed real + estimated data' : 'Estimated ridership'} — ±25% margin</div>
					{:else}
						<div class="no-transit">
							<span class="nt-icon">🚇</span>
							<span class="nt-title">MTA data unavailable</span>
						</div>
						<div class="dc-note">Live transit data timed out for this location.{#if sixScores.transit} Use the transit score ({Math.round(sixScores.transit)}/100) as a proxy.{/if}</div>
						<a href="/app/location{address ? '?addr=' + encodeURIComponent(address) + '&refresh=1' : ''}" class="retry-btn">↺ Retry full analysis</a>
					{/if}
				</div>

				<!-- Industry Benchmark Card -->
				<div class="dp-card benchmark-card">
					<div class="dc-header">
						<span class="dc-icon">📊</span>
						<div>
							<div class="dc-title">Industry Benchmark</div>
							<div class="dc-sub">{bizTypeLabel} revenue timing</div>
						</div>
					</div>
					<div class="benchmark-body">
						<div class="benchmark-stat">{config.industryBenchmark}</div>
					</div>
					<div class="transit-score-row">
						<span class="tsr-label">Transit Score for this location</span>
						<span class="tsr-val" class:tsr-good={sixScores.transit >= 70} class:tsr-mid={sixScores.transit >= 50 && sixScores.transit < 70} class:tsr-low={sixScores.transit > 0 && sixScores.transit < 50}>{sixScores.transit ? Math.round(sixScores.transit) : '—'}/100</span>
					</div>
					<div class="dc-note">Transit score reflects walk access + subway ridership density. Higher scores mean more natural foot traffic past your location.</div>
				</div>
			</div>
		{/if}
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
	.no-data-state { padding: 40px; text-align: center; color: var(--text-light); font-size: 14px; }
	.no-data-state a { color: var(--sage); }

	.daypart-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
	.dp-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
	.dc-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 20px; }
	.dc-icon { font-size: 24px; flex-shrink: 0; }
	.dc-title { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 2px; }
	.dc-sub { font-size: 11px; color: var(--text-light); }
	.dc-note { font-size: 12px; color: var(--text-light); line-height: 1.5; margin-top: 16px; padding: 10px 14px; background: #f5f0e8; border-radius: 8px; }
	.dc-note-amber { border-left: 2px solid var(--marigold); }

	.peak-rows { display: flex; flex-direction: column; gap: 8px; }
	.peak-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; }
	.peak-row.primary { background: var(--sage-bg); }
	.peak-row.secondary { background: rgba(37,99,235,0.06); }
	.peak-row.evening { background: rgba(232,168,56,0.06); }
	.peak-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
	.primary-badge { background: var(--sage-bg); color: var(--sage); }
	.secondary-badge { background: rgba(37,99,235,0.1); color: #2563EB; }
	.evening-badge { background: rgba(232,168,56,0.1); color: var(--marigold); }
	.peak-window { font-size: 16px; font-weight: 700; color: var(--text); }

	.metric-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
	.metric-row:last-of-type { border: none; }
	.metric-label { font-size: 13px; color: var(--text-light); }
	.metric-value { font-size: 18px; font-weight: 800; color: var(--text); }
	.metric-value.sage { color: var(--sage); }
	.routes-val { font-size: 13px; font-weight: 600; letter-spacing: 0.5px; }

	.calc-chain { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 12px; padding: 10px 14px; background: #f5f0e8; border-radius: 8px; }
	.cc-step { font-size: 11px; font-weight: 600; color: var(--text-light); padding: 3px 8px; background: var(--surface); border-radius: 6px; border: 1px solid var(--border); }
	.cc-arrow { font-size: 12px; color: var(--text-light); }
	.cc-result { font-size: 11px; font-weight: 700; color: var(--sage); padding: 3px 8px; background: var(--sage-bg); border-radius: 6px; }

	.no-transit { display: flex; align-items: center; gap: 10px; padding: 16px; background: #f5f0e8; border-radius: 10px; margin-bottom: 8px; }
	.nt-icon { font-size: 20px; }
	.nt-title { font-weight: 700; font-size: 13px; color: var(--text); }
	.retry-btn { display: inline-block; margin-top: 8px; font-size: 12px; font-weight: 600; color: var(--sage); background: var(--sage-bg); padding: 6px 14px; border-radius: 8px; text-decoration: none; border: 1px solid var(--sage); transition: all 0.2s; }
	.retry-btn:hover { background: var(--sage); color: white; }

	.benchmark-body { padding: 14px 16px; background: rgba(37,99,235,0.04); border-radius: 10px; margin-bottom: 16px; }
	.benchmark-stat { font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.5; }
	.transit-score-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid var(--border); margin-bottom: 8px; }
	.tsr-label { font-size: 13px; color: var(--text-light); }
	.tsr-val { font-size: 20px; font-weight: 800; }

	.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: 48px 24px; }
	.empty-state-icon { font-size: 48px; margin-bottom: 16px; }
	.empty-state h2 { font-family: 'Playfair Display', serif; font-size: 28px; color: var(--deep-green); margin: 0 0 8px; }
	.empty-state p { color: var(--text-light); font-size: 16px; margin: 0 0 24px; }
	.empty-state-cta { background: var(--deep-green); color: var(--bg); padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; }
	.empty-state-cta:hover { background: var(--sage); }
	.tsr-good { color: var(--sage); }
	.tsr-mid { color: var(--marigold); }
	.tsr-low { color: var(--hot-pink); }

	@media (max-width: 768px) {
		.daypart-grid { grid-template-columns: 1fr; }
	}
</style>
