<script lang="ts">
	import { onMount } from 'svelte';

	let { score, verdict, verdictSentence, personaEmoji, personaLabel } = $props();

	const RING_RADIUS = 60;
	const RING_STROKE_WIDTH = 8;
	const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});

	const getColor = (value: number) => {
		if (value >= 70) return 'var(--green)'; // green
		if (value >= 50) return 'var(--amber)'; // amber
		return 'var(--red)'; // red
	};

	const getGlowColor = (value: number) => {
		if (value >= 70) return 'rgba(5, 150, 105, 0.15)'; // green glow
		if (value >= 50) return 'rgba(180, 83, 9, 0.15)'; // amber glow
		return 'rgba(220, 38, 38, 0.15)'; // red glow
	};

	const ringColor = $derived(getColor(score));
	const glowColor = $derived(getGlowColor(score));
	const strokeDasharray = $derived(`${(score / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`);
</script>

<div class="card">
	<!-- Persona Badge -->
	<div class="persona-badge">
		<span class="emoji">{personaEmoji}</span>
		<span class="label">{personaLabel}</span>
	</div>

	<!-- SVG Ring -->
	<div class="ring-container">
		<svg
			class="ring-svg"
			viewBox="0 0 160 160"
			width="160"
			height="160"
		>
			<!-- Background track -->
			<circle
				cx="80"
				cy="80"
				r={RING_RADIUS}
				fill="none"
				stroke="var(--border)"
				stroke-width={RING_STROKE_WIDTH}
			/>

			<!-- Animated score arc -->
			<circle
				cx="80"
				cy="80"
				r={RING_RADIUS}
				fill="none"
				stroke={ringColor}
				stroke-width={RING_STROKE_WIDTH}
				stroke-dasharray={mounted ? strokeDasharray : '0 ' + CIRCUMFERENCE}
				stroke-dashoffset="-40"
				stroke-linecap="round"
				class="score-arc"
				filter="url(#glow)"
			/>

			<!-- Glow filter -->
			<defs>
				<filter id="glow">
					<feGaussianBlur stdDeviation="2" result="coloredBlur" />
					<feMerge>
						<feMergeNode in="coloredBlur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			<!-- Score text -->
			<text x="80" y="80" text-anchor="middle" dominant-baseline="central" class="score-text">
				{score}
			</text>

			<!-- "out of 100" label -->
			<text x="80" y="100" text-anchor="middle" dominant-baseline="central" class="label-text">
				out of 100
			</text>
		</svg>

		<!-- Box shadow/glow effect -->
		<div class="ring-glow" style="box-shadow: 0 0 32px {glowColor};" />
	</div>

	<!-- Verdict Pill -->
	<div class="verdict-pill" style="background-color: {ringColor}15; color: {ringColor};">
		{verdict}
	</div>

	<!-- Verdict Sentence -->
	<p class="verdict-sentence">
		{verdictSentence}
	</p>

	<!-- FICO Analogy -->
	<p class="fico-line">
		Think of this as your storefront's credit score — it tells you how likely this location is to work for your concept.
	</p>
</div>

<style>
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
		padding: 32px;
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.persona-badge {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background-color: var(--bg);
		border-radius: 20px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.emoji {
		font-size: 16px;
	}

	.ring-container {
		position: relative;
		width: 160px;
		height: 160px;
	}

	.ring-svg {
		display: block;
		margin: 0 auto;
	}

	.ring-glow {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 160px;
		height: 160px;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		pointer-events: none;
	}

	.score-arc {
		transition: stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1);
		transform-origin: 80px 80px;
		transform: rotate(-90deg);
	}

	.score-text {
		font-size: 48px;
		font-weight: 700;
		fill: var(--text);
		font-family: 'Playfair Display', Georgia, serif;
		letter-spacing: -0.5px;
	}

	.label-text {
		font-size: 14px;
		fill: var(--text-dim);
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-weight: 400;
	}

	.verdict-pill {
		padding: 8px 16px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.3px;
	}

	.verdict-sentence {
		max-width: 400px;
		text-align: center;
		font-size: 15px;
		line-height: 1.5;
		color: var(--text-secondary);
		margin: 0;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.fico-line {
		max-width: 420px;
		text-align: center;
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-dim);
		margin: 0;
		font-style: italic;
	}
</style>
