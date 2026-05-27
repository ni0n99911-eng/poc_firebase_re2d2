<script>
	import { onMount } from 'svelte';
	import { loadLaunchPadData, saveLaunchPadData } from '$lib/launchpad-store';
	import Badge from '$lib/components/Badge.svelte';

	let saveStatus = $state('');
	let loaded = $state(false);

	function triggerSave() {
		saveStatus = 'Saving...';
		saveLaunchPadData({
			founderProfile,
			creditProfile
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

	let creditProfile = $state({
		scoreRange: '',
		bankruptcy: false,
		latePayments: false,
		collections: false,
		existingDebt: 'na'
	});

	function formatCurrency(value) {
		if (!value && value !== 0) return '';
		return '$' + Number(value).toLocaleString('en-US');
	}

	function parseCurrency(str) {
		return Number(str.replace(/[^0-9.-]/g, '')) || 0;
	}

	function handleCurrencyInput(e, setter) {
		const raw = parseCurrency(e.target.value);
		setter(raw);
		autoSave();
	}

	let founderProfileComplete = $derived(
		founderProfile.motivation !== '' &&
		founderProfile.ownerType !== '' &&
		founderProfile.riskTolerance !== '' &&
		founderProfile.experience !== ''
	);

	onMount(() => {
		const data = loadLaunchPadData();
		if (data.lastSaved > 0) {
			if (data.founderProfile) {
				founderProfile = { ...founderProfile, ...data.founderProfile, yearOneGoals: { ...founderProfile.yearOneGoals, ...(data.founderProfile.yearOneGoals || {}) } };
			}
			if (data.creditProfile) {
				creditProfile = { ...creditProfile, ...data.creditProfile };
			}
		}
		loaded = true;
	});

	$effect(() => {
		void JSON.stringify(founderProfile); void JSON.stringify(creditProfile);
		autoSave();
	});
</script>

<svelte:head><title>RE² — Profile</title></svelte:head>

<div class="page">
	<!-- Page Header -->
	<div class="page-header">
		<h1>Tell us about you</h1>
		<p class="subtitle">Just the essentials — everything here feeds directly into your score and recommendations. Takes about 2 minutes.</p>
	</div>

	{#if saveStatus}
		<div class="save-indicator">{saveStatus}</div>
	{/if}

	<div class="content">
		<!-- Founder Profile Section -->
		<section class="section">
			<div class="section-context-paragraph">
				Your answers here feed directly into your score, financial projections, and lender matching.
			</div>
			<div class="section-header">
				<h2>Founder Profile</h2>
				{#if founderProfileComplete}
					<Badge variant="success" text="Complete" />
				{:else}
					<Badge variant="warning" text="Required" />
				{/if}
			</div>

			<div class="section-content">
				<!-- Q1: What do you want from this business? -->
				<div class="profile-question">
					<h3 class="profile-q-label">What do you want from this business?</h3>
					<div class="card-options">
						{#each [
							{ value: 'legacy', label: 'Legacy Builder', desc: 'Generational wealth and a lasting brand' },
							{ value: 'passion', label: 'Full-Time Career', desc: 'This is your primary career and calling' },
							{ value: 'sideincome', label: 'Side Income', desc: 'Keep your day job, build on the side' },
							{ value: 'investment', label: 'Investment Play', desc: 'Portfolio play — returns matter most' }
						] as opt}
							<button
								class="profile-card"
								class:selected={founderProfile.motivation === opt.value}
								onclick={() => { founderProfile.motivation = opt.value; autoSave(); }}
							>
								<span class="card-title">{opt.label}</span>
								<span class="card-desc">{opt.desc}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Q2: What kind of owner will you be? -->
				<div class="profile-question">
					<h3 class="profile-q-label">What kind of owner will you be?</h3>
					<div class="card-options">
						{#each [
							{ value: 'fulltime', label: 'Full-Time Operator', desc: 'You\'re there every day running the show' },
							{ value: 'parttime', label: 'Part-Time Operator', desc: 'Evenings/weekends — manager runs day shift' },
							{ value: 'absentee', label: 'Absentee Owner', desc: 'Hire a full management team' },
							{ value: 'partnership', label: 'Partnership', desc: 'Splitting operations with a co-founder' }
						] as opt}
							<button
								class="profile-card"
								class:selected={founderProfile.ownerType === opt.value}
								onclick={() => { founderProfile.ownerType = opt.value; autoSave(); }}
							>
								<span class="card-title">{opt.label}</span>
								<span class="card-desc">{opt.desc}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Q3: Risk tolerance -->
				<div class="profile-question">
					<h3 class="profile-q-label">What's your risk tolerance?</h3>
					<div class="card-options card-options-3">
						{#each [
							{ value: 'conservative', label: 'Conservative', desc: 'Protect capital, slow and steady growth' },
							{ value: 'moderate', label: 'Moderate', desc: 'Willing to invest for faster returns' },
							{ value: 'aggressive', label: 'Aggressive', desc: 'Go big — accept higher risk for higher upside' }
						] as opt}
							<button
								class="profile-card"
								class:selected={founderProfile.riskTolerance === opt.value}
								onclick={() => { founderProfile.riskTolerance = opt.value; autoSave(); }}
							>
								<span class="card-title">{opt.label}</span>
								<span class="card-desc">{opt.desc}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Q4: Experience -->
				<div class="profile-question">
					<h3 class="profile-q-label">Have you operated a business before?</h3>
					<div class="card-options">
						{#each [
							{ value: 'firsttime', label: 'First-Time Founder', desc: 'This is your first business venture' },
							{ value: 'other-industry', label: 'Other Industry', desc: 'Ran a business, but not in retail/food' },
							{ value: 'experienced', label: 'Experienced Operator', desc: 'You\'ve run retail or food businesses' },
							{ value: 'serial', label: 'Serial Entrepreneur', desc: 'Multiple ventures under your belt' }
						] as opt}
							<button
								class="profile-card"
								class:selected={founderProfile.experience === opt.value}
								onclick={() => { founderProfile.experience = opt.value; autoSave(); }}
							>
								<span class="card-title">{opt.label}</span>
								<span class="card-desc">{opt.desc}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Coaching preview based on selections -->
				{#if founderProfileComplete}
					<div class="coaching-callout">
						<div class="coaching-icon">🎯</div>
						<div class="coaching-text">
							<strong>Profile Impact:</strong>
							{#if founderProfile.ownerType === 'absentee'}
								Management salary ($55K-$75K/yr) will be added to your financial projections.
							{:else if founderProfile.ownerType === 'parttime'}
								Part-time management costs factored into projections.
							{/if}
							{#if founderProfile.riskTolerance === 'conservative'}
								IQ weights favor affordability and lower-risk neighborhoods.
							{:else if founderProfile.riskTolerance === 'aggressive'}
								IQ weights favor high-traffic premium neighborhoods.
							{/if}
							{#if founderProfile.experience === 'firsttime'}
								Additional coaching modules enabled. Conservative capture rates applied.
							{:else if founderProfile.experience === 'serial'}
								Multi-location planning unlocked. Aggressive financial assumptions available.
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</section>

		<!-- Credit Profile Section -->
		<section class="section">
			<div class="section-context-paragraph">
				This adjusts your lender matching, interest rate estimates, and coaching. We never perform credit checks — this stays in your account.
			</div>
			<div class="section-header">
				<h2>Credit Profile</h2>
				<Badge variant="info" text="No Hard Pull" />
			</div>

			<div class="section-content">
				<div class="profile-question">
					<h3 class="profile-q-label">Select your credit score range</h3>
					<div class="card-options card-options-5">
						{#each [
							{ value: 'excellent', label: '750+', desc: 'Excellent' },
							{ value: 'good', label: '700-749', desc: 'Good' },
							{ value: 'fair', label: '650-699', desc: 'Fair' },
							{ value: 'building', label: 'Below 650', desc: 'Building' },
							{ value: 'unknown', label: 'Not Sure', desc: 'I don\'t know' }
						] as opt}
							<button
								class="profile-card profile-card-sm"
								class:selected={creditProfile.scoreRange === opt.value}
								onclick={() => { creditProfile.scoreRange = opt.value; autoSave(); }}
							>
								<span class="card-title">{opt.label}</span>
								<span class="card-desc">{opt.desc}</span>
							</button>
						{/each}
					</div>
				</div>

				<div class="credit-flags">
					<label class="credit-flag">
						<input type="checkbox" bind:checked={creditProfile.bankruptcy} onchange={autoSave} />
						<span>Any bankruptcies in the last 7 years?</span>
					</label>
					<label class="credit-flag">
						<input type="checkbox" bind:checked={creditProfile.latePayments} onchange={autoSave} />
						<span>Any late payments in the last 12 months?</span>
					</label>
					<label class="credit-flag">
						<input type="checkbox" bind:checked={creditProfile.collections} onchange={autoSave} />
						<span>Outstanding collections?</span>
					</label>
					<label class="credit-flag">
						<input type="checkbox" checked={creditProfile.existingDebt === 'yes'} onchange={(e) => { creditProfile.existingDebt = e.target.checked ? 'yes' : 'no'; autoSave(); }} />
						<span>Existing business debt?</span>
					</label>
				</div>

				<!-- Credit coaching callout -->
				{#if creditProfile.scoreRange === 'building'}
					<div class="coaching-callout coaching-warning">
						<div class="coaching-icon">📋</div>
						<div class="coaching-text">
							<strong>Credit Coaching:</strong> To unlock SBA 7(a) at better rates, focus on improving to 700+. Matched lenders adjusted to microloans and CDFI programs. We'll show you a 90-day credit improvement plan.
						</div>
					</div>
				{:else if creditProfile.scoreRange === 'fair'}
					<div class="coaching-callout coaching-info">
						<div class="coaching-icon">💡</div>
						<div class="coaching-text">
							<strong>Tip:</strong> SBA microloans and CDFI programs are your best match. Improving to 700+ unlocks SBA 7(a) at better rates — here are 3 things you can do in 90 days.
						</div>
					</div>
				{:else if creditProfile.scoreRange === 'unknown'}
					<div class="coaching-callout coaching-info">
						<div class="coaching-icon">🔍</div>
						<div class="coaching-text">
							<strong>Check your score for free:</strong> Credit Karma, Experian, or your bank's app. We'll show all lender options unfiltered, but results are more accurate with your credit range.
						</div>
					</div>
				{:else if creditProfile.scoreRange === 'excellent' || creditProfile.scoreRange === 'good'}
					<div class="coaching-callout coaching-success">
						<div class="coaching-icon">✓</div>
						<div class="coaching-text">
							<strong>Strong position.</strong> Eligible for all SBA 7(a) lenders at {creditProfile.scoreRange === 'excellent' ? 'preferred' : 'standard'} rates. Full lender list available in Loan Readiness.
						</div>
					</div>
				{/if}

				<div class="privacy-notice">
					RE² never performs credit checks. This information stays in your account and is used only to match you with appropriate lenders and programs.
				</div>
			</div>
		</section>

		<!-- Navigation -->
		<div class="nav-footer">
			<a href="/app/location" class="nav-link">← Your Score</a>
			<a href="/app/vision/concept" class="nav-link primary">Next: Concept & Goals →</a>
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
		background: rgba(52, 199, 89, 0.08);
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

	.page-header h1 {
		font-size: 22px;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		color: var(--text);
		letter-spacing: 0.5px;
	}

	.page-header .subtitle {
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
		background-color: var(--bg);
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

	.section-badge {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		padding: 3px 10px;
		border-radius: 4px;
		background: rgba(255, 149, 0, 0.08);
		color: var(--warning);
	}

	.section-badge.complete {
		background: rgba(52, 199, 89, 0.08);
		color: var(--success);
	}

	.section-badge.privacy {
		background: var(--accent-light);
		color: var(--accent);
	}

	.profile-question {
		margin-bottom: 28px;
	}

	.profile-q-label {
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 12px 0;
	}

	.card-options {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
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
		background: var(--surface-elevated);
		border: 1px solid var(--border);
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
	}

	.profile-card:hover {
		border-color: var(--border-hover);
		background: var(--surface);
	}

	.profile-card.selected {
		border-color: var(--accent);
		background: var(--accent-light);
		box-shadow: 0 0 0 1px rgba(0, 113, 227, 0.2);
	}

	.profile-card-sm {
		padding: 10px 12px;
		text-align: center;
		align-items: center;
	}

	.card-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
	}

	.card-desc {
		font-size: 11px;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.profile-card.selected .card-desc {
		color: var(--text);
	}

	.coaching-callout {
		display: flex;
		gap: 12px;
		padding: 14px 18px;
		background: var(--accent-light);
		border: 1px solid rgba(0, 113, 227, 0.12);
		border-radius: 8px;
		margin-top: 8px;
	}

	.coaching-callout.coaching-warning {
		background: rgba(255, 149, 0, 0.05);
		border-color: rgba(255, 149, 0, 0.12);
	}

	.coaching-callout.coaching-info {
		background: var(--accent-light);
		border-color: rgba(0, 113, 227, 0.12);
	}

	.coaching-callout.coaching-success {
		background: rgba(52, 199, 89, 0.08);
		border-color: rgba(52, 199, 89, 0.12);
	}

	.coaching-icon {
		font-size: 18px;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.coaching-text {
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.coaching-text strong {
		color: var(--text);
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
		color: var(--text-secondary);
		cursor: pointer;
	}

	.credit-flag input[type="checkbox"] {
		width: 16px;
		height: 16px;
		accent-color: var(--accent);
		cursor: pointer;
	}

	.privacy-notice {
		font-size: 11px;
		color: var(--text-secondary);
		margin-top: 16px;
		padding: 10px 14px;
		background: var(--accent-light);
		border-radius: 6px;
		border: 1px solid rgba(0, 113, 227, 0.12);
	}

	.grid {
		display: grid;
		gap: 1rem;
	}

	.grid-2col {
		grid-template-columns: repeat(2, 1fr);
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
		border-color: var(--accent);
		background-color: var(--surface);
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
		border-color: var(--accent);
		color: var(--accent);
	}

	.nav-link.primary {
		background-color: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}

	.nav-link.primary:hover {
		background-color: #0062CC;
		border-color: #0062CC;
	}

	/* Tablet breakpoint: 768px and below */
	@media (max-width: 768px) {
		.page {
			padding: 1.5rem 1rem;
		}

		.section-content {
			padding: 0.875rem;
		}

		.card-options-5 {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	/* Mobile breakpoint: 640px and below */
	@media (max-width: 640px) {
		.page {
			padding: 1rem 0.75rem;
		}

		.page-header {
			margin-bottom: 1.5rem;
			padding-bottom: 0.75rem;
		}

		.page-header h1 {
			font-size: 18px;
		}

		.page-header .subtitle {
			font-size: 13px;
		}

		.section-content {
			padding: 0.75rem;
		}

		.profile-q-label {
			font-size: 14px;
			margin-bottom: 10px;
		}

		.card-options {
			grid-template-columns: repeat(2, 1fr);
		}

		.card-options-3 {
			grid-template-columns: repeat(2, 1fr);
		}

		.card-options-5 {
			grid-template-columns: repeat(2, 1fr);
		}

		.grid-2col {
			grid-template-columns: 1fr;
		}

		.nav-footer {
			flex-direction: column;
			margin-top: 1.5rem;
			padding-top: 1rem;
			gap: 0.75rem;
		}

		.nav-link {
			padding: 0.7rem 1.25rem;
			font-size: 13px;
		}

		.profile-card {
			padding: 12px 14px;
		}

		.card-title {
			font-size: 13px;
		}

		.card-desc {
			font-size: 10px;
		}

		.coaching-callout {
			padding: 12px 14px;
			gap: 10px;
		}

		.coaching-icon {
			font-size: 16px;
		}

		.coaching-text {
			font-size: 12px;
		}
	}

	/* Small phone breakpoint: 420px and below */
	@media (max-width: 420px) {
		.page {
			padding: 0.75rem 0.5rem;
		}

		.page-header {
			margin-bottom: 1.25rem;
			padding-bottom: 0.5rem;
		}

		.page-header h1 {
			font-size: 16px;
			margin-bottom: 0.25rem;
		}

		.page-header .subtitle {
			font-size: 12px;
			line-height: 1.4;
		}

		.save-indicator {
			top: 55px;
			right: 12px;
			padding: 5px 12px;
			font-size: 0.75rem;
		}

		.section-header {
			padding: 0.75rem;
		}

		.section-context-paragraph {
			padding: 0.75rem;
			font-size: 13px;
		}

		.section-content {
			padding: 0.5rem;
		}

		.profile-question {
			margin-bottom: 20px;
		}

		.profile-q-label {
			font-size: 13px;
			margin-bottom: 8px;
		}

		.card-options,
		.card-options-3,
		.card-options-5 {
			grid-template-columns: 1fr;
			gap: 8px;
		}

		.profile-card {
			padding: 10px 12px;
		}

		.profile-card-sm {
			padding: 8px 10px;
		}

		.card-title {
			font-size: 12px;
		}

		.card-desc {
			font-size: 9px;
		}

		.form-group input,
		.form-group textarea,
		.form-group select {
			padding: 10px 12px;
			font-size: 14px;
		}

		.form-group label {
			font-size: 13px;
		}

		.credit-flags {
			gap: 8px;
			margin-top: 12px;
		}

		.credit-flag {
			font-size: 12px;
			gap: 8px;
		}

		.privacy-notice {
			font-size: 10px;
			padding: 8px 10px;
			margin-top: 12px;
		}

		.coaching-callout {
			padding: 10px 12px;
			gap: 8px;
		}

		.coaching-icon {
			font-size: 14px;
		}

		.coaching-text {
			font-size: 11px;
		}

		.nav-footer {
			flex-direction: column;
			gap: 0.5rem;
			margin-top: 1rem;
			padding-top: 0.75rem;
		}

		.nav-link {
			padding: 0.6rem 1rem;
			font-size: 12px;
		}

		.content {
			gap: 1rem;
		}
	}
</style>
