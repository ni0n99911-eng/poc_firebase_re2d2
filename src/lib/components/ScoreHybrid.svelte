<script lang="ts">
	/**
	 * ScoreHybrid — OSR-02: Single composite ring with sub-score detail.
	 *
	 * Replaces the dual Location IQ / Vision IQ ring display with one
	 * prominent hero ring showing the ensemble score (server-computed,
	 * consumed here — not calculated). Sub-scores shown as compact detail
	 * pills below the ring.
	 *
	 * Tier vocabulary sourced from BL-B1 canonical `tierFor()`.
	 */
	import { tierFor } from '$lib/intel/tiers';
	import type { LocationScoreResult, AlignmentScoreResult } from '$lib/re2-scores';
	// 04.25.2026 16:36 CoPilot Sanitization — defensive sanitizeHtml on verdict {@html}
	import { sanitizeHtml } from '$lib/utils/copilot-sanitize';

	interface Props {
		locationScore: LocationScoreResult | null;
		alignmentScore: AlignmentScoreResult | null;
		loading?: boolean;
		bizType?: string;
		/** @deprecated OSR-02 ignores locationRings — kept for API compat */
		locationRings?: unknown;
		/** @deprecated OSR-02 ignores fitRings — kept for API compat */
		fitRings?: unknown;
		verdict?: string | null;
		insight?: { title: string; text: string } | null;
	}

	const {
		locationScore = null,
		alignmentScore = null,
		loading = false,
		verdict = null,
		insight = null
	}: Props = $props();

	// Ensemble score = the composite the server ships as locationScore.score
	let score = $derived(locationScore?.score ?? 0);
	let tier = $derived(tierFor(score, 'locationIQ'));
	let liq = $derived(locationScore?.score ?? 0);
	let viq = $derived(alignmentScore?.score ?? 0);
	let viqTier = $derived(tierFor(viq, 'visionIQ'));

	// Tier → CSS color
	function tierColor(color: string): string {
		switch (color) {
			case 'green': return '#10b981';
			case 'amber': return '#f59e0b';
			case 'red':   return '#ef4444';
			default:      return '#9ca3af';
		}
	}

	// Ring math
	const RADIUS = 56;
	const CIRC = 2 * Math.PI * RADIUS;

	// Animate on mount
	let animatedScore = $state(0);
	let hasAnimated = $state(false);
	$effect(() => {
		if (!loading && !hasAnimated && score > 0) {
			hasAnimated = true;
			const target = score;
			const duration = 1000;
			const start = performance.now();
			function tick(now: number) {
				const p = Math.min((now - start) / duration, 1);
				const ease = 1 - Math.pow(1 - p, 3);
				animatedScore = Math.round(target * ease);
				if (p < 1) requestAnimationFrame(tick);
			}
			requestAnimationFrame(tick);
		}
	});
</script>

<div class="sh-container">
	{#if loading}
		<div class="sh-shimmer"></div>
	{:else}
		<!-- Verdict strip -->
		{#if verdict}
			<div class="sh-verdict">{@html sanitizeHtml(verdict)}</div>
		{/if}

		<!-- Hero ring -->
		<div class="sh-ring-wrap">
			<svg viewBox="0 0 128 128" class="sh-ring-svg">
				<!-- Track -->
				<circle cx="64" cy="64" r={RADIUS} fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="7" />
				<!-- Fill -->
				{#if score > 0}
				<circle cx="64" cy="64" r={RADIUS} fill="none"
					stroke={tierColor(tier.color)} stroke-width="7"
					stroke-linecap="round"
					stroke-dasharray={CIRC}
					stroke-dashoffset={CIRC * (1 - score / 100)}
					style="transform-origin:64px 64px;transform:rotate(-90deg);transition:stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)"
				/>
				{/if}
			</svg>
			<div class="sh-ring-center">
				<div class="sh-ring-num">{animatedScore || '—'}</div>
				<div class="sh-ring-of">/100</div>
				<div class="sh-ring-tier" style="color:{tierColor(tier.color)}">{tier.label}</div>
			</div>
		</div>

		<!-- Sub-scores -->
		{#if liq > 0 || viq > 0}
		<div class="sh-sub-row">
			{#if liq > 0}
				{@const lt = tierFor(liq, 'locationIQ')}
				<div class="sh-sub-pill">
					<span class="sh-sub-label">Location</span>
					<span class="sh-sub-val">{liq}</span>
					<span class="sh-sub-tier" style="color:{tierColor(lt.color)}">{lt.label}</span>
				</div>
			{/if}
			{#if viq > 0}
				<div class="sh-sub-pill">
					<span class="sh-sub-label">Concept</span>
					<span class="sh-sub-val">{viq}</span>
					<span class="sh-sub-tier" style="color:{tierColor(viqTier.color)}">{viqTier.label}</span>
				</div>
			{/if}
		</div>
		{/if}

		<!-- Insight -->
		{#if insight}
			<div class="sh-insight" style="border-left-color:{tierColor(tier.color)}">
				<div class="sh-insight-title" style="color:{tierColor(tier.color)}">{insight.title}</div>
				<div class="sh-insight-text">{insight.text}</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.sh-container {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}
	.sh-shimmer {
		width: 100%;
		height: 280px;
		background: linear-gradient(90deg, var(--surface-elevated, #f9fafb) 25%, var(--border, #e5e7eb) 50%, var(--surface-elevated, #f9fafb) 75%);
		background-size: 200% 100%;
		animation: sh-shim 1.5s infinite;
		border-radius: 16px;
	}
	@keyframes sh-shim { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

	.sh-verdict {
		background: var(--surface-elevated, #f9fafb);
		border-radius: 12px;
		padding: 16px 20px;
		font-size: 15px;
		font-weight: 500;
		line-height: 1.5;
		color: var(--text, #1f2937);
		width: 100%;
	}
	:global(.sh-verdict .good) { color: #10b981; }
	:global(.sh-verdict .warn) { color: #f59e0b; }
	:global(.sh-verdict .bad) { color: #ef4444; }

	/* Hero ring — large and prominent (OSR-02) */
	.sh-ring-wrap {
		position: relative;
		width: 200px;
		height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.sh-ring-svg {
		width: 100%;
		height: 100%;
	}
	.sh-ring-center {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
	}
	.sh-ring-num {
		font-size: 40px;
		font-weight: 800;
		color: var(--text, #1f2937);
		line-height: 1;
	}
	.sh-ring-of {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary, #6b7280);
	}
	.sh-ring-tier {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.3px;
		text-transform: uppercase;
		margin-top: 2px;
	}

	/* Sub-score pills */
	.sh-sub-row {
		display: flex;
		gap: 12px;
		justify-content: center;
	}
	.sh-sub-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: var(--surface-elevated, #f9fafb);
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 8px;
	}
	.sh-sub-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary, #6b7280);
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}
	.sh-sub-val {
		font-size: 14px;
		font-weight: 800;
		color: var(--text, #1f2937);
	}
	.sh-sub-tier {
		font-size: 11px;
		font-weight: 700;
	}

	/* Insight card */
	.sh-insight {
		width: 100%;
		background: var(--surface-elevated, #f9fafb);
		border-radius: 12px;
		border-left: 3px solid #10b981;
		padding: 16px 20px;
	}
	.sh-insight-title {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		margin-bottom: 6px;
	}
	.sh-insight-text {
		font-size: 13px;
		color: var(--text-secondary, #6b7280);
		line-height: 1.5;
	}
</style>
