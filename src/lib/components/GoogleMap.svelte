<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let {
		lat = 40.7128,
		lng = -74.0060,
		competitors = [] as Array<{name: string, lat: number, lng: number, dist?: number, type?: string}>,
		stations = [] as Array<{name: string, lat: number, lng: number, lines?: string}>,
		demandProxies = [] as Array<{name: string, lat: number, lng: number, category?: string}>,
		businessType = 'Cafe',
		onLocationChange = null as ((loc: {lat: number, lng: number}) => void) | null,
		showStreetView = true,
		apiKey = ''
	} = $props();

	let mapContainer: HTMLDivElement;
	let streetViewContainer: HTMLDivElement;
	let map: google.maps.Map | null = null;
	let streetViewPanorama: google.maps.StreetViewPanorama | null = null;
	let mainMarker: google.maps.marker.AdvancedMarkerElement | null = null;
	let infoWindow: google.maps.InfoWindow | null = null;

	// Layer visibility state
	let showCompetitors = $state(true);
	let showTransit = $state(true);
	let showDemand = $state(true);
	let showRadiusRings = $state(true);
	let showStreetViewPanel = $state(showStreetView);

	// Stored overlay references for toggling
	let competitorMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
	let stationMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
	let demandMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
	let radiusCircles: google.maps.Circle[] = [];

	// Light map style
	const darkMapStyles: google.maps.MapTypeStyle[] = [
		{ elementType: 'geometry', stylers: [{ color: '#F6F8FB' }] },
		{ elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
		{ elementType: 'labels.text.fill', stylers: [{ color: '#1A202C' }] },
		{ featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#E0E5ED' }] },
		{ featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
		{ featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#EBF0F5' }] },
		{ featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F0F3F7' }] },
		{ featureType: 'water', elementType: 'geometry', stylers: [{ color: '#E8F4FF' }] },
		{ featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#F0F3F7' }] },
		{ featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#5A6578' }] },
		{ featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#F0F3F7' }] },
	];

	function createPinElement(color: string, label: string, scale: number = 1): HTMLElement {
		const el = document.createElement('div');
		el.style.cssText = `
			width: ${28 * scale}px; height: ${28 * scale}px;
			background: ${color}; border: 2px solid rgba(255,255,255,0.3);
			border-radius: 50%; display: flex; align-items: center;
			justify-content: center; font-size: ${11 * scale}px;
			cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.5);
			transition: transform 0.15s;
		`;
		el.textContent = label;
		el.onmouseenter = () => el.style.transform = `scale(1.2)`;
		el.onmouseleave = () => el.style.transform = `scale(1)`;
		return el;
	}

	function createMainPin(): HTMLElement {
		const el = document.createElement('div');
		el.style.cssText = `
			width: 40px; height: 40px;
			background: linear-gradient(135deg, #FFD700, #c89b3c);
			border: 3px solid #fff; border-radius: 50% 50% 50% 0;
			transform: rotate(-45deg); cursor: grab;
			box-shadow: 0 4px 16px rgba(255,215,0,0.4);
			display: flex; align-items: center; justify-content: center;
		`;
		const inner = document.createElement('div');
		inner.style.cssText = `
			transform: rotate(45deg); font-size: 18px;
		`;
		inner.textContent = '📍';
		el.appendChild(inner);
		return el;
	}

	async function loadGoogleMaps(): Promise<void> {
		if (window.google?.maps) return;

		return new Promise((resolve, reject) => {
			// Check if script already loading
			if (document.querySelector('script[src*="maps.googleapis.com"]')) {
				const checkLoaded = setInterval(() => {
					if (window.google?.maps) {
						clearInterval(checkLoaded);
						resolve();
					}
				}, 100);
				return;
			}

			const script = document.createElement('script');
			script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker,streetview&v=weekly&callback=__gmapsInit`;
			script.async = true;
			script.defer = true;

			(window as unknown as Record<string, unknown>).__gmapsInit = () => {
				delete (window as unknown as Record<string, unknown>).__gmapsInit;
				resolve();
			};

			script.onerror = () => reject(new Error('Failed to load Google Maps'));
			document.head.appendChild(script);
		});
	}

	function initMap() {
		const center = { lat, lng };

		map = new google.maps.Map(mapContainer, {
			center,
			zoom: 16,
			styles: darkMapStyles,
			disableDefaultUI: false,
			zoomControl: true,
			streetViewControl: false,
			mapTypeControl: false,
			fullscreenControl: true,
			gestureHandling: 'greedy',
			mapId: 're2-location-map',
		});

		infoWindow = new google.maps.InfoWindow();

		// Main draggable marker (gold pin)
		const pinEl = createMainPin();
		mainMarker = new google.maps.marker.AdvancedMarkerElement({
			map,
			position: center,
			gmpDraggable: true,
			content: pinEl,
			title: `${businessType} Location`,
		});

		mainMarker.addListener('dragend', () => {
			const pos = mainMarker!.position as google.maps.LatLng;
			const newLat = typeof pos.lat === 'function' ? pos.lat() : (pos as unknown as { lat: number; lng: number }).lat;
			const newLng = typeof pos.lng === 'function' ? pos.lng() : (pos as unknown as { lat: number; lng: number }).lng;

			// Update radius circles
			radiusCircles.forEach(circle => circle.setCenter({ lat: newLat, lng: newLng }));

			// Update street view
			if (streetViewPanorama) {
				streetViewPanorama.setPosition({ lat: newLat, lng: newLng });
			}

			if (onLocationChange) {
				onLocationChange({ lat: newLat, lng: newLng });
			}
		});

		mainMarker.addListener('click', () => {
			if (infoWindow && map) {
				infoWindow.setContent(`
					<div style="color:#1d1d1f;padding:4px;min-width:180px;">
						<strong style="font-size:14px;">${businessType} Location</strong><br/>
						<span style="color:#6e6e73;font-size:12px;">
							${lat.toFixed(5)}, ${lng.toFixed(5)}
						</span><br/>
						<em style="color:#8e8e93;font-size:11px;">Drag to re-score</em>
					</div>
				`);
				infoWindow.open(map, mainMarker);
			}
		});

		// Add POI markers
		addCompetitorMarkers();
		addStationMarkers();
		addDemandMarkers();
		addRadiusRings();

		// Initialize Street View
		if (showStreetViewPanel && streetViewContainer) {
			initStreetView();
		}
	}

	function addCompetitorMarkers() {
		competitorMarkers.forEach(m => m.map = null);
		competitorMarkers = [];

		competitors.forEach(comp => {
			const el = createPinElement('#EF4444', '☕', 0.9);
			const marker = new google.maps.marker.AdvancedMarkerElement({
				map: showCompetitors ? map : null,
				position: { lat: comp.lat, lng: comp.lng },
				content: el,
				title: comp.name,
			});

			marker.addListener('click', () => {
				if (infoWindow && map) {
					infoWindow.setContent(`
						<div style="color:#1d1d1f;padding:4px;min-width:160px;">
							<strong style="color:#EF4444;">${comp.name}</strong><br/>
							<span style="font-size:12px;">${comp.type || 'Competitor'}</span><br/>
							<span style="color:#6e6e73;font-size:12px;">${comp.dist ? comp.dist.toFixed(0) + 'm away' : ''}</span>
						</div>
					`);
					infoWindow.open(map, marker);
				}
			});

			competitorMarkers.push(marker);
		});
	}

	function addStationMarkers() {
		stationMarkers.forEach(m => m.map = null);
		stationMarkers = [];

		stations.forEach(station => {
			const el = createPinElement('#3B82F6', '🚇', 0.9);
			const marker = new google.maps.marker.AdvancedMarkerElement({
				map: showTransit ? map : null,
				position: { lat: station.lat, lng: station.lng },
				content: el,
				title: station.name,
			});

			marker.addListener('click', () => {
				if (infoWindow && map) {
					infoWindow.setContent(`
						<div style="color:#1d1d1f;padding:4px;min-width:160px;">
							<strong style="color:#3B82F6;">${station.name}</strong><br/>
							<span style="font-size:12px;">Transit Station</span>
							${station.lines ? `<br/><span style="color:#6e6e73;font-size:11px;">${station.lines}</span>` : ''}
						</div>
					`);
					infoWindow.open(map, marker);
				}
			});

			stationMarkers.push(marker);
		});
	}

	function addDemandMarkers() {
		demandMarkers.forEach(m => m.map = null);
		demandMarkers = [];

		demandProxies.forEach(poi => {
			const el = createPinElement('#22C55E', '●', 0.7);
			const marker = new google.maps.marker.AdvancedMarkerElement({
				map: showDemand ? map : null,
				position: { lat: poi.lat, lng: poi.lng },
				content: el,
				title: poi.name,
			});

			marker.addListener('click', () => {
				if (infoWindow && map) {
					infoWindow.setContent(`
						<div style="color:#1d1d1f;padding:4px;">
							<strong style="color:#22C55E;">${poi.name}</strong><br/>
							<span style="font-size:12px;">${poi.category || 'Demand Proxy'}</span>
						</div>
					`);
					infoWindow.open(map, marker);
				}
			});

			demandMarkers.push(marker);
		});
	}

	function addRadiusRings() {
		radiusCircles.forEach(c => c.setMap(null));
		radiusCircles = [];

		const center = { lat, lng };
		const rings = [
			{ radius: 300, color: '#22C55E', label: '300m' },
			{ radius: 500, color: '#EAB308', label: '500m' },
		];

		rings.forEach(ring => {
			const circle = new google.maps.Circle({
				map: showRadiusRings ? map : null,
				center,
				radius: ring.radius,
				strokeColor: ring.color,
				strokeOpacity: 0.6,
				strokeWeight: 2,
				fillColor: ring.color,
				fillOpacity: 0.05,
			});
			radiusCircles.push(circle);
		});
	}

	function initStreetView() {
		if (!streetViewContainer) return;
		streetViewPanorama = new google.maps.StreetViewPanorama(streetViewContainer, {
			position: { lat, lng },
			pov: { heading: 0, pitch: 0 },
			zoom: 1,
			addressControl: false,
			showRoadLabels: false,
			motionTracking: false,
			motionTrackingControl: false,
		});
	}

	// Toggle handlers
	function toggleCompetitors() {
		showCompetitors = !showCompetitors;
		competitorMarkers.forEach(m => m.map = showCompetitors ? map : null);
	}

	function toggleTransit() {
		showTransit = !showTransit;
		stationMarkers.forEach(m => m.map = showTransit ? map : null);
	}

	function toggleDemand() {
		showDemand = !showDemand;
		demandMarkers.forEach(m => m.map = showDemand ? map : null);
	}

	function toggleRadius() {
		showRadiusRings = !showRadiusRings;
		radiusCircles.forEach(c => c.setMap(showRadiusRings ? map : null));
	}

	function toggleStreetView() {
		showStreetViewPanel = !showStreetViewPanel;
		if (showStreetViewPanel && !streetViewPanorama) {
			// Need a tick for the container to render
			setTimeout(() => initStreetView(), 50);
		}
	}

	onMount(async () => {
		if (!apiKey) {
			console.warn('GoogleMap: No API key provided');
			return;
		}
		try {
			await loadGoogleMaps();
			initMap();
		} catch (err) {
			console.error('GoogleMap init failed:', err);
		}
	});

	onDestroy(() => {
		competitorMarkers.forEach(m => m.map = null);
		stationMarkers.forEach(m => m.map = null);
		demandMarkers.forEach(m => m.map = null);
		radiusCircles.forEach(c => c.setMap(null));
	});
</script>

<div class="gmap-wrapper">
	<!-- Layer Controls -->
	<div class="layer-controls">
		<button class="layer-btn" class:active={showCompetitors} onclick={toggleCompetitors}>
			<span class="dot" style="background: #EF4444;"></span> Competitors ({competitors.length})
		</button>
		<button class="layer-btn" class:active={showTransit} onclick={toggleTransit}>
			<span class="dot" style="background: #3B82F6;"></span> Transit ({stations.length})
		</button>
		{#if demandProxies.length > 0}
			<button class="layer-btn" class:active={showDemand} onclick={toggleDemand}>
				<span class="dot" style="background: #22C55E;"></span> Demand ({demandProxies.length})
			</button>
		{/if}
		<button class="layer-btn" class:active={showRadiusRings} onclick={toggleRadius}>
			◎ Radius
		</button>
		<button class="layer-btn" class:active={showStreetViewPanel} onclick={toggleStreetView}>
			👁️ Street View
		</button>
	</div>

	<!-- Main Map -->
	<div bind:this={mapContainer} class="map-container">
		{#if !apiKey}
			<div class="no-key-fallback">
				<p>🗺️ Google Maps API key required</p>
				<p class="sub">Set <code>PUBLIC_GOOGLE_MAPS_API_KEY</code> in your environment</p>
			</div>
		{/if}
	</div>

	<!-- Street View Panel -->
	{#if showStreetViewPanel}
		<div class="street-view-section">
			<div class="sv-header">
				<span>👁️ Street View — {businessType} Location</span>
				<button class="sv-close" onclick={() => showStreetViewPanel = false}>✕</button>
			</div>
			<div bind:this={streetViewContainer} class="street-view-container"></div>
		</div>
	{/if}
</div>

<style>
	.gmap-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid #d2d2d7;
		background: #f5f5f7;
	}

	.layer-controls {
		display: flex;
		gap: 6px;
		padding: 10px 12px;
		background: #ffffff;
		border-bottom: 1px solid #d2d2d7;
		flex-wrap: wrap;
	}

	.layer-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		border: 1px solid #d2d2d7;
		background: transparent;
		color: #6e6e73;
		border-radius: 20px;
		cursor: pointer;
		font-size: 0.78rem;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.layer-btn:hover {
		border-color: #0071E3;
		color: #1d1d1f;
	}

	.layer-btn.active {
		border-color: rgba(0, 113, 227, 0.3);
		color: #1d1d1f;
		background: rgba(0, 113, 227, 0.08);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		display: inline-block;
	}

	.map-container {
		width: 100%;
		height: 500px;
		position: relative;
	}

	.no-key-fallback {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: #6e6e73;
	}

	.no-key-fallback p {
		margin: 4px 0;
		font-size: 1rem;
	}

	.no-key-fallback .sub {
		font-size: 0.8rem;
		color: #8e8e93;
	}

	.no-key-fallback code {
		background: #f5f5f7;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.75rem;
	}

	.street-view-section {
		border-top: 1px solid #d2d2d7;
	}

	.sv-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: #ffffff;
		color: #1d1d1f;
		font-size: 0.85rem;
	}

	.sv-close {
		background: none;
		border: none;
		color: #6e6e73;
		cursor: pointer;
		font-size: 1rem;
		padding: 2px 6px;
	}

	.sv-close:hover {
		color: #1d1d1f;
	}

	.street-view-container {
		width: 100%;
		height: 280px;
	}
</style>
