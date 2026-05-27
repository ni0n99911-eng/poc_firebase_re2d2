<script lang="ts">
	import type { LocationIntelReport } from '$lib/intel/index';
	import { authedFetch } from '$lib/authed-fetch';

	let {
		personaType = 'coffee',
		conceptDescription = 'your concept',
		address = 'Unknown Address',
		compositeScore = 0,
		scores = {},
		spokeLabels = ['Transit', 'Competition', 'Demographics', 'Pulse', 'Safety', 'Momentum'],
		confidence = {},
		liveIntel = null,
	}: {
		personaType?: string;
		conceptDescription?: string;
		address?: string;
		compositeScore?: number;
		scores?: Record<string, number>;
		spokeLabels?: string[];
		confidence?: Record<string, number>;
		liveIntel?: LocationIntelReport | null;
	} = $props();

	// AI narrative state
	let aiNarrative = $state<string | null>(null);
	let isAIGenerated = $state(false);
	let isGenerating = $state(false);

	// Map index names to spoke labels
	const indexOrder = ['transit', 'competition', 'demographics', 'vibrancy', 'safety', 'momentum'];

	function getLabelForIndex(index: string): string {
		const idx = indexOrder.indexOf(index.toLowerCase());
		return idx >= 0 && idx < spokeLabels.length ? spokeLabels[idx] : index;
	}

	// Identify top 2-3 strengths and weakest area
	let topStrengths = $derived.by(() => {
		const entries = indexOrder
			.map((key) => ({ key, label: getLabelForIndex(key), score: scores[key] ?? 0 }))
			.filter((e) => e.score > 0)
			.sort((a, b) => b.score - a.score);
		return entries.slice(0, 3);
	});

	let weakestArea = $derived.by(() => {
		const entries = indexOrder
			.map((key) => ({ key, label: getLabelForIndex(key), score: scores[key] ?? 0 }))
			.filter((e) => e.score > 0)
			.sort((a, b) => a.score - b.score);
		return entries[0] || null;
	});

	// Extract specific data points from liveIntel
	let mtaRidership = $derived(liveIntel?.mtaRidership?.totalDailyRidership ?? null);
	let competitorCount = $derived(liveIntel?.competitors?.byDistance?.[0]?.count ?? 0);
	let medianIncome = $derived(liveIntel?.census?.medianHouseholdIncome ?? null);
	let bachelorsPct = $derived(liveIntel?.census?.bachelorsPlusPercent ?? null);
	let walkScore = $derived(liveIntel?.walkScore?.walkScore ?? null);
	let crimeScore = $derived(liveIntel?.crime?.crimeScore ?? null);
	let pedCount = $derived(liveIntel?.pedestrian?.dailyAverage ?? null);

	// Verdict color based on composite score
	let verdictColor = $derived(
		compositeScore >= 70 ? 'green' : compositeScore >= 55 ? 'amber' : 'red'
	);

	// Generate narrative paragraphs
	let paragraphs = $derived.by(() => {
		const p: string[] = [];

		// 1. Opening verdict paragraph
		if (compositeScore >= 70) {
			p.push(
				`This location scores ${compositeScore} out of 100 — a strong fit for ${conceptDescription}. The data supports moving forward. The neighborhood has the fundamentals your concept needs: good foot traffic, manageable competition, and strong customer demographics.`
			);
		} else if (compositeScore >= 55) {
			p.push(
				`This location scores ${compositeScore} out of 100 — a possible fit for ${conceptDescription}, but with important caveats. Some signals are strong; others need attention. Before committing, dig deeper into the specific risk factors flagged below.`
			);
		} else {
			p.push(
				`This location scores ${compositeScore} out of 100 — significant challenges for ${conceptDescription}. The data raises red flags in one or more critical areas. Consider alternative locations or address these issues before moving forward.`
			);
		}

		// 2. Strongest factors paragraph
		if (topStrengths.length > 0) {
			const strengths = topStrengths.slice(0, 3);
			const strengthText = strengths
				.map((s, idx) => {
					let detail = '';
					if (s.key === 'transit' && mtaRidership) {
						detail = ` (${Math.round(mtaRidership).toLocaleString()} daily riders)`;
					} else if (s.key === 'competition' && competitorCount > 0) {
						detail = ` (${competitorCount} competitors within range)`;
					} else if (s.key === 'demographics' && medianIncome) {
						detail = ` ($${Math.round(medianIncome / 1000)}k median income)`;
					} else if (s.key === 'safety' && crimeScore) {
						detail = ` (${crimeScore} safety score)`;
					} else if (s.key === 'vibrancy' && pedCount) {
						detail = ` (${Math.round(pedCount)} pedestrians daily)`;
					}
					return `${s.label} (${Math.round(s.score)}/100)${detail}`;
				})
				.join('; ');

			const verb = strengths.length === 1 ? 'is' : 'are';
			p.push(`Your strongest signals ${verb} ${strengthText}. These factors align well with the needs of ${conceptDescription}.`);
		}

		// 3. Non-obvious insight / force multiplier
		if (liveIntel && topStrengths.length > 0) {
			const mainStrength = topStrengths[0];
			if (mainStrength.key === 'transit' && walkScore && walkScore > 70) {
				p.push(
					`There's a hidden advantage here: the area has both transit access and high walkability (${walkScore} Walk Score). That combination makes it a destination, not just a pass-through. Foot traffic compounds.`
				);
			} else if (mainStrength.key === 'demographics' && bachelorsPct && bachelorsPct > 30) {
				p.push(
					`The ${Math.round(bachelorsPct)}% college-educated population is a powerful demographic match. This segment tends to spend more on premium offerings and builds community loyalty fast.`
				);
			} else if (mainStrength.key === 'vibrancy' && pedCount && pedCount > 2000) {
				p.push(
					`The high foot traffic here (${Math.round(pedCount)} pedestrians daily) means you won't need to chase customers. Location visibility is already built in—focus on conversion, not acquisition.`
				);
			} else if (mainStrength.key === 'competition' && competitorCount < 5) {
				p.push(
					`Surprisingly low competition density (${competitorCount} competitors nearby) in a walkable area is rare. You have room to establish market position quickly.`
				);
			} else {
				p.push(
					`The strong ${mainStrength.label} score (${Math.round(mainStrength.score)}) gives you a natural advantage in attracting the right customer profile for ${conceptDescription}.`
				);
			}
		}

		// 4. Risk / concern paragraph
		if (weakestArea && weakestArea.score < 60) {
			const dataQuality = confidence[weakestArea.key];
			const qualityNote =
				dataQuality && dataQuality < 70 ? ' (Note: data is incomplete here; verify on the ground.)' : '';
			p.push(
				`Watch out: ${weakestArea.label} is the weak point (${Math.round(weakestArea.score)}/100). This could impact customer acquisition or operational costs. Before signing a lease, investigate what's driving this score and whether it's fixable through marketing, pricing, or operations.${qualityNote}`
			);
		}

		// 5. Action item paragraph
		p.push(
			`Next step: Walk the block during your target hours. Observe foot traffic, competitor energy, and street-level conditions. Then validate one specific claim from this report in person (e.g., MTA ridership during rush hour, actual competitor capacity, or neighborhood safety).`
		);

		return p;
	});

	// Calculate overall confidence level
	let overallConfidence = $derived.by(() => {
		if (Object.keys(confidence).length === 0) return 75;
		const values = Object.values(confidence).filter((v) => v > 0);
		if (values.length === 0) return 75;
		return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
	});

	let estimatedPct = $derived(100 - overallConfidence);

	// Animation state
	let mounted = $state(false);

	$effect(() => {
		// Trigger animation on mount
		mounted = true;
	});

	// Fetch AI-generated narrative on mount
	$effect(async () => {
		if (!mounted || aiNarrative !== null) return;

		// Only fetch if we have required data
		if (!personaType || !conceptDescription || !address || compositeScore === 0) return;

		isGenerating = true;

		try {
			const response = await authedFetch('/api/generate-brief', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					persona_type: personaType,
					concept_description: conceptDescription,
					address,
					composite_score: compositeScore,
					index_scores: scores,
					spoke_labels: spokeLabels,
					transit_summary: liveIntel?.mtaRidership
						? `MTA ridership: ${Math.round(liveIntel.mtaRidership.totalDailyRidership).toLocaleString()} daily`
						: undefined,
					crime_summary: liveIntel?.crime
						? `Crime score: ${liveIntel.crime.crimeScore}`
						: undefined,
					competitor_count: liveIntel?.competitors?.byDistance?.[0]?.count,
					median_income: liveIntel?.census?.medianHouseholdIncome
				})
			});

			if (!response.ok) {
				console.warn('[TheBrief] API request failed:', response.status);
				aiNarrative = '';
				return;
			}

			const data = await response.json();
			if (data.narrative && data.narrative.trim().length > 0) {
				aiNarrative = data.narrative;
				isAIGenerated = true;
			} else {
				aiNarrative = '';
			}
		} catch (err) {
			console.warn('[TheBrief] Error fetching AI narrative:', err instanceof Error ? err.message : err);
			aiNarrative = '';
		} finally {
			isGenerating = false;
		}
	});
</script>

<div class="brief-card">
	<!-- Header -->
	<div class="brief-header">
		<div class="brief-header-flex">
			<h3 class="brief-title">✨ The Brief</h3>
			{#if isAIGenerated}
				<span class="ai-badge" title="AI-enhanced narrative using Claude Sonnet">🤖 AI</span>
			{/if}
		</div>
		<p class="brief-subtitle">Coaching narrative for {conceptDescription}</p>
	</div>

	<!-- Narrative paragraphs -->
	<div class="brief-content">
		{#if aiNarrative}
			<!-- AI-generated narrative -->
			<p class="brief-paragraph brief-paragraph-ai" class:mounted aria-live="polite" aria-atomic="true">
				{aiNarrative}
			</p>
		{:else if isGenerating}
			<!-- Loading state -->
			<p class="brief-paragraph brief-paragraph-loading" class:mounted aria-live="polite" aria-atomic="true">
				Generating coaching narrative...
			</p>
		{:else}
			<!-- Template fallback paragraphs -->
			{#each paragraphs as para, idx}
				<p
					class="brief-paragraph"
					style="--delay: {idx * 0.1}s"
					class:mounted
					aria-live="polite"
					aria-atomic="true"
				>
					{para}
				</p>
			{/each}
		{/if}
	</div>

	<!-- Confidence bar -->
	{#if overallConfidence > 0}
		<div class="confidence-section">
			<div class="confidence-label">
				Data confidence: <strong>{overallConfidence}%</strong> confirmed, <strong>{estimatedPct}%</strong> estimated
			</div>
			<div class="confidence-bar">
				<div class="confidence-fill" style="width: {overallConfidence}%"></div>
			</div>
		</div>
	{/if}

	<!-- Footer link -->
	<div class="brief-footer">
		<a href="#deep-dive" class="receipts-link">Show me the Receipts →</a>
	</div>
</div>

<style>
	.brief-card {
		background: var(--surface, #FFFFFF);
		border: 1px solid var(--border, #E0E5ED);
		border-radius: 12px;
		padding: 28px;
		margin-bottom: 24px;
		color: var(--text-secondary, #5A6578);
	}

	/* Header */
	.brief-header {
		margin-bottom: 20px;
	}

	.brief-header-flex {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.brief-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text, #1A202C);
		margin: 0;
		letter-spacing: -0.5px;
	}

	.ai-badge {
		display: inline-flex;
		align-items: center;
		background: var(--teal-bg, rgba(13, 124, 110, 0.08));
		border: 1px solid var(--teal-ring, rgba(13, 124, 110, 0.15));
		border-radius: 6px;
		padding: 4px 10px;
		font-size: 11px;
		font-weight: 600;
		color: var(--teal, #0D7C6E);
		text-transform: uppercase;
		letter-spacing: 0.3px;
		cursor: help;
	}

	.brief-subtitle {
		font-size: 12px;
		color: var(--text-secondary, #5A6578);
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Content paragraphs */
	.brief-content {
		margin-bottom: 24px;
	}

	.brief-paragraph {
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary, #5A6578);
		margin: 0 0 16px 0;
		opacity: 0;
		animation: fadeInParagraph 0.6s ease-out forwards;
		animation-delay: var(--delay, 0s);
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.brief-paragraph:last-child {
		margin-bottom: 0;
	}

	.brief-paragraph.mounted {
		opacity: 1;
	}

	.brief-paragraph-ai {
		animation-delay: 0.1s;
	}

	.brief-paragraph-loading {
		font-style: italic;
		color: var(--text-secondary, #5A6578);
		animation-delay: 0s;
	}

	@keyframes fadeInParagraph {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Confidence section */
	.confidence-section {
		margin-bottom: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--border-subtle, #EBF0F5);
	}

	.confidence-label {
		font-size: 12px;
		color: var(--text-secondary, #5A6578);
		margin-bottom: 8px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.confidence-label strong {
		color: var(--text, #1A202C);
		font-weight: 600;
	}

	.confidence-bar {
		height: 6px;
		background: var(--surface-alt, #F0F3F7);
		border-radius: 3px;
		overflow: hidden;
	}

	.confidence-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--teal, #0D7C6E), var(--teal-bright, #0D9488));
		border-radius: 3px;
		transition: width 1.2s ease-out;
	}

	/* Footer link */
	.brief-footer {
		padding-top: 12px;
	}

	.receipts-link {
		font-size: 13px;
		color: var(--teal, #0D7C6E);
		text-decoration: none;
		font-weight: 500;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		transition: color 0.2s ease;
	}

	.receipts-link:hover {
		color: var(--teal-bright, #0D9488);
		text-decoration: underline;
	}

	/* Responsive */
	@media (max-width: 700px) {
		.brief-card {
			padding: 20px;
			margin-bottom: 16px;
		}

		.brief-title {
			font-size: 16px;
		}

		.brief-paragraph {
			font-size: 14px;
			line-height: 1.6;
			margin-bottom: 12px;
		}

		.confidence-label {
			font-size: 11px;
		}

		.receipts-link {
			font-size: 12px;
		}
	}
</style>
