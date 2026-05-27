<script>
	import { onMount, untrack } from 'svelte';
	import { loadLaunchPadData, saveLaunchPadData } from '$lib/launchpad-store';
	import { CONCEPT_UI_DEFAULTS } from '$lib/constants/conceptDefaults'; // #26: single source of truth
	import { estimateFromLocation } from '$lib/utils/location-financial-estimates';

	let saveStatus = $state('');
	let hasLocationData = $state(false);
	let locationEstimateAddr = $state('');
	let loaded = $state(false);

	function triggerSave() {
		saveStatus = 'Saving...';
		saveLaunchPadData({
			businessType,
			businessName,
			visionStatement: differentiator,
			differentiator,
			competitiveStrategy,
			financialGoals,
			idealArea,
			preferredNeighborhoods
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

	// Business Identity
	let businessType = $state('Specialty Coffee/Café');
	let businessName = $state('');
	let differentiator = $state('');

	// Competitive Strategy
	let competitiveStrategy = $state({
		differentiators: {
			uniqueProduct: false,
			priceLeader: false,
			premiumExperience: false,
			healthWellness: false,
			technologyDriven: false,
			communityHub: false
		},
		targetSegments: {
			officeWorkers: false,
			families: false,
			students: false,
			healthEnthusiasts: false,
			remoteWorkers: false,
			tourists: false
		}
	});

	// Financial Targets (merged from financial page)
	let financialGoals = $state({
		startupCapital: 0,
		monthlyRentBudget: 0,
		squareFootage: 0,
		revenueY1: 0,
		avgTicket: 0,
		teamSize: 0,
		dailyTransactions: 0,
		targetSDE: 0
	});

	// Location Preferences
	let idealArea = $state('');
	let preferredNeighborhoods = $state('');

	const businessTypes = [
		'Specialty Coffee/Café',
		'Restaurant (Fast Casual)',
		'Restaurant (Full Service)',
		'Retail',
		'Fitness / Wellness',
		'Salon / Barbershop',
		'Professional Services',
		'Grocery / Market',
		'Other'
	];

	const differentiatorOptions = [
		{ key: 'uniqueProduct', label: 'Unique Product', icon: '🌟' },
		{ key: 'priceLeader', label: 'Price Leader', icon: '💲' },
		{ key: 'premiumExperience', label: 'Premium Experience', icon: '✨' },
		{ key: 'healthWellness', label: 'Health Focus', icon: '💚' },
		{ key: 'technologyDriven', label: 'Tech-Driven', icon: '🤖' },
		{ key: 'communityHub', label: 'Community Hub', icon: '🏠' }
	];

	const segmentOptions = [
		{ key: 'officeWorkers', label: 'Office Workers', icon: '🏢' },
		{ key: 'healthEnthusiasts', label: 'Health / Fitness', icon: '💪' },
		{ key: 'families', label: 'Families', icon: '👨‍👩‍👧' },
		{ key: 'students', label: 'Students', icon: '🎓' },
		{ key: 'remoteWorkers', label: 'Remote Workers', icon: '💻' },
		{ key: 'tourists', label: 'Tourists', icon: '✈️' }
	];

	const areaOptions = [
		'Nolita / NoHo', 'East Village', 'West Village', 'SoHo', 'Chelsea / Flatiron',
		'Lower East Side', 'Tribeca', 'Midtown', 'UWS / UES', 'Gramercy / Murray Hill',
		'Williamsburg', 'DUMBO / Cobble Hill', 'Park Slope', 'Other'
	];

	// ── Progressive disclosure: Financial Targets ─────────────────────────────
	// Maps display-name businessType to canonical concept key
	const BIZ_TYPE_TO_CONCEPT = {
		'Specialty Coffee/Café':       'specialty_coffee',
		'Restaurant (Fast Casual)':    'fast_casual',
		'Restaurant (Full Service)':   'full_service_restaurant',
		'Retail':                      'retail',
		'Fitness / Wellness':          'fitness_studio',
		'Salon / Barbershop':          'personal_services',
		'Professional Services':       'medical_office',
		'Grocery / Market':            'retail',
	};

	// #26: CONCEPT_SMART_DEFAULTS replaced with import from conceptDefaults.ts
	// Single source of truth — edit values there, not here.
	const CONCEPT_SMART_DEFAULTS = CONCEPT_UI_DEFAULTS;

	// 3 modes: 'estimates' (show RE² defaults) | 'confirmed' (pill) | 'manual' (inputs)
	let financialsMode = $state('estimates');

	let currentConceptKey = $derived(BIZ_TYPE_TO_CONCEPT[businessType] || null);
	let smartDefaults = $derived(currentConceptKey ? CONCEPT_SMART_DEFAULTS[currentConceptKey] : null);

	// When concept changes and user was on confirmed pill, reset to estimates view.
	// untrack() reads financialsMode without adding it as a dependency — otherwise
	// setting financialsMode='confirmed' would immediately re-trigger this effect
	// and reset it back to 'estimates'.
	$effect(() => {
		void businessType;
		if (untrack(() => financialsMode === 'confirmed')) financialsMode = 'estimates';
	});

	function useSmartDefaults() {
		if (!smartDefaults) return;
		financialGoals = {
			startupCapital:    smartDefaults.startup,
			monthlyRentBudget: smartDefaults.rent,
			squareFootage:     smartDefaults.sqft,
			revenueY1:         smartDefaults.revenue,
			avgTicket:         smartDefaults.ticket,
			teamSize:          smartDefaults.team,
			dailyTransactions: smartDefaults.transactions,
			targetSDE:         smartDefaults.sde,
		};
		financialsMode = 'confirmed';
		triggerSave();
	}

	// AUX-01: Estimate from scored location data
	function useLocationEstimate() {
		const data = loadLaunchPadData();
		const conceptKey = /** @type {Record<string,string>} */ (BIZ_TYPE_TO_CONCEPT)[businessType] || null;
		if (!conceptKey) return;

		const estimate = estimateFromLocation(conceptKey, /** @type {any} */ (data));
		if (!estimate) return;

		financialGoals = {
			startupCapital:    estimate.startupCapital,
			monthlyRentBudget: estimate.monthlyRentBudget,
			squareFootage:     estimate.squareFootage,
			revenueY1:         estimate.revenueY1,
			avgTicket:         estimate.avgTicket,
			teamSize:          estimate.teamSize,
			dailyTransactions: estimate.dailyTransactions,
			targetSDE:         estimate.targetSDE,
		};
		locationEstimateAddr = estimate.locationUsed || '';
		financialsMode = 'confirmed';
		triggerSave();
	}
	// ─────────────────────────────────────────────────────────────────────────

	function formatCurrency(value) {
		if (!value && value !== 0) return '';
		return '$' + Number(value).toLocaleString('en-US');
	}

	function parseCurrency(str) {
		return Number(str.replace(/[^0-9.-]/g, '')) || 0;
	}

	function handleCurrencyInput(e, field) {
		financialGoals[field] = parseCurrency(e.target.value);
		autoSave();
	}

	function handleCurrencyBlur(e, field) {
		e.target.value = formatCurrency(financialGoals[field]);
	}

	function handleCurrencyFocus(e, field) {
		e.target.value = financialGoals[field] || '';
	}

	// Vision Review computed values
	let founderData = $state(null);

	// FIX: Only count fields owned by THIS page (10 fields). Founder profile
	// (motivation, riskTolerance) is on a separate page and was making 100% unreachable.
	let completeness = $derived(() => {
		let filled = 0;
		let total = 10;
		if (businessType) filled++;
		if (businessName) filled++;
		if (differentiator) filled++;
		if (financialGoals.startupCapital > 0) filled++;
		if (financialGoals.monthlyRentBudget > 0) filled++;
		if (financialGoals.squareFootage > 0) filled++;
		if (financialGoals.revenueY1 > 0) filled++;
		if (financialGoals.avgTicket > 0) filled++;
		if (financialGoals.teamSize > 0) filled++;
		if (idealArea) filled++;
		return Math.round((filled / total) * 100);
	});

	onMount(() => {
		const data = loadLaunchPadData();
		if (data.lastSaved > 0) {
			businessType = data.businessType || businessType;
			businessName = data.businessName || businessName;
			differentiator = data.differentiator || differentiator;
			if (data.competitiveStrategy) {
				competitiveStrategy = {
					differentiators: { ...competitiveStrategy.differentiators, ...(data.competitiveStrategy.differentiators || {}) },
					targetSegments: { ...competitiveStrategy.targetSegments, ...(data.competitiveStrategy.targetSegments || {}) }
				};
			}
			if (data.financialGoals) {
				financialGoals = { ...financialGoals, ...data.financialGoals };
				// If the user previously entered financial data, skip the estimates card
				if (data.financialGoals.revenueY1 > 0 || data.financialGoals.startupCapital > 0) {
					financialsMode = 'manual';
				}
			}
			idealArea = data.idealArea || idealArea;
			preferredNeighborhoods = data.preferredNeighborhoods || data.locationPreferences?.preferredNeighborhoods || preferredNeighborhoods;
			founderData = data.founderProfile || null;
		}

		// ─────────────────────────────────────────────────────────────────────
		// GAP-5 FIX (2026-04-18)
		// Author:   Antigravity / Jared Claw
		// Ticket:   Playwright B8-01 — "GAP 5 CONFIRMED: Vision form empty after chat onboarding"
		//
		// Problem:
		//   The onboarding chat stores user answers in localStorage under the key
		//   're2_session' with chat-specific field names:
		//     - personaType  (e.g. 'fast_casual', 'specialty_coffee')
		//     - conceptName  (e.g. "Derek's Kitchen")
		//
		//   This form reads from 're2_launchpad' with different field names:
		//     - businessType (e.g. 'Restaurant (Fast Casual)')
		//     - businessName (e.g. "Derek's Kitchen")
		//
		//   There was no bridge between the two key schemas. A founder who completed
		//   the full onboarding chat then opened /app/vision/concept found every
		//   field empty — their chat answers were silently discarded.
		//
		// Fix:
		//   After loading from re2_launchpad (above), check re2_session as a fallback.
		//   Map personaType → businessType via an inverted lookup of BIZ_TYPE_TO_CONCEPT.
		//   Map conceptName → businessName directly.
		//   Only applies when the launchpad field is still at its default value, so
		//   intentional edits made directly in this form are never overwritten.
		// ─────────────────────────────────────────────────────────────────────
		try {
			const chatSession = JSON.parse(localStorage.getItem('re2_session') || '{}');

			// Build reverse lookup: concept key → display label
			// e.g. 'fast_casual' → 'Restaurant (Fast Casual)'
			const CONCEPT_TO_DISPLAY = Object.fromEntries(
				Object.entries(BIZ_TYPE_TO_CONCEPT).map(([display, key]) => [key, display])
			);

			// Map personaType → businessType (only if launchpad had no businessType)
			if (!data.businessType && chatSession.personaType) {
				const mapped = CONCEPT_TO_DISPLAY[chatSession.personaType];
				if (mapped) businessType = mapped;
			}

			// Map conceptName → businessName (only if launchpad had no businessName)
			if (!data.businessName && chatSession.conceptName) {
				businessName = chatSession.conceptName;
			}
		} catch {
			// Silent fail — chat session is optional, form remains functional without it
		}
		// ─────────────────────────────────────────────────────────────────────

		// AUX-01: Detect if user has scored locations for "estimate from my location"
		/** @type {any[]} */
		const locs = /** @type {any} */ (data).scoredLocations || [];
		hasLocationData = locs.some(function(l) { return l.score > 0 || l.fitScore > 0; });
		loaded = true;
	});

	$effect(() => {
		void businessType; void businessName; void differentiator; void idealArea; void preferredNeighborhoods;
		void JSON.stringify(competitiveStrategy); void JSON.stringify(financialGoals);
		autoSave();
	});
</script>

<svelte:head><title>RE² — Concept & Goals</title></svelte:head>

<div class="page">
	{#if saveStatus}
		<div class="save-indicator">{saveStatus}</div>
	{/if}

	<div class="split-layout">
		<!-- LEFT: FORM -->
		<div class="form-area">
			<div class="page-header">
				<h1>Concept & Goals</h1>
				<p class="subtitle">Your business identity and financial targets. Everything here feeds directly into your score and recommendations.</p>
			</div>

			<!-- SECTION 1: BUSINESS IDENTITY -->
			<section class="section">
				<div class="section-header">
					<div class="section-num">1</div>
					<h2>Business Identity</h2>
				</div>
				<div class="section-content">
					<div class="form-row cols-2">
						<div class="form-group">
							<label for="businessType">Business Type</label>
							<select bind:value={businessType} id="businessType" onchange={autoSave} class="form-input">
								{#each businessTypes as type}
									<option value={type}>{type}</option>
								{/each}
							</select>
						</div>
						<div class="form-group">
							<label for="businessName">Business Name</label>
							<input class="form-input" type="text" id="businessName" bind:value={businessName} placeholder="e.g. Green Bowl Co." oninput={autoSave} />
						</div>
					</div>

					<div class="form-group">
						<label for="differentiator">What makes you different? <span class="feeds">→ concept alignment</span></label>
						<textarea class="form-input form-textarea" id="differentiator" bind:value={differentiator} placeholder="One sentence. What's your edge?" rows="2" oninput={autoSave}></textarea>
					</div>

					<div class="form-group">
						<label>Target Customers <span class="feeds">→ demographics match</span></label>
						<div class="chip-grid">
							{#each segmentOptions as seg}
								<button
									class="chip"
									class:active={competitiveStrategy.targetSegments[seg.key]}
									onclick={() => { competitiveStrategy.targetSegments[seg.key] = !competitiveStrategy.targetSegments[seg.key]; autoSave(); }}
								>
									{seg.icon} {seg.label}
								</button>
							{/each}
						</div>
					</div>

					<div class="form-group">
						<label>Key Differentiators <span class="feeds">→ competition scoring</span></label>
						<div class="chip-grid">
							{#each differentiatorOptions as diff}
								<button
									class="chip"
									class:active={competitiveStrategy.differentiators[diff.key]}
									onclick={() => { competitiveStrategy.differentiators[diff.key] = !competitiveStrategy.differentiators[diff.key]; autoSave(); }}
								>
									{diff.icon} {diff.label}
								</button>
							{/each}
						</div>
					</div>
				</div>
			</section>

			<!-- SECTION 2: FINANCIAL TARGETS — progressive disclosure -->
			<section class="section">
				<div class="section-header">
					<div class="section-num">2</div>
					<h2>Financial Targets</h2>
					{#if financialsMode === 'confirmed'}
						<span class="section-badge-confirmed">✓ Estimates applied</span>
					{/if}
				</div>
				<div class="section-content">

					{#if financialsMode === 'estimates'}
						<!-- ESTIMATES MODE -->
						{#if smartDefaults}
							<p class="estimates-intro">RE² pre-fills these from <strong>{businessType}</strong> benchmarks. Most founders use them as a starting point and refine after scoring a location.</p>
							<div class="estimates-grid">
								<div class="estimates-item">
									<span class="est-icon">💰</span>
									<div>
										<div class="est-label">Year 1 Revenue</div>
										<div class="est-value">~{formatCurrency(smartDefaults.revenue)}</div>
									</div>
								</div>
								<div class="estimates-item">
									<span class="est-icon">🧾</span>
									<div>
										<div class="est-label">Avg Ticket</div>
										<div class="est-value">${smartDefaults.ticket}</div>
									</div>
								</div>
								<div class="estimates-item">
									<span class="est-icon">👥</span>
									<div>
										<div class="est-label">Customers / Day</div>
										<div class="est-value">~{smartDefaults.transactions}</div>
									</div>
								</div>
								<div class="estimates-item">
									<span class="est-icon">🏠</span>
									<div>
										<div class="est-label">Monthly Rent</div>
										<div class="est-value">{formatCurrency(smartDefaults.rent)}/mo</div>
									</div>
								</div>
								<div class="estimates-item">
									<span class="est-icon">📐</span>
									<div>
										<div class="est-label">Space Needed</div>
										<div class="est-value">{smartDefaults.sqft.toLocaleString()} sq ft</div>
									</div>
								</div>
								<div class="estimates-item">
									<span class="est-icon">🔧</span>
									<div>
										<div class="est-label">Startup Capital</div>
										<div class="est-value">~{formatCurrency(smartDefaults.startup)}</div>
									</div>
								</div>
								<div class="estimates-item">
									<span class="est-icon">👤</span>
									<div>
										<div class="est-label">Team Size</div>
										<div class="est-value">{smartDefaults.team} FTEs</div>
									</div>
								</div>
								<div class="estimates-item">
									<span class="est-icon">💵</span>
									<div>
										<div class="est-label">Owner's Take-Home</div>
										<div class="est-value">~{formatCurrency(smartDefaults.sde)}</div>
									</div>
								</div>
							</div>
							<div class="estimates-actions">
								<button class="estimates-use-btn" onclick={useSmartDefaults}>
									Use these estimates — I'll refine later →
								</button>
								{#if hasLocationData}
									<button class="estimates-location-btn" onclick={useLocationEstimate}>
										Estimate from my scored location →
									</button>
								{/if}
								<button class="estimates-manual-btn" onclick={() => financialsMode = 'manual'}>
									I know my numbers
								</button>
							</div>
						{:else}
							<p class="estimates-intro">Select a business type above to see RE² estimates, or enter your own numbers.</p>
							<button class="estimates-manual-btn standalone" onclick={() => financialsMode = 'manual'}>Enter my numbers →</button>
						{/if}

					{:else if financialsMode === 'confirmed'}
						<!-- CONFIRMED PILL MODE -->
						<div class="confirmed-pill">
							<div class="confirmed-summary">
								<span class="confirmed-item">{formatCurrency(financialGoals.revenueY1)} Y1</span>
								<span class="confirmed-dot">·</span>
								<span class="confirmed-item">${financialGoals.avgTicket} avg ticket</span>
								<span class="confirmed-dot">·</span>
								<span class="confirmed-item">{financialGoals.dailyTransactions} customers/day</span>
								<span class="confirmed-dot">·</span>
								<span class="confirmed-item">{formatCurrency(financialGoals.startupCapital)} startup</span>
							</div>
							<button class="confirmed-edit-btn" onclick={() => financialsMode = 'manual'}>Edit</button>
						</div>
						<p class="confirmed-note">{locationEstimateAddr ? `Estimated from ${locationEstimateAddr} scoring data` : `Pre-filled from ${businessType} benchmarks`}. Click Edit to adjust any value.</p>

					{:else}
						<!-- MANUAL MODE -->
						{#if smartDefaults}
							<div class="manual-mode-header">
								<button class="back-to-estimates-btn" onclick={() => financialsMode = 'estimates'}>← Use RE² estimates instead</button>
							</div>
						{/if}
						<div class="form-row cols-3">
							<div class="form-group">
								<label>Total Startup Capital <span class="feeds">→ capital fit</span>
									<span class="tooltip-trigger" title="Total money needed to open, including buildout, equipment, inventory, deposits, and a cash cushion.">?</span>
								</label>
								<input class="form-input" type="text"
									value={formatCurrency(financialGoals.startupCapital)}
									oninput={(e) => handleCurrencyInput(e, 'startupCapital')}
									onfocus={(e) => handleCurrencyFocus(e, 'startupCapital')}
									onblur={(e) => handleCurrencyBlur(e, 'startupCapital')}
									placeholder="$"
								/>
							</div>
							<div class="form-group">
								<label>Monthly Rent Budget 									<span class="tooltip-trigger" title="What you can afford per month for rent. NYC retail ranges from $3K–30K+ depending on neighborhood.">?</span>
								</label>
								<input class="form-input" type="text"
									value={formatCurrency(financialGoals.monthlyRentBudget)}
									oninput={(e) => handleCurrencyInput(e, 'monthlyRentBudget')}
									onfocus={(e) => handleCurrencyFocus(e, 'monthlyRentBudget')}
									onblur={(e) => handleCurrencyBlur(e, 'monthlyRentBudget')}
									placeholder="$"
								/>
							</div>
							<div class="form-group">
								<label>Target Sq Ft <span class="feeds">→ format fit</span>
									<span class="tooltip-trigger" title="The size of the space you need. A small café is 800–1200 sq ft, a restaurant 1500–3000 sq ft.">?</span>
								</label>
								<input class="form-input" type="number" bind:value={financialGoals.squareFootage} oninput={autoSave} placeholder="sq ft" />
							</div>
						</div>
						<div class="form-row cols-3">
							<div class="form-group">
								<label>Year 1 Revenue Target
									<span class="tooltip-trigger" title="Your best estimate of total sales in the first 12 months. Don't know? Leave blank — we'll estimate from your location data.">?</span>
								</label>
								<input class="form-input" type="text"
									value={formatCurrency(financialGoals.revenueY1)}
									oninput={(e) => handleCurrencyInput(e, 'revenueY1')}
									onfocus={(e) => handleCurrencyFocus(e, 'revenueY1')}
									onblur={(e) => handleCurrencyBlur(e, 'revenueY1')}
									placeholder="$"
								/>
							</div>
							<div class="form-group">
								<label>Avg Ticket Size
									<span class="tooltip-trigger" title="How much a typical customer spends per visit. For a coffee shop, that's usually $5–8. For a restaurant, $15–40+.">?</span>
								</label>
								<input class="form-input" type="text"
									value={formatCurrency(financialGoals.avgTicket)}
									oninput={(e) => handleCurrencyInput(e, 'avgTicket')}
									onfocus={(e) => handleCurrencyFocus(e, 'avgTicket')}
									onblur={(e) => handleCurrencyBlur(e, 'avgTicket')}
									placeholder="$"
								/>
							</div>
							<div class="form-group">
								<label>Team Size (FTEs)
									<span class="tooltip-trigger" title="Full-time equivalent employees. 1 FTE = one full-time person, 0.5 FTE = one part-time person.">?</span>
								</label>
								<input class="form-input" type="number" bind:value={financialGoals.teamSize} oninput={autoSave} placeholder="people" />
							</div>
						</div>
						<div class="form-row cols-2">
							<div class="form-group">
								<label>Daily Customers
									<span class="tooltip-trigger" title="How many customers you expect per day. For a café that might be 100–300. For a restaurant, 50–150.">?</span>
								</label>
								<input class="form-input" type="number" bind:value={financialGoals.dailyTransactions} oninput={autoSave} placeholder="customers/day" />
							</div>
							<div class="form-group">
								<label>Year 1 Owner's Take-Home
									<span class="tooltip-trigger" title="What you'd actually take home as the owner — salary + profit + benefits, before personal taxes.">?</span>
								</label>
								<input class="form-input" type="text"
									value={formatCurrency(financialGoals.targetSDE)}
									oninput={(e) => handleCurrencyInput(e, 'targetSDE')}
									onfocus={(e) => handleCurrencyFocus(e, 'targetSDE')}
									onblur={(e) => handleCurrencyBlur(e, 'targetSDE')}
									placeholder="$"
								/>
							</div>
						</div>
					{/if}

				</div>
			</section>

						<!-- SECTION 3: LOCATION PREFERENCES -->
			<section class="section">
				<div class="section-header">
					<div class="section-num">3</div>
					<h2>Location Preferences</h2>
				</div>
				<div class="section-content">
					<div class="form-row cols-2">
						<div class="form-group">
							<label>Preferred Area <span class="feeds">→ location search</span></label>
							<select bind:value={idealArea} class="form-input" onchange={autoSave}>
								<option value="">Select an area...</option>
								{#each areaOptions as area}
									<option value={area}>{area}</option>
								{/each}
							</select>
						</div>
						<div class="form-group">
							<label>Preferred Neighborhoods</label>
							<input class="form-input" type="text" bind:value={preferredNeighborhoods} placeholder="e.g. Nolita, East Village" oninput={autoSave} />
						</div>
					</div>
				</div>
			</section>

			<!-- Navigation -->
			<div class="nav-footer">
				<a href="/app/vision/founder" class="nav-link">← Back: Profile</a>
				<a href="/app/location" class="nav-link primary">See your score →</a>
			</div>
		</div>

		<!-- RIGHT: VISION REVIEW PANEL -->
		<aside class="review-panel">
			<div class="review-card">
				<h3>📋 Concept Review</h3>

				{#if founderData}
					<div class="review-section-label">Profile</div>
					<div class="review-row">
						<span class="review-key">Motivation</span>
						<span class="review-val">{founderData.motivation || '—'}</span>
					</div>
					<div class="review-row">
						<span class="review-key">Involvement</span>
						<span class="review-val">{founderData.ownerType || '—'}</span>
					</div>
					<div class="review-row">
						<span class="review-key">Risk</span>
						<span class="review-val">{founderData.riskTolerance || '—'}</span>
					</div>
					<div class="review-row">
						<span class="review-key">Experience</span>
						<span class="review-val">{founderData.experience || '—'}</span>
					</div>
					<div class="review-divider"></div>
				{/if}

				<div class="review-section-label">Concept & Goals</div>
				<div class="review-row">
					<span class="review-key">Type</span>
					<span class="review-val">{businessType || '—'}</span>
				</div>
				<div class="review-row">
					<span class="review-key">Name</span>
					<span class="review-val">{businessName || '—'}</span>
				</div>
				<div class="review-row">
					<span class="review-key">Capital</span>
					<span class="review-val highlight">{financialGoals.startupCapital ? formatCurrency(financialGoals.startupCapital) : '—'}</span>
				</div>
				<div class="review-row">
					<span class="review-key">Rent Budget</span>
					<span class="review-val highlight">{financialGoals.monthlyRentBudget ? formatCurrency(financialGoals.monthlyRentBudget) + '/mo' : '—'}</span>
				</div>
				<div class="review-row">
					<span class="review-key">Sq Ft</span>
					<span class="review-val">{financialGoals.squareFootage || '—'}</span>
				</div>
				<div class="review-row">
					<span class="review-key">Y1 Revenue</span>
					<span class="review-val">{financialGoals.revenueY1 ? formatCurrency(financialGoals.revenueY1) : '—'}</span>
				</div>
				<div class="review-row">
					<span class="review-key">Ticket</span>
					<span class="review-val">{financialGoals.avgTicket ? formatCurrency(financialGoals.avgTicket) : '—'}</span>
				</div>
				<div class="review-row">
					<span class="review-key">Team</span>
					<span class="review-val">{financialGoals.teamSize ? financialGoals.teamSize + ' FTEs' : '—'}</span>
				</div>
				<div class="review-row">
					<span class="review-key">Area</span>
					<span class="review-val">{idealArea || '—'}</span>
				</div>

				<div class="review-completeness">
					<div class="review-pct">
						<span>Completeness</span>
						<span class="review-pct-num">{completeness()}%</span>
					</div>
					<div class="review-bar">
						<div class="review-bar-fill" style="width: {completeness()}%"></div>
					</div>
				</div>

				<a href="/app/location" class="review-cta">→ See your score</a>
			</div>
		</aside>
	</div>
</div>

<style>
	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem 1rem;
	}

	@media (max-width: 640px) {
		.page {
			padding: 1rem 0.75rem;
		}
	}

	@media (max-width: 480px) {
		.page {
			padding: 0.75rem 0.5rem;
		}
	}

	.save-indicator {
		position: fixed;
		top: 60px;
		right: 24px;
		background: rgba(52, 199, 89, 0.08);
		color: var(--success);
		padding: 6px 16px;
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 500;
		z-index: 100;
		animation: fadeIn 0.3s ease;
	}

	@media (max-width: 640px) {
		.save-indicator {
			top: 50px;
			right: 12px;
			padding: 4px 12px;
			font-size: 0.7rem;
		}
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Split Layout */
	.split-layout {
		display: grid;
		grid-template-columns: 1fr 280px;
		gap: 20px;
		align-items: start;
	}

	@media (max-width: 768px) {
		.split-layout {
			grid-template-columns: 1fr;
		}
	}

	.form-area {
		min-width: 0;
	}

	/* Page Header */
	.page-header {
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 20px;
		font-weight: 700;
		margin: 0 0 0.3rem 0;
		color: var(--text);
	}

	.page-header .subtitle {
		font-size: 12px;
		margin: 0;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	@media (max-width: 640px) {
		.page-header {
			margin-bottom: 1rem;
		}

		.page-header h1 {
			font-size: 18px;
		}

		.page-header .subtitle {
			font-size: 11px;
		}
	}

	@media (max-width: 480px) {
		.page-header h1 {
			font-size: 16px;
		}

		.page-header .subtitle {
			font-size: 10px;
		}
	}

	/* Sections */
	.section {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		margin-bottom: 16px;
		overflow: hidden;
	}

	@media (max-width: 640px) {
		.section {
			margin-bottom: 12px;
			border-radius: 10px;
		}
	}

	@media (max-width: 480px) {
		.section {
			margin-bottom: 10px;
			border-radius: 8px;
		}
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 18px;
		border-bottom: 1px solid var(--border);
	}

	@media (max-width: 480px) {
		.section-header {
			padding: 12px 14px;
			gap: 8px;
		}
	}

	.section-num {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--accent-light);
		color: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 800;
		flex-shrink: 0;
	}

	@media (max-width: 480px) {
		.section-num {
			width: 20px;
			height: 20px;
			font-size: 10px;
		}
	}

	.section-header h2 {
		font-size: 13px;
		font-weight: 700;
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--text-secondary);
	}

	@media (max-width: 480px) {
		.section-header h2 {
			font-size: 11px;
			letter-spacing: 0.5px;
		}
	}

	.section-content {
		padding: 16px 18px;
	}

	@media (max-width: 640px) {
		.section-content {
			padding: 14px 14px;
		}
	}

	@media (max-width: 480px) {
		.section-content {
			padding: 12px 12px;
		}
	}

	/* Form Layout */
	.form-row {
		display: grid;
		gap: 12px;
		margin-bottom: 14px;
	}

	.form-row.cols-2 { grid-template-columns: 1fr 1fr; }
	.form-row.cols-3 { grid-template-columns: 1fr 1fr 1fr; }

	@media (max-width: 640px) {
		.form-row.cols-2,
		.form-row.cols-3 {
			grid-template-columns: 1fr;
		}

		.form-row {
			gap: 10px;
			margin-bottom: 12px;
		}
	}

	@media (max-width: 480px) {
		.form-row {
			gap: 8px;
			margin-bottom: 10px;
		}
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.form-group label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
		letter-spacing: 0.2px;
	}

	@media (max-width: 480px) {
		.form-group label {
			font-size: 10px;
		}
	}

	.feeds {
		font-size: 9px;
		color: var(--text-tertiary);
		margin-left: 3px;
	}

	@media (max-width: 480px) {
		.feeds {
			font-size: 8px;
		}
	}

	.form-input {
		padding: 10px 14px;
		background: var(--bg);
		border: 1px solid var(--border);
		color: var(--text);
		border-radius: 8px;
		font-size: 13px;
		font-family: inherit;
		transition: border-color 0.2s;
	}

	@media (max-width: 480px) {
		.form-input {
			padding: 9px 12px;
			font-size: 12px;
			border-radius: 6px;
		}
	}

	.form-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.form-input::placeholder {
		color: var(--text-tertiary);
	}

	.form-textarea {
		resize: vertical;
		min-height: 50px;
	}

	select.form-input {
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23555' d='M5 7L1 3h8z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		padding-right: 30px;
	}

	/* Chip Grid */
	.chip-grid {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	@media (max-width: 640px) {
		.chip-grid {
			gap: 5px;
		}
	}

	@media (max-width: 480px) {
		.chip-grid {
			gap: 4px;
		}
	}

	.chip {
		padding: 8px 14px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 12px;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}

	@media (max-width: 640px) {
		.chip {
			padding: 7px 12px;
			font-size: 11px;
			border-radius: 6px;
		}
	}

	@media (max-width: 480px) {
		.chip {
			padding: 6px 10px;
			font-size: 10px;
			flex: 1 1 calc(50% - 2px);
		}
	}

	.chip:hover {
		border-color: var(--border-hover);
		color: var(--text);
	}

	.chip.active {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-light);
	}

	/* Vision Review Panel */
	.review-panel {
		position: sticky;
		top: 20px;
	}

	@media (max-width: 768px) {
		.review-panel {
			position: static;
			top: auto;
			margin-top: 0;
		}
	}

	.review-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px;
	}

	@media (max-width: 640px) {
		.review-card {
			padding: 14px;
			border-radius: 10px;
		}
	}

	@media (max-width: 480px) {
		.review-card {
			padding: 12px;
			border-radius: 8px;
		}
	}

	.review-card h3 {
		font-size: 12px;
		font-weight: 700;
		margin: 0 0 14px 0;
	}

	@media (max-width: 480px) {
		.review-card h3 {
			font-size: 11px;
			margin-bottom: 12px;
		}
	}

	.review-section-label {
		font-size: 9px;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-bottom: 6px;
	}

	@media (max-width: 480px) {
		.review-section-label {
			font-size: 8px;
			margin-bottom: 5px;
		}
	}

	.review-row {
		display: flex;
		justify-content: space-between;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
		font-size: 11px;
	}

	@media (max-width: 480px) {
		.review-row {
			font-size: 10px;
			padding: 3px 0;
		}
	}

	.review-key {
		color: var(--text-secondary);
	}

	.review-val {
		color: var(--text);
		font-weight: 600;
		text-align: right;
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.review-val.highlight {
		color: var(--accent);
	}

	.review-divider {
		height: 1px;
		background: var(--border);
		margin: 8px 0;
	}

	.review-completeness {
		margin-top: 12px;
	}

	.review-pct {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		color: var(--text-secondary);
	}

	.review-pct-num {
		color: var(--accent);
		font-weight: 700;
	}

	.review-bar {
		height: 5px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
		margin-top: 4px;
	}

	.review-bar-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 3px;
		transition: width 0.4s;
	}

	.review-cta {
		display: block;
		margin-top: 12px;
		padding: 10px;
		background: var(--accent-light);
		border: 1px solid rgba(0, 113, 227, 0.12);
		border-radius: 8px;
		font-size: 11px;
		color: var(--accent);
		text-align: center;
		text-decoration: none;
		font-weight: 600;
		transition: all 0.2s;
	}

	@media (max-width: 480px) {
		.review-cta {
			margin-top: 10px;
			padding: 8px;
			font-size: 10px;
			border-radius: 6px;
		}
	}

	.review-cta:hover {
		background: rgba(0, 113, 227, 0.12);
	}

	/* Navigation Footer */
	.nav-footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	@media (max-width: 640px) {
		.nav-footer {
			gap: 0.75rem;
			margin-top: 1rem;
			padding-top: 1rem;
		}
	}

	@media (max-width: 480px) {
		.nav-footer {
			flex-direction: column;
			gap: 0.5rem;
			margin-top: 1rem;
			padding-top: 1rem;
		}
	}

	.nav-link {
		padding: 10px 20px;
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text-secondary);
		text-decoration: none;
		border-radius: 8px;
		font-weight: 600;
		transition: all 0.2s;
		font-size: 13px;
	}

	@media (max-width: 640px) {
		.nav-link {
			padding: 9px 16px;
			font-size: 12px;
			border-radius: 6px;
		}
	}

	@media (max-width: 480px) {
		.nav-link {
			padding: 10px 14px;
			font-size: 11px;
			text-align: center;
			border-radius: 6px;
		}
	}

	.nav-link:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.nav-link.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}

	.nav-link.primary:hover {
		background: #0062CC;
		border-color: #0062CC;
	}

	/* Tooltip Styles */
	.tooltip-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--border, #d2d2d7);
		color: var(--text-secondary, #6e6e73);
		font-size: 10px;
		font-weight: 700;
		cursor: help;
		margin-left: 4px;
		vertical-align: middle;
		position: relative;
	}

	.tooltip-trigger:hover {
		background: var(--accent, #0071E3);
		color: white;
	}

	/* ── Progressive Disclosure: Financial Targets ── */
	.section-badge-confirmed {
		margin-left: auto;
		font-size: 11px;
		font-weight: 600;
		color: var(--success, #34C759);
		background: rgba(52, 199, 89, 0.10);
		padding: 3px 10px;
		border-radius: 20px;
	}

	.estimates-intro {
		font-size: 12px;
		color: var(--text-secondary);
		margin: 0 0 14px 0;
		line-height: 1.5;
	}

	.estimates-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-bottom: 16px;
	}

	@media (max-width: 768px) {
		.estimates-grid { grid-template-columns: repeat(2, 1fr); }
	}

	@media (max-width: 480px) {
		.estimates-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
	}

	.estimates-item {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		background: var(--bg, #f9f9fb);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 10px 12px;
	}

	.est-icon {
		font-size: 16px;
		flex-shrink: 0;
		line-height: 1.4;
	}

	.est-label {
		font-size: 10px;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 600;
		margin-bottom: 2px;
	}

	.est-value {
		font-size: 13px;
		font-weight: 700;
		color: var(--text);
	}

	.estimates-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.estimates-use-btn {
		background: var(--accent, #0071E3);
		color: white;
		border: none;
		border-radius: 8px;
		padding: 9px 18px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}

	.estimates-use-btn:hover {
		background: #005bb5;
	}

	.estimates-location-btn {
		width: 100%;
		padding: 10px 20px;
		border-radius: 8px;
		border: 1px solid #0d9488;
		background: #f0fdfa;
		color: #0d9488;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}
	.estimates-location-btn:hover {
		background: #ccfbf1;
		border-color: #0f766e;
	}

	.estimates-manual-btn {
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 12px;
		cursor: pointer;
		padding: 6px 4px;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.estimates-manual-btn:hover {
		color: var(--text);
	}

	.estimates-manual-btn.standalone {
		font-size: 13px;
		font-weight: 600;
		color: var(--accent, #0071E3);
	}

	/* Confirmed pill */
	.confirmed-pill {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		background: rgba(52, 199, 89, 0.07);
		border: 1px solid rgba(52, 199, 89, 0.25);
		border-radius: 8px;
		padding: 12px 16px;
		flex-wrap: wrap;
	}

	.confirmed-summary {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.confirmed-item {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
	}

	.confirmed-dot {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.confirmed-edit-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 4px 12px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
		white-space: nowrap;
	}

	.confirmed-edit-btn:hover {
		border-color: var(--accent, #0071E3);
		color: var(--accent, #0071E3);
	}

	.confirmed-note {
		font-size: 11px;
		color: var(--text-secondary);
		margin: 8px 0 0 0;
	}

	/* Manual mode header */
	.manual-mode-header {
		margin-bottom: 12px;
	}

	.back-to-estimates-btn {
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 12px;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.back-to-estimates-btn:hover {
		color: var(--accent, #0071E3);
	}
</style>
