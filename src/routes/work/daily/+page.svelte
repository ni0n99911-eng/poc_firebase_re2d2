<script>
	const items = [
		{
			id: 1,
			source: 'Deal Alert',
			timestamp: '8:14 AM',
			title: 'Morgan Stanley — Managed Services RFP Dropped',
			body: 'New RFP for cloud migration managed services. $2.4M TCV. Response deadline April 3.',
			commentary: "This is the kind of deal you've been positioning for. The timeline is tight but your Deloitte case study from Q4 maps almost 1:1. Worth pulling in the team early."
		},
		{
			id: 2,
			source: 'Market Update',
			timestamp: '9:30 AM',
			title: 'NYC Commercial Lease Rates — March Data',
			body: 'Average asking rents in Manhattan retail dipped 2.3% month-over-month. East Village and LES both showing softening.',
			commentary: "The timing is working in your favor. Landlords are more negotiable. If you're serious about 2nd Ave, this is the window to push for a better rate."
		},
		{
			id: 3,
			source: 'Follow-Up',
			timestamp: '10:45 AM',
			title: 'Client: Blackstone — Contract Renewal at Risk',
			body: 'Renewal conversation stalled 5 days ago. No response from procurement.',
			commentary: 'Silence after a revision usually means they\'re shopping it. Direct call to your champion there rather than another email.'
		}
	];
</script>

<div class="container">
	<header class="page-header">
		<h1>📋 Daily Digest</h1>
		<p class="subtitle">Monday, March 16, 2026 — Your day in deals and data</p>
	</header>

	<div class="digest-list">
		{#each items as item (item.id)}
			<div class="digest-item">
				<div class="item-header">
					<span class="source-badge">{item.source}</span>
					<span class="timestamp">{item.timestamp}</span>
				</div>
				<h3 class="item-title">{item.title}</h3>
				<p class="item-body">{item.body}</p>

				<div class="commentary-block">
					<div class="commentary-label">JARED'S TAKE</div>
					<p class="commentary-text">{item.commentary}</p>
				</div>
			</div>
		{/each}
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

	.digest-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.digest-item {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 1.5rem;
	}

	.item-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.source-badge {
		background-color: var(--work-dim);
		color: var(--work);
		padding: 0.35rem 0.75rem;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.timestamp {
		font-size: 0.8rem;
		color: var(--text-dim);
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
