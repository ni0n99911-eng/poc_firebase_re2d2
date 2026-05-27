<script>
	let suggestions = [
		{
			icon: '☕',
			title: 'Visit Black Fox Coffee for competitor research',
			details: 'new East Village location',
			source: 'Coffee business goals'
		},
		{
			icon: '📞',
			title: 'Follow up with James L. (broker)',
			details: '2 weeks since last contact',
			source: 'Relationship tracking'
		},
		{
			icon: '🏋️',
			title: 'On track for 5/week workout goal',
			details: 'consider rest day before Thursday review',
			source: 'Health metrics & calendar'
		},
		{
			icon: '📊',
			title: '2 at-risk EY accounts',
			details: 'loop in Sarah K. from Deloitte as warm lead',
			source: 'Account health & network'
		},
		{
			icon: '🍽️',
			title: 'Prep 1-pager on financials + RWA model for Neel\'s dinner',
			details: 'before Wednesday 7:00 PM',
			source: 'Upcoming activities & partnerships'
		}
	];
</script>

<div class="container">
	<header class="page-header">
		<h1>💡 Suggestions</h1>
		<p>Jared's recommendations based on your patterns and goals</p>
	</header>

	<div class="suggestions-grid">
		{#each suggestions as suggestion}
			<div class="suggestion-card">
				<div class="suggestion-icon">{suggestion.icon}</div>
				<div class="suggestion-content">
					<div class="suggestion-title">{suggestion.title}</div>
					<div class="suggestion-details">{suggestion.details}</div>
					<div class="suggestion-source">Based on: {suggestion.source}</div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.container {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem;
		background-color: var(--bg);
		color: var(--text);
	}

	.page-header {
		margin-bottom: 2.5rem;
	}

	.page-header h1 {
		font-size: 2rem;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
	}

	.page-header p {
		font-size: 1rem;
		color: var(--text-dim);
		margin: 0;
	}

	.suggestions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.suggestion-card {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1.5rem;
		display: flex;
		gap: 1rem;
		transition: all 0.2s ease;
	}

	.suggestion-card:hover {
		background-color: var(--surface2);
		border-color: var(--border-hover);
	}

	.suggestion-icon {
		font-size: 2rem;
		flex-shrink: 0;
		line-height: 1;
	}

	.suggestion-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.suggestion-title {
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.3;
	}

	.suggestion-details {
		font-size: 0.9rem;
		color: var(--text-dim);
	}

	.suggestion-source {
		font-size: 0.8rem;
		color: var(--text-dim);
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--surface2);
	}
</style>
