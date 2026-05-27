<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { computeSpaceScore, getWeights, type SpaceCard, type SpaceScoreResult } from '$lib/intel/scoring/space-score';
	import { loadLaunchPadData } from '$lib/launchpad-store';
	import { getScoreColor } from '$lib/constants/scoreUtils';

	// State
	let allCards = $state<SpaceCard[]>([]);
	let compareCards = $state<SpaceCard[]>([]);
	let selectedIds = $state<string[]>([]);
	let launchPadData = $state(null);
	let scoreResults = $state<Map<string, SpaceScoreResult>>(new Map());
	let loaded = $state(false);

	// getScoreColor imported from scoreUtils — canonical DECISION_STATES thresholds

	function createRadarPath(
		physical: number,
		visibility: number,
		economics: number,
		structure: number
	): string {
		// Normalize scores to 0-100 scale for polygon
		const normalize = (val: number) => Math.max(0, Math.min(100, val)) / 100;
		const cx = 80;
		const cy = 80;
		const radius = 60;

		const p = normalize(physical);
		const v = normalize(visibility);
		const e = normalize(economics);
		const s = normalize(structure);

		// 4 vertices of diamond/square rotated 45 degrees
		const x1 = cx + radius * p;
		const y1 = cy;

		const x2 = cx;
		const y2 = cy - radius * v;

		const x3 = cx - radius * e;
		const y3 = cy;

		const x4 = cx;
		const y4 = cy + radius * s;

		return `${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`;
	}

	function loadCards() {
		try {
			const stored = localStorage.getItem('re2_space_cards');
			if (stored) {
				allCards = JSON.parse(stored);
			}
		} catch (e) {
			console.error('Failed to load space cards:', e);
		}
	}

	function parseUrlIds() {
		const ids = $page.url.searchParams.get('ids');
		if (ids) {
			selectedIds = ids.split(',');
		} else {
			const stored = localStorage.getItem('re2_compare_ids');
			if (stored) {
				selectedIds = JSON.parse(stored);
			}
		}
	}

	function filterAndScore() {
		compareCards = allCards.filter(card => selectedIds.includes(card.id));

		const bizType = launchPadData?.businessType || 'cafe';
		scoreResults.clear();
		for (const card of compareCards) {
			const result = computeSpaceScore(card, bizType);
			scoreResults.set(card.id, result);
		}

		// Save to localStorage for next visit
		localStorage.setItem('re2_compare_ids', JSON.stringify(selectedIds));
	}

	function getBestValue(): SpaceCard | null {
		if (compareCards.length === 0) return null;
		return compareCards.reduce((best, current) => {
			const bestEffective = (best.baseRent || 0) - (best.tiAllowance || 0);
			const currentEffective = (current.baseRent || 0) - (current.tiAllowance || 0);
			return currentEffective < bestEffective ? current : best;
		});
	}

	function getMostReady(): SpaceCard | null {
		if (compareCards.length === 0) return null;
		return compareCards.reduce((best, current) => {
			const bestPhysical = scoreResults.get(best.id)?.dimensions.physicalReadiness.score || 0;
			const currentPhysical = scoreResults.get(current.id)?.dimensions.physicalReadiness.score || 0;
			return currentPhysical > bestPhysical ? current : best;
		});
	}

	function getBestTerms(): SpaceCard | null {
		if (compareCards.length === 0) return null;
		return compareCards.reduce((best, current) => {
			const bestEcon = scoreResults.get(best.id)?.dimensions.leaseEconomics.score || 0;
			const currentEcon = scoreResults.get(current.id)?.dimensions.leaseEconomics.score || 0;
			return currentEcon > bestEcon ? current : best;
		});
	}

	function getBestOverall(): SpaceCard | null {
		if (compareCards.length === 0) return null;
		return compareCards.reduce((best, current) => {
			const bestScore = scoreResults.get(best.id)?.total || 0;
			const currentScore = scoreResults.get(current.id)?.total || 0;
			return currentScore > bestScore ? current : best;
		});
	}

	function isBest(card: SpaceCard | null, id: string): boolean {
		return card?.id === id;
	}

	onMount(() => {
		launchPadData = loadLaunchPadData();
		loadCards();
		parseUrlIds();
		filterAndScore();
		loaded = true;
	});
</script>

<svelte:head>
	<title>RE² — Space Comparison</title>
</svelte:head>

<div class="page">
	<!-- Page Header -->
	<div class="page-header">
		<div class="header-top">
			<a href="/app/space" class="btn-back">← Back to Spaces</a>
			<h1>SPACE COMPARISON</h1>
		</div>
		<p class="subtitle">Side-by-side analysis of {compareCards.length} locations</p>
	</div>

	{#if compareCards.length === 0}
		<div class="empty-state">
			<div class="empty-icon">📊</div>
			<div class="empty-text">No spaces selected for comparison.</div>
			<a href="/app/space" class="btn-back-home">Return to Spaces</a>
		</div>
	{:else}
		<div class="content">
			<!-- Comparison Cards -->
			<div class="cards-wrapper">
				<div class="cards-scroll">
					{#each compareCards as card (card.id)}
						<div class="comparison-card">
							<!-- Header -->
							<div class="card-header">
								<div class="address-block">
									<div class="address">{card.address}</div>
									<div class="sqft">{card.sqft?.toLocaleString()} sq ft</div>
								</div>
							</div>

							<!-- Photo Placeholder -->
							<div class="photo-placeholder">
								<div class="photo-icon">📸</div>
								<div class="photo-text">Photo</div>
							</div>

							<!-- Score Circle -->
							<div class="score-section">
								<div class="score-circle" style="border-color: {getScoreColor(scoreResults.get(card.id)?.total || 0)}">
									<div class="score-value">{Math.round(scoreResults.get(card.id)?.total || 0)}</div>
									<div class="score-label">SPACE SCORE</div>
								</div>
							</div>

							<!-- Radar Chart -->
							<div class="radar-section">
								<svg viewBox="0 0 160 160" class="radar-chart">
									<!-- Background grid -->
									<circle cx="80" cy="80" r="60" fill="none" stroke="#E0E5ED" stroke-width="1" />
									<circle cx="80" cy="80" r="40" fill="none" stroke="#E0E5ED" stroke-width="1" />
									<circle cx="80" cy="80" r="20" fill="none" stroke="#E0E5ED" stroke-width="1" />

									<!-- Axes -->
									<line x1="80" y1="20" x2="80" y2="140" stroke="#CBD2DE" stroke-width="1" />
									<line x1="20" y1="80" x2="140" y2="80" stroke="#CBD2DE" stroke-width="1" />

									<!-- Polygon -->
									<polygon
										points={createRadarPath(
											scoreResults.get(card.id)?.dimensions.physicalReadiness.score || 0,
											scoreResults.get(card.id)?.dimensions.visibilityAccess.score || 0,
											scoreResults.get(card.id)?.dimensions.leaseEconomics.score || 0,
											scoreResults.get(card.id)?.dimensions.structuralFlexibility.score || 0
										)}
										fill="rgba(13, 124, 110, 0.15)"
										stroke="#0D7C6E"
										stroke-width="2"
									/>

									<!-- Labels -->
									<text x="80" y="15" text-anchor="middle" font-size="10" fill="#8A95A8">P</text>
									<text x="145" y="85" text-anchor="start" font-size="10" fill="#8A95A8">V</text>
									<text x="80" y="155" text-anchor="middle" font-size="10" fill="#8A95A8">E</text>
									<text x="15" y="85" text-anchor="end" font-size="10" fill="#8A95A8">S</text>
								</svg>
							</div>

							<!-- Dimension Scores -->
							<div class="dimensions">
								<div class="dim-item">
									<span class="dim-name">Physical</span>
									<span class="dim-value" style="color: {getScoreColor(scoreResults.get(card.id)?.dimensions.physicalReadiness.score || 0)}">
										{Math.round(scoreResults.get(card.id)?.dimensions.physicalReadiness.score || 0)}
									</span>
								</div>
								<div class="dim-item">
									<span class="dim-name">Visibility</span>
									<span class="dim-value" style="color: {getScoreColor(scoreResults.get(card.id)?.dimensions.visibilityAccess.score || 0)}">
										{Math.round(scoreResults.get(card.id)?.dimensions.visibilityAccess.score || 0)}
									</span>
								</div>
								<div class="dim-item">
									<span class="dim-name">Economics</span>
									<span class="dim-value" style="color: {getScoreColor(scoreResults.get(card.id)?.dimensions.leaseEconomics.score || 0)}">
										{Math.round(scoreResults.get(card.id)?.dimensions.leaseEconomics.score || 0)}
									</span>
								</div>
								<div class="dim-item">
									<span class="dim-name">Structure</span>
									<span class="dim-value" style="color: {getScoreColor(scoreResults.get(card.id)?.dimensions.structuralFlexibility.score || 0)}">
										{Math.round(scoreResults.get(card.id)?.dimensions.structuralFlexibility.score || 0)}
									</span>
								</div>
							</div>

							<!-- Key Metrics -->
							<div class="metrics-section">
								<div class="metric">
									<div class="metric-label">Base Rent (Annual)</div>
									<div class="metric-value">${(card.baseRent || 0).toLocaleString()}</div>
								</div>
								<div class="metric">
									<div class="metric-label">Per Sq Ft</div>
									<div class="metric-value">${((card.baseRent || 0) / (card.sqft || 1)).toFixed(2)}</div>
								</div>
								<div class="metric">
									<div class="metric-label">TI Allowance</div>
									<div class="metric-value">${(card.tiAllowance || 0).toLocaleString()}</div>
								</div>
								<div class="metric">
									<div class="metric-label">Buildout Gap</div>
									<div class="metric-value">${(card.buildoutGapEstimate || 0).toLocaleString()}</div>
								</div>
								<div class="metric">
									<div class="metric-label">Lease Term</div>
									<div class="metric-value">{card.leaseTerm || 0} yrs</div>
								</div>
								<div class="metric">
									<div class="metric-label">Renewal Option</div>
									<div class="metric-value">{card.renewalOption ? 'Yes' : 'No'}</div>
								</div>
							</div>

							<!-- Status -->
							{#if card.status}
								<div class="status-line">
									<span class="status-label">Status:</span>
									<span class="status-value">{card.status}</span>
								</div>
							{/if}

							<!-- Deal Breakers -->
							{#if card.dealBreakers && card.dealBreakers.length > 0}
								<div class="breakers-section">
									<div class="breaker-header">Deal Breakers</div>
									{#each card.dealBreakers as breaker}
										<div class="breaker-item">{breaker}</div>
									{/each}
								</div>
							{/if}

							<!-- AI Verdict -->
							<div class="verdict-section">
								<div class="verdict-label">AI Verdict</div>
								<div class="verdict-placeholder">Coming soon</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Highlights Row -->
			<div class="highlights-section">
				<h2>Comparison Highlights</h2>
				<div class="highlights-grid">
					<div class="highlight-card">
						<div class="highlight-label">Best Value</div>
						<div class="highlight-address">{getBestValue()?.address || '—'}</div>
						<div class="highlight-metric">
							${((getBestValue()?.baseRent || 0) - (getBestValue()?.tiAllowance || 0)).toLocaleString()} net effective
						</div>
						{#if isBest(getBestValue(), compareCards[0]?.id)}
							<div class="winner-badge">🏆</div>
						{/if}
					</div>

					<div class="highlight-card">
						<div class="highlight-label">Most Ready</div>
						<div class="highlight-address">{getMostReady()?.address || '—'}</div>
						<div class="highlight-metric">
							{Math.round(scoreResults.get(getMostReady()?.id || '')?.dimensions.physicalReadiness.score || 0)} Physical Score
						</div>
						{#if isBest(getMostReady(), compareCards[0]?.id)}
							<div class="winner-badge">🏆</div>
						{/if}
					</div>

					<div class="highlight-card">
						<div class="highlight-label">Best Terms</div>
						<div class="highlight-address">{getBestTerms()?.address || '—'}</div>
						<div class="highlight-metric">
							{Math.round(scoreResults.get(getBestTerms()?.id || '')?.dimensions.leaseEconomics.score || 0)} Economics Score
						</div>
						{#if isBest(getBestTerms(), compareCards[0]?.id)}
							<div class="winner-badge">🏆</div>
						{/if}
					</div>

					<div class="highlight-card">
						<div class="highlight-label">Best Overall</div>
						<div class="highlight-address">{getBestOverall()?.address || '—'}</div>
						<div class="highlight-metric">
							{Math.round(scoreResults.get(getBestOverall()?.id || '')?.total || 0)} Total Score
						</div>
						{#if isBest(getBestOverall(), compareCards[0]?.id)}
							<div class="winner-badge">🏆</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		background-color: var(--bg);
		color: var(--text);
	}

	.page {
		max-width: 1600px;
		margin: 0 auto;
		padding: 1.5rem 1rem;
		background-color: var(--bg);
		color: var(--text);
	}

	.page-header {
		margin-bottom: 2rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 1rem;
	}

	.header-top {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 1rem;
	}

	.btn-back {
		background: none;
		border: none;
		color: var(--teal);
		cursor: pointer;
		font-weight: 600;
		font-size: 14px;
		transition: all 0.2s;
		text-decoration: none;
	}

	.btn-back:hover {
		color: var(--purple);
	}

	.page-header h1 {
		font-family: 'Playfair Display', serif;
		font-size: 28px;
		font-weight: 700;
		margin: 0;
		color: var(--text);
		letter-spacing: 0.5px;
		flex: 1;
	}

	.page-header .subtitle {
		font-family: 'Inter', sans-serif;
		font-size: 13px;
		margin: 0.5rem 0 0 0;
		color: var(--text-secondary);
		letter-spacing: 0.3px;
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		color: var(--text-secondary);
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 1rem;
	}

	.empty-text {
		font-size: 15px;
		margin-bottom: 2rem;
		line-height: 1.6;
	}

	.btn-back-home {
		display: inline-block;
		padding: 10px 20px;
		background: var(--teal);
		color: #ffffff;
		text-decoration: none;
		border-radius: 6px;
		font-weight: 600;
		font-size: 13px;
		transition: all 0.2s;
	}

	.btn-back-home:hover {
		background: var(--purple);
		transform: translateY(-2px);
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 3rem;
	}

	/* Comparison Cards */
	.cards-wrapper {
		width: 100%;
		overflow: hidden;
		border-radius: 10px;
	}

	.cards-scroll {
		display: flex;
		gap: 1.5rem;
		padding: 1.5rem;
		overflow-x: auto;
		background: var(--surface);
		border: 1px solid var(--border);
		scroll-behavior: smooth;
	}

	.comparison-card {
		flex: 0 0 320px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
	}

	.card-header {
		border-bottom: 1px solid var(--border);
		padding-bottom: 1rem;
	}

	.address-block {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.address {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
	}

	.sqft {
		font-size: 12px;
		color: var(--text-secondary);
	}

	.photo-placeholder {
		width: 100%;
		aspect-ratio: 16 / 9;
		background: var(--bg);
		border: 1px dashed var(--border);
		border-radius: 4px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: var(--text-secondary);
	}

	.photo-icon {
		font-size: 24px;
	}

	.photo-text {
		font-size: 11px;
	}

	.score-section {
		display: flex;
		justify-content: center;
		padding: 1rem 0;
	}

	.score-circle {
		width: 100px;
		height: 100px;
		border: 3px solid var(--border);
		border-radius: 50%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.score-value {
		font-size: 32px;
		font-weight: 700;
		color: var(--text);
		font-family: 'Playfair Display', serif;
	}

	.score-label {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
	}

	.radar-section {
		padding: 1rem 0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.radar-chart {
		width: 100%;
		height: 160px;
	}

	.dimensions {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		font-size: 12px;
	}

	.dim-item {
		display: flex;
		justify-content: space-between;
		padding: 6px 8px;
		background: var(--bg);
		border-radius: 4px;
		border: 1px solid var(--border);
	}

	.dim-name {
		color: var(--text-secondary);
		font-weight: 600;
		text-transform: uppercase;
		font-size: 10px;
	}

	.dim-value {
		font-weight: 700;
		color: var(--text);
		font-family: 'Playfair Display', serif;
	}

	.metrics-section {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
		font-size: 11px;
		padding: 1rem 0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.metric {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.metric-label {
		color: var(--text-secondary);
		font-weight: 600;
		text-transform: uppercase;
		font-size: 9px;
		letter-spacing: 0.3px;
	}

	.metric-value {
		color: var(--teal);
		font-weight: 700;
		font-size: 13px;
		font-family: 'Playfair Display', serif;
	}

	.status-line {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
	}

	.status-label {
		color: var(--text-secondary);
		font-weight: 600;
	}

	.status-value {
		color: var(--text-secondary);
		text-transform: capitalize;
	}

	.breakers-section {
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
	}

	.breaker-header {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--red);
		margin-bottom: 6px;
	}

	.breaker-item {
		font-size: 11px;
		color: var(--red);
		padding: 3px 0;
		line-height: 1.3;
	}

	.verdict-section {
		padding-top: 1rem;
	}

	.verdict-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 6px;
	}

	.verdict-placeholder {
		font-size: 13px;
		color: var(--text-secondary);
		padding: 12px;
		background: var(--bg);
		border-radius: 4px;
		text-align: center;
	}

	/* Highlights Section */
	.highlights-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.highlights-section h2 {
		font-size: 16px;
		font-weight: 700;
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: var(--text);
	}

	.highlights-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1.5rem;
	}

	.highlight-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 12px;
		position: relative;
		transition: all 0.3s;
	}

	.highlight-card:hover {
		border-color: var(--teal);
		box-shadow: 0 8px 20px rgba(13, 124, 110, 0.1);
	}

	.highlight-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
	}

	.highlight-address {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
	}

	.highlight-metric {
		font-size: 13px;
		color: var(--teal);
		font-weight: 600;
		font-family: 'Playfair Display', serif;
	}

	.winner-badge {
		position: absolute;
		top: -12px;
		right: 12px;
		font-size: 28px;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
	}

	@media (max-width: 1200px) {
		.highlights-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 768px) {
		.cards-scroll {
			flex-direction: column;
		}

		.comparison-card {
			flex: 1 1 auto;
		}

		.highlights-grid {
			grid-template-columns: 1fr;
		}

		.header-top {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
