<script lang="ts">
	/**
	 * VisionNarrative — Displays the pre-computed block group vision.
	 *
	 * Four sections: Character, Gaps, Opportunities, Momentum.
	 * Shows instantly from stored data — no API call needed.
	 */

	let {
		vision = null,
		borough = '',
		geoid = '',
		locationIQ = 0,
	}: {
		vision?: { narrative: string; structured: { character: string; gaps: string; opportunities: string; momentum: string } } | null;
		borough?: string;
		geoid?: string;
		locationIQ?: number;
	} = $props();

	let expanded = $state(true);

	const sections = [
		{ key: 'character', label: 'Character', icon: '🏙️', color: '#6366F1' },
		{ key: 'gaps', label: 'Gaps', icon: '🔍', color: '#F59E0B' },
		{ key: 'opportunities', label: 'Opportunities', icon: '🚀', color: '#10B981' },
		{ key: 'momentum', label: 'Momentum', icon: '📈', color: '#3B82F6' },
	] as const;

	let mounted = $state(false);
	$effect(() => { mounted = true; });
</script>

{#if vision?.structured}
	<div class="vision-card" class:mounted>
		<div class="vision-header" role="button" tabindex="0" onclick={() => expanded = !expanded} onkeydown={(e) => e.key === 'Enter' && (expanded = !expanded)}>
			<div class="header-left">
				<h3 class="vision-title">🔮 Location Vision</h3>
				{#if borough}
					<span class="borough-tag">{borough}</span>
				{/if}
			</div>
			<button class="toggle-btn" aria-label={expanded ? 'Collapse' : 'Expand'}>
				<span class="chevron" class:rotated={expanded}>▾</span>
			</button>
		</div>

		{#if expanded}
			<div class="vision-content">
				{#each sections as section, idx}
					{@const text = vision.structured[section.key]}
					{#if text}
						<div class="vision-section" style="--delay: {idx * 0.08}s; --accent: {section.color}">
							<div class="section-label">
								<span class="section-icon">{section.icon}</span>
								<span class="section-name">{section.label}</span>
							</div>
							<p class="section-text">{text}</p>
						</div>
					{/if}
				{/each}
			</div>

			{#if geoid}
				<div class="vision-meta">
					Block Group {geoid} · Pre-computed vision · Powered by Claude Opus
				</div>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.vision-card {
		background: var(--surface, #FFFFFF);
		border: 1px solid var(--border, #E0E5ED);
		border-radius: 12px;
		padding: 0;
		margin-bottom: 24px;
		overflow: hidden;
		opacity: 0;
		transform: translateY(8px);
		animation: fadeIn 0.4s ease-out forwards;
	}

	.vision-card.mounted {
		opacity: 1;
		transform: none;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.vision-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px;
		cursor: pointer;
		user-select: none;
		border-bottom: 1px solid var(--border-subtle, #EBF0F5);
	}

	.vision-header:hover {
		background: var(--surface-hover, #F8FAFC);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.vision-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text, #1A202C);
		margin: 0;
		letter-spacing: -0.5px;
	}

	.borough-tag {
		display: inline-flex;
		align-items: center;
		background: var(--indigo-bg, rgba(99, 102, 241, 0.08));
		border: 1px solid var(--indigo-ring, rgba(99, 102, 241, 0.15));
		border-radius: 6px;
		padding: 3px 10px;
		font-size: 11px;
		font-weight: 600;
		color: var(--indigo, #6366F1);
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.toggle-btn {
		background: none;
		border: none;
		padding: 4px;
		cursor: pointer;
		color: var(--text-secondary, #5A6578);
		font-size: 16px;
	}

	.chevron {
		display: inline-block;
		transition: transform 0.2s ease;
	}

	.chevron.rotated {
		transform: rotate(0deg);
	}

	.chevron:not(.rotated) {
		transform: rotate(-90deg);
	}

	.vision-content {
		padding: 8px 24px 20px;
	}

	.vision-section {
		padding: 16px 0;
		border-bottom: 1px solid var(--border-subtle, #EBF0F5);
		opacity: 0;
		animation: sectionFade 0.4s ease-out forwards;
		animation-delay: var(--delay, 0s);
	}

	.vision-section:last-child {
		border-bottom: none;
	}

	@keyframes sectionFade {
		from { opacity: 0; transform: translateX(-8px); }
		to { opacity: 1; transform: translateX(0); }
	}

	.section-label {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.section-icon {
		font-size: 16px;
	}

	.section-name {
		font-size: 12px;
		font-weight: 700;
		color: var(--accent, #6366F1);
		text-transform: uppercase;
		letter-spacing: 0.8px;
	}

	.section-text {
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary, #5A6578);
		margin: 0;
	}

	.vision-meta {
		padding: 12px 24px;
		font-size: 11px;
		color: var(--text-muted, #9CA3AF);
		border-top: 1px solid var(--border-subtle, #EBF0F5);
		text-align: center;
		letter-spacing: 0.2px;
	}

	@media (max-width: 700px) {
		.vision-header {
			padding: 16px 18px;
		}

		.vision-content {
			padding: 4px 18px 16px;
		}

		.vision-title {
			font-size: 16px;
		}

		.section-text {
			font-size: 14px;
			line-height: 1.6;
		}
	}
</style>
