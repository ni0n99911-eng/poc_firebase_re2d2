<script>
	import '../overview/shared.css';

	let {
		creditProfile = $bindable(),
		onchange
	} = $props();
</script>

<section class="section credit-profile-section">
	<div class="section-context-paragraph">
		This adjusts your lender matching, interest rate estimates, and coaching. We never perform credit checks — this stays in your account.
	</div>
	<div class="section-header">
		<h2>Credit Profile</h2>
		<span class="section-badge privacy">No Hard Pull</span>
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
						onclick={() => { creditProfile.scoreRange = opt.value; onchange(); }}
					>
						<span class="card-title">{opt.label}</span>
						<span class="card-desc">{opt.desc}</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="credit-flags">
			<label class="credit-flag">
				<input type="checkbox" bind:checked={creditProfile.bankruptcy} onchange={onchange} />
				<span>Any bankruptcies in the last 7 years?</span>
			</label>
			<label class="credit-flag">
				<input type="checkbox" bind:checked={creditProfile.latePayments} onchange={onchange} />
				<span>Any late payments in the last 12 months?</span>
			</label>
			<label class="credit-flag">
				<input type="checkbox" bind:checked={creditProfile.collections} onchange={onchange} />
				<span>Outstanding collections?</span>
			</label>
			<label class="credit-flag">
				<input type="checkbox" checked={creditProfile.existingDebt === 'yes'} onchange={(e) => { creditProfile.existingDebt = e.target.checked ? 'yes' : 'no'; onchange(); }} />
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
					<strong>Strong position.</strong> Eligible for all SBA 7(a) lenders at {creditProfile.scoreRange === 'excellent' ? 'preferred' : 'standard'} rates. Full lender list available in Loan IQ.
				</div>
			</div>
		{/if}

		<div class="privacy-notice">
			RE² never performs credit checks. This information stays in your account and is used only to match you with appropriate lenders and programs.
		</div>
	</div>
</section>

<style>
	.section-badge.privacy {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		padding: 3px 10px;
		border-radius: 4px;
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

	.card-options-5 {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 10px;
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

	.profile-card-sm {
		padding: 10px 12px;
		text-align: center;
		align-items: center;
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
		color: #6e6e73;
		cursor: pointer;
	}

	.credit-flag input[type="checkbox"] {
		width: 16px;
		height: 16px;
		accent-color: #34C759;
		cursor: pointer;
	}

	.coaching-callout {
		display: flex;
		gap: 12px;
		padding: 14px 18px;
		border-radius: 8px;
		margin-top: 16px;
	}

	.coaching-callout.coaching-warning {
		background: rgba(245, 158, 11, 0.05);
		border: 1px solid rgba(245, 158, 11, 0.15);
	}

	.coaching-callout.coaching-info {
		background: rgba(59, 130, 246, 0.05);
		border: 1px solid rgba(59, 130, 246, 0.15);
	}

	.coaching-callout.coaching-success {
		background: rgba(16, 185, 129, 0.05);
		border: 1px solid rgba(16, 185, 129, 0.15);
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

	.privacy-notice {
		font-size: 11px;
		color: #86868b;
		margin-top: 16px;
		padding: 10px 14px;
		background: rgba(0, 113, 227, 0.04);
		border-radius: 6px;
		border: 1px solid rgba(0, 113, 227, 0.1);
	}

	@media (max-width: 640px) {
		.card-options-5 {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 420px) {
		.card-options-5 {
			grid-template-columns: 1fr;
		}
	}
</style>
