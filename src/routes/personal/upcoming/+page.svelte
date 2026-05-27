<script>
	let activities = [
		{
			date: 'Tomorrow Tue Mar 17',
			time: '2:00 PM',
			badge: 'Coffee',
			badge_color: '#ff9f43',
			title: 'Coffee Tasting at Variety Coffee Roasters',
			description: 'details about sampling origins'
		},
		{
			date: 'Wed Mar 18',
			time: '7:00 PM',
			badge: 'Personal',
			badge_color: '#a855f7',
			title: 'Dinner with Neel — Rezdôra',
			description: 'Neel wants to discuss angel investing'
		},
		{
			date: 'Thu Mar 19',
			time: '9:00 AM',
			badge: 'Work',
			badge_color: '#3b82f6',
			title: 'EY Quarterly Review Prep',
			description: 'prep deck, pull CRM numbers'
		}
	];
</script>

<div class="container">
	<header class="page-header">
		<h1>📅 Upcoming Activities</h1>
		<p>Your next few days at a glance</p>
	</header>

	<div class="activities-list">
		{#each activities as activity}
			<div class="activity-card">
				<div class="activity-header">
					<div class="activity-datetime">
						<div class="activity-date">{activity.date}</div>
						<div class="activity-time">· {activity.time}</div>
					</div>
					<div class="activity-badge" style="background-color: {activity.badge_color}">
						{activity.badge}
					</div>
				</div>
				<div class="activity-title">{activity.title}</div>
				<div class="activity-description">{activity.description}</div>
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

	.activities-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.activity-card {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1.5rem;
		transition: all 0.2s ease;
	}

	.activity-card:hover {
		background-color: var(--surface2);
		border-color: var(--border-hover);
	}

	.activity-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.activity-datetime {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.activity-date {
		font-size: 0.875rem;
		color: var(--text-dim);
		font-weight: 500;
	}

	.activity-time {
		font-size: 0.875rem;
		color: var(--text-dim);
	}

	.activity-badge {
		font-size: 0.75rem;
		font-weight: 600;
		color: white;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
	}

	.activity-title {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.activity-description {
		font-size: 0.9rem;
		color: var(--text-dim);
	}
</style>
