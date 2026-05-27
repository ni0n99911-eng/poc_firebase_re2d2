<script lang="ts">
	/**
	 * Results Coach (Bot 2) — Data-driven commentary panel
	 *
	 * Appears after scores are computed. Explains what the numbers mean
	 * using actual data — real station names, real competitor counts,
	 * real demographics. Every number comes from LocationIntelReport.
	 */
	import { loadLaunchPadData } from '$lib/launchpad-store';
	import { getCoachTier } from '$lib/constants/scoreUtils';

	/**
	 * RENT_AFFORDABILITY_MAP (#28 fix)
	 * Maps neighborhood median household income bracket to estimated monthly commercial rent.
	 * Source: REBNY NYC retail market reports 2023-2024 + CoStar median asking rent data.
	 * Income brackets proxy for neighborhood tier: high-income areas have higher landlord pricing power.
	 * Note: these are fallback estimates. In production, route through PLUTO rent/sqft data
	 * and multiply by concept-specific defaultSqFt from conceptKPIs.ts for precision.
	 *
	 * TODO (future): replace with neighborhood-specific lookup using PLUTO rentPSF × conceptKPI.defaultSqFt.
	 */
	const RENT_AFFORDABILITY_MAP = [
		{ incomeMin: 100_000, monthlyEstimate: 12_000, label: '$10-15K' }, // High-income: SoHo, UWS, Flatiron
		{ incomeMin: 80_000,  monthlyEstimate: 8_000,  label: '$6-10K'  }, // Upper-mid: Park Slope, Astoria, LIC
		{ incomeMin: 60_000,  monthlyEstimate: 5_000,  label: '$4-7K'   }, // Mid: Bushwick, Sunnyside, Bay Ridge
		{ incomeMin: 0,        monthlyEstimate: 3_500,  label: '$2-4K'   }, // Budget: East NY, South Bronx, SI
	] as const;

	let { liveIntel, locationScore, alignmentScore, compassScores, bizType, searchAddr }:
		{ liveIntel: any; locationScore: any; alignmentScore: any; compassScores: Record<string, number>; bizType: string; searchAddr: string } = $props();

	let expanded = $state(false);
	let followUpInput = $state('');
	let followUpAnswer = $state('');

	// ── Build commentary from real data ──
	let commentary = $derived.by(() => {
		if (!liveIntel || !locationScore) return null;

		const score = locationScore.score || 0;
		const grade = getCoachTier(score); // canonical DECISION_STATES via scoreUtils

		const signals: Array<{ icon: string; text: string; sentiment: 'good' | 'warning' | 'neutral' }> = [];

		// Transit / Foot Traffic
		if (liveIntel.mtaRidership) {
			const daily = liveIntel.mtaRidership.totalDailyRidership;
			const stations = liveIntel.mtaRidership.stations || [];
			const stationNames = stations.slice(0, 2).map((s: any) => s.name || s.stationName).filter(Boolean);
			const stationStr = stationNames.length > 0 ? ` at ${stationNames.join(' & ')}` : '';
			if (daily > 10000) {
				signals.push({ icon: '🚇', text: `${Math.round(daily / 1000)}K daily subway riders${stationStr} — strong commuter traffic`, sentiment: 'good' });
			} else if (daily > 3000) {
				signals.push({ icon: '🚇', text: `${Math.round(daily / 1000)}K daily subway riders${stationStr} — moderate transit access`, sentiment: 'neutral' });
			} else {
				signals.push({ icon: '🚇', text: `Only ${daily.toLocaleString()} daily subway riders nearby — limited transit-driven foot traffic`, sentiment: 'warning' });
			}
		}

		// Pedestrian / Walk Score
		if (liveIntel.walkScore) {
			const ws = liveIntel.walkScore.walkScore;
			if (ws >= 90) signals.push({ icon: '🚶', text: `Walk Score ${ws}/100 — walker's paradise, high street-level activity`, sentiment: 'good' });
			else if (ws >= 70) signals.push({ icon: '🚶', text: `Walk Score ${ws}/100 — very walkable, solid pedestrian traffic`, sentiment: 'good' });
			else if (ws >= 50) signals.push({ icon: '🚶', text: `Walk Score ${ws}/100 — somewhat walkable, you'll rely on destination traffic`, sentiment: 'warning' });
			else signals.push({ icon: '🚶', text: `Walk Score ${ws}/100 — car-dependent area, foot traffic will be limited`, sentiment: 'warning' });
		}

		// Demographics
		if (liveIntel.census) {
			const income = liveIntel.census.medianHouseholdIncome;
			const pop = liveIntel.census.totalPopulation;
			if (income > 80000) {
				signals.push({ icon: '👥', text: `Median household income $${Math.round(income / 1000)}K — your target demo can afford premium pricing`, sentiment: 'good' });
			} else if (income > 50000) {
				signals.push({ icon: '👥', text: `Median household income $${Math.round(income / 1000)}K — mid-range spending power`, sentiment: 'neutral' });
			} else {
				signals.push({ icon: '👥', text: `Median household income $${Math.round(income / 1000)}K — price-sensitive area, keep ticket low`, sentiment: 'warning' });
			}
		}

		// Competition — only render when scan has returned actual data
		const hasCompetitorData = (liveIntel.foursquare?.venues?.length ?? 0) > 0 || (liveIntel.overpass?.totalPOIs ?? 0) > 0;
		if (hasCompetitorData) {
			const competitors = liveIntel.foursquare?.venues?.length || liveIntel.overpass?.totalPOIs || 0;
			const compScore = compassScores?.competition || 0;
			if (compScore >= 70) {
				signals.push({ icon: '🏪', text: `${competitors} nearby venues, but competition score is ${compScore}/100 — room for you`, sentiment: 'good' });
			} else if (compScore >= 45) {
				signals.push({ icon: '🏪', text: `${competitors} nearby venues, competition score ${compScore}/100 — crowded but manageable with differentiation`, sentiment: 'neutral' });
			} else {
				signals.push({ icon: '🏪', text: `${competitors} nearby venues, competition score ${compScore}/100 — saturated market, differentiation is critical`, sentiment: 'warning' });
			}
		}

		// Safety / Crime
		if (liveIntel.crime) {
			const crimeScore = liveIntel.crime.crimeScore;
			const incidents = liveIntel.crime.totalIncidents;
			if (crimeScore >= 75) {
				signals.push({ icon: '🛡️', text: `Safety score ${crimeScore}/100 (${incidents} incidents nearby) — safe area for late-night operations`, sentiment: 'good' });
			} else if (crimeScore >= 50) {
				signals.push({ icon: '🛡️', text: `Safety score ${crimeScore}/100 (${incidents} incidents) — average safety, standard precautions`, sentiment: 'neutral' });
			} else {
				signals.push({ icon: '🛡️', text: `Safety score ${crimeScore}/100 (${incidents} incidents) — elevated crime, factor in security costs`, sentiment: 'warning' });
			}
		}

		// Growth / Momentum
		if (liveIntel.dob) {
			const permits = liveIntel.dob.activePermits || 0;
			if (permits > 5) {
				signals.push({ icon: '📈', text: `${permits} active DOB permits nearby — area is actively developing`, sentiment: 'good' });
			} else if (permits > 0) {
				signals.push({ icon: '📈', text: `${permits} active DOB permits — some development activity`, sentiment: 'neutral' });
			}
		}

		// Financial gap (if we have rent data)
		const lp = loadLaunchPadData();
		const statedRent = lp?.financialGoals?.monthlyRentBudget || 0;
		if (statedRent > 0 && liveIntel.census?.medianHouseholdIncome) {
			// Rough area rent estimate based on neighborhood tier
			const income = liveIntel.census.medianHouseholdIncome;
			const tier = RENT_AFFORDABILITY_MAP.find(t => income >= t.incomeMin) ?? RENT_AFFORDABILITY_MAP[RENT_AFFORDABILITY_MAP.length - 1];
			const estimatedRent = tier.monthlyEstimate;
			if (estimatedRent > statedRent * 1.3) {
				signals.push({ icon: '💰', text: `Area rents likely ~$${(estimatedRent / 1000).toFixed(0)}K/mo — ${Math.round((estimatedRent / statedRent - 1) * 100)}% above your budget of $${(statedRent / 1000).toFixed(0)}K`, sentiment: 'warning' });
			}
		}

		// Build verdict
		let verdict = '';
		if (grade === 'strong_go' || grade === 'go_with_refinements') {
			verdict = `This location scores well for ${bizType || 'your concept'}. Here's what's working:`;
		} else if (grade === 'worth_testing') {
			verdict = `Mixed signals for ${bizType || 'your concept'}. Some things work, some need attention:`;
		} else {
			verdict = `Some challenges here for ${bizType || 'your concept'}. Worth understanding the risks:`;
		}

		// Biggest risk + opportunity
		const goodSignals = signals.filter(s => s.sentiment === 'good');
		const warnSignals = signals.filter(s => s.sentiment === 'warning');
		let bottomLine = '';
		if (goodSignals.length > 0 && warnSignals.length > 0) {
			bottomLine = `Biggest opportunity: ${goodSignals[0].text.split('—')[1]?.trim() || 'strong fundamentals'}. Biggest risk: ${warnSignals[0].text.split('—')[1]?.trim() || 'market pressure'}.`;
		} else if (goodSignals.length > 0) {
			bottomLine = `Strong across the board. The data supports this location.`;
		} else if (warnSignals.length > 0) {
			bottomLine = `Multiple warning signals. Consider comparing with 2-3 alternative locations.`;
		}

		return { verdict, signals, bottomLine, grade };
	});

	// ── Follow-up Q&A (simple keyword matching, no LLM) ──
	function handleFollowUp() {
		const q = followUpInput.trim().toLowerCase();
		if (!q) return;
		followUpInput = '';

		if (!liveIntel) {
			followUpAnswer = "I don't have enough data to answer that. Try scoring a location first.";
			return;
		}

		if (q.includes('competition') || q.includes('competitor')) {
			const venues = liveIntel.foursquare?.venues || [];
			if (venues.length > 0) {
				const top3 = venues.slice(0, 3).map((v: any) => `${v.name} (${v.distance}m away)`).join(', ');
				followUpAnswer = `Nearest competitors: ${top3}. Competition score: ${compassScores?.competition || 'N/A'}/100.`;
			} else {
				followUpAnswer = `No direct competitors found in the Foursquare data within 300m.`;
			}
		} else if (q.includes('transit') || q.includes('subway') || q.includes('train')) {
			const stations = liveIntel.mtaRidership?.stations || [];
			if (stations.length > 0) {
				const stationList = stations.slice(0, 3).map((s: any) => `${s.name || s.stationName}: ${(s.dailyRidership || 0).toLocaleString()} daily`).join('; ');
				followUpAnswer = `Nearby stations: ${stationList}. Transit score: ${compassScores?.transit || 'N/A'}/100.`;
			} else {
				followUpAnswer = `No MTA station data available for this location.`;
			}
		} else if (q.includes('crime') || q.includes('safe') || q.includes('safety')) {
			if (liveIntel.crime) {
				followUpAnswer = `Safety score: ${liveIntel.crime.crimeScore}/100. ${liveIntel.crime.totalIncidents} incidents in the area. Most common: ${liveIntel.crime.topTypes?.slice(0, 2).join(', ') || 'various'}.`;
			} else {
				followUpAnswer = `No crime data available for this specific location.`;
			}
		} else if (q.includes('rent') || q.includes('cost') || q.includes('price')) {
			const income = liveIntel.census?.medianHouseholdIncome || 0;
			const rentTier = RENT_AFFORDABILITY_MAP.find(t => income >= t.incomeMin) ?? RENT_AFFORDABILITY_MAP[RENT_AFFORDABILITY_MAP.length - 1];
			followUpAnswer = `Based on area demographics (median income $${Math.round(income/1000)}K), commercial rents here likely run ${rentTier.label}/month for ground-floor retail.`;
		} else if (q.includes('demograph') || q.includes('income') || q.includes('age')) {
			if (liveIntel.census) {
				const c = liveIntel.census;
				followUpAnswer = `Population: ${(c.totalPopulation || 0).toLocaleString()}. Median income: $${Math.round((c.medianHouseholdIncome || 0)/1000)}K. Median age: ${c.medianAge || 'N/A'}.`;
			} else {
				followUpAnswer = `No census data available for this location.`;
			}
		} else {
			followUpAnswer = `I can answer questions about: competition, transit, safety, rent estimates, and demographics for this location. Try asking about one of those.`;
		}
	}
</script>

{#if commentary}
	<div class="coach-panel">
		<div class="coach-header">
			<div class="coach-avatar">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
			</div>
			<div class="coach-title">
				<span class="coach-name">Results Coach</span>
				<span class="coach-label">Based on real data for {searchAddr}</span>
			</div>
		</div>

		<p class="coach-verdict">{commentary.verdict}</p>

		<div class="signals-list">
			{#each commentary.signals.slice(0, expanded ? 99 : 4) as signal}
				<div class="signal-row {signal.sentiment}">
					<span class="signal-icon">{signal.icon}</span>
					<span class="signal-text">{signal.text}</span>
				</div>
			{/each}
		</div>

		{#if commentary.signals.length > 4 && !expanded}
			<button class="show-more" onclick={() => expanded = true}>
				Show {commentary.signals.length - 4} more signals
			</button>
		{/if}

		{#if commentary.bottomLine}
			<div class="bottom-line">
				{commentary.bottomLine}
			</div>
		{/if}

		<!-- Follow-up questions -->
		<div class="followup-section">
			<form class="followup-form" onsubmit={(e) => { e.preventDefault(); handleFollowUp(); }}>
				<input
					type="text"
					class="followup-input"
					bind:value={followUpInput}
					placeholder="Ask about competition, transit, safety, rent..."
				/>
				<button type="submit" class="followup-btn" disabled={!followUpInput.trim()}>Ask</button>
			</form>
			{#if followUpAnswer}
				<div class="followup-answer">
					{followUpAnswer}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.coach-panel {
		background: #FEFEFE;
		border: 1px solid #E2E8F0;
		border-radius: 12px;
		padding: 20px;
		margin-top: 20px;
	}

	.coach-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 14px;
	}

	.coach-avatar {
		width: 32px; height: 32px; border-radius: 50%;
		background: #0D7C6E; color: white;
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}

	.coach-title { display: flex; flex-direction: column; }
	.coach-name { font-size: 14px; font-weight: 600; color: #1A2233; }
	.coach-label { font-size: 11px; color: #8A95A8; }

	.coach-verdict {
		font-size: 14px; color: #1A2233; line-height: 1.5;
		margin: 0 0 14px;
	}

	.signals-list {
		display: flex; flex-direction: column; gap: 10px;
	}

	.signal-row {
		display: flex; gap: 10px; align-items: flex-start;
		padding: 10px 12px; border-radius: 8px;
		font-size: 13px; line-height: 1.5; color: #1A2233;
	}
	.signal-row.good { background: rgba(16, 185, 129, 0.06); border-left: 3px solid #10B981; }
	.signal-row.warning { background: rgba(245, 158, 11, 0.06); border-left: 3px solid #F59E0B; }
	.signal-row.neutral { background: rgba(100, 116, 139, 0.06); border-left: 3px solid #94A3B8; }

	.signal-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
	.signal-text { flex: 1; }

	.show-more {
		margin-top: 8px; padding: 6px 12px;
		background: none; border: 1px dashed #D1D9E6;
		border-radius: 8px; color: #5A6578; font-size: 12px;
		cursor: pointer; font-family: inherit; width: 100%;
	}
	.show-more:hover { border-color: #0D7C6E; color: #0D7C6E; }

	.bottom-line {
		margin-top: 14px; padding: 12px 14px;
		background: #F8FAFC; border-radius: 8px;
		font-size: 13px; line-height: 1.5; color: #334155;
		font-weight: 500;
	}

	.followup-section { margin-top: 16px; padding-top: 14px; border-top: 1px solid #E5E9F0; }

	.followup-form {
		display: flex; gap: 8px;
	}
	.followup-input {
		flex: 1; padding: 8px 12px; border: 1px solid #D1D9E6;
		border-radius: 8px; font-size: 13px; font-family: inherit;
		outline: none; color: #1A2233;
	}
	.followup-input:focus { border-color: #0D7C6E; }
	.followup-input::placeholder { color: #8A95A8; }
	.followup-btn {
		padding: 8px 16px; background: #0D7C6E; color: white;
		border: none; border-radius: 8px; font-size: 13px;
		font-weight: 500; cursor: pointer; font-family: inherit;
	}
	.followup-btn:disabled { opacity: 0.4; cursor: default; }
	.followup-btn:not(:disabled):hover { opacity: 0.85; }

	.followup-answer {
		margin-top: 10px; padding: 10px 12px;
		background: rgba(13, 124, 110, 0.04); border: 1px solid rgba(13, 124, 110, 0.15);
		border-radius: 8px; font-size: 13px; line-height: 1.5; color: #1A2233;
	}
</style>
