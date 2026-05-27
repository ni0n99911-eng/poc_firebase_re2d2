<script lang="ts">
	import type { LiveIntelReport } from '../api/geo';
	import type { VLFResult, GLFResult, RRResult, PoSResult } from '../scoring/engines';
	// 04.25.2026 16:36 CoPilot Sanitization — sanitizeHtml prevents XSS via
	// user-controlled conceptDescription interpolated into {@html renderBold(...)}
	import { sanitizeHtml } from '$lib/utils/copilot-sanitize';

	let {
		compositeScore = 0,
		fitScore = 0,
		compassScores = {} as Record<string, number>,
		bizType = 'your business',
		conceptDescription = '',
		address = '',
		liveIntel = null as LiveIntelReport | null,
		headsUpWarnings = [] as Array<{ title: string; detail: string }>,
		vlfData = null as VLFResult | null,
		glfData = null as GLFResult | null,
		rrData = null as RRResult | null,
		posData = null as PoSResult | null,
	}: {
		compositeScore?: number;
		fitScore?: number;
		compassScores?: Record<string, number>;
		bizType?: string;
		conceptDescription?: string;
		address?: string;
		liveIntel?: LiveIntelReport | null;
		headsUpWarnings?: Array<{ title: string; detail: string }>;
		vlfData?: VLFResult | null;
		glfData?: GLFResult | null;
		rrData?: RRResult | null;
		posData?: PoSResult | null;
	} = $props();

	let expanded = $state(true);
	let activeQuestion = $state<string | null>(null);

	// Build the initial coaching narrative from live data
	let coachIntro = $derived.by(() => {
		const concept = conceptDescription || bizType || 'your business';
		const loc = address ? `at **${address}**` : 'at this location';

		if (compositeScore >= 80) {
			return `Great news — this location scores **${compositeScore}/100** for ${concept} ${loc}. The fundamentals are strong. Let me walk you through what stands out and what to watch.`;
		} else if (compositeScore >= 60) {
			return `This location scores **${compositeScore}/100** for ${concept} ${loc} — a solid foundation with some areas to negotiate or plan around. Here's what I'd focus on.`;
		} else if (compositeScore >= 40) {
			return `This location scores **${compositeScore}/100** for ${concept} ${loc}. There are real challenges here, but also some upside. Let me break down what matters most.`;
		} else {
			return `This location scores **${compositeScore}/100** for ${concept} ${loc}. That's below the threshold I'd recommend for most concepts. Let me explain what's driving the low score.`;
		}
	});

	// Fit IQ comparison
	let fitComparison = $derived.by(() => {
		const diff = fitScore - compositeScore;
		if (Math.abs(diff) < 5) return 'Your concept fit aligns closely with the raw location score — no major mismatch.';
		if (diff > 10) return `Your concept actually scores **${fitScore}/100** when weighted for your business type — that's ${diff} points higher than the raw location score. This location has strengths that align particularly well with your concept.`;
		if (diff < -10) return `Your concept scores **${fitScore}/100** when weighted for your business type — ${Math.abs(diff)} points lower than the raw score. Some of this location's strengths don't map to what your business needs most.`;
		if (diff > 0) return `Concept fit is slightly higher at **${fitScore}/100** — this location has some alignment advantages for your business type.`;
		return `Concept fit comes in at **${fitScore}/100** — slightly below the raw location score. Minor gaps, but worth understanding.`;
	});

	// Generate dynamic Q&A based on actual scores
	interface CoachQuestion {
		id: string;
		question: string;
		answer: string;
		icon: string;
	}

	let questions = $derived.by(() => {
		const qs: CoachQuestion[] = [];

		// Strongest index
		const sorted = Object.entries(compassScores).sort((a, b) => b[1] - a[1]);
		if (sorted.length > 0) {
			const [topKey, topVal] = sorted[0];
			const [bottomKey, bottomVal] = sorted[sorted.length - 1];
			const labelMap: Record<string, string> = {
				transit: 'Transit & Accessibility', competition: 'Competition Landscape',
				demographics: 'Demographics & Spending', vibrancy: 'Neighborhood Vibrancy',
				safety: 'Safety & Stability', momentum: 'Growth Momentum'
			};

			qs.push({
				id: 'strongest',
				question: "What's the strongest signal here?",
				answer: `**${labelMap[topKey] || topKey}** leads at ${topVal}/100. ${
					topKey === 'transit' ? 'Strong transit access means reliable daily foot traffic — people can get here easily.' :
					topKey === 'competition' ? 'Low competition density means less crowding and room to establish your brand.' :
					topKey === 'demographics' ? 'The demographics profile matches well — income levels, density, and age mix support your concept.' :
					topKey === 'vibrancy' ? 'This is an active, vibrant neighborhood with foot traffic, nightlife, and cultural draws.' :
					topKey === 'safety' ? 'Low crime density and stable conditions create a comfortable environment for customers.' :
					'This area is growing — new construction, population gains, and rising commercial interest.'
				}`,
				icon: '💪'
			});

			if (bottomVal < 60) {
				qs.push({
					id: 'weakest',
					question: "What should I worry about?",
					answer: `**${labelMap[bottomKey] || bottomKey}** is the weakest signal at ${bottomVal}/100. ${
						bottomKey === 'transit' ? 'Limited transit means you\'ll rely more on drive-by, parking, and delivery. Budget for delivery app commissions.' :
						bottomKey === 'competition' ? 'High competition density means you need a strong differentiator. Your concept needs to stand out clearly.' :
						bottomKey === 'demographics' ? 'The local demographics don\'t perfectly match your target customer. Consider whether your pricing and concept can adapt.' :
						bottomKey === 'vibrancy' ? 'This is a quieter area — you\'ll need to generate your own foot traffic through marketing and loyalty programs.' :
						bottomKey === 'safety' ? 'Elevated safety concerns may affect evening hours and customer comfort. Consider security measures and operating hours.' :
						'Growth signals are flat or declining. Your success here depends more on current demand than future appreciation.'
					}`,
					icon: '⚠️'
				});
			}
		}

		// Fit IQ question
		if (fitScore > 0) {
			qs.push({
				id: 'fit',
				question: "How well does my concept fit this location?",
				answer: fitComparison,
				icon: '🎯'
			});
		}

		// Warnings question
		if (headsUpWarnings.length > 0) {
			const warningList = headsUpWarnings.slice(0, 3).map(w => `• ${w.title}: ${w.detail}`).join('\n');
			qs.push({
				id: 'warnings',
				question: `You flagged ${headsUpWarnings.length} warning${headsUpWarnings.length > 1 ? 's' : ''} — what should I do?`,
				answer: `Here are the items I'd address before signing a lease:\n\n${warningList}\n\nThese aren't dealbreakers on their own, but they should factor into your lease negotiation and business plan.`,
				icon: '🚩'
			});
		}

		// ── Score Methodology ──
		qs.push({
			id: 'methodology',
			question: "How is your score calculated?",
			answer: `Your **score** (${compositeScore}/100) is the equally-weighted average of six indices:\n\n` +
				`• **Transit** (${compassScores.transit ?? '—'}/100) — subway ridership, bus routes, walk/bike scores, parking density\n` +
				`• **Competition** (${compassScores.competition ?? '—'}/100) — competitor count within ¼ mile, how crowded the market is, category mix\n` +
				`• **Demographics** (${compassScores.demographics ?? '—'}/100) — population density, median income, age distribution, daytime vs nighttime pop\n` +
				`• **Vibrancy** (${compassScores.vibrancy ?? '—'}/100) — restaurant/retail density, Yelp activity, foot traffic proxies, event venues\n` +
				`• **Safety** (${compassScores.safety ?? '—'}/100) — NYPD complaint density, crime types, 311 complaints, lighting/cleanliness\n` +
				`• **Momentum** (${compassScores.momentum ?? '—'}/100) — new permits, construction activity, rent trends, business openings vs closings\n\n` +
				`Each index pulls from 2-5 real data sources. The composite gives every index equal weight so no single factor dominates.`,
			icon: '📊'
		});

		// Fit IQ methodology
		if (fitScore > 0) {
			qs.push({
				id: 'fit-method',
				question: "How does your concept weighting work?",
				answer: `Your concept-weighted score (${fitScore}/100) uses the same six indices but applies **weights tailored to your business type**. For a ${conceptDescription || bizType}, some factors matter more than others.\n\n` +
					`For example, a coffee shop weights **Transit** and **Demographics** heavily (commuters = morning traffic), while a gym cares more about **Demographics** (household income) and **Competition** (how crowded the market is).\n\n` +
					`The gap between your base score (${compositeScore}) and your concept-weighted score (${fitScore}) tells you whether this location's strengths align with what your specific business type needs most.`,
				icon: '🎯'
			});
		}

		// Data sources
		qs.push({
			id: 'data-sources',
			question: "Where does the data come from?",
			answer: buildDataSourcesAnswer(),
			icon: '🔍'
		});

		// Per-index deep dives for each of the six indices
		const indexDetails: Record<string, { question: string; icon: string; builder: () => string }> = {
			transit: {
				question: `Tell me more about the Transit score (${compassScores.transit ?? 0}/100)`,
				icon: '🚇',
				builder: () => {
					const score = compassScores.transit ?? 0;
					let detail = `**Transit & Accessibility: ${score}/100**\n\n`;
					detail += `This measures how easily customers can reach you. We analyze:\n\n`;
					detail += `• **MTA ridership** — daily riders at nearby subway stations\n`;
					detail += `• **Bus routes** — number of bus lines within 2 blocks\n`;
					detail += `• **Walk Score / Bike Score** — pedestrian and cycling accessibility\n`;
					detail += `• **Parking** — nearby garage and lot density\n\n`;
					if (score >= 75) detail += `At ${score}/100, this location is very accessible. Transit alone will drive reliable foot traffic.`;
					else if (score >= 50) detail += `At ${score}/100, accessibility is moderate. You'll get some transit-driven traffic but should also plan for drive-up and delivery customers.`;
					else detail += `At ${score}/100, transit access is limited. Plan for customers arriving by car, and budget for delivery platform commissions.`;
					return detail;
				}
			},
			competition: {
				question: `Tell me more about the Competition score (${compassScores.competition ?? 0}/100)`,
				icon: '⚔️',
				builder: () => {
					const score = compassScores.competition ?? 0;
					let detail = `**Competition Landscape: ${score}/100**\n\n`;
					detail += `This evaluates how crowded the market is for your concept. We analyze:\n\n`;
					detail += `• **Direct competitor count** — same-category businesses within ¼ mile\n`;
					detail += `• **Competitors per resident** — how many similar businesses serve the local population\n`;
					detail += `• **Category mix** — chain vs independent, price tier distribution\n`;
					detail += `• **Yelp/Google ratings** — quality of existing competition\n\n`;
					if (score >= 75) detail += `A high score means fewer competitors — room to establish your brand without fighting for every customer.`;
					else if (score >= 50) detail += `Moderate competition. You'll need a clear differentiator, but proven demand exists in this category.`;
					else detail += `Very crowded market. This doesn't mean failure, but you need a strong differentiator and marketing strategy.`;
					return detail;
				}
			},
			demographics: {
				question: `Tell me more about the Demographics score (${compassScores.demographics ?? 0}/100)`,
				icon: '👥',
				builder: () => {
					const score = compassScores.demographics ?? 0;
					let detail = `**Demographics & Spending: ${score}/100**\n\n`;
					detail += `This measures whether the local population matches your target customer. We analyze:\n\n`;
					detail += `• **Population density** — people within ½ mile radius\n`;
					detail += `• **Median household income** — spending power of residents\n`;
					detail += `• **Age distribution** — 18-34 vs 35-54 vs 55+ mix\n`;
					detail += `• **Daytime population** — office workers, commuters, tourists\n`;
					detail += `• **Education level** — college-educated percentage (proxy for discretionary spending)\n\n`;
					if (score >= 75) detail += `Strong demographic fit — the people who live and work here match your ideal customer profile.`;
					else if (score >= 50) detail += `Decent demographic alignment, with some gaps. Consider adjusting pricing or hours to capture the available audience.`;
					else detail += `Demographic mismatch. The local population may not be your natural customer base. Consider whether marketing can bridge the gap.`;
					return detail;
				}
			},
			vibrancy: {
				question: `Tell me more about the Vibrancy score (${compassScores.vibrancy ?? 0}/100)`,
				icon: '✨',
				builder: () => {
					const score = compassScores.vibrancy ?? 0;
					let detail = `**Neighborhood Vibrancy: ${score}/100**\n\n`;
					detail += `This measures how "alive" the neighborhood feels — foot traffic, commercial activity, cultural draws. We analyze:\n\n`;
					detail += `• **Restaurant/retail density** — commercial establishments per block\n`;
					detail += `• **Yelp review volume** — proxy for foot traffic and engagement\n`;
					detail += `• **Nightlife and entertainment** — bars, venues, theaters within walking distance\n`;
					detail += `• **Cultural anchors** — parks, museums, landmarks that draw visitors\n\n`;
					if (score >= 75) detail += `High vibrancy means built-in foot traffic. People are already coming to this area — you just need to capture them.`;
					else if (score >= 50) detail += `Moderate vibrancy. There's activity here but it's not a destination neighborhood. You'll need to generate some of your own draw.`;
					else detail += `Low vibrancy suggests a quieter area. Success requires destination marketing — giving people a specific reason to visit you.`;
					return detail;
				}
			},
			safety: {
				question: `Tell me more about the Safety score (${compassScores.safety ?? 0}/100)`,
				icon: '🛡️',
				builder: () => {
					const score = compassScores.safety ?? 0;
					let detail = `**Safety & Stability: ${score}/100**\n\n`;
					detail += `This evaluates the safety environment for customers and staff. We analyze:\n\n`;
					detail += `• **NYPD complaint data** — incidents per capita in the precinct\n`;
					detail += `• **Crime type distribution** — violent vs property vs quality-of-life\n`;
					detail += `• **311 complaints** — noise, sanitation, lighting issues\n`;
					detail += `• **Trend direction** — improving vs worsening over 12 months\n\n`;
					if (score >= 75) detail += `Low crime density and stable conditions. Customers will feel comfortable visiting at all hours.`;
					else if (score >= 50) detail += `Average safety profile. Consider security lighting, cameras, and adjusting closing hours based on the specific risks.`;
					else detail += `Elevated safety concerns. Factor in security costs, insurance premiums, and potentially limited evening hours.`;
					return detail;
				}
			},
			momentum: {
				question: `Tell me more about the Momentum score (${compassScores.momentum ?? 0}/100)`,
				icon: '📈',
				builder: () => {
					const score = compassScores.momentum ?? 0;
					let detail = `**Growth Momentum: ${score}/100**\n\n`;
					detail += `This measures whether the area is gaining or losing commercial energy. We analyze:\n\n`;
					detail += `• **New building permits** — construction and renovation activity\n`;
					detail += `• **Business openings vs closings** — net commercial growth\n`;
					detail += `• **Rent trends** — asking rents over 12-24 months\n`;
					detail += `• **Population change** — migration patterns in/out of the area\n\n`;
					if (score >= 75) detail += `Strong growth momentum. This area is attracting investment, which means rising property values but also rising rents. Lock in a long lease now.`;
					else if (score >= 50) detail += `Moderate momentum. The area is stable with some growth signals. You'll benefit from any positive trends without the risk of rapid rent escalation.`;
					else detail += `Flat or declining momentum. This isn't necessarily bad — rents may be negotiable — but your success depends on current demand, not future appreciation.`;
					return detail;
				}
			}
		};

		// Add per-index deep dives
		for (const [key, config] of Object.entries(indexDetails)) {
			if (compassScores[key] !== undefined) {
				qs.push({
					id: `index-${key}`,
					question: config.question,
					answer: config.builder(),
					icon: config.icon
				});
			}
		}

		// Warnings question
		if (headsUpWarnings.length > 0) {
			const warningList = headsUpWarnings.slice(0, 3).map(w => `• ${w.title}: ${w.detail}`).join('\n');
			qs.push({
				id: 'warnings',
				question: `You flagged ${headsUpWarnings.length} warning${headsUpWarnings.length > 1 ? 's' : ''} — what should I do?`,
				answer: `Here are the items I'd address before signing a lease:\n\n${warningList}\n\nThese aren't dealbreakers on their own, but they should factor into your lease negotiation and business plan.`,
				icon: '🚩'
			});
		}

		// Next steps
		qs.push({
			id: 'next',
			question: "What should I do next?",
			answer: compositeScore >= 60
				? "Here's my recommended sequence:\n\n1. **Review Recommendations** — see specific, actionable insights for this location\n2. **Check Space IQ** — evaluate the physical space requirements\n3. **Run Financials** — build a financial model with this location's data\n4. **Compare Locations** — score 2-3 alternatives to benchmark\n\nUse the **Dashboard** button (top right) to navigate between modules."
				: "Given the score, I'd suggest:\n\n1. **Score 2-3 alternative locations** — use the \"+ New Score\" button to compare\n2. **Review the Recommendations** below — some issues may be negotiable\n3. **If you proceed anyway** — run Financials and build a conservative model\n\nDon't commit to a lease based on one score. Compare at least 3 locations.",
			icon: '🗺️'
		});

		return qs;
	});

	// Build data sources answer from available live intel
	function buildDataSourcesAnswer(): string {
		const sources: string[] = [];
		sources.push('• **US Census / ACS** — population, income, demographics, housing');
		sources.push('• **Google Places API** — nearby businesses, ratings, category counts');
		sources.push('• **MTA / Transit** — subway ridership, bus routes, station proximity');
		sources.push('• **Walk Score API** — walkability, transit score, bike score');

		if (liveIntel) {
			if ((liveIntel as any).yelp) sources.push('• **Yelp Fusion API** — business reviews, ratings, foot traffic proxies');
			if ((liveIntel as any).foursquare) sources.push('• **Foursquare** — venue popularity, check-in data');
			if ((liveIntel as any).nypd || (liveIntel as any).crime) sources.push('• **NYPD CompStat** — crime incident data by precinct');
			if ((liveIntel as any).permits || (liveIntel as any).dob) sources.push('• **NYC DOB** — building permits, new construction filings');
			if ((liveIntel as any).zoning) sources.push('• **NYC Zoning / PLUTO** — land use, zoning districts, lot data');
			if ((liveIntel as any).pedestrian) sources.push('• **NYC DOT** — pedestrian count data at key intersections');
		}

		if (vlfData) sources.push('• **Vacancy & Lease Finder** — available spaces, asking rents, lease terms');
		if (posData) sources.push('• **Probability of Success model** — machine-learning survival estimates');

		sources.push('• **Anthropic Claude** — AI synthesis, narrative generation, coaching');

		let answer = `RE² pulls from **${sources.length}+ data sources** in real time. For this location:\n\n`;
		answer += sources.join('\n');
		answer += '\n\nAll data is fetched live at scoring time. Scores update with every new search — they are not cached.';
		return answer;
	}

	function toggleQuestion(id: string) {
		activeQuestion = activeQuestion === id ? null : id;
	}

	// Simple markdown bold rendering
	function renderBold(text: string): string {
		// 04.25.2026 16:36 CoPilot Sanitization — sanitize after bold conversion
		return sanitizeHtml(text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'));
	}
</script>

<div class="smart-coach" class:collapsed={!expanded}>
	<button class="coach-header" onclick={() => (expanded = !expanded)}>
		<div class="coach-title-row">
			<span class="coach-icon">🧠</span>
			<span class="coach-title">Smart Coach</span>
			<span class="coach-subtitle">— your location advisor</span>
		</div>
		<span class="coach-toggle">{expanded ? '▾' : '▸'}</span>
	</button>

	{#if expanded}
		<div class="coach-body">
			<!-- Intro message -->
			<div class="coach-message intro">
				<div class="coach-avatar">🤖</div>
				<div class="coach-bubble">
					<p>{@html renderBold(coachIntro)}</p>
				</div>
			</div>

			<!-- Q&A cards -->
			<div class="coach-questions">
				{#each questions as q (q.id)}
					<button
						class="question-btn"
						class:active={activeQuestion === q.id}
						onclick={() => toggleQuestion(q.id)}
					>
						<span class="q-icon">{q.icon}</span>
						<span class="q-text">{q.question}</span>
						<span class="q-arrow">{activeQuestion === q.id ? '▾' : '▸'}</span>
					</button>
					{#if activeQuestion === q.id}
						<div class="answer-panel">
							<div class="coach-avatar small">🤖</div>
							<div class="answer-content">
								{@html renderBold(q.answer).replace(/\n/g, '<br>')}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.smart-coach {
		background: var(--surface, #fff);
		border: 1px solid var(--border, #E5E7EB);
		border-radius: 16px;
		overflow: hidden;
		margin-top: 24px;
	}

	.coach-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 16px 20px;
		background: linear-gradient(135deg, rgba(13, 124, 110, 0.04), rgba(13, 124, 110, 0.08));
		border: none;
		cursor: pointer;
		transition: background 0.2s;
	}
	.coach-header:hover {
		background: linear-gradient(135deg, rgba(13, 124, 110, 0.06), rgba(13, 124, 110, 0.12));
	}

	.coach-title-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.coach-icon { font-size: 20px; }
	.coach-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--text, #1A1D23);
	}
	.coach-subtitle {
		font-size: 13px;
		color: var(--text-secondary, #5A6578);
		font-weight: 400;
	}
	.coach-toggle {
		font-size: 14px;
		color: var(--text-secondary, #5A6578);
	}

	.coach-body {
		padding: 20px;
	}

	.coach-message {
		display: flex;
		gap: 12px;
		margin-bottom: 20px;
	}
	.coach-avatar {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		background: rgba(13, 124, 110, 0.1);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
	}
	.coach-avatar.small {
		width: 24px;
		height: 24px;
		font-size: 12px;
	}
	.coach-bubble {
		background: var(--surface-alt, #F8F9FA);
		border-radius: 12px;
		padding: 14px 16px;
		flex: 1;
	}
	.coach-bubble p {
		margin: 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text, #1A1D23);
	}

	.coach-questions {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.question-btn {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 12px 14px;
		background: var(--surface-alt, #F8F9FA);
		border: 1px solid transparent;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.15s;
		text-align: left;
	}
	.question-btn:hover {
		border-color: var(--teal, #0D7C6E);
		background: rgba(13, 124, 110, 0.04);
	}
	.question-btn.active {
		border-color: var(--teal, #0D7C6E);
		background: rgba(13, 124, 110, 0.06);
	}
	.q-icon { font-size: 16px; flex-shrink: 0; }
	.q-text {
		flex: 1;
		font-size: 14px;
		font-weight: 600;
		color: var(--text, #1A1D23);
	}
	.q-arrow {
		font-size: 12px;
		color: var(--text-secondary, #5A6578);
		flex-shrink: 0;
	}

	.answer-panel {
		display: flex;
		gap: 10px;
		padding: 14px 14px 14px 24px;
		margin-bottom: 4px;
		animation: fadeIn 0.2s ease-out;
	}
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.answer-content {
		flex: 1;
		font-size: 13.5px;
		line-height: 1.65;
		color: var(--text, #1A1D23);
	}
	.answer-content :global(strong) {
		font-weight: 700;
		color: var(--teal, #0D7C6E);
	}

	@media (max-width: 640px) {
		.coach-subtitle { display: none; }
		.coach-body { padding: 14px; }
		.coach-bubble { padding: 12px; }
	}
</style>
