<script>
	import { onMount, onDestroy } from 'svelte';

	let {
		lat = 40.7128,
		lng = -74.0060,
		competitors = [],
		stations = [],
		businessType = 'Cafe',
		onLocationChange = null
	} = $props();

	let mapContainer;
	let map;
	let mainMarker;

	onMount(async () => {
		// Load Leaflet CSS
		const cssLink = document.createElement('link');
		cssLink.rel = 'stylesheet';
		cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
		document.head.appendChild(cssLink);

		// Load Leaflet JS
		await new Promise((resolve) => {
			const script = document.createElement('script');
			script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
			script.onload = resolve;
			document.head.appendChild(script);
		});

		// Initialize map
		map = window.L.map(mapContainer).setView([lat, lng], 14);

		// Add light tile layer from CartoDB
		window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
			attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
			maxZoom: 19
		}).addTo(map);

		// Add main location marker (blue, draggable)
		mainMarker = window.L.marker([lat, lng], {
			draggable: true,
			icon: window.L.icon({
				iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIzNiIgdmlld0JveD0iMCAwIDI4IDM2Ij48cGF0aCBmaWxsPSIjNGE3YzVjIiBkPSJNMTQsMEM2LjMsMCwwLDYuMywwLDE0YzAsMTAuNSwxNCwyMiwxNCwyMnMxNC0xMS41LDE0LTIyQzI4LDYuMywyMS43LDAsMTQsMHoiLz48Y2lyY2xlIGN4PSIxNCIgY3k9IjE0IiByPSI2IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==',
				iconSize: [28, 36],
				iconAnchor: [14, 36],
				popupAnchor: [0, -36]
			})
		})
			.addTo(map)
			.bindPopup(`<strong>📍 You are here</strong><br/>${businessType}<br/>Lat: ${lat.toFixed(4)}<br/>Lng: ${lng.toFixed(4)}`);

		// Listen for drag end on main marker
		mainMarker.on('dragend', function () {
			const newLat = mainMarker.getLatLng().lat;
			const newLng = mainMarker.getLatLng().lng;
			mainMarker.setPopupContent(
				`<strong>${businessType} Location</strong><br/>Lat: ${newLat.toFixed(4)}<br/>Lng: ${newLng.toFixed(4)}`
			);
			if (onLocationChange) {
				onLocationChange({ lat: newLat, lng: newLng });
			}
		});

		// Add competitor markers (red circles)
		// UX-01: Format distance — normalize km→m for tiny values, round to nearest 10 m,
		// switch to km with one decimal at ≥1 km.
		/** @param {number | undefined} d */
		const fmtDist = (d) => {
			if (d == null || !isFinite(d) || d <= 0) return 'N/A';
			const meters = d < 20 ? Math.round(d * 1000) : d;
			if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
			return `${(meters / 1000).toFixed(1)} km`;
		};
		competitors.forEach((comp) => {
			window.L.marker([comp.lat, comp.lng], {
				icon: window.L.icon({
					iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iI0ZGNDQzMyIvPjwvc3ZnPg==',
					iconSize: [24, 24],
					iconAnchor: [12, 12],
					popupAnchor: [0, -12]
				})
			})
				.addTo(map)
				.bindPopup(`<strong>${comp.name}</strong><br/>Distance: ${fmtDist(comp.dist)}`);
		});

		// Add station markers (yellow squares)
		stations.forEach((station) => {
			window.L.marker([station.lat, station.lng], {
				icon: window.L.icon({
					iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHg9IjIiIHk9IjIiIGZpbGw9IiNGRkQyMDAiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+',
					iconSize: [24, 24],
					iconAnchor: [12, 12],
					popupAnchor: [0, -12]
				})
			})
				.addTo(map)
				.bindPopup(`<strong>${station.name}</strong><br/>Subway Station`);
		});

		// Add radius circles
		window.L.circle([lat, lng], {
			radius: 400,
			color: '#22C55E',
			fillColor: '#22C55E',
			fillOpacity: 0.15,
			weight: 2
		}).addTo(map);

		window.L.circle([lat, lng], {
			radius: 800,
			color: '#EAB308',
			fillColor: '#EAB308',
			fillOpacity: 0.1,
			weight: 2
		}).addTo(map);

		window.L.circle([lat, lng], {
			radius: 1200,
			color: '#EF4444',
			fillColor: '#EF4444',
			fillOpacity: 0.08,
			weight: 2
		}).addTo(map);

		// Fit bounds to show all markers — cap at zoom 15 so map never zooms out to NYC-wide
		if (competitors.length > 0 || stations.length > 0) {
			const group = window.L.featureGroup([mainMarker, ...competitors.map((c) => window.L.latLng(c.lat, c.lng)), ...stations.map((s) => window.L.latLng(s.lat, s.lng))]);
			map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
		}
	});

	onDestroy(() => {
		if (map) {
			map.remove();
		}
	});
</script>

<div bind:this={mapContainer} class="map-container"></div>

<style>
	.map-container {
		width: 100%;
		height: 400px;
		border-radius: 8px;
		border: 1px solid #333;
		background: #050508;
	}
</style>
