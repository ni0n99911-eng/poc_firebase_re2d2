<script lang="ts">
	let {
		scores = {},
		benchmarks = {},
		cityAverages = {},
		confidence = {},
		compositeScore = 0,
		spokeLabels = ['Transit', 'Competition', 'Demographics', 'Pulse', 'Safety', 'Momentum'],
		personaType = 'concept',
		conceptShort = 'your concept',
		size = 420,
	}: {
		scores?: Record<string, number>;
		benchmarks?: Record<string, number>;
		cityAverages?: Record<string, number>;
		confidence?: Record<string, number>;
		compositeScore?: number;
		spokeLabels?: string[];
		personaType?: string;
		conceptShort?: string;
		size?: number;
	} = $props();

	// SVG dimensions and geometry
	const spokes = 6;
	const padding = 60; // Space for labels
	const maxRadius = (size - padding * 2) / 2;
	const cx = size / 2;
	const cy = size / 2;
	const centerRadius = 28;

	// Index order for the spokes
	const indexOrder = ['transit', 'competition', 'demographics', 'vibrancy', 'safety', 'momentum'];

	// Animation state
	let mounted = $state(false);
	let animationPhase = $state(0); // 0-4 for each ring + final

	// Hover state
	let hoveredSpoke = $state<number | null>(null);
	let tooltipPos = $state({ x: 0, y: 0 });
	let tooltipData = $state('');

	// Calculate vertex position for a given spoke and radius
	function getVertex(spokeIndex: number, radius: number) {
		const angle = (spokeIndex * 60 - 90) * (Math.PI / 180); // Start from top, go clockwise
		const x = cx + radius * Math.cos(angle);
		const y = cy + radius * Math.sin(angle);
		return { x, y };
	}

	// Build polygon path from data ring
	function buildPolygonPath(ringData: Record<string, number>, maxRad: number): string {
		const points = indexOrder.map((idx, i) => {
			const score = Math.max(0, Math.min(100, ringData[idx] || 0));
			const radius = (score / 100) * maxRad;
			const vertex = getVertex(i, radius);
			return `${vertex.x},${vertex.y}`;
		});
		return `M ${points.join(' L ')} Z`;
	}

	// Spoke label positioning
	function getLabelPos(spokeIndex: number) {
		const labelDist = maxRadius + 35;
		const vertex = getVertex(spokeIndex, labelDist);
		return vertex;
	}

	// Score color coding
	function scoreColor(value: number): string {
		if (value >= 80) return '#10B981'; // Green
		if (value >= 60) return '#F59E0B'; // Yellow
		return '#EF4444'; // Red
	}

	// Tooltip handler
	function handleSpokeHover(spokeIndex: number, e: MouseEvent) {
		hoveredSpoke = spokeIndex;
		const idx = indexOrder[spokeIndex];
		const score = scores[idx] || 0;
		const benchmark = benchmarks[idx] || 0;
		const cityAvg = cityAverages[idx] || 0;
		const conf = confidence[idx] || 0;

		tooltipData = `${spokeLabels[spokeIndex]}\nYour Score: ${Math.round(score)}\nBenchmark: ${Math.round(benchmark)}\nCity Avg: ${Math.round(cityAvg)}\nConfidence: ${Math.round(conf)}%`;

		const rect = (e.target as SVGElement).getBoundingClientRect();
		tooltipPos = {
			x: rect.left + window.scrollX,
			y: rect.top + window.scrollY - 50,
		};
	}

	function handleSpokeLeave() {
		hoveredSpoke = null;
	}

	// Export as PNG functionality
	async function exportAsPNG() {
		const svg = document.getElementById('radial-compass-svg') as SVGElement;
		if (!svg) return;

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const svgData = new XMLSerializer().serializeToString(svg);
		const img = new Image();
		const blob = new Blob([svgData], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);

		img.onload = () => {
			canvas.width = size * 2; // 2x for retina
			canvas.height = size * 2;
			ctx.scale(2, 2);
			ctx.fillStyle = 'var(--bg)';
			ctx.fillRect(0, 0, size, size);
			ctx.drawImage(img, 0, 0);

			const link = document.createElement('a');
			link.href = canvas.toDataURL('image/png');
			link.download = `re2-compass-${personaType}.png`;
			link.click();

			URL.revokeObjectURL(url);
		};

		img.src = url;
	}

	// Animation setup
	$effect(() => {
		mounted = true;
		let ringIndex = 0;
		const intervalId = setInterval(() => {
			if (ringIndex < 5) {
				animationPhase = ringIndex + 1;
				ringIndex++;
			} else {
				clearInterval(intervalId);
			}
		}, 100);
		return () => clearInterval(intervalId);
	});

	// Ring animation scale factor
	function getRingScale(ringNum: number): number {
		if (animationPhase >= ringNum) {
			const delay = (ringNum - 1) * 100;
			const elapsed = Date.now() % 600; // 0.6s total animation
			if (elapsed >= delay) {
				const progress = Math.min(1, (elapsed - delay) / 500); // 0.5s per ring
				// Ease-out cubic
				return 1 - Math.pow(1 - progress, 3);
			}
		}
		return 0;
	}

	// Reactive animation values
	let ring1Scale = $derived(getRingScale(1));
	let ring2Scale = $derived(getRingScale(2));
	let ring3Scale = $derived(getRingScale(3));
	let ring4Scale = $derived(getRingScale(4));

	// Calculate visible ring data based on animation
	let visibleScores = $derived.by(() => {
		if (ring1Scale < 1) {
			return Object.fromEntries(
				indexOrder.map((idx) => [idx, (scores[idx] || 0) * ring1Scale])
			);
		}
		return scores;
	});

	let visibleBenchmarks = $derived.by(() => {
		if (ring2Scale < 1) {
			return Object.fromEntries(
				indexOrder.map((idx) => [idx, (benchmarks[idx] || 0) * ring2Scale])
			);
		}
		return benchmarks;
	});

	let visibleCityAverages = $derived.by(() => {
		if (ring3Scale < 1) {
			return Object.fromEntries(
				indexOrder.map((idx) => [idx, (cityAverages[idx] || 0) * ring3Scale])
			);
		}
		return cityAverages;
	});

	let visibleConfidence = $derived.by(() => {
		if (ring4Scale < 1) {
			return Object.fromEntries(
				indexOrder.map((idx) => [idx, (confidence[idx] || 0) * ring4Scale])
			);
		}
		return confidence;
	});
</script>

<div class="compass-container">
	<svg
		id="radial-compass-svg"
		viewBox="0 0 {size} {size}"
		width={size}
		height={size}
		class="radial-compass"
	>
		<!-- Background -->
		<rect width={size} height={size} fill="var(--bg)" />

		<!-- Grid lines and reference circles -->
		<g class="grid" opacity="0.3">
			<!-- Reference circles at 25%, 50%, 75%, 100% -->
			{#each [0.25, 0.5, 0.75, 1] as scale}
				<circle
					cx={cx}
					cy={cy}
					r={maxRadius * scale}
					fill="none"
					stroke="#D1D5DB"
					stroke-width="0.5"
				/>
			{/each}

			<!-- Spoke lines -->
			{#each Array.from({ length: spokes }) as _, i}
				{@const vertex = getVertex(i, maxRadius)}
				<line x1={cx} y1={cy} x2={vertex.x} y2={vertex.y} stroke="#D1D5DB" stroke-width="0.5" />
			{/each}
		</g>

		<!-- Ring 4: Trust Ring (confidence) — dotted, orange, innermost data -->
		<g class="ring ring-4" opacity={ring4Scale}>
			<path
				d={buildPolygonPath(visibleConfidence, maxRadius)}
				fill="none"
				stroke="#F97316"
				stroke-width="1.5"
				stroke-dasharray="2,4"
				vector-effect="non-scaling-stroke"
			/>
		</g>

		<!-- Ring 3: City Pulse (city averages) — dotted, purple -->
		<g class="ring ring-3" opacity={ring3Scale}>
			<path
				d={buildPolygonPath(visibleCityAverages, maxRadius)}
				fill="none"
				stroke="#8B5CF6"
				stroke-width="1"
				stroke-dasharray="3,3"
				vector-effect="non-scaling-stroke"
			/>
		</g>

		<!-- Ring 2: Category Benchmark — dashed, green -->
		<g class="ring ring-2" opacity={ring2Scale}>
			<path
				d={buildPolygonPath(visibleBenchmarks, maxRadius)}
				fill="none"
				stroke="#10B981"
				stroke-width="1.5"
				stroke-dasharray="6,3"
				vector-effect="non-scaling-stroke"
			/>
		</g>

		<!-- Ring 1: Your Concept Fit — filled, blue -->
		<g class="ring ring-1" opacity={ring1Scale}>
			<path
				d={buildPolygonPath(visibleScores, maxRadius)}
				fill="#3B82F6"
				fill-opacity="0.12"
				stroke="#3B82F6"
				stroke-width="2"
				vector-effect="non-scaling-stroke"
			/>

			<!-- Vertex dots for Ring 1 -->
			{#each Array.from({ length: spokes }) as _, i}
				{@const score = Math.max(0, Math.min(100, visibleScores[indexOrder[i]] || 0))}
				{@const radius = (score / 100) * maxRadius}
				{@const vertex = getVertex(i, radius)}
				<circle
					cx={vertex.x}
					cy={vertex.y}
					r="6"
					fill="#3B82F6"
					stroke="white"
					stroke-width="2"
					class="vertex-dot"
					on:mouseenter={(e) => handleSpokeHover(i, e)}
					on:mouseleave={handleSpokeLeave}
					role="button"
					tabindex="0"
				/>
			{/each}
		</g>

		<!-- Center circle with composite score -->
		<g class="center">
			<circle cx={cx} cy={cy} r={centerRadius} fill="var(--bg)" stroke="#3B82F6" stroke-width="2" />
			<text
				x={cx}
				y={cy - 4}
				text-anchor="middle"
				dominant-baseline="middle"
				class="center-score"
				fill="#3B82F6"
			>
				{Math.round(compositeScore)}
			</text>
			<text
				x={cx}
				y={cy + 12}
				text-anchor="middle"
				dominant-baseline="middle"
				class="center-sub"
				fill="var(--text-secondary, #5A6578)"
			>
				/100
			</text>
			<text
				x={cx}
				y={cy + 28}
				text-anchor="middle"
				dominant-baseline="middle"
				class="center-label"
				fill="var(--text-dim, #8B92A6)"
			>
				for {conceptShort}
			</text>
		</g>

		<!-- Spoke labels with color coding -->
		{#each Array.from({ length: spokes }) as _, i}
			{@const score = Math.max(0, Math.min(100, scores[indexOrder[i]] || 0))}
			{@const labelPos = getLabelPos(i)}
			<text
				x={labelPos.x}
				y={labelPos.y}
				text-anchor="middle"
				dominant-baseline="middle"
				class="spoke-label"
				fill={scoreColor(score)}
			>
				{spokeLabels[i]}: {Math.round(score)}
			</text>
		{/each}
	</svg>

	<!-- Tooltip -->
	{#if hoveredSpoke !== null && tooltipData}
		<div class="tooltip" style="left: {tooltipPos.x}px; top: {tooltipPos.y}px">
			{#each tooltipData.split('\n') as line}
				<div>{line}</div>
			{/each}
		</div>
	{/if}

	<!-- Legend -->
	<div class="legend">
		<div class="legend-item">
			<span class="legend-dot" style="background-color: #3B82F6;"></span>
			<span class="legend-text">Your Concept Fit</span>
		</div>
		<div class="legend-item">
			<span class="legend-dot" style="background-color: #10B981;"></span>
			<span class="legend-text">Category Benchmark</span>
		</div>
		<div class="legend-item">
			<span class="legend-dot" style="background-color: #8B5CF6;"></span>
			<span class="legend-text">City Pulse</span>
		</div>
		<div class="legend-item">
			<span class="legend-dot" style="background-color: #F97316;"></span>
			<span class="legend-text">Trust Ring</span>
		</div>
	</div>

	<!-- Export button -->
	<div class="export-container">
		<button class="export-button" on:click={exportAsPNG}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
				<polyline points="7 10 12 15 17 10"></polyline>
				<line x1="12" y1="15" x2="12" y2="3"></line>
			</svg>
			Export as PNG
		</button>
	</div>
</div>

<style>
	.compass-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		width: 100%;
		max-width: 500px;
		margin: 0 auto;
	}

	.radial-compass {
		display: block;
		width: 100%;
		height: auto;
		filter: drop-shadow(0 20px 25px rgba(0, 0, 0, 0.3));
	}

	/* SVG elements */
	.grid {
		opacity: 0.3;
		stroke: #6b7280;
	}

	.ring {
		transition: opacity 0.5s ease-out;
	}

	.ring-1 {
		animation: slideInRing1 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}

	.ring-2 {
		animation: slideInRing2 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.1s;
	}

	.ring-3 {
		animation: slideInRing3 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.2s;
	}

	.ring-4 {
		animation: slideInRing4 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.3s;
	}

	@keyframes slideInRing1 {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes slideInRing2 {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes slideInRing3 {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes slideInRing4 {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.center {
		filter: drop-shadow(0 4px 6px rgba(59, 130, 246, 0.2));
	}

	.center-score {
		font-size: 32px;
		font-weight: 700;
		letter-spacing: -0.5px;
	}

	.center-sub {
		font-size: 12px;
		font-weight: 500;
	}

	.center-label {
		font-size: 10px;
		font-weight: 400;
		letter-spacing: 0.5px;
	}

	.spoke-label {
		font-size: 11px;
		font-weight: 600;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
		transition: fill 0.2s ease;
	}

	.vertex-dot {
		cursor: pointer;
		transition: r 0.2s ease, filter 0.2s ease;
	}

	.vertex-dot:hover {
		r: 8;
		filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6));
	}

	/* Tooltip */
	.tooltip {
		position: fixed;
		background: var(--surface, #FFFFFF);
		border: 1px solid var(--border, #E0E5ED);
		border-radius: 8px;
		padding: 10px 14px;
		color: var(--text-secondary, #5A6578);
		font-size: 11px;
		font-weight: 500;
		line-height: 1.5;
		white-space: nowrap;
		pointer-events: none;
		z-index: 1000;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
		transform: translateX(-50%);
		animation: tooltipFadeIn 0.2s ease-out;
	}

	@keyframes tooltipFadeIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	/* Legend */
	.legend {
		display: flex;
		gap: 24px;
		justify-content: center;
		flex-wrap: wrap;
		width: 100%;
		padding: 16px;
		background: var(--surface-alt, #F0F3F7);
		border: 1px solid var(--border, #E0E5ED);
		border-radius: 10px;
		margin-top: 8px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-secondary, #5A6578);
	}

	.legend-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-text {
		font-weight: 500;
	}

	/* Export button */
	.export-container {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.export-button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 18px;
		background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
	}

	.export-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
	}

	.export-button:active {
		transform: translateY(0);
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
	}

	/* Responsive */
	@media (max-width: 600px) {
		.compass-container {
			max-width: 100%;
			padding: 0 16px;
		}

		.legend {
			gap: 12px;
		}

		.legend-item {
			font-size: 11px;
		}

		.export-button {
			font-size: 11px;
			padding: 8px 14px;
		}
	}
</style>
