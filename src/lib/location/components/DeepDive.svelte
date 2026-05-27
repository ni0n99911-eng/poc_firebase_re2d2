<script lang="ts">
	import type { VLFResult, GLFResult, RRResult, PoSResult } from '../scoring/engines';
	import type { LiveIntelReport, ScanData } from '../api/geo';
	import { fmtD } from '../utils/helpers';
	// 04.25.2026 16:36 CoPilot Sanitization — sanitizeHtml for LLM commentary
	import { sanitizeHtml } from '$lib/utils/copilot-sanitize';

	let { vlfData, glfData, rrData, posData, liveIntel, data, commentary }: {
		vlfData: VLFResult | null;
		glfData: GLFResult | null;
		rrData: RRResult | null;
		posData: PoSResult | null;
		liveIntel: LiveIntelReport | null;
		data: ScanData;
		commentary: string;
	} = $props();

	let openSection = $state<string | null>(null);

	function toggle(section: string) {
		openSection = openSection === section ? null : section;
	}

	// Human-readable sub-score descriptions
	function vlfLabel(rule: string, val: number): string {
		const rating = val >= 75 ? 'Strong' : val >= 55 ? 'Moderate' : 'Weak';
		const labels: Record<string, string> = {
			'1A': 'Demographic Match',
			'1B': 'Neighborhood Fit',
			'1C': 'Market Gap',
			'1D': 'Trend Alignment'
		};
		return `${labels[rule] || rule}: ${rating} (${val}/100)`;
	}

	function glfLabel(rule: string, val: number): string {
		const rating = val >= 75 ? 'Strong' : val >= 55 ? 'Moderate' : 'Challenging';
		const labels: Record<string, string> = {
			'2A': 'Revenue Potential',
			'2B': 'Rent Affordability',
			'2C': 'Break-even Timeline',
			'2D': 'Growth Potential',
			'2E': 'Talent Availability'
		};
		return `${labels[rule] || rule}: ${rating} (${Math.round(val)}/100)`;
	}

	function rrLabel(rule: string, val: number): string {
		if (rule === 'rent') {
			return `Est. Monthly Rent: $${val.toLocaleString()}`;
		}
		// For market/execution risk, higher = LESS risky (inverted from old labels)
		const rating = val >= 70 ? 'Low Risk' : val >= 40 ? 'Moderate' : 'High Risk';
		const labels: Record<string, string> = {
			'mkt': 'Market Risk',
			'exec': 'Execution Risk',
			'sub': 'Substitution Risk',
			'reg': 'Regulatory Risk',
			'land': 'Landlord Risk'
		};
		return `${labels[rule] || rule}: ${rating} (${Math.round(val)}/100)`;
	}
</script>

<div class="deep-dive">
	<div class="deep-dive-header">
		<span class="deep-dive-title">Detailed Breakdown</span>
		<span class="deep-dive-hint">Tap a section to expand</span>
	</div>

	<!-- Section 1: Vision Fit -->
	{#if vlfData}
		<button class="dd-section" class:open={openSection === 'vision'} onclick={() => toggle('vision')}>
			<div class="dd-section-header">
				<span class="dd-section-icon">🎯</span>
				<span class="dd-section-name">Vision Fit</span>
				<span class="dd-section-desc">Does this neighborhood match your concept?</span>
				<span class="dd-section-score" style="color:{vlfData.vlf >= 70 ? 'var(--green)' : vlfData.vlf >= 50 ? 'var(--yellow)' : 'var(--redtag)'}">{vlfData.vlf}</span>
				<span class="dd-chevron">{openSection === 'vision' ? '▲' : '▼'}</span>
			</div>
			{#if openSection === 'vision'}
				<div class="dd-detail">
					<div class="dd-sub-scores">
						<div class="dd-sub">{vlfLabel('1A', vlfData.rule1A)}</div>
						<div class="dd-sub">{vlfLabel('1B', Math.round(vlfData.rule1B))}</div>
						<div class="dd-sub">{vlfLabel('1C', Math.round(vlfData.rule1C))}</div>
						<div class="dd-sub">{vlfLabel('1D', vlfData.rule1D)}</div>
					</div>
				</div>
			{/if}
		</button>
	{/if}

	<!-- Section 2: Financial Feasibility -->
	{#if glfData}
		<button class="dd-section" class:open={openSection === 'financial'} onclick={() => toggle('financial')}>
			<div class="dd-section-header">
				<span class="dd-section-icon">💰</span>
				<span class="dd-section-name">Financial Feasibility</span>
				<span class="dd-section-desc">Can you make money here?</span>
				<span class="dd-section-score" style="color:{glfData.glf >= 70 ? 'var(--green)' : glfData.glf >= 50 ? 'var(--yellow)' : 'var(--redtag)'}">{glfData.glf}</span>
				<span class="dd-chevron">{openSection === 'financial' ? '▲' : '▼'}</span>
			</div>
			{#if openSection === 'financial'}
				<div class="dd-detail">
					<div class="dd-sub-scores">
						<div class="dd-sub">{glfLabel('2A', glfData.rule2A)}</div>
						<div class="dd-sub">{glfLabel('2B', glfData.rule2B)}</div>
						<div class="dd-sub">{glfLabel('2C', glfData.rule2C)}</div>
						<div class="dd-sub">{glfLabel('2D', glfData.rule2D)}</div>
						<div class="dd-sub">{glfLabel('2E', glfData.rule2E)}</div>
					</div>
				</div>
			{/if}
		</button>
	{/if}

	<!-- Section 3: Risk Assessment -->
	{#if rrData}
		<button class="dd-section" class:open={openSection === 'risk'} onclick={() => toggle('risk')}>
			<div class="dd-section-header">
				<span class="dd-section-icon">🛡️</span>
				<span class="dd-section-name">Risk Assessment</span>
				<span class="dd-section-desc">What could go wrong?</span>
				<span class="dd-section-score" style="color:{rrData.rr >= 70 ? 'var(--green)' : rrData.rr >= 50 ? 'var(--yellow)' : 'var(--redtag)'}">{rrData.rr}</span>
				<span class="dd-chevron">{openSection === 'risk' ? '▲' : '▼'}</span>
			</div>
			{#if openSection === 'risk'}
				<div class="dd-detail">
					<div class="dd-sub-scores">
						<div class="dd-sub">{rrLabel('mkt', rrData.marketRisk ?? rrData.substitutionRisk)}</div>
						<div class="dd-sub">{rrLabel('exec', rrData.executionRisk ?? rrData.riskScore)}</div>
						<div class="dd-sub">{rrLabel('rent', rrData.rentEstimate ?? 0)}</div>
					</div>
				</div>
			{/if}
		</button>
	{/if}

	<!-- Section 4: Location Data -->
	<button class="dd-section" class:open={openSection === 'data'} onclick={() => toggle('data')}>
		<div class="dd-section-header">
			<span class="dd-section-icon">📊</span>
			<span class="dd-section-name">Nearby Businesses & Transit</span>
			<span class="dd-section-desc">What's around this address</span>
			<span class="dd-section-score" style="color:var(--cyan)">{data.cafes.length + data.gyms.length + data.yoga.length}</span>
			<span class="dd-chevron">{openSection === 'data' ? '▲' : '▼'}</span>
		</div>
		{#if openSection === 'data'}
			<div class="dd-detail">
				<div class="dd-lists">
					{#each [
						{ title: 'Competitors', items: data.cafes, color: 'var(--redtag)' },
						{ title: 'Gyms', items: data.gyms, color: 'var(--cyan)' },
						{ title: 'Yoga & Pilates', items: data.yoga, color: 'var(--purple)' },
						{ title: 'Transit Stations', items: data.stations, color: 'var(--gold)' },
					] as sec}
						{#if sec.items.length > 0}
							<div class="dd-list">
								<div class="dd-list-title" style="color:{sec.color}">{sec.title} ({sec.items.length})</div>
								{#each sec.items.slice(0, 8) as item}
									<div class="dd-list-item">
										<span>{item.name}</span>
										<span class="dd-list-dist">{fmtD(item.dist)}</span>
									</div>
								{/each}
								{#if sec.items.length > 8}
									<div class="dd-list-more">+{sec.items.length - 8} more</div>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}
	</button>

	<!-- Section 5: Live Intel Data -->
	{#if liveIntel}
		<button class="dd-section" class:open={openSection === 'intel'} onclick={() => toggle('intel')}>
			<div class="dd-section-header">
				<span class="dd-section-icon">📡</span>
				<span class="dd-section-name">Census & Neighborhood Data</span>
				<span class="dd-section-desc">Detailed demographics and scores</span>
				<span class="dd-chevron">{openSection === 'intel' ? '▲' : '▼'}</span>
			</div>
			{#if openSection === 'intel'}
				<div class="dd-detail">
					<div class="dd-data-grid">
						{#if liveIntel.census}
							<div class="dd-data-item"><span class="dd-data-label">Median Income</span><span class="dd-data-val">${Math.round(liveIntel.census.medianHouseholdIncome / 1000)}k</span></div>
							<div class="dd-data-item"><span class="dd-data-label">Population</span><span class="dd-data-val">{liveIntel.census.totalPopulation.toLocaleString()}</span></div>
							<div class="dd-data-item"><span class="dd-data-label">Median Age</span><span class="dd-data-val">{liveIntel.census.medianAge}</span></div>
							<div class="dd-data-item"><span class="dd-data-label">College Educated</span><span class="dd-data-val">{liveIntel.census.bachelorsPlusPercent}%</span></div>
						{/if}
						{#if liveIntel.walkScore}
							<div class="dd-data-item"><span class="dd-data-label">Walk Score</span><span class="dd-data-val">{liveIntel.walkScore.walkScore}</span></div>
							<div class="dd-data-item"><span class="dd-data-label">Transit Score</span><span class="dd-data-val">{liveIntel.walkScore.transitScore}</span></div>
							<div class="dd-data-item"><span class="dd-data-label">Bike Score</span><span class="dd-data-val">{liveIntel.walkScore.bikeScore}</span></div>
						{/if}
						{#if liveIntel.crime}
							<div class="dd-data-item"><span class="dd-data-label">Safety Score</span><span class="dd-data-val">{liveIntel.crime.crimeScore}</span></div>
						{/if}
					</div>
					{#if liveIntel.inspections && liveIntel.inspections.totalNearby > 0}
						<div class="dd-note">
							{liveIntel.inspections.totalNearby} inspected restaurants nearby —
							{liveIntel.inspections.gradeDistribution.A} A-grade,
							{liveIntel.inspections.gradeDistribution.B} B-grade,
							{liveIntel.inspections.gradeDistribution.C} C-grade
						</div>
					{/if}
				</div>
			{/if}
		</button>
	{/if}

	<!-- AI Commentary -->
	{#if commentary}
		<button class="dd-section" class:open={openSection === 'commentary'} onclick={() => toggle('commentary')}>
			<div class="dd-section-header">
				<span class="dd-section-icon">🤖</span>
				<span class="dd-section-name">AI Analysis</span>
				<span class="dd-section-desc">Detailed commentary on this location</span>
				<span class="dd-chevron">{openSection === 'commentary' ? '▲' : '▼'}</span>
			</div>
			{#if openSection === 'commentary'}
				<div class="dd-detail">
					<div class="dd-commentary">{@html sanitizeHtml(commentary.replace(/\n/g, '<br>'))}</div>
				</div>
			{/if}
		</button>
	{/if}
</div>

<style>
	.deep-dive {
		background: var(--surface, #ffffff);
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
		margin-bottom: 20px;
	}

	.deep-dive-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
		background: rgba(0, 113, 227, 0.02);
	}

	.deep-dive-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.deep-dive-hint {
		font-size: 11px;
		color: var(--muted);
	}

	.dd-section {
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border);
		overflow: hidden;
		cursor: pointer;
		transition: background 0.15s ease;
		text-align: left;
		font-family: inherit;
		color: var(--text);
		width: 100%;
		padding: 0;
	}
	.dd-section:last-child { border-bottom: none; }

	.dd-section:hover { background: rgba(0,0,0,0.02); }
	.dd-section.open { background: rgba(0,113,227,0.03); }

	.dd-section-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px 20px;
	}

	.dd-section-icon { font-size: 18px; flex-shrink: 0; }

	.dd-section-name {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-bright, var(--text));
		flex-shrink: 0;
	}

	.dd-section-desc {
		flex: 1;
		font-size: 13px;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dd-section-score {
		font-size: 18px;
		font-weight: 700;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}

	.dd-chevron {
		font-size: 10px;
		color: var(--muted);
		flex-shrink: 0;
	}

	.dd-detail {
		padding: 0 20px 20px;
		border-top: 1px solid var(--border);
		margin-top: 0;
		padding-top: 16px;
	}

	/* Sub-scores */
	.dd-sub-scores {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	@media (max-width: 700px) { .dd-sub-scores { grid-template-columns: 1fr; } }

	.dd-sub {
		font-size: 13px;
		color: var(--text);
		padding: 10px 14px;
		background: rgba(255,255,255,0.02);
		border-radius: 8px;
		border: 1px solid var(--border);
	}

	/* Data lists */
	.dd-lists {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	@media (max-width: 700px) { .dd-lists { grid-template-columns: 1fr; } }

	.dd-list {
		background: rgba(255,255,255,0.02);
		border-radius: 10px;
		padding: 14px;
		border: 1px solid var(--border);
	}

	.dd-list-title {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.5px;
		margin-bottom: 10px;
		text-transform: uppercase;
	}

	.dd-list-item {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		padding: 5px 0;
		border-bottom: 1px solid rgba(255,255,255,0.03);
	}
	.dd-list-item:last-child { border-bottom: none; }

	.dd-list-dist {
		font-size: 11px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.dd-list-more {
		font-size: 11px;
		color: var(--cyan);
		margin-top: 8px;
	}

	/* Data grid */
	.dd-data-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}
	@media (max-width: 700px) { .dd-data-grid { grid-template-columns: repeat(2, 1fr); } }

	.dd-data-item {
		background: rgba(255,255,255,0.02);
		border-radius: 10px;
		padding: 12px 14px;
		border: 1px solid var(--border);
	}

	.dd-data-label {
		display: block;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--muted);
		margin-bottom: 4px;
	}

	.dd-data-val {
		display: block;
		font-size: 18px;
		font-weight: 700;
		color: var(--cyan, var(--accent));
	}

	.dd-note {
		margin-top: 12px;
		font-size: 12px;
		color: var(--sub);
		padding: 10px 14px;
		background: rgba(255,255,255,0.02);
		border-radius: 8px;
		border: 1px solid var(--border);
	}

	/* Commentary */
	.dd-commentary {
		font-size: 14px;
		color: var(--text);
		line-height: 1.7;
	}
</style>
