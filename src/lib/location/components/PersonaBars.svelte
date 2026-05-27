<script lang="ts">
	import { getScoreColor as _getScoreColor } from '$lib/constants/scoreUtils';
	interface Bar {
		label: string;
		score: number;
		explanation: string;
		icon?: string;
	}

	interface Props {
		bars: Bar[];
		personaKey: string;
	}

	let { bars, personaKey } = $props();

	const personaLabels: Record<string, string> = {
		'coffee_shop': 'Coffee / Café', 'coffee': 'Coffee / Café',
		'Specialty Coffee/Café': 'Coffee / Café', 'Specialty Coffee / Café': 'Coffee / Café',
		'restaurant': 'Restaurant', 'Restaurant (Fast Casual)': 'Fast Casual',
		'Restaurant (Full Service)': 'Full Service',
		'gym': 'Fitness / Wellness', 'fitness': 'Fitness / Wellness',
		'Fitness / Wellness Studio': 'Fitness / Wellness',
		'dentist': 'Professional Services', 'medical_dental': 'Dental / Medical',
		'Professional Services': 'Professional Services',
		'spa': 'Spa / Wellness', 'spa_wellness': 'Spa / Wellness',
		'barber': 'Barbershop / Salon', 'barbershop': 'Barbershop / Salon',
		'Barbershop / Salon': 'Barbershop / Salon', 'Salon / Barbershop': 'Barbershop / Salon',
		'bodega': 'Grocery / Market', 'Grocery / Specialty Food': 'Grocery / Market',
		'bakery': 'Bakery', 'boutique': 'Retail', 'florist': 'Florist',
		'retail': 'Retail', 'Retail Store': 'Retail',
		'bar': 'Bar / Lounge', 'Other': 'Your Concept',
		'something_else': 'your concept',
	};

	// Canonical DECISION_STATES thresholds via scoreUtils
	const getScoreColor = (score: number): string => _getScoreColor(score);
</script>

<div class="persona-bars-container">
	<div class="section-header">
		<h2 class="heading">How Your Location Scores</h2>
		<p class="subheading">Tuned for {personaLabels[personaKey] || personaKey}</p>
	</div>

	<div class="bars-list">
		{#each bars as bar, idx (idx)}
			<div class="bar-row" style="--bar-color: {getScoreColor(bar.score)}">
				<div class="bar-label-section">
					{#if bar.icon}
						<span class="icon">{bar.icon}</span>
					{/if}
					<span class="label">{bar.label}</span>
					<span class="score">{bar.score}</span>
				</div>

				<div class="bar-track">
					<div class="bar-fill" style="width: {bar.score}%"></div>
				</div>

				<p class="explanation">{bar.explanation}</p>
			</div>
		{/each}
	</div>
</div>

<style>
	.persona-bars-container {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 24px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.section-header {
		margin-bottom: 24px;
	}

	.heading {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.3px;
	}

	.subheading {
		margin: 6px 0 0 0;
		font-size: 14px;
		color: var(--text-secondary);
		font-weight: 400;
	}

	.bars-list {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.bar-row {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.bar-label-section {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.icon {
		font-size: 18px;
		display: inline-block;
		width: 20px;
		text-align: center;
		flex-shrink: 0;
	}

	.label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
		flex: 1;
	}

	.score {
		font-size: 16px;
		font-weight: 700;
		color: var(--bar-color);
		min-width: 32px;
		text-align: right;
		font-family: 'Playfair Display', Georgia, serif;
	}

	.bar-track {
		width: 100%;
		height: 4px;
		background-color: var(--border);
		border-radius: 2px;
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		background-color: var(--bar-color);
		border-radius: 2px;
		transition: width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		will-change: width;
	}

	.explanation {
		margin: 0;
		font-size: 13px;
		color: var(--text-dim);
		line-height: 1.4;
	}
</style>
