<script>
	import { onMount } from 'svelte';
	import { loadLaunchPadData, saveLaunchPadData } from '$lib/launchpad-store';
	import { CONCEPT_KPIS } from '$lib/constants/conceptKPIs';
	import { getConceptDefaults } from '$lib/constants/conceptDefaults';

	let saveStatus = $state('');
	let loaded = $state(false);

	function triggerSave() {
		saveStatus = 'Saving...';
		saveLaunchPadData({
			financialGoals: { ...financialGoals, liquidCapital, monthlyPersonalExpenses, externalFunding },
			idealArea,
			spaceType,
			sqftMin,
			sqftMax,
			monthlyRentBudget,
			neighborhoodCharacteristics,
			visibilityPreferences,
			locationPreferences
		});
		setTimeout(() => { saveStatus = 'Auto-saved ✓'; }, 300);
		setTimeout(() => { saveStatus = ''; }, 2500);
	}

	let saveTimer = null;
	function autoSave() {
		if (!loaded) return;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(triggerSave, 1000);
	}

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

	let liquidCapital = $state(80000);
	let monthlyPersonalExpenses = $state(5000);
	let externalFunding = $state(0);

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

	let locationPreferences = $state({
		numberOfTargetLocations: 1,
		preferredNeighborhoods: 'Chelsea, Flatiron',
		maxCommuteTime: 30,
		minFootTrafficThreshold: 5000
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

	onMount(() => {
		const data = loadLaunchPadData();
		// #27: Seed financial defaults from conceptDefaults (single source of truth)
		const cDefs = getConceptDefaults(data.businessType);
		const conceptDefault = CONCEPT_KPIS[data.businessType]?.revenueParams.defaultAvgTicket ?? cDefs.ticket;
		financialGoals = {
			...financialGoals,
			avgTicket: conceptDefault,
			targetSDE: cDefs.sde,
			revenueY1: cDefs.revenue,
		};
		if (data.lastSaved > 0) {
			financialGoals = { ...financialGoals, ...data.financialGoals };
			idealArea = data.idealArea || idealArea;
			visibilityPreferences = data.visibilityPreferences || visibilityPreferences;
			locationPreferences = { ...locationPreferences, ...data.locationPreferences };
			if (data.financialGoals?.liquidCapital) liquidCapital = data.financialGoals.liquidCapital;
			if (data.financialGoals?.monthlyPersonalExpenses) monthlyPersonalExpenses = data.financialGoals.monthlyPersonalExpenses;
			if (data.financialGoals?.externalFunding) externalFunding = data.financialGoals.externalFunding;
		}
		loaded = true;
	});

	$effect(() => {
		void JSON.stringify(financialGoals); void JSON.stringify(locationPreferences);
		void JSON.stringify(neighborhoodCharacteristics); void JSON.stringify(visibilityPreferences);
		void idealArea; void liquidCapital; void monthlyPersonalExpenses; void externalFunding;
		autoSave();
	});
</script>

<svelte:head><title>RE² — Concept: Your Numbers</title></svelte:head>

<div class="page">
	<!-- Page Header -->
	<div class="page-header">
		<div class="breadcrumbs">
			<a href="/app/vision/founder" class="breadcrumb completed">✓ Founder</a>
			<span class="breadcrumb-arrow">→</span>
			<a href="/app/vision/concept" class="breadcrumb completed">✓ Concept</a>
			<span class="breadcrumb-arrow">→</span>
			<a href="/app/vision/financial" class="breadcrumb active">Financial</a>
			<span class="breadcrumb-arrow">→</span>
			<a href="/app/vision/calibration" class="breadcrumb">Calibration</a>
		</div>
		<h1>YOUR NUMBERS</h1>
		<p class="subtitle">Financial Goals & Space Requirements</p>
	</div>

	{#if saveStatus}
		<div class="save-indicator">{saveStatus}</div>
	{/if}

	<div class="content">
		<!-- Financial Goals -->
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
								oninput={autoSave}
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
								oninput={autoSave}
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
								oninput={autoSave}
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
								oninput={autoSave}
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
								oninput={autoSave}
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
								oninput={autoSave}
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
								oninput={autoSave}
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
								oninput={autoSave}
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
								oninput={autoSave}
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
								oninput={autoSave}
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
								oninput={autoSave}
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
							<label for="rentBudget">Monthly Rent Budget</label>
							<input
								type="number"
								id="rentBudget"
								bind:value={financialGoals.monthlyRentBudget}
								placeholder="15000"
								oninput={autoSave}
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
								oninput={autoSave}
							/>
							<span class="input-helper">Budget for tenant improvements</span>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Your Ideal Space -->
		<section class="section">
			<div class="section-context-paragraph">
				Define your space requirements and neighborhood preferences. These constraints narrow the location scoring to only viable candidates for your business model.
			</div>
			<div class="section-header">
				<h2>Your Ideal Space</h2>
			</div>

			<div class="section-content">
				<div class="grid grid-2col">
					<!-- Left Column -->
					<div class="col">
						<div class="form-group">
							<label for="spaceType">Space Type</label>
							<input
								type="text"
								id="spaceType"
								bind:value={spaceType}
								placeholder="e.g., Standard Cafe (800-1500 sqft)"
								oninput={autoSave}
							/>
						</div>

						<div class="form-group">
							<label for="sqftMin">Min Square Footage</label>
							<input
								type="number"
								id="sqftMin"
								bind:value={sqftMin}
								placeholder="1000"
								oninput={autoSave}
							/>
						</div>

						<div class="form-group">
							<label for="sqftMax">Max Square Footage</label>
							<input
								type="number"
								id="sqftMax"
								bind:value={sqftMax}
								placeholder="1500"
								oninput={autoSave}
							/>
						</div>

						<div class="form-group">
							<label for="rentBudget2">Monthly Rent Budget</label>
							<input
								type="number"
								id="rentBudget2"
								bind:value={monthlyRentBudget}
								placeholder="15000"
								oninput={autoSave}
							/>
						</div>
					</div>

					<!-- Right Column -->
					<div class="col">
						<div class="form-group">
							<label style="margin-bottom: 0.6rem;">Neighborhood Characteristics</label>
							<div class="checkbox-grid">
								<div class="checkbox-item">
									<input
										type="checkbox"
										id="char-foot"
										bind:checked={neighborhoodCharacteristics.highFootTraffic}
										onchange={autoSave}
									/>
									<label for="char-foot">High foot traffic</label>
								</div>
								<div class="checkbox-item">
									<input
										type="checkbox"
										id="char-res"
										bind:checked={neighborhoodCharacteristics.residentialDensity}
										onchange={autoSave}
									/>
									<label for="char-res">Residential density</label>
								</div>
								<div class="checkbox-item">
									<input
										type="checkbox"
										id="char-office"
										bind:checked={neighborhoodCharacteristics.officeCommercial}
										onchange={autoSave}
									/>
									<label for="char-office">Office/commercial</label>
								</div>
								<div class="checkbox-item">
									<input
										type="checkbox"
										id="char-fitness"
										bind:checked={neighborhoodCharacteristics.fitnessWellness}
										onchange={autoSave}
									/>
									<label for="char-fitness">Fitness/wellness focus</label>
								</div>
								<div class="checkbox-item">
									<input
										type="checkbox"
										id="char-family"
										bind:checked={neighborhoodCharacteristics.familyFriendly}
										onchange={autoSave}
									/>
									<label for="char-family">Family friendly</label>
								</div>
								<div class="checkbox-item">
									<input
										type="checkbox"
										id="char-nightlife"
										bind:checked={neighborhoodCharacteristics.nightlifeEntertainment}
										onchange={autoSave}
									/>
									<label for="char-nightlife">Nightlife/entertainment</label>
								</div>
								<div class="checkbox-item">
									<input
										type="checkbox"
										id="char-trendy"
										bind:checked={neighborhoodCharacteristics.trendyEmerging}
										onchange={autoSave}
									/>
									<label for="char-trendy">Trendy/emerging</label>
								</div>
								<div class="checkbox-item">
									<input
										type="checkbox"
										id="char-stable"
										bind:checked={neighborhoodCharacteristics.establishedStable}
										onchange={autoSave}
									/>
									<label for="char-stable">Established/stable</label>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Ideal General Area -->
				<div class="form-group" style="margin-top: 1rem;">
					<label for="idealArea">Ideal General Area</label>
					<select bind:value={idealArea} id="idealArea" onchange={autoSave}>
						{#each neighborhoodAreasList as area}
							<option value={area}>{area}</option>
						{/each}
					</select>
				</div>

				<!-- Visibility Preferences -->
				<div class="form-group">
					<label style="margin-bottom: 0.6rem; margin-top: 1rem;">Visibility Preferences</label>
					<div class="checkbox-grid">
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="vis-ground"
								bind:checked={visibilityPreferences.groundFloor}
								onchange={autoSave}
							/>
							<label for="vis-ground">Ground floor (street-level)</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="vis-corner"
								bind:checked={visibilityPreferences.cornerLocation}
								onchange={autoSave}
							/>
							<label for="vis-corner">Corner location</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="vis-subway"
								bind:checked={visibilityPreferences.nearSubway}
								onchange={autoSave}
							/>
							<label for="vis-subway">Near subway entrance</label>
						</div>
						<div class="checkbox-item">
							<input
								type="checkbox"
								id="vis-outdoor"
								bind:checked={visibilityPreferences.outdoorSeating}
								onchange={autoSave}
							/>
							<label for="vis-outdoor">Outdoor seating potential</label>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Location Preferences -->
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
							oninput={autoSave}
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
							oninput={autoSave}
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
							oninput={autoSave}
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
							oninput={autoSave}
						/>
						<span class="input-helper">Minimum daily pedestrian traffic to qualify</span>
					</div>
				</div>
			</div>
		</section>

		<!-- Navigation -->
		<div class="nav-footer">
			<a href="/app/vision/concept" class="nav-link">← Back: Concept</a>
			<a href="/app/vision/calibration" class="nav-link primary">Next: Calibration →</a>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background-color: var(--bg);
		color: var(--text);
	}

	.save-indicator {
		position: fixed;
		top: 60px;
		right: 24px;
		background: var(--green-soft);
		color: var(--success);
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
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem 1rem;
		background-color: var(--bg);
		color: var(--text);
	}

	.page-header {
		margin-bottom: 2rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 1rem;
	}

	.breadcrumbs {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		font-size: 13px;
	}

	.breadcrumb {
		color: var(--text-tertiary);
		text-decoration: none;
		transition: color 0.2s;
	}

	.breadcrumb:hover {
		color: var(--text-secondary);
	}

	.breadcrumb.active {
		color: var(--success);
		font-weight: 600;
	}

	.breadcrumb.completed {
		color: var(--success);
	}

	.breadcrumb-arrow {
		color: var(--border);
	}

	.page-header h1 {
		font-family: 'Syne', sans-serif;
		font-size: 22px;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		color: var(--text);
		letter-spacing: 0.5px;
	}

	.page-header .subtitle {
		font-family: 'Courier New', monospace;
		font-size: 15px;
		margin: 0;
		color: var(--text-secondary);
		letter-spacing: 0.3px;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.section {
		background-color: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}

	.section-context-paragraph {
		padding: 1rem;
		background-color: var(--surface-alt);
		border-bottom: 1px solid var(--border);
		font-size: 15px;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.section-header {
		padding: 1rem;
		background-color: var(--surface);
		border-bottom: 1px solid var(--border);
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
		color: var(--text-secondary);
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
		color: var(--text-secondary);
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		padding: 12px 16px;
		background-color: var(--bg);
		border: 1px solid var(--border);
		color: var(--text);
		font-size: 15px;
		font-family: inherit;
		border-radius: 2px;
		transition: all 0.2s;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--danger);
		background-color: var(--surface);
	}

	.input-helper {
		font-size: 13px;
		color: var(--text-tertiary);
		margin-top: 0.3rem;
		display: block;
		font-weight: 400;
		font-family: 'Courier New', monospace;
	}

	.subsection {
		margin-bottom: 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border);
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
		color: var(--text-secondary);
		margin: 0 0 0.8rem 0;
	}

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
		background-color: var(--bg);
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.checkbox-item:hover {
		background-color: var(--surface);
		border-color: var(--border-hover);
	}

	.checkbox-item input[type="checkbox"] {
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

	.nav-footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	.nav-link {
		padding: 0.8rem 1.5rem;
		background-color: var(--surface);
		border: 1px solid var(--border);
		color: var(--text);
		text-decoration: none;
		border-radius: 4px;
		font-weight: 600;
		transition: all 0.2s;
		font-size: 14px;
	}

	.nav-link:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	.nav-link.primary {
		background-color: var(--danger);
		border-color: var(--danger);
		color: #fff;
	}

	.nav-link.primary:hover {
		background-color: #FF453A;
		border-color: #FF453A;
	}

	@media (max-width: 768px) {
		.grid-2col,
		.grid-3col {
			grid-template-columns: 1fr;
		}

		.checkbox-grid {
			grid-template-columns: 1fr;
		}

		.nav-footer {
			flex-direction: column;
		}
	}
</style>
