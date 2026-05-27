<script>
	import { onMount } from 'svelte';
	import { loadLaunchPadData, saveLaunchPadData } from '$lib/launchpad-store';
	import DisclaimerBanner from '$lib/components/DisclaimerBanner.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import PageNav from '$lib/components/PageNav.svelte';

	const loanTabs = [
		{ id: 'readiness', label: 'Loan Readiness' },
		{ id: 'profile', label: 'Your Profile' },
		{ id: 'lenders', label: 'Matched Lenders' },
		{ id: 'grants', label: 'Grants & Programs' },
		{ id: 'documents', label: 'Documents' }
	];

	let businessStage = $state('Pre-Revenue');
	let minorityOwned = $state(false);
	let womenOwned = $state(false);
	let veteranOwned = $state(false);
	let loanAmount = $state(350000);
	let documentMode = $state('quick');
	let generatedDoc = $state(null);

	let activeTab = $state('readiness');

	// Capital Structure state
	let capitalSources = $state({
		personalSavings: 50000,
		familyFriends: 0,
		sbaLoan: 250000,
		altLending: 0,
		investorEquity: 0,
		grants: 0
	});

	let lpData = $state(null);
	let businessDescription = $state('');
	let creditScore = $state(700);
	let creditTier = $state('Good');
	let rateAdjustment = $state(0);
	let sessionLocationIQ = $state(0);

	onMount(() => {
		lpData = loadLaunchPadData();
		if (lpData && lpData.financialGoals) {
			capitalSources.personalSavings = lpData.financialGoals.personalInvestment || 50000;
			// Extract credit score if available
			if (lpData.financialGoals.creditScore) {
				creditScore = lpData.financialGoals.creditScore;
			}
		}
		if (lpData?.businessProfile?.businessDescription) {
			businessDescription = lpData.businessProfile.businessDescription;
		}
		// Read Location IQ score from re2_session (single source of truth)
		try {
			const sessionRaw = localStorage.getItem('re2_session');
			if (sessionRaw) {
				const session = JSON.parse(sessionRaw);
				if (typeof session.locationIQ === 'number' && session.locationIQ > 0) {
					sessionLocationIQ = session.locationIQ;
				}
			}
		} catch {}
		// Calculate credit tier and rate adjustment
		updateCreditTier();
	});

	function updateCreditTier() {
		if (creditScore >= 750) {
			creditTier = 'Excellent';
			rateAdjustment = 0;
		} else if (creditScore >= 700) {
			creditTier = 'Good';
			rateAdjustment = 0.5;
		} else if (creditScore >= 650) {
			creditTier = 'Fair';
			rateAdjustment = 1.5;
		} else {
			creditTier = 'Poor';
			rateAdjustment = 3;
		}
	}

	function saveDescription() {
		saveLaunchPadData({ businessProfile: { ...lpData?.businessProfile, businessDescription } });
	}

	let totalProjectCost = $derived(
		Object.values(useOfFunds).reduce((sum, v) => sum + v, 0)
	);

	let totalCapitalSources = $derived(
		Object.values(capitalSources).reduce((sum, v) => sum + v, 0)
	);

	let capitalGap = $derived(totalProjectCost - totalCapitalSources);
	let personalEquityPct = $derived(
		totalProjectCost > 0 ? (capitalSources.personalSavings / totalProjectCost) * 100 : 0
	);
	let expandedSections = $state({
		readiness: true,
		profile: false,
		lenders: false,
		grants: false,
		letter: false,
		generator: false,
		capital: false
	});

	let profileTab = $state('info'); // 'info' or 'capital'

	let useOfFunds = $state({
		leasehold: 120000,
		equipment: 85000,
		inventory: 25000,
		workingCapital: 70000,
		marketing: 30000,
		deposits: 20000
	});

	const preRevenueLendersBase = [
		{
			name: 'Huntington Bank',
			programs: 'SBA 7(a), SBA Express',
			maxLoan: '$5M',
			baseRate: 8.5,
			features: 'No PG required under $100K, fast approval',
			match: 'Excellent',
			minCredit: 650
		},
		{
			name: 'Live Oak Bank',
			programs: 'SBA 7(a), CRE',
			maxLoan: '$5M',
			baseRate: 8.25,
			features: 'SBA specialist, expert in F&B lending',
			match: 'Excellent',
			minCredit: 650
		},
		{
			name: 'Celtic Bank',
			programs: 'SBA 7(a), Equipment',
			maxLoan: '$2M',
			baseRate: 9,
			features: 'Equipment financing strength',
			match: 'Good',
			minCredit: 600
		},
		{
			name: 'Pursuit Lending',
			programs: 'SBA 7(a)',
			maxLoan: '$350K',
			baseRate: 9.25,
			features: 'Minority/women-owned focus',
			match: 'Excellent',
			minCredit: 600
		},
		{
			name: 'Accion',
			programs: 'Microloan, SBA 7(a)',
			maxLoan: '$50K–$350K',
			baseRate: 10.75,
			features: 'Technical assistance included',
			match: 'Good',
			minCredit: 550
		}
	];

	const preRevenueLenders = $derived.by(() => {
		return preRevenueLendersBase
			.filter(lender => creditScore >= lender.minCredit)
			.map(lender => ({
				...lender,
				rate: (lender.baseRate + rateAdjustment).toFixed(2) + '%',
				rateRange: `${(lender.baseRate + rateAdjustment).toFixed(2)}-${(lender.baseRate + rateAdjustment + 2).toFixed(2)}%`
			}));
	});

	const postRevenueLendersBase = [
		{
			name: 'Chase',
			programs: 'SBA 7(a), Lines of Credit',
			maxLoan: '$5M+',
			baseRate: 7.5,
			features: 'Fastest approval, relationship-based',
			match: 'Good',
			minCredit: 700
		},
		{
			name: 'TD Bank',
			programs: 'SBA 7(a), CRE',
			maxLoan: '$5M',
			baseRate: 8,
			features: 'Strong in Northeast, community focus',
			match: 'Excellent',
			minCredit: 680
		},
		{
			name: 'Wells Fargo',
			programs: 'SBA 7(a), Small Business',
			maxLoan: '$5M',
			baseRate: 7.75,
			features: 'Established business comfort',
			match: 'Good',
			minCredit: 700
		}
	];

	const postRevenueLenders = $derived.by(() => {
		return postRevenueLendersBase
			.filter(lender => creditScore >= lender.minCredit)
			.map(lender => ({
				...lender,
				rate: (lender.baseRate + rateAdjustment).toFixed(2) + '%',
				rateRange: `${(lender.baseRate + rateAdjustment).toFixed(2)}-${(lender.baseRate + rateAdjustment + 1.5).toFixed(2)}%`
			}));
	});

	const grantPrograms = [
		{
			name: 'NYC SBS Grant',
			eligibility: 'NYC-based, minority or women-owned',
			amount: '$5K–$50K',
			url: '#'
		},
		{
			name: 'FedEx Small Business',
			eligibility: 'All eligible businesses',
			amount: '$4,500–$50K',
			url: '#'
		},
		{
			name: 'Hello Alice',
			eligibility: 'Underrepresented founders',
			amount: '$1K–$15K',
			url: '#'
		},
		{
			name: 'Kiva Loans',
			eligibility: 'All eligible businesses',
			amount: '$500–$15K',
			url: '#'
		},
		{
			name: 'LISC Community Fund',
			eligibility: 'Community-focused businesses',
			amount: '$5K–$100K',
			url: '#'
		}
	];

	const totalFunds = Object.values(useOfFunds).reduce((a, b) => a + b, 0);

	function generateDocument() {
		if (documentMode === 'quick') {
			generatedDoc = {
				title: 'Quick Summary',
				content: `LOAN APPLICATION SUMMARY

Loan Amount: $${loanAmount.toLocaleString()}
Use of Funds:
- Leasehold Improvements: $${useOfFunds.leasehold.toLocaleString()}
- Equipment: $${useOfFunds.equipment.toLocaleString()}
- Inventory: $${useOfFunds.inventory.toLocaleString()}
- Working Capital: $${useOfFunds.workingCapital.toLocaleString()}
- Marketing: $${useOfFunds.marketing.toLocaleString()}
- Deposits: $${useOfFunds.deposits.toLocaleString()}

TOTAL: $${totalFunds.toLocaleString()}

Business Profile:
- Stage: ${businessStage}
- Minority-Owned: ${minorityOwned ? 'Yes' : 'No'}
- Women-Owned: ${womenOwned ? 'Yes' : 'No'}
- Veteran-Owned: ${veteranOwned ? 'Yes' : 'No'}

Recommended Lenders:
${(businessStage === 'Pre-Revenue' ? preRevenueLenders : postRevenueLenders)
	.slice(0, 3)
	.map((l) => `- ${l.name}: ${l.features}`)
	.join('\n')}

Bank Routing: 021000021 (Chase)

Next Steps:
1. Complete SBA Form 1919
2. Prepare business plan & financial projections
3. Gather personal financial statements
4. Submit application to selected lender`
			};
		} else {
			generatedDoc = {
				title: 'Full SBA Narrative',
				content: `SBA BUSINESS LOAN APPLICATION - FULL NARRATIVE

EXECUTIVE SUMMARY
This application requests $${loanAmount.toLocaleString()} in SBA 7(a) financing for your business at the ${businessStage} stage. Review your Location Intelligence analysis and financial projections below.

BUSINESS DESCRIPTION
${lpData?.businessProfile?.businessName || 'Your Business'}${businessDescription ? `\n\n${businessDescription}` : ''}

USE OF FUNDS
- Leasehold Improvements: $${useOfFunds.leasehold.toLocaleString()}
- Equipment & POS: $${useOfFunds.equipment.toLocaleString()}
- Inventory & Supplies: $${useOfFunds.inventory.toLocaleString()}
- Working Capital: $${useOfFunds.workingCapital.toLocaleString()}
- Marketing & Launch: $${useOfFunds.marketing.toLocaleString()}
- Deposits & Contingency: $${useOfFunds.deposits.toLocaleString()}

TOTAL: $${totalFunds.toLocaleString()}

MARKET ANALYSIS
Location: ${lpData?.locationIntelligence?.address || 'Add your location'} | Location score: ${sessionLocationIQ > 0 ? sessionLocationIQ + '/100' : 'Pending'}
- Add your location-specific market insights
- Competitive landscape analysis
- Target demographic strengths
- Accessibility & traffic patterns

FINANCIAL PROJECTIONS
- Year 1 Revenue: ${lpData?.financialGoals?.year1Revenue ? `$${lpData.financialGoals.year1Revenue.toLocaleString()}` : 'Add your projection'}
- Year 3 Revenue: ${lpData?.financialGoals?.year3Revenue ? `$${lpData.financialGoals.year3Revenue.toLocaleString()}` : 'Add your projection'}
- Owner's Take-Home: ${lpData?.financialGoals?.targetSDE ? `$${lpData.financialGoals.targetSDE.toLocaleString()}` : 'Add your projection'}

DEBT SERVICE
Review your monthly loan payments and debt service coverage ratio based on your financial projections.

Owner Demographics: ${[
	minorityOwned ? 'Minority-owned' : '',
	womenOwned ? 'Women-owned' : '',
	veteranOwned ? 'Veteran-owned' : ''
]
	.filter(Boolean)
	.join(', ') || 'Not specified'}

Credit Score: ${creditScore} (${creditTier})

Next Steps: Complete all required documentation and submit to matched lender.`
			};
		}
	}

	function copyToClipboard() {
		if (generatedDoc) {
			navigator.clipboard.writeText(generatedDoc.content);
		}
	}

	function downloadDoc() {
		if (generatedDoc) {
			const element = document.createElement('a');
			element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(generatedDoc.content));
			element.setAttribute('download', `Loan_Package_${businessStage}.txt`);
			element.style.display = 'none';
			document.body.appendChild(element);
			element.click();
			document.body.removeChild(element);
		}
	}

	const displayLenders = businessStage === 'Pre-Revenue' ? preRevenueLenders : postRevenueLenders;

	// Calculate readiness metrics for hero section
	const readinessPercentage = $derived(68); // Hardcoded as per current state
	const pendingDocuments = $derived([
		'Personal financial statement',
		'12 months bank statements',
		'Insurance quotes',
		'Executed lease'
	].length);

	const strongestLender = $derived.by(() => {
		const excellent = displayLenders.find(l => l.match === 'Excellent');
		return excellent || displayLenders[0] || null;
	});

	// Track completed items in readiness checklist
	let readinessCompleted = $state({
		businessPlan: true,
		locationAnalysis: true,
		financialProjections: true,
		bankMatches: true,
		personalFinancial: false,
		bankStatements: false,
		insurance: false,
		lease: false
	});

	function handleReadinessItemClick(item) {
		// Navigate to relevant completion flow or modal
		switch(item) {
			case 'personalFinancial':
				// Navigate to personal financial upload
				console.log('Navigate to personal financial statement upload');
				break;
			case 'bankStatements':
				// Navigate to bank statements upload
				console.log('Navigate to bank statements upload');
				break;
			case 'insurance':
				// Navigate to insurance quotes upload
				console.log('Navigate to insurance quotes upload');
				break;
			case 'lease':
				// Navigate to lease upload
				console.log('Navigate to lease upload');
				break;
		}
	}
</script>

<svelte:head><title>RE² — Loan Readiness</title></svelte:head>

<div class="container">
	<DisclaimerBanner />
	<header class="page-header">
		<h1>Loan Readiness</h1>
		<p class="subtitle">SBA 7(a), grants, and funding matched to your profile</p>
	</header>

	<!-- Hero Insight Section -->
	<section class="hero-insight">
		<div class="hero-content">
			<h2 class="hero-headline">{readinessPercentage}% Loan-Ready</h2>
			<p class="hero-description">
				{pendingDocuments} {pendingDocuments === 1 ? 'document needed' : 'documents needed'} to complete your SBA package.
			</p>
			{#if strongestLender}
				<p class="hero-lender">
					<strong>Your strongest match:</strong> {strongestLender.name} at {strongestLender.rate}
				</p>
			{/if}
		</div>
	</section>

	<!-- Sticky Tab Navigation (unified TabBar component) -->
	<TabBar
		tabs={loanTabs}
		{activeTab}
		onTabChange={(id) => activeTab = id}
		compact={true}
	/>

	<main class="content">
		<!-- Loan Readiness Section -->
		{#if activeTab === 'readiness'}
			<section class="section section-active readiness-section">
				<div class="section-header">
					<div class="header-content">
						<h2>Loan Readiness: 68% Complete</h2>
						<p class="section-subtitle">Track your progress toward a complete SBA application</p>
					</div>
					<div class="progress-indicator">
						<div class="progress-bar">
							<div class="progress-fill" style="width: 68%"></div>
						</div>
						<span class="progress-text">68%</span>
					</div>
				</div>

				<div class="readiness-grid">
					<div class="readiness-item completed">
						<div class="readiness-icon"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
						<div class="readiness-content">
							<div class="readiness-label">Business plan defined</div>
							<div class="readiness-meta">Founder's Concept</div>
						</div>
					</div>
					<div class="readiness-item completed">
						<div class="readiness-icon"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
						<div class="readiness-content">
							<div class="readiness-label">Location analyzed</div>
							<div class="readiness-meta">Location score: {sessionLocationIQ > 0 ? sessionLocationIQ + '/100' : 'Pending'} based on 19 data sources</div>
						</div>
					</div>
					<div class="readiness-item completed">
						<div class="readiness-icon"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
						<div class="readiness-content">
							<div class="readiness-label">Financial projections ready</div>
							<div class="readiness-meta">Financials</div>
						</div>
					</div>
					<div class="readiness-item completed">
						<div class="readiness-icon"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
						<div class="readiness-content">
							<div class="readiness-label">Bank matches identified</div>
							<div class="readiness-meta">{displayLenders.length} matched lenders</div>
						</div>
					</div>
					<button class="readiness-item pending interactive" onclick={() => handleReadinessItemClick('personalFinancial')}>
						<div class="readiness-icon">⬜</div>
						<div class="readiness-content">
							<div class="readiness-label">Personal financial statement</div>
							<div class="readiness-meta">needed for SBA</div>
						</div>
						<div class="readiness-cta-link">Upload →</div>
					</button>
					<button class="readiness-item pending interactive" onclick={() => handleReadinessItemClick('bankStatements')}>
						<div class="readiness-icon">⬜</div>
						<div class="readiness-content">
							<div class="readiness-label">12 months bank statements</div>
							<div class="readiness-meta">personal accounts</div>
						</div>
						<div class="readiness-cta-link">Upload →</div>
					</button>
					<button class="readiness-item pending interactive" onclick={() => handleReadinessItemClick('insurance')}>
						<div class="readiness-icon">⬜</div>
						<div class="readiness-content">
							<div class="readiness-label">Insurance quotes</div>
							<div class="readiness-meta">GL + property coverage</div>
						</div>
						<div class="readiness-cta-link">Upload →</div>
					</button>
					<button class="readiness-item pending interactive" onclick={() => handleReadinessItemClick('lease')}>
						<div class="readiness-icon">⬜</div>
						<div class="readiness-content">
							<div class="readiness-label">Executed lease</div>
							<div class="readiness-meta">in negotiation</div>
						</div>
						<div class="readiness-cta-link">Upload →</div>
					</button>
				</div>

				<div class="readiness-cta">
					<strong>→ Complete the remaining 4 items to generate your full SBA 7(a) package</strong>
				</div>

				<div class="collapsible-section">
					<button
						class="collapsible-header"
						onclick={() => (expandedSections.readiness = !expandedSections.readiness)}
					>
						<span class="header-text">What Banks Want to See</span>
						<span class="expand-icon" class:expanded={expandedSections.readiness}>▼</span>
					</button>
					{#if expandedSections.readiness}
						<div class="collapsible-content">
							<div class="banks-intro">
								<p>Banks want to see that you've done your homework. Your Location Intelligence analysis demonstrates rigorous market research. Here's what makes your application strong:</p>
							</div>

							<div class="banks-requirements">
								<div class="req-item">
									<div class="req-icon"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
									<div class="req-content">
										<div class="req-title">Detailed market analysis</div>
										<div class="req-desc">Your location analysis based on 19 data sources including traffic, competition, and demographic fit</div>
									</div>
								</div>
								<div class="req-item">
									<div class="req-icon"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
									<div class="req-content">
										<div class="req-title">Realistic financial projections</div>
										<div class="req-desc">Your 3-scenario model (pessimistic/base/optimistic)</div>
									</div>
								</div>
								<div class="req-item">
									<div class="req-icon"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
									<div class="req-content">
										<div class="req-title">Industry experience</div>
										<div class="req-desc">Add your background and relevant experience</div>
									</div>
								</div>
								<div class="req-item">
									<div class="req-icon"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
									<div class="req-content">
										<div class="req-title">Equity injection</div>
										<div class="req-desc">How much of your own money are you putting in?</div>
									</div>
								</div>
								<div class="req-item warning">
									<div class="req-icon"><span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L1.5 13.5h13L8 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 7v3M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span></div>
									<div class="req-content">
										<div class="req-title">Collateral</div>
										<div class="req-desc">SBA requires collateral for loans over $350K</div>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Your Profile Section (includes Capital Structure) -->
		{#if activeTab === 'profile'}
			<section class="section section-active profile-section">
				<div class="section-header">
					<h2>Your Profile</h2>
					<p class="section-subtitle">Update your business information and funding needs</p>
				</div>

				<!-- Nested Profile Tabs -->
				<div class="profile-nested-tabs">
					<button
						class="nested-tab-btn"
						class:active={profileTab === 'info'}
						onclick={() => (profileTab = 'info')}
					>
						Business Info
					</button>
					<button
						class="nested-tab-btn"
						class:active={profileTab === 'capital'}
						onclick={() => (profileTab = 'capital')}
					>
						Capital Structure
					</button>
				</div>

				{#if profileTab === 'info'}
				<div class="profile-content">
					<div class="profile-grid">
						<div class="form-group">
							<label>Business Stage</label>
							<div class="stage-toggle">
								<button
									class="stage-btn"
									class:active={businessStage === 'Pre-Revenue'}
									onclick={() => (businessStage = 'Pre-Revenue')}
								>
									Pre-Revenue
								</button>
								<button
									class="stage-btn"
									class:active={businessStage === 'Post-Revenue'}
									onclick={() => (businessStage = 'Post-Revenue')}
								>
									Post-Revenue
								</button>
							</div>
						</div>

						<div class="form-group">
							<label>Owner Demographics</label>
							<div class="checkboxes-group">
								<label class="checkbox-item">
									<input type="checkbox" bind:checked={minorityOwned} />
									<span>Minority-owned</span>
								</label>
								<label class="checkbox-item">
									<input type="checkbox" bind:checked={womenOwned} />
									<span>Women-owned</span>
								</label>
								<label class="checkbox-item">
									<input type="checkbox" bind:checked={veteranOwned} />
									<span>Veteran-owned</span>
								</label>
							</div>
						</div>
					</div>

					<div class="form-group full-width">
						<label for="loanAmount">Total Loan Amount</label>
						<div class="input-with-label">
							<span class="currency">$</span>
							<input
								type="number"
								id="loanAmount"
								bind:value={loanAmount}
								placeholder="350000"
							/>
						</div>
					</div>

					<div class="form-group full-width">
						<label>Use of Funds Breakdown</label>
						<div class="use-of-funds-grid">
							<div class="use-item">
								<label for="leasehold">Leasehold</label>
								<div class="input-with-label">
									<span class="currency">$</span>
									<input type="number" id="leasehold" bind:value={useOfFunds.leasehold} />
								</div>
								<div class="use-percentage">
									{((useOfFunds.leasehold / totalFunds) * 100).toFixed(0)}%
								</div>
							</div>
							<div class="use-item">
								<label for="equipment">Equipment</label>
								<div class="input-with-label">
									<span class="currency">$</span>
									<input type="number" id="equipment" bind:value={useOfFunds.equipment} />
								</div>
								<div class="use-percentage">
									{((useOfFunds.equipment / totalFunds) * 100).toFixed(0)}%
								</div>
							</div>
							<div class="use-item">
								<label for="inventory">Inventory</label>
								<div class="input-with-label">
									<span class="currency">$</span>
									<input type="number" id="inventory" bind:value={useOfFunds.inventory} />
								</div>
								<div class="use-percentage">
									{((useOfFunds.inventory / totalFunds) * 100).toFixed(0)}%
								</div>
							</div>
							<div class="use-item">
								<label for="workingCapital">Working Capital</label>
								<div class="input-with-label">
									<span class="currency">$</span>
									<input
										type="number"
										id="workingCapital"
										bind:value={useOfFunds.workingCapital}
									/>
								</div>
								<div class="use-percentage">
									{((useOfFunds.workingCapital / totalFunds) * 100).toFixed(0)}%
								</div>
							</div>
							<div class="use-item">
								<label for="marketing">Marketing</label>
								<div class="input-with-label">
									<span class="currency">$</span>
									<input type="number" id="marketing" bind:value={useOfFunds.marketing} />
								</div>
								<div class="use-percentage">
									{((useOfFunds.marketing / totalFunds) * 100).toFixed(0)}%
								</div>
							</div>
							<div class="use-item">
								<label for="deposits">Deposits</label>
								<div class="input-with-label">
									<span class="currency">$</span>
									<input type="number" id="deposits" bind:value={useOfFunds.deposits} />
								</div>
								<div class="use-percentage">
									{((useOfFunds.deposits / totalFunds) * 100).toFixed(0)}%
								</div>
							</div>
						</div>
						<div class="total-line">
							<strong>Total Allocated:</strong>
							<strong>${totalFunds.toLocaleString()}</strong>
						</div>
					</div>
				</div>

				<div class="form-group full-width">
					<label for="biz-desc">Business Description</label>
					<textarea
						id="biz-desc"
						bind:value={businessDescription}
						onblur={saveDescription}
						placeholder="Describe your business concept, competitive advantages, and market positioning..."
						rows="4"
						class="biz-desc-input"
					></textarea>
					<p class="field-hint">This appears in your SBA application and cover letter.</p>
				</div>
				{/if}

				{#if profileTab === 'capital'}
				<div class="capital-content">
					<div class="section-header">
						<div class="header-content">
							<h3 class="capital-subtitle">Capital Structure Planner</h3>
							<p class="section-subtitle">See how your total project cost is funded — and where the gaps are</p>
						</div>
					</div>

					<div class="capital-layout">
						<!-- Total Project Cost -->
						<div class="capital-card">
							<h3 class="capital-card-title">Total Project Cost</h3>
							<div class="capital-total">${(totalProjectCost / 1000).toFixed(0)}K</div>
							<div class="capital-breakdown">
								{#each Object.entries(useOfFunds) as [key, val]}
									<div class="capital-row">
										<span class="capital-label">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
										<span class="capital-val">${(val / 1000).toFixed(0)}K</span>
									</div>
								{/each}
							</div>
						</div>

						<!-- Sources of Capital -->
						<div class="capital-card">
							<h3 class="capital-card-title">Sources of Capital</h3>
							<div class="capital-total" class:capital-gap={capitalGap > 0}>${(totalCapitalSources / 1000).toFixed(0)}K</div>
							<div class="capital-sources-inputs">
								<div class="capital-input-row">
									<label>Personal Savings</label>
									<input type="number" bind:value={capitalSources.personalSavings} />
								</div>
								<div class="capital-input-row">
									<label>Family / Friends</label>
									<input type="number" bind:value={capitalSources.familyFriends} />
								</div>
								<div class="capital-input-row">
									<label>SBA Loan</label>
									<input type="number" bind:value={capitalSources.sbaLoan} />
								</div>
								<div class="capital-input-row">
									<label>Alternative Lending</label>
									<input type="number" bind:value={capitalSources.altLending} />
								</div>
								<div class="capital-input-row">
									<label>Investor Equity</label>
									<input type="number" bind:value={capitalSources.investorEquity} />
								</div>
								<div class="capital-input-row">
									<label>Grants</label>
									<input type="number" bind:value={capitalSources.grants} />
								</div>
							</div>
						</div>

						<!-- Capital Stack Visual -->
						<div class="capital-card capital-card-wide">
							<h3 class="capital-card-title">Capital Stack</h3>
							<div class="capital-stack-bar">
								{#if capitalSources.personalSavings > 0}
									<div class="stack-segment stack-personal" style="width: {(capitalSources.personalSavings / Math.max(totalProjectCost, 1)) * 100}%">
										<span class="stack-label">Personal {((capitalSources.personalSavings / Math.max(totalProjectCost, 1)) * 100).toFixed(0)}%</span>
									</div>
								{/if}
								{#if capitalSources.sbaLoan > 0}
									<div class="stack-segment stack-debt" style="width: {(capitalSources.sbaLoan / Math.max(totalProjectCost, 1)) * 100}%">
										<span class="stack-label">SBA {((capitalSources.sbaLoan / Math.max(totalProjectCost, 1)) * 100).toFixed(0)}%</span>
									</div>
								{/if}
								{#if capitalSources.familyFriends + capitalSources.altLending + capitalSources.investorEquity > 0}
									{@const otherDebt = capitalSources.familyFriends + capitalSources.altLending + capitalSources.investorEquity}
									<div class="stack-segment stack-other" style="width: {(otherDebt / Math.max(totalProjectCost, 1)) * 100}%">
										<span class="stack-label">Other {((otherDebt / Math.max(totalProjectCost, 1)) * 100).toFixed(0)}%</span>
									</div>
								{/if}
								{#if capitalSources.grants > 0}
									<div class="stack-segment stack-grants" style="width: {(capitalSources.grants / Math.max(totalProjectCost, 1)) * 100}%">
										<span class="stack-label">Grants {((capitalSources.grants / Math.max(totalProjectCost, 1)) * 100).toFixed(0)}%</span>
									</div>
								{/if}
							</div>

							<!-- Equity Warning -->
							{#if personalEquityPct < 20}
								<div class="equity-warning">
									Your personal equity is {personalEquityPct.toFixed(0)}% of total project cost. Most SBA lenders require at least 10-20% skin in the game. 25-30% significantly strengthens your application.
								</div>
							{:else}
								<div class="equity-good">
									Personal equity at {personalEquityPct.toFixed(0)}% — meets SBA minimum equity requirement.
									{#if personalEquityPct < 25}Consider increasing to 25-30% for better terms.{/if}
								</div>
							{/if}

							<!-- Gap indicator -->
							{#if capitalGap > 0}
								<div class="equity-warning">
									Funding gap: ${(capitalGap / 1000).toFixed(0)}K. Your capital sources are ${(capitalGap / 1000).toFixed(0)}K short of total project cost. Adjust your funding mix or reduce project scope.
								</div>
							{:else if capitalGap < 0}
								<div class="equity-good">
									Over-capitalized by ${(Math.abs(capitalGap) / 1000).toFixed(0)}K — extra runway for unexpected costs.
								</div>
							{/if}
						</div>
					</div>
				</div>
				{/if}
			</section>
		{/if}

		<!-- Matched Lenders Section -->
		{#if activeTab === 'lenders'}
			<section class="section section-active">
				<div class="section-header">
					<h2>Matched Lenders for {businessStage}</h2>
					<p class="section-subtitle">{displayLenders.length} lenders matched to your profile</p>
				</div>
				<div class="lenders-grid">
					{#each displayLenders as lender}
						<div class="lender-card">
							<div class="lender-header">
								<h3>{lender.name}</h3>
								<span
									class="match-tag"
									class:excellent={lender.match === 'Excellent'}
									class:good={lender.match === 'Good'}
									>{lender.match}</span
								>
							</div>
							<div class="lender-info">
								<div class="info-item">
									<span class="label">Programs:</span>
									<span class="value">{lender.programs}</span>
								</div>
								<div class="info-item">
									<span class="label">Max Loan:</span>
									<span class="value">{lender.maxLoan}</span>
								</div>
								<div class="info-item">
									<span class="label">Rate:</span>
									<span class="value">{lender.rate}</span>
								</div>
								<div class="info-item">
									<span class="label">Features:</span>
									<span class="value">{lender.features}</span>
								</div>
							</div>
							<div class="lender-progress">
								<div class="progress-label">Loan Match</div>
								<div class="progress-bar-small">
									<div
										class="progress-fill"
										style="width: {lender.match === 'Excellent' ? '100' : '75'}%"
									></div>
								</div>
							</div>
							<button class="btn btn-secondary btn-sm">Apply →</button>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Grant Programs Section -->
		{#if activeTab === 'grants'}
			<section class="section section-active">
				<div class="section-header">
					<h2>Grants & Programs</h2>
					<p class="section-subtitle">{grantPrograms.length} grant programs available</p>
				</div>
				<div class="grants-grid">
					{#each grantPrograms as grant}
						<div class="grant-card">
							<h3>{grant.name}</h3>
							<div class="grant-info">
								<div class="info-row">
									<span class="label">Eligibility:</span>
									<span class="value">{grant.eligibility}</span>
								</div>
								<div class="info-row">
									<span class="label">Amount:</span>
									<span class="value">{grant.amount}</span>
								</div>
							</div>
							<a href={grant.url} class="btn btn-secondary btn-sm">Apply →</a>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Documents Section (Letter + Generator combined) -->
		{#if activeTab === 'documents'}
			<section class="section section-active doc-section">
				<div class="section-header">
					<h2>Documents</h2>
					<p class="section-subtitle">Generate and manage your SBA application documents</p>
				</div>

				<!-- Documents Nested Tabs -->
				<div class="profile-nested-tabs">
					<button
						class="nested-tab-btn"
						class:active={expandedSections.letter === undefined || expandedSections.letter}
						onclick={() => { expandedSections.letter = true; expandedSections.generator = false; }}
					>
						Cover Letter
					</button>
					<button
						class="nested-tab-btn"
						class:active={expandedSections.generator}
						onclick={() => { expandedSections.generator = true; expandedSections.letter = false; }}
					>
						Document Generator
					</button>
				</div>

				{#if expandedSections.letter}
				<div class="doc-subsection">
					<div class="section-header sub-header">
						<h3>Draft Cover Letter</h3>
						<p class="section-subtitle">Personalize and use in your SBA application</p>
					</div>

				<div class="letter-preview-container">
					<button
						class="collapsible-header"
						onclick={() => (expandedSections.letter = !expandedSections.letter)}
					>
						<span class="header-text"
							>{expandedSections.letter ? 'Hide' : 'Show'} Full Letter</span
						>
						<span class="expand-icon" class:expanded={expandedSections.letter}>▼</span>
					</button>

					{#if expandedSections.letter}
						<div class="cover-letter-preview">
							<pre class="cover-letter-text">Dear Lending Team,

I am seeking an SBA 7(a) loan of ${loanAmount.toLocaleString()} to grow {lpData?.businessProfile?.businessName || 'your business'}{lpData?.locationIntelligence?.address ? ` at ${lpData.locationIntelligence.address}` : ''}.

{lpData?.businessProfile?.businessName || 'Your Business'}{businessDescription ? `\n\n${businessDescription}` : ''}

Our location analysis highlights key market strengths including competitive positioning, demographic alignment, and accessibility factors. {sessionLocationIQ > 0 ? `This location scores ${sessionLocationIQ}/100 based on 19 data sources including traffic, competition, and demographic fit.` : 'Review your location analysis above.'}

Our financial projections demonstrate strong growth potential:
- Year 1 Revenue: ${lpData?.financialGoals?.year1Revenue ? `$${lpData.financialGoals.year1Revenue.toLocaleString()}` : '[Add your Year 1 revenue projection]'}
- Year 3 Revenue: ${lpData?.financialGoals?.year3Revenue ? `$${lpData.financialGoals.year3Revenue.toLocaleString()}` : '[Add your Year 3 revenue projection]'}
- Owner's Take-Home: ${lpData?.financialGoals?.targetSDE ? `$${lpData.financialGoals.targetSDE.toLocaleString()}` : '[Add your target take-home]'}

The requested funds will be allocated to:
- Leasehold Improvements: ${useOfFunds.leasehold > 0 ? `$${useOfFunds.leasehold.toLocaleString()}` : '[Add amount]'}
- Equipment: ${useOfFunds.equipment > 0 ? `$${useOfFunds.equipment.toLocaleString()}` : '[Add amount]'}
- Inventory: ${useOfFunds.inventory > 0 ? `$${useOfFunds.inventory.toLocaleString()}` : '[Add amount]'}
- Working Capital: ${useOfFunds.workingCapital > 0 ? `$${useOfFunds.workingCapital.toLocaleString()}` : '[Add amount]'}
- Marketing: ${useOfFunds.marketing > 0 ? `$${useOfFunds.marketing.toLocaleString()}` : '[Add amount]'}
- Deposits & Contingency: ${useOfFunds.deposits > 0 ? `$${useOfFunds.deposits.toLocaleString()}` : '[Add amount]'}

I welcome the opportunity to discuss this application in detail.

Sincerely,
[Your Name]
{lpData?.businessProfile?.businessName || 'Your Business Name'}</pre>
							<div class="letter-actions">
								<button class="btn btn-secondary btn-sm" onclick={() => navigator.clipboard.writeText(generatedDoc?.content || '')}>
									Copy to Clipboard
								</button>
								<button class="btn btn-secondary btn-sm" onclick={() => {
									const el = document.createElement('a');
									el.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(document.querySelector('.cover-letter-text').textContent));
									el.setAttribute('download', 'Cover_Letter.txt');
									el.style.display = 'none';
									document.body.appendChild(el);
									el.click();
									document.body.removeChild(el);
								}}>
									Download
								</button>
							</div>
						</div>
					{/if}
				</div>
				</div>
				{/if}

				{#if expandedSections.generator}
				<div class="doc-subsection">
					<div class="section-header sub-header">
						<h3>Document Generator</h3>
						<p class="section-subtitle">Generate quick summaries or full SBA narratives</p>
					</div>

				<div class="doc-controls">
					<div class="form-group">
						<label>Document Type</label>
						<div class="mode-toggle">
							<button
								class="mode-btn"
								class:active={documentMode === 'quick'}
								onclick={() => (documentMode = 'quick')}
							>
								Quick Summary
							</button>
							<button
								class="mode-btn"
								class:active={documentMode === 'full'}
								onclick={() => (documentMode = 'full')}
							>
								Full SBA Narrative
							</button>
						</div>
					</div>

					<button class="btn btn-primary" onclick={generateDocument}>
						Generate {documentMode === 'quick' ? 'Summary' : 'Narrative'}
					</button>
				</div>

				{#if generatedDoc}
					<div class="generated-doc">
						<div class="doc-header">
							<h3>{generatedDoc.title}</h3>
							<div class="doc-actions">
								<button class="btn btn-secondary btn-sm" onclick={copyToClipboard}>
									Copy to Clipboard
								</button>
								<button class="btn btn-secondary btn-sm" onclick={downloadDoc}>
									Download
								</button>
							</div>
						</div>
						<pre class="doc-content">{generatedDoc.content}</pre>
					</div>
				{/if}
				</div>
				{/if}
			</section>
		{/if}

	</main>

	<PageNav
		backHref="/app/financials"
		backLabel="Business Case"
		nextHref="/app/operations"
		nextLabel="Operations"
		nextIsGreen={true}
	/>
</div>

<style>
	.container {
		--bg-primary: var(--bg);
		--bg-secondary: var(--surface);
		--bg-tertiary: var(--surface-alt);
		--text-primary: var(--text);
		--text-secondary: var(--text-secondary);
		--text-tertiary: var(--text-tertiary);
		--border-color: var(--border);
		--accent-primary: var(--accent);
		--accent-secondary: var(--purple);
		--success: var(--success);
		--warning: var(--warning);
		--danger: var(--danger);
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1rem;
		background-color: var(--bg-primary);
		color: var(--text-primary);
		min-height: 100vh;
	}

	/* Tab Navigation */
	.tab-nav {
		display: flex;
		gap: 0.5rem;
		margin: 2rem 0 2.5rem 0;
		border-bottom: 2px solid var(--border-color);
		overflow-x: auto;
		padding-bottom: 0;
		scroll-behavior: smooth;
	}

	.tab-nav::-webkit-scrollbar {
		height: 4px;
	}

	.tab-nav::-webkit-scrollbar-track {
		background: transparent;
	}

	.tab-nav::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 2px;
	}

	.tab-btn {
		padding: 1rem 1.5rem;
		border: none;
		background-color: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		font-weight: 500;
		font-size: 0.95rem;
		white-space: nowrap;
		border-bottom: 3px solid transparent;
		transition: all 0.3s ease;
		position: relative;
		bottom: -2px;
	}

	.tab-btn:hover {
		color: var(--text-primary);
		border-bottom-color: var(--accent-secondary);
	}

	.tab-btn.active {
		color: var(--accent-primary);
		border-bottom-color: var(--accent-primary);
	}

	/* Section Headers */
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 2rem;
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 2px solid var(--accent-primary);
	}

	.section-header h2 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--active, #00BCD4);
		flex: 1;
	}

	.header-content {
		flex: 1;
	}

	.section-subtitle {
		color: var(--text-tertiary);
		font-size: 0.95rem;
		margin-top: 0.5rem;
		margin-bottom: 0;
	}

	.progress-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		min-width: 150px;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background-color: var(--bg-tertiary);
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid var(--border-color);
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
		transition: width 0.3s ease;
	}

	.progress-text {
		font-weight: 700;
		color: var(--accent-primary);
		font-size: 0.9rem;
	}

	.progress-bar-small {
		width: 100%;
		height: 6px;
		background-color: var(--bg-tertiary);
		border-radius: 3px;
		overflow: hidden;
		border: 1px solid var(--border-color);
	}

	.page-header {
		margin-bottom: 2rem;
		border-bottom: 2px solid var(--border-color);
		padding-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 2.5rem;
		margin: 0;
		font-weight: 700;
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.page-header .subtitle {
		color: var(--text-secondary);
		font-size: 1.1rem;
		margin-top: 0.5rem;
	}

	/* Hero Insight Section */
	.hero-insight {
		background: linear-gradient(135deg, rgba(0, 113, 227, 0.08), rgba(168, 85, 247, 0.08));
		border: 1px solid var(--border-color);
		border-radius: 0.75rem;
		padding: 2rem;
		margin-bottom: 2rem;
		backdrop-filter: blur(10px);
	}

	.hero-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.hero-headline {
		font-family: 'Georgia', 'Garamond', serif;
		font-size: 2rem;
		font-weight: 700;
		margin: 0;
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		letter-spacing: -0.5px;
	}

	.hero-description {
		color: var(--text-secondary);
		font-size: 1rem;
		margin: 0;
		line-height: 1.5;
	}

	.hero-lender {
		color: var(--text-primary);
		font-size: 0.95rem;
		margin: 0.5rem 0 0 0;
		padding: 0.75rem 1rem;
		background-color: var(--bg-tertiary);
		border-left: 3px solid var(--accent-primary);
		border-radius: 0.4rem;
	}

	.hero-lender strong {
		color: var(--accent-primary);
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.section {
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.75rem;
		padding: 2rem;
		display: none;
	}

	.section.section-active {
		display: block;
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.section h2 {
		margin: 0;
		font-size: 1.4rem;
		color: var(--text-primary);
	}

	/* Collapsible Sections */
	.collapsible-section {
		margin-top: 2rem;
		border-top: 1px solid var(--border-color);
		padding-top: 1.5rem;
	}

	.collapsible-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 1rem;
		background-color: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		color: var(--text-primary);
		font-weight: 600;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.3s ease;
		text-align: left;
	}

	.collapsible-header:hover {
		background-color: var(--bg);
		border-color: var(--accent-primary);
	}

	.header-text {
		flex: 1;
	}

	.expand-icon {
		font-size: 0.8rem;
		color: var(--text-secondary);
		transition: transform 0.3s ease;
		flex-shrink: 0;
	}

	.expand-icon.expanded {
		transform: rotate(180deg);
	}

	.collapsible-content {
		padding: 1.5rem;
		background-color: rgba(52, 199, 89, 0.03);
		border: 1px solid var(--border-color);
		border-top: none;
		border-radius: 0 0 0.5rem 0.5rem;
		animation: slideDown 0.3s ease;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			max-height: 0;
			overflow: hidden;
		}
		to {
			opacity: 1;
			max-height: 2000px;
			overflow: visible;
		}
	}

	.letter-preview-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.profile-section {
		background: var(--surface);
	}

	.profile-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.profile-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	.form-group label {
		font-weight: 600;
		color: var(--text-primary);
		font-size: 0.95rem;
	}

	.biz-desc-input {
		width: 100%;
		padding: 0.75rem 1rem;
		background: var(--surface-raised, #ffffff);
		border: 1px solid var(--border-subtle, #e5e7eb);
		border-radius: 8px;
		color: var(--text-primary);
		font-size: 0.95rem;
		font-family: inherit;
		resize: vertical;
		box-sizing: border-box;
	}

	.biz-desc-input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.field-hint {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.stage-toggle,
	.mode-toggle {
		display: flex;
		gap: 0.5rem;
		background-color: var(--bg-tertiary);
		padding: 0.3rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border-color);
	}

	.stage-btn,
	.mode-btn {
		flex: 1;
		padding: 0.75rem 1rem;
		border: none;
		background-color: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		border-radius: 0.4rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.stage-btn.active,
	.mode-btn.active {
		background-color: var(--accent-primary);
		color: white;
	}

	.checkboxes-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.checkbox-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		user-select: none;
		color: var(--text-primary);
	}

	.checkbox-item input {
		width: 1.1rem;
		height: 1.1rem;
		cursor: pointer;
	}

	.input-with-label {
		position: relative;
		display: flex;
		align-items: center;
	}

	.currency {
		position: absolute;
		left: 0.75rem;
		color: var(--text-secondary);
		font-weight: 600;
		pointer-events: none;
	}

	.input-with-label input {
		padding-left: 1.75rem;
		padding-right: 0.75rem;
		padding-top: 0.75rem;
		padding-bottom: 0.75rem;
		background-color: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 1rem;
		width: 100%;
		transition: border-color 0.2s;
	}

	.input-with-label input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.1);
	}

	.use-of-funds-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1.5rem;
		margin-top: 1rem;
	}

	.use-item {
		background-color: var(--bg-tertiary);
		padding: 1rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.use-item label {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.use-item input {
		padding: 0.5rem;
		background-color: var(--bg-primary);
		border: 1px solid var(--border-color);
		border-radius: 0.4rem;
		color: var(--text-primary);
		font-size: 0.95rem;
		padding-left: 1.75rem;
	}

	.use-percentage {
		text-align: right;
		font-weight: 700;
		color: var(--accent-primary);
		font-size: 1rem;
	}

	.total-line {
		display: flex;
		justify-content: space-between;
		padding: 1rem;
		background-color: var(--bg-tertiary);
		border-radius: 0.5rem;
		border: 1px solid var(--accent-primary);
		margin-top: 1rem;
		color: var(--text-primary);
	}

	.lenders-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1.5rem;
	}

	.lender-card {
		background-color: var(--bg-tertiary);
		border: 2px solid var(--border-color);
		border-radius: 0.75rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.lender-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 4px;
		background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.lender-card:hover {
		border-color: var(--accent-primary);
		box-shadow: 0 8px 20px rgba(0, 113, 227, 0.15);
		transform: translateY(-4px);
	}

	.lender-card:hover::before {
		opacity: 1;
	}

	.lender-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.lender-header h3 {
		margin: 0;
		font-size: 1.15rem;
		color: var(--text-primary);
		font-weight: 700;
	}

	.match-tag {
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.8rem;
		font-weight: 700;
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.match-tag.excellent {
		background-color: rgba(5, 150, 105, 0.15);
		color: var(--success);
	}

	.match-tag.good {
		background-color: rgba(59, 130, 246, 0.15);
		color: var(--accent);
	}

	.lender-progress {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.progress-label {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}

	.lender-info {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: 1;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-item .label {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}

	.info-item .value {
		font-size: 0.95rem;
		color: var(--text-secondary);
	}

	.grants-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.grant-card {
		background-color: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.grant-card h3 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text-primary);
		border-bottom: 2px solid var(--accent-primary);
		padding-bottom: 0.75rem;
	}

	.grant-info {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: 1;
	}

	.info-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-row .label {
		font-size: 0.8rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}

	.info-row .value {
		font-size: 0.95rem;
		color: var(--text-secondary);
	}

	.doc-section {
		background: var(--surface);
	}

	.doc-controls {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.doc-controls .form-group {
		margin-bottom: 0;
	}

	.generated-doc {
		background-color: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.doc-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-color);
		background-color: var(--bg-tertiary);
	}

	.doc-header h3 {
		margin: 0;
		color: var(--text-primary);
	}

	.doc-actions {
		display: flex;
		gap: 0.75rem;
	}

	.doc-content {
		padding: 1.5rem;
		background-color: var(--bg-primary);
		color: var(--text-secondary);
		font-size: 0.9rem;
		line-height: 1.65;
		overflow-x: auto;
		margin: 0;
		max-height: 600px;
		overflow-y: auto;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		display: inline-block;
		transition: all 0.2s;
	}

	.btn-primary {
		background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
		color: white;
	}

	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 16px rgba(0, 113, 227, 0.2);
	}

	.btn-secondary {
		background-color: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.btn-secondary:hover {
		border-color: var(--accent-primary);
		background-color: var(--bg);
	}

	.btn-sm {
		padding: 0.5rem 1rem;
		font-size: 0.85rem;
		width: 100%;
	}

	.nav-section {
		display: flex;
		justify-content: center;
		padding: 2rem 0;
	}

	/* Readiness Section */
	.readiness-section {
		background: var(--surface);
	}

	.readiness-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1.25rem;
		margin: 2rem 0 2rem 0;
		grid-auto-rows: 1fr;
	}

	.readiness-item {
		display: flex;
		gap: 1rem;
		padding: 1.25rem;
		background-color: var(--bg-tertiary);
		border: 2px solid var(--border-color);
		border-radius: 0.625rem;
		transition: all 0.3s ease;
	}

	.readiness-item:hover {
		transform: translateY(-2px);
		border-color: var(--accent-primary);
	}

	.readiness-item.completed {
		border-color: rgba(52, 199, 89, 0.4);
		background-color: rgba(52, 199, 89, 0.08);
	}

	.readiness-item.pending {
		border-color: rgba(255, 149, 0, 0.4);
		background-color: rgba(255, 149, 0, 0.08);
	}

	.readiness-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.readiness-content {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.readiness-label {
		font-weight: 600;
		color: var(--text-primary);
		font-size: 0.975rem;
	}

	.readiness-meta {
		font-size: 0.85rem;
		color: var(--text-tertiary);
	}

	.readiness-cta {
		padding: 1.25rem;
		background-color: rgba(0, 113, 227, 0.08);
		border: 2px solid rgba(0, 113, 227, 0.3);
		border-radius: 0.625rem;
		color: var(--text-secondary);
		font-size: 0.95rem;
		margin-top: 0.5rem;
	}

	.readiness-cta strong {
		color: var(--accent-primary);
	}

	.readiness-item.interactive {
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		border: 2px solid rgba(255, 149, 0, 0.4);
		background-color: rgba(255, 149, 0, 0.08);
		padding: 1.25rem;
		text-align: left;
		font-family: inherit;
		font-size: inherit;
	}

	.readiness-item.interactive:hover {
		border-color: var(--accent-primary);
		background-color: rgba(0, 113, 227, 0.08);
		transform: translateY(-2px);
	}

	.readiness-cta-link {
		font-weight: 600;
		color: var(--accent-primary);
		font-size: 0.9rem;
		white-space: nowrap;
		margin-left: 1rem;
		flex-shrink: 0;
	}

	/* Nested Profile Tabs */
	.profile-nested-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 2rem;
		border-bottom: 2px solid var(--border-color);
		padding-bottom: 0;
	}

	.nested-tab-btn {
		padding: 0.875rem 1.25rem;
		border: none;
		background-color: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		font-weight: 500;
		font-size: 0.9rem;
		white-space: nowrap;
		border-bottom: 3px solid transparent;
		transition: all 0.2s ease;
		position: relative;
		bottom: -2px;
	}

	.nested-tab-btn:hover {
		color: var(--text-primary);
		border-bottom-color: var(--accent-secondary);
	}

	.nested-tab-btn.active {
		color: var(--accent-primary);
		border-bottom-color: var(--accent-primary);
	}

	.profile-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.capital-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.doc-subsection {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.sub-header {
		margin-bottom: 1rem;
	}

	.sub-header h3 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--text-primary);
	}

	/* Banks Section */
	.banks-section {
		background: var(--surface);
	}

	.banks-intro {
		margin-bottom: 2rem;
		padding: 1.5rem;
		background-color: rgba(0, 113, 227, 0.08);
		border-left: 4px solid var(--accent-primary);
		border-radius: 0.5rem;
	}

	.banks-intro p {
		color: var(--text-secondary);
		line-height: 1.65;
		margin: 0;
		font-size: 0.975rem;
	}

	.banks-requirements {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.req-item {
		display: flex;
		gap: 1.25rem;
		padding: 1.5rem;
		background-color: var(--bg-tertiary);
		border: 2px solid var(--border-color);
		border-radius: 0.625rem;
		transition: all 0.3s ease;
	}

	.req-item.warning {
		border-color: rgba(255, 149, 0, 0.4);
		background-color: rgba(255, 149, 0, 0.08);
	}

	.req-item:hover {
		border-color: var(--accent-primary);
		transform: translateX(6px);
		box-shadow: 0 4px 12px rgba(0, 113, 227, 0.1);
	}

	.req-icon {
		font-size: 1.3rem;
		flex-shrink: 0;
	}

	.req-content {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.req-title {
		font-weight: 700;
		color: var(--text-primary);
		font-size: 0.975rem;
	}

	.req-desc {
		font-size: 0.9rem;
		color: var(--text-tertiary);
	}

	/* Cover Letter Section */
	.cover-letter-preview {
		background-color: var(--bg-tertiary);
		border: 2px solid var(--border-color);
		border-radius: 0.625rem;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		margin-top: 1rem;
	}

	.cover-letter-text {
		padding: 2rem;
		background-color: var(--bg-primary);
		color: var(--text-secondary);
		font-size: 0.9rem;
		line-height: 1.7;
		margin: 0;
		white-space: pre-wrap;
		word-wrap: break-word;
		overflow-x: auto;
		max-height: 500px;
		overflow-y: auto;
	}

	.letter-actions {
		display: flex;
		gap: 0.75rem;
		padding: 1.25rem 2rem;
		border-top: 2px solid var(--border-color);
		background-color: var(--bg-tertiary);
	}

	@media (max-width: 1024px) {
		.section-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1.5rem;
		}

		.progress-indicator {
			width: 100%;
			min-width: auto;
		}
	}

	@media (max-width: 1024px) {
		.capital-layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		.page-header h1 {
			font-size: 1.75rem;
		}

		.tab-nav {
			gap: 0.25rem;
			margin: 1.5rem 0 2rem 0;
		}

		.tab-btn {
			padding: 0.875rem 1rem;
			font-size: 0.85rem;
		}

		.profile-grid {
			grid-template-columns: 1fr;
		}

		.use-of-funds-grid {
			grid-template-columns: 1fr;
		}

		.lenders-grid {
			grid-template-columns: 1fr;
		}

		.grants-grid {
			grid-template-columns: 1fr;
		}

		.readiness-grid {
			grid-template-columns: 1fr;
		}

		.doc-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.doc-actions {
			width: 100%;
		}

		.btn-sm {
			width: 100%;
		}

		.section {
			padding: 1.5rem;
		}

		.section-header {
			flex-direction: column;
		}

		.collapsible-header {
			padding: 0.875rem;
		}

		.capital-layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.tab-nav {
			gap: 0.25rem;
			margin: 1rem 0 1.5rem 0;
		}

		.tab-btn {
			padding: 0.75rem 0.75rem;
			font-size: 0.75rem;
		}

		.profile-grid {
			grid-template-columns: 1fr;
		}

		.lenders-grid {
			grid-template-columns: 1fr;
		}

		.capital-layout {
			grid-template-columns: 1fr;
		}

		.capital-input-row input {
			width: 100%;
		}
	}

	/* ── Capital Structure Styles ── */
	.capital-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.capital-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1.5rem;
	}

	.capital-card-wide {
		grid-column: 1 / -1;
	}

	.capital-card-title {
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--accent-primary);
		margin: 0 0 12px 0;
	}

	.capital-total {
		font-size: 32px;
		font-weight: 800;
		color: var(--success);
		margin-bottom: 16px;
	}

	.capital-total.capital-gap {
		color: var(--warning);
	}

	.capital-breakdown {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.capital-row {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
	}

	.capital-label {
		color: var(--text-tertiary);
		text-transform: capitalize;
	}

	.capital-val {
		color: var(--text-primary);
		font-weight: 600;
	}

	.capital-sources-inputs {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.capital-input-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.capital-input-row label {
		font-size: 13px;
		color: var(--text-secondary);
		flex: 1;
	}

	.capital-input-row input {
		width: 120px;
		padding: 6px 10px;
		background: var(--bg-tertiary);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		color: var(--text-primary);
		font-size: 13px;
		text-align: right;
	}

	.capital-stack-bar {
		display: flex;
		height: 40px;
		border-radius: 6px;
		overflow: hidden;
		margin-bottom: 16px;
	}

	.stack-segment {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 30px;
		transition: width 0.3s ease;
	}

	.stack-label {
		font-size: 10px;
		font-weight: 700;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 0 4px;
	}

	.stack-personal { background: var(--success); }
	.stack-debt { background: var(--accent); }
	.stack-other { background: #5856D6; }
	.stack-grants { background: var(--warning); }

	.equity-warning {
		font-size: 13px;
		color: var(--warning);
		padding: 10px 14px;
		background: rgba(255, 149, 0, 0.08);
		border-radius: 6px;
		border: 1px solid rgba(255, 149, 0, 0.15);
		margin-top: 8px;
	}

	.equity-good {
		font-size: 13px;
		color: var(--success);
		padding: 10px 14px;
		background: rgba(52, 199, 89, 0.08);
		border-radius: 6px;
		border: 1px solid rgba(52, 199, 89, 0.15);
		margin-top: 8px;
	}

	@media (max-width: 768px) {
		.capital-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
