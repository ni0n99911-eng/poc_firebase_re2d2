<script lang="ts">
	import FeedbackButton from '$lib/components/FeedbackButton.svelte';
	import { authedFetch } from '$lib/authed-fetch';

	let {
		personaType,
		conceptDescription,
		address,
		compositeScore,
		scores,
		spokeLabels,
		warnings,
		liveIntel
	} = $props<{
		personaType: string;
		conceptDescription: string;
		address: string;
		compositeScore: number;
		scores: Record<string, number>;
		spokeLabels: Record<string, string> | null;
		warnings: Array<{ title: string; description: string }>;
		liveIntel: any;
	}>();

	let verdict = $state('');
	let loading = $state(false);
	let error = $state(false);

	// Generate verdict on mount when all data is available
	$effect(() => {
		if (compositeScore > 0 && address && !verdict && !loading) {
			generateVerdict();
		}
	});

	async function generateVerdict() {
		loading = true;
		error = false;

		try {
			const response = await authedFetch('/api/generate-brief', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					persona_type: personaType,
					concept_description: conceptDescription,
					address,
					composite_score: compositeScore,
					scores,
					spoke_labels: spokeLabels,
					warnings: warnings.map(w => w.title),
					mode: 'verdict'
				})
			});

			if (response.ok) {
				const data = await response.json();
				verdict = data.narrative || data.verdict || '';
			} else {
				// Fallback: generate a template verdict
				verdict = generateTemplateVerdict();
			}
		} catch {
			verdict = generateTemplateVerdict();
		} finally {
			loading = false;
		}
	}

	function generateTemplateVerdict(): string {
		const labels = spokeLabels || { transit: 'Transit', competition: 'Competition', demographics: 'Demographics', vibrancy: 'Concept Pulse', safety: 'Safety', momentum: 'Momentum' };

		// Find top 2 strengths and 1 weakness
		const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
		const strengths = sorted.slice(0, 2);
		const weakness = sorted[sorted.length - 1];

		const conceptShort = conceptDescription ? ` for ${conceptDescription.toLowerCase().slice(0, 60)}` : '';
		const scoreWord = compositeScore >= 80 ? 'excellent' : compositeScore >= 70 ? 'strong' : compositeScore >= 55 ? 'decent' : 'challenging';

		let text = `This is a ${scoreWord} location${conceptShort}. `;
		text += `${labels[strengths[0][0]] || strengths[0][0]} (${strengths[0][1]}) and ${labels[strengths[1][0]] || strengths[1][0]} (${strengths[1][1]}) are your biggest advantages here. `;

		if (weakness[1] < 50) {
			text += `Watch out for ${labels[weakness[0]] || weakness[0]} — scoring ${weakness[1]} means you'll need a plan for that.`;
		} else if (warnings.length > 0) {
			text += `Check the ${warnings.length} warning${warnings.length > 1 ? 's' : ''} above before committing — those are the things that could surprise you after signing.`;
		} else {
			text += `No major red flags — but always walk the block at your target hours before signing.`;
		}

		return text;
	}

	let scoreColor = $derived(
		compositeScore >= 70 ? 'var(--green)' : compositeScore >= 50 ? 'var(--amber)' : 'var(--red)'
	);
</script>

<div class="bottom-line-card">
	<div class="card-header">
		<span class="card-icon">🎯</span>
		<h3 class="card-title">The Bottom Line</h3>
	</div>

	{#if loading}
		<div class="loading-state">
			<div class="loading-bar"></div>
			<div class="loading-bar short"></div>
		</div>
	{:else if verdict}
		<p class="verdict-text">{verdict}</p>
	{:else}
		<p class="verdict-text muted">Score a location to see your personalized verdict.</p>
	{/if}

	<div class="card-footer">
		<div class="score-pill" style="background: {scoreColor}15; color: {scoreColor}">
			{compositeScore}/100
		</div>
		<span class="footer-note">Based on {Object.keys(scores).length} scoring factors tuned for your business type</span>
	</div>

	<div class="feedback-row">
		<FeedbackButton sectionId="bottom-line" />
	</div>
</div>

<style>
	.bottom-line-card {
		background: var(--surface);
		border-radius: 12px;
		padding: 24px;
		margin-bottom: 16px;
		border: 1px solid var(--border);
		border-top: 3px solid;
		background-image: linear-gradient(to right, var(--teal), var(--purple));
		background-origin: border-box;
		background-clip: padding-box, border-box;
		position: relative;
		overflow: hidden;
	}

	.bottom-line-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(to right, var(--teal), var(--purple));
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
		position: relative;
		z-index: 1;
	}

	.card-icon {
		font-size: 20px;
	}

	.card-title {
		font-size: 22px;
		font-weight: 700;
		color: var(--text);
		margin: 0;
		font-family: 'Playfair Display', serif;
	}

	.verdict-text {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.7;
		margin: 0 0 20px 0;
	}

	.verdict-text.muted {
		color: var(--text-dim);
		font-style: italic;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 20px;
	}

	.loading-bar {
		height: 14px;
		background: linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%);
		background-size: 200% 100%;
		border-radius: 6px;
		animation: shimmer 1.5s infinite;
	}

	.loading-bar.short {
		width: 65%;
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	.card-footer {
		display: flex;
		align-items: center;
		gap: 12px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}

	.score-pill {
		font-size: 13px;
		font-weight: 700;
		padding: 4px 12px;
		border-radius: 20px;
		white-space: nowrap;
	}

	.footer-note {
		font-size: 12px;
		color: var(--text-secondary);
	}

	.feedback-row {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	@media (max-width: 640px) {
		.bottom-line-card {
			padding: 16px;
		}

		.verdict-text {
			font-size: 13px;
		}

		.card-footer {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}
	}
</style>
