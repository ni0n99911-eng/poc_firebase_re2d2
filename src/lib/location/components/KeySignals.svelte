<script lang="ts">
	import type { VLFResult, GLFResult, RRResult, BlockScoreResult } from '../scoring/engines';
	import type { LiveIntelReport, ScanData } from '../api/geo';

	let { score, vlfData, glfData, rrData, liveIntel, data }: {
		score: BlockScoreResult;
		vlfData: VLFResult | null;
		glfData: GLFResult | null;
		rrData: RRResult | null;
		liveIntel: LiveIntelReport | null;
		data: ScanData;
	} = $props();

	interface Signal {
		type: 'strength' | 'risk';
		icon: string;
		text: string;
		detail: string;
	}

	// Total competitor count across all categories
	let totalCompetitors = $derived(data.cafes.length + data.gyms.length + data.yoga.length + data.health.length);

	let signals = $derived.by(() => {
		const items: Signal[] = [];

		// ── STRENGTHS ──

		// Transit
		if (data.stations.length >= 3) {
			items.push({ type: 'strength', icon: '🚇', text: `${data.stations.length} transit stations nearby`, detail: 'Great access for customers and employees commuting to this area.' });
		} else if (data.stations.length >= 1) {
			items.push({ type: 'strength', icon: '🚇', text: `${data.stations.length} transit station${data.stations.length > 1 ? 's' : ''} nearby`, detail: 'Decent transit access, though more options would help.' });
		}

		// Walk score
		if (liveIntel?.walkScore && liveIntel.walkScore.walkScore >= 85) {
			items.push({ type: 'strength', icon: '🚶', text: `Walk Score of ${liveIntel.walkScore.walkScore} — very walkable`, detail: 'High walkability means more foot traffic passing your door.' });
		}

		// Demographics — #67: thresholds extracted to named constants (TODO: make concept-specific via conceptKPIs.incomeMin)
		const INCOME_HIGH = 80000;  // strong spending power
		const INCOME_LOW  = 50000;  // below = limited spending power risk signal
		if (liveIntel?.census) {
			const income = liveIntel.census.medianHouseholdIncome;
			if (income >= INCOME_HIGH) {
				items.push({ type: 'strength', icon: '💰', text: `Median income $${Math.round(income / 1000)}k — strong spending power`, detail: `Higher household income means customers who can afford your product.` });
			}
			if (liveIntel.census.bachelorsPlusPercent >= 40) {
				items.push({ type: 'strength', icon: '🎓', text: `${liveIntel.census.bachelorsPlusPercent}% college-educated population`, detail: 'An educated population often correlates with demand for specialty products and services.' });
			}
		}

		// Low competition — count all competitor types (cafes, gyms, yoga, health)
		if (totalCompetitors <= 2) {
			items.push({ type: 'strength', icon: '🏆', text: totalCompetitors === 0 ? 'No direct competitors found nearby' : `Only ${totalCompetitors} competitor${totalCompetitors > 1 ? 's' : ''} nearby`, detail: 'Low competition means more room for your concept to stand out.' });
		}

		// Safety
		if (liveIntel?.crime && liveIntel.crime.crimeScore >= 75) {
			items.push({ type: 'strength', icon: '🛡️', text: `Safety score ${liveIntel.crime.crimeScore}/100 — safe area`, detail: 'Low crime rates make customers and employees feel comfortable.' });
		}

		// Vision fit
		if (vlfData && vlfData.vlf >= 70) {
			items.push({ type: 'strength', icon: '🎯', text: 'Strong match between your concept and this neighborhood', detail: 'The demographics and local market align well with what you\'re building.' });
		}

		// ── RISKS ──

		// High competition — count all types
		if (totalCompetitors >= 6) {
			items.push({ type: 'risk', icon: '⚠️', text: `${totalCompetitors} competitors within walking distance`, detail: 'Very crowded block. You\'ll need a clear differentiator to stand out in this area.' });
		} else if (totalCompetitors >= 4) {
			items.push({ type: 'risk', icon: '👀', text: `${totalCompetitors} competitors nearby — moderate density`, detail: 'Not overcrowded, but you should know what makes your concept different.' });
		}

		// Low transit
		if (data.stations.length === 0) {
			items.push({ type: 'risk', icon: '🚫', text: 'No transit stations found nearby', detail: 'Customers will need to drive or walk. This limits your foot traffic catchment.' });
		}

		// Safety concerns
		if (liveIntel?.crime && liveIntel.crime.crimeScore < 50) {
			items.push({ type: 'risk', icon: '🔒', text: `Safety score ${liveIntel.crime.crimeScore}/100 — elevated crime area`, detail: 'Higher crime rates can deter foot traffic and increase operating costs (insurance, security).' });
		}

		// Low income
		if (liveIntel?.census && liveIntel.census.medianHouseholdIncome < INCOME_LOW) {
			items.push({ type: 'risk', icon: '📉', text: `Median income $${Math.round(liveIntel.census.medianHouseholdIncome / 1000)}k — limited spending power`, detail: 'Lower income areas may not support premium pricing for your concept.' });
		}

		// Market risk (competition saturation)
		if (rrData && (rrData.marketRisk ?? rrData.substitutionRisk) < 35) {
			items.push({ type: 'risk', icon: '🔄', text: 'High market risk — saturated competition with covered price points', detail: 'Too many competitors covering all price ranges. Strong differentiation is critical.' });
		}
		// Execution risk (rent burden)
		if (rrData && (rrData.executionRisk ?? rrData.riskScore) < 40) {
			items.push({ type: 'risk', icon: '💰', text: `High execution risk — rent (~$${(rrData.rentEstimate ?? 15000).toLocaleString()}/mo) squeezes margins`, detail: 'Rent burden is high relative to your revenue targets. Negotiate hard on lease terms.' });
		}

		// Rent burden
		if (glfData && glfData.rule2B < 50) {
			items.push({ type: 'risk', icon: '🏠', text: 'Rent may be high relative to your revenue potential', detail: 'The estimated rent burden is challenging. Negotiate lease terms carefully or consider nearby alternatives.' });
		}

		// Sort: strengths first, then risks
		return items.sort((a, b) => a.type === b.type ? 0 : a.type === 'strength' ? -1 : 1);
	});

	let strengths = $derived(signals.filter(s => s.type === 'strength'));
	let risks = $derived(signals.filter(s => s.type === 'risk'));
	let expandedSignal = $state<number | null>(null);

	function toggleSignal(idx: number) {
		expandedSignal = expandedSignal === idx ? null : idx;
	}
</script>

<div class="key-signals">
	{#if strengths.length > 0}
		<div class="signal-section">
			<div class="section-header strength">
				<span class="section-icon">✓</span>
				<span class="section-title">What's Working</span>
				<span class="section-count">{strengths.length}</span>
			</div>
			<div class="signal-list">
				{#each strengths as signal, i}
					<button class="signal-item" class:expanded={expandedSignal === i} onclick={() => toggleSignal(i)}>
						<span class="signal-icon">{signal.icon}</span>
						<span class="signal-text">{signal.text}</span>
						<span class="expand-arrow">{expandedSignal === i ? '▾' : '▸'}</span>
						{#if expandedSignal === i}
							<div class="signal-detail">{signal.detail}</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if risks.length > 0}
		<div class="signal-section">
			<div class="section-header risk">
				<span class="section-icon">!</span>
				<span class="section-title">What to Watch</span>
				<span class="section-count">{risks.length}</span>
			</div>
			<div class="signal-list">
				{#each risks as signal, i}
					{@const idx = strengths.length + i}
					<button class="signal-item risk" class:expanded={expandedSignal === idx} onclick={() => toggleSignal(idx)}>
						<span class="signal-icon">{signal.icon}</span>
						<span class="signal-text">{signal.text}</span>
						<span class="expand-arrow">{expandedSignal === idx ? '▾' : '▸'}</span>
						{#if expandedSignal === idx}
							<div class="signal-detail">{signal.detail}</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.key-signals {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-bottom: 20px;
	}

	.signal-section {
		background: var(--surface, #ffffff);
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 20px;
		border-bottom: 1px solid var(--border);
	}
	.section-header.strength {
		background: rgba(52, 211, 153, 0.04);
	}
	.section-header.risk {
		background: rgba(251, 191, 36, 0.04);
	}

	.section-icon {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 700;
		flex-shrink: 0;
	}
	.strength .section-icon {
		background: rgba(52, 211, 153, 0.15);
		color: var(--green, var(--success));
	}
	.risk .section-icon {
		background: rgba(251, 191, 36, 0.15);
		color: var(--yellow, var(--warning));
	}

	.section-title {
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		flex: 1;
	}
	.strength .section-title { color: var(--green, var(--success)); }
	.risk .section-title { color: var(--yellow, var(--warning)); }

	.section-count {
		font-size: 11px;
		padding: 2px 8px;
		border-radius: 10px;
		font-weight: 600;
	}
	.strength .section-count {
		background: rgba(52, 211, 153, 0.1);
		color: var(--green, var(--success));
	}
	.risk .section-count {
		background: rgba(251, 191, 36, 0.1);
		color: var(--yellow, var(--warning));
	}

	.signal-list {
		display: flex;
		flex-direction: column;
	}

	.signal-item {
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 10px;
		padding: 14px 20px;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border);
		cursor: pointer;
		transition: background 0.15s ease;
		text-align: left;
		font-family: inherit;
		color: var(--text, #d4d6e3);
		width: 100%;
	}
	.signal-item:last-child { border-bottom: none; }

	.signal-item:hover {
		background: rgba(0, 0, 0, 0.04);
	}
	.signal-item.expanded {
		background: rgba(0, 113, 227, 0.04);
	}

	.signal-icon {
		font-size: 16px;
		flex-shrink: 0;
		line-height: 1.4;
	}

	.signal-text {
		flex: 1;
		font-size: 14px;
		font-weight: 500;
		line-height: 1.4;
	}

	.expand-arrow {
		font-size: 12px;
		color: var(--muted, #6b6f7f);
		flex-shrink: 0;
		line-height: 1.4;
		transition: transform 0.2s ease;
	}

	.signal-detail {
		width: 100%;
		font-size: 13px;
		color: var(--sub, #8a8d9d);
		line-height: 1.6;
		padding-top: 8px;
		padding-left: 26px;
		border-top: 1px solid var(--border);
		margin-top: 6px;
	}
</style>
