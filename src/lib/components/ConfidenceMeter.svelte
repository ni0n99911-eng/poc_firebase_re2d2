<script>
	let { completionData = {} } = $props();

	const fields = $derived.by(() => {
		const checks = [
			{ key: 'founderProfile', label: 'Founder Profile', weight: 20 },
			{ key: 'concept', label: 'Business Concept', weight: 15 },
			{ key: 'financial', label: 'Financial Goals', weight: 20 },
			{ key: 'calibration', label: 'Engine Calibration', weight: 10 },
			{ key: 'location', label: 'Location Selected', weight: 20 },
			{ key: 'model', label: 'Business Case', weight: 15 }
		];
		return checks.map(c => ({
			...c,
			complete: !!completionData[c.key]
		}));
	});

	const score = $derived(fields.reduce((sum, f) => sum + (f.complete ? f.weight : 0), 0));

	const level = $derived.by(() => {
		if (score >= 85) return { label: 'High Confidence', color: '#00ff88', glow: 'rgba(0,255,136,0.3)' };
		if (score >= 60) return { label: 'Moderate', color: '#00d4ff', glow: 'rgba(0,212,255,0.3)' };
		if (score >= 30) return { label: 'Building...', color: '#ffbb00', glow: 'rgba(255,187,0,0.3)' };
		return { label: 'Getting Started', color: '#ff6b35', glow: 'rgba(255,107,53,0.3)' };
	});
</script>

<div class="confidence-meter">
	<div class="meter-header">
		<span class="meter-title">Data Confidence</span>
		<span class="meter-score" style="color: {level.color}">{score}%</span>
	</div>
	<div class="meter-bar">
		<div class="meter-fill" style="width: {score}%; background: {level.color}; box-shadow: 0 0 12px {level.glow}"></div>
	</div>
	<div class="meter-label" style="color: {level.color}">{level.label}</div>
	<div class="meter-fields">
		{#each fields as field}
			<div class="field-check" class:complete={field.complete}>
				<span class="check-icon">{field.complete ? '✓' : '○'}</span>
				<span class="check-label">{field.label}</span>
				<span class="check-weight">+{field.weight}%</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.confidence-meter {
		background: #ffffff;
		border-radius: 12px;
		padding: 1rem 1.25rem;
		margin-bottom: 1.5rem;
		border: 1px solid #d2d2d7;
	}
	.meter-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}
	.meter-title {
		font-size: 13px;
		font-weight: 600;
		color: #6e6e73;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.meter-score {
		font-size: 20px;
		font-weight: 700;
	}
	.meter-bar {
		height: 6px;
		background: #f5f5f7;
		border-radius: 3px;
		overflow: hidden;
		margin-bottom: 6px;
	}
	.meter-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.6s ease, background 0.4s ease;
	}
	.meter-label {
		font-size: 12px;
		font-weight: 600;
		margin-bottom: 10px;
	}
	.meter-fields {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}
	.field-check {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		color: var(--text-secondary, #5A6578);
		min-width: 140px;
	}
	.field-check.complete {
		color: var(--text, #1A202C);
	}
	.check-icon {
		font-size: 12px;
		width: 16px;
		text-align: center;
	}
	.field-check.complete .check-icon {
		color: #34C759;
	}
	.check-weight {
		margin-left: auto;
		font-size: 10px;
		color: var(--border, #E0E5ED);
	}
</style>
