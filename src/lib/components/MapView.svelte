<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';

	interface Competitor {
		name: string;
		lat: number;
		lng: number;
		dist?: number;
		type?: string;
		color?: string; // optional dot color (defaults to red #ff453a)
	}

	interface Props {
		lat?: number;
		lng?: number;
		zoom?: number;
		competitors?: Competitor[];
		compact?: boolean;
		showPin?: boolean;
	}

	const {
		lat = 40.7580,
		lng = -73.9855,
		zoom = 12,
		competitors = [],
		compact = false,
		showPin = false
	}: Props = $props();

	let container: HTMLDivElement;
	let map: maplibregl.Map | null = null;
	let mainMarker: maplibregl.Marker | null = null;
	let competitorMarkers: maplibregl.Marker[] = [];
	let mounted = $state(false);

	// Track previous values for reactive updates
	let prevLat = lat;
	let prevLng = lng;

	onMount(() => {
		// D3: Guard against map init before container is mounted in DOM.
		// Also explicitly set projection — maplibre-gl v5 throws
		// "Cannot read properties of undefined (reading 'projection')" when the
		// style spec omits projection (OpenFreeMap styles do).
		if (!container) {
			console.warn('[MapView] Container not ready — skipping map init');
			return;
		}
		try {
			map = new maplibregl.Map({
				container,
				style: 'https://tiles.openfreemap.org/styles/positron',
				center: [lng, lat],
				zoom: zoom,
				attributionControl: false,
				maxBounds: [[-74.35, 40.45], [-73.65, 40.95]], // Constrain to NYC area
				// UX-1.3: Set projection in constructor so maplibre-gl v5's internal
				// migrateProjection() call sees a defined projection before the style
				// loads. The previous on('style.load') handler fired too late —
				// "Cannot read properties of undefined (reading 'projection')" was
				// thrown synchronously inside the constructor for styles that omit
				// the projection spec (OpenFreeMap's positron).
				projection: { type: 'mercator' }
			} as any);

			// Defensive: re-apply on style.load in case projection config was
			// overwritten during style parse. Keeps the old behaviour as a belt.
			map.on('style.load', () => {
				try {
					map?.setProjection({ type: 'mercator' });
				} catch (projErr) {
					console.warn('[MapView] setProjection failed (non-fatal):', projErr);
				}
			});

			map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

			map.on('load', () => {
				mounted = true; // triggers $effect below which handles all marker rendering
				if (showPin) addMainMarker();
			});

			// D3: Catch runtime errors from tile loads / projection migration
			map.on('error', (e) => {
				console.warn('[MapView] Map runtime error (non-fatal):', e.error?.message ?? e);
			});
		} catch (err) {
			console.error('[MapView] Map initialization failed:', err);
			map = null;
		}
	});

	onDestroy(() => {
		if (map) {
			map.remove();
			map = null;
		}
	});

	// Reactive: fly to new location when lat/lng change
	$effect(() => {
		if (map && mounted && (lat !== prevLat || lng !== prevLng)) {
			prevLat = lat;
			prevLng = lng;
			map.flyTo({
				center: [lng, lat],
				zoom: 15.5,
				duration: 2000,
				essential: true
			});
			if (showPin) addMainMarker();
		}
	});

	// ISS-07: Reactive competitor markers.
	// Previous impl used reference equality (competitors !== prevCompetitors) which silently
	// skipped renders when MapView mounted after competitors were already populated (same ref).
	// Fix: subscribe to competitors unconditionally — addCompetitorMarkers() clears + redraws,
	// so calling it multiple times is safe and idempotent.
	$effect(() => {
		const _c = competitors; // reactive subscribe — re-runs whenever prop changes
		if (!map || !mounted) return;
		addCompetitorMarkers();
	});

	function addMainMarker() {
		if (!map) return;
		if (mainMarker) mainMarker.remove();

		// UX-T1: marker element uses a class so the @keyframes live in the
		// scoped <style> block above, not injected into the DOM as a <style> tag
		// (which caused literal CSS text to appear in page body content).
		const el = document.createElement('div');
		el.className = 're2-pulse-pin-marker';
		el.innerHTML = '<div class="re2-pin-dot"></div>';

		mainMarker = new maplibregl.Marker({ element: el })
			.setLngLat([lng, lat])
			.addTo(map);
	}

	// UX-01: Format competitor distance for display.
	// Raw `c.dist` can arrive in meters (Overpass/Yelp/Foursquare) or kilometers (some
	// upstream slices that pre-divide). Normalize tiny values (<20) as kilometers, then
	// format: <1 km → rounded to nearest 10 m, ≥1 km → one decimal km.
	function fmtDist(d: number | undefined): string {
		if (d == null || !isFinite(d) || d <= 0) return '';
		const meters = d < 20 ? Math.round(d * 1000) : d;
		if (meters < 1000) return `${Math.round(meters / 10) * 10} m away`;
		return `${(meters / 1000).toFixed(1)} km away`;
	}

	function addCompetitorMarkers() {
		if (!map) return;
		// Clear existing
		competitorMarkers.forEach(m => m.remove());
		competitorMarkers = [];

		competitors.forEach((c, idx) => {
			if (c.lat == null || c.lng == null || (c.lat === 0 && c.lng === 0)) return;

			// Outer wrapper: larger hit target, no visual change on hover
			const wrapper = document.createElement('div');
			wrapper.style.cssText = `
				width: 28px; height: 28px;
				display: flex; align-items: center; justify-content: center;
				cursor: pointer;
			`;

			// Inner dot: colored by outcome tier (defaults to red if no color provided)
			const dot = document.createElement('div');
			dot.style.cssText = `
				width: 14px; height: 14px;
				background: ${c.color || '#ff453a'};
				border: 2px solid rgba(255,255,255,0.6);
				border-radius: 50%;
				box-shadow: 0 1px 4px rgba(0,0,0,0.3);
				pointer-events: none;
			`;
			wrapper.appendChild(dot);

			const _distLabel = fmtDist(c.dist);
			const popup = new maplibregl.Popup({
				offset: 14,
				closeButton: false,
				maxWidth: '220px'
			}).setHTML(`
				<div style="padding: 4px 2px;">
					<div style="font-size: 13px; font-weight: 600; color: var(--text, #1A202C);">${c.name}</div>
					${_distLabel ? `<div style="font-size: 11px; color: var(--text-secondary, #5A6578); margin-top: 3px;">${_distLabel}</div>` : ''}
					${c.type ? `<div style="font-size: 10px; color: var(--text-dim, #8B92A6); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px;">${c.type}</div>` : ''}
				</div>
			`);

			const marker = new maplibregl.Marker({ element: wrapper })
				.setLngLat([c.lng, c.lat])
				.setPopup(popup)
				.addTo(map!);

			competitorMarkers.push(marker);
		});
	}

	// Public method to resize map (called when container changes size)
	export function resize() {
		if (map) {
			setTimeout(() => map?.resize(), 50);
		}
	}
</script>

<div class="map-container" class:compact bind:this={container}></div>

<style>
	.map-container {
		width: 100%;
		height: 100%;
		min-height: 400px;
		border-radius: 16px;
		overflow: hidden;
	}

	.map-container.compact {
		min-height: 0;
		border-radius: 12px;
	}

	/* UX-T1: keyframe moved from JS innerHTML to scoped <style> to prevent
	   literal CSS text appearing in page body content */
	@keyframes re2-pulse-pin {
		0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 0 2px 8px rgba(0,0,0,0.4); }
		50%       { box-shadow: 0 0 35px rgba(255, 215, 0, 0.9), 0 2px 12px rgba(0,0,0,0.5); }
	}
	:global(.re2-pulse-pin-marker) { display: block; }
	:global(.re2-pin-dot) {
		width: 20px; height: 20px;
		background: #FFD700;
		border: 3px solid #fff;
		border-radius: 50%;
		box-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 0 2px 8px rgba(0,0,0,0.4);
		animation: re2-pulse-pin 2s ease-in-out infinite;
	}

</style>
