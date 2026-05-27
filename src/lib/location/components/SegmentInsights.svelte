<script lang="ts">
	import type { SegmentInsight, HeroMetric, CompetitorBlend, DailyRitualDensity } from '$lib/intel/segment-intel';
	import { conceptPriceLabel } from '$lib/utils/conceptNames';

	let { insight, bizType = '' }: { insight: SegmentInsight; bizType?: string } = $props();

	function sentimentColor(s: string): string {
		if (s === 'great') return '#34C759';
		if (s === 'good') return '#0071E3';
		if (s === 'caution') return '#FF9500';
		return '#FF3B30';
	}

	function sentimentBg(s: string): string {
		if (s === 'great') return 'rgba(52,199,89,0.08)';
		if (s === 'good') return 'rgba(0,113,227,0.06)';
		if (s === 'caution') return 'rgba(255,149,0,0.06)';
		return 'rgba(255,59,48,0.06)';
	}

	function confidenceLabel(c: string): string {
		if (c === 'high') return 'Live data';
		if (c === 'moderate') return 'Blended estimate';
		return 'Extrapolated';
	}

	function maxBreakdownValue(breakdown: { value: number }[]): number {
		return Math.max(...breakdown.map(b => b.value), 1);
	}
</script>

<div class="segment-insights">
	<!-- Section Header -->
	<div class="section-header">
		<div class="header-left">
			<span class="segment-icon">{insight.segmentIcon}</span>
			<div>
				<h3 class="section-title">What Matters for {insight.segmentLabel}</h3>
				<p class="section-sub">Metrics that decide success — extrapolated from 17 live data layers</p>
			</div>
		</div>
	</div>

	<!-- Hero Metric Cards -->
	<div class="hero-grid" style="--cols: {insight.heroMetrics.length}">
		{#each insight.heroMetrics as metric}
			<div class="hero-card" style="--accent: {metric.color}; --accent-bg: {sentimentBg(metric.sentiment)}">
				<div class="hero-top">
					<span class="hero-icon">{metric.icon}</span>
					<span class="confidence-tag" style="color: {metric.confidence === 'high' ? '#34C759' : metric.confidence === 'moderate' ? '#FF9500' : '#a1a1a6'}">
						{confidenceLabel(metric.confidence)}
					</span>
				</div>
				<div class="hero-value" style="color: {metric.color}">{metric.value}</div>
				<div class="hero-unit">{metric.unit}</div>
				<div class="hero-label">{metric.label}</div>
				<div class="hero-sublabel">{metric.sublabel}</div>

				{#if metric.breakdown}
					<div class="hero-breakdown">
						{#each metric.breakdown as bar}
							<div class="bar-row">
								<span class="bar-label">{bar.label}</span>
								<div class="bar-track">
									<div class="bar-fill" style="width: {(bar.value / maxBreakdownValue(metric.breakdown)) * 100}%; background: {bar.color || metric.color}"></div>
								</div>
								<span class="bar-val">{bar.value.toLocaleString()}</span>
							</div>
						{/each}
					</div>
				{/if}

				<div class="hero-interp" style="border-color: {sentimentColor(metric.sentiment)}">
					<span class="interp-dot" style="background: {sentimentColor(metric.sentiment)}"></span>
					{metric.interpretation}
				</div>
			</div>
		{/each}
	</div>

	<!-- Competitor Blend + Daily Ritual side by side -->
	{#if insight.competitorBlend || insight.dailyRitualDensity}
		<div class="intel-row">
			<!-- Competitor Pricing Blend -->
			{#if insight.competitorBlend}
				{@const comp = insight.competitorBlend}
				<div class="intel-card comp-card">
					<div class="intel-card-header">
						<span class="intel-icon">⚔️</span>
						<h4>Competitor Pricing</h4>
						<span class="sentiment-badge" style="background: {sentimentBg(comp.sentiment)}; color: {sentimentColor(comp.sentiment)}">
							{comp.sentiment === 'great' ? 'Opportunity' : comp.sentiment === 'good' ? 'Manageable' : comp.sentiment === 'caution' ? 'Competitive' : 'Saturated'}
						</span>
					</div>

					<div class="comp-stats">
						<div class="comp-stat big">
							<span class="comp-val">{comp.avgPrice || "—"}</span>
							<span class="comp-label">{conceptPriceLabel(bizType)}</span>
						</div>
						<div class="comp-stat">
							<span class="comp-val">{comp.priceRange || "—"}</span>
							<span class="comp-label">Price range</span>
						</div>
						<div class="comp-stat">
							<span class="comp-val">{comp.avgRating > 0 ? comp.avgRating + '/5' : '—'}</span>
							<span class="comp-label">Avg rating</span>
						</div>
					</div>

					<!-- Chain vs Independent bar -->
					<div class="chain-bar-wrap">
						<div class="chain-bar">
							<div class="chain-fill" style="width: {comp.chainPct}%">
								{#if comp.chainPct > 15}
									<span>{comp.chainPct}% chain</span>
								{/if}
							</div>
							<div class="indie-fill" style="width: {comp.independentPct}%">
								{#if comp.independentPct > 15}
									<span>{comp.independentPct}% indie</span>
								{/if}
							</div>
						</div>
						<div class="chain-labels">
							<span>🏪 Chains ({comp.chainPct}%)</span>
							<span>☕ Independent ({comp.independentPct}%)</span>
						</div>
					</div>

					<!-- Top competitors -->
					{#if comp.topCompetitors.length > 0}
						<div class="top-comps">
							{#each comp.topCompetitors.slice(0, 4) as c}
								<div class="comp-row">
									<span class="comp-name" class:chain={c.isChain}>{c.name}</span>
									<span class="comp-dist">{Math.round(c.distance)}m</span>
									<span class="comp-price">{c.price != null ? '$' + c.price.toFixed(2) : '—'}</span>
									{#if c.rating > 0}
										<span class="comp-rating">★ {c.rating.toFixed(1)}</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<div class="intel-insight">{comp.marketGap}</div>
				</div>
			{/if}

			<!-- Daily Ritual Density -->
			{#if insight.dailyRitualDensity}
				{@const ritual = insight.dailyRitualDensity}
				<div class="intel-card ritual-card">
					<div class="intel-card-header">
						<span class="intel-icon">🔄</span>
						<h4>Daily Ritual Density</h4>
						<span class="sentiment-badge" style="background: {sentimentBg(ritual.sentiment)}; color: {sentimentColor(ritual.sentiment)}">
							{ritual.label.replace('Daily Ritual Density', '').trim() || ritual.sentiment}
						</span>
					</div>

					<!-- Big number: estimated daily repeat customers -->
					<div class="ritual-hero">
						<div class="ritual-number" style="color: {sentimentColor(ritual.sentiment)}">
							~{ritual.estimatedDailyRitualPop.toLocaleString()}
						</div>
						<div class="ritual-label">estimated daily ritual buyers</div>
					</div>

					<!-- Score ring -->
					<div class="ritual-ring-wrap">
						<svg viewBox="0 0 100 100" width="90" height="90">
							<circle cx="50" cy="50" r="40" fill="none" stroke="#f0f0f0" stroke-width="7" />
							<circle cx="50" cy="50" r="40" fill="none"
								stroke={sentimentColor(ritual.sentiment)}
								stroke-width="7"
								stroke-linecap="round"
								stroke-dasharray="{(ritual.score / 100) * 251.3} 251.3"
								transform="rotate(-90 50 50)"
							/>
						</svg>
						<div class="ritual-ring-center">
							<span class="ritual-ring-num" style="color: {sentimentColor(ritual.sentiment)}">{ritual.score}</span>
						</div>
					</div>

					<!-- Breakdown by source -->
					<div class="ritual-breakdown">
						{#each ritual.breakdown as src}
							<div class="ritual-src">
								<span class="ritual-src-icon">{src.icon}</span>
								<span class="ritual-src-type">{src.type}</span>
								<span class="ritual-src-count" style="color: {src.color}">{src.count}</span>
							</div>
						{/each}
					</div>

					<div class="intel-insight">{ritual.interpretation}</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* ── Section ── */
	.segment-insights {
		margin: 20px 0;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.segment-icon {
		font-size: 28px;
	}

	.section-title {
		font-size: 18px;
		font-weight: 700;
		color: #1d1d1f;
		margin: 0 0 2px;
		letter-spacing: -0.3px;
	}

	.section-sub {
		font-size: 13px;
		color: #6e6e73;
		margin: 0;
	}

	/* ── Hero Metric Cards ── */
	.hero-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols, 3), 1fr);
		gap: 14px;
		margin-bottom: 16px;
	}

	.hero-card {
		background: var(--accent-bg, #f9f9fb);
		border: 1px solid #e5e5ea;
		border-radius: 14px;
		padding: 18px;
		transition: all 0.2s ease;
		position: relative;
		overflow: hidden;
	}

	.hero-card::before {
		content: '';
		position: absolute;
		top: 0; left: 0; right: 0;
		height: 3px;
		background: var(--accent);
		border-radius: 14px 14px 0 0;
	}

	.hero-card:hover {
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
		transform: translateY(-2px);
	}

	.hero-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.hero-icon {
		font-size: 24px;
	}

	.confidence-tag {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.3px;
		text-transform: uppercase;
	}

	.hero-value {
		font-size: 36px;
		font-weight: 800;
		letter-spacing: -1px;
		line-height: 1.1;
		margin-bottom: 2px;
	}

	.hero-unit {
		font-size: 12px;
		color: #6e6e73;
		font-weight: 500;
		margin-bottom: 8px;
	}

	.hero-label {
		font-size: 14px;
		font-weight: 700;
		color: #1d1d1f;
		margin-bottom: 2px;
	}

	.hero-sublabel {
		font-size: 12px;
		color: #a1a1a6;
		margin-bottom: 12px;
	}

	/* ── Breakdown Bars ── */
	.hero-breakdown {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
		padding: 10px;
		background: rgba(255, 255, 255, 0.6);
		border-radius: 8px;
	}

	.bar-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.bar-label {
		font-size: 11px;
		color: #6e6e73;
		width: 65px;
		flex-shrink: 0;
	}

	.bar-track {
		flex: 1;
		height: 6px;
		background: #e5e5ea;
		border-radius: 3px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.8s ease;
	}

	.bar-val {
		font-size: 11px;
		font-weight: 600;
		color: #1d1d1f;
		width: 40px;
		text-align: right;
	}

	/* ── Interpretation ── */
	.hero-interp {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 12px;
		color: #1d1d1f;
		line-height: 1.5;
		padding: 10px 12px;
		background: rgba(255, 255, 255, 0.8);
		border-radius: 8px;
		border-left: 3px solid;
	}

	.interp-dot {
		width: 6px; height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		margin-top: 5px;
	}

	/* ── Intel Row (Competitor + Ritual side by side) ── */
	.intel-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}

	.intel-card {
		background: #fff;
		border: 1px solid #e5e5ea;
		border-radius: 14px;
		padding: 20px;
		overflow: hidden;
	}

	.intel-card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
	}

	.intel-icon {
		font-size: 20px;
	}

	.intel-card-header h4 {
		font-size: 15px;
		font-weight: 700;
		color: #1d1d1f;
		margin: 0;
		flex: 1;
	}

	.sentiment-badge {
		font-size: 11px;
		font-weight: 600;
		padding: 3px 10px;
		border-radius: 12px;
	}

	/* ── Competitor Stats ── */
	.comp-stats {
		display: flex;
		gap: 16px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	.comp-stat {
		text-align: center;
	}

	.comp-stat.big {
		flex: 1;
	}

	.comp-val {
		font-size: 22px;
		font-weight: 800;
		color: #1d1d1f;
		display: block;
		letter-spacing: -0.5px;
	}

	.comp-stat.big .comp-val {
		font-size: 32px;
	}

	.comp-label {
		font-size: 11px;
		color: #6e6e73;
		display: block;
		margin-top: 2px;
	}

	/* ── Chain vs Independent Bar ── */
	.chain-bar-wrap {
		margin-bottom: 14px;
	}

	.chain-bar {
		display: flex;
		height: 24px;
		border-radius: 6px;
		overflow: hidden;
		background: #f0f0f0;
	}

	.chain-fill {
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-size: 10px;
		font-weight: 600;
		transition: width 0.6s ease;
	}

	.indie-fill {
		background: linear-gradient(135deg, #f97316, #f59e0b);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-size: 10px;
		font-weight: 600;
		transition: width 0.6s ease;
	}

	.chain-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		font-size: 10px;
		color: #a1a1a6;
	}

	/* ── Top Competitors List ── */
	.top-comps {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 14px;
	}

	.comp-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		background: #f9f9fb;
		border-radius: 6px;
		font-size: 12px;
	}

	.comp-name {
		flex: 1;
		font-weight: 600;
		color: #1d1d1f;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.comp-name.chain {
		color: #6366f1;
	}

	.comp-dist {
		color: #a1a1a6;
		font-size: 11px;
	}

	.comp-price {
		font-weight: 700;
		color: #1d1d1f;
	}

	.comp-rating {
		color: #f59e0b;
		font-weight: 600;
		font-size: 11px;
	}

	/* ── Intel Insight ── */
	.intel-insight {
		font-size: 13px;
		color: #1d1d1f;
		line-height: 1.5;
		padding: 10px 12px;
		background: #f5f5f7;
		border-radius: 8px;
		font-weight: 500;
	}

	/* ── Daily Ritual Density ── */
	.ritual-hero {
		text-align: center;
		margin-bottom: 12px;
	}

	.ritual-number {
		font-size: 36px;
		font-weight: 800;
		letter-spacing: -1px;
		line-height: 1.1;
	}

	.ritual-label {
		font-size: 12px;
		color: #6e6e73;
		margin-top: 2px;
	}

	.ritual-ring-wrap {
		position: relative;
		width: 90px; height: 90px;
		margin: 0 auto 14px;
	}

	.ritual-ring-center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ritual-ring-num {
		font-size: 26px;
		font-weight: 800;
	}

	.ritual-breakdown {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 14px;
	}

	.ritual-src {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: #f9f9fb;
		border-radius: 6px;
	}

	.ritual-src-icon {
		font-size: 16px;
		width: 20px;
		text-align: center;
	}

	.ritual-src-type {
		flex: 1;
		font-size: 12px;
		font-weight: 500;
		color: #1d1d1f;
	}

	.ritual-src-count {
		font-size: 13px;
		font-weight: 700;
	}

	/* ── Responsive ── */
	@media (max-width: 768px) {
		.hero-grid {
			grid-template-columns: 1fr !important;
		}
		.intel-row {
			grid-template-columns: 1fr;
		}
		.hero-value {
			font-size: 28px;
		}
		.comp-stat.big .comp-val {
			font-size: 24px;
		}
	}

	@media (max-width: 480px) {
		.segment-insights {
			margin: 12px 0;
		}
		.hero-card {
			padding: 14px;
		}
		.intel-card {
			padding: 14px;
		}
	}
</style>
