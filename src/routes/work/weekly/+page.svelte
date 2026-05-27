<script>
	const stats = [
		{
			id: 1,
			label: 'Pipeline',
			value: '$8.7M',
			change: '+$1.2M',
			isPositive: true
		},
		{
			id: 2,
			label: 'Won',
			value: '$640K TCV',
			change: '+2 deals',
			isPositive: true
		},
		{
			id: 3,
			label: 'At Risk',
			value: '2 accounts',
			change: 'Action needed',
			isPositive: false
		}
	];

	const summary = {
		title: 'Pipeline moved forward on 3 of 5 active opportunities',
		body: 'Goldman infrastructure deal progressed. JPM renewal signed. Blackstone and Citadel stalling.',
		commentary: 'Strong week on new business, but renewal pipeline is where the risk is. Two stalled renewals at once isn\'t coincidence — check for competitive play. Morgan Stanley RFP could be a nice offset.'
	};
</script>

<div class="container">
	<header class="page-header">
		<h1>📊 Weekly Digest</h1>
		<p class="subtitle">Week of March 9–15, 2026</p>
	</header>

	<div class="stats-grid">
		{#each stats as stat (stat.id)}
			<div class="stat-card">
				<div class="stat-label">{stat.label}</div>
				<div class="stat-value">{stat.value}</div>
				<div class="stat-change" class:positive={stat.isPositive} class:negative={!stat.isPositive}>
					{stat.change}
				</div>
			</div>
		{/each}
	</div>

	<div class="summary-section">
		<div class="summary-item">
			<h3 class="item-title">{summary.title}</h3>
			<p class="item-body">{summary.body}</p>

			<div class="commentary-block">
				<div class="commentary-label">JARED'S TAKE</div>
				<p class="commentary-text">{summary.commentary}</p>
			</div>
		</div>
	</div>
</div>

<style>
	:global(:root) {
		--bg: #0f0f0f;
		--surface: #1a1a1a;
		--surface2: #252525;
		--surface3: #303030;
		--border: #404040;
		--border-hover: #505050;
		--text: #e0e0e0;
		--text-dim: #a0a0a0;
		--text-bright: #ffffff;
		--work: #3b82f6;
		--work-dim: rgba(59, 130, 246, 0.1);
		--accent: #00ff88;
		--accent-dim: rgba(0, 255, 136, 0.08);
		--coffee: #ff9f43;
		--personal: #a855f7;
		--danger: #ef4444;
	}

	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		background-color: var(--bg);
		color: var(--text);
		min-height: 100vh;
	}

	.page-header {
		margin-bottom: 3rem;
	}

	.page-header h1 {
		font-size: 2.5rem;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		color: var(--text-bright);
	}

	.subtitle {
		font-size: 1rem;
		color: var(--text-dim);
		margin: 0;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		margin-bottom: 3rem;
	}

	.stat-card {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 1.5rem;
		text-align: center;
	}

	.stat-label {
		font-size: 0.85rem;
		color: var(--text-dim);
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-bright);
		margin-bottom: 0.75rem;
	}

	.stat-change {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.stat-change.positive {
		color: var(--accent);
	}

	.stat-change.negative {
		color: var(--danger);
	}

	.summary-section {
		margin-top: 2rem;
	}

	.summary-item {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 1.5rem;
	}

	.item-title {
		font-size: 1.15rem;
		font-weight: 600;
		margin: 0 0 0.75rem 0;
		color: var(--text-bright);
		line-height: 1.4;
	}

	.item-body {
		font-size: 0.95rem;
		color: var(--text);
		line-height: 1.6;
		margin: 0 0 1.25rem 0;
	}

	.commentary-block {
		background-color: var(--accent-dim);
		border-left: 3px solid var(--accent);
		padding: 1rem;
		border-radius: 0.35rem;
		margin-top: 1rem;
	}

	.commentary-label {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--accent);
		margin-bottom: 0.5rem;
	}

	.commentary-text {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text);
		margin: 0;
	}
</style>
