<script>
	let events = [
		{
			time: 'Today 11:30 AM',
			dot_color: '#a855f7',
			title: 'Coffee with Ravi S.',
			description: 'discussed partnership for catering'
		},
		{
			time: 'Yesterday 4:00 PM',
			dot_color: '#3b82f6',
			title: 'LinkedIn message from Sarah K. at Deloitte',
			description: 'interested in managed services'
		},
		{
			time: 'Mar 14, 7:00 PM',
			dot_color: '#a855f7',
			title: 'Dinner with Anika & Priya',
			description: 'caught up, talked about coffee concept'
		},
		{
			time: 'Mar 13, 2:00 PM',
			dot_color: '#ff9f43',
			title: 'Met James L. (broker)',
			description: 'toured 2nd Ave location'
		},
		{
			time: 'Mar 12, 10:00 AM',
			dot_color: '#3b82f6',
			title: 'Team standup with EY Advisory group',
			description: 'pipeline review'
		}
	];
</script>

<div class="container">
	<header class="page-header">
		<h1>💬 Social Engagement</h1>
		<p>Connections, outreach, and relationship tracking</p>
	</header>

	<div class="timeline">
		{#each events as event, index}
			<div class="timeline-item">
				<div class="timeline-dot" style="background-color: {event.dot_color}"></div>
				<div class="timeline-content">
					<div class="timeline-time">{event.time}</div>
					<div class="timeline-title">{event.title}</div>
					<div class="timeline-description">{event.description}</div>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.container {
		max-width: 800px;
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

	.timeline {
		position: relative;
	}

	.timeline::before {
		content: '';
		position: absolute;
		left: 20px;
		top: 0;
		bottom: 0;
		width: 2px;
		background-color: var(--border);
	}

	.timeline-item {
		position: relative;
		margin-bottom: 2rem;
		padding-left: 60px;
	}

	.timeline-dot {
		position: absolute;
		left: 8px;
		top: 6px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 3px solid var(--bg);
		box-shadow: 0 0 0 2px var(--border);
		transition: all 0.2s ease;
	}

	.timeline-item:hover .timeline-dot {
		transform: scale(1.2);
		box-shadow: 0 0 0 2px var(--border-hover);
	}

	.timeline-content {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem;
		transition: all 0.2s ease;
	}

	.timeline-item:hover .timeline-content {
		background-color: var(--surface2);
		border-color: var(--border-hover);
	}

	.timeline-time {
		font-size: 0.875rem;
		color: var(--text-dim);
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	.timeline-title {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.timeline-description {
		font-size: 0.9rem;
		color: var(--text-dim);
	}
</style>
