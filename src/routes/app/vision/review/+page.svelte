<script lang="ts">
	import { onMount } from 'svelte';
	import { loadLaunchPadData } from '$lib/launchpad-store';
	import type { LaunchPadData, FounderProfile } from '$lib/launchpad-store';

	let lpData = $state<LaunchPadData | null>(null);
	let mounted = $state(false);

	onMount(() => {
		mounted = true;
		lpData = loadLaunchPadData();
	});

	const fp = $derived(lpData?.founderProfile || {} as Partial<FounderProfile>);
	const fg = $derived(lpData?.financialGoals || {} as Partial<LaunchPadData['financialGoals']>);
	const weights = $derived(lpData?.weights || {} as Record<string, number>);

	function fmt(n: number | string | undefined | null): string {
		if (!n && n !== 0) return '—';
		return '$' + Number(n).toLocaleString();
	}

	function label(key: string | undefined, map: Record<string, string>): string {
		return (key && map[key]) || key || '—';
	}

	const motivationMap = { legacy: 'Build a Legacy', passion: 'Follow a Passion', sideincome: 'Side Income', investment: 'Investment', community: 'Community Impact' };
	const ownerMap = { fulltime: 'Full-Time Owner-Operator', parttime: 'Part-Time Owner', absentee: 'Absentee Owner', partnership: 'Partnership' };
	const riskMap = { conservative: 'Conservative', moderate: 'Moderate', aggressive: 'Aggressive' };
	const expMap = { firsttime: 'First-Time Founder', 'other-industry': 'Experience in Other Industry', experienced: 'Experienced Operator', serial: 'Serial Entrepreneur' };
	const formatMap = { kiosk: 'Kiosk / Cart', cafe: 'Café', 'fast-casual': 'Fast Casual', 'full-service': 'Full Service', 'ghost-kitchen': 'Ghost Kitchen', 'food-truck': 'Food Truck' };

	interface ReviewItem {
		label: string;
		value: string | number;
		long?: boolean;
	}

	interface ReviewSection {
		title: string;
		icon: string;
		href: string;
		complete: boolean;
		items: ReviewItem[];
	}

	const sections = $derived.by((): ReviewSection[] => {
		if (!lpData) return [];
		return [
			{
				title: 'Founder Profile',
				icon: '👤',
				href: '/app/vision/founder',
				complete: !!(fp.ownerType || fp.experience),
				items: [
					{ label: 'Motivation', value: label(fp.motivation, motivationMap) },
					{ label: 'Owner Type', value: label(fp.ownerType, ownerMap) },
					{ label: 'Risk Tolerance', value: label(fp.riskTolerance, riskMap) },
					{ label: 'Experience', value: label(fp.experience, expMap) },
					{ label: 'Year 1 Revenue Target', value: fmt(fp.yearOneGoals?.revenueTarget) },
					{ label: 'Personal Income Target', value: fmt(fp.yearOneGoals?.personalIncomeTarget) },
					{ label: 'Team Size', value: fp.yearOneGoals?.employeeCount || '—' },
				]
			},
			{
				title: 'Business Concept',
				icon: '💡',
				href: '/app/vision/concept',
				complete: !!(lpData.businessType || lpData.businessName),
				items: [
					{ label: 'Business Type', value: lpData.businessType || '—' },
					{ label: 'Business Name', value: lpData.businessName || '—' },
					{ label: 'Format', value: label(lpData.businessFormat, formatMap) },
					{ label: 'Vision Statement', value: lpData.visionStatement || '—', long: true },
					{ label: 'Differentiator', value: lpData.differentiator || '—', long: true },
				]
			},
			{
				title: 'Financial Goals',
				icon: '💰',
				href: '/app/vision/financial',
				complete: !!((fg.liquidCapital ?? 0) > 0 || (fg.startupCapital ?? 0) > 0),
				items: [
					{ label: 'Startup Capital', value: fmt(fg.startupCapital) },
					{ label: 'Personal Investment', value: fmt(fg.personalInvestment) },
					{ label: 'Liquid Capital', value: fmt(fg.liquidCapital) },
					{ label: 'External Funding', value: fmt(fg.externalFunding) },
					{ label: 'Monthly Rent Budget', value: fmt(fg.monthlyRentBudget) },
					{ label: 'Buildout Budget', value: fmt(fg.buildoutBudget) },
					{ label: 'Owner\'s Take-Home', value: fmt(fg.targetSDE) },
					{ label: 'Avg Ticket', value: fmt(fg.avgTicket) },
					{ label: 'Daily Transactions', value: fg.dailyTransactions || '—' },
					{ label: 'Square Footage', value: fg.squareFootage ? fg.squareFootage + ' sq ft' : '—' },
				]
			},
			{
				title: 'Engine Calibration',
				icon: '⚙️',
				href: '/app/vision/calibration',
				complete: Object.keys(weights).length > 0,
				items: Object.entries(weights).length > 0
					? Object.entries(weights).map(([k, v]) => ({ label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value: v + '%' }))
					: [{ label: 'Status', value: 'Not yet calibrated' }]
			}
		];
	});

	const completedCount = $derived(sections.filter(s => s.complete).length);
	const readiness = $derived(Math.round((completedCount / Math.max(1, sections.length)) * 100));
</script>

<svelte:head>
	<title>RE² — Concept Review</title>
</svelte:head>

<div class="page">
	<div class="page-header">
		<h1>Concept Review</h1>
		<p class="page-subtitle">Summary of your inputs across the concept builder</p>
	</div>

	{#if !mounted || !lpData}
		<div class="loading">Loading your concept data...</div>
	{:else}
		<!-- Readiness Bar -->
		<div class="readiness">
			<div class="readiness-header">
				<span class="readiness-label">Concept Completeness</span>
				<span class="readiness-score" style="color: {readiness >= 75 ? '#34C759' : readiness >= 50 ? '#FF9500' : '#FF3B30'}">{readiness}%</span>
			</div>
			<div class="readiness-bar">
				<div class="readiness-fill" style="width: {readiness}%; background: {readiness >= 75 ? '#34C759' : readiness >= 50 ? '#FF9500' : '#FF3B30'}"></div>
			</div>
			<div class="readiness-steps">
				{#each sections as sec}
					<span class="readiness-step" class:done={sec.complete}>
						{sec.complete ? '✓' : '○'} {sec.title}
					</span>
				{/each}
			</div>
		</div>

		<!-- Section Cards -->
		{#each sections as sec}
			<section class="review-section">
				<div class="section-header">
					<div class="section-title-row">
						<span class="section-icon">{sec.icon}</span>
						<h2>{sec.title}</h2>
						{#if sec.complete}
							<span class="complete-badge">Complete</span>
						{:else}
							<span class="incomplete-badge">Incomplete</span>
						{/if}
					</div>
					<a href={sec.href} class="edit-link">Edit →</a>
				</div>
				<div class="items-grid">
					{#each sec.items as item}
						{#if item.long}
							<div class="item full-width">
								<span class="item-label">{item.label}</span>
								<span class="item-value long-text">{item.value}</span>
							</div>
						{:else}
							<div class="item">
								<span class="item-label">{item.label}</span>
								<span class="item-value">{item.value}</span>
							</div>
						{/if}
					{/each}
				</div>
			</section>
		{/each}

		<!-- CTA -->
		<div class="cta-section">
			{#if readiness >= 75}
				<p class="cta-message">Your concept is well-defined. Ready to scout locations.</p>
				<a href="/app/location" class="cta-button">Continue to your score →</a>
			{:else}
				<p class="cta-message">Complete more sections to strengthen your analysis accuracy.</p>
				<a href={sections.find(s => !s.complete)?.href || '/app/vision/founder'} class="cta-button secondary">Complete Next Section →</a>
			{/if}
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		background-color: var(--bg);
		color: var(--text);
		font-family: system-ui, -apple-system, sans-serif;
	}
	.page-header { margin-bottom: 2rem; }
	.page-header h1 { font-size: 28px; font-weight: 700; color: var(--text); margin: 0 0 0.5rem 0; }
	.page-subtitle { color: var(--text-secondary); font-size: 14px; margin: 0; }
	.loading { text-align: center; padding: 3rem; color: var(--text-tertiary); }

	/* Readiness */
	.readiness {
		background: var(--surface-alt);
		border-radius: 12px;
		padding: 1.25rem;
		margin-bottom: 2rem;
		border: 1px solid var(--border);
	}
	.readiness-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}
	.readiness-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
	.readiness-score { font-size: 22px; font-weight: 800; }
	.readiness-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
	.readiness-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
	.readiness-steps { display: flex; gap: 16px; flex-wrap: wrap; }
	.readiness-step { font-size: 11px; color: var(--text-tertiary); }
	.readiness-step.done { color: var(--success); }

	/* Sections */
	.review-section {
		background: var(--surface);
		border-radius: 12px;
		padding: 1.25rem;
		margin-bottom: 1rem;
		border: 1px solid var(--border);
	}
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--border);
	}
	.section-title-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.section-icon { font-size: 18px; }
	.section-header h2 { font-size: 16px; font-weight: 700; color: var(--text); margin: 0; }
	.complete-badge {
		font-size: 10px;
		font-weight: 700;
		color: var(--success);
		background: var(--green-soft);
		padding: 2px 8px;
		border-radius: 10px;
		text-transform: uppercase;
	}
	.incomplete-badge {
		font-size: 10px;
		font-weight: 700;
		color: var(--danger);
		background: var(--red-soft);
		padding: 2px 8px;
		border-radius: 10px;
		text-transform: uppercase;
	}
	.edit-link {
		font-size: 12px;
		color: var(--accent);
		text-decoration: none;
		font-weight: 600;
	}
	.edit-link:hover { text-decoration: underline; }

	/* Items Grid */
	.items-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		background: var(--surface-alt);
		border-radius: 8px;
	}
	.item.full-width { grid-column: 1 / -1; }
	.item-label { font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }
	.item-value { font-size: 14px; color: var(--text); font-weight: 500; }
	.item-value.long-text { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }

	/* CTA */
	.cta-section {
		text-align: center;
		padding: 2rem 0 1rem;
	}
	.cta-message { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; }
	.cta-button {
		display: inline-block;
		padding: 12px 28px;
		background: var(--success);
		color: #fff;
		font-weight: 700;
		font-size: 14px;
		border-radius: 8px;
		text-decoration: none;
		transition: transform 0.2s, box-shadow 0.2s;
	}
	.cta-button:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(5, 150, 105, 0.3); }
	.cta-button.secondary {
		background: var(--border);
		color: var(--text);
	}
	.cta-button.secondary:hover { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); }

	@media (max-width: 600px) {
		.items-grid { grid-template-columns: 1fr; }
		.readiness-steps { flex-direction: column; gap: 6px; }
	}
</style>
