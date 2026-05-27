<script>
	import '../overview/shared.css';

	let {
		founderProfile = $bindable(),
		founderProfileComplete,
		onchange
	} = $props();
</script>

<section class="section founder-profile-section">
	<div class="section-context-paragraph">
		Before scoring a single location, let's understand you as a founder. Your answers here feed into every module — business model, financial projections, loan package, and coaching recommendations.
	</div>
	<div class="section-header">
		<h2>Founder Profile</h2>
		{#if founderProfileComplete}
			<span class="section-badge complete">Complete</span>
		{:else}
			<span class="section-badge">Required</span>
		{/if}
	</div>

	<div class="section-content">
		<!-- Q1: What do you want from this business? -->
		<div class="profile-question">
			<h3 class="profile-q-label">What do you want from this business?</h3>
			<div class="card-options">
				{#each [
					{ value: 'legacy', label: 'Legacy', desc: 'Generational wealth and a lasting brand' },
					{ value: 'passion', label: 'Full-Time Passion', desc: 'This is your primary career and calling' },
					{ value: 'sideincome', label: 'Side Income', desc: 'Keep your day job, build on the side' },
					{ value: 'investment', label: 'Investment', desc: 'Portfolio play — returns matter most' },
					{ value: 'community', label: 'Community Impact', desc: 'Mission-driven, serving your neighborhood' }
				] as opt}
					<button
						class="profile-card"
						class:selected={founderProfile.motivation === opt.value}
						onclick={() => { founderProfile.motivation = opt.value; onchange(); }}
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
						onclick={() => { founderProfile.ownerType = opt.value; onchange(); }}
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
						onclick={() => { founderProfile.riskTolerance = opt.value; onchange(); }}
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
						onclick={() => { founderProfile.experience = opt.value; onchange(); }}
					>
						<span class="card-title">{opt.label}</span>
						<span class="card-desc">{opt.desc}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Q5: Year 1 Goals -->
		<div class="profile-question">
			<h3 class="profile-q-label">What does success look like in Year 1?</h3>
			<div class="grid grid-2col">
				<div class="col">
					<div class="form-group">
						<label for="y1Revenue">Revenue Target</label>
						<input type="number" id="y1Revenue" bind:value={founderProfile.yearOneGoals.revenueTarget} oninput={onchange} />
					</div>
					<div class="form-group">
						<label for="y1Income">Personal Income Target</label>
						<input type="number" id="y1Income" bind:value={founderProfile.yearOneGoals.personalIncomeTarget} oninput={onchange} />
					</div>
				</div>
				<div class="col">
					<div class="form-group">
						<label for="y1Employees">Number of Employees</label>
						<input type="number" id="y1Employees" bind:value={founderProfile.yearOneGoals.employeeCount} oninput={onchange} />
					</div>
					<div class="form-group">
						<label for="y1Locations">Number of Locations</label>
						<input type="number" id="y1Locations" bind:value={founderProfile.yearOneGoals.locationCount} oninput={onchange} />
					</div>
				</div>
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
						Scoring weights favor affordability and lower-risk neighborhoods.
					{:else if founderProfile.riskTolerance === 'aggressive'}
						Scoring weights favor high-traffic premium neighborhoods.
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

<style>
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
		border-color: #999;
		background: #f5f5f7;
	}

	.profile-card.selected {
		border-color: #34C759;
		background: rgba(52, 199, 89, 0.08);
		box-shadow: 0 0 0 1px rgba(52, 199, 89, 0.2);
	}

	.card-title {
		font-size: 14px;
		font-weight: 700;
		color: #1d1d1f;
	}

	.card-desc {
		font-size: 11px;
		color: #86868b;
		line-height: 1.4;
	}

	.profile-card.selected .card-desc {
		color: #5d5d6c;
	}

	.coaching-callout {
		display: flex;
		gap: 12px;
		padding: 14px 18px;
		background: rgba(52, 199, 89, 0.08);
		border: 1px solid rgba(52, 199, 89, 0.2);
		border-radius: 8px;
		margin-top: 8px;
	}

	.coaching-icon {
		font-size: 18px;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.coaching-text {
		font-size: 13px;
		color: #6e6e73;
		line-height: 1.5;
	}

	.coaching-text strong {
		color: #1d1d1f;
	}

	@media (max-width: 640px) {
		.card-options, .card-options-3 {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 420px) {
		.card-options, .card-options-3 {
			grid-template-columns: 1fr;
		}
	}
</style>
