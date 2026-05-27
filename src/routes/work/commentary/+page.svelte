<script>
	const entries = [
		{
			id: 1,
			tag: 'Big Picture',
			date: 'Mar 16 2026',
			title: 'The Week Ahead — Three Threads Converging',
			analysis: 'Neel\'s dinner (Wed) — pitch the tokenized loyalty play, not just the concept\n\nMorgan Stanley RFP — $2.4M but will eat bandwidth. Decide: all-in or protect launch prep time?\n\nNYC lease rates dropping — James hasn\'t heard from you in 2 weeks. Lock in the conversation.',
			metaPlay: 'If Neel commits seed capital Wednesday and you lock a location by month end, your timeline accelerates 6 weeks. Worth more than the MS RFP. But only you know your risk tolerance.'
		},
		{
			id: 2,
			tag: 'Pattern',
			date: 'Mar 15 2026',
			title: 'Your Network is Your Unfair Advantage',
			analysis: '12 meaningful conversations past 30 days, 8 directly connect to your business or EY pipeline. That\'s not networking — that\'s operating.',
			metaPlay: null
		}
	];
</script>

<div class="container">
	<header class="page-header">
		<h1>🎙️ Commentary</h1>
		<p class="subtitle">Connecting dots across work, coffee concept, and personal network</p>
	</header>

	<div class="entries-list">
		{#each entries as entry (entry.id)}
			<div class="entry-card">
				<div class="entry-meta">
					<span class="entry-tag">{entry.tag}</span>
					<span class="entry-date">{entry.date}</span>
				</div>

				<h2 class="entry-title">{entry.title}</h2>

				<div class="analysis-block">
					<div class="analysis-label">JARED'S ANALYSIS</div>
					<div class="analysis-content">
						{#each entry.analysis.split('\n\n') as paragraph}
							<p class="analysis-text">{paragraph}</p>
						{/each}
					</div>
				</div>

				{#if entry.metaPlay}
					<div class="meta-play-block">
						<div class="meta-play-label">META-PLAY</div>
						<p class="meta-play-text">{entry.metaPlay}</p>
					</div>
				{/if}
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
		max-width: 900px;
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

	.entries-list {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.entry-card {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 2rem;
	}

	.entry-meta {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.entry-tag {
		background-color: var(--accent-dim);
		color: var(--accent);
		padding: 0.35rem 0.75rem;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.entry-date {
		font-size: 0.8rem;
		color: var(--text-dim);
	}

	.entry-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 1.5rem 0;
		color: var(--text-bright);
		line-height: 1.4;
	}

	.analysis-block {
		background-color: var(--accent-dim);
		border-left: 3px solid var(--accent);
		padding: 1.25rem;
		border-radius: 0.35rem;
		margin-bottom: 1.5rem;
	}

	.analysis-label {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--accent);
		margin-bottom: 0.75rem;
	}

	.analysis-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.analysis-text {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text);
		margin: 0;
	}

	.meta-play-block {
		background-color: rgba(59, 130, 246, 0.08);
		border-left: 3px solid var(--work);
		padding: 1.25rem;
		border-radius: 0.35rem;
	}

	.meta-play-label {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--work);
		margin-bottom: 0.75rem;
	}

	.meta-play-text {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text);
		margin: 0;
	}
</style>
