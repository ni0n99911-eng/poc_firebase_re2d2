<script lang="ts">
	import FeedbackButton from '$lib/components/FeedbackButton.svelte';
	import { generateHeadsUpWarnings, warningsFromLenses, type HeadsUpWarning, type LensForWatchOut } from '$lib/intel/heads-up-engine';

	let { personaKey, questionAnswers, scoringData, lenses } = $props<{
		personaKey: string;
		questionAnswers: Record<string, string>;
		scoringData?: Record<string, number>;
		/** EF-3: lens slices from BR-06 so lens warnings auto-propagate here. */
		lenses?: LensForWatchOut[] | null;
	}>();

	// EF-3: persona/universal warnings first, then lens propagation (deduped).
	let personaWarnings = $derived(generateHeadsUpWarnings(personaKey, questionAnswers, scoringData));
	let lensWarnings    = $derived(warningsFromLenses(lenses, personaWarnings));
	// UX-D: Sort by severity — critical (kill) first, then important, then info.
	const SEVERITY_ORDER: Record<string, number> = { critical: 0, important: 1, info: 2 };
	let warnings = $derived(
		[...personaWarnings, ...lensWarnings].sort(
			(a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
		)
	);

	function severityColor(severity: HeadsUpWarning['severity']): string {
		if (severity === 'critical') return '#dc2626';
		if (severity === 'important') return 'var(--amber, #f59e0b)';
		return 'var(--teal, #0d7c6e)';
	}

	function severityBg(severity: HeadsUpWarning['severity']): string {
		if (severity === 'critical') return 'rgba(220, 38, 38, 0.12)';
		if (severity === 'important') return 'rgba(180, 83, 9, 0.08)';
		return 'rgba(13, 124, 110, 0.08)';
	}

	function severityLabel(severity: HeadsUpWarning['severity']): string {
		if (severity === 'critical') return 'Deal Breaker';
		if (severity === 'important') return 'Important';
		return 'Good to Know';
	}

	function severityIcon(severity: HeadsUpWarning['severity'], originalIcon: string): string {
		if (severity === 'critical') return '⛔';
		return originalIcon;
	}
</script>

{#if warnings.length > 0}
	<div class="heads-up-section">
		<div class="section-header">
			<span class="section-icon">⚠️</span>
			<div>
				<h3 class="section-title">Heads Up</h3>
				<p class="section-sub">Things to verify before you sign</p>
			</div>
		</div>

		<div class="warnings-list">
			{#each warnings as warning, i}
				<div
					class="warning-card {warning.severity === 'critical' ? 'warning-card-kill' : ''}"
					style="border-left-color: {severityColor(warning.severity)}; background: {severityBg(warning.severity)}"
				>
					<div class="warning-top">
						<span class="warning-icon">{severityIcon(warning.severity, warning.icon)}</span>
						<div class="warning-content">
							<div class="warning-header">
								<h4 class="warning-title">{warning.title}</h4>
								<span
									class="severity-badge {warning.severity === 'critical' ? 'severity-badge-kill' : ''}"
									style="color: {warning.severity === 'critical' ? '#fff' : severityColor(warning.severity)}; background: {warning.severity === 'critical' ? '#dc2626' : severityBg(warning.severity)}"
								>
									{severityLabel(warning.severity)}
								</span>
							</div>
							<p class="warning-desc">{warning.description}</p>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div class="feedback-row">
			<FeedbackButton sectionId="heads-up-cards" />
		</div>
	</div>
{/if}

<style>
	.heads-up-section {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 24px;
		margin-bottom: 16px;
	}

	.section-header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin-bottom: 20px;
	}

	.section-icon {
		font-size: 24px;
		line-height: 1;
		flex-shrink: 0;
	}

	.section-title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 2px 0;
	}

	.section-sub {
		font-size: 13px;
		color: var(--text-secondary);
		margin: 0;
	}

	.warnings-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.warning-card {
		border-left: 4px solid;
		border-radius: 10px;
		padding: 16px;
		transition: transform 0.15s ease;
		background: var(--bg);
	}

	/* UX-D: Kill-factor card — unmissable red treatment */
	.warning-card-kill {
		border: 2px solid rgba(220, 38, 38, 0.3);
		border-left: 5px solid #dc2626;
		background: rgba(220, 38, 38, 0.08);
		box-shadow: 0 2px 8px rgba(220, 38, 38, 0.12);
	}

	.severity-badge-kill {
		font-weight: 700;
	}

	.warning-card:hover {
		transform: translateX(2px);
	}

	.warning-top {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.warning-icon {
		font-size: 20px;
		line-height: 1;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.warning-content {
		flex: 1;
		min-width: 0;
	}

	.warning-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 6px;
		flex-wrap: wrap;
	}

	.warning-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}

	.severity-badge {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 10px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}

	.warning-desc {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.feedback-row {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	@media (max-width: 640px) {
		.heads-up-section {
			padding: 16px;
		}

		.warning-card {
			padding: 12px;
		}

		.warning-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
		}
	}
</style>
