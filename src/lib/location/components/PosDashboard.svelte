<script lang="ts">
	import type { VLFResult, GLFResult, RRResult, PoSResult } from '../scoring/engines';

	let { posData, vlfData, glfData, rrData }: {
		posData: PoSResult;
		vlfData: VLFResult;
		glfData: GLFResult;
		rrData: RRResult;
	} = $props();

	let expandedEngine = $state<string | null>(null);

	function toggleEngine(name: string) {
		expandedEngine = expandedEngine === name ? null : name;
	}
</script>

<div class="pos-dashboard">
	<div class="pos-main">
		<div class="pos-range">
			<div class="pos-range-val">{posData.low}–{posData.high}%</div>
			<div class="pos-range-label">PROBABILITY OF SUCCESS</div>
		</div>
		<div class="pos-verdict">
			<div class="pos-verdict-text">{posData.verdict}</div>
			<div class="pos-verdict-sub">Data completeness: {(posData.uncertainty * 100).toFixed(0)}% certainty</div>
		</div>
		<div style="text-align:center">
			<span style="font-size:12px;font-weight:700;color:var(--cyan)">Base PoS: {posData.base}%</span>
		</div>
	</div>

	<div class="pos-engines">
		<!-- VLF Engine -->
		<div class="pos-engine" class:expanded={expandedEngine === 'vlf'} onclick={() => toggleEngine('vlf')}>
			<div class="pos-engine-title">Vision-Location Fit</div>
			<div class="pos-engine-score">{vlfData.vlf}</div>
			<div class="pos-engine-label" style="color:var(--cyan)">35% of PoS</div>
			{#if expandedEngine === 'vlf'}
				<div class="pos-subrules" style="display:block">
					<div class="pos-subrule"><div class="pos-subrule-name">Rule 1A: Demographic Match</div><div class="pos-subrule-val">{vlfData.rule1A}</div></div>
					<div class="pos-subrule"><div class="pos-subrule-name">Rule 1B: Brand Identity</div><div class="pos-subrule-val">{Math.round(vlfData.rule1B)}</div></div>
					<div class="pos-subrule"><div class="pos-subrule-name">Rule 1C: Gap Analysis</div><div class="pos-subrule-val">{Math.round(vlfData.rule1C)}</div></div>
					<div class="pos-subrule"><div class="pos-subrule-name">Rule 1D: Trend Alignment</div><div class="pos-subrule-val">{vlfData.rule1D}</div></div>
				</div>
			{/if}
		</div>

		<!-- GLF Engine -->
		<div class="pos-engine" class:expanded={expandedEngine === 'glf'} onclick={() => toggleEngine('glf')}>
			<div class="pos-engine-title">Goal-Location Fit</div>
			<div class="pos-engine-score">{glfData.glf}</div>
			<div class="pos-engine-label" style="color:var(--gold)">40% of PoS</div>
			{#if expandedEngine === 'glf'}
				<div class="pos-subrules" style="display:block">
					<div class="pos-subrule"><div class="pos-subrule-name">Rule 2A: Revenue Ceiling</div><div class="pos-subrule-val">{glfData.rule2A}</div></div>
					<div class="pos-subrule"><div class="pos-subrule-name">Rule 2B: Rent Burden</div><div class="pos-subrule-val">{Math.round(glfData.rule2B)}</div></div>
					<div class="pos-subrule"><div class="pos-subrule-name">Rule 2C: Breakeven</div><div class="pos-subrule-val">{Math.round(glfData.rule2C)}</div></div>
					<div class="pos-subrule"><div class="pos-subrule-name">Rule 2D: Multi-Unit</div><div class="pos-subrule-val">{glfData.rule2D}</div></div>
					<div class="pos-subrule"><div class="pos-subrule-name">Rule 2E: Talent</div><div class="pos-subrule-val">{Math.round(glfData.rule2E)}</div></div>
				</div>
			{/if}
		</div>

		<!-- R&R Engine -->
		<div class="pos-engine" class:expanded={expandedEngine === 'rr'} onclick={() => toggleEngine('rr')}>
			<div class="pos-engine-title">Risk & Resilience</div>
			<div class="pos-engine-score">{rrData.rr}</div>
			<div class="pos-engine-label" style="color:var(--purple)">25% of PoS</div>
			{#if expandedEngine === 'rr'}
				<div class="pos-subrules" style="display:block">
					<div class="pos-subrule"><div class="pos-subrule-name">Market Risk (55%)</div><div class="pos-subrule-val">{rrData.marketRisk ?? rrData.substitutionRisk}</div></div>
					<div class="pos-subrule"><div class="pos-subrule-name">Execution Risk (45%)</div><div class="pos-subrule-val">{rrData.executionRisk ?? rrData.riskScore}</div></div>
					<div class="pos-subrule"><div class="pos-subrule-name">Est. Rent</div><div class="pos-subrule-val">${(rrData.rentEstimate ?? 15000).toLocaleString()}/mo ({rrData.rentSource ?? 'default'})</div></div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.pos-dashboard { background: linear-gradient(135deg, var(--surface-elevated) 0%, #16213e 100%); border: 2px solid var(--red); border-radius: 14px; padding: 28px; margin: 20px 0; position: relative; }
	.pos-main { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 24px; }
	@media (max-width: 900px) { .pos-main { grid-template-columns: 1fr; } }
	.pos-range { text-align: center; }
	.pos-range-val { font-size: 48px; font-weight: 900; font-family: 'DM Mono', monospace; color: var(--cyan); letter-spacing: -1px; }
	.pos-range-label { font-size: 11px; color: var(--muted); font-family: 'DM Mono', monospace; letter-spacing: 1px; margin-top: 6px; text-transform: uppercase; }
	.pos-verdict { text-align: center; padding: 16px; background: #ffffff06; border-radius: 10px; }
	.pos-verdict-text { font-size: 18px; font-weight: 800; color: var(--gold); margin-bottom: 8px; }
	.pos-verdict-sub { font-size: 11px; color: var(--sub); font-family: 'DM Mono', monospace; }
	.pos-engines { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
	@media (max-width: 900px) { .pos-engines { grid-template-columns: 1fr; } }
	.pos-engine { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; padding: 14px; cursor: pointer; transition: all 0.15s; }
	.pos-engine:hover { border-color: var(--cyan); background: rgba(0,232,204,0.05); }
	.pos-engine.expanded { border-color: var(--cyan); background: rgba(0,232,204,0.08); }
	.pos-engine-title { font-size: 11px; font-family: 'DM Mono', monospace; color: var(--muted); letter-spacing: 1px; margin-bottom: 8px; }
	.pos-engine-score { font-size: 32px; font-weight: 800; font-family: 'DM Mono', monospace; color: var(--cyan); }
	.pos-engine-label { font-size: 10px; color: var(--sub); margin-top: 6px; }
	.pos-subrules { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px; }
	.pos-subrule { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #ffffff06; font-size: 10px; }
	.pos-subrule:last-child { border: none; }
	.pos-subrule-name { flex: 1; color: var(--text); }
	.pos-subrule-val { font-family: 'DM Mono', monospace; font-weight: 700; color: var(--cyan); min-width: 30px; text-align: right; }
</style>
