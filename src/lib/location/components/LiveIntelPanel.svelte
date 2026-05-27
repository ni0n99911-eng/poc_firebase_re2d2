<script lang="ts">
	import type { LiveIntelReport } from '../api/geo';
	import { scoreColor } from '../utils/helpers';

	let { intel }: { intel: LiveIntelReport } = $props();
</script>

<div class="section live-intel">
	<div class="section-title" style="font-size:14px;margin-bottom:12px">📡 Live Location Intelligence</div>
	<div class="data-grid">
		{#if intel.census}
			<div class="data-box"><div class="data-box-label">MED. INCOME</div><div class="data-box-val" style="color:var(--green)">${Math.round(intel.census.medianHouseholdIncome / 1000)}k</div></div>
			<div class="data-box"><div class="data-box-label">POPULATION</div><div class="data-box-val">{intel.census.totalPopulation.toLocaleString()}</div></div>
			<div class="data-box"><div class="data-box-label">MED. AGE</div><div class="data-box-val">{intel.census.medianAge}</div></div>
			<div class="data-box"><div class="data-box-label">COLLEGE %</div><div class="data-box-val">{intel.census.bachelorsPlusPercent}%</div></div>
		{/if}
		{#if intel.walkScore}
			<div class="data-box"><div class="data-box-label">WALK SCORE</div><div class="data-box-val" style="color:{scoreColor(intel.walkScore.walkScore)}">{intel.walkScore.walkScore}</div></div>
			<div class="data-box"><div class="data-box-label">TRANSIT</div><div class="data-box-val" style="color:{scoreColor(intel.walkScore.transitScore)}">{intel.walkScore.transitScore}</div></div>
			<div class="data-box"><div class="data-box-label">BIKE</div><div class="data-box-val" style="color:{scoreColor(intel.walkScore.bikeScore)}">{intel.walkScore.bikeScore}</div></div>
		{/if}
		{#if intel.crime}
			<div class="data-box"><div class="data-box-label">SAFETY SCORE</div><div class="data-box-val" style="color:{scoreColor(intel.crime.crimeScore)}">{intel.crime.crimeScore}</div></div>
		{/if}
	</div>

	{#if intel.inspections && intel.inspections.totalNearby > 0}
		<div class="inspection-info">
			🏥 {intel.inspections.totalNearby} inspected restaurants nearby —
			{intel.inspections.gradeDistribution.A} A-grade,
			{intel.inspections.gradeDistribution.B} B-grade,
			{intel.inspections.gradeDistribution.C} C-grade
		</div>
	{/if}

	<div class="sources">
		SOURCES:
		{#if intel.census}U.S. Census ACS{/if}
		{#if intel.crime} · NYPD CompStat{/if}
		{#if intel.walkScore} · {intel.walkScore.source === 'walkscore-api' ? 'Walk Score API' : 'Walk Score (est.)'}{/if}
		{#if intel.inspections} · NYC DOHMH{/if}
		{#if intel.errors && intel.errors.length > 0} · ⚠ {intel.errors.length} source(s) unavailable{/if}
	</div>
</div>

<style>
	.live-intel { margin-top: 14px; padding: 16px; }
	.section { background: var(--bg2); border: 1px solid var(--border); border-radius: 14px; padding: 28px; margin-bottom: 18px; }
	.section-title { font-size: 16px; font-weight: 800; margin-bottom: 18px; display: flex; align-items: center; gap: 10px; }
	.data-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
	@media (max-width: 700px) { .data-grid { grid-template-columns: repeat(2, 1fr); } }
	.data-box { background: var(--bg3); border-radius: 8px; padding: 10px 12px; border: 1px solid var(--border); }
	.data-box-label { font-size: 11px; color: var(--muted); font-family: 'DM Mono', monospace; letter-spacing: 0.5px; margin-bottom: 4px; }
	.data-box-val { font-size: 18px; font-weight: 700; }
	.inspection-info { margin-top: 10px; font-size: 12px; color: var(--sub); font-family: 'DM Mono', monospace; }
	.sources { margin-top: 8px; font-size: 10px; color: var(--muted); font-family: 'DM Mono', monospace; letter-spacing: 0.5px; }
</style>
