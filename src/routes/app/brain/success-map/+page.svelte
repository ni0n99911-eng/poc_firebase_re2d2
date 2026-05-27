<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import MapView from '$lib/components/MapView.svelte';

	const addr = $derived(page.url.searchParams.get('addr') ?? '');

	let address = $state('');
	let neighborhood = $state('');
	let mapLat = $state(40.7580);
	let mapLng = $state(-73.9855);
	let hasLocation = $state(false);
	let mapRef = $state<MapView | null>(null);
	let hasSession = $state(false);

	let activeFilter = $state('All'); // must match filters array values (case-sensitive)
	const filters = ['All', 'Coffee / Cafe', 'Restaurant', 'Bar', 'Retail', 'Fitness'];

	let loadingTimedOut = $state(false);
	let businessesLoading = $state(false);
	let apiSource = $state<string>(''); // 'foursquare' | 'google-places' | 'overpass-fallback' | 'none' | 'error'

	// Each business has name, lat, lng, dist, category, popularity, color (outcome tier)
	interface NearbyBusiness {
		name: string; lat: number; lng: number; dist: number;
		category: string; popularity: number; color: string;
	}
	let allBusinesses = $state<NearbyBusiness[]>([]);

	// Outcome tier color by Foursquare popularity score (0–1 proxy for business health)
	function tierColor(popularity: number): string {
		if (popularity >= 0.70) return '#4a7c5c'; // Thriving
		if (popularity >= 0.45) return '#2563EB'; // Performing
		if (popularity >= 0.25) return '#e8a838'; // Surviving
		return '#e8345a';                          // At Risk
	}

	// Category filter logic
	const FILTER_KEYWORDS: Record<string, string[]> = {
		'Coffee / Cafe': ['coffee', 'cafe', 'café', 'espresso', 'bakery', 'tea'],
		'Restaurant': ['restaurant', 'pizza', 'burger', 'sushi', 'thai', 'mexican', 'diner', 'sandwich', 'taco', 'ramen', 'bistro', 'grill', 'kitchen', 'food'],
		'Bar': ['bar', 'pub', 'brewery', 'cocktail', 'lounge', 'nightclub', 'wine', 'beer'],
		'Retail': ['retail', 'shop', 'store', 'boutique', 'market', 'clothing', 'book', 'gift'],
		'Fitness': ['gym', 'fitness', 'yoga', 'pilates', 'cycling', 'studio', 'crossfit', 'boxing'],
	};

	let filteredBusinesses = $derived.by(() => {
		if (activeFilter === 'All') return allBusinesses;
		const keywords = FILTER_KEYWORDS[activeFilter] || [];
		return allBusinesses.filter(b =>
			keywords.some(kw => b.category.toLowerCase().includes(kw) || b.name.toLowerCase().includes(kw))
		);
	});

	async function fetchNearbyBusinesses(lat: number, lng: number) {
		businessesLoading = true;
		try {
			const res = await fetch(`/api/nearby-businesses?lat=${lat}&lng=${lng}&radius=700`);
			if (!res.ok) {
				console.warn('[success-map] API HTTP error:', res.status);
				apiSource = 'error';
				return;
			}
			const data = await res.json();
			apiSource = data.source || 'unknown';
			console.log(`[success-map] API response — source: ${data.source}, total: ${data.total ?? 0}, businesses: ${(data.businesses || []).length}`);
			allBusinesses = (data.businesses || []).map((b: Omit<NearbyBusiness, 'color'> & { popularity: number }) => ({
				...b,
				color: tierColor(b.popularity),
			}));
		} catch (e) {
			console.warn('[success-map] nearby-businesses fetch failed:', e);
			apiSource = 'error';
		} finally {
			businessesLoading = false;
			loadingTimedOut = true;
		}
	}

	onMount(() => {
		try {
			const loc = JSON.parse(localStorage.getItem('re2_selected_location') || '{}');
			if (loc.addr) {
				address = loc.addr;
				neighborhood = loc.neighborhood || '';
				hasLocation = true;
			}
			if (loc.lat) mapLat = loc.lat;
			if (loc.lng) mapLng = loc.lng;
		} catch {}
		try {
			const session = JSON.parse(localStorage.getItem('re2_session') || '{}');
			hasSession = !!(session.analyzedAddress || session.locationIQ);
		} catch {}
		setTimeout(() => mapRef?.resize(), 300);
		// Fetch businesses after a brief delay to let the map initialize
		if (mapLat && mapLng) {
			setTimeout(() => fetchNearbyBusinesses(mapLat, mapLng), 600);
		}
		// Fallback timeout in case the API takes too long
		setTimeout(() => { loadingTimedOut = true; }, 10000);
	});
</script>

<svelte:head>
	<title>RE² — Neighborhood Success Map</title>
	<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
</svelte:head>

<div class="brain-page">
	<!-- TOOL STRIP -->
	<div class="tools-strip">
		<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Overview</a>
		<div class="tools-sep"></div>
		<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab back-tab">← Score</a>
		<div class="tools-sep"></div>
		<a href="/app/brain/compare{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Compare</a>
		<a href="/app/brain/success-map{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab active">Success Map</a>
		<a href="/app/brain/daypart{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="tool-tab">Daypart Traffic</a>
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
				<span class="page-label">Neighborhood Success Map</span>
			</div>
			<div class="page-title">Neighborhood Success Map</div>
			<div class="page-desc">Real business outcomes overlaid on the map. Each dot is a business colored by outcome tier — thriving, performing, surviving, or at-risk. Powered by the RE² hybrid scorer and backtest data.</div>

			<div class="success-map-frame">
			<!-- Filter bar -->
			<div class="map-filter-bar">
				<span class="filter-label">Show:</span>
				{#each filters as f}
					<button
						class="map-filter-chip"
						class:active={activeFilter === f}
						onclick={() => { activeFilter = f; }}
					>{f}</button>
				{/each}
			</div>

			<!-- Map area -->
			<div class="map-area">
				{#if hasLocation}
					<MapView
						bind:this={mapRef}
						lat={mapLat}
						lng={mapLng}
						competitors={filteredBusinesses}
						compact={false}
						showPin={true}
					/>
				{:else}
					<div class="map-empty">
						<div class="me-icon">📍</div>
						<div class="me-text">Analyze a location to see the neighborhood success map</div>
						<a href="/app/location{addr ? '?addr=' + encodeURIComponent(addr) : ''}" class="me-btn">Analyze a Location →</a>
					</div>
				{/if}

				{#if hasLocation && businessesLoading}
					<div class="map-loading-overlay">
						<div class="loading-badge">
							<span class="lb-dot"></span>
							Loading neighborhood businesses…
						</div>
					</div>
				{/if}
				{#if hasLocation && !businessesLoading && allBusinesses.length === 0 && loadingTimedOut}
					<div class="map-loading-overlay">
						<div class="loading-badge" style="background:rgba(255,247,230,0.95);border-color:#e8a838;color:#92400e">
							{#if apiSource === 'error' || apiSource === 'none'}
								Data source unavailable — <button class="retry-btn" onclick={() => fetchNearbyBusinesses(mapLat, mapLng)}>retry</button>
							{:else}
								No business data found for this area
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Legend -->
			<div class="map-legend">
				<div class="legend-item"><div class="legend-dot" style="background:#e8345a;border:2px solid white;box-shadow:0 0 0 3px rgba(232,52,90,0.3)"></div> Your Location</div>
				<div class="legend-item"><div class="legend-dot" style="background:#4a7c5c"></div> Thriving (Score 70+)</div>
				<div class="legend-item"><div class="legend-dot" style="background:#2563EB"></div> Performing (55–69)</div>
				<div class="legend-item"><div class="legend-dot" style="background:#e8a838"></div> Surviving (40–54)</div>
				<div class="legend-item"><div class="legend-dot" style="background:#e8345a"></div> At Risk (&lt;40)</div>
				<span class="legend-note">{allBusinesses.length > 0 ? filteredBusinesses.length + " businesses shown" : "Popularity-based outcome estimates"}</span>
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

	.success-map-frame { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
	.map-filter-bar { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-bottom: 1px solid var(--border); background: var(--surface); flex-wrap: wrap; }
	.filter-label { font-size: 11px; font-weight: 600; color: var(--text-light); margin-right: 4px; }
	.map-filter-chip { font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 6px; background: #ede8e0; color: var(--text-light); border: 1px solid transparent; cursor: pointer; font-family: inherit; transition: all 0.15s; }
	.map-filter-chip.active { background: var(--sage-bg); color: var(--sage); border-color: rgba(74,124,92,0.3); }
	.map-filter-chip:hover { background: var(--sage-bg); color: var(--sage); }

	.map-area { height: 420px; position: relative; overflow: hidden; background: #f5f0e8; }
	.map-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
	.me-icon { font-size: 36px; }
	.me-text { font-size: 14px; color: var(--text-light); }
	.me-btn { font-size: 13px; font-weight: 600; color: var(--sage); text-decoration: none; padding: 8px 16px; border: 1px solid var(--sage); border-radius: 8px; }
	.map-loading-overlay { position: absolute; top: 14px; left: 14px; z-index: 10; pointer-events: none; }
	.loading-badge { display: flex; align-items: center; gap: 8px; padding: 6px 14px; background: rgba(250,247,242,0.95); border: 1px solid var(--border); border-radius: 20px; font-size: 12px; font-weight: 600; color: var(--text-light); backdrop-filter: blur(8px); }
	.retry-btn { background: none; border: none; padding: 0; font: inherit; font-weight: 700; color: #92400e; text-decoration: underline; cursor: pointer; }
	.lb-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--marigold); animation: pulse-dot 1.5s infinite; }
	@keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

	.map-legend { display: flex; align-items: center; gap: 16px; padding: 14px 20px; border-top: 1px solid var(--border); background: var(--surface); flex-wrap: wrap; }
	.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-light); }
	.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
	.legend-note { font-size: 11px; color: var(--text-light); opacity: 0.6; margin-left: auto; font-style: italic; }

	.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: 48px 24px; }
	.empty-state-icon { font-size: 48px; margin-bottom: 16px; }
	.empty-state h2 { font-family: 'Playfair Display', serif; font-size: 28px; color: var(--deep-green); margin: 0 0 8px; }
	.empty-state p { color: var(--text-light); font-size: 16px; margin: 0 0 24px; }
	.empty-state-cta { background: var(--deep-green); color: var(--bg); padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; }
	.empty-state-cta:hover { background: var(--sage); }

	@media (max-width: 768px) {
		.map-area { height: 300px; }
	}
</style>
