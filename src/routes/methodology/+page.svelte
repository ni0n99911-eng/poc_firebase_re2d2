<script lang="ts">
	import { onMount } from 'svelte';
	import SiteNav from '$lib/components/SiteNav.svelte';

	// Body scroll now handled at CSS level (app.css) — no override needed
</script>

<svelte:head>
	<title>RE² — Our Methodology</title>
</svelte:head>

<SiteNav />

<div class="methodology-container">
	<div class="methodology-content">
		<h1>OUR APPROACH</h1>
		<div class="version-badge">LOCATION IQ FRAMEWORK v2.0</div>

		<p class="intro-text">
			RE² combines government data, mapping intelligence, and proprietary models to compute your Score — a composite of Neighborhood, Storefront, and Taste signals. Our engine pulls from 17 live data sources, with more connecting monthly.
		</p>
		<p class="intro-text" style="font-size: 0.85em; color: #667; margin-top: 8px;">
			This page describes our target architecture. Features marked with ✦ are live today. Others use proxy data with the same computation logic — results will improve as live sources come online.
		</p>

		<!-- What We Score -->
		<div class="engines-section">
			<h2 class="section-title">WHAT WE MEASURE</h2>
			<div class="engines-grid">
				<div class="engine-card">
					<h3>Location Fit</h3>
					<p>Does this neighborhood match your business? We analyze who lives and works nearby, what they spend, and whether the area aligns with your concept.</p>
				</div>
				<div class="engine-card">
					<h3>Financial Feasibility</h3>
					<p>Can you make money here? We model revenue potential, rent sustainability, and breakeven timelines using real foot traffic and market data.</p>
				</div>
				<div class="engine-card">
					<h3>Risk Assessment</h3>
					<p>What could go wrong? We flag building issues, regulatory hurdles, competitive threats, and economic vulnerability before you sign a lease.</p>
				</div>
				<div class="engine-card">
					<h3>Field Intelligence</h3>
					<p>What APIs can't see. Lease terms, block-level dynamics, and on-the-ground conditions that only show up when you walk the street.</p>
				</div>
			</div>
		</div>

		<!-- Data Sources -->
		<div class="layers-section">
			<h2 class="section-title">WHERE THE DATA COMES FROM</h2>
			<p class="section-desc">
				We pull from 17 live, authoritative sources — the same data NYC's own planners and analysts use. Nothing is estimated when real data exists.
			</p>

			<div class="source-categories">
				<div class="source-cat">
					<div class="source-cat-icon">🏛️</div>
					<h3>Government Data</h3>
					<p>Demographics, housing, building permits, zoning, property records, and regulatory filings from federal, state, and city agencies</p>
				</div>
				<div class="source-cat">
					<div class="source-cat-icon">🚇</div>
					<h3>Transit & Traffic</h3>
					<p>Subway ridership, pedestrian counts, walkability metrics, and transit accessibility scoring</p>
				</div>
				<div class="source-cat">
					<div class="source-cat-icon">🗺️</div>
					<h3>Mapping & POI</h3>
					<p>Real-time point-of-interest data, competitor mapping, neighborhood composition, and commercial density analysis</p>
				</div>
				<div class="source-cat">
					<div class="source-cat-icon">📊</div>
					<h3>Market & Economic</h3>
					<p>Business license activity, permit trends, commercial vibrancy signals, and safety indicators</p>
				</div>
			</div>

		</div>

		<!-- Trust Section -->
		<div class="scoring-section">
			<h2>HOW TO READ YOUR LOCATION IQ</h2>
			<p>
				Your Score is a composite intelligence measure that weighs neighborhood, storefront, and taste signals — each tuned to your business type, budget, and target location. The score adapts based on how much data is available:
			</p>

			<div class="confidence-section">
				<h3>Confidence Levels</h3>
				<div class="confidence-grid">
					<div class="confidence-item">
						<div class="confidence-band high">HIGH</div>
						<div class="confidence-label">Full data + field validation</div>
					</div>
					<div class="confidence-item">
						<div class="confidence-band moderate">GOOD</div>
						<div class="confidence-label">All automated data sources</div>
					</div>
					<div class="confidence-item">
						<div class="confidence-band low">MODERATE</div>
						<div class="confidence-label">Partial data coverage</div>
					</div>
					<div class="confidence-item">
						<div class="confidence-band preliminary">PRELIMINARY</div>
						<div class="confidence-label">Limited data available</div>
					</div>
				</div>
			</div>

			<p>
				A Score of 70+ indicates strong potential. 50-70 suggests moderate conditions with optimization opportunities. Below 50 signals significant challenges. Every report shows what data was used and where confidence is strongest — no black boxes.
			</p>
		</div>

		<!-- CTA -->
		<div class="fixes-section">
			<h2>SEE IT FOR YOURSELF</h2>
			<p>The best way to understand our methodology is to run your first analysis. Enter any NYC address and get your Score in 30 seconds.</p>
			<a href="/login" class="method-cta">Get Started</a>
		</div>
	</div>
</div>

<style>
	.methodology-container {
		display: flex;
		justify-content: center;
		padding: 80px 20px 40px 20px;
		background: var(--bg);
		min-height: 100vh;
	}

	.methodology-content {
		width: 100%;
		max-width: 900px;
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 8px;
		letter-spacing: -0.5px;
	}

	.version-badge {
		display: inline-block;
		padding: 4px 12px;
		background: var(--teal-bg);
		color: var(--teal);
		border: 1px solid var(--teal-ring);
		border-radius: 4px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.5px;
		margin-bottom: 16px;
	}

	.intro-text {
		font-size: 1.1rem;
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 48px;
		max-width: 700px;
	}

	.section-title {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 24px;
		letter-spacing: 1px;
	}

	/* Engines Grid */
	.engines-section {
		margin-bottom: 60px;
	}

	.engines-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.engine-card {
		padding: 24px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		transition: all 0.3s ease;
	}

	.engine-card:hover {
		border-color: var(--teal);
		box-shadow: 0 4px 16px var(--teal-glow);
	}

	.engine-card h3 {
		font-size: 18px;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 10px 0;
	}

	.engine-card p {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0;
	}

	/* Data Sources */
	.layers-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-bottom: 60px;
	}

	.section-desc {
		font-size: 1rem;
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 24px;
		max-width: 650px;
	}

	.source-categories {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.source-cat {
		padding: 24px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.source-cat-icon {
		font-size: 28px;
		margin-bottom: 12px;
	}

	.source-cat h3 {
		font-size: 16px;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 8px 0;
	}

	.source-cat p {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0;
	}

	/* All Sources Grid */
	.all-sources {
		margin-top: 32px;
		padding: 32px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.all-sources-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 1px;
		margin: 0 0 24px 0;
	}

	.sources-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.source-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 12px;
		background: var(--teal-bg);
		border: 1px solid var(--teal-ring);
		border-radius: 6px;
		transition: border-color 0.2s ease;
	}

	.source-row:hover {
		border-color: var(--teal);
	}

	.source-badge {
		color: var(--teal);
		font-size: 14px;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.source-row strong {
		display: block;
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 2px;
	}

	.source-detail {
		display: block;
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	/* Scoring Section */
	.scoring-section {
		padding: 40px;
		background: var(--teal-bg);
		border: 1px solid var(--teal-ring);
		border-radius: 8px;
		margin-top: 48px;
	}

	.scoring-section h2 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 16px;
	}

	.scoring-section p {
		font-size: 0.95rem;
		color: var(--text-secondary);
		line-height: 1.7;
		margin-bottom: 20px;
	}

	/* Confidence Bands */
	.confidence-section {
		margin: 28px 0;
		padding: 20px;
		background: var(--surface-alt);
		border-radius: 6px;
	}

	.confidence-section h3 {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 1px;
		margin: 0 0 16px 0;
	}

	.confidence-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
	}

	.confidence-item {
		text-align: center;
	}

	.confidence-band {
		font-size: 14px;
		font-weight: 700;
		padding: 10px 8px;
		border-radius: 6px;
		margin-bottom: 6px;
		letter-spacing: 0.5px;
	}

	.confidence-band.high {
		background: var(--green-soft);
		color: var(--green);
	}

	.confidence-band.moderate {
		background: var(--teal-bg);
		color: var(--teal);
	}

	.confidence-band.low {
		background: var(--amber-soft);
		color: var(--amber);
	}

	.confidence-band.preliminary {
		background: var(--red-soft);
		color: var(--red);
	}

	.confidence-label {
		font-size: 11px;
		color: var(--text-tertiary);
		line-height: 1.4;
	}

	/* CTA Section */
	.fixes-section {
		margin-top: 48px;
		padding: 40px;
		background: var(--green-soft);
		border: 1px solid rgba(5, 150, 105, 0.2);
		border-radius: 8px;
		text-align: center;
	}

	.fixes-section h2 {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 12px;
	}

	.fixes-section p {
		font-size: 0.95rem;
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 24px;
		max-width: 500px;
		margin-left: auto;
		margin-right: auto;
	}

	.method-cta {
		display: inline-block;
		padding: 14px 32px;
		background: var(--green);
		color: #ffffff;
		font-weight: 700;
		font-size: 15px;
		border-radius: 8px;
		text-decoration: none;
		transition: all 0.2s;
	}

	.method-cta:hover {
		background: #047857;
		transform: translateY(-1px);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.methodology-container {
			padding: 24px 16px;
		}

		h1 {
			font-size: 1.8rem;
		}

		.engines-grid,
		.source-categories,
		.sources-grid {
			grid-template-columns: 1fr;
		}

		.confidence-grid {
			grid-template-columns: 1fr 1fr;
			gap: 8px;
		}

		.scoring-section,
		.fixes-section {
			padding: 24px;
		}
	}
</style>
