<script lang="ts">
	/**
	 * ScoreRangeBar — Credit Karma-style range bar under score rings.
	 * Shows: 5 colored segments, "You are here" pointer, concept benchmark line.
	 * Reusable across Dashboard and Location page.
	 */

	interface Props {
		score: number;
		concept?: string;
		scoreType?: 'fit' | 'location' | 'vision';
		showBenchmark?: boolean;
		compact?: boolean;
		borough?: string;
	}

	let {
		score = 0,
		concept = '',
		scoreType = 'fit',
		showBenchmark = true,
		compact = false,
		borough = 'NYC'
	}: Props = $props();

	// ── Range segments ──
	// EF-4 (April 11): Labels sourced from canonical tierFor — same vocabulary
	// the pill, narrative engine, and Watch Out contract use.
	import { tierFor } from '$lib/intel/tiers';
	const segments = [
		{ min: 0,  max: 39,  label: tierFor(20, 'fitIQ').label, color: '#FF3B30', width: 40 },
		{ min: 40, max: 49,  label: tierFor(45, 'fitIQ').label, color: '#FF9500', width: 10 },
		{ min: 50, max: 64,  label: tierFor(55, 'fitIQ').label, color: '#FFD60A', width: 15 },
		{ min: 65, max: 74,  label: tierFor(70, 'fitIQ').label, color: '#0071E3', width: 10 },
		{ min: 75, max: 100, label: tierFor(85, 'fitIQ').label, color: '#34C759', width: 25 },
	];

	// ── Concept benchmarks — avg scores per concept, label uses dynamic borough ──
	const conceptAvgs: Record<string, Record<string, { avg: number; name: string }>> = {
		fit: {
			coffee_shop:              { avg: 62, name: 'coffee shop' },
			specialty_coffee:         { avg: 62, name: 'specialty coffee' },
			bakery:                   { avg: 60, name: 'bakery' },
			restaurant:               { avg: 58, name: 'restaurant' },
			full_service_restaurant:  { avg: 58, name: 'full-service restaurant' },
			fast_casual:              { avg: 61, name: 'fast casual' },
			qsr:                      { avg: 64, name: 'QSR' },
			fitness_studio:           { avg: 65, name: 'fitness studio' },
			gym:                      { avg: 65, name: 'gym / fitness' },
			bar_nightlife:            { avg: 55, name: 'bar' },
			retail:                   { avg: 57, name: 'retail' },
			spa_wellness:             { avg: 60, name: 'spa / wellness' },
			personal_services:        { avg: 63, name: 'personal services' },
			barbershop:               { avg: 66, name: 'barbershop' },
			florist:                  { avg: 59, name: 'florist' },
			medical_dental:           { avg: 68, name: 'medical/dental' },
		},
		location: {
			_default: { avg: 64, name: 'location score' }
		},
		vision: {
			_default: { avg: 55, name: 'vision score (first pass)' }
		}
	};

	// Build labels dynamically using borough prop
	let conceptBenchmarks = $derived.by(() => {
		const result: Record<string, Record<string, { avg: number; label: string }>> = {};
		for (const [type, pool] of Object.entries(conceptAvgs)) {
			result[type] = {};
			for (const [key, val] of Object.entries(pool)) {
				result[type][key] = { avg: val.avg, label: `Avg ${val.name} in ${borough}` };
			}
		}
		return result;
	});

	// ── Derived state ──
	let benchmark = $derived.by(() => {
		const pool = conceptBenchmarks[scoreType] || {};
		return pool[concept] || pool['_default'] || { avg: 60, label: 'NYC average' };
	});

	let pointerPct = $derived(Math.min(Math.max(score, 0), 100));
	let benchPct   = $derived(Math.min(Math.max(benchmark.avg, 0), 100));

	let activeSegment = $derived(
		segments.find(s => score >= s.min && score <= s.max) || segments[0]
	);

	let delta = $derived(benchmark.avg - score);
	let deltaText = $derived.by(() => {
		if (delta > 0) return `+${delta} pts to reach the ${benchmark.label.split(' ').slice(1).join(' ')} average`;
		if (delta < -5) return `${Math.abs(delta)} pts above average — strong position`;
		return 'Right at the market average';
	});
</script>

<div class="range-bar-wrap" class:compact>

	<!-- ── Bar: segments + pointer above + benchmark tick ── -->
	<div class="bar-region">
		<!-- Pointer label + arrow (above bar) -->
		<div class="pointer-wrap" style="left: {pointerPct}%;">
			<div class="pointer-label">You: {score}</div>
			<div class="pointer-arrow">▼</div>
		</div>

		<!-- Colored track -->
		<div class="range-track">
			{#each segments as seg}
				<div
					class="range-segment"
					class:active-seg={seg === activeSegment}
					style="width: {seg.width}%; background: {seg.color};"
					title="{seg.min}–{seg.max}: {seg.label}"
				></div>
			{/each}

			<!-- Benchmark tick (line only — no label inside bar) -->
			{#if showBenchmark}
				<div class="bench-tick-line" style="left: {benchPct}%;"></div>
			{/if}
		</div>
	</div>

	<!-- ── Segment labels row (in normal flow — no overlap) ── -->
	{#if !compact}
		<div class="seg-labels-row">
			{#each segments as seg}
				<div class="seg-label-cell" style="width: {seg.width}%;">{seg.label}</div>
			{/each}
		</div>
	{/if}

	<!-- ── Benchmark reference row (clearly below seg labels) ── -->
	{#if showBenchmark}
		<div class="bench-ref-row">
			<span class="bench-ref-dash" style="background: rgba(0,0,0,0.45);"></span>
			<span class="bench-ref-text">{benchmark.label}: {benchmark.avg}</span>
			{#if !compact}
				<span class="bench-ref-delta" style="color: {delta > 0 ? '#FF9500' : '#34C759'};">{deltaText}</span>
			{/if}
		</div>
	{/if}

</div>

<style>
	.range-bar-wrap {
		width: 100%;
		margin: 16px 0 8px;
	}
	.range-bar-wrap.compact {
		margin: 8px 0 4px;
	}

	/* ── Bar region: reserves space above for pointer, contains track ── */
	.bar-region {
		position: relative;
		padding-top: 32px; /* headroom for pointer-label + arrow above bar */
	}
	.compact .bar-region {
		padding-top: 26px;
	}

	/* ── Pointer (above bar, in .bar-region coordinate space) ── */
	.pointer-wrap {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		z-index: 3;
	}

	.pointer-label {
		font-size: 10px;
		font-weight: 700;
		color: #1D1D1F;
		background: white;
		padding: 1px 6px;
		border-radius: 4px;
		border: 1px solid #E5E5EA;
		white-space: nowrap;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
		line-height: 1.6;
	}

	.pointer-arrow {
		font-size: 10px;
		line-height: 1;
		color: #1D1D1F;
		margin-top: 1px;
	}

	/* ── Colored segment track ── */
	.range-track {
		display: flex;
		height: 14px;
		border-radius: 7px;
		overflow: hidden; /* clean edges — no bleed */
		position: relative;
	}
	.compact .range-track {
		height: 10px;
		border-radius: 5px;
	}

	.range-segment {
		height: 100%;
		flex-shrink: 0;
		transition: opacity 0.2s;
	}
	.range-segment:first-child { border-radius: 7px 0 0 7px; }
	.range-segment:last-child  { border-radius: 0 7px 7px 0; }
	.range-segment.active-seg  { opacity: 1; }

	/* ── Benchmark tick (vertical line on track) ── */
	.bench-tick-line {
		position: absolute;
		top: 0;
		width: 2px;
		height: 100%;
		background: rgba(0,0,0,0.55);
		border-radius: 1px;
		transform: translateX(-50%);
		z-index: 2;
	}

	/* ── Segment labels row (below bar, in flow) ── */
	.seg-labels-row {
		display: flex;
		margin-top: 5px;
	}

	.seg-label-cell {
		font-size: 9px;
		font-weight: 600;
		color: #6B7280;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: 0.2px;
		flex-shrink: 0;
	}

	/* ── Benchmark reference row (below seg labels, in flow) ── */
	.bench-ref-row {
		display: flex;
		align-items: baseline;
		gap: 5px;
		margin-top: 7px;
		flex-wrap: wrap;
	}

	.bench-ref-dash {
		display: inline-block;
		width: 14px;
		height: 2px;
		border-radius: 1px;
		flex-shrink: 0;
		position: relative;
		top: -2px;
	}

	.bench-ref-text {
		font-size: 9px;
		font-weight: 600;
		color: #6B7280;
		white-space: nowrap;
	}

	.bench-ref-delta {
		font-size: 10px;
		font-weight: 600;
		margin-left: 4px;
	}

	.compact .bench-ref-row {
		margin-top: 5px;
	}
	.compact .bench-ref-delta {
		display: none;
	}
</style>
