<script>
	let metrics = [
		{ emoji: '🫀', label: 'Resting Heart Rate', value: 72, unit: 'bpm', percent: 72, color: '#22c55e' },
		{ emoji: '🚶', label: 'Steps Today', value: 8241, unit: '', percent: 82, color: '#22c55e' },
		{ emoji: '😴', label: 'Sleep Last Night', value: 7.2, unit: 'h', percent: 90, color: '#22c55e' },
		{ emoji: '🏋️', label: 'Workouts This Week', value: 4, unit: '', percent: 57, color: '#ff9f43' },
		{ emoji: '💧', label: 'Glasses of Water', value: 6, unit: '', percent: 75, color: '#3b82f6' },
		{ emoji: '🧘', label: 'Meditation Today', value: 15, unit: 'm', percent: 100, color: '#a855f7' }
	];
</script>

<div class="container">
	<header class="page-header">
		<h1>❤️ Health</h1>
		<p>Vitals, activity, and wellness tracking</p>
	</header>

	<div class="metrics-grid">
		{#each metrics as metric}
			<div class="metric-card">
				<div class="metric-emoji">{metric.emoji}</div>
				<div class="metric-value">
					{metric.value}<span class="metric-unit">{metric.unit}</span>
				</div>
				<div class="metric-label">{metric.label}</div>
				<div class="progress-bar">
					<div class="progress-fill" style="width: {metric.percent}%; background-color: {metric.color}"></div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
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

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
	}

	.metric-card {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		transition: all 0.2s ease;
	}

	.metric-card:hover {
		background-color: var(--surface2);
		border-color: var(--border-hover);
	}

	.metric-emoji {
		font-size: 3rem;
	}

	.metric-value {
		font-size: 2rem;
		font-weight: 700;
		line-height: 1;
	}

	.metric-unit {
		font-size: 1rem;
		font-weight: 400;
		color: var(--text-dim);
		margin-left: 0.25rem;
	}

	.metric-label {
		font-size: 0.875rem;
		color: var(--text-dim);
		text-align: center;
	}

	.progress-bar {
		width: 100%;
		height: 6px;
		background-color: var(--surface2);
		border-radius: 3px;
		overflow: hidden;
		margin-top: 0.5rem;
	}

	.progress-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.3s ease;
	}
</style>
