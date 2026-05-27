<script>
	import { onMount } from 'svelte';
	import { loadLaunchPadData, saveLaunchPadData } from '$lib/launchpad-store';
	import { CONCEPT_KPIS } from '$lib/constants/conceptKPIs';
	import { CONCEPT_REGISTRY } from '$lib/constants/concepts';
	import { getConceptDefaults } from '$lib/constants/conceptDefaults';
	import FounderProfile from '$lib/overview/FounderProfile.svelte';
	import CreditProfile from '$lib/overview/CreditProfile.svelte';
	import CompetitiveStrategy from '$lib/overview/CompetitiveStrategy.svelte';
	import RiskTolerance from '$lib/overview/RiskTolerance.svelte';
	import AlignmentWeights from '$lib/overview/AlignmentWeights.svelte';

	// Svelte 5 runes for reactive state
	let saveStatus = $state('');
	let loaded = $state(false);

	function triggerSave() {
		saveStatus = 'Saving...';
		// Actually persist to localStorage
		saveLaunchPadData({
			founderProfile,
			creditProfile,
			businessType,
			businessName,
			businessFormat,
			visionStatement,
			differentiator,
			financialGoals: { ...financialGoals, liquidCapital, monthlyPersonalExpenses, externalFunding },
			weights,
			idealArea,
			sacred,
			flexible,
			preferredNeighborhoods: locationPreferences.preferredNeighborhoods
		});
		setTimeout(() => { saveStatus = 'Auto-saved ✓'; }, 300);
		setTimeout(() => { saveStatus = ''; }, 2500);
	}

	// Debounced auto-save on any input change
	let saveTimer = null;
	function autoSave() {
		if (!loaded) return;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(triggerSave, 1000);
	}

	let businessType = $state('');
	let businessName = $state('');
	let visionStatement = $state('');
	let differentiator = $state('');

	// Load persisted data on mount
	onMount(() => {
		const data = loadLaunchPadData();
		// #23: Seed financial defaults from conceptDefaults (single source of truth) before spreading saved data
		const cDefs = getConceptDefaults(data.businessType);
		const conceptDefault = CONCEPT_KPIS[data.businessType]?.revenueParams.defaultAvgTicket ?? cDefs.ticket;
		financialGoals = {
			...financialGoals,
			avgTicket: conceptDefault,
			targetSDE: cDefs.sde,
			revenueY1: cDefs.revenue,
		};
		if (data.lastSaved > 0) {
			businessType = data.businessType;
			businessName = data.businessName;
			visionStatement = data.visionStatement;
			differentiator = data.differentiator;
			financialGoals = { ...financialGoals, ...data.financialGoals };
			weights = { ...weights, ...data.weights };
			idealArea = data.idealArea || idealArea;
			sacred = { ...sacred, ...data.sacred };
			flexible = { ...flexible, ...data.flexible };
			if (data.preferredNeighborhoods) {
				locationPreferences.preferredNeighborhoods = data.preferredNeighborhoods;
			}
			// Load founder profile + credit profile
			if (data.founderProfile) {
				founderProfile = {
					...founderProfile,
					...data.founderProfile,
					yearOneGoals: {
						...founderProfile.yearOneGoals,
						revenueTarget: cDefs.revenue,      // #23: concept-aware default
						...(data.founderProfile.yearOneGoals || {}),
					}
				};
			}
			if (data.creditProfile) {
				creditProfile = { ...creditProfile, ...data.creditProfile };
			}
			if (data.businessFormat) businessFormat = data.businessFormat;
			if (data.financialGoals?.liquidCapital) liquidCapital = data.financialGoals.liquidCapital;
			if (data.financialGoals?.monthlyPersonalExpenses) monthlyPersonalExpenses = data.financialGoals.monthlyPersonalExpenses;
			if (data.financialGoals?.externalFunding) externalFunding = data.financialGoals.externalFunding;
		}
		loaded = true;
	});

	let communityImpact = $state('Serve underserved communities');
	let brandPositioning = $state('Premium wellness positioning');
	let teamEmployment = $state('Create 15+ jobs within 3 years');

	// Founder Profile (Module 1)
	let founderProfile = $state({
		motivation: '',
		ownerType: '',
		riskTolerance: '',
		experience: '',
		yearOneGoals: {
			revenueTarget: 950000,
			personalIncomeTarget: 80000,
			employeeCount: 5,
			locationCount: 1
		}
	});

	// Credit Profile (Module 2)
	let creditProfile = $state({
		scoreRange: '',
		bankruptcy: false,
		latePayments: false,
		collections: false,
		existingDebt: 'na'
	});

	// Business format
	let businessFormat = $state('cafe');

	// Additional financial fields for right-sizing (Module 4)
	let liquidCapital = $state(80000);
	let monthlyPersonalExpenses = $state(5000);
	let externalFunding = $state(0);

	// Track founder profile completion
	let founderProfileComplete = $derived(
		founderProfile.motivation !== '' &&
		founderProfile.ownerType !== '' &&
		founderProfile.riskTolerance !== '' &&
		founderProfile.experience !== ''
	);

	let financialGoals = $state({
		targetSDE: 250000,
		revenueY1: 950000,
		revenueY3: 1600000,
		dailyTransactions: 500,
		avgTicket: 8.75,
		numberOfLocations: 1,
		startupCapital: 150000,
		personalInvestment: 50000,
		emergencyReserveMonths: 6,
		monthlyRentBudget: 15000,
		buildoutBudget: 50000,
		teamSize: 5,
		squareFootage: 1200
	});

	// Sacred/Flexible toggles
	let sacred = $state({
		brand: true,
		coreProduct: true
	});

	let flexible = $state({
		pricing: true,
		hours: true,
		format: true
	});

	// #31: replaced inline list (included phantom 'Grocery', 'Prof Services') with CONCEPT_REGISTRY
	const businessTypes = CONCEPT_REGISTRY.map(c => c.label);

	// Default weights by business type
	const defaultWeightsByType = {
		'Specialty Coffee/Café': {
			l0_macro: 10,
			l1_city: 15,
			l2_block: 18,
			l3_planfit: 18,
			l4_talent: 10,
			l5_resilience: 10,
			l6_zoning: 7,
			l7_feel: 12
		},
		'Restaurant': {
			l0_macro: 10,
			l1_city: 14,
			l2_block: 20,
			l3_planfit: 22,
			l4_talent: 10,
			l5_resilience: 8,
			l6_zoning: 6,
			l7_feel: 10
		},
		'Fitness': {
			l0_macro: 12,
			l1_city: 16,
			l2_block: 16,
			l3_planfit: 18,
			l4_talent: 12,
			l5_resilience: 10,
			l6_zoning: 6,
			l7_feel: 10
		}
	};

	// Get default weights for current business type
	const getDefaultWeights = (type) => {
		return defaultWeightsByType[type] || defaultWeightsByType['Specialty Coffee/Café'];
	};

	// Initialize with defaults
	let weights = $state(getDefaultWeights(businessType));

	// Auto-balance weights when one changes
	const balanceWeights = (changedKey, newValue) => {
		weights[changedKey] = Math.max(0, Math.min(newValue, 100));

		const min = changedKey === 'l7_feel' ? 0 : 5;
		const max = changedKey === 'l7_feel' ? 25 : 100;
		weights[changedKey] = Math.max(min, Math.min(newValue, max));

		const total = Object.values(weights).reduce((a, b) => a + b, 0);
		if (total !== 100) {
			// Proportionally scale all other values
			const scaleFactor = (100 - weights[changedKey]) / (total - weights[changedKey]);
			for (const key in weights) {
				if (key !== changedKey) {
					weights[key] = Math.round(weights[key] * scaleFactor);
				}
			}
			// Fine-tune to ensure sum is exactly 100
			const newTotal = Object.values(weights).reduce((a, b) => a + b, 0);
			if (newTotal !== 100) {
				const diff = 100 - newTotal;
				const keysToAdjust = Object.keys(weights).filter((k) => k !== changedKey);
				if (keysToAdjust.length > 0) {
					const adjustKey = keysToAdjust[0];
					weights[adjustKey] += diff;
				}
			}
		}
	};

	// Reset weights to default for current business type
	const resetWeights = () => {
		weights = getDefaultWeights(businessType);
	};

	// Watch for business type changes and reset weights
	$effect(() => {
		weights = getDefaultWeights(businessType);
	});

	// Auto-save when any key input changes
	$effect(() => {
		// Read all reactive values to create dependencies
		void businessType; void businessName; void visionStatement; void differentiator;
		void JSON.stringify(financialGoals); void JSON.stringify(weights);
		void idealArea; void JSON.stringify(sacred); void JSON.stringify(flexible);
		void JSON.stringify(founderProfile); void JSON.stringify(creditProfile);
		void businessFormat; void liquidCapital; void monthlyPersonalExpenses; void externalFunding;
		autoSave();
	});

	// Location comparison state
	let locations = $state([
		{
			id: 1,
			address: '600 Sixth Avenue, Chelsea',
			analyzed: true,
			posRange: '62-78%',
			vlfScore: 72,
			glfScore: 68,
			rrScore: 75,
			rentSqft: 85,
			competitorCount: 3,
			transitAccess: 9,
			locationFeel: 8,
			verdict: 'Excellent'
		},
		{
			id: 2,
			address: '200 Fifth Avenue, Flatiron',
			analyzed: true,
			posRange: '68-84%',
			vlfScore: 78,
			glfScore: 74,
			rrScore: 72,
			rentSqft: 95,
			competitorCount: 5,
			transitAccess: 9,
			locationFeel: 7,
			verdict: 'Very Good'
		},
		{
			id: 3,
			address: '',
			analyzed: false
		},
		{
			id: 4,
			address: '',
			analyzed: false
		}
	]);

	const analyzeLocation = (id) => {
		const loc = locations.find((l) => l.id === id);
		if (loc && loc.address) {
			loc.analyzed = true;
			loc.posRange = `${Math.floor(Math.random() * 20) + 60}-${Math.floor(Math.random() * 20) + 78}%`;
			loc.vlfScore = Math.floor(Math.random() * 25) + 65;
			loc.glfScore = Math.floor(Math.random() * 25) + 60;
			loc.rrScore = Math.floor(Math.random() * 20) + 70;
			loc.rentSqft = Math.floor(Math.random() * 30) + 75;
			loc.competitorCount = Math.floor(Math.random() * 8) + 2;
			loc.transitAccess = Math.floor(Math.random() * 4) + 7;
			loc.locationFeel = Math.floor(Math.random() * 4) + 6;
			loc.verdict = ['Excellent', 'Very Good', 'Good'][Math.floor(Math.random() * 3)];
		}
	};

	const updateLocationAddress = (id, newAddress) => {
		const loc = locations.find((l) => l.id === id);
		if (loc) {
			loc.address = newAddress;
			loc.analyzed = false;
		}
	};

	// Ideal Space state
	let spaceType = $state('Standard Cafe (800-1500 sqft)');
	let sqftMin = $state(1000);
	let sqftMax = $state(1500);
	let monthlyRentBudget = $state(15000);
	let neighborhoodCharacteristics = $state({
		highFootTraffic: true,
		residentialDensity: false,
		officeCommercial: false,
		fitnessWellness: true,
		familyFriendly: true,
		nightlifeEntertainment: false,
		trendyEmerging: false,
		establishedStable: false
	});
	let idealArea = $state('Chelsea');
	let visibilityPreferences = $state({
		groundFloor: true,
		cornerLocation: false,
		nearSubway: false,
		outdoorSeating: false
	});

	// Location Preferences
	let locationPreferences = $state({
		numberOfTargetLocations: 1,
		preferredNeighborhoods: 'Chelsea, Flatiron',
		maxCommuteTime: 30,
		minFootTrafficThreshold: 5000
	});

	// Competitive Strategy
	let competitiveStrategy = $state({
		differentiators: {
			uniqueProduct: true,
			priceLeader: false,
			premiumExperience: true,
			healthWellness: true,
			technologyDriven: false,
			communityHub: true
		},
		targetSegments: {
			officeWorkers: true,
			families: false,
			students: false,
			healthEnthusiasts: true,
			remoteWorkers: true,
			tourists: false
		}
	});

	// Risk Tolerance
	let riskTolerance = $state({
		riskLevel: 50,
		maxMonthlyBurn: 15000,
		breakEvenTimeframe: '18mo'
	});

	const neighborhoodAreasList = [
		'Chelsea',
		'Flatiron',
		'SoHo',
		'West Village',
		'East Village',
		'Tribeca',
		'NoHo / Nolita',
		'Midtown',
		'UWS / UES',
		'Gramercy / Murray Hill',
		'LES / Chinatown',
		'Williamsburg',
		'DUMBO / Cobble Hill',
		'Park Slope',
		'Other'
	];
</script>

<svelte:head><title>RE² — Launch Pad</title></svelte:head>

<div class="page">
	<!-- Header -->
	<div class="page-header">
		<h1>LAUNCH PAD</h1>
		<p class="subtitle">Define your business, set goals, and configure the alignment engine</p>
	</div>

	{#if saveStatus}
		<div class="save-indicator">{saveStatus}</div>
	{/if}


	<!-- Quick Start Guide -->
	<div class="quick-start-guide">
		<h3>QUICK START GUIDE</h3>
		<div class="quick-start-steps">
			<a href="/app/vision/founder" class="quick-step">
				<span class="step-number">1</span>
				<span class="step-text">Review your vision below</span>
			</a>
			<div class="step-arrow">→</div>
			<a href="/app/location" class="quick-step">
				<span class="step-number">2</span>
				<span class="step-text">Check your Score for insights</span>
			</a>
			<div class="step-arrow">→</div>
			<a href="/app/recommendations" class="quick-step">
				<span class="step-number">3</span>
				<span class="step-text">See Recommendations for action items</span>
			</a>
		</div>
	</div>

	<!-- Main Content -->
	<div class="content">
		<!-- Module 1: Founder Profile & Psychology Engine -->
		<FounderProfile bind:founderProfile {founderProfileComplete} onchange={autoSave} />

		<!-- Module 2: Credit Profile -->
		<CreditProfile bind:creditProfile onchange={autoSave} />

		<!-- Section 1: Business Identity -->
		<section class="section">
			<div class="section-context-paragraph">
				Your business identity is the foundation of everything. The type of business you're building determines which neighborhoods, rent levels, and customer demographics are right for you. Be specific — vague visions produce vague recommendations.
			</div>
			<div class="section-header">
				<h2>Business Identity</h2>
			</div>

			<div class="section-content">
				<div class="grid grid-2col">
					<!-- Left Column -->
					<div class="col">
						<div class="form-group">
							<label for="businessType">Business Type</label>
							<select bind:value={businessType} id="businessType" oninput={triggerSave}>
								{#each businessTypes as type}
									<option value={type}>{type}</option>
								{/each}
							</select>
						</div>

						<div class="form-group">
							<label for="businessName">Business Name</label>
							<input
								type="text"
								id="businessName"
								bind:value={businessName}
								placeholder="Your business name"
								oninput={triggerSave}
							/>
						</div>

						<div class="form-group">
							<label for="vision">Vision Statement</label>
							<textarea
								id="vision"
								bind:value={visionStatement}
								rows="3"
								placeholder="Describe your vision..."
								oninput={triggerSave}
							></textarea>
						</div>
					</div>

					<!-- Right Column -->
					<div class="col">
						<div class="form-group">
							<label for="differentiator">Differentiator</label>
							<textarea
								id="differentiator"
								bind:value={differentiator}
								rows="3"
								placeholder="What makes you unique..."
								oninput={triggerSave}
							></textarea>
						</div>

						<div class="form-group">
							<div class="label-with-helper">
								<label>Sacred vs Flexible</label>
								<div class="helper-text">
									<span class="helper-item">
										<strong>Sacred:</strong> Algorithm will NEVER suggest changing
									</span>
									<span class="helper-divider">·</span>
									<span class="helper-item">
										<strong>Flexible:</strong> Algorithm MAY suggest adjustments to improve odds
									</span>
								</div>
							</div>
							<div class="toggles-row">
								<div class="chip" class:active={sacred.brand} title="Sacred: Algorithm will NEVER suggest changing this">
									<input
										type="checkbox"
										id="sacred-brand"
										bind:checked={sacred.brand}
										onchange={triggerSave}
									/>
									<label for="sacred-brand">Brand</label>
								</div>
								<div class="chip" class:active={sacred.coreProduct} title="Sacred: Algorithm will NEVER suggest changing this">
									<input
										type="checkbox"
										id="sacred-core"
										bind:checked={sacred.coreProduct}
										onchange={triggerSave}
									/>
									<label for="sacred-core">Core Product</label>
								</div>
								<div class="chip" class:active={flexible.pricing} title="Flexible: Algorithm MAY suggest adjustments to improve your odds">
									<input
										type="checkbox"
										id="flex-pricing"
										bind:checked={flexible.pricing}
										onchange={triggerSave}
									/>
									<label for="flex-pricing">Pricing</label>
								</div>
								<div class="chip" class:active={flexible.hours} title="Flexible: Algorithm MAY suggest adjustments to improve your odds">
									<input
										type="checkbox"
										id="flex-hours"
										bind:checked={flexible.hours}
										onchange={triggerSave}
									/>
									<label for="flex-hours">Hours</label>
								</div>
								<div class="chip" class:active={flexible.format} title="Flexible: Algorithm MAY suggest adjustments to improve your odds">
									<input
										type="checkbox"
										id="flex-format"
										bind:checked={flexible.format}
										onchange={triggerSave}
									/>
									<label for="flex-format">Format</label>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Section 2: Financial Goals -->
		<section class="section">
			<div class="section-context-paragraph">
				These numbers drive the entire feasibility analysis. Your take-home target determines how much revenue you need, which determines the location's foot traffic requirements. Be realistic — optimistic projections lead to bad lease decisions.
			</div>
			<div class="section-header">
				<h2>Financial Goals</h2>
			</div>

			<div class="section-content">
				<!-- Revenue & Profitability Targets -->
				<div class="subsection">
					<h3 class="subsection-title">Revenue & Profitability Targets</h3>
					<div class="grid grid-3col">
						<div class="form-group">
							<label for="sde">Owner's Take-Home (Year 1)</label>
							<input
								type="number"
								id="sde"
								bind:value={financialGoals.targetSDE}
								placeholder="250000"
								oninput={triggerSave}
							/>
							<span class="input-helper">Your target seller discretionary earnings</span>
						</div>
						<div class="form-group">
							<label for="y1rev">Revenue Year 1</label>
							<input
								type="number"
								id="y1rev"
								bind:value={financialGoals.revenueY1}
								placeholder="950000"
								oninput={triggerSave}
							/>
							<span class="input-helper">First-year total revenue target</span>
						</div>
						<div class="form-group">
							<label for="y3rev">Revenue Year 3</label>
							<input
								type="number"
								id="y3rev"
								bind:value={financialGoals.revenueY3}
								placeholder="1600000"
								oninput={triggerSave}
							/>
							<span class="input-helper">Three-year revenue projection</span>
						</div>
					</div>
				</div>

				<!-- Transaction Targets -->
				<div class="subsection">
					<h3 class="subsection-title">Transaction Targets</h3>
					<div class="grid grid-2col">
						<div class="form-group">
							<label for="dtx">Daily Transactions</label>
							<input
								type="number"
								id="dtx"
								bind:value={financialGoals.dailyTransactions}
								placeholder="500"
								oninput={triggerSave}
							/>
							<span class="input-helper">Drives foot traffic requirements and location scoring</span>
						</div>
						<div class="form-group">
							<label for="avgticket">Average Ticket Size</label>
							<input
								type="number"
								id="avgticket"
								bind:value={financialGoals.avgTicket}
								placeholder="8.75"
								step="0.01"
								oninput={triggerSave}
							/>
							<span class="input-helper">Your average transaction value</span>
						</div>
					</div>
				</div>

				<!-- Expansion & Space -->
				<div class="subsection">
					<h3 class="subsection-title">Expansion & Space Planning</h3>
					<div class="grid grid-3col">
						<div class="form-group">
							<label for="locations">Number of Target Locations</label>
							<input
								type="number"
								id="locations"
								bind:value={financialGoals.numberOfLocations}
								placeholder="1"
								min="1"
								max="10"
								oninput={triggerSave}
							/>
							<span class="input-helper">Planning for multiple locations enables expansion sequencing</span>
						</div>
						<div class="form-group">
							<label for="sqft">Square Footage</label>
							<input
								type="number"
								id="sqft"
								bind:value={financialGoals.squareFootage}
								placeholder="1200"
								oninput={triggerSave}
							/>
							<span class="input-helper">Target space size in square feet</span>
						</div>
						<div class="form-group">
							<label for="teamSize">Target Team Size</label>
							<input
								type="number"
								id="teamSize"
								bind:value={financialGoals.teamSize}
								placeholder="5"
								oninput={triggerSave}
							/>
							<span class="input-helper">FTEs needed for first location</span>
						</div>
					</div>
				</div>

				<!-- Investment & Capital -->
				<div class="subsection">
					<h3 class="subsection-title">Investment & Capital</h3>
					<div class="grid grid-3col">
						<div class="form-group">
							<label for="startupCapital">Total Startup Capital Available</label>
							<input
								type="number"
								id="startupCapital"
								bind:value={financialGoals.startupCapital}
								placeholder="150000"
								oninput={triggerSave}
							/>
							<span class="input-helper">Total capital you can deploy</span>
						</div>
						<div class="form-group">
							<label for="personalInvestment">Personal Investment Amount</label>
							<input
								type="number"
								id="personalInvestment"
								bind:value={financialGoals.personalInvestment}
								placeholder="50000"
								oninput={triggerSave}
							/>
							<span class="input-helper">Your personal equity in the deal</span>
						</div>
						<div class="form-group">
							<label for="emergencyReserve">Emergency Reserve (months)</label>
							<input
								type="number"
								id="emergencyReserve"
								bind:value={financialGoals.emergencyReserveMonths}
								placeholder="6"
								min="3"
								max="24"
								oninput={triggerSave}
							/>
							<span class="input-helper">Months of operating expenses to reserve</span>
						</div>
					</div>
				</div>

				<!-- Space & Rent Budget -->
				<div class="subsection">
					<h3 class="subsection-title">Space & Rent Budget</h3>
					<div class="grid grid-2col">
						<div class="form-group">
							<label for="rentBudget2">Monthly Rent Budget</label>
							<input
								type="number"
								id="rentBudget2"
								bind:value={financialGoals.monthlyRentBudget}
								placeholder="15000"
								oninput={triggerSave}
							/>
							<span class="input-helper">Maximum acceptable monthly rent</span>
						</div>
						<div class="form-group">
							<label for="buildout">Buildout Budget</label>
							<input
								type="number"
								id="buildout"
								bind:value={financialGoals.buildoutBudget}
								placeholder="50000"
								oninput={triggerSave}
							/>
							<span class="input-helper">Budget for tenant improvements</span>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Section 3: Non-Financial Goals -->
		<section class="section">
			<div class="section-context-paragraph">
				Non-financial goals shape which neighborhoods align with your vision beyond just economics. A community-focused cafe needs different things than a grab-and-go kiosk.
			</div>
			<div class="section-header">
				<h2>Non-Financial Goals</h2>
			</div>

			<div class="section-content">
				<div class="grid grid-2col">
					<div class="form-group">
						<label for="community">Community Impact</label>
						<input
							type="text"
							id="community"
							bind:value={communityImpact}
							placeholder="Community impact goal..."
						/>
					</div>
					<div class="form-group">
						<label for="branding">Brand Positioning</label>
						<input
							type="text"
							id="branding"
							bind:value={brandPositioning}
							placeholder="Brand positioning..."
						/>
					</div>
					<div class="form-group">
						<label for="team">Team / Employment</label>
						<input
							type="text"
							id="team"
							bind:value={teamEmployment}
							placeholder="Employment goals..."
						/>
					</div>
				</div>
			</div>
		</section>

		<!-- Section 4: Alignment Engine Weights -->
		<AlignmentWeights bind:weights onbalance={balanceWeights} onreset={resetWeights} onsave={triggerSave} />

		<!-- Section 4.5: Ideal Space -->
		<section class="section">
			<div class="section-context-paragraph">
				The physical space you need directly impacts your rent budget, buildout cost, and which neighborhoods have suitable inventory. A 200 sqft kiosk is available everywhere. A 3000 sqft flagship limits you to specific blocks.
			</div>
			<div class="section-header">
				<h2>Your Ideal Space</h2>
			</div>

			<div class="section-content">
				<!-- Space Type Radio Buttons -->
				<div class="form-group" style="margin-bottom: 1.5rem;">
					<label style="margin-bottom: 0.6rem;">Space Type</label>
					<div class="radio-group">
						<div class="radio-item">
							<input
								type="radio"
								id="space-kiosk"
								value="Kiosk / Counter-only (50-200 sqft)"
								bind:group={spaceType}
								name="spaceType"
							/>
							<label for="space-kiosk">
								<strong>Kiosk / Counter-only (50-200 sqft)</strong>
								<span class="radio-desc">Test the concept with minimal investment</span>
							</label>
						</div>
						<div class="radio-item">
							<input
								type="radio"
								id="space-compact"
								value="Compact Cafe (200-400 sqft)"
								bind:group={spaceType}
								name="spaceType"
							/>
							<label for="space-compact">
								<strong>Compact Cafe (200-400 sqft)</strong>
								<span class="radio-desc">Counter-service with limited seating</span>
							</label>
						</div>
						<div class="radio-item">
							<input
								type="radio"
								id="space-small"
								value="Small Cafe (400-800 sqft)"
								bind:group={spaceType}
								name="spaceType"
							/>
							<label for="space-small">
								<strong>Small Cafe (400-800 sqft)</strong>
								<span class="radio-desc">Focused menu, grab-and-go emphasis</span>
							</label>
						</div>
						<div class="radio-item">
							<input
								type="radio"
								id="space-standard"
								value="Standard Cafe (800-1500 sqft)"
								bind:group={spaceType}
								name="spaceType"
								checked
							/>
							<label for="space-standard">
								<strong>Standard Cafe (800-1500 sqft)</strong>
								<span class="radio-desc">Full menu with limited seating</span>
							</label>
						</div>
						<div class="radio-item">
							<input
								type="radio"
								id="space-large"
								value="Large Cafe + Community (1500-3000 sqft)"
								bind:group={spaceType}
								name="spaceType"
							/>
							<label for="space-large">
								<strong>Large Cafe + Community (1500-3000 sqft)</strong>
								<span class="radio-desc">Full menu, seating, community events space</span>
							</label>
						</div>
						<div class="radio-item">
							<input
								type="radio"
								id="space-flagship"
								value="Flagship (3000+ sqft)"
								bind:group={spaceType}
								name="spaceType"
							/>
							<label for="space-flagship">
								<strong>Flagship (3000+ sqft)</strong>
								<span class="radio-desc">Full experience: cafe, events, co-working, retail</span>
							</label>
						</div>
					</div>
				</div>

				<!-- Square Footage Range -->
				<div class="grid grid-2col" style="margin-bottom: 1.5rem;">
					<div class="form-group">
						<label for="sqftMin">Square Footage Range — Min</label>
						<input
							type="number"
							id="sqftMin"
							bind:value={sqftMin}
							placeholder="1000"
						/>
					</div>
					<div class="form-group">
						<label for="sqftMax">Square Footage Range — Max</label>
						<input
							type="number"
							id="sqftMax"
							bind:value={sqftMax}
							placeholder="1500"
						/>
					</div>
				</div>

				<!-- Monthly Rent Budget -->
				<div class="form-group" style="margin-bottom: 1.5rem;">
					<label for="rentBudget">Monthly Rent Budget</label>
					<input
						type="number"
						id="rentBudget"
						bind:value={monthlyRentBudget}
						placeholder="15000"
					/>
				</div>

				<!-- Neighborhood Characteristics -->
				<div class="form-group" style="margin-bottom: 1.5rem;">
					<label style="margin-bottom: 0.6rem;">Ideal Neighborhood Characteristics (select all that apply)</label>
					<div class="checkbox-grid">
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="char-traffic"
								bind:checked={neighborhoodCharacteristics.highFootTraffic}
							/>
							<label for="char-traffic">High foot traffic (transit hub, busy street)</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="char-residential"
								bind:checked={neighborhoodCharacteristics.residentialDensity}
							/>
							<label for="char-residential">Residential density (apartment buildings, families)</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="char-office"
								bind:checked={neighborhoodCharacteristics.officeCommercial}
							/>
							<label for="char-office">Office/commercial (weekday workers, lunch crowd)</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="char-fitness"
								bind:checked={neighborhoodCharacteristics.fitnessWellness}
							/>
							<label for="char-fitness">Fitness/wellness ecosystem (gyms, yoga, health food)</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="char-family"
								bind:checked={neighborhoodCharacteristics.familyFriendly}
							/>
							<label for="char-family">Family-friendly (schools, parks, playgrounds)</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="char-nightlife"
								bind:checked={neighborhoodCharacteristics.nightlifeEntertainment}
							/>
							<label for="char-nightlife">Nightlife/entertainment (bars, restaurants, evening traffic)</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="char-trendy"
								bind:checked={neighborhoodCharacteristics.trendyEmerging}
							/>
							<label for="char-trendy">Trendy/emerging (new businesses, rising neighborhood)</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="char-established"
								bind:checked={neighborhoodCharacteristics.establishedStable}
							/>
							<label for="char-established">Established/stable (mature businesses, loyal residents)</label>
						</div>
					</div>
				</div>

				<!-- Ideal General Area -->
				<div class="form-group" style="margin-bottom: 1.5rem;">
					<label for="idealArea">Ideal General Area</label>
					<select bind:value={idealArea} id="idealArea">
						{#each neighborhoodAreasList as area}
							<option value={area}>{area}</option>
						{/each}
					</select>
				</div>

				<!-- Visibility Preferences -->
				<div class="form-group">
					<label style="margin-bottom: 0.6rem;">Visibility Preferences</label>
					<div class="checkbox-grid">
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="vis-ground"
								bind:checked={visibilityPreferences.groundFloor}
							/>
							<label for="vis-ground">Ground floor (street-level)</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="vis-corner"
								bind:checked={visibilityPreferences.cornerLocation}
							/>
							<label for="vis-corner">Corner location</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="vis-subway"
								bind:checked={visibilityPreferences.nearSubway}
							/>
							<label for="vis-subway">Near subway entrance</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="vis-outdoor"
								bind:checked={visibilityPreferences.outdoorSeating}
							/>
							<label for="vis-outdoor">Outdoor seating potential</label>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Section 5: Location Preferences -->
		<section class="section">
			<div class="section-context-paragraph">
				Define your expansion and location search strategy. Multi-location planning unlocks different site profiles and economies of scale than single-site searches.
			</div>
			<div class="section-header">
				<h2>Location Preferences</h2>
			</div>

			<div class="section-content">
				<div class="grid grid-2col">
					<div class="form-group">
						<label for="numLocations">Number of Target Locations (Expansion Plan)</label>
						<input
							type="number"
							id="numLocations"
							bind:value={locationPreferences.numberOfTargetLocations}
							placeholder="1"
							min="1"
							max="10"
						/>
						<span class="input-helper">Planning for multiple locations enables our model to recommend expansion sequencing</span>
					</div>

					<div class="form-group">
						<label for="maxCommute">Max Commute Time (minutes)</label>
						<input
							type="number"
							id="maxCommute"
							bind:value={locationPreferences.maxCommuteTime}
							placeholder="30"
							min="5"
							max="120"
						/>
						<span class="input-helper">Maximum acceptable commute from your base</span>
					</div>
				</div>

				<div class="grid grid-2col">
					<div class="form-group">
						<label for="neighborhoods">Preferred Neighborhoods (comma-separated)</label>
						<input
							type="text"
							id="neighborhoods"
							bind:value={locationPreferences.preferredNeighborhoods}
							placeholder="Chelsea, Flatiron, West Village"
						/>
						<span class="input-helper">Focus your search geographically</span>
					</div>

					<div class="form-group">
						<label for="footTraffic">Minimum Foot Traffic Threshold (daily)</label>
						<input
							type="number"
							id="footTraffic"
							bind:value={locationPreferences.minFootTrafficThreshold}
							placeholder="5000"
							min="1000"
							step="500"
						/>
						<span class="input-helper">Minimum daily pedestrian traffic to qualify</span>
					</div>
				</div>
			</div>
		</section>

		<!-- Section 6: Competitive Strategy -->
		<CompetitiveStrategy bind:competitiveStrategy />

		<!-- Section 7: Risk Tolerance -->
		<RiskTolerance bind:riskTolerance />

		<!-- How This Feeds Your Analysis -->
		<div class="info-box">
			<div class="info-icon">📊</div>
			<div class="info-content">
				<h3>How This Feeds Your Analysis</h3>
				<p>Your Launch Pad inputs drive three core outputs:</p>
				<ul class="info-list">
					<li><strong>Recommendations:</strong> Based on your financial targets, risk tolerance, and differentiators, we suggest neighborhoods and specific locations that align with your business model.</li>
					<li><strong>Financials:</strong> Your revenue, transaction, and expense targets are modeled against typical location-based unit economics to validate feasibility.</li>
					<li><strong>Loan Readiness:</strong> Your startup capital, personal investment, and break-even timeline inform SBA lending strategy and debt capacity recommendations.</li>
				</ul>
				<p style="margin-top: 1rem; font-size: 14px; color: #a1a1a6;">Change any value above and re-run the analysis to see how sensitive your location recommendations are to your assumptions.</p>
			</div>
		</div>

	</div>
</div>

<style>
	:global(body) {
		background-color: #f5f5f7;
		color: #1d1d1f;
	}

	.save-indicator {
		position: fixed;
		top: 60px;
		right: 24px;
		background: rgba(29, 209, 161, 0.15);
		color: #1dd1a1;
		padding: 6px 16px;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 500;
		z-index: 100;
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.5rem 1rem;
		background-color: #f5f5f7;
		color: #1d1d1f;
	}

	.page-header {
		margin-bottom: 2rem;
		border-bottom: 1px solid #d2d2d7;
		padding-bottom: 1rem;
	}

	.page-header h1 {
		font-family: 'Syne', sans-serif;
		font-size: 22px;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		color: #fff;
		letter-spacing: 0.5px;
	}

	.page-header .subtitle {
		font-family: 'Courier New', monospace;
		font-size: 15px;
		margin: 0;
		color: #a1a1a6;
		letter-spacing: 0.3px;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.section {
		background-color: #ffffff;
		border: 1px solid #d2d2d7;
		border-radius: 4px;
		overflow: hidden;
	}

	.section-context-paragraph {
		padding: 1rem;
		background-color: #f5f5f7;
		border-bottom: 1px solid #d2d2d7;
		font-size: 15px;
		color: #86868b;
		line-height: 1.6;
	}

	.section-header {
		padding: 1rem;
		background-color: #ffffff;
		border-bottom: 1px solid #d2d2d7;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-header h2 {
		font-size: 15px;
		font-weight: 700;
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: #6e6e73;
	}

	.weight-subtitle {
		font-family: 'Courier New', monospace;
		font-size: 14px;
		color: #86868b;
		margin: 0.4rem 0 0 0;
		letter-spacing: 0.3px;
	}

	.btn-reset {
		font-size: 14px;
		padding: 0.4rem 0.8rem;
		background-color: #d2d2d7;
		border: 1px solid #555;
		color: #1d1d1f;
		cursor: pointer;
		border-radius: 2px;
		font-weight: 600;
		transition: all 0.2s;
	}

	.btn-reset:hover {
		background-color: #d2d2d7;
		border-color: #d2d2d7;
	}

	.section-content {
		padding: 1rem;
	}

	.grid {
		display: grid;
		gap: 1rem;
	}

	.grid-2col {
		grid-template-columns: repeat(2, 1fr);
	}

	.grid-3col {
		grid-template-columns: repeat(3, 1fr);
	}

	.col {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.form-group label {
		font-family: 'Courier New', monospace;
		font-size: 15px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #86868b;
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		padding: 12px 16px;
		background-color: #f5f5f7;
		border: 1px solid #d2d2d7;
		color: #1d1d1f;
		font-size: 15px;
		font-family: inherit;
		border-radius: 2px;
		transition: all 0.2s;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		outline: none;
		border-color: #e74c3c;
		background-color: #ffffff;
	}

	.form-group textarea {
		resize: vertical;
		font-family: inherit;
	}

	.toggles-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.6rem;
		background-color: #e8e8ed;
		border: 1px solid #d2d2d7;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 15px;
	}

	.chip:hover {
		background-color: #d2d2d7;
		border-color: #555;
	}

	.chip.active {
		background-color: #e74c3c;
		border-color: #e74c3c;
		color: #fff;
	}

	/* Flexible chips get a different color when active */
	.chip[title*="Flexible"].active {
		background-color: #00b894;
		border-color: #00b894;
		color: #fff;
	}

	.chip input {
		display: none;
	}

	.chip label {
		cursor: pointer;
		font-weight: 600;
		color: inherit;
	}

	/* Sliders Grid */
	.sliders-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1.2rem;
		margin-bottom: 1.5rem;
	}

	.slider-item {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.slider-label {
		font-size: 15px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #a1a1a6;
	}

	.slider-value {
		font-family: 'Courier New', monospace;
		font-size: 15px;
		font-weight: 700;
		color: #fff;
	}

	.slider {
		width: 100%;
		height: 4px;
		background: #d2d2d7;
		border-radius: 2px;
		outline: none;
		-webkit-appearance: none;
		appearance: none;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		background: #e74c3c;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s;
	}

	.slider::-webkit-slider-thumb:hover {
		background: #ff6b5a;
		transform: scale(1.1);
	}

	.slider::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: #e74c3c;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.slider::-moz-range-thumb:hover {
		background: #ff6b5a;
		transform: scale(1.1);
	}

	.slider-desc {
		font-family: 'Courier New', monospace;
		font-size: 13px;
		color: #86868b;
		line-height: 1.2;
	}

	/* Weight Bar */
	.weight-bar-container {
		margin-top: 1.5rem;
	}

	.weight-bar-bg {
		display: flex;
		height: 20px;
		background-color: #e8e8ed;
		border: 1px solid #d2d2d7;
		border-radius: 2px;
		overflow: hidden;
		gap: 0;
	}

	.weight-segment {
		flex: 1;
		transition: width 0.3s ease;
		opacity: 0.9;
	}

	.weight-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.4rem;
		font-family: 'Courier New', monospace;
		font-size: 13px;
		color: #86868b;
	}

	/* Location Comparison */
	.location-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.location-slot {
		background-color: #f5f5f7;
		border: 1px solid #d2d2d7;
		border-radius: 2px;
		padding: 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.location-input {
		padding: 0.5rem;
		background-color: #f5f5f7;
		border: 1px solid #d2d2d7;
		color: #1d1d1f;
		font-size: 15px;
		border-radius: 2px;
	}

	.location-input:focus {
		outline: none;
		border-color: #e74c3c;
	}

	.btn-analyze {
		padding: 0.4rem;
		background-color: #e74c3c;
		border: 1px solid #e74c3c;
		color: #fff;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		border-radius: 2px;
		transition: all 0.2s;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.btn-analyze:hover:not(:disabled) {
		background-color: #ff6b5a;
		border-color: #ff6b5a;
	}

	.btn-analyze:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.location-preview {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 14px;
	}

	.verdict-badge {
		display: inline-block;
		padding: 0.2rem 0.4rem;
		border-radius: 2px;
		font-weight: 700;
		font-size: 13px;
		text-transform: uppercase;
		width: fit-content;
	}

	.verdict-badge.excellent {
		background-color: rgba(39, 174, 96, 0.3);
		color: #27ae60;
	}

	.verdict-badge.verygood {
		background-color: rgba(41, 128, 185, 0.3);
		color: #2980b9;
	}

	.preview-metric {
		color: #a1a1a6;
	}

	/* Comparison Table */
	.comparison-table-wrapper {
		overflow-x: auto;
		border: 1px solid #d2d2d7;
		border-radius: 2px;
	}

	.comparison-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 15px;
	}

	.comparison-table thead {
		background-color: #e8e8ed;
		border-bottom: 1px solid #d2d2d7;
	}

	.comparison-table th {
		padding: 0.6rem;
		text-align: left;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #a1a1a6;
		font-size: 12px;
	}

	.comparison-table td {
		padding: 0.6rem;
		border-bottom: 1px solid #d2d2d7;
		color: #1d1d1f;
	}

	.comparison-table tbody tr:hover {
		background-color: #e8e8ed;
	}

	.comparison-table td.addr {
		font-weight: 600;
		color: #1d1d1f;
	}

	/* Subsection Styles */
	.subsection {
		margin-bottom: 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #d2d2d7;
	}

	.subsection:last-child {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.subsection-title {
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #a1a1a6;
		margin: 0 0 0.8rem 0;
	}

	/* Input Helper Text */
	.input-helper {
		font-size: 13px;
		color: #777;
		margin-top: 0.3rem;
		display: block;
		font-weight: 400;
		font-family: 'Courier New', monospace;
	}

	/* Risk Slider Styles */
	.risk-slider-container {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.8rem;
	}

	.risk-label {
		font-size: 13px;
		color: #86868b;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		white-space: nowrap;
		width: 100px;
	}

	.risk-slider {
		flex: 1;
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(to right, #e74c3c 0%, #f39c12 50%, #27ae60 100%);
		outline: none;
		-webkit-appearance: none;
		appearance: none;
	}

	.risk-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
		border: 2px solid #d2d2d7;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
	}

	.risk-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
		border: 2px solid #d2d2d7;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
	}

	.risk-value-display {
		font-size: 14px;
		color: #1d1d1f;
		padding-top: 0.5rem;
		border-top: 1px solid #d2d2d7;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.risk-value-display strong {
		color: #1d1d1f;
		font-size: 16px;
	}

	.risk-description {
		font-size: 13px;
		color: #86868b;
		font-weight: 600;
		margin-left: 1rem;
	}

	/* Info Box */
	.info-box {
		background: linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(39, 174, 96, 0.1) 100%);
		border: 1px solid rgba(0, 217, 255, 0.3);
		border-radius: 4px;
		padding: 1.5rem;
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		margin-top: 1.5rem;
		margin-bottom: 2rem;
	}

	.info-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.info-content {
		flex: 1;
	}

	.info-content h3 {
		font-size: 15px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #1d1d1f;
		margin: 0 0 0.8rem 0;
	}

	.info-content p {
		font-size: 14px;
		color: #a1a1a6;
		margin: 0 0 0.8rem 0;
		line-height: 1.6;
	}

	.info-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.info-list li {
		font-size: 14px;
		color: #a1a1a6;
		margin-bottom: 0.6rem;
		line-height: 1.6;
		padding-left: 1.2rem;
		position: relative;
	}

	.info-list li:before {
		content: '▪';
		position: absolute;
		left: 0;
		color: #00d9ff;
	}

	/* Label with Helper */
	.label-with-helper {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.label-with-helper label {
		flex: 1;
		margin-bottom: 0;
	}

	.label-with-helper .helper-text {
		display: flex;
		gap: 0.5rem;
		font-size: 13px;
		color: #777;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.helper-item {
		font-weight: 600;
	}

	.helper-divider {
		color: #555;
	}

	/* Responsive */
	@media (max-width: 1024px) {
		.grid-2col,
		.grid-3col {
			grid-template-columns: 1fr;
		}

		.sliders-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.location-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* Case Study Banner */
	.case-study-banner {
		background-color: rgba(232, 112, 64, 0.1);
		border: 1px solid rgba(232, 112, 64, 0.3);
		border-radius: 4px;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.banner-content {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	.banner-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.banner-text {
		font-size: 15px;
	}

	.banner-text strong {
		color: #e8704c;
		display: block;
		margin-bottom: 0.3rem;
	}

	.banner-text p {
		margin: 0;
		color: #a1a1a6;
	}

	/* Quick Start Guide */
	.quick-start-guide {
		background-color: #ffffff;
		border: 1px solid #d2d2d7;
		border-radius: 4px;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.quick-start-guide h3 {
		font-size: 15px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #86868b;
		margin: 0 0 0.8rem 0;
	}

	.quick-start-steps {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		flex-wrap: wrap;
	}

	.quick-step {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.75rem;
		background-color: #f5f5f7;
		border: 1px solid #d2d2d7;
		border-radius: 3px;
		text-decoration: none;
		color: #a1a1a6;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.quick-step:hover {
		border-color: #e74c3c;
		color: #e74c3c;
	}

	.step-number {
		font-weight: 700;
		background-color: #d2d2d7;
		padding: 0.2rem 0.4rem;
		border-radius: 2px;
		color: #fff;
	}

	.step-arrow {
		color: #555;
		font-weight: 700;
	}

	.label-with-helper {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.helper-text {
		display: flex;
		gap: 0.5rem;
		font-size: 13px;
		color: #86868b;
		flex-wrap: wrap;
		align-items: center;
	}

	.helper-item {
		font-family: 'Courier New', monospace;
	}

	.helper-divider {
		color: #555;
	}

	/* Radio Buttons */
	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.radio-item {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.6rem;
		background-color: #f5f5f7;
		border: 1px solid #d2d2d7;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.radio-item:hover {
		background-color: #ffffff;
		border-color: #d2d2d7;
	}

	.radio-item input[type='radio'] {
		margin-top: 0.2rem;
		cursor: pointer;
		flex-shrink: 0;
		width: 16px;
		height: 16px;
	}

	.radio-item label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		cursor: pointer;
		flex: 1;
	}

	.radio-item label strong {
		font-weight: 600;
		color: #1d1d1f;
	}

	.radio-desc {
		font-size: 15px;
		color: #86868b;
		font-weight: 400;
	}

	/* Checkbox Grid */
	.checkbox-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.8rem;
	}

	.checkbox-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem;
		background-color: #f5f5f7;
		border: 1px solid #d2d2d7;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.checkbox-item:hover {
		background-color: #ffffff;
		border-color: #d2d2d7;
	}

	.checkbox-item input[type='checkbox'] {
		cursor: pointer;
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.checkbox-item label {
		cursor: pointer;
		font-size: 14px;
		flex: 1;
	}

	.recommendation-suggestion {
		background-color: #ffffff;
		border: 1px solid #d2d2d7;
		border-radius: 4px;
		padding: 1.5rem;
		margin-top: 1.5rem;
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	.suggestion-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.suggestion-content {
		flex: 1;
	}

	.suggestion-content p {
		margin: 0 0 0.8rem 0;
		font-size: 15px;
		color: #1d1d1f;
		font-weight: 500;
	}

	.suggestion-link {
		font-size: 14px;
		color: #00d9ff;
		text-decoration: none;
		font-weight: 600;
		transition: color 0.2s;
	}

	.suggestion-link:hover {
		color: #00e8cc;
	}

	@media (max-width: 768px) {
		.page {
			padding: 1rem 0.75rem;
		}

		.page-header h1 {
			font-size: 18px;
		}

		.sliders-grid {
			grid-template-columns: 1fr;
		}

		.checkbox-grid {
			grid-template-columns: 1fr;
		}

		.section-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.btn-reset {
			align-self: flex-start;
		}

		.quick-start-steps {
			flex-direction: column;
			gap: 0.5rem;
		}

		.step-arrow {
			display: none;
		}
	}

	/* ── Founder Profile & Credit Profile Styles ── */
	.section-badge {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		padding: 3px 10px;
		border-radius: 4px;
		background: rgba(245, 158, 11, 0.15);
		color: #f59e0b;
	}

	.section-badge.complete {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}

	.section-badge.privacy {
		background: rgba(59, 130, 246, 0.15);
		color: #3b82f6;
	}

	.profile-question {
		margin-bottom: 28px;
	}

	.profile-q-label {
		font-size: 15px;
		font-weight: 600;
		color: #1d1d1f;
		margin: 0 0 12px 0;
	}

	.card-options {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 10px;
	}

	.card-options-3 {
		grid-template-columns: repeat(3, 1fr);
	}

	.card-options-5 {
		grid-template-columns: repeat(5, 1fr);
	}

	.profile-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 14px 16px;
		background: #ffffff;
		border: 1px solid #d2d2d7;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
	}

	.profile-card:hover {
		border-color: #d2d2d7;
		background: #f0f0f5;
	}

	.profile-card.selected {
		border-color: #00ff88;
		background: rgba(0, 255, 136, 0.06);
		box-shadow: 0 0 0 1px rgba(0, 255, 136, 0.2);
	}

	.profile-card-sm {
		padding: 10px 12px;
		text-align: center;
		align-items: center;
	}

	.card-title {
		font-size: 14px;
		font-weight: 700;
		color: #fff;
	}

	.card-desc {
		font-size: 11px;
		color: #6b7280;
		line-height: 1.4;
	}

	.profile-card.selected .card-desc {
		color: #9ca3af;
	}

	.coaching-callout {
		display: flex;
		gap: 12px;
		padding: 14px 18px;
		background: rgba(0, 255, 136, 0.05);
		border: 1px solid rgba(0, 255, 136, 0.15);
		border-radius: 8px;
		margin-top: 8px;
	}

	.coaching-callout.coaching-warning {
		background: rgba(245, 158, 11, 0.05);
		border-color: rgba(245, 158, 11, 0.15);
	}

	.coaching-callout.coaching-info {
		background: rgba(59, 130, 246, 0.05);
		border-color: rgba(59, 130, 246, 0.15);
	}

	.coaching-callout.coaching-success {
		background: rgba(16, 185, 129, 0.05);
		border-color: rgba(16, 185, 129, 0.15);
	}

	.coaching-icon {
		font-size: 18px;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.coaching-text {
		font-size: 13px;
		color: #9ca3af;
		line-height: 1.5;
	}

	.coaching-text strong {
		color: #1d1d1f;
	}

	.credit-flags {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 16px;
	}

	.credit-flag {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		color: #9ca3af;
		cursor: pointer;
	}

	.credit-flag input[type="checkbox"] {
		width: 16px;
		height: 16px;
		accent-color: #00ff88;
		cursor: pointer;
	}

	.privacy-notice {
		font-size: 11px;
		color: #6b7280;
		margin-top: 16px;
		padding: 10px 14px;
		background: rgba(59, 130, 246, 0.04);
		border-radius: 6px;
		border: 1px solid rgba(59, 130, 246, 0.08);
	}

	@media (max-width: 640px) {
		.card-options, .card-options-3, .card-options-5 {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 420px) {
		.card-options, .card-options-3, .card-options-5 {
			grid-template-columns: 1fr;
		}
	}
</style>
