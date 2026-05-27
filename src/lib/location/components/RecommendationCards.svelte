<script lang="ts">
	import type { VLFResult, GLFResult, RRResult, PoSResult, BlockScoreResult } from '../scoring/engines';
	import type { LiveIntelReport, ScanData } from '../api/geo';
	import { tierFor } from '$lib/intel/tiers';

	let { vlfData, glfData, rrData, posData, liveIntel, data, score }: {
		vlfData: VLFResult | null;
		glfData: GLFResult | null;
		rrData: RRResult | null;
		posData: PoSResult | null;
		liveIntel: LiveIntelReport | null;
		data: ScanData;
		score: BlockScoreResult;
	} = $props();

	let expandedCard = $state<string | null>(null);

	function toggle(id: string) {
		expandedCard = expandedCard === id ? null : id;
	}

	// ── Derive plain-English answers from scoring data ──

	interface QACard {
		id: string;
		question: string;
		answer: string;
		badge: string;
		badgeColor: 'green' | 'yellow' | 'red';
		detail: string;
		tip: string;
	}

	let cards = $derived.by(() => {
		const items: QACard[] = [];

		// 1. Is this the right location for my business?
		if (vlfData) {
			const fit = vlfData.vlf;
			items.push({
				id: 'fit',
				question: 'Is this the right location for my business?',
				answer: fit >= 70
					? `Yes — this neighborhood is a strong match for your concept (${fit}/100). The demographics, local market, and customer base align well with what you're building.`
					: fit >= 50
						? `It could work (${fit}/100). The neighborhood has some good qualities for your concept, but there are gaps you should understand before committing.`
						: `Probably not (${fit}/100). This neighborhood doesn't match your target customer or concept well. Consider exploring nearby alternatives.`,
				badge: tierFor(fit, 'fitIQ').label,
				badgeColor: fit >= 70 ? 'green' : fit >= 50 ? 'yellow' : 'red',
				detail: `Demographic Match: ${vlfData.rule1A}/100 · Neighborhood Fit: ${Math.round(vlfData.rule1B)}/100 · Market Gap: ${Math.round(vlfData.rule1C)}/100 · Trend: ${vlfData.rule1D}/100`,
				tip: fit < 70
					? 'Look at what your strongest competitors are doing in this area. If the demographics don\'t match, consider neighborhoods where your target customer already lives and shops.'
					: 'Your concept fits this area well. Focus on differentiating from nearby competitors.'
			});
		}

		// 2. Can I make money here?
		if (glfData) {
			const fin = glfData.glf;
			const rentOk = glfData.rule2B >= 60;
			items.push({
				id: 'money',
				question: 'Can I make money here?',
				answer: fin >= 70
					? `The numbers look good (${fin}/100). Revenue potential is solid and rent appears manageable relative to what you can earn here.`
					: fin >= 50
						? `It's tight (${fin}/100). ${!rentOk ? 'Rent may eat too much of your revenue.' : 'Revenue potential exists but margins will be thin.'} You'll need to negotiate well and control costs.`
						: `It will be hard (${fin}/100). ${!rentOk ? 'Rent is very high relative to realistic revenue.' : 'Revenue potential is limited.'} Unless you can get favorable lease terms, this is a tough spot financially.`,
				badge: fin >= 70 ? 'Likely Yes' : fin >= 50 ? 'Maybe' : 'Unlikely',
				badgeColor: fin >= 70 ? 'green' : fin >= 50 ? 'yellow' : 'red',
				detail: `Revenue Potential: ${Math.round(glfData.rule2A)}/100 · Rent Affordability: ${Math.round(glfData.rule2B)}/100 · Break-even: ${Math.round(glfData.rule2C)}/100 · Growth: ${Math.round(glfData.rule2D)}/100 · Talent: ${Math.round(glfData.rule2E)}/100`,
				tip: !rentOk
					? 'Negotiate hard on rent. Ask for 3-6 months free rent, a percentage-based rent clause, or TI (tenant improvement) allowance to reduce upfront costs.'
					: 'Revenue potential is there. Focus on capturing foot traffic early — grand opening events, social media presence, and neighborhood partnerships.'
			});
		}

		// 3. Is there too much competition? — count ALL competitor types
		const compCount = data.cafes.length + data.gyms.length + data.yoga.length + data.health.length;
		const compScore = score.comp;
		items.push({
			id: 'competition',
			question: 'Is there too much competition?',
			answer: compCount === 0
				? `No competitors found nearby. That could mean untapped demand — or it could mean this area doesn't support your concept. Research why.`
				: compCount <= 3
					? `${compCount} competitor${compCount > 1 ? 's' : ''} nearby — a healthy amount. There's proven demand without overcrowding.`
					: compCount <= 6
						? `${compCount} competitors nearby — getting crowded. You'll need a clear reason for customers to choose you over the others.`
						: `${compCount} competitors nearby — that's a lot. This area is very crowded. You need a very strong differentiator or a different location.`,
			badge: compCount <= 3 ? 'Low' : compCount <= 6 ? 'Moderate' : 'High',
			badgeColor: compCount <= 3 ? 'green' : compCount <= 6 ? 'yellow' : 'red',
			detail: `${compCount} direct competitors · ${data.gyms.length} gyms · ${data.yoga.length} yoga/pilates · ${data.stations.length} transit stations nearby`,
			tip: compCount >= 4
				? 'Visit each competitor. Note what they do well and what they miss. Your concept needs to fill a gap they don\'t cover — pricing, hours, product, or experience.'
				: 'Low competition is a great start. Make sure it\'s because there\'s an opportunity, not because others have tried and failed here.'
		});

		// 4. Is it safe for my customers and staff?
		if (liveIntel?.crime) {
			const safety = liveIntel.crime.crimeScore;
			items.push({
				id: 'safety',
				question: 'Is it safe for my customers and staff?',
				answer: safety >= 75
					? `Yes — safety score ${safety}/100. This is a low-crime area. Customers and employees will feel comfortable here.`
					: safety >= 50
						? `Mostly (${safety}/100). Crime rates are moderate. It's fine during the day, but check evening safety if you plan late hours.`
						: `There are concerns (${safety}/100). Higher crime rates in this area could deter customers and increase your insurance and security costs.`,
				badge: safety >= 75 ? 'Safe' : safety >= 50 ? 'Moderate' : 'Elevated Risk',
				badgeColor: safety >= 75 ? 'green' : safety >= 50 ? 'yellow' : 'red',
				detail: `Safety Score: ${safety}/100` + (liveIntel.walkScore ? ` · Walk Score: ${liveIntel.walkScore.walkScore} · Transit Score: ${liveIntel.walkScore.transitScore}` : ''),
				tip: safety < 75
					? 'Check crime maps for your specific block. Talk to neighboring business owners about their experience. Consider security cameras and good lighting.'
					: 'Safety is a strength here. Mention this in your marketing — customers value feeling safe.'
			});
		}

		// 5. What are the biggest risks?
		if (rrData) {
			const risk = rrData.rr;
			const mktRisk = rrData.marketRisk ?? rrData.substitutionRisk;
			const execRisk = rrData.executionRisk ?? rrData.riskScore;
			const topRisk = mktRisk < 40
				? 'a crowded market (too many competitors covering all price points)'
				: execRisk < 40
					? 'execution risk (high rent burden eats into your margins)'
					: 'general market conditions';
			items.push({
				id: 'risks',
				question: 'What are the biggest risks?',
				answer: risk >= 75
					? `Risk assessment is strong (${risk}/100). No major red flags. Standard business risks apply, but nothing location-specific stands out.`
					: risk >= 50
						? `Moderate risk (${risk}/100). The biggest concern is ${topRisk}. Manageable if you plan for it.`
						: `High risk (${risk}/100). The main risk is ${topRisk}. Address this before signing a lease.`,
				badge: risk >= 75 ? 'Low Risk' : risk >= 50 ? 'Some Risk' : 'High Risk',
				badgeColor: risk >= 75 ? 'green' : risk >= 50 ? 'yellow' : 'red',
				detail: `Market Risk: ${Math.round(mktRisk)}/100 · Execution Risk: ${Math.round(execRisk)}/100 · Est. Rent: $${(rrData.rentEstimate ?? 15000).toLocaleString()}/mo`,
				tip: risk < 75
					? 'Negotiate lease flexibility — shorter initial term with renewal options, assignment clause, and caps on rent escalation. These protect you if things don\'t work out.'
					: 'Your risk profile is manageable. Focus on building a strong first-year plan.'
			});
		}

		// 6. What should I do first?
		{
			const weakest = [
				{ name: 'financial feasibility', score: glfData?.glf || 50, action: 'Run a detailed financial model before committing. Use our Financial Model tool to stress-test your numbers.' },
				{ name: 'neighborhood fit', score: vlfData?.vlf || 50, action: 'Walk the neighborhood at different times. Talk to local business owners. Make sure the vibe matches your concept.' },
				{ name: 'competitive positioning', score: compScore, action: 'Visit every competitor within walking distance. Document what they charge, how busy they are, and what\'s missing.' },
				{ name: 'risk management', score: rrData?.rr || 50, action: 'Get a real estate attorney to review any lease before signing. Ask about building violations, rent escalation, and exit clauses.' },
			].sort((a, b) => a.score - b.score);

			items.push({
				id: 'nextsteps',
				question: 'What should I do first?',
				answer: `Your weakest area is ${weakest[0].name} (${weakest[0].score}/100). Start there. ${weakest[0].action}`,
				badge: 'Action Plan',
				badgeColor: 'green',
				detail: `Priority 1: ${weakest[0].name} (${weakest[0].score}/100)\nPriority 2: ${weakest[1].name} (${weakest[1].score}/100)\nPriority 3: ${weakest[2].name} (${weakest[2].score}/100)`,
				tip: 'Don\'t sign anything until you\'ve addressed at least the top 2 priorities. Use RE² tools (Financial Model, Loan Einstein) to build your case.'
			});
		}

		return items;
	});
</script>

<div class="rec-cards">
	<div class="rec-header">
		<span class="rec-title">Your Recommendations</span>
		<span class="rec-subtitle">Plain answers to the questions that matter</span>
	</div>

	{#each cards as card}
		<button class="qa-card" class:expanded={expandedCard === card.id} onclick={() => toggle(card.id)}>
			<div class="qa-top">
				<div class="qa-question">{card.question}</div>
				<div class="qa-badge {card.badgeColor}">{card.badge}</div>
			</div>
			<div class="qa-answer">{card.answer}</div>

			{#if expandedCard === card.id}
				<div class="qa-expanded">
					<div class="qa-detail-section">
						<div class="qa-detail-label">Details</div>
						<div class="qa-detail-text">{card.detail}</div>
					</div>
					<div class="qa-tip-section">
						<div class="qa-tip-icon">💡</div>
						<div class="qa-tip-text">{card.tip}</div>
					</div>
				</div>
			{/if}

			<div class="qa-expand-hint">
				{expandedCard === card.id ? 'Show less' : 'See details & tips'}
			</div>
		</button>
	{/each}
</div>

<style>
	.rec-cards {
		background: var(--surface, #ffffff);
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
		margin-bottom: 20px;
	}

	.rec-header {
		padding: 18px 24px;
		border-bottom: 1px solid var(--border);
		background: rgba(0, 113, 227, 0.02);
	}

	.rec-title {
		display: block;
		font-size: 16px;
		font-weight: 700;
		color: var(--text-bright, var(--text));
		margin-bottom: 4px;
	}

	.rec-subtitle {
		font-size: 13px;
		color: var(--muted, #6b6f7f);
	}

	.qa-card {
		display: block;
		width: 100%;
		padding: 24px;
		border: none;
		border-bottom: 1px solid var(--border);
		background: transparent;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		color: var(--text, #d4d6e3);
		transition: background 0.15s ease;
	}
	.qa-card:last-child { border-bottom: none; }
	.qa-card:hover { background: rgba(0, 0, 0, 0.04); }
	.qa-card.expanded { background: rgba(0, 113, 227, 0.04); }

	.qa-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 12px;
	}

	.qa-question {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-bright, var(--text));
		line-height: 1.3;
		flex: 1;
	}

	.qa-badge {
		font-size: 12px;
		font-weight: 700;
		padding: 4px 12px;
		border-radius: 20px;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.qa-badge.green {
		background: rgba(52, 211, 153, 0.12);
		color: var(--green, var(--success));
		border: 1px solid rgba(52, 211, 153, 0.2);
	}
	.qa-badge.yellow {
		background: rgba(251, 191, 36, 0.12);
		color: var(--yellow, var(--warning));
		border: 1px solid rgba(251, 191, 36, 0.2);
	}
	.qa-badge.red {
		background: rgba(239, 68, 68, 0.12);
		color: var(--redtag, var(--danger));
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.qa-answer {
		font-size: 15px;
		line-height: 1.6;
		color: var(--text, #d4d6e3);
	}

	.qa-expanded {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.qa-detail-section {
		padding: 14px 16px;
		background: rgba(0, 0, 0, 0.03);
		border: 1px solid var(--border);
		border-radius: 10px;
	}

	.qa-detail-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: var(--muted, #6b6f7f);
		margin-bottom: 8px;
		font-weight: 700;
	}

	.qa-detail-text {
		font-size: 13px;
		color: var(--text, #d4d6e3);
		line-height: 1.5;
		white-space: pre-line;
	}

	.qa-tip-section {
		display: flex;
		gap: 12px;
		padding: 14px 16px;
		background: rgba(0, 113, 227, 0.06);
		border: 1px solid rgba(0, 113, 227, 0.15);
		border-radius: 10px;
	}

	.qa-tip-icon {
		font-size: 18px;
		flex-shrink: 0;
	}

	.qa-tip-text {
		font-size: 14px;
		color: var(--text, #d4d6e3);
		line-height: 1.6;
	}

	.qa-expand-hint {
		margin-top: 12px;
		font-size: 12px;
		color: var(--cyan, var(--accent));
		font-weight: 600;
	}

	@media (max-width: 700px) {
		.qa-card { padding: 18px; }
		.qa-question { font-size: 16px; }
		.qa-answer { font-size: 14px; }
	}
</style>
