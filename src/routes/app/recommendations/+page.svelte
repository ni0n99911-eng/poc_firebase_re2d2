<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import PageNav from '$lib/components/PageNav.svelte';
	import DisclaimerBanner from '$lib/components/DisclaimerBanner.svelte';
	import { loadLaunchPadData } from '$lib/launchpad-store';
	import { scoreAllNeighborhoods, getScoreLabel } from '$lib/_deprecated_04.19.2026_scoring';
	import ScoreDisplay from '$lib/components/ScoreDisplay.svelte';
	import { computeLocationScore, computeAlignmentScore } from '$lib/re2-scores';
	import { authedFetch } from '$lib/authed-fetch';
	import NavigationDrawer from '$lib/components/NavigationDrawer.svelte';
	// BR-UX-10: canonical grade / tier / meaning / nextTier from decision-engine.
	import { fitGrade, fitTierLabel, fitMeaningShort, fitNextTier } from '$lib/utils/decision-engine';

	let mounted = $state(false);
	let activeTab = $state('breakdown');

	// RE² Two-Score Model
	let locationScore = $state(null);
	let alignmentScore = $state(null);
	let scoresLoading = $state(false);
	let intelReport = $state(null);

	// Location info from localStorage
	let locationAddress = $state('');
	let locationMeta = $state('');
	let hasAnalyzedLocation = $state(false);

	// Session-cached scores from Location IQ page (single source of truth)
	let sessionLocationIQ = $state(null);
	let sessionFitIQ = $state(null);
	let sessionVisionIQ = $state(null); // LOW-1: Vision IQ ring in hero
	// P0-E FIX: Canonical 6-dimension sub-scores from handleScoresReady (same as Location IQ page)
	let sessionSixScores = $state({});
	let sessionBizType = $state('');

	const tabs = [
		{ id: 'breakdown', label: 'Score Breakdown', icon: 'bar-chart' },
		{ id: 'risks', label: 'Risk Playbook', icon: 'warning' },
		{ id: 'negotiate', label: 'Negotiation', icon: 'handshake' },
		{ id: 'alternatives', label: 'Where Else', icon: 'map' },
		{ id: 'execution', label: 'Execution Plan', icon: 'calendar' },
		{ id: 'resources', label: 'Resources', icon: 'wrench' }
	];

	function getBusinessTypeLabel(bt) {
		// For custom concepts, show the user's typed name
		if (bt === 'something_else') {
			const bn = lpData?.businessName;
			return (bn && bn !== 'Other') ? bn : 'Your Business';
		}
		const map = {
			'coffee_shop': 'Coffee / Café', 'coffee': 'Coffee / Café', 'Specialty Coffee/Café': 'Coffee / Café',
			'restaurant': 'Restaurant', 'Restaurant (Fast Casual)': 'Fast Casual', 'Restaurant (Full Service)': 'Full Service',
			'gym': 'Fitness Studio', 'fitness': 'Fitness Studio', 'Fitness / Wellness': 'Fitness Studio',
			'dentist': 'Dental Practice', 'spa': 'Spa / Wellness', 'spa_wellness': 'Spa / Wellness',
			'bodega': 'Grocery / Market', 'bakery': 'Bakery', 'barber': 'Barbershop',
			'barbershop': 'Barbershop / Salon', 'boutique': 'Retail Boutique', 'florist': 'Florist',
			'retail': 'Retail', 'bar': 'Bar / Lounge', 'medical_dental': 'Dental / Medical',
			'Other': 'Your Business',
		};
		return map[bt || ''] || bt || 'Your Business';
	}

	async function computeRE2Scores() {
		scoresLoading = true;
		try {
			const cached = localStorage.getItem('re2_location_intel');
			if (cached) {
				intelReport = JSON.parse(cached);
			} else {
				const coords = localStorage.getItem('re2_selected_location');
				if (coords) {
					const { lat, lng } = JSON.parse(coords);
					const res = await authedFetch(`/api/location-intel?lat=${lat}&lng=${lng}&type=${lpData?.businessType || 'cafe'}`);
					if (res.ok) {
						intelReport = await res.json();
						localStorage.setItem('re2_location_intel', JSON.stringify(intelReport));
					}
				}
			}

			if (intelReport) {
				const categoryId = lpData?.businessType || 'coffee';
				locationScore = computeLocationScore(intelReport, categoryId);
				const founderProfile = {
					monthlyRent: lpData?.financialGoals?.monthlyRentBudget || undefined,
					riskTolerance: lpData?.founderProfile?.riskTolerance || undefined,
					businessType: lpData?.businessType || undefined,
					format: lpData?.businessFormat || undefined,
				};
				alignmentScore = computeAlignmentScore(locationScore, founderProfile, intelReport);
			} else if (scoredNeighborhoods.length > 0) {
				const top = scoredNeighborhoods[0];
				const scoreLabel = getScoreLabel(top.overallScore);
				locationScore = {
					score: top.overallScore,
					grade: top.overallScore > 0 ? fitGrade(top.overallScore) : 'F',
					summary: `${scoreLabel.label} — ${top.name} scores ${top.overallScore}/100 for your ${getBusinessTypeLabel(lpData?.businessType)}.`,
					subScores: [
						{ layer: 'vlf', label: 'Concept-Location Fit', score: top.vlf, weight: 0.40 },
						{ layer: 'glf', label: 'Goal Feasibility', score: top.glf, weight: 0.35 },
						{ layer: 'rr', label: 'Risk & Resilience', score: top.rr, weight: 0.25 },
						{ layer: 'demo', label: 'Demographics', score: top.breakdown.demographic, weight: 0.15 },
						{ layer: 'comp', label: 'Competition', score: top.breakdown.competition, weight: 0.15 },
						{ layer: 'trend', label: 'Trend Score', score: top.breakdown.trend, weight: 0.10 },
						{ layer: 'traffic', label: 'Foot Traffic', score: top.breakdown.footTraffic, weight: 0.10 },
						{ layer: 'rent', label: 'Rent Fit', score: top.breakdown.rent, weight: 0.10 }
					]
				};
				const gap = top.vlf - top.overallScore;
				alignmentScore = {
					score: top.vlf,
					grade: top.vlf > 0 ? fitGrade(top.vlf) : 'F',
					gap: gap,
					gapInterpretation: gap >= 5 ? 'Your concept aligns well with this location.' : gap >= -5 ? 'Neutral alignment — location meets basic requirements.' : 'Some tension between your concept and this location.',
					factors: [
						{ title: 'Market Fit', label: 'Concept-Location Fit', impact: top.vlf >= 70 ? 'positive' : top.vlf >= 50 ? 'neutral' : 'negative', detail: `VLF: ${top.vlf}/100` },
						{ title: 'Budget', label: 'Financial Feasibility', impact: top.glf >= 70 ? 'positive' : top.glf >= 50 ? 'neutral' : 'negative', detail: `GLF: ${top.glf}/100` },
						{ title: 'Risk Profile', label: 'Risk Profile', impact: top.rr >= 70 ? 'positive' : top.rr >= 50 ? 'neutral' : 'negative', detail: `R&R: ${top.rr}/100` }
					]
				};
			}
		} catch (e) {
			console.error('Score computation error:', e);
		} finally {
			scoresLoading = false;
		}
	}

	let lpData = $state(null);
	let scoredNeighborhoods = $state([]);
	let primaryHood = $state(null);

	// Derived data for tabs
	let locIQ = $derived(sessionLocationIQ ?? locationScore?.score ?? 0);
	let fitIQ = $derived(sessionFitIQ ?? alignmentScore?.score ?? 0);
	// P0-E: Use canonical 6-dimension sixScores when available (matches Location IQ page exactly)
	// Falls back to locationScore.subScores (VLF/GLF/RR engine) only if no session scores exist
	let subScores = $derived.by(() => {
		const ss = sessionSixScores;
		if (ss && Object.keys(ss).length > 0) {
			return [
				{ layer: 'transit', label: 'Transit', score: ss.transit ?? 0, weight: 0.20 },
				{ layer: 'safety', label: 'Safety', score: ss.safety ?? 0, weight: 0.15 },
				{ layer: 'demo', label: 'Demographics', score: ss.demographics ?? 0, weight: 0.20 },
				{ layer: 'vibrancy', label: 'Concept Pulse', score: ss.vibrancy ?? 0, weight: 0.20 },
				{ layer: 'comp', label: 'Market Proof', score: ss.momentum || ss.market_proof || 0, weight: 0.15 },
				{ layer: 'trend', label: 'Momentum', score: ss.competition || 0, weight: 0.10 },
			].filter(s => s.score != null);
		}
		return locationScore?.subScores ?? [];
	});
	// Normalize factors: computeAlignmentScore returns {name, impact(number), detail}
	// but the fallback path returns {title, label, impact(string), detail}.
	// Unify to {title, label, impact(string), detail} for the template.
	let alignFactors = $derived((alignmentScore?.factors ?? []).map((f) => {
		// Already has title/label from the fallback path
		if (f.title && f.label) return f;
		// Normalize from computeAlignmentScore format
		const impactNum = typeof f.impact === 'number' ? f.impact : 0;
		const impactStr = impactNum >= 5 ? 'positive' : impactNum >= -5 ? 'neutral' : 'negative';
		return {
			title: f.title || f.name || 'Factor',
			label: f.label || f.name || '',
			impact: impactStr,
			detail: f.detail || ''
		};
	}));

	// Hero insight: strongest and weakest factors
	let heroInsight = $derived.by(() => {
		if (subScores.length === 0) return '';
		const sorted = [...subScores].sort((a, b) => b.score - a.score);
		const strongest = sorted[0];
		const weakest = sorted[sorted.length - 1];
		if (strongest && weakest) {
			return `Strongest: ${strongest.label} (${strongest.score}). Weakest: ${weakest.label} (${weakest.score}).`;
		}
		return '';
	});

	// BR-UX-10: Fit IQ grade / tier / meaning / nextTier via canonical decision-engine.
	// Replaces old local 70/55 thresholds (drifted from BR-1's 75/65/50/40).
	let fitIQGrade = $derived(fitIQ > 0 ? fitGrade(fitIQ) : '');
	let fitIQTier = $derived(fitIQ > 0 ? fitTierLabel(fitIQ) : '');
	let fitIQVerdict = $derived(fitIQ > 0 ? fitMeaningShort(fitIQ) : '');
	let fitIQNext = $derived(fitIQ > 0 ? fitNextTier(fitIQ) : null);

	// HIGH-4: Risk generation from scores — works from sessionSixScores when locationScore/primaryHood absent
	let risks = $derived.by(() => {
		const hasSixScores = sessionSixScores && Object.keys(sessionSixScores).length > 0;
		if (!locationScore && !primaryHood && !hasSixScores) return { critical: [], moderate: [], low: [] };
		const critical = [];
		const moderate = [];
		const low = [];

		// Derive directly from sessionSixScores when available (orchestrator thresholds)
		if (hasSixScores) {
			const ss = sessionSixScores;
			// Transit: low foot traffic risk
			if ((ss.transit ?? 100) < 50) {
				critical.push({ title: 'Low Foot Traffic Corridor', detail: `Transit score ${ss.transit}/100. Pedestrian density is below threshold for your concept — factor in marketing budget to build awareness from day one.` });
			} else if ((ss.transit ?? 100) >= 75) {
				low.push({ title: 'Strong Transit Access', detail: `Transit score ${ss.transit}/100. Excellent connectivity drives organic foot traffic — one of your strongest location assets.` });
			}
			// Safety risk
			if ((ss.safety ?? 100) < 50) {
				critical.push({ title: 'Safety Concerns', detail: `Safety score ${ss.safety}/100. Review neighborhood crime patterns, open DOB violations, and inspection history before committing.` });
			}
			// Vibrancy: pioneer risk
			if ((ss.vibrancy ?? 100) < 30) {
				critical.push({ title: 'Pioneer Risk — Unproven Density', detail: `Vibrancy score ${ss.vibrancy}/100. This corridor lacks commercial energy. You'd be opening in a destination-only mode — survival depends on strong marketing or an anchor tenant nearby.` });
			} else if ((ss.vibrancy ?? 100) < 55) {
				moderate.push({ title: 'Low Commercial Vibrancy', detail: `Vibrancy score ${ss.vibrancy}/100. Foot traffic is moderate — consider signage, weekend activation, and delivery channel investment.` });
			} else if ((ss.vibrancy ?? 0) >= 75) {
				low.push({ title: 'High Commercial Vibrancy', detail: `Vibrancy score ${ss.vibrancy}/100. Active street energy works in your favor — expect strong walk-in conversion.` });
			}
			// Market Proof
			const mpScore = ss.momentum ?? ss.market_proof ?? null;
			if (mpScore !== null && mpScore < 50) {
				moderate.push({ title: 'Unproven Market', detail: `Market Proof score ${mpScore}/100. Limited comparable businesses have succeeded here — higher launch risk. Validate demand with a pop-up or soft-open strategy.` });
			}
			// Demographics strength
			if ((ss.demographics ?? 0) >= 75) {
				low.push({ title: 'Strong Demographic Match', detail: `Demographics score ${ss.demographics}/100. Local population closely matches your target customer profile.` });
			}
		}

		// Supplementary: subScores-based risks (VLF/GLF engine when no sixScores)
		if (!hasSixScores) {
			// Rent risk
			const rentSub = subScores.find(s => s.layer === 'rent' || s.label?.includes('Rent'));
			if (rentSub && rentSub.score < 50) {
				critical.push({ title: 'Rent-to-Revenue Squeeze', detail: `Rent fit scored ${rentSub.score}/100. Occupancy costs may exceed 8-10% F&B benchmark. Model your worst-case month before committing.` });
			} else if (rentSub && rentSub.score < 70) {
				moderate.push({ title: 'Rent Pressure', detail: `Rent fit scored ${rentSub.score}/100. Within range but limited margin. Negotiate escalation caps.` });
			}
			// Competition
			const compSub = subScores.find(s => s.layer === 'comp' || s.label?.includes('Competition'));
			if (compSub && compSub.score < 40) {
				critical.push({ title: 'Very Crowded Market', detail: `Competition score ${compSub.score}/100. Differentiate strongly on day one.` });
			} else if (compSub && compSub.score < 65) {
				moderate.push({ title: 'Moderate Competition', detail: `Competition score ${compSub.score}/100. Identify and exploit market gaps.` });
			}
			// Safety
			const safetySub = subScores.find(s => s.layer === 'safety' || s.label?.includes('Safety'));
			if (safetySub && safetySub.score < 50) {
				critical.push({ title: 'Safety Concerns', detail: `Safety score ${safetySub.score}/100. Check DOB violations and building code issues.` });
			}
			// Trend
			const trendSub = subScores.find(s => s.layer === 'trend' || s.label?.includes('Trend'));
			if (trendSub && trendSub.score < 50) {
				moderate.push({ title: 'Declining Neighborhood Trend', detail: `Trend score ${trendSub.score}/100. Area may be losing momentum.` });
			} else if (trendSub && trendSub.score >= 75) {
				low.push({ title: 'Positive Momentum', detail: `Trend score ${trendSub.score}/100. Neighborhood gaining commercial activity.` });
			}
		}

		// Alignment gap risk (always, when available)
		if (alignmentScore && alignmentScore.gap < -10) {
			critical.push({ title: 'Concept-Location Misalignment', detail: `Significant gap in your score — review capital fit and format constraints.` });
		} else if (alignmentScore && alignmentScore.gap < -5) {
			moderate.push({ title: 'Partial Alignment Gap', detail: `Some adjustments may improve your score alignment.` });
		}

		return { critical, moderate, low };
	});

	// Alternative neighborhoods
	let alternatives = $derived(scoredNeighborhoods.length > 1 ? scoredNeighborhoods.slice(1, 4).map(n => ({
		name: n.name,
		locIQ: n.overallScore,
		fitIQ: n.vlf,
		why: n.summary,
		rent: n.monthlyRent,
		badge: n.vlf > fitIQ ? 'better' : 'tradeoff',
		badgeText: n.vlf > fitIQ ? `+${n.vlf - fitIQ} points vs current` : 'Different trade-offs'
	})) : []);

	// Score color helpers
	function scoreColor(score) {
		if (score >= 80) return '#00e8cc';
		if (score >= 65) return '#34d399';
		if (score >= 50) return '#fbbf24';
		return '#ef4444';
	}

	function ringDash(score, radius = 21) {
		const circumference = 2 * Math.PI * radius;
		const filled = (score / 100) * circumference;
		return `${filled.toFixed(0)} ${circumference.toFixed(0)}`;
	}

	onMount(async () => {
		mounted = true;
		lpData = loadLaunchPadData();

		// CRITICAL-4: prefer URL addr param over stale localStorage
		const urlAddr = new URL(window.location.href).searchParams.get('addr');
		if (urlAddr) {
			locationAddress = urlAddr;
			hasAnalyzedLocation = true;
		}

		// Load location address from localStorage as fallback (only if URL param absent)
		if (!locationAddress) {
			const cachedLoc = localStorage.getItem('re2_selected_location');
			if (cachedLoc) {
				try {
					const loc = JSON.parse(cachedLoc);
					locationAddress = loc.addr || loc.address || loc.formatted_address || '';
					locationMeta = loc.neighborhood || '';
					hasAnalyzedLocation = true;
				} catch (e) { /* ignore */ }
			}
		}

		// Fix 4: Read session-cached Location IQ score (written by Location IQ page via handleScoresReady)
		try {
			const sessionRaw = localStorage.getItem('re2_session');
			if (sessionRaw) {
				const session = JSON.parse(sessionRaw);
				if (typeof session.locationIQ === 'number' && session.locationIQ > 0) {
					sessionLocationIQ = session.locationIQ;
				}
				if (typeof session.fitIQ === 'number' && session.fitIQ > 0) {
					sessionFitIQ = session.fitIQ;
				}
				// LOW-1: visionIQ for hero ring
				if (typeof session.visionIQ === 'number' && session.visionIQ > 0) {
					sessionVisionIQ = session.visionIQ;
				}
				// P0-E: Read canonical sixScores and bizType
				if (session.sixScores && typeof session.sixScores === 'object') {
					sessionSixScores = session.sixScores;
				}
				if (session.bizType) sessionBizType = session.bizType;
				// Also pick up address from session if not already set
				if (!locationAddress && session.analyzedAddress) {
					locationAddress = session.analyzedAddress;
					hasAnalyzedLocation = true;
				}
			}
		} catch (e) { /* ignore */ }

		// Only compute scores if we have a location from Location IQ
		if (hasAnalyzedLocation) {
			await computeRE2Scores();
		}

		// Neighborhood scoring as supplementary data (for Where Else tab)
		scoredNeighborhoods = scoreAllNeighborhoods(lpData);
		if (scoredNeighborhoods.length > 0) {
			primaryHood = scoredNeighborhoods[0];
		}
	});
</script>

<svelte:head><title>RE² — Recommendations</title></svelte:head>

<div class="rec-page">
	<DisclaimerBanner />

	{#if !mounted}
		<div class="loading-state">Loading recommendations...</div>
	{:else if !hasAnalyzedLocation}
		<!-- No location analyzed yet -->
		<div class="empty-page">
			<div class="empty-icon"><span class="icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 16 16" fill="none"><path d="M8 1a4.5 4.5 0 00-4.5 4.5C3.5 9 8 15 8 15s4.5-6 4.5-9.5A4.5 4.5 0 008 1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="5.5" r="1.5" stroke="currentColor" stroke-width="1.5"/></svg></span></div>
			<h2>No location analyzed yet</h2>
			<p>Analyze a location first. Your recommendations will appear here based on that analysis.</p>
			<a href="/app/location" class="empty-cta">Analyze a location</a>
		</div>
	{:else}
		<!-- ═══ HERO SECTION ═══ -->
		<div class="hero-section">
			<div class="hero-left">
				<h2 class="hero-address">{locationAddress || 'Your Location'}</h2>
				<div class="hero-concept">
					<!-- HIGH-6: prefer sessionBizType over raw launchpad slug -->
					{getBusinessTypeLabel(sessionBizType || lpData?.businessType)}{lpData?.businessName && lpData.businessName !== getBusinessTypeLabel(sessionBizType || lpData?.businessType) ? ` • ${lpData.businessName}` : ''}
				</div>
				{#if heroInsight}
					<div class="hero-insight">{heroInsight}</div>
				{/if}
			</div>
			<div class="hero-scores">
				<div class="hero-score">
					<div class="hero-ring">
						<svg viewBox="0 0 52 52">
							<circle class="ring-bg" cx="26" cy="26" r="21" />
							<circle class="ring-fill" cx="26" cy="26" r="21" stroke="#00e8cc" stroke-dasharray={ringDash(locIQ)} />
						</svg>
						<span class="ring-num">{locIQ}</span>
					</div>
					<div class="hero-ring-label cyan">Loc IQ</div>
				</div>
				<div class="hero-score">
					<div class="hero-ring">
						<svg viewBox="0 0 52 52">
							<circle class="ring-bg" cx="26" cy="26" r="21" />
							<circle class="ring-fill" cx="26" cy="26" r="21" stroke="#a78bfa" stroke-dasharray={ringDash(fitIQ)} />
						</svg>
						<span class="ring-num">{fitIQ}</span>
					</div>
					<div class="hero-ring-label purple">Your Score</div>
					{#if fitIQGrade}
						<span class="hero-grade-pill grade-{fitIQGrade.toLowerCase()}">Grade {fitIQGrade} · {fitIQTier}</span>
					{/if}
				</div>
			</div>
			{#if fitIQVerdict}
				<div class="hero-meaning-line">{fitIQVerdict}</div>
			{/if}
			{#if fitIQNext && fitIQNext.points > 0 && fitIQNext.points <= 15}
				<div class="hero-nexttier-line">You're <strong>{fitIQNext.points} {fitIQNext.points === 1 ? 'point' : 'points'}</strong> from <strong>{fitIQNext.label}</strong> territory.</div>
			{/if}
		</div>

		<!-- ═══ LOCATION HEADER (BACK BUTTON ONLY) ═══ -->
		<div class="loc-header">
			<a href={locationAddress ? `/app/location?addr=${encodeURIComponent(locationAddress)}` : '/app/location'} class="loc-back" title="Back to your score">← Explore data</a>
		</div>

		<!-- ═══ TAB NAVIGATION ═══ -->
		<div class="tab-nav">
			{#each tabs as tab}
				<button
					class="tab-btn"
					class:active={activeTab === tab.id}
					onclick={() => activeTab = tab.id}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- ══════════════════════════════════════════════════ -->
		<!-- TAB 1: SCORE BREAKDOWN                            -->
		<!-- ══════════════════════════════════════════════════ -->
		{#if activeTab === 'breakdown'}
			<div class="tab-panel">
				{#if heroInsight}
					<div class="hero-insight-box">
						<strong>Score summary:</strong> {heroInsight}
					</div>
				{/if}
				<p class="section-note">Explore the data behind your score: <span class="cyan">{fitIQ}/100</span>{fitIQTier ? ` · ${fitIQTier}` : ''}</p>

				<div class="card">
					<div class="card-header-row">
						<div class="card-icon" style="background: rgba(0,232,204,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="8" width="3" height="7" rx="1" fill="currentColor"/><rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor"/><rect x="11" y="2" width="3" height="13" rx="1" fill="currentColor"/></svg></span></div>
						<div>
							<div class="card-title">Neighborhood Breakdown</div>
							<div class="card-subtitle">{subScores.length} layers · weighted composite → {locIQ}/100</div>
						</div>
					</div>
					{#if subScores.length > 0}
						<div class="breakdown-grid">
							{#each subScores as sub}
								<div class="sub-card">
									<div class="sub-row">
										<span class="sub-name">{sub.label}</span>
										<span class="sub-score" style="color: {scoreColor(sub.score)}">{sub.score}</span>
									</div>
									<div class="sub-bar">
										<div class="sub-bar-fill" style="width:{sub.score}%; background:{scoreColor(sub.score)};"></div>
									</div>
									{#if sub.weight}
										<div class="sub-weight">Weight: {(sub.weight * 100).toFixed(0)}%</div>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div class="empty-state">Run a location analysis to see the neighborhood breakdown.</div>
					{/if}
				</div>

				{#if alignFactors.length > 0}
					<div class="card">
						<div class="card-header-row">
							<div class="card-icon" style="background: rgba(167,139,250,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1" fill="currentColor"/></svg></span></div>
							<div>
								<div class="card-title">Concept Fit Factors</div>
								<div class="card-subtitle">{fitIQGrade ? `Grade ${fitIQGrade} · ${fitIQTier} — ` : ''}{fitIQVerdict} · {fitIQ}/100{alignmentScore?.gap != null ? ` · Gap: ${alignmentScore.gap > 0 ? '+' : ''}${alignmentScore.gap}` : ''}</div>
							</div>
						</div>
						<div class="breakdown-grid">
							{#each alignFactors as factor}
								<div class="sub-card">
									<div class="factor-title">{factor.title}</div>
									<div class="sub-row">
										<span class="sub-name">{factor.label}</span>
										<span class="sub-score" style="color: {factor.impact === 'positive' ? '#34d399' : factor.impact === 'neutral' ? '#fbbf24' : '#ef4444'}">
											{factor.impact === 'positive' ? '✓' : factor.impact === 'neutral' ? '~' : '✗'}
										</span>
									</div>
									<div class="sub-detail">{factor.detail}</div>
								</div>
							{/each}
						</div>
						{#if alignmentScore?.gapInterpretation}
							<div class="gap-note">{alignmentScore.gapInterpretation}</div>
						{/if}
					</div>
				{:else}
					<!-- P2-1: CTA when alignment factors are empty (budget skipped) -->
					<div class="card">
						<div class="card-header-row">
							<div class="card-icon" style="background: rgba(167,139,250,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1" fill="currentColor"/></svg></span></div>
							<div>
								<div class="card-title">Concept Fit Factors</div>
								<div class="card-subtitle">Not enough data to compute alignment</div>
							</div>
						</div>
						<div class="empty-state" style="text-align: center; padding: 24px;">
							<p style="margin: 0 0 12px; color: #6b7280;">Answer a few questions about your budget and goals to see how well this location aligns with your concept.</p>
							<a href="/app/onboarding" class="inline-link" style="font-weight: 600;">Complete your profile →</a>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- ══════════════════════════════════════════════════ -->
		<!-- TAB 2: RISK PLAYBOOK                              -->
		<!-- ══════════════════════════════════════════════════ -->
		{#if activeTab === 'risks'}
			<div class="tab-panel">
				<p class="section-note">Key risks flagged for this location, ranked by severity. Each includes what to watch and how to mitigate.</p>

				{#if risks.critical.length > 0}
					<div class="card">
						<div class="card-header-row">
							<div class="card-icon" style="background: rgba(239,68,68,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L1.5 13.5h13L8 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 7v3M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span></div>
							<div>
								<div class="card-title">Critical Risks</div>
								<div class="card-subtitle">Address these before signing a lease</div>
							</div>
						</div>
						{#each risks.critical as risk}
							<div class="risk-item">
								<div class="risk-severity high"></div>
								<div class="risk-body">
									<h4>{risk.title}</h4>
									<p>{risk.detail}</p>
									<span class="risk-tag high">HIGH SEVERITY</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if risks.moderate.length > 0}
					<div class="card">
						<div class="card-header-row">
							<div class="card-icon" style="background: rgba(251,191,36,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L1.5 13.5h13L8 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 7v3M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span></div>
							<div>
								<div class="card-title">Moderate Risks</div>
								<div class="card-subtitle">Factor into your planning</div>
							</div>
						</div>
						{#each risks.moderate as risk}
							<div class="risk-item">
								<div class="risk-severity med"></div>
								<div class="risk-body">
									<h4>{risk.title}</h4>
									<p>{risk.detail}</p>
									<span class="risk-tag med">MODERATE</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if risks.low.length > 0}
					<div class="card">
						<div class="card-header-row">
							<div class="card-icon" style="background: rgba(52,211,153,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
							<div>
								<div class="card-title">Low Risks (Strengths)</div>
								<div class="card-subtitle">Working in your favor</div>
							</div>
						</div>
						{#each risks.low as risk}
							<div class="risk-item">
								<div class="risk-severity low"></div>
								<div class="risk-body">
									<h4>{risk.title}</h4>
									<p>{risk.detail}</p>
									<span class="risk-tag low">LOW RISK — ADVANTAGE</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if risks.critical.length === 0 && risks.moderate.length === 0 && risks.low.length === 0}
					<div class="card">
						<div class="empty-state">Run a location analysis to generate your risk playbook.</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- ══════════════════════════════════════════════════ -->
		<!-- TAB 3: NEGOTIATION PLAYBOOK                       -->
		<!-- ══════════════════════════════════════════════════ -->
		{#if activeTab === 'negotiate'}
			<div class="tab-panel">
				<p class="section-note">The 3 critical things to watch for when negotiating your lease — plus data-driven leverage points.</p>

				<div class="card">
					<div class="card-header-row">
						<div class="card-icon" style="background: rgba(0,232,204,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8c0-1 .5-2 1-2.5M13 8c0-1-.5-2-1-2.5M3.5 9c-.5.5-1 1.5-1 2.5v2h2v-2M12.5 9c.5.5 1 1.5 1 2.5v2h-2v-2M6 6v-2a1.5 1.5 0 013 0v2M10 6v-2a1.5 1.5 0 00-3 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
						<div>
							<div class="card-title">3 Critical Negotiation Points</div>
							<div class="card-subtitle">Ranked by financial impact on your first 3 years</div>
						</div>
					</div>

					<div class="neg-step">
						<div class="neg-num">1</div>
						<div class="neg-body">
							<h4>Push for a Rent Abatement Period</h4>
							<p>Request 3-6 months free rent during build-out and ramp-up. This is standard in NYC for restaurant tenants — especially if the space has been sitting vacant. A 4-month abatement at your rent level saves significant capital for build-out.</p>
							<div class="neg-tip"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="display:inline;margin-right:4px;vertical-align:text-bottom"><path d="M8 2a4 4 0 00-2.5 7.1V11a.5.5 0 00.5.5h4a.5.5 0 00.5-.5V9.1A4 4 0 008 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 13h4M6.5 14.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span> Leverage: Vacant or previously-troubled spaces give you negotiating power</div>
						</div>
					</div>

					<div class="neg-step">
						<div class="neg-num">2</div>
						<div class="neg-body">
							<h4>Cap Your Annual Escalation at 2.5%</h4>
							<p>Standard NYC leases escalate 3-3.5%/year. Over a 10-year term, the difference between 3.5% and 2.5% compounds to tens of thousands in savings. Use any open building violations and competitive vacancy rates as negotiation leverage.</p>
							<div class="neg-tip"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="display:inline;margin-right:4px;vertical-align:text-bottom"><path d="M8 2a4 4 0 00-2.5 7.1V11a.5.5 0 00.5.5h4a.5.5 0 00.5-.5V9.1A4 4 0 008 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 13h4M6.5 14.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span> Leverage: Building issues = landlord has deferred maintenance to address</div>
						</div>
					</div>

					<div class="neg-step">
						<div class="neg-num">3</div>
						<div class="neg-body">
							<h4>Secure a Kick-Out Clause After Year 2</h4>
							<p>Protect yourself with a revenue-based kick-out clause if targets aren't met by month 24. This limits your downside without reducing commitment — it signals confidence while adding a safety net.</p>
							<div class="neg-tip"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="display:inline;margin-right:4px;vertical-align:text-bottom"><path d="M8 2a4 4 0 00-2.5 7.1V11a.5.5 0 00.5.5h4a.5.5 0 00.5-.5V9.1A4 4 0 008 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 13h4M6.5 14.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span> Leverage: Show your business plan — landlords prefer tenants who plan, not hope</div>
						</div>
					</div>
				</div>

				<div class="card">
					<div class="card-header-row">
						<div class="card-icon" style="background: rgba(56,189,248,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 6h6M5 9h6M5 12h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span></div>
						<div>
							<div class="card-title">Other Lease Items to Watch</div>
							<div class="card-subtitle">Don't overlook these in the fine print</div>
						</div>
					</div>
					<div class="risk-item">
						<div class="risk-severity med"></div>
						<div class="risk-body">
							<h4>Confirm Violation Responsibility</h4>
							<p>Get it in writing that the landlord clears all existing violations before your lease starts. Don't inherit code issues — they can delay your C of O by months.</p>
						</div>
					</div>
					<div class="risk-item">
						<div class="risk-severity med"></div>
						<div class="risk-body">
							<h4>Negotiate HVAC / TI Allowance</h4>
							<p>Restaurant-grade HVAC runs $40-80K. Push for a tenant improvement allowance of at least $30/sq ft. Many NYC landlords offer this for restaurant-quality tenants.</p>
						</div>
					</div>
					<div class="risk-item">
						<div class="risk-severity low"></div>
						<div class="risk-body">
							<h4>Secure Signage & Sidewalk Rights</h4>
							<p>Ensure the lease includes exterior signage rights and sidewalk café permissions (or right to apply). Foot traffic means nothing if people can't see you.</p>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- ══════════════════════════════════════════════════ -->
		<!-- TAB 4: WHERE ELSE TO LOOK                         -->
		<!-- ══════════════════════════════════════════════════ -->
		{#if activeTab === 'alternatives'}
			<div class="tab-panel">
				<p class="section-note">Based on your profile, here are nearby neighborhoods worth exploring — sorted by alignment with your goals.</p>

				{#if alternatives.length > 0}
					<div class="card">
						<div class="card-header-row">
							<div class="card-icon" style="background: rgba(52,211,153,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1a4.5 4.5 0 00-4.5 4.5C3.5 9 8 15 8 15s4.5-6 4.5-9.5A4.5 4.5 0 008 1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="5.5" r="1.5" stroke="currentColor" stroke-width="1.5"/></svg></span></div>
							<div>
								<div class="card-title">Suggested Alternative Locations</div>
								<div class="card-subtitle">Sorted by score — {lpData?.financialGoals?.monthlyRentBudget ? 'better budget match, ' : ''}similar strengths</div>
							</div>
						</div>
						<div class="alt-grid">
							{#each alternatives as alt}
								<div class="alt-card">
									<div class="alt-hood">{alt.name}</div>
									<div class="alt-scores">
										<div class="alt-score">
											<span class="val purple">{alt.fitIQ}</span>
											<span class="lbl">Score</span>
										</div>
									</div>
									{#if alt.rent}
										<div class="alt-rent">${(alt.rent / 1000).toFixed(1)}K/mo rent</div>
									{/if}
									<div class="alt-why">{alt.why}</div>
									<span class="alt-badge" class:better={alt.badge === 'better'} class:tradeoff={alt.badge === 'tradeoff'}>{alt.badgeText}</span>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="card">
						<div class="empty-state">Complete your profile and run a location analysis to see alternative neighborhoods scored against your goals.</div>
					</div>
				{/if}

				<div class="card" style="background: rgba(0,232,204,.04); border-color: rgba(0,232,204,.12);">
					<p class="section-note" style="margin: 0;"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="display:inline;margin-right:4px;vertical-align:text-bottom"><path d="M8 1a4.5 4.5 0 00-4.5 4.5C3.5 9 8 15 8 15s4.5-6 4.5-9.5A4.5 4.5 0 008 1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="5.5" r="1.5" stroke="currentColor" stroke-width="1.5"/></svg></span> Want to analyze a specific address? Go to <a href="/app/location" class="inline-link">Score a location</a> and search any NYC address to get a full score breakdown.</p>
				</div>
			</div>
		{/if}

		<!-- ══════════════════════════════════════════════════ -->
		<!-- TAB 5: EXECUTION PLAN                             -->
		<!-- ══════════════════════════════════════════════════ -->
		{#if activeTab === 'execution'}
			<div class="tab-panel">
				<p class="section-note">A phased timeline for going from "signed lease" to "doors open." Adjust dates to your reality.</p>

				<div class="card">
					<div class="card-header-row">
						<div class="card-icon" style="background: rgba(0,232,204,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M2 6h12M5 2v2M11 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span></div>
						<div>
							<div class="card-title">Launch Roadmap</div>
							<div class="card-subtitle">Typical {getBusinessTypeLabel(sessionBizType || lpData?.businessType)} timeline · 4 phases · ~{sessionBizType === 'bar_nightlife' ? '6-8' : sessionBizType === 'retail' ? '3-5' : sessionBizType === 'fitness_studio' ? '4-6' : '5-7'} months</div>
						</div>
					</div>

					<div class="exec-timeline">
						<!-- PHASE 1: Due Diligence — mostly shared, item 5 varies by concept -->
						<div class="exec-phase phase-1">
							<h4 class="cyan">Phase 1: Due Diligence & Lease</h4>
							<div class="phase-time">Weeks 1-4</div>
							<p>Before signing, verify everything the data tells you — on the ground.</p>
							<ul class="exec-checklist">
								<li>Walk the block at 3 different times (morning, evening, weekend)</li>
								<li>Pull full DOB violation report — confirm landlord remediation timeline</li>
								<li>Get LOI with rent abatement and escalation cap terms</li>
								<li>Hire an attorney to review the lease (budget $3-5K)</li>
								{#if sessionBizType === 'bar_nightlife'}
									<li>Confirm the address is SLA-eligible (check for prior license denials at this location)</li>
									<li>Verify sound insulation situation and late-night egress with building super</li>
								{:else if sessionBizType === 'retail'}
									<li>Confirm Certificate of Occupancy allows retail use (Group M occupancy)</li>
									<li>Assess storefront window visibility and signage rights in lease</li>
								{:else if sessionBizType === 'fitness_studio'}
									<li>Verify floor load capacity (weight equipment requires 100+ lbs/sq ft)</li>
									<li>Confirm ventilation and HVAC capacity for high-occupancy workout space</li>
								{:else}
									<li>Verify HVAC capacity and grease trap situation</li>
									<li>Confirm ventilation shaft access for hood system</li>
								{/if}
							</ul>
						</div>

						<!-- PHASE 2: Design & Permits — highly concept-specific -->
						<div class="exec-phase phase-2">
							<h4 class="blue">Phase 2: Design & Permits</h4>
							{#if sessionBizType === 'bar_nightlife'}
								<div class="phase-time">Weeks 4-12</div>
								<p>NYC liquor licensing is your longest lead item — file SLA paperwork the moment your lease is signed.</p>
								<ul class="exec-checklist">
									<li>File SLA on-premises liquor license application immediately (3-6 month timeline)</li>
									<li>Community Board 30-day public comment window begins at filing — attend CB meeting in person</li>
									<li>Hire architect with bar/nightlife NYC experience for layout and sound attenuation</li>
									<li>File DOB work permit application (expect 6-8 week processing)</li>
									<li>Engage fire dept early for occupancy load inspection and egress plan approval</li>
								</ul>
							{:else if sessionBizType === 'retail'}
								<div class="phase-time">Weeks 4-8</div>
								<p>Retail build-outs are faster than food service — but C of O and layout approvals still take time.</p>
								<ul class="exec-checklist">
									<li>Confirm or file for Certificate of Occupancy for retail (Group M) use</li>
									<li>Hire architect for storefront, fixture layout, and ADA compliance</li>
									<li>File DOB work permit if structural changes planned (expect 4-6 week processing)</li>
									<li>Select and order POS + inventory management system (setup takes 2-3 weeks)</li>
									<li>Begin vendor/supplier onboarding and initial purchase order negotiations</li>
								</ul>
							{:else if sessionBizType === 'fitness_studio'}
								<div class="phase-time">Weeks 4-10</div>
								<p>Equipment has long lead times — order early while permits process in parallel.</p>
								<ul class="exec-checklist">
									<li>Hire architect with fitness studio experience (floor plans, locker room, ADA)</li>
									<li>File DOB work permit application (expect 6-8 week processing)</li>
									<li>Engage MEP engineer for HVAC upgrades — high-occupancy workouts require serious ventilation</li>
									<li>Review personal trainer certification requirements (ACE, NASM, NSCA) and hire accordingly</li>
									<li>Order primary equipment early — specialty cardio/strength has 4-8 week lead times</li>
								</ul>
							{:else}
								<div class="phase-time">Weeks 4-10</div>
								<p>Engage your architect and start DOB permits early — NYC permitting is the #1 delay.</p>
								<ul class="exec-checklist">
									<li>Hire architect with NYC {sessionBizType === 'full_service_restaurant' ? 'full-service restaurant' : 'food service'} experience (see Resources tab)</li>
									<li>File DOB work permit application (expect 6-8 week processing)</li>
									<li>Engage MEP engineer for HVAC, plumbing, electrical plans</li>
									<li>Apply for Community Board approval if needed for sidewalk café</li>
									<li>Begin DOH food establishment permit application</li>
								</ul>
							{/if}
						</div>

						<!-- PHASE 3: Build-Out — concept-specific -->
						<div class="exec-phase phase-3">
							<h4 class="purple-text">Phase 3: Build-Out</h4>
							{#if sessionBizType === 'bar_nightlife'}
								<div class="phase-time">Weeks 12-24</div>
								<p>Construction phase — and your SLA license is still processing in parallel. Don't open until both are done.</p>
								<ul class="exec-checklist">
									<li>Get 3 contractor bids (bar build-out experience preferred)</li>
									<li>Schedule DOB inspections at each milestone</li>
									<li>Install sound attenuation (walls, ceiling, door seals) — neighbors will complain without it</li>
									<li>Set up bar infrastructure: speed rail, draft lines, back bar refrigeration</li>
									<li>Final FDNY walkthrough for occupancy load approval and exit signage</li>
								</ul>
							{:else if sessionBizType === 'retail'}
								<div class="phase-time">Weeks 8-16</div>
								<p>Retail builds move faster. Focus on customer flow, fixture placement, and visual merchandising.</p>
								<ul class="exec-checklist">
									<li>Get 3 contractor bids for buildout (lighting, flooring, shelving)</li>
									<li>Schedule DOB inspections if structural work was filed</li>
									<li>Install fixture systems and shelving — coordinate with visual merchandiser</li>
									<li>Set up POS hardware, security cameras, and inventory scanning</li>
									<li>Final walkthrough: signage installed, ADA compliance confirmed, fire exits clear</li>
								</ul>
							{:else if sessionBizType === 'fitness_studio'}
								<div class="phase-time">Weeks 10-20</div>
								<p>Equipment delivery and floor installation are your critical path items — sequence these carefully.</p>
								<ul class="exec-checklist">
									<li>Get 3 contractor bids (rubber flooring, mirror walls, locker room)</li>
									<li>Schedule DOB sprinkler and ventilation inspections</li>
									<li>Receive and place primary equipment (coordinate delivery access with building)</li>
									<li>Install rubber sport flooring, mirror walls, and acoustic panels</li>
									<li>Final FDNY walkthrough for occupancy load and egress compliance</li>
								</ul>
							{:else}
								<div class="phase-time">Weeks 10-22</div>
								<p>Construction phase. Budget for 10-20% overruns — every NYC restaurant build goes over.</p>
								<ul class="exec-checklist">
									<li>Get 3 contractor bids (insist on restaurant-specific experience)</li>
									<li>Schedule DOB inspections at each milestone</li>
									<li>Order equipment early (lead times: 4-8 weeks for custom)</li>
									<li>Install grease trap, hood system, ansul fire suppression</li>
									<li>Final walkthrough with fire dept and DOH</li>
								</ul>
							{/if}
						</div>

						<!-- PHASE 4: Pre-Launch — concept-specific -->
						<div class="exec-phase phase-4">
							<h4 class="green">Phase 4: Pre-Launch</h4>
							{#if sessionBizType === 'bar_nightlife'}
								<div class="phase-time">Weeks 24-30</div>
								<p>Don't open until your SLA license arrives — operating without it is a permanent black mark. Use this time to train and polish.</p>
								<ul class="exec-checklist">
									<li>Obtain Certificate of Occupancy and confirm SLA license has been issued</li>
									<li>Hire and train bar staff — include responsible service training (TIPS certification)</li>
									<li>Decide wine/beer license vs. full liquor (full = higher revenue ceiling, longer processing)</li>
									<li>3 invite-only soft opens to stress-test service and sound levels before public launch</li>
									<li>Local marketing: partner with nearby restaurants for late-night referrals</li>
								</ul>
							{:else if sessionBizType === 'retail'}
								<div class="phase-time">Weeks 16-20</div>
								<p>Get your C of O, stock shelves, and do a soft open with local community before the grand opening.</p>
								<ul class="exec-checklist">
									<li>Obtain Certificate of Occupancy for retail use</li>
									<li>Complete initial inventory receive and stock shelves</li>
									<li>Train staff on POS, return policies, and store procedures (1-week training)</li>
									<li>2 soft open days (invite friends, local block association) before public launch</li>
									<li>Local marketing: window signage, neighborhood flyers, Instagram teaser campaign</li>
								</ul>
							{:else if sessionBizType === 'fitness_studio'}
								<div class="phase-time">Weeks 20-26</div>
								<p>Get your C of O, certify your trainers, and run beta classes before charging full membership rates.</p>
								<ul class="exec-checklist">
									<li>Obtain Certificate of Occupancy and confirm all DOB/FDNY approvals</li>
									<li>Finalize trainer roster — verify certifications and insurance</li>
									<li>Set up membership management software and class scheduling system</li>
									<li>2 weeks of free beta classes to build community and test class formats</li>
									<li>Local marketing: partner with nearby health food spots for cross-promo</li>
								</ul>
							{:else}
								<div class="phase-time">Weeks 22-26</div>
								<p>Get your C of O, hire your team, soft opens. Don't rush — first impressions are permanent.</p>
								<ul class="exec-checklist">
									<li>Obtain Certificate of Occupancy and DOH food establishment permit</li>
									<li>Hire and train staff ({sessionBizType === 'full_service_restaurant' ? '3-week' : '2-week'} training period)</li>
									{#if sessionBizType === 'full_service_restaurant'}
										<li>Decide wine/beer vs. full liquor license — file SLA application if needed</li>
									{/if}
									<li>3 friends-and-family soft opens before public launch</li>
									<li>Set up POS, inventory systems, delivery partnerships (Uber Eats, DoorDash)</li>
									<li>Local marketing: partner with nearby businesses for cross-promo</li>
								</ul>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- ══════════════════════════════════════════════════ -->
		<!-- TAB 6: RESOURCES NEEDED                           -->
		<!-- ══════════════════════════════════════════════════ -->
		{#if activeTab === 'resources'}
			<div class="tab-panel">
				<p class="section-note">The professionals and services you'll need to move forward — based on challenges flagged for this location.</p>

				<div class="card">
					<div class="card-header-row">
						<div class="card-icon" style="background: rgba(239,68,68,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13l2-2.5M5.5 9.5l8-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="3" r="2" stroke="currentColor" stroke-width="1.5"/></svg></span></div>
						<div>
							<div class="card-title">Essential Professionals</div>
							<div class="card-subtitle">Must-have before signing the lease</div>
						</div>
					</div>
					<div class="res-grid">
						<div class="res-card">
							<div class="res-role">🏗️ Architect (Restaurant-Specialized)</div>
							<div class="res-why">You need someone who knows NYC DOB filing, can optimize your layout, and has experience maximizing seats in tight spaces.</div>
							<div class="res-detail"><span class="res-icon"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1L7 3H3L8 14L13 3H9L8 1Z" fill="currentColor"/></svg></span></span> Must have NYC restaurant portfolio</div>
							<div class="res-detail"><span class="res-icon"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1L7 3H3L8 14L13 3H9L8 1Z" fill="currentColor"/></svg></span></span> Should handle DOB expediting or have a partner who does</div>
							<div class="res-cost">Est. $15-25K for full design + filing</div>
						</div>
						<div class="res-card">
							<div class="res-role"><span class="icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="display:inline;margin-right:4px;vertical-align:text-bottom"><path d="M9 2L4 9h4l-1 5 5-7h-4l1-5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>MEP Engineer (Mechanical, Electrical, Plumbing)</div>
							<div class="res-why">An MEP engineer ensures your mechanical systems meet code and won't cause permit delays. Critical for any food service build-out.</div>
							<div class="res-detail"><span class="res-icon"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1L7 3H3L8 14L13 3H9L8 1Z" fill="currentColor"/></svg></span></span> Test existing HVAC capacity for restaurant use</div>
							<div class="res-detail"><span class="res-icon"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1L7 3H3L8 14L13 3H9L8 1Z" fill="currentColor"/></svg></span></span> Design grease trap and exhaust system</div>
							<div class="res-cost">Est. $8-15K for engineering plans</div>
						</div>
						<div class="res-card">
							<div class="res-role">⚖️ Commercial Lease Attorney</div>
							<div class="res-why">You need someone who negotiates NYC restaurant leases daily — this is not a DIY situation. They'll earn back their fee in the first negotiation round.</div>
							<div class="res-detail"><span class="res-icon"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1L7 3H3L8 14L13 3H9L8 1Z" fill="currentColor"/></svg></span></span> NYC commercial lease specialist</div>
							<div class="res-detail"><span class="res-icon"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1L7 3H3L8 14L13 3H9L8 1Z" fill="currentColor"/></svg></span></span> Can negotiate TI allowance and violation remediation clauses</div>
							<div class="res-cost">Est. $3-5K for lease review + negotiation</div>
						</div>
						<div class="res-card">
							<div class="res-role"><span class="icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="display:inline;margin-right:4px;vertical-align:text-bottom"><path d="M9 2L4 9h4l-1 5 5-7h-4l1-5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>Fire Suppression / Ansul Installer</div>
							<div class="res-why">Required for any commercial kitchen. NYC fire dept will not issue your C of O without an approved hood suppression system.</div>
							<div class="res-detail"><span class="res-icon"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1L7 3H3L8 14L13 3H9L8 1Z" fill="currentColor"/></svg></span></span> Must be FDNY-certified installer</div>
							<div class="res-detail"><span class="res-icon"><span class="icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1L7 3H3L8 14L13 3H9L8 1Z" fill="currentColor"/></svg></span></span> Order early — 4-6 week lead time</div>
							<div class="res-cost">Est. $8-12K installed</div>
						</div>
					</div>
				</div>

				<div class="card">
					<div class="card-header-row">
						<div class="card-icon" style="background: rgba(251,191,36,.1);"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 6h6M5 9h6M5 12h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span></div>
						<div>
							<div class="card-title">Recommended (But Not Blocking)</div>
							<div class="card-subtitle">Engage during Phase 2-3</div>
						</div>
					</div>
					<div class="res-grid">
						<div class="res-card">
							<div class="res-role">🏢 DOB Expediter</div>
							<div class="res-why">NYC permit processing averages 6-8 weeks. An expediter can cut this to 3-4 weeks and navigate the bureaucracy for you.</div>
							<div class="res-cost">Est. $2-4K per filing</div>
						</div>
						<div class="res-card">
							<div class="res-role">🧪 Environmental Consultant</div>
							<div class="res-why">If the building is pre-1978, you may need asbestos/lead testing before demo. Better to test early than discover mid-build.</div>
							<div class="res-cost">Est. $1.5-3K for testing + report</div>
						</div>
						<div class="res-card">
							<div class="res-role">📐 Kitchen Design Consultant</div>
							<div class="res-why">Every inch matters in a restaurant kitchen. A specialized designer optimizes flow for volume — prep, line, and dish in minimal footprint.</div>
							<div class="res-cost">Est. $3-6K for layout + equipment spec</div>
						</div>
						<div class="res-card">
							<div class="res-role"><span class="icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="display:inline;margin-right:4px;vertical-align:text-bottom"><rect x="1" y="8" width="3" height="7" rx="1" fill="currentColor"/><rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor"/><rect x="11" y="2" width="3" height="13" rx="1" fill="currentColor"/></svg></span>Accountant (Restaurant CPA)</div>
							<div class="res-why">Financial projections for your lease application, entity structure, and tax planning. A restaurant-focused CPA pays for itself in year one.</div>
							<div class="res-cost">Est. $3-5K/year ongoing</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}

	<PageNav
		backHref="/app/location"
		backLabel="Your Score"
		nextHref="/app/space"
		nextLabel="Space IQ"
	/>
</div>

<NavigationDrawer currentPath={$page.url.pathname} />

<style>
	/* ──── BASE ──── */
	.rec-page {
		background: var(--bg);
		min-height: 100vh;
		padding: 1.5rem 1rem 4rem;
		max-width: 900px;
		margin: 0 auto;
	}

	.loading-state {
		text-align: center;
		padding: 4rem 2rem;
		color: var(--text-secondary);
		font-size: 14px;
	}

	.empty-page {
		text-align: center;
		padding: 4rem 2rem;
		max-width: 420px;
		margin: 0 auto;
	}
	.empty-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}
	.empty-page h2 {
		font-size: 20px;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 8px 0;
	}
	.empty-page p {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0 0 20px 0;
	}
	.empty-page a {
		color: var(--accent);
		text-decoration: none;
		font-weight: 500;
	}
	.empty-cta {
		display: inline-block;
		padding: 10px 24px;
		background: var(--accent);
		color: #fff !important;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 500;
		text-decoration: none !important;
		transition: background 0.15s ease;
	}
	.empty-cta:hover {
		background: #a64d00;
	}

	/* ──── HERO SECTION ──── */
	.hero-section {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 24px;
		align-items: start;
		margin-bottom: 20px;
	}

	.hero-left {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.hero-address {
		font-size: 24px;
		font-weight: 700;
		line-height: 1.2;
		color: var(--text);
		margin: 0;
	}

	.hero-concept {
		font-size: 13px;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.hero-insight {
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
		font-style: italic;
	}

	.hero-scores {
		display: flex;
		gap: 16px;
		align-items: center;
	}

	.hero-score {
		text-align: center;
	}

	.hero-ring {
		width: 60px;
		height: 60px;
		position: relative;
	}

	.hero-ring svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.hero-ring-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-secondary);
		margin-top: 4px;
		font-weight: 600;
	}

	/* BR-UX-10: grade pill + meaning line (canonical A/B/C/D/F palette) */
	.hero-grade-pill {
		display: inline-block;
		margin-top: 6px;
		padding: 3px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
		white-space: nowrap;
	}
	.hero-grade-pill.grade-a { background: #d1fae5; color: #065f46; }
	.hero-grade-pill.grade-b { background: #e0f2fe; color: #075985; }
	.hero-grade-pill.grade-c { background: #fef3c7; color: #92400e; }
	.hero-grade-pill.grade-d { background: #ffedd5; color: #9a3412; }
	.hero-grade-pill.grade-f { background: #fee2e2; color: #991b1b; }
	.hero-meaning-line {
		margin-top: 12px;
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-secondary);
		max-width: 560px;
	}
	.hero-nexttier-line {
		margin-top: 4px;
		font-size: 12px;
		color: var(--text-secondary);
	}
	.hero-nexttier-line strong { color: var(--text-primary); }

	/* ──── LOCATION HEADER ──── */
	.loc-header {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 24px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--border);
	}

	.loc-back {
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 13px;
		font-weight: 500;
		padding: 6px;
		border-radius: 6px;
		transition: all .15s;
	}

	.loc-back:hover {
		color: var(--accent);
		background: var(--accent-light);
	}

	.loc-info h1 {
		font-size: 20px;
		font-weight: 700;
		line-height: 1.2;
		color: var(--text);
		margin: 0;
	}

	.loc-meta {
		font-size: 12px;
		color: var(--text-secondary);
		margin-top: 3px;
	}

	.loc-scores {
		margin-left: auto;
		display: flex;
		gap: 14px;
		align-items: center;
	}

	.mini-score {
		text-align: center;
	}

	.ring-mini {
		width: 52px;
		height: 52px;
		position: relative;
	}

	.ring-mini svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.ring-bg {
		fill: none;
		stroke: var(--border);
		stroke-width: 5;
	}

	.ring-fill {
		fill: none;
		stroke-width: 5;
		stroke-linecap: round;
		transition: stroke-dasharray 0.6s ease;
	}

	.ring-num {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-size: 15px;
		font-weight: 800;
		color: var(--text);
	}

	.ring-label {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: .5px;
		color: var(--text-secondary);
		margin-top: 3px;
		font-weight: 600;
	}

	/* ──── TAB NAV ──── */
	.tab-nav {
		display: flex;
		gap: 4px;
		margin-bottom: 24px;
		background: var(--surface);
		border-radius: 10px;
		padding: 4px;
		border: 1px solid var(--border);
		overflow-x: auto;
	}

	.tab-btn {
		flex: 1;
		padding: 10px 8px;
		text-align: center;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all .2s;
		letter-spacing: .3px;
		white-space: nowrap;
	}

	.tab-btn:hover {
		color: var(--text);
	}

	.tab-btn.active {
		color: var(--accent);
		background: var(--accent-light);
	}

	/* ──── TAB PANEL ──── */
	.tab-panel {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	/* ──── SHARED CARD ──── */
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 20px;
		transition: border-color .2s;
	}

	.card:hover {
		border-color: var(--border-hover);
		box-shadow: var(--shadow);
	}

	.card-header-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 14px;
	}

	.card-icon {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		flex-shrink: 0;
	}

	.card-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
	}

	.card-subtitle {
		font-size: 11px;
		color: var(--text-secondary);
		margin-top: 2px;
	}

	.section-note {
		font-size: 12px;
		color: var(--text-secondary);
		margin-bottom: 4px;
		line-height: 1.5;
		padding-left: 2px;
	}

	.empty-state {
		text-align: center;
		color: var(--text-tertiary);
		font-size: 13px;
		padding: 2rem 1rem;
	}

	/* ──── SCORE BREAKDOWN ──── */
	.breakdown-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		grid-auto-rows: 1fr;
	}

	.sub-card {
		background: var(--surface-elevated);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 14px;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.sub-card:hover {
		border-color: var(--border-hover);
		box-shadow: var(--shadow);
	}

	.sub-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	.sub-name {
		font-size: 12px;
		font-weight: 600;
		flex: 1;
		color: var(--text);
	}

	.sub-score {
		font-size: 16px;
		font-weight: 800;
	}

	.sub-bar {
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 6px;
	}

	.sub-bar-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.4s ease;
	}

	.factor-title {
		font-size: 11px;
		font-weight: 700;
		color: var(--text);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 8px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--border);
	}

	.sub-detail {
		font-size: 11px;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.sub-weight {
		font-size: 9px;
		color: var(--text-tertiary);
		margin-top: 4px;
	}

	.hero-insight-box {
		padding: 12px 14px;
		background: rgba(0, 232, 204, 0.06);
		border: 1px solid rgba(0, 232, 204, 0.12);
		border-radius: 8px;
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
		margin-bottom: 12px;
	}

	.hero-insight-box strong {
		color: var(--text);
		font-weight: 600;
	}

	.gap-note {
		margin-top: 12px;
		padding: 10px 14px;
		background: rgba(124, 58, 237, 0.06);
		border: 1px solid rgba(124, 58, 237, 0.1);
		border-radius: 8px;
		font-size: 12px;
		color: var(--purple);
	}

	/* ──── RISK CARDS ──── */
	.risk-item {
		display: flex;
		gap: 12px;
		padding: 12px 0;
		border-bottom: 1px solid var(--border);
	}

	.risk-item:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.risk-severity {
		width: 6px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.risk-severity.high { background: var(--danger); }
	.risk-severity.med { background: var(--warning); }
	.risk-severity.low { background: var(--success); }

	.risk-body h4 {
		font-size: 13px;
		font-weight: 600;
		margin: 0 0 3px;
		color: var(--text);
	}

	.risk-body p {
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.risk-tag {
		font-size: 9px;
		display: inline-block;
		padding: 2px 7px;
		border-radius: 4px;
		font-weight: 600;
		margin-top: 6px;
	}

	.risk-tag.high { background: rgba(255, 59, 48, 0.08); color: var(--danger); }
	.risk-tag.med { background: rgba(255, 149, 0, 0.08); color: var(--warning); }
	.risk-tag.low { background: rgba(52, 199, 89, 0.08); color: var(--success); }

	/* ──── NEGOTIATION ──── */
	.neg-step {
		display: flex;
		gap: 14px;
		padding: 14px 0;
		border-bottom: 1px solid var(--border);
	}

	.neg-step:last-child {
		border-bottom: none;
	}

	.neg-num {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--accent-light);
		color: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 800;
		flex-shrink: 0;
	}

	.neg-body h4 {
		font-size: 13px;
		font-weight: 600;
		margin: 0 0 4px;
		color: var(--text);
	}

	.neg-body p {
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.neg-tip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-top: 8px;
		padding: 5px 10px;
		background: var(--accent-light);
		border: 1px solid rgba(180, 83, 9, 0.12);
		border-radius: 6px;
		font-size: 11px;
		color: var(--accent);
		font-weight: 600;
	}

	/* ──── ALTERNATIVE LOCATIONS ──── */
	.alt-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 12px;
	}

	.alt-card {
		background: var(--surface-elevated);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px;
		transition: all .2s;
	}

	.alt-card:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
		box-shadow: var(--shadow);
	}

	.alt-hood {
		font-size: 14px;
		font-weight: 700;
		margin-bottom: 10px;
		color: var(--text);
	}

	.alt-scores {
		display: flex;
		gap: 12px;
		margin-bottom: 10px;
	}

	.alt-score {
		flex: 1;
		text-align: center;
		padding: 8px 4px;
		background: var(--surface);
		border-radius: 8px;
	}

	.alt-score .val {
		font-size: 18px;
		font-weight: 800;
		display: block;
	}

	.alt-score .lbl {
		font-size: 9px;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: .5px;
	}

	.alt-rent {
		font-size: 11px;
		color: var(--text-secondary);
		margin-bottom: 6px;
		font-weight: 600;
	}

	.alt-why {
		font-size: 11px;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.alt-badge {
		display: inline-block;
		font-size: 9px;
		padding: 2px 7px;
		border-radius: 4px;
		font-weight: 600;
		margin-top: 6px;
	}

	.alt-badge.better { background: rgba(52, 199, 89, 0.08); color: var(--success); }
	.alt-badge.tradeoff { background: rgba(255, 149, 0, 0.08); color: var(--warning); }

	.inline-link {
		color: var(--accent);
		text-decoration: none;
		font-weight: 600;
	}

	.inline-link:hover {
		text-decoration: underline;
	}

	/* ──── EXECUTION TIMELINE ──── */
	.exec-timeline {
		position: relative;
		padding-left: 24px;
	}

	.exec-timeline::before {
		content: '';
		position: absolute;
		left: 7px;
		top: 8px;
		bottom: 8px;
		width: 2px;
		background: var(--border);
	}

	.exec-phase {
		position: relative;
		padding: 12px 0 16px;
	}

	.exec-phase::before {
		content: '';
		position: absolute;
		left: -21px;
		top: 16px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid;
		background: var(--bg);
	}

	.exec-phase.phase-1::before { border-color: var(--accent); }
	.exec-phase.phase-2::before { border-color: #3B82F6; }
	.exec-phase.phase-3::before { border-color: var(--purple); }
	.exec-phase.phase-4::before { border-color: var(--success); }

	.exec-phase h4 {
		font-size: 13px;
		font-weight: 700;
		margin: 0 0 2px;
	}

	.exec-phase .phase-time {
		font-size: 10px;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: .5px;
		margin-bottom: 6px;
	}

	.exec-phase p {
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0 0 8px;
	}

	.exec-checklist {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.exec-checklist li {
		font-size: 12px;
		color: var(--text-secondary);
		padding: 3px 0;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.exec-checklist li::before {
		content: '☐';
		color: var(--border);
		font-size: 13px;
	}

	/* ──── RESOURCES ──── */
	.res-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.res-card {
		background: var(--surface-elevated);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px;
	}

	.res-card:hover {
		border-color: var(--border-hover);
		box-shadow: var(--shadow);
	}

	.res-role {
		font-size: 13px;
		font-weight: 700;
		margin-bottom: 3px;
		color: var(--text);
	}

	.res-why {
		font-size: 11px;
		color: var(--text-secondary);
		line-height: 1.4;
		margin-bottom: 8px;
	}

	.res-detail {
		font-size: 11px;
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		gap: 5px;
		margin-bottom: 3px;
	}

	.res-icon {
		font-size: 14px;
	}

	.res-cost {
		display: inline-block;
		font-size: 10px;
		padding: 3px 8px;
		border-radius: 5px;
		background: var(--accent-light);
		color: var(--accent);
		font-weight: 600;
		margin-top: 6px;
	}

	/* ──── COLOR UTILITIES ──── */
	.cyan { color: var(--accent); }
	.green { color: var(--success); }
	.yellow { color: var(--warning); }
	.blue { color: var(--accent); }
	.purple { color: var(--purple); }
	.purple-text { color: var(--purple); }

	/* ──── RESPONSIVE ──── */
	@media (max-width: 768px) {
		.loc-header {
			flex-wrap: wrap;
		}

		.loc-scores {
			margin-left: 0;
			width: 100%;
			justify-content: flex-start;
			padding-top: 12px;
		}

		.loc-info h1 {
			font-size: 16px;
		}

		.tab-nav {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.tab-btn {
			font-size: 11px;
			padding: 8px 6px;
		}

		.breakdown-grid {
			grid-template-columns: 1fr;
		}

		.res-grid {
			grid-template-columns: 1fr;
		}

		.alt-grid {
			grid-template-columns: 1fr;
		}

		.rec-page {
			padding: 1rem 0.75rem 3rem;
		}
	}
</style>
