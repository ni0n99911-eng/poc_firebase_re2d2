<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	const addr = $derived(page.url.searchParams.get('addr') ?? '');

	let address = $state('');
	let neighborhood = $state('');
	let locationIQ = $state(0);
	let sixScores = $state<Record<string, number>>({});
	let sixIndex = $state<{ indices: Record<string, { score: number; weight: number; dataSources: number }> } | null>(null);
	let hasSession = $state(false);

	let activeKey = $state('transit');

	const DIMS: Array<{
		key: string;
		label: string;
		icon: string;
		color: string;
		bgColor: string;
		sources: string[];
		description: string;
	}> = [
		{ key: 'transit', label: 'Transit', icon: '🚇', color: '#1a3a2a', bgColor: 'rgba(26,58,42,0.08)',
		  sources: ['MTA Ridership', 'Walk Score', 'Subway Entrances', 'Bus Stops'],
		  description: 'Daily MTA ridership within 400m, walk score, number of subway entrances and bus stops nearby. Higher ridership means more foot traffic past your location.' },
		{ key: 'demographics', label: 'Demographics', icon: '👥', color: '#4a7c5c', bgColor: 'rgba(74,124,92,0.08)',
		  sources: ['ACS Census', 'Median HHI', 'Age Profile', 'Population Density'],
		  description: 'Household income, age distribution, and population density from American Community Survey. Demographic fit is matched to your target customer profile.' },
		{ key: 'competition', label: 'Competition', icon: '🏪', color: '#e8345a', bgColor: 'rgba(232,52,90,0.08)',
		  sources: ['Foursquare', 'Google Places', 'Overpass OSM', 'DOHMH Inspections'],
		  description: 'Number of direct competitors within 800m, chain vs. indie mix, and average ratings. Lower scores mean more competition — a crowded market lowers your score.' },
		{ key: 'vibrancy', label: 'Concept Pulse', icon: '🏙️', color: '#e8a838', bgColor: 'rgba(232,168,56,0.08)',
		  sources: ['Google Places POIs', 'Foursquare Venues', 'OSM Amenities'],
		  description: 'How alive your trade area is, measured at the distance your customers actually travel — 250m for coffee, 500m for restaurants, 800m for grocery. A quiet ring isn\'t automatically bad; it just tells you whether you\'ll ride neighbor energy or rely on destination marketing.' },
		{ key: 'safety', label: 'Safety', icon: '🛡️', color: '#4a7c5c', bgColor: 'rgba(74,124,92,0.08)',
		  sources: ['NYPD Incident Data', 'Crime Aggregates', 'Block Group Reports'],
		  description: 'Monthly incident rate normalized by population density. Higher score = fewer incidents. Impacts customer willingness to visit during evening hours.' },
		{ key: 'momentum', label: 'Momentum', icon: '📈', color: '#e8a838', bgColor: 'rgba(232,168,56,0.08)',
		  sources: ['DOB Permits', 'Business Registrations', 'NYC Open Data'],
		  description: 'Recent permit activity and new business registrations signal neighborhood growth. Positive momentum means you\'re moving into a rising area, not a declining one.' },
		{ key: 'neighborhoodHealth', label: 'Neighborhood Health', icon: '🌱', color: '#4a7c5c', bgColor: 'rgba(74,124,92,0.08)',
		  sources: ['ACS Income Trends', 'Median Rent Index', 'Displacement Risk'],
		  description: 'Long-term neighborhood stability. Combines income growth, displacement risk, and retail vacancy trends. Healthy neighborhoods sustain businesses over multi-year leases.' },
		{ key: 'survivalRate', label: 'Survival Rate', icon: '📊', color: '#e8a838', bgColor: 'rgba(232,168,56,0.08)',
		  sources: ['DOHMH Inspection History', 'Business Longevity Model', 'RE² Backtest'],
		  description: 'Estimated 3-year survival probability for your concept type in this block group, based on historical business outcomes. This is the highest-weight predictor in Location IQ.' },
	];

	function getScore(key: string): number | null {
		// FIX-06: Return null (not 0) when score is missing — 0 is impossible for scored locations
		if (sixIndex?.indices?.[key]?.score != null) return Math.round(sixIndex.indices[key].score);
		const raw = sixScores[key];
		if (raw == null || raw === 0) return null;
		return Math.round(raw);
	}

	function getWeight(key: string): number {
		return Math.round((sixIndex?.indices?.[key]?.weight ?? 0) * 100);
	}

	function getDataSources(key: string): number {
		return sixIndex?.indices?.[key]?.dataSources ?? 0;
	}

	function scoreColor(s: number | null): string {
		if (s == null) return '#9CA3AF';
		if (s >= 70) return '#4a7c5c';
		if (s >= 50) return '#e8a838';
		return '#e8345a';
	}

	const activeDim = $derived(DIMS.find(d => d.key === activeKey) ?? DIMS[0]);
	const activeScore = $derived(getScore(activeKey));
	const activeWeight = $derived(getWeight(activeKey));
	const activeDataSources = $derived(getDataSources(activeKey));

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
			if (session.sixIndex) sixIndex = session.sixIndex;
		} catch {}
		try {
			const intel = JSON.parse(localStorage.getItem('re2_location_intel') || '{}');
			if (intel.sixIndex) sixIndex = intel.sixIndex;
		} catch {}
	});
</script>

<svelte:head>
	<title>RE² — Score Breakdown</title>
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
		<a href="/app/brain/segments{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Segment Intel</a>
		<a href="/app/brain/street{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Street View</a>
		<a href="/app/brain/transparency{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab active">Score Breakdown</a>
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
				<span class="page-label">Score Breakdown</span>
			</div>
			<div class="page-title">Your Score Transparency</div>
			<div class="page-desc">Every score is tappable. Select a dimension to see the raw data inputs, data source coverage, and why it scored the way it did.</div>

			{#if !locationIQ}
			<div class="no-data-state">
				<p>No location has been analyzed yet. <a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}">Analyze a location</a> to see score breakdown.</p>
			</div>
		{:else}
			<div class="drawer-demo">
				<!-- Left: score bars -->
				<div class="drawer-left">
					<div class="drawer-header">Score: {locationIQ}</div>
					{#each DIMS as dim}
						{@const s = getScore(dim.key)}
						{@const w = getWeight(dim.key)}
						<button
							class="score-bar-item"
							class:active={activeKey === dim.key}
							onclick={() => { activeKey = dim.key; }}
						>
							<div class="sbi-main">
								<div class="sbi-top">
									<span class="bar-label" style={activeKey === dim.key ? `color:${dim.color}` : ''}>{dim.label}</span>
									<span class="bar-value" style="color:{s !== null ? scoreColor(s) : '#9CA3AF'}">{s !== null ? s : '—'}</span>
								</div>
								<div class="mini-bar">
									<div class="mini-bar-fill" style="width:{s !== null ? s : 0}%; background:{s !== null ? scoreColor(s) : '#E5E7EB'}"></div>
								</div>
								{#if w > 0}
									<div class="dim-weight">{w}% weight</div>
								{/if}
							</div>
						</button>
					{/each}
				</div>

				<!-- Right: transparency panel -->
				<div class="drawer-right">
					<div class="dr-header">
						<span class="dr-icon">{activeDim.icon}</span>
						<div>
							<div class="dr-title">{activeDim.label} Score: <span style="color:{activeScore !== null ? scoreColor(activeScore) : '#9CA3AF'}">{activeScore !== null ? activeScore + '/100' : 'No data'}</span></div>
							<div class="dr-subtitle">Why this dimension scored the way it did</div>
						</div>
					</div>

					{#if activeDataSources > 0}
						<div class="confidence-bar">
							<div class="confidence-dot" style="background:{activeDataSources >= 3 ? '#4a7c5c' : '#e8a838'}"></div>
							<div class="confidence-label">
								<strong>{activeDataSources >= 3 ? 'High confidence' : 'Moderate confidence'}</strong>
								— {activeDataSources} data source{activeDataSources !== 1 ? 's' : ''} active
							</div>
						</div>
					{/if}

					<div class="sources-label">Data Sources</div>
					<div class="source-list">
						{#each activeDim.sources as src}
							<span class="source-chip active">{src}</span>
						{/each}
					</div>

					<div class="dim-description">{activeDim.description}</div>

					{#if activeWeight > 0}
						<div class="weight-note">
							<strong>Weight in your score:</strong> {activeDim.label} carries <strong>{activeWeight}%</strong> of your final score.
						</div>
					{/if}
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

	.drawer-demo { display: grid; grid-template-columns: 320px 1fr; gap: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; min-height: 520px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
	.drawer-left { padding: 20px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
	.drawer-header { font-size: 14px; font-weight: 700; color: var(--text); padding-bottom: 4px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
	.score-bar-item { display: flex; align-items: center; padding: 10px 14px; background: #f5f0e8; border-radius: 10px; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; text-align: left; width: 100%; }
	.score-bar-item.active { border-color: var(--sage); background: var(--sage-bg); }
	.sbi-main { flex: 1; }
	.sbi-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
	.bar-label { font-size: 13px; font-weight: 600; }
	.bar-value { font-size: 16px; font-weight: 800; }
	.mini-bar { width: 100%; height: 4px; background: #e8e2d8; border-radius: 2px; }
	.mini-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
	.dim-weight { font-size: 10px; color: var(--text-light); margin-top: 4px; }

	.drawer-right { padding: 24px; overflow-y: auto; }
	.dr-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 20px; }
	.dr-icon { font-size: 28px; flex-shrink: 0; }
	.dr-title { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
	.dr-subtitle { font-size: 12px; color: var(--text-light); }

	.confidence-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #f5f0e8; border-radius: 8px; margin-bottom: 16px; }
	.confidence-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
	.confidence-label { font-size: 12px; color: var(--text-light); }
	.sources-label { font-size: 12px; font-weight: 700; margin-bottom: 8px; color: var(--text-light); }
	.source-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
	.source-chip { font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 4px; background: var(--sage-bg); color: var(--sage); }
	.dim-description { font-size: 13px; color: var(--text-light); line-height: 1.6; margin-bottom: 20px; padding: 14px 16px; background: #f5f0e8; border-radius: 10px; }
	.weight-note { font-size: 12px; color: var(--text-light); padding: 10px 14px; background: #f5f0e8; border-radius: 8px; border-left: 2px solid var(--sage); }

	.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: 48px 24px; }
	.empty-state-icon { font-size: 48px; margin-bottom: 16px; }
	.empty-state h2 { font-family: 'Playfair Display', serif; font-size: 28px; color: var(--deep-green); margin: 0 0 8px; }
	.empty-state p { color: var(--text-light); font-size: 16px; margin: 0 0 24px; }
	.empty-state-cta { background: var(--deep-green); color: var(--bg); padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; }
	.empty-state-cta:hover { background: var(--sage); }

	@media (max-width: 768px) {
		.drawer-demo { grid-template-columns: 1fr; }
		.drawer-left { border-right: none; border-bottom: 1px solid var(--border); max-height: 300px; }
	}
</style>
