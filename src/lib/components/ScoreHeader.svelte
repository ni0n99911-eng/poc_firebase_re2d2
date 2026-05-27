<script lang="ts">
	/**
	 * ScoreHeader — composite grade + verdict + PRELIM header row.
	 *
	 * Shipped: UX-FIX-1 (Emergency Fix Pack April 11).
	 *
	 * Purpose: one component owns the visual hierarchy of the three pills that
	 * used to fight each other on the hero — the grade letter pill, the verdict
	 * word pill, and the confidence stamp. Before this, the three pills lived in
	 * three different spots with three different styles, PRELIM floated
	 * absolutely on top of the ring, and the whole block read as chaotic.
	 *
	 * Contract:
	 *   - grade:       'A' | 'B' | 'C' | 'D' | 'F'
	 *   - verdict:     human-readable one-word verdict ("Viable", "Workable", "Avoid")
	 *   - verdictIcon: small glyph to left of verdict ('✓' | '◑' | '✗')
	 *   - confidence:  'confident' | 'partial' | 'preliminary' (BR-02 contract)
	 *   - confidenceReason: optional tooltip string explaining the stamp
	 *
	 * Layout: baseline-aligned horizontal row for [grade pill] [verdict pill],
	 * PRELIM/PARTIAL demoted to a muted amber pill on the next line.
	 */

	type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
	type Confidence = 'confident' | 'partial' | 'preliminary';

	let {
		grade,
		verdict,
		verdictIcon = '',
		confidence = 'confident',
		confidenceReason = '',
	}: {
		grade: Grade;
		verdict: string;
		verdictIcon?: string;
		confidence?: Confidence;
		confidenceReason?: string;
	} = $props();
</script>

<div class="sh-root">
	<div class="sh-row">
		<span class="sh-grade-pill sh-grade-{grade.toLowerCase()}" aria-label="Letter grade {grade}">Grade {grade}</span>
		<span class="sh-verdict-pill" aria-label="Verdict {verdict}">
			{#if verdictIcon}<span class="sh-verdict-ico" aria-hidden="true">{verdictIcon}</span>{/if}
			{verdict}
		</span>
	</div>
	{#if confidence === 'preliminary'}
		<div class="sh-prelim-row">
			<span class="sh-prelim-pill sh-prelim-loud" title={confidenceReason}>PRELIM — score will sharpen as you add details</span>
		</div>
	{:else if confidence === 'partial'}
		<div class="sh-prelim-row">
			<!-- M4: sentence case per overnight spec -->
			<span class="sh-prelim-pill sh-prelim-soft" title={confidenceReason}>Partial read — add more details to sharpen your score.</span>
		</div>
	{/if}
</div>

<style>
	.sh-root {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 6px;
	}
	.sh-row {
		display: flex;
		align-items: center;
		gap: 8px;
		/* baseline alignment — both pills sit on the same text baseline */
		line-height: 1;
	}
	.sh-grade-pill,
	.sh-verdict-pill {
		display: inline-flex;
		align-items: center;
		height: 24px;
		padding: 0 10px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.2px;
		white-space: nowrap;
	}
	/* Grade pill — letter-indexed color to match existing hero grade tones */
	.sh-grade-pill { background: rgba(255, 255, 255, 0.14); color: #fff; border: 1px solid rgba(255, 255, 255, 0.25); }
	.sh-grade-a { background: rgba(52, 211, 153, 0.24); border-color: rgba(52, 211, 153, 0.55); }
	.sh-grade-b { background: rgba(132, 204, 22, 0.22); border-color: rgba(132, 204, 22, 0.5); }
	.sh-grade-c { background: rgba(251, 191, 36, 0.22); border-color: rgba(251, 191, 36, 0.5); }
	.sh-grade-d { background: rgba(251, 146, 60, 0.22); border-color: rgba(251, 146, 60, 0.5); }
	.sh-grade-f { background: rgba(248, 113, 113, 0.22); border-color: rgba(248, 113, 113, 0.55); }
	/* Verdict pill — solid muted white on dark hero */
	.sh-verdict-pill {
		background: rgba(255, 255, 255, 0.92);
		color: #1f2937;
		border: 1px solid rgba(255, 255, 255, 0.95);
	}
	.sh-verdict-ico { margin-right: 4px; font-size: 11px; }
	/* PRELIM / PARTIAL — demoted to a small amber pill under the verdict row */
	.sh-prelim-row { display: flex; align-items: center; }
	.sh-prelim-pill {
		display: inline-flex;
		align-items: center;
		height: 20px;
		padding: 0 8px;
		border-radius: 10px;
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.3px;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.sh-prelim-loud {
		background: rgba(251, 191, 36, 0.2);
		color: #fcd34d;
		border: 1px solid rgba(251, 191, 36, 0.55);
	}
	.sh-prelim-soft {
		background: rgba(253, 224, 71, 0.14);
		color: #fde68a;
		border: 1px solid rgba(253, 224, 71, 0.35);
	}
</style>
