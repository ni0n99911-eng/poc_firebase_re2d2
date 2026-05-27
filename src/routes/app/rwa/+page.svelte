<script>
	import { onMount } from 'svelte';
	import { loadLaunchPadData } from '$lib/launchpad-store';

	let activePhase = $state(1);
	let lpData = $state(loadLaunchPadData());
	let tokenSymbol = $state('TOKEN');

	onMount(() => {
		lpData = loadLaunchPadData();
		// Generate token symbol from business name (e.g., "Brew" -> "BREW")
		const firstWord = lpData.businessName?.split(' ')[0] || 'TOKEN';
		tokenSymbol = firstWord.toUpperCase();
	});

	const tokenomicsData = [
		{ label: 'Community & Rewards', percent: 40, color: '#ff2d55' },
		{ label: 'Operations & Development', percent: 30, color: '#00e8cc' },
		{ label: 'Team & Advisors', percent: 20, color: '#ffd60a' },
		{ label: 'Treasury Reserve', percent: 10, color: '#a0a0a0' }
	];

	const roadmap = [
		{
			phase: 1,
			title: 'Launch & Loyalty',
			timeline: 'Q2 2024',
			items: [
				`${tokenSymbol} token launch (Base L2)`,
				'Loyalty program (Bronze/Silver/Gold)',
				'Mobile app launch',
				'500 txn/day baseline'
			]
		},
		{
			phase: 2,
			title: 'Fractional Ownership',
			timeline: 'Q4 2024',
			items: [
				'Fractional store equity tokens',
				'Dividend distribution protocol',
				'SEC-compliant offering',
				'DAO governance framework'
			]
		},
		{
			phase: 3,
			title: 'Multi-Location Expansion',
			timeline: 'Q1 2025',
			items: [
				'Second location tokenization',
				'Cross-location governance',
				'Revenue pooling mechanism',
				'Franchisee network launch'
			]
		},
		{
			phase: 4,
			title: 'Web3 Infrastructure',
			timeline: 'Q3 2025',
			items: [
				'Autonomous cafe operations',
				'Real-time on-chain metrics',
				'Liquidity mining pools',
				'Cross-chain integration'
			]
		}
	];

	let features = $derived.by(() => {
		return [
			{
				icon: '⚡',
				title: `Earn ${tokenSymbol} Tokens`,
				desc: `Get 1-3% ${tokenSymbol} per $ spent based on loyalty tier`,
				color: '#ff2d55'
			},
			{
				icon: '🏪',
				title: 'Own Store Equity',
				desc: 'Fractional store ownership for Gold-tier members (Phase 2)',
				color: '#00e8cc'
			},
			{
				icon: '🗳️',
				title: 'Vote & Govern',
				desc: 'Propose and vote on cafe strategy and menu items',
				color: '#ffd60a'
			},
			{
				icon: '💰',
				title: 'Earn Dividends',
				desc: 'Revenue sharing from cafe operations distributed weekly',
				color: '#ff2d55'
			}
		];
	});

	const keyMetrics = [
		{ metric: '$1.6M', label: 'Annual Revenue Target' },
		{ metric: '500', label: 'Daily Transactions Target' },
		{ metric: '75-78%', label: 'Gross Margin at Scale' },
		{ metric: '74', label: 'Total Menu SKUs' }
	];
</script>

<svelte:head>
	<title>RE² — Risk Assessment</title>
</svelte:head>

<div class="container">
	<header class="page-header">
		<h1>🏢 RWA & Tokenization</h1>
		<p class="subtitle">{lpData.businessName || 'Your business'} as a tokenized real-world asset</p>
	</header>

	<!-- Key Metrics -->
	<section class="metrics-section">
		<div class="metrics-grid">
			{#each keyMetrics as metric}
				<div class="metric-card">
					<div class="metric-value">{metric.metric}</div>
					<div class="metric-label">{metric.label}</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Token Utility Features -->
	<section class="features-section">
		<h2 class="section-title">Token Utility</h2>
		<div class="features-grid">
			{#each features as feature}
				<div class="feature-card" style="--feature-color: {feature.color}">
					<div class="feature-icon">{feature.icon}</div>
					<h3>{feature.title}</h3>
					<p>{feature.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Tokenomics Allocation -->
	<section class="tokenomics-section">
		<h2 class="section-title">Tokenomics Allocation</h2>
		<div class="tokenomics-layout">
			<div class="allocation-chart">
				{#each tokenomicsData as data, i}
					<div class="allocation-bar">
						<div
							class="allocation-fill"
							style="width: {data.percent}%; background: {data.color}"
						></div>
						<span class="allocation-label">{data.percent}%</span>
					</div>
					<div class="allocation-legend">
						<span class="legend-color" style="background: {data.color}"></span>
						<span class="legend-text">{data.label}</span>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Roadmap -->
	<section class="roadmap-section">
		<h2 class="section-title">Development Roadmap</h2>
		<div class="roadmap-timeline">
			{#each roadmap as phase}
				<button
					class="phase-button"
					class:active={activePhase === phase.phase}
					onclick={() => (activePhase = phase.phase)}
				>
					<div class="phase-number">Phase {phase.phase}</div>
					<div class="phase-time">{phase.timeline}</div>
				</button>
			{/each}
		</div>

		<div class="phase-content">
			{#each roadmap as phase}
				{#if activePhase === phase.phase}
					<div class="phase-details" in:fade>
						<h3>{phase.title}</h3>
						<p class="phase-timeline">{phase.timeline}</p>
						<ul class="phase-items">
							{#each phase.items as item}
								<li>{item}</li>
							{/each}
						</ul>
					</div>
				{/if}
			{/each}
		</div>
	</section>

	<!-- Concept Explanation -->
	<section class="concept-section">
		<div class="concept-box">
			<h2>The Concept</h2>
			<p>
				{lpData.businessName || 'Your business'} is tokenized as a real-world asset on the blockchain. Customers and supporters earn {tokenSymbol} tokens with every purchase. Gold-tier members receive fractional ownership in the cafe, entitling them to:
			</p>
			<ul class="concept-list">
				<li><strong>Governance Rights:</strong> Vote on menu items, pricing, expansion locations</li>
				<li><strong>Revenue Sharing:</strong> Weekly dividend distribution from sales</li>
				<li><strong>Appreciation:</strong> Token value tied to cafe profitability and growth</li>
				<li><strong>Liquidity:</strong> Trade tokens on secondary markets (subject to regulations)</li>
			</ul>
			<p style="margin-top: 20px; font-size: 0.95rem; color: var(--text-dim);">
				This model aligns customer interests with business success, creating a community-owned cafe that scales globally while maintaining authentic local roots.
			</p>
		</div>
	</section>
</div>

<style>
	.container {
		max-width: 1300px;
		margin: 0 auto;
		padding: 50px 20px;
		background-color: var(--bg);
		color: var(--text);
		min-height: 100vh;
	}

	.page-header {
		text-align: center;
		margin-bottom: 70px;
	}

	.page-header h1 {
		font-size: 3rem;
		font-weight: 800;
		margin: 0 0 15px 0;
		background: linear-gradient(90deg, var(--danger), var(--teal), var(--warning));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		font-size: 1.3rem;
		color: var(--text-secondary);
		margin: 0;
	}

	/* Key Metrics Section */
	.metrics-section {
		margin-bottom: 80px;
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 25px;
	}

	.metric-card {
		background: linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%);
		border: 2px solid var(--border);
		border-radius: 12px;
		padding: 35px 20px;
		text-align: center;
		transition: all 0.3s ease;
	}

	.metric-card:hover {
		border-color: var(--accent);
		transform: translateY(-8px);
		box-shadow: 0 15px 40px rgba(180, 83, 9, 0.15);
	}

	.metric-value {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--warning);
		margin-bottom: 10px;
	}

	.metric-label {
		font-size: 1rem;
		color: var(--text-secondary);
		margin: 0;
	}

	/* Section Title */
	.section-title {
		text-align: center;
		font-size: 2.5rem;
		font-weight: 700;
		margin-bottom: 50px;
		color: var(--text);
	}

	/* Features Section */
	.features-section {
		margin-bottom: 80px;
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 25px;
	}

	.feature-card {
		background: var(--surface);
		border: 2px solid var(--border);
		border-radius: 12px;
		padding: 35px 25px;
		text-align: center;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.feature-card::before {
		content: '';
		position: absolute;
		top: -1px;
		left: -1px;
		right: -1px;
		height: 2px;
		background: var(--feature-color);
		transform: scaleX(0);
		transform-origin: left;
		transition: transform 0.3s ease;
	}

	.feature-card:hover {
		border-color: var(--feature-color);
		transform: translateY(-8px);
		box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
	}

	.feature-card:hover::before {
		transform: scaleX(1);
	}

	.feature-icon {
		font-size: 3rem;
		margin-bottom: 15px;
	}

	.feature-card h3 {
		font-size: 1.3rem;
		font-weight: 700;
		margin: 0 0 10px 0;
		color: var(--text);
	}

	.feature-card p {
		font-size: 0.95rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.6;
	}

	/* Tokenomics Section */
	.tokenomics-section {
		margin-bottom: 80px;
		background: linear-gradient(135deg, rgba(220, 38, 38, 0.05) 0%, rgba(13, 124, 110, 0.05) 100%);
		border-radius: 20px;
		padding: 50px;
	}

	.tokenomics-layout {
		max-width: 700px;
		margin: 0 auto;
	}

	.allocation-chart {
		display: flex;
		flex-direction: column;
		gap: 25px;
	}

	.allocation-bar {
		display: flex;
		align-items: center;
		gap: 15px;
		height: 50px;
		background: var(--surface);
		border-radius: 8px;
		border: 1px solid var(--border);
		overflow: hidden;
		position: relative;
	}

	.allocation-fill {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		border-radius: 8px;
		opacity: 0.2;
		transition: width 0.5s ease;
	}

	.allocation-label {
		position: relative;
		z-index: 2;
		margin-left: 15px;
		font-weight: 700;
		color: var(--text);
	}

	.allocation-legend {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: -10px;
	}

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}

	.legend-text {
		font-size: 0.95rem;
		color: var(--text-secondary);
	}

	/* Roadmap Section */
	.roadmap-section {
		margin-bottom: 80px;
	}

	.roadmap-timeline {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 15px;
		margin-bottom: 40px;
	}

	.phase-button {
		padding: 20px;
		background: var(--surface);
		border: 2px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.3s ease;
		text-align: center;
	}

	.phase-button:hover {
		border-color: var(--accent);
		background: linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%);
	}

	.phase-button.active {
		border-color: var(--danger);
		background: linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%);
		box-shadow: 0 0 20px rgba(220, 38, 38, 0.2);
	}

	.phase-number {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--text);
		margin-bottom: 5px;
	}

	.phase-time {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.phase-content {
		min-height: 300px;
		position: relative;
	}

	.phase-details {
		background: linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 40px;
	}

	.phase-details h3 {
		font-size: 1.8rem;
		font-weight: 700;
		margin: 0 0 10px 0;
		color: var(--text);
	}

	.phase-timeline {
		font-size: 0.95rem;
		color: var(--text-secondary);
		margin: 0 0 25px 0;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.phase-items {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.phase-items li {
		display: flex;
		align-items: flex-start;
		gap: 15px;
		padding-left: 0;
		color: var(--text-secondary);
		font-size: 1rem;
		line-height: 1.6;
	}

	.phase-items li::before {
		content: '✓';
		color: var(--accent);
		font-weight: 700;
		flex-shrink: 0;
		margin-top: 2px;
	}

	/* Concept Section */
	.concept-section {
		margin-bottom: 50px;
	}

	.concept-box {
		background: linear-gradient(135deg, var(--teal-bg) 0%, var(--amber-soft) 100%);
		border: 2px solid var(--teal);
		border-radius: 16px;
		padding: 45px;
	}

	.concept-box h2 {
		font-size: 1.8rem;
		font-weight: 700;
		margin: 0 0 20px 0;
		color: var(--teal);
	}

	.concept-box p {
		font-size: 1.05rem;
		line-height: 1.8;
		color: var(--text-secondary);
		margin: 0 0 20px 0;
	}

	.concept-list {
		list-style: none;
		padding: 0;
		margin: 20px 0;
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.concept-list li {
		padding-left: 25px;
		position: relative;
		font-size: 1rem;
		line-height: 1.6;
		color: var(--text);
	}

	.concept-list li::before {
		content: '→';
		position: absolute;
		left: 0;
		color: var(--teal);
		font-weight: bold;
	}

	.concept-list strong {
		color: var(--teal);
	}

	@media (max-width: 768px) {
		.page-header h1 {
			font-size: 2rem;
		}

		.section-title {
			font-size: 1.8rem;
		}

		.metrics-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.features-grid {
			grid-template-columns: 1fr;
		}

		.tokenomics-section {
			padding: 30px;
		}

		.phase-details {
			padding: 25px;
		}

		.concept-box {
			padding: 25px;
		}
	}
</style>
